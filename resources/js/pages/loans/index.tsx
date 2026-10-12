import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    CreditCard,
    Edit,
    FileText,
    Loader2,
    Plus,
    Search,
    Trash2,
    TrendingDown,
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
import * as loanRoutes from '@/routes/loans';
import type { FilterOption, LoanFilters, LoanRow, LoanStats, PaginationMeta } from './types';

interface Props {
    rows: LoanRow[];
    pagination: PaginationMeta;
    stats: LoanStats;
    filters: LoanFilters;
    bankAccountOptions: FilterOption[];
    nextLoanNumber: string;
}

const STATUS_OPTIONS: FilterOption[] = [
    { label: 'Aktif', value: 'active' },
    { label: 'Lunas', value: 'paid_off' },
];

function isoOrNull(d: Date | null): string | null {
    return d ? toLocalIso(d) : null;
}

function statusBadge(status: string) {
    if (status === 'active') return <Badge variant="blue">Aktif</Badge>;
    if (status === 'paid_off') return <Badge variant="emerald">Lunas</Badge>;
    return <Badge variant="zinc">{status}</Badge>;
}

function interestDisplay(row: LoanRow): string {
    if (row.interest_type === 'fixed') {
        return row.interest_amount ? formatCurrency(row.interest_amount) : '-';
    }
    return row.interest_rate ? `${row.interest_rate}% p.a.` : '0%';
}

export default function LoansIndex({ rows, pagination, stats, filters, bankAccountOptions, nextLoanNumber }: Props) {
    const [search, setSearch] = React.useState(filters.search ?? '');
    const [detailRow, setDetailRow] = React.useState<LoanRow | null>(null);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [editRow, setEditRow] = React.useState<LoanRow | null>(null);
    const [payRow, setPayRow] = React.useState<LoanRow | null>(null);
    const [deleteRow, setDeleteRow] = React.useState<LoanRow | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<LoanFilters>) => {
        const next = { ...filters, ...patch };
        router.get(
            loanRoutes.index.url(),
            {
                search: next.search || undefined,
                status: next.status || undefined,
                per_page: next.per_page,
                page: next.page,
            },
            { preserveScroll: true, preserveState: true, only: ['rows', 'pagination', 'stats', 'filters'], replace: true },
        );
    };

    const reset = () => {
        setSearch('');
        router.get(loanRoutes.index.url(), {}, { preserveScroll: true });
    };

    const handleDelete = () => {
        if (!deleteRow) return;
        setDeleteProcessing(true);
        router.delete(loanRoutes.destroy.url({ loan: deleteRow.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Pinjaman berhasil dihapus');
                setDeleteRow(null);
                setDetailRow(null);
            },
            onError: () => toast.error('Gagal menghapus pinjaman'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const activeFilters = [filters.status].filter(Boolean).length;

    return (
        <AppLayout>
            <Head title="Pinjaman" />
            <div className="space-y-6">
                <PageHeader
                    title="Pinjaman"
                    description="Kelola pinjaman dan cicilan pembayaran"
                    action={
                        <div className="flex items-center gap-2">
                            <TutorialButton slug="loans" />
                            <Button onClick={() => setCreateOpen(true)} size="sm">
                                <Plus className="mr-1.5 h-4 w-4" />
                                Tambah Pinjaman
                            </Button>
                        </div>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatsCard label="Total Pinjaman" value={stats.total} icon={<CreditCard className="h-6 w-6" />} color="blue" />
                    <StatsCard label="Pinjaman Aktif" value={stats.active_count} icon={<TrendingDown className="h-6 w-6" />} color="red" />
                    <StatsCard label="Total Pokok" value={formatCurrency(stats.total_principal)} icon={<Banknote className="h-6 w-6" />} color="purple" />
                    <StatsCard label="Pokok Aktif" value={formatCurrency(stats.active_principal)} icon={<AlertCircle className="h-6 w-6" />} color="orange" />
                </div>

                {/* Filters */}
                <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
                                <input
                                    className="h-9 w-full rounded-lg border border-secondary-200 bg-white pl-9 pr-3 text-sm text-dark-900 placeholder-dark-400 focus:border-primary-500 focus:outline-none dark:border-dark-600 dark:bg-dark-800 dark:text-dark-50 dark:placeholder-dark-400"
                                    placeholder="Cari nomor, pemberi pinjaman..."
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
                        </div>
                        {(activeFilters > 0 || search) && (
                            <Button variant="ghost" size="sm" onClick={reset}>
                                <X className="mr-1 h-3.5 w-3.5" />
                                Reset
                            </Button>
                        )}
                    </div>
                    <p className="text-sm text-dark-500 dark:text-dark-400">
                        Menampilkan {pagination.from ?? 0}–{pagination.to ?? 0} dari {pagination.total} pinjaman
                    </p>
                </div>

                {/* Table */}
                {rows.length === 0 ? (
                    <EmptyState
                        icon={<CreditCard className="h-10 w-10" />}
                        title="Belum ada pinjaman"
                        description="Tambahkan pinjaman baru untuk mulai melacak cicilan"
                        action={<Button onClick={() => setCreateOpen(true)}>Tambah Pinjaman</Button>}
                    />
                ) : (
                    <div className="overflow-hidden rounded-xl border border-secondary-200 bg-white dark:border-dark-600 dark:bg-dark-700">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Nomor</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Pemberi Pinjaman</th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Pokok</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Bunga</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-dark-500 dark:text-dark-400">Tenor</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Tanggal Mulai</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Jatuh Tempo</th>
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
                                                {row.loan_number}
                                            </td>
                                            <td className="px-3 py-3 align-middle font-medium text-dark-900 dark:text-dark-50">
                                                {row.lender_name}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right text-dark-900 dark:text-dark-50">
                                                {formatCurrency(row.principal_amount)}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-600 dark:text-dark-400">
                                                {interestDisplay(row)}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-center text-dark-600 dark:text-dark-400">
                                                {row.term_months} bln
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-600 dark:text-dark-400">
                                                {formatDate(row.start_date)}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-dark-600 dark:text-dark-400">
                                                {formatDate(row.maturity_date)}
                                            </td>
                                            <td className={cn(
                                                'px-3 py-3 align-middle text-right font-medium',
                                                row.remaining_principal > 0
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-emerald-600 dark:text-emerald-400',
                                            )}>
                                                {row.remaining_principal > 0 ? formatCurrency(row.remaining_principal) : 'Lunas'}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-center">
                                                {statusBadge(row.status)}
                                            </td>
                                            <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">
                                                    {row.status === 'active' && (
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
                                                    {row.status === 'active' && (
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
                                                    {row.paid_principal === 0 && (
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
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20">
                                <CreditCard className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <SheetTitle>Tambah Pinjaman</SheetTitle>
                                <SheetDescription>Catat pinjaman baru dan transaksi bank terkait</SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                    <LoanForm
                        mode="create"
                        nextLoanNumber={nextLoanNumber}
                        bankAccountOptions={bankAccountOptions}
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
                                <SheetTitle>Edit Pinjaman</SheetTitle>
                                <SheetDescription>{editRow?.loan_number}</SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                    {editRow && (
                        <LoanForm
                            mode="edit"
                            row={editRow}
                            bankAccountOptions={bankAccountOptions}
                            onClose={() => setEditRow(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Pay Dialog */}
            {payRow && (
                <PayLoanDialog
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
                            <CreditCard className="h-5 w-5 text-primary-600" />
                            {detailRow?.loan_number}
                        </DialogTitle>
                    </DialogHeader>
                    {detailRow && <LoanDetail row={detailRow} onEdit={() => { setDetailRow(null); setEditRow(detailRow); }} onPay={() => { setDetailRow(null); setPayRow(detailRow); }} onDelete={() => { setDetailRow(null); setDeleteRow(detailRow); }} />}
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <ConfirmDialog
                open={!!deleteRow}
                onOpenChange={(o) => !o && setDeleteRow(null)}
                onConfirm={handleDelete}
                title="Hapus Pinjaman?"
                description={`Pinjaman ${deleteRow?.loan_number} (${deleteRow?.lender_name}) akan dihapus permanen.`}
                variant="danger"
            />
        </AppLayout>
    );
}

/* -------------------------------------------------------------------------- */
/* LoanForm                                                                    */
/* -------------------------------------------------------------------------- */

interface LoanFormProps {
    mode: 'create' | 'edit';
    row?: LoanRow;
    nextLoanNumber?: string;
    bankAccountOptions: FilterOption[];
    onClose: () => void;
}

function LoanForm({ mode, row, nextLoanNumber, bankAccountOptions, onClose }: LoanFormProps) {
    const isEdit = mode === 'edit';

    const { data, setData, post, processing, errors, reset } = useForm<{
        loan_number: string;
        lender_name: string;
        principal_amount: number;
        interest_type: 'fixed' | 'percentage';
        interest_amount: number;
        interest_rate: number | string;
        term_months: number | string;
        start_date: string;
        maturity_date: string;
        purpose: string;
        contract_attachment: File | null;
        remove_attachment: boolean;
        bank_account_id: number | null;
        _method: string;
    }>({
        loan_number: row?.loan_number ?? nextLoanNumber ?? '',
        lender_name: row?.lender_name ?? '',
        principal_amount: row?.principal_amount ?? 0,
        interest_type: row?.interest_type ?? 'percentage',
        interest_amount: row?.interest_amount ?? 0,
        interest_rate: row?.interest_rate ?? '',
        term_months: row?.term_months ?? '',
        start_date: row?.start_date ?? toLocalIso(new Date()),
        maturity_date: row?.maturity_date ?? '',
        purpose: row?.purpose ?? '',
        contract_attachment: null,
        remove_attachment: false,
        bank_account_id: null,
        _method: isEdit ? 'PUT' : 'POST',
    });

    const recalcMaturity = (start: string, months: number | string) => {
        if (start && months) {
            const d = new Date(start);
            d.setMonth(d.getMonth() + Number(months));
            setData('maturity_date', toLocalIso(d));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const url = isEdit ? loanRoutes.update.url({ loan: row!.id }) : loanRoutes.store.url();
        post(url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isEdit ? 'Pinjaman berhasil diperbarui' : 'Pinjaman berhasil dibuat');
                reset();
                onClose();
            },
            onError: () => toast.error('Gagal menyimpan pinjaman'),
        });
    };

    return (
        <form id="loan-form" onSubmit={handleSubmit} className="contents">
            <SheetBody className="space-y-6">
                <div className="border-b border-secondary-200 pb-2 dark:border-dark-600">
                    <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Informasi Pinjaman</h4>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Detail pemberi pinjaman dan nomor referensi</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Nomor Pinjaman *"
                        value={data.loan_number}
                        onChange={(e) => setData('loan_number', e.target.value)}
                        error={errors.loan_number}
                        disabled={isEdit}
                        readOnly={isEdit}
                    />
                    <Input
                        label="Pemberi Pinjaman *"
                        value={data.lender_name}
                        onChange={(e) => setData('lender_name', e.target.value)}
                        error={errors.lender_name}
                        placeholder="Nama bank / lembaga / individu"
                    />
                    <div className="sm:col-span-2">
                        <CurrencyInput
                            label="Jumlah Pokok *"
                            value={data.principal_amount}
                            onChange={(v) => setData('principal_amount', v)}
                            error={errors.principal_amount}
                        />
                    </div>
                </div>

                <div className="border-t border-secondary-200 pt-4 dark:border-dark-600" />
                <div className="border-b border-secondary-200 pb-2 dark:border-dark-600">
                    <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Bunga & Tenor</h4>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Pilih tipe bunga dan jangka waktu pinjaman</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <Label className="mb-1.5 block text-sm font-medium text-dark-900 dark:text-dark-300">Tipe Bunga *</Label>
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
                                    {t === 'percentage' ? 'Persentase (% p.a.)' : 'Tetap (fixed)'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {data.interest_type === 'percentage' ? (
                        <Input
                            label="Suku Bunga (% p.a.)"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={data.interest_rate as string}
                            onChange={(e) => setData('interest_rate', e.target.value)}
                            error={errors.interest_rate}
                            placeholder="0.00"
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
                        label="Tenor (bulan) *"
                        type="number"
                        min="1"
                        value={data.term_months as string}
                        onChange={(e) => {
                            setData('term_months', e.target.value);
                            recalcMaturity(data.start_date, e.target.value);
                        }}
                        error={errors.term_months}
                        placeholder="12"
                    />
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-dark-900 dark:text-dark-300">Tanggal Mulai *</Label>
                        <DatePicker
                            value={data.start_date ? new Date(data.start_date) : null}
                            onChange={(d) => {
                                const s = isoOrNull(d ?? null);
                                setData('start_date', s ?? '');
                                if (s) recalcMaturity(s, data.term_months);
                            }}
                        />
                        {errors.start_date && <p className="mt-1 text-xs text-red-500">{errors.start_date}</p>}
                    </div>
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-dark-900 dark:text-dark-300">Jatuh Tempo *</Label>
                        <DatePicker
                            value={data.maturity_date ? new Date(data.maturity_date) : null}
                            onChange={(d) => setData('maturity_date', isoOrNull(d ?? null) ?? '')}
                        />
                        {errors.maturity_date && <p className="mt-1 text-xs text-red-500">{errors.maturity_date}</p>}
                    </div>
                </div>

                {!isEdit && (
                    <>
                        <div className="border-t border-secondary-200 pt-4 dark:border-dark-600" />
                        <div className="border-b border-secondary-200 pb-2 dark:border-dark-600">
                            <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Rekening Penerima</h4>
                            <p className="text-xs text-dark-500 dark:text-dark-400">Rekening yang menerima dana pinjaman</p>
                        </div>
                        <Combobox
                            options={bankAccountOptions}
                            value={data.bank_account_id ?? ''}
                            onChange={(v) => setData('bank_account_id', v as number)}
                            placeholder="Pilih rekening..."
                            searchPlaceholder="Cari rekening..."
                            emptyText="Rekening tidak ditemukan"
                        />
                        {errors.bank_account_id && <p className="mt-1 text-xs text-red-500">{errors.bank_account_id}</p>}
                    </>
                )}

                <div className="border-t border-secondary-200 pt-4 dark:border-dark-600" />
                <div className="border-b border-secondary-200 pb-2 dark:border-dark-600">
                    <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Informasi Tambahan</h4>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Tujuan pinjaman dan dokumen kontrak</p>
                </div>
                <Textarea
                    label="Tujuan Pinjaman"
                    value={data.purpose}
                    onChange={(e) => setData('purpose', e.target.value)}
                    error={errors.purpose}
                    placeholder="Jelaskan tujuan pinjaman..."
                    rows={3}
                />

                <FileUpload
                    label="Dokumen Kontrak"
                    value={data.contract_attachment}
                    onChange={(f) => setData('contract_attachment', f)}
                    error={errors.contract_attachment}
                    existingFileName={isEdit && row?.contract_attachment_url && !data.remove_attachment ? 'Lihat kontrak' : null}
                    existingFileUrl={isEdit && row?.contract_attachment_url && !data.remove_attachment ? row.contract_attachment_url : null}
                    onRemoveExisting={() => setData('remove_attachment', true)}
                />
            </SheetBody>
            <SheetFooter>
                <Button type="button" variant="zinc" onClick={onClose}>Batal</Button>
                <Button type="submit" form="loan-form" disabled={processing}>
                    {processing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    {isEdit ? 'Simpan Perubahan' : 'Simpan Pinjaman'}
                </Button>
            </SheetFooter>
        </form>
    );
}

/* -------------------------------------------------------------------------- */
/* PayLoanDialog                                                               */
/* -------------------------------------------------------------------------- */

interface PayLoanDialogProps {
    row: LoanRow;
    bankAccountOptions: FilterOption[];
    onClose: () => void;
}

function PayLoanDialog({ row, bankAccountOptions, onClose }: PayLoanDialogProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        bank_account_id: null as number | null,
        payment_date: toLocalIso(new Date()),
        principal_paid: 0,
        interest_paid: 0,
        reference_number: '',
        notes: '',
    });

    const totalInterest =
        row.interest_type === 'fixed'
            ? (row.interest_amount ?? 0)
            : Math.round(row.principal_amount * (row.interest_rate ?? 0) / 100 / 12 * row.term_months);
    const remainingInterest = Math.max(0, totalInterest - row.paid_interest);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(loanRoutes.pay.url({ loan: row.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Pembayaran pinjaman berhasil dicatat');
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
                        Catat Pembayaran
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 rounded-xl border border-secondary-200 bg-secondary-50 p-4 dark:border-dark-600 dark:bg-dark-800">
                    <div className="flex justify-between text-sm">
                        <span className="text-dark-500 dark:text-dark-400">Pemberi Pinjaman</span>
                        <span className="font-medium text-dark-900 dark:text-dark-50">{row.lender_name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-dark-500 dark:text-dark-400">Sisa Pokok</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(row.remaining_principal)}</span>
                    </div>
                    {remainingInterest > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-dark-500 dark:text-dark-400">Sisa Bunga</span>
                            <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(remainingInterest)}</span>
                        </div>
                    )}
                </div>
                <form id="pay-loan-form" onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium">Rekening Pembayaran *</Label>
                        <Combobox
                            options={bankAccountOptions}
                            value={data.bank_account_id ?? ''}
                            onChange={(v) => setData('bank_account_id', v as number)}
                            placeholder="Pilih rekening..."
                            emptyText="Rekening tidak ditemukan"
                        />
                        {errors.bank_account_id && <p className="mt-1 text-xs text-red-500">{errors.bank_account_id}</p>}
                    </div>
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium">Tanggal Pembayaran *</Label>
                        <DatePicker
                            value={data.payment_date ? new Date(data.payment_date) : null}
                            onChange={(d) => setData('payment_date', isoOrNull(d ?? null) ?? '')}
                        />
                        {errors.payment_date && <p className="mt-1 text-xs text-red-500">{errors.payment_date}</p>}
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
                    <Input
                        label="Catatan"
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        placeholder="Opsional"
                    />
                </form>
                <DialogFooter>
                    <Button type="button" variant="zinc" onClick={onClose}>Batal</Button>
                    <Button type="submit" form="pay-loan-form" disabled={processing}>
                        {processing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        Simpan Pembayaran
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* -------------------------------------------------------------------------- */
/* LoanDetail                                                                  */
/* -------------------------------------------------------------------------- */

function LoanDetail({ row, onEdit, onPay, onDelete }: { row: LoanRow; onEdit: () => void; onPay: () => void; onDelete: () => void }) {
    const totalInterest =
        row.interest_type === 'fixed'
            ? (row.interest_amount ?? 0)
            : Math.round(row.principal_amount * (row.interest_rate ?? 0) / 100 / 12 * row.term_months);
    const pctPaid = row.principal_amount > 0 ? Math.round((row.paid_principal / row.principal_amount) * 100) : 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Pemberi Pinjaman</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{row.lender_name}</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Status</p>
                    <div className="mt-1">{statusBadge(row.status)}</div>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Pokok</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatCurrency(row.principal_amount)}</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Bunga</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{interestDisplay(row)}</p>
                    {totalInterest > 0 && <p className="text-xs text-dark-400">{formatCurrency(totalInterest)} total</p>}
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Tanggal Mulai</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatDate(row.start_date)}</p>
                </div>
                <div className="rounded-lg bg-secondary-50 p-3 dark:bg-dark-800">
                    <p className="text-xs text-dark-500 dark:text-dark-400">Jatuh Tempo</p>
                    <p className="font-semibold text-dark-900 dark:text-dark-50">{formatDate(row.maturity_date)}</p>
                </div>
            </div>

            {/* Progress */}
            <div className="rounded-xl border border-secondary-200 p-4 dark:border-dark-600">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-dark-600 dark:text-dark-300">Progres Pembayaran Pokok</span>
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

            {row.purpose && (
                <div className="rounded-xl border border-secondary-200 p-3 dark:border-dark-600">
                    <p className="mb-1 text-xs font-medium text-dark-500 dark:text-dark-400">Tujuan Pinjaman</p>
                    <p className="text-sm text-dark-900 dark:text-dark-50">{row.purpose}</p>
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
                    Lihat Dokumen Kontrak
                </a>
            )}

            <div className="flex gap-2 border-t border-secondary-200 pt-3 dark:border-dark-600">
                {row.status === 'active' && (
                    <Button size="sm" onClick={onPay} className="flex-1">
                        <Banknote className="mr-1.5 h-4 w-4" />
                        Catat Pembayaran
                    </Button>
                )}
                {row.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={onEdit}>
                        <Edit className="h-4 w-4" />
                    </Button>
                )}
                {row.paid_principal === 0 && (
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
