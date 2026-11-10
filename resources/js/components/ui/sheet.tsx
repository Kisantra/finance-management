import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/*
 * Gaya Obsidian: panel menempel di kanan layar dengan sudut dalam rounded-l-3xl, latar hitam 60%.
 * Seperti Dialog, panel tanpa padding: SheetHeader / SheetBody / SheetFooter membawa tepi 24 px.
 * Garis header/footer dipertahankan karena keduanya diam di atas isi yang menggulir.
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const widthClasses = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-xl',
    '2xl': 'w-full max-w-2xl',
    '3xl': 'w-full max-w-3xl',
};

const SheetOverlay = React.forwardRef<
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
SheetOverlay.displayName = 'SheetOverlay';

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    size?: keyof typeof widthClasses;
    hideClose?: boolean;
}

const SheetContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    SheetContentProps
>(({ className, children, size = 'lg', hideClose = false, onFocusOutside, ...props }, ref) => (
    <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
            ref={ref}
            onFocusOutside={(e) => {
                onFocusOutside?.(e);
                if (!e.defaultPrevented) e.preventDefault();
            }}
            className={cn(
                'fixed right-0 top-0 z-50 h-full',
                widthClasses[size],
                'rounded-l-3xl border-l border-ob-line bg-ob-card text-ob-ink',
                'shadow-xl shadow-black/20',
                'flex flex-col',
                'motion-safe:data-[state=open]:animate-[sheet-slide-in_220ms_cubic-bezier(0.32,0.72,0,1)_forwards]',
                'motion-safe:data-[state=closed]:animate-sheet-slide-out',
                'focus:outline-none',
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
    </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

/** pr-16 memberi ruang untuk pil tutup (right-6, 32 px). */
const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex shrink-0 flex-col space-y-1 border-b border-ob-line pb-4 pl-6 pr-16 pt-6',
            className,
        )}
        {...props}
    />
);
SheetHeader.displayName = 'SheetHeader';

const SheetBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn('flex-1 overflow-y-auto px-6 py-5', className)}
        {...props}
    />
);
SheetBody.displayName = 'SheetBody';

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex shrink-0 items-center justify-end gap-2 border-t border-ob-line px-6 pb-6 pt-4',
            className,
        )}
        {...props}
    />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('pr-6 text-lg font-semibold text-ob-ink', className)}
        {...props}
    />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('mt-0.5 text-sm text-ob-ink-2', className)}
        {...props}
    />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Sheet,
    SheetBody,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetOverlay,
    SheetPortal,
    SheetTitle,
    SheetTrigger,
};
