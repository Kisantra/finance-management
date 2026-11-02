<?php
// Buat ulang database QA. Penjaga: hanya nama qa_* / tenant_qa*.
$pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', 'Ambi2026#');
foreach (['qa_central', 'tenant_qaalpha', 'tenant_qabeta'] as $db) {
    if (! preg_match('/^(qa_|tenant_qa)/', $db)) { fwrite(STDERR, "TOLAK: $db\n"); exit(1); }
    $pdo->exec("DROP DATABASE IF EXISTS `$db`");
    echo "dropped $db\n";
}
$pdo->exec('CREATE DATABASE `qa_central` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
echo "created qa_central\n";
