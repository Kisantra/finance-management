import { BarChart3 } from 'lucide-react';
import * as React from 'react';
import { AuthLink } from '@/components/auth/auth-form';
import { StatusPill } from '@/components/dashboard/widget';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { formatTanggal, t, Trans } from '@/i18n';
import { cn } from '@/lib/utils';

/*
 * Kerangka halaman autentikasi: masuk, lupa / atur ulang / konfirmasi kata sandi, verifikasi email.
 * Pemilih bahasa ada di kanan atas (tamu bisa memilih sebelum masuk; pilihannya ikut ke akun).
 *
 * Satu wadah Obsidian (radius 24) terbagi dua kolom. Kiri: chip merek, formulir di tengah, baris
 * kaki. Kanan (mulai lg): panel radius 16 yang menjorok 8 px dari tepi wadah, berisi cuplikan
 * aplikasi ini sendiri (Arus Kas, Periode, Invoice belum dibayar, Menunggu persetujuan) dengan data
 * contoh, tanpa foto. Panel selalu memakai permukaan gelap Obsidian (kelas `dark` pada panel, sama
 * dengan Ringkasan tema gelap) agar terbaca sebagai jendela produk dan kontras dengan formulir di
 * kedua tema. Seluruh panel dekoratif: aria-hidden, tanpa elemen yang bisa difokus.
 *
 * Halaman ini publik: semua nama dan angka di panel WAJIB fiktif ("Contoh"), jangan data asli.
 */

interface AuthLayoutProps {
    children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="flex min-h-dvh justify-center p-3 sm:p-6 lg:items-center">
            <div className="grid min-h-[calc(100dvh-1.5rem)] w-full max-w-[1360px] rounded-3xl border border-ob-line bg-ob-card text-ob-ink sm:min-h-[calc(100dvh-3rem)] lg:min-h-[clamp(700px,calc(100dvh-3rem),880px)] lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
                <div className="flex min-w-0 flex-col p-6 sm:p-10">
                    <header className="flex items-center justify-between gap-3">
                        <span className="inline-flex h-10 items-center gap-2.5 rounded-full border border-ob-line pl-2 pr-4">
                            <img src="/images/kisantra.png" alt="" className="h-6 w-6 object-contain" />
                            <span className="text-[13px] font-semibold text-ob-ink">Kisantra Finance</span>
                        </span>
                        <LanguageSwitcher className="h-10 bg-ob-card px-3.5" />
                    </header>

                    <main className="flex flex-1 items-center justify-center py-12">
                        <div className="w-full max-w-[380px]">{children}</div>
                    </main>

                    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs text-ob-ink-3">
                        <span>© {new Date().getFullYear()} Kisantra Finance</span>
                        <span>
                            <Trans
                                i18nKey="Pengguna baru? <tautan>Pelajari dulu di Panduan</tautan>"
                                components={{ tautan: <AuthLink href="/panduan" /> }}
                            />
                        </span>
                    </footer>
                </div>

                <div className="hidden p-2 pl-0 lg:flex">
                    <AppPreview />
                </div>
            </div>
        </div>
    );
}

/* ── Panel cuplikan aplikasi (dekoratif, data contoh) ─────────────────────────────────────── */

/** Bulan contoh (indeks 0-11; Jun-Nov). Namanya diformat saat render agar ikut bahasa aktif. */
const BARS = [
    { month: 5, income: 32, expense: 21 },
    { month: 6, income: 40, expense: 27 },
    { month: 7, income: 35, expense: 30 },
    { month: 8, income: 46, expense: 25 },
    { month: 9, income: 42, expense: 33 },
    { month: 10, income: 55, expense: 28 },
];
const CHART_MAX = 60;

const namaBulan = (month: number) => formatTanggal(new Date(2026, month, 1), { month: 'short' });

/** Inisial hari Senin-Minggu (2 Nov 2026 = Senin) dalam bahasa aktif: S S R K J S M / M T W T F S S. */
const inisialHari = () => Array.from({ length: 7 }, (_, i) => formatTanggal(new Date(2026, 10, 2 + i), { weekday: 'narrow' }));

/* Seperti kalender Ringkasan: hari di luar bulan berarsir tanpa angka, rentang terpilih biru. */
type DayKind = 'outside' | 'day' | 'edge' | 'inside';
const WEEK: { label?: string; kind: DayKind }[] = [
    { kind: 'outside' },
    { kind: 'outside' },
    { label: '1', kind: 'edge' },
    { label: '2', kind: 'inside' },
    { label: '3', kind: 'inside' },
    { label: '4', kind: 'edge' },
    { label: '5', kind: 'day' },
];
const DAY_STYLE: Record<DayKind, string> = {
    outside: 'border-transparent [background-image:repeating-linear-gradient(135deg,var(--ob-hatch-edge)_0_1px,transparent_1px_6px)]',
    day: 'border-ob-line-soft bg-ob-inner text-ob-ink',
    edge: 'border-transparent bg-ob-act-fill font-semibold text-white',
    inside: 'border-ob-act-fill/35 bg-ob-act-fill/20 text-ob-ink',
};


/*
 * Kartu melayang: Card katalog + bayangan panel melayang + masuk berjenjang (ob-rise, mati pada
 * prefers-reduced-motion). Tata letak di "panggung" berukuran tetap: setiap tumpang-tindih tepat
 * 20 px, lebih kecil dari padding kartu (22 px), jadi hanya padding yang tertutup, tak ada isi;
 * jarak antarkartu yang tidak bertumpuk 24 px. lg (panggung 484 × 556): Arus Kas, Periode,
 * Invoice. xl (624 × 523): ditambah Menunggu persetujuan dan kartu yang lebih besar; bila panel
 * selebar ≥ 720 px (kueri kontainer, mis. layar 1440) panggung diperbesar 10% agar tetap mengisi
 * panel. Mengubah isi kartu mengubah tingginya: ukur ulang lalu sesuaikan posisi `top` di bawah.
 */
const FLOAT = 'ob-rise absolute shadow-xl shadow-black/40';

function AppPreview() {
    return (
        <div
            aria-hidden="true"
            className="dark @container pointer-events-none relative flex-1 select-none overflow-hidden rounded-2xl bg-ob-page text-ob-ink"
        >
            <span className="absolute left-8 top-8 inline-flex h-10 items-center rounded-full border border-ob-line px-4 text-xs font-medium text-ob-ink-2">
                {t('Pratinjau aplikasi · data contoh')}
            </span>

            <div className="absolute inset-0 flex items-center justify-center px-8 pb-8 pt-24 xl:pb-16">
                <div className="relative h-[556px] w-[484px] shrink-0 xl:h-[523px] xl:w-[624px] @min-[720px]:scale-110">
                    <CashFlowCard />
                    <InvoicesCard />
                    <PeriodCard />
                    <ApprovalsCard />
                </div>
            </div>
        </div>
    );
}

function CashFlowCard() {
    const last = BARS.length - 1;
    return (
        <Card className={cn(FLOAT, 'left-0 top-0 w-[264px] p-[22px] xl:top-[41px] xl:w-[380px]')} style={{ animationDelay: '60ms' }}>
            <p className="text-sm font-semibold">{t('Arus Kas')}</p>
            <p className="mt-4 text-[26px] font-semibold leading-none tracking-[-0.01em] xl:text-[32px]">Rp 125.000.000</p>
            <p className="mt-2 text-xs text-ob-ink-2">{t('Total saldo · {{count}} rekening', { count: 3 })}</p>

            <div className="mt-4 flex items-center gap-4 text-xs text-ob-ink-2">
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: 'var(--ob-bar-now)' }} />
                    {t('Pemasukan')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="ob-hatch h-2.5 w-3.5 rounded-[3px]" />
                    {t('Pengeluaran')}
                </span>
            </div>

            <div className="relative mt-3 h-[84px] xl:h-[104px]">
                <div className="absolute inset-0 flex flex-col justify-between">
                    <span className="border-t border-dashed border-ob-line" />
                    <span className="border-t border-dashed border-ob-line" />
                    <span className="border-t border-ob-line-strong" />
                </div>
                <div className="absolute inset-0 grid grid-cols-6 gap-x-1.5 px-1 xl:gap-x-3">
                    {BARS.map((bar, i) => (
                        <div key={bar.month} className="flex h-full items-end justify-center gap-[3px]">
                            <span
                                className="w-[11px] rounded-t-[4px] xl:w-[14px]"
                                style={{
                                    height: `${(bar.income / CHART_MAX) * 100}%`,
                                    background: i === last ? 'var(--ob-bar-now)' : 'var(--ob-bar-past)',
                                }}
                            />
                            <span
                                className="ob-hatch w-[11px] rounded-t-[4px] border-b-0 xl:w-[14px]"
                                style={{ height: `${(bar.expense / CHART_MAX) * 100}%` }}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-x-1.5 px-1 text-center text-xs text-ob-ink-3 xl:gap-x-3">
                {BARS.map((bar, i) => (
                    <span key={bar.month} className={cn(i === last && 'font-semibold text-ob-ink')}>
                        {namaBulan(bar.month)}
                    </span>
                ))}
            </div>
        </Card>
    );
}

function PeriodCard() {
    return (
        <Card
            className={cn(FLOAT, 'left-[244px] top-[140px] w-[240px] p-[18px] xl:left-[360px] xl:top-[184px] xl:w-[264px]')}
            style={{ animationDelay: '220ms' }}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t('Periode Arus Kas')}</p>
                <StatusPill tone="act">{t('{{count}} hari', { count: 4 })}</StatusPill>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
                {inisialHari().map((day, i) => (
                    <span key={`w${i}`} className="text-center text-xs font-medium text-ob-ink-3">
                        {day}
                    </span>
                ))}
                {WEEK.map((day, i) => (
                    <span
                        key={`d${i}`}
                        className={cn('flex h-[30px] items-center justify-center rounded-[10px] border text-[13px] font-medium', DAY_STYLE[day.kind])}
                    >
                        {day.label}
                    </span>
                ))}
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-ob-line bg-ob-inner p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ob-line bg-ob-card text-ob-ink-2">
                    <BarChart3 className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                    <span className="text-lg font-semibold leading-tight">{t('+Rp 18,5 jt')}</span>
                    <span className="text-xs text-ob-ink-2">{t('Arus bersih {{count}} hari', { count: 4 })}</span>
                </span>
            </div>
        </Card>
    );
}

function InvoicesCard() {
    const invoices = [
        { client: 'PT Contoh Jaya', due: t('Lewat {{count}} hari', { count: 9 }), amount: 'Rp 12.500.000', late: true },
        {
            client: 'CV Contoh Makmur',
            due: t('Jatuh tempo {{date}}', { date: formatTanggal(new Date(2026, 10, 28), 'pendek') }),
            amount: 'Rp 8.000.000',
            late: false,
        },
    ];

    return (
        <Card
            className={cn(FLOAT, 'left-0 top-[364px] w-[300px] px-[22px] pb-1.5 pt-[18px] xl:top-[331px] xl:w-[336px]')}
            style={{ animationDelay: '140ms' }}
        >
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{t('Invoice belum dibayar')}</p>
                <span className="shrink-0 text-xs font-medium text-ob-ink-2">{t('{{count}} invoice', { count: invoices.length })}</span>
            </div>
            <ul className="mt-1.5">
                {invoices.map((invoice, i) => (
                    <li
                        key={invoice.client}
                        className={cn('flex items-center gap-3 py-3', i < invoices.length - 1 && 'border-b border-ob-line-soft')}
                    >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-[13px] font-semibold">{invoice.client}</span>
                            <span className={cn('text-xs', invoice.late ? 'text-ob-late' : 'text-ob-ink-3')}>{invoice.due}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[13px] font-semibold">{invoice.amount}</span>
                            {invoice.late ? <StatusPill tone="late">{t('Lewat jatuh tempo')}</StatusPill> : <StatusPill tone="act">{t('Terbit')}</StatusPill>}
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

function ApprovalsCard() {
    return (
        <Card
            className={cn(FLOAT, 'left-[324px] top-0 hidden w-[300px] items-center gap-3 py-3 pl-3 pr-5 xl:flex')}
            style={{ animationDelay: '300ms' }}
        >
            <span className="flex -space-x-1.5">
                {['AR', 'DS', 'MK'].map((initials) => (
                    <Avatar key={initials} className="h-8 w-8 ring-2 ring-ob-card">
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                ))}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ob-inner text-xs font-bold text-ob-ink-2 ring-2 ring-ob-card">
                    +2
                </span>
            </span>
            <span className="flex flex-col">
                <span className="text-[13px] font-semibold">{t('Menunggu persetujuan')}</span>
                <span className="text-xs text-ob-ink-2">{t('{{count}} reimbursement', { count: 5 })}</span>
            </span>
        </Card>
    );
}
