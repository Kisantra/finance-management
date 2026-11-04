<?php

namespace Tests;

use App\Models\Company;
use App\Models\Organization;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

/**
 * ==========================================================================
 * PERINGATAN: SUITE INI *TIDAK* MENGUJI MULTI-TENANCY.
 * ==========================================================================
 *
 * Selama `$realTenancy === false` (default), setUp() MENGOSONGKAN
 * `tenancy.bootstrappers`. Artinya DatabaseTenancyBootstrapper,
 * FilesystemTenancyBootstrapper, dan QueueTenancyBootstrapper TIDAK PERNAH
 * dieksekusi: seluruh test berjalan pada SATU database (central + tenant
 * menyatu), satu folder storage, dan satu konteks queue.
 *
 * Konsekuensinya, suite ini hijau TANPA membuktikan apa pun tentang:
 *   - isolasi data antar perusahaan,
 *   - pin koneksi central untuk model central,
 *   - validasi unique/exists yang melintasi database,
 *   - storage per-tenant,
 *   - pipeline provisioning (CreateDatabase → MigrateDatabase → SeedDatabase),
 *   - konteks tenant di dalam queued job.
 *
 * Hal-hal itu diuji oleh testsuite TERPISAH `TenancyReal`
 * (lihat tests/TenancyTestCase.php + tests/Tenancy/, dan phpunit.xml):
 *
 *     php artisan test --testsuite=TenancyReal
 *
 * JANGAN menambahkan test tenancy ke sini — di sini tenancy mati, jadi test
 * seperti itu akan hijau karena alasan yang salah.
 */
abstract class TestCase extends BaseTestCase
{
    /**
     * Apakah bootstrapper tenancy dibiarkan NYATA.
     *
     * false (default) = tenancy dilumpuhkan, lihat docblock kelas di atas.
     * Hanya Tests\TenancyTestCase yang menyetelnya true.
     */
    protected bool $realTenancy = false;

    /**
     * Apakah gerbang "profil perusahaan wajib lengkap" (EnsureCompanyProfileComplete) aktif.
     *
     * false (default) = dimatikan: sebagian besar test tidak membuat profil perusahaan dan
     * akan dialihkan ke form profil. Gerbangnya diuji di WajibProfilPerusahaanTest (true).
     * Di aplikasi sungguhan gerbang SELALU aktif.
     */
    protected bool $wajibProfilPerusahaan = false;

    /**
     * Slug perusahaan default untuk test. Semua request non-central otomatis
     * di-prefix /c/{slug} (lihat call()), user actingAs otomatis menjadi
     * anggota perusahaan ini (lihat actingAs()).
     */
    protected const TEST_COMPANY = 'test-company';

    /**
     * Route central yang TIDAK boleh di-prefix konteks perusahaan.
     *
     * @var list<string>
     */
    protected const CENTRAL_PATHS = [
        '/login', '/logout', '/register', '/forgot-password', '/reset-password',
        '/verify-email', '/email', '/confirm-password', '/language',
        '/choose-company', '/up',
        // Publik / lintas perusahaan — tidak pernah ber-prefix /c/{company}.
        '/panduan',
        // Walkthrough pemasangan baru (sebelum ada perusahaan).
        '/setup',
        // Rute aset vendor stancl (stancl.tenancy.asset). Dorman selama
        // tenancy.filesystem.asset_helper_tenancy = false, tetapi tetap central.
        '/tenancy',
        // Lensa grup lintas perusahaan. BELUM ADA RUTENYA — entri ini mendahului
        // fiturnya supaya /grup tidak pernah ikut ter-prefix saat dibuat nanti.
        '/grup',
        // Catatan: '/storage' TIDAK lagi central — berkas perusahaan dilayani
        // route /c/{company}/storage/{path} (lihat TenantStorageController).
    ];

    /**
     * Test berjalan pada SATU database (central + tenant menyatu) selama
     * $realTenancy === false:
     * - bootstrappers tenancy dikosongkan → InitializeTenancyByPath tetap
     *   men-set tenant() tanpa menukar koneksi/storage/queue;
     * - migration tenant dimuat ke DB test via AppServiceProvider (env testing);
     * - konteks team Spatie default = perusahaan test.
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Pelumpuhan tenancy — EKSPLISIT dan dapat dimatikan per kelas.
        // Lihat docblock kelas: tanpa bootstrapper, tenancy hanya menyetel
        // tenant() tanpa menukar koneksi/storage/queue.
        if (! $this->realTenancy) {
            config(['tenancy.bootstrappers' => []]);
        }

        config(['app.require_company_profile' => $this->wajibProfilPerusahaan]);

        if (Schema::hasTable('companies')) {
            $organization = Organization::firstOrCreate(
                ['slug' => 'test-org'],
                ['name' => 'Test Org', 'company_quota' => 100]
            );

            Company::withoutEvents(fn () => Company::firstOrCreate(
                ['id' => self::TEST_COMPANY],
                [
                    'organization_id' => $organization->id,
                    'name' => 'Test Company',
                    'abbreviation' => 'TST',
                    'status' => 'active',
                ]
            ));
        }

        setPermissionsTeamId(self::TEST_COMPANY);
    }

    /**
     * User yang login di test otomatis menjadi anggota perusahaan test —
     * tanpa ini setiap request akan 403 di EnsureUserBelongsToCompany.
     * Test isolasi yang butuh user non-anggota harus melepas keanggotaan
     * secara eksplisit setelah memanggil actingAs().
     */
    public function actingAs(Authenticatable $user, $guard = null)
    {
        if (method_exists($user, 'companies') && Schema::hasTable('company_user')) {
            $user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        }

        return parent::actingAs($user, $guard);
    }

    /**
     * Auto-prefix URI aplikasi dengan /c/{company} supaya 40+ file test
     * existing tidak perlu mengubah semua string URL-nya satu per satu.
     * URI central (login dll.) dan URI yang sudah ber-prefix /c/ dibiarkan.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        return parent::call($method, $this->prefixCompanyUri($uri), $parameters, $cookies, $files, $server, $content);
    }

    protected function prefixCompanyUri(string $uri): string
    {
        if (! str_starts_with($uri, '/') || $uri === '/' || str_starts_with($uri, '/c/')) {
            return $uri;
        }

        foreach (self::CENTRAL_PATHS as $central) {
            if ($uri === $central || str_starts_with($uri, $central.'/')) {
                return $uri;
            }
        }

        return '/c/'.self::TEST_COMPANY.$uri;
    }
}
