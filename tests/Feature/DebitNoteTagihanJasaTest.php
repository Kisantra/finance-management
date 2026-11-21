<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\User;
use App\Services\CompanyInvoiceTemplate;
use App\Services\InvoicePrintService;
use App\Services\JournalService;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Sifat Debit Note (`invoices.is_pass_through`): talangan (bawaan, semua item titipan tanpa PPN/PPh) atau
 * tagihan jasa — dihitung persis seperti invoice, hanya judul & nomornya Debit Note — seperti Debit Note BCB
 * untuk klien luar negeri (jasa per ton dalam USD, PPN, WHT 23 yang ditambahkan sebagai baris titipan pajak).
 * Semua angka & nama fiktif.
 */
class DebitNoteTagihanJasaTest extends TestCase
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

        CompanyProfile::factory()->create([
            // Sakelar Debit Note di Profil perusahaan (bawaan mati).
            'debit_note_enabled' => true,
            'name' => 'PT. Bahtera Cipta Bersama',
            'abbreviation' => 'BCB',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'pph_enabled' => true,
            'pph_rate' => 2,
            'foreign_currency_enabled' => true,
            'signature_path' => null,
            'stamp_path' => null,
            'bank_accounts' => [['bank' => 'Bank Contoh', 'account_number' => '000-00-0000000-0', 'account_name' => 'PT. BAHTERA CIPTA BERSAMA', 'currency' => 'IDR']],
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
        ]);

        $this->client = Client::factory()->company()->create(['name' => 'CONTOH COMMODITIES FZE', 'alias' => 'CCF']);

        $this->travelTo(Carbon::parse('2026-11-16 10:00:00'));
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_id' => $this->client->id,
            'issue_date' => '2026-11-16',
            'due_date' => '2026-11-30',
            'subject' => 'Debit Note TKBM MV. CONTOH PINE',
            'document_type' => Invoice::TYPE_DEBIT_NOTE,
            'document_code' => 'OPSTKBM',
            'is_pass_through' => false,
            'apply_ppn' => true,
            'apply_pph' => false,
            // Seperti Debit Note TKBM: empat komponen tarif per ton untuk tonase yang sama, lalu transport.
            'items' => [
                ['service_name' => 'THP TKBM', 'quantity' => 50000, 'unit' => 'MT', 'unit_price' => 3_800, 'cogs_amount' => 100_000_000, 'is_tax_deposit' => false],
                ['service_name' => 'Kesejahteraan TKBM', 'quantity' => 50000, 'unit' => 'MT', 'unit_price' => 400, 'cogs_amount' => 0, 'is_tax_deposit' => false],
                ['service_name' => 'Asuransi TKBM', 'quantity' => 50000, 'unit' => 'MT', 'unit_price' => 450, 'cogs_amount' => 0, 'is_tax_deposit' => false],
                ['service_name' => 'ADM KOMURA', 'quantity' => 50000, 'unit' => 'MT', 'unit_price' => 250, 'cogs_amount' => 0, 'is_tax_deposit' => false],
                ['service_name' => 'Transport TKBM', 'quantity' => 3, 'unit' => 'Trip', 'unit_price' => 15_000_000, 'cogs_amount' => 0, 'is_tax_deposit' => false],
            ],
        ], $overrides);
    }

    private function simpan(array $overrides = []): Invoice
    {
        $this->actingAs($this->admin)->post(self::BASE.'/invoices', $this->payload($overrides))->assertSessionHasNoErrors();

        return Invoice::with('items')->latest('id')->firstOrFail();
    }

    /** Seperti Debit Note FINAL: sisa tagihan (tonase akhir di keterangan) + WHT 23 2% sebagai baris titipan pajak. */
    private function debitNoteFinal(array $overrides = []): Invoice
    {
        return $this->simpan([
            'document_code' => 'FINAL',
            'subject' => 'Final Debit Note MV. CONTOH FLAME',
            'apply_ppn' => false,
            'items' => [
                ['service_name' => 'MV. CONTOH FLAME', 'description' => "(Final)\nQuantity : 50.750 MT", 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 11_223_750, 'cogs_amount' => 0, 'is_tax_deposit' => false],
                ['service_name' => 'WHT 23 (2%)', 'quantity' => 1, 'unit' => 'LS', 'unit_price' => 15_189_475, 'cogs_amount' => 0, 'is_tax_deposit' => true],
            ],
            'publish' => true,
            ...$overrides,
        ]);
    }

    private function render(Invoice $invoice): string
    {
        tenancy()->initialize(Company::findOrFail(self::BCB));

        try {
            return view(
                CompanyInvoiceTemplate::viewFor(CompanyInvoiceTemplate::KEY, $invoice),
                (new InvoicePrintService)->buildViewData($invoice->load(['client', 'items.client', 'payments']), null, null, CompanyInvoiceTemplate::KEY),
            )->render();
        } finally {
            tenancy()->end();
        }
    }

    public function test_debit_note_tagihan_jasa_dihitung_seperti_invoice(): void
    {
        $debitNote = $this->simpan(['faktur' => '010.000-26.00000009', 'publish' => true]);

        $this->assertTrue($debitNote->isDebitNote());
        $this->assertFalse($debitNote->is_pass_through);
        $this->assertFalse($debitNote->isPassThrough());
        $this->assertSame('001/BCB-CCF/DN-OPSTKBM/XI/2026', $debitNote->invoice_number);
        // Item tetap jasa (bukan titipan) dengan HPP-nya; PPN 11% dari 245.000.000 + 45.000.000.
        $this->assertFalse($debitNote->items->contains('is_tax_deposit', true));
        $this->assertSame(100_000_000, (int) $debitNote->items->sum('cogs_amount'));
        $this->assertSame(290_000_000, $debitNote->subtotal);
        $this->assertSame('11.00', $debitNote->ppn_rate);
        $this->assertSame(31_900_000, $debitNote->ppn_amount);
        $this->assertSame('0.00', $debitNote->pph_rate);
        $this->assertSame(321_900_000, $debitNote->total_amount);
        $this->assertSame('010.000-26.00000009', $debitNote->faktur);
        $this->assertSame(190_000_000, $debitNote->gross_profit);

        $this->actingAs($this->admin)->getJson(self::BASE."/invoices/{$debitNote->id}/data")
            ->assertJsonPath('document_type', Invoice::TYPE_DEBIT_NOTE)
            ->assertJsonPath('is_pass_through', false)
            ->assertJsonPath('tax_deposit_total', 0);

        $this->actingAs($this->admin)->get(self::BASE."/invoices/{$debitNote->id}/edit")->assertInertia(fn ($page) => $page
            ->where('invoice.document_type', Invoice::TYPE_DEBIT_NOTE)
            ->where('invoice.is_pass_through', false));
    }

    public function test_pph_23_hanya_dipotong_pada_debit_note_tagihan_jasa(): void
    {
        $jasa = $this->simpan(['apply_ppn' => false, 'apply_pph' => true, 'pph_rate' => 2]);
        $talangan = $this->simpan(['is_pass_through' => true, 'apply_ppn' => true, 'apply_pph' => true, 'pph_rate' => 2]);

        // Jasa: dipotong 2% × 290.000.000; total = yang ditransfer klien.
        $this->assertSame('2.00', $jasa->pph_rate);
        $this->assertSame(5_800_000, $jasa->pph_amount);
        $this->assertSame(284_200_000, $jasa->total_amount);

        // Talangan: semua item titipan, PPN dan PPh diabaikan apa pun isi payload.
        $this->assertTrue($talangan->isPassThrough());
        $this->assertTrue($talangan->items->every('is_tax_deposit'));
        $this->assertSame(0, (int) $talangan->items->sum('cogs_amount'));
        $this->assertSame(0, $talangan->ppn_amount);
        $this->assertNull($talangan->pph_rate);
        $this->assertSame(290_000_000, $talangan->total_amount);
        $this->assertSame(0, $talangan->gross_profit);
    }

    public function test_talangan_bawaan_dan_sifat_bisa_diganti_setelah_terbit(): void
    {
        // Tanpa isian sifat: Debit Note baru = talangan, seperti sebelum fitur ini.
        $debitNote = $this->simpan(['is_pass_through' => null, 'publish' => true]);
        $this->assertTrue($debitNote->is_pass_through);
        $this->assertSame(0, $debitNote->ppn_amount);

        // Sifat tidak membentuk nomor, jadi tetap bisa diganti setelah terbit; isian kosong = sifat tersimpan.
        $this->actingAs($this->admin)->put(self::BASE."/invoices/{$debitNote->id}", $this->payload(['is_pass_through' => false]))->assertSessionHasNoErrors();
        $debitNote->refresh()->load('items');
        $this->assertFalse($debitNote->isPassThrough());
        $this->assertSame('001/BCB-CCF/DN-OPSTKBM/XI/2026', $debitNote->invoice_number);
        $this->assertSame(31_900_000, $debitNote->ppn_amount);
        $this->assertFalse($debitNote->items->first()->is_tax_deposit);

        $this->actingAs($this->admin)->put(self::BASE."/invoices/{$debitNote->id}", $this->payload(['is_pass_through' => null]))->assertSessionHasNoErrors();
        $this->assertFalse($debitNote->fresh()->is_pass_through);

        // Invoice tidak punya sifat, walau payload membawanya; draft Debit Note yang diganti jadi invoice ikut kosong.
        $invoice = $this->simpan(['document_type' => Invoice::TYPE_INVOICE, 'document_code' => 'FINAL', 'is_pass_through' => true]);
        $this->assertNull($invoice->is_pass_through);
        $this->assertFalse($invoice->isPassThrough());
        $this->assertFalse($invoice->items->first()->is_tax_deposit);

        $draft = $this->simpan(['is_pass_through' => true]);
        $this->actingAs($this->admin)->put(self::BASE."/invoices/{$draft->id}", $this->payload(['document_type' => Invoice::TYPE_INVOICE]))->assertSessionHasNoErrors();
        $this->assertNull($draft->fresh()->is_pass_through);

        // Editor invoice membawa bawaan talangan bila jenisnya diganti ke Debit Note.
        $this->actingAs($this->admin)->get(self::BASE."/invoices/{$invoice->id}/edit")
            ->assertInertia(fn ($page) => $page->where('invoice.is_pass_through', true));
    }

    public function test_debit_note_tanpa_sifat_tersimpan_dianggap_talangan(): void
    {
        $lama = Invoice::factory()->create(['billed_to_id' => $this->client->id, 'document_type' => Invoice::TYPE_DEBIT_NOTE]);
        $invoice = Invoice::factory()->create(['billed_to_id' => $this->client->id]);

        $this->assertNull($lama->fresh()->is_pass_through);
        $this->assertTrue($lama->fresh()->isPassThrough());
        $this->assertFalse($invoice->fresh()->isPassThrough());
        $this->assertSame(JournalService::TALANGAN, JournalService::depositAccountFor(true));
        $this->assertSame(JournalService::TAX_DEPOSIT, JournalService::depositAccountFor(false));
    }

    public function test_wht_23_yang_ditambahkan_menjadi_titipan_pajak_bukan_pendapatan(): void
    {
        $debitNote = $this->debitNoteFinal();

        $this->assertSame([false, true], $debitNote->items->pluck('is_tax_deposit')->all());
        $this->assertSame(26_413_225, $debitNote->total_amount);
        $this->assertSame(0, $debitNote->ppn_amount);
        $this->assertSame(11_223_750, $debitNote->gross_profit);

        $bank = BankAccount::factory()->create(['account_name' => 'Operasional', 'bank_name' => 'Bank Contoh']);
        $payment = Payment::factory()->create([
            'invoice_id' => $debitNote->id,
            'bank_account_id' => $bank->id,
            'amount' => 26_413_225,
            'payment_date' => '2026-11-25',
        ]);
        $debitNote->updateStatus();
        $this->assertSame('paid', $debitNote->status);

        // Titipan dulu: WHT 23 ke Titipan Pajak Klien (bukan Talangan), sisanya pendapatan.
        $this->assertSame([
            ['account' => $bank->journalName(), 'side' => 'debit', 'amount' => 26_413_225],
            ['account' => JournalService::TAX_DEPOSIT, 'side' => 'credit', 'amount' => 15_189_475],
            ['account' => JournalService::INVOICE_REVENUE, 'side' => 'credit', 'amount' => 11_223_750],
        ], JournalService::forPayment($payment));

        $report = app(ProfitLossService::class)->generate(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30'));
        $this->assertSame(11_223_750, $report['revenue']['invoice']);
    }

    public function test_pdf_bcb_debit_note_tagihan_jasa_bertarif_usd_dengan_wht_dan_total_outstanding(): void
    {
        $debitNote = $this->debitNoteFinal(['currency' => 'USD', 'exchange_rate' => 18_250]);
        $this->assertSame('1447.30', $debitNote->total_foreign);

        $html = $this->render($debitNote);

        $this->assertStringContainsString('DEBIT NOTE', $html);
        $this->assertStringContainsString('001/BCB-CCF/DN-FINAL/XI/2026', $html);
        // Semua qty 1: tanpa kolom Quantity & PRICE; tonase akhir di keterangan, WHT 23 baris bernomor 2.
        $this->assertStringNotContainsString('<th class="c-qty">', $html);
        $this->assertStringContainsString('Quantity : 50.750 MT', $html);
        $this->assertMatchesRegularExpression('#<td class="c-no">2</td>\s*<td class="c-ket keterangan">\s*WHT 23 \(2%\)#', $html);
        $this->assertStringContainsString('<td class="angka">15.189.475</td>', $html);
        $this->assertMatchesRegularExpression('#GRAND TOTAL \(IDR\)</td>\s*<td class="c-total">.*?<td class="angka">26.413.225</td>#s', $html);
        $this->assertMatchesRegularExpression('#TOTAL OUTSTANDING \(USD\).*?<td class="rp">USD</td><td class="angka">1.447,30</td>#s', $html);
        $this->assertStringNotContainsString('<tr class="baris-ppn">', $html);
    }

    public function test_pdf_bcb_debit_note_tagihan_jasa_ber_ppn_seperti_invoice(): void
    {
        $html = $this->render($this->simpan(['publish' => true]));

        $this->assertStringContainsString('DEBIT NOTE', $html);
        // Kolom Quantity (satuan berbeda) & PRICE tampil; baris PPN bernomor melanjutkan lima item.
        $this->assertStringContainsString('<th class="c-qty">Quantity</th>', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-dpp">\s*<td colspan="4" class="label">Total Invoice \(Sebelum PPN\)</td>#', $html);
        $this->assertMatchesRegularExpression('#<tr class="baris-ppn">\s*<td class="c-no">6</td>\s*<td colspan="3" class="label">PPN 11%</td>#', $html);
        $this->assertStringContainsString('<td class="angka">31.900.000</td>', $html);
        $this->assertStringContainsString('<td class="angka">321.900.000</td>', $html);
        // Gaya baris subtotal & potongan sama dengan invoice BCB.
        $this->assertStringContainsString('.totals-table tr.baris-dpp td.label', $html);
        $this->assertStringContainsString('.totals-table tr.baris-pph td.c-total', $html);
    }
}
