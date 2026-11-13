<?php

namespace Tests\Feature\Settings;

use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Rekening tujuan transfer (`bank_accounts`) dan kota tanda tangan di Profil perusahaan. Keduanya
 * tercetak di invoice; template invoice per perusahaan membaca data perusahaan dari sini, bukan dari
 * kode, sehingga admin bisa mengubahnya tanpa deploy.
 */
class CompanyProfileRekeningTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'manage company profile']);
        Role::firstOrCreate(['name' => 'admin'])->givePermissionTo('manage company profile');

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_rekening_dan_kota_tersimpan_dan_dikirim_ke_halaman(): void
    {
        $this->actingAs($this->admin)->post('/settings/company', [
            ...$this->payload(),
            'signature_city' => '  Samarinda ',
            'bank_accounts' => [
                ['bank' => 'Bank Mandiri', 'account_number' => '148-00-23719878', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA'],
                ['bank' => ' BCA ', 'account_number' => '1234567890', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA'],
            ],
        ])->assertRedirect()->assertSessionHasNoErrors();

        // Kolom JSON MySQL menyusun ulang kunci tiap objek; urutan rekening tetap.
        $profile = CompanyProfile::current();
        $this->assertSame('Samarinda', $profile->signature_city);
        $this->assertEquals([
            ['bank' => 'Bank Mandiri', 'account_number' => '148-00-23719878', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA'],
            ['bank' => 'BCA', 'account_number' => '1234567890', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA'],
        ], $profile->bank_accounts);

        $this->actingAs($this->admin)->get('/settings/company')
            ->assertInertia(fn ($page) => $page
                ->where('companyProfile.signature_city', 'Samarinda')
                ->where('companyProfile.bank_accounts.1.bank', 'BCA'));
    }

    public function test_baris_rekening_kosong_diabaikan_dan_semua_rekening_bisa_dihapus(): void
    {
        $this->actingAs($this->admin)->post('/settings/company', [
            ...$this->payload(),
            'bank_accounts' => [
                ['bank' => '', 'account_number' => ' ', 'account_name' => ''],
                ['bank' => 'Bank Mandiri', 'account_number' => '148-00-23719878', 'account_name' => 'PT. CONTOH'],
            ],
        ])->assertSessionHasNoErrors();

        $this->assertCount(1, CompanyProfile::current()->bank_accounts);

        // Form tanpa baris rekening (FormData tidak mengirim larik kosong) = semua rekening dihapus.
        $this->actingAs($this->admin)->post('/settings/company', $this->payload())->assertSessionHasNoErrors();

        $profile = CompanyProfile::current();
        $this->assertNull($profile->bank_accounts);
        $this->assertNull($profile->signature_city);
    }

    public function test_baris_rekening_wajib_lengkap_dan_dibatasi_lima(): void
    {
        $this->actingAs($this->admin)->post('/settings/company', [
            ...$this->payload(),
            'bank_accounts' => [
                ['bank' => 'Bank Mandiri', 'account_number' => '', 'account_name' => 'PT. CONTOH'],
            ],
        ])->assertSessionHasErrors(['bank_accounts.0.account_number' => __('Nomor rekening :position wajib diisi.', ['position' => 1])]);

        $this->actingAs($this->admin)->post('/settings/company', [
            ...$this->payload(),
            'bank_accounts' => array_fill(0, 6, ['bank' => 'BCA', 'account_number' => '1', 'account_name' => 'PT. CONTOH']),
        ])->assertSessionHasErrors('bank_accounts');

        $this->actingAs($this->admin)->post('/settings/company', [
            ...$this->payload(),
            'signature_city' => str_repeat('a', 101),
        ])->assertSessionHasErrors('signature_city');
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'name' => 'PT. BERKAH ANDALAN SAMBOJA',
            'abbreviation' => 'BAS',
            'address' => "JL. BPPN-HANDIL II RT.003 RW.000\nTELUK PEMEDAS, SAMBOJA",
            'email' => 'bas@example.com',
            'phone' => '0811-5513-232',
            'ppn_rate' => 11,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur Utama',
        ];
    }
}
