import { Check, Clock } from 'lucide-react';
import * as React from 'react';
import { StatusPill } from '@/components/dashboard/widget';
import { cn, formatCurrency } from '@/lib/utils';

/*
 * Bahan bersama modul Invoice (gaya Obsidian): status, format tanggal/rupiah, dan kelas
 * pembungkus yang menyelaraskan komponen form lama (Input, Combobox, DatePicker, CurrencyInput)
 * dengan token --ob-* tanpa mengubah tampilan halaman lain.
 */

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid';

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    sent: 'Terkirim',
    partially_paid: 'Sebagian',
    paid: 'Lunas',
};

export function InvoiceStatusPill({ status, className }: { status: string; className?: string }) {
    if (status === 'paid') {
        return (
            <StatusPill tone="pos" icon={<Check className="h-3 w-3" strokeWidth={3} />} className={className}>
                Lunas
            </StatusPill>
        );
    }
    if (status === 'partially_paid') return <StatusPill tone="wait" className={className}>Sebagian</StatusPill>;
    if (status === 'sent') return <StatusPill tone="act" className={className}>Terkirim</StatusPill>;
    return <StatusPill tone="neutral" className={className}>Draft</StatusPill>;
}

export const rp = (n: number) => formatCurrency(Math.round(n));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

function parseIso(iso: string): Date {
    return new Date(iso.slice(0, 10) + 'T00:00:00');
}

/** "16 Sep" */
export function shortDate(iso: string): string {
    const d = parseIso(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "16 Sep 2026" */
export function longDate(iso: string): string {
    const d = parseIso(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "25 Sep 2026 · 10.12" untuk stempel waktu ISO. */
export function dateTime(iso: string): string {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${hh}.${mm}`;
}

export function monthLabel(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
}

/** Selisih hari kalender dari hari ini (positif = masa depan). */
export function daysFromToday(iso: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((parseIso(iso).getTime() - today.getTime()) / 86_400_000);
}

export function issuedAgo(iso: string): string {
    const d = -daysFromToday(iso);
    if (d <= 0) return 'hari ini';
    if (d === 1) return 'kemarin';
    return `${d} hari lalu`;
}

/**
 * Penanda jatuh tempo. Lewat tempo bukan status tersimpan: hanya invoice terkirim/sebagian
 * yang tanggal jatuh temponya sudah lewat.
 */
export function dueInfo(status: string, dueIso: string): { label: string | null; tone: 'late' | 'soon' | 'muted'; overdue: boolean } {
    if (status === 'paid') return { label: 'lunas', tone: 'muted', overdue: false };
    const d = daysFromToday(dueIso);
    if (status === 'draft') return { label: null, tone: 'muted', overdue: false };
    if (d < 0) return { label: `lewat ${-d} hari`, tone: 'late', overdue: true };
    if (d === 0) return { label: 'hari ini', tone: 'soon', overdue: false };
    return { label: `${d} hari lagi`, tone: d <= 7 ? 'soon' : 'muted', overdue: false };
}

/** Tampilan penanda lewat tempo: jam + teks, warna hanya redundansi. */
export function OverdueChip({ label }: { label: string }) {
    return (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-ob-late/12 px-1.5 text-xs font-semibold text-ob-late">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {label}
        </span>
    );
}

/* Mirrors Invoice::extractInitials() — singkatan badan usaha tidak dihitung. */
const COMPANY_PREFIXES = ['pt', 'cv', 'ud', 'tb', 'pd', 'firma', 'yayasan', 'koperasi', 'perum', 'persero'];

export function initials(name: string): string {
    const words = name.split(/\s+/).filter((w) => w && !COMPANY_PREFIXES.includes(w.toLowerCase().replace(/\.$/, '')));
    return (words.slice(0, 2).map((w) => w[0]).join('') || name.slice(0, 2)).toUpperCase();
}

export function Avatar({ name, className }: { name: string; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ob-chip text-xs font-bold text-ob-ink-2', className)}
        >
            {initials(name)}
        </span>
    );
}

/* ─── kelas bersama ─── */

/** Pembungkus field: menyelaraskan Input/Combobox/DatePicker/CurrencyInput dengan token Obsidian. */
export const FIELD = cn(
    '[&_label]:mb-1.5 [&_label]:text-[13px] [&_label]:font-medium [&_label]:text-ob-ink-2',
    '[&_input]:h-[42px] [&_input]:border-ob-line [&_input]:bg-ob-inner [&_input]:text-ob-ink [&_input]:placeholder:text-ob-ink-3 [&_input]:focus:ring-ob-act-fill',
    '[&_button]:h-[42px] [&_button]:border-ob-line [&_button]:bg-ob-inner [&_button]:text-ob-ink',
    '[&_.rounded-l-xl]:border-ob-line [&_.rounded-l-xl]:bg-ob-chip [&_.rounded-l-xl]:text-ob-ink-2',
);

/** Field ringkas di dalam baris item (tinggi 34). */
export const FIELD_SM = cn(
    FIELD,
    '[&_input]:h-[34px] [&_input]:text-[13px] [&_button]:h-[34px] [&_button]:text-[13px] [&_.rounded-l-xl]:text-xs [&_.rounded-l-xl]:px-2',
);

const BTN_BASE =
    'h-11 rounded-full px-5 text-sm font-semibold ring-offset-ob-page focus-visible:ring-ob-act-fill dark:ring-offset-ob-page';

export const BTN = {
    primary: cn(BTN_BASE, 'bg-ob-act-fill text-white hover:bg-ob-act-fill/90 dark:bg-ob-act-fill dark:hover:bg-ob-act-fill/90'),
    secondary: cn(
        BTN_BASE,
        'border border-ob-line bg-ob-card text-ob-ink hover:bg-ob-hover dark:border-ob-line dark:bg-ob-card dark:text-ob-ink dark:hover:bg-ob-hover',
    ),
    ghost: cn(BTN_BASE, 'px-4 text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink dark:text-ob-ink-2 dark:hover:bg-ob-hover dark:hover:text-ob-ink'),
    icon: 'h-10 w-10 rounded-full border border-ob-line bg-ob-card p-0 text-ob-ink hover:bg-ob-hover focus-visible:ring-ob-act-fill dark:border-ob-line dark:bg-ob-card dark:text-ob-ink dark:hover:bg-ob-hover',
    small: 'h-8 rounded-full border border-ob-line bg-ob-card px-3 text-xs font-semibold text-ob-ink hover:bg-ob-hover dark:border-ob-line dark:bg-ob-card dark:text-ob-ink dark:hover:bg-ob-hover',
};

export const CARD = 'rounded-3xl border border-ob-line bg-ob-card p-[22px]';

/** Dialog/Sheet Obsidian: timpa latar & tepi komponen lama. */
export const SURFACE = 'border-ob-line bg-ob-card text-ob-ink dark:border-ob-line dark:bg-ob-card';

/** Baris label–nilai dalam ringkasan angka. */
export function SumRow({ label, value, strong, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; className?: string }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4', strong ? 'text-base font-semibold text-ob-ink' : 'text-sm text-ob-ink-2', className)}>
            <span>{label}</span>
            <span className={cn('tabular-nums', strong ? 'text-lg' : 'font-medium text-ob-ink')}>{value}</span>
        </div>
    );
}

export function getCsrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}
