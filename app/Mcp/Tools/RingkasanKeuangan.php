<?php

namespace App\Mcp\Tools;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Company;
use App\Models\FundRequest;
use App\Models\Invoice;
use App\Models\Loan;
use App\Models\LoanPayment;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\Reimbursement;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;

/**
 * Ringkasan satu layar untuk diskusi keuangan. Setiap bagian memakai definisi halaman asalnya
 * di aplikasi dan hanya dikirim bila pengguna juga memegang izin lihat modul itu di perusahaan
 * ini (team Spatie sudah dipasang AlatKeuangan sebelum jalankan()).
 */
class RingkasanKeuangan extends AlatKeuangan
{
    /**
     * Bagian ringkasan => izin lihat modul asalnya.
     *
     * @var array<string, string>
     */
    private const BAGIAN = [
        'kas' => 'view bank-accounts',
        'pemasukan' => 'view income',
        'pengeluaran' => 'view expense',
        'invoice' => 'view invoices',
        'piutang' => 'view receivables',
        'utang' => 'view loans',
        'reimbursement' => 'view reimbursements',
        'pengajuan_dana' => 'view fund requests',
    ];

    /** Invoice yang masih ditagih; sama dengan DashboardController::PENDING. */
    private const INVOICE_BELUM_LUNAS = ['sent', 'partially_paid', 'overdue'];

    /** Label seperti di aplikasi (resources/js/pages/invoices/components/ob.tsx & dashboard.tsx). */
    private const LABEL_STATUS_INVOICE = [
        'sent' => 'Terkirim',
        'partially_paid' => 'Dibayar sebagian',
        'overdue' => 'Lewat tempo',
    ];

    private const RINCIAN_TERATAS = 5;

    protected string $name = 'ringkasan-keuangan';

    protected string $description = 'Ringkasan keuangan satu periode (bawaan: bulan berjalan). kas: total saldo semua akun saat ini (total_saldo = total_bank rekening bank + total_kas kas tunai/kas kecil) + uang_masuk/uang_keluar periode = semua mutasi rekening termasuk transfer antar rekening dan utang/piutang (kartu Arus Kas di Ringkasan aplikasi). pemasukan/pengeluaran: definisi halaman Arus Kas, hanya kategori pemasukan/pengeluaran (+ pembayaran invoice), tanpa transfer, pendanaan, penyesuaian; per_kategori = 5 terbesar + Lainnya. invoice, piutang (uang perusahaan di pihak lain), utang (pinjaman yang diterima perusahaan), reimbursement, pengajuan_dana: posisi hari ini (posisi_per), tidak terikat periode; sisa_pokok tanpa bunga. Bagian yang modulnya tidak boleh Anda lihat tercantum di tidak_ditampilkan. Rincian: laba-rugi, mutasi-rekening.';

    protected function izin(): string
    {
        return 'view dashboard';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'dari' => $schema->string()->format('date')
                ->description('Awal periode, YYYY-MM-DD. Bawaan: tanggal 1 bulan berjalan.'),
            'sampai' => $schema->string()->format('date')
                ->description('Akhir periode (ikut dihitung), YYYY-MM-DD. Bawaan: akhir bulan berjalan.'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        [$dari, $sampai] = $this->periode($request);
        $hariIni = today()->toDateString();

        /** @var User $user */
        $user = $request->user();

        $hasil = [
            'periode' => ['dari' => $dari, 'sampai' => $sampai],
            'posisi_per' => $hariIni,
        ];
        $tidakDitampilkan = [];

        foreach (self::BAGIAN as $bagian => $izin) {
            if (! $user->can($izin)) {
                $tidakDitampilkan[] = ['bagian' => $bagian, 'butuh_izin' => $izin];

                continue;
            }

            $hasil[$bagian] = match ($bagian) {
                'kas' => $this->kas($dari, $sampai),
                'pemasukan' => $this->pemasukan($dari, $sampai),
                'pengeluaran' => $this->pengeluaran($dari, $sampai),
                'invoice' => $this->invoice($hariIni),
                'piutang' => $this->piutang($hariIni),
                'utang' => $this->utang(),
                'reimbursement' => $this->reimbursement($user),
                'pengajuan_dana' => $this->pengajuanDana($user),
            };
        }

        $hasil['tidak_ditampilkan'] = $tidakDitampilkan;

        return $hasil;
    }

    /**
     * Saldo saat ini (BankAccount::withBalance, satu query), dirinci rekening bank vs kas tunai
     * seperti kartu Arus Kas di Ringkasan, + arus periode dengan definisi kartu itu
     * (DashboardController::getStats): masuk = kredit bank + pembayaran invoice, keluar = debit bank.
     *
     * @return array<string, int>
     */
    private function kas(string $dari, string $sampai): array
    {
        $rekening = BankAccount::query()->withBalance()->get();
        $totalSaldo = (int) $rekening->sum(fn (BankAccount $akun): int => $akun->balance);
        $totalKas = (int) $rekening->filter(fn (BankAccount $akun): bool => $akun->isCash())
            ->sum(fn (BankAccount $akun): int => $akun->balance);

        $mutasi = BankTransaction::query()
            ->whereBetween('transaction_date', [$dari, $sampai])
            ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END), 0) AS masuk")
            ->selectRaw("COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END), 0) AS keluar")
            ->toBase()
            ->first();

        $masuk = (int) $mutasi->masuk + $this->pembayaranInvoice($dari, $sampai);
        $keluar = (int) $mutasi->keluar;

        return [
            'total_saldo' => $totalSaldo,
            'total_bank' => $totalSaldo - $totalKas,
            'total_kas' => $totalKas,
            'jumlah_rekening' => $rekening->count(),
            'uang_masuk' => $masuk,
            'uang_keluar' => $keluar,
            'arus_bersih' => $masuk - $keluar,
        ];
    }

    /**
     * Definisi halaman Arus Kas › Pemasukan (CashFlowController::income): pembayaran invoice +
     * transaksi kredit yang kategorinya bertipe income.
     *
     * @return array<string, mixed>
     */
    private function pemasukan(string $dari, string $sampai): array
    {
        $perKategori = $this->transaksiPerKategori('credit', 'income', $dari, $sampai);
        $pembayaran = $this->pembayaranInvoice($dari, $sampai);

        return [
            'total' => $pembayaran + (int) $perKategori->sum(),
            'pembayaran_invoice' => $pembayaran,
            'per_kategori' => $this->teratas($perKategori),
        ];
    }

    /**
     * Definisi halaman Arus Kas › Pengeluaran (CashFlowController::expenses): transaksi debit
     * yang kategorinya bertipe expense.
     *
     * @return array<string, mixed>
     */
    private function pengeluaran(string $dari, string $sampai): array
    {
        $perKategori = $this->transaksiPerKategori('debit', 'expense', $dari, $sampai);

        return [
            'total' => (int) $perKategori->sum(),
            'per_kategori' => $this->teratas($perKategori),
        ];
    }

    /**
     * Invoice yang masih ditagih (DashboardController::getStats & getPendingInvoices). Lewat
     * tempo = belum lunas dan jatuh temponya sebelum hari ini (InvoiceController::applyStatusFilter).
     *
     * @return array<string, mixed>
     */
    private function invoice(string $hariIni): array
    {
        $tagihan = Invoice::query()
            ->whereIn('status', self::INVOICE_BELUM_LUNAS)
            ->selectRaw('COUNT(*) AS jumlah, COALESCE(SUM(total_amount), 0) AS total')
            ->selectRaw('COALESCE(SUM(CASE WHEN due_date < ? THEN 1 ELSE 0 END), 0) AS jumlah_lewat', [$hariIni])
            ->selectRaw('COALESCE(SUM(CASE WHEN due_date < ? THEN total_amount ELSE 0 END), 0) AS total_lewat', [$hariIni])
            ->toBase()
            ->first();

        $terbayar = Payment::query()
            ->join('invoices', 'invoices.id', '=', 'payments.invoice_id')
            ->whereIn('invoices.status', self::INVOICE_BELUM_LUNAS)
            ->selectRaw('COALESCE(SUM(payments.amount), 0) AS total')
            ->selectRaw('COALESCE(SUM(CASE WHEN invoices.due_date < ? THEN payments.amount ELSE 0 END), 0) AS lewat', [$hariIni])
            ->toBase()
            ->first();

        $terdekat = Invoice::query()
            ->with('client:id,name')
            ->withSum('payments', 'amount')
            ->whereIn('status', self::INVOICE_BELUM_LUNAS)
            ->orderBy('due_date')
            ->orderBy('id')
            ->limit(self::RINCIAN_TERATAS)
            ->get();

        return [
            'belum_dibayar' => [
                'jumlah' => (int) $tagihan->jumlah,
                'sisa' => max(0, (int) $tagihan->total - (int) $terbayar->total),
            ],
            'lewat_tempo' => [
                'jumlah' => (int) $tagihan->jumlah_lewat,
                'sisa' => max(0, (int) $tagihan->total_lewat - (int) $terbayar->lewat),
            ],
            'jatuh_tempo_terdekat' => $terdekat->map(fn (Invoice $invoice): array => [
                'nomor' => $invoice->invoice_number,
                'klien' => $invoice->client?->name,
                'total' => (int) $invoice->total_amount,
                'sisa' => (int) $invoice->total_amount - (int) $invoice->payments_sum_amount,
                'jatuh_tempo' => $invoice->due_date?->toDateString(),
                'hari_lewat_tempo' => $invoice->due_date !== null && $invoice->due_date->lt(today())
                    ? (int) $invoice->due_date->diffInDays(today())
                    : 0,
                'status' => $invoice->status,
                'status_label' => self::LABEL_STATUS_INVOICE[$invoice->status] ?? $invoice->status,
            ])->values()->all(),
        ];
    }

    /**
     * Ringkasan halaman Piutang (ReceivableController::index): sisa pokok dicakup ke piutang aktif;
     * lewat tempo = aktif, jatuh tempo sudah lewat, dan pokoknya belum tertutup.
     *
     * @return array<string, mixed>
     */
    private function piutang(string $hariIni): array
    {
        $status = Receivable::query()
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS aktif")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END), 0) AS pokok_aktif")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END), 0) AS menunggu")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN principal_amount ELSE 0 END), 0) AS pokok_menunggu")
            ->selectRaw("MIN(CASE WHEN status = 'active' THEN due_date END) AS jatuh_tempo_terdekat")
            ->toBase()
            ->first();

        $terbayarAktif = (int) ReceivablePayment::query()
            ->whereHas('receivable', fn (Builder $piutang) => $piutang->where('status', 'active'))
            ->sum('principal_paid');

        $lewatTempo = Receivable::query()
            ->leftJoinSub(
                ReceivablePayment::query()->selectRaw('receivable_id, SUM(principal_paid) AS pokok')->groupBy('receivable_id'),
                'bayar',
                'bayar.receivable_id',
                '=',
                'receivables.id',
            )
            ->where('receivables.status', 'active')
            ->whereDate('receivables.due_date', '<', $hariIni)
            ->whereRaw('receivables.principal_amount > COALESCE(bayar.pokok, 0)')
            ->selectRaw('COUNT(*) AS jumlah, COALESCE(SUM(receivables.principal_amount - COALESCE(bayar.pokok, 0)), 0) AS sisa_pokok')
            ->toBase()
            ->first();

        return [
            'aktif' => [
                'jumlah' => (int) $status->aktif,
                'sisa_pokok' => max(0, (int) $status->pokok_aktif - $terbayarAktif),
            ],
            'lewat_tempo' => [
                'jumlah' => (int) $lewatTempo->jumlah,
                'sisa_pokok' => (int) $lewatTempo->sisa_pokok,
            ],
            'menunggu_persetujuan' => [
                'jumlah' => (int) $status->menunggu,
                'pokok' => (int) $status->pokok_menunggu,
            ],
            'jatuh_tempo_terdekat' => $this->tanggal($status->jatuh_tempo_terdekat),
        ];
    }

    /**
     * Utang perusahaan, ringkasan halaman Utang (LoanController::index): sisa pokok dicakup ke
     * utang aktif.
     *
     * @return array<string, mixed>
     */
    private function utang(): array
    {
        $status = Loan::query()
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS aktif")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END), 0) AS pokok_aktif")
            ->selectRaw("MIN(CASE WHEN status = 'active' THEN maturity_date END) AS jatuh_tempo_terdekat")
            ->toBase()
            ->first();

        $terbayarAktif = (int) LoanPayment::query()
            ->whereHas('loan', fn (Builder $pinjaman) => $pinjaman->where('status', 'active'))
            ->sum('principal_paid');

        return [
            'aktif' => [
                'jumlah' => (int) $status->aktif,
                'sisa_pokok' => max(0, (int) $status->pokok_aktif - $terbayarAktif),
            ],
            'jatuh_tempo_terdekat' => $this->tanggal($status->jatuh_tempo_terdekat),
        ];
    }

    /**
     * Antrean reimbursement (ReimbursementController::index). Cakupannya sama dengan aplikasi:
     * hanya peninjau/pembayar yang melihat pengajuan semua orang, selain itu milik sendiri.
     *
     * @return array<string, mixed>
     */
    private function reimbursement(User $user): array
    {
        $semua = $user->can('approve reimbursements') || $user->can('pay reimbursements');

        $antrean = Reimbursement::query()
            ->when(! $semua, fn (Builder $q) => $q->where('user_id', $user->getKey()))
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS menunggu_review")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS nominal_review")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS menunggu_dibayar")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'approved' THEN amount - amount_paid ELSE 0 END), 0) AS sisa_dibayar")
            ->toBase()
            ->first();

        return [
            'cakupan' => $semua ? 'semua_pengajuan' : 'pengajuan_saya',
            'menunggu_review' => [
                'jumlah' => (int) $antrean->menunggu_review,
                'nominal' => (int) $antrean->nominal_review,
            ],
            'menunggu_dibayar' => [
                'jumlah' => (int) $antrean->menunggu_dibayar,
                'sisa' => (int) $antrean->sisa_dibayar,
            ],
        ];
    }

    /**
     * Antrean pengajuan dana (FundRequestController::index). Cakupan semua pengajuan hanya untuk
     * pemegang izin menyetujui, selain itu milik sendiri.
     *
     * @return array<string, mixed>
     */
    private function pengajuanDana(User $user): array
    {
        $semua = $user->can('approve fund requests');

        $antrean = FundRequest::query()
            ->when(! $semua, fn (Builder $q) => $q->where('user_id', $user->getKey()))
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS menunggu_review")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0) AS nominal_review")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS menunggu_pencairan")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) AS nominal_pencairan")
            ->toBase()
            ->first();

        return [
            'cakupan' => $semua ? 'semua_pengajuan' : 'pengajuan_saya',
            'menunggu_review' => [
                'jumlah' => (int) $antrean->menunggu_review,
                'nominal' => (int) $antrean->nominal_review,
            ],
            'menunggu_pencairan' => [
                'jumlah' => (int) $antrean->menunggu_pencairan,
                'nominal' => (int) $antrean->nominal_pencairan,
            ],
        ];
    }

    private function pembayaranInvoice(string $dari, string $sampai): int
    {
        return (int) Payment::query()->whereBetween('payment_date', [$dari, $sampai])->sum('amount');
    }

    /**
     * Jumlah transaksi per label kategori untuk satu arah + tipe kategori; label kembar digabung.
     *
     * @return Collection<array-key, int>
     */
    private function transaksiPerKategori(string $arah, string $tipeKategori, string $dari, string $sampai): Collection
    {
        return BankTransaction::query()
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->where('bank_transactions.transaction_type', $arah)
            ->where('transaction_categories.type', $tipeKategori)
            ->whereBetween('bank_transactions.transaction_date', [$dari, $sampai])
            ->groupBy('transaction_categories.id', 'transaction_categories.label')
            ->selectRaw('transaction_categories.label AS label, SUM(bank_transactions.amount) AS jumlah')
            ->toBase()
            ->get()
            ->reduce(
                fn (Collection $peta, object $baris): Collection => $peta->put($baris->label, (int) $peta->get($baris->label, 0) + (int) $baris->jumlah),
                collect(),
            );
    }

    /**
     * Rincian terbesar + sisanya digabung "Lainnya" (pola donat kategori di Ringkasan), sebagai
     * objek agar rincian kosong ter-encode `{}`.
     *
     * @param  Collection<array-key, int>  $jumlahPerLabel
     */
    private function teratas(Collection $jumlahPerLabel): object
    {
        $urut = $jumlahPerLabel->sortDesc();
        $teratas = $urut->take(self::RINCIAN_TERATAS);
        $lainnya = (int) $urut->slice(self::RINCIAN_TERATAS)->sum();

        if ($lainnya > 0) {
            $teratas->put('Lainnya', (int) $teratas->get('Lainnya', 0) + $lainnya);
        }

        return (object) $teratas->all();
    }

    private function tanggal(?string $nilai): ?string
    {
        return $nilai === null ? null : Carbon::parse($nilai)->toDateString();
    }

    /**
     * @return array{0: string, 1: string}
     *
     * @throws ValidationException
     */
    private function periode(Request $request): array
    {
        $data = $request->validate([
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d'],
        ], [
            'dari' => 'dari harus tanggal berformat YYYY-MM-DD, mis. 2026-11-01.',
            'sampai' => 'sampai harus tanggal berformat YYYY-MM-DD, mis. 2026-11-30.',
        ]);

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
