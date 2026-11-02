<?php

declare(strict_types=1);
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Organization;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Stancl\Tenancy\Events\DatabaseCreated;
use Stancl\Tenancy\Events\DatabaseMigrated;
use Stancl\Tenancy\Events\DatabaseSeeded;
use Stancl\Tenancy\Events\TenantCreated;

/**
 * PAKET E — Gerbang 5: biaya membuat perusahaan baru dari nol.
 *
 * Memakai jalur yang SAMA dengan UI /admin/companies: Company::create() memicu
 * TenantCreated → JobPipeline(CreateDatabase → MigrateDatabase → SeedDatabase →
 * MarkCompanyActive), lalu keanggotaan + role admin diberikan seperti
 * CompanyController::grantCreatorAccess(). Waktu tiap tahap diambil dari event
 * bawaan stancl (DatabaseCreated/DatabaseMigrated/DatabaseSeeded) — tidak ada
 * kode produksi yang diubah.
 *
 * Pemakaian:
 *   DB_DATABASE=perf_central php docs/perf/perf-e-provisioning.php --slug=perfb --nama="Perf B" --singkatan=PFB
 *   DB_DATABASE=perf_central php docs/perf/perf-e-provisioning.php --banyak=perfc,perfd,perfe
 */

require __DIR__.'/perf-e-guard.php';

$opsi = getopt('', ['slug::', 'nama::', 'singkatan::', 'banyak::', 'out::']);

$base = realpath(__DIR__.'/../..');
require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$dbPusat = (string) config('database.connections.'.config('database.default').'.database');
perf_e_guard_db($dbPusat);

$daftar = [];
if (($opsi['banyak'] ?? '') !== '') {
    foreach (explode(',', $opsi['banyak']) as $s) {
        $s = trim($s);
        $daftar[] = [$s, 'Perf '.strtoupper(substr($s, 4)), strtoupper(substr($s, 0, 3)).strtoupper(substr($s, 4, 1))];
    }
} else {
    $slug = $opsi['slug'] ?? '';
    $daftar[] = [$slug, $opsi['nama'] ?? ('Perf '.$slug), $opsi['singkatan'] ?? strtoupper(substr($slug, 0, 3))];
}

foreach ($daftar as [$slug]) {
    perf_e_guard_db('tenant_'.$slug);
}

$organization = Organization::first();
if (! $organization) {
    fwrite(STDERR, "FATAL: belum ada organization di {$dbPusat}. Jalankan central:bootstrap dulu.\n");
    exit(3);
}
$admin = User::orderBy('id')->first();

$penanda = [];
$peristiwa = [
    TenantCreated::class => 'tenant_created',
    DatabaseCreated::class => 'database_created',
    DatabaseMigrated::class => 'database_migrated',
    DatabaseSeeded::class => 'database_seeded',
];
foreach ($peristiwa as $kelas => $nama) {
    Event::listen($kelas, function () use ($nama, &$penanda) {
        $penanda[$nama] = microtime(true);
    });
}

$hasil = [];

foreach ($daftar as [$slug, $nama, $singkatan]) {
    if (Company::find($slug)) {
        echo "lewati {$slug}: sudah ada\n";

        continue;
    }

    $penanda = [];
    $mulai = microtime(true);

    $company = Company::create([
        'id' => $slug,
        'organization_id' => $organization->id,
        'name' => $nama,
        'abbreviation' => $singkatan,
    ]);

    $selesaiPipeline = microtime(true);

    // Sama seperti CompanyController::grantCreatorAccess()
    $admin->companies()->syncWithoutDetaching([$company->getTenantKey()]);
    $timSebelum = getPermissionsTeamId();
    setPermissionsTeamId($company->getTenantKey());
    $admin->unsetRelation('roles');
    $admin->assignRole('admin');
    setPermissionsTeamId($timSebelum);
    $admin->unsetRelation('roles')->unsetRelation('permissions');

    $selesai = microtime(true);

    $ms = fn (?float $a, ?float $b) => ($a === null || $b === null) ? null : round(($b - $a) * 1000, 1);

    $baris = [
        'slug' => $slug,
        'total_ms' => round(($selesai - $mulai) * 1000, 1),
        // Catatan: listener TenantCreated milik skrip ini terdaftar SETELAH
        // JobPipeline milik TenancyServiceProvider, jadi penandanya baru menyala
        // setelah pipeline selesai dan tidak bisa dipakai. Tahap pertama karena
        // itu digabung: INSERT baris companies + CREATE DATABASE.
        'insert_plus_create_db_ms' => $ms($mulai, $penanda['database_created'] ?? null),
        'migrate_ms' => $ms($penanda['database_created'] ?? null, $penanda['database_migrated'] ?? null),
        'seed_ms' => $ms($penanda['database_migrated'] ?? null, $penanda['database_seeded'] ?? null),
        'mark_active_ms' => $ms($penanda['database_seeded'] ?? null, $selesaiPipeline),
        'grant_access_ms' => $ms($selesaiPipeline, $selesai),
    ];

    // bukti: tabel, migrasi, kategori sistem, profil perusahaan
    $company->run(function () use (&$baris) {
        $baris['tabel'] = DB::connection('tenant')
            ->table('information_schema.tables')
            ->where('table_schema', DB::connection('tenant')->getDatabaseName())
            ->count();
        $baris['migrasi'] = DB::table('migrations')->count();
        $baris['kategori'] = TransactionCategory::count();
        $baris['kategori_sistem'] = TransactionCategory::whereNotNull('system_key')->count();
        $baris['profil'] = CompanyProfile::count();
    });

    $baris['status'] = $company->fresh()->status;

    $hasil[] = $baris;

    printf(
        "%-8s total %8.1f ms | insert+createdb %7s | migrate %8s | seed %7s | active %5s | akses %5s | tabel %d migrasi %d kategori %d (sistem %d) profil %d status %s\n",
        $slug,
        $baris['total_ms'],
        $baris['insert_plus_create_db_ms'],
        $baris['migrate_ms'],
        $baris['seed_ms'],
        $baris['mark_active_ms'],
        $baris['grant_access_ms'],
        $baris['tabel'],
        $baris['migrasi'],
        $baris['kategori'],
        $baris['kategori_sistem'],
        $baris['profil'],
        $baris['status']
    );
}

if ($hasil !== []) {
    $out = $opsi['out'] ?? ($base.'/storage/perf-e/provisioning.csv');
    @mkdir(dirname($out), 0777, true);
    $baru = ! is_file($out);
    $fp = fopen($out, 'ab');
    if ($baru) {
        fputcsv($fp, array_keys($hasil[0]), ',', '"', '\\');
    }
    foreach ($hasil as $b) {
        fputcsv($fp, $b, ',', '"', '\\');
    }
    fclose($fp);
    echo "\nCSV: {$out}\n";
}
