import { useForm } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowRight,
    ArrowUpRight,
    Building2,
    FileText,
    Paperclip,
    Plus,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CurrencyInput } from '@/components/shared/currency-input';
import { FileUpload } from '@/components/shared/file-upload';
import { FinancingBadge, FinancingHint, isFinancingCategory, ManagedByNote, quickAddParents, withFinancingGroup, type ManagedBy } from '@/components/shared/financing';
import { JournalBox } from '@/components/shared/journal-box';
import { QuickAddCategoryDialog, type QuickAddCategoryResult } from '@/components/shared/quick-add-category-dialog';
import * as bankTransactionsRoutes from '@/routes/bank-transactions';
import { useCan } from '@/hooks/use-can';
import { cashJournal, splitCashJournal, type JournalLine } from '@/lib/journal';
import { cn, formatCurrency, formatDate, toastErrors, toLocalIso } from '@/lib/utils';
import type { FilterOption } from '../types';

/* ─── Discriminated union for dialog data ───────────────────── */

export interface TransactionDialogData {
    kind: 'income' | 'expense';
    id: number;
    amount: number;
    date: string;
    description: string | null;
    category_id: number | null;
    /** Label kategori untuk tampilan hanya-lihat. */
    category_label?: string | null;
    is_financing?: boolean;
    reference_number: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
    /** Jurnal tersimpan dari server (JournalService) — satu-satunya sumber untuk transaksi tersimpan. */
    journal: JournalLine[];
    /** Pokok utang/piutang (dikelola modul Utang/Piutang): dibuka hanya-lihat. */
    managed_by?: ManagedBy | null;
    /** Paksa hanya-lihat (mis. rincian di Kas & Bank, yang tidak punya fitur ubah). */
    read_only?: boolean;
}

export interface PaymentDialogData {
    kind: 'payment';
    amount: number;
    date: string;
    invoice_number: string | null;
    client_name: string | null;
    reference_number: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
    /** Jurnal pembayaran invoice dari server ("titipan dulu"). */
    journal: JournalLine[];
}

export interface TransferDialogData {
    kind: 'transfer';
    id: number;
    amount: number;
    total_debit: number;
    admin_fee: number;
    date: string;
    description: string | null;
    reference_number: string | null;
    from_account: { id: number; account_name: string; bank_name: string } | null;
    to_account: { id: number; account_name: string; bank_name: string };
    attachment_url: string | null;
    attachment_name: string | null;
    /** Jurnal transfer dari server: Debit tujuan (+ biaya admin) / Kredit asal. */
    journal: JournalLine[];
}

export type CashFlowDialogData = TransactionDialogData | PaymentDialogData | TransferDialogData;

/* ─── Props ─────────────────────────────────────────────────── */

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: CashFlowDialogData | null;
    /** Income categories for income transactions, expense categories for expense transactions */
    categoryOptions: FilterOption[];
}

/* ─── Form shape ─────────────────────────────────────────────── */

interface EditForm {
    _method: 'put';
    amount: number;
    transaction_date: string;
    description: string;
    category_id: number | null;
    reference_number: string;
    attachment: File | null;
    remove_attachment: boolean;
}

/* ─── Main component ─────────────────────────────────────────── */

export function TransactionDetailDialog({ open, onOpenChange, data, categoryOptions }: Props) {
    const { can } = useCan();
    const [localCategoryOptions, setLocalCategoryOptions] = React.useState<FilterOption[]>(categoryOptions);

    React.useEffect(() => {
        setLocalCategoryOptions(categoryOptions);
    }, [categoryOptions]);

    const handleCategoryAdded = ({ id, formattedLabel, parentId, isGroup }: QuickAddCategoryResult) => {
        const option: FilterOption = { value: id, label: formattedLabel, disabled: isGroup || undefined };
        setLocalCategoryOptions((prev) => {
            // Grup Pendanaan selalu terakhir: grup baru (pemasukan/pengeluaran) masuk sebelum grup itu.
            const firstFinancing = prev.findIndex((o) => o.financing);
            const beforeFinancing = (o: FilterOption) =>
                firstFinancing === -1 ? [...prev, o] : [...prev.slice(0, firstFinancing), o, ...prev.slice(firstFinancing)];
            if (isGroup || !parentId) return beforeFinancing(option);
            const parentIdx = prev.findIndex((o) => o.value === parentId);
            if (parentIdx === -1) return beforeFinancing(option);
            let insertIdx = parentIdx + 1;
            while (insertIdx < prev.length && !prev[insertIdx].disabled) {
                insertIdx++;
            }
            const result = [...prev];
            result.splice(insertIdx, 0, option);
            return result;
        });
    };

    const { data: form, setData, post, processing, errors, clearErrors } = useForm<EditForm>({
        _method: 'put',
        amount: 0,
        transaction_date: '',
        description: '',
        category_id: null,
        reference_number: '',
        attachment: null,
        remove_attachment: false,
    });

    React.useEffect(() => {
        if (!open || !data) return;
        if (data.kind === 'income' || data.kind === 'expense') {
            setData({
                _method: 'put',
                amount: data.amount,
                transaction_date: data.date,
                description: data.description ?? '',
                category_id: data.category_id,
                reference_number: data.reference_number ?? '',
                attachment: null,
                remove_attachment: false,
            });
        } else if (data.kind === 'transfer') {
            setData({
                _method: 'put',
                amount: data.amount,
                transaction_date: data.date,
                description: data.description ?? '',
                category_id: null,
                reference_number: '',
                attachment: null,
                remove_attachment: false,
            });
        }
        clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, data]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!data || data.kind === 'payment') return;

        // PUT + multipart/form-data is unparseable by PHP, so POST with _method spoofing.
        //
        // Argumennya WAJIB objek bernama, bukan skalar telanjang: route ini punya
        // dua parameter ({company?} dan {bankTransaction}), dan pembangun URL
        // Wayfinder membaca `args.bankTransaction`. Diberi angka polos, nilai itu
        // undefined lalu `.toString()` melemparkan TypeError — tombol Simpan
        // Perubahan mati total di Pemasukan, Pengeluaran, dan Transfer sekaligus.
        // Ditemukan QC 2026-11-03; ada juga di bundel produksi, bukan artefak dev.
        post(bankTransactionsRoutes.update.url({ bankTransaction: data.id }), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Transaksi berhasil diperbarui');
                onOpenChange(false);
            },
            onError: (errs) => toastErrors(errs, 'Gagal menyimpan perubahan'),
        });
    };

    if (!data) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="2xl">
                {(data.kind === 'income' || data.kind === 'expense') &&
                (data.read_only || data.managed_by || !can(data.kind === 'income' ? 'edit income' : 'edit expense')) ? (
                    /* Hanya-lihat: pokok utang/piutang, rincian Kas & Bank, atau pengguna tanpa izin ubah.
                       Server tetap menolak ubah/hapus pokok utang/piutang (403), terlepas dari tampilan ini. */
                    <TransactionReadOnlyContent data={data} onClose={() => onOpenChange(false)} />
                ) : data.kind === 'income' || data.kind === 'expense' ? (
                    <TransactionEditContent
                        data={data}
                        form={form}
                        setData={setData}
                        errors={errors}
                        processing={processing}
                        categoryOptions={localCategoryOptions}
                        onCategoryAdded={handleCategoryAdded}
                        onSubmit={handleSubmit}
                        onClose={() => onOpenChange(false)}
                    />
                ) : data.kind === 'payment' ? (
                    <PaymentDetailContent data={data} onClose={() => onOpenChange(false)} />
                ) : data.kind === 'transfer' ? (
                    /* Dipersempit secara positif, bukan lewat cabang `else`: kalau suatu saat
                       ada jenis baru, ia tidak ikut dirender sebagai transfer. */
                    <TransferEditContent
                        data={data}
                        form={form}
                        setData={setData}
                        errors={errors}
                        processing={processing}
                        onSubmit={handleSubmit}
                        onClose={() => onOpenChange(false)}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

/* ─── Transaction edit (income / expense) ────────────────────── */

interface TransactionEditProps {
    data: TransactionDialogData;
    form: EditForm;
    setData: (key: keyof EditForm, value: EditForm[keyof EditForm]) => void;
    errors: Partial<Record<keyof EditForm, string>>;
    processing: boolean;
    categoryOptions: FilterOption[];
    onCategoryAdded: (result: QuickAddCategoryResult) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}

function TransactionEditContent({ data, form, setData, errors, processing, categoryOptions, onCategoryAdded, onSubmit, onClose }: TransactionEditProps) {
    const { can } = useCan();
    const [quickAddOpen, setQuickAddOpen] = React.useState(false);

    const isIncome = data.kind === 'income';
    const accentRing = isIncome
        ? 'bg-green-50 dark:bg-green-900/20'
        : 'bg-red-50 dark:bg-red-900/20';
    const accentIcon = isIncome
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';

    const handleCategoryAdded = (result: QuickAddCategoryResult) => {
        onCategoryAdded(result);
        if (!result.isGroup) setData('category_id', result.id);
        setQuickAddOpen(false);
    };

    // Jurnal: selama jumlah & kategori belum diubah, tampilkan jurnal TERSIMPAN dari server; setelah
    // diubah, pratinjau dari rekening tersimpan + akun lawan kategori pilihan (journal_account dari
    // server), rumus @/lib/journal (cermin JournalService::cashLines). Rekening tidak bisa diganti di sini.
    const direction = isIncome ? 'credit' : 'debit';
    const changed = form.amount !== data.amount || form.category_id !== data.category_id;
    const saved = splitCashJournal(data.journal, direction);
    const counter = form.category_id === data.category_id
        ? saved?.counter
        : categoryOptions.find((o) => o.value === form.category_id && !o.disabled)?.journal_account;
    const journal = !changed ? data.journal : saved && counter ? cashJournal(direction, saved.account, form.amount, counter) : null;

    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-4 py-2">
                    <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', accentRing)}>
                        {isIncome
                            ? <ArrowDownLeft className={cn('w-6 h-6', accentIcon)} />
                            : <ArrowUpRight className={cn('w-6 h-6', accentIcon)} />}
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                            {isIncome ? 'Edit Pemasukan' : 'Edit Pengeluaran'}
                        </DialogTitle>
                        <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">
                            ID #{data.id}
                        </p>
                    </div>
                </div>
            </DialogHeader>

            <form id="tx-edit-form" onSubmit={onSubmit} className="px-6 py-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CurrencyInput
                        label="Jumlah *"
                        value={form.amount}
                        onChange={(v) => setData('amount', v)}
                        error={errors.amount}
                    />
                    <DatePicker
                        mode="single"
                        label="Tanggal *"
                        value={form.transaction_date ? new Date(form.transaction_date + 'T00:00:00') : null}
                        onChange={(d) => setData('transaction_date', d ? toLocalIso(d) : '')}
                        error={errors.transaction_date}
                    />
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-medium text-dark-900 dark:text-dark-300">
                                Kategori *
                            </label>
                            <button
                                type="button"
                                onClick={() => setQuickAddOpen(true)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                Tambah
                            </button>
                        </div>
                        <Combobox
                            options={withFinancingGroup(categoryOptions)}
                            value={form.category_id ?? undefined}
                            onChange={(v) => setData('category_id', v ? Number(v) : null)}
                            placeholder="Pilih kategori"
                            error={errors.category_id}
                        />
                        {isFinancingCategory(categoryOptions, form.category_id) && (
                            <FinancingHint direction={isIncome ? 'credit' : 'debit'} amount={form.amount} />
                        )}
                    </div>
                    <Input
                        label="Referensi"
                        value={form.reference_number}
                        onChange={(e) => setData('reference_number', e.target.value)}
                        placeholder="No. referensi opsional"
                        error={errors.reference_number}
                    />
                    <div className="sm:col-span-2">
                        <JournalBox mode={changed ? 'preview' : 'saved'} lines={journal} placeholder="Pilih kategori untuk melihat jurnalnya." />
                    </div>
                    <div className="sm:col-span-2">
                        <Input
                            label="Deskripsi *"
                            value={form.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Deskripsi transaksi"
                            error={errors.description}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <FileUpload
                            label="Lampiran"
                            value={form.attachment}
                            onChange={(f) => {
                                setData('attachment', f);
                                if (f) setData('remove_attachment', false);
                            }}
                            existingFileName={!form.remove_attachment ? (data.attachment_name ?? undefined) : undefined}
                            existingFileUrl={!form.remove_attachment ? (data.attachment_url ?? undefined) : undefined}
                            onRemoveExisting={() => setData('remove_attachment', true)}
                        />
                    </div>
                </div>
            </form>

            <QuickAddCategoryDialog
                open={quickAddOpen}
                onOpenChange={setQuickAddOpen}
                type={data.kind as 'income' | 'expense'}
                parentOptions={quickAddParents(categoryOptions)}
                onAdded={handleCategoryAdded}
            />

            <DialogFooter>
                <Button type="button" variant="zinc" size="md" onClick={onClose} disabled={processing}>
                    Batal
                </Button>
                {can(isIncome ? 'edit income' : 'edit expense') && (
                    <Button
                        form="tx-edit-form"
                        type="submit"
                        variant={isIncome ? 'green' : 'red'}
                        size="md"
                        disabled={processing}
                    >
                        {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                    </Button>
                )}
            </DialogFooter>
        </>
    );
}

/* ─── Transaction detail (read-only) ─────────────────────────── */

function TransactionReadOnlyContent({ data, onClose }: { data: TransactionDialogData; onClose: () => void }) {
    const isIncome = data.kind === 'income';

    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-4 py-2">
                    <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', isIncome ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
                        {isIncome
                            ? <ArrowDownLeft className="w-6 h-6 text-green-600 dark:text-green-400" />
                            : <ArrowUpRight className="w-6 h-6 text-red-600 dark:text-red-400" />}
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                            {isIncome ? 'Rincian Pemasukan' : 'Rincian Pengeluaran'}
                        </DialogTitle>
                        <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">ID #{data.id}</p>
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <DetailField label="Jumlah">
                        <span className={cn('text-lg font-bold', isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                            {isIncome ? '+' : '−'}{formatCurrency(data.amount)}
                        </span>
                    </DetailField>
                    <DetailField label="Tanggal">{formatDate(data.date)}</DetailField>
                    <DetailField label="Kategori">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                            {data.category_label ?? '—'}
                            {data.is_financing && <FinancingBadge />}
                        </span>
                    </DetailField>
                    <DetailField label="Referensi">
                        <span className="font-mono">{data.reference_number ?? '—'}</span>
                    </DetailField>
                    <div className="col-span-2">
                        <DetailField label="Deskripsi">{data.description ?? '—'}</DetailField>
                    </div>
                </div>

                {data.managed_by && <ManagedByNote managedBy={data.managed_by} />}

                {data.attachment_url && (
                    <a
                        href={data.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                        {data.attachment_name ?? 'Lihat Lampiran'}
                    </a>
                )}

                <JournalBox lines={data.journal} />
            </div>

            <DialogFooter>
                <Button variant="zinc" size="md" onClick={onClose}>
                    Tutup
                </Button>
            </DialogFooter>
        </>
    );
}

/* ─── Payment detail (read-only) ─────────────────────────────── */

interface PaymentDetailProps {
    data: PaymentDialogData;
    onClose: () => void;
}

function PaymentDetailContent({ data, onClose }: PaymentDetailProps) {
    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-4 py-2">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-900/20">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                            Detail Pembayaran Invoice
                        </DialogTitle>
                        {data.invoice_number && (
                            <p className="text-sm font-mono text-dark-500 dark:text-dark-400 mt-0.5">
                                {data.invoice_number}
                            </p>
                        )}
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <DetailField label="Jumlah">
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                            +{formatCurrency(data.amount)}
                        </span>
                    </DetailField>
                    <DetailField label="Tanggal">
                        {formatDate(data.date)}
                    </DetailField>
                    <DetailField label="Klien">
                        {data.client_name ?? '—'}
                    </DetailField>
                    <DetailField label="Referensi">
                        <span className="font-mono">{data.reference_number ?? '—'}</span>
                    </DetailField>
                </div>

                {data.attachment_url && (
                    <>
                        <Separator />
                        <a
                            href={data.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                        >
                            <Paperclip className="w-3.5 h-3.5" />
                            {data.attachment_name ?? 'Lihat Lampiran'}
                        </a>
                    </>
                )}

                <JournalBox
                    lines={data.journal}
                    caption="Jurnal otomatis dari rekening & invoice (titipan pajak dulu, lalu PPN) · belum buku besar"
                />

                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 px-4 py-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                        Pembayaran ini terhubung dengan invoice. Untuk mengedit, buka halaman Invoice.
                    </p>
                </div>
            </div>

            <DialogFooter>
                <Button variant="zinc" size="md" onClick={onClose}>
                    Tutup
                </Button>
            </DialogFooter>
        </>
    );
}

/* ─── Transfer edit ──────────────────────────────────────────── */

interface TransferEditProps {
    data: TransferDialogData;
    form: EditForm;
    setData: (key: keyof EditForm, value: EditForm[keyof EditForm]) => void;
    errors: Partial<Record<keyof EditForm, string>>;
    processing: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}

function TransferEditContent({ data, form, setData, errors, processing, onSubmit, onClose }: TransferEditProps) {
    const { can } = useCan();

    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-4 py-2">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-purple-50 dark:bg-purple-900/20">
                        <ArrowLeftRight className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                            Detail Transfer
                        </DialogTitle>
                        {data.reference_number && (
                            <p className="text-xs font-mono text-dark-400 dark:text-dark-500 mt-0.5">
                                {data.reference_number}
                            </p>
                        )}
                    </div>
                </div>
            </DialogHeader>

            <div className="px-6 pt-2 pb-4 space-y-4">
                {/* From → To */}
                <div className="flex items-center gap-2 flex-wrap">
                    <AccountChip
                        account={data.from_account}
                        tone="red"
                    />
                    <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />
                    <AccountChip
                        account={data.to_account}
                        tone="green"
                    />
                </div>

                {/* Amount summary */}
                <div className="grid grid-cols-3 gap-3 text-center">
                    <SumStat label="Ditransfer" value={data.amount} color="purple" />
                    <SumStat label="Biaya Admin" value={data.admin_fee} color="zinc" />
                    <SumStat label="Total Debit" value={data.total_debit} color="red" />
                </div>

                <JournalBox lines={data.journal} caption="Jurnal otomatis dari rekening asal & tujuan · belum buku besar" />

                <Separator />

                {/* Attachment link */}
                {data.attachment_url && (
                    <a
                        href={data.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                        {data.attachment_name ?? 'Lihat Lampiran'}
                    </a>
                )}
            </div>

            {can('edit transfer') && (
            <form id="transfer-edit-form" onSubmit={onSubmit} className="px-6 pb-5">
                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 p-4 space-y-4">
                    <p className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">
                        Edit Transfer
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <DatePicker
                            mode="single"
                            label="Tanggal *"
                            value={form.transaction_date ? new Date(form.transaction_date + 'T00:00:00') : null}
                            onChange={(d) => setData('transaction_date', d ? toLocalIso(d) : '')}
                            error={errors.transaction_date}
                        />
                        <Input
                            label="Deskripsi *"
                            value={form.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Deskripsi transfer"
                            error={errors.description}
                        />
                    </div>
                </div>
            </form>
            )}

            <DialogFooter>
                <Button variant="zinc" size="md" onClick={onClose} disabled={processing}>
                    {can('edit transfer') ? 'Batal' : 'Tutup'}
                </Button>
                {can('edit transfer') && (
                    <Button
                        form="transfer-edit-form"
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={processing}
                    >
                        {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                    </Button>
                )}
            </DialogFooter>
        </>
    );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">{label}</p>
            <div className="text-sm font-medium text-dark-900 dark:text-dark-50">{children}</div>
        </div>
    );
}

function SumStat({ label, value, color }: { label: string; value: number; color: 'purple' | 'red' | 'zinc' }) {
    const colorMap = {
        purple: 'text-purple-600 dark:text-purple-400',
        red: 'text-red-600 dark:text-red-400',
        zinc: 'text-dark-600 dark:text-dark-400',
    };
    return (
        <div className="rounded-lg bg-secondary-50 dark:bg-dark-800 px-3 py-2.5">
            <p className="text-xs text-dark-400 dark:text-dark-500 mb-1">{label}</p>
            <p className={cn('text-sm font-bold tabular-nums', colorMap[color])}>
                {formatCurrency(value)}
            </p>
        </div>
    );
}

function AccountChip({ account, tone }: { account: { account_name: string; bank_name: string } | null; tone: 'red' | 'green' }) {
    const toneMap = {
        red: 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10 text-red-700 dark:text-red-300',
        green: 'border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-900/10 text-green-700 dark:text-green-300',
    };
    if (!account) {
        return <span className="text-xs text-dark-400 italic">tidak diketahui</span>;
    }
    return (
        <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs min-w-0 max-w-48', toneMap[tone])}>
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate font-medium">{account.account_name}</span>
        </div>
    );
}

