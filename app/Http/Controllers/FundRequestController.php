<?php

namespace App\Http\Controllers;

use App\Http\Requests\DisburseFundRequestRequest;
use App\Http\Requests\ReviewFundRequestRequest;
use App\Http\Requests\StoreFundRequestRequest;
use App\Http\Requests\UpdateFundRequestRequest;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\FundRequest;
use App\Models\FundRequestItem;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class FundRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $canApprove = auth()->user()->can('approve fund requests');
        $canDisburse = auth()->user()->can('disburse fund requests');
        $tab = $request->input('tab', $canApprove ? 'all' : 'my');

        $search = $request->input('search');
        $status = $request->input('status');
        $priority = $request->input('priority');
        $userId = $request->input('user_id');
        $month = $request->input('month');
        $perPage = (int) $request->input('per_page', 15);
        $page = (int) $request->input('page', 1);

        $query = FundRequest::with(['user', 'reviewer', 'disburser', 'items.category', 'bankTransaction.bankAccount'])
            ->withCount('items');

        if ($tab === 'my') {
            $query->where('user_id', auth()->id());
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('purpose', 'like', "%{$search}%");
            });
        }
        if ($status) {
            $query->where('status', $status);
        }
        if ($priority) {
            $query->where('priority', $priority);
        }
        if ($userId && $tab === 'all') {
            $query->where('user_id', $userId);
        }
        if ($month) {
            [$year, $mon] = explode('-', $month);
            $query->whereYear('created_at', $year)->whereMonth('created_at', $mon);
        }

        $paginator = $query->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        $statsQuery = FundRequest::query();
        if ($tab === 'my') {
            $statsQuery->where('user_id', auth()->id());
        }
        $statsRow = $statsQuery->selectRaw("
            COUNT(*) as total,
            SUM(total_amount) as total_amount,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN status = 'disbursed' THEN 1 ELSE 0 END) as disbursed_count
        ")->first();

        $rows = $paginator->map(fn (FundRequest $r) => [
            'id' => $r->id,
            'request_number' => $r->request_number,
            'title' => $r->title,
            'purpose' => $r->purpose,
            'total_amount' => $r->total_amount,
            'priority' => $r->priority,
            'needed_by_date' => $r->needed_by_date?->format('Y-m-d'),
            'status' => $r->status,
            'user_name' => $r->user?->name,
            'user_id' => $r->user_id,
            'reviewed_by_name' => $r->reviewer?->name,
            'reviewed_at' => $r->reviewed_at?->format('Y-m-d'),
            'review_notes' => $r->review_notes,
            'disbursed_by_name' => $r->disburser?->name,
            'disbursement_date' => $r->disbursement_date?->format('Y-m-d'),
            'disbursement_notes' => $r->disbursement_notes,
            'attachment_url' => $r->attachment_path ? Storage::disk('public')->url($r->attachment_path) : null,
            'attachment_name' => $r->attachment_name,
            'items_count' => $r->items_count,
            'items' => $r->items->map(fn ($i) => [
                'id' => $i->id,
                'description' => $i->description,
                'category_label' => $i->category?->label,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'amount' => $i->amount,
            ]),
            'disbursement_account_name' => $r->bankTransaction?->bankAccount
                ? $r->bankTransaction->bankAccount->account_name.' — '.$r->bankTransaction->bankAccount->bank_name
                : null,
            'disbursement_attachment_url' => $r->bankTransaction?->attachment_path
                ? Storage::disk('public')->url($r->bankTransaction->attachment_path)
                : null,
            'disbursement_attachment_name' => $r->bankTransaction?->attachment_name,
            'can_edit' => $r->canEdit() && ($r->user_id === auth()->id() || auth()->user()->hasRole('admin')),
            'can_delete' => $r->canDelete(),
            'can_submit' => $r->canSubmit() && $r->user_id === auth()->id(),
            'can_review' => $r->canReview(),
            'can_disburse' => $r->canDisburse(),
            'created_at' => $r->created_at?->format('Y-m-d'),
        ]);

        $bankAccountOptions = BankAccount::with(['payments', 'transactions'])
            ->orderBy('account_name')
            ->get()
            ->map(fn ($b) => [
                'value' => $b->id,
                'label' => $b->account_name.' — '.$b->bank_name.' ('.$b->formatted_balance.')',
            ]);

        $userOptions = $canApprove
            ? User::orderBy('name')->get()->map(fn ($u) => ['value' => $u->id, 'label' => $u->name])
            : collect();

        $categories = TransactionCategory::selectOptions('expense');

        $nextNumber = FundRequest::generateRequestNumber();

        // Load edit data when ?edit={id} is requested (used by the edit Sheet)
        $editFundRequest = null;
        if ($editId = $request->input('edit')) {
            $fr = FundRequest::with('items')->find($editId);
            if ($fr && ($fr->user_id === auth()->id() || auth()->user()->hasRole('admin')) && $fr->canEdit()) {
                $editFundRequest = [
                    'id' => $fr->id,
                    'request_number' => $fr->request_number,
                    'title' => $fr->title,
                    'purpose' => $fr->purpose,
                    'priority' => $fr->priority,
                    'needed_by_date' => $fr->needed_by_date?->format('Y-m-d'),
                    'attachment_url' => $fr->attachment_path ? Storage::disk('public')->url($fr->attachment_path) : null,
                    'attachment_name' => $fr->attachment_name,
                    'status' => $fr->status,
                    'items' => $fr->items->map(fn ($i) => [
                        'id' => $i->id,
                        'description' => $i->description,
                        'category_id' => $i->category_id,
                        'quantity' => $i->quantity,
                        'unit_price' => $i->unit_price,
                        'amount' => $i->amount,
                        'notes' => $i->notes ?? '',
                    ]),
                ];
            }
        }

        return Inertia::render('fund-requests/index', [
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
                'disbursed_count' => (int) ($statsRow->disbursed_count ?? 0),
            ],
            'filters' => [
                'tab' => $tab,
                'search' => $search,
                'status' => $status,
                'priority' => $priority,
                'user_id' => $userId,
                'month' => $month,
                'per_page' => $perPage,
                'page' => $page,
            ],
            'bankAccountOptions' => $bankAccountOptions,
            'userOptions' => $userOptions,
            'categories' => $categories,
            'nextNumber' => $nextNumber,
            'editFundRequest' => $editFundRequest,
            'canApprove' => $canApprove,
            'canDisburse' => $canDisburse,
        ]);
    }

    public function create(): Response
    {
        $categories = TransactionCategory::selectOptions('expense');

        $nextNumber = FundRequest::generateRequestNumber();

        return Inertia::render('fund-requests/create', [
            'categories' => $categories,
            'nextNumber' => $nextNumber,
        ]);
    }

    public function store(StoreFundRequestRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $attachmentPath = null;
        $attachmentName = null;

        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('fund-requests', 'public');
            $attachmentName = $request->file('attachment')->getClientOriginalName();
        }

        DB::transaction(function () use ($validated, $attachmentPath, $attachmentName) {
            $fundRequest = FundRequest::create([
                'request_number' => $validated['request_number'],
                'user_id' => auth()->id(),
                'title' => $validated['title'],
                'purpose' => $validated['purpose'],
                'total_amount' => 0,
                'priority' => $validated['priority'],
                'needed_by_date' => $validated['needed_by_date'],
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
                'status' => 'draft',
            ]);

            foreach ($validated['items'] as $item) {
                FundRequestItem::create([
                    'fund_request_id' => $fundRequest->id,
                    'description' => $item['description'],
                    'category_id' => $item['category_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'amount' => $item['quantity'] * $item['unit_price'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            if ($validated['action'] === 'submit') {
                $fundRequest->submit();
            }
        });

        $msg = $validated['action'] === 'submit'
            ? 'Permintaan dana berhasil diajukan untuk persetujuan'
            : 'Permintaan dana berhasil disimpan sebagai draft';

        return redirect()->route('fund-requests.index')->with('success', $msg);
    }

    public function edit(FundRequest $fundRequest): Response|RedirectResponse
    {
        if ($fundRequest->user_id !== auth()->id() && ! auth()->user()->hasRole('admin')) {
            abort(403);
        }

        if (! $fundRequest->canEdit()) {
            return redirect()->route('fund-requests.index')
                ->with('error', 'Permintaan dana tidak dapat diedit');
        }

        $categories = TransactionCategory::selectOptions('expense');

        $items = $fundRequest->items->map(fn ($i) => [
            'id' => $i->id,
            'description' => $i->description,
            'category_id' => $i->category_id,
            'quantity' => $i->quantity,
            'unit_price' => $i->unit_price,
            'amount' => $i->amount,
            'notes' => $i->notes,
        ]);

        return Inertia::render('fund-requests/edit', [
            'fundRequest' => [
                'id' => $fundRequest->id,
                'request_number' => $fundRequest->request_number,
                'title' => $fundRequest->title,
                'purpose' => $fundRequest->purpose,
                'priority' => $fundRequest->priority,
                'needed_by_date' => $fundRequest->needed_by_date?->format('Y-m-d'),
                'attachment_url' => $fundRequest->attachment_path ? Storage::disk('public')->url($fundRequest->attachment_path) : null,
                'attachment_name' => $fundRequest->attachment_name,
                'status' => $fundRequest->status,
                'items' => $items,
            ],
            'categories' => $categories,
        ]);
    }

    public function update(UpdateFundRequestRequest $request, FundRequest $fundRequest): RedirectResponse
    {
        if ($fundRequest->user_id !== auth()->id() && ! auth()->user()->hasRole('admin')) {
            abort(403);
        }

        if (! $fundRequest->canEdit()) {
            return back()->with('error', 'Permintaan dana tidak dapat diedit');
        }

        $validated = $request->validated();

        DB::transaction(function () use ($validated, $request, $fundRequest) {
            $attachmentPath = $fundRequest->attachment_path;
            $attachmentName = $fundRequest->attachment_name;

            if ($request->boolean('remove_attachment') && $attachmentPath) {
                Storage::disk('public')->delete($attachmentPath);
                $attachmentPath = null;
                $attachmentName = null;
            }

            if ($request->hasFile('attachment')) {
                if ($attachmentPath) {
                    Storage::disk('public')->delete($attachmentPath);
                }
                $attachmentPath = $request->file('attachment')->store('fund-requests', 'public');
                $attachmentName = $request->file('attachment')->getClientOriginalName();
            }

            $fundRequest->update([
                'title' => $validated['title'],
                'purpose' => $validated['purpose'],
                'priority' => $validated['priority'],
                'needed_by_date' => $validated['needed_by_date'],
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            $fundRequest->items()->delete();

            foreach ($validated['items'] as $item) {
                FundRequestItem::create([
                    'fund_request_id' => $fundRequest->id,
                    'description' => $item['description'],
                    'category_id' => $item['category_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'amount' => $item['quantity'] * $item['unit_price'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            if ($validated['action'] === 'submit') {
                $fundRequest->submit();
            }
        });

        $msg = $validated['action'] === 'submit'
            ? 'Permintaan dana berhasil diajukan untuk persetujuan'
            : 'Permintaan dana berhasil diperbarui';

        return redirect()->route('fund-requests.index')->with('success', $msg);
    }

    public function destroy(FundRequest $fundRequest): RedirectResponse
    {
        if (! $fundRequest->canDelete()) {
            return back()->with('error', 'Permintaan dana tidak dapat dihapus');
        }

        $fundRequest->delete();

        return back()->with('success', 'Permintaan dana berhasil dihapus');
    }

    public function submit(FundRequest $fundRequest): RedirectResponse
    {
        if ($fundRequest->user_id !== auth()->id()) {
            abort(403);
        }

        if (! $fundRequest->canSubmit()) {
            return back()->with('error', 'Permintaan dana tidak dapat diajukan (pastikan ada item dengan jumlah valid)');
        }

        $fundRequest->submit();

        return back()->with('success', 'Permintaan dana berhasil diajukan untuk persetujuan');
    }

    public function review(ReviewFundRequestRequest $request, FundRequest $fundRequest): RedirectResponse
    {
        abort_if(! auth()->user()->can('approve fund requests'), 403);

        if (! $fundRequest->canReview()) {
            return back()->with('error', 'Permintaan dana tidak dapat ditinjau');
        }

        $validated = $request->validated();

        if ($validated['action'] === 'approve') {
            $fundRequest->approve(auth()->id(), $validated['review_notes'] ?? null);

            return back()->with('success', 'Permintaan dana berhasil disetujui');
        }

        $fundRequest->reject(auth()->id(), $validated['review_notes'] ?? null);

        return back()->with('success', 'Permintaan dana ditolak');
    }

    public function disburse(DisburseFundRequestRequest $request, FundRequest $fundRequest): RedirectResponse
    {
        abort_if(! auth()->user()->can('disburse fund requests'), 403);

        if (! $fundRequest->canDisburse()) {
            return back()->with('error', 'Permintaan dana tidak dapat dicairkan');
        }

        $validated = $request->validated();

        $fundRequest->load('items');

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('transaction-attachments', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        DB::transaction(function () use ($fundRequest, $validated, $attachmentPath, $attachmentName) {
            $transactionIds = [];

            foreach ($fundRequest->items as $item) {
                $transaction = BankTransaction::create([
                    'bank_account_id' => $validated['bank_account_id'],
                    'amount' => $item->amount,
                    'transaction_date' => $validated['disbursement_date'],
                    'transaction_type' => 'debit',
                    'category_id' => $item->category_id,
                    'description' => "Pencairan Dana: {$fundRequest->title} - {$item->description}",
                    'reference_number' => $validated['disbursement_notes'] ?? null,
                    'attachment_path' => $attachmentPath,
                    'attachment_name' => $attachmentName,
                ]);

                $transactionIds[] = $transaction->id;
            }

            $fundRequest->disburse(
                $transactionIds[0],
                $validated['disbursement_date'],
                auth()->id(),
                $validated['disbursement_notes'] ?? null
            );
        });

        return back()->with('success', 'Dana berhasil dicairkan');
    }
}
