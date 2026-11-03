import { companyUrl, isCentralPath } from './company';

/**
 * `fetch()` yang sadar perusahaan.
 *
 * Path aplikasi otomatis diberi prefix `/c/{slug}`; path central dibiarkan apa adanya.
 * Interceptor router Inertia tidak menyentuh `fetch()` — tanpa pembungkus ini setiap
 * panggilan harus mengingat `companyUrl()` sendiri, dan yang lupa gagal SENYAP (404
 * atau, lebih buruk, resolve ke perusahaan lain).
 *
 * Header JSON + CSRF + cookie sesi sudah terpasang; `init.headers` menimpanya.
 * Jangan set `Content-Type` saat body-nya `FormData` — biarkan browser yang isi.
 */
export function api(path: string, init: RequestInit = {}): Promise<Response> {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

    return fetch(isCentralPath(path) ? path : companyUrl(path), {
        credentials: 'same-origin',
        ...init,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': csrf,
            ...init.headers,
        },
    });
}
