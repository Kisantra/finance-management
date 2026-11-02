<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dua indeks yang menutup full scan + filesort di halaman paling sering dibuka.
 *
 * `payments.payment_date` dan `invoices.issue_date` sama sekali tidak terindeks di
 * produksi (diperiksa 2026-11-02), padahal keduanya dipakai sebagai rentang tanggal
 * oleh daftar invoice, arus kas, dan dashboard.
 *
 * SENGAJA TIDAK ditambahkan: indeks covering `payments(bank_account_id, amount)` dan
 * `bank_transactions(bank_account_id, transaction_type, amount)` untuk mempercepat
 * `BankAccount::withBalance()`. Keduanya berkolom pertama kolom FK, dan MySQL lalu
 * memakai komposit itu untuk memenuhi constraint FK-nya — setelah itu indeksnya
 * TIDAK BISA DIBUANG lagi ("error 1553: needed in a foreign key constraint"), sehingga
 * migrasinya tidak bisa dibalik. Terbukti saat percobaan, bukan dugaan. Imbalannya
 * (scan index-only, bukan menyentuh baris) tidak sepadan dengan migrasi searah di
 * database produksi.
 *
 * Kedua arah dijaga `hasIndex` supaya kegagalan di tengah tidak meninggalkan database
 * dalam keadaan yang menolak percobaan berikutnya.
 */
return new class extends Migration
{
    /** @var array<int, array{0: string, 1: string, 2: string}> tabel, nama indeks, kolom */
    private array $indeks = [
        ['payments', 'payments_payment_date_index', 'payment_date'],
        ['invoices', 'invoices_issue_date_index', 'issue_date'],
    ];

    public function up(): void
    {
        foreach ($this->indeks as [$tabel, $nama, $kolom]) {
            if (Schema::hasIndex($tabel, $nama)) {
                continue;
            }

            Schema::table($tabel, function (Blueprint $table) use ($nama, $kolom) {
                $table->index($kolom, $nama);
            });
        }
    }

    public function down(): void
    {
        foreach ($this->indeks as [$tabel, $nama]) {
            if (! Schema::hasIndex($tabel, $nama)) {
                continue;
            }

            Schema::table($tabel, function (Blueprint $table) use ($nama) {
                $table->dropIndex($nama);
            });
        }
    }
};
