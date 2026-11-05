import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ColorInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    error?: string;
    className?: string;
}

/**
 * ColorInput — swatch + hex text field bergaya Obsidian (field ob-inner bertepi ob-line).
 * Sengaja ringkas (h-8, teks 12 px) karena dipakai di panel properti editor template yang padat.
 */
function ColorInput({ value, onChange, label, error, className }: ColorInputProps) {
    const id = React.useId();

    // Keep local text state so user can type partial hex without losing focus
    const [text, setText] = React.useState(value.toUpperCase());

    // Sync when external value changes (e.g. undo/redo)
    React.useEffect(() => {
        setText(value.toUpperCase());
    }, [value]);

    const commitText = (raw: string) => {
        const cleaned = raw.trim();
        // Accept 3-char (#abc) or 6-char (#rrggbb) hex
        if (/^#[0-9a-fA-F]{6}$/.test(cleaned) || /^#[0-9a-fA-F]{3}$/.test(cleaned)) {
            onChange(cleaned.toLowerCase());
            setText(cleaned.toUpperCase());
        } else {
            // Revert invalid input
            setText(value.toUpperCase());
        }
    };

    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ob-ink-2">
                    {label}
                </label>
            )}
            <div
                className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-xl border bg-ob-inner px-1.5',
                    'transition-colors duration-150 ease-out motion-reduce:transition-none',
                    error ? 'border-ob-late' : 'border-ob-line',
                    'focus-within:ring-2 focus-within:ring-ob-act-fill focus-within:ring-offset-2 focus-within:ring-offset-ob-page',
                )}
            >
                {/* Native color picker — hidden chrome, shows as swatch */}
                <input
                    type="color"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setText(e.target.value.toUpperCase());
                    }}
                    className={cn(
                        'h-5 w-5 shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0',
                        '[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-ob-line-strong',
                        '[&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-ob-line-strong',
                    )}
                    tabIndex={-1}
                    aria-hidden
                />
                {/* Hex text field — border/padding/ring plugin forms dinetralkan; cincin fokus ada di wadah. */}
                <input
                    id={id}
                    type="text"
                    value={text}
                    maxLength={7}
                    onChange={(e) => setText(e.target.value.toUpperCase())}
                    onBlur={(e) => commitText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitText((e.target as HTMLInputElement).value);
                    }}
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs uppercase tabular-nums text-ob-ink outline-none placeholder:text-ob-ink-3 focus:outline-none focus:ring-0"
                    placeholder="#000000"
                    spellCheck={false}
                />
            </div>
            {error && <p className="mt-1 text-xs text-ob-late">{error}</p>}
        </div>
    );
}

ColorInput.displayName = 'ColorInput';

export { ColorInput };
