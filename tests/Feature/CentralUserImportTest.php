<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use App\Services\CentralUserImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Regresi cutover 2026-08-21: `central:import-users` berhenti dengan
 * RoleDoesNotExist saat database lama memuat role yang tidak ada di sistem baru
 * (`staff_test`, `admin_t`, sisa eksperimen). Impor mati di tengah jalan dengan
 * sebagian user sudah masuk dan sebagian belum — ditemukan saat latihan migrasi
 * memakai data produksi sungguhan, bukan data buatan.
 */
class CentralUserImportTest extends TestCase
{
    use RefreshDatabase;

    private Organization $organization;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        Role::findOrCreate('admin', 'web');
        Role::findOrCreate('staff', 'web');

        $this->organization = Organization::firstOrCreate(
            ['slug' => 'org-uji'],
            ['name' => 'Organisasi Uji', 'company_quota' => 5]
        );

        $this->company = Company::findOrFail(self::TEST_COMPANY);
    }

    /**
     * @return array<string, mixed>
     */
    private function baris(string $email, ?string $role): array
    {
        return [
            'name' => 'Pengguna '.$email,
            'email' => $email,
            // Hash dibuat lewat Hash::make agar mengikuti BCRYPT_ROUNDS lingkungan
            // uji. Hash ber-cost lebih tinggi dari konfigurasi akan DITOLAK Laravel —
            // jebakan nyata saat cutover, lihat catatan di runbook.
            'password' => Hash::make('SandiLamaProduksi'),
            'role' => $role,
        ];
    }

    public function test_role_tak_dikenal_tidak_menghentikan_impor(): void
    {
        $rows = [
            $this->baris('satu@qa.test', 'admin'),
            $this->baris('dua@qa.test', 'staff_test'),   // tidak ada di sistem baru
            $this->baris('tiga@qa.test', 'staff'),
            $this->baris('empat@qa.test', 'admin_t'),    // tidak ada di sistem baru
        ];

        $hasil = (new CentralUserImportService)->import($rows, $this->organization, $this->company);

        $this->assertSame(4, $hasil['imported'],
            'Keempat user harus tetap terimpor meski dua role-nya tidak dikenal.');

        $this->assertArrayHasKey('staff_test', $hasil['roles_skipped']);
        $this->assertArrayHasKey('admin_t', $hasil['roles_skipped']);
        $this->assertSame(['dua@qa.test'], $hasil['roles_skipped']['staff_test'],
            'Laporan harus menyebut email yang terdampak, bukan sekadar jumlah.');
    }

    public function test_role_yang_dikenal_tetap_diberikan(): void
    {
        (new CentralUserImportService)->import(
            [$this->baris('satu@qa.test', 'admin')],
            $this->organization,
            $this->company
        );

        setPermissionsTeamId($this->company->getTenantKey());
        $user = User::where('email', 'satu@qa.test')->firstOrFail();

        $this->assertTrue($user->hasRole('admin'));
    }

    public function test_hash_sandi_lama_dipertahankan_apa_adanya(): void
    {
        $hash = Hash::make('SandiLamaProduksi');

        (new CentralUserImportService)->import(
            [['name' => 'Lama', 'email' => 'lama@qa.test', 'password' => $hash, 'role' => 'admin']],
            $this->organization,
            $this->company
        );

        $this->assertSame($hash, User::where('email', 'lama@qa.test')->value('password'),
            'Hash lama wajib utuh — pengguna harus tetap bisa login dengan sandi yang sama.');
    }

    public function test_dijalankan_ulang_tidak_menduplikasi(): void
    {
        $rows = [$this->baris('satu@qa.test', 'admin'), $this->baris('dua@qa.test', 'staff')];
        $service = new CentralUserImportService;

        $service->import($rows, $this->organization, $this->company);
        $kedua = $service->import($rows, $this->organization, $this->company);

        $this->assertSame(0, $kedua['imported']);
        $this->assertSame(2, $kedua['existing']);
        $this->assertSame(2, User::whereIn('email', ['satu@qa.test', 'dua@qa.test'])->count());
    }
}
