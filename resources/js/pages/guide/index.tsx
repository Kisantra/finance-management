import { Head, Link, router, usePage } from '@inertiajs/react';
import type { ModuleGuide } from '@video/guide';
import { GUIDE_GROUPS, GUIDES, TUTORIAL_LOADERS } from '@video/registry';
import { Rich } from '@video/rich';
import { type Role, TONE_CLASS } from '@video/roles';
import { ArrowRight, BookOpen, Check, ChevronRight, CirclePlay, ExternalLink, Minus, TriangleAlert, X } from 'lucide-react';
import * as React from 'react';
import { StatusPill } from '@/components/dashboard/widget';
import { TutorialVideosLazy } from '@/components/tutorial/tutorial-button';
import { canViewGuide, seesInsights, visibleRoleKeys } from '@/components/tutorial/access';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { AppLayout } from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BTN, CARD } from '@/pages/invoices/components/ob';
import type { SharedProps } from '@/types';

/*
 * Panduan pengguna per modul (/panduan/{slug}). Isinya dari video/<modul>/guide.ts — sumber yang
 * sama dengan video tutorial — jadi teks halaman dan video tidak bisa saling bertentangan.
 * Modul tampil sesuai izin "view"-nya; bagian dampak/data otomatis/perhatian hanya untuk insightRoles.
 */

function RoleChip({ role, className }: { role: Role; className?: string }) {
    const tone = TONE_CLASS[role.tone];
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', tone.chip, className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
            {role.label}
        </span>
    );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3">
            <div className="px-1">
                <h2 id={id} className="text-lg font-semibold text-ob-ink">
                    {title}
                </h2>
                {description && <p className="mt-0.5 text-[13px] text-ob-ink-2">{description}</p>}
            </div>
            {children}
        </section>
    );
}

export default function GuidePage({ slug }: { slug: string | null }) {
    const { props } = usePage<SharedProps>();
    const permissions: string[] = props.auth?.permissions ?? [];
    const roles: string[] = (props.auth as { roles?: string[] })?.roles ?? [];

    const guides = GUIDES.filter((g) => canViewGuide(g, permissions));
    const groups = GUIDE_GROUPS.map((group) => ({ group, items: guides.filter((g) => g.group === group) })).filter((g) => g.items.length > 0);
    const current = guides.find((g) => g.slug === slug) ?? null;

    return (
        <>
            <Head title={current ? `Panduan ${current.title}` : 'Panduan'} />
            <div className="mx-auto flex w-full max-w-[1120px] gap-8">
                <nav aria-label="Modul panduan" className="sticky top-4 hidden max-h-[calc(100dvh-7rem)] w-56 shrink-0 self-start overflow-y-auto lg:block">
                    <Link
                        href="/panduan"
                        className={cn('mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors', !current ? 'bg-ob-invert text-ob-invert-ink' : 'text-ob-ink hover:bg-ob-hover')}
                    >
                        <BookOpen className="h-4 w-4" /> Semua modul
                    </Link>
                    {groups.map(({ group, items }) => (
                        <div key={group} className="mb-3">
                            <p className="px-3 pb-1 text-xs font-semibold text-ob-ink-3">{group}</p>
                            {items.map((g) => (
                                <Link
                                    key={g.slug}
                                    href={`/panduan/${g.slug}`}
                                    aria-current={current?.slug === g.slug ? 'page' : undefined}
                                    className={cn(
                                        'flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-[13px] transition-colors',
                                        current?.slug === g.slug ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink',
                                    )}
                                >
                                    {g.title}
                                    {TUTORIAL_LOADERS[g.slug] && <CirclePlay className="h-3.5 w-3.5 shrink-0 opacity-60" aria-label="Ada video" />}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="flex min-w-0 max-w-full flex-1 flex-col gap-8 pb-10">
                    <div className="lg:hidden">
                        <Combobox
                            label="Modul"
                            options={[{ value: '', label: 'Semua modul' }, ...guides.map((g) => ({ value: g.slug, label: `${g.group} › ${g.title}` }))]}
                            value={current?.slug ?? ''}
                            onChange={(v) => router.visit(v ? `/panduan/${v}` : '/panduan')}
                            placeholder="Pilih modul"
                        />
                    </div>
                    {current ? <ModuleView guide={current} roles={roles} /> : <IndexView groups={groups} />}
                </div>
            </div>
        </>
    );
}

function IndexView({ groups }: { groups: { group: string; items: ModuleGuide[] }[] }) {
    return (
        <>
            <div>
                <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">Panduan</h1>
                <p className="mt-1 max-w-[65ch] text-sm text-ob-ink-2">
                    Cara kerja setiap modul: siapa melakukan apa, alurnya, langkah-langkahnya, dan apa dampaknya ke bagian lain aplikasi. Modul yang tampil
                    menyesuaikan izin akun Anda.
                </p>
            </div>
            {groups.length === 0 && <p className={cn(CARD, 'text-sm text-ob-ink-2')}>Belum ada panduan untuk modul yang bisa Anda buka.</p>}
            {groups.map(({ group, items }) => (
                <section key={group} aria-labelledby={`guide-${group}`} className="flex flex-col gap-2">
                    <h2 id={`guide-${group}`} className="px-1 text-[13px] font-semibold text-ob-ink-2">
                        {group}
                    </h2>
                    <ul className="overflow-hidden rounded-3xl border border-ob-line bg-ob-card">
                        {items.map((g) => (
                            <li key={g.slug} className="border-b border-ob-line-soft last:border-b-0">
                                <Link href={`/panduan/${g.slug}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ob-hover focus-visible:bg-ob-hover focus-visible:outline-none">
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="flex items-center gap-2 text-[15px] font-semibold text-ob-ink">
                                            {g.title}
                                            {TUTORIAL_LOADERS[g.slug] && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-ob-act/12 px-2 py-0.5 text-[11px] font-semibold text-ob-act">
                                                    <CirclePlay className="h-3 w-3" /> Video
                                                </span>
                                            )}
                                        </span>
                                        <span className="line-clamp-2 text-[13px] text-ob-ink-2">{g.summary}</span>
                                    </span>
                                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ob-ink-3 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );
}

function ModuleView({ guide, roles }: { guide: ModuleGuide; roles: string[] }) {
    const roleKeys = visibleRoleKeys(roles);
    const tasks = guide.tasks.filter((t) => roleKeys.includes(t.role.key));
    const insights = seesInsights(guide, roles);

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ob-ink-3">{guide.group}</p>
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">{guide.title}</h1>
                    <p className="mt-1 max-w-[65ch] text-sm text-ob-ink-2">{guide.summary}</p>
                </div>
                <Button asChild variant="outline" className={BTN.secondary}>
                    <Link href={guide.path}>
                        Buka {guide.title} <ExternalLink className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            {TUTORIAL_LOADERS[guide.slug] && (
                <Section id="guide-video" title="Video tutorial" description="Pilih peran untuk melihat alur dan contoh pengisian di setiap halaman.">
                    <div className={CARD}>
                        <TutorialVideosLazy slug={guide.slug} />
                    </div>
                </Section>
            )}

            <Section id="guide-roles" title="Siapa melakukan apa" description="Tombol yang muncul di layar menyesuaikan peran Anda.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {guide.roles.map((card) => (
                        <div key={card.role.key} className={cn(CARD, 'flex flex-col gap-3')}>
                            <div className="flex flex-col items-start gap-1.5">
                                <RoleChip role={card.role} />
                                <p className="text-[15px] font-semibold text-ob-ink">{card.who}</p>
                            </div>
                            <ul className="flex flex-col gap-2 text-[13px] leading-snug text-ob-ink">
                                {card.can.map((t) => (
                                    <li key={t} className="flex items-start gap-2">
                                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ob-pos" strokeWidth={3} />
                                        <span>
                                            <Rich text={t} />
                                        </span>
                                    </li>
                                ))}
                                {card.cannot?.map((t) => (
                                    <li key={t} className="flex items-start gap-2 text-ob-ink-2">
                                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} />
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
                    <div className="relative overflow-x-auto rounded-3xl border border-ob-line bg-ob-card">
                        <table className="w-full min-w-[560px] text-[13px]">
                            <caption className="sr-only">Ringkasan hak akses {guide.title}</caption>
                            <thead>
                                <tr className="border-b border-ob-line text-left text-ob-ink-2">
                                    <th scope="col" className="px-5 py-3 font-semibold">
                                        Aksi
                                    </th>
                                    {guide.matrixRoles.map((r) => (
                                        <th key={r.key} scope="col" className="px-3 py-3 text-center font-semibold">
                                            <RoleChip role={r} />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {guide.matrix.map((row) => (
                                    <tr key={row.action} className="border-b border-ob-line-soft last:border-b-0">
                                        <th scope="row" className="px-5 py-3 text-left font-medium text-ob-ink">
                                            {row.action}
                                        </th>
                                        {row.cells.map((cell, i) => (
                                            <td key={i} className="px-3 py-3 text-center text-ob-ink-2">
                                                {cell === true ? (
                                                    <Check className="mx-auto h-4 w-4 text-ob-pos" strokeWidth={3} aria-label="Bisa" />
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
                <Section id="guide-flow" title="Alur" description="Setiap status menunjukkan siapa yang harus bertindak berikutnya.">
                    <div className={cn(CARD, 'flex flex-col gap-4')}>
                        <ol className="flex flex-wrap items-stretch gap-2">
                            {guide.flow.steps.map((step, i) => (
                                <li key={step.label} className="flex items-center gap-2">
                                    <div className="flex min-w-[150px] flex-col gap-2 rounded-2xl bg-ob-inner p-3">
                                        <StatusPill tone={step.tone} className="self-start">
                                            {step.label}
                                        </StatusPill>
                                        <RoleChip role={step.role} className="self-start" />
                                        <p className="text-[13px] leading-snug text-ob-ink">{step.what}</p>
                                    </div>
                                    {i < guide.flow!.steps.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-ob-ink-3" aria-hidden="true" />}
                                </li>
                            ))}
                        </ol>
                        {guide.flow.branch && (
                            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ob-ink-2">
                                <span>Dari</span>
                                <StatusPill tone={guide.flow.steps[guide.flow.branch.from].tone}>{guide.flow.steps[guide.flow.branch.from].label}</StatusPill>
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                <StatusPill tone={guide.flow.branch.tone}>{guide.flow.branch.label}</StatusPill>
                                <span>
                                    {guide.flow.branch.down}. {guide.flow.branch.up && `${guide.flow.branch.up}.`}
                                </span>
                            </div>
                        )}
                        {guide.flow.note && (
                            <p className="rounded-2xl bg-ob-inner px-4 py-3 text-[13px] text-ob-ink-2">
                                <Rich text={guide.flow.note} />
                            </p>
                        )}
                    </div>
                </Section>
            )}

            {tasks.length > 0 && (
                <Section id="guide-tasks" title="Cara melakukan">
                    <div className="grid gap-3 md:grid-cols-2">
                        {tasks.map((task) => (
                            <div key={task.title} className={cn(CARD, 'flex flex-col gap-3')}>
                                <div className="flex flex-col items-start gap-1.5">
                                    <RoleChip role={task.role} />
                                    <h3 className="text-[15px] font-semibold text-ob-ink">{task.title}</h3>
                                </div>
                                <ol className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-ob-ink-2">
                                    {task.steps.map((step, i) => (
                                        <li key={i} className="flex items-start gap-2.5">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ob-chip text-[11px] font-semibold tabular-nums text-ob-ink">{i + 1}</span>
                                            <span>
                                                <Rich text={step} />
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {insights && guide.impacts && (
                <Section id="guide-impacts" title="Dampak ke modul lain" description="Apa yang berubah di bagian lain aplikasi setelah sebuah aksi.">
                    <div className="grid gap-3 md:grid-cols-2">
                        {guide.impacts.map((impact) => (
                            <div key={impact.title} className={cn(CARD, 'flex flex-col gap-3')}>
                                <p className="text-[15px] font-semibold text-ob-ink">{impact.title}</p>
                                <ul className="flex flex-col gap-2.5 text-[13px] leading-snug text-ob-ink-2">
                                    {impact.items.map((item) => (
                                        <li key={item} className="flex items-start gap-2.5">
                                            <span className={cn('mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full', TONE_CLASS[impact.tone].chip)}>
                                                <ArrowRight className="h-3 w-3" />
                                            </span>
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

            {insights &&
                guide.records?.map((record) => (
                    <Section key={record.title} id={`guide-record-${record.title}`} title={record.title} description={record.subtitle}>
                        <div className="relative overflow-x-auto rounded-3xl border border-ob-line bg-ob-card">
                            <table className="w-full min-w-[560px] text-[13px]">
                                <caption className="sr-only">{record.title}</caption>
                                <thead>
                                    <tr className="border-b border-ob-line text-left text-ob-ink-2">
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Kolom
                                        </th>
                                        <th scope="col" className="px-3 py-3 font-semibold">
                                            Contoh isi
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Asal data
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {record.rows.map((row) => (
                                        <tr key={row.label} className="border-b border-ob-line-soft last:border-b-0">
                                            <th scope="row" className="px-5 py-3 text-left font-normal text-ob-ink-2">
                                                {row.label}
                                            </th>
                                            <td className="px-3 py-3 font-medium text-ob-ink">{row.value}</td>
                                            <td className="px-5 py-3 text-right">
                                                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE_CLASS[row.tone ?? 'neutral'].chip)}>{row.source}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {record.note && (
                            <p className="px-1 text-[13px] text-ob-ink-2">
                                <Rich text={record.note} />
                            </p>
                        )}
                    </Section>
                ))}

            {insights && guide.warnings && (
                <Section id="guide-warnings" title="Perhatian">
                    <div className="grid gap-3 md:grid-cols-2">
                        {guide.warnings.map((w) => (
                            <div key={w.title} className={cn(CARD, 'flex gap-3')}>
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ob-wait/12 text-ob-wait">
                                    <TriangleAlert className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[14px] font-semibold text-ob-ink">{w.title}</p>
                                    <p className="mt-1 text-[13px] leading-snug text-ob-ink-2">
                                        <Rich text={w.body} />
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </>
    );
}

GuidePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
