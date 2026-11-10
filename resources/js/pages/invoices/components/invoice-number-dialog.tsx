import { Send, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { BTN, FIELD, rp, SURFACE } from './ob';

export const DIALOG = cn(SURFACE, 'rounded-3xl p-6');

export function DialogHead({ title, sub, onClose }: { title: string; sub?: React.ReactNode; onClose: () => void }) {
    return (
        <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-ob-ink dark:text-ob-ink">{title}</DialogTitle>
                {sub ? <DialogDescription className="mt-1 text-[13px] leading-relaxed text-ob-ink-2 dark:text-ob-ink-2">{sub}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
            </div>
            <Button variant="outline" className={cn(BTN.icon, 'h-8 w-8 shrink-0')} onClick={onClose} aria-label={t('Tutup')}>
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

/**
 * Nomor invoice sebelum terbit: terisi nomor berikutnya sesuai format Pengaturan › Penomoran
 * invoice dan tetap bisa diubah. Dipakai "Terbitkan invoice" (drawer draft) dan "Simpan & terbitkan"
 * (editor). Pengirimannya diurus pemanggil; galat nomor dari server dikembalikan lewat `error`.
 */
export function InvoiceNumberDialog({
    open,
    onOpenChange,
    title,
    sub,
    confirmLabel,
    suggested,
    loading = false,
    editable = true,
    clientName,
    total,
    submitting,
    error,
    onClearError,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    sub: string;
    confirmLabel: string;
    suggested: string;
    /** Nomor saran masih dihitung server. */
    loading?: boolean;
    /** false = hanya ditampilkan (pengguna tanpa izin `edit invoices` tidak memilih nomor sendiri). */
    editable?: boolean;
    clientName: string;
    total: number;
    submitting: boolean;
    error: string | null;
    onClearError: () => void;
    onConfirm: (number: string) => void;
}) {
    const [number, setNumber] = React.useState(suggested);

    React.useEffect(() => {
        if (open) setNumber(suggested);
    }, [open, suggested]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="md" hideClose className={DIALOG}>
                <DialogHead title={title} sub={sub} onClose={() => onOpenChange(false)} />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        onConfirm(number.trim());
                    }}
                    className="flex flex-col gap-4"
                >
                    <div className={FIELD}>
                        <Input
                            label={t('Nomor invoice')}
                            value={loading ? '' : number}
                            placeholder={loading ? t('Menghitung nomor berikutnya…') : undefined}
                            onChange={(e) => {
                                setNumber(e.target.value);
                                onClearError();
                            }}
                            readOnly={!editable}
                            disabled={loading}
                            className="font-mono"
                            error={error ?? undefined}
                            hint={
                                editable
                                    ? t('Nomor berikutnya sesuai format di Pengaturan › Penomoran invoice. Boleh diubah selama belum dipakai. Bisa dikembalikan ke draft selama ini nomor urut terakhir di periodenya.')
                                    : t('Nomor diberikan otomatis sesuai format di Pengaturan › Penomoran invoice.')
                            }
                            autoFocus={editable}
                        />
                    </div>
                    {error && number !== suggested && suggested && (
                        <button
                            type="button"
                            onClick={() => {
                                setNumber(suggested);
                                onClearError();
                            }}
                            className="-mt-2 self-start text-[13px] font-semibold text-ob-act hover:underline"
                        >
                            {t('Pakai nomor yang disarankan')}
                        </button>
                    )}
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-ob-line bg-ob-inner px-4 py-3 text-sm">
                        <span className="truncate text-ob-ink-2">{clientName}</span>
                        <span className="font-semibold text-ob-ink">{rp(total)}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)}>
                            {t('Batal')}
                        </Button>
                        <Button type="submit" className={BTN.primary} loading={submitting} disabled={loading || !number.trim()} icon={<Send className="h-4 w-4" />}>
                            {confirmLabel}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
