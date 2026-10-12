import { Link, usePage } from '@inertiajs/react';
import type { GuideFlow, ModuleGuide } from '@video/guide';
import { GUIDES } from '@video/registry';
import { Rich } from '@video/rich';
import { ROLES, type RoleKey, TONE_CLASS } from '@video/roles';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CornerDownRight, Minus, TriangleAlert, X } from 'lucide-react';
import * as React from 'react';
import { StatusPill } from '@/components/dashboard/widget';
import { TutorialVideosLazy } from '@/components/tutorial/tutorial-button';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { BTN } from '@/pages/invoices/components/ob';
import type { SharedProps } from '@/types';
import { centerChecked, ClipVideo, hasVideo, ModuleNav, ROLE_ORDER, RoleTag, rolesOf, taskAnchor, Tile } from './parts';

/*
 * Halaman satu modul: rel modul (kiri), artikel, "Di halaman ini" (kanan, mengikuti gulir).
 * "Baca sebagai" = lensa peran: menyaring tugas, memilih tab video, dan meredupkan bagian peran lain.
 * Lensa tersimpan di ?peran=… agar tautan bisa dibagikan.
 */

type Lens = 'all' | RoleKey;

const rise = (ms: number) => ({ animationDelay: `${ms}ms` });

function useLens(available: RoleKey[]): [Lens, (lens: Lens) => void] {
    const [lens, setLensState] = React.useState<Lens>(() => {
        const wanted = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('peran');
        return wanted && available.includes(wanted as RoleKey) ? (wanted as RoleKey) : 'all';
    });
    const setLens = (next: Lens) => {
        setLensState(next);
        const url = new URL(window.location.href);
        if (next === 'all') url.searchParams.delete('peran');
        else url.searchParams.set('peran', next);
        window.history.replaceState(window.history.state, '', url);
    };
    return [lens, setLens];
}

/** Bagian yang sedang dibaca: judul bagian teratas yang melewati garis ±1/3 layar. */
function useActiveSection(ids: string[]): string | undefined {
    const [active, setActive] = React.useState<string | undefined>(ids[0]);
    const key = ids.join('|');
    React.useEffect(() => {
        const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
        const observer = new IntersectionObserver(
            (entries) => {
                const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (hit) setActive(hit.target.id);
            },
            { rootMargin: '-120px 0px -62% 0px' },
        );
        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return active;
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section id={id} aria-labelledby={`${id}-judul`} className="scroll-mt-20 pt-16">
            <h2 id={`${id}-judul`} className="text-[1.625rem] font-extrabold leading-tight tracking-[-0.025em]">
                {title}
            </h2>
            {lead && <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ob-ink-2">{lead}</p>}
            <div className="mt-6">{children}</div>
        </section>
    );
}

export function GuideArticle({ guide }: { guide: ModuleGuide }) {
    const { auth } = usePage<SharedProps>().props;
    const roleKeys = rolesOf(guide);
    const [lens, setLens] = useLens(roleKeys);
    const inLens = (key: RoleKey) => lens === 'all' || lens === key;
    const tasks = guide.tasks.filter((t) => inLens(t.role.key));
    const showVideo = hasVideo(guide.slug) || Boolean(guide.overview);

    const position = GUIDES.findIndex((g) => g.slug === guide.slug);
    const prev = GUIDES[position - 1];
    const next = GUIDES[position + 1];
    const lensQuery = lens === 'all' ? '' : `?peran=${lens}`;

    const sections = [
        showVideo && { id: 'video', label: 'Video' },
        { id: 'peran-modul', label: 'Siapa melakukan apa' },
        guide.flow && { id: 'alur', label: 'Alur status' },
        { id: 'tugas', label: 'Cara melakukan' },
        guide.impacts?.length && { id: 'dampak', label: 'Dampak ke modul lain' },
        guide.records?.length && { id: 'data-otomatis', label: 'Data yang dibuat otomatis' },
        guide.warnings?.length && { id: 'perhatian', label: 'Perhatian' },
    ].filter(Boolean) as { id: string; label: string }[];
    const active = useActiveSection(sections.map((s) => s.id));

    // Di layar sempit bar lensa menggulir ke samping: pastikan pilihan aktif terlihat (mis. datang dari ?peran=fm).
    const lensBar = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => centerChecked(lensBar.current, '[aria-checked="true"]'), [lens]);

    // Datang dari pencarian (…#tugas-x): gulir ke tugasnya setelah isi terpasang.
    React.useEffect(() => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    }, []);

    return (
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:pt-12 xl:grid-cols-[13.5rem_minmax(0,1fr)_12rem] xl:gap-12">
            <aside className="hidden lg:block">
                <div className="ob-no-scrollbar sticky top-24 max-h-[calc(100dvh-7.5rem)] overflow-y-auto pb-8">
                    <ModuleNav current={guide.slug} />
                </div>
            </aside>

            <article className="min-w-0 max-w-200">
                <nav aria-label="Lokasi" className="ob-rise flex items-center gap-2 text-[13px] text-ob-ink-3">
                    <Link href="/panduan" className="transition-colors hover:text-ob-ink">
                        Panduan
                    </Link>
                    <span aria-hidden="true">/</span>
                    <span>{guide.group}</span>
                </nav>
                <h1 className="ob-rise mt-3 text-balance text-[clamp(2.25rem,4.4vw,3.6rem)] font-extrabold leading-none tracking-[-0.035em]" style={rise(40)}>
                    {guide.title}
                </h1>
                <p className="ob-rise mt-5 max-w-[62ch] text-[17px] leading-relaxed text-ob-ink-2" style={rise(80)}>
                    <Rich text={guide.summary} />
                </p>
                <div className="ob-rise mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px] text-ob-ink-2" style={rise(120)}>
                    <span className="flex flex-wrap items-center gap-1.5">
                        {roleKeys.map((k) => (
                            <RoleTag key={k} role={ROLES[k]} />
                        ))}
                    </span>
                    <span className="tabular-nums">{guide.tasks.length} tugas</span>
                    <Link href={guide.path} className="inline-flex items-center gap-1 font-semibold text-ob-act hover:underline">
                        {auth?.user ? `Buka ${guide.title}` : `Masuk untuk membuka ${guide.title}`}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {roleKeys.length > 1 && (
                    <div className="sticky top-16 z-20 -mx-4 mt-8 border-b border-ob-line bg-ob-page px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                        <div role="group" aria-labelledby="lensa-judul" className="flex items-center gap-3">
                            <span id="lensa-judul" className="shrink-0 text-[13px] font-medium text-ob-ink-2">
                                Baca sebagai
                            </span>
                            <div ref={lensBar} className="ob-no-scrollbar relative min-w-0 overflow-x-auto">
                                <SegmentedControl<Lens>
                                    variant="pill"
                                    className="w-max"
                                    value={lens}
                                    onChange={setLens}
                                    options={[{ value: 'all', label: 'Semua' }, ...roleKeys.map((k) => ({ value: k as Lens, label: ROLES[k].label }))]}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {showVideo && (
                    <Section
                        id="video"
                        title="Video"
                        lead={
                            guide.overview
                                ? `Mulai dari Sekilas (${guide.overview.seconds} detik), lalu pilih peran untuk melihat alur dan contoh pengisian di setiap layar.`
                                : 'Pilih peran untuk melihat alur dan contoh pengisian di setiap layar.'
                        }
                    >
                        <div className="rounded-3xl border border-ob-line bg-ob-card p-3 sm:p-5">
                            {hasVideo(guide.slug) ? (
                                <TutorialVideosLazy
                                    key={lens}
                                    slug={guide.slug}
                                    roleKeys={ROLE_ORDER}
                                    initial={lens === 'all' ? undefined : lens}
                                    leading={
                                        guide.overview && {
                                            key: 'sekilas',
                                            label: 'Sekilas',
                                            meta: `${guide.overview.seconds} dtk`,
                                            render: () => (
                                                <ClipVideo src={guide.overview!.src} poster={guide.overview!.poster} title={`Sekilas ${guide.title}`} className="border border-ob-line" />
                                            ),
                                        }
                                    }
                                />
                            ) : (
                                guide.overview && <ClipVideo src={guide.overview.src} poster={guide.overview.poster} title={`Sekilas ${guide.title}`} />
                            )}
                        </div>
                    </Section>
                )}

                <Section id="peran-modul" title="Siapa melakukan apa" lead="Hak akses bawaan setiap peran. Admin dapat mengubahnya di Pengguna & Izin.">
                    <div
                        className={cn(
                            'grid overflow-hidden rounded-3xl border border-ob-line bg-ob-card',
                            guide.roles.length >= 3 ? 'md:grid-cols-3' : guide.roles.length === 2 && 'md:grid-cols-2',
                        )}
                    >
                        {guide.roles.map((card, i) => (
                            <div
                                key={card.role.key}
                                className={cn(
                                    'flex flex-col gap-4 p-6 transition-opacity duration-200',
                                    i > 0 && 'border-t border-ob-line md:border-l md:border-t-0',
                                    !inLens(card.role.key) && 'opacity-35',
                                )}
                            >
                                <div>
                                    <RoleTag role={card.role} />
                                    <p className="mt-3 text-[17px] font-bold leading-snug tracking-[-0.01em]">{card.who}</p>
                                </div>
                                <ul className="flex flex-col gap-2.5 text-[14px] leading-snug">
                                    {card.can.map((t) => (
                                        <li key={t} className="flex gap-2.5">
                                            <Check aria-label="Bisa" className="mt-0.5 h-4 w-4 shrink-0 text-ob-pos" strokeWidth={2.5} />
                                            <span>
                                                <Rich text={t} />
                                            </span>
                                        </li>
                                    ))}
                                    {card.cannot?.map((t) => (
                                        <li key={t} className="flex gap-2.5 text-ob-ink-3">
                                            <Minus aria-label="Tidak bisa" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                                            <span>
                                                <Rich text={t} />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {guide.matrix && guide.matrixRoles && (
                        <div className="relative mt-6 overflow-x-auto rounded-3xl border border-ob-line bg-ob-card">
                            <table className="w-full min-w-136 text-[14px]">
                                <caption className="sr-only">Ringkasan hak akses {guide.title}</caption>
                                <thead>
                                    <tr className="border-b border-ob-line text-left">
                                        <th scope="col" className="px-6 py-3.5 text-xs font-semibold text-ob-ink-3">
                                            Aksi
                                        </th>
                                        {guide.matrixRoles.map((r) => (
                                            <th key={r.key} scope="col" className={cn('px-4 py-3.5 text-center transition-opacity', !inLens(r.key) && 'opacity-35')}>
                                                <RoleTag role={r} />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {guide.matrix.map((row) => (
                                        <tr key={row.action} className="border-b border-ob-line-soft last:border-b-0">
                                            <th scope="row" className="px-6 py-3 text-left font-medium">
                                                {row.action}
                                            </th>
                                            {row.cells.map((cell, i) => (
                                                <td key={i} className={cn('px-4 py-3 text-center text-ob-ink-2 transition-opacity', !inLens(guide.matrixRoles![i].key) && 'opacity-35')}>
                                                    {cell === true ? (
                                                        <Check className="mx-auto h-4 w-4 text-ob-pos" strokeWidth={2.5} aria-label="Bisa" />
                                                    ) : cell === false ? (
                                                        <X className="mx-auto h-4 w-4 text-ob-ink-3" aria-label="Tidak bisa" />
                                                    ) : (
                                                        cell
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Section>

                {guide.flow && (
                    <Section id="alur" title="Alur status" lead="Setiap status menunjukkan siapa yang bertindak berikutnya.">
                        <FlowTrack flow={guide.flow} lens={lens} />
                    </Section>
                )}

                <Section id="tugas" title="Cara melakukan" lead={lens === 'all' ? 'Langkah demi langkah, persis dengan label di layar.' : `Hanya tugas ${ROLES[lens].label}.`}>
                    {tasks.length === 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ob-inner p-5 text-[15px] text-ob-ink-2">
                            <span>{lens !== 'all' && ROLES[lens].label} tidak punya tugas di modul ini.</span>
                            <Button variant="outline" className={BTN.small} onClick={() => setLens('all')}>
                                Tampilkan semua peran
                            </Button>
                        </div>
                    ) : (
                        <div className="border-t border-ob-line">
                            {tasks.map((task) => (
                                <article key={task.title} id={taskAnchor(task.title)} className="scroll-mt-36 border-b border-ob-line py-8">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <h3 className="text-[19px] font-bold leading-snug tracking-[-0.015em]">{task.title}</h3>
                                        <RoleTag role={task.role} />
                                    </div>
                                    <ol className="mt-5 flex flex-col gap-4">
                                        {task.steps.map((step, i) => (
                                            <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 text-[15px] leading-relaxed text-ob-ink-2">
                                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ob-chip text-[12px] font-bold tabular-nums text-ob-ink">{i + 1}</span>
                                                <span className="pt-0.5">
                                                    <Rich text={step} />
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </article>
                            ))}
                        </div>
                    )}
                </Section>

                {guide.impacts && guide.impacts.length > 0 && (
                    <Section id="dampak" title="Dampak ke modul lain" lead="Apa yang berubah dengan sendirinya di bagian lain aplikasi setelah sebuah aksi — paling penting dipahami Admin.">
                        <div className="divide-y divide-ob-line border-y border-ob-line">
                            {guide.impacts.map((impact) => (
                                <div key={impact.title} className="grid gap-3 py-6 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:gap-8">
                                    <p className="flex items-baseline gap-2.5 self-start font-bold leading-snug">
                                        <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 -translate-y-px rounded-xs', TONE_CLASS[impact.tone].dot)} />
                                        {impact.title}
                                    </p>
                                    <ul className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-ob-ink-2">
                                        {impact.items.map((item) => (
                                            <li key={item} className="flex gap-2.5">
                                                <ArrowRight aria-hidden="true" className="mt-[0.4rem] h-3.5 w-3.5 shrink-0 text-ob-ink-3" />
                                                <span>
                                                    <Rich text={item} />
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {guide.records && guide.records.length > 0 && (
                    <Section id="data-otomatis" title="Data yang dibuat otomatis" lead="Isi catatan yang dibuat aplikasi tanpa diketik, dan dari mana setiap kolom berasal.">
                        <div className="flex flex-col gap-10">
                            {guide.records.map((record) => (
                                <div key={record.title}>
                                    <h3 className="text-[17px] font-bold tracking-[-0.01em]">{record.title}</h3>
                                    {record.subtitle && <p className="mt-1 text-[14px] text-ob-ink-2">{record.subtitle}</p>}
                                    <div className="relative mt-4 overflow-x-auto rounded-3xl border border-ob-line bg-ob-card">
                                        <table className="w-full min-w-136 text-[14px]">
                                            <caption className="sr-only">{record.title}</caption>
                                            <thead>
                                                <tr className="border-b border-ob-line text-left text-xs font-semibold text-ob-ink-3">
                                                    <th scope="col" className="px-6 py-3.5 font-semibold">
                                                        Kolom
                                                    </th>
                                                    <th scope="col" className="px-4 py-3.5 font-semibold">
                                                        Contoh isi
                                                    </th>
                                                    <th scope="col" className="px-6 py-3.5 text-right font-semibold">
                                                        Asal data
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {record.rows.map((row) => (
                                                    <tr key={row.label} className="border-b border-ob-line-soft last:border-b-0">
                                                        <th scope="row" className="px-6 py-3 text-left font-normal text-ob-ink-2">
                                                            {row.label}
                                                        </th>
                                                        <td className="px-4 py-3 font-medium tabular-nums">{row.value}</td>
                                                        <td className="px-6 py-3 text-right">
                                                            <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE_CLASS[row.tone ?? 'neutral'].chip)}>{row.source}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {record.note && (
                                        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-ob-ink-2">
                                            <Rich text={record.note} />
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {guide.warnings && guide.warnings.length > 0 && (
                    <Section id="perhatian" title="Perhatian">
                        <ul className="divide-y divide-ob-wait/15 rounded-3xl bg-ob-wait/8 px-5 sm:px-6">
                            {guide.warnings.map((w) => (
                                <li key={w.title} className="flex gap-4 py-5">
                                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ob-wait" />
                                    <div className="min-w-0">
                                        <p className="font-bold leading-snug">{w.title}</p>
                                        <p className="mt-1 text-[15px] leading-relaxed text-ob-ink-2">
                                            <Rich text={w.body} />
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                <nav aria-label="Modul lain" className="mt-20 grid gap-3 sm:grid-cols-2">
                    {prev ? (
                        <Link href={`/panduan/${prev.slug}${lensQuery}`} className="group flex flex-col gap-1 rounded-2xl border border-ob-line p-5 transition-colors hover:bg-ob-hover">
                            <span className="flex items-center gap-1.5 text-[13px] text-ob-ink-3">
                                <ArrowLeft className="h-3.5 w-3.5" /> Sebelumnya
                            </span>
                            <span className="text-[17px] font-bold tracking-[-0.01em]">{prev.title}</span>
                        </Link>
                    ) : (
                        <span className="hidden sm:block" />
                    )}
                    {next && (
                        <Link href={`/panduan/${next.slug}${lensQuery}`} className="group flex flex-col gap-1 rounded-2xl border border-ob-line p-5 transition-colors hover:bg-ob-hover sm:items-end sm:text-right">
                            <span className="flex items-center gap-1.5 text-[13px] text-ob-ink-3">
                                Berikutnya <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[17px] font-bold tracking-[-0.01em]">{next.title}</span>
                        </Link>
                    )}
                </nav>
            </article>

            <aside className="hidden xl:block">
                <div className="sticky top-24">
                    <p className="mb-3 text-xs font-semibold text-ob-ink-3">Di halaman ini</p>
                    <ul className="flex flex-col gap-0.5 text-[13px]">
                        {sections.map((s) => (
                            <li key={s.id}>
                                <a
                                    href={`#${s.id}`}
                                    aria-current={active === s.id ? 'location' : undefined}
                                    className={cn('flex items-center gap-2.5 py-1 transition-colors', active === s.id ? 'font-semibold text-ob-ink' : 'text-ob-ink-3 hover:text-ob-ink')}
                                >
                                    <Tile on={active === s.id} />
                                    {s.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>
        </div>
    );
}

/** Alur status sebagai lintasan bernomor (urutan nyata). Langkah milik peran di lensa disorot dengan ubin biru. */
function FlowTrack({ flow, lens }: { flow: GuideFlow; lens: Lens }) {
    const steps = flow.steps;
    return (
        <div className="flex flex-col gap-6">
            <div className="ob-no-scrollbar overflow-x-auto">
                {/* Langkah membagi lebar kolom (min 10 rem); hanya alur yang sangat panjang yang menggulir. */}
                <ol className="flex flex-col md:flex-row">
                    {steps.map((step, i) => {
                        const mine = lens !== 'all' && step.role.key === lens;
                        const dim = lens !== 'all' && step.role.key !== lens;
                        const last = i === steps.length - 1;
                        return (
                            <li key={step.label} className="relative flex gap-4 pb-8 last:pb-0 md:min-w-40 md:flex-1 md:flex-col md:gap-4 md:pb-0 md:pr-5 md:last:pr-0">
                                {!last && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute left-3.5 top-8 bottom-0 w-px bg-ob-line-strong md:left-8 md:right-0 md:top-3.5 md:bottom-auto md:h-px md:w-auto"
                                    />
                                )}
                                <span
                                    className={cn(
                                        'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums transition-colors',
                                        mine ? 'bg-ob-act-fill text-white' : 'border border-ob-line-strong bg-ob-page text-ob-ink',
                                    )}
                                >
                                    {i + 1}
                                </span>
                                <div className={cn('flex min-w-0 flex-col items-start gap-2 transition-opacity duration-200', dim && 'opacity-35')}>
                                    <StatusPill tone={step.tone}>{step.label}</StatusPill>
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ob-ink-2">
                                        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', TONE_CLASS[step.role.tone].dot)} />
                                        {step.role.label}
                                    </span>
                                    <p className="text-[14px] leading-snug text-ob-ink-2">{step.what}</p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {flow.branch && (
                <div className="flex gap-3 rounded-2xl bg-ob-inner p-5 text-[14px] leading-relaxed">
                    <CornerDownRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-ob-ink-3" />
                    <div className="flex min-w-0 flex-col gap-2">
                        <p className="flex flex-wrap items-center gap-2">
                            <span className="text-ob-ink-2">Dari</span>
                            <StatusPill tone={steps[flow.branch.from].tone}>{steps[flow.branch.from].label}</StatusPill>
                            <span className="text-ob-ink-2">bisa menjadi</span>
                            <StatusPill tone={flow.branch.tone}>{flow.branch.label}</StatusPill>
                            <span className="font-semibold">— {flow.branch.title}</span>
                        </p>
                        <p className="text-ob-ink-2">
                            {flow.branch.down}.{flow.branch.up && ` ${flow.branch.up}.`}
                        </p>
                    </div>
                </div>
            )}

            {flow.note && (
                <p className="max-w-[62ch] text-[14px] leading-relaxed text-ob-ink-2">
                    <Rich text={flow.note} />
                </p>
            )}
        </div>
    );
}
