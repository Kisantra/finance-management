import { useForm } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { BTN, FIELD, SumRow, SURFACE, longDate, rp } from '@/pages/invoices/components/ob';
import * as receivableRoutes from '@/routes/receivables';
import { TYPE_LABEL, interestLabel, totalInterest } from './ptg';
import type { FilterOption, ReceivableRow } from '../types';

/*
 * Menyetujui atau menolak pengajuan piutang.
 *
 * Menyetujui BUKAN sekadar mengubah status: dana langsung keluar dari rekening yang
 * dipilih dan tercatat sebagai transaksi bank. Karena itu nominalnya ditampilkan besar
 * di atas, dan tombolnya menyebut akibatnya ("Setujui & cairkan"), bukan cuma "Setujui".
 */

interface Props {
    /** Null = tertutup. */
    row: ReceivableRow | null;
    onOpenChange: (open: boolean) => void;
    bankAccountOptions: FilterOption[];
}

function aksiOptions(): SegmentedOption<'approve' | 'reject'>[] {
    return [
        { value: 'approve', label: t('Setujui'), icon: <Check className="h-4 w-4" />, activeClassName: 'bg-ob-pos/15 font-semibold text-ob-pos' },
        { value: 'reject', label: t('Tolak'), icon: <X className="h-4 w-4" />, activeClassName: 'bg-ob-late/15 font-semibold text-ob-late' },
    ];
}

export function ReceivableApproveSheet({ row, onOpenChange, bankAccountOptions }: Props) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        action: 'approve' as 'approve' | 'reject',
        bank_account_id: null as number | null,
        notes: '',
    });

    React.useEffect(() => {
        if (!row) return;
        clearErrors();
        setData({ action: 'approve', bank_account_id: null, notes: '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row?.id]);

    const menolak = data.action === 'reject';

    const kirim = (e: React.FormEvent) => {
        e.preventDefault();
        if (!row) return;
        post(receivableRoutes.approve.url({ receivable: row.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(menolak ? t('Pengajuan ditolak') : t('Piutang disetujui dan dicairkan'));
                onOpenChange(false);
            },
            onError: () => toast.error(t('Pengajuan gagal diproses')),
        });
    };

    return (
        <Sheet open={!!row} onOpenChange={(o) => !processing && onOpenChange(o)}>
            <SheetContent hideClose className={cn(SURFACE, 'ob-motion max-w-[520px] rounded-l-3xl border-l')} onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="pr-0 text-xl font-semibold text-ob-ink dark:text-ob-ink">{t('Proses pengajuan')}</SheetTitle>
                        <SheetDescription className="mt-1 text-[13px] text-ob-ink-2 dark:text-ob-ink-2">
                            {t('{{number}} · diajukan {{date}}', { number: row?.receivable_number, date: row?.loan_date ? longDate(row.loan_date) : '—' })}
                        </SheetDescription>
                    </div>
                    <Button variant="outline" className={BTN.icon} onClick={() => onOpenChange(false)} aria-label={t('Tutup')} disabled={processing}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <form id="approve-form" onSubmit={kirim} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
                    {row && (
                        <div className="flex flex-col gap-1.5 rounded-2xl bg-ob-inner p-4">
                            <SumRow label={t(TYPE_LABEL[row.type])} value={row.debtor_name ?? '—'} />
                            <SumRow label={t('Tujuan')} value={<span className="font-normal text-ob-ink-2">{row.purpose}</span>} />
                            <SumRow label={t('Cicilan')} value={t('{{count}}× {{amount}}', { count: row.installment_months, amount: rp(row.installment_amount) })} />
                            <SumRow label={t('Bunga')} value={interestLabel(row) + (totalInterest(row) > 0 ? ` · ${rp(totalInterest(row))}` : '')} />
                            <SumRow label={t('Dicairkan')} value={rp(row.principal_amount)} strong className="mt-1 border-t border-ob-line pt-2" />
                        </div>
                    )}

                    <SegmentedControl
                        options={aksiOptions()}
                        value={data.action}
                        onChange={(v) => setData('action', v)}
                        columns={2}
                        layout="inline"
                        variant="pill"
                        label={t('Keputusan')}
                        className="[&>label]:mb-1.5 [&>label]:text-[13px] [&>label]:font-medium [&>label]:text-ob-ink-2"
                    />

                    <div className={cn(FIELD, 'flex flex-col gap-5')}>
                        {!menolak && (
                            <Combobox
                                label={t('Rekening pencairan')}
                                hint={t('Saldo rekening ini langsung berkurang sebesar pokok.')}
                                error={errors.bank_account_id}
                                options={bankAccountOptions}
                                value={data.bank_account_id ?? ''}
                                onChange={(v) => setData('bank_account_id', v as number)}
                                placeholder={t('Pilih rekening…')}
                                searchPlaceholder={t('Cari rekening…')}
                                emptyText={t('Rekening tidak ditemukan')}
                            />
                        )}

                        <Textarea
                            label={menolak ? t('Alasan penolakan') : t('Catatan')}
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            error={errors.notes}
                            placeholder={menolak ? t('Dibaca pemohon saat memperbaiki pengajuannya') : t('Opsional')}
                            rows={3}
                        />
                    </div>
                </form>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ob-line px-6 py-4">
                    <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)} disabled={processing}>
                        {t('Batal')}
                    </Button>
                    {/* Warna tombol menyatakan arah sebelum labelnya dibaca. `text-ob-page` di gelap,
                        bukan putih: ob-late di mode gelap adalah merah muda, dan putih di atasnya tidak terbaca. */}
                    <Button
                        type="submit"
                        form="approve-form"
                        className={menolak ? cn(BTN.primary, 'bg-ob-late text-white hover:bg-ob-late/90 dark:bg-ob-late dark:text-ob-page dark:hover:bg-ob-late/90') : BTN.primary}
                        loading={processing}
                        disabled={processing}
                    >
                        {menolak ? t('Tolak pengajuan') : t('Setujui & cairkan')}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
