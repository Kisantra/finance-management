<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\CompanyInvoiceTemplate;
use App\Services\InvoicePrintService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Template invoice & Debit Note PT BCB (`bahtera-cipta-bersama/`), ditiru dari dokumen Word BCB (INVOICE
 * FINAL/MOORING/FENDER, DEBIT NOTE 056 OVERTIME). Satu keluarga dengan template MKB (TemplateInvoiceMkbTest):
 * kop di setiap halaman, tabel Excel, kotak alamat & rekening; bedanya logo, baris kontak kop selebar teks,
 * judul kolom biru, dan tabel Debit Note 16 cm bergaris tunggal di GRAND TOTAL.
 */
class TemplateInvoiceBcbTest extends TestCase
{
    use RefreshDatabase;

    private const BCB = 'bahtera-cipta-bersama';

    private const BASE = '/c/'.self::BCB;

    private User $admin;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices'];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::BCB], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Bahtera Cipta Bersama',
            'abbreviation' => 'BCB',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::BCB]);
        setPermissionsTeamId(self::BCB);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        // Suite ini satu database: satu profil untuk semua perusahaan, berisi data & format nomor BCB.
        CompanyProfile::factory()->create([
            'name' => 'PT. Bahtera Cipta Bersama',
            'abbreviation' => 'BCB',
            'address' => "Jl. Contoh No. 2,\nKota Samarinda, Kalimantan Timur",
            'email' => 'bcb@example.com',
            'phone' => '0895 0000 0000',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'pph_enabled' => true,
            'pph_rate' => 2,
            'finance_manager_name' => 'Nama Direktur',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'signature_path' => null,
            'stamp_path' => null,
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. BAHTERA CIPTA BERSAMA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create([
            'name' => 'PT. CONTOH BINA SAMUDRA',
            'alias' => 'CBS',
            'address' => "Gedung Contoh Lt. 12,\nJakarta Selatan 12950",
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);

        $this->travelTo(Carbon::parse('2026-11-16 10:00:00'));
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function dokumen(string $type, ?string $code, string $subject, array $items): Invoice
    {
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-16',
            'due_date' => '2026-11-30',
            'subject' => $subject,
            'document_type' => $type,
            'document_code' => $code,
            'publish' => true,
            'items' => collect($items)->map(fn (array $item) => [
                'unit' => 'LS',
                'cogs_amount' => 0,
                'is_tax_deposit' => false,
                ...$item,
            ])->all(),
        ])->assertSessionHasNoErrors();

        return Invoice::with('items')->latest('id')->firstOrFail();
    }

    private function invoiceFinal(): Invoice
    {
        return $this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH GLORY', [[
            'service_name' => 'MV. CONTOH GLORY',
            'description' => 'Loading Port : Muara Berau Anchorage (stevedoring)',
            'quantity' => 50000,
            'unit' => 'MT',
            'unit_price' => 13_700,
        ]]);
    }

    private function debitNoteOvertime(): Invoice
    {
        return $this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'OT', 'Debit Note Overtime Hari Libur MV. CONTOH GLORY', [[
            'service_name' => 'Tagihan Overtime Hari Libur MV. CONTOH GLORY',
            'quantity' => 1,
            'unit_price' => 27_500_000,
        ]]);
    }

    private function render(Invoice $invoice, ?int $dpAmount = null): string
    {
        tenancy()->initialize(Company::findOrFail(self::BCB));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), $dpAmount, null, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_bcb_hanya_memakai_template_bcb_dengan_font_tertanam(): void
    {
        $invoice = $this->invoiceFinal();

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview?template=kisantra-invoice")->assertNotFound();
        $this->actingAs($this->admin)->get(self::BASE.'/invoices')
            ->assertInertia(fn ($page) => $page->where('companyTemplate', ['value' => 'perusahaan', 'label' => 'PT Bahtera Cipta Bersama']));

        $response = $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview");

        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        foreach (['Tinos-Regular', 'Tinos-Bold', 'Caladea-Regular', 'Caladea-Bold', 'Arimo-Regular'] as $font) {
            $this->assertStringContainsString($font, $response->getContent());
        }
        $this->assertStringNotContainsString('Carlito', $response->getContent());

        tenancy()->initialize(Company::findOrFail(self::BCB));
        try {
            $this->assertSame('pdf.perusahaan.bahtera-cipta-bersama.invoice', CompanyInvoiceTemplate::view());
            $this->assertStringStartsWith('data:image/png;base64,', CompanyInvoiceTemplate::asset('logo.png'));
            $this->assertNotSame(
                file_get_contents(resource_path('views/pdf/perusahaan/mitra-kellian-baruna/logo.png')),
                file_get_contents(CompanyInvoiceTemplate::path('logo.png')),
                'logo BCB bukan logo MKB',
            );
        } finally {
            tenancy()->end();
        }
    }

    public function test_invoice_bcb_menampilkan_kop_tabel_biru_dan_data_dari_profil(): void
    {
        Storage::fake('public')->put('images/ttd.png', 'ttd-unggahan');
        CompanyProfile::current()->update(['signature_path' => 'images/ttd.png']);

        $html = $this->render($this->invoiceFinal());

        // Kop: nama kapital, bidang usaha statis, alamat di samping logo; baris kontak di bawah logo,
        // selebar teks (di luar blok yang bergeser ke kanan logo).
        $this->assertStringContainsString('alt="Logo PT Bahtera Cipta Bersama"', $html);
        $this->assertStringContainsString('<div class="nama">PT. BAHTERA CIPTA BERSAMA</div>', $html);
        $this->assertStringContainsString('<div class="bidang">Stevedoring Company</div>', $html);
        $this->assertMatchesRegularExpression('#<div class="alamat">Jl\. Contoh No\. 2,<br />\s*Kota Samarinda, Kalimantan Timur</div>\s*</div>\s*<div class="kontak">Tlp\.Kantor/WA : 0895 0000 0000 Email : bcb@example\.com</div>#', $html);
        $this->assertStringContainsString('<div class="judul">I N V O I C E</div>', $html);

        // Tabel Excel berjudul kolom biru, baris total InvoiceTotalRows, potongan PPh 23 merah & kapital.
        $this->assertStringContainsString('background-color: #4472c4;', $html);
        $this->assertStringContainsString('<th class="c-qty">Quantity (MT)</th>', $html);
        $this->assertStringContainsString('001/BCB-CBS/INV-FINAL/XI/2026', $html);
        $this->assertStringContainsString('685.000.000', $html);
        $this->assertStringContainsString('75.350.000', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-pph">\s*<td class="c-no">3</td>\s*<td colspan="3" class="label">PPH 23 \(2%\)</td>#', $html);
        $this->assertStringContainsString('13.700.000', $html);
        // 685.000.000 + PPN 75.350.000 − PPh 23 2% 13.700.000.
        $this->assertStringContainsString('746.650.000', $html);

        $this->assertStringContainsString('<div class="tebal">Telepon: 0895 0000 0000</div>', $html);
        $this->assertStringContainsString('Nomor rekening bank: <span class="nomor-rekening">000-00-0000000-0</span>', $html);
        $this->assertStringContainsString('Samarinda, 16 November 2026', $html);
        $this->assertStringContainsString('<div class="nama">Nama Direktur</div>', $html);
        $this->assertStringContainsString('src="data:image/png;base64,'.base64_encode('ttd-unggahan').'"', $html);
    }

    public function test_debit_note_bcb_talangan_dengan_tabel_seperti_dokumen_asli(): void
    {
        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')->assertInertia(fn ($page) => $page
            ->where('documents.debitNote', true)
            ->where('documents.code', true));

        $final = $this->invoiceFinal();
        $overtime = $this->debitNoteOvertime();

        $this->assertSame('001/BCB-CBS/INV-FINAL/XI/2026', $final->invoice_number);
        $this->assertSame('002/BCB-CBS/DN-OT/XI/2026', $overtime->invoice_number);
        $this->assertTrue($overtime->items->every('is_tax_deposit'));
        $this->assertSame(0, $overtime->ppn_amount);
        $this->assertNull($overtime->pph_rate);
        $this->assertSame(27_500_000, $overtime->total_amount);

        tenancy()->initialize(Company::findOrFail(self::BCB));
        try {
            $this->assertSame('pdf.perusahaan.bahtera-cipta-bersama.debit-note', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $overtime));
        } finally {
            tenancy()->end();
        }

        $html = $this->render($overtime);

        $this->assertStringContainsString('<div class="judul">DEBIT NOTE</div>', $html);
        $this->assertStringContainsString('<title>Debit Note 002/BCB-CBS/DN-OT/XI/2026</title>', $html);
        $this->assertStringContainsString('<div class="bidang">Stevedoring Company</div>', $html);
        // Tabel 16 cm, No · Keterangan · TOTAL (Rp), GRAND TOTAL tanpa garis ganda.
        $this->assertStringContainsString('width: 16cm;', $html);
        $this->assertStringContainsString('<table class="items-table">', $html);
        $this->assertStringContainsString('<th class="c-ket">Keterangan</th>', $html);
        $this->assertStringNotContainsString('<th class="c-qty">', $html);
        $this->assertDoesNotMatchRegularExpression('#tr\.baris-tagihan td \{\s*border-bottom#', $html);
        $this->assertMatchesRegularExpression('#<td colspan="2" class="label">GRAND TOTAL</td>#', $html);
        $this->assertStringContainsString('27.500.000', $html);
        // Talangan: tanpa baris PPN/PPh (cek penanda baris; logo base64 bisa memuat huruf apa pun).
        $this->assertStringNotContainsString('baris-ppn', $html);
        $this->assertStringNotContainsString('baris-pph', $html);
        $this->assertStringNotContainsString('baris-bruto', $html);

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$overtime->id}/download")
            ->assertOk()
            ->assertDownload('Debit-Note-002-BCB-CBS-DN-OT-XI-2026.pdf');
    }

    public function test_debit_note_bcb_berkolom_quantity_dan_price_bila_qty_bukan_satu_dan_uang_muka(): void
    {
        $demurrage = $this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'DEM', 'Debit Note DEMURRAGE MV. CONTOH GLORY', [[
            'service_name' => 'MV. CONTOH GLORY',
            'description' => "On Board : 13 November 2026\nDemurrage : 3 Hari",
            'quantity' => 3,
            'unit' => 'Day',
            'unit_price' => 5_000_000,
        ]]);

        $html = $this->render($demurrage);
        $this->assertStringContainsString('<table class="items-table rinci">', $html);
        $this->assertStringContainsString('<th class="c-qty">Quantity (DAY)</th>', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE</th>', $html);
        $this->assertStringContainsString('15.000.000', $html);
        $this->assertMatchesRegularExpression('#<td colspan="4" class="label">GRAND TOTAL</td>#', $html);

        Payment::factory()->create(['invoice_id' => $demurrage->id, 'amount' => 1]);
        $dp = $this->render($demurrage->refresh(), dpAmount: 5_000_000);
        $this->assertStringContainsString('Total Debit Note', $dp);
        $this->assertStringContainsString('TAGIHAN UANG MUKA', $dp);
        $this->assertStringNotContainsString('Total Invoice', $dp);
    }

    public function test_migrasi_menyiapkan_debit_note_bcb(): void
    {
        CompanyProfile::current()->update(['invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}']);
        $lama = collect(['099/BCB-CBS/INV/XI/2026', '100/BCB-CBS/INV-FINAL/XI/2026', '101/BCB-CBS/INV-MOORING/XI/2026', '056/BCB-CBS/DN-OT/V/2026'])
            ->map(fn (string $nomor) => Invoice::factory()->sent()->create([
                'billed_to_id' => $this->client->id,
                'issue_date' => str_contains($nomor, '/V/') ? '2026-05-26' : '2026-11-16',
                'invoice_number' => $nomor,
            ]));

        $migrasi = require database_path('migrations/tenant/2026_11_19_161513_siapkan_debit_note_mkb_bcb.php');

        tenancy()->initialize(Company::findOrFail(self::BCB));
        try {
            $migrasi->up();
            $migrasi->up();
        } finally {
            tenancy()->end();
        }

        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertSame([99, 100, 101, 56], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());
        $this->assertSame([null, 'FINAL', 'MOORING', null], $lama->map(fn (Invoice $i) => $i->fresh()->document_code)->all());
        $this->assertSame(Invoice::TYPE_INVOICE, $lama[3]->fresh()->document_type);
        $this->assertSame('102/BCB-CBS/INV-FENDER/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-17'), $this->client->id, Invoice::TYPE_INVOICE, 'FENDER'));
        $this->assertSame(1, TransactionCategory::where('label', 'Bayar Talangan Klien')->count());
    }
}
