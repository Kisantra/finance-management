import { Check } from 'lucide-react';
import { StatusPill } from '@/components/dashboard/widget';
import { formatCurrency } from '@/lib/utils';
import type { LoanRow } from '../types';
import { t } from '@/i18n';

/* Bahan bersama modul Pinjaman (gaya Obsidian): status, label bunga, dan total bunga. */

export function LoanStatusPill({ status }: { status: LoanRow['status'] }) {
    if (status === 'paid_off') {
        return (
            <StatusPill tone="pos" icon={<Check className="h-3 w-3" strokeWidth={3} />}>
                {t('Lunas', { context: 'pinjaman' })}
            </StatusPill>
        );
    }
    return <StatusPill tone="act">{t('Aktif', { context: 'pinjaman' })}</StatusPill>;
}

/**
 * "11,5% p.a." atau nominal tetap.
 *
 * `interest_rate` datang dari kolom decimal, jadi 9% terbaca "9.00" — ditulis apa adanya
 * hasilnya "9.00%", dengan titik yang di halaman ini berarti pemisah ribuan.
 */
export function interestLabel(row: LoanRow): string {
    if (row.interest_type === 'fixed') {
        return row.interest_amount ? formatCurrency(row.interest_amount) : '—';
    }
    if (!row.interest_rate) {
        return '0%';
    }
    return t('{{rate}}% p.a.', { rate: String(Number(row.interest_rate)).replace('.', ',') });
}

/**
 * Total bunga satu pinjaman — salinan `JadwalAngsuranService::totalBungaPinjaman()`.
 *
 * Angka ini hanya PETUNJUK di layar (batas maksimum pada form pembayaran). Yang menegakkan
 * batasnya tetap server, memakai rumus di service itu; kalau keduanya pernah menyimpang,
 * yang berlaku adalah server dan form akan menolak kelebihannya.
 */
export function totalInterest(row: LoanRow): number {
    if (row.interest_type === 'fixed') {
        return row.interest_amount ?? 0;
    }
    return Math.round(((row.principal_amount * (row.interest_rate ?? 0)) / 100 / 12) * row.term_months);
}
