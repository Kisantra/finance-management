<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBankAccountRequest;
use App\Http\Requests\UpdateBankAccountRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BankAccountController extends Controller
{
    public function index(Request $request): Response
    {
        $selectedAccountId = $request->integer('account') ?: null;
        $selectedMonth = $request->input('month', '');

        // Load accounts with eager relationships for balance + trend calculation
        $accounts = BankAccount::with(['transactions', 'payments'])->get();

        // Batch trend calculation using already-loaded transactions (cross-database compatible)
        $thisMonthKey = now()->format('Y-n');
        $lastMonthKey = now()->subMonth()->format('Y-n');

        $accountsData = $accounts->map(function (BankAccount $account) use ($thisMonthKey, $lastMonthKey) {
            $credits = $account->transactions->where('transaction_type', 'credit');
            $thisMonthTotal = $credits
                ->filter(fn ($t) => date('Y-n', strtotime($t->transaction_date)) === $thisMonthKey)
                ->sum('amount');
            $lastMonthTotal = $credits
                ->filter(fn ($t) => date('Y-n', strtotime($t->transaction_date)) === $lastMonthKey)
                ->sum('amount');

            return [
                'id' => $account->id,
                'account_name' => $account->account_name,
                'account_number' => $account->account_number,
                'bank_name' => $account->bank_name,
                'branch' => $account->branch,
                'initial_balance' => $account->initial_balance,
                'balance' => $account->balance,
                'trend' => $thisMonthTotal >= $lastMonthTotal ? 'up' : 'down',
            ];
        });

        // Default selection — first account if none provided
        if (! $selectedAccountId && $accountsData->isNotEmpty()) {
            $selectedAccountId = $accountsData->first()['id'];
        }

        // Overall summary across ALL accounts (sidebar stats)
        $overallTrxStats = BankTransaction::selectRaw("
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as credit_total,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as debit_total
            ")->first();

        $overallSummary = [
            'total_balance' => (int) $accountsData->sum('balance'),
            'income' => (int) Payment::sum('amount') + (int) ($overallTrxStats->credit_total ?? 0),
            'expense' => (int) ($overallTrxStats->debit_total ?? 0),
        ];

        // Build per-account data (charts + stats) only when an account is selected
        $detail = $selectedAccountId
            ? $this->buildAccountDetail($selectedAccountId, $selectedMonth)
            : null;

        return Inertia::render('bank-accounts/index', [
            'accounts' => $accountsData,
            'overallSummary' => $overallSummary,
            'detail' => $detail,
            'filters' => [
                'account' => $selectedAccountId,
                'month' => $selectedMonth,
            ],
        ]);
    }

    public function store(StoreBankAccountRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $account = BankAccount::create([
            'account_name' => $validated['account_name'],
            'account_number' => $validated['account_number'],
            'bank_name' => $validated['bank_name'],
            'branch' => ($validated['branch'] ?? null) ?: null,
            'initial_balance' => $validated['initial_balance'],
        ]);

        return redirect()
            ->route('bank-accounts.index', ['account' => $account->id])
            ->with('success', __('pages.account_created_successfully'));
    }

    public function update(UpdateBankAccountRequest $request, BankAccount $bankAccount): RedirectResponse
    {
        $validated = $request->validated();

        $bankAccount->update([
            'account_name' => $validated['account_name'],
            'account_number' => $validated['account_number'],
            'bank_name' => $validated['bank_name'],
            'branch' => ($validated['branch'] ?? null) ?: null,
            'initial_balance' => $validated['initial_balance'],
        ]);

        return redirect()->back()->with('success', __('pages.account_updated_successfully'));
    }

    public function destroy(BankAccount $bankAccount): RedirectResponse
    {
        // FK cascade akan menghapus seluruh bank_transactions DAN payments milik
        // rekening ini. Pembayaran invoice yang lenyap tidak memicu
        // Invoice::updateStatus(), sehingga invoice tetap berstatus
        // "partially_paid" padahal pembayarannya sudah tidak ada — status bohong
        // yang merambat ke piutang dan Laporan Laba Rugi. Karena itu ditolak
        // selama masih ada data terkait, dengan menyebut apa saja yang menahan.
        $jumlahTransaksi = $bankAccount->transactions()->count();
        $jumlahPembayaran = $bankAccount->payments()->count();
        $jumlahPembayaranPinjaman = $bankAccount->loanPayments()->count();

        if ($jumlahTransaksi > 0 || $jumlahPembayaran > 0 || $jumlahPembayaranPinjaman > 0) {
            $bagian = [];
            if ($jumlahTransaksi > 0) {
                $contoh = $bankAccount->transactions()
                    ->orderByDesc('id')->limit(3)->pluck('description')->all();
                $bagian[] = $jumlahTransaksi.' transaksi ('.implode(', ', $contoh).
                    ($jumlahTransaksi > count($contoh) ? ', …' : '').')';
            }
            if ($jumlahPembayaran > 0) {
                $contoh = $bankAccount->payments()->with('invoice')
                    ->orderByDesc('id')->limit(3)->get()
                    ->map(fn ($p) => $p->invoice?->invoice_number ?: 'invoice #'.$p->invoice_id)->all();
                $bagian[] = $jumlahPembayaran.' pembayaran invoice ('.implode(', ', $contoh).
                    ($jumlahPembayaran > count($contoh) ? ', …' : '').')';
            }
            if ($jumlahPembayaranPinjaman > 0) {
                $bagian[] = $jumlahPembayaranPinjaman.' pembayaran utang';
            }

            return redirect()->back()->withErrors([
                'delete' => 'Rekening tidak dapat dihapus karena masih terkait dengan '.
                    implode(', ', $bagian).'. Pindahkan atau hapus data tersebut terlebih dahulu.',
            ]);
        }

        $bankAccount->delete();

        return redirect()
            ->route('bank-accounts.index')
            ->with('success', __('pages.account_deleted_successfully'));
    }

    /**
     * @return array<string,mixed>
     */
    private function buildAccountDetail(int $accountId, string $selectedMonth): array
    {
        // Resolve period — empty month = all time
        if ($selectedMonth !== '') {
            try {
                $date = Carbon::createFromFormat('Y-m', $selectedMonth);
                $start = $date->copy()->startOfMonth();
                $end = $date->copy()->endOfMonth();
                $period = [
                    'start' => $start->toDateString(),
                    'end' => $end->toDateString(),
                    'label' => $start->translatedFormat('F Y'),
                    'is_all_time' => false,
                ];
            } catch (\Exception $e) {
                $period = ['start' => null, 'end' => null, 'label' => __('pages.all_time'), 'is_all_time' => true];
            }
        } else {
            $period = ['start' => null, 'end' => null, 'label' => __('pages.all_time'), 'is_all_time' => true];
        }

        // Stats for the period
        $trxQuery = BankTransaction::where('bank_account_id', $accountId);
        $payQuery = Payment::where('bank_account_id', $accountId);

        if (! $period['is_all_time']) {
            $trxQuery->whereBetween('transaction_date', [$period['start'], $period['end']]);
            $payQuery->whereBetween('payment_date', [$period['start'], $period['end']]);
        }

        $trxStats = $trxQuery->selectRaw("
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as credit_total,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as debit_total,
                COUNT(*) as trx_count
            ")->first();

        $paymentsIncome = (int) $payQuery->sum('amount');
        $totalIncome = $paymentsIncome + (int) ($trxStats->credit_total ?? 0);
        $totalExpense = (int) ($trxStats->debit_total ?? 0);

        $stats = [
            'total_income' => $totalIncome,
            'total_expense' => $totalExpense,
            'net_cashflow' => $totalIncome - $totalExpense,
            'transaction_count' => (int) ($trxStats->trx_count ?? 0),
        ];

        // 12-month chart data — income vs expense
        $globalStart = now()->startOfMonth()->subMonths(11);
        $globalEnd = now()->endOfMonth();

        $paymentsByMonth = Payment::where('bank_account_id', $accountId)
            ->whereBetween('payment_date', [$globalStart, $globalEnd])
            ->get(['payment_date', 'amount'])
            ->groupBy(fn ($row) => date('Y', strtotime($row->payment_date)).'-'.(int) date('n', strtotime($row->payment_date)))
            ->map(fn ($rows) => (object) ['total' => $rows->sum('amount')]);

        $trxByMonth = BankTransaction::where('bank_account_id', $accountId)
            ->whereBetween('transaction_date', [$globalStart, $globalEnd])
            ->get(['transaction_date', 'transaction_type', 'amount'])
            ->groupBy(fn ($row) => date('Y', strtotime($row->transaction_date)).'-'.(int) date('n', strtotime($row->transaction_date)))
            ->map(fn ($rows) => (object) [
                'credit_total' => $rows->where('transaction_type', 'credit')->sum('amount'),
                'debit_total' => $rows->where('transaction_type', 'debit')->sum('amount'),
            ]);

        $chartMonths = [];
        for ($i = 0; $i < 12; $i++) {
            $month = $globalStart->copy()->addMonths($i);
            $key = $month->year.'-'.$month->month;
            $payIncome = (int) ($paymentsByMonth[$key]->total ?? 0);
            $creditIncome = (int) ($trxByMonth[$key]->credit_total ?? 0);
            $expense = (int) ($trxByMonth[$key]->debit_total ?? 0);

            $chartMonths[] = [
                'month' => $month->translatedFormat('M Y'),
                'income' => $payIncome + $creditIncome,
                'expense' => $expense,
            ];
        }

        // Category breakdown (donut)
        $categoryQuery = BankTransaction::query()
            ->where('bank_transactions.bank_account_id', $accountId)
            ->where('bank_transactions.transaction_type', 'debit')
            ->whereNotNull('bank_transactions.category_id')
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->selectRaw('transaction_categories.label as name, SUM(bank_transactions.amount) as total')
            ->groupBy('transaction_categories.id', 'transaction_categories.label')
            ->orderByDesc('total')
            ->limit(6);

        if (! $period['is_all_time']) {
            $categoryQuery->whereBetween('bank_transactions.transaction_date', [$period['start'], $period['end']]);
        }

        $categoryBreakdown = $categoryQuery->get()->map(fn ($row) => [
            'name' => $row->name,
            'total' => (int) $row->total,
        ])->toArray();

        return [
            'period' => $period,
            'stats' => $stats,
            'chart_months' => $chartMonths,
            'category_breakdown' => $categoryBreakdown,
        ];
    }
}
