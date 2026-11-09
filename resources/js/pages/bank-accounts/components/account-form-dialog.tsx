import { useForm } from '@inertiajs/react';
import { Building2, Pencil, Wallet } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { BankLogo } from '@/components/shared/bank-logo';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/autocomplete';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { CurrencyInput } from '@/components/shared/currency-input';
import { BANKS } from '@/lib/banks';
import * as bankAccountsRoutes from '@/routes/bank-accounts';
import type { AccountListItem, AccountType, CustodianOption } from '../types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided, dialog operates in edit mode. */
    account?: AccountListItem | null;
    /** Anggota perusahaan, pilihan penanggung jawab kas. */
    custodianOptions: CustodianOption[];
}

interface AccountForm {
    type: AccountType;
    account_name: string;
    account_number: string;
    bank_name: string;
    branch: string;
    initial_balance: number;
    custodian_id: number | null;
    cash_limit: number;
}

/* Nilai yang diisi server untuk akun kas (BankAccount::CASH_BANK_NAME / CASH_CODE_PREFIX). */
const CASH_BANK_NAME = 'Tunai';
const CASH_CODE_PREFIX = 'KAS-';

const TYPE_OPTIONS: SegmentedOption<AccountType>[] = [
    { value: 'bank', label: 'Bank', icon: <Building2 className="h-4 w-4" /> },
    { value: 'cash', label: 'Kas', icon: <Wallet className="h-4 w-4" /> },
];

/* Saran Nama Bank dari katalog; nama di luar daftar tetap boleh diketik. */
const BANK_OPTIONS: AutocompleteOption[] = BANKS.map((bank) => ({
    value: bank.name,
    description: bank.description,
    keywords: bank.aliases,
    icon: <BankLogo bankName={bank.name} className="h-8 w-8 rounded-lg" />,
}));

function initialData(account?: AccountListItem | null): AccountForm {
    return {
        type: account?.type ?? 'bank',
        account_name: account?.account_name ?? '',
        account_number: account?.account_number ?? '',
        bank_name: account?.bank_name ?? '',
        branch: account?.branch ?? '',
        initial_balance: account?.initial_balance ?? 0,
        custodian_id: account?.custodian_id ?? null,
        cash_limit: account?.cash_limit ?? 0,
    };
}

export function AccountFormDialog({ open, onOpenChange, account, custodianOptions }: Props) {
    const isEdit = !!account;

    const { data, setData, transform, post, put, processing, errors, reset, clearErrors } = useForm<AccountForm>(initialData(account));
    const isCash = data.type === 'cash';

    /* Reset form when dialog opens with a different account context. */
    React.useEffect(() => {
        if (open) {
            setData(initialData(account));
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, account?.id]);

    /* Penanggung jawab yang sudah bukan anggota tetap tampil, agar penolakan server bisa dipahami. */
    const custodianChoices = React.useMemo(() => {
        const current = account?.custodian_id;
        if (!current || custodianOptions.some((o) => o.value === current)) return custodianOptions;
        return [...custodianOptions, { value: current, label: `${account?.custodian_name ?? 'Pengguna'} (bukan anggota lagi)` }];
    }, [custodianOptions, account?.custodian_id, account?.custodian_name]);

    const changeType = (type: AccountType) => {
        if (type === data.type) return;
        setData((prev) => ({
            ...prev,
            type,
            // "Tunai" dan kode KAS- bukan data rekening bank: kosongkan agar diisi yang sebenarnya.
            ...(type === 'bank' && {
                bank_name: prev.bank_name === CASH_BANK_NAME ? '' : prev.bank_name,
                account_number: prev.account_number.toUpperCase().startsWith(CASH_CODE_PREFIX) ? '' : prev.account_number,
            }),
        }));
        clearErrors();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Kolom yang tidak tampil untuk jenis terpilih dikirim kosong. Kas: server mengisi "Tunai"
        // dan kode KAS- (kode/nomor lama dipertahankan saat edit). Bank: penanggung jawab & plafon dibuang.
        transform((d) =>
            d.type === 'cash'
                ? { ...d, account_number: '', bank_name: '', branch: '' }
                : { ...d, custodian_id: null, cash_limit: null },
        );

        const opts = {
            preserveScroll: true,
            onSuccess: () => {
                const noun = isCash ? 'Kas' : 'Rekening';
                toast.success(isEdit ? `${noun} berhasil diperbarui` : `${noun} berhasil ditambahkan`);
                onOpenChange(false);
                if (!isEdit) reset();
            },
            onError: () => {
                toast.error('Periksa kembali isian form');
            },
        };

        if (isEdit && account) {
            put(bankAccountsRoutes.update.url({ bankAccount: account.id }), opts);
        } else {
            post(bankAccountsRoutes.store.url(), opts);
        }
    };

    const title = isEdit ? (isCash ? 'Edit Kas' : 'Edit Rekening Bank') : isCash ? 'Tambah Kas' : 'Tambah Rekening Bank';
    const description = isCash
        ? 'Kas tunai atau kas kecil yang dipegang seorang penanggung jawab. Tidak perlu nomor rekening.'
        : isEdit
          ? 'Perbarui informasi rekening bank.'
          : 'Tambahkan rekening bank baru ke daftar akun Anda.';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="2xl">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ob-chip text-ob-ink-2">
                            {isEdit ? <Pencil className="h-5 w-5" /> : isCash ? <Wallet className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription>{description}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form id="account-form" onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                    <SegmentedControl
                        label="Jenis *"
                        options={TYPE_OPTIONS}
                        value={data.type}
                        onChange={changeType}
                        columns={2}
                        error={errors.type}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Input
                                label={isCash ? 'Nama Kas *' : 'Nama Pemilik Rekening *'}
                                value={data.account_name}
                                onChange={(e) => setData('account_name', e.target.value)}
                                placeholder={isCash ? 'Mis. Kas Kecil Kantor' : 'Mis. PT Kisantra Solidaritas'}
                                error={errors.account_name}
                            />
                        </div>

                        {isCash ? (
                            <>
                                <Combobox
                                    label="Penanggung Jawab"
                                    options={custodianChoices}
                                    value={data.custodian_id}
                                    onChange={(v) => setData('custodian_id', v ? Number(v) : null)}
                                    placeholder="Pilih anggota perusahaan"
                                    searchPlaceholder="Cari nama..."
                                    emptyText="Tidak ada anggota."
                                    hint="Orang yang memegang uang kas ini."
                                    error={errors.custodian_id}
                                />
                                <CurrencyInput
                                    label="Plafon"
                                    value={data.cash_limit}
                                    onChange={(v) => setData('cash_limit', v)}
                                    error={errors.cash_limit}
                                    hint="Batas saldo kas kecil. Bila saldo di bawahnya, selisihnya tampil sebagai kebutuhan isi ulang. Kosongkan bila tidak ada."
                                />
                            </>
                        ) : (
                            <>
                                <Input
                                    label="Nomor Rekening *"
                                    value={data.account_number}
                                    onChange={(e) => setData('account_number', e.target.value)}
                                    placeholder="1234567890"
                                    error={errors.account_number}
                                />
                                <Autocomplete
                                    label="Nama Bank *"
                                    value={data.bank_name}
                                    onChange={(v) => setData('bank_name', v)}
                                    options={BANK_OPTIONS}
                                    placeholder="Ketik atau pilih, mis. BCA"
                                    icon={
                                        <BankLogo
                                            bankName={data.bank_name}
                                            className="h-6 w-6 rounded-lg"
                                            fallback={<Building2 className="h-4 w-4 text-ob-ink-3" />}
                                        />
                                    }
                                    hint="Pilih dari daftar, atau ketik sendiri bila bank tidak ada."
                                    error={errors.bank_name}
                                />
                                <Input
                                    label="Cabang"
                                    value={data.branch}
                                    onChange={(e) => setData('branch', e.target.value)}
                                    placeholder="Cabang Sudirman"
                                    error={errors.branch}
                                />
                            </>
                        )}

                        <CurrencyInput
                            label="Saldo Awal *"
                            value={data.initial_balance}
                            onChange={(v) => setData('initial_balance', v)}
                            error={errors.initial_balance}
                            hint={isEdit ? 'Mengubah saldo awal akan menggeser saldo total.' : undefined}
                        />
                    </div>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="zinc"
                        onClick={() => onOpenChange(false)}
                        disabled={processing}
                        className="w-full sm:w-auto order-2 sm:order-1"
                    >
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        form="account-form"
                        loading={processing}
                        variant="primary"
                        className="w-full sm:w-auto order-1 sm:order-2"
                    >
                        {isEdit ? 'Simpan Perubahan' : isCash ? 'Tambah Kas' : 'Tambah Rekening'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
