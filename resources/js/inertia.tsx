import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initI18n } from '@/i18n';
import { installCompanyUrlPrefix, setActiveCompany } from '@/lib/company';
import { trackNavigation } from './lib/navigation';
import { installResourceModal } from './lib/resource-modal';

const appName = document.querySelector<HTMLMetaElement>('meta[name="app-name"]')?.content
    ?? 'Finance Management';

function syncActiveCompany(props: unknown): void {
    const company = (props as { company?: { slug?: string } | null })?.company;
    setActiveCompany(company?.slug ?? null);
}

// Prefix /c/{slug} diterapkan di satu tempat untuk SEMUA kunjungan router, bukan
// di tiap titik panggil. Dipasang sebelum createInertiaApp supaya kunjungan
// pertama pun sudah lewat.
installCompanyUrlPrefix(router);

trackNavigation();
// Harus sebelum createInertiaApp: listener popstate-nya perlu berjalan lebih dulu dari milik Inertia.
installResourceModal();

/** Bentuk modul halaman: komponen default, dengan `layout` opsional yang dipasang padanya. */
type ModulHalaman = {
    default: React.ComponentType<Record<string, never>> & {
        layout?: (page: React.ReactNode) => React.ReactNode;
    };
};

createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),

    /*
     * `.default` dibuka di sini, bukan diserahkan ke Inertia. `resolvePageComponent`
     * mengembalikan MODUL-nya, dan tipe resolver Inertia tidak memuat
     * `Promise<{ default: ... }>` — padahal runtime-nya menerimanya. Membukanya sendiri
     * membuat tipenya jujur tanpa cast, dan hasilnya identik: `layout` di repo ini
     * selalu dipasang pada komponennya (`Halaman.layout = ...`), bukan diekspor terpisah.
     */
    resolve: async (name) => {
        const modul = await resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob<ModulHalaman>('./pages/**/*.tsx'),
        );

        return modul.default;
    },

    setup({ el, App, props }) {
        syncActiveCompany(props.initialPage.props);
        router.on('navigate', (event) => syncActiveCompany(event.detail.page.props));

        // Kamus bahasa aktif dimuat SEBELUM render pertama, jadi tidak ada kilasan teks Indonesia.
        // Bahasa hanya berganti lewat muat ulang penuh (POST /language), jadi cukup sekali di sini.
        const locale = (props.initialPage.props as { locale?: string }).locale;
        // finally: halaman tetap dirender (berteks Indonesia) walau inisialisasi gagal.
        void initI18n(locale).finally(() => {
            createRoot(el).render(<App {...props} />);
        });
    },

    progress: {
        color: '#3b82f6',
    },
});
