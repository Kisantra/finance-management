<?php

namespace Tests;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Connection;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use PDO;
use RuntimeException;
use Spatie\Permission\PermissionRegistrar;
use Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper;
use Stancl\Tenancy\Bootstrappers\FilesystemTenancyBootstrapper;
use Stancl\Tenancy\Bootstrappers\QueueTenancyBootstrapper;
use Throwable;

/**
 * ==========================================================================
 * Harness untuk testsuite `TenancyReal` - tenancy SUNGGUHAN.
 * ==========================================================================
 *
 * Jalankan dengan:
 *
 *     php artisan test --testsuite=TenancyReal
 *
 * Berbeda dari Tests\TestCase (yang mengosongkan `tenancy.bootstrappers`),
 * kelas ini membiarkan DatabaseTenancyBootstrapper, FilesystemTenancyBootstrapper,
 * dan QueueTenancyBootstrapper BERJALAN, dan menyediakan database tenant NYATA.
 *
 * Cara kerja:
 *
 * 1. Kolam tenant (pool) berisi {@see self::POOL_SIZE} database tenant nyata
 *    `tenant_test_<acak>_{a,b,c}` dibuat + `tenants:migrate` SEKALI PER PROSES
 *    PHPUnit, lalu dipakai ulang semua kelas. Ini penyimpangan sengaja dari
 *    rancangan "satu database per kelas": `tenants:migrate` terukur 6,1 detik
 *    per database di mesin ini (52 migration tenant), bukan 0,6 detik seperti
 *    catatan docs/multi-tenancy-progress.md - per kelas berarti 60+ detik
 *    hanya untuk migrasi.
 * 2. Database tenant dibuang di akhir proses (`register_shutdown_function`)
 *    lewat PDO langsung, supaya tetap bersih walau PHPUnit mati di tengah.
 * 3. Koneksi CENTRAL dibungkus transaksi (`$connectionsToTransact = ['mysql']`).
 *    Koneksi `tenant` TIDAK bisa ditransaksikan: DatabaseManager::connectToTenant()
 *    melakukan `purge('tenant')` setiap kali tenant berganti, sehingga transaksi
 *    apa pun di koneksi itu langsung hilang pada switch pertama. Data tenant
 *    dibersihkan per test oleh {@see self::wipePool()}.
 *
 * Kelas yang menjalankan DDL pada koneksi central (CREATE/DROP DATABASE -
 * mis. test pipeline provisioning) WAJIB menyetel `$transactCentral = false`:
 * DDL MySQL memicu implicit commit yang merusak transaksi pembungkus.
 */
abstract class TenancyTestCase extends TestCase
{
    use DatabaseTransactions;

    /** Bootstrapper tenancy TIDAK dikosongkan di suite ini. */
    protected bool $realTenancy = true;

    /**
     * Hanya koneksi central yang ditransaksikan - lihat docblock kelas.
     *
     * @var list<string>
     */
    protected $connectionsToTransact = ['mysql'];

    /** Setel false pada kelas yang menjalankan DDL (CREATE/DROP DATABASE) di koneksi central. */
    protected bool $transactCentral = true;

    /** Jumlah database tenant yang dipakai bersama seluruh suite. */
    protected const POOL_SIZE = 3;

    /**
     * Tabel tenant yang dibersihkan setelah tiap test. Bukan seluruh tabel:
     * TRUNCATE 35 tabel x 3 database x 29 test menambah detik, sementara
     * suite ini hanya menulis ke tabel di bawah.
     *
     * @var list<string>
     */
    protected const WIPE_TABLES = [
        'invoice_items', 'payments', 'invoices', 'clients',
        'bank_transactions', 'bank_accounts',
        'reimbursement_payments', 'reimbursements',
        'transaction_categories', 'company_profiles', 'services',
    ];

    /** @var list<string> slug tenant pool (urut: a, b, c) */
    private static array $pool = [];

    /** @var list<string> slug tambahan (mis. hasil provisioning test) yang ikut dibuang di akhir proses */
    private static array $extraSlugs = [];

    /** @var array<string, mixed>|null konfigurasi koneksi central, disimpan untuk shutdown handler */
    private static ?array $centralConfig = null;

    private static bool $shutdownRegistered = false;

    /**
     * Pool dibuat SEBELUM transaksi central dibuka: pembuatan database tenant
     * menjalankan `CREATE DATABASE` di koneksi central, dan DDL MySQL memicu
     * implicit commit yang akan merusak transaksi pembungkus test pertama.
     */
    protected function setUpTraits()
    {
        $this->assertTenancyEnforced();
        self::bootPool();

        return parent::setUpTraits();
    }

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }

        self::wipePool();

        parent::tearDown();
    }

    /**
     * {@see DatabaseTransactions::beginDatabaseTransaction()} dipanggil lewat
     * setUpTraits; kelas yang menjalankan DDL central menonaktifkannya di sini.
     *
     * @return list<string>
     */
    protected function connectionsToTransact()
    {
        return $this->transactCentral ? $this->connectionsToTransact : [];
    }

    // ------------------------------------------------------------------
    // Gerbang penegakan
    // ------------------------------------------------------------------

    /**
     * Gerbang yang membuat pelumpuhan satu-baris (`config(['tenancy.bootstrappers' => []])`)
     * mustahil lolos tanpa terlihat. Lihat Tests\Tenancy\KontrolPositifHarnessTest.
     *
     * @throws RuntimeException
     */
    protected function assertTenancyEnforced(): void
    {
        if (! $this->realTenancy) {
            throw new RuntimeException(
                static::class.' berada di testsuite TenancyReal tetapi $realTenancy = false - '
                .'tenancy akan dilumpuhkan dan seluruh test di kelas ini hijau tanpa arti.'
            );
        }

        $wajib = [
            DatabaseTenancyBootstrapper::class,
            FilesystemTenancyBootstrapper::class,
            QueueTenancyBootstrapper::class,
        ];

        $hilang = array_diff($wajib, (array) config('tenancy.bootstrappers', []));

        if ($hilang !== []) {
            throw new RuntimeException(
                'Bootstrapper tenancy hilang dari config: '.implode(', ', $hilang)
                .' - suite TenancyReal tidak boleh berjalan dengan tenancy dilumpuhkan.'
            );
        }
    }

    // ------------------------------------------------------------------
    // Pool tenant
    // ------------------------------------------------------------------

    private static function bootPool(): void
    {
        if (self::$pool !== []) {
            return;
        }

        self::$centralConfig = config('database.connections.'.config('tenancy.database.central_connection'));

        $organization = Organization::firstOrCreate(
            ['slug' => 'tenancy-real-org'],
            ['name' => 'Tenancy Real Org', 'company_quota' => 100]
        );

        $run = bin2hex(random_bytes(3));

        foreach (array_slice(['a', 'b', 'c'], 0, self::POOL_SIZE) as $huruf) {
            $slug = "test_{$run}_{$huruf}";

            $company = Company::withoutEvents(fn () => Company::create([
                'id' => $slug,
                'organization_id' => $organization->id,
                'name' => 'Tenant '.strtoupper($huruf),
                'abbreviation' => 'T'.strtoupper($huruf),
                'status' => 'active',
            ]));

            self::$pool[] = $slug;

            $company->database()->manager()->createDatabase($company);
            Artisan::call('tenants:migrate', ['--tenants' => [$slug], '--force' => true]);
        }

        if (tenancy()->initialized) {
            tenancy()->end();
        }

        if (! self::$shutdownRegistered) {
            self::$shutdownRegistered = true;
            register_shutdown_function(static fn () => self::dropAllTenantDatabases());
        }
    }

    /** Slug tenant pool ke-$i (0 = a, 1 = b, 2 = c). */
    protected function slug(int $i = 0): string
    {
        self::bootPool();

        if (! isset(self::$pool[$i])) {
            throw new RuntimeException('Tenant pool hanya berisi '.count(self::$pool)." database, diminta indeks {$i}.");
        }

        return self::$pool[$i];
    }

    protected function company(int $i = 0): Company
    {
        return Company::findOrFail($this->slug($i));
    }

    /** Aktifkan tenancy NYATA untuk tenant pool ke-$i (koneksi default -> database tenant itu). */
    protected function useTenant(int $i = 0): Company
    {
        $company = $this->company($i);

        if (tenancy()->initialized) {
            tenancy()->end();
        }

        tenancy()->initialize($company);
        setPermissionsTeamId($company->getTenantKey());
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return $company;
    }

    protected function endTenancy(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
    }

    /** Koneksi baca/tulis langsung ke database tenant pool - tetap hidup walau tenancy berganti. */
    protected function tenantConnection(int $i = 0): Connection
    {
        return self::connectionFor($this->slug($i));
    }

    protected static function connectionFor(string $slug): Connection
    {
        $name = 'pool_'.$slug;

        if (! config("database.connections.{$name}")) {
            $config = self::$centralConfig ?? config('database.connections.mysql');
            $config['database'] = 'tenant_'.$slug;
            config(["database.connections.{$name}" => $config]);
        }

        return DB::connection($name);
    }

    /** Koneksi central eksplisit - dipakai untuk membuktikan data tenant TIDAK bocor ke central. */
    protected function centralConnection(): Connection
    {
        return DB::connection(config('tenancy.database.central_connection'));
    }

    /** Daftarkan slug di luar pool (mis. hasil provisioning) agar ikut dibuang di akhir proses. */
    protected static function trackSlug(string $slug): void
    {
        self::$extraSlugs[] = $slug;
    }

    protected static function wipePool(): void
    {
        foreach (self::$pool as $slug) {
            $connection = self::connectionFor($slug);
            $connection->statement('SET FOREIGN_KEY_CHECKS = 0');

            foreach (self::WIPE_TABLES as $table) {
                $connection->table($table)->delete();
            }

            $connection->statement('SET FOREIGN_KEY_CHECKS = 1');
        }
    }

    /**
     * Dibuang lewat PDO mentah, bukan Eloquent: handler ini berjalan setelah
     * PHPUnit selesai, saat container Laravel sudah bisa dibongkar.
     */
    private static function dropAllTenantDatabases(): void
    {
        $config = self::$centralConfig;
        $slugs = array_merge(self::$pool, self::$extraSlugs);

        if ($config === null || $slugs === []) {
            return;
        }

        try {
            $pdo = new PDO(
                "mysql:host={$config['host']};port={$config['port']}",
                $config['username'],
                $config['password'],
            );

            foreach ($slugs as $slug) {
                $pdo->exec("DROP DATABASE IF EXISTS `tenant_{$slug}`");
            }

            $central = $config['database'];
            $daftar = "'".implode("','", $slugs)."'";
            $pdo->exec("DELETE FROM `{$central}`.`company_user` WHERE company_id IN ({$daftar})");
            $pdo->exec("DELETE FROM `{$central}`.`companies` WHERE id IN ({$daftar})");
            $pdo->exec("DELETE FROM `{$central}`.`organizations` WHERE slug = 'tenancy-real-org'");
        } catch (Throwable) {
            // Pembersihan terbaik-usaha: kegagalan di sini tidak boleh menutupi hasil test.
        }

        self::$pool = [];
        self::$extraSlugs = [];
    }

    // ------------------------------------------------------------------
    // Pembantu umum
    // ------------------------------------------------------------------

    /** User central + keanggotaan perusahaan yang disebutkan. */
    protected function member(string ...$slugs): User
    {
        $user = User::factory()->create();
        $user->companies()->syncWithoutDetaching($slugs);

        return $user;
    }

    /** Beri role (team Spatie = $slug) tanpa mewarisi relasi role perusahaan lain. */
    protected function giveRole(User $user, string $slug, string $role): void
    {
        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId($slug);
        $user->unsetRelation('roles')->unsetRelation('permissions');
        $user->assignRole($role);
        setPermissionsTeamId($sebelumnya);
        $user->unsetRelation('roles')->unsetRelation('permissions');
    }
}
