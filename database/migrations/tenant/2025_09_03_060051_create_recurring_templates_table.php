<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recurring_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->string('template_name');
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('frequency', ['monthly', 'quarterly', 'semi_annual', 'annual'])->default('monthly');
            $table->date('next_generation_date');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->json('invoice_template'); // stores items, pricing, discount, etc.
            $table->timestamps();

            $table->index(['client_id', 'status']);
            $table->index('next_generation_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurring_templates');
    }
};
