<?php

namespace Tests\Tenancy;

use Illuminate\Database\Eloquent\Model;
use ReflectionClass;
use SplFileInfo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;
use Symfony\Component\Finder\Finder;
use Tests\TenancyTestCase;

/**
 * DatabaseTenancyBootstrapper menukar koneksi DEFAULT ke database tenant.
 * Model yang datanya hidup di database central karena itu WAJIB memakai trait
 * CentralConnection. Model central baru yang lupa trait itu tidak pernah gagal
 * di suite Unit/Feature (di sana tenancy dilumpuhkan, satu database saja) -
 * ia hanya gagal di produksi, saat query mencari tabel central di dalam
 * database tenant.
 *
 * Test di berkas ini memindai app/Models secara table-driven, jadi model
 * central yang ditambahkan nanti ikut terjaga tanpa mengubah test.
 */
class PinKoneksiCentralTest extends TenancyTestCase
{
    /**
     * Tabel yang HANYA ada di database central (migration-nya di
     * database/migrations, bukan database/migrations/tenant).
     *
     * @var list<string>
     */
    private const CENTRAL_TABLES = [
        'users', 'roles', 'permissions', 'organizations', 'companies',
        'company_user', 'app_notifications', 'feedbacks',
        'model_has_roles', 'model_has_permissions', 'role_has_permissions',
        'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs',
        'password_reset_tokens',
    ];

    public function test_setiap_model_bertabel_central_terpin_ke_koneksi_central(): void
    {
        $this->useTenant(0);

        $central = config('tenancy.database.central_connection');

        $this->assertSame('tenant', config('database.default'), 'Tenancy tidak aktif - test ini tidak menguji apa pun.');

        $diperiksa = [];

        foreach ($this->modelClasses() as $class) {
            /** @var Model $model */
            $model = new $class;

            if (! in_array($model->getTable(), self::CENTRAL_TABLES, true)) {
                continue;
            }

            $diperiksa[] = $class;

            $this->assertSame(
                $central,
                $model->getConnectionName(),
                $class.' bertabel central ('.$model->getTable().') tetapi koneksinya "'
                .($model->getConnectionName() ?? 'null (default = tenant saat tenancy aktif)')
                .'". Tambahkan trait '.CentralConnection::class.'.'
            );
        }

        $this->assertNotEmpty($diperiksa, 'Tidak satu pun model central terdeteksi - pemindai rusak, bukan kode aplikasinya.');
    }

    /**
     * Session, cache, dan queue bertabel central. Driver `database` membaca
     * koneksinya dari config, BUKAN dari koneksi default - tanpa pin eksplisit
     * mereka akan mencari tabel `sessions`/`cache`/`jobs` di dalam database
     * tenant yang sedang aktif.
     *
     * `session.connection` diperiksa pada BERKAS CONFIG-nya, bukan nilai runtime:
     * nilai runtime dapat ditimpa `SESSION_CONNECTION` di .env masing-masing
     * mesin (di mesin pengembangan ini .env memang menimpanya menjadi "default",
     * yang dorman karena SESSION_DRIVER=redis). Yang menjadi tanggung jawab
     * repository adalah fallback di config/session.php.
     */
    public function test_session_cache_dan_queue_memakai_koneksi_central(): void
    {
        $this->useTenant(0);

        $central = config('tenancy.database.central_connection');

        $runtime = [
            'cache.stores.database.connection' => config('cache.stores.database.connection'),
            'queue.connections.database.connection' => config('queue.connections.database.connection'),
        ];

        foreach ($runtime as $kunci => $nilai) {
            $this->assertSame(
                $central,
                $nilai,
                "{$kunci} = \"".($nilai ?? 'null').'" - driver database akan mencari tabelnya di dalam database TENANT.'
            );
        }

        $this->assertMatchesRegularExpression(
            "/'connection'\s*=>\s*env\('SESSION_CONNECTION',.*'{$central}'/",
            (string) file_get_contents(config_path('session.php')),
            "config/session.php tidak lagi memakai '{$central}' sebagai fallback koneksi session - "
            .'driver session `database` akan menulis tabel `sessions` ke database tenant.'
        );
    }

    /**
     * @return list<class-string<Model>>
     */
    private function modelClasses(): array
    {
        $kelas = [];

        /** @var SplFileInfo $file */
        foreach (Finder::create()->files()->in(app_path('Models'))->name('*.php') as $file) {
            $class = 'App\\Models\\'.$file->getBasename('.php');

            if (! class_exists($class)) {
                continue;
            }

            $reflection = new ReflectionClass($class);

            if ($reflection->isAbstract() || ! $reflection->isSubclassOf(Model::class)) {
                continue;
            }

            $kelas[] = $class;
        }

        return $kelas;
    }
}
