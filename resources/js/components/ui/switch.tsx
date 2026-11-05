import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
        ref={ref}
        className={cn(
            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-ob-chip',
            'transition-colors duration-150 ease-out motion-reduce:transition-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=checked]:bg-ob-act-fill data-[state=unchecked]:border-ob-line-strong',
            className,
        )}
        {...props}
    >
        {/* Mati: kenop ob-ink-3 (≥ 4,5:1 di atas ob-chip di kedua tema; kenop putih di atas
            lintasan terang hanya ±1,3:1). Aktif: kenop putih di atas ob-act-fill. Tanpa bayangan. */}
        <SwitchPrimitive.Thumb
            className={cn(
                'pointer-events-none block h-4 w-4 rounded-full ring-0 data-[state=checked]:bg-white data-[state=unchecked]:bg-ob-ink-3',
                'transition-transform duration-150 ease-out motion-reduce:transition-none',
                'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
            )}
        />
    </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
