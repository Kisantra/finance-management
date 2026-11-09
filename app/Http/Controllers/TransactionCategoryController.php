<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTransactionCategoryRequest;
use App\Http\Requests\UpdateTransactionCategoryRequest;
use App\Models\TransactionCategory;
use App\Services\CategoryTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TransactionCategoryController extends Controller
{
    /**
     * Kolom yang boleh dipakai mengurutkan.
     *
     * Nilai `sort` dari URL tidak boleh langsung masuk orderBy(): `?sort=ngawur`
     * menjatuhkan halaman dengan 500 — input pengguna yang menjadi SQL.
     * Ditemukan QC 2026-11-03 di /services, lalu ternyata berulang di sini.
     *
     * @var list<string>
     */
    private const KOLOM_URUT = ['label', 'type', 'pl_group', 'created_at'];

    public function index(Request $request, CategoryTemplateService $template): Response
    {
        $search = $request->input('search');
        $type = $request->input('type');
        $plStatus = $request->input('pl_status');
        $perPage = (int) $request->input('per_page', 10);
        $sort = in_array($request->input('sort'), self::KOLOM_URUT, true)
            ? $request->input('sort')
            : 'type';
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
            // Pratinjau Pakai Template: tidak pernah ikut kunjungan biasa, hanya dimuat
            // saat dialognya dibuka (partial reload `only: ['templatePreview']`). Yang
            // tidak berhak mengelola kategori mendapat null.
            'templatePreview' => Inertia::optional(
                fn () => $request->user()?->can('manage categories') ? $template->plan() : null
            ),
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

    /**
     * Pakai Template: rencana dihitung ulang di server (daftar dari klien tidak dipakai),
     * lalu hanya kategori berstatus baru yang dibuat. Kategori lama tidak diubah.
     */
    public function applyTemplate(CategoryTemplateService $template): RedirectResponse
    {
        $hasil = $template->apply();

        $pesan = "{$hasil['created']} kategori dibuat, {$hasil['existing']} dilewati karena sudah ada.";

        if ($hasil['skipped'] > 0) {
            $pesan .= " {$hasil['skipped']} lainnya dilewati, alasannya tercantum di pratinjau Pakai Template.";
        }

        return redirect()->back()->with('success', $pesan);
    }

    public function update(UpdateTransactionCategoryRequest $request, TransactionCategory $transactionCategory): RedirectResponse
    {
        if ($transactionCategory->isSystem()) {
            return redirect()->back()->withErrors(['update' => 'Kategori sistem tidak dapat diubah karena dipakai otomatis oleh modul Utang/Piutang.']);
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

        // Laporan Laba Rugi hanya menyusun kategori pemasukan dan pengeluaran.
        // Memberi grup L/R pada kategori `financing`/`transfer` menghasilkan
        // baris yang tidak pernah muncul di laporan mana pun, tetapi terlihat
        // sudah terklasifikasi pada matriks kategori — menyesatkan.
        if ($validated['pl_group'] !== null && ! in_array($transactionCategory->type, ['income', 'expense'], true)) {
            return back()->withErrors([
                'pl_group' => 'Grup Laba Rugi hanya berlaku untuk kategori pemasukan dan pengeluaran, bukan kategori '.$transactionCategory->type.'.',
            ]);
        }

        $transactionCategory->update(['pl_group' => $validated['pl_group'] ?? null]);

        return back();
    }

    public function destroy(Request $request, TransactionCategory $transactionCategory): RedirectResponse
    {
        if ($transactionCategory->isSystem()) {
            return redirect()->back()->withErrors(['delete' => 'Kategori sistem tidak dapat dihapus karena dipakai otomatis oleh modul Utang/Piutang.']);
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

        // Kategori yang punya anak hanya berfungsi sebagai judul grup; transaksi
        // tidak pernah boleh menunjuk padanya. Dialog reassign dulu menerimanya,
        // sehingga penghapusan satu kategori justru membuat data melanggar
        // invarian yang ditegakkan di tempat lain. Kategori datar tanpa anak
        // tetap pengganti yang sah.
        if ($inUse && $reassignTo->children()->exists()) {
            return redirect()->back()->withErrors([
                'reassign_to_id' => 'Kategori pengganti tidak boleh kategori induk. Pilih kategori yang tidak memiliki sub-kategori.',
            ]);
        }

        if ($inUse && $reassignTo->type !== $transactionCategory->type) {
            return redirect()->back()->withErrors(['delete' => 'Kategori pengganti harus bertipe sama.']);
        }

        DB::transaction(function () use ($transactionCategory, $reassignTo, $inUse) {
            if ($inUse) {
                $transactionCategory->transactions()->update(['category_id' => $reassignTo->id, 'updated_by' => auth()->id()]);
                $transactionCategory->fundRequestItems()->update(['category_id' => $reassignTo->id]);
                $transactionCategory->reimbursements()->update(['category_id' => $reassignTo->id]);
            }

            $transactionCategory->delete();
        });

        return redirect()->back()->with('success', 'Kategori berhasil dihapus.');
    }
}
