<?php

declare(strict_types=1);

/**
 * PAKET E — pengisi data pengukuran (E.2).
 *
 * Menulis volume data yang SAMA, dari benih acak yang SAMA, ke dua skema yang
 * berbeda: database tenant di branch multi-tenancy, dan database tunggal di
 * branch main. Keduanya mendapat baris yang identik isi dan jumlahnya, jadi
 * selisih pengukuran A vs B tidak bisa berasal dari perbedaan data.
 *
 * Pemakaian:
 *   php docs/perf/perf-e-seed.php --business=tenant_perfa --auth=perf_central
 *   php docs/perf/perf-e-seed.php --business=perf_single  --auth=perf_single
 *
 * PENJAGA: menolak database yang namanya bukan perf_* atau tenant_perf*.
 */

require __DIR__.'/perf-e-guard.php';

$opsi = getopt('', ['business:', 'auth:', 'host::', 'port::', 'user::', 'pass::']);
$business = $opsi['business'] ?? '';
$auth = $opsi['auth'] ?? '';

perf_e_guard_db($business);
perf_e_guard_db($auth);

$host = $opsi['host'] ?? '127.0.0.1';
$port = (int) ($opsi['port'] ?? 3306);
$user = $opsi['user'] ?? 'root';
$pass = $opsi['pass'] ?? perf_e_env_db_password();

$biz = new PDO("mysql:host={$host};port={$port};dbname={$business}", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$autentikasi = $business === $auth ? $biz : new PDO("mysql:host={$host};port={$port};dbname={$auth}", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

// Benih tetap: dua database berbeda menerima baris yang sama persis.
mt_srand(20261102);

const VOLUME = [
    'services' => 10,
    'clients' => 50,
    'bank_accounts' => 5,
    'invoices' => 200,
    'bank_transactions' => 500,
    'reimbursements' => 100,
    'fund_requests' => 50,
    'loans' => 20,
    'receivables' => 20,
];

$hariIni = new DateTimeImmutable('2026-11-02');

function tgl(DateTimeImmutable $dasar, int $hariKeBelakang): string
{
    return $dasar->modify("-{$hariKeBelakang} days")->format('Y-m-d');
}

function sisip(PDO $pdo, string $tabel, array $baris): void
{
    if ($baris === []) {
        return;
    }
    $kolom = array_keys($baris[0]);
    $placeholder = '('.implode(',', array_fill(0, count($kolom), '?')).')';
    $potongan = array_chunk($baris, 200);
    foreach ($potongan as $kelompok) {
        $sql = 'INSERT INTO `'.$tabel.'` (`'.implode('`,`', $kolom).'`) VALUES '
            .implode(',', array_fill(0, count($kelompok), $placeholder));
        $nilai = [];
        foreach ($kelompok as $r) {
            foreach ($kolom as $k) {
                $nilai[] = $r[$k];
            }
        }
        $pdo->prepare($sql)->execute($nilai);
    }
}

$stamp = $hariIni->format('Y-m-d H:i:s');

// ---------------------------------------------------------------- bersihkan
$biz->exec('SET FOREIGN_KEY_CHECKS=0');
foreach ([
    'receivable_payments', 'receivables', 'loan_payments', 'loans',
    'fund_request_items', 'fund_requests', 'reimbursements',
    'bank_transactions', 'payments', 'invoice_items', 'invoices',
    'bank_accounts', 'clients', 'services', 'recurring_invoices', 'recurring_templates',
] as $t) {
    $biz->exec("TRUNCATE TABLE `{$t}`");
}
$biz->exec('SET FOREIGN_KEY_CHECKS=1');

// ------------------------------------------------------- user (tabel auth)
$adaUser = (int) $autentikasi->query('SELECT COUNT(*) FROM users')->fetchColumn();
$idUser = $autentikasi->query('SELECT id FROM users ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
$dibutuhkan = 5 - count($idUser);
if ($dibutuhkan > 0) {
    // bcrypt "PerfE2026#" sekali, dipakai ulang — hashing 12 rounds x5 mahal tanpa guna.
    $hash = '$2y$12$Nq0Z8Yx0rFq0Yx0rFq0YxuYx0rFq0Yx0rFq0Yx0rFq0Yx0rFq0Yx';
    $baris = [];
    for ($i = 1; $i <= $dibutuhkan; $i++) {
        $baris[] = [
            'name' => "Staf Perf {$i}",
            'email' => "staf{$i}@perf-e.test",
            'password' => $hash,
            'email_verified_at' => $stamp,
            'created_at' => $stamp,
            'updated_at' => $stamp,
        ];
    }
    sisip($autentikasi, 'users', $baris);
    $idUser = $autentikasi->query('SELECT id FROM users ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
}
$idUser = array_map('intval', array_slice($idUser, 0, 5));

// ------------------------------------------------------- kategori transaksi
$kategori = $biz->query('SELECT id, type FROM transaction_categories WHERE parent_id IS NOT NULL')
    ->fetchAll(PDO::FETCH_ASSOC);
if ($kategori === []) {
    fwrite(STDERR, "FATAL: transaction_categories kosong di {$business}. Jalankan TransactionCategorySeeder dulu.\n");
    exit(1);
}
$katPerTipe = [];
foreach ($kategori as $k) {
    $katPerTipe[$k['type']][] = (int) $k['id'];
}
$katIncome = $katPerTipe['income'] ?? array_column($kategori, 'id');
$katExpense = $katPerTipe['expense'] ?? array_column($kategori, 'id');

// ----------------------------------------------------------------- services
$tipeLayanan = ['Perizinan', 'Administrasi Perpajakan', 'Digital Marketing', 'Sistem Digital'];
$baris = [];
for ($i = 1; $i <= VOLUME['services']; $i++) {
    $baris[] = [
        'name' => "Layanan Perf {$i}",
        'price' => mt_rand(5, 80) * 500000,
        'type' => $tipeLayanan[$i % 4],
        'created_at' => $stamp, 'updated_at' => $stamp,
    ];
}
sisip($biz, 'services', $baris);

// ------------------------------------------------------------------ clients
$baris = [];
for ($i = 1; $i <= VOLUME['clients']; $i++) {
    $baris[] = [
        'name' => sprintf('PT Klien Perf %03d', $i),
        'type' => $i % 5 === 0 ? 'individual' : 'company',
        'NPWP' => sprintf('%02d.%03d.%03d.%d-%03d.%03d', $i % 90 + 1, $i, $i * 3 % 999, $i % 9, $i % 800, $i % 700),
        'KPP' => 'KPP Perf '.($i % 7),
        'status' => 'Active',
        'person_in_charge' => "PIC {$i}",
        'email' => "klien{$i}@perf-e.test",
        'address' => "Jl. Perf No. {$i}, Jakarta",
        'created_at' => $stamp, 'updated_at' => $stamp,
    ];
}
sisip($biz, 'clients', $baris);
$idKlien = array_map('intval', $biz->query('SELECT id FROM clients ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));

// ------------------------------------------------------------ bank accounts
$namaBank = ['BCA', 'Mandiri', 'BNI', 'BRI', 'Permata'];
$baris = [];
for ($i = 0; $i < VOLUME['bank_accounts']; $i++) {
    $baris[] = [
        'account_name' => 'Rekening Operasional '.($i + 1),
        'account_number' => sprintf('%010d', 1234567890 + $i),
        'bank_name' => $namaBank[$i],
        'branch' => 'Cabang Perf',
        'initial_balance' => (50 + $i * 10) * 1000000,
        'created_at' => $stamp, 'updated_at' => $stamp,
    ];
}
sisip($biz, 'bank_accounts', $baris);
$idRek = array_map('intval', $biz->query('SELECT id FROM bank_accounts ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));

// ----------------------------------------------------------------- invoices
$romawi = [1 => 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
$invoices = [];
$urutanPerPeriode = [];
for ($i = 0; $i < VOLUME['invoices']; $i++) {
    $umur = (int) round($i * 364 / VOLUME['invoices']);          // tersebar rata 1 tahun
    $terbit = $hariIni->modify('-'.(364 - $umur).' days');
    $status = match (true) {
        $i % 10 === 0 => 'draft',
        $i % 10 === 1 => 'sent',
        $i % 10 === 2, $i % 10 === 3 => 'partially_paid',
        default => 'paid',
    };
    $periode = $terbit->format('Y-m');
    $urutanPerPeriode[$periode] = ($urutanPerPeriode[$periode] ?? 0) + 1;
    $urutan = $urutanPerPeriode[$periode];
    $nomor = $status === 'draft' ? null : sprintf(
        '%03d/INV/PFA-%03d/%s/%s',
        $urutan,
        ($i % VOLUME['clients']) + 1,
        $romawi[(int) $terbit->format('n')],
        $terbit->format('Y')
    );
    $invoices[] = [
        'invoice_number' => $nomor,
        'invoice_sequence' => $status === 'draft' ? null : $urutan,
        'billed_to_id' => $idKlien[$i % count($idKlien)],
        'subtotal' => 0,
        'discount_amount' => 0, 'discount_type' => 'fixed', 'discount_value' => 0,
        'ppn_rate' => $i % 3 === 0 ? '11.00' : null,
        'ppn_amount' => 0,
        'total_amount' => 0,
        'issue_date' => $terbit->format('Y-m-d'),
        'due_date' => $terbit->modify('+30 days')->format('Y-m-d'),
        'status' => $status,
        'created_at' => $terbit->format('Y-m-d H:i:s'),
        'updated_at' => $terbit->format('Y-m-d H:i:s'),
    ];
}
sisip($biz, 'invoices', $invoices);
$barisInvoice = $biz->query('SELECT id, billed_to_id, status, issue_date, ppn_rate FROM invoices ORDER BY id')
    ->fetchAll(PDO::FETCH_ASSOC);

$items = [];
$totalPerInvoice = [];
foreach ($barisInvoice as $n => $inv) {
    $jumlahItem = 1 + ($n % 4);
    $subtotal = 0;
    for ($j = 0; $j < $jumlahItem; $j++) {
        $qty = 1 + ($j % 3);
        $harga = mt_rand(2, 60) * 250000;
        $amount = $qty * $harga;
        $subtotal += $amount;
        $items[] = [
            'invoice_id' => $inv['id'],
            'client_id' => $inv['billed_to_id'],
            'service_name' => 'Layanan Perf '.(($n + $j) % VOLUME['services'] + 1),
            'quantity' => number_format($qty, 3, '.', ''),
            'unit' => 'pcs',
            'unit_price' => $harga,
            'amount' => $amount,
            'cogs_amount' => (int) round($amount * 0.35),
            'is_tax_deposit' => ($n % 15 === 0 && $j === 0) ? 1 : 0,
            'created_at' => $inv['created_at'] ?? $stamp,
            'updated_at' => $inv['updated_at'] ?? $stamp,
        ];
    }
    $ppn = $inv['ppn_rate'] !== null ? (int) round($subtotal * 0.11) : 0;
    $totalPerInvoice[$inv['id']] = ['subtotal' => $subtotal, 'ppn' => $ppn, 'total' => $subtotal + $ppn];
}
// created_at/updated_at item: pakai tanggal invoice
foreach ($items as &$it) {
    unset($it['created_at'], $it['updated_at']);
    $it['created_at'] = $stamp;
    $it['updated_at'] = $stamp;
}
unset($it);
sisip($biz, 'invoice_items', $items);

$ubah = $biz->prepare('UPDATE invoices SET subtotal=?, ppn_amount=?, total_amount=? WHERE id=?');
foreach ($totalPerInvoice as $id => $t) {
    $ubah->execute([$t['subtotal'], $t['ppn'], $t['total'], $id]);
}

// ----------------------------------------------------------------- payments
$pembayaran = [];
foreach ($barisInvoice as $n => $inv) {
    $total = $totalPerInvoice[$inv['id']]['total'];
    $terbit = new DateTimeImmutable($inv['issue_date']);
    if ($inv['status'] === 'paid') {
        $cicil = $n % 4 === 0 ? 2 : 1;                 // sebagian dibayar 2x
        for ($c = 0; $c < $cicil; $c++) {
            $pembayaran[] = [
                'invoice_id' => $inv['id'],
                'bank_account_id' => $idRek[$n % count($idRek)],
                'amount' => $cicil === 1 ? $total : ($c === 0 ? intdiv($total, 2) : $total - intdiv($total, 2)),
                'payment_date' => $terbit->modify('+'.(5 + $c * 10).' days')->format('Y-m-d'),
                'payment_method' => $n % 3 === 0 ? 'cash' : 'bank_transfer',
                'reference_number' => 'TRF-'.$inv['id'].'-'.$c,
                'created_at' => $stamp, 'updated_at' => $stamp,
            ];
        }
    } elseif ($inv['status'] === 'partially_paid') {
        $pembayaran[] = [
            'invoice_id' => $inv['id'],
            'bank_account_id' => $idRek[$n % count($idRek)],
            'amount' => (int) round($total * 0.4),
            'payment_date' => $terbit->modify('+7 days')->format('Y-m-d'),
            'payment_method' => 'bank_transfer',
            'reference_number' => 'TRF-'.$inv['id'].'-DP',
            'created_at' => $stamp, 'updated_at' => $stamp,
        ];
    }
}
sisip($biz, 'payments', $pembayaran);

// -------------------------------------------------------- bank transactions
$transaksi = [];
for ($i = 0; $i < VOLUME['bank_transactions']; $i++) {
    $kredit = $i % 5 < 2;
    $transaksi[] = [
        'bank_account_id' => $idRek[$i % count($idRek)],
        'amount' => mt_rand(1, 120) * 100000,
        'transaction_date' => tgl($hariIni, (int) round($i * 364 / VOLUME['bank_transactions'])),
        'transaction_type' => $kredit ? 'credit' : 'debit',
        'category_id' => $kredit
            ? $katIncome[$i % count($katIncome)]
            : $katExpense[$i % count($katExpense)],
        'description' => 'Transaksi Perf '.($i + 1),
        'reference_number' => 'BT-'.sprintf('%05d', $i + 1),
        'created_at' => $stamp, 'updated_at' => $stamp,
    ];
}
sisip($biz, 'bank_transactions', $transaksi);

// ------------------------------------------------------------ reimbursements
$statusRb = ['draft', 'pending', 'approved', 'paid', 'rejected'];
$baris = [];
for ($i = 0; $i < VOLUME['reimbursements']; $i++) {
    $status = $statusRb[$i % 5];
    $jumlah = mt_rand(1, 50) * 50000;
    $baris[] = [
        'user_id' => $idUser[$i % count($idUser)],
        'title' => 'Reimbursement Perf '.($i + 1),
        'description' => 'Pengeluaran operasional nomor '.($i + 1),
        'amount' => $jumlah,
        'amount_paid' => $status === 'paid' ? $jumlah : 0,
        'expense_date' => tgl($hariIni, (int) round($i * 364 / VOLUME['reimbursements'])),
        'category_id' => $katExpense[$i % count($katExpense)],
        'category_input' => 'Operasional',
        'status' => $status,
        'payment_status' => $status === 'paid' ? 'paid' : 'unpaid',
        'reviewed_by' => in_array($status, ['approved', 'paid', 'rejected'], true) ? $idUser[0] : null,
        'reviewed_at' => in_array($status, ['approved', 'paid', 'rejected'], true) ? $stamp : null,
        'created_at' => $stamp, 'updated_at' => $stamp,
    ];
}
sisip($biz, 'reimbursements', $baris);

// -------------------------------------------------------------- fund request
$statusFr = ['draft', 'pending', 'approved', 'disbursed', 'rejected'];
$prioritas = ['low', 'medium', 'high', 'urgent'];
$baris = [];
for ($i = 0; $i < VOLUME['fund_requests']; $i++) {
    $status = $statusFr[$i % 5];
    $terbit = $hariIni->modify('-'.(int) round($i * 364 / VOLUME['fund_requests']).' days');
    $baris[] = [
        'request_number' => $status === 'draft' ? null : sprintf('%03d/PFA/%s/%s', $i + 1, $romawi[(int) $terbit->format('n')], $terbit->format('Y')),
        'user_id' => $idUser[$i % count($idUser)],
        'title' => 'Pengajuan Dana Perf '.($i + 1),
        'purpose' => 'Kebutuhan operasional '.($i + 1),
        'total_amount' => 0,
        'priority' => $prioritas[$i % 4],
        'needed_by_date' => $terbit->modify('+14 days')->format('Y-m-d'),
        'status' => $status,
        'reviewed_by' => in_array($status, ['approved', 'disbursed', 'rejected'], true) ? $idUser[0] : null,
        'reviewed_at' => in_array($status, ['approved', 'disbursed', 'rejected'], true) ? $stamp : null,
        'created_at' => $terbit->format('Y-m-d H:i:s'),
        'updated_at' => $terbit->format('Y-m-d H:i:s'),
    ];
}
sisip($biz, 'fund_requests', $baris);
$idFr = array_map('intval', $biz->query('SELECT id FROM fund_requests ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));

$itemFr = [];
$totalFr = [];
foreach ($idFr as $n => $id) {
    $total = 0;
    for ($j = 0; $j < 2; $j++) {
        $qty = 1 + $j;
        $harga = mt_rand(1, 40) * 100000;
        $total += $qty * $harga;
        $itemFr[] = [
            'fund_request_id' => $id,
            'description' => 'Item '.($j + 1).' pengajuan '.($n + 1),
            'category_id' => $katExpense[($n + $j) % count($katExpense)],
            'amount' => $qty * $harga,
            'quantity' => $qty,
            'unit_price' => $harga,
            'created_at' => $stamp, 'updated_at' => $stamp,
        ];
    }
    $totalFr[$id] = $total;
}
sisip($biz, 'fund_request_items', $itemFr);
$ubah = $biz->prepare('UPDATE fund_requests SET total_amount=? WHERE id=?');
foreach ($totalFr as $id => $t) {
    $ubah->execute([$t, $id]);
}

// --------------------------------------------------------------------- loans
$baris = [];
for ($i = 0; $i < VOLUME['loans']; $i++) {
    $mulai = $hariIni->modify('-'.(30 + $i * 17).' days');
    $baris[] = [
        'loan_number' => sprintf('LN-%03d', $i + 1),
        'lender_name' => 'Pemberi Pinjaman '.($i + 1),
        'principal_amount' => mt_rand(10, 200) * 1000000,
        'interest_type' => $i % 2 === 0 ? 'fixed' : 'percentage',
        'interest_amount' => $i % 2 === 0 ? mt_rand(1, 20) * 500000 : null,
        'interest_rate' => $i % 2 === 0 ? null : '12.50',
        'term_months' => 12 + ($i % 4) * 6,
        'start_date' => $mulai->format('Y-m-d'),
        'maturity_date' => $mulai->modify('+'.(12 + ($i % 4) * 6).' months')->format('Y-m-d'),
        'status' => $i % 7 === 0 ? 'paid_off' : 'active',
        'purpose' => 'Modal kerja '.($i + 1),
        'created_at' => $stamp, 'updated_at' => $stamp,
    ];
}
sisip($biz, 'loans', $baris);
$idLoan = array_map('intval', $biz->query('SELECT id FROM loans ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));

$baris = [];
foreach ($idLoan as $n => $id) {
    for ($j = 0; $j < 3; $j++) {
        $pokok = mt_rand(1, 20) * 500000;
        $bunga = mt_rand(1, 5) * 100000;
        $baris[] = [
            'loan_id' => $id,
            'bank_account_id' => $idRek[$n % count($idRek)],
            'payment_date' => tgl($hariIni, 20 + $n * 10 + $j * 30),
            'principal_paid' => $pokok,
            'interest_paid' => $bunga,
            'total_paid' => $pokok + $bunga,
            'reference_number' => 'LP-'.$id.'-'.$j,
            'created_at' => $stamp, 'updated_at' => $stamp,
        ];
    }
}
sisip($biz, 'loan_payments', $baris);

// --------------------------------------------------------------- receivables
$statusRc = ['draft', 'pending_approval', 'active', 'paid_off'];
$baris = [];
for ($i = 0; $i < VOLUME['receivables']; $i++) {
    $pegawai = $i % 2 === 0;
    $mulai = $hariIni->modify('-'.(15 + $i * 18).' days');
    $baris[] = [
        'receivable_number' => sprintf('RC-%03d', $i + 1),
        'type' => $pegawai ? 'employee_loan' : 'company_loan',
        'debtor_type' => $pegawai ? 'App\Models\User' : 'App\Models\Client',
        'debtor_id' => $pegawai ? $idUser[$i % count($idUser)] : $idKlien[$i % count($idKlien)],
        'principal_amount' => mt_rand(2, 60) * 500000,
        'interest_rate' => '0.0000',
        'installment_months' => 6 + ($i % 3) * 6,
        'installment_amount' => mt_rand(1, 10) * 250000,
        'loan_date' => $mulai->format('Y-m-d'),
        'due_date' => $mulai->modify('+1 year')->format('Y-m-d'),
        'status' => $statusRc[$i % 4],
        'purpose' => 'Pinjaman '.($i + 1),
        'approved_by' => $statusRc[$i % 4] === 'active' ? $idUser[0] : null,
        'approved_at' => $statusRc[$i % 4] === 'active' ? $stamp : null,
        'created_at' => $stamp, 'updated_at' => $stamp,
    ];
}
sisip($biz, 'receivables', $baris);
$idRc = array_map('intval', $biz->query('SELECT id FROM receivables ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));

$baris = [];
foreach ($idRc as $n => $id) {
    for ($j = 0; $j < 2; $j++) {
        $pokok = mt_rand(1, 8) * 250000;
        $baris[] = [
            'receivable_id' => $id,
            'payment_date' => tgl($hariIni, 10 + $n * 12 + $j * 25),
            'principal_paid' => $pokok,
            'interest_paid' => 0,
            'total_paid' => $pokok,
            'payment_method' => ['cash', 'payroll_deduction', 'bank_transfer'][$j % 3],
            'reference_number' => 'RP-'.$id.'-'.$j,
            'created_at' => $stamp, 'updated_at' => $stamp,
        ];
    }
}
sisip($biz, 'receivable_payments', $baris);

// ------------------------------------------------------------------ laporan
$hitung = [];
foreach ([
    'services', 'clients', 'bank_accounts', 'invoices', 'invoice_items', 'payments',
    'bank_transactions', 'reimbursements', 'fund_requests', 'fund_request_items',
    'loans', 'loan_payments', 'receivables', 'receivable_payments', 'transaction_categories',
] as $t) {
    $hitung[$t] = (int) $biz->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
}
$hitung['users (auth db)'] = (int) $autentikasi->query('SELECT COUNT(*) FROM users')->fetchColumn();

echo "Data terisi di {$business} (auth: {$auth}, user awal: {$adaUser})\n";
foreach ($hitung as $t => $n) {
    printf("  %-24s %6d\n", $t, $n);
}
// Sidik jari isi: dipakai untuk membuktikan A dan B benar-benar identik.
$sidik = $biz->query('SELECT MD5(GROUP_CONCAT(CONCAT_WS("|", id, total_amount, status, issue_date) ORDER BY id)) FROM invoices')->fetchColumn();
echo "  sidik-jari invoices      {$sidik}\n";
$sidik2 = $biz->query('SELECT MD5(GROUP_CONCAT(CONCAT_WS("|", id, amount, transaction_type, transaction_date) ORDER BY id)) FROM bank_transactions')->fetchColumn();
echo "  sidik-jari transaksi     {$sidik2}\n";
