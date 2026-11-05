import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface ComboboxOption {
    value: string | number;
    label: string;
    description?: string;
    disabled?: boolean;
}

interface ComboboxSingleProps {
    multiple?: false;
    options: ComboboxOption[];
    value?: string | number | null;
    onChange: (value: string | number | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    label?: string;
    hint?: string;
    error?: string;
    disabled?: boolean;
    clearable?: boolean;
    className?: string;
    emptyText?: string;
    popoverWidth?: string;
}

interface ComboboxMultipleProps {
    multiple: true;
    options: ComboboxOption[];
    value?: (string | number)[];
    onChange: (value: (string | number)[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    label?: string;
    hint?: string;
    error?: string;
    disabled?: boolean;
    clearable?: boolean;
    className?: string;
    emptyText?: string;
    popoverWidth?: string;
}

type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

export function Combobox({
    options,
    value,
    onChange,
    placeholder = 'Pilih...',
    searchPlaceholder = 'Cari...',
    label,
    hint,
    error,
    disabled,
    clearable = true,
    className,
    emptyText = 'Tidak ada data.',
    multiple = false,
    popoverWidth,
}: ComboboxProps & { multiple?: boolean }) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const inputId = React.useId();

    /* ── single helpers ── */
    const singleValue = !multiple ? (value as string | number | null | undefined) : null;
    const selected = !multiple ? options.find((o) => o.value === singleValue) : null;

    /* ── multiple helpers ── */
    const multiValue = multiple ? ((value as (string | number)[] | undefined) ?? []) : [];
    const selectedMultiple = multiple ? options.filter((o) => multiValue.includes(o.value)) : [];

    const hasValue = multiple ? multiValue.length > 0 : !!selected;

    const isSelected = (opt: ComboboxOption) =>
        multiple ? multiValue.includes(opt.value) : opt.value === singleValue;

    const toggleMultiple = (optValue: string | number) => {
        const current = multiValue;
        const next = current.includes(optValue)
            ? current.filter((v) => v !== optValue)
            : [...current, optValue];
        (onChange as (v: (string | number)[]) => void)(next);
    };

    const filtered = React.useMemo(() => {
        if (!search) return options;
        const q = search.toLowerCase();
        const result: ComboboxOption[] = [];
        let pendingHeader: ComboboxOption | null = null;
        for (const opt of options) {
            if (opt.disabled) {
                pendingHeader = opt;
            } else if (opt.label.toLowerCase().includes(q) || (opt.description?.toLowerCase().includes(q) ?? false)) {
                if (pendingHeader) { result.push(pendingHeader); pendingHeader = null; }
                result.push(opt);
            }
        }
        return result;
    }, [search, options]);

    /* trigger display label */
    const triggerContent = multiple
        ? multiValue.length === 0
            ? <span className="truncate text-ob-ink-3">{placeholder}</span>
            : multiValue.length === 1
              ? <span className="truncate text-ob-ink">{selectedMultiple[0]?.label}</span>
              : <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="inline-flex shrink-0 items-center rounded-full bg-ob-act/12 px-1.5 py-0.5 text-xs font-semibold text-ob-act">
                        {multiValue.length}
                    </span>
                    <span className="truncate text-sm text-ob-ink">
                        {selectedMultiple.map((o) => o.label).join(', ')}
                    </span>
                </div>
        : <span className="truncate">{selected ? selected.label : placeholder}</span>;

    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">
                    {label}
                </label>
            )}
            <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
                <PopoverTrigger asChild>
                    <button
                        id={inputId}
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'flex h-[42px] w-full items-center justify-between rounded-xl border bg-ob-inner px-3.5 text-left text-sm',
                            'transition-colors duration-150 ease-out motion-reduce:transition-none',
                            error
                                ? 'border-ob-late'
                                : open
                                  ? 'border-ob-act-fill/50'
                                  : 'border-ob-line hover:border-ob-line-strong',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
                            'disabled:pointer-events-none disabled:opacity-50',
                            hasValue ? 'text-ob-ink' : 'text-ob-ink-3',
                        )}
                    >
                        <div className="flex-1 min-w-0 flex items-center">{triggerContent}</div>
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                            {clearable && hasValue && !disabled && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (multiple) {
                                            (onChange as (v: (string | number)[]) => void)([]);
                                        } else {
                                            (onChange as (v: string | number | null) => void)(null);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.stopPropagation();
                                            if (multiple) {
                                                (onChange as (v: (string | number)[]) => void)([]);
                                            } else {
                                                (onChange as (v: string | number | null) => void)(null);
                                            }
                                        }
                                    }}
                                    className="rounded-full p-1 text-ob-ink-3 transition-colors duration-150 ease-out hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill motion-reduce:transition-none"
                                >
                                    <X className="h-3 w-3" />
                                </span>
                            )}
                            <ChevronDown
                                className={cn(
                                    'h-4 w-4 text-ob-ink-3 transition-transform duration-200 ease-out motion-reduce:transition-none',
                                    open && 'rotate-180',
                                )}
                            />
                        </div>
                    </button>
                </PopoverTrigger>
                {/* Panel (rounded-2xl, ob-card, bayangan, ob-fade-in) dari PopoverContent; di sini hanya lebar & padding nol untuk baris cari. */}
                <PopoverContent
                    className={cn('min-w-(--radix-popover-trigger-width) overflow-hidden p-0', popoverWidth ?? 'w-(--radix-popover-trigger-width)')}
                    align="start"
                >
                    <CommandPrimitive shouldFilter={false}>
                        <div className="flex items-center border-b border-ob-line px-3">
                            <Search className="mr-2.5 h-3.5 w-3.5 shrink-0 text-ob-ink-3" />
                            <CommandPrimitive.Input
                                value={search}
                                onValueChange={setSearch}
                                placeholder={searchPlaceholder}
                                className="flex h-9 w-full border-0 bg-transparent py-2 text-sm text-ob-ink outline-none placeholder:text-ob-ink-3 focus:outline-none focus:ring-0"
                            />
                        </div>
                        <CommandPrimitive.List
                            className="max-h-60 overflow-y-auto p-2"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {filtered.length === 0 && (
                                <p className="py-8 text-center text-[13px] text-ob-ink-2">
                                    {emptyText}
                                </p>
                            )}
                            {filtered.map((option) =>
                                option.disabled ? (
                                    <div
                                        key={option.value}
                                        className="select-none px-3 pb-1 pt-3 text-xs font-semibold text-ob-ink-3"
                                    >
                                        {option.label}
                                    </div>
                                ) : (
                                <CommandPrimitive.Item
                                    key={option.value}
                                    value={String(option.value)}
                                    onSelect={() => {
                                        if (multiple) {
                                            toggleMultiple(option.value);
                                        } else {
                                            (onChange as (v: string | number | null) => void)(option.value);
                                            setOpen(false);
                                            setSearch('');
                                        }
                                    }}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ob-ink outline-none',
                                        'transition-colors duration-150 ease-out motion-reduce:transition-none',
                                        'hover:bg-ob-hover aria-selected:bg-ob-hover',
                                        isSelected(option) && 'font-semibold',
                                    )}
                                >
                                    {/* Penanda pilihan = Checkbox mini (16 px, rounded, aktif ob-act-fill). */}
                                    <div
                                        className={cn(
                                            'h-4 w-4 shrink-0 flex items-center justify-center rounded border',
                                            isSelected(option)
                                                ? 'border-ob-act-fill bg-ob-act-fill text-white'
                                                : 'border-ob-line-strong bg-ob-inner text-transparent',
                                        )}
                                    >
                                        <Check className="h-3 w-3" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate">{option.label}</div>
                                        {option.description && (
                                            <div className="truncate text-xs font-normal text-ob-ink-3">
                                                {option.description}
                                            </div>
                                        )}
                                    </div>
                                </CommandPrimitive.Item>
                                )
                            )}
                        </CommandPrimitive.List>
                        {multiple && multiValue.length > 0 && (
                            <div className="border-t border-ob-line p-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        (onChange as (v: (string | number)[]) => void)([]);
                                        setOpen(false);
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs font-medium text-ob-ink-2 transition-colors duration-150 ease-out hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill motion-reduce:transition-none"
                                >
                                    Hapus semua pilihan ({multiValue.length})
                                </button>
                            </div>
                        )}
                    </CommandPrimitive>
                </PopoverContent>
            </Popover>
            {error && <p className="mt-1.5 text-xs text-ob-late">{error}</p>}
            {hint && !error && <p className="mt-1.5 text-xs text-ob-ink-3">{hint}</p>}
        </div>
    );
}
