<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Potongan PPh 23 oleh klien: tarif (persen) dan nominalnya, dibekukan per invoice seperti PPN.
 * `total_amount` invoice yang dipotong = DPP + PPN − PPh (yang ditransfer klien). Invoice lama
 * tanpa potongan (NULL / 0), sehingga nomor, total, dan PDF-nya tidak berubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('pph_rate', 5, 2)->nullable()->after('ppn_amount');
            $table->unsignedInteger('pph_amount')->default(0)->after('pph_rate');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['pph_rate', 'pph_amount']);
        });
    }
};
