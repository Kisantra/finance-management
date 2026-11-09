import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/shared/currency-input';
import { FileUpload } from '@/components/shared/file-upload';
import { FinancingHint, isFinancingCategory, quickAddParents, withFinancingGroup } from '@/components/shared/financing';
import { JournalBox } from '@/components/shared/journal-box';
import { QuickAddCategoryDialog, type QuickAddCategoryResult } from '@/components/shared/quick-add-category-dialog';
import { companyUrl } from '@/lib/company';
import { cashJournal } from '@/lib/journal';
import { toLocalIso } from '@/lib/utils';
import * as bankTransactionsRoutes from '@/routes/bank-transactions';
import type { AccountPickerItem, CategoryOption } from '../types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: number;
    accounts: AccountPickerItem[];
    /** 'credit' = income (Pemasukan), 'debit' = expense (Pengeluaran) */
    type: 'credit' | 'debit';
}

interface FormShape {
    bank_account_id: number;
    category_id: number | null;
    amount: number;
    transaction_date: string;
    transaction_type: 'credit' | 'debit';
    description: string;
    reference_number: string;
    attachment: File | null;
}

function emptyForm(accountId: number, type: 'credit' | 'debit'): FormShape {
    return {
        bank_account_id: accountId,
        category_id: null,
        amount: 0,
        transaction_date: toLocalIso(new Date()),
        transaction_type: type,
        description: '',
        reference_number: '',
        attachment: null,
    };
}

export function TransactionFormDialog({ open, onOpenChange, accountId, accounts, type }: Props) {
    const isIncome = type === 'credit';
    const [categories, setCategories] = React.useState<CategoryOption[]>([]);
    const [quickAddOpen, setQuickAddOpen] = React.useState(false);

    const handleCategoryAdded = ({ id, label, formattedLabel, parentId, isGroup }: QuickAddCategoryResult) => {
        // Kategori cepat bertipe pemasukan/pengeluaran: akun lawan jurnalnya = labelnya sendiri
        // (JournalService::counterAccount), sama seperti yang dikirim server untuk kategori lain.
        const newOption: CategoryOption = { value: id, label: formattedLabel, disabled: isGroup || undefined, journal_account: isGroup ? undefined : label };
        setCategories((prev) => {
            // Kategori cepat bertipe pemasukan/pengeluaran: grup barunya masuk SEBELUM grup Pendanaan
            // (yang selalu terakhir), bukan di dalamnya.
            const firstFinancing = prev.findIndex((o) => o.financing);
            const beforeFinancing = (option: CategoryOption) =>
                firstFinancing === -1 ? [...prev, option] : [...prev.slice(0, firstFinancing), option, ...prev.slice(firstFinancing)];
            if (isGroup || !parentId) return beforeFinancing(newOption);
            const parentIdx = prev.findIndex((o) => o.value === parentId);
            if (parentIdx === -1) return beforeFinancing(newOption);
            let insertIdx = parentIdx + 1;
            while (insertIdx < prev.length && !prev[insertIdx].disabled) {
                insertIdx++;
            }
            const result = [...prev];
            result.splice(insertIdx, 0, newOption);
            return result;
        });
        if (!isGroup) setData('category_id', id);
        setQuickAddOpen(false);
    };

    const { data, setData, post, processing, errors, clearErrors } = useForm<FormShape>(
        emptyForm(accountId, type),
    );

    // Reset form when dialog opens, or when accountId/type changes while open
    React.useEffect(() => {
        if (open) {
            setData(emptyForm(accountId, type));
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, accountId, type]);

    /* Load categories matching the transaction type. */
    React.useEffect(() => {
        if (!open) return;
        axios
            .get(companyUrl('/api/transaction-categories'), { params: { type } })
            .then((res) => setCategories(res.data ?? []))
            .catch(() => setCategories([]));
    }, [open, type]);

    const accountOptions = accounts.map((a) => ({
        value: a.id,
        label: `${a.account_name} — ${a.bank_name}`,
    }));

    // Grup Pendanaan (selalu terakhir) diberi judul bagian + penanda di pemicu.
    const categoryOptions = withFinancingGroup(categories);
    const isFinancing = isFinancingCategory(categories, data.category_id);
    const selectedAccount = accounts.find((a) => a.id === data.bank_account_id);
    const selectedAccountName = selectedAccount?.account_name ?? null;
    // Pratinjau jurnal: rekening & akun lawan dari server (journal_name / journal_account), rumus di
    // @/lib/journal (cermin JournalService::cashLines). Tanpa kategori → placeholder; tanpa jumlah → "—".
    const counterAccount = categories.find((c) => c.value === data.category_id && !c.disabled)?.journal_account;
    const journal = selectedAccount && counterAccount ? cashJournal(type, selectedAccount.journal_name, data.amount, counterAccount) : null;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(bankTransactionsRoutes.store.url(), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isIncome ? 'Pemasukan berhasil dicatat' : 'Pengeluaran berhasil dicatat');
                // Jangan tutup modal — reset field saja agar bisa input berikutnya
                setData(emptyForm(accountId, type));
                clearErrors();
            },
            onError: () => {
                toast.error('Periksa kembali isian form');
            },
        });
    };

    const intentClasses = isIncome
        ? {
              ring: 'bg-green-50 dark:bg-green-900/20',
              icon: 'text-green-600 dark:text-green-400',
          }
        : {
              ring: 'bg-red-50 dark:bg-red-900/20',
              icon: 'text-red-600 dark:text-red-400',
          };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="3xl">
                <DialogHeader>
                    <div className="flex items-center gap-4 py-2">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${intentClasses.ring}`}>
                            {isIncome ? (
                                <ArrowDownLeft className={`w-6 h-6 ${intentClasses.icon}`} />
                            ) : (
                                <ArrowUpRight className={`w-6 h-6 ${intentClasses.icon}`} />
                            )}
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                {isIncome ? 'Catat Pemasukan' : 'Catat Pengeluaran'}
                            </DialogTitle>
                            <p className="text-sm text-dark-600 dark:text-dark-400 mt-0.5">
                                {isIncome
                                    ? 'Tambahkan transaksi pemasukan ke rekening.'
                                    : 'Tambahkan transaksi pengeluaran dari rekening.'}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form id="transaction-form" onSubmit={handleSubmit} className="px-6 py-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left column — main details */}
                        <div className="space-y-4">
                            <SectionHeader title="Detail Transaksi" subtitle="Informasi utama" />

                            <Combobox
                                label="Rekening *"
                                options={accountOptions}
                                value={data.bank_account_id}
                                onChange={(v) => setData('bank_account_id', Number(v))}
                                placeholder="Pilih rekening"
                                clearable={false}
                                error={errors.bank_account_id}
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
                                    options={categoryOptions}
                                    value={data.category_id ?? undefined}
                                    onChange={(v) => setData('category_id', v ? Number(v) : null)}
                                    placeholder="Pilih kategori"
                                    error={errors.category_id}
                                />
                                {isFinancing && (
                                    <FinancingHint direction={type} accountName={selectedAccountName} amount={data.amount} />
                                )}
                            </div>

                            <CurrencyInput
                                label="Jumlah *"
                                value={data.amount}
                                onChange={(v) => setData('amount', v)}
                                error={errors.amount}
                            />

                            <DatePicker
                                mode="single"
                                label="Tanggal *"
                                value={data.transaction_date ? new Date(data.transaction_date + 'T00:00:00') : null}
                                onChange={(d) => setData('transaction_date', d ? toLocalIso(d) : '')}
                                clearable={false}
                                error={errors.transaction_date}
                            />

                            <JournalBox mode="preview" lines={journal} placeholder="Pilih kategori untuk melihat jurnalnya." />
                        </div>

                        {/* Right column — meta + attachment */}
                        <div className="space-y-4">
                            <SectionHeader title="Keterangan" subtitle="Tambahan & bukti" />

                            <Textarea
                                label="Deskripsi *"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Deskripsi singkat transaksi"
                                rows={3}
                                error={errors.description}
                            />

                            <Input
                                label="Nomor Referensi"
                                value={data.reference_number}
                                onChange={(e) => setData('reference_number', e.target.value)}
                                placeholder="Opsional"
                                error={errors.reference_number}
                            />

                            <FileUpload
                                label="Lampiran Bukti"
                                value={data.attachment}
                                onChange={(f) => setData('attachment', f)}
                                accept={['.pdf', '.jpg', '.jpeg', '.png']}
                                maxSizeMb={5}
                                error={errors.attachment}
                                hint="Opsional — bukti pembayaran/struk"
                            />
                        </div>
                    </div>
                </form>

                <QuickAddCategoryDialog
                    open={quickAddOpen}
                    onOpenChange={setQuickAddOpen}
                    type={isIncome ? 'income' : 'expense'}
                    parentOptions={quickAddParents(categories)}
                    onAdded={handleCategoryAdded}
                />

                <DialogFooter>
                    <Button
                        type="button"
                        variant="zinc"
                        onClick={() => onOpenChange(false)}
                        disabled={processing}
                        className="w-full sm:w-auto order-2 sm:order-1"
                    >
                        Tutup
                    </Button>
                    <Button
                        type="submit"
                        form="transaction-form"
                        loading={processing}
                        variant={isIncome ? 'green' : 'red'}
                        className="w-full sm:w-auto order-1 sm:order-2"
                    >
                        {isIncome ? 'Simpan Pemasukan' : 'Simpan Pengeluaran'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="border-b border-secondary-200 dark:border-dark-600 pb-3">
            <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">{title}</h4>
            <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">{subtitle}</p>
        </div>
    );
}
