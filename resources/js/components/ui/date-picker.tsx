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
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold text-dark-900 dark:text-dark-50 hover:bg-zinc-100 dark:hover:bg-dark-600 transition-colors"
                >
                    {label}
                    <ChevronDown
                        className={cn(
                            'h-3 w-3 text-dark-400 transition-transform duration-150',
                            open && 'rotate-180',
                        )}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className={cn('p-1.5 max-h-52 overflow-y-auto', isMany ? 'w-28' : 'w-44')}
                align="center"
            >
                <div className={cn(isMany ? 'flex flex-col gap-0.5' : 'grid grid-cols-3 gap-0.5')}>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onSelect(opt.value);
                                setOpen(false);
                            }}
                            className={cn(
                                'px-2 py-1.5 rounded-lg text-sm text-center transition-colors',
                                opt.value === selected
                                    ? 'bg-primary-600 text-white font-medium'
                                    : 'text-dark-700 dark:text-dark-300 hover:bg-zinc-50 dark:hover:bg-dark-600',
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
        <div className="flex items-center justify-between px-1 pb-3">
            <button
                type="button"
                disabled={!previousMonth}
                onClick={() => previousMonth && goToMonth(previousMonth)}
                aria-label="Bulan sebelumnya"
                className="h-8 w-8 flex items-center justify-center rounded-lg text-dark-400 hover:bg-zinc-100 dark:hover:bg-dark-600 hover:text-dark-900 dark:hover:text-dark-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
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
                className="h-8 w-8 flex items-center justify-center rounded-lg text-dark-400 hover:bg-zinc-100 dark:hover:bg-dark-600 hover:text-dark-900 dark:hover:text-dark-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
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
        <div className="p-3 w-56">
            {/* Year navigation */}
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    disabled={year <= fromYear}
                    onClick={() => onYearChange(year - 1)}
                    aria-label="Tahun sebelumnya"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-dark-400 hover:bg-zinc-100 dark:hover:bg-dark-600 hover:text-dark-900 dark:hover:text-dark-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-dark-900 dark:text-dark-50 tabular-nums">
                    {year}
                </span>
                <button
                    type="button"
                    disabled={year >= toYear}
                    onClick={() => onYearChange(year + 1)}
                    aria-label="Tahun berikutnya"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-dark-400 hover:bg-zinc-100 dark:hover:bg-dark-600 hover:text-dark-900 dark:hover:text-dark-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Month grid — 3 columns × 4 rows */}
            <div className="grid grid-cols-3 gap-1">
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
                                'py-2 rounded-lg text-sm text-center font-medium transition-colors',
                                isSelected
                                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                                    : isCurrentMonth
                                      ? 'text-primary-600 dark:text-primary-400 hover:bg-zinc-100 dark:hover:bg-dark-600'
                                      : 'text-dark-700 dark:text-dark-300 hover:bg-zinc-100 dark:hover:bg-dark-600',
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
            <span className="text-dark-900 dark:text-dark-50 truncate">
                {MONTH_NAMES_FULL[parseInt(monthValue.split('-')[1]) - 1]}{' '}
                {monthValue.split('-')[0]}
            </span>
        ) : (
            <span className="text-dark-400 dark:text-dark-500">{placeholder}</span>
        )
    ) : isRange ? (
        !rangeValue?.from && !rangeValue?.to ? (
            <span className="text-dark-400 dark:text-dark-500">{placeholder}</span>
        ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                    className={cn(
                        'truncate',
                        rangeValue?.from
                            ? 'text-dark-900 dark:text-dark-50'
                            : 'text-dark-400 dark:text-dark-500',
                    )}
                >
                    {rangeValue?.from
                        ? format(rangeValue.from, 'dd MMM yyyy', { locale: idLocale })
                        : placeholder}
                </span>
                <span className="text-dark-300 dark:text-dark-500 shrink-0">→</span>
                <span
                    className={cn(
                        'truncate',
                        rangeValue?.to
                            ? 'text-dark-900 dark:text-dark-50'
                            : 'text-dark-400 dark:text-dark-500',
                    )}
                >
                    {rangeValue?.to
                        ? format(rangeValue.to, 'dd MMM yyyy', { locale: idLocale })
                        : (props as DatePickerRangeProps).placeholderTo ?? 'Tanggal akhir...'}
                </span>
            </div>
        )
    ) : (
        <span
            className={cn(
                'truncate',
                singleValue ? 'text-dark-900 dark:text-dark-50' : 'text-dark-400 dark:text-dark-500',
            )}
        >
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
                    className="mb-1.5 block text-sm font-medium text-dark-900 dark:text-dark-300"
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
                            'flex h-10 w-full items-center rounded-xl border px-3 text-sm text-left transition-all duration-150',
                            'bg-white dark:bg-dark-800',
                            error
                                ? 'border-red-400 dark:border-red-500 ring-2 ring-red-500/10'
                                : open
                                  ? 'border-primary-500 ring-2 ring-primary-500/15 dark:border-primary-500'
                                  : 'border-secondary-200 dark:border-dark-600 hover:border-secondary-300 dark:hover:border-dark-500',
                            'focus-visible:outline-none',
                            'disabled:cursor-not-allowed disabled:bg-secondary-50 dark:disabled:bg-dark-700 disabled:opacity-60',
                        )}
                    >
                        <CalendarDays
                            className={cn(
                                'h-4 w-4 shrink-0 mr-2.5 transition-colors',
                                hasValue
                                    ? 'text-primary-500 dark:text-primary-400'
                                    : 'text-dark-400 dark:text-dark-500',
                            )}
                        />
                        <div className="flex-1 min-w-0 flex items-center">{triggerLabel}</div>
                        {clearable && hasValue && !disabled && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={handleClear}
                                onKeyDown={(e) => e.key === 'Enter' && handleClear(e)}
                                className="ml-1.5 shrink-0 rounded-md p-1 text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </span>
                        )}
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    className="w-auto p-0"
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
                                root: 'p-3',
                                months: 'flex flex-col',
                                month: 'space-y-0',
                                month_caption: '',
                                caption_label: 'hidden',
                                nav: 'hidden',
                                month_grid: 'w-full border-collapse',
                                weekdays: 'flex',
                                weekday:
                                    'text-dark-400 dark:text-dark-500 w-9 font-medium text-[0.8rem] text-center',
                                weeks: '',
                                week: 'flex w-full mt-2',
                                day: 'h-9 w-9 text-center text-sm p-0 relative',
                                day_button:
                                    'h-9 w-9 p-0 font-normal rounded-xl hover:bg-zinc-100 dark:hover:bg-dark-600 text-dark-900 dark:text-dark-200 flex items-center justify-center text-sm transition-colors',
                                selected: '!bg-primary-600 !text-white hover:!bg-primary-700',
                                today: '!font-bold !text-primary-600 dark:!text-primary-400',
                                outside: 'opacity-30',
                                disabled: 'opacity-30 cursor-not-allowed',
                                range_start: '!rounded-r-none',
                                range_end: '!rounded-l-none',
                                range_middle:
                                    '!bg-primary-100 dark:!bg-primary-900/30 !rounded-none !text-primary-900 dark:!text-primary-100 hover:!bg-primary-200 dark:hover:!bg-primary-900/50',
                            }}
                        />
                        {isRange && (
                            <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1 border-t border-secondary-200 dark:border-dark-600">
                                <span className="text-xs text-dark-400 dark:text-dark-500">
                                    {draftRange.from && draftRange.to
                                        ? `${format(draftRange.from, 'dd MMM', { locale: idLocale })} → ${format(draftRange.to, 'dd MMM yyyy', { locale: idLocale })}`
                                        : draftRange.from
                                          ? `${format(draftRange.from, 'dd MMM yyyy', { locale: idLocale })} → ...`
                                          : 'Pilih tanggal awal'}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-dark-600 dark:text-dark-400 hover:bg-zinc-100 dark:hover:bg-dark-600 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!draftRange.from || !draftRange.to}
                                        onClick={commitRange}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

            {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
            {hint && !error && (
                <p className="mt-1.5 text-xs text-dark-500 dark:text-dark-400">{hint}</p>
            )}
        </div>
    );
}
