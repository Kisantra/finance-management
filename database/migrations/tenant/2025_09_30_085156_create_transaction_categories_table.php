<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_categories', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // income, expense, adjustment, transfer
            $table->string('code')->unique();
            $table->string('label');
            $table->string('parent_code')->nullable();
            $table->timestamps();

            $table->index('type');
            $table->index('parent_code');
        });

        Schema::table('bank_transactions', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->after('transaction_type')
                ->constrained('transaction_categories')->nullOnDelete();

            $table->index('category_id');
        });
    }

    public function down(): void
    {
        Schema::table('bank_transactions', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropIndex(['category_id']);
            $table->dropColumn('category_id');
        });

        Schema::dropIfExists('transaction_categories');
    }
};
