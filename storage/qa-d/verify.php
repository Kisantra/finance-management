<?php
/**
 * Verifikasi pasca-tulis:
 *  V1 — sapu SELURUH kolom teks kedua database tenant: tidak boleh ada
 *       penanda perusahaan lawan (bukti nol kebocoran di level penyimpanan).
 *  V2 — nomor invoice independen: terbitkan invoice KEDUA di kedua perusahaan
 *       dan buktikan urutannya 2 di masing-masing, bukan 3 di yang kedua.
 *  V3 — berkas lampiran mendarat di folder storage perusahaan yang benar.
 */
require __DIR__.'/http.php';

$log = fopen(__DIR__.'/05-verifikasi.log', 'w');
function t($s = ''): void
{
    global $log;
    fwrite($log, "$s\n");
    echo "$s\n";
}

function pdo(string $db): PDO
{
    if (! str_starts_with($db, 'tenant_qa') && ! str_starts_with($db, 'qa_')) {
        throw new RuntimeException("PENJAGA: $db bukan database QA");
    }

    return new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db", 'root', 'Ambi2026#', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
}

// ===================================================================== V1
t('==================== V1  SAPU PENANDA LAWAN DI SELURUH KOLOM TEKS ====================');
$total = ['kolom' => 0, 'temuan' => 0];
foreach ([['tenant_qaalpha', 'BETA-'], ['tenant_qabeta', 'ALPHA-']] as [$db, $lawan]) {
    $p = pdo($db);
    $kolom = $p->query("select table_name as t, column_name as c from information_schema.columns
        where table_schema = '$db' and data_type in ('char','varchar','text','mediumtext','longtext','json')")
        ->fetchAll(PDO::FETCH_ASSOC);
    $hit = 0;
    $diperiksa = 0;
    foreach ($kolom as $k) {
        $tbl = $k['t'];
        $col = $k['c'];
        $diperiksa++;
        $n = (int) $p->query("select count(*) from `$tbl` where `$col` like ".$p->quote("%$lawan%"))->fetchColumn();
        if ($n > 0) {
            $hit += $n;
            t("  TEMUAN $db.$tbl.$col -> $n baris memuat '$lawan'");
        }
    }
    $total['kolom'] += $diperiksa;
    $total['temuan'] += $hit;
    t("  $db: $diperiksa kolom teks diperiksa, $hit baris memuat '$lawan'");
}
t("  RINGKASAN V1: {$total['kolom']} kolom teks, {$total['temuan']} temuan penanda lawan");

// ===================================================================== V2
t();
t('==================== V2  NOMOR INVOICE INDEPENDEN PER PERUSAHAAN ====================');
$jar = [];
foreach ([['qaalpha', 'ALPHA', 'alpha-admin@qa.test'], ['qabeta', 'BETA', 'beta-admin@qa.test']] as [$slug, $tag, $email]) {
    $jar[$slug] = qa_login($email)['jar'];
    qa_req($jar[$slug], "/c/$slug/dashboard");
}

$urut = [];
// sengaja bergantian: alpha#2, beta#2 — kalau urutan dibagi, beta akan dapat 3
foreach ([['qaalpha', 'ALPHA'], ['qabeta', 'BETA']] as $i => [$slug, $tag]) {
    $p = pdo("tenant_$slug");
    $clientId = (int) $p->query('select id from clients order by id limit 1')->fetchColumn();
    $post = [
        'client_id' => $clientId, 'issue_date' => date('Y-m-d'),
        'due_date' => date('Y-m-d', strtotime('+30 days')),
        'items[0][service_name]' => "$tag-VERIF-ITEM-02", 'items[0][quantity]' => 1,
        'items[0][unit]' => 'paket', 'items[0][unit_price]' => 1000000,
        'apply_ppn' => 0,
    ];
    $r = qa_req($jar[$slug], "/c/$slug/invoices", ['post' => $post, 'headers' => ['X-XSRF-TOKEN: '.qa_csrf($jar[$slug]), 'Accept: application/json']]);
    $id = (int) $p->query('select id from invoices where invoice_number is null order by id desc limit 1')->fetchColumn();
    $d = json_decode(qa_req($jar[$slug], "/c/$slug/invoices/$id/data")['body'], true) ?: [];
    $usul = $d['next_invoice_number'] ?? null;
    qa_req($jar[$slug], "/c/$slug/invoices/$id/send", ['post' => ['invoice_number' => $usul], 'headers' => ['X-XSRF-TOKEN: '.qa_csrf($jar[$slug]), 'Accept: application/json']]);
    $nomor = $p->query("select invoice_number from invoices where id = $id")->fetchColumn();
    $seq = $p->query("select invoice_sequence from invoices where id = $id")->fetchColumn();
    $urut[$slug] = ['id' => $id, 'nomor' => $nomor, 'sequence' => (int) $seq];
    t("  invoice KEDUA di /c/$slug: nomor=$nomor invoice_sequence=$seq (POST store status={$r['status']})");
}
t('  seluruh nomor invoice per database:');
foreach (['qaalpha', 'qabeta'] as $slug) {
    $rows = pdo("tenant_$slug")->query('select id, invoice_number, invoice_sequence, status from invoices order by id')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        t("    tenant_$slug  id={$row['id']}  nomor=".($row['invoice_number'] ?? 'NULL').'  seq='.($row['invoice_sequence'] ?? 'NULL')."  status={$row['status']}");
    }
}
t('  KESIMPULAN V2: urutan qaalpha='.$urut['qaalpha']['sequence'].', qabeta='.$urut['qabeta']['sequence']
    .' — '.($urut['qaalpha']['sequence'] === 2 && $urut['qabeta']['sequence'] === 2
        ? 'INDEPENDEN (kalau dibagi, qabeta akan dapat 3)'
        : 'TIDAK SESUAI HARAPAN'));

// ===================================================================== V3
t();
t('==================== V3  LAMPIRAN MENDARAT DI FOLDER PERUSAHAAN YANG BENAR ====================');
$akar = dirname(__DIR__, 1);
foreach (['qaalpha' => 'ALPHA', 'qabeta' => 'BETA'] as $slug => $tag) {
    $dir = dirname(__DIR__).'/tenant'.$slug.'/app/public';
    $berkas = [];
    if (is_dir($dir)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            $berkas[] = str_replace($dir.DIRECTORY_SEPARATOR, '', $f->getPathname());
        }
    }
    sort($berkas);
    t("  storage/tenant$slug/app/public — ".count($berkas).' berkas:');
    foreach ($berkas as $b) {
        t('    '.$b);
    }
    // apakah ada berkas yang dicatat di DB perusahaan lawan?
    $lawan = $slug === 'qaalpha' ? 'qabeta' : 'qaalpha';
    $pathLawan = pdo("tenant_$lawan")->query('select attachment_path from reimbursements where attachment_path is not null
        union select attachment_path from payments where attachment_path is not null')->fetchAll(PDO::FETCH_COLUMN);
    $silang = 0;
    foreach ($pathLawan as $pl) {
        if (file_exists($dir.'/'.$pl)) {
            $silang++;
            t("    SILANG: berkas milik $lawan ($pl) ADA di folder $slug");
        }
    }
    t("    berkas milik $lawan yang ada di folder $slug: $silang");
}
fclose($log);
