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
 * Template invoice PT NAI (`nusantara-armada-indonesia/`), ditiru dari invoice Word NAI terbaru (176 … FINAL
 * FLOATING CRANE …): logo di setiap halaman tanpa kop surat, judul dalam kotak, blok klien Times New Roman &
 * Calibri (+ RATE DOLLAR & PRICE untuk tarif USD), tabel Excel berjudul kolom kuning, potongan PPh 23 merah,
 * baris akhir "Total Invoice", kotak alamat & rekening, tanda tangan. NAI belum punya Debit Note; nomornya
 * ber-{KODE} seperti dokumen asli.
 */
class TemplateInvoiceNaiTest extends TestCase
{
    use RefreshDatabase;

    private const NAI = 'nusantara-armada-indonesia';

    private const BASE = '/c/'.self::NAI;

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

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::NAI], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Nusantara Armada Indonesia',
            'abbreviation' => 'NAI',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::NAI]);
        setPermissionsTeamId(self::NAI);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        // Suite ini satu database: satu profil untuk semua perusahaan, berisi data & format nomor NAI.
        CompanyProfile::factory()->create([
            'name' => 'PT. Nusantara Armada Indonesia',
            'abbreviation' => 'NAI',
            'address' => "Jl. Contoh No. 2 RT. 01,\nKota Samarinda",
            'email' => 'nai@example.com',
            'phone' => '0811-0000-000',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'pph_enabled' => true,
            'pph_rate' => 2,
            'foreign_currency_enabled' => true,
            'finance_manager_name' => 'Nama Direktur',
            'finance_manager_position' => 'Direktur',
            'signature_city' => 'Samarinda',
            'signature_path' => null,
            'stamp_path' => null,
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. NUSANTARA ARMADA INDONESIA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create([
            'name' => 'PT. CONTOH ARMADA SAMUDRA',
            'alias' => 'CAS',
            'address' => "Jl. Contoh Raya No. 1A,\nKota Jakarta Timur, DKI Jakarta 13330",
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);

        $this->travelTo(Carbon::parse('2026-11-11 10:00:00'));
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $extra
     */
    private function invoice(?string $code, string $subject, array $items, array $extra = []): Invoice
    {
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', [
            ...$extra,
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-25',
            'subject' => $subject,
            'document_type' => Invoice::TYPE_INVOICE,
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
        return $this->invoice('FINAL', 'Invoice Final Floating Crane MV. CONTOH SAMUDRA', [[
            'service_name' => 'MV. CONTOH SAMUDRA',
            'description' => "Loading Port : Muara Berau\nAnchorage (Floating Crane)",
            'quantity' => 20000,
            'unit' => 'MT',
            'unit_price' => 22_000,
        ]]);
    }

    private function render(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null): string
    {
        tenancy()->initialize(Company::findOrFail(self::NAI));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), $dpAmount, $pelunasanAmount, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_nai_hanya_memakai_template_nai_dengan_font_tertanam(): void
    {
        $invoice = $this->invoiceFinal();

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview?template=kisantra-invoice")->assertNotFound();
        $this->actingAs($this->admin)->get(self::BASE.'/invoices')
            ->assertInertia(fn ($page) => $page->where('companyTemplate', ['value' => 'perusahaan', 'label' => 'PT Nusantara Armada Indonesia']));

        $response = $this->actingAs($this->admin)->post(self::BASE.'/invoices/preview', [
            'client_id' => $this->client->id,
            'subject' => 'Invoice Final Floating Crane MV. CONTOH SAMUDRA',
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-25',
            'items' => [['service_name' => 'MV. CONTOH SAMUDRA', 'quantity' => 20000, 'unit' => 'MT', 'unit_price' => 22_000, 'cogs_amount' => 0, 'is_tax_deposit' => false]],
        ]);

        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        // Times New Roman → Tinos (nomor, perihal, alamat klien), Calibri → Carlito (judul, blok klien lainnya,
        // baris total, kotak info, tanda tangan), Arial → Arimo (tabel item), dari fonts/.
        foreach (['Tinos-Regular', 'Tinos-Bold', 'Carlito-Regular', 'Carlito-Bold', 'Arimo-Regular'] as $font) {
            $this->assertStringContainsString($font, $response->getContent());
        }

        tenancy()->initialize(Company::findOrFail(self::NAI));
        try {
            $this->assertSame('pdf.perusahaan.nusantara-armada-indonesia.invoice', CompanyInvoiceTemplate::view());
            $this->assertStringStartsWith('data:image/jpeg;base64,', CompanyInvoiceTemplate::asset('logo.jpg'));
        } finally {
            tenancy()->end();
        }
    }

    public function test_invoice_nai_menampilkan_logo_judul_tabel_dan_data_dari_profil(): void
    {
        $html = $this->render($this->invoiceFinal());

        // Tanpa kop surat: header Word hanya logo; judul dalam kotak di kanannya.
        $this->assertStringContainsString('<img class="logo" src="data:image/jpeg;base64,', $html);
        $this->assertMatchesRegularExpression('#<table class="judul">\s*<tr>\s*<td>I N V O I C E</td>#', $html);
        $this->assertStringNotContainsString('nai@example.com', $html);
        $this->assertStringContainsString('<title>Invoice 001/NAI-CAS/INV-FINAL/XI/2026</title>', $html);

        // Blok klien: Nomor & Perihal Times New Roman (nilai Nomor & seluruh Perihal tebal), TO Calibri, alamat
        // klien Times tebal, ATTENTION & TERM PAYMENT Calibri 11pt.
        $this->assertMatchesRegularExpression('#<tr class="times">\s*<td class="label">Nomor</td>\s*<td class="titik">:</td>\s*<td class="tebal">001/NAI-CAS/INV-FINAL/XI/2026</td>#', $html);
        $this->assertMatchesRegularExpression('#<tr class="times tebal">\s*<td class="label">Perihal</td>\s*<td class="titik">:</td>\s*<td>Invoice Final Floating Crane MV. CONTOH SAMUDRA</td>#', $html);
        $this->assertMatchesRegularExpression('#<tr>\s*<td class="label">TO</td>\s*<td class="titik">:</td>\s*<td>PT. CONTOH ARMADA SAMUDRA</td>#', $html);
        $this->assertMatchesRegularExpression('#<tr class="times tebal">\s*<td class="label"></td>\s*<td class="titik"></td>\s*<td>Jl. Contoh Raya No. 1A,<br />#', $html);
        $this->assertMatchesRegularExpression('#<tr class="kecil">\s*<td class="label">ATTENTION</td>\s*<td class="titik">:</td>\s*<td>Direktur Finance &amp; Accounting</td>#', $html);
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);
        // Tagihan Rupiah tanpa tarif USD: tanpa baris kurs.
        $this->assertStringNotContainsString('RATE DOLLAR', $html);

        // Tabel Excel berjudul kolom kuning, nomor bertitik, angka tanpa "Rp", lalu baris total InvoiceTotalRows.
        $this->assertStringContainsString('background-color: #ffff00;', $html);
        $this->assertStringContainsString('<th class="c-qty">Quantity (MT)</th>', $html);
        $this->assertStringContainsString('<th class="c-total">TOTAL (Rp)</th>', $html);
        $this->assertStringContainsString('<td class="c-no">1.</td>', $html);
        $this->assertStringContainsString('Loading Port : Muara Berau<br />', $html);
        $this->assertStringContainsString('<td class="c-qty">20.000</td>', $html);
        $this->assertStringContainsString('<td class="c-price besar">22.000</td>', $html);
        $this->assertStringContainsString('<td class="c-total besar">440.000.000</td>', $html);
        // 440.000.000 + PPN 48.400.000 − PPh 23 2% 8.800.000.
        $this->assertStringContainsString('Total Invoice (Sebelum PPN)', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-ppn">\s*<td class="c-no">2.</td>\s*<td colspan="3" class="label">PPN 11%</td>\s*<td class="c-total">48.400.000</td>#', $html);
        $this->assertStringContainsString('Total Invoice + PPN (belum dipotong PPh)', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-pph">\s*<td class="c-no">3.</td>\s*<td colspan="3" class="label">PPH 23 2%</td>\s*<td class="c-total">8.800.000</td>#', $html);
        // Baris akhir "Total Invoice", bukan GRAND TOTAL.
        $this->assertMatchesRegularExpression('#<tr class="baris-tagihan">\s*<td colspan="4" class="label">Total Invoice</td>\s*<td class="c-total">479.600.000</td>#', $html);
        $this->assertStringNotContainsString('GRAND TOTAL', $html);

        // Kotak alamat & rekening, kota-tanggal, dan penanda tangan dari profil.
        $this->assertStringContainsString('<div class="tebal">PT. NUSANTARA ARMADA INDONESIA</div>', $html);
        $this->assertStringContainsString('<div>Jl. Contoh No. 2 RT. 01,<br />', $html);
        $this->assertStringContainsString('<div>Telepon: 0811-0000-000</div>', $html);
        $this->assertStringContainsString('<div class="bank">Bank Contoh</div>', $html);
        $this->assertStringContainsString('<div>An. <span class="tebal">PT. NUSANTARA ARMADA INDONESIA</span></div>', $html);
        $this->assertStringContainsString('<div>Nomor rekening bank: 000-00-0000000-0</div>', $html);
        $this->assertStringContainsString('Samarinda, 11 November 2026', $html);
        $this->assertStringContainsString('<span class="nama">Nama Direktur</span>', $html);
        $this->assertStringContainsString('<div class="jabatan">Direktur</div>', $html);
    }

    public function test_gambar_tanda_tangan_ditumpuk_di_atas_nama_seperti_dokumen_asli(): void
    {
        Storage::fake('public')->put('images/ttd.png', 'ttd-unggahan');
        Storage::disk('public')->put('images/stempel.png', 'stempel-unggahan');
        CompanyProfile::current()->update(['signature_path' => 'images/ttd.png', 'stamp_path' => 'images/stempel.png']);

        $html = $this->render($this->invoiceFinal());

        // Gambar tanda tangan asli NAI sudah memuat nama & jabatan: nama dari profil dicetak lebih dulu, gambar
        // (dan stempel) sesudahnya sehingga tergambar di atasnya.
        $nama = strpos($html, '<span class="nama">Nama Direktur</span>');
        $ttd = strpos($html, '<img src="data:image/png;base64,'.base64_encode('ttd-unggahan').'" alt="Tanda tangan">');
        $stempel = strpos($html, '<img class="stempel" src="data:image/png;base64,'.base64_encode('stempel-unggahan').'" alt="Stempel">');
        $this->assertNotFalse($nama);
        $this->assertNotFalse($ttd);
        $this->assertNotFalse($stempel);
        $this->assertGreaterThan($nama, $ttd);
        $this->assertGreaterThan($ttd, $stempel);
    }

    public function test_invoice_rupiah_bertarif_usd_mencetak_rate_dollar_dan_price_di_blok_klien(): void
    {
        $invoice = $this->invoice('FINAL', 'Invoice Final Floating Crane MV. CONTOH SAMUDRA', [[
            'service_name' => 'MV. CONTOH SAMUDRA',
            'quantity' => 25000,
            'unit' => 'MT',
            'unit_price' => 0,
            'foreign_unit_price' => 1.2,
        ]], ['exchange_rate' => 18059]);
        $html = $this->render($invoice);

        // Seperti invoice FINAL asli: kurs & tarif di blok klien, harga per MT Rupiah bersen di tabel.
        $this->assertMatchesRegularExpression('#<td class="label">RATE DOLLAR</td>\s*<td class="titik">:</td>\s*<td>Rp. 18.059,00</td>#', $html);
        $this->assertMatchesRegularExpression('#<td class="label">PRICE</td>\s*<td class="titik">:</td>\s*<td>1,20 USD x Rp. 18.059,00 = Rp. 21.670,80</td>#', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE</th>', $html);
        $this->assertStringContainsString('<td class="c-price besar">21.670,80</td>', $html);
        // 25.000 × 1,20 × 18.059 = 541.770.000; PPN 11% 59.594.700; PPh 23 2% 10.835.400.
        $this->assertStringContainsString('<td class="c-total besar">541.770.000</td>', $html);
        $this->assertStringContainsString('59.594.700', $html);
        $this->assertStringContainsString('10.835.400', $html);
        $this->assertSame(590_529_300, $invoice->total_amount);
        $this->assertStringContainsString('<td class="c-total">590.529.300</td>', $html);
        $this->assertStringNotContainsString('<tr class="baris-tagihan_usd">', $html);
    }

    public function test_tagihan_usd_mencetak_total_rupiah_dan_total_outstanding_usd(): void
    {
        $invoice = $this->invoice('FINAL', 'Invoice Final Floating Crane MV. CONTOH SAMUDRA', [[
            'service_name' => 'MV. CONTOH SAMUDRA',
            'quantity' => 25000,
            'unit' => 'MT',
            'unit_price' => 0,
            'foreign_unit_price' => 1.2,
        ]], ['currency' => Invoice::CURRENCY_USD, 'exchange_rate' => 18059]);
        $html = $this->render($invoice);

        // Tagihan USD: kurs di baris total (bukan blok klien), harga USD, total Rupiah lalu TOTAL OUTSTANDING (USD).
        $this->assertStringNotContainsString('RATE DOLLAR', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE (USD)</th>', $html);
        $this->assertStringContainsString('<td class="c-price besar">USD 1,20</td>', $html);
        $this->assertMatchesRegularExpression('#<td colspan="4" class="label">Total Invoice \(IDR\)</td>\s*<td class="c-total">590.529.300</td>#', $html);
        $this->assertStringContainsString('Exchange Rate (1 USD)', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-tagihan_usd">\s*<td colspan="4" class="label">TOTAL OUTSTANDING \(USD\)</td>\s*<td class="c-total">USD 32.700,00</td>#', $html);
    }

    public function test_kotak_mengikuti_isian_profil(): void
    {
        CompanyProfile::current()->update([
            'phone' => '',
            'signature_city' => null,
            'bank_accounts' => [
                ['bank' => 'BCA', 'account_number' => '111-222', 'account_name' => 'PT. NAI'],
                ['bank' => 'BRI', 'account_number' => '333-444', 'account_name' => 'PT. NAI'],
            ],
        ]);

        $html = $this->render($this->invoiceFinal());

        $this->assertStringNotContainsString('Telepon:', $html);
        $this->assertStringContainsString('<div class="bank">BCA</div>', $html);
        $this->assertStringContainsString('<div class="bank rekening-lain">BRI</div>', $html);
        $this->assertStringContainsString('333-444', $html);
        $this->assertStringNotContainsString('000-00-0000000-0', $html);
        // Kota kosong: tanggal saja.
        $this->assertStringContainsString('<div>11 November 2026</div>', $html);
    }

    public function test_uang_muka_dan_pelunasan_memakai_baris_total_sistem(): void
    {
        $invoice = $this->invoiceFinal();

        $dp = $this->render($invoice, dpAmount: 100_000_000);
        $this->assertMatchesRegularExpression('#<tr class="baris-total">\s*<td colspan="4" class="label">Total Invoice</td>\s*<td class="c-total">479.600.000</td>#', $dp);
        $this->assertStringContainsString('TAGIHAN UANG MUKA', $dp);
        $this->assertStringNotContainsString('GRAND TOTAL', $dp);

        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 100_000_000]);
        $pelunasan = $this->render($invoice->refresh(), pelunasanAmount: 379_600_000);
        $this->assertStringContainsString('Pembayaran Diterima', $pelunasan);
        $this->assertMatchesRegularExpression('#<tr class="baris-tagihan">\s*<td colspan="4" class="label">TAGIHAN PELUNASAN</td>\s*<td class="c-total">379.600.000</td>#', $pelunasan);
    }

    public function test_nai_tanpa_debit_note_tetapi_nomornya_berkode_seperti_dokumen_asli(): void
    {
        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')->assertInertia(fn ($page) => $page
            ->where('documents.debitNote', false)
            ->where('documents.code', true));

        tenancy()->initialize(Company::findOrFail(self::NAI));
        try {
            $this->assertFalse(CompanyInvoiceTemplate::supportsDebitNote());
        } finally {
            tenancy()->end();
        }

        $final = $this->invoiceFinal();
        $demurrage = $this->invoice('DEM', 'Invoice Demurrage MV. CONTOH SAMUDRA', [['service_name' => 'Tagihan DEMURRAGE', 'quantity' => 3, 'unit' => 'Day', 'unit_price' => 3_750_000]]);
        $tanpaKode = $this->invoice(null, 'Invoice Sewa Alat Berat', [['service_name' => 'Sewa Pakai Alat Berat', 'quantity' => 1, 'unit_price' => 150_000_000]]);

        $this->assertSame('001/NAI-CAS/INV-FINAL/XI/2026', $final->invoice_number);
        $this->assertSame('002/NAI-CAS/INV-DEM/XI/2026', $demurrage->invoice_number);
        $this->assertSame('003/NAI-CAS/INV/XI/2026', $tanpaKode->invoice_number);
        // Invoice NAI dipotong PPh 23 2% (pengaturan NAI): 11.250.000 + PPN 1.237.500 − PPh 225.000.
        $this->assertSame('2.00', $demurrage->pph_rate);
        $this->assertSame(12_262_500, $demurrage->total_amount);

        // Debit Note (talangan) belum tersedia untuk NAI.
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', [
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-25',
            'document_type' => Invoice::TYPE_DEBIT_NOTE,
            'items' => [['service_name' => 'PNBP', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 1_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false]],
        ])->assertSessionHasErrors('document_type');
    }

    public function test_migrasi_menyiapkan_nomor_nai_saja_dan_idempoten(): void
    {
        CompanyProfile::current()->update(['invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}']);
        $lama = collect(['170/NAI-CAS/INV/X/2026', '173/NAI-CAS/INV-DEM/X/2026', '176/NAI-CAS/INV-FINAL/X/2026'])
            ->map(fn (string $nomor) => Invoice::factory()->sent()->create([
                'billed_to_id' => $this->client->id,
                'issue_date' => '2026-10-30',
                'invoice_number' => $nomor,
            ]));
        // Format lama: nomor berkode tidak cocok, urutannya kosong.
        $this->assertSame([170, null, null], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());

        $migrasi = require database_path('migrations/tenant/2026_11_20_150928_siapkan_nomor_invoice_nai.php');

        // Perusahaan lain (termasuk AOE) tidak tersentuh.
        foreach ([self::TEST_COMPANY, 'abdi-ocean-energy'] as $lain) {
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

        tenancy()->initialize(Company::findOrFail(self::NAI));
        try {
            $migrasi->up();
            $migrasi->up();
        } finally {
            tenancy()->end();
        }

        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertSame([170, 173, 176], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());
        $this->assertSame([null, 'DEM', 'FINAL'], $lama->map(fn (Invoice $i) => $i->fresh()->document_code)->all());
        $this->assertSame('177/NAI-CAS/INV-FINAL/X/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-10-31'), $this->client->id, Invoice::TYPE_INVOICE, 'FINAL'));
        // NAI belum menerbitkan Debit Note: kategori talangan tidak dibuat.
        $this->assertSame(0, TransactionCategory::where('label', 'Bayar Talangan Klien')->count());
    }
}
