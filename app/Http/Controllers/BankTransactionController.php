<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkDestroyBankTransactionRequest;
use App\Http\Requests\StoreBankTransactionRequest;
use App\Http\Requests\TransferBankTransactionRequest;
use App\Http\Requests\UpdateBankTransactionRequest;
use App\Models\BankTransaction;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

class BankTransactionController extends Controller
{
    /**
     * Kolom yang boleh dipakai mengurutkan daftar transaksi.
     *
     * @var list<string>
     */
    private const KOLOM_URUT = ['transaction_date', 'amount', 'description', 'transaction_type', 'created_at'];

    /**
     * Paginated transactions list for the selected account (JSON, called via Inertia router.reload).
     */
    public function indexTransactions(Request $request): JsonResponse
    {
        $accountId = $request->integer('account');
        if (! $accountId) {
            return response()->json(['data' => [], 'total' => 0, 'current_page' => 1, 'last_page' => 1, 'per_page' => 15, 'from' => null, 'to' => null]);
        }

        $search = $request->input('search');
        $type = $request->input('transaction_type');
        $categoryId = $request->input('category_id');
        $month = $request->input('month');
        // `sort`/`direction` dulu diteruskan mentah ke orderBy(): nilai sembarang
        // menjatuhkan endpoint ke 500 beserta pesan SQL yang menyebut nama
        // database, dan `per_page` tanpa batas atas menarik seluruh riwayat
        // transaksi dalam satu permintaan.
        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));
        $sort = in_array($request->input('sort'), self::KOLOM_URUT, true)
            ? $request->input('sort')
            : 'transaction_date';
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        $query = BankTransaction::with(['category.parent'])
            ->where('bank_account_id', $accountId)
            ->when($search, fn ($q) => $q->where(function ($qq) use ($search) {
                $qq->where('description', 'like', "%{$search}%")
                    ->orWhere('reference_number', 'like', "%{$search}%");
            }))
            ->when($type, fn ($q) => $q->where('transaction_type', $type))
            ->when($categoryId, fn ($q) => $q->where('category_id', $categoryId))
            ->when($month, fn ($q) => $q
                ->whereYear('transaction_date', substr((string) $month, 0, 4))
                ->whereMonth('transaction_date', substr((string) $month, 5, 2))
            )
            ->orderBy($sort, $direction);

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => $paginator->through(fn (BankTransaction $t) => [
                'id' => $t->id,
                'description' => $t->description,
                'transaction_type' => $t->transaction_type,
                'transaction_date' => $t->transaction_date->toDateString(),
                'amount' => $t->amount,
                'reference_number' => $t->reference_number,
                'category' => $t->category ? [
                    'id' => $t->category->id,
                    'label' => $t->category->label,
                    'parent_label' => $t->category->parent?->label,
                ] : null,
                'attachment_url' => $t->attachment_path ? Storage::disk('public')->url($t->attachment_path) : null,
                'attachment_name' => $t->attachment_name,
            ])->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ]);
    }

    /**
     * Paginated payments list for the selected account.
     */
    public function indexPayments(Request $request): JsonResponse
    {
        $accountId = $request->integer('account');
        if (! $accountId) {
            return response()->json(['data' => [], 'total' => 0, 'current_page' => 1, 'last_page' => 1, 'per_page' => 15, 'from' => null, 'to' => null]);
        }

        $search = $request->input('search');
        $method = $request->input('payment_method');
        $invoiceStatus = $request->input('invoice_status');
        $month = $request->input('month');
        $perPage = (int) $request->input('per_page', 15);
        $sort = $request->input('sort', 'payment_date');
        $direction = $request->input('direction', 'desc');

        $query = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
            ->select([
                'payments.*',
                'invoices.invoice_number',
                'invoices.status as invoice_status',
                'clients.name as client_name',
                'clients.type as client_type',
            ])
            ->where('payments.bank_account_id', $accountId)
            ->when($search, fn ($q) => $q->where(function ($qq) use ($search) {
                $qq->where('invoices.invoice_number', 'like', "%{$search}%")
                    ->orWhere('clients.name', 'like', "%{$search}%")
                    ->orWhere('payments.reference_number', 'like', "%{$search}%");
            }))
            ->when($method, fn ($q) => $q->where('payments.payment_method', $method))
            ->when($invoiceStatus, fn ($q) => $q->where('invoices.status', $invoiceStatus))
            ->when($month, fn ($q) => $q
                ->whereYear('payments.payment_date', substr((string) $month, 0, 4))
                ->whereMonth('payments.payment_date', substr((string) $month, 5, 2))
            );

        match ($sort) {
            'invoice_number' => $query->orderBy('invoices.invoice_number', $direction),
            'client_name' => $query->orderBy('clients.name', $direction),
            'amount', 'payment_method', 'payment_date' => $query->orderBy("payments.{$sort}", $direction),
            default => $query->orderBy('payments.payment_date', $direction),
        };

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => $paginator->through(fn ($p) => [
                'id' => $p->id,
                'payment_date' => $p->payment_date,
                'amount' => (int) $p->amount,
                'payment_method' => $p->payment_method,
                'reference_number' => $p->reference_number,
                'invoice_number' => $p->invoice_number,
                'invoice_status' => $p->invoice_status,
                'client_name' => $p->client_name,
                'client_type' => $p->client_type,
                'attachment_url' => $p->attachment_path ? Storage::disk('public')->url($p->attachment_path) : null,
                'attachment_name' => $p->attachment_name,
            ])->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ]);
    }

    /**
     * Create a transaction (income or expense).
     */
    public function store(StoreBankTransactionRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $data = [
            'bank_account_id' => $validated['bank_account_id'],
            'category_id' => $validated['category_id'],
            'amount' => $validated['amount'],
            'transaction_date' => $validated['transaction_date'],
            'transaction_type' => $validated['transaction_type'],
            'description' => $validated['description'],
            'reference_number' => $validated['reference_number'] ?? null,
        ];

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $path = $file->store('transaction-attachments', 'public');
            $data['attachment_path'] = $path;
            $data['attachment_name'] = $file->getClientOriginalName();
        }

        BankTransaction::create($data);

        $messageKey = $validated['transaction_type'] === 'credit'
            ? 'pages.income_recorded_successfully'
            : 'pages.expense_recorded_successfully';

        return redirect()->back()->with('success', __($messageKey));
    }

    /**
     * Update a transaction. For TRF transfers, syncs description + date to the paired transaction.
     */
    public function update(UpdateBankTransactionRequest $request, BankTransaction $bankTransaction): RedirectResponse
    {
        $isTransfer = $bankTransaction->reference_number
            && str_starts_with($bankTransaction->reference_number, 'TRF');

        $validated = $request->validated();

        $data = [
            'transaction_date' => $validated['transaction_date'],
            'description' => $validated['description'],
        ];

        if (! $isTransfer) {
            $data['amount'] = $validated['amount'];
            $data['category_id'] = $validated['category_id'];
            $data['reference_number'] = $validated['reference_number'] ?? null;

            if ($request->boolean('remove_attachment')) {
                if ($bankTransaction->attachment_path) {
                    Storage::disk('public')->delete($bankTransaction->attachment_path);
                }
                $data['attachment_path'] = null;
                $data['attachment_name'] = null;
            } elseif ($request->hasFile('attachment')) {
                if ($bankTransaction->attachment_path) {
                    Storage::disk('public')->delete($bankTransaction->attachment_path);
                }
                $file = $request->file('attachment');
                $data['attachment_path'] = $file->store('transaction-attachments', 'public');
                $data['attachment_name'] = $file->getClientOriginalName();
            }
        }

        $bankTransaction->update($data);

        if ($isTransfer) {
            $pairType = $bankTransaction->transaction_type === 'credit' ? 'debit' : 'credit';
            BankTransaction::where('reference_number', $bankTransaction->reference_number)
                ->where('transaction_type', $pairType)
                ->update([
                    'transaction_date' => $validated['transaction_date'],
                    'description' => $validated['description'],
                ]);
        }

        return redirect()->back()->with('success', __('pages.transaction_updated_successfully'));
    }

    /**
     * Delete a transaction. Handles transfer pairs (TRF reference).
     */
    public function destroy(BankTransaction $bankTransaction): RedirectResponse
    {
        Gate::authorize($bankTransaction->abilityFor('delete'));

        if ($bankTransaction->reference_number && str_starts_with($bankTransaction->reference_number, 'TRF')) {
            // Delete the paired transfer transaction too
            BankTransaction::where('reference_number', $bankTransaction->reference_number)->delete();
        } else {
            $bankTransaction->delete();
        }

        return redirect()->back()->with('success', __('pages.transaction_deleted_successfully'));
    }

    /**
     * Bulk-delete transactions. Handles transfer pairs.
     */
    public function bulkDestroy(BulkDestroyBankTransactionRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $transactions = BankTransaction::whereIn('id', $validated['ids'])->get();

        $transferRefs = $transactions
            ->filter(fn ($t) => $t->reference_number && str_starts_with($t->reference_number, 'TRF'))
            ->pluck('reference_number')
            ->unique()
            ->values()
            ->all();

        if (! empty($transferRefs)) {
            // Iterasi, bukan mass-delete — lihat catatan pada CashFlowController:
            // hook penghapus berkas lampiran tidak berjalan pada mass-delete.
            foreach (BankTransaction::whereIn('reference_number', $transferRefs)->get() as $trx) {
                $trx->delete();
            }
        }

        $nonTransferIds = $transactions
            ->filter(fn ($t) => ! $t->reference_number || ! str_starts_with($t->reference_number, 'TRF'))
            ->pluck('id')
            ->all();

        if (! empty($nonTransferIds)) {
            foreach (BankTransaction::whereIn('id', $nonTransferIds)->get() as $trx) {
                $trx->delete();
            }
        }

        return redirect()->back()->with('success', __('pages.bulk_delete_success', ['count' => count($validated['ids'])]));
    }

    /**
     * Transfer between two accounts. Creates a debit + credit pair sharing a TRF reference.
     */
    public function transfer(TransferBankTransactionRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $refNumber = 'TRF'.time();
        $totalDebit = $validated['amount'] + $validated['admin_fee'];

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('bank-transactions', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        DB::transaction(function () use ($validated, $totalDebit, $refNumber, $attachmentPath, $attachmentName) {
            BankTransaction::create([
                'bank_account_id' => $validated['from_account_id'],
                'category_id' => $validated['category_id'],
                'amount' => $totalDebit,
                'transaction_date' => $validated['transfer_date'],
                'transaction_type' => 'debit',
                'description' => 'Transfer + Admin Fee - '.$validated['description'],
                'reference_number' => $refNumber,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            BankTransaction::create([
                'bank_account_id' => $validated['to_account_id'],
                'category_id' => $validated['category_id'],
                'amount' => $validated['amount'],
                'transaction_date' => $validated['transfer_date'],
                'transaction_type' => 'credit',
                'description' => 'Transfer masuk - '.$validated['description'],
                'reference_number' => $refNumber,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);
        });

        return redirect()->back()->with('success', __('pages.transfer_completed_successfully'));
    }
}
