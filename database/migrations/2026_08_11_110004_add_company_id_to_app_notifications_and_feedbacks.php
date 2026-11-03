<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Notifikasi & feedback tetap di database CENTRAL (keputusan final slide 10).
     * company_id (nullable, tanpa FK constraint ke companies agar fleksibel saat
     * import) menandai konteks perusahaan untuk scoping bell per perusahaan.
     */
    public function up(): void
    {
        Schema::table('app_notifications', function (Blueprint $table) {
            $table->string('company_id')->nullable()->index()->after('user_id');
        });

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->string('company_id')->nullable()->index()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('app_notifications', function (Blueprint $table) {
            $table->dropColumn('company_id');
        });

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropColumn('company_id');
        });
    }
};
