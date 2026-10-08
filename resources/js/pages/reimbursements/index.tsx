import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle,
    Clock,
    Edit,
    FileText,
    Filter,
    Paperclip,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsPanel } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { EmptyState } from '@/components/shared/empty-state';
import { FileUpload } from '@/components/shared/file-upload';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { AppLayout } from '@/layouts/app-layout';
import { cn, formatCurrency, formatDate, toastErrors, toLocalIso } from '@/lib/utils';
import type { SharedProps } from '@/types';
import * as reimbursementRoutes from '@/routes/reimbursements';
import type {
    FilterOption,
    PaginationMeta,
    ReimbursementFilters,
    ReimbursementRow,
    ReimbursementStats,
} from './types';

interface Props {
    rows: ReimbursementRow[];
    pagination: PaginationMeta;
    stats: ReimbursementStats;
    filters: ReimbursementFilters;
    bankAccountOptions: FilterOption[];
    categoryOptions: FilterOption[];
    canApprove: boolean;
    canPay: boolean;
    /** Server mengizinkan tab "Semua" (reviewer atau pembayar). */
    canSeeAll: boolean;
}

function isoOrNull(d: Date | null): string | null {
    return d ? toLocalIso(d) : null;
}
function parseIso(s: string | null): Date | null {
    return s ? new Date(s) : null;
}

const STATUS_OPTIONS: FilterOption[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Pending Review', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Paid', value: 'paid' },
];

const CATEGORY_OPTIONS = [
    { label: 'Transport', value: 'transport' },
    { label: 'Meals & Entertainment', value: 'meals' },
    { label: 'Office Supplies', value: 'office_supplies' },
    { label: 'Communication', value: 'communication' },
    { label: 'Accommodation', value: 'accommodation' },
    { label: 'Medical', value: 'medical' },
    { label: 'Other', value: 'other' },
];

export default function ReimbursementsIndex({
    rows,
    pagination,
    stats,
    filters,
    bankAccountOptions,
    categoryOptions,
    canApprove,
    canPay,
    canSeeAll,
}: Props) {
    const [selected, setSelected] = React.useState<number[]>([]);
    const [search, setSearch] = React.useState(filters.search ?? '');

    // Detail dialog
    const [detailRow, setDetailRow] = React.useState<ReimbursementRow | null>(null);

    // Create sheet
    const [createOpen, setCreateOpen] = React.useState(false);

    // Edit sheet
    const [editRow, setEditRow] = React.useState<ReimbursementRow | null>(null);

    // Review dialog
    const [reviewRow, setReviewRow] = React.useState<ReimbursementRow | null>(null);
    const [reviewAction, setReviewAction] = React.useState<'approve' | 'reject'>('approve');
    const [reviewNotes, setReviewNotes] = React.useState('');
    const [reviewCategoryId, setReviewCategoryId] = React.useState<number | null>(null);
    const [reviewProcessing, setReviewProcessing] = React.useState(false);

    // Pay dialog
    const [payRow, setPayRow] = React.useState<ReimbursementRow | null>(null);
    const [payBankAccountId, setPayBankAccountId] = React.useState<number | null>(null);
    const [payDate, setPayDate] = React.useState<Date | null>(new Date());
    const [payAmount, setPayAmount] = React.useState(0);
    const [payNotes, setPayNotes] = React.useState('');
    const [payProcessing, setPayProcessing] = React.useState(false);

    // Delete confirm
    const [deleteRow, setDeleteRow] = React.useState<ReimbursementRow | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    // Submit confirm
    const [submitRow, setSubmitRow] = React.useState<ReimbursementRow | null>(null);
    const [submitProcessing, setSubmitProcessing] = React.useState(false);

    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<ReimbursementFilters>) => {
        const next = { ...filters, ...patch };
        router.get(
            reimbursementRoutes.index.url(),
            {
                tab: next.tab,
                search: next.search || undefined,
                status: next.status || undefined,
                category: next.category || undefined,
                date_from: next.date_from || undefined,
                date_to: next.date_to || undefined,
                per_page: next.per_page,
                page: next.page,
            },
            { preserveScroll: true, preserveState: true, only: ['rows', 'pagination', 'stats', 'filters'], replace: true },
        );
    };

    const reset = () => {
        setSearch('');
        router.get(reimbursementRoutes.index.url(), { tab: filters.tab }, { preserveScroll: true });
    };

    const toggleAll = () => {
        setSelected(selected.length === rows.length ? [] : rows.map((r) => r.id));
    };
    const toggleOne = (id: number) =>
        setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    const rejectedByServer = (page: { props: unknown }) => !!(page.props as SharedProps).flash?.error;

    const handleDelete = (row: ReimbursementRow) => {
        setDeleteProcessing(true);
        router.delete(reimbursementRoutes.destroy.url({ reimbursement: row.id }), {
            preserveScroll: true,
            onSuccess: (page) => {
                setDeleteRow(null);
                if (rejectedByServer(page)) return;
                toast.success('Reimbursement berhasil dihapus');
                setDetailRow(null);
            },
            onError: (errors) => toastErrors(errors, 'Hapus reimbursement'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const handleSubmit = (row: ReimbursementRow) => {
        setSubmitProcessing(true);
        router.post(
            reimbursementRoutes.submit.url({ reimbursement: row.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    setSubmitRow(null);
                    if (rejectedByServer(page)) return;
                    toast.success('Reimbursement berhasil diajukan');
                    setDetailRow(null);
                },
                onError: (errors) => toastErrors(errors, 'Ajukan reimbursement'),
                onFinish: () => setSubmitProcessing(false),
            },
        );
    };

    const handleReview = () => {
        if (!reviewRow) return;
        setReviewProcessing(true);
        router.post(
            reimbursementRoutes.review.url({ reimbursement: reviewRow.id }),
            {
                action: reviewAction,
                review_notes: reviewNotes || undefined,
                category_id: reviewAction === 'approve' ? reviewCategoryId : undefined,
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    if (rejectedByServer(page)) return;
                    toast.success(reviewAction === 'approve' ? 'Reimbursement disetujui' : 'Reimbursement ditolak');
                    setReviewRow(null);
                    setDetailRow(null);
                    setReviewNotes('');
                    setReviewCategoryId(null);
                },
                onError: (errors) => toastErrors(errors, 'Review reimbursement'),
                onFinish: () => setReviewProcessing(false),
            },
        );
    };

    const handlePay = () => {
        if (!payRow) return;
        setPayProcessing(true);
        router.post(
            reimbursementRoutes.pay.url({ reimbursement: payRow.id }),
            {
                bank_account_id: payBankAccountId,
                payment_date: payDate ? toLocalIso(payDate) : toLocalIso(new Date()),
                payment_amount: payAmount,
                reference_notes: payNotes || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    if (rejectedByServer(page)) return;
                    toast.success('Pembayaran berhasil diproses');
                    setPayRow(null);
                    setDetailRow(null);
                    setPayBankAccountId(null);
                    setPayAmount(0);
                    setPayNotes('');
                },
                onError: (errors) => toastErrors(errors, 'Pembayaran reimbursement'),
                onFinish: () => setPayProcessing(false),
            },
        );
    };

    const payOverRemaining = !!payRow && payAmount > payRow.amount_remaining;

    const openPayDialog = (row: ReimbursementRow) => {
        setPayRow(row);
        setPayAmount(row.amount_remaining);
        setPayDate(new Date());
        setPayBankAccountId(null);
        setPayNotes('');
    };

    const openReviewDialog = (row: ReimbursementRow, action: 'approve' | 'reject') => {
        setReviewRow(row);
        setReviewAction(action);
        setReviewNotes('');
        setReviewCategoryId(row.category_id);
    };

    const openEditSheet = (row: ReimbursementRow) => {
        setDetailRow(null);
        setEditRow(row);
    };

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        (filters.status ? 1 : 0) +
        (filters.category ? 1 : 0) +
        (filters.date_from && filters.date_to ? 1 : 0);

    const allSelected = rows.length > 0 && selected.length === rows.length;

    const tabItems = [
        ...(canSeeAll ? [{ value: 'all', label: 'Semua Pengajuan' }] : []),
        { value: 'my', label: 'Pengajuan Saya' },
    ];

    return (
        <AppLayout>
            <Head title="Reimbursement" />

            <div className="space-y-6">
                <PageHeader
                    title="Reimbursement"
                    description="Kelola pengajuan reimbursement biaya operasional."
                    action={
                        <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Buat Pengajuan
                        </Button>
                    }
                />

                {/* Stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total" value={stats.total} sub="pengajuan" color="blue" />
                    <StatCard label="Pending" value={stats.pending_count} sub="menunggu review" color="yellow" />
                    <StatCard label="Approved" value={stats.approved_count} sub="menunggu bayar" color="green" />
                    <StatCard label="Total Dibayar" value={formatCurrency(stats.total_paid)} color="purple" />
                </div>

                {/* Tabs */}
                {canApprove && (
                    <Tabs
                        items={tabItems}
                        value={filters.tab}
                        onChange={(v) => apply({ tab: v, page: 1 })}
                    />
                )}

                {/* Filters */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Combobox
                            label="Status"
                            options={STATUS_OPTIONS}
                            value={filters.status ?? null}
                            onChange={(v) => apply({ status: v ? String(v) : null, page: 1 })}
                            placeholder="Semua status"
                            clearable
                        />
                        <Combobox
                            label="Kategori"
                            options={CATEGORY_OPTIONS}
                            value={filters.category ?? null}
                            onChange={(v) => apply({ category: v ? String(v) : null, page: 1 })}
                            placeholder="Semua kategori"
                            clearable
                        />
                        <DatePicker
                            mode="range"
                            label="Rentang Tanggal"
                            value={{ from: parseIso(filters.date_from), to: parseIso(filters.date_to) }}
                            onChange={(r) => apply({ date_from: isoOrNull(r.from), date_to: isoOrNull(r.to), page: 1 })}
                            placeholder="Pilih rentang"
                            clearable
                        />
                        <Input
                            label="Cari"
                            icon={<Search className="w-4 h-4" />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Judul, deskripsi..."
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {activeFilterCount > 0 && (
                                <Badge variant="default" className="gap-1">
                                    <Filter className="w-3 h-3" />
                                    {activeFilterCount} filter aktif
                                </Badge>
                            )}
                            <span className="text-sm text-dark-500 dark:text-dark-400">
                                Menampilkan <span className="tabular-nums">{rows.length}</span> dari{' '}
                                <span className="tabular-nums">{pagination.total}</span> hasil
                            </span>
                        </div>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={reset}>
                                <X className="w-3.5 h-3.5" />
                                Reset
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                    {rows.length === 0 ? (
                        <EmptyState
                            icon={<FileText className="w-7 h-7" />}
                            title="Belum ada reimbursement"
                            description="Buat pengajuan reimbursement baru untuk memulai."
                            action={
                                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="w-4 h-4" />
                                    Buat Pengajuan
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                    <tr>
                                        <th className="w-10 px-4 py-3">
                                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                                        </th>
                                        {filters.tab === 'all' && (
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden md:table-cell">
                                                Pemohon
                                            </th>
                                        )}
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            Pengajuan
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden lg:table-cell">
                                            Tanggal
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            Jumlah
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            Status
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                    {rows.map((row) => {
                                        const isSelected = selected.includes(row.id);
                                        return (
                                        <tr
                                            key={row.id}
                                            onClick={() => setDetailRow(row)}
                                            className={cn(
                                                'transition-colors cursor-pointer',
                                                isSelected
                                                    ? 'bg-primary-50/50 dark:bg-primary-900/10'
                                                    : 'hover:bg-secondary-50/80 dark:hover:bg-dark-800/50',
                                            )}
                                        >
                                            <td
                                                className="px-4 py-3 align-middle"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleOne(row.id)}
                                                />
                                            </td>
                                            {filters.tab === 'all' && (
                                                <td className="px-3 py-3 align-middle hidden md:table-cell">
                                                    <span className="text-sm text-dark-700 dark:text-dark-300">{row.user_name}</span>
                                                </td>
                                            )}
                                            <td className="px-3 py-3 align-middle">
                                                <div className="font-medium text-dark-900 dark:text-dark-50 truncate max-w-56">
                                                    {row.title}
                                                </div>
                                                {row.category_label && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-secondary-100 dark:bg-dark-600 text-dark-500 dark:text-dark-400 border border-secondary-200 dark:border-dark-500 mt-0.5">
                                                        {row.category_label}
                                                    </span>
                                                )}
                                                {row.attachment_url && (
                                                    <span className="inline-flex items-center gap-1 mt-0.5 ml-1 text-xs text-primary-500">
                                                        <Paperclip className="w-3 h-3" />
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle hidden lg:table-cell">
                                                <span className="text-sm tabular-nums text-dark-600 dark:text-dark-400">{formatDate(row.expense_date)}</span>
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right">
                                                <span className="font-semibold text-dark-900 dark:text-dark-50 tabular-nums">
                                                    {formatCurrency(row.amount)}
                                                </span>
                                                {row.amount_paid > 0 && row.status !== 'paid' && (
                                                    <div className="text-xs text-dark-400 dark:text-dark-500">
                                                        sisa {formatCurrency(row.amount_remaining)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <StatusBadge status={row.status} />
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {row.can_submit && (
                                                        <Button variant="outline" size="sm" onClick={() => setSubmitRow(row)}>
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            Ajukan
                                                        </Button>
                                                    )}
                                                    {row.can_review && canApprove && (
                                                        <Button variant="outline" size="sm" onClick={() => openReviewDialog(row, 'approve')}>
                                                            <Clock className="w-3.5 h-3.5" />
                                                            Review
                                                        </Button>
                                                    )}
                                                    {row.can_pay && canPay && (
                                                        <Button variant="green" size="sm" onClick={() => openPayDialog(row)}>
                                                            Bayar
                                                        </Button>
                                                    )}
                                                    {row.can_edit && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => openEditSheet(row)}
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                    {row.can_delete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleteRow(row)}
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ); })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {pagination.last_page > 1 && (
                        <div className="px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                            <Pagination meta={pagination} onPageChange={(page) => apply({ page })} />
                        </div>
                    )}
                </div>
            </div>

            {/* Create sheet */}
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
                <SheetContent size="md">
                    <ReimbursementForm
                        mode="create"
                        onClose={() => setCreateOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Edit sheet */}
            <Sheet open={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null); }}>
                <SheetContent size="md">
                    {editRow && (
                        <ReimbursementForm
                            mode="edit"
                            row={editRow}
                            onClose={() => setEditRow(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Detail dialog */}
            <Dialog open={!!detailRow} onOpenChange={(open) => { if (!open) setDetailRow(null); }}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>{detailRow?.title}</DialogTitle>
                    </DialogHeader>
                    {detailRow && (
                        <div className="space-y-4 p-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <Field label="Pemohon" value={detailRow.user_name ?? '—'} />
                                <Field label="Tanggal Pengeluaran" value={formatDate(detailRow.expense_date)} />
                                <Field label="Kategori" value={detailRow.category_label} />
                                <Field label="Status" value={<StatusBadge status={detailRow.status} />} />
                                <Field label="Jumlah" value={formatCurrency(detailRow.amount)} />
                                <Field label="Sudah Dibayar" value={formatCurrency(detailRow.amount_paid)} />
                                {detailRow.reviewed_by_name && (
                                    <Field label="Direview oleh" value={detailRow.reviewed_by_name} />
                                )}
                                {detailRow.review_notes && (
                                    <div className="col-span-2">
                                        <Field label="Catatan Review" value={detailRow.review_notes} />
                                    </div>
                                )}
                            </div>
                            {detailRow.description && (
                                <div>
                                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">Deskripsi</p>
                                    <p className="text-sm text-dark-700 dark:text-dark-300">{detailRow.description}</p>
                                </div>
                            )}
                            {detailRow.attachment_url && (
                                <AttachmentPreviewButton
                                    url={detailRow.attachment_url}
                                    name={detailRow.attachment_name}
                                    label={detailRow.attachment_name ?? 'Lihat Lampiran'}
                                    className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                    iconSize="w-4 h-4"
                                />
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <div className="flex flex-wrap gap-2">
                            {detailRow?.can_submit && (
                                <Button variant="primary" size="sm" onClick={() => { setDetailRow(null); setSubmitRow(detailRow); }}>
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Ajukan
                                </Button>
                            )}
                            {detailRow?.can_review && canApprove && (
                                <>
                                    <Button variant="green" size="sm" onClick={() => { setDetailRow(null); openReviewDialog(detailRow, 'approve'); }}>
                                        Setujui
                                    </Button>
                                    <Button variant="red" size="sm" onClick={() => { setDetailRow(null); openReviewDialog(detailRow, 'reject'); }}>
                                        Tolak
                                    </Button>
                                </>
                            )}
                            {detailRow?.can_pay && canPay && (
                                <Button variant="green" size="sm" onClick={() => { setDetailRow(null); openPayDialog(detailRow); }}>
                                    Bayar
                                </Button>
                            )}
                            {detailRow?.can_edit && (
                                <Button variant="outline" size="sm" onClick={() => openEditSheet(detailRow)}>
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review dialog */}
            <Dialog open={!!reviewRow} onOpenChange={(open) => { if (!open) setReviewRow(null); }}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>
                            {reviewAction === 'approve' ? 'Setujui Reimbursement' : 'Tolak Reimbursement'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        {reviewRow && (
                            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 p-3 bg-secondary-50/50 dark:bg-dark-800/50">
                                <p className="font-medium text-dark-900 dark:text-dark-50">{reviewRow.title}</p>
                                <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
                                    {reviewRow.user_name} · {formatCurrency(reviewRow.amount)}
                                </p>
                            </div>
                        )}
                        {reviewAction === 'approve' && (
                            <Combobox
                                label="Kategori Transaksi *"
                                options={categoryOptions}
                                value={reviewCategoryId}
                                onChange={(v) => setReviewCategoryId(v ? Number(v) : null)}
                                placeholder="Pilih kategori untuk akuntansi"
                                clearable={false}
                            />
                        )}
                        <Textarea
                            label="Catatan Review"
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Catatan untuk pemohon (opsional)..."
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="zinc" size="sm" onClick={() => setReviewRow(null)}>Batal</Button>
                        <Button
                            variant={reviewAction === 'approve' ? 'green' : 'red'}
                            size="sm"
                            onClick={handleReview}
                            disabled={reviewProcessing || (reviewAction === 'approve' && !reviewCategoryId)}
                        >
                            {reviewAction === 'approve' ? 'Setujui' : 'Tolak'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pay dialog */}
            <Dialog open={!!payRow} onOpenChange={(open) => { if (!open) setPayRow(null); }}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>Proses Pembayaran</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        {payRow && (
                            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 p-3 bg-secondary-50/50 dark:bg-dark-800/50">
                                <p className="font-medium text-dark-900 dark:text-dark-50">{payRow.title}</p>
                                <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
                                    Sisa: <span className="font-semibold text-dark-900 dark:text-dark-50">{formatCurrency(payRow.amount_remaining)}</span>
                                </p>
                            </div>
                        )}
                        <Combobox
                            label="Rekening Bank *"
                            options={bankAccountOptions}
                            value={payBankAccountId}
                            onChange={(v) => setPayBankAccountId(v ? Number(v) : null)}
                            placeholder="Pilih rekening"
                            clearable={false}
                        />
                        <DatePicker
                            label="Tanggal Pembayaran *"
                            value={payDate}
                            onChange={setPayDate}
                            maxDate={new Date()}
                            clearable={false}
                        />
                        <CurrencyInput
                            label="Jumlah Pembayaran *"
                            value={payAmount}
                            onChange={setPayAmount}
                            error={payOverRemaining ? `Melebihi sisa ${formatCurrency(payRow?.amount_remaining ?? 0)}.` : undefined}
                            hint="Boleh kurang dari sisa (cicilan), tidak boleh lebih."
                        />
                        <Input
                            label="Catatan Referensi"
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            placeholder="Nomor referensi atau catatan..."
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="zinc" size="sm" onClick={() => setPayRow(null)}>Batal</Button>
                        <Button
                            variant="green"
                            size="sm"
                            onClick={handlePay}
                            disabled={payProcessing || !payBankAccountId || payAmount <= 0 || payOverRemaining || !payDate}
                        >
                            Proses Pembayaran
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Submit confirm */}
            <ConfirmDialog
                open={!!submitRow}
                onOpenChange={(open) => { if (!open) setSubmitRow(null); }}
                title={`Ajukan reimbursement ini?`}
                description="Setelah diajukan, reimbursement akan masuk ke antrian review dan tidak dapat diedit."
                confirmLabel="Ajukan"
                loading={submitProcessing}
                onConfirm={() => submitRow && handleSubmit(submitRow)}
            />

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteRow}
                onOpenChange={(open) => { if (!open) setDeleteRow(null); }}
                title="Hapus reimbursement ini?"
                description="Tindakan ini tidak dapat dibatalkan."
                confirmLabel="Hapus"
                loading={deleteProcessing}
                onConfirm={() => deleteRow && handleDelete(deleteRow)}
            />
        </AppLayout>
    );
}

/* ─── Reimbursement Form (Sheet) ──────────────────────────── */

interface ReimbursementFormProps {
    mode: 'create' | 'edit';
    row?: ReimbursementRow;
    onClose: () => void;
}

function ReimbursementForm({ mode, row, onClose }: ReimbursementFormProps) {
    const isEdit = mode === 'edit';

    const { data, setData, post, processing, errors, reset } = useForm<{
        title: string;
        description: string;
        amount: number;
        expense_date: string;
        category: string;
        attachment: File | null;
        remove_attachment: boolean;
        action: 'draft' | 'submit';
        _method: string;
    }>({
        title: row?.title ?? '',
        description: row?.description ?? '',
        amount: row?.amount ?? 0,
        expense_date: row?.expense_date ?? toLocalIso(new Date()),
        category: row?.category_input ?? '',
        attachment: null,
        remove_attachment: false,
        action: 'draft',
        _method: isEdit ? 'PUT' : 'POST',
    });

    const hasExistingAttachment = isEdit && !!row?.attachment_name && !data.remove_attachment;

    const submit = (action: 'draft' | 'submit') => {
        setData('action', action);
        if (isEdit && row) {
            post(reimbursementRoutes.update.url({ reimbursement: row.id }), {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    if ((page.props as unknown as SharedProps).flash?.error) return;
                    toast.success(action === 'submit' ? 'Reimbursement berhasil diajukan' : 'Reimbursement berhasil diperbarui');
                    onClose();
                },
                onError: (errors) => toastErrors(errors, 'Simpan reimbursement'),
            });
        } else {
            post(reimbursementRoutes.store.url(), {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(action === 'submit' ? 'Reimbursement berhasil diajukan' : 'Reimbursement disimpan sebagai draft');
                    reset();
                    onClose();
                },
                onError: (errors) => toastErrors(errors, 'Simpan reimbursement'),
            });
        }
    };

    return (
        <>
            <SheetHeader>
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <SheetTitle>
                            {isEdit ? 'Edit Reimbursement' : 'Buat Reimbursement'}
                        </SheetTitle>
                        <SheetDescription>
                            {isEdit
                                ? `Memperbarui: ${row?.title}`
                                : 'Ajukan penggantian biaya operasional.'}
                        </SheetDescription>
                    </div>
                </div>
            </SheetHeader>

            <SheetBody className="space-y-5">
                <Input
                    label="Judul *"
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    error={errors.title}
                    placeholder="cth: Transportasi meeting klien..."
                />
                <Textarea
                    label="Deskripsi"
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    error={errors.description}
                    placeholder="Detail biaya yang dikeluarkan..."
                    rows={3}
                />
                    <CurrencyInput
                        label="Jumlah *"
                        value={data.amount}
                        onChange={(v) => setData('amount', v)}
                        error={errors.amount}
                    />
                    <DatePicker
                        label="Tanggal Pengeluaran *"
                        value={data.expense_date ? new Date(data.expense_date) : null}
                        onChange={(d) => setData('expense_date', d ? toLocalIso(d) : '')}
                        error={errors.expense_date}
                    />
                <Combobox
                    label="Kategori *"
                    options={CATEGORY_OPTIONS}
                    value={data.category || null}
                    onChange={(v) => setData('category', v ? String(v) : '')}
                    error={errors.category}
                    placeholder="Pilih kategori biaya"
                />

                {/* Attachment */}
                <FileUpload
                    label="Lampiran (opsional)"
                    value={data.attachment}
                    onChange={(file) => setData('attachment', file)}
                    accept={['.jpg', '.jpeg', '.png', '.pdf']}
                    maxSizeMb={5}
                    error={errors.attachment}
                    existingFileName={hasExistingAttachment ? row?.attachment_name : null}
                    existingFileUrl={hasExistingAttachment ? row?.attachment_url : null}
                    onRemoveExisting={() => setData('remove_attachment', true)}
                />
            </SheetBody>

            <SheetFooter>
                <Button variant="zinc" onClick={onClose} disabled={processing}>
                    Batal
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => submit('draft')} disabled={processing}>
                        Simpan Draft
                    </Button>
                    <Button variant="primary" onClick={() => submit('submit')} disabled={processing}>
                        Ajukan
                    </Button>
                </div>
            </SheetFooter>
        </>
    );
}

/* ─── helpers ──────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-dark-500 dark:text-dark-400 mb-0.5">{label}</p>
            <div className="text-sm font-medium text-dark-900 dark:text-dark-50">{value}</div>
        </div>
    );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
    const accentMap: Record<string, string> = {
        blue: 'bg-blue-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
    };
    return (
        <div className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden bg-white dark:bg-dark-700 hover:shadow-md transition-shadow">
            <div className={cn('h-1', accentMap[color] ?? 'bg-primary-500')} />
            <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none mb-3">{label}</p>
                <p className="text-2xl font-bold tabular-nums leading-none text-dark-900 dark:text-dark-50">{value}</p>
                {sub && <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">{sub}</p>}
            </div>
        </div>
    );
}

const STATUS_BADGE_MAP: Record<string, { label: string; variant: string }> = {
    draft: { label: 'Draft', variant: 'zinc' },
    pending: { label: 'Pending Review', variant: 'yellow' },
    approved: { label: 'Approved', variant: 'blue' },
    rejected: { label: 'Rejected', variant: 'red' },
    paid: { label: 'Paid', variant: 'green' },
};

function StatusBadge({ status }: { status: string }) {
    const { label, variant } = STATUS_BADGE_MAP[status] ?? { label: status, variant: 'zinc' };
    return <Badge variant={variant as never}>{label}</Badge>;
}
