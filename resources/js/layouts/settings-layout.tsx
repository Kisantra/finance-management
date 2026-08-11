import { Link, usePage } from '@inertiajs/react';
import { Building2, FileText, KeyRound, User } from 'lucide-react';
import * as React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { appPath, companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

interface SettingsLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

const BASE_NAV_ITEMS = [
    { href: '/settings/profile', label: 'Profil', icon: User, permission: null },
    { href: '/settings/password', label: 'Kata Sandi', icon: KeyRound, permission: null },
    { href: '/settings/company', label: 'Profil Perusahaan', icon: Building2, permission: null },
    { href: '/settings/pdf-templates', label: 'Template PDF', icon: FileText, permission: 'manage pdf templates' },
];

export function SettingsLayout({ children, title, description, action }: SettingsLayoutProps) {
    const { url, props } = usePage<SharedProps>();
    const permissions: string[] = props.auth?.permissions ?? [];

    const navItems = BASE_NAV_ITEMS.filter(
        (item) => item.permission === null || permissions.includes(item.permission),
    );

    return (
        <div className="space-y-6">
            <PageHeader title="Pengaturan" description="Kelola akun, keamanan, dan profil perusahaan Anda" />

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Nav */}
                <aside className="lg:w-60 shrink-0">
                    <nav className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden bg-white dark:bg-dark-700">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = appPath(url).startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={companyUrl(item.href)}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3 text-sm border-l-2 transition-colors',
                                        isActive
                                            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-300 font-medium'
                                            : 'border-transparent text-dark-700 dark:text-dark-300 hover:bg-secondary-50 dark:hover:bg-dark-800',
                                    )}
                                >
                                    <Icon className={cn('w-4 h-4', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-dark-400')} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Content Card */}
                <main className="flex-1 min-w-0">
                    <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 overflow-hidden">
                        <div className="px-6 py-5 border-b border-secondary-200 dark:border-dark-600 bg-secondary-50/40 dark:bg-dark-800/40 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-dark-900 dark:text-dark-50">{title}</h2>
                                {description && (
                                    <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">{description}</p>
                                )}
                            </div>
                            {action && <div className="shrink-0">{action}</div>}
                        </div>
                        <div className="p-6">{children}</div>
                    </div>
                </main>
            </div>
        </div>
    );
}
