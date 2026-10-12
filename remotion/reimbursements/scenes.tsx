import { ArrowRight, BarChart3, Check, CheckCircle2, Landmark, ListChecks, Minus, ReceiptText, Tag, TriangleAlert, Wallet, X } from 'lucide-react';
import type * as React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { cn } from '@/lib/utils';
import { ReimbursementStatusPill } from '@/pages/reimbursements/components/rb';
import { Stage, useEnter } from '../components/stage';
import { Sfx } from '../sfx';
import { ROLE_TONE, type Role } from '../components/walkthrough';
import { ROLES } from './steps';

function RoleChip({ role, className }: { role: Role; className?: string }) {
    const tone = ROLE_TONE[role.tone];
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', tone.chip, className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
            {role.label}
        </span>
    );
}

/** Garis/panah yang "tergambar" mulai frame `at`. */
function useDraw(at: number, length = 14) {
    return interpolate(useCurrentFrame(), [at, at + length], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export function Intro({ role, title, summary }: { role: Role; title: string; summary: string }) {
    return (
        <Stage className="flex flex-col justify-center px-24">
            <Sfx name="whoosh" at={0} frames={18} />
            <p style={useEnter(0)} className="text-lg font-semibold text-ob-act">
                Tutorial · Reimbursement
            </p>
            <div style={useEnter(5)} className="mt-5">
                <RoleChip role={role} className="px-4 py-1.5 text-base" />
            </div>
            <h1 style={useEnter(9)} className="mt-4 max-w-4xl text-6xl font-bold tracking-tight text-balance">
                {title}
            </h1>
            <p style={useEnter(15)} className="mt-5 max-w-2xl text-xl text-ob-ink-2">
                {summary}
            </p>
        </Stage>
    );
}

const ROLE_CARDS: { role: Role; who: string; can: string[]; cannot?: string }[] = [
    {
        role: ROLES.staff,
        who: 'Pemohon',
        can: ['Mencatat biaya + mengunggah struk', 'Mengajukan untuk ditinjau', 'Memperbaiki & mengajukan ulang bila ditolak', 'Menghapus draft / pengajuan ditolak miliknya'],
        cannot: 'Hanya melihat pengajuan sendiri',
    },
    {
        role: ROLES.fm,
        who: 'Peninjau & pembayar',
        can: ['Melihat pengajuan semua karyawan', 'Menyetujui (pilih kategori akuntansi) atau menolak dengan alasan', 'Membayar lunas atau dicicil dari rekening bank', 'Juga bisa mengajukan reimbursement sendiri'],
        cannot: 'Tidak bisa menghapus pengajuan',
    },
    {
        role: ROLES.admin,
        who: 'Akses penuh',
        can: ['Semua yang bisa dilakukan Finance manager', 'Menghapus pengajuan siapa pun yang belum dibayar'],
    },
];

export function Roles() {
    const frame = useCurrentFrame();
    return (
        <Stage className="flex flex-col justify-center px-16">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                Tiga peran di modul ini
            </h2>
            <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                Tombol yang muncul di layar menyesuaikan peran Anda.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-5">
                {ROLE_CARDS.map((card, i) => {
                    const at = 18 + i * 40;
                    const enter = interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    return (
                        <div
                            key={card.role.label}
                            style={{ opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}
                            className="flex flex-col gap-4 rounded-3xl border border-ob-line bg-ob-card p-6"
                        >
                            <Sfx name="pop" at={at} />
                            <div className="flex flex-col items-start gap-2">
                                <RoleChip role={card.role} />
                                <p className="text-2xl font-semibold">{card.who}</p>
                            </div>
                            <ul className="flex flex-col gap-2.5">
                                {card.can.map((item, j) => {
                                    const itemIn = interpolate(frame, [at + 10 + j * 8, at + 20 + j * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                                    return (
                                        <li key={item} style={{ opacity: itemIn }} className="flex items-start gap-2.5 text-[17px] leading-snug">
                                            <Check className="mt-1 h-4 w-4 shrink-0 text-ob-pos" strokeWidth={3} />
                                            {item}
                                        </li>
                                    );
                                })}
                                {card.cannot && (
                                    <li
                                        style={{ opacity: interpolate(frame, [at + 12 + card.can.length * 8, at + 22 + card.can.length * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}
                                        className="flex items-start gap-2.5 text-[17px] leading-snug text-ob-ink-2"
                                    >
                                        <Minus className="mt-1 h-4 w-4 shrink-0" strokeWidth={3} />
                                        {card.cannot}
                                    </li>
                                )}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}

const FLOW = [
    { status: 'draft', role: ROLES.staff, what: 'Mencatat biaya + struk' },
    { status: 'pending', role: ROLES.staff, what: 'Mengajukan' },
    { status: 'approved', role: ROLES.fm, what: 'Menyetujui + pilih kategori' },
    { status: 'paid', role: ROLES.fm, what: 'Membayar dari rekening' },
] as const;

const CARD = { w: 250, h: 132, gap: 60, x0: 50, y: 210 };
const cardX = (i: number) => CARD.x0 + i * (CARD.w + CARD.gap);

export function Flow() {
    const frame = useCurrentFrame();
    const appear = (at: number) => {
        const p = interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return { opacity: p, transform: `translateY(${(1 - p) * 18}px)` };
    };
    const arrowAt = (i: number) => 30 + i * 36 + 14;
    const rejectAt = 30 + FLOW.length * 36 + 10;
    const draws = [useDraw(arrowAt(0)), useDraw(arrowAt(1)), useDraw(arrowAt(2)), useDraw(rejectAt), useDraw(rejectAt + 40)];
    const rejectX = cardX(1);
    const rejectY = 470;

    return (
        <Stage>
            {[0, 1, 2, 3].map((i) => (
                <Sfx key={i} name="pop" at={30 + i * 36} />
            ))}
            <Sfx name="pop" at={rejectAt + 8} />
            <div className="absolute left-[50px] top-[72px]">
                <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                    Alur sebuah pengajuan
                </h2>
                <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                    Setiap status menunjukkan siapa yang harus bertindak berikutnya.
                </p>
            </div>

            <svg className="absolute inset-0" width={1280} height={720}>
                <defs>
                    <marker id="head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                        <path d="M0,0 L8,4 L0,8 z" fill="var(--ob-ink-3)" />
                    </marker>
                </defs>
                {[0, 1, 2].map((i) => {
                    const x1 = cardX(i) + CARD.w + 8;
                    const x2 = cardX(i + 1) - 10;
                    const y = CARD.y + CARD.h / 2;
                    return draws[i] > 0 ? <line key={i} x1={x1} y1={y} x2={x1 + (x2 - x1) * draws[i]} y2={y} stroke="var(--ob-ink-3)" strokeWidth={2} markerEnd="url(#head)" /> : null;
                })}
                {draws[3] > 0 && (
                    <line x1={rejectX + 90} y1={CARD.y + CARD.h + 8} x2={rejectX + 90} y2={CARD.y + CARD.h + 8 + (rejectY - CARD.y - CARD.h - 18) * draws[3]} stroke="var(--ob-late)" strokeWidth={2} markerEnd="url(#head)" />
                )}
                {draws[4] > 0 && (
                    <line x1={rejectX + 160} y1={rejectY - 8} x2={rejectX + 160} y2={rejectY - 8 - (rejectY - CARD.y - CARD.h - 18) * draws[4]} stroke="var(--ob-act)" strokeWidth={2} strokeDasharray="6 5" markerEnd="url(#head)" />
                )}
            </svg>

            {FLOW.map((step, i) => (
                <div
                    key={step.status}
                    style={{ left: cardX(i), top: CARD.y, width: CARD.w, height: CARD.h, ...appear(30 + i * 36) }}
                    className="absolute flex flex-col gap-3 rounded-3xl border border-ob-line bg-ob-card p-5"
                >
                    <ReimbursementStatusPill status={step.status} className="origin-left scale-125 self-start" />
                    <div className="mt-1 flex flex-col items-start gap-1.5">
                        <RoleChip role={step.role} className="px-2.5 py-0.5 text-[13px]" />
                        <p className="text-[15px] font-medium">{step.what}</p>
                    </div>
                </div>
            ))}

            <div style={{ left: rejectX - 210, top: CARD.y + CARD.h + 40, opacity: draws[3] }} className="absolute w-[290px] text-right text-[15px] text-ob-ink-2">
                Finance manager menolak
                <br />
                <span className="text-ob-ink-3">wajib dengan alasan</span>
            </div>
            <div style={{ left: rejectX + 180, top: CARD.y + CARD.h + 40, opacity: draws[4] }} className="absolute w-[260px] text-[15px] text-ob-ink-2">
                Staff memperbaiki
                <br />
                <span className="text-ob-ink-3">lalu mengajukan ulang</span>
            </div>
            <div style={{ left: rejectX, top: rejectY, width: CARD.w, ...appear(rejectAt + 8) }} className="absolute flex flex-col gap-2 rounded-3xl border border-ob-line bg-ob-card p-5">
                <ReimbursementStatusPill status="rejected" className="origin-left scale-125 self-start" />
                <p className="mt-1 text-[15px] font-medium">Kembali ke pemohon</p>
            </div>

            <div style={{ left: cardX(3), top: CARD.y + CARD.h + 28, width: CARD.w, ...appear(rejectAt + 60) }} className="absolute rounded-2xl bg-ob-inner p-4 text-[14px] leading-snug text-ob-ink-2">
                <span className="font-semibold text-ob-ink">Dicicil?</span> Status tetap <span className="font-semibold text-ob-act">Disetujui</span> sampai seluruh nominal terbayar.
            </div>
        </Stage>
    );
}

export function ChapterCard({ part, total, role, title, summary }: { part: number; total: number; role: Role; title: string; summary: string }) {
    return (
        <Stage className="flex flex-col justify-center px-24">
            <p style={useEnter(0)} className="text-base font-semibold tabular-nums text-ob-ink-3">
                Bagian {part} dari {total}
            </p>
            <div style={useEnter(4)} className="mt-4">
                <RoleChip role={role} className="px-4 py-1.5 text-base" />
            </div>
            <h2 style={useEnter(8)} className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-balance">
                {title}
            </h2>
            <p style={useEnter(14)} className="mt-4 max-w-2xl text-xl text-ob-ink-2">
                {summary}
            </p>
        </Stage>
    );
}

type Cell = boolean | string;
const MATRIX: { action: string; cells: [Cell, Cell, Cell] }[] = [
    { action: 'Membuat & mengajukan pengajuan', cells: [true, true, true] },
    { action: 'Mengedit & mengajukan ulang (milik sendiri)', cells: [true, true, true] },
    { action: 'Melihat pengajuan semua karyawan', cells: [false, true, true] },
    { action: 'Menyetujui / menolak', cells: [false, true, true] },
    { action: 'Membayar (lunas / cicilan)', cells: [false, true, true] },
    { action: 'Menghapus pengajuan', cells: ['Draft / ditolak miliknya', false, 'Semua yang belum dibayar'] },
];

export function Recap() {
    const frame = useCurrentFrame();
    const roles = [ROLES.staff, ROLES.fm, ROLES.admin];
    return (
        <Stage className="flex flex-col justify-center px-20">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                Ringkasan hak akses
            </h2>
            <div style={useEnter(6)} className="mt-8 overflow-hidden rounded-3xl border border-ob-line bg-ob-card">
                <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-ob-line px-6 py-4">
                    <span className="text-sm font-semibold text-ob-ink-2">Aksi</span>
                    {roles.map((r) => (
                        <span key={r.label} className="flex justify-center">
                            <RoleChip role={r} />
                        </span>
                    ))}
                </div>
                {MATRIX.map((row, i) => {
                    const at = 20 + i * 12;
                    const p = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    return (
                        <div key={row.action} style={{ opacity: p }} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center border-b border-ob-line px-6 py-3.5 last:border-b-0">
                            <span className="text-[18px] font-medium">{row.action}</span>
                            {row.cells.map((cell, j) => (
                                <span key={j} className="flex justify-center text-center text-[14px] font-medium text-ob-ink-2">
                                    {cell === true ? (
                                        <Check className="h-5 w-5 text-ob-pos" strokeWidth={3} />
                                    ) : cell === false ? (
                                        <X className="h-5 w-5 text-ob-ink-3" strokeWidth={2.5} />
                                    ) : (
                                        cell
                                    )}
                                </span>
                            ))}
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}

export function Outro() {
    return (
        <Stage dark className="flex flex-col items-center justify-center text-center">
            <Sfx name="success" at={4} frames={27} />
            <h2 style={useEnter(0)} className="text-5xl font-bold tracking-tight">
                Siap mencoba?
            </h2>
            <p style={useEnter(8)} className="mt-4 text-xl text-ob-ink-2">
                Buka menu <span className="font-semibold text-ob-ink">Operasional › Reimbursement</span> → <span className="font-semibold text-ob-ink">Buat pengajuan</span>
            </p>
        </Stage>
    );
}

/** Muncul + geser naik di frame `at`. */
function useAppear(at: number) {
    const p = interpolate(useCurrentFrame(), [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { opacity: p, transform: `translateY(${(1 - p) * 14}px)` };
}

const IMPACT: { title: string; tone: 'act' | 'pos'; icon: React.ReactNode; items: { icon: React.ReactNode; text: React.ReactNode }[] }[] = [
    {
        title: 'Saat disetujui',
        tone: 'act',
        icon: <CheckCircle2 className="h-5 w-5" />,
        items: [
            { icon: <ListChecks className="h-4 w-4" />, text: 'Status menjadi Disetujui; peninjau, waktu, dan catatannya masuk riwayat.' },
            { icon: <Tag className="h-4 w-4" />, text: 'Kategori akuntansi disimpan, dan baru dipakai saat pembayaran dicatat.' },
            { icon: <Minus className="h-4 w-4" />, text: <><b>Belum ada uang keluar</b>: saldo rekening dan laporan belum berubah.</> },
            { icon: <ArrowRight className="h-4 w-4" />, text: 'Masuk antrean bayar: badge di menu Operasional bertambah.' },
        ],
    },
    {
        title: 'Saat dibayar',
        tone: 'pos',
        icon: <Wallet className="h-5 w-5" />,
        items: [
            { icon: <ReceiptText className="h-4 w-4" />, text: <><b>1 transaksi bank keluar</b> per pembayaran. Dicicil 2× berarti 2 transaksi.</> },
            { icon: <Landmark className="h-4 w-4" />, text: 'Saldo rekening sumber langsung berkurang.' },
            { icon: <ArrowRight className="h-4 w-4" />, text: 'Tampil di Arus Kas › Pengeluaran dengan kategori akuntansinya.' },
            { icon: <BarChart3 className="h-4 w-4" />, text: 'Masuk Laba Rugi sesuai grup kategori, mis. Beban Operasional.' },
            { icon: <Check className="h-4 w-4" />, text: 'Sisa berkurang; bila sudah penuh, status menjadi Lunas.' },
        ],
    },
];

export function Impact() {
    let at = 24;
    return (
        <Stage className="flex flex-col justify-center px-16">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                Apa yang terjadi di balik layar?
            </h2>
            <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                Menyetujui belum memindahkan uang. Membayar yang mengubah rekening dan laporan.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-5">
                {IMPACT.map((col) => {
                    const head = at;
                    at += 14;
                    const tone = col.tone === 'act' ? 'bg-ob-act/12 text-ob-act' : 'bg-ob-pos/12 text-ob-pos';
                    return (
                        <div key={col.title} className="flex flex-col gap-4 rounded-3xl border border-ob-line bg-ob-card p-6">
                            <Sfx name="pop" at={head} />
                            <div style={useAppear(head)} className="flex items-center gap-3">
                                <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', tone)}>{col.icon}</span>
                                <p className="text-2xl font-semibold">{col.title}</p>
                            </div>
                            <ul className="flex flex-col gap-3">
                                {col.items.map((item, i) => {
                                    const itemAt = at;
                                    at += 22;
                                    return (
                                        <li key={i} style={useAppear(itemAt)} className="flex items-start gap-3 text-[17px] leading-snug">
                                            <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', tone)}>{item.icon}</span>
                                            <span className="[&_b]:font-semibold">{item.text}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}

const SOURCE = {
    auto: { label: 'Otomatis', className: 'bg-ob-chip text-ob-ink-2' },
    approve: { label: 'Dialog Setujui', className: 'bg-ob-act/12 text-ob-act' },
    pay: { label: 'Dialog Bayar', className: 'bg-ob-pos/12 text-ob-pos' },
};

const ANATOMY: { label: string; value: React.ReactNode; source: keyof typeof SOURCE }[] = [
    { label: 'Jenis', value: 'Keluar (debit)', source: 'auto' },
    { label: 'Rekening', value: 'BCA - Operasional', source: 'pay' },
    { label: 'Tanggal', value: '11 Okt 2026 (tanggal bayar)', source: 'pay' },
    { label: 'Jumlah', value: <span className="font-semibold text-ob-neg">−Rp 185.000</span>, source: 'pay' },
    { label: 'Kategori', value: 'OPERASIONAL', source: 'approve' },
    { label: 'Deskripsi', value: 'Pelunasan Reimbursement: Taksi ke kantor PT Sinar Jaya - Staf Uji', source: 'auto' },
    { label: 'Referensi', value: 'TRF-2026-1011', source: 'pay' },
];

export function Anatomy() {
    return (
        <Stage className="flex flex-col justify-center px-24">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                Isi transaksi bank yang dibuat otomatis
            </h2>
            <p style={useEnter(5)} className="mt-2 text-lg text-ob-ink-2">
                Contoh dari pembayaran tadi, beserta asal setiap datanya.
            </p>
            <div style={useEnter(12)} className="mt-8 overflow-hidden rounded-3xl border border-ob-line bg-ob-card">
                {ANATOMY.map((row, i) => {
                    const at = 24 + i * 20;
                    return (
                        <div key={row.label} style={useAppear(at)} className="grid grid-cols-[150px_1fr_auto] items-center gap-6 border-b border-ob-line px-7 py-3.5 last:border-b-0">
                            <Sfx name="pop" at={at} />
                            <span className="text-[15px] text-ob-ink-2">{row.label}</span>
                            <span className="text-[17px] font-medium">{row.value}</span>
                            <span className={cn('rounded-full px-3 py-1 text-[13px] font-semibold', SOURCE[row.source].className)}>{SOURCE[row.source].label}</span>
                        </div>
                    );
                })}
            </div>
            <p style={useAppear(24 + ANATOMY.length * 20 + 10)} className="mt-5 text-[16px] text-ob-ink-2">
                Pembayaran sebagian memakai awalan <b className="text-ob-ink">Cicilan</b>; pembayaran yang melunasi memakai <b className="text-ob-ink">Pelunasan</b>.
            </p>
        </Stage>
    );
}

const WARNINGS: { title: string; body: string }[] = [
    { title: 'Pilih kategori akuntansi dengan teliti', body: 'Kategori ini menentukan baris di Arus Kas dan Laba Rugi. Salah kategori berarti laporannya ikut salah.' },
    { title: 'Jangan hapus atau ubah transaksi pembayarannya', body: 'Bila transaksi itu dihapus atau diubah di Arus Kas / Rekening, status dan sisa reimbursement tidak ikut kembali. Pengajuan tetap tercatat lunas.' },
    { title: 'Yang sudah dibayar tidak bisa dihapus', body: 'Termasuk oleh Admin. Hapus pengajuan hanya sebelum ada pembayaran.' },
    { title: 'Menghapus rekening bank menghapus semua transaksinya', body: 'Termasuk catatan pembayaran reimbursement dari rekening itu. Status reimbursement tidak ikut berubah.' },
];

export function Warnings() {
    return (
        <Stage className="flex flex-col justify-center px-16">
            <h2 style={useEnter(0)} className="text-4xl font-bold tracking-tight">
                Yang perlu diperhatikan Admin
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-5">
                {WARNINGS.map((w, i) => {
                    const at = 20 + i * 45;
                    return (
                        <div key={w.title} style={useAppear(at)} className="flex gap-4 rounded-3xl border border-ob-line bg-ob-card p-6">
                            <Sfx name="pop" at={at} />
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ob-wait/12 text-ob-wait">
                                <TriangleAlert className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-xl font-semibold leading-snug">{w.title}</p>
                                <p className="mt-2 text-[16px] leading-snug text-ob-ink-2">{w.body}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Stage>
    );
}
