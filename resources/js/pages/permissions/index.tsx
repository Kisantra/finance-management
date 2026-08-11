import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Archive,
    BarChart3,
    Beaker,
    Bell,
    Bookmark,
    Briefcase,
    Calculator,
    Calendar,
    Check,
    CheckCircle,
    CircleAlert,
    Clipboard,
    Clock,
    Copy,
    DollarSign,
    Eye,
    EyeOff,
    FileText,
    Folder,
    FolderOpen,
    Heart,
    Inbox,
    Info,
    KeyRound,
    Lock,
    LockOpen,
    Pencil,
    Plus,
    Search,
    Settings,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Star,
    Tag,
    Trash2,
    User,
    UserCog,
    Users as UsersIcon,
    Wrench,
    X,
    XCircle,
    Banknote,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface RoleRow {
    id: number;
    name: string;
    icon: string;
    permissions_count: number;
    users_count: number;
    permission_ids: number[];
}

interface PermissionRow {
    id: number;
    name: string;
}

interface Props extends SharedProps {
    roles: RoleRow[];
    groupedPermissions: Record<string, PermissionRow[]>;
    totalPermissions: number;
    selectedRoleId: number;
    canManagePermissions: boolean;
}

/* ─────────────────────────────────── icon map ─── */

const AVAILABLE_ICONS = [
    'shield-check', 'shield-alert', 'user', 'user-cog', 'users',
    'banknote', 'dollar-sign', 'file-text', 'folder', 'briefcase',
    'bar-chart-3', 'settings', 'key-round', 'lock', 'lock-open',
    'eye', 'eye-off', 'pencil', 'trash-2', 'check-circle',
    'x-circle', 'circle-alert', 'info', 'star', 'heart',
    'bell', 'clipboard', 'copy', 'archive', 'inbox',
    'wrench', 'beaker', 'calculator', 'calendar', 'clock',
    'tag', 'bookmark',
] as const;

type IconName = (typeof AVAILABLE_ICONS)[number];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    // Lucide canonical names
    'shield-check': ShieldCheck,
    'shield-alert': ShieldAlert,
    user: User,
    'user-cog': UserCog,
    users: UsersIcon,
    banknote: Banknote,
    'dollar-sign': DollarSign,
    'file-text': FileText,
    folder: Folder,
    briefcase: Briefcase,
    'bar-chart-3': BarChart3,
    settings: Settings,
    'key-round': KeyRound,
    lock: Lock,
    'lock-open': LockOpen,
    eye: Eye,
    'eye-off': EyeOff,
    pencil: Pencil,
    'trash-2': Trash2,
    'check-circle': CheckCircle,
    'x-circle': XCircle,
    'circle-alert': CircleAlert,
    info: Info,
    star: Star,
    heart: Heart,
    bell: Bell,
    clipboard: Clipboard,
    copy: Copy,
    archive: Archive,
    inbox: Inbox,
    wrench: Wrench,
    beaker: Beaker,
    calculator: Calculator,
    calendar: Calendar,
    clock: Clock,
    tag: Tag,
    bookmark: Bookmark,
    // Heroicon legacy aliases (backward compat)
    'shield-exclamation': ShieldAlert,
    'user-group': UsersIcon,
    banknotes: Banknote,
    'currency-dollar': DollarSign,
    'document-text': FileText,
    'chart-bar': BarChart3,
    cog: Settings,
    key: KeyRound,
    'lock-closed': Lock,
    'eye-slash': EyeOff,
    trash: Trash2,
    'exclamation-circle': CircleAlert,
    'information-circle': Info,
    'document-duplicate': Copy,
    'archive-box': Archive,
};

function RoleIcon({ name, className }: { name: string; className?: string }) {
    const Cmp = ICON_MAP[name] ?? Shield;
    return <Cmp className={className} />;
}

/* ─────────────────────────────────── role form dialog ─── */

interface RoleFormData {
    name: string;
    icon: IconName;
}

function RoleFormDialog({
    open,
    onOpenChange,
    mode,
    editingRole,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    editingRole: RoleRow | null;
}) {
    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<RoleFormData>({
        name: '',
        icon: 'shield-check',
    });

    React.useEffect(() => {
        if (open && mode === 'edit' && editingRole) {
            setData({
                name: editingRole.name,
                icon: (editingRole.icon as IconName) ?? 'shield-check',
            });
        } else if (open && mode === 'create') {
            reset();
        }
        if (!open) clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, editingRole]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                toast.success(mode === 'create' ? 'Peran berhasil ditambahkan.' : 'Peran berhasil diperbarui.');
                reset();
            },
            onError: () => toast.error('Periksa kembali isian form.'),
        };
        if (mode === 'create') post(companyUrl('/admin/roles'), opts);
        else if (editingRole) put(companyUrl(`/admin/roles/${editingRole.id}`), opts);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg" className="p-0 overflow-hidden">
                <form onSubmit={submit}>
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <div className="flex items-center gap-4">
                            <div
                                className={cn(
                                    'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
                                    mode === 'create'
                                        ? 'bg-green-50 dark:bg-green-900/20'
                                        : 'bg-blue-50 dark:bg-blue-900/20',
                                )}
                            >
                                {mode === 'create' ? (
                                    <Plus className="w-6 h-6 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Pencil className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                )}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                    {mode === 'create' ? 'Tambah Peran' : 'Edit Peran'}
                                </DialogTitle>
                                <p className="text-sm text-dark-500 dark:text-dark-400">
                                    Pilih nama dan ikon yang merepresentasikan peran ini
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-6 py-4 space-y-5">
                        <Input
                            label="Nama Peran *"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={errors.name}
                            placeholder="Misal: supervisor, auditor, manager"
                            autoFocus
                            hint="Nama akan otomatis diubah ke huruf kecil"
                        />

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                Ikon Peran *
                            </label>
                            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 max-h-64 overflow-y-auto p-2 rounded-xl border border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                                {AVAILABLE_ICONS.map((iconName) => {
                                    const selected = data.icon === iconName;
                                    return (
                                        <button
                                            key={iconName}
                                            type="button"
                                            onClick={() => setData('icon', iconName)}
                                            className={cn(
                                                'h-10 w-10 flex items-center justify-center rounded-lg border transition-all',
                                                selected
                                                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400 scale-105'
                                                    : 'border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-600',
                                            )}
                                            title={iconName}
                                        >
                                            <RoleIcon name={iconName} className="w-4 h-4" />
                                        </button>
                                    );
                                })}
                            </div>
                            {errors.icon && <p className="text-xs text-red-600 dark:text-red-400">{errors.icon}</p>}
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                        <Button type="button" variant="zinc" onClick={() => onOpenChange(false)} disabled={processing} className="w-full sm:w-auto order-2 sm:order-1">
                            Batal
                        </Button>
                        <Button type="submit" variant={mode === 'create' ? 'green' : 'blue'} loading={processing} className="w-full sm:w-auto order-1 sm:order-2">
                            {mode === 'create' ? 'Tambah Peran' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── main page ─── */

export default function PermissionsIndex() {
    const { roles, groupedPermissions, totalPermissions, selectedRoleId: initialRoleId, canManagePermissions, auth } = usePage<Props>().props;

    const [selectedRoleId, setSelectedRoleId] = React.useState<number>(initialRoleId || roles[0]?.id || 0);
    const [searchPermission, setSearchPermission] = React.useState('');

    const [roleCreateOpen, setRoleCreateOpen] = React.useState(false);
    const [editingRole, setEditingRole] = React.useState<RoleRow | null>(null);
    const [deletingRole, setDeletingRole] = React.useState<RoleRow | null>(null);
    const [deletingPermission, setDeletingPermission] = React.useState<PermissionRow | null>(null);
    const [confirmGrantAll, setConfirmGrantAll] = React.useState(false);
    const [confirmRevokeAll, setConfirmRevokeAll] = React.useState(false);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    const selectedRole = React.useMemo(() => roles.find((r) => r.id === selectedRoleId) ?? null, [roles, selectedRoleId]);

    // Filter permissions by search
    const filteredGroups = React.useMemo(() => {
        if (!searchPermission.trim()) return groupedPermissions;
        const q = searchPermission.toLowerCase().trim();
        const result: Record<string, PermissionRow[]> = {};
        for (const [module, perms] of Object.entries(groupedPermissions)) {
            const filtered = perms.filter((p) => p.name.toLowerCase().includes(q));
            if (filtered.length > 0) result[module] = filtered;
        }
        return result;
    }, [groupedPermissions, searchPermission]);

    const moduleCount = Object.keys(groupedPermissions).length;

    const togglePermission = (permissionId: number) => {
        if (!canManagePermissions || !selectedRole) return;
        router.post(
            companyUrl('/admin/permissions/toggle'),
            { role_id: selectedRole.id, permission_id: permissionId },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['roles'],
                onSuccess: () => {
                    // silent — UI updates from refreshed props
                },
                onError: () => toast.error('Gagal mengubah permission.'),
            },
        );
    };

    const syncModule = (module: string, action: 'grant' | 'revoke') => {
        if (!canManagePermissions || !selectedRole) return;
        router.post(
            companyUrl('/admin/permissions/sync-module'),
            { role_id: selectedRole.id, module, action },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['roles'],
                onSuccess: () => {
                    toast.success(action === 'grant' ? `Semua permission ${module} diberikan.` : `Semua permission ${module} dicabut.`);
                },
                onError: () => toast.error('Gagal memperbarui permission.'),
            },
        );
    };

    const syncAll = (action: 'grant' | 'revoke') => {
        if (!canManagePermissions || !selectedRole) return;
        router.post(
            companyUrl('/admin/permissions/sync-all'),
            { role_id: selectedRole.id, action },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['roles'],
                onSuccess: () => {
                    toast.success(action === 'grant' ? 'Semua permission diberikan.' : 'Semua permission dicabut.');
                    setConfirmGrantAll(false);
                    setConfirmRevokeAll(false);
                },
                onError: () => toast.error('Gagal memperbarui permission.'),
            },
        );
    };

    const confirmDeleteRole = () => {
        if (!deletingRole) return;
        setDeleteProcessing(true);
        router.delete(companyUrl(`/admin/roles/${deletingRole.id}`), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Peran berhasil dihapus.');
                setDeletingRole(null);
                if (selectedRoleId === deletingRole.id && roles.length > 1) {
                    const next = roles.find((r) => r.id !== deletingRole.id);
                    if (next) setSelectedRoleId(next.id);
                }
            },
            onError: () => toast.error('Gagal menghapus peran.'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const confirmDeletePermission = () => {
        if (!deletingPermission) return;
        setDeleteProcessing(true);
        router.delete(companyUrl(`/admin/permissions/${deletingPermission.id}`), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Permission berhasil dihapus.');
                setDeletingPermission(null);
            },
            onError: () => toast.error('Gagal menghapus permission.'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    return (
        <>
            <Head title="Manajemen Peran & Permission" />

            <div className="space-y-6">
                <PageHeader
                    title="Manajemen Peran & Permission"
                    description="Kelola peran sistem dan akses fitur untuk setiap peran"
                    action={
                        canManagePermissions && (
                            <Button variant="primary" onClick={() => setRoleCreateOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Tambah Peran
                            </Button>
                        )
                    }
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatsCard label="Total Peran" value={roles.length} icon={<UsersIcon />} color="blue" />
                    <StatsCard label="Total Permission" value={totalPermissions} icon={<ShieldCheck />} color="green" />
                    <StatsCard label="Modul" value={moduleCount} icon={<Folder />} color="purple" />
                </div>

                {/* Main Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Role Sidebar */}
                    <div className="lg:col-span-3">
                        <div className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden bg-white dark:bg-dark-700 lg:sticky lg:top-6">
                            <div className="px-4 py-3 border-b border-secondary-200 dark:border-dark-600 bg-secondary-50/60 dark:bg-dark-800/60">
                                <h3 className="font-semibold text-dark-900 dark:text-dark-50 flex items-center gap-2 text-sm">
                                    <UsersIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    Daftar Peran
                                </h3>
                            </div>

                            <div className="p-2 space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto">
                                {roles.map((role) => {
                                    const active = role.id === selectedRoleId;
                                    return (
                                        <div key={role.id} className="group relative">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedRoleId(role.id)}
                                                className={cn(
                                                    'w-full text-left px-3 py-3 rounded-lg transition-colors cursor-pointer',
                                                    active
                                                        ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-600'
                                                        : 'border border-transparent hover:bg-secondary-50 dark:hover:bg-dark-800',
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm shrink-0">
                                                        <RoleIcon name={role.icon} className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold text-sm text-dark-900 dark:text-dark-50 capitalize truncate">
                                                            {role.name}
                                                        </div>
                                                        <div className="text-xs text-dark-500 dark:text-dark-400 tabular-nums">
                                                            {role.permissions_count} permission
                                                            {role.users_count > 0 && ` • ${role.users_count} user`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>

                                            {canManagePermissions && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingRole(role);
                                                        }}
                                                        title="Edit peran"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingRole(role);
                                                        }}
                                                        title="Hapus peran"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Permission Panel */}
                    <div className="lg:col-span-9">
                        {selectedRole ? (
                            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden bg-white dark:bg-dark-700 flex flex-col">
                                {/* Panel Header */}
                                <div className="px-5 py-4 border-b border-secondary-200 dark:border-dark-600 bg-secondary-50/60 dark:bg-dark-800/60">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
                                                <RoleIcon name={selectedRole.icon} className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-dark-900 dark:text-dark-50 capitalize">
                                                    {selectedRole.name}
                                                </h3>
                                                <p className="text-xs text-dark-500 dark:text-dark-400">
                                                    {selectedRole.permission_ids.length} dari {totalPermissions} permission diberikan
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 items-center">
                                            <div className="w-full sm:w-56">
                                                <Input
                                                    value={searchPermission}
                                                    onChange={(e) => setSearchPermission(e.target.value)}
                                                    placeholder="Cari permission..."
                                                    icon={<Search className="w-4 h-4" />}
                                                />
                                            </div>
                                            {canManagePermissions && (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => setConfirmRevokeAll(true)}>
                                                        <X className="w-4 h-4 text-red-500" />
                                                        Cabut Semua
                                                    </Button>
                                                    <Button variant="green" size="sm" onClick={() => setConfirmGrantAll(true)}>
                                                        <Check className="w-4 h-4" />
                                                        Beri Semua
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Permissions */}
                                <div className="flex-1">
                                    {Object.keys(filteredGroups).length === 0 ? (
                                        <EmptyState
                                            icon={<Search className="w-10 h-10" />}
                                            title="Tidak ada permission ditemukan"
                                            description="Coba ubah kata kunci pencarian Anda."
                                        />
                                    ) : (
                                        <div className="divide-y divide-secondary-100 dark:divide-dark-600">
                                            {Object.entries(filteredGroups).map(([module, perms]) => (
                                                <div key={module}>
                                                    <div className="bg-zinc-50 dark:bg-dark-800 px-5 py-3 flex items-center justify-between sticky top-0 z-10 border-b border-secondary-200 dark:border-dark-600">
                                                        <div className="flex items-center gap-2">
                                                            <FolderOpen className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                                            <h4 className="font-semibold text-sm text-dark-900 dark:text-dark-50">{module}</h4>
                                                            <Badge variant="zinc" size="sm">{perms.length}</Badge>
                                                        </div>

                                                        {canManagePermissions && (
                                                            <div className="flex gap-1.5">
                                                                <Button variant="ghost" size="sm" onClick={() => syncModule(module, 'grant')}>
                                                                    <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                                                                    Semua
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={() => syncModule(module, 'revoke')}>
                                                                    <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                                                                    None
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                                        {perms.map((permission) => {
                                                            const checked = selectedRole.permission_ids.includes(permission.id);
                                                            return (
                                                                <div key={permission.id} className="group relative">
                                                                    <label
                                                                        className={cn(
                                                                            'flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors',
                                                                            checked
                                                                                ? 'border-primary-300 dark:border-primary-700 bg-primary-50/60 dark:bg-primary-900/20'
                                                                                : 'border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 hover:border-primary-300 dark:hover:border-primary-700',
                                                                            !canManagePermissions ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                                                                        )}
                                                                    >
                                                                        <span
                                                                            className={cn(
                                                                                'text-xs flex-1 font-mono',
                                                                                checked
                                                                                    ? 'text-primary-700 dark:text-primary-200 font-medium'
                                                                                    : 'text-dark-700 dark:text-dark-300',
                                                                            )}
                                                                        >
                                                                            {permission.name}
                                                                        </span>
                                                                        <Checkbox
                                                                            checked={checked}
                                                                            disabled={!canManagePermissions}
                                                                            onCheckedChange={() => togglePermission(permission.id)}
                                                                        />
                                                                    </label>

                                                                    {canManagePermissions && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setDeletingPermission(permission)}
                                                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                                                                            title="Hapus permission"
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 py-20">
                                <EmptyState
                                    icon={<Shield className="w-12 h-12" />}
                                    title="Pilih peran"
                                    description="Pilih salah satu peran di samping untuk melihat dan mengatur permission-nya."
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Role create/edit dialog */}
            <RoleFormDialog
                open={roleCreateOpen || editingRole !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setRoleCreateOpen(false);
                        setEditingRole(null);
                    }
                }}
                mode={editingRole ? 'edit' : 'create'}
                editingRole={editingRole}
            />

            {/* Delete role */}
            <ConfirmDialog
                open={deletingRole !== null}
                onOpenChange={(open) => !open && setDeletingRole(null)}
                onConfirm={confirmDeleteRole}
                title="Hapus Peran"
                description={
                    deletingRole
                        ? deletingRole.users_count > 0
                            ? `Peran "${deletingRole.name}" memiliki ${deletingRole.users_count} pengguna. Mereka akan dipindahkan ke peran dengan permission paling sedikit.`
                            : `Apakah Anda yakin ingin menghapus peran "${deletingRole.name}"?`
                        : ''
                }
                variant={deletingRole && deletingRole.users_count > 0 ? 'warning' : 'danger'}
                confirmLabel="Hapus Peran"
                loading={deleteProcessing}
            />

            {/* Delete permission */}
            <ConfirmDialog
                open={deletingPermission !== null}
                onOpenChange={(open) => !open && setDeletingPermission(null)}
                onConfirm={confirmDeletePermission}
                title="Hapus Permission"
                description={
                    deletingPermission
                        ? `Permission "${deletingPermission.name}" akan dicabut dari semua peran sebelum dihapus. Lanjutkan?`
                        : ''
                }
                variant="danger"
                confirmLabel="Hapus Permission"
                loading={deleteProcessing}
            />

            {/* Grant all */}
            <ConfirmDialog
                open={confirmGrantAll}
                onOpenChange={setConfirmGrantAll}
                onConfirm={() => syncAll('grant')}
                title="Beri Semua Permission"
                description={selectedRole ? `Berikan semua permission ke peran "${selectedRole.name}"?` : ''}
                variant="warning"
                confirmLabel="Beri Semua"
            />

            {/* Revoke all */}
            <ConfirmDialog
                open={confirmRevokeAll}
                onOpenChange={setConfirmRevokeAll}
                onConfirm={() => syncAll('revoke')}
                title="Cabut Semua Permission"
                description={selectedRole ? `Cabut semua permission dari peran "${selectedRole.name}"?` : ''}
                variant="danger"
                confirmLabel="Cabut Semua"
            />
        </>
    );
}

PermissionsIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
