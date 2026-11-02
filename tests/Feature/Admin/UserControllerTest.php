<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        Permission::firstOrCreate(['name' => 'manage users']);
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo('manage users');
        Role::firstOrCreate(['name' => 'staff']);
        // Dibutuhkan statistik di halaman index (User::role('finance manager')).
        Role::firstOrCreate(['name' => 'finance manager']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_admin_can_update_a_user(): void
    {
        $target = User::factory()->create(['status' => 'inactive']);
        $target->assignRole('staff');
        // Keanggotaan perusahaan WAJIB disetel eksplisit: actingAs() hanya
        // mendaftarkan user yang login, bukan sasarannya. Di produksi sasaran
        // selalu anggota — /admin/users hanya melisting anggota — jadi tanpa
        // baris ini fixture-nya menguji keadaan yang tidak mungkin terjadi.
        $target->companies()->syncWithoutDetaching([self::TEST_COMPANY]);

        $this->actingAs($this->admin)
            ->put("/admin/users/{$target->id}", [
                'name' => 'Nama Baru',
                'email' => $target->email,
                'status' => 'active',
                'role' => 'staff',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'name' => 'Nama Baru',
            'status' => 'active',
        ]);
    }

    /**
     * GERBANG. `manage users` adalah izin, bukan keanggotaan.
     *
     * `users` hidup di database CENTRAL, jadi route-model binding menemukan
     * pengguna perusahaan MANA PUN dari id-nya. Sebelum penjaga dipasang, PUT
     * ke id pengguna perusahaan lain menjawab 422 — validasi sudah berjalan,
     * artinya barisnya ditemukan dan hampir diperbarui, termasuk sandi dan
     * role-nya. Harus 404, bukan 403: keberadaan pengguna perusahaan lain bukan
     * informasi yang perlu dibocorkan.
     */
    public function test_admin_cannot_update_user_of_another_company(): void
    {
        $asing = User::factory()->create(['name' => 'Milik PT Lain']);
        $asing->assignRole('staff');
        $asing->companies()->detach();

        $this->actingAs($this->admin)
            ->put("/admin/users/{$asing->id}", [
                'name' => 'Diubah Dari Luar',
                'email' => $asing->email,
                'status' => 'active',
                'role' => 'staff',
            ])
            ->assertNotFound();

        $this->assertDatabaseHas('users', [
            'id' => $asing->id,
            'name' => 'Milik PT Lain',
        ]);
    }

    public function test_admin_cannot_delete_user_of_another_company(): void
    {
        $asing = User::factory()->create();
        $asing->companies()->detach();

        $this->actingAs($this->admin)
            ->delete("/admin/users/{$asing->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('users', ['id' => $asing->id]);
    }

    public function test_bulk_delete_skips_users_of_another_company(): void
    {
        $milikKita = User::factory()->create();
        $milikKita->companies()->syncWithoutDetaching([self::TEST_COMPANY]);

        $asing = User::factory()->create();
        $asing->companies()->detach();

        $this->actingAs($this->admin)
            ->post('/admin/users/bulk-delete', ['ids' => [$milikKita->id, $asing->id]])
            ->assertRedirect();

        $this->assertDatabaseMissing('users', ['id' => $milikKita->id]);
        $this->assertDatabaseHas('users', ['id' => $asing->id]);
    }

    public function test_user_list_only_contains_members_of_active_company(): void
    {
        $anggota = User::factory()->create(['name' => 'Anggota Perusahaan Ini']);
        $anggota->companies()->syncWithoutDetaching([self::TEST_COMPANY]);

        $asing = User::factory()->create(['name' => 'Anggota PT Lain']);
        $asing->companies()->detach();

        $terlihat = $this->actingAs($this->admin)
            ->get('/admin/users')
            ->assertOk()
            ->viewData('page')['props']['users']['data'];

        $nama = array_column($terlihat, 'name');

        $this->assertContains('Anggota Perusahaan Ini', $nama);
        $this->assertNotContains(
            'Anggota PT Lain',
            $nama,
            'BOCOR: daftar pengguna memuat anggota perusahaan lain. Tabel `users` central — '
            .'Admin\UserController::index() kehilangan cakupan memberOfCurrentCompany().'
        );
    }

    public function test_update_is_forbidden_without_manage_users(): void
    {
        $noPerm = User::factory()->create();
        $target = User::factory()->create();
        $target->assignRole('staff');

        $this->actingAs($noPerm)
            ->put("/admin/users/{$target->id}", [
                'name' => 'Hack',
                'email' => $target->email,
                'status' => 'active',
                'role' => 'staff',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['name' => 'Hack']);
    }
}
