<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Loan;
use App\Models\Receivable;
use App\Models\Reimbursement;
use App\Models\TransactionCategory;
use App\Models\User;
use Database\Seeders\TransactionCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Keputusan produk 2026-08-19: pembayaran TIDAK boleh melampaui sisa.
 *
 * Sebelumnya keempat modul menerima kelebihan bayar dan mendebit/mengkredit kas
 * secara penuh, membuat sisa menjadi negatif (mis. piutang pokok Rp 6 jt dibayar
 * Rp 13,5 jt → sisa −Rp 7,5 jt).
 */
class PaymentCapTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(TransactionCategorySeeder::class);
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $izin = [
            'view invoices', 'create invoices', 'edit invoices',
            'view reimbursements', 'pay reimbursements', 'approve reimbursements',
            'view loans', 'pay loans',
            'view receivables', 'pay receivables',
        ];
        foreach ($izin as $p) {
            Permission::firstOrCreate(['name' => $p]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($izin);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->rekening = BankAccount::factory()->create(['initial_balance' => 100000000]);
    }

    public function test_pembayaran_invoice_melebihi_sisa_ditolak(): void
    {
        $client = Client::create(['name' => 'PT Uji', 'type' => 'company', 'status' => 'Active']);
        $invoice = Invoice::create([
            'invoice_number' => '001/INV/UJI/VIII/2026',
            'billed_to_id' => $client->id,
            'subtotal' => 1000000,
            'total_amount' => 1000000,
            'issue_date' => '2026-08-01',
            'due_date' => '2026-08-31',
            'status' => 'sent',
        ]);

        $this->actingAs($this->admin)
            ->postJson("/invoices/{$invoice->id}/payments", [
                'amount' => 1500000,
                'payment_date' => '2026-08-10',
                'payment_method' => 'bank_transfer',
                'bank_account_id' => $this->rekening->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_pembayaran_invoice_tepat_sebesar_sisa_diterima(): void
    {
        $client = Client::create(['name' => 'PT Uji', 'type' => 'company', 'status' => 'Active']);
        $invoice = Invoice::create([
            'invoice_number' => '002/INV/UJI/VIII/2026',
            'billed_to_id' => $client->id,
            'subtotal' => 1000000,
            'total_amount' => 1000000,
            'issue_date' => '2026-08-01',
            'due_date' => '2026-08-31',
            'status' => 'sent',
        ]);

        $this->actingAs($this->admin)
            ->postJson("/invoices/{$invoice->id}/payments", [
                'amount' => 1000000,
                'payment_date' => '2026-08-10',
                'payment_method' => 'bank_transfer',
                'bank_account_id' => $this->rekening->id,
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'paid']);
    }

    public function test_pembayaran_reimbursement_melebihi_sisa_ditolak(): void
    {
        $kategori = TransactionCategory::where('label', 'Transportasi Lokal')->sole();

        $r = Reimbursement::create([
            'user_id' => $this->admin->id,
            'title' => 'Transport',
            'amount' => 500000,
            'expense_date' => '2026-08-01',
            'category_input' => 'transport',
            'category_id' => $kategori->id,
            'status' => 'approved',
            'payment_status' => 'unpaid',
        ]);

        $this->actingAs($this->admin)
            ->post("/reimbursements/{$r->id}/pay", [
                'bank_account_id' => $this->rekening->id,
                'payment_date' => now()->toDateString(),
                'payment_amount' => 700000,
            ])
            ->assertSessionHasErrors('payment_amount');

        $this->assertDatabaseHas('reimbursements', ['id' => $r->id, 'amount_paid' => 0]);
    }

    public function test_pembayaran_pinjaman_melebihi_sisa_pokok_ditolak(): void
    {
        $loan = Loan::create([
            'loan_number' => 'LOAN-00001',
            'lender_name' => 'Bank Uji',
            'principal_amount' => 10000000,
            'interest_type' => 'fixed',
            'interest_amount' => 500000,
            'term_months' => 12,
            'start_date' => '2026-01-01',
            'maturity_date' => '2026-12-31',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin)
            ->post("/loans/{$loan->id}/pay", [
                'bank_account_id' => $this->rekening->id,
                'payment_date' => now()->toDateString(),
                'principal_paid' => 13000000,
                'interest_paid' => 0,
            ])
            ->assertSessionHasErrors('principal_paid');

        $this->assertDatabaseCount('loan_payments', 0);
    }

    public function test_cicilan_piutang_melebihi_sisa_pokok_ditolak(): void
    {
        $debitur = User::factory()->create();
        $receivable = Receivable::create([
            'receivable_number' => 'RCV-00001',
            'type' => 'employee_loan',
            'debtor_type' => User::class,
            'debtor_id' => $debitur->id,
            'principal_amount' => 6000000,
            'interest_rate' => 10,
            'installment_months' => 6,
            'installment_amount' => 1100000,
            'loan_date' => '2026-08-01',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin)
            ->post("/receivables/{$receivable->id}/pay", [
                'payment_date' => now()->toDateString(),
                'payment_method' => 'bank_transfer',
                'bank_account_id' => $this->rekening->id,
                'principal_paid' => 13500000,
                'interest_paid' => 0,
            ])
            ->assertSessionHasErrors('principal_paid');

        $this->assertDatabaseCount('receivable_payments', 0);
    }

    public function test_cicilan_transfer_tanpa_rekening_ditolak(): void
    {
        $debitur = User::factory()->create();
        $receivable = Receivable::create([
            'receivable_number' => 'RCV-00002',
            'type' => 'employee_loan',
            'debtor_type' => User::class,
            'debtor_id' => $debitur->id,
            'principal_amount' => 6000000,
            'interest_rate' => 0,
            'installment_months' => 6,
            'installment_amount' => 1000000,
            'loan_date' => '2026-08-01',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin)
            ->post("/receivables/{$receivable->id}/pay", [
                'payment_date' => now()->toDateString(),
                'payment_method' => 'bank_transfer',
                'principal_paid' => 1000000,
            ])
            ->assertSessionHasErrors('bank_account_id');

        $this->assertDatabaseCount('receivable_payments', 0);
    }
}
