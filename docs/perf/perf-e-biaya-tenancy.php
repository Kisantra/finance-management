<?php

declare(strict_types=1);
use App\Models\Company;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * PAKET E — membedah biaya tenancy per request, tanpa mengurangi dua basis kode.
 *
 * Selisih A−B mencampur dua hal: biaya tenancy DAN perbedaan kode antara branch
 * dan main. Skrip ini mengukur tenancy saja, di dalam SATU proses pada branch:
 *
 *   1. biaya membuka koneksi PDO kedua (ini yang dibayar tiap request tenant)
 *   2. biaya tenancy()->initialize() — resolve tenant + semua bootstrapper
 *   3. biaya setPermissionsTeamId + pemuatan ulang relasi permission
 *
 * Pemakaian:
 *   DB_DATABASE=perf_central php docs/perf/perf-e-biaya-tenancy.php --slug=perfa --ulang=20
 */

require __DIR__.'/perf-e-guard.php';

$opsi = getopt('', ['slug::', 'ulang::', 'out::']);
$slug = $opsi['slug'] ?? 'perfa';
$ulang = max(3, (int) ($opsi['ulang'] ?? 20));

$base = realpath(__DIR__.'/../..');
require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$namaDb = (string) config('database.connections.'.config('database.default').'.database');
perf_e_guard_db($namaDb);

$cfg = config('database.connections.'.config('database.default'));

echo "DB pusat: {$namaDb}  host: {$cfg['host']}:{$cfg['port']}\n\n";

// ---------------------------------------------------- 1. koneksi PDO mentah
$dsnPusat = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$namaDb}";
$dsnTenant = "mysql:host={$cfg['host']};port={$cfg['port']};dbname=tenant_{$slug}";

$waktuKoneksi = [];
for ($i = 0; $i < $ulang; $i++) {
    $t = microtime(true);
    $pdo = new PDO($dsnTenant, $cfg['username'], $cfg['password']);
    $waktuKoneksi[] = (microtime(true) - $t) * 1000;
    $pdo = null;
}

// ------------------------------------------- 2. tenancy()->initialize()/end()
$company = Company::find($slug);
if (! $company) {
    fwrite(STDERR, "FATAL: company {$slug} tidak ada di {$namaDb}.\n");
    exit(3);
}

$kueri = 0;
DB::listen(function () use (&$kueri) {
    $kueri++;
});

$waktuInit = [];
$kueriInit = [];
for ($i = 0; $i < $ulang; $i++) {
    // tenancy di-end dulu supaya setiap iterasi mengukur inisialisasi penuh
    if (tenant()) {
        tenancy()->end();
    }
    // koneksi tenant dilupakan: di PHP-FPM tiap request mulai tanpa koneksi
    DB::purge('tenant');

    $kueri = 0;
    $t = microtime(true);
    tenancy()->initialize($company);
    // satu query ringan untuk memaksa koneksi benar-benar terbuka —
    // tanpa ini PDO lazy dan biaya connect pindah ke query pertama
    DB::connection('tenant')->select('select 1');
    $waktuInit[] = (microtime(true) - $t) * 1000;
    $kueriInit[] = $kueri;
}
tenancy()->end();

// ------------------------------------------------- 3. konteks team permission
$user = User::find(1);
$waktuTeam = [];
$kueriTeam = [];
for ($i = 0; $i < $ulang; $i++) {
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $user->unsetRelation('roles')->unsetRelation('permissions');
    $kueri = 0;
    $t = microtime(true);
    setPermissionsTeamId($slug);
    $jumlahIzin = $user->getAllPermissions()->count();
    $waktuTeam[] = (microtime(true) - $t) * 1000;
    $kueriTeam[] = $kueri;
}

// -------------------------------------------------------------- pelaporan
function ringkas(string $nama, array $angka): string
{
    sort($angka);
    $n = count($angka);

    return sprintf(
        '%-42s median %7.2f ms   min %7.2f   maks %7.2f   (n=%d)',
        $nama,
        $n % 2 ? $angka[intdiv($n, 2)] : ($angka[intdiv($n, 2) - 1] + $angka[intdiv($n, 2)]) / 2,
        $angka[0],
        $angka[$n - 1],
        $n
    );
}

echo ringkas('1. new PDO ke database tenant', $waktuKoneksi), "\n";
echo ringkas('2. tenancy()->initialize() + select 1', $waktuInit), "\n";
echo '   query selama initialize: '.implode(',', array_unique($kueriInit))."\n";
echo ringkas('3. setPermissionsTeamId + getAllPermissions', $waktuTeam), "\n";
echo '   query permission (cache kosong): '.implode(',', array_unique($kueriTeam))."\n";
echo "   jumlah permission admin: {$jumlahIzin}\n";

$out = $opsi['out'] ?? ($base.'/storage/perf-e/biaya-tenancy.csv');
@mkdir(dirname($out), 0777, true);
$fp = fopen($out, 'wb');
fputcsv($fp, ['tahap', 'iterasi', 'ms', 'queries'], ',', '"', '\\');
foreach ($waktuKoneksi as $i => $ms) {
    fputcsv($fp, ['pdo_connect_tenant', $i, round($ms, 3), 0], ',', '"', '\\');
}
foreach ($waktuInit as $i => $ms) {
    fputcsv($fp, ['tenancy_initialize', $i, round($ms, 3), $kueriInit[$i]], ',', '"', '\\');
}
foreach ($waktuTeam as $i => $ms) {
    fputcsv($fp, ['permissions_team', $i, round($ms, 3), $kueriTeam[$i]], ',', '"', '\\');
}
fclose($fp);
echo "\nCSV: {$out}\n";
