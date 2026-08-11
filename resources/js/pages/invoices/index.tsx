import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowUpDown,
    CheckCircle2,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    MoreHorizontal,
    Pencil,
    Plus,
    Printer,
    RotateCcw,
    Search,
    Send,
    TrendingUp,
    Trash2,
    Wallet,
    X,
} from 'lucide-react';
import * as React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs } from '@/components/ui/tabs';
import type { TabItem } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { PrintInvoiceDialog } from './components/print-invoice-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyInput } from '@/components/shared/currency-input';
import { EmptyState } from '@/components/shared/empty-state';
import { FileUpload } from '@/components/shared/file-upload';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { AppLayout } from '@/layouts/app-layout';
import { format as formatDateFns } from 'date-fns';
import { companyUrl } from '@/lib/company';
import { cn, formatCurrency, formatDate, toLocalIso } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface InvoiceRow {
    id: number;
    invoice_number: string | null;
    client_name: string;
    client_type: string;
    issue_date: string;
    due_date: string;
    total_amount: number;
    amount_paid: number;
    amount_remaining: number;
    status: 'draft' | 'sent' | 'partially_paid' | 'paid';
    faktur: string | null;
}

interface PaginatedInvoices {
    data: InvoiceRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Stats {
    invoice_count: number;
    total_revenue: number;
    total_cogs: number;
    gross_profit: number;
    total_paid: number;
    total_outstanding: number;
    draft_count: number;
    sent_count: number;
    partially_paid_count: number;
    paid_count: number;
}

interface ClientOption {
    label: string;
    value: number;
}

interface Filters {
    search?: string | null;
    status?: string | null;
    client_ids?: number[];
    month?: string;
    date_from?: string | null;
    date_to?: string | null;
    per_page?: number;
    sort?: string;
    direction?: string;
}

interface InvoiceDetail {
    id: number;
    invoice_number: string | null;
    status: string;
    issue_date: string;
    due_date: string;
    subtotal: number;
    discount_amount: number;
    discount_type: string;
    discount_value: number;
    discount_reason: string | null;
    total_amount: number;
    amount_paid: number;
    amount_remaining: number;
    faktur: string | null;
    client: {
        id: number;
        name: string;
        email: string | null;
        NPWP: string | null;
        address: string | null;
    };
    items: Array<{
        id: number;
        service_name: string;
        quantity: number;
        unit: string;
        unit_price: number;
        amount: number;
        cogs_amount: number;
        is_tax_deposit: boolean;
    }>;
    payments: Array<{
        id: number;
        amount: number;
        payment_date: string;
        payment_method: 'cash' | 'bank_transfer';
        bank_account_id: number | null;
        bank_account_name: string | null;
        reference_number: string | null;
        attachment_name: string | null;
        attachment_url: string | null;
    }>;
}

interface CustomTemplate {
    id: number;
    name: string;
    isDefault: boolean;
}

interface Props extends SharedProps {
    invoices: PaginatedInvoices;
    stats: Stats;
    clients: ClientOption[];
    rollbackableIds: number[];
    customTemplates: CustomTemplate[];
    filters: Filters;
}

/* ─────────────────────────────────── helpers ─── */

const STATUS_VARIANT: Record<string, 'zinc' | 'blue' | 'yellow' | 'green'> = {
    draft: 'zinc',
    sent: 'blue',
    partially_paid: 'yellow',
    paid: 'green',
};

const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft',
    sent: 'Terkirim',
    partially_paid: 'Sebagian',
    paid: 'Lunas',
};

function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase();
}

function getCsrfToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '';
}

function daysDiff(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((today.getTime() - target.getTime()) / 86400000);
}

function relativeIssueDate(dateStr: string): string {
    const diff = daysDiff(dateStr);
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin';
    return `${diff} hari lalu`;
}

function relativeDueDate(dateStr: string): { label: string; overdue: boolean } {
    const diff = daysDiff(dateStr);
    if (diff < 0) return { label: `${Math.abs(diff)} hari lagi`, overdue: false };
    if (diff === 0) return { label: 'Hari ini', overdue: false };
    return { label: `${diff} hari lewat`, overdue: true };
}

/* ─────────────────────────────────── slide-over ─── */

interface PaymentFormState {
    amount: number;
    payment_date: string;
    payment_method: 'cash' | 'bank_transfer';
    bank_account_id: number | null;
    reference_number: string;
    attachment: File | null;
    remove_attachment: boolean;
}

const EMPTY_PAYMENT_FORM: PaymentFormState = {
    amount: 0,
    payment_date: toLocalIso(new Date()),
    payment_method: 'bank_transfer',
    bank_account_id: null,
    reference_number: '',
    attachment: null,
    remove_attachment: false,
};

function InvoiceDrawer({
    open,
    onClose,
    invoiceId,
    rollbackableIds,
    customTemplates,
}: {
    open: boolean;
    onClose: () => void;
    invoiceId: number | null;
    rollbackableIds: number[];
    customTemplates: CustomTemplate[];
}) {
    const [detail, setDetail] = React.useState<InvoiceDetail | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [sendOpen, setSendOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleteLoading, setDeleteLoading] = React.useState(false);

    /* payment state */
    const [bankAccounts, setBankAccounts] = React.useState<{ label: string; value: number }[]>([]);
    const [paymentFormOpen, setPaymentFormOpen] = React.useState(false);
    const [editPayment, setEditPayment] = React.useState<InvoiceDetail['payments'][number] | null>(null);
    const [deletePaymentTarget, setDeletePaymentTarget] = React.useState<InvoiceDetail['payments'][number] | null>(null);
    const [paymentForm, setPaymentForm] = React.useState<PaymentFormState>(EMPTY_PAYMENT_FORM);
    const [paymentErrors, setPaymentErrors] = React.useState<Record<string, string>>({});
    const [paymentLoading, setPaymentLoading] = React.useState(false);
    const [deletePaymentLoading, setDeletePaymentLoading] = React.useState(false);

    const sendForm = useForm({ invoice_number: '' });

    const [printOpen, setPrintOpen] = React.useState(false);

    const fetchDetail = React.useCallback((id: number) => {
        setLoading(true);
        fetch(companyUrl(`/invoices/${id}`), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then((r) => r.json())
            .then((data) => {
                setDetail(data);
                if (data.status === 'draft') {
                    sendForm.setData('invoice_number', data.invoice_number ?? '');
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    React.useEffect(() => {
        if (!open || !invoiceId) {
            setDetail(null);
            return;
        }
        fetchDetail(invoiceId);
    }, [open, invoiceId]);

    React.useEffect(() => {
        if (!open) return;
        fetch(companyUrl('/api/bank-accounts'), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then((r) => r.json())
            .then(setBankAccounts)
            .catch(console.error);
    }, [open]);

    const handleSend = () => {
        if (!detail) return;
        sendForm.post(companyUrl(`/invoices/${detail.id}/send`), {
            onSuccess: () => {
                setSendOpen(false);
                onClose();
            },
        });
    };

    const handleRollback = () => {
        if (!detail) return;
        router.post(companyUrl(`/invoices/${detail.id}/rollback`), {}, { onSuccess: () => onClose() });
    };

    const handleDelete = () => {
        if (!detail) return;
        setDeleteLoading(true);
        router.delete(companyUrl(`/invoices/${detail.id}`), {
            onSuccess: () => {
                setDeleteOpen(false);
                onClose();
            },
            onFinish: () => setDeleteLoading(false),
        });
    };

    /* ── payment CRUD ── */

    const openCreatePayment = () => {
        const remaining = detail ? detail.amount_remaining : 0;
        setPaymentForm({ ...EMPTY_PAYMENT_FORM, amount: remaining > 0 ? remaining : 0 });
        setPaymentErrors({});
        setEditPayment(null);
        setPaymentFormOpen(true);
    };

    const openEditPayment = (p: InvoiceDetail['payments'][number]) => {
        setPaymentForm({
            amount: p.amount,
            payment_date: p.payment_date,
            payment_method: p.payment_method,
            bank_account_id: p.bank_account_id,
            reference_number: p.reference_number ?? '',
            attachment: null,
            remove_attachment: false,
        });
        setPaymentErrors({});
        setEditPayment(p);
        setPaymentFormOpen(true);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detail) return;

        setPaymentLoading(true);
        setPaymentErrors({});

        const fd = new FormData();
        fd.append('amount', String(paymentForm.amount));
        fd.append('payment_date', paymentForm.payment_date);
        fd.append('payment_method', paymentForm.payment_method);
        if (paymentForm.bank_account_id != null) {
            fd.append('bank_account_id', String(paymentForm.bank_account_id));
        }
        if (paymentForm.reference_number) {
            fd.append('reference_number', paymentForm.reference_number);
        }
        if (paymentForm.attachment) {
            fd.append('attachment', paymentForm.attachment);
        }
        if (editPayment && paymentForm.remove_attachment) {
            fd.append('remove_attachment', '1');
        }

        const url = editPayment
            ? companyUrl(`/payments/${editPayment.id}`)
            : companyUrl(`/invoices/${detail.id}/payments`);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: fd,
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.errors) {
                    setPaymentErrors(data.errors);
                } else {
                    setPaymentErrors({ _: data.message ?? 'Terjadi kesalahan.' });
                    console.error('[PaymentSubmit]', res.status, data);
                }
                return;
            }

            setPaymentFormOpen(false);
            setEditPayment(null);
            fetchDetail(detail.id);
            router.reload({ only: ['invoices', 'stats'] });
        } catch (err) {
            setPaymentErrors({ _: err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.' });
            console.error('[PaymentSubmit] network error', err);
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleDeletePayment = async () => {
        if (!deletePaymentTarget || !detail) return;
        setDeletePaymentLoading(true);
        try {
            const res = await fetch(companyUrl(`/payments/${deletePaymentTarget.id}`), {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            if (res.ok) {
                setDeletePaymentTarget(null);
                fetchDetail(detail.id);
                router.reload({ only: ['invoices', 'stats'] });
            } else {
                const data = await res.json().catch(() => ({}));
                console.error('[DeletePayment]', res.status, data);
            }
        } catch (err) {
            console.error('[DeletePayment] network error', err);
        } finally {
            setDeletePaymentLoading(false);
        }
    };

    const isRollbackable = detail ? rollbackableIds.includes(detail.id) : false;
    const canAddPayment = detail && (detail.status === 'sent' || detail.status === 'partially_paid');

    const netRevenue = detail
        ? detail.items.filter((i) => !i.is_tax_deposit).reduce((s, i) => s + i.amount, 0)
        : 0;
    const totalCogs = detail
        ? detail.items.filter((i) => !i.is_tax_deposit).reduce((s, i) => s + i.cogs_amount, 0)
        : 0;
    const totalTaxDeposits = detail
        ? detail.items.filter((i) => i.is_tax_deposit).reduce((s, i) => s + i.amount, 0)
        : 0;
    const grossProfit = detail ? detail.total_amount - totalTaxDeposits - totalCogs : 0;

    return (
        <>
            <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
                <SheetContent size="3xl">
                    <SheetHeader>
                        <div className="flex items-center gap-3 pr-6">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                                <SheetTitle className="text-lg font-bold pr-0">
                                    {detail?.invoice_number ?? (loading ? '...' : 'Invoice Draft')}
                                </SheetTitle>
                                {detail && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Badge variant={STATUS_VARIANT[detail.status] ?? 'zinc'}>
                                            {STATUS_LABEL[detail.status] ?? detail.status}
                                        </Badge>
                                        <span className="text-xs text-dark-500 dark:text-dark-400">
                                            {detail.client.name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SheetHeader>

                    <SheetBody className="space-y-6">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
                        </div>
                    )}

                    {!loading && detail && (
                        <>
                            {/* Summary metrics */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl border border-secondary-200 dark:border-dark-600 bg-secondary-50 dark:bg-dark-800">
                                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">Total Invoice</p>
                                    <p className="text-lg font-bold text-dark-900 dark:text-dark-50">
                                        {formatCurrency(detail.total_amount)}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl border border-secondary-200 dark:border-dark-600 bg-secondary-50 dark:bg-dark-800">
                                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">Sudah Dibayar</p>
                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {formatCurrency(detail.amount_paid)}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl border border-secondary-200 dark:border-dark-600 bg-secondary-50 dark:bg-dark-800">
                                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">Sisa Tagihan</p>
                                    <p className={cn(
                                        'text-lg font-bold',
                                        detail.amount_remaining > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-dark-900 dark:text-dark-50',
                                    )}>
                                        {formatCurrency(detail.amount_remaining)}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl border border-secondary-200 dark:border-dark-600 bg-secondary-50 dark:bg-dark-800">
                                    <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">Laba Kotor</p>
                                    <p className={cn(
                                        'text-lg font-bold',
                                        grossProfit >= 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-600 dark:text-red-400',
                                    )}>
                                        {formatCurrency(grossProfit)}
                                    </p>
                                </div>
                            </div>

                            {/* Client & Dates */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50 border-b border-secondary-200 dark:border-dark-600 pb-2">
                                    Info Invoice
                                </h3>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div>
                                        <span className="text-dark-500 dark:text-dark-400">Klien</span>
                                        <p className="font-medium text-dark-900 dark:text-dark-50 mt-0.5">{detail.client.name}</p>
                                    </div>
                                    <div>
                                        <span className="text-dark-500 dark:text-dark-400">NPWP</span>
                                        <p className="font-medium text-dark-900 dark:text-dark-50 mt-0.5">{detail.client.NPWP ?? '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-dark-500 dark:text-dark-400">Tgl Invoice</span>
                                        <p className="font-medium text-dark-900 dark:text-dark-50 mt-0.5">{formatDate(detail.issue_date)}</p>
                                    </div>
                                    <div>
                                        <span className="text-dark-500 dark:text-dark-400">Jatuh Tempo</span>
                                        <p className="font-medium text-dark-900 dark:text-dark-50 mt-0.5">{formatDate(detail.due_date)}</p>
                                    </div>
                                    {detail.client.email && (
                                        <div className="col-span-2">
                                            <span className="text-dark-500 dark:text-dark-400">Email</span>
                                            <p className="font-medium text-dark-900 dark:text-dark-50 mt-0.5">{detail.client.email}</p>
                                        </div>
                                    )}
                                    {detail.client.address && (
                                        <div className="col-span-2">
                                            <span className="text-dark-500 dark:text-dark-400">Alamat</span>
                                            <p className="font-medium text-dark-900 dark:text-dark-50 mt-0.5">{detail.client.address}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50 border-b border-secondary-200 dark:border-dark-600 pb-2">
                                    Item Invoice
                                </h3>
                                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-secondary-50 dark:bg-dark-800 border-b border-secondary-200 dark:border-dark-600">
                                                <th className="text-left px-3 py-2 text-xs font-semibold text-dark-600 dark:text-dark-400">Layanan</th>
                                                <th className="text-right px-3 py-2 text-xs font-semibold text-dark-600 dark:text-dark-400">Qty</th>
                                                <th className="text-right px-3 py-2 text-xs font-semibold text-dark-600 dark:text-dark-400">Harga</th>
                                                <th className="text-right px-3 py-2 text-xs font-semibold text-dark-600 dark:text-dark-400">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.items.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    className={cn(
                                                        'border-b border-secondary-200 dark:border-dark-600 last:border-0',
                                                        item.is_tax_deposit && 'bg-yellow-50/50 dark:bg-yellow-900/10',
                                                    )}
                                                >
                                                    <td className="px-3 py-2.5">
                                                        <div className="font-medium text-dark-900 dark:text-dark-50">{item.service_name}</div>
                                                        {item.is_tax_deposit && (
                                                            <span className="text-xs text-yellow-600 dark:text-yellow-400">Titipan Pajak Klien</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-dark-600 dark:text-dark-400">
                                                        {item.quantity} {item.unit}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-dark-600 dark:text-dark-400">
                                                        {formatCurrency(item.unit_price)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-dark-900 dark:text-dark-50">
                                                        {formatCurrency(item.amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-secondary-50 dark:bg-dark-800">
                                            {detail.discount_amount > 0 && (
                                                <>
                                                    <tr className="border-t border-secondary-200 dark:border-dark-600">
                                                        <td colSpan={3} className="px-3 py-2 text-sm text-dark-600 dark:text-dark-400">Subtotal</td>
                                                        <td className="px-3 py-2 text-right text-sm text-dark-900 dark:text-dark-50">{formatCurrency(detail.subtotal)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={3} className="px-3 py-1.5 text-sm text-dark-600 dark:text-dark-400">
                                                            Diskon
                                                            {detail.discount_reason && (
                                                                <span className="text-xs text-dark-400 ml-1">({detail.discount_reason})</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right text-sm text-red-600 dark:text-red-400">
                                                            -{formatCurrency(detail.discount_amount)}
                                                        </td>
                                                    </tr>
                                                </>
                                            )}
                                            <tr className="border-t border-secondary-200 dark:border-dark-600">
                                                <td colSpan={3} className="px-3 py-2.5 font-bold text-dark-900 dark:text-dark-50">Total</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-dark-900 dark:text-dark-50">{formatCurrency(detail.total_amount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Payments */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-secondary-200 dark:border-dark-600 pb-2">
                                    <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50">
                                        Riwayat Pembayaran
                                    </h3>
                                    {canAddPayment && (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            icon={<Plus className="w-3.5 h-3.5" />}
                                            onClick={openCreatePayment}
                                        >
                                            Catat Pembayaran
                                        </Button>
                                    )}
                                </div>

                                {detail.payments.length === 0 ? (
                                    <p className="text-sm text-dark-500 dark:text-dark-400 py-2">
                                        Belum ada pembayaran tercatat.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {detail.payments.map((p) => (
                                            <div
                                                key={p.id}
                                                className="flex items-start justify-between p-3 rounded-xl border border-secondary-200 dark:border-dark-600 bg-secondary-50 dark:bg-dark-800"
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-blue-50 dark:bg-blue-900/20">
                                                        <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-dark-900 dark:text-dark-50">
                                                            {formatDate(p.payment_date)}
                                                        </p>
                                                        {p.bank_account_name && (
                                                            <p className="text-xs text-dark-500 dark:text-dark-400 truncate">{p.bank_account_name}</p>
                                                        )}
                                                        {p.reference_number && (
                                                            <p className="text-xs text-dark-400 dark:text-dark-500">Ref: {p.reference_number}</p>
                                                        )}
                                                        {p.attachment_name && p.attachment_url && (
                                                            <AttachmentPreviewButton
                                                                url={p.attachment_url}
                                                                name={p.attachment_name}
                                                                label={p.attachment_name}
                                                                className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mt-0.5"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 ml-3">
                                                    <p className="font-bold text-green-600 dark:text-green-400 text-sm mr-1">
                                                        +{formatCurrency(p.amount)}
                                                    </p>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        icon={<Pencil className="w-3.5 h-3.5" />}
                                                        onClick={() => openEditPayment(p)}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                                                        onClick={() => setDeletePaymentTarget(p)}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* HPP breakdown */}
                            {(netRevenue > 0 || totalCogs > 0) && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50 border-b border-secondary-200 dark:border-dark-600 pb-2">
                                        Analisis Laba
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        {[
                                            { label: 'Pendapatan Bersih', value: netRevenue, cls: '' },
                                            { label: 'HPP / COGS', value: totalCogs, cls: 'text-red-600 dark:text-red-400' },
                                            { label: 'Titipan Pajak', value: totalTaxDeposits, cls: 'text-yellow-600 dark:text-yellow-400' },
                                            {
                                                label: 'Laba Kotor',
                                                value: grossProfit,
                                                cls: grossProfit >= 0
                                                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                                    : 'text-red-600 dark:text-red-400 font-bold',
                                            },
                                        ].map(({ label, value, cls }) => (
                                            <div key={label} className="flex justify-between">
                                                <span className="text-dark-600 dark:text-dark-400">{label}</span>
                                                <span className={cn('font-medium text-dark-900 dark:text-dark-50', cls)}>
                                                    {formatCurrency(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    </SheetBody>

                    {detail && (
                        <SheetFooter className="flex-wrap">
                            {detail.status === 'draft' && (
                                <Button
                                    size="sm"
                                    variant="primary"
                                    icon={<Send className="w-3.5 h-3.5" />}
                                    onClick={() => setSendOpen(true)}
                                >
                                    Kirim Invoice
                                </Button>
                            )}
                            {isRollbackable && (
                                <Button
                                    size="sm"
                                    variant="yellow"
                                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                                    onClick={handleRollback}
                                >
                                    Rollback ke Draft
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                icon={<Pencil className="w-3.5 h-3.5" />}
                                onClick={() => router.get(companyUrl(`/invoices/${detail.id}/edit`))}
                            >
                                Edit
                            </Button>
                            {detail.invoice_number && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    icon={<Printer className="w-3.5 h-3.5" />}
                                    onClick={() => setPrintOpen(true)}
                                >
                                    Cetak
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto"
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => setDeleteOpen(true)}
                            >
                                Hapus
                            </Button>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>

            {/* Print options modal */}
            {detail && (
                <PrintInvoiceDialog
                    open={printOpen}
                    onOpenChange={setPrintOpen}
                    invoiceId={detail.id}
                    invoiceNumber={detail.invoice_number}
                    totalAmount={detail.total_amount}
                    amountPaid={detail.amount_paid}
                    customTemplates={customTemplates}
                />
            )}

            {/* Send modal */}
            <Dialog open={sendOpen} onOpenChange={setSendOpen}>
                <DialogContent size="md">
                    <DialogHeader>
                        <div className="flex items-center gap-4 py-2">
                            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <Send className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                    Kirim Invoice
                                </DialogTitle>
                                <p className="text-sm text-dark-600 dark:text-dark-400">
                                    Konfirmasi nomor invoice sebelum mengirim
                                </p>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="px-6 py-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-dark-900 dark:text-dark-300 mb-1.5">
                                Nomor Invoice
                            </label>
                            <Input
                                value={sendForm.data.invoice_number}
                                onChange={(e) => sendForm.setData('invoice_number', e.target.value)}
                                placeholder="001/INV/KSN-XXX/I/2026"
                                error={sendForm.errors.invoice_number}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="zinc" onClick={() => setSendOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSend}
                            loading={sendForm.processing}
                            className="w-full sm:w-auto order-1 sm:order-2"
                        >
                            Konfirmasi & Kirim
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment form modal */}
            <Dialog open={paymentFormOpen} onOpenChange={(o) => { if (!o) { setPaymentFormOpen(false); setEditPayment(null); } }}>
                <DialogContent size="md">
                    <form onSubmit={handlePaymentSubmit}>
                        <DialogHeader>
                            <div className="flex items-center gap-4 py-2">
                                <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                    <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                        {editPayment ? 'Edit Pembayaran' : 'Catat Pembayaran'}
                                    </DialogTitle>
                                    <p className="text-sm text-dark-600 dark:text-dark-400">
                                        {detail?.invoice_number ?? 'Invoice'}
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="px-6 py-4 space-y-4">
                            {paymentErrors._ && (
                                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                                    {paymentErrors._}
                                </div>
                            )}

                            <CurrencyInput
                                label="Jumlah Pembayaran *"
                                value={paymentForm.amount}
                                onChange={(v) => setPaymentForm((f) => ({ ...f, amount: v }))}
                                error={paymentErrors.amount}
                            />

                            <DatePicker
                                label="Tanggal Pembayaran *"
                                value={paymentForm.payment_date ? new Date(paymentForm.payment_date + 'T00:00:00') : null}
                                onChange={(v) => setPaymentForm((f) => ({ ...f, payment_date: v ? formatDateFns(v, 'yyyy-MM-dd') : '' }))}
                                error={paymentErrors.payment_date}
                            />

                            <Combobox
                                label="Rekening Tujuan *"
                                options={bankAccounts}
                                value={paymentForm.bank_account_id}
                                onChange={(v) => setPaymentForm((f) => ({ ...f, bank_account_id: v != null ? Number(v) : null }))}
                                placeholder="Pilih rekening..."
                                hint="Untuk pembayaran tunai, pilih rekening kas."
                                error={paymentErrors.bank_account_id}
                            />

                            <Input
                                label="Nomor Referensi"
                                value={paymentForm.reference_number}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, reference_number: e.target.value }))}
                                placeholder="No. transfer / cek / kwitansi"
                                error={paymentErrors.reference_number}
                            />

                            {/* Attachment */}
                            <FileUpload
                                label="Lampiran"
                                value={paymentForm.attachment}
                                onChange={(file) => setPaymentForm((f) => ({ ...f, attachment: file, remove_attachment: false }))}
                                existingFileName={!paymentForm.remove_attachment ? (editPayment?.attachment_name ?? null) : null}
                                existingFileUrl={!paymentForm.remove_attachment ? (editPayment?.attachment_url ?? null) : null}
                                onRemoveExisting={() => setPaymentForm((f) => ({ ...f, remove_attachment: true, attachment: null }))}
                                error={paymentErrors.attachment}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="zinc"
                                onClick={() => { setPaymentFormOpen(false); setEditPayment(null); }}
                                disabled={paymentLoading}
                                className="w-full sm:w-auto order-2 sm:order-1"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={paymentLoading}
                                className="w-full sm:w-auto order-1 sm:order-2"
                            >
                                {editPayment ? 'Simpan Perubahan' : 'Simpan Pembayaran'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete invoice confirm */}
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Hapus Invoice"
                description={`Invoice ${detail?.invoice_number ?? 'ini'} akan dihapus permanen beserta semua item-nya.`}
                confirmLabel="Hapus Invoice"
                loading={deleteLoading}
                onConfirm={handleDelete}
            />

            {/* Delete payment confirm */}
            <ConfirmDialog
                open={!!deletePaymentTarget}
                onOpenChange={(o) => { if (!o) setDeletePaymentTarget(null); }}
                title="Hapus Pembayaran"
                description={deletePaymentTarget
                    ? `Pembayaran sebesar ${formatCurrency(deletePaymentTarget.amount)} pada ${formatDate(deletePaymentTarget.payment_date)} akan dihapus permanen.`
                    : ''}
                confirmLabel="Hapus Pembayaran"
                loading={deletePaymentLoading}
                onConfirm={handleDeletePayment}
            />
        </>
    );
}

/* ─────────────────────────────────── main page ─── */

const DEFAULT_MONTH = toLocalIso(new Date()).slice(0, 7);


/* Colored accent config for stats cards */
const STATS_CONFIG = [
    {
        key: 'revenue',
        label: 'Total Pendapatan',
        accent: 'bg-blue-500',
        iconCn: 'text-blue-500 dark:text-blue-400',
        icon: <Wallet className="w-5 h-5" />,
    },
    {
        key: 'profit',
        label: 'Laba Kotor',
        accent: 'bg-emerald-500',
        accentNeg: 'bg-red-500',
        iconCn: 'text-emerald-500 dark:text-emerald-400',
        iconCnNeg: 'text-red-500 dark:text-red-400',
        icon: <TrendingUp className="w-5 h-5" />,
    },
    {
        key: 'paid',
        label: 'Terbayar',
        accent: 'bg-green-500',
        iconCn: 'text-green-500 dark:text-green-400',
        icon: <CheckCircle2 className="w-5 h-5" />,
    },
    {
        key: 'outstanding',
        label: 'Outstanding',
        accent: 'bg-amber-500',
        iconCn: 'text-amber-500 dark:text-amber-400',
        icon: <AlertCircle className="w-5 h-5" />,
    },
] as const;

/* Pipeline segments for status distribution */
const PIPELINE_SEGMENTS = [
    { key: 'draft', label: 'Draft', bar: 'bg-zinc-300 dark:bg-zinc-600', dot: 'bg-zinc-400 dark:bg-zinc-500' },
    { key: 'sent', label: 'Terkirim', bar: 'bg-blue-400 dark:bg-blue-500', dot: 'bg-blue-400 dark:bg-blue-500' },
    { key: 'partially_paid', label: 'Sebagian', bar: 'bg-amber-400 dark:bg-amber-500', dot: 'bg-amber-400 dark:bg-amber-500' },
    { key: 'paid', label: 'Lunas', bar: 'bg-emerald-400 dark:bg-emerald-500', dot: 'bg-emerald-400 dark:bg-emerald-500' },
] as const;

const TABLE_COLS: { key: string; label: string; align?: 'right'; sortable?: false }[] = [
    { key: 'invoice_number', label: 'No. Invoice' },
    { key: 'client_name', label: 'Klien' },
    { key: 'issue_date', label: 'Tgl Invoice' },
    { key: 'due_date', label: 'Jatuh Tempo' },
    { key: 'total_amount', label: 'Jumlah', align: 'right' },
    { key: 'status', label: 'Status', sortable: false },
    { key: 'actions', label: '', sortable: false },
];

function InvoicesPage({ invoices, stats, clients, rollbackableIds, customTemplates, filters }: Props) {
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<number | null>(null);

    /* delete from table row */
    const [deleteId, setDeleteId] = React.useState<number | null>(null);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleteLoading, setDeleteLoading] = React.useState(false);

    const [printRow, setPrintRow] = React.useState<InvoiceRow | null>(null);
    const [printOpen, setPrintOpen] = React.useState(false);

    const currentFilters = {
        search: filters.search ?? '',
        status: filters.status ?? '',
        client_ids: filters.client_ids ?? [],
        month: filters.month ?? '',
        date_from: filters.date_from ?? '',
        date_to: filters.date_to ?? '',
        sort: filters.sort ?? 'issue_date',
        direction: filters.direction ?? 'desc',
        per_page: filters.per_page ?? 25,
    };

    /* A date range, when set, overrides the month filter (both fields stay visible). */
    const hasRange = !!currentFilters.date_from || !!currentFilters.date_to;
    const dateRange = {
        from: currentFilters.date_from ? new Date(currentFilters.date_from) : null,
        to: currentFilters.date_to ? new Date(currentFilters.date_to) : null,
    };

    const [search, setSearch] = React.useState(currentFilters.search);

    const navigate = (params: Record<string, unknown>) => {
        router.get(companyUrl('/invoices'), { ...currentFilters, ...params, page: 1 }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    /* Build an export URL carrying the active filters so the recap matches the listing. */
    const buildExportUrl = (format: 'excel' | 'pdf'): string => {
        const params = new URLSearchParams();
        if (currentFilters.search) params.set('search', currentFilters.search);
        if (currentFilters.status) params.set('status', currentFilters.status);
        // Always send month (even empty = "Semua") + the range. The backend lets
        // the range override the month, matching the on-screen listing exactly.
        params.set('month', currentFilters.month ?? '');
        if (currentFilters.date_from) params.set('date_from', currentFilters.date_from);
        if (currentFilters.date_to) params.set('date_to', currentFilters.date_to);
        (currentFilters.client_ids ?? []).forEach((id) => params.append('client_ids[]', String(id)));
        if (currentFilters.sort) params.set('sort', currentFilters.sort);
        if (currentFilters.direction) params.set('direction', currentFilters.direction);
        const qs = params.toString();
        return companyUrl(`/invoices/export/${format}${qs ? `?${qs}` : ''}`);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate({ search });
    };

    const handlePageChange = (page: number) => {
        router.get(companyUrl('/invoices'), { ...currentFilters, page }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleDateRangeChange = (range: { from: Date | null; to: Date | null }) => {
        navigate({
            date_from: range.from ? toLocalIso(range.from) : '',
            date_to: range.to ? toLocalIso(range.to) : '',
        });
    };

    const handleResetFilters = () => {
        setSearch('');
        navigate({ search: '', status: '', client_ids: [], month: DEFAULT_MONTH, date_from: '', date_to: '' });
    };

    const handleDeleteFromTable = () => {
        if (!deleteId) return;
        setDeleteLoading(true);
        router.delete(companyUrl(`/invoices/${deleteId}`), {
            onSuccess: () => {
                setDeleteOpen(false);
                setDeleteId(null);
            },
            onFinish: () => setDeleteLoading(false),
        });
    };

    const openDrawer = (id: number) => {
        setSelectedId(id);
        setDrawerOpen(true);
    };

    const activeFiltersCount = [
        !!currentFilters.status,
        currentFilters.client_ids.length > 0,
        !!currentFilters.search,
        hasRange || (currentFilters.month && currentFilters.month !== DEFAULT_MONTH),
    ].filter(Boolean).length;

    const tabItems: TabItem[] = [
        { value: '', label: 'Semua' },
        { value: 'draft', label: 'Draft', badge: stats.draft_count || undefined },
        { value: 'sent', label: 'Terkirim', badge: stats.sent_count || undefined },
        { value: 'partially_paid', label: 'Sebagian', badge: stats.partially_paid_count || undefined },
        { value: 'paid', label: 'Lunas', badge: stats.paid_count || undefined },
    ];

    return (
        <>
            <Head title="Invoice" />

            <div className="space-y-6">
                {/* Header */}
                <PageHeader
                    title="Invoice"
                    description="Kelola semua invoice dan pembayaran klien"
                    action={
                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="md" icon={<Download className="w-4 h-4" />}>
                                        Export
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <a href={buildExportUrl('excel')}>
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            Export Excel
                                        </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <a href={buildExportUrl('pdf')}>
                                            <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                                            Export PDF
                                        </a>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                variant="primary"
                                size="md"
                                icon={<Plus className="w-4 h-4" />}
                                onClick={() => router.get(companyUrl('/invoices/create'))}
                            >
                                Buat Invoice
                            </Button>
                        </div>
                    }
                />

                {/* ── Stats cards ── */}
                <TooltipProvider delayDuration={300}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* Total Pendapatan */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="hover:shadow-md transition-all duration-200 overflow-hidden cursor-default">
                                    <div className={STATS_CONFIG[0].accent + ' h-1'} />
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
                                                {STATS_CONFIG[0].label}
                                            </p>
                                            <span className={STATS_CONFIG[0].iconCn + ' shrink-0'}>{STATS_CONFIG[0].icon}</span>
                                        </div>
                                        <p className="text-xl font-bold text-dark-900 dark:text-dark-50 leading-none">
                                            {formatCurrency(stats.total_revenue)}
                                        </p>
                                        <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                                            Semua status invoice
                                        </p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-56 text-center">
                                Total nilai semua invoice yang diterbitkan pada periode yang dipilih, mencakup semua status kecuali yang dihapus
                            </TooltipContent>
                        </Tooltip>

                        {/* Laba Kotor */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="hover:shadow-md transition-all duration-200 overflow-hidden cursor-default">
                                    <div className={cn('h-1', stats.gross_profit < 0 ? 'bg-red-500' : 'bg-emerald-500')} />
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
                                                {STATS_CONFIG[1].label}
                                            </p>
                                            <span className={cn('shrink-0', stats.gross_profit < 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400')}>
                                                {STATS_CONFIG[1].icon}
                                            </span>
                                        </div>
                                        <p className={cn('text-xl font-bold leading-none', stats.gross_profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-dark-900 dark:text-dark-50')}>
                                            {formatCurrency(stats.gross_profit)}
                                        </p>
                                        <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                                            Pendapatan − HPP − Pajak
                                        </p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-56 text-center">
                                Dihitung dari pendapatan bersih dikurangi HPP dan titipan pajak. Nilai merah berarti total biaya melebihi pendapatan.
                            </TooltipContent>
                        </Tooltip>

                        {/* Terbayar */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="hover:shadow-md transition-all duration-200 overflow-hidden cursor-default">
                                    <div className={STATS_CONFIG[2].accent + ' h-1'} />
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
                                                {STATS_CONFIG[2].label}
                                            </p>
                                            <span className={STATS_CONFIG[2].iconCn + ' shrink-0'}>{STATS_CONFIG[2].icon}</span>
                                        </div>
                                        <p className="text-xl font-bold text-dark-900 dark:text-dark-50 leading-none">
                                            {formatCurrency(stats.total_paid)}
                                        </p>
                                        <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                                            Pembayaran pada invoice periode ini
                                        </p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-56 text-center">
                                Total pembayaran yang masuk pada invoice yang sesuai filter aktif (periode/klien/pencarian), tidak termasuk draft &amp; cancelled
                            </TooltipContent>
                        </Tooltip>

                        {/* Outstanding */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="hover:shadow-md transition-all duration-200 overflow-hidden cursor-default">
                                    <div className={STATS_CONFIG[3].accent + ' h-1'} />
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 leading-none">
                                                {STATS_CONFIG[3].label}
                                            </p>
                                            <span className={STATS_CONFIG[3].iconCn + ' shrink-0'}>{STATS_CONFIG[3].icon}</span>
                                        </div>
                                        <p className="text-xl font-bold text-dark-900 dark:text-dark-50 leading-none">
                                            {formatCurrency(stats.total_outstanding)}
                                        </p>
                                        <p className="text-xs text-dark-500 dark:text-dark-400 mt-2">
                                            {stats.sent_count + stats.partially_paid_count} invoice belum lunas
                                        </p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-56 text-center">
                                Total tagihan yang belum dibayar — sisa dari invoice berstatus Terkirim &amp; Sebagian. Inilah uang yang masih harus ditagih.
                            </TooltipContent>
                        </Tooltip>

                    </div>
                </TooltipProvider>

                {/* ── Status pipeline bar ── */}
                {stats.invoice_count > 0 && (
                    <div className="space-y-2.5">
                        <div className="flex h-2 rounded-full overflow-hidden gap-px">
                            {PIPELINE_SEGMENTS.map((seg) => {
                                const count = stats[`${seg.key}_count` as keyof Stats] as number;
                                if (count === 0) return null;
                                return (
                                    <button
                                        key={seg.key}
                                        type="button"
                                        className={cn('h-full rounded-full transition-opacity hover:opacity-75', seg.bar)}
                                        style={{ width: `${(count / stats.invoice_count) * 100}%` }}
                                        onClick={() => navigate({ status: seg.key })}
                                        title={`${seg.label}: ${count}`}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex items-center flex-wrap gap-x-5 gap-y-1">
                            {PIPELINE_SEGMENTS.map((seg) => {
                                const count = stats[`${seg.key}_count` as keyof Stats] as number;
                                if (count === 0) return null;
                                return (
                                    <button
                                        key={seg.key}
                                        type="button"
                                        onClick={() => navigate({ status: seg.key })}
                                        className="flex items-center gap-1.5 text-xs text-dark-500 dark:text-dark-400 hover:text-dark-900 dark:hover:text-dark-50 transition-colors"
                                    >
                                        <span className={cn('h-2 w-2 rounded-full inline-block shrink-0', seg.dot)} />
                                        {seg.label} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Status tabs ── */}
                <Tabs
                    items={tabItems}
                    value={currentFilters.status}
                    onChange={(v) => navigate({ status: v })}
                    variant="underline"
                />

                {/* ── Table card ── */}
                <Card className="overflow-hidden">
                    {/* Filter toolbar */}
                    <div className="flex flex-col lg:flex-row lg:items-end gap-3 p-4 border-b border-secondary-200 dark:border-dark-600">

                        {/* Klien */}
                        <div className="w-full lg:w-64 shrink-0">
                            <Combobox
                                multiple
                                options={clients}
                                value={currentFilters.client_ids}
                                onChange={(v) => navigate({ client_ids: v })}
                                placeholder="Semua Klien"
                                label="Klien"
                            />
                        </div>

                        {/* Periode — Bulan + Rentang Tanggal berdampingan (rentang meng-override bulan) */}
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3 w-full lg:w-auto shrink-0">
                            <div className="w-full sm:w-40 shrink-0">
                                {hasRange ? (
                                    <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                {/* wrapper receives hover even though the inner field is disabled */}
                                                <div>
                                                    <DatePicker
                                                        mode="month"
                                                        label="Bulan"
                                                        value={currentFilters.month || null}
                                                        onChange={(v) => navigate({ month: v ?? '' })}
                                                        placeholder="Pilih bulan..."
                                                        disabled
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>Diabaikan — rentang tanggal sedang aktif</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : (
                                    <DatePicker
                                        mode="month"
                                        label="Bulan"
                                        value={currentFilters.month || null}
                                        onChange={(v) => navigate({ month: v ?? '' })}
                                        placeholder="Pilih bulan..."
                                    />
                                )}
                            </div>
                            <div className="w-full sm:w-60 shrink-0">
                                <DatePicker
                                    mode="range"
                                    label="Rentang Tanggal"
                                    value={dateRange}
                                    onChange={handleDateRangeChange}
                                    placeholder="Tanggal mulai..."
                                    placeholderTo="Tanggal akhir..."
                                    clearable
                                />
                            </div>
                        </div>

                        {/* Search + controls */}
                        <div className="flex-1 flex items-end gap-2 min-w-0">
                            <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0 max-w-xs">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari invoice atau klien..."
                                    icon={<Search className="w-4 h-4" />}
                                />
                            </form>
                            {activeFiltersCount > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetFilters}
                                    className="shrink-0 gap-1 text-dark-500 dark:text-dark-400"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Reset
                                    <Badge variant="blue" size="sm">{activeFiltersCount}</Badge>
                                </Button>
                            )}
                        </div>

                        {/* Result count */}
                        <p className="text-sm text-dark-500 dark:text-dark-400 shrink-0 self-end pb-0.5 hidden lg:block">
                            {invoices.from ?? 0}–{invoices.to ?? 0} dari {invoices.total}
                        </p>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-zinc-50 dark:bg-dark-800 border-b border-secondary-200 dark:border-dark-600">
                                    {TABLE_COLS.map((col) => (
                                        <th
                                            key={col.key}
                                            className={cn(
                                                'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 whitespace-nowrap select-none',
                                                col.align === 'right' ? 'text-right' : 'text-left',
                                                col.key === 'actions' && 'w-10',
                                                col.sortable !== false && 'cursor-pointer hover:text-dark-900 dark:hover:text-dark-50',
                                            )}
                                            onClick={() => {
                                                if (col.sortable === false) return;
                                                const dir = currentFilters.sort === col.key && currentFilters.direction === 'asc' ? 'desc' : 'asc';
                                                navigate({ sort: col.key, direction: dir });
                                            }}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                {col.label}
                                                {col.sortable !== false && col.label && (
                                                    <ArrowUpDown className={cn(
                                                        'w-3 h-3 transition-opacity',
                                                        currentFilters.sort === col.key ? 'opacity-80' : 'opacity-30',
                                                    )} />
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-200 dark:divide-dark-600">
                                {invoices.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={TABLE_COLS.length}>
                                            <EmptyState
                                                icon={<FileText className="w-8 h-8" />}
                                                title="Tidak ada invoice ditemukan"
                                                description="Coba ubah filter atau buat invoice baru"
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    invoices.data.map((inv) => {
                                        const isOverdue =
                                            inv.status !== 'paid' &&
                                            inv.status !== 'draft' &&
                                            new Date(inv.due_date) < new Date();
                                        const paymentPct = inv.total_amount > 0
                                            ? Math.min(100, Math.round((inv.amount_paid / inv.total_amount) * 100))
                                            : 0;

                                        return (
                                            <tr
                                                key={inv.id}
                                                onClick={() => openDrawer(inv.id)}
                                                className={cn(
                                                    'transition-colors cursor-pointer',
                                                    isOverdue
                                                        ? 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50/70 dark:hover:bg-red-900/15'
                                                        : 'hover:bg-zinc-50 dark:hover:bg-dark-800/60',
                                                )}
                                            >
                                                {/* No. Invoice */}
                                                <td className="px-4 py-3.5">
                                                    <span className="font-mono text-xs font-medium text-dark-900 dark:text-dark-50">
                                                        {inv.invoice_number ?? (
                                                            <span className="text-dark-400 dark:text-dark-500 not-italic">—</span>
                                                        )}
                                                    </span>
                                                </td>

                                                {/* Klien — with avatar */}
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-8 w-8 shrink-0">
                                                            <AvatarFallback className="text-xs font-semibold">
                                                                {getInitials(inv.client_name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-dark-900 dark:text-dark-50 truncate">
                                                                {inv.client_name}
                                                            </div>
                                                            <div className="text-xs text-dark-500 dark:text-dark-400 capitalize">
                                                                {inv.client_type}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Tgl Invoice */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <div className="text-sm text-dark-600 dark:text-dark-400">
                                                        {formatDate(inv.issue_date)}
                                                    </div>
                                                    <div className="text-xs text-dark-400 dark:text-dark-500 mt-0.5">
                                                        {relativeIssueDate(inv.issue_date)}
                                                    </div>
                                                </td>

                                                {/* Jatuh Tempo */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    {(() => {
                                                        const due = relativeDueDate(inv.due_date);
                                                        const showRelative = inv.status !== 'paid' && inv.status !== 'draft';
                                                        return (
                                                            <>
                                                                <div className={cn(
                                                                    'text-sm',
                                                                    isOverdue
                                                                        ? 'text-red-600 dark:text-red-400 font-semibold'
                                                                        : 'text-dark-600 dark:text-dark-400',
                                                                )}>
                                                                    {formatDate(inv.due_date)}
                                                                </div>
                                                                {showRelative && (
                                                                    <div className={cn(
                                                                        'text-xs mt-0.5',
                                                                        due.overdue
                                                                            ? 'text-red-500 dark:text-red-400'
                                                                            : 'text-dark-400 dark:text-dark-500',
                                                                    )}>
                                                                        {due.label}
                                                                    </div>
                                                                )}
                                                                {(inv.status === 'paid' || inv.status === 'draft') && (
                                                                    <div className="text-xs mt-0.5 text-dark-400 dark:text-dark-500 opacity-0 select-none">—</div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Jumlah + progress bar */}
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="font-semibold text-dark-900 dark:text-dark-50 tabular-nums whitespace-nowrap">
                                                        {formatCurrency(inv.total_amount)}
                                                    </div>
                                                    <div className="mt-1.5 min-w-[5rem]">
                                                        <div className="h-1.5 w-full bg-secondary-200 dark:bg-dark-600 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    'h-full rounded-full transition-all',
                                                                    inv.status === 'paid'
                                                                        ? 'bg-emerald-500 dark:bg-emerald-400'
                                                                        : 'bg-emerald-500 dark:bg-emerald-400',
                                                                )}
                                                                style={{ width: `${paymentPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td className="px-4 py-3.5">
                                                    <Badge variant={STATUS_VARIANT[inv.status] ?? 'zinc'}>
                                                        {STATUS_LABEL[inv.status] ?? inv.status}
                                                    </Badge>
                                                </td>

                                                {/* Aksi — dropdown menu */}
                                                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="h-8 w-8 text-dark-500 dark:text-dark-400 hover:text-dark-900 dark:hover:text-dark-50"
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-44">
                                                            <DropdownMenuItem onClick={() => openDrawer(inv.id)}>
                                                                <Eye className="w-4 h-4" />
                                                                Lihat Detail
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => router.get(companyUrl(`/invoices/${inv.id}/edit`))}>
                                                                <Pencil className="w-4 h-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            {inv.invoice_number && (
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setPrintRow(inv);
                                                                        setPrintOpen(true);
                                                                    }}
                                                                >
                                                                    <Printer className="w-4 h-4" />
                                                                    Cetak PDF
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-900/20"
                                                                onClick={() => {
                                                                    setDeleteId(inv.id);
                                                                    setDeleteOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                Hapus
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination footer */}
                    {invoices.last_page > 1 && (
                        <div className="px-4 py-3 border-t border-secondary-200 dark:border-dark-600">
                            <Pagination
                                meta={{
                                    current_page: invoices.current_page,
                                    last_page: invoices.last_page,
                                    per_page: invoices.per_page,
                                    total: invoices.total,
                                    from: invoices.from,
                                    to: invoices.to,
                                }}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    )}
                </Card>
            </div>

            {/* Slide-over drawer */}
            <InvoiceDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                invoiceId={selectedId}
                rollbackableIds={rollbackableIds}
                customTemplates={customTemplates}
            />

            {/* Print options modal (table row) */}
            {printRow && (
                <PrintInvoiceDialog
                    open={printOpen}
                    onOpenChange={(o) => {
                        setPrintOpen(o);
                        if (!o) setPrintRow(null);
                    }}
                    invoiceId={printRow.id}
                    invoiceNumber={printRow.invoice_number}
                    totalAmount={printRow.total_amount}
                    amountPaid={printRow.amount_paid}
                    customTemplates={customTemplates}
                />
            )}

            {/* Delete confirm (table row) */}
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={(o) => {
                    setDeleteOpen(o);
                    if (!o) setDeleteId(null);
                }}
                title="Hapus Invoice"
                description="Invoice ini akan dihapus permanen beserta semua item dan data terkaitnya."
                confirmLabel="Hapus Invoice"
                loading={deleteLoading}
                onConfirm={handleDeleteFromTable}
            />
        </>
    );
}

InvoicesPage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default InvoicesPage;
