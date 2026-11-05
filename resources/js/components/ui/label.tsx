import * as LabelPrimitive from '@radix-ui/react-label';
import * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Label lepas (mis. di samping Checkbox/Switch). Tanpa margin bawaan: jarak ke kontrolnya
 * diatur tata letak pemanggil; label bawaan Input/Combobox dkk. sudah membawa mb-1.5 sendiri.
 */
const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
    <LabelPrimitive.Root
        ref={ref}
        className={cn(
            'text-[13px] font-medium leading-none text-ob-ink-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            className,
        )}
        {...props}
    />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
