import { Link, router, usePage } from '@inertiajs/react';
import { Bell, Menu, Moon, Sun } from 'lucide-react';
import * as React from 'react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { NotificationDrawer } from '@/components/notifications/notification-drawer';
import { appPath, companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

interface HeaderProps {
    onMenuClick: () => void;
    darkMode: boolean;
    onToggleDark: () => void;
}

interface BreadcrumbItem {
    label: string;
    href?: string;
}

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
    '/dashboard': [{ label: 'Dashboard' }],
    '/clients': [{ label: 'Master Data' }, { label: 'Klien' }],
    '/services': [{ label: 'Master Data' }, { label: 'Layanan' }],
    '/invoices': [{ label: 'Keuangan' }, { label: 'Invoice' }],
    '/invoices/create': [
        { label: 'Keuangan' },
        { label: 'Invoice', href: '/invoices' },
        { label: 'Buat Baru' },
    ],
    '/recurring-invoices': [{ label: 'Keuangan' }, { label: 'Invoice Berulang' }],
    '/bank-accounts': [{ label: 'Keuangan' }, { label: 'Rekening Bank' }],
    '/cash-flow/income': [{ label: 'Arus Kas' }, { label: 'Pemasukan' }],
    '/cash-flow/expenses': [{ label: 'Arus Kas' }, { label: 'Pengeluaran' }],
    '/cash-flow/transfers': [{ label: 'Arus Kas' }, { label: 'Transfer & Penyesuaian' }],
    '/transaction-categories': [{ label: 'Operasional' }, { label: 'Kategori' }],
    '/fund-requests': [{ label: 'Operasional' }, { label: 'Permintaan Dana' }],
    '/reimbursements': [{ label: 'Operasional' }, { label: 'Reimbursement' }],
    '/loans': [{ label: 'Utang & Piutang' }, { label: 'Pinjaman' }],
    '/receivables': [{ label: 'Utang & Piutang' }, { label: 'Piutang' }],
    '/feedbacks': [{ label: 'Administrasi' }, { label: 'Feedback' }],
    '/permissions': [{ label: 'Administrasi' }, { label: 'Izin & Peran' }],
    '/admin/users': [{ label: 'Administrasi' }, { label: 'Pengguna' }],
    '/admin/companies': [{ label: 'Administrasi' }, { label: 'Perusahaan' }],
    '/settings/profile': [{ label: 'Pengaturan' }, { label: 'Profil' }],
    '/settings/password': [{ label: 'Pengaturan' }, { label: 'Kata Sandi' }],
    '/settings/company': [{ label: 'Pengaturan' }, { label: 'Profil Perusahaan' }],
};

function getBreadcrumbs(url: string): BreadcrumbItem[] {
    // BREADCRUMB_MAP berpikir dalam path aplikasi — kupas prefix /c/{slug}
    const path = appPath(url).split('?')[0];

    if (BREADCRUMB_MAP[path]) return BREADCRUMB_MAP[path];

    // Prefix matching for dynamic routes
    const prefixMatch = Object.entries(BREADCRUMB_MAP).find(
        ([key]) => key !== '/' && path.startsWith(key + '/'),
    );
    return prefixMatch ? prefixMatch[1] : [{ label: 'Dashboard' }];
}

const LOCALES = [
    { code: 'id', label: 'ID', name: 'Indonesia', flag: '🇮🇩' },
    { code: 'en', label: 'EN', name: 'English', flag: '🇬🇧' },
    { code: 'zh', label: 'ZH', name: '中文', flag: '🇨🇳' },
];

function LanguageSwitcher({ locale }: { locale: string }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const switchLocale = (code: string) => {
        setOpen(false);
        router.post(
            '/language',
            { locale: code },
            { preserveScroll: false },
        );
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
                <span>{current.flag}</span>
                <span>{current.label}</span>
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-dark-700 border border-gray-100 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden z-50">
                    <div className="p-1">
                        {LOCALES.map((loc) => (
                            <button
                                key={loc.code}
                                onClick={() => switchLocale(loc.code)}
                                className={cn(
                                    'flex items-center gap-2 w-full px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left',
                                    loc.code === locale
                                        ? 'font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                        : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/[0.06]',
                                )}
                            >
                                <span>{loc.flag}</span>
                                <span>{loc.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function Header({ onMenuClick, darkMode, onToggleDark }: HeaderProps) {
    const { locale } = usePage<SharedProps>().props;
    const currentUrl = usePage().url;
    const breadcrumbs = getBreadcrumbs(currentUrl);
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    return (
        <header className="h-14 shrink-0 flex items-center gap-3 px-4 md:px-6 bg-white/80 dark:bg-dark-900/80 backdrop-blur-[12px] border-b border-gray-100 dark:border-white/[0.06]">
            {/* Mobile hamburger */}
            <button
                onClick={onMenuClick}
                className="lg:hidden p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors shrink-0"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm flex-1 overflow-x-auto scrollbar-none">
                <Link
                    href={companyUrl('/dashboard')}
                    className="shrink-0 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                >
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z"
                        />
                    </svg>
                </Link>

                {breadcrumbs.map((crumb, i) => (
                    <React.Fragment key={i}>
                        <svg
                            className="w-3 h-3 text-gray-300 dark:text-zinc-700 shrink-0 opacity-35"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 18l6-6-6-6"
                            />
                        </svg>
                        {i === breadcrumbs.length - 1 ? (
                            <span className="text-gray-700 dark:text-zinc-200 font-medium whitespace-nowrap text-sm shrink-0">
                                {crumb.label}
                            </span>
                        ) : crumb.href ? (
                            <Link
                                href={companyUrl(crumb.href)}
                                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors text-sm whitespace-nowrap shrink-0"
                            >
                                {crumb.label}
                            </Link>
                        ) : (
                            <span className="text-gray-400 dark:text-zinc-600 text-sm whitespace-nowrap shrink-0">
                                {crumb.label}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1 shrink-0">
                <LanguageSwitcher locale={locale} />

                <button
                    onClick={onToggleDark}
                    title={darkMode ? 'Mode terang' : 'Mode gelap'}
                    className="p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                <NotificationBell onOpenDrawer={() => setDrawerOpen(true)} />
            </div>

            <NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
        </header>
    );
}
