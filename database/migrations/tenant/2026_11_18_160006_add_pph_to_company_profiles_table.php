<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Apakah klien perusahaan ini memotong PPh 23 dari invoicenya, dan tarif bawaannya. Seperti PKP/PPN:
 * hanya perusahaan yang menyalakannya yang melihat sakelar PPh 23 di editor invoice. Bawaan mati,
 * sehingga perusahaan yang sudah ada tidak berubah sampai admin menyalakannya di Profil perusahaan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->boolean('pph_enabled')->default(false)->after('ppn_rate');
            $table->decimal('pph_rate', 5, 2)->default(2)->after('pph_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn(['pph_enabled', 'pph_rate']);
        });
    }
};
