import { Head, router, useForm, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    BarChart3,
    DollarSign,
    Pencil,
    Plus,
    Search,
    Tag,
    Trash2,
    TrendingUp,
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
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { formatCurrency, toastErrors } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface Service {
    id: number;
    name: string;
    type: string;
    price: number;
    created_at: string | null;
}

interface PaginatedServices {
    data: Service[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface Stats {
    total: number;
    avg_price: number;
    highest_price: number;
    by_type: Record<string, number>;
}

interface Filters {
    search?: string;
    type?: string;
    per_page?: number;
    sort?: string;
    direction?: string;
}

interface Props extends SharedProps {
    services: PaginatedServices;
    stats: Stats;
    types: string[];
    filters: Filters;
}

/* ─────────────────────────────────── helpers ─── */

const TYPE_COLORS: Record<string, 'blue' | 'green' | 'purple' | 'yellow'> = {
    'Perizinan': 'blue',
    'Administrasi Perpajakan': 'green',
    'Digital Marketing': 'purple',
    'Sistem Digital': 'yellow',
};

/* ─────────────────────────────────── service form ─── */

interface ServiceFormProps {
    form: {
        data: { name: string; type: string; price: number };
        errors: Partial<Record<'name' | 'type' | 'price', string>>;
        processing: boolean;
        setData(key: 'name' | 'type' | 'price', value: string | number): void;
    };
    types: string[];
    onCancel: () => void;
    title: string;
    submitLabel: string;
}

function ServiceForm({ form, types, onCancel, title, submitLabel }: ServiceFormProps) {
    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-4 py-2">
                    <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center shrink-0">
                        <Tag className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">{title}</DialogTitle>
                        <p className="text-sm text-dark-500 dark:text-dark-400">Nama, kategori, dan harga layanan</p>
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4">
                <Input
                    label="Nama Layanan *"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    error={form.errors.name}
                    placeholder="Contoh: Pembuatan NPWP Badan"
                />

                <Combobox
                    label="Kategori *"
                    options={types.map((t) => ({ value: t, label: t }))}
                    value={form.data.type || null}
                    onChange={(v) => form.setData('type', v != null ? String(v) : '')}
                    placeholder="Pilih Kategori"
                    clearable={false}
                    error={form.errors.type}
                />

                <CurrencyInput
                    label="Harga *"
                    value={form.data.price}
                    onChange={(v) => form.setData('price', v)}
                    error={form.errors.price}
                />
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

export default function ServicesIndex() {
    const { services, stats, types, filters } = usePage<Props>().props;

    const [search, setSearch] = React.useState(filters.search ?? '');
    const [typeFilter, setTypeFilter] = React.useState(filters.type ?? '');

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editTarget, setEditTarget] = React.useState<Service | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<Service | null>(null);

    /* filter debounce — skip initial mount to avoid double request */
    const isMounted = React.useRef(false);
    React.useEffect(() => {
        if (!isMounted.current) { isMounted.current = true; return; }
        const t = setTimeout(() => {
            router.get(companyUrl('/services'), { search: search || undefined, type: typeFilter || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    function handleTypeFilter(val: string) {
        setTypeFilter(val);
        router.get(companyUrl('/services'), { search: search || undefined, type: val || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
    }

    /* ── Create form ── */
    const createForm = useForm({ name: '', type: '', price: 0 });

    function submitCreate(e: React.FormEvent) {
        e.preventDefault();
        createForm.post(companyUrl('/services'), {
            onSuccess: () => { setCreateOpen(false); createForm.reset(); toast.success('Layanan berhasil ditambahkan.'); },
            onError: (errs) => toastErrors(errs, 'CreateService'),
        });
    }

    /* ── Edit form ── */
    const editForm = useForm({ name: '', type: '', price: 0 });

    function openEdit(s: Service) {
        editForm.setData({ name: s.name, type: s.type, price: s.price });
        setEditTarget(s);
    }

    function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editTarget) return;
        editForm.put(companyUrl(`/services/${editTarget.id}`), {
            onSuccess: () => { setEditTarget(null); toast.success('Layanan berhasil diperbarui.'); },
            onError: (errs) => toastErrors(errs, 'UpdateService'),
        });
    }

    /* ── Delete ── */
    const deleteForm = useForm({});

    function confirmDelete() {
        if (!deleteTarget) return;
        deleteForm.delete(companyUrl(`/services/${deleteTarget.id}`), {
            onSuccess: () => { setDeleteTarget(null); toast.success('Layanan berhasil dihapus.'); },
            onError: (errs) => toastErrors(errs, 'DeleteService'),
        });
    }

    const activeFilters = [search, typeFilter].filter(Boolean).length;

    return (
        <>
            <Head title="Layanan" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                            Layanan
                        </h1>
                        <p className="text-gray-600 dark:text-zinc-400 text-lg">
                            Katalog layanan dan harga
                        </p>
                    </div>
                    <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                        Tambah Layanan
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatsCard label="Total Layanan" value={stats.total} icon={<Tag className="w-6 h-6" />} color="blue" />
                    <StatsCard label="Rata-rata Harga" value={formatCurrency(stats.avg_price)} icon={<BarChart3 className="w-6 h-6" />} color="green" />
                    <StatsCard label="Harga Tertinggi" value={formatCurrency(stats.highest_price)} icon={<TrendingUp className="w-6 h-6" />} color="purple" />
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="w-full sm:w-64">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari layanan..."
                            icon={<Search className="h-4 w-4" />}
                            iconRight={search ? (
                                <button onClick={() => setSearch('')}>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            ) : undefined}
                        />
                    </div>

                    <div className="w-full sm:w-52">
                        <Combobox
                            options={types.map((t) => ({ value: t, label: t }))}
                            value={typeFilter || null}
                            onChange={(v) => handleTypeFilter(v != null ? String(v) : '')}
                            placeholder="Semua Kategori"
                        />
                    </div>

                    <span className="text-sm text-dark-500 dark:text-dark-400 shrink-0 pb-0.5">
                        {services.from ?? 0}–{services.to ?? 0} dari {services.total}
                    </span>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Nama Layanan</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Kategori</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Harga</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Dibuat</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                            {services.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-dark-400 dark:text-dark-500">
                                        <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p>Belum ada layanan</p>
                                    </td>
                                </tr>
                            ) : (
                                services.data.map((s) => (
                                    <tr key={s.id} className="hover:bg-secondary-50/80 dark:hover:bg-dark-800/50 transition-colors">
                                        <td className="px-3 py-3 align-middle font-medium text-dark-900 dark:text-dark-50">{s.name}</td>
                                        <td className="px-3 py-3 align-middle">
                                            <Badge variant={TYPE_COLORS[s.type] ?? 'blue'}>{s.type}</Badge>
                                        </td>
                                        <td className="px-3 py-3 align-middle text-dark-900 dark:text-dark-50 font-medium">
                                            {formatCurrency(s.price)}
                                        </td>
                                        <td className="px-3 py-3 align-middle text-dark-500 dark:text-dark-400 text-xs">
                                            {s.created_at}
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon-sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(s)} />
                                                <Button variant="ghost" size="icon-sm" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} onClick={() => setDeleteTarget(s)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {services.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                            <span className="text-sm text-dark-500 dark:text-dark-400">
                                Halaman {services.current_page} dari {services.last_page}
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={services.current_page <= 1}
                                    onClick={() => router.get(companyUrl('/services'), { ...filters, page: services.current_page - 1 }, { preserveState: true })}>
                                    Sebelumnya
                                </Button>
                                <Button variant="outline" size="sm" disabled={services.current_page >= services.last_page}
                                    onClick={() => router.get(companyUrl('/services'), { ...filters, page: services.current_page + 1 }, { preserveState: true })}>
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
                        <ServiceForm form={createForm} types={types} onCancel={() => { setCreateOpen(false); createForm.reset(); }} title="Tambah Layanan" submitLabel="Simpan Layanan" />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit modal */}
            <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
                <DialogContent size="md">
                    <form onSubmit={submitEdit}>
                        <ServiceForm form={editForm} types={types} onCancel={() => setEditTarget(null)} title="Edit Layanan" submitLabel="Perbarui Layanan" />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
                title="Hapus Layanan"
                description={deleteTarget ? `Apakah Anda yakin ingin menghapus "${deleteTarget.name}"?` : ''}
                confirmLabel="Hapus Layanan"
                loading={deleteForm.processing}
                onConfirm={confirmDelete}
            />
        </>
    );
}

ServicesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
