import { Link } from '@inertiajs/react';
import { GUIDES, TUTORIAL_LOADERS } from '@video/registry';
import { CircleHelp, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BTN, SURFACE } from '@/pages/invoices/components/ob';
import type { TutorialVideosProps } from './tutorial-videos';

type VideosProps = Omit<TutorialVideosProps, 'tutorials'>;

const cache = new Map<string, React.LazyExoticComponent<React.ComponentType<VideosProps>>>();

/** Komponen video modul `slug`, dimuat lazy bersama Remotion (sekali per slug). */
function lazyVideos(slug: string) {
    if (!cache.has(slug)) {
        cache.set(
            slug,
            React.lazy(async () => {
                const [{ default: TutorialVideos }, tutorials] = await Promise.all([import('./tutorial-videos'), TUTORIAL_LOADERS[slug]()]);
                return { default: (props: VideosProps) => <TutorialVideos tutorials={tutorials} {...props} /> };
            }),
        );
    }
    return cache.get(slug)!;
}

export function TutorialVideosLazy({ slug, ...props }: { slug: string } & VideosProps) {
    if (!TUTORIAL_LOADERS[slug]) return null;
    const Videos = lazyVideos(slug);
    return (
        <React.Suspense fallback={<Skeleton className="aspect-video w-full rounded-2xl" />}>
            <Videos {...props} />
        </React.Suspense>
    );
}

/**
 * Tombol "Tutorial" untuk header halaman modul: membuka dialog video per role.
 * Pakai: <TutorialButton slug="reimbursements" /> (slug = video/<slug>/, terdaftar di @video/registry).
 */
export function TutorialButton({ slug, className }: { slug: string; className?: string }) {
    // null = belum pernah dibuka (Remotion belum diunduh); setelah itu tetap terpasang agar animasi tutup jalan.
    const [open, setOpen] = React.useState<boolean | null>(null);
    const guide = GUIDES.find((g) => g.slug === slug);
    if (!guide || !TUTORIAL_LOADERS[slug]) return null;

    return (
        <>
            <Button variant="outline" className={cn(BTN.secondary, className)} onClick={() => setOpen(true)} icon={<CircleHelp className="h-4 w-4" />}>
                Tutorial
            </Button>
            {open !== null && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent size="4xl" hideClose className={cn(SURFACE, 'max-w-5xl rounded-3xl p-4 sm:p-6')}>
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <DialogTitle className="text-xl font-semibold text-ob-ink dark:text-ob-ink">Tutorial {guide.title.toLowerCase()}</DialogTitle>
                                <DialogDescription className="mt-1 text-[13px] leading-relaxed text-ob-ink-2 dark:text-ob-ink-2">
                                    Alur dan contoh pengisian di setiap halaman.{' '}
                                    <Link href={`/panduan/${slug}`} className="font-medium text-ob-act hover:underline">
                                        Baca panduan lengkap
                                    </Link>
                                </DialogDescription>
                            </div>
                            <Button variant="outline" className={cn(BTN.icon, 'h-8 w-8 shrink-0')} onClick={() => setOpen(false)} aria-label="Tutup tutorial">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <TutorialVideosLazy slug={slug} autoPlay fitViewport />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
