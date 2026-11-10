<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkDestroyBankTransactionRequest;
use App\Http\Requests\StoreBankTransactionRequest;
use App\Http\Requests\TransferBankTransactionRequest;
use App\Http\Requests\UpdateBankTransactionRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Payment;
use App\Services\JournalService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

        $query = BankTransaction::with(['category.parent', 'bankAccount'])
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

        // Pokok utang/piutang (hanya-lihat): satu query untuk seluruh halaman.
        $baris = $paginator->getCollection()->values();
        $tautan = BankTransaction::moduleLinks($baris->map(fn (BankTransaction $t): object => (object) [
            'category_system_key' => $t->category?->system_key,
            'reference_number' => $t->reference_number,
            'description' => $t->description,
        ]));
        // Jurnal tampilan (hanya-lihat di rincian): nama pihak & pasangan transfer dicari sekali per halaman.
        $jurnal = JournalService::forTransactions($baris->map(fn (BankTransaction $t): object => JournalService::rowOf($t)));

        return response()->json([
            'data' => $baris->map(fn (BankTransaction $t, int $i) => [
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
                    'type' => $t->category->type,
                ] : null,
                'managed_by' => $tautan[$i] ?? null,
                'journal' => $jurnal[$i],
                'attachment_url' => $t->attachment_path ? Storage::disk('public')->url($t->attachment_path) : null,
                'attachment_name' => $t->attachment_name,
            ])->all(),
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

        // Jurnal tampilan pembayaran invoice ("titipan dulu"): dua query untuk seluruh halaman.
        $akun = BankAccount::find($accountId);
        $baris = $paginator->getCollection()->values();
        $jurnal = JournalService::forPayments($baris->map(fn (Payment $p): object => (object) [
            'id' => $p->id,
            'invoice_id' => $p->invoice_id,
            'amount' => $p->amount,
            'account_name' => $akun?->account_name,
            'bank_name' => $akun?->bank_name,
            'account_type' => $akun?->type,
        ]));

        return response()->json([
            'data' => $baris->map(fn (Payment $p, int $i) => [
                'id' => $p->id,
                'journal' => $jurnal[$i],
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
            ])->all(),
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

        $pesan = $validated['transaction_type'] === 'credit'
            ? __('Pemasukan berhasil dicatat.')
            : __('Pengeluaran berhasil dicatat.');

        return redirect()->back()->with('success', $pesan);
    }

    /**
     * Semua kaki dari satu transfer, termasuk transaksi ini sendiri; null bila bukan transfer.
     *
     * Pasangan ditentukan `transfer_group_id` (ULID). `reference_number` hanya dipakai sebagai
     * cadangan untuk baris warisan yang belum sempat dibackfill — dan itu memang masih ambigu
     * bila dua transfer lama lahir di detik yang sama.
     *
     * @return Builder<BankTransaction>|null
     */
    private function kakiTransfer(BankTransaction $bankTransaction)
    {
        if ($bankTransaction->transfer_group_id !== null) {
            return BankTransaction::where('transfer_group_id', $bankTransaction->transfer_group_id);
        }

        if (! $bankTransaction->reference_number || ! str_starts_with($bankTransaction->reference_number, 'TRF')) {
            return null;
        }

        /*
         * Cadangan untuk transfer LAMA, dari sebelum transfer_group_id ada.
         *
         * Awalan "TRF" saja TIDAK cukup menandai kaki transfer: Nomor Referensi
         * adalah teks bebas yang diketik pengguna. QC 2026-11-03 membuktikan
         * akibatnya — tiga biaya kantor biasa yang kebetulan diberi referensi
         * berawalan "TRF" ikut terhapus semuanya saat satu dihapus.
         *
         * Jadi pasangan hanya diakui bila bentuknya memang bentuk transfer, dan
         * syaratnya sengaja ketat: TEPAT dua baris, satu kredit satu debit,
         * nominal sama, tanggal sama. Tiga biaya debit tidak lolos; transfer lama
         * yang asli lolos. Kalau ragu, JANGAN pasangkan — menebak di sini berarti
         * menghapus baris yang bukan pasangannya, dan itu tidak bisa dibatalkan.
         */
        $sekelompok = BankTransaction::where('reference_number', $bankTransaction->reference_number)
            ->whereNull('transfer_group_id');

        $baris = (clone $sekelompok)->get(['transaction_type', 'amount', 'transaction_date']);

        $berbentukTransfer = $baris->count() === 2
            && $baris->pluck('transaction_type')->sort()->values()->all() === ['credit', 'debit']
            && $baris->pluck('amount')->unique()->count() === 1
            && $baris->pluck('transaction_date')->map(
                fn ($t) => $t instanceof \DateTimeInterface ? $t->format('Y-m-d') : (string) $t
            )->unique()->count() === 1;

        return $berbentukTransfer ? $sekelompok : null;
    }

    /**
     * Update a transaction. For TRF transfers, syncs description + date to the paired transaction.
     */
    public function update(UpdateBankTransactionRequest $request, BankTransaction $bankTransaction): RedirectResponse
    {
        $kaki = $this->kakiTransfer($bankTransaction);
        $isTransfer = $kaki !== null;

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
            $kaki->where('transaction_type', $pairType)
                ->update([
                    'transaction_date' => $validated['transaction_date'],
                    'description' => $validated['description'],
                    // Update massal tidak memicu MencatatPengguna.
                    'updated_by' => $request->user()->id,
                ]);
        }

        return redirect()->back()->with('success', __('Transaksi berhasil diperbarui'));
    }

    /**
     * Delete a transaction. Handles transfer pairs (TRF reference).
     */
    public function destroy(BankTransaction $bankTransaction): RedirectResponse
    {
        // Pokok utang/piutang dicatat & dikelola modul Utang/Piutang: hanya-lihat di sini.
        $kunci = $bankTransaction->moduleLockMessage();
        abort_if($kunci !== null, 403, (string) $kunci);

        Gate::authorize($bankTransaction->abilityFor('delete'));

        $kaki = $this->kakiTransfer($bankTransaction);

        if ($kaki !== null) {
            // Kaki pasangan ikut dihapus. Iterasi, bukan mass-delete — hook `deleting`
            // yang membuang berkas lampiran tidak berjalan pada mass-delete.
            foreach ($kaki->get() as $trx) {
                $trx->delete();
            }
        } else {
            $bankTransaction->delete();
        }

        return redirect()->back()->with('success', __('Transaksi berhasil dihapus.'));
    }

    /**
     * Bulk-delete transactions. Handles transfer pairs.
     */
    public function bulkDestroy(BulkDestroyBankTransactionRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $transactions = BankTransaction::whereIn('id', $validated['ids'])->get();

        $isKakiWarisan = fn ($t) => $t->transfer_group_id === null
            && $t->reference_number
            && str_starts_with($t->reference_number, 'TRF');

        $groupIds = $transactions->pluck('transfer_group_id')->filter()->unique()->values()->all();

        // Iterasi, BUKAN mass-delete: hook `deleting` yang membuang berkas lampiran
        // tidak berjalan pada mass-delete, sehingga berkasnya jadi yatim di disk.
        if (! empty($groupIds)) {
            foreach (BankTransaction::whereIn('transfer_group_id', $groupIds)->get() as $trx) {
                $trx->delete();
            }
        }

        $refsWarisan = $transactions->filter($isKakiWarisan)
            ->pluck('reference_number')
            ->unique()
            ->values()
            ->all();

        if (! empty($refsWarisan)) {
            foreach (BankTransaction::whereIn('reference_number', $refsWarisan)->whereNull('transfer_group_id')->get() as $trx) {
                $trx->delete();
            }
        }

        $nonTransferIds = $transactions
            ->filter(fn ($t) => $t->transfer_group_id === null && ! $isKakiWarisan($t))
            ->pluck('id')
            ->all();

        if (! empty($nonTransferIds)) {
            foreach (BankTransaction::whereIn('id', $nonTransferIds)->get() as $trx) {
                $trx->delete();
            }
        }

        return redirect()->back()->with('success', __(':count transaksi berhasil dihapus', ['count' => count($validated['ids'])]));
    }

    /**
     * Transfer between two accounts. Creates a debit + credit pair sharing a TRF reference.
     */
    public function transfer(TransferBankTransactionRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        // ULID adalah penanda pasangan yang sesungguhnya; `reference_number` tinggal label
        // yang dibaca manusia, dan tidak lagi dipakai untuk mencocokkan kaki transfer.
        $groupId = (string) Str::ulid();
        $refNumber = 'TRF'.Carbon::parse($validated['transfer_date'])->format('Ymd').'-'.substr($groupId, -6);
        $totalDebit = $validated['amount'] + $validated['admin_fee'];

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('bank-transactions', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        DB::transaction(function () use ($validated, $totalDebit, $refNumber, $groupId, $attachmentPath, $attachmentName) {
            BankTransaction::create([
                'bank_account_id' => $validated['from_account_id'],
                'category_id' => $validated['category_id'],
                'amount' => $totalDebit,
                'transaction_date' => $validated['transfer_date'],
                'transaction_type' => 'debit',
                'description' => 'Transfer + Admin Fee - '.$validated['description'],
                'reference_number' => $refNumber,
                'transfer_group_id' => $groupId,
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
                'transfer_group_id' => $groupId,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);
        });

        return redirect()->back()->with('success', __('Transfer berhasil dicatat.'));
    }
}
