import type * as React from 'react';
import { Series } from 'remotion';
import type { Role, RoleKey } from '../roles';
import { BackgroundMusic, Sfx } from '../sfx';
import { ChapterCard } from './scenes';
import { type Step, Walkthrough, walkthroughDuration } from './walkthrough';

/*
 * Perakit video tutorial: daftar adegan → komposisi Remotion + daftar bab (untuk tombol bab di Player).
 * Satu video per role; tiap modul mengekspor TUTORIALS (video/<modul>/tutorial.tsx).
 */

export interface Scene {
    id: string;
    frames: number;
    node: React.ReactNode;
    /** Nama bab — adegan dengan chapter menjadi tombol lompat di Player. */
    chapter?: string;
}

export interface Tutorial {
    /** Id komposisi Remotion (Studio / render), mis. "ReimbursementStaff". */
    id: string;
    role: Role;
    component: React.FC;
    frames: number;
    chapters: { label: string; frame: number }[];
}

export type Tutorials = Partial<Record<RoleKey, Tutorial>>;

export const walk = (id: string, steps: Step[], role: Role, chapter?: string): Scene => ({
    id,
    frames: walkthroughDuration(steps),
    node: <Walkthrough steps={steps} role={role} />,
    chapter,
});

export const chapterCard = (id: string, role: Role, part: number, total: number, title: string, summary: string, chapter: string): Scene => ({
    id,
    frames: 75,
    node: <ChapterCard part={part} total={total} role={role} title={title} summary={summary} />,
    chapter,
});

export function buildTutorial(id: string, role: Role, scenes: Scene[]): Tutorial {
    const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((n, s) => n + s.frames, 0));
    const component: React.FC = () => (
        <>
            <BackgroundMusic />
            <Series>
                {scenes.map((scene, i) => (
                    <Series.Sequence key={scene.id} durationInFrames={scene.frames} name={scene.id}>
                        {i > 0 && <Sfx name="whoosh" at={0} frames={18} />}
                        {scene.node}
                    </Series.Sequence>
                ))}
            </Series>
        </>
    );
    component.displayName = id;
    return {
        id,
        role,
        component,
        frames: scenes.reduce((n, s) => n + s.frames, 0),
        chapters: scenes.flatMap((s, i) => (s.chapter ? [{ label: s.chapter, frame: starts[i] }] : [])),
    };
}
