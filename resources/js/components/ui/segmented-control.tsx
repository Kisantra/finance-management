import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string = string> {
    value: T;
    label: string;
    icon?: React.ReactNode;
    /** Tailwind classes applied when this option is active. Defaults to primary accent. */
    activeClassName?: string;
}

interface SegmentedControlProps<T extends string = string> {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (value: T) => void;
    label?: string;
    error?: string;
    hint?: string;
    /** Number of grid columns. Defaults to the number of options. */
    columns?: 2 | 3 | 4 | 5 | 6;
    /** "stack" places icon above label (taller cards); "inline" is a single compact row. */
    layout?: 'stack' | 'inline';
    /** "pill" = trek Obsidian (latar rel, pil aktif terbalik); default "card" untuk halaman lama. */
    variant?: 'card' | 'pill';
    disabled?: boolean;
    className?: string;
}

const COLS: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
};

const DEFAULT_ACTIVE =
    'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-300';

const INACTIVE =
    'border-secondary-200 dark:border-dark-600 text-dark-500 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-700';

export function SegmentedControl<T extends string = string>({
    options,
    value,
    onChange,
    label,
    error,
    hint,
    columns,
    layout = 'inline',
    variant = 'card',
    disabled,
    className,
}: SegmentedControlProps<T>) {
    const cols = columns ?? (options.length as 2 | 3 | 4 | 5 | 6);
    const pill = variant === 'pill';

    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label className="mb-1.5 block text-sm font-medium text-dark-900 dark:text-dark-300">
                    {label}
                </label>
            )}

            <div
                role="radiogroup"
                aria-label={label}
                className={cn(
                    'grid',
                    COLS[cols] ?? 'grid-cols-3',
                    pill ? 'gap-0.5 rounded-full border border-ob-line bg-ob-rail p-[3px]' : 'gap-2',
                )}
            >
                {options.map((opt) => {
                    const active = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => onChange(opt.value)}
                            className={cn(
                                'font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                                pill
                                    ? 'flex h-9 items-center justify-center gap-2 rounded-full px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill'
                                    : layout === 'stack'
                                      ? 'flex flex-col items-center gap-1.5 rounded-xl border p-3'
                                      : 'flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs',
                                pill
                                    ? active
                                        ? opt.activeClassName ?? 'bg-ob-invert font-semibold text-ob-invert-ink'
                                        : 'text-ob-ink-2 hover:text-ob-ink'
                                    : active
                                      ? opt.activeClassName ?? DEFAULT_ACTIVE
                                      : INACTIVE,
                            )}
                        >
                            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                            <span className={layout === 'stack' ? 'text-xs font-semibold' : ''}>
                                {opt.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-dark-500 dark:text-dark-400">{hint}</p>}
        </div>
    );
}
