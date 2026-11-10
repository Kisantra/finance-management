import axios from 'axios';
import { ArrowUpDown, Banknote, CreditCard, Filter, Paperclip, Search, X } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import * as bankAccountsRoutes from '@/routes/bank-accounts';
import { TransactionDetailDialog, type PaymentDialogData } from '../../cash-flow/components/transaction-detail-dialog';
import type { PaginatedResponse, PaymentRow } from '../types';
import { t, tk, Trans } from '@/i18n';

interface Props {
    accountId: number;
    refreshKey: number;
}

interface Filters {
    search: string;
    payment_method: string;
    invoice_status: string;
    month: string;
    sort: string;
    direction: 'asc' | 'desc';
    page: number;
    per_page: number;
}

const DEFAULT_FILTERS: Filters = {
    search: '',
    payment_method: '',
    invoice_status: '',
    month: '',
    sort: 'payment_date',
    direction: 'desc',
    page: 1,
    per_page: 15,
};

const METHOD_LABEL: Record<string, string> = {
    cash: tk('Tunai'),
    bank_transfer: tk('Transfer Bank'),
};

const CLIENT_TYPE_LABEL: Record<string, string> = {
    individual: tk('Individu'),
    company: tk('Perusahaan'),
};

const STATUS_VARIANT: Record<string, 'zinc' | 'blue' | 'yellow' | 'green'> = {
    draft: 'zinc',
    sent: 'blue',
    partially_paid: 'yellow',
    paid: 'green',
};

const STATUS_LABEL: Record<string, string> = {
    draft: tk('Draft'),
    sent: tk('Terbit'),
    partially_paid: tk('Sebagian'),
    paid: tk('Lunas'),
};

export function PaymentsTab({ accountId, refreshKey }: Props) {
    // Rincian hanya-lihat + jurnal pembayaran ("titipan dulu"); pembayaran diubah di modul Invoice.
    const [detail, setDetail] = React.useState<PaymentDialogData | null>(null);
    const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
    const [data, setData] = React.useState<PaginatedResponse<PaymentRow> | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        setFilters(DEFAULT_FILTERS);
    }, [accountId]);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        axios
            .get(bankAccountsRoutes.payments.url(), {
                params: {
                    account: accountId,
                    search: filters.search || undefined,
                    payment_method: filters.payment_method || undefined,
                    invoice_status: filters.invoice_status || undefined,
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
        (filters.payment_method ? 1 : 0) +
        (filters.invoice_status ? 1 : 0) +
        (filters.month ? 1 : 0);

    const onSort = (column: string) => {
        setFilters((prev) => ({
            ...prev,
            sort: column,
            direction: prev.sort === column && prev.direction === 'desc' ? 'asc' : 'desc',
            page: 1,
        }));
    };

    const rows = data?.data ?? [];

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Combobox
                        options={[
                            { label: t('Semua metode'), value: '' },
                            { label: t('Tunai'), value: 'cash' },
                            { label: t('Transfer Bank'), value: 'bank_transfer' },
                        ]}
                        value={filters.payment_method}
                        onChange={(v) => setFilters((p) => ({ ...p, payment_method: (v as string) ?? '', page: 1 }))}
                        placeholder={t('Semua metode')}
                        clearable={false}
                    />
                    <Combobox
                        options={[
                            { label: t('Semua status'), value: '' },
                            { label: t('Terbit'), value: 'sent' },
                            { label: t('Sebagian'), value: 'partially_paid' },
                            { label: t('Lunas'), value: 'paid' },
                        ]}
                        value={filters.invoice_status}
                        onChange={(v) => setFilters((p) => ({ ...p, invoice_status: (v as string) ?? '', page: 1 }))}
                        placeholder={t('Semua status invoice')}
                        clearable={false}
                    />
                    <DatePicker
                        mode="month"
                        value={filters.month || null}
                        onChange={(m) => setFilters((p) => ({ ...p, month: m ?? '', page: 1 }))}
                        placeholder={t('Semua bulan')}
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
                                placeholder={t('Cari invoice, klien, atau referensi...')}
                                className="h-9"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            {activeFilterCount > 0 && (
                                <Badge variant="default" className="gap-1">
                                    <Filter className="w-3 h-3" />
                                    {t('{{count}} filter aktif', { count: activeFilterCount })}
                                </Badge>
                            )}
                            <div className="text-sm text-dark-500 dark:text-dark-400">
                                {data && data.total !== rows.length ? (
                                    <Trans
                                        i18nKey="Menampilkan <b>{{shown}}</b> dari <b>{{count}}</b> hasil"
                                        count={data.total}
                                        values={{ shown: rows.length }}
                                        components={{ b: <span className="tabular-nums" /> }}
                                    />
                                ) : (
                                    <Trans
                                        i18nKey="Menampilkan <b>{{count}}</b> hasil"
                                        count={rows.length}
                                        components={{ b: <span className="tabular-nums" /> }}
                                    />
                                )}
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
                            {t('Hapus filter')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                {loading ? (
                    <TableSkeleton />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={<Banknote className="w-7 h-7" />}
                        title={t('Belum ada pembayaran')}
                        description={t('Pembayaran invoice yang dialokasikan ke rekening ini akan muncul di sini.')}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                <tr>
                                    <SortableHeader
                                        label={t('Tanggal')}
                                        column="payment_date"
                                        current={filters.sort}
                                        direction={filters.direction}
                                        onSort={onSort}
                                    />
                                    <SortableHeader
                                        label={t('Invoice')}
                                        column="invoice_number"
                                        current={filters.sort}
                                        direction={filters.direction}
                                        onSort={onSort}
                                    />
                                    <SortableHeader
                                        label={t('Klien')}
                                        column="client_name"
                                        current={filters.sort}
                                        direction={filters.direction}
                                        onSort={onSort}
                                        className="hidden md:table-cell"
                                    />
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden sm:table-cell">
                                        {t('Metode')}
                                    </th>
                                    <SortableHeader
                                        label={t('Jumlah')}
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
                                        key={row.id}
                                        className="hover:bg-secondary-50/80 dark:hover:bg-dark-800/50 transition-colors"
                                    >
                                        <td className="px-3 py-3 align-middle text-sm text-dark-700 dark:text-dark-300 whitespace-nowrap">
                                            {formatDate(row.payment_date)}
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDetail({
                                                            kind: 'payment',
                                                            amount: row.amount,
                                                            date: row.payment_date,
                                                            invoice_number: row.invoice_number,
                                                            client_name: row.client_name,
                                                            reference_number: row.reference_number,
                                                            attachment_url: row.attachment_url,
                                                            attachment_name: row.attachment_name,
                                                            journal: row.journal,
                                                        })
                                                    }
                                                    className="rounded-md text-left font-mono text-sm font-medium text-dark-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill dark:text-dark-50"
                                                >
                                                    {row.invoice_number || '—'}
                                                    <span className="sr-only"> — {t('lihat rincian dan jurnal')}</span>
                                                </button>
                                                {row.invoice_status && (
                                                    <Badge
                                                        variant={STATUS_VARIANT[row.invoice_status] ?? 'zinc'}
                                                        size="sm"
                                                    >
                                                        {STATUS_LABEL[row.invoice_status] ? t(STATUS_LABEL[row.invoice_status]) : row.invoice_status}
                                                    </Badge>
                                                )}
                                            </div>
                                            {row.reference_number && (
                                                <div className="text-xs text-dark-500 dark:text-dark-400 font-mono mt-0.5">
                                                    {t('Ref: {{number}}', { number: row.reference_number })}
                                                </div>
                                            )}
                                            {row.attachment_url && (
                                                <AttachmentPreviewButton
                                                    url={row.attachment_url}
                                                    name={row.attachment_name}
                                                />
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-middle hidden md:table-cell">
                                            <div className="font-medium text-dark-900 dark:text-dark-50 truncate max-w-50">
                                                {row.client_name}
                                            </div>
                                            <div className="text-xs text-dark-500 dark:text-dark-400">
                                                {CLIENT_TYPE_LABEL[row.client_type] ? t(CLIENT_TYPE_LABEL[row.client_type]) : row.client_type}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-middle hidden sm:table-cell">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-secondary-100 dark:bg-dark-600 text-dark-700 dark:text-dark-300">
                                                {row.payment_method === 'cash' ? (
                                                    <Banknote className="w-3 h-3" />
                                                ) : (
                                                    <CreditCard className="w-3 h-3" />
                                                )}
                                                {METHOD_LABEL[row.payment_method] ? t(METHOD_LABEL[row.payment_method]) : row.payment_method}
                                            </span>
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

                {data && data.last_page > 1 && (
                    <div className="px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                        <Pagination
                            meta={data}
                            onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
                        />
                    </div>
                )}
            </div>

            <TransactionDetailDialog
                open={detail !== null}
                onOpenChange={(open) => !open && setDetail(null)}
                data={detail}
                categoryOptions={[]}
            />
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
