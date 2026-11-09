<?php

namespace Tests\Tenancy;

use App\Models\Company;
use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Stancl\Tenancy\Events\DatabaseCreated;
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

        $kategori = $koneksi->table('transaction_categories');

        $this->assertGreaterThan(
            0,
            (clone $kategori)->count(),
            'SeedDatabase tidak mengisi kategori transaksi - TenantDatabaseSeeder tidak berjalan.'
        );

        // Perusahaan baru langsung mendapat template kategori (12 induk + 55 sub), kategori
        // sistem Utang/Piutang, dan sub transfer — tanpa kategori bawaan khas Kisantra.
        $gaji = (clone $kategori)->where('label', 'Gaji Karyawan')->first();
        $this->assertNotNull($gaji, 'Template kategori tidak ikut terpasang saat provisioning.');
        $this->assertSame('opex', $gaji->pl_group);
        $this->assertSame(6, (clone $kategori)->whereNotNull('system_key')->count());
        $this->assertTrue((clone $kategori)->where('label', 'Antar Rekening Sendiri')->whereNotNull('parent_id')->exists());
        $this->assertSame(0, (clone $kategori)->whereIn('label', ['Operational Expenses', 'HPP', 'CAPEX', 'Penghasilan'])->count());
        $this->assertSame(77, (clone $kategori)->count());

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

        // Hadang pipeline SESUDAH database dibuat percobaan ini sendiri (mis. migrasi gagal).
        // Database yang sudah ada sebelumnya kini ditolak di validasi, lihat test di bawah.
        Event::listen(DatabaseCreated::class, fn () => throw new RuntimeException('Gagal simulasi sesudah database dibuat'));

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

    /**
     * Server MySQL bisa dipakai bersama instalasi lain. Database bernama sama yang SUDAH ADA
     * dulu dibiarkan pipeline gagal, lalu Coba Ulang menghapusnya: data instalasi lain hilang.
     * Kini kode URL semacam itu ditolak sebelum apa pun dibuat, dan databasenya tidak disentuh.
     */
    public function test_kode_url_yang_databasenya_sudah_ada_ditolak_tanpa_menyentuhnya(): void
    {
        $slug = 'prov-ada-'.bin2hex(random_bytes(2));
        $this->dibuat[] = $slug;
        DB::connection('mysql')->statement("CREATE DATABASE `tenant_{$slug}`");
        DB::connection('mysql')->statement("CREATE TABLE `tenant_{$slug}`.`milik_instalasi_lain` (id INT)");

        $this->actingAs($this->adminOrganisasi())
            ->post('/c/'.$this->slug(0).'/admin/companies', [
                'slug' => $slug,
                'name' => 'Perusahaan Bertabrakan',
                'abbreviation' => 'TBR',
            ])
            ->assertSessionHasErrors('slug');

        $this->assertNull(DB::connection('mysql')->table('companies')->where('id', $slug)->first());
        $this->assertNotNull(
            DB::connection('mysql')->selectOne("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'tenant_{$slug}' AND TABLE_NAME = 'milik_instalasi_lain'"),
            'Database yang sudah ada tidak boleh dihapus atau diubah.'
        );
    }

    public function test_coba_ulang_memprovision_ulang_perusahaan_yang_gagal(): void
    {
        $slug = 'prov-ulang-'.bin2hex(random_bytes(2));
        $this->dibuat[] = $slug;

        // Gagal sekali sesudah database dibuat; Coba Ulang membuang database milik percobaan
        // itu sendiri lalu memprovision ulang.
        $gagalSekali = true;
        Event::listen(DatabaseCreated::class, function () use (&$gagalSekali): void {
            if ($gagalSekali) {
                $gagalSekali = false;

                throw new RuntimeException('Gagal simulasi sesudah database dibuat');
            }
        });

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

    /**
     * Walkthrough instalasi (/setup) yang gagal sesudah database perusahaan dibuat tidak boleh
     * meninggalkan sisa: database sisa membuat kode URL yang sama ditolak selamanya.
     */
    public function test_walkthrough_yang_gagal_membuang_sisa_percobaannya(): void
    {
        $slug = 'prov-setup-'.bin2hex(random_bytes(2));
        $this->dibuat[] = $slug;
        $email = "admin-{$slug}@uji.test";
        $tokenPath = sys_get_temp_dir().'/setup-token-'.bin2hex(random_bytes(4));
        $token = bin2hex(random_bytes(16));
        file_put_contents($tokenPath, $token);
        config(['app.setup_token_path' => $tokenPath]);
        Event::listen(DatabaseCreated::class, fn () => throw new RuntimeException('Gagal simulasi sesudah database dibuat'));

        try {
            $this->get("/setup/{$token}");
            $this->post('/setup', [
                'admin_name' => 'Admin Pertama',
                'admin_email' => $email,
                'admin_password' => 'RahasiaBaru2026!',
                'admin_password_confirmation' => 'RahasiaBaru2026!',
                'company_name' => "PT Uji {$slug}",
                'slug' => $slug,
                'abbreviation' => 'UJI',
            ])->assertSessionHas('error');

            $this->assertNull(
                DB::connection('mysql')->selectOne('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [config('tenancy.database.prefix').$slug]),
                'Database buatan percobaan yang gagal harus dibuang.'
            );
            $this->assertFalse(DB::connection('mysql')->table('companies')->where('id', $slug)->exists());
            $this->assertFalse(DB::connection('mysql')->table('users')->where('email', $email)->exists());
            $this->assertFalse(DB::connection('mysql')->table('organizations')->where('slug', "pt-uji-{$slug}")->exists());
            $this->assertFileExists($tokenPath, 'Tautan pemasangan harus tetap berlaku untuk mencoba lagi.');
        } finally {
            @unlink($tokenPath);
            DB::connection('mysql')->table('users')->where('email', $email)->delete();
            DB::connection('mysql')->table('organizations')->where('slug', "pt-uji-{$slug}")->delete();
        }
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
