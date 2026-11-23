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
 * Template invoice & Debit Note PT NBM (`namora-berlian-mahakam/`): salinan susunan BCB (kop di setiap halaman,
 * judul tanpa kotak, tabel Excel, kotak alamat & rekening, tanda tangan; tabel Debit Note 16 cm) dengan logo NBM
 * dan judul kolom oranye seperti lembar Excel NBM. Aturan jenis dokumen sama dengan perusahaan lain: Debit Note
 * talangan = semua item talangan, tanpa PPN/PPh, nomor ber-{KODE} satu urutan dengan invoice.
 */
class TemplateInvoiceNbmTest extends TestCase
{
    use RefreshDatabase;

    private const NBM = 'namora-berlian-mahakam';

    private const BASE = '/c/'.self::NBM;

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

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::NBM], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Namora Berlian Mahakam',
            'abbreviation' => 'NBM',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::NBM]);
        setPermissionsTeamId(self::NBM);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        // Suite ini satu database: satu profil untuk semua perusahaan, berisi data & format nomor NBM.
        CompanyProfile::factory()->create([
            // Sakelar Debit Note di Profil perusahaan (bawaan mati).
            'debit_note_enabled' => true,
            'name' => 'PT. Namora Berlian Mahakam',
            'abbreviation' => 'NBM',
            'address' => "Jl. Contoh No. 2,\nKota Samarinda, Kalimantan Timur",
            'email' => 'nbm@example.com',
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
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. NAMORA BERLIAN MAHAKAM']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create([
            'name' => 'PT. CONTOH PELABUHAN MAHAKAM',
            'alias' => 'CPM',
            'address' => "Gedung Contoh Lt. 12,\nJakarta Selatan 12950",
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);

        $this->travelTo(Carbon::parse('2026-11-16 10:00:00'));
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $extra
     */
    private function dokumen(string $type, ?string $code, string $subject, array $items, array $extra = []): Invoice
    {
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', [
            ...$extra,
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
        tenancy()->initialize(Company::findOrFail(self::NBM));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), $dpAmount, null, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_nbm_hanya_memakai_template_nbm_dengan_font_tertanam(): void
    {
        $invoice = $this->invoiceFinal();

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview?template=kisantra-invoice")->assertNotFound();
        $this->actingAs($this->admin)->get(self::BASE.'/invoices')
            ->assertInertia(fn ($page) => $page->where('companyTemplate', ['value' => 'perusahaan', 'label' => 'PT Namora Berlian Mahakam']));

        $response = $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview");

        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        foreach (['Tinos-Regular', 'Tinos-Bold', 'Caladea-Regular', 'Caladea-Bold', 'Arimo-Regular'] as $font) {
            $this->assertStringContainsString($font, $response->getContent());
        }
        $this->assertStringNotContainsString('Carlito', $response->getContent());

        tenancy()->initialize(Company::findOrFail(self::NBM));
        try {
            $this->assertSame('pdf.perusahaan.namora-berlian-mahakam.invoice', CompanyInvoiceTemplate::view());
            $this->assertStringStartsWith('data:image/jpeg;base64,', CompanyInvoiceTemplate::asset('logo.jpg'));
            $this->assertSame('', CompanyInvoiceTemplate::path('logo.png'), 'logo BCB tidak ikut tersalin');
        } finally {
            tenancy()->end();
        }
    }

    public function test_invoice_nbm_menampilkan_kop_bcb_tabel_oranye_dan_data_dari_profil(): void
    {
        Storage::fake('public')->put('images/ttd.png', 'ttd-unggahan');
        CompanyProfile::current()->update(['signature_path' => 'images/ttd.png']);

        $html = $this->render($this->invoiceFinal());

        // Kop: nama kapital, bidang usaha statis, alamat di samping logo; baris kontak di bawah logo,
        // selebar teks (di luar blok yang bergeser ke kanan logo).
        $this->assertStringContainsString('alt="Logo PT Namora Berlian Mahakam"', $html);
        $this->assertStringContainsString('<div class="nama">PT. NAMORA BERLIAN MAHAKAM</div>', $html);
        $this->assertStringContainsString('<div class="bidang">Stevedoring Company</div>', $html);
        $this->assertMatchesRegularExpression('#<div class="alamat">Jl\. Contoh No\. 2,<br />\s*Kota Samarinda, Kalimantan Timur</div>\s*</div>\s*<div class="kontak">Tlp\.Kantor/WA : 0895 0000 0000 Email : nbm@example\.com</div>#', $html);
        $this->assertStringContainsString('<div class="judul">I N V O I C E</div>', $html);

        // Tabel Excel berjudul kolom oranye, baris total InvoiceTotalRows, potongan PPh 23 merah & kapital.
        $this->assertStringContainsString('background-color: #ffc000;', $html);
        $this->assertStringContainsString('<th class="c-qty">Quantity (MT)</th>', $html);
        $this->assertStringContainsString('001/NBM-CPM/INV-FINAL/XI/2026', $html);
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

    public function test_debit_note_nbm_talangan_dengan_tabel_bcb(): void
    {
        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')->assertInertia(fn ($page) => $page
            ->where('documents.debitNote', true)
            ->where('documents.code', true));

        $final = $this->invoiceFinal();
        $overtime = $this->debitNoteOvertime();

        $this->assertSame('001/NBM-CPM/INV-FINAL/XI/2026', $final->invoice_number);
        $this->assertSame('002/NBM-CPM/DN-OT/XI/2026', $overtime->invoice_number);
        $this->assertTrue($overtime->items->every('is_tax_deposit'));
        $this->assertSame(0, $overtime->ppn_amount);
        $this->assertNull($overtime->pph_rate);
        $this->assertSame(27_500_000, $overtime->total_amount);

        tenancy()->initialize(Company::findOrFail(self::NBM));
        try {
            $this->assertSame('pdf.perusahaan.namora-berlian-mahakam.debit-note', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $overtime));
        } finally {
            tenancy()->end();
        }

        $html = $this->render($overtime);

        $this->assertStringContainsString('<div class="judul">DEBIT NOTE</div>', $html);
        $this->assertStringContainsString('<title>Debit Note 002/NBM-CPM/DN-OT/XI/2026</title>', $html);
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
        $this->assertStringNotContainsString('<tr class="baris-ppn">', $html);
        $this->assertStringNotContainsString('<tr class="baris-pph">', $html);
        $this->assertStringNotContainsString('<tr class="baris-bruto">', $html);

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$overtime->id}/download")
            ->assertOk()
            ->assertDownload('Debit-Note-002-NBM-CPM-DN-OT-XI-2026.pdf');
    }

    public function test_debit_note_nbm_berkolom_quantity_dan_price_bila_qty_bukan_satu_dan_uang_muka(): void
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

    public function test_tagihan_usd_nbm_mencetak_harga_usd_total_outstanding_dan_rekening_usd(): void
    {
        CompanyProfile::current()->update([
            'foreign_currency_enabled' => true,
            'bank_accounts' => [
                ['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. NAMORA BERLIAN MAHAKAM', 'currency' => 'IDR'],
                ['bank' => 'Bank Contoh', 'account_number' => '111-00-1111111-1', 'account_name' => 'PT. NAMORA BERLIAN MAHAKAM', 'currency' => 'USD', 'branch' => 'Samarinda Contoh Branch', 'swift' => 'CONTIDJA'],
            ],
        ]);

        $html = $this->render($this->dokumen(Invoice::TYPE_INVOICE, 'ORBIT', 'Proforma Invoice MV. CONTOH FLAME', [[
            'service_name' => 'MV. CONTOH FLAME',
            'quantity' => 53800,
            'unit' => 'MT',
            'unit_price' => 0,
            'foreign_unit_price' => 0.82,
        ]], ['currency' => 'USD', 'exchange_rate' => 18250, 'apply_ppn' => false, 'apply_pph' => false]));

        // Seperti template BCB: harga USD, total Rupiah dengan kurs invoice, lalu utang dalam USD.
        $this->assertStringContainsString('<th class="c-price">PRICE (USD)</th>', $html);
        $this->assertMatchesRegularExpression('#<td class="rp">USD</td><td class="angka">0,82</td>#', $html);
        $this->assertStringContainsString('<td class="angka">805.117.000</td>', $html);
        $this->assertStringContainsString('GRAND TOTAL (IDR)', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-kurs">.*?Exchange Rate \(1 USD\).*?<td class="angka">18.250</td>#s', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-tagihan_usd">.*?TOTAL OUTSTANDING \(USD\).*?<td class="rp">USD</td><td class="angka">44.116,00</td>#s', $html);
        // Tagihan USD hanya mencetak rekening USD, dengan cabang & Swift; blok klien tanpa baris kurs.
        $this->assertStringContainsString('Bank Account No: 111-00-1111111-1 (USD)', $html);
        $this->assertStringContainsString('Bank Branch Name: Samarinda Contoh Branch', $html);
        $this->assertStringContainsString('Swift Code: CONTIDJA', $html);
        $this->assertStringNotContainsString('000-00-0000000-0', $html);
        $this->assertStringNotContainsString('Rate Stevedoring', $html);
    }

    public function test_invoice_rupiah_bertarif_usd_mencetak_kurs_dan_tarif_di_blok_klien(): void
    {
        CompanyProfile::current()->update(['foreign_currency_enabled' => true]);

        $invoice = $this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH CAPELLA', [[
            'service_name' => 'MV. CONTOH CAPELLA',
            'description' => "Loading Port : Muara Berau Anchorage\n(Stevedoring)",
            'quantity' => 56880,
            'unit' => 'MT',
            'unit_price' => 0,
            'foreign_unit_price' => 0.75,
        ]], ['exchange_rate' => 17813]);
        $html = $this->render($invoice);

        // Seperti invoice FINAL NBM (dan kerangka BCB): kurs & tarif di blok klien.
        $this->assertMatchesRegularExpression('#<td class="label">Exchange Rate</td>\s*<td class="titik">:</td>\s*<td>Rp 17\.813,-</td>#', $html);
        $this->assertMatchesRegularExpression('#<td class="label">Rate Stevedoring \$</td>\s*<td class="titik">:</td>\s*<td>0,75 \$</td>#', $html);
        $this->assertMatchesRegularExpression('#<td class="label">Rate Stevedoring Rp</td>\s*<td class="titik">:</td>\s*<td>17\.813 x 0,75 \$ = Rp 13\.359,75</td>#', $html);

        // Harga & total sama dengan invoice FINAL asli NBM: 56.880 × Rp 13.359,75 = Rp 759.902.580, GRAND TOTAL
        // dari PPN & PPh yang sudah dibulatkan (lembar asli menampilkan angka yang sama).
        $this->assertStringContainsString('<td class="angka">13.359,75</td>', $html);
        $this->assertStringContainsString('<td class="angka">759.902.580</td>', $html);
        $this->assertStringContainsString('<td class="angka">83.589.284</td>', $html);
        $this->assertStringContainsString('<td class="angka">15.198.052</td>', $html);
        $this->assertSame(828_293_812, $invoice->total_amount);
        $this->assertStringContainsString('<td class="angka">828.293.812</td>', $html);
    }

    public function test_migrasi_menyiapkan_debit_note_nbm_saja_dan_idempoten(): void
    {
        CompanyProfile::current()->update([
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}',
            'debit_note_enabled' => false,
        ]);
        $lama = collect(['007/NBM-CPM/INV/XI/2026', '008/NBM-CPM/INV-FINAL/XI/2026', '009/NBM-CPM/INV-MOORING/XI/2026', '004/NBM-CPM/DN-OT/VIII/2026'])
            ->map(fn (string $nomor) => Invoice::factory()->sent()->create([
                'billed_to_id' => $this->client->id,
                'issue_date' => str_contains($nomor, '/VIII/') ? '2026-08-18' : '2026-11-16',
                'invoice_number' => $nomor,
            ]));

        $migrasi = require database_path('migrations/tenant/2026_11_23_143838_siapkan_debit_note_nbm.php');

        // Perusahaan lain (termasuk BCB) tidak tersentuh.
        foreach ([self::TEST_COMPANY, 'bahtera-cipta-bersama'] as $lain) {
            Company::withoutEvents(fn () => Company::firstOrCreate(['id' => $lain], [
                'organization_id' => Organization::firstOrFail()->id,
                'name' => $lain,
                'abbreviation' => 'LAIN',
                'status' => 'active',
            ]));
            tenancy()->initialize(Company::findOrFail($lain));
            $migrasi->up();
            tenancy()->end();
        }
        $this->assertSame('{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertFalse((bool) CompanyProfile::current()->debit_note_enabled);
        $this->assertSame(0, TransactionCategory::where('label', 'Bayar Talangan Klien')->count());

        tenancy()->initialize(Company::findOrFail(self::NBM));
        try {
            $migrasi->up();
            $migrasi->up();
        } finally {
            tenancy()->end();
        }

        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        // Template Debit Note dibuat atas permintaan NBM: sakelarnya langsung menyala.
        $this->assertTrue((bool) CompanyProfile::current()->debit_note_enabled);
        $this->assertSame([7, 8, 9, 4], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());
        $this->assertSame([null, 'FINAL', 'MOORING', null], $lama->map(fn (Invoice $i) => $i->fresh()->document_code)->all());
        // Nomor berawalan DN tidak diubah jenisnya (itemnya tercatat sebagai pendapatan, tinjau manual).
        $this->assertSame(Invoice::TYPE_INVOICE, $lama[3]->fresh()->document_type);
        $this->assertSame('010/NBM-CPM/INV-FENDER/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-17'), $this->client->id, Invoice::TYPE_INVOICE, 'FENDER'));

        $sub = TransactionCategory::where('label', 'Bayar Talangan Klien')->sole();
        $this->assertSame('financing', $sub->type);
        $this->assertSame('Talangan Klien', $sub->parent->label);
        $this->assertSame(1, TransactionCategory::where('label', 'Talangan Klien')->count());
    }
}
