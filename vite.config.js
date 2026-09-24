import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const hmrHost = env.VITE_HMR_HOST || null;

    return {
        plugins: [
            laravel({
                input: [
                    'resources/css/app.css',
                    'resources/js/inertia.tsx',
                ],
                refresh: true,
            }),
            react(),
            wayfinder(),
            tailwindcss(),
        ],
        build: {
            chunkSizeWarningLimit: 1500,
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './resources/js'),
            },
        },
    };
});
