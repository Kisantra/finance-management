<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;
use Stancl\Tenancy\Events\TenantCreated;
use Tests\TestCase;

/**
 * Instalasi baru lewat website: deploy.sh (mode instalasi) menulis berkas token; selama ada,
 * semua halaman diarahkan ke /setup, dan hanya pembuka tautan sekali pakai yang bisa membuat
 * admin + perusahaan pertama. Pengganti `central:bootstrap` di terminal.
 */
class WalkthroughPemasanganTest extends TestCase
{
    use RefreshDatabase;

    private string $tokenPath;

    private string $token;

    /** Acak: nama database tujuan (awalan + slug) tidak boleh kebetulan sudah ada di server MySQL. */
    private string $slug;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tokenPath = sys_get_temp_dir().'/setup-token-'.bin2hex(random_bytes(4));
        $this->token = bin2hex(random_bytes(16));
        $this->slug = 'uji'.bin2hex(random_bytes(3));
        file_put_contents($this->tokenPath, $this->token);
        config(['app.setup_token_path' => $this->tokenPath]);
        // Global (company_id NULL) seperti buatan MasterPermissionSeeder; findOrCreate Spatie
        // mengikatnya ke team aktif (perusahaan uji), dan assignRole di perusahaan baru gagal.
        Role::query()->firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
    }

    protected function tearDown(): void
    {
        @unlink($this->tokenPath);

        parent::tearDown();
    }

    /**
     * @return array<string, string>
     */
    private function isian(array $timpa = []): array
    {
        return array_merge([
            'admin_name' => 'Admin Pertama',
            'admin_email' => 'admin@perusahaan-baru.test',
            'admin_password' => 'RahasiaBaru2026!',
            'admin_password_confirmation' => 'RahasiaBaru2026!',
            'company_name' => 'PT Nusantara Jaya',
            'slug' => $this->slug,
            'abbreviation' => 'nsj',
        ], $timpa);
    }

    public function test_selama_token_ada_semua_halaman_diarahkan_ke_setup(): void
    {
        $this->get('/login')->assertRedirect('/setup');
    }

    public function test_tanpa_tautan_form_terkunci_dan_post_ditolak(): void
    {
        $this->get('/setup')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('setup/index')->where('unlocked', false));

        $this->post('/setup', $this->isian())->assertForbidden();
        $this->assertSame(0, User::count());
    }

    public function test_tautan_salah_tidak_membuka(): void
    {
        $this->get('/setup/'.str_repeat('a', 32))->assertRedirect('/setup');

        $this->get('/setup')->assertInertia(fn (Assert $page) => $page->where('unlocked', false));
    }

    public function test_tautan_benar_membuat_admin_dan_perusahaan_lalu_menutup_walkthrough(): void
    {
        Event::fake([TenantCreated::class]);

        $this->get("/setup/{$this->token}")->assertRedirect('/setup');
        $this->post('/setup', $this->isian())->assertRedirect("/c/{$this->slug}/settings/company");

        $admin = User::where('email', 'admin@perusahaan-baru.test')->firstOrFail();
        $this->assertAuthenticatedAs($admin);
        $this->assertNotNull($admin->organization_id);
        $this->assertTrue($admin->companies()->whereKey($this->slug)->exists());

        $perusahaan = Company::findOrFail($this->slug);
        $this->assertSame('NSJ', $perusahaan->abbreviation);
        setPermissionsTeamId($this->slug);
        $this->assertTrue($admin->fresh()->hasRole('admin'), 'Pembuat menjadi admin di perusahaan pertama.');

        $this->assertFileDoesNotExist($this->tokenPath, 'Tautan sekali pakai: walkthrough tertutup sesudah selesai.');
        $this->get('/login')->assertStatus(302)->assertRedirect(route('choose-company'));
    }

    public function test_kode_url_yang_databasenya_sudah_ada_di_server_ditolak(): void
    {
        $database = DB::getDatabaseName();
        $slug = substr($database, -4);
        if (preg_match('/^[a-z0-9]{4}$/', $slug) !== 1) {
            $this->markTestSkipped('Nama database test tidak berakhir dengan 4 huruf/angka.');
        }
        config(['tenancy.database.prefix' => substr($database, 0, -4)]);

        $this->get("/setup/{$this->token}");
        $this->post('/setup', $this->isian(['slug' => $slug]))->assertSessionHasErrors('slug');

        $this->assertSame(0, Company::query()->whereKey($slug)->count());
    }
}
