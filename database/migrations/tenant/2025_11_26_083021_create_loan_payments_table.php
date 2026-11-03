<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bank_account_id')->constrained();
            $table->date('payment_date');

            $table->bigInteger('principal_paid');
            $table->bigInteger('interest_paid');
            $table->bigInteger('total_paid');

            $table->string('reference_number')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('payment_date');
            $table->index(['loan_id', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_payments');
    }
};
