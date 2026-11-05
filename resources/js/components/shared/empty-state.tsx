import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

/* State kosong Obsidian: tepi putus-putus, satu kalimat yang mengajarkan, maksimal satu aksi. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ob-line-strong p-8 text-center',
                className,
            )}
        >
            {icon && (
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-ob-chip text-ob-ink-2 [&_svg]:h-5 [&_svg]:w-5">
                    {icon}
                </div>
            )}
            <h3 className="text-[15px] font-semibold text-ob-ink">{title}</h3>
            {description && <p className="max-w-sm text-[13px] leading-relaxed text-ob-ink-2">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
