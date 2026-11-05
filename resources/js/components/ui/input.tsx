import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, hint, error, icon, iconRight, id, type = 'text', ...props }, ref) => {
        const inputId = id ?? React.useId();
        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ob-ink-3">
                            <span className="h-4 w-4">{icon}</span>
                        </div>
                    )}
                    <input
                        id={inputId}
                        type={type}
                        ref={ref}
                        className={cn(
                            'flex h-[42px] w-full rounded-xl border bg-ob-inner py-1.5 text-sm text-ob-ink placeholder:text-ob-ink-3',
                            'transition-colors duration-150 ease-out motion-reduce:transition-none',
                            error ? 'border-ob-late' : 'border-ob-line',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
                            'disabled:pointer-events-none disabled:opacity-50',
                            icon ? 'pl-10' : 'pl-3.5',
                            iconRight ? 'pr-10' : 'pr-3.5',
                            className,
                        )}
                        {...props}
                    />
                    {iconRight && (
                        <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-ob-ink-3 [&_button]:pointer-events-auto">
                            <span className="h-4 w-4">{iconRight}</span>
                        </div>
                    )}
                </div>
                {error && <p className="mt-1 text-xs text-ob-late">{error}</p>}
                {hint && !error && <p className="mt-1 text-xs text-ob-ink-3">{hint}</p>}
            </div>
        );
    },
);
Input.displayName = 'Input';

export { Input };
