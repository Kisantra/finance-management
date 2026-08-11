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
import { companyUrl } from '@/lib/company';
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

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
    gray: { bg: 'bg-secondary-100 dark:bg-dark-700', text: 'text-dark-500 dark:text-dark-400' },
};

function timeAgo(iso: string): string {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 1) return 'baru saja';
    if (m < 60) return `${m} menit lalu`;
    if (h < 24) return `${h} jam lalu`;
    if (d < 7) return `${d} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
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
            const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
            const res = await fetch(companyUrl(`/notifications?page=${targetPage}&per_page=20`), {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrf,
                },
                credentials: 'same-origin',
            });
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
                    if (url) router.visit(companyUrl(url));
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
                <SheetHeader className="px-6 py-4 border-b border-secondary-200 dark:border-dark-600 bg-secondary-50/60 dark:bg-dark-800/60">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                                <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <SheetTitle className="text-base">Semua Notifikasi</SheetTitle>
                                <SheetDescription>
                                    {total} total · {unreadCount} belum dibaca
                                </SheetDescription>
                            </div>
                        </div>
                        {unreadCount > 0 && (
                            <Button variant="outline" size="sm" onClick={markAllRead}>
                                <CheckCheck className="w-4 h-4" />
                                Tandai semua
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                            <div className="h-16 w-16 rounded-xl bg-secondary-100 dark:bg-dark-700 flex items-center justify-center mb-4">
                                <Bell className="w-7 h-7 text-dark-400 dark:text-dark-500" />
                            </div>
                            <h3 className="text-base font-semibold text-dark-900 dark:text-dark-50">Tidak ada notifikasi</h3>
                            <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 max-w-xs">
                                Notifikasi tentang invoice, pembayaran, dan feedback akan muncul di sini.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-secondary-100 dark:divide-dark-600">
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
                                                'w-full text-left flex items-start gap-3 px-6 py-4 hover:bg-secondary-50 dark:hover:bg-dark-800/60 transition-colors',
                                                isUnread && 'bg-primary-50/40 dark:bg-primary-900/10',
                                            )}
                                        >
                                            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
                                                <Icon className={cn('w-5 h-5', colors.text)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={cn(
                                                        'text-sm leading-snug',
                                                        isUnread
                                                            ? 'font-semibold text-dark-900 dark:text-dark-50'
                                                            : 'text-dark-700 dark:text-dark-300',
                                                    )}>
                                                        {item.title}
                                                    </p>
                                                    {isUnread && (
                                                        <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1 line-clamp-2">
                                                    {item.message}
                                                </p>
                                                <p className="text-[10px] text-dark-400 dark:text-dark-500 mt-2 tabular-nums">
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
                        <div className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600">
                            <Button
                                variant="outline"
                                onClick={loadMore}
                                loading={loadingMore}
                                className="w-full"
                            >
                                Muat lebih banyak
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
