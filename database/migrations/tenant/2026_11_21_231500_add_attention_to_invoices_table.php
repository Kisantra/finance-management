<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ATTENTION per dokumen (baris ATTENTION di header PDF template perusahaan, mis. "Direktur Finance &
 * Accounting"): kosong = penanggung jawab di data klien (`clients.person_in_charge`), seperti sebelumnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('attention')->nullable()->after('subject');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('attention');
        });
    }
};
