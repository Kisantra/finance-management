<?php

declare(strict_types=1);
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Routing\Events\RouteMatched;
use Illuminate\Support\Facades\DB;

/**
 * PAKET E — pengukur SATU request (dipanggil oleh perf-e-ukur.php).
 *
 * Mengapa satu proses per request, bukan satu proses untuk banyak request:
 * PHP-FPM membooting framework dari nol di SETIAP request. Mengulang
 * $kernel->handle() di dalam satu proses akan mewarisi container, konfigurasi,
 * koneksi PDO, dan cache permission dari request sebelumnya — angkanya jadi
 * lebih baik dari kenyataan, dan justru bagian "biaya per-request" (yang
 * sedang kita selidiki) yang hilang. Jadi: proses baru, aplikasi baru,
 * koneksi baru, persis seperti PHP-FPM.
 *
 * Kode produksi TIDAK disentuh. Pencacah dipasang dengan DB::listen() setelah
 * kernel dibootstrap tetapi SEBELUM request ditangani, sehingga seluruh siklus
 * ikut tercatat: global middleware, InitializeTenancyByPath, bootstrapper
 * tenancy, SetPermissionsTeam, controller, dan HandleInertiaRequests::share().
 *
 * Keluaran: satu baris JSON ke stdout.
 */

require __DIR__.'/perf-e-guard.php';

$opsi = getopt('', ['base:', 'url:', 'mode::', 'user::', 'only::', 'component::', 'label::', 'dump-sql::']);
$base = rtrim($opsi['base'] ?? '', '/\\');
$url = $opsi['url'] ?? '';
$mode = $opsi['mode'] ?? 'inertia';   // html | inertia | partial
$idUser = (int) ($opsi['user'] ?? 1);
$only = $opsi['only'] ?? '';
$component = $opsi['component'] ?? '';
$label = $opsi['label'] ?? $url;

if ($base === '' || $url === '') {
    fwrite(STDERR, "Pemakaian: --base=<path app> --url=<url> [--mode=html|inertia|partial]\n");
    exit(2);
}

$mulai = microtime(true);
$puncakAwal = memory_get_peak_usage(true);

require $base.'/vendor/autoload.php';

$server = [
    'HTTP_HOST' => '127.0.0.1:8102',
    'SERVER_PORT' => '8102',
    'HTTP_USER_AGENT' => 'perf-e/1.0',
    'HTTP_ACCEPT' => 'text/html,application/xhtml+xml',
];

if ($mode === 'inertia' || $mode === 'partial') {
    $server['HTTP_X_INERTIA'] = 'true';
    $server['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest';
}
if ($mode === 'partial' && $only !== '') {
    $server['HTTP_X_INERTIA_PARTIAL_DATA'] = $only;
    $server['HTTP_X_INERTIA_PARTIAL_COMPONENT'] = $component;
}

$request = Request::create($url, 'GET', [], [], [], $server);

/** @var Application $app */
$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);

// Request WAJIB terikat SEBELUM bootstrap: AppServiceProvider::boot() memanggil
// session('locale') dan auth()->check(), yang me-resolve guard sesi — dan guard
// itu menuntut 'request' ada di container. Di HTTP nyata Kernel::handle()
// mengikat request lebih dulu, jadi urutan ini menyalin produksi, bukan
// mengakalinya. (Temuan sampingan: auth()->check() di boot selalu dievaluasi
// SEBELUM StartSession, jadi di HTTP nyata ia selalu false.)
$app->instance('request', $request);

$kernel->bootstrap();
$selesaiBoot = microtime(true);
$berkasSaatBoot = count(get_included_files());
$byteSaatBoot = array_sum(array_map(fn ($f) => is_file($f) ? filesize($f) : 0, get_included_files()));

perf_e_guard_db((string) config('database.connections.'.config('database.default').'.database'));

$kueri = [];
DB::listen(function ($peristiwa) use (&$kueri) {
    $kueri[] = [
        'sql' => $peristiwa->sql,
        'bindings' => $peristiwa->bindings,
        'time' => $peristiwa->time,
        'connection' => $peristiwa->connectionName,
    ];
});

// Login tanpa melewati halaman /login — mekanisme yang sama dengan actingAs().
if ($idUser > 0) {
    $pengguna = User::find($idUser);
    if (! $pengguna) {
        fwrite(STDERR, "FATAL: user id {$idUser} tidak ada.\n");
        exit(3);
    }
    $app['auth']->guard()->setUser($pengguna);
}

// Inertia menolak request navigasi dengan versi aset berbeda (HTTP 409) dan
// badannya kosong, sehingga props tidak bisa diukur. Versi diambil dari
// middleware-nya sendiri supaya selalu cocok dengan build yang ada.
if ($mode === 'inertia' || $mode === 'partial') {
    $versi = $app->make(HandleInertiaRequests::class)->version($request);
    if ($versi !== null) {
        $request->headers->set('X-Inertia-Version', (string) $versi);
    }
}

// Query milik harness (User::find) dibuang; di produksi guard sesi
// mengerjakannya DI DALAM request dan tetap terhitung di sana.
$kueriSebelumRequest = count($kueri);

// Pembagian waktu dalam request, tanpa menyentuh kode produksi: dua event
// bawaan Laravel dipakai sebagai penanda.
//   t_match  = global middleware (StartSession, dll.) + pencocokan route
//   sisanya  = middleware route (tenancy!) + controller + render response
$penanda = ['match' => null];
$app['events']->listen(RouteMatched::class, function () use (&$penanda) {
    $penanda['match'] ??= microtime(true);
});

$sebelum = microtime(true);
$response = $kernel->handle($request);
$sesudah = microtime(true);

$isi = $response->getContent();
$kernel->terminate($request, $response);

// -------------------------------------------------------------- agregasi
$kueriRequest = array_slice($kueri, $kueriSebelumRequest);

if (isset($opsi['dump-sql']) && $opsi['dump-sql'] !== '') {
    $fp = fopen($opsi['dump-sql'], 'wb');
    foreach ($kueriRequest as $i => $k) {
        fwrite($fp, sprintf('%3d [%s] %s | %s
', $i + 1, $k['connection'], $k['sql'], json_encode($k['bindings'])));
    }
    fclose($fp);
}

$sidik = [];
foreach ($kueriRequest as $k) {
    $kunci = $k['sql'].'||'.json_encode($k['bindings']);
    $sidik[$kunci] = ($sidik[$kunci] ?? 0) + 1;
}
$duplikat = array_sum($sidik) - count($sidik);
arsort($sidik);
$teratas = [];
foreach (array_slice($sidik, 0, 5, true) as $kunci => $n) {
    if ($n < 2) {
        continue;
    }
    [$sql] = explode('||', $kunci, 2);
    $teratas[] = ['n' => $n, 'sql' => mb_substr($sql, 0, 300)];
}

// Duplikat kedua: SAMA SQL, bindings BERBEDA. Inilah tanda N+1 — pola
// "select sum(amount) from payments where invoice_id = ?" yang diulang 200x
// tidak pernah terlihat oleh pencacah berbasis sql+bindings.
$pola = [];
foreach ($kueriRequest as $k) {
    $pola[$k['sql']] = ($pola[$k['sql']] ?? 0) + 1;
}
$polaUlang = array_sum($pola) - count($pola);
arsort($pola);
$polaTeratas = [];
foreach (array_slice($pola, 0, 5, true) as $sql => $n) {
    if ($n < 2) {
        continue;
    }
    $polaTeratas[] = ['n' => $n, 'sql' => mb_substr($sql, 0, 300)];
}

$waktuDb = 0.0;
$perKoneksi = [];
foreach ($kueriRequest as $k) {
    $waktuDb += (float) $k['time'];
    $perKoneksi[$k['connection']] = ($perKoneksi[$k['connection']] ?? 0) + 1;
}

$ukuranProps = null;
$propsPerKunci = null;
if ($mode !== 'html' && $isi !== '' && str_starts_with(ltrim((string) $isi), '{')) {
    $json = json_decode((string) $isi, true);
    if (is_array($json) && isset($json['props'])) {
        $ukuranProps = strlen((string) json_encode($json['props']));
        $propsPerKunci = [];
        foreach ($json['props'] as $kunci => $nilai) {
            $propsPerKunci[$kunci] = strlen((string) json_encode($nilai));
        }
        arsort($propsPerKunci);
    }
}

echo json_encode([
    'label' => $label,
    'url' => $url,
    'mode' => $mode,
    'status' => $response->getStatusCode(),
    'queries' => count($kueriRequest),
    'queries_unik' => count($sidik),
    'duplikat' => $duplikat,
    'pola_unik' => count($pola),
    'pola_terulang' => $polaUlang,
    'per_koneksi' => $perKoneksi,
    'db_ms' => round($waktuDb, 2),
    'boot_ms' => round(($selesaiBoot - $mulai) * 1000, 2),
    'handle_ms' => round(($sesudah - $sebelum) * 1000, 2),
    'ms_sampai_route_match' => $penanda['match'] ? round(($penanda['match'] - $sebelum) * 1000, 2) : null,
    'ms_setelah_route_match' => $penanda['match'] ? round(($sesudah - $penanda['match']) * 1000, 2) : null,
    'total_ms' => round(($sesudah - $mulai) * 1000, 2),
    'peak_mb' => round((memory_get_peak_usage(true) - $puncakAwal) / 1048576, 2),
    'berkas_saat_boot' => $berkasSaatBoot,
    'byte_saat_boot' => $byteSaatBoot,
    'berkas_disertakan' => count(get_included_files()),
    'byte_php_dikompilasi' => array_sum(array_map(fn ($f) => is_file($f) ? filesize($f) : 0, get_included_files())),
    'bytes' => strlen((string) $isi),
    'props_bytes' => $ukuranProps,
    'props_per_kunci' => $propsPerKunci,
    'sql_terulang' => $teratas,
    'sql_pola_terbanyak' => $polaTeratas,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
