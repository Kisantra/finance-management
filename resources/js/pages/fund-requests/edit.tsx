import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/shared/currency-input';
import { FileUpload } from '@/components/shared/file-upload';
import { FormSection } from '@/components/shared/form-section';
import { PageHeader } from '@/components/shared/page-header';
import { AppLayout } from '@/layouts/app-layout';
import { formatCurrency, toLocalIso } from '@/lib/utils';
import * as fundRequestRoutes from '@/routes/fund-requests';
import type { FilterOption, FundRequestItem } from './types';
import { t, tk } from '@/i18n';

interface FundRequestData {
    id: number;
    request_number: string;
    title: string;
    purpose: string;
    priority: string;
    needed_by_date: string;
    attachment_url: string | null;
    attachment_name: string | null;
    status: string;
    items: FundRequestItem[];
}

interface Props {
    fundRequest: FundRequestData;
    categories: FilterOption[];
}

const PRIORITY_OPTIONS = [
    { label: tk('Rendah'), value: 'low' },
    { label: tk('Sedang'), value: 'medium' },
    { label: tk('Tinggi'), value: 'high' },
    { label: tk('Mendesak'), value: 'urgent' },
];

const EMPTY_ITEM = (): FundRequestItem => ({
    description: '',
    category_id: null,
    quantity: 1,
    unit_price: 0,
    amount: 0,
    notes: '',
});

export default function FundRequestsEdit({ fundRequest, categories }: Props) {
    const { data, setData, post, processing, errors } = useForm<{
        title: string;
        purpose: string;
        priority: string;
        needed_by_date: string;
        attachment: File | null;
        remove_attachment: boolean;
        items: FundRequestItem[];
        action: 'draft' | 'submit';
        _method: string;
    }>({
        title: fundRequest.title,
        purpose: fundRequest.purpose,
        priority: fundRequest.priority,
        needed_by_date: fundRequest.needed_by_date,
        attachment: null,
        remove_attachment: false,
        items: fundRequest.items.length > 0 ? fundRequest.items : [EMPTY_ITEM()],
        action: 'draft',
        _method: 'PUT',
    });

    const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const hasExistingAttachment = !!fundRequest.attachment_name && !data.remove_attachment;

    const addItem = () => setData('items', [...data.items, EMPTY_ITEM()]);

    const removeItem = (index: number) => {
        setData('items', data.items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof FundRequestItem, value: string | number | null) => {
        const updated = data.items.map((item, i) => {
            if (i !== index) return item;
            const newItem = { ...item, [field]: value };
            if (field === 'quantity' || field === 'unit_price') {
                newItem.amount = (field === 'quantity' ? Number(value) : item.quantity) *
                    (field === 'unit_price' ? Number(value) : item.unit_price);
            }
            return newItem;
        });
        setData('items', updated);
    };

    const submit = (action: 'draft' | 'submit') => {
        setData('action', action);
        post(fundRequestRoutes.update.url({ fundRequest: fundRequest.id }), { forceFormData: true });
    };

    return (
        <AppLayout>
            <Head title={t('Ubah Pengajuan Dana')} />

            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.visit(fundRequestRoutes.index.url())}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <PageHeader
                        title={t('Ubah Pengajuan Dana')}
                        description={t('No. {{number}}', { number: fundRequest.request_number })}
                    />
                </div>

                <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 p-6 space-y-6">
                    <FormSection title={t('Informasi Pengajuan')} description={t('Data utama pengajuan dana.')} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label={t('Judul *')}
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            error={errors.title}
                        />
                        <Combobox
                            label={t('Prioritas *')}
                            options={PRIORITY_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
                            value={data.priority || null}
                            onChange={(v) => setData('priority', v ? String(v) : 'medium')}
                            error={errors.priority}
                        />
                        <DatePicker
                            label={t('Dibutuhkan Sebelum *')}
                            value={data.needed_by_date ? new Date(data.needed_by_date) : null}
                            onChange={(d) => setData('needed_by_date', d ? toLocalIso(d) : '')}
                            error={errors.needed_by_date}
                        />
                        <div className="sm:col-span-2">
                            <Textarea
                                label={t('Tujuan / Keterangan *')}
                                value={data.purpose}
                                onChange={(e) => setData('purpose', e.target.value)}
                                error={errors.purpose}
                                rows={3}
                            />
                        </div>

                        {/* Attachment */}
                        <div className="sm:col-span-2">
                            <FileUpload
                                label={t('Lampiran (opsional)')}
                                value={data.attachment}
                                onChange={(file) => setData('attachment', file)}
                                accept={['.jpg', '.jpeg', '.png', '.pdf']}
                                maxSizeMb={5}
                                error={errors.attachment}
                                existingFileName={hasExistingAttachment ? fundRequest.attachment_name : null}
                                existingFileUrl={hasExistingAttachment ? fundRequest.attachment_url : null}
                                onRemoveExisting={() => setData('remove_attachment', true)}
                            />
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                    <div className="px-6 py-4 border-b border-secondary-200 dark:border-dark-600 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50">{t('Item Biaya')}</h3>
                            <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">{t('Rincian pengeluaran yang diajukan')}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="blue" className="tabular-nums">
                                {t('Total: {{amount}}', { amount: formatCurrency(totalAmount) })}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={addItem}>
                                <Plus className="w-3.5 h-3.5" />
                                {t('Tambah Item')}
                            </Button>
                        </div>
                    </div>

                    {errors.items && (
                        <p className="px-6 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/10">{errors.items}</p>
                    )}

                    <div className="divide-y divide-secondary-100 dark:divide-dark-600">
                        {data.items.map((item, index) => (
                            <ItemRow
                                key={index}
                                index={index}
                                item={item}
                                categories={categories}
                                errors={errors}
                                onChange={updateItem}
                                onRemove={data.items.length > 1 ? () => removeItem(index) : undefined}
                            />
                        ))}
                    </div>

                    <div className="px-6 py-3 bg-secondary-50/50 dark:bg-dark-800/50 border-t border-secondary-200 dark:border-dark-600 text-right">
                        <span className="text-sm text-dark-500 dark:text-dark-400">{t('Total Pengajuan:')} </span>
                        <span className="text-base font-bold text-dark-900 dark:text-dark-50 tabular-nums">
                            {formatCurrency(totalAmount)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Button variant="zinc" onClick={() => router.visit(fundRequestRoutes.index.url())}>
                        {t('Batal')}
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => submit('draft')} disabled={processing}>
                            {t('Simpan Draft')}
                        </Button>
                        <Button variant="primary" onClick={() => submit('submit')} disabled={processing}>
                            {t('Ajukan untuk Persetujuan')}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

/* ─── Item row ──────────────────────────────────────────── */

interface ItemRowProps {
    index: number;
    item: FundRequestItem;
    categories: FilterOption[];
    errors: Record<string, string>;
    onChange: (index: number, field: keyof FundRequestItem, value: string | number | null) => void;
    onRemove?: () => void;
}

function ItemRow({ index, item, categories, errors, onChange, onRemove }: ItemRowProps) {
    const itemTotal = item.quantity * item.unit_price;

    return (
        <div className="px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-dark-500 dark:text-dark-400">{t('Item #{{n}}', { n: index + 1 })}</span>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-dark-900 dark:text-dark-50 tabular-nums">
                        {formatCurrency(itemTotal)}
                    </span>
                    {onRemove && (
                        <button type="button" onClick={onRemove} className="text-dark-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                    <Input
                        label={t('Nama Item *')}
                        value={item.description}
                        onChange={(e) => onChange(index, 'description', e.target.value)}
                        error={errors[`items.${index}.description`]}
                    />
                </div>
                <div className="sm:col-span-2">
                    <Combobox
                        label={t('Kategori *')}
                        options={categories}
                        value={item.category_id}
                        onChange={(v) => onChange(index, 'category_id', v ? Number(v) : null)}
                        error={errors[`items.${index}.category_id`]}
                        placeholder={t('Pilih kategori')}
                    />
                </div>
                <div>
                    <Input
                        label={t('Qty *')}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => onChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        error={errors[`items.${index}.quantity`]}
                    />
                </div>
                <div>
                    <CurrencyInput
                        label={t('Harga Satuan *')}
                        value={item.unit_price}
                        onChange={(v) => onChange(index, 'unit_price', v)}
                        error={errors[`items.${index}.unit_price`]}
                    />
                </div>
                <div className="sm:col-span-2">
                    <Input
                        label={t('Catatan')}
                        value={item.notes}
                        onChange={(e) => onChange(index, 'notes', e.target.value)}
                        placeholder={t('Catatan tambahan (opsional)...')}
                    />
                </div>
            </div>
        </div>
    );
}
