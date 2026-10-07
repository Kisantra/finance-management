import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn, toLocalIso } from '@/lib/utils';

/*
 * Kalender rentang tanggal yang selalu tampil (bukan popover) untuk memilih periode Arus Kas.
 * Klik pertama = tanggal awal, klik kedua = tanggal akhir → langsung diterapkan. Enam baris
 * minggu tetap (fixedWeeks) agar tinggi kartu tidak berubah antarbulan.
 */

const MAX_DAYS = 731; // sama dengan DashboardChartRequest::MAX_RANGE_DAYS

/* Hari ini: tepi biru + titik kecil di bawah angka, seperti referensi. */
const TODAY =
    "[&>button]:border-ob-act-fill/60 [&>button]:after:absolute [&>button]:after:bottom-[4px] [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:rounded-full [&>button]:after:bg-ob-act [&>button]:after:content-['']";
const RANGE_END =
    '[&>button]:border-transparent [&>button]:bg-ob-act-fill [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-ob-act-fill [&>button]:after:bg-white';
/*
 * react-day-picker baru menandai range_start bila from DAN to terisi, jadi tanggal yang baru diklik
 * sekali tidak punya tanda apa pun. Penanda klik pertama + pratinjau rentang dipasang sendiri lewat
 * modifiers: tanggal awal solid dengan cincin, tanggal yang disorot/difokus bergaris putus-putus.
 */
const DRAFT = RANGE_END + ' [&>button]:ring-4 [&>button]:ring-ob-act-fill/25';
const PREVIEW = '[&>button]:border-dashed [&>button]:border-ob-act-fill/50 [&>button]:bg-ob-act-fill/10';
const PREVIEW_END =
    '[&>button]:border-ob-act-fill [&>button]:bg-ob-act-fill/25 [&>button]:font-semibold [&>button]:text-ob-act [&>button]:hover:border-ob-act-fill [&>button]:hover:bg-ob-act-fill/25';

interface RangeCalendarProps {
    /** Rentang yang sedang dipakai grafik; null bila grafik memakai pil periode. */
    from: string | null;
    to: string | null;
    onApply: (from: string, to: string) => void;
    /** Grafik sedang memakai pil periode: kalender ditampilkan redup. */
    inactive: boolean;
    /** Angka di kartu bawah (seperti referensi): arus bersih periode grafik. */
    summary: React.ReactNode;
    /** Aksi kecil di kartu bawah, mis. "Kembali ke Bulanan". */
    summaryAction?: React.ReactNode;
}

const parse = (iso: string) => new Date(iso + 'T00:00:00');
const dayCount = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
/** "5–12 Okt 2026", "28 Sep – 3 Okt 2026", atau "20 Des 2025 – 3 Jan 2026" — ringkas agar muat di kartu. */
const rangeLabel = (a: Date, b: Date) => {
    const f = (d: Date, pattern: string) => format(d, pattern, { locale: idLocale });
    if (a.getFullYear() !== b.getFullYear()) {
        return `${f(a, 'd MMM yyyy')} – ${f(b, 'd MMM yyyy')}`;
    }
    return a.getMonth() === b.getMonth() ? `${f(a, 'd')}–${f(b, 'd MMM yyyy')}` : `${f(a, 'd MMM')} – ${f(b, 'd MMM yyyy')}`;
};

export function RangeCalendar({ from, to, onApply, inactive, summary, summaryAction }: RangeCalendarProps) {
    const [draftFrom, setDraftFrom] = React.useState<Date | null>(null);
    const [month, setMonth] = React.useState<Date>(() => (to ? parse(to) : new Date()));
    const [error, setError] = React.useState<string | null>(null);
    /** Tanggal yang sedang disorot/difokus setelah klik pertama, untuk pratinjau rentang. */
    const [hovered, setHovered] = React.useState<Date | null>(null);

    // Rentang terpasang diganti dari luar (mis. pil periode dipilih) → batalkan pilihan setengah jadi.
    React.useEffect(() => {
        setDraftFrom(null);
        setHovered(null);
        setError(null);
    }, [from, to, inactive]);

    const selected = draftFrom ? { from: draftFrom, to: undefined } : from && to && !inactive ? { from: parse(from), to: parse(to) } : undefined;

    const onDayClick = (day: Date) => {
        setError(null);
        if (!draftFrom) {
            setDraftFrom(day);
            return;
        }
        const [a, b] = day < draftFrom ? [day, draftFrom] : [draftFrom, day];
        if (dayCount(a, b) > MAX_DAYS) {
            setError('Rentang maksimal 2 tahun.');
            setDraftFrom(null);
            return;
        }
        cancelDraft();
        onApply(toLocalIso(a), toLocalIso(b));
    };

    const cancelDraft = () => {
        setDraftFrom(null);
        setHovered(null);
    };

    const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
    const target = draftFrom && hovered && !sameDay(draftFrom, hovered) ? hovered : null;
    const [lo, hi] = draftFrom && target ? (target < draftFrom ? [target, draftFrom] : [draftFrom, target]) : [null, null];
    const modifiers = {
        draft: draftFrom ?? undefined,
        previewEnd: target ?? undefined,
        preview: lo && hi ? (d: Date) => d > lo && d < hi : undefined,
    };

    const status = draftFrom
        ? lo && hi
            ? `${rangeLabel(lo, hi)} · ${dayCount(lo, hi)} hari · klik untuk terapkan`
            : `Mulai ${format(draftFrom, 'd MMM yyyy', { locale: idLocale })} · pilih tanggal akhir`
        : from && to && !inactive
          ? `${rangeLabel(parse(from), parse(to))} · ${dayCount(parse(from), parse(to))} hari`
          : 'Pilih tanggal awal lalu tanggal akhir';

    const navBtn =
        'flex h-8 w-8 items-center justify-center rounded-full border border-ob-line bg-ob-inner text-ob-ink-2 transition-colors hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

    return (
        <div className="flex flex-1 flex-col gap-3">
            <div
                onMouseLeave={() => setHovered(null)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape' && draftFrom) {
                        e.stopPropagation();
                        cancelDraft();
                    }
                }}
                className={cn('flex flex-col gap-3 transition-opacity duration-200', inactive && !draftFrom && 'opacity-55 hover:opacity-100 focus-within:opacity-100')}
            >
                <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Bulan sebelumnya" className={navBtn}>
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span aria-live="polite" className="text-[15px] font-semibold capitalize text-ob-ink">
                        {format(month, 'MMMM, yyyy', { locale: idLocale })}
                    </span>
                    <button type="button" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Bulan berikutnya" className={navBtn}>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Ubin per tanggal seperti referensi: hari di luar bulan berarsir tanpa angka. */}
                <DayPicker
                    mode="range"
                    selected={selected}
                    onSelect={() => {}}
                    onDayClick={onDayClick}
                    onDayMouseEnter={(d) => draftFrom && setHovered(d)}
                    onDayFocus={(d) => draftFrom && setHovered(d)}
                    modifiers={modifiers}
                    modifiersClassNames={{ draft: DRAFT, preview: PREVIEW, previewEnd: PREVIEW_END }}
                    month={month}
                    onMonthChange={setMonth}
                    locale={idLocale}
                    weekStartsOn={1}
                    fixedWeeks
                    showOutsideDays
                    hideNavigation
                    formatters={{ formatWeekdayName: (d) => format(d, 'EEEEE', { locale: idLocale }) }}
                    classNames={{
                        root: 'w-full',
                        months: 'w-full',
                        month: 'w-full',
                        month_caption: 'hidden',
                        month_grid: 'w-full border-collapse',
                        weekdays: 'grid grid-cols-7 gap-1.5',
                        weekday: 'pb-1 text-center text-xs font-medium text-ob-ink-3',
                        weeks: 'flex flex-col gap-1.5',
                        week: 'grid grid-cols-7 gap-1.5',
                        day: 'relative p-0 text-[13px]',
                        day_button:
                            'relative flex h-[34px] w-full items-center justify-center rounded-[10px] border border-ob-line-soft bg-ob-inner font-medium text-ob-ink transition-colors hover:border-ob-line-strong hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                        today: TODAY,
                        outside: 'pointer-events-none [&>button]:border-transparent [&>button]:bg-transparent [&>button]:text-transparent [&>button]:[background-image:repeating-linear-gradient(135deg,var(--ob-hatch-edge)_0_1px,transparent_1px_6px)]',
                        range_middle: '[&>button]:border-ob-act-fill/35 [&>button]:bg-ob-act-fill/20 [&>button]:text-ob-ink',
                        range_start: RANGE_END,
                        range_end: RANGE_END,
                        selected: '',
                    }}
                />
            </div>

            {/* Kartu angka di bawah kalender, seperti referensi. */}
            <div className={cn('mt-auto flex items-center gap-3 rounded-2xl border bg-ob-inner p-3.5 transition-colors', draftFrom ? 'border-ob-act-fill/50' : 'border-ob-line')}>
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ob-line bg-ob-card text-ob-ink-2">
                    <BarChart3 className="h-4 w-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[22px] font-semibold leading-tight text-ob-ink">{summary}</span>
                    <span role={error ? 'alert' : undefined} aria-live="polite" className={cn('text-xs leading-snug', error ? 'text-ob-late' : draftFrom ? 'font-medium text-ob-act' : 'text-ob-ink-2')}>
                        {error ?? status}
                    </span>
                </div>
                {draftFrom ? (
                    <button
                        type="button"
                        onClick={cancelDraft}
                        className="shrink-0 rounded-full border border-ob-line px-3 py-1.5 text-xs font-semibold text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                    >
                        Batal
                    </button>
                ) : (
                    summaryAction
                )}
            </div>
        </div>
    );
}
