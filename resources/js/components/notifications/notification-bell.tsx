import { router, usePage } from '@inertiajs/react';
import {
    Bell,
    CheckCheck,
    ChevronRight,
    FileText,
    HandCoins,
    MessageSquare,
    MessageSquareReply,
    Receipt,
    RotateCw,
    Trash2,
} from 'lucide-react';
import * as React from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { NotificationItem, SharedProps } from '@/types';

interface Props {
    onOpenDrawer: () => void;
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return 'baru saja';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffH < 24) return `${diffH}j`;
    if (diffD < 7) return `${diffD}h`;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

export function NotificationBell({ onOpenDrawer }: Props) {
    const { notifications } = usePage<SharedProps>().props;
    const [open, setOpen] = React.useState(false);

    const unreadCount = notifications?.unread_count ?? 0;
    const items = notifications?.recent ?? [];

    const openNotification = (item: NotificationItem) => {
        setOpen(false);
        router.post(
            companyUrl(`/notifications/${item.id}/read`),
            {},
            {
                preserveScroll: true,
                preserveState: false,
                only: ['notifications'],
                onSuccess: () => {
                    const url = (item.data as { url?: string } | null)?.url;
                    if (url) {
                        router.visit(companyUrl(url));
                    }
                },
            },
        );
    };

    const markAllRead = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.post(
            companyUrl('/notifications/mark-all-read'),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                only: ['notifications'],
            },
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className="relative p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/6 transition-colors"
                    aria-label="Notifikasi"
                >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-88 p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 dark:border-dark-600 bg-secondary-50/60 dark:bg-dark-800/60">
                    <div>
                        <h3 className="font-semibold text-sm text-dark-900 dark:text-dark-50">Notifikasi</h3>
                        {unreadCount > 0 && (
                            <p className="text-xs text-dark-500 dark:text-dark-400">{unreadCount} belum dibaca</p>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                        >
                            <CheckCheck className="w-3 h-3" />
                            Tandai semua
                        </button>
                    )}
                </div>

                <div className="max-h-112 overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="py-10 px-4 text-center">
                            <div className="h-12 w-12 mx-auto rounded-xl bg-secondary-100 dark:bg-dark-700 flex items-center justify-center mb-3">
                                <Bell className="w-5 h-5 text-dark-400 dark:text-dark-500" />
                            </div>
                            <p className="text-sm font-medium text-dark-700 dark:text-dark-300">Belum ada notifikasi</p>
                            <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                                Notifikasi akan muncul saat ada aktivitas baru.
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
                                            onClick={() => openNotification(item)}
                                            className={cn(
                                                'w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-secondary-50 dark:hover:bg-dark-800 transition-colors',
                                                isUnread && 'bg-primary-50/40 dark:bg-primary-900/10',
                                            )}
                                        >
                                            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
                                                <Icon className={cn('w-4 h-4', colors.text)} />
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
                                                <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5 line-clamp-2">
                                                    {item.message}
                                                </p>
                                                <p className="text-[10px] text-dark-400 dark:text-dark-500 mt-1 tabular-nums">
                                                    {timeAgo(item.created_at)}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="px-4 py-2.5 border-t border-secondary-200 dark:border-dark-600 bg-secondary-50/60 dark:bg-dark-800/60">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onOpenDrawer();
                        }}
                        className="w-full flex items-center justify-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline py-1"
                    >
                        Lihat semua notifikasi
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
