<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\PendingCommand;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Instalasi baru mentok: database pusat yang baru dimigrasi tidak punya user,
 * sehingga tidak ada yang bisa login, sementara satu-satunya jalan membuat
 * perusahaan menuntut admin yang sudah login. central:bootstrap memutus
 * lingkaran itu — ditemukan saat melatih jalur "server baru".
 */
class CentralBootstrapTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::findOrCreate('admin', 'web');
    }

    /**
     * @param  array<string, string>  $tambahan
     */
    private function jalankan(array $tambahan = []): PendingCommand
    {
        return $this->artisan('central:bootstrap', array_merge([
            '--organization' => 'Nusantara Group',
            '--name' => 'Admin Nusantara',
            '--email' => 'admin@nusantara.test',
            '--password' => 'RahasiaBaru2026!',
        ], $tambahan));
    }

    public function test_membuat_organization_dan_admin_pertama(): void
    {
        $this->jalankan(['--quota' => '5'])->assertSuccessful();

        $organization = Organization::where('slug', 'nusantara-group')->firstOrFail();
        $this->assertSame(5, $organization->company_quota);

        $admin = User::where('email', 'admin@nusantara.test')->firstOrFail();
        $this->assertSame($organization->id, $admin->organization_id);
        $this->assertTrue(
            Hash::check('RahasiaBaru2026!', $admin->password),
            'Admin pertama harus bisa login dengan sandi yang diberikan operator.'
        );
    }

    public function test_tanpa_admin_hanya_membuat_organization_dan_idempoten(): void
    {
        $opsi = ['--organization' => 'Kisantra Group', '--quota' => '3', '--tanpa-admin' => true];

        $this->artisan('central:bootstrap', $opsi)->assertSuccessful();
        $this->artisan('central:bootstrap', $opsi)->assertSuccessful();

        $this->assertSame(1, Organization::where('slug', 'kisantra-group')->count());
        $this->assertSame(3, Organization::where('slug', 'kisantra-group')->value('company_quota'));
        $this->assertSame(0, User::count(),
            'Cutover tidak boleh membuat akun: ID user lama harus tetap kosong untuk central:import-users.');
    }

    public function test_menolak_jalan_bila_sudah_ada_user(): void
    {
        User::factory()->create();

        $this->jalankan()->assertFailed();

        $this->assertNull(User::where('email', 'admin@nusantara.test')->first(),
            'Database yang sudah terisi tidak boleh disentuh — itu jalur adopt-database, bukan bootstrap.');
    }

    public function test_menolak_bila_role_admin_belum_diseed(): void
    {
        Role::query()->delete();

        $this->jalankan()->assertFailed();

        $this->assertSame(0, Organization::where('slug', 'nusantara-group')->count(),
            'Gagal di tengah jalan lebih buruk daripada tidak mulai: organization tidak boleh terbentuk.');
    }

    public function test_sandi_lemah_ditolak(): void
    {
        $this->jalankan(['--password' => 'abc'])->assertFailed();

        $this->assertSame(0, User::count());
    }
}
