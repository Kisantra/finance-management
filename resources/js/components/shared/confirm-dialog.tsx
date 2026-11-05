import * as React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning';
    loading?: boolean;
    onConfirm: () => void;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Hapus',
    cancelLabel = 'Batal',
    variant = 'danger',
    loading = false,
    onConfirm,
}: ConfirmDialogProps) {
    const isDanger = variant === 'danger';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="sm">
                {/* Dialog konfirmasi tanpa isi: garis header/footer bawaan dilepas agar tidak
                    menumpuk jadi garis ganda di antara judul dan tombol. Ruang pil tutup cukup
                    disisihkan di baris judul (pr-10) supaya deskripsi memakai lebar penuh. */}
                <DialogHeader className="border-b-0 pr-6">
                    <div className="flex items-start gap-4">
                        <div
                            className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                                isDanger ? 'bg-ob-late/12 text-ob-late' : 'bg-ob-wait/12 text-ob-wait',
                            )}
                        >
                            {isDanger ? (
                                <Trash2 className="h-5 w-5" />
                            ) : (
                                <AlertTriangle className="h-5 w-5" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="pr-10">{title}</DialogTitle>
                            {/* DialogDescription, bukan <p>: Radix memakainya untuk memasang
                                aria-describedby. Tanpa itu pembaca layar hanya mengumumkan judulnya,
                                sehingga kalimat soal akibat penghapusan tidak pernah terdengar. */}
                            {description && (
                                <DialogDescription className="mt-1">
                                    {description}
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                <DialogFooter className="border-t-0 pt-2">
                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                        <Button
                            variant="zinc"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="w-full sm:w-auto order-2 sm:order-1"
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            variant={isDanger ? 'red' : 'yellow'}
                            onClick={onConfirm}
                            loading={loading}
                            className="w-full sm:w-auto order-1 sm:order-2"
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
