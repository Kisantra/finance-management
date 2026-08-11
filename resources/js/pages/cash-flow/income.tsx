import { Head, router } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpDown,
    Download,
    FileText,
    Filter,
    Paperclip,
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
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, formatDate, toLocalIso } from '@/lib/utils';
import * as cashFlowRoutes from '@/routes/cash-flow';
import { CashFlowStatsBar } from './components/cash-flow-stats';
import {
    TransactionDetailDialog,
    type CashFlowDialogData,
} from './components/transaction-detail-dialog';
import { TransactionFormDialog } from '../bank-accounts/components/transaction-form-dialog';
import type { AccountPickerItem } from '../bank-accounts/types';
import type { FilterOption, IncomeFilters, IncomeRow, PaginationMeta, CashFlowStats } from './types';

interface Props {
    rows: IncomeRow[];
    pagination: PaginationMeta;
    stats: CashFlowStats;
    filters: IncomeFilters;
    clientOptions: FilterOption[];
    categoryOptions: FilterOption[];
    accounts: AccountPickerItem[];
}

function isoOrNull(d: Date | null): string | null {
    return d ? toLocalIso(d) : null;
}

function parseIso(s: string | null): Date | null {
    return s ? new Date(s) : null;
}

export default function CashFlowIncome({ rows, pagination, stats, filters, clientOptions, categoryOptions, accounts }: Props) {
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
            });
        } else {
            setDialogData({
                kind: 'income',
                id: row.id,
                amount: row.amount,
                date: row.date,
                description: row.description,
                category_id: row.category_id,
                reference_number: row.reference_number,
                attachment_url: row.attachment_url,
                attachment_name: row.attachment_name,
            });
        }
    };

    // Local filter state — debounced search
    const [search, setSearch] = React.useState(filters.search ?? '');
    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                apply({ search, page: 1 });
            }
        }, 350);
        return () => clearTimeout(t);
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

    const toggleAll = () => {
        if (selected.length === rows.length) setSelected([]);
        else setSelected(rows.map((r) => r.uid));
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
                    toast.success(`${selected.length} catatan berhasil dihapus`);
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
        params.set('section', 'income');
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        window.open(companyUrl(`/cash-flow/export/pdf?${params.toString()}`), '_blank');
    };

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        (filters.date_from && filters.date_to ? 1 : 0) +
        filters.clients.length +
        filters.categories.length;

    const allSelected = rows.length > 0 && selected.length === rows.length;
    const periodLabel =
        filters.date_from && filters.date_to
            ? `${formatDate(filters.date_from)} – ${formatDate(filters.date_to)}`
            : 'Semua waktu';

    return (
        <AppLayout>
            <Head title="Pemasukan" />

            <div className="space-y-6">
                <PageHeader
                    title="Pemasukan"
                    description="Daftar semua pemasukan dari pembayaran invoice & transaksi langsung."
                    action={
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="md" onClick={exportPdf}>
                                <Download className="w-4 h-4" />
                                Export PDF
                            </Button>
                            {canCreate && accounts.length > 0 && (
                                <Button variant="green" size="md" onClick={() => setCreateOpen(true)}>
                                    <Plus className="w-4 h-4" />
                                    Input Pemasukan
                                </Button>
                            )}
                        </div>
                    }
                />

                <CashFlowStatsBar
                    stats={stats}
                    period={periodLabel}
                    primaryLabel="Total Pemasukan"
                    primaryTone="green"
                />

                {/* Filter bar */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <DatePicker
                            mode="range"
                            label="Rentang Tanggal"
                            value={{ from: parseIso(filters.date_from), to: parseIso(filters.date_to) }}
                            onChange={(r) =>
                                apply({
                                    date_from: isoOrNull(r.from),
                                    date_to: isoOrNull(r.to),
                                    page: 1,
                                })
                            }
                            placeholder="Pilih rentang"
                            clearable
                        />
                        <Combobox
                            label="Klien"
                            options={clientOptions}
                            value={filters.clients[0] ?? null}
                            onChange={(v) => apply({ clients: v ? [Number(v)] : [], page: 1 })}
                            placeholder="Semua klien"
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
                        <Input
                            label="Cari"
                            icon={<Search className="w-4 h-4" />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Invoice, klien, deskripsi..."
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
                            icon={<ArrowDownLeft className="w-7 h-7" />}
                            title="Tidak ada pemasukan"
                            description="Coba sesuaikan filter atau periode pencarian."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                    <tr>
                                        <th className="w-10 px-4 py-3">
                                            {canDelete && (
                                                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                                            )}
                                        </th>
                                        <SortableTh label="Tanggal" column="date" current={filters.sort} direction={filters.direction} onSort={onSort} />
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                            Sumber
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden md:table-cell">
                                            Klien / Deskripsi
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden lg:table-cell">
                                            Kategori
                                        </th>
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
                                <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                    {rows.map((row) => (
                                        <tr
                                            key={row.uid}
                                            onClick={() => openRow(row)}
                                            className={cn(
                                                'transition-colors cursor-pointer',
                                                selected.includes(row.uid)
                                                    ? 'bg-primary-50/50 dark:bg-primary-900/10'
                                                    : 'hover:bg-secondary-50/80 dark:hover:bg-dark-800/50',
                                            )}
                                        >
                                            <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                                {canDelete && (
                                                    <Checkbox
                                                        checked={selected.includes(row.uid)}
                                                        onCheckedChange={() => toggleOne(row.uid)}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle whitespace-nowrap text-sm text-dark-700 dark:text-dark-300">
                                                {formatDate(row.date)}
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <SourceBadge type={row.source_type} />
                                            </td>
                                            <td className="px-3 py-3 align-middle hidden md:table-cell">
                                                {row.source_type === 'payment' ? (
                                                    <>
                                                        <div className="font-medium text-dark-900 dark:text-dark-50 truncate max-w-72">
                                                            {row.client_name || '—'}
                                                        </div>
                                                        <div className="text-xs text-dark-500 dark:text-dark-400 font-mono truncate">
                                                            {row.invoice_number}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="font-medium text-dark-900 dark:text-dark-50 truncate max-w-72">
                                                            {row.description || '—'}
                                                        </div>
                                                        <div className="text-xs text-dark-500 dark:text-dark-400 truncate">
                                                            {row.bank_name}
                                                        </div>
                                                    </>
                                                )}
                                                {row.attachment_url && (
                                                    <AttachmentPreviewButton
                                                        url={row.attachment_url}
                                                        name={row.attachment_name}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle hidden lg:table-cell">
                                                {row.category_label ? (
                                                    <Badge variant="zinc" className="text-xs">{row.category_label}</Badge>
                                                ) : (
                                                    <span className="text-xs text-dark-400 dark:text-dark-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 align-middle text-right">
                                                <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
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
                        <div className="px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                            <Pagination meta={pagination} onPageChange={(page) => apply({ page })} />
                        </div>
                    )}
                </div>
            </div>

            {/* Floating bulk-action bar */}
            {canDelete && selected.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="bg-white dark:bg-dark-700 rounded-xl shadow-xl border border-secondary-200 dark:border-dark-600 px-4 py-3 flex items-center gap-4 min-w-80">
                        <div className="flex items-center gap-2">
                            <Badge variant="default">{selected.length}</Badge>
                            <span className="text-sm font-medium text-dark-900 dark:text-dark-50">
                                catatan dipilih
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="zinc" size="sm" onClick={() => setSelected([])}>
                                Batal
                            </Button>
                            <Button variant="red" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                                <Trash2 className="w-3.5 h-3.5" />
                                Hapus
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Hapus ${selected.length} catatan?`}
                description="Tindakan ini tidak dapat dibatalkan. Pembayaran terkait invoice dan transaksi akan ikut terhapus."
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
                        if (!open) router.reload({ only: ['rows', 'stats', 'pagination'] });
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
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                <FileText className="w-3 h-3" />
                Invoice
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
            <Wallet className="w-3 h-3" />
            Langsung
        </span>
    );
}

interface SortableThProps {
    label: string;
    column: string;
    current: string;
    direction: 'asc' | 'desc';
    onSort: (column: string) => void;
    align?: 'left' | 'right';
}

function SortableTh({ label, column, current, direction, onSort, align = 'left' }: SortableThProps) {
    const active = current === column;
    return (
        <th className={cn('px-3 py-3 text-xs font-semibold text-dark-500 dark:text-dark-400', align === 'right' ? 'text-right' : 'text-left')}>
            <button
                onClick={() => onSort(column)}
                className={cn(
                    'inline-flex items-center gap-1 hover:text-dark-900 dark:hover:text-dark-50 transition-colors',
                    active && 'text-primary-600 dark:text-primary-400',
                )}
            >
                {label}
                <ArrowUpDown className={cn('w-3 h-3', active ? 'opacity-100' : 'opacity-40')} />
            </button>
        </th>
    );
}
