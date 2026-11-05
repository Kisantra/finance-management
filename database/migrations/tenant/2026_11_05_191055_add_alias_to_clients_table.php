<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alias klien untuk segmen {KLIEN} nomor invoice (mis. 001/INV/KSN-SMA/I/2026). Kosong = inisial
 * nama seperti sebelumnya. Hanya huruf/angka (dibaca ulang oleh pola penomoran), tidak wajib unik:
 * nomor invoice tetap unik karena nomor urutnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('alias', 10)->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('alias');
        });
    }
};
