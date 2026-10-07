import { router } from '@inertiajs/react';

/* URL halaman Inertia yang sedang tampil (diperbarui setiap navigasi). */
let current: string | null = null;

export function trackNavigation(): void {
    router.on('navigate', (event) => {
        current = event.detail.page.url;
    });
}

export function currentUrl(): string | null {
    return current;
}

/** Kunjungan sisi klien (router.replace) tidak selalu memicu event navigate; perbarui manual. */
export function setCurrentUrl(url: string): void {
    current = url;
}
