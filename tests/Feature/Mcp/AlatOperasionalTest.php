<?php

namespace Tests\Feature\Mcp;

use App\Mcp\Servers\KeuanganServer;
use App\Mcp\Tools\DaftarPengajuanDana;
use App\Mcp\Tools\DaftarPiutang;
use App\Mcp\Tools\DaftarReimbursement;
use App\Mcp\Tools\DaftarUtang;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\FundRequest;
use App\Models\FundRequestItem;
use App\Models\Loan;
use App\Models\Receivable;
use App\Models\Reimbursement;
use App\Models\ReimbursementPayment;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\JadwalAngsuranService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Server\Testing\TestResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Alat MCP operasional: reimbursement, pengajuan dana, pinjaman, piutang.
 *
 * Yang dijaga: isi & ringkasan, filter, penolakan tanpa izin, visibilitas per baris yang
 * SAMA dengan halaman web (staf tidak boleh membaca pengajuan orang lain lewat Claude),
 * jadwal angsuran yang sama dengan panel jadwal, dan tidak ada query per baris.
 */
class AlatOperasionalTest extends TestCase
{
    use RefreshDatabase;

    private const ALAT = [DaftarReimbursement::class, DaftarPengajuanDana::class, DaftarUtang::class, DaftarPiutang::class];

    private const SEMUA_IZIN = [
        'use claude',
        'view reimbursements', 'approve reimbursements', 'pay reimbursements',
        'view fund requests', 'approve fund requests', 'disburse fund requests',
        'view loans', 'view receivables',
    ];

    private User $pemilik;

    private User $staf;

    private User $rekan;

    private User $kasir;

    private ?TransactionCategory $kategoriBeban = null;

    private ?BankAccount $rekeningUji = null;

    /** Penomoran unik data uji (uniqid bisa kembar di Windows). */
    private int $urut = 0;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        setPermissionsTeamId(null);
        foreach (self::SEMUA_IZIN as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(self::SEMUA_IZIN);
        Role::firstOrCreate(['name' => 'staff'])->syncPermissions(['use claude', 'view reimbursements', 'view fund requests', 'view receivables']);
        Role::firstOrCreate(['name' => 'kasir'])->syncPermissions(['use claude', 'view reimbursements', 'pay reimbursements', 'view fund requests', 'disburse fund requests']);
        Role::firstOrCreate(['name' => 'tanpa claude'])->syncPermissions(['view reimbursements', 'view fund requests', 'view loans', 'view receivables']);
        Role::firstOrCreate(['name' => 'hanya claude'])->syncPermissions(['use claude']);
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->pemilik = $this->pengguna('Pemilik Uji', 'admin');
        $this->staf = $this->pengguna('Staf Uji', 'staff');
        $this->rekan = $this->pengguna('Rekan Kerja', 'staff');
        $this->kasir = $this->pengguna('Kasir Uji', 'kasir');

        if (! TestResponse::hasMacro('isiJsonAlat')) {
            TestResponse::macro('isiJsonAlat', function (): array {
                return json_decode($this->content()[0], true, 512, JSON_THROW_ON_ERROR);
            });
        }
    }

    // ------------------------------------------------------------------
    // Reimbursement
    // ------------------------------------------------------------------

    public function test_reimbursement_menampilkan_rincian_dan_ringkasan_per_status(): void
    {
        $this->dataReimbursement();

        $hasil = $this->panggil(DaftarReimbursement::class, $this->pemilik);

        $this->assertSame('semua', $hasil['cakupan']);
        $this->assertSame(3, $hasil['ringkasan']['jumlah']);
        $this->assertSame(1_000_000, $hasil['ringkasan']['total_nominal']);
        $this->assertSame(300_000, $hasil['ringkasan']['total_dibayar']);
        $this->assertSame(200_000, $hasil['ringkasan']['menunggu_dibayar'], 'Menunggu dibayar = nominal disetujui dikurangi yang sudah dibayar.');
        $this->assertSame(['label' => 'Menunggu persetujuan', 'jumlah' => 1, 'nominal' => 500_000, 'dibayar' => 0], $hasil['ringkasan']['per_status']['pending']);
        $this->assertSame(['label' => 'Disetujui', 'jumlah' => 1, 'nominal' => 300_000, 'dibayar' => 100_000], $hasil['ringkasan']['per_status']['approved']);
        $this->assertSame(['label' => 'Lunas', 'jumlah' => 1, 'nominal' => 200_000, 'dibayar' => 200_000], $hasil['ringkasan']['per_status']['paid']);
        $this->assertSame(0, $hasil['ringkasan']['per_status']['draft']['jumlah']);
        $this->assertSame([1, 50, 1], [$hasil['halaman'], $hasil['per_halaman'], $hasil['total_halaman']]);

        $makan = collect($hasil['reimbursement'])->firstWhere('judul', 'Makan siang tim');
        $this->assertSame('Staf Uji', $makan['pemohon']);
        $this->assertSame('Makan & jamuan', $makan['kategori']);
        $this->assertSame('Konsumsi Rapat', $makan['kategori_akuntansi']);
        $this->assertSame([300_000, 100_000, 200_000], [$makan['nominal'], $makan['dibayar'], $makan['sisa']]);
        $this->assertSame(['approved', 'Disetujui'], [$makan['status'], $makan['status_label']]);
        $this->assertSame('2026-10-08', $makan['tanggal_pengeluaran']);
        $this->assertSame(['Pemilik Uji', '2026-10-09'], [$makan['peninjau'], $makan['ditinjau']]);
        $this->assertSame('2026-10-10', $makan['dibayar_terakhir']);
        $this->assertTrue($makan['ada_bukti']);

        $this->alat(DaftarReimbursement::class, $this->pemilik)
            ->assertDontSee('struk-rahasia')
            ->assertDontSee('reimbursements/');
    }

    public function test_reimbursement_filter_status_tanggal_pemohon_dan_kata_kunci(): void
    {
        $this->dataReimbursement();

        $judul = fn (array $argumen): array => collect($this->panggil(DaftarReimbursement::class, $this->pemilik, $argumen)['reimbursement'])
            ->pluck('judul')->sort()->values()->all();

        $this->assertSame(['Taksi rapat klien'], $judul(['status' => 'pending']));
        $this->assertSame(['Taksi rapat klien'], $judul(['pemohon' => 'rekan']));
        $this->assertSame(['Makan siang tim', 'Taksi rapat klien'], $judul(['dari' => '2026-10-01', 'sampai' => '2026-10-31']));
        $this->assertSame(['Tiket kereta Bandung'], $judul(['sampai' => '2026-09-30']));
        $this->assertSame(['Tiket kereta Bandung'], $judul(['kata_kunci' => 'kereta']));

        $disetujui = $this->panggil(DaftarReimbursement::class, $this->pemilik, ['status' => 'approved']);
        $this->assertSame(1, $disetujui['ringkasan']['jumlah'], 'Ringkasan dihitung atas data yang cocok dengan filter.');
        $this->assertSame(300_000, $disetujui['ringkasan']['total_nominal']);
    }

    public function test_reimbursement_staf_hanya_melihat_pengajuannya_sendiri(): void
    {
        $this->dataReimbursement();

        $hasil = $this->panggil(DaftarReimbursement::class, $this->staf);

        $this->assertSame('milik_sendiri', $hasil['cakupan']);
        $this->assertArrayHasKey('catatan_cakupan', $hasil);
        $this->assertSame(['Makan siang tim', 'Tiket kereta Bandung'], collect($hasil['reimbursement'])->pluck('judul')->sort()->values()->all());
        $this->assertSame(2, $hasil['ringkasan']['jumlah']);
        $this->assertSame(500_000, $hasil['ringkasan']['total_nominal'], 'Nominal milik orang lain tidak boleh ikut terjumlah.');
        $this->assertSame(0, $hasil['ringkasan']['per_status']['pending']['jumlah']);

        $this->assertSame([], $this->panggil(DaftarReimbursement::class, $this->staf, ['pemohon' => 'Rekan'])['reimbursement']);

        $this->alat(DaftarReimbursement::class, $this->staf)
            ->assertDontSee('Taksi rapat klien')
            ->assertDontSee('Rekan Kerja');
    }

    /** ReimbursementController::canSeeAll(): approve ATAU pay membuka seluruh pengajuan. */
    public function test_reimbursement_pemegang_izin_bayar_melihat_semua_pengajuan(): void
    {
        $this->dataReimbursement();

        $hasil = $this->panggil(DaftarReimbursement::class, $this->kasir);

        $this->assertSame('semua', $hasil['cakupan']);
        $this->assertSame(3, $hasil['ringkasan']['jumlah']);
    }

    // ------------------------------------------------------------------
    // Pengajuan dana
    // ------------------------------------------------------------------

    public function test_pengajuan_dana_menampilkan_total_item_status_dan_pencairan(): void
    {
        $this->dataPengajuanDana();

        $hasil = $this->panggil(DaftarPengajuanDana::class, $this->pemilik);

        $this->assertSame('semua', $hasil['cakupan']);
        $this->assertSame(2, $hasil['ringkasan']['jumlah']);
        $this->assertSame(2_750_000, $hasil['ringkasan']['total_nominal']);
        $this->assertSame(['label' => 'Menunggu Review', 'jumlah' => 1, 'nominal' => 2_000_000], $hasil['ringkasan']['per_status']['pending']);
        $this->assertSame(['label' => 'Dicairkan', 'jumlah' => 1, 'nominal' => 750_000], $hasil['ringkasan']['per_status']['disbursed']);
        $this->assertSame(0, $hasil['ringkasan']['per_status']['approved']['jumlah']);

        $tenda = collect($hasil['pengajuan_dana'])->firstWhere('nomor', '001/TST/X/2026');
        $this->assertSame('Rekan Kerja', $tenda['pemohon']);
        $this->assertSame([2_000_000, 2], [$tenda['total'], $tenda['jumlah_item']]);
        $this->assertSame(['pending', 'Menunggu Review', 'high'], [$tenda['status'], $tenda['status_label'], $tenda['prioritas']]);
        $this->assertNull($tenda['pencairan']);

        $atk = collect($hasil['pengajuan_dana'])->firstWhere('nomor', '002/TST/X/2026');
        $this->assertSame(['Pemilik Uji', '2026-10-11'], [$atk['peninjau'], $atk['ditinjau']]);
        $this->assertSame([
            'tanggal' => '2026-10-12',
            'oleh' => 'Pemilik Uji',
            'rekening' => 'Rekening Operasional — Bank Mandiri',
            'catatan' => 'Transfer ke toko',
        ], $atk['pencairan']);

        $this->alat(DaftarPengajuanDana::class, $this->pemilik)->assertDontSee('fund-requests/');
    }

    public function test_pengajuan_dana_filter_status_kata_kunci_tanggal_dan_pemohon(): void
    {
        $this->travelTo(Carbon::parse('2026-10-15 09:00:00'));
        $this->dataPengajuanDana();
        FundRequest::query()->where('request_number', '001/TST/X/2026')->firstOrFail()
            ->forceFill(['created_at' => '2026-09-15 10:00:00'])->saveQuietly();

        $nomor = fn (array $argumen): array => collect($this->panggil(DaftarPengajuanDana::class, $this->pemilik, $argumen)['pengajuan_dana'])
            ->pluck('nomor')->all();

        $this->assertSame(['002/TST/X/2026'], $nomor(['status' => 'disbursed']));
        $this->assertSame(['001/TST/X/2026'], $nomor(['kata_kunci' => '001/TST']));
        $this->assertSame(['001/TST/X/2026'], $nomor(['dari' => '2026-09-01', 'sampai' => '2026-09-30']));
        $this->assertSame(['002/TST/X/2026'], $nomor(['dari' => '2026-10-01']));
        $this->assertSame(['002/TST/X/2026'], $nomor(['pemohon' => 'staf']));
    }

    /**
     * FundRequestController::index() membuka tab "semua" hanya untuk pemegang approve fund
     * requests; izin disburse saja tidak cukup.
     */
    public function test_pengajuan_dana_staf_dan_pencair_hanya_melihat_miliknya_sendiri(): void
    {
        $this->dataPengajuanDana();

        $hasil = $this->panggil(DaftarPengajuanDana::class, $this->staf);

        $this->assertSame('milik_sendiri', $hasil['cakupan']);
        $this->assertSame(['002/TST/X/2026'], collect($hasil['pengajuan_dana'])->pluck('nomor')->all());
        $this->assertSame([1, 750_000], [$hasil['ringkasan']['jumlah'], $hasil['ringkasan']['total_nominal']]);
        $this->alat(DaftarPengajuanDana::class, $this->staf)
            ->assertDontSee('Sewa tenda acara')
            ->assertDontSee('Rekan Kerja');

        $pencair = $this->panggil(DaftarPengajuanDana::class, $this->kasir);

        $this->assertSame('milik_sendiri', $pencair['cakupan']);
        $this->assertSame([], $pencair['pengajuan_dana']);
        $this->assertSame(0, $pencair['ringkasan']['jumlah']);
    }

    // ------------------------------------------------------------------
    // Pinjaman
    // ------------------------------------------------------------------

    /**
     * 12.000.000, 12% per tahun, 12 bulan: angsuran 1.120.000 (pokok 1.000.000 + bunga
     * 120.000). Dibayar pokok 2.500.000 + bunga 300.000 → termin 1–2 lunas, termin 3
     * tertutup 560.000. Per 5 Nov 2026 termin 1–4 sudah jatuh tempo.
     */
    public function test_pinjaman_menampilkan_sisa_dan_jadwal_yang_sama_dengan_panel_jadwal(): void
    {
        $this->travelTo(Carbon::parse('2026-11-05 10:00:00'));
        $mandiri = $this->pinjaman([
            'loan_number' => 'LOAN-00001',
            'lender_name' => 'PT Bank Mandiri',
            'principal_amount' => 12_000_000,
            'interest_type' => 'percentage',
            'interest_amount' => null,
            'interest_rate' => 12,
            'term_months' => 12,
            'start_date' => '2026-06-25',
            'maturity_date' => '2027-06-25',
            'purpose' => 'Modal kerja proyek',
        ]);
        $this->bayarPinjaman($mandiri, 2_500_000, 300_000, '2026-09-01');
        $this->pinjaman(['loan_number' => 'LOAN-00002', 'status' => 'paid_off']);

        $hasil = $this->panggil(DaftarUtang::class, $this->pemilik);
        $baris = collect($hasil['utang'])->firstWhere('nomor', 'LOAN-00001');

        $this->assertSame('PT Bank Mandiri', $baris['pemberi_pinjaman']);
        $this->assertSame(['percentage', 12, 1_440_000], [$baris['bunga_tipe'], $baris['bunga_persen_per_tahun'], $baris['total_bunga']]);
        $this->assertSame([2_500_000, 300_000, 9_500_000, 1_140_000], [$baris['pokok_dibayar'], $baris['bunga_dibayar'], $baris['sisa_pokok'], $baris['sisa_bunga']]);
        $this->assertSame(['active', 'Aktif', '2026-06-25', '2027-06-25'], [$baris['status'], $baris['status_label'], $baris['mulai'], $baris['jatuh_tempo']]);
        $this->assertSame([
            'jumlah_termin' => 12,
            'termin_lunas' => 2,
            'termin_berikutnya' => ['ke' => 3, 'jatuh_tempo' => '2026-09-25', 'angsuran' => 1_120_000, 'sisa' => 560_000],
            'termin_terlambat' => 2,
            'tunggakan' => 1_680_000,
        ], $baris['jadwal']);

        $this->assertSame(
            $this->ringkasanDariPanelJadwal(app(JadwalAngsuranService::class)->untukPinjaman($mandiri)),
            $baris['jadwal'],
            'Ringkasan jadwal di alat harus sama dengan jadwal yang ditampilkan panel jadwal pinjaman.'
        );

        $this->assertNull(collect($hasil['utang'])->firstWhere('nomor', 'LOAN-00002')['jadwal'], 'Pinjaman lunas tidak punya termin berikutnya.');
    }

    /** Skenario sama dengan LoanControllerTest::test_ringkasan_sisa_pokok_hanya_mencakup_pinjaman_aktif. */
    public function test_pinjaman_ringkasan_sisa_pokok_hanya_dari_pinjaman_aktif_dan_mengikuti_filter(): void
    {
        $aktif = $this->pinjaman(['loan_number' => 'LN-AKTIF', 'lender_name' => 'PT Bank Mandiri', 'principal_amount' => 10_000_000, 'maturity_date' => '2027-06-01']);
        $this->bayarPinjaman($aktif, 2_000_000, 150_000, '2026-02-01');
        $lunas = $this->pinjaman(['loan_number' => 'LN-LUNAS', 'lender_name' => 'KSP Mitra Usaha', 'principal_amount' => 5_000_000, 'status' => 'paid_off', 'maturity_date' => '2026-03-01']);
        $this->bayarPinjaman($lunas, 3_000_000, 900_000, '2026-03-01');

        $hasil = $this->panggil(DaftarUtang::class, $this->pemilik);

        $this->assertSame([2, 15_000_000], [$hasil['ringkasan']['jumlah'], $hasil['ringkasan']['total_pokok']]);
        $this->assertSame(['label' => 'Lunas', 'jumlah' => 1, 'pokok' => 5_000_000], $hasil['ringkasan']['per_status']['paid_off']);
        $this->assertSame(8_000_000, $hasil['ringkasan']['sisa_pokok_aktif'], 'Pembayaran pinjaman lunas tidak boleh menyusutkan sisa pokok pinjaman aktif.');
        $this->assertSame([2_000_000, 150_000], [$hasil['ringkasan']['pokok_dibayar_aktif'], $hasil['ringkasan']['bunga_dibayar_aktif']]);
        $this->assertSame('2027-06-01', $hasil['ringkasan']['jatuh_tempo_akhir_terdekat']);

        $nomor = fn (array $argumen): array => collect($this->panggil(DaftarUtang::class, $this->pemilik, $argumen)['utang'])->pluck('nomor')->all();
        $this->assertSame(['LN-LUNAS'], $nomor(['status' => 'paid_off']));
        $this->assertSame(['LN-AKTIF'], $nomor(['kata_kunci' => 'mandiri']));

        $hanyaLunas = $this->panggil(DaftarUtang::class, $this->pemilik, ['status' => 'paid_off']);
        $this->assertSame(0, $hanyaLunas['ringkasan']['sisa_pokok_aktif']);
        $this->assertNull($hanyaLunas['ringkasan']['jatuh_tempo_akhir_terdekat']);
    }

    // ------------------------------------------------------------------
    // Piutang
    // ------------------------------------------------------------------

    /**
     * Kasbon 6.000.000, bunga flat 10% (600.000), 6 bulan: angsuran 1.100.000. Dibayar pokok
     * 1.500.000 + bunga 150.000 → termin 1 lunas, termin 2 tertutup 550.000. Per 5 Nov 2026
     * termin 1–4 sudah jatuh tempo.
     */
    public function test_piutang_menampilkan_debitur_polimorfik_dan_jadwal_yang_sama_dengan_panel_jadwal(): void
    {
        $this->travelTo(Carbon::parse('2026-11-05 10:00:00'));
        $budi = User::factory()->create(['name' => 'Budi Karyawan']);
        $klien = Client::factory()->create(['name' => 'PT Klien Makmur', 'type' => 'company']);

        $kasbon = $this->piutang([
            'receivable_number' => 'RCV-00001',
            'debtor_id' => $budi->id,
            'principal_amount' => 6_000_000,
            'interest_rate' => 10,
            'installment_months' => 6,
            'installment_amount' => 1_100_000,
            'loan_date' => '2026-06-25',
            'due_date' => '2026-12-25',
            'approved_by' => $this->pemilik->id,
            'approved_at' => '2026-06-26 09:00:00',
            'purpose' => 'Biaya pengobatan keluarga',
        ]);
        $this->bayarPiutang($kasbon, 1_500_000, 150_000, '2026-08-25');
        $this->piutang([
            'receivable_number' => 'RCV-00002',
            'type' => 'company_loan',
            'debtor_type' => Client::class,
            'debtor_id' => $klien->id,
            'principal_amount' => 20_000_000,
            'interest_rate' => 5,
            'installment_months' => 10,
            'installment_amount' => 2_100_000,
            'loan_date' => '2026-11-01',
            'due_date' => '2027-09-01',
            'status' => 'pending_approval',
        ]);

        $hasil = $this->panggil(DaftarPiutang::class, $this->pemilik);
        $karyawan = collect($hasil['piutang'])->firstWhere('nomor', 'RCV-00001');
        $perusahaan = collect($hasil['piutang'])->firstWhere('nomor', 'RCV-00002');

        $this->assertSame(['nama' => 'Budi Karyawan', 'tipe' => 'karyawan'], $karyawan['debitur']);
        $this->assertSame(['nama' => 'PT Klien Makmur', 'tipe' => 'klien'], $perusahaan['debitur']);
        $this->assertSame([10, 600_000, 6, 1_100_000], [$karyawan['bunga_persen'], $karyawan['total_bunga'], $karyawan['tenor_bulan'], $karyawan['cicilan_per_bulan']]);
        $this->assertSame([1_500_000, 150_000, 4_500_000, 450_000], [$karyawan['pokok_dibayar'], $karyawan['bunga_dibayar'], $karyawan['sisa_pokok'], $karyawan['sisa_bunga']]);
        $this->assertSame(['Pemilik Uji', '2026-06-26'], [$karyawan['peninjau'], $karyawan['ditinjau']]);
        $this->assertSame([
            'jumlah_termin' => 6,
            'termin_lunas' => 1,
            'termin_berikutnya' => ['ke' => 2, 'jatuh_tempo' => '2026-08-25', 'angsuran' => 1_100_000, 'sisa' => 550_000],
            'termin_terlambat' => 3,
            'tunggakan' => 2_750_000,
        ], $karyawan['jadwal']);
        $this->assertSame(
            $this->ringkasanDariPanelJadwal(app(JadwalAngsuranService::class)->untukPiutang($kasbon)),
            $karyawan['jadwal'],
            'Ringkasan jadwal di alat harus sama dengan jadwal yang ditampilkan panel jadwal piutang.'
        );

        $this->assertSame(['pending_approval', 'Menunggu'], [$perusahaan['status'], $perusahaan['status_label']]);
        $this->assertNull($perusahaan['jadwal'], 'Piutang yang belum dicairkan belum punya termin berjalan.');

        $this->assertSame(2, $hasil['ringkasan']['jumlah']);
        $this->assertSame(['label' => 'Menunggu', 'jumlah' => 1, 'pokok' => 20_000_000], $hasil['ringkasan']['per_status']['pending_approval']);
        $this->assertSame([4_500_000, 1_500_000, 150_000], [$hasil['ringkasan']['sisa_pokok_aktif'], $hasil['ringkasan']['pokok_dibayar_aktif'], $hasil['ringkasan']['bunga_dibayar_aktif']]);
        $this->assertSame('2026-12-25', $hasil['ringkasan']['jatuh_tempo_akhir_terdekat']);
    }

    /** Lewat tempo: skenario sama dengan ReceivableControllerTest::test_lewat_tempo_hanya_menghitung_piutang_aktif_yang_pokoknya_belum_tertutup. */
    public function test_piutang_filter_debitur_status_jenis_dan_ringkasan_lewat_tempo(): void
    {
        $this->travelTo(Carbon::parse('2026-11-05 10:00:00'));
        $budi = User::factory()->create(['name' => 'Budi Karyawan']);
        $klien = Client::factory()->create(['name' => 'PT Klien Makmur', 'type' => 'company']);

        $menunggak = $this->piutang(['receivable_number' => 'RCV-TUNGGAK', 'debtor_id' => $budi->id, 'principal_amount' => 10_000_000, 'due_date' => '2026-09-05']);
        $this->bayarPiutang($menunggak, 3_000_000, 0, '2026-08-05');
        $kembali = $this->piutang([
            'receivable_number' => 'RCV-KEMBALI',
            'type' => 'company_loan',
            'debtor_type' => Client::class,
            'debtor_id' => $klien->id,
            'principal_amount' => 5_000_000,
            'due_date' => '2026-10-05',
        ]);
        $this->bayarPiutang($kembali, 5_000_000, 0, '2026-10-05');
        $this->piutang(['receivable_number' => 'RCV-DRAFT', 'principal_amount' => 8_000_000, 'status' => 'draft', 'due_date' => '2026-07-05']);

        $hasil = $this->panggil(DaftarPiutang::class, $this->pemilik);

        $this->assertSame(['jumlah' => 1, 'sisa_pokok' => 7_000_000], $hasil['ringkasan']['lewat_tempo']);
        $this->assertSame(7_000_000, $hasil['ringkasan']['sisa_pokok_aktif']);

        $nomor = fn (array $argumen): array => collect($this->panggil(DaftarPiutang::class, $this->pemilik, $argumen)['piutang'])->pluck('nomor')->all();
        $this->assertSame(['RCV-TUNGGAK'], $nomor(['debitur' => 'budi']));
        $this->assertSame(['RCV-KEMBALI'], $nomor(['debitur' => 'makmur']));
        $this->assertSame(['RCV-KEMBALI'], $nomor(['jenis' => 'company_loan']));
        $this->assertSame(['RCV-DRAFT'], $nomor(['status' => 'draft']));

        $hanyaKlien = $this->panggil(DaftarPiutang::class, $this->pemilik, ['debitur' => 'makmur']);
        $this->assertSame(['jumlah' => 0, 'sisa_pokok' => 0], $hanyaKlien['ringkasan']['lewat_tempo'], 'Ringkasan lewat tempo mengikuti filter.');
    }

    /** ReceivableController::index() tidak menyaring per pengguna; alat mengikuti, tidak lebih longgar. */
    public function test_piutang_tanpa_pembatasan_baris_sama_dengan_halaman_piutang(): void
    {
        $this->piutang(['receivable_number' => 'RCV-REKAN', 'debtor_id' => $this->rekan->id]);

        $hasil = $this->panggil(DaftarPiutang::class, $this->staf);

        $this->assertSame(['RCV-REKAN'], collect($hasil['piutang'])->pluck('nomor')->all());
        $this->assertSame('Rekan Kerja', $hasil['piutang'][0]['debitur']['nama']);
    }

    // ------------------------------------------------------------------
    // Lintas alat
    // ------------------------------------------------------------------

    public function test_semua_alat_menolak_tanpa_use_claude_atau_tanpa_izin_modul(): void
    {
        $tanpaClaude = $this->pengguna('Tanpa Claude', 'tanpa claude');
        $hanyaClaude = $this->pengguna('Hanya Claude', 'hanya claude');
        $this->reimbursement($this->rekan, 'Rahasia', 100_000, 'pending');

        foreach (self::ALAT as $alat) {
            foreach ([$tanpaClaude, $hanyaClaude] as $user) {
                $this->alat($alat, $user)
                    ->assertHasErrors(['tidak bisa dibaca'])
                    ->assertDontSee('Rahasia');
            }
        }

        $this->alat(DaftarUtang::class, $this->staf)->assertHasErrors(['view loans']);
        $this->assertFalse(tenancy()->initialized);
    }

    public function test_argumen_tidak_sah_dijawab_dengan_pesan_yang_bisa_ditindaklanjuti(): void
    {
        $this->alat(DaftarReimbursement::class, $this->pemilik, ['status' => 'disetujui'])
            ->assertHasErrors(['Argumen status harus salah satu dari: draft, pending, approved, rejected, paid.']);
        $this->alat(DaftarReimbursement::class, $this->pemilik, ['dari' => '05-10-2026'])
            ->assertHasErrors(['YYYY-MM-DD']);
        $this->alat(DaftarPengajuanDana::class, $this->pemilik, ['dari' => '2026-10-31', 'sampai' => '2026-10-01'])
            ->assertHasErrors(['tidak boleh lebih awal']);
        $this->alat(DaftarUtang::class, $this->pemilik, ['halaman' => 0])
            ->assertHasErrors(['halaman harus bilangan bulat mulai 1']);
        $this->alat(DaftarPiutang::class, $this->pemilik, ['jenis' => 'kasbon'])
            ->assertHasErrors(['employee_loan, company_loan']);

        $this->assertFalse(tenancy()->initialized, 'Validasi berjalan di dalam database perusahaan; koneksi tetap harus kembali ke pusat.');
        $this->assertSame(self::TEST_COMPANY, getPermissionsTeamId());
    }

    /** Jumlah query sama untuk 2 dan 6 baris: tidak ada query per baris (termasuk jadwal angsuran). */
    public function test_jumlah_query_tidak_bertambah_mengikuti_jumlah_baris(): void
    {
        $klien = Client::factory()->create(['type' => 'company']);
        $jumlahQuery = 0;
        DB::listen(function () use (&$jumlahQuery): void {
            $jumlahQuery++;
        });

        $isi = function (int $banyak) use ($klien): void {
            foreach (range(1, $banyak) as $i) {
                $reimbursement = $this->reimbursement($this->staf, "Reimbursement {$i}", 100_000, 'approved', [
                    'reviewed_by' => $this->pemilik->id,
                    'category_id' => $this->kategori()->id,
                ]);
                $this->bayarReimbursement($reimbursement, 40_000, '2026-10-10');

                $this->pengajuanDana($this->staf, 'FR-'.++$this->urut, "Pengajuan {$i}", 'disbursed', [['Item', 1, 100_000]], [
                    'reviewed_by' => $this->pemilik->id,
                    'disbursed_by' => $this->pemilik->id,
                    'disbursement_date' => '2026-10-12',
                    'bank_transaction_id' => BankTransaction::factory()->debit()->create(['bank_account_id' => $this->rekening()->id])->id,
                ]);

                $this->bayarPinjaman($this->pinjaman([]), 1_000_000, 10_000, '2026-02-10');

                $this->bayarPiutang($this->piutang(['approved_by' => $this->pemilik->id]), 500_000, 0, '2026-07-25');
                $this->piutang([
                    'type' => 'company_loan',
                    'debtor_type' => Client::class,
                    'debtor_id' => $klien->id,
                    'approved_by' => $this->pemilik->id,
                ]);
            }
        };

        $ukur = function (string $alat) use (&$jumlahQuery): int {
            $jumlahQuery = 0;
            $this->panggil($alat, $this->pemilik);

            return $jumlahQuery;
        };

        $isi(2);
        array_map($ukur, self::ALAT);
        $sedikit = array_map($ukur, self::ALAT);
        $isi(4);
        $banyak = array_map($ukur, self::ALAT);

        $this->assertSame($sedikit, $banyak);
    }

    // ------------------------------------------------------------------
    // Bantuan
    // ------------------------------------------------------------------

    private function pengguna(string $nama, string $peran): User
    {
        $user = User::factory()->create(['name' => $nama]);
        $user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $user->assignRole($peran);

        return $user;
    }

    /**
     * @param  array<string, mixed>  $argumen
     */
    private function alat(string $alat, User $user, array $argumen = []): TestResponse
    {
        return KeuanganServer::actingAs($user)->tool($alat, ['perusahaan' => self::TEST_COMPANY, ...$argumen]);
    }

    /**
     * @param  array<string, mixed>  $argumen
     * @return array<string, mixed>
     */
    private function panggil(string $alat, User $user, array $argumen = []): array
    {
        return $this->alat($alat, $user, $argumen)->assertOk()->isiJsonAlat();
    }

    /**
     * Ringkasan yang diharapkan, diturunkan dari keluaran publik JadwalAngsuranService
     * (yang dipakai panel jadwal di aplikasi).
     *
     * @param  list<array<string, mixed>>  $jadwal
     * @return array<string, mixed>
     */
    private function ringkasanDariPanelJadwal(array $jadwal): array
    {
        $sisa = fn (array $t): int => $t['angsuran'] - $t['pokok_terbayar'] - $t['bunga_terbayar'];
        $berikutnya = collect($jadwal)->first(fn (array $t) => $t['status'] !== 'lunas');
        $terlambat = collect($jadwal)->where('terlambat', true);

        return [
            'jumlah_termin' => count($jadwal),
            'termin_lunas' => collect($jadwal)->where('status', 'lunas')->count(),
            'termin_berikutnya' => [
                'ke' => $berikutnya['termin'],
                'jatuh_tempo' => $berikutnya['jatuh_tempo'],
                'angsuran' => $berikutnya['angsuran'],
                'sisa' => $sisa($berikutnya),
            ],
            'termin_terlambat' => $terlambat->count(),
            'tunggakan' => $terlambat->sum($sisa),
        ];
    }

    private function kategori(): TransactionCategory
    {
        return $this->kategoriBeban ??= TransactionCategory::create(['label' => 'Konsumsi Rapat', 'type' => 'expense']);
    }

    private function rekening(): BankAccount
    {
        return $this->rekeningUji ??= BankAccount::factory()->create(['account_name' => 'Rekening Operasional', 'bank_name' => 'Bank Mandiri']);
    }

    /**
     * @param  array<string, mixed>  $lain
     */
    private function reimbursement(User $pemohon, string $judul, int $nominal, string $status, array $lain = []): Reimbursement
    {
        return Reimbursement::create([
            'user_id' => $pemohon->id,
            'title' => $judul,
            'amount' => $nominal,
            'expense_date' => '2026-10-05',
            'category_input' => 'transport',
            'status' => $status,
            'payment_status' => 'unpaid',
            ...$lain,
        ]);
    }

    /** Pembayaran nyata: hook ReimbursementPayment menghitung ulang amount_paid. */
    private function bayarReimbursement(Reimbursement $reimbursement, int $nominal, string $tanggal): void
    {
        ReimbursementPayment::create([
            'reimbursement_id' => $reimbursement->id,
            'bank_transaction_id' => BankTransaction::factory()->debit()->create([
                'bank_account_id' => $this->rekening()->id,
                'amount' => $nominal,
                'transaction_date' => $tanggal,
            ])->id,
            'amount' => $nominal,
            'payment_date' => $tanggal,
            'paid_by' => $this->pemilik->id,
        ]);
    }

    /** Pending milik rekan; disetujui-sebagian & lunas milik staf. Total 1.000.000, dibayar 300.000. */
    private function dataReimbursement(): void
    {
        $this->reimbursement($this->rekan, 'Taksi rapat klien', 500_000, 'pending', ['expense_date' => '2026-10-03']);

        $makan = $this->reimbursement($this->staf, 'Makan siang tim', 300_000, 'approved', [
            'expense_date' => '2026-10-08',
            'category_input' => 'meals',
            'category_id' => $this->kategori()->id,
            'reviewed_by' => $this->pemilik->id,
            'reviewed_at' => '2026-10-09 09:00:00',
            'attachment_path' => 'reimbursements/struk-rahasia-123.jpg',
            'attachment_name' => 'struk.jpg',
        ]);
        $this->bayarReimbursement($makan, 100_000, '2026-10-10');

        $kereta = $this->reimbursement($this->staf, 'Tiket kereta Bandung', 200_000, 'paid', ['expense_date' => '2026-09-20']);
        $this->bayarReimbursement($kereta, 200_000, '2026-09-25');
    }

    /**
     * @param  list<array{0: string, 1: int, 2: int}>  $item  [deskripsi, qty, harga satuan]
     * @param  array<string, mixed>  $lain
     */
    private function pengajuanDana(User $pemohon, string $nomor, string $judul, string $status, array $item, array $lain = []): FundRequest
    {
        $pengajuan = FundRequest::create([
            'request_number' => $nomor,
            'user_id' => $pemohon->id,
            'title' => $judul,
            'purpose' => "Kebutuhan {$judul}",
            'priority' => 'high',
            'needed_by_date' => '2026-10-20',
            'attachment_path' => 'fund-requests/lampiran-rahasia.pdf',
            'attachment_name' => 'lampiran.pdf',
            'status' => $status,
            'total_amount' => 0,
            ...$lain,
        ]);

        foreach ($item as [$deskripsi, $qty, $harga]) {
            FundRequestItem::create([
                'fund_request_id' => $pengajuan->id,
                'description' => $deskripsi,
                'category_id' => $this->kategori()->id,
                'quantity' => $qty,
                'unit_price' => $harga,
                'amount' => $qty * $harga,
            ]);
        }

        return $pengajuan;
    }

    /** Pending milik rekan (2 item, 2.000.000); dicairkan milik staf (750.000). */
    private function dataPengajuanDana(): void
    {
        $this->pengajuanDana($this->rekan, '001/TST/X/2026', 'Sewa tenda acara', 'pending', [['Tenda', 1, 1_500_000], ['Kursi', 2, 250_000]]);

        $this->pengajuanDana($this->staf, '002/TST/X/2026', 'Pembelian ATK', 'disbursed', [['Kertas dan tinta', 3, 250_000]], [
            'reviewed_by' => $this->pemilik->id,
            'reviewed_at' => '2026-10-11 10:00:00',
            'disbursed_by' => $this->pemilik->id,
            'disbursed_at' => '2026-10-12 10:00:00',
            'disbursement_date' => '2026-10-12',
            'disbursement_notes' => 'Transfer ke toko',
            'bank_transaction_id' => BankTransaction::factory()->debit()->create([
                'bank_account_id' => $this->rekening()->id,
                'amount' => 750_000,
            ])->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $atribut
     */
    private function pinjaman(array $atribut): Loan
    {
        return Loan::create([
            'loan_number' => 'LN-'.++$this->urut,
            'lender_name' => 'Bank Uji',
            'principal_amount' => 10_000_000,
            'interest_type' => 'fixed',
            'interest_amount' => 0,
            'term_months' => 10,
            'start_date' => '2026-01-10',
            'maturity_date' => '2026-11-10',
            'status' => 'active',
            ...$atribut,
        ]);
    }

    private function bayarPinjaman(Loan $pinjaman, int $pokok, int $bunga, string $tanggal): void
    {
        $pinjaman->payments()->create([
            'bank_account_id' => $this->rekening()->id,
            'payment_date' => $tanggal,
            'principal_paid' => $pokok,
            'interest_paid' => $bunga,
            'total_paid' => $pokok + $bunga,
        ]);
    }

    /**
     * @param  array<string, mixed>  $atribut
     */
    private function piutang(array $atribut): Receivable
    {
        return Receivable::create([
            'receivable_number' => 'RCV-'.++$this->urut,
            'type' => 'employee_loan',
            'debtor_type' => User::class,
            'debtor_id' => $this->rekan->id,
            'principal_amount' => 6_000_000,
            'interest_rate' => 0,
            'installment_months' => 6,
            'installment_amount' => 1_000_000,
            'loan_date' => '2026-06-25',
            'due_date' => '2026-12-25',
            'status' => 'active',
            'purpose' => 'Kasbon',
            'disbursement_account' => 'BCA 1234567890',
            ...$atribut,
        ]);
    }

    private function bayarPiutang(Receivable $piutang, int $pokok, int $bunga, string $tanggal): void
    {
        $piutang->payments()->create([
            'payment_date' => $tanggal,
            'principal_paid' => $pokok,
            'interest_paid' => $bunga,
            'total_paid' => $pokok + $bunga,
            'payment_method' => 'payroll_deduction',
        ]);
    }
}
