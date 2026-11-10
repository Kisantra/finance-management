import { ArrowDownLeft, ArrowUpRight, BarChart3, MinusCircle, PieChart, PlusCircle, X } from 'lucide-react';
import * as React from 'react';
import ReactApexChart from 'react-apexcharts';
import { DatePicker } from '@/components/ui/date-picker';
import { cn, formatCurrency } from '@/lib/utils';
import type { AccountDetail } from '../types';
import { t } from '@/i18n';

interface Props {
    detail: AccountDetail;
    selectedMonth: string;
    onMonthChange: (month: string) => void;
}

const DONUT_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#6366f1'];

function formatCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(0)}jt`;
    if (Math.abs(value) >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
    return formatCurrency(value);
}

function useIsDark() {
    const [isDark, setIsDark] = React.useState(
        () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
    );
    React.useEffect(() => {
        if (typeof document === 'undefined') return;
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return isDark;
}

export function AccountCharts({ detail, selectedMonth, onMonthChange }: Props) {
    const isDark = useIsDark();
    const { period, stats, chart_months, category_breakdown } = detail;
    const net = stats.net_cashflow;
    const totalExpense = category_breakdown.reduce((sum, c) => sum + c.total, 0);

    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const axisColor = isDark ? '#71717a' : '#71717a';

    /* ── Bar chart options ─────────────────────────── */
    const barOptions = React.useMemo(
        () => ({
            chart: {
                toolbar: { show: false },
                background: 'transparent',
                fontFamily: 'Inter, sans-serif',
                animations: { enabled: true, speed: 350 },
            },
            xaxis: {
                categories: chart_months.map((m) => m.month),
                labels: { style: { colors: axisColor, fontSize: '10px' } },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                labels: {
                    formatter: (v: number) => formatCompact(v),
                    style: { colors: axisColor, fontSize: '10px' },
                },
            },
            colors: ['#22c55e', '#ef4444'],
            plotOptions: {
                bar: { borderRadius: 6, columnWidth: '52%', borderRadiusApplication: 'end' as const },
            },
            dataLabels: { enabled: false },
            grid: { borderColor: gridColor, strokeDashArray: 4, padding: { left: 0, right: 0 } },
            legend: { show: false },
            tooltip: {
                theme: isDark ? 'dark' : 'light',
                y: { formatter: (v: number) => formatCurrency(v) },
            },
            states: { hover: { filter: { type: 'darken', value: 0.95 } } },
        }),
        [chart_months, axisColor, gridColor, isDark],
    );

    const barSeries = [
        { name: t('Pemasukan'), data: chart_months.map((m) => m.income) },
        { name: t('Pengeluaran'), data: chart_months.map((m) => m.expense) },
    ];

    /* ── Donut chart options ───────────────────────── */
    const donutOptions = React.useMemo(
        () => ({
            chart: {
                background: 'transparent',
                fontFamily: 'Inter, sans-serif',
                animations: { speed: 400 },
            },
            labels: category_breakdown.map((c) => c.name),
            colors: DONUT_COLORS.slice(0, category_breakdown.length || 1),
            stroke: { width: 2, colors: [isDark ? '#1a1a1d' : '#ffffff'] },
            legend: { show: false },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '70%',
                        labels: {
                            show: true,
                            name: { show: true, color: axisColor, fontSize: '11px', offsetY: 8 },
                            value: {
                                show: true,
                                formatter: (v: string) => formatCompact(Number(v)),
                                color: isDark ? '#f4f4f5' : '#111827',
                                fontSize: '16px',
                                fontWeight: 700,
                                offsetY: -8,
                            },
                            total: {
                                show: true,
                                label: t('Total'),
                                color: axisColor,
                                fontSize: '10px',
                                formatter: () => formatCompact(totalExpense),
                            },
                        },
                    },
                },
            },
            tooltip: {
                theme: isDark ? 'dark' : 'light',
                y: { formatter: (v: number) => formatCurrency(v) },
            },
        }),
        [category_breakdown, isDark, axisColor, totalExpense],
    );

    return (
        <div className="space-y-4">
            {/* Period header + filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                    <span className="inline-block w-1 h-4 rounded-full bg-primary-500" />
                    <span className="font-medium">
                        {period.is_all_time ? t('Semua Waktu') : t('Periode: {{label}}', { label: period.label })}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-44">
                        <DatePicker
                            mode="month"
                            value={selectedMonth || null}
                            onChange={(v) => onMonthChange(v ?? '')}
                            placeholder={t('Semua bulan')}
                            clearable
                        />
                    </div>
                    {selectedMonth && (
                        <button
                            onClick={() => onMonthChange('')}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 hover:bg-secondary-100 dark:hover:bg-dark-600 transition-colors"
                            title={t('Kembali ke semua waktu')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Stat cards (3) */}
            <div className="grid grid-cols-3 gap-3">
                <StatPill
                    icon={<ArrowDownLeft className="w-4 h-4" />}
                    label={t('Pemasukan')}
                    value={stats.total_income}
                    tone="green"
                />
                <StatPill
                    icon={<ArrowUpRight className="w-4 h-4" />}
                    label={t('Pengeluaran')}
                    value={stats.total_expense}
                    tone="red"
                />
                <StatPill
                    icon={net >= 0 ? <PlusCircle className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
                    label={t('Arus Bersih')}
                    value={net}
                    tone={net >= 0 ? 'blue' : 'orange'}
                    prefix={net >= 0 ? '+' : ''}
                />
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Bar chart */}
                <div className="lg:col-span-3 bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 p-4 lg:p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50">
                                    {t('Pemasukan vs Pengeluaran')}
                                </h3>
                                <p className="text-xs text-dark-500 dark:text-dark-400">{t('12 bulan terakhir')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                                <span className="text-dark-500 dark:text-dark-400">{t('Masuk', { context: 'arah' })}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                                <span className="text-dark-500 dark:text-dark-400">{t('Keluar', { context: 'arah' })}</span>
                            </span>
                        </div>
                    </div>
                    <ReactApexChart type="bar" height={260} options={barOptions} series={barSeries} />
                </div>

                {/* Donut chart */}
                <div className="lg:col-span-2 bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 p-4 lg:p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-9 w-9 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center shrink-0">
                            <PieChart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50">
                                {t('Rincian per Kategori')}
                            </h3>
                            <p className="text-xs text-dark-500 dark:text-dark-400">
                                {period.is_all_time ? t('Pengeluaran semua waktu') : t('Pengeluaran {{label}}', { label: period.label })}
                            </p>
                        </div>
                    </div>

                    {category_breakdown.length > 0 ? (
                        <>
                            <ReactApexChart
                                type="donut"
                                height={170}
                                options={donutOptions}
                                series={category_breakdown.map((c) => c.total)}
                            />
                            <div className="space-y-1.5 mt-3">
                                {category_breakdown.map((cat, i) => {
                                    const pct = totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0;
                                    return (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: DONUT_COLORS[i] ?? '#9ca3af' }}
                                                />
                                                <span className="text-dark-600 dark:text-dark-400 truncate">
                                                    {cat.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="font-medium text-dark-900 dark:text-dark-50 tabular-nums">
                                                    {formatCurrency(cat.total)}
                                                </span>
                                                <span className="text-dark-400 dark:text-dark-500 w-8 text-right tabular-nums">
                                                    {pct}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-center">
                            <div>
                                <div className="w-12 h-12 bg-secondary-100 dark:bg-dark-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <PieChart className="w-6 h-6 text-dark-400 dark:text-dark-500" />
                                </div>
                                <p className="text-sm text-dark-500 dark:text-dark-400">
                                    {t('Belum ada data kategori')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Stat pill ───────────────────────────────────────────── */

interface StatPillProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    tone: 'green' | 'red' | 'blue' | 'orange';
    prefix?: string;
}

function StatPill({ icon, label, value, tone, prefix }: StatPillProps) {
    const toneMap = {
        green: {
            bg: 'bg-green-50 dark:bg-green-900/20',
            border: 'border-green-100 dark:border-green-900/30',
            iconBg: 'bg-green-100 dark:bg-green-900/40',
            iconText: 'text-green-600 dark:text-green-400',
            label: 'text-green-600 dark:text-green-400',
            value: 'text-green-700 dark:text-green-300',
        },
        red: {
            bg: 'bg-red-50 dark:bg-red-900/20',
            border: 'border-red-100 dark:border-red-900/30',
            iconBg: 'bg-red-100 dark:bg-red-900/40',
            iconText: 'text-red-600 dark:text-red-400',
            label: 'text-red-600 dark:text-red-400',
            value: 'text-red-700 dark:text-red-300',
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            border: 'border-blue-100 dark:border-blue-900/30',
            iconBg: 'bg-blue-100 dark:bg-blue-900/40',
            iconText: 'text-blue-600 dark:text-blue-400',
            label: 'text-blue-600 dark:text-blue-400',
            value: 'text-blue-700 dark:text-blue-300',
        },
        orange: {
            bg: 'bg-orange-50 dark:bg-orange-900/20',
            border: 'border-orange-100 dark:border-orange-900/30',
            iconBg: 'bg-orange-100 dark:bg-orange-900/40',
            iconText: 'text-orange-600 dark:text-orange-400',
            label: 'text-orange-600 dark:text-orange-400',
            value: 'text-orange-700 dark:text-orange-300',
        },
    };
    const tones = toneMap[tone];

    return (
        <div className={cn('flex items-center gap-3 p-3 rounded-xl border', tones.bg, tones.border)}>
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', tones.iconBg, tones.iconText)}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className={cn('text-xs font-medium truncate', tones.label)}>{label}</p>
                <p className={cn('text-sm font-bold truncate tabular-nums', tones.value)}>
                    {prefix}{formatCurrency(value)}
                </p>
            </div>
        </div>
    );
}
