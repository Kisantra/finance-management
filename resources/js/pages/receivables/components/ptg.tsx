import { Check, X } from 'lucide-react';
import { StatusPill } from '@/components/dashboard/widget';
import { t, tk } from '@/i18n';
import type { ReceivableRow, ReceivableStatus } from '../types';

/* Bahan bersama modul Piutang (gaya Obsidian): status, tipe, dan total bunga. */

export const STATUS_LABEL: Record<ReceivableStatus, string> = {
    draft: tk('Draft'),
    pending_approval: tk('Menunggu persetujuan'),
    active: tk('Aktif'),
    paid_off: tk('Lunas'),
    rejected: tk('Ditolak'),
};

/**
 * Status akhir (lunas/ditolak) memakai ikon centang atau silang, bukan titik — supaya
 * "selesai" bisa dibedakan dari "sedang berjalan" tanpa mengandalkan warna saja.
 */
export function ReceivableStatusPill({ status }: { status: ReceivableStatus }) {
    if (status === 'paid_off') {
        return (
            <StatusPill tone="pos" icon={<Check className="h-3 w-3" strokeWidth={3} />}>
                {t('Lunas')}
            </StatusPill>
        );
    }
    if (status === 'rejected') {
        return (
            <StatusPill tone="late" icon={<X className="h-3 w-3" strokeWidth={3} />}>
                {t('Ditolak')}
            </StatusPill>
        );
    }
    if (status === 'pending_approval') {
        return <StatusPill tone="wait">{t('Menunggu persetujuan')}</StatusPill>;
    }
    if (status === 'active') {
        return <StatusPill tone="act">{t('Aktif')}</StatusPill>;
    }
    return <StatusPill tone="neutral">{t('Draft')}</StatusPill>;
}

export const TYPE_LABEL: Record<ReceivableRow['type'], string> = {
    employee_loan: tk('Karyawan'),
    company_loan: tk('Perusahaan'),
};

/**
 * Total bunga satu piutang — salinan `JadwalAngsuranService::totalBungaPiutang()`.
 *
 * Rumusnya BERBEDA dari Pinjaman: persentase atas seluruh pokok, tidak diprorata per
 * bulan. Perbedaan ini sudah berlaku sebelum service itu ada, dan menyamakannya akan
 * mengubah angka pada data yang sudah berjalan.
 *
 * Angka ini hanya petunjuk di layar (batas maksimum pada form pembayaran); yang
 * menegakkan batasnya tetap server.
 */
export function totalInterest(row: ReceivableRow): number {
    return Math.round((row.principal_amount * (row.interest_rate ?? 0)) / 100);
}

/**
 * "12,5%", atau "tanpa bunga" bila nol.
 *
 * Dibandingkan sebagai ANGKA, bukan kebenaran nilai: kolom decimal dikirim sebagai string,
 * dan `"0.0000"` itu truthy — penjagaan `!row.interest_rate` lolos begitu saja lalu
 * menampilkan "0%". Titik desimalnya juga diganti koma, karena di halaman ini titik berarti
 * pemisah ribuan.
 */
export function interestLabel(row: ReceivableRow): string {
    const rate = Number(row.interest_rate ?? 0);
    if (rate === 0) {
        return t('tanpa bunga');
    }
    return `${String(rate).replace('.', ',')}%`;
}
