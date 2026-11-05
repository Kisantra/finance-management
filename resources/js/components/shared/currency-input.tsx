import * as React from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
    value?: number | null;
    onChange?: (value: number) => void;
    label?: string;
    hint?: string;
    error?: string;
    placeholder?: string;
    prefix?: string;
    disabled?: boolean;
    className?: string;
    id?: string;
}

export function CurrencyInput({
    value,
    onChange,
    label,
    hint,
    error,
    placeholder = '0',
    prefix = 'Rp',
    disabled,
    className,
    id,
}: CurrencyInputProps) {
    const inputId = id ?? React.useId();

    const [displayValue, setDisplayValue] = React.useState<string>(() =>
        value != null && value > 0 ? value.toLocaleString('id-ID') : '',
    );

    React.useEffect(() => {
        if (value != null && value > 0) {
            setDisplayValue(value.toLocaleString('id-ID'));
        } else if (!value) {
            setDisplayValue('');
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        const numeric = parseInt(raw, 10) || 0;

        setDisplayValue(numeric > 0 ? numeric.toLocaleString('id-ID') : '');
        onChange?.(numeric);
    };

    const handleBlur = () => {
        const numeric = parseInt(displayValue.replace(/[^0-9]/g, ''), 10) || 0;
        setDisplayValue(numeric > 0 ? numeric.toLocaleString('id-ID') : '');
    };

    return (
        <div className="w-full min-w-0">
            {label && (
                <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">
                    {label}
                </label>
            )}
            {/* Cincin fokus di pembungkus agar melingkari prefiks + input, bukan menimpa tepi prefiks. */}
            <div className="relative flex rounded-xl focus-within:ring-2 focus-within:ring-ob-act-fill focus-within:ring-offset-2 focus-within:ring-offset-ob-page">
                {/* Kelas rounded-l-xl dipakai FIELD/FIELD_SM (pages/invoices/components/ob.tsx) untuk menyasar prefiks — jangan diganti. */}
                <span
                    className={cn(
                        'inline-flex select-none items-center rounded-l-xl border border-r-0 bg-ob-chip px-3 text-sm text-ob-ink-2',
                        error ? 'border-ob-late' : 'border-ob-line',
                        disabled && 'opacity-50',
                    )}
                >
                    {prefix}
                </span>
                <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        'h-[42px] min-w-0 flex-1 rounded-r-xl border bg-ob-inner px-3.5 py-1.5 text-sm text-ob-ink placeholder:text-ob-ink-3',
                        'transition-colors duration-150 ease-out motion-reduce:transition-none',
                        error ? 'border-ob-late' : 'border-ob-line',
                        'focus:outline-none focus:ring-0',
                        'disabled:pointer-events-none disabled:opacity-50',
                        className,
                    )}
                />
            </div>
            {error && <p className="mt-1 text-xs text-ob-late">{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-ob-ink-3">{hint}</p>}
        </div>
    );
}
