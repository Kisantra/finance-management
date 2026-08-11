import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Bug,
    CheckCircle2,
    ChevronDown,
    Clock,
    Eye,
    FileText,
    Inbox,
    Lightbulb,
    Loader2,
    MessageCircle,
    MessageSquare,
    Pencil,
    Plus,
    Reply,
    Search,
    Send,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentPreviewButton } from '@/components/shared/file-preview-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { FileUpload } from '@/components/shared/file-upload';
import { FormSection } from '@/components/shared/form-section';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface FeedbackUser {
    id: number;
    name: string;
    initials: string;
}

interface FeedbackRow {
    id: number;
    title: string;
    description: string;
    type: 'bug' | 'feature' | 'feedback';
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    page_url: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
    created_at: string;
    user: FeedbackUser | null;
    can_edit: boolean;
    can_delete: boolean;
    can_respond: boolean;
}

interface FullFeedback extends FeedbackRow {
    admin_response: string | null;
    responded_at: string | null;
    responder: { id: number; name: string } | null;
}

interface PaginatedFeedbacks {
    data: FeedbackRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Stats {
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    bugs: number;
    features: number;
    feedbacks: number;
}

interface Filters {
    tab: 'all' | 'mine';
    search?: string;
    status?: string;
    type?: string;
    priority?: string;
    per_page?: number;
    sort?: string;
    direction?: string;
}

interface Props extends SharedProps {
    rows: PaginatedFeedbacks;
    stats: Stats;
    filters: Filters;
    canManage: boolean;
    canRespond: boolean;
    showFeedback: FullFeedback | null;
}

/* ─────────────────────────────────── meta maps ─── */

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; variant: 'red' | 'blue' | 'zinc'; bg: string; text: string }> = {
    bug: { label: 'Bug', icon: Bug, variant: 'red', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
    feature: { label: 'Fitur', icon: Lightbulb, variant: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    feedback: { label: 'Feedback', icon: MessageCircle, variant: 'zinc', bg: 'bg-zinc-100 dark:bg-dark-700', text: 'text-zinc-700 dark:text-zinc-300' },
};

const PRIORITY_META: Record<string, { label: string; variant: 'zinc' | 'blue' | 'yellow' | 'red' }> = {
    low: { label: 'Rendah', variant: 'zinc' },
    medium: { label: 'Sedang', variant: 'blue' },
    high: { label: 'Tinggi', variant: 'yellow' },
    critical: { label: 'Kritis', variant: 'red' },
};

const STATUS_META: Record<string, { label: string; variant: 'yellow' | 'blue' | 'green' | 'zinc'; icon: React.ComponentType<{ className?: string }> }> = {
    open: { label: 'Terbuka', variant: 'yellow', icon: Inbox },
    in_progress: { label: 'Diproses', variant: 'blue', icon: Loader2 },
    resolved: { label: 'Selesai', variant: 'green', icon: CheckCircle2 },
    closed: { label: 'Ditutup', variant: 'zinc', icon: XCircle },
};

const FEEDBACK_TYPE_OPTIONS: SegmentedOption<'bug' | 'feature' | 'feedback'>[] = [
    { value: 'bug', label: 'Bug', icon: <Bug className="w-5 h-5" />, activeClassName: 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400' },
    { value: 'feature', label: 'Fitur', icon: <Lightbulb className="w-5 h-5" />, activeClassName: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400' },
    { value: 'feedback', label: 'Feedback', icon: <MessageCircle className="w-5 h-5" />, activeClassName: 'bg-zinc-100 dark:bg-dark-700 border-zinc-400 dark:border-dark-500 text-zinc-700 dark:text-zinc-300' },
];

const FEEDBACK_PRIORITY_OPTIONS: SegmentedOption<'low' | 'medium' | 'high' | 'critical'>[] = [
    { value: 'low', label: 'Rendah', activeClassName: 'bg-zinc-100 dark:bg-dark-700 border-zinc-300 dark:border-dark-500 text-zinc-700 dark:text-zinc-300' },
    { value: 'medium', label: 'Sedang', activeClassName: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300' },
    { value: 'high', label: 'Tinggi', activeClassName: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-700 dark:text-yellow-300' },
    { value: 'critical', label: 'Kritis', activeClassName: 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300' },
];

/* ─────────────────────────────────── helpers ─── */

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/* ─────────────────────────────────── create/edit dialog ─── */

interface FeedbackFormData {
    title: string;
    description: string;
    type: 'bug' | 'feature' | 'feedback';
    priority: 'low' | 'medium' | 'high' | 'critical';
    page_url: string;
    attachment: File | null;
}

function FeedbackFormDialog({
    open,
    onOpenChange,
    mode,
    editingFeedback,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    editingFeedback: FeedbackRow | null;
}) {
    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<FeedbackFormData>({
        title: '',
        description: '',
        type: 'feedback',
        priority: 'medium',
        page_url: '',
        attachment: null,
    });

    React.useEffect(() => {
        if (open && mode === 'edit' && editingFeedback) {
            setData({
                title: editingFeedback.title,
                description: editingFeedback.description,
                type: editingFeedback.type,
                priority: editingFeedback.priority,
                page_url: editingFeedback.page_url ?? '',
                attachment: null,
            });
        } else if (open && mode === 'create') {
            reset();
            setData('page_url', window.location.pathname);
        }
        if (!open) clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, editingFeedback]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            preserveScroll: true,
            forceFormData: mode === 'create',
            onSuccess: () => {
                onOpenChange(false);
                toast.success(mode === 'create' ? 'Feedback berhasil dikirim.' : 'Feedback berhasil diperbarui.');
                reset();
            },
            onError: () => toast.error('Periksa kembali isian form.'),
        };
        if (mode === 'create') post(companyUrl('/feedbacks'), opts);
        else if (editingFeedback) put(companyUrl(`/feedbacks/${editingFeedback.id}`), opts);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="2xl" className="p-0 overflow-hidden">
                <form onSubmit={submit}>
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
                                mode === 'create'
                                    ? 'bg-primary-50 dark:bg-primary-900/20'
                                    : 'bg-blue-50 dark:bg-blue-900/20',
                            )}>
                                {mode === 'create'
                                    ? <MessageSquare className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                    : <Pencil className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                }
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                    {mode === 'create' ? 'Kirim Feedback' : 'Edit Feedback'}
                                </DialogTitle>
                                <p className="text-sm text-dark-500 dark:text-dark-400">
                                    Bantu kami meningkatkan aplikasi dengan masukan Anda
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-6 py-4 max-h-[70vh] overflow-y-auto space-y-5">
                        <FormSection title="Detail Feedback" description="Jelaskan masalah, fitur, atau saran Anda">
                            <SegmentedControl
                                label="Tipe *"
                                layout="stack"
                                columns={3}
                                value={data.type}
                                onChange={(v) => setData('type', v)}
                                options={FEEDBACK_TYPE_OPTIONS}
                                error={errors.type}
                            />

                            <Input
                                label="Judul *"
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                error={errors.title}
                                placeholder="Ringkasan singkat dan jelas"
                                autoFocus
                            />

                            <Textarea
                                label="Deskripsi *"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                error={errors.description}
                                rows={5}
                                placeholder="Jelaskan secara detail..."
                            />

                            <SegmentedControl
                                label="Prioritas *"
                                layout="inline"
                                columns={4}
                                value={data.priority}
                                onChange={(v) => setData('priority', v)}
                                options={FEEDBACK_PRIORITY_OPTIONS}
                                error={errors.priority}
                            />
                        </FormSection>

                        {mode === 'create' && (
                            <FormSection title="Lampiran (opsional)" description="Sertakan screenshot atau dokumen pendukung">
                                <FileUpload
                                    value={data.attachment}
                                    onChange={(file) => setData('attachment', file)}
                                    accept={['.jpg', '.jpeg', '.png', '.pdf']}
                                    maxSizeMb={5}
                                    error={errors.attachment}
                                />
                            </FormSection>
                        )}
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                        <Button type="button" variant="zinc" onClick={() => onOpenChange(false)} disabled={processing} className="w-full sm:w-auto order-2 sm:order-1">
                            Batal
                        </Button>
                        <Button type="submit" variant="primary" loading={processing} className="w-full sm:w-auto order-1 sm:order-2">
                            <Send className="w-4 h-4" />
                            {mode === 'create' ? 'Kirim Feedback' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── respond dialog ─── */

function RespondDialog({
    open,
    onOpenChange,
    feedback,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    feedback: FullFeedback | null;
}) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        response: '',
        status: 'in_progress',
    });

    React.useEffect(() => {
        if (open && feedback) {
            setData({
                response: feedback.admin_response ?? '',
                status: feedback.status === 'open' ? 'in_progress' : feedback.status,
            });
        }
        if (!open) clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, feedback]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback) return;
        post(companyUrl(`/feedbacks/${feedback.id}/respond`), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                toast.success('Tanggapan terkirim.');
                reset();
            },
            onError: () => toast.error('Periksa kembali tanggapan.'),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg" className="p-0 overflow-hidden">
                <form onSubmit={submit}>
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                <Reply className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                    Tanggapi Feedback
                                </DialogTitle>
                                <p className="text-sm text-dark-500 dark:text-dark-400 truncate max-w-md">
                                    {feedback?.title}
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-6 py-4 space-y-4">
                        <Textarea
                            label="Tanggapan *"
                            value={data.response}
                            onChange={(e) => setData('response', e.target.value)}
                            error={errors.response}
                            rows={6}
                            placeholder="Tuliskan tanggapan untuk pengguna..."
                            autoFocus
                        />
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">Status Baru *</label>
                            <Combobox
                                options={[
                                    { label: 'Sedang Diproses', value: 'in_progress' },
                                    { label: 'Selesai', value: 'resolved' },
                                    { label: 'Ditutup', value: 'closed' },
                                ]}
                                value={data.status}
                                onChange={(v) => setData('status', v ? String(v) : 'in_progress')}
                                placeholder="Pilih status"
                            />
                            {errors.status && <p className="text-xs text-red-600 dark:text-red-400">{errors.status}</p>}
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                        <Button type="button" variant="zinc" onClick={() => onOpenChange(false)} disabled={processing} className="w-full sm:w-auto order-2 sm:order-1">
                            Batal
                        </Button>
                        <Button type="submit" variant="primary" loading={processing} className="w-full sm:w-auto order-1 sm:order-2">
                            <Send className="w-4 h-4" />
                            Kirim Tanggapan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── show dialog ─── */

function ShowFeedbackDialog({
    open,
    onOpenChange,
    feedback,
    canRespond,
    canManage,
    onRespond,
    onEdit,
    onDelete,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    feedback: FullFeedback | null;
    canRespond: boolean;
    canManage: boolean;
    onRespond: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    if (!feedback) return null;

    const typeMeta = TYPE_META[feedback.type];
    const TypeIcon = typeMeta.icon;
    const statusMeta = STATUS_META[feedback.status];
    const StatusIcon = statusMeta.icon;
    const priorityMeta = PRIORITY_META[feedback.priority];

    const changeStatus = (status: string) => {
        router.post(
            companyUrl(`/feedbacks/${feedback.id}/status`),
            { status },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Status diperbarui.');
                    onOpenChange(false);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="2xl" className="p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-secondary-200 dark:border-dark-600">
                    <div className="flex items-start gap-4">
                        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', typeMeta.bg)}>
                            <TypeIcon className={cn('w-6 h-6', typeMeta.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                                <Badge variant={priorityMeta.variant}>{priorityMeta.label}</Badge>
                                <Badge variant={statusMeta.variant} className="inline-flex items-center gap-1">
                                    <StatusIcon className={cn('w-3 h-3', feedback.status === 'in_progress' && 'animate-spin')} />
                                    {statusMeta.label}
                                </Badge>
                            </div>
                            <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50 leading-snug">
                                {feedback.title}
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-xs text-dark-500 dark:text-dark-400">
                                Dikirim oleh <span className="font-medium text-dark-700 dark:text-dark-300">{feedback.user?.name ?? '—'}</span> · {formatDateTime(feedback.created_at)}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-5">
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 mb-2">
                            Deskripsi
                        </h4>
                        <div className="text-sm text-dark-700 dark:text-dark-300 whitespace-pre-wrap leading-relaxed">
                            {feedback.description}
                        </div>
                    </div>

                    {feedback.page_url && (
                        <div className="text-xs text-dark-500 dark:text-dark-400">
                            <span className="font-semibold">URL halaman:</span>{' '}
                            <code className="px-2 py-0.5 rounded bg-secondary-100 dark:bg-dark-800 text-dark-700 dark:text-dark-300 font-mono">
                                {feedback.page_url}
                            </code>
                        </div>
                    )}

                    {feedback.attachment_url && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-dark-500 dark:text-dark-400 mb-2">
                                Lampiran
                            </h4>
                            <AttachmentPreviewButton
                                url={feedback.attachment_url}
                                name={feedback.attachment_name}
                                label={feedback.attachment_name ?? 'Lampiran'}
                                className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                iconSize="w-4 h-4"
                            />
                        </div>
                    )}

                    {feedback.admin_response && (
                        <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Reply className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                    Tanggapan dari {feedback.responder?.name ?? 'Admin'}
                                </h4>
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                    {formatDateTime(feedback.responded_at)}
                                </span>
                            </div>
                            <div className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap leading-relaxed">
                                {feedback.admin_response}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                    <div className="flex flex-wrap items-center justify-end gap-2 w-full">
                        {canManage && feedback.status !== 'closed' && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        Ubah Status
                                        <ChevronDown className="w-3 h-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
                                        <DropdownMenuItem
                                            key={s}
                                            onClick={() => changeStatus(s)}
                                            disabled={s === feedback.status}
                                        >
                                            {STATUS_META[s].label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {feedback.can_edit && (
                            <Button variant="blue" size="sm" onClick={onEdit}>
                                <Pencil className="w-4 h-4" />
                                Edit
                            </Button>
                        )}
                        {feedback.can_delete && (
                            <Button variant="red" size="sm" onClick={onDelete}>
                                <Trash2 className="w-4 h-4" />
                                Hapus
                            </Button>
                        )}
                        {canRespond && feedback.can_respond && (
                            <Button variant="primary" size="sm" onClick={onRespond}>
                                <Reply className="w-4 h-4" />
                                {feedback.admin_response ? 'Edit Tanggapan' : 'Tanggapi'}
                            </Button>
                        )}
                        <Button variant="zinc" size="sm" onClick={() => onOpenChange(false)}>
                            Tutup
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── main page ─── */

export default function FeedbacksIndex() {
    const { rows, stats, filters, canManage, canRespond, showFeedback } = usePage<Props>().props;

    const [search, setSearch] = React.useState(filters.search ?? '');
    const [statusFilter, setStatusFilter] = React.useState(filters.status ?? '');
    const [typeFilter, setTypeFilter] = React.useState(filters.type ?? '');
    const [priorityFilter, setPriorityFilter] = React.useState(filters.priority ?? '');

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editingFeedback, setEditingFeedback] = React.useState<FeedbackRow | null>(null);
    const [respondOpen, setRespondOpen] = React.useState(false);
    const [deletingFeedback, setDeletingFeedback] = React.useState<FeedbackRow | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);
    const [showOpen, setShowOpen] = React.useState(showFeedback !== null);

    React.useEffect(() => {
        setShowOpen(showFeedback !== null);
    }, [showFeedback]);

    // Debounced search
    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) apply({ search, page: 1 });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<Filters> & { page?: number }) => {
        router.get(
            companyUrl('/feedbacks'),
            {
                tab: patch.tab ?? filters.tab,
                search: patch.search ?? search ?? undefined,
                status: patch.status ?? statusFilter ?? undefined,
                type: patch.type ?? typeFilter ?? undefined,
                priority: patch.priority ?? priorityFilter ?? undefined,
                per_page: filters.per_page,
                sort: filters.sort,
                direction: filters.direction,
                page: patch.page ?? rows.current_page,
            },
            { preserveScroll: true, preserveState: true, only: ['rows', 'stats', 'filters'], replace: true },
        );
    };

    const openShow = (id: number) => {
        router.get(companyUrl('/feedbacks'), { ...filters, show: id }, {
            preserveScroll: true,
            preserveState: true,
            only: ['showFeedback'],
            onSuccess: () => setShowOpen(true),
        });
    };

    const closeShow = () => {
        setShowOpen(false);
        router.get(companyUrl('/feedbacks'), filters, { preserveScroll: true, preserveState: true, only: ['showFeedback'], replace: true });
    };

    const confirmDelete = () => {
        if (!deletingFeedback) return;
        setDeleteProcessing(true);
        router.delete(companyUrl(`/feedbacks/${deletingFeedback.id}`), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Feedback berhasil dihapus.');
                setDeletingFeedback(null);
                setShowOpen(false);
            },
            onError: () => toast.error('Gagal menghapus feedback.'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('');
        setTypeFilter('');
        setPriorityFilter('');
        router.get(companyUrl('/feedbacks'), { tab: filters.tab }, { preserveScroll: true, replace: true });
    };

    const activeFilterCount = [search, statusFilter, typeFilter, priorityFilter].filter(Boolean).length;

    return (
        <>
            <Head title="Feedback & Saran" />

            <div className="space-y-6">
                <PageHeader
                    title="Feedback & Saran"
                    description="Laporkan bug, ajukan fitur, atau berikan masukan untuk perbaikan aplikasi"
                    action={
                        <Button variant="primary" onClick={() => setCreateOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Kirim Feedback
                        </Button>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total" value={stats.total} icon={<MessageSquare />} color="blue" />
                    <StatsCard label="Terbuka" value={stats.open} icon={<Inbox />} color="yellow" />
                    <StatsCard label="Diproses" value={stats.in_progress} icon={<Clock />} color="purple" />
                    <StatsCard label="Selesai" value={stats.resolved} icon={<CheckCircle2 />} color="green" />
                </div>

                {/* Tabs */}
                {canManage && (
                    <Tabs
                        value={filters.tab}
                        onChange={(v) => apply({ tab: v as 'all' | 'mine', page: 1 })}
                        items={[
                            { value: 'all', label: 'Semua Feedback', icon: <Inbox className="w-4 h-4" /> },
                            { value: 'mine', label: 'Feedback Saya', icon: <MessageSquare className="w-4 h-4" /> },
                        ]}
                    />
                )}

                {/* Filters */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Combobox
                            label="Tipe"
                            options={[
                                { label: 'Bug', value: 'bug' },
                                { label: 'Fitur', value: 'feature' },
                                { label: 'Feedback', value: 'feedback' },
                            ]}
                            value={typeFilter || null}
                            onChange={(v) => {
                                const next = v ? String(v) : '';
                                setTypeFilter(next);
                                apply({ type: next, page: 1 });
                            }}
                            placeholder="Semua tipe"
                            clearable
                        />
                        <Combobox
                            label="Status"
                            options={[
                                { label: 'Terbuka', value: 'open' },
                                { label: 'Diproses', value: 'in_progress' },
                                { label: 'Selesai', value: 'resolved' },
                                { label: 'Ditutup', value: 'closed' },
                            ]}
                            value={statusFilter || null}
                            onChange={(v) => {
                                const next = v ? String(v) : '';
                                setStatusFilter(next);
                                apply({ status: next, page: 1 });
                            }}
                            placeholder="Semua status"
                            clearable
                        />
                        <Combobox
                            label="Prioritas"
                            options={[
                                { label: 'Rendah', value: 'low' },
                                { label: 'Sedang', value: 'medium' },
                                { label: 'Tinggi', value: 'high' },
                                { label: 'Kritis', value: 'critical' },
                            ]}
                            value={priorityFilter || null}
                            onChange={(v) => {
                                const next = v ? String(v) : '';
                                setPriorityFilter(next);
                                apply({ priority: next, page: 1 });
                            }}
                            placeholder="Semua prioritas"
                            clearable
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                            <div className="w-full sm:w-64">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari judul, deskripsi, atau pengirim..."
                                    icon={<Search className="w-4 h-4" />}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                {activeFilterCount > 0 && (
                                    <>
                                        <Badge variant="blue">{activeFilterCount} filter aktif</Badge>
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="text-xs text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 inline-flex items-center gap-1"
                                        >
                                            <X className="w-3 h-3" /> Reset
                                        </button>
                                    </>
                                )}
                                <div className="text-sm text-dark-500 dark:text-dark-400">
                                    <span className="hidden sm:inline">Menampilkan </span>{rows.data.length}
                                    <span className="hidden sm:inline"> dari {rows.total}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cards Grid (richer than table for feedback) */}
                {rows.data.length === 0 ? (
                    <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700">
                        <EmptyState
                            icon={<MessageSquare className="w-12 h-12" />}
                            title="Belum ada feedback"
                            description={
                                filters.tab === 'mine'
                                    ? 'Anda belum mengirim feedback. Bantu kami dengan masukan Anda.'
                                    : 'Belum ada feedback yang masuk.'
                            }
                            action={
                                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                                    <Plus className="w-4 h-4" />
                                    Kirim Feedback
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {rows.data.map((item) => {
                            const typeMeta = TYPE_META[item.type];
                            const TypeIcon = typeMeta.icon;
                            const statusMeta = STATUS_META[item.status];
                            const priorityMeta = PRIORITY_META[item.priority];
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => openShow(item.id)}
                                    className="text-left rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden bg-white dark:bg-dark-700 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer"
                                >
                                    <div className={cn('h-1', typeMeta.bg.replace('/20', ''))} />
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', typeMeta.bg)}>
                                                <TypeIcon className={cn('w-5 h-5', typeMeta.text)} />
                                            </div>
                                            <Badge variant={statusMeta.variant} className="inline-flex items-center gap-1 shrink-0">
                                                {statusMeta.label}
                                            </Badge>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-dark-900 dark:text-dark-50 leading-snug line-clamp-2">
                                                {item.title}
                                            </h3>
                                            <p className="text-xs text-dark-500 dark:text-dark-400 mt-1 line-clamp-2">
                                                {item.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-secondary-100 dark:border-dark-600">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="h-7 w-7 rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-[10px] shrink-0">
                                                    {item.user?.initials ?? '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs text-dark-700 dark:text-dark-300 truncate">{item.user?.name ?? '—'}</div>
                                                    <div className="text-[10px] text-dark-400 dark:text-dark-500">{formatDate(item.created_at)}</div>
                                                </div>
                                            </div>
                                            <Badge variant={priorityMeta.variant} size="sm">{priorityMeta.label}</Badge>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {rows.data.length > 0 && (
                    <Pagination
                        meta={{
                            current_page: rows.current_page,
                            last_page: rows.last_page,
                            per_page: rows.per_page,
                            total: rows.total,
                            from: rows.from,
                            to: rows.to,
                        }}
                        onPageChange={(p) => apply({ page: p })}
                    />
                )}
            </div>

            {/* Dialogs */}
            <FeedbackFormDialog
                open={createOpen || editingFeedback !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setCreateOpen(false);
                        setEditingFeedback(null);
                    }
                }}
                mode={editingFeedback ? 'edit' : 'create'}
                editingFeedback={editingFeedback}
            />

            <RespondDialog
                open={respondOpen}
                onOpenChange={setRespondOpen}
                feedback={showFeedback}
            />

            <ShowFeedbackDialog
                open={showOpen}
                onOpenChange={(o) => {
                    if (!o) closeShow();
                    else setShowOpen(true);
                }}
                feedback={showFeedback}
                canRespond={canRespond}
                canManage={canManage}
                onRespond={() => setRespondOpen(true)}
                onEdit={() => {
                    if (showFeedback) {
                        setEditingFeedback(showFeedback);
                        closeShow();
                    }
                }}
                onDelete={() => {
                    if (showFeedback) {
                        setDeletingFeedback(showFeedback);
                    }
                }}
            />

            <ConfirmDialog
                open={deletingFeedback !== null}
                onOpenChange={(o) => !o && setDeletingFeedback(null)}
                onConfirm={confirmDelete}
                title="Hapus Feedback"
                description={
                    deletingFeedback
                        ? `Hapus feedback "${deletingFeedback.title}"? Tindakan ini tidak dapat dibatalkan.`
                        : ''
                }
                variant="danger"
                confirmLabel="Hapus"
                loading={deleteProcessing}
            />
        </>
    );
}

FeedbacksIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
