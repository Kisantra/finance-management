import { Check } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { cn, toastError } from '@/lib/utils';
import type { ClientOption } from '../create';
import { DIALOG, DialogHead } from './invoice-number-dialog';
import { BTN, FIELD } from './ob';

/** Sebutan badan usaha di awal nama (sama dengan yang dilewati InvoiceNumberService::initials()). */
const BADAN_USAHA = /^(pt|cv|ud|tb|pd|firma|yayasan|koperasi|perum|persero)\b/i;

/**
 * Pintasan "Buat klien baru" dari pemilih Klien di editor invoice: cukup nama dan alamat (yang
 * tercetak di invoice). Tipe ditebak dari nama (PT/CV/… = perusahaan), status Aktif; alias, NPWP,
 * PIC, dan data pajak dilengkapi nanti di Master Data › Klien. Disimpan lewat POST /clients yang sama
 * (StoreClientRequest).
 */
export function QuickClientDialog({
    open,
    initialName,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    /** Teks pencarian di pemilih klien, menjadi nama awal. */
    initialName: string;
    onOpenChange: (open: boolean) => void;
    onCreated: (client: ClientOption) => void;
}) {
    const [name, setName] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [errors, setErrors] = React.useState<{ name?: string; address?: string }>({});
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        setName(initialName);
        setAddress('');
        setErrors({});
    }, [open, initialName]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Dialog dirender di luar <form> editor, tetapi event React tetap merambat lewat portal.
        e.stopPropagation();
        setSaving(true);
        setErrors({});
        try {
            const res = await api('/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, address, type: BADAN_USAHA.test(name.trim()) ? 'company' : 'individual', status: 'Active' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const fieldErrors = data.errors ? Object.fromEntries(Object.entries(data.errors as Record<string, string[]>).map(([k, v]) => [k, v[0]])) : {};
                if (fieldErrors.name || fieldErrors.address) setErrors(fieldErrors);
                else toastError(Object.values(fieldErrors)[0] ?? data.message ?? t('Server membalas {{status}}.', { status: res.status }));
                return;
            }
            toast.success(t('Klien {{name}} ditambahkan dan dipilih.', { name: data.client.name }));
            onCreated(data.client as ClientOption);
            onOpenChange(false);
        } catch (err) {
            toastError(err instanceof Error ? err.message : t('Klien gagal disimpan.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="md" hideClose className={DIALOG}>
                <DialogHead
                    title={t('Klien baru')}
                    sub={t('Tersimpan di Master Data › Klien dan langsung dipilih untuk invoice ini.')}
                    onClose={() => onOpenChange(false)}
                />
                <form onSubmit={submit} className={cn(FIELD, 'flex flex-col gap-4')}>
                    <Input
                        label={t('Nama Klien *')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('PT. Nama Perusahaan / Nama Individu')}
                        maxLength={255}
                        autoFocus
                        error={errors.name}
                    />
                    <Textarea label={t('Alamat')} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('Alamat lengkap')} rows={3} error={errors.address} />
                    <p className="text-xs text-ob-ink-3">{t('Alias, NPWP, PIC, dan data pajak lain bisa dilengkapi nanti di Master Data › Klien.')}</p>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className={BTN.ghost} onClick={() => onOpenChange(false)}>
                            {t('Batal')}
                        </Button>
                        <Button type="submit" className={BTN.primary} loading={saving} disabled={!name.trim()} icon={<Check className="h-4 w-4" />}>
                            {t('Simpan klien')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
