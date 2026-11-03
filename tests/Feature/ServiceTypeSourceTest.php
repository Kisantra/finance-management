<?php

namespace Tests\Feature;

use App\Http\Controllers\ServiceController;
use App\Http\Requests\StoreServiceRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi TEMUAN S-01: daftar tipe layanan pernah ditulis dua kali — sebagai
 * konstanta pengisi Combobox dan sebagai string literal aturan validasi. Menambah
 * satu tipe di satu sisi saja menghasilkan opsi yang muncul di layar tetapi
 * ditolak 422 saat disimpan.
 */
class ServiceTypeSourceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view services', 'create services', 'edit services', 'delete services'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin->givePermissionTo(Permission::all());
    }

    public function test_aturan_validasi_tipe_bersumber_dari_konstanta_controller(): void
    {
        $aturan = (new StoreServiceRequest)->rules()['type'];

        $daftar = collect($aturan)
            ->map(fn ($r) => is_object($r) ? (string) $r : $r)
            ->first(fn ($r) => str_starts_with((string) $r, 'in:'));

        $this->assertNotNull($daftar, 'Aturan tipe harus berupa daftar nilai yang sah.');

        foreach (ServiceController::TYPES as $tipe) {
            $this->assertStringContainsString($tipe, $daftar,
                "Tipe \"{$tipe}\" ada di Combobox tetapi tidak lolos validasi.");
        }
    }

    public function test_setiap_tipe_yang_ditawarkan_layar_benar_benar_dapat_disimpan(): void
    {
        foreach (ServiceController::TYPES as $i => $tipe) {
            $this->actingAs($this->admin)
                ->post('/services', [
                    'name' => "Layanan Uji {$i}",
                    'type' => $tipe,
                    'price' => 100_000,
                ])
                ->assertSessionHasNoErrors();
        }

        $this->assertDatabaseCount('services', count(ServiceController::TYPES));
    }

    public function test_tipe_di_luar_daftar_ditolak(): void
    {
        $this->actingAs($this->admin)
            ->post('/services', [
                'name' => 'Layanan Palsu',
                'type' => 'Tipe Karangan',
                'price' => 100_000,
            ])
            ->assertSessionHasErrors('type');

        $this->assertDatabaseCount('services', 0);
    }
}
