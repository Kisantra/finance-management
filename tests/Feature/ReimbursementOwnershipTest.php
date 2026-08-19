<?php

namespace Tests\Feature;

use App\Models\Reimbursement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Regresi BUG-R4 & BUG-R5 (QA 2026-08-19).
 *
 * BUG-R4: ReimbursementController::index memakai ?tab= apa adanya, sehingga
 * user tanpa permission approve cukup menambahkan ?tab=all untuk melihat
 * SELURUH reimbursement milik orang lain.
 *
 * BUG-R5: Reimbursement::canDelete() berkomentar "owner only" tetapi tidak
 * pernah memeriksa user_id — setiap pemegang "delete reimbursements"
 * (termasuk role staff bawaan) bisa menghapus pengajuan milik orang lain.
 */
class ReimbursementOwnershipTest extends TestCase
{
    use RefreshDatabase;

    protected User $staff;

    protected User $lain;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view reimbursements', 'create reimbursements', 'edit reimbursements', 'delete reimbursements'] as $p) {
            Permission::firstOrCreate(['name' => $p]);
        }

        // Role staff bawaan memang memegang delete reimbursements.
        $staffRole = Role::firstOrCreate(['name' => 'staff']);
        $staffRole->syncPermissions([
            'view reimbursements', 'create reimbursements',
            'edit reimbursements', 'delete reimbursements',
        ]);

        $this->staff = User::factory()->create();
        $this->staff->assignRole('staff');

        $this->lain = User::factory()->create();
        $this->lain->assignRole('staff');
    }

    private function milik(User $user, string $status = 'draft'): Reimbursement
    {
        return Reimbursement::create([
            'user_id' => $user->id,
            'title' => 'Pengajuan '.$user->id,
            'amount' => 500000,
            'expense_date' => now()->toDateString(),
            'category_input' => 'transport',
            'status' => $status,
            'payment_status' => 'unpaid',
        ]);
    }

    public function test_staff_cannot_see_other_users_reimbursements_via_tab_all(): void
    {
        $this->milik($this->lain);
        $milikSendiri = $this->milik($this->staff);

        $this->actingAs($this->staff)
            ->get('/reimbursements?tab=all')
            ->assertOk()
            ->assertInertia(
                fn (AssertableInertia $page) => $page
                    ->has('rows', 1)
                    ->where('rows.0.id', $milikSendiri->id)
                    ->etc()
            );
    }

    public function test_staff_cannot_delete_another_users_reimbursement(): void
    {
        $punyaOrangLain = $this->milik($this->lain);

        $this->actingAs($this->staff)
            ->delete("/reimbursements/{$punyaOrangLain->id}")
            ->assertRedirect();

        $this->assertDatabaseHas('reimbursements', ['id' => $punyaOrangLain->id]);
    }

    public function test_owner_can_still_delete_own_draft(): void
    {
        $milikSendiri = $this->milik($this->staff);

        $this->actingAs($this->staff)
            ->delete("/reimbursements/{$milikSendiri->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('reimbursements', ['id' => $milikSendiri->id]);
    }

    public function test_admin_can_still_delete_any_reimbursement(): void
    {
        Permission::firstOrCreate(['name' => 'delete reimbursements']);
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo('delete reimbursements', 'view reimbursements');

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $punyaOrangLain = $this->milik($this->lain, 'paid');

        $this->actingAs($admin)
            ->delete("/reimbursements/{$punyaOrangLain->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('reimbursements', ['id' => $punyaOrangLain->id]);
    }
}
