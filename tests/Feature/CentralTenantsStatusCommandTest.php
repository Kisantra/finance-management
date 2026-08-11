<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CentralTenantsStatusCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_company_and_marks_missing_tenant_database(): void
    {
        $exitCode = Artisan::call('central:tenants-status');
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('test-company', $output);
        $this->assertStringContainsString('MISSING', $output);
        $this->assertStringContainsString('DB hilang: 1', $output);
    }

    public function test_shows_failed_company_status(): void
    {
        $organization = Organization::where('slug', 'test-org')->firstOrFail();

        Company::withoutEvents(fn () => Company::create([
            'id' => 'failed-co',
            'organization_id' => $organization->id,
            'name' => 'Failed Co',
            'abbreviation' => 'FLC',
            'status' => 'failed',
        ]));

        $exitCode = Artisan::call('central:tenants-status');
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('failed-co', $output);
        $this->assertStringContainsString('failed: 1', $output);
        $this->assertStringContainsString('DB hilang: 2', $output);
    }
}
