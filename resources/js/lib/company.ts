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
