<?php

namespace Tests\Feature\Admin;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class CompanyControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected Organization $organization;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        setPermissionsTeamId(null);
        Permission::firstOrCreate(['name' => 'manage companies']);
        Role::firstOrCreate(['name' => 'admin'])->givePermissionTo('manage companies');
        setPermissionsTeamId(self::TEST_COMPANY);

        $this->organization = Organization::where('slug', 'test-org')->firstOrFail();

        $this->admin = User::factory()->create();
        $this->admin->organization()->associate($this->organization->id)->save();
        $this->admin->assignRole('admin');
    }

    public function test_index_lists_companies_with_quota(): void
    {
        $this->actingAs($this->admin)
            ->get('/admin/companies')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/companies/index')
                ->has('companies', 1)
                ->where('companies.0.slug', self::TEST_COMPANY)
                ->where('quota.total', 100)
            );
    }

    public function test_store_provisions_company_and_grants_creator_admin_access(): void
    {
        Event::fake([TenantCreated::class]);

        $this->actingAs($this->admin)
            ->post('/admin/companies', [
                'name' => 'PT Kinara Sejahtera',
                'slug' => 'pt-kinara',
                'abbreviation' => 'knr',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('companies', [
            'id' => 'pt-kinara',
            'name' => 'PT Kinara Sejahtera',
            'abbreviation' => 'KNR',
            'organization_id' => $this->organization->id,
        ]);

        Event::assertDispatched(TenantCreated::class);

        $this->assertTrue($this->admin->companies()->whereKey('pt-kinara')->exists());

        setPermissionsTeamId('pt-kinara');
        $this->assertTrue($this->admin->fresh()->hasRole('admin'));
    }

    public function test_store_rejects_invalid_slug(): void
    {
        Event::fake([TenantCreated::class]);

        $this->actingAs($this->admin)
            ->post('/admin/companies', [
                'name' => 'PT Salah',
                'slug' => 'PT Salah!',
                'abbreviation' => 'PS',
            ])
            ->assertSessionHasErrors('slug');

        Event::assertNotDispatched(TenantCreated::class);
    }

    public function test_store_rejects_duplicate_slug(): void
    {
        Event::fake([TenantCreated::class]);

        $this->actingAs($this->admin)
            ->post('/admin/companies', [
                'name' => 'Duplikat',
                'slug' => self::TEST_COMPANY,
                'abbreviation' => 'DUP',
            ])
            ->assertSessionHasErrors('slug');
    }

    public function test_store_enforces_organization_quota(): void
    {
        Event::fake([TenantCreated::class]);
        $this->organization->update(['company_quota' => 1]);

        $this->actingAs($this->admin)
            ->post('/admin/companies', [
                'name' => 'PT Lebih',
                'slug' => 'pt-lebih',
                'abbreviation' => 'PL',
            ])
            ->assertSessionHasErrors('slug');

        $this->assertDatabaseMissing('companies', ['id' => 'pt-lebih']);
    }

    public function test_store_requires_manage_companies_permission(): void
    {
        $noPerm = User::factory()->create();
        $noPerm->organization()->associate($this->organization->id)->save();

        $this->actingAs($noPerm)
            ->post('/admin/companies', [
                'name' => 'PT Ilegal',
                'slug' => 'pt-ilegal',
                'abbreviation' => 'IL',
            ])
            ->assertForbidden();
    }

    public function test_retry_reprovisions_failed_company(): void
    {
        Event::fake([TenantCreated::class]);

        Company::withoutEvents(fn () => Company::create([
            'id' => 'pt-gagal',
            'organization_id' => $this->organization->id,
            'name' => 'PT Gagal',
            'abbreviation' => 'PG',
            'status' => 'failed',
        ]));

        $this->actingAs($this->admin)
            ->post('/admin/companies/pt-gagal/retry')
            ->assertRedirect()
            ->assertSessionHas('success');

        Event::assertDispatched(TenantCreated::class);
        $this->assertDatabaseHas('companies', ['id' => 'pt-gagal', 'name' => 'PT Gagal']);
        $this->assertTrue($this->admin->companies()->whereKey('pt-gagal')->exists());
    }

    public function test_retry_rejected_for_active_company(): void
    {
        $this->actingAs($this->admin)
            ->post('/admin/companies/'.self::TEST_COMPANY.'/retry')
            ->assertForbidden();
    }
}
