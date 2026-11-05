import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

/* Judul halaman Obsidian (sama dengan SettingsLayout): 26/600 tanpa gradient; aksi turun baris di layar sempit. */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
            <div className="min-w-0">
                <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">{title}</h1>
                {description && <p className="mt-1 max-w-[65ch] text-sm text-ob-ink-2">{description}</p>}
            </div>
            {action && <div className="max-w-full shrink-0">{action}</div>}
        </div>
    );
}
