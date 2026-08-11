<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recurring_templates', function (Blueprint $table) {
            $table->dropIndex(['next_generation_date']);
            $table->dropColumn('next_generation_date');
        });
    }

    public function down(): void
    {
        Schema::table('recurring_templates', function (Blueprint $table) {
            $table->date('next_generation_date')->nullable()->after('end_date');
            $table->index('next_generation_date');
        });
    }
};
