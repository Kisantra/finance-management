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
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Debit Note PT BAS: template `berkah-andalan-samboja/debit-note.blade.php` ditiru dari Debit Note Word BAS
 * (PNBP, DEMMURAGE, OPERASIONAL). Aturan jenis dokumen sama dengan SLU (DebitNoteTest): semua item
 * talangan, tanpa PPN/PPh, nomor ber-{KODE} satu urutan dengan invoice.
 */
class DebitNoteBasTest extends TestCase
{
    use RefreshDatabase;

    private const BAS = 'berkah-andalan-samboja';

    private const BASE = '/c/'.self::BAS;

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

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::BAS], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Berkah Andalan Samboja',
            'abbreviation' => 'BAS',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::BAS]);
        setPermissionsTeamId(self::BAS);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        // Suite ini satu database: satu profil untuk semua perusahaan, berisi data & format nomor BAS.
        CompanyProfile::factory()->create([
            'name' => 'PT. BERKAH ANDALAN SAMBOJA',
            'abbreviation' => 'BAS',
            'address' => "JL. CONTOH NO. 1\nKALIMANTAN TIMUR",
            'phone' => '0811-0000-000',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'pph_enabled' => true,
            'pph_rate' => 0.5,
            'finance_manager_name' => 'Nama Direktur',
            'finance_manager_position' => 'Direktur Utama',
            'signature_city' => 'Samarinda',
            'signature_path' => null,
            'stamp_path' => null,
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create([
            'name' => 'PT. CONTOH ENERGI SAMUDRA',
            'alias' => 'CES',
            'address' => 'Jl. Contoh Pelabuhan No. 5, Kabupaten Kutai Kartanegara',
            'person_in_charge' => 'Direktur Finance & Accounting',
        ]);

        $this->travelTo(Carbon::parse('2026-02-24 10:00:00'));
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function dokumen(string $type, ?string $code, string $subject, array $items, bool $publish = true): Invoice
    {
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', [
            'client_id' => $this->client->id,
            'issue_date' => '2026-02-24',
            'due_date' => '2026-03-10',
            'subject' => $subject,
            'document_type' => $type,
            'document_code' => $code,
            'publish' => $publish,
            'items' => collect($items)->map(fn (array $item) => [
                'unit' => 'LS',
                'cogs_amount' => 0,
                'is_tax_deposit' => false,
                ...$item,
            ])->all(),
        ])->assertSessionHasNoErrors();

        return Invoice::with('items')->latest('id')->firstOrFail();
    }

    private function debitNotePnbp(): Invoice
    {
        return $this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'PNBP', 'Debit Note PNBP ALAT MV. CONTOH PERKASA', [[
            'service_name' => 'Tagihan PNBP ALAT MV. CONTOH PERKASA',
            'description' => "Nota Tagihan : 820261028000001\nNTPN : 0A00CONTOH000001",
            'quantity' => 1,
            'unit_price' => 12_500_000,
        ]]);
    }

    private function debitNoteDemurrage(): Invoice
    {
        return $this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'DEM', 'Debit Note DEMMURAGE MV. CONTOH PERKASA', [[
            'service_name' => 'MV. CONTOH PERKASA',
            'description' => "Kontrak Kerja 8 Hari\nOn Board : 13 Februari 2026\nComplete : 24 Februari 2026\nDemmurage : 3 Hari",
            'quantity' => 3,
            'unit' => 'Day',
            'unit_price' => 5_000_000,
        ]]);
    }

    private function render(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null): string
    {
        tenancy()->initialize(Company::findOrFail(self::BAS));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), $dpAmount, $pelunasanAmount, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_editor_bas_menawarkan_debit_note_dan_nomornya_seperti_dokumen_asli(): void
    {
        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')->assertInertia(fn ($page) => $page
            ->where('documents.debitNote', true)
            ->where('documents.code', true));

        $final = $this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH PERKASA', [[
            'service_name' => 'MV. CONTOH PERKASA',
            'quantity' => 1000,
            'unit' => 'MT',
            'unit_price' => 10_000,
        ]]);
        $pnbp = $this->debitNotePnbp();
        $demurrage = $this->debitNoteDemurrage();

        $this->assertSame('001/BAS-CES/INV-FINAL/II/2026', $final->invoice_number);
        $this->assertSame('002/BAS-CES/DN-PNBP/II/2026', $pnbp->invoice_number);
        $this->assertSame('003/BAS-CES/DN-DEM/II/2026', $demurrage->invoice_number);

        // Invoice dipotong PPh 23 0,5% (pengaturan BAS); Debit Note talangan: tanpa PPN, tanpa PPh.
        $this->assertSame('0.50', $final->pph_rate);
        // 10.000.000 + PPN 1.100.000 − PPh 23 0,5% 50.000.
        $this->assertSame(11_050_000, $final->total_amount);
        foreach ([$pnbp, $demurrage] as $debitNote) {
            $this->assertTrue($debitNote->isDebitNote());
            $this->assertTrue($debitNote->items->every('is_tax_deposit'));
            $this->assertSame(0, $debitNote->ppn_amount);
            $this->assertNull($debitNote->pph_rate);
            $this->assertSame(0, $debitNote->gross_profit);
        }
        $this->assertSame(12_500_000, $pnbp->total_amount);
        $this->assertSame(15_000_000, $demurrage->total_amount);
    }

    public function test_pdf_debit_note_bas_tagihan_sekali_bayar_tanpa_kolom_day_dan_price(): void
    {
        $debitNote = $this->debitNotePnbp();
        $invoice = $this->dokumen(Invoice::TYPE_INVOICE, 'FINAL', 'Invoice FINAL MV. CONTOH PERKASA', [[
            'service_name' => 'MV. CONTOH PERKASA', 'quantity' => 1000, 'unit' => 'MT', 'unit_price' => 10_000,
        ]]);

        tenancy()->initialize(Company::findOrFail(self::BAS));
        try {
            $this->assertTrue(CompanyInvoiceTemplate::supportsDebitNote());
            $this->assertSame('pdf.perusahaan.berkah-andalan-samboja.debit-note', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $debitNote));
            $this->assertSame('pdf.perusahaan.berkah-andalan-samboja.invoice', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice));
        } finally {
            tenancy()->end();
        }

        $html = $this->render($debitNote);

        $this->assertStringContainsString('<td>DEBIT NOTE</td>', $html);
        $this->assertStringContainsString('<title>Debit Note 001/BAS-CES/DN-PNBP/II/2026</title>', $html);
        $this->assertStringContainsString('Debit Note PNBP ALAT MV. CONTOH PERKASA', $html);
        // Kop, klien, kotak alamat & rekening, dan tanda tangan sama dengan invoice BAS.
        $this->assertStringContainsString('Telegraphic Transfer (T/T)', $html);
        $this->assertStringContainsString('000-00-0000000', $html);
        $this->assertStringContainsString('Samarinda, 24 Februari 2026', $html);
        // Tabel: NO · KETERANGAN · TOTAL (Rp), nota tagihan & NTPN di keterangan item.
        $this->assertStringContainsString('<table class="items-table">', $html);
        $this->assertStringContainsString('<th class="c-ket">KETERANGAN</th>', $html);
        $this->assertStringNotContainsString('<th class="c-qty">', $html);
        $this->assertStringNotContainsString('<th class="c-price">', $html);
        $this->assertStringContainsString('Nota Tagihan : 820261028000001<br />', $html);
        $this->assertMatchesRegularExpression('#<td colspan="2" class="label">GRAND TOTAL</td>#', $html);
        $this->assertStringContainsString('12.500.000', $html);
        $this->assertStringNotContainsString('PPN', $html);
        $this->assertStringNotContainsString('PPh', $html);
        $this->assertStringNotContainsString('I N V O I C E', $html);

        $this->assertStringContainsString('<td>I N V O I C E</td>', $this->render($invoice));

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$debitNote->id}/download")
            ->assertOk()
            ->assertDownload('Debit-Note-001-BAS-CES-DN-PNBP-II-2026.pdf');
        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$debitNote->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_pdf_debit_note_bas_berkolom_day_dan_price_bila_qty_bukan_satu(): void
    {
        $html = $this->render($this->debitNoteDemurrage());

        $this->assertStringContainsString('<table class="items-table rinci">', $html);
        $this->assertStringContainsString('<th class="c-qty">DAY</th>', $html);
        $this->assertStringContainsString('<th class="c-price">PRICE</th>', $html);
        $this->assertStringContainsString('<td class="c-qty">3</td>', $html);
        $this->assertStringContainsString('5.000.000', $html);
        $this->assertStringContainsString('15.000.000', $html);
        $this->assertStringContainsString('Demmurage : 3 Hari', $html);
        $this->assertMatchesRegularExpression('#<td colspan="4" class="label">GRAND TOTAL</td>#', $html);

        // Satuan berbeda per item: judul kolom QTY, satuan di tiap baris.
        $campuran = $this->dokumen(Invoice::TYPE_DEBIT_NOTE, 'OPS', 'Debit Note OPERASIONAL MV. CONTOH PERKASA', [
            ['service_name' => 'Tagihan Biaya Operasional', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 30_000_000],
            ['service_name' => 'Sewa tug boat', 'quantity' => 2, 'unit' => 'Day', 'unit_price' => 4_000_000],
        ]);
        $html = $this->render($campuran);
        $this->assertStringContainsString('<th class="c-qty">QTY</th>', $html);
        $this->assertStringContainsString('<td class="c-qty">1 LS</td>', $html);
        $this->assertStringContainsString('<td class="c-qty">2 Day</td>', $html);
        $this->assertStringContainsString('38.000.000', $html);
    }

    public function test_pdf_debit_note_bas_uang_muka_dan_pelunasan_memakai_kata_debit_note(): void
    {
        $debitNote = $this->debitNoteDemurrage();

        $dp = $this->render($debitNote, dpAmount: 5_000_000);
        $this->assertStringContainsString('Total Debit Note', $dp);
        $this->assertStringContainsString('TAGIHAN UANG MUKA', $dp);
        $this->assertStringNotContainsString('Total Invoice', $dp);
        $this->assertStringNotContainsString('>GRAND TOTAL<', $dp);

        Payment::factory()->create(['invoice_id' => $debitNote->id, 'amount' => 5_000_000]);
        $pelunasan = $this->render($debitNote->refresh(), pelunasanAmount: 10_000_000);
        $this->assertStringContainsString('Total Debit Note', $pelunasan);
        $this->assertStringContainsString('Pembayaran Diterima', $pelunasan);
        $this->assertStringContainsString('TAGIHAN PELUNASAN', $pelunasan);
        $this->assertStringContainsString('10.000.000', $pelunasan);
    }

    public function test_migrasi_menyiapkan_debit_note_bas_saja_dan_idempoten(): void
    {
        CompanyProfile::current()->update(['invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}']);
        $lama = collect(['004/BAS-CES/INV/II/2026', '005/BAS-CES/INV-FINAL/II/2026', '006/BAS-CES/DN-PNBP/II/2026'])
            ->map(fn (string $nomor) => Invoice::factory()->sent()->create([
                'billed_to_id' => $this->client->id,
                'issue_date' => '2026-02-24',
                'invoice_number' => $nomor,
            ]));
        // Format lama: nomor berkode tidak cocok, urutannya kosong.
        $this->assertSame([4, null, null], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());

        $migrasi = require database_path('migrations/tenant/2026_11_19_132642_siapkan_debit_note_bas.php');

        // Perusahaan lain (termasuk SLU) tidak tersentuh.
        foreach ([self::TEST_COMPANY, 'samboja-laju-utama'] as $lain) {
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

        tenancy()->initialize(Company::findOrFail(self::BAS));
        try {
            $migrasi->up();
            $migrasi->up();
        } finally {
            tenancy()->end();
        }

        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertSame([4, 5, 6], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());
        $this->assertSame([null, 'FINAL', null], $lama->map(fn (Invoice $i) => $i->fresh()->document_code)->all());
        // Nomor berawalan DN tidak diubah jenisnya (itemnya tercatat sebagai pendapatan, tinjau manual).
        $this->assertSame(Invoice::TYPE_INVOICE, $lama[2]->fresh()->document_type);
        $this->assertSame('007/BAS-CES/DN-OPS/II/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-02-25'), $this->client->id, Invoice::TYPE_DEBIT_NOTE, 'OPS'));

        $sub = TransactionCategory::where('label', 'Bayar Talangan Klien')->sole();
        $this->assertSame('financing', $sub->type);
        $this->assertNull($sub->pl_group);
        $this->assertSame('Talangan Klien', $sub->parent->label);
        $this->assertSame(1, TransactionCategory::where('label', 'Talangan Klien')->count());
    }
}
