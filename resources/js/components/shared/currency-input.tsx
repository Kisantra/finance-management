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
    /**
     * Digit desimal yang boleh diketik (bawaan 0 = Rupiah bulat). Untuk nominal valas, mis. USD `decimals={2}`
     * ("44.116,50") atau tarif per unit `decimals={4}` ("0,8250"). Koma = desimal, titik = ribuan.
     */
    decimals?: number;
    disabled?: boolean;
    className?: string;
    id?: string;
}

/** Nilai → teks isian format Indonesia; pecahan minimal dua desimal seperti uang ("21.670,80", "0,825"); 0/kosong = "". */
function formatValue(value: number | null | undefined, decimals: number): string {
    if (value == null || value <= 0) {
        return '';
    }

    const fractionDigits = decimals > 0 && !Number.isInteger(value) ? Math.min(2, decimals) : 0;

    return value.toLocaleString('id-ID', { minimumFractionDigits: fractionDigits, maximumFractionDigits: decimals });
}

/**
 * Teks yang sedang diketik → {tampilan, angka}. Titik diabaikan (pemisah ribuan); dengan `decimals` > 0 koma
 * pertama = desimal dan dipertahankan selama mengetik ("44.116," tetap tampil) agar sen bisa diketik.
 */
function parseTyped(raw: string, decimals: number): { display: string; numeric: number } {
    if (decimals === 0) {
        const numeric = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
        return { display: numeric > 0 ? numeric.toLocaleString('id-ID') : '', numeric };
    }

    const [whole, ...rest] = raw.replace(/[^0-9,]/g, '').split(',');
    const hasComma = rest.length > 0;
    const fraction = rest.join('').slice(0, decimals);
    const integer = parseInt(whole, 10) || 0;
    const numeric = parseFloat(`${integer}.${fraction || '0'}`) || 0;
    const display = whole === '' && !hasComma ? '' : `${integer.toLocaleString('id-ID')}${hasComma ? `,${fraction}` : ''}`;
    return { display, numeric };
}

export function CurrencyInput({
    value,
    onChange,
    label,
    hint,
    error,
    placeholder = '0',
    prefix = 'Rp',
    decimals = 0,
    disabled,
    className,
    id,
}: CurrencyInputProps) {
    const inputId = id ?? React.useId();

    const [displayValue, setDisplayValue] = React.useState<string>(() => formatValue(value, decimals));

    // Nilai dari luar yang berbeda dengan yang sedang diketik menggantikan tampilan; ketikan setengah jadi
    // ("44.116,") dibiarkan selama angkanya sama.
    React.useEffect(() => {
        setDisplayValue((current) => (parseTyped(current, decimals).numeric === (value ?? 0) ? current : formatValue(value, decimals)));
    }, [value, decimals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { display, numeric } = parseTyped(e.target.value, decimals);

        setDisplayValue(display);
        onChange?.(numeric);
    };

    const handleBlur = () => {
        setDisplayValue(formatValue(parseTyped(displayValue, decimals).numeric, decimals));
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
                    inputMode={decimals > 0 ? 'decimal' : 'numeric'}
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
