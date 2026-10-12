import * as React from 'react';
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { cn } from '@/lib/utils';
import { Sfx } from '../sfx';
import { STAGE, Stage } from './stage';

/** Kotak dalam koordinat layar aplikasi (px CSS, 1280×720) — sama dengan koordinat screenshot. */
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export type RoleTone = 'act' | 'pos' | 'neg';

export interface Role {
    label: string;
    tone: RoleTone;
}

/**
 * Satu langkah tutorial. Gambar berganti dengan crossfade; dengan `type`, gambar baru "diketik"
 * (diungkap dari kiri ke kanan) hanya di dalam kotak itu, di atas gambar langkah sebelumnya.
 */
export interface Step {
    /** URL screenshot (hasil `import x from './screens/x.webp'`). */
    src: string;
    caption: string;
    /** Area yang disorot (spotlight). */
    focus?: Box;
    /** Zoom kamera ke `focus` (1 = tanpa zoom). */
    zoom?: number;
    /** Ke mana kursor bergerak; tanpa nilai = diam di posisi terakhir. */
    cursor?: Box;
    click?: boolean;
    type?: Box;
    /** Durasi dalam frame (30 fps). */
    duration?: number;
    /** Role pelaku langkah ini bila berbeda dari role bab. */
    role?: Role;
    /** Bunyi "berhasil" di awal langkah (mis. status berubah). */
    chime?: boolean;
}

const DEFAULT_DURATION = 120;
const CLICK_AT = 30;
const TYPE_AT = 36;
const SCREEN = { w: STAGE.width, h: STAGE.height };

export const ROLE_TONE: Record<RoleTone, { dot: string; chip: string }> = {
    act: { dot: 'bg-ob-act', chip: 'bg-ob-act/15 text-ob-act' },
    pos: { dot: 'bg-ob-pos', chip: 'bg-ob-pos/15 text-ob-pos' },
    neg: { dot: 'bg-ob-neg', chip: 'bg-ob-neg/15 text-ob-neg' },
};

export function walkthroughDuration(steps: Step[]): number {
    return steps.reduce((n, s) => n + (s.duration ?? DEFAULT_DURATION), 0);
}

const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function camera(step: Step) {
    const z = step.zoom ?? 1;
    if (!step.focus || z === 1) return { z: 1, tx: 0, ty: 0 };
    const c = center(step.focus);
    return {
        z,
        tx: clamp(SCREEN.w / 2 - c.x * z, SCREEN.w - SCREEN.w * z, 0),
        ty: clamp(SCREEN.h / 2 - c.y * z, SCREEN.h - SCREEN.h * z, 0),
    };
}

function Cursor({ x, y, scale }: { x: number; y: number; scale: number }) {
    return (
        <svg width={26} height={26} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, transform: `scale(${scale})`, transformOrigin: '0 0', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }}>
            <path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#141416" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
    );
}

/** Rekaman layar sintetis: screenshot + kamera + spotlight + kursor + teks penjelasan per langkah. */
export function Walkthrough({ steps, role }: { steps: Step[]; role: Role }) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const starts = React.useMemo(() => steps.map((_, i) => steps.slice(0, i).reduce((n, s) => n + (s.duration ?? DEFAULT_DURATION), 0)), [steps]);

    const cursorAt = React.useMemo(() => {
        let last = { x: SCREEN.w * 0.85, y: SCREEN.h * 0.8 };
        return steps.map((s) => (last = s.cursor ? center(s.cursor) : last));
    }, [steps]);
    // Kursor baru tampil sejak langkah pertama yang menunjuk sesuatu (walkthrough "lihat saja" tanpa kursor).
    const firstCursor = steps.findIndex((s) => s.cursor);

    let index = 0;
    while (index < steps.length - 1 && frame >= starts[index + 1]) index++;
    const local = frame - starts[index];
    const duration = steps[index].duration ?? DEFAULT_DURATION;
    const step = steps[index];
    const prev = steps[index - 1] ?? step;

    const move = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: 26 });
    const camA = camera(prev);
    const camB = camera(step);
    const cam = { z: mix(camA.z, camB.z, move), tx: mix(camA.tx, camB.tx, move), ty: mix(camA.ty, camB.ty, move) };

    const cursorMove = spring({ frame: local - 4, fps, config: { damping: 200 }, durationInFrames: 22 });
    const from = cursorAt[index - 1] ?? cursorAt[index];
    const to = cursorAt[index];
    const cursor = { x: mix(from.x, to.x, cursorMove), y: mix(from.y, to.y, cursorMove) };
    const ripple = step.click ? interpolate(local, [CLICK_AT, CLICK_AT + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
    const press = step.click ? interpolate(local, [CLICK_AT - 4, CLICK_AT, CLICK_AT + 5], [1, 0.82, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;

    const changed = prev.src !== step.src;
    const fadeIn = interpolate(local, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
    const typeFrames = step.type ? Math.max(16, Math.round(step.type.w / 14)) : 1;
    const typed = interpolate(local, [TYPE_AT, TYPE_AT + typeFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    const focusA = prev.focus ?? step.focus;
    const focusB = step.focus ?? prev.focus;
    const spot = focusA && focusB ? { x: mix(focusA.x, focusB.x, move), y: mix(focusA.y, focusB.y, move), w: mix(focusA.w, focusB.w, move), h: mix(focusA.h, focusB.h, move) } : null;
    const spotOpacity = step.focus ? (prev.focus || index === 0 ? 1 : move) : prev.focus ? 1 - move : 0;

    const focusScreenY = step.focus ? center(step.focus).y * camB.z + camB.ty : 0;
    const captionTop = focusScreenY > SCREEN.h * 0.55;
    const captionIn = spring({ frame: local - 6, fps, config: { damping: 200 }, durationInFrames: 18 });
    const actor = step.role ?? role;
    const tone = ROLE_TONE[actor.tone];

    return (
        <Stage className="overflow-hidden">
            {steps.map((s, i) => (
                <React.Fragment key={i}>
                    {i > 0 && s.src !== steps[i - 1].src && !s.type && <Sfx name="whoosh" at={starts[i]} frames={18} />}
                    {s.click && <Sfx name="click" at={starts[i] + CLICK_AT - 1} frames={6} />}
                    {s.type && <Sfx name="type" at={starts[i] + TYPE_AT} frames={Math.max(16, Math.round(s.type.w / 14))} />}
                    {s.chime && <Sfx name="success" at={starts[i] + 4} frames={27} />}
                </React.Fragment>
            ))}
            <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z})` }}>
                <Img src={changed ? prev.src : step.src} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h }} />
                {changed && (
                    <Img
                        src={step.src}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: SCREEN.w,
                            height: SCREEN.h,
                            opacity: step.type ? 1 : fadeIn,
                            clipPath: step.type
                                ? `inset(${step.type.y}px ${SCREEN.w - step.type.x - step.type.w * typed}px ${SCREEN.h - step.type.y - step.type.h}px ${step.type.x}px)`
                                : undefined,
                        }}
                    />
                )}
                {spot && spotOpacity > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            left: spot.x - 6,
                            top: spot.y - 6,
                            width: spot.w + 12,
                            height: spot.h + 12,
                            borderRadius: 14,
                            boxShadow: `0 0 0 4000px rgba(9, 9, 11, ${0.45 * spotOpacity})`,
                            outline: `${2.5 / cam.z}px solid rgba(37, 99, 235, ${spotOpacity})`,
                            outlineOffset: 0,
                        }}
                    />
                )}
                {ripple > 0 && ripple < 1 && (
                    <div
                        style={{
                            position: 'absolute',
                            left: to.x - 22,
                            top: to.y - 22,
                            width: 44,
                            height: 44,
                            borderRadius: 999,
                            border: `${3 / cam.z}px solid #2563eb`,
                            transform: `scale(${0.4 + ripple * 1.4})`,
                            opacity: 1 - ripple,
                        }}
                    />
                )}
                {firstCursor !== -1 && index >= firstCursor && <Cursor x={cursor.x - 4 / cam.z} y={cursor.y - 3 / cam.z} scale={press / cam.z} />}
            </div>

            <div
                className={cn('absolute left-1/2 w-[820px] max-w-[calc(100%-48px)] overflow-hidden rounded-2xl bg-ob-invert text-ob-invert-ink shadow-2xl', captionTop ? 'top-6' : 'bottom-6')}
                style={{ opacity: captionIn, transform: `translate(-50%, ${(1 - captionIn) * (captionTop ? -10 : 10)}px)` }}
            >
                <div className="flex items-start gap-4 px-6 py-4">
                    <div className="flex shrink-0 flex-col items-start gap-1.5 pt-0.5">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold', tone.chip)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                            {actor.label}
                        </span>
                        <span className="pl-1 text-xs font-medium tabular-nums opacity-60">
                            Langkah {index + 1}/{steps.length}
                        </span>
                    </div>
                    <p className="text-[20px] font-medium leading-snug text-pretty">{step.caption}</p>
                </div>
                <div className="h-1 bg-white/10">
                    <div className="h-full bg-ob-act-fill" style={{ width: `${(local / duration) * 100}%` }} />
                </div>
            </div>
        </Stage>
    );
}
