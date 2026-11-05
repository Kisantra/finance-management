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

const MODE_BUTTON =
    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-page';
const MODE_ACTIVE = 'bg-ob-invert font-semibold text-ob-invert-ink';
const MODE_IDLE = 'font-medium text-ob-ink-2 hover:text-ob-ink';

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
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-ob-chip text-ob-ink-2">
                            <Plus className="w-4 h-4" />
                        </div>
                        <DialogTitle>Tambah Kategori</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="px-6 py-4 space-y-4">
                    {/* Mode toggle — trek pil Obsidian, sama dengan SegmentedControl variant="pill". */}
                    <div className="flex items-center gap-0.5 rounded-full border border-ob-line bg-ob-rail p-[3px]">
                        <button
                            type="button"
                            onClick={() => switchMode('child')}
                            className={[
                                MODE_BUTTON,
                                mode === 'child' ? MODE_ACTIVE : MODE_IDLE,
                            ].join(' ')}
                        >
                            <Tag className="w-3 h-3 shrink-0" />
                            Sub Kategori
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode('group')}
                            className={[
                                MODE_BUTTON,
                                mode === 'group' ? MODE_ACTIVE : MODE_IDLE,
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
                        <p className="text-xs text-ob-ink-3">
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
