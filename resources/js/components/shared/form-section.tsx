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
            <div className="border-b border-secondary-200 dark:border-dark-600 pb-4">
                <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50 mb-1">{title}</h4>
                {description && (
                    <p className="text-xs text-dark-500 dark:text-dark-400">{description}</p>
                )}
            </div>
            {children}
        </div>
    );
}
