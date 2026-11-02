<?php
/**
 * D.2 — sapu SETIAP route GET di bawah c/{company}, di KEDUA perusahaan,
 * sebagai SETIAP pengguna. Sekaligus D.3.1 (penanda silang ALPHA-/BETA-).
 * Keluaran: 02-matriks.csv + 03-penanda-silang.log
 */
require __DIR__.'/http.php';

$ids = json_decode(file_get_contents(__DIR__.'/ids.json'), true);
$routes = json_decode(file_get_contents(__DIR__.'/routes.json'), true);

$halaman = [];
foreach ($routes as $r) {
    if (! str_contains($r['method'], 'GET')) {
        continue;
    }
    if (! str_starts_with($r['uri'], 'c/{company}')) {
        continue;
    }
    $halaman[] = $r['uri'];
}
sort($halaman);

$pengguna = [
    'alpha-admin@qa.test',
    'beta-admin@qa.test',
    'both-manager@qa.test',
    'alpha-staff@qa.test',
];

$anggota = [
    'alpha-admin@qa.test' => ['qaalpha'],
    'beta-admin@qa.test' => ['qabeta'],
    'both-manager@qa.test' => ['qaalpha', 'qabeta'],
    'alpha-staff@qa.test' => ['qaalpha'],
];

/** Isi parameter route dengan id nyata milik perusahaan itu. */
function qa_isi(string $uri, string $slug, array $ids): ?string
{
    $u = str_replace('c/{company}', "c/$slug", $uri);
    if (preg_match_all('/\{(\w+)\??\}/', $u, $m)) {
        foreach ($m[1] as $p) {
            $nilai = match ($p) {
                'path' => $ids[$slug]['attachment'],
                default => $ids[$slug][$p] ?? null,
            };
            if ($nilai === null) {
                return null;
            }
            $u = preg_replace('/\{'.$p.'\??\}/', (string) $nilai, $u, 1);
        }
    }

    return '/'.$u;
}

$jars = [];
foreach ($pengguna as $e) {
    $l = qa_login($e);
    if ($l['status'] !== 302) {
        fwrite(STDERR, "LOGIN GAGAL $e status={$l['status']}\n");
        exit(1);
    }
    $jars[$e] = $l['jar'];
}

$csv = fopen(__DIR__.'/02-matriks.csv', 'w');
fwrite($csv, "halaman,perusahaan,pengguna,status,ukuran,komponen_inertia,catatan\n");
$silang = fopen(__DIR__.'/03-penanda-silang.log', 'w');

$ringkas = ['total' => 0, '200' => 0, '403' => 0, '404' => 0, '500' => 0, 'lain' => 0, 'skip' => 0];
$periksaSilang = ['halaman' => 0, 'bocor' => 0];
$bocorDetail = [];

foreach ($halaman as $uri) {
    foreach (['qaalpha', 'qabeta'] as $slug) {
        $url = qa_isi($uri, $slug, $ids);
        foreach ($pengguna as $email) {
            if ($url === null) {
                fwrite($csv, implode(',', [qa_csv($uri), $slug, $email, 'SKIP', 0, '-', qa_csv('parameter route tanpa data nyata')])."\n");
                $ringkas['skip']++;
                $ringkas['total']++;

                continue;
            }
            $r = qa_req($jars[$email], $url, ['timeout' => 180]);
            $komp = qa_komponen($r);
            $catatan = '';
            $st = $r['status'];
            if ($st === 302) {
                $catatan = 'redirect ke '.qa_lokasi($r);
            }
            if (! in_array($slug, $anggota[$email], true) && $st === 403) {
                $catatan = 'benar: bukan anggota perusahaan (EnsureUserBelongsToCompany)';
            }
            fwrite($csv, implode(',', [qa_csv($url), $slug, $email, $st, $r['size'], qa_csv($komp), qa_csv($catatan)])."\n");
            $ringkas['total']++;
            $kunci = (string) $st;
            $ringkas[isset($ringkas[$kunci]) ? $kunci : 'lain']++;

            // D.3.1 penanda silang: body perusahaan ini tidak boleh memuat penanda lawan
            if ($st === 200 && in_array($slug, $anggota[$email], true)) {
                $lawan = $slug === 'qaalpha' ? 'BETA-' : 'ALPHA-';
                $periksaSilang['halaman']++;
                if (str_contains($r['body'], $lawan)) {
                    $periksaSilang['bocor']++;
                    $bocorDetail[] = "$url [$email] memuat '$lawan'";
                    fwrite($silang, "BOCOR  $url  pengguna=$email  penanda_lawan=$lawan\n");
                } else {
                    fwrite($silang, "bersih $url  pengguna=$email  (tidak ada '$lawan', ukuran {$r['size']})\n");
                }
            }
        }
    }
    fwrite(STDERR, '.');
}
fwrite(STDERR, "\n");
fclose($csv);

fwrite($silang, "\n=== RINGKASAN PENANDA SILANG ===\n");
fwrite($silang, "halaman 200 diperiksa: {$periksaSilang['halaman']}\n");
fwrite($silang, "halaman bocor       : {$periksaSilang['bocor']}\n");
foreach ($bocorDetail as $d) {
    fwrite($silang, "  - $d\n");
}
fclose($silang);

echo "=== RINGKASAN MATRIKS ===\n";
foreach ($ringkas as $k => $v) {
    echo str_pad($k, 8).": $v\n";
}
echo "halaman unik: ".count($halaman)."\n";
echo "penanda silang: {$periksaSilang['halaman']} halaman diperiksa, {$periksaSilang['bocor']} bocor\n";
