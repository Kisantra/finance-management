<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Database\Seeders\MitraGroupSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

class MitraGroupSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Jangan buat database tenant sungguhan di test
        Event::fake([TenantCreated::class]);
    }

    public function test_seeds_organization_ten_companies_and_scoped_users(): void
    {
        $this->seed(MitraGroupSeeder::class);

        $organization = Organization::where('slug', 'mitra-group')->firstOrFail();
        $this->assertSame(10, $organization->companies()->count());
        $this->assertSame(10, $organization->company_quota);

        Event::assertDispatchedTimes(TenantCreated::class, 10);

        // Manager & admin: anggota SEMUA perusahaan dengan role masing-masing
        $manager = User::where('email', 'manager@mitragroup.id')->firstOrFail();
        $admin = User::where('email', 'admin@mitragroup.id')->firstOrFail();
        $this->assertSame(10, $manager->companies()->count());
        $this->assertSame(10, $admin->companies()->count());

        setPermissionsTeamId('abdi-ocean-energy');
        $this->assertTrue($manager->hasRole('finance manager'));
        $this->assertTrue($admin->fresh()->hasRole('admin'));

        setPermissionsTeamId('samboja-laju-utama');
        $this->assertTrue($manager->fresh()->hasRole('finance manager'));

        // Staff: satu per perusahaan, role hanya di perusahaannya
        $staff = User::where('email', 'staff.aoe@mitragroup.id')->firstOrFail();
        $this->assertSame(1, $staff->companies()->count());
        $this->assertTrue($staff->companies()->whereKey('abdi-ocean-energy')->exists());

        setPermissionsTeamId('abdi-ocean-energy');
        $this->assertTrue($staff->hasRole('staff'));

        setPermissionsTeamId('samboja-laju-utama');
        $this->assertFalse($staff->fresh()->hasRole('staff'));
    }

    public function test_seeder_is_idempotent(): void
    {
        $this->seed(MitraGroupSeeder::class);
        $this->seed(MitraGroupSeeder::class);

        $this->assertSame(10, Company::where('organization_id',
            Organization::where('slug', 'mitra-group')->value('id'))->count());

        // Provisioning hanya terpicu di run pertama
        Event::assertDispatchedTimes(TenantCreated::class, 10);

        $manager = User::where('email', 'manager@mitragroup.id')->firstOrFail();
        $this->assertSame(10, $manager->companies()->count());
    }
}
