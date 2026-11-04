<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sesudah server lama dikonversi, semua halaman berawalan /c/{perusahaan}. Bookmark dari masa
 * satu-perusahaan (/invoices, /dashboard) diarahkan ke perusahaan pengguna, bukan 404.
 * URL ditulis lengkap (http://localhost/...) supaya TestCase::call() tidak memberinya prefix.
 */
class TautanLamaTest extends TestCase
{
    use RefreshDatabase;

    public function test_bookmark_lama_diarahkan_ke_perusahaan_pengguna_beserta_query(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('http://localhost/invoices?status=paid')
            ->assertRedirect('/c/'.self::TEST_COMPANY.'/invoices?status=paid');
    }

    public function test_tamu_diminta_login_lalu_kembali_ke_alamat_lama(): void
    {
        $this->get('http://localhost/reimbursements/5')->assertRedirect('/login');
        $this->assertSame('http://localhost/reimbursements/5', session('url.intended'));
    }

    public function test_anggota_beberapa_perusahaan_diarahkan_ke_pemilih_perusahaan(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $lain = Company::withoutEvents(fn () => Company::create([
            'id' => 'perusahaan-lain',
            'organization_id' => Company::findOrFail(self::TEST_COMPANY)->organization_id,
            'name' => 'Perusahaan Lain',
            'abbreviation' => 'LAIN',
            'status' => 'active',
        ]));
        $user->companies()->syncWithoutDetaching([$lain->getTenantKey()]);

        $this->get('http://localhost/dashboard')->assertRedirect('/choose-company');
    }

    public function test_alamat_yang_bukan_modul_aplikasi_tetap_404(): void
    {
        $this->actingAs(User::factory()->create());

        $this->get('http://localhost/wp-admin')->assertNotFound();
        $this->get('/c/'.self::TEST_COMPANY.'/tidak-ada')->assertNotFound();
    }
}
