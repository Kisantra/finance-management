import { Banknote, FileText, Pencil, Send, Trash2, X } from 'lucide-react';
import { JadwalAngsuran } from '@/components/jadwal-angsuran';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { BTN, SURFACE, longDate, rp } from '@/pages/invoices/components/ob';
import { ReceivableStatusPill, TYPE_LABEL, interestLabel, totalInterest } from './ptg';
import type { ReceivableRow } from '../types';

/*
 * Rincian satu piutang. Panel samping, bukan modal di tengah: isinya tabel jadwal yang
 * tingginya ikut jumlah cicilan.
 *
 * Berbeda dari panel Pinjaman, panel ini juga membawa keadaan alur persetujuan — dan
 * untuk piutang yang ditolak, alasan penolakan adalah hal pertama yang perlu dibaca
 * pengajunya, jadi letaknya di atas, bukan terkubur di bawah jadwal.
 */

interface Props {
    /** Null = tertutup. */
    row: ReceivableRow | null;
    onOpenChange: (open: boolean) => void;
    onEdit: (row: ReceivableRow) => void;
    onPay: (row: ReceivableRow) => void;
    onApprove: (row: ReceivableRow) => void;
    onSubmit: (row: ReceivableRow) => void;
    onDelete: (row: ReceivableRow) => void;
}

export function ReceivableDrawer({ row, onOpenChange, onEdit, onPay, onApprove, onSubmit, onDelete }: Props) {
    return (
        <Sheet open={!!row} onOpenChange={onOpenChange}>
            {/* 760 px: tabel jadwal butuh 680 px bersih, panelnya masih berpadding 24 px kiri-kanan. */}
            <SheetContent hideClose className={cn(SURFACE, 'ob-motion max-w-[760px] rounded-l-3xl border-l')}>
                {row && <Isi row={row} onClose={() => onOpenChange(false)} onEdit={onEdit} onPay={onPay} onApprove={onApprove} onSubmit={onSubmit} onDelete={onDelete} />}
            </SheetContent>
        </Sheet>
    );
}

/* Dipisah agar `JadwalAngsuran` dipasang ulang (dan datanya diambil ulang) tiap ganti piutang. */
function Isi({
    row,
    onClose,
    onEdit,
    onPay,
    onApprove,
    onSubmit,
    onDelete,
}: {
    row: ReceivableRow;
    onClose: () => void;
    onEdit: (row: ReceivableRow) => void;
    onPay: (row: ReceivableRow) => void;
    onApprove: (row: ReceivableRow) => void;
    onSubmit: (row: ReceivableRow) => void;
    onDelete: (row: ReceivableRow) => void;
}) {
    const bunga = totalInterest(row);
    const persenTerbayar = row.principal_amount > 0 ? Math.round((row.paid_principal / row.principal_amount) * 100) : 0;
    const sudahBerjalan = row.status === 'active' || row.status === 'paid_off';

    return (
        <>
            <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
                <div className="min-w-0 flex-1">
                    <SheetTitle className="flex flex-wrap items-center gap-2 pr-0 text-xl font-semibold text-ob-ink dark:text-ob-ink">
                        <span className="truncate">{row.debtor_name ?? t('Peminjam tidak diketahui')}</span>
                        <ReceivableStatusPill status={row.status} />
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-[13px] text-ob-ink-2 dark:text-ob-ink-2">
                        {t('{{number}} · {{type}} · {{from}} sampai {{to}}', { number: row.receivable_number, type: t(TYPE_LABEL[row.type]), from: longDate(row.loan_date), to: longDate(row.due_date) })}
                    </SheetDescription>
                </div>
                <Button variant="outline" className={BTN.icon} onClick={onClose} aria-label={t('Tutup rincian')}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
                {/* Yang ditolak: alasannya didahulukan, karena itulah yang harus diperbaiki. */}
                {row.status === 'rejected' && row.rejection_reason && (
                    <div role="alert" className="flex flex-col gap-1 rounded-2xl border border-ob-late/35 bg-ob-late/8 p-4">
                        <span className="text-[13px] font-semibold text-ob-late">{t('Alasan penolakan')}</span>
                        <p className="text-[13px] leading-relaxed text-ob-ink">{row.rejection_reason}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3 divide-y divide-ob-line rounded-2xl bg-ob-inner p-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0">
                    <Fakta label={t('Pokok')} value={rp(row.principal_amount)} />
                    <Fakta label={t('Bunga')} value={bunga > 0 ? rp(bunga) : t('tanpa bunga')} sub={bunga > 0 ? interestLabel(row) : undefined} />
                    <Fakta label={t('Cicilan / bulan')} value={rp(row.installment_amount)} sub={t('{{count}} bulan', { count: row.installment_months })} />
                </div>

                {sudahBerjalan && (
                    <section aria-label={t('Progres pengembalian pokok')} className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="font-semibold text-ob-ink">{t('Pengembalian pokok')}</span>
                            <span className="tabular-nums text-ob-ink-2">{persenTerbayar}%</span>
                        </div>
                        <div
                            className="h-1.5 overflow-hidden rounded-full bg-ob-chip"
                            role="progressbar"
                            aria-valuenow={persenTerbayar}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={t('Persentase pokok yang sudah kembali')}
                        >
                            <div className="h-full rounded-full bg-ob-act-fill" style={{ width: `${persenTerbayar}%` }} />
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 text-xs text-ob-ink-2">
                            <span>
                                {t('Sudah kembali')} <span className="tabular-nums text-ob-ink">{rp(row.paid_principal)}</span>
                                {row.paid_interest > 0 && (
                                    <>
                                        {' '}
                                        · {t('bunga')} <span className="tabular-nums text-ob-ink">{rp(row.paid_interest)}</span>
                                    </>
                                )}
                            </span>
                            <span>
                                {t('Belum kembali')}{' '}
                                <span className={cn('tabular-nums', row.remaining_principal > 0 ? 'text-ob-neg' : 'text-ob-pos')}>
                                    {row.remaining_principal > 0 ? rp(row.remaining_principal) : t('lunas')}
                                </span>
                            </span>
                        </div>
                    </section>
                )}

                {/* Jadwal tetap ditampilkan sebelum disetujui: itulah yang dinilai penyetuju. */}
                {row.status !== 'rejected' && (
                    <section aria-label={t('Jadwal angsuran')} className="flex flex-col gap-3 border-t border-ob-line pt-5">
                        <h3 className="text-base font-semibold text-ob-ink">{t('Jadwal angsuran')}</h3>
                        {!sudahBerjalan && <p className="text-xs leading-relaxed text-ob-ink-2">{t('Piutang ini belum berjalan, jadi tabel di bawah adalah rencana yang akan berlaku setelah disetujui.')}</p>}
                        <JadwalAngsuran path={`/receivables/${row.id}/schedule`} label={t('Jadwal angsuran piutang {{number}}', { number: row.receivable_number })} tandaiBerikutnya={sudahBerjalan} />
                    </section>
                )}

                <section aria-label={t('Keterangan')} className="flex flex-col gap-3 border-t border-ob-line pt-5">
                    <Keterangan label={t('Tujuan')} isi={row.purpose} />
                    <Keterangan label={t('Pencairan lewat')} isi={row.disbursement_account} />
                    <Keterangan label={t('Catatan')} isi={row.notes} />
                    {row.approved_by_name && <Keterangan label={t('Disetujui')} isi={`${row.approved_by_name}${row.approved_at ? ` · ${longDate(row.approved_at)}` : ''}`} />}
                    <Keterangan label={t('Catatan peninjau')} isi={row.review_notes} />
                    {row.contract_attachment_url && (
                        <a
                            href={row.contract_attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-ob-line px-3 py-2.5 text-[13px] font-semibold text-ob-ink hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                        >
                            <FileText className="h-4 w-4 shrink-0 text-ob-ink-2" aria-hidden="true" />
                            {row.contract_attachment_name ?? t('Buka dokumen kontrak')}
                        </a>
                    )}
                </section>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ob-line px-6 py-4">
                {row.can_delete && (
                    <Button variant="ghost" className={cn(BTN.ghost, 'mr-auto text-ob-late hover:text-ob-late')} onClick={() => onDelete(row)} icon={<Trash2 className="h-4 w-4" />}>
                        {t('Hapus')}
                    </Button>
                )}
                {row.can_edit && (
                    <Button variant="outline" className={BTN.secondary} onClick={() => onEdit(row)} icon={<Pencil className="h-4 w-4" />}>
                        {t('Ubah')}
                    </Button>
                )}
                {row.can_submit && (
                    <Button className={BTN.primary} onClick={() => onSubmit(row)} icon={<Send className="h-4 w-4" />}>
                        {t('Ajukan untuk persetujuan')}
                    </Button>
                )}
                {row.can_approve && (
                    <Button className={BTN.primary} onClick={() => onApprove(row)}>
                        {t('Proses pengajuan')}
                    </Button>
                )}
                {row.can_pay && (
                    <Button className={BTN.primary} onClick={() => onPay(row)} icon={<Banknote className="h-4 w-4" />}>
                        {t('Catat pembayaran')}
                    </Button>
                )}
            </div>
        </>
    );
}

function Fakta({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5 pt-3 first:pt-0 sm:px-3 sm:pt-0 sm:first:pl-0 sm:last:pr-0">
            <span className="text-xs text-ob-ink-2">{label}</span>
            <span className="truncate text-[15px] font-semibold tabular-nums text-ob-ink">{value}</span>
            {sub && <span className="truncate text-xs text-ob-ink-3">{sub}</span>}
        </div>
    );
}

/** Baris keterangan; tidak dirender sama sekali bila isinya kosong. */
function Keterangan({ label, isi }: { label: string; isi: string | null }) {
    if (!isi) {
        return null;
    }
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-ob-ink">{label}</span>
            <p className="text-[13px] leading-relaxed text-ob-ink-2">{isi}</p>
        </div>
    );
}
