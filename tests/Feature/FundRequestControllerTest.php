<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\FundRequest;
use App\Models\FundRequestItem;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class FundRequestControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $staff;

    protected TransactionCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'view fund requests', 'create fund requests', 'edit fund requests',
            'delete fund requests', 'approve fund requests', 'disburse fund requests',
        ];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->syncPermissions($permissions);

        $staffRole = Role::firstOrCreate(['name' => 'staff']);
        $staffRole->syncPermissions(['view fund requests', 'create fund requests', 'edit fund requests']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->staff = User::factory()->create();
        $this->staff->assignRole('staff');

        $this->category = TransactionCategory::create(['type' => 'expense', 'label' => 'Operasional']);
    }

    private function makeDraftFundRequest(User $user): FundRequest
    {
        $fr = FundRequest::create([
            'request_number' => '001/KSN/I/2026',
            'user_id' => $user->id,
            'title' => 'Kebutuhan Kantor',
            'purpose' => 'Pembelian ATK',
            'total_amount' => 0,
            'priority' => 'medium',
            'needed_by_date' => now()->addDays(7)->toDateString(),
            'status' => 'draft',
        ]);

        FundRequestItem::create([
            'fund_request_id' => $fr->id,
            'description' => 'Beli Kertas A4',
            'category_id' => $this->category->id,
            'quantity' => 5,
            'unit_price' => 50000,
            'amount' => 250000,
        ]);

        $fr->calculateTotalAmount();

        return $fr;
    }

    public function test_index_requires_authentication(): void
    {
        $this->get('/fund-requests')->assertRedirect('/login');
    }

    public function test_index_renders_for_authorized_user(): void
    {
        $this->actingAs($this->admin)->get('/fund-requests')->assertOk();
    }

    public function test_create_page_renders(): void
    {
        $this->actingAs($this->staff)->get('/fund-requests/create')->assertOk();
    }

    public function test_store_creates_draft_fund_request(): void
    {
        $this->actingAs($this->staff)->post('/fund-requests', [
            'request_number' => '002/KSN/I/2026',
            'title' => 'Pembelian Peralatan',
            'purpose' => 'Keperluan operasional',
            'priority' => 'high',
            'needed_by_date' => now()->addDays(5)->toDateString(),
            'action' => 'draft',
            'items' => [
                [
                    'description' => 'Printer',
                    'category_id' => $this->category->id,
                    'quantity' => 1,
                    'unit_price' => 2000000,
                    'notes' => null,
                ],
            ],
        ]);

        $this->assertDatabaseHas('fund_requests', [
            'title' => 'Pembelian Peralatan',
            'user_id' => $this->staff->id,
            'status' => 'draft',
        ]);
    }

    public function test_store_with_submit_action_sets_pending_status(): void
    {
        $this->actingAs($this->staff)->post('/fund-requests', [
            'request_number' => '003/KSN/I/2026',
            'title' => 'Transportasi Klien',
            'purpose' => 'Perjalanan dinas',
            'priority' => 'medium',
            'needed_by_date' => now()->addDays(3)->toDateString(),
            'action' => 'submit',
            'items' => [
                [
                    'description' => 'Bensin',
                    'category_id' => $this->category->id,
                    'quantity' => 2,
                    'unit_price' => 100000,
                    'notes' => null,
                ],
            ],
        ]);

        $this->assertDatabaseHas('fund_requests', [
            'title' => 'Transportasi Klien',
            'status' => 'pending',
        ]);
    }

    public function test_submit_changes_status_to_pending(): void
    {
        $fr = $this->makeDraftFundRequest($this->staff);

        $this->actingAs($this->staff)->post("/fund-requests/{$fr->id}/submit");

        $this->assertDatabaseHas('fund_requests', [
            'id' => $fr->id,
            'status' => 'pending',
        ]);
    }

    public function test_submit_only_allowed_for_owner(): void
    {
        $fr = $this->makeDraftFundRequest($this->staff);

        $otherUser = User::factory()->create();
        $otherUser->assignRole('staff');

        $this->actingAs($otherUser)
            ->post("/fund-requests/{$fr->id}/submit")
            ->assertForbidden();
    }

    public function test_review_approve_changes_status(): void
    {
        $fr = $this->makeDraftFundRequest($this->staff);
        $fr->update(['status' => 'pending']);

        $this->actingAs($this->admin)->post("/fund-requests/{$fr->id}/review", [
            'action' => 'approve',
            'review_notes' => 'Disetujui',
        ]);

        $this->assertDatabaseHas('fund_requests', [
            'id' => $fr->id,
            'status' => 'approved',
        ]);
    }

    public function test_review_reject_changes_status(): void
    {
        $this->withoutExceptionHandling();
        $fr = $this->makeDraftFundRequest($this->staff);
        $fr->update(['status' => 'pending']);

        $this->actingAs($this->admin)->post("/fund-requests/{$fr->id}/review", [
            'action' => 'reject',
        ]);

        $this->assertDatabaseHas('fund_requests', [
            'id' => $fr->id,
            'status' => 'rejected',
        ]);
    }

    public function test_review_requires_approve_permission(): void
    {
        $fr = $this->makeDraftFundRequest($this->staff);
        $fr->update(['status' => 'pending']);

        $this->actingAs($this->staff)->post("/fund-requests/{$fr->id}/review", [
            'action' => 'approve',
        ])->assertForbidden();
    }

    public function test_disburse_works_without_disbursement_notes(): void
    {
        $fr = $this->makeDraftFundRequest($this->staff);
        $fr->update(['status' => 'approved']);

        $account = BankAccount::factory()->create();

        $this->actingAs($this->admin)->post("/fund-requests/{$fr->id}/disburse", [
            'bank_account_id' => $account->id,
            'disbursement_date' => now()->toDateString(),
        ])->assertRedirect();

        $this->assertDatabaseHas('fund_requests', [
            'id' => $fr->id,
            'status' => 'disbursed',
        ]);
        $this->assertDatabaseHas('bank_transactions', [
            'bank_account_id' => $account->id,
            'transaction_type' => 'debit',
            'reference_number' => null,
        ]);
    }

    public function test_disburse_attaches_payment_proof_to_created_transactions(): void
    {
        Storage::fake('public');

        $fr = $this->makeDraftFundRequest($this->staff);
        $fr->update(['status' => 'approved']);

        $account = BankAccount::factory()->create();

        $this->actingAs($this->admin)->post("/fund-requests/{$fr->id}/disburse", [
            'bank_account_id' => $account->id,
            'disbursement_date' => now()->toDateString(),
            'attachment' => UploadedFile::fake()->image('bukti-transfer.png'),
        ])->assertRedirect();

        $transaction = BankTransaction::where('bank_account_id', $account->id)->first();
        $this->assertNotNull($transaction->attachment_path);
        $this->assertSame('bukti-transfer.png', $transaction->attachment_name);
        Storage::disk('public')->assertExists($transaction->attachment_path);

        $this->actingAs($this->admin)->get('/fund-requests')->assertInertia(
            fn (AssertableInertia $page) => $page
                ->where('rows.0.disbursement_attachment_name', 'bukti-transfer.png')
                ->where('rows.0.disbursement_account_name', $account->account_name.' — '.$account->bank_name)
                ->where('rows.0.items.0.description', 'Beli Kertas A4')
                ->etc()
        );
    }

    public function test_destroy_deletes_draft_fund_request(): void
    {
        $fr = $this->makeDraftFundRequest($this->admin);

        $this->actingAs($this->admin)->delete("/fund-requests/{$fr->id}");

        $this->assertDatabaseMissing('fund_requests', ['id' => $fr->id]);
    }

    public function test_staff_cannot_delete_without_permission(): void
    {
        $fr = $this->makeDraftFundRequest($this->staff);

        $this->actingAs($this->staff)->delete("/fund-requests/{$fr->id}")->assertForbidden();
        $this->assertDatabaseHas('fund_requests', ['id' => $fr->id]);
    }

    /**
     * Regresi BUG-FR-02 (QA 2026-08-19): canDelete() tidak memeriksa
     * kepemilikan, sehingga pemegang permission "delete fund requests"
     * (mis. staff) dapat menghapus draft milik orang lain — asimetris
     * dengan update()/submit() yang sudah mengecek user_id.
     */
    public function test_staff_cannot_delete_another_users_fund_request(): void
    {
        $lain = User::factory()->create();
        $lain->assignRole('staff');
        $fr = $this->makeDraftFundRequest($lain);

        $penyerang = User::factory()->create();
        $penyerang->assignRole('staff');
        Role::findByName('staff')->givePermissionTo('delete fund requests');

        $this->actingAs($penyerang)
            ->delete("/fund-requests/{$fr->id}")
            ->assertRedirect();

        $this->assertDatabaseHas('fund_requests', ['id' => $fr->id]);
    }

    public function test_owner_can_still_delete_own_draft_fund_request(): void
    {
        $fr = $this->makeDraftFundRequest($this->staff);
        Role::findByName('staff')->givePermissionTo('delete fund requests');

        $this->actingAs($this->staff)
            ->delete("/fund-requests/{$fr->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('fund_requests', ['id' => $fr->id]);
    }
}
