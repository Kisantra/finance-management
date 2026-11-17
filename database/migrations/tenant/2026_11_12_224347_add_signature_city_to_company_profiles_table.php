<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kota tempat invoice ditandatangani ("Samarinda, 24 Oktober 2026"). Dicetak oleh template invoice
 * per perusahaan; kosong = hanya tanggal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->string('signature_city', 100)->nullable()->after('finance_manager_position');
        });
    }

    public function down(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('signature_city');
        });
    }
};
