<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reimbursements', function (Blueprint $table) {
            // Add FK to transaction_categories (set by finance during review)
            $table->foreignId('category_id')->nullable()->after('expense_date')
                ->constrained('transaction_categories')->nullOnDelete();

            // Rename old category field to category_input (user's text input)
            $table->renameColumn('category', 'category_input');

            $table->index('category_id');
        });
    }

    public function down(): void
    {
        Schema::table('reimbursements', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
            $table->renameColumn('category_input', 'category');
        });
    }
};
