<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\User;
use App\Services\InvoiceNumberService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Perusahaan wajib melengkapi profilnya (nama, singkatan, alamat, kontak, penanggung
 * jawab keuangan) sebelum dipakai. Tiap perusahaan punya singkatan sendiri untuk {PT}
 * di nomor invoice; tanpa gerbang, perusahaan baru menerbitkan dokumen dengan kode
 * kosong, '-', atau "SPI" warisan instalasi lama.
 */
class WajibProfilPerusahaanTest extends TestCase
{
    use RefreshDatabase;

    protected bool $wajibProfilPerusahaan = true;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'manage company profile']);
        Permission::firstOrCreate(['name' => 'view dashboard']);
    }

    private function admin(): User
    {
        Role::firstOrCreate(['name' => 'admin'])->givePermissionTo(['manage company profile', 'view dashboard']);
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    }

    private function staff(): User
    {
        Role::firstOrCreate(['name' => 'staff'])->syncPermissions(['view dashboard']);
        $user = User::factory()->create();
        $user->assignRole('staff');

        return $user;
    }

    /** Bentuk profil perusahaan yang baru diprovisioning (TenantDatabaseSeeder). */
    private function profilBaru(): CompanyProfile
    {
        return CompanyProfile::create([
            'name' => 'PT Baru',
            'abbreviation' => 'BRU',
            'address' => '-',
            'email' => '-',
            'phone' => '-',
            'finance_manager_name' => '-',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function isianLengkap(array $timpa = []): array
    {
        return array_merge([
            'name' => 'PT Kinara Sejahtera',
            'abbreviation' => 'KSJ',
            'address' => 'Jl. Uji No. 1, Samarinda',
            'email' => 'keuangan@kinara.test',
            'phone' => '0541-000000',
            'ppn_rate' => 11,
            'finance_manager_name' => 'Manajer Uji',
            'finance_manager_position' => 'Manajer Keuangan',
        ], $timpa);
    }

    private function formProfil(): string
    {
        return route('settings.company', ['company' => self::TEST_COMPANY]);
    }

    public function test_admin_diarahkan_ke_form_profil_bila_belum_lengkap(): void
    {
        $this->profilBaru();

        $this->actingAs($this->admin())->get('/dashboard')
            ->assertRedirect($this->formProfil())
            ->assertSessionHas('warning');
    }

    public function test_perusahaan_tanpa_baris_profil_juga_wajib_diisi(): void
    {
        $this->actingAs($this->admin())->get('/dashboard')->assertRedirect($this->formProfil());
    }

    public function test_user_tanpa_izin_melihat_halaman_belum_disiapkan(): void
    {
        $this->profilBaru();

        $this->actingAs($this->staff())->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('company-not-ready'));
    }

    public function test_form_profil_tetap_terbuka_dan_isian_sementara_tampil_kosong(): void
    {
        $this->profilBaru();

        $this->actingAs($this->admin())->get('/settings/company')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/company')
                ->where('missingFields', ['address', 'email', 'phone', 'finance_manager_name'])
                ->where('companyProfile.address', '')
                ->where('companyProfile.abbreviation', 'BRU'));
    }

    public function test_profil_lengkap_tidak_dihalangi(): void
    {
        CompanyProfile::create($this->isianLengkap(['ppn_rate' => 11]));

        $respons = $this->actingAs($this->admin())->get('/dashboard');

        $this->assertNotSame($this->formProfil(), $respons->headers->get('Location'));
    }

    public function test_permintaan_json_halaman_tidak_dihalangi(): void
    {
        $this->profilBaru();

        $respons = $this->actingAs($this->admin())->getJson('/api/transaction-categories?type=income');

        $this->assertFalse($respons->isRedirect(), 'Permintaan JSON halaman tidak boleh dialihkan ke form profil.');
    }

    public function test_melengkapi_profil_menyimpan_singkatan_dan_menyamakan_data_pusat(): void
    {
        $this->profilBaru();

        $this->actingAs($this->admin())
            ->post('/settings/company', $this->isianLengkap(['abbreviation' => ' ksj ']))
            ->assertRedirect(route('dashboard', ['company' => self::TEST_COMPANY]));

        $this->assertSame('KSJ', CompanyProfile::current()->abbreviation);
        $this->assertSame([], CompanyProfile::current()->missingFields());

        $perusahaan = Company::findOrFail(self::TEST_COMPANY);
        $this->assertSame('KSJ', $perusahaan->abbreviation, 'Pemilih perusahaan harus memakai singkatan yang sama.');
        $this->assertSame('PT Kinara Sejahtera', $perusahaan->name);
    }

    public function test_isian_sementara_dan_singkatan_tidak_sah_ditolak(): void
    {
        $this->profilBaru();

        $this->actingAs($this->admin())
            ->post('/settings/company', $this->isianLengkap(['address' => '-', 'abbreviation' => 'K1']))
            ->assertSessionHasErrors(['address', 'abbreviation']);
    }

    public function test_kode_pt_nomor_invoice_memakai_singkatan_profil(): void
    {
        CompanyProfile::create($this->isianLengkap(['name' => 'PT Kinara Sadayatra Nusantara', 'abbreviation' => 'knr']));

        $this->assertSame('KNR', app(InvoiceNumberService::class)->companyInitials());
    }

    public function test_tanpa_singkatan_kode_pt_tetap_inisial_nama(): void
    {
        CompanyProfile::create($this->isianLengkap(['name' => 'PT Kinara Sadayatra Nusantara', 'abbreviation' => null]));

        $this->assertSame('KSN', app(InvoiceNumberService::class)->companyInitials());
    }
}
