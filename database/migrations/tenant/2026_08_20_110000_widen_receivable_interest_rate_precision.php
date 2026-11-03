<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Perlebar presisi `receivables.interest_rate` dari decimal(5,2) ke decimal(8,4).
 *
 * BUG-C5: pengguna memasukkan bunga sebagai NOMINAL, lalu controller
 * mengubahnya menjadi persentase dan membulatkannya ke 2 desimal. Nominal
 * aslinya tidak disimpan di mana pun, sehingga nilai yang ditampilkan kembali
 * bergeser dari yang diketik — untuk pokok Rp 10.000.000 dan bunga Rp 333.333,
 * pembulatan 3,33% mengembalikan Rp 333.000 (selisih Rp 333).
 *
 * Empat desimal menekan pergeseran itu sekitar 100 kali (menjadi Rp 3), tanpa
 * mengubah alur perhitungan. Menyimpan nominal apa adanya di kolom tersendiri
 * tetap lebih benar dan dicatat sebagai pekerjaan terbuka.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('receivables', function (Blueprint $table) {
            $table->decimal('interest_rate', 8, 4)->default(0)->change();
        });
    }

    public function down(): void
    {
        Schema::table('receivables', function (Blueprint $table) {
            $table->decimal('interest_rate', 5, 2)->default(0)->change();
        });
    }
};
