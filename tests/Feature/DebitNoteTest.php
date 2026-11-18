<?php

namespace Tests\Feature;

use App\Exports\InvoiceRecapExport;
use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Models\User;
use App\Services\CategoryTemplateService;
use App\Services\CompanyInvoiceTemplate;
use App\Services\InvoicePrintService;
use App\Services\JournalService;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Debit Note PT SLU (docs/design/debit-note-slu/README.md): jenis dokumen di modul Invoice untuk
 * menagih kembali biaya yang SLU bayar lebih dulu atas nama klien. Semua itemnya talangan (titipan),
 * jadi tanpa PPN dan bukan pendapatan; nomornya memakai token {KODE} dan berbagi urutan dengan invoice.
 */
class DebitNoteTest extends TestCase
{
    use RefreshDatabase;

    private const SLU = 'samboja-laju-utama';

    private const BASE = '/c/'.self::SLU;

    private User $admin;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices', 'view dashboard'];
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        Company::withoutEvents(fn () => Company::firstOrCreate(['id' => self::SLU], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => 'PT Samboja Laju Utama',
            'abbreviation' => 'SLU',
            'status' => 'active',
        ]));
        $this->admin->companies()->syncWithoutDetaching([self::SLU]);
        setPermissionsTeamId(self::SLU);
        $this->admin->unsetRelation('roles')->assignRole('admin');
        setPermissionsTeamId(self::TEST_COMPANY);

        // Suite ini satu database: satu profil untuk semua perusahaan, berformat nomor SLU.
        CompanyProfile::factory()->create([
            'name' => 'PT. SAMBOJA LAJU UTAMA',
            'abbreviation' => 'SLU',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'bank_accounts' => [],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create(['name' => 'PT. CONTOH BATUBARA NUSANTARA', 'alias' => 'CBN']);

        $this->travelTo(Carbon::parse('2026-11-18 10:00:00'));
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-18',
            'due_date' => '2026-12-02',
            'subject' => 'Debit Note PNBP MV. CONTOH JAYA',
            'document_type' => Invoice::TYPE_DEBIT_NOTE,
            'document_code' => 'PNBP',
            'items' => [
                ['service_name' => 'PNBP Jasa Kepelabuhanan', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 24_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false],
            ],
        ], $overrides);
    }

    private function debitNote(array $overrides = []): Invoice
    {
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload($overrides))->assertSessionHasNoErrors();

        return Invoice::with('items')->latest('id')->firstOrFail();
    }

    public function test_editor_slu_menawarkan_debit_note_dan_kode_jenis_dengan_saran(): void
    {
        $this->debitNote(['publish' => true]);
        $this->debitNote(['document_type' => Invoice::TYPE_INVOICE, 'document_code' => 'FINAL', 'publish' => true]);
        $this->debitNote(['document_type' => Invoice::TYPE_INVOICE, 'document_code' => 'FINAL']);

        $this->actingAs($this->admin)->get(self::BASE.'/invoices/create')->assertInertia(fn ($page) => $page
            ->where('documents.debitNote', true)
            ->where('documents.code', true)
            ->where('documents.codes', [
                ['value' => 'FINAL', 'type' => Invoice::TYPE_INVOICE],
                ['value' => 'PNBP', 'type' => Invoice::TYPE_DEBIT_NOTE],
            ]));

        // Perusahaan tanpa template Debit Note tidak ditawari jenis dokumen.
        $this->actingAs($this->admin)->get('/invoices/create')
            ->assertInertia(fn ($page) => $page->where('documents.debitNote', false));
    }

    public function test_debit_note_semua_item_talangan_tanpa_ppn_dan_tanpa_laba(): void
    {
        $debitNote = $this->debitNote([
            'apply_ppn' => true,
            'faktur' => '010.000-26.00000001',
            'items' => [
                ['service_name' => 'PNBP', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 24_000_000, 'cogs_amount' => 5_000_000, 'is_tax_deposit' => false],
                ['service_name' => 'Biaya labuh', 'quantity' => 2, 'unit' => 'LS', 'unit_price' => 1_500_000, 'cogs_amount' => 0, 'is_tax_deposit' => false],
            ],
        ]);

        $this->assertTrue($debitNote->isDebitNote());
        $this->assertSame('PNBP', $debitNote->document_code);
        $this->assertSame('draft', $debitNote->status);
        $this->assertTrue($debitNote->items->every('is_tax_deposit'));
        $this->assertSame(0, (int) $debitNote->items->sum('cogs_amount'));
        $this->assertSame('0.00', $debitNote->ppn_rate);
        $this->assertSame(0, $debitNote->ppn_amount);
        $this->assertNull($debitNote->faktur);
        $this->assertSame(27_000_000, $debitNote->total_amount);
        $this->assertSame(0, $debitNote->gross_profit);

        $this->actingAs($this->admin)->getJson(self::BASE."/invoices/{$debitNote->id}/data")
            ->assertJsonPath('document_type', Invoice::TYPE_DEBIT_NOTE)
            ->assertJsonPath('document_code', 'PNBP')
            ->assertJsonPath('tax_deposit_total', 27_000_000)
            ->assertJsonPath('next_invoice_number', '001/SLU-CBN/DN-PNBP/XI/2026');

        $this->actingAs($this->admin)->get(self::BASE."/invoices/{$debitNote->id}/edit")->assertInertia(fn ($page) => $page
            ->where('invoice.document_type', Invoice::TYPE_DEBIT_NOTE)
            ->where('invoice.document_code', 'PNBP'));
    }

    public function test_nomor_memakai_kode_jenis_dan_satu_urutan_dengan_invoice(): void
    {
        $final = $this->debitNote(['document_type' => Invoice::TYPE_INVOICE, 'document_code' => 'FINAL', 'publish' => true]);
        $debitNote = $this->debitNote(['publish' => true]);
        $tanpaKode = $this->debitNote(['document_type' => Invoice::TYPE_INVOICE, 'document_code' => null, 'publish' => true]);

        $this->assertSame('001/SLU-CBN/INV-FINAL/XI/2026', $final->invoice_number);
        $this->assertSame('002/SLU-CBN/DN-PNBP/XI/2026', $debitNote->invoice_number);
        $this->assertSame('003/SLU-CBN/INV/XI/2026', $tanpaKode->invoice_number);
        $this->assertSame([1, 2, 3], Invoice::orderBy('id')->pluck('invoice_sequence')->all());

        $this->actingAs($this->admin)->getJson(self::BASE.'/invoices/next-number?'.http_build_query([
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-20',
            'document_type' => Invoice::TYPE_DEBIT_NOTE,
            'document_code' => 'PNBP',
        ]))->assertOk()->assertJsonPath('number', '004/SLU-CBN/DN-PNBP/XI/2026');

        // Pratinjau editor membawa nomor perkiraan sesuai jenis & kode yang sedang dipilih.
        $this->actingAs($this->admin)->post(self::BASE.'/invoices/preview', $this->payload(['document_code' => 'DEM', 'document_type' => Invoice::TYPE_INVOICE]))
            ->assertOk()
            ->assertHeader('X-Invoice-Number', '004/SLU-CBN/INV-DEM/XI/2026');
    }

    public function test_kode_jenis_dinormalkan_dan_divalidasi(): void
    {
        $debitNote = $this->debitNote(['document_code' => ' dn-pnbp ']);
        $this->assertSame('PNBP', $debitNote->document_code);

        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload(['document_code' => 'PN BP']))
            ->assertSessionHasErrors('document_code');
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload(['document_code' => '']))
            ->assertSessionHasNoErrors();
        $this->assertNull(Invoice::latest('id')->first()->document_code);
    }

    public function test_perusahaan_tanpa_template_debit_note_menolak_debit_note(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload())->assertSessionHasErrors('document_type');
        $this->actingAs($this->admin)->post('/invoices/preview', $this->payload())->assertSessionHasErrors('document_type');
        $this->assertSame(0, Invoice::count());
    }

    public function test_jenis_dan_kode_bisa_diganti_selama_draft_lalu_terkunci_setelah_terbit(): void
    {
        $draft = $this->debitNote();

        $this->actingAs($this->admin)->put(self::BASE."/invoices/{$draft->id}", $this->payload([
            'document_type' => Invoice::TYPE_INVOICE,
            'document_code' => 'FINAL',
            'apply_ppn' => true,
        ]))->assertSessionHasNoErrors();

        $draft->refresh()->load('items');
        $this->assertFalse($draft->isDebitNote());
        $this->assertSame('FINAL', $draft->document_code);
        $this->assertFalse($draft->items->first()->is_tax_deposit);
        $this->assertSame(2_640_000, $draft->ppn_amount);

        $terbit = $this->debitNote(['publish' => true]);
        $this->actingAs($this->admin)->put(self::BASE."/invoices/{$terbit->id}", $this->payload([
            'document_type' => Invoice::TYPE_INVOICE,
            'document_code' => 'FINAL',
            'items' => [
                ['service_name' => 'PNBP Jasa Kepelabuhanan', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 25_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false],
            ],
        ]))->assertSessionHasNoErrors();

        $terbit->refresh()->load('items');
        $this->assertTrue($terbit->isDebitNote(), 'Jenis membentuk nomor yang sudah terbit, jadi tidak berubah.');
        $this->assertSame('PNBP', $terbit->document_code);
        $this->assertSame('001/SLU-CBN/DN-PNBP/XI/2026', $terbit->invoice_number);
        // Isinya tetap bisa diubah, dan tetap talangan.
        $this->assertSame(25_000_000, $terbit->total_amount);
        $this->assertTrue($terbit->items->every('is_tax_deposit'));
    }

    public function test_pdf_debit_note_memakai_template_debit_note_slu(): void
    {
        $debitNote = $this->debitNote(['publish' => true]);
        $invoice = $this->debitNote(['document_type' => Invoice::TYPE_INVOICE, 'document_code' => 'FINAL', 'publish' => true]);

        tenancy()->initialize(Company::findOrFail(self::SLU));

        try {
            $this->assertTrue(CompanyInvoiceTemplate::supportsDebitNote());
            $this->assertSame('pdf.perusahaan.samboja-laju-utama.debit-note', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $debitNote));
            $this->assertSame('pdf.perusahaan.samboja-laju-utama.invoice', CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice));

            $html = view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $debitNote),
                (new InvoicePrintService)->buildViewData($debitNote->load(['client', 'items.client', 'payments']), null, null, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }

        $this->assertStringContainsString('<td>D E B I T &nbsp; N O T E</td>', $html);
        $this->assertStringContainsString('<title>Debit Note 001/SLU-CBN/DN-PNBP/XI/2026</title>', $html);
        $this->assertStringContainsString('Debit Note PNBP MV. CONTOH JAYA', $html);
        $this->assertStringContainsString('GRAND TOTAL', $html);
        $this->assertStringContainsString('24.000.000', $html);
        $this->assertStringNotContainsString('PPN 11%', $html);
        $this->assertStringNotContainsString('I N V O I C E', $html);

        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$debitNote->id}/download")
            ->assertOk()
            ->assertDownload('Debit-Note-001-SLU-CBN-DN-PNBP-XI-2026.pdf');
        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$debitNote->id}/preview")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->admin)->get(self::BASE."/invoice/{$invoice->id}/download")
            ->assertDownload('Invoice-002-SLU-CBN-INV-FINAL-XI-2026.pdf');
    }

    public function test_pembayaran_debit_note_dijurnal_ke_talangan_dan_tidak_menjadi_pendapatan(): void
    {
        $debitNote = $this->debitNote(['publish' => true]);
        $bank = BankAccount::factory()->create(['account_name' => 'Operasional', 'bank_name' => 'Mandiri']);
        $payment = Payment::factory()->create([
            'invoice_id' => $debitNote->id,
            'bank_account_id' => $bank->id,
            'amount' => 24_000_000,
            'payment_date' => '2026-11-25',
        ]);
        $debitNote->updateStatus();
        $this->assertSame('paid', $debitNote->status);

        $this->assertSame([
            ['account' => $bank->journalName(), 'side' => 'debit', 'amount' => 24_000_000],
            ['account' => JournalService::TALANGAN, 'side' => 'credit', 'amount' => 24_000_000],
        ], JournalService::forPayment($payment));

        // Invoice biasa bertitipan pajak tetap dikredit ke Titipan Pajak Klien.
        $invoice = $this->debitNote(['document_type' => Invoice::TYPE_INVOICE, 'apply_ppn' => false, 'publish' => true, 'items' => [
            ['service_name' => 'Titipan PPh', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 100_000, 'cogs_amount' => 0, 'is_tax_deposit' => true],
        ]]);
        $titipan = Payment::factory()->create(['invoice_id' => $invoice->id, 'bank_account_id' => $bank->id, 'amount' => 100_000, 'payment_date' => '2026-11-25']);
        $this->assertSame(JournalService::TAX_DEPOSIT, JournalService::forPayment($titipan)[1]['account']);

        $report = app(ProfitLossService::class)->generate(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30'));
        $this->assertSame(0, $report['revenue']['invoice']);
        $this->assertSame(0, $report['ppn_output']);
    }

    public function test_debit_note_bukan_laba_di_daftar_ringkasan_dan_rekap(): void
    {
        $debitNote = $this->debitNote(['publish' => true]);
        Payment::factory()->create(['invoice_id' => $debitNote->id, 'amount' => 24_000_000, 'payment_date' => '2026-11-25']);
        $debitNote->updateStatus();

        $this->actingAs($this->admin)->get(self::BASE.'/invoices?month=2026-11')->assertInertia(fn ($page) => $page
            ->where('stats.total_revenue', 24_000_000)
            ->where('stats.total_tax_deposit', 24_000_000)
            ->where('stats.gross_profit', 0)
            ->where('invoices.data.0.document_type', Invoice::TYPE_DEBIT_NOTE));

        $this->actingAs($this->admin)->get(self::BASE.'/dashboard')->assertInertia(fn ($page) => $page
            ->where('financialOverview.total_income', 24_000_000)
            ->where('financialOverview.total_profit', 0)
            ->where('financialOverview.total_pp', 0));

        Excel::fake();
        $this->actingAs($this->admin)->get(self::BASE.'/invoices/export/excel?month=2026-11')->assertOk();

        Excel::assertDownloaded('rekap-invoice-20261118-100000.xlsx', function (InvoiceRecapExport $export) {
            $row = collect($export->array())->first(fn (array $r) => $r[0] === '001/SLU-CBN/DN-PNBP/XI/2026');

            // Omzet, PPN, HPP, profit, PPh final semuanya 0; terbayar 24 jt, sisa 0.
            return array_slice($row, 5) === [0, 0, 0, 0, 0, 24_000_000, 0];
        });
    }

    public function test_kategori_bayar_talangan_klien_berakun_talangan_biaya_klien(): void
    {
        $this->assertSame(JournalService::TALANGAN, CategoryTemplateService::journalAccount('Bayar Talangan Klien'));
        $this->assertSame('Talangan Biaya Klien', JournalService::counterAccount('financing', null, 'Bayar Talangan Klien'));
    }

    public function test_migrasi_menyiapkan_debit_note_slu_saja_dan_idempoten(): void
    {
        CompanyProfile::current()->update(['invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}']);
        $lama = collect(['037/SLU-CBN/INV-FINAL/X/2026', '038/SLU-CBN/INV/X/2026', '039/SLU-CBN/DN-PNBP/X/2026'])
            ->map(fn (string $nomor) => Invoice::factory()->sent()->create([
                'billed_to_id' => $this->client->id,
                'issue_date' => '2026-10-10',
                'invoice_number' => $nomor,
            ]));
        // Format lama: nomor berkode tidak cocok, urutannya kosong.
        $this->assertSame([null, 38, null], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());

        $migrasi = require database_path('migrations/tenant/2026_11_18_131846_siapkan_debit_note_slu.php');

        // Perusahaan lain tidak tersentuh.
        tenancy()->initialize(Company::findOrFail(self::TEST_COMPANY));
        $migrasi->up();
        tenancy()->end();
        $this->assertSame('{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertSame(0, TransactionCategory::where('label', 'Bayar Talangan Klien')->count());

        tenancy()->initialize(Company::findOrFail(self::SLU));
        try {
            $migrasi->up();
            $migrasi->up();
        } finally {
            tenancy()->end();
        }

        $this->assertSame('{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}', CompanyProfile::current()->invoice_number_format);
        $this->assertSame([37, 38, 39], $lama->map(fn (Invoice $i) => $i->fresh()->invoice_sequence)->all());
        $this->assertSame(['FINAL', null, null], $lama->map(fn (Invoice $i) => $i->fresh()->document_code)->all());
        // Nomor berawalan DN tidak diubah jenisnya (itemnya tercatat sebagai pendapatan, tinjau manual).
        $this->assertSame(Invoice::TYPE_INVOICE, $lama[2]->fresh()->document_type);
        $this->assertSame('040/SLU-CBN/INV/X/2026', Invoice::generateInvoiceNumber(Carbon::parse('2026-10-20'), $this->client->id));

        $sub = TransactionCategory::where('label', 'Bayar Talangan Klien')->sole();
        $this->assertSame('financing', $sub->type);
        $this->assertNull($sub->pl_group);
        $this->assertSame('Talangan Klien', $sub->parent->label);
        $this->assertSame(1, TransactionCategory::where('label', 'Talangan Klien')->count());
    }

    public function test_invoice_lama_tetap_berjenis_invoice_tanpa_kode(): void
    {
        $invoice = Invoice::factory()->create(['billed_to_id' => $this->client->id]);

        $this->assertSame(Invoice::TYPE_INVOICE, $invoice->fresh()->document_type);
        $this->assertNull($invoice->fresh()->document_code);
        $this->assertSame('INV', Invoice::numberCode(null, null));
        $this->assertSame('DN', Invoice::numberCode(Invoice::TYPE_DEBIT_NOTE, null));
    }
}
