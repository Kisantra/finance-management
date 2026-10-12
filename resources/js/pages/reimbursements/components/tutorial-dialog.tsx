import { usePage } from '@inertiajs/react';
import { Player, type PlayerRef } from '@remotion/player';
import { X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { BTN, SURFACE } from '@/pages/invoices/components/ob';
import { REIMBURSEMENT_TUTORIALS, type Tutorial } from '../../../../../remotion/reimbursements/tutorial';

type TabKey = keyof typeof REIMBURSEMENT_TUTORIALS;
const TABS = Object.entries(REIMBURSEMENT_TUTORIALS) as [TabKey, Tutorial][];

const PILL = 'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

function duration(frames: number): string {
    const seconds = Math.round(frames / 30);
    return seconds < 60 ? `${seconds} dtk` : `${Math.floor(seconds / 60)} mnt ${seconds % 60} dtk`;
}

/** Tab awal mengikuti role pengguna yang sedang masuk. */
function defaultTab(roles: string[]): TabKey {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('finance manager')) return 'fm';
    return 'staff';
}

/**
 * Video tutorial per role (komposisi Remotion yang sama dengan `npm run video`) diputar langsung
 * lewat @remotion/player — tidak ada file MP4; isi video selalu mengikuti kode di remotion/.
 * Dimuat lazy dari halaman daftar agar Remotion hanya diunduh saat tutorial dibuka.
 */
export default function TutorialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const roles = usePage<{ auth: { roles?: string[] } }>().props.auth.roles ?? [];
    const [tab, setTab] = React.useState<TabKey>(() => defaultTab(roles));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="4xl" hideClose className={cn(SURFACE, 'max-w-5xl rounded-3xl p-4 sm:p-6')}>
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <DialogTitle className="text-xl font-semibold text-ob-ink dark:text-ob-ink">Tutorial reimbursement</DialogTitle>
                        <DialogDescription className="mt-1 text-[13px] leading-relaxed text-ob-ink-2 dark:text-ob-ink-2">
                            Pilih peran Anda untuk melihat alur dan contoh pengisian di setiap halaman.
                        </DialogDescription>
                    </div>
                    <Button variant="outline" className={cn(BTN.icon, 'h-8 w-8 shrink-0')} onClick={() => onOpenChange(false)} aria-label="Tutup tutorial">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div role="tablist" aria-label="Tutorial per peran" className="ob-no-scrollbar mb-4 flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-ob-line bg-ob-rail p-[3px]">
                    {TABS.map(([key, t]) => {
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

                <TutorialPlayer key={tab} tutorial={REIMBURSEMENT_TUTORIALS[tab]} />
            </DialogContent>
        </Dialog>
    );
}

function TutorialPlayer({ tutorial }: { tutorial: Tutorial }) {
    const playerRef = React.useRef<PlayerRef>(null);
    const [chapter, setChapter] = React.useState(0);

    // Player baru terpasang setelah dialog terbuka; callback ref memasang listener saat itu.
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
        // Lebar video dibatasi tinggi layar agar judul, tab, video, dan bab muat tanpa menggulir dialog.
        <div role="tabpanel" aria-label={`Tutorial ${tutorial.role.label}`} className="mx-auto w-full" style={{ maxWidth: 'calc((100dvh - 19rem) * 16 / 9)' }}>
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
                    autoPlay
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
