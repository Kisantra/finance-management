<?php

namespace App\Mcp\Tools;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Company;
use App\Models\Payment;
use App\Models\TransactionCategory;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\Query\Expression;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;

/**
 * Mutasi rekening = tab Transaksi + tab Pembayaran halaman Rekening Bank
 * (BankTransactionController::indexTransactions & indexPayments) digabung lintas rekening,
 * karena pembayaran invoice juga uang masuk ke rekening (rumus saldo BankAccount::balance).
 * Kaki transfer dipasangkan lewat `transfer_group_id`, tidak pernah lewat `reference_number`
 * (docs/module/cash-flow.md); baris warisan tanpa ULID tidak ditebak pasangannya.
 */
class MutasiRekening extends AlatKeuangan
{
    private const PER_HALAMAN_BAWAAN = 25;

    private const PER_HALAMAN_MAKS = 50;

    protected string $name = 'mutasi-rekening';

    protected string $description = 'Mutasi uang masuk/keluar rekening bank (transaksi bank + pembayaran invoice yang masuk ke rekening) dalam rentang tanggal, bawaan bulan berjalan, terbaru dulu. Filter: rekening (id dari rekening-bank), arah, kategori (id dari kategori-transaksi), kata_kunci; per halaman bawaan 25, maks 50. total dan per_jenis menghitung SELURUH hasil filter, bukan hanya halaman ini. saldo_rekening = saldo awal (sebelum dari) dan akhir (per sampai) rekening terpilih atau semua rekening, selalu dari semua mutasi tanpa filter arah/kategori/kata_kunci. jenis: income = pemasukan, expense = pengeluaran, transfer = pindah dana antar rekening sendiri (kaki keluar sudah termasuk biaya_admin), financing = pendanaan (pokok pinjaman/piutang, setoran titipan), adjustment = penyesuaian, pembayaran_invoice, tanpa_kategori. Tanpa filter rekening, satu transfer muncul di masuk DAN keluar. lampiran: true = ada bukti (berkas tidak dikirim).';

    protected function izin(): string
    {
        return 'view bank-accounts';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'rekening' => $schema->integer()->min(1)
                ->description('ID rekening dari alat rekening-bank. Kosongkan untuk semua rekening.'),
            'arah' => $schema->string()->enum(['masuk', 'keluar'])
                ->description('masuk = uang masuk (kredit, termasuk pembayaran invoice), keluar = uang keluar (debit).'),
            'kategori' => $schema->integer()->min(1)
                ->description('ID kategori dari kategori-transaksi; kategori induk ikut menyertakan sub-kategorinya. Pembayaran invoice tidak berkategori sehingga tidak ikut.'),
            'kata_kunci' => $schema->string()
                ->description('Cari di keterangan dan nomor referensi; untuk pembayaran invoice di nomor invoice, nama klien, dan referensi.'),
            'dari' => $schema->string()->format('date')
                ->description('Tanggal awal, YYYY-MM-DD. Bawaan: tanggal 1 bulan berjalan.'),
            'sampai' => $schema->string()->format('date')
                ->description('Tanggal akhir (ikut dihitung), YYYY-MM-DD. Bawaan: akhir bulan berjalan.'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1.'),
            'per_halaman' => $schema->integer()->min(1)->max(self::PER_HALAMAN_MAKS)
                ->description('Baris per halaman, bawaan 25, maksimal 50.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $data = $request->validate([
            'rekening' => ['bail', 'nullable', 'integer', Rule::exists(BankAccount::class, 'id')],
            'arah' => ['bail', 'nullable', 'string', 'in:masuk,keluar'],
            'kategori' => ['bail', 'nullable', 'integer', Rule::exists(TransactionCategory::class, 'id')],
            'kata_kunci' => ['bail', 'nullable', 'string', 'max:100'],
            'dari' => ['bail', 'nullable', 'date_format:Y-m-d'],
            'sampai' => ['bail', 'nullable', 'date_format:Y-m-d'],
            'halaman' => ['bail', 'nullable', 'integer', 'min:1', 'max:100000'],
            'per_halaman' => ['bail', 'nullable', 'integer', 'min:1', 'max:'.self::PER_HALAMAN_MAKS],
        ], [
            'rekening.exists' => 'Rekening dengan id itu tidak ada di perusahaan ini. Panggil rekening-bank untuk melihat id yang tersedia.',
            'rekening' => 'rekening harus id rekening berupa angka; lihat alat rekening-bank.',
            'arah' => 'arah hanya boleh "masuk" atau "keluar".',
            'kategori.exists' => 'Kategori dengan id itu tidak ada di perusahaan ini. Panggil kategori-transaksi untuk melihat id yang tersedia.',
            'kategori' => 'kategori harus id kategori berupa angka; lihat alat kategori-transaksi.',
            'kata_kunci' => 'kata_kunci harus teks, maksimal 100 karakter.',
            'dari' => 'dari harus tanggal berformat YYYY-MM-DD, mis. 2026-11-01.',
            'sampai' => 'sampai harus tanggal berformat YYYY-MM-DD, mis. 2026-11-30.',
            'halaman' => 'halaman harus bilangan bulat mulai 1.',
            'per_halaman' => 'per_halaman harus bilangan bulat 1–'.self::PER_HALAMAN_MAKS.'.',
        ]);

        [$dari, $sampai] = $this->periode($data);
        $rekeningId = isset($data['rekening']) ? (int) $data['rekening'] : null;
        $arah = filled($data['arah'] ?? null) ? (string) $data['arah'] : null;
        $kataKunci = filled($data['kata_kunci'] ?? null) ? trim((string) $data['kata_kunci']) : null;
        $halaman = (int) ($data['halaman'] ?? 1);
        $perHalaman = (int) ($data['per_halaman'] ?? self::PER_HALAMAN_BAWAAN);

        $kategori = isset($data['kategori'])
            ? TransactionCategory::query()->find((int) $data['kategori'], ['id', 'label'])
            : null;
        $kategoriIds = $kategori !== null ? $this->kategoriBesertaTurunan($kategori->id) : null;

        $namaRekening = BankAccount::query()
            ->get(['id', 'bank_name', 'account_name'])
            ->mapWithKeys(fn (BankAccount $akun): array => [$akun->id => "{$akun->bank_name} · {$akun->account_name}"]);

        $mutasi = $this->mutasi($dari, $sampai, $rekeningId, $arah, $kategoriIds, $kataKunci);

        $perJenis = (clone $mutasi)
            ->selectRaw("jenis, COUNT(*) AS jumlah_baris, COALESCE(SUM(CASE WHEN arah = 'credit' THEN jumlah ELSE 0 END), 0) AS masuk, COALESCE(SUM(CASE WHEN arah = 'debit' THEN jumlah ELSE 0 END), 0) AS keluar")
            ->groupBy('jenis')
            ->get()
            ->map(fn (object $baris): array => [
                'jenis' => $baris->jenis ?? 'tanpa_kategori',
                'jumlah_baris' => (int) $baris->jumlah_baris,
                'masuk' => (int) $baris->masuk,
                'keluar' => (int) $baris->keluar,
            ])
            ->sortByDesc(fn (array $baris): int => $baris['masuk'] + $baris['keluar']);

        $jumlahBaris = (int) $perJenis->sum('jumlah_baris');
        $masuk = (int) $perJenis->sum('masuk');
        $keluar = (int) $perJenis->sum('keluar');
        $totalHalaman = max(1, (int) ceil($jumlahBaris / $perHalaman));

        $baris = (clone $mutasi)
            ->orderByDesc('tanggal')
            ->orderBy('sumber')
            ->orderByDesc('id')
            ->forPage($halaman, $perHalaman)
            ->get();

        return [
            'periode' => ['dari' => $dari, 'sampai' => $sampai],
            'filter' => (object) array_filter([
                'rekening' => $rekeningId !== null ? ['id' => $rekeningId, 'nama' => $namaRekening->get($rekeningId)] : null,
                'arah' => $arah,
                'kategori' => $kategori !== null ? [
                    'id' => $kategori->id,
                    'label' => $kategori->label,
                    'termasuk_sub_kategori' => count($kategoriIds) > 1,
                ] : null,
                'kata_kunci' => $kataKunci,
            ], fn ($nilai): bool => $nilai !== null),
            'saldo_rekening' => $this->saldo($rekeningId, $dari, $sampai),
            'total' => [
                'jumlah_baris' => $jumlahBaris,
                'masuk' => $masuk,
                'keluar' => $keluar,
                'bersih' => $masuk - $keluar,
            ],
            'per_jenis' => (object) $perJenis
                ->mapWithKeys(fn (array $baris): array => [$baris['jenis'] => Arr::except($baris, 'jenis')])
                ->all(),
            'halaman' => $halaman,
            'per_halaman' => $perHalaman,
            'total_halaman' => $totalHalaman,
            ...($halaman > $totalHalaman ? ['catatan' => "Halaman {$halaman} melebihi total_halaman ({$totalHalaman})."] : []),
            'mutasi' => $this->baris($baris, $namaRekening, $rekeningId === null),
        ];
    }

    /**
     * Tabel turunan `mutasi`: transaksi bank + pembayaran invoice yang lolos filter, dengan kolom
     * yang diseragamkan. Pencarian mengikuti tab Transaksi (keterangan/referensi) dan tab
     * Pembayaran (nomor invoice/klien/referensi). Pembayaran invoice selalu uang masuk dan tidak
     * berkategori (sama dengan CashFlowController::income), jadi tidak ikut bila filter arah
     * keluar atau kategori dipakai.
     *
     * @param  list<int>|null  $kategoriIds
     */
    private function mutasi(string $dari, string $sampai, ?int $rekeningId, ?string $arah, ?array $kategoriIds, ?string $kataKunci): QueryBuilder
    {
        $pola = $kataKunci !== null ? '%'.addcslashes($kataKunci, '\\%_').'%' : null;

        $transaksi = BankTransaction::query()
            ->leftJoin('transaction_categories as kat', 'kat.id', '=', 'bank_transactions.category_id')
            ->leftJoin('transaction_categories as kat_induk', 'kat_induk.id', '=', 'kat.parent_id')
            ->whereBetween('bank_transactions.transaction_date', [$dari, $sampai])
            ->when($rekeningId !== null, fn (Builder $q) => $q->where('bank_transactions.bank_account_id', $rekeningId))
            ->when($arah !== null, fn (Builder $q) => $q->where('bank_transactions.transaction_type', $arah === 'masuk' ? 'credit' : 'debit'))
            ->when($kategoriIds !== null, fn (Builder $q) => $q->whereIn('bank_transactions.category_id', $kategoriIds))
            ->when($pola !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('bank_transactions.description', 'like', $pola)
                ->orWhere('bank_transactions.reference_number', 'like', $pola)))
            ->select([
                new Expression("'transaksi' AS sumber"),
                'bank_transactions.id',
                'bank_transactions.transaction_date AS tanggal',
                'bank_transactions.transaction_type AS arah',
                'bank_transactions.amount AS jumlah',
                'bank_transactions.bank_account_id',
                'bank_transactions.description AS keterangan',
                'bank_transactions.reference_number AS referensi',
                'bank_transactions.transfer_group_id',
                'kat.label AS kategori_label',
                'kat_induk.label AS kategori_induk',
                'kat.type AS jenis',
                new Expression('NULL AS nomor_invoice'),
                new Expression('NULL AS klien'),
                new Expression('CASE WHEN bank_transactions.attachment_path IS NULL THEN 0 ELSE 1 END AS lampiran'),
            ])
            ->toBase();

        $sumber = $transaksi;

        if ($arah !== 'keluar' && $kategoriIds === null) {
            $pembayaran = Payment::query()
                ->leftJoin('invoices', 'invoices.id', '=', 'payments.invoice_id')
                ->leftJoin('clients', 'clients.id', '=', 'invoices.billed_to_id')
                ->whereBetween('payments.payment_date', [$dari, $sampai])
                ->when($rekeningId !== null, fn (Builder $q) => $q->where('payments.bank_account_id', $rekeningId))
                ->when($pola !== null, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                    ->where('invoices.invoice_number', 'like', $pola)
                    ->orWhere('clients.name', 'like', $pola)
                    ->orWhere('payments.reference_number', 'like', $pola)))
                ->select([
                    new Expression("'pembayaran_invoice' AS sumber"),
                    'payments.id',
                    'payments.payment_date AS tanggal',
                    new Expression("'credit' AS arah"),
                    'payments.amount AS jumlah',
                    'payments.bank_account_id',
                    new Expression('NULL AS keterangan'),
                    'payments.reference_number AS referensi',
                    new Expression('NULL AS transfer_group_id'),
                    new Expression('NULL AS kategori_label'),
                    new Expression('NULL AS kategori_induk'),
                    new Expression("'pembayaran_invoice' AS jenis"),
                    'invoices.invoice_number AS nomor_invoice',
                    'clients.name AS klien',
                    new Expression('CASE WHEN payments.attachment_path IS NULL THEN 0 ELSE 1 END AS lampiran'),
                ])
                ->toBase();

            $sumber = $transaksi->newQuery()->fromSub($transaksi, 't')
                ->unionAll($transaksi->newQuery()->fromSub($pembayaran, 'p'));
        }

        return $transaksi->newQuery()->fromSub($sumber, 'mutasi');
    }

    /**
     * Baris halaman ini dalam bentuk ringkas. Pasangan transfer dicari sekali untuk seluruh
     * halaman; biaya admin = debit kaki keluar − kredit kaki masuk (CashFlowController::transfers).
     *
     * @param  Collection<int, object>  $baris
     * @param  Collection<int, string>  $namaRekening
     * @return list<array<string, mixed>>
     */
    private function baris(Collection $baris, Collection $namaRekening, bool $tampilkanRekening): array
    {
        $grupTransfer = $baris->pluck('transfer_group_id')->filter()->unique()->values();

        $kakiTransfer = $grupTransfer->isEmpty()
            ? collect()
            : BankTransaction::query()
                ->whereIn('transfer_group_id', $grupTransfer)
                ->get(['id', 'transfer_group_id', 'bank_account_id', 'transaction_type', 'amount'])
                ->groupBy('transfer_group_id');

        return $baris->map(function (object $mutasi) use ($kakiTransfer, $namaRekening, $tampilkanRekening): array {
            $pasangan = $mutasi->transfer_group_id === null ? null : $kakiTransfer
                ->get($mutasi->transfer_group_id, collect())
                ->first(fn (BankTransaction $kaki): bool => (int) $kaki->id !== (int) $mutasi->id
                    && $kaki->transaction_type !== $mutasi->arah);

            $kategori = $mutasi->kategori_label === null ? null : ($mutasi->kategori_induk === null
                ? $mutasi->kategori_label
                : "{$mutasi->kategori_induk} → {$mutasi->kategori_label}");

            $biayaAdmin = $pasangan !== null && $mutasi->arah === 'debit'
                ? (int) $mutasi->jumlah - (int) $pasangan->amount
                : 0;

            return array_filter([
                'tanggal' => substr((string) $mutasi->tanggal, 0, 10),
                'arah' => $mutasi->arah === 'credit' ? 'masuk' : 'keluar',
                'jumlah' => (int) $mutasi->jumlah,
                'rekening' => $tampilkanRekening ? $namaRekening->get($mutasi->bank_account_id) : null,
                'jenis' => $mutasi->jenis ?? 'tanpa_kategori',
                'kategori' => $kategori,
                'keterangan' => $mutasi->keterangan,
                'invoice' => $mutasi->nomor_invoice,
                'klien' => $mutasi->klien,
                'referensi' => $mutasi->referensi,
                'pasangan_rekening' => $pasangan !== null ? $namaRekening->get($pasangan->bank_account_id) : null,
                'biaya_admin' => $biayaAdmin > 0 ? $biayaAdmin : null,
                'lampiran' => (int) $mutasi->lampiran === 1 ? true : null,
            ], fn ($nilai): bool => $nilai !== null);
        })->values()->all();
    }

    /**
     * Saldo sebelum `dari` dan per `sampai` untuk rekening terpilih (atau semua), rumus yang sama
     * dengan BankAccount::balance dan CashFlowExportService::getBalanceBeforeDate():
     * saldo awal rekening + pembayaran invoice + kredit − debit.
     *
     * @return array{awal: int, akhir: int}
     */
    private function saldo(?int $rekeningId, string $dari, string $sampai): array
    {
        $saldoAwalRekening = (int) BankAccount::query()
            ->when($rekeningId !== null, fn (Builder $q) => $q->whereKey($rekeningId))
            ->sum('initial_balance');

        $pembayaran = Payment::query()
            ->when($rekeningId !== null, fn (Builder $q) => $q->where('bank_account_id', $rekeningId))
            ->where('payment_date', '<=', $sampai)
            ->selectRaw('COALESCE(SUM(CASE WHEN payment_date < ? THEN amount ELSE 0 END), 0) AS sebelum', [$dari])
            ->selectRaw('COALESCE(SUM(amount), 0) AS sampai')
            ->toBase()
            ->first();

        $netto = "CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END";

        $transaksi = BankTransaction::query()
            ->when($rekeningId !== null, fn (Builder $q) => $q->where('bank_account_id', $rekeningId))
            ->where('transaction_date', '<=', $sampai)
            ->selectRaw("COALESCE(SUM(CASE WHEN transaction_date < ? THEN {$netto} ELSE 0 END), 0) AS sebelum", [$dari])
            ->selectRaw("COALESCE(SUM({$netto}), 0) AS sampai")
            ->toBase()
            ->first();

        return [
            'awal' => $saldoAwalRekening + (int) $pembayaran->sebelum + (int) $transaksi->sebelum,
            'akhir' => $saldoAwalRekening + (int) $pembayaran->sampai + (int) $transaksi->sampai,
        ];
    }

    /**
     * Id kategori beserta seluruh turunannya. Picker aplikasi hanya menawarkan sub-kategori,
     * jadi untuk sub-kategori hasilnya sama dengan filter `category_id` di tab Transaksi.
     *
     * @return list<int>
     */
    private function kategoriBesertaTurunan(int $id): array
    {
        $anakPerInduk = TransactionCategory::query()
            ->whereNotNull('parent_id')
            ->get(['id', 'parent_id'])
            ->groupBy('parent_id');

        $terpilih = [$id => true];
        $antrean = [$id];

        while ($antrean !== []) {
            $induk = array_shift($antrean);

            foreach ($anakPerInduk->get($induk, []) as $anak) {
                if (! isset($terpilih[$anak->id])) {
                    $terpilih[$anak->id] = true;
                    $antrean[] = $anak->id;
                }
            }
        }

        return array_keys($terpilih);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: string, 1: string}
     *
     * @throws ValidationException
     */
    private function periode(array $data): array
    {
        $dari = filled($data['dari'] ?? null) ? (string) $data['dari'] : today()->startOfMonth()->toDateString();
        $sampai = filled($data['sampai'] ?? null) ? (string) $data['sampai'] : today()->endOfMonth()->toDateString();

        if ($sampai < $dari) {
            throw ValidationException::withMessages([
                'sampai' => "Rentang tanggal tidak valid: sampai ({$sampai}) lebih awal dari dari ({$dari}). Kirim dari dan sampai bersama, dengan sampai sama dengan atau setelah dari.",
            ]);
        }

        return [$dari, $sampai];
    }
}
