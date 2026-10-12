import { ArrowRight, Check, Minus, TriangleAlert, X } from 'lucide-react';
import { interpolate, useCurrentFrame } from 'remotion';
import { StatusPill } from '@/components/dashboard/widget';
import { cn } from '@/lib/utils';
import type { GuideFlow, GuideImpact, GuideRecord, GuideRoleCard, ModuleGuide } from '../guide';
import { Rich } from '../rich';
import { type Role, TONE_CLASS, type Tone } from '../roles';
import { Sfx } from '../sfx';
import { Stage, useEnter } from './stage';

/*
 * Adegan generik untuk video tutorial modul — semua isinya dari ModuleGuide (video/<modul>/guide.ts),
 * jadi teks video selalu sama dengan halaman /panduan.
 */

export function RoleChip({ role, className }: { role: Role; className?: string }) {
    const tone = TONE_CLASS[role.tone];
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', tone.chip, className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
            {role.label}
        </span>
    );
}

/** Pil status seperti di aplikasi: Lunas/selesai (pos) bercentang, Ditolak (late) bersilang. */
export function StatePill({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
    const icon = tone === 'pos' ? <Check className="h-3 w-3" strokeWidth={3} /> : tone === 'late' ? <X className="h-3 w-3" strokeWidth={3} /> : undefined;
    return (
        <StatusPill tone={tone} icon={icon} className={className}>
            {label}
        </StatusPill>
    );
}

/** Muncul + geser naik di frame `at`. */
function useAppear(at: number, distance = 14) {
    const p = interpolate(useCurrentFrame(), [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
}

function useDraw(at: number, length = 14) {
    return interpolate(useCurrentFrame(), [at, at + length], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export function Intro({ module, role, title, summary }: { module: string; role: Role; title: string; summary: string }) {
    return (
        <Stage className="flex flex-col justify-center px-24">
            <Sfx name="whoosh" at={0} frames={18} />
            <p style={useEnter(0)} className="text-lg font-semibold text-ob-act">
                Tutorial · {module}
            </p>
            <div style={useEnter(5)} className="mt-5">
                <RoleChip role={role} className="px-4 py-1.5 text-base" />
            </div>
            <h1 style={useEnter(9)} className="mt-4 max-w-4xl text-6xl font-bold tracking-tight text-balance">
                {title}
            </h1>
            <p style={useEnter(15)} className="mt-5 max-w-2xl text-xl text-ob-ink-2">
                {summary}
            </p>
        </Stage>
    );
}

export function RolesScene({ cards, title = 'Peran di modul ini' }: { cards: GuideRoleCard[]; title?: string }) {
    const frame = useCurrentFrame();
    return (
        <Stage className="flex flex-col justify-center px-16">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                {title}
            </h2>
            <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                Apa yang bisa dilakukan setiap peran di modul ini.
            </p>
            <div className="mt-10 grid gap-5" style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
                {cards.map((card, i) => {
                    const at = 18 + i * 40;
                    const enter = interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    const lines = [...card.can.map((t) => ({ t, ok: true })), ...(card.cannot ?? []).map((t) => ({ t, ok: false }))];
                    return (
                        <div key={card.role.key} style={{ opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }} className="flex flex-col gap-4 rounded-3xl border border-ob-line bg-ob-card p-6">
                            <Sfx name="pop" at={at} />
                            <div className="flex flex-col items-start gap-2">
                                <RoleChip role={card.role} />
                                <p className="text-2xl font-semibold">{card.who}</p>
                            </div>
                            <ul className="flex flex-col gap-2.5">
                                {lines.map((line, j) => (
                                    <li
                                        key={line.t}
                                        style={{ opacity: interpolate(frame, [at + 10 + j * 8, at + 20 + j * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}
                                        className={cn('flex items-start gap-2.5 text-[17px] leading-snug', !line.ok && 'text-ob-ink-2')}
                                    >
                                        {line.ok ? <Check className="mt-1 h-4 w-4 shrink-0 text-ob-pos" strokeWidth={3} /> : <Minus className="mt-1 h-4 w-4 shrink-0" strokeWidth={3} />}
                                        <span>
                                            <Rich text={line.t} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}

export const flowSceneFrames = (flow: GuideFlow) => 90 + flow.steps.length * 36 + (flow.branch ? 90 : 0) + (flow.note ? 60 : 0) + 60;

export function FlowScene({ flow, title = 'Alur', subtitle = 'Setiap status menunjukkan siapa yang harus bertindak berikutnya.' }: { flow: GuideFlow; title?: string; subtitle?: string }) {
    const n = flow.steps.length;
    const gap = 60;
    const w = (1180 - gap * (n - 1)) / n;
    const h = 132;
    const y = 210;
    const x = (i: number) => 50 + i * (w + gap);
    const stepAt = (i: number) => 30 + i * 36;
    const draws = flow.steps.map((_, i) => useDraw(stepAt(i) + 14));
    const branchAt = stepAt(n) + 10;
    const down = useDraw(branchAt);
    const up = useDraw(branchAt + 40);
    const by = 470;
    const branch = flow.branch;

    return (
        <Stage>
            {flow.steps.map((_, i) => (
                <Sfx key={i} name="pop" at={stepAt(i)} />
            ))}
            {branch && <Sfx name="pop" at={branchAt + 8} />}
            <div className="absolute left-[50px] top-[72px]">
                <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                    {title}
                </h2>
                <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                    {subtitle}
                </p>
            </div>

            <svg className="absolute inset-0" width={1280} height={720}>
                <defs>
                    <marker id="head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <path d="M0,0 L8,4 L0,8 z" fill="var(--ob-ink-3)" />
                    </marker>
                </defs>
                {flow.steps.slice(0, -1).map((_, i) => {
                    const x1 = x(i) + w + 8;
                    const x2 = x(i + 1) - 10;
                    return draws[i] > 0 ? <line key={i} x1={x1} y1={y + h / 2} x2={x1 + (x2 - x1) * draws[i]} y2={y + h / 2} stroke="var(--ob-ink-3)" strokeWidth={2} markerEnd="url(#head)" /> : null;
                })}
                {branch && down > 0 && (
                    <line x1={x(branch.from) + w * 0.36} y1={y + h + 8} x2={x(branch.from) + w * 0.36} y2={y + h + 8 + (by - y - h - 18) * down} stroke="var(--ob-late)" strokeWidth={2} markerEnd="url(#head)" />
                )}
                {branch?.up && up > 0 && (
                    <line x1={x(branch.from) + w * 0.64} y1={by - 8} x2={x(branch.from) + w * 0.64} y2={by - 8 - (by - y - h - 18) * up} stroke="var(--ob-act)" strokeWidth={2} strokeDasharray="6 5" markerEnd="url(#head)" />
                )}
            </svg>

            {flow.steps.map((step, i) => (
                <div key={step.label} style={{ left: x(i), top: y, width: w, height: h, ...useAppear(stepAt(i), 18) }} className="absolute flex flex-col gap-3 rounded-3xl border border-ob-line bg-ob-card p-5">
                    <StatePill label={step.label} tone={step.tone} className="origin-left scale-125 self-start" />
                    <div className="mt-1 flex flex-col items-start gap-1.5">
                        <RoleChip role={step.role} className="px-2.5 py-0.5 text-[13px]" />
                        <p className="text-[15px] font-medium leading-snug">{step.what}</p>
                    </div>
                </div>
            ))}

            {branch && (
                <>
                    <div style={{ left: x(branch.from) - 230, top: y + h + 40, width: 220 + w * 0.3, opacity: down }} className="absolute text-right text-[15px] leading-snug text-ob-ink-2">
                        {branch.down}
                    </div>
                    {branch.up && (
                        <div style={{ left: x(branch.from) + w * 0.64 + 20, top: y + h + 40, width: 240, opacity: up }} className="absolute text-[15px] leading-snug text-ob-ink-2">
                            {branch.up}
                        </div>
                    )}
                    <div style={{ left: x(branch.from), top: by, width: w, ...useAppear(branchAt + 8, 18) }} className="absolute flex flex-col gap-2 rounded-3xl border border-ob-line bg-ob-card p-5">
                        <StatePill label={branch.label} tone={branch.tone} className="origin-left scale-125 self-start" />
                        <p className="mt-1 text-[15px] font-medium">{branch.title}</p>
                    </div>
                </>
            )}

            {flow.note && (
                <div style={{ left: x(n - 1), top: y + h + 28, width: w, ...useAppear(branchAt + (branch ? 60 : 0), 18) }} className="absolute rounded-2xl bg-ob-inner p-4 text-[14px] leading-snug text-ob-ink-2">
                    <Rich text={flow.note} />
                </div>
            )}
        </Stage>
    );
}

export function ChapterCard({ part, total, role, title, summary }: { part: number; total: number; role: Role; title: string; summary: string }) {
    return (
        <Stage className="flex flex-col justify-center px-24">
            <p style={useEnter(0)} className="text-base font-semibold tabular-nums text-ob-ink-3">
                Bagian {part} dari {total}
            </p>
            <div style={useEnter(4)} className="mt-4">
                <RoleChip role={role} className="px-4 py-1.5 text-base" />
            </div>
            <h2 style={useEnter(8)} className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-balance">
                {title}
            </h2>
            <p style={useEnter(14)} className="mt-4 max-w-2xl text-xl text-ob-ink-2">
                {summary}
            </p>
        </Stage>
    );
}

export const impactSceneFrames = (impacts: GuideImpact[]) => 24 + impacts.reduce((n, c) => n + 14 + c.items.length * 22, 0) + 120;

export function ImpactScene({ impacts, title = 'Apa yang terjadi di balik layar?', subtitle }: { impacts: GuideImpact[]; title?: string; subtitle?: string }) {
    let at = 24;
    return (
        <Stage className="flex flex-col justify-center px-16">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                {title}
            </h2>
            {subtitle && (
                <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                    <Rich text={subtitle} />
                </p>
            )}
            <div className="mt-8 grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(impacts.length, 3)}, minmax(0, 1fr))` }}>
                {impacts.map((col) => {
                    const head = at;
                    at += 14;
                    const tone = TONE_CLASS[col.tone].chip;
                    return (
                        <div key={col.title} className="flex flex-col gap-4 rounded-3xl border border-ob-line bg-ob-card p-6">
                            <Sfx name="pop" at={head} />
                            <p style={useAppear(head)} className="text-2xl font-semibold">
                                {col.title}
                            </p>
                            <ul className="flex flex-col gap-3">
                                {col.items.map((item) => {
                                    const itemAt = at;
                                    at += 22;
                                    return (
                                        <li key={item} style={useAppear(itemAt)} className="flex items-start gap-3 text-[17px] leading-snug">
                                            <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', tone)}>
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </span>
                                            <span>
                                                <Rich text={item} />
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}

export const recordSceneFrames = (record: GuideRecord) => 24 + record.rows.length * 20 + 150;

export function RecordScene({ record }: { record: GuideRecord }) {
    return (
        <Stage className="flex flex-col justify-center px-24">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                {record.title}
            </h2>
            {record.subtitle && (
                <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                    {record.subtitle}
                </p>
            )}
            <div style={useEnter(12)} className="mt-8 overflow-hidden rounded-3xl border border-ob-line bg-ob-card">
                {record.rows.map((row, i) => {
                    const at = 24 + i * 20;
                    return (
                        <div key={row.label} style={useAppear(at)} className="grid grid-cols-[150px_1fr_auto] items-center gap-6 border-b border-ob-line px-7 py-3.5 last:border-b-0">
                            <Sfx name="pop" at={at} />
                            <span className="text-[15px] text-ob-ink-2">{row.label}</span>
                            <span className="text-[17px] font-medium">{row.value}</span>
                            <span className={cn('rounded-full px-3 py-1 text-[13px] font-semibold', TONE_CLASS[row.tone ?? 'neutral'].chip)}>{row.source}</span>
                        </div>
                    );
                })}
            </div>
            {record.note && (
                <p style={useAppear(24 + record.rows.length * 20 + 10)} className="mt-5 text-[16px] text-ob-ink-2">
                    <Rich text={record.note} />
                </p>
            )}
        </Stage>
    );
}

export const warningsSceneFrames = (count: number) => 20 + count * 45 + 150;

export function WarningsScene({ warnings, title = 'Yang perlu diperhatikan Admin' }: { warnings: { title: string; body: string }[]; title?: string }) {
    return (
        <Stage className="flex flex-col justify-center px-16">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                {title}
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-5">
                {warnings.map((w, i) => {
                    const at = 20 + i * 45;
                    return (
                        <div key={w.title} style={useAppear(at)} className="flex gap-4 rounded-3xl border border-ob-line bg-ob-card p-6">
                            <Sfx name="pop" at={at} />
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ob-wait/12 text-ob-wait">
                                <TriangleAlert className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-xl font-semibold leading-snug">{w.title}</p>
                                <p className="mt-2 text-[16px] leading-snug text-ob-ink-2">
                                    <Rich text={w.body} />
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}

export function RecapScene({ guide }: { guide: ModuleGuide }) {
    const frame = useCurrentFrame();
    const roles = guide.matrixRoles ?? [];
    const cols = `1.6fr ${roles.map(() => '1fr').join(' ')}`;
    return (
        <Stage className="flex flex-col justify-center px-20">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                Ringkasan hak akses
            </h2>
            <div style={useEnter(6)} className="mt-8 overflow-hidden rounded-3xl border border-ob-line bg-ob-card">
                <div className="grid border-b border-ob-line px-6 py-4" style={{ gridTemplateColumns: cols }}>
                    <span className="text-sm font-semibold text-ob-ink-2">Aksi</span>
                    {roles.map((r) => (
                        <span key={r.key} className="flex justify-center">
                            <RoleChip role={r} />
                        </span>
                    ))}
                </div>
                {(guide.matrix ?? []).map((row, i) => {
                    const at = 20 + i * 12;
                    const p = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    return (
                        <div key={row.action} style={{ opacity: p, gridTemplateColumns: cols }} className="grid items-center border-b border-ob-line px-6 py-3.5 last:border-b-0">
                            <span className="text-[18px] font-medium">{row.action}</span>
                            {row.cells.map((cell, j) => (
                                <span key={j} className="flex justify-center text-center text-[14px] font-medium text-ob-ink-2">
                                    {cell === true ? <Check className="h-5 w-5 text-ob-pos" strokeWidth={3} /> : cell === false ? <X className="h-5 w-5 text-ob-ink-3" strokeWidth={2.5} /> : cell}
                                </span>
                            ))}
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}

export function Outro({ where, action }: { where: string; action?: string }) {
    return (
        <Stage dark className="flex flex-col items-center justify-center text-center">
            <Sfx name="success" at={4} frames={27} />
            <h2 style={useEnter(0)} className="text-5xl font-bold tracking-tight">
                Siap mencoba?
            </h2>
            <p style={useEnter(8)} className="mt-4 text-xl text-ob-ink-2">
                Buka menu <span className="font-semibold text-ob-ink">{where}</span>
                {action && (
                    <>
                        {' '}
                        → <span className="font-semibold text-ob-ink">{action}</span>
                    </>
                )}
            </p>
        </Stage>
    );
}
