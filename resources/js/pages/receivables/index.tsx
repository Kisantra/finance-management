import { Head, router, useForm } from '@inertiajs/react';
import {
    Banknote,
    CheckCircle2,
    Edit,
    FileText,
    Loader2,
    Plus,
    Search,
    Send,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { EmptyState } from '@/components/shared/empty-state';
import { FileUpload } from '@/components/shared/file-upload';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatsCard } from '@/components/shared/stats-card';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { AppLayout } from '@/layouts/app-layout';
import { cn, formatCurrency, formatDate, toLocalIso } from '@/lib/utils';
import * as receivableRoutes from '@/routes/receivables';
import type {
    FilterOption,
    PaginationMeta,
    ReceivableFilters,
    ReceivableRow,
    ReceivableStats,
} from './types';

interface Props {
    rows: ReceivableRow[];
    pagination: PaginationMeta;
    stats: ReceivableStats;
    filters: ReceivableFilters;
    bankAccountOptions: FilterOption[];
    employeeOptions: FilterOption[];
    companyOptions: FilterOption[];
    nextReceivableNumber: string;
    canApprove: boolean;
    canPay: boolean;
}

const STATUS_OPTIONS: FilterOption[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Menunggu Persetujuan', value: 'pending_approval' },
    { label: 'Aktif', value: 'active' },
    { label: 'Lunas', value: 'paid_off' },
    { label: 'Ditolak', value: 'rejected' },
];

const TYPE_OPTIONS: FilterOption[] = [
    { label: 'Pinjaman Karyawan', value: 'employee_loan' },
    { label: 'Pinjaman Perusahaan', value: 'company_loan' },
];

const PAYMENT_METHOD_OPTIONS: FilterOption[] = [
    { label: 'Transfer Bank', value: 'bank_transfer' },
    { label: 'Kas', value: 'cash' },
    { label: 'Potongan Gaji', value: 'payroll_deduction' },
];

function isoOrNull(d: Date | null): string | null {
    return d ? toLocalIso(d) : null;
}

function statusBadge(status: string) {
    const map: Record<string, JSX.Element> = {
        draft: <Badge variant="zinc">Draft</Badge>,
        pending_approval: <Badge variant="yellow">Menunggu</Badge>,
        active: <Badge variant="blue">Aktif</Badge>,
        paid_off: <Badge variant="emerald">Lunas</Badge>,
        rejected: <Badge variant="red">Ditolak</Badge>,
    };
    return map[status] ?? <Badge variant="zinc">{status}</Badge>;
}

function typeBadge(type: string) {
    return type === 'employee_loan'
        ? <Badge variant="purple">Karyawan</Badge>
        : <Badge variant="orange">Perusahaan</Badge>;
}

export default function ReceivablesIndex({
    rows,
    pagination,
    stats,
    filters,
    bankAccountOptions,
    employeeOptions,
    companyOptions,
    nextReceivableNumber,
    canApprove,
    canPay,
}: Props) {
    const [search, setSearch] = React.useState(filters.search ?? '');
    const [detailRow, setDetailRow] = React.useState<ReceivableRow | null>(null);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [editRow, setEditRow] = React.useState<ReceivableRow | null>(null);
    const [payRow, setPayRow] = React.useState<ReceivableRow | null>(null);
    const [approveRow, setApproveRow] = React.useState<ReceivableRow | null>(null);
    const [deleteRow, setDeleteRow] = React.useState<ReceivableRow | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);
    const [submitRow, setSubmitRow] = React.useState<ReceivableRow | null>(null);
    const [submitProcessing, setSubmitProcessing] = React.useState(false);

    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<ReceivableFilters>) => {
        const next = { ...filters, ...patch };
        router.get(
            receivableRoutes.index.url(),
            {
                search: next.search || undefined,
                status: next.status || undefined,
                type: next.type || undefined,
                per_page: next.per_page,
                page: next.page,
            },
            { preserveScroll: true, preserveState: true, only: ['rows', 'pagination', 'stats', 'filters'], replace: true },
        );
    };

    const reset = () => {
        setSearch('');
        router.get(receivableRoutes.index.url(), {}, { preserveScroll: true });
    };

    const handleSubmit = () => {
        if (!submitRow) return;
        setSubmitProcessing(true);
        router.post(
            receivableRoutes.submit.url({ receivable: submitRow.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Piutang berhasil diajukan untuk persetujuan');
                    setSubmitRow(null);
                    setDetailRow(null);
                },
                onError: () => toast.error('Gagal mengajukan'),
                onFinish: () => setSubmitProcessing(false),
            },
        );
    };

    const handleDelete = () => {
        if (!deleteRow) return;
        setDeleteProcessing(true);
        router.delete(receivableRoutes.destroy.url({ receivable: deleteRow.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Piutang berhasil dihapus');
                setDeleteRow(null);
                setDetailRow(null);
            },
            onError: () => toast.error('Gagal menghapus'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const activeFilters = [filters.status, filters.type].filter(Boolean).length;

    return (
        <AppLayout>
            <Head title="Piutang" />
            <div className="space-y-6">
                <PageHeader
                    title="Piutang"
                    description="Kelola piutang karyawan dan perusahaan"
                    action={
                        <div className="flex items-center gap-2">
                            <TutorialButton slug="receivables" />
                            <Button onClick={() => setCreateOpen(true)} size="sm">
                                <Plus className="mr-1.5 h-4 w-4" />
                                Tambah Piutang
                            </Button>
                        </div>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatsCard label="Total Piutang" value={stats.total} icon={<Wallet className="h-6 w-6" />} color="blue" />
                    <StatsCard label="Aktif" value={stats.active_count} icon={<CheckCircle2 className="h-6 w-6" />} color="green" />
                    <StatsCard label="Menunggu Persetujuan" value={stats.pending_count} icon={<Send className="h-6 w-6" />} color="yellow" />
                    <StatsCard label="Total Pokok Aktif" value={formatCurrency(stats.total_principal_active)} icon={<Banknote className="h-6 w-6" />} color="purple" />
                </div>

                {/* Filters */}
                <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
                                <input
                                    className="h-9 w-full rounded-lg border border-secondary-200 bg-white pl-9 pr-3 text-sm text-dark-900 placeholder-dark-400 focus:border-primary-500 focus:outline-none dark:border-dark-600 dark:bg-dark-800 dark:text-dark-50 dark:placeholder-dark-400"
                                    placeholder="Cari nomor, tujuan..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <X className="h-3.5 w-3.5 text-dark-400" />
                                    </button>
                                )}
                            </div>
                            <Combobox
                                options={STATUS_OPTIONS}
                                value={filters.status ?? ''}
                                onChange={(v) => apply({ status: v as string, page: 1 })}
                                placeholder="Semua status"
                                emptyText="Status tidak ditemukan"
                            />
                            <Combobox
                                options={TYPE_OPTIONS}
                                value={filters.type ?? ''}
                                onChange={(v) => apply({ type: v as string, page: 1 })}
                                placeholder="Semua tipe"
                                emptyText="Tipe tidak ditemukan"
                            />
                        </div>
                        {(activeFilters > 0 || search) && (
                            <Button variant="ghost" size="sm" onClick={reset}>
                                <X className="mr-1 h-3.5 w-3.5" />
                                Reset
                            </Button>
                        )}
                    </div>
                    <p className="text-sm text-dark-500 dark:text-dark-400">
                        Menampilkan {pagination.from ?? 0}–{pagination.to ?? 0} dari {pagination.total} piutang
                    </p>
                </div>

                {/* Table */}
                {rows.length === 0 ? (
                    <EmptyState
                        icon={<Wallet className="h-10 w-10" />}
                        title="Belum ada piutang"
                        description="Tambahkan piutang baru untuk mulai melacak pembayaran"
                        action={<Button onClick={() => setCreateOpen(true)}>Tambah Piutang</Button>}
                    />
                ) : (
                    <div className="overflow-hidden rounded-xl border border-secondary-200 bg-white dark:border-dark-600 dark:bg-dark-700">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Nomor</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Tipe</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Peminjam</th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Pokok</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-dark-500 dark:text-dark-400">Cicilan</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Tanggal</th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Sisa Pokok</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-dark-500 dark:text-dark-400">Status</th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                    {rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="cursor-pointer transition-colors hover:bg-secondary-50/80 dark:hover:bg-dark-800/50"
                                            onClick={() => setDetailRow(row)}
                                        >
                                            <td className="px-3 py-3 align-middle font-mono text-xs font-medium text-primary-600 dark:text-primary-400">
                                                {row.receivable_number}
                                            </td>
                                            <td className="px-3 py-3 align-middle">{typeBadge(row.type)}</td>
                                            <td className="px-3 py-3 align-middle font-medium text-dark-900 dark:text-dark-50">
                                                {row.debtor_name ?? '—'}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right text-dark-900 dark:text-dark-50">
                                                {formatCurrency(row.principal_amount)}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-center text-dark-600 dark:text-dark-400">
                                                {row.installment_months}× {formatCurrency(row.installment_amount)}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-600 dark:text-dark-400">
                                                {formatDate(row.loan_date)}
                                            </td>
                                            <td className={cn(
                                                'px-3 py-3 align-middle text-right font-medium',
                                                row.remaining_principal > 0
                                                    ? 'text-orange-600 dark:text-orange-400'
                                                    : 'text-emerald-600 dark:text-emerald-400',
                                            )}>
                                                {row.status === 'active' || row.status === 'paid_off'
                                                    ? (row.remaining_principal > 0 ? formatCurrency(row.remaining_principal) : 'Lunas')
                                                    : '—'}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-center">{statusBadge(row.status)}</td>
                                            <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">
                                                    {row.can_submit && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                                                            title="Ajukan"
                                                            onClick={() => setSubmitRow(row)}
                                                        >
                                                            <Send className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {row.can_approve && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                            title="Proses Persetujuan"
                                                            onClick={() => setApproveRow(row)}
                                                        >
                                                            <ThumbsUp className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {row.can_pay && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                                                            title="Catat Pembayaran"
                                                            onClick={() => setPayRow(row)}
                                                        >
                                                            <Banknote className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {row.can_edit && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                                            title="Edit"
                                                            onClick={() => setEditRow(row)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {row.can_delete && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            title="Hapus"
                                                            onClick={() => setDeleteRow(row)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {pagination.last_page > 1 && (
                    <Pagination
                        currentPage={pagination.current_page}
                        lastPage={pagination.last_page}
                        perPage={pagination.per_page}
                        total={pagination.total}
                        onPageChange={(page) => apply({ page })}
                    />
                )}
            </div>

            {/* Create Sheet */}
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
                <SheetContent size="xl">
                    <SheetHeader>
                        <div className="flex items-center gap-4 py-1">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/20">
                                <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <SheetTitle>Tambah Piutang</SheetTitle>
                                <SheetDescription>Buat catatan piutang baru</SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                    <ReceivableForm
                        mode="create"
                        nextReceivableNumber={nextReceivableNumber}
                        employeeOptions={employeeOptions}
                        companyOptions={companyOptions}
                        onClose={() => setCreateOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Edit Sheet */}
            <Sheet open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <SheetContent size="xl">
                    <SheetHeader>
                        <div className="flex items-center gap-4 py-1">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
                                <Edit className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div>
                                <SheetTitle>Edit Piutang</SheetTitle>
                                <SheetDescription>{editRow?.receivable_number}</SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                    {editRow && (
                        <ReceivableForm
                            mode="edit"
                            row={editRow}
                            employeeOptions={employeeOptions}
                            companyOptions={companyOptions}
                            onClose={() => setEditRow(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Approve Dialog */}
            {approveRow && (
                <ApproveReceivableDialog
                    row={approveRow}
                    bankAccountOptions={bankAccountOptions}
                    onClose={() => setApproveRow(null)}
                />
            )}

            {/* Pay Dialog */}
            {payRow && (
                <PayReceivableDialog
                    row={payRow}
                    bankAccountOptions={bankAccountOptions}
                    onClose={() => setPayRow(null)}
                />
            )}

            {/* Detail Dialog */}
            <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <Wallet className="h-5 w-5 text-primary-600" />
                            {detailRow?.receivable_number}
                        </DialogTitle>
                    </DialogHeader>
                    {detailRow && (
                        <ReceivableDetail
                            row={detailRow}
                            canApprove={canApprove}
                            canPay={canPay}
                            onEdit={() => { setDetailRow(null); setEditRow(detailRow); }}
                            onPay={() => { setDetailRow(null); setPayRow(detailRow); }}
                            onApprove={() => { setDetailRow(null); setApproveRow(detailRow); }}
                            onSubmit={() => { setDetailRow(null); setSubmitRow(detailRow); }}
                            onDelete={() => { setDetailRow(null); setDeleteRow(detailRow); }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Submit Confirm */}
            <ConfirmDialog
                open={!!submitRow}
                onOpenChange={(o) => !o && setSubmitRow(null)}
                onConfirm={handleSubmit}
                title="Ajukan Piutang?"
                description={`Piutang ${submitRow?.receivable_number} akan diajukan untuk persetujuan.`}
                variant="warning"
            />

            {/* Delete Confirm */}
            <ConfirmDialog
                open={!!deleteRow}
                onOpenChange={(o) => !o && setDeleteRow(null)}
                onConfirm={handleDelete}
                title="Hapus Piutang?"
                description={`Piutang ${deleteRow?.receivable_number} akan dihapus permanen.`}
                variant="danger"
            />
        </AppLayout>
    );
}

/* -------------------------------------------------------------------------- */
/* ReceivableForm                                                              */
/* -------------------------------------------------------------------------- */

interface ReceivableFormProps {
    mode: 'create' | 'edit';
    row?: ReceivableRow;
    nextReceivableNumber?: string;
    employeeOptions: FilterOption[];
    companyOptions: FilterOption[];
    onClose: () => void;
}

function ReceivableForm({ mode, row, nextReceivableNumber, employeeOptions, companyOptions, onClose }: ReceivableFormProps) {
    const isEdit = mode === 'edit';
    const { data, setData, post, processing, errors, reset } = useForm<{
        type: 'employee_loan' | 'company_loan';
        debtor_id: number | null;
        principal_amount: number;
        interest_type: 'fixed' | 'percentage';
        interest_amount: number;
        interest_rate: number | string;
        installment_months: number | string;
        loan_date: string;
        purpose: string;
        notes: string;
        disbursement_account: string;
        contract_attachment: File | null;
        remove_attachment: boolean;
        _method: string;
    }>({
        type: row?.type ?? 'employee_loan',
        debtor_id: row?.debtor_id !== undefined ? (row as any).debtor_id : null,
        principal_amount: row?.principal_amount ?? 0,
        interest_type: 'percentage',
        interest_amount: 0,
        interest_rate: row?.interest_rate ?? '',
        installment_months: row?.installment_months ?? '',
        loan_date: row?.loan_date ?? toLocalIso(new Date()),
        purpose: row?.purpose ?? '',
        notes: row?.notes ?? '',
        disbursement_account: row?.disbursement_account ?? '',
        contract_attachment: null,
        remove_attachment: false,
        _method: isEdit ? 'PUT' : 'POST',
    });

    const debtorOptions = data.type === 'employee_loan' ? employeeOptions : companyOptions;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const url = isEdit
            ? receivableRoutes.update.url({ receivable: row!.id })
            : receivableRoutes.store.url();
        post(url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isEdit ? 'Piutang berhasil diperbarui' : 'Piutang berhasil dibuat');
                reset();
                onClose();
            },
            onError: () => toast.error('Gagal menyimpan piutang'),
        });
    };

    return (
        <form id="receivable-form" onSubmit={handleSubmit} className="contents">
            <SheetBody className="space-y-6">
                <div className="border-b border-secondary-200 pb-2 dark:border-dark-600">
                    <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Informasi Peminjam</h4>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Tipe pinjaman dan data penerima</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <Label className="mb-1.5 block text-sm font-medium">Tipe Piutang *</Label>
                        <div className="flex gap-3">
                            {(['employee_loan', 'company_loan'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => { setData('type', t); setData('debtor_id', null); }}
                                    className={cn(
                                        'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                                        data.type === t
                                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                                            : 'border-secondary-200 text-dark-600 hover:border-primary-300 dark:border-dark-600 dark:text-dark-300',
                                    )}
                                >
                                    {t === 'employee_loan' ? 'Pinjaman Karyawan' : 'Pinjaman Perusahaan'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <Label className="mb-1.5 block text-sm font-medium">
                            {data.type === 'employee_loan' ? 'Karyawan *' : 'Perusahaan *'}
                        </Label>
                        <Combobox
                            options={debtorOptions}
                            value={data.debtor_id ?? ''}
                            onChange={(v) => setData('debtor_id', v as number)}
                            placeholder={data.type === 'employee_loan' ? 'Pilih karyawan...' : 'Pilih perusahaan...'}
                            searchPlaceholder="Cari..."
                            emptyText="Tidak ditemukan"
                        />
                        {errors.debtor_id && <p className="mt-1 text-xs text-red-500">{errors.debtor_id}</p>}
                    </div>
                </div>

                <div className="border-t border-secondary-200 pt-4 dark:border-dark-600" />
                <div className="border-b border-secondary-200 pb-2 dark:border-dark-600">
                    <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Detail Pinjaman</h4>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Jumlah, bunga, dan jadwal cicilan</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <CurrencyInput
                            label="Jumlah Pokok *"
                            value={data.principal_amount}
                            onChange={(v) => setData('principal_amount', v)}
                            error={errors.principal_amount}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <Label className="mb-1.5 block text-sm font-medium">Tipe Bunga *</Label>
                        <div className="flex gap-3">
                            {(['percentage', 'fixed'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setData('interest_type', t)}
                                    className={cn(
                                        'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                                        data.interest_type === t
                                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                                            : 'border-secondary-200 text-dark-600 hover:border-primary-300 dark:border-dark-600 dark:text-dark-300',
                                    )}
                                >
                                    {t === 'percentage' ? 'Persentase (%)' : 'Tetap (fixed)'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {data.interest_type === 'percentage' ? (
                        <Input
                            label="Suku Bunga (%)"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={data.interest_rate as string}
                            onChange={(e) => setData('interest_rate', e.target.value)}
                            error={errors.interest_rate}
                            placeholder="0"
                        />
                    ) : (
                        <CurrencyInput
                            label="Jumlah Bunga Tetap"
                            value={data.interest_amount}
                            onChange={(v) => setData('interest_amount', v)}
                            error={errors.interest_amount}
                        />
                    )}
                    <Input
                        label="Jumlah Cicilan (bulan) *"
                        type="number"
                        min="1"
                        value={data.installment_months as string}
                        onChange={(e) => setData('installment_months', e.target.value)}
                        error={errors.installment_months}
                        placeholder="12"
                    />
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium">Tanggal Pinjaman *</Label>
                        <DatePicker
                            value={data.loan_date ? new Date(data.loan_date) : null}
                            onChange={(d) => setData('loan_date', isoOrNull(d ?? null) ?? '')}
                        />
                        {errors.loan_date && <p className="mt-1 text-xs text-red-500">{errors.loan_date}</p>}
                    </div>
                </div>

                <div className="border-t border-secondary-200 pt-4 dark:border-dark-600" />
                <div className="border-b border-secondary-200 pb-2 dark:border-dark-600">
                    <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Pencairan & Dokumen</h4>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Rekening pencairan dan dokumen kontrak</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <Input
                        label="Rekening/Cara Pencairan *"
                        value={data.disbursement_account}
                        onChange={(e) => setData('disbursement_account', e.target.value)}
                        error={errors.disbursement_account}
                        placeholder="Contoh: BCA 1234567890 / Kas"
                    />
                    <Input
                        label="Tujuan *"
                        value={data.purpose}
                        onChange={(e) => setData('purpose', e.target.value)}
                        error={errors.purpose}
                        placeholder="Tujuan pinjaman"
                    />
                    <Textarea
                        label="Catatan"
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        placeholder="Catatan tambahan (opsional)"
                        rows={2}
                    />
                    <FileUpload
                        label="Dokumen Kontrak"
                        value={data.contract_attachment}
                        onChange={(f) => setData('contract_attachment', f)}
                        error={errors.contract_attachment}
                        existingFileName={isEdit && row?.contract_attachment_url && !data.remove_attachment ? (row.contract_attachment_name ?? 'Lihat kontrak') : null}
                        existingFileUrl={isEdit && row?.contract_attachment_url && !data.remove_attachment ? row.contract_attachment_url : null}
                        onRemoveExisting={() => setData('remove_attachment', true)}
                    />
                </div>
            </SheetBody>
            <SheetFooter>
                <Button type="button" variant="zinc" onClick={onClose}>Batal</Button>
                <Button type="submit" form="receivable-form" disabled={processing}>
                    {processing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    {isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
                </Button>
            </SheetFooter>
        </form>
    );
}

/* -------------------------------------------------------------------------- */
/* ApproveReceivableDialog                                                     */
/* -------------------------------------------------------------------------- */

function ApproveReceivableDialog({ row, bankAccountOptions, onClose }: { row: ReceivableRow; bankAccountOptions: FilterOption[]; onClose: () => void }) {
    const [action, setAction] = React.useState<'approve' | 'reject'>('approve');
    const { data, setData, post, processing, errors } = useForm({
        action: 'approve',
        bank_account_id: null as number | null,
        notes: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(receivableRoutes.approve.url({ receivable: row.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(action === 'approve' ? 'Piutang berhasil disetujui' : 'Piutang ditolak');
                onClose();
            },
            onError: () => toast.error('Gagal memproses'),
        });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent size="md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <ThumbsUp className="h-5 w-5 text-emerald-600" />
                        Proses Persetujuan
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 rounded-xl border border-secondary-200 bg-secondary-50 p-4 dark:border-dark-600 dark:bg-dark-800 text-sm">
                    <div className="flex justify-between">
                        <span className="text-dark-500 dark:text-dark-400">Nomor</span>
                        <span className="font-medium text-dark-900 dark:text-dark-50">{row.receivable_number}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-dark-500 dark:text-dark-400">Peminjam</span>
                        <span className="font-medium text-dark-900 dark:text-dark-50">{row.debtor_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-dark-500 dark:text-dark-400">Jumlah</span>
                        <span className="font-semibold text-dark-900 dark:text-dark-50">{formatCurrency(row.principal_amount)}</span>
                    </div>
                </div>
                <form id="approve-form" onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-3">
                        {(['approve', 'reject'] as const).map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => { setAction(a); setData('action', a); }}
                                className={cn(
                                    'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                                    data.action === a
                                        ? a === 'approve'
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                            : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                        : 'border-secondary-200 text-dark-600 dark:border-dark-600 dark:text-dark-300',
                                )}
                            >
                                {a === 'approve' ? '✓ Setujui' : '✕ Tolak'}
                            </button>
                        ))}
                    </div>
                    {data.action === 'approve' && (
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium">Rekening Pencairan *</Label>
                            <Combobox
                                options={bankAccountOptions}
                                value={data.bank_account_id ?? ''}
                                onChange={(v) => setData('bank_account_id', v as number)}
                                placeholder="Pilih rekening..."
                                emptyText="Rekening tidak ditemukan"
                            />
                            {errors.bank_account_id && <p className="mt-1 text-xs text-red-500">{errors.bank_account_id}</p>}
                        </div>
                    )}
                    <Textarea
                        label={data.action === 'reject' ? 'Alasan Penolakan *' : 'Catatan (opsional)'}
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        error={errors.notes}
                        rows={3}
                    />
                </form>
                <DialogFooter>
                    <Button type="button" variant="zinc" onClick={onClose}>Batal</Button>
                    <Button
                        type="submit"
                        form="approve-form"
                        variant={data.action === 'approve' ? 'primary' : 'red'}
                        disabled={processing}
                    >
                        {processing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        {data.action === 'approve' ? 'Setujui & Cairkan' : 'Tolak'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* -------------------------------------------------------------------------- */
/* PayReceivableDialog                                                         */
/* -------------------------------------------------------------------------- */

function PayReceivableDialog({ row, bankAccountOptions, onClose }: { row: ReceivableRow; bankAccountOptions: FilterOption[]; onClose: () => void }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        bank_account_id: null as number | null,
        payment_date: toLocalIso(new Date()),
        principal_paid: 0,
        interest_paid: 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        notes: '',
    });

    const totalInterest = Math.round(row.principal_amount * row.interest_rate / 100);
    const remainingInterest = Math.max(0, totalInterest - row.paid_interest);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(receivableRoutes.pay.url({ receivable: row.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Pembayaran piutang berhasil dicatat');
                reset();
                onClose();
            },
            onError: () => toast.error('Gagal mencatat pembayaran'),
        });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent size="md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <Banknote className="h-5 w-5 text-primary-600" />
                        Catat Pembayaran Piutang
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 rounded-xl border border-secondary-200 bg-secondary-50 p-4 dark:border-dark-600 dark:bg-dark-800 text-sm">
                    <div className="flex justify-between">
                        <span className="text-dark-500 dark:text-dark-400">Peminjam</span>
                        <span className="font-medium text-dark-900 dark:text-dark-50">{row.debtor_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-dark-500 dark:text-dark-400">Sisa Pokok</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(row.remaining_principal)}</span>
                    </div>
                    {remainingInterest > 0 && (
                        <div className="flex justify-between">
                            <span className="text-dark-500 dark:text-dark-400">Sisa Bunga</span>
                            <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(remainingInterest)}</span>
                        </div>
                    )}
                </div>
                <form id="pay-receivable-form" onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium">Metode Pembayaran *</Label>
                        <Combobox
                            options={PAYMENT_METHOD_OPTIONS}
                            value={data.payment_method}
                            onChange={(v) => setData('payment_method', v as string)}
                            placeholder="Pilih metode..."
                            emptyText="Tidak ditemukan"
                        />
                    </div>
                    {data.payment_method === 'bank_transfer' && (
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium">Rekening *</Label>
                            <Combobox
                                options={bankAccountOptions}
                                value={data.bank_account_id ?? ''}
                                onChange={(v) => setData('bank_account_id', v as number)}
                                placeholder="Pilih rekening..."
                                emptyText="Rekening tidak ditemukan"
                            />
                            {errors.bank_account_id && <p className="mt-1 text-xs text-red-500">{errors.bank_account_id}</p>}
                        </div>
                    )}
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium">Tanggal Pembayaran *</Label>
                        <DatePicker
                            value={data.payment_date ? new Date(data.payment_date) : null}
                            onChange={(d) => setData('payment_date', isoOrNull(d ?? null) ?? '')}
                        />
                    </div>
                    <CurrencyInput
                        label={`Pembayaran Pokok (maks. ${formatCurrency(row.remaining_principal)})`}
                        value={data.principal_paid}
                        onChange={(v) => setData('principal_paid', v)}
                        error={errors.principal_paid}
                    />
                    {remainingInterest > 0 && (
                        <CurrencyInput
                            label={`Pembayaran Bunga (maks. ${formatCurrency(remainingInterest)})`}
                            value={data.interest_paid}
                            onChange={(v) => setData('interest_paid', v)}
                            error={errors.interest_paid}
                        />
                    )}
                    <Input
                        label="Nomor Referensi"
                        value={data.reference_number}
                        onChange={(e) => setData('reference_number', e.target.value)}
                        placeholder="Opsional"
                    />
                </form>
                <DialogFooter>
                    <Button type="button" variant="zinc" onClick={onClose}>Batal</Button>
                    <Button type="submit" form="pay-receivable-form" disabled={processing}>
                        {processing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        Simpan Pembayaran
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* -------------------------------------------------------------------------- */
/* ReceivableDetail                                                            */
/* -------------------------------------------------------------------------- */

function ReceivableDetail({ row, canApprove, canPay, onEdit, onPay, onApprove, onSubmit, onDelete }: {
    row: ReceivableRow;
    canApprove: boolean;
    canPay: boolean;
    onEdit: () => void;
    onPay: () => void;
    onApprove: () => void;
    onSubmit: () => void;
    onDelete: () => void;
}) {
    const pctPaid = row.principal_amount > 0 && row.status === 'active'
        ? Math.round((row.paid_principal / row.principal_amount) * 100)
        : 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Tipe</p>
                    <div className="mt-1">{typeBadge(row.type)}</div>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Status</p>
                    <div className="mt-1">{statusBadge(row.status)}</div>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Peminjam</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{row.debtor_name ?? '—'}</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Pokok</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatCurrency(row.principal_amount)}</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Suku Bunga</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{row.interest_rate}%</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Cicilan</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{row.installment_months}× {formatCurrency(row.installment_amount)}</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Tanggal Pinjaman</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatDate(row.loan_date)}</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Jatuh Tempo</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatDate(row.due_date)}</p>
                </div>
            </div>

            {row.status === 'active' && (
                <div className="rounded-xl border border-secondary-200 p-4 dark:border-dark-600">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-dark-600 dark:text-dark-300">Progres Pembayaran</span>
                        <span className="font-semibold text-dark-900 dark:text-dark-50">{pctPaid}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary-200 dark:bg-dark-600">
                        <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pctPaid}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-dark-400">
                        <span>Dibayar: {formatCurrency(row.paid_principal)}</span>
                        <span>Sisa: {formatCurrency(row.remaining_principal)}</span>
                    </div>
                </div>
            )}

            {row.rejection_reason && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/10">
                    <p className="mb-1 text-xs font-medium text-red-600 dark:text-red-400">Alasan Penolakan</p>
                    <p className="text-sm text-dark-900 dark:text-dark-50">{row.rejection_reason}</p>
                </div>
            )}

            {row.contract_attachment_url && (
                <a
                    href={row.contract_attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-secondary-200 p-3 text-sm text-primary-600 transition-colors hover:bg-primary-50 dark:border-dark-600 dark:hover:bg-primary-900/10"
                >
                    <FileText className="h-4 w-4 shrink-0" />
                    {row.contract_attachment_name ?? 'Lihat Dokumen Kontrak'}
                </a>
            )}

            <div className="flex flex-wrap gap-2 border-t border-secondary-200 pt-3 dark:border-dark-600">
                {row.can_submit && (
                    <Button size="sm" onClick={onSubmit} className="flex-1">
                        <Send className="mr-1.5 h-4 w-4" />
                        Ajukan
                    </Button>
                )}
                {row.can_approve && (
                    <Button size="sm" variant="green" onClick={onApprove} className="flex-1">
                        <ThumbsUp className="mr-1.5 h-4 w-4" />
                        Proses
                    </Button>
                )}
                {row.can_pay && (
                    <Button size="sm" onClick={onPay} className="flex-1">
                        <Banknote className="mr-1.5 h-4 w-4" />
                        Catat Pembayaran
                    </Button>
                )}
                {row.can_edit && (
                    <Button size="sm" variant="outline" onClick={onEdit}>
                        <Edit className="h-4 w-4" />
                    </Button>
                )}
                {row.can_delete && (
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
