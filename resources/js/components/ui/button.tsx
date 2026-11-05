import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Gaya Obsidian: pil, satu aksen biru untuk aksi utama. Nada merah/hijau/kuning memakai
 * tinta nada di atas latar tembus, karena teks putih di atas merah tema gelap tidak terbaca.
 */
const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                primary: 'bg-ob-act-fill text-white hover:bg-ob-act-fill/90',
                zinc: 'border border-ob-line bg-ob-card text-ob-ink hover:bg-ob-hover',
                red: 'bg-ob-late/12 text-ob-late hover:bg-ob-late/20',
                green: 'bg-ob-pos/12 text-ob-pos hover:bg-ob-pos/20',
                yellow: 'bg-ob-wait/12 text-ob-wait hover:bg-ob-wait/20',
                blue: 'bg-ob-act-fill text-white hover:bg-ob-act-fill/90',
                outline: 'border border-ob-line bg-ob-card text-ob-ink hover:bg-ob-hover',
                ghost: 'text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink',
                link: 'h-auto p-0 text-ob-act underline-offset-4 hover:underline',
            },
            size: {
                sm: 'h-8 px-3 text-xs',
                md: 'h-10 px-4 text-sm',
                lg: 'h-11 px-5 text-sm',
                xl: 'h-12 px-6 text-base',
                icon: 'h-10 w-10 p-0',
                'icon-sm': 'h-8 w-8 p-0',
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
