<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Kontrak yang diandalkan halaman Rekening Bank: `?account={id}` memilih
 * rekening itu, dan `?month=` menyaring periodenya.
 *
 * Bug yang ditemukan pengguna (2026-08-20) ada di sisi frontend — `query`
 * dikirim sebagai parameter route alih-alih options, sehingga query string tak
 * pernah terbentuk dan halaman selalu kembali ke rekening pertama. Tes ini
 * menjaga sisi server: kalau kontraknya sendiri pecah, penyebabnya jadi jelas
 * bukan di frontend.
 */
class BankAccountSelectionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view bank-accounts', 'create bank-accounts', 'edit bank-accounts', 'delete bank-accounts'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        $this->admin->givePermissionTo(Permission::all());
    }

    private function rekening(string $nama, int $saldo): BankAccount
    {
        return BankAccount::create([
            'account_name' => $nama,
            'bank_name' => 'Bank Uji',
            'account_number' => (string) random_int(1000, 9999),
            'initial_balance' => $saldo,
        ]);
    }

    public function test_parameter_account_memilih_rekening_yang_diminta(): void
    {
        $pertama = $this->rekening('Rekening Pertama', 1_000_000);
        $kedua = $this->rekening('Rekening Kedua', 2_000_000);

        $response = $this->actingAs($this->admin)->get("/bank-accounts?account={$kedua->id}");
        $response->assertOk();

        $props = $response->viewData('page')['props'];

        $this->assertSame($kedua->id, $props['filters']['account'],
            'Rekening yang dipilih harus mengikuti parameter, bukan kembali ke yang pertama.');
        $this->assertNotSame($pertama->id, $props['filters']['account']);
    }

    public function test_tanpa_parameter_account_memakai_rekening_pertama(): void
    {
        $pertama = $this->rekening('Rekening Pertama', 1_000_000);
        $this->rekening('Rekening Kedua', 2_000_000);

        $response = $this->actingAs($this->admin)->get('/bank-accounts');
        $response->assertOk();

        $this->assertSame($pertama->id, $response->viewData('page')['props']['filters']['account']);
    }

    public function test_parameter_month_ikut_terbaca(): void
    {
        $rekening = $this->rekening('Rekening Pertama', 1_000_000);

        $response = $this->actingAs($this->admin)
            ->get("/bank-accounts?account={$rekening->id}&month=2026-07");

        $response->assertOk();
        $this->assertSame('2026-07', $response->viewData('page')['props']['filters']['month']);
    }
}
