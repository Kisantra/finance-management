<?php

namespace Tests\Feature\Mcp;

use App\Mcp\Servers\KeuanganServer;
use App\Mcp\Tools\DaftarInvoice;
use App\Mcp\Tools\DaftarKlien;
use App\Mcp\Tools\DaftarLayanan;
use App\Mcp\Tools\DetailInvoice;
use App\Mcp\Tools\InvoiceBerulang;
use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\RecurringInvoice;
use App\Models\RecurringTemplate;
use App\Models\Service;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Server\Testing\TestResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Alat MCP modul penjualan: daftar-invoice, detail-invoice, daftar-klien, daftar-layanan,
 * invoice-berulang. "Hari ini" dipatok 2026-11-05 agar hitungan lewat tempo & siklus pasti.
 */
class AlatPenjualanTest extends TestCase
{
    use RefreshDatabase;

    private const IZIN_MODUL = ['view invoices', 'view clients', 'view services', 'view recurring-invoices'];

    private User $admin;

    /** Memegang semua izin modul tetapi tanpa `use claude`. */
    private User $staf;

    /** Memegang `use claude` tetapi tanpa izin modul apa pun. */
    private User $pengamat;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(Carbon::parse('2026-11-05 10:00:00'));

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        setPermissionsTeamId(null);
        foreach (['use claude', ...self::IZIN_MODUL] as $izin) {
            Permission::firstOrCreate(['name' => $izin]);
        }
        Role::firstOrCreate(['name' => 'admin'])->givePermissionTo(['use claude', ...self::IZIN_MODUL]);
        Role::firstOrCreate(['name' => 'staff'])->givePermissionTo(self::IZIN_MODUL);
        Role::firstOrCreate(['name' => 'pengamat'])->givePermissionTo('use claude');
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->admin = $this->anggota('admin');
        $this->staf = $this->anggota('staff');
        $this->pengamat = $this->anggota('pengamat');

        $this->rekening = BankAccount::factory()->create(['account_name' => 'Operasional Uji', 'bank_name' => 'Bank Mandiri']);
    }

    // ── Akses ────────────────────────────────────────────────────────────────

    public function test_semua_alat_menolak_tanpa_use_claude_atau_tanpa_izin_modul(): void
    {
        $klien = Client::factory()->create(['name' => 'PT Rahasia Uji']);
        $invoice = $this->invoice($klien, ['invoice_number' => 'RAHASIA-001']);

        $alatDanIzin = [
            DaftarInvoice::class => 'view invoices',
            DetailInvoice::class => 'view invoices',
            DaftarKlien::class => 'view clients',
            DaftarLayanan::class => 'view services',
            InvoiceBerulang::class => 'view recurring-invoices',
        ];

        foreach ($alatDanIzin as $alat => $izin) {
            foreach ([$this->staf, $this->pengamat] as $user) {
                $this->panggil($alat, ['id' => $invoice->id], $user)
                    ->assertHasErrors([$izin])
                    ->assertDontSee('PT Rahasia Uji')
                    ->assertDontSee('RAHASIA-001');
            }

            $this->assertTrue((new $alat)->annotations()['readOnlyHint'] ?? false, "{$alat} harus mengumumkan diri hanya membaca.");
        }

        $this->assertFalse(tenancy()->initialized);
    }

    // ── daftar-invoice ───────────────────────────────────────────────────────

    public function test_daftar_invoice_dibayar_dan_sisa_sama_dengan_accessor_invoice(): void
    {
        $klien = Client::factory()->create(['name' => 'PT Sinar Uji']);
        $sebagian = $this->invoice($klien, ['invoice_number' => '001/INV/UJI/X/2026', 'total_amount' => 1_000_000, 'status' => 'partially_paid'], [300_000, 200_000]);
        $lunas = $this->invoice($klien, ['invoice_number' => '002/INV/UJI/X/2026', 'total_amount' => 500_000, 'status' => 'paid', 'due_date' => '2026-12-01'], [500_000]);
        $draft = $this->invoice($klien, ['invoice_number' => null, 'total_amount' => 750_000, 'status' => 'draft']);

        $isi = $this->isi($this->panggil(DaftarInvoice::class));
        $baris = collect($isi['invoice'])->keyBy('id');

        $this->assertSame([
            'id' => $sebagian->id,
            'nomor' => '001/INV/UJI/X/2026',
            'klien_id' => $klien->id,
            'klien' => 'PT Sinar Uji',
            'terbit' => '2026-10-01',
            'jatuh_tempo' => '2026-10-31',
            'total' => 1_000_000,
            'dibayar' => 500_000,
            'sisa' => 500_000,
            'status' => 'partially_paid',
            'status_label' => 'Dibayar sebagian',
            'hari_lewat_tempo' => 5,
        ], $baris[$sebagian->id]);

        // Angka sama persis dengan accessor model yang dipakai drawer invoice.
        foreach ([$sebagian, $lunas, $draft] as $invoice) {
            $invoice->refresh();
            $this->assertSame($invoice->amount_paid, $baris[$invoice->id]['dibayar']);
            $this->assertSame($invoice->amount_remaining, $baris[$invoice->id]['sisa']);
        }
        $this->assertNull($baris[$draft->id]['nomor']);
        $this->assertSame(0, $baris[$draft->id]['hari_lewat_tempo']);

        $this->assertSame([
            'jumlah' => 3,
            'total' => 2_250_000,
            'dibayar' => 1_000_000,
            'sisa' => 1_250_000,
            'belum_dibayar' => 500_000,
            'lewat_tempo' => ['jumlah' => 1, 'sisa' => 500_000],
            'draft' => ['jumlah' => 1, 'total' => 750_000],
        ], $isi['ringkasan']);
    }

    public function test_daftar_invoice_filter_lewat_tempo_klien_tanggal_dan_urutan(): void
    {
        $abadi = Client::factory()->create(['name' => 'CV Abadi Uji']);
        $lain = Client::factory()->create(['name' => 'PT Lain Uji']);
        $this->invoice($abadi, ['invoice_number' => 'TELAT-1', 'total_amount' => 400_000, 'due_date' => '2026-10-26'], [100_000]);
        $this->invoice($abadi, ['invoice_number' => 'BELUM-1', 'total_amount' => 900_000, 'issue_date' => '2026-10-20', 'due_date' => '2026-11-20']);
        $this->invoice($lain, ['invoice_number' => 'LUNAS-1', 'total_amount' => 300_000, 'status' => 'paid', 'due_date' => '2026-10-02'], [300_000]);

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['lewat_tempo' => true]));
        $this->assertSame(['TELAT-1'], array_column($isi['invoice'], 'nomor'));
        $this->assertSame(10, $isi['invoice'][0]['hari_lewat_tempo']);
        $this->assertSame(['jumlah' => 1, 'sisa' => 300_000], $isi['ringkasan']['lewat_tempo']);

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['lewat_tempo' => false, 'urut' => 'total_terbesar']));
        $this->assertSame(['BELUM-1', 'LUNAS-1'], array_column($isi['invoice'], 'nomor'));

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['klien' => 'abadi', 'urut' => 'sisa_terbesar']));
        $this->assertSame(['BELUM-1', 'TELAT-1'], array_column($isi['invoice'], 'nomor'));

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['klien' => (string) $lain->id]));
        $this->assertSame(['LUNAS-1'], array_column($isi['invoice'], 'nomor'));

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['klien' => $lain->id]));
        $this->assertSame(['LUNAS-1'], array_column($isi['invoice'], 'nomor'));

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['dari' => '2026-10-15', 'sampai' => '2026-10-31']));
        $this->assertSame(['BELUM-1'], array_column($isi['invoice'], 'nomor'));

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['kata_kunci' => 'lunas', 'status' => 'paid']));
        $this->assertSame(['LUNAS-1'], array_column($isi['invoice'], 'nomor'));
        $this->assertSame(['status' => 'paid', 'kata_kunci' => 'lunas', 'urut' => 'terbaru'], $isi['filter']);
    }

    public function test_daftar_invoice_paginasi_dan_ringkasan_mencakup_seluruh_hasil_filter(): void
    {
        $klien = Client::factory()->create();
        Invoice::factory()->count(23)
            ->sequence(fn (Sequence $urutan) => [
                'invoice_number' => sprintf('PAG-%02d', $urutan->index + 1),
                'issue_date' => Carbon::parse('2026-09-01')->addDays($urutan->index)->toDateString(),
            ])
            ->create([
                'billed_to_id' => $klien->id,
                'subtotal' => 100_000,
                'total_amount' => 100_000,
                'due_date' => '2026-12-31',
                'status' => 'sent',
            ]);

        $isi = $this->isi($this->panggil(DaftarInvoice::class, ['per_halaman' => 10, 'halaman' => 3]));

        $this->assertSame(['PAG-03', 'PAG-02', 'PAG-01'], array_column($isi['invoice'], 'nomor'));
        $this->assertSame(3, $isi['halaman']);
        $this->assertSame(10, $isi['per_halaman']);
        $this->assertSame(3, $isi['total_halaman']);
        $this->assertSame(23, $isi['ringkasan']['jumlah']);
        $this->assertSame(2_300_000, $isi['ringkasan']['total']);
        $this->assertSame(2_300_000, $isi['ringkasan']['belum_dibayar']);
    }

    public function test_daftar_invoice_menolak_argumen_tidak_sah_dengan_pesan_yang_bisa_ditindaklanjuti(): void
    {
        $this->panggil(DaftarInvoice::class, ['status' => 'overdue'])->assertHasErrors(['lewat_tempo=true']);
        $this->panggil(DaftarInvoice::class, ['dari' => '01-10-2026'])->assertHasErrors(['YYYY-MM-DD']);
        $this->panggil(DaftarInvoice::class, ['dari' => '2026-10-31', 'sampai' => '2026-10-01'])->assertHasErrors(['tidak boleh lebih awal']);
        $this->panggil(DaftarInvoice::class, ['per_halaman' => 51])->assertHasErrors(['1–50']);
        $this->panggil(DaftarInvoice::class, ['urut' => 'acak'])->assertHasErrors(['sisa_terbesar']);
        $this->panggil(DaftarInvoice::class, ['klien' => ['x']])->assertHasErrors(['klien harus berupa teks']);

        $this->assertFalse(tenancy()->initialized, 'Koneksi harus kembali ke pusat walau validasi gagal di dalam alat.');
        $this->assertSame(self::TEST_COMPANY, getPermissionsTeamId());
    }

    // ── detail-invoice ───────────────────────────────────────────────────────

    public function test_detail_invoice_memuat_item_pajak_pembayaran_dan_laba_seperti_drawer(): void
    {
        $klien = Client::factory()->company()->create(['name' => 'PT Detail Uji', 'NPWP' => '01.234.567.8-901.000']);
        $cabang = Client::factory()->create(['name' => 'CV Cabang Uji']);

        // Subtotal 1.500.000 (termasuk titipan 200.000), diskon 100.000,
        // DPP = 1.500.000 − 200.000 − 100.000 = 1.200.000, PPN 11% = 132.000.
        $invoice = $this->invoice($klien, [
            'invoice_number' => '007/INV/UJI/X/2026',
            'subtotal' => 1_500_000,
            'discount_type' => 'fixed',
            'discount_value' => 100_000,
            'discount_amount' => 100_000,
            'discount_reason' => 'Pelanggan lama',
            'ppn_rate' => 11,
            'ppn_amount' => 132_000,
            'total_amount' => 1_532_000,
            'status' => 'partially_paid',
            'faktur' => '010.000-26.00000001',
        ]);
        $this->item($invoice, $klien, ['service_name' => 'Jasa Konsultasi', 'quantity' => 2, 'unit' => 'jam', 'unit_price' => 500_000, 'amount' => 1_000_000, 'cogs_amount' => 400_000]);
        $this->item($invoice, $cabang, ['service_name' => 'Jasa Cabang', 'quantity' => 1.5, 'unit' => 'paket', 'unit_price' => 200_000, 'amount' => 300_000, 'cogs_amount' => 100_000]);
        $this->item($invoice, $klien, ['service_name' => 'Titipan PPh 23', 'quantity' => 1, 'unit' => 'dokumen', 'unit_price' => 200_000, 'amount' => 200_000, 'cogs_amount' => 0, 'is_tax_deposit' => true]);
        Payment::factory()->create([
            'invoice_id' => $invoice->id, 'bank_account_id' => $this->rekening->id, 'amount' => 600_000,
            'payment_date' => '2026-10-10', 'payment_method' => 'bank_transfer', 'reference_number' => 'TRX-1',
            'attachment_path' => 'payments/berkas-rahasia-123.pdf', 'attachment_name' => 'bukti-transfer.pdf',
        ]);
        Payment::factory()->create([
            'invoice_id' => $invoice->id, 'bank_account_id' => $this->rekening->id, 'amount' => 400_000,
            'payment_date' => '2026-10-20', 'payment_method' => 'cash', 'reference_number' => null,
        ]);

        $respons = $this->panggil(DetailInvoice::class, ['nomor' => '007/INV/UJI/X/2026']);
        $isi = $this->isi($respons);

        $this->assertSame([
            'id' => $invoice->id,
            'nomor' => '007/INV/UJI/X/2026',
            'status' => 'partially_paid',
            'status_label' => 'Dibayar sebagian',
            'terbit' => '2026-10-01',
            'jatuh_tempo' => '2026-10-31',
            'hari_lewat_tempo' => 5,
            'faktur_pajak' => '010.000-26.00000001',
        ], $isi['invoice']);
        $this->assertSame('PT Detail Uji', $isi['klien']['nama']);
        $this->assertSame('01.234.567.8-901.000', $isi['klien']['npwp']);

        $this->assertSame(['Jasa Konsultasi', 'Jasa Cabang', 'Titipan PPh 23'], array_column($isi['item'], 'layanan'));
        $this->assertSame(['layanan' => 'Jasa Cabang', 'atas_nama' => 'CV Cabang Uji', 'qty' => 1.5, 'satuan' => 'paket', 'harga_satuan' => 200_000, 'jumlah' => 300_000, 'hpp' => 100_000, 'titipan_pajak' => false], $isi['item'][1]);
        $this->assertArrayNotHasKey('atas_nama', $isi['item'][0]);
        $this->assertTrue($isi['item'][2]['titipan_pajak']);

        $invoice->load(['items', 'payments']);
        $this->assertSame([
            'subtotal' => 1_500_000,
            'diskon' => ['jenis' => 'fixed', 'nilai' => 100_000, 'jumlah' => 100_000, 'alasan' => 'Pelanggan lama'],
            'titipan_pajak' => 200_000,
            'dpp' => $invoice->dpp_amount,
            // JSON tanpa JSON_PRESERVE_ZERO_FRACTION: 11.0 terkirim sebagai 11.
            'ppn_tarif' => 11,
            'ppn' => 132_000,
            'total' => 1_532_000,
            'dibayar' => $invoice->amount_paid,
            'sisa' => $invoice->amount_remaining,
        ], $isi['nilai']);
        $this->assertSame(1_200_000, $isi['nilai']['dpp']);
        $this->assertSame(532_000, $isi['nilai']['sisa']);

        // Seperti drawer: pendapatan tanpa PPN & titipan, HPP tanpa baris titipan.
        $this->assertSame(['pendapatan' => 1_200_000, 'hpp' => 500_000, 'laba_kotor' => 700_000], $isi['laba']);

        $this->assertSame([
            ['tanggal' => '2026-10-10', 'jumlah' => 600_000, 'rekening' => 'Operasional Uji (Bank Mandiri)', 'metode' => 'Transfer bank', 'referensi' => 'TRX-1', 'lampiran' => 'bukti-transfer.pdf'],
            ['tanggal' => '2026-10-20', 'jumlah' => 400_000, 'rekening' => 'Operasional Uji (Bank Mandiri)', 'metode' => 'Tunai', 'referensi' => null, 'lampiran' => null],
        ], $isi['pembayaran']);

        // Path & URL lampiran tidak pernah ikut terkirim.
        $respons->assertDontSee('berkas-rahasia-123')->assertDontSee('storage');
    }

    public function test_detail_invoice_draft_lewat_id_dan_pesan_kesalahan(): void
    {
        $klien = Client::factory()->create();
        $draft = $this->invoice($klien, ['invoice_number' => null, 'status' => 'draft', 'total_amount' => 250_000]);

        $isi = $this->isi($this->panggil(DetailInvoice::class, ['id' => $draft->id]));
        $this->assertNull($isi['invoice']['nomor']);
        $this->assertSame('Draft', $isi['invoice']['status_label']);
        $this->assertSame(0, $isi['invoice']['hari_lewat_tempo']);
        $this->assertSame(250_000, $isi['nilai']['sisa']);
        $this->assertNull($isi['nilai']['diskon']);
        $this->assertSame([], $isi['pembayaran']);

        $this->panggil(DetailInvoice::class)->assertHasErrors(['Isi nomor']);
        $this->panggil(DetailInvoice::class, ['nomor' => 'X', 'id' => $draft->id])->assertHasErrors(['salah satu saja']);
        $this->panggil(DetailInvoice::class, ['nomor' => 'TIDAK-ADA'])->assertHasErrors(['tidak ada di perusahaan ini', 'daftar-invoice']);
        $this->panggil(DetailInvoice::class, ['id' => 999999])->assertHasErrors(['id 999999 tidak ada']);

        $this->assertFalse(tenancy()->initialized, 'Koneksi harus kembali ke pusat walau invoice tidak ditemukan.');
    }

    // ── daftar-klien ─────────────────────────────────────────────────────────

    public function test_daftar_klien_rekap_tagihan_memakai_pembayaran_nyata(): void
    {
        $andalan = Client::factory()->company()->create([
            'name' => 'PT Andalan Uji', 'NPWP' => '11.111.111.1-111.000', 'EFIN' => '9876543210',
            'person_in_charge' => 'Budi Uji', 'email' => 'andalan@uji.test',
        ]);
        $bijak = Client::factory()->individual()->create(['name' => 'Bijak Santoso Uji', 'EFIN' => '1234509876']);
        Client::factory()->inactive()->create(['name' => 'PT Cermat Uji']);

        $this->invoice($andalan, ['total_amount' => 1_000_000, 'status' => 'partially_paid', 'due_date' => '2026-10-20'], [400_000]);
        $this->invoice($andalan, ['total_amount' => 500_000, 'status' => 'sent', 'due_date' => '2026-11-30']);
        $this->invoice($andalan, ['invoice_number' => null, 'total_amount' => 750_000, 'status' => 'draft']);
        $this->invoice($bijak, ['total_amount' => 300_000, 'status' => 'paid'], [300_000]);

        $respons = $this->panggil(DaftarKlien::class);
        $isi = $this->isi($respons);
        $baris = collect($isi['klien'])->keyBy('nama');

        $this->assertSame(['Bijak Santoso Uji', 'PT Andalan Uji', 'PT Cermat Uji'], array_column($isi['klien'], 'nama'));
        $this->assertSame([
            'id' => $andalan->id,
            'nama' => 'PT Andalan Uji',
            'jenis' => 'company',
            'status' => 'Active',
            'status_label' => 'Aktif',
            'npwp' => '11.111.111.1-111.000',
            'pic' => 'Budi Uji',
            'email' => 'andalan@uji.test',
            'invoice_terbit' => 2,
            'ditagih' => 1_500_000,
            'dibayar' => 400_000,
            'sisa' => 1_100_000,
            'sisa_lewat_tempo' => 600_000,
            'draft' => ['jumlah' => 1, 'nilai' => 750_000],
        ], $baris['PT Andalan Uji']);
        $this->assertSame([300_000, 300_000, 0], [$baris['Bijak Santoso Uji']['ditagih'], $baris['Bijak Santoso Uji']['dibayar'], $baris['Bijak Santoso Uji']['sisa']]);
        $this->assertSame([0, 0, 'Tidak aktif'], [$baris['PT Cermat Uji']['ditagih'], $baris['PT Cermat Uji']['invoice_terbit'], $baris['PT Cermat Uji']['status_label']]);

        $this->assertSame([
            'jumlah_klien' => 3,
            'ditagih' => 1_800_000,
            'dibayar' => 700_000,
            'sisa' => 1_100_000,
            'sisa_lewat_tempo' => 600_000,
            'draft_nilai' => 750_000,
        ], $isi['ringkasan']);

        // EFIN (kunci pendaftaran e-filing pajak) tidak pernah dikirim.
        $respons->assertDontSee('9876543210')->assertDontSee('1234509876');

        $isi = $this->isi($this->panggil(DaftarKlien::class, ['ada_sisa' => true, 'urut' => 'sisa_terbesar']));
        $this->assertSame(['PT Andalan Uji'], array_column($isi['klien'], 'nama'));

        $isi = $this->isi($this->panggil(DaftarKlien::class, ['urut' => 'ditagih_terbesar', 'status' => 'Active']));
        $this->assertSame(['PT Andalan Uji', 'Bijak Santoso Uji'], array_column($isi['klien'], 'nama'));

        $isi = $this->isi($this->panggil(DaftarKlien::class, ['kata_kunci' => 'bijak', 'jenis' => 'individual']));
        $this->assertSame(['Bijak Santoso Uji'], array_column($isi['klien'], 'nama'));
        $this->assertSame(1, $isi['ringkasan']['jumlah_klien']);
    }

    public function test_daftar_klien_paginasi_dan_validasi(): void
    {
        Client::factory()->count(12)
            ->sequence(fn (Sequence $urutan) => ['name' => sprintf('Klien Uji %02d', $urutan->index + 1)])
            ->create();

        $isi = $this->isi($this->panggil(DaftarKlien::class, ['per_halaman' => 5, 'halaman' => 3]));
        $this->assertSame(['Klien Uji 11', 'Klien Uji 12'], array_column($isi['klien'], 'nama'));
        $this->assertSame(3, $isi['total_halaman']);
        $this->assertSame(12, $isi['ringkasan']['jumlah_klien']);

        $this->panggil(DaftarKlien::class, ['jenis' => 'pt'])->assertHasErrors(['individual atau company']);
        $this->panggil(DaftarKlien::class, ['halaman' => 0])->assertHasErrors(['mulai 1']);
    }

    // ── daftar-layanan ───────────────────────────────────────────────────────

    public function test_daftar_layanan_harga_filter_dan_ringkasan_katalog(): void
    {
        Service::factory()->create(['name' => 'Pelaporan SPT Tahunan', 'type' => 'Administrasi Perpajakan', 'price' => 1_500_000]);
        Service::factory()->create(['name' => 'Pengurusan NIB', 'type' => 'Perizinan', 'price' => 2_500_000]);
        Service::factory()->create(['name' => 'Kelola Instagram', 'type' => 'Digital Marketing', 'price' => 1_000_000]);

        $isi = $this->isi($this->panggil(DaftarLayanan::class));
        $this->assertSame(['Kelola Instagram', 'Pelaporan SPT Tahunan', 'Pengurusan NIB'], array_column($isi['layanan'], 'nama'));
        $this->assertSame(['id', 'nama', 'jenis', 'harga', 'dibuat'], array_keys($isi['layanan'][0]));
        $this->assertSame(2_500_000, $isi['layanan'][2]['harga']);
        $this->assertSame('2026-11-05', $isi['layanan'][2]['dibuat']);
        $this->assertSame(3, $isi['ringkasan_katalog']['jumlah']);
        $this->assertSame(1_666_666, $isi['ringkasan_katalog']['harga_rata_rata']);
        $this->assertSame(2_500_000, $isi['ringkasan_katalog']['harga_tertinggi']);
        $perJenis = $isi['ringkasan_katalog']['per_jenis'];
        ksort($perJenis);
        $this->assertSame(['Administrasi Perpajakan' => 1, 'Digital Marketing' => 1, 'Perizinan' => 1], $perJenis);

        $isi = $this->isi($this->panggil(DaftarLayanan::class, ['jenis' => 'Perizinan']));
        $this->assertSame(['Pengurusan NIB'], array_column($isi['layanan'], 'nama'));
        $this->assertSame(1, $isi['jumlah']);
        $this->assertSame(3, $isi['ringkasan_katalog']['jumlah'], 'Ringkasan katalog tidak ikut filter, sama dengan halaman Layanan.');

        $isi = $this->isi($this->panggil(DaftarLayanan::class, ['kata_kunci' => 'p', 'per_halaman' => 1, 'halaman' => 2]));
        $this->assertSame(['Pengurusan NIB'], array_column($isi['layanan'], 'nama'));
        $this->assertSame(2, $isi['total_halaman']);

        $this->panggil(DaftarLayanan::class, ['jenis' => 'Lainnya'])->assertHasErrors(['jenis harus salah satu dari']);
    }

    // ── invoice-berulang ─────────────────────────────────────────────────────

    public function test_invoice_berulang_template_menunjukkan_siklus_progres_dan_bulan_berikutnya(): void
    {
        [$aktif] = $this->dataBerulang();

        $isi = $this->isi($this->panggil(InvoiceBerulang::class));
        $baris = collect($isi['template'])->keyBy('nama');

        $this->assertSame('template', $isi['tampilan']);
        $this->assertSame([
            'id' => $aktif->id,
            'nama' => 'Retainer Pajak Bulanan',
            'klien_id' => $aktif->client_id,
            'klien' => 'PT Langganan Uji',
            'frekuensi' => 'monthly',
            'frekuensi_label' => 'Bulanan',
            'status' => 'active',
            'status_label' => 'Aktif',
            'aktif' => true,
            'nilai' => 1_000_000,
            'titipan_pajak' => 150_000,
            'layanan' => ['Konsultasi Pajak Bulanan', 'Titipan PPh 21'],
            'mulai' => '2026-07-15',
            'selesai' => '2026-12-31',
            // Siklus: Agu–Des 2026 (start_date + 1 bulan s.d. end_date).
            'siklus_total' => 5,
            'sudah_dibuat' => 2,
            'sudah_dipublish' => 1,
            'sisa_siklus' => 3,
            // Agu & Sep sudah dibuat; Oktober (sebelum bulan ini) terlewat.
            'bulan_berikutnya' => '2026-10',
            'bulan_terlewat' => 1,
        ], $baris['Retainer Pajak Bulanan']);

        $arsip = $baris['Kontrak Lama Triwulan'];
        $this->assertSame([false, 'Diarsipkan', 'Triwulanan', 3, null, 0], [
            $arsip['aktif'], $arsip['status_label'], $arsip['frekuensi_label'], $arsip['siklus_total'], $arsip['bulan_berikutnya'], $arsip['bulan_terlewat'],
        ]);

        $this->assertSame([
            'jumlah_template' => 2,
            'aktif' => 1,
            'nonaktif' => 0,
            'diarsipkan' => 1,
            'draft_belum_dipublish' => ['jumlah' => 1, 'nilai' => 1_000_000, 'bulan_tertua' => '2026-09'],
        ], $isi['ringkasan']);

        $isi = $this->isi($this->panggil(InvoiceBerulang::class, ['status_template' => 'archived']));
        $this->assertSame(['Kontrak Lama Triwulan'], array_column($isi['template'], 'nama'));
        $this->assertSame(1, $isi['jumlah']);
    }

    public function test_invoice_berulang_bulanan_menampilkan_status_draft_dan_invoice_hasil_publish(): void
    {
        [, $invoiceHasilPublish] = $this->dataBerulang();

        $isi = $this->isi($this->panggil(InvoiceBerulang::class, ['bulan' => '2026-08']));
        $this->assertSame('bulanan', $isi['tampilan']);
        $this->assertCount(1, $isi['invoice_berulang']);
        $baris = $isi['invoice_berulang'][0];
        $this->assertSame(['Retainer Pajak Bulanan', 'monthly', 'PT Langganan Uji', '2026-08-01', '2026-08-01', '2026-08-31', 1_000_000, 'published', 'Sudah dipublish'], [
            $baris['template'], $baris['frekuensi'], $baris['klien'], $baris['tanggal_jadwal'], $baris['terbit'], $baris['jatuh_tempo'], $baris['nilai'], $baris['status'], $baris['status_label'],
        ]);
        $this->assertSame(['id' => $invoiceHasilPublish->id, 'nomor' => null, 'status' => 'draft', 'status_label' => 'Draft'], $baris['invoice']);
        $this->assertSame([
            'jumlah' => 1,
            'nilai' => 1_000_000,
            'hpp' => 250_000,
            'laba' => 750_000,
            'draft' => ['jumlah' => 0, 'nilai' => 0],
            'dipublish' => ['jumlah' => 1, 'nilai' => 1_000_000],
        ], $isi['ringkasan_bulan']);

        // Filter status menyaring baris; statistik bulan tetap atas seluruh bulan (computeMonthlyStats).
        $isi = $this->isi($this->panggil(InvoiceBerulang::class, ['bulan' => '2026-09', 'status' => 'published']));
        $this->assertSame([], $isi['invoice_berulang']);
        $this->assertSame(['jumlah' => 1, 'nilai' => 1_000_000], $isi['ringkasan_bulan']['draft']);

        $isi = $this->isi($this->panggil(InvoiceBerulang::class, ['tampilan' => 'bulanan']));
        $this->assertSame('2026-11', $isi['bulan']);
        $this->assertSame([], $isi['invoice_berulang']);

        $this->panggil(InvoiceBerulang::class, ['bulan' => '2026-13'])->assertHasErrors(['YYYY-MM']);
        $this->panggil(InvoiceBerulang::class, ['tampilan' => 'grafik'])->assertHasErrors(['template atau bulanan']);
    }

    // ── Efisiensi ────────────────────────────────────────────────────────────

    public function test_jumlah_query_tetap_walau_jumlah_baris_bertambah(): void
    {
        $alat = [
            DaftarInvoice::class => [],
            DaftarKlien::class => [],
            InvoiceBerulang::class => [],
            DetailInvoice::class => ['nomor' => 'TETAP-001'],
        ];
        $hitung = function () use ($alat): array {
            $jumlah = [];
            foreach ($alat as $kelas => $argumen) {
                DB::flushQueryLog();
                DB::enableQueryLog();
                $this->panggil($kelas, $argumen)->assertOk();
                $jumlah[$kelas] = count(DB::getQueryLog());
                DB::disableQueryLog();
            }

            return $jumlah;
        };

        $klien = Client::factory()->create();
        $tetap = $this->invoice($klien, ['invoice_number' => 'TETAP-001'], [100_000]);
        $this->item($tetap, $klien, ['service_name' => 'Jasa A', 'amount' => 1_000_000, 'unit_price' => 1_000_000]);
        $this->dataBerulang();

        $hitung();
        $sedikit = $hitung();

        foreach (range(1, 6) as $i) {
            $lain = Client::factory()->create();
            $this->invoice($lain, ['invoice_number' => "TAMBAH-{$i}"], [50_000, 25_000]);
            $this->item($tetap, $lain, ['service_name' => "Jasa {$i}", 'amount' => 10_000, 'unit_price' => 10_000]);
            Payment::factory()->create(['invoice_id' => $tetap->id, 'bank_account_id' => $this->rekening->id, 'amount' => 1_000, 'payment_date' => '2026-10-25', 'payment_method' => 'cash']);
            RecurringTemplate::query()->create($this->atributTemplate($lain, "Template Tambahan {$i}"));
        }

        $this->assertSame($sedikit, $hitung(), 'Jumlah query tidak boleh mengikuti jumlah baris (N+1).');
    }

    // ── Pembantu ─────────────────────────────────────────────────────────────

    private function anggota(string $peran): User
    {
        $user = User::factory()->create();
        $user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $user->assignRole($peran);

        return $user;
    }

    /**
     * @param  array<string, mixed>  $argumen
     */
    private function panggil(string $alat, array $argumen = [], ?User $user = null): TestResponse
    {
        return KeuanganServer::actingAs($user ?? $this->admin)
            ->tool($alat, ['perusahaan' => self::TEST_COMPANY, ...$argumen]);
    }

    /**
     * Isi JSON jawaban alat (konten teks pertama).
     *
     * @return array<string, mixed>
     */
    private function isi(TestResponse $respons): array
    {
        $respons->assertOk();
        $teks = (fn (): array => $this->content())->call($respons);

        return json_decode($teks[0], true, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * @param  array<string, mixed>  $atribut
     * @param  list<int>  $pembayaran
     */
    private function invoice(Client $klien, array $atribut = [], array $pembayaran = []): Invoice
    {
        $total = $atribut['total_amount'] ?? 1_000_000;
        $invoice = Invoice::factory()->create([
            'billed_to_id' => $klien->id,
            'subtotal' => $total,
            'total_amount' => $total,
            'issue_date' => '2026-10-01',
            'due_date' => '2026-10-31',
            'status' => 'sent',
            ...$atribut,
        ]);

        foreach ($pembayaran as $jumlah) {
            Payment::factory()->create([
                'invoice_id' => $invoice->id,
                'bank_account_id' => $this->rekening->id,
                'amount' => $jumlah,
                'payment_date' => '2026-10-15',
                'payment_method' => 'bank_transfer',
            ]);
        }

        return $invoice;
    }

    /**
     * @param  array<string, mixed>  $atribut
     */
    private function item(Invoice $invoice, Client $klien, array $atribut): InvoiceItem
    {
        return InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'client_id' => $klien->id,
            'quantity' => 1,
            'unit' => 'pcs',
            'cogs_amount' => 0,
            'is_tax_deposit' => false,
            ...$atribut,
        ]);
    }

    /**
     * Template aktif bulanan (Agu & Sep sudah dibuat, Agu dipublish) + template triwulanan diarsipkan.
     *
     * @return array{0: RecurringTemplate, 1: Invoice}
     */
    private function dataBerulang(): array
    {
        $klien = Client::factory()->create(['name' => 'PT Langganan Uji']);
        $aktif = RecurringTemplate::query()->create($this->atributTemplate($klien, 'Retainer Pajak Bulanan'));

        $invoiceHasilPublish = $this->invoice($klien, ['invoice_number' => null, 'status' => 'draft', 'total_amount' => 1_150_000, 'issue_date' => '2026-08-01']);
        RecurringInvoice::query()->create([
            'template_id' => $aktif->id, 'client_id' => $klien->id, 'scheduled_date' => '2026-08-01',
            'issue_date' => '2026-08-01', 'due_date' => '2026-08-31', 'status' => 'published',
            'published_invoice_id' => $invoiceHasilPublish->id, 'invoice_data' => $aktif->invoice_template,
        ]);
        RecurringInvoice::query()->create([
            'template_id' => $aktif->id, 'client_id' => $klien->id, 'scheduled_date' => '2026-09-01',
            'status' => 'draft', 'invoice_data' => $aktif->invoice_template,
        ]);

        RecurringTemplate::query()->create([
            ...$this->atributTemplate($klien, 'Kontrak Lama Triwulan'),
            'frequency' => 'quarterly',
            'status' => 'archived',
            'start_date' => '2026-01-10',
        ]);

        return [$aktif, $invoiceHasilPublish];
    }

    /**
     * Bentuk invoice_template seperti RecurringInvoiceController::buildInvoiceData():
     * subtotal & total TANPA item titipan pajak.
     *
     * @return array<string, mixed>
     */
    private function atributTemplate(Client $klien, string $nama): array
    {
        return [
            'client_id' => $klien->id,
            'template_name' => $nama,
            'start_date' => '2026-07-15',
            'end_date' => '2026-12-31',
            'frequency' => 'monthly',
            'status' => 'active',
            'invoice_template' => [
                'items' => [
                    ['client_id' => $klien->id, 'service_name' => 'Konsultasi Pajak Bulanan', 'quantity' => 1, 'unit' => 'bulan', 'unit_price' => 1_000_000, 'amount' => 1_000_000, 'cogs_amount' => 250_000, 'is_tax_deposit' => false],
                    ['client_id' => $klien->id, 'service_name' => 'Titipan PPh 21', 'quantity' => 1, 'unit' => 'dokumen', 'unit_price' => 150_000, 'amount' => 150_000, 'cogs_amount' => 0, 'is_tax_deposit' => true],
                ],
                'subtotal' => 1_000_000,
                'discount_type' => 'fixed',
                'discount_value' => 0,
                'discount_amount' => 0,
                'discount_reason' => '',
                'total_amount' => 1_000_000,
            ],
        ];
    }
}
