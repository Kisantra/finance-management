import { router, usePage } from '@inertiajs/react';
import { Building2, Check, ChevronDown, ChevronRight, LogOut, Menu, Settings } from 'lucide-react';
import * as React from 'react';
import { AppLink } from '@/components/app-link';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { NotificationDrawer } from '@/components/notifications/notification-drawer';
import { t, tk } from '@/i18n';
import { appPath } from '@/lib/company';
import { roleLabel } from '@/lib/roles';
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

/** Label = kunci terjemahan konteks 'menu' (sama dengan rel navigasi); diterjemahkan saat render lewat menu(). */
const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
    '/dashboard': [{ label: tk('Ringkasan', 'menu') }],
    '/clients': [{ label: tk('Master Data', 'menu') }, { label: tk('Klien', 'menu') }],
    '/services': [{ label: tk('Master Data', 'menu') }, { label: tk('Layanan', 'menu') }],
    '/invoices': [{ label: tk('Keuangan', 'menu') }, { label: tk('Invoice', 'menu') }],
    '/invoices/create': [
        { label: tk('Keuangan', 'menu') },
        { label: tk('Invoice', 'menu'), href: '/invoices' },
        { label: tk('Buat Baru', 'menu') },
    ],
    '/recurring-invoices': [{ label: tk('Keuangan', 'menu') }, { label: tk('Invoice Berulang', 'menu') }],
    '/bank-accounts': [{ label: tk('Keuangan', 'menu') }, { label: tk('Kas & Bank', 'menu') }],
    '/cash-flow/all': [{ label: tk('Arus Kas', 'menu') }, { label: tk('Pemasukan & Pengeluaran', 'menu') }],
    '/cash-flow/income': [
        { label: tk('Arus Kas', 'menu') },
        { label: tk('Pemasukan & Pengeluaran', 'menu'), href: '/cash-flow' },
        { label: tk('Pemasukan', 'menu') },
    ],
    '/cash-flow/expenses': [
        { label: tk('Arus Kas', 'menu') },
        { label: tk('Pemasukan & Pengeluaran', 'menu'), href: '/cash-flow' },
        { label: tk('Pengeluaran', 'menu') },
    ],
    '/cash-flow/transfers': [{ label: tk('Arus Kas', 'menu') }, { label: tk('Transfer & Penyesuaian', 'menu') }],
    '/transaction-categories': [{ label: tk('Operasional', 'menu') }, { label: tk('Kategori Transaksi', 'menu') }],
    '/fund-requests': [{ label: tk('Operasional', 'menu') }, { label: tk('Permintaan Dana', 'menu') }],
    '/reimbursements': [{ label: tk('Operasional', 'menu') }, { label: tk('Reimbursement', 'menu') }],
    '/loans': [{ label: tk('Utang & Piutang', 'menu') }, { label: tk('Utang', 'menu') }],
    '/receivables': [{ label: tk('Utang & Piutang', 'menu') }, { label: tk('Piutang', 'menu') }],
    '/reports/profit-loss': [{ label: tk('Laporan', 'menu') }, { label: tk('Laba Rugi', 'menu') }],
    '/feedbacks': [{ label: tk('Administrasi', 'menu') }, { label: tk('Feedback', 'menu') }],
    '/admin/permissions': [{ label: tk('Administrasi', 'menu') }, { label: tk('Izin & Peran', 'menu') }],
    '/admin/users': [{ label: tk('Administrasi', 'menu') }, { label: tk('Pengguna', 'menu') }],
    '/admin/companies': [{ label: tk('Administrasi', 'menu') }, { label: tk('Perusahaan', 'menu') }],
    '/panduan': [{ label: tk('Panduan', 'menu') }],
    '/settings': [{ label: tk('Pengaturan', 'menu') }],
    '/settings/profile': [{ label: tk('Pengaturan', 'menu') }, { label: tk('Profil', 'menu') }],
    '/settings/password': [{ label: tk('Pengaturan', 'menu') }, { label: tk('Kata Sandi', 'menu') }],
    '/settings/claude': [{ label: tk('Pengaturan', 'menu') }, { label: tk('Koneksi Claude', 'menu') }],
    '/settings/company': [{ label: tk('Pengaturan', 'menu') }, { label: tk('Profil Perusahaan', 'menu') }],
    '/settings/invoice-numbering': [{ label: tk('Pengaturan', 'menu') }, { label: tk('Penomoran Invoice', 'menu') }],
    '/settings/pdf-templates': [{ label: tk('Pengaturan', 'menu') }, { label: tk('Template PDF', 'menu') }],
};

function getBreadcrumbs(url: string): BreadcrumbItem[] {
    const path = appPath(url).split('?')[0];
    if (BREADCRUMB_MAP[path]) return BREADCRUMB_MAP[path];
    const prefixMatch = Object.entries(BREADCRUMB_MAP).find(
        ([key]) => key !== '/' && path.startsWith(key + '/'),
    );
    return prefixMatch ? prefixMatch[1] : [{ label: tk('Ringkasan', 'menu') }];
}

/** Terjemahan label menu/breadcrumb (konteks 'menu': EN jamak "Invoices", sedangkan kolom "Invoice"). */
const menu = (label: string) => t(label, { context: 'menu' });

const PILL =
    'flex items-center justify-center rounded-full border border-ob-line bg-ob-rail text-ob-ink transition-colors hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

/** Chip akun: avatar inisial + nama + peran; membuka menu profil, perusahaan, keluar. */
function UserChip() {
    const { auth, company, companies } = usePage<SharedProps>().props;
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
                aria-label={t('Akun: {{name}}', { name: user?.name ?? t('Pengguna', { context: 'nama' }) })}
                className={cn(PILL, 'h-11 gap-2.5 pl-1.5 pr-3.5')}
            >
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-ob-chip text-xs font-bold text-ob-ink">
                    {initials}
                </span>
                <span aria-hidden="true" className="hidden flex-col items-start leading-tight sm:flex">
                    <span className="max-w-40 truncate text-[13px] font-semibold text-ob-ink">{user?.name ?? t('Pengguna', { context: 'nama' })}</span>
                    <span className="text-xs text-ob-ink-2">{auth.roles?.[0] ? roleLabel(auth.roles[0]) : ''}</span>
                </span>
                <ChevronDown className={cn('hidden h-4 w-4 text-ob-ink-3 transition-transform sm:block', open && 'rotate-180')} />
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1.5 flex w-56 flex-col gap-0.5 rounded-2xl border border-ob-line bg-ob-card p-2 shadow-xl shadow-black/20 ob-fade-in"
                >
                    <span className="truncate px-2.5 pt-1.5 pb-2 text-xs text-ob-ink-3">{user?.email ?? ''}</span>
                    {/*
                     * Pengalih perusahaan. Hanya muncul bila pengguna memang anggota lebih
                     * dari satu perusahaan — pengguna satu perusahaan tidak perlu tahu
                     * fitur grup ini ada.
                     *
                     * Sengaja <a href> biasa, BUKAN AppLink: AppLink menambahkan prefix
                     * perusahaan AKTIF, padahal di sini tujuannya justru perusahaan LAIN.
                     * Muat ulang penuh juga yang paling aman — berpindah perusahaan berarti
                     * berpindah database, jadi seluruh state halaman lama harus dibuang.
                     */}
                    {companies.length > 1 && (
                        <>
                            <span className="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-ob-ink-3">{menu('Perusahaan')}</span>
                            {companies.map((c) => {
                                const aktif = c.slug === company?.slug;

                                return (
                                    <a
                                        key={c.slug}
                                        href={`/c/${c.slug}/dashboard`}
                                        role="menuitem"
                                        aria-current={aktif ? 'true' : undefined}
                                        className={cn(item, aktif && 'bg-ob-hover text-ob-ink')}
                                    >
                                        <Building2 className="h-4 w-4 shrink-0 opacity-70" />
                                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                                        {aktif && <Check className="h-4 w-4 shrink-0 opacity-80" />}
                                    </a>
                                );
                            })}
                            <span className="my-1 h-px bg-ob-line" />
                        </>
                    )}
                    <AppLink href="/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
                        <Settings className="h-4 w-4 opacity-70" /> {menu('Pengaturan')}
                    </AppLink>
                    <AppLink href="/settings/company" role="menuitem" className={item} onClick={() => setOpen(false)}>
                        <Building2 className="h-4 w-4 opacity-70" /> {t('Profil perusahaan')}
                    </AppLink>
                    {/* Lewat klien Inertia agar token CSRF selalu segar (riwayat "419 PAGE EXPIRED"). */}
                    <button type="button" role="menuitem" onClick={() => router.post('/logout')} className={cn(item, 'text-ob-late hover:text-ob-late')}>
                        <LogOut className="h-4 w-4 opacity-80" /> {t('Keluar')}
                    </button>
                </div>
            )}
        </div>
    );
}

export function Header({ onMenuClick }: HeaderProps) {
    const currentUrl = usePage().url;
    const breadcrumbs = getBreadcrumbs(currentUrl);
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    return (
        /* Tinggi 84 = padding rel 20 + tile logo 44 + 20: kontrol header sejajar dengan logo perusahaan. */
        <header className="flex h-[84px] shrink-0 items-center gap-3 bg-ob-page px-4 md:px-8">
            <button
                type="button"
                onClick={onMenuClick}
                aria-label={t('Buka navigasi')}
                className={cn(PILL, 'lg:hidden h-11 w-11 shrink-0')}
            >
                <Menu className="h-5 w-5" />
            </button>

            <nav aria-label={t('Lokasi')} className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
                {breadcrumbs.map((crumb, i) => {
                    const last = i === breadcrumbs.length - 1;
                    return (
                        <React.Fragment key={i}>
                            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ob-ink-3/60" />}
                            {last ? (
                                <span className="truncate font-semibold text-ob-ink">{menu(crumb.label)}</span>
                            ) : crumb.href ? (
                                <AppLink href={crumb.href} className="shrink-0 font-medium text-ob-ink-3 hover:text-ob-ink">
                                    {menu(crumb.label)}
                                </AppLink>
                            ) : (
                                <span className="shrink-0 font-medium text-ob-ink-3">{menu(crumb.label)}</span>
                            )}
                        </React.Fragment>
                    );
                })}
            </nav>

            <div className="flex shrink-0 items-center gap-2.5">
                <LanguageSwitcher compact className="h-11 bg-ob-rail px-4" />
                <div className={cn(PILL, 'h-11 w-11')}>
                    <NotificationBell onOpenDrawer={() => setDrawerOpen(true)} />
                </div>
                <UserChip />
            </div>

            <NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
        </header>
    );
}
