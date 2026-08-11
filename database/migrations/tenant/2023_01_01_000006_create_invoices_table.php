<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number')->unique();
            $table->foreignId('billed_to_id')->constrained('clients')->onDelete('cascade');
            $table->bigInteger('subtotal')->default(0); // Store in cents/rupiah
            $table->bigInteger('discount_amount')->default(0);
            $table->string('discount_type')->default('fixed'); // 'fixed' or 'percentage'
            $table->bigInteger('discount_value')->default(0); // For fixed: amount in rupiah, for percentage: value * 100 (e.g., 1500 = 15.00%)
            $table->text('discount_reason')->nullable();
            $table->bigInteger('total_amount');
            $table->date('issue_date');
            $table->date('due_date');
            $table->enum('status', ['draft', 'sent', 'paid', 'partially_paid', 'overdue'])
                ->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
