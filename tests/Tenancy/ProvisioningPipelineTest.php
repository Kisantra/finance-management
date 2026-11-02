<?php

namespace Tests\Tenancy;

use App\Models\Company;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Tests\TenancyTestCase;

/**
 * Pipeline provisioning (TenantCreated -> CreateDatabase -> MigrateDatabase ->
 * SeedDatabase -> MarkCompanyActive) adalah seluruh alasan arsitektur
 * database-per-perusahaan ini bisa dipakai, dan sampai berkas ini dibuat ia
 * punya NOL cakupan test: tests/Feature/MitraGroupSeederTest.php justru
 * memasang Event::fake([TenantCreated::class]) dan
 * tests/Feature/CentralDeployMigrateCommandTest.php meng-assert database tenant
 * TIDAK ada.
 *
 * Kelas ini menjalankan pipeline SUNGGUHAN, termasuk jalur gagal + Coba Ulang.
 *
 * $transactCentral = false: CREATE/DROP DATABASE memicu implicit commit MySQL,
 * jadi transaksi pembungkus tidak bisa dipakai di sini - pembersihan manual.
 */
class ProvisioningPipelineTest extends TenancyTestCase
{
    protected bool $transactCentral = false;

    /** @var list<string> slug yang dibuat test ini dan harus dibuang */
    private array $dibuat = [];

    /** @var list<int> id user yang dibuat test ini */
    private array $penggunaDibuat = [];

    /** Satu perusahaan hasil provisioning sungguhan, dipakai dua test pertama (migrasi ~6 detik). */
    private static ?string $slugSukses = null;

    protected function tearDown(): void
    {
        foreach ($this->dibuat as $slug) {
            if ($slug !== self::$slugSukses) {
                $this->buangTenant($slug);
            }
        }

        if ($this->penggunaDibuat !== []) {
            DB::connection('mysql')->table('company_user')->whereIn('user_id', $this->penggunaDibuat)->delete();
            DB::connection('mysql')->table('model_has_roles')->whereIn('model_id', $this->penggunaDibuat)->delete();
            DB::connection('mysql')->table('users')->whereIn('id', $this->penggunaDibuat)->delete();
        }

        parent::tearDown();
    }

    public static function tearDownAfterClass(): void
    {
        self::$slugSukses = null;

        parent::tearDownAfterClass();
    }

    public function test_pipeline_membuat_database_tenant_dan_menjalankan_migrasi(): void
    {
        $company = $this->provisionSukses();

        $this->assertSame('active', $company->status, 'MarkCompanyActive tidak dijalankan - status perusahaan tidak active.');

        $this->assertTrue(
            $company->database()->manager()->databaseExists('tenant_'.$company->getTenantKey()),
            'CreateDatabase tidak membuat database tenant_'.$company->getTenantKey().'.'
        );

        $koneksi = self::connectionFor($company->getTenantKey());

        $this->assertGreaterThan(
            50,
            $koneksi->table('migrations')->count(),
            'MigrateDatabase tidak menjalankan migration tenant (tabel migrations hampir kosong).'
        );

        foreach (['invoices', 'reimbursements', 'bank_accounts'] as $tabel) {
            $this->assertTrue(
                $koneksi->getSchemaBuilder()->hasTable($tabel),
                "Tabel tenant `{$tabel}` tidak terbentuk di database hasil provisioning."
            );
        }
    }

    public function test_pipeline_menjalankan_seeder_master_data(): void
    {
        $company = $this->provisionSukses();
        $koneksi = self::connectionFor($company->getTenantKey());

        $this->assertGreaterThan(
            0,
            $koneksi->table('transaction_categories')->count(),
            'SeedDatabase tidak mengisi kategori transaksi - TenantDatabaseSeeder tidak berjalan.'
        );

        $profil = $koneksi->table('company_profiles')->first();

        $this->assertNotNull($profil, 'SeedDatabase tidak membuat CompanyProfile untuk perusahaan baru.');
        $this->assertSame($company->name, $profil->name, 'CompanyProfile hasil seeder memakai nama yang salah.');
        $this->assertSame($company->abbreviation, $profil->abbreviation);
    }

    /**
     * Jalur gagal: database tenant sudah ada lebih dulu, sehingga CreateDatabase
     * melempar. Perusahaan harus berakhir berstatus `failed`, bukan menggantung
     * di `pending` tanpa jejak.
     */
    public function test_provisioning_yang_gagal_menandai_perusahaan_failed(): void
    {
        $slug = 'prov-gagal-'.bin2hex(random_bytes(2));
        $this->dibuat[] = $slug;

        // Hadang pipeline: buat databasenya lebih dulu supaya CREATE DATABASE gagal.
        DB::connection('mysql')->statement("CREATE DATABASE `tenant_{$slug}`");

        Log::spy();

        $this->actingAs($this->adminOrganisasi())
            ->post('/c/'.$this->slug(0).'/admin/companies', [
                'slug' => $slug,
                'name' => 'Perusahaan Gagal',
                'abbreviation' => 'GAG',
            ])
            ->assertSessionHasErrors('slug');

        $this->assertSame(
            'failed',
            DB::connection('mysql')->table('companies')->where('id', $slug)->value('status'),
            'Provisioning gagal tetapi status perusahaan tidak disetel ke "failed" - tombol Coba Ulang tidak akan muncul.'
        );
    }

    public function test_coba_ulang_memprovision_ulang_perusahaan_yang_gagal(): void
    {
        $slug = 'prov-ulang-'.bin2hex(random_bytes(2));
        $this->dibuat[] = $slug;

        DB::connection('mysql')->statement("CREATE DATABASE `tenant_{$slug}`");

        $admin = $this->adminOrganisasi();

        $this->actingAs($admin)->post('/c/'.$this->slug(0).'/admin/companies', [
            'slug' => $slug,
            'name' => 'Perusahaan Coba Ulang',
            'abbreviation' => 'ULG',
        ]);

        $this->assertSame('failed', DB::connection('mysql')->table('companies')->where('id', $slug)->value('status'));

        $this->actingAs($admin)
            ->post('/c/'.$this->slug(0).'/admin/companies/'.$slug.'/retry')
            ->assertSessionHasNoErrors();

        $this->assertSame(
            'active',
            DB::connection('mysql')->table('companies')->where('id', $slug)->value('status'),
            'Coba Ulang tidak memprovision ulang perusahaan yang gagal.'
        );

        $this->assertGreaterThan(
            50,
            self::connectionFor($slug)->table('migrations')->count(),
            'Coba Ulang menandai active tanpa benar-benar menjalankan migration tenant.'
        );
    }

    // ------------------------------------------------------------------

    /** Provision sungguhan SEKALI per kelas (migrasi tenant ~6 detik). */
    private function provisionSukses(): Company
    {
        if (self::$slugSukses !== null) {
            return Company::findOrFail(self::$slugSukses);
        }

        $slug = 'prov-ok-'.bin2hex(random_bytes(2));
        self::$slugSukses = $slug;
        self::trackSlug($slug);

        $company = Company::create([
            'id' => $slug,
            'organization_id' => $this->organisasi()->id,
            'name' => 'Perusahaan Provisioning',
            'abbreviation' => 'PRV',
        ]);

        $this->endTenancy();

        return $company->refresh();
    }

    private function organisasi(): Organization
    {
        return Organization::firstOrCreate(
            ['slug' => 'tenancy-real-org'],
            ['name' => 'Tenancy Real Org', 'company_quota' => 100]
        );
    }

    private function adminOrganisasi(): User
    {
        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId(null);
        Role::firstOrCreate(['name' => 'admin'])
            ->givePermissionTo(Permission::firstOrCreate(['name' => 'manage companies']));
        setPermissionsTeamId($sebelumnya);

        $admin = User::factory()->create(['organization_id' => $this->organisasi()->id]);
        $this->penggunaDibuat[] = $admin->id;
        $admin->companies()->syncWithoutDetaching([$this->slug(0)]);
        $this->giveRole($admin, $this->slug(0), 'admin');

        return $admin;
    }

    private function buangTenant(string $slug): void
    {
        DB::connection('mysql')->statement("DROP DATABASE IF EXISTS `tenant_{$slug}`");
        DB::connection('mysql')->table('company_user')->where('company_id', $slug)->delete();
        DB::connection('mysql')->table('companies')->where('id', $slug)->delete();

        $folder = base_path('storage/tenant'.$slug);

        if (File::isDirectory($folder)) {
            File::deleteDirectory($folder);
        }
    }
}
