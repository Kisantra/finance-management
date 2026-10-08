import { Check, X } from 'lucide-react';
import { StatusPill } from '@/components/dashboard/widget';
import { cn } from '@/lib/utils';
import { getCsrfToken } from '@/pages/invoices/components/ob';

/*
 * Bahan bersama modul Reimbursement (gaya Obsidian). Komponen visual umum — BTN, CARD, FIELD,
 * SURFACE, rp(), tanggal — dipakai dari pages/invoices/components/ob.tsx agar kedua modul identik.
 */

export type ReimbursementStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid';

export const STATUS_LABEL: Record<ReimbursementStatus, string> = {
    draft: 'Draft',
    pending: 'Menunggu review',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    paid: 'Lunas',
};

/** Tone sesuai design system: tunggu = wait, aktif = act, final = ikon centang/silang. */
export function ReimbursementStatusPill({ status, className }: { status: string; className?: string }) {
    switch (status) {
        case 'paid':
            return (
                <StatusPill tone="pos" icon={<Check className="h-3 w-3" strokeWidth={3} />} className={className}>
                    Lunas
                </StatusPill>
            );
        case 'rejected':
            return (
                <StatusPill tone="late" icon={<X className="h-3 w-3" strokeWidth={3} />} className={className}>
                    Ditolak
                </StatusPill>
            );
        case 'approved':
            return <StatusPill tone="act" className={className}>Disetujui</StatusPill>;
        case 'pending':
            return <StatusPill tone="wait" className={className}>Menunggu review</StatusPill>;
        default:
            return <StatusPill tone="neutral" className={className}>Draft</StatusPill>;
    }
}

export interface ActionResult {
    ok: boolean;
    message?: string;
    id?: number;
    /** Galat validasi per field (pesan pertama), atau `_` untuk galat umum. */
    errors: Record<string, string>;
}

const JSON_HEADERS = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

/**
 * Aksi lewat fetch JSON, bukan kunjungan Inertia: redirect back akan mengganti halaman di
 * belakang drawer `#reimbursement/{id}` dan membuang hash-nya.
 */
export async function rbAction(url: string, method: 'POST' | 'DELETE', body?: Record<string, unknown> | FormData): Promise<ActionResult> {
    const isForm = body instanceof FormData;
    const res = await fetch(url, {
        method,
        headers: { ...JSON_HEADERS, 'X-CSRF-TOKEN': getCsrfToken(), ...(isForm || !body ? {} : { 'Content-Type': 'application/json' }) },
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    const errors: Record<string, string> = data.errors
        ? Object.fromEntries(Object.entries(data.errors as Record<string, string[]>).map(([k, v]) => [k, v[0]]))
        : res.ok
          ? {}
          : { _: data.message ?? `Server membalas ${res.status}.` };
    return { ok: res.ok, message: data.message, id: data.id, errors };
}

/** Inisial dua huruf untuk avatar pemohon. */
export function initialsOf(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
}

export function PersonAvatar({ name, className }: { name: string | null | undefined; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ob-chip text-[11px] font-bold text-ob-ink-2', className)}
        >
            {initialsOf(name)}
        </span>
    );
}

