import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle,
    Clock,
    Edit,
    FileText,
    Filter,
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
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { EmptyState } from '@/components/shared/empty-state';
import { FileUpload } from '@/components/shared/file-upload';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { AppLayout } from '@/layouts/app-layout';
import { cn, formatCurrency, formatDate, toLocalIso } from '@/lib/utils';
import * as fundRequestRoutes from '@/routes/fund-requests';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type {
    FilterOption,
    FundRequestFilters,
    FundRequestItem,
    FundRequestRow,
    FundRequestStats,
    PaginationMeta,
} from './types';

interface EditFundRequest {
    id: number;
    request_number: string;
    title: string;
    purpose: string;
    priority: string;
    needed_by_date: string;
    attachment_url: string | null;
    attachment_name: string | null;
    status: string;
    items: FundRequestItem[];
}

interface Props {
    rows: FundRequestRow[];
    pagination: PaginationMeta;
    stats: FundRequestStats;
    filters: FundRequestFilters;
    bankAccountOptions: FilterOption[];
    userOptions: FilterOption[];
    categories: FilterOption[];
    nextNumber: string;
    editFundRequest: EditFundRequest | null;
    canApprove: boolean;
    canDisburse: boolean;
}

const STATUS_OPTIONS: FilterOption[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Pending Review', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Disbursed', value: 'disbursed' },
];

const PRIORITY_OPTIONS: FilterOption[] = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
];

const EMPTY_ITEM = (): FundRequestItem => ({
    description: '',
    category_id: null,
    quantity: 1,
    unit_price: 0,
    amount: 0,
    notes: '',
});

export default function FundRequestsIndex({
    rows,
    pagination,
    stats,
    filters,
    bankAccountOptions,
    userOptions,
    categories,
    nextNumber,
    editFundRequest,
    canApprove,
    canDisburse,
}: Props) {
    const [selected, setSelected] = React.useState<number[]>([]);
    const [search, setSearch] = React.useState(filters.search ?? '');

    // Detail dialog
    const [detailRow, setDetailRow] = React.useState<FundRequestRow | null>(null);

    // Create sheet
    const [createOpen, setCreateOpen] = React.useState(false);

    // Edit sheet
    const [editOpen, setEditOpen] = React.useState(false);
    const [editLoading, setEditLoading] = React.useState(false);

    // Review dialog
    const [reviewRow, setReviewRow] = React.useState<FundRequestRow | null>(null);
    const [reviewAction, setReviewAction] = React.useState<'approve' | 'reject'>('approve');
    const [reviewNotes, setReviewNotes] = React.useState('');
    const [reviewProcessing, setReviewProcessing] = React.useState(false);

    // Disburse dialog
    const [disburseRow, setDisburseRow] = React.useState<FundRequestRow | null>(null);
    const [disburseBankAccountId, setDisburseBankAccountId] = React.useState<number | null>(null);
    const [disburseDate, setDisburseDate] = React.useState(toLocalIso(new Date()));
    const [disburseNotes, setDisburseNotes] = React.useState('');
    const [disburseFile, setDisburseFile] = React.useState<File | null>(null);
    const [disburseProcessing, setDisburseProcessing] = React.useState(false);

    // Delete confirm
    const [deleteRow, setDeleteRow] = React.useState<FundRequestRow | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    // Submit confirm
    const [submitRow, setSubmitRow] = React.useState<FundRequestRow | null>(null);
    const [submitProcessing, setSubmitProcessing] = React.useState(false);

    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<FundRequestFilters>) => {
        const next = { ...filters, ...patch };
        router.get(
            fundRequestRoutes.index.url(),
            {
                tab: next.tab,
                search: next.search || undefined,
                status: next.status || undefined,
                priority: next.priority || undefined,
                user_id: next.user_id || undefined,
                month: next.month || undefined,
                per_page: next.per_page,
                page: next.page,
            },
            { preserveScroll: true, preserveState: true, only: ['rows', 'pagination', 'stats', 'filters'], replace: true },
        );
    };

    const reset = () => {
        setSearch('');
        router.get(fundRequestRoutes.index.url(), { tab: filters.tab }, { preserveScroll: true });
    };

    const toggleAll = () => {
        setSelected(selected.length === rows.length ? [] : rows.map((r) => r.id));
    };
    const toggleOne = (id: number) =>
        setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    const handleDelete = (row: FundRequestRow) => {
        setDeleteProcessing(true);
        router.delete(fundRequestRoutes.destroy.url({ fundRequest: row.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Permintaan dana berhasil dihapus');
                setDeleteRow(null);
                setDetailRow(null);
            },
            onError: () => toast.error('Gagal menghapus'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const handleSubmit = (row: FundRequestRow) => {
        setSubmitProcessing(true);
        router.post(
            fundRequestRoutes.submit.url({ fundRequest: row.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Permintaan dana berhasil diajukan');
                    setSubmitRow(null);
                    setDetailRow(null);
                },
                onError: () => toast.error('Gagal mengajukan'),
                onFinish: () => setSubmitProcessing(false),
            },
        );
    };

    const handleReview = () => {
        if (!reviewRow) return;
        setReviewProcessing(true);
        router.post(
            fundRequestRoutes.review.url({ fundRequest: reviewRow.id }),
            { action: reviewAction, review_notes: reviewNotes || undefined },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(reviewAction === 'approve' ? 'Permintaan dana disetujui' : 'Permintaan dana ditolak');
                    setReviewRow(null);
                    setDetailRow(null);
                    setReviewNotes('');
                },
                onError: () => toast.error('Gagal memproses'),
                onFinish: () => setReviewProcessing(false),
            },
        );
    };

    const handleDisburse = () => {
        if (!disburseRow) return;
        setDisburseProcessing(true);
        router.post(
            fundRequestRoutes.disburse.url({ fundRequest: disburseRow.id }),
            {
                bank_account_id: disburseBankAccountId,
                disbursement_date: disburseDate,
                disbursement_notes: disburseNotes || undefined,
                attachment: disburseFile || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Dana berhasil dicairkan');
                    setDisburseRow(null);
                    setDetailRow(null);
                    setDisburseBankAccountId(null);
                    setDisburseNotes('');
                    setDisburseFile(null);
                },
                onError: () => toast.error('Gagal mencairkan dana'),
                onFinish: () => setDisburseProcessing(false),
            },
        );
    };

    const openEditSheet = (row: FundRequestRow) => {
        setDetailRow(null);
        setEditLoading(true);
        router.get(
            fundRequestRoutes.index.url(),
            { ...filters, edit: row.id },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['editFundRequest'],
                onSuccess: () => {
                    setEditOpen(true);
                    setEditLoading(false);
                },
                onError: () => {
                    toast.error('Gagal memuat data permintaan');
                    setEditLoading(false);
                },
            },
        );
    };

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        (filters.status ? 1 : 0) +
        (filters.priority ? 1 : 0) +
        (filters.user_id ? 1 : 0) +
        (filters.month ? 1 : 0);

    const allSelected = rows.length > 0 && selected.length === rows.length;

    const tabItems = [
        ...(canApprove ? [{ value: 'all', label: 'Semua Pengajuan' }] : []),
        { value: 'my', label: 'Pengajuan Saya' },
    ];

    return (
        <AppLayout>
            <Head title="Permintaan Dana" />

            <div className="space-y-6">
                <PageHeader
                    title="Permintaan Dana"
                    description="Kelola pengajuan pencairan dana operasional."
                    action={
                        <div className="flex items-center gap-2">
                            <TutorialButton slug="fund-requests" />
                            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Buat Permintaan
                            </Button>
                        </div>
                    }
                />

                {/* Stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total" value={stats.total} sub="permintaan" color="blue" />
                    <StatCard label="Pending" value={stats.pending_count} sub="menunggu review" color="yellow" />
                    <StatCard label="Approved" value={stats.approved_count} sub="siap dicairkan" color="green" />
                    <StatCard label="Dicairkan" value={stats.disbursed_count} sub="selesai" color="purple" />
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
                            label="Prioritas"
                            options={PRIORITY_OPTIONS}
                            value={filters.priority ?? null}
                            onChange={(v) => apply({ priority: v ? String(v) : null, page: 1 })}
                            placeholder="Semua prioritas"
                            clearable
                        />
                        {filters.tab === 'all' && (
                            <Combobox
                                label="Pemohon"
                                options={userOptions}
                                value={filters.user_id ?? null}
                                onChange={(v) => apply({ user_id: v ? String(v) : null, page: 1 })}
                                placeholder="Semua pengguna"
                                clearable
                            />
                        )}
                        <Input
                            label="Cari"
                            icon={<Search className="w-4 h-4" />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Judul, tujuan..."
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
                            title="Belum ada permintaan dana"
                            description="Buat permintaan dana baru untuk memulai."
                            action={
                                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="w-4 h-4" />
                                    Buat Permintaan
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
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            No. Permintaan
                                        </th>
                                        {filters.tab === 'all' && (
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden md:table-cell">
                                                Pemohon
                                            </th>
                                        )}
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            Judul
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            Total
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden lg:table-cell">
                                            Prioritas
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden lg:table-cell">
                                            Dibutuhkan
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
                                            <td className="px-3 py-3 align-middle">
                                                <span className="text-xs font-mono text-dark-500 dark:text-dark-400 tabular-nums">
                                                    {row.request_number}
                                                </span>
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
                                                <div className="text-xs text-dark-400 dark:text-dark-500 mt-0.5">
                                                    {row.items_count} item
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right">
                                                <span className="font-semibold text-dark-900 dark:text-dark-50 tabular-nums">
                                                    {formatCurrency(row.total_amount)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 align-middle hidden lg:table-cell">
                                                <PriorityBadge priority={row.priority} />
                                            </td>
                                            <td className="px-3 py-3 align-middle hidden lg:table-cell text-sm text-dark-600 dark:text-dark-400 tabular-nums">
                                                {formatDate(row.needed_by_date)}
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
                                                        <Button variant="outline" size="sm" onClick={() => { setReviewRow(row); setReviewAction('approve'); setReviewNotes(''); }}>
                                                            <Clock className="w-3.5 h-3.5" />
                                                            Review
                                                        </Button>
                                                    )}
                                                    {row.can_disburse && canDisburse && (
                                                        <Button variant="green" size="sm" onClick={() => { setDisburseRow(row); setDisburseBankAccountId(null); setDisburseDate(toLocalIso(new Date())); setDisburseNotes(''); }}>
                                                            Cairkan
                                                        </Button>
                                                    )}
                                                    {row.can_edit && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => openEditSheet(row)}
                                                            disabled={editLoading}
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
                <SheetContent size="xl">
                    <FundRequestForm
                        mode="create"
                        categories={categories}
                        nextNumber={nextNumber}
                        onClose={() => setCreateOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Edit sheet */}
            <Sheet open={editOpen} onOpenChange={(open) => { if (!open) setEditOpen(false); }}>
                <SheetContent size="xl">
                    {editFundRequest && (
                        <FundRequestForm
                            mode="edit"
                            categories={categories}
                            fundRequest={editFundRequest}
                            onClose={() => setEditOpen(false)}
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
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <Field label="No. Permintaan" value={<span className="font-mono">{detailRow.request_number}</span>} />
                                <Field label="Pemohon" value={detailRow.user_name ?? '—'} />
                                <Field label="Prioritas" value={<PriorityBadge priority={detailRow.priority} />} />
                                <Field label="Dibutuhkan" value={formatDate(detailRow.needed_by_date)} />
                                <Field label="Total" value={formatCurrency(detailRow.total_amount)} />
                                <Field label="Status" value={<StatusBadge status={detailRow.status} />} />
                                {detailRow.reviewed_by_name && (
                                    <Field label="Direview oleh" value={detailRow.reviewed_by_name} />
                                )}
                                {detailRow.review_notes && (
                                    <div className="col-span-2">
                                        <Field label="Catatan Review" value={detailRow.review_notes} />
                                    </div>
                                )}
                            </div>
                            {detailRow.purpose && (
                                <div>
                                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">Tujuan</p>
                                    <p className="text-sm text-dark-700 dark:text-dark-300">{detailRow.purpose}</p>
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

                            {/* Item biaya */}
                            {detailRow.items.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-dark-500 dark:text-dark-400 mb-2">
                                        Item Biaya ({detailRow.items.length})
                                    </p>
                                    <div className="rounded-xl border border-secondary-200 dark:border-dark-600 divide-y divide-secondary-200 dark:divide-dark-600 overflow-hidden">
                                        {detailRow.items.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-secondary-50/50 dark:bg-dark-800/50">
                                                <div className="min-w-0">
                                                    <p className="text-sm text-dark-900 dark:text-dark-200 truncate">{item.description}</p>
                                                    <p className="text-xs text-dark-500 dark:text-dark-400">
                                                        {item.category_label ?? '—'} · {item.quantity} × {formatCurrency(item.unit_price)}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-medium text-dark-900 dark:text-dark-100 shrink-0">
                                                    {formatCurrency(item.amount)}
                                                </p>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between px-3 py-2.5">
                                            <p className="text-sm font-medium text-dark-900 dark:text-dark-200">Total</p>
                                            <p className="text-sm font-semibold text-dark-900 dark:text-dark-50">
                                                {formatCurrency(detailRow.total_amount)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Info pencairan */}
                            {detailRow.status === 'disbursed' && (
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-dark-500 dark:text-dark-400 mb-2">
                                        Pencairan
                                    </p>
                                    <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10 p-3 space-y-3">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <Field label="Rekening" value={detailRow.disbursement_account_name ?? '—'} />
                                            <Field label="Tanggal" value={formatDate(detailRow.disbursement_date ?? '')} />
                                            {detailRow.disbursed_by_name && (
                                                <Field label="Dicairkan oleh" value={detailRow.disbursed_by_name} />
                                            )}
                                            {detailRow.disbursement_notes && (
                                                <Field label="Catatan" value={detailRow.disbursement_notes} />
                                            )}
                                        </div>
                                        <p className="text-xs text-dark-500 dark:text-dark-400">
                                            {detailRow.items_count} transaksi pengeluaran dibuat di rekening ini — lihat di menu Pengeluaran.
                                        </p>
                                        {detailRow.disbursement_attachment_url ? (
                                            <AttachmentPreviewButton
                                                url={detailRow.disbursement_attachment_url}
                                                name={detailRow.disbursement_attachment_name}
                                                label={detailRow.disbursement_attachment_name ?? 'Lihat Bukti Pembayaran'}
                                                className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                                iconSize="w-4 h-4"
                                            />
                                        ) : (
                                            <p className="text-xs text-dark-400 dark:text-dark-500">Tidak ada bukti pembayaran diupload.</p>
                                        )}
                                    </div>
                                </div>
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
                                    <Button variant="green" size="sm" onClick={() => { setDetailRow(null); setReviewRow(detailRow); setReviewAction('approve'); setReviewNotes(''); }}>
                                        Setujui
                                    </Button>
                                    <Button variant="red" size="sm" onClick={() => { setDetailRow(null); setReviewRow(detailRow); setReviewAction('reject'); setReviewNotes(''); }}>
                                        Tolak
                                    </Button>
                                </>
                            )}
                            {detailRow?.can_disburse && canDisburse && (
                                <Button variant="green" size="sm" onClick={() => { setDetailRow(null); setDisburseRow(detailRow); setDisburseBankAccountId(null); setDisburseDate(toLocalIso(new Date())); setDisburseNotes(''); }}>
                                    Cairkan Dana
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
                            {reviewAction === 'approve' ? 'Setujui Permintaan Dana' : 'Tolak Permintaan Dana'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        {reviewRow && (
                            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 p-3 bg-secondary-50/50 dark:bg-dark-800/50">
                                <p className="font-medium text-dark-900 dark:text-dark-50">{reviewRow.title}</p>
                                <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
                                    {reviewRow.user_name} · {formatCurrency(reviewRow.total_amount)}
                                </p>
                            </div>
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
                            disabled={reviewProcessing}
                        >
                            {reviewAction === 'approve' ? 'Setujui' : 'Tolak'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Disburse dialog */}
            <Dialog open={!!disburseRow} onOpenChange={(open) => { if (!open) setDisburseRow(null); }}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>Cairkan Dana</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        {disburseRow && (
                            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 p-3 bg-secondary-50/50 dark:bg-dark-800/50">
                                <p className="font-medium text-dark-900 dark:text-dark-50">{disburseRow.title}</p>
                                <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
                                    Total: <span className="font-semibold text-dark-900 dark:text-dark-50">{formatCurrency(disburseRow.total_amount)}</span>
                                </p>
                            </div>
                        )}
                        <Combobox
                            label="Rekening Bank *"
                            options={bankAccountOptions}
                            value={disburseBankAccountId}
                            onChange={(v) => setDisburseBankAccountId(v ? Number(v) : null)}
                            placeholder="Pilih rekening"
                        />
                        <DatePicker
                            label="Tanggal Pencairan *"
                            value={disburseDate ? new Date(disburseDate) : null}
                            onChange={(d) => setDisburseDate(d ? toLocalIso(d) : '')}
                            maxDate={new Date()}
                        />
                        <Textarea
                            label="Catatan Pencairan"
                            value={disburseNotes}
                            onChange={(e) => setDisburseNotes(e.target.value)}
                            placeholder="Catatan atau nomor referensi (opsional)..."
                            rows={2}
                        />
                        <FileUpload
                            label="Bukti Pembayaran (opsional)"
                            value={disburseFile}
                            onChange={setDisburseFile}
                            accept={['.pdf', '.jpg', '.jpeg', '.png']}
                            hint="Dilampirkan ke transaksi pengeluaran yang terbentuk"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="zinc" size="sm" onClick={() => setDisburseRow(null)}>Batal</Button>
                        <Button
                            variant="green"
                            size="sm"
                            onClick={handleDisburse}
                            disabled={disburseProcessing || !disburseBankAccountId}
                        >
                            Cairkan Dana
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Submit confirm */}
            <ConfirmDialog
                open={!!submitRow}
                onOpenChange={(open) => { if (!open) setSubmitRow(null); }}
                title="Ajukan permintaan dana?"
                description="Setelah diajukan, permintaan akan masuk ke antrian review dan tidak dapat diedit."
                confirmLabel="Ajukan"
                loading={submitProcessing}
                onConfirm={() => submitRow && handleSubmit(submitRow)}
            />

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteRow}
                onOpenChange={(open) => { if (!open) setDeleteRow(null); }}
                title="Hapus permintaan dana ini?"
                description="Tindakan ini tidak dapat dibatalkan."
                confirmLabel="Hapus"
                loading={deleteProcessing}
                onConfirm={() => deleteRow && handleDelete(deleteRow)}
            />
        </AppLayout>
    );
}

/* ─── Fund Request Form (Sheet) ──────────────────────────── */

interface FundRequestFormProps {
    mode: 'create' | 'edit';
    categories: FilterOption[];
    nextNumber?: string;
    fundRequest?: EditFundRequest;
    onClose: () => void;
}

const PRIORITY_FORM_OPTIONS = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
];

function FundRequestForm({ mode, categories, nextNumber, fundRequest, onClose }: FundRequestFormProps) {
    const isEdit = mode === 'edit';

    const { data, setData, post, processing, errors, reset } = useForm<{
        request_number: string;
        title: string;
        purpose: string;
        priority: string;
        needed_by_date: string;
        attachment: File | null;
        remove_attachment: boolean;
        items: FundRequestItem[];
        action: 'draft' | 'submit';
        _method: string;
    }>({
        request_number: isEdit ? (fundRequest?.request_number ?? '') : (nextNumber ?? ''),
        title: fundRequest?.title ?? '',
        purpose: fundRequest?.purpose ?? '',
        priority: fundRequest?.priority ?? 'medium',
        needed_by_date: fundRequest?.needed_by_date ?? '',
        attachment: null,
        remove_attachment: false,
        items: (fundRequest?.items && fundRequest.items.length > 0) ? fundRequest.items : [EMPTY_ITEM()],
        action: 'draft',
        _method: isEdit ? 'PUT' : 'POST',
    });

    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const hasExistingAttachment = isEdit && !!fundRequest?.attachment_name && !data.remove_attachment;

    const addItem = () => setData('items', [...data.items, EMPTY_ITEM()]);

    const removeItem = (index: number) => {
        setData('items', data.items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof FundRequestItem, value: string | number | null) => {
        const updated = data.items.map((item, i) => {
            if (i !== index) return item;
            const newItem = { ...item, [field]: value };
            if (field === 'quantity' || field === 'unit_price') {
                newItem.amount = (field === 'quantity' ? Number(value) : item.quantity) *
                    (field === 'unit_price' ? Number(value) : item.unit_price);
            }
            return newItem;
        });
        setData('items', updated);
    };

    const submit = (action: 'draft' | 'submit') => {
        setData('action', action);
        if (isEdit && fundRequest) {
            post(fundRequestRoutes.update.url({ fundRequest: fundRequest.id }), {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Permintaan dana berhasil diperbarui');
                    onClose();
                },
                onError: () => toast.error('Gagal menyimpan'),
            });
        } else {
            post(fundRequestRoutes.store.url(), {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Permintaan dana berhasil dibuat');
                    reset();
                    onClose();
                },
                onError: () => toast.error('Gagal menyimpan'),
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
                            {isEdit ? 'Edit Permintaan Dana' : 'Buat Permintaan Dana'}
                        </SheetTitle>
                        <SheetDescription>
                            {isEdit
                                ? `No. ${fundRequest?.request_number}`
                                : 'Ajukan pencairan dana operasional.'}
                        </SheetDescription>
                    </div>
                </div>
            </SheetHeader>

            <SheetBody className="space-y-5">
                {/* Header fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {!isEdit && (
                        <div className="sm:col-span-2">
                            <Input
                                label="Nomor Permintaan *"
                                value={data.request_number}
                                onChange={(e) => setData('request_number', e.target.value)}
                                error={errors.request_number}
                                hint="Auto-generate, dapat diubah"
                            />
                        </div>
                    )}
                    <Input
                        label="Judul *"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        error={errors.title}
                        placeholder="cth: Pembelian ATK Kantor..."
                    />
                    <Combobox
                        label="Prioritas *"
                        options={PRIORITY_FORM_OPTIONS}
                        value={data.priority || null}
                        onChange={(v) => setData('priority', v ? String(v) : 'medium')}
                        error={errors.priority}
                    />
                    <div className="sm:col-span-2">
                        <DatePicker
                            label="Dibutuhkan Sebelum *"
                            value={data.needed_by_date ? new Date(data.needed_by_date) : null}
                            onChange={(d) => setData('needed_by_date', d ? toLocalIso(d) : '')}
                            error={errors.needed_by_date}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <Textarea
                            label="Tujuan / Keterangan *"
                            value={data.purpose}
                            onChange={(e) => setData('purpose', e.target.value)}
                            error={errors.purpose}
                            placeholder="Jelaskan tujuan penggunaan dana..."
                            rows={3}
                        />
                    </div>

                    {/* Attachment */}
                    <div className="sm:col-span-2">
                        <FileUpload
                            label="Lampiran (opsional)"
                            value={data.attachment}
                            onChange={(file) => setData('attachment', file)}
                            accept={['.jpg', '.jpeg', '.png', '.pdf']}
                            maxSizeMb={5}
                            error={errors.attachment}
                            existingFileName={hasExistingAttachment ? fundRequest?.attachment_name : null}
                            existingFileUrl={hasExistingAttachment ? fundRequest?.attachment_url : null}
                            onRemoveExisting={() => setData('remove_attachment', true)}
                        />
                    </div>
                </div>

                {/* Items section */}
                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                    <div className="px-4 py-3 border-b border-secondary-200 dark:border-dark-600 bg-secondary-50/60 dark:bg-dark-800/60 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-dark-900 dark:text-dark-50">Item Biaya</p>
                            <p className="text-xs text-dark-500 dark:text-dark-400">Rincian pengeluaran yang diajukan</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="blue" className="tabular-nums text-xs">
                                {formatCurrency(totalAmount)}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={addItem}>
                                <Plus className="w-3.5 h-3.5" />
                                Tambah
                            </Button>
                        </div>
                    </div>

                    {errors.items && (
                        <p className="px-4 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/10">{errors.items}</p>
                    )}

                    <div className="divide-y divide-secondary-100 dark:divide-dark-600">
                        {data.items.map((item, index) => (
                            <ItemRow
                                key={index}
                                index={index}
                                item={item}
                                categories={categories}
                                errors={errors}
                                onChange={updateItem}
                                onRemove={data.items.length > 1 ? () => removeItem(index) : undefined}
                            />
                        ))}
                    </div>

                    <div className="px-4 py-3 bg-secondary-50/50 dark:bg-dark-800/50 border-t border-secondary-200 dark:border-dark-600 text-right">
                        <span className="text-xs text-dark-500 dark:text-dark-400">Total Pengajuan: </span>
                        <span className="text-sm font-bold text-dark-900 dark:text-dark-50 tabular-nums">
                            {formatCurrency(totalAmount)}
                        </span>
                    </div>
                </div>
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

/* ─── Item Row ──────────────────────────────────────────── */

interface ItemRowProps {
    index: number;
    item: FundRequestItem;
    categories: FilterOption[];
    errors: Record<string, string>;
    onChange: (index: number, field: keyof FundRequestItem, value: string | number | null) => void;
    onRemove?: () => void;
}

function ItemRow({ index, item, categories, errors, onChange, onRemove }: ItemRowProps) {
    const itemTotal = item.quantity * item.unit_price;

    return (
        <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-dark-500 dark:text-dark-400">Item #{index + 1}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-dark-900 dark:text-dark-50 tabular-nums">
                        {formatCurrency(itemTotal)}
                    </span>
                    {onRemove && (
                        <button type="button" onClick={onRemove} className="text-dark-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <Input
                        label="Nama Item *"
                        value={item.description}
                        onChange={(e) => onChange(index, 'description', e.target.value)}
                        error={errors[`items.${index}.description`]}
                        placeholder="cth: Kertas A4..."
                    />
                </div>
                <div className="col-span-2">
                    <Combobox
                        label="Kategori *"
                        options={categories}
                        value={item.category_id}
                        onChange={(v) => onChange(index, 'category_id', v ? Number(v) : null)}
                        error={errors[`items.${index}.category_id`]}
                        placeholder="Pilih kategori"
                    />
                </div>
                <Input
                    label="Qty *"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => onChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    error={errors[`items.${index}.quantity`]}
                />
                <CurrencyInput
                    label="Harga Satuan *"
                    value={item.unit_price}
                    onChange={(v) => onChange(index, 'unit_price', v)}
                    error={errors[`items.${index}.unit_price`]}
                />
                <div className="col-span-2">
                    <Input
                        label="Catatan"
                        value={item.notes}
                        onChange={(e) => onChange(index, 'notes', e.target.value)}
                        placeholder="Catatan tambahan (opsional)..."
                    />
                </div>
            </div>
        </div>
    );
}

/* ─── helpers ──────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-dark-500 dark:text-dark-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-dark-900 dark:text-dark-50">{value}</p>
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
    disbursed: { label: 'Disbursed', variant: 'green' },
};

const PRIORITY_BADGE_MAP: Record<string, { label: string; variant: string }> = {
    low: { label: 'Low', variant: 'zinc' },
    medium: { label: 'Medium', variant: 'blue' },
    high: { label: 'High', variant: 'orange' },
    urgent: { label: 'Urgent', variant: 'red' },
};

function StatusBadge({ status }: { status: string }) {
    const { label, variant } = STATUS_BADGE_MAP[status] ?? { label: status, variant: 'zinc' };
    return <Badge variant={variant as never}>{label}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
    const { label, variant } = PRIORITY_BADGE_MAP[priority] ?? { label: priority, variant: 'zinc' };
    return <Badge variant={variant as never}>{label}</Badge>;
}
