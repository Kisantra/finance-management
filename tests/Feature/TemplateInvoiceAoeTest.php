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
 * Template invoice & Debit Note PT AOE (`abdi-ocean-energy/`), ditiru dari dokumen Word AOE (INVOICE FINAL
 * … (DENGAN PPN DAN PPH), DEBIT NOTE … (TANPA PPN DAN PPH)): logo di setiap halaman tanpa kop surat, judul
 * dalam kotak, tabel Excel berjudul kolom biru, potongan PPh 23 merah, kotak alamat & rekening, tanda tangan.
 * Aturan jenis dokumen sama dengan SLU/BAS/MKB/BCB: Debit Note = semua item talangan, tanpa PPN/PPh, nomor
 * ber-{KODE} satu urutan dengan invoice.
 */
class TemplateInvoiceAoeTest extends TestCase
{
    use RefreshDatabase;

    private const AOE = 'abdi-ocean-energy';

    private const BASE = '/c/'.self::AOE;

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

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::AOE], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Abdi Ocean Energy',
            'abbreviation' => 'AOE',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::AOE]);
        setPermissionsTeamId(self::AOE);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        // Suite ini satu database: satu profil untuk semua perusahaan, berisi data & format nomor AOE.
        CompanyProfile::factory()->create([
            // Sakelar Debit Note di Profil perusahaan (bawaan mati).
            'debit_note_enabled' => true,
            'name' => 'PT. Abdi Ocean Energy',
            'abbreviation' => 'AOE',
            'address' => "Jl. Contoh No. 2, Desa Contoh,\nKabupaten Kutai Kartanegara",
            'email' => 'aoe@example.com',
            'phone' => '0811-0000-000',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'pph_enabled' => true,
            'pph_rate' => 2,
            'finance_manager_name' => 'Nama Direktur',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'signature_path' => null,
            'stamp_path' => null,
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. ABDI OCEAN ENERGY']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create([
            'name' => 'PT. CONTOH DAYA SAMUDRA',
            'alias' => 'CDS',
            'address' => "Gedung Contoh Lt. 12,\nKota Jakarta Pusat, DKI Jakarta 10220",
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);

        $this->travelTo(Carbon::parse('2026-11-03 10:00:00'));
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
            'issue_date' => '2026-11-03',
            'due_date' => '2026-11-17',
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
        return $this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH PROSPER', [[
            'service_name' => 'MV. CONTOH PROSPER',
            'description' => 'Loading Port : Muara Jawa Anchorage (stevedoring)',
            'quantity' => 56000,
            'unit' => 'MT',
            'unit_price' => 9_500,
        ]]);
    }

    private function debitNotePnbp(): Invoice
    {
        return $this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'PNBP', 'Debit Note PNBP JASA MV. CONTOH PROSPER', [[
            'service_name' => 'Tagihan PNBP JASA MV. CONTOH PROSPER',
            'description' => "Kode Billing: 820260000000002\nNTPN: CONTOH0000000002",
            'quantity' => 1,
            'unit_price' => 25_000_000,
        ]]);
    }

    private function render(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null): string
    {
        tenancy()->initialize(Company::findOrFail(self::AOE));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), $dpAmount, $pelunasanAmount, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_aoe_hanya_memakai_template_aoe_dengan_font_tertanam(): void
    {
        $invoice = $this->invoiceFinal();

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview?template=kisantra-invoice")->assertNotFound();
        $this->actingAs($this->admin)->get(self::BASE.'/invoices')
            ->assertInertia(fn ($page) => $page->where('companyTemplate', ['value' => 'perusahaan', 'label' => 'PT Abdi Ocean Energy']));

        $response = $this->actingAs($this->admin)->post(self::BASE.'/invoices/preview', [
            'client_id' => $this->client->id,
            'subject' => 'Invoice FINAL MV. CONTOH PROSPER',
            'issue_date' => '2026-11-03',
            'due_date' => '2026-11-17',
            'items' => [['service_name' => 'MV. CONTOH PROSPER', 'quantity' => 56000, 'unit' => 'MT', 'unit_price' => 9_500, 'cogs_amount' => 0, 'is_tax_deposit' => false]],
        ]);

        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        // Times New Roman → Tinos (teks dokumen), Calibri → Carlito (judul), Cambria → Caladea (kotak info),
        // Arial → Arimo (alamat di kotak alamat), dari fonts/.
        foreach (['Tinos-Regular', 'Tinos-Bold', 'Carlito-Bold', 'Caladea-Regular', 'Caladea-Bold', 'Arimo-Regular'] as $font) {
            $this->assertStringContainsString($font, $response->getContent());
        }

        tenancy()->initialize(Company::findOrFail(self::AOE));
        try {
            $this->assertSame('pdf.perusahaan.abdi-ocean-energy.invoice', CompanyInvoiceTemplate::view());
            $this->assertStringStartsWith('data:image/png;base64,', CompanyInvoiceTemplate::asset('logo.png'));
        } finally {
            tenancy()->end();
        }
    }

    public function test_invoice_aoe_menampilkan_logo_judul_tabel_dan_data_dari_profil(): void
    {
        Storage::fake('public')->put('images/ttd.png', 'ttd-unggahan');
        CompanyProfile::current()->update(['signature_path' => 'images/ttd.png']);

        $html = $this->render($this->invoiceFinal());

        // Tanpa kop surat: header Word hanya logo; judul dalam kotak di kanannya.
        $this->assertStringContainsString('<img class="logo" src="data:image/png;base64,', $html);
        $this->assertMatchesRegularExpression('#<table class="judul">\s*<tr>\s*<td>I N V O I C E</td>#', $html);
        $this->assertStringNotContainsString('Stevedoring Company', $html);
        $this->assertStringNotContainsString('aoe@example.com', $html);
        $this->assertStringContainsString('<title>Invoice 001/AOE-CDS/INV-FINAL/XI/2026</title>', $html);

        // Blok klien: titik dua Nomor & TO tidak tebal, seluruh baris Perihal tebal.
        $this->assertMatchesRegularExpression('#<td class="label tebal">Nomor</td>\s*<td class="titik">:</td>\s*<td class="tebal">001/AOE-CDS/INV-FINAL/XI/2026</td>#', $html);
        $this->assertMatchesRegularExpression('#<tr class="tebal">\s*<td class="label">Perihal</td>\s*<td class="titik">:</td>\s*<td>Invoice FINAL MV. CONTOH PROSPER</td>#', $html);
        $this->assertMatchesRegularExpression('#<td class="label tebal">TO</td>\s*<td class="titik">:</td>\s*<td class="tebal">PT. CONTOH DAYA SAMUDRA</td>#', $html);
        $this->assertStringContainsString('Gedung Contoh Lt. 12,<br />', $html);
        $this->assertStringContainsString('Direktur Finance &amp; Accounting', $html);
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);

        // Tabel Excel berjudul kolom biru muda: Quantity (MT) · PRICE · TOTAL, lalu baris total InvoiceTotalRows.
        $this->assertStringContainsString('background-color: #b4c6e7;', $html);
        $this->assertStringContainsString('<th class="c-qty">Quantity (MT)</th>', $html);
        $this->assertStringContainsString('Loading Port : Muara Jawa Anchorage (stevedoring)', $html);
        $this->assertStringContainsString('56.000', $html);
        $this->assertStringContainsString('9.500', $html);
        $this->assertStringContainsString('Total Invoice (Sebelum PPN)', $html);
        // 532.000.000 + PPN 58.520.000 − PPh 23 2% 10.640.000.
        $this->assertStringContainsString('532.000.000', $html);
        $this->assertStringContainsString('58.520.000', $html);
        $this->assertStringContainsString('Total Invoice + PPN (belum dipotong PPh)', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-pph">\s*<td class="c-no">3</td>\s*<td colspan="3" class="label">PPH 23 \(2%\)</td>#', $html);
        $this->assertStringContainsString('10.640.000', $html);
        $this->assertStringContainsString('GRAND TOTAL', $html);
        $this->assertStringContainsString('579.880.000', $html);

        // Kotak alamat & rekening, kota-tanggal, penanda tangan, dan tanda tangan unggahan.
        $this->assertStringContainsString('<div class="tebal">PT. ABDI OCEAN ENERGY</div>', $html);
        $this->assertStringContainsString('<div class="arial">Jl. Contoh No. 2, Desa Contoh,<br />', $html);
        $this->assertStringContainsString('<div class="tebal">Telepon: 0811-0000-000</div>', $html);
        $this->assertStringContainsString('<div class="bank">Bank Contoh</div>', $html);
        $this->assertStringContainsString('Nomor rekening bank: <span class="nomor-rekening">000-00-0000000-0</span>', $html);
        $this->assertStringContainsString('Samarinda, 3 November 2026', $html);
        $this->assertStringContainsString('<div class="nama">Nama Direktur</div>', $html);
        $this->assertStringContainsString('<div class="jabatan">Direktur Utama</div>', $html);
        $this->assertStringContainsString('src="data:image/png;base64,'.base64_encode('ttd-unggahan').'"', $html);
    }

    public function test_invoice_rupiah_bertarif_usd_mencetak_harga_bersen_tanpa_baris_kurs(): void
    {
        CompanyProfile::current()->update(['foreign_currency_enabled' => true]);

        $invoice = $this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH PROSPER', [[
            'service_name' => 'MV. CONTOH PROSPER',
            'quantity' => 56000,
            'unit' => 'MT',
            'unit_price' => 0,
            'foreign_unit_price' => 0.5,
        ]], ['exchange_rate' => 18918.92]);
        $html = $this->render($invoice);

        // Harga & total sama dengan invoice FINAL asli AOE (56.000 × Rp 9.459,46 = Rp 529.729.760). Berbeda
        // dengan MKB, dokumen AOE tidak mencetak kurs & tarif di blok klien.
        $this->assertStringContainsString('<td class="angka">9.459,46</td>', $html);
        $this->assertStringContainsString('<td class="angka">529.729.760</td>', $html);
        $this->assertStringContainsString('<td class="angka">58.270.274</td>', $html);
        $this->assertStringContainsString('<td class="angka">10.594.595</td>', $html);
        // Excel asli menghitung GRAND TOTAL dari PPN & PPh yang belum dibulatkan (577.405.438); aplikasi
        // menjumlahkan baris yang tercetak: 588.000.034 − 10.594.595.
        $this->assertSame(577_405_439, $invoice->total_amount);
        $this->assertStringContainsString('577.405.439', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE</th>', $html);
        $this->assertStringNotContainsString('Exchange Rate', $html);
        $this->assertStringNotContainsString('<tr class="baris-tagihan_usd">', $html);
    }

    public function test_kotak_mengikuti_isian_profil(): void
    {
        CompanyProfile::current()->update([
            'phone' => '',
            'signature_city' => null,
            'bank_accounts' => [
                ['bank' => 'BCA', 'account_number' => '111-222', 'account_name' => 'PT. AOE'],
                ['bank' => 'BRI', 'account_number' => '333-444', 'account_name' => 'PT. AOE'],
            ],
        ]);

        $html = $this->render($this->invoiceFinal());

        $this->assertStringNotContainsString('Telepon:', $html);
        $this->assertStringContainsString('<div class="bank">BCA</div>', $html);
        $this->assertStringContainsString('<div class="bank rekening-lain">BRI</div>', $html);
        $this->assertStringContainsString('333-444', $html);
        $this->assertStringNotContainsString('000-00-0000000-0', $html);
        // Kota kosong: tanggal saja.
        $this->assertStringContainsString('<div>3 November 2026</div>', $html);
    }

    public function test_editor_aoe_menawarkan_debit_note_dan_nomornya_seperti_dokumen_asli(): void
    {
        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')->assertInertia(fn ($page) => $page
            ->where('documents.debitNote', true)
            ->where('documents.code', true));

        $final = $this->invoiceFinal();
        $pnbp = $this->debitNotePnbp();

        $this->assertSame('001/AOE-CDS/INV-FINAL/XI/2026', $final->invoice_number);
        $this->assertSame('002/AOE-CDS/DN-PNBP/XI/2026', $pnbp->invoice_number);

        // Invoice dipotong PPh 23 2% (pengaturan AOE); Debit Note talangan: tanpa PPN, tanpa PPh.
        $this->assertSame('2.00', $final->pph_rate);
        $this->assertSame(579_880_000, $final->total_amount);
        $this->assertTrue($pnbp->isDebitNote());
        $this->assertTrue($pnbp->items->every('is_tax_deposit'));
        $this->assertSame(0, $pnbp->ppn_amount);
        $this->assertNull($pnbp->pph_rate);
        $this->assertSame(0, $pnbp->gross_profit);
        $this->assertSame(25_000_000, $pnbp->total_amount);
    }

    public function test_pdf_debit_note_aoe_meniru_tabel_excel_dokumen_asli(): void
    {
        $debitNote = $this->debitNotePnbp();

        tenancy()->initialize(Company::findOrFail(self::AOE));
        try {
            $this->assertTrue(CompanyInvoiceTemplate::supportsDebitNote());
            $this->assertSame('pdf.perusahaan.abdi-ocean-energy.debit-note', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $debitNote));
        } finally {
            tenancy()->end();
        }

        $html = $this->render($debitNote);

        $this->assertMatchesRegularExpression('#<table class="judul">\s*<tr>\s*<td>DEBIT NOTE</td>#', $html);
        $this->assertStringContainsString('<title>Debit Note 001/AOE-CDS/DN-PNBP/XI/2026</title>', $html);
        $this->assertStringContainsString('Debit Note PNBP JASA MV. CONTOH PROSPER', $html);
        // Logo, klien, kotak alamat & rekening, dan tanda tangan sama dengan invoice AOE.
        $this->assertStringContainsString('<img class="logo" src="data:image/png;base64,', $html);
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);
        $this->assertStringContainsString('000-00-0000000-0', $html);
        $this->assertStringContainsString('Samarinda, 3 November 2026', $html);
        // Tabel: judul kolom kapital di atas biru tua, rincian satu per baris, nominal ber-",00".
        $this->assertStringContainsString('background-color: #215f9a;', $html);
        $this->assertStringContainsString('<table class="items-table">', $html);
        $this->assertStringContainsString('<th class="c-no">NO</th>', $html);
        $this->assertStringContainsString('<th class="c-ket">KETERANGAN</th>', $html);
        $this->assertStringContainsString('<th class="c-total">TOTAL (Rp)</th>', $html);
        $this->assertStringNotContainsString('<th class="c-qty">', $html);
        $this->assertStringNotContainsString('<th class="c-price">', $html);
        $this->assertStringContainsString('Kode Billing: 820260000000002<br />', $html);
        $this->assertStringContainsString('<td class="angka">25.000.000,00</td>', $html);
        // Baris akhir "Total Debit Note", bukan GRAND TOTAL.
        $this->assertMatchesRegularExpression('#<tr class="baris-tagihan">\s*<td colspan="2" class="label">Total Debit Note</td>#', $html);
        $this->assertStringNotContainsString('GRAND TOTAL', $html);
        // Talangan: tanpa baris PPN/PPh (cek penanda baris; logo base64 bisa memuat huruf apa pun).
        $this->assertStringNotContainsString('<tr class="baris-ppn">', $html);
        $this->assertStringNotContainsString('<tr class="baris-pph">', $html);
        $this->assertStringNotContainsString('<tr class="baris-bruto">', $html);
        $this->assertStringNotContainsString('I N V O I C E', $html);

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$debitNote->id}/download")
            ->assertOk()
            ->assertDownload('Debit-Note-001-AOE-CDS-DN-PNBP-XI-2026.pdf');
    }

    public function test_pdf_debit_note_aoe_berkolom_quantity_dan_price_bila_qty_bukan_satu(): void
    {
        $html = $this->render($this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'DEM', 'Debit Note DEMURRAGE MV. CONTOH PROSPER', [[
            'service_name' => 'MV. CONTOH PROSPER',
            'description' => "On Board : 30 Oktober 2026\nDemurrage : 3 Hari",
            'quantity' => 3,
            'unit' => 'Day',
            'unit_price' => 5_000_000,
        ]]));

        $this->assertStringContainsString('<table class="items-table rinci">', $html);
        $this->assertStringContainsString('<th class="c-qty">QUANTITY (DAY)</th>', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE</th>', $html);
        $this->assertStringContainsString('<td class="c-qty">3</td>', $html);
        $this->assertStringContainsString('<td class="angka">5.000.000,00</td>', $html);
        $this->assertStringContainsString('<td class="angka">15.000.000,00</td>', $html);
        $this->assertStringContainsString('On Board : 30 Oktober 2026<br />', $html);
        $this->assertMatchesRegularExpression('#<td colspan="4" class="label">Total Debit Note</td>#', $html);
    }

    public function test_pdf_debit_note_aoe_uang_muka_dan_pelunasan_memakai_kata_debit_note(): void
    {
        $debitNote = $this->debitNotePnbp();

        $dp = $this->render($debitNote, dpAmount: 5_000_000);
        $this->assertStringContainsString('Total Debit Note', $dp);
        $this->assertStringContainsString('TAGIHAN UANG MUKA', $dp);
        $this->assertStringNotContainsString('Total Invoice', $dp);
        $this->assertStringNotContainsString('GRAND TOTAL', $dp);

        Payment::factory()->create(['invoice_id' => $debitNote->id, 'amount' => 5_000_000]);
        $pelunasan = $this->render($debitNote->refresh(), pelunasanAmount: 20_000_000);
        $this->assertStringContainsString('Total Debit Note', $pelunasan);
        $this->assertStringContainsString('Pembayaran Diterima', $pelunasan);
        $this->assertStringContainsString('TAGIHAN PELUNASAN', $pelunasan);
        $this->assertStringContainsString('<td class="angka">20.000.000,00</td>', $pelunasan);
    }

    public function test_migrasi_menyiapkan_debit_note_aoe_saja_dan_idempoten(): void
    {
        CompanyProfile::current()->update(['invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}']);
        $lama = collect(['113/AOE-CDS/INV/XI/2026', '115/AOE-CDS/INV-FINAL/XI/2026', '117/AOE-CDS/DN-PNBP/XI/2026'])
            ->map(fn (string $nomor) => Invoice::factory()->sent()->create([
                'billed_to_id' => $this->client->id,
                'issue_date' => '2026-11-03',
                'invoice_number' => $nomor,
            ]));
        // Format lama: nomor berkode tidak cocok, urutannya kosong.
        $this->assertSame([113, null, null], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());

        $migrasi = require database_path('migrations/tenant/2026_11_20_141222_siapkan_debit_note_aoe.php');

        // Perusahaan lain (termasuk MKB) tidak tersentuh.
        foreach ([self::TEST_COMPANY, 'mitra-kellian-baruna'] as $lain) {
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
        $this->assertSame(0, TransactionCategory::where('label', 'Bayar Talangan Klien')->count());

        tenancy()->initialize(Company::findOrFail(self::AOE));
        try {
            $migrasi->up();
            $migrasi->up();
        } finally {
            tenancy()->end();
        }

        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertSame([113, 115, 117], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());
        $this->assertSame([null, 'FINAL', null], $lama->map(fn (Invoice $i) => $i->fresh()->document_code)->all());
        // Nomor berawalan DN tidak diubah jenisnya (itemnya tercatat sebagai pendapatan, tinjau manual).
        $this->assertSame(Invoice::TYPE_INVOICE, $lama[2]->fresh()->document_type);
        $this->assertSame('118/AOE-CDS/INV-FINAL/XI/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-11-04'), $this->client->id, Invoice::TYPE_INVOICE, 'FINAL'));

        $sub = TransactionCategory::where('label', 'Bayar Talangan Klien')->sole();
        $this->assertSame('financing', $sub->type);
        $this->assertNull($sub->pl_group);
        $this->assertSame('Talangan Klien', $sub->parent->label);
        $this->assertSame(1, TransactionCategory::where('label', 'Talangan Klien')->count());
    }
}
