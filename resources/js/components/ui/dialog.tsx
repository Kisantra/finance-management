import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/*
 * Gaya Obsidian: panel kartu rounded-3xl di atas latar hitam 60%, tombol tutup berupa pil ikon.
 * Panel sengaja tanpa padding: tepi 24 px dibawa DialogHeader (pt-6), isi (px-6) dan
 * DialogFooter (pb-6), karena banyak dialog menyusun header–isi–footer sendiri. Dialog yang
 * tidak memakai header/footer bawaan cukup menambahkan className="p-6".
 */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full mx-4',
};

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'fixed inset-0 z-50 bg-black/60',
            'motion-safe:data-[state=open]:animate-dialog-overlay-show',
            'motion-safe:data-[state=closed]:animate-dialog-overlay-hide',
            className,
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    size?: keyof typeof sizeClasses;
    hideClose?: boolean;
}

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    DialogContentProps
>(({ className, children, size = 'lg', hideClose = false, onFocusOutside, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            onFocusOutside={(e) => {
                // Prevent Dialog from recapturing focus when a Radix portal element
                // (Combobox, Select, Popover) rendered outside the Dialog DOM is focused.
                onFocusOutside?.(e);
                if (!e.defaultPrevented) e.preventDefault();
            }}
            className={cn(
                'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
                'w-full',
                sizeClasses[size],
                'rounded-3xl border border-ob-line bg-ob-card text-ob-ink',
                'shadow-xl shadow-black/20',
                'max-h-[90vh] overflow-y-auto focus:outline-none',
                'motion-safe:data-[state=open]:animate-dialog-content-show',
                'motion-safe:data-[state=closed]:animate-dialog-content-hide',
                className,
            )}
            {...props}
        >
            {children}
            {!hideClose && (
                <DialogPrimitive.Close className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full border border-ob-line bg-ob-card text-ob-ink transition-colors duration-150 ease-out hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page disabled:pointer-events-none disabled:opacity-50">
                    <X className="h-4 w-4" />
                    <span className="sr-only">{t('Tutup')}</span>
                </DialogPrimitive.Close>
            )}
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** pr-16 memberi ruang untuk pil tutup (right-6, 32 px). */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col space-y-1.5 border-b border-ob-line pb-4 pl-6 pr-16 pt-6',
            className,
        )}
        {...props}
    />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col-reverse gap-2 border-t border-ob-line px-6 pb-6 pt-4 sm:flex-row sm:justify-end',
            className,
        )}
        {...props}
    />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-lg font-semibold text-ob-ink', className)}
        {...props}
    />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-sm leading-relaxed text-ob-ink-2', className)}
        {...props}
    />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
