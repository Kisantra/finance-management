<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Payment;
use App\Models\TransactionCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CashFlowController extends Controller
{
    /**
     * INCOME page — UNION of Payments + credit BankTransactions (income category).
     */
    public function income(Request $request): Response
    {
        [$dateFrom, $dateTo] = $this->parseDateRange($request);
        $clientIds = $this->parseIntArray($request->input('clients'));
        $categoryIds = $this->parseIntArray($request->input('categories'));
        $search = $request->input('search');
        $perPage = (int) $request->input('per_page', 25);
        $sort = $request->input('sort', 'date');
        $direction = $request->input('direction', 'desc');
        $page = (int) $request->input('page', 1);

        // ── Payment side ─────────────────────────────
        $payments = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
            ->join('bank_accounts', 'payments.bank_account_id', '=', 'bank_accounts.id');

        if (! empty($clientIds)) {
            $payments->whereIn('clients.id', $clientIds);
        }
        if ($dateFrom && $dateTo) {
            $payments->whereBetween('payments.payment_date', [$dateFrom, $dateTo]);
        }
        if ($search) {
            $payments->where(function ($q) use ($search) {
                $q->where('invoices.invoice_number', 'like', "%{$search}%")
                    ->orWhere('clients.name', 'like', "%{$search}%")
                    ->orWhere('payments.reference_number', 'like', "%{$search}%")
                    ->orWhere('bank_accounts.bank_name', 'like', "%{$search}%");
            });
        }

        $paymentsSelect = $payments->select([
            DB::raw("CONCAT('payment-', payments.id) as uid"),
            'payments.id',
            'payments.payment_date as date',
            'payments.amount',
            'payments.reference_number',
            'payments.attachment_path',
            'payments.attachment_name',
            'invoices.invoice_number',
            'clients.name as client_name',
            'bank_accounts.bank_name',
            DB::raw("'payment' as source_type"),
            DB::raw('NULL as category_id'),
            DB::raw('NULL as category_label'),
            DB::raw('NULL as description'),
        ]);

        // ── Transaction side ──────────────────────────
        $transactions = BankTransaction::query()
            ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->where('bank_transactions.transaction_type', 'credit')
            ->where('transaction_categories.type', 'income');

        if (! empty($categoryIds)) {
            $transactions->whereIn('bank_transactions.category_id', $categoryIds);
        }
        if ($dateFrom && $dateTo) {
            $transactions->whereBetween('bank_transactions.transaction_date', [$dateFrom, $dateTo]);
        }
        if ($search) {
            $transactions->where(function ($q) use ($search) {
                $q->where('bank_transactions.description', 'like', "%{$search}%")
                    ->orWhere('bank_transactions.reference_number', 'like', "%{$search}%")
                    ->orWhere('bank_accounts.bank_name', 'like', "%{$search}%");
            });
        }

        $transactionsSelect = $transactions->select([
            DB::raw("CONCAT('transaction-', bank_transactions.id) as uid"),
            'bank_transactions.id',
            'bank_transactions.transaction_date as date',
            'bank_transactions.amount',
            'bank_transactions.reference_number',
            'bank_transactions.attachment_path',
            'bank_transactions.attachment_name',
            DB::raw('NULL as invoice_number'),
            DB::raw('NULL as client_name'),
            'bank_accounts.bank_name',
            DB::raw("'transaction' as source_type"),
            'transaction_categories.id as category_id',
            'transaction_categories.label as category_label',
            'bank_transactions.description',
        ]);

        // If user picked client filter, exclude transaction-side records (clients only on payments).
        // If user picked category filter, exclude payment-side records (categories only on transactions).
        $includePayments = empty($categoryIds);
        $includeTransactions = empty($clientIds);

        $unionQuery = DB::query();
        if ($includePayments && $includeTransactions) {
            $unionQuery->fromSub(function ($q) use ($paymentsSelect, $transactionsSelect) {
                $q->fromSub($paymentsSelect, 'p')->unionAll(DB::query()->fromSub($transactionsSelect, 't'));
            }, 'combined');
        } elseif ($includePayments) {
            $unionQuery->fromSub($paymentsSelect, 'combined');
        } else {
            $unionQuery->fromSub($transactionsSelect, 'combined');
        }

        $totalAmount = (int) (clone $unionQuery)->sum('amount');
        $total = (clone $unionQuery)->count();

        $rows = (clone $unionQuery)
            ->orderBy($sort, $direction)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(fn ($r) => [
                'uid' => $r->uid,
                'id' => (int) $r->id,
                'source_type' => $r->source_type,
                'date' => $r->date,
                'amount' => (int) $r->amount,
                'reference_number' => $r->reference_number,
                'invoice_number' => $r->invoice_number,
                'client_name' => $r->client_name,
                'bank_name' => $r->bank_name,
                'category_id' => $r->category_id ? (int) $r->category_id : null,
                'category_label' => $r->category_label,
                'description' => $r->description,
                'attachment_url' => $r->attachment_path ? \Storage::disk('public')->url($r->attachment_path) : null,
                'attachment_name' => $r->attachment_name,
            ])->all();

        return Inertia::render('cash-flow/income', [
            'rows' => $rows,
            'pagination' => $this->paginationMeta($page, $perPage, $total),
            'stats' => [
                'total_amount' => $totalAmount,
                'total_count' => $total,
            ],
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'clients' => $clientIds,
                'categories' => $categoryIds,
                'search' => $search,
                'sort' => $sort,
                'direction' => $direction,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'clientOptions' => $this->clientOptions(),
            'categoryOptions' => $this->categoryOptions('income'),
            'accounts' => $this->accountsForForm(),
        ]);
    }

    /**
     * EXPENSES page — debit BankTransactions with expense category.
     */
    public function expenses(Request $request): Response
    {
        [$dateFrom, $dateTo] = $this->parseDateRange($request);
        $categoryIds = $this->parseIntArray($request->input('categories'));
        $bankAccountIds = $this->parseIntArray($request->input('bank_accounts'));
        $search = $request->input('search');
        $perPage = (int) $request->input('per_page', 25);
        $sort = $request->input('sort', 'transaction_date');
        $direction = $request->input('direction', 'desc');
        $page = (int) $request->input('page', 1);

        $query = BankTransaction::query()
            ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->where('bank_transactions.transaction_type', 'debit')
            ->where('transaction_categories.type', 'expense');

        if (! empty($categoryIds)) {
            $query->whereIn('bank_transactions.category_id', $categoryIds);
        }
        if (! empty($bankAccountIds)) {
            $query->whereIn('bank_transactions.bank_account_id', $bankAccountIds);
        }
        if ($dateFrom && $dateTo) {
            $query->whereBetween('bank_transactions.transaction_date', [$dateFrom, $dateTo]);
        }
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('bank_transactions.description', 'like', "%{$search}%")
                    ->orWhere('bank_transactions.reference_number', 'like', "%{$search}%")
                    ->orWhere('bank_accounts.bank_name', 'like', "%{$search}%");
            });
        }

        $totalAmount = (int) (clone $query)->sum('bank_transactions.amount');
        $total = (clone $query)->count();

        $rows = $query
            ->select([
                'bank_transactions.id',
                'bank_transactions.transaction_date',
                'bank_transactions.amount',
                'bank_transactions.description',
                'bank_transactions.reference_number',
                'bank_transactions.attachment_path',
                'bank_transactions.attachment_name',
                'transaction_categories.id as category_id',
                'transaction_categories.label as category_label',
                'bank_accounts.bank_name',
                'bank_accounts.account_name',
            ])
            ->orderBy($sort, $direction)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'transaction_date' => $r->transaction_date->toDateString(),
                'amount' => (int) $r->amount,
                'description' => $r->description,
                'reference_number' => $r->reference_number,
                'category_id' => (int) $r->category_id,
                'category_label' => $r->category_label,
                'bank_name' => $r->bank_name,
                'account_name' => $r->account_name,
                'attachment_url' => $r->attachment_path ? \Storage::disk('public')->url($r->attachment_path) : null,
                'attachment_name' => $r->attachment_name,
            ])->all();

        return Inertia::render('cash-flow/expenses', [
            'rows' => $rows,
            'pagination' => $this->paginationMeta($page, $perPage, $total),
            'stats' => [
                'total_amount' => $totalAmount,
                'total_count' => $total,
            ],
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'categories' => $categoryIds,
                'bank_accounts' => $bankAccountIds,
                'search' => $search,
                'sort' => $sort,
                'direction' => $direction,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'categoryOptions' => $this->categoryOptions('expense'),
            'bankAccountOptions' => $this->bankAccountOptions(),
            'accounts' => $this->accountsForForm(),
        ]);
    }

    /**
     * TRANSFERS page — paired TRF transactions + adjustments.
     */
    public function transfers(Request $request): Response
    {
        [$dateFrom, $dateTo] = $this->parseDateRange($request);
        $bankAccountIds = $this->parseIntArray($request->input('bank_accounts'));
        $search = $request->input('search');
        $perPage = (int) $request->input('per_page', 25);
        $page = (int) $request->input('page', 1);

        // Transfers: pair up TRF credit ↔ debit by reference_number
        $creditsQuery = BankTransaction::query()
            ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->where('bank_transactions.transaction_type', 'credit')
            ->where('transaction_categories.type', 'transfer')
            ->whereNotNull('bank_transactions.reference_number');

        if ($dateFrom && $dateTo) {
            $creditsQuery->whereBetween('bank_transactions.transaction_date', [$dateFrom, $dateTo]);
        }
        if (! empty($bankAccountIds)) {
            $creditsQuery->whereIn('bank_transactions.bank_account_id', $bankAccountIds);
        }
        if ($search) {
            $creditsQuery->where(function ($q) use ($search) {
                $q->where('bank_transactions.description', 'like', "%{$search}%")
                    ->orWhere('bank_transactions.reference_number', 'like', "%{$search}%");
            });
        }

        $total = (clone $creditsQuery)->count();

        // Compute aggregate stats BEFORE mutating the query with select/order/limit
        $statsRow = (clone $creditsQuery)
            ->selectRaw('SUM(bank_transactions.amount) as total_amount, COUNT(*) as count')
            ->first();

        $credits = $creditsQuery
            ->select([
                'bank_transactions.id',
                'bank_transactions.transaction_date',
                'bank_transactions.amount',
                'bank_transactions.description',
                'bank_transactions.reference_number',
                'bank_transactions.attachment_path',
                'bank_transactions.attachment_name',
                'transaction_categories.label as category_label',
                'bank_accounts.id as to_account_id',
                'bank_accounts.account_name as to_account_name',
                'bank_accounts.bank_name as to_bank_name',
            ])
            ->orderByDesc('bank_transactions.transaction_date')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        // Find matching debit rows (one query)
        $refs = $credits->pluck('reference_number')->filter()->values();
        $debits = BankTransaction::query()
            ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->whereIn('bank_transactions.reference_number', $refs)
            ->where('bank_transactions.transaction_type', 'debit')
            ->select([
                'bank_transactions.id',
                'bank_transactions.reference_number',
                'bank_transactions.amount as total_debit',
                'bank_accounts.id as from_account_id',
                'bank_accounts.account_name as from_account_name',
                'bank_accounts.bank_name as from_bank_name',
            ])
            ->get()
            ->keyBy('reference_number');

        $totalTransferAmount = 0;
        $rows = $credits->map(function ($c) use ($debits, &$totalTransferAmount) {
            $debit = $debits->get($c->reference_number);
            $totalTransferAmount += (int) $c->amount;

            return [
                'id' => (int) $c->id,
                'debit_id' => $debit ? (int) $debit->id : null,
                'transaction_date' => $c->transaction_date->toDateString(),
                'reference_number' => $c->reference_number,
                'amount' => (int) $c->amount,
                'total_debit' => $debit ? (int) $debit->total_debit : (int) $c->amount,
                'admin_fee' => $debit ? max(0, (int) $debit->total_debit - (int) $c->amount) : 0,
                'description' => $c->description,
                'from_account' => $debit ? [
                    'id' => (int) $debit->from_account_id,
                    'account_name' => $debit->from_account_name,
                    'bank_name' => $debit->from_bank_name,
                ] : null,
                'to_account' => [
                    'id' => (int) $c->to_account_id,
                    'account_name' => $c->to_account_name,
                    'bank_name' => $c->to_bank_name,
                ],
                'attachment_url' => $c->attachment_path ? \Storage::disk('public')->url($c->attachment_path) : null,
                'attachment_name' => $c->attachment_name,
            ];
        })->all();

        return Inertia::render('cash-flow/transfers', [
            'rows' => $rows,
            'pagination' => $this->paginationMeta($page, $perPage, $total),
            'stats' => [
                'total_amount' => (int) ($statsRow->total_amount ?? 0),
                'total_count' => (int) ($statsRow->count ?? 0),
            ],
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'bank_accounts' => $bankAccountIds,
                'search' => $search,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'bankAccountOptions' => $this->bankAccountOptions(),
            'accounts' => $this->accountsForForm(),
        ]);
    }

    /**
     * Bulk delete from cash flow pages — handles uids like "payment-N" / "transaction-N".
     * Also deletes transfer pairs.
     */
    public function bulkDestroy(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'uids' => ['required', 'array', 'min:1'],
            'uids.*' => ['string'],
        ]);

        $paymentIds = [];
        $transactionIds = [];

        foreach ($validated['uids'] as $uid) {
            [$type, $id] = explode('-', $uid, 2) + [null, null];
            if ($type === 'payment') {
                $paymentIds[] = (int) $id;
            } elseif ($type === 'transaction') {
                $transactionIds[] = (int) $id;
            }
        }

        // Load transactions once — used for both authorization and deletion.
        $trxs = ! empty($transactionIds)
            ? BankTransaction::whereIn('id', $transactionIds)->get()
            : collect();

        // Require the matching delete permission for every feature in the selection.
        // Payments are money received, so they fall under the income feature.
        $abilities = [];
        if (! empty($paymentIds)) {
            $abilities[] = 'delete income';
        }
        foreach ($trxs->map->permissionFeature()->unique() as $feature) {
            $abilities[] = "delete {$feature}";
        }
        foreach (array_unique($abilities) as $ability) {
            Gate::authorize($ability);
        }

        $deleted = 0;

        if (! empty($paymentIds)) {
            $deleted += Payment::whereIn('id', $paymentIds)->delete();
        }

        if ($trxs->isNotEmpty()) {
            // Handle transfer pairs
            $transferRefs = $trxs->filter(fn ($t) => $t->reference_number && str_starts_with($t->reference_number, 'TRF'))
                ->pluck('reference_number')->unique()->values()->all();

            if (! empty($transferRefs)) {
                $deleted += BankTransaction::whereIn('reference_number', $transferRefs)->delete();
            }

            $remainingIds = $trxs->filter(fn ($t) => ! $t->reference_number || ! str_starts_with($t->reference_number, 'TRF'))
                ->pluck('id')->all();
            if (! empty($remainingIds)) {
                $deleted += BankTransaction::whereIn('id', $remainingIds)->delete();
            }
        }

        return redirect()->back()->with('success', __('pages.bulk_delete_done', ['count' => $deleted]));
    }

    /* ─── Helpers ───────────────────────────────────────────── */

    /**
     * @return array{0:string|null, 1:string|null}
     */
    private function parseDateRange(Request $request): array
    {
        $from = $request->input('date_from');
        $to = $request->input('date_to');

        return [$from ?: null, $to ?: null];
    }

    /**
     * @return array<int,int>
     */
    private function parseIntArray($value): array
    {
        if (is_array($value)) {
            return array_values(array_filter(array_map('intval', $value)));
        }
        if (is_string($value) && $value !== '') {
            return array_values(array_filter(array_map('intval', explode(',', $value))));
        }

        return [];
    }

    /**
     * @return array{current_page:int, last_page:int, per_page:int, total:int, from:int|null, to:int|null}
     */
    private function paginationMeta(int $page, int $perPage, int $total): array
    {
        $lastPage = max(1, (int) ceil($total / $perPage));
        $from = $total > 0 ? ($page - 1) * $perPage + 1 : null;
        $to = $total > 0 ? min($page * $perPage, $total) : null;

        return [
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $total,
            'from' => $from,
            'to' => $to,
        ];
    }

    /**
     * @return array<int,array{label:string, value:int}>
     */
    private function clientOptions(): array
    {
        return Client::orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($c) => ['label' => $c->name, 'value' => $c->id])
            ->all();
    }

    /**
     * @return array<int,array{label:string, value:int, disabled?:bool}>
     */
    private function categoryOptions(string $type): array
    {
        return TransactionCategory::selectOptions($type);
    }

    /**
     * @return array<int,array{label:string, value:int}>
     */
    private function bankAccountOptions(): array
    {
        return BankAccount::orderBy('account_name')
            ->get(['id', 'account_name', 'bank_name'])
            ->map(fn ($a) => [
                'label' => $a->account_name.' — '.$a->bank_name,
                'value' => $a->id,
            ])->all();
    }

    /**
     * Full account shape consumed by the create/transfer dialogs' account pickers.
     *
     * @return array<int,array{id:int, account_name:string, bank_name:string}>
     */
    private function accountsForForm(): array
    {
        return BankAccount::orderBy('account_name')
            ->get(['id', 'account_name', 'bank_name'])
            ->map(fn ($a) => [
                'id' => $a->id,
                'account_name' => $a->account_name,
                'bank_name' => $a->bank_name,
            ])->all();
    }
}
