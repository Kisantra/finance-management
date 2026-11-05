<?php

namespace Tests\Feature\Mcp;

use App\Mcp\Servers\KeuanganServer;
use App\Mcp\Tools\KategoriTransaksi;
use App\Mcp\Tools\LabaRugi;
use App\Mcp\Tools\MutasiRekening;
use App\Mcp\Tools\RingkasanKeuangan;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\FundRequest;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Loan;
use App\Models\LoanPayment;
use App\Models\Payment;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\Reimbursement;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\ProfitLossService;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Mcp\Server\Testing\TestResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Alat MCP kas & laporan: ringkasan-keuangan, laba-rugi, mutasi-rekening, kategori-transaksi.
 * Angka yang diharapkan dihitung tangan dari data uji, bukan disalin dari kode yang diuji.
 * "Hari ini" dipatok 2026-11-15, jadi periode bawaan = 1–30 November 2026.
 */
class AlatKasTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private const IZIN_MODUL = [
        'view dashboard', 'view bank-accounts', 'view income', 'view expense', 'view invoices',
        'view receivables', 'view loans', 'view reimbursements', 'view fund requests',
        'view profit-loss', 'view categories',
        'approve reimbursements', 'pay reimbursements', 'approve fund requests',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-11-15 10:00:00'));

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        setPermissionsTeamId(null);
        foreach ([...self::IZIN_MODUL, 'use claude'] as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions([...self::IZIN_MODUL, 'use claude']);
        Role::firstOrCreate(['name' => 'tanpa claude'])->syncPermissions(self::IZIN_MODUL);
        Role::firstOrCreate(['name' => 'hanya claude'])->syncPermissions(['use claude']);
        Role::firstOrCreate(['name' => 'ringkas terbatas'])->syncPermissions(['use claude', 'view dashboard', 'view reimbursements']);
        setPermissionsTeamId(self::TEST_COMPANY);
    }

    public function test_keempat_alat_hanya_membaca_dan_mengumumkan_argumennya(): void
    {
        $argumen = [
            RingkasanKeuangan::class => ['perusahaan', 'dari', 'sampai'],
            LabaRugi::class => ['perusahaan', 'dari', 'sampai'],
            MutasiRekening::class => ['perusahaan', 'rekening', 'arah', 'kategori', 'kata_kunci', 'dari', 'sampai', 'halaman', 'per_halaman'],
            KategoriTransaksi::class => ['perusahaan', 'jenis'],
        ];

        foreach ($argumen as $kelas => $nama) {
            $alat = (new $kelas)->toArray();

            $this->assertTrue($alat['annotations']['readOnlyHint'] ?? false, $kelas);
            $this->assertSame($nama, array_keys((array) $alat['inputSchema']['properties']), $kelas);
            $this->assertSame(['perusahaan'], $alat['inputSchema']['required'], $kelas);
            $this->assertStringNotContainsString('Belum tersedia', $alat['description'], $kelas);
        }
    }

    // ── ringkasan-keuangan ─────────────────────────────────────────────

    public function test_ringkasan_keuangan_memakai_definisi_ringkasan_dan_arus_kas(): void
    {
        $admin = $this->pengguna('admin');
        $this->siapkanDataRingkasan($admin);

        $isi = $this->isi($this->panggil($admin, RingkasanKeuangan::class));

        $this->assertSame(['dari' => '2026-11-01', 'sampai' => '2026-11-30'], $isi['periode']);
        $this->assertSame('2026-11-15', $isi['posisi_per']);

        // Saldo = saldo awal + pembayaran + kredit − debit (semua waktu); arus = semua mutasi November.
        $this->assertSame([
            'total_saldo' => 22_997_500,
            'jumlah_rekening' => 2,
            'uang_masuk' => 8_500_000,
            'uang_keluar' => 2_002_500,
            'arus_bersih' => 6_497_500,
        ], $isi['kas']);

        // Halaman Arus Kas: transfer (1.000.000/1.002.500) dan pinjaman masuk (4.000.000) tidak dihitung.
        $this->assertSame(['total' => 3_500_000, 'pembayaran_invoice' => 1_500_000, 'per_kategori' => ['Sewa Ruang' => 2_000_000]], $isi['pemasukan']);
        $this->assertSame(['total' => 1_000_000, 'per_kategori' => ['Listrik' => 700_000, 'ATK' => 300_000]], $isi['pengeluaran']);

        $this->assertSame(['jumlah' => 2, 'sisa' => 6_500_000], $isi['invoice']['belum_dibayar']);
        $this->assertSame(['jumlah' => 1, 'sisa' => 3_000_000], $isi['invoice']['lewat_tempo']);
        $this->assertSame([
            [
                'nomor' => '002/INV/UJI/X/2026',
                'klien' => 'PT Klien Uji',
                'total' => 3_000_000,
                'sisa' => 3_000_000,
                'jatuh_tempo' => '2026-11-01',
                'hari_lewat_tempo' => 14,
                'status' => 'sent',
                'status_label' => 'Terkirim',
            ],
            [
                'nomor' => '001/INV/UJI/XI/2026',
                'klien' => 'PT Klien Uji',
                'total' => 5_000_000,
                'sisa' => 3_500_000,
                'jatuh_tempo' => '2026-11-30',
                'hari_lewat_tempo' => 0,
                'status' => 'partially_paid',
                'status_label' => 'Dibayar sebagian',
            ],
        ], $isi['invoice']['jatuh_tempo_terdekat']);

        $this->assertSame([
            'aktif' => ['jumlah' => 2, 'sisa_pokok' => 7_000_000],
            'lewat_tempo' => ['jumlah' => 1, 'sisa_pokok' => 5_000_000],
            'menunggu_persetujuan' => ['jumlah' => 1, 'pokok' => 3_000_000],
            'jatuh_tempo_terdekat' => '2026-10-31',
        ], $isi['piutang']);
        $this->assertSame(['aktif' => ['jumlah' => 1, 'sisa_pokok' => 7_500_000], 'jatuh_tempo_terdekat' => '2027-06-01'], $isi['utang']);
        $this->assertSame([
            'cakupan' => 'semua_pengajuan',
            'menunggu_review' => ['jumlah' => 1, 'nominal' => 250_000],
            'menunggu_dibayar' => ['jumlah' => 1, 'sisa' => 300_000],
        ], $isi['reimbursement']);
        $this->assertSame([
            'cakupan' => 'semua_pengajuan',
            'menunggu_review' => ['jumlah' => 1, 'nominal' => 1_200_000],
            'menunggu_pencairan' => ['jumlah' => 1, 'nominal' => 800_000],
        ], $isi['pengajuan_dana']);
        $this->assertSame([], $isi['tidak_ditampilkan']);

        $this->assertFalse(tenancy()->initialized, 'Koneksi harus kembali ke database pusat.');
        $this->assertSame(self::TEST_COMPANY, getPermissionsTeamId(), 'Team izin harus dipulihkan.');
    }

    public function test_ringkasan_keuangan_mengikuti_periode_yang_diminta(): void
    {
        $admin = $this->pengguna('admin');
        $this->siapkanDataRingkasan($admin);

        $isi = $this->isi($this->panggil($admin, RingkasanKeuangan::class, ['dari' => '2026-10-01', 'sampai' => '2026-10-31']));

        $this->assertSame(['dari' => '2026-10-01', 'sampai' => '2026-10-31'], $isi['periode']);
        $this->assertSame([
            'total_saldo' => 22_997_500,
            'jumlah_rekening' => 2,
            'uang_masuk' => 2_000_000,
            'uang_keluar' => 500_000,
            'arus_bersih' => 1_500_000,
        ], $isi['kas']);
        $this->assertSame(['total' => 2_000_000, 'pembayaran_invoice' => 2_000_000, 'per_kategori' => []], $isi['pemasukan']);
        $this->assertSame(['total' => 500_000, 'per_kategori' => ['ATK' => 500_000]], $isi['pengeluaran']);
        $this->assertSame(['jumlah' => 2, 'sisa' => 6_500_000], $isi['invoice']['belum_dibayar'], 'Posisi tagihan tidak terikat periode.');
    }

    public function test_ringkasan_keuangan_hanya_mengirim_bagian_yang_modulnya_boleh_dilihat(): void
    {
        $admin = $this->pengguna('admin');
        $terbatas = $this->pengguna('ringkas terbatas');
        $this->siapkanDataRingkasan($admin);
        $this->reimbursement($terbatas, 'pending', 150_000);

        $respons = $this->panggil($terbatas, RingkasanKeuangan::class)->assertDontSee('22997500');
        $isi = $this->isi($respons);

        foreach (['kas', 'pemasukan', 'pengeluaran', 'invoice', 'piutang', 'utang', 'pengajuan_dana'] as $bagian) {
            $this->assertArrayNotHasKey($bagian, $isi);
        }
        $this->assertSame(
            ['kas', 'pemasukan', 'pengeluaran', 'invoice', 'piutang', 'utang', 'pengajuan_dana'],
            array_column($isi['tidak_ditampilkan'], 'bagian'),
        );
        $this->assertSame(['bagian' => 'kas', 'butuh_izin' => 'view bank-accounts'], $isi['tidak_ditampilkan'][0]);

        // Tanpa izin menyetujui/membayar, aplikasi hanya menampilkan pengajuan milik sendiri.
        $this->assertSame([
            'cakupan' => 'pengajuan_saya',
            'menunggu_review' => ['jumlah' => 1, 'nominal' => 150_000],
            'menunggu_dibayar' => ['jumlah' => 0, 'sisa' => 0],
        ], $isi['reimbursement']);
    }

    public function test_ringkasan_keuangan_menolak_tanpa_izin_dashboard_atau_use_claude(): void
    {
        $this->panggil($this->pengguna('tanpa claude'), RingkasanKeuangan::class)->assertHasErrors(['view dashboard']);
        $this->panggil($this->pengguna('hanya claude'), RingkasanKeuangan::class)->assertHasErrors(['view dashboard']);
    }

    public function test_ringkasan_keuangan_menolak_tanggal_tidak_valid_dan_tetap_memulihkan_koneksi(): void
    {
        $admin = $this->pengguna('admin');

        $this->panggil($admin, RingkasanKeuangan::class, ['dari' => '2026-13-01'])->assertHasErrors(['YYYY-MM-DD']);
        $this->panggil($admin, RingkasanKeuangan::class, ['dari' => '2026-11-20', 'sampai' => '2026-11-01'])->assertHasErrors(['lebih awal']);
        // Hanya `sampai` yang lebih awal dari awal bulan bawaan: pesannya meminta kedua tanggal.
        $this->panggil($admin, RingkasanKeuangan::class, ['sampai' => '2026-10-31'])->assertHasErrors(['Kirim dari dan sampai bersama']);

        $this->assertFalse(tenancy()->initialized);
        $this->assertSame(self::TEST_COMPANY, getPermissionsTeamId());
    }

    // ── laba-rugi ──────────────────────────────────────────────────────

    public function test_laba_rugi_sama_dengan_laporan_halaman_laba_rugi(): void
    {
        $admin = $this->pengguna('admin');
        $this->siapkanDataLabaRugi();

        $isi = $this->isi($this->panggil($admin, LabaRugi::class, ['dari' => '2026-11-01', 'sampai' => '2026-11-30']));

        $this->assertSame([
            'periode' => ['dari' => '2026-11-01', 'sampai' => '2026-11-30'],
            // Dibayar 11.000.000 = PPN 1.000.000 (bukan pendapatan) + pendapatan 10.000.000; HPP tertutup penuh.
            'pendapatan' => ['dari_invoice' => 10_000_000, 'per_kategori' => ['Jasa Lain' => 1_500_000], 'total' => 11_500_000],
            'hpp' => ['dari_invoice' => 4_000_000, 'per_kategori' => [], 'total' => 4_000_000],
            'laba_kotor' => 7_500_000,
            'beban_operasional' => ['per_kategori' => ['ATK' => 600_000], 'total' => 600_000],
            'laba_usaha' => 6_900_000,
            'pendapatan_lain' => ['per_kategori' => ['Bunga Bank' => 50_000], 'total' => 50_000],
            'beban_lain' => ['per_kategori' => ['Bunga Pinjaman' => 200_000], 'total' => 200_000],
            'laba_sebelum_pajak' => 6_750_000,
            'pajak' => ['per_kategori' => ['PPh Badan' => 300_000], 'total' => 300_000],
            'laba_bersih' => 6_450_000,
            'ppn_keluaran_diterima' => 1_000_000,
            'belum_diklasifikasi' => [
                'pemasukan' => ['per_kategori' => [], 'total' => 0],
                'pengeluaran' => ['per_kategori' => ['Lain-lain' => 100_000], 'total' => 100_000],
            ],
        ], Arr::except($isi, ['perusahaan', 'peringatan']));
        $this->assertStringContainsString('belum final', $isi['peringatan']);
    }

    public function test_laba_rugi_bawaan_tahun_berjalan_dan_filter_periode(): void
    {
        $admin = $this->pengguna('admin');
        $this->siapkanDataLabaRugi();

        $bawaan = $this->isi($this->panggil($admin, LabaRugi::class));

        $this->assertSame(['dari' => '2026-01-01', 'sampai' => '2026-11-15'], $bawaan['periode']);
        $this->assertSame(['per_kategori' => ['ATK' => 1_599_000], 'total' => 1_599_000], $bawaan['beban_operasional']);
        $this->assertSame(5_451_000, $bawaan['laba_bersih']);
        $this->assertSame(
            app(ProfitLossService::class)->generate(Carbon::parse('2026-01-01')->startOfDay(), Carbon::parse('2026-11-15')->endOfDay())['net_profit'],
            $bawaan['laba_bersih'],
        );

        $januari = $this->isi($this->panggil($admin, LabaRugi::class, ['dari' => '2026-01-01', 'sampai' => '2026-01-31']));

        $this->assertSame(0, $januari['pendapatan']['total']);
        $this->assertSame(['per_kategori' => ['ATK' => 999_000], 'total' => 999_000], $januari['beban_operasional']);
        $this->assertSame(-999_000, $januari['laba_bersih']);
        $this->assertArrayNotHasKey('peringatan', $januari);
    }

    public function test_laba_rugi_menolak_tanpa_izin_dan_rentang_terbalik(): void
    {
        $this->panggil($this->pengguna('tanpa claude'), LabaRugi::class)->assertHasErrors(['view profit-loss']);
        $this->panggil($this->pengguna('hanya claude'), LabaRugi::class)->assertHasErrors(['view profit-loss']);
        $this->panggil($this->pengguna('admin'), LabaRugi::class, ['dari' => '2026-11-30', 'sampai' => '2026-11-01'])->assertHasErrors(['lebih awal']);
    }

    // ── mutasi-rekening ────────────────────────────────────────────────

    public function test_mutasi_rekening_menggabungkan_transaksi_dan_pembayaran_invoice(): void
    {
        $admin = $this->pengguna('admin');
        $data = $this->siapkanDataMutasi();

        $respons = $this->panggil($admin, MutasiRekening::class)
            ->assertDontSee('transaction-attachments')
            ->assertDontSee('/storage');
        $isi = $this->isi($respons);

        $this->assertSame(['dari' => '2026-11-01', 'sampai' => '2026-11-30'], $isi['periode']);
        $this->assertSame([], $isi['filter']);
        $this->assertSame(['awal' => 11_600_000, 'akhir' => 14_097_500], $isi['saldo_rekening']);
        $this->assertSame(['jumlah_baris' => 6, 'masuk' => 4_500_000, 'keluar' => 2_002_500, 'bersih' => 2_497_500], $isi['total']);
        $this->assertSame([
            'transfer' => ['jumlah_baris' => 2, 'masuk' => 1_000_000, 'keluar' => 1_002_500],
            'income' => ['jumlah_baris' => 1, 'masuk' => 2_000_000, 'keluar' => 0],
            'pembayaran_invoice' => ['jumlah_baris' => 1, 'masuk' => 1_500_000, 'keluar' => 0],
            'expense' => ['jumlah_baris' => 2, 'masuk' => 0, 'keluar' => 1_000_000],
        ], $isi['per_jenis']);
        $this->assertSame([1, 25, 1], [$isi['halaman'], $isi['per_halaman'], $isi['total_halaman']]);

        $this->assertSame([
            [
                'tanggal' => '2026-11-10', 'arah' => 'masuk', 'jumlah' => 1_500_000, 'rekening' => 'BCA · Operasional',
                'jenis' => 'pembayaran_invoice', 'invoice' => '007/INV/UJI/XI/2026', 'klien' => 'PT Klien Uji', 'referensi' => 'TRX-777',
            ],
            [
                'tanggal' => '2026-11-06', 'arah' => 'masuk', 'jumlah' => 1_000_000, 'rekening' => 'Mandiri · Cadangan',
                'jenis' => 'transfer', 'kategori' => 'Transfer → Pindah Dana', 'keterangan' => 'Transfer masuk - Isi kas',
                'referensi' => $data['referensi_transfer'], 'pasangan_rekening' => 'BCA · Operasional',
            ],
            [
                'tanggal' => '2026-11-06', 'arah' => 'keluar', 'jumlah' => 1_002_500, 'rekening' => 'BCA · Operasional',
                'jenis' => 'transfer', 'kategori' => 'Transfer → Pindah Dana', 'keterangan' => 'Transfer + Admin Fee - Isi kas',
                'referensi' => $data['referensi_transfer'], 'pasangan_rekening' => 'Mandiri · Cadangan', 'biaya_admin' => 2_500,
            ],
            [
                'tanggal' => '2026-11-05', 'arah' => 'keluar', 'jumlah' => 700_000, 'rekening' => 'BCA · Operasional',
                'jenis' => 'expense', 'kategori' => 'Beban Kantor → Listrik', 'keterangan' => 'Tagihan PLN', 'lampiran' => true,
            ],
            [
                'tanggal' => '2026-11-04', 'arah' => 'keluar', 'jumlah' => 300_000, 'rekening' => 'BCA · Operasional',
                'jenis' => 'expense', 'kategori' => 'Beban Kantor → ATK', 'keterangan' => 'Beli kertas',
            ],
            [
                'tanggal' => '2026-11-03', 'arah' => 'masuk', 'jumlah' => 2_000_000, 'rekening' => 'BCA · Operasional',
                'jenis' => 'income', 'kategori' => 'Pendapatan Jasa → Jasa Konsultasi', 'keterangan' => 'Honor proyek X', 'referensi' => 'HNR-01',
            ],
        ], $isi['mutasi']);
    }

    public function test_mutasi_rekening_filter_rekening_arah_kategori_dan_kata_kunci(): void
    {
        $admin = $this->pengguna('admin');
        $data = $this->siapkanDataMutasi();

        $bca = $this->isi($this->panggil($admin, MutasiRekening::class, ['rekening' => $data['bca']->id]));
        $this->assertSame(['rekening' => ['id' => $data['bca']->id, 'nama' => 'BCA · Operasional']], $bca['filter']);
        $this->assertSame(['jumlah_baris' => 5, 'masuk' => 3_500_000, 'keluar' => 2_002_500, 'bersih' => 1_497_500], $bca['total']);
        $this->assertSame(['awal' => 9_600_000, 'akhir' => 11_097_500], $bca['saldo_rekening']);
        $this->assertArrayNotHasKey('rekening', $bca['mutasi'][0], 'Nama rekening tidak diulang per baris bila sudah difilter.');

        $keluar = $this->isi($this->panggil($admin, MutasiRekening::class, ['arah' => 'keluar']));
        $this->assertSame(['jumlah_baris' => 3, 'masuk' => 0, 'keluar' => 2_002_500, 'bersih' => -2_002_500], $keluar['total']);
        $this->assertNotContains('pembayaran_invoice', array_column($keluar['mutasi'], 'jenis'));
        $this->assertSame(['awal' => 11_600_000, 'akhir' => 14_097_500], $keluar['saldo_rekening'], 'Saldo tidak ikut filter arah.');

        $beban = $this->isi($this->panggil($admin, MutasiRekening::class, ['kategori' => $data['beban_kantor']->id]));
        $this->assertSame(['id' => $data['beban_kantor']->id, 'label' => 'Beban Kantor', 'termasuk_sub_kategori' => true], $beban['filter']['kategori']);
        $this->assertSame(['jumlah_baris' => 2, 'masuk' => 0, 'keluar' => 1_000_000, 'bersih' => -1_000_000], $beban['total']);
        $this->assertSame(['Tagihan PLN', 'Beli kertas'], array_column($beban['mutasi'], 'keterangan'));

        $atk = $this->isi($this->panggil($admin, MutasiRekening::class, ['kategori' => $data['atk']->id, 'dari' => '2026-10-01']));
        $this->assertFalse($atk['filter']['kategori']['termasuk_sub_kategori']);
        $this->assertSame(['Beli kertas', 'Tinta printer'], array_column($atk['mutasi'], 'keterangan'));

        $klien = $this->isi($this->panggil($admin, MutasiRekening::class, ['kata_kunci' => 'Klien Uji']));
        $this->assertSame(['007/INV/UJI/XI/2026'], array_column($klien['mutasi'], 'invoice'));
        $this->assertSame(['jumlah_baris' => 1, 'masuk' => 1_500_000, 'keluar' => 0, 'bersih' => 1_500_000], $klien['total']);

        $pln = $this->isi($this->panggil($admin, MutasiRekening::class, ['kata_kunci' => 'pln']));
        $this->assertSame(['Tagihan PLN'], array_column($pln['mutasi'], 'keterangan'));

        $persen = $this->isi($this->panggil($admin, MutasiRekening::class, ['kata_kunci' => '%']));
        $this->assertSame(0, $persen['total']['jumlah_baris'], 'Wildcard LIKE dari kata kunci harus di-escape.');
    }

    public function test_mutasi_rekening_membagi_halaman_dan_total_mencakup_semua_hasil(): void
    {
        $admin = $this->pengguna('admin');
        $bca = $this->rekening('BCA', 'Operasional', 0);
        $atk = $this->kategori('ATK', 'expense', $this->kategori('Beban Kantor', 'expense'), 'opex');

        BankTransaction::factory()
            ->count(55)
            ->sequence(fn (Sequence $urutan) => ['transaction_date' => sprintf('2026-11-%02d', $urutan->index % 28 + 1)])
            ->create([
                'bank_account_id' => $bca->id,
                'transaction_type' => 'debit',
                'amount' => 10_000,
                'category_id' => $atk->id,
                'description' => 'Belanja kecil',
                'reference_number' => null,
            ]);

        $totalSemua = ['jumlah_baris' => 55, 'masuk' => 0, 'keluar' => 550_000, 'bersih' => -550_000];

        $halaman1 = $this->isi($this->panggil($admin, MutasiRekening::class, ['per_halaman' => 50]));
        $this->assertCount(50, $halaman1['mutasi']);
        $this->assertSame([1, 50, 2], [$halaman1['halaman'], $halaman1['per_halaman'], $halaman1['total_halaman']]);
        $this->assertSame($totalSemua, $halaman1['total']);
        $this->assertSame('2026-11-28', $halaman1['mutasi'][0]['tanggal']);

        $halaman2 = $this->isi($this->panggil($admin, MutasiRekening::class, ['per_halaman' => 50, 'halaman' => 2]));
        $this->assertCount(5, $halaman2['mutasi']);
        $this->assertSame($totalSemua, $halaman2['total']);
        $this->assertSame('2026-11-01', $halaman2['mutasi'][4]['tanggal']);

        $bawaan = $this->isi($this->panggil($admin, MutasiRekening::class));
        $this->assertCount(25, $bawaan['mutasi']);
        $this->assertSame([25, 3], [$bawaan['per_halaman'], $bawaan['total_halaman']]);

        $kelewat = $this->isi($this->panggil($admin, MutasiRekening::class, ['halaman' => 4]));
        $this->assertSame([], $kelewat['mutasi']);
        $this->assertStringContainsString('melebihi total_halaman', $kelewat['catatan']);
    }

    public function test_mutasi_rekening_menolak_argumen_tidak_valid(): void
    {
        $admin = $this->pengguna('admin');

        $this->panggil($admin, MutasiRekening::class, ['rekening' => 999_999])->assertHasErrors(['rekening-bank']);
        $this->panggil($admin, MutasiRekening::class, ['arah' => 'naik'])->assertHasErrors(['"masuk" atau "keluar"']);
        $this->panggil($admin, MutasiRekening::class, ['kategori' => 999_999])->assertHasErrors(['kategori-transaksi']);
        $this->panggil($admin, MutasiRekening::class, ['per_halaman' => 51])->assertHasErrors(['per_halaman']);
        $this->panggil($admin, MutasiRekening::class, ['dari' => '2026-11-31'])->assertHasErrors(['YYYY-MM-DD']);

        $this->assertFalse(tenancy()->initialized);
    }

    public function test_mutasi_rekening_menolak_tanpa_izin_rekening_atau_use_claude(): void
    {
        $this->panggil($this->pengguna('tanpa claude'), MutasiRekening::class)->assertHasErrors(['view bank-accounts']);
        $this->panggil($this->pengguna('hanya claude'), MutasiRekening::class)->assertHasErrors(['view bank-accounts']);
    }

    // ── kategori-transaksi ─────────────────────────────────────────────

    public function test_kategori_transaksi_mengembalikan_pohon(): void
    {
        $admin = $this->pengguna('admin');
        $kantor = $this->kategori('Beban Kantor', 'expense');
        $atk = $this->kategori('ATK', 'expense', $kantor, 'opex');
        $listrik = $this->kategori('Listrik', 'expense', $kantor);
        $pendapatan = $this->kategori('Pendapatan', 'income');
        $jasa = $this->kategori('Jasa', 'income', $pendapatan, 'revenue');
        $sistem = $this->kategori('Penerimaan Pinjaman', 'financing');
        $sistem->forceFill(['system_key' => 'FIN-LOAN-IN'])->save();

        $isi = $this->isi($this->panggil($admin, KategoriTransaksi::class));

        $this->assertSame([
            ['id' => $pendapatan->id, 'label' => 'Pendapatan', 'jenis' => 'income', 'sub' => [
                ['id' => $jasa->id, 'label' => 'Jasa', 'jenis' => 'income', 'grup_lr' => 'revenue'],
            ]],
            ['id' => $kantor->id, 'label' => 'Beban Kantor', 'jenis' => 'expense', 'sub' => [
                ['id' => $atk->id, 'label' => 'ATK', 'jenis' => 'expense', 'grup_lr' => 'opex'],
                ['id' => $listrik->id, 'label' => 'Listrik', 'jenis' => 'expense'],
            ]],
            ['id' => $sistem->id, 'label' => 'Penerimaan Pinjaman', 'jenis' => 'financing', 'kode_sistem' => 'FIN-LOAN-IN'],
        ], $isi['kategori']);
        $this->assertSame(6, $isi['jumlah_kategori']);
        // Sama dengan statistik halaman Kategori: income/expense tanpa grup L/R, induk ikut dihitung.
        $this->assertSame(3, $isi['belum_diklasifikasi']);
        $this->assertSame('Pengeluaran', $isi['arti_jenis']['expense']);
        $this->assertSame('Beban Operasional', $isi['arti_grup_lr']['opex']);
        $this->assertArrayNotHasKey('filter', $isi);
    }

    public function test_kategori_transaksi_filter_jenis_tetap_menunjukkan_letak_sub_kategori(): void
    {
        $admin = $this->pengguna('admin');
        $kantor = $this->kategori('Beban Kantor', 'expense');
        $this->kategori('ATK', 'expense', $kantor, 'opex');
        $pengembalian = $this->kategori('Pengembalian Dana', 'income', $kantor);
        $pendapatan = $this->kategori('Pendapatan', 'income');
        $jasa = $this->kategori('Jasa', 'income', $pendapatan, 'revenue');

        $isi = $this->isi($this->panggil($admin, KategoriTransaksi::class, ['jenis' => 'income']));

        $this->assertSame(['jenis' => 'income'], $isi['filter']);
        $this->assertSame([
            ['id' => $pendapatan->id, 'label' => 'Pendapatan', 'jenis' => 'income', 'sub' => [
                ['id' => $jasa->id, 'label' => 'Jasa', 'jenis' => 'income', 'grup_lr' => 'revenue'],
            ]],
            ['id' => $kantor->id, 'label' => 'Beban Kantor', 'jenis' => 'expense', 'sub' => [
                ['id' => $pengembalian->id, 'label' => 'Pengembalian Dana', 'jenis' => 'income'],
            ]],
        ], $isi['kategori']);
        $this->assertSame(4, $isi['jumlah_kategori']);
        $this->assertSame(2, $isi['belum_diklasifikasi']);

        $this->panggil($admin, KategoriTransaksi::class, ['jenis' => 'lainnya'])->assertHasErrors(['income, expense']);
    }

    public function test_kategori_transaksi_tidak_menghilangkan_kategori_berhierarki_rusak(): void
    {
        $admin = $this->pengguna('admin');
        $rusak = $this->kategori('Kategori Rusak', 'expense');
        $rusak->update(['parent_id' => $rusak->id]);
        $x = $this->kategori('Siklus X', 'expense');
        $y = $this->kategori('Siklus Y', 'expense', $x);
        $x->update(['parent_id' => $y->id]);

        $isi = $this->isi($this->panggil($admin, KategoriTransaksi::class));

        $this->assertSame([
            ['id' => $rusak->id, 'label' => 'Kategori Rusak', 'jenis' => 'expense'],
            ['id' => $x->id, 'label' => 'Siklus X', 'jenis' => 'expense', 'sub' => [
                ['id' => $y->id, 'label' => 'Siklus Y', 'jenis' => 'expense'],
            ]],
        ], $isi['kategori']);
        $this->assertSame(3, $isi['jumlah_kategori']);
    }

    public function test_kategori_transaksi_menolak_tanpa_izin_kategori_atau_use_claude(): void
    {
        $this->panggil($this->pengguna('tanpa claude'), KategoriTransaksi::class)->assertHasErrors(['view categories']);
        $this->panggil($this->pengguna('hanya claude'), KategoriTransaksi::class)->assertHasErrors(['view categories']);
    }

    // ── data uji ───────────────────────────────────────────────────────

    /**
     * Dua rekening, transaksi November (termasuk transfer dan pinjaman masuk) + satu debit Oktober,
     * invoice di berbagai status, piutang, pinjaman, reimbursement, dan pengajuan dana.
     */
    private function siapkanDataRingkasan(User $pemilik): void
    {
        $bca = $this->rekening('BCA', 'Operasional', 10_000_000);
        $mandiri = $this->rekening('Mandiri', 'Cadangan', 5_000_000);

        $sewa = $this->kategori('Sewa Ruang', 'income', $this->kategori('Pendapatan Lain-lain', 'income'), 'other_income');
        $kantor = $this->kategori('Beban Kantor', 'expense');
        $atk = $this->kategori('ATK', 'expense', $kantor, 'opex');
        $listrik = $this->kategori('Listrik', 'expense', $kantor, 'opex');
        $pindahDana = $this->kategori('Pindah Dana', 'transfer', $this->kategori('Transfer', 'transfer'));
        $pinjamanMasuk = $this->kategori('Penerimaan Pinjaman', 'financing');

        $this->transaksi($bca, 'credit', 2_000_000, '2026-11-03', $sewa);
        $this->transaksi($bca, 'debit', 300_000, '2026-11-04', $atk);
        $this->transaksi($bca, 'debit', 700_000, '2026-11-05', $listrik);
        $this->transfer($bca, $mandiri, 1_000_000, 2_500, '2026-11-06', $pindahDana);
        $this->transaksi($mandiri, 'credit', 4_000_000, '2026-11-07', $pinjamanMasuk);
        $this->transaksi($bca, 'debit', 500_000, '2026-10-20', $atk);

        $klien = Client::factory()->create(['name' => 'PT Klien Uji']);
        $sebagian = $this->invoice($klien, '001/INV/UJI/XI/2026', 5_000_000, 'partially_paid', '2026-11-30');
        $this->bayar($sebagian, $bca, 1_500_000, '2026-11-10');
        $this->invoice($klien, '002/INV/UJI/X/2026', 3_000_000, 'sent', '2026-11-01');
        $lunas = $this->invoice($klien, '003/INV/UJI/X/2026', 2_000_000, 'paid', '2026-10-15');
        $this->bayar($lunas, $mandiri, 2_000_000, '2026-10-05');
        $this->invoice($klien, null, 9_000_000, 'draft', '2026-11-20');

        $this->piutang('RCV-00001', 'active', 6_000_000, '2026-10-31', $pemilik, 1_000_000);
        $this->piutang('RCV-00002', 'active', 2_000_000, '2027-05-01', $pemilik);
        $this->piutang('RCV-00003', 'pending_approval', 3_000_000, '2027-06-01', $pemilik);
        $this->piutang('RCV-00004', 'paid_off', 1_000_000, '2026-08-01', $pemilik, 1_000_000);

        $this->pinjaman('LOAN-00001', 'active', 10_000_000, '2027-06-01', $bca, 2_500_000);
        $this->pinjaman('LOAN-00002', 'paid_off', 4_000_000, '2026-09-01', $bca, 4_000_000);

        $pemohonLain = User::factory()->create();
        $this->reimbursement($pemilik, 'pending', 250_000);
        $this->reimbursement($pemohonLain, 'approved', 400_000, 100_000);
        $this->reimbursement($pemohonLain, 'paid', 300_000, 300_000);

        $this->pengajuanDana($pemohonLain, '001/UJI/XI/2026', 'pending', 1_200_000);
        $this->pengajuanDana($pemohonLain, '002/UJI/XI/2026', 'approved', 800_000);
        $this->pengajuanDana($pemohonLain, '003/UJI/XI/2026', 'disbursed', 500_000);
    }

    /** Invoice ber-PPN lunas November + transaksi per grup Laba Rugi, satu belum diklasifikasi, satu pendanaan. */
    private function siapkanDataLabaRugi(): void
    {
        $bca = $this->rekening('BCA', 'Operasional', 0);
        $jasa = $this->kategori('Jasa Lain', 'income', null, 'revenue');
        $bungaBank = $this->kategori('Bunga Bank', 'income', null, 'other_income');
        $atk = $this->kategori('ATK', 'expense', null, 'opex');
        $bunga = $this->kategori('Bunga Pinjaman', 'expense', null, 'other_expense');
        $pph = $this->kategori('PPh Badan', 'expense', null, 'tax');
        $lainLain = $this->kategori('Lain-lain', 'expense');
        $pokok = $this->kategori('Pokok Pinjaman', 'financing');

        $klien = Client::factory()->create(['name' => 'PT Klien Uji']);
        $invoice = $this->invoice($klien, '010/INV/UJI/XI/2026', 11_000_000, 'paid', '2026-11-20', ['ppn_rate' => 10, 'ppn_amount' => 1_000_000]);
        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'client_id' => $klien->id,
            'quantity' => 1,
            'unit_price' => 10_000_000,
            'amount' => 10_000_000,
            'cogs_amount' => 4_000_000,
            'is_tax_deposit' => false,
        ]);
        $this->bayar($invoice, $bca, 11_000_000, '2026-11-10');

        $this->transaksi($bca, 'credit', 1_500_000, '2026-11-03', $jasa);
        $this->transaksi($bca, 'credit', 50_000, '2026-11-04', $bungaBank);
        $this->transaksi($bca, 'debit', 600_000, '2026-11-05', $atk);
        $this->transaksi($bca, 'debit', 200_000, '2026-11-06', $bunga);
        $this->transaksi($bca, 'debit', 300_000, '2026-11-07', $pph);
        $this->transaksi($bca, 'debit', 100_000, '2026-11-08', $lainLain);
        $this->transaksi($bca, 'debit', 5_000_000, '2026-11-09', $pokok);
        $this->transaksi($bca, 'debit', 999_000, '2026-01-15', $atk);
    }

    /**
     * BCA (saldo awal 10.000.000) & Mandiri (2.000.000): pemasukan, dua pengeluaran (satu berlampiran),
     * transfer BCA → Mandiri dengan biaya admin, satu debit Oktober, dan pembayaran invoice ke BCA.
     *
     * @return array{bca: BankAccount, mandiri: BankAccount, beban_kantor: TransactionCategory, atk: TransactionCategory, referensi_transfer: string}
     */
    private function siapkanDataMutasi(): array
    {
        $bca = $this->rekening('BCA', 'Operasional', 10_000_000);
        $mandiri = $this->rekening('Mandiri', 'Cadangan', 2_000_000);

        $konsultasi = $this->kategori('Jasa Konsultasi', 'income', $this->kategori('Pendapatan Jasa', 'income'), 'revenue');
        $kantor = $this->kategori('Beban Kantor', 'expense');
        $atk = $this->kategori('ATK', 'expense', $kantor, 'opex');
        $listrik = $this->kategori('Listrik', 'expense', $kantor, 'opex');
        $pindahDana = $this->kategori('Pindah Dana', 'transfer', $this->kategori('Transfer', 'transfer'));

        $this->transaksi($bca, 'credit', 2_000_000, '2026-11-03', $konsultasi, ['description' => 'Honor proyek X', 'reference_number' => 'HNR-01']);
        $this->transaksi($bca, 'debit', 300_000, '2026-11-04', $atk, ['description' => 'Beli kertas']);
        $this->transaksi($bca, 'debit', 700_000, '2026-11-05', $listrik, [
            'description' => 'Tagihan PLN',
            'attachment_path' => 'transaction-attachments/rahasia-pln.pdf',
            'attachment_name' => 'pln-november.pdf',
        ]);
        $referensi = $this->transfer($bca, $mandiri, 1_000_000, 2_500, '2026-11-06', $pindahDana);
        $this->transaksi($bca, 'debit', 400_000, '2026-10-20', $atk, ['description' => 'Tinta printer']);

        $klien = Client::factory()->create(['name' => 'PT Klien Uji']);
        $invoice = $this->invoice($klien, '007/INV/UJI/XI/2026', 1_500_000, 'paid', '2026-11-30');
        $this->bayar($invoice, $bca, 1_500_000, '2026-11-10', ['reference_number' => 'TRX-777']);

        return ['bca' => $bca, 'mandiri' => $mandiri, 'beban_kantor' => $kantor, 'atk' => $atk, 'referensi_transfer' => $referensi];
    }

    private function pengguna(string $peran): User
    {
        $user = User::factory()->create();
        $user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $user->assignRole($peran);

        return $user;
    }

    /**
     * @param  class-string  $alat
     * @param  array<string, mixed>  $argumen
     */
    private function panggil(User $user, string $alat, array $argumen = []): TestResponse
    {
        return KeuanganServer::actingAs($user)->tool($alat, ['perusahaan' => self::TEST_COMPANY, ...$argumen]);
    }

    /**
     * Isi JSON jawaban alat (Response::json → satu konten teks).
     *
     * @return array<string, mixed>
     */
    private function isi(TestResponse $respons): array
    {
        $respons->assertOk();
        $mentah = (fn (): array => $this->response->toArray())->call($respons);

        return json_decode($mentah['result']['content'][0]['text'], true, 512, JSON_THROW_ON_ERROR);
    }

    private function rekening(string $bank, string $nama, int $saldoAwal): BankAccount
    {
        return BankAccount::factory()->create(['bank_name' => $bank, 'account_name' => $nama, 'initial_balance' => $saldoAwal]);
    }

    private function kategori(string $label, string $jenis, ?TransactionCategory $induk = null, ?string $grupLr = null): TransactionCategory
    {
        return TransactionCategory::create(['label' => $label, 'type' => $jenis, 'parent_id' => $induk?->id, 'pl_group' => $grupLr]);
    }

    /**
     * @param  array<string, mixed>  $lain
     */
    private function transaksi(BankAccount $akun, string $tipe, int $jumlah, string $tanggal, ?TransactionCategory $kategori, array $lain = []): BankTransaction
    {
        return BankTransaction::factory()->create([
            'bank_account_id' => $akun->id,
            'transaction_type' => $tipe,
            'amount' => $jumlah,
            'transaction_date' => $tanggal,
            'category_id' => $kategori?->id,
            'description' => 'Transaksi uji',
            'reference_number' => null,
            ...$lain,
        ]);
    }

    /** Dua kaki transfer seperti BankTransactionController::transfer(); mengembalikan nomor referensinya. */
    private function transfer(BankAccount $asal, BankAccount $tujuan, int $jumlah, int $biayaAdmin, string $tanggal, TransactionCategory $kategori): string
    {
        $grup = (string) Str::ulid();
        $referensi = 'TRF'.str_replace('-', '', $tanggal).'-'.substr($grup, -6);

        $this->transaksi($asal, 'debit', $jumlah + $biayaAdmin, $tanggal, $kategori, [
            'description' => 'Transfer + Admin Fee - Isi kas', 'reference_number' => $referensi, 'transfer_group_id' => $grup,
        ]);
        $this->transaksi($tujuan, 'credit', $jumlah, $tanggal, $kategori, [
            'description' => 'Transfer masuk - Isi kas', 'reference_number' => $referensi, 'transfer_group_id' => $grup,
        ]);

        return $referensi;
    }

    /**
     * @param  array<string, mixed>  $lain
     */
    private function invoice(Client $klien, ?string $nomor, int $total, string $status, string $jatuhTempo, array $lain = []): Invoice
    {
        return Invoice::factory()->create([
            'invoice_number' => $nomor,
            'billed_to_id' => $klien->id,
            'total_amount' => $total,
            'status' => $status,
            'issue_date' => '2026-10-01',
            'due_date' => $jatuhTempo,
            ...$lain,
        ]);
    }

    /**
     * @param  array<string, mixed>  $lain
     */
    private function bayar(Invoice $invoice, BankAccount $akun, int $jumlah, string $tanggal, array $lain = []): Payment
    {
        return Payment::factory()->create([
            'invoice_id' => $invoice->id,
            'bank_account_id' => $akun->id,
            'amount' => $jumlah,
            'payment_date' => $tanggal,
            'reference_number' => null,
            ...$lain,
        ]);
    }

    private function piutang(string $nomor, string $status, int $pokok, string $jatuhTempo, User $debitur, int $pokokDibayar = 0): Receivable
    {
        $piutang = Receivable::create([
            'receivable_number' => $nomor,
            'type' => 'employee_loan',
            'debtor_type' => User::class,
            'debtor_id' => $debitur->id,
            'principal_amount' => $pokok,
            'interest_rate' => 0,
            'installment_months' => 6,
            'installment_amount' => intdiv($pokok, 6),
            'loan_date' => '2026-05-01',
            'due_date' => $jatuhTempo,
            'status' => $status,
            'purpose' => 'Kasbon uji',
            'disbursement_account' => 'BCA 1234567890',
        ]);

        if ($pokokDibayar > 0) {
            ReceivablePayment::create([
                'receivable_id' => $piutang->id,
                'payment_date' => '2026-09-01',
                'principal_paid' => $pokokDibayar,
                'interest_paid' => 0,
                'total_paid' => $pokokDibayar,
                'payment_method' => 'cash',
            ]);
        }

        return $piutang;
    }

    private function pinjaman(string $nomor, string $status, int $pokok, string $jatuhTempo, BankAccount $akun, int $pokokDibayar = 0): Loan
    {
        $pinjaman = Loan::create([
            'loan_number' => $nomor,
            'lender_name' => 'Bank Pemberi Uji',
            'principal_amount' => $pokok,
            'interest_type' => 'fixed',
            'interest_amount' => 0,
            'term_months' => 12,
            'start_date' => '2026-06-01',
            'maturity_date' => $jatuhTempo,
            'status' => $status,
        ]);

        if ($pokokDibayar > 0) {
            LoanPayment::create([
                'loan_id' => $pinjaman->id,
                'bank_account_id' => $akun->id,
                'payment_date' => '2026-10-01',
                'principal_paid' => $pokokDibayar,
                'interest_paid' => 0,
                'total_paid' => $pokokDibayar,
            ]);
        }

        return $pinjaman;
    }

    private function reimbursement(User $pemohon, string $status, int $jumlah, int $dibayar = 0): Reimbursement
    {
        return Reimbursement::create([
            'user_id' => $pemohon->id,
            'title' => 'Reimburse uji',
            'amount' => $jumlah,
            'amount_paid' => $dibayar,
            'expense_date' => '2026-11-02',
            'category_input' => 'transport',
            'status' => $status,
            'payment_status' => $dibayar === 0 ? 'unpaid' : ($dibayar >= $jumlah ? 'paid' : 'partial'),
        ]);
    }

    private function pengajuanDana(User $pemohon, string $nomor, string $status, int $total): FundRequest
    {
        return FundRequest::create([
            'request_number' => $nomor,
            'user_id' => $pemohon->id,
            'title' => 'Pengajuan uji',
            'purpose' => 'Operasional kantor',
            'total_amount' => $total,
            'priority' => 'medium',
            'needed_by_date' => '2026-11-20',
            'status' => $status,
        ]);
    }
}
