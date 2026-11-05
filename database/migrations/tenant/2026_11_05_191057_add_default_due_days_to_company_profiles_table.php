<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Termin jatuh tempo bawaan (hari setelah tanggal invoice). Diisi di form invoice baru dan dipakai
 * juga oleh invoice berulang. 14 = perilaku form invoice sebelumnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->unsignedSmallInteger('default_due_days')->default(14);
        });
    }

    public function down(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('default_due_days');
        });
    }
};
