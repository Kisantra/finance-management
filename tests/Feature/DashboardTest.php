<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_authenticated_users_can_visit_the_dashboard(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'view dashboard']);

        $user = User::factory()->create();
        $user->givePermissionTo('view dashboard');

        $this->actingAs($user)->get('/dashboard')->assertStatus(200);
    }

    /**
     * Pagar regresi, bukan uji fitur. Dashboard pernah menjalankan ~107 query, dan
     * sekitar separuhnya hanya untuk saldo rekening: `BankAccount::all()` dipanggil
     * tiga kali sementara accessor `balance` menjalankan tiga query agregat per
     * rekening. Ambangnya sengaja longgar — yang dijaga adalah agar jumlahnya tidak
     * lagi tumbuh seiring JUMLAH REKENING.
     */
    public function test_dashboard_tidak_menambah_query_seiring_jumlah_rekening(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'view dashboard']);

        $user = User::factory()->create();
        $user->givePermissionTo('view dashboard');

        $hitung = function (int $jumlahRekening) use ($user): int {
            BankAccount::query()->delete();
            BankAccount::factory()->count($jumlahRekening)->create(['initial_balance' => 1_000_000]);

            // Pemanasan: request pertama mengisi cache permission Spatie dan menambah
            // beberapa query yang tidak ada hubungannya dengan jumlah rekening. Tanpa ini
            // yang terukur adalah keadaan cache, bukan skala rekening.
            $this->actingAs($user)->get('/dashboard')->assertStatus(200);

            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->actingAs($user)->get('/dashboard')->assertStatus(200);
            $n = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $n;
        };

        $dengan2 = $hitung(2);
        $dengan8 = $hitung(8);

        $this->assertSame(
            $dengan2,
            $dengan8,
            "Jumlah query dashboard ikut tumbuh dengan jumlah rekening: {$dengan2} → {$dengan8}. ".
            'Ada pemanggil saldo yang belum memakai BankAccount::withBalance().'
        );
    }
}
