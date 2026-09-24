<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PaymentControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected Invoice $invoice;

    protected BankAccount $bankAccount;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = ['view invoices', 'create invoices', 'edit invoices'];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $client = Client::factory()->create();
        $this->invoice = Invoice::factory()->sent()->create([
            'billed_to_id' => $client->id,
            'total_amount' => 1000000,
        ]);

        $this->bankAccount = BankAccount::factory()->create();
    }

    public function test_store_records_payment_against_a_bank_account(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/invoices/{$this->invoice->id}/payments", [
                'amount' => 500000,
                'payment_date' => '2026-03-10',
                'payment_method' => 'bank_transfer',
                'bank_account_id' => $this->bankAccount->id,
            ])
            ->assertOk();

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $this->invoice->id,
            'amount' => 500000,
            'bank_account_id' => $this->bankAccount->id,
        ]);
    }

    public function test_store_requires_a_bank_account(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/invoices/{$this->invoice->id}/payments", [
                'amount' => 500000,
                'payment_date' => '2026-03-10',
                'payment_method' => 'bank_transfer',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('bank_account_id');

        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $this->invoice->id,
            'amount' => 500000,
        ]);
    }

    public function test_recorded_payment_increases_the_bank_account_balance(): void
    {
        $initial = $this->bankAccount->balance;

        $this->actingAs($this->admin)
            ->postJson("/invoices/{$this->invoice->id}/payments", [
                'amount' => 750000,
                'payment_date' => '2026-03-10',
                'payment_method' => 'bank_transfer',
                'bank_account_id' => $this->bankAccount->id,
            ])
            ->assertOk();

        $this->assertSame($initial + 750000, $this->bankAccount->fresh()->balance);
    }

    public function test_deleting_the_last_payment_keeps_a_numbered_invoice_sent(): void
    {
        $this->invoice->update(['invoice_number' => '001/INV/SPI-XX/III/2026']);
        $payment = Payment::create([
            'invoice_id' => $this->invoice->id,
            'bank_account_id' => $this->bankAccount->id,
            'amount' => 250000,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'bank_transfer',
        ]);
        $this->invoice->updateStatus();
        $this->assertSame('partially_paid', $this->invoice->fresh()->status);

        $this->actingAs($this->admin)->deleteJson("/payments/{$payment->id}")->assertOk();

        $this->assertDatabaseHas('invoices', [
            'id' => $this->invoice->id,
            'status' => 'sent',
            'invoice_number' => '001/INV/SPI-XX/III/2026',
        ]);
    }

    public function test_deleting_the_last_payment_returns_unnumbered_invoice_to_draft(): void
    {
        $this->invoice->update(['invoice_number' => null]);
        $payment = Payment::create([
            'invoice_id' => $this->invoice->id,
            'bank_account_id' => $this->bankAccount->id,
            'amount' => 250000,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'bank_transfer',
        ]);
        $this->invoice->updateStatus();

        $this->actingAs($this->admin)->deleteJson("/payments/{$payment->id}")->assertOk();

        $this->assertDatabaseHas('invoices', ['id' => $this->invoice->id, 'status' => 'draft']);
    }
}
