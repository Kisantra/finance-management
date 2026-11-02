import { Head, Link, useForm } from '@inertiajs/react';
import { Info, RotateCcw } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { cn, toastErrors } from '@/lib/utils';
import { BTN, FIELD, longDate } from '@/pages/invoices/components/ob';

/*
 * Penomoran invoice (referensi "Custom Invoice Number Settings"): pola token + jumlah digit +
 * periode reset, dengan pratinjau nomor yang langsung mengikuti isian. Nomor resmi tetap
 * disusun server (InvoiceNumberService); fungsi di sini hanya cermin untuk pratinjau dan
 * validasi instan, server memvalidasi ulang saat simpan.
 */

type Reset = 'monthly' | 'yearly' | 'never';

interface NumberingSettings {
    format: string;
    padding: number;
    reset: Reset;
}

interface Props {
    settings: NumberingSettings;
    defaults: NumberingSettings;
    tokens: { token: string; label: string }[];
    paddings: number[];
    hasCompany: boolean;
    sample: {
        date: string;
        company_initials: string;
        client_name: string;
        client_initials: string;
        next_sequence: Record<Reset, number>;
    };
    recent: { id: number; number: string; issue_date: string }[];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const RESET_OPTIONS: { value: Reset; label: string }[] = [
    { value: 'monthly', label: 'Tiap bulan' },
    { value: 'yearly', label: 'Tiap tahun' },
    { value: 'never', label: 'Tidak pernah' },
];

const RESET_HINT: Record<Reset, string> = {
    monthly: 'Invoice pertama tiap bulan kembali ke nomor 1.',
    yearly: 'Invoice pertama tiap tahun kembali ke nomor 1.',
    never: 'Nomor terus bertambah tanpa kembali ke 1.',
};

type Segment = { text: string; token?: string };

/** Cermin InvoiceNumberService::render(), dipecah per token agar bagian asal token bisa ditandai. */
function renderSegments(format: string, values: Record<string, string>): Segment[] {
    const segments: Segment[] = [];
    const pattern = /\{([A-Z0-9_]+)\}/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(format))) {
        if (match.index > last) segments.push({ text: format.slice(last, match.index) });
        segments.push(match[1] in values ? { text: values[match[1]], token: match[1] } : { text: match[0] });
        last = pattern.lastIndex;
    }
    if (last < format.length) segments.push({ text: format.slice(last) });
    return segments;
}

/** Cermin InvoiceNumberService::formatError() — pesan sama dengan server. */
function formatError(format: string, reset: Reset, known: string[]): string | null {
    if (!format.trim()) return 'Pola nomor wajib diisi.';
    const used = [...format.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
    const unknown = used.filter((token) => !known.includes(token));
    if (unknown.length) return `Token tidak dikenal: {${unknown.join('}, {')}}.`;
    if (/[{}]/.test(format.replace(/\{[A-Z0-9_]+\}/g, ''))) return 'Kurung kurawal hanya dipakai untuk token, mis. {NO}.';
    if (format.split('{NO}').length !== 2) return 'Pola wajib berisi {NO} tepat satu kali.';
    const hasYear = format.includes('{THN}') || format.includes('{THN2}');
    const hasMonth = format.includes('{BLN}') || format.includes('{BLN_ROMAWI}');
    if (reset === 'monthly' && !(hasMonth && hasYear)) {
        return 'Nomor kembali ke 1 tiap bulan, jadi pola wajib memuat bulan ({BLN_ROMAWI} atau {BLN}) dan tahun ({THN} atau {THN2}) agar tidak sama dengan nomor bulan lain.';
    }
    if (reset === 'yearly' && !hasYear) {
        return 'Nomor kembali ke 1 tiap tahun, jadi pola wajib memuat tahun ({THN} atau {THN2}) agar tidak sama dengan nomor tahun lain.';
    }
    return null;
}

export default function InvoiceNumberingSettings({ settings, defaults, tokens, paddings, hasCompany, sample, recent }: Props) {
    const form = useForm<NumberingSettings>(settings);
    const { data, setData } = form;
    const inputRef = React.useRef<HTMLInputElement>(null);

    const knownTokens = tokens.map((t) => t.token);
    const tokenLabel = Object.fromEntries(tokens.map((t) => [t.token, t.label]));
    const clientError = formatError(data.format, data.reset, knownTokens);
    const error = form.errors.format ?? clientError ?? undefined;

    const date = new Date(sample.date + 'T00:00:00');
    const sequence = sample.next_sequence[data.reset];
    const values: Record<string, string> = {
        NO: String(sequence).padStart(data.padding, '0'),
        PT: sample.company_initials,
        KLIEN: sample.client_initials,
        BLN_ROMAWI: ROMAN[date.getMonth()],
        BLN: String(date.getMonth() + 1).padStart(2, '0'),
        THN: String(date.getFullYear()),
        THN2: String(date.getFullYear()).slice(2),
    };
    const segments = renderSegments(data.format, values);
    const usedTokens = knownTokens.filter((token) => data.format.includes(`{${token}}`));
    const isDefault = data.format === defaults.format && data.padding === defaults.padding && data.reset === defaults.reset;

    /** Sisipkan token di posisi kursor (atau ganti teks yang diseleksi), lalu kembalikan fokus. */
    const insertToken = (token: string) => {
        const input = inputRef.current;
        const text = `{${token}}`;
        const start = input?.selectionStart ?? data.format.length;
        const end = input?.selectionEnd ?? start;
        setData('format', data.format.slice(0, start) + text + data.format.slice(end));
        requestAnimationFrame(() => {
            input?.focus();
            input?.setSelectionRange(start + text.length, start + text.length);
        });
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put('/settings/invoice-numbering', {
            preserveScroll: true,
            onSuccess: () => {
                form.setDefaults();
                toast.success('Format penomoran disimpan. Berlaku untuk invoice yang dikirim setelah ini.');
            },
            onError: (errors) => toastErrors(errors, 'Penomoran invoice'),
        });
    };

    return (
        <>
            <Head title="Penomoran Invoice" />

            <SettingsLayout
                bare
                title="Penomoran invoice"
                description="Atur bentuk nomor yang diberikan saat invoice dikirim. Nomor yang sudah terbit tidak ikut berubah."
            >
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <form onSubmit={submit} className="flex flex-col gap-7 rounded-3xl border border-ob-line bg-ob-card p-6 sm:p-8">
                        {!hasCompany && (
                            <p className="rounded-2xl border border-ob-wait/40 bg-ob-wait/10 px-4 py-3 text-[13px] text-ob-ink">
                                Profil perusahaan belum diisi. Pengaturan penomoran disimpan di profil perusahaan,{' '}
                                <Link href="/settings/company" className="font-semibold text-ob-act hover:underline">
                                    isi profil perusahaan
                                </Link>{' '}
                                dulu.
                            </p>
                        )}

                        <div className="flex flex-col gap-3">
                            <div className={FIELD}>
                                <Input
                                    ref={inputRef}
                                    id="invoice-number-format"
                                    label="Pola nomor"
                                    value={data.format}
                                    onChange={(e) => {
                                        setData('format', e.target.value);
                                        form.clearErrors('format');
                                    }}
                                    className="font-mono"
                                    spellCheck={false}
                                    autoComplete="off"
                                    maxLength={100}
                                    error={error}
                                    hint="Ketik teks dan pemisah bebas, lalu sisipkan token di bawah di posisi kursor."
                                />
                            </div>
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Sisipkan token">
                                {tokens.map(({ token, label }) => {
                                    const used = usedTokens.includes(token);
                                    return (
                                        <button
                                            key={token}
                                            type="button"
                                            onClick={() => insertToken(token)}
                                            aria-label={`Sisipkan {${token}}: ${label}`}
                                            className={cn(
                                                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                                                used ? 'border-ob-act-fill/40 bg-ob-act-fill/10' : 'border-ob-line bg-ob-inner hover:bg-ob-hover',
                                            )}
                                        >
                                            <code className="font-mono text-xs font-semibold text-ob-ink">{`{${token}}`}</code>
                                            <span className="text-ob-ink-2">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <SegmentedControl
                            label="Jumlah digit nomor urut"
                            value={String(data.padding)}
                            onChange={(value) => setData('padding', Number(value))}
                            columns={Math.min(paddings.length, 6) as 2 | 3 | 4 | 5 | 6}
                            options={paddings.map((n) => ({ value: String(n), label: n === 1 ? 'Tanpa nol · 1' : `${n} digit · ${'1'.padStart(n, '0')}` }))}
                            hint={`Batas minimum — nomor tetap bertambah melewatinya, mis. ${'9'.repeat(Math.max(data.padding, 1))} → 1${'0'.repeat(Math.max(data.padding, 1))}.`}
                            error={form.errors.padding}
                        />

                        <SegmentedControl<Reset>
                            label="Nomor kembali ke 1"
                            value={data.reset}
                            onChange={(value) => {
                                setData('reset', value);
                                form.clearErrors('format');
                            }}
                            columns={3}
                            options={RESET_OPTIONS}
                            hint={RESET_HINT[data.reset]}
                            error={form.errors.reset}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ob-line-soft pt-6">
                            <p className="flex max-w-[46ch] items-start gap-2 text-[13px] text-ob-ink-2">
                                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                Berlaku untuk invoice yang dikirim setelah disimpan. Nomor tetap bisa diubah manual di dialog Kirim.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className={BTN.ghost}
                                    disabled={isDefault || form.processing}
                                    onClick={() => {
                                        setData({ ...defaults });
                                        form.clearErrors();
                                    }}
                                    icon={<RotateCcw className="h-4 w-4" />}
                                >
                                    Kembalikan default
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    className={BTN.primary}
                                    loading={form.processing}
                                    disabled={!form.isDirty || !!clientError || !hasCompany}
                                >
                                    Simpan
                                </Button>
                            </div>
                        </div>
                    </form>

                    <aside aria-label="Pratinjau nomor" className="order-first flex flex-col gap-5 rounded-3xl border border-ob-line bg-ob-card p-6 lg:sticky lg:top-6 lg:order-none">
                        <div className="flex flex-col gap-3">
                            <h2 className="text-base font-semibold text-ob-ink">Pratinjau</h2>
                            <div className="rounded-2xl border border-ob-line bg-ob-inner p-5">
                                <p className="text-xs text-ob-ink-2">Nomor invoice</p>
                                <p aria-live="polite" className="mt-1 break-all font-mono text-[22px] font-semibold leading-snug text-ob-ink">
                                    {segments.length === 0
                                        ? '—'
                                        : segments.map((segment, i) =>
                                              segment.token ? (
                                                  <span key={i} className="rounded-md bg-ob-act-fill/12 px-0.5 text-ob-act">
                                                      {segment.text}
                                                  </span>
                                              ) : (
                                                  <React.Fragment key={i}>{segment.text}</React.Fragment>
                                              ),
                                          )}
                                </p>
                            </div>
                            {usedTokens.length > 0 && (
                                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                                    {usedTokens.map((token) => (
                                        <React.Fragment key={token}>
                                            <dt className="font-mono text-xs leading-5 text-ob-ink-2">{`{${token}}`}</dt>
                                            <dd className="text-ob-ink">
                                                <span className="font-mono font-semibold">{values[token]}</span>
                                                <span className="text-ob-ink-2"> · {tokenLabel[token]}</span>
                                            </dd>
                                        </React.Fragment>
                                    ))}
                                </dl>
                            )}
                            <p className="text-xs text-ob-ink-2">
                                Contoh untuk {sample.client_name}, terbit {longDate(sample.date)}, nomor urut berikutnya di periode ini.
                            </p>
                        </div>

                        {recent.length > 0 && (
                            <div className="flex flex-col gap-2 border-t border-ob-line-soft pt-5">
                                <h3 className="text-[13px] font-semibold text-ob-ink-2">Nomor terakhir yang terbit</h3>
                                <ul className="flex flex-col gap-1.5">
                                    {recent.map((invoice) => (
                                        <li key={invoice.id} className="flex items-baseline justify-between gap-3">
                                            <span className="min-w-0 truncate font-mono text-[13px] text-ob-ink">{invoice.number}</span>
                                            <span className="shrink-0 text-xs text-ob-ink-3">{longDate(invoice.issue_date)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </aside>
                </div>
            </SettingsLayout>
        </>
    );
}

InvoiceNumberingSettings.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
