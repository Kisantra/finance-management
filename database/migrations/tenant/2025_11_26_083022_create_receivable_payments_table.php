<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receivable_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('receivable_id')->constrained()->cascadeOnDelete();
            $table->date('payment_date');
            $table->bigInteger('principal_paid');
            $table->bigInteger('interest_paid')->default(0);
            $table->bigInteger('total_paid');
            $table->enum('payment_method', ['cash', 'payroll_deduction', 'bank_transfer']);
            $table->string('reference_number')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('payment_date');
            $table->index(['receivable_id', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receivable_payments');
    }
};
