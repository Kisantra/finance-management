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
 * Template invoice & Debit Note PT MKB (`mitra-kellian-baruna/`), ditiru dari dokumen Word MKB (INVOICE
 * FINAL/MOORING/FENDER, DEBIT NOTE OVERTIME): kop surat di setiap halaman, tabel Excel berjudul kolom hijau,
 * potongan PPh 23 merah, kotak alamat & rekening, tanda tangan. Aturan jenis dokumen sama dengan SLU/BAS
 * (DebitNoteTest, DebitNoteBasTest): Debit Note = semua item talangan, tanpa PPN/PPh, nomor ber-{KODE} satu
 * urutan dengan invoice.
 */
class TemplateInvoiceMkbTest extends TestCase
{
    use RefreshDatabase;

    private const MKB = 'mitra-kellian-baruna';

    private const BASE = '/c/'.self::MKB;

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

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::MKB], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Mitra Kellian Baruna',
            'abbreviation' => 'MKB',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::MKB]);
        setPermissionsTeamId(self::MKB);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        // Suite ini satu database: satu profil untuk semua perusahaan, berisi data & format nomor MKB.
        CompanyProfile::factory()->create([
            'name' => 'PT. Mitra Kellian Baruna',
            'abbreviation' => 'MKB',
            'address' => "Jl. Contoh No. 1 RT.24,\nKota Samarinda, Kalimantan Timur",
            'email' => 'mkb@example.com',
            'phone' => '0812 0000 000',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'pph_enabled' => true,
            'pph_rate' => 2,
            'finance_manager_name' => 'Nama Direktur',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'signature_path' => null,
            'stamp_path' => null,
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-000-000000-0', 'account_name' => 'PT. MITRA KELLIAN BARUNA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create([
            'name' => 'PT. CONTOH TAMBANG BERSAUDARA',
            'alias' => 'CTB',
            'address' => "Jl. Contoh Pelabuhan No. 7,\nKota Samarinda, Kalimantan Timur 75242",
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);

        $this->travelTo(Carbon::parse('2026-10-15 10:00:00'));
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
            'issue_date' => '2026-10-15',
            'due_date' => '2026-10-29',
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
        return $this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH HARMONY', [[
            'service_name' => 'MV. CONTOH HARMONY',
            'description' => 'Loading Port : Muara Berau Anchorage (stevedoring)',
            'quantity' => 50000,
            'unit' => 'MT',
            'unit_price' => 13_500,
        ]]);
    }

    private function debitNoteOvertime(): Invoice
    {
        return $this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'OT', 'Debit Note Overtime Hari Libur MV. CONTOH HARMONY', [[
            'service_name' => 'Tagihan Overtime Hari Libur MV. CONTOH HARMONY',
            'quantity' => 1,
            'unit_price' => 12_000_000,
        ]]);
    }

    private function render(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null): string
    {
        tenancy()->initialize(Company::findOrFail(self::MKB));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), $dpAmount, $pelunasanAmount, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_mkb_hanya_memakai_template_mkb_dengan_font_tertanam(): void
    {
        $invoice = $this->invoiceFinal();

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/preview?template=kisantra-invoice")->assertNotFound();
        $this->actingAs($this->admin)->get(self::BASE.'/invoices')
            ->assertInertia(fn ($page) => $page->where('companyTemplate', ['value' => 'perusahaan', 'label' => 'PT Mitra Kellian Baruna']));

        $response = $this->actingAs($this->admin)->post(self::BASE.'/invoices/preview', [
            'client_id' => $this->client->id,
            'subject' => 'Invoice FINAL MV. CONTOH HARMONY',
            'issue_date' => '2026-10-15',
            'due_date' => '2026-10-29',
            'items' => [['service_name' => 'MV. CONTOH HARMONY', 'quantity' => 50000, 'unit' => 'MT', 'unit_price' => 13_500, 'cogs_amount' => 0, 'is_tax_deposit' => false]],
        ]);

        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        // Times New Roman → Tinos (semua teks), Cambria → Caladea (kotak info), Arial → Arimo (alamat di
        // kotak alamat), dari fonts/; tanpa Calibri/Carlito seperti dokumen asli.
        foreach (['Tinos-Regular', 'Tinos-Bold', 'Caladea-Regular', 'Caladea-Bold', 'Arimo-Regular'] as $font) {
            $this->assertStringContainsString($font, $response->getContent());
        }
        $this->assertStringNotContainsString('Carlito', $response->getContent());

        tenancy()->initialize(Company::findOrFail(self::MKB));
        try {
            $this->assertSame('pdf.perusahaan.mitra-kellian-baruna.invoice', CompanyInvoiceTemplate::view());
            $this->assertStringStartsWith('data:image/png;base64,', CompanyInvoiceTemplate::asset('logo.png'));
            $this->assertSame('', CompanyInvoiceTemplate::path('fonts/Carlito-Bold.ttf'), 'font SLU/BAS bukan milik MKB');
        } finally {
            tenancy()->end();
        }
    }

    public function test_invoice_mkb_menampilkan_kop_tabel_dan_data_dari_profil(): void
    {
        Storage::fake('public')->put('images/ttd.png', 'ttd-unggahan');
        CompanyProfile::current()->update(['signature_path' => 'images/ttd.png']);

        $html = $this->render($this->invoiceFinal());

        // Kop (header Word): logo, nama kapital, bidang usaha statis, alamat per baris, telepon & email.
        $this->assertStringContainsString('<img class="logo" src="data:image/png;base64,', $html);
        $this->assertStringContainsString('<div class="nama">PT. MITRA KELLIAN BARUNA</div>', $html);
        $this->assertStringContainsString('<div class="bidang">Stevedoring Company</div>', $html);
        $this->assertStringContainsString('<div class="alamat">Jl. Contoh No. 1 RT.24,<br />', $html);
        $this->assertStringContainsString('<div class="kontak">Tlp.Kantor/WA : 0812 0000 000 Email : mkb@example.com</div>', $html);
        $this->assertStringContainsString('<div class="judul">I N V O I C E</div>', $html);
        $this->assertStringContainsString('<title>Invoice 001/MKB-CTB/INV-FINAL/X/2026</title>', $html);

        // Blok klien.
        $this->assertStringContainsString('001/MKB-CTB/INV-FINAL/X/2026', $html);
        $this->assertStringContainsString('Invoice FINAL MV. CONTOH HARMONY', $html);
        $this->assertStringContainsString('PT. CONTOH TAMBANG BERSAUDARA', $html);
        $this->assertStringContainsString('Jl. Contoh Pelabuhan No. 7,<br />', $html);
        $this->assertStringContainsString('Direktur Finance &amp; Accounting', $html);
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);

        // Tabel Excel: Quantity (MT) · PRICE · TOTAL, lalu baris total InvoiceTotalRows.
        $this->assertStringContainsString('<th class="c-qty">Quantity (MT)</th>', $html);
        $this->assertStringContainsString('Loading Port : Muara Berau Anchorage (stevedoring)', $html);
        $this->assertStringContainsString('50.000', $html);
        $this->assertStringContainsString('13.500', $html);
        $this->assertStringContainsString('Total Invoice (Sebelum PPN)', $html);
        $this->assertStringContainsString('675.000.000', $html);
        $this->assertStringContainsString('74.250.000', $html);
        // "PPH" kapital hanya di baris potongan, seperti dokumen asli.
        $this->assertStringContainsString('Total Invoice + PPN (belum dipotong PPh)', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-pph">\s*<td class="c-no">3</td>\s*<td colspan="3" class="label">PPH 23 \(2%\)</td>#', $html);
        $this->assertStringContainsString('13.500.000', $html);
        $this->assertStringContainsString('GRAND TOTAL', $html);
        $this->assertStringContainsString('735.750.000', $html);

        // Kotak alamat & rekening, kota-tanggal, penanda tangan, dan tanda tangan unggahan.
        $this->assertStringContainsString('<div class="arial">Jl. Contoh No. 1 RT.24,<br />', $html);
        $this->assertStringContainsString('<div class="tebal">Telepon: 0812 0000 000</div>', $html);
        $this->assertStringContainsString('<div class="bank">Bank Contoh</div>', $html);
        $this->assertStringContainsString('Nomor rekening bank: <span class="nomor-rekening">000-000-000000-0</span>', $html);
        $this->assertStringContainsString('Samarinda, 15 Oktober 2026', $html);
        $this->assertStringContainsString('<div class="nama">Nama Direktur</div>', $html);
        $this->assertStringContainsString('<div class="jabatan">Direktur Utama</div>', $html);
        $this->assertStringContainsString('src="data:image/png;base64,'.base64_encode('ttd-unggahan').'"', $html);
    }

    public function test_invoice_rupiah_bertarif_usd_mencetak_kurs_dan_tarif_seperti_dokumen_asli(): void
    {
        CompanyProfile::current()->update(['foreign_currency_enabled' => true]);

        $html = $this->render($this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH HARMONY', [[
            'service_name' => 'MV. CONTOH HARMONY',
            'quantity' => 55070,
            'unit' => 'MT',
            'unit_price' => 0,
            'foreign_unit_price' => 0.75,
        ]], ['exchange_rate' => 17898]));

        // Invoice FINAL 046 MKB: kurs & tarif di blok klien, harga Rupiah bersen, total sama dengan Excel.
        $this->assertMatchesRegularExpression('#<td class="label">Exchange Rate</td>\s*<td class="titik">:</td>\s*<td>Rp 17\.898,-</td>#', $html);
        $this->assertStringContainsString('<td>0,75 $</td>', $html);
        $this->assertStringContainsString('<td>17.898 x 0,75 $ = Rp 13.423,50</td>', $html);
        $this->assertStringContainsString('<td class="angka">13.423,50</td>', $html);
        $this->assertStringContainsString('<td class="angka">739.232.145</td>', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE</th>', $html);
        $this->assertStringNotContainsString('<tr class="baris-tagihan_usd">', $html);
    }

    public function test_kop_dan_kotak_mengikuti_isian_profil(): void
    {
        CompanyProfile::current()->update([
            'email' => '',
            'signature_city' => null,
            'bank_accounts' => [
                ['bank' => 'BCA', 'account_number' => '111-222', 'account_name' => 'PT. MKB'],
                ['bank' => 'BRI', 'account_number' => '333-444', 'account_name' => 'PT. MKB'],
            ],
        ]);

        $html = $this->render($this->invoiceFinal());

        $this->assertStringContainsString('<div class="kontak">Tlp.Kantor/WA : 0812 0000 000</div>', $html);
        $this->assertStringNotContainsString('Email :', $html);
        $this->assertStringContainsString('<div class="bank">BCA</div>', $html);
        $this->assertStringContainsString('<div class="bank rekening-lain">BRI</div>', $html);
        $this->assertStringContainsString('333-444', $html);
        $this->assertStringNotContainsString('000-000-000000-0', $html);
        // Kota kosong: tanggal saja.
        $this->assertStringContainsString('<div>15 Oktober 2026</div>', $html);
    }

    public function test_editor_mkb_menawarkan_debit_note_dan_nomornya_seperti_dokumen_asli(): void
    {
        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')->assertInertia(fn ($page) => $page
            ->where('documents.debitNote', true)
            ->where('documents.code', true));

        $final = $this->invoiceFinal();
        $mooring = $this->dokumen(Invoice::TYPE_INVOICE, 'MOORING', 'Invoice MOORING UNMOORING MV. CONTOH HARMONY', [[
            'service_name' => 'MV. CONTOH HARMONY', 'quantity' => 50000, 'unit' => 'MT', 'unit_price' => 400,
        ]]);
        $overtime = $this->debitNoteOvertime();

        $this->assertSame('001/MKB-CTB/INV-FINAL/X/2026', $final->invoice_number);
        $this->assertSame('002/MKB-CTB/INV-MOORING/X/2026', $mooring->invoice_number);
        $this->assertSame('003/MKB-CTB/DN-OT/X/2026', $overtime->invoice_number);

        // Invoice dipotong PPh 23 2% (pengaturan MKB); Debit Note talangan: tanpa PPN, tanpa PPh.
        $this->assertSame('2.00', $final->pph_rate);
        // 675.000.000 + PPN 74.250.000 − PPh 23 2% 13.500.000.
        $this->assertSame(735_750_000, $final->total_amount);
        $this->assertTrue($overtime->isDebitNote());
        $this->assertTrue($overtime->items->every('is_tax_deposit'));
        $this->assertSame(0, $overtime->ppn_amount);
        $this->assertNull($overtime->pph_rate);
        $this->assertSame(0, $overtime->gross_profit);
        $this->assertSame(12_000_000, $overtime->total_amount);
    }

    public function test_pdf_debit_note_mkb_tagihan_sekali_bayar_tanpa_kolom_quantity_dan_price(): void
    {
        $debitNote = $this->debitNoteOvertime();

        tenancy()->initialize(Company::findOrFail(self::MKB));
        try {
            $this->assertTrue(CompanyInvoiceTemplate::supportsDebitNote());
            $this->assertSame('pdf.perusahaan.mitra-kellian-baruna.debit-note', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $debitNote));
        } finally {
            tenancy()->end();
        }

        $html = $this->render($debitNote);

        $this->assertStringContainsString('<div class="judul">DEBIT NOTE</div>', $html);
        $this->assertStringContainsString('<title>Debit Note 001/MKB-CTB/DN-OT/X/2026</title>', $html);
        $this->assertStringContainsString('Debit Note Overtime Hari Libur MV. CONTOH HARMONY', $html);
        // Kop, klien, kotak alamat & rekening, dan tanda tangan sama dengan invoice MKB.
        $this->assertStringContainsString('<div class="bidang">Stevedoring Company</div>', $html);
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);
        $this->assertStringContainsString('000-000-000000-0', $html);
        $this->assertStringContainsString('Samarinda, 15 Oktober 2026', $html);
        // Tabel: No · Keterangan · TOTAL (Rp).
        $this->assertStringContainsString('<table class="items-table">', $html);
        $this->assertStringContainsString('<th class="c-ket">Keterangan</th>', $html);
        $this->assertStringNotContainsString('<th class="c-qty">', $html);
        $this->assertStringNotContainsString('<th class="c-price">', $html);
        $this->assertMatchesRegularExpression('#<td colspan="2" class="label">GRAND TOTAL</td>#', $html);
        $this->assertStringContainsString('12.000.000', $html);
        // Talangan: tanpa baris PPN/PPh (cek penanda baris; logo base64 bisa memuat huruf apa pun).
        $this->assertStringNotContainsString('baris-ppn', $html);
        $this->assertStringNotContainsString('baris-pph', $html);
        $this->assertStringNotContainsString('baris-bruto', $html);
        $this->assertStringNotContainsString('I N V O I C E', $html);

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$debitNote->id}/download")
            ->assertOk()
            ->assertDownload('Debit-Note-001-MKB-CTB-DN-OT-X-2026.pdf');
    }

    public function test_pdf_debit_note_mkb_berkolom_quantity_dan_price_bila_qty_bukan_satu(): void
    {
        $html = $this->render($this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'DEM', 'Debit Note DEMURRAGE MV. CONTOH HARMONY', [[
            'service_name' => 'MV. CONTOH HARMONY',
            'description' => "On Board : 13 Oktober 2026\nDemurrage : 3 Hari",
            'quantity' => 3,
            'unit' => 'Day',
            'unit_price' => 5_000_000,
        ]]));

        $this->assertStringContainsString('<table class="items-table rinci">', $html);
        $this->assertStringContainsString('<th class="c-qty">Quantity (DAY)</th>', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE</th>', $html);
        $this->assertStringContainsString('<td class="c-qty">3</td>', $html);
        $this->assertStringContainsString('5.000.000', $html);
        $this->assertStringContainsString('15.000.000', $html);
        $this->assertStringContainsString('On Board : 13 Oktober 2026<br />', $html);
        $this->assertMatchesRegularExpression('#<td colspan="4" class="label">GRAND TOTAL</td>#', $html);
    }

    public function test_pdf_debit_note_mkb_uang_muka_dan_pelunasan_memakai_kata_debit_note(): void
    {
        $debitNote = $this->debitNoteOvertime();

        $dp = $this->render($debitNote, dpAmount: 5_000_000);
        $this->assertStringContainsString('Total Debit Note', $dp);
        $this->assertStringContainsString('TAGIHAN UANG MUKA', $dp);
        $this->assertStringNotContainsString('Total Invoice', $dp);
        $this->assertStringNotContainsString('>GRAND TOTAL<', $dp);

        Payment::factory()->create(['invoice_id' => $debitNote->id, 'amount' => 5_000_000]);
        $pelunasan = $this->render($debitNote->refresh(), pelunasanAmount: 7_000_000);
        $this->assertStringContainsString('Total Debit Note', $pelunasan);
        $this->assertStringContainsString('Pembayaran Diterima', $pelunasan);
        $this->assertStringContainsString('TAGIHAN PELUNASAN', $pelunasan);
        $this->assertStringContainsString('7.000.000', $pelunasan);
    }

    public function test_migrasi_menyiapkan_debit_note_mkb_saja_dan_idempoten(): void
    {
        CompanyProfile::current()->update(['invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}']);
        $lama = collect(['044/MKB-CTB/INV/X/2026', '046/MKB-CTB/INV-FINAL/X/2026', '047/MKB-CTB/INV-MOORING/X/2026', '037/MKB-CTB/DN-OT/VIII/2026'])
            ->map(fn (string $nomor) => Invoice::factory()->sent()->create([
                'billed_to_id' => $this->client->id,
                'issue_date' => str_contains($nomor, '/VIII/') ? '2026-08-18' : '2026-10-15',
                'invoice_number' => $nomor,
            ]));
        // Format lama: nomor berkode tidak cocok, urutannya kosong.
        $this->assertSame([44, null, null, null], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());

        $migrasi = require database_path('migrations/tenant/2026_11_19_161513_siapkan_debit_note_mkb_bcb.php');

        // Perusahaan lain (termasuk BAS) tidak tersentuh.
        foreach ([self::TEST_COMPANY, 'berkah-andalan-samboja'] as $lain) {
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

        tenancy()->initialize(Company::findOrFail(self::MKB));
        try {
            $migrasi->up();
            $migrasi->up();
        } finally {
            tenancy()->end();
        }

        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertSame([44, 46, 47, 37], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());
        $this->assertSame([null, 'FINAL', 'MOORING', null], $lama->map(fn (Invoice $i) => $i->fresh()->document_code)->all());
        // Nomor berawalan DN tidak diubah jenisnya (itemnya tercatat sebagai pendapatan, tinjau manual).
        $this->assertSame(Invoice::TYPE_INVOICE, $lama[3]->fresh()->document_type);
        $this->assertSame('048/MKB-CTB/INV-FENDER/X/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-10-16'), $this->client->id, Invoice::TYPE_INVOICE, 'FENDER'));

        $sub = TransactionCategory::where('label', 'Bayar Talangan Klien')->sole();
        $this->assertSame('financing', $sub->type);
        $this->assertNull($sub->pl_group);
        $this->assertSame('Talangan Klien', $sub->parent->label);
        $this->assertSame(1, TransactionCategory::where('label', 'Talangan Klien')->count());
    }
}
