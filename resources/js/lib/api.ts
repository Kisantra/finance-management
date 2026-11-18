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
    return fetch(isCentralPath(path) ? path : companyUrl(path), {
        credentials: 'same-origin',
        ...init,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...csrfHeader(),
            ...init.headers,
        },
    });
}

/**
 * Token CSRF untuk `fetch()`, diambil seperti klien HTTP Inertia: cookie `XSRF-TOKEN`.
 *
 * `<meta name="csrf-token">` hanya diisi saat muat penuh, padahal masuk/keluar akun berjalan
 * lewat kunjungan Inertia dan `session()->regenerate()` mengganti token — meta jadi basi dan
 * server membalas 419. Cookie diperbarui di setiap respons. Meta hanya cadangan bila cookie
 * tidak ada; jangan kirim keduanya: Laravel memeriksa `X-CSRF-TOKEN` lebih dulu.
 */
export function csrfHeader(): Record<string, string> {
    const cookie = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)?.[1];
    if (cookie) return { 'X-XSRF-TOKEN': decodeURIComponent(cookie) };

    return { 'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '' };
}
