<?php

namespace App\Http\Controllers;

use App\Http\Requests\PayReimbursementRequest;
use App\Http\Requests\ReviewReimbursementRequest;
use App\Http\Requests\StoreReimbursementRequest;
use App\Http\Requests\UpdateReimbursementRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Reimbursement;
use App\Models\ReimbursementPayment;
use App\Models\TransactionCategory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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
        $canSeeAll = $this->canSeeAll();
        $tab = $canSeeAll ? $request->input('tab', 'all') : 'my';

        $search = $request->input('search');
        $status = $request->input('status');
        $category = $request->input('category');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);

        // Cakupan tab + filter selain status: dasar daftar dan hitungan per pil status.
        $scoped = fn (): Builder => Reimbursement::query()
            ->when($tab === 'my', fn (Builder $q) => $q->where('user_id', auth()->id()))
            ->when($search, fn (Builder $q) => $q->whereAny(['title', 'description', 'category_input'], 'like', "%{$search}%"))
            ->when($category, fn (Builder $q) => $q->where('category_input', $category))
            ->when($dateFrom && $dateTo, fn (Builder $q) => $q->whereBetween('expense_date', [$dateFrom, $dateTo]));

        $paginator = $scoped()
            ->with(['user:id,name'])
            ->when($status, fn (Builder $q) => $q->where('status', $status))
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        $statusCounts = $scoped()->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');

        $statsRow = Reimbursement::query()
            ->when($tab === 'my', fn (Builder $q) => $q->where('user_id', auth()->id()))
            ->selectRaw("
                COUNT(*) as total,
                SUM(amount) as total_amount,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = 'approved' THEN amount - amount_paid ELSE 0 END) as approved_remaining,
                SUM(amount_paid) as total_paid
            ")->first();

        $rows = $paginator->map(fn (Reimbursement $r) => [
            'id' => $r->id,
            'title' => $r->title,
            'amount' => $r->amount,
            'amount_paid' => $r->amount_paid,
            'amount_remaining' => $r->amount_remaining,
            'expense_date' => $r->expense_date?->format('Y-m-d'),
            'category_input' => $r->category_input,
            'category_label' => Reimbursement::categoryLabel($r->category_input),
            'status' => $r->status,
            'user_name' => $r->user?->name,
            'user_id' => $r->user_id,
            'has_attachment' => $r->hasAttachment(),
            'created_at' => $r->created_at?->format('Y-m-d'),
        ]);

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
                'pending_amount' => (int) ($statsRow->pending_amount ?? 0),
                'approved_count' => (int) ($statsRow->approved_count ?? 0),
                'approved_remaining' => (int) ($statsRow->approved_remaining ?? 0),
                'total_paid' => (int) ($statsRow->total_paid ?? 0),
            ],
            'statusCounts' => collect(['draft', 'pending', 'approved', 'rejected', 'paid'])
                ->mapWithKeys(fn (string $s) => [$s => (int) ($statusCounts[$s] ?? 0)]),
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
            'categoryOptions' => Reimbursement::categories(),
            'canApprove' => $canApprove,
            'canPay' => $canPay,
            'canSeeAll' => $canSeeAll,
        ]);
    }

    /**
     * Detail mandiri untuk drawer `#reimbursement/{id}` — bisa dibuka di atas halaman mana pun,
     * jadi opsi dialog review/bayar ikut dikirim hanya bila aksinya tersedia untuk pengguna ini.
     */
    public function data(Reimbursement $reimbursement): JsonResponse
    {
        $user = auth()->user();
        abort_unless($reimbursement->user_id === $user->id || $this->canSeeAll(), 404);

        $reimbursement->load([
            'user:id,name',
            'reviewer:id,name',
            'category:id,label',
            'payments' => fn ($q) => $q->orderBy('payment_date')->orderBy('id'),
            'payments.payer:id,name',
            'payments.bankTransaction.bankAccount:id,account_name,bank_name',
        ]);

        $isOwner = $reimbursement->user_id === $user->id;
        $canReview = $reimbursement->canReview() && $user->can('approve reimbursements');
        $canPay = $reimbursement->canPay() && $user->can('pay reimbursements');

        return response()->json([
            'id' => $reimbursement->id,
            'title' => $reimbursement->title,
            'description' => $reimbursement->description,
            'amount' => $reimbursement->amount,
            'amount_paid' => $reimbursement->amount_paid,
            'amount_remaining' => max(0, $reimbursement->amount_remaining),
            'expense_date' => $reimbursement->expense_date?->format('Y-m-d'),
            'category_input' => $reimbursement->category_input,
            'category_label' => Reimbursement::categoryLabel($reimbursement->category_input),
            'transaction_category' => $reimbursement->category?->label,
            'status' => $reimbursement->status,
            'user' => ['id' => $reimbursement->user_id, 'name' => $reimbursement->user?->name],
            'reviewer_name' => $reimbursement->reviewer?->name,
            'reviewed_at' => $reimbursement->reviewed_at?->toIso8601String(),
            'review_notes' => $reimbursement->review_notes,
            'attachment_url' => $reimbursement->attachment_url,
            'attachment_name' => $reimbursement->attachment_name,
            'attachment_is_image' => $reimbursement->isImageAttachment(),
            'created_at' => $reimbursement->created_at?->toIso8601String(),
            'payments' => $reimbursement->payments->map(fn (ReimbursementPayment $p) => [
                'id' => $p->id,
                'amount' => $p->amount,
                'payment_date' => $p->payment_date?->format('Y-m-d'),
                'notes' => $p->notes,
                'payer_name' => $p->payer?->name,
                'bank_account_name' => $p->bankTransaction?->bankAccount?->account_name,
                'created_at' => $p->created_at?->toIso8601String(),
            ]),
            'can_edit' => $reimbursement->canEdit() && $isOwner && $user->can('edit reimbursements'),
            'can_delete' => $reimbursement->canDelete($user) && $user->can('delete reimbursements'),
            'can_submit' => $reimbursement->canSubmit() && $isOwner,
            'can_review' => $canReview,
            'can_pay' => $canPay,
            'review_category_options' => $canReview ? TransactionCategory::selectOptions('expense') : [],
            'bank_account_options' => $canPay ? $this->bankAccountOptions() : [],
        ]);
    }

    /** Form buat ada di sheet halaman daftar; route lama diarahkan ke sana. */
    public function create(): RedirectResponse
    {
        return redirect()->route('reimbursements.index', ['create' => 1]);
    }

    public function store(StoreReimbursementRequest $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validated();

        $attachmentPath = null;
        $attachmentName = null;

        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('reimbursements', 'public');
            $attachmentName = $request->file('attachment')->getClientOriginalName();
        }

        $reimbursement = DB::transaction(function () use ($validated, $attachmentPath, $attachmentName) {
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

            return $reimbursement;
        });

        $msg = $validated['action'] === 'submit'
            ? 'Reimbursement berhasil diajukan untuk persetujuan'
            : 'Reimbursement berhasil disimpan sebagai draft';

        if ($request->expectsJson()) {
            return response()->json(['message' => $msg, 'id' => $reimbursement->id]);
        }

        return redirect()->route('reimbursements.index')->with('success', $msg);
    }

    /** Edit dilakukan dari drawer detail; route lama membuka drawer itu. */
    public function edit(Reimbursement $reimbursement): RedirectResponse
    {
        if ($reimbursement->user_id !== auth()->id()) {
            abort(403);
        }

        if (! $reimbursement->canEdit()) {
            return redirect()->route('reimbursements.index')
                ->with('error', 'Reimbursement tidak dapat diedit');
        }

        return redirect()->to(route('reimbursements.index').'#reimbursement/'.$reimbursement->id);
    }

    public function update(UpdateReimbursementRequest $request, Reimbursement $reimbursement): JsonResponse|RedirectResponse
    {
        if ($reimbursement->user_id !== auth()->id()) {
            abort(403);
        }

        if (! $reimbursement->canEdit()) {
            return $this->actionResult($request, false, 'Reimbursement tidak dapat diedit');
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

        if ($validated['action'] === 'submit' && $reimbursement->status !== 'pending') {
            return $this->actionResult($request, false, 'Reimbursement disimpan, tetapi belum dapat diajukan');
        }

        $msg = $validated['action'] === 'submit'
            ? 'Reimbursement berhasil diajukan untuk persetujuan'
            : 'Reimbursement berhasil diperbarui';

        if ($request->expectsJson()) {
            return response()->json(['message' => $msg, 'id' => $reimbursement->id]);
        }

        return redirect()->route('reimbursements.index')->with('success', $msg);
    }

    public function destroy(Request $request, Reimbursement $reimbursement): JsonResponse|RedirectResponse
    {
        if ($reimbursement->amount_paid > 0) {
            return $this->actionResult($request, false, 'Reimbursement yang sudah memiliki pembayaran tidak dapat dihapus.');
        }

        if (! $reimbursement->canDelete()) {
            return $this->actionResult($request, false, 'Reimbursement tidak dapat dihapus');
        }

        $reimbursement->delete();

        return $this->actionResult($request, true, 'Reimbursement berhasil dihapus');
    }

    public function submit(Request $request, Reimbursement $reimbursement): JsonResponse|RedirectResponse
    {
        if ($reimbursement->user_id !== auth()->id()) {
            abort(403);
        }

        if (! $reimbursement->canSubmit()) {
            return $this->actionResult($request, false, 'Reimbursement tidak dapat diajukan');
        }

        $reimbursement->submit();

        return $this->actionResult($request, true, 'Reimbursement berhasil diajukan untuk persetujuan');
    }

    public function review(ReviewReimbursementRequest $request, Reimbursement $reimbursement): JsonResponse|RedirectResponse
    {
        abort_if(! auth()->user()->can('approve reimbursements'), 403);

        if (! $reimbursement->canReview()) {
            return $this->actionResult($request, false, 'Reimbursement tidak dapat ditinjau');
        }

        $validated = $request->validated();

        if ($validated['action'] === 'approve') {
            $reimbursement->update(['category_id' => $validated['category_id']]);
            $reimbursement->approve(auth()->id(), $validated['review_notes'] ?? null);

            return $this->actionResult($request, true, 'Reimbursement berhasil disetujui');
        }

        $reimbursement->reject(auth()->id(), $validated['review_notes'] ?? null);

        return $this->actionResult($request, true, 'Reimbursement ditolak');
    }

    public function pay(PayReimbursementRequest $request, Reimbursement $reimbursement): JsonResponse|RedirectResponse
    {
        abort_if(! auth()->user()->can('pay reimbursements'), 403);

        if (! $reimbursement->canPay()) {
            return $this->actionResult($request, false, 'Reimbursement tidak dapat dibayar');
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

        return $this->actionResult($request, true, 'Pembayaran berhasil diproses');
    }

    private function canSeeAll(): bool
    {
        return auth()->user()->can('approve reimbursements') || auth()->user()->can('pay reimbursements');
    }

    /**
     * @return Collection<int, array{value: int, label: string}>
     */
    private function bankAccountOptions(): Collection
    {
        return BankAccount::with(['payments', 'transactions'])
            ->orderBy('account_name')
            ->get()
            ->map(fn ($b) => [
                'value' => $b->id,
                'label' => $b->account_name.' — '.$b->bank_name.' ('.$b->formatted_balance.')',
            ]);
    }

    /**
     * Drawer detail memanggil aksi lewat fetch (JSON) agar halaman di belakang modal tidak berganti;
     * kunjungan biasa tetap mendapat redirect back + flash.
     */
    private function actionResult(Request $request, bool $ok, string $message): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $message], $ok ? 200 : 422);
        }

        return back()->with($ok ? 'success' : 'error', $message);
    }
}
