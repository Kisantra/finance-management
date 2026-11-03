<?php
/**
 * D.3.2 — akses paksa lintas perusahaan.
 * Sebagai alpha-admin (anggota qaalpha SAJA), tembak id milik qabeta:
 *   /c/qaalpha/<modul>/<id-beta>  harus 404 (id tidak ada di DB alpha)
 *   /c/qabeta/<modul>/<id-beta>   harus 403 (bukan anggota qabeta)
 * PUT dipakai untuk modul tanpa route GET detail: 404 = tidak ditemukan,
 * 422 = DITEMUKAN (kebocoran), karena validasi baru jalan setelah binding.
 */
require __DIR__.'/http.php';

$ids = json_decode(file_get_contents(__DIR__.'/ids.json'), true)['qabeta'];

$target = [
    ['GET', 'invoices/{invoice}', $ids['invoice'], 'invoice (show)'],
    ['GET', 'invoices/{invoice}/data', $ids['invoice'], 'invoice (data json)'],
    ['GET', 'invoices/{invoice}/edit', $ids['invoice'], 'invoice (edit)'],
    ['GET', 'invoice/{invoice}/download', $ids['invoice'], 'invoice (pdf)'],
    ['GET', 'reimbursements/{id}/data', $ids['reimbursement'], 'reimbursement (data json)'],
    ['GET', 'reimbursements/{id}/edit', $ids['reimbursement'], 'reimbursement (edit)'],
    ['GET', 'fund-requests/{id}/edit', $ids['fundRequest'], 'fund request (edit)'],
    ['PUT', 'loans/{id}', $ids['loan'], 'pinjaman (update)'],
    ['PUT', 'receivables/{id}', $ids['receivable'], 'piutang (update)'],
    ['PUT', 'bank-accounts/{id}', $ids['bankAccount'], 'rekening (update)'],
    ['PUT', 'clients/{id}', $ids['client'], 'klien (update)'],
    ['GET', 'storage/{path}', $ids['attachment'], 'lampiran beta'],
];

$log = fopen(__DIR__.'/03-akses-paksa.log', 'w');
function tulis($log, string $s): void
{
    fwrite($log, "$s\n");
    echo "$s\n";
}

$l = qa_login('alpha-admin@qa.test');
$jar = $l['jar'];
qa_req($jar, '/c/qaalpha/dashboard'); // segarkan token CSRF dalam konteks perusahaan
$token = qa_csrf($jar);

tulis($log, 'Pengguna: alpha-admin@qa.test (admin HANYA di qaalpha)');
tulis($log, 'Id sasaran milik qabeta: '.json_encode($ids));
tulis($log, str_repeat('-', 100));

$gagal = 0;
$total = 0;
foreach ($target as [$metode, $pola, $id, $label]) {
    $jalur = preg_replace('/\{[^}]+\}/', (string) $id, $pola);
    foreach (['qaalpha' => [404], 'qabeta' => [403]] as $slug => $harap) {
        $total++;
        $url = "/c/$slug/$jalur";
        $opt = ['headers' => ['X-XSRF-TOKEN: '.$token]];
        if ($metode === 'PUT') {
            $opt['post'] = ['_method' => 'PUT'];
        }
        $r = qa_req($jar, $url, $opt);
        $ok = in_array($r['status'], $harap, true);
        $tanda = $ok ? 'OK   ' : 'GAGAL';
        if (! $ok) {
            $gagal++;
        }
        $bocor = $r['status'] === 200 || $r['status'] === 422 ? '  <<< KEBOCORAN' : '';
        tulis($log, sprintf('%s %-6s %-52s status=%-3d harap=%-3s %s%s',
            $tanda, $metode, $url, $r['status'], implode('/', $harap), $label, $bocor));
        if ($r['status'] === 200 && $metode === 'GET') {
            tulis($log, '       body(200 byte pertama): '.substr(preg_replace('/\s+/', ' ', strip_tags($r['body'])), 0, 200));
        }
    }
}

tulis($log, str_repeat('-', 100));
tulis($log, "RINGKASAN: $total probe, ".($total - $gagal).' sesuai harapan, '.$gagal.' menyimpang');
fclose($log);
