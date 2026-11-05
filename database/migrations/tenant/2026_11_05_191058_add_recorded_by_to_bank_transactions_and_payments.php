<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Siapa yang mencatat dan siapa yang terakhir mengubah uang masuk/keluar. Berisi id pengguna di
 * database PUSAT, jadi tanpa foreign key (tabel users tidak ada di database perusahaan). Data
 * sebelum kolom ini ada tetap kosong: pencatatnya memang tidak pernah direkam.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['bank_transactions', 'payments'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->index();
                $table->unsignedBigInteger('updated_by')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['bank_transactions', 'payments'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->dropIndex(['created_by']);
                $table->dropColumn(['created_by', 'updated_by']);
            });
        }
    }
};
