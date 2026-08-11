<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reimbursements', function (Blueprint $table) {
            $table->id();

            // Requestor info
            $table->foreignId('user_id')->index(); // users di DB central — tanpa FK lintas database
            $table->string('title');
            $table->text('description')->nullable();

            // Financial details
            $table->bigInteger('amount'); // in rupiah (no decimals)
            $table->date('expense_date'); // when the expense occurred
            $table->string('category'); // transport, meals, office_supplies, etc.

            // Supporting documents
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();

            // Workflow status
            $table->enum('status', [
                'draft',      // created but not submitted
                'pending',    // submitted, waiting review
                'approved',   // approved by finance
                'rejected',   // rejected by finance
                'paid',        // payment completed
            ])->default('draft');

            // Approval tracking
            $table->foreignId('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable(); // reason for approval/rejection

            // Payment tracking
            $table->foreignId('paid_by')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('bank_transaction_id')->nullable()->constrained('bank_transactions')->nullOnDelete();

            $table->timestamps();

            // Indexes for common queries
            $table->index(['user_id', 'status']);
            $table->index('status');
            $table->index('expense_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reimbursements');
    }
};
