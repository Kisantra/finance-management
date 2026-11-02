import { Head } from '@inertiajs/react';
import { GUIDES } from '@video/registry';
import * as React from 'react';
import { GuideArticle } from './components/article';
import { GuideHome } from './components/home';
import { GuideShell } from './components/shell';

/*
 * Panduan pengguna (/panduan/{slug?}) — halaman PUBLIK. Isinya dari video/<modul>/guide.ts (sumber yang
 * sama dengan video tutorial), jadi teks dan video tidak bisa saling bertentangan. Semua orang, login
 * atau tidak, melihat isi dan kerangka yang sama (components/shell.tsx); hanya tombol kanan yang beda.
 */
export default function GuidePage({ slug }: { slug: string | null }) {
    const current = GUIDES.find((g) => g.slug === slug) ?? null;

    return (
        <>
            <Head title={current ? `${current.title} · Panduan` : 'Panduan'} />
            {current ? <GuideArticle key={current.slug} guide={current} /> : <GuideHome />}
        </>
    );
}

GuidePage.layout = (page: React.ReactNode) => <GuideShell>{page}</GuideShell>;
