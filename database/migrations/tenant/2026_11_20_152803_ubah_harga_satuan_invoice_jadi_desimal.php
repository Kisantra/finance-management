<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Harga satuan item invoice & Debit Note boleh bersen (Rp 9.459,46; Rp 0,85): invoice_items.unit_price dari
 * bigint menjadi decimal(15,2). Jumlah baris (amount) dan semua nominal lain tetap Rupiah bulat
 * (amount = round(qty × harga)), sehingga pembukuan, pembayaran, dan laporan tidak berubah. Nilai lama
 * (bilangan bulat) tersalin apa adanya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->decimal('unit_price', 15, 2)->change();
        });
    }

    public function down(): void
    {
        // Sen dibulatkan MySQL ke Rupiah terdekat.
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->bigInteger('unit_price')->change();
        });
    }
};
