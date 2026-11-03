<?php

namespace Tests\Feature;

use App\Models\Company;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CentralDeployMigrateCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_succeeds_and_migrates_central_when_no_companies_exist(): void
    {
        Company::query()->delete();

        $this->artisan('central:deploy-migrate')
            ->expectsOutputToContain('central')
            ->assertExitCode(0);
    }

    public function test_reports_failed_tenant_and_nonzero_exit_when_tenant_database_is_missing(): void
    {
        $this->assertNull(
            DB::selectOne(
                'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
                ['tenant_'.self::TEST_COMPANY]
            ),
            'Prasyarat test: database tenant_test-company tidak boleh ada.'
        );

        $this->artisan('central:deploy-migrate')
            ->expectsOutputToContain(self::TEST_COMPANY)
            ->expectsOutputToContain('FAILED')
            ->assertExitCode(1);
    }
}
