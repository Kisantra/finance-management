<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('fund_request_items', function (Blueprint $table) {
            $table->id();

            // Link to fund request
            $table->foreignId('fund_request_id')->constrained()->onDelete('cascade');

            // Item Details
            $table->string('description');
            $table->foreignId('category_id')->constrained('transaction_categories');
            $table->bigInteger('amount');
            $table->text('notes')->nullable();
            $table->integer('quantity')->default(1);
            $table->bigInteger('unit_price')->nullable();

            $table->timestamps();

            // Indexes
            $table->index('fund_request_id');
            $table->index('category_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fund_request_items');
    }
};
