import { Link, usePage } from '@inertiajs/react';
import { appPath, companyUrl } from '@/lib/company';
import {
    ArrowLeftRight,
    Briefcase,
    Building2,
    ChevronLeft,
    ChevronsUpDown,
    CreditCard,
    FileBarChart,
    FileText,
    FolderOpen,
    LayoutDashboard,
    MessageSquare,
    Receipt,
    RefreshCw,
    Shield,
    TrendingDown,
    TrendingUp,
    UserCog,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import * as React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

interface SidebarProps {
    open: boolean;
    collapsed: boolean;
    onClose: () => void;
    onToggleCollapse: () => void;
}

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    permission?: string;
    matchPrefix?: string;
    comingSoon?: boolean;
    /** Key into the shared actionCounts prop for a "needs action" badge. */
    badgeKey?: 'reimbursements' | 'fund_requests';
}

interface NavSection {
    title: string;
    items: NavItem[];
    anyPermission?: string[];
}

const NAV: NavSection[] = [
    {
        title: '',
        anyPermission: ['view dashboard'],
        items: [
            {
                label: 'Dashboard',
                href: '/dashboard',
                icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
                permission: 'view dashboard',
                matchPrefix: '/dashboard',
            },
        ],
    },
    {
        title: 'Master Data',
        anyPermission: ['view clients', 'view services'],
        items: [
            {
                label: 'Klien',
                href: '/clients',
                icon: <Users className="w-4 h-4 shrink-0" />,
                permission: 'view clients',
                matchPrefix: '/clients',
            },
            {
                label: 'Layanan',
                href: '/services',
                icon: <Briefcase className="w-4 h-4 shrink-0" />,
                permission: 'view services',
                matchPrefix: '/services',
            },
        ],
    },
    {
        title: 'Keuangan',
        anyPermission: ['view invoices', 'view recurring-invoices', 'view bank-accounts'],
        items: [
            {
                label: 'Invoice',
                href: '/invoices',
                icon: <FileText className="w-4 h-4 shrink-0" />,
                permission: 'view invoices',
                matchPrefix: '/invoices',
            },
            {
                label: 'Invoice Berulang',
                href: '/recurring-invoices',
                icon: <RefreshCw className="w-4 h-4 shrink-0" />,
                permission: 'view recurring-invoices',
                matchPrefix: '/recurring-invoices',
            },
            {
                label: 'Rekening Bank',
                href: '/bank-accounts',
                icon: <Building2 className="w-4 h-4 shrink-0" />,
                permission: 'view bank-accounts',
                matchPrefix: '/bank-accounts',
            },
        ],
    },
    {
        title: 'Arus Kas',
        anyPermission: ['view income', 'view expense', 'view transfer'],
        items: [
            {
                label: 'Pemasukan',
                href: '/cash-flow/income',
                icon: <TrendingUp className="w-4 h-4 shrink-0" />,
                permission: 'view income',
                matchPrefix: '/cash-flow/income',
            },
            {
                label: 'Pengeluaran',
                href: '/cash-flow/expenses',
                icon: <TrendingDown className="w-4 h-4 shrink-0" />,
                permission: 'view expense',
                matchPrefix: '/cash-flow/expenses',
            },
            {
                label: 'Transfer & Penyesuaian',
                href: '/cash-flow/transfers',
                icon: <ArrowLeftRight className="w-4 h-4 shrink-0" />,
                permission: 'view transfer',
                matchPrefix: '/cash-flow/transfers',
            },
        ],
    },
    {
        title: 'Operasional',
        anyPermission: ['view categories', 'view fund requests', 'view reimbursements'],
        items: [
            {
                label: 'Kategori',
                href: '/transaction-categories',
                icon: <FolderOpen className="w-4 h-4 shrink-0" />,
                permission: 'view categories',
                matchPrefix: '/transaction-categories',
            },
            {
                label: 'Permintaan Dana',
                href: '/fund-requests',
                icon: <Receipt className="w-4 h-4 shrink-0" />,
                permission: 'view fund requests',
                matchPrefix: '/fund-requests',
                badgeKey: 'fund_requests',
            },
            {
                label: 'Reimbursement',
                href: '/reimbursements',
                icon: <ArrowLeftRight className="w-4 h-4 shrink-0" />,
                permission: 'view reimbursements',
                matchPrefix: '/reimbursements',
                badgeKey: 'reimbursements',
            },
        ],
    },
    {
        title: 'Utang & Piutang',
        anyPermission: ['view loans', 'view receivables'],
        items: [
            {
                label: 'Pinjaman',
                href: '/loans',
                icon: <CreditCard className="w-4 h-4 shrink-0" />,
                permission: 'view loans',
                matchPrefix: '/loans',
            },
            {
                label: 'Piutang',
                href: '/receivables',
                icon: <Wallet className="w-4 h-4 shrink-0" />,
                permission: 'view receivables',
                matchPrefix: '/receivables',
            },
        ],
    },
    {
        title: 'Laporan',
        anyPermission: ['view profit-loss'],
        items: [
            {
                label: 'Laba Rugi',
                href: '/reports/profit-loss',
                icon: <FileBarChart className="w-4 h-4 shrink-0" />,
                permission: 'view profit-loss',
                matchPrefix: '/reports/profit-loss',
            },
        ],
    },
    {
        title: 'Administrasi',
        anyPermission: ['view feedbacks', 'view permissions', 'manage users', 'manage companies'],
        items: [
            {
                label: 'Feedback',
                href: '/feedbacks',
                icon: <MessageSquare className="w-4 h-4 shrink-0" />,
                permission: 'view feedbacks',
                matchPrefix: '/feedbacks',
            },
            {
                label: 'Izin & Peran',
                href: '/admin/permissions',
                icon: <Shield className="w-4 h-4 shrink-0" />,
                permission: 'view permissions',
                matchPrefix: '/admin/permissions',
            },
            {
                label: 'Pengguna',
                href: '/admin/users',
                icon: <UserCog className="w-4 h-4 shrink-0" />,
                permission: 'manage users',
                matchPrefix: '/admin/users',
            },
            {
                label: 'Perusahaan',
                href: '/admin/companies',
                icon: <Building2 className="w-4 h-4 shrink-0" />,
                permission: 'manage companies',
                matchPrefix: '/admin/companies',
            },
        ],
    },
];

function NavLink({
    item,
    collapsed,
    currentUrl,
    onClick,
    badge = 0,
}: {
    item: NavItem;
    collapsed: boolean;
    currentUrl: string;
    onClick: () => void;
    badge?: number;
}) {
    const isActive =
        !item.comingSoon &&
        (item.matchPrefix
            ? currentUrl === item.matchPrefix || currentUrl.startsWith(item.matchPrefix + '/')
            : currentUrl === item.href);

    if (item.comingSoon) {
        return (
            <div
                title={collapsed ? item.label : undefined}
                className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[0.8125rem] font-medium',
                    'text-gray-400 dark:text-dark-600 opacity-50 cursor-not-allowed select-none',
                    collapsed && 'justify-center px-2',
                )}
            >
                {item.icon}
                {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                )}
            </div>
        );
    }

    return (
        <Link
            href={companyUrl(item.href)}
            onClick={onClick}
            title={collapsed ? item.label : undefined}
            className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[0.8125rem] font-medium transition-all duration-150 relative whitespace-nowrap',
                isActive
                    ? [
                          'bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold',
                          "before:content-[''] before:absolute before:left-0 before:top-[20%] before:bottom-[20%] before:w-[2.5px] before:bg-current before:rounded-r-sm",
                      ]
                    : 'text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-dark-200 hover:translate-x-px',
                collapsed && 'justify-center px-2',
            )}
        >
            <span className="relative shrink-0">
                {item.icon}
                {/* Collapsed: a dot on the icon hints there are items to act on. */}
                {collapsed && badge > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-dark-900" />
                )}
            </span>
            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            {!collapsed && badge > 0 && (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-px text-[0.6875rem] font-bold leading-tight text-white">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
}

export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
    const { auth, actionCounts, company, companies } = usePage<SharedProps>().props;
    const permissions = auth.permissions;
    const user = auth.user;
    // Path aplikasi tanpa prefix /c/{slug} — semua matchPrefix NAV tetap valid
    const currentUrl = appPath(usePage().url);

    const can = (permission: string) => permissions.includes(permission);
    const canAny = (perms: string[]) => perms.some((p) => permissions.includes(p));

    const [userMenuOpen, setUserMenuOpen] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const initials = user?.name
        ? user.name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase()
        : 'U';

    return (
        <aside
            className={cn(
                'fixed lg:relative z-50 lg:z-auto h-full flex flex-col shrink-0',
                'bg-white dark:bg-dark-900',
                'border-r border-gray-100 dark:border-white/6',
                'transition-all duration-300 ease-in-out',
                open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
                collapsed ? 'w-16' : 'w-56',
            )}
            data-sidebar-collapsed={collapsed}
        >
            {/* Brand / company switcher */}
            <div className="h-14 flex items-center gap-2.5 px-3 shrink-0 border-b border-gray-100 dark:border-white/6">
                <div className="w-8 h-8 rounded-lg bg-primary-600 dark:bg-primary-500 flex items-center justify-center shrink-0 shadow-sm shadow-primary-600/30">
                    <img src="/images/kisantra.png" alt="Logo" className="w-5 h-5 object-contain" />
                </div>
                {!collapsed && (
                    <div className="flex-1 min-w-0">
                        {companies.length > 1 ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex w-full items-center gap-1 text-left group">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white tracking-tight leading-tight truncate">
                                            {company?.name ?? 'Pilih Perusahaan'}
                                        </p>
                                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium tracking-wide leading-tight">
                                            Ganti perusahaan
                                        </p>
                                    </div>
                                    <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-52">
                                    {companies.map((option) => (
                                        <DropdownMenuItem key={option.slug} asChild>
                                            {/* <a> full reload: seluruh konteks (props, permission, notifikasi) dihitung ulang */}
                                            <a
                                                href={`/c/${option.slug}/dashboard`}
                                                className={cn(option.slug === company?.slug && 'font-semibold text-primary-600 dark:text-primary-400')}
                                            >
                                                {option.name}
                                            </a>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-gray-900 dark:text-white tracking-tight leading-tight truncate">
                                    {company?.name ?? 'Finance'}
                                </p>
                                <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium tracking-wide leading-tight">
                                    Finance Management
                                </p>
                            </>
                        )}
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin">
                {NAV.map((section, si) => {
                    const visibleItems = section.items.filter(
                        (item) => !item.permission || can(item.permission),
                    );
                    const sectionVisible =
                        !section.anyPermission || canAny(section.anyPermission);

                    if (!sectionVisible || visibleItems.length === 0) return null;

                    return (
                        <div key={si} className="space-y-0.5">
                            {section.title && !collapsed && (
                                <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-600 mb-1">
                                    {section.title}
                                </p>
                            )}
                            {visibleItems.map((item) => (
                                <NavLink
                                    key={item.href}
                                    item={item}
                                    collapsed={collapsed}
                                    currentUrl={currentUrl}
                                    onClick={onClose}
                                    badge={item.badgeKey ? actionCounts?.[item.badgeKey] ?? 0 : 0}
                                />
                            ))}
                        </div>
                    );
                })}
            </nav>

            {/* User profile */}
            <div
                ref={userMenuRef}
                className="shrink-0 border-t border-gray-100 dark:border-white/6 p-2 relative"
            >
                <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    title={collapsed ? (user?.name ?? 'User') : undefined}
                    className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/4 transition-colors text-left"
                >
                    <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0 text-primary-700 dark:text-primary-300 text-xs font-bold">
                        {initials}
                    </div>
                    {!collapsed && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">
                                    {user?.name ?? 'User'}
                                </p>
                            </div>
                            <ChevronLeft
                                className={cn(
                                    'w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0 transition-transform duration-150 -rotate-90',
                                    userMenuOpen && 'rotate-90',
                                )}
                            />
                        </>
                    )}
                </button>

                {userMenuOpen && (
                    <div
                        className={cn(
                            'absolute bottom-full mb-1 bg-white dark:bg-dark-700',
                            'border border-gray-100 dark:border-white/8 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden z-10',
                            collapsed ? 'left-full ml-1 w-48' : 'left-0 right-0',
                        )}
                    >
                        <div className="px-3 py-2.5 border-b border-gray-100 dark:border-white/6">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                {user?.name ?? 'User'}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
                                {user?.email ?? ''}
                            </p>
                        </div>
                        <div className="p-1">
                            <Link
                                href={companyUrl('/settings/profile')}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/6 rounded-lg transition-colors"
                            >
                                <Users className="w-3.5 h-3.5 opacity-60" />
                                Profil Saya
                            </Link>
                            <Link
                                href={companyUrl('/settings/company')}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/6 rounded-lg transition-colors"
                            >
                                <Building2 className="w-3.5 h-3.5 opacity-60" />
                                Profil Perusahaan
                            </Link>
                        </div>
                        <div className="p-1 border-t border-gray-100 dark:border-white/6">
                            <form method="POST" action="/logout">
                                <input
                                    type="hidden"
                                    name="_token"
                                    value={
                                        document
                                            .querySelector('meta[name="csrf-token"]')
                                            ?.getAttribute('content') ?? ''
                                    }
                                />
                                <button
                                    type="submit"
                                    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                                        />
                                    </svg>
                                    Keluar
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Collapse toggle (desktop only) */}
            <button
                onClick={onToggleCollapse}
                title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
                className="hidden lg:flex absolute top-17 -right-3 w-6 h-6 rounded-full bg-white dark:bg-dark-700 border border-gray-200 dark:border-white/10 shadow-sm items-center justify-center hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
            >
                <ChevronLeft
                    className={cn(
                        'w-3 h-3 transition-transform duration-300',
                        collapsed && 'rotate-180',
                    )}
                />
            </button>
        </aside>
    );
}
