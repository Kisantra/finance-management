import './style.css';
import { Composition } from 'remotion';
import type { Tutorials } from './components/tutorial';

/** Semua video untuk Studio/render — ditemukan otomatis dari video/<slug>/tutorial.tsx (webpack require.context). */
const context = (require as unknown as { context: (dir: string, deep: boolean, re: RegExp) => { keys(): string[]; (id: string): { TUTORIALS: Tutorials } } }).context(
    './',
    true,
    /^\.\/[a-z0-9-]+\/tutorial\.tsx$/,
);
// components/tutorial.tsx (perakit) juga cocok polanya — hanya ambil yang mengekspor TUTORIALS.
const ALL = context.keys().flatMap((key) => Object.values(context(key).TUTORIALS ?? {}));

export function RemotionRoot() {
    return (
        <>
            {ALL.map((t) => (
                <Composition key={t!.id} id={t!.id} component={t!.component} durationInFrames={t!.frames} fps={30} width={1920} height={1080} />
            ))}
        </>
    );
}
