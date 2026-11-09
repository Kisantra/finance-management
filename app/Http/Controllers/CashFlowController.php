<?php

namespace App\Http\Controllers;

use App\Exports\ArusKasExport;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class CashFlowController extends Controller
{
    /**
     * Kolom yang boleh dipakai mengurutkan, per jenis query.
     *
     * Nilai `sort` dari URL tidak boleh langsung masuk orderBy(): `?sort=ngawur`
     * menjatuhkan halaman dengan 500 — input pengguna yang menjadi SQL.
     * Ditemukan QC 2026-11-03 di /services, lalu ternyata berulang di sini.
     *
     * Dua daftar karena dua query berbeda: UNION (pembayaran + transaksi) hanya
     * punya alias hasil subquery-nya, sedangkan daftar transaksi memakai kolom
     * tabel bank_transactions apa adanya.
     *
     * @var list<string>
     */
    private const KOLOM_URUT_GABUNGAN = ['date', 'amount', 'client_name', 'bank_name', 'category_label'];

    /** @var list<string> */
    private const KOLOM_URUT_TRANSAKSI = ['transaction_date', 'amount', 'description', 'reference_number'];

    /** @var list<string> */
    private const KOLOM_URUT_SEMUA = ['date', 'amount'];

    /**
     * INCOME page — UNION of Payments + credit BankTransactions (income category).
     */
    public function income(Request $request): Response
    {
        [$dateFrom, $dateTo] = $this->parseDateRange($request);
        $clientIds = $this->parseIntArray($request->input('clients'));
        $categoryIds = $this->parseIntArray($request->input('categories'));
        $inputBy = $this->pencatatDipilih($request);
        $search = $request->input('search');
        $perPage = (int) $request->input('per_page', 25);
        $sort = in_array($request->input('sort'), self::KOLOM_URUT_GABUNGAN, true)
            ? $request->input('sort')
            : 'date';
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
        if ($inputBy) {
            $payments->where('payments.created_by', $inputBy);
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
            'payments.created_by',
            DB::raw('NULL as category_type'),
            DB::raw('NULL as category_system_key'),
        ]);

        // ── Transaction side: pemasukan + pendanaan masuk (berpenanda, tidak masuk Laba Rugi) ──
        $transactions = BankTransaction::query()
            ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->where('bank_transactions.transaction_type', 'credit')
            ->whereIn('transaction_categories.type', ['income', 'financing']);

        if (! empty($categoryIds)) {
            $transactions->whereIn('bank_transactions.category_id', $categoryIds);
        }
        if ($inputBy) {
            $transactions->where('bank_transactions.created_by', $inputBy);
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
            'bank_transactions.created_by',
            'transaction_categories.type as category_type',
            'transaction_categories.system_key as category_system_key',
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

        $stats = $this->ringkasanTab($unionQuery);

        $halaman = (clone $unionQuery)
            ->orderBy($sort, $direction)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();
        $nama = $this->namaPengguna($halaman->pluck('created_by'));
        $tautan = BankTransaction::moduleLinks($halaman);

        $rows = $halaman
            ->map(fn ($r, $i) => [
                ...$this->jenisBaris($r, $tautan[$i] ?? null),
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
                'input_by' => $this->namaPencatat($r->created_by, $nama),
                'attachment_url' => $r->attachment_path ? \Storage::disk('public')->url($r->attachment_path) : null,
                'attachment_name' => $r->attachment_name,
            ])->all();

        return Inertia::render('cash-flow/income', [
            'rows' => $rows,
            'pagination' => $this->paginationMeta($page, $perPage, $stats['total_count']),
            'stats' => $stats,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'clients' => $clientIds,
                'categories' => $categoryIds,
                'input_by' => $inputBy,
                'search' => $search,
                'sort' => $sort,
                'direction' => $direction,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'clientOptions' => $this->clientOptions(),
            // Dialog ubah: pemasukan + grup Pendanaan. Filter: ditambah pokok utang/piutang yang masuk.
            'categoryOptions' => TransactionCategory::transactionOptions('income'),
            'filterCategoryOptions' => [...TransactionCategory::selectOptions('income'), ...TransactionCategory::financingOptions(true, 'credit')],
            'inputByOptions' => $this->pilihanPencatat(),
            'accounts' => $this->accountsForForm(),
        ]);
    }

    /**
     * EXPENSES page — debit BankTransactions berkategori pengeluaran + pendanaan keluar (berpenanda,
     * tidak masuk Laba Rugi; termasuk pokok utang/piutang yang hanya-lihat).
     */
    public function expenses(Request $request): Response
    {
        [$dateFrom, $dateTo] = $this->parseDateRange($request);
        $categoryIds = $this->parseIntArray($request->input('categories'));
        $bankAccountIds = $this->parseIntArray($request->input('bank_accounts'));
        $inputBy = $this->pencatatDipilih($request);
        $search = $request->input('search');
        $perPage = (int) $request->input('per_page', 25);
        $sort = in_array($request->input('sort'), self::KOLOM_URUT_TRANSAKSI, true)
            ? $request->input('sort')
            : 'transaction_date';
        $direction = $request->input('direction', 'desc');
        $page = (int) $request->input('page', 1);

        $query = BankTransaction::query()
            ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->where('bank_transactions.transaction_type', 'debit')
            ->whereIn('transaction_categories.type', ['expense', 'financing']);

        if (! empty($categoryIds)) {
            $query->whereIn('bank_transactions.category_id', $categoryIds);
        }
        if (! empty($bankAccountIds)) {
            $query->whereIn('bank_transactions.bank_account_id', $bankAccountIds);
        }
        if ($inputBy) {
            $query->where('bank_transactions.created_by', $inputBy);
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

        $stats = $this->ringkasanTab((clone $query)->toBase(), 'bank_transactions.amount', 'transaction_categories.type');

        $halaman = $query
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
                'bank_transactions.created_by',
                'transaction_categories.type as category_type',
                'transaction_categories.system_key as category_system_key',
            ])
            ->orderBy($sort, $direction)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();
        $nama = $this->namaPengguna($halaman->pluck('created_by'));
        $tautan = BankTransaction::moduleLinks($halaman->toBase());

        $rows = $halaman
            ->map(fn ($r, $i) => [
                ...$this->jenisBaris($r, $tautan[$i] ?? null),
                'id' => (int) $r->id,
                'transaction_date' => $r->transaction_date->toDateString(),
                'amount' => (int) $r->amount,
                'description' => $r->description,
                'reference_number' => $r->reference_number,
                'category_id' => (int) $r->category_id,
                'category_label' => $r->category_label,
                'bank_name' => $r->bank_name,
                'account_name' => $r->account_name,
                'input_by' => $this->namaPencatat($r->created_by, $nama),
                'attachment_url' => $r->attachment_path ? \Storage::disk('public')->url($r->attachment_path) : null,
                'attachment_name' => $r->attachment_name,
            ])->all();

        return Inertia::render('cash-flow/expenses', [
            'rows' => $rows,
            'pagination' => $this->paginationMeta($page, $perPage, $stats['total_count']),
            'stats' => $stats,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'categories' => $categoryIds,
                'bank_accounts' => $bankAccountIds,
                'input_by' => $inputBy,
                'search' => $search,
                'sort' => $sort,
                'direction' => $direction,
                'per_page' => $perPage,
                'page' => $page,
            ],
            // Dialog ubah: pengeluaran + grup Pendanaan. Filter: ditambah pokok utang/piutang yang keluar.
            'categoryOptions' => TransactionCategory::transactionOptions('expense'),
            'filterCategoryOptions' => [...TransactionCategory::selectOptions('expense'), ...TransactionCategory::financingOptions(true, 'debit')],
            'bankAccountOptions' => $this->bankAccountOptions(),
            'inputByOptions' => $this->pilihanPencatat(),
            'accounts' => $this->accountsForForm(),
        ]);
    }

    /**
     * Tab SEMUA: pemasukan (pembayaran invoice + transaksi masuk berkategori pemasukan/pendanaan) dan
     * pengeluaran (transaksi keluar berkategori pengeluaran/pendanaan) dalam satu daftar. Definisi
     * tiap sisi sama persis dengan tab Pemasukan dan Pengeluaran; transfer & penyesuaian tidak
     * termasuk. Pendanaan (termasuk pokok utang/piutang) tampil berpenanda dan dirinci di ringkasan.
     * Butuh `view income` DAN `view expense` (route).
     */
    public function all(Request $request): Response
    {
        $filter = $this->filterSemua($request);
        $perPage = max(1, min(100, (int) $request->input('per_page', 25)));
        $page = max(1, (int) $request->input('page', 1));
        $sort = in_array($request->input('sort'), self::KOLOM_URUT_SEMUA, true) ? $request->input('sort') : 'date';
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        $query = $this->kasGabungan($filter);
        $ringkasan = (clone $query)
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS masuk")
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS keluar")
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'in' AND category_type = 'financing' THEN amount ELSE 0 END), 0) AS pendanaan_masuk")
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'out' AND category_type = 'financing' THEN amount ELSE 0 END), 0) AS pendanaan_keluar")
            ->selectRaw('COUNT(*) AS jumlah')
            ->first();

        $rows = $this->barisKas((clone $query)
            ->orderBy($sort, $direction)
            ->orderBy('uid', $direction)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get());

        return Inertia::render('cash-flow/all', [
            'rows' => $rows,
            'pagination' => $this->paginationMeta($page, $perPage, (int) $ringkasan->jumlah),
            'stats' => [
                'total_in' => (int) $ringkasan->masuk,
                'total_out' => (int) $ringkasan->keluar,
                'net' => (int) $ringkasan->masuk - (int) $ringkasan->keluar,
                'total_count' => (int) $ringkasan->jumlah,
                // Bagian pendanaan (tidak masuk Laba Rugi) yang SUDAH termasuk di total_in / total_out.
                'financing_in' => (int) $ringkasan->pendanaan_masuk,
                'financing_out' => (int) $ringkasan->pendanaan_keluar,
            ],
            'filters' => [...$filter, 'sort' => $sort, 'direction' => $direction, 'per_page' => $perPage, 'page' => $page],
            // Terpisah per arah: dialog ubah hanya menawarkan kategori searah transaksinya (+ grup
            // Pendanaan); kategori pengeluaran di transaksi masuk menghilangkannya dari kedua tab.
            'incomeCategoryOptions' => TransactionCategory::transactionOptions('income'),
            'expenseCategoryOptions' => TransactionCategory::transactionOptions('expense'),
            'filterCategoryOptions' => [
                ...TransactionCategory::selectOptions('income'),
                ...TransactionCategory::selectOptions('expense'),
                ...TransactionCategory::financingOptions(true),
            ],
            'bankAccountOptions' => $this->bankAccountOptions(),
            'inputByOptions' => $this->pilihanPencatat(),
            'accounts' => $this->accountsForForm(),
        ]);
    }

    /** Ekspor Excel tab Semua dengan filter yang sedang aktif, urut tanggal naik. */
    public function exportAll(Request $request): BinaryFileResponse
    {
        $filter = $this->filterSemua($request);
        $rows = $this->barisKas($this->kasGabungan($filter)->orderBy('date')->orderBy('uid')->get());
        $periode = $filter['date_from'] && $filter['date_to'] ? "{$filter['date_from']}_{$filter['date_to']}" : 'semua-waktu';

        return Excel::download(new ArusKasExport($rows), "arus-kas_{$periode}.xlsx");
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
            ? BankTransaction::with('category')->whereIn('id', $transactionIds)->get()
            : collect();

        // Pokok utang/piutang dikelola modul Utang/Piutang: satu saja di seleksi, seluruhnya ditolak.
        abort_if(
            $trxs->contains(fn (BankTransaction $t): bool => $t->moduleLockMessage() !== null),
            403,
            'Seleksi berisi pokok utang/piutang yang dicatat otomatis oleh modul Utang/Piutang. Transaksi itu tidak bisa dihapus dari sini; kelola lewat menu Utang atau Piutang.'
        );

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
            // Catat invoice terdampak SEBELUM penghapusan, lalu hitung ulang
            // statusnya sesudahnya. Mass-delete tidak memicu hook model, jadi
            // tanpa ini invoice tetap berstatus "partially_paid" padahal
            // pembayarannya sudah nol — status bohong yang merambat ke piutang
            // dan Laporan Laba Rugi.
            $invoiceIds = Payment::whereIn('id', $paymentIds)->pluck('invoice_id')->unique();

            $deleted += Payment::whereIn('id', $paymentIds)->delete();

            Invoice::whereIn('id', $invoiceIds)->get()->each->updateStatus();
        }

        if ($trxs->isNotEmpty()) {
            // Handle transfer pairs
            $transferRefs = $trxs->filter(fn ($t) => $t->reference_number && str_starts_with($t->reference_number, 'TRF'))
                ->pluck('reference_number')->unique()->values()->all();

            // Dihapus satu per satu, bukan mass-delete: hook `deleting` pada
            // BankTransaction yang membuang berkas lampiran dari disk hanya
            // berjalan lewat event model. Mass-delete meninggalkan berkas yatim
            // di storage selamanya — tidak terlihat, tetapi menumpuk.
            if (! empty($transferRefs)) {
                foreach (BankTransaction::whereIn('reference_number', $transferRefs)->get() as $trx) {
                    $trx->delete();
                    $deleted++;
                }
            }

            $remainingIds = $trxs->filter(fn ($t) => ! $t->reference_number || ! str_starts_with($t->reference_number, 'TRF'))
                ->pluck('id')->all();
            if (! empty($remainingIds)) {
                foreach (BankTransaction::whereIn('id', $remainingIds)->get() as $trx) {
                    $trx->delete();
                    $deleted++;
                }
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
     * Ringkasan tab Pemasukan / Pengeluaran dalam satu query: total (Laba Rugi + Pendanaan), bagian
     * pendanaan (tidak masuk Laba Rugi), bagian Laba Rugi, dan jumlah baris. Pembayaran invoice tidak
     * berkategori (`category_type` NULL) sehingga terhitung Laba Rugi.
     *
     * @return array{total_amount: int, pl_amount: int, financing_amount: int, total_count: int}
     */
    private function ringkasanTab(QueryBuilder $query, string $kolomJumlah = 'amount', string $kolomJenis = 'category_type'): array
    {
        $baris = (clone $query)
            ->selectRaw("COALESCE(SUM({$kolomJumlah}), 0) AS total")
            ->selectRaw("COALESCE(SUM(CASE WHEN {$kolomJenis} = 'financing' THEN {$kolomJumlah} ELSE 0 END), 0) AS pendanaan")
            ->selectRaw('COUNT(*) AS jumlah')
            ->first();

        return [
            'total_amount' => (int) $baris->total,
            'pl_amount' => (int) $baris->total - (int) $baris->pendanaan,
            'financing_amount' => (int) $baris->pendanaan,
            'total_count' => (int) $baris->jumlah,
        ];
    }

    /**
     * Penanda jenis satu baris daftar: pendanaan (tidak masuk Laba Rugi) atau bukan, dan modul yang
     * mengelolanya bila baris itu pokok utang/piutang (hanya-lihat, lihat BankTransaction::moduleLinks).
     *
     * @param  array{module: string, label: string, search: string|null}|null  $tautan
     * @return array{category_type: string|null, is_financing: bool, managed_by: array{module: string, label: string, search: string|null}|null}
     */
    private function jenisBaris(object $row, ?array $tautan): array
    {
        $jenis = $row->category_type ?? null;

        return [
            'category_type' => $jenis,
            'is_financing' => $jenis === 'financing',
            'managed_by' => $tautan,
        ];
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

    /**
     * Filter tab Semua dari query string.
     *
     * @return array{date_from: string|null, date_to: string|null, bank_accounts: list<int>, categories: list<int>, input_by: int|null, search: string|null}
     */
    private function filterSemua(Request $request): array
    {
        [$dateFrom, $dateTo] = $this->parseDateRange($request);

        return [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'bank_accounts' => $this->parseIntArray($request->input('bank_accounts')),
            'categories' => $this->parseIntArray($request->input('categories')),
            'input_by' => $this->pencatatDipilih($request),
            'search' => $request->input('search') ?: null,
        ];
    }

    /**
     * UNION tiga sumber tab Semua dengan kolom seragam; `direction` = in/out. Sisi transaksi memuat
     * kategori searah (income/expense) DAN pendanaan (`financing`), sama dengan tab Pemasukan dan
     * Pengeluaran. Kategori hanya ada di transaksi, jadi filter kategori mengecualikan sisi
     * pembayaran (sama dengan tab Pemasukan).
     *
     * @param  array{date_from: string|null, date_to: string|null, bank_accounts: list<int>, categories: list<int>, input_by: int|null, search: string|null}  $f
     */
    private function kasGabungan(array $f): QueryBuilder
    {
        $periode = $f['date_from'] && $f['date_to'] ? [$f['date_from'], $f['date_to']] : null;

        $pembayaran = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
            ->join('bank_accounts', 'payments.bank_account_id', '=', 'bank_accounts.id')
            ->when($periode, fn ($q) => $q->whereBetween('payments.payment_date', $periode))
            ->when($f['bank_accounts'], fn ($q) => $q->whereIn('payments.bank_account_id', $f['bank_accounts']))
            ->when($f['input_by'], fn ($q) => $q->where('payments.created_by', $f['input_by']))
            ->when($f['search'], fn ($q, $cari) => $q->where(fn ($w) => $w
                ->where('invoices.invoice_number', 'like', "%{$cari}%")
                ->orWhere('clients.name', 'like', "%{$cari}%")
                ->orWhere('payments.reference_number', 'like', "%{$cari}%")
                ->orWhere('bank_accounts.bank_name', 'like', "%{$cari}%")))
            ->select([
                DB::raw("CONCAT('payment-', payments.id) as uid"),
                'payments.id',
                DB::raw("'payment' as source_type"),
                DB::raw("'in' as direction"),
                'payments.payment_date as date',
                'payments.amount',
                'payments.reference_number',
                'payments.attachment_path',
                'payments.attachment_name',
                'invoices.invoice_number',
                'clients.name as client_name',
                'bank_accounts.bank_name',
                DB::raw('NULL as category_id'),
                DB::raw('NULL as category_label'),
                DB::raw('NULL as description'),
                'payments.created_by',
                DB::raw('NULL as category_type'),
                DB::raw('NULL as category_system_key'),
            ]);

        $transaksi = fn (string $tipe, string $jenisKategori, string $arah) => BankTransaction::query()
            ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->join('transaction_categories', 'bank_transactions.category_id', '=', 'transaction_categories.id')
            ->where('bank_transactions.transaction_type', $tipe)
            ->whereIn('transaction_categories.type', [$jenisKategori, 'financing'])
            ->when($periode, fn ($q) => $q->whereBetween('bank_transactions.transaction_date', $periode))
            ->when($f['bank_accounts'], fn ($q) => $q->whereIn('bank_transactions.bank_account_id', $f['bank_accounts']))
            ->when($f['categories'], fn ($q) => $q->whereIn('bank_transactions.category_id', $f['categories']))
            ->when($f['input_by'], fn ($q) => $q->where('bank_transactions.created_by', $f['input_by']))
            ->when($f['search'], fn ($q, $cari) => $q->where(fn ($w) => $w
                ->where('bank_transactions.description', 'like', "%{$cari}%")
                ->orWhere('bank_transactions.reference_number', 'like', "%{$cari}%")
                ->orWhere('bank_accounts.bank_name', 'like', "%{$cari}%")))
            ->select([
                DB::raw("CONCAT('transaction-', bank_transactions.id) as uid"),
                'bank_transactions.id',
                DB::raw("'transaction' as source_type"),
                DB::raw("'{$arah}' as direction"),
                'bank_transactions.transaction_date as date',
                'bank_transactions.amount',
                'bank_transactions.reference_number',
                'bank_transactions.attachment_path',
                'bank_transactions.attachment_name',
                DB::raw('NULL as invoice_number'),
                DB::raw('NULL as client_name'),
                'bank_accounts.bank_name',
                'transaction_categories.id as category_id',
                'transaction_categories.label as category_label',
                'bank_transactions.description',
                'bank_transactions.created_by',
                'transaction_categories.type as category_type',
                'transaction_categories.system_key as category_system_key',
            ]);

        $sumber = array_filter([
            $f['categories'] ? null : $pembayaran,
            $transaksi('credit', 'income', 'in'),
            $transaksi('debit', 'expense', 'out'),
        ]);

        $gabungan = null;
        foreach (array_values($sumber) as $i => $q) {
            $bagian = DB::query()->fromSub($q, "s{$i}");
            $gabungan = $gabungan ? $gabungan->unionAll($bagian) : $bagian;
        }

        return DB::query()->fromSub($gabungan, 'combined');
    }

    /**
     * Baris tab Semua untuk halaman & ekspor, lengkap dengan nama pencatat.
     *
     * @param  Collection<int, \stdClass>  $rows
     * @return list<array<string, mixed>>
     */
    private function barisKas(Collection $rows): array
    {
        $rows = $rows->values();
        $nama = $this->namaPengguna($rows->pluck('created_by'));
        $tautan = BankTransaction::moduleLinks($rows);

        return $rows->map(fn ($r, $i) => [
            ...$this->jenisBaris($r, $tautan[$i] ?? null),
            'uid' => $r->uid,
            'id' => (int) $r->id,
            'source_type' => $r->source_type,
            'direction' => $r->direction,
            'date' => $r->date,
            'amount' => (int) $r->amount,
            'reference_number' => $r->reference_number,
            'invoice_number' => $r->invoice_number,
            'client_name' => $r->client_name,
            'bank_name' => $r->bank_name,
            'category_id' => $r->category_id ? (int) $r->category_id : null,
            'category_label' => $r->category_label,
            'description' => $r->description,
            'input_by' => $this->namaPencatat($r->created_by, $nama),
            'attachment_url' => $r->attachment_path ? \Storage::disk('public')->url($r->attachment_path) : null,
            'attachment_name' => $r->attachment_name,
        ])->values()->all();
    }

    /**
     * Nama pengguna untuk id `created_by` (pengguna hidup di database PUSAT: cari lewat whereIn,
     * jangan join dari database perusahaan).
     *
     * @param  Collection<int, mixed>  $ids
     * @return array<int, string>
     */
    private function namaPengguna(Collection $ids): array
    {
        $ids = $ids->filter()->map(fn ($id) => (int) $id)->unique()->values();

        return $ids->isEmpty() ? [] : User::query()->whereIn('id', $ids)->pluck('name', 'id')->all();
    }

    /** @param  array<int, string>  $nama */
    private function namaPencatat(mixed $id, array $nama): ?string
    {
        if (! $id) {
            return null;
        }

        return $nama[(int) $id] ?? 'Pengguna dihapus';
    }

    /** @return int|null id pencatat dari `?input_by=` */
    private function pencatatDipilih(Request $request): ?int
    {
        $id = (int) $request->input('input_by');

        return $id > 0 ? $id : null;
    }

    /**
     * Pilihan filter "Diinput oleh": pengguna yang pernah mencatat transaksi kas atau pembayaran
     * di perusahaan ini.
     *
     * @return list<array{label: string, value: int}>
     */
    private function pilihanPencatat(): array
    {
        $ids = BankTransaction::query()->whereNotNull('created_by')->distinct()->pluck('created_by')
            ->merge(Payment::query()->whereNotNull('created_by')->distinct()->pluck('created_by'))
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return User::query()->whereIn('id', $ids)->orderBy('name')->get(['id', 'name'])
            ->map(fn (User $user) => ['label' => $user->name, 'value' => $user->id])
            ->all();
    }
}
