import { Head, usePage } from '@inertiajs/react';
import { Building2, ChevronRight, FileText, Hash, KeyRound, Plug, User, type LucideIcon } from 'lucide-react';
import * as React from 'react';
import { AppLink } from '@/components/app-link';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { AppLayout } from '@/layouts/app-layout';
import type { SharedProps } from '@/types';
import { t, tk } from '@/i18n';

/*
 * Hub pengaturan (referensi "General & Security Settings"): pengaturan dikelompokkan dalam
 * kartu, satu baris per halaman — ikon, nama, dan keterangan singkat apa yang diatur di sana.
 */

interface SettingRow {
    href: string;
    title: string;
    description: string;
    icon: LucideIcon;
    permission?: string;
}

const GROUPS: { title: string; rows: SettingRow[] }[] = [
    {
        title: tk('Akun'),
        rows: [
            { href: '/settings/profile', title: tk('Profil'), description: tk('Nama dan email yang Anda pakai untuk masuk'), icon: User },
            { href: '/settings/password', title: tk('Kata sandi'), description: tk('Ganti kata sandi akun Anda'), icon: KeyRound },
            {
                href: '/settings/claude',
                title: tk('Koneksi Claude'),
                description: tk('Hubungkan Claude untuk membaca data keuangan, atau cabut sambungannya'),
                icon: Plug,
                permission: 'use claude',
            },
        ],
    },
    {
        title: tk('Perusahaan'),
        rows: [
            {
                href: '/settings/company',
                title: tk('Profil perusahaan'),
                description: tk('Identitas, NPWP/PKP, rekening, logo, tanda tangan, dan stempel untuk PDF'),
                icon: Building2,
            },
        ],
    },
    {
        title: tk('Invoice'),
        rows: [
            {
                href: '/settings/invoice-numbering',
                title: tk('Penomoran invoice'),
                description: tk('Format nomor, jumlah digit, dan kapan nomor kembali ke 1'),
                icon: Hash,
                permission: 'manage invoice settings',
            },
            {
                href: '/settings/pdf-templates',
                title: tk('Template PDF'),
                description: tk('Susun tata letak PDF invoice dan kelola font'),
                icon: FileText,
                permission: 'manage pdf templates',
            },
        ],
    },
];

export default function SettingsIndex() {
    const { props } = usePage<SharedProps>();
    const permissions: string[] = props.auth?.permissions ?? [];

    const groups = GROUPS.map((group) => ({
        ...group,
        rows: group.rows.filter((row) => !row.permission || permissions.includes(row.permission)),
    })).filter((group) => group.rows.length > 0);

    return (
        <>
            <Head title={t('Pengaturan', { context: 'menu' })} />

            <div className="mx-auto flex w-full max-w-180 flex-col gap-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">{t('Pengaturan', { context: 'menu' })}</h1>
                        <p className="mt-1 text-sm text-ob-ink-2">{t('Akun Anda, identitas perusahaan, dan aturan dokumen invoice.')}</p>
                    </div>
                    <TutorialButton slug="settings" className="self-start" />
                </div>

                {groups.map((group) => (
                    <section key={group.title} aria-labelledby={`settings-${group.title}`} className="flex flex-col gap-2">
                        <h2 id={`settings-${group.title}`} className="px-1 text-[13px] font-semibold text-ob-ink-2">
                            {t(group.title)}
                        </h2>
                        <ul className="overflow-hidden rounded-3xl border border-ob-line bg-ob-card">
                            {group.rows.map((row) => {
                                const Icon = row.icon;
                                return (
                                    <li key={row.href} className="border-b border-ob-line-soft last:border-b-0">
                                        <AppLink
                                            href={row.href}
                                            className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ob-hover focus-visible:bg-ob-hover focus-visible:outline-none"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ob-line bg-ob-inner text-ob-ink-2"
                                            >
                                                <Icon className="h-[18px] w-[18px]" />
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="text-[15px] font-semibold text-ob-ink">{t(row.title)}</span>
                                                <span className="text-[13px] text-ob-ink-2">{t(row.description)}</span>
                                            </span>
                                            <ChevronRight
                                                aria-hidden="true"
                                                className="h-4 w-4 shrink-0 text-ob-ink-3 transition-transform group-hover:translate-x-0.5"
                                            />
                                        </AppLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </>
    );
}

SettingsIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
