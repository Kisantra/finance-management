<?php

namespace Tests\Feature\Settings;

use App\Models\PdfTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi BUG-SET-01, CATATAN-SET-04, CATATAN-SET-05.
 */
class SettingsHardeningTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['manage pdf templates', 'manage company profile'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->givePermissionTo(Permission::all());
    }

    /** BUG-SET-01 — /settings harus melempar ke URL yang masih ber-prefix perusahaan. */
    public function test_root_settings_melempar_ke_url_ber_prefix_perusahaan(): void
    {
        $response = $this->actingAs($this->admin)->get('/settings');

        $response->assertRedirect();
        $this->assertStringContainsString('/c/'.self::TEST_COMPANY.'/settings/profile',
            $response->headers->get('Location'),
            'Redirect harus mempertahankan prefix perusahaan, bukan menuju /settings/profile yang 404.');
    }

    /** Mengikuti redirect itu harus berakhir pada halaman yang benar-benar terbuka. */
    public function test_mengikuti_redirect_settings_berakhir_200(): void
    {
        $this->actingAs($this->admin)
            ->get('/settings')
            ->assertRedirect();

        $this->actingAs($this->admin)
            ->get('/settings/profile')
            ->assertOk();
    }

    /** CATATAN-SET-04 — berkas .ttf berisi byte acak harus ditolak. */
    public function test_font_dengan_isi_sembarang_ditolak(): void
    {
        Storage::fake('public');

        $palsu = UploadedFile::fake()->createWithContent('palsu.ttf', random_bytes(3000));

        $this->actingAs($this->admin)
            ->post('/settings/pdf-templates/custom-fonts', ['name' => 'Font Palsu', 'file' => $palsu])
            ->assertSessionHasErrors('file');

        $this->assertDatabaseCount('custom_fonts', 0);
    }

    /** Berkas yang benar-benar berawalan magic SFNT tetap diterima. */
    public function test_font_dengan_magic_sfnt_diterima(): void
    {
        Storage::fake('public');

        $isi = "\x00\x01\x00\x00".random_bytes(2000);
        $asli = UploadedFile::fake()->createWithContent('asli.ttf', $isi);

        $this->actingAs($this->admin)
            ->post('/settings/pdf-templates/custom-fonts', ['name' => 'Font Asli', 'file' => $asli])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseCount('custom_fonts', 1);
    }

    /** CATATAN-SET-05 — menghapus template default mempromosikan penggantinya. */
    public function test_hapus_template_default_mempromosikan_pengganti(): void
    {
        $a = PdfTemplate::create(['name' => 'Template A', 'layout' => [], 'is_default' => true]);
        $b = PdfTemplate::create(['name' => 'Template B', 'layout' => [], 'is_default' => false]);

        $this->actingAs($this->admin)->delete("/settings/pdf-templates/{$a->id}");

        $this->assertSame(1, PdfTemplate::where('is_default', true)->count(),
            'Selalu harus ada tepat satu template default selama masih ada template.');
        $this->assertTrue((bool) $b->fresh()->is_default);
    }
}
