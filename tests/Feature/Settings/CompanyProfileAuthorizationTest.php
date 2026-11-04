<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Regresi BUG-SET-02 (QA 2026-08-19): route profil perusahaan sama sekali
 * tanpa gate permission, sehingga user role terendah pun dapat menimpa nama,
 * NPWP, status PKP, dan tarif PPN — data yang tampil di setiap PDF invoice
 * dan menggerakkan penomoran dokumen (computed_abbreviation).
 */
class CompanyProfileAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private function payloadSah(string $nama): array
    {
        return [
            'name' => $nama,
            'abbreviation' => 'SDU',
            'address' => 'Jl. Uji No. 1',
            'email' => 'uji@contoh.id',
            'phone' => '08123456789',
            'ppn_rate' => 11,
            'finance_manager_name' => 'Manajer Uji',
            'finance_manager_position' => 'Finance Manager',
        ];
    }

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'manage company profile']);
    }

    public function test_user_without_permission_cannot_open_company_settings(): void
    {
        $staffRole = Role::firstOrCreate(['name' => 'staff']);
        $staffRole->syncPermissions([]);

        $staff = User::factory()->create();
        $staff->assignRole('staff');

        $this->actingAs($staff)->get('/settings/company')->assertForbidden();
    }

    public function test_user_without_permission_cannot_overwrite_company_profile(): void
    {
        $staffRole = Role::firstOrCreate(['name' => 'staff']);
        $staffRole->syncPermissions([]);

        $staff = User::factory()->create();
        $staff->assignRole('staff');

        $this->actingAs($staff)
            ->post('/settings/company', $this->payloadSah('DITIMPA STAFF'))
            ->assertForbidden();

        $this->assertDatabaseMissing('company_profiles', ['name' => 'DITIMPA STAFF']);
    }

    public function test_user_with_permission_can_update_company_profile(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo('manage company profile');

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->post('/settings/company', $this->payloadSah('PT Sah Diubah'))
            ->assertRedirect();

        $this->assertDatabaseHas('company_profiles', ['name' => 'PT Sah Diubah']);
    }
}
