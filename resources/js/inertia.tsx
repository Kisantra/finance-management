import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { setActiveCompany } from '@/lib/company';

const appName = document.querySelector<HTMLMetaElement>('meta[name="app-name"]')?.content
    ?? 'Finance Management';

function syncActiveCompany(props: unknown): void {
    const company = (props as { company?: { slug?: string } | null })?.company;
    setActiveCompany(company?.slug ?? null);
}

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),

    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),

    setup({ el, App, props }) {
        syncActiveCompany(props.initialPage.props);
        router.on('navigate', (event) => syncActiveCompany(event.detail.page.props));

        const root = createRoot(el);
        root.render(<App {...props} />);
    },

    progress: {
        color: '#3b82f6',
    },
});
