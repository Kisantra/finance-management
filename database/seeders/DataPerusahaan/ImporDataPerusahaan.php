<?php

namespace Database\Seeders\DataPerusahaan;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Services\CategoryTemplateService;
use Illuminate\Support\Facades\DB;

/**
 * Menulis satu DataMentah ke database perusahaan yang sedang aktif (panggil di dalam $company->run()).
 *
 * Prinsip: setiap baris sheet masuk TEPAT SEKALI dengan nominal, tanggal, dan arah yang sama, sehingga
 * total aplikasi cocok dengan sheet.
 * - Baris Arus Kas → transaksi Kas & Bank, atau pembayaran invoice bila ia penerimaan dari pelanggan
 *   yang cocok dengan invoice (PencocokanPenerimaan). Penanda seksi PC/PNBP (AOE) → akun kas sendiri.
 * - Baris Invoice Jual → invoice + item, nomor asli. Invoice berstatus "Lunas" di sheet yang tidak
 *   (seluruhnya) terbayar lewat Arus Kas dilunasi di akun AKUN_LUNAS bertanggal invoice, agar
 *   rekening operasional tetap sama persis dengan sheet Arus Kas.
 * - Semua transaksi & pembayaran dicatat atas nama pengguna pengimpor ($pencatat).
 */
final class ImporDataPerusahaan
{
    public const AKUN_OPERASIONAL = 'Rekening Operasional';

    public const AKUN_LUNAS = 'Penerimaan Invoice (Status Lunas)';

    /** Penanda seksi di kolom A sheet Arus Kas → nama akun kas tersendiri. */
    public const AKUN_SEKSI = ['PC' => 'Kas Kecil', 'PNBP' => 'Dana PNBP'];

    private KategoriImpor $kategori;

    /** @var array<string, BankAccount> */
    private array $akun = [];

    /** @var list<string> */
    private array $peringatan = [];

    /**
     * @param  array{slug: string, name: string, abbreviation: string, holding?: bool}  $perusahaan
     * @param  list<string>  $grup  nama perusahaan lain di grup
     * @param  int  $pencatat  id pengguna pusat "Impor Data Mentah"
     * @param  int|null  $penanggungJawabKas  id pengguna pusat penanggung jawab akun kas
     * @param  list<string>  $direksi  nama direksi grup, untuk mengenali biaya direksi
     */
    public function __construct(
        private DataMentah $data,
        private array $perusahaan,
        private array $grup,
        private int $pencatat,
        private ?int $penanggungJawabKas,
        private array $direksi = [],
    ) {}

    /**
     * Keadaan data perusahaan sebelum impor: 'kosong', 'impor' (hanya berisi impor sebelumnya — aman
     * dihapus lalu diimpor ulang), atau 'manual' (ada data lain; impor tidak boleh menimpanya).
     *
     * @param  array{invoices?: int, clients?: int}|null  $jejak  jumlah hasil impor sebelumnya
     */
    public static function keadaan(int $pencatat, ?array $jejak): string
    {
        $bukanImpor = fn (string $model): bool => $model::query()
            ->where(fn ($query) => $query->whereNull('created_by')->orWhere('created_by', '!=', $pencatat))
            ->exists();

        if ($bukanImpor(BankTransaction::class) || $bukanImpor(Payment::class)) {
            return 'manual';
        }

        $adaImpor = BankTransaction::query()->exists() || Payment::query()->exists();

        if (! $adaImpor) {
            return Invoice::query()->exists() || Client::query()->exists() ? 'manual' : 'kosong';
        }

        return $jejak !== null
            && Invoice::query()->count() === ($jejak['invoices'] ?? -1)
            && Client::query()->count() === ($jejak['clients'] ?? -1)
            ? 'impor'
            : 'manual';
    }

    /** Menghapus hasil impor sebelumnya (hanya setelah keadaan() = 'impor'). */
    public static function hapusImporLama(): void
    {
        DB::transaction(function (): void {
            Payment::query()->delete();
            InvoiceItem::query()->delete();
            Invoice::query()->delete();
            BankTransaction::query()->delete();
            Client::query()->delete();
            BankAccount::query()
                ->whereIn('account_name', [self::AKUN_OPERASIONAL, self::AKUN_LUNAS, ...array_values(self::AKUN_SEKSI)])
                ->delete();
        });
    }

    /**
     * @return array{
     *     arus_kas: array{baris: int, masuk_sheet: int, keluar_sheet: int, masuk_impor: int, keluar_impor: int, total_baris_sheet: array{masuk: float|null, keluar: float|null}},
     *     invoice: array{jumlah: int, total_sheet: int, total_impor: int, status: array<string, int>, dibayar_arus_kas: int, dibayar_status_lunas: int},
     *     klien: int,
     *     kategori: array<string, array{jumlah: int, nominal: int}>,
     *     peringatan: list<string>,
     * }
     */
    public function jalankan(): array
    {
        return DB::transaction(function (): array {
            $this->siapkanProfil();
            // Perusahaan lama mungkin belum punya template kategori (perusahaan baru sudah, lewat provisioning).
            app(CategoryTemplateService::class)->apply();
            $this->kategori = new KategoriImpor;
            $this->kategori->pastikan();

            $klasifikasi = new KlasifikasiArusKas(
                $this->data->namaPerusahaan,
                $this->perusahaan['abbreviation'],
                $this->data->arusKas,
                $this->perusahaan['holding'] ?? false,
                $this->grup,
                array_map(fn (InvoiceMentah $invoice): string => $invoice->pelanggan, $this->data->invoices),
                $this->direksi,
            );

            $hasilKlasifikasi = [];
            $penerimaan = [];

            foreach ($this->data->arusKas as $indeks => $baris) {
                $hasilKlasifikasi[$indeks] = self::arahJanggal($baris)
                    ? new Klasifikasi(KategoriImpor::PERLU_DITINJAU['type'], KategoriImpor::PERLU_DITINJAU['children'][0])
                    : $klasifikasi->klasifikasi($baris);

                if ($hasilKlasifikasi[$indeks]->penerimaanPelanggan) {
                    $penerimaan[$indeks] = $baris;
                }
            }

            $pencocokan = new PencocokanPenerimaan($this->data->invoices);
            $cocok = $pencocokan->cocokkan($penerimaan);

            $klien = $this->buatKlien();
            $invoiceIds = $this->buatInvoice($klien);
            $dariArusKas = $this->buatPembayaranArusKas($cocok['alokasi'], $invoiceIds);
            $dariStatusLunas = $this->lunasiSesuaiStatus($pencocokan->sisaTagihan(), $invoiceIds);
            $statusInvoice = $this->perbaruiStatusInvoice($invoiceIds);
            $perKategori = $this->buatTransaksi($hasilKlasifikasi, $cocok);

            $this->periksaArahJanggal();

            $masukImpor = (int) BankTransaction::query()->whereIn('bank_account_id', $this->akunArusKas())->where('transaction_type', 'credit')->sum('amount')
                + (int) Payment::query()->whereIn('bank_account_id', $this->akunArusKas())->sum('amount');
            $keluarImpor = (int) BankTransaction::query()->whereIn('bank_account_id', $this->akunArusKas())->where('transaction_type', 'debit')->sum('amount');

            return [
                'arus_kas' => [
                    'baris' => count($this->data->arusKas),
                    'masuk_sheet' => array_sum(array_map(fn (BarisArusKas $baris): int => $baris->masuk, $this->data->arusKas)),
                    'keluar_sheet' => array_sum(array_map(fn (BarisArusKas $baris): int => $baris->keluar, $this->data->arusKas)),
                    'masuk_impor' => $masukImpor,
                    'keluar_impor' => $keluarImpor,
                    'total_baris_sheet' => ['masuk' => $this->data->totalSheet['masuk'], 'keluar' => $this->data->totalSheet['keluar']],
                ],
                'invoice' => [
                    'jumlah' => count($invoiceIds),
                    'total_sheet' => array_sum(array_map(fn (InvoiceMentah $invoice): int => $invoice->total(), $this->data->invoices)),
                    'total_impor' => (int) Invoice::query()->sum('total_amount'),
                    'status' => $statusInvoice,
                    'dibayar_arus_kas' => $dariArusKas,
                    'dibayar_status_lunas' => $dariStatusLunas,
                ],
                'klien' => count(array_unique($klien)),
                'kategori' => $perKategori,
                'peringatan' => $this->peringatan,
            ];
        });
    }

    /**
     * Mengisi isian profil yang masih kosong ('-' dari provisioning) dengan data sheet Identitas.
     * Isian yang sudah diisi tidak pernah ditimpa. Nomor invoice lama dari sheet tidak mengikuti
     * pola penomoran aplikasi; ditandai sudah ditinjau karena tahun bukunya sudah lewat.
     */
    private function siapkanProfil(): void
    {
        $profil = CompanyProfile::current();

        if ($profil === null) {
            return;
        }

        $kosong = fn (?string $nilai): bool => blank($nilai) || trim($nilai) === '-';
        $identitas = $this->data->identitas;

        foreach (['npwp' => 'npwp', 'address' => 'alamat', 'phone' => 'telepon', 'email' => 'email'] as $kolom => $kunci) {
            if ($kosong($profil->{$kolom}) && filled($identitas[$kunci])) {
                $profil->{$kolom} = $identitas[$kunci];
            }
        }

        $profil->invoice_legacy_reviewed_at ??= now();
        $profil->save();
    }

    /** Akun penampung baris Arus Kas: rekening operasional, atau akun kas untuk seksi PC/PNBP. */
    private function akunUntuk(?string $seksi): BankAccount
    {
        $nama = self::AKUN_SEKSI[strtoupper((string) $seksi)] ?? self::AKUN_OPERASIONAL;

        return $this->akun[$nama] ??= $nama === self::AKUN_OPERASIONAL
            ? $this->rekeningOperasional()
            : BankAccount::firstOrCreate(
                ['account_name' => $nama, 'type' => BankAccount::TYPE_CASH],
                ['initial_balance' => 0, 'custodian_id' => $this->penanggungJawabKas],
            );
    }

    /**
     * Rekening utama yang menampung baris Arus Kas tanpa seksi. Nomor & bank dari tabel "Daftar
     * Rekening Aktif" di sheet, atau rekening pertama di Profil perusahaan; bila keduanya kosong,
     * bank ditebak dari kolom Pihak ("BANK MANDIRI") dan nomornya "-" (lengkapi di aplikasi).
     */
    private function rekeningOperasional(): BankAccount
    {
        $rekening = $this->data->rekening[0] ?? null;
        $profil = CompanyProfile::current()?->bank_accounts[0] ?? null;

        $bank = $rekening['bank'] ?? $profil['bank'] ?? null;
        $nomor = $rekening['nomor'] ?? $profil['account_number'] ?? null;

        if ($bank === null) {
            $semuaPihak = strtoupper(implode(' ', array_map(fn (BarisArusKas $baris): string => $baris->pihak.' '.$baris->deskripsi, $this->data->arusKas)));
            $bank = str_contains($semuaPihak, 'MANDIRI') ? 'Mandiri' : 'Bank';
        }

        if ($nomor === null) {
            $this->peringatan[] = 'Nomor rekening operasional tidak ada di sheet — isi "-" diganti di menu Kas & Bank.';
        }

        return BankAccount::firstOrCreate(
            ['account_name' => self::AKUN_OPERASIONAL, 'type' => BankAccount::TYPE_BANK],
            [
                'bank_name' => self::namaBank($bank),
                'account_number' => $nomor ?? '-',
                'initial_balance' => 0,
            ],
        );
    }

    private static function namaBank(string $bank): string
    {
        $bank = trim($bank);

        return match (true) {
            (bool) preg_match('/MANDIRI/i', $bank) => 'Bank Mandiri',
            (bool) preg_match('/^(BCA|BRI|BNI|BSI|BTN)$/i', $bank) => strtoupper($bank),
            default => ucwords(strtolower($bank)),
        };
    }

    /** @return list<int> id akun yang menampung baris Arus Kas */
    private function akunArusKas(): array
    {
        return array_values(array_map(
            fn (BankAccount $akun): int => $akun->id,
            array_filter($this->akun, fn (BankAccount $akun, string $nama): bool => $nama !== self::AKUN_LUNAS, ARRAY_FILTER_USE_BOTH),
        ));
    }

    /**
     * Satu klien per pelanggan; varian penulisan nama ("PT. X" / "X", salah ketik 1–2 huruf)
     * digabung. Alias = kode klien yang dipakai di nomor invoice ("001/AOE-CP/..." → CP), hanya
     * bila kode itu singkatan nama klien.
     *
     * @return array<int, int> indeks invoice → id klien
     */
    private function buatKlien(): array
    {
        /** @var list<array{kunci: string, nama: array<string, int>, npwp: string|null, kode: array<string, int>, invoice: list<int>}> $kelompok */
        $kelompok = [];

        foreach ($this->data->invoices as $indeks => $invoice) {
            $kunci = NamaPihak::kunci($invoice->pelanggan);
            $tujuan = null;

            foreach ($kelompok as $posisi => $calon) {
                if (NamaPihak::sama($calon['kunci'], $kunci)) {
                    $tujuan = $posisi;
                    break;
                }
            }

            if ($tujuan === null) {
                $kelompok[] = ['kunci' => $kunci, 'nama' => [], 'npwp' => null, 'kode' => [], 'invoice' => []];
                $tujuan = array_key_last($kelompok);
            }

            $nama = NamaPihak::rapikan($invoice->pelanggan);
            $kelompok[$tujuan]['nama'][$nama] = ($kelompok[$tujuan]['nama'][$nama] ?? 0) + 1;
            $kelompok[$tujuan]['npwp'] ??= $invoice->npwp;
            $kelompok[$tujuan]['invoice'][] = $indeks;

            if ($invoice->nomor !== null && preg_match('/^\d+[A-Z]?\/[A-Z]+-([A-Z0-9]{2,10})\//', strtoupper($invoice->nomor), $kode)) {
                $kelompok[$tujuan]['kode'][$kode[1]] = ($kelompok[$tujuan]['kode'][$kode[1]] ?? 0) + 1;
            }
        }

        $peta = [];

        foreach ($kelompok as $calon) {
            // Nama tampilan: varian berbentuk badan (PT./CV.) yang paling sering, lalu yang paling sering.
            uksort($calon['nama'], fn (string $a, string $b): int => [NamaPihak::berbentukBadan($b), $calon['nama'][$b]] <=> [NamaPihak::berbentukBadan($a), $calon['nama'][$a]]);
            // Hanya kode yang memang singkatan nama klien; kode lokasi/pelabuhan bukan alias.
            $kode = array_filter($calon['kode'], fn (string $kode): bool => NamaPihak::singkatanDari($kode, array_key_first($calon['nama'])), ARRAY_FILTER_USE_KEY);
            arsort($kode);

            $klien = Client::create([
                'name' => array_key_first($calon['nama']),
                'alias' => array_key_first($kode),
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'NPWP' => $calon['npwp'],
            ]);

            foreach ($calon['invoice'] as $indeks) {
                $peta[$indeks] = $klien->id;
            }
        }

        return $peta;
    }

    /**
     * @param  array<int, int>  $klien  indeks invoice → id klien
     * @return array<int, int> indeks invoice → id invoice
     */
    private function buatInvoice(array $klien): array
    {
        $jatuhTempo = (int) (CompanyProfile::current()?->default_due_days ?: 14);
        $nomorTerpakai = [];
        $ids = [];
        $item = [];

        foreach ($this->data->invoices as $indeks => $mentah) {
            $nomor = $mentah->nomor;

            // Nomor ganda dengan pelanggan berbeda (salah ketik di sheet): nomor unik di aplikasi.
            if ($nomor !== null && isset($nomorTerpakai[strtoupper($nomor)])) {
                $ke = 2;
                while (isset($nomorTerpakai[strtoupper("{$mentah->nomor} ({$ke})")])) {
                    $ke++;
                }
                $nomor = "{$mentah->nomor} ({$ke})";
                $this->peringatan[] = "Nomor invoice {$mentah->nomor} dipakai dua pelanggan berbeda — yang kedua disimpan sebagai \"{$nomor}\".";
            }

            if ($nomor !== null) {
                $nomorTerpakai[strtoupper($nomor)] = true;
            }

            $dppKenaPpn = array_sum(array_map(fn (array $baris): int => $baris['ppn'] > 0 ? $baris['dpp'] : 0, $mentah->item));

            $invoice = Invoice::create([
                'invoice_number' => $nomor,
                'billed_to_id' => $klien[$indeks],
                'subject' => mb_substr($mentah->item[0]['deskripsi'], 0, 255),
                'subtotal' => $mentah->dpp(),
                'discount_type' => 'fixed',
                'discount_value' => 0,
                'discount_amount' => 0,
                'ppn_rate' => $dppKenaPpn > 0 ? round($mentah->ppn() / $dppKenaPpn * 100, 2) : null,
                'ppn_amount' => max(0, $mentah->ppn()),
                'total_amount' => $mentah->total(),
                'issue_date' => $mentah->tanggal->toDateString(),
                'due_date' => $mentah->tanggal->addDays($jatuhTempo)->toDateString(),
                'status' => $nomor !== null ? 'sent' : 'draft',
                'faktur' => $mentah->faktur === [] ? null : mb_substr(implode(', ', $mentah->faktur), 0, 255),
            ]);

            $ids[$indeks] = $invoice->id;

            foreach ($mentah->item as $baris) {
                $item[] = [
                    'invoice_id' => $invoice->id,
                    'client_id' => $klien[$indeks],
                    'service_name' => mb_substr($baris['deskripsi'], 0, 255),
                    'description' => $baris['catatan'],
                    'quantity' => 1,
                    'unit' => 'paket',
                    'unit_price' => $baris['dpp'],
                    'amount' => $baris['dpp'],
                    'cogs_amount' => 0,
                    'is_tax_deposit' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        foreach (array_chunk($item, 500) as $potongan) {
            InvoiceItem::query()->insert($potongan);
        }

        return $ids;
    }

    /**
     * @param  array<int, list<array{invoice: int, jumlah: int}>>  $alokasi  indeks baris arus kas → bagian per invoice
     * @param  array<int, int>  $invoiceIds
     */
    private function buatPembayaranArusKas(array $alokasi, array $invoiceIds): int
    {
        $total = 0;

        foreach ($alokasi as $indeks => $bagian) {
            $baris = $this->data->arusKas[$indeks];
            $akun = $this->akunUntuk($baris->seksi);

            foreach ($bagian as ['invoice' => $invoice, 'jumlah' => $jumlah]) {
                $this->bayar($invoiceIds[$invoice], $akun, $jumlah, $baris->tanggal->toDateString(), $baris->referensi);
                $total += $jumlah;
            }
        }

        return $total;
    }

    /**
     * Invoice berstatus "Lunas" di sheet yang tagihannya belum habis oleh penerimaan Arus Kas
     * dilunasi di akun AKUN_LUNAS pada tanggal invoice.
     *
     * @param  array<int, int>  $sisaTagihan
     * @param  array<int, int>  $invoiceIds
     */
    private function lunasiSesuaiStatus(array $sisaTagihan, array $invoiceIds): int
    {
        $total = 0;

        foreach ($this->data->invoices as $indeks => $mentah) {
            $sisa = $sisaTagihan[$indeks] ?? 0;

            if (! $mentah->lunas || $sisa <= 0) {
                continue;
            }

            $this->akun[self::AKUN_LUNAS] ??= BankAccount::firstOrCreate(
                ['account_name' => self::AKUN_LUNAS, 'type' => BankAccount::TYPE_BANK],
                ['bank_name' => 'Belum tercatat di Arus Kas', 'account_number' => '-', 'initial_balance' => 0],
            );

            $this->bayar($invoiceIds[$indeks], $this->akun[self::AKUN_LUNAS], $sisa, $mentah->tanggal->toDateString(), 'Status Lunas (sheet Invoice Jual)');
            $total += $sisa;
        }

        return $total;
    }

    private function bayar(int $invoiceId, BankAccount $akun, int $jumlah, string $tanggal, ?string $referensi): void
    {
        $pembayaran = new Payment([
            'invoice_id' => $invoiceId,
            'bank_account_id' => $akun->id,
            'amount' => $jumlah,
            'payment_date' => $tanggal,
            'payment_method' => $akun->isCash() ? 'cash' : 'bank_transfer',
            'reference_number' => $referensi,
        ]);
        $pembayaran->created_by = $this->pencatat;
        $pembayaran->save();
    }

    /**
     * Status mengikuti pembayaran (sama dengan Invoice::updateStatus), dihitung sekali per invoice.
     *
     * @param  array<int, int>  $invoiceIds
     * @return array<string, int> status → jumlah invoice
     */
    private function perbaruiStatusInvoice(array $invoiceIds): array
    {
        $dibayar = Payment::query()->selectRaw('invoice_id, SUM(amount) as total')->groupBy('invoice_id')->pluck('total', 'invoice_id');
        $hitung = [];

        foreach (Invoice::query()->whereIn('id', $invoiceIds)->get(['id', 'invoice_number', 'total_amount', 'status']) as $invoice) {
            $bayar = (int) ($dibayar[$invoice->id] ?? 0);
            $status = match (true) {
                $bayar === 0 => $invoice->invoice_number ? 'sent' : 'draft',
                $bayar >= $invoice->total_amount => 'paid',
                default => 'partially_paid',
            };

            if ($status !== $invoice->status) {
                $invoice->update(['status' => $status]);
            }

            $hitung[$status] = ($hitung[$status] ?? 0) + 1;
        }

        return $hitung;
    }

    /**
     * Baris Arus Kas yang tidak (seluruhnya) menjadi pembayaran invoice → transaksi Kas & Bank.
     *
     * @param  array<int, Klasifikasi>  $klasifikasi
     * @param  array{sisa: array<int, int>, jenisSisa: array<int, string>}  $cocok
     * @return array<string, array{jumlah: int, nominal: int}> per kategori
     */
    private function buatTransaksi(array $klasifikasi, array $cocok): array
    {
        $baris = [];
        $perKategori = [];

        foreach ($this->data->arusKas as $indeks => $arusKas) {
            $hasil = $klasifikasi[$indeks];
            $nominal = $arusKas->nominal();

            if ($hasil->penerimaanPelanggan) {
                $nominal = $cocok['sisa'][$indeks] ?? $nominal;

                if ($nominal === 0) {
                    continue;
                }

                $hasil = match ($cocok['jenisSisa'][$indeks] ?? PencocokanPenerimaan::SISA_PENDAPATAN) {
                    PencocokanPenerimaan::SISA_TITIPAN => new Klasifikasi('financing', 'Dana Titipan & Salah Transfer'),
                    PencocokanPenerimaan::SISA_BELUM_TERIDENTIFIKASI => new Klasifikasi('financing', 'Penerimaan Belum Teridentifikasi'),
                    default => $hasil,
                };
            }

            $kategoriId = $this->kategori->id($hasil->type, $hasil->kategori);

            $baris[] = [
                'bank_account_id' => $this->akunUntuk($arusKas->seksi)->id,
                'amount' => $nominal,
                'transaction_date' => $arusKas->tanggal->toDateString(),
                'transaction_type' => $arusKas->isMasuk() ? 'credit' : 'debit',
                'description' => $arusKas->pihak !== '' ? "{$arusKas->deskripsi} — {$arusKas->pihak}" : $arusKas->deskripsi,
                'reference_number' => $arusKas->referensi !== null && ! str_starts_with(strtoupper($arusKas->referensi), 'TRF') ? $arusKas->referensi : null,
                'category_id' => $kategoriId,
                'created_by' => $this->pencatat,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $label = ($arusKas->isMasuk() ? 'Masuk' : 'Keluar').' · '.$hasil->kategori;
            $perKategori[$label]['jumlah'] = ($perKategori[$label]['jumlah'] ?? 0) + 1;
            $perKategori[$label]['nominal'] = ($perKategori[$label]['nominal'] ?? 0) + $nominal;
        }

        foreach (array_chunk($baris, 500) as $potongan) {
            BankTransaction::query()->insert($potongan);
        }

        ksort($perKategori);

        return $perKategori;
    }

    /**
     * Baris yang isinya bertentangan dengan kolomnya ("TERIMA PEMBAYARAN ..." di kolom Pengeluaran).
     * Diimpor apa adanya agar total tetap sama dengan sheet, berkategori "Perlu Ditinjau".
     */
    private static function arahJanggal(BarisArusKas $baris): bool
    {
        return ! $baris->isMasuk() && preg_match('/^TERIMA (PEMBAYARAN|PELUNASAN)/i', $baris->deskripsi) === 1;
    }

    private function periksaArahJanggal(): void
    {
        foreach ($this->data->arusKas as $baris) {
            if (self::arahJanggal($baris)) {
                $this->peringatan[] = sprintf(
                    'Arus Kas baris %d "%s" (Rp %s) berdeskripsi penerimaan tetapi tercatat di kolom Pengeluaran — diimpor sebagai pengeluaran sesuai sheet dengan kategori "Perlu Ditinjau › Arah Transaksi Janggal"; periksa ke sumbernya.',
                    $baris->baris,
                    $baris->deskripsi,
                    number_format($baris->keluar, 0, ',', '.'),
                );
            }
        }
    }
}
