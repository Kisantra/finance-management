import { Check, Clock } from 'lucide-react';
import * as React from 'react';
import { StatusPill } from '@/components/dashboard/widget';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTanggal, t, tk } from '@/i18n';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { daysFromToday, rp } from '@/pages/invoices/components/ob';

/*
 * Jadwal angsuran — dipakai Pinjaman dan Piutang.
 *
 * Kedua endpoint (`/loans/{id}/schedule`, `/receivables/{id}/schedule`) mengembalikan
 * bentuk yang sama persis, jadi komponen ini satu untuk keduanya; bedanya hanya `path`.
 *
 * JUJUR SOAL YANG TIDAK DIKETAHUI. Tabel pembayaran menyimpan pecahan pokok/bunga tanpa
 * nomor termin, jadi mustahil mengklaim "termin ke-3 lunas". Yang ditampilkan: jadwal
 * RENCANA, lalu pembayaran NYATA dialokasikan kumulatif dari termin paling awal — dan
 * kalimat di kepala panel mengatakan itu, supaya angka di layar tidak dibaca sebagai
 * fakta yang tidak dimiliki database.
 *
 * Diambil saat panel dibuka, bukan ikut payload daftar: menghitung N jadwal untuk satu
 * halaman 15 baris berarti 2 query per baris untuk data yang belum diminta siapa pun.
 */

export interface BarisJadwal {
    termin: number;
    jatuh_tempo: string;
    pokok: number;
    bunga: number;
    angsuran: number;
    pokok_terbayar: number;
    bunga_terbayar: number;
    status: 'lunas' | 'sebagian' | 'belum';
    terlambat: boolean;
}

export interface RingkasanJadwal {
    principal: number;
    interest: number;
    terms: number;
    start_date: string | null;
    principal_paid: number;
    interest_paid: number;
}

interface Props {
    /** Path aplikasi tanpa prefix perusahaan, mis. `/loans/12/schedule`. */
    path: string;
    /** Masuk ke aria-label tabel, mis. "Jadwal angsuran pinjaman PJM/2026/001". */
    label: string;
    /**
     * Tandai termin paling awal yang belum lunas sebagai "berikutnya".
     * Dimatikan untuk utang/piutang yang BELUM berjalan: menyorot termin yang harus
     * dibayar duluan pada sesuatu yang belum disetujui menjanjikan aksi yang belum ada.
     */
    tandaiBerikutnya?: boolean;
}

type Muat = { state: 'memuat' } | { state: 'gagal' } | { state: 'siap'; rows: BarisJadwal[]; summary: RingkasanJadwal };

const TANGGAL_TERMIN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** Dasar `summary` supaya ringkasan tetap bisa dirender kalau satu field hilang dari respons. */
const KOSONG: RingkasanJadwal = {
    principal: 0,
    interest: 0,
    terms: 0,
    start_date: null,
    principal_paid: 0,
    interest_paid: 0,
};

/**
 * Kode status (dari server) → label + nada. Label = kunci konteks 'angsuran' (ZH: 部分还款, beda dengan
 * "Sebagian" pada invoice yang 部分收款), diterjemahkan saat render.
 */
const STATUS: Record<BarisJadwal['status'], { label: string; tone: 'pos' | 'wait' | 'neutral' }> = {
    lunas: { label: tk('Lunas', 'angsuran'), tone: 'pos' },
    sebagian: { label: tk('Sebagian', 'angsuran'), tone: 'wait' },
    belum: { label: tk('Belum', 'angsuran'), tone: 'neutral' },
};

function PilStatus({ status }: { status: BarisJadwal['status'] }) {
    const { label, tone } = STATUS[status];
    return (
        <StatusPill tone={tone} icon={status === 'lunas' ? <Check className="h-3 w-3" strokeWidth={3} /> : undefined}>
            {t(label, { context: 'angsuran' })}
        </StatusPill>
    );
}

/** Penanda lewat tempo: jam + jumlah hari. Warna hanya redundansi, bukan satu-satunya tanda. */
function PenandaTerlambat({ iso }: { iso: string }) {
    const hari = -daysFromToday(iso);
    return (
        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-ob-late/12 px-1.5 text-xs font-semibold text-ob-late">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {t('lewat {{count}} hari', { count: hari })}
        </span>
    );
}

export function JadwalAngsuran({ path, label, tandaiBerikutnya = true }: Props) {
    const [muat, setMuat] = React.useState<Muat>({ state: 'memuat' });

    const ambil = React.useCallback(() => {
        let batal = false;
        setMuat({ state: 'memuat' });

        api(path)
            .then((res) => {
                if (!res.ok) throw new Error(String(res.status));
                return res.json();
            })
            .then((data) => {
                if (!batal)
                    setMuat({
                        state: 'siap',
                        rows: data.rows ?? [],
                        summary: { ...KOSONG, ...data.summary },
                    });
            })
            .catch(() => {
                if (!batal) setMuat({ state: 'gagal' });
            });

        return () => {
            batal = true;
        };
    }, [path]);

    // `ambil` mengembalikan pembatalnya, jadi ia sekaligus jadi cleanup effect-nya.
    React.useEffect(() => ambil(), [ambil]);

    if (muat.state === 'memuat') {
        // Skeleton berbentuk baris, bukan spinner: tata letaknya sudah terlihat sebelum
        // angkanya datang, jadi tidak ada lompatan saat data masuk.
        return (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label={t('Memuat {{label}}', { label })}>
                {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-14 rounded-2xl bg-ob-inner dark:bg-ob-inner" />
                ))}
            </div>
        );
    }

    if (muat.state === 'gagal') {
        return (
            <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-ob-late/35 bg-ob-inner p-5 text-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ob-late/15 text-[13px] font-bold text-ob-late">!</span>
                <span className="text-[13px] font-semibold text-ob-ink">{t('Jadwal angsuran gagal dimuat')}</span>
                <span className="max-w-[320px] text-xs leading-relaxed text-ob-ink-2">
                    {t('Sisa data di panel ini tetap bisa dibaca. Angka jadwalnya saja yang belum sampai.')}
                </span>
                <button
                    type="button"
                    onClick={ambil}
                    className="mt-1 h-8 rounded-xl border border-ob-line bg-ob-card px-3.5 text-xs font-semibold text-ob-ink hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                >
                    {t('Coba lagi')}
                </button>
            </div>
        );
    }

    const { rows, summary } = muat;

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-ob-line-strong px-5 py-8 text-center">
                <span className="text-[13px] font-semibold text-ob-ink">{t('Jadwal belum bisa disusun')}</span>
                <span className="max-w-[340px] text-xs leading-relaxed text-ob-ink-2">
                    {summary.terms > 0 ? t('Tanggal mulai belum terisi.') : t('Tenor masih 0 bulan.')}{' '}
                    {t('Lengkapi datanya lewat Ubah, lalu jadwalnya muncul sendiri.')}
                </span>
            </div>
        );
    }

    // Termin yang perlu dibayar berikutnya = yang paling awal belum lunas. Ini satu-satunya
    // pertanyaan "termin mana" yang bisa dijawab jujur dari data yang ada.
    const indeksBerikut = tandaiBerikutnya ? rows.findIndex((r) => r.status !== 'lunas') : -1;
    const totalAngsuran = summary.principal + summary.interest;
    const totalTerbayar = summary.principal_paid + summary.interest_paid;

    return (
        <div className="ob-motion flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-ob-ink-2">
                {t(
                    'Rencana {{count}} termin. Pembayaran yang masuk ditutup dari termin paling awal, karena setiap pembayaran mencatat pokok dan bunga tanpa nomor termin.',
                    { count: rows.length },
                )}
            </p>

            {/* Ponsel: daftar bertumpuk. Tabel 6 kolom berisi uang tidak bisa muat di 360 px tanpa memotong nominal. */}
            <ul className="flex flex-col gap-2 md:hidden">
                {rows.map((row, i) => (
                    <li key={row.termin} className={cn('flex flex-col gap-2 rounded-2xl border border-ob-line p-3', i === indeksBerikut ? 'bg-ob-inner' : 'bg-ob-card')}>
                        <div className="flex items-start justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2.5">
                                <TileTermin nomor={row.termin} berikut={i === indeksBerikut} />
                                <span className="flex min-w-0 flex-col">
                                    <span className="text-[13px] font-semibold text-ob-ink">{formatTanggal(row.jatuh_tempo, TANGGAL_TERMIN)}</span>
                                    <span className="text-xs tabular-nums text-ob-ink-2">
                                        {t('pokok {{principal}} · bunga {{interest}}', { principal: rp(row.pokok), interest: rp(row.bunga) })}
                                    </span>
                                </span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-ob-ink">{rp(row.angsuran)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <PilStatus status={row.status} />
                            {row.terlambat && <PenandaTerlambat iso={row.jatuh_tempo} />}
                            {row.status === 'sebagian' && (
                                <span className="text-xs tabular-nums text-ob-ink-2">{t('tertutup {{amount}}', { amount: rp(row.pokok_terbayar + row.bunga_terbayar) })}</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {/* relative: teks sr-only di <th> berposisi absolut dan tanpa ini lolos dari pemotongan, lalu melebarkan halaman. */}
            <div className="relative -mx-1 hidden overflow-x-auto px-1 md:block">
                <table aria-label={label} className="w-full min-w-[680px] text-sm">
                    <thead>
                        <tr className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3">
                            <th className="w-12 py-2 pl-1 font-medium">
                                <span className="sr-only">{t('Termin ke-')}</span>#
                            </th>
                            <th className="py-2 font-medium">{t('Jatuh tempo')}</th>
                            <th className="py-2 pr-4 text-right font-medium">{t('Pokok')}</th>
                            <th className="py-2 pr-4 text-right font-medium">{t('Bunga')}</th>
                            <th className="py-2 pr-4 text-right font-medium">{t('Angsuran')}</th>
                            <th className="py-2 font-medium">{t('Status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={row.termin} className={cn('border-b border-ob-line-soft last:border-0', i === indeksBerikut && 'bg-ob-inner')}>
                                <td className="py-2.5 pl-1">
                                    <TileTermin nomor={row.termin} berikut={i === indeksBerikut} />
                                </td>
                                <td className="py-2.5 pr-4">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-ob-ink">{formatTanggal(row.jatuh_tempo, TANGGAL_TERMIN)}</span>
                                        {row.terlambat && <PenandaTerlambat iso={row.jatuh_tempo} />}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums text-ob-ink-2">{rp(row.pokok)}</td>
                                <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums text-ob-ink-2">{rp(row.bunga)}</td>
                                <td className="whitespace-nowrap py-2.5 pr-4 text-right font-semibold tabular-nums text-ob-ink">{rp(row.angsuran)}</td>
                                <td className="py-2.5">
                                    <span className="flex flex-col items-start gap-0.5">
                                        <PilStatus status={row.status} />
                                        {row.status === 'sebagian' && (
                                            <span className="whitespace-nowrap text-xs tabular-nums text-ob-ink-3">
                                                {t('tertutup {{amount}}', { amount: rp(row.pokok_terbayar + row.bunga_terbayar) })}
                                            </span>
                                        )}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {/* Jumlah seluruh termin PERSIS pokok + bunga — invarian yang dijaga test, ditampilkan supaya bisa dicek mata. */}
                    <tfoot>
                        <tr className="border-t border-ob-line text-[13px]">
                            <td colSpan={2} className="py-2.5 pl-1 text-ob-ink-2">
                                {t('Jumlah {{count}} termin', { count: rows.length })}
                            </td>
                            <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums text-ob-ink-2">{rp(summary.principal)}</td>
                            <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums text-ob-ink-2">{rp(summary.interest)}</td>
                            <td className="whitespace-nowrap py-2.5 pr-4 text-right font-semibold tabular-nums text-ob-ink">{rp(totalAngsuran)}</td>
                            <td className="py-2.5 text-xs text-ob-ink-2">{t('terbayar {{amount}}', { amount: rp(totalTerbayar) })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Ringkasan yang sama untuk ponsel, karena tfoot tabel tidak ikut terlihat di sana. */}
            <div className="flex flex-col gap-1 rounded-2xl bg-ob-inner p-3 text-[13px] md:hidden">
                <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ob-ink-2">{t('Jumlah {{count}} termin', { count: rows.length })}</span>
                    <span className="font-semibold tabular-nums text-ob-ink">{rp(totalAngsuran)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ob-ink-2">{t('Sudah terbayar')}</span>
                    <span className="tabular-nums text-ob-ink">{rp(totalTerbayar)}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Nomor termin dalam tile. Nomornya adalah identitas baris, dan tile-nya terulang ke bawah
 * sehingga urutannya bisa dipindai tanpa membaca tanggal. Termin berikutnya memakai warna
 * aksi — satu-satunya tempat biru dipakai di panel ini.
 */
function TileTermin({ nomor, berikut }: { nomor: number; berikut: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums', berikut ? 'bg-ob-act-fill text-white' : 'bg-ob-chip text-ob-ink-2')}
        >
            {nomor}
        </span>
    );
}
