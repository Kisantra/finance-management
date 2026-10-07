import { Search } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatCurrency } from '@/lib/utils';

/*
 * Sel tabel item gaya lama, dipakai editor template Invoice Berulang.
 * Editor invoice (gaya Obsidian) memakai komponennya sendiri di pages/invoices/create.tsx.
 */

export interface ServiceOption {
    id: number;
    name: string;
    price: number;
    type: string;
}

/* ─────────────────────────────────── shared cell style ─── */

const cellCls = 'h-8 text-xs px-2 rounded-md border-transparent hover:border-secondary-300 dark:hover:border-dark-600 bg-transparent dark:bg-transparent focus:bg-white dark:focus:bg-dark-800';

/** Parse quantity string — supports both dot and comma as decimal separator, dot-as-thousands ignored.
 *  "5.000,25" → 5000.25 | "5000.25" → 5000.25 | "1,5" → 1.5 | "3" → 3 */
export function parseQty(raw: string): number {
    if (!raw) return 0;
    const s = raw.trim();
    // Format ribuan dengan koma desimal: ada koma → koma = desimal, titik = ribuan
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    // Tidak ada koma: titik = desimal biasa
    return parseFloat(s) || 0;
}

/* ─────────────────────────────────── column resize hook ─── */

export interface ColDef {
    key: string;
    defaultWidth: number;
    minWidth?: number;
}

export function useColumnResize(cols: ColDef[], storageKey: string) {
    const [widths, setWidths] = React.useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved) as Record<string, number>;
                // merge saved with defaults so new columns always have a value
                return cols.reduce<Record<string, number>>((acc, col) => {
                    acc[col.key] = parsed[col.key] ?? col.defaultWidth;
                    return acc;
                }, {});
            }
        } catch { /* ignore */ }
        return cols.reduce<Record<string, number>>((acc, col) => {
            acc[col.key] = col.defaultWidth;
            return acc;
        }, {});
    });

    const resizing = React.useRef<{ key: string; startX: number; startW: number } | null>(null);

    const onMouseDown = React.useCallback((key: string, e: React.MouseEvent) => {
        e.preventDefault();
        const currentW = widths[key] ?? cols.find((c) => c.key === key)?.defaultWidth ?? 80;
        resizing.current = { key, startX: e.clientX, startW: currentW };

        const onMove = (ev: MouseEvent) => {
            if (!resizing.current) return;
            const { key: k, startX, startW } = resizing.current;
            const minW = cols.find((c) => c.key === k)?.minWidth ?? 40;
            const next = Math.max(minW, startW + ev.clientX - startX);
            setWidths((prev) => ({ ...prev, [k]: next }));
        };

        const onUp = () => {
            resizing.current = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            setWidths((prev) => {
                try { localStorage.setItem(storageKey, JSON.stringify(prev)); } catch { /* ignore */ }
                return prev;
            });
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [widths, cols, storageKey]);

    const resetWidths = React.useCallback(() => {
        const defaults = cols.reduce<Record<string, number>>((acc, col) => {
            acc[col.key] = col.defaultWidth;
            return acc;
        }, {});
        setWidths(defaults);
        try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }, [cols, storageKey]);

    return { widths, onMouseDown, resetWidths };
}

/* ─────────────────────────────────── resizable th ─── */

export function ResizableTh({
    children,
    width,
    onResizeStart,
    className,
    title,
}: {
    children?: React.ReactNode;
    width: number;
    onResizeStart: (e: React.MouseEvent) => void;
    className?: string;
    title?: string;
}) {
    return (
        <th
            style={{ width, minWidth: width }}
            className={cn('relative select-none', className)}
            title={title}
        >
            {children}
            <div
                onMouseDown={onResizeStart}
                className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center group/handle z-10"
            >
                <div className="w-px h-3/5 bg-secondary-300 dark:bg-dark-500 group-hover/handle:bg-primary-400 dark:group-hover/handle:bg-primary-500 group-hover/handle:w-0.5 transition-all" />
            </div>
        </th>
    );
}

/* ─────────────────────────────────── currency cell ─── */

export function CurrencyCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [display, setDisplay] = React.useState(() =>
        value > 0 ? value.toLocaleString('id-ID') : '',
    );

    React.useEffect(() => {
        setDisplay(value > 0 ? value.toLocaleString('id-ID') : '');
    }, [value]);

    return (
        <Input
            inputMode="numeric"
            value={display}
            onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                const n = parseInt(raw, 10) || 0;
                setDisplay(n > 0 ? n.toLocaleString('id-ID') : '');
                onChange(n);
            }}
            onBlur={() => {
                setDisplay(value > 0 ? value.toLocaleString('id-ID') : '');
            }}
            placeholder="0"
            className={cn(cellCls, 'text-right')}
        />
    );
}

/* ─────────────────────────────────── service lookup ─── */

export function ServiceLookup({
    services,
    onSelect,
}: {
    services: ServiceOption[];
    onSelect: (svc: ServiceOption) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const filtered = search
        ? services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
        : services;

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-dark-400 hover:text-primary-600 dark:hover:text-primary-400"
                    title="Pilih dari katalog layanan"
                >
                    <Search className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0 overflow-hidden" align="start">
                <div className="px-2 pt-2 pb-1.5 border-b border-secondary-100 dark:border-dark-600">
                    <Input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari layanan..."
                        icon={<Search className="h-3.5 w-3.5" />}
                        className="h-8 text-xs focus:ring-0"
                    />
                </div>
                <div className="max-h-52 overflow-y-auto p-1.5">
                    {filtered.length === 0 ? (
                        <p className="py-6 text-center text-sm text-dark-400 dark:text-dark-500">
                            Layanan tidak ditemukan
                        </p>
                    ) : (
                        filtered.map((svc) => (
                            <button
                                key={svc.id}
                                type="button"
                                onClick={() => { onSelect(svc); setOpen(false); setSearch(''); }}
                                className="w-full text-left px-2.5 py-2 rounded-lg transition-colors hover:bg-zinc-50 dark:hover:bg-dark-600"
                            >
                                <div className="text-sm font-medium text-dark-700 dark:text-dark-300 truncate">{svc.name}</div>
                                <div className="text-xs text-dark-400 dark:text-dark-500">{formatCurrency(svc.price)}</div>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
