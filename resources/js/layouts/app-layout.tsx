import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { Toaster, toast } from 'sonner';
import { toastError } from '@/lib/utils';
import type { SharedProps } from '@/types';
import { FloatingFeedbackButton } from '@/components/floating-feedback-button';
import { ResourceModalHost } from '@/components/resource-modal-host';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppLayoutProps {
    children: React.ReactNode;
    /** Lebar konten maksimum; halaman dashboard memakai grid 1440. */
    contentClassName?: string;
}

function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function AppLayout({ children, contentClassName }: AppLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(
        () => typeof window !== 'undefined' && localStorage.getItem('sidebar.collapsed') === 'true',
    );
    const [darkMode, setDarkMode] = React.useState(() => {
        if (typeof window === 'undefined') return false;
        const stored = localStorage.getItem('theme');
        return stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

    /* Server flash → toast, for error/warning/info only. Controllers reject actions with
       redirect()->back()->with('error', ...) and no page rendered it, so refusals were silent.
       Success is deliberately NOT handled here: pages already call toast.success() in their
       own onSuccess handlers, and doing it again would show every success twice.
       Errors follow the project standard (toastError: no auto-close, close button). */
    const { flash } = usePage<SharedProps>().props;
    React.useEffect(() => {
        if (!flash) return;
        if (flash.error) toastError(flash.error);
        if (flash.warning) toast.warning(flash.warning);
        if (flash.info) toast.info(flash.info);
    }, [flash]);

    React.useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    React.useEffect(() => {
        localStorage.setItem('sidebar.collapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    React.useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 1024) setSidebarOpen(false);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    /* Pintasan "[" mengubah lebar rel (desktop), kecuali saat mengetik. */
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
            if (window.innerWidth < 1024) return;
            e.preventDefault();
            setSidebarCollapsed((c) => !c);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-ob-page text-ob-ink">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar
                open={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
                darkMode={darkMode}
                onToggleDark={() => setDarkMode((d) => !d)}
            />

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                {/* `relative` agar elemen sr-only/absolut di dalam halaman menjadi bagian gulir main,
                    bukan memperpanjang dokumen (yang memunculkan scrollbar jendela kedua). */}
                <main className="relative flex-1 overflow-y-auto">
                    <div className={contentClassName ?? 'mx-auto max-w-[1600px] px-4 pb-8 md:px-8'}>{children}</div>
                </main>
            </div>

            <FloatingFeedbackButton />
            <ResourceModalHost />

            <Toaster richColors position="top-right" />
        </div>
    );
}
