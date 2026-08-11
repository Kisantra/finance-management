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
        Schema::create('fund_requests', function (Blueprint $table) {
            $table->id();

            // Requestor
            $table->foreignId('user_id')->index(); // users di DB central — tanpa FK lintas database

            // Request Header
            $table->string('title');
            $table->text('purpose');
            $table->bigInteger('total_amount')->default(0);

            // Priority & Deadline
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->date('needed_by_date');

            // Attachment (Supporting document)
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();

            // Status Tracking
            $table->enum('status', ['draft', 'pending', 'approved', 'rejected', 'disbursed'])->default('draft');

            // Review Tracking (Manager)
            $table->foreignId('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();

            // Disbursement Tracking (Finance)
            $table->foreignId('disbursed_by')->nullable();
            $table->timestamp('disbursed_at')->nullable();
            $table->date('disbursement_date')->nullable();
            $table->foreignId('bank_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->text('disbursement_notes')->nullable();

            $table->timestamps();

            // Indexes
            $table->index(['user_id', 'status']);
            $table->index('status');
            $table->index('priority');
            $table->index('needed_by_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fund_requests');
    }
};
