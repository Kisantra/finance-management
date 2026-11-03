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
        // bank_transactions.transaction_date — dipakai WHERE + GROUP BY cashFlowChart
        Schema::table('bank_transactions', function (Blueprint $table) {
            $table->index('transaction_date', 'bank_transactions_transaction_date_index');
            // Composite: WHERE type + date range (incomeThisMonth, expensesThisMonth)
            $table->index(['transaction_type', 'transaction_date'], 'bank_transactions_type_date_index');
        });

        // invoices.status — dipakai WHERE pendingInvoicesList & pendingInvoicesAmount
        // invoices.due_date — dipakai ORDER BY pendingInvoicesList
        Schema::table('invoices', function (Blueprint $table) {
            $table->index('status', 'invoices_status_index');
            $table->index(['status', 'due_date'], 'invoices_status_due_date_index');
        });
    }

    public function down(): void
    {
        Schema::table('bank_transactions', function (Blueprint $table) {
            $table->dropIndex('bank_transactions_transaction_date_index');
            $table->dropIndex('bank_transactions_type_date_index');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_status_index');
            $table->dropIndex('invoices_status_due_date_index');
        });
    }
};
