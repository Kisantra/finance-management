import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
    {
        /* Satu makna per hue (Obsidian): ungu tidak dipakai, jadi `purple` jatuh ke netral. */
        variants: {
            variant: {
                default: 'bg-ob-chip text-ob-ink-2',
                secondary: 'bg-ob-chip text-ob-ink-2',
                blue: 'bg-ob-act/12 text-ob-act',
                green: 'bg-ob-pos/12 text-ob-pos',
                emerald: 'bg-ob-pos/12 text-ob-pos',
                yellow: 'bg-ob-wait/12 text-ob-wait',
                orange: 'bg-ob-neg/12 text-ob-neg',
                red: 'bg-ob-late/12 text-ob-late',
                purple: 'bg-ob-chip text-ob-ink-2',
                zinc: 'bg-ob-chip text-ob-ink-2',
                outline: 'border border-ob-line bg-transparent text-ob-ink-2',
            },
            size: {
                sm: 'px-2 py-0.5 text-xs',
                md: 'px-2.5 py-0.5 text-xs',
                lg: 'px-3 py-1 text-sm',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
        },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
