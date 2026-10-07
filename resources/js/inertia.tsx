import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { trackNavigation } from './lib/navigation';
import { installResourceModal } from './lib/resource-modal';

const appName = document.querySelector<HTMLMetaElement>('meta[name="app-name"]')?.content
    ?? 'Finance Management';

trackNavigation();
// Harus sebelum createInertiaApp: listener popstate-nya perlu berjalan lebih dulu dari milik Inertia.
installResourceModal();

createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),

    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),

    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },

    progress: {
        color: '#3b82f6',
    },
});
