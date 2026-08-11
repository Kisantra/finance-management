import { Head, router, usePage } from '@inertiajs/react';
import { endOfMonth, endOfYear, format as formatDateFns, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CheckCircle2, Download, FileBarChart, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ──────────────────────────────────────────────────────────────── types ── */

interface CategoryRow {
    category_id: number | null;
    category_label: string;
    amount: number;
}

interface GroupBlock {
    by_category: CategoryRow[];
    total: number;
}

interface Report {
    period: { start: string; end: string };
    revenue: { invoice: number; non_invoice: number; non_invoice_by_category: CategoryRow[]; total: number };
    cogs: { invoice: number; manual: number; manual_by_category: CategoryRow[]; total: number };
    gross_profit: number;
    opex: GroupBlock;
    operating_profit: number;
    other_income: GroupBlock;
    other_expense: GroupBlock;
    pre_tax_profit: number;
    tax: GroupBlock;
    net_profit: number;
    unclassified: { income: GroupBlock; expense: GroupBlock };
}

interface Props extends SharedProps {
    report: Report;
    unclassifiedTypes: Record<string, 'income' | 'expense'>;
    filters: { start_date: string; end_date: string };
    company: { name: string; address: string | null; npwp: string | null } | null;
}

const PL_GROUP_OPTIONS: Record<'income' | 'expense', { value: string; label: string }[]> = {
    income: [
        { value: 'revenue', label: 'Pendapatan Usaha' },
        { value: 'other_income', label: 'Pendapatan Lain' },
    ],
    expense: [
        { value: 'cogs', label: 'Harga Pokok (HPP)' },
        { value: 'opex', label: 'Beban Operasional' },
        { value: 'other_expense', label: 'Beban Lain' },
        { value: 'tax', label: 'Pajak Perusahaan' },
    ],
};

/* ─────────────────────────────────────────────────────────────── helpers ── */

function fmtPeriod(start: string, end: string): string {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return `${formatDateFns(s, 'd MMMM yyyy', { locale: idLocale })} — ${formatDateFns(e, 'd MMMM yyyy', { locale: idLocale })}`;
}

type PresetKey = 'this_month' | 'last_month' | 'ytd' | 'last_year';

function presetRange(key: PresetKey): { start: Date; end: Date } {
    const today = new Date();
    switch (key) {
        case 'this_month': return { start: startOfMonth(today), end: today };
        case 'last_month': {
            const lm = subMonths(today, 1);
            return { start: startOfMonth(lm), end: endOfMonth(lm) };
        }
        case 'ytd': return { start: startOfYear(today), end: today };
        case 'last_year': {
            const ly = subYears(today, 1);
            return { start: startOfYear(ly), end: endOfYear(ly) };
        }
    }
}

function detectPreset(start: string, end: string): PresetKey | null {
    const today = formatDateFns(new Date(), 'yyyy-MM-dd');
    const presets: PresetKey[] = ['this_month', 'last_month', 'ytd', 'last_year'];
    for (const key of presets) {
        const r = presetRange(key);
        const ps = formatDateFns(r.start, 'yyyy-MM-dd');
        const pe = (key === 'this_month' || key === 'ytd') ? today : formatDateFns(r.end, 'yyyy-MM-dd');
        if (ps === start && pe === end) return key;
    }
    return null;
}

/* ─────────────────────────────────────────────────────── document primitives ── */

interface DocRowProps {
    label: string;
    amount: number;
    indent?: boolean;
    weight?: 'normal' | 'medium' | 'bold';
    rule?: 'none' | 'top' | 'top-double';
    muted?: boolean;
    parens?: boolean;
}

function DocRow({ label, amount, indent = false, weight = 'normal', rule = 'none', muted = false, parens = false }: DocRowProps) {
    const isLoss = amount < 0;
    return (
        <div
            className={cn(
                'flex justify-between items-baseline gap-6',
                rule === 'none' && 'py-1',
                rule === 'top' && 'border-t border-zinc-300 pt-2 mt-1 py-1',
                rule === 'top-double' && 'border-t-2 border-zinc-900 pt-3 mt-3 pb-3 mb-1 border-b-[3px] border-double border-b-zinc-900',
                weight === 'medium' && 'font-medium',
                weight === 'bold' && 'font-bold uppercase tracking-wider text-zinc-900',
                muted && 'text-zinc-400 italic',
            )}
        >
            <span className={cn(indent && 'pl-5', !muted && 'text-zinc-700', weight === 'bold' && 'text-zinc-900')}>{label}</span>
            <span className={cn('tabular-nums shrink-0', isLoss && 'text-red-700')}>
                {parens ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
            </span>
        </div>
    );
}

function DocSectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="mt-7 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 border-b border-zinc-200 pb-1.5">
            {children}
        </h3>
    );
}

/* ────────────────────────────────────────────────────────── document view ── */

function PdfDocument({ report, company }: { report: Report; company: Props['company'] }) {
    return (
        <article
            className={cn(
                // paper feel: always white regardless of theme, generous padding, A4 max-width
                'mx-auto bg-white text-zinc-900 shadow-2xl shadow-black/10',
                'w-full max-w-[840px]',
                'px-10 sm:px-14 lg:px-16 py-12 lg:py-14',
                'print:shadow-none print:max-w-none print:px-0 print:py-0',
            )}
            style={{ fontFamily: '"Inter", "Helvetica", Arial, sans-serif' }}
        >
            {/* Document header */}
            <header className="text-center pb-5 mb-7 border-b-2 border-zinc-900">
                <div className="text-base font-bold uppercase tracking-[0.18em] text-zinc-900">
                    {company?.name ?? 'Perusahaan'}
                </div>
                {company && (company.address || company.npwp) && (
                    <div className="mt-1.5 text-[11px] text-zinc-500">
                        {company.address}
                        {company.address && company.npwp ? <span className="mx-2">·</span> : null}
                        {company.npwp ? <>NPWP: {company.npwp}</> : null}
                    </div>
                )}
            </header>

            {/* Title block */}
            <div className="text-center mb-8">
                <h1 className="text-base font-bold uppercase tracking-[0.35em] text-zinc-900">
                    Laporan Laba Rugi
                </h1>
                <div className="mt-1.5 text-xs italic text-zinc-600">
                    Periode: {fmtPeriod(report.period.start, report.period.end)}
                </div>
            </div>

            {/* Body */}
            <div className="text-[13px] leading-relaxed">

                <DocSectionTitle>Pendapatan</DocSectionTitle>
                <DocRow indent label="Pendapatan dari Invoice (kas)" amount={report.revenue.invoice} />
                {report.revenue.non_invoice_by_category.map((r) => (
                    <DocRow key={`rev-${r.category_id}`} indent label={r.category_label} amount={r.amount} />
                ))}
                <DocRow label="Total Pendapatan" amount={report.revenue.total} weight="medium" rule="top" />

                <DocSectionTitle>Harga Pokok Penjualan (HPP)</DocSectionTitle>
                <DocRow indent label="HPP Invoice (cost-recovery)" amount={report.cogs.invoice} />
                {report.cogs.manual_by_category.map((r) => (
                    <DocRow key={`cogs-${r.category_id}`} indent label={r.category_label} amount={r.amount} />
                ))}
                <DocRow label="Total HPP" amount={report.cogs.total} weight="medium" rule="top" />

                <DocRow label="Laba Kotor" amount={report.gross_profit} weight="bold" rule="top-double" />

                <DocSectionTitle>Beban Operasional</DocSectionTitle>
                {report.opex.by_category.length === 0 ? (
                    <DocRow indent label="(tidak ada)" amount={0} muted />
                ) : (
                    report.opex.by_category.map((r) => (
                        <DocRow key={`opex-${r.category_id}`} indent label={r.category_label} amount={r.amount} />
                    ))
                )}
                <DocRow label="Total Beban Operasional" amount={report.opex.total} weight="medium" rule="top" />

                <DocRow label="Laba Usaha" amount={report.operating_profit} weight="bold" rule="top-double" />

                {(report.other_income.total > 0 || report.other_expense.total > 0) && (
                    <>
                        <DocSectionTitle>Pendapatan &amp; Beban Lain</DocSectionTitle>
                        {report.other_income.by_category.map((r) => (
                            <DocRow key={`oi-${r.category_id}`} indent label={r.category_label} amount={r.amount} />
                        ))}
                        {report.other_expense.by_category.map((r) => (
                            <DocRow key={`oe-${r.category_id}`} indent label={r.category_label} amount={r.amount} parens />
                        ))}
                        <DocRow
                            label="Total Pendapatan/Beban Lain (netto)"
                            amount={report.other_income.total - report.other_expense.total}
                            weight="medium"
                            rule="top"
                        />
                    </>
                )}

                <DocRow label="Laba Sebelum Pajak" amount={report.pre_tax_profit} weight="bold" rule="top-double" />

                {report.tax.total > 0 && (
                    <>
                        <DocSectionTitle>Pajak Perusahaan</DocSectionTitle>
                        {report.tax.by_category.map((r) => (
                            <DocRow key={`tax-${r.category_id}`} indent label={r.category_label} amount={r.amount} />
                        ))}
                        <DocRow label="Total Pajak Perusahaan" amount={report.tax.total} weight="medium" rule="top" />
                    </>
                )}

                <DocRow label="Laba Bersih" amount={report.net_profit} weight="bold" rule="top-double" />
            </div>

            {/* Document footer */}
            <footer className="mt-10 pt-3 border-t border-zinc-200 flex justify-between text-[10px] text-zinc-400">
                <span>Dicetak: {formatDateFns(new Date(), 'd MMMM yyyy HH:mm', { locale: idLocale })} WIB</span>
                <span>Basis: Kas · Cost-Recovery HPP</span>
            </footer>
        </article>
    );
}

/* ────────────────────────────────────────────────────── uncategorized panel ── */

interface UncatRowProps {
    row: CategoryRow;
    type: 'income' | 'expense' | null; // null = orphan (no category)
    onSelect: (categoryId: number, plGroup: string) => void;
    processing: boolean;
}

function UncatRow({ row, type, onSelect, processing }: UncatRowProps) {
    if (row.category_id === null || type === null) {
        // Orphan transaction — can't fix here, point user to transaksi page
        return (
            <div className="rounded-lg border border-zinc-200 dark:border-dark-600 bg-zinc-50 dark:bg-dark-800 p-3 space-y-1">
                <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium text-dark-900 dark:text-dark-50">{row.category_label}</span>
                    <span className="tabular-nums text-sm text-dark-700 dark:text-dark-300">{formatCurrency(row.amount)}</span>
                </div>
                <p className="text-[11px] text-dark-500 dark:text-dark-400">
                    Transaksi tanpa kategori — beri kategori lewat halaman <a href={companyUrl('/bank-accounts')} className="underline">Transaksi</a>.
                </p>
            </div>
        );
    }

    const options = PL_GROUP_OPTIONS[type];

    return (
        <div className="rounded-lg border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-3 space-y-2.5 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-dark-900 dark:text-dark-50 truncate" title={row.category_label}>
                        {row.category_label}
                    </div>
                    <Badge variant={type === 'income' ? 'green' : 'red'} className="mt-1 text-[10px]">
                        {type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </Badge>
                </div>
                <span className="tabular-nums text-sm font-medium text-dark-700 dark:text-dark-300 shrink-0">
                    {formatCurrency(row.amount)}
                </span>
            </div>
            <Combobox
                options={options}
                value={null}
                onChange={(v) => v && onSelect(row.category_id!, String(v))}
                placeholder={processing ? 'Menyimpan...' : 'Pilih grup L/R →'}
                disabled={processing}
            />
        </div>
    );
}

function UncategorizedPanel({
    report,
    unclassifiedTypes,
}: {
    report: Report;
    unclassifiedTypes: Record<string, 'income' | 'expense'>;
}) {
    const [processingId, setProcessingId] = React.useState<number | null>(null);

    const incomeRows = report.unclassified.income.by_category;
    const expenseRows = report.unclassified.expense.by_category;
    const totalCount = incomeRows.length + expenseRows.length;
    const totalAmount = report.unclassified.income.total + report.unclassified.expense.total;

    function handleSelect(categoryId: number, plGroup: string) {
        setProcessingId(categoryId);
        router.patch(companyUrl(`/transaction-categories/${categoryId}/pl-group`), { pl_group: plGroup }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setProcessingId(null),
        });
    }

    // Success state — everything classified
    if (totalCount === 0) {
        return (
            <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-5 text-center">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                    <h3 className="mt-3 font-semibold text-emerald-900 dark:text-emerald-200">Semua sudah diklasifikasi</h3>
                    <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                        Tidak ada transaksi yang terlewat dari Laba Rugi pada periode ini.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-orange-200 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-950/10">
            <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                        <TriangleAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-orange-900 dark:text-orange-200">
                            Perlu Diklasifikasi <span className="text-orange-600 dark:text-orange-400">({totalCount})</span>
                        </h3>
                        <p className="mt-0.5 text-xs text-orange-800/80 dark:text-orange-300/80">
                            Total <span className="font-medium tabular-nums">{formatCurrency(totalAmount)}</span> belum masuk laporan. Pilih grup L/R untuk masing-masing kategori.
                        </p>
                    </div>
                </div>

                {incomeRows.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400/80">Pemasukan</h4>
                        {incomeRows.map((r) => (
                            <UncatRow
                                key={`ui-${r.category_id ?? 'orphan'}`}
                                row={r}
                                type={r.category_id ? unclassifiedTypes[String(r.category_id)] ?? 'income' : null}
                                onSelect={handleSelect}
                                processing={processingId === r.category_id}
                            />
                        ))}
                    </div>
                )}

                {expenseRows.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400/80">Pengeluaran</h4>
                        {expenseRows.map((r) => (
                            <UncatRow
                                key={`ue-${r.category_id ?? 'orphan'}`}
                                row={r}
                                type={r.category_id ? unclassifiedTypes[String(r.category_id)] ?? 'expense' : null}
                                onSelect={handleSelect}
                                processing={processingId === r.category_id}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ─────────────────────────────────────────────────────────────── main page ── */

export default function ProfitLossIndex() {
    const { report, unclassifiedTypes, filters, company } = usePage<Props>().props;

    const [start, setStart] = React.useState<Date>(new Date(filters.start_date + 'T00:00:00'));
    const [end, setEnd] = React.useState<Date>(new Date(filters.end_date + 'T00:00:00'));

    const activePreset = detectPreset(filters.start_date, filters.end_date);

    function navigate(s: Date, e: Date) {
        router.get(companyUrl('/reports/profit-loss'), {
            start_date: formatDateFns(s, 'yyyy-MM-dd'),
            end_date: formatDateFns(e, 'yyyy-MM-dd'),
        }, { preserveState: false });
    }

    function applyPreset(key: PresetKey) {
        const r = presetRange(key);
        setStart(r.start);
        setEnd(r.end);
        navigate(r.start, r.end);
    }

    const pdfUrl = companyUrl(`/reports/profit-loss/pdf?start_date=${filters.start_date}&end_date=${filters.end_date}`);

    const presets: { key: PresetKey; label: string }[] = [
        { key: 'this_month', label: 'Bulan ini' },
        { key: 'last_month', label: 'Bulan lalu' },
        { key: 'ytd', label: 'Tahun berjalan' },
        { key: 'last_year', label: 'Tahun lalu' },
    ];

    return (
        <>
            <Head title="Laporan Laba Rugi" />

            <div className="space-y-6">
                {/* Header */}
                <div className="print:hidden">
                    <PageHeader
                        title="Laporan Laba Rugi"
                        description="Ringkasan pendapatan, modal, beban, dan laba bersih perusahaan"
                        action={(
                            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="primary" size="sm" icon={<Download className="h-4 w-4" />}>
                                    Unduh PDF
                                </Button>
                            </a>
                        )}
                    />
                </div>

                {/* Filter bar */}
                <Card className="print:hidden">
                    <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {presets.map((p) => (
                                <Button
                                    key={p.key}
                                    variant={activePreset === p.key ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => applyPreset(p.key)}
                                >
                                    {p.label}
                                </Button>
                            ))}
                            {activePreset === null && (
                                <Badge variant="blue" className="text-[10px]">Periode khusus</Badge>
                            )}
                        </div>

                        <div className="hidden lg:block w-px h-6 bg-secondary-200 dark:bg-dark-600" />

                        <div className="flex items-end gap-2 flex-1">
                            <div className="flex-1 min-w-0 sm:max-w-xs">
                                <DatePicker
                                    mode="range"
                                    value={{ from: start, to: end }}
                                    onChange={(v) => {
                                        if (v && 'from' in v) {
                                            if (v.from) setStart(v.from);
                                            if (v.to) setEnd(v.to);
                                        }
                                    }}
                                />
                            </div>
                            <Button variant="primary" size="sm" onClick={() => navigate(start, end)}>
                                Terapkan
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Document + panel */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 print:block">
                    {/* PDF preview */}
                    <div className="min-w-0">
                        <PdfDocument report={report} company={company} />
                    </div>

                    {/* Side panel — sticky on desktop, hidden on print */}
                    <aside className="print:hidden xl:sticky xl:top-6 xl:self-start">
                        <UncategorizedPanel report={report} unclassifiedTypes={unclassifiedTypes} />

                        {/* Quick reference card */}
                        <Card className="mt-4 hidden xl:block">
                            <CardContent className="p-4 space-y-2 text-xs text-dark-600 dark:text-dark-400">
                                <div className="flex items-center gap-2 text-dark-900 dark:text-dark-50">
                                    <FileBarChart className="w-4 h-4 text-primary-500" />
                                    <span className="font-medium">Tentang laporan ini</span>
                                </div>
                                <p>Basis <strong>kas</strong>: pendapatan dihitung saat uang masuk.</p>
                                <p>HPP dari invoice pakai metode <strong>cost-recovery</strong> — uang masuk menutup modal dulu, baru sisanya jadi laba.</p>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </>
    );
}

ProfitLossIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
