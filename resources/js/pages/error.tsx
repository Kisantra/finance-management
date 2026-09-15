import { Head, useHttp } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    ChevronDown,
    Copy,
    Hourglass,
    LayoutDashboard,
    LifeBuoy,
    LogIn,
    RotateCcw,
    SearchX,
    Send,
    ServerCrash,
    ShieldAlert,
    TimerReset,
    TriangleAlert,
} from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReportField {
    label: string;
    value: string;
}

interface Technical {
    exception: string;
    message: string;
    location: string;
    trace: string[];
}

interface Props {
    status: number;
    title: string;
    description: string;
    is_guest: boolean;
    home_url: string;
    can_retry: boolean;
    can_report: boolean;
    report_url: string | null;
    report: {
        id: string;
        summary: string;
        page: string;
        fields: ReportField[];
        technical: Technical | null;
        markdown: string;
    };
}

type Tone = 'red' | 'yellow' | 'orange' | 'zinc';

const TONE_CLASS: Record<Tone, string> = {
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    zinc: 'bg-zinc-100 dark:bg-dark-800 text-zinc-600 dark:text-dark-400',
};

function appearance(status: number): { tone: Tone; icon: React.ReactNode } {
    const iconClass = 'h-6 w-6';

    if (status >= 500) return { tone: 'red', icon: <ServerCrash className={iconClass} /> };
    if (status === 419) return { tone: 'yellow', icon: <TimerReset className={iconClass} /> };
    if (status === 429) return { tone: 'yellow', icon: <Hourglass className={iconClass} /> };
    if (status === 403) return { tone: 'orange', icon: <ShieldAlert className={iconClass} /> };
    if (status === 404) return { tone: 'zinc', icon: <SearchX className={iconClass} /> };

    return { tone: 'zinc', icon: <TriangleAlert className={iconClass} /> };
}

/**
 * Clipboard API hanya tersedia di konteks aman (HTTPS/localhost). Di luar itu,
 * jatuh ke execCommand supaya tombol salin tidak diam-diam gagal.
 */
async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied;
    }
}

export default function ErrorPage({ status, title, description, home_url, can_retry, can_report, report_url, report, is_guest }: Props) {
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');
    const [sentId, setSentId] = React.useState<number | null>(null);
    const [sendFailed, setSendFailed] = React.useState(false);

    const { tone, icon } = appearance(status);
    const isGuest = is_guest;

    const http = useHttp({
        title: report.summary.slice(0, 255),
        description: report.markdown.slice(0, 5000),
        type: 'bug',
        priority: status >= 500 ? 'high' : 'medium',
        page_url: report.page.slice(0, 500),
    });

    async function handleCopy() {
        setCopyState((await copyText(report.markdown)) ? 'copied' : 'failed');
        window.setTimeout(() => setCopyState('idle'), 2500);
    }

    function handleReport() {
        if (!report_url) return;

        setSendFailed(false);
        http.post(report_url, {
            onSuccess: (data) => setSentId((data as { id: number }).id),
            onError: () => setSendFailed(true),
            onHttpException: () => {
                setSendFailed(true);
                return false;
            },
        });
    }

    function goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = home_url;
        }
    }

    const homeLabel = isGuest ? 'Masuk' : 'Ke Dashboard';
    const homeIcon = isGuest ? <LogIn className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />;

    return (
        <>
            <Head title={`${status} — ${title}`} />

            <div className="min-h-screen bg-gray-50 dark:bg-dark-950 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-xl space-y-4">
                    <section className="rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-dark-700 shadow-sm overflow-hidden">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-start gap-4">
                                <div className={cn('h-12 w-12 shrink-0 rounded-xl flex items-center justify-center', TONE_CLASS[tone])}>{icon}</div>
                                <div className="space-y-2 min-w-0">
                                    <Badge variant={tone}>Kode {status}</Badge>
                                    <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200">
                                        {title}
                                    </h1>
                                    <p className="text-base text-gray-600 dark:text-dark-400">{description}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 dark:border-dark-600 bg-zinc-50 dark:bg-dark-800 px-3 py-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-400">ID referensi</span>
                                <code className="font-mono text-sm text-gray-900 dark:text-dark-200 select-all">{report.id}</code>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {status === 419 ? (
                                    <a href={home_url} className={buttonVariants({ variant: 'primary' })}>
                                        {homeIcon}
                                        {isGuest ? 'Masuk kembali' : 'Ke Dashboard'}
                                    </a>
                                ) : (
                                    <>
                                        {can_retry && (status >= 500 || status === 429) ? (
                                            <Button variant="primary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => window.location.reload()}>
                                                Coba lagi
                                            </Button>
                                        ) : (
                                            <Button variant="primary" icon={<ArrowLeft className="h-4 w-4" />} onClick={goBack}>
                                                Kembali
                                            </Button>
                                        )}
                                        {/* Tautan biasa dengan buttonVariants: Button selalu merender slot ikon di
                                            depan children, sehingga mode Slot-nya menerima dua anak dan React crash. */}
                                        <a href={home_url} className={buttonVariants({ variant: 'zinc' })}>
                                            {homeIcon}
                                            {homeLabel}
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-zinc-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30 p-6 sm:px-8 space-y-4">
                            <div className="flex items-start gap-3">
                                <LifeBuoy className="h-5 w-5 mt-0.5 shrink-0 text-gray-400 dark:text-dark-400" />
                                <div className="space-y-0.5">
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-200">Butuh bantuan tim IT?</h2>
                                    <p className="text-sm text-gray-600 dark:text-dark-400">
                                        {can_report
                                            ? 'Kirim laporan langsung dari sini, atau salin detailnya untuk ditempel ke chat tim IT maupun asisten AI.'
                                            : 'Salin detailnya, lalu kirim ke tim IT lewat chat atau email beserta ID referensi di atas.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {can_report && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        loading={http.processing}
                                        disabled={sentId !== null}
                                        icon={sentId !== null ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                                        onClick={handleReport}
                                    >
                                        {sentId !== null ? 'Laporan terkirim' : 'Laporkan ke Tim IT'}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    icon={copyState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    onClick={handleCopy}
                                >
                                    {copyState === 'copied' ? 'Tersalin' : 'Salin Markdown'}
                                </Button>
                                <Button variant="ghost" size="sm" aria-expanded={detailOpen} onClick={() => setDetailOpen((open) => !open)}>
                                    <ChevronDown className={cn('h-4 w-4 transition-transform duration-150', detailOpen && 'rotate-180')} />
                                    {detailOpen ? 'Sembunyikan detail' : 'Lihat detail'}
                                </Button>
                            </div>

                            <div aria-live="polite" className="text-sm">
                                {sentId !== null && (
                                    <p className="text-green-700 dark:text-green-400">
                                        Laporan #{sentId} sudah diterima tim IT. Anda akan mendapat notifikasi saat ditanggapi.
                                    </p>
                                )}
                                {sendFailed && (
                                    <p className="text-red-600 dark:text-red-400">
                                        Laporan gagal dikirim. Gunakan <strong>Salin Markdown</strong> lalu kirim ke tim IT secara manual.
                                    </p>
                                )}
                                {copyState === 'failed' && (
                                    <p className="text-red-600 dark:text-red-400">
                                        Browser menolak akses clipboard. Buka detail di bawah, lalu salin teksnya secara manual.
                                    </p>
                                )}
                            </div>

                            {detailOpen && (
                                <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-4">
                                    <dl className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
                                        {report.fields.map((field) => (
                                            <React.Fragment key={field.label}>
                                                <dt className="font-semibold text-gray-600 dark:text-dark-400">{field.label}</dt>
                                                <dd className="font-mono text-xs sm:text-sm text-gray-900 dark:text-dark-200 break-words">{field.value}</dd>
                                            </React.Fragment>
                                        ))}
                                    </dl>

                                    {report.technical ? (
                                        <div className="space-y-2 border-t border-zinc-200 dark:border-dark-600 pt-4">
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-200">Detail teknis</h3>
                                            <p className="font-mono text-xs text-gray-600 dark:text-dark-400 break-words">
                                                {report.technical.exception} · {report.technical.location}
                                            </p>
                                            <pre className="max-h-40 overflow-auto rounded-md bg-zinc-50 dark:bg-dark-950 p-3 font-mono text-xs text-gray-900 dark:text-dark-300 whitespace-pre-wrap break-words">
                                                {report.technical.message}
                                            </pre>
                                            {report.technical.trace.length > 0 && (
                                                <pre className="max-h-48 overflow-auto rounded-md bg-zinc-50 dark:bg-dark-950 p-3 font-mono text-xs text-gray-600 dark:text-dark-400">
                                                    {report.technical.trace.join('\n')}
                                                </pre>
                                            )}
                                        </div>
                                    ) : (
                                        status >= 500 && (
                                            <p className="text-xs text-gray-500 dark:text-dark-500 border-t border-zinc-200 dark:border-dark-600 pt-3">
                                                Detail teknis lengkap hanya ditampilkan untuk admin dan tercatat di log server.
                                            </p>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    <p className="text-center text-xs text-gray-400 dark:text-dark-500">Kisantra Finance</p>
                </div>
            </div>
        </>
    );
}
