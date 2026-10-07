import { Link, router, usePage } from '@inertiajs/react';
import { Building2, ChevronDown, ChevronRight, LogOut, Menu, Settings } from 'lucide-react';
import * as React from 'react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { NotificationDrawer } from '@/components/notifications/notification-drawer';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

/*
 * Header Obsidian: duduk di atas latar halaman tanpa garis, kontrolnya memakai lapis rel
 * (bg-ob-rail) berbentuk pil supaya tidak menyatu dengan grid kartu. Pengalih tema sudah
 * pindah ke kartu ruang kerja di rel navigasi.
 */

interface HeaderProps {
    onMenuClick: () => void;
}

interface BreadcrumbItem {
    label: string;
    href?: string;
}

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
    '/dashboard': [{ label: 'Ringkasan' }],
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
    '/transaction-categories': [{ label: 'Operasional' }, { label: 'Kategori Transaksi' }],
    '/fund-requests': [{ label: 'Operasional' }, { label: 'Permintaan Dana' }],
    '/reimbursements': [{ label: 'Operasional' }, { label: 'Reimbursement' }],
    '/loans': [{ label: 'Utang & Piutang' }, { label: 'Pinjaman' }],
    '/receivables': [{ label: 'Utang & Piutang' }, { label: 'Piutang' }],
    '/reports/profit-loss': [{ label: 'Laporan' }, { label: 'Laba Rugi' }],
    '/feedbacks': [{ label: 'Administrasi' }, { label: 'Feedback' }],
    '/admin/permissions': [{ label: 'Administrasi' }, { label: 'Izin & Peran' }],
    '/admin/users': [{ label: 'Administrasi' }, { label: 'Pengguna' }],
    '/settings': [{ label: 'Pengaturan' }],
    '/settings/profile': [{ label: 'Pengaturan' }, { label: 'Profil' }],
    '/settings/password': [{ label: 'Pengaturan' }, { label: 'Kata Sandi' }],
    '/settings/company': [{ label: 'Pengaturan' }, { label: 'Profil Perusahaan' }],
    '/settings/invoice-numbering': [{ label: 'Pengaturan' }, { label: 'Penomoran Invoice' }],
    '/settings/pdf-templates': [{ label: 'Pengaturan' }, { label: 'Template PDF' }],
};

function getBreadcrumbs(url: string): BreadcrumbItem[] {
    const path = url.split('?')[0];
    if (BREADCRUMB_MAP[path]) return BREADCRUMB_MAP[path];
    const prefixMatch = Object.entries(BREADCRUMB_MAP).find(
        ([key]) => key !== '/' && path.startsWith(key + '/'),
    );
    return prefixMatch ? prefixMatch[1] : [{ label: 'Ringkasan' }];
}

const LOCALES = [
    { code: 'id', label: 'ID', name: 'Indonesia' },
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'zh', label: 'ZH', name: '中文' },
];

const PILL =
    'flex items-center justify-center rounded-full border border-ob-line bg-ob-rail text-ob-ink transition-colors hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

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
        router.post('/language', { locale: code }, { preserveScroll: false });
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Bahasa: ${current.name}`}
                className={cn(PILL, 'h-11 px-4 text-xs font-semibold')}
            >
                {current.label}
            </button>
            {open && (
                <div
                    role="listbox"
                    className="absolute right-0 top-full z-50 mt-1.5 flex w-40 flex-col gap-0.5 rounded-2xl border border-ob-line bg-ob-card p-2 shadow-xl shadow-black/20"
                >
                    {LOCALES.map((loc) => (
                        <button
                            key={loc.code}
                            type="button"
                            role="option"
                            aria-selected={loc.code === locale}
                            onClick={() => switchLocale(loc.code)}
                            className={cn(
                                'flex h-[34px] items-center justify-between rounded-[10px] px-2.5 text-[13px] text-left',
                                loc.code === locale
                                    ? 'bg-ob-inner font-semibold text-ob-ink'
                                    : 'font-medium text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink',
                            )}
                        >
                            <span>{loc.name}</span>
                            <span className="text-xs text-ob-ink-3">{loc.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Chip akun: avatar inisial + nama + peran; membuka menu profil, perusahaan, keluar. */
function UserChip() {
    const { auth } = usePage<SharedProps>().props;
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const user = auth.user;
    const initials = user?.name
        ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
        : 'U';

    React.useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, []);

    const item = 'flex h-[34px] items-center gap-2 rounded-[10px] px-2.5 text-[13px] font-medium text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink';

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Akun: ${user?.name ?? 'Pengguna'}`}
                className={cn(PILL, 'h-11 gap-2.5 pl-1.5 pr-3.5')}
            >
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-ob-chip text-xs font-bold text-ob-ink">
                    {initials}
                </span>
                <span aria-hidden="true" className="hidden flex-col items-start leading-tight sm:flex">
                    <span className="max-w-40 truncate text-[13px] font-semibold text-ob-ink">{user?.name ?? 'Pengguna'}</span>
                    <span className="text-xs text-ob-ink-2">{auth.roles?.[0] ?? ''}</span>
                </span>
                <ChevronDown className={cn('hidden h-4 w-4 text-ob-ink-3 transition-transform sm:block', open && 'rotate-180')} />
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1.5 flex w-56 flex-col gap-0.5 rounded-2xl border border-ob-line bg-ob-card p-2 shadow-xl shadow-black/20 ob-fade-in"
                >
                    <span className="truncate px-2.5 pt-1.5 pb-2 text-xs text-ob-ink-3">{user?.email ?? ''}</span>
                    <Link href="/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
                        <Settings className="h-4 w-4 opacity-70" /> Pengaturan
                    </Link>
                    <Link href="/settings/company" role="menuitem" className={item} onClick={() => setOpen(false)}>
                        <Building2 className="h-4 w-4 opacity-70" /> Profil perusahaan
                    </Link>
                    {/* Lewat klien Inertia agar token CSRF selalu segar (riwayat "419 PAGE EXPIRED"). */}
                    <button type="button" role="menuitem" onClick={() => router.post('/logout')} className={cn(item, 'text-ob-late hover:text-ob-late')}>
                        <LogOut className="h-4 w-4 opacity-80" /> Keluar
                    </button>
                </div>
            )}
        </div>
    );
}

export function Header({ onMenuClick }: HeaderProps) {
    const { locale } = usePage<SharedProps>().props;
    const currentUrl = usePage().url;
    const breadcrumbs = getBreadcrumbs(currentUrl);
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    return (
        /* Tinggi 84 = padding rel 20 + tile logo 44 + 20: kontrol header sejajar dengan logo perusahaan. */
        <header className="flex h-[84px] shrink-0 items-center gap-3 bg-ob-page px-4 md:px-8">
            <button
                type="button"
                onClick={onMenuClick}
                aria-label="Buka navigasi"
                className={cn(PILL, 'lg:hidden h-11 w-11 shrink-0')}
            >
                <Menu className="h-5 w-5" />
            </button>

            <nav aria-label="Lokasi" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
                {breadcrumbs.map((crumb, i) => {
                    const last = i === breadcrumbs.length - 1;
                    return (
                        <React.Fragment key={i}>
                            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ob-ink-3/60" />}
                            {last ? (
                                <span className="truncate font-semibold text-ob-ink">{crumb.label}</span>
                            ) : crumb.href ? (
                                <Link href={crumb.href} className="shrink-0 font-medium text-ob-ink-3 hover:text-ob-ink">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="shrink-0 font-medium text-ob-ink-3">{crumb.label}</span>
                            )}
                        </React.Fragment>
                    );
                })}
            </nav>

            <div className="flex shrink-0 items-center gap-2.5">
                <LanguageSwitcher locale={locale} />
                <div className={cn(PILL, 'h-11 w-11')}>
                    <NotificationBell onOpenDrawer={() => setDrawerOpen(true)} />
                </div>
                <UserChip />
            </div>

            <NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
        </header>
    );
}
