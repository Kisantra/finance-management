import { Head, router, usePage } from '@inertiajs/react';
import { Building2, Check, Copy, Info, Plug, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { companyUrl } from '@/lib/company';
import { copyText, toastError } from '@/lib/utils';
import { dateTime, daysFromToday, longDate } from '@/pages/invoices/components/ob';
import type { SharedProps } from '@/types';
import { t, tk, Trans } from '@/i18n';

/*
 * Koneksi Claude: alamat konektor MCP + cara menghubungkan, perusahaan yang bisa dibaca, dan
 * sambungan OAuth aktif milik user ini. Halaman persetujuan OAuth (pages/oauth/authorize.tsx)
 * menjanjikan "Akses bisa dicabut kapan saja di Pengaturan › Koneksi Claude": janji itu di sini.
 */

interface Connection {
    id: string;
    name: string;
    connectedAt: string;
    lastActiveAt: string;
    /** Batas login ulang bila tidak dipakai: refresh token terakhir (bergeser tiap kali dipakai). */
    expiresAt: string | null;
}

interface Props {
    connectorUrl: string;
    readableCompanies: { kode: string; nama: string }[];
    connections: Connection[];
    canUse: boolean;
    /** Kunci OAuth server: dibuat otomatis saat pemegang `use claude` membuka halaman ini. */
    oauthKeyStatus: 'siap' | 'baru' | 'gagal' | 'belum';
}

const STATUS_KUNCI: Record<Exclude<Props['oauthKeyStatus'], 'siap'>, { tone: string; ikon: React.ReactNode; judul: string; isi: React.ReactNode }> = {
    baru: {
        tone: 'border-ob-pos/40 bg-ob-pos/10',
        ikon: <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ob-pos" />,
        judul: tk('Server baru saja disiapkan'),
        isi: tk('Kunci OAuth untuk koneksi Claude dibuat otomatis. Koneksi siap dipakai.'),
    },
    gagal: {
        tone: 'border-ob-late/40 bg-ob-late/10',
        ikon: <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ob-late" />,
        judul: tk('Server belum siap untuk Claude'),
        isi: (
            <Trans
                i18nKey="Kunci OAuth gagal dibuat otomatis (folder <kode>storage</kode> kemungkinan tidak bisa ditulis). Minta admin server menjalankan <kode>php artisan passport:keys</kode> sebagai pengguna situs, lalu buka ulang halaman ini."
                components={{ kode: <span className="font-mono" /> }}
            />
        ),
    },
    belum: {
        tone: 'border-ob-wait/40 bg-ob-wait/10',
        ikon: <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ob-wait" />,
        judul: tk('Server belum siap untuk Claude'),
        isi: tk('Kunci OAuth dibuat otomatis saat pengguna berizin use claude membuka halaman ini.'),
    },
};

function StatusKunci({ status }: { status: Props['oauthKeyStatus'] }) {
    if (status === 'siap') {
        return null;
    }

    const s = STATUS_KUNCI[status];

    return (
        <div role={status === 'gagal' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-2xl border p-3.5 ${s.tone}`}>
            {s.ikon}
            <div className="min-w-0 text-[13px] text-ob-ink-2">
                <p className="font-semibold text-ob-ink">{t(s.judul)}</p>
                <p>{typeof s.isi === 'string' ? t(s.isi) : s.isi}</p>
            </div>
        </div>
    );
}

const NAMA_KONEKTOR = 'Kisantra Finance';

const TEBAL = <strong className="font-semibold text-ob-ink" />;

const LANGKAH: React.ReactNode[] = [
    <Trans
        i18nKey="Di Claude (web atau desktop), buka <b>Settings › Connectors</b>, lalu pilih <b>Add custom connector</b>."
        components={{ b: TEBAL }}
    />,
    <Trans
        i18nKey="Beri nama <b>{{name}}</b>, tempel alamat konektor di atas, lalu klik <b>Connect</b>."
        values={{ name: NAMA_KONEKTOR }}
        components={{ b: TEBAL }}
    />,
    <Trans i18nKey="Claude membuka halaman aplikasi ini. Masuk bila diminta, lalu pilih <b>Izinkan</b>." components={{ b: TEBAL }} />,
    <Trans
        i18nKey="Di percakapan, aktifkan konektor <b>{{name}}</b> lalu bertanyalah, misalnya “Berapa invoice yang lewat jatuh tempo bulan ini?”"
        values={{ name: NAMA_KONEKTOR }}
        components={{ b: TEBAL }}
    />,
];

const CATATAN: { aman: boolean; teks: string }[] = [
    { aman: true, teks: tk('Hanya membaca. Claude tidak bisa menambah, mengubah, atau menghapus data apa pun.') },
    { aman: true, teks: tk('Mengikuti izin peran Anda di tiap perusahaan. Yang tidak bisa Anda buka di aplikasi juga tidak bisa dibaca Claude.') },
    { aman: false, teks: tk('Data yang dibaca Claude masuk ke percakapan dan diproses oleh Anthropic.') },
    { aman: false, teks: tk('Sambungan berakhir sendiri setelah 30 hari tidak dipakai. Setelah itu Claude meminta masuk dan izin lagi.') },
];

function sisaWaktu(iso: string): string {
    const hari = daysFromToday(iso);
    if (hari <= 0) return t('hari ini');
    if (hari === 1) return t('besok');
    return t('{{count}} hari lagi', { count: hari });
}

function AlamatKonektor({ url }: { url: string }) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [disalin, setDisalin] = React.useState(false);

    React.useEffect(() => {
        if (!disalin) return;
        const timer = window.setTimeout(() => setDisalin(false), 2000);
        return () => window.clearTimeout(timer);
    }, [disalin]);

    const salin = async () => {
        if (await copyText(url)) {
            setDisalin(true);
            return;
        }
        inputRef.current?.select();
        toastError(t('Browser menolak menyalin. Alamatnya sudah dipilih, salin dengan Ctrl+C.'));
    };

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
                <Input
                    ref={inputRef}
                    label={t('Alamat konektor')}
                    value={url}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono"
                    spellCheck={false}
                />
            </div>
            <Button
                type="button"
                variant="outline"
                onClick={salin}
                icon={disalin ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                className="h-10.5 w-full sm:w-28"
            >
                {disalin ? t('Disalin') : t('Salin')}
            </Button>
            <span className="sr-only" aria-live="polite">
                {disalin ? t('Alamat konektor disalin.') : ''}
            </span>
        </div>
    );
}

function SambunganItem({ connection, onCabut }: { connection: Connection; onCabut: () => void }) {
    return (
        <li className="rounded-2xl border border-ob-line bg-ob-inner p-4">
            <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ob-chip text-ob-ink-2">
                    <Plug className="h-4 w-4" />
                </span>
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ob-ink">{connection.name}</p>
                <Button type="button" variant="red" size="sm" onClick={onCabut} aria-label={t('Cabut sambungan {{name}}', { name: connection.name })}>
                    {t('Cabut')}
                </Button>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                <dt className="text-ob-ink-2">{t('Pertama tersambung')}</dt>
                <dd className="text-ob-ink">{longDate(connection.connectedAt)}</dd>
                <dt className="text-ob-ink-2">{t('Terakhir aktif')}</dt>
                <dd className="text-ob-ink">{dateTime(connection.lastActiveAt)}</dd>
                {connection.expiresAt && (
                    <>
                        <dt className="text-ob-ink-2">{t('Perlu masuk ulang')}</dt>
                        <dd className="text-ob-ink">{t('{{time}} bila tidak dipakai', { time: sisaWaktu(connection.expiresAt) })}</dd>
                    </>
                )}
            </dl>
        </li>
    );
}

export default function KoneksiClaude({ connectorUrl, readableCompanies, connections, canUse, oauthKeyStatus }: Props) {
    const { company } = usePage<SharedProps>().props;
    const [target, setTarget] = React.useState<Connection | null>(null);
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [revoking, setRevoking] = React.useState(false);

    const askRevoke = (connection: Connection) => {
        setTarget(connection);
        setConfirmOpen(true);
    };

    const revoke = () => {
        if (!target) return;
        setRevoking(true);
        router.delete(companyUrl(`/settings/claude/${encodeURIComponent(target.id)}`), {
            preserveScroll: true,
            onSuccess: (page) => {
                toast.success((page.props.flash as SharedProps['flash'] | undefined)?.success ?? t('Sambungan Claude dicabut.'));
                setConfirmOpen(false);
            },
            onFinish: () => setRevoking(false),
        });
    };

    const adaPerusahaan = readableCompanies.length > 0;

    return (
        <>
            <Head title={t('Koneksi Claude')} />

            <SettingsLayout
                bare
                title={t('Koneksi Claude')}
                description={t('Hubungkan Claude ke data keuangan agar Anda bisa bertanya langsung di percakapan. Claude hanya membaca dan mengikuti izin peran Anda.')}
            >
                {!canUse && (
                    <section
                        aria-labelledby="claude-izin-judul"
                        className="flex gap-3 rounded-3xl border border-ob-wait/40 bg-ob-wait/10 p-5 text-ob-ink sm:p-6"
                    >
                        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ob-wait" />
                        <div className="flex min-w-0 flex-col gap-1">
                            <h2 id="claude-izin-judul" className="text-[15px] font-semibold">
                                {adaPerusahaan
                                    ? t('{{name}} tidak ikut terbaca', { name: company?.name ?? t('Perusahaan ini') })
                                    : t('Claude belum bisa membaca perusahaan mana pun')}
                            </h2>
                            <p className="text-[13px] text-ob-ink-2">
                                {adaPerusahaan ? (
                                    <Trans
                                        i18nKey="Peran Anda di perusahaan ini belum punya izin <kode>use claude</kode>. Claude tetap bisa membaca perusahaan yang tercantum di Perusahaan yang bisa dibaca."
                                        components={{ kode: <span className="font-mono" /> }}
                                    />
                                ) : (
                                    <Trans
                                        i18nKey="Peran Anda belum punya izin <kode>use claude</kode>. Minta admin mengaktifkannya di Administrasi › Izin & Peran, lalu hubungkan Claude."
                                        components={{ kode: <span className="font-mono" /> }}
                                    />
                                )}
                                {connections.length > 0 && ` ${t('Sambungan yang sudah ada tetap bisa dicabut di bawah.')}`}
                            </p>
                        </div>
                    </section>
                )}

                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="flex min-w-0 flex-col gap-5">
                        <Card>
                            <CardHeader>
                                <h2 className="text-base font-semibold text-ob-ink">{t('Hubungkan Claude')}</h2>
                                <CardDescription>{t('Tambahkan aplikasi ini sebagai konektor kustom di Claude, lalu izinkan aksesnya.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-6">
                                <StatusKunci status={oauthKeyStatus} />
                                <AlamatKonektor url={connectorUrl} />
                                <ol role="list" className="flex flex-col gap-3">
                                    {LANGKAH.map((langkah, i) => (
                                        <li key={i} className="flex gap-3 text-sm text-ob-ink-2">
                                            <span
                                                aria-hidden="true"
                                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ob-chip text-xs font-semibold text-ob-ink"
                                            >
                                                {i + 1}
                                            </span>
                                            <span className="min-w-0 pt-0.5">{langkah}</span>
                                        </li>
                                    ))}
                                </ol>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <h2 className="flex items-baseline gap-2 text-base font-semibold text-ob-ink">
                                    {t('Sambungan aktif')}
                                    {connections.length > 0 && <span className="text-[13px] font-medium text-ob-ink-2">{connections.length}</span>}
                                </h2>
                                <CardDescription>{t('Akun Claude yang sudah Anda izinkan. Mencabut sambungan langsung memutus akses Claude.')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {connections.length > 0 ? (
                                    <ul className="flex flex-col gap-2">
                                        {connections.map((connection) => (
                                            <SambunganItem key={connection.id} connection={connection} onCabut={() => askRevoke(connection)} />
                                        ))}
                                    </ul>
                                ) : (
                                    <EmptyState
                                        icon={<Plug />}
                                        title={t('Belum ada sambungan')}
                                        description={t('Setelah Anda memilih Izinkan dari Claude, sambungannya muncul di sini dan bisa dicabut kapan saja.')}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex min-w-0 flex-col gap-5">
                        <Card>
                            <CardHeader>
                                <h2 className="text-base font-semibold text-ob-ink">{t('Perusahaan yang bisa dibaca')}</h2>
                                <CardDescription>
                                    <Trans
                                        i18nKey="Claude hanya membaca perusahaan tempat peran Anda punya izin <kode>use claude</kode>."
                                        components={{ kode: <span className="font-mono" /> }}
                                    />
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {adaPerusahaan ? (
                                    <ul className="flex flex-col gap-2.5">
                                        {readableCompanies.map((item) => (
                                            <li key={item.kode} className="flex items-center gap-2.5 text-sm text-ob-ink">
                                                <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-ob-ink-3" />
                                                <span className="min-w-0 truncate">{item.nama}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-[13px] text-ob-ink-2">{t('Belum ada perusahaan.')}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <h2 className="text-base font-semibold text-ob-ink">{t('Perlu diketahui')}</h2>
                            </CardHeader>
                            <CardContent>
                                <ul className="flex flex-col gap-3 text-[13px] text-ob-ink-2">
                                    {CATATAN.map(({ aman, teks }) => (
                                        <li key={teks} className="flex gap-2.5">
                                            {aman ? (
                                                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ob-pos" />
                                            ) : (
                                                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ob-ink-3" />
                                            )}
                                            <span>{t(teks)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </SettingsLayout>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={(open) => !revoking && setConfirmOpen(open)}
                title={t('Cabut sambungan {{name}}?', { name: target?.name ?? 'Claude' })}
                description={t('Claude langsung kehilangan akses ke data keuangan dan harus masuk serta meminta izin lagi. Percakapan yang sudah ada di Claude tidak ikut terhapus.')}
                confirmLabel={t('Cabut')}
                variant="danger"
                loading={revoking}
                onConfirm={revoke}
            />
        </>
    );
}

KoneksiClaude.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
