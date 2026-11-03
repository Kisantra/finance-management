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
                <DialogHeader>
                    <div className="flex items-center gap-4 py-2">
                        <div
                            className={cn(
                                'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
                                isDanger
                                    ? 'bg-red-50 dark:bg-red-900/20'
                                    : 'bg-yellow-50 dark:bg-yellow-900/20',
                            )}
                        >
                            {isDanger ? (
                                <Trash2
                                    className={cn(
                                        'w-6 h-6',
                                        isDanger
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-yellow-600 dark:text-yellow-400',
                                    )}
                                />
                            ) : (
                                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                            )}
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                {title}
                            </DialogTitle>
                            {/* DialogDescription, bukan <p>: Radix memakainya untuk memasang
                                aria-describedby. Tanpa itu pembaca layar hanya mengumumkan judulnya,
                                sehingga kalimat soal akibat penghapusan tidak pernah terdengar. */}
                            {description && (
                                <DialogDescription className="text-sm text-dark-600 dark:text-dark-400 mt-0.5">
                                    {description}
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                <DialogFooter>
                    <div className="flex flex-col sm:flex-row justify-end gap-3">
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
