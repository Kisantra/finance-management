import { Link, usePage } from '@inertiajs/react';
import {
    ArrowDownRight,
    ArrowUpRight,
    BadgeDollarSign,
    Banknote,
    Building2,
    ChevronRight,
    CircleDollarSign,
    FileText,
    Landmark,
    ReceiptText,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import * as React from 'react';
import ReactApexChart from 'react-apexcharts';
import { AppLayout } from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { companyUrl } from '@/lib/company';
import { formatCurrency } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────────── interfaces ─── */

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

interface ChartPoint {
    label: string;
    income: number;
    expenses: number;
}

interface CategoryExpense {
    name: string;
    value: number;
    color: string;
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
    invoice_number: string;
    client: string;
    amount: number;
    due_date: string;
    status: string;
    days_until_due: number;
}

interface RecentTransaction {
    date: string;
    description: string;
    type: 'income' | 'expense';
    amount: number;
    account: string;
}

interface RecentReimbursement {
    id: number;
    title: string;
    amount: number;
    status: string;
    user: string;
    date: string;
}

interface RecentFundRequest {
    id: number;
    number: string;
    title: string;
    amount: number;
    status: string;
    priority: string;
    user: string;
    date: string;
}

interface DashboardProps extends SharedProps {
    financialOverview: FinancialOverview;
    stats: Stats;
    cashFlowChart: ChartPoint[];
    expensesByCategory: CategoryExpense[];
    bankAccounts: BankAccount[];
    pendingInvoices: PendingInvoice[];
    recentTransactions: RecentTransaction[];
    recentReimbursements: RecentReimbursement[];
    recentFundRequests: RecentFundRequest[];
}

/* ─────────────────────────────────── sub-components ─── */

function InvoiceStatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; variant: 'yellow' | 'red' | 'blue' }> = {
        sent: { label: 'Terkirim', variant: 'blue' },
        partially_paid: { label: 'Sebagian', variant: 'yellow' },
        overdue: { label: 'Jatuh Tempo', variant: 'red' },
    };
    const cfg = map[status] ?? { label: status, variant: 'blue' };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function ReimbStatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; variant: 'default' | 'yellow' | 'green' | 'blue' | 'red' }> = {
        draft: { label: 'Draft', variant: 'default' },
        pending: { label: 'Menunggu', variant: 'yellow' },
        approved: { label: 'Disetujui', variant: 'blue' },
        paid: { label: 'Dibayar', variant: 'green' },
        rejected: { label: 'Ditolak', variant: 'red' },
    };
    const cfg = map[status] ?? { label: status, variant: 'default' };
    return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
}

function FundStatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; variant: 'default' | 'yellow' | 'green' | 'blue' | 'red' }> = {
        draft: { label: 'Draft', variant: 'default' },
        pending: { label: 'Menunggu', variant: 'yellow' },
        approved: { label: 'Disetujui', variant: 'blue' },
        disbursed: { label: 'Dicairkan', variant: 'green' },
        rejected: { label: 'Ditolak', variant: 'red' },
    };
    const cfg = map[status] ?? { label: status, variant: 'default' };
    return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
    const map: Record<string, { label: string; variant: 'default' | 'yellow' | 'red' | 'blue' }> = {
        low: { label: 'Rendah', variant: 'default' },
        medium: { label: 'Sedang', variant: 'blue' },
        high: { label: 'Tinggi', variant: 'yellow' },
        urgent: { label: 'Mendesak', variant: 'red' },
    };
    const cfg = map[priority] ?? { label: priority, variant: 'default' };
    return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
}

interface FeaturedMetricCardProps {
    label: string;
    sublabel: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
    iconBg: string;
    iconColor: string;
}

function FeaturedMetricCard({ label, sublabel, value, icon, accent, iconBg, iconColor }: FeaturedMetricCardProps) {
    return (
        <div className={`relative overflow-hidden rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 p-5 hover:shadow-lg transition-shadow`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent} rounded-l-xl`} />
            <div className="flex items-start gap-4 pl-3">
                <div className={`h-12 w-12 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                    <div className={iconColor}>{icon}</div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-dark-600 dark:text-dark-400">{label}</p>
                    <p className="text-xs text-dark-400 dark:text-dark-500 mb-1">{sublabel}</p>
                    <p className="text-2xl font-bold text-dark-900 dark:text-dark-50 truncate">
                        {formatCurrency(value)}
                    </p>
                </div>
            </div>
        </div>
    );
}

interface CompactMetricCardProps {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    valueColor?: string;
}

function CompactMetricCard({ label, value, icon, iconBg, iconColor, valueColor }: CompactMetricCardProps) {
    return (
        <div className="flex items-center gap-4 rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 p-4 hover:shadow-lg transition-shadow">
            <div className={`h-11 w-11 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                <div className={iconColor}>{icon}</div>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-dark-500 dark:text-dark-400 mb-0.5">{label}</p>
                <p className={`text-lg font-bold truncate ${valueColor ?? 'text-dark-900 dark:text-dark-50'}`}>
                    {typeof value === 'string' && isNaN(Number(value)) ? value : formatCurrency(value as number)}
                </p>
            </div>
        </div>
    );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
    return (
        <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {href && (
                <Link
                    href={href}
                    className="flex items-center gap-0.5 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                    Lihat semua <ChevronRight className="w-3 h-3" />
                </Link>
            )}
        </div>
    );
}

/* ──────────────────────────────────── main page ─── */

export default function Dashboard() {
    const {
        financialOverview,
        stats,
        cashFlowChart,
        expensesByCategory,
        bankAccounts,
        pendingInvoices,
        recentTransactions,
        recentReimbursements,
        recentFundRequests,
    } = usePage<DashboardProps>().props;

    const isDark =
        typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

    const chartTextColor = isDark ? '#a1a1aa' : '#6b7280';
    const chartGridColor = isDark ? '#3f3f46' : '#f3f4f6';

    const cashFlowOptions: ApexCharts.ApexOptions = {
        chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
        plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        xaxis: {
            categories: cashFlowChart.map((d) => d.label),
            labels: { style: { colors: chartTextColor, fontSize: '12px' } },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            labels: {
                style: { colors: chartTextColor, fontSize: '11px' },
                formatter: (v) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
                    return String(v);
                },
            },
        },
        grid: { borderColor: chartGridColor, strokeDashArray: 4 },
        colors: ['#2563eb', '#ef4444'],
        legend: { labels: { colors: chartTextColor }, fontSize: '12px' },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            y: { formatter: (v) => formatCurrency(v) },
        },
    };

    const cashFlowSeries = [
        { name: 'Pemasukan', data: cashFlowChart.map((d) => d.income) },
        { name: 'Pengeluaran', data: cashFlowChart.map((d) => d.expenses) },
    ];

    const donutOptions: ApexCharts.ApexOptions = {
        chart: { type: 'donut', background: 'transparent' },
        labels: expensesByCategory.map((d) => d.name),
        colors: expensesByCategory.map((d) => d.color),
        dataLabels: { enabled: false },
        legend: {
            position: 'bottom',
            labels: { colors: chartTextColor },
            fontSize: '12px',
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            y: { formatter: (v) => formatCurrency(v) },
        },
        plotOptions: {
            pie: { donut: { size: '65%', labels: { show: false } } },
        },
    };

    const donutSeries = expensesByCategory.map((d) => d.value);

    const net = stats.net_this_month;
    const netPositive = net >= 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <PageHeader title="Dashboard" description="Ringkasan keuangan bisnis" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 shrink-0 self-start sm:self-auto">
                    <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        Total Saldo: {formatCurrency(financialOverview.total_balance)}
                    </span>
                </div>
            </div>

            {/* Financial Overview — 2 featured + 3 compact */}
            <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FeaturedMetricCard
                        label="Total Pemasukan"
                        sublabel="Akumulasi semua pembayaran diterima"
                        value={financialOverview.total_income}
                        icon={<TrendingUp className="w-6 h-6" />}
                        accent="bg-green-500"
                        iconBg="bg-green-50 dark:bg-green-900/20"
                        iconColor="text-green-600 dark:text-green-400"
                    />
                    <FeaturedMetricCard
                        label="Total Profit"
                        sublabel="Setelah dikurangi HPP / billing klien"
                        value={financialOverview.total_profit}
                        icon={<CircleDollarSign className="w-6 h-6" />}
                        accent={financialOverview.total_profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
                        iconBg={financialOverview.total_profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}
                        iconColor={financialOverview.total_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <CompactMetricCard
                        label="Sisa Outstanding"
                        value={financialOverview.total_outstanding}
                        icon={<ReceiptText className="w-5 h-5" />}
                        iconBg="bg-red-50 dark:bg-red-900/20"
                        iconColor="text-red-600 dark:text-red-400"
                        valueColor="text-red-600 dark:text-red-400"
                    />
                    <CompactMetricCard
                        label="Total HPP / Billing Klien"
                        value={financialOverview.total_hpp}
                        icon={<Banknote className="w-5 h-5" />}
                        iconBg="bg-purple-50 dark:bg-purple-900/20"
                        iconColor="text-purple-600 dark:text-purple-400"
                    />
                    <CompactMetricCard
                        label="Total PP 0,5%"
                        value={financialOverview.total_pp}
                        icon={<BadgeDollarSign className="w-5 h-5" />}
                        iconBg="bg-orange-50 dark:bg-orange-900/20"
                        iconColor="text-orange-600 dark:text-orange-400"
                    />
                </div>
            </div>

            {/* Monthly stats + net */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary-50 dark:bg-dark-600/40 border border-secondary-100 dark:border-dark-600/60">
                    <div className="h-9 w-9 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
                        <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-xs text-dark-500 dark:text-dark-400">Pemasukan Bln Ini</p>
                        <p className="text-sm font-semibold text-dark-900 dark:text-dark-50">
                            {formatCurrency(stats.income_this_month)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary-50 dark:bg-dark-600/40 border border-secondary-100 dark:border-dark-600/60">
                    <div className="h-9 w-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                        <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <p className="text-xs text-dark-500 dark:text-dark-400">Pengeluaran Bln Ini</p>
                        <p className="text-sm font-semibold text-dark-900 dark:text-dark-50">
                            {formatCurrency(stats.expenses_this_month)}
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                    netPositive
                        ? 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                        : 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
                }`}>
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        netPositive ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                    }`}>
                        {netPositive
                            ? <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                            : <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                        }
                    </div>
                    <div>
                        <p className="text-xs text-dark-500 dark:text-dark-400">Net Bln Ini</p>
                        <p className={`text-sm font-semibold ${
                            netPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                            {netPositive ? '+' : '-'}{formatCurrency(Math.abs(net))}
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Arus Kas — 6 Bulan Terakhir</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {cashFlowChart.length > 0 ? (
                            <ReactApexChart
                                type="bar"
                                options={cashFlowOptions}
                                series={cashFlowSeries}
                                height={240}
                            />
                        ) : (
                            <div className="h-60 flex items-center justify-center text-sm text-dark-400 dark:text-dark-500">
                                Belum ada data transaksi
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Pengeluaran per Kategori</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {donutSeries.length > 0 ? (
                            <ReactApexChart
                                type="donut"
                                options={donutOptions}
                                series={donutSeries}
                                height={240}
                            />
                        ) : (
                            <div className="h-60 flex items-center justify-center text-sm text-dark-400 dark:text-dark-500">
                                Belum ada data pengeluaran
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 4-column quick lists */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Bank Accounts */}
                <Card>
                    <CardHeader>
                        <SectionHeader title="Rekening Bank" />
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {bankAccounts.length === 0 && (
                            <p className="text-sm text-dark-400 dark:text-dark-500 text-center py-4">Belum ada rekening</p>
                        )}
                        {bankAccounts.map((acc) => (
                            <div key={acc.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary-50 dark:bg-dark-600/40">
                                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                    <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-dark-900 dark:text-dark-50 truncate">{acc.name}</p>
                                    <p className="text-[10px] text-dark-500 dark:text-dark-400">{acc.bank}</p>
                                </div>
                                <p className="text-xs font-semibold text-dark-900 dark:text-dark-50 shrink-0">
                                    {formatCurrency(acc.balance)}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Recent Reimbursements */}
                <Card>
                    <CardHeader>
                        <SectionHeader title="Reimburse Terbaru" href={companyUrl('/reimbursements')} />
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {recentReimbursements.length === 0 && (
                            <p className="text-sm text-dark-400 dark:text-dark-500 text-center py-4">Belum ada pengajuan</p>
                        )}
                        {recentReimbursements.map((r) => (
                            <div key={r.id} className="space-y-1 p-2.5 rounded-xl bg-secondary-50 dark:bg-dark-600/40">
                                <div className="flex items-start justify-between gap-1">
                                    <p className="text-xs font-medium text-dark-900 dark:text-dark-50 truncate leading-snug flex-1">
                                        {r.title}
                                    </p>
                                    <ReimbStatusBadge status={r.status} />
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                    <p className="text-[10px] text-dark-500 dark:text-dark-400 truncate">{r.user} · {r.date}</p>
                                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 shrink-0">
                                        {formatCurrency(r.amount)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Recent Fund Requests */}
                <Card>
                    <CardHeader>
                        <SectionHeader title="Pengajuan Dana" href={companyUrl('/fund-requests')} />
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {recentFundRequests.length === 0 && (
                            <p className="text-sm text-dark-400 dark:text-dark-500 text-center py-4">Belum ada pengajuan</p>
                        )}
                        {recentFundRequests.map((r) => (
                            <div key={r.id} className="space-y-1 p-2.5 rounded-xl bg-secondary-50 dark:bg-dark-600/40">
                                <div className="flex items-start justify-between gap-1">
                                    <p className="text-xs font-medium text-dark-900 dark:text-dark-50 truncate leading-snug flex-1">
                                        {r.title}
                                    </p>
                                    <FundStatusBadge status={r.status} />
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                    <PriorityBadge priority={r.priority} />
                                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 shrink-0">
                                        {formatCurrency(r.amount)}
                                    </p>
                                </div>
                                <p className="text-[10px] text-dark-500 dark:text-dark-400 truncate">{r.user} · {r.date}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Pending Invoices */}
                <Card>
                    <CardHeader>
                        <SectionHeader title="Invoice Tertunda" href={companyUrl('/invoices')} />
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {pendingInvoices.length === 0 && (
                            <p className="text-sm text-dark-400 dark:text-dark-500 text-center py-4">Tidak ada invoice tertunda</p>
                        )}
                        {pendingInvoices.map((inv) => (
                            <div key={inv.id} className="space-y-1 p-2.5 rounded-xl bg-secondary-50 dark:bg-dark-600/40">
                                <div className="flex items-center justify-between gap-1">
                                    <p className="text-xs font-medium text-dark-900 dark:text-dark-50 truncate">
                                        {inv.invoice_number}
                                    </p>
                                    <InvoiceStatusBadge status={inv.status} />
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                    <p className="text-[10px] text-dark-500 dark:text-dark-400 truncate">{inv.client}</p>
                                    <p className="text-xs font-semibold text-dark-700 dark:text-dark-300 shrink-0">
                                        {formatCurrency(inv.amount)}
                                    </p>
                                </div>
                                {inv.days_until_due < 0 && (
                                    <p className="text-[10px] text-red-500 dark:text-red-400">
                                        Terlambat {Math.abs(inv.days_until_due)} hari
                                    </p>
                                )}
                                {inv.days_until_due >= 0 && inv.days_until_due <= 7 && (
                                    <p className="text-[10px] text-yellow-600 dark:text-yellow-400">
                                        Jatuh tempo {inv.days_until_due} hari lagi
                                    </p>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Transaksi Terbaru</CardTitle>
                </CardHeader>
                <CardContent>
                    {recentTransactions.length === 0 && (
                        <p className="text-sm text-dark-400 dark:text-dark-500 text-center py-6">Belum ada transaksi</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {recentTransactions.map((tx, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary-50 dark:bg-dark-600/40">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    tx.type === 'income' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                                }`}>
                                    {tx.type === 'income'
                                        ? <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        : <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-dark-800 dark:text-dark-200 truncate">{tx.description}</p>
                                    <p className="text-[10px] text-dark-400 dark:text-dark-500">{tx.date} · {tx.account}</p>
                                </div>
                                <p className={`text-xs font-semibold shrink-0 ${
                                    tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

Dashboard.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
