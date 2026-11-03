import axios from 'axios';
import { ArrowDownLeft, ArrowUpDown, ArrowUpRight, Filter, Paperclip, Search, Trash2, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { useCan } from '@/hooks/use-can';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import * as bankAccountsRoutes from '@/routes/bank-accounts';
import * as bankTransactionsRoutes from '@/routes/bank-transactions';
import type { CategoryOption, PaginatedResponse, TransactionRow } from '../types';

/** Resolve which cash-flow feature a row belongs to for delete gating. */
function featureOf(row: TransactionRow): 'income' | 'expense' | 'transfer' {
    if (row.reference_number?.startsWith('TRF')) return 'transfer';
    return row.transaction_type === 'credit' ? 'income' : 'expense';
}

interface Props {
    accountId: number;
    /** Bumped after any mutation so we re-fetch */
    refreshKey: number;
}

interface Filters {
    search: string;
    transaction_type: 'credit' | 'debit' | '';
    category_id: number | null;
    month: string;
    sort: string;
    direction: 'asc' | 'desc';
    page: number;
    per_page: number;
}

const DEFAULT_FILTERS: Filters = {
    search: '',
    transaction_type: '',
    category_id: null,
    month: '',
    sort: 'transaction_date',
    direction: 'desc',
    page: 1,
    per_page: 15,
};

export function TransactionsTab({ accountId, refreshKey }: Props) {
    const { can } = useCan();
    const canDeleteRow = (row: TransactionRow) => can(`delete ${featureOf(row)}`);
    const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
    const [data, setData] = React.useState<PaginatedResponse<TransactionRow> | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [selected, setSelected] = React.useState<number[]>([]);
    const [categories, setCategories] = React.useState<CategoryOption[]>([]);
    const [deleteId, setDeleteId] = React.useState<number | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    /* Reset filters when account changes. */
    React.useEffect(() => {
        setFilters(DEFAULT_FILTERS);
        setSelected([]);
    }, [accountId]);

    /* Load categories once. */
    React.useEffect(() => {
        axios
            .get(companyUrl('/api/transaction-categories'))
            .then((res) => setCategories(res.data ?? []))
            .catch(() => setCategories([]));
    }, []);

    /* Fetch list whenever filters / account / refreshKey change. */
    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        axios
            .get(bankAccountsRoutes.transactions.url(), {
                params: {
                    account: accountId,
                    search: filters.search || undefined,
                    transaction_type: filters.transaction_type || undefined,
                    category_id: filters.category_id ?? undefined,
                    month: filters.month || undefined,
                    sort: filters.sort,
                    direction: filters.direction,
                    page: filters.page,
                    per_page: filters.per_page,
                },
            })
            .then((res) => {
                if (!cancelled) setData(res.data);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [accountId, filters, refreshKey]);

    const activeFilterCount =
        (filters.search ? 1 : 0) +
        (filters.transaction_type ? 1 : 0) +
        (filters.category_id ? 1 : 0) +
        (filters.month ? 1 : 0);

    const toggleAll = () => {
        if (!data) return;
        const deletableIds = data.data.filter(canDeleteRow).map((r) => r.id);
        setSelected((prev) => (prev.length === deletableIds.length ? [] : deletableIds));
    };

    const toggleOne = (id: number) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const onSort = (column: string) => {
        setFilters((prev) => ({
            ...prev,
            sort: column,
            direction: prev.sort === column && prev.direction === 'desc' ? 'asc' : 'desc',
            page: 1,
        }));
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleteProcessing(true);
        try {
            await axios.delete(bankTransactionsRoutes.destroy.url({ bankTransaction: deleteId }));
            toast.success('Transaksi berhasil dihapus');
            setDeleteId(null);
            // Refresh by re-setting filters
            setFilters((p) => ({ ...p }));
        } catch {
            toast.error('Gagal menghapus transaksi');
        } finally {
            setDeleteProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        setDeleteProcessing(true);
        try {
            await axios.post(bankTransactionsRoutes.bulkDestroy.url(), { ids: selected });
            toast.success(`${selected.length} transaksi berhasil dihapus`);
            setSelected([]);
            setBulkDeleteOpen(false);
            setFilters((p) => ({ ...p }));
        } catch {
            toast.error('Gagal menghapus transaksi');
        } finally {
            setDeleteProcessing(false);
        }
    };

    const rows = data?.data ?? [];
    const deletableCount = rows.filter(canDeleteRow).length;
    const allSelected = deletableCount > 0 && selected.length === deletableCount;

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Combobox
                        options={[
                            { label: 'Semua jenis', value: '' },
                            { label: '↓ Pemasukan (credit)', value: 'credit' },
                            { label: '↑ Pengeluaran (debit)', value: 'debit' },
                        ]}
                        value={filters.transaction_type}
                        onChange={(v) => setFilters((p) => ({ ...p, transaction_type: (v as 'credit' | 'debit' | '') ?? '', page: 1 }))}
                        placeholder="Semua jenis"
                        clearable={false}
                    />
                    <Combobox
                        options={categories.map((c) => ({ value: c.value, label: c.label, disabled: c.disabled }))}
                        value={filters.category_id ?? undefined}
                        onChange={(v) => setFilters((p) => ({ ...p, category_id: v ? Number(v) : null, page: 1 }))}
                        placeholder="Semua kategori"
                    />
                    <DatePicker
                        mode="month"
                        value={filters.month || null}
                        onChange={(m) => setFilters((p) => ({ ...p, month: m ?? '', page: 1 }))}
                        placeholder="Semua bulan"
                        clearable
                    />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                        <div className="w-full sm:w-64">
                            <Input
                                icon={<Search className="w-4 h-4" />}
                                value={filters.search}
                                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
                                placeholder="Cari deskripsi atau referensi..."
                                className="h-9"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            {activeFilterCount > 0 && (
                                <Badge variant="default" className="gap-1">
                                    <Filter className="w-3 h-3" />
                                    {activeFilterCount} filter aktif
                                </Badge>
                            )}
                            <div className="text-sm text-dark-500 dark:text-dark-400">
                                <span className="hidden sm:inline">Menampilkan </span>
                                <span className="tabular-nums">{rows.length}</span>
                                {data && data.total !== rows.length && (
                                    <span className="hidden sm:inline"> dari <span className="tabular-nums">{data.total}</span></span>
                                )}{' '}hasil
                            </div>
                        </div>
                    </div>
                    {activeFilterCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilters(DEFAULT_FILTERS)}
                            className="text-xs text-dark-500"
                        >
                            <X className="w-3.5 h-3.5" />
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            {/* Table card */}
            <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                {loading ? (
                    <TableSkeleton />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={<ArrowUpDown className="w-7 h-7" />}
                        title="Belum ada transaksi"
                        description="Catat transaksi pertama Anda dengan tombol Pemasukan atau Pengeluaran di atas."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                <tr>
                                    <th className="w-10 px-4 py-3">
                                        {rows.some(canDeleteRow) && (
                                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                                        )}
                                    </th>
                                    <SortableHeader
                                        label="Transaksi"
                                        column="description"
                                        current={filters.sort}
                                        direction={filters.direction}
                                        onSort={onSort}
                                    />
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden md:table-cell">
                                        Kategori
                                    </th>
                                    <SortableHeader
                                        label="Tanggal"
                                        column="transaction_date"
                                        current={filters.sort}
                                        direction={filters.direction}
                                        onSort={onSort}
                                        className="hidden sm:table-cell"
                                    />
                                    <SortableHeader
                                        label="Jumlah"
                                        column="amount"
                                        current={filters.sort}
                                        direction={filters.direction}
                                        onSort={onSort}
                                        align="right"
                                    />
                                    <th className="w-10 px-3 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                {rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={cn(
                                            'group transition-colors',
                                            selected.includes(row.id)
                                                ? 'bg-primary-50/50 dark:bg-primary-900/10'
                                                : 'hover:bg-secondary-50/80 dark:hover:bg-dark-800/50',
                                        )}
                                    >
                                        <td className="px-4 py-3 align-middle">
                                            {canDeleteRow(row) && (
                                                <Checkbox
                                                    checked={selected.includes(row.id)}
                                                    onCheckedChange={() => toggleOne(row.id)}
                                                />
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            <div className="flex items-start gap-3">
                                                <TypeIcon type={row.transaction_type} />
                                                <div className="min-w-0">
                                                    <div className="font-medium text-dark-900 dark:text-dark-50 truncate max-w-70">
                                                        {row.description}
                                                    </div>
                                                    <div className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-2 mt-0.5">
                                                        {row.reference_number && (
                                                            <span className="font-mono">{row.reference_number}</span>
                                                        )}
                                                        {row.attachment_url && (
                                                            <AttachmentPreviewButton
                                                                url={row.attachment_url}
                                                                name={row.attachment_name}
                                                                className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-middle hidden md:table-cell">
                                            {row.category ? (
                                                <div>
                                                    {row.category.parent_label && (
                                                        <div className="text-[11px] text-dark-400 dark:text-dark-500 truncate">
                                                            {row.category.parent_label}
                                                        </div>
                                                    )}
                                                    <Badge variant="zinc" className="text-xs">
                                                        {row.category.label}
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-dark-400 dark:text-dark-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-middle hidden sm:table-cell text-sm text-dark-700 dark:text-dark-300 whitespace-nowrap">
                                            {formatDate(row.transaction_date)}
                                        </td>
                                        <td className="px-3 py-3 align-middle text-right">
                                            <span className={cn(
                                                'font-semibold tabular-nums',
                                                row.transaction_type === 'credit'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-red-600 dark:text-red-400',
                                            )}>
                                                {row.transaction_type === 'credit' ? '+' : '−'}{formatCurrency(row.amount)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            {canDeleteRow(row) && (
                                                <button
                                                    onClick={() => setDeleteId(row.id)}
                                                    className="p-1.5 rounded-lg text-dark-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {data && data.last_page > 1 && (
                    <div className="px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                        <Pagination
                            meta={data}
                            onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
                        />
                    </div>
                )}
            </div>

            {/* Floating bulk-action bar */}
            {selected.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="bg-white dark:bg-dark-700 rounded-xl shadow-xl border border-secondary-200 dark:border-dark-600 px-4 py-3 flex items-center gap-4 min-w-80">
                        <div className="flex items-center gap-2">
                            <Badge variant="default">{selected.length}</Badge>
                            <span className="text-sm font-medium text-dark-900 dark:text-dark-50">
                                transaksi dipilih
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

            {/* Confirm dialogs */}
            <ConfirmDialog
                open={deleteId !== null}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="Hapus transaksi?"
                description="Tindakan ini tidak dapat dibatalkan. Transaksi terkait transfer akan ikut dihapus."
                confirmLabel="Hapus"
                loading={deleteProcessing}
                onConfirm={handleDelete}
            />
            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Hapus ${selected.length} transaksi?`}
                description="Tindakan ini tidak dapat dibatalkan. Transaksi terkait transfer akan ikut dihapus."
                confirmLabel={`Hapus ${selected.length}`}
                loading={deleteProcessing}
                onConfirm={handleBulkDelete}
            />
        </div>
    );
}

/* ─── Subparts ─────────────────────────────────────────────── */

function TypeIcon({ type }: { type: 'credit' | 'debit' }) {
    const isIn = type === 'credit';
    return (
        <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
            isIn ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30',
        )}>
            {isIn ? (
                <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
                <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
        </div>
    );
}

interface SortableHeaderProps {
    label: string;
    column: string;
    current: string;
    direction: 'asc' | 'desc';
    onSort: (column: string) => void;
    align?: 'left' | 'right';
    className?: string;
}

function SortableHeader({ label, column, current, direction, onSort, align = 'left', className }: SortableHeaderProps) {
    const active = current === column;
    return (
        <th className={cn(
            'px-3 py-3 text-xs font-semibold text-dark-500 dark:text-dark-400',
            align === 'right' ? 'text-right' : 'text-left',
            className,
        )}>
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

function TableSkeleton() {
    return (
        <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-secondary-100/60 dark:bg-dark-600/40 rounded-lg animate-pulse" />
            ))}
        </div>
    );
}
