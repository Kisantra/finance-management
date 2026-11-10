import { router } from '@inertiajs/react';
import {
    Bell,
    CheckCheck,
    FileText,
    HandCoins,
    Loader2,
    MessageSquare,
    MessageSquareReply,
    Receipt,
    RotateCw,
    Trash2,
} from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { formatTanggal, t } from '@/i18n';
import { api } from '@/lib/api';
import { companyUrl } from '@/lib/company';
import { openResource } from '@/lib/resource-modal';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface FetchResponse {
    items: NotificationItem[];
    total: number;
    unread_count: number;
    has_more: boolean;
}

const TYPE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    feedback_submitted: MessageSquare,
    feedback_responded: MessageSquareReply,
    feedback_status_changed: RotateCw,
    invoice_created: FileText,
    invoice_payment_received: HandCoins,
    invoice_due_soon: Receipt,
    invoice_deleted: Trash2,
    payment_deleted: Trash2,
};

/* Tile ikon Obsidian (seperti StatsCard): latar chip netral, warna nada hanya di ikonnya. */
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-ob-chip', text: 'text-ob-act' },
    green: { bg: 'bg-ob-chip', text: 'text-ob-pos' },
    yellow: { bg: 'bg-ob-chip', text: 'text-ob-wait' },
    red: { bg: 'bg-ob-chip', text: 'text-ob-late' },
    gray: { bg: 'bg-ob-chip', text: 'text-ob-ink-2' },
};

function timeAgo(iso: string): string {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 1) return t('baru saja');
    if (m < 60) return t('{{count}} menit lalu', { count: m });
    if (h < 24) return t('{{count}} jam lalu', { count: h });
    if (d < 7) return t('{{count}} hari lalu', { count: d });
    return formatTanggal(date);
}

export function NotificationDrawer({ open, onOpenChange }: Props) {
    const [items, setItems] = React.useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [total, setTotal] = React.useState(0);
    const [hasMore, setHasMore] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [loading, setLoading] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);

    const fetchData = React.useCallback(async (targetPage: number, replace = false) => {
        const isFirst = targetPage === 1;
        if (isFirst) setLoading(true);
        else setLoadingMore(true);

        try {
            const res = await api(`/notifications?page=${targetPage}&per_page=20`);
            const data: FetchResponse = await res.json();
            setItems(replace ? data.items : data.items);
            setUnreadCount(data.unread_count);
            setTotal(data.total);
            setHasMore(data.has_more);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    React.useEffect(() => {
        if (open) {
            setPage(1);
            fetchData(1, true);
        }
    }, [open, fetchData]);

    const loadMore = () => {
        const next = page + 1;
        setPage(next);
        fetchData(next);
    };

    const openItem = (item: NotificationItem) => {
        const url = (item.data as { url?: string } | null)?.url;
        router.post(
            companyUrl(`/notifications/${item.id}/read`),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    // Tautan detail invoice (#invoice/13 atau /invoices/13 lama) dibuka sebagai modal di halaman ini.
                    const invoice = url?.match(/(?:#invoice|\/invoices)\/(\d+)$/);
                    if (invoice) openResource('invoice', Number(invoice[1]));
                    else if (url) router.visit(companyUrl(url));
                },
            },
        );
    };

    const markAllRead = () => {
        router.post(
            companyUrl('/notifications/mark-all-read'),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                only: ['notifications'],
                onSuccess: () => fetchData(1, true),
            },
        );
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent size="md" className="p-0 flex flex-col">
                <SheetHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 rounded-lg bg-ob-chip text-ob-ink-2 flex items-center justify-center">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <SheetTitle>{t('Semua Notifikasi')}</SheetTitle>
                                <SheetDescription className="text-[13px]">
                                    {t('{{total}} total · {{count}} belum dibaca', { total, count: unreadCount })}
                                </SheetDescription>
                            </div>
                        </div>
                        {unreadCount > 0 && (
                            <Button variant="outline" size="sm" onClick={markAllRead}>
                                <CheckCheck className="w-4 h-4" />
                                {t('Tandai semua')}
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-ob-ink-3" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="m-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ob-line-strong py-16 px-6 text-center">
                            <div className="h-12 w-12 rounded-lg bg-ob-chip text-ob-ink-2 flex items-center justify-center mb-4">
                                <Bell className="w-5 h-5" />
                            </div>
                            <h3 className="text-[15px] font-semibold text-ob-ink">{t('Tidak ada notifikasi')}</h3>
                            <p className="text-[13px] text-ob-ink-2 mt-1 max-w-xs">
                                {t('Notifikasi tentang invoice, pembayaran, dan masukan akan muncul di sini.')}
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-ob-line-soft">
                            {items.map((item) => {
                                const Icon = TYPE_ICON_MAP[item.type] ?? Bell;
                                const colors = COLOR_MAP[item.color] ?? COLOR_MAP.gray;
                                const isUnread = !item.read_at;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => openItem(item)}
                                            className={cn(
                                                'w-full text-left flex items-start gap-3 px-6 py-4 transition-colors duration-150 ease-out hover:bg-ob-hover focus-visible:outline-none focus-visible:bg-ob-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ob-act-fill',
                                                isUnread && 'bg-ob-inner',
                                            )}
                                        >
                                            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', colors.bg)}>
                                                <Icon className={cn('w-5 h-5', colors.text)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={cn(
                                                        'text-sm leading-snug',
                                                        isUnread
                                                            ? 'font-semibold text-ob-ink'
                                                            : 'font-medium text-ob-ink-2',
                                                    )}>
                                                        {item.title}
                                                    </p>
                                                    {isUnread && (
                                                        <span className="h-2 w-2 rounded-full bg-ob-act-fill shrink-0 mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-ob-ink-2 mt-1 line-clamp-2">
                                                    {item.message}
                                                </p>
                                                <p className="text-xs text-ob-ink-3 mt-2 tabular-nums">
                                                    {timeAgo(item.created_at)}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {hasMore && !loading && (
                        <div className="px-6 py-4 border-t border-ob-line">
                            <Button
                                variant="outline"
                                onClick={loadMore}
                                loading={loadingMore}
                                className="w-full"
                            >
                                {t('Muat lebih banyak')}
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
