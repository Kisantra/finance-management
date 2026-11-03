<?php

declare(strict_types=1);

/**
 * PAKET E — penjaga bersama semua skrip pengukuran.
 *
 * Skrip di folder ini MEMOTONG DAN MENULIS data. Beberapa worker berjalan
 * bersamaan di mesin yang sama dan database produksi/latihan ada di server
 * MySQL yang sama. Penjaga ini menolak nama database apa pun di luar
 * perf_* / tenant_perf*, supaya kesalahan satu variabel environment tidak
 * menghapus finance_main_dev, latihan_*, atau qa_*.
 */
function perf_e_guard_db(string $nama): void
{
    if ($nama === '') {
        fwrite(STDERR, "FATAL: nama database kosong. Wajib --business/--auth atau DB_DATABASE.\n");
        exit(2);
    }

    if (! preg_match('/^(perf_[a-z0-9_]+|tenant_perf[a-z0-9_]*)$/', $nama)) {
        fwrite(STDERR, "FATAL: skrip Paket E menolak database '{$nama}'.\n");
        fwrite(STDERR, "       Hanya perf_* dan tenant_perf* yang diizinkan.\n");
        exit(2);
    }
}

/** Ambil DB_PASSWORD dari .env tanpa membooting Laravel. */
function perf_e_env_db_password(string $basePath = __DIR__.'/../..'): string
{
    $berkas = $basePath.'/.env';
    if (! is_file($berkas)) {
        return '';
    }
    foreach (file($berkas) as $baris) {
        if (preg_match('/^\s*DB_PASSWORD\s*=\s*(.*)$/', $baris, $m)) {
            return trim(trim($m[1]), "\"'");
        }
    }

    return '';
}
