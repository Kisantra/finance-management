<?php
/**
 * D.5 — alur TULIS penuh per modul inti, di KEDUA perusahaan, lewat HTTP nyata.
 * Id antar langkah dibaca langsung dari database tenant (PDO) supaya langkah
 * berikutnya memakai baris yang BENAR-BENAR tersimpan, bukan hasil scraping.
 * Semua angka diverifikasi lagi di akhir (05-verifikasi.log).
 */
require __DIR__.'/http.php';

$log = fopen(__DIR__.'/05-tulis.log', 'w');
function t($s = ''): void
{
    global $log;
    fwrite($log, "$s\n");
    echo "$s\n";
}

$PDO = [];
function pdo(string $slug): PDO
{
    global $PDO;
    if (! isset($PDO[$slug])) {
        $db = "tenant_$slug";
        if (! str_starts_with($db, 'tenant_qa')) {
            throw new RuntimeException("PENJAGA: $db bukan tenant_qa*");
        }
        $PDO[$slug] = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db", 'root', 'Ambi2026#', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    return $PDO[$slug];
}

function satu(string $slug, string $sql, array $bind = [])
{
    $s = pdo($slug)->prepare($sql);
    $s->execute($bind);

    return $s->fetchColumn();
}

function baris(string $slug, string $sql, array $bind = []): array
{
    $s = pdo($slug)->prepare($sql);
    $s->execute($bind);

    return $s->fetchAll(PDO::FETCH_ASSOC);
}

/** Datar-kan array bersarang menjadi items[0][description] dst. */
function datar(array $data, string $prefix = ''): array
{
    $out = [];
    foreach ($data as $k => $v) {
        $key = $prefix === '' ? (string) $k : "{$prefix}[{$k}]";
        if (is_array($v)) {
            $out = array_merge($out, datar($v, $key));
        } else {
            $out[$key] = $v;
        }
    }

    return $out;
}

/** POST ber-CSRF. Accept: application/json → error validasi kembali sebagai 422 JSON. */
function kirim(string $jar, string $url, array $data, array $files = [], string $label = ''): array
{
    $post = datar($data);
    foreach ($files as $k => $path) {
        $post[$k] = new CURLFile($path, 'image/png', basename($path));
    }
    $r = qa_req($jar, $url, [
        'post' => $post,
        'headers' => ['X-XSRF-TOKEN: '.qa_csrf($jar), 'Accept: application/json'],
    ]);
    $ket = '';
    if ($r['status'] >= 400) {
        $j = json_decode($r['body'], true);
        $ket = '  !! '.substr(json_encode($j['errors'] ?? $j['message'] ?? preg_replace('/\s+/', ' ', strip_tags(substr($r['body'], 0, 400)))), 0, 450);
    }
    t(sprintf('  POST %-58s status=%-3d %s%s', $url, $r['status'], $label, $ket));

    return $r;
}

function saldoHttp(string $jar, string $slug): array
{
    $r = qa_req($jar, "/c/$slug/bank-accounts");
    $p = qa_page($r)['props'] ?? [];
    $out = [];
    $cari = function ($node) use (&$cari, &$out) {
        if (! is_array($node)) {
            return;
        }
        if (isset($node['account_name']) && array_key_exists('balance', $node)) {
            $out[$node['account_name']] = $node['balance'];

            return;
        }
        foreach ($node as $v) {
            $cari($v);
        }
    };
    $cari($p);

    return $out;
}

/** Saldo dihitung langsung dari database tenant: initial + payments + credit - debit. */
function saldoDb(string $slug, int $id): int
{
    return (int) satu($slug, 'select initial_balance
          + (select coalesce(sum(amount),0) from payments where bank_account_id = ?)
          + (select coalesce(sum(amount),0) from bank_transactions where bank_account_id = ? and transaction_type = "credit")
          - (select coalesce(sum(amount),0) from bank_transactions where bank_account_id = ? and transaction_type = "debit")
        from bank_accounts where id = ?', [$id, $id, $id, $id]);
}

$berkas = __DIR__.'/lampiran-uji.png'; // WAJIB jpg/png/pdf — .txt ditolak validasi (benar)
$catat = [];

foreach ([['qaalpha', 'ALPHA', 'alpha-admin@qa.test'], ['qabeta', 'BETA', 'beta-admin@qa.test']] as [$slug, $tag, $email]) {
    t(str_repeat('=', 104));
    t("PERUSAHAAN /c/$slug  (sebagai $email)   database: tenant_$slug");
    t(str_repeat('=', 104));

    $l = qa_login($email);
    $jar = $l['jar'];
    qa_req($jar, "/c/$slug/dashboard");

    $clientId = (int) satu($slug, 'select id from clients order by id limit 1');
    $bank1 = (int) satu($slug, 'select id from bank_accounts order by id limit 1');
    $bank2 = (int) satu($slug, 'select id from bank_accounts order by id desc limit 1');
    $katId = (int) satu($slug, 'select id from transaction_categories where type = "expense" order by id limit 1');
    t("  data awal: client=$clientId bank1=$bank1 bank2=$bank2 kategori_expense=$katId");
    t('  saldo awal (HTTP): '.json_encode(saldoHttp($jar, $slug)));

    // ---------------------------------------------------------------- INVOICE
    t('--- INVOICE: draft -> kirim (dapat nomor) -> pembayaran -> saldo ---');
    kirim($jar, "/c/$slug/invoices", [
        'client_id' => $clientId,
        'issue_date' => date('Y-m-d'),
        'due_date' => date('Y-m-d', strtotime('+30 days')),
        'items' => [['service_name' => "$tag-TULIS-ITEM-01", 'quantity' => 2, 'unit' => 'paket', 'unit_price' => 7500000, 'cogs_amount' => 2000000, 'is_tax_deposit' => 0]],
        'apply_ppn' => 1,
    ], [], 'buat draft invoice');
    $invId = (int) satu($slug, 'select id from invoices where invoice_number is null order by id desc limit 1');
    t("    -> draft invoice id=$invId status=".satu($slug, 'select status from invoices where id = ?', [$invId]));

    $d = json_decode(qa_req($jar, "/c/$slug/invoices/$invId/data")['body'], true) ?: [];
    $usul = $d['next_invoice_number'] ?? null;
    t('    nomor DIUSULKAN backend: '.var_export($usul, true));

    kirim($jar, "/c/$slug/invoices/$invId/send", ['invoice_number' => $usul], [], 'kirim invoice');
    $terbit = satu($slug, 'select invoice_number from invoices where id = ?', [$invId]);
    $seq = satu($slug, 'select invoice_sequence from invoices where id = ?', [$invId]);
    t("    nomor TERBIT: ".var_export($terbit, true)." invoice_sequence=$seq status=".satu($slug, 'select status from invoices where id = ?', [$invId]));
    $catat[$slug]['invoice'] = ['id' => $invId, 'nomor' => $terbit, 'sequence' => $seq,
        'total' => satu($slug, 'select total_amount from invoices where id = ?', [$invId])];

    $saldoSblmBayar = saldoDb($slug, $bank1);
    kirim($jar, "/c/$slug/invoices/$invId/payments", [
        'amount' => 3000000, 'payment_date' => date('Y-m-d'),
        'payment_method' => 'bank_transfer', 'bank_account_id' => $bank1,
        'reference_number' => "$tag-TULIS-BAYAR-01",
    ], ['attachment' => $berkas], 'catat pembayaran 3.000.000 + lampiran');
    $saldoStlhBayar = saldoDb($slug, $bank1);
    t("    saldo rekening#$bank1 (DB): $saldoSblmBayar -> $saldoStlhBayar  delta=".($saldoStlhBayar - $saldoSblmBayar));
    t('    status invoice setelah bayar: '.satu($slug, 'select status from invoices where id = ?', [$invId]));
    $lampBayar = satu($slug, 'select attachment_path from payments where reference_number = ?', ["$tag-TULIS-BAYAR-01"]);
    t('    lampiran pembayaran tersimpan di: '.var_export($lampBayar, true));
    $catat[$slug]['pembayaran'] = ['delta_saldo' => $saldoStlhBayar - $saldoSblmBayar, 'lampiran' => $lampBayar];

    // ---------------------------------------------------------- REIMBURSEMENT
    t('--- REIMBURSEMENT: ajukan -> setujui -> bayar ---');
    kirim($jar, "/c/$slug/reimbursements", [
        'title' => "$tag-TULIS-REIMB-01", 'description' => 'uji tulis',
        'amount' => 450000, 'expense_date' => date('Y-m-d'),
        'category' => 'transport', 'action' => 'submit',
    ], ['attachment' => $berkas], 'ajukan reimbursement + lampiran');
    $reimbId = (int) satu($slug, 'select id from reimbursements where title = ?', ["$tag-TULIS-REIMB-01"]);
    t("    -> reimbursement id=$reimbId status=".satu($slug, 'select status from reimbursements where id = ?', [$reimbId])
        .' lampiran='.var_export(satu($slug, 'select attachment_path from reimbursements where id = ?', [$reimbId]), true));
    kirim($jar, "/c/$slug/reimbursements/$reimbId/review", ['action' => 'approve', 'category_id' => $katId, 'review_notes' => 'ok'], [], 'setujui');
    t('    status setelah setujui: '.satu($slug, 'select status from reimbursements where id = ?', [$reimbId]));
    kirim($jar, "/c/$slug/reimbursements/$reimbId/pay", [
        'bank_account_id' => $bank1, 'payment_date' => date('Y-m-d'),
        'payment_amount' => 450000, 'reference_notes' => "$tag-TULIS-REIMB-BAYAR",
    ], [], 'bayar');
    t('    status/payment_status akhir: '.satu($slug, 'select concat(status,"/",payment_status) from reimbursements where id = ?', [$reimbId]));
    $catat[$slug]['reimbursement'] = ['id' => $reimbId,
        'status' => satu($slug, 'select concat(status,"/",payment_status) from reimbursements where id = ?', [$reimbId])];

    // ------------------------------------------------------------ FUND REQUEST
    t('--- FUND REQUEST: ajukan -> setujui -> cairkan ---');
    $nomorFr = qa_page(qa_req($jar, "/c/$slug/fund-requests/create"))['props']['nextNumber'] ?? null;
    t('    nomor DIUSULKAN backend: '.var_export($nomorFr, true));
    kirim($jar, "/c/$slug/fund-requests", [
        'request_number' => $nomorFr, 'title' => "$tag-TULIS-FR-01",
        'purpose' => 'uji tulis fund request', 'priority' => 'medium',
        'needed_by_date' => date('Y-m-d', strtotime('+7 days')),
        'items' => [['description' => "$tag-FR-ITEM", 'category_id' => $katId, 'quantity' => 2, 'unit_price' => 600000]],
        'action' => 'submit',
    ], ['attachment' => $berkas], 'ajukan fund request');
    $frId = (int) satu($slug, 'select id from fund_requests where title = ?', ["$tag-TULIS-FR-01"]);
    t("    -> fund request id=$frId nomor=".satu($slug, 'select request_number from fund_requests where id = ?', [$frId])
        .' status='.satu($slug, 'select status from fund_requests where id = ?', [$frId]));
    kirim($jar, "/c/$slug/fund-requests/$frId/review", ['action' => 'approve', 'review_notes' => 'ok'], [], 'setujui');
    t('    status setelah setujui: '.satu($slug, 'select status from fund_requests where id = ?', [$frId]));
    $sblmCair = saldoDb($slug, $bank1);
    kirim($jar, "/c/$slug/fund-requests/$frId/disburse", [
        'bank_account_id' => $bank1, 'disbursement_date' => date('Y-m-d'),
        'disbursement_notes' => "$tag-TULIS-FR-CAIR",
    ], [], 'cairkan');
    t('    status akhir: '.satu($slug, 'select status from fund_requests where id = ?', [$frId])
        .'  saldo '.$sblmCair.' -> '.saldoDb($slug, $bank1));
    $catat[$slug]['fund_request'] = ['id' => $frId, 'nomor' => satu($slug, 'select request_number from fund_requests where id = ?', [$frId]),
        'status' => satu($slug, 'select status from fund_requests where id = ?', [$frId])];

    // ---------------------------------------------------------------- TRANSFER
    t('--- TRANSFER antar rekening, lalu HAPUS satu kaki ---');
    $sb1 = saldoDb($slug, $bank1);
    $sb2 = saldoDb($slug, $bank2);
    $trxSebelum = (int) satu($slug, 'select count(*) from bank_transactions');
    kirim($jar, "/c/$slug/bank-transactions/transfer", [
        'from_account_id' => $bank1, 'to_account_id' => $bank2,
        'category_id' => $katId, 'amount' => 1000000, 'admin_fee' => 6500,
        'description' => "$tag-TULIS-TRANSFER-01", 'transfer_date' => date('Y-m-d'),
    ], [], 'transfer 1.000.000 + fee 6.500');
    $kaki = baris($slug, 'select id, bank_account_id, amount, transaction_type, transfer_group_id, reference_number from bank_transactions where description like ? order by id', ["%$tag-TULIS-TRANSFER-01%"]);
    t('    kaki transfer yang terbentuk: '.json_encode($kaki));
    t("    saldo: rek#$bank1 $sb1 -> ".saldoDb($slug, $bank1).", rek#$bank2 $sb2 -> ".saldoDb($slug, $bank2));
    $trxSetelah = (int) satu($slug, 'select count(*) from bank_transactions');
    t("    jumlah bank_transactions: $trxSebelum -> $trxSetelah");

    if (count($kaki) >= 1) {
        $hapusId = $kaki[0]['id'];
        kirim($jar, "/c/$slug/bank-transactions/$hapusId", ['_method' => 'DELETE'], [], "HAPUS kaki id=$hapusId");
        $sisa = baris($slug, 'select id from bank_transactions where description like ?', ["%$tag-TULIS-TRANSFER-01%"]);
        $trxAkhir = (int) satu($slug, 'select count(*) from bank_transactions');
        t('    kaki transfer yang tersisa: '.json_encode(array_column($sisa, 'id')));
        t("    jumlah bank_transactions setelah hapus: $trxAkhir (hilang ".($trxSetelah - $trxAkhir).' baris)');
        t("    saldo setelah hapus: rek#$bank1 ".saldoDb($slug, $bank1).", rek#$bank2 ".saldoDb($slug, $bank2));
        $catat[$slug]['transfer'] = [
            'kaki_terbentuk' => count($kaki), 'hilang_setelah_hapus' => $trxSetelah - $trxAkhir,
            'kaki_tersisa' => count($sisa),
            'saldo_bank1_pulih' => saldoDb($slug, $bank1) === $sb1,
            'saldo_bank2_pulih' => saldoDb($slug, $bank2) === $sb2,
        ];
    }

    // ------------------------------------------------------------------- LOAN
    t('--- PINJAMAN: buat -> bayar angsuran ---');
    $sblmLoan = saldoDb($slug, $bank1);
    kirim($jar, "/c/$slug/loans", [
        'loan_number' => "$tag-TULIS-LOAN-01", 'lender_name' => "$tag Pemberi Uji",
        'principal_amount' => 10000000, 'interest_type' => 'percentage', 'interest_rate' => 12,
        'term_months' => 6, 'start_date' => date('Y-m-d'),
        'maturity_date' => date('Y-m-d', strtotime('+6 months')),
        'purpose' => "$tag-TULIS-PINJAMAN", 'bank_account_id' => $bank1,
    ], [], 'buat pinjaman');
    $loanId = (int) satu($slug, 'select id from loans where loan_number = ?', ["$tag-TULIS-LOAN-01"]);
    t("    -> pinjaman id=$loanId  saldo $sblmLoan -> ".saldoDb($slug, $bank1));
    kirim($jar, "/c/$slug/loans/$loanId/pay", [
        'bank_account_id' => $bank1, 'payment_date' => date('Y-m-d'),
        'principal_paid' => 1666667, 'interest_paid' => 100000,
        'reference_number' => "$tag-TULIS-LOAN-BAYAR",
    ], [], 'bayar angsuran');
    t('    angsuran tercatat: '.satu($slug, 'select count(*) from loan_payments where loan_id = ?', [$loanId])
        .'  kategori transaksi non-null: '.satu($slug, 'select count(*) from bank_transactions where reference_number = ? and category_id is not null', ["$tag-TULIS-LOAN-BAYAR"])
        .'  saldo '.saldoDb($slug, $bank1));
    $catat[$slug]['loan'] = ['id' => $loanId, 'angsuran' => (int) satu($slug, 'select count(*) from loan_payments where loan_id = ?', [$loanId])];

    // --------------------------------------------------------------- PIUTANG
    t('--- PIUTANG: buat -> ajukan -> setujui -> bayar ---');
    kirim($jar, "/c/$slug/receivables", [
        'type' => 'company_loan', 'debtor_id' => $clientId,
        'principal_amount' => 6000000, 'interest_type' => 'percentage', 'interest_rate' => 5,
        'installment_months' => 3, 'loan_date' => date('Y-m-d'),
        'purpose' => "$tag-TULIS-PIUTANG-01", 'disbursement_account' => "$tag-REKENING-01",
    ], [], 'buat piutang');
    $rcvId = (int) satu($slug, 'select id from receivables where purpose = ?', ["$tag-TULIS-PIUTANG-01"]);
    t("    -> piutang id=$rcvId nomor=".satu($slug, 'select receivable_number from receivables where id = ?', [$rcvId])
        .' status='.satu($slug, 'select status from receivables where id = ?', [$rcvId]));
    kirim($jar, "/c/$slug/receivables/$rcvId/submit", [], [], 'ajukan');
    t('    status: '.satu($slug, 'select status from receivables where id = ?', [$rcvId]));
    kirim($jar, "/c/$slug/receivables/$rcvId/approve", ['action' => 'approve', 'bank_account_id' => $bank1, 'notes' => 'ok'], [], 'setujui');
    t('    status: '.satu($slug, 'select status from receivables where id = ?', [$rcvId]).'  saldo '.saldoDb($slug, $bank1));
    kirim($jar, "/c/$slug/receivables/$rcvId/pay", [
        'payment_method' => 'bank_transfer', 'bank_account_id' => $bank1,
        'payment_date' => date('Y-m-d'), 'principal_paid' => 2000000, 'interest_paid' => 100000,
        'reference_number' => "$tag-TULIS-RCV-BAYAR",
    ], [], 'bayar angsuran');
    t('    angsuran tercatat: '.satu($slug, 'select count(*) from receivable_payments where receivable_id = ?', [$rcvId])
        .'  saldo '.saldoDb($slug, $bank1));
    $catat[$slug]['receivable'] = ['id' => $rcvId, 'nomor' => satu($slug, 'select receivable_number from receivables where id = ?', [$rcvId]),
        'status' => satu($slug, 'select status from receivables where id = ?', [$rcvId]),
        'angsuran' => (int) satu($slug, 'select count(*) from receivable_payments where receivable_id = ?', [$rcvId])];

    $catat[$slug]['saldo_akhir_db'] = ['bank1' => saldoDb($slug, $bank1), 'bank2' => saldoDb($slug, $bank2)];
    $catat[$slug]['saldo_akhir_http'] = saldoHttp($jar, $slug);
    t('  saldo akhir  DB: '.json_encode($catat[$slug]['saldo_akhir_db']));
    t('  saldo akhir HTTP: '.json_encode($catat[$slug]['saldo_akhir_http']));
}

file_put_contents(__DIR__.'/05-tulis.json', json_encode($catat, JSON_PRETTY_PRINT));
t();
t('=== NOMOR DOKUMEN YANG TERBIT ===');
foreach ($catat as $slug => $c) {
    t(sprintf('%-9s invoice=%-22s seq=%-3s fund_request=%-18s piutang=%s', $slug,
        $c['invoice']['nomor'] ?? '-', $c['invoice']['sequence'] ?? '-',
        $c['fund_request']['nomor'] ?? '-', $c['receivable']['nomor'] ?? '-'));
}
fclose($log);
