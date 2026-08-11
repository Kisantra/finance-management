import { Head, Link, useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    ChevronDown,
    FileText,
    Info,
    List,
    Plus,
    Trash2,
} from 'lucide-react';
import * as React from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/shared/currency-input';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, toastErrors } from '@/lib/utils';
import { CurrencyCell, ServiceLookup, ColDef, useColumnResize, ResizableTh, parseQty } from '@/pages/invoices/create';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface ClientOption { id: number; name: string; display_name: string; email: string }
interface ServiceOption { id: number; name: string; price: number; type: string }

interface TemplateItem {
    client_id: number | null;
    service_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cogs_amount: number;
    is_tax_deposit: boolean;
}

interface Props extends SharedProps {
    clients: ClientOption[];
    services: ServiceOption[];
}

interface EditProps extends SharedProps {
    template: {
        id: number;
        template_name: string;
        client_id: number;
        start_date: string;
        end_date: string;
        frequency: string;
        invoice_template: {
            items: TemplateItem[];
            discount_type: 'fixed' | 'percentage';
            discount_value: number;
            discount_reason: string;
        };
    };
    clients: ClientOption[];
    services: ServiceOption[];
}

/* ─────────────────────────────────── constants ─── */

const FREQUENCY_OPTIONS = [
    { value: 'monthly', label: 'Bulanan' },
    { value: 'quarterly', label: 'Triwulanan (3 bln)' },
    { value: 'semi_annual', label: 'Semesteran (6 bln)' },
    { value: 'annual', label: 'Tahunan' },
];

const COMMON_UNITS = [
    'jam', 'hari', 'minggu', 'bulan', 'tahun',
    'project', 'paket', 'set', 'lot', 'kali',
    'pcs', 'unit', 'lembar', 'kg', 'ton', 'm²', 'm³',
];

/* ─────────────────────────────────── shared cell style ─── */

const cellCls = 'h-8 text-xs px-2 rounded-md border-transparent hover:border-secondary-300 dark:hover:border-dark-600 bg-transparent dark:bg-transparent focus:bg-white dark:focus:bg-dark-800';

function emptyItem(defaultClientId: number | null = null): TemplateItem {
    return { client_id: defaultClientId, service_name: '', quantity: 1, unit: '', unit_price: 0, cogs_amount: 0, is_tax_deposit: false };
}

/* ─────────────────────────────────── template form ─── */

interface TemplateFormProps {
    clients: ClientOption[];
    services: ServiceOption[];
    submitUrl: string;
    method: 'post' | 'put';
    submitLabel: string;
    isEdit?: boolean;
    initialData?: {
        template_name: string;
        client_id: number | null;
        start_date: string;
        end_date: string;
        frequency: string;
        items: TemplateItem[];
        discount_type: 'fixed' | 'percentage';
        discount_value: number;
        discount_reason: string;
    };
}

export function TemplateForm({
    clients,
    services,
    submitUrl,
    method,
    submitLabel,
    isEdit = false,
    initialData,
}: TemplateFormProps) {
    const { data, setData, post, put, transform, processing, errors } = useForm({
        template_name: initialData?.template_name ?? '',
        client_id: initialData?.client_id ?? null as number | null,
        start_date: initialData?.start_date ?? '',
        end_date: initialData?.end_date ?? '',
        frequency: initialData?.frequency ?? 'monthly',
        items: (initialData?.items ?? [emptyItem()]) as TemplateItem[],
        discount_type: initialData?.discount_type ?? 'fixed' as 'fixed' | 'percentage',
        discount_value: initialData?.discount_value ?? 0,
        discount_reason: initialData?.discount_reason ?? '',
    });

    const [discountOpen, setDiscountOpen] = React.useState(false);

    /* ── column resize ── */
    const COL_DEFS: ColDef[] = [
        { key: 'no',       defaultWidth: 32,  minWidth: 32  },
        { key: 'client',   defaultWidth: 140, minWidth: 60  },
        { key: 'service',  defaultWidth: 220, minWidth: 80  },
        { key: 'qty',      defaultWidth: 64,  minWidth: 48  },
        { key: 'unit',     defaultWidth: 80,  minWidth: 48  },
        { key: 'price',    defaultWidth: 112, minWidth: 64  },
        { key: 'hpp',      defaultWidth: 112, minWidth: 64  },
        { key: 'pph',      defaultWidth: 40,  minWidth: 40  },
        { key: 'subtotal', defaultWidth: 112, minWidth: 64  },
        { key: 'del',      defaultWidth: 36,  minWidth: 36  },
    ];
    const { widths, onMouseDown, resetWidths } = useColumnResize(COL_DEFS, 'template-items-col-widths');

    /* ── calculations ── */
    const itemTotals = data.items.map((item) => Math.round(item.unit_price * parseQty(String(item.quantity))));
    const subtotal = data.items.filter((i) => !i.is_tax_deposit).reduce((s, item, idx) => s + (item.is_tax_deposit ? 0 : itemTotals[idx]), 0);
    const totalTaxDeposits = data.items.reduce((s, item, idx) => s + (item.is_tax_deposit ? itemTotals[idx] : 0), 0);
    const discountAmount = data.discount_type === 'percentage'
        ? Math.round((subtotal * (data.discount_value || 0)) / 100)
        : data.discount_value || 0;
    const totalAmount = Math.max(0, subtotal - discountAmount) + totalTaxDeposits;
    const totalCogs = data.items.filter((i) => !i.is_tax_deposit).reduce((s, i) => s + (i.cogs_amount || 0), 0);
    const grossProfit = totalAmount - totalTaxDeposits - totalCogs;
    const pph05 = Math.round((totalAmount - totalTaxDeposits) * 0.005);

    /* ── item handlers ── */
    const addItem = () => setData('items', [...data.items, emptyItem(data.client_id)]);
    const removeItem = (idx: number) => setData('items', data.items.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: keyof TemplateItem, value: unknown) =>
        setData('items', data.items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    const updateItemFields = (idx: number, updates: Partial<TemplateItem>) =>
        setData('items', data.items.map((item, i) => i === idx ? { ...item, ...updates } : item));

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

    const handleServiceNameChange = (idx: number, name: string) => {
        const matched = services.find((s) => s.name === name);
        updateItemFields(idx, { service_name: name, ...(matched ? { unit_price: matched.price } : {}) });
    };

    /* ── submit ── */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            items: d.items.map((item) => ({ ...item, quantity: parseQty(String(item.quantity)) })),
        }));
        const options = {
            onSuccess: () => toast.success(isEdit ? 'Template berhasil diperbarui.' : 'Template berhasil dibuat.'),
            onError: (errs: Record<string, string>) => toastErrors(errs, isEdit ? 'UpdateTemplate' : 'CreateTemplate'),
        };
        if (method === 'put') put(submitUrl, options);
        else post(submitUrl, options);
    };

    const clientOptions = clients.map((c) => ({ value: c.id, label: c.display_name || c.name }));

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

                {/* ── LEFT COLUMN (3/4) ── */}
                <div className="xl:col-span-3 space-y-6">

                    {/* Card 1: Detail Template */}
                    <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-secondary-200 dark:border-dark-600 flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Detail Template</h2>
                                <p className="text-xs text-dark-500 dark:text-dark-400">Nama, klien, periode, dan frekuensi tagihan</p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 space-y-5">

                            {/* Row 1: Template Name + Client */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <Input
                                    label="Nama Template *"
                                    value={data.template_name}
                                    onChange={(e) => setData('template_name', e.target.value)}
                                    placeholder="Contoh: Monthly Retainer"
                                    error={errors.template_name}
                                />
                                <Combobox
                                    label="Klien *"
                                    options={clientOptions}
                                    value={data.client_id}
                                    onChange={handleClientChange}
                                    placeholder="Pilih klien..."
                                    error={errors.client_id}
                                />
                            </div>

                            {/* Row 2: Start + End Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <DatePicker
                                    label="Tanggal Mulai *"
                                    value={data.start_date ? new Date(data.start_date + 'T00:00:00') : null}
                                    onChange={(d) => setData('start_date', d ? format(d, 'yyyy-MM-dd') : '')}
                                    error={errors.start_date}
                                />
                                <DatePicker
                                    label="Tanggal Berakhir *"
                                    value={data.end_date ? new Date(data.end_date + 'T00:00:00') : null}
                                    onChange={(d) => setData('end_date', d ? format(d, 'yyyy-MM-dd') : '')}
                                    minDate={data.start_date ? new Date(data.start_date + 'T00:00:00') : undefined}
                                    error={errors.end_date}
                                />
                            </div>

                            {/* Frequency */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-dark-900 dark:text-dark-300">
                                    Frekuensi *
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {FREQUENCY_OPTIONS.map((f) => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() => setData('frequency', f.value)}
                                            className={cn(
                                                'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                                                data.frequency === f.value
                                                    ? 'bg-primary-600 border-primary-600 text-white'
                                                    : 'border-secondary-200 dark:border-dark-600 text-dark-700 dark:text-dark-300 hover:border-primary-400 dark:hover:border-primary-600',
                                            )}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                                {errors.frequency && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.frequency}</p>}
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
                                        <span className="hidden sm:inline">Item akan digunakan setiap kali invoice di-generate</span>
                                        <span className="sm:hidden">Item per generate</span>
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
                                        <ResizableTh width={widths.pph} onResizeStart={(e) => onMouseDown('pph', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left" title="Titipan Pajak (PPh)">PPh</ResizableTh>
                                        <ResizableTh width={widths.subtotal} onResizeStart={(e) => onMouseDown('subtotal', e)} className="px-2 py-2.5 text-xs font-semibold text-dark-600 dark:text-dark-400 text-left">Subtotal</ResizableTh>
                                        <th style={{ width: widths.del, minWidth: widths.del }} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-200 dark:divide-dark-600">
                                    {data.items.map((item, idx) => (
                                        <tr key={idx} className={cn('hover:bg-secondary-50/50 dark:hover:bg-dark-800/30 transition-colors group', item.is_tax_deposit && 'bg-amber-50/40 dark:bg-amber-900/5')}>
                                            <td className="px-1 py-1.5 text-center overflow-hidden">
                                                <span className="font-mono text-dark-400 dark:text-dark-500">{idx + 1}</span>
                                            </td>
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
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.quantity === 0 ? '' : String(item.quantity)}
                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                    placeholder="1"
                                                    className={cellCls}
                                                />
                                            </td>
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
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <CurrencyCell value={item.unit_price} onChange={(v) => updateItem(idx, 'unit_price', v)} />
                                            </td>
                                            <td className="px-1 py-1.5 overflow-hidden">
                                                <CurrencyCell value={item.cogs_amount} onChange={(v) => updateItem(idx, 'cogs_amount', v)} />
                                            </td>
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
                                                >✓</button>
                                            </td>
                                            <td className="px-2 py-1.5 text-right overflow-hidden">
                                                <span className="font-semibold text-dark-900 dark:text-dark-50 tabular-nums truncate block">
                                                    {formatCurrency(itemTotals[idx])}
                                                </span>
                                            </td>
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
                                            <span className="tabular-nums truncate block">{formatCurrency(subtotal + totalTaxDeposits)}</span>
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
                                        Diskon{data.discount_type === 'percentage' ? ` (${data.discount_value}%)` : ''}
                                    </span>
                                    <span className="text-xs font-semibold text-red-500 tabular-nums">− {formatCurrency(discountAmount)}</span>
                                </div>
                            )}

                            <div className="px-4 py-4 bg-secondary-50 dark:bg-dark-900/40">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-semibold text-dark-600 dark:text-dark-400 uppercase tracking-wide">Total</span>
                                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">{formatCurrency(totalAmount)}</span>
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
                                                type="number"
                                                value={data.discount_value}
                                                onChange={(e) => setData('discount_value', parseFloat(e.target.value) || 0)}
                                                min={0}
                                                max={100}
                                                step={0.01}
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
                            <Link href={companyUrl('/recurring-invoices')} className="w-full">
                                <Button
                                    type="button"
                                    variant="zinc"
                                    className="w-full"
                                >
                                    Batal
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </form>
    );
}

/* ─────────────────────────────────── create page ─── */

function CreateTemplatePage({ clients, services }: Props) {
    return (
        <>
            <Head title="Buat Template Recurring" />
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Link
                        href={companyUrl('/recurring-invoices')}
                        className="h-9 w-9 rounded-xl flex items-center justify-center border border-secondary-200 dark:border-dark-600 hover:bg-zinc-100 dark:hover:bg-dark-600 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-dark-600 dark:text-dark-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                            Buat Template Recurring
                        </h1>
                        <p className="text-gray-600 dark:text-zinc-400 text-sm sm:text-lg">
                            Template invoice yang akan di-generate secara periodik
                        </p>
                    </div>
                </div>

                <TemplateForm
                    clients={clients}
                    services={services}
                    submitUrl={companyUrl('/recurring-invoices/templates')}
                    method="post"
                    submitLabel="Simpan Template"
                />
            </div>
        </>
    );
}

CreateTemplatePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default CreateTemplatePage;
