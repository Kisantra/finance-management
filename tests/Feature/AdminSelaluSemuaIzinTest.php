<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Role admin selalu memegang semua permission: central:sync-admin-permissions tiap deploy
 * memberi permission baru, dan halaman Izin & Peran mengunci role admin. Tanpa kunci,
 * "Cabut semua" pada admin mencabut `manage permissions` dan mengunci semua admin keluar.
 */
class AdminSelaluSemuaIzinTest extends TestCase
{
    use RefreshDatabase;

    private Role $admin;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        foreach (['view permissions', 'manage permissions', 'view invoices', 'fitur baru rilis ini'] as $nama) {
            Permission::firstOrCreate(['name' => $nama, 'guard_name' => 'web']);
        }
        $this->admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $this->admin->syncPermissions(['view permissions', 'manage permissions']);
    }

    private function pengelola(): User
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    }

    public function test_sinkron_memberi_admin_semua_permission_dan_idempoten(): void
    {
        $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'web']);
        $staff->syncPermissions(['view invoices']);

        $this->artisan('central:sync-admin-permissions')->assertSuccessful();
        $this->artisan('central:sync-admin-permissions')
            ->expectsOutputToContain('0 permission baru diberikan')
            ->assertSuccessful();

        $this->assertEqualsCanonicalizing(
            Permission::pluck('name')->all(),
            $this->admin->fresh()->permissions->pluck('name')->all(),
        );
        $this->assertSame(['view invoices'], $staff->fresh()->permissions->pluck('name')->all(),
            'Role lain tidak boleh ikut disentuh.');
    }

    public function test_tanpa_role_admin_sinkron_dilewati_tanpa_gagal(): void
    {
        $this->admin->delete();

        $this->artisan('central:sync-admin-permissions')
            ->expectsOutputToContain('Role admin belum ada')
            ->assertSuccessful();
    }

    public function test_izin_admin_tidak_bisa_dicabut_dari_halaman(): void
    {
        $izin = Permission::findByName('manage permissions');

        $this->actingAs($this->pengelola())
            ->post('/admin/permissions/toggle', ['role_id' => $this->admin->id, 'permission_id' => $izin->id])
            ->assertSessionHas('error');
        $this->actingAs($this->pengelola())
            ->post('/admin/permissions/sync-all', ['role_id' => $this->admin->id, 'action' => 'revoke'])
            ->assertSessionHas('error');

        $this->assertTrue($this->admin->fresh()->hasPermissionTo('manage permissions'),
            'Admin tidak boleh bisa mengunci dirinya sendiri keluar.');
    }

    public function test_nama_role_admin_tidak_bisa_diganti(): void
    {
        $this->actingAs($this->pengelola())
            ->put("/admin/roles/{$this->admin->id}", ['name' => 'superuser', 'icon' => 'shield-check'])
            ->assertSessionHas('error');

        $this->assertSame('admin', $this->admin->fresh()->name);
    }

    public function test_role_lain_tetap_bisa_diatur(): void
    {
        $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'web']);
        $izin = Permission::findByName('view invoices');

        $this->actingAs($this->pengelola())
            ->post('/admin/permissions/toggle', ['role_id' => $staff->id, 'permission_id' => $izin->id])
            ->assertRedirect()
            ->assertSessionMissing('error');

        $this->assertTrue($staff->fresh()->hasPermissionTo('view invoices'));
    }
}
