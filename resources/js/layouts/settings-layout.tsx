import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import * as React from 'react';

/*
 * Kerangka halaman detail pengaturan (gaya Obsidian). Navigasi antarpengaturan ada di hub
 * /settings (kartu baris berkelompok), jadi halaman detail cukup punya tautan kembali.
 */

interface SettingsLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    /** Isi tidak dibungkus kartu — untuk halaman yang menyusun kartunya sendiri. */
    bare?: boolean;
}

export function SettingsLayout({ children, title, description, action, bare }: SettingsLayoutProps) {
    return (
        <div className="mx-auto flex w-full max-w-260 flex-col gap-5">
            <div className="flex flex-col gap-2">
                <Link
                    href="/settings"
                    className="inline-flex w-fit items-center gap-1 rounded-full text-[13px] font-semibold text-ob-ink-2 hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Pengaturan
                </Link>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">{title}</h1>
                        {description && <p className="mt-1 max-w-[65ch] text-sm text-ob-ink-2">{description}</p>}
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            </div>

            {bare ? children : <section className="rounded-3xl border border-ob-line bg-ob-card p-6 sm:p-8">{children}</section>}
        </div>
    );
}
