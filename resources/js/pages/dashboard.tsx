import { Link, router, usePage } from '@inertiajs/react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Plus } from 'lucide-react';
import * as React from 'react';
import { AppLayout } from '@/layouts/app-layout';
import { CashFlowChart, CashFlowChartSkeleton, compactRupiah } from '@/components/dashboard/cash-flow-chart';
import { DonutChart, useDonutRamp } from '@/components/dashboard/donut-chart';
import { RangeCalendar } from '@/components/dashboard/range-calendar';
import { ScrollList, StatusPill, Widget, WidgetEmpty, WidgetError, WidgetLink } from '@/components/dashboard/widget';
import { Combobox } from '@/components/ui/combobox';
import { useCan } from '@/hooks/use-can';
import { resourceHref } from '@/lib/resource-modal';
import { cn, formatCurrency, toLocalIso } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────────── tipe props ─── */

interface FinancialOverview {
    total_income: number;
    total_profit: number;
    total_outstanding: number;
    total_hpp: number;
    total_pp: number;
    total_balance: number;
}

interface Stats {
    total_balance: number;
    income_this_month: number;
    expenses_this_month: number;
    net_this_month: number;
    pending_invoices_count: number;
    pending_invoices_amount: number;
}

type ChartPeriod = 'weekly' | 'monthly' | 'yearly' | 'range';

interface CashFlowChartData {
    period: ChartPeriod;
    granularity: 'daily' | 'weekly' | 'monthly' | 'yearly';
    range: { from: string; to: string };
    account: { id: number; label: string } | null;
    labels: string[];
    income: number[];
    expenses: number[];
}

interface CategoryExpense {
    name: string;
    value: number;
}

interface BankAccount {
    id: number;
    name: string;
    bank: string;
    account_number: string;
    balance: number;
}

interface PendingInvoice {
    id: number;
    invoice_number: string | null;
    client: string;
    total_amount: number;
    paid: number;
    remaining: number;
    due_date: string | null;
    status: string;
    days_until_due: number | null;
}

interface RecentTransaction {
    date: string;
    description: string;
    type: 'income' | 'expense';
    amount: number;
    account: string;
}

interface DashboardProps extends SharedProps {
    generatedAt: string;
    period: { from: string; to: string; label: string };
    financialOverview: FinancialOverview;
    stats: Stats;
    cashFlowChart: CashFlowChartData;
    accountOptions: { id: number; label: string }[];
    expensesByCategory: CategoryExpense[];
    incomeByCategory: CategoryExpense[];
    bankAccounts: BankAccount[];
    pendingInvoices: PendingInvoice[];
    recentTransactions: RecentTransaction[];
}

/* ─────────────────────────────────────── helper ─── */

const PERIODS: { value: ChartPeriod; label: string }[] = [
    { value: 'weekly', label: 'Mingguan' },
    { value: 'monthly', label: 'Bulanan' },
    { value: 'yearly', label: 'Tahunan' },
];

const CHART_STORAGE_KEY = 'dashboard.chart';

interface ChartParams {
    period: ChartPeriod;
    from: string | null;
    to: string | null;
    account: number | null;
}

function shortDate(iso: string | null): string {
    if (!iso) return '–';
    return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** "Bank Negara Indonesia" → BNI; "Mandiri" → MAN. */
function bankAbbrev(bank: string): string {
    const words = bank.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    const abbr = words.length >= 2 ? words.map((w) => w[0]).join('') : (words[0] ?? '?').slice(0, 3);
    return abbr.toUpperCase().slice(0, 3);
}

function dueText(days: number | null): { text: string; tone: string } {
    if (days === null) return { text: '', tone: 'text-ob-ink-3' };
    if (days < 0) return { text: `${Math.abs(days)} hari lewat`, tone: 'text-ob-late' };
    if (days === 0) return { text: 'hari ini', tone: 'text-ob-neg' };
    if (days <= 7) return { text: `${days} hari lagi`, tone: 'text-ob-neg' };
    return { text: `${days} hari lagi`, tone: 'text-ob-ink-3' };
}

function InvoiceStatus({ status }: { status: string }) {
    if (status === 'overdue') return <StatusPill tone="late">Lewat tempo</StatusPill>;
    if (status === 'partially_paid') return <StatusPill tone="wait">Sebagian</StatusPill>;
    if (status === 'paid') return <StatusPill tone="pos" icon={<Check className="h-2.5 w-2.5" strokeWidth={3.5} />}>Lunas</StatusPill>;
    return <StatusPill tone="act">Terkirim</StatusPill>;
}

const PILL_BTN =
    'h-[26px] rounded-full px-3 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

/* ─────────────────────────────────────── halaman ─── */

export default function Dashboard() {
    const props = usePage<DashboardProps>().props;
    const {
        generatedAt,
        period,
        financialOverview,
        stats,
        cashFlowChart,
        accountOptions,
        expensesByCategory,
        incomeByCategory,
        bankAccounts,
        pendingInvoices,
        recentTransactions,
    } = props;
    const { can } = useCan();
    const ramp = useDonutRamp();

    /* ── grafik: pil periode, rentang, filter rekening → partial reload ── */
    const [chart, setChart] = React.useState<ChartParams>({
        period: cashFlowChart.period,
        from: cashFlowChart.period === 'range' ? cashFlowChart.range.from : null,
        to: cashFlowChart.period === 'range' ? cashFlowChart.range.to : null,
        account: cashFlowChart.account?.id ?? null,
    });
    const [chartLoading, setChartLoading] = React.useState(false);
    const [chartError, setChartError] = React.useState(false);
    const [categoryTab, setCategoryTab] = React.useState<'expense' | 'income'>('expense');

    const loadChart = React.useCallback((next: ChartParams) => {
        setChart(next);
        setChartError(false);
        try {
            localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(next));
        } catch {
            /* penyimpanan lokal opsional */
        }
        router.reload({
            only: ['cashFlowChart'],
            data: {
                chart_period: next.period,
                chart_from: next.from ?? '',
                chart_to: next.to ?? '',
                chart_account: next.account ?? '',
            },
            onStart: () => setChartLoading(true),
            onFinish: () => setChartLoading(false),
            onError: () => setChartError(true),
        });
    }, []);

    /* Pilihan terakhir pengguna dipulihkan bila URL tidak membawa parameter grafik. */
    React.useEffect(() => {
        if (window.location.search.includes('chart_')) return;
        try {
            const stored = localStorage.getItem(CHART_STORAGE_KEY);
            if (!stored) return;
            const saved = JSON.parse(stored) as ChartParams;
            if (saved.period !== 'monthly' || saved.account) loadChart(saved);
        } catch {
            /* abaikan nilai tersimpan yang rusak */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const today = new Date();
    const todayLabel = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const categories = categoryTab === 'expense' ? expensesByCategory : incomeByCategory;
    const categoryTotal = categories.reduce((s, c) => s + c.value, 0);
    const biggest = categories[0];
    const net = stats.net_this_month;
    /* Satu sumber periode yang aktif: pil periode ATAU kalender rentang, tidak keduanya. */
    const rangeActive = chart.period === 'range';
    /* Arus bersih untuk periode yang sedang tampil di grafik (pil atau rentang kalender). */
    const chartNet = cashFlowChart.income.reduce((sum, v) => sum + v, 0) - cashFlowChart.expenses.reduce((sum, v) => sum + v, 0);

    return (
        <div className="flex flex-col gap-[22px] pt-2">
            {/* Header halaman */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">Ringkasan</h1>
                    <p className="text-[13px] text-ob-ink-2">
                        {todayLabel} · data per {generatedAt}
                    </p>
                </div>
                {can('create invoices') && (
                    <Link
                        href="/invoices/create"
                        className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-ob-act-fill px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page sm:self-auto"
                    >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        Buat Invoice
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
                {/* ═══ Arus Kas ═══ */}
                <Widget
                    title="Arus Kas"
                    height={470}
                    className="md:col-span-2 xl:col-span-8"
                    bodyClassName="gap-4"
                    action={
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <div
                                role="group"
                                aria-label={rangeActive ? 'Periode grafik (tidak dipakai, grafik memakai rentang dari kalender)' : 'Periode grafik'}
                                title={rangeActive ? 'Grafik memakai rentang dari kalender. Pilih salah satu untuk kembali.' : undefined}
                                className={cn(
                                    'flex items-center gap-0.5 rounded-full border bg-ob-rail p-[3px] transition-opacity duration-200',
                                    rangeActive ? 'border-dashed border-ob-line-strong opacity-55 hover:opacity-100' : 'border-ob-line',
                                )}
                            >
                                {PERIODS.map((p) => {
                                    const on = chart.period === p.value;
                                    return (
                                        <button
                                            key={p.value}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => !on && loadChart({ ...chart, period: p.value, from: null, to: null })}
                                            className={cn(PILL_BTN, on ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                                        >
                                            {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <Combobox
                                options={[{ value: 0, label: 'Semua rekening' }, ...accountOptions.map((a) => ({ value: a.id, label: a.label }))]}
                                value={chart.account ?? 0}
                                onChange={(v) => loadChart({ ...chart, account: v ? Number(v) : null })}
                                placeholder="Semua rekening"
                                clearable={false}
                                className="w-56"
                            />
                        </div>
                    }
                >
                    {/* Hero: stok (saldo) lalu arus bulan ini */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <p className="text-[40px] font-semibold leading-none tracking-[-0.01em] text-ob-ink">{formatCurrency(stats.total_balance)}</p>
                            <p className="text-[13px] text-ob-ink-2">
                                Total saldo · {bankAccounts.length} rekening
                                {cashFlowChart.account && <span className="text-ob-ink-3"> · grafik: {cashFlowChart.account.label}</span>}
                            </p>
                        </div>
                        <dl className="flex flex-wrap items-end gap-x-8 gap-y-2">
                            <div className="flex flex-col gap-1">
                                <dt className="inline-flex items-center gap-1.5 text-xs text-ob-ink-2">
                                    <span aria-hidden="true" className="h-2.5 w-3.5 rounded-[3px]" style={{ background: 'var(--ob-bar-now)' }} />
                                    Pemasukan {period.label.split(' ').slice(0, 2).join(' ')}
                                </dt>
                                <dd className="text-[15px] font-semibold text-ob-ink">{formatCurrency(stats.income_this_month)}</dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="inline-flex items-center gap-1.5 text-xs text-ob-ink-2">
                                    <span aria-hidden="true" className="ob-hatch h-2.5 w-3.5 rounded-[3px]" />
                                    Pengeluaran {period.label.split(' ').slice(0, 2).join(' ')}
                                </dt>
                                <dd className="text-[15px] font-semibold text-ob-ink">{formatCurrency(stats.expenses_this_month)}</dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="text-xs text-ob-ink-2">Arus bersih</dt>
                                <dd className={cn('text-[15px] font-semibold', net >= 0 ? 'text-ob-pos' : 'text-ob-neg')}>
                                    <span className="sr-only">{net >= 0 ? 'naik ' : 'turun '}</span>
                                    {net >= 0 ? '+' : '−'}
                                    {formatCurrency(Math.abs(net))}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-ob-ink-2">
                        <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="h-2.5 w-3.5 rounded-[3px]" style={{ background: 'var(--ob-bar-now)' }} />
                            Pemasukan
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="ob-hatch h-2.5 w-3.5 rounded-[3px]" />
                            Pengeluaran
                        </span>
                        <span className="ml-auto text-ob-ink-3">
                            {shortDate(cashFlowChart.range.from)} – {shortDate(cashFlowChart.range.to)}
                        </span>
                    </div>

                    {chartError ? (
                        <WidgetError
                            title="Grafik tidak dapat dimuat"
                            description="Angka lain di halaman ini tetap benar."
                            onRetry={() => loadChart(chart)}
                        />
                    ) : chartLoading ? (
                        <CashFlowChartSkeleton />
                    ) : (
                        <CashFlowChart labels={cashFlowChart.labels} income={cashFlowChart.income} expenses={cashFlowChart.expenses} />
                    )}
                </Widget>

                {/* ═══ Periode Arus Kas (kalender rentang) ═══ */}
                <Widget
                    title="Periode Arus Kas"
                    height={470}
                    className="xl:col-span-4"
                    bodyClassName="gap-3"
                    action={
                        rangeActive ? (
                            <StatusPill tone="act">Dipakai grafik</StatusPill>
                        ) : (
                            <span className="inline-flex h-[22px] items-center rounded-full border border-dashed border-ob-line-strong px-2 text-xs font-medium text-ob-ink-3">
                                Tidak dipakai
                            </span>
                        )
                    }
                >
                    <RangeCalendar
                        from={rangeActive ? chart.from : null}
                        to={rangeActive ? chart.to : null}
                        inactive={!rangeActive}
                        onApply={(from, to) => loadChart({ ...chart, period: 'range', from, to })}
                        summary={
                            <span className={cn(chartNet >= 0 ? 'text-ob-ink' : 'text-ob-neg')}>
                                <span className="sr-only">Arus bersih periode grafik </span>
                                {chartNet >= 0 ? '+' : '−'}Rp {compactRupiah(Math.abs(chartNet))}
                            </span>
                        }
                        summaryAction={
                            rangeActive && (
                                <button
                                    type="button"
                                    onClick={() => loadChart({ ...chart, period: 'monthly', from: null, to: null })}
                                    className="shrink-0 rounded-full border border-ob-line px-3 py-1.5 text-xs font-semibold text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                >
                                    Kembali ke Bulanan
                                </button>
                            )
                        }
                    />
                </Widget>

                {/* ═══ Pengeluaran | Pemasukan per kategori ═══ */}
                <Widget
                    title={
                        <span role="group" aria-label="Rincian per kategori" className="flex items-center gap-0.5 rounded-full border border-ob-line bg-ob-rail p-[3px]">
                            {(
                                [
                                    ['expense', 'Pengeluaran'],
                                    ['income', 'Pemasukan'],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={categoryTab === key}
                                    onClick={() => setCategoryTab(key)}
                                    className={cn(PILL_BTN, 'text-[13px]', categoryTab === key ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                                >
                                    {label}
                                </button>
                            ))}
                        </span>
                    }
                    height={320}
                    className="xl:col-span-4"
                    bodyClassName="gap-3.5"
                    action={<span className="text-xs text-ob-ink-3">{period.label}</span>}
                >
                    {categories.length === 0 ? (
                        categoryTab === 'expense' ? (
                            <WidgetEmpty title="Belum ada pengeluaran" description="Pengeluaran bulan ini akan dipecah per kategori begitu ada transaksi debit." />
                        ) : (
                            <WidgetEmpty title="Belum ada pemasukan" description="Pembayaran invoice dan transaksi kredit bulan ini akan dipecah per kategori di sini." />
                        )
                    ) : (
                        <>
                            <div className="flex items-center gap-[18px]">
                                <DonutChart slices={categories} centerLabel={compactRupiah(categoryTotal)} centerSub={`${categories.length} kategori`} />
                                <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0 text-[13px]">
                                    {categories.map((c, i) => (
                                        <li key={c.name} className="grid h-[26px] grid-cols-[8px_minmax(0,1fr)_44px] items-center gap-2.5">
                                            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: ramp[Math.min(i, ramp.length - 1)] }} />
                                            <span className="truncate text-ob-ink-2">{c.name}</span>
                                            <span className="text-right font-semibold text-ob-ink">{categoryTotal ? Math.round((c.value / categoryTotal) * 100) : 0}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {biggest && (
                                <p className="mt-auto text-xs leading-relaxed text-ob-ink-3">
                                    Terbesar: {biggest.name.toLowerCase()}, {formatCurrency(biggest.value)}.{' '}
                                    {categoryTab === 'expense'
                                        ? can('view expense') && (
                                              <Link href="/cash-flow/expenses" className="font-semibold text-ob-ink-2 hover:text-ob-ink">
                                                  Lihat pengeluaran →
                                              </Link>
                                          )
                                        : can('view income') && (
                                              <Link href="/cash-flow/income" className="font-semibold text-ob-ink-2 hover:text-ob-ink">
                                                  Lihat pemasukan →
                                              </Link>
                                          )}
                                </p>
                            )}
                        </>
                    )}
                </Widget>

                {/* ═══ Invoice Belum Dibayar ═══ */}
                <Widget
                    title="Invoice Belum Dibayar"
                    count={stats.pending_invoices_count > 0 ? `${stats.pending_invoices_count} invoice · ${formatCurrency(stats.pending_invoices_amount)}` : undefined}
                    height={320}
                    className="md:col-span-2 xl:col-span-8"
                    action={
                        can('view invoices') && (
                            <WidgetLink href="/invoices">
                                {pendingInvoices.length} dari {stats.pending_invoices_count} · Lihat semua <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                            </WidgetLink>
                        )
                    }
                >
                    {pendingInvoices.length === 0 ? (
                        <WidgetEmpty title="Semua invoice sudah dibayar" description="Invoice yang terkirim dan belum lunas akan muncul di sini, yang lewat tempo paling atas." />
                    ) : (
                        <ul className="m-0 flex list-none flex-col p-0">
                            {pendingInvoices.map((inv, i) => {
                                const due = dueText(inv.days_until_due);
                                return (
                                    <li key={inv.id} className={cn(i < pendingInvoices.length - 1 && 'border-b border-ob-line-soft')}>
                                        <a
                                            href={resourceHref('invoice', inv.id)}
                                            className="grid h-[46px] grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 text-[13px] text-ob-ink hover:bg-ob-inner/60 lg:grid-cols-[88px_112px_minmax(0,1fr)_minmax(0,190px)_140px] rounded-lg -mx-1 px-1"
                                        >
                                            <span className="flex flex-col leading-[1.3]">
                                                <span className={cn('font-semibold', inv.status === 'overdue' && 'text-ob-late')}>{shortDate(inv.due_date)}</span>
                                                <span className={cn('text-xs', due.tone)}>{due.text}</span>
                                            </span>
                                            <span className="hidden lg:block">
                                                <InvoiceStatus status={inv.status} />
                                            </span>
                                            <span className="flex min-w-0 items-center gap-2">
                                                <span className="truncate font-semibold">{inv.client}</span>
                                                <span className="lg:hidden">
                                                    <InvoiceStatus status={inv.status} />
                                                </span>
                                            </span>
                                            <span className="hidden truncate font-mono text-xs text-ob-ink-2 lg:block">{inv.invoice_number ?? '—'}</span>
                                            <span className="flex flex-col items-end leading-[1.3]">
                                                <span className="font-semibold">{formatCurrency(inv.remaining)}</span>
                                                {inv.paid > 0 && <span className="text-xs text-ob-ink-3">sisa dari {formatCurrency(inv.total_amount)}</span>}
                                            </span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Widget>

                {/* ═══ Rekening ═══ */}
                <Widget
                    title="Rekening"
                    count={bankAccounts.length > 3 ? `3 dari ${bankAccounts.length}` : undefined}
                    height={300}
                    className="xl:col-span-5"
                    bodyClassName="gap-2"
                    action={can('view bank-accounts') && <WidgetLink href="/bank-accounts">Semua rekening →</WidgetLink>}
                >
                    {bankAccounts.length === 0 ? (
                        <WidgetEmpty
                            title="Belum ada rekening"
                            description="Saldo kas dihitung dari rekening. Tambahkan rekening pertama untuk mulai mencatat transaksi."
                            action={
                                can('create bank-accounts') && (
                                    <Link href="/bank-accounts" className="mt-1 inline-flex h-8 items-center rounded-xl border border-ob-line bg-ob-inner px-3.5 text-xs font-semibold text-ob-ink hover:bg-ob-hover">
                                        + Tambah rekening
                                    </Link>
                                )
                            }
                        />
                    ) : (
                        <ScrollList label={`Daftar rekening, ${bankAccounts.length} item, dapat digulir`} height={210} className="gap-3">
                            {bankAccounts.map((acc) => (
                                <li key={acc.id} className="shrink-0">
                                    <Link
                                        href="/bank-accounts"
                                        className="flex h-[62px] items-center gap-3 rounded-2xl border border-ob-line-soft bg-ob-inner px-3.5 text-ob-ink transition-colors hover:bg-ob-hover"
                                    >
                                        <span aria-hidden="true" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-ob-chip text-xs font-bold text-ob-ink-2">
                                            {bankAbbrev(acc.bank)}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                                            <span className="truncate text-[13px] font-semibold">{acc.name}</span>
                                            <span className="truncate text-xs text-ob-ink-3">{acc.bank} · {acc.account_number}</span>
                                        </span>
                                        <span className={cn('shrink-0 text-sm font-semibold', acc.balance <= 0 && 'text-ob-ink-2')}>{formatCurrency(acc.balance)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ScrollList>
                    )}
                </Widget>

                {/* ═══ Transaksi Terbaru ═══ */}
                <Widget
                    title="Transaksi Terbaru"
                    count={recentTransactions.length > 4 ? `4 dari ${recentTransactions.length}` : undefined}
                    height={300}
                    className="xl:col-span-7"
                    bodyClassName="gap-2"
                    action={can('view income') && <WidgetLink href="/cash-flow/income">Lihat arus kas →</WidgetLink>}
                >
                    {recentTransactions.length === 0 ? (
                        <WidgetEmpty title="Belum ada transaksi" description="Pemasukan, pengeluaran, dan pembayaran invoice terbaru akan tampil di sini." />
                    ) : (
                        <ScrollList label={`Transaksi terbaru, ${recentTransactions.length} item, dapat digulir`} height={216}>
                            {recentTransactions.map((tx, i) => {
                                const inc = tx.type === 'income';
                                return (
                                    <li
                                        key={i}
                                        className={cn(
                                            'grid h-[54px] shrink-0 grid-cols-[26px_52px_minmax(0,1fr)_auto] items-center gap-3',
                                            i < recentTransactions.length - 1 && 'border-b border-ob-line-soft',
                                        )}
                                    >
                                        <span aria-hidden="true" className={cn('flex h-[26px] w-[26px] items-center justify-center rounded-lg', inc ? 'bg-ob-pos/15 text-ob-pos' : 'bg-ob-neg/15 text-ob-neg')}>
                                            {inc ? <ArrowUpRight className="h-3 w-3" strokeWidth={3} /> : <ArrowDownLeft className="h-3 w-3" strokeWidth={3} />}
                                        </span>
                                        <span className="text-xs text-ob-ink-3">{shortDate(tx.date)}</span>
                                        <span className="flex min-w-0 flex-col leading-[1.3]">
                                            <span className="truncate text-[13px] text-ob-ink">{tx.description}</span>
                                            <span className="truncate text-xs text-ob-ink-3">{tx.account}</span>
                                        </span>
                                        <span className={cn('text-right text-[13px] font-semibold', inc ? 'text-ob-pos' : 'text-ob-neg')}>
                                            <span className="sr-only">{inc ? 'masuk ' : 'keluar '}</span>
                                            {inc ? '+' : '−'}
                                            {formatCurrency(tx.amount)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ScrollList>
                    )}
                </Widget>
            </div>

            {/* Sepanjang waktu */}
            <section aria-labelledby="h-all" className="flex flex-wrap items-center gap-x-7 gap-y-2 rounded-3xl border border-ob-line-soft bg-ob-card px-[22px] py-4 xl:h-[60px] xl:flex-nowrap xl:py-0">
                <h2 id="h-all" className="whitespace-nowrap text-[13px] font-semibold text-ob-ink-2">
                    Sepanjang waktu
                </h2>
                <dl className="m-0 flex flex-1 flex-wrap items-center gap-x-7 gap-y-2 text-[13px]">
                    <div className="flex items-baseline gap-2">
                        <dt className="text-ob-ink-3">Pendapatan</dt>
                        <dd className="m-0 font-semibold text-ob-ink">{formatCurrency(financialOverview.total_income)}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <dt className="text-ob-ink-3">HPP</dt>
                        <dd className="m-0 font-semibold text-ob-ink">{formatCurrency(financialOverview.total_hpp)}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <dt className="text-ob-ink-3">Laba kotor</dt>
                        <dd className={cn('m-0 font-semibold', financialOverview.total_profit >= 0 ? 'text-ob-pos' : 'text-ob-late')}>
                            {financialOverview.total_profit < 0 && '−'}
                            {formatCurrency(Math.abs(financialOverview.total_profit))}
                        </dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <dt className="text-ob-ink-3">Est. PPh final 0,5%</dt>
                        <dd className="m-0 font-semibold text-ob-ink">{formatCurrency(financialOverview.total_pp)}</dd>
                    </div>
                </dl>
                {can('view profit-loss') && (
                    <WidgetLink href="/reports/profit-loss" className="whitespace-nowrap">
                        Laporan Laba Rugi <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                    </WidgetLink>
                )}
            </section>
        </div>
    );
}

Dashboard.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
