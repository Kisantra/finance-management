import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string = string> {
    value: T;
    label: string;
    icon?: React.ReactNode;
    /** Tailwind classes applied when this option is active. Defaults to the inverted Obsidian pill (bg-ob-invert). */
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
    /** "card" (default) = opsi berupa kartu terpisah; "pill" = trek Obsidian (latar rel, pil aktif terbalik). */
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

const ITEM_BASE =
    'font-medium transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page disabled:pointer-events-none disabled:opacity-50';

/** Opsi aktif bawaan: terbalik (gelap di tema terang, terang di tema gelap), sama dengan pil aktif rel. */
const PILL_ACTIVE = 'bg-ob-invert font-semibold text-ob-invert-ink';
const PILL_INACTIVE = 'text-ob-ink-2 hover:text-ob-ink';

const CARD_ACTIVE = 'border-ob-invert bg-ob-invert font-semibold text-ob-invert-ink';
const CARD_INACTIVE = 'border-ob-line bg-ob-inner text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink';

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
            {label && <label className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">{label}</label>}

            <div
                role="radiogroup"
                aria-label={label}
                className={cn(
                    'grid',
                    COLS[cols] ?? 'grid-cols-3',
                    /* Trek sama dengan grup pil halaman Obsidian: tepi 1 px + padding 3 px = jarak 4 px. */
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
                                ITEM_BASE,
                                pill
                                    ? 'flex h-9 items-center justify-center gap-2 rounded-full px-3 text-[13px]'
                                    : layout === 'stack'
                                      ? 'flex flex-col items-center gap-1.5 rounded-xl border p-3'
                                      : 'flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs',
                                pill
                                    ? active
                                        ? opt.activeClassName ?? PILL_ACTIVE
                                        : PILL_INACTIVE
                                    : active
                                      ? opt.activeClassName ?? CARD_ACTIVE
                                      : CARD_INACTIVE,
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

            {error && <p className="mt-1 text-xs text-ob-late">{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-ob-ink-3">{hint}</p>}
        </div>
    );
}
