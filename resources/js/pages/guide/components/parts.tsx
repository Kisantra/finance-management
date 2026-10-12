import { Link } from '@inertiajs/react';
import type { ModuleGuide } from '@video/guide';
import { GUIDE_GROUPS, GUIDES, TUTORIAL_LOADERS } from '@video/registry';
import { ROLES, type Role, type RoleKey, TONE_CLASS } from '@video/roles';
import { CirclePlay } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * Bagian bersama halaman /panduan publik. "Ubin" (persegi biru kecil) adalah objek benang merah video
 * peluncuran — di sini menjadi penanda posisi aktif (navigasi, daftar isi, "di halaman ini").
 */

export const ROLE_ORDER: RoleKey[] = ['staff', 'fm', 'admin'];

export const GROUPED = GUIDE_GROUPS.map((group) => ({ group, items: GUIDES.filter((g) => g.group === group) })).filter((g) => g.items.length > 0);

export const hasVideo = (slug: string) => Boolean(TUTORIAL_LOADERS[slug]);

/** Peran yang muncul di modul (kartu peran + tugas), urut Staff → Admin. */
export function rolesOf(guide: ModuleGuide): RoleKey[] {
    const keys = new Set<RoleKey>([...guide.roles.map((r) => r.role.key), ...guide.tasks.map((t) => t.role.key)]);
    return ROLE_ORDER.filter((k) => keys.has(k));
}

const slugify = (s: string) =>
    s
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

export const taskAnchor = (title: string) => `tugas-${slugify(title)}`;

/** Geser wadah yang menggulir ke samping agar elemen terpilih berada di tengah (tanpa menggulir halaman). */
export function centerChecked(container: HTMLElement | null, selector: string) {
    const el = container?.querySelector<HTMLElement>(selector);
    if (!container || !el || container.scrollWidth <= container.clientWidth) return;
    container.scrollLeft = el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2;
}

/** Penanda posisi aktif: ubin biru 8 px. Saat tidak aktif tetap memakan tempat agar teks tidak bergeser. */
export function Tile({ on = true, className }: { on?: boolean; className?: string }) {
    return <span aria-hidden="true" className={cn('inline-block h-2 w-2 shrink-0 rounded-xs bg-ob-act-fill transition-opacity', on ? 'opacity-100' : 'opacity-0', className)} />;
}

export function RoleTag({ role, className }: { role: Role; className?: string }) {
    const tone = TONE_CLASS[role.tone];
    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', tone.chip, className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
            {role.label}
        </span>
    );
}

/** Tiga titik peran (Staff · FM · Admin): terisi = peran itu punya tugas/peran di modul. */
export function RoleDots({ keys }: { keys: RoleKey[] }) {
    return (
        <span className="inline-flex items-center gap-1">
            <span className="sr-only">Peran: {keys.map((k) => ROLES[k].label).join(', ')}</span>
            {ROLE_ORDER.map((k) => (
                <span
                    key={k}
                    aria-hidden="true"
                    className={cn('h-2 w-2 rounded-full', keys.includes(k) ? TONE_CLASS[ROLES[k].tone].dot : 'border border-ob-line-strong')}
                />
            ))}
        </span>
    );
}

/** Daftar modul per kelompok — rel kiri halaman modul dan menu ponsel. */
export function ModuleNav({ current, className }: { current?: string | null; className?: string }) {
    return (
        <nav aria-label="Daftar modul" className={cn('flex flex-col gap-6 text-sm', className)}>
            <Link
                href="/panduan"
                aria-current={!current ? 'page' : undefined}
                className={cn('flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition-colors', !current ? 'font-semibold text-ob-ink' : 'text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink')}
            >
                <Tile on={!current} />
                Semua modul
            </Link>
            {GROUPED.map(({ group, items }) => (
                <div key={group}>
                    <p className="mb-1.5 px-3 text-xs font-semibold text-ob-ink-3">{group}</p>
                    <ul className="flex flex-col">
                        {items.map((g) => {
                            const on = current === g.slug;
                            return (
                                <li key={g.slug}>
                                    <Link
                                        href={`/panduan/${g.slug}`}
                                        aria-current={on ? 'page' : undefined}
                                        className={cn(
                                            'flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition-colors',
                                            on ? 'font-semibold text-ob-ink' : 'text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink',
                                        )}
                                    >
                                        <Tile on={on} />
                                        <span className="min-w-0 flex-1 truncate">{g.title}</span>
                                        {hasVideo(g.slug) && <CirclePlay aria-label="Ada video" className="h-3.5 w-3.5 shrink-0 text-ob-ink-3" />}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

/**
 * Video MP4 (mis. video peluncuran). `minimal`: kontrol putar/suara sendiri, putar otomatis tanpa suara
 * berulang (kecuali pengguna memilih gerak dikurangi). `native`: kontrol bawaan browser.
 */
export function ClipVideo({ src, poster, title, minimal = false, className }: { src: string; poster: string; title: string; minimal?: boolean; className?: string }) {
    const ref = React.useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = React.useState(false);
    const [muted, setMuted] = React.useState(true);

    React.useEffect(() => {
        if (!minimal || !ref.current) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        ref.current.play().catch(() => setPlaying(false));
    }, [minimal]);

    return (
        <div className={cn('relative overflow-hidden rounded-2xl bg-ob-page', className)}>
            <video
                ref={ref}
                src={src}
                poster={poster}
                muted={muted}
                loop={minimal}
                playsInline
                preload="metadata"
                controls={!minimal}
                aria-label={title}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="block aspect-video w-full"
            />
            {minimal && (
                <ClipControls
                    playing={playing}
                    muted={muted}
                    onToggle={() => (ref.current?.paused ? ref.current.play() : ref.current?.pause())}
                    onMute={() => setMuted((m) => !m)}
                />
            )}
        </div>
    );
}

function ClipControls({ playing, muted, onToggle, onMute }: { playing: boolean; muted: boolean; onToggle: () => void; onMute: () => void }) {
    // Menempel di atas video (yang selalu terang), jadi tetap gelap di kedua tema.
    const btn =
        'flex h-9 items-center gap-2 rounded-full bg-black/70 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-black/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill dark:bg-black/70 dark:text-white dark:hover:bg-black/85';
    return (
        <div className="absolute bottom-3 left-3 flex gap-1.5 sm:bottom-4 sm:left-4">
            <Button type="button" variant="ghost" onClick={onToggle} className={btn} aria-label={playing ? 'Jeda video' : 'Putar video'}>
                {playing ? (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                        <rect x="3" y="2" width="3.5" height="12" rx="1" />
                        <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                        <path d="M4 2.6v10.8a.8.8 0 0 0 1.2.7l8.6-5.4a.8.8 0 0 0 0-1.4L5.2 1.9A.8.8 0 0 0 4 2.6Z" />
                    </svg>
                )}
                {playing ? 'Jeda' : 'Putar'}
            </Button>
            <Button type="button" variant="ghost" onClick={onMute} className={btn} aria-pressed={!muted}>
                {muted ? 'Nyalakan suara' : 'Matikan suara'}
            </Button>
        </div>
    );
}
