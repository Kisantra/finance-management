<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureUserBelongsToCompany;
use App\Http\Middleware\SetCompanyUrlDefaults;
use App\Http\Middleware\SetPermissionsTeam;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use PDOException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Middleware\InitializeTenancyByPath;
use Tests\TestCase;

/**
 * Regresi produksi 2026-11-17 (Watchpost #18): MySQL produksi di-restart systemd dan
 * butuh 42 detik untuk siap. Pratinjau invoice yang sedang berjalan gagal menulis sesi
 * ("SQLSTATE[HY000] [2002] Connection refused"), dan pengguna mendapat 500 "Terjadi
 * kesalahan di sistem". Selama database tidak bisa dihubungi, jawabannya 503 +
 * Retry-After dari halaman cadangan yang tidak butuh database.
 */
class DatabaseTidakTerjangkauTest extends TestCase
{
    use RefreshDatabase;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.debug' => false]);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $this->staff = User::factory()->create();
        $this->staff->assignRole(Role::firstOrCreate(['name' => 'staff']));

        Route::middleware([
            'web', 'auth', 'verified',
            InitializeTenancyByPath::class,
            EnsureUserBelongsToCompany::class,
            SetPermissionsTeam::class,
            SetCompanyUrlDefaults::class,
        ])->prefix('c/{company}')->group(function () {
            // Persis pesan di Watchpost #18: penulisan sesi setelah koneksi MySQL putus.
            Route::post('/_uji/sesi-gagal-ditulis', fn () => throw new QueryException(
                'mysql',
                'update `sessions` set `payload` = ? where `id` = ?',
                [],
                new PDOException('SQLSTATE[HY000] [2002] Connection refused'),
            ));

            Route::get('/_uji/server-pergi', fn () => throw new PDOException('SQLSTATE[HY000]: General error: 2006 MySQL server has gone away'));

            Route::get('/_uji/kolom-salah', fn () => throw new QueryException(
                'mysql',
                'select `tidak_ada` from `invoices`',
                [],
                new PDOException("SQLSTATE[42S22]: Column not found: 1054 Unknown column 'tidak_ada' in 'field list'"),
            ));
        });
    }

    public function test_pratinjau_saat_database_restart_mendapat_503_dari_halaman_cadangan(): void
    {
        // Header yang dikirim pratinjau invoice (fetch, bukan kunjungan Inertia).
        $this->actingAs($this->staff)
            ->post('/_uji/sesi-gagal-ditulis', [], ['Accept' => 'application/pdf', 'X-Requested-With' => 'XMLHttpRequest'])
            ->assertStatus(503)
            ->assertHeader('Retry-After', '10')
            ->assertViewIs('errors.503')
            ->assertSee('Sistem sedang tidak tersedia');
    }

    public function test_server_has_gone_away_juga_503(): void
    {
        $this->actingAs($this->staff)
            ->get('/_uji/server-pergi')
            ->assertStatus(503)
            ->assertHeader('Retry-After', '10')
            ->assertViewIs('errors.503');
    }

    public function test_permintaan_json_mendapat_pesan_503(): void
    {
        $this->actingAs($this->staff)
            ->getJson('/_uji/server-pergi')
            ->assertStatus(503)
            ->assertHeader('Retry-After', '10')
            ->assertExactJson(['message' => 'Sistem sedang dalam pemeliharaan atau sibuk. Coba lagi beberapa menit lagi.']);
    }

    public function test_tetap_dilaporkan_supaya_gangguan_database_terlihat_di_watchpost(): void
    {
        Exceptions::fake();

        $this->actingAs($this->staff)->post('/_uji/sesi-gagal-ditulis')->assertStatus(503);

        Exceptions::assertReported(fn (QueryException $e) => str_contains($e->getMessage(), 'Connection refused'));
    }

    public function test_error_query_lain_tetap_500_dengan_halaman_error_biasa(): void
    {
        $this->actingAs($this->staff)
            ->get('/_uji/kolom-salah')
            ->assertStatus(500)
            ->assertHeaderMissing('Retry-After')
            ->assertInertia(fn (Assert $page) => $page->component('error')->where('status', 500));
    }
}
