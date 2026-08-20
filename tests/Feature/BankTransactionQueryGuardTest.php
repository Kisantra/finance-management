<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Regresi BUG-BA-02 & BUG-BA-03: parameter urut dan `per_page` tab Transaksi
 * diteruskan mentah ke query, sehingga nilai sembarang menjatuhkan endpoint ke
 * 500 lengkap dengan pesan SQL, dan `per_page=100000` menarik seluruh riwayat.
 */
class BankTransactionQueryGuardTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private BankAccount $rekening;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view bank-accounts', 'view expense', 'view income', 'create transaction'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin->givePermissionTo(Permission::all());

        $this->rekening = BankAccount::create([
            'account_name' => 'Kas Uji',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'initial_balance' => 0,
        ]);

        foreach (range(1, 30) as $i) {
            BankTransaction::create([
                'bank_account_id' => $this->rekening->id,
                'description' => "Transaksi {$i}",
                'transaction_type' => 'debit',
                'transaction_date' => now()->subDays($i),
                'amount' => 1000 * $i,
            ]);
        }
    }

    public function test_kolom_urut_sembarang_tidak_menjatuhkan_endpoint(): void
    {
        $this->actingAs($this->admin)
            ->getJson("/bank-accounts/transactions?account={$this->rekening->id}&sort=(select+1)&direction=drop")
            ->assertOk();
    }

    public function test_per_page_dijepit_ke_seratus(): void
    {
        $response = $this->actingAs($this->admin)
            ->getJson("/bank-accounts/transactions?account={$this->rekening->id}&per_page=100000");

        $response->assertOk();
        $this->assertLessThanOrEqual(100, $response->json('per_page'));
    }

    public function test_kolom_urut_yang_sah_tetap_bekerja(): void
    {
        $response = $this->actingAs($this->admin)
            ->getJson("/bank-accounts/transactions?account={$this->rekening->id}&sort=amount&direction=asc");

        $response->assertOk();
        $nilai = collect($response->json('data'))->pluck('amount')->all();
        $terurut = $nilai;
        sort($terurut);

        $this->assertSame($terurut, $nilai, 'Pengurutan menaik berdasarkan nominal harus dihormati.');
    }
}
