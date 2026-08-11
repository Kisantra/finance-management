<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTransactionCategoryRequest;
use App\Http\Requests\UpdateTransactionCategoryRequest;
use App\Models\TransactionCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TransactionCategoryController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $type = $request->input('type');
        $plStatus = $request->input('pl_status');
        $perPage = (int) $request->input('per_page', 10);
        $sort = $request->input('sort', 'type');
        $direction = $request->input('direction', 'asc');

        $categories = TransactionCategory::with(['parent'])
            ->withCount(['transactions', 'children', 'fundRequestItems', 'reimbursements'])
            ->when($search, fn ($q) => $q->where('label', 'like', "%{$search}%"))
            ->when($type, fn ($q) => $q->where('type', $type))
            ->when($plStatus === 'unclassified', fn ($q) => $q->whereIn('type', ['income', 'expense'])->whereNull('pl_group'))
            ->when($plStatus === 'classified', fn ($q) => $q->whereNotNull('pl_group'))
            ->orderBy($sort, $direction)
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (TransactionCategory $cat) => [
                'id' => $cat->id,
                'type' => $cat->type,
                'pl_group' => $cat->pl_group,
                'label' => $cat->label,
                'parent_id' => $cat->parent_id,
                'parent_label' => $cat->parent?->label,
                'transactions_count' => $cat->transactions_count,
                'children_count' => $cat->children_count,
                'fund_request_items_count' => $cat->fund_request_items_count,
                'reimbursements_count' => $cat->reimbursements_count,
            ]);

        $all = TransactionCategory::withCount('transactions')->get();

        $stats = [
            'total' => $all->count(),
            'parents' => $all->whereNull('parent_id')->count(),
            'children' => $all->whereNotNull('parent_id')->count(),
            'unclassified' => $all->whereIn('type', ['income', 'expense'])->whereNull('pl_group')->count(),
        ];

        $parentOptions = TransactionCategory::whereNull('parent_id')
            ->orderBy('type')
            ->orderBy('label')
            ->get()
            ->map(fn ($cat) => [
                'id' => $cat->id,
                'label' => $cat->label,
                'type' => $cat->type,
            ]);

        $reassignOptions = TransactionCategory::with('parent')
            ->orderBy('label')
            ->get()
            ->map(fn ($cat) => [
                'id' => $cat->id,
                'label' => $cat->full_path,
                'type' => $cat->type,
            ]);

        return Inertia::render('transaction-categories/index', [
            'categories' => $categories,
            'stats' => $stats,
            'parentOptions' => $parentOptions,
            'reassignOptions' => $reassignOptions,
            'filters' => [
                'search' => $search,
                'type' => $type,
                'pl_status' => $plStatus,
                'per_page' => $perPage,
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    public function store(StoreTransactionCategoryRequest $request): RedirectResponse|JsonResponse
    {
        $category = TransactionCategory::create($request->validated());

        if ($request->wantsJson()) {
            return response()->json([
                'id' => $category->id,
                'label' => $category->label,
                'type' => $category->type,
                'parent_id' => $category->parent_id,
            ], 201);
        }

        return redirect()->back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    public function update(UpdateTransactionCategoryRequest $request, TransactionCategory $transactionCategory): RedirectResponse
    {
        if ($transactionCategory->isSystem()) {
            return redirect()->back()->withErrors(['update' => 'Kategori sistem tidak dapat diubah karena dipakai otomatis oleh modul Pinjaman/Piutang.']);
        }

        $transactionCategory->update($request->validated());

        return redirect()->back()->with('success', 'Kategori berhasil diperbarui.');
    }

    /**
     * Lightweight endpoint to update only the pl_group of a category.
     * Used by the Profit & Loss page side panel for inline classification.
     */
    public function updatePlGroup(Request $request, TransactionCategory $transactionCategory): RedirectResponse
    {
        $validated = $request->validate([
            'pl_group' => ['nullable', Rule::in(TransactionCategory::PL_GROUPS)],
        ]);

        $transactionCategory->update(['pl_group' => $validated['pl_group'] ?? null]);

        return back();
    }

    public function destroy(Request $request, TransactionCategory $transactionCategory): RedirectResponse
    {
        if ($transactionCategory->isSystem()) {
            return redirect()->back()->withErrors(['delete' => 'Kategori sistem tidak dapat dihapus karena dipakai otomatis oleh modul Pinjaman/Piutang.']);
        }

        if ($transactionCategory->children()->exists()) {
            return redirect()->back()->withErrors(['delete' => 'Kategori ini memiliki sub-kategori. Hapus sub-kategori terlebih dahulu.']);
        }

        $validated = $request->validate([
            'reassign_to_id' => [
                'nullable',
                Rule::exists('transaction_categories', 'id'),
                Rule::notIn([$transactionCategory->id]),
            ],
        ]);

        $inUse = $transactionCategory->transactions()->exists()
            || $transactionCategory->fundRequestItems()->exists()
            || $transactionCategory->reimbursements()->exists();

        $reassignTo = isset($validated['reassign_to_id'])
            ? TransactionCategory::find($validated['reassign_to_id'])
            : null;

        if ($inUse && ! $reassignTo) {
            return redirect()->back()->withErrors(['delete' => 'Kategori ini masih digunakan. Pilih kategori pengganti untuk memindahkan data yang terhubung.']);
        }

        if ($inUse && $reassignTo->type !== $transactionCategory->type) {
            return redirect()->back()->withErrors(['delete' => 'Kategori pengganti harus bertipe sama.']);
        }

        DB::transaction(function () use ($transactionCategory, $reassignTo, $inUse) {
            if ($inUse) {
                $transactionCategory->transactions()->update(['category_id' => $reassignTo->id]);
                $transactionCategory->fundRequestItems()->update(['category_id' => $reassignTo->id]);
                $transactionCategory->reimbursements()->update(['category_id' => $reassignTo->id]);
            }

            $transactionCategory->delete();
        });

        return redirect()->back()->with('success', 'Kategori berhasil dihapus.');
    }
}
