<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * PPN per invoice (perusahaan PKP). ppn_rate = tarif yang dipakai saat invoice dibuat (snapshot);
     * NULL = invoice lama sebelum fitur ini (tidak ada data PPN), 0 = tanpa PPN. ppn_amount ikut
     * dalam total_amount.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('ppn_rate', 5, 2)->nullable()->after('discount_reason');
            $table->unsignedBigInteger('ppn_amount')->default(0)->after('ppn_rate');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['ppn_rate', 'ppn_amount']);
        });
    }
};
