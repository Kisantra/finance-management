<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Add payment tracking to reimbursements
        Schema::table('reimbursements', function (Blueprint $table) {
            $table->bigInteger('amount_paid')->default(0)->after('amount');
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid')->after('status');

            $table->index('payment_status');
        });

        // Drop foreign keys first
        Schema::table('reimbursements', function (Blueprint $table) {
            $table->dropForeign(['bank_transaction_id']);
        });

        // Then drop columns
        Schema::table('reimbursements', function (Blueprint $table) {
            $table->dropColumn(['paid_by', 'paid_at', 'bank_transaction_id']);
        });

        // Create payment history table
        Schema::create('reimbursement_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reimbursement_id')->constrained()->onDelete('cascade');
            $table->foreignId('bank_transaction_id')->constrained()->onDelete('cascade');
            $table->bigInteger('amount');
            $table->date('payment_date');
            $table->text('notes')->nullable();
            $table->foreignId('paid_by')->index(); // users di DB central — tanpa FK lintas database
            $table->timestamps();

            $table->index(['reimbursement_id', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reimbursement_payments');

        Schema::table('reimbursements', function (Blueprint $table) {
            $table->dropColumn(['amount_paid', 'payment_status']);

            // Restore old columns
            $table->foreignId('paid_by')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('bank_transaction_id')->nullable()->constrained('bank_transactions')->nullOnDelete();
        });
    }
};