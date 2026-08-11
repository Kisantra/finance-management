<?php

namespace Tests;

use App\Models\Company;
use App\Models\Organization;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

abstract class TestCase extends BaseTestCase
{
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
        '/choose-company', '/up', '/storage',
    ];

    /**
     * Test berjalan pada SATU database (central + tenant menyatu):
     * - bootstrappers tenancy dikosongkan → InitializeTenancyByPath tetap
     *   men-set tenant() tanpa menukar koneksi/storage/queue;
     * - migration tenant dimuat ke DB test via AppServiceProvider (env testing);
     * - konteks team Spatie default = perusahaan test.
     */
    protected function setUp(): void
    {
        parent::setUp();

        config(['tenancy.bootstrappers' => []]);

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
