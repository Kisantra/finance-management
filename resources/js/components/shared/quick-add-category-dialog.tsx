import { FolderOpen, Plus, Tag } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { companyUrl } from '@/lib/company';

export interface QuickAddCategoryResult {
    id: number;
    label: string;
    parentId: number | null;
    formattedLabel: string;
    isGroup: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: 'income' | 'expense';
    parentOptions: Array<{ value: number; label: string }>;
    onAdded: (result: QuickAddCategoryResult) => void;
}

type Mode = 'child' | 'group';

export function QuickAddCategoryDialog({ open, onOpenChange, type, parentOptions, onAdded }: Props) {
    const [mode, setMode] = React.useState<Mode>('child');
    const [label, setLabel] = React.useState('');
    const [parentId, setParentId] = React.useState<number | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [errors, setErrors] = React.useState<{ label?: string; parent_id?: string }>({});

    React.useEffect(() => {
        if (!open) {
            setMode('child');
            setLabel('');
            setParentId(null);
            setErrors({});
        }
    }, [open]);

    const switchMode = (next: Mode) => {
        setMode(next);
        setErrors({});
    };

    const handleSave = async () => {
        const newErrors: { label?: string; parent_id?: string } = {};
        if (!label.trim()) newErrors.label = 'Nama kategori wajib diisi';
        if (mode === 'child' && !parentId) newErrors.parent_id = 'Pilih kelompok kategori';
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

        setSaving(true);
        setErrors({});
        try {
            const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
            const body: Record<string, unknown> = { label: label.trim(), type };
            if (mode === 'child') body.parent_id = parentId;

            const res = await fetch(companyUrl('/transaction-categories'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrf,
                },
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrors({
                    label: json?.errors?.label?.[0],
                    parent_id: json?.errors?.parent_id?.[0],
                });
                return;
            }
            const newParentId = (json.parent_id as number | null) ?? null;
            const isGroup = !newParentId;
            onAdded({
                id: json.id as number,
                label: json.label as string,
                parentId: newParentId,
                formattedLabel: isGroup ? (json.label as string) : `↳ ${json.label as string}`,
                isGroup,
            });
        } catch {
            setErrors({ label: 'Terjadi kesalahan jaringan' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="sm">
                <DialogHeader>
                    <div className="flex items-center gap-3 py-1">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary-50 dark:bg-primary-900/20">
                            <Plus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <DialogTitle className="text-base font-semibold text-dark-900 dark:text-dark-50">
                            Tambah Kategori
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="px-6 py-4 space-y-4">
                    {/* Mode toggle */}
                    <div className="flex items-center gap-1 p-1 bg-secondary-100 dark:bg-dark-800 rounded-xl">
                        <button
                            type="button"
                            onClick={() => switchMode('child')}
                            className={[
                                'flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                                mode === 'child'
                                    ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-50 shadow-sm border border-secondary-200 dark:border-dark-600'
                                    : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200',
                            ].join(' ')}
                        >
                            <Tag className="w-3 h-3 shrink-0" />
                            Sub Kategori
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode('group')}
                            className={[
                                'flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                                mode === 'group'
                                    ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-50 shadow-sm border border-secondary-200 dark:border-dark-600'
                                    : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200',
                            ].join(' ')}
                        >
                            <FolderOpen className="w-3 h-3 shrink-0" />
                            Kelompok
                        </button>
                    </div>

                    {mode === 'child' && (
                        <Combobox
                            label="Kelompok Kategori *"
                            options={parentOptions}
                            value={parentId ?? undefined}
                            onChange={(v) => setParentId(v ? Number(v) : null)}
                            placeholder="Pilih kelompok"
                            error={errors.parent_id}
                            emptyText="Belum ada kelompok. Buat kelompok dulu."
                        />
                    )}

                    {mode === 'group' && (
                        <p className="text-xs text-dark-400 dark:text-dark-500">
                            Kelompok digunakan untuk mengelompokkan sub kategori — tidak bisa dipilih langsung saat mencatat transaksi.
                        </p>
                    )}

                    <Input
                        label={mode === 'child' ? 'Nama Kategori *' : 'Nama Kelompok *'}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSave(); } }}
                        placeholder={
                            mode === 'child'
                                ? (type === 'income' ? 'Contoh: Pendapatan Jasa' : 'Contoh: Biaya Operasional')
                                : (type === 'income' ? 'Contoh: Pendapatan' : 'Contoh: Biaya')
                        }
                        error={errors.label}
                        autoFocus
                    />
                </div>

                <DialogFooter>
                    <Button type="button" variant="zinc" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                        Batal
                    </Button>
                    <Button type="button" variant="primary" size="sm" disabled={saving} onClick={() => void handleSave()}>
                        {saving ? 'Menyimpan…' : 'Tambah'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
