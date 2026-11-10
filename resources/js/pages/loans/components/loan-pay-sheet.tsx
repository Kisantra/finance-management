import { useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { CurrencyInput } from '@/components/shared/currency-input';
import { cn, toLocalIso } from '@/lib/utils';
import { BTN, FIELD, SumRow, SURFACE, rp } from '@/pages/invoices/components/ob';
import * as loanRoutes from '@/routes/loans';
import { totalInterest } from './pjm';
import type { FilterOption, LoanRow } from '../types';
import { t, Trans } from '@/i18n';

/* Catat pembayaran angsuran. Pokok dan bunga dicatat terpisah karena laporan membedakan keduanya. */

interface Props {
    /** Null = tertutup. */
    row: LoanRow | null;
    onOpenChange: (open: boolean) => void;
    bankAccountOptions: FilterOption[];
}

export function LoanPaySheet({ row, onOpenChange, bankAccountOptions }: Props) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        bank_account_id: null as number | null,
        payment_date: toLocalIso(new Date()),
        principal_paid: 0,
        interest_paid: 0,
        reference_number: '',
        notes: '',
    });

    React.useEffect(() => {
        if (!row) return;
        clearErrors();
        setData({
            bank_account_id: null,
            payment_date: toLocalIso(new Date()),
            principal_paid: 0,
            interest_paid: 0,
            reference_number: '',
            notes: '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row?.id]);

    const sisaBunga = row ? Math.max(0, totalInterest(row) - row.paid_interest) : 0;
    const total = data.principal_paid + data.interest_paid;

    const simpan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!row) return;
        post(loanRoutes.pay.url({ loan: row.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Pembayaran dicatat'));
                onOpenChange(false);
            },
            onError: () => toast.error(t('Pembayaran gagal dicatat')),
        });
    };

    return (
        <Sheet open={!!row} onOpenChange={(o) => !processing && onOpenChange(o)}>
            <SheetContent hideClose className={cn(SURFACE, 'ob-motion max-w-[480px] rounded-l-3xl border-l')} onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="pr-0 text-xl font-semibold text-ob-ink dark:text-ob-ink">{t('Catat pembayaran')}</SheetTitle>
                        <SheetDescription className="mt-1 text-[13px] text-ob-ink-2 dark:text-ob-ink-2">
                            {row?.loan_number} · {row?.lender_name}
                        </SheetDescription>
                    </div>
                    <Button variant="outline" className={BTN.icon} onClick={() => onOpenChange(false)} aria-label={t('Tutup form')} disabled={processing}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <form id="loan-pay-form" onSubmit={simpan} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
                    {row && (
                        <div className="flex flex-col gap-1.5 rounded-2xl bg-ob-inner p-4">
                            <SumRow label={t('Sisa pokok')} value={<span className="text-ob-neg">{rp(row.remaining_principal)}</span>} />
                            <SumRow label={t('Sisa bunga')} value={sisaBunga > 0 ? rp(sisaBunga) : t('lunas')} />
                        </div>
                    )}

                    <div className={cn(FIELD, 'flex flex-col gap-5')}>
                        <Combobox
                            label={t('Rekening pembayaran')}
                            error={errors.bank_account_id}
                            options={bankAccountOptions}
                            value={data.bank_account_id ?? ''}
                            onChange={(v) => setData('bank_account_id', v as number)}
                            placeholder={t('Pilih rekening…')}
                            searchPlaceholder={t('Cari rekening…')}
                            emptyText={t('Rekening tidak ditemukan')}
                        />

                        <DatePicker
                            label={t('Tanggal pembayaran')}
                            error={errors.payment_date}
                            value={data.payment_date ? new Date(data.payment_date) : null}
                            onChange={(d) => setData('payment_date', d ? toLocalIso(d) : '')}
                        />

                        <CurrencyInput
                            label={t('Pembayaran pokok')}
                            hint={row ? t('Maksimum {{amount}}', { amount: rp(row.remaining_principal) }) : undefined}
                            value={data.principal_paid}
                            onChange={(v) => setData('principal_paid', v)}
                            error={errors.principal_paid}
                        />

                        {sisaBunga > 0 && (
                            <CurrencyInput
                                label={t('Pembayaran bunga')}
                                hint={t('Maksimum {{amount}}', { amount: rp(sisaBunga) })}
                                value={data.interest_paid}
                                onChange={(v) => setData('interest_paid', v)}
                                error={errors.interest_paid}
                            />
                        )}

                        <Input
                            label={t('Nomor referensi')}
                            value={data.reference_number}
                            onChange={(e) => setData('reference_number', e.target.value)}
                            error={errors.reference_number}
                            placeholder={t('Opsional')}
                        />

                        <Input label={t('Catatan')} value={data.notes} onChange={(e) => setData('notes', e.target.value)} error={errors.notes} placeholder={t('Opsional')} />
                    </div>
                </form>

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ob-line px-6 py-4">
                    <span className="text-[13px] text-ob-ink-2">
                        <Trans
                            i18nKey="Total <b>{{amount}}</b>"
                            values={{ amount: rp(total) }}
                            components={{ b: <span className="font-semibold tabular-nums text-ob-ink" /> }}
                        />
                    </span>
                    <span className="flex items-center gap-2">
                        <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)} disabled={processing}>
                            {t('Batal')}
                        </Button>
                        <Button type="submit" form="loan-pay-form" className={BTN.primary} loading={processing} disabled={processing || total <= 0}>
                            {t('Simpan pembayaran')}
                        </Button>
                    </span>
                </div>
            </SheetContent>
        </Sheet>
    );
}
