<?php

declare(strict_types=1);
use App\Http\Middleware\EnsureUserBelongsToCompany;
use App\Http\Middleware\SetCompanyUrlDefaults;
use App\Http\Middleware\SetPermissionsTeam;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByPath;

/**
 * PAKET E — biaya tiap middleware tenancy, DI DALAM SATU BASIS KODE.
 *
 * Selisih kondisi A−B mencampur biaya tenancy dengan perbedaan kode dan versi
 * vendor antara branch dan main. Skrip ini menyingkirkan campuran itu: ia
 * menjalankan pipeline middleware PRODUKSI (kelas aslinya, tanpa modifikasi)
 * terhadap route tiruan di dalam proses yang sama, dua kali — sekali tanpa
 * middleware tenancy, sekali dengan — lalu melaporkan selisihnya.
 *
 * Route tiruan dipakai supaya controller tidak ikut terukur; yang diukur hanya
 * middleware. Route produksi tidak diubah, hanya ditambahi satu route baru di
 * dalam proses pengukuran yang hidup beberapa detik.
 *
 * Pemakaian:
 *   DB_DATABASE=perf_central php docs/perf/perf-e-biaya-middleware.php --slug=perfa --ulang=30
 */

require __DIR__.'/perf-e-guard.php';

$opsi = getopt('', ['slug::', 'ulang::', 'out::']);
$slug = $opsi['slug'] ?? 'perfa';
$ulang = max(5, (int) ($opsi['ulang'] ?? 30));

$base = realpath(__DIR__.'/../..');
require $base.'/vendor/autoload.php';

$requestPalsu = Request::create('http://127.0.0.1:8102/__perf-e/'.$slug, 'GET');

$app = require $base.'/bootstrap/app.php';
$app->instance('request', $requestPalsu);
$app->make(Kernel::class)->bootstrap();

perf_e_guard_db((string) config('database.connections.'.config('database.default').'.database'));

$user = User::find(1);
$app['auth']->guard()->setUser($user);

$tanpaTenancy = ['auth', 'verified'];
$denganTenancy = [
    'auth',
    'verified',
    InitializeTenancyByPath::class,
    EnsureUserBelongsToCompany::class,
    SetPermissionsTeam::class,
    SetCompanyUrlDefaults::class,
];

Route::get('/__perf-e-polos/{company}', fn () => response('ok'))
    ->middleware($tanpaTenancy)->name('perf-e.polos');
Route::get('/__perf-e-tenancy/{company}', fn () => response('ok'))
    ->middleware($denganTenancy)->name('perf-e.tenancy');

$kueri = 0;
DB::listen(function () use (&$kueri) {
    $kueri++;
});

/**
 * Menjalankan satu URL melalui router + pipeline middleware route, lalu
 * mengembalikan [ms, jumlah query].
 *
 * @return array{0: float, 1: int}
 */
function lewatkan(Application $app, string $path, int &$kueri): array
{
    $request = Request::create('http://127.0.0.1:8102'.$path, 'GET');
    $app->instance('request', $request);

    // Sesi diisi palsu supaya StartSession tidak perlu dijalankan — yang
    // diukur hanya middleware route, bukan middleware group web.
    $request->setLaravelSession($app['session.store']);
    $app['session.store']->start();

    $kueri = 0;
    $t = microtime(true);
    $app['router']->dispatch($request);
    $ms = (microtime(true) - $t) * 1000;

    return [$ms, $kueri];
}

// pemanasan: kompilasi route, cache permission Redis, koneksi PDO
lewatkan($app, '/__perf-e-polos/'.$slug, $kueri);
lewatkan($app, '/__perf-e-tenancy/'.$slug, $kueri);
if (tenant()) {
    tenancy()->end();
}

$polos = [];
$tenancy = [];
$kueriPolos = [];
$kueriTenancy = [];

for ($i = 0; $i < $ulang; $i++) {
    // kondisi awal tiap iterasi dibuat sama dengan awal request PHP-FPM:
    // tidak ada tenancy aktif, koneksi tenant belum terbuka.
    if (tenant()) {
        tenancy()->end();
    }
    DB::purge('tenant');
    $user->unsetRelation('roles')->unsetRelation('permissions');

    [$ms, $q] = lewatkan($app, '/__perf-e-polos/'.$slug, $kueri);
    $polos[] = $ms;
    $kueriPolos[] = $q;

    if (tenant()) {
        tenancy()->end();
    }
    DB::purge('tenant');
    $user->unsetRelation('roles')->unsetRelation('permissions');

    [$ms, $q] = lewatkan($app, '/__perf-e-tenancy/'.$slug, $kueri);
    $tenancy[] = $ms;
    $kueriTenancy[] = $q;
}

function med(array $a): float
{
    sort($a);
    $n = count($a);

    return $n % 2 ? $a[intdiv($n, 2)] : ($a[intdiv($n, 2) - 1] + $a[intdiv($n, 2)]) / 2;
}

printf("pipeline TANPA middleware tenancy : median %6.2f ms   query %s\n", med($polos), implode('/', array_unique($kueriPolos)));
printf("pipeline DENGAN middleware tenancy: median %6.2f ms   query %s\n", med($tenancy), implode('/', array_unique($kueriTenancy)));
printf("selisih (biaya murni tenancy)     : median %6.2f ms   query +%d\n",
    med($tenancy) - med($polos),
    (int) (med(array_map('floatval', $kueriTenancy)) - med(array_map('floatval', $kueriPolos)))
);

$out = $opsi['out'] ?? ($base.'/storage/perf-e/biaya-middleware.csv');
@mkdir(dirname($out), 0777, true);
$fp = fopen($out, 'wb');
fputcsv($fp, ['varian', 'iterasi', 'ms', 'queries'], ',', '"', '\\');
foreach ($polos as $i => $ms) {
    fputcsv($fp, ['tanpa_tenancy', $i, round($ms, 3), $kueriPolos[$i]], ',', '"', '\\');
}
foreach ($tenancy as $i => $ms) {
    fputcsv($fp, ['dengan_tenancy', $i, round($ms, 3), $kueriTenancy[$i]], ',', '"', '\\');
}
fclose($fp);
echo "\nCSV: {$out}\n";
