import { CheckCircle2, FileText, Printer, Wallet } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { SegmentedOption } from '@/components/ui/segmented-control';
import { CurrencyInput } from '@/components/shared/currency-input';
import { companyUrl } from '@/lib/company';
import { formatCurrency } from '@/lib/utils';

type PrintType = 'full' | 'dp' | 'pelunasan';

interface CustomTemplate {
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

const BUILTIN_OPTIONS: ComboboxOption[] = [
    { value: 'kisantra-invoice', label: 'Kisantra', description: 'Template default' },
    { value: 'semesta-invoice', label: 'Semesta', description: 'Mining (PPN + PPH 22)' },
    { value: 'agsa-invoice', label: 'AGSA', description: 'Alternatif' },
    { value: 'invoice', label: 'Generic', description: 'Sederhana' },
];

/** Build grouped flat option list for the Combobox. */
function buildTemplateOptions(customTemplates: CustomTemplate[]): ComboboxOption[] {
    const opts: ComboboxOption[] = [
        { value: '__group_bawaan__', label: 'Bawaan', disabled: true },
        ...BUILTIN_OPTIONS,
    ];
    if (customTemplates.length > 0) {
        opts.push({ value: '__group_kustom__', label: 'Kustom', disabled: true });
        for (const t of customTemplates) {
            opts.push({
                value: `builder:${t.id}`,
                label: t.name,
                description: t.isDefault ? 'Default' : undefined,
            });
        }
    }
    return opts;
}

export function PrintInvoiceDialog({
    open,
    onOpenChange,
    invoiceId,
    invoiceNumber,
    totalAmount,
    amountPaid,
    customTemplates = [],
}: Props) {
    const remaining = totalAmount - amountPaid;
    const settlementAvailable = amountPaid > 0 && remaining > 0;

    const defaultTemplate = React.useMemo(() => {
        // Keep kisantra as the dialog default; only pre-select the builder default
        // if the user explicitly set one AND there are no builtin templates as fallback —
        // per locked decision: "keep current default (kisantra) as the dialog default".
        return 'kisantra-invoice';
    }, []);

    const [printType, setPrintType] = React.useState<PrintType>('full');
    const [dpAmount, setDpAmount] = React.useState(0);
    const [template, setTemplate] = React.useState(defaultTemplate);
    const [dpError, setDpError] = React.useState('');

    const templateOptions = React.useMemo(
        () => buildTemplateOptions(customTemplates),
        [customTemplates],
    );

    /* reset on open */
    React.useEffect(() => {
        if (open) {
            setPrintType('full');
            setDpAmount(0);
            setTemplate(defaultTemplate);
            setDpError('');
        }
    }, [open, defaultTemplate]);

    const typeOptions = React.useMemo<SegmentedOption<PrintType>[]>(() => {
        const base: SegmentedOption<PrintType>[] = [
            { value: 'full', label: 'Penuh', icon: <FileText className="w-4 h-4" /> },
            { value: 'dp', label: 'Uang Muka', icon: <Wallet className="w-4 h-4" /> },
        ];
        if (settlementAvailable) {
            base.push({
                value: 'pelunasan',
                label: 'Pelunasan',
                icon: <CheckCircle2 className="w-4 h-4" />,
            });
        }
        return base;
    }, [settlementAvailable]);

    const buildQuery = (): string | null => {
        const params = new URLSearchParams({ template });
        if (printType === 'dp') {
            if (!dpAmount || dpAmount <= 0 || dpAmount > totalAmount) {
                setDpError('Nominal DP tidak valid (harus > 0 dan ≤ total invoice)');
                return null;
            }
            params.set('dp_amount', String(dpAmount));
        } else if (printType === 'pelunasan') {
            if (remaining <= 0) return null;
            params.set('pelunasan_amount', String(remaining));
        }
        return params.toString();
    };

    const handlePreview = () => {
        const query = buildQuery();
        if (query === null) return;
        window.open(companyUrl(`/invoice/${invoiceId}/preview?${query}`), '_blank');
        onOpenChange(false);
    };

    const handleDownload = () => {
        const query = buildQuery();
        if (query === null) return;
        const link = document.createElement('a');
        link.href = companyUrl(`/invoice/${invoiceId}/download?${query}`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="md">
                <DialogHeader>
                    <div className="flex items-center gap-4 py-2">
                        <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                            <Printer className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <DialogTitle>Cetak Invoice</DialogTitle>
                            <p className="text-sm text-dark-600 dark:text-dark-400">
                                {invoiceNumber
                                    ? `Pilih tipe & template untuk ${invoiceNumber}`
                                    : 'Pilih tipe & template invoice'}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-5 space-y-5">
                    {/* Print type */}
                    <SegmentedControl<PrintType>
                        label="Tipe Invoice"
                        options={typeOptions}
                        value={printType}
                        onChange={setPrintType}
                        columns={typeOptions.length as 2 | 3}
                    />

                    {/* Contextual panel */}
                    <div className="rounded-xl border border-secondary-200 dark:border-dark-600 p-4 space-y-3">
                        {printType === 'full' && (
                            <Row label="Total Invoice" value={formatCurrency(totalAmount)} strong />
                        )}

                        {printType === 'dp' && (
                            <>
                                <CurrencyInput
                                    label="Nominal Uang Muka (DP) *"
                                    value={dpAmount}
                                    onChange={(v) => {
                                        setDpAmount(v);
                                        if (dpError) setDpError('');
                                    }}
                                    error={dpError}
                                    placeholder="0"
                                />
                                <div className="pt-1 space-y-2 text-sm">
                                    <Row label="Total Invoice" value={formatCurrency(totalAmount)} />
                                    <Row
                                        label="Sisa setelah DP"
                                        value={formatCurrency(Math.max(totalAmount - dpAmount, 0))}
                                        accent="red"
                                    />
                                </div>
                            </>
                        )}

                        {printType === 'pelunasan' && (
                            <div className="space-y-2 text-sm">
                                <Row label="Total Invoice" value={formatCurrency(totalAmount)} />
                                <Row
                                    label="Sudah dibayar"
                                    value={formatCurrency(amountPaid)}
                                    accent="green"
                                />
                                <div className="border-t border-dashed border-secondary-200 dark:border-dark-600 pt-2">
                                    <Row
                                        label="Total Pelunasan"
                                        value={formatCurrency(remaining)}
                                        strong
                                        accent="red"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Template — grouped: Bawaan + Kustom */}
                    <Combobox
                        label="Template"
                        options={templateOptions}
                        value={template}
                        onChange={(v) => setTemplate((v as string) ?? defaultTemplate)}
                        clearable={false}
                    />
                </div>

                <DialogFooter>
                    <Button variant="zinc" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    <Button
                        variant="outline"
                        icon={<FileText className="w-4 h-4" />}
                        onClick={handleDownload}
                    >
                        Unduh PDF
                    </Button>
                    <Button
                        variant="primary"
                        icon={<Printer className="w-4 h-4" />}
                        onClick={handlePreview}
                    >
                        Preview
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Row({
    label,
    value,
    strong,
    accent,
}: {
    label: string;
    value: string;
    strong?: boolean;
    accent?: 'red' | 'green';
}) {
    const valueColor =
        accent === 'red'
            ? 'text-red-600 dark:text-red-400'
            : accent === 'green'
              ? 'text-green-600 dark:text-green-400'
              : 'text-dark-900 dark:text-dark-50';
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-dark-500 dark:text-dark-400">{label}</span>
            <span className={`tabular-nums ${strong ? 'text-base font-bold' : 'font-medium'} ${valueColor}`}>
                {value}
            </span>
        </div>
    );
}
