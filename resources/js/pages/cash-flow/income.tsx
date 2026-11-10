import { Head, router } from '@inertiajs/react';
import {
    ArrowDownLeft,
    Download,
    FileText,
    Filter,
    Landmark,
    Lock,
    Plus,
    Search,
    Trash2,
    Wallet,
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
import type { FilterOption, IncomeFilters, IncomeRow, PaginationMeta, CashFlowStats } from './types';
import { t, Trans } from '@/i18n';

interface Props {
    rows: IncomeRow[];
    pagination: PaginationMeta;
    stats: CashFlowStats;
    filters: IncomeFilters;
    clientOptions: FilterOption[];
    /** Dialog ubah: kategori pemasukan + grup Pendanaan. */
    categoryOptions: FilterOption[];
    /** Filter: seperti categoryOptions + pokok utang/piutang yang masuk. */
    filterCategoryOptions: FilterOption[];
    inputByOptions: FilterOption[];
    accounts: AccountPickerItem[];
}

function isoOrNull(d: Date | null): string | null {
    return d ? toLocalIso(d) : null;
}

function parseIso(s: string | null): Date | null {
    return s ? new Date(s) : null;
}

export default function CashFlowIncome({ rows, pagination, stats, filters, clientOptions, categoryOptions, filterCategoryOptions, inputByOptions, accounts }: Props) {
    const { can } = useCan();
    const canDelete = can('delete income');
    const canCreate = can('create income');
    const [createOpen, setCreateOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<string[]>([]);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);
    const [dialogData, setDialogData] = React.useState<CashFlowDialogData | null>(null);

    const openRow = (row: IncomeRow) => {
        if (row.source_type === 'payment') {
            setDialogData({
                kind: 'payment',
                amount: row.amount,
                date: row.date,
                invoice_number: row.invoice_number,
                client_name: row.client_name,
                reference_number: row.reference_number,
                attachment_url: row.attachment_url,
                attachment_name: row.attachment_name,
                journal: row.journal,
            });
        } else {
            setDialogData({
                kind: 'income',
                id: row.id,
                amount: row.amount,
                date: row.date,
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
        }
    };

    // Local filter state — debounced search
    const [search, setSearch] = React.useState(filters.search ?? '');
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                apply({ search, page: 1 });
            }
        }, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<IncomeFilters>) => {
        const next = { ...filters, ...patch };
        const params = {
            search: next.search || undefined,
            date_from: next.date_from || undefined,
            date_to: next.date_to || undefined,
            clients: next.clients.length > 0 ? next.clients.join(',') : undefined,
            categories: next.categories.length > 0 ? next.categories.join(',') : undefined,
            input_by: next.input_by ?? undefined,
            sort: next.sort,
            direction: next.direction,
            per_page: next.per_page,
            page: next.page,
        };
        router.get(cashFlowRoutes.income.url(), params, {
            preserveScroll: true,
            preserveState: true,
            only: ['rows', 'pagination', 'stats', 'filters'],
            replace: true,
        });
    };

    const reset = () => {
        setSearch('');
        router.get(cashFlowRoutes.income.url(), {}, { preserveScroll: true });
    };

    const onSort = (column: string) => {
        const direction: 'asc' | 'desc' = filters.sort === column && filters.direction === 'desc' ? 'asc' : 'desc';
        apply({ sort: column, direction, page: 1 });
    };

    // Baris hanya-lihat (pokok utang/piutang) tidak ikut aksi massal.
    const selectable = rows.filter((r) => !r.managed_by);
    const toggleAll = () => {
        if (selected.length === selectable.length) setSelected([]);
        else setSelected(selectable.map((r) => r.uid));
    };
    const toggleOne = (uid: string) => {
        setSelected((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));
    };

    const handleBulkDelete = () => {
        setDeleteProcessing(true);
        router.post(
            cashFlowRoutes.bulkDestroy.url(),
            { uids: selected },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(t('{{count}} catatan berhasil dihapus', { count: selected.length }));
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
        params.set('section', 'income');
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        window.open(companyUrl(`/cash-flow/export/pdf?${params.toString()}`), '_blank');
    };

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        (filters.date_from && filters.date_to ? 1 : 0) +
        filters.clients.length +
        filters.categories.length +
        (filters.input_by ? 1 : 0);

    const allSelected = selectable.length > 0 && selected.length === selectable.length;

    return (
        <AppLayout>
            <Head title={t('Pemasukan & Pengeluaran', { context: 'menu' })} />

            <div className="flex flex-col gap-6">
                <PageHeader
                    title={t('Pemasukan & Pengeluaran', { context: 'menu' })}
                    description={t('Daftar semua pemasukan dari pembayaran invoice & transaksi langsung.')}
                    action={
                        <div className="flex flex-wrap items-center gap-2">
                            <TutorialButton slug="cash-flow" />
                            <Button variant="outline" size="md" onClick={exportPdf}>
                                <Download className="h-4 w-4" />
                                {t('Ekspor PDF')}
                            </Button>
                            {canCreate && accounts.length > 0 && (
                                <Button variant="green" size="md" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                    {t('Catat Pemasukan')}
                                </Button>
                            )}
                        </div>
                    }
                />

                <CashFlowTabs active="income" />

                {/* Uang yang tidak masuk Laba Rugi dipisah agar tidak bercampur tanpa label. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatsCard label={t('Pemasukan (masuk Laba Rugi)')} value={formatCurrency(stats.pl_amount ?? 0)} icon={<ArrowDownLeft />} color="green" />
                    <StatsCard label={t('Pendanaan (tidak masuk Laba Rugi)')} value={formatCurrency(stats.financing_amount ?? 0)} icon={<Landmark />} color="purple" />
                    <StatsCard label={t('Total masuk')} value={formatCurrency(stats.total_amount)} icon={<ArrowDownLeft />} color="green" hint={t('Pemasukan + Pendanaan')} />
                </div>

                <section aria-label={t('Daftar pemasukan')} className={LIST_CARD}>
                    {/* Filter bar */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <DatePicker
                            mode="range"
                            label={t('Rentang Tanggal')}
                            value={{ from: parseIso(filters.date_from), to: parseIso(filters.date_to) }}
                            onChange={(r) =>
                                apply({
                                    date_from: isoOrNull(r.from),
                                    date_to: isoOrNull(r.to),
                                    page: 1,
                                })
                            }
                            placeholder={t('Pilih rentang')}
                            clearable
                        />
                        <Combobox
                            label={t('Klien')}
                            options={clientOptions}
                            value={filters.clients[0] ?? null}
                            onChange={(v) => apply({ clients: v ? [Number(v)] : [], page: 1 })}
                            placeholder={t('Semua klien')}
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
                            placeholder={t('Invoice, klien, deskripsi...')}
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

                    {/* Table */}
                    {rows.length === 0 ? (
                        <EmptyState
                            icon={<ArrowDownLeft className="h-7 w-7" />}
                            title={t('Tidak ada pemasukan')}
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
                                        <SortableTh label={t('Tanggal')} column="date" current={filters.sort} direction={filters.direction} onSort={onSort} />
                                        <th scope="col" className={TH}>{t('Sumber')}</th>
                                        <th scope="col" className={cn(TH, 'hidden md:table-cell')}>{t('Klien / Deskripsi')}</th>
                                        <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>{t('Kategori')}</th>
                                        <th scope="col" className={cn(TH, 'hidden xl:table-cell')}>{t('Diinput oleh')}</th>
                                        <SortableTh
                                            label={t('Jumlah')}
                                            column="amount"
                                            current={filters.sort}
                                            direction={filters.direction}
                                            onSort={onSort}
                                            align="right"
                                        />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.uid}
                                            onClick={() => openRow(row)}
                                            className={cn(
                                                'cursor-pointer border-b border-ob-line-soft transition-colors duration-150 last:border-0',
                                                selected.includes(row.uid) ? 'bg-ob-act-fill/10' : 'hover:bg-ob-hover',
                                            )}
                                        >
                                            <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                                {row.managed_by ? (
                                                    <Lock className="h-4 w-4 text-ob-ink-3" aria-label={managedByLabel(row.managed_by)} />
                                                ) : (
                                                    canDelete && (
                                                        <Checkbox
                                                            checked={selected.includes(row.uid)}
                                                            onCheckedChange={() => toggleOne(row.uid)}
                                                            aria-label={t('Pilih baris')}
                                                        />
                                                    )
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 align-middle text-ob-ink-2">
                                                {formatDate(row.date)}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <div className="flex flex-col items-start gap-1">
                                                    <SourceBadge type={row.source_type} />
                                                    {row.is_financing && <FinancingBadge className="lg:hidden" />}
                                                    {row.managed_by && <ManagedByNote managedBy={row.managed_by} className="md:hidden" />}
                                                </div>
                                            </td>
                                            <td className="hidden px-3 py-3 align-middle md:table-cell">
                                                {row.source_type === 'payment' ? (
                                                    <>
                                                        <div className="max-w-72 truncate font-medium text-ob-ink">
                                                            {row.client_name || '—'}
                                                        </div>
                                                        <div className="truncate font-mono text-xs text-ob-ink-3">
                                                            {row.invoice_number}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="max-w-72 truncate font-medium text-ob-ink">
                                                            {row.description || '—'}
                                                        </div>
                                                        <div className="truncate text-xs text-ob-ink-3">
                                                            {bankNameLabel(row.bank_name, row.account_type)}
                                                        </div>
                                                        {row.managed_by && <ManagedByNote managedBy={row.managed_by} className="mt-1" />}
                                                    </>
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
                                            <td className="hidden px-3 py-3 align-middle lg:table-cell">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {row.is_financing && <FinancingBadge />}
                                                    {row.category_label ? (
                                                        <Badge variant="zinc">{row.category_label}</Badge>
                                                    ) : (
                                                        <span className="text-xs text-ob-ink-3">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="hidden px-3 py-3 align-middle xl:table-cell">
                                                <InputByText name={row.input_by} />
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle">
                                                <span className="font-semibold tabular-nums text-ob-pos">
                                                    +{formatCurrency(row.amount)}
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

            {/* Floating bulk-action bar */}
            {canDelete && selected.length > 0 && (
                <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="flex min-w-80 items-center gap-4 rounded-2xl border border-ob-line bg-ob-card px-4 py-3 shadow-xl shadow-black/20">
                        <div className="flex items-center gap-2">
                            <Badge variant="default">{selected.length}</Badge>
                            <span className="text-sm font-medium text-ob-ink">{t('catatan dipilih', { count: selected.length })}</span>
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
                title={t('Hapus {{count}} catatan?', { count: selected.length })}
                description={t('Tindakan ini tidak dapat dibatalkan. Pembayaran terkait invoice dan transaksi akan ikut terhapus.')}
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
                    type="credit"
                />
            )}
        </AppLayout>
    );
}

/* ─── Subparts ─────────────────────────────────────────────── */

function SourceBadge({ type }: { type: string }) {
    if (type === 'payment') {
        return (
            <Badge variant="blue" className="gap-1.5">
                <FileText className="h-3 w-3" />
                {t('Invoice')}
            </Badge>
        );
    }
    return (
        <Badge variant="green" className="gap-1.5">
            <Wallet className="h-3 w-3" />
            {t('Langsung')}
        </Badge>
    );
}
