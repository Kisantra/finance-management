import * as React from 'react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
    title: string;
    description?: string;
    /** Opsional: sebagian halaman memakai komponen ini sebagai judul bagian saja,
        dengan field-nya sebagai elemen saudara, bukan anak. */
    children?: React.ReactNode;
    className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
    return (
        <div className={cn('space-y-4', className)}>
            <div className="border-b border-ob-line pb-4">
                <h4 className="mb-1 text-base font-semibold text-ob-ink">{title}</h4>
                {description && <p className="text-[13px] text-ob-ink-2">{description}</p>}
            </div>
            {children}
        </div>
    );
}
