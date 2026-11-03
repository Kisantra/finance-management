<?php

declare(strict_types=1);

/**
 * PAKET E — penggerak pengukuran (Gerbang 4).
 *
 * Memanggil perf-e-request.php satu kali per request, sebagai PROSES TERPISAH,
 * sejumlah --ulang kali per halaman. Request pertama setiap halaman dibuang
 * (cold: cache permission Spatie, cache config, koneksi pertama) dan dilaporkan
 * terpisah. Angka utama = MEDIAN dari sisanya.
 *
 * Pemakaian:
 *   php docs/perf/perf-e-ukur.php --kondisi=A --ulang=6 --out=storage/perf-e/kondisi-a.csv
 *   php docs/perf/perf-e-ukur.php --kondisi=B --ulang=6 --out=storage/perf-e/kondisi-b.csv
 *
 * Kondisi A = branch multi-tenancy (perf_central + tenant_perfa, prefix /c/perfa).
 * Kondisi B = worktree branch main (perf_single, tanpa prefix, tanpa tenancy).
 */

require __DIR__.'/perf-e-guard.php';

$opsi = getopt('', ['kondisi:', 'ulang::', 'out::', 'base::', 'db::', 'slug::', 'hanya::', 'jsonl::', 'appenv::', 'tag::', 'opcache::']);
$kondisi = strtoupper($opsi['kondisi'] ?? '');
$ulang = max(2, (int) ($opsi['ulang'] ?? 6));
$slug = $opsi['slug'] ?? 'perfa';
$hanya = $opsi['hanya'] ?? '';
$appenv = $opsi['appenv'] ?? '';
$tag = $opsi['tag'] ?? strtolower($kondisi);
$opcache = $opsi['opcache'] ?? '';

if (! in_array($kondisi, ['A', 'B'], true)) {
    fwrite(STDERR, "Pemakaian: --kondisi=A|B [--ulang=6] [--out=...csv] [--hanya=label1,label2]\n");
    exit(2);
}

$akarBranch = realpath(__DIR__.'/../..');

$default = $kondisi === 'A'
    ? ['base' => $akarBranch, 'db' => 'perf_central', 'prefix' => "/c/{$slug}"]
    : ['base' => 'D:/tmp/perf-e-main', 'db' => 'perf_single', 'prefix' => ''];

$base = $opsi['base'] ?? $default['base'];
$db = $opsi['db'] ?? $default['db'];
$prefix = $default['prefix'];

perf_e_guard_db($db);

if (! is_file($base.'/vendor/autoload.php')) {
    fwrite(STDERR, "FATAL: {$base} bukan akar aplikasi Laravel (vendor/autoload.php tidak ada).\n");
    exit(2);
}

$ytd = 'start_date=2026-01-01&end_date=2026-11-02';

/**
 * label => [path, mode, user, hanyaKondisi]
 * user=0 berarti request tanpa login (halaman tamu).
 */
$halaman = [
    'login' => ['/login', 'html', 0, null],
    'login-boot' => ['/login', 'html', 0, null],   // duplikat sengaja: kontrol biaya per-request murni
    'dashboard' => ['{p}/dashboard', 'inertia', 1, null],
    'invoices' => ['{p}/invoices', 'inertia', 1, null],
    'bank-accounts' => ['{p}/bank-accounts', 'inertia', 1, null],
    'cash-flow' => ['{p}/cash-flow', 'inertia', 1, null],
    'cash-flow-income' => ['{p}/cash-flow/income', 'inertia', 1, null],
    'cash-flow-expenses' => ['{p}/cash-flow/expenses', 'inertia', 1, null],
    'cash-flow-transfers' => ['{p}/cash-flow/transfers', 'inertia', 1, null],
    'reimbursements' => ['{p}/reimbursements', 'inertia', 1, null],
    'fund-requests' => ['{p}/fund-requests', 'inertia', 1, null],
    'clients' => ['{p}/clients', 'inertia', 1, null],
    'profit-loss' => ['{p}/reports/profit-loss?'.$ytd, 'inertia', 1, null],
    'choose-company' => ['/choose-company', 'inertia', 1, 'A'],
    'dashboard-html' => ['{p}/dashboard', 'html', 1, null],
];

unset($halaman['login-boot']);   // dipakai hanya bila diminta lewat --hanya

$daftarHanya = $hanya === '' ? null : array_map('trim', explode(',', $hanya));

$baris = [];
$mentah = [];

foreach ($halaman as $label => [$path, $mode, $user, $khusus]) {
    if ($khusus !== null && $khusus !== $kondisi) {
        continue;
    }
    if ($daftarHanya !== null && ! in_array($label, $daftarHanya, true)) {
        continue;
    }

    $url = 'http://127.0.0.1:8102'.str_replace('{p}', $prefix, $path);
    $hasil = [];

    for ($i = 0; $i < $ulang; $i++) {
        $keluaran = jalankan($base, $url, $mode, $user, $label, $db, $appenv, $opcache);
        if ($keluaran === null) {
            fwrite(STDERR, "  ! {$label} iterasi {$i} GAGAL\n");

            continue;
        }
        $keluaran['iterasi'] = $i;
        $keluaran['kondisi'] = $kondisi;
        $hasil[] = $keluaran;
        $mentah[] = $keluaran;
    }

    if ($hasil === []) {
        continue;
    }

    $dingin = $hasil[0];
    $hangat = array_slice($hasil, 1);

    $baris[] = [
        'kondisi' => $tag,
        'halaman' => $label,
        'mode' => $mode,
        'status' => $dingin['status'],
        'queries' => median(array_column($hangat, 'queries')),
        'duplikat' => median(array_column($hangat, 'duplikat')),
        'pola_terulang' => median(array_column($hangat, 'pola_terulang')),
        'db_ms_median' => median(array_column($hangat, 'db_ms')),
        'handle_ms_median' => median(array_column($hangat, 'handle_ms')),
        'handle_ms_dingin' => $dingin['handle_ms'],
        'boot_ms_median' => median(array_column($hangat, 'boot_ms')),
        'total_ms_median' => median(array_column($hangat, 'total_ms')),
        'peak_mb' => median(array_column($hangat, 'peak_mb')),
        'bytes' => $dingin['bytes'],
        'props_bytes' => $dingin['props_bytes'] ?? '',
        'q_central' => $dingin['per_koneksi']['mysql'] ?? 0,
        'q_tenant' => $dingin['per_koneksi']['tenant'] ?? 0,
    ];

    printf(
        "%-22s %s  q=%-4s dup=%-3s pola=%-4s db=%-9s handle=%-9s boot=%-9s mem=%sMB props=%s\n",
        $label,
        $dingin['status'],
        median(array_column($hangat, 'queries')),
        median(array_column($hangat, 'duplikat')),
        median(array_column($hangat, 'pola_terulang')),
        median(array_column($hangat, 'db_ms')).'ms',
        median(array_column($hangat, 'handle_ms')).'ms',
        median(array_column($hangat, 'boot_ms')).'ms',
        median(array_column($hangat, 'peak_mb')),
        $dingin['props_bytes'] ?? '-'
    );
}

$out = $opsi['out'] ?? ($akarBranch.'/storage/perf-e/kondisi-'.$tag.'.csv');
tulisCsv($out, $baris);
echo "\nCSV ringkas : {$out}\n";

$jsonl = $opsi['jsonl'] ?? ($akarBranch.'/storage/perf-e/kondisi-'.$tag.'-mentah.jsonl');
$fp = fopen($jsonl, 'wb');
foreach ($mentah as $m) {
    fwrite($fp, json_encode($m, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");
}
fclose($fp);
echo "JSONL mentah: {$jsonl}\n";

// ---------------------------------------------------------------- fungsi

function jalankan(string $base, string $url, string $mode, int $user, string $label, string $db, string $appenv = '', string $opcache = ''): ?array
{
    $perintah = [PHP_BINARY];

    // Satu proses per request berarti OPcache memori-bersama tidak ikut
    // terbawa. file_cache_only menyimpan opcode di disk sehingga proses
    // berikutnya tidak perlu MEM-PARSING ulang 9 MB PHP — ini pengganti
    // terdekat untuk PHP-FPM yang ber-OPcache, dan tanpa itu angka wall-clock
    // didominasi biaya kompilasi yang di produksi tidak ada.
    if ($opcache !== '') {
        @mkdir($opcache, 0777, true);
        array_push(
            $perintah,
            '-d', 'opcache.enable=1',
            '-d', 'opcache.enable_cli=1',
            '-d', 'opcache.file_cache='.$opcache,
            '-d', 'opcache.file_cache_only=1',
            '-d', 'opcache.validate_timestamps=0',
        );
    }

    array_push(
        $perintah,
        __DIR__.'/perf-e-request.php',
        '--base='.$base,
        '--url='.$url,
        '--mode='.$mode,
        '--user='.$user,
        '--label='.$label,
    );

    $env = [
        'DB_DATABASE' => $db,
        'SESSION_COOKIE' => 'perf_e_session',
        'CACHE_PREFIX' => 'perf_e_',
        'PATH' => getenv('PATH') ?: '',
        'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
        'TEMP' => getenv('TEMP') ?: 'C:\\Windows\\Temp',
    ];

    if ($appenv !== '') {
        $env['APP_ENV'] = $appenv;
        // APP_DEBUG=false menyertai APP_ENV=production: itu konfigurasi yang
        // benar untuk produksi, dan pengukuran tidak boleh mewarisi biaya
        // debug handler dari .env dev.
        $env['APP_DEBUG'] = $appenv === 'production' ? 'false' : 'true';
    }

    $proses = proc_open(
        $perintah,
        [1 => ['pipe', 'wb'], 2 => ['pipe', 'wb']],
        $pipa,
        $base,
        $env
    );

    if (! is_resource($proses)) {
        return null;
    }

    $stdout = stream_get_contents($pipa[1]);
    $stderr = stream_get_contents($pipa[2]);
    fclose($pipa[1]);
    fclose($pipa[2]);
    $kode = proc_close($proses);

    if ($kode !== 0) {
        fwrite(STDERR, substr($stderr, 0, 800)."\n");

        return null;
    }

    $data = json_decode(trim($stdout), true);

    return is_array($data) ? $data : null;
}

function median(array $angka): float|int
{
    if ($angka === []) {
        return 0;
    }
    sort($angka);
    $n = count($angka);
    $tengah = intdiv($n, 2);

    return $n % 2 ? $angka[$tengah] : round(($angka[$tengah - 1] + $angka[$tengah]) / 2, 2);
}

function tulisCsv(string $berkas, array $baris): void
{
    if ($baris === []) {
        return;
    }
    @mkdir(dirname($berkas), 0777, true);
    $fp = fopen($berkas, 'wb');
    fputcsv($fp, array_keys($baris[0]), ',', '"', '\\');
    foreach ($baris as $b) {
        fputcsv($fp, $b, ',', '"', '\\');
    }
    fclose($fp);
}
