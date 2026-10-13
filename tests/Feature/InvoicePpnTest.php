<?php

namespace Tests\Feature;

use App\Exports\InvoiceRecapExport;
use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\RecurringInvoice;
use App\Models\RecurringTemplate;
use App\Models\User;
use App\Services\InvoicePrintService;
use App\Services\ProfitLossService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * PPN per invoice untuk perusahaan PKP: DPP = layanan − diskon (tanpa titipan pajak), PPN ikut total,
 * tarif disimpan di invoice, dan PPN dipisahkan dari pendapatan/laba.
 */
class InvoicePpnTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $permissions = ['view invoices', 'create invoices', 'edit invoices', 'view dashboard'];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->client = Client::factory()->create();

        CompanyProfile::factory()->create(['is_pkp' => true, 'ppn_rate' => 11, 'bank_accounts' => []]);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_id' => $this->client->id,
            'issue_date' => '2026-10-01',
            'due_date' => '2026-10-31',
            'discount_type' => 'fixed',
            'discount_value' => 100_000,
            'items' => [
                ['service_name' => 'Jasa', 'quantity' => 1, 'unit' => 'paket', 'unit_price' => 1_100_000, 'cogs_amount' => 400_000, 'is_tax_deposit' => false],
                ['service_name' => 'Titipan PPh', 'quantity' => 1, 'unit' => 'ls', 'unit_price' => 50_000, 'cogs_amount' => 0, 'is_tax_deposit' => true],
            ],
        ], $overrides);
    }

    public function test_pkp_company_adds_ppn_from_dpp_by_default(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload())->assertSessionHasNoErrors();

        $invoice = Invoice::with('items')->sole();
        // DPP = 1.100.000 − 100.000 diskon (titipan tidak ikut) = 1.000.000 → PPN 11% = 110.000.
        $this->assertSame('11.00', $invoice->ppn_rate);
        $this->assertSame(110_000, $invoice->ppn_amount);
        $this->assertSame(1_000_000, $invoice->dpp_amount);
        // Total = 1.150.000 − 100.000 + 110.000.
        $this->assertSame(1_160_000, $invoice->total_amount);
        // Laba kotor tidak memuat PPN: 1.160.000 − 110.000 − 400.000.
        $this->assertSame(650_000, $invoice->gross_profit);
    }

    public function test_ppn_can_be_switched_off_per_invoice(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['apply_ppn' => false]));

        $invoice = Invoice::sole();
        $this->assertSame('0.00', $invoice->ppn_rate);
        $this->assertSame(0, $invoice->ppn_amount);
        $this->assertSame(1_050_000, $invoice->total_amount);
    }

    public function test_non_pkp_company_never_charges_ppn(): void
    {
        CompanyProfile::current()->update(['is_pkp' => false]);

        $this->actingAs($this->admin)->post('/invoices', $this->payload(['apply_ppn' => true]));

        $this->assertSame(0, Invoice::sole()->ppn_amount);
        $this->assertSame(1_050_000, Invoice::sole()->total_amount);
    }

    public function test_existing_ppn_invoice_keeps_its_rate_after_settings_change(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload());
        $invoice = Invoice::sole();

        CompanyProfile::current()->update(['is_pkp' => false, 'ppn_rate' => 12]);

        $this->actingAs($this->admin)->put("/invoices/{$invoice->id}", $this->payload(['discount_value' => 0]))->assertSessionHasNoErrors();

        $invoice->refresh();
        $this->assertSame('11.00', $invoice->ppn_rate);
        $this->assertSame(121_000, $invoice->ppn_amount); // 11% × 1.100.000
    }

    public function test_legacy_invoice_stays_without_ppn_data_when_edited(): void
    {
        $invoice = Invoice::factory()->create(['billed_to_id' => $this->client->id, 'ppn_rate' => null, 'ppn_amount' => 0]);

        $this->actingAs($this->admin)->put("/invoices/{$invoice->id}", $this->payload())->assertSessionHasNoErrors();

        $invoice->refresh();
        $this->assertNull($invoice->ppn_rate);
        $this->assertSame(0, $invoice->ppn_amount);
        $this->assertSame(1_050_000, $invoice->total_amount);
    }

    public function test_index_stats_report_ppn_and_exclude_it_from_gross_profit(): void
    {
        $this->travelTo(Carbon::parse('2026-10-20 10:00:00'));
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['publish' => true]));

        $this->actingAs($this->admin)->get('/invoices?month=2026-10')->assertInertia(fn ($page) => $page
            ->where('stats.total_revenue', 1_160_000)
            ->where('stats.total_ppn', 110_000)
            ->where('stats.gross_profit', 650_000));
    }

    public function test_editor_receives_ppn_option_and_saved_ppn_state(): void
    {
        $this->actingAs($this->admin)->get('/invoices/create')->assertInertia(fn ($page) => $page
            ->where('ppn.enabled', true)
            ->where('ppn.rate', 11));

        $this->actingAs($this->admin)->post('/invoices', $this->payload(['faktur' => '010.000-26.00000001']));
        $invoice = Invoice::sole();

        $this->actingAs($this->admin)->get("/invoices/{$invoice->id}/edit")->assertInertia(fn ($page) => $page
            ->where('invoice.ppn_rate', 11)
            ->where('invoice.faktur', '010.000-26.00000001'));

        $this->actingAs($this->admin)->getJson("/invoices/{$invoice->id}/data")
            ->assertJsonPath('ppn_amount', 110_000)
            ->assertJsonPath('dpp_amount', 1_000_000);
    }

    public function test_preview_renders_with_ppn_fields(): void
    {
        $this->actingAs($this->admin)
            ->post('/invoices/preview', $this->payload(['apply_ppn' => true, 'faktur' => '010.000-26.00000001']))
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_paid_status_requires_ppn_to_be_paid_too(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload());
        $invoice = Invoice::sole();

        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 1_050_000]);
        $invoice->updateStatus();
        $this->assertSame('partially_paid', $invoice->status);

        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 110_000]);
        $invoice->updateStatus();
        $this->assertSame('paid', $invoice->status);
    }

    public function test_faktur_number_is_saved_trimmed(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['faktur' => '  010.000-26.00000001 ']));

        $this->assertSame('010.000-26.00000001', Invoice::sole()->faktur);
    }

    public function test_kisantra_pdf_shows_ppn_and_says_the_billed_total(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['faktur' => '010.000-26.00000001']));
        $invoice = Invoice::with(['client', 'items.client', 'payments'])->sole();

        $data = (new InvoicePrintService)->buildViewData($invoice);
        $html = view('pdf.kisantra-invoice', $data)->render();

        $this->assertSame(1_160_000, $data['grand_total']); // terbilang = TOTAL yang tercetak
        $this->assertStringContainsString('PPN 11%', $html);
        $this->assertStringContainsString('110.000', $html);
        $this->assertStringContainsString('010.000-26.00000001', $html);
    }

    public function test_profit_loss_reports_ppn_separately_from_revenue(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload());
        $invoice = Invoice::sole();
        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 1_160_000, 'payment_date' => '2026-10-10']);

        $report = app(ProfitLossService::class)->generate(Carbon::parse('2026-10-01'), Carbon::parse('2026-10-31'));

        $this->assertSame(1_000_000, $report['revenue']['invoice']);
        $this->assertSame(110_000, $report['ppn_output']);
        $this->assertSame(400_000, $report['cogs']['invoice']);
    }

    public function test_partial_payment_covers_deposit_then_ppn_before_revenue(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload());
        $invoice = Invoice::sole();
        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 500_000, 'payment_date' => '2026-10-10']);

        $report = app(ProfitLossService::class)->generate(Carbon::parse('2026-10-01'), Carbon::parse('2026-10-31'));

        // 500.000 − titipan 50.000 − PPN 110.000 = 340.000 pendapatan.
        $this->assertSame(110_000, $report['ppn_output']);
        $this->assertSame(340_000, $report['revenue']['invoice']);
    }

    public function test_recap_separates_ppn_from_omzet(): void
    {
        $this->travelTo(Carbon::parse('2026-10-20 10:00:00'));
        $this->actingAs($this->admin)->post('/invoices', $this->payload(['publish' => true]));

        Excel::fake();
        $this->actingAs($this->admin)->get('/invoices/export/excel?month=2026-10')->assertOk();

        Excel::assertDownloaded('rekap-invoice-20261020-100000.xlsx', function (InvoiceRecapExport $export) {
            $row = collect($export->array())->first(fn (array $r) => $r[1] === $this->client->name);

            // Omzet tanpa PPN, kolom PPN, HPP, profit, PPh, terbayar, sisa (termasuk PPN).
            return array_slice($row, 5) === [1_050_000, 110_000, 400_000, 650_000, 5_250, 0, 1_160_000];
        });
    }

    public function test_recurring_publish_applies_ppn_while_pkp(): void
    {
        $template = RecurringTemplate::forceCreate([
            'client_id' => $this->client->id,
            'template_name' => 'Retainer',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'frequency' => 'monthly',
            'invoice_template' => ['items' => [], 'subtotal' => 1_000_000, 'discount_amount' => 0, 'total_amount' => 1_000_000],
        ]);
        $recurring = RecurringInvoice::create([
            'template_id' => $template->id,
            'client_id' => $this->client->id,
            'scheduled_date' => '2026-10-01',
            'invoice_data' => [
                'items' => [['service_name' => 'Retainer', 'quantity' => 1, 'unit_price' => 1_000_000, 'amount' => 1_000_000]],
                'subtotal' => 1_000_000,
                'discount_amount' => 0,
                'total_amount' => 1_000_000,
            ],
            'status' => 'draft',
        ]);

        $invoice = $recurring->publish();

        $this->assertSame(110_000, $invoice->ppn_amount);
        $this->assertSame(1_110_000, $invoice->total_amount);
    }

    public function test_dashboard_profit_excludes_collected_ppn(): void
    {
        $this->actingAs($this->admin)->post('/invoices', $this->payload());
        $invoice = Invoice::sole();
        Payment::factory()->create(['invoice_id' => $invoice->id, 'amount' => 1_160_000]);
        $invoice->updateStatus();

        $this->actingAs($this->admin)->get('/dashboard')->assertInertia(fn ($page) => $page
            // 1.160.000 masuk − 110.000 PPN − 400.000 HPP.
            ->where('financialOverview.total_profit', 650_000));
    }
}
