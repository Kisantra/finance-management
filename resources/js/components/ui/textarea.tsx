import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    hint?: string;
    error?: string;
}

/** Field Obsidian tanpa tinggi tetap: tinggi mengikuti `rows` / isi (minimal 80 px), bisa ditarik vertikal. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, hint, error, id, ...props }, ref) => {
        const inputId = id ?? React.useId();
        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">
                        {label}
                    </label>
                )}
                <textarea
                    id={inputId}
                    ref={ref}
                    className={cn(
                        'flex min-h-20 w-full rounded-xl border bg-ob-inner px-3.5 py-2.5 text-sm text-ob-ink placeholder:text-ob-ink-3',
                        'transition-colors duration-150 ease-out motion-reduce:transition-none',
                        error ? 'border-ob-late' : 'border-ob-line',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
                        'disabled:pointer-events-none disabled:opacity-50',
                        'resize-y',
                        className,
                    )}
                    {...props}
                />
                {error && <p className="mt-1 text-xs text-ob-late">{error}</p>}
                {hint && !error && <p className="mt-1 text-xs text-ob-ink-3">{hint}</p>}
            </div>
        );
    },
);
Textarea.displayName = 'Textarea';

export { Textarea };
