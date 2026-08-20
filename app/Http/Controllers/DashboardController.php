<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\FundRequest;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\Reimbursement;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response|RedirectResponse
    {
        if (! auth()->user()?->can('view dashboard')) {
            return $this->redirectToFirstAllowedModule();
        }

        $start = Carbon::now()->startOfMonth();
        $end = Carbon::now()->endOfMonth();

        return Inertia::render('dashboard', [
            'financialOverview' => $this->getFinancialOverview(),
            'stats' => $this->getStats($start, $end),
            'cashFlowChart' => $this->getCashFlowChart(),
            'expensesByCategory' => $this->getExpensesByCategory($start, $end),
            'bankAccounts' => $this->getBankAccounts(),
            'pendingInvoices' => $this->getPendingInvoices(),
            'recentTransactions' => $this->getRecentTransactions(),
            'recentReimbursements' => $this->getRecentReimbursements(),
            'recentFundRequests' => $this->getRecentFundRequests(),
        ]);
    }

    /**
     * Antar user tanpa `view dashboard` ke modul pertama yang benar-benar boleh
     * ia buka.
     *
     * Sebelumnya redirect dipatok ke Pengeluaran. Kombinasi permission yang sah —
     * tanpa `view dashboard` dan tanpa `view expense` — membuat user terkunci
     * total setelah login berhasil: setiap jalur pendaratan berakhir 403, bahkan
     * saat ia berhak membuka modul lain. Urutan di bawah menentukan prioritas
     * pendaratan; bila tidak ada satu pun yang cocok, barulah 403 muncul — dan
     * kali itu memang benar, karena user itu tidak berhak atas apa pun.
     *
     * @var list<array{0: string, 1: string}>
     */
    private const MODUL_PENDARATAN = [
        ['view expense', 'cash-flow.expenses'],
        ['view income', 'cash-flow.income'],
        ['view invoices', 'invoices.index'],
        ['view clients', 'clients'],
        ['view services', 'services'],
        ['view bank-accounts', 'bank-accounts.index'],
        ['view reimbursements', 'reimbursements.index'],
        ['view fund-requests', 'fund-requests.index'],
        ['view receivables', 'receivables.index'],
        ['view loans', 'loans.index'],
        ['view profit-loss', 'reports.profit-loss'],
        ['view feedbacks', 'feedbacks.index'],
    ];

    private function redirectToFirstAllowedModule(): RedirectResponse
    {
        $user = auth()->user();

        foreach (self::MODUL_PENDARATAN as [$permission, $route]) {
            if ($user?->can($permission)) {
                return redirect()->route($route);
            }
        }

        abort(403, 'Akun Anda belum memiliki akses ke modul mana pun. Hubungi administrator.');
    }

    private function getStats(Carbon $start, Carbon $end): array
    {
        $totalBalance = BankAccount::all()->sum(fn ($a) => $a->balance);

        $income = BankTransaction::where('transaction_type', 'credit')
            ->whereBetween('transaction_date', [$start, $end])
            ->sum('amount');

        $expenses = BankTransaction::where('transaction_type', 'debit')
            ->whereBetween('transaction_date', [$start, $end])
            ->sum('amount');

        $pendingInvoices = Invoice::whereIn('status', ['sent', 'partially_paid', 'overdue']);
        $pendingCount = (clone $pendingInvoices)->count();
        $pendingTotal = (clone $pendingInvoices)->sum('total_amount');
        $pendingPaid = Payment::whereHas('invoice', fn ($q) => $q->whereIn('status', ['sent', 'partially_paid', 'overdue']))->sum('amount');

        // Agregat SQL kembali sebagai string sedangkan hasil aritmetika PHP sebagai
        // integer; tanpa cast, satu objek yang sama mengirim dua tipe berbeda dan
        // perbandingan ketat di TypeScript berperilaku beda antar-field.
        return [
            'total_balance' => (int) $totalBalance,
            'income_this_month' => (int) $income,
            'expenses_this_month' => (int) $expenses,
            'net_this_month' => (int) $income - (int) $expenses,
            'pending_invoices_count' => (int) $pendingCount,
            'pending_invoices_amount' => (int) $pendingTotal - (int) $pendingPaid,
        ];
    }

    private function getCashFlowChart(): array
    {
        $data = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = Carbon::now()->subMonths($i);
            $data[] = [
                'label' => $month->translatedFormat('M'),
                'income' => (int) BankTransaction::where('transaction_type', 'credit')
                    ->whereMonth('transaction_date', $month->month)
                    ->whereYear('transaction_date', $month->year)
                    ->sum('amount'),
                'expenses' => (int) BankTransaction::where('transaction_type', 'debit')
                    ->whereMonth('transaction_date', $month->month)
                    ->whereYear('transaction_date', $month->year)
                    ->sum('amount'),
            ];
        }

        return $data;
    }

    private function getExpensesByCategory(Carbon $start, Carbon $end): array
    {
        $colors = ['#2563eb', '#16a34a', '#f59e0b', '#a855f7', '#0ea5e9', '#9ca3af'];

        $grouped = BankTransaction::where('transaction_type', 'debit')
            ->whereBetween('transaction_date', [$start, $end])
            ->whereNotNull('category_id')
            ->with('category')
            ->get()
            ->groupBy('category_id')
            ->map(fn ($group) => [
                'name' => $group->first()->category->label ?? 'Lainnya',
                'value' => (int) $group->sum('amount'),
            ])
            ->sortByDesc('value')
            ->take(5)
            ->values()
            ->toArray();

        $uncategorized = BankTransaction::where('transaction_type', 'debit')
            ->whereBetween('transaction_date', [$start, $end])
            ->whereNull('category_id')
            ->sum('amount');

        if ($uncategorized > 0) {
            $grouped[] = ['name' => 'Tanpa Kategori', 'value' => (int) $uncategorized];
        }

        return collect($grouped)
            ->map(fn ($item, $i) => array_merge($item, ['color' => $colors[$i % count($colors)]]))
            ->values()
            ->toArray();
    }

    private function getBankAccounts(): array
    {
        return BankAccount::all()
            ->map(fn ($a) => [
                'id' => $a->id,
                'name' => $a->account_name,
                'bank' => $a->bank_name,
                'account_number' => $a->account_number,
                'balance' => (int) $a->balance,
            ])
            ->sortByDesc('balance')
            ->values()
            ->toArray();
    }

    private function getPendingInvoices(): array
    {
        return Invoice::with('client')
            ->whereIn('status', ['sent', 'partially_paid', 'overdue'])
            ->orderBy('due_date')
            ->take(5)
            ->get()
            ->map(function ($invoice) {
                $paid = Payment::where('invoice_id', $invoice->id)->sum('amount');

                return [
                    'id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'client' => $invoice->client->name,
                    'amount' => $invoice->total_amount - $paid,
                    'due_date' => $invoice->due_date?->format('Y-m-d'),
                    'status' => $invoice->status,
                    'days_until_due' => Carbon::today()->diffInDays($invoice->due_date, false),
                ];
            })
            ->toArray();
    }

    private function getFinancialOverview(): array
    {
        $totalIncome = Payment::sum('amount');

        $totalHpp = InvoiceItem::whereHas('invoice', fn ($q) => $q->whereIn('status', ['partially_paid', 'paid'])
        )->sum('cogs_amount');

        $pendingTotal = Invoice::whereIn('status', ['sent', 'partially_paid', 'overdue'])->sum('total_amount');
        $pendingPaid = Payment::whereHas('invoice', fn ($q) => $q->whereIn('status', ['sent', 'partially_paid', 'overdue'])
        )->sum('amount');

        $ppBase = InvoiceItem::whereHas('invoice', fn ($q) => $q->whereIn('status', ['partially_paid', 'paid'])
        )->where('is_tax_deposit', false)->sum('amount');

        return [
            'total_income' => (int) $totalIncome,
            'total_profit' => (int) $totalIncome - (int) $totalHpp,
            'total_outstanding' => max(0, (int) $pendingTotal - (int) $pendingPaid),
            'total_hpp' => (int) $totalHpp,
            'total_pp' => (int) round($ppBase * 0.005),
            'total_balance' => (int) BankAccount::all()->sum(fn ($a) => $a->balance),
        ];
    }

    private function getRecentReimbursements(): array
    {
        return Reimbursement::with('user')
            ->orderByDesc('created_at')
            ->take(5)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title,
                'amount' => $r->amount,
                'status' => $r->status,
                'user' => $r->user?->name ?? '-',
                'date' => $r->created_at->format('d M Y'),
            ])
            ->toArray();
    }

    private function getRecentFundRequests(): array
    {
        return FundRequest::with('user')
            ->orderByDesc('created_at')
            ->take(5)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'number' => $r->request_number,
                'title' => $r->title,
                'amount' => $r->total_amount,
                'status' => $r->status,
                'priority' => $r->priority,
                'user' => $r->user?->name ?? '-',
                'date' => $r->created_at->format('d M Y'),
            ])
            ->toArray();
    }

    private function getRecentTransactions(): array
    {
        $bankTx = BankTransaction::with(['category', 'bankAccount'])
            ->orderByDesc('transaction_date')
            ->take(8)
            ->get()
            ->map(fn ($tx) => [
                'date' => $tx->transaction_date?->format('Y-m-d'),
                'description' => $tx->description ?: ($tx->category->label ?? 'Transaksi Bank'),
                'type' => $tx->transaction_type === 'credit' ? 'income' : 'expense',
                'amount' => $tx->amount,
                'account' => $tx->bankAccount->account_name ?? '-',
            ]);

        $payments = Payment::with(['invoice.client', 'bankAccount'])
            ->orderByDesc('payment_date')
            ->take(5)
            ->get()
            ->map(fn ($p) => [
                'date' => $p->payment_date?->format('Y-m-d'),
                'description' => 'Pembayaran '.$p->invoice->invoice_number.' — '.$p->invoice->client->name,
                'type' => 'income',
                'amount' => $p->amount,
                'account' => $p->bankAccount->account_name ?? '-',
            ]);

        return $bankTx->concat($payments)
            ->sortByDesc('date')
            ->take(8)
            ->values()
            ->toArray();
    }
}
