import { Head, Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Clock, Eye, FileSpreadsheet, FileText, MoreHorizontal, Pencil, Plus, Printer, Search, Trash2, Upload } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Pagination } from '@/components/shared/pagination';
import { AppLayout } from '@/layouts/app-layout';
import { openResource, parseResource, resourceHref, showResource, useResource } from '@/lib/resource-modal';
import { cn, toastErrors, toLocalIso } from '@/lib/utils';
import type { SharedProps } from '@/types';
import { Avatar, BTN, CARD, dueInfo, FIELD, issuedAgo, longDate, monthLabel, OverdueChip, rp, shortDate, InvoiceStatusPill, STATUS_LABEL, type InvoiceStatus } from './components/ob';
import { PrintInvoiceDialog, type CustomTemplate } from './components/print-invoice-dialog';

/* ─────────────────────────────────── types ─── */

interface InvoiceRow {
    id: number;
    invoice_number: string | null;
    client_name: string;
    client_type: string;
    issue_date: string;
    due_date: string;
    total_amount: number;
    amount_paid: number;
    amount_remaining: number;
    status: InvoiceStatus;
    faktur: string | null;
}

interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Stats {
    invoice_count: number;
    total_revenue: number;
    total_paid: number;
    total_outstanding: number;
    outstanding_count: number;
    draft_count: number;
    sent_count: number;
    partially_paid_count: number;
    paid_count: number;
    overdue_count: number;
    overdue_amount: number;
}

interface Filters {
    search?: string | null;
    status?: string | null;
    client_ids?: number[];
    month?: string;
    date_from?: string | null;
    date_to?: string | null;
    per_page?: number;
    sort?: string;
    direction?: string;
}

interface Props extends SharedProps {
    invoices: Paginated<InvoiceRow>;
    stats: Stats;
    clients: { label: string; value: number }[];
    customTemplates: CustomTemplate[];
    selectedInvoiceId: number | null;
    filters: Filters;
}

/* ─────────────────────────────────── konstanta ─── */

const DEFAULT_MONTH = toLocalIso(new Date()).slice(0, 7);

const STATUS_TABS: { value: string; label: string; countKey?: keyof Stats }[] = [
    { value: '', label: 'Semua' },
    { value: 'draft', label: 'Draft', countKey: 'draft_count' },
    { value: 'sent', label: 'Terkirim', countKey: 'sent_count' },
    { value: 'partially_paid', label: 'Sebagian', countKey: 'partially_paid_count' },
    { value: 'paid', label: 'Lunas', countKey: 'paid_count' },
];

/* Satu makna per hue: abu = draft, biru = terkirim, amber = sebagian, hijau = lunas. */
const SEGMENTS = [
    { key: 'draft', label: 'Draft', countKey: 'draft_count', bar: 'bg-ob-ink-3/50', dot: 'bg-ob-ink-3' },
    { key: 'sent', label: 'Terkirim', countKey: 'sent_count', bar: 'bg-ob-act', dot: 'bg-ob-act' },
    { key: 'partially_paid', label: 'Sebagian', countKey: 'partially_paid_count', bar: 'bg-ob-wait', dot: 'bg-ob-wait' },
    { key: 'paid', label: 'Lunas', countKey: 'paid_count', bar: 'bg-ob-pos', dot: 'bg-ob-pos' },
] as const;

/** Label footer per kolom urut: [nama, arah turun, arah naik]. */
const SORT_LABEL: Record<string, [string, string, string]> = {
    issue_date: ['tanggal invoice', 'terbaru', 'terlama'],
    due_date: ['jatuh tempo', 'terjauh', 'terdekat'],
    total_amount: ['jumlah', 'terbesar', 'terkecil'],
    client_name: ['nama klien', 'Z–A', 'A–Z'],
};

const PILL =
    'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

/* ─────────────────────────────────── halaman ─── */

function InvoicesPage({ invoices, stats, clients, customTemplates, selectedInvoiceId, filters }: Props) {
    const f = {
        search: filters.search ?? '',
        status: filters.status ?? '',
        client_ids: filters.client_ids ?? [],
        month: filters.month ?? '',
        date_from: filters.date_from ?? '',
        date_to: filters.date_to ?? '',
        sort: filters.sort ?? 'issue_date',
        direction: filters.direction ?? 'desc',
        per_page: filters.per_page ?? 25,
    };
    const hasRange = !!f.date_from || !!f.date_to;
    const overdueTab = f.status === 'overdue';

    const [search, setSearch] = React.useState(f.search);
    const [printRow, setPrintRow] = React.useState<InvoiceRow | null>(null);
    const [deleteRow, setDeleteRow] = React.useState<InvoiceRow | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        // Muat ulang di balik modal (setelah bayar/terbit) tidak perlu kerangka memuat.
        const offStart = router.on('start', (e) => {
            if (e.detail.visit.only.length === 0 && !parseResource(e.detail.visit.url.hash)) setLoading(true);
        });
        const offFinish = router.on('finish', () => setLoading(false));
        return () => {
            offStart();
            offFinish();
        };
    }, []);

    // /invoices/{id} (tautan lama, redirect setelah simpan) → modal berbasis hash di daftar yang sama.
    React.useEffect(() => {
        if (selectedInvoiceId == null) return;
        showResource('invoice', selectedInvoiceId);
    }, [selectedInvoiceId]);

    const openInvoiceId = useResource()?.id ?? null;

    const navigate = (params: Record<string, unknown>) => {
        router.get('/invoices', { ...f, ...params, page: 1 }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const exportUrl = (format: 'excel' | 'pdf') => {
        const params = new URLSearchParams();
        if (f.search) params.set('search', f.search);
        if (f.status) params.set('status', f.status);
        params.set('month', f.month ?? '');
        if (f.date_from) params.set('date_from', f.date_from);
        if (f.date_to) params.set('date_to', f.date_to);
        f.client_ids.forEach((id) => params.append('client_ids[]', String(id)));
        params.set('sort', f.sort);
        params.set('direction', f.direction);
        return `/invoices/export/${format}?${params}`;
    };

    const sortBy = (key: string) => {
        const direction = f.sort === key && f.direction === 'desc' ? 'asc' : 'desc';
        navigate({ sort: key, direction });
    };

    const deleteInvoice = () => {
        if (!deleteRow) return;
        setDeleting(true);
        router.delete(`/invoices/${deleteRow.id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (page) => {
                if (!(page.props.flash as { error?: string } | undefined)?.error) toast.success('Invoice dihapus.');
                setDeleteRow(null);
            },
            onError: (errs) => toastErrors(errs, 'DeleteInvoice'),
            onFinish: () => setDeleting(false),
        });
    };

    const hasFilters = !!f.search || f.client_ids.length > 0 || !!f.status || hasRange || f.month !== DEFAULT_MONTH;
    const resetFilters = () => {
        setSearch('');
        navigate({ search: '', status: '', client_ids: [], month: DEFAULT_MONTH, date_from: '', date_to: '' });
    };

    const periodLabel = overdueTab
        ? 'Perlu ditagih · semua bulan'
        : hasRange
          ? `${f.date_from ? longDate(f.date_from) : '…'} – ${f.date_to ? longDate(f.date_to) : '…'}`
          : f.month
            ? monthLabel(f.month)
            : 'Semua periode';

    const segmentTotal = SEGMENTS.reduce((s, seg) => s + (stats[seg.countKey] as number), 0);
    const paidPct = stats.total_revenue > 0 ? Math.round((stats.total_paid / stats.total_revenue) * 100) : 0;

    return (
        <>
            <Head title="Invoice" />
            <div className="flex flex-col gap-6 pt-1">
                {/* ── judul ── */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">Invoice</h1>
                        <p className="text-[13px] text-ob-ink-2">
                            {periodLabel} · {invoices.total} invoice
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className={BTN.secondary} icon={<Upload className="h-4 w-4" />}>
                                    Ekspor
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                    <a href={exportUrl('excel')}>
                                        <FileSpreadsheet className="h-4 w-4" /> Rekap Excel
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={exportUrl('pdf')}>
                                        <FileText className="h-4 w-4" /> Rekap PDF
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button asChild className={BTN.primary}>
                            <Link href="/invoices/create">
                                <Plus className="h-4 w-4" /> Buat Invoice
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* ── ringkasan ── */}
                <section aria-label="Ringkasan invoice" className={cn(CARD, 'flex flex-col gap-5')}>
                    <div className="grid grid-cols-2 gap-y-5 lg:grid-cols-4 lg:divide-x lg:divide-ob-line">
                        <StatBlock label="Total ditagih" value={rp(stats.total_revenue)} sub={`${stats.invoice_count} invoice terbit · tanpa draft`} />
                        <StatBlock label="Sudah dibayar" value={rp(stats.total_paid)} valueClass="text-ob-pos" sub={`${paidPct}% dari total`} />
                        <StatBlock label="Belum dibayar" value={rp(stats.total_outstanding)} sub={`${stats.outstanding_count} invoice`} />
                        <StatBlock
                            label="Perlu ditagih"
                            value={rp(stats.overdue_amount)}
                            valueClass={stats.overdue_count > 0 ? 'text-ob-late' : undefined}
                            sub={stats.overdue_count > 0 ? `${stats.overdue_count} invoice lewat jatuh tempo` : 'Tidak ada yang lewat jatuh tempo'}
                            onClick={stats.overdue_count > 0 ? () => navigate({ status: 'overdue' }) : undefined}
                        />
                    </div>
                    {segmentTotal > 0 && (
                        <div className="flex flex-col gap-2.5 border-t border-ob-line pt-4">
                            <div className="flex h-2 gap-1" aria-hidden="true">
                                {SEGMENTS.map((seg) => {
                                    const n = stats[seg.countKey] as number;
                                    return n > 0 ? <span key={seg.key} className={cn('h-full rounded-full', seg.bar)} style={{ width: `${(n / segmentTotal) * 100}%` }} /> : null;
                                })}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    {SEGMENTS.map((seg) => (
                                        <button
                                            key={seg.key}
                                            type="button"
                                            onClick={() => navigate({ status: seg.key })}
                                            className="inline-flex items-center gap-1.5 rounded-full text-[13px] text-ob-ink-2 hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                        >
                                            <span className={cn('h-2 w-2 rounded-full', seg.dot)} />
                                            {seg.label} <b className="font-semibold text-ob-ink">{stats[seg.countKey] as number}</b>
                                        </button>
                                    ))}
                                </div>
                                <span className="text-xs text-ob-ink-3">berdasarkan jumlah invoice</span>
                            </div>
                        </div>
                    )}
                </section>

                {/* ── daftar ── */}
                <section aria-label="Daftar invoice" className={cn(CARD, 'flex flex-col gap-4')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div role="group" aria-label="Filter status" className="flex items-center gap-0.5 rounded-full border border-ob-line bg-ob-rail p-[3px]">
                                {STATUS_TABS.map((t) => {
                                    const on = f.status === t.value;
                                    const count = t.countKey ? (stats[t.countKey] as number) : segmentTotal;
                                    return (
                                        <button
                                            key={t.value}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => !on && navigate({ status: t.value })}
                                            className={cn(PILL, 'h-8 px-3', on ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                                        >
                                            {t.label}
                                            <span className={cn('text-xs', on ? 'opacity-70' : 'text-ob-ink-3')}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                aria-pressed={overdueTab}
                                onClick={() => navigate({ status: overdueTab ? '' : 'overdue' })}
                                className={cn(
                                    PILL,
                                    'border font-semibold',
                                    overdueTab ? 'border-transparent bg-ob-late text-white' : 'border-ob-late/35 bg-ob-late/10 text-ob-late hover:bg-ob-late/15',
                                )}
                            >
                                <Clock className="h-4 w-4" /> Perlu ditagih <span className="text-xs opacity-80">{stats.overdue_count}</span>
                            </button>
                        </div>
                        <div className={cn(FIELD, 'flex flex-wrap items-center gap-2 [&_input]:h-10 [&_button]:h-10')}>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    navigate({ search });
                                }}
                                className="w-full sm:w-56"
                            >
                                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor atau klien…" icon={<Search className="h-4 w-4" />} aria-label="Cari invoice" />
                            </form>
                            <div className="w-full sm:w-48">
                                <Combobox multiple options={clients} value={f.client_ids} onChange={(v) => navigate({ client_ids: v })} placeholder="Semua klien" searchPlaceholder="Cari klien..." />
                            </div>
                            <div className={cn('w-44', overdueTab && 'pointer-events-none opacity-50')} title={overdueTab ? 'Perlu ditagih mencakup semua bulan' : undefined}>
                                <DatePicker mode="month" value={hasRange ? null : f.month || null} onChange={(v) => navigate({ month: v ?? '', date_from: '', date_to: '' })} placeholder={hasRange ? 'Rentang aktif' : 'Semua bulan'} clearable />
                            </div>
                            <div className={cn('w-56', overdueTab && 'pointer-events-none opacity-50')}>
                                <DatePicker
                                    mode="range"
                                    value={{ from: f.date_from ? new Date(f.date_from + 'T00:00:00') : null, to: f.date_to ? new Date(f.date_to + 'T00:00:00') : null }}
                                    onChange={(r) => navigate({ month: r.from || r.to ? '' : DEFAULT_MONTH, date_from: r.from ? toLocalIso(r.from) : '', date_to: r.to ? toLocalIso(r.to) : '' })}
                                    placeholder="Rentang tanggal"
                                    placeholderTo="…"
                                    clearable
                                />
                            </div>
                        </div>
                    </div>

                    <div className="-mx-2 overflow-x-auto px-2">
                        <table className="w-full min-w-[980px] text-sm">
                            <thead>
                                <tr className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3">
                                    <SortTh label="Klien" sortKey="client_name" f={f} onSort={sortBy} className="pl-3" />
                                    <th className="py-2.5 font-medium">No. invoice</th>
                                    <SortTh label="Tgl invoice" sortKey="issue_date" f={f} onSort={sortBy} />
                                    <SortTh label="Jatuh tempo" sortKey="due_date" f={f} onSort={sortBy} />
                                    <SortTh label="Jumlah" sortKey="total_amount" f={f} onSort={sortBy} align="right" />
                                    <th className="py-2.5 pl-6 font-medium">Status</th>
                                    <th className="w-12 py-2.5">
                                        <span className="sr-only">Aksi</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody aria-busy={loading}>
                                {loading
                                    ? Array.from({ length: 6 }, (_, i) => (
                                          <tr key={i} className="border-b border-ob-line-soft">
                                              <td colSpan={7} className="py-3">
                                                  <Skeleton className="h-9 rounded-xl bg-ob-inner dark:bg-ob-inner" />
                                              </td>
                                          </tr>
                                      ))
                                    : invoices.data.map((inv) => (
                                          <InvoiceTableRow
                                              key={inv.id}
                                              inv={inv}
                                              selected={inv.id === openInvoiceId}
                                              onOpen={() => openResource('invoice', inv.id)}
                                              onPrint={() => setPrintRow(inv)}
                                              onDelete={() => setDeleteRow(inv)}
                                          />
                                      ))}
                            </tbody>
                        </table>
                        {!loading && invoices.data.length === 0 && (
                            <EmptyList
                                statusLabel={overdueTab ? 'yang perlu ditagih' : f.status ? STATUS_LABEL[f.status as InvoiceStatus]?.toLowerCase() : null}
                                hasFilters={hasFilters}
                                onReset={resetFilters}
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ob-line pt-4 text-[13px] text-ob-ink-2">
                        <span>
                            {invoices.total} invoice · urut {(SORT_LABEL[f.sort] ?? SORT_LABEL.issue_date)[0]}{' '}
                            {(SORT_LABEL[f.sort] ?? SORT_LABEL.issue_date)[f.direction === 'desc' ? 1 : 2]}
                        </span>
                        {invoices.last_page > 1 ? (
                            <Pagination
                                meta={{ current_page: invoices.current_page, last_page: invoices.last_page, per_page: invoices.per_page, total: invoices.total, from: invoices.from, to: invoices.to }}
                                onPageChange={(page) => router.get('/invoices', { ...f, page }, { preserveState: true, preserveScroll: true })}
                            />
                        ) : (
                            <span>{f.per_page} per halaman</span>
                        )}
                    </div>
                </section>
            </div>

            {printRow && (
                <PrintInvoiceDialog
                    open
                    onOpenChange={(o) => !o && setPrintRow(null)}
                    invoiceId={printRow.id}
                    invoiceNumber={printRow.invoice_number}
                    totalAmount={printRow.total_amount}
                    amountPaid={printRow.amount_paid}
                    customTemplates={customTemplates}
                />
            )}

            <ConfirmDialog
                open={!!deleteRow}
                onOpenChange={(o) => !o && setDeleteRow(null)}
                title="Hapus invoice"
                description={deleteRow ? `Invoice ${deleteRow.invoice_number ?? 'draft'} untuk ${deleteRow.client_name} akan dihapus permanen beserta semua itemnya.` : ''}
                confirmLabel="Hapus invoice"
                loading={deleting}
                onConfirm={deleteInvoice}
            />
        </>
    );
}

/* ─────────────────────────────────── bagian ─── */

function StatBlock({ label, value, sub, valueClass, onClick }: { label: string; value: string; sub: string; valueClass?: string; onClick?: () => void }) {
    const body = (
        <>
            <span className="text-[13px] text-ob-ink-2">{label}</span>
            <span className={cn('text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink', valueClass)}>{value}</span>
            <span className="text-xs text-ob-ink-2">{sub}</span>
        </>
    );
    const cls = 'flex min-w-0 flex-col gap-1 px-0 text-left lg:px-6 lg:first:pl-0';
    return onClick ? (
        <button type="button" onClick={onClick} className={cn(cls, 'rounded-xl hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill')}>
            {body}
        </button>
    ) : (
        <div className={cls}>{body}</div>
    );
}

function SortTh({
    label,
    sortKey,
    f,
    onSort,
    align,
    className,
}: {
    label: string;
    sortKey: string;
    f: { sort: string; direction: string };
    onSort: (k: string) => void;
    align?: 'right';
    className?: string;
}) {
    const active = f.sort === sortKey;
    return (
        <th className={cn('py-2.5 font-medium', align === 'right' && 'text-right', className)} aria-sort={active ? (f.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button type="button" onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-1 rounded hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill', active && 'font-semibold text-ob-ink')}>
                {label}
                {active && (f.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </button>
        </th>
    );
}

function InvoiceTableRow({ inv, selected, onOpen, onPrint, onDelete }: { inv: InvoiceRow; selected: boolean; onOpen: () => void; onPrint: () => void; onDelete: () => void }) {
    const due = dueInfo(inv.status, inv.due_date);
    const paidPct = inv.total_amount > 0 ? Math.min(100, Math.round((inv.amount_paid / inv.total_amount) * 100)) : 0;

    return (
        <tr
            onClick={onOpen}
            className={cn(
                'cursor-pointer border-b border-ob-line-soft transition-colors hover:bg-ob-hover',
                due.overdue && 'bg-ob-late/[0.05]',
                selected && 'bg-ob-hover',
            )}
        >
            <td className="py-3 pl-3">
                <div className="flex items-center gap-3">
                    <Avatar name={inv.client_name} />
                    <div className="min-w-0">
                        <a
                            href={resourceHref('invoice', inv.id)}
                            onClick={(e) => {
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return e.stopPropagation();
                                e.preventDefault();
                            }}
                            className="block max-w-[260px] truncate font-semibold text-ob-ink focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                        >
                            {inv.client_name}
                        </a>
                        <span className="text-xs text-ob-ink-2">{inv.client_type === 'individual' ? 'Perorangan' : 'Perusahaan'}</span>
                    </div>
                </div>
            </td>
            <td className="py-3 font-mono text-xs text-ob-ink-2">{inv.invoice_number ?? <span className="text-ob-ink-3">belum bernomor</span>}</td>
            <td className="py-3">
                <span className="block text-ob-ink">{shortDate(inv.issue_date)}</span>
                <span className="text-xs text-ob-ink-2">{issuedAgo(inv.issue_date)}</span>
            </td>
            <td className="py-3">
                <span className={cn('block', due.overdue ? 'font-semibold text-ob-late' : 'text-ob-ink')}>{shortDate(inv.due_date)}</span>
                {due.overdue && due.label ? (
                    <OverdueChip label={due.label} />
                ) : (
                    due.label && <span className={cn('text-xs', due.tone === 'soon' ? 'text-ob-neg' : 'text-ob-ink-2')}>{due.label}</span>
                )}
            </td>
            <td className="py-3 text-right">
                <span className="block font-semibold text-ob-ink">{rp(inv.total_amount)}</span>
                {inv.status === 'partially_paid' && (
                    <>
                        <span className="text-xs text-ob-ink-2">sisa {rp(inv.amount_remaining)}</span>
                        <span className="ml-auto mt-1 block h-1 w-40 overflow-hidden rounded-full bg-ob-chip" aria-hidden="true">
                            <span className="block h-full rounded-full bg-ob-pos" style={{ width: `${paidPct}%` }} />
                        </span>
                    </>
                )}
            </td>
            <td className="py-3 pl-6">
                <InvoiceStatusPill status={inv.status} />
            </td>
            <td className="py-3 pr-2 text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 rounded-full p-0 text-ob-ink-2 hover:bg-ob-chip hover:text-ob-ink dark:hover:bg-ob-chip" aria-label={`Aksi untuk invoice ${inv.client_name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={onOpen}>
                            <Eye className="h-4 w-4" /> Lihat detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.visit(`/invoices/${inv.id}/edit`)}>
                            <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {inv.invoice_number && (
                            <DropdownMenuItem onClick={onPrint}>
                                <Printer className="h-4 w-4" /> Cetak PDF
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-ob-late focus:text-ob-late" onClick={onDelete}>
                            <Trash2 className="h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        </tr>
    );
}

function EmptyList({ statusLabel, hasFilters, onReset }: { statusLabel: string | null; hasFilters: boolean; onReset: () => void }) {
    return (
        <div className="my-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ob-line-strong px-4 py-10 text-center">
            <span className="text-sm font-semibold text-ob-ink">{statusLabel ? `Tidak ada invoice ${statusLabel}` : hasFilters ? 'Tidak ada invoice yang cocok' : 'Belum ada invoice'}</span>
            <span className="max-w-[320px] text-[13px] text-ob-ink-2">
                {hasFilters ? 'Coba bulan lain atau hapus filter.' : 'Invoice pertama bisa disimpan sebagai draft dulu, lalu diterbitkan saat siap.'}
            </span>
            {hasFilters ? (
                <Button variant="outline" className={BTN.small} onClick={onReset}>
                    Hapus filter
                </Button>
            ) : (
                <Button asChild className={cn(BTN.primary, 'h-9 px-4 text-[13px]')}>
                    <Link href="/invoices/create">
                        <Plus className="h-4 w-4" /> Buat Invoice
                    </Link>
                </Button>
            )}
        </div>
    );
}

InvoicesPage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default InvoicesPage;
