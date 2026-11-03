<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->string('abbreviation', 10)->nullable()->default(null)->change();
        });

        // Clear existing default value so auto-generate from name kicks in
        DB::table('company_profiles')->update(['abbreviation' => null]);
    }

    public function down(): void
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->string('abbreviation', 10)->default('KSN')->change();
        });
    }
};
