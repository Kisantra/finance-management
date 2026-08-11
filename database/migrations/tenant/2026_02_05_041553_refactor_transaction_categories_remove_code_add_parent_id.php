<?php

use App\Models\TransactionCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * SAFE MIGRATION STRATEGY:
     * 1. Add parent_id column
     * 2. Migrate data from parent_code to parent_id
     * 3. Drop old code and parent_code columns
     */
    public function up(): void
    {
        // Step 1: Add parent_id column
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->unsignedBigInteger('parent_id')->nullable()->after('id');
        });

        // Step 2: Migrate existing data
        // Build mapping: code => id
        $codeToIdMap = TransactionCategory::pluck('id', 'code')->toArray();

        // Update parent_id based on parent_code
        $categories = TransactionCategory::whereNotNull('parent_code')->get();
        foreach ($categories as $category) {
            if (isset($codeToIdMap[$category->parent_code])) {
                $category->update(['parent_id' => $codeToIdMap[$category->parent_code]]);
            }
        }

        // Step 3: Add foreign key constraint
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->foreign('parent_id')
                ->references('id')
                ->on('transaction_categories')
                ->onDelete('cascade');
        });

        // Step 4: Drop indexes then columns (SQLite requires dropping indexes first)
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->dropUnique('transaction_categories_code_unique');
            $table->dropIndex('transaction_categories_parent_code_index');
            $table->dropColumn(['code', 'parent_code']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * WARNING: Reversing this migration will regenerate codes,
     * but original code values will be lost!
     */
    public function down(): void
    {
        // Step 1: Add back code and parent_code columns
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->string('code')->nullable();
            $table->string('parent_code')->nullable();
        });

        // Step 2: Regenerate codes (simple auto-increment based)
        $categories = TransactionCategory::orderBy('id')->get();
        foreach ($categories as $index => $category) {
            $code = 'CAT-'.str_pad($index + 1, 4, '0', STR_PAD_LEFT);
            $category->update(['code' => $code]);
        }

        // Step 3: Rebuild parent_code relationships
        $idToCodeMap = TransactionCategory::pluck('code', 'id')->toArray();
        $categoriesWithParent = TransactionCategory::whereNotNull('parent_id')->get();
        foreach ($categoriesWithParent as $category) {
            if (isset($idToCodeMap[$category->parent_id])) {
                $category->update(['parent_code' => $idToCodeMap[$category->parent_id]]);
            }
        }

        // Step 4: Drop parent_id foreign key and column
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn('parent_id');
        });

        // Step 5: Make code unique again
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->unique('code');
        });
    }
};
