<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cabut cascade pada tiga foreign key yang bisa menghapus catatan keuangan diam-diam.
 *
 * TEMUAN C-02: menghapus klien menurunkan saldo bank Rp 99.000.001 tanpa peringatan
 * apa pun, karena `payments.invoice_id` cascade dan penghapusan invoice dilakukan
 * lewat mass-delete yang tidak memicu event model. Jalur yang sama juga menghapus
 * item milik klien lain lewat `invoice_items.client_id`.
 *
 * Controller sudah menolak penghapusan semacam itu, tetapi penjagaan di aplikasi
 * hanya berlaku untuk jalur yang melewatinya. Constraint database berlaku untuk
 * semua jalur — termasuk perintah artisan, tinker, dan skrip pemeliharaan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->foreign('client_id')->references('id')->on('clients')->restrictOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['invoice_id']);
            $table->foreign('invoice_id')->references('id')->on('invoices')->restrictOnDelete();

            $table->dropForeign(['bank_account_id']);
            $table->foreign('bank_account_id')->references('id')->on('bank_accounts')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->foreign('client_id')->references('id')->on('clients')->cascadeOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['invoice_id']);
            $table->foreign('invoice_id')->references('id')->on('invoices')->cascadeOnDelete();

            $table->dropForeign(['bank_account_id']);
            $table->foreign('bank_account_id')->references('id')->on('bank_accounts')->cascadeOnDelete();
        });
    }
};
