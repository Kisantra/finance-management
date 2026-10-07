import * as React from 'react';
import { cn, formatCurrency } from '@/lib/utils';

/*
 * Grafik batang arus kas Obsidian: pemasukan solid (bucket terakhir lebih terang),
 * pengeluaran bergaris. Lebar batang dan jarak label adaptif terhadap jumlah bucket
 * (6 bulanan → 31 harian). Tooltip terang saat hover/fokus; tabel sr-only untuk pembaca layar.
 * Spesifikasi: artboard "Grafik arus kas" di kanvas desain.
 */

export interface CashFlowSeries {
    labels: string[];
    income: number[];
    expenses: number[];
}

interface CashFlowChartProps extends CashFlowSeries {
    /** Tinggi area batang dalam px. */
    height?: number;
    className?: string;
}

const Y_TICKS = 3;

/** Angka ringkas untuk sumbu: 1,2 jt · 800 rb · 2 M. */
export function compactRupiah(value: number): string {
    const abs = Math.abs(value);
    const f = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
    if (abs >= 1_000_000_000) return `${f(value / 1_000_000_000)} M`;
    if (abs >= 1_000_000) return `${f(value / 1_000_000)} jt`;
    if (abs >= 1_000) return `${f(value / 1_000)} rb`;
    return f(value);
}

/** Langkah sumbu yang "bulat" (1, 2, 2.5, 5 × 10^n); batas atas = 3 langkah, dengan ruang tooltip. */
function niceMax(max: number): number {
    if (max <= 0) return 3_000_000;
    const raw = (max * 1.15) / Y_TICKS;
    const exp = Math.pow(10, Math.floor(Math.log10(raw)));
    const unit = raw / exp;
    const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * exp;
    return step * Y_TICKS;
}

export function CashFlowChart({ labels, income, expenses, height = 200, className }: CashFlowChartProps) {
    const n = labels.length;
    const [active, setActive] = React.useState<number | null>(null);

    const max = niceMax(Math.max(0, ...income, ...expenses));
    const ticks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (max * (Y_TICKS - i)) / Y_TICKS);

    /* Aturan adaptif: batang 26 → 6 px, gap pasangan 6 → 2 px, label setiap k-th ≥ 56 px. */
    const barW = n <= 6 ? 26 : n <= 12 ? 14 : n <= 24 ? 8 : 6;
    const pairGap = n <= 6 ? 6 : n <= 12 ? 3 : 2;
    const bucketGap = n <= 6 ? 22 : n <= 12 ? 12 : 6;
    const radius = n <= 6 ? 8 : n <= 12 ? 4 : 3;
    const labelEvery = n <= 6 ? 1 : n <= 12 ? 2 : n <= 24 ? 3 : 5;

    const h = (v: number) => (max === 0 ? 0 : Math.max(v > 0 ? 2 : 0, Math.round((v / max) * height)));

    return (
        <div className={cn('grid grid-cols-[48px_minmax(0,1fr)] gap-x-3', className)}>
            <div
                aria-hidden="true"
                className="flex flex-col justify-between text-right text-xs leading-none text-ob-ink-3"
                style={{ height }}
            >
                {ticks.map((t, i) => (
                    <span key={i}>{i === ticks.length - 1 ? '0' : compactRupiah(t)}</span>
                ))}
            </div>

            <div aria-hidden="true" className="relative" style={{ height }}>
                <div className="absolute inset-0 flex flex-col justify-between">
                    {ticks.map((_, i) => (
                        <span
                            key={i}
                            className={cn(
                                'border-t',
                                i === ticks.length - 1 ? 'border-solid border-ob-line-strong' : 'border-dashed border-ob-line',
                            )}
                        />
                    ))}
                </div>
                <div
                    className="absolute inset-0 grid items-end px-1.5"
                    style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: bucketGap }}
                    onMouseLeave={() => setActive(null)}
                >
                    {labels.map((label, i) => {
                        const last = i === n - 1;
                        const isActive = active === i;
                        return (
                            <div
                                key={i}
                                tabIndex={0}
                                aria-label={`${label}: pemasukan ${formatCurrency(income[i])}, pengeluaran ${formatCurrency(expenses[i])}`}
                                onMouseEnter={() => setActive(i)}
                                onFocus={() => setActive(i)}
                                onBlur={() => setActive(null)}
                                className="relative flex items-end justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                style={{ height, gap: pairGap }}
                            >
                                {isActive && (
                                    <span
                                        role="tooltip"
                                        className="pointer-events-none absolute top-0 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1 items-center gap-2.5 whitespace-nowrap rounded-lg bg-ob-invert px-2.5 py-1.5 text-xs font-semibold text-ob-invert-ink shadow-lg shadow-black/20"
                                    >
                                        <span className="font-medium opacity-60">{label}</span>
                                        <span>+{formatCurrency(income[i])}</span>
                                        <span className="text-ob-neg">−{formatCurrency(expenses[i])}</span>
                                    </span>
                                )}
                                <span
                                    className="block transition-[height] duration-300 ease-out"
                                    style={{
                                        width: barW,
                                        height: h(income[i]),
                                        borderRadius: `${radius}px ${radius}px 0 0`,
                                        background: last ? 'var(--ob-bar-now)' : 'var(--ob-bar-past)',
                                    }}
                                />
                                <span
                                    className="ob-hatch block border-b-0 transition-[height] duration-300 ease-out"
                                    style={{
                                        width: barW,
                                        height: h(expenses[i]),
                                        borderRadius: `${radius}px ${radius}px 0 0`,
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            <span aria-hidden="true" />
            <div
                aria-hidden="true"
                className="grid px-1.5 pt-2 text-center text-xs text-ob-ink-3"
                style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: bucketGap }}
            >
                {labels.map((label, i) => {
                    const last = i === n - 1;
                    const show = i % labelEvery === 0 || last;
                    return (
                        <span key={i} className={cn('truncate', last && 'font-semibold text-ob-ink', n > 12 && 'text-[11px]')}>
                            {show ? label : ''}
                        </span>
                    );
                })}
            </div>

            <table className="sr-only">
                <caption>Pemasukan dan pengeluaran per periode, dalam rupiah</caption>
                <thead>
                    <tr>
                        <th>Periode</th>
                        <th>Pemasukan</th>
                        <th>Pengeluaran</th>
                    </tr>
                </thead>
                <tbody>
                    {labels.map((label, i) => (
                        <tr key={i}>
                            <td>{label}</td>
                            <td>{income[i].toLocaleString('id-ID')}</td>
                            <td>{expenses[i].toLocaleString('id-ID')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function CashFlowChartSkeleton({ height = 200, className }: { height?: number; className?: string }) {
    const bars = [0.35, 0.5, 0.3, 0.6, 0.4, 0.7];
    return (
        <div aria-busy="true" aria-label="Memuat grafik" className={cn('grid grid-cols-[48px_minmax(0,1fr)] gap-x-3', className)}>
            <div style={{ height }} />
            <div className="grid items-end gap-x-[22px] px-1.5" style={{ height, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                {bars.map((b, i) => (
                    <div key={i} className="flex items-end justify-center gap-1.5">
                        <span className="w-[26px] animate-pulse rounded-t-lg bg-ob-chip" style={{ height: height * b }} />
                        <span className="w-[26px] animate-pulse rounded-t-lg bg-ob-inner" style={{ height: height * b * 0.6 }} />
                    </div>
                ))}
            </div>
        </div>
    );
}
