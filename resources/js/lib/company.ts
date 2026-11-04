import { setUrlDefaults } from '@/wayfinder';

/**
 * Konteks perusahaan aktif (slug dari URL /c/{slug}/...).
 * Di-set sekali saat boot Inertia dan disinkronkan setiap navigasi.
 */
let activeCompanySlug: string | null = null;

export function setActiveCompany(slug: string | null): void {
    activeCompanySlug = slug;
    setUrlDefaults(slug ? { company: slug } : {});
}

export function getActiveCompany(): string | null {
    return activeCompanySlug;
}

/**
 * Prefix path aplikasi dengan konteks perusahaan aktif.
 * companyUrl('/invoices') → '/c/kisantra/invoices'
 * Path central (login, choose-company) jangan lewat helper ini.
 */
export function companyUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;

    if (!activeCompanySlug || normalized.startsWith('/c/')) {
        return normalized;
    }

    return `/c/${activeCompanySlug}${normalized}`;
}

/**
 * Kupas prefix /c/{slug} dari URL — untuk mencocokkan menu aktif,
 * breadcrumb, dan logika lain yang berpikir dalam path aplikasi.
 * appPath('/c/kisantra/invoices?x=1') → '/invoices?x=1'
 */
export function appPath(url: string): string {
    return url.replace(/^\/c\/[^/]+/, '') || '/';
}

/**
 * Path yang hidup di LUAR grup /c/{company} dan karena itu tidak boleh diberi prefix.
 * Diturunkan dari keluaran `php artisan route:list` (otoritatif), bukan dari membaca
 * berkas route. Pembacaan berkas sempat salah menandai /admin/companies sebagai central
 * padahal ia berada DI DALAM grup /c/{company} — dan salah tanda di sini berarti 404.
 *
 * Perbarui dengan:
 *   php artisan route:list | grep -vE '^\s+\S+\s+c/\{company\}' 
 */
const CENTRAL_PATHS = [
    '/login',
    '/logout',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/confirm-password',
    '/verify-email',
    '/email',
    '/choose-company',
    '/panduan',
    '/language',
    // Walkthrough pemasangan baru (sebelum ada perusahaan).
    '/setup',
    // CATATAN: '/storage' sengaja TIDAK di sini. Ada dua route storage — milik vendor
    // Laravel (central, tidak dipakai aplikasi) dan 'c/{company}/storage/{path}' milik
    // TenantStorageController. Yang dipakai adalah yang tenant, jadi ia HARUS diberi prefix.
    '/tenancy',
    '/up',
    '/_inertia',
    '/_boost',
] as const;

export function isCentralPath(path: string): boolean {
    const bersih = path.split('?')[0].split('#')[0];

    return bersih === '/' || CENTRAL_PATHS.some((c) => bersih === c || bersih.startsWith(`${c}/`));
}

/**
 * Jadikan prefix perusahaan sebagai DEFAULT, bukan sesuatu yang harus diingat
 * di tiap titik panggil.
 *
 * Tanpa ini, setiap `router.get('/invoices')` di 37 berkas frontend harus diubah
 * tangan menjadi `router.get(companyUrl('/invoices'))` — dan setiap berkas yang
 * ditulis ulang di masa depan akan melewatkannya lagi, tanpa gagal compile dan
 * tanpa terlihat oleh suite test (TestCase::call() memberi prefix sendiri).
 *
 * Kegagalannya sengaja dibuat KERAS: path central yang belum terdaftar akan
 * ikut diberi prefix dan menghasilkan 404 yang langsung terlihat — bukan diam.
 */
export function installCompanyUrlPrefix(router: {
    on: (event: 'before', cb: (e: { detail: { visit: { url: URL } } }) => void) => void;
}): void {
    router.on('before', (event) => {
        const url = event.detail.visit.url;

        if (!getActiveCompany() || isCentralPath(url.pathname) || url.pathname.startsWith('/c/')) {
            return;
        }

        url.pathname = companyUrl(url.pathname);
    });
}
