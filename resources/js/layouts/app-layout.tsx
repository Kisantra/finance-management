import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { Toaster, toast } from 'sonner';
import { toastError } from '@/lib/utils';
import type { SharedProps } from '@/types';
import { FloatingFeedbackButton } from '@/components/floating-feedback-button';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
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

    return (
        <div className="flex h-screen overflow-hidden">
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
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    onMenuClick={() => setSidebarOpen(true)}
                    darkMode={darkMode}
                    onToggleDark={() => setDarkMode((d) => !d)}
                />
                <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-950">
                    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">{children}</div>
                </main>
            </div>

            <FloatingFeedbackButton />

            <Toaster richColors position="top-right" />
        </div>
    );
}
