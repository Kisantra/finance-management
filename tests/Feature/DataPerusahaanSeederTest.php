<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\DataPerusahaan\ImporDataPerusahaan;
use Database\Seeders\DataPerusahaanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as TanggalExcel;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

/**
 * Impor data mentah (Template Kelengkapan Data) ke perusahaan Mitra Group. Repo publik: berkas Excel
 * di test ini dibangun di tempat dengan data FIKTIF, mengikuti susunan template asli.
 */
class DataPerusahaanSeederTest extends TestCase
{
    use RefreshDatabase;

    private const LNS = 'lintas-nusa-samudra';

    private string $folder;

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);

        $this->folder = sys_get_temp_dir().'/data-mentah-'.uniqid();
        File::ensureDirectoryExists($this->folder.'/LNS');
        $this->tulisTemplate($this->folder.'/LNS/Template Kelengkapan Data PT Lintas Nusa Samudra.xlsx');
        $this->tulisBukanTemplate($this->folder.'/BUPOT LNS 2025.xlsx');

        $this->app->instance(DataPerusahaanSeeder::class, new DataPerusahaanSeeder($this->folder));

        // Profil yang biasanya dibuat pipeline provisioning (di-fake di sini).
        CompanyProfile::create([
            'name' => 'PT Lintas Nusa Samudra', 'abbreviation' => 'LNS', 'address' => '-', 'email' => '-',
            'phone' => '-', 'finance_manager_name' => '-',
        ]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->folder);

        parent::tearDown();
    }

    public function test_mengimpor_arus_kas_dan_invoice_dengan_total_sama_persis_dengan_sheet(): void
    {
        $this->seed(DataPerusahaanSeeder::class);

        $operasional = BankAccount::where('account_name', ImporDataPerusahaan::AKUN_OPERASIONAL)->sole();
        $masuk = (int) $operasional->transactions()->where('transaction_type', 'credit')->sum('amount')
            + (int) $operasional->payments()->sum('amount');
        $keluar = (int) $operasional->transactions()->where('transaction_type', 'debit')->sum('amount');

        // 2.000.000 + 80.000.000 + 1.234,56 (dibulatkan) + 500.000 / 10.000.000 + 8.000.000 + 12.500 + 5.000.000
        $this->assertSame(82_501_235, $masuk);
        $this->assertSame(23_012_500, $keluar);
        $this->assertSame(7, BankTransaction::count(), '8 baris arus kas, satu menjadi pembayaran invoice');

        // Klien digabung ("PT. CONTOH PELAYARAN" = "CONTOH PELAYARAN"), alias dari kode di nomor invoice.
        $klien = Client::sole();
        $this->assertSame('PT. CONTOH PELAYARAN', $klien->name);
        $this->assertSame('CP', $klien->alias);
        $this->assertSame('0123456789012345', $klien->NPWP);

        $this->assertSame(112_000_000, (int) Invoice::sum('total_amount'));

        $pertama = Invoice::with('items')->where('invoice_number', '001/LNS-CP/I/2025')->sole();
        $this->assertCount(2, $pertama->items, 'baris tanpa nomor/tanggal/pelanggan = item invoice di atasnya');
        $this->assertSame(100_900_000, $pertama->total_amount);
        $this->assertSame(9_900_000, $pertama->ppn_amount);
        $this->assertSame('partially_paid', $pertama->status);
        $this->assertSame(80_000_000, (int) $pertama->payments()->where('bank_account_id', $operasional->id)->sum('amount'));

        // Status "Lunas" tanpa penerimaan di Arus Kas: dilunasi di akun terpisah agar rekening tetap = sheet.
        $kedua = Invoice::where('invoice_number', '002/LNS-CP/II/2025')->sole();
        $this->assertSame('2025-02-19', $kedua->issue_date->toDateString(), 'tanggal teks "19 Februari 2025"');
        $this->assertSame('paid', $kedua->status);
        $this->assertSame(ImporDataPerusahaan::AKUN_LUNAS, $kedua->payments()->sole()->bankAccount->account_name);

        // Nilai USD tidak dikonversi — total 0 seperti rumus sheet, nilainya dicatat di item.
        $usd = Invoice::with('items')->where('invoice_number', '003/LNS-CP/III/2025')->sole();
        $this->assertSame(0, $usd->total_amount);
        $this->assertStringContainsString('USD 1.500', $usd->items->first()->description);

        $kategori = fn (string $deskripsi): string => BankTransaction::with('category')->where('description', 'like', $deskripsi.'%')->sole()->category->label;
        $this->assertSame('Dana Operasional ke Staf', $kategori('PERSIAPAN DANA PNBP'));
        $this->assertSame('PNBP Kepelabuhanan', $kategori('PNBP LABUH'));
        $this->assertSame('Pengembalian Dana dari Staf', $kategori('REFUND KELEBIHAN'));
        $this->assertSame('Bunga & Jasa Giro Bank', $kategori('BUNGA BANK'));
        $this->assertSame('Saldo Pindahan Periode', $kategori('SALDO AKHIR'));
        $this->assertSame('Arah Transaksi Janggal', $kategori('TERIMA PEMBAYARAN'));
        $this->assertSame('Biaya Administrasi Bank', $kategori('BIAYA ADMIN'));

        // Tanggal 2026 di data tahun buku 2025 = salah ketik.
        $this->assertSame('2025-02-03', BankTransaction::where('description', 'like', 'BIAYA ADMIN%')->sole()->transaction_date->toDateString());

        $pencatat = User::where('email', DataPerusahaanSeeder::EMAIL_PENCATAT)->sole();
        $this->assertSame([$pencatat->id], BankTransaction::distinct()->pluck('created_by')->all());
        $this->assertSame([$pencatat->id], Payment::distinct()->pluck('created_by')->all());
        $this->assertSame(0, $pencatat->companies()->count(), 'pencatat impor bukan anggota perusahaan mana pun');

        $profil = CompanyProfile::current();
        $this->assertSame('0123456789012000', $profil->npwp);
        $this->assertSame('-', $profil->address, 'isian yang tidak ada di sheet tidak dikarang');
        $this->assertFalse($profil->needsInvoiceReview());

        $this->assertFileExists($this->folder.'/laporan-impor.md');
    }

    public function test_membuat_akun_per_perusahaan_dan_admin_lintas_perusahaan(): void
    {
        $this->seed(DataPerusahaanSeeder::class);

        $admin = User::where('email', 'admin@mitragroup.id')->sole();
        $this->assertSame(10, $admin->companies()->count());

        foreach (['admin.lns@mitragroup.id' => 'admin', 'manager.lns@mitragroup.id' => 'finance manager', 'staff.lns@mitragroup.id' => 'staff'] as $email => $role) {
            $user = User::where('email', $email)->sole();
            $this->assertSame([self::LNS], $user->companies()->pluck('companies.id')->all(), "{$email} hanya anggota LNS");

            setPermissionsTeamId(self::LNS);
            $this->assertTrue($user->unsetRelation('roles')->hasRole($role), "{$email} berperan {$role} di LNS");
        }
    }

    public function test_dijalankan_ulang_mengimpor_ulang_tanpa_dobel(): void
    {
        $this->seed(DataPerusahaanSeeder::class);
        $this->seed(DataPerusahaanSeeder::class);

        $this->assertSame(3, Invoice::count());
        $this->assertSame(1, Client::count());
        $this->assertSame(7, BankTransaction::count());
        $this->assertSame(2, Payment::count());
        $this->assertSame(3, Company::findOrFail(self::LNS)->impor_data_mentah['invoices']);
    }

    public function test_tidak_menimpa_perusahaan_yang_sudah_berisi_data_lain(): void
    {
        $this->seed(DataPerusahaanSeeder::class);

        BankTransaction::create([
            'bank_account_id' => BankAccount::where('account_name', ImporDataPerusahaan::AKUN_OPERASIONAL)->value('id'),
            'amount' => 1_000,
            'transaction_date' => '2026-11-01',
            'transaction_type' => 'debit',
            'description' => 'Diinput manual',
        ]);

        $this->seed(DataPerusahaanSeeder::class);

        $this->assertSame(8, BankTransaction::count());
        $this->assertSame(1, BankTransaction::where('description', 'Diinput manual')->count());
        $this->assertSame(3, Invoice::count());
    }

    public function test_halaman_utama_tampil_dengan_data_hasil_impor(): void
    {
        $this->seed(DataPerusahaanSeeder::class);
        $this->withoutVite();

        setPermissionsTeamId(self::TEST_COMPANY);
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->actingAs($admin);

        foreach (['/invoices', '/cash-flow/all', '/cash-flow/expenses', '/bank-accounts', '/clients', '/transaction-categories', '/reports/profit-loss?start_date=2025-01-01&end_date=2025-12-31'] as $halaman) {
            $this->get($halaman)->assertOk();
        }

        $this->get('/invoices/'.Invoice::where('invoice_number', '001/LNS-CP/I/2025')->value('id'))->assertOk();
    }

    public function test_tanpa_berkas_tidak_mengimpor_apa_pun(): void
    {
        File::deleteDirectory($this->folder.'/LNS');

        $this->seed(DataPerusahaanSeeder::class);

        $this->assertSame(0, Invoice::count());
        $this->assertSame(0, BankTransaction::count());
        $this->assertFileDoesNotExist($this->folder.'/laporan-impor.md');
    }

    /** Susunan sheet mengikuti Template Kelengkapan Data asli: judul tabel di baris 14 / 5. */
    private function tulisTemplate(string $berkas): void
    {
        $buku = new Spreadsheet;

        $identitas = $buku->getActiveSheet()->setTitle('01 Identitas');
        $identitas->fromArray([
            [null, 'Nama Perusahaan', 'PT LINTAS NUSA SAMUDRA', 'Sesuai Akta terakhir'],
            [null, 'NPWP (16 digit format Coretax)', '0123456789012000', '16 digit'],
        ], null, 'A6');

        $arusKas = $buku->createSheet()->setTitle('07 Arus Kas');
        $arusKas->setCellValue('B2', '07 - ARUS KAS PT LINTAS NUSA SAMUDRA JANUARI SAMPAI DESEMBER 2025');
        $arusKas->fromArray([null, 'No.', 'Tanggal', 'Bulan', 'Deskripsi Transaksi', 'Pihak (Penerima / Pembayar)', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', "Kategori\n(dropdown)", "Sumber Dana\n(dropdown)", 'No. Bukti / Ref'], null, 'A14');
        $arusKas->fromArray([
            [null, 1, self::tanggal('2025-01-05'), null, 'PERSIAPAN DANA PNBP - MV. CONTOH JAYA', 'PT. LNS -> BUDI (FINANCE)', null, 10_000_000],
            [null, 2, self::tanggal('2025-01-06'), null, 'PNBP LABUH MV. CONTOH JAYA', 'BUDI (FINANCE) -> KSOP', null, 8_000_000],
            [null, 3, self::tanggal('2025-01-07'), null, 'REFUND KELEBIHAN DANA PNBP MV. CONTOH JAYA', 'BUDI (FINANCE) -> PT. LNS', 2_000_000, null],
            [null, 4, self::tanggal('2025-01-20'), null, 'PEMBAYARAN DP 80% MV CONTOH JAYA - INV. 001/LNS-CP/I/2025', 'PT. CONTOH PELAYARAN > PT. LNS', 80_000_000, null],
            [null, 5, self::tanggal('2025-01-31'), null, 'BUNGA BANK', 'BANK', 1_234.56, null],
            [null, 6, self::tanggal('2026-02-03'), null, 'BIAYA ADMIN', 'BANK', null, 12_500],
            [null, 7, self::tanggal('2025-02-10'), null, 'TERIMA PEMBAYARAN INVOICE MV. CONTOH LAIN', 'PT. CONTOH PELAYARAN', null, 5_000_000],
            [null, 8, self::tanggal('2025-02-11'), null, 'SALDO AKHIR JANUARI 2025 - SALDO AWAL FEBRUARI 2025', 'BANK', 500_000, null],
            [null, null, 'TOTAL', null, null, null, 82_501_234.56, 23_012_500],
        ], null, 'A15');

        $invoice = $buku->createSheet()->setTitle('08 Invoice Jual');
        $invoice->fromArray([null, 'No.', 'Tanggal Invoice', 'No. Invoice', 'No. Faktur Pajak (jika PKP)', 'Nama Customer', "NPWP / NIK Customer\n(16 digit)", 'Deskripsi Barang / Jasa', "Kode Objek\nPajak", "DPP (Rp)\nTanpa PPN", 'PPN (Rp)', "Total Invoice (Rp)\n[OTOMATIS]", "Status Bayar\n(dropdown)", 'Keterangan'], null, 'A5');
        $invoice->fromArray([
            [null, 1, self::tanggal('2025-01-10'), '001/LNS-CP/I/2025', '04002500000000001', 'PT. CONTOH PELAYARAN', '0123456789012345', 'JASA PANDU MASUK & KELUAR MV. CONTOH JAYA', null, 90_000_000, 9_900_000, 99_900_000],
            [null, 2, null, null, null, null, null, 'PNBP LABUH MV. CONTOH JAYA', null, 1_000_000, null, 1_000_000],
            [null, 3, '19 Februari 2025', '002/LNS-CP/II/2025', null, 'CONTOH PELAYARAN', null, 'LUMPSUM AGENCY FEE MV. CONTOH BAHARI', null, 10_000_000, 1_100_000, 11_100_000, 'Lunas'],
            [null, 4, self::tanggal('2025-03-01'), '003/LNS-CP/III/2025', null, 'PT. CONTOH PELAYARAN', null, 'JASA MV. CONTOH SAMUDRA', null, 'USD 1.500', 0, 0],
            [null, null, 'TOTAL PENJUALAN 2025'],
        ], null, 'A6');
        $invoice->setCellValueExplicit('G6', '0123456789012345', DataType::TYPE_STRING);

        (new Xlsx($buku))->save($berkas);
    }

    /** Berkas lain di folder yang sama (rekap BUPOT dsb.) tidak berisi sheet 01 Identitas. */
    private function tulisBukanTemplate(string $berkas): void
    {
        $buku = new Spreadsheet;
        $buku->getActiveSheet()->setTitle('Sheet1')->fromArray([['No', 'Nama Pemotong', 'DPP'], [1, 'PT. CONTOH', 1_000]]);

        (new Xlsx($buku))->save($berkas);
    }

    private static function tanggal(string $tanggal): float
    {
        return TanggalExcel::PHPToExcel(new \DateTimeImmutable($tanggal));
    }
}
