import { Check, CircleDashed, FileText, Link2, MoreHorizontal, Pencil, Send, Trash2, Wallet, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { FilePreviewDialog } from '@/components/shared/file-preview-dialog';
import { cn, toastErrors, toLocalIso } from '@/lib/utils';
import { BTN, dateTime, FIELD, longDate, rp, SURFACE } from '@/pages/invoices/components/ob';
import { PersonAvatar, rbAction, ReimbursementStatusPill, type ReimbursementStatus } from './rb';
import { ReimbursementFormSheet, type CategoryOption } from './reimbursement-form-sheet';

/* ─────────────────────────────────── types ─── */

interface Option {
    label: string;
    value: number | string;
    disabled?: boolean;
}

interface Payment {
    id: number;
    amount: number;
    payment_date: string;
    notes: string | null;
    payer_name: string | null;
    bank_account_name: string | null;
    created_at: string | null;
}

export interface ReimbursementDetail {
    id: number;
    title: string;
    description: string | null;
    amount: number;
    amount_paid: number;
    amount_remaining: number;
    expense_date: string | null;
    category_input: string;
    category_label: string;
    transaction_category: string | null;
    status: ReimbursementStatus;
    user: { id: number; name: string | null };
    reviewer_name: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
    attachment_is_image: boolean;
    created_at: string | null;
    payments: Payment[];
    can_edit: boolean;
    can_delete: boolean;
    can_submit: boolean;
    can_review: boolean;
    can_pay: boolean;
    review_category_options: Option[];
    bank_account_options: Option[];
}

type LoadState = { kind: 'loading' } | { kind: 'ready'; detail: ReimbursementDetail } | { kind: 'missing' } | { kind: 'error'; message: string };

/* Pilihan kategori pemohon — sama dengan Reimbursement::categories() di server. */
const CATEGORY_OPTIONS: CategoryOption[] = [
    { label: 'Transportasi', value: 'transport' },
    { label: 'Makan & jamuan', value: 'meals' },
    { label: 'Perlengkapan kantor', value: 'office_supplies' },
    { label: 'Komunikasi', value: 'communication' },
    { label: 'Akomodasi', value: 'accommodation' },
    { label: 'Kesehatan', value: 'medical' },
    { label: 'Lainnya', value: 'other' },
];

/* ─────────────────────────────────── drawer ─── */

interface DrawerProps {
    reimbursementId: number | null;
    onClose: () => void;
    /** Data berubah (ajukan, review, bayar, hapus, edit): segarkan halaman di belakang drawer. */
    onChanged: () => void;
}

/**
 * Detail pengajuan sebagai drawer `#reimbursement/{id}` di atas halaman mana pun. Aksi kontekstual
 * sesuai status & izin di bilah atas; riwayat persetujuan dan pembayaran di kolom kanan.
 */
export function ReimbursementDrawer({ reimbursementId, onClose, onChanged }: DrawerProps) {
    const [state, setState] = React.useState<LoadState>({ kind: 'loading' });
    const [dialog, setDialog] = React.useState<null | 'approve' | 'reject' | 'pay' | 'submit' | 'delete' | 'edit'>(null);
    const [busy, setBusy] = React.useState(false);
    const [attempt, setAttempt] = React.useState(0);

    const load = React.useCallback(async (id: number, signal?: AbortSignal) => {
        try {
            const res = await fetch(`/reimbursements/${id}/data`, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, signal });
            if (res.status === 404) return setState({ kind: 'missing' });
            if (!res.ok) throw new Error(`Server membalas ${res.status}.`);
            setState({ kind: 'ready', detail: await res.json() });
        } catch (e) {
            if (signal?.aborted) return;
            console.error('[ReimbursementDetail]', e);
            setState({ kind: 'error', message: e instanceof Error ? e.message : 'Periksa koneksi lalu coba lagi.' });
        }
    }, []);

    React.useEffect(() => {
        if (reimbursementId == null) return;
        const controller = new AbortController();
        setState({ kind: 'loading' });
        load(reimbursementId, controller.signal);
        return () => controller.abort();
    }, [reimbursementId, attempt, load]);

    const detail = state.kind === 'ready' ? state.detail : null;

    const refresh = () => {
        if (reimbursementId != null) load(reimbursementId);
        onChanged();
    };

    const submit = async () => {
        if (!detail) return;
        setBusy(true);
        const result = await rbAction(`/reimbursements/${detail.id}/submit`, 'POST').catch(() => null);
        setBusy(false);
        setDialog(null);
        if (!result?.ok) return toastErrors(result?.errors ?? { _: 'Periksa koneksi lalu coba lagi.' }, 'Ajukan reimbursement');
        toast.success(result.message ?? 'Reimbursement diajukan');
        refresh();
    };

    const destroy = async () => {
        if (!detail) return;
        setBusy(true);
        const result = await rbAction(`/reimbursements/${detail.id}`, 'DELETE').catch(() => null);
        setBusy(false);
        setDialog(null);
        if (!result?.ok) return toastErrors(result?.errors ?? { _: 'Periksa koneksi lalu coba lagi.' }, 'Hapus reimbursement');
        toast.success(result.message ?? 'Reimbursement dihapus');
        onClose();
        onChanged();
    };

    const copyLink = async () => {
        await navigator.clipboard?.writeText(window.location.href).catch(() => {});
        toast.success('Tautan pengajuan disalin');
    };

    const rejected = detail?.status === 'rejected';

    return (
        <>
            <Sheet open={reimbursementId != null} onOpenChange={(o) => !o && onClose()}>
                <SheetContent hideClose aria-describedby={undefined} className={cn(SURFACE, 'max-w-[840px] rounded-l-3xl border-l')} onOpenAutoFocus={(e) => e.preventDefault()}>
                    <SheetTitle className="sr-only">{detail ? `Reimbursement — ${detail.title}` : 'Detail reimbursement'}</SheetTitle>

                    {/* ── bilah atas: aksi sesuai status & izin ── */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2.5 px-6 pb-3 pt-5">
                        <Button variant="outline" className={BTN.icon} onClick={onClose} aria-label="Tutup detail">
                            <X className="h-4 w-4" />
                        </Button>
                        {detail && (
                            <>
                                <ReimbursementStatusPill status={detail.status} />
                                <Button
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full p-0 text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink dark:hover:bg-ob-hover"
                                    onClick={copyLink}
                                    aria-label="Salin tautan pengajuan"
                                >
                                    <Link2 className="h-4 w-4" />
                                </Button>
                                <div className="ml-auto flex items-center gap-2">
                                    {detail.can_review && (
                                        <>
                                            <Button variant="outline" className={cn(BTN.secondary, 'h-10')} onClick={() => setDialog('reject')} icon={<X className="h-4 w-4" />}>
                                                Tolak
                                            </Button>
                                            <Button className={cn(BTN.primary, 'h-10')} onClick={() => setDialog('approve')} icon={<Check className="h-4 w-4" />}>
                                                Setujui
                                            </Button>
                                        </>
                                    )}
                                    {detail.can_pay && (
                                        <Button className={cn(BTN.primary, 'h-10')} onClick={() => setDialog('pay')} icon={<Wallet className="h-4 w-4" />}>
                                            Bayar
                                        </Button>
                                    )}
                                    {rejected && detail.can_edit ? (
                                        <Button className={cn(BTN.primary, 'h-10')} onClick={() => setDialog('edit')} icon={<Pencil className="h-4 w-4" />}>
                                            Perbaiki &amp; ajukan ulang
                                        </Button>
                                    ) : (
                                        detail.can_submit && (
                                            <Button className={cn(BTN.primary, 'h-10')} onClick={() => setDialog('submit')} icon={<Send className="h-4 w-4" />}>
                                                Ajukan
                                            </Button>
                                        )
                                    )}
                                    {(detail.can_edit || detail.can_delete) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className={BTN.icon} aria-label="Aksi lain">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {detail.can_edit && (
                                                    <DropdownMenuItem onClick={() => setDialog('edit')}>
                                                        <Pencil className="h-4 w-4" /> Edit pengajuan
                                                    </DropdownMenuItem>
                                                )}
                                                {detail.can_edit && detail.can_delete && <DropdownMenuSeparator />}
                                                {detail.can_delete && (
                                                    <DropdownMenuItem className="text-ob-late focus:text-ob-late" onClick={() => setDialog('delete')}>
                                                        <Trash2 className="h-4 w-4" /> Hapus pengajuan
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
                        {state.kind === 'loading' && <DrawerSkeleton />}
                        {state.kind === 'missing' && (
                            <DrawerNotice
                                title="Pengajuan tidak ditemukan"
                                text="Tautan ini mengarah ke pengajuan yang sudah dihapus, atau bukan milik Anda. Halaman di belakang tetap terbuka."
                                action={
                                    <Button variant="outline" className={BTN.small} onClick={onClose}>
                                        Tutup
                                    </Button>
                                }
                            />
                        )}
                        {state.kind === 'error' && (
                            <DrawerNotice
                                alert
                                title={`Pengajuan #${reimbursementId} tidak dapat dimuat`}
                                text={state.message}
                                action={
                                    <Button variant="outline" className={BTN.small} onClick={() => setAttempt((n) => n + 1)}>
                                        Coba lagi
                                    </Button>
                                }
                            />
                        )}
                        {detail && <DrawerBody detail={detail} />}
                    </div>
                </SheetContent>
            </Sheet>

            {detail && (
                <>
                    <ReviewDialog
                        mode={dialog === 'reject' ? 'reject' : 'approve'}
                        open={dialog === 'approve' || dialog === 'reject'}
                        onOpenChange={(o) => !o && setDialog(null)}
                        detail={detail}
                        onDone={refresh}
                    />
                    <PayDialog open={dialog === 'pay'} onOpenChange={(o) => !o && setDialog(null)} detail={detail} onDone={refresh} />
                    <ReimbursementFormSheet
                        open={dialog === 'edit'}
                        onOpenChange={(o) => !o && setDialog(null)}
                        categoryOptions={CATEGORY_OPTIONS}
                        initial={{ ...detail, status: detail.status }}
                        onSaved={refresh}
                    />
                    <ConfirmDialog
                        open={dialog === 'submit'}
                        onOpenChange={(o) => !o && setDialog(null)}
                        title="Ajukan pengajuan ini?"
                        description={`"${detail.title}" sebesar ${rp(detail.amount)} masuk ke antrean review finance dan tidak bisa diubah selama ditinjau.`}
                        confirmLabel="Ajukan"
                        loading={busy}
                        onConfirm={submit}
                    />
                    <ConfirmDialog
                        open={dialog === 'delete'}
                        onOpenChange={(o) => !o && setDialog(null)}
                        title="Hapus pengajuan"
                        description={`"${detail.title}" beserta bukti terlampir akan dihapus permanen.`}
                        confirmLabel="Hapus pengajuan"
                        loading={busy}
                        onConfirm={destroy}
                    />
                </>
            )}
        </>
    );
}

/* ─────────────────────────────────── isi drawer ─── */

function DrawerBody({ detail }: { detail: ReimbursementDetail }) {
    const paidPct = detail.amount > 0 ? Math.min(100, Math.round((detail.amount_paid / detail.amount) * 100)) : 0;
    const showPayment = detail.status === 'approved' || detail.status === 'paid';

    return (
        <div className="flex flex-col gap-5 pt-2">
            <div>
                <h2 className="text-2xl font-semibold leading-tight text-ob-ink">{detail.title}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ob-ink-2">
                    <PersonAvatar name={detail.user.name} className="h-6 w-6 text-[10px]" />
                    <span className="font-medium text-ob-ink">{detail.user.name ?? '—'}</span>
                    {detail.expense_date && <span>· pengeluaran {longDate(detail.expense_date)}</span>}
                    <span>· {detail.category_label}</span>
                </p>
            </div>

            {detail.status === 'rejected' && (
                <div role="note" className="flex flex-col gap-1 rounded-2xl border border-ob-late/30 bg-ob-late/8 p-4 text-[13px]">
                    <span className="font-semibold text-ob-late">
                        Ditolak{detail.reviewer_name ? ` oleh ${detail.reviewer_name}` : ''}
                        {detail.reviewed_at ? ` · ${dateTime(detail.reviewed_at)}` : ''}
                    </span>
                    <span className="text-ob-ink">{detail.review_notes || 'Tanpa catatan dari peninjau.'}</span>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Metric label="Nominal" value={rp(detail.amount)} />
                <Metric label="Sudah dibayar" value={rp(detail.amount_paid)} valueClass={detail.amount_paid > 0 ? 'text-ob-pos' : undefined} sub={showPayment ? `${paidPct}% terbayar` : undefined} />
                <Metric label="Sisa" value={rp(detail.amount_remaining)} />
            </div>
            {showPayment && (
                <div className="h-1.5 overflow-hidden rounded-full bg-ob-chip" role="progressbar" aria-label="Terbayar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-ob-pos" style={{ width: `${paidPct}%` }} />
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="flex min-w-0 flex-col gap-5">
                    <section className="flex flex-col gap-3">
                        <h3 className="text-[13px] font-semibold text-ob-ink">Rincian</h3>
                        <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]">
                            <dt className="text-ob-ink-2">Kategori pemohon</dt>
                            <dd className="text-ob-ink">{detail.category_label}</dd>
                            <dt className="text-ob-ink-2">Kategori akuntansi</dt>
                            <dd className={detail.transaction_category ? 'text-ob-ink' : 'text-ob-ink-3'}>{detail.transaction_category ?? 'Ditentukan finance saat menyetujui'}</dd>
                            <dt className="text-ob-ink-2">Tanggal pengeluaran</dt>
                            <dd className="text-ob-ink">{detail.expense_date ? longDate(detail.expense_date) : '—'}</dd>
                            <dt className="text-ob-ink-2">Keterangan</dt>
                            <dd className={cn('whitespace-pre-line', detail.description ? 'text-ob-ink' : 'text-ob-ink-3')}>{detail.description || 'Tidak ada keterangan'}</dd>
                        </dl>
                    </section>

                    <section className="flex flex-col gap-3">
                        <h3 className="text-[13px] font-semibold text-ob-ink">Bukti</h3>
                        <ReceiptCard detail={detail} />
                    </section>
                </div>

                <section className="flex flex-col gap-3 self-start rounded-2xl border border-ob-line bg-ob-inner p-4">
                    <h3 className="text-xs font-semibold text-ob-ink-2">Riwayat</h3>
                    <Timeline detail={detail} />
                </section>
            </div>
        </div>
    );
}

function ReceiptCard({ detail }: { detail: ReimbursementDetail }) {
    const [preview, setPreview] = React.useState(false);

    if (!detail.attachment_url || !detail.attachment_name) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ob-line-strong px-4 py-5 text-[13px] text-ob-ink-2">
                <FileText className="h-5 w-5 shrink-0 text-ob-ink-3" aria-hidden="true" />
                Tidak ada bukti dilampirkan.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-ob-line bg-ob-inner p-3">
            {detail.attachment_is_image && (
                <button
                    type="button"
                    onClick={() => setPreview(true)}
                    aria-label={`Perbesar bukti ${detail.attachment_name}`}
                    className="block w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                >
                    <img src={detail.attachment_url} alt={`Bukti: ${detail.attachment_name}`} className="max-h-[260px] w-full rounded-xl bg-ob-card object-contain" />
                </button>
            )}
            <div className="flex items-center gap-3 px-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ob-chip text-ob-ink-2" aria-hidden="true">
                    <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ob-ink">{detail.attachment_name}</span>
                <Button type="button" variant="outline" className={BTN.small} onClick={() => setPreview(true)}>
                    Buka
                </Button>
            </div>
            <FilePreviewDialog open={preview} onOpenChange={setPreview} fileName={detail.attachment_name} fileUrl={detail.attachment_url} />
        </div>
    );
}

type Step = { at: string | null; title: string; body?: React.ReactNode; tone: 'done' | 'pos' | 'late' | 'next' };

/** Riwayat vertikal: langkah yang sudah terjadi, lalu langkah berikutnya yang ditunggu. */
function Timeline({ detail }: { detail: ReimbursementDetail }) {
    const steps: Step[] = [{ at: detail.created_at, title: 'Dibuat', body: detail.user.name ?? undefined, tone: 'done' }];

    if (detail.reviewed_at && (detail.status === 'approved' || detail.status === 'paid')) {
        steps.push({
            at: detail.reviewed_at,
            title: `Disetujui${detail.reviewer_name ? ` · ${detail.reviewer_name}` : ''}`,
            body: [detail.transaction_category && `Kategori ${detail.transaction_category}`, detail.review_notes].filter(Boolean).join(' — ') || undefined,
            tone: 'done',
        });
    }
    if (detail.reviewed_at && detail.status === 'rejected') {
        steps.push({ at: detail.reviewed_at, title: `Ditolak${detail.reviewer_name ? ` · ${detail.reviewer_name}` : ''}`, body: detail.review_notes ?? undefined, tone: 'late' });
    }
    detail.payments.forEach((p, i) => {
        const last = detail.status === 'paid' && i === detail.payments.length - 1;
        steps.push({
            // Tanggal bayar (bukan waktu pencatatan) yang relevan untuk pemohon & arus kas.
            at: p.payment_date,
            title: `${last ? 'Pelunasan' : 'Pembayaran'} ${rp(p.amount)}`,
            body: [p.bank_account_name, p.payer_name && `oleh ${p.payer_name}`, p.notes && `Ref ${p.notes}`].filter(Boolean).join(' · '),
            tone: 'pos',
        });
    });

    const next: Record<ReimbursementStatus, string | null> = {
        draft: 'Belum diajukan',
        pending: 'Menunggu review finance',
        approved: `Menunggu pembayaran · sisa ${rp(detail.amount_remaining)}`,
        rejected: 'Menunggu perbaikan dari pemohon',
        paid: null,
    };
    if (next[detail.status]) steps.push({ at: null, title: next[detail.status] as string, tone: 'next' });

    return (
        <ol className="flex flex-col">
            {steps.map((s, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[9px] top-5 h-[calc(100%-12px)] w-px bg-ob-line-strong" />}
                    <span
                        aria-hidden="true"
                        className={cn(
                            'relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full',
                            s.tone === 'done' && 'bg-ob-invert text-ob-invert-ink',
                            s.tone === 'pos' && 'bg-ob-pos text-white',
                            s.tone === 'late' && 'bg-ob-late text-white',
                            s.tone === 'next' && 'border border-dashed border-ob-line-strong bg-ob-card text-ob-ink-3',
                        )}
                    >
                        {s.tone === 'late' ? <X className="h-3 w-3" strokeWidth={3} /> : s.tone === 'next' ? <CircleDashed className="h-3 w-3" /> : <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1 text-[13px]">
                        <p className={cn('font-semibold', s.tone === 'next' ? 'text-ob-ink-2' : 'text-ob-ink')}>{s.title}</p>
                        {s.at && <p className="text-xs text-ob-ink-3">{s.at.length > 10 ? dateTime(s.at) : longDate(s.at)}</p>}
                        {s.body && <p className="mt-0.5 break-words text-xs text-ob-ink-2">{s.body}</p>}
                    </div>
                </li>
            ))}
        </ol>
    );
}

/* ─────────────────────────────────── dialog ─── */

const DIALOG = cn(SURFACE, 'rounded-3xl p-6');

function DialogHead({ title, sub, onClose }: { title: string; sub?: React.ReactNode; onClose: () => void }) {
    return (
        <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-ob-ink dark:text-ob-ink">{title}</DialogTitle>
                {sub ? (
                    <DialogDescription className="mt-1 text-[13px] leading-relaxed text-ob-ink-2 dark:text-ob-ink-2">{sub}</DialogDescription>
                ) : (
                    <DialogDescription className="sr-only">{title}</DialogDescription>
                )}
            </div>
            <Button variant="outline" className={cn(BTN.icon, 'h-8 w-8 shrink-0')} onClick={onClose} aria-label="Tutup">
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

function Summary({ detail, label, value }: { detail: ReimbursementDetail; label?: string; value?: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-ob-line bg-ob-inner px-4 py-3 text-sm">
            <span className="min-w-0">
                <span className="block truncate font-medium text-ob-ink">{detail.title}</span>
                <span className="block truncate text-xs text-ob-ink-2">{detail.user.name ?? '—'}</span>
            </span>
            <span className="shrink-0 text-right">
                {label && <span className="block text-xs text-ob-ink-2">{label}</span>}
                <span className="font-semibold text-ob-ink">{value ?? rp(detail.amount)}</span>
            </span>
        </div>
    );
}

function ReviewDialog({
    mode,
    open,
    onOpenChange,
    detail,
    onDone,
}: {
    mode: 'approve' | 'reject';
    open: boolean;
    onOpenChange: (o: boolean) => void;
    detail: ReimbursementDetail;
    onDone: () => void;
}) {
    const [categoryId, setCategoryId] = React.useState<number | null>(null);
    const [notes, setNotes] = React.useState('');
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        setCategoryId(null);
        setNotes('');
        setErrors({});
    }, [open]);

    const approve = mode === 'approve';

    const save = async () => {
        setSaving(true);
        const result = await rbAction(`/reimbursements/${detail.id}/review`, 'POST', {
            action: mode,
            review_notes: notes || null,
            category_id: approve ? categoryId : null,
        }).catch(() => null);
        setSaving(false);
        if (!result?.ok) {
            setErrors(result?.errors ?? {});
            return toastErrors(result?.errors ?? { _: 'Periksa koneksi lalu coba lagi.' }, 'Review reimbursement');
        }
        toast.success(result.message ?? (approve ? 'Disetujui' : 'Ditolak'));
        onOpenChange(false);
        onDone();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
            <DialogContent size="md" hideClose className={DIALOG}>
                <DialogHead
                    title={approve ? 'Setujui pengajuan' : 'Tolak pengajuan'}
                    sub={
                        approve
                            ? 'Pilih kategori akuntansi; kategori ini dipakai untuk transaksi bank saat pembayaran.'
                            : 'Pemohon bisa memperbaiki lalu mengajukan ulang. Jelaskan apa yang perlu diperbaiki.'
                    }
                    onClose={() => onOpenChange(false)}
                />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        save();
                    }}
                    className="flex flex-col gap-4"
                >
                    <Summary detail={detail} />
                    <div className={cn(FIELD, 'flex flex-col gap-4')}>
                        {approve && (
                            <Combobox
                                label="Kategori akuntansi"
                                options={detail.review_category_options}
                                value={categoryId}
                                onChange={(v) => {
                                    setCategoryId(v ? Number(v) : null);
                                    setErrors({});
                                }}
                                placeholder="Pilih kategori pengeluaran"
                                searchPlaceholder="Cari kategori…"
                                error={errors.category_id}
                                clearable={false}
                            />
                        )}
                        <Textarea
                            id="rb-review-notes"
                            label={approve ? 'Catatan (opsional)' : 'Alasan penolakan'}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={approve ? 'Catatan untuk pemohon…' : 'cth. Lampirkan struk asli dari restoran.'}
                            rows={3}
                            maxLength={500}
                            error={errors.review_notes}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)} disabled={saving}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            className={approve ? BTN.primary : cn(BTN.primary, 'bg-ob-late hover:bg-ob-late/90 dark:bg-ob-late dark:hover:bg-ob-late/90')}
                            loading={saving}
                            disabled={approve && !categoryId}
                            icon={approve ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        >
                            {approve ? 'Setujui' : 'Tolak pengajuan'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PayDialog({ open, onOpenChange, detail, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; detail: ReimbursementDetail; onDone: () => void }) {
    const [bankId, setBankId] = React.useState<number | null>(null);
    const [date, setDate] = React.useState<Date | null>(new Date());
    const [amount, setAmount] = React.useState(0);
    const [notes, setNotes] = React.useState('');
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        setBankId(null);
        setDate(new Date());
        setAmount(detail.amount_remaining);
        setNotes('');
        setErrors({});
    }, [open, detail.amount_remaining]);

    const over = amount > detail.amount_remaining;

    const save = async () => {
        setSaving(true);
        const result = await rbAction(`/reimbursements/${detail.id}/pay`, 'POST', {
            bank_account_id: bankId,
            payment_date: date ? toLocalIso(date) : null,
            payment_amount: amount,
            reference_notes: notes || null,
        }).catch(() => null);
        setSaving(false);
        if (!result?.ok) {
            setErrors(result?.errors ?? {});
            return toastErrors(result?.errors ?? { _: 'Periksa koneksi lalu coba lagi.' }, 'Pembayaran reimbursement');
        }
        toast.success(result.message ?? 'Pembayaran dicatat');
        onOpenChange(false);
        onDone();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
            <DialogContent size="md" hideClose className={DIALOG}>
                <DialogHead
                    title="Bayar reimbursement"
                    sub="Mencatat transaksi keluar dari rekening yang dipilih. Boleh dicicil; nominal tidak boleh melebihi sisa."
                    onClose={() => onOpenChange(false)}
                />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        save();
                    }}
                    className="flex flex-col gap-4"
                >
                    <Summary detail={detail} label="Sisa" value={rp(detail.amount_remaining)} />
                    <div className={cn(FIELD, 'flex flex-col gap-4')}>
                        <Combobox
                            label="Rekening sumber"
                            options={detail.bank_account_options}
                            value={bankId}
                            onChange={(v) => {
                                setBankId(v ? Number(v) : null);
                                setErrors((e) => ({ ...e, bank_account_id: '' }));
                            }}
                            placeholder="Pilih rekening"
                            error={errors.bank_account_id || undefined}
                            clearable={false}
                        />
                        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                            <DatePicker label="Tanggal bayar" value={date} onChange={setDate} maxDate={new Date()} clearable={false} error={errors.payment_date} />
                            <CurrencyInput
                                label="Nominal"
                                value={amount}
                                onChange={(v) => {
                                    setAmount(v);
                                    setErrors((e) => ({ ...e, payment_amount: '' }));
                                }}
                                error={over ? `Melebihi sisa ${rp(detail.amount_remaining)}.` : errors.payment_amount || undefined}
                            />
                        </div>
                        <Input id="rb-pay-ref" label="Nomor referensi (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="cth. TRF-2026-1008" maxLength={255} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)} disabled={saving}>
                            Batal
                        </Button>
                        <Button type="submit" className={BTN.primary} loading={saving} disabled={!bankId || !date || amount <= 0 || over} icon={<Wallet className="h-4 w-4" />}>
                            {amount >= detail.amount_remaining ? 'Bayar lunas' : 'Bayar sebagian'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── kecil ─── */

function Metric({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-ob-line bg-ob-inner p-4">
            <span className="text-[13px] text-ob-ink-2">{label}</span>
            <span className={cn('truncate text-lg font-semibold text-ob-ink', valueClass)}>{value}</span>
            {sub && <span className="text-xs text-ob-ink-2">{sub}</span>}
        </div>
    );
}

function DrawerNotice({ title, text, action, alert }: { title: string; text: string; action?: React.ReactNode; alert?: boolean }) {
    return (
        <div role={alert ? 'alert' : undefined} className="mt-4 flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ob-line-strong p-6 text-center">
            {alert && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ob-late/15 text-[13px] font-bold text-ob-late">!</span>}
            <span className="text-sm font-semibold text-ob-ink">{title}</span>
            <span className="max-w-[360px] text-[13px] leading-relaxed text-ob-ink-2">{text}</span>
            {action}
        </div>
    );
}

function DrawerSkeleton() {
    return (
        <div className="flex flex-col gap-5 pt-2" aria-label="Memuat pengajuan" aria-busy="true">
            <Skeleton className="h-7 w-72 rounded-lg bg-ob-chip dark:bg-ob-chip" />
            <Skeleton className="h-4 w-80 rounded-lg bg-ob-chip dark:bg-ob-chip" />
            <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-[88px] rounded-2xl bg-ob-inner dark:bg-ob-inner" />
                ))}
            </div>
            {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 rounded-xl bg-ob-inner dark:bg-ob-inner" />
            ))}
        </div>
    );
}
