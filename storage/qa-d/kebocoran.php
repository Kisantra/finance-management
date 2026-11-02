<?php
/**
 * D.3.3 — lampiran per perusahaan (URL, keterambilan, penolakan silang)
 * D.3.4 — tabel yang hidup di database CENTRAL: users, permissions, notifikasi, feedback
 * D.3.5 — konteks izin tidak bocor antar perusahaan
 */
require __DIR__.'/http.php';

$log = fopen(__DIR__.'/03-kebocoran.log', 'w');
function t($s = ''): void
{
    global $log;
    fwrite($log, "$s\n");
    echo "$s\n";
}
$hasil = [];
function nilai(string $id, bool $lulus, string $ket): void
{
    global $hasil;
    $hasil[] = [$id, $lulus, $ket];
    t(($lulus ? '  LULUS ' : '  GAGAL ')."$id — $ket");
}

$ids = json_decode(file_get_contents(__DIR__.'/ids.json'), true);

$jar = [];
foreach (['alpha-admin@qa.test', 'beta-admin@qa.test', 'both-manager@qa.test', 'alpha-staff@qa.test', 'mixed-roles@qa.test'] as $e) {
    $l = qa_login($e);
    $jar[$e] = $l['jar'];
}

// =====================================================================
t('==================== D.3.3  LAMPIRAN ====================');

foreach ([['qaalpha', 'ALPHA', 'alpha-staff@qa.test'], ['qabeta', 'BETA', 'beta-admin@qa.test']] as [$slug, $tag, $pemilik]) {
    $rid = $ids[$slug]['reimbursement'];
    $r = qa_req($jar[$pemilik], "/c/$slug/reimbursements/$rid/data");
    $j = json_decode($r['body'], true);
    $url = $j['attachment_url'] ?? ($j['data']['attachment_url'] ?? null);
    t("GET /c/$slug/reimbursements/$rid/data (sebagai $pemilik) status={$r['status']}");
    t('  attachment_url dari backend: '.var_export($url, true));
    nilai("D.3.3 url berprefix /c/$slug/storage/", is_string($url) && str_contains($url, "/c/$slug/storage/"), (string) $url);

    if (is_string($url)) {
        $amb = qa_req($jar[$pemilik], $url);
        $isiBenar = str_contains($amb['body'], "$tag-LAMPIRAN-01");
        nilai("D.3.3 anggota $slug bisa mengambil lampirannya", $amb['status'] === 200 && $isiBenar,
            "status={$amb['status']} isi_benar=".($isiBenar ? 'ya' : 'tidak'));
    }
}

// silang: ambil berkas milik lawan dari dalam perusahaan sendiri
$pasangan = [
    ['qaalpha', 'alpha-admin@qa.test', $ids['qabeta']['attachment'], 'alpha mengambil berkas beta di jalur alpha', [404]],
    ['qabeta', 'beta-admin@qa.test', $ids['qaalpha']['attachment'], 'beta mengambil berkas alpha di jalur beta', [404]],
    ['qabeta', 'alpha-admin@qa.test', $ids['qabeta']['attachment'], 'alpha-admin (bukan anggota beta) ke jalur beta', [403]],
    ['qaalpha', 'beta-admin@qa.test', $ids['qaalpha']['attachment'], 'beta-admin (bukan anggota alpha) ke jalur alpha', [403]],
];
foreach ($pasangan as [$slug, $email, $path, $label, $harap]) {
    $r = qa_req($jar[$email], "/c/$slug/storage/$path");
    nilai("D.3.3 $label", in_array($r['status'], $harap, true), "status={$r['status']} harap=".implode('/', $harap));
}

// =====================================================================
t();
t('==================== D.3.4  TABEL DI DATABASE CENTRAL ====================');

// --- users
$r = qa_req($jar['alpha-admin@qa.test'], '/c/qaalpha/admin/users?per_page=100');
t("GET /c/qaalpha/admin/users (alpha-admin, admin hanya di qaalpha) status={$r['status']} ukuran={$r['size']}");
$lihat = [];
foreach (['alpha-admin@qa.test', 'beta-admin@qa.test', 'both-manager@qa.test', 'alpha-staff@qa.test', 'nobody@qa.test', 'mixed-roles@qa.test'] as $e) {
    if (str_contains($r['body'], $e)) {
        $lihat[] = $e;
    }
}
t('  email yang terlihat di daftar: '.implode(', ', $lihat));
if (preg_match('/&quot;total&quot;:(\d+)/', $r['body'], $m)) {
    t("  stats.total yang dikirim backend: {$m[1]}");
}
nilai('D.3.4 /admin/users TIDAK membocorkan pengguna perusahaan lain',
    ! in_array('beta-admin@qa.test', $lihat, true),
    'beta-admin@qa.test '.(in_array('beta-admin@qa.test', $lihat, true) ? 'TERLIHAT oleh alpha-admin' : 'tidak terlihat'));

// --- permissions / roles
$r = qa_req($jar['alpha-admin@qa.test'], '/c/qaalpha/admin/permissions');
t("GET /c/qaalpha/admin/permissions status={$r['status']} ukuran={$r['size']} komponen=".qa_komponen($r));
$r2 = qa_req($jar['beta-admin@qa.test'], '/c/qabeta/admin/permissions');
t("GET /c/qabeta/admin/permissions  status={$r2['status']} ukuran={$r2['size']} komponen=".qa_komponen($r2));
t('  (peran GLOBAL by design — lihat MasterPermissionSeeder: setPermissionsTeamId(null))');
$aUser = str_contains($r['body'], 'beta-admin@qa.test');
nilai('D.3.4 /admin/permissions tidak menampilkan email pengguna perusahaan lain', ! $aUser,
    $aUser ? 'body memuat beta-admin@qa.test' : 'tidak ada email lintas perusahaan');

// --- notifikasi (central, user_id milik both-manager di KEDUA perusahaan)
foreach (['qaalpha' => 'BETA-NOTIF-01', 'qabeta' => 'ALPHA-NOTIF-01'] as $slug => $lawan) {
    $r = qa_req($jar['both-manager@qa.test'], "/c/$slug/notifications");
    $ada = str_contains($r['body'], $lawan);
    t("GET /c/$slug/notifications (both-manager) status={$r['status']} ukuran={$r['size']}");
    t('  judul yang dikirim: '.implode(', ', (function ($b) {
        preg_match_all('/"title":"([^"]+)"/', $b, $m);

        return $m[1];
    })($r['body'])));
    nilai("D.3.4 notifikasi di /c/$slug tidak memuat notifikasi perusahaan lain", ! $ada,
        $ada ? "memuat $lawan" : "tidak memuat $lawan");
}

// --- feedback (central)
foreach (['qaalpha' => 'BETA-FEEDBACK-01', 'qabeta' => 'ALPHA-FEEDBACK-01'] as $slug => $lawan) {
    $email = $slug === 'qaalpha' ? 'alpha-admin@qa.test' : 'beta-admin@qa.test';
    $r = qa_req($jar[$email], "/c/$slug/feedbacks?tab=all&per_page=100");
    $ada = str_contains($r['body'], $lawan);
    t("GET /c/$slug/feedbacks?tab=all (sebagai $email) status={$r['status']} ukuran={$r['size']}");
    nilai("D.3.4 feedback di /c/$slug tidak memuat feedback perusahaan lain", ! $ada,
        $ada ? "memuat $lawan" : "tidak memuat $lawan");
}

// =====================================================================
t();
t('==================== D.3.5  KONTEKS IZIN PER PERUSAHAAN ====================');
t('mixed-roles@qa.test = finance manager di qaalpha, staff di qabeta');

function qa_izin(array $r): array
{
    return qa_page($r)['props']['auth']['permissions'] ?? [];
}

$urutan = ['qaalpha', 'qabeta', 'qaalpha', 'qabeta'];
$jumlah = [];
foreach ($urutan as $i => $slug) {
    $r = qa_req($jar['mixed-roles@qa.test'], "/c/$slug/dashboard");
    $izin = qa_izin($r);
    $jumlah[] = [$slug, count($izin)];
    t(sprintf('  langkah %d: /c/%s/dashboard status=%d jumlah_izin=%d  manage_users=%s view_profit_loss=%s',
        $i + 1, $slug, $r['status'], count($izin),
        in_array('manage users', $izin, true) ? 'ya' : 'tidak',
        in_array('view profit-loss', $izin, true) ? 'ya' : 'tidak'));
}
$alpha = array_values(array_filter($jumlah, fn ($x) => $x[0] === 'qaalpha'));
$beta = array_values(array_filter($jumlah, fn ($x) => $x[0] === 'qabeta'));
nilai('D.3.5 izin berbeda per perusahaan', $alpha[0][1] !== $beta[0][1],
    "qaalpha={$alpha[0][1]} izin, qabeta={$beta[0][1]} izin");
nilai('D.3.5 kembali ke perusahaan pertama memulihkan izinnya (bukan tercache)',
    $alpha[0][1] === $alpha[1][1] && $beta[0][1] === $beta[1][1],
    "qaalpha: {$alpha[0][1]} lalu {$alpha[1][1]}; qabeta: {$beta[0][1]} lalu {$beta[1][1]}");

// bukti tambahan: staff di qabeta tidak boleh membuka halaman khusus finance manager
$r = qa_req($jar['mixed-roles@qa.test'], '/c/qaalpha/reports/profit-loss');
$r2 = qa_req($jar['mixed-roles@qa.test'], '/c/qabeta/reports/profit-loss');
nilai('D.3.5 halaman yang hanya boleh finance manager: 200 di qaalpha, 403 di qabeta',
    $r['status'] === 200 && $r2['status'] === 403,
    "qaalpha={$r['status']} qabeta={$r2['status']}");

// =====================================================================
t();
t('==================== RINGKASAN ====================');
$lulus = count(array_filter($hasil, fn ($x) => $x[1]));
t('pemeriksaan: '.count($hasil).", lulus: $lulus, gagal: ".(count($hasil) - $lulus));
foreach ($hasil as [$id, $ok, $ket]) {
    if (! $ok) {
        t("  GAGAL: $id — $ket");
    }
}
fclose($log);
