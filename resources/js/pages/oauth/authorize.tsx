import { Head } from '@inertiajs/react';
import { Building2, Check, Info } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from '@/pages/invoices/components/ob';

interface Props {
    clientName: string;
    redirectHost: string | null;
    userName: string | null;
    readableCompanies: { kode: string; nama: string }[];
    form: { state: string; client_id: string; auth_token: string };
    approveUrl: string;
    denyUrl: string;
}

const BISA = [
    'Hanya membaca: invoice, rekening & mutasi, laba rugi, klien, layanan, reimbursement, pengajuan dana, utang, dan piutang.',
    'Tidak bisa menambah, mengubah, atau menghapus data apa pun.',
    'Mengikuti izin peran Anda di tiap perusahaan.',
];

const PERHATIKAN = [
    'Data yang dibaca Claude ikut masuk ke percakapan dan diproses oleh Anthropic.',
    'Akses bisa dicabut kapan saja di Pengaturan › Koneksi Claude.',
];

/**
 * Persetujuan OAuth saat Claude meminta akses (Passport GET /oauth/authorize).
 * Form HTML biasa, bukan Inertia: Passport menjawab dengan redirect ke domain Claude.
 */
export default function OAuthAuthorize({ clientName, redirectHost, userName, readableCompanies, form, approveUrl, denyUrl }: Props) {
    const csrf = getCsrfToken();
    const allowed = readableCompanies.length > 0;

    const hidden = (
        <>
            <input type="hidden" name="_token" value={csrf} />
            <input type="hidden" name="state" value={form.state} />
            <input type="hidden" name="client_id" value={form.client_id} />
            <input type="hidden" name="auth_token" value={form.auth_token} />
        </>
    );

    return (
        <>
            <Head title="Hubungkan Claude" />
            <main className="flex min-h-dvh items-center justify-center bg-ob-page px-4 py-10">
                <div className="ob-motion ob-fade-in w-full max-w-lg rounded-3xl border border-ob-line bg-ob-card p-6 text-ob-ink sm:p-8">
                    <p className="text-[13px] font-medium text-ob-ink-2">Kisantra Finance</p>
                    <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.01em]">
                        Izinkan {clientName} membaca data keuangan?
                    </h1>
                    <p className="mt-2 text-sm text-ob-ink-2">
                        Masuk sebagai <span className="font-semibold text-ob-ink">{userName}</span>.
                        {redirectHost && (
                            <>
                                {' '}
                                Setelah ini Anda kembali ke <span className="font-mono text-ob-ink">{redirectHost}</span>.
                            </>
                        )}
                    </p>

                    <section aria-labelledby="perusahaan-judul" className="mt-6 rounded-2xl bg-ob-inner p-4">
                        <h2 id="perusahaan-judul" className="text-[13px] font-semibold">
                            {allowed ? 'Perusahaan yang bisa dibaca' : 'Belum ada perusahaan yang bisa dibaca'}
                        </h2>
                        {allowed ? (
                            <ul className="mt-3 flex flex-col gap-2">
                                {readableCompanies.map((company) => (
                                    <li key={company.kode} className="flex items-center gap-2.5 text-sm">
                                        <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-ob-ink-3" />
                                        <span className="min-w-0 truncate">{company.nama}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-2 text-[13px] text-ob-ink-2">
                                Peran Anda belum punya izin <span className="font-mono">use claude</span> di perusahaan mana pun. Minta admin
                                mengaktifkannya di Administrasi › Izin & Peran, lalu hubungkan ulang.
                            </p>
                        )}
                    </section>

                    <ul className="mt-5 flex flex-col gap-2.5 text-[13px] text-ob-ink-2">
                        {BISA.map((teks) => (
                            <li key={teks} className="flex gap-2.5">
                                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ob-pos" />
                                <span>{teks}</span>
                            </li>
                        ))}
                        {PERHATIKAN.map((teks) => (
                            <li key={teks} className="flex gap-2.5">
                                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ob-ink-3" />
                                <span>{teks}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <form method="POST" action={denyUrl}>
                            {hidden}
                            <input type="hidden" name="_method" value="DELETE" />
                            <Button type="submit" variant="outline" className="w-full sm:w-auto">
                                Tolak
                            </Button>
                        </form>
                        {allowed && (
                            <form method="POST" action={approveUrl}>
                                {hidden}
                                <Button type="submit" className="w-full sm:w-auto">
                                    Izinkan
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
