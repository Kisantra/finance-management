<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class DashboardChartTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'view dashboard']);

        $this->user = User::factory()->create();
        $this->user->givePermissionTo('view dashboard');

        Carbon::setTestNow('2026-09-22 09:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function dashboard(array $query = [])
    {
        return $this->actingAs($this->user)->get('/dashboard?'.http_build_query($query));
    }

    public function test_default_chart_is_six_monthly_buckets_and_income_includes_invoice_payments(): void
    {
        $account = BankAccount::factory()->create(['initial_balance' => 0]);
        $invoice = Invoice::factory()->create(['billed_to_id' => Client::factory(), 'status' => 'sent']);

        BankTransaction::factory()->create([
            'bank_account_id' => $account->id, 'transaction_type' => 'credit',
            'amount' => 1_000_000, 'transaction_date' => '2026-09-10',
        ]);
        Payment::factory()->create([
            'invoice_id' => $invoice->id, 'bank_account_id' => $account->id,
            'amount' => 4_580_000, 'payment_date' => '2026-09-21',
        ]);
        BankTransaction::factory()->create([
            'bank_account_id' => $account->id, 'transaction_type' => 'debit',
            'amount' => 250_000, 'transaction_date' => '2026-09-15',
        ]);

        $this->dashboard()->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('cashFlowChart.period', 'monthly')
            ->where('cashFlowChart.granularity', 'monthly')
            ->has('cashFlowChart.labels', 6)
            ->where('cashFlowChart.labels.5', 'Sep')
            ->where('cashFlowChart.income.5', 5_580_000)
            ->where('cashFlowChart.expenses.5', 250_000)
            ->where('cashFlowChart.account', null)
            ->where('stats.income_this_month', 5_580_000)
            ->where('stats.expenses_this_month', 250_000)
            ->where('stats.net_this_month', 5_330_000)
        );
    }

    public function test_weekly_period_returns_twelve_week_buckets_ending_this_week(): void
    {
        $this->dashboard(['chart_period' => 'weekly'])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('cashFlowChart.period', 'weekly')
            ->has('cashFlowChart.labels', 12)
            ->where('cashFlowChart.labels.11', '21–27 Sep')
            ->where('cashFlowChart.range.to', '2026-09-27')
        );
    }

    public function test_yearly_period_returns_five_year_buckets(): void
    {
        $this->dashboard(['chart_period' => 'yearly'])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('cashFlowChart.period', 'yearly')
            ->has('cashFlowChart.labels', 5)
            ->where('cashFlowChart.labels.0', '2022')
            ->where('cashFlowChart.labels.4', '2026')
        );
    }

    public function test_range_period_buckets_daily_weekly_or_monthly_by_length(): void
    {
        $this->dashboard(['chart_period' => 'range', 'chart_from' => '2026-08-23', 'chart_to' => '2026-09-22'])
            ->assertInertia(fn (Assert $page) => $page
                ->where('cashFlowChart.granularity', 'daily')
                ->has('cashFlowChart.labels', 31)
                ->where('cashFlowChart.labels.0', '23 Agt')
            );

        $this->dashboard(['chart_period' => 'range', 'chart_from' => '2026-06-01', 'chart_to' => '2026-09-22'])
            ->assertInertia(fn (Assert $page) => $page->where('cashFlowChart.granularity', 'weekly'));

        $this->dashboard(['chart_period' => 'range', 'chart_from' => '2025-01-01', 'chart_to' => '2026-09-22'])
            ->assertInertia(fn (Assert $page) => $page
                ->where('cashFlowChart.granularity', 'monthly')
                ->where('cashFlowChart.labels.0', 'Jan 25')
            );
    }

    public function test_invalid_chart_params_fall_back_to_monthly_instead_of_failing(): void
    {
        $this->dashboard(['chart_period' => 'hourly', 'chart_account' => 999])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('cashFlowChart.period', 'monthly')
                ->where('cashFlowChart.account', null)
            );

        // Rentang lebih dari dua tahun, atau akhir sebelum awal → bulanan.
        $this->dashboard(['chart_period' => 'range', 'chart_from' => '2020-01-01', 'chart_to' => '2026-09-22'])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('cashFlowChart.period', 'monthly'));

        $this->dashboard(['chart_period' => 'range', 'chart_from' => '2026-09-22', 'chart_to' => '2026-09-01'])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('cashFlowChart.period', 'monthly'));
    }

    public function test_account_filter_only_narrows_the_chart_not_the_totals(): void
    {
        $bca = BankAccount::factory()->create(['initial_balance' => 0, 'account_name' => 'Operasional', 'bank_name' => 'BCA']);
        $bni = BankAccount::factory()->create(['initial_balance' => 0, 'account_name' => 'Investasi', 'bank_name' => 'BNI']);

        BankTransaction::factory()->create(['bank_account_id' => $bca->id, 'transaction_type' => 'credit', 'amount' => 300_000, 'transaction_date' => '2026-09-05']);
        BankTransaction::factory()->create(['bank_account_id' => $bni->id, 'transaction_type' => 'credit', 'amount' => 700_000, 'transaction_date' => '2026-09-06']);

        $this->dashboard(['chart_account' => $bca->id])->assertInertia(fn (Assert $page) => $page
            ->where('cashFlowChart.account.id', $bca->id)
            ->where('cashFlowChart.account.label', 'BCA · Operasional')
            ->where('cashFlowChart.income.5', 300_000)
            ->where('stats.income_this_month', 1_000_000)
        );
    }

    public function test_pending_invoices_put_overdue_first(): void
    {
        $client = Client::factory()->create(['name' => 'CV. Karya Bersama']);
        Invoice::factory()->create(['billed_to_id' => $client->id, 'status' => 'sent', 'total_amount' => 2_000_000, 'due_date' => '2026-02-22']);
        Invoice::factory()->create(['billed_to_id' => $client->id, 'status' => 'sent', 'total_amount' => 5_580_000, 'due_date' => '2026-09-30']);
        Invoice::factory()->create(['billed_to_id' => $client->id, 'status' => 'paid', 'total_amount' => 1, 'due_date' => '2026-09-25']);

        $this->dashboard()->assertInertia(fn (Assert $page) => $page
            ->has('pendingInvoices', 2)
            ->where('pendingInvoices.0.status', 'overdue')
            ->where('pendingInvoices.0.days_until_due', -212)
            ->missing('needsAction')
            ->missing('dueSoon')
        );
    }

    public function test_income_by_category_includes_invoice_payments(): void
    {
        $bca = BankAccount::factory()->create(['initial_balance' => 0]);
        $fee = TransactionCategory::create(['type' => 'income', 'label' => 'Jasa konsultasi']);
        $client = Client::factory()->create();
        $invoice = Invoice::factory()->create(['billed_to_id' => $client->id, 'status' => 'sent', 'total_amount' => 5_000_000]);

        BankTransaction::factory()->create(['bank_account_id' => $bca->id, 'transaction_type' => 'credit', 'amount' => 700_000, 'transaction_date' => '2026-09-05', 'category_id' => $fee->id]);
        BankTransaction::factory()->create(['bank_account_id' => $bca->id, 'transaction_type' => 'credit', 'amount' => 50_000, 'transaction_date' => '2026-09-06', 'category_id' => null]);
        BankTransaction::factory()->create(['bank_account_id' => $bca->id, 'transaction_type' => 'debit', 'amount' => 999_000, 'transaction_date' => '2026-09-06', 'category_id' => $fee->id]);
        Payment::factory()->create(['invoice_id' => $invoice->id, 'bank_account_id' => $bca->id, 'amount' => 3_000_000, 'payment_date' => '2026-09-10']);

        $this->dashboard()->assertInertia(fn (Assert $page) => $page
            ->where('incomeByCategory.0', ['name' => 'Pembayaran invoice', 'value' => 3_000_000])
            ->where('incomeByCategory.1', ['name' => 'Jasa konsultasi', 'value' => 700_000])
            ->where('incomeByCategory.2', ['name' => 'Tanpa kategori', 'value' => 50_000])
            ->where('stats.income_this_month', 3_750_000)
        );
    }
}
