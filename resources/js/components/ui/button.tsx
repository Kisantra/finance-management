import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-dark-950 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                primary:
                    'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700',
                zinc: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-dark-700 dark:text-dark-50 dark:hover:bg-dark-600',
                red: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700',
                green: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700',
                yellow: 'bg-yellow-500 text-white hover:bg-yellow-600',
                blue: 'bg-blue-600 text-white hover:bg-blue-700',
                outline:
                    'border border-secondary-200 dark:border-dark-600 bg-transparent hover:bg-zinc-50 dark:hover:bg-dark-700 text-dark-900 dark:text-dark-50',
                ghost: 'hover:bg-zinc-100 dark:hover:bg-dark-700 text-dark-900 dark:text-dark-50',
                link: 'text-primary-600 underline-offset-4 hover:underline p-0 h-auto',
            },
            size: {
                sm: 'h-8 px-3 text-xs',
                md: 'h-9 px-4',
                lg: 'h-10 px-6',
                xl: 'h-11 px-8',
                icon: 'h-9 w-9 p-0',
                'icon-sm': 'h-7 w-7 p-0',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, loading, icon, children, disabled, ...props }, ref) => {
        // Slot hanya menerima satu anak: ikon/spinner ditaruh sendiri oleh pemanggil di dalam elemen anak.
        if (asChild) {
            return (
                <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
                    {children}
                </Slot>
            );
        }
        const Comp = 'button';
        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size }), className)}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : icon ? (
                    <span className="h-4 w-4">{icon}</span>
                ) : null}
                {children}
            </Comp>
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
