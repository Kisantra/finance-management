<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recurring_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('recurring_templates')->onDelete('cascade');
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->date('scheduled_date');
            $table->json('invoice_data'); // snapshot of invoice data
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->foreignId('published_invoice_id')->nullable()->constrained('invoices')->onDelete('set null');
            $table->timestamps();

            $table->index(['template_id', 'status']);
            $table->index(['scheduled_date', 'status']);
            $table->index('client_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurring_invoices');
    }
};
