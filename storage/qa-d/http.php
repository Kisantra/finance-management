<?php
/**
 * Pustaka HTTP untuk QA Gerbang 2: sesi login NYATA (cookie + CSRF) ke
 * dev server 127.0.0.1:8101. Tidak memakai actingAs / TestCase::call().
 */

const QA_BASE = 'http://127.0.0.1:8101';
const QA_JAR = __DIR__.'/jar';
const QA_SANDI = 'QaGerbang#2026';

function qa_jar(string $email): string
{
    if (! is_dir(QA_JAR)) {
        mkdir(QA_JAR, 0777, true);
    }

    return QA_JAR.'/'.preg_replace('/[^a-z0-9]+/', '_', strtolower($email)).'.txt';
}

/**
 * @return array{status:int,size:int,body:string,url:string,headers:string}
 */
function qa_req(string $jar, string $url, array $opt = []): array
{
    $ch = curl_init();
    $headers = $opt['headers'] ?? [];
    // Accept default hanya dipakai bila pemanggil tidak menentukannya sendiri.
    // Dua baris Accept membuat Laravel memilih yang pertama, sehingga error
    // validasi kembali sebagai 302 redirect dan bukan 422 JSON.
    $punyaAccept = (bool) array_filter($headers, fn ($h) => stripos($h, 'accept:') === 0);
    if (! $punyaAccept) {
        $headers[] = 'Accept: text/html,application/json';
    }
    curl_setopt_array($ch, [
        CURLOPT_URL => str_starts_with($url, 'http') ? $url : QA_BASE.$url,
        CURLOPT_COOKIEJAR => $jar,
        CURLOPT_COOKIEFILE => $jar,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_FOLLOWLOCATION => $opt['follow'] ?? false,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => $opt['timeout'] ?? 120,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if (isset($opt['post'])) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $opt['post']);
    }
    if (isset($opt['method'])) {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $opt['method']);
    }
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $hsize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $eff = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $err = curl_error($ch);

    if ($raw === false) {
        return ['status' => 0, 'size' => 0, 'body' => "CURL ERROR: $err", 'url' => $eff, 'headers' => ''];
    }

    return [
        'status' => $status,
        'size' => strlen(substr($raw, $hsize)),
        'body' => substr($raw, $hsize),
        'url' => $eff,
        'headers' => substr($raw, 0, $hsize),
    ];
}

/** Token CSRF = nilai mentah cookie XSRF-TOKEN, dikirim lewat header X-XSRF-TOKEN. */
function qa_csrf(string $jar): string
{
    foreach (file($jar) ?: [] as $baris) {
        $kolom = explode("\t", trim($baris));
        if (count($kolom) === 7 && $kolom[5] === 'XSRF-TOKEN') {
            return urldecode($kolom[6]);
        }
    }

    return '';
}

/** Login nyata. Mengembalikan path cookie jar. */
function qa_login(string $email, ?string $sandi = null): array
{
    $jar = qa_jar($email);
    @unlink($jar);
    qa_req($jar, '/login');
    $token = qa_csrf($jar);
    $r = qa_req($jar, '/login', [
        'post' => ['email' => $email, 'password' => $sandi ?? QA_SANDI],
        'headers' => ['X-XSRF-TOKEN: '.$token],
    ]);
    $lokasi = qa_lokasi($r);

    return ['jar' => $jar, 'status' => $r['status'], 'redirect' => $lokasi, 'body' => $r['body']];
}

function qa_lokasi(array $r): string
{
    if (preg_match('/^location:\s*(.+)$/im', $r['headers'], $m)) {
        return trim($m[1]);
    }

    return '';
}

/**
 * Payload Inertia penuh. Laravel 12 + Inertia 3 menaruhnya di
 * <script data-page="app" type="application/json">{...}</script>,
 * BUKAN di atribut data-page sebuah <div> (asumsi yang keliru).
 */
function qa_page(array $r): array
{
    if (preg_match('#<script data-page="app" type="application/json">(.*?)</script>#s', $r['body'], $m)) {
        $j = json_decode($m[1], true);
        if (is_array($j)) {
            return $j;
        }
    }
    $j = json_decode($r['body'], true);

    return is_array($j) ? $j : [];
}

/** Nama komponen Inertia. */
function qa_komponen(array $r): string
{
    $p = qa_page($r);
    if (isset($p['component'])) {
        return (string) $p['component'];
    }
    if (preg_match('/"component"\s*:\s*"([^"]+)"/', $r['body'], $m)) {
        return $m[1];
    }
    $ct = preg_match('/^content-type:\s*(.+)$/im', $r['headers'], $m) ? strtolower(trim($m[1])) : '';
    if (str_contains($ct, 'application/pdf')) {
        return '(pdf)';
    }
    if (str_contains($ct, 'spreadsheet') || str_contains($ct, 'excel')) {
        return '(excel)';
    }
    if (str_contains($ct, 'application/json')) {
        return '(json)';
    }
    if ($r['status'] >= 300) {
        return '(bukan halaman)';
    }

    return '(tanpa komponen)';
}

function qa_csv(string $s): string
{
    return '"'.str_replace('"', '""', (string) $s).'"';
}
