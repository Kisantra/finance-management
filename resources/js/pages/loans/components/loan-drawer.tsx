import { Banknote, FileText, Pencil, Trash2, X } from 'lucide-react';
import { JadwalAngsuran } from '@/components/jadwal-angsuran';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BTN, SURFACE, longDate, rp } from '@/pages/invoices/components/ob';
import { LoanStatusPill, interestLabel, totalInterest } from './pjm';
import type { LoanRow } from '../types';

/*
 * Rincian satu pinjaman. Panel samping, bukan modal di tengah: isinya tabel jadwal yang
 * tingginya ikut tenor — 36 termin di dalam modal terpusat jadi kotak yang menggulir sendiri
 * di tengah layar.
 */

interface Props {
    /** Null = tertutup. */
    row: LoanRow | null;
    onOpenChange: (open: boolean) => void;
    onEdit: (row: LoanRow) => void;
    onPay: (row: LoanRow) => void;
    onDelete: (row: LoanRow) => void;
}

export function LoanDrawer({ row, onOpenChange, onEdit, onPay, onDelete }: Props) {
    return (
        <Sheet open={!!row} onOpenChange={onOpenChange}>
            {/* 760, bukan 680: tabel jadwal butuh 680 px bersih, dan panelnya masih berpadding 24 px kiri-kanan. */}
            <SheetContent hideClose className={cn(SURFACE, 'ob-motion max-w-[760px] rounded-l-3xl border-l')}>
                {row && <Isi row={row} onClose={() => onOpenChange(false)} onEdit={onEdit} onPay={onPay} onDelete={onDelete} />}
            </SheetContent>
        </Sheet>
    );
}

/* Dipisah agar `JadwalAngsuran` dipasang ulang (dan datanya diambil ulang) tiap ganti pinjaman. */
function Isi({ row, onClose, onEdit, onPay, onDelete }: { row: LoanRow; onClose: () => void; onEdit: (row: LoanRow) => void; onPay: (row: LoanRow) => void; onDelete: (row: LoanRow) => void }) {
    const bunga = totalInterest(row);
    const persenTerbayar = row.principal_amount > 0 ? Math.round((row.paid_principal / row.principal_amount) * 100) : 0;
    const angsuranPerBulan = row.term_months > 0 ? Math.round((row.principal_amount + bunga) / row.term_months) : 0;

    return (
        <>
            <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
                <div className="min-w-0 flex-1">
                    <SheetTitle className="flex flex-wrap items-center gap-2 pr-0 text-xl font-semibold text-ob-ink dark:text-ob-ink">
                        <span className="truncate">{row.lender_name}</span>
                        <LoanStatusPill status={row.status} />
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-[13px] text-ob-ink-2 dark:text-ob-ink-2">
                        {row.loan_number} · {longDate(row.start_date)} sampai {longDate(row.maturity_date)}
                    </SheetDescription>
                </div>
                <Button variant="outline" className={BTN.icon} onClick={onClose} aria-label="Tutup rincian">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
                {/* Tiga angka yang menjawab "berapa, berapa mahal, berapa per bulan".
                    Menumpuk di bawah sm: sepertiga lebar 360 px memotong nominalnya jadi "Rp 120.0…". */}
                <div className="grid grid-cols-1 gap-3 divide-y divide-ob-line rounded-2xl bg-ob-inner p-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0">
                    <Fakta label="Pokok" value={rp(row.principal_amount)} />
                    {/* Sub hanya untuk bunga persentase: pada bunga nominal, interestLabel() mengembalikan
                        nominal yang sama dan barisnya cuma mengulang angka di atasnya. */}
                    <Fakta label="Bunga" value={rp(bunga)} sub={row.interest_type === 'percentage' ? interestLabel(row) : undefined} />
                    <Fakta label="Angsuran / bulan" value={rp(angsuranPerBulan)} sub={`${row.term_months} bulan`} />
                </div>

                <section aria-label="Progres pelunasan pokok" className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="font-semibold text-ob-ink">Pelunasan pokok</span>
                        <span className="tabular-nums text-ob-ink-2">{persenTerbayar}%</span>
                    </div>
                    <div
                        className="h-1.5 overflow-hidden rounded-full bg-ob-chip"
                        role="progressbar"
                        aria-valuenow={persenTerbayar}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Persentase pokok yang sudah dibayar"
                    >
                        <div className="h-full rounded-full bg-ob-act-fill" style={{ width: `${persenTerbayar}%` }} />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-ob-ink-2">
                        <span>
                            Dibayar <span className="tabular-nums text-ob-ink">{rp(row.paid_principal)}</span>
                            {row.paid_interest > 0 && (
                                <>
                                    {' '}
                                    · bunga <span className="tabular-nums text-ob-ink">{rp(row.paid_interest)}</span>
                                </>
                            )}
                        </span>
                        <span>
                            Sisa pokok{' '}
                            <span className={cn('tabular-nums', row.remaining_principal > 0 ? 'text-ob-neg' : 'text-ob-pos')}>
                                {row.remaining_principal > 0 ? rp(row.remaining_principal) : 'lunas'}
                            </span>
                        </span>
                    </div>
                </section>

                <section aria-label="Jadwal angsuran" className="flex flex-col gap-3 border-t border-ob-line pt-5">
                    <h3 className="text-base font-semibold text-ob-ink">Jadwal angsuran</h3>
                    <JadwalAngsuran path={`/loans/${row.id}/schedule`} label={`Jadwal angsuran pinjaman ${row.loan_number}`} />
                </section>

                {(row.purpose || row.contract_attachment_url) && (
                    <section aria-label="Lampiran dan catatan" className="flex flex-col gap-3 border-t border-ob-line pt-5">
                        {row.purpose && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[13px] font-semibold text-ob-ink">Tujuan pinjaman</span>
                                <p className="text-[13px] leading-relaxed text-ob-ink-2">{row.purpose}</p>
                            </div>
                        )}
                        {row.contract_attachment_url && (
                            <a
                                href={row.contract_attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-xl border border-ob-line px-3 py-2.5 text-[13px] font-semibold text-ob-ink hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                            >
                                <FileText className="h-4 w-4 shrink-0 text-ob-ink-2" aria-hidden="true" />
                                Buka dokumen kontrak
                            </a>
                        )}
                    </section>
                )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ob-line px-6 py-4">
                {/* Hapus hanya selama belum ada pembayaran — setelahnya menghapus berarti membalik transaksi bank. */}
                {row.paid_principal === 0 && (
                    <Button variant="ghost" className={cn(BTN.ghost, 'mr-auto text-ob-late hover:text-ob-late')} onClick={() => onDelete(row)} icon={<Trash2 className="h-4 w-4" />}>
                        Hapus
                    </Button>
                )}
                {row.status === 'active' && (
                    <>
                        <Button variant="outline" className={BTN.secondary} onClick={() => onEdit(row)} icon={<Pencil className="h-4 w-4" />}>
                            Edit
                        </Button>
                        <Button className={BTN.primary} onClick={() => onPay(row)} icon={<Banknote className="h-4 w-4" />}>
                            Catat pembayaran
                        </Button>
                    </>
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
