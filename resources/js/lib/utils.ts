import { type ClassValue, clsx } from 'clsx';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string, locale = 'id-ID'): string {
    return 'Rp ' + Number(value).toLocaleString(locale);
}

export function parseCurrency(value: string): number {
    return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * Convert a Date object to "YYYY-MM-DD" using LOCAL timezone.
 * Fixes the UTC offset bug where toISOString() shifts the date back 1 day
 * for timezones east of UTC (e.g. WIB = UTC+7).
 */
export function toLocalIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function formatDate(dateString: string, locale = 'id-ID'): string {
    return new Date(dateString).toLocaleDateString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Salin teks ke clipboard. Clipboard API hanya tersedia di konteks aman (HTTPS/localhost);
 * di luar itu jatuh ke execCommand supaya tombol salin tidak diam-diam gagal.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied;
    }
}

const ERROR_TOAST_OPTS = { duration: Infinity, closeButton: true } as const;

/** Toast error tunggal — tidak auto-close, ada tombol X. */
export function toastError(message: string, description?: string): void {
    toast.error(message, { ...ERROR_TOAST_OPTS, description });
}

/**
 * Toast semua error dari Inertia onError / fetch json.errors.
 * 1 error → pesan langsung. >1 error → judul + daftar di description.
 * Selalu console.error agar developer bisa lihat detail lengkap.
 */
export function toastErrors(errs: Record<string, string>, context?: string): void {
    const messages = Object.values(errs);
    console.error(context ? `[${context}]` : '[Error]', errs);

    if (messages.length === 0) {
        toast.error('Terjadi kesalahan tidak diketahui.', ERROR_TOAST_OPTS);
        return;
    }

    if (messages.length === 1) {
        toast.error(messages[0], ERROR_TOAST_OPTS);
        return;
    }

    toast.error(`${messages.length} kesalahan ditemukan`, {
        ...ERROR_TOAST_OPTS,
        description: messages.map((m, i) => `${i + 1}. ${m}`).join('\n'),
    });
}
