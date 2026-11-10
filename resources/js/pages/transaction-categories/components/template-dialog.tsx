import { router, usePage } from '@inertiajs/react';
import { CircleCheck, CircleSlash, Plus, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { StatsCard } from '@/components/shared/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { companyUrl } from '@/lib/company';
import { cn, toastErrors } from '@/lib/utils';
import type { SharedProps } from '@/types';
import { plGroupLabel } from './pl-groups';
import { t, tk, Trans } from '@/i18n';

/* ─────────────────────────────────── types (CategoryTemplateService::plan) ─── */

type TemplateStatus = 'new' | 'existing' | 'skipped';

interface TemplateChild {
    label: string;
    status: TemplateStatus;
    reason: string | null;
    existing_parent_id: number | null;
    existing_parent_label: string | null;
    existing_pl_group: string | null;
}

interface TemplateGroup {
    type: 'income' | 'expense' | 'financing';
    label: string;
    /** null untuk Pendanaan: tidak masuk Laba Rugi. */
    pl_group: string | null;
    status: TemplateStatus;
    reason: string | null;
    category_id: number | null;
    existing_label: string | null;
    children: TemplateChild[];
}

export interface TemplatePreview {
    groups: TemplateGroup[];
    summary: Record<TemplateStatus, number>;
}

const STATUS: Record<TemplateStatus, { label: string; variant: 'blue' | 'zinc' | 'yellow' }> = {
    new: { label: tk('Baru'), variant: 'blue' },
    existing: { label: tk('Sudah ada'), variant: 'zinc' },
    skipped: { label: tk('Dilewati'), variant: 'yellow' },
};

const SECTIONS = [
    { type: 'income', title: tk('Pemasukan') },
    { type: 'expense', title: tk('Pengeluaran') },
    { type: 'financing', title: tk('Pendanaan') },
] as const;

/** Kolom "Baris Laba Rugi" untuk grup Pendanaan. */
const TANPA_LABA_RUGI = tk('Tidak masuk Laba Rugi');

/* ─────────────────────────────────── rows ─── */

interface RowProps {
    label: string;
    /** Baris Laba Rugi yang dituju; null = tidak ada (dilewati). */
    pl: string | null;
    status: TemplateStatus;
    note?: React.ReactNode;
    parent?: boolean;
}

/** Satu baris pratinjau: nama, baris Laba Rugi tujuan, status. Di ponsel baris L/R turun ke bawah nama. */
function PreviewRow({ label, pl, status, note, parent = false }: RowProps) {
    return (
        <div className={cn('flex items-start gap-3', parent ? 'px-4 py-3' : 'py-2 pl-8 pr-4')}>
            <div className="min-w-0 flex-1">
                <p className={cn('wrap-break-word text-sm text-ob-ink', parent && 'font-semibold')}>{label}</p>
                {pl && <p className="mt-0.5 text-xs text-ob-ink-2 sm:hidden">{t('Laba Rugi: {{name}}', { name: pl })}</p>}
                {note && <div className="mt-0.5 wrap-break-word text-xs leading-relaxed text-ob-ink-3">{note}</div>}
            </div>
            <span className="hidden w-36 shrink-0 pt-0.5 text-xs text-ob-ink-2 sm:block">
                <span className="sr-only">{t('Baris Laba Rugi:')} </span>
                {pl ?? '—'}
            </span>
            <span className="flex w-21 shrink-0 justify-end">
                <Badge variant={STATUS[status].variant}>{t(STATUS[status].label)}</Badge>
            </span>
        </div>
    );
}

function GroupCard({ group }: { group: TemplateGroup }) {
    const skipped = group.status === 'skipped';
    const reused = group.status === 'existing' && group.existing_label !== null && group.existing_label !== group.label;
    // Pendanaan tidak punya baris Laba Rugi (pl_group null) — tulis itu, bukan "Belum diklasifikasi".
    const pendanaan = group.type === 'financing';
    const plLabel = (plGroup: string | null) => (pendanaan ? t(TANPA_LABA_RUGI) : plGroupLabel(plGroup));

    return (
        <div className="overflow-hidden rounded-2xl border border-ob-line">
            <div className="bg-ob-inner">
                <PreviewRow
                    parent
                    label={group.label}
                    pl={skipped ? null : plLabel(group.pl_group)}
                    status={group.status}
                    note={
                        group.reason ? (
                            <span className="text-ob-wait">{group.reason}</span>
                        ) : reused ? (
                            t('Sub baru ditempel ke kategori induk lama “{{name}}”.', { name: group.existing_label })
                        ) : null
                    }
                />
            </div>
            <ul className="divide-y divide-ob-line-soft border-t border-ob-line">
                {group.children.map((child) => (
                    <li key={child.label}>
                        <PreviewRow
                            label={child.label}
                            pl={
                                child.status === 'existing'
                                    ? plLabel(child.existing_pl_group)
                                    : child.status === 'new'
                                      ? plLabel(group.pl_group)
                                      : null
                            }
                            status={child.status}
                            note={
                                // Catatan hanya bila sub itu tinggal di grup lain; di grupnya sendiri cukup badge.
                                child.status === 'existing' && child.existing_parent_id !== group.category_id ? (
                                    t('Sudah ada di grup “{{name}}”, tidak diubah.', { name: child.existing_parent_label })
                                ) : child.reason ? (
                                    <span className="text-ob-wait">{child.reason}</span>
                                ) : null
                            }
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}

function PreviewSkeleton() {
    return (
        <div className="space-y-4" aria-busy="true" aria-label={t('Memuat pratinjau template')}>
            <div className="grid gap-2 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-18.5 rounded-2xl" />
                ))}
            </div>
            {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-ob-line p-4">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-3/5" />
                </div>
            ))}
        </div>
    );
}

function PreviewNotice({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
    return (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-ob-late/35 bg-ob-inner p-6 text-center">
            <TriangleAlert className="h-5 w-5 text-ob-late" aria-hidden />
            <p className="text-sm font-semibold text-ob-ink">{title}</p>
            <p className="max-w-[46ch] text-xs leading-relaxed text-ob-ink-2">{text}</p>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
                    {t('Coba lagi')}
                </Button>
            )}
        </div>
    );
}

/* ─────────────────────────────────── dialog ─── */

type LoadState = 'loading' | 'ready' | 'error';

interface TemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Dialog "Pakai Template": pratinjau dimuat setiap kali dialog dibuka (prop Inertia opsional
 * `templatePreview`, partial reload) supaya statusnya selalu sesuai data terkini. Tombol Buat
 * mengirim POST tanpa daftar; server menghitung ulang rencananya sendiri.
 */
export function TemplateDialog({ open, onOpenChange }: TemplateDialogProps) {
    const preview = usePage<SharedProps & { templatePreview?: TemplatePreview | null }>().props.templatePreview;
    const [state, setState] = React.useState<LoadState>('loading');
    const [applying, setApplying] = React.useState(false);

    const load = React.useCallback(() => {
        setState('loading');
        let loaded = false;
        router.reload({
            only: ['templatePreview'],
            onSuccess: () => {
                loaded = true;
                setState('ready');
            },
            // false = tangani di sini; jangan pindah ke halaman error di luar dialog.
            onHttpException: () => false,
            onNetworkError: () => false,
            onFinish: () => {
                if (!loaded) setState('error');
            },
        });
    }, []);

    React.useEffect(() => {
        if (open) load();
    }, [open, load]);

    const total = preview ? preview.summary.new + preview.summary.existing + preview.summary.skipped : 0;
    const toCreate = state === 'ready' && preview ? preview.summary.new : 0;

    function apply() {
        router.post(
            companyUrl('/transaction-categories/template'),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setApplying(true),
                onSuccess: (page) => {
                    const flash = page.props.flash as SharedProps['flash'] | undefined;
                    toast.success(flash?.success ?? t('Template kategori diterapkan.'));
                    onOpenChange(false);
                },
                onError: (errs) => toastErrors(errs, 'ApplyCategoryTemplate'),
                onFinish: () => setApplying(false),
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !applying && onOpenChange(o)}>
            <DialogContent size="2xl" className="flex h-[min(90vh,760px)] flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                    <DialogTitle>{t('Pakai Template Kategori')}</DialogTitle>
                    <DialogDescription>
                        {t('Kategori pemasukan, pengeluaran, dan pendanaan siap pakai, tersusun mengikuti urutan bagan akun: pendapatan lebih dulu, lalu harga pokok dan beban, terakhir pendanaan. Pemasukan dan pengeluaran sudah punya baris Laba Rugi; pendanaan tidak masuk Laba Rugi.')}
                    </DialogDescription>
                </DialogHeader>

                {/* Radix membungkus isi viewport dengan display:table, yang membuat teks panjang melebarkan
                    isi alih-alih turun baris; dipaksa block agar layar sempit tidak meluap ke samping. */}
                <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:block!">
                    <div className="space-y-5 px-6 py-5">
                        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ob-ink-2">
                            <li>{t('Kategori yang namanya sudah ada dilewati. Huruf besar/kecil dan spasi berlebih tidak dibedakan, tetapi nama yang hanya mirip dianggap berbeda.')}</li>
                            <li>{t('Kategori lama tidak diubah: nama, tipe, grup Laba Rugi, dan induknya tetap.')}</li>
                            <li>
                                <Trans
                                    i18nKey="<b>(Tanpa Invoice)</b>: pendapatan dan HPP penjualan lewat invoice sudah dihitung otomatis di Laba Rugi. Kategori ini hanya untuk yang tidak memakai invoice, jangan catat ulang penjualan ber-invoice."
                                    components={{ b: <span className="font-semibold text-ob-ink" /> }}
                                />
                            </li>
                            <li>
                                <Trans
                                    i18nKey="<b>Pendanaan</b> (setoran modal, prive, setor PPN, setor titipan pajak klien) mengubah saldo rekening tetapi tidak masuk Laba Rugi. Kategorinya bisa dipilih di Catat Pemasukan dan Catat Pengeluaran."
                                    components={{ b: <span className="font-semibold text-ob-ink" /> }}
                                />
                            </li>
                        </ul>

                        {state === 'loading' && <PreviewSkeleton />}

                        {state === 'error' && (
                            <PreviewNotice
                                title={t('Pratinjau template gagal dimuat')}
                                text={t('Belum ada kategori yang dibuat. Periksa koneksi, lalu coba lagi.')}
                                onRetry={load}
                            />
                        )}

                        {state === 'ready' && !preview && (
                            <PreviewNotice
                                title={t('Pratinjau tidak tersedia')}
                                text={t('Hanya pengguna yang boleh mengelola kategori yang dapat memakai template.')}
                            />
                        )}

                        {state === 'ready' && preview && (
                            <>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <StatsCard inModal label={t('Baru')} value={preview.summary.new} icon={<Plus />} color="blue" />
                                    <StatsCard inModal label={t('Sudah ada')} value={preview.summary.existing} icon={<CircleCheck />} color="purple" />
                                    <StatsCard
                                        inModal
                                        label={t('Dilewati')}
                                        value={preview.summary.skipped}
                                        icon={<CircleSlash />}
                                        color={preview.summary.skipped > 0 ? 'yellow' : 'purple'}
                                    />
                                </div>

                                {toCreate === 0 && (
                                    <p className="rounded-2xl bg-ob-inner px-4 py-3 text-[13px] text-ob-ink-2">
                                        {t('Semua {{count}} kategori template sudah ada atau dilewati. Tidak ada yang perlu dibuat.', { count: total })}
                                    </p>
                                )}

                                {SECTIONS.map(({ type, title }) => (
                                    <section key={type} aria-labelledby={`template-${type}`} className="space-y-2">
                                        {/* px-[17px] = tepi 1 px + px-4 baris, agar judul kolom sejajar dengan isinya. */}
                                        <div className="flex items-end gap-3 px-[17px]">
                                            <h3 id={`template-${type}`} className="min-w-0 flex-1 text-sm font-semibold text-ob-ink">
                                                {t(title)}
                                            </h3>
                                            <span className="hidden w-36 shrink-0 text-xs text-ob-ink-3 sm:block">{t('Baris Laba Rugi')}</span>
                                            <span className="hidden w-21 shrink-0 text-right text-xs text-ob-ink-3 sm:block">{t('Status')}</span>
                                        </div>
                                        <div className="space-y-3">
                                            {preview.groups
                                                .filter((group) => group.type === type)
                                                .map((group) => (
                                                    <GroupCard key={group.label} group={group} />
                                                ))}
                                        </div>
                                    </section>
                                ))}
                            </>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="shrink-0">
                    <Button variant="zinc" onClick={() => onOpenChange(false)} disabled={applying} className="w-full sm:w-auto">
                        {t('Batal')}
                    </Button>
                    <Button variant="primary" onClick={apply} loading={applying} disabled={toCreate === 0} className="w-full sm:w-auto">
                        {state !== 'ready' ? t('Buat kategori') : toCreate > 0 ? t('Buat {{count}} kategori', { count: toCreate }) : t('Tidak ada kategori baru')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
