<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Models\Loan;
use App\Models\LoanPayment;
use App\Services\JadwalAngsuranService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;

/**
 * Daftar pinjaman (utang perusahaan) untuk Claude.
 *
 * Tanpa pembatasan per baris: LoanController::index() menampilkan seluruh pinjaman kepada
 * setiap pemegang view loans. Angka mengikuti controller itu: sisa pokok = pokok − Σ pokok
 * dibayar, dan ringkasan sisa pokok hanya mencakup pinjaman aktif.
 *
 * Jadwal angsuran memakai JadwalAngsuranService::untukPinjaman(), sumber tunggal yang juga
 * dipakai panel jadwal di aplikasi (LoanController::schedule()). Query daftar memuat
 * withSum('payments', ...) sehingga service memakai jumlah itu, bukan dua query per baris.
 */
class DaftarPinjaman extends AlatKeuangan
{
    private const PER_HALAMAN = 50;

    /** Label sama dengan halaman Pinjaman (LoanStatusPill). */
    private const STATUS = [
        'active' => 'Aktif',
        'paid_off' => 'Lunas',
    ];

    protected string $name = 'daftar-pinjaman';

    protected string $description = 'Daftar pinjaman yang DITERIMA perusahaan (utang ke bank/pihak lain): pemberi pinjaman, pokok, bunga, sudah dibayar, sisa pokok/bunga, dan ringkasan jadwal angsuran untuk pinjaman aktif (termin berikutnya, termin terlambat, tunggakan). Jadwal adalah rencana dari pokok, bunga, tenor, dan tanggal mulai; pembayaran dialokasikan ke termin dari yang paling awal karena pembayaran tidak dicatat per termin. Ringkasan dihitung atas SEMUA data yang cocok dengan filter; sisa pokok hanya dari pinjaman aktif. Saring dengan status atau kata kunci; 50 baris per halaman.';

    protected function izin(): string
    {
        return 'view loans';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->enum(array_keys(self::STATUS))
                ->description('Saring status: active (masih berjalan) atau paid_off (lunas).'),
            'kata_kunci' => $schema->string()
                ->description('Cari di nomor pinjaman atau nama pemberi pinjaman, mis. "mandiri".'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1 (50 baris per halaman).'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $daftarStatus = implode(', ', array_keys(self::STATUS));

        $argumen = $request->validate([
            'status' => ['nullable', 'string', Rule::in(array_keys(self::STATUS))],
            'kata_kunci' => ['nullable', 'string', 'max:100'],
            'halaman' => ['nullable', 'integer', 'min:1'],
        ], [
            'status.string' => "Argumen status harus salah satu dari: {$daftarStatus}.",
            'status.in' => "Argumen status harus salah satu dari: {$daftarStatus}.",
            'kata_kunci.string' => 'Argumen kata_kunci harus berupa teks.',
            'kata_kunci.max' => 'Argumen kata_kunci paling panjang 100 karakter.',
            'halaman.integer' => 'Argumen halaman harus bilangan bulat mulai 1.',
            'halaman.min' => 'Argumen halaman harus bilangan bulat mulai 1.',
        ]);

        $isi = fn (string $kunci): ?string => filled($argumen[$kunci] ?? null) ? trim((string) $argumen[$kunci]) : null;
        [$status, $kataKunci] = [$isi('status'), $isi('kata_kunci')];

        $saring = fn (Builder $q): Builder => $q
            ->when($status, fn (Builder $q) => $q->where('loans.status', $status))
            ->when($kataKunci, fn (Builder $q) => $q->whereAny(['loans.loan_number', 'loans.lender_name'], 'like', "%{$kataKunci}%"));

        $perStatus = $saring(Loan::query())->toBase()
            ->selectRaw('status, COUNT(*) as jumlah, COALESCE(SUM(principal_amount), 0) as pokok, MIN(maturity_date) as jatuh_tempo_terdekat')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $terbayarAktif = LoanPayment::query()
            ->whereHas('loan', fn (Builder $q) => $saring($q)->where('loans.status', 'active'))
            ->toBase()
            ->selectRaw('COALESCE(SUM(principal_paid), 0) as pokok, COALESCE(SUM(interest_paid), 0) as bunga')
            ->first();

        $hasil = $saring(Loan::query())
            ->withSum('payments', 'principal_paid')
            ->withSum('payments', 'interest_paid')
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->paginate(self::PER_HALAMAN, ['*'], 'halaman', max(1, (int) ($argumen['halaman'] ?? 1)));

        $layanan = app(JadwalAngsuranService::class);
        $aktif = $perStatus->get('active');
        $pokokAktif = (int) ($aktif->pokok ?? 0);

        return [
            'ringkasan' => [
                'jumlah' => (int) $perStatus->sum('jumlah'),
                'total_pokok' => (int) $perStatus->sum('pokok'),
                'per_status' => collect(self::STATUS)->map(fn (string $label, string $s) => [
                    'label' => $label,
                    'jumlah' => (int) ($perStatus->get($s)->jumlah ?? 0),
                    'pokok' => (int) ($perStatus->get($s)->pokok ?? 0),
                ])->all(),
                'sisa_pokok_aktif' => max(0, $pokokAktif - (int) $terbayarAktif->pokok),
                'pokok_dibayar_aktif' => (int) $terbayarAktif->pokok,
                'bunga_dibayar_aktif' => (int) $terbayarAktif->bunga,
                'jatuh_tempo_akhir_terdekat' => $aktif?->jatuh_tempo_terdekat ? Carbon::parse($aktif->jatuh_tempo_terdekat)->toDateString() : null,
            ],
            'halaman' => $hasil->currentPage(),
            'per_halaman' => self::PER_HALAMAN,
            'total_halaman' => $hasil->lastPage(),
            'pinjaman' => $hasil->getCollection()->map(function (Loan $l) use ($layanan) {
                $totalBunga = $layanan->totalBungaPinjaman($l);
                $pokokDibayar = (int) ($l->payments_sum_principal_paid ?? 0);
                $bungaDibayar = (int) ($l->payments_sum_interest_paid ?? 0);

                return [
                    'id' => $l->id,
                    'nomor' => $l->loan_number,
                    'pemberi_pinjaman' => $l->lender_name,
                    'pokok' => (int) $l->principal_amount,
                    'bunga_tipe' => $l->interest_type,
                    'bunga_persen_per_tahun' => $l->interest_type === 'percentage' ? (float) $l->interest_rate : null,
                    'total_bunga' => $totalBunga,
                    'tenor_bulan' => (int) $l->term_months,
                    'mulai' => $l->start_date?->toDateString(),
                    'jatuh_tempo' => $l->maturity_date?->toDateString(),
                    'status' => $l->status,
                    'status_label' => self::STATUS[$l->status] ?? $l->status,
                    'pokok_dibayar' => $pokokDibayar,
                    'bunga_dibayar' => $bungaDibayar,
                    'sisa_pokok' => (int) $l->principal_amount - $pokokDibayar,
                    'sisa_bunga' => $totalBunga - $bungaDibayar,
                    // withSum di atas membuat untukPinjaman() memakai jumlah yang sudah dimuat (tanpa query per baris).
                    'jadwal' => $l->status !== 'active' ? null : $this->ringkasJadwal($layanan->untukPinjaman($l)),
                    'tujuan' => $l->purpose === null ? null : Str::limit($l->purpose, 150),
                ];
            })->values()->all(),
        ];
    }

    /**
     * Termin berikutnya = termin paling awal yang belum lunas (satu-satunya klaim "termin
     * mana" yang juga dibuat panel jadwal); tunggakan = sisa tagihan termin yang terlambat.
     *
     * @param  list<array{termin:int, jatuh_tempo:string, pokok:int, bunga:int, angsuran:int, pokok_terbayar:int, bunga_terbayar:int, status:string, terlambat:bool}>  $jadwal
     * @return array{jumlah_termin:int, termin_lunas:int, termin_berikutnya:array{ke:int, jatuh_tempo:string, angsuran:int, sisa:int}|null, termin_terlambat:int, tunggakan:int}|null
     */
    private function ringkasJadwal(array $jadwal): ?array
    {
        if ($jadwal === []) {
            return null;
        }

        $termin = collect($jadwal);
        $sisa = fn (array $t): int => $t['angsuran'] - $t['pokok_terbayar'] - $t['bunga_terbayar'];
        $berikutnya = $termin->first(fn (array $t) => $t['status'] !== 'lunas');
        $terlambat = $termin->where('terlambat', true);

        return [
            'jumlah_termin' => $termin->count(),
            'termin_lunas' => $termin->where('status', 'lunas')->count(),
            'termin_berikutnya' => $berikutnya === null ? null : [
                'ke' => $berikutnya['termin'],
                'jatuh_tempo' => $berikutnya['jatuh_tempo'],
                'angsuran' => $berikutnya['angsuran'],
                'sisa' => $sisa($berikutnya),
            ],
            'termin_terlambat' => $terlambat->count(),
            'tunggakan' => $terlambat->sum($sisa),
        ];
    }
}
