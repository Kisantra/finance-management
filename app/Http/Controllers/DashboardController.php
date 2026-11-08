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
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection as SupportCollection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Saldo seluruh rekening, dihitung sekali per request. Dulu `BankAccount::all()`
     * dipanggil tiga kali dan accessor `balance` menjalankan tiga query agregat per
     * rekening — 3 x (1 + 3N) query hanya untuk saldo.
     *
     * @var Collection<int, BankAccount>|null
     */
    private ?Collection $rekening = null;

    /** @return Collection<int, BankAccount> */
    private function rekening(): Collection
    {
        return $this->rekening ??= BankAccount::withBalance()->get();
    }

    private const PENDING = ['sent', 'partially_paid', 'overdue'];

    /** Irisan donat Pengeluaran untuk sisa debit transfer bertautan (jumlah + biaya admin − yang pindah). */
    private const BIAYA_ADMIN_TRANSFER = 'Biaya admin transfer';

    /**
     * Kelompok transfer antar akun sendiri per rentang (BankTransaction::internalTransferGroups()),
     * dipakai kartu Arus Kas dan kedua donat bulan berjalan: dihitung sekali per request.
     *
     * @var array<string, SupportCollection<int, object>>
     */
    private array $transferAntarAkun = [];

    /** @return SupportCollection<int, object{date: string, linked: string|null, category: string|null, credit: int, debit: int, internal: int}> */
    private function transferAntarAkun(Carbon $start, Carbon $end): SupportCollection
    {
        return $this->transferAntarAkun[$start->toDateTimeString().'|'.$end->toDateTimeString()]
            ??= BankTransaction::internalTransferGroups($start, $end);
    }

    public function __invoke(DashboardChartRequest $request): Response|RedirectResponse
    {
        if (! auth()->user()?->can('view dashboard')) {
            return $this->redirectToFirstAllowedModule();
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
        ['view fund requests', 'fund-requests.index'],
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

    /**
     * Invarian pemasukan (docs/module/dashboard.md): kredit bank + pembayaran invoice,
     * konsisten dengan rumus saldo rekening. Pengeluaran = debit bank. Transfer antar akun
     * sendiri dikurangkan dari kedua sisi (biaya adminnya tetap pengeluaran), sehingga
     * Pemasukan − Pengeluaran tetap = perubahan total saldo.
     */
    private function getStats(Carbon $start, Carbon $end): array
    {
        $totalBalance = (int) $this->rekening()->sum(fn ($a) => $a->balance);
        // Rincian Kas & Bank dari koleksi yang sama (withBalance, tanpa query tambahan).
        $totalCash = (int) $this->rekening()->filter(fn (BankAccount $a) => $a->isCash())->sum(fn ($a) => $a->balance);

        $pindahAntarAkun = (int) $this->transferAntarAkun($start, $end)->sum('internal');

        $income = (int) BankTransaction::where('transaction_type', 'credit')
            ->whereBetween('transaction_date', [$start, $end])
            ->sum('amount')
            + (int) Payment::whereBetween('payment_date', [$start, $end])->sum('amount')
            - $pindahAntarAkun;

        $expenses = (int) BankTransaction::where('transaction_type', 'debit')
            ->whereBetween('transaction_date', [$start, $end])
            ->sum('amount')
            - $pindahAntarAkun;

        $pendingCount = Invoice::whereIn('status', self::PENDING)->count();
        $pendingTotal = Invoice::whereIn('status', self::PENDING)->sum('total_amount');
        $pendingPaid = Payment::whereHas('invoice', fn ($q) => $q->whereIn('status', self::PENDING))->sum('amount');

        // Agregat SQL kembali sebagai string sedangkan hasil aritmetika PHP sebagai
        // integer; tanpa cast, satu objek yang sama mengirim dua tipe berbeda dan
        // perbandingan ketat di TypeScript berperilaku beda antar-field.
        return [
            'total_balance' => $totalBalance,
            'total_bank' => $totalBalance - $totalCash,
            'total_cash' => $totalCash,
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

        // Semua rekening: transfer antar akun sendiri bukan pemasukan/pengeluaran (sama dengan kartu
        // Arus Kas). Dengan filter satu rekening transfer tetap dihitung: bagi rekening itu, uangnya
        // memang masuk/keluar.
        if (! $account) {
            foreach (BankTransaction::internalTransferGroups($from, $to) as $group) {
                $place(Carbon::parse($group->date), -$group->internal, $income);
                $place(Carbon::parse($group->date), -$group->internal, $expenses);
            }
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
     * Kaki transfer (kategori bertipe transfer) tidak dijumlah per baris: dari tiap kelompok
     * transfer hanya sisanya setelah yang pindah antar akun dikurangkan — biaya admin pada transfer
     * bertautan menjadi irisan "Biaya admin transfer", kaki tanpa lawan tetap di kategorinya. Jumlah
     * irisan tetap sama dengan angka Pemasukan/Pengeluaran di kartu Arus Kas.
     *
     * @return list<array{name: string, value: int}>
     */
    private function getByCategory(string $type, Carbon $start, Carbon $end): array
    {
        $grouped = BankTransaction::where('transaction_type', $type)
            ->whereBetween('transaction_date', [$start, $end])
            ->whereNotNull('category_id')
            ->whereHas('category', fn ($q) => $q->where('type', '!=', 'transfer'))
            ->with('category')
            ->get()
            ->groupBy('category_id')
            ->map(fn ($group) => [
                'name' => $group->first()->category->label ?? 'Lainnya',
                'value' => (int) $group->sum('amount'),
            ])
            ->values();

        $sisaTransfer = [];
        foreach ($this->transferAntarAkun($start, $end) as $group) {
            $sisa = ($type === 'debit' ? $group->debit : $group->credit) - $group->internal;
            if ($sisa <= 0) {
                continue;
            }

            $biayaAdmin = $type === 'debit' && $group->linked !== null && $group->credit > 0;
            $nama = $biayaAdmin ? self::BIAYA_ADMIN_TRANSFER : ($group->category ?? 'Lainnya');
            $sisaTransfer[$nama] = ($sisaTransfer[$nama] ?? 0) + $sisa;
        }
        foreach ($sisaTransfer as $nama => $nilai) {
            $grouped->push(['name' => $nama, 'value' => $nilai]);
        }

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
        return $this->rekening()
            ->map(fn ($a) => [
                'id' => $a->id,
                'type' => $a->type,
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

        // PPN yang sudah ikut dibayar klien (titipan pajak dulu, lalu PPN — sama dengan Laba Rugi): titipan negara, bukan laba.
        $ppnCollected = Invoice::where('ppn_amount', '>', 0)
            ->withSum('payments', 'amount')
            ->withSum(['items as deposits_sum' => fn ($q) => $q->where('is_tax_deposit', true)], 'amount')
            ->get()
            ->sum(fn ($inv) => min(max(0, (int) $inv->payments_sum_amount - (int) $inv->deposits_sum), (int) $inv->ppn_amount));

        return [
            'total_income' => (int) $totalIncome,
            'total_profit' => (int) ($totalIncome - $ppnCollected - $totalHpp),
            'total_outstanding' => (int) max(0, $pendingTotal - $pendingPaid),
            'total_hpp' => (int) $totalHpp,
            'total_pp' => (int) round($ppBase * 0.005),
            'total_balance' => $this->rekening()->sum(fn ($a) => $a->balance),
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
