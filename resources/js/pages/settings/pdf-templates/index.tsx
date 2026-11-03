import { Head, router, usePage } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import {
    CheckCircle2,
    Copy,
    Edit2,
    FileText,
    MoreHorizontal,
    Plus,
    Star,
    StarOff,
    Trash2,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { companyUrl } from '@/lib/company';
import type { SharedProps } from '@/types';

interface PdfTemplate {
    id: number;
    name: string;
    description: string | null;
    is_default: boolean;
    updated_at: string | null;
}

interface Props extends SharedProps {
    templates: PdfTemplate[];
}

export default function PdfTemplatesIndex() {
    const { templates } = usePage<Props>().props;

    // Create dialog
    const [createOpen, setCreateOpen] = React.useState(false);
    const [createName, setCreateName] = React.useState('');
    const [createDescription, setCreateDescription] = React.useState('');
    const [creating, setCreating] = React.useState(false);

    // Rename dialog
    const [renameTemplate, setRenameTemplate] = React.useState<PdfTemplate | null>(null);
    const [renameName, setRenameName] = React.useState('');
    const [renameDescription, setRenameDescription] = React.useState('');
    const [renaming, setRenaming] = React.useState(false);

    // Delete confirm
    const [deleteTemplate, setDeleteTemplate] = React.useState<PdfTemplate | null>(null);
    const [deleting, setDeleting] = React.useState(false);

    const formatDate = (iso: string | null) => {
        if (!iso) return '-';
        return new Date(iso).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleCreate = () => {
        if (!createName.trim()) return;
        setCreating(true);
        router.post(
            companyUrl('/settings/pdf-templates'),
            { name: createName.trim(), description: createDescription.trim() || null },
            {
                onSuccess: () => {
                    toast.success('Template berhasil dibuat.');
                    setCreateOpen(false);
                    setCreateName('');
                    setCreateDescription('');
                },
                onError: () => toast.error('Gagal membuat template.'),
                onFinish: () => setCreating(false),
            },
        );
    };

    const handleRenameOpen = (t: PdfTemplate) => {
        setRenameTemplate(t);
        setRenameName(t.name);
        setRenameDescription(t.description ?? '');
    };

    const handleRename = () => {
        if (!renameTemplate || !renameName.trim()) return;
        setRenaming(true);
        router.put(
            companyUrl(`/settings/pdf-templates/${renameTemplate.id}`),
            { name: renameName.trim(), description: renameDescription.trim() || null },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Template berhasil diperbarui.');
                    setRenameTemplate(null);
                },
                onError: () => toast.error('Gagal memperbarui template.'),
                onFinish: () => setRenaming(false),
            },
        );
    };

    const handleSetDefault = (t: PdfTemplate) => {
        router.post(
            companyUrl(`/settings/pdf-templates/${t.id}/set-default`),
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success(`"${t.name}" dijadikan template default.`),
                onError: () => toast.error('Gagal mengubah template default.'),
            },
        );
    };

    const handleDuplicate = (t: PdfTemplate) => {
        router.post(
            companyUrl(`/settings/pdf-templates/${t.id}/duplicate`),
            {},
            {
                onSuccess: () => toast.success(`Template "${t.name}" berhasil diduplikat.`),
                onError: () => toast.error('Gagal menduplikat template.'),
            },
        );
    };

    const handleDelete = () => {
        if (!deleteTemplate) return;
        setDeleting(true);
        router.delete(companyUrl(`/settings/pdf-templates/${deleteTemplate.id}`), {
            onSuccess: () => {
                toast.success('Template berhasil dihapus.');
                setDeleteTemplate(null);
            },
            onError: () => toast.error('Gagal menghapus template.'),
            onFinish: () => setDeleting(false),
        });
    };

    const columns: ColumnDef<PdfTemplate, unknown>[] = [
        {
            id: 'name',
            header: 'Nama',
            accessorKey: 'name',
            cell: ({ row }) => (
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium text-dark-900 dark:text-dark-50 truncate">{row.original.name}</div>
                        {row.original.description && (
                            <div className="text-xs text-dark-400 dark:text-dark-500 truncate">{row.original.description}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            id: 'status',
            header: 'Status',
            cell: ({ row }) =>
                row.original.is_default ? (
                    <Badge variant="green" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Default
                    </Badge>
                ) : (
                    <span className="text-xs text-dark-400 dark:text-dark-500">—</span>
                ),
        },
        {
            id: 'updated_at',
            header: 'Diperbarui',
            cell: ({ row }) => (
                <span className="text-sm text-dark-500 dark:text-dark-400">{formatDate(row.original.updated_at)}</span>
            ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const t = row.original;
                return (
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.visit(companyUrl(`/settings/pdf-templates/${t.id}/edit`))}
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleRenameOpen(t)}>
                                    <Edit2 className="w-4 h-4" />
                                    Ubah Nama
                                </DropdownMenuItem>
                                {!t.is_default && (
                                    <DropdownMenuItem onClick={() => handleSetDefault(t)}>
                                        <Star className="w-4 h-4" />
                                        Jadikan Default
                                    </DropdownMenuItem>
                                )}
                                {t.is_default && (
                                    <DropdownMenuItem disabled>
                                        <StarOff className="w-4 h-4" />
                                        Sudah Default
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                                    <Copy className="w-4 h-4" />
                                    Duplikat
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                    onClick={() => setDeleteTemplate(t)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Hapus
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];

    return (
        <>
            <Head title="Template PDF" />

            <SettingsLayout
                title="Template PDF"
                description="Buat dan kelola template invoice visual untuk cetak PDF"
                action={
                    <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Template Baru
                    </Button>
                }
            >
                {templates.length === 0 ? (
                    <EmptyState
                        icon={<FileText className="w-8 h-8" />}
                        title="Belum ada template"
                        description="Buat template PDF pertama Anda untuk mulai merancang tampilan invoice secara visual."
                        action={
                            <Button variant="primary" onClick={() => setCreateOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Buat Template Pertama
                            </Button>
                        }
                    />
                ) : (
                    <DataTable columns={columns} data={templates} />
                )}
            </SettingsLayout>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>Template Baru</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input
                            label="Nama Template *"
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder="Mis: Template Utama"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                        <Input
                            label="Deskripsi"
                            value={createDescription}
                            onChange={(e) => setCreateDescription(e.target.value)}
                            placeholder="Opsional — keterangan singkat"
                        />
                    </div>
                    <DialogFooter>
                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                            <Button
                                variant="zinc"
                                className="w-full sm:w-auto order-2 sm:order-1"
                                onClick={() => setCreateOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                variant="primary"
                                className="w-full sm:w-auto order-1 sm:order-2"
                                onClick={handleCreate}
                                loading={creating}
                                disabled={!createName.trim()}
                            >
                                Buat Template
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename dialog */}
            <Dialog open={renameTemplate !== null} onOpenChange={(o) => !o && setRenameTemplate(null)}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>Ubah Nama Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input
                            label="Nama Template *"
                            value={renameName}
                            onChange={(e) => setRenameName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            autoFocus
                        />
                        <Input
                            label="Deskripsi"
                            value={renameDescription}
                            onChange={(e) => setRenameDescription(e.target.value)}
                            placeholder="Opsional — keterangan singkat"
                        />
                    </div>
                    <DialogFooter>
                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                            <Button
                                variant="zinc"
                                className="w-full sm:w-auto order-2 sm:order-1"
                                onClick={() => setRenameTemplate(null)}
                            >
                                Batal
                            </Button>
                            <Button
                                variant="primary"
                                className="w-full sm:w-auto order-1 sm:order-2"
                                onClick={handleRename}
                                loading={renaming}
                                disabled={!renameName.trim()}
                            >
                                Simpan
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <ConfirmDialog
                open={deleteTemplate !== null}
                onOpenChange={(o) => !o && setDeleteTemplate(null)}
                onConfirm={handleDelete}
                title={deleteTemplate ? `Hapus "${deleteTemplate.name}"?` : 'Hapus Template'}
                description="Template ini akan dihapus permanen beserta seluruh layout yang tersimpan. Tindakan ini tidak dapat dibatalkan."
                variant="danger"
                confirmLabel="Hapus Template"
                loading={deleting}
            />
        </>
    );
}

PdfTemplatesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
