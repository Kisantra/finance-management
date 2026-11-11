<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use Database\Seeders\CompanyProfileSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyProfileSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_melengkapi_profil_hasil_provisioning_tanpa_menambah_baris(): void
    {
        $provisioning = CompanyProfile::create([
            'name' => 'Kisantra',
            'abbreviation' => 'KSN',
            'address' => '-',
            'email' => '-',
            'phone' => '-',
            'finance_manager_name' => '-',
        ]);

        $this->seed(CompanyProfileSeeder::class);

        $this->assertSame(1, CompanyProfile::count());
        $profil = CompanyProfile::current();
        $this->assertTrue($profil->is($provisioning));
        $this->assertSame([], $profil->missingFields());
        $this->assertSame('KSN', $profil->abbreviation);
    }

    public function test_membuat_profil_lengkap_bila_belum_ada(): void
    {
        $this->seed(CompanyProfileSeeder::class);

        $this->assertSame(1, CompanyProfile::count());
        $this->assertSame([], CompanyProfile::current()->missingFields());
    }
}
