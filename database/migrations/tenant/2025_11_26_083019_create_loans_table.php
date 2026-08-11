<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->string('loan_number')->unique();
            $table->string('lender_name');
            $table->bigInteger('principal_amount');

            $table->enum('interest_type', ['fixed', 'percentage']);
            $table->bigInteger('interest_amount')->nullable();
            $table->decimal('interest_rate', 5, 2)->nullable();

            $table->integer('term_months');
            $table->date('start_date');
            $table->date('maturity_date');

            $table->enum('status', ['active', 'paid_off'])->default('active');
            $table->text('purpose')->nullable();
            $table->string('contract_attachment')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('start_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
