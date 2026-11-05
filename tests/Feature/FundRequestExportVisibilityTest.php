<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\FundRequestExportService;
use Barryvdh\DomPDF\PDF;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Ekspor PDF pengajuan dana wajib mengikuti aturan halaman daftar: tanpa izin menyetujui,
 * hanya pengajuan sendiri. Sebelumnya rute ekspor hanya memeriksa `view fund requests`
 * (dimiliki staf) dan menerima user_id dari URL, sehingga staf bisa mengekspor milik semua
 * orang.
 */
class FundRequestExportVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function userWithPermissions(array $permissions): User
    {
        foreach ($permissions as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $user = User::factory()->create();
        $user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $user->givePermissionTo($permissions);

        return $user;
    }

    /** Ekspektasi: generate() dipanggil sekali dengan user_id = $harapan. */
    private function harapkanFilterUser(?int $harapan): void
    {
        $pdf = $this->mock(PDF::class, fn (MockInterface $mock) => $mock->shouldReceive('output')->andReturn('%PDF-uji'));

        $this->mock(FundRequestExportService::class, fn (MockInterface $mock) => $mock
            ->shouldReceive('generate')
            ->once()
            ->withArgs(fn (array $filters) => $filters['user_id'] === $harapan)
            ->andReturn($pdf));
    }

    public function test_staf_hanya_mengekspor_pengajuannya_sendiri_walau_url_meminta_milik_orang_lain(): void
    {
        $staf = $this->userWithPermissions(['view fund requests']);
        $lain = User::factory()->create();

        $this->harapkanFilterUser($staf->id);
        $this->actingAs($staf)->get('/fund-requests/export/pdf?show_requestor=1&user_id='.$lain->id)->assertOk();

        $this->harapkanFilterUser($staf->id);
        $this->actingAs($staf)->get('/fund-requests/export/pdf/preview?show_requestor=1')->assertOk();
    }

    public function test_penyetuju_tetap_bisa_mengekspor_semua_atau_memilih_orang(): void
    {
        $penyetuju = $this->userWithPermissions(['view fund requests', 'approve fund requests']);
        $lain = User::factory()->create();

        $this->harapkanFilterUser(null);
        $this->actingAs($penyetuju)->get('/fund-requests/export/pdf/preview')->assertOk();

        $this->harapkanFilterUser($lain->id);
        $this->actingAs($penyetuju)->get('/fund-requests/export/pdf?user_id='.$lain->id)->assertOk();
    }
}
