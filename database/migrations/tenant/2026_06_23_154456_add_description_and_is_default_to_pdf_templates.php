<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pdf_templates', function (Blueprint $table) {
            $table->string('description')->nullable()->after('name');
            $table->boolean('is_default')->default(false)->after('layout');
        });
    }

    public function down(): void
    {
        Schema::table('pdf_templates', function (Blueprint $table) {
            $table->dropColumn(['description', 'is_default']);
        });
    }
};
