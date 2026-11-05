<?php

namespace App\Mcp\Tools;

use App\Models\Client;
use App\Models\Company;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\User;
use App\Services\JadwalAngsuranService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;

/**
 * Daftar piutang (pinjaman yang diberikan perusahaan) untuk Claude.
 *
 * Tanpa pembatasan per baris: ReceivableController::index() menampilkan seluruh piutang
 * kepada setiap pemegang view receivables (tabelnya juga tidak menyimpan pembuat). Angka
 * mengikuti controller itu: sisa pokok dan lewat tempo hanya dari piutang aktif, lewat tempo
 * = jatuh tempo akhir sudah lewat DAN pokok belum tertutup.
 *
 * Debitur polimorfik: User ada di database pusat, Client di database perusahaan. Nama
 * dicari di masing-masing database lalu disaring dengan whereIn, karena whereHasMorph akan
 * menyisipkan tabel users ke query database perusahaan.
 *
 * Jadwal angsuran memakai JadwalAngsuranService::untukPiutang(); query daftar memuat
 * withSum('payments', ...) sehingga service memakai jumlah itu, bukan dua query per baris.
 */
class DaftarPiutang extends AlatKeuangan
{
    private const PER_HALAMAN = 50;

    /** Label sama dengan halaman Piutang (STATUS_LABEL di ptg.tsx). */
    private const STATUS = [
        'draft' => 'Draft',
        'pending_approval' => 'Menunggu',
        'active' => 'Aktif',
        'paid_off' => 'Lunas',
        'rejected' => 'Ditolak',
    ];

    private const JENIS = ['employee_loan', 'company_loan'];

    /** @var array<class-string, string> */
    private const TIPE_DEBITUR = [
        User::class => 'karyawan',
        Client::class => 'klien',
    ];

    protected string $name = 'daftar-piutang';

    protected string $description = 'Daftar piutang: pinjaman yang DIBERIKAN perusahaan kepada karyawan (debitur tipe karyawan, jenis employee_loan) atau klien (tipe klien, jenis company_loan). Per baris: debitur, pokok, bunga (persen flat atas seluruh pokok), cicilan, sudah dibayar, sisa, status, dan ringkasan jadwal untuk piutang aktif (termin berikutnya, termin terlambat, tunggakan; pembayaran dialokasikan ke termin dari yang paling awal). Ringkasan atas SEMUA data yang cocok dengan filter: sisa pokok aktif dan lewat tempo (aktif, jatuh tempo akhir sudah lewat, pokok belum lunas). Saring dengan status, jenis, atau nama debitur; 50 baris per halaman.';

    protected function izin(): string
    {
        return 'view receivables';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()->enum(array_keys(self::STATUS))
                ->description('Saring status: draft, pending_approval (menunggu persetujuan), active (sudah dicairkan, sedang dicicil), paid_off (lunas), rejected (ditolak).'),
            'jenis' => $schema->string()->enum(self::JENIS)
                ->description('Saring jenis: employee_loan (kasbon karyawan) atau company_loan (pinjaman ke klien).'),
            'debitur' => $schema->string()
                ->description('Sebagian nama debitur (karyawan atau klien), mis. "budi".'),
            'halaman' => $schema->integer()->min(1)
                ->description('Nomor halaman, mulai 1 (50 baris per halaman).'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $daftarStatus = implode(', ', array_keys(self::STATUS));
        $daftarJenis = implode(', ', self::JENIS);

        $argumen = $request->validate([
            'status' => ['nullable', 'string', Rule::in(array_keys(self::STATUS))],
            'jenis' => ['nullable', 'string', Rule::in(self::JENIS)],
            'debitur' => ['nullable', 'string', 'max:100'],
            'halaman' => ['nullable', 'integer', 'min:1'],
        ], [
            'status.string' => "Argumen status harus salah satu dari: {$daftarStatus}.",
            'status.in' => "Argumen status harus salah satu dari: {$daftarStatus}.",
            'jenis.string' => "Argumen jenis harus salah satu dari: {$daftarJenis}.",
            'jenis.in' => "Argumen jenis harus salah satu dari: {$daftarJenis}.",
            'debitur.string' => 'Argumen debitur harus berupa teks (sebagian nama).',
            'debitur.max' => 'Argumen debitur paling panjang 100 karakter.',
            'halaman.integer' => 'Argumen halaman harus bilangan bulat mulai 1.',
            'halaman.min' => 'Argumen halaman harus bilangan bulat mulai 1.',
        ]);

        $isi = fn (string $kunci): ?string => filled($argumen[$kunci] ?? null) ? trim((string) $argumen[$kunci]) : null;
        [$status, $jenis, $debitur] = [$isi('status'), $isi('jenis'), $isi('debitur')];

        $idDebitur = $debitur === null ? null : [
            User::class => User::query()->where('name', 'like', "%{$debitur}%")->pluck('id'),
            Client::class => Client::query()->where('name', 'like', "%{$debitur}%")->pluck('id'),
        ];

        $saring = fn (Builder $q): Builder => $q
            ->when($status, fn (Builder $q) => $q->where('receivables.status', $status))
            ->when($jenis, fn (Builder $q) => $q->where('receivables.type', $jenis))
            ->when($idDebitur !== null, fn (Builder $q) => $q->where(function (Builder $q) use ($idDebitur) {
                foreach ($idDebitur as $tipe => $id) {
                    $q->orWhere(fn (Builder $q) => $q->where('receivables.debtor_type', $tipe)->whereIn('receivables.debtor_id', $id));
                }
            }));

        $perStatus = $saring(Receivable::query())->toBase()
            ->selectRaw('status, COUNT(*) as jumlah, COALESCE(SUM(principal_amount), 0) as pokok, MIN(due_date) as jatuh_tempo_terdekat')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $terbayarAktif = ReceivablePayment::query()
            ->whereHas('receivable', fn (Builder $q) => $saring($q)->where('receivables.status', 'active'))
            ->toBase()
            ->selectRaw('COALESCE(SUM(principal_paid), 0) as pokok, COALESCE(SUM(interest_paid), 0) as bunga')
            ->first();

        $lewatTempo = $saring(Receivable::query())
            ->leftJoinSub(
                ReceivablePayment::query()->selectRaw('receivable_id, SUM(principal_paid) as pokok')->groupBy('receivable_id'),
                'bayar',
                'bayar.receivable_id',
                '=',
                'receivables.id',
            )
            ->where('receivables.status', 'active')
            ->whereDate('receivables.due_date', '<', now()->toDateString())
            ->whereRaw('receivables.principal_amount > COALESCE(bayar.pokok, 0)')
            ->toBase()
            ->selectRaw('COUNT(*) as jumlah, COALESCE(SUM(receivables.principal_amount - COALESCE(bayar.pokok, 0)), 0) as nominal')
            ->first();

        $hasil = $saring(Receivable::query())
            ->with(['debtor', 'approver:id,name'])
            ->withSum('payments', 'principal_paid')
            ->withSum('payments', 'interest_paid')
            ->orderByDesc('loan_date')
            ->orderByDesc('id')
            ->paginate(self::PER_HALAMAN, ['*'], 'halaman', max(1, (int) ($argumen['halaman'] ?? 1)));

        $layanan = app(JadwalAngsuranService::class);
        $aktif = $perStatus->get('active');
        $pokokAktif = (int) ($aktif->pokok ?? 0);

        return [
            'ringkasan' => [
                'jumlah' => (int) $perStatus->sum('jumlah'),
                'per_status' => collect(self::STATUS)->map(fn (string $label, string $s) => [
                    'label' => $label,
                    'jumlah' => (int) ($perStatus->get($s)->jumlah ?? 0),
                    'pokok' => (int) ($perStatus->get($s)->pokok ?? 0),
                ])->all(),
                'sisa_pokok_aktif' => max(0, $pokokAktif - (int) $terbayarAktif->pokok),
                'pokok_dibayar_aktif' => (int) $terbayarAktif->pokok,
                'bunga_dibayar_aktif' => (int) $terbayarAktif->bunga,
                'lewat_tempo' => [
                    'jumlah' => (int) $lewatTempo->jumlah,
                    'sisa_pokok' => (int) $lewatTempo->nominal,
                ],
                'jatuh_tempo_akhir_terdekat' => $aktif?->jatuh_tempo_terdekat ? Carbon::parse($aktif->jatuh_tempo_terdekat)->toDateString() : null,
            ],
            'halaman' => $hasil->currentPage(),
            'per_halaman' => self::PER_HALAMAN,
            'total_halaman' => $hasil->lastPage(),
            'piutang' => $hasil->getCollection()->map(function (Receivable $r) use ($layanan) {
                $totalBunga = $layanan->totalBungaPiutang($r);
                $pokokDibayar = (int) ($r->payments_sum_principal_paid ?? 0);
                $bungaDibayar = (int) ($r->payments_sum_interest_paid ?? 0);

                return [
                    'id' => $r->id,
                    'nomor' => $r->receivable_number,
                    'debitur' => [
                        'nama' => $r->debtor?->name,
                        'tipe' => self::TIPE_DEBITUR[$r->debtor_type] ?? $r->debtor_type,
                    ],
                    'pokok' => (int) $r->principal_amount,
                    'bunga_persen' => (float) $r->interest_rate,
                    'total_bunga' => $totalBunga,
                    'tenor_bulan' => $r->installment_months === null ? null : (int) $r->installment_months,
                    'cicilan_per_bulan' => $r->installment_amount,
                    'tanggal_pinjam' => $r->loan_date?->toDateString(),
                    'jatuh_tempo' => $r->due_date?->toDateString(),
                    'status' => $r->status,
                    'status_label' => self::STATUS[$r->status] ?? $r->status,
                    'pokok_dibayar' => $pokokDibayar,
                    'bunga_dibayar' => $bungaDibayar,
                    'sisa_pokok' => (int) $r->principal_amount - $pokokDibayar,
                    'sisa_bunga' => $totalBunga - $bungaDibayar,
                    // withSum di atas membuat untukPiutang() memakai jumlah yang sudah dimuat (tanpa query per baris).
                    'jadwal' => $r->status !== 'active' ? null : $this->ringkasJadwal($layanan->untukPiutang($r)),
                    'peninjau' => $r->approver?->name,
                    'ditinjau' => $r->approved_at?->toDateString(),
                    'alasan_penolakan' => $r->status === 'rejected' && filled($r->rejection_reason) ? Str::limit($r->rejection_reason, 200) : null,
                    'tujuan' => $r->purpose === null ? null : Str::limit($r->purpose, 150),
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
