import * as React from 'react';
import { cn, formatCurrency } from '@/lib/utils';

/*
 * Donat pengeluaran per kategori dengan ramp netral satu hue: kategori tidak butuh makna
 * warna, status yang butuh. Irisan terbesar paling terang di tema gelap dan paling gelap
 * di tema terang (ramp dibalik lewat variabel CSS).
 */

export interface DonutSlice {
    name: string;
    value: number;
}

interface DonutChartProps {
    slices: DonutSlice[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
    centerSub?: string;
    className?: string;
}

/** Ramp 5 langkah; index 0 = irisan terbesar. */
export const DONUT_RAMP_DARK = ['#dfe3ea', '#a3a8b3', '#6b7280', '#3f4450', '#4a4f5c'];
export const DONUT_RAMP_LIGHT = ['#1f2330', '#4b5260', '#8a919e', '#c3c7d0', '#d4d7de'];

export function useDonutRamp(): string[] {
    const [dark, setDark] = React.useState(
        () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
    );
    React.useEffect(() => {
        const el = document.documentElement;
        const obs = new MutationObserver(() => setDark(el.classList.contains('dark')));
        obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return dark ? DONUT_RAMP_DARK : DONUT_RAMP_LIGHT;
}

export function DonutChart({ slices, size = 140, thickness = 16, centerLabel, centerSub, className }: DonutChartProps) {
    const ramp = useDonutRamp();
    const total = slices.reduce((s, x) => s + x.value, 0);
    const r = size / 2 - thickness / 2;
    const c = 2 * Math.PI * r;
    const gap = slices.length > 1 ? 2 : 0;

    let offset = 0;
    const arcs = slices.map((s, i) => {
        const len = total > 0 ? (s.value / total) * c : 0;
        const arc = { len: Math.max(0, len - gap), off: offset, color: ramp[Math.min(i, ramp.length - 1)] };
        offset += len;
        return arc;
    });

    const label = slices.map((s) => `${s.name} ${total ? Math.round((s.value / total) * 100) : 0} persen`).join(', ');

    return (
        <svg
            role="img"
            aria-label={`Pengeluaran per kategori: ${label}. Total ${formatCurrency(total)}.`}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className={cn('shrink-0', className)}
        >
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ob-inner)" strokeWidth={thickness} />
            {arcs.map((a, i) => (
                <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${a.len} ${c - a.len}`}
                    strokeDashoffset={-a.off}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className="transition-[stroke-dasharray] duration-300"
                />
            ))}
            {centerLabel && (
                <text x="50%" y="47%" textAnchor="middle" fill="var(--ob-ink)" fontSize={15} fontWeight={700}>
                    {centerLabel}
                </text>
            )}
            {centerSub && (
                <text x="50%" y="60%" textAnchor="middle" fill="var(--ob-ink-2)" fontSize={12}>
                    {centerSub}
                </text>
            )}
        </svg>
    );
}
