import { usePage } from '@inertiajs/react';
import * as React from 'react';
import { Toaster } from 'sonner';
import { FloatingFeedbackButton } from '@/components/floating-feedback-button';
import { setActiveCompany } from '@/lib/company';
import type { SharedProps } from '@/types';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    // Konteks perusahaan disinkronkan SAAT RENDER, sebelum Sidebar/Header
    // membangun URL-nya. Mengandalkan event `navigate` (inertia.tsx) terlambat:
    // event itu menyala setelah render pertama, sehingga navigasi dari halaman
    // central (login/choose-company) ke halaman perusahaan menghasilkan menu
    // tanpa prefix /c/{slug} sampai halaman di-reload manual.
    const company = usePage<SharedProps>().props.company;
    setActiveCompany(company?.slug ?? null);

    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(
        () => typeof window !== 'undefined' && localStorage.getItem('sidebar.collapsed') === 'true',
    );
    const [darkMode, setDarkMode] = React.useState(() => {
        if (typeof window === 'undefined') return false;
        const stored = localStorage.getItem('theme');
        return stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

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
