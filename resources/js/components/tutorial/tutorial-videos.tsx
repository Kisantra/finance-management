import { usePage } from '@inertiajs/react';
import { Player, type PlayerRef } from '@remotion/player';
import type { Tutorial, Tutorials } from '@video/components/tutorial';
import type { RoleKey } from '@video/roles';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { primaryRoleKey, visibleRoleKeys } from './access';

const PILL = 'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

export function duration(frames: number): string {
    const seconds = Math.round(frames / 30);
    return seconds < 60 ? `${seconds} dtk` : `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`;
}

/**
 * Tab video per role + Player + bab. Komposisi Remotion diputar langsung lewat @remotion/player (tanpa MP4).
 * Modul ini berat (Remotion) — selalu dimuat lazy lewat TutorialVideosLazy.
 */
export default function TutorialVideos({ tutorials, autoPlay = false, fitViewport = false }: { tutorials: Tutorials; autoPlay?: boolean; fitViewport?: boolean }) {
    const roles = usePage<{ auth: { roles?: string[] } }>().props.auth.roles ?? [];
    const keys = visibleRoleKeys(roles).filter((k) => tutorials[k]);
    const fallback = keys.includes(primaryRoleKey(roles)) ? primaryRoleKey(roles) : keys.at(-1);
    const [tab, setTab] = React.useState<RoleKey | undefined>(fallback);

    if (!tab || !tutorials[tab]) {
        return <p className="rounded-2xl bg-ob-inner p-5 text-[13px] text-ob-ink-2">Belum ada video tutorial untuk peran Anda di modul ini.</p>;
    }

    return (
        <div>
            {keys.length > 1 && (
                <div role="tablist" aria-label="Tutorial per peran" className="ob-no-scrollbar mb-4 flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-ob-line bg-ob-rail p-[3px]">
                    {keys.map((key) => {
                        const t = tutorials[key]!;
                        const on = tab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => setTab(key)}
                                className={cn(PILL, on ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                            >
                                {t.role.label} <span className={cn('tabular-nums', on ? 'opacity-70' : 'text-ob-ink-3')}>· {duration(t.frames)}</span>
                            </button>
                        );
                    })}
                </div>
            )}
            <TutorialPlayer key={tab} tutorial={tutorials[tab]!} autoPlay={autoPlay} fitViewport={fitViewport} />
        </div>
    );
}

function TutorialPlayer({ tutorial, autoPlay, fitViewport }: { tutorial: Tutorial; autoPlay: boolean; fitViewport: boolean }) {
    const playerRef = React.useRef<PlayerRef>(null);
    const [chapter, setChapter] = React.useState(0);

    // Player baru terpasang setelah wadahnya tampil; callback ref memasang listener saat itu.
    const attach = React.useCallback(
        (player: PlayerRef | null) => {
            playerRef.current = player;
            player?.addEventListener('frameupdate', ({ detail }) => {
                const index = tutorial.chapters.findLastIndex((c) => detail.frame >= c.frame);
                setChapter((current) => (current === index ? current : index));
            });
        },
        [tutorial],
    );

    const jump = (frame: number) => {
        playerRef.current?.seekTo(frame);
        playerRef.current?.play();
    };

    return (
        // Di dialog, lebar video dibatasi tinggi layar agar judul, tab, video, dan bab muat tanpa menggulir.
        <div role="tabpanel" aria-label={`Tutorial ${tutorial.role.label}`} className="mx-auto w-full" style={fitViewport ? { maxWidth: 'calc((100dvh - 19rem) * 16 / 9)' } : undefined}>
            {/* Video memakai token terang (sama dengan screenshot-nya) walau aplikasi sedang mode gelap. */}
            <div className="ob-light overflow-hidden rounded-2xl border border-ob-line bg-ob-page">
                <Player
                    ref={attach}
                    component={tutorial.component}
                    durationInFrames={tutorial.frames}
                    fps={30}
                    compositionWidth={1920}
                    compositionHeight={1080}
                    style={{ width: '100%', aspectRatio: '16 / 9' }}
                    controls
                    autoPlay={autoPlay}
                    // Tanpa autoplay, tampilkan frame saat judul intro sudah muncul (frame 0 masih kosong karena fade-in).
                    initialFrame={autoPlay ? 0 : Math.min(60, tutorial.frames - 1)}
                    clickToPlay
                />
            </div>

            <nav aria-label="Bab tutorial" className="ob-no-scrollbar mt-4 flex max-w-full gap-1.5 overflow-x-auto">
                {tutorial.chapters.map((c, i) => (
                    <button
                        key={c.label}
                        type="button"
                        aria-current={chapter === i ? 'step' : undefined}
                        onClick={() => jump(c.frame)}
                        className={cn(PILL, chapter === i ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'bg-ob-inner font-medium text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink')}
                    >
                        {c.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
