<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi TEMUAN-DASH-01: user tanpa `view dashboard` dulu selalu dilempar ke
 * Pengeluaran. Kombinasi permission yang sah — tanpa `view dashboard` DAN tanpa
 * `view expense` — membuatnya terkunci total setelah login berhasil: setiap
 * jalur pendaratan berakhir 403 walau ia berhak membuka modul lain.
 */
class DashboardFallbackTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'view dashboard', 'view expense', 'view income', 'view invoices',
            'view clients', 'view feedbacks', 'create feedbacks',
        ] as $name) {
            Permission::findOrCreate($name, 'web');
        }
    }

    private function userWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();
        $user->companies()->syncWithoutDetaching([self::TEST_COMPANY]);

        setPermissionsTeamId(self::TEST_COMPANY);

        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        return $user;
    }

    public function test_tanpa_view_dashboard_tapi_punya_view_expense_mendarat_di_pengeluaran(): void
    {
        $user = $this->userWithPermissions(['view expense']);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertRedirectContains('/cash-flow/expenses');
    }

    public function test_tanpa_view_expense_tetap_mendarat_di_modul_lain_yang_boleh_dibuka(): void
    {
        $user = $this->userWithPermissions(['view feedbacks', 'create feedbacks']);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertRedirectContains('/feedbacks');
    }

    public function test_prioritas_pendaratan_mengikuti_urutan_daftar(): void
    {
        $user = $this->userWithPermissions(['view feedbacks', 'view invoices']);

        // Invoice berada lebih tinggi dari Feedback pada daftar prioritas.
        $this->actingAs($user)
            ->get('/dashboard')
            ->assertRedirectContains('/invoices');
    }

    public function test_tanpa_akses_modul_apa_pun_barulah_403(): void
    {
        $user = $this->userWithPermissions([]);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertForbidden();
    }

    public function test_agregat_dashboard_dikirim_sebagai_integer(): void
    {
        $user = $this->userWithPermissions(['view dashboard']);

        $response = $this->actingAs($user)->get('/dashboard');
        $response->assertOk();

        $props = $response->viewData('page')['props'];

        foreach (['total_income', 'total_profit', 'total_outstanding', 'total_hpp', 'total_pp', 'total_balance'] as $key) {
            $this->assertIsInt($props['financialOverview'][$key], "financialOverview.{$key} harus integer");
        }

        foreach (['total_balance', 'income_this_month', 'expenses_this_month', 'net_this_month'] as $key) {
            $this->assertIsInt($props['stats'][$key], "stats.{$key} harus integer");
        }

        foreach ($props['cashFlowChart'] as $titik) {
            $this->assertIsInt($titik['income']);
            $this->assertIsInt($titik['expenses']);
        }
    }
}
