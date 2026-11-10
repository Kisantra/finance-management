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
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { t, tk } from '@/i18n';
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

/**
 * Kategori layanan = kode yang DISIMPAN (ServiceController::TYPES) sekaligus teks Indonesianya, jadi
 * kodenya adalah kunci terjemahan: tampilkan t(kode), simpan & saring tetap memakai kode. tk() menandai
 * keempat kode supaya pemindai ikut memeriksa kamusnya.
 */
const TYPE_COLORS: Record<string, 'blue' | 'green' | 'purple' | 'yellow'> = {
    [tk('Perizinan')]: 'blue',
    [tk('Administrasi Perpajakan')]: 'green',
    [tk('Digital Marketing')]: 'purple',
    [tk('Sistem Digital')]: 'yellow',
};

/** Opsi Combobox kategori: value = kode, label = terjemahannya. */
const typeOptions = (types: string[]) => types.map((type) => ({ value: type, label: t(type) }));

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
                        <p className="text-sm text-dark-500 dark:text-dark-400">{t('Nama, kategori, dan harga layanan')}</p>
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4">
                <Input
                    label={t('Nama Layanan *')}
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    error={form.errors.name}
                    placeholder={t('Contoh: Pembuatan NPWP Badan')}
                />

                <Combobox
                    label={t('Kategori *')}
                    options={typeOptions(types)}
                    value={form.data.type || null}
                    onChange={(v) => form.setData('type', v != null ? String(v) : '')}
                    placeholder={t('Pilih Kategori')}
                    clearable={false}
                    error={form.errors.type}
                />

                <CurrencyInput
                    label={t('Harga *')}
                    value={form.data.price}
                    onChange={(v) => form.setData('price', v)}
                    error={form.errors.price}
                />
            </div>

            <DialogFooter>
                <Button variant="zinc" onClick={onCancel} disabled={form.processing} className="w-full sm:w-auto order-2 sm:order-1">
                    {t('Batal')}
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
        const timer = setTimeout(() => {
            router.get(companyUrl('/services'), { search: search || undefined, type: typeFilter || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
        }, 300);
        return () => clearTimeout(timer);
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
            onSuccess: () => { setCreateOpen(false); createForm.reset(); toast.success(t('Layanan berhasil ditambahkan.')); },
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
            onSuccess: () => { setEditTarget(null); toast.success(t('Layanan berhasil diperbarui.')); },
            onError: (errs) => toastErrors(errs, 'UpdateService'),
        });
    }

    /* ── Delete ── */
    const deleteForm = useForm({});

    function confirmDelete() {
        if (!deleteTarget) return;
        deleteForm.delete(companyUrl(`/services/${deleteTarget.id}`), {
            onSuccess: () => { setDeleteTarget(null); toast.success(t('Layanan berhasil dihapus.')); },
            onError: (errs) => toastErrors(errs, 'DeleteService'),
        });
    }

    const activeFilters = [search, typeFilter].filter(Boolean).length;

    return (
        <>
            <Head title={t('Layanan', { context: 'menu' })} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                            {t('Layanan', { context: 'menu' })}
                        </h1>
                        <p className="text-gray-600 dark:text-zinc-400 text-lg">
                            {t('Katalog layanan dan harga')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton slug="services" />
                        <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                            {t('Tambah Layanan')}
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatsCard label={t('Total Layanan')} value={stats.total} icon={<Tag className="w-6 h-6" />} color="blue" />
                    <StatsCard label={t('Rata-rata Harga')} value={formatCurrency(stats.avg_price)} icon={<BarChart3 className="w-6 h-6" />} color="green" />
                    <StatsCard label={t('Harga Tertinggi')} value={formatCurrency(stats.highest_price)} icon={<TrendingUp className="w-6 h-6" />} color="purple" />
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="w-full sm:w-64">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Cari layanan...')}
                            icon={<Search className="h-4 w-4" />}
                            iconRight={search ? (
                                <button type="button" onClick={() => setSearch('')} aria-label={t('Hapus pencarian')}>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            ) : undefined}
                        />
                    </div>

                    <div className="w-full sm:w-52">
                        <Combobox
                            options={typeOptions(types)}
                            value={typeFilter || null}
                            onChange={(v) => handleTypeFilter(v != null ? String(v) : '')}
                            placeholder={t('Semua Kategori')}
                        />
                    </div>

                    <span className="text-sm text-dark-500 dark:text-dark-400 shrink-0 pb-0.5">
                        {t('{{from}}–{{to}} dari {{total}}', { from: services.from ?? 0, to: services.to ?? 0, total: services.total })}
                    </span>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">{t('Nama Layanan')}</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">{t('Kategori')}</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">{t('Harga')}</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">{t('Dibuat')}</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">{t('Aksi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                            {services.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-dark-400 dark:text-dark-500">
                                        <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p>{t('Belum ada layanan')}</p>
                                    </td>
                                </tr>
                            ) : (
                                services.data.map((s) => (
                                    <tr key={s.id} className="hover:bg-secondary-50/80 dark:hover:bg-dark-800/50 transition-colors">
                                        <td className="px-3 py-3 align-middle font-medium text-dark-900 dark:text-dark-50">{s.name}</td>
                                        <td className="px-3 py-3 align-middle">
                                            <Badge variant={TYPE_COLORS[s.type] ?? 'blue'}>{t(s.type)}</Badge>
                                        </td>
                                        <td className="px-3 py-3 align-middle text-dark-900 dark:text-dark-50 font-medium">
                                            {formatCurrency(s.price)}
                                        </td>
                                        <td className="px-3 py-3 align-middle text-dark-500 dark:text-dark-400 text-xs">
                                            {s.created_at}
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon-sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(s)} aria-label={t('Edit Layanan')} />
                                                <Button variant="ghost" size="icon-sm" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} onClick={() => setDeleteTarget(s)} aria-label={t('Hapus Layanan')} />
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
                                {t('Halaman {{page}} dari {{pages}}', { page: services.current_page, pages: services.last_page })}
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={services.current_page <= 1}
                                    onClick={() => router.get(companyUrl('/services'), { ...filters, page: services.current_page - 1 }, { preserveState: true })}>
                                    {t('Sebelumnya')}
                                </Button>
                                <Button variant="outline" size="sm" disabled={services.current_page >= services.last_page}
                                    onClick={() => router.get(companyUrl('/services'), { ...filters, page: services.current_page + 1 }, { preserveState: true })}>
                                    {t('Berikutnya')}
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
                        <ServiceForm form={createForm} types={types} onCancel={() => { setCreateOpen(false); createForm.reset(); }} title={t('Tambah Layanan')} submitLabel={t('Simpan Layanan')} />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit modal */}
            <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
                <DialogContent size="md">
                    <form onSubmit={submitEdit}>
                        <ServiceForm form={editForm} types={types} onCancel={() => setEditTarget(null)} title={t('Edit Layanan')} submitLabel={t('Perbarui Layanan')} />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
                title={t('Hapus Layanan')}
                description={deleteTarget ? t('Apakah Anda yakin ingin menghapus "{{name}}"?', { name: deleteTarget.name }) : ''}
                confirmLabel={t('Hapus Layanan')}
                loading={deleteForm.processing}
                onConfirm={confirmDelete}
            />
        </>
    );
}

ServicesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
