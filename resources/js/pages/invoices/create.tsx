import { Head, router, useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    ChevronDown,
    FileText,
    Info,
    List,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import * as React from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/shared/currency-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, toastErrors, toLocalIso } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface ClientOption {
    id: number;
    name: string;
    email: string | null;
}

interface ServiceOption {
    id: number;
    name: string;
    price: number;
    type: string;
}

interface InvoiceItem {
    client_id: number | null;
    service_name: string;
    quantity: string;
    unit: string;
    unit_price: number;
    cogs_amount: number;
    is_tax_deposit: boolean;
}

interface Props extends SharedProps {
    clients: ClientOption[];
    services: ServiceOption[];
    nextSeq: number;
    companyInitials: string;
}

/* ─────────────────────────────────── constants ─── */

const ROMAN_MONTHS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const COMMON_UNITS = [
    'jam', 'hari', 'minggu', 'bulan', 'tahun',
    'project', 'paket', 'set', 'lot', 'kali',
    'pcs', 'unit', 'lembar', 'kg', 'ton', 'm²', 'm³',
];

/* ─────────────────────────────────── helpers ─── */

function getRomanMonth(month: number) {
    return ROMAN_MONTHS[month] ?? 'I';
}

function previewInvoiceNumber(seq: number, company: string, clientName: string, date: string) {
    if (!date) return `${String(seq).padStart(3, '0')}/INV/${company}-???/???/????`;
    const d = new Date(date);
    const clientInitials = clientName
        .split(/\s+/)
        .filter((w) => !['pt', 'cv', 'ud', 'tb'].includes(w.toLowerCase()))
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || 'XXX';
    return `${String(seq).padStart(3, '0')}/INV/${company}-${clientInitials}/${getRomanMonth(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function emptyItem(defaultClientId: number | null = null): InvoiceItem {
    return {
        client_id: defaultClientId,
        service_name: '',
        quantity: '1',
        unit: '',
        unit_price: 0,
        cogs_amount: 0,
        is_tax_deposit: false,
    };
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

/* ─────────────────────────────────── form component ─── */

interface InvoiceFormProps {
    clients: ClientOption[];
    services: ServiceOption[];
    nextSeq: number;
    companyInitials: string;
    existingInvoiceNumber?: string;
    initialData?: {
        client_id: number | null;
        issue_date: string;
        due_date: string;
        discount_type: string;
        discount_value: number;
        discount_reason: string;
        items: InvoiceItem[];
    };
    submitUrl: string;
    method: 'post' | 'put';
    submitLabel: string;
    isEdit?: boolean;
}

export function InvoiceForm({
    clients,
    services,
    nextSeq,
    companyInitials,
    existingInvoiceNumber,
    initialData,
    submitUrl,
    method,
    submitLabel,
    isEdit = false,
}: InvoiceFormProps) {
    const COL_DEFS: ColDef[] = [
        { key: 'no',       defaultWidth: 32,  minWidth: 32  },
        { key: 'client',   defaultWidth: 140, minWidth: 60  },
        { key: 'service',  defaultWidth: 220, minWidth: 80  },
        { key: 'qty',      defaultWidth: 64,  minWidth: 48  },
        { key: 'unit',     defaultWidth: 80,  minWidth: 48  },
        { key: 'price',    defaultWidth: 112, minWidth: 64  },
        { key: 'hpp',      defaultWidth: 112, minWidth: 64  },
        { key: 'pph',      defaultWidth: 80,  minWidth: 64  },
        { key: 'subtotal', defaultWidth: 112, minWidth: 64  },
        { key: 'del',      defaultWidth: 36,  minWidth: 36  },
    ];

    const { widths, onMouseDown, resetWidths } = useColumnResize(COL_DEFS, 'invoice-items-col-widths');

    const { data, setData, post, put, transform, processing, errors } = useForm({
        client_id: initialData?.client_id ?? null as number | null,
        issue_date: initialData?.issue_date ?? toLocalIso(new Date()),
        due_date: initialData?.due_date ?? '',
        items: (initialData?.items ?? [emptyItem()]) as InvoiceItem[],
        discount_type: initialData?.discount_type ?? 'fixed',
        discount_value: initialData?.discount_value ?? 0,
        discount_reason: initialData?.discount_reason ?? '',
    });

    const selectedClient = clients.find((c) => c.id === data.client_id);
    const invoicePreview = previewInvoiceNumber(
        nextSeq,
        companyInitials,
        selectedClient?.name ?? '',
        data.issue_date,
    );

    /* Saat klien invoice berubah, isi otomatis item yang kliennya masih kosong */
    const handleClientChange = (v: string | number | null) => {
        const newClientId = v ? Number(v) : null;
        setData((prev) => ({
            ...prev,
            client_id: newClientId,
            items: prev.items.map((item) =>
                item.client_id === null ? { ...item, client_id: newClientId } : item,
            ),
        }));
    };

    /* ── calculations ── */
    const itemTotals = data.items.map((item) => {
        const qty = parseQty(item.quantity);
        return Math.round(item.unit_price * qty);
    });
    const subtotal = itemTotals.reduce((a, b) => a + b, 0);
    const discountAmount =
        data.discount_type === 'percentage'
            ? Math.round((subtotal * (data.discount_value || 0)) / 100)
            : data.discount_value || 0;
    const totalAmount = Math.max(0, subtotal - discountAmount);
    const totalCogs = data.items
        .filter((i) => !i.is_tax_deposit)
        .reduce((s, i) => s + (i.cogs_amount || 0), 0);
    const totalTaxDeposits = data.items.reduce((s, item, idx) =>
        s + (item.is_tax_deposit ? itemTotals[idx] : 0), 0);
    const grossProfit = totalAmount - totalTaxDeposits - totalCogs;
    const pph05 = Math.round((totalAmount - totalTaxDeposits) * 0.005);

    /* ── item handlers ── */
    const addItem = () =>
        setData('items', [...data.items, emptyItem(data.client_id)]);

    const removeItem = (idx: number) =>
        setData('items', data.items.filter((_, i) => i !== idx));

    const updateItem = (idx: number, field: keyof InvoiceItem, value: unknown) =>
        setData('items', data.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

    const updateItemFields = (idx: number, updates: Partial<InvoiceItem>) =>
        setData('items', data.items.map((item, i) => (i === idx ? { ...item, ...updates } : item)));

    const handleServiceNameChange = (idx: number, name: string) => {
        const matched = services.find((s) => s.name === name);
        updateItemFields(idx, {
            service_name: name,
            ...(matched ? { unit_price: matched.price } : {}),
        });
    };

    /* ── submit ── */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Normalize quantity strings (e.g. "5.000,25" → "5000.25") before sending to backend
        transform((d) => ({
            ...d,
            items: d.items.map((item) => ({ ...item, quantity: String(parseQty(item.quantity)) })),
        }));
        const options = {
            onSuccess: () => toast.success(isEdit ? 'Invoice berhasil diperbarui.' : 'Invoice berhasil dibuat.'),
            onError: (errs) => toastErrors(errs, isEdit ? 'UpdateInvoice' : 'CreateInvoice'),
        };
        if (method === 'put') put(submitUrl, options);
        else post(submitUrl, options);
    };

    /* ── client options ── */
    const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));

    const [discountOpen, setDiscountOpen] = React.useState(false);

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

                {/* ── LEFT COLUMN (4/5) ── */}
                <div className="xl:col-span-3 space-y-6">

                    {/* Card 1: Detail Invoice */}
                    <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-secondary-200 dark:border-dark-600 flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Detail Invoice</h2>
                                <p className="text-xs text-dark-500 dark:text-dark-400">Informasi dasar invoice</p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 space-y-5">
                            {/* Invoice number preview */}
                            <div className="flex items-center gap-3 p-4 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20">
                                <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
                                <div>
                                    <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                                        {isEdit ? 'Nomor Invoice' : 'Preview Nomor Invoice (otomatis saat dikirim)'}
                                    </p>
                                    <p className="font-mono text-sm font-semibold text-primary-700 dark:text-primary-300">
                                        {isEdit ? (existingInvoiceNumber ?? '—') : invoicePreview}
                                    </p>
                                </div>
                            </div>

                            {/* Client + Dates */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <Combobox
                                    options={clientOptions}
                                    value={data.client_id}
                                    onChange={handleClientChange}
                                    placeholder="Pilih klien..."
                                    label="Klien *"
                                    hint={selectedClient?.email ?? undefined}
                                    error={errors.client_id}
                                />
                                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                                    <DatePicker
                                        label="Tgl Invoice *"
                                        value={data.issue_date ? new Date(data.issue_date + 'T00:00:00') : null}
                                        onChange={(d) => setData('issue_date', d ? format(d, 'yyyy-MM-dd') : '')}
                                        error={errors.issue_date}
                                    />
                                    <DatePicker
                                        label="Jatuh Tempo *"
                                        value={data.due_date ? new Date(data.due_date + 'T00:00:00') : null}
                                        onChange={(d) => setData('due_date', d ? format(d, 'yyyy-MM-dd') : '')}
                                        minDate={data.issue_date ? new Date(data.issue_date + 'T00:00:00') : undefined}
                                        error={errors.due_date}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Invoice Items */}
                    <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-secondary-200 dark:border-dark-600 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center shrink-0">
                                    <List className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Item Invoice</h2>
                                    <p className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                                        <Info className="w-3 h-3 shrink-0" />
                                        <span className="hidden sm:inline">Tiap item bisa ditujukan ke klien berbeda</span>
                                        <span className="sm:hidden">Klien per item bisa berbeda</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={resetWidths}
                                    className="hidden sm:block text-xs text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
                                    title="Reset lebar kolom ke default"
                                >
                                    Reset Ukuran Kolom
                                </button>
                                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Item
                                </Button>
                            </div>
                        </div>

                        {errors.items && (
                            <p className="px-4 sm:px-6 pt-3 text-xs text-red-600 dark:text-red-400">{errors.items}</p>
                        )}

                        <div className="overflow-x-auto">
                            <table className="table-fixed text-xs w-full" style={{ minWidth: Object.values(widths).reduce((a, b) => a + b, 0) }}>
                                <thead>
                                    <tr className="bg-secondary-50 dark:bg-dark-800 border-b border-secondary-200 dark:border-dark-600">
                                        <ResizableTh width={widths.no} onResizeStart={(e) => onMouseDown('no', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-400 dark:text-dark-500 text-left">#</ResizableTh>
                                        <ResizableTh width={widths.client} onResizeStart={(e) => onMouseDown('client', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">Klien</ResizableTh>
                                        <ResizableTh width={widths.service} onResizeStart={(e) => onMouseDown('service', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">Nama Layanan</ResizableTh>
                                        <ResizableTh width={widths.qty} onResizeStart={(e) => onMouseDown('qty', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">
                                            <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="inline-flex items-center gap-1 cursor-default">
                                                            Qty
                                                            <Info className="w-3 h-3 text-primary-400 dark:text-primary-500" />
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-48 text-center leading-relaxed">
                                                        Gunakan titik atau koma sebagai pemisah desimal.<br />
                                                        Contoh: <span className="font-mono">1.5</span>, <span className="font-mono">5.000,25</span>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </ResizableTh>
                                        <ResizableTh width={widths.unit} onResizeStart={(e) => onMouseDown('unit', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">Satuan</ResizableTh>
                                        <ResizableTh width={widths.price} onResizeStart={(e) => onMouseDown('price', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">Harga Sat.</ResizableTh>
                                        <ResizableTh width={widths.hpp} onResizeStart={(e) => onMouseDown('hpp', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">HPP</ResizableTh>
                                        <ResizableTh width={widths.pph} onResizeStart={(e) => onMouseDown('pph', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left" title="Titipan Pajak Klien">Titipan</ResizableTh>
                                        <ResizableTh width={widths.subtotal} onResizeStart={(e) => onMouseDown('subtotal', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">Subtotal</ResizableTh>
                                        <th style={{ width: widths.del, minWidth: widths.del }} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-200 dark:divide-dark-600">
                                    {data.items.map((item, idx) => (
                                        <tr
                                            key={idx}
                                            className={cn(
                                                'hover:bg-secondary-50/50 dark:hover:bg-dark-800/30 transition-colors group',
                                                item.is_tax_deposit && 'bg-amber-50/40 dark:bg-amber-900/5',
                                            )}
                                        >
                                            {/* # */}
                                            <td className="px-1 py-1.5 text-center overflow-hidden">
                                                <span className="font-mono text-dark-400 dark:text-dark-500">{idx + 1}</span>
                                            </td>

                                            {/* Klien */}
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <Combobox
                                                    options={clientOptions}
                                                    value={item.client_id}
                                                    onChange={(v) => updateItem(idx, 'client_id', v ? Number(v) : null)}
                                                    placeholder="Pilih klien..."
                                                    clearable
                                                    popoverWidth="w-56"
                                                    className="w-full [&_button]:h-8 [&_button]:text-xs [&_button]:px-2 [&_button]:rounded-md [&_button]:ring-0 [&_button]:shadow-none"
                                                />
                                            </td>

                                            {/* Nama Layanan */}
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <div className="flex items-center gap-0.5">
                                                    <div className="flex-1 min-w-0">
                                                        <Input
                                                            value={item.service_name}
                                                            onChange={(e) => handleServiceNameChange(idx, e.target.value)}
                                                            placeholder="Nama layanan..."
                                                            error={errors[`items.${idx}.service_name` as keyof typeof errors]}
                                                            className={cellCls}
                                                        />
                                                    </div>
                                                    <ServiceLookup
                                                        services={services}
                                                        onSelect={(svc) => updateItemFields(idx, { service_name: svc.name, unit_price: svc.price })}
                                                    />
                                                </div>
                                            </td>

                                            {/* Qty */}
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                    placeholder="1"
                                                    className={cellCls}
                                                />
                                            </td>

                                            {/* Satuan */}
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <Input
                                                    list={`unit-list-${idx}`}
                                                    value={item.unit}
                                                    onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                                    placeholder="satuan"
                                                    className={cellCls}
                                                />
                                                <datalist id={`unit-list-${idx}`}>
                                                    {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
                                                </datalist>
                                            </td>

                                            {/* Harga Sat. */}
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <CurrencyCell value={item.unit_price} onChange={(v) => updateItem(idx, 'unit_price', v)} />
                                            </td>

                                            {/* HPP */}
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <CurrencyCell value={item.cogs_amount} onChange={(v) => updateItem(idx, 'cogs_amount', v)} />
                                            </td>

                                            {/* PPh */}
                                            <td className="px-1 py-1.5 text-center overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => updateItem(idx, 'is_tax_deposit', !item.is_tax_deposit)}
                                                    title={item.is_tax_deposit ? 'Titipan pajak: aktif' : 'Titipan pajak: nonaktif'}
                                                    className={cn(
                                                        'h-5 w-5 rounded inline-flex items-center justify-center border text-xs font-bold transition-colors',
                                                        item.is_tax_deposit
                                                            ? 'bg-amber-500 border-amber-500 text-white'
                                                            : 'border-secondary-300 dark:border-dark-600 text-transparent hover:border-amber-400',
                                                    )}
                                                >
                                                    ✓
                                                </button>
                                            </td>

                                            {/* Subtotal */}
                                            <td className="px-2 py-1.5 text-right overflow-hidden">
                                                <span className="font-semibold text-dark-900 dark:text-dark-50 tabular-nums truncate block">
                                                    {formatCurrency(itemTotals[idx])}
                                                </span>
                                            </td>

                                            {/* Hapus */}
                                            <td className="px-1 py-1.5 text-center overflow-hidden">
                                                {data.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(idx)}
                                                        className="h-6 w-6 rounded inline-flex items-center justify-center text-dark-400 dark:text-dark-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-secondary-50/60 dark:bg-dark-800/60 border-t border-secondary-200 dark:border-dark-600">
                                        <td colSpan={8} className="px-3 py-2 text-xs text-dark-500 dark:text-dark-400 overflow-hidden">
                                            <span className="font-medium text-dark-700 dark:text-dark-300">{data.items.length} item</span>
                                            <span className="mx-1">·</span>
                                            <span>HPP total:</span>
                                            <span className="font-medium text-dark-700 dark:text-dark-300 ml-1">{formatCurrency(totalCogs)}</span>
                                        </td>
                                        <td className="px-2 py-2 text-xs font-bold text-dark-900 dark:text-dark-50 text-right overflow-hidden">
                                            <span className="tabular-nums truncate block">{formatCurrency(subtotal)}</span>
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                </div>
            </div>

                {/* ── RIGHT COLUMN — sticky summary (1/5) ── */}
                <div className="xl:col-span-1 xl:self-start xl:sticky xl:top-6">
                    <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">

                        {/* Summary rows */}
                        <div className="divide-y divide-secondary-100 dark:divide-dark-600">
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-xs text-dark-500 dark:text-dark-400">Subtotal</span>
                                <span className="text-xs font-semibold text-dark-900 dark:text-dark-50 tabular-nums">{formatCurrency(subtotal)}</span>
                            </div>

                            {totalTaxDeposits > 0 && (
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="text-xs text-dark-500 dark:text-dark-400">Titipan Pajak</span>
                                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(totalTaxDeposits)}</span>
                                </div>
                            )}

                            {discountAmount > 0 && (
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="text-xs text-dark-500 dark:text-dark-400">
                                        Diskon{data.discount_type === 'percentage' && data.discount_value > 0 ? ` (${data.discount_value}%)` : ''}
                                    </span>
                                    <span className="text-xs font-semibold text-red-500 tabular-nums">− {formatCurrency(discountAmount)}</span>
                                </div>
                            )}

                            <div className="px-4 py-4 bg-secondary-50 dark:bg-dark-900/40">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-semibold text-dark-600 dark:text-dark-400 uppercase tracking-wide">Total</span>
                                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400 tabular-nums">{formatCurrency(totalAmount)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 divide-x divide-secondary-100 dark:divide-dark-600">
                                <div className="px-4 py-3">
                                    <p className="text-[10px] text-dark-400 dark:text-dark-500 mb-0.5">Laba Kotor</p>
                                    <p className={cn('text-xs font-bold tabular-nums', grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                                        {formatCurrency(grossProfit)}
                                    </p>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[10px] text-dark-400 dark:text-dark-500 mb-0.5">Est. PPh 0.5%</p>
                                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 tabular-nums">{formatCurrency(pph05)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Discount accordion */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setDiscountOpen(!discountOpen)}
                                className="w-full flex items-center justify-between px-4 py-3 border-t border-secondary-200 dark:border-dark-600 text-xs text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 hover:bg-secondary-50 dark:hover:bg-dark-700/40 transition-colors"
                            >
                                <span className="font-medium">Diskon</span>
                                <div className="flex items-center gap-1.5">
                                    {discountAmount > 0 && (
                                        <span className="text-[10px] font-semibold text-red-500">− {formatCurrency(discountAmount)}</span>
                                    )}
                                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', discountOpen && 'rotate-180')} />
                                </div>
                            </button>
                            {discountOpen && (
                                <div className="border-t border-secondary-100 dark:border-dark-700 px-4 pb-4 pt-3 space-y-2">
                                    <div className="flex gap-2">
                                        {(['fixed', 'percentage'] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setData('discount_type', type)}
                                                className={cn(
                                                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                                                    data.discount_type === type
                                                        ? 'bg-primary-600 text-white border-primary-600'
                                                        : 'bg-white dark:bg-dark-800 text-dark-600 dark:text-dark-400 border-secondary-200 dark:border-dark-600 hover:bg-secondary-50 dark:hover:bg-dark-700',
                                                )}
                                            >
                                                {type === 'fixed' ? 'Nominal' : '%'}
                                            </button>
                                        ))}
                                    </div>
                                    {data.discount_type === 'fixed' ? (
                                        <CurrencyInput
                                            value={data.discount_value}
                                            onChange={(v) => setData('discount_value', v)}
                                            placeholder="0"
                                        />
                                    ) : (
                                        <div className="relative">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={data.discount_value === 0 ? '' : String(data.discount_value)}
                                                onChange={(e) => setData('discount_value', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                                placeholder="0"
                                                className="pr-8"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-dark-500 dark:text-dark-400">%</span>
                                        </div>
                                    )}
                                    <Input
                                        value={data.discount_reason}
                                        onChange={(e) => setData('discount_reason', e.target.value)}
                                        placeholder="Alasan diskon (opsional)..."
                                    />
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="p-4 border-t border-secondary-200 dark:border-dark-600 space-y-2">
                            <Button
                                type="submit"
                                variant="primary"
                                loading={processing}
                                disabled={data.items.length === 0}
                                className="w-full"
                            >
                                {submitLabel}
                            </Button>
                            <Button
                                type="button"
                                variant="zinc"
                                onClick={() => router.get(companyUrl('/invoices'))}
                                className="w-full"
                            >
                                Batal
                            </Button>
                            {data.items.length === 0 && (
                                <p className="text-center text-[10px] text-dark-400 dark:text-dark-500">
                                    Tambah item untuk mengaktifkan simpan
                                </p>
                            )}
                        </div>
                    </div>
                </div>

            </div>{/* end xl:grid-cols-3 */}
        </form>
    );
}

/* ─────────────────────────────────── page ─── */

function CreateInvoicePage({ clients, services, nextSeq, companyInitials }: Props) {
    return (
        <>
            <Head title="Buat Invoice" />
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.get(companyUrl('/invoices'))}
                            className="h-9 w-9 rounded-xl flex items-center justify-center border border-secondary-200 dark:border-dark-600 hover:bg-zinc-100 dark:hover:bg-dark-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-dark-600 dark:text-dark-400" />
                        </button>
                        <div>
                            <h1 className="text-2xl sm:text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                                Buat Invoice
                            </h1>
                            <p className="text-gray-600 dark:text-zinc-400 text-sm sm:text-lg">
                                Invoice baru akan disimpan sebagai draft
                            </p>
                        </div>
                    </div>
                </div>

                <InvoiceForm
                    clients={clients}
                    services={services}
                    nextSeq={nextSeq}
                    companyInitials={companyInitials}
                    submitUrl={companyUrl('/invoices')}
                    method="post"
                    submitLabel="Simpan sebagai Draft"
                />
            </div>
        </>
    );
}

CreateInvoicePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default CreateInvoicePage;
