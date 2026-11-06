/**
 * Konteks untuk laporan bug yang diteruskan ke Watchpost (tim IT).
 * Skrip browser package kisantra/watchpost-laravel hanya terpasang bila
 * Watchpost aktif di environment ini; tanpa itu semua helper mengembalikan
 * nilai kosong, dan laporan tetap terkirim seperti biasa.
 */
export type WatchpostStep = {
    type: 'page' | 'click' | 'submit' | 'request';
    label: string;
    at: string;
};

declare global {
    interface Window {
        Watchpost?: { trail: () => WatchpostStep[] };
    }
}

/** Langkah terakhir pengguna di tab ini (halaman, klik, form, request gagal). */
export function watchpostTrail(): WatchpostStep[] {
    try {
        return window.Watchpost?.trail() ?? [];
    } catch {
        return [];
    }
}

/**
 * Path + query + #hash. Detail yang dibuka sebagai modal (#invoice/12) dan
 * filter aktif (?month=…) ikut tercatat, jadi tim tahu persis layar mana.
 */
export function currentPageUrl(): string {
    const { pathname, search, hash } = window.location;

    return `${pathname}${search}${hash}`;
}
