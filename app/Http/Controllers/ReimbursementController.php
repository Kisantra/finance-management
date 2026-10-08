<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayReimbursementRequest;
use App\Http\Requests\ReviewReimbursementRequest;
use App\Http\Requests\StoreReimbursementRequest;
use App\Http\Requests\UpdateReimbursementRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Reimbursement;
use App\Models\TransactionCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ReimbursementController extends Controller
{
    public function index(Request $request): Response
    {
        $canApprove = auth()->user()->can('approve reimbursements');
        $canPay = auth()->user()->can('pay reimbursements');
        // Tab "Semua" (pengajuan seluruh pengguna) hanya untuk reviewer/pembayar; pengguna lain
        // selalu dibatasi ke miliknya sendiri walau mengirim ?tab=all lewat URL.
        $canSeeAll = $canApprove || $canPay;
        $tab = $canSeeAll ? $request->input('tab', 'all') : 'my';

        $search = $request->input('search');
        $status = $request->input('status');
        $category = $request->input('category');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);

        $query = Reimbursement::with(['user', 'reviewer'])
            ->withSum('payments', 'amount');

        if ($tab === 'my') {
            $query->where('user_id', auth()->id());
        }

        if ($search) {
            $query->whereAny(['title', 'description', 'category_input'], 'like', "%{$search}%");
        }
        if ($status) {
            $query->where('status', $status);
        }
        if ($category) {
            $query->where('category_input', $category);
        }
        if ($dateFrom && $dateTo) {
            $query->whereBetween('expense_date', [$dateFrom, $dateTo]);
        }

        $paginator = $query->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        $statsQuery = Reimbursement::query();
        if ($tab === 'my') {
            $statsQuery->where('user_id', auth()->id());
        }
        $statsRow = $statsQuery->selectRaw("
            COUNT(*) as total,
            SUM(amount) as total_amount,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(amount_paid) as total_paid
        ")->first();

        $rows = $paginator->map(fn (Reimbursement $r) => [
            'id' => $r->id,
            'title' => $r->title,
            'description' => $r->description,
            'amount' => $r->amount,
            'amount_paid' => $r->amount_paid,
            'amount_remaining' => $r->amount_remaining,
            'expense_date' => $r->expense_date?->format('Y-m-d'),
            'category_input' => $r->category_input,
            'category_label' => $r->category_label,
            'category_id' => $r->category_id,
            'status' => $r->status,
            'payment_status' => $r->payment_status,
            'user_name' => $r->user?->name,
            'user_id' => $r->user_id,
            'reviewed_by_name' => $r->reviewer?->name,
            'reviewed_at' => $r->reviewed_at?->format('Y-m-d'),
            'review_notes' => $r->review_notes,
            'attachment_url' => $r->attachment_url,
            'attachment_name' => $r->attachment_name,
            'can_edit' => $r->canEdit() && $r->user_id === auth()->id(),
            'can_delete' => $r->canDelete(),
            'can_submit' => $r->canSubmit() && $r->user_id === auth()->id(),
            'can_review' => $r->canReview(),
            'can_pay' => $r->canPay(),
            'created_at' => $r->created_at?->format('Y-m-d'),
        ]);

        $bankAccountOptions = BankAccount::with(['payments', 'transactions'])
            ->orderBy('account_name')
            ->get()
            ->map(fn ($b) => [
                'value' => $b->id,
                'label' => $b->account_name.' — '.$b->bank_name.' ('.$b->formatted_balance.')',
            ]);

        $categoryOptions = TransactionCategory::selectOptions('expense');

        return Inertia::render('reimbursements/index', [
            'rows' => $rows,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'stats' => [
                'total' => (int) ($statsRow->total ?? 0),
                'total_amount' => (int) ($statsRow->total_amount ?? 0),
                'pending_count' => (int) ($statsRow->pending_count ?? 0),
                'approved_count' => (int) ($statsRow->approved_count ?? 0),
                'total_paid' => (int) ($statsRow->total_paid ?? 0),
            ],
            'filters' => [
                'tab' => $tab,
                'search' => $search,
                'status' => $status,
                'category' => $category,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'bankAccountOptions' => $bankAccountOptions,
            'categoryOptions' => $categoryOptions,
            'canApprove' => $canApprove,
            'canPay' => $canPay,
            'canSeeAll' => $canSeeAll,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('reimbursements/create');
    }

    public function store(StoreReimbursementRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $attachmentPath = null;
        $attachmentName = null;

        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('reimbursements', 'public');
            $attachmentName = $request->file('attachment')->getClientOriginalName();
        }

        DB::transaction(function () use ($validated, $attachmentPath, $attachmentName) {
            $reimbursement = Reimbursement::create([
                'user_id' => auth()->id(),
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'amount' => $validated['amount'],
                'expense_date' => $validated['expense_date'],
                'category_input' => $validated['category'],
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
                'status' => 'draft',
                'payment_status' => 'unpaid',
            ]);

            if ($validated['action'] === 'submit') {
                $reimbursement->submit();
            }
        });

        $msg = $validated['action'] === 'submit'
            ? 'Reimbursement berhasil diajukan untuk persetujuan'
            : 'Reimbursement berhasil disimpan sebagai draft';

        return redirect()->route('reimbursements.index')->with('success', $msg);
    }

    public function edit(Reimbursement $reimbursement): Response|RedirectResponse
    {
        if ($reimbursement->user_id !== auth()->id()) {
            abort(403);
        }

        if (! $reimbursement->canEdit()) {
            return redirect()->route('reimbursements.index')
                ->with('error', 'Reimbursement tidak dapat diedit');
        }

        return Inertia::render('reimbursements/edit', [
            'reimbursement' => [
                'id' => $reimbursement->id,
                'title' => $reimbursement->title,
                'description' => $reimbursement->description,
                'amount' => $reimbursement->amount,
                'expense_date' => $reimbursement->expense_date?->format('Y-m-d'),
                'category' => $reimbursement->category_input,
                'attachment_url' => $reimbursement->attachment_url,
                'attachment_name' => $reimbursement->attachment_name,
                'status' => $reimbursement->status,
            ],
        ]);
    }

    public function update(UpdateReimbursementRequest $request, Reimbursement $reimbursement): RedirectResponse
    {
        if ($reimbursement->user_id !== auth()->id()) {
            abort(403);
        }

        if (! $reimbursement->canEdit()) {
            return back()->with('error', 'Reimbursement tidak dapat diedit');
        }

        $validated = $request->validated();

        DB::transaction(function () use ($validated, $request, $reimbursement) {
            $attachmentPath = $reimbursement->attachment_path;
            $attachmentName = $reimbursement->attachment_name;

            if ($request->boolean('remove_attachment') && $attachmentPath) {
                Storage::disk('public')->delete($attachmentPath);
                $attachmentPath = null;
                $attachmentName = null;
            }

            if ($request->hasFile('attachment')) {
                if ($attachmentPath) {
                    Storage::disk('public')->delete($attachmentPath);
                }
                $attachmentPath = $request->file('attachment')->store('reimbursements', 'public');
                $attachmentName = $request->file('attachment')->getClientOriginalName();
            }

            $reimbursement->update([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'amount' => $validated['amount'],
                'expense_date' => $validated['expense_date'],
                'category_input' => $validated['category'],
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            if ($validated['action'] === 'submit') {
                $reimbursement->submit();
            }
        });

        $msg = $validated['action'] === 'submit'
            ? ($reimbursement->status === 'pending'
                ? 'Reimbursement berhasil diajukan untuk persetujuan'
                : 'Reimbursement disimpan, tetapi belum dapat diajukan')
            : 'Reimbursement berhasil diperbarui';

        return redirect()->route('reimbursements.index')->with('success', $msg);
    }

    public function destroy(Reimbursement $reimbursement): RedirectResponse
    {
        if ($reimbursement->amount_paid > 0) {
            return back()->with('error', 'Reimbursement yang sudah memiliki pembayaran tidak dapat dihapus.');
        }

        if (! $reimbursement->canDelete()) {
            return back()->with('error', 'Reimbursement tidak dapat dihapus');
        }

        $reimbursement->delete();

        return back()->with('success', 'Reimbursement berhasil dihapus');
    }

    public function submit(Reimbursement $reimbursement): RedirectResponse
    {
        if ($reimbursement->user_id !== auth()->id()) {
            abort(403);
        }

        if (! $reimbursement->canSubmit()) {
            return back()->with('error', 'Reimbursement tidak dapat diajukan');
        }

        $reimbursement->submit();

        return back()->with('success', 'Reimbursement berhasil diajukan untuk persetujuan');
    }

    public function review(ReviewReimbursementRequest $request, Reimbursement $reimbursement): RedirectResponse
    {
        abort_if(! auth()->user()->can('approve reimbursements'), 403);

        if (! $reimbursement->canReview()) {
            return back()->with('error', 'Reimbursement tidak dapat ditinjau');
        }

        $validated = $request->validated();

        if ($validated['action'] === 'approve') {
            $reimbursement->update(['category_id' => $validated['category_id']]);
            $reimbursement->approve(auth()->id(), $validated['review_notes'] ?? null);

            return back()->with('success', 'Reimbursement berhasil disetujui');
        }

        $reimbursement->reject(auth()->id(), $validated['review_notes'] ?? null);

        return back()->with('success', 'Reimbursement ditolak');
    }

    public function pay(PayReimbursementRequest $request, Reimbursement $reimbursement): RedirectResponse
    {
        abort_if(! auth()->user()->can('pay reimbursements'), 403);

        if (! $reimbursement->canPay()) {
            return back()->with('error', 'Reimbursement tidak dapat dibayar');
        }

        $validated = $request->validated();

        DB::transaction(function () use ($reimbursement, $validated) {
            $isFullPayment = $validated['payment_amount'] >= $reimbursement->amount_remaining;
            $paymentType = $isFullPayment ? 'Pelunasan' : 'Cicilan';

            $transaction = BankTransaction::create([
                'bank_account_id' => $validated['bank_account_id'],
                'amount' => $validated['payment_amount'],
                'transaction_date' => $validated['payment_date'],
                'transaction_type' => 'debit',
                'category_id' => $reimbursement->category_id,
                'description' => "{$paymentType} Reimbursement: {$reimbursement->title} - {$reimbursement->user->name}",
                'reference_number' => $validated['reference_notes'] ?? null,
            ]);

            $reimbursement->recordPayment(
                amount: $validated['payment_amount'],
                bankTransactionId: $transaction->id,
                payerId: auth()->id(),
                paymentDate: $validated['payment_date'],
                notes: $validated['reference_notes'] ?? null
            );
        });

        return back()->with('success', 'Pembayaran berhasil diproses');
    }
}
