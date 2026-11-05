import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import * as React from 'react';
import { DayPicker, useDayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/* ─── Types ────────────────────────────────────────────── */

interface BaseProps {
    label?: string;
    hint?: string;
    error?: string;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    className?: string;
    minDate?: Date;
    maxDate?: Date;
    fromYear?: number;
    toYear?: number;
}

export interface DatePickerSingleProps extends BaseProps {
    mode?: 'single';
    value?: Date | null;
    onChange: (date: Date | null) => void;
}

export interface DatePickerRangeProps extends BaseProps {
    mode: 'range';
    value?: { from: Date | null; to: Date | null };
    onChange: (range: { from: Date | null; to: Date | null }) => void;
    placeholderTo?: string;
}

/** value is a "YYYY-MM" string, e.g. "2026-05" */
export interface DatePickerMonthProps extends BaseProps {
    mode: 'month';
    value?: string | null;
    onChange: (month: string | null) => void;
}

export type DatePickerProps = DatePickerSingleProps | DatePickerRangeProps | DatePickerMonthProps;

/* ─── Month names (Indonesian short) ───────────────────── */

const MONTH_NAMES_SHORT = Array.from({ length: 12 }, (_, i) =>
    format(new Date(2024, i, 1), 'MMM', { locale: idLocale }),
);

const MONTH_NAMES_FULL = Array.from({ length: 12 }, (_, i) =>
    format(new Date(2024, i, 1), 'MMMM', { locale: idLocale }),
);

/* ─── Obsidian classes ─────────────────────────────────── */
/*
 * Tokens are the --ob-* variables in resources/css/app.css; they swap per theme, so there are
 * no dark-mode variants. Floating panel = the menus in layouts/header.tsx; tiles, today marker,
 * range and round nav buttons = the dashboard calendar (components/dashboard/range-calendar.tsx).
 */

/** Focus ring inside the panel; the offset matches bg-ob-card so it stays visible on blue fills. */
const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-card';

const PANEL =
    'rounded-2xl border border-ob-line bg-ob-card p-2 text-ob-ink shadow-xl shadow-black/20 ob-fade-in ob-motion';

const NAV_BUTTON = cn(
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ob-line bg-ob-inner text-ob-ink-2 transition-colors duration-150 ease-out hover:bg-ob-hover hover:text-ob-ink disabled:pointer-events-none disabled:opacity-50',
    FOCUS_RING,
);

/** Day / month tile. */
const TILE = cn(
    'relative flex h-[34px] w-9 items-center justify-center rounded-[10px] border border-ob-line-soft bg-ob-inner p-0 text-[13px] font-medium text-ob-ink transition-colors duration-150 ease-out hover:border-ob-line-strong hover:bg-ob-hover',
    FOCUS_RING,
);

/** Today / current month: blue edge + small dot under the number. */
const TILE_TODAY =
    "border-ob-act-fill/60 hover:border-ob-act-fill/60 after:absolute after:bottom-[4px] after:h-1 after:w-1 after:rounded-full after:bg-ob-act after:content-['']";

const TILE_SELECTED =
    'border-transparent bg-ob-act-fill font-semibold text-white hover:border-transparent hover:bg-ob-act-fill after:bg-white';

/*
 * react-day-picker puts modifier classes on the day <td>, so they style its button through
 * [&>button]. Every day of a range is also "selected": the range-middle classes carry
 * [aria-selected] to outrank DAY_SELECTED, and the today edge/dot colour skips selected days
 * so the selection always wins (white dot on the blue fill).
 */
const DAY_SELECTED =
    '[&>button]:border-transparent [&>button]:bg-ob-act-fill [&>button]:font-semibold [&>button]:text-white [&>button]:hover:border-transparent [&>button]:hover:bg-ob-act-fill [&>button]:after:bg-white';

const DAY_RANGE_MIDDLE =
    '[&[aria-selected]>button]:border-ob-act-fill/35 [&[aria-selected]>button]:bg-ob-act-fill/15 [&[aria-selected]>button]:font-medium [&[aria-selected]>button]:text-ob-ink [&[aria-selected]>button]:hover:border-ob-act-fill/50 [&[aria-selected]>button]:hover:bg-ob-act-fill/25 [&[aria-selected]>button]:after:bg-ob-act';

const DAY_TODAY =
    "[&>button]:after:absolute [&>button]:after:bottom-[4px] [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:rounded-full [&>button]:after:content-[''] [&:not([aria-selected])>button]:border-ob-act-fill/60 [&:not([aria-selected])>button]:after:bg-ob-act";

/* ─── Inline calendar header dropdown ──────────────────── */

function CalendarDropdown({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string;
    options: { value: number; label: string }[];
    selected: number;
    onSelect: (v: number) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const isMany = options.length > 12;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex h-8 items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold capitalize text-ob-ink transition-colors duration-150 ease-out hover:bg-ob-hover data-[state=open]:bg-ob-hover',
                        FOCUS_RING,
                    )}
                >
                    {label}
                    <ChevronDown
                        className={cn(
                            'h-3.5 w-3.5 text-ob-ink-3 transition-transform duration-150',
                            open && 'rotate-180',
                        )}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className={cn(PANEL, 'ob-scroll max-h-56', isMany ? 'w-28' : 'w-44')}
                align="center"
            >
                <div className={cn(isMany ? 'flex flex-col gap-1' : 'grid grid-cols-3 gap-1')}>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onSelect(opt.value);
                                setOpen(false);
                            }}
                            className={cn(
                                'rounded-xl px-2 py-2 text-center text-sm transition-colors duration-150 ease-out',
                                FOCUS_RING,
                                opt.value === selected
                                    ? 'bg-ob-act-fill font-semibold text-white'
                                    : 'text-ob-ink hover:bg-ob-hover',
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/* ─── Custom MonthCaption (for day/range modes) ─────────── */

function MonthCaptionInner({
    calendarMonth,
    fromYear,
    toYear,
}: {
    calendarMonth: { date: Date };
    fromYear: number;
    toYear: number;
}) {
    const { goToMonth, nextMonth, previousMonth } = useDayPicker();
    const month = calendarMonth.date;

    const monthOptions = React.useMemo(
        () =>
            Array.from({ length: 12 }, (_, i) => ({
                value: i,
                label: format(new Date(2024, i, 1), 'MMM', { locale: idLocale }),
            })),
        [],
    );

    const yearOptions = React.useMemo(
        () =>
            Array.from({ length: toYear - fromYear + 1 }, (_, i) => ({
                value: fromYear + i,
                label: String(fromYear + i),
            })),
        [fromYear, toYear],
    );

    return (
        <div className="flex items-center justify-between pb-3">
            <button
                type="button"
                disabled={!previousMonth}
                onClick={() => previousMonth && goToMonth(previousMonth)}
                aria-label="Bulan sebelumnya"
                className={NAV_BUTTON}
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-0.5">
                <CalendarDropdown
                    label={format(month, 'MMMM', { locale: idLocale })}
                    options={monthOptions}
                    selected={month.getMonth()}
                    onSelect={(m) => goToMonth(new Date(month.getFullYear(), m, 1))}
                />
                <CalendarDropdown
                    label={String(month.getFullYear())}
                    options={yearOptions}
                    selected={month.getFullYear()}
                    onSelect={(y) => goToMonth(new Date(y, month.getMonth(), 1))}
                />
            </div>

            <button
                type="button"
                disabled={!nextMonth}
                onClick={() => nextMonth && goToMonth(nextMonth)}
                aria-label="Bulan berikutnya"
                className={NAV_BUTTON}
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}

/* ─── Month grid (for month mode) ──────────────────────── */

function MonthGrid({
    year,
    selectedValue,
    onSelect,
    onYearChange,
    fromYear,
    toYear,
}: {
    year: number;
    selectedValue: string | null;
    onSelect: (month: string) => void;
    onYearChange: (year: number) => void;
    fromYear: number;
    toYear: number;
}) {
    const now = new Date();
    const selectedYear = selectedValue ? parseInt(selectedValue.split('-')[0]) : null;
    const selectedMonth = selectedValue ? parseInt(selectedValue.split('-')[1]) - 1 : null;

    return (
        <div className="w-52 p-1">
            {/* Year navigation */}
            <div className="mb-3 flex items-center justify-between">
                <button
                    type="button"
                    disabled={year <= fromYear}
                    onClick={() => onYearChange(year - 1)}
                    aria-label="Tahun sebelumnya"
                    className={NAV_BUTTON}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[15px] font-semibold text-ob-ink tabular-nums">
                    {year}
                </span>
                <button
                    type="button"
                    disabled={year >= toYear}
                    onClick={() => onYearChange(year + 1)}
                    aria-label="Tahun berikutnya"
                    className={NAV_BUTTON}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Month grid — 3 columns × 4 rows */}
            <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES_SHORT.map((name, idx) => {
                    const isSelected = selectedYear === year && selectedMonth === idx;
                    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === idx;

                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                const mm = String(idx + 1).padStart(2, '0');
                                onSelect(`${year}-${mm}`);
                            }}
                            title={MONTH_NAMES_FULL[idx]}
                            className={cn(
                                TILE,
                                'h-9 w-full',
                                isCurrentMonth && TILE_TODAY,
                                isSelected && TILE_SELECTED,
                            )}
                        >
                            {name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── DatePicker ────────────────────────────────────────── */

export function DatePicker(props: DatePickerProps) {
    const {
        label,
        hint,
        error,
        disabled,
        clearable = true,
        className,
        minDate,
        maxDate,
        fromYear = new Date().getFullYear() - 10,
        toYear = new Date().getFullYear() + 5,
        placeholder = 'Pilih tanggal...',
    } = props;

    const [open, setOpen] = React.useState(false);
    const inputId = React.useId();

    const isMonth = props.mode === 'month';
    const isRange = props.mode === 'range';

    const monthValue = isMonth ? ((props as DatePickerMonthProps).value ?? null) : null;
    // An Invalid Date would make format() throw and take the whole dialog down; treat it as empty.
    const rawSingleValue = !isMonth && !isRange ? ((props as DatePickerSingleProps).value ?? null) : null;
    const singleValue = rawSingleValue && !Number.isNaN(rawSingleValue.getTime()) ? rawSingleValue : null;
    const rangeValue = isRange ? ((props as DatePickerRangeProps).value ?? null) : null;

    /* picker year for month mode — initialised from value or current year */
    const initialPickerYear = React.useMemo(() => {
        if (monthValue) return parseInt(monthValue.split('-')[0]);
        return new Date().getFullYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [pickerYear, setPickerYear] = React.useState(initialPickerYear);

    /* sync pickerYear when popover opens */
    React.useEffect(() => {
        if (open && isMonth) {
            setPickerYear(
                monthValue ? parseInt(monthValue.split('-')[0]) : new Date().getFullYear(),
            );
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const hasValue = isMonth
        ? !!monthValue
        : isRange
          ? !!(rangeValue?.from || rangeValue?.to)
          : !!singleValue;

    /* trigger label */
    const triggerLabel = isMonth ? (
        monthValue ? (
            <span className="truncate text-ob-ink">
                {MONTH_NAMES_FULL[parseInt(monthValue.split('-')[1]) - 1]}{' '}
                {monthValue.split('-')[0]}
            </span>
        ) : (
            <span className="text-ob-ink-3">{placeholder}</span>
        )
    ) : isRange ? (
        !rangeValue?.from && !rangeValue?.to ? (
            <span className="text-ob-ink-3">{placeholder}</span>
        ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={cn('truncate', rangeValue?.from ? 'text-ob-ink' : 'text-ob-ink-3')}>
                    {rangeValue?.from
                        ? format(rangeValue.from, 'dd MMM yyyy', { locale: idLocale })
                        : placeholder}
                </span>
                <span className="shrink-0 text-ob-ink-3">→</span>
                <span className={cn('truncate', rangeValue?.to ? 'text-ob-ink' : 'text-ob-ink-3')}>
                    {rangeValue?.to
                        ? format(rangeValue.to, 'dd MMM yyyy', { locale: idLocale })
                        : (props as DatePickerRangeProps).placeholderTo ?? 'Tanggal akhir...'}
                </span>
            </div>
        )
    ) : (
        <span className={cn('truncate', singleValue ? 'text-ob-ink' : 'text-ob-ink-3')}>
            {singleValue ? format(singleValue, 'dd MMM yyyy', { locale: idLocale }) : placeholder}
        </span>
    );

    /* clear — plain function so it always calls the latest props.onChange
       (a useCallback memoized on [isMonth, isRange] would capture a stale
       onChange from the first render, dropping other filters on clear). */
    const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        if (isMonth) {
            (props as DatePickerMonthProps).onChange(null);
        } else if (isRange) {
            (props as DatePickerRangeProps).onChange({ from: null, to: null });
        } else {
            (props as DatePickerSingleProps).onChange(null);
        }
    };

    /* stable MonthCaption component for day/range modes */
    const MonthCaptionComponent = React.useMemo(() => {
        const fy = fromYear;
        const ty = toYear;
        // eslint-disable-next-line react/display-name
        return ({ calendarMonth }: { calendarMonth: { date: Date } }) => (
            <MonthCaptionInner calendarMonth={calendarMonth} fromYear={fy} toYear={ty} />
        );
    }, [fromYear, toYear]);

    /* internal draft state for range mode — committed only on "Terapkan" */
    const [draftRange, setDraftRange] = React.useState<{ from: Date | null; to: Date | null }>({
        from: null,
        to: null,
    });

    /* sync draft when popover opens */
    React.useEffect(() => {
        if (open && isRange) {
            setDraftRange({
                from: rangeValue?.from ?? null,
                to: rangeValue?.to ?? null,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const commitRange = () => {
        (props as DatePickerRangeProps).onChange(draftRange);
        setOpen(false);
    };

    /* DayPicker props for single/range modes */
    const pickerProps = isRange
        ? {
              mode: 'range' as const,
              selected: {
                  from: draftRange.from ?? undefined,
                  to: draftRange.to ?? undefined,
              },
              onSelect: (range: { from?: Date; to?: Date } | undefined) => {
                  setDraftRange({
                      from: range?.from ?? null,
                      to: range?.to ?? null,
                  });
              },
          }
        : {
              mode: 'single' as const,
              selected: singleValue ?? undefined,
              onSelect: (date: Date | undefined) => {
                  (props as DatePickerSingleProps).onChange(date ?? null);
                  setOpen(false);
              },
          };

    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="mb-1.5 block text-[13px] font-medium text-ob-ink-2"
                >
                    {label}
                </label>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        id={inputId}
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'flex h-[42px] w-full items-center rounded-xl border bg-ob-inner px-3.5 text-left text-sm text-ob-ink transition-colors duration-150 ease-out motion-reduce:transition-none',
                            error
                                ? 'border-ob-late'
                                : open
                                  ? 'border-ob-act-fill/50'
                                  : 'border-ob-line hover:border-ob-line-strong',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
                            'disabled:pointer-events-none disabled:opacity-50',
                        )}
                    >
                        <CalendarDays
                            className={cn(
                                'mr-2.5 h-4 w-4 shrink-0 transition-colors duration-150 motion-reduce:transition-none',
                                hasValue ? 'text-ob-ink-2' : 'text-ob-ink-3',
                            )}
                        />
                        <div className="flex-1 min-w-0 flex items-center">{triggerLabel}</div>
                        {clearable && hasValue && !disabled && (
                            <span
                                role="button"
                                tabIndex={0}
                                aria-label="Hapus tanggal"
                                onClick={handleClear}
                                onKeyDown={(e) => e.key === 'Enter' && handleClear(e)}
                                className="ml-1.5 shrink-0 rounded-full p-1 text-ob-ink-3 transition-colors duration-150 ease-out hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill motion-reduce:transition-none"
                            >
                                <X className="h-3 w-3" />
                            </span>
                        )}
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    className={cn(PANEL, 'w-auto')}
                    align="start"
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement;
                        /* prevent close when clicking nested popovers (month/year dropdowns) */
                        if (target.closest('[data-radix-popper-content-wrapper]')) {
                            e.preventDefault();
                            return;
                        }
                        /* range mode: always prevent accidental close, user must click Terapkan */
                        if (isRange) {
                            e.preventDefault();
                        }
                    }}
                >
                    {isMonth ? (
                        <MonthGrid
                            year={pickerYear}
                            selectedValue={monthValue}
                            onSelect={(month) => {
                                (props as DatePickerMonthProps).onChange(month);
                                setOpen(false);
                            }}
                            onYearChange={setPickerYear}
                            fromYear={fromYear}
                            toYear={toYear}
                        />
                    ) : (
                        <>
                        <DayPicker
                            {...pickerProps}
                            locale={idLocale}
                            disabled={[
                                ...(minDate ? [{ before: minDate }] : []),
                                ...(maxDate ? [{ after: maxDate }] : []),
                            ]}
                            components={{ MonthCaption: MonthCaptionComponent as any }}
                            classNames={{
                                root: 'p-1',
                                months: 'flex flex-col',
                                month: 'space-y-0',
                                month_caption: '',
                                caption_label: 'hidden',
                                nav: 'hidden',
                                month_grid: 'w-full border-collapse',
                                weekdays: 'flex gap-1.5',
                                weekday: 'w-9 pb-1 text-center text-xs font-medium text-ob-ink-3',
                                weeks: 'flex flex-col gap-1.5',
                                week: 'flex gap-1.5',
                                day: 'relative h-[34px] w-9 p-0 text-center text-[13px]',
                                day_button: TILE,
                                selected: DAY_SELECTED,
                                today: DAY_TODAY,
                                outside: '[&>button]:border-transparent [&>button]:bg-transparent [&>button]:text-ob-ink-3',
                                disabled: '[&>button]:pointer-events-none [&>button]:opacity-50',
                                range_start: '',
                                range_end: '',
                                range_middle: DAY_RANGE_MIDDLE,
                            }}
                        />
                        {isRange && (
                            <div className="mt-1 flex items-center justify-between gap-3 border-t border-ob-line px-1 pt-2.5 pb-0.5">
                                <span className="text-xs text-ob-ink-2">
                                    {draftRange.from && draftRange.to
                                        ? `${format(draftRange.from, 'dd MMM', { locale: idLocale })} → ${format(draftRange.to, 'dd MMM yyyy', { locale: idLocale })}`
                                        : draftRange.from
                                          ? `${format(draftRange.from, 'dd MMM yyyy', { locale: idLocale })} → ...`
                                          : 'Pilih tanggal awal'}
                                </span>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            'h-8 rounded-full px-3 text-xs font-semibold text-ob-ink-2 transition-colors duration-150 ease-out hover:bg-ob-hover hover:text-ob-ink',
                                            FOCUS_RING,
                                        )}
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!draftRange.from || !draftRange.to}
                                        onClick={commitRange}
                                        className={cn(
                                            'h-8 rounded-full bg-ob-act-fill px-3 text-xs font-semibold text-white transition-colors duration-150 ease-out hover:bg-ob-act-fill/90 disabled:pointer-events-none disabled:opacity-50',
                                            FOCUS_RING,
                                        )}
                                    >
                                        Terapkan
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                </PopoverContent>
            </Popover>

            {error && <p className="mt-1.5 text-xs text-ob-late">{error}</p>}
            {hint && !error && <p className="mt-1.5 text-xs text-ob-ink-3">{hint}</p>}
        </div>
    );
}
