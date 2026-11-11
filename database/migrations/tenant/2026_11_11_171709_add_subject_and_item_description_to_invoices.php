<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data yang dibutuhkan template invoice per perusahaan (mis. PT SLU): perihal invoice dan
 * keterangan tambahan per item (boleh beberapa baris, mis. rincian jam kerja atau nomor nota).
 * Keduanya opsional; template yang tidak memakainya tidak berubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('subject')->nullable()->after('billed_to_id');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->text('description')->nullable()->after('service_name');
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn('description');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('subject');
        });
    }
};
