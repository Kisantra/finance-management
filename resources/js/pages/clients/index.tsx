import { Head, router, useForm, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    Building2,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Search,
    Trash2,
    User,
    Users,
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
import { FormSection } from '@/components/shared/form-section';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, toastErrors } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface Client {
    id: number;
    name: string;
    type: 'individual' | 'company';
    email: string | null;
    NPWP: string | null;
    KPP: string | null;
    EFIN: string | null;
    status: 'Active' | 'Inactive';
    account_representative: string | null;
    ar_phone_number: string | null;
    person_in_charge: string | null;
    address: string | null;
    invoices_count: number;
    total_invoice_amount: number;
    paid_invoice_amount: number;
}

interface PaginatedClients {
    data: Client[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface Stats {
    total: number;
    active: number;
    individual: number;
    company: number;
}

interface Filters {
    search?: string;
    type?: string;
    status?: string;
    per_page?: number;
    sort?: string;
    direction?: string;
}

interface Props extends SharedProps {
    clients: PaginatedClients;
    stats: Stats;
    filters: Filters;
}

/* ─────────────────────────────────── blank form ─── */

const blankForm = {
    name: '',
    type: 'individual' as 'individual' | 'company',
    email: '',
    NPWP: '',
    KPP: '',
    EFIN: '',
    status: 'Active' as 'Active' | 'Inactive',
    account_representative: '',
    ar_phone_number: '',
    person_in_charge: '',
    address: '',
};

/* ─────────────────────────────────── client form ─── */

function ClientForm({
    data,
    setData,
    errors,
    processing,
    onCancel,
    title,
    submitLabel,
}: {
    data: typeof blankForm;
    setData: (field: keyof typeof blankForm, value: string) => void;
    errors: Partial<Record<keyof typeof blankForm, string>>;
    processing: boolean;
    onCancel: () => void;
    title: string;
    submitLabel: string;
}) {
    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-4 py-2">
                    <div className="h-12 w-12 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                            {title}
                        </DialogTitle>
                        <p className="text-sm text-dark-500 dark:text-dark-400">
                            Informasi klien dan kontak
                        </p>
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 py-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left column */}
                    <FormSection title="Informasi Dasar">
                        <Input
                            label="Nama Klien *"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={errors.name}
                            placeholder="PT. Nama Perusahaan / Nama Individu"
                        />

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                Tipe Klien *
                            </label>
                            <div className="flex gap-3">
                                {(['individual', 'company'] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setData('type', t)}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border text-sm font-medium transition-colors',
                                            data.type === t
                                                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-300'
                                                : 'border-secondary-300 dark:border-dark-600 text-dark-600 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700',
                                        )}
                                    >
                                        {t === 'individual' ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                                        {t === 'individual' ? 'Individu' : 'Perusahaan'}
                                    </button>
                                ))}
                            </div>
                            {errors.type && <p className="text-xs text-red-600 dark:text-red-400">{errors.type}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                Status *
                            </label>
                            <div className="flex gap-3">
                                {(['Active', 'Inactive'] as const).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setData('status', s)}
                                        className={cn(
                                            'flex-1 h-9 rounded-lg border text-sm font-medium transition-colors',
                                            data.status === s
                                                ? s === 'Active'
                                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                                                    : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
                                                : 'border-secondary-300 dark:border-dark-600 text-dark-600 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700',
                                        )}
                                    >
                                        {s === 'Active' ? 'Aktif' : 'Tidak Aktif'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Input
                            label="Email"
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            error={errors.email}
                            icon={<Mail className="h-4 w-4" />}
                            placeholder="email@perusahaan.com"
                        />

                        <Input
                            label="Alamat"
                            value={data.address}
                            onChange={(e) => setData('address', e.target.value)}
                            error={errors.address}
                            icon={<MapPin className="h-4 w-4" />}
                            placeholder="Alamat lengkap"
                        />
                    </FormSection>

                    {/* Right column */}
                    <FormSection title="Data Pajak & Kontak">
                        <Input
                            label="NPWP"
                            value={data.NPWP}
                            onChange={(e) => setData('NPWP', e.target.value)}
                            error={errors.NPWP}
                            placeholder="XX.XXX.XXX.X-XXX.XXX"
                        />

                        <Input
                            label="KPP"
                            value={data.KPP}
                            onChange={(e) => setData('KPP', e.target.value)}
                            error={errors.KPP}
                            placeholder="Kode KPP"
                        />

                        <Input
                            label="EFIN"
                            value={data.EFIN}
                            onChange={(e) => setData('EFIN', e.target.value)}
                            error={errors.EFIN}
                            placeholder="Electronic Filing Identification Number"
                        />

                        <Input
                            label="PIC (Person in Charge)"
                            value={data.person_in_charge}
                            onChange={(e) => setData('person_in_charge', e.target.value)}
                            error={errors.person_in_charge}
                            placeholder="Nama PIC"
                        />

                        <Input
                            label="Account Representative"
                            value={data.account_representative}
                            onChange={(e) => setData('account_representative', e.target.value)}
                            error={errors.account_representative}
                            placeholder="Nama AR"
                        />

                        <Input
                            label="No. HP AR"
                            value={data.ar_phone_number}
                            onChange={(e) => setData('ar_phone_number', e.target.value)}
                            error={errors.ar_phone_number}
                            icon={<Phone className="h-4 w-4" />}
                            placeholder="08xx-xxxx-xxxx"
                        />
                    </FormSection>
                </div>
            </div>

            <DialogFooter>
                <Button variant="zinc" onClick={onCancel} disabled={processing} className="w-full sm:w-auto order-2 sm:order-1">
                    Batal
                </Button>
                <Button type="submit" variant="primary" loading={processing} className="w-full sm:w-auto order-1 sm:order-2">
                    {submitLabel}
                </Button>
            </DialogFooter>
        </>
    );
}

/* ─────────────────────────────────── main page ─── */

export default function ClientsIndex() {
    const { clients, stats, filters } = usePage<Props>().props;

    const [search, setSearch] = React.useState(filters.search ?? '');
    const [typeFilter, setTypeFilter] = React.useState(filters.type ?? '');
    const [statusFilter, setStatusFilter] = React.useState(filters.status ?? '');

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editTarget, setEditTarget] = React.useState<Client | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<Client | null>(null);

    /* filter debounce — skip initial mount to avoid double request */
    const isMounted = React.useRef(false);
    React.useEffect(() => {
        if (!isMounted.current) { isMounted.current = true; return; }
        const t = setTimeout(() => applyFilters(), 300);
        return () => clearTimeout(t);
    }, [search]);

    function applyFilters(overrides: Partial<Filters> = {}) {
        router.get(companyUrl('/clients'), {
            search: (overrides.search ?? search) || undefined,
            type: (overrides.type ?? typeFilter) || undefined,
            status: (overrides.status ?? statusFilter) || undefined,
            per_page: filters.per_page,
        }, { preserveState: true, replace: true });
    }

    function handleTypeFilter(val: string) {
        setTypeFilter(val);
        router.get(companyUrl('/clients'), { search: search || undefined, type: val || undefined, status: statusFilter || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
    }

    function handleStatusFilter(val: string) {
        setStatusFilter(val);
        router.get(companyUrl('/clients'), { search: search || undefined, type: typeFilter || undefined, status: val || undefined, per_page: filters.per_page }, { preserveState: true, replace: true });
    }

    /* ── Create form ── */
    const createForm = useForm(blankForm);

    function submitCreate(e: React.FormEvent) {
        e.preventDefault();
        createForm.post(companyUrl('/clients'), {
            onSuccess: () => { setCreateOpen(false); createForm.reset(); toast.success('Klien berhasil ditambahkan.'); },
            onError: (errs) => toastErrors(errs, 'CreateClient'),
        });
    }

    /* ── Edit form ── */
    const editForm = useForm(blankForm);

    function openEdit(client: Client) {
        editForm.setData({
            name: client.name,
            type: client.type,
            email: client.email ?? '',
            NPWP: client.NPWP ?? '',
            KPP: client.KPP ?? '',
            EFIN: client.EFIN ?? '',
            status: client.status,
            account_representative: client.account_representative ?? '',
            ar_phone_number: client.ar_phone_number ?? '',
            person_in_charge: client.person_in_charge ?? '',
            address: client.address ?? '',
        });
        setEditTarget(client);
    }

    function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editTarget) return;
        editForm.put(companyUrl(`/clients/${editTarget.id}`), {
            onSuccess: () => { setEditTarget(null); toast.success('Klien berhasil diperbarui.'); },
            onError: (errs) => toastErrors(errs, 'UpdateClient'),
        });
    }

    /* ── Delete ── */
    const deleteForm = useForm({});

    function confirmDelete() {
        if (!deleteTarget) return;
        deleteForm.delete(companyUrl(`/clients/${deleteTarget.id}`), {
            onSuccess: () => { setDeleteTarget(null); toast.success('Klien berhasil dihapus.'); },
            onError: (errs) => toastErrors(errs, 'DeleteClient'),
        });
    }

    const activeFilters = [search, typeFilter, statusFilter].filter(Boolean).length;

    return (
        <>
            <Head title="Klien" />

            <div className="space-y-6">
                {/* Header */}
                <PageHeader
                    title="Klien"
                    description="Kelola data klien dan informasi kontak"
                    action={
                        <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                            Tambah Klien
                        </Button>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Klien" value={stats.total} icon={<Users className="w-6 h-6" />} color="blue" />
                    <StatsCard label="Klien Aktif" value={stats.active} icon={<User className="w-6 h-6" />} color="green" />
                    <StatsCard label="Individu" value={stats.individual} icon={<User className="w-6 h-6" />} color="purple" />
                    <StatsCard label="Perusahaan" value={stats.company} icon={<Building2 className="w-6 h-6" />} color="indigo" />
                </div>

                {/* Filters */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="relative">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama, email, NPWP..."
                                icon={<Search className="h-4 w-4" />}
                                className={search ? 'pr-8' : ''}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => { setSearch(''); applyFilters({ search: '' }); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <Combobox
                            options={[
                                { value: 'individual', label: 'Individu' },
                                { value: 'company', label: 'Perusahaan' },
                            ]}
                            value={typeFilter || null}
                            onChange={(v) => handleTypeFilter(v ? String(v) : '')}
                            placeholder="Semua Tipe"
                        />

                        <Combobox
                            options={[
                                { value: 'Active', label: 'Aktif' },
                                { value: 'Inactive', label: 'Tidak Aktif' },
                            ]}
                            value={statusFilter || null}
                            onChange={(v) => handleStatusFilter(v ? String(v) : '')}
                            placeholder="Semua Status"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        {activeFilters > 0 && (
                            <Badge variant="blue">{activeFilters} filter aktif</Badge>
                        )}
                        <span className="text-sm text-dark-500 dark:text-dark-400">
                            {clients.from ?? 0}–{clients.to ?? 0} dari {clients.total} klien
                        </span>
                        {activeFilters > 0 && (
                            <button
                                onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); applyFilters({ search: '', type: '', status: '' }); }}
                                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            >
                                Reset filter
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Nama</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Tipe</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Kontak</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Status</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Invoice</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Finansial</th>
                                    <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                {clients.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-dark-400 dark:text-dark-500">
                                            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                            <p>Belum ada klien</p>
                                        </td>
                                    </tr>
                                ) : (
                                    clients.data.map((client) => (
                                        <tr key={client.id} className="hover:bg-secondary-50/80 dark:hover:bg-dark-800/50 transition-colors cursor-pointer">
                                            <td className="px-3 py-3 align-middle">
                                                <div className="font-medium text-dark-900 dark:text-dark-50">{client.name}</div>
                                                {client.NPWP && <div className="text-xs text-dark-400 dark:text-dark-500">{client.NPWP}</div>}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <Badge variant={client.type === 'company' ? 'purple' : 'blue'}>
                                                    {client.type === 'company' ? 'Perusahaan' : 'Individu'}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-600 dark:text-dark-400">
                                                {client.person_in_charge && <div>{client.person_in_charge}</div>}
                                                {client.email && <div className="text-xs">{client.email}</div>}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <Badge variant={client.status === 'Active' ? 'green' : 'zinc'}>
                                                    {client.status === 'Active' ? 'Aktif' : 'Tidak Aktif'}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-600 dark:text-dark-400">
                                                {client.invoices_count}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <div className="text-xs text-dark-400 dark:text-dark-500">Total</div>
                                                <div className="font-medium text-dark-900 dark:text-dark-50 text-xs">{formatCurrency(client.total_invoice_amount)}</div>
                                                <div className="text-xs text-red-500">{formatCurrency(client.total_invoice_amount - client.paid_invoice_amount)} outstanding</div>
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon-sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(client)} />
                                                    <Button variant="ghost" size="icon-sm" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} onClick={() => setDeleteTarget(client)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                        <Pagination
                            meta={{
                                current_page: clients.current_page,
                                last_page: clients.last_page,
                                per_page: clients.per_page,
                                total: clients.total,
                                from: clients.from,
                                to: clients.to,
                            }}
                            onPageChange={(page) => router.get(companyUrl('/clients'), { ...filters, page }, { preserveState: true })}
                        />
                    </div>
                </div>
            </div>

            {/* Create modal */}
            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) createForm.reset(); }}>
                <DialogContent size="3xl">
                    <form onSubmit={submitCreate}>
                        <ClientForm
                            data={createForm.data}
                            setData={(f, v) => createForm.setData(f, v)}
                            errors={createForm.errors}
                            processing={createForm.processing}
                            onCancel={() => { setCreateOpen(false); createForm.reset(); }}
                            title="Tambah Klien"
                            submitLabel="Simpan Klien"
                        />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit modal */}
            <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
                <DialogContent size="3xl">
                    <form onSubmit={submitEdit}>
                        <ClientForm
                            data={editForm.data}
                            setData={(f, v) => editForm.setData(f, v)}
                            errors={editForm.errors}
                            processing={editForm.processing}
                            onCancel={() => setEditTarget(null)}
                            title="Edit Klien"
                            submitLabel="Perbarui Klien"
                        />
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
                title="Hapus Klien"
                description={deleteTarget ? `Apakah Anda yakin ingin menghapus "${deleteTarget.name}"? Semua invoice terkait akan ikut dihapus.` : ''}
                confirmLabel="Hapus Klien"
                loading={deleteForm.processing}
                onConfirm={confirmDelete}
            />
        </>
    );
}

ClientsIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
