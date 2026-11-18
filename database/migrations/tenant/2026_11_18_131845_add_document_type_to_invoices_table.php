<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jenis dokumen tagihan (Invoice / Debit Note) dan kode jenisnya (FINAL, DEM, TKBM, PNBP, …) yang
 * ikut ke nomor lewat token {KODE}. Invoice lama otomatis berjenis Invoice tanpa kode, sehingga
 * nomor, PDF, dan angkanya tidak berubah. Lihat docs/design/debit-note-slu/README.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('document_type', 20)->default('invoice')->after('invoice_sequence');
            $table->string('document_code', 20)->nullable()->after('document_type');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['document_type', 'document_code']);
        });
    }
};
