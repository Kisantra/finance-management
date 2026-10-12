import { loadFont } from '@remotion/google-fonts/PlusJakartaSans';
import type * as React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { cn } from '@/lib/utils';

loadFont('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] });

/** Ukuran "layar" aplikasi; video 1920×1080 menampilkannya ×1,5 agar komponen tampil seukuran aslinya. */
export const STAGE = { width: 1280, height: 720, scale: 1.5 } as const;

/** Latar tiap adegan: tema Obsidian (terang/gelap) dengan koordinat 1280×720. */
export function Stage({ dark = false, className, children }: { dark?: boolean; className?: string; children: React.ReactNode }) {
    return (
        <AbsoluteFill className={cn(dark && 'dark', 'bg-ob-page')}>
            <div
                className={cn('relative font-sans text-ob-ink antialiased', className)}
                style={{ width: STAGE.width, height: STAGE.height, transform: `scale(${STAGE.scale})`, transformOrigin: 'top left' }}
            >
                {children}
            </div>
        </AbsoluteFill>
    );
}

/** Muncul dari bawah + fade, mulai di frame `delay` (relatif ke Sequence). */
export function useEnter(delay = 0, distance = 24) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
    return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)` };
}
