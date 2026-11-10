import { Head, router } from '@inertiajs/react';
import {
    ArrowUpRight,
    Building2,
    Download,
    Filter,
    Landmark,
    Lock,
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
import { FinancingBadge, ManagedByNote, managedByLabel, withFinancingGroup } from '@/components/shared/financing';
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
import { bankNameLabel, type AccountPickerItem } from '../bank-accounts/types';
import type {
    CashFlowStats,
    ExpenseFilters,
    ExpenseRow,
    FilterOption,
    PaginationMeta,
} from './types';
import { t, Trans } from '@/i18n';

interface Props {
    rows: ExpenseRow[];
    pagination: PaginationMeta;
    stats: CashFlowStats;
    filters: ExpenseFilters;
    /** Dialog ubah: kategori pengeluaran + grup Pendanaan. */
    categoryOptions: FilterOption[];
    /** Filter: seperti categoryOptions + pokok utang/piutang yang keluar. */
    filterCategoryOptions: FilterOption[];
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

export default function CashFlowExpenses({ rows, pagination, stats, filters, categoryOptions, filterCategoryOptions, bankAccountOptions, inputByOptions, accounts }: Props) {
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
            category_label: row.category_label,
            is_financing: row.is_financing,
            reference_number: row.reference_number,
            attachment_url: row.attachment_url,
            attachment_name: row.attachment_name,
            journal: row.journal,
            // Pokok utang/piutang: rincian hanya-lihat (dikelola modul Utang/Piutang).
            managed_by: row.managed_by,
        });
    };

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(timer);
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

    // Baris hanya-lihat (pokok utang/piutang) tidak ikut aksi massal.
    const selectable = rows.filter((r) => !r.managed_by);
    const toggleAll = () => {
        if (selected.length === selectable.length) setSelected([]);
        else setSelected(selectable.map((r) => r.id));
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
                    toast.success(t('{{count}} pengeluaran berhasil dihapus', { count: selected.length }));
                    setSelected([]);
                    setBulkDeleteOpen(false);
                },
                onError: () => toast.error(t('Gagal menghapus')),
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

    const allSelected = selectable.length > 0 && selected.length === selectable.length;

    return (
        <AppLayout>
            <Head title={t('Pemasukan & Pengeluaran', { context: 'menu' })} />

            <div className="flex flex-col gap-6">
                <PageHeader
                    title={t('Pemasukan & Pengeluaran', { context: 'menu' })}
                    description={t('Daftar semua pengeluaran dari rekening dan kas Anda.')}
                    action={
                        <div className="flex flex-wrap items-center gap-2">
                            <TutorialButton slug="cash-flow" />
                            <Button variant="outline" size="md" onClick={exportPdf}>
                                <Download className="h-4 w-4" />
                                {t('Ekspor PDF')}
                            </Button>
                            {canCreate && accounts.length > 0 && (
                                <Button variant="red" size="md" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                    {t('Catat Pengeluaran')}
                                </Button>
                            )}
                        </div>
                    }
                />

                <CashFlowTabs active="expenses" />

                {/* Uang yang tidak masuk Laba Rugi dipisah agar tidak bercampur tanpa label. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatsCard label={t('Beban (masuk Laba Rugi)')} value={formatCurrency(stats.pl_amount ?? 0)} icon={<ArrowUpRight />} color="orange" />
                    <StatsCard label={t('Pendanaan (tidak masuk Laba Rugi)')} value={formatCurrency(stats.financing_amount ?? 0)} icon={<Landmark />} color="purple" />
                    <StatsCard label={t('Total keluar')} value={formatCurrency(stats.total_amount)} icon={<ArrowUpRight />} color="orange" hint={t('Beban + Pendanaan')} />
                </div>

                <section aria-label={t('Daftar pengeluaran')} className={LIST_CARD}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <DatePicker
                            mode="range"
                            label={t('Rentang Tanggal')}
                            value={{ from: parseIso(filters.date_from), to: parseIso(filters.date_to) }}
                            onChange={(r) => apply({ date_from: isoOrNull(r.from), date_to: isoOrNull(r.to), page: 1 })}
                            placeholder={t('Pilih rentang')}
                            clearable
                        />
                        <Combobox
                            label={t('Kategori')}
                            options={withFinancingGroup(filterCategoryOptions)}
                            value={filters.categories[0] ?? null}
                            onChange={(v) => apply({ categories: v ? [Number(v)] : [], page: 1 })}
                            placeholder={t('Semua kategori')}
                            clearable
                        />
                        <Combobox
                            label={t('Rekening')}
                            options={bankAccountOptions}
                            value={filters.bank_accounts[0] ?? null}
                            onChange={(v) => apply({ bank_accounts: v ? [Number(v)] : [], page: 1 })}
                            placeholder={t('Semua rekening')}
                            clearable
                        />
                        <Combobox
                            label={t('Diinput oleh')}
                            options={inputByOptions}
                            value={filters.input_by}
                            onChange={(v) => apply({ input_by: v ? Number(v) : null, page: 1 })}
                            placeholder={t('Semua pengguna')}
                            emptyText={t('Belum ada pencatat.')}
                            clearable
                        />
                        <Input
                            label={t('Cari')}
                            icon={<Search className="h-4 w-4" />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Deskripsi, referensi, bank...')}
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {activeFilterCount > 0 && (
                                <Badge variant="default" className="gap-1">
                                    <Filter className="h-3 w-3" />
                                    {t('{{count}} filter aktif', { count: activeFilterCount })}
                                </Badge>
                            )}
                            <span className="text-[13px] text-ob-ink-2">
                                <Trans
                                    i18nKey="Menampilkan <b>{{shown}}</b> dari <b>{{count}}</b> hasil"
                                    count={pagination.total}
                                    values={{ shown: rows.length }}
                                    components={{ b: <span className="tabular-nums" /> }}
                                />
                            </span>
                        </div>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={reset}>
                                <X className="h-3.5 w-3.5" />
                                {t('Hapus filter')}
                            </Button>
                        )}
                    </div>

                    {rows.length === 0 ? (
                        <EmptyState
                            icon={<ArrowUpRight className="h-7 w-7" />}
                            title={t('Tidak ada pengeluaran')}
                            description={t('Coba sesuaikan filter atau periode pencarian.')}
                        />
                    ) : (
                        <div className={TABLE_SCROLL}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={HEAD_ROW}>
                                        <th scope="col" className="w-10 px-3 py-2.5">
                                            {canDelete && (
                                                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={t('Pilih semua baris')} />
                                            )}
                                        </th>
                                        <SortableTh label={t('Tanggal')} column="transaction_date" current={filters.sort} direction={filters.direction} onSort={onSort} />
                                        <th scope="col" className={TH}>{t('Deskripsi')}</th>
                                        <th scope="col" className={cn(TH, 'hidden md:table-cell')}>{t('Kategori')}</th>
                                        <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>{t('Rekening')}</th>
                                        <th scope="col" className={cn(TH, 'hidden xl:table-cell')}>{t('Diinput oleh')}</th>
                                        <SortableTh label={t('Jumlah')} column="amount" current={filters.sort} direction={filters.direction} onSort={onSort} align="right" />
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
                                                {row.managed_by ? (
                                                    <Lock className="h-4 w-4 text-ob-ink-3" aria-label={managedByLabel(row.managed_by)} />
                                                ) : (
                                                    canDelete && (
                                                        <Checkbox
                                                            checked={selected.includes(row.id)}
                                                            onCheckedChange={() => toggleOne(row.id)}
                                                            aria-label={t('Pilih baris')}
                                                        />
                                                    )
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
                                                {row.is_financing && <FinancingBadge className="mt-1 md:hidden" />}
                                                {row.managed_by && <ManagedByNote managedBy={row.managed_by} className="mt-1" />}
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
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {row.is_financing && <FinancingBadge />}
                                                    {row.category_label ? (
                                                        <Badge variant="zinc">{row.category_label}</Badge>
                                                    ) : (
                                                        <span className="text-xs text-ob-ink-3">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="hidden px-3 py-3 align-middle lg:table-cell">
                                                <div className="flex items-center gap-2 text-xs text-ob-ink-2">
                                                    <Building2 className="h-3.5 w-3.5 text-ob-ink-3" />
                                                    <span className="max-w-40 truncate">{row.account_name}</span>
                                                </div>
                                                <div className="pl-5 text-xs text-ob-ink-3">
                                                    {bankNameLabel(row.bank_name, row.account_type)}
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
                            <span className="text-sm font-medium text-ob-ink">{t('pengeluaran dipilih', { count: selected.length })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="zinc" size="sm" onClick={() => setSelected([])}>
                                {t('Batal')}
                            </Button>
                            <Button variant="red" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('Hapus')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={t('Hapus {{count}} pengeluaran?', { count: selected.length })}
                description={t('Tindakan ini tidak dapat dibatalkan.')}
                confirmLabel={t('Hapus {{n}}', { n: selected.length })}
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
