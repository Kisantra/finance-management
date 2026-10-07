import { Download, ExternalLink, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CurrencyInput } from '@/components/shared/currency-input';
import { cn } from '@/lib/utils';
import { InvoicePaper, type PaperZoom } from './invoice-paper';
import { BTN, FIELD, rp, SumRow, SURFACE } from './ob';

type PrintType = 'full' | 'dp' | 'pelunasan';

export interface CustomTemplate {
    id: number;
    name: string;
    isDefault: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceId: number;
    invoiceNumber: string | null;
    totalAmount: number;
    amountPaid: number;
    customTemplates?: CustomTemplate[];
}

/* Warna strip mini = aksen masing-masing template PDF, supaya kartu mudah dikenali. */
const BUILTIN = [
    { value: 'kisantra-invoice', label: 'Kisantra', accent: '#42b2cc' },
    { value: 'semesta-invoice', label: 'Semesta', accent: '#1f2937' },
    { value: 'agsa-invoice', label: 'AGSA', accent: '#c2410c' },
    { value: 'invoice', label: 'Generik', accent: '#64748b' },
];

export function PrintInvoiceDialog({ open, onOpenChange, invoiceId, invoiceNumber, totalAmount, amountPaid, customTemplates = [] }: Props) {
    const remaining = totalAmount - amountPaid;
    const settlementAvailable = amountPaid > 0 && remaining > 0;

    const [printType, setPrintType] = React.useState<PrintType>('full');
    const [dpAmount, setDpAmount] = React.useState(0);
    const [template, setTemplate] = React.useState('kisantra-invoice');
    const [zoom, setZoom] = React.useState<PaperZoom>('fit');

    React.useEffect(() => {
        if (open) {
            setPrintType(settlementAvailable ? 'pelunasan' : 'full');
            setDpAmount(0);
            setTemplate('kisantra-invoice');
        }
    }, [open, settlementAvailable]);

    const dpError = printType === 'dp' && (dpAmount <= 0 || dpAmount > totalAmount) ? 'Isi nominal DP lebih dari 0 dan tidak melebihi total.' : null;

    const query = React.useMemo(() => {
        const params = new URLSearchParams({ template });
        if (printType === 'dp' && dpAmount > 0 && dpAmount <= totalAmount) params.set('dp_amount', String(dpAmount));
        if (printType === 'pelunasan') params.set('pelunasan_amount', String(remaining));
        return params.toString();
    }, [template, printType, dpAmount, totalAmount, remaining]);


    const typeOptions = [
        { value: 'full' as const, label: 'Penuh' },
        { value: 'dp' as const, label: 'Uang muka' },
        ...(settlementAvailable ? [{ value: 'pelunasan' as const, label: 'Pelunasan' }] : []),
    ];

    const templates = [
        ...BUILTIN,
        ...customTemplates.map((t) => ({ value: `builder:${t.id}`, label: t.name, accent: '#7c3aed' })),
    ];

    // Nominal DP diketik per digit: tunda render PDF sampai ketikan berhenti.
    const [debouncedQuery, setDebouncedQuery] = React.useState(query);
    React.useEffect(() => {
        const t = window.setTimeout(() => setDebouncedQuery(query), 400);
        return () => window.clearTimeout(t);
    }, [query]);

    const download = () => {
        const link = document.createElement('a');
        link.href = `/invoice/${invoiceId}/download?${query}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="full" hideClose className={cn(SURFACE, 'mx-auto max-w-[1080px] rounded-3xl p-0')}>
                <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                    <div className="flex flex-col gap-5 p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <DialogTitle className="text-xl font-semibold text-ob-ink dark:text-ob-ink">Cetak invoice</DialogTitle>
                                <DialogDescription className="mt-1 font-mono text-[13px] text-ob-ink-2 dark:text-ob-ink-2">{invoiceNumber ?? 'Draft'}</DialogDescription>
                            </div>
                            <Button variant="outline" className={cn(BTN.icon, 'h-8 w-8 shrink-0')} onClick={() => onOpenChange(false)} aria-label="Tutup">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <SegmentedControl
                            variant="pill"
                            label="Jenis tagihan"
                            options={typeOptions}
                            value={printType}
                            onChange={setPrintType}
                            className="[&>label]:text-[13px] [&>label]:text-ob-ink-2 dark:[&>label]:text-ob-ink-2"
                        />

                        <div className="flex flex-col gap-1.5 rounded-2xl border border-ob-line bg-ob-inner p-4">
                            <SumRow label="Total invoice" value={rp(totalAmount)} />
                            {printType === 'dp' && (
                                <>
                                    <div className={cn(FIELD, 'my-1')}>
                                        <CurrencyInput label="Nominal uang muka" value={dpAmount} onChange={setDpAmount} error={dpAmount > 0 ? dpError ?? undefined : undefined} />
                                    </div>
                                    <SumRow label="Sisa setelah DP" value={rp(Math.max(totalAmount - dpAmount, 0))} />
                                </>
                            )}
                            {printType === 'pelunasan' && (
                                <>
                                    <SumRow label="Sudah dibayar" value={rp(amountPaid)} />
                                    <SumRow label="Tagihan pelunasan" value={rp(remaining)} strong />
                                </>
                            )}
                        </div>
                        {printType === 'dp' && <p className="-mt-3 text-[13px] text-ob-ink-2">Uang muka: isi nominal DP (lebih dari 0, tidak melebihi total).</p>}

                        <div>
                            <p className="mb-2 text-[13px] font-medium text-ob-ink-2">Template</p>
                            <div role="radiogroup" aria-label="Template" className="grid grid-cols-4 gap-2.5">
                                {templates.map((t) => {
                                    const on = template === t.value;
                                    return (
                                        <button
                                            key={t.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={on}
                                            onClick={() => setTemplate(t.value)}
                                            className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
                                        >
                                            <span
                                                className={cn(
                                                    'flex aspect-[3/4] w-full flex-col gap-1 rounded-xl border-2 bg-white p-1.5 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ob-act-fill',
                                                    on ? 'border-ob-act-fill' : 'border-ob-line hover:border-ob-line-strong',
                                                )}
                                            >
                                                <span className="h-1.5 rounded-sm" style={{ background: t.accent }} />
                                                <span className="h-1 w-2/3 rounded-sm bg-slate-200" />
                                                <span className="mt-1 flex-1 rounded-sm bg-slate-100" />
                                                <span className="ml-auto h-1.5 w-1/2 rounded-sm" style={{ background: t.accent }} />
                                            </span>
                                            <span className={cn('max-w-full truncate text-xs', on ? 'font-semibold text-ob-ink' : 'text-ob-ink-2')}>{t.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-auto flex flex-wrap justify-end gap-2">
                            <Button asChild variant="outline" className={BTN.secondary}>
                                <a href={`/invoice/${invoiceId}/preview?${query}`} target="_blank" rel="noreferrer" aria-disabled={!!dpError} onClick={(e) => dpError && e.preventDefault()}>
                                    <ExternalLink className="h-4 w-4" /> Buka PDF
                                </a>
                            </Button>
                            <Button className={BTN.primary} onClick={download} disabled={!!dpError} icon={<Download className="h-4 w-4" />}>
                                Unduh PDF
                            </Button>
                        </div>
                    </div>

                    <div className="flex min-h-[420px] flex-col gap-3 border-t border-ob-line bg-ob-inner p-5 lg:rounded-r-3xl lg:border-l lg:border-t-0">
                        <div className="flex items-center justify-between text-[13px] text-ob-ink-2">
                            <span>{printType === 'pelunasan' ? 'Pratinjau pelunasan' : printType === 'dp' ? 'Pratinjau uang muka' : 'Pratinjau'}</span>
                            <SegmentedControl variant="pill" label="Zoom kertas" options={[{ value: 'fit' as const, label: 'Pas lebar' }, { value: 'actual' as const, label: '100%' }]} value={zoom} onChange={setZoom} className="w-auto [&>label]:sr-only [&_button]:h-7 [&_button]:text-xs" />
                        </div>
                        <div className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto">
                            {dpError ? (
                                <p className="flex h-full min-h-[320px] items-center justify-center text-center text-[13px] text-ob-ink-2">Isi nominal uang muka untuk melihat pratinjau.</p>
                            ) : (
                                <InvoicePaper src={open ? `/invoice/${invoiceId}/preview?${debouncedQuery}` : null} zoom={zoom} title="Pratinjau cetak" />
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
