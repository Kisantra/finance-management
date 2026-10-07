<?php

namespace App\Http\Controllers;

use App\Http\Requests\DashboardChartRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    private const PENDING = ['sent', 'partially_paid', 'overdue'];

    public function __invoke(DashboardChartRequest $request): Response|RedirectResponse
    {
        // Dashboard is a togglable permission; roles without it land on Pengeluaran.
        if (! auth()->user()?->can('view dashboard')) {
            return redirect()->route('cash-flow.expenses');
        }

        $today = Carbon::today();
        $start = $today->copy()->startOfMonth();
        $end = $today->copy()->endOfMonth();
        $chart = $request->chart();

        return Inertia::render('dashboard', [
            'generatedAt' => Carbon::now()->format('H.i'),
            'period' => [
                'from' => $start->format('Y-m-d'),
                'to' => $today->format('Y-m-d'),
                'label' => $start->day.'–'.$today->translatedFormat('j M Y'),
            ],
            'financialOverview' => $this->getFinancialOverview(),
            'stats' => $this->getStats($start, $end),
            // Lazy prop: partial reload dari pil periode / filter rekening hanya menghitung blok ini.
            'cashFlowChart' => fn () => $this->getCashFlowChart($chart),
            'accountOptions' => BankAccount::orderBy('account_name')->get(['id', 'account_name', 'bank_name'])
                ->map(fn ($a) => ['id' => $a->id, 'label' => $a->bank_name.' · '.$a->account_name])
                ->values()
                ->toArray(),
            'expensesByCategory' => $this->getByCategory('debit', $start, $end),
            'incomeByCategory' => $this->getByCategory('credit', $start, $end),
            'bankAccounts' => $this->getBankAccounts(),
            'pendingInvoices' => $this->getPendingInvoices(),
            'recentTransactions' => $this->getRecentTransactions(),
        ]);
    }

    /**
     * Invarian pemasukan (docs/module/dashboard.md): kredit bank + pembayaran invoice,
     * konsisten dengan rumus saldo rekening. Pengeluaran = debit bank.
     */
    private function getStats(Carbon $start, Carbon $end): array
    {
        $totalBalance = BankAccount::all()->sum(fn ($a) => $a->balance);

        $income = BankTransaction::where('transaction_type', 'credit')
            ->whereBetween('transaction_date', [$start, $end])
            ->sum('amount')
            + Payment::whereBetween('payment_date', [$start, $end])->sum('amount');

        $expenses = BankTransaction::where('transaction_type', 'debit')
            ->whereBetween('transaction_date', [$start, $end])
            ->sum('amount');

        $pendingCount = Invoice::whereIn('status', self::PENDING)->count();
        $pendingTotal = Invoice::whereIn('status', self::PENDING)->sum('total_amount');
        $pendingPaid = Payment::whereHas('invoice', fn ($q) => $q->whereIn('status', self::PENDING))->sum('amount');

        return [
            'total_balance' => $totalBalance,
            'income_this_month' => (int) $income,
            'expenses_this_month' => (int) $expenses,
            'net_this_month' => (int) ($income - $expenses),
            'pending_invoices_count' => $pendingCount,
            'pending_invoices_amount' => (int) max(0, $pendingTotal - $pendingPaid),
        ];
    }

    /**
     * Grafik arus kas dengan bucket adaptif. Satu query per sumber; penjumlahan per bucket
     * dilakukan di PHP supaya sama di MySQL dan SQLite.
     *
     * @param  array{period: string, from: Carbon|null, to: Carbon|null, account: int|null}  $chart
     */
    private function getCashFlowChart(array $chart): array
    {
        $today = Carbon::today();
        [$buckets, $granularity] = $this->chartBuckets($chart, $today);

        $from = $buckets[0]['from'];
        $to = end($buckets)['to'];
        $account = $chart['account'];

        $credits = BankTransaction::query()
            ->where('transaction_type', 'credit')
            ->whereBetween('transaction_date', [$from, $to])
            ->when($account, fn ($q) => $q->where('bank_account_id', $account))
            ->get(['transaction_date', 'amount']);

        $debits = BankTransaction::query()
            ->where('transaction_type', 'debit')
            ->whereBetween('transaction_date', [$from, $to])
            ->when($account, fn ($q) => $q->where('bank_account_id', $account))
            ->get(['transaction_date', 'amount']);

        $payments = Payment::query()
            ->whereBetween('payment_date', [$from, $to])
            ->when($account, fn ($q) => $q->where('bank_account_id', $account))
            ->get(['payment_date', 'amount']);

        $income = array_fill(0, count($buckets), 0);
        $expenses = array_fill(0, count($buckets), 0);

        $place = function (Carbon $date, int $amount, array &$series) use ($buckets) {
            foreach ($buckets as $i => $b) {
                if ($date->betweenIncluded($b['from'], $b['to'])) {
                    $series[$i] += $amount;

                    return;
                }
            }
        };

        foreach ($credits as $row) {
            $place(Carbon::parse($row->transaction_date), (int) $row->amount, $income);
        }
        foreach ($payments as $row) {
            $place(Carbon::parse($row->payment_date), (int) $row->amount, $income);
        }
        foreach ($debits as $row) {
            $place(Carbon::parse($row->transaction_date), (int) $row->amount, $expenses);
        }

        $accountModel = $account ? BankAccount::find($account) : null;

        return [
            'period' => $chart['period'],
            'granularity' => $granularity,
            'range' => ['from' => $from->format('Y-m-d'), 'to' => $to->format('Y-m-d')],
            'account' => $accountModel
                ? ['id' => $accountModel->id, 'label' => $accountModel->bank_name.' · '.$accountModel->account_name]
                : null,
            'labels' => array_column($buckets, 'label'),
            'income' => $income,
            'expenses' => $expenses,
        ];
    }

    /**
     * @param  array{period: string, from: Carbon|null, to: Carbon|null, account: int|null}  $chart
     * @return array{0: list<array{from: Carbon, to: Carbon, label: string}>, 1: string}
     */
    private function chartBuckets(array $chart, Carbon $today): array
    {
        $year = $today->year;

        switch ($chart['period']) {
            case 'weekly':
                $start = $today->copy()->startOfWeek(Carbon::MONDAY)->subWeeks(11);

                return [$this->weekBuckets($start, $today->copy()->endOfWeek(Carbon::SUNDAY)), 'weekly'];

            case 'yearly':
                $buckets = [];
                for ($i = 4; $i >= 0; $i--) {
                    $y = $today->copy()->subYears($i);
                    $buckets[] = ['from' => $y->copy()->startOfYear(), 'to' => $y->copy()->endOfYear(), 'label' => (string) $y->year];
                }

                return [$buckets, 'yearly'];

            case 'range':
                $from = $chart['from'];
                $to = $chart['to']->copy()->endOfDay();
                $days = (int) $from->diffInDays($chart['to']) + 1;

                if ($days <= 31) {
                    $buckets = [];
                    foreach (CarbonPeriod::create($from, $chart['to']) as $day) {
                        $buckets[] = ['from' => $day->copy()->startOfDay(), 'to' => $day->copy()->endOfDay(), 'label' => $day->translatedFormat('j M')];
                    }

                    return [$buckets, 'daily'];
                }
                if ($days <= 26 * 7) {
                    return [$this->weekBuckets($from->copy()->startOfWeek(Carbon::MONDAY), $to), 'weekly'];
                }

                return [$this->monthBuckets($from->copy()->startOfMonth(), $to, $year), 'monthly'];

            default:
                return [$this->monthBuckets($today->copy()->subMonths(5)->startOfMonth(), $today->copy()->endOfMonth(), $year), 'monthly'];
        }
    }

    /** @return list<array{from: Carbon, to: Carbon, label: string}> */
    private function weekBuckets(Carbon $start, Carbon $end): array
    {
        $buckets = [];
        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addWeek()) {
            $weekEnd = $cursor->copy()->endOfWeek(Carbon::SUNDAY);
            $label = $cursor->month === $weekEnd->month
                ? $cursor->day.'–'.$weekEnd->translatedFormat('j M')
                : $cursor->translatedFormat('j M').'–'.$weekEnd->translatedFormat('j M');
            $buckets[] = ['from' => $cursor->copy()->startOfDay(), 'to' => $weekEnd, 'label' => $label];
        }

        return $buckets;
    }

    /** @return list<array{from: Carbon, to: Carbon, label: string}> */
    private function monthBuckets(Carbon $start, Carbon $end, int $currentYear): array
    {
        $buckets = [];
        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addMonth()) {
            // Label lintas tahun memakai "Des 25" agar bulan lampau tidak tertukar.
            $label = $cursor->year === $currentYear
                ? $cursor->translatedFormat('M')
                : $cursor->translatedFormat('M y');
            $buckets[] = ['from' => $cursor->copy()->startOfMonth(), 'to' => $cursor->copy()->endOfMonth(), 'label' => $label];
        }

        return $buckets;
    }

    /**
     * Rincian per kategori untuk tab Pengeluaran (debit) / Pemasukan (kredit): 4 terbesar + "Lainnya".
     * Pemasukan menyertakan pembayaran invoice sebagai satu kategori, sama dengan rumus pemasukan
     * di kartu Arus Kas (kredit bank + pembayaran invoice).
     *
     * @return list<array{name: string, value: int}>
     */
    private function getByCategory(string $type, Carbon $start, Carbon $end): array
    {
        $grouped = BankTransaction::where('transaction_type', $type)
            ->whereBetween('transaction_date', [$start, $end])
            ->whereNotNull('category_id')
            ->with('category')
            ->get()
            ->groupBy('category_id')
            ->map(fn ($group) => [
                'name' => $group->first()->category->label ?? 'Lainnya',
                'value' => (int) $group->sum('amount'),
            ])
            ->values();

        if ($type === 'credit') {
            $payments = (int) Payment::whereBetween('payment_date', [$start, $end])->sum('amount');
            if ($payments > 0) {
                $grouped->push(['name' => 'Pembayaran invoice', 'value' => $payments]);
            }
        }

        $grouped = $grouped->sortByDesc('value')->values();
        $top = $grouped->take(4);
        $rest = $grouped->slice(4)->sum('value');

        $uncategorized = (int) BankTransaction::where('transaction_type', $type)
            ->whereBetween('transaction_date', [$start, $end])
            ->whereNull('category_id')
            ->sum('amount');

        $other = $rest + $uncategorized;
        if ($other > 0) {
            $top->push(['name' => $rest > 0 ? 'Lainnya' : 'Tanpa kategori', 'value' => $other]);
        }

        return $top->values()->toArray();
    }

    private function getBankAccounts(): array
    {
        return BankAccount::all()
            ->map(fn ($a) => [
                'id' => $a->id,
                'name' => $a->account_name,
                'bank' => $a->bank_name,
                'account_number' => $a->account_number,
                'balance' => $a->balance,
            ])
            ->sortByDesc('balance')
            ->values()
            ->toArray();
    }

    private function getPendingInvoices(): array
    {
        $today = Carbon::today();

        return Invoice::with('client')
            ->whereIn('status', self::PENDING)
            ->orderBy('due_date')
            ->take(5)
            ->get()
            ->map(function ($invoice) use ($today) {
                $paid = (int) Payment::where('invoice_id', $invoice->id)->sum('amount');
                $days = $invoice->due_date ? (int) $today->diffInDays($invoice->due_date, false) : null;

                return [
                    'id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'client' => $invoice->client->name,
                    'total_amount' => (int) $invoice->total_amount,
                    'paid' => $paid,
                    'remaining' => (int) $invoice->total_amount - $paid,
                    'due_date' => $invoice->due_date?->format('Y-m-d'),
                    'status' => $days !== null && $days < 0 ? 'overdue' : $invoice->status,
                    'days_until_due' => $days,
                ];
            })
            ->toArray();
    }

    private function getFinancialOverview(): array
    {
        $totalIncome = Payment::sum('amount');

        $totalHpp = InvoiceItem::whereHas('invoice', fn ($q) => $q->whereIn('status', ['partially_paid', 'paid'])
        )->sum('cogs_amount');

        $pendingTotal = Invoice::whereIn('status', self::PENDING)->sum('total_amount');
        $pendingPaid = Payment::whereHas('invoice', fn ($q) => $q->whereIn('status', self::PENDING)
        )->sum('amount');

        $ppBase = InvoiceItem::whereHas('invoice', fn ($q) => $q->whereIn('status', ['partially_paid', 'paid'])
        )->where('is_tax_deposit', false)->sum('amount');

        return [
            'total_income' => (int) $totalIncome,
            'total_profit' => (int) ($totalIncome - $totalHpp),
            'total_outstanding' => (int) max(0, $pendingTotal - $pendingPaid),
            'total_hpp' => (int) $totalHpp,
            'total_pp' => (int) round($ppBase * 0.005),
            'total_balance' => BankAccount::all()->sum(fn ($a) => $a->balance),
        ];
    }

    private function getRecentTransactions(): array
    {
        $bankTx = BankTransaction::with(['category', 'bankAccount'])
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->take(8)
            ->get()
            ->map(fn ($tx) => [
                'date' => $tx->transaction_date?->format('Y-m-d'),
                'description' => $tx->description ?: ($tx->category->label ?? 'Transaksi bank'),
                'type' => $tx->transaction_type === 'credit' ? 'income' : 'expense',
                'amount' => (int) $tx->amount,
                'account' => $tx->bankAccount->account_name ?? '-',
            ]);

        $payments = Payment::with(['invoice.client', 'bankAccount'])
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->take(8)
            ->get()
            ->map(fn ($p) => [
                'date' => $p->payment_date?->format('Y-m-d'),
                'description' => 'Pembayaran '.($p->invoice->invoice_number ?? 'invoice').' · '.$p->invoice->client->name,
                'type' => 'income',
                'amount' => (int) $p->amount,
                'account' => $p->bankAccount->account_name ?? '-',
            ]);

        return $bankTx->concat($payments)
            ->sortByDesc('date')
            ->take(8)
            ->values()
            ->toArray();
    }
}
