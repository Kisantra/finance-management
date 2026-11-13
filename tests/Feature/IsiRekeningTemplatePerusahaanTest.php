<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Organization;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Migration 2026_11_12_224348: rekening & kota yang dulu tertulis di template SLU/BAS dipindahkan ke
 * Profil perusahaan saat deploy, hanya bila isian profil masih kosong, dan hanya untuk kedua perusahaan itu.
 */
class IsiRekeningTemplatePerusahaanTest extends TestCase
{
    use RefreshDatabase;

    public function test_mengisi_rekening_dan_kota_slu_yang_masih_kosong(): void
    {
        CompanyProfile::factory()->create(['bank_accounts' => null, 'signature_city' => null]);

        $this->runFor('samboja-laju-utama');

        $profile = CompanyProfile::current();
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertEquals([['bank' => 'Bank Mandiri', 'account_number' => '148-00-2346343-6', 'account_name' => 'PT. SAMBOJA LAJU UTAMA']], $profile->bank_accounts);
    }

    public function test_tidak_menimpa_isian_yang_sudah_ada(): void
    {
        $rekening = [['bank' => 'BCA', 'account_number' => '999', 'account_name' => 'PT. BAS']];
        CompanyProfile::factory()->create(['bank_accounts' => $rekening, 'signature_city' => 'Balikpapan']);

        $this->runFor('berkah-andalan-samboja');

        $profile = CompanyProfile::current();
        $this->assertSame('Balikpapan', $profile->signature_city);
        $this->assertEquals($rekening, $profile->bank_accounts);
    }

    public function test_perusahaan_lain_dan_tanpa_profil_tidak_tersentuh(): void
    {
        $this->runFor('berkah-andalan-samboja');
        $this->assertNull(CompanyProfile::current());

        CompanyProfile::factory()->create(['bank_accounts' => null, 'signature_city' => null]);
        $this->runFor(self::TEST_COMPANY);

        $profile = CompanyProfile::current();
        $this->assertNull($profile->signature_city);
        $this->assertNull($profile->bank_accounts);
    }

    private function runFor(string $slug): void
    {
        $company = Company::withoutEvents(fn () => Company::firstOrCreate(['id' => $slug], [
            'organization_id' => Organization::firstOrFail()->id,
            'name' => $slug,
            'abbreviation' => 'UJI',
            'status' => 'active',
        ]));

        /** @var Migration $migration */
        $migration = require database_path('migrations/tenant/2026_11_12_224348_isi_rekening_dan_kota_template_perusahaan.php');

        tenancy()->initialize($company);

        try {
            $migration->up();
        } finally {
            tenancy()->end();
        }
    }
}
