import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, toastError, toastErrors, toLocalIso } from '@/lib/utils';
import { ColDef, CurrencyCell, ResizableTh, parseQty, useColumnResize } from '@/pages/invoices/create';
import { router } from '@inertiajs/react';
import {
    BarChart3,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Edit2,
    ExternalLink,
    FileText,
    Info,
    Loader2,
    PenLine,
    Plus,
    RefreshCw,
    Repeat2,
    RotateCcw,
    Send,
    Trash2,
    TrendingDown,
    TrendingUp,
    Zap,
} from 'lucide-react';
import * as React from 'react';
import ReactApexChart from 'react-apexcharts';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Client { id: number; name: string; display_name: string; email: string }
interface Service { id: number; name: string; price: number; type: string }

interface ItemForm {
    client_id: number | null;
    service_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cogs_amount: number;
    is_tax_deposit: boolean;
}

interface InvoiceTemplateData {
    items: Array<ItemForm & { amount: number; unit: string }>;
    subtotal: number;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    discount_amount: number;
    discount_reason: string;
    total_amount: number;
}

interface RecurringTemplate {
    id: number;
    template_name: string;
    client_id: number;
    client_name: string;
    start_date: string;
    end_date: string;
    frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
    status: 'active' | 'archived';
    total_amount: number;
    invoice_template: InvoiceTemplateData;
    total_invoices_count: number;
    generated_count: number;
    published_count: number;
    remaining_count: number;
    progress_pct: number;
}

interface MonthlyInvoice {
    id: number;
    template_id: number;
    template_name: string;
    frequency: string | null;
    client_id: number;
    client_name: string;
    scheduled_date: string;
    issue_date: string | null;
    due_date: string | null;
    status: 'draft' | 'published';
    total_amount: number;
    invoice_data: InvoiceTemplateData;
    published_invoice_id: number | null;
    published_invoice_number: string | null;
}

interface ActiveTemplate {
    id: number;
    label: string;
    frequency: string;
    invoice_template: InvoiceTemplateData;
}

interface PageProps {
    tab: string;
    templates: RecurringTemplate[];
    monthly: {
        invoices: MonthlyInvoice[];
        stats: {
            total_revenue: number;
            total_cogs: number;
            total_profit: number;
            profit_margin: number;
            outstanding_profit: number;
            paid_profit: number;
        };
        month: number;
        year: number;
        template_filter: number | null;
        status_filter: string;
    };
    analytics: {
        metrics: {
            current_year: number;
            previous_year: number;
            growth_rate: number;
            current_month: number;
            average_monthly: number;
        };
        chart: Array<{ label: string; revenue: number }>;
        template_stats: Array<{
            name: string;
            client: string;
            revenue: number;
            count: number;
            published: number;
            success_rate: number;
            profit_margin: number;
        }>;
        status_breakdown: {
            draft: { count: number; revenue: number; percentage: number };
            published: { count: number; revenue: number; percentage: number };
            total: { count: number };
        };
    };
    analytics_year: number;
    analytics_period: string;
    clients: Client[];
    services: Service[];
    active_templates: ActiveTemplate[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const FREQUENCY_LABELS: Record<string, string> = {
    monthly: 'Bulanan',
    quarterly: 'Triwulanan',
    semi_annual: 'Semesteran',
    annual: 'Tahunan',
};

const FREQUENCY_COLORS: Record<string, string> = {
    monthly: 'blue',
    quarterly: 'purple',
    semi_annual: 'orange',
    annual: 'emerald',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_NAMES_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const EMPTY_ITEM: ItemForm = { client_id: null, service_name: '', quantity: 1, unit: '', unit_price: 0, cogs_amount: 0, is_tax_deposit: false };

const COMMON_UNITS = [
    'jam', 'hari', 'minggu', 'bulan', 'tahun',
    'project', 'paket', 'set', 'lot', 'kali',
    'pcs', 'unit', 'lembar', 'kg', 'ton', 'm²', 'm³',
];

const itemCellCls = 'h-8 text-xs px-2 rounded-md border-transparent hover:border-secondary-300 dark:hover:border-dark-600 bg-transparent dark:bg-transparent focus:bg-white dark:focus:bg-dark-800';

function getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

// ─── Items Repeater ─────────────────────────────────────────────────────────

interface ItemsRepeaterProps {
    items: ItemForm[];
    onChange: (items: ItemForm[]) => void;
    clients: Client[];
    services: Service[];
    defaultClientId?: number | null;
    errors?: Record<string, string>;
}

function ItemsRepeater({ items, onChange, clients, services, defaultClientId, errors }: ItemsRepeaterProps) {
    const clientOptions = clients.map((c) => ({ value: c.id, label: c.display_name || c.name }));

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
    const { widths, onMouseDown, resetWidths } = useColumnResize(COL_DEFS, 'monthly-items-col-widths');

    const itemTotals = items.map((item) => Math.round(item.unit_price * parseQty(String(item.quantity))));

    const addItem = () => {
        onChange([...items, { ...EMPTY_ITEM, client_id: defaultClientId ?? null }]);
    };

    const removeItem = (idx: number) => {
        onChange(items.filter((_, i) => i !== idx));
    };

    const updateItem = (idx: number, field: keyof ItemForm, value: unknown) => {
        onChange(items.map((item, i) => i !== idx ? item : { ...item, [field]: value }));
    };

    const handleServiceChange = (idx: number, name: string) => {
        const svc = services.find((s) => s.name === name);
        onChange(items.map((it, i) => i !== idx ? it : { ...it, service_name: name, ...(svc ? { unit_price: svc.price } : {}) }));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">{items.length} item</span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={resetWidths}
                        className="hidden sm:block text-xs text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
                        title="Reset lebar kolom ke default"
                    >
                        Reset Ukuran Kolom
                    </button>
                    <button
                        type="button"
                        onClick={addItem}
                        className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Tambah Item
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-secondary-200 dark:border-dark-600">
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
                        {items.map((item, idx) => (
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
                                    <Input
                                        value={item.service_name}
                                        onChange={(e) => handleServiceChange(idx, e.target.value)}
                                        placeholder="Nama layanan..."
                                        list={`services-monthly-${idx}`}
                                        error={errors?.[`items.${idx}.service_name`]}
                                        className={itemCellCls}
                                    />
                                    <datalist id={`services-monthly-${idx}`}>
                                        {services.map((s) => <option key={s.id} value={s.name} />)}
                                    </datalist>
                                </td>
                                <td className="px-1 py-1.5 overflow-hidden">
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={item.quantity === 0 ? '' : String(item.quantity)}
                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                        placeholder="1"
                                        className={itemCellCls}
                                    />
                                </td>
                                <td className="px-1 py-1.5 overflow-hidden">
                                    <Input
                                        list={`unit-monthly-${idx}`}
                                        value={item.unit}
                                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                        placeholder="satuan"
                                        className={itemCellCls}
                                    />
                                    <datalist id={`unit-monthly-${idx}`}>
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
                                    {items.length > 1 && (
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
                </table>
            </div>
        </div>
    );
}

// ─── Invoice Summary ─────────────────────────────────────────────────────────

interface SummaryState {
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    discount_reason: string;
}

interface InvoiceSummaryProps {
    items: ItemForm[];
    summary: SummaryState;
    onSummaryChange: (s: SummaryState) => void;
}

function InvoiceSummary({ items, summary, onSummaryChange }: InvoiceSummaryProps) {
    const subtotal = items.filter((i) => !i.is_tax_deposit).reduce((acc, i) => acc + Math.round(i.unit_price * parseQty(String(i.quantity))), 0);
    const taxDeposit = items.filter((i) => i.is_tax_deposit).reduce((acc, i) => acc + Math.round(i.unit_price * parseQty(String(i.quantity))), 0);
    const discountAmount = summary.discount_type === 'fixed'
        ? summary.discount_value
        : Math.round((subtotal * summary.discount_value) / 100);
    const total = Math.max(0, subtotal - discountAmount) + taxDeposit;

    return (
        <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-secondary-50 dark:bg-dark-800 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Ringkasan</h4>

            {/* Discount */}
            <div className="space-y-2">
                <Label className="text-xs text-dark-500 dark:text-dark-400">Diskon</Label>
                <div className="flex gap-2">
                    <Tabs
                        items={[
                            { value: 'fixed', label: 'Nominal' },
                            { value: 'percentage', label: 'Persen' },
                        ]}
                        value={summary.discount_type}
                        onChange={(v) => onSummaryChange({ ...summary, discount_type: v as 'fixed' | 'percentage' })}
                    />
                    {summary.discount_type === 'fixed' ? (
                        <CurrencyInput
                            value={summary.discount_value}
                            onChange={(v) => onSummaryChange({ ...summary, discount_value: v })}
                            className="flex-1"
                        />
                    ) : (
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={summary.discount_value === 0 ? '' : String(summary.discount_value)}
                            onChange={(e) => onSummaryChange({ ...summary, discount_value: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                            placeholder="0"
                            className="flex-1"
                            iconRight={<span className="text-xs text-dark-400">%</span>}
                        />
                    )}
                </div>
                {summary.discount_value > 0 && (
                    <Input
                        placeholder="Alasan diskon (opsional)"
                        value={summary.discount_reason}
                        onChange={(e) => onSummaryChange({ ...summary, discount_reason: e.target.value })}
                    />
                )}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-dark-600 dark:text-dark-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                {taxDeposit > 0 && (
                    <div className="flex justify-between text-dark-600 dark:text-dark-400">
                        <span>Titipan Pajak</span>
                        <span>{formatCurrency(taxDeposit)}</span>
                    </div>
                )}
                {discountAmount > 0 && (
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                        <span>Diskon {summary.discount_type === 'percentage' && summary.discount_value > 0 ? `(${summary.discount_value}%)` : ''}</span>
                        <span>- {formatCurrency(discountAmount)}</span>
                    </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-dark-900 dark:text-dark-50">
                    <span>Total</span>
                    <span className="text-primary-600 dark:text-primary-400">{formatCurrency(total)}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Monthly Invoice Form Modal ───────────────────────────────────────────────

interface MonthlyFormState {
    template_id: number | null;
    scheduled_date: string;
    issue_date: string;
    due_date: string;
    items: ItemForm[];
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    discount_reason: string;
}

const EMPTY_MONTHLY_FORM: MonthlyFormState = {
    template_id: null,
    scheduled_date: toLocalIso(new Date()),
    issue_date: toLocalIso(new Date()),
    due_date: '',
    items: [{ ...EMPTY_ITEM }],
    discount_type: 'fixed',
    discount_value: 0,
    discount_reason: '',
};

interface MonthlyFormModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (inv: MonthlyInvoice) => void;
    editTarget?: MonthlyInvoice | null;
    clients: Client[];
    services: Service[];
    activeTemplates: ActiveTemplate[];
    defaultMonth: number;
    defaultYear: number;
}

function MonthlyFormModal({ open, onClose, onSuccess, editTarget, clients, services, activeTemplates, defaultMonth, defaultYear }: MonthlyFormModalProps) {
    const isEdit = !!editTarget;
    const [form, setForm] = React.useState<MonthlyFormState>(EMPTY_MONTHLY_FORM);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            if (editTarget) {
                const d = editTarget.invoice_data;
                setForm({
                    template_id: editTarget.template_id,
                    scheduled_date: editTarget.scheduled_date,
                    issue_date: editTarget.issue_date ?? '',
                    due_date: editTarget.due_date ?? '',
                    items: (d.items ?? []).map((i) => ({
                        client_id: i.client_id,
                        service_name: i.service_name,
                        quantity: i.quantity,
                        unit: i.unit ?? '',
                        unit_price: i.unit_price,
                        cogs_amount: i.cogs_amount,
                        is_tax_deposit: i.is_tax_deposit,
                    })),
                    discount_type: d.discount_type ?? 'fixed',
                    discount_value: d.discount_value ?? 0,
                    discount_reason: d.discount_reason ?? '',
                });
            } else {
                const d = toLocalIso(new Date(defaultYear, defaultMonth - 1, 1));
                setForm({ ...EMPTY_MONTHLY_FORM, scheduled_date: d });
            }
            setErrors({});
        }
    }, [open, editTarget, defaultMonth, defaultYear]);

    const loadFromTemplate = (templateId: number | null) => {
        if (!templateId) return;
        const tmpl = activeTemplates.find((t) => t.id === templateId);
        if (!tmpl) return;
        const d = tmpl.invoice_template;
        setForm((prev) => ({
            ...prev,
            template_id: templateId,
            items: (d.items ?? []).map((i) => ({
                client_id: i.client_id,
                service_name: i.service_name,
                quantity: i.quantity,
                unit: i.unit ?? '',
                unit_price: i.unit_price,
                cogs_amount: i.cogs_amount,
                is_tax_deposit: i.is_tax_deposit,
            })),
            discount_type: d.discount_type ?? 'fixed',
            discount_value: d.discount_value ?? 0,
            discount_reason: d.discount_reason ?? '',
        }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setErrors({});

        const url = isEdit
            ? companyUrl(`/recurring-invoices/monthly/${editTarget!.id}`)
            : companyUrl('/recurring-invoices/monthly');

        const payload = {
            template_id: form.template_id,
            scheduled_date: form.scheduled_date,
            issue_date: form.issue_date || null,
            due_date: form.due_date || null,
            items: form.items.map((item) => ({ ...item, quantity: parseQty(String(item.quantity)) })),
            discount_type: form.discount_type,
            discount_value: form.discount_value,
            discount_reason: form.discount_reason,
        };

        try {
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok) {
                if (res.status === 422 && json.errors) {
                    setErrors(json.errors);
                    toastErrors(json.errors, 'RecurringInvoiceForm');
                } else {
                    toastError(json.message ?? 'Terjadi kesalahan.');
                    console.error('[RecurringInvoiceForm]', res.status, json);
                }
                return;
            }

            toast.success(json.message);
            onSuccess(json.invoice);
            onClose();
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
            console.error('[RecurringInvoiceForm]', err);
        } finally {
            setLoading(false);
        }
    };

    const templateOptions = activeTemplates.map((t) => ({ value: String(t.id), label: t.label }));

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent size="4xl" className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-4 my-3">
                        <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                            <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <DialogTitle>{isEdit ? 'Edit Invoice Recurring' : 'Buat Invoice Recurring'}</DialogTitle>
                            <p className="text-sm text-dark-600 dark:text-dark-400 mt-0.5">Invoice draft untuk bulan ini</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 pb-2 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {!isEdit && (
                            <div className="sm:col-span-2">
                                <Combobox
                                    label="Template (opsional)"
                                    options={templateOptions}
                                    value={form.template_id ? String(form.template_id) : ''}
                                    onChange={(v) => {
                                        const id = v ? parseInt(v) : null;
                                        setForm({ ...form, template_id: id });
                                        loadFromTemplate(id);
                                    }}
                                    placeholder="Pilih template untuk mengisi otomatis"
                                />
                            </div>
                        )}
                        <DatePicker
                            label="Tanggal Terjadwal *"
                            value={form.scheduled_date ? new Date(form.scheduled_date) : undefined}
                            onChange={(d) => setForm({ ...form, scheduled_date: d ? toLocalIso(d) : '' })}
                            error={errors.scheduled_date}
                        />
                        <DatePicker
                            label="Tanggal Terbit"
                            value={form.issue_date ? new Date(form.issue_date) : undefined}
                            onChange={(d) => setForm({ ...form, issue_date: d ? toLocalIso(d) : '' })}
                        />
                        <DatePicker
                            label="Tanggal Jatuh Tempo"
                            value={form.due_date ? new Date(form.due_date) : undefined}
                            onChange={(d) => setForm({ ...form, due_date: d ? toLocalIso(d) : '' })}
                        />
                    </div>

                    <Separator />

                    <div>
                        <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50 mb-3">Item Invoice</h4>
                        <ItemsRepeater
                            items={form.items}
                            onChange={(items) => setForm({ ...form, items })}
                            clients={clients}
                            services={services}
                            errors={errors}
                        />
                    </div>

                    <InvoiceSummary
                        items={form.items}
                        summary={{ discount_type: form.discount_type, discount_value: form.discount_value, discount_reason: form.discount_reason }}
                        onSummaryChange={(s) => setForm({ ...form, ...s })}
                    />
                </div>

                <DialogFooter>
                    <Button variant="zinc" onClick={onClose} disabled={loading} className="w-full sm:w-auto order-2 sm:order-1">
                        Batal
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto order-1 sm:order-2">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isEdit ? 'Simpan Perubahan' : 'Buat Invoice'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Generate Modal ───────────────────────────────────────────────────────────

interface GenerateModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    month: number;
    year: number;
}

function GenerateModal({ open, onClose, onSuccess, month, year }: GenerateModalProps) {
    const [issueDate, setIssueDate] = React.useState(toLocalIso(new Date()));
    const [dueDate, setDueDate] = React.useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 30);
        return toLocalIso(d);
    });
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setIssueDate(toLocalIso(new Date()));
            const d = new Date(); d.setDate(d.getDate() + 30);
            setDueDate(toLocalIso(d));
        }
    }, [open]);

    const handle = async () => {
        setLoading(true);
        try {
            const res = await fetch(companyUrl('/recurring-invoices/monthly/generate'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
                body: JSON.stringify({ month, year, issue_date: issueDate, due_date: dueDate }),
            });
            const json = await res.json();
            if (!res.ok) { toastError(json.message ?? 'Gagal generate.'); console.error('[Generate]', res.status, json); return; }
            toast.success(json.message);
            onSuccess();
            onClose();
        } catch (err) { toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.'); console.error('[Generate]', err); }
        finally { setLoading(false); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent size="md">
                <DialogHeader>
                    <div className="flex items-center gap-4 my-3">
                        <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                            <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle>Generate Invoice Otomatis</DialogTitle>
                            <p className="text-sm text-dark-600 dark:text-dark-400 mt-0.5">
                                {MONTH_NAMES_FULL[month - 1]} {year}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 pb-2 space-y-4">
                    <p className="text-sm text-dark-600 dark:text-dark-400">
                        Sistem akan membuat invoice draft dari semua template aktif yang sesuai dengan jadwal bulan ini.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <DatePicker
                            label="Tanggal Terbit"
                            value={issueDate ? new Date(issueDate) : undefined}
                            onChange={(d) => setIssueDate(d ? toLocalIso(d) : '')}
                        />
                        <DatePicker
                            label="Jatuh Tempo"
                            value={dueDate ? new Date(dueDate) : undefined}
                            onChange={(d) => setDueDate(d ? toLocalIso(d) : '')}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="zinc" onClick={onClose} disabled={loading} className="w-full sm:w-auto order-2 sm:order-1">Batal</Button>
                    <Button variant="primary" onClick={handle} disabled={loading} className="w-full sm:w-auto order-1 sm:order-2">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Generate Sekarang
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Publish Modal ─────────────────────────────────────────────────────────────

interface PublishModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (inv: MonthlyInvoice) => void;
    invoice: MonthlyInvoice | null;
}

function PublishModal({ open, onClose, onSuccess, invoice }: PublishModalProps) {
    const [issueDate, setIssueDate] = React.useState('');
    const [dueDate, setDueDate] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (open && invoice) {
            setIssueDate(invoice.issue_date ?? toLocalIso(new Date()));
            if (invoice.due_date) {
                setDueDate(invoice.due_date);
            } else {
                const d = new Date(); d.setDate(d.getDate() + 30);
                setDueDate(toLocalIso(d));
            }
        }
    }, [open, invoice]);

    const handle = async () => {
        if (!invoice) return;
        setLoading(true);
        try {
            const res = await fetch(companyUrl(`/recurring-invoices/monthly/${invoice.id}/publish`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
                body: JSON.stringify({ issue_date: issueDate, due_date: dueDate }),
            });
            const json = await res.json();
            if (!res.ok) { toastError(json.message ?? 'Gagal publish.'); console.error('[Publish]', res.status, json); return; }
            toast.success(json.message);
            onSuccess(json.invoice);
            onClose();
        } catch (err) { toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.'); console.error('[Publish]', err); }
        finally { setLoading(false); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent size="sm">
                <DialogHeader>
                    <div className="flex items-center gap-4 my-3">
                        <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                            <Send className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <DialogTitle>Publish Invoice</DialogTitle>
                            <p className="text-sm text-dark-600 dark:text-dark-400 mt-0.5">
                                {invoice?.client_name} · {invoice?.template_name}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 pb-2 space-y-4">
                    <p className="text-sm text-dark-600 dark:text-dark-400">
                        Invoice akan dipublish dan menjadi invoice permanen. Tidak bisa diedit setelah dipublish.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <DatePicker
                            label="Tanggal Terbit *"
                            value={issueDate ? new Date(issueDate) : undefined}
                            onChange={(d) => setIssueDate(d ? toLocalIso(d) : '')}
                        />
                        <DatePicker
                            label="Jatuh Tempo *"
                            value={dueDate ? new Date(dueDate) : undefined}
                            onChange={(d) => setDueDate(d ? toLocalIso(d) : '')}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="zinc" onClick={onClose} disabled={loading} className="w-full sm:w-auto order-2 sm:order-1">Batal</Button>
                    <Button variant="green" onClick={handle} disabled={loading} className="w-full sm:w-auto order-1 sm:order-2">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Publish
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Bulk Publish Modal ────────────────────────────────────────────────────────

interface BulkPublishModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    selectedIds: number[];
}

function BulkPublishModal({ open, onClose, onSuccess, selectedIds }: BulkPublishModalProps) {
    const [issueDate, setIssueDate] = React.useState(toLocalIso(new Date()));
    const [dueDate, setDueDate] = React.useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return toLocalIso(d); });
    const [loading, setLoading] = React.useState(false);

    const handle = async () => {
        setLoading(true);
        try {
            const res = await fetch(companyUrl('/recurring-invoices/monthly/bulk-publish'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
                body: JSON.stringify({ ids: selectedIds, issue_date: issueDate, due_date: dueDate }),
            });
            const json = await res.json();
            if (!res.ok) { toastError(json.message ?? 'Gagal bulk publish.'); console.error('[BulkPublish]', res.status, json); return; }
            toast.success(json.message);
            onSuccess();
            onClose();
        } catch (err) { toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.'); console.error('[BulkPublish]', err); }
        finally { setLoading(false); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent size="sm">
                <DialogHeader>
                    <div className="flex items-center gap-4 my-3">
                        <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <DialogTitle>Publish {selectedIds.length} Invoice</DialogTitle>
                        </div>
                    </div>
                </DialogHeader>
                <div className="px-6 pb-2 grid grid-cols-2 gap-4">
                    <DatePicker label="Tanggal Terbit *" value={issueDate ? new Date(issueDate) : undefined} onChange={(d) => setIssueDate(d ? toLocalIso(d) : '')} />
                    <DatePicker label="Jatuh Tempo *" value={dueDate ? new Date(dueDate) : undefined} onChange={(d) => setDueDate(d ? toLocalIso(d) : '')} />
                </div>
                <DialogFooter>
                    <Button variant="zinc" onClick={onClose} disabled={loading} className="w-full sm:w-auto order-2 sm:order-1">Batal</Button>
                    <Button variant="green" onClick={handle} disabled={loading} className="w-full sm:w-auto order-1 sm:order-2">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Publish
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RecurringInvoicesIndex({
    tab,
    templates: initTemplates,
    monthly: initMonthly,
    analytics: initAnalyticsData,
    analytics_year: initAnalyticsYear,
    analytics_period: initAnalyticsPeriod,
    clients,
    services,
    active_templates,
}: PageProps) {

    // ── Tab state ──
    const [activeTab, setActiveTab] = React.useState(tab ?? 'templates');

    // ── Template state ──
    const [templates, setTemplates] = React.useState(initTemplates);
    const [templateSearch, setTemplateSearch] = React.useState('');
    const [templateStatusFilter, setTemplateStatusFilter] = React.useState<'all' | 'active' | 'archived'>('active');
    const [deleteTemplateTarget, setDeleteTemplateTarget] = React.useState<RecurringTemplate | null>(null);
    const [deleteTemplateLoading, setDeleteTemplateLoading] = React.useState(false);

    // ── Monthly state ──
    const [monthly, setMonthly] = React.useState(initMonthly);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
    const [generateOpen, setGenerateOpen] = React.useState(false);
    const [monthlyFormOpen, setMonthlyFormOpen] = React.useState(false);
    const [editMonthly, setEditMonthly] = React.useState<MonthlyInvoice | null>(null);
    const [publishTarget, setPublishTarget] = React.useState<MonthlyInvoice | null>(null);
    const [deleteMonthlyTarget, setDeleteMonthlyTarget] = React.useState<MonthlyInvoice | null>(null);
    const [deleteMonthlyLoading, setDeleteMonthlyLoading] = React.useState(false);
    const [bulkPublishOpen, setBulkPublishOpen] = React.useState(false);
    const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);

    // ── Analytics state ──
    const [analytics, setAnalytics] = React.useState(initAnalyticsData);
    const [analyticsYear, setAnalyticsYear] = React.useState(initAnalyticsYear);
    const [analyticsPeriod, setAnalyticsPeriod] = React.useState(initAnalyticsPeriod);

    // Navigate to update monthly data
    const navigateMonthly = (month: number, year: number, templateFilter?: number | null, statusFilter?: string) => {
        router.get(companyUrl('/recurring-invoices'), {
            tab: 'monthly',
            month,
            year,
            template_id: templateFilter ?? monthly.template_filter ?? undefined,
            status: statusFilter ?? monthly.status_filter,
        }, {
            preserveScroll: true,
            onSuccess: (page) => {
                const p = page.props as unknown as PageProps;
                setMonthly(p.monthly);
                setSelectedIds([]);
            },
        });
    };

    const navigateAnalytics = (year: number, period: string) => {
        router.get(companyUrl('/recurring-invoices'), {
            tab: 'analytics',
            analytics_year: year,
            analytics_period: period,
        }, {
            preserveScroll: true,
            onSuccess: (page) => {
                const p = page.props as unknown as PageProps;
                setAnalytics(p.analytics);
                setAnalyticsYear(p.analytics_year);
                setAnalyticsPeriod(p.analytics_period);
            },
        });
    };

    // ── Filtered templates ──
    const filteredTemplates = React.useMemo(() => {
        return templates.filter((t) => {
            const matchStatus = templateStatusFilter === 'all' || t.status === templateStatusFilter;
            const matchSearch = !templateSearch || t.template_name.toLowerCase().includes(templateSearch.toLowerCase()) || t.client_name.toLowerCase().includes(templateSearch.toLowerCase());
            return matchStatus && matchSearch;
        });
    }, [templates, templateSearch, templateStatusFilter]);

    // ── Template CRUD handlers ──
    const handleDeleteTemplate = async () => {
        if (!deleteTemplateTarget) return;
        setDeleteTemplateLoading(true);
        try {
            const res = await fetch(companyUrl(`/recurring-invoices/templates/${deleteTemplateTarget.id}`), {
                method: 'DELETE',
                headers: { 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
            });
            const json = await res.json();
            if (!res.ok) { toastError(json.message); console.error('[DeleteTemplate]', res.status, json); return; }
            toast.success(json.message);
            if (json.archived) {
                setTemplates((prev) => prev.map((t) => t.id === deleteTemplateTarget!.id ? { ...t, status: 'archived' } : t));
            } else {
                setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplateTarget!.id));
            }
        } catch (err) { toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.'); console.error('[DeleteTemplate]', err); }
        finally { setDeleteTemplateLoading(false); setDeleteTemplateTarget(null); }
    };

    const handleRestoreTemplate = async (template: RecurringTemplate) => {
        try {
            const res = await fetch(companyUrl(`/recurring-invoices/templates/${template.id}/restore`), {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
            });
            const json = await res.json();
            if (!res.ok) { toastError(json.message); console.error('[RestoreTemplate]', res.status, json); return; }
            toast.success(json.message);
            setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, status: 'active' } : t));
        } catch (err) { toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.'); console.error('[RestoreTemplate]', err); }
    };

    // ── Monthly CRUD handlers ──
    const handleMonthlySuccess = (inv: MonthlyInvoice) => {
        setMonthly((prev) => {
            const idx = prev.invoices.findIndex((x) => x.id === inv.id);
            const next = idx >= 0
                ? { ...prev, invoices: prev.invoices.map((x) => x.id === inv.id ? inv : x) }
                : { ...prev, invoices: [inv, ...prev.invoices] };
            return next;
        });
    };

    const handleDeleteMonthly = async () => {
        if (!deleteMonthlyTarget) return;
        setDeleteMonthlyLoading(true);
        try {
            const res = await fetch(companyUrl(`/recurring-invoices/monthly/${deleteMonthlyTarget.id}`), {
                method: 'DELETE',
                headers: { 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
            });
            const json = await res.json();
            if (!res.ok) { toastError(json.message); console.error('[DeleteMonthly]', res.status, json); return; }
            toast.success(json.message);
            setMonthly((prev) => ({ ...prev, invoices: prev.invoices.filter((x) => x.id !== deleteMonthlyTarget!.id) }));
            setSelectedIds((prev) => prev.filter((id) => id !== deleteMonthlyTarget!.id));
        } catch (err) { toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.'); console.error('[DeleteMonthly]', err); }
        finally { setDeleteMonthlyLoading(false); setDeleteMonthlyTarget(null); }
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.length) return;
        setBulkDeleteLoading(true);
        try {
            const res = await fetch(companyUrl('/recurring-invoices/monthly/bulk-destroy'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            });
            const json = await res.json();
            if (!res.ok) { toastError(json.message); console.error('[BulkDelete]', res.status, json); return; }
            toast.success(json.message);
            setMonthly((prev) => ({ ...prev, invoices: prev.invoices.filter((x) => !selectedIds.includes(x.id)) }));
            setSelectedIds([]);
        } catch (err) { toastError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.'); console.error('[BulkDelete]', err); }
        finally { setBulkDeleteLoading(false); }
    };

    const prevMonth = () => {
        const m = monthly.month === 1 ? 12 : monthly.month - 1;
        const y = monthly.month === 1 ? monthly.year - 1 : monthly.year;
        navigateMonthly(m, y);
    };
    const nextMonth = () => {
        const m = monthly.month === 12 ? 1 : monthly.month + 1;
        const y = monthly.month === 12 ? monthly.year + 1 : monthly.year;
        navigateMonthly(m, y);
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };
    const toggleSelectAll = () => {
        const draftIds = monthly.invoices.filter((i) => i.status === 'draft').map((i) => i.id);
        setSelectedIds((prev) => prev.length === draftIds.length ? [] : draftIds);
    };

    const templateStatsOverall = React.useMemo(() => {
        const total = templates.length;
        const active = templates.filter((t) => t.status === 'active').length;
        const archived = templates.filter((t) => t.status === 'archived').length;
        const totalRevenue = templates.reduce((sum, t) => sum + (t.total_amount * t.generated_count), 0);
        return { total, active, archived, totalRevenue };
    }, [templates]);

    const draftIds = monthly.invoices.filter((i) => i.status === 'draft').map((i) => i.id);
    const allDraftSelected = draftIds.length > 0 && selectedIds.length === draftIds.length;

    const yearOptions = React.useMemo(() => {
        const cur = new Date().getFullYear();
        return [cur - 2, cur - 1, cur, cur + 1].map((y) => ({ value: String(y), label: String(y) }));
    }, []);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
        <div className="space-y-6">
                <PageHeader
                    title="Invoice Recurring"
                    description="Kelola template dan generate invoice otomatis berulang"
                    action={
                        <div className="flex items-center gap-2">
                            {activeTab === 'templates' && (
                                <Button variant="primary" size="sm" onClick={() => router.get(companyUrl('/recurring-invoices/templates/create'))}>
                                    <Plus className="w-4 h-4 mr-1.5" /> Buat Template
                                </Button>
                            )}
                            {activeTab === 'monthly' && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
                                        <Zap className="w-4 h-4 mr-1.5" /> Generate Otomatis
                                    </Button>
                                    <Button variant="primary" size="sm" onClick={() => { setEditMonthly(null); setMonthlyFormOpen(true); }}>
                                        <Plus className="w-4 h-4 mr-1.5" /> Buat Manual
                                    </Button>
                                </>
                            )}
                        </div>
                    }
                />

                {/* ── Tabs ── */}
                <Tabs
                    items={[
                        { value: 'templates', label: 'Templates', icon: <Repeat2 className="h-4 w-4" /> },
                        { value: 'monthly', label: 'Bulanan', icon: <Calendar className="h-4 w-4" /> },
                        { value: 'analytics', label: 'Analitik', icon: <BarChart3 className="h-4 w-4" /> },
                    ]}
                    value={activeTab}
                    onChange={setActiveTab}
                />

                {/* ═══════════════════════════════════════════════════════════
                    TEMPLATES TAB
                ══════════════════════════════════════════════════════════════ */}
                {activeTab === 'templates' && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <StatsCard label="Total Template" value={templateStatsOverall.total} icon={<Repeat2 />} color="blue" />
                            <StatsCard label="Aktif" value={templateStatsOverall.active} icon={<CheckCircle2 />} color="green" />
                            <StatsCard label="Diarsipkan" value={templateStatsOverall.archived} icon={<Clock />} color="indigo" />
                            <StatsCard label="Template Selesai" value={templates.filter((t) => t.remaining_count === 0).length} icon={<RefreshCw />} color="emerald" />
                        </div>

                        {/* Filter bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <Input
                                placeholder="Cari template atau klien..."
                                value={templateSearch}
                                onChange={(e) => setTemplateSearch(e.target.value)}
                                icon={<span className="text-dark-400">🔍</span>}
                                className="w-full sm:w-72"
                            />
                            <Tabs
                                items={[
                                    { value: 'all', label: 'Semua' },
                                    { value: 'active', label: 'Aktif' },
                                    { value: 'archived', label: 'Diarsipkan' },
                                ]}
                                value={templateStatusFilter}
                                onChange={(v) => setTemplateStatusFilter(v as 'all' | 'active' | 'archived')}
                            />
                        </div>

                        {/* Template cards */}
                        {filteredTemplates.length === 0 ? (
                            <EmptyState
                                icon={<Repeat2 className="w-12 h-12" />}
                                title="Belum ada template"
                                description="Buat template recurring untuk generate invoice otomatis"
                                action={<Button variant="primary" onClick={() => router.get(companyUrl('/recurring-invoices/templates/create'))}><Plus className="w-4 h-4 mr-1.5" /> Buat Template</Button>}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredTemplates.map((t) => (
                                    <Card key={t.id} className={`hover:shadow-md transition-shadow ${t.status === 'archived' ? 'opacity-60' : ''}`}>
                                        <CardContent className="p-5 space-y-4">
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant={FREQUENCY_COLORS[t.frequency] as any} className="text-xs">
                                                            {FREQUENCY_LABELS[t.frequency]}
                                                        </Badge>
                                                        {t.status === 'archived' && <Badge variant="zinc" className="text-xs">Arsip</Badge>}
                                                    </div>
                                                    <h3 className="mt-1.5 font-semibold text-dark-900 dark:text-dark-50 truncate">{t.template_name}</h3>
                                                    <p className="text-sm text-dark-500 dark:text-dark-400">{t.client_name}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {t.status === 'active' && (
                                                        <button onClick={() => router.get(companyUrl(`/recurring-invoices/templates/${t.id}/edit`))} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-dark-600 text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 transition-colors">
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {t.status === 'archived' ? (
                                                        <button onClick={() => handleRestoreTemplate(t)} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-dark-600 text-dark-400 hover:text-emerald-600 transition-colors">
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => setDeleteTemplateTarget(t)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Amount */}
                                            <div className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                                {formatCurrency(t.total_amount)}
                                            </div>

                                            {/* Date range */}
                                            <div className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {t.start_date} — {t.end_date}
                                            </div>

                                            {/* Progress */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-xs text-dark-500 dark:text-dark-400">
                                                    <span>{t.generated_count}/{t.total_invoices_count} invoice</span>
                                                    <span>{t.progress_pct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-secondary-200 dark:bg-dark-600 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary-500 rounded-full transition-all"
                                                        style={{ width: `${t.progress_pct}%` }}
                                                    />
                                                </div>
                                                <div className="flex gap-3 text-xs">
                                                    <span className="text-emerald-600 dark:text-emerald-400">{t.published_count} published</span>
                                                    <span className="text-dark-400">{t.remaining_count} tersisa</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    MONTHLY TAB
                ══════════════════════════════════════════════════════════════ */}
                {activeTab === 'monthly' && (
                    <div className="space-y-6">
                        {/* Month navigator */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <button onClick={prevMonth} className="p-2 rounded-xl border border-secondary-200 dark:border-dark-600 hover:bg-secondary-100 dark:hover:bg-dark-700 text-dark-500 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="min-w-[160px] text-center font-semibold text-dark-900 dark:text-dark-50">
                                    {MONTH_NAMES_FULL[monthly.month - 1]} {monthly.year}
                                </div>
                                <button onClick={nextMonth} className="p-2 rounded-xl border border-secondary-200 dark:border-dark-600 hover:bg-secondary-100 dark:hover:bg-dark-700 text-dark-500 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Combobox
                                    options={[{ value: '', label: 'Semua Template' }, ...active_templates.map((t) => ({ value: String(t.id), label: t.label }))]}
                                    value={monthly.template_filter ? String(monthly.template_filter) : ''}
                                    onChange={(v) => navigateMonthly(monthly.month, monthly.year, v ? parseInt(v) : null)}
                                    placeholder="Filter template"
                                    className="w-52"
                                />
                                <Tabs
                                    items={[
                                        { value: 'all', label: 'Semua' },
                                        { value: 'draft', label: 'Draft' },
                                        { value: 'published', label: 'Published' },
                                    ]}
                                    value={monthly.status_filter}
                                    onChange={(s) => navigateMonthly(monthly.month, monthly.year, undefined, s)}
                                />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                            <StatsCard label="Total Revenue" value={formatCurrency(monthly.stats.total_revenue)} icon={<TrendingUp />} color="blue" />
                            <StatsCard label="Total Profit" value={formatCurrency(monthly.stats.total_profit)} icon={<TrendingUp />} color="green" />
                            <StatsCard label="Margin Profit" value={`${monthly.stats.profit_margin}%`} icon={<BarChart3 />} color="purple" />
                            <StatsCard label="Profit Pending" value={formatCurrency(monthly.stats.outstanding_profit)} icon={<Clock />} color="yellow" />
                        </div>

                        {/* Table */}
                        {monthly.invoices.length === 0 ? (
                            <EmptyState
                                icon={<FileText className="w-12 h-12" />}
                                title="Belum ada invoice"
                                description="Generate invoice dari template atau buat manual"
                                action={
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}><Zap className="w-4 h-4 mr-1.5" /> Generate</Button>
                                        <Button variant="primary" size="sm" onClick={() => { setEditMonthly(null); setMonthlyFormOpen(true); }}><Plus className="w-4 h-4 mr-1.5" /> Buat Manual</Button>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                        <tr>
                                            <th className="w-10 px-4 py-3">
                                                <Checkbox
                                                    checked={allDraftSelected}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Klien / Template</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 hidden sm:table-cell">Tanggal</th>
                                            <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Total</th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-dark-500 dark:text-dark-400">Status</th>
                                            <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                        {monthly.invoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-secondary-50/80 dark:hover:bg-dark-800/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    {inv.status === 'draft' && (
                                                        <Checkbox
                                                            checked={selectedIds.includes(inv.id)}
                                                            onCheckedChange={() => toggleSelect(inv.id)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-dark-900 dark:text-dark-50">{inv.client_name}</div>
                                                    <div className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                                                        <Repeat2 className="w-3 h-3" />
                                                        {inv.template_name}
                                                        {inv.frequency && (
                                                            <Badge variant={FREQUENCY_COLORS[inv.frequency] as any} className="text-xs ml-1">
                                                                {FREQUENCY_LABELS[inv.frequency]}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 hidden sm:table-cell text-dark-600 dark:text-dark-400 text-xs">
                                                    <div>{inv.scheduled_date}</div>
                                                    {inv.published_invoice_number && (
                                                        <a href={companyUrl(`/invoices?search=${inv.published_invoice_number}`)} className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-0.5">
                                                            <ExternalLink className="w-3 h-3" />
                                                            {inv.published_invoice_number}
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-dark-900 dark:text-dark-50">
                                                    {formatCurrency(inv.total_amount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge variant={inv.status === 'published' ? 'emerald' : 'yellow'}>
                                                        {inv.status === 'published' ? 'Published' : 'Draft'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {inv.status === 'draft' && (
                                                            <>
                                                                <button onClick={() => setPublishTarget(inv)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-dark-400 hover:text-emerald-600 transition-colors" title="Publish">
                                                                    <Send className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => { setEditMonthly(inv); setMonthlyFormOpen(true); }} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-dark-600 text-dark-400 hover:text-dark-700 transition-colors" title="Edit">
                                                                    <PenLine className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => setDeleteMonthlyTarget(inv)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500 transition-colors" title="Hapus">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Bulk actions */}
                        {selectedIds.length > 0 && (
                            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                                <div className="bg-white dark:bg-dark-700 rounded-xl shadow-lg border border-secondary-200 dark:border-dark-600 px-4 py-3 flex items-center gap-3 min-w-80">
                                    <span className="text-sm font-medium text-dark-700 dark:text-dark-200 flex-1">
                                        {selectedIds.length} invoice dipilih
                                    </span>
                                    <Button variant="outline" size="sm" onClick={() => setBulkPublishOpen(true)}>
                                        <Send className="w-3.5 h-3.5 mr-1.5" /> Publish
                                    </Button>
                                    <Button variant="red" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteLoading}>
                                        {bulkDeleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />} Hapus
                                    </Button>
                                    <button onClick={() => setSelectedIds([])} className="text-dark-400 hover:text-dark-600 ml-1">✕</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    ANALYTICS TAB
                ══════════════════════════════════════════════════════════════ */}
                {activeTab === 'analytics' && (
                    <div className="space-y-6">
                        {/* Controls */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <Combobox
                                options={yearOptions}
                                value={String(analyticsYear)}
                                onChange={(v) => { if (v) { setAnalyticsYear(parseInt(v)); navigateAnalytics(parseInt(v), analyticsPeriod); } }}
                                placeholder="Tahun"
                                className="w-32"
                            />
                            <Tabs
                                items={[
                                    { value: 'monthly', label: 'Bulanan' },
                                    { value: 'quarterly', label: 'Triwulanan' },
                                ]}
                                value={analyticsPeriod}
                                onChange={(p) => { setAnalyticsPeriod(p as 'monthly' | 'quarterly'); navigateAnalytics(analyticsYear, p as 'monthly' | 'quarterly'); }}
                            />
                        </div>

                        {/* KPI metrics */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                            <StatsCard label={`Revenue ${analyticsYear}`} value={formatCurrency(analytics.metrics.current_year)} icon={<TrendingUp />} color="blue" />
                            <StatsCard label={`Revenue ${analyticsYear - 1}`} value={formatCurrency(analytics.metrics.previous_year)} icon={<TrendingDown />} color="indigo" />
                            <StatsCard
                                label="Pertumbuhan"
                                value={`${analytics.metrics.growth_rate > 0 ? '+' : ''}${analytics.metrics.growth_rate}%`}
                                icon={analytics.metrics.growth_rate >= 0 ? <TrendingUp /> : <TrendingDown />}
                                color={analytics.metrics.growth_rate >= 0 ? 'green' : 'red'}
                            />
                            <StatsCard label="Rata-rata Bulanan" value={formatCurrency(analytics.metrics.average_monthly)} icon={<BarChart3 />} color="purple" />
                        </div>

                        {/* Revenue chart */}
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50 mb-4">
                                    Revenue {analyticsPeriod === 'monthly' ? 'Bulanan' : 'Triwulanan'} {analyticsYear}
                                </h3>
                                <ReactApexChart
                                    type="bar"
                                    height={260}
                                    series={[{ name: 'Revenue', data: analytics.chart.map((c) => c.revenue) }]}
                                    options={{
                                        chart: { toolbar: { show: false }, background: 'transparent' },
                                        xaxis: { categories: analytics.chart.map((c) => c.label), labels: { style: { colors: '#71717a', fontSize: '12px' } } },
                                        yaxis: { labels: { formatter: (v) => `Rp ${(v / 1000000).toFixed(1)}M`, style: { colors: '#71717a', fontSize: '11px' } } },
                                        colors: ['#2563eb'],
                                        plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
                                        dataLabels: { enabled: false },
                                        grid: { borderColor: '#27272a', strokeDashArray: 3 },
                                        tooltip: { y: { formatter: (v) => formatCurrency(v) } },
                                        theme: { mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light' },
                                    }}
                                />
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            {/* Template performance */}
                            <div className="xl:col-span-2">
                                <Card>
                                    <CardContent className="p-6">
                                        <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50 mb-4">Performa Template</h3>
                                        {analytics.template_stats.length === 0 ? (
                                            <p className="text-sm text-dark-500 dark:text-dark-400 text-center py-6">Belum ada data</p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                                        <tr>
                                                            <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">Template</th>
                                                            <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400">Revenue</th>
                                                            <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400 hidden sm:table-cell">Inv</th>
                                                            <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400 hidden md:table-cell">Sukses</th>
                                                            <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400 hidden md:table-cell">Margin</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                                        {analytics.template_stats.map((ts, i) => (
                                                            <tr key={i} className="hover:bg-secondary-50/80 dark:hover:bg-dark-800/50">
                                                                <td className="py-2.5">
                                                                    <div className="font-medium text-dark-900 dark:text-dark-50 truncate max-w-[180px]">{ts.name}</div>
                                                                    <div className="text-xs text-dark-500 dark:text-dark-400">{ts.client}</div>
                                                                </td>
                                                                <td className="py-2.5 text-right font-medium text-dark-900 dark:text-dark-50">{formatCurrency(ts.revenue)}</td>
                                                                <td className="py-2.5 text-right text-dark-600 dark:text-dark-400 hidden sm:table-cell">{ts.published}/{ts.count}</td>
                                                                <td className="py-2.5 text-right hidden md:table-cell">
                                                                    <Badge variant={ts.success_rate >= 80 ? 'emerald' : ts.success_rate >= 50 ? 'yellow' : 'red'} className="text-xs">
                                                                        {ts.success_rate}%
                                                                    </Badge>
                                                                </td>
                                                                <td className="py-2.5 text-right hidden md:table-cell">
                                                                    <span className={ts.profit_margin >= 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-dark-600 dark:text-dark-400'}>
                                                                        {ts.profit_margin}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Status breakdown */}
                            <Card>
                                <CardContent className="p-6 space-y-4">
                                    <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50">Breakdown Status</h3>
                                    <div className="space-y-3">
                                        {[
                                            { key: 'published', label: 'Published', color: 'bg-emerald-500' },
                                            { key: 'draft', label: 'Draft', color: 'bg-yellow-400' },
                                        ].map(({ key, label, color }) => {
                                            const data = analytics.status_breakdown[key as 'draft' | 'published'];
                                            return (
                                                <div key={key} className="space-y-1.5">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-dark-700 dark:text-dark-300">{label}</span>
                                                        <span className="font-medium text-dark-900 dark:text-dark-50">{data.count} ({data.percentage}%)</span>
                                                    </div>
                                                    <div className="h-1.5 bg-secondary-200 dark:bg-dark-600 rounded-full overflow-hidden">
                                                        <div className={`h-full ${color} rounded-full`} style={{ width: `${data.percentage}%` }} />
                                                    </div>
                                                    <div className="text-xs text-dark-500 dark:text-dark-400">{formatCurrency(data.revenue)}</div>
                                                </div>
                                            );
                                        })}
                                        <Separator />
                                        <div className="flex justify-between text-sm font-semibold text-dark-900 dark:text-dark-50">
                                            <span>Total</span>
                                            <span>{analytics.status_breakdown.total.count} invoice</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            <ConfirmDialog
                open={!!deleteTemplateTarget}
                onOpenChange={(v) => !v && setDeleteTemplateTarget(null)}
                title="Hapus Template?"
                description={
                    deleteTemplateTarget?.published_count
                        ? `Template "${deleteTemplateTarget?.template_name}" memiliki ${deleteTemplateTarget?.published_count} invoice terpublish. Template akan diarsipkan, bukan dihapus.`
                        : `Template "${deleteTemplateTarget?.template_name}" akan dihapus permanen beserta semua invoice draft-nya.`
                }
                onConfirm={handleDeleteTemplate}
                variant="danger"
            />

            <MonthlyFormModal
                open={monthlyFormOpen}
                onClose={() => { setMonthlyFormOpen(false); setEditMonthly(null); }}
                onSuccess={handleMonthlySuccess}
                editTarget={editMonthly}
                clients={clients}
                services={services}
                activeTemplates={active_templates}
                defaultMonth={monthly.month}
                defaultYear={monthly.year}
            />

            <GenerateModal
                open={generateOpen}
                onClose={() => setGenerateOpen(false)}
                onSuccess={() => navigateMonthly(monthly.month, monthly.year)}
                month={monthly.month}
                year={monthly.year}
            />

            <PublishModal
                open={!!publishTarget}
                onClose={() => setPublishTarget(null)}
                onSuccess={(inv) => { handleMonthlySuccess(inv); setPublishTarget(null); }}
                invoice={publishTarget}
            />

            <ConfirmDialog
                open={!!deleteMonthlyTarget}
                onOpenChange={(v) => !v && setDeleteMonthlyTarget(null)}
                title="Hapus Invoice?"
                description={`Invoice dari ${deleteMonthlyTarget?.client_name} akan dihapus permanen.`}
                onConfirm={handleDeleteMonthly}
                variant="danger"
            />

            <BulkPublishModal
                open={bulkPublishOpen}
                onClose={() => setBulkPublishOpen(false)}
                onSuccess={() => { setBulkPublishOpen(false); navigateMonthly(monthly.month, monthly.year); }}
                selectedIds={selectedIds}
            />
        </>
    );
}

RecurringInvoicesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
