<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use App\Services\CentralUserImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class CompanyPermissionIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    private function makeCompany(string $id): Company
    {
        $organization = Organization::firstOrCreate(
            ['slug' => 'org-test'],
            ['name' => 'Org Test', 'company_quota' => 10]
        );

        return Company::withoutEvents(fn () => Company::create([
            'id' => $id,
            'organization_id' => $organization->id,
            'name' => strtoupper($id),
            'abbreviation' => strtoupper(substr($id, 0, 3)),
            'status' => 'active',
        ]));
    }

    /** Role global (company_id NULL) + permission, dibuat sekali */
    private function seedGlobalRoles(): void
    {
        setPermissionsTeamId(null);

        $approve = Permission::firstOrCreate(['name' => 'approve reimbursements']);
        $view = Permission::firstOrCreate(['name' => 'view clients']);

        Role::firstOrCreate(['name' => 'finance manager'])->syncPermissions([$approve, $view]);
        Role::firstOrCreate(['name' => 'staff'])->syncPermissions([$view]);
    }

    public function test_role_assignment_is_scoped_per_company(): void
    {
        $companyA = $this->makeCompany('pt-a');
        $companyB = $this->makeCompany('pt-b');
        $this->seedGlobalRoles();

        $user = User::factory()->create();

        setPermissionsTeamId($companyA->id);
        $user->assignRole('finance manager');

        setPermissionsTeamId($companyB->id);
        $user->unsetRelation('roles');
        $user->assignRole('staff');

        setPermissionsTeamId($companyA->id);
        $user->unsetRelation('roles')->unsetRelation('permissions');
        $this->assertTrue($user->hasRole('finance manager'));
        $this->assertTrue($user->can('approve reimbursements'));

        setPermissionsTeamId($companyB->id);
        $user->unsetRelation('roles')->unsetRelation('permissions');
        $this->assertFalse($user->hasRole('finance manager'));
        $this->assertTrue($user->hasRole('staff'));
        $this->assertFalse($user->can('approve reimbursements'));
    }

    public function test_middleware_resolves_team_from_user_membership(): void
    {
        $company = $this->makeCompany('pt-c');
        $this->seedGlobalRoles();

        $member = User::factory()->create();
        $member->companies()->attach($company->id);
        setPermissionsTeamId($company->id);
        $member->assignRole('staff');

        // Konteks team harus mengikuti perusahaan di URL (tenant path),
        // bukan nilai setPermissionsTeamId yang tersisa sebelumnya
        setPermissionsTeamId('bukan-company-user');

        $this->actingAs($member)->get("/c/{$company->id}/clients")->assertOk();

        // Perusahaan lain di URL yang user-nya bukan anggota → 403
        $other = $this->makeCompany('pt-lain');
        $this->actingAs($member)->get("/c/{$other->id}/clients")->assertForbidden();
    }

    public function test_user_without_role_in_active_company_is_denied(): void
    {
        $companyA = $this->makeCompany('pt-a');
        $companyB = $this->makeCompany('pt-b');
        $this->seedGlobalRoles();

        // Role hanya di company B; keanggotaan (dan konteks middleware) di company A
        $user = User::factory()->create();
        $user->companies()->attach($companyA->id);
        setPermissionsTeamId($companyB->id);
        $user->assignRole('staff');

        $this->actingAs($user)->get('/clients')->assertForbidden();
    }

    public function test_import_service_is_idempotent_and_assigns_scoped_role(): void
    {
        $company = $this->makeCompany('pt-d');
        $organization = Organization::where('slug', 'org-test')->firstOrFail();
        $this->seedGlobalRoles();

        $rows = [[
            'name' => 'Budi',
            'email' => 'budi@example.com',
            'password' => Hash::make('rahasia'),
            'role' => 'staff',
        ]];

        $service = new CentralUserImportService;
        $first = $service->import($rows, $organization, $company);
        $second = $service->import($rows, $organization, $company);

        $this->assertSame(['imported' => 1, 'existing' => 0, 'memberships' => 1], $first);
        $this->assertSame(['imported' => 0, 'existing' => 1, 'memberships' => 0], $second);

        $budi = User::where('email', 'budi@example.com')->firstOrFail();
        $this->assertSame($organization->id, $budi->organization_id);
        $this->assertTrue($budi->companies()->whereKey($company->id)->exists());

        setPermissionsTeamId($company->id);
        $this->assertTrue($budi->fresh()->hasRole('staff'));
    }
}
