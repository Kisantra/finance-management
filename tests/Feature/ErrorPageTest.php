<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureUserBelongsToCompany;
use App\Http\Middleware\SetCompanyUrlDefaults;
use App\Http\Middleware\SetPermissionsTeam;
use App\Models\Feedback;
use App\Models\Invoice;
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
use Stancl\Tenancy\Middleware\InitializeTenancyByPath;
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

        // TestCase menambahkan /c/test-company ke setiap URL, jadi rute uji didaftarkan
        // di grup perusahaan dengan rantai middleware yang sama seperti routes/web.php.
        Route::middleware([
            'web', 'auth', 'verified',
            InitializeTenancyByPath::class,
            EnsureUserBelongsToCompany::class,
            SetPermissionsTeam::class,
            SetCompanyUrlDefaults::class,
        ])->prefix('c/{company}')->group(function () {
            Route::get('/_uji/meledak', function () {
                throw new RuntimeException('SQLSTATE rahasia: password=hunter2');
            });

            Route::post('/_uji/token-basi', fn () => 'tidak pernah sampai');

            Route::get('/_uji/query-rusak', fn () => DB::table('tabel_yang_tidak_pernah_ada')->get());

            Route::get('/_uji/invoice/{invoice}', fn (Invoice $invoice) => 'tidak pernah sampai');

            Route::get('/_uji/ditolak-dengan-alasan', fn () => abort(403, 'Akun Anda belum terdaftar di perusahaan mana pun. Hubungi administrator.'));

            Route::get('/_uji/ditolak-tanpa-alasan', fn () => abort(403));

            Route::get('/_uji/bocor-namespace', fn () => abort(403, 'Gagal memuat App\Models\Invoice milik tenant rahasia'));
        });
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

    public function test_error_di_dalam_perusahaan_mengarah_ke_dashboard_perusahaan_itu(): void
    {
        $props = $this->actingAs($this->staff)->get('/_uji/meledak')->viewData('page')['props'];

        $this->assertStringEndsWith('/c/'.self::TEST_COMPANY.'/dashboard', $props['home_url']);
        $this->assertStringEndsWith('/c/'.self::TEST_COMPANY.'/feedbacks', $props['report_url']);
        $this->assertContains(
            ['label' => 'Perusahaan', 'value' => self::TEST_COMPANY],
            $props['report']['fields'],
            'Tim IT perlu tahu database tenant mana yang harus diperiksa.'
        );
    }

    public function test_error_di_luar_konteks_perusahaan_mengarah_ke_pilih_perusahaan_tanpa_tombol_laporan(): void
    {
        $props = $this->actingAs($this->staff)
            ->get('/sama-sekali-tidak-ada-rutenya')
            ->assertNotFound()
            ->viewData('page')['props'];

        $this->assertSame('Pilih Perusahaan', $props['home_label']);
        $this->assertStringEndsWith('/choose-company', $props['home_url']);
        $this->assertFalse($props['can_report'],
            'Rute /feedbacks ada di dalam /c/{company}; tanpa tenancy tidak ada tujuan laporan yang sah.');
        $this->assertNull($props['report_url']);
    }

    /**
     * Route model binding (SubstituteBindings) berjalan di grup web SEBELUM
     * SetPermissionsTeam mana pun, sehingga pada 404 binding konteks tim Spatie belum
     * pernah diset. Izin lalu dicek tanpa tim dan admin kehilangan tombol laporan.
     * TestCase::setUp() memasang tim secara global, jadi di sini dikosongkan agar
     * kondisinya sama dengan server sungguhan — tanpa itu tes ini lulus palsu.
     * Ditemukan saat diuji di browser terhadap data dev.
     */
    public function test_404_binding_tetap_memeriksa_izin_di_perusahaan_yang_dibuka(): void
    {
        setPermissionsTeamId(null);

        $props = $this->actingAs($this->admin)
            ->get('/_uji/invoice/999999')
            ->assertNotFound()
            ->viewData('page')['props'];

        $this->assertTrue($props['can_report'],
            'Admin perusahaan yang sedang dibuka harus tetap bisa melapor dari halaman 404.');
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

    public function test_saklar_error_page_in_debug_menampilkan_halaman_custom_walau_debug_menyala(): void
    {
        config(['app.debug' => true, 'app.error_page_in_debug' => true]);

        $this->actingAs($this->staff)
            ->get('/halaman-yang-tidak-pernah-ada')
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page->component('error'));
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

    /**
     * Pesan yang ditulis di `abort(403, '...')` harus sampai ke pengguna.
     *
     * Ada 10+ panggilan abort berpesan khusus di aplikasi ini — semuanya kalimat
     * yang memang disusun untuk menjelaskan situasinya. Sebelum perbaikan,
     * ErrorReportService membuang semuanya dan menggantinya dengan teks tetap per
     * kode status. Yang paling merugikan ada di onboarding: pengguna baru yang
     * belum ditautkan ke perusahaan membaca "tidak memiliki izin", lalu
     * menyimpulkan akunnya rusak.
     */
    public function test_pesan_abort_khusus_ditampilkan_apa_adanya(): void
    {
        $this->actingAs($this->staff)
            ->get('/_uji/ditolak-dengan-alasan')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page
                ->component('error')
                ->where('description', 'Akun Anda belum terdaftar di perusahaan mana pun. Hubungi administrator.')
            );
    }

    /** Tanpa pesan khusus, teks tetap per kode status tetap dipakai. */
    public function test_tanpa_pesan_khusus_memakai_teks_bawaan(): void
    {
        $this->actingAs($this->staff)
            ->get('/_uji/ditolak-tanpa-alasan')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page
                ->component('error')
                ->where('description', 'Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin bila Anda merasa seharusnya bisa.')
            );
    }

    /**
     * GERBANG KEBOCORAN. Pesan yang memuat nama kelas ber-namespace tidak boleh
     * lolos ke pengguna biasa — detail teknis di kelas ini memang sengaja dibatasi
     * ke role admin saja.
     */
    public function test_pesan_yang_memuat_detail_internal_tidak_ditampilkan(): void
    {
        $this->actingAs($this->staff)
            ->get('/_uji/bocor-namespace')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page
                ->component('error')
                ->where('description', 'Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin bila Anda merasa seharusnya bisa.')
            );
    }

    /**
     * Pesan exception 5xx bisa memuat SQL beserta datanya, jadi ia TIDAK boleh
     * dipakai sebagai deskripsi — rute /_uji/meledak sengaja melempar pesan
     * "SQLSTATE rahasia: password=hunter2".
     */
    public function test_pesan_exception_5xx_tidak_pernah_jadi_deskripsi(): void
    {
        $respons = $this->actingAs($this->staff)->get('/_uji/meledak');

        $respons->assertStatus(500)
            ->assertInertia(fn (Assert $page) => $page
                ->component('error')
                ->where('description', 'Ini bukan kesalahan Anda. Tim IT dapat menelusurinya dengan ID referensi di bawah.')
            );

        $this->assertStringNotContainsString('hunter2', $respons->getContent());
    }
}
