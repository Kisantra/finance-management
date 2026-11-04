<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Events\MigrationsStarted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

/**
 * deploy.sh versi lama di server satu-database menarik rilis multi-perusahaan
 * lalu memanggil `migrate`: tanpa pengaman, tabel pusat menumpuk di database
 * lama dan setiap user 403. Saran `migrate:rollback` yang dicetaknya sama
 * berbahayanya: menjalankan down() migration lama yang sah.
 */
class PengamanMigrateDatabaseLamaTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Database test berisi tabel tenant + pusat; tabel `companies` disamarkan
     * supaya bentuknya sama dengan database deployment lama.
     */
    private function samarkanSebagaiDatabaseLama(): void
    {
        Schema::shouldReceive('hasTable')->andReturnUsing(fn (string $tabel): bool => $tabel !== 'companies');
    }

    public function test_migrate_ditolak_di_database_lama(): void
    {
        User::factory()->create();
        $this->samarkanSebagaiDatabaseLama();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Migration DIHENTIKAN sebelum menyentuh apa pun');

        event(new MigrationsStarted('up'));
    }

    public function test_rollback_juga_ditolak_di_database_lama(): void
    {
        User::factory()->create();
        $this->samarkanSebagaiDatabaseLama();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Rollback juga ditolak');

        event(new MigrationsStarted('down'));
    }

    public function test_database_pusat_lolos(): void
    {
        User::factory()->create();

        event(new MigrationsStarted('up'));

        $this->assertTrue(Schema::hasTable('companies'));
    }

    public function test_database_baru_tanpa_user_lolos(): void
    {
        $this->samarkanSebagaiDatabaseLama();

        event(new MigrationsStarted('up'));

        $this->assertSame(0, User::count(), 'Instalasi/test baru: migration tenant ikut dimuat tetapi users masih kosong.');
    }
}
