import path from 'node:path';
import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind-v4';

/*
 * Video tutorial (Remotion). Studio: `npm run video` · render: `npm run video:render -- <id>`.
 * Alias `@` sama dengan vite.config.ts supaya komponen aplikasi (resources/js) bisa dipakai di video.
 */
Config.setEntryPoint('video/index.ts');
Config.setOutputLocation('out/video.mp4');
/** Folder staticFile() sendiri — public/ Laravel berisi symlink storage yang gagal disalin bundler. */
Config.setPublicDir('video/public');
/** Cache webpack rusak (WasmHash `data.length`) bila file di video/ dipindah/dihapus — bundle selalu bersih. */
Config.setCachingEnabled(false);

Config.overrideBundlerConfig((current) => {
    const config = enableTailwind(current);

    return {
        ...config,
        resolve: {
            ...config.resolve,
            alias: {
                ...config.resolve?.alias,
                '@': path.resolve(process.cwd(), 'resources/js'),
            },
        },
    };
});
