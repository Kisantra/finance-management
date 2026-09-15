<?php

namespace Tests\Feature;

use App\Models\Feedback;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Regresi produksi 2026-09-15: tombol logout di finance.kisantra.com berakhir di
 * halaman polos "419 PAGE EXPIRED".
 *
 * Dua cacat bertumpuk:
 * 1. Form logout membaca token CSRF dari <meta> yang dirender sekali saat halaman
 *    pertama dimuat — begitu sesi berakhir, token itu basi.
 * 2. Penanganan TokenMismatchException di bootstrap/app.php tidak pernah terpicu:
 *    Handler Laravel mengubahnya menjadi HttpException(419) SEBELUM callback render
 *    dicocokkan, sehingga callback bertipe TokenMismatchException adalah kode mati.
 */
class ErrorPageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.debug' => false]);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['view feedbacks', 'create feedbacks'] as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(['view feedbacks', 'create feedbacks']);
        Role::firstOrCreate(['name' => 'finance manager']);
        Role::firstOrCreate(['name' => 'staff'])->syncPermissions(['view feedbacks', 'create feedbacks']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->staff = User::factory()->create();
        $this->staff->assignRole('staff');

        Route::middleware('web')->get('/_uji/meledak', function () {
            throw new RuntimeException('SQLSTATE rahasia: password=hunter2');
        });

        Route::middleware('web')->post('/_uji/token-basi', fn () => 'tidak pernah sampai');

        Route::middleware('web')->get('/_uji/query-rusak', fn () => DB::table('tabel_yang_tidak_pernah_ada')->get());
    }

    /**
     * Middleware CSRF sengaja melewati pemeriksaan saat unit test. Tanpa ini mustahil
     * mereproduksi 419 yang terjadi di produksi.
     */
    private function aktifkanPemeriksaanCsrf(): void
    {
        $this->app->instance(ValidateCsrfToken::class, new class($this->app, $this->app['encrypter']) extends ValidateCsrfToken
        {
            protected function runningUnitTests(): bool
            {
                return false;
            }
        });
    }

    public function test_logout_dengan_token_basi_diarahkan_ke_login_bukan_419(): void
    {
        $this->aktifkanPemeriksaanCsrf();

        $this->actingAs($this->staff)
            ->post('/logout', ['_token' => 'token-dari-meta-yang-sudah-basi'])
            ->assertRedirect(route('login'));
    }

    public function test_token_basi_di_luar_logout_menampilkan_halaman_error_419(): void
    {
        $this->aktifkanPemeriksaanCsrf();

        $this->actingAs($this->staff)
            ->post('/_uji/token-basi', ['_token' => 'basi'])
            ->assertStatus(419)
            ->assertInertia(fn (Assert $page) => $page
                ->component('error')
                ->where('status', 419)
                ->where('can_report', false)
            );
    }

    public function test_halaman_tidak_ditemukan_memakai_halaman_error(): void
    {
        $this->actingAs($this->staff)
            ->get('/halaman-yang-tidak-pernah-ada')
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page
                ->component('error')
                ->where('status', 404)
                ->where('is_guest', false)
                ->has('report.id')
                ->has('report.markdown')
            );
    }

    /**
     * actingAs() menyuntikkan user langsung ke guard tanpa sesi, sehingga tidak bisa
     * membuktikan hal ini — celah ini lolos dari tes pertama dan baru tertangkap saat
     * diuji di browser. Cookie sesi hanya dipasang bila middleware `web` berjalan.
     */
    public function test_url_tidak_dikenal_tetap_melewati_middleware_web_agar_login_terbaca(): void
    {
        $response = $this->get('/sama-sekali-tidak-ada-rutenya')->assertNotFound();

        $sessionCookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));

        $this->assertNotNull($sessionCookie,
            'Tanpa middleware web, sesi tidak dimulai dan pengguna yang login tampil sebagai tamu.');
    }

    public function test_detail_teknis_tersembunyi_dari_pengguna_biasa(): void
    {
        $response = $this->actingAs($this->staff)->get('/_uji/meledak');

        $response->assertStatus(500)->assertInertia(fn (Assert $page) => $page
            ->component('error')
            ->where('status', 500)
            ->where('report.technical', null)
            ->where('can_report', true)
        );

        $markdown = $response->viewData('page')['props']['report']['markdown'];

        $this->assertStringNotContainsString('hunter2', $markdown,
            'Pesan exception bisa memuat data sensitif — tidak boleh sampai ke pengguna biasa.');
        $this->assertStringNotContainsString('RuntimeException', $markdown);
        $this->assertStringContainsString($response->viewData('page')['props']['report']['id'], $markdown);
    }

    public function test_admin_mendapat_detail_teknis_untuk_debugging(): void
    {
        $response = $this->actingAs($this->admin)->get('/_uji/meledak');

        $report = $response->viewData('page')['props']['report'];

        $this->assertSame(RuntimeException::class, $report['technical']['exception']);
        $this->assertStringContainsString('RuntimeException', $report['markdown']);
        $this->assertStringContainsString('SQLSTATE rahasia', $report['markdown']);
        $this->assertStringContainsString('tests/Feature/ErrorPageTest.php', $report['markdown'],
            'Lokasi berkas relatif terhadap root proyek — itu yang dibutuhkan agent untuk membuka kodenya.');
    }

    public function test_lokasi_error_database_menunjuk_kode_aplikasi_bukan_vendor(): void
    {
        $technical = $this->actingAs($this->admin)->get('/_uji/query-rusak')
            ->assertStatus(500)
            ->viewData('page')['props']['report']['technical'];

        $this->assertSame(QueryException::class, $technical['exception']);
        $this->assertStringStartsWith('tests/Feature/ErrorPageTest.php:', $technical['location'],
            'QueryException dilempar di vendor/laravel; developer perlu baris kode yang memicunya.');
    }

    public function test_id_referensi_tercatat_di_log_agar_bisa_dicari(): void
    {
        $log = storage_path('logs/uji-halaman-error.log');
        @unlink($log);
        config(['logging.default' => 'single', 'logging.channels.single.path' => $log]);

        $id = $this->actingAs($this->staff)->get('/_uji/meledak')
            ->viewData('page')['props']['report']['id'];

        $this->assertFileExists($log);
        $this->assertStringContainsString($id, file_get_contents($log));

        @unlink($log);
    }

    public function test_permintaan_json_tidak_diubah_menjadi_halaman(): void
    {
        $this->actingAs($this->staff)
            ->getJson('/halaman-yang-tidak-pernah-ada')
            ->assertNotFound()
            ->assertJsonStructure(['message']);
    }

    public function test_mode_debug_tetap_menampilkan_halaman_error_bawaan_laravel(): void
    {
        config(['app.debug' => true]);

        $response = $this->actingAs($this->staff)->get('/halaman-yang-tidak-pernah-ada');

        $response->assertNotFound()->assertHeaderMissing('X-Inertia');
        $this->assertStringNotContainsString('&quot;component&quot;:&quot;error&quot;', $response->getContent(),
            'Developer butuh halaman error Laravel lengkap saat debug — jangan ditimpa.');
    }

    public function test_tamu_tidak_ditawari_tombol_laporkan(): void
    {
        $this->get('/halaman-yang-tidak-pernah-ada')
            ->assertInertia(fn (Assert $page) => $page->where('can_report', false)->where('is_guest', true));
    }

    public function test_laporan_dari_halaman_error_tersimpan_sebagai_bug_dan_mengembalikan_json(): void
    {
        $this->actingAs($this->staff)
            ->postJson('/feedbacks', [
                'title' => 'Error 500 di /invoices',
                'description' => "## Laporan Error\n- **ID referensi**: ERR-UJI",
                'type' => 'bug',
                'priority' => 'high',
                'page_url' => '/invoices',
            ])
            ->assertCreated()
            ->assertJsonStructure(['id']);

        $this->assertSame('bug', Feedback::sole()->type);
    }
}
