import { Head, router } from '@inertiajs/react';
import {
    ArrowUpRight,
    Building2,
    Calendar,
    Download,
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
import { useCan } from '@/hooks/use-can';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatsCard } from '@/components/shared/stats-card';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { Pagination } from '@/components/shared/pagination';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, formatDate, toLocalIso } from '@/lib/utils';
import * as cashFlowRoutes from '@/routes/cash-flow';
import { CashFlowTabs } from './components/cash-flow-tabs';
import { HEAD_ROW, InputByText, LIST_CARD, SortableTh, StopRowClick, TABLE_SCROLL, TH } from './components/table-parts';
import {
    TransactionDetailDialog,
    type CashFlowDialogData,
} from './components/transaction-detail-dialog';
import { TransactionFormDialog } from '../bank-accounts/components/transaction-form-dialog';
import type { AccountPickerItem } from '../bank-accounts/types';
import type {
    CashFlowStats,
    ExpenseFilters,
    ExpenseRow,
    FilterOption,
    PaginationMeta,
} from './types';

interface Props {
    rows: ExpenseRow[];
    pagination: PaginationMeta;
    stats: CashFlowStats;
    filters: ExpenseFilters;
    categoryOptions: FilterOption[];
    bankAccountOptions: FilterOption[];
    inputByOptions: FilterOption[];
    accounts: AccountPickerItem[];
}

function isoOrNull(d: Date | null): string | null {
    return d ? toLocalIso(d) : null;
}
function parseIso(s: string | null): Date | null {
    return s ? new Date(s) : null;
}

export default function CashFlowExpenses({ rows, pagination, stats, filters, categoryOptions, bankAccountOptions, inputByOptions, accounts }: Props) {
    const { can } = useCan();
    const canDelete = can('delete expense');
    const canCreate = can('create expense');
    const [createOpen, setCreateOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<number[]>([]);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);
    const [search, setSearch] = React.useState(filters.search ?? '');
    const [dialogData, setDialogData] = React.useState<CashFlowDialogData | null>(null);

    const openRow = (row: ExpenseRow) => {
        setDialogData({
            kind: 'expense',
            id: row.id,
            amount: row.amount,
            date: row.transaction_date,
            description: row.description,
            category_id: row.category_id,
            reference_number: row.reference_number,
            attachment_url: row.attachment_url,
            attachment_name: row.attachment_name,
        });
    };

    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<ExpenseFilters>) => {
        const next = { ...filters, ...patch };
        router.get(
            cashFlowRoutes.expenses.url(),
            {
                search: next.search || undefined,
                date_from: next.date_from || undefined,
                date_to: next.date_to || undefined,
                categories: next.categories.length > 0 ? next.categories.join(',') : undefined,
                bank_accounts: next.bank_accounts.length > 0 ? next.bank_accounts.join(',') : undefined,
                input_by: next.input_by ?? undefined,
                sort: next.sort,
                direction: next.direction,
                per_page: next.per_page,
                page: next.page,
            },
            { preserveScroll: true, preserveState: true, only: ['rows', 'pagination', 'stats', 'filters'], replace: true },
        );
    };

    const reset = () => {
        setSearch('');
        router.get(cashFlowRoutes.expenses.url(), {}, { preserveScroll: true });
    };

    const onSort = (column: string) => {
        const direction: 'asc' | 'desc' = filters.sort === column && filters.direction === 'desc' ? 'asc' : 'desc';
        apply({ sort: column, direction, page: 1 });
    };

    const toggleAll = () => {
        if (selected.length === rows.length) setSelected([]);
        else setSelected(rows.map((r) => r.id));
    };
    const toggleOne = (id: number) =>
        setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    const handleBulkDelete = () => {
        setDeleteProcessing(true);
        router.post(
            cashFlowRoutes.bulkDestroy.url(),
            { uids: selected.map((id) => `transaction-${id}`) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`${selected.length} pengeluaran berhasil dihapus`);
                    setSelected([]);
                    setBulkDeleteOpen(false);
                },
                onError: () => toast.error('Gagal menghapus'),
                onFinish: () => setDeleteProcessing(false),
            },
        );
    };

    const exportPdf = () => {
        const params = new URLSearchParams();
        params.set('section', 'expenses');
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        if (filters.bank_accounts.length > 0) params.set('bank_accounts', filters.bank_accounts.join(','));
        window.open(companyUrl(`/cash-flow/export/pdf?${params.toString()}`), '_blank');
    };

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        (filters.date_from && filters.date_to ? 1 : 0) +
        filters.categories.length +
        filters.bank_accounts.length +
        (filters.input_by ? 1 : 0);

    const allSelected = rows.length > 0 && selected.length === rows.length;
    const periodLabel =
        filters.date_from && filters.date_to
            ? `${formatDate(filters.date_from)} – ${formatDate(filters.date_to)}`
            : 'Semua waktu';

    return (
        <AppLayout>
            <Head title="Pengeluaran" />

            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Pemasukan & Pengeluaran"
                    description="Daftar semua pengeluaran (debit) dari rekening bank Anda."
                    action={
                        <div className="flex flex-wrap items-center gap-2">
                            <TutorialButton slug="cash-flow" />
                            <Button variant="outline" size="md" onClick={exportPdf}>
                                <Download className="h-4 w-4" />
                                Export PDF
                            </Button>
                            {canCreate && accounts.length > 0 && (
                                <Button variant="red" size="md" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                    Input Pengeluaran
                                </Button>
                            )}
                        </div>
                    }
                />

                <CashFlowTabs active="expenses" />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatsCard label="Total Pengeluaran" value={formatCurrency(stats.total_amount)} icon={<ArrowUpRight />} color="orange" />
                    <StatsCard label="Jumlah Transaksi" value={stats.total_count.toLocaleString('id-ID')} icon={<FileText />} color="blue" />
                    <StatsCard label="Periode" value={periodLabel} icon={<Calendar />} color="purple" />
                </div>

                <section aria-label="Daftar pengeluaran" className={LIST_CARD}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <DatePicker
                            mode="range"
                            label="Rentang Tanggal"
                            value={{ from: parseIso(filters.date_from), to: parseIso(filters.date_to) }}
                            onChange={(r) => apply({ date_from: isoOrNull(r.from), date_to: isoOrNull(r.to), page: 1 })}
                            placeholder="Pilih rentang"
                            clearable
                        />
                        <Combobox
                            label="Kategori"
                            options={categoryOptions}
                            value={filters.categories[0] ?? null}
                            onChange={(v) => apply({ categories: v ? [Number(v)] : [], page: 1 })}
                            placeholder="Semua kategori"
                            clearable
                        />
                        <Combobox
                            label="Rekening"
                            options={bankAccountOptions}
                            value={filters.bank_accounts[0] ?? null}
                            onChange={(v) => apply({ bank_accounts: v ? [Number(v)] : [], page: 1 })}
                            placeholder="Semua rekening"
                            clearable
                        />
                        <Combobox
                            label="Diinput oleh"
                            options={inputByOptions}
                            value={filters.input_by}
                            onChange={(v) => apply({ input_by: v ? Number(v) : null, page: 1 })}
                            placeholder="Semua pengguna"
                            emptyText="Belum ada pencatat."
                            clearable
                        />
                        <Input
                            label="Cari"
                            icon={<Search className="h-4 w-4" />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Deskripsi, referensi, bank..."
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {activeFilterCount > 0 && (
                                <Badge variant="default" className="gap-1">
                                    <Filter className="h-3 w-3" />
                                    {activeFilterCount} filter aktif
                                </Badge>
                            )}
                            <span className="text-[13px] text-ob-ink-2">
                                Menampilkan <span className="tabular-nums">{rows.length}</span> dari{' '}
                                <span className="tabular-nums">{pagination.total}</span> hasil
                            </span>
                        </div>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={reset}>
                                <X className="h-3.5 w-3.5" />
                                Reset
                            </Button>
                        )}
                    </div>

                    {rows.length === 0 ? (
                        <EmptyState
                            icon={<ArrowUpRight className="h-7 w-7" />}
                            title="Tidak ada pengeluaran"
                            description="Coba sesuaikan filter atau periode pencarian."
                        />
                    ) : (
                        <div className={TABLE_SCROLL}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={HEAD_ROW}>
                                        <th scope="col" className="w-10 px-3 py-2.5">
                                            {canDelete && (
                                                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Pilih semua baris" />
                                            )}
                                        </th>
                                        <SortableTh label="Tanggal" column="transaction_date" current={filters.sort} direction={filters.direction} onSort={onSort} />
                                        <th scope="col" className={TH}>Deskripsi</th>
                                        <th scope="col" className={cn(TH, 'hidden md:table-cell')}>Kategori</th>
                                        <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>Rekening</th>
                                        <th scope="col" className={cn(TH, 'hidden xl:table-cell')}>Diinput oleh</th>
                                        <SortableTh label="Jumlah" column="amount" current={filters.sort} direction={filters.direction} onSort={onSort} align="right" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            onClick={() => openRow(row)}
                                            className={cn(
                                                'cursor-pointer border-b border-ob-line-soft transition-colors duration-150 last:border-0',
                                                selected.includes(row.id) ? 'bg-ob-act-fill/10' : 'hover:bg-ob-hover',
                                            )}
                                        >
                                            <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                                {canDelete && (
                                                    <Checkbox
                                                        checked={selected.includes(row.id)}
                                                        onCheckedChange={() => toggleOne(row.id)}
                                                        aria-label="Pilih baris"
                                                    />
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 align-middle text-ob-ink-2">
                                                {formatDate(row.transaction_date)}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <div className="max-w-80 truncate font-medium text-ob-ink">
                                                    {row.description || '—'}
                                                </div>
                                                {row.reference_number && (
                                                    <div className="font-mono text-xs text-ob-ink-3">
                                                        {row.reference_number}
                                                    </div>
                                                )}
                                                {row.attachment_url && (
                                                    <StopRowClick>
                                                        <AttachmentPreviewButton
                                                            url={row.attachment_url}
                                                            name={row.attachment_name}
                                                        />
                                                    </StopRowClick>
                                                )}
                                            </td>
                                            <td className="hidden px-3 py-3 align-middle md:table-cell">
                                                {row.category_label ? (
                                                    <Badge variant="zinc">{row.category_label}</Badge>
                                                ) : (
                                                    <span className="text-xs text-ob-ink-3">—</span>
                                                )}
                                            </td>
                                            <td className="hidden px-3 py-3 align-middle lg:table-cell">
                                                <div className="flex items-center gap-2 text-xs text-ob-ink-2">
                                                    <Building2 className="h-3.5 w-3.5 text-ob-ink-3" />
                                                    <span className="max-w-40 truncate">{row.account_name}</span>
                                                </div>
                                                <div className="pl-5 text-xs text-ob-ink-3">
                                                    {row.bank_name}
                                                </div>
                                            </td>
                                            <td className="hidden px-3 py-3 align-middle xl:table-cell">
                                                <InputByText name={row.input_by} />
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle">
                                                <span className="font-semibold tabular-nums text-ob-neg">
                                                    −{formatCurrency(row.amount)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {pagination.last_page > 1 && (
                        <div className="border-t border-ob-line pt-4">
                            <Pagination meta={pagination} onPageChange={(page) => apply({ page })} />
                        </div>
                    )}
                </section>
            </div>

            {canDelete && selected.length > 0 && (
                <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="flex min-w-80 items-center gap-4 rounded-2xl border border-ob-line bg-ob-card px-4 py-3 shadow-xl shadow-black/20">
                        <div className="flex items-center gap-2">
                            <Badge variant="default">{selected.length}</Badge>
                            <span className="text-sm font-medium text-ob-ink">pengeluaran dipilih</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="zinc" size="sm" onClick={() => setSelected([])}>
                                Batal
                            </Button>
                            <Button variant="red" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                                <Trash2 className="h-3.5 w-3.5" />
                                Hapus
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Hapus ${selected.length} pengeluaran?`}
                description="Tindakan ini tidak dapat dibatalkan."
                confirmLabel={`Hapus ${selected.length}`}
                loading={deleteProcessing}
                onConfirm={handleBulkDelete}
            />

            <TransactionDetailDialog
                open={!!dialogData}
                onOpenChange={(open) => { if (!open) setDialogData(null); }}
                data={dialogData}
                categoryOptions={categoryOptions}
            />

            {canCreate && accounts.length > 0 && (
                <TransactionFormDialog
                    open={createOpen}
                    onOpenChange={(open) => {
                        setCreateOpen(open);
                        if (!open) router.reload({ only: ['rows', 'stats', 'pagination', 'inputByOptions'] });
                    }}
                    accountId={accounts[0].id}
                    accounts={accounts}
                    type="debit"
                />
            )}
        </AppLayout>
    );
}
