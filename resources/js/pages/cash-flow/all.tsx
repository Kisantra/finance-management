import { Head, router } from '@inertiajs/react';
import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet, FileText, Filter, Plus, Scale, Search, X } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatsCard } from '@/components/shared/stats-card';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { useCan } from '@/hooks/use-can';
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
import type { CombinedFilters, CombinedRow, CombinedStats, FilterOption, PaginationMeta } from './types';

interface Props {
    rows: CombinedRow[];
    pagination: PaginationMeta;
    stats: CombinedStats;
    filters: CombinedFilters;
    incomeCategoryOptions: FilterOption[];
    expenseCategoryOptions: FilterOption[];
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

/** Selisih bertanda: arah uang lewat tanda, warna hanya redundansi. */
function signedCurrency(value: number): string {
    if (value === 0) return formatCurrency(0);
    return `${value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;
}

/** Baris tab Semua → data dialog rincian, dipetakan sama dengan tab Pemasukan dan Pengeluaran. */
function toDialogData(row: CombinedRow): CashFlowDialogData {
    if (row.source_type === 'payment') {
        return {
            kind: 'payment',
            amount: row.amount,
            date: row.date,
            invoice_number: row.invoice_number,
            client_name: row.client_name,
            reference_number: row.reference_number,
            attachment_url: row.attachment_url,
            attachment_name: row.attachment_name,
        };
    }
    return {
        kind: row.direction === 'in' ? 'income' : 'expense',
        id: row.id,
        amount: row.amount,
        date: row.date,
        description: row.description,
        category_id: row.category_id,
        reference_number: row.reference_number,
        attachment_url: row.attachment_url,
        attachment_name: row.attachment_name,
    };
}

export default function CashFlowAll({
    rows,
    pagination,
    stats,
    filters,
    incomeCategoryOptions,
    expenseCategoryOptions,
    bankAccountOptions,
    inputByOptions,
    accounts,
}: Props) {
    const { can } = useCan();
    const canCreateIncome = can('create income') && accounts.length > 0;
    const canCreateExpense = can('create expense') && accounts.length > 0;
    const [createType, setCreateType] = React.useState<'credit' | 'debit' | null>(null);
    const [dialogData, setDialogData] = React.useState<CashFlowDialogData | null>(null);
    const [search, setSearch] = React.useState(filters.search ?? '');

    // Filter memakai gabungan; dialog ubah hanya menerima kategori sejenis transaksinya.
    const categoryOptions = React.useMemo(
        () => [...incomeCategoryOptions, ...expenseCategoryOptions],
        [incomeCategoryOptions, expenseCategoryOptions],
    );

    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<CombinedFilters>) => {
        const next = { ...filters, ...patch };
        router.get(
            cashFlowRoutes.all.url(),
            {
                search: next.search || undefined,
                date_from: next.date_from || undefined,
                date_to: next.date_to || undefined,
                bank_accounts: next.bank_accounts.length > 0 ? next.bank_accounts.join(',') : undefined,
                categories: next.categories.length > 0 ? next.categories.join(',') : undefined,
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
        router.get(cashFlowRoutes.all.url(), {}, { preserveScroll: true });
    };

    const onSort = (column: string) => {
        const direction: 'asc' | 'desc' = filters.sort === column && filters.direction === 'desc' ? 'asc' : 'desc';
        apply({ sort: column, direction, page: 1 });
    };

    const exportExcel = () => {
        const params = new URLSearchParams();
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        if (filters.bank_accounts.length > 0) params.set('bank_accounts', filters.bank_accounts.join(','));
        if (filters.categories.length > 0) params.set('categories', filters.categories.join(','));
        if (filters.input_by) params.set('input_by', String(filters.input_by));
        if (filters.search) params.set('search', filters.search);
        const query = params.toString();
        window.open(companyUrl(`/cash-flow/all/export/excel${query ? `?${query}` : ''}`), '_blank');
    };

    const closeCreate = () => {
        setCreateType(null);
        router.reload({ only: ['rows', 'stats', 'pagination', 'inputByOptions'] });
    };

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        (filters.date_from && filters.date_to ? 1 : 0) +
        filters.bank_accounts.length +
        filters.categories.length +
        (filters.input_by ? 1 : 0);

    const periodLabel =
        filters.date_from && filters.date_to
            ? `${formatDate(filters.date_from)} – ${formatDate(filters.date_to)}`
            : 'Semua waktu';

    return (
        <AppLayout>
            <Head title="Pemasukan & Pengeluaran" />

            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Pemasukan & Pengeluaran"
                    description="Pemasukan (pembayaran invoice & transaksi langsung) dan pengeluaran dalam satu daftar. Transfer antar rekening dan pendanaan utang/piutang tidak termasuk."
                    action={
                        <div className="flex flex-wrap items-center gap-2">
                            <TutorialButton slug="cash-flow" />
                            <Button variant="outline" size="md" onClick={exportExcel}>
                                <FileSpreadsheet className="h-4 w-4" />
                                Export Excel
                            </Button>
                            {canCreateIncome && (
                                <Button variant="green" size="md" onClick={() => setCreateType('credit')}>
                                    <Plus className="h-4 w-4" />
                                    Input Pemasukan
                                </Button>
                            )}
                            {canCreateExpense && (
                                <Button variant="red" size="md" onClick={() => setCreateType('debit')}>
                                    <Plus className="h-4 w-4" />
                                    Input Pengeluaran
                                </Button>
                            )}
                        </div>
                    }
                />

                <CashFlowTabs active="all" />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatsCard label="Total Masuk" value={formatCurrency(stats.total_in)} icon={<ArrowDownLeft />} color="green" />
                    <StatsCard label="Total Keluar" value={formatCurrency(stats.total_out)} icon={<ArrowUpRight />} color="orange" />
                    <StatsCard label="Selisih" value={signedCurrency(stats.net)} icon={<Scale />} color={stats.net < 0 ? 'orange' : 'green'} />
                </div>

                <section aria-label="Daftar pemasukan dan pengeluaran" className={LIST_CARD}>
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
                            label="Rekening"
                            options={bankAccountOptions}
                            value={filters.bank_accounts[0] ?? null}
                            onChange={(v) => apply({ bank_accounts: v ? [Number(v)] : [], page: 1 })}
                            placeholder="Semua rekening"
                            clearable
                        />
                        <Combobox
                            label="Kategori"
                            options={categoryOptions}
                            value={filters.categories[0] ?? null}
                            onChange={(v) => apply({ categories: v ? [Number(v)] : [], page: 1 })}
                            placeholder="Semua kategori"
                            hint={filters.categories.length > 0 ? 'Pembayaran invoice tidak berkategori, jadi ikut tersembunyi.' : undefined}
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
                            placeholder="Invoice, klien, deskripsi..."
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
                                <span className="tabular-nums">{pagination.total}</span> hasil · {periodLabel}
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
                            icon={<Scale className="h-7 w-7" />}
                            title="Tidak ada transaksi"
                            description={
                                activeFilterCount > 0
                                    ? 'Coba sesuaikan filter atau periode pencarian.'
                                    : 'Pemasukan dan pengeluaran yang dicatat akan tampil di sini.'
                            }
                        />
                    ) : (
                        <div className={TABLE_SCROLL}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={HEAD_ROW}>
                                        <SortableTh
                                            label="Tanggal"
                                            column="date"
                                            current={filters.sort}
                                            direction={filters.direction}
                                            onSort={onSort}
                                            className="hidden sm:table-cell"
                                        />
                                        <th scope="col" className={cn(TH, 'hidden md:table-cell')}>Jenis</th>
                                        <th scope="col" className={TH}>Keterangan</th>
                                        <th scope="col" className={cn(TH, 'hidden xl:table-cell')}>Kategori</th>
                                        <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>Diinput oleh</th>
                                        <SortableTh
                                            label="Jumlah"
                                            column="amount"
                                            current={filters.sort}
                                            direction={filters.direction}
                                            onSort={onSort}
                                            align="right"
                                        />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const masuk = row.direction === 'in';
                                        const isPayment = row.source_type === 'payment';
                                        const open = () => setDialogData(toDialogData(row));
                                        return (
                                            <tr
                                                key={row.uid}
                                                onClick={open}
                                                className="cursor-pointer border-b border-ob-line-soft transition-colors duration-150 last:border-0 hover:bg-ob-hover"
                                            >
                                                <td className="hidden whitespace-nowrap px-3 py-3 align-top text-ob-ink-2 sm:table-cell">
                                                    {formatDate(row.date)}
                                                </td>
                                                <td className="hidden px-3 py-3 align-top md:table-cell">
                                                    <Badge variant={masuk ? 'green' : 'orange'}>{masuk ? 'Masuk' : 'Keluar'}</Badge>
                                                </td>
                                                <td className="px-3 py-3 align-top">
                                                    {/* Baris <tr> tidak terjangkau Tab; tombol ini jalan masuk papan ketik ke rincian. */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            open();
                                                        }}
                                                        className="block max-w-72 truncate rounded-md text-left font-medium text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                                    >
                                                        {(isPayment ? row.client_name : row.description) || '—'}
                                                    </button>
                                                    <span className="flex min-w-0 items-center gap-1 text-xs text-ob-ink-3">
                                                        <span className="shrink-0 sm:hidden">{formatDate(row.date)} ·</span>
                                                        {isPayment && <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />}
                                                        <span className="truncate">
                                                            {isPayment ? (
                                                                <>
                                                                    <span className="font-mono">{row.invoice_number ?? 'Pembayaran invoice'}</span>
                                                                    {' · '}
                                                                    {row.bank_name}
                                                                </>
                                                            ) : (
                                                                row.bank_name
                                                            )}
                                                        </span>
                                                    </span>
                                                    {row.attachment_url && (
                                                        <StopRowClick>
                                                            <AttachmentPreviewButton url={row.attachment_url} name={row.attachment_name} />
                                                        </StopRowClick>
                                                    )}
                                                </td>
                                                <td className="hidden px-3 py-3 align-top xl:table-cell">
                                                    {row.category_label ? (
                                                        <Badge variant="zinc">{row.category_label}</Badge>
                                                    ) : (
                                                        <span className="text-xs text-ob-ink-3">—</span>
                                                    )}
                                                </td>
                                                <td className="hidden px-3 py-3 align-top lg:table-cell">
                                                    <InputByText name={row.input_by} />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                                                    <span className={cn('font-semibold tabular-nums', masuk ? 'text-ob-pos' : 'text-ob-neg')}>
                                                        <span className="sr-only">{masuk ? 'masuk ' : 'keluar '}</span>
                                                        {masuk ? '+' : '−'}
                                                        {formatCurrency(row.amount)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
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

            <TransactionDetailDialog
                open={!!dialogData}
                onOpenChange={(open) => {
                    if (!open) setDialogData(null);
                }}
                data={dialogData}
                categoryOptions={dialogData?.kind === 'expense' ? expenseCategoryOptions : incomeCategoryOptions}
            />

            {canCreateIncome && (
                <TransactionFormDialog
                    open={createType === 'credit'}
                    onOpenChange={(open) => {
                        if (!open) closeCreate();
                    }}
                    accountId={accounts[0].id}
                    accounts={accounts}
                    type="credit"
                />
            )}
            {canCreateExpense && (
                <TransactionFormDialog
                    open={createType === 'debit'}
                    onOpenChange={(open) => {
                        if (!open) closeCreate();
                    }}
                    accountId={accounts[0].id}
                    accounts={accounts}
                    type="debit"
                />
            )}
        </AppLayout>
    );
}
