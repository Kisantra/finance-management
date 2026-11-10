import { Head, router, useForm } from '@inertiajs/react';
import { Info, RotateCcw } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppLink } from '@/components/app-link';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { companyUrl } from '@/lib/company';
import { cn, toastErrors } from '@/lib/utils';
import { BTN, FIELD, longDate } from '@/pages/invoices/components/ob';
import { t, tk, Trans } from '@/i18n';

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
    /** Nomor lama tanpa urutan (hasil konversi server lama), dihitung kering dengan pola yang sedang berlaku. */
    legacyReview: {
        fillable: number;
        samples: { number: string; sequence: number }[];
        unmatched: string[];
        unmatchedCount: number;
    } | null;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const RESET_OPTIONS: { value: Reset; label: string }[] = [
    { value: 'monthly', label: tk('Tiap bulan') },
    { value: 'yearly', label: tk('Tiap tahun') },
    { value: 'never', label: tk('Tidak pernah') },
];

const RESET_HINT: Record<Reset, string> = {
    monthly: tk('Invoice pertama tiap bulan kembali ke nomor 1.'),
    yearly: tk('Invoice pertama tiap tahun kembali ke nomor 1.'),
    never: tk('Nomor terus bertambah tanpa kembali ke 1.'),
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
    if (!format.trim()) return t('Pola nomor wajib diisi.');
    const used = [...format.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
    const unknown = used.filter((token) => !known.includes(token));
    if (unknown.length) return t('Token tidak dikenal: {{tokens}}.', { tokens: `{${unknown.join('}, {')}}` });
    if (/[{}]/.test(format.replace(/\{[A-Z0-9_]+\}/g, ''))) return t('Kurung kurawal hanya dipakai untuk token, mis. {NO}.');
    if (format.split('{NO}').length !== 2) return t('Pola wajib berisi {NO} tepat satu kali.');
    const hasYear = format.includes('{THN}') || format.includes('{THN2}');
    const hasMonth = format.includes('{BLN}') || format.includes('{BLN_ROMAWI}');
    if (reset === 'monthly' && !(hasMonth && hasYear)) {
        return t('Nomor kembali ke 1 tiap bulan, jadi pola wajib memuat bulan ({BLN_ROMAWI} atau {BLN}) dan tahun ({THN} atau {THN2}) agar tidak sama dengan nomor bulan lain.');
    }
    if (reset === 'yearly' && !hasYear) {
        return t('Nomor kembali ke 1 tiap tahun, jadi pola wajib memuat tahun ({THN} atau {THN2}) agar tidak sama dengan nomor tahun lain.');
    }
    return null;
}

export default function InvoiceNumberingSettings({ settings, defaults, tokens, paddings, hasCompany, sample, recent, legacyReview }: Props) {
    const form = useForm<NumberingSettings>(settings);
    const [reviewing, setReviewing] = React.useState(false);

    const finishReview = () => {
        setReviewing(true);
        router.post(companyUrl('/settings/invoice-numbering/review'), {}, { onFinish: () => setReviewing(false) });
    };
    const { data, setData } = form;
    const inputRef = React.useRef<HTMLInputElement>(null);

    const knownTokens = tokens.map((item) => item.token);
    const tokenLabel = Object.fromEntries(tokens.map((item) => [item.token, item.label]));
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
        form.put(companyUrl('/settings/invoice-numbering'), {
            preserveScroll: true,
            onSuccess: () => {
                form.setDefaults();
                toast.success(t('Format penomoran disimpan. Berlaku untuk invoice yang diterbitkan setelah ini.'));
            },
            onError: (errors) => toastErrors(errors, t('Penomoran invoice')),
        });
    };

    return (
        <>
            <Head title={t('Penomoran Invoice')} />

            <SettingsLayout
                bare
                title={t('Penomoran invoice')}
                description={t('Atur bentuk nomor yang diberikan saat invoice diterbitkan. Nomor yang sudah terbit tidak ikut berubah.')}
            >
                {legacyReview && (
                    <section
                        role="alert"
                        className="mb-5 flex flex-col gap-4 rounded-3xl border border-ob-wait/40 bg-ob-wait/10 p-6 text-ob-ink sm:p-8"
                    >
                        <div className="flex flex-col gap-1.5">
                            <h2 className="text-base font-semibold">{t('Tinjau nomor invoice lama sebelum melanjutkan')}</h2>
                            <p className="text-[13px] text-ob-ink-2">
                                <Trans
                                    i18nKey="Invoice lama belum punya urutan nomor. Tanpa urutan, invoice berikutnya bisa mengulang nomor yang sudah terbit. Dengan pola di bawah: <b>{{fillable}}</b> nomor cocok dan akan diisi urutannya, <b>{{unmatched}}</b> tidak cocok dan dibiarkan kosong."
                                    values={{ fillable: legacyReview.fillable, unmatched: legacyReview.unmatchedCount }}
                                    components={{ b: <strong /> }}
                                />
                            </p>
                        </div>
                        {legacyReview.samples.length > 0 && (
                            <ul className="flex flex-col gap-1 text-[13px]">
                                {legacyReview.samples.map((s) => (
                                    <li key={s.number}>
                                        <Trans
                                            i18nKey="<kode>{{number}}</kode> → urutan {{sequence}}"
                                            values={{ number: s.number, sequence: s.sequence }}
                                            components={{ kode: <span className="font-mono" /> }}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                        {legacyReview.unmatchedCount > 0 && (
                            <div className="text-[13px]">
                                <p className="font-semibold">{t('Tidak cocok dengan pola:')}</p>
                                <p className="mt-1 font-mono text-ob-ink-2">
                                    {legacyReview.unmatched.join(', ')}
                                    {legacyReview.unmatchedCount > legacyReview.unmatched.length &&
                                        ` ${t('dan {{count}} lainnya', { count: legacyReview.unmatchedCount - legacyReview.unmatched.length })}`}
                                </p>
                                <p className="mt-2 text-ob-ink-2">
                                    <Trans
                                        i18nKey="Pola di bawah menentukan nomor invoice <b>berikutnya</b>. Ubah hanya bila nomor di atas memakai format yang memang ingin dilanjutkan, lalu Simpan; daftar ini ikut diperbarui. Nomor berformat lama yang sudah tidak dipakai, atau yang diketik manual, biarkan saja: nomornya tetap sah dan tidak akan terulang."
                                        components={{ b: <strong /> }}
                                    />
                                </p>
                            </div>
                        )}
                        <div>
                            <Button
                                type="button"
                                variant="primary"
                                className={BTN.primary}
                                loading={reviewing}
                                onClick={finishReview}
                                disabled={form.isDirty}
                            >
                                {t('Isi urutan & selesai meninjau')}
                            </Button>
                            {form.isDirty && <p className="mt-2 text-xs text-ob-ink-2">{t('Simpan pola dulu sebelum menyelesaikan peninjauan.')}</p>}
                        </div>
                    </section>
                )}

                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <form onSubmit={submit} className="flex flex-col gap-7 rounded-3xl border border-ob-line bg-ob-card p-6 sm:p-8">
                        {!hasCompany && (
                            <p className="rounded-2xl border border-ob-wait/40 bg-ob-wait/10 px-4 py-3 text-[13px] text-ob-ink">
                                <Trans
                                    i18nKey="Profil perusahaan belum diisi. Pengaturan penomoran disimpan di profil perusahaan, <tautan>isi profil perusahaan</tautan> dulu."
                                    components={{ tautan: <AppLink href="/settings/company" className="font-semibold text-ob-act hover:underline" /> }}
                                />
                            </p>
                        )}

                        <div className="flex flex-col gap-3">
                            <div className={FIELD}>
                                <Input
                                    ref={inputRef}
                                    id="invoice-number-format"
                                    label={t('Pola nomor')}
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
                                    hint={t('Ketik teks dan pemisah bebas, lalu sisipkan token di bawah di posisi kursor.')}
                                />
                            </div>
                            <div className="flex flex-wrap gap-2" role="group" aria-label={t('Sisipkan token')}>
                                {tokens.map(({ token, label }) => {
                                    const used = usedTokens.includes(token);
                                    return (
                                        <button
                                            key={token}
                                            type="button"
                                            onClick={() => insertToken(token)}
                                            aria-label={t('Sisipkan {{token}}: {{label}}', { token: `{${token}}`, label })}
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
                            label={t('Jumlah digit nomor urut')}
                            value={String(data.padding)}
                            onChange={(value) => setData('padding', Number(value))}
                            columns={Math.min(paddings.length, 6) as 2 | 3 | 4 | 5 | 6}
                            options={paddings.map((n) => ({ value: String(n), label: n === 1 ? t('Tanpa nol · 1') : t('{{count}} digit · {{example}}', { count: n, example: '1'.padStart(n, '0') }) }))}
                            hint={t('Batas minimum — nomor tetap bertambah melewatinya, mis. {{from}} → {{to}}.', { from: '9'.repeat(Math.max(data.padding, 1)), to: `1${'0'.repeat(Math.max(data.padding, 1))}` })}
                            error={form.errors.padding}
                        />

                        <SegmentedControl<Reset>
                            label={t('Nomor kembali ke 1')}
                            value={data.reset}
                            onChange={(value) => {
                                setData('reset', value);
                                form.clearErrors('format');
                            }}
                            columns={3}
                            options={RESET_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
                            hint={t(RESET_HINT[data.reset])}
                            error={form.errors.reset}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ob-line-soft pt-6">
                            <p className="flex max-w-[46ch] items-start gap-2 text-[13px] text-ob-ink-2">
                                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                {t('Berlaku untuk invoice yang diterbitkan setelah disimpan. Nomor tetap bisa diubah manual di dialog Terbitkan.')}
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
                                    {t('Kembalikan bawaan')}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    className={BTN.primary}
                                    loading={form.processing}
                                    disabled={!form.isDirty || !!clientError || !hasCompany}
                                >
                                    {t('Simpan')}
                                </Button>
                            </div>
                        </div>
                    </form>

                    <aside aria-label={t('Pratinjau nomor')} className="order-first flex flex-col gap-5 rounded-3xl border border-ob-line bg-ob-card p-6 lg:sticky lg:top-6 lg:order-none">
                        <div className="flex flex-col gap-3">
                            <h2 className="text-base font-semibold text-ob-ink">{t('Pratinjau')}</h2>
                            <div className="rounded-2xl border border-ob-line bg-ob-inner p-5">
                                <p className="text-xs text-ob-ink-2">{t('Nomor invoice')}</p>
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
                                {t('Contoh untuk {{client}}, terbit {{date}}, nomor urut berikutnya di periode ini.', { client: sample.client_name, date: longDate(sample.date) })}
                            </p>
                        </div>

                        {recent.length > 0 && (
                            <div className="flex flex-col gap-2 border-t border-ob-line-soft pt-5">
                                <h3 className="text-[13px] font-semibold text-ob-ink-2">{t('Nomor terakhir yang terbit')}</h3>
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
