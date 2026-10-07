import { router } from '@inertiajs/react';
import { format } from 'date-fns';
import { Check, Link2, MoreHorizontal, Pencil, Printer, ReceiptText, RotateCcw, Send, Trash2, Wallet, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { FileUpload } from '@/components/shared/file-upload';
import { cn, toastError, toastErrors, toLocalIso } from '@/lib/utils';
import { InvoicePaper, type PaperZoom } from './invoice-paper';
import { BTN, dateTime, dueInfo, FIELD, getCsrfToken, InvoiceStatusPill, longDate, OverdueChip, rp, SumRow, SURFACE } from './ob';
import { PrintInvoiceDialog, type CustomTemplate } from './print-invoice-dialog';

/* ─────────────────────────────────── types ─── */

interface Payment {
    id: number;
    amount: number;
    payment_date: string;
    payment_method: 'cash' | 'bank_transfer';
    bank_account_id: number | null;
    bank_account_name: string | null;
    reference_number: string | null;
    attachment_name: string | null;
    attachment_url: string | null;
    created_at: string | null;
}

export interface InvoiceDetail {
    id: number;
    invoice_number: string | null;
    next_invoice_number: string | null;
    status: 'draft' | 'sent' | 'partially_paid' | 'paid';
    issue_date: string;
    due_date: string;
    subtotal: number;
    discount_amount: number;
    discount_type: string | null;
    discount_value: number | null;
    discount_reason: string | null;
    total_amount: number;
    amount_paid: number;
    amount_remaining: number;
    faktur: string | null;
    created_at: string | null;
    updated_at: string | null;
    rollbackable: boolean;
    custom_templates: CustomTemplate[];
    client: { id: number; name: string; type: string; email: string | null; NPWP: string | null; address: string | null };
    items: Array<{
        id: number;
        client_id: number | null;
        client_name: string | null;
        service_name: string;
        quantity: number;
        unit: string | null;
        unit_price: number;
        amount: number;
        cogs_amount: number;
        is_tax_deposit: boolean;
    }>;
    payments: Payment[];
}

type LoadState = { kind: 'loading' } | { kind: 'ready'; detail: InvoiceDetail } | { kind: 'missing' } | { kind: 'error'; message: string };

const JSON_HEADERS = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

/**
 * Aksi invoice lewat fetch JSON, bukan kunjungan Inertia: redirect back akan mengganti halaman
 * di belakang modal dan membuang hash #invoice/{id}. Galat validasi 422 dikembalikan per field.
 */
async function invoiceAction(url: string, method: 'POST' | 'DELETE', body?: Record<string, unknown>) {
    const res = await fetch(url, {
        method,
        headers: { ...JSON_HEADERS, 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    const errors: Record<string, string> = data.errors
        ? Object.fromEntries(Object.entries(data.errors as Record<string, string[]>).map(([k, v]) => [k, v[0]]))
        : res.ok
          ? {}
          : { _: data.message ?? `Server membalas ${res.status}.` };
    return { ok: res.ok, message: data.message as string | undefined, errors };
}

function qty(n: number): string {
    return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

/* ─────────────────────────────────── drawer ─── */

interface DrawerProps {
    invoiceId: number | null;
    onClose: () => void;
    /** Data invoice berubah (bayar, terbit, rollback, hapus): segarkan halaman di belakang drawer. */
    onChanged: () => void;
}

export function InvoiceDrawer({ invoiceId, onClose, onChanged }: DrawerProps) {
    const [state, setState] = React.useState<LoadState>({ kind: 'loading' });
    const [tab, setTab] = React.useState<'summary' | 'print'>('summary');
    const [dialog, setDialog] = React.useState<null | 'send' | 'pay' | 'print' | 'delete'>(null);
    const [editPayment, setEditPayment] = React.useState<Payment | null>(null);
    const [deletePayment, setDeletePayment] = React.useState<Payment | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [attempt, setAttempt] = React.useState(0);

    const load = React.useCallback(async (id: number, signal?: AbortSignal) => {
        try {
            const res = await fetch(`/invoices/${id}/data`, { headers: JSON_HEADERS, signal });
            if (res.status === 404) return setState({ kind: 'missing' });
            if (!res.ok) throw new Error(`Server membalas ${res.status}.`);
            setState({ kind: 'ready', detail: await res.json() });
        } catch (e) {
            if (signal?.aborted) return;
            console.error('[InvoiceDetail]', e);
            setState({ kind: 'error', message: e instanceof Error ? e.message : 'Periksa koneksi lalu coba lagi.' });
        }
    }, []);

    React.useEffect(() => {
        if (invoiceId == null) return;
        const controller = new AbortController();
        setState({ kind: 'loading' });
        setTab('summary');
        load(invoiceId, controller.signal);
        return () => controller.abort();
    }, [invoiceId, attempt, load]);

    const refresh = () => {
        if (invoiceId != null) load(invoiceId);
        onChanged();
    };

    const detail = state.kind === 'ready' ? state.detail : null;

    const rollback = async () => {
        if (!detail) return;
        setBusy(true);
        const result = await invoiceAction(`/invoices/${detail.id}/rollback`, 'POST').catch(() => null);
        setBusy(false);
        if (!result?.ok) return toastErrors(result?.errors ?? { _: 'Periksa koneksi lalu coba lagi.' }, 'RollbackInvoice');
        toast.success(result.message ?? 'Invoice dikembalikan ke draft.');
        refresh();
    };

    const destroy = async () => {
        if (!detail) return;
        setBusy(true);
        const result = await invoiceAction(`/invoices/${detail.id}`, 'DELETE').catch(() => null);
        setBusy(false);
        setDialog(null);
        if (!result?.ok) return toastErrors(result?.errors ?? { _: 'Periksa koneksi lalu coba lagi.' }, 'DeleteInvoice');
        toast.success(result.message ?? 'Invoice dihapus.');
        onChanged();
        onClose();
    };

    const removePayment = async () => {
        if (!deletePayment) return;
        setBusy(true);
        try {
            const res = await fetch(`/payments/${deletePayment.id}`, { method: 'DELETE', headers: { ...JSON_HEADERS, 'X-CSRF-TOKEN': getCsrfToken() } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toastError(data.message ?? `Pembayaran gagal dihapus (${res.status}).`);
            toast.success('Pembayaran dihapus.');
            setDeletePayment(null);
            refresh();
        } catch (e) {
            toastError(e instanceof Error ? e.message : 'Pembayaran gagal dihapus.');
        } finally {
            setBusy(false);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success('Tautan invoice disalin.');
        } catch {
            toastError('Tautan tidak dapat disalin', window.location.href);
        }
    };

    const canPay = detail && (detail.status === 'sent' || detail.status === 'partially_paid');
    const rollbackable = detail?.rollbackable ?? false;

    return (
        <>
            <Sheet open={invoiceId != null} onOpenChange={(o) => !o && onClose()}>
                <SheetContent
                    hideClose
                    aria-describedby={undefined}
                    className={cn(SURFACE, 'max-w-[920px] rounded-l-3xl border-l')}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <SheetTitle className="sr-only">{detail ? `Invoice ${detail.invoice_number ?? 'draft'} — ${detail.client.name}` : 'Detail invoice'}</SheetTitle>

                    {/* ── bilah atas ── */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2.5 px-6 pb-3 pt-5">
                        <Button variant="outline" className={BTN.icon} onClick={onClose} aria-label="Tutup detail">
                            <X className="h-4 w-4" />
                        </Button>
                        {detail && (
                            <>
                                <span className="font-mono text-[13px] text-ob-ink">{detail.invoice_number ?? 'belum bernomor'}</span>
                                <InvoiceStatusPill status={detail.status} />
                                <Button variant="ghost" className="h-8 w-8 rounded-full p-0 text-ob-ink-2 hover:bg-ob-hover hover:text-ob-ink dark:hover:bg-ob-hover" onClick={copyLink} aria-label="Salin tautan invoice">
                                    <Link2 className="h-4 w-4" />
                                </Button>
                                <div className="ml-auto flex items-center gap-2">
                                    {detail.invoice_number && (
                                        <Button variant="outline" className={cn(BTN.secondary, 'h-10')} onClick={() => setDialog('print')} icon={<Printer className="h-4 w-4" />}>
                                            Cetak
                                        </Button>
                                    )}
                                    {detail.status === 'draft' && (
                                        <Button className={cn(BTN.primary, 'h-10')} onClick={() => setDialog('send')} icon={<Send className="h-4 w-4" />}>
                                            Kirim invoice
                                        </Button>
                                    )}
                                    {canPay && (
                                        <Button className={cn(BTN.primary, 'h-10')} onClick={() => { setEditPayment(null); setDialog('pay'); }} icon={<Wallet className="h-4 w-4" />}>
                                            Catat pembayaran
                                        </Button>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className={BTN.icon} aria-label="Aksi lain">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                            <DropdownMenuItem onClick={() => router.visit(`/invoices/${detail.id}/edit`)}>
                                                <Pencil className="h-4 w-4" /> Edit invoice
                                            </DropdownMenuItem>
                                            {rollbackable && (
                                                <DropdownMenuItem onClick={rollback} disabled={busy}>
                                                    <RotateCcw className="h-4 w-4" /> Kembalikan ke draft
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-ob-late focus:text-ob-late" onClick={() => setDialog('delete')}>
                                                <Trash2 className="h-4 w-4" /> Hapus invoice
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
                        {state.kind === 'loading' && <DrawerSkeleton />}
                        {state.kind === 'missing' && (
                            <DrawerNotice title="Invoice tidak ditemukan" text={`Tautan /invoices/${invoiceId} mengarah ke invoice yang sudah dihapus atau tidak ada. Daftar invoice tetap terbuka.`} action={<Button variant="outline" className={BTN.small} onClick={onClose}>Tutup</Button>} />
                        )}
                        {state.kind === 'error' && (
                            <DrawerNotice
                                alert
                                title={`Invoice #${invoiceId} tidak dapat dimuat`}
                                text={`${state.message} Data di daftar tetap benar.`}
                                action={<Button variant="outline" className={BTN.small} onClick={() => setAttempt((n) => n + 1)}>Coba lagi</Button>}
                            />
                        )}
                        {detail && (
                            <DrawerBody
                                detail={detail}
                                tab={tab}
                                onTab={setTab}
                                onEditPayment={(p) => { setEditPayment(p); setDialog('pay'); }}
                                onDeletePayment={setDeletePayment}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {detail && (
                <>
                    <SendDialog open={dialog === 'send'} onOpenChange={(o) => setDialog(o ? 'send' : null)} detail={detail} onSent={refresh} />
                    <PaymentDialog
                        open={dialog === 'pay'}
                        onOpenChange={(o) => { setDialog(o ? 'pay' : null); if (!o) setEditPayment(null); }}
                        detail={detail}
                        payment={editPayment}
                        onSaved={refresh}
                    />
                    <PrintInvoiceDialog
                        open={dialog === 'print'}
                        onOpenChange={(o) => setDialog(o ? 'print' : null)}
                        invoiceId={detail.id}
                        invoiceNumber={detail.invoice_number}
                        totalAmount={detail.total_amount}
                        amountPaid={detail.amount_paid}
                        customTemplates={detail.custom_templates}
                    />
                    <ConfirmDialog
                        open={dialog === 'delete'}
                        onOpenChange={(o) => setDialog(o ? 'delete' : null)}
                        title="Hapus invoice"
                        description={
                            detail.payments.length > 0
                                ? 'Invoice ini sudah punya pembayaran. Hapus pembayarannya terlebih dahulu.'
                                : `Invoice ${detail.invoice_number ?? 'draft'} untuk ${detail.client.name} akan dihapus permanen beserta semua itemnya.`
                        }
                        confirmLabel="Hapus invoice"
                        loading={busy}
                        onConfirm={destroy}
                    />
                </>
            )}
            <ConfirmDialog
                open={!!deletePayment}
                onOpenChange={(o) => !o && setDeletePayment(null)}
                title="Hapus pembayaran"
                description={deletePayment ? `Pembayaran ${rp(deletePayment.amount)} tanggal ${longDate(deletePayment.payment_date)} akan dihapus dan saldo rekening ikut berkurang.` : ''}
                confirmLabel="Hapus pembayaran"
                loading={busy}
                onConfirm={removePayment}
            />
        </>
    );
}

/* ─────────────────────────────────── isi drawer ─── */

function DrawerBody({
    detail,
    tab,
    onTab,
    onEditPayment,
    onDeletePayment,
}: {
    detail: InvoiceDetail;
    tab: 'summary' | 'print';
    onTab: (t: 'summary' | 'print') => void;
    onEditPayment: (p: Payment) => void;
    onDeletePayment: (p: Payment) => void;
}) {
    const [zoom, setZoom] = React.useState<PaperZoom>('fit');

    const services = detail.items.filter((i) => !i.is_tax_deposit);
    const serviceTotal = services.reduce((s, i) => s + i.amount, 0);
    const deposits = detail.items.filter((i) => i.is_tax_deposit).reduce((s, i) => s + i.amount, 0);
    const cogs = services.reduce((s, i) => s + i.cogs_amount, 0);
    const grossProfit = detail.total_amount - deposits - cogs;
    const paidPct = detail.total_amount > 0 ? Math.min(100, Math.round((detail.amount_paid / detail.total_amount) * 100)) : 0;
    const due = dueInfo(detail.status, detail.due_date);
    const multiClient = new Set(detail.items.map((i) => i.client_id ?? detail.client.id)).size > 1;

    const history = [
        ...detail.payments.map((p) => ({
            at: p.created_at ?? p.payment_date,
            text: `Pembayaran ${rp(p.amount)} dicatat · ${p.payment_method === 'cash' ? 'tunai' : 'transfer'}`,
        })),
        ...(detail.created_at ? [{ at: detail.created_at, text: 'Dibuat sebagai draft' }] : []),
    ].sort((a, b) => b.at.localeCompare(a.at));

    return (
        <div className="flex flex-col gap-5 pt-2">
            <div>
                <h2 className="text-2xl font-semibold leading-tight text-ob-ink">{detail.client.name}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ob-ink-2">
                    <span>{detail.status === 'draft' ? 'Draft bertanggal' : 'Diterbitkan'} {longDate(detail.issue_date)}</span>
                    <span>· jatuh tempo {longDate(detail.due_date)}</span>
                    {due.label && detail.status !== 'paid' && (
                        due.overdue ? <OverdueChip label={due.label} /> : <span className={cn('font-semibold', due.tone === 'soon' ? 'text-ob-neg' : 'text-ob-ink-2')}>· {due.label}</span>
                    )}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Total" value={rp(detail.total_amount)} />
                <Metric label="Sudah dibayar" value={rp(detail.amount_paid)} valueClass="text-ob-pos" sub={`${paidPct}% terbayar`} />
                <Metric label="Sisa tagihan" value={rp(detail.amount_remaining)} />
                <Metric label="Laba kotor" value={rp(grossProfit)} valueClass={grossProfit < 0 ? 'text-ob-late' : undefined} sub="Pendapatan − HPP" />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ob-chip" role="progressbar" aria-label="Terbayar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-ob-pos" style={{ width: `${paidPct}%` }} />
            </div>

            <SegmentedControl
                variant="pill"
                label="Tampilan detail"
                options={[
                    { value: 'summary' as const, label: 'Ringkasan' },
                    { value: 'print' as const, label: 'Pratinjau cetak' },
                ]}
                value={tab}
                onChange={onTab}
                className="w-auto self-start [&>label]:sr-only"
            />

            {tab === 'print' ? (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[13px] text-ob-ink-2">
                        <span>Template Kisantra · sama dengan PDF unduhan</span>
                        <SegmentedControl variant="pill" label="Zoom kertas" options={[{ value: 'fit' as const, label: 'Pas lebar' }, { value: 'actual' as const, label: '100%' }]} value={zoom} onChange={setZoom} className="w-auto [&>label]:sr-only [&_button]:h-7 [&_button]:text-xs" />
                    </div>
                    <div className="rounded-2xl bg-ob-inner p-3">
                        {/* updated_at ikut di URL agar PDF dirender ulang setelah invoice berubah */}
                        <InvoicePaper src={`/invoice/${detail.id}/preview?v=${encodeURIComponent(detail.updated_at ?? '')}`} zoom={zoom} />
                    </div>
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_272px]">
                    <div className="flex min-w-0 flex-col gap-5">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3">
                                    <th className="py-2 pl-2.5 font-medium">Layanan</th>
                                    <th className="py-2 text-right font-medium">Qty</th>
                                    <th className="py-2 text-right font-medium">Harga</th>
                                    <th className="py-2 pr-2.5 text-right font-medium">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detail.items.map((item) => (
                                    <tr key={item.id} className={cn('border-b border-ob-line-soft', item.is_tax_deposit && 'bg-ob-inner')}>
                                        <td className="py-2.5 pl-2.5">
                                            <span className="flex items-center gap-2 font-medium text-ob-ink">
                                                {item.is_tax_deposit && <ReceiptText className="h-4 w-4 shrink-0 text-ob-ink-2" aria-hidden="true" />}
                                                {item.service_name}
                                            </span>
                                            <span className="block text-xs text-ob-ink-2">
                                                {item.is_tax_deposit ? 'Titipan pajak · bukan pendapatan' : `HPP ${rp(item.cogs_amount).replace('Rp ', '')}`}
                                                {multiClient && item.client_name ? ` · ${item.client_name}` : ''}
                                            </span>
                                        </td>
                                        <td className="py-2.5 text-right text-ob-ink-2">{qty(item.quantity)} {item.unit}</td>
                                        <td className="py-2.5 text-right text-ob-ink-2">{rp(item.unit_price).replace('Rp ', '')}</td>
                                        <td className="py-2.5 pr-2.5 text-right font-semibold text-ob-ink">{rp(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="ml-auto flex w-full max-w-[300px] flex-col gap-1">
                            <SumRow label="Subtotal layanan" value={rp(serviceTotal)} />
                            {deposits > 0 && <SumRow label="Titipan pajak" value={rp(deposits)} />}
                            {detail.discount_amount > 0 && (
                                <SumRow label={detail.discount_reason ? `Diskon (${detail.discount_reason})` : 'Diskon'} value={`− ${rp(detail.discount_amount)}`} />
                            )}
                            <SumRow label="Total" value={rp(detail.total_amount)} strong className="mt-1 border-t border-ob-line pt-2" />
                        </div>

                        <div>
                            <h3 className="mb-2 text-[13px] font-semibold text-ob-ink">Riwayat</h3>
                            <ol className="flex flex-col">
                                {history.map((h, i) => (
                                    <li key={i} className="grid grid-cols-[170px_minmax(0,1fr)] gap-3 border-b border-ob-line-soft py-2 text-[13px]">
                                        <span className="text-ob-ink-2">{h.at.length > 10 ? dateTime(h.at) : longDate(h.at)}</span>
                                        <span className="text-ob-ink">{h.text}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <section className="flex flex-col gap-1 rounded-2xl border border-ob-line bg-ob-inner p-4 text-[13px]">
                            <h3 className="mb-1 text-xs font-semibold text-ob-ink-2">Klien</h3>
                            <span className="font-semibold text-ob-ink">{detail.client.name}</span>
                            {detail.client.email && <span className="break-all text-ob-ink-2">{detail.client.email}</span>}
                            {detail.client.NPWP && <span className="text-ob-ink-2">NPWP {detail.client.NPWP}</span>}
                            {detail.client.address && <span className="text-ob-ink-2">{detail.client.address}</span>}
                            {detail.faktur && (
                                <span className="mt-1 flex items-center gap-1.5 border-t border-ob-line pt-2 text-ob-ink-2">
                                    <ReceiptText className="h-3.5 w-3.5 shrink-0" /> Faktur pajak {detail.faktur}
                                </span>
                            )}
                        </section>

                        <section className="flex flex-col gap-2 rounded-2xl border border-ob-line bg-ob-inner p-4 text-[13px]">
                            <h3 className="flex items-center justify-between text-xs font-semibold text-ob-ink-2">
                                Pembayaran <span className="font-medium">{detail.payments.length} kali</span>
                            </h3>
                            {detail.payments.length === 0 ? (
                                <p className="py-2 text-ob-ink-2">{detail.status === 'draft' ? 'Terbitkan invoice untuk mulai mencatat pembayaran.' : 'Belum ada pembayaran tercatat.'}</p>
                            ) : (
                                <ul className="flex flex-col">
                                    {detail.payments.map((p) => (
                                        <li key={p.id} className="flex items-start gap-2.5 border-b border-ob-line-soft py-2 last:border-0">
                                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ob-pos" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-ob-ink">{rp(p.amount)}</p>
                                                <p className="text-xs text-ob-ink-2">
                                                    {longDate(p.payment_date)} · {p.payment_method === 'cash' ? 'Tunai' : 'Transfer'}{p.bank_account_name ? ` · ${p.bank_account_name}` : ''}
                                                </p>
                                                {(p.reference_number || p.attachment_url) && (
                                                    <p className="flex items-center gap-1 truncate text-xs text-ob-ink-2">
                                                        {p.reference_number && <span className="truncate">Ref {p.reference_number}</span>}
                                                        {p.attachment_url && p.attachment_name && (
                                                            <AttachmentPreviewButton url={p.attachment_url} name={p.attachment_name} label="bukti" className="inline-flex items-center gap-1 text-ob-act hover:underline" />
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <Button variant="ghost" className="h-7 w-7 shrink-0 rounded-full p-0 text-ob-ink-3 hover:bg-ob-hover hover:text-ob-ink dark:hover:bg-ob-hover" aria-label={`Edit pembayaran ${rp(p.amount)}`} onClick={() => onEditPayment(p)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" className="h-7 w-7 shrink-0 rounded-full p-0 text-ob-ink-3 hover:bg-ob-late/10 hover:text-ob-late dark:hover:bg-ob-late/10" aria-label={`Hapus pembayaran ${rp(p.amount)}`} onClick={() => onDeletePayment(p)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex items-center justify-between border-t border-ob-line pt-2.5">
                                <span className="text-ob-ink-2">Sisa tagihan</span>
                                <span className="text-sm font-semibold text-ob-ink">{rp(detail.amount_remaining)}</span>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}

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
        <div className="flex flex-col gap-5 pt-2" aria-label="Memuat invoice" aria-busy="true">
            <Skeleton className="h-7 w-72 rounded-lg bg-ob-chip dark:bg-ob-chip" />
            <Skeleton className="h-4 w-96 rounded-lg bg-ob-chip dark:bg-ob-chip" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-[92px] rounded-2xl bg-ob-inner dark:bg-ob-inner" />
                ))}
            </div>
            {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 rounded-xl bg-ob-inner dark:bg-ob-inner" />
            ))}
        </div>
    );
}

/* ─────────────────────────────────── dialog: kirim ─── */

const DIALOG = cn(SURFACE, 'rounded-3xl p-6');

function DialogHead({ title, sub, onClose }: { title: string; sub?: React.ReactNode; onClose: () => void }) {
    return (
        <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-ob-ink dark:text-ob-ink">{title}</DialogTitle>
                {sub ? <DialogDescription className="mt-1 text-[13px] leading-relaxed text-ob-ink-2 dark:text-ob-ink-2">{sub}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
            </div>
            <Button variant="outline" className={cn(BTN.icon, 'h-8 w-8 shrink-0')} onClick={onClose} aria-label="Tutup">
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

function SendDialog({ open, onOpenChange, detail, onSent }: { open: boolean; onOpenChange: (o: boolean) => void; detail: InvoiceDetail; onSent: () => void }) {
    const suggested = detail.next_invoice_number ?? '';
    const [number, setNumber] = React.useState(suggested);
    const [error, setError] = React.useState<string | null>(null);
    const [sending, setSending] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setNumber(suggested);
            setError(null);
        }
    }, [open, suggested]);

    const send = async () => {
        setSending(true);
        const result = await invoiceAction(`/invoices/${detail.id}/send`, 'POST', { invoice_number: number }).catch(() => null);
        setSending(false);
        if (!result?.ok) {
            setError(result?.errors.invoice_number ?? null);
            return toastErrors(result?.errors ?? { _: 'Periksa koneksi lalu coba lagi.' }, 'SendInvoice');
        }
        toast.success(result.message ?? `Invoice diterbitkan: ${number}`);
        onOpenChange(false);
        onSent();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="md" hideClose className={DIALOG}>
                <DialogHead
                    title="Kirim invoice"
                    sub="Memberi nomor dan mengubah status menjadi Terkirim. Klien tidak menerima email otomatis; unduh PDF setelah terbit."
                    onClose={() => onOpenChange(false)}
                />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        send();
                    }}
                    className="flex flex-col gap-4"
                >
                    <div className={FIELD}>
                        <Input
                            label="Nomor invoice"
                            value={number}
                            onChange={(e) => {
                                setNumber(e.target.value);
                                setError(null);
                            }}
                            className="font-mono"
                            error={error ?? undefined}
                            hint="Nomor berikutnya sesuai format di Pengaturan › Penomoran invoice. Bisa dibatalkan (rollback) selama ini nomor urut terakhir di periodenya."
                            autoFocus
                        />
                    </div>
                        {error && number !== suggested && suggested && (
                            <button
                                type="button"
                                onClick={() => {
                                    setNumber(suggested);
                                    setError(null);
                                }} className="-mt-2 self-start text-[13px] font-semibold text-ob-act hover:underline">
                                Pakai nomor yang disarankan
                            </button>
                        )}
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-ob-line bg-ob-inner px-4 py-3 text-sm">
                        <span className="truncate text-ob-ink-2">{detail.client.name}</span>
                        <span className="font-semibold text-ob-ink">{rp(detail.total_amount)}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" className={BTN.primary} loading={sending} disabled={!number.trim()} icon={<Send className="h-4 w-4" />}>
                            Kirim invoice
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── dialog: pembayaran ─── */

interface PaymentForm {
    amount: number;
    payment_date: string;
    payment_method: 'bank_transfer' | 'cash';
    bank_account_id: number | null;
    reference_number: string;
    attachment: File | null;
    remove_attachment: boolean;
}

function PaymentDialog({
    open,
    onOpenChange,
    detail,
    payment,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    detail: InvoiceDetail;
    payment: Payment | null;
    onSaved: () => void;
}) {
    const remaining = detail.amount_remaining + (payment?.amount ?? 0);
    const [form, setForm] = React.useState<PaymentForm>(() => blankPayment(remaining));
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [saving, setSaving] = React.useState(false);
    const [accounts, setAccounts] = React.useState<{ label: string; value: number }[]>([]);
    const [preset, setPreset] = React.useState<'full' | 'half' | 'custom'>('full');
    const amountRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!open) return;
        setErrors({});
        setPreset(payment ? 'custom' : 'full');
        setForm(
            payment
                ? {
                      amount: payment.amount,
                      payment_date: payment.payment_date,
                      payment_method: payment.payment_method,
                      bank_account_id: payment.bank_account_id,
                      reference_number: payment.reference_number ?? '',
                      attachment: null,
                      remove_attachment: false,
                  }
                : blankPayment(remaining),
        );
        fetch('/api/bank-accounts', { headers: JSON_HEADERS })
            .then((r) => r.json())
            .then(setAccounts)
            .catch((e) => console.error('[BankAccounts]', e));
    }, [open, payment, remaining]);

    const set = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => setForm((f) => ({ ...f, [key]: value }));

    const choosePreset = (p: 'full' | 'half' | 'custom') => {
        setPreset(p);
        if (p === 'full') set('amount', remaining);
        if (p === 'half') set('amount', Math.round(remaining / 2));
        if (p === 'custom') {
            set('amount', 0);
            requestAnimationFrame(() => amountRef.current?.querySelector('input')?.focus());
        }
    };

    const overMessage = form.amount > remaining ? `Melebihi sisa tagihan ${rp(remaining)}. Catat kelebihan sebagai transaksi terpisah.` : null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (overMessage) return;
        setSaving(true);
        setErrors({});
        const fd = new FormData();
        fd.append('amount', String(form.amount));
        fd.append('payment_date', form.payment_date);
        fd.append('payment_method', form.payment_method);
        if (form.bank_account_id != null) fd.append('bank_account_id', String(form.bank_account_id));
        if (form.reference_number) fd.append('reference_number', form.reference_number);
        if (form.attachment) fd.append('attachment', form.attachment);
        if (payment && form.remove_attachment) fd.append('remove_attachment', '1');

        try {
            const res = await fetch(payment ? `/payments/${payment.id}` : `/invoices/${detail.id}/payments`, {
                method: 'POST',
                headers: { ...JSON_HEADERS, 'X-CSRF-TOKEN': getCsrfToken() },
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const errs: Record<string, string> = data.errors
                    ? Object.fromEntries(Object.entries(data.errors as Record<string, string[]>).map(([k, v]) => [k, v[0]]))
                    : { _: data.message ?? `Server membalas ${res.status}.` };
                setErrors(errs);
                toastErrors(errs, 'PaymentSubmit');
                return;
            }
            toast.success(payment ? 'Pembayaran diperbarui.' : `Pembayaran ${rp(form.amount)} dicatat.`);
            onOpenChange(false);
            onSaved();
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Pembayaran gagal disimpan.');
        } finally {
            setSaving(false);
        }
    };

    const chip = (key: 'full' | 'half' | 'custom', label: string) => (
        <button
            type="button"
            aria-pressed={preset === key}
            onClick={() => choosePreset(key)}
            className={cn(
                'h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                preset === key ? 'border-transparent bg-ob-invert text-ob-invert-ink' : 'border-ob-line text-ob-ink-2 hover:text-ob-ink',
            )}
        >
            {label}
        </button>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg" hideClose className={DIALOG}>
                <DialogHead
                    title={payment ? 'Edit pembayaran' : 'Catat pembayaran'}
                    sub={`${detail.invoice_number ?? 'Draft'} · sisa ${rp(remaining)}`}
                    onClose={() => onOpenChange(false)}
                />
                <form onSubmit={submit} className="flex flex-col gap-4">
                    {errors._ && <p role="alert" className="rounded-xl border border-ob-late/35 bg-ob-late/10 px-3 py-2 text-[13px] text-ob-late">{errors._}</p>}
                    <div ref={amountRef}>
                        <div className={FIELD}>
                        <CurrencyInput
                            label="Jumlah"
                            value={form.amount}
                            onChange={(v) => {
                                set('amount', v);
                                setPreset(v === remaining ? 'full' : v === Math.round(remaining / 2) ? 'half' : 'custom');
                            }}
                            error={overMessage ?? errors.amount}
                        />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {chip('full', 'Sisa penuh')}
                            {chip('half', '50%')}
                            {chip('custom', 'Nominal lain')}
                        </div>
                    </div>
                    <div className={cn(FIELD, 'grid gap-3 sm:grid-cols-2')}>
                        <DatePicker
                            label="Tanggal"
                            value={form.payment_date ? new Date(form.payment_date + 'T00:00:00') : null}
                            onChange={(d) => set('payment_date', d ? format(d, 'yyyy-MM-dd') : '')}
                            clearable={false}
                            error={errors.payment_date}
                        />
                        <Combobox
                            label="Rekening tujuan"
                            options={accounts}
                            value={form.bank_account_id}
                            onChange={(v) => set('bank_account_id', v != null ? Number(v) : null)}
                            placeholder="Pilih rekening"
                            searchPlaceholder="Cari rekening..."
                            clearable={false}
                            error={errors.bank_account_id}
                        />
                    </div>
                    <SegmentedControl
                        variant="pill"
                        label="Metode"
                        options={[
                            { value: 'bank_transfer' as const, label: 'Transfer bank' },
                            { value: 'cash' as const, label: 'Tunai' },
                        ]}
                        value={form.payment_method}
                        onChange={(v) => set('payment_method', v)}
                        error={errors.payment_method}
                        className="[&>label]:text-[13px] [&>label]:text-ob-ink-2 dark:[&>label]:text-ob-ink-2"
                    />
                    <div className={FIELD}>
                        <Input
                            label="Nomor referensi"
                            value={form.reference_number}
                            onChange={(e) => set('reference_number', e.target.value)}
                            placeholder="Opsional"
                            error={errors.reference_number}
                        />
                    </div>
                    <FileUpload
                        value={form.attachment}
                        onChange={(file) => setForm((f) => ({ ...f, attachment: file, remove_attachment: false }))}
                        existingFileName={!form.remove_attachment ? payment?.attachment_name ?? null : null}
                        existingFileUrl={!form.remove_attachment ? payment?.attachment_url ?? null : null}
                        onRemoveExisting={() => setForm((f) => ({ ...f, remove_attachment: true, attachment: null }))}
                        hint="Bukti transfer · JPG, PNG, PDF · maks 5 MB"
                        error={errors.attachment}
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" className={BTN.primary} loading={saving} disabled={!form.amount || !!overMessage} icon={<Check className="h-4 w-4" />}>
                            {payment ? 'Simpan perubahan' : 'Simpan pembayaran'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function blankPayment(remaining: number): PaymentForm {
    return {
        amount: Math.max(0, remaining),
        payment_date: toLocalIso(new Date()),
        payment_method: 'bank_transfer',
        bank_account_id: null,
        reference_number: '',
        attachment: null,
        remove_attachment: false,
    };
}
