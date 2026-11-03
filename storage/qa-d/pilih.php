<?php
/**
 * D.4 — alur pemilihan perusahaan.
 * 1 perusahaan  → langsung ke dashboard, tanpa /choose-company
 * 2 perusahaan  → pemilih + switcher sidebar
 * 0 perusahaan  → tidak boleh 500
 */
require __DIR__.'/http.php';

$log = fopen(__DIR__.'/04-pilih-perusahaan.log', 'w');
function t($s = ''): void
{
    global $log;
    fwrite($log, "$s\n");
    echo "$s\n";
}

foreach (['alpha-staff@qa.test' => 1, 'both-manager@qa.test' => 2, 'nobody@qa.test' => 0] as $email => $jml) {
    t(str_repeat('=', 90));
    t("PENGGUNA $email — anggota $jml perusahaan");
    $l = qa_login($email);
    t("POST /login status={$l['status']} location={$l['redirect']}");

    // ikuti rantai redirect satu per satu supaya terlihat apa yang sebenarnya terjadi
    $url = $l['redirect'] ?: '/choose-company';
    for ($i = 0; $i < 5; $i++) {
        $r = qa_req($l['jar'], $url);
        $komp = qa_komponen($r);
        $lok = qa_lokasi($r);
        t(sprintf('  GET %-58s status=%-3d ukuran=%-6d komponen=%s%s',
            parse_url($url, PHP_URL_PATH).(parse_url($url, PHP_URL_QUERY) ? '?'.parse_url($url, PHP_URL_QUERY) : ''),
            $r['status'], $r['size'], $komp, $lok ? "  -> $lok" : ''));

        if ($r['status'] === 200) {
            $p = qa_page($r);
            $props = $p['props'] ?? [];
            if (isset($props['companies'])) {
                t('    props.companies = '.json_encode($props['companies']));
            }
            if (isset($props['company'])) {
                t('    props.company   = '.json_encode($props['company']));
            }
            if ($komp === 'error' || $r['status'] >= 500) {
                t('    ISI ERROR: '.substr(json_encode($props), 0, 400));
            }
            // switcher sidebar: daftar perusahaan yang dikirim ke frontend
            if (isset($props['auth']['companies'])) {
                t('    props.auth.companies = '.json_encode($props['auth']['companies']));
            }
            break;
        }
        if (! $lok) {
            t('    tidak ada Location — rantai berhenti');
            if ($r['status'] >= 400) {
                t('    BODY: '.substr(preg_replace('/\s+/', ' ', strip_tags($r['body'])), 0, 500));
            }
            break;
        }
        $url = $lok;
    }

    // apa yang terjadi kalau pengguna langsung membuka dashboard perusahaan?
    foreach (['qaalpha', 'qabeta'] as $slug) {
        $r = qa_req($l['jar'], "/c/$slug/dashboard");
        t(sprintf('  GET /c/%s/dashboard  status=%-3d komponen=%s', $slug, $r['status'], qa_komponen($r)));
    }

    // apa yang terjadi di /choose-company?
    $r = qa_req($l['jar'], '/choose-company');
    t(sprintf('  GET /choose-company   status=%-3d komponen=%s%s', $r['status'], qa_komponen($r), qa_lokasi($r) ? '  -> '.qa_lokasi($r) : ''));
    if ($r['status'] === 200) {
        $p = qa_page($r);
        t('    props: '.substr(json_encode(array_diff_key($p['props'] ?? [], ['auth' => 1, 'errors' => 1])), 0, 600));
    }
    if ($r['status'] >= 500) {
        t('    BODY: '.substr(preg_replace('/\s+/', ' ', strip_tags($r['body'])), 0, 600));
    }
}
fclose($log);
