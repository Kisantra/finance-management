import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeftRight } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/shared/currency-input';
import { FileUpload } from '@/components/shared/file-upload';
import { JournalBox } from '@/components/shared/journal-box';
import { companyUrl } from '@/lib/company';
import { transferJournal } from '@/lib/journal';
import { toLocalIso } from '@/lib/utils';
import * as bankTransactionsRoutes from '@/routes/bank-transactions';
import { bankNameLabel, type AccountPickerItem, type CategoryOption } from '../types';
import { t } from '@/i18n';

/** Isian awal untuk alur khusus, mis. Isi ulang kas kecil dari halaman Kas & Bank. */
export interface TransferPreset {
    toAccountId?: number | null;
    amount?: number;
    adminFee?: number;
    description?: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accounts: AccountPickerItem[];
    /** Pre-fill the "from" account. */
    fromAccountId?: number | null;
    /** Pre-fill tujuan, jumlah, biaya admin, dan deskripsi. */
    preset?: TransferPreset | null;
}

const DEFAULT_ADMIN_FEE = 2500;

interface FormShape {
    from_account_id: number | null;
    to_account_id: number | null;
    category_id: number | null;
    amount: number;
    admin_fee: number;
    description: string;
    transfer_date: string;
    attachment: File | null;
}

function todayIso() {
    return toLocalIso(new Date());
}

export function TransferDialog({ open, onOpenChange, accounts, fromAccountId, preset }: Props) {
    const [categories, setCategories] = React.useState<CategoryOption[]>([]);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<FormShape>({
        from_account_id: fromAccountId ?? null,
        to_account_id: preset?.toAccountId ?? null,
        category_id: null,
        amount: preset?.amount ?? 0,
        admin_fee: preset?.adminFee ?? DEFAULT_ADMIN_FEE,
        description: preset?.description ?? '',
        transfer_date: todayIso(),
        attachment: null,
    });

    React.useEffect(() => {
        if (open) {
            setData({
                from_account_id: fromAccountId ?? null,
                to_account_id: preset?.toAccountId ?? null,
                category_id: null,
                amount: preset?.amount ?? 0,
                admin_fee: preset?.adminFee ?? DEFAULT_ADMIN_FEE,
                description: preset?.description ?? '',
                transfer_date: todayIso(),
                attachment: null,
            });
            clearErrors();
        }
        // Bergantung pada nilai preset, bukan objeknya: objek baru tiap render akan mengosongkan isian.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, fromAccountId, preset?.toAccountId, preset?.amount, preset?.adminFee, preset?.description]);

    React.useEffect(() => {
        if (!open) return;
        axios
            .get(companyUrl('/api/transaction-categories'), { params: { type: 'transfer' } })
            .then((res) => setCategories(res.data ?? []))
            .catch(() => setCategories([]));
    }, [open]);

    const fromOptions = accounts.map((a) => ({
        value: a.id,
        label: `${a.account_name} — ${bankNameLabel(a.bank_name, a.type)}`,
    }));
    const toOptions = accounts
        .filter((a) => a.id !== data.from_account_id)
        .map((a) => ({
            value: a.id,
            label: `${a.account_name} — ${bankNameLabel(a.bank_name, a.type)}`,
        }));
    const categoryOptions = categories.map((c) => ({
        value: c.value,
        label: c.label,
        disabled: c.disabled,
    }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(bankTransactionsRoutes.transfer.url(), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Transfer berhasil dicatat'));
                onOpenChange(false);
                reset();
            },
            onError: () => {
                toast.error(t('Periksa kembali isian form'));
            },
        });
    };

    const fromAccount = accounts.find((a) => a.id === data.from_account_id);
    const toAccount = accounts.find((a) => a.id === data.to_account_id);
    // Pratinjau jurnal (cermin JournalService::transferLines): Debit tujuan + biaya admin / Kredit asal.
    const journal = fromAccount && toAccount ? transferJournal(fromAccount.journal_name, toAccount.journal_name, data.amount, data.admin_fee) : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="3xl">
                <DialogHeader>
                    <div className="flex items-center gap-4 py-2">
                        <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                            <ArrowLeftRight className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                {t('Transfer Antar Rekening')}
                            </DialogTitle>
                            <p className="text-sm text-dark-600 dark:text-dark-400 mt-0.5">
                                {t('Pindahkan dana antar rekening Anda.')}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form id="transfer-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    {/* Flow visualization */}
                    {(fromAccount || toAccount) && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                            <FlowChip account={fromAccount} label={t('Dari')} tone="red" />
                            <ArrowLeftRight className="w-4 h-4 text-purple-500 shrink-0" />
                            <FlowChip account={toAccount} label={t('Ke')} tone="green" />
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Combobox
                                label={t('Rekening Sumber *')}
                                options={fromOptions}
                                value={data.from_account_id ?? undefined}
                                onChange={(v) => {
                                    setData('from_account_id', v ? Number(v) : null);
                                    if (data.to_account_id === Number(v)) setData('to_account_id', null);
                                }}
                                placeholder={t('Pilih rekening sumber')}
                                error={errors.from_account_id}
                            />

                            <Combobox
                                label={t('Rekening Tujuan *')}
                                options={toOptions}
                                value={data.to_account_id ?? undefined}
                                onChange={(v) => setData('to_account_id', v ? Number(v) : null)}
                                placeholder={t('Pilih rekening tujuan')}
                                error={errors.to_account_id}
                            />

                            <Combobox
                                label={t('Kategori *')}
                                options={categoryOptions}
                                value={data.category_id ?? undefined}
                                onChange={(v) => setData('category_id', v ? Number(v) : null)}
                                placeholder={t('Pilih kategori transfer')}
                                error={errors.category_id}
                            />

                            <DatePicker
                                mode="single"
                                label={t('Tanggal *')}
                                value={data.transfer_date ? new Date(data.transfer_date + 'T00:00:00') : null}
                                onChange={(d) => setData('transfer_date', d ? toLocalIso(d) : '')}
                                clearable={false}
                                error={errors.transfer_date}
                            />
                        </div>

                        <div className="space-y-4">
                            <CurrencyInput
                                label={t('Jumlah Transfer *')}
                                value={data.amount}
                                onChange={(v) => setData('amount', v)}
                                error={errors.amount}
                                hint={t('Jumlah yang diterima rekening tujuan.')}
                            />

                            <CurrencyInput
                                label={t('Biaya Admin')}
                                value={data.admin_fee}
                                onChange={(v) => setData('admin_fee', v)}
                                error={errors.admin_fee}
                                hint={t('Ikut dipotong dari rekening sumber.')}
                            />

                            <Textarea
                                label={t('Deskripsi *')}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder={t('Misal: Pemindahan dana operasional')}
                                rows={2}
                                error={errors.description}
                            />

                            <FileUpload
                                label={t('Bukti Transfer')}
                                value={data.attachment}
                                onChange={(f) => setData('attachment', f)}
                                accept={['.pdf', '.jpg', '.jpeg', '.png']}
                                maxSizeMb={5}
                                error={errors.attachment}
                            />
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="pt-4 border-t border-secondary-200 dark:border-dark-600">
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <SumStat label={t('Jumlah')} value={data.amount} />
                            <SumStat label={t('Biaya Admin')} value={data.admin_fee} />
                            <SumStat label={t('Total Keluar')} value={data.amount + data.admin_fee} bold />
                        </div>
                    </div>

                    <JournalBox
                        mode="preview"
                        lines={journal}
                        caption={t('Jurnal otomatis dari rekening asal & tujuan · belum buku besar')}
                        placeholder={t('Pilih rekening sumber dan tujuan untuk melihat jurnalnya.')}
                    />
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="zinc"
                        onClick={() => onOpenChange(false)}
                        disabled={processing}
                        className="w-full sm:w-auto order-2 sm:order-1"
                    >
                        {t('Batal')}
                    </Button>
                    <Button
                        type="submit"
                        form="transfer-form"
                        loading={processing}
                        variant="primary"
                        className="w-full sm:w-auto order-1 sm:order-2 bg-purple-600 hover:bg-purple-700"
                    >
                        {t('Lakukan Transfer')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function FlowChip({ account, label, tone }: { account?: AccountPickerItem; label: string; tone: 'red' | 'green' }) {
    const toneMap = {
        red: 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10',
        green: 'border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-900/10',
    };
    return (
        <div className={`flex-1 min-w-0 px-3 py-2 rounded-lg border ${toneMap[tone]}`}>
            <p className="text-[10px] uppercase tracking-wide text-dark-500 dark:text-dark-400 font-semibold">{label}</p>
            <p className="text-sm font-semibold text-dark-900 dark:text-dark-50 truncate">
                {account ? account.account_name : t('Belum dipilih')}
            </p>
            {account && (
                <p className="text-xs text-dark-500 dark:text-dark-400 truncate">{bankNameLabel(account.bank_name, account.type)}</p>
            )}
        </div>
    );
}

function SumStat({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
    return (
        <div>
            <p className="text-dark-500 dark:text-dark-400">{label}</p>
            <p className={`tabular-nums mt-1 ${bold ? 'text-sm font-bold text-dark-900 dark:text-dark-50' : 'text-sm text-dark-700 dark:text-dark-300'}`}>
                Rp {value.toLocaleString('id-ID')}
            </p>
        </div>
    );
}
