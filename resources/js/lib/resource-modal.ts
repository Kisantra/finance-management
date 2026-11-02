import { router } from '@inertiajs/react';
import * as React from 'react';
import { currentUrl, setCurrentUrl } from './navigation';

/*
 * Modal sumber daya yang menumpang di halaman mana pun, seperti Settings di claude.ai:
 * URL halaman tetap (mis. /dashboard), hanya ditambah hash `#invoice/13`. Halaman di belakang
 * tidak berganti; refresh, tautan yang dibagikan, dan tombol Back/Forward tetap bekerja.
 *
 * Sumber kebenaran adalah `window.location.hash`, bukan `usePage().url`: saat halaman dimuat
 * ulang Inertia menempelkan hash ke objek halamannya tanpa memicu render ulang.
 *
 * Perubahan hash memicu `popstate`. Inertia menanggapinya dengan menggulir ke atas atau memasang
 * ulang halaman, jadi transisi yang hanya mengubah hash dicegat di sini (didaftarkan sebelum
 * Inertia) lalu state riwayat Inertia disinkronkan lewat kunjungan sisi klien yang mempertahankan
 * state & posisi gulir.
 */

export type ResourceType = 'invoice' | 'reimbursement';

export interface ResourceRef {
    type: ResourceType;
    id: number;
}

const HASH = /#(invoice|reimbursement)\/(\d+)$/;
const CHANGE_EVENT = 'resource-modal-change';

export function parseResource(url: string): ResourceRef | null {
    const m = HASH.exec(url);
    return m ? { type: m[1] as ResourceType, id: Number(m[2]) } : null;
}

export function resourceHref(type: ResourceType, id: number): string {
    return `#${type}/${id}`;
}

const pathOf = (url: string) => url.split('#')[0];

/** Samakan URL & state riwayat Inertia dengan alamat baru tanpa memuat ulang halaman. */
function syncInertiaUrl(url: string): void {
    router.replace({
        url,
        preserveState: true,
        preserveScroll: true,
        onFinish: () => {
            setCurrentUrl(url);
            window.dispatchEvent(new Event(CHANGE_EVENT));
        },
    });
}

/** true bila modal dibuka dari dalam aplikasi di sesi ini, sehingga menutup = mundur satu langkah. */
let openedInApp = false;

export function installResourceModal(): void {
    let lastHash = window.location.hash;

    window.addEventListener('popstate', (event) => {
        const path = window.location.pathname + window.location.search;
        const current = currentUrl();
        if (!current || pathOf(current) !== path) return; // pindah halaman: urusan Inertia

        event.stopImmediatePropagation();
        const hash = window.location.hash;
        if (parseResource(hash) && !parseResource(lastHash)) openedInApp = true;
        if (!parseResource(hash)) openedInApp = false;
        lastHash = hash;
        syncInertiaUrl(path + hash);
    });
}

export function openResource(type: ResourceType, id: number): void {
    window.location.hash = `${type}/${id}`;
}

export function closeResource(): void {
    if (openedInApp) {
        window.history.back();
        return;
    }
    syncInertiaUrl(window.location.pathname + window.location.search);
}

/** Ganti URL halaman saat ini menjadi alamat modal (dipakai rute lama /invoices/{id}). */
export function showResource(type: ResourceType, id: number): void {
    syncInertiaUrl(window.location.pathname.replace(/\/\d+$/, '') + window.location.search + resourceHref(type, id));
}

function subscribe(onChange: () => void): () => void {
    window.addEventListener('hashchange', onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    document.addEventListener('inertia:navigate', onChange);
    return () => {
        window.removeEventListener('hashchange', onChange);
        window.removeEventListener(CHANGE_EVENT, onChange);
        document.removeEventListener('inertia:navigate', onChange);
    };
}

/** Modal yang sedang dibuka menurut hash URL. */
export function useResource(): ResourceRef | null {
    const hash = React.useSyncExternalStore(subscribe, () => window.location.hash, () => '');
    return parseResource(hash);
}
