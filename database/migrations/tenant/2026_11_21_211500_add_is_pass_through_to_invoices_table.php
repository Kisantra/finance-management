<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sifat Debit Note: talangan (menagih kembali biaya yang dibayar atas nama klien, semua item titipan,
 * tanpa PPN/PPh) atau tagihan jasa (dihitung seperti invoice — PPN, PPh 23, HPP, titipan pajak per baris —
 * hanya judul & nomornya Debit Note, mis. Debit Note BCB untuk klien luar negeri). `null` untuk invoice.
 * Semua Debit Note yang sudah ada adalah talangan, jadi angkanya tidak berubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->boolean('is_pass_through')->nullable()->after('document_code');
        });

        DB::table('invoices')->where('document_type', 'debit_note')->update(['is_pass_through' => true]);
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('is_pass_through');
        });
    }
};
