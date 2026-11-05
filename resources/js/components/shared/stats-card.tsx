import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    color?: 'blue' | 'green' | 'purple' | 'red' | 'emerald' | 'yellow' | 'orange' | 'indigo';
    className?: string;
    inModal?: boolean;
}

/* Satu makna per hue (Obsidian); warna tanpa makna semantik (ungu, indigo) jatuh ke netral. */
const iconTone: Record<NonNullable<StatsCardProps['color']>, string> = {
    blue: 'text-ob-act',
    green: 'text-ob-pos',
    emerald: 'text-ob-pos',
    red: 'text-ob-late',
    orange: 'text-ob-neg',
    yellow: 'text-ob-wait',
    purple: 'text-ob-ink-2',
    indigo: 'text-ob-ink-2',
};

export function StatsCard({ label, value, icon, color = 'blue', className, inModal = false }: StatsCardProps) {
    return (
        <div
            className={cn(
                'flex items-start justify-between gap-3 border border-ob-line',
                // Di dalam modal (latar kartu) tampil sebagai kartu-dalam.
                inModal ? 'rounded-2xl bg-ob-inner p-4' : 'rounded-3xl bg-ob-card p-[22px]',
                className,
            )}
        >
            <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-[13px] leading-tight text-ob-ink-2">{label}</p>
                <p className="text-2xl font-semibold leading-tight tracking-[-0.01em] tabular-nums text-ob-ink">{value}</p>
            </div>
            <span
                className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ob-chip [&_svg]:h-4 [&_svg]:w-4',
                    iconTone[color] ?? 'text-ob-ink-2',
                )}
            >
                {icon}
            </span>
        </div>
    );
}
