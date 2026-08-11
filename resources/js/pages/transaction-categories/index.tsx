import { Head, router, useForm, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    FolderOpen,
    FolderTree,
    GitBranch,
    Layers,
    Pencil,
    Plus,
    Search,
    TriangleAlert,
    Trash2,
    X,
} from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, toastErrors } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface Category {
    id: number;
    type: string;
    pl_group: string | null;
    label: string;
    parent_id: number | null;
    parent_label: string | null;
    transactions_count: number;
    children_count: number;
    fund_request_items_count: number;
    reimbursements_count: number;
}

interface ParentOption {
    id: number;
    label: string;
    type: string;
}

interface PaginatedCategories {
    data: Category[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface Stats {
    total: number;
    parents: number;
    children: number;
    unclassified: number;
}

interface Filters {
    search?: string;
    type?: string;
    pl_status?: string;
    per_page?: number;
}

interface Props extends SharedProps {
    categories: PaginatedCategories;
    stats: Stats;
    parentOptions: ParentOption[];
    reassignOptions: ParentOption[];
    filters: Filters;
}

/* ─────────────────────────────────── helpers ─── */

const TYPE_CONFIG: Record<string, { label: string; color: 'green' | 'red' | 'blue' | 'purple' | 'orange' }> = {
    income: { label: 'Pemasukan', color: 'green' },
    expense: { label: 'Pengeluaran', color: 'red' },
    financing: { label: 'Pendanaan', color: 'orange' },
    transfer: { label: 'Transfer', color: 'purple' },
    adjustment: { label: 'Penyesuaian', color: 'blue' },
};

/** Maps a category to a Laba Rugi (P&L) line. Only relevant for income/expense. */
const PL_GROUP_CONFIG: Record<string, { label: string; type: 'income' | 'expense' }> = {
    revenue: { label: 'Pendapatan Usaha', type: 'income' },
    other_income: { label: 'Pendapatan Lain', type: 'income' },
    cogs: { label: 'Harga Pokok (HPP)', type: 'expense' },
    opex: { label: 'Beban Operasional', type: 'expense' },
    other_expense: { label: 'Beban Lain', type: 'expense' },
    tax: { label: 'Pajak Perusahaan', type: 'expense' },
};

/* ─────────────────────────────────── category form ─── */

type CategoryFormField = 'type' | 'pl_group' | 'label' | 'parent_id';

interface CategoryFormProps {
    form: {
        data: { type: string; pl_group: string; label: string; parent_id: string };
        errors: Partial<Record<CategoryFormField, string>>;
        processing: boolean;
        setData(key: CategoryFormField, value: string): void;
    };
    parentOptions: ParentOption[];
    onCancel: () => void;
    title: string;
    submitLabel: string;
}

function CategoryForm({ form, parentOptions, onCancel, title, submitLabel }: CategoryFormProps) {
    const availableParents = parentOptions.filter((p) => p.type === form.data.type);
    const plGroupOptions = Object.entries(PL_GROUP_CONFIG)
        .filter(([, cfg]) => cfg.type === form.data.type)
        .map(([val, cfg]) => ({ value: val, label: cfg.label }));

    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-4 py-2">
                    <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                        <FolderTree className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">{title}</DialogTitle>
                        <p className="text-sm text-dark-500 dark:text-dark-400">Tipe, nama, dan parent kategori</p>
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4">
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">Tipe *</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => { form.setData('type', val); form.setData('parent_id', ''); form.setData('pl_group', ''); }}
                                className={cn(
                                    'h-9 rounded-lg border text-sm font-medium transition-colors',
                                    form.data.type === val
                                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-300'
                                        : 'border-secondary-300 dark:border-dark-600 text-dark-600 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700',
                                )}
                            >
                                {cfg.label}
                            </button>
                        ))}
                    </div>
                    {form.errors.type && <p className="text-xs text-red-600 dark:text-red-400">{form.errors.type}</p>}
                </div>

                <Input
                    label="Nama Kategori *"
                    value={form.data.label}
                    onChange={(e) => form.setData('label', e.target.value)}
                    error={form.errors.label}
                    placeholder="Contoh: Gaji Karyawan"
                />

                {plGroupOptions.length > 0 && (
                    <Combobox
                        label="Grup Laba Rugi (opsional)"
                        options={plGroupOptions}
                        value={form.data.pl_group || null}
                        onChange={(v) => form.setData('pl_group', v != null ? String(v) : '')}
                        placeholder="Belum diklasifikasi"
                        error={form.errors.pl_group}
                    />
                )}

                {availableParents.length > 0 && (
                    <Combobox
                        label="Parent Kategori (opsional)"
                        options={availableParents.map((p) => ({ value: p.id, label: p.label }))}
                        value={form.data.parent_id ? Number(form.data.parent_id) : null}
                        onChange={(v) => form.setData('parent_id', v != null ? String(v) : '')}
                        placeholder="Kategori Utama (tanpa parent)"
                        error={form.errors.parent_id}
                    />
                )}
            </div>

            <DialogFooter>
                <Button variant="zinc" onClick={onCancel} disabled={form.processing} className="w-full sm:w-auto order-2 sm:order-1">
                    Batal
                </Button>
                <Button type="submit" variant="primary" loading={form.processing} className="w-full sm:w-auto order-1 sm:order-2">
                    {submitLabel}
                </Button>
            </DialogFooter>
        </>
    );
}

/* ─────────────────────────────────── main page ─── */

export default function TransactionCategoriesIndex() {
    const { categories, stats, parentOptions, reassignOptions, filters } = usePage<Props>().props;

    const [search, setSearch] = React.useState(filters.search ?? '');
    const [typeFilter, setTypeFilter] = React.useState(filters.type ?? '');
    const [plStatus, setPlStatus] = React.useState(filters.pl_status ?? '');

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editTarget, setEditTarget] = React.useState<Category | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);

    /* filter debounce — skip initial mount to avoid double request */
    const isMounted = React.useRef(false);
    React.useEffect(() => {
        if (!isMounted.current) { isMounted.current = true; return; }
        const t = setTimeout(() => {
            router.get(companyUrl('/transaction-categories'), { search: search || undefined, type: typeFilter || undefined, pl_status: plStatus || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    function handleTypeFilter(val: string) {
        setTypeFilter(val);
        router.get(companyUrl('/transaction-categories'), { search: search || undefined, type: val || undefined, pl_status: plStatus || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
    }

    function toggleUnclassified() {
        const next = plStatus === 'unclassified' ? '' : 'unclassified';
        setPlStatus(next);
        router.get(companyUrl('/transaction-categories'), { search: search || undefined, type: typeFilter || undefined, pl_status: next || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
    }

    /* ── Create form ── */
    const createForm = useForm({ type: '', pl_group: '', label: '', parent_id: '' });

    function submitCreate(e: React.FormEvent) {
        e.preventDefault();
        createForm.post(companyUrl('/transaction-categories'), {
            onSuccess: () => { setCreateOpen(false); createForm.reset(); toast.success('Kategori berhasil ditambahkan.'); },
            onError: (errs) => toastErrors(errs, 'CreateCategory'),
        });
    }

    /* ── Edit form ── */
    const editForm = useForm({ type: '', pl_group: '', label: '', parent_id: '' });

    function openEdit(cat: Category) {
        editForm.setData({ type: cat.type, pl_group: cat.pl_group ?? '', label: cat.label, parent_id: cat.parent_id ? String(cat.parent_id) : '' });
        setEditTarget(cat);
    }

    function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editTarget) return;
        editForm.put(companyUrl(`/transaction-categories/${editTarget.id}`), {
            onSuccess: () => { setEditTarget(null); toast.success('Kategori berhasil diperbarui.'); },
            onError: (errs) => toastErrors(errs, 'UpdateCategory'),
        });
    }

    /* ── Delete ── */
    const [reassignToId, setReassignToId] = React.useState<number | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    const deleteUsageCount = deleteTarget
        ? deleteTarget.transactions_count + deleteTarget.fund_request_items_count + deleteTarget.reimbursements_count
        : 0;

    const reassignTargetOptions = React.useMemo(
        () => reassignOptions
            .filter((o) => deleteTarget && o.type === deleteTarget.type && o.id !== deleteTarget.id)
            .map((o) => ({ value: o.id, label: o.label })),
        [reassignOptions, deleteTarget],
    );

    function openDelete(cat: Category) {
        setReassignToId(null);
        setDeleteTarget(cat);
    }

    function confirmDelete() {
        if (!deleteTarget) return;
        setDeleteProcessing(true);
        router.delete(companyUrl(`/transaction-categories/${deleteTarget.id}`), {
            data: reassignToId ? { reassign_to_id: reassignToId } : {},
            preserveScroll: true,
            onSuccess: () => { setDeleteTarget(null); setReassignToId(null); toast.success('Kategori berhasil dihapus.'); },
            onError: (errs) => toastErrors(errs, 'DeleteCategory'),
            onFinish: () => setDeleteProcessing(false),
        });
    }

    return (
        <>
            <Head title="Kategori Transaksi" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                            Kategori Transaksi
                        </h1>
                        <p className="text-gray-600 dark:text-zinc-400 text-lg">
                            Kelola kategori pemasukan, pengeluaran, dan transfer
                        </p>
                    </div>
                    <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                        Tambah Kategori
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Kategori" value={stats.total} icon={<Layers className="w-6 h-6" />} color="blue" />
                    <StatsCard label="Kategori Utama" value={stats.parents} icon={<FolderOpen className="w-6 h-6" />} color="green" />
                    <StatsCard label="Sub Kategori" value={stats.children} icon={<GitBranch className="w-6 h-6" />} color="purple" />
                    <StatsCard label="Belum Diklasifikasi" value={stats.unclassified} icon={<TriangleAlert className="w-6 h-6" />} color={stats.unclassified > 0 ? 'red' : 'green'} />
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="w-full sm:w-64">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kategori..."
                            icon={<Search className="h-4 w-4" />}
                            iconRight={search ? (
                                <button onClick={() => setSearch('')}>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            ) : undefined}
                        />
                    </div>

                    <div className="w-full sm:w-48">
                        <Combobox
                            options={Object.entries(TYPE_CONFIG).map(([val, cfg]) => ({ value: val, label: cfg.label }))}
                            value={typeFilter || null}
                            onChange={(v) => handleTypeFilter(v != null ? String(v) : '')}
                            placeholder="Semua Tipe"
                        />
                    </div>

                    <Button
                        variant={plStatus === 'unclassified' ? 'red' : 'outline'}
                        size="sm"
                        icon={<TriangleAlert className="h-4 w-4" />}
                        onClick={toggleUnclassified}
                        className="shrink-0"
                    >
                        Belum diklasifikasi
                    </Button>

                    <span className="text-sm text-dark-500 dark:text-dark-400 shrink-0 pb-0.5">
                        {categories.from ?? 0}–{categories.to ?? 0} dari {categories.total}
                    </span>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Tipe</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Nama</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Parent</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Grup L/R</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Digunakan</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                            {categories.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-dark-400 dark:text-dark-500">
                                        <FolderTree className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p>Belum ada kategori</p>
                                    </td>
                                </tr>
                            ) : (
                                categories.data.map((cat) => {
                                    const cfg = TYPE_CONFIG[cat.type];
                                    return (
                                        <tr key={cat.id} className="hover:bg-secondary-50/80 dark:hover:bg-dark-800/50 transition-colors">
                                            <td className="px-3 py-3 align-middle">
                                                <Badge variant={cfg?.color ?? 'blue'}>{cfg?.label ?? cat.type}</Badge>
                                            </td>
                                            <td className="px-3 py-3 align-middle font-medium text-dark-900 dark:text-dark-50">
                                                {cat.parent_label && (
                                                    <span className="text-dark-400 dark:text-dark-500 font-normal mr-1">↳</span>
                                                )}
                                                {cat.label}
                                                {cat.children_count > 0 && (
                                                    <span className="ml-2 text-xs text-dark-400 dark:text-dark-500">({cat.children_count} sub)</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-500 dark:text-dark-400">
                                                {cat.parent_label ?? <span className="text-xs text-dark-300 dark:text-dark-600">—</span>}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                {cat.pl_group ? (
                                                    <Badge variant="zinc">{PL_GROUP_CONFIG[cat.pl_group]?.label ?? cat.pl_group}</Badge>
                                                ) : (
                                                    <span className="text-xs text-dark-300 dark:text-dark-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-600 dark:text-dark-400">
                                                {(() => {
                                                    const usage = cat.transactions_count + cat.fund_request_items_count + cat.reimbursements_count;
                                                    return usage > 0 ? (
                                                        <Badge variant="green">{usage} pemakaian</Badge>
                                                    ) : (
                                                        <span className="text-xs text-dark-300 dark:text-dark-600">Belum digunakan</span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon-sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(cat)} />
                                                    {cat.children_count > 0 ? (
                                                        <TooltipProvider delayDuration={0}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span tabIndex={0}>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                                                                        disabled
                                                                    />
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                Hapus atau pindahkan {cat.children_count} sub-kategori terlebih dahulu
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        </TooltipProvider>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                                                            onClick={() => openDelete(cat)}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {categories.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                            <span className="text-sm text-dark-500 dark:text-dark-400">
                                Halaman {categories.current_page} dari {categories.last_page}
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={categories.current_page <= 1}
                                    onClick={() => router.get(companyUrl('/transaction-categories'), { ...filters, page: categories.current_page - 1 }, { preserveState: true })}>
                                    Sebelumnya
                                </Button>
                                <Button variant="outline" size="sm" disabled={categories.current_page >= categories.last_page}
                                    onClick={() => router.get(companyUrl('/transaction-categories'), { ...filters, page: categories.current_page + 1 }, { preserveState: true })}>
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create modal */}
            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) createForm.reset(); }}>
                <DialogContent size="md">
                    <form onSubmit={submitCreate}>
                        <CategoryForm form={createForm} parentOptions={parentOptions} onCancel={() => { setCreateOpen(false); createForm.reset(); }} title="Tambah Kategori" submitLabel="Simpan Kategori" />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit modal */}
            <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
                <DialogContent size="md">
                    <form onSubmit={submitEdit}>
                        <CategoryForm form={editForm} parentOptions={parentOptions} onCancel={() => setEditTarget(null)} title="Edit Kategori" submitLabel="Perbarui Kategori" />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirm — unused category */}
            <ConfirmDialog
                open={!!deleteTarget && deleteUsageCount === 0}
                onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
                title="Hapus Kategori"
                description={deleteTarget ? `Hapus kategori "${deleteTarget.label}"?` : ''}
                confirmLabel="Hapus"
                loading={deleteProcessing}
                onConfirm={confirmDelete}
            />

            {/* Delete + reassign — category in use */}
            <Dialog open={!!deleteTarget && deleteUsageCount > 0} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>Hapus Kategori</DialogTitle>
                    </DialogHeader>
                    {deleteTarget && (
                        <div className="p-6 space-y-4">
                            <div className="flex gap-3 rounded-xl border border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-900/10 p-3">
                                <TriangleAlert className="w-5 h-5 shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                                <div className="text-sm text-dark-700 dark:text-dark-300">
                                    <p>
                                        Kategori <span className="font-medium">"{deleteTarget.label}"</span> masih digunakan oleh:
                                    </p>
                                    <ul className="mt-1 list-disc list-inside text-dark-600 dark:text-dark-400">
                                        {deleteTarget.transactions_count > 0 && (
                                            <li>{deleteTarget.transactions_count} transaksi</li>
                                        )}
                                        {deleteTarget.fund_request_items_count > 0 && (
                                            <li>{deleteTarget.fund_request_items_count} item permintaan dana</li>
                                        )}
                                        {deleteTarget.reimbursements_count > 0 && (
                                            <li>{deleteTarget.reimbursements_count} reimbursement</li>
                                        )}
                                    </ul>
                                    <p className="mt-1">
                                        Pilih kategori pengganti — semua data di atas akan dipindahkan ke sana sebelum kategori ini dihapus.
                                    </p>
                                </div>
                            </div>
                            <Combobox
                                label="Pindahkan ke Kategori *"
                                options={reassignTargetOptions}
                                value={reassignToId}
                                onChange={(v) => setReassignToId(v ? Number(v) : null)}
                                placeholder="Pilih kategori pengganti"
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="zinc" size="sm" onClick={() => setDeleteTarget(null)}>Batal</Button>
                        <Button
                            variant="red"
                            size="sm"
                            onClick={confirmDelete}
                            disabled={deleteProcessing || !reassignToId}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Pindahkan & Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

TransactionCategoriesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
