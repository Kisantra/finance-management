<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('receivables', function (Blueprint $table) {
            // Replace single 'contract_attachment' with path + name columns
            $table->string('contract_attachment_path')->nullable()->after('rejection_reason');
            $table->string('contract_attachment_name')->nullable()->after('contract_attachment_path');
            $table->text('review_notes')->nullable()->after('rejection_reason');
        });

        // Migrate existing data from contract_attachment to contract_attachment_path
        DB::table('receivables')->whereNotNull('contract_attachment')->update([
            'contract_attachment_path' => DB::raw('contract_attachment'),
        ]);

        Schema::table('receivables', function (Blueprint $table) {
            $table->dropColumn('contract_attachment');
        });
    }

    public function down(): void
    {
        Schema::table('receivables', function (Blueprint $table) {
            $table->string('contract_attachment')->nullable();
        });

        DB::table('receivables')->whereNotNull('contract_attachment_path')->update([
            'contract_attachment' => DB::raw('contract_attachment_path'),
        ]);

        Schema::table('receivables', function (Blueprint $table) {
            $table->dropColumn(['contract_attachment_path', 'contract_attachment_name', 'review_notes']);
        });
    }
};
