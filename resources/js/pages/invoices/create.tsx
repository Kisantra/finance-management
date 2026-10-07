import { Head, Link, useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import { ArrowLeft, Eye, EyeOff, Plus, ReceiptText, Search, Send, Tag, Trash2, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { CurrencyInput } from '@/components/shared/currency-input';
import { AppLayout } from '@/layouts/app-layout';
import { cn, toastErrors, toLocalIso } from '@/lib/utils';
import type { SharedProps } from '@/types';
import { InvoicePaper, type PaperZoom } from './components/invoice-paper';
import { parseQty } from './components/item-table-helpers';
import { BTN, CARD, FIELD, FIELD_SM, getCsrfToken, rp, SumRow, SURFACE } from './components/ob';

/* ─────────────────────────────────── types ─── */

export interface ClientOption {
    id: number;
    name: string;
    email: string | null;
    npwp: string | null;
    type: string;
}

export interface ServiceOption {
    id: number;
    name: string;
    price: number;
    type: string;
}

interface ItemRow {
    client_id: number | null;
    service_name: string;
    quantity: string;
    unit: string;
    unit_price: number;
    cogs_amount: number;
    is_tax_deposit: boolean;
}

export interface InvoiceFormData {
    client_id: number | null;
    issue_date: string;
    due_date: string;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    discount_reason: string;
    items: ItemRow[];
}

interface EditorProps {
    clients: ClientOption[];
    services: ServiceOption[];
    /** Ada = mode edit. */
    invoice?: { id: number; invoice_number: string | null; status: string };
    initialData?: InvoiceFormData;
}

/* ─────────────────────────────────── konstanta ─── */

const COMMON_UNITS = ['jam', 'hari', 'minggu', 'bulan', 'tahun', 'project', 'paket', 'set', 'lot', 'kali', 'pcs', 'unit', 'lembar', 'kg', 'ton', 'm²', 'm³'];

const TEMPLATES = [
    { value: 'kisantra-invoice', label: 'Kisantra' },
    { value: 'semesta-invoice', label: 'Semesta' },
    { value: 'agsa-invoice', label: 'AGSA' },
    { value: 'invoice', label: 'Generik' },
];

const ZOOM_OPTIONS = [
    { value: 'fit' as const, label: 'Pas lebar' },
    { value: 'actual' as const, label: '100%' },
];

const DEFAULT_TERM_DAYS = 14;

function emptyItem(): ItemRow {
    return { client_id: null, service_name: '', quantity: '1', unit: '', unit_price: 0, cogs_amount: 0, is_tax_deposit: false };
}

function addDays(iso: string, days: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return toLocalIso(d);
}

function toDate(iso: string): Date | null {
    return iso ? new Date(iso + 'T00:00:00') : null;
}

function readPref<T extends string>(key: string, fallback: T): T {
    try {
        return (localStorage.getItem(key) as T) ?? fallback;
    } catch {
        return fallback;
    }
}

function writePref(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* penyimpanan diblokir: preferensi tidak diingat */
    }
}

/** Isian editor → payload server (qty "1,5" → "1.5"). Dipakai simpan maupun pratinjau. */
function toPayload(d: InvoiceFormData, multiClient: boolean) {
    return {
        ...d,
        items: d.items.map((item) => ({
            ...item,
            client_id: multiClient ? item.client_id : null,
            quantity: String(parseQty(item.quantity)),
        })),
    };
}

/* ─────────────────────────────────── pratinjau langsung ─── */

interface PreviewState {
    /** blob: URL PDF pratinjau terbaru. */
    url: string | null;
    number: string | null;
    loading: boolean;
    error: string | null;
}

/**
 * Render ulang PDF di server setiap isian berubah (jeda 350 ms, permintaan lama dibatalkan).
 * Server memakai jalur render yang sama dengan tombol Unduh, jadi kertas = berkas ekspor.
 */
function useLivePreview(payload: unknown, enabled: boolean) {
    const [state, setState] = React.useState<PreviewState>({ url: null, number: null, loading: true, error: null });
    const [attempt, setAttempt] = React.useState(0);
    const body = JSON.stringify(payload);

    React.useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        setState((s) => ({ ...s, loading: true }));
        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch('/invoices/preview', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/pdf',
                        'X-CSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body,
                    signal: controller.signal,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.message ?? `Server membalas ${res.status}.`);
                }
                const url = URL.createObjectURL(await res.blob());
                setState((prev) => {
                    // URL lama dilepas setelah kertas baru sempat menggantikannya.
                    if (prev.url) {
                        const old = prev.url;
                        window.setTimeout(() => URL.revokeObjectURL(old), 10_000);
                    }
                    return { url, number: res.headers.get('X-Invoice-Number') || null, loading: false, error: null };
                });
            } catch (e) {
                if (controller.signal.aborted) return;
                console.error('[InvoicePreview]', e);
                setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Pratinjau gagal dimuat.' }));
            }
        }, 350);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [body, enabled, attempt]);

    return { ...state, retry: () => setAttempt((n) => n + 1) };
}

/* ─────────────────────────────────── editor ─── */

export function InvoiceEditor({ clients, services, invoice, initialData }: EditorProps) {
    const isEdit = !!invoice;
    const isDraft = !invoice || invoice.status === 'draft';
    const today = toLocalIso(new Date());

    const initialMulti = !!initialData?.items.some((i) => i.client_id !== null && i.client_id !== initialData.client_id);
    const form = useForm<InvoiceFormData>(
        (initialData && initialMulti
            ? { ...initialData, items: initialData.items.map((i) => ({ ...i, client_id: i.client_id ?? initialData.client_id })) }
            : initialData) ?? {
            client_id: null,
            issue_date: today,
            due_date: addDays(today, DEFAULT_TERM_DAYS),
            discount_type: 'fixed',
            discount_value: 0,
            discount_reason: '',
            items: [emptyItem()],
        },
    );
    const { data, setData, errors, processing } = form;

    const [multiClient, setMultiClient] = React.useState(initialMulti);
    const [discountOpen, setDiscountOpen] = React.useState((initialData?.discount_value ?? 0) > 0);
    const [activeRow, setActiveRow] = React.useState<number | null>(null);
    const [template, setTemplate] = React.useState<string>(() => readPref('invoice.preview.template', 'kisantra-invoice'));
    const [zoom, setZoom] = React.useState<PaperZoom>('fit');
    const [showPreview, setShowPreview] = React.useState(() => readPref('invoice.preview.visible', '1') === '1');
    const [sheetOpen, setSheetOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState<'draft' | 'publish' | null>(null);
    const serviceInputs = React.useRef<(HTMLInputElement | null)[]>([]);
    const focusRow = React.useRef<number | null>(null);

    const previewPayload = { ...toPayload(data, multiClient), template, invoice_id: invoice?.id ?? null, highlight: activeRow };
    const preview = useLivePreview(previewPayload, showPreview || sheetOpen);

    const selectedClient = clients.find((c) => c.id === data.client_id);
    const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));

    /* ── angka (sama dengan InvoiceController::buildInvoiceData) ── */
    const amounts = data.items.map((i) => Math.round(i.unit_price * parseQty(i.quantity)));
    const subtotal = amounts.reduce((a, b) => a + b, 0);
    const deposits = data.items.reduce((s, i, idx) => s + (i.is_tax_deposit ? amounts[idx] : 0), 0);
    const discount = data.discount_type === 'percentage' ? Math.round((subtotal * (data.discount_value || 0)) / 100) : data.discount_value || 0;
    const total = Math.max(0, subtotal - discount);
    const cogs = data.items.reduce((s, i) => s + (i.is_tax_deposit ? 0 : i.cogs_amount || 0), 0);
    const grossProfit = total - deposits - cogs;
    const pph = Math.round((total - deposits) * 0.005);
    const termDays = data.issue_date && data.due_date
        ? Math.round((toDate(data.due_date)!.getTime() - toDate(data.issue_date)!.getTime()) / 86_400_000)
        : null;

    /* ── item ── */
    const updateItem = (idx: number, patch: Partial<ItemRow>) =>
        setData('items', data.items.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

    const addItem = (patch: Partial<ItemRow> = {}) => {
        focusRow.current = data.items.length;
        setData('items', [...data.items, { ...emptyItem(), client_id: multiClient ? data.client_id : null, ...patch }]);
    };

    const removeItem = (idx: number) => {
        setData('items', data.items.filter((_, i) => i !== idx));
        setActiveRow(null);
    };

    React.useEffect(() => {
        if (focusRow.current == null) return;
        serviceInputs.current[focusRow.current]?.focus();
        focusRow.current = null;
    }, [data.items.length]);

    const onServiceName = (idx: number, name: string) => {
        const match = services.find((s) => s.name === name);
        updateItem(idx, { service_name: name, ...(match && !data.items[idx].unit_price ? { unit_price: match.price } : {}) });
    };

    const toggleMultiClient = (on: boolean) => {
        setMultiClient(on);
        setData('items', data.items.map((i) => ({ ...i, client_id: on ? i.client_id ?? data.client_id : null })));
    };

    /* ── simpan ── */
    const submit = (publish: boolean) => {
        setSubmitting(publish ? 'publish' : 'draft');
        form.transform((d) => ({ ...toPayload(d, multiClient), publish }));
        const options: Parameters<typeof form.post>[1] = {
            preserveScroll: true,
            onSuccess: (page) => {
                const message = (page.props.flash as { success?: string } | undefined)?.success;
                toast.success(message ?? (publish ? 'Invoice diterbitkan.' : 'Invoice disimpan.'));
            },
            onError: (errs) => toastErrors(errs as Record<string, string>, isEdit ? 'UpdateInvoice' : 'CreateInvoice'),
            onFinish: () => setSubmitting(null),
        };
        if (isEdit) form.put(`/invoices/${invoice.id}`, options);
        else form.post('/invoices', options);
    };

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                addItem();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const errorCount = Object.keys(errors).length;
    const itemError = (idx: number, field: keyof ItemRow) => (errors as Record<string, string>)[`items.${idx}.${field}`];

    const togglePreview = () => {
        setShowPreview((v) => {
            writePref('invoice.preview.visible', v ? '0' : '1');
            return !v;
        });
    };

    const number = isEdit && invoice.invoice_number ? invoice.invoice_number : preview.number;

    const previewPanel = (
        <PreviewPanel
            preview={preview}
            activeRow={activeRow}
            template={template}
            onTemplate={(t) => {
                setTemplate(t);
                writePref('invoice.preview.template', t);
            }}
            zoom={zoom}
            onZoom={setZoom}
        />
    );

    return (
        <>
            <Head title={isEdit ? 'Edit Invoice' : 'Buat Invoice'} />
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submit(false);
                }}
                className="flex flex-col gap-6 pt-1"
            >
                {/* ── judul + aksi ── */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                        <Button asChild variant="outline" className={BTN.icon}>
                            <Link href={isEdit ? `/invoices/${invoice.id}` : '/invoices'} aria-label="Kembali">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div className="min-w-0">
                            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">
                                {isEdit ? 'Edit Invoice' : 'Buat Invoice'}
                            </h1>
                            <p className="text-[13px] text-ob-ink-2">
                                {isDraft ? 'Simpan sebagai draft, atau langsung terbitkan dengan nomor.' : `Perubahan tersimpan pada ${invoice?.invoice_number}.`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="ghost" className={cn(BTN.ghost, 'hidden min-[1360px]:inline-flex')} onClick={togglePreview} icon={showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}>
                            {showPreview ? 'Sembunyikan pratinjau' : 'Tampilkan pratinjau'}
                        </Button>
                        <Button type="button" variant="ghost" className={cn(BTN.ghost, 'min-[1360px]:hidden')} onClick={() => setSheetOpen(true)} icon={<Eye className="h-4 w-4" />}>
                            Pratinjau
                        </Button>
                        {isDraft ? (
                            <>
                                <Button type="submit" variant="outline" className={BTN.secondary} loading={submitting === 'draft'} disabled={processing}>
                                    Simpan draft
                                </Button>
                                <Button type="button" variant="primary" className={BTN.primary} loading={submitting === 'publish'} disabled={processing} onClick={() => submit(true)} icon={<Send className="h-4 w-4" />}>
                                    Simpan &amp; terbitkan
                                </Button>
                            </>
                        ) : (
                            <Button type="submit" variant="primary" className={BTN.primary} loading={processing}>
                                Simpan perubahan
                            </Button>
                        )}
                    </div>
                </div>

                {errorCount > 0 && (
                    <div role="alert" className="flex items-center gap-2 rounded-2xl border border-ob-late/35 bg-ob-late/10 px-4 py-3 text-[13px] text-ob-ink">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ob-late/15 text-xs font-bold text-ob-late">!</span>
                        <span>
                            <b className="font-semibold text-ob-late">{errorCount} isian perlu diperbaiki</b> sebelum invoice disimpan.
                        </span>
                    </div>
                )}

                <div className={cn('grid items-start gap-6', showPreview && 'min-[1360px]:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]')}>
                    <div className={cn('flex min-w-0 flex-col gap-6', !showPreview && 'mx-auto w-full max-w-[880px]')}>
                        {/* ── detail ── */}
                        <section aria-labelledby="inv-detail" className={cn(CARD, 'flex flex-col gap-4')}>
                            <div className="flex h-8 items-center justify-between gap-3">
                                <h2 id="inv-detail" className="text-base font-semibold text-ob-ink">Detail invoice</h2>
                                <span className="inline-flex h-8 max-w-full items-center gap-2 truncate rounded-full border border-ob-line bg-ob-inner px-3 font-mono text-xs text-ob-ink">
                                    {number ?? 'nomor diberikan saat terbit'}
                                    {isDraft && number && <span className="font-sans text-ob-ink-3">perkiraan</span>}
                                </span>
                            </div>
                            <div className={cn(FIELD, 'grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]')}>
                                <Combobox
                                    label="Klien"
                                    options={clientOptions}
                                    value={data.client_id}
                                    onChange={(v) => setData('client_id', v ? Number(v) : null)}
                                    placeholder="Pilih klien"
                                    searchPlaceholder="Cari klien..."
                                    emptyText="Klien tidak ditemukan"
                                    clearable={false}
                                    error={errors.client_id}
                                />
                                <DatePicker
                                    label="Tanggal invoice"
                                    value={toDate(data.issue_date)}
                                    onChange={(d) => setData('issue_date', d ? format(d, 'yyyy-MM-dd') : '')}
                                    clearable={false}
                                    error={errors.issue_date}
                                />
                                <DatePicker
                                    label={termDays != null && termDays >= 0 ? `Jatuh tempo · ${termDays} hari` : 'Jatuh tempo'}
                                    value={toDate(data.due_date)}
                                    onChange={(d) => setData('due_date', d ? format(d, 'yyyy-MM-dd') : '')}
                                    minDate={toDate(data.issue_date) ?? undefined}
                                    clearable={false}
                                    error={errors.due_date}
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ob-ink-2">
                                <span className="min-w-0 truncate">
                                    {selectedClient
                                        ? [selectedClient.email, selectedClient.npwp && `NPWP ${selectedClient.npwp}`].filter(Boolean).join(' · ') || 'Klien belum punya email atau NPWP'
                                        : 'Email dan NPWP klien tampil di sini.'}
                                </span>
                                <label className="inline-flex cursor-pointer items-center gap-2.5 text-ob-ink">
                                    <Switch checked={multiClient} onCheckedChange={toggleMultiClient} />
                                    Tagih ke beberapa klien
                                </label>
                            </div>
                        </section>

                        {/* ── item ── */}
                        <section aria-labelledby="inv-items" className={cn(CARD, 'flex flex-col gap-3')}>
                            <div className="flex h-8 items-center">
                                <h2 id="inv-items" className="flex items-baseline gap-2 text-base font-semibold text-ob-ink">
                                    Item <span className="text-[13px] font-medium text-ob-ink-2">{data.items.length} item</span>
                                </h2>
                            </div>
                            {errors.items && <p className="text-xs text-ob-late">{errors.items}</p>}

                            {data.items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ob-line-strong px-4 py-8 text-center">
                                    <span className="text-[13px] font-semibold text-ob-ink">Belum ada item</span>
                                    <span className="max-w-[320px] text-xs leading-relaxed text-ob-ink-2">
                                        Tambah baris, lalu pilih layanan dari katalog atau ketik nama layanan sendiri.
                                    </span>
                                    <Button type="button" variant="outline" className={BTN.small} onClick={() => addItem()} icon={<Plus className="h-3.5 w-3.5" />}>
                                        Tambah baris
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div aria-hidden="true" className="hidden grid-cols-[20px_minmax(0,1fr)_56px_132px_108px] gap-2 px-3 text-xs font-medium text-ob-ink-3 sm:grid">
                                        <span />
                                        <span>Layanan</span>
                                        <span className="text-right">Qty</span>
                                        <span className="text-right">Harga satuan</span>
                                        <span className="text-right">Subtotal</span>
                                    </div>
                                    <ol className="flex flex-col gap-2.5">
                                        {data.items.map((item, idx) => (
                                            <ItemEditorRow
                                                key={idx}
                                                index={idx}
                                                item={item}
                                                amount={amounts[idx]}
                                                active={activeRow === idx}
                                                multiClient={multiClient}
                                                clientOptions={clientOptions}
                                                services={services}
                                                canRemove={data.items.length > 1}
                                                error={(f) => itemError(idx, f)}
                                                inputRef={(el) => (serviceInputs.current[idx] = el)}
                                                onFocus={() => setActiveRow(idx)}
                                                onChange={(patch) => updateItem(idx, patch)}
                                                onServiceName={(name) => onServiceName(idx, name)}
                                                onRemove={() => removeItem(idx)}
                                            />
                                        ))}
                                    </ol>
                                    <button
                                        type="button"
                                        onClick={() => addItem()}
                                        className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-ob-line-strong text-[13px] font-semibold text-ob-ink hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                    >
                                        <Plus className="h-4 w-4" /> Tambah baris
                                        <kbd className="font-sans text-xs font-medium text-ob-ink-3">Ctrl+Enter</kbd>
                                    </button>
                                </>
                            )}
                        </section>

                        {/* ── penyesuaian + total ── */}
                        <section aria-label="Penyesuaian dan total" className={cn(CARD, 'grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')}>
                            <div className="flex flex-col gap-3">
                                <span className="text-[13px] font-semibold text-ob-ink-2">Penyesuaian</span>
                                {discountOpen ? (
                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex items-center gap-2">
                                            <SegmentedControl
                                                variant="pill"
                                                label="Jenis diskon"
                                                options={[
                                                    { value: 'fixed', label: 'Nominal' },
                                                    { value: 'percentage', label: 'Persen' },
                                                ]}
                                                value={data.discount_type}
                                                onChange={(v) => setData((d) => ({ ...d, discount_type: v, discount_value: 0 }))}
                                                className="[&>label]:sr-only"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="h-8 w-8 shrink-0 rounded-full p-0 text-ob-ink-3 hover:bg-ob-hover hover:text-ob-ink dark:hover:bg-ob-hover"
                                                aria-label="Hapus diskon"
                                                onClick={() => {
                                                    setData((d) => ({ ...d, discount_value: 0, discount_reason: '' }));
                                                    setDiscountOpen(false);
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className={cn(FIELD_SM, 'flex flex-col gap-2.5')}>
                                        {data.discount_type === 'fixed' ? (
                                            <CurrencyInput value={data.discount_value} onChange={(v) => setData('discount_value', v)} error={errors.discount_value} />
                                        ) : (
                                            <Input
                                                inputMode="decimal"
                                                value={data.discount_value ? String(data.discount_value) : ''}
                                                onChange={(e) => setData('discount_value', Math.min(100, parseFloat(e.target.value.replace(',', '.')) || 0))}
                                                placeholder="0"
                                                iconRight={<span className="text-xs">%</span>}
                                                error={errors.discount_value}
                                                aria-label="Persen diskon"
                                            />
                                        )}
                                        <Input
                                            value={data.discount_reason}
                                            onChange={(e) => setData('discount_reason', e.target.value)}
                                            placeholder="Alasan diskon (tercetak di invoice)"
                                            aria-label="Alasan diskon"
                                            error={errors.discount_reason}
                                        />
                                        </div>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => setDiscountOpen(true)} className="flex flex-col items-start gap-1.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill">
                                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ob-ink">
                                            <Tag className="h-4 w-4" /> Tambah diskon
                                        </span>
                                        <span className="text-[13px] leading-relaxed text-ob-ink-2">Nominal atau persen dari subtotal, dengan alasan yang tercetak di invoice.</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5 sm:border-l sm:border-ob-line sm:pl-6">
                                <SumRow label="Subtotal layanan" value={rp(subtotal - deposits)} />
                                {deposits > 0 && <SumRow label="Titipan pajak" value={rp(deposits)} />}
                                <SumRow label={data.discount_type === 'percentage' && data.discount_value ? `Diskon ${data.discount_value}%` : 'Diskon'} value={discount > 0 ? `− ${rp(discount)}` : '—'} />
                                <div className="my-1.5 border-t border-ob-line" />
                                <SumRow label="Total" value={rp(total)} strong />
                                <p className="text-[13px] text-ob-ink-2">
                                    Laba kotor <b className={cn('font-semibold', grossProfit >= 0 ? 'text-ob-pos' : 'text-ob-late')}>{rp(grossProfit)}</b>
                                    <span className="mx-1.5 text-ob-ink-3">·</span>
                                    Est. PPh <b className="font-semibold text-ob-ink">{rp(pph)}</b>
                                </p>
                            </div>
                        </section>
                    </div>

                    {showPreview && <aside className="sticky top-4 hidden min-w-0 min-[1360px]:block">{previewPanel}</aside>}
                </div>
            </form>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent size="3xl" hideClose className={cn(SURFACE, 'overflow-y-auto p-4 sm:p-6')}>
                    <div className="mb-3 flex items-center justify-between">
                        <SheetTitle className="text-base font-semibold text-ob-ink dark:text-ob-ink">Pratinjau cetak</SheetTitle>
                        <Button type="button" variant="outline" className={BTN.icon} aria-label="Tutup pratinjau" onClick={() => setSheetOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {previewPanel}
                </SheetContent>
            </Sheet>
        </>
    );
}

/* ─────────────────────────────────── baris item ─── */

function ItemEditorRow({
    index,
    item,
    amount,
    active,
    multiClient,
    clientOptions,
    services,
    canRemove,
    error,
    inputRef,
    onFocus,
    onChange,
    onServiceName,
    onRemove,
}: {
    index: number;
    item: ItemRow;
    amount: number;
    active: boolean;
    multiClient: boolean;
    clientOptions: { value: number; label: string }[];
    services: ServiceOption[];
    canRemove: boolean;
    error: (field: keyof ItemRow) => string | undefined;
    inputRef: (el: HTMLInputElement | null) => void;
    onFocus: () => void;
    onChange: (patch: Partial<ItemRow>) => void;
    onServiceName: (name: string) => void;
    onRemove: () => void;
}) {
    const listId = `svc-list-${index}`;
    const unitListId = `unit-list-${index}`;
    const messages = [error('service_name'), error('quantity'), error('unit_price'), error('cogs_amount'), error('client_id')].filter(Boolean);

    return (
        <li
            onFocusCapture={onFocus}
            className={cn(
                'flex flex-col gap-2.5 rounded-2xl border bg-ob-inner/60 p-3 transition-colors',
                item.is_tax_deposit ? 'border-dashed border-ob-line-strong' : 'border-ob-line',
                active && 'border-ob-act-fill/60',
            )}
        >
            <div className={cn(FIELD_SM, 'grid grid-cols-[20px_minmax(0,1fr)_64px] gap-2 sm:grid-cols-[20px_minmax(0,1fr)_56px_132px_108px] sm:items-center')}>
                <span className="self-center text-center text-xs font-semibold text-ob-ink-3">{index + 1}</span>
                <div className="flex min-w-0 items-center gap-1.5">
                    <Input
                        ref={inputRef}
                        list={listId}
                        value={item.service_name}
                        onChange={(e) => onServiceName(e.target.value)}
                        placeholder="Nama layanan"
                        aria-label={`Layanan baris ${index + 1}`}
                        aria-invalid={!!error('service_name')}
                        icon={item.is_tax_deposit ? <ReceiptText className="h-4 w-4" /> : undefined}
                        className={cn('bg-ob-card', error('service_name') && 'border-ob-late')}
                    />
                    <CatalogPicker
                        services={services}
                        label={`Pilih layanan baris ${index + 1} dari katalog`}
                        onPick={(svc) => onChange({ service_name: svc.name, unit_price: svc.price })}
                    />
                </div>
                <datalist id={listId}>
                    {services.map((s) => (
                        <option key={s.id} value={s.name} />
                    ))}
                </datalist>
                <Input
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => onChange({ quantity: e.target.value })}
                    placeholder="1"
                    aria-label={`Qty baris ${index + 1}`}
                    title="Pemisah desimal titik atau koma, mis. 1,5"
                    className={cn('bg-ob-card text-right', error('quantity') && 'border-ob-late')}
                />
                <div className="col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto">
                    <CurrencyInput value={item.unit_price} onChange={(v) => onChange({ unit_price: v })} className={cn('w-full min-w-0 bg-ob-card text-right', error('unit_price') && 'border-ob-late')} id={`price-${index}`} />
                </div>
                <span className="col-start-2 whitespace-nowrap text-sm font-semibold text-ob-ink sm:col-start-auto sm:text-right">{rp(amount)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7 text-[13px] text-ob-ink-2">
                <label className="inline-flex items-center gap-2">
                    Satuan
                    <span className={cn(FIELD_SM, 'w-24')}>
                        <Input list={unitListId} value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="—" className="bg-ob-card" aria-label={`Satuan baris ${index + 1}`} />
                    </span>
                    <datalist id={unitListId}>
                        {COMMON_UNITS.map((u) => (
                            <option key={u} value={u} />
                        ))}
                    </datalist>
                </label>
                {!item.is_tax_deposit && (
                    <label className="inline-flex items-center gap-2" title="HPP untuk seluruh baris ini, bukan per unit">
                        HPP baris
                        <span className={cn(FIELD_SM, 'w-36')}>
                            <CurrencyInput value={item.cogs_amount} onChange={(v) => onChange({ cogs_amount: v })} className="w-full min-w-0 bg-ob-card" id={`cogs-${index}`} />
                        </span>
                    </label>
                )}
                {multiClient && (
                    <span className={cn(FIELD_SM, 'w-48')}>
                        <Combobox
                            options={clientOptions}
                            value={item.client_id}
                            onChange={(v) => onChange({ client_id: v ? Number(v) : null })}
                            placeholder="Klien baris ini"
                            searchPlaceholder="Cari klien..."
                            clearable={false}
                            popoverWidth="w-64"
                        />
                    </span>
                )}
                <span className="ml-auto inline-flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-ob-ink">
                        <Switch checked={item.is_tax_deposit} onCheckedChange={(on) => onChange({ is_tax_deposit: on, ...(on ? { cogs_amount: 0 } : {}) })} />
                        Titipan pajak
                    </label>
                    {canRemove && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onRemove}
                            aria-label={`Hapus baris ${index + 1}`}
                            className="h-8 w-8 rounded-full p-0 text-ob-ink-3 hover:bg-ob-late/10 hover:text-ob-late dark:hover:bg-ob-late/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </span>
            </div>

            {item.is_tax_deposit && <p className="pl-7 text-[13px] text-ob-ink-2">Ditagihkan tetapi tidak dihitung pendapatan, HPP, atau dasar PPh.</p>}
            {messages.length > 0 && (
                <ul className="pl-7 text-xs text-ob-late">
                    {messages.map((m) => (
                        <li key={m}>{m}</li>
                    ))}
                </ul>
            )}
        </li>
    );
}

/* ─────────────────────────────────── katalog ─── */

/** Tombol katalog per baris: mengisi nama & harga baris itu saja. */
function CatalogPicker({ services, label, onPick }: { services: ServiceOption[]; label: string; onPick: (svc: ServiceOption) => void }) {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState('');
    const list = q ? services.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : services;

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    aria-label={label}
                    title="Dari katalog"
                    className="w-[34px] shrink-0 rounded-xl p-0 text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink dark:hover:bg-ob-hover"
                >
                    <Search className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 overflow-hidden rounded-2xl border-ob-line bg-ob-card p-0 dark:border-ob-line dark:bg-ob-card">
                <div className={cn(FIELD_SM, 'border-b border-ob-line p-2')}>
                    <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari layanan..." icon={<Search className="h-3.5 w-3.5" />} aria-label="Cari layanan" />
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                    {list.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-ob-ink-2">Layanan tidak ditemukan</p>
                    ) : (
                        list.map((svc) => (
                            <button
                                key={svc.id}
                                type="button"
                                onClick={() => {
                                    onPick(svc);
                                    setOpen(false);
                                    setQ('');
                                }}
                                className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ob-hover focus-visible:bg-ob-hover focus-visible:outline-none"
                            >
                                <span className="truncate text-[13px] font-medium text-ob-ink">{svc.name}</span>
                                <span className="shrink-0 text-xs text-ob-ink-2">{rp(svc.price)}</span>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/* ─────────────────────────────────── panel pratinjau ─── */

function PreviewPanel({
    preview,
    activeRow,
    template,
    onTemplate,
    zoom,
    onZoom,
}: {
    preview: PreviewState & { retry: () => void };
    activeRow: number | null;
    template: string;
    onTemplate: (t: string) => void;
    zoom: PaperZoom;
    onZoom: (z: PaperZoom) => void;
}) {
    return (
        <section aria-label="Pratinjau cetak" className="flex max-h-[calc(100vh-7rem)] flex-col gap-3 rounded-3xl border border-ob-line bg-ob-card p-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ob-ink">
                    Pratinjau cetak
                    <span aria-live="polite" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ob-ink-2">
                        <span className={cn('h-1.5 w-1.5 rounded-full', preview.error ? 'bg-ob-late' : preview.loading ? 'bg-ob-ink-3' : 'bg-ob-pos')} />
                        {preview.error ? 'gagal dimuat' : preview.loading ? 'memperbarui…' : activeRow != null ? `baris ${activeRow + 1} disorot` : 'terbaru'}
                    </span>
                </p>
                <div className="flex items-center gap-2">
                    <div className={cn(FIELD_SM, 'w-32')}>
                        <Combobox options={TEMPLATES} value={template} onChange={(v) => v && onTemplate(String(v))} clearable={false} popoverWidth="w-44" />
                    </div>
                    <SegmentedControl variant="pill" label="Zoom kertas" options={ZOOM_OPTIONS} value={zoom} onChange={onZoom} className="w-auto [&>label]:sr-only [&_button]:h-7 [&_button]:text-xs" />
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-ob-inner p-3">
                {preview.error && !preview.url ? (
                    <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
                        <span className="text-[13px] font-semibold text-ob-ink">Pratinjau tidak dapat dimuat</span>
                        <span className="max-w-[280px] text-xs text-ob-ink-2">{preview.error}</span>
                        <Button type="button" variant="outline" className={BTN.small} onClick={preview.retry}>
                            Coba lagi
                        </Button>
                    </div>
                ) : (
                    <InvoicePaper src={preview.url} zoom={zoom} stale={preview.loading && !!preview.url} />
                )}
            </div>
            <p className="text-xs leading-relaxed text-ob-ink-2">
                Ini PDF yang sama persis dengan hasil unduhan{activeRow != null ? '; sorotan biru hanya ada di pratinjau' : ''}.{preview.error && preview.url ? ` Pembaruan terakhir gagal: ${preview.error}` : ''}
            </p>
        </section>
    );
}

/* ─────────────────────────────────── halaman ─── */

function CreateInvoicePage({ clients, services }: SharedProps & { clients: ClientOption[]; services: ServiceOption[] }) {
    return <InvoiceEditor clients={clients} services={services} />;
}

CreateInvoicePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default CreateInvoicePage;
