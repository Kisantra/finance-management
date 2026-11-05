import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    suffix?: string;
    className?: string;
    disabled?: boolean;
}

/**
 * Slider — range input bergaya Obsidian: lintasan ob-chip, isi ob-act-fill sampai nilai,
 * kenop putih bertepi ob-line-strong.
 *
 * WebKit tidak punya pseudo-elemen "isi", jadi isi digambar lewat latar dua warna berhenti
 * tegas di --slider-fill (bukan gradasi). Firefox memakai ::-moz-range-progress bawaannya.
 */
function Slider({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    suffix,
    className,
    disabled,
}: SliderProps) {
    const id = React.useId();
    const fill = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">
                    {label}
                </label>
            )}
            <div className="flex items-center gap-2">
                <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange(+e.target.value)}
                    style={{ '--slider-fill': `${fill}%` } as React.CSSProperties}
                    className={cn(
                        'h-1.5 flex-1 cursor-pointer appearance-none rounded-full',
                        'bg-[linear-gradient(to_right,var(--ob-act-fill)_var(--slider-fill),var(--ob-chip)_var(--slider-fill))]',
                        // WebKit thumb
                        '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none',
                        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ob-line-strong [&::-webkit-slider-thumb]:bg-white',
                        // Firefox track, fill, thumb
                        '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-ob-chip',
                        '[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-ob-act-fill',
                        '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer',
                        '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ob-line-strong [&::-moz-range-thumb]:bg-white',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page',
                        'disabled:pointer-events-none disabled:opacity-50',
                    )}
                />
                {suffix !== undefined && (
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ob-ink-2">
                        {value}{suffix}
                    </span>
                )}
            </div>
        </div>
    );
}

Slider.displayName = 'Slider';

export { Slider };
