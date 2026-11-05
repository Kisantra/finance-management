import { useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/shared/currency-input';
import { FileUpload } from '@/components/shared/file-upload';
import { cn, toLocalIso } from '@/lib/utils';
import { BTN, FIELD, SURFACE } from '@/pages/invoices/components/ob';
import * as loanRoutes from '@/routes/loans';
import type { FilterOption, LoanRow } from '../types';

/* Form tambah/edit pinjaman. Satu komponen untuk keduanya; bedanya field terkunci & endpoint. */

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Null = tambah baru. */
    row: LoanRow | null;
    nextLoanNumber: string;
    bankAccountOptions: FilterOption[];
}

const TIPE_BUNGA: SegmentedOption<'percentage' | 'fixed'>[] = [
    { value: 'percentage', label: 'Persentase (% per tahun)' },
    { value: 'fixed', label: 'Nominal tetap' },
];

const isoOrEmpty = (d: Date | null | undefined): string => (d ? toLocalIso(d) : '');

export function LoanFormSheet({ open, onOpenChange, row, nextLoanNumber, bankAccountOptions }: Props) {
    const isEdit = !!row;

    const { data, setData, post, processing, errors, clearErrors } = useForm<{
        loan_number: string;
        lender_name: string;
        principal_amount: number;
        interest_type: 'fixed' | 'percentage';
        interest_amount: number;
        interest_rate: number | string;
        term_months: number | string;
        start_date: string;
        maturity_date: string;
        purpose: string;
        contract_attachment: File | null;
        remove_attachment: boolean;
        bank_account_id: number | null;
        _method: string;
    }>({
        loan_number: '',
        lender_name: '',
        principal_amount: 0,
        interest_type: 'percentage',
        interest_amount: 0,
        interest_rate: '',
        term_months: '',
        start_date: toLocalIso(new Date()),
        maturity_date: '',
        purpose: '',
        contract_attachment: null,
        remove_attachment: false,
        bank_account_id: null,
        _method: 'POST',
    });

    // Sheet tidak dilepas dari DOM saat tertutup, jadi isinya disetel ulang tiap kali dibuka —
    // tanpa ini, membuka "Tambah" setelah "Edit" akan membawa data pinjaman sebelumnya.
    React.useEffect(() => {
        if (!open) return;
        clearErrors();
        setData({
            loan_number: row?.loan_number ?? nextLoanNumber,
            lender_name: row?.lender_name ?? '',
            principal_amount: row?.principal_amount ?? 0,
            interest_type: row?.interest_type ?? 'percentage',
            interest_amount: row?.interest_amount ?? 0,
            interest_rate: row?.interest_rate ?? '',
            term_months: row?.term_months ?? '',
            start_date: row?.start_date ?? toLocalIso(new Date()),
            maturity_date: row?.maturity_date ?? '',
            purpose: row?.purpose ?? '',
            contract_attachment: null,
            remove_attachment: false,
            bank_account_id: null,
            _method: row ? 'PUT' : 'POST',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, row?.id]);

    /** Jatuh tempo mengikuti tanggal mulai + tenor, tapi tetap bisa ditimpa manual. */
    const hitungJatuhTempo = (mulai: string, bulan: number | string) => {
        if (!mulai || !bulan) return;
        const d = new Date(mulai);
        d.setMonth(d.getMonth() + Number(bulan));
        setData('maturity_date', toLocalIso(d));
    };

    const simpan = (e: React.FormEvent) => {
        e.preventDefault();
        post(isEdit ? loanRoutes.update.url({ loan: row!.id }) : loanRoutes.store.url(), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isEdit ? 'Utang diperbarui' : 'Utang dicatat');
                onOpenChange(false);
            },
            onError: () => toast.error('Utang gagal disimpan'),
        });
    };

    const adaLampiran = isEdit && !!row?.contract_attachment_url && !data.remove_attachment;

    return (
        <Sheet open={open} onOpenChange={(o) => !processing && onOpenChange(o)}>
            <SheetContent hideClose className={cn(SURFACE, 'ob-motion max-w-[560px] rounded-l-3xl border-l')} onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="pr-0 text-xl font-semibold text-ob-ink dark:text-ob-ink">{isEdit ? 'Edit utang' : 'Tambah utang'}</SheetTitle>
                        <SheetDescription className="mt-1 text-[13px] text-ob-ink-2 dark:text-ob-ink-2">
                            {isEdit ? `${row!.loan_number} · nomor dan rekening pencairan tidak bisa diubah.` : 'Pencairannya langsung dicatat sebagai pemasukan di rekening yang dipilih.'}
                        </SheetDescription>
                    </div>
                    <Button variant="outline" className={BTN.icon} onClick={() => onOpenChange(false)} aria-label="Tutup form" disabled={processing}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <form id="loan-form" onSubmit={simpan} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
                    {/* FIELD menata ulang semua tombol di dalamnya, jadi FileUpload sengaja di luar. */}
                    <div className={cn(FIELD, 'flex flex-col gap-5')}>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <Input
                                label="Nomor utang"
                                value={data.loan_number}
                                onChange={(e) => setData('loan_number', e.target.value)}
                                error={errors.loan_number}
                                disabled={isEdit}
                                readOnly={isEdit}
                            />
                            <Input
                                label="Pemberi pinjaman"
                                value={data.lender_name}
                                onChange={(e) => setData('lender_name', e.target.value)}
                                error={errors.lender_name}
                                placeholder="Nama bank, lembaga, atau orang"
                            />
                        </div>

                        <CurrencyInput label="Jumlah pokok" value={data.principal_amount} onChange={(v) => setData('principal_amount', v)} error={errors.principal_amount} />
                    </div>

                    {/* Di LUAR pembungkus FIELD, mengikuti pola halaman Obsidian lain: FIELD memaksa
                        `bg-ob-inner` ke setiap <button> di dalamnya, yang menimpa pil aktif sehingga
                        pilihan yang sedang aktif tidak terlihat sama sekali. Label ditata di sini. */}
                    <SegmentedControl
                        options={TIPE_BUNGA}
                        value={data.interest_type}
                        onChange={(v) => setData('interest_type', v)}
                        columns={2}
                        layout="inline"
                        variant="pill"
                        label="Cara hitung bunga"
                        error={errors.interest_type}
                        className="[&>label]:mb-1.5 [&>label]:text-[13px] [&>label]:font-medium [&>label]:text-ob-ink-2"
                    />

                    <div className={cn(FIELD, 'flex flex-col gap-5')}>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            {data.interest_type === 'percentage' ? (
                                <Input
                                    label="Suku bunga (% per tahun)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={data.interest_rate as string}
                                    onChange={(e) => setData('interest_rate', e.target.value)}
                                    error={errors.interest_rate}
                                    hint="Diprorata per bulan sesuai tenor."
                                    placeholder="0,00"
                                />
                            ) : (
                                <CurrencyInput
                                    label="Jumlah bunga"
                                    value={data.interest_amount}
                                    onChange={(v) => setData('interest_amount', v)}
                                    error={errors.interest_amount}
                                    hint="Total bunga untuk seluruh tenor."
                                />
                            )}
                            <Input
                                label="Tenor (bulan)"
                                type="number"
                                min="1"
                                value={data.term_months as string}
                                onChange={(e) => {
                                    setData('term_months', e.target.value);
                                    hitungJatuhTempo(data.start_date, e.target.value);
                                }}
                                error={errors.term_months}
                                placeholder="12"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <DatePicker
                                label="Tanggal mulai"
                                error={errors.start_date}
                                value={data.start_date ? new Date(data.start_date) : null}
                                onChange={(d) => {
                                    const s = isoOrEmpty(d);
                                    setData('start_date', s);
                                    hitungJatuhTempo(s, data.term_months);
                                }}
                            />
                            <DatePicker
                                label="Jatuh tempo"
                                hint="Terisi sendiri dari tenor, boleh diubah."
                                error={errors.maturity_date}
                                value={data.maturity_date ? new Date(data.maturity_date) : null}
                                onChange={(d) => setData('maturity_date', isoOrEmpty(d))}
                            />
                        </div>

                        {!isEdit && (
                            <Combobox
                                label="Rekening penerima pencairan"
                                error={errors.bank_account_id}
                                options={bankAccountOptions}
                                value={data.bank_account_id ?? ''}
                                onChange={(v) => setData('bank_account_id', v as number)}
                                placeholder="Pilih rekening…"
                                searchPlaceholder="Cari rekening…"
                                emptyText="Rekening tidak ditemukan"
                            />
                        )}

                        <Textarea
                            label="Tujuan pinjaman"
                            value={data.purpose}
                            onChange={(e) => setData('purpose', e.target.value)}
                            error={errors.purpose}
                            placeholder="Opsional: dipakai apa dananya"
                            rows={3}
                        />
                    </div>

                    <FileUpload
                        label="Dokumen kontrak"
                        value={data.contract_attachment}
                        onChange={(f) => setData('contract_attachment', f)}
                        accept={['.jpg', '.jpeg', '.png', '.pdf']}
                        maxSizeMb={5}
                        error={errors.contract_attachment}
                        existingFileName={adaLampiran ? 'Kontrak tersimpan' : null}
                        existingFileUrl={adaLampiran ? row!.contract_attachment_url : null}
                        onRemoveExisting={() => setData('remove_attachment', true)}
                    />
                </form>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ob-line px-6 py-4">
                    <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)} disabled={processing}>
                        Batal
                    </Button>
                    <Button type="submit" form="loan-form" className={BTN.primary} loading={processing} disabled={processing}>
                        {isEdit ? 'Simpan perubahan' : 'Simpan utang'}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
