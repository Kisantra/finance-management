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
                <label
                    htmlFor={inputId}
                    className="mb-1.5 block text-sm font-medium text-dark-900 dark:text-dark-300"
                >
                    {label}
                </label>
            )}
            <div className="relative flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-secondary-200 dark:border-dark-600 bg-secondary-50 dark:bg-dark-700 px-3 text-sm text-dark-600 dark:text-dark-400 select-none">
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
                        'h-10 min-w-0 flex-1 rounded-r-xl border text-sm transition-colors',
                        'bg-white dark:bg-dark-800',
                        'text-dark-900 dark:text-dark-300',
                        'placeholder:text-dark-400 dark:placeholder:text-dark-400',
                        error
                            ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                            : 'border-secondary-200 dark:border-dark-600 focus:ring-primary-500',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0',
                        'disabled:cursor-not-allowed disabled:bg-secondary-50 dark:disabled:bg-dark-600 disabled:opacity-60',
                        'px-3 py-1.5',
                        className,
                    )}
                />
            </div>
            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
            {hint && !error && (
                <p className="mt-1 text-xs text-dark-500 dark:text-dark-400">{hint}</p>
            )}
        </div>
    );
}
