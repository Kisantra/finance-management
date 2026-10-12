import { Link, router, usePage } from '@inertiajs/react';
import { ArrowUpRight, LogIn, Menu, Search } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BTN } from '@/pages/invoices/components/ob';
import type { SharedProps } from '@/types';
import { ModuleNav } from './parts';
import { GuideSearch } from './search';

/*
 * Kerangka /panduan — SELALU publik (keputusan user 13 Okt 2026): pengguna yang sudah login pun tidak
 * melihat rel/header aplikasi di sini; bedanya hanya tombol kanan ("Buka aplikasi" vs "Masuk").
 */

function isTypingTarget(el: EventTarget | null): boolean {
    return el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function GuideShell({ children }: { children: React.ReactNode }) {
    const { auth, slug } = usePage<SharedProps & { slug?: string | null }>().props;
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;
            if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    React.useEffect(() => router.on('navigate', () => setMenuOpen(false)), []);

    return (
        <div className="ob-motion flex min-h-dvh flex-col bg-ob-page text-ob-ink">
            <a
                href="#isi"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ob-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
            >
                Lewati ke isi
            </a>

            <header className="sticky top-0 z-40 border-b border-ob-line bg-ob-page px-4 sm:px-6">
                <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 sm:gap-3">
                    <Button variant="outline" className={cn(BTN.icon, 'lg:hidden')} onClick={() => setMenuOpen(true)} aria-label="Buka daftar modul">
                        <Menu className="h-4 w-4" />
                    </Button>
                    <Link href="/panduan" className="flex min-w-0 items-center gap-2.5" aria-label="Panduan Kisantra Finance — beranda">
                        <img src="/images/kisantra.png" alt="" className="h-7 w-7 shrink-0 object-contain" />
                        <span className="hidden truncate text-[15px] font-bold tracking-[-0.01em] sm:inline">Kisantra Finance</span>
                        <span aria-hidden="true" className="hidden h-4 w-px bg-ob-line-strong sm:block" />
                        <span className="text-[15px] font-medium text-ob-ink-2">Panduan</span>
                    </Link>

                    <Button
                        variant="outline"
                        onClick={() => setSearchOpen(true)}
                        className="ml-auto hidden h-10 w-full max-w-[320px] justify-between rounded-full border-ob-line bg-ob-card px-4 text-[13px] font-medium text-ob-ink-3 hover:bg-ob-hover hover:text-ob-ink-2 md:flex dark:border-ob-line dark:bg-ob-card dark:hover:bg-ob-hover"
                    >
                        <span className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            Cari modul atau tugas
                        </span>
                        <kbd className="rounded-md border border-ob-line bg-ob-inner px-1.5 font-sans text-[11px] font-semibold text-ob-ink-2">/</kbd>
                    </Button>
                    <Button variant="outline" className={cn(BTN.icon, 'ml-auto md:hidden')} onClick={() => setSearchOpen(true)} aria-label="Cari modul atau tugas">
                        <Search className="h-4 w-4" />
                    </Button>

                    {auth?.user ? (
                        <Button asChild className={cn(BTN.primary, 'h-10 shrink-0 px-4')}>
                            <Link href="/dashboard">
                                Buka aplikasi <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    ) : (
                        <Button asChild className={cn(BTN.primary, 'h-10 shrink-0 px-4')}>
                            <Link href="/login">
                                <LogIn className="h-4 w-4" /> Masuk
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            <div id="isi" className="flex-1">
                {children}
            </div>

            <footer className="border-t border-ob-line px-4 sm:px-6">
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 py-6 text-[13px] text-ob-ink-3">
                    <span>Kisantra Finance · Panduan pengguna</span>
                    <span>Nama, nomor, dan nominal di panduan ini adalah data contoh.</span>
                </div>
            </footer>

            <GuideSearch open={searchOpen} onOpenChange={setSearchOpen} />
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetContent size="sm" className="overflow-y-auto border-ob-line bg-ob-page px-3 py-6 dark:border-ob-line dark:bg-ob-page">
                    <SheetTitle className="px-3 pb-4 text-base font-bold text-ob-ink">Daftar modul</SheetTitle>
                    <SheetDescription className="sr-only">Pilih modul untuk membaca panduannya.</SheetDescription>
                    <ModuleNav current={slug} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
