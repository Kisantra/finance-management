<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Loan;
use App\Models\TransactionCategory;
use App\Models\User;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class LoanControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected BankAccount $bankAccount;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(TransactionCategorySeeder::class);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'view loans', 'create loans', 'edit loans', 'delete loans', 'pay loans',
        ];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->bankAccount = BankAccount::factory()->create(['initial_balance' => 0]);
    }

    private function makeLoan(array $attributes = []): Loan
    {
        return Loan::create(array_merge([
            'loan_number' => 'LN-001',
            'lender_name' => 'Bank Mandiri',
            'principal_amount' => 10000000,
            'interest_type' => 'fixed',
            'interest_amount' => 500000,
            'term_months' => 12,
            'start_date' => '2026-01-01',
            'maturity_date' => '2027-01-01',
            'status' => 'active',
        ], $attributes));
    }

    public function test_index_requires_authentication(): void
    {
        $this->get('/loans')->assertRedirect('/login');
    }

    public function test_index_renders_for_authorized_user(): void
    {
        $this->actingAs($this->admin)->get('/loans')->assertOk();
    }

    public function test_store_creates_loan_and_credit_transaction(): void
    {
        $this->withoutExceptionHandling();
        $initialBalance = $this->bankAccount->balance;

        $this->actingAs($this->admin)->post('/loans', [
            'loan_number' => 'LN-2026-001',
            'lender_name' => 'Bank BNI',
            'principal_amount' => 5000000,
            'interest_type' => 'fixed',
            'interest_amount' => 250000,
            'term_months' => 6,
            'start_date' => '2026-03-01',
            'maturity_date' => '2026-09-01',
            'bank_account_id' => $this->bankAccount->id,
        ]);

        $this->assertDatabaseHas('loans', [
            'loan_number' => 'LN-2026-001',
            'lender_name' => 'Bank BNI',
            'principal_amount' => 5000000,
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $this->bankAccount->id,
            'amount' => 5000000,
            'transaction_type' => 'credit',
            'category_id' => TransactionCategory::findSystem('FIN-LOAN-IN')->id,
        ]);

        $this->assertSame($initialBalance + 5000000, $this->bankAccount->fresh()->balance);
    }

    public function test_store_requires_create_loans_permission(): void
    {
        $noPermUser = User::factory()->create();
        $this->actingAs($noPermUser)->post('/loans', [
            'loan_number' => 'LN-FAIL',
            'lender_name' => 'Test',
            'principal_amount' => 1000000,
            'interest_type' => 'fixed',
            'interest_amount' => 0,
            'term_months' => 1,
            'start_date' => '2026-01-01',
            'maturity_date' => '2026-02-01',
            'bank_account_id' => $this->bankAccount->id,
        ])->assertForbidden();

        $this->assertDatabaseMissing('loans', ['loan_number' => 'LN-FAIL']);
    }

    public function test_pay_creates_loan_payment_and_debit_transaction(): void
    {
        $this->withoutExceptionHandling();
        $loan = $this->makeLoan();
        $initialBalance = $this->bankAccount->balance;

        $this->actingAs($this->admin)->post("/loans/{$loan->id}/pay", [
            'bank_account_id' => $this->bankAccount->id,
            'payment_date' => '2026-02-01',
            'principal_paid' => 1000000,
            'interest_paid' => 50000,
        ]);

        $this->assertDatabaseHas('loan_payments', [
            'loan_id' => $loan->id,
            'principal_paid' => 1000000,
            'interest_paid' => 50000,
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $this->bankAccount->id,
            'transaction_type' => 'debit',
            'amount' => 1000000,
            'category_id' => TransactionCategory::findSystem('FIN-LOAN-OUT')->id,
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $this->bankAccount->id,
            'transaction_type' => 'debit',
            'amount' => 50000,
            'category_id' => TransactionCategory::findSystem('EXP-INTEREST')->id,
        ]);

        $this->assertLessThan($initialBalance, $this->bankAccount->fresh()->balance);
    }

    public function test_pay_fully_paid_loan_marks_it_completed(): void
    {
        $this->withoutExceptionHandling();
        $loan = $this->makeLoan([
            'principal_amount' => 500000,
            'interest_amount' => 0,
        ]);

        $this->actingAs($this->admin)->post("/loans/{$loan->id}/pay", [
            'bank_account_id' => $this->bankAccount->id,
            'payment_date' => '2026-02-01',
            'principal_paid' => 500000,
            'interest_paid' => 0,
        ]);

        $this->assertDatabaseHas('loans', [
            'id' => $loan->id,
            'status' => 'paid_off',
        ]);
    }

    public function test_destroy_deletes_loan(): void
    {
        $loan = $this->makeLoan(['loan_number' => 'LN-DELETE']);

        $this->actingAs($this->admin)->delete("/loans/{$loan->id}");

        $this->assertDatabaseMissing('loans', ['id' => $loan->id]);
    }

    public function test_update_modifies_loan_details(): void
    {
        $this->withoutExceptionHandling();
        $loan = $this->makeLoan(['loan_number' => 'LN-UPD', 'lender_name' => 'Lama']);

        $this->actingAs($this->admin)->put("/loans/{$loan->id}", [
            'loan_number' => 'LN-UPD',
            'lender_name' => 'Bank BCA',
            'principal_amount' => 10000000,
            'interest_type' => 'fixed',
            'interest_amount' => 600000,
            'term_months' => 12,
            'start_date' => '2026-01-01',
            'maturity_date' => '2027-01-01',
        ]);

        $this->assertDatabaseHas('loans', [
            'id' => $loan->id,
            'lender_name' => 'Bank BCA',
        ]);
    }
}
