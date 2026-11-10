import { useForm } from '@inertiajs/react';
import { Bug, Lightbulb, MessageCircle, MessageSquare, Send } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/shared/file-upload';
import { FormSection } from '@/components/shared/form-section';
import { t, tk } from '@/i18n';
import { companyUrl } from '@/lib/company';
import { currentPageUrl, watchpostTrail } from '@/lib/watchpost';
import { cn } from '@/lib/utils';

/*
 * Warna pilihan aktif = nada chip Obsidian, dipetakan sama seperti Badge di halaman Feedback
 * (merah → ob-late, biru → ob-act, kuning → ob-wait, zinc → chip netral). Tepi ikut nada agar
 * tetap terbaca bila SegmentedControl memakai bentuk kartu bertepi.
 */
const TONE_ACTIVE = {
    late: 'border-ob-late/40 bg-ob-late/12 font-semibold text-ob-late',
    act: 'border-ob-act/40 bg-ob-act/12 font-semibold text-ob-act',
    wait: 'border-ob-wait/40 bg-ob-wait/12 font-semibold text-ob-wait',
    neutral: 'border-ob-line-strong bg-ob-chip font-semibold text-ob-ink',
};

/* Label = kunci terjemahan (tk), diterjemahkan saat render lewat terjemahkanOpsi(); value = kode yang disimpan. */
const TYPE_OPTIONS: SegmentedOption<'bug' | 'feature' | 'feedback'>[] = [
    { value: 'bug', label: tk('Bug'), icon: <Bug className="w-5 h-5" />, activeClassName: TONE_ACTIVE.late },
    { value: 'feature', label: tk('Fitur'), icon: <Lightbulb className="w-5 h-5" />, activeClassName: TONE_ACTIVE.act },
    { value: 'feedback', label: tk('Saran'), icon: <MessageCircle className="w-5 h-5" />, activeClassName: TONE_ACTIVE.neutral },
];

const PRIORITY_OPTIONS: SegmentedOption<'low' | 'medium' | 'high' | 'critical'>[] = [
    { value: 'low', label: tk('Rendah'), activeClassName: TONE_ACTIVE.neutral },
    { value: 'medium', label: tk('Sedang'), activeClassName: TONE_ACTIVE.act },
    { value: 'high', label: tk('Tinggi'), activeClassName: TONE_ACTIVE.wait },
    { value: 'critical', label: tk('Kritis'), activeClassName: TONE_ACTIVE.late },
];

const terjemahkanOpsi = <T extends string>(opsi: SegmentedOption<T>[]): SegmentedOption<T>[] =>
    opsi.map((o) => ({ ...o, label: t(o.label) }));

interface FormData {
    title: string;
    description: string;
    type: 'bug' | 'feature' | 'feedback';
    priority: 'low' | 'medium' | 'high' | 'critical';
    page_url: string;
    attachment: File | null;
}

export function FloatingFeedbackButton() {
    const [open, setOpen] = React.useState(false);
    const [hovered, setHovered] = React.useState(false);

    const { data, setData, post, transform, processing, errors, reset, clearErrors } = useForm<FormData>({
        title: '',
        description: '',
        type: 'feedback',
        priority: 'medium',
        page_url: '',
        attachment: null,
    });

    React.useEffect(() => {
        if (open) {
            setData('page_url', currentPageUrl());
        } else {
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        // Jejak dibaca saat dikirim, supaya langkah sebelum dialog dibuka ikut tercatat.
        transform((current) => ({ ...current, breadcrumbs: watchpostTrail() }));
        post(companyUrl('/feedbacks'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                toast.success(t('Masukan berhasil dikirim. Terima kasih!'));
                setOpen(false);
                reset();
            },
            onError: () => toast.error(t('Periksa kembali isian form.')),
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className="fixed bottom-6 right-6 z-40 h-12 rounded-full bg-ob-act-fill text-white shadow-xl shadow-black/20 hover:bg-ob-act-fill/90 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page flex items-center justify-center pl-3.5 pr-4 gap-2 group"
                title={t('Kirim Masukan')}
                aria-label={t('Kirim Masukan')}
            >
                <MessageSquare className="w-5 h-5 shrink-0" />
                <span
                    className={cn(
                        'overflow-hidden whitespace-nowrap transition-all duration-200 ease-out motion-reduce:transition-none text-sm font-semibold',
                        hovered ? 'max-w-32 opacity-100' : 'max-w-0 opacity-0',
                    )}
                >
                    {t('Masukan')}
                </span>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent size="lg" className="p-0 overflow-hidden">
                    <form onSubmit={submit}>
                        <DialogHeader>
                            <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-lg bg-ob-chip text-ob-ink-2 flex items-center justify-center shrink-0">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <DialogTitle>
                                        {t('Kirim Masukan')}
                                    </DialogTitle>
                                    <p className="text-sm text-ob-ink-2">
                                        {t('Laporkan bug, ajukan fitur, atau berikan saran')}
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
                            <FormSection title={t('Detail')} description={t('Apa yang ingin Anda sampaikan?')}>
                                <SegmentedControl
                                    label={t('Tipe *')}
                                    layout="stack"
                                    columns={3}
                                    value={data.type}
                                    onChange={(v) => setData('type', v)}
                                    options={terjemahkanOpsi(TYPE_OPTIONS)}
                                    error={errors.type}
                                />

                                <Input
                                    label={t('Judul *')}
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    error={errors.title}
                                    placeholder={t('Ringkasan singkat')}
                                    autoFocus
                                />

                                <Textarea
                                    label={t('Deskripsi *')}
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    error={errors.description}
                                    rows={4}
                                    placeholder={t('Jelaskan lebih detail...')}
                                />

                                <SegmentedControl
                                    label={t('Prioritas *')}
                                    layout="inline"
                                    columns={4}
                                    value={data.priority}
                                    onChange={(v) => setData('priority', v)}
                                    options={terjemahkanOpsi(PRIORITY_OPTIONS)}
                                    error={errors.priority}
                                />
                            </FormSection>

                            <FormSection title={t('Lampiran (opsional)')} description={t('Tangkapan layar atau dokumen pendukung')}>
                                <FileUpload
                                    value={data.attachment}
                                    onChange={(file) => setData('attachment', file)}
                                    accept={['.jpg', '.jpeg', '.png', '.pdf']}
                                    maxSizeMb={5}
                                    error={errors.attachment}
                                />
                            </FormSection>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="zinc" onClick={() => setOpen(false)} disabled={processing} className="w-full sm:w-auto order-2 sm:order-1">
                                {t('Batal')}
                            </Button>
                            <Button type="submit" variant="primary" loading={processing} className="w-full sm:w-auto order-1 sm:order-2">
                                <Send className="w-4 h-4" />
                                {t('Kirim Masukan')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
