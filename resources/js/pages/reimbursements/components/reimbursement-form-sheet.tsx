import { Send, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/shared/currency-input';
import { FileUpload } from '@/components/shared/file-upload';
import { cn, toastErrors, toLocalIso } from '@/lib/utils';
import { BTN, FIELD, SURFACE } from '@/pages/invoices/components/ob';
import { rbAction } from './rb';

export interface CategoryOption {
    label: string;
    value: string;
}

/** Nilai awal saat mengedit (dari endpoint detail). */
export interface ReimbursementFormInitial {
    id: number;
    title: string;
    description: string | null;
    amount: number;
    expense_date: string | null;
    category_input: string;
    attachment_name: string | null;
    attachment_url: string | null;
    status: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categoryOptions: CategoryOption[];
    /** Null = buat baru. */
    initial: ReimbursementFormInitial | null;
    onSaved: (id: number, action: 'draft' | 'submit') => void;
}

type FormErrors = Partial<Record<'title' | 'description' | 'amount' | 'expense_date' | 'category' | 'attachment' | '_', string>>;

/**
 * Form buat/edit pengajuan. Dikirim lewat fetch multipart (bukan kunjungan Inertia) supaya bisa
 * dibuka dari drawer detail di halaman mana pun tanpa mengganti halaman di belakangnya.
 */
export function ReimbursementFormSheet({ open, onOpenChange, categoryOptions, initial, onSaved }: Props) {
    const isEdit = initial !== null;
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [amount, setAmount] = React.useState(0);
    const [expenseDate, setExpenseDate] = React.useState<Date | null>(new Date());
    const [category, setCategory] = React.useState<string | null>(null);
    const [file, setFile] = React.useState<File | null>(null);
    const [removeExisting, setRemoveExisting] = React.useState(false);
    const [errors, setErrors] = React.useState<FormErrors>({});
    const [busy, setBusy] = React.useState<null | 'draft' | 'submit'>(null);

    React.useEffect(() => {
        if (!open) return;
        setTitle(initial?.title ?? '');
        setDescription(initial?.description ?? '');
        setAmount(initial?.amount ?? 0);
        setExpenseDate(initial?.expense_date ? new Date(initial.expense_date + 'T00:00:00') : new Date());
        setCategory(initial?.category_input ?? null);
        setFile(null);
        setRemoveExisting(false);
        setErrors({});
    }, [open, initial]);

    const clear = (key: keyof FormErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

    const save = async (action: 'draft' | 'submit') => {
        const body = new FormData();
        body.append('title', title);
        body.append('description', description);
        body.append('amount', String(amount));
        body.append('expense_date', expenseDate ? toLocalIso(expenseDate) : '');
        body.append('category', category ?? '');
        body.append('action', action);
        if (file) body.append('attachment', file);
        if (isEdit) {
            body.append('_method', 'PUT');
            if (removeExisting) body.append('remove_attachment', '1');
        }

        setBusy(action);
        const result = await rbAction(isEdit ? `/reimbursements/${initial.id}` : '/reimbursements', 'POST', body).catch(() => null);
        setBusy(null);

        if (!result) {
            toastErrors({ _: 'Periksa koneksi lalu coba lagi.' }, 'Simpan reimbursement');
            return;
        }
        if (!result.ok) {
            setErrors(result.errors);
            toastErrors(result.errors, 'Simpan reimbursement');
            return;
        }
        toast.success(result.message ?? 'Tersimpan');
        onOpenChange(false);
        onSaved(result.id ?? initial?.id ?? 0, action);
    };

    const existingName = isEdit && !removeExisting ? initial.attachment_name : null;
    const resubmit = initial?.status === 'rejected';

    return (
        <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
            <SheetContent hideClose className={cn(SURFACE, 'max-w-[560px] rounded-l-3xl border-l')} onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5">
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="pr-0 text-xl font-semibold text-ob-ink dark:text-ob-ink">{isEdit ? 'Edit pengajuan' : 'Buat pengajuan'}</SheetTitle>
                        <SheetDescription className="mt-1 text-[13px] text-ob-ink-2 dark:text-ob-ink-2">
                            {resubmit
                                ? 'Perbaiki sesuai catatan peninjau, lalu ajukan ulang.'
                                : 'Catat biaya yang Anda bayar lebih dulu untuk keperluan kantor.'}
                        </SheetDescription>
                    </div>
                    <Button variant="outline" className={BTN.icon} onClick={() => onOpenChange(false)} aria-label="Tutup form" disabled={!!busy}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <form
                    id="reimbursement-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save('submit');
                    }}
                    className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6"
                >
                    {/* FIELD menata ulang semua tombol di dalamnya, jadi FileUpload sengaja di luar. */}
                    <div className={cn(FIELD, 'flex flex-col gap-5')}>
                    <Input
                        id="rb-title"
                        label="Judul"
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            clear('title');
                        }}
                        error={errors.title}
                        placeholder="cth. Taksi ke kantor klien"
                        maxLength={255}
                    />
                    <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                        <CurrencyInput
                            label="Nominal"
                            value={amount}
                            onChange={(v) => {
                                setAmount(v);
                                clear('amount');
                            }}
                            error={errors.amount}
                        />
                        <DatePicker
                            label="Tanggal pengeluaran"
                            value={expenseDate}
                            onChange={(d) => {
                                setExpenseDate(d);
                                clear('expense_date');
                            }}
                            error={errors.expense_date}
                            clearable={false}
                        />
                    </div>
                    <Combobox
                        label="Kategori"
                        options={categoryOptions}
                        value={category}
                        onChange={(v) => {
                            setCategory(v ? String(v) : null);
                            clear('category');
                        }}
                        placeholder="Pilih kategori biaya"
                        error={errors.category}
                    />
                    <Textarea
                        id="rb-description"
                        label="Keterangan (opsional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        error={errors.description}
                        placeholder="Untuk apa biaya ini, siapa yang terlibat…"
                        rows={3}
                        maxLength={1000}
                    />
                    </div>
                    <FileUpload
                        label="Bukti / kuitansi (opsional)"
                        hint="JPG, PNG, atau PDF, maksimal 5 MB."
                        value={file}
                        onChange={(f) => {
                            setFile(f);
                            clear('attachment');
                        }}
                        accept={['.jpg', '.jpeg', '.png', '.pdf']}
                        maxSizeMb={5}
                        error={errors.attachment}
                        existingFileName={existingName}
                        existingFileUrl={existingName ? initial?.attachment_url : null}
                        onRemoveExisting={() => setRemoveExisting(true)}
                    />
                </form>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ob-line px-6 py-4">
                    <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)} disabled={!!busy}>
                        Batal
                    </Button>
                    {!resubmit && (
                        <Button type="button" variant="outline" className={BTN.secondary} onClick={() => save('draft')} loading={busy === 'draft'} disabled={!!busy}>
                            Simpan draft
                        </Button>
                    )}
                    <Button type="submit" form="reimbursement-form" className={BTN.primary} loading={busy === 'submit'} disabled={!!busy} icon={<Send className="h-4 w-4" />}>
                        {resubmit ? 'Ajukan ulang' : 'Ajukan'}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
