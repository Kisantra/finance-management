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
import { BTN, FIELD, SURFACE, rp } from '@/pages/invoices/components/ob';
import * as receivableRoutes from '@/routes/receivables';
import type { FilterOption, ReceivableRow } from '../types';

/* Form tambah/edit piutang. Selalu tersimpan sebagai draft; pengajuan adalah langkah terpisah. */

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Null = tambah baru. */
    row: ReceivableRow | null;
    nextReceivableNumber: string;
    employeeOptions: FilterOption[];
    companyOptions: FilterOption[];
}

const TIPE_PIUTANG: SegmentedOption<'employee_loan' | 'company_loan'>[] = [
    { value: 'employee_loan', label: 'Karyawan' },
    { value: 'company_loan', label: 'Perusahaan' },
];

const CARA_BUNGA: SegmentedOption<'percentage' | 'fixed'>[] = [
    { value: 'percentage', label: 'Persentase (%)' },
    { value: 'fixed', label: 'Nominal tetap' },
];

export function ReceivableFormSheet({ open, onOpenChange, row, nextReceivableNumber, employeeOptions, companyOptions }: Props) {
    const isEdit = !!row;

    const { data, setData, post, processing, errors, clearErrors } = useForm<{
        type: 'employee_loan' | 'company_loan';
        debtor_id: number | null;
        principal_amount: number;
        interest_type: 'fixed' | 'percentage';
        interest_amount: number;
        interest_rate: number | string;
        installment_months: number | string;
        loan_date: string;
        purpose: string;
        notes: string;
        disbursement_account: string;
        contract_attachment: File | null;
        remove_attachment: boolean;
        _method: string;
    }>({
        type: 'employee_loan',
        debtor_id: null,
        principal_amount: 0,
        interest_type: 'percentage',
        interest_amount: 0,
        interest_rate: '',
        installment_months: '',
        loan_date: toLocalIso(new Date()),
        purpose: '',
        notes: '',
        disbursement_account: '',
        contract_attachment: null,
        remove_attachment: false,
        _method: 'POST',
    });

    // Sheet tetap terpasang di DOM saat tertutup, jadi isinya disetel ulang tiap kali dibuka.
    React.useEffect(() => {
        if (!open) return;
        clearErrors();
        setData({
            type: row?.type ?? 'employee_loan',
            debtor_id: row?.debtor_id ?? null,
            principal_amount: row?.principal_amount ?? 0,
            interest_type: 'percentage',
            interest_amount: 0,
            interest_rate: row?.interest_rate ?? '',
            installment_months: row?.installment_months ?? '',
            loan_date: row?.loan_date ?? toLocalIso(new Date()),
            purpose: row?.purpose ?? '',
            notes: row?.notes ?? '',
            disbursement_account: row?.disbursement_account ?? '',
            contract_attachment: null,
            remove_attachment: false,
            _method: row ? 'PUT' : 'POST',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, row?.id]);

    const simpan = (e: React.FormEvent) => {
        e.preventDefault();
        post(isEdit ? receivableRoutes.update.url({ receivable: row!.id }) : receivableRoutes.store.url(), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isEdit ? 'Piutang diperbarui' : 'Draft piutang dibuat');
                onOpenChange(false);
            },
            onError: () => toast.error('Piutang gagal disimpan'),
        });
    };

    const pilihanPeminjam = data.type === 'employee_loan' ? employeeOptions : companyOptions;
    const adaLampiran = isEdit && !!row?.contract_attachment_url && !data.remove_attachment;

    // Cicilan per bulan diperlihatkan sebelum disimpan supaya nilainya bisa dinilai
    // saat itu juga, bukan setelah piutangnya sudah terlanjur dibuat.
    const bulan = Number(data.installment_months) || 0;
    const bunga = data.interest_type === 'fixed' ? data.interest_amount : Math.round((data.principal_amount * (Number(data.interest_rate) || 0)) / 100);
    const perBulan = bulan > 0 ? Math.round((data.principal_amount + bunga) / bulan) : 0;

    return (
        <Sheet open={open} onOpenChange={(o) => !processing && onOpenChange(o)}>
            <SheetContent hideClose className={cn(SURFACE, 'ob-motion max-w-[560px] rounded-l-3xl border-l')} onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="pr-0 text-xl font-semibold text-ob-ink dark:text-ob-ink">{isEdit ? 'Edit piutang' : 'Tambah piutang'}</SheetTitle>
                        <SheetDescription className="mt-1 text-[13px] text-ob-ink-2 dark:text-ob-ink-2">
                            {isEdit
                                ? `${row!.receivable_number} · hanya draft dan yang ditolak yang bisa diubah.`
                                : `${nextReceivableNumber} · tersimpan sebagai draft dulu, pencairan baru terjadi setelah disetujui.`}
                        </SheetDescription>
                    </div>
                    <Button variant="outline" className={BTN.icon} onClick={() => onOpenChange(false)} aria-label="Tutup form" disabled={processing}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <form id="receivable-form" onSubmit={simpan} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
                    {/* Di luar FIELD: pembungkus itu memaksa bg-ob-inner ke setiap <button>, termasuk pil aktif. */}
                    <SegmentedControl
                        options={TIPE_PIUTANG}
                        value={data.type}
                        onChange={(v) => {
                            setData('type', v);
                            setData('debtor_id', null);
                        }}
                        columns={2}
                        layout="inline"
                        variant="pill"
                        label="Dipinjam oleh"
                        error={errors.type}
                        className="[&>label]:mb-1.5 [&>label]:text-[13px] [&>label]:font-medium [&>label]:text-ob-ink-2"
                    />

                    <div className={cn(FIELD, 'flex flex-col gap-5')}>
                        <Combobox
                            label={data.type === 'employee_loan' ? 'Karyawan' : 'Perusahaan'}
                            error={errors.debtor_id}
                            options={pilihanPeminjam}
                            value={data.debtor_id ?? ''}
                            onChange={(v) => setData('debtor_id', v as number)}
                            placeholder={data.type === 'employee_loan' ? 'Pilih karyawan…' : 'Pilih perusahaan…'}
                            searchPlaceholder="Cari nama…"
                            emptyText="Tidak ditemukan"
                        />

                        <CurrencyInput label="Jumlah pokok" value={data.principal_amount} onChange={(v) => setData('principal_amount', v)} error={errors.principal_amount} />
                    </div>

                    <SegmentedControl
                        options={CARA_BUNGA}
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
                                    label="Suku bunga (%)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={data.interest_rate as string}
                                    onChange={(e) => setData('interest_rate', e.target.value)}
                                    error={errors.interest_rate}
                                    hint="Dihitung atas seluruh pokok, bukan per bulan."
                                    placeholder="0"
                                />
                            ) : (
                                <CurrencyInput
                                    label="Jumlah bunga"
                                    value={data.interest_amount}
                                    onChange={(v) => setData('interest_amount', v)}
                                    error={errors.interest_amount}
                                    hint="Disimpan sebagai persentase setara."
                                />
                            )}
                            <Input
                                label="Jumlah cicilan (bulan)"
                                type="number"
                                min="1"
                                value={data.installment_months as string}
                                onChange={(e) => setData('installment_months', e.target.value)}
                                error={errors.installment_months}
                                placeholder="12"
                            />
                        </div>

                        <DatePicker
                            label="Tanggal pinjaman"
                            error={errors.loan_date}
                            value={data.loan_date ? new Date(data.loan_date) : null}
                            onChange={(d) => setData('loan_date', d ? toLocalIso(d) : '')}
                        />

                        <Input
                            label="Rekening atau cara pencairan"
                            value={data.disbursement_account}
                            onChange={(e) => setData('disbursement_account', e.target.value)}
                            error={errors.disbursement_account}
                            placeholder="Misalnya BCA 1234567890, atau Kas"
                        />

                        <Input label="Tujuan" value={data.purpose} onChange={(e) => setData('purpose', e.target.value)} error={errors.purpose} placeholder="Dipakai untuk apa" />

                        <Textarea label="Catatan" value={data.notes} onChange={(e) => setData('notes', e.target.value)} error={errors.notes} placeholder="Opsional" rows={2} />
                    </div>

                    {perBulan > 0 && (
                        <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-ob-inner p-4 text-[13px]">
                            <span className="text-ob-ink-2">
                                Cicilan per bulan · {bulan}× angsuran
                                {bunga > 0 && <span className="text-ob-ink-3"> · bunga {rp(bunga)}</span>}
                            </span>
                            <span className="shrink-0 text-base font-semibold tabular-nums text-ob-ink">{rp(perBulan)}</span>
                        </div>
                    )}

                    <FileUpload
                        label="Dokumen kontrak"
                        value={data.contract_attachment}
                        onChange={(f) => setData('contract_attachment', f)}
                        accept={['.jpg', '.jpeg', '.png', '.pdf']}
                        maxSizeMb={5}
                        error={errors.contract_attachment}
                        existingFileName={adaLampiran ? (row!.contract_attachment_name ?? 'Kontrak tersimpan') : null}
                        existingFileUrl={adaLampiran ? row!.contract_attachment_url : null}
                        onRemoveExisting={() => setData('remove_attachment', true)}
                    />
                </form>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ob-line px-6 py-4">
                    <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)} disabled={processing}>
                        Batal
                    </Button>
                    <Button type="submit" form="receivable-form" className={BTN.primary} loading={processing} disabled={processing}>
                        {isEdit ? 'Simpan perubahan' : 'Simpan draft'}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
