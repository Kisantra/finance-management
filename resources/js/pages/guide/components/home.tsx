import { Link } from '@inertiajs/react';
import { GUIDES } from '@video/registry';
import { Rich } from '@video/rich';
import { ROLES, type RoleKey, TONE_CLASS } from '@video/roles';
import { ArrowRight, CirclePlay, Search } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BTN } from '@/pages/invoices/components/ob';
import { ClipVideo, GROUPED, hasVideo, ROLE_ORDER, RoleDots, rolesOf } from './parts';

/*
 * Beranda /panduan: pernyataan + panggung video peluncuran terbaru, jalur per peran, lalu daftar isi
 * bergaya halaman isi buku (garis titik ke keterangan kanan) yang bisa disaring.
 */

/** Video peluncuran terbaru (video/launch/bank-accounts.html). Tautan modul tampil bila panduannya terdaftar. */
const FEATURE = {
    slug: 'bank-accounts',
    src: '/videos/panduan/rekening-bank.mp4',
    poster: '/videos/panduan/rekening-bank-poster.jpg',
    title: 'Rekening Bank dalam 45 detik.',
    line: 'Saldo tidak pernah diketik: aplikasi menghitungnya dari setiap transaksi.',
};

/** Ringkasan peran sesuai sistem izin (admin penuh, finance manager tanpa kelola pengguna, staff data sendiri). */
const ROLE_LINES: Record<RoleKey, string> = {
    staff: 'Karyawan yang mengajukan biaya, dana, atau kasbon, lalu memantau statusnya sampai dibayar.',
    fm: 'Mengurus uang harian: meninjau dan membayar pengajuan, mencatat pemasukan dan pengeluaran.',
    admin: 'Akses penuh, termasuk pengguna, izin, dan pengaturan — dan perlu tahu dampak setiap aksi.',
};

const rise = (ms: number) => ({ animationDelay: `${ms}ms` });

export function GuideHome() {
    const feature = GUIDES.find((g) => g.slug === FEATURE.slug);
    const videoCount = GUIDES.filter((g) => hasVideo(g.slug)).length;

    return (
        <>
            <section className="px-4 pb-4 pt-10 sm:px-6 sm:pt-16 lg:pt-20">
                <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
                    <div className="lg:col-span-5">
                        {/* Koma & titik pada huruf 800 punya ruang kiri lebar; dikerning manual agar tidak tampak "dulu ,". */}
                        <h1 className="ob-rise text-balance text-[clamp(2.5rem,5vw,4.6rem)] font-extrabold leading-[0.96] tracking-[-0.04em]">
                            Pahami sistemnya dulu<span className="-ml-[0.07em]">,</span> <span className="text-ob-ink-3">baru mulai bekerja<span className="-ml-[0.07em]">.</span></span>
                        </h1>
                        <p className="ob-rise mt-6 max-w-[46ch] text-[17px] leading-relaxed text-ob-ink-2" style={rise(70)}>
                            Panduan setiap modul Kisantra Finance: siapa melakukan apa, urutan statusnya, langkah demi langkah, dan apa yang berubah di bagian lain
                            setelah sebuah aksi. Terbuka untuk siapa saja, tanpa akun.
                        </p>
                        <div className="ob-rise mt-7 flex flex-wrap gap-2" style={rise(110)}>
                            <Button asChild className={BTN.primary}>
                                <a href="#peran">Mulai dari peran Anda</a>
                            </Button>
                            <Button asChild variant="outline" className={BTN.secondary}>
                                <a href="#daftar-isi">Daftar isi</a>
                            </Button>
                        </div>
                        <p className="ob-rise mt-6 text-[13px] text-ob-ink-3" style={rise(150)}>
                            {GUIDES.length} modul · {videoCount} dengan video per peran · {GUIDES.reduce((n, g) => n + g.tasks.length, 0)} tugas langkah demi langkah
                        </p>
                    </div>

                    <figure className="ob-rise rounded-3xl bg-ob-ink p-1.5 lg:col-span-7 dark:bg-ob-card" style={rise(160)}>
                        <ClipVideo minimal src={FEATURE.src} poster={FEATURE.poster} title={`Video: ${FEATURE.title}`} />
                        <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pb-3 pt-3.5 text-[13px] text-ob-page/70 dark:text-ob-ink-2">
                            <span>
                                <b className="font-semibold text-ob-page dark:text-ob-ink">{FEATURE.title}</b> {FEATURE.line}
                            </span>
                            {feature && (
                                <Link href={`/panduan/${feature.slug}`} className="inline-flex items-center gap-1.5 font-semibold text-ob-page hover:underline dark:text-ob-ink">
                                    Baca panduannya <ArrowRight className="h-4 w-4" />
                                </Link>
                            )}
                        </figcaption>
                    </figure>
                </div>
            </section>

            <RolePaths />
            <Contents />
        </>
    );
}

function RolePaths() {
    return (
        <section id="peran" aria-labelledby="peran-judul" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-12 lg:gap-12">
                <div className="lg:col-span-4">
                    <h2 id="peran-judul" className="text-[clamp(1.75rem,3vw,2.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
                        Mulai dari peran Anda
                    </h2>
                    <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-ob-ink-2">
                        Tombol di layar berbeda untuk tiap peran. Pilih peran Anda, dan panduan menampilkan langkah serta video dari sudut pandang itu saja.
                    </p>
                </div>
                <ol className="divide-y divide-ob-line border-y border-ob-line lg:col-span-8">
                    {ROLE_ORDER.map((key) => {
                        const role = ROLES[key];
                        const modules = GUIDES.filter((g) => g.tasks.some((t) => t.role.key === key));
                        const first = modules[0];
                        return (
                            <li key={key} className="grid gap-4 py-7 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
                                <div>
                                    <p className="flex items-center gap-2.5 text-xl font-bold tracking-[-0.01em]">
                                        <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-xs', TONE_CLASS[role.tone].dot)} />
                                        {role.label}
                                    </p>
                                    <p className="mt-2 text-[14px] leading-relaxed text-ob-ink-2">{ROLE_LINES[key]}</p>
                                </div>
                                <div className="flex min-w-0 flex-col gap-4">
                                    <p className="text-[13px] text-ob-ink-3">Punya tugas di {modules.length} modul</p>
                                    <ul className="flex flex-wrap gap-1.5">
                                        {modules.map((g) => (
                                            <li key={g.slug}>
                                                <Link
                                                    href={`/panduan/${g.slug}?peran=${key}`}
                                                    className="inline-flex rounded-full border border-ob-line bg-ob-card px-3 py-1 text-[13px] font-medium text-ob-ink transition-colors hover:border-ob-line-strong hover:bg-ob-hover"
                                                >
                                                    {g.title}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                    {first && (
                                        <Link
                                            href={`/panduan/${first.slug}?peran=${key}`}
                                            className="inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-ob-act hover:underline"
                                        >
                                            Baca sebagai {role.label} <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}

function Contents() {
    const [query, setQuery] = React.useState('');
    const q = query.trim().toLowerCase();
    const groups = GROUPED.map(({ group, items }) => ({
        group,
        items: q
            ? items.filter((g) => [g.title, g.group, g.summary, ...g.tasks.map((t) => t.title)].some((s) => s.toLowerCase().includes(q)))
            : items,
    })).filter((g) => g.items.length > 0);

    return (
        <section id="daftar-isi" aria-labelledby="isi-judul" className="scroll-mt-20 border-t border-ob-line px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto w-full max-w-7xl">
                <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                        <h2 id="isi-judul" className="text-[clamp(1.75rem,3vw,2.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
                            Daftar isi
                        </h2>
                        <p className="mt-3 text-[15px] text-ob-ink-2">{GUIDES.length} modul, dikelompokkan seperti menu di aplikasi.</p>
                    </div>
                    <div className="w-full sm:w-80">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Saring modul atau tugas"
                            aria-label="Saring daftar isi"
                            icon={<Search className="h-4 w-4" />}
                        />
                    </div>
                </div>

                {groups.length === 0 ? (
                    <EmptyState
                        title="Tidak ada modul yang cocok"
                        description={`Tidak ada modul atau tugas yang mengandung “${query.trim()}”. Coba kata lain, mis. “transfer” atau “invoice”.`}
                        action={
                            <Button variant="outline" className={BTN.secondary} onClick={() => setQuery('')}>
                                Tampilkan semua modul
                            </Button>
                        }
                    />
                ) : (
                    <div className="mt-12 gap-16 lg:columns-2">
                        {groups.map(({ group, items }) => (
                            <section key={group} aria-labelledby={`isi-${group}`} className="mb-12 break-inside-avoid">
                                <h3 id={`isi-${group}`} className="flex items-baseline justify-between border-b border-ob-line-strong pb-2 text-[13px] font-semibold text-ob-ink-2">
                                    {group}
                                    <span className="tabular-nums text-ob-ink-3">{items.length}</span>
                                </h3>
                                <ul>
                                    {items.map((g) => (
                                        <li key={g.slug} className="border-b border-ob-line-soft">
                                            <Link href={`/panduan/${g.slug}`} className="group block py-4 focus-visible:outline-none">
                                                <span className="flex items-baseline gap-3">
                                                    <span className="text-[17px] font-bold tracking-[-0.01em] transition-colors group-hover:text-ob-act group-focus-visible:text-ob-act">
                                                        {g.title}
                                                    </span>
                                                    <span aria-hidden="true" className="min-w-6 flex-1 -translate-y-1 border-b border-dotted border-ob-line-strong" />
                                                    <span className="flex shrink-0 items-center gap-3 text-xs text-ob-ink-3">
                                                        <RoleDots keys={rolesOf(g)} />
                                                        {hasVideo(g.slug) && (
                                                            <span className="inline-flex items-center gap-1">
                                                                <CirclePlay aria-hidden="true" className="h-3.5 w-3.5" />
                                                                Video
                                                            </span>
                                                        )}
                                                        <span className="tabular-nums">{g.tasks.length} tugas</span>
                                                    </span>
                                                </span>
                                                <span className="mt-1 line-clamp-2 block max-w-[62ch] text-[14px] leading-relaxed text-ob-ink-2">
                                                    <Rich text={g.summary} />
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
