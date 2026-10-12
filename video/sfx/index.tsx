import { Html5Audio, interpolate, Sequence, useVideoConfig } from 'remotion';
import click from './click.wav';
import music from './music.mp3';
import pop from './pop.wav';
import success from './success.wav';
import type from './type.wav';
import whoosh from './whoosh.wav';

/*
 * click.wav  — "Mouse Click Sound" oleh Pixeliota, freesound.org/s/678248 (CC0), via @remotion/sfx; jeda hening awal dipotong.
 * whoosh.wav — "Woosh" oleh 1bob, freesound.org/s/831936 (CC0), via @remotion/sfx.
 * type/pop/success.wav + music.mp3 — sintesis sendiri (generate.py), bebas lisensi.
 */
export const SFX = {
    click: { src: click, volume: 1 },
    type: { src: type, volume: 0.85 },
    whoosh: { src: whoosh, volume: 0.85 },
    pop: { src: pop, volume: 0.8 },
    success: { src: success, volume: 1 },
} as const;

const MUSIC_VOLUME = 0.45;

/** Mainkan efek di frame `at` (relatif ke Sequence induk); `frames` memotong bunyi panjang seperti ketikan. */
export function Sfx({ name, at, frames = 30 }: { name: keyof typeof SFX; at: number; frames?: number }) {
    return (
        <Sequence from={Math.max(0, Math.round(at))} durationInFrames={frames} layout="none">
            <Html5Audio src={SFX[name].src} volume={SFX[name].volume} />
        </Sequence>
    );
}

/** Musik latar tenang sepanjang video: berulang, masuk perlahan, memudar di akhir. */
export function BackgroundMusic() {
    const { durationInFrames } = useVideoConfig();
    return (
        <Html5Audio
            src={music}
            loop
            volume={(f) =>
                interpolate(f, [0, 45, durationInFrames - 60, durationInFrames], [0, MUSIC_VOLUME, MUSIC_VOLUME, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            }
        />
    );
}
