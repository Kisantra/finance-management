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
import { formatTanggal, t } from '@/i18n';
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

/* Tile ikon Obsidian (seperti StatsCard): latar chip netral, warna nada hanya di ikonnya. */
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-ob-chip', text: 'text-ob-act' },
    green: { bg: 'bg-ob-chip', text: 'text-ob-pos' },
    yellow: { bg: 'bg-ob-chip', text: 'text-ob-wait' },
    red: { bg: 'bg-ob-chip', text: 'text-ob-late' },
    gray: { bg: 'bg-ob-chip', text: 'text-ob-ink-2' },
};

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page';

function timeAgo(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return t('baru saja');
    if (diffMin < 60) return t('{{n}}m', { n: diffMin });
    if (diffH < 24) return t('{{n}}j', { n: diffH });
    if (diffD < 7) return t('{{n}}h', { n: diffD });
    return formatTanggal(date, { day: '2-digit', month: 'short' });
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
            {/* Header membungkus tombol ini dengan pil bg-ob-rail (tepi, latar, hover); tombol
                mengisi pil itu penuh dan hanya membawa cincin fokus serta state terbuka. */}
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        'relative flex h-full w-full items-center justify-center rounded-full text-ob-ink transition-colors duration-150 ease-out data-[state=open]:bg-ob-hover',
                        FOCUS_RING,
                    )}
                    aria-label={t('Notifikasi')}
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-ob-badge px-1 text-xs font-bold leading-none text-ob-badge-ink ring-2 ring-ob-page">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-88 p-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ob-line">
                    <div>
                        <h3 className="text-sm font-semibold text-ob-ink">{t('Notifikasi')}</h3>
                        {unreadCount > 0 && (
                            <p className="text-xs text-ob-ink-2">{t('{{count}} belum dibaca', { count: unreadCount })}</p>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className={cn(
                                'flex items-center gap-1 rounded-lg text-xs font-semibold text-ob-act underline-offset-4 hover:underline',
                                FOCUS_RING,
                            )}
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            {t('Tandai semua')}
                        </button>
                    )}
                </div>

                <div className="max-h-112 overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="m-3 rounded-2xl border border-dashed border-ob-line-strong px-4 py-8 text-center">
                            <div className="h-10 w-10 mx-auto rounded-lg bg-ob-chip text-ob-ink-2 flex items-center justify-center mb-3">
                                <Bell className="w-5 h-5" />
                            </div>
                            <p className="text-[15px] font-semibold text-ob-ink">{t('Belum ada notifikasi')}</p>
                            <p className="text-[13px] text-ob-ink-2 mt-1">
                                {t('Notifikasi akan muncul saat ada aktivitas baru.')}
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
                                            onClick={() => openNotification(item)}
                                            className={cn(
                                                'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-ob-hover focus-visible:outline-none focus-visible:bg-ob-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ob-act-fill',
                                                isUnread && 'bg-ob-inner',
                                            )}
                                        >
                                            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', colors.bg)}>
                                                <Icon className={cn('w-4 h-4', colors.text)} />
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
                                                <p className="text-xs text-ob-ink-2 mt-0.5 line-clamp-2">
                                                    {item.message}
                                                </p>
                                                <p className="text-xs text-ob-ink-3 mt-1 tabular-nums">
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

                <div className="border-t border-ob-line p-2">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onOpenDrawer();
                        }}
                        className={cn(
                            'w-full flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-[13px] font-medium text-ob-ink-2 transition-colors duration-150 ease-out hover:bg-ob-hover hover:text-ob-ink',
                            FOCUS_RING,
                        )}
                    >
                        {t('Lihat semua notifikasi')}
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
