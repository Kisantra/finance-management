import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent } from './popover';

export interface AutocompleteOption {
    /** Teks yang diisikan ke field saat opsi dipilih. */
    value: string;
    /** Teks baris utama; bawaan `value`. */
    label?: string;
    description?: string;
    icon?: React.ReactNode;
    /** Kata lain yang ikut dicari (singkatan, nama lama), tidak ditampilkan. */
    keywords?: string[];
}

export interface AutocompleteProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'role'> {
    value: string;
    onChange: (value: string) => void;
    options: AutocompleteOption[];
    label?: string;
    hint?: string;
    error?: string;
    /** Ikon di kiri field (slot 24 px), mis. logo dari nilai yang sedang diketik. */
    icon?: React.ReactNode;
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Field teks bebas dengan daftar saran: nilai apa pun boleh diketik, opsi hanya membantu mengisi.
 * Berbeda dengan Combobox (nilai wajib salah satu opsi). Fokus tetap di field; panah atas/bawah
 * memilih saran, Enter mengisinya, Esc menutup daftar. Enter tanpa saran tersorot tetap mengirim form.
 */
const Autocomplete = React.forwardRef<HTMLInputElement, AutocompleteProps>(
    ({ value, onChange, options, label, hint, error, icon, id, className, disabled, onFocus, onBlur, onKeyDown, ...props }, ref) => {
        const generatedId = React.useId();
        const inputId = id ?? generatedId;
        const listId = `${inputId}-list`;
        const anchorRef = React.useRef<HTMLDivElement>(null);
        const [open, setOpen] = React.useState(false);
        const [active, setActive] = React.useState(-1);
        /* Daftar disaring hanya setelah pengguna mengetik; saat field baru difokus semua saran tampil. */
        const [query, setQuery] = React.useState<string | null>(null);

        const filtered = React.useMemo(() => {
            const q = normalize(query ?? '');
            if (!q) return options;
            return options.filter((o) =>
                [o.value, o.label ?? '', o.description ?? '', ...(o.keywords ?? [])].some((t) => normalize(t).includes(q)),
            );
        }, [options, query]);

        const showList = open && filtered.length > 0;

        const close = () => {
            setOpen(false);
            setActive(-1);
            setQuery(null);
        };

        const choose = (option: AutocompleteOption) => {
            onChange(option.value);
            close();
        };

        const moveActive = (next: number) => {
            setActive(next);
            document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            onKeyDown?.(e);
            if (e.defaultPrevented || e.nativeEvent.isComposing) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!showList) {
                    setOpen(true);
                    return;
                }
                const down = e.key === 'ArrowDown';
                const n = filtered.length;
                moveActive(active < 0 ? (down ? 0 : n - 1) : (active + (down ? 1 : -1) + n) % n);
            } else if (e.key === 'Enter' && showList && active >= 0) {
                e.preventDefault();
                choose(filtered[active]);
            } else if (e.key === 'Escape' && showList) {
                // Hanya menutup daftar; Esc berikutnya baru menutup dialog di belakangnya.
                e.preventDefault();
                e.stopPropagation();
                close();
            } else if (e.key === 'Tab') {
                close();
            }
        };

        const current = normalize(value);

        return (
            <div className={cn('w-full', className)}>
                {label && (
                    <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">
                        {label}
                    </label>
                )}
                <Popover open={showList} onOpenChange={(o) => (o ? setOpen(true) : close())}>
                    <PopoverAnchor asChild>
                        <div ref={anchorRef} className="relative">
                            {icon && (
                                <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
                                    <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
                                </div>
                            )}
                            <input
                                {...props}
                                ref={ref}
                                id={inputId}
                                type="text"
                                role="combobox"
                                autoComplete="off"
                                aria-autocomplete="list"
                                aria-expanded={showList}
                                aria-controls={listId}
                                aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
                                aria-invalid={error ? true : undefined}
                                value={value}
                                disabled={disabled}
                                onChange={(e) => {
                                    onChange(e.target.value);
                                    setQuery(e.target.value);
                                    setActive(-1);
                                    setOpen(true);
                                }}
                                onFocus={(e) => {
                                    onFocus?.(e);
                                    setOpen(true);
                                }}
                                onBlur={(e) => {
                                    onBlur?.(e);
                                    close();
                                }}
                                onClick={() => setOpen(true)}
                                onKeyDown={handleKeyDown}
                                className={cn(
                                    'flex h-[42px] w-full rounded-xl border bg-ob-inner py-1.5 pr-3.5 text-sm text-ob-ink placeholder:text-ob-ink-3',
                                    'transition-colors duration-150 ease-out motion-reduce:transition-none',
                                    error ? 'border-ob-late' : showList ? 'border-ob-act-fill/50' : 'border-ob-line',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
                                    'disabled:pointer-events-none disabled:opacity-50',
                                    icon ? 'pl-11' : 'pl-3.5',
                                )}
                            />
                        </div>
                    </PopoverAnchor>
                    {/* Bawaan Radix role="dialog"; fokus tidak pernah masuk ke panel ini, yang dibacakan cukup listbox-nya. */}
                    <PopoverContent
                        role="presentation"
                        align="start"
                        className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        onInteractOutside={(e) => {
                            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
                        }}
                    >
                        <ul
                            id={listId}
                            role="listbox"
                            aria-label={label}
                            className="max-h-64 overflow-y-auto p-2"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {filtered.map((option, index) => {
                                const selected = normalize(option.value) === current;
                                return (
                                    <li
                                        key={option.value}
                                        id={`${listId}-${index}`}
                                        role="option"
                                        aria-selected={index === active}
                                        // Klik tidak boleh memindahkan fokus dari field (blur menutup daftar).
                                        onMouseDown={(e) => e.preventDefault()}
                                        onMouseMove={() => index !== active && setActive(index)}
                                        onClick={() => choose(option)}
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ob-ink',
                                            'transition-colors duration-150 ease-out motion-reduce:transition-none',
                                            index === active && 'bg-ob-hover',
                                        )}
                                    >
                                        {option.icon && <span className="flex shrink-0 items-center">{option.icon}</span>}
                                        <div className="min-w-0 flex-1">
                                            <div className={cn('truncate', selected && 'font-semibold')}>{option.label ?? option.value}</div>
                                            {option.description && (
                                                <div className="truncate text-xs text-ob-ink-3">{option.description}</div>
                                            )}
                                        </div>
                                        {selected && <Check className="h-4 w-4 shrink-0 text-ob-act" aria-hidden="true" />}
                                    </li>
                                );
                            })}
                        </ul>
                    </PopoverContent>
                </Popover>
                {error && <p className="mt-1.5 text-xs text-ob-late">{error}</p>}
                {hint && !error && <p className="mt-1.5 text-xs text-ob-ink-3">{hint}</p>}
            </div>
        );
    },
);
Autocomplete.displayName = 'Autocomplete';

export { Autocomplete };
