import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    Home,
    Landmark,
    Moon,
    ShieldCheck,
    Sun,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

/*
 * Rel navigasi Obsidian: "rel yang membuka labelnya".
 * Ciut 76 px = kolom ikon grup. Lebar 260 px = kolom ikon yang sama + panel label 184 px,
 * tanpa garis pemisah; ikon dan label duduk di baris 48 px yang sama. Grup aktif = satu pil
 * (bg-ob-invert) yang dimulai di belakang ikon dan berakhir di ujung label — saat diciutkan,
 * pil yang sama tinggal di ikonnya. Hanya satu grup terbuka (accordion). Spesifikasi:
 * artboard "Navigasi" di kanvas desain dan .claude/design-systems/archipelago.md → Obsidian.
 */

export const RAIL_WIDTH = 76;
export const RAIL_EXPANDED_WIDTH = 260;

interface SidebarProps {
    open: boolean;
    collapsed: boolean;
    onClose: () => void;
    onToggleCollapse: () => void;
    darkMode: boolean;
    onToggleDark: () => void;
}

type BadgeKey = 'reimbursements' | 'fund_requests';

interface NavItem {
    label: string;
    href: string;
    permission?: string;
    matchPrefix: string;
    badgeKey?: BadgeKey;
}

interface NavGroup {
    key: string;
    label: string;
    icon: React.ReactNode;
    /** Grup tanpa sub-item adalah tautan langsung. */
    href?: string;
    matchPrefix?: string;
    permission?: string;
    items: NavItem[];
}

const ICON = 'w-5 h-5 shrink-0';

const NAV: NavGroup[] = [
    {
        key: 'ringkasan',
        label: 'Ringkasan',
        icon: <Home className={ICON} />,
        href: '/dashboard',
        matchPrefix: '/dashboard',
        permission: 'view dashboard',
        items: [],
    },
    {
        key: 'keuangan',
        label: 'Keuangan',
        icon: <FileText className={ICON} />,
        items: [
            { label: 'Invoice', href: '/invoices', permission: 'view invoices', matchPrefix: '/invoices' },
            { label: 'Invoice Berulang', href: '/recurring-invoices', permission: 'view recurring-invoices', matchPrefix: '/recurring-invoices' },
            { label: 'Rekening Bank', href: '/bank-accounts', permission: 'view bank-accounts', matchPrefix: '/bank-accounts' },
        ],
    },
    {
        key: 'arus-kas',
        label: 'Arus Kas',
        icon: <TrendingUp className={ICON} />,
        items: [
            { label: 'Pemasukan', href: '/cash-flow/income', permission: 'view income', matchPrefix: '/cash-flow/income' },
            { label: 'Pengeluaran', href: '/cash-flow/expenses', permission: 'view expense', matchPrefix: '/cash-flow/expenses' },
            { label: 'Transfer & Penyesuaian', href: '/cash-flow/transfers', permission: 'view transfer', matchPrefix: '/cash-flow/transfers' },
        ],
    },
    {
        key: 'operasional',
        label: 'Operasional',
        icon: <ClipboardList className={ICON} />,
        items: [
            { label: 'Reimbursement', href: '/reimbursements', permission: 'view reimbursements', matchPrefix: '/reimbursements', badgeKey: 'reimbursements' },
            { label: 'Permintaan Dana', href: '/fund-requests', permission: 'view fund requests', matchPrefix: '/fund-requests', badgeKey: 'fund_requests' },
            { label: 'Kategori Transaksi', href: '/transaction-categories', permission: 'view categories', matchPrefix: '/transaction-categories' },
        ],
    },
    {
        key: 'utang-piutang',
        label: 'Utang & Piutang',
        icon: <Landmark className={ICON} />,
        items: [
            { label: 'Pinjaman', href: '/loans', permission: 'view loans', matchPrefix: '/loans' },
            { label: 'Piutang', href: '/receivables', permission: 'view receivables', matchPrefix: '/receivables' },
        ],
    },
    {
        key: 'master-data',
        label: 'Master Data',
        icon: <Users className={ICON} />,
        items: [
            { label: 'Klien', href: '/clients', permission: 'view clients', matchPrefix: '/clients' },
            { label: 'Layanan', href: '/services', permission: 'view services', matchPrefix: '/services' },
        ],
    },
    {
        key: 'laporan',
        label: 'Laporan',
        icon: <BarChart3 className={ICON} />,
        items: [
            { label: 'Laba Rugi', href: '/reports/profit-loss', permission: 'view profit-loss', matchPrefix: '/reports/profit-loss' },
        ],
    },
    {
        key: 'administrasi',
        label: 'Administrasi',
        icon: <ShieldCheck className={ICON} />,
        items: [
            { label: 'Pengguna', href: '/admin/users', permission: 'manage users', matchPrefix: '/admin/users' },
            { label: 'Izin & Peran', href: '/admin/permissions', permission: 'view permissions', matchPrefix: '/admin/permissions' },
            { label: 'Feedback', href: '/feedbacks', permission: 'view feedbacks', matchPrefix: '/feedbacks' },
        ],
    },
];

function matches(url: string, prefix: string): boolean {
    return url === prefix || url.startsWith(prefix + '/') || url.startsWith(prefix + '?');
}

function CountBadge({ count, className }: { count: number; className?: string }) {
    if (count <= 0) return null;
    return (
        <span
            className={cn(
                'inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-ob-badge px-1.5 text-xs font-bold text-ob-badge-ink',
                className,
            )}
        >
            {count > 99 ? '99+' : count}
        </span>
    );
}

/** Tooltip terang di kanan ikon saat rel diciutkan. */
function RailTooltip({ label, hint }: { label: string; hint?: string }) {
    return (
        <span
            role="tooltip"
            className="pointer-events-none absolute left-[60px] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-ob-invert px-2.5 py-1.5 text-xs font-semibold text-ob-invert-ink group-hover:inline-flex group-focus-visible:inline-flex items-center gap-2"
        >
            {label}
            {hint && <span className="font-medium opacity-60">{hint}</span>}
        </span>
    );
}

export function Sidebar({ open, collapsed, onClose, onToggleCollapse, darkMode, onToggleDark }: SidebarProps) {
    const { auth, actionCounts } = usePage<SharedProps>().props;
    const permissions = auth.permissions;
    const currentUrl = usePage().url;

    const can = (permission?: string) => !permission || permissions.includes(permission);

    /* Drawer di layar kecil selalu lebar; ciut hanya berlaku di desktop. */
    const isCollapsed = collapsed && !open;

    const groups = React.useMemo(
        () =>
            NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter(
                (g) => (g.href ? can(g.permission) : g.items.length > 0),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [permissions],
    );

    const activeGroupKey = React.useMemo(() => {
        const hit = groups.find(
            (g) =>
                (g.matchPrefix && matches(currentUrl, g.matchPrefix)) ||
                g.items.some((i) => matches(currentUrl, i.matchPrefix)),
        );
        return hit?.key ?? null;
    }, [groups, currentUrl]);

    /* Satu grup terbuka; mengikuti halaman aktif, bisa dibuka manual, menutup yang lain. */
    const [openKey, setOpenKey] = React.useState<string | null>(activeGroupKey);
    React.useEffect(() => setOpenKey(activeGroupKey), [activeGroupKey]);

    /* Flyout untuk rel ciut: posisi tetap (fixed) supaya tidak terpotong oleh area gulir. */
    const [flyout, setFlyout] = React.useState<{ key: string; top: number } | null>(null);
    const asideRef = React.useRef<HTMLElement>(null);

    React.useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
                setFlyout(null);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setFlyout(null);
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, []);

    React.useEffect(() => {
        setFlyout(null);
    }, [currentUrl, isCollapsed]);

    const badgeOf = (item: NavItem) => (item.badgeKey ? actionCounts?.[item.badgeKey] ?? 0 : 0);
    const groupBadge = (g: NavGroup) => g.items.reduce((n, i) => n + badgeOf(i), 0);


    const rowBase =
        'group relative flex h-12 items-center rounded-xl text-[13px] transition-colors duration-150 ob-motion focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-rail';
    const rowIdle = 'text-ob-ink-3 hover:bg-ob-hover hover:text-ob-ink font-medium';
    const rowActive = 'bg-ob-invert text-ob-invert-ink font-semibold';

    const flyoutGroup = flyout ? groups.find((g) => g.key === flyout.key) : null;

    return (
        <aside
            ref={asideRef}
            aria-label="Navigasi utama"
            style={{ width: isCollapsed ? RAIL_WIDTH : RAIL_EXPANDED_WIDTH }}
            className={cn(
                'fixed lg:relative z-50 lg:z-auto h-full flex shrink-0 flex-col bg-ob-rail border-r border-ob-line',
                'ob-motion transition-[width,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                // lg:translate-none, bukan lg:translate-x-0: nilai translate apa pun (termasuk 0) membuat
                // stacking context, sehingga flyout & tooltip rel (z-50) tertutup konten utama.
                open ? 'translate-x-0' : '-translate-x-full lg:translate-none',
            )}
            data-sidebar-collapsed={isCollapsed}
        >
            {/* Header: logo + nama (label memudar masuk saat rel dibuka) */}
            <div className="flex h-11 items-center gap-3 pl-[14px] pr-3 mt-5 mb-[18px]">
                <span
                    aria-label="Kisantra"
                    className="flex h-11 w-12 shrink-0 items-center justify-center rounded-xl border border-ob-line bg-ob-inner"
                >
                    <img src="/images/kisantra.png" alt="" className="h-6 w-6 object-contain" />
                </span>
                {!isCollapsed && (
                    <span className="min-w-0 flex-1 leading-tight ob-fade-in">
                        <span className="block truncate text-[13px] font-semibold text-ob-ink">Kisantra Finance</span>
                        <span className="block truncate text-xs text-ob-ink-3">Finance Management</span>
                    </span>
                )}
                {open && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup navigasi"
                        className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-ob-ink-3 hover:bg-ob-hover hover:text-ob-ink"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Grup */}
            <nav className="ob-scroll flex-1 min-h-0 pr-3" aria-label="Menu">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 pl-[14px]">
                    {groups.map((g) => {
                        const isActive = g.key === activeGroupKey;
                        const isOpen = !isCollapsed && g.key === openKey && g.items.length > 0;
                        const badge = groupBadge(g);
                        const iconBox = (
                            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                                {g.icon}
                                {isCollapsed && (
                                    <CountBadge count={badge} className="absolute right-1 top-1" />
                                )}
                            </span>
                        );
                        const label = !isCollapsed && (
                            <span className="min-w-0 flex-1 truncate pl-0.5">{g.label}</span>
                        );

                        /* Grup tanpa sub-item: tautan langsung. */
                        if (g.href) {
                            return (
                                <li key={g.key}>
                                    <Link
                                        href={g.href}
                                        onClick={onClose}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={cn(rowBase, isActive ? rowActive : rowIdle)}
                                    >
                                        {iconBox}
                                        {label}
                                        {isCollapsed && <RailTooltip label={g.label} />}
                                    </Link>
                                </li>
                            );
                        }

                        const onGroupClick = (e: React.MouseEvent<HTMLButtonElement>) => {
                            if (isCollapsed) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setFlyout((f) => (f?.key === g.key ? null : { key: g.key, top: rect.top }));
                            } else {
                                setOpenKey((k) => (k === g.key ? null : g.key));
                            }
                        };

                        return (
                            <li key={g.key}>
                                <button
                                    type="button"
                                    onClick={onGroupClick}
                                    aria-expanded={isCollapsed ? flyout?.key === g.key : isOpen}
                                    aria-haspopup={isCollapsed ? 'menu' : undefined}
                                    aria-current={isActive ? 'true' : undefined}
                                    className={cn(rowBase, 'w-full text-left', isActive ? rowActive : rowIdle)}
                                >
                                    {iconBox}
                                    {label}
                                    {!isCollapsed && (
                                        badge > 0 ? (
                                            <CountBadge count={badge} className="mr-3.5" />
                                        ) : (
                                            <ChevronRight
                                                className={cn(
                                                    'mr-3 h-3.5 w-3.5 shrink-0 transition-transform duration-150',
                                                    isOpen && 'rotate-90',
                                                    isActive ? 'text-ob-invert-ink' : 'text-ob-ink-3',
                                                )}
                                            />
                                        )
                                    )}
                                    {isCollapsed && (
                                        <RailTooltip label={g.label} hint={g.items.map((i) => i.label).join(' · ')} />
                                    )}
                                </button>

                                {/* Sub-item: menggantung di garis pandu dari ikon grupnya */}
                                {isOpen && (
                                    <ul className="relative m-0 mt-1 mb-2 ml-6 list-none py-0.5 pl-[22px] pr-0 flex flex-col gap-0.5 ob-fade-in">
                                        <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-px bg-ob-line-strong" />
                                        {g.items.map((item) => {
                                            const cur = matches(currentUrl, item.matchPrefix);
                                            const count = badgeOf(item);
                                            return (
                                                <li key={item.href}>
                                                    <Link
                                                        href={item.href}
                                                        onClick={onClose}
                                                        aria-current={cur ? 'page' : undefined}
                                                        className={cn(
                                                            'flex h-[34px] items-center justify-between gap-2 rounded-[10px] pl-3.5 pr-3 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                                                            cur
                                                                ? 'bg-ob-inner font-semibold text-ob-ink'
                                                                : 'font-medium text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink',
                                                        )}
                                                    >
                                                        <span className="truncate">{item.label}</span>
                                                        {count > 0 && (
                                                            <span className={cn('text-xs font-medium', cur ? 'text-ob-ink-2' : 'text-ob-ink-3')}>
                                                                {count}
                                                            </span>
                                                        )}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Flyout grup untuk rel ciut */}
            {isCollapsed && flyout && flyoutGroup && (
                <div
                    role="menu"
                    aria-label={flyoutGroup.label}
                    style={{ top: flyout.top, left: RAIL_WIDTH + 8 }}
                    className="fixed z-50 flex w-48 flex-col gap-0.5 rounded-2xl border border-ob-line bg-ob-card p-2 shadow-xl shadow-black/20 ob-fade-in"
                >
                    <span className="px-2.5 pt-1.5 pb-2 text-xs font-semibold text-ob-ink-3">{flyoutGroup.label}</span>
                    {flyoutGroup.items.map((item) => {
                        const cur = matches(currentUrl, item.matchPrefix);
                        const count = badgeOf(item);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                role="menuitem"
                                onClick={() => setFlyout(null)}
                                className={cn(
                                    'flex h-[34px] items-center justify-between rounded-[10px] px-2.5 text-[13px]',
                                    cur ? 'bg-ob-inner font-semibold text-ob-ink' : 'font-medium text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink',
                                )}
                            >
                                <span className="truncate">{item.label}</span>
                                {count > 0 && <span className="text-xs text-ob-ink-3">{count}</span>}
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Pengalih tema (akun kini ada di header) */}
            <div className="mt-2 pl-[14px] pr-3 pb-2.5">
                {isCollapsed ? (
                    <button
                        type="button"
                        onClick={onToggleDark}
                        aria-label={darkMode ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
                        className="group relative flex h-12 w-12 items-center justify-center rounded-xl text-ob-ink-3 hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                    >
                        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        <RailTooltip label={darkMode ? 'Tema terang' : 'Tema gelap'} />
                    </button>
                ) : (
                    <div role="group" aria-label="Tema" className="flex gap-0.5 rounded-full border border-ob-line bg-ob-card p-[3px]">
                        {(
                            [
                                { dark: true, label: 'Gelap', icon: <Moon className="h-3.5 w-3.5" /> },
                                { dark: false, label: 'Terang', icon: <Sun className="h-3.5 w-3.5" /> },
                            ] as const
                        ).map((opt) => {
                            const pressed = darkMode === opt.dark;
                            return (
                                <button
                                    key={opt.label}
                                    type="button"
                                    aria-pressed={pressed}
                                    onClick={() => !pressed && onToggleDark()}
                                    className={cn(
                                        'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                                        pressed ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink',
                                    )}
                                >
                                    {opt.icon}
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Ciut / lebar (desktop) */}
            <div className="hidden lg:block pl-[14px] pr-3 pb-5">
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? 'Perlebar navigasi, pintasan [' : 'Ciutkan navigasi, pintasan ['}
                    className={cn(
                        'group relative flex h-9 items-center gap-2.5 rounded-xl border border-ob-line text-xs font-medium text-ob-ink-3 hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                        isCollapsed ? 'w-12 justify-center' : 'w-full px-3.5',
                    )}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {!isCollapsed && <span className="flex-1 text-left">Ciutkan</span>}
                    {!isCollapsed && (
                        <kbd className="rounded-md border border-ob-line px-1.5 text-xs leading-[18px]">[</kbd>
                    )}
                    {isCollapsed && <RailTooltip label="Perlebar" hint="[" />}
                </button>
            </div>
        </aside>
    );
}
