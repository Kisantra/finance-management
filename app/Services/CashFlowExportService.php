<?php

namespace App\Services;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\CompanyProfile;
use App\Models\Payment;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class CashFlowExportService
{
    /**
     * Generate Cash Flow PDF Report
     *
     * @param  array<int,int>|null  $bankAccountIds
     */
    public function generatePdf(
        ?array $bankAccountIds = null,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $month = null,
        ?string $year = null
    ) {
        $data = $this->buildReportData($bankAccountIds, $startDate, $endDate, $month, $year);

        ini_set('memory_limit', '1024M');
        set_time_limit(300);

        $pdf = Pdf::loadView('pdf.cash-flow-report', $data);
        $pdf->setPaper('a4', 'portrait');

        return $pdf;
    }

    /**
     * Build the dataset used by the PDF template.
     *
     * @param  array<int,int>|null  $bankAccountIds
     * @return array<string,mixed>
     */
    public function buildReportData(
        ?array $bankAccountIds = null,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $month = null,
        ?string $year = null
    ): array {
        if ($startDate && $endDate) {
            $start = Carbon::parse($startDate)->startOfDay();
            $end = Carbon::parse($endDate)->endOfDay();
            $periodText = $start->format('d/m/Y').' - '.$end->format('d/m/Y');
        } elseif ($month || $year) {
            $month = $month ?: now()->format('m');
            $year = $year ?: now()->format('Y');
            $start = Carbon::createFromDate($year, $month, 1)->startOfMonth();
            $end = Carbon::createFromDate($year, $month, 1)->endOfMonth();
            $periodText = $this->getIndonesianMonth((int) $month).' '.$year;
        } else {
            $earliest = collect([
                BankTransaction::min('transaction_date'),
                Payment::min('payment_date'),
            ])->filter()->min();
            // Ujung akhir dulu dipatok hari ini, sehingga transaksi bertanggal
            // ke depan tidak ikut — padahal saldo rekening menjumlahkan SEMUA
            // transaksi tanpa batas tanggal. Akibatnya laporan berlabel "SEMUA
            // WAKTU" berakhir pada angka yang berbeda dari saldo rekening.
            $latest = collect([
                BankTransaction::max('transaction_date'),
                Payment::max('payment_date'),
            ])->filter()->max();

            $start = $earliest ? Carbon::parse($earliest)->startOfDay() : now()->startOfDay();
            $end = $latest ? Carbon::parse($latest)->endOfDay()->max(now()->endOfDay()) : now()->endOfDay();
            $periodText = 'SEMUA WAKTU';
        }

        $company = CompanyProfile::current();

        $bankAccount = ($bankAccountIds && count($bankAccountIds) === 1)
            ? BankAccount::find($bankAccountIds[0])
            : null;

        $transactions = $this->getTransactionsForDateRange($bankAccountIds, $start, $end);

        $openingBalance = $this->getBalanceBeforeDate($bankAccountIds, $start);

        return [
            'company' => $company,
            'bankAccount' => $bankAccount,
            'periodText' => $periodText,
            'startDate' => $start,
            'endDate' => $end,
            'openingBalance' => $openingBalance,
            'transactions' => $transactions,
            'closingBalance' => $this->calculateClosingBalance($openingBalance, $transactions),
        ];
    }

    /**
     * Get all transactions for a date range
     *
     * @param  array<int,int>|null  $bankAccountIds
     */
    private function getTransactionsForDateRange(?array $bankAccountIds, Carbon $startDate, Carbon $endDate)
    {
        $bankTransactionsQuery = BankTransaction::with(['category.parent', 'bankAccount'])
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->orderBy('transaction_date')
            ->orderBy('id');

        if ($bankAccountIds) {
            $bankTransactionsQuery->whereIn('bank_account_id', $bankAccountIds);
        }

        $bankTransactions = $bankTransactionsQuery->get()->map(function ($transaction) {
            return [
                'date' => $transaction->transaction_date,
                'description' => $transaction->description,
                'category' => $transaction->category?->full_path ?? '-',
                'credit' => $transaction->transaction_type === 'credit' ? $transaction->amount : 0,
                'debit' => $transaction->transaction_type === 'debit' ? $transaction->amount : 0,
                'type' => 'transaction',
            ];
        });

        $paymentsQuery = Payment::with(['invoice.client', 'bankAccount'])
            ->whereBetween('payment_date', [$startDate, $endDate])
            ->orderBy('payment_date')
            ->orderBy('id');

        if ($bankAccountIds) {
            $paymentsQuery->whereIn('bank_account_id', $bankAccountIds);
        }

        $payments = $paymentsQuery->get()->map(function ($payment) {
            return [
                'date' => $payment->payment_date,
                'description' => 'PENGAJUAN DANA NO. '.($payment->invoice?->invoice_number ?? '-'),
                'category' => 'Pembayaran Invoice - '.($payment->invoice?->client?->name ?? ''),
                'credit' => $payment->amount,
                'debit' => 0,
                'type' => 'payment',
            ];
        });

        return $bankTransactions->concat($payments)->sortBy('date')->values();
    }

    /**
     * Calculate opening balance (balance before start date)
     * Formula from BankAccount model: initial_balance + payments + credits - debits
     *
     * @param  array<int,int>|null  $bankAccountIds
     */
    private function getBalanceBeforeDate(?array $bankAccountIds, Carbon $beforeDate): int
    {
        $initialQuery = BankAccount::query();

        $creditQuery = BankTransaction::where('transaction_type', 'credit')
            ->where('transaction_date', '<', $beforeDate);

        $debitQuery = BankTransaction::where('transaction_type', 'debit')
            ->where('transaction_date', '<', $beforeDate);

        $paymentsQuery = Payment::where('payment_date', '<', $beforeDate);

        if ($bankAccountIds) {
            $initialQuery->whereIn('id', $bankAccountIds);
            $creditQuery->whereIn('bank_account_id', $bankAccountIds);
            $debitQuery->whereIn('bank_account_id', $bankAccountIds);
            $paymentsQuery->whereIn('bank_account_id', $bankAccountIds);
        }

        return (int) $initialQuery->sum('initial_balance')
            + (int) $paymentsQuery->sum('amount')
            + (int) $creditQuery->sum('amount')
            - (int) $debitQuery->sum('amount');
    }

    /**
     * Calculate closing balance
     */
    private function calculateClosingBalance(int $openingBalance, $transactions): int
    {
        $balance = $openingBalance;

        foreach ($transactions as $transaction) {
            $balance += $transaction['credit'];
            $balance -= $transaction['debit'];
        }

        return $balance;
    }

    /**
     * Get Indonesian month name
     */
    private function getIndonesianMonth(int $month): string
    {
        $months = [
            1 => 'JANUARI',
            2 => 'FEBRUARI',
            3 => 'MARET',
            4 => 'APRIL',
            5 => 'MEI',
            6 => 'JUNI',
            7 => 'JULI',
            8 => 'AGUSTUS',
            9 => 'SEPTEMBER',
            10 => 'OKTOBER',
            11 => 'NOVEMBER',
            12 => 'DESEMBER',
        ];

        return $months[$month] ?? '';
    }
}
