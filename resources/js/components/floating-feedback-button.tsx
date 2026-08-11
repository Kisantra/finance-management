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
import { companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS: SegmentedOption<'bug' | 'feature' | 'feedback'>[] = [
    { value: 'bug', label: 'Bug', icon: <Bug className="w-5 h-5" />, activeClassName: 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400' },
    { value: 'feature', label: 'Fitur', icon: <Lightbulb className="w-5 h-5" />, activeClassName: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400' },
    { value: 'feedback', label: 'Saran', icon: <MessageCircle className="w-5 h-5" />, activeClassName: 'bg-zinc-100 dark:bg-dark-700 border-zinc-400 dark:border-dark-500 text-zinc-700 dark:text-zinc-300' },
];

const PRIORITY_OPTIONS: SegmentedOption<'low' | 'medium' | 'high' | 'critical'>[] = [
    { value: 'low', label: 'Rendah', activeClassName: 'bg-zinc-100 dark:bg-dark-700 border-zinc-300 dark:border-dark-500 text-zinc-700 dark:text-zinc-300' },
    { value: 'medium', label: 'Sedang', activeClassName: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300' },
    { value: 'high', label: 'Tinggi', activeClassName: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-700 dark:text-yellow-300' },
    { value: 'critical', label: 'Kritis', activeClassName: 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300' },
];

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

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<FormData>({
        title: '',
        description: '',
        type: 'feedback',
        priority: 'medium',
        page_url: '',
        attachment: null,
    });

    React.useEffect(() => {
        if (open) {
            setData('page_url', window.location.pathname);
        } else {
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(companyUrl('/feedbacks'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                toast.success('Feedback berhasil dikirim. Terima kasih atas masukannya!');
                setOpen(false);
                reset();
            },
            onError: () => toast.error('Periksa kembali isian form.'),
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className="fixed bottom-6 right-6 z-40 h-12 rounded-full bg-primary-600 text-white shadow-lg hover:shadow-xl hover:bg-primary-700 transition-all flex items-center justify-center pl-3.5 pr-4 gap-2 group"
                title="Kirim Feedback"
                aria-label="Kirim Feedback"
            >
                <MessageSquare className="w-5 h-5 shrink-0" />
                <span
                    className={cn(
                        'overflow-hidden whitespace-nowrap transition-all duration-300 text-sm font-semibold',
                        hovered ? 'max-w-32 opacity-100' : 'max-w-0 opacity-0',
                    )}
                >
                    Feedback
                </span>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent size="lg" className="p-0 overflow-hidden">
                    <form onSubmit={submit}>
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                                    <MessageSquare className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                        Kirim Feedback
                                    </DialogTitle>
                                    <p className="text-sm text-dark-500 dark:text-dark-400">
                                        Laporkan bug, ajukan fitur, atau berikan saran
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
                            <FormSection title="Detail" description="Apa yang ingin Anda sampaikan?">
                                <SegmentedControl
                                    label="Tipe *"
                                    layout="stack"
                                    columns={3}
                                    value={data.type}
                                    onChange={(v) => setData('type', v)}
                                    options={TYPE_OPTIONS}
                                    error={errors.type}
                                />

                                <Input
                                    label="Judul *"
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    error={errors.title}
                                    placeholder="Ringkasan singkat"
                                    autoFocus
                                />

                                <Textarea
                                    label="Deskripsi *"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    error={errors.description}
                                    rows={4}
                                    placeholder="Jelaskan lebih detail..."
                                />

                                <SegmentedControl
                                    label="Prioritas *"
                                    layout="inline"
                                    columns={4}
                                    value={data.priority}
                                    onChange={(v) => setData('priority', v)}
                                    options={PRIORITY_OPTIONS}
                                    error={errors.priority}
                                />
                            </FormSection>

                            <FormSection title="Lampiran (opsional)" description="Screenshot atau dokumen pendukung">
                                <FileUpload
                                    value={data.attachment}
                                    onChange={(file) => setData('attachment', file)}
                                    accept={['.jpg', '.jpeg', '.png', '.pdf']}
                                    maxSizeMb={5}
                                    error={errors.attachment}
                                />
                            </FormSection>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                            <Button type="button" variant="zinc" onClick={() => setOpen(false)} disabled={processing} className="w-full sm:w-auto order-2 sm:order-1">
                                Batal
                            </Button>
                            <Button type="submit" variant="primary" loading={processing} className="w-full sm:w-auto order-1 sm:order-2">
                                <Send className="w-4 h-4" />
                                Kirim Feedback
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
