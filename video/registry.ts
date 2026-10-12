/// <reference types="vite/client" />
import type { Tutorials } from './components/tutorial';
import type { ModuleGuide } from './guide';

/*
 * Daftar modul berpanduan — ditemukan otomatis dari folder video/<slug>/ (nama folder = slug):
 *   guide.ts    → GUIDES (teks, dimuat langsung oleh /panduan)
 *   tutorial.tsx → TUTORIAL_LOADERS (video, dimuat lazy agar Remotion hanya diunduh saat diputar)
 * Modul baru cukup membuat foldernya; tidak ada daftar bersama yang perlu diedit.
 * (Hanya untuk Vite/aplikasi; Remotion Studio memakai require.context di Root.tsx.)
 */

/** Urutan kelompok mengikuti rel navigasi. */
export const GUIDE_GROUPS = ['Ringkasan', 'Keuangan', 'Arus Kas', 'Operasional', 'Utang & Piutang', 'Master Data', 'Laporan', 'Administrasi', 'Pengaturan'];

const guideModules = import.meta.glob<{ guide: ModuleGuide }>('./*/guide.ts', { eager: true });
const tutorialModules = import.meta.glob<{ TUTORIALS: Tutorials }>('./*/tutorial.tsx');

const rank = (g: ModuleGuide) => GUIDE_GROUPS.indexOf(g.group) * 1000 + (g.order ?? 100);

export const GUIDES: ModuleGuide[] = Object.values(guideModules)
    .map((m) => m.guide)
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));

export const TUTORIAL_LOADERS: Record<string, () => Promise<Tutorials>> = Object.fromEntries(
    Object.entries(tutorialModules)
        .filter(([path]) => !path.startsWith('./components/'))
        .map(([path, load]) => [path.split('/')[1], () => load().then((m) => m.TUTORIALS)]),
);
