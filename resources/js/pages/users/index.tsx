import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Briefcase,
    CheckCircle,
    Eye,
    EyeOff,
    Mail,
    Pencil,
    Phone,
    Plus,
    Search,
    Shield,
    ShieldAlert,
    Trash2,
    UserPlus,
    Users as UsersIcon,
    X,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
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
import { FormSection } from '@/components/shared/form-section';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface UserRow {
    id: number;
    name: string;
    email: string;
    phone_number: string | null;
    status: 'active' | 'inactive';
    role: string | null;
    role_icon: string | null;
    initials: string;
    created_at: string | null;
    is_current: boolean;
}

interface PaginatedUsers {
    data: UserRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface Stats {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    finance_managers: number;
}

interface FilterOption {
    label: string;
    value: string;
}

interface Filters {
    search?: string;
    role?: string;
    status?: string;
    per_page?: number;
    sort?: string;
    direction?: string;
}

interface Props extends SharedProps {
    users: PaginatedUsers;
    stats: Stats;
    roleOptions: FilterOption[];
    filters: Filters;
}

/* ─────────────────────────────────── blank form ─── */

interface UserFormData {
    name: string;
    email: string;
    phone_number: string;
    status: 'active' | 'inactive';
    role: string;
    password: string;
    password_confirmation: string;
}

const blankForm: UserFormData = {
    name: '',
    email: '',
    phone_number: '',
    status: 'active',
    role: '',
    password: '',
    password_confirmation: '',
};

/* ─────────────────────────────────── role meta ─── */

const ROLE_META: Record<string, { label: string; variant: 'red' | 'blue' | 'green' | 'purple' | 'zinc'; icon: React.ReactNode }> = {
    admin: { label: 'Admin', variant: 'red', icon: <ShieldAlert className="w-3 h-3" /> },
    'finance manager': { label: 'Finance Manager', variant: 'blue', icon: <Briefcase className="w-3 h-3" /> },
    staff: { label: 'Staff', variant: 'green', icon: <UsersIcon className="w-3 h-3" /> },
};

function roleMeta(role: string | null) {
    if (!role) return null;
    return ROLE_META[role] ?? { label: role.charAt(0).toUpperCase() + role.slice(1), variant: 'zinc' as const, icon: <Shield className="w-3 h-3" /> };
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/* ─────────────────────────────────── user form (dialog body) ─── */

function UserFormDialog({
    open,
    onOpenChange,
    mode,
    editingUser,
    roleOptions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    editingUser: UserRow | null;
    roleOptions: FilterOption[];
}) {
    const [showPassword, setShowPassword] = React.useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = React.useState(false);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<UserFormData>(blankForm);

    React.useEffect(() => {
        if (open && mode === 'edit' && editingUser) {
            setData({
                name: editingUser.name,
                email: editingUser.email,
                phone_number: editingUser.phone_number ?? '',
                status: editingUser.status,
                role: editingUser.role ?? '',
                password: '',
                password_confirmation: '',
            });
        } else if (open && mode === 'create') {
            reset();
        }
        if (!open) {
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, editingUser]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                toast.success(mode === 'create' ? 'Pengguna berhasil ditambahkan.' : 'Pengguna berhasil diperbarui.');
                reset();
            },
            onError: () => {
                toast.error('Periksa kembali isian form.');
            },
        };
        if (mode === 'create') {
            post(companyUrl('/admin/users'), opts);
        } else if (editingUser) {
            put(companyUrl(`/admin/users/${editingUser.id}`), opts);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="2xl" className="p-0 overflow-hidden">
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
                                    <UserPlus className="w-6 h-6 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Pencil className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                )}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                    {mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna'}
                                </DialogTitle>
                                <p className="text-sm text-dark-500 dark:text-dark-400">
                                    {mode === 'create'
                                        ? 'Buat akun pengguna baru dengan peran tertentu'
                                        : 'Perbarui informasi pengguna dan peran akses'}
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left column */}
                            <FormSection title="Informasi Akun" description="Identitas dan kontak pengguna">
                                <Input
                                    label="Nama Lengkap *"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    error={errors.name}
                                    placeholder="Misal: Budi Santoso"
                                    autoFocus
                                />

                                <Input
                                    label="Email *"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    error={errors.email}
                                    icon={<Mail className="h-4 w-4" />}
                                    placeholder="nama@perusahaan.com"
                                />

                                <Input
                                    label="Nomor Telepon"
                                    value={data.phone_number}
                                    onChange={(e) => setData('phone_number', e.target.value)}
                                    error={errors.phone_number}
                                    icon={<Phone className="h-4 w-4" />}
                                    placeholder="08xx-xxxx-xxxx"
                                />

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                        Status *
                                    </label>
                                    <div className="flex gap-3">
                                        {(['active', 'inactive'] as const).map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setData('status', s)}
                                                className={cn(
                                                    'flex-1 h-9 rounded-lg border text-sm font-medium transition-colors',
                                                    data.status === s
                                                        ? s === 'active'
                                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                                                            : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
                                                        : 'border-secondary-300 dark:border-dark-600 text-dark-600 dark:text-dark-400 hover:bg-zinc-50 dark:hover:bg-dark-700',
                                                )}
                                            >
                                                {s === 'active' ? 'Aktif' : 'Tidak Aktif'}
                                            </button>
                                        ))}
                                    </div>
                                    {errors.status && <p className="text-xs text-red-600 dark:text-red-400">{errors.status}</p>}
                                </div>
                            </FormSection>

                            {/* Right column */}
                            <FormSection
                                title="Peran & Kata Sandi"
                                description={
                                    mode === 'create'
                                        ? 'Kata sandi wajib diisi'
                                        : 'Kosongkan kata sandi jika tidak ingin mengubah'
                                }
                            >
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                        Peran *
                                    </label>
                                    <Combobox
                                        options={roleOptions}
                                        value={data.role || null}
                                        onChange={(v) => setData('role', v ? String(v) : '')}
                                        placeholder="Pilih peran pengguna"
                                        emptyText="Peran tidak ditemukan"
                                    />
                                    {errors.role && <p className="text-xs text-red-600 dark:text-red-400">{errors.role}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                        Kata Sandi {mode === 'create' && '*'}
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            error={errors.password}
                                            placeholder={mode === 'create' ? 'Minimal 8 karakter' : 'Kosongkan jika tidak diubah'}
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                        Konfirmasi Kata Sandi {mode === 'create' && '*'}
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswordConfirm ? 'text' : 'password'}
                                            value={data.password_confirmation}
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            placeholder="Ulangi kata sandi"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200"
                                            tabIndex={-1}
                                        >
                                            {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-zinc-50 dark:bg-dark-800/50 p-3">
                                    <p className="text-xs text-dark-500 dark:text-dark-400 leading-relaxed">
                                        Pengguna baru otomatis terverifikasi email-nya dan dapat langsung masuk ke sistem.
                                    </p>
                                </div>
                            </FormSection>
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                        <Button
                            type="button"
                            variant="zinc"
                            onClick={() => onOpenChange(false)}
                            disabled={processing}
                            className="w-full sm:w-auto order-2 sm:order-1"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant={mode === 'create' ? 'green' : 'blue'}
                            loading={processing}
                            className="w-full sm:w-auto order-1 sm:order-2"
                        >
                            {mode === 'create' ? 'Tambah Pengguna' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── user avatar ─── */

function UserAvatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' | 'lg' }) {
    const sizeMap = {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
    };
    return (
        <div
            className={cn(
                'rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold shrink-0',
                sizeMap[size],
            )}
        >
            {initials}
        </div>
    );
}

/* ─────────────────────────────────── main page ─── */

export default function UsersIndex() {
    const { users, stats, roleOptions, filters, auth } = usePage<Props>().props;

    const can = (perm: string) => auth.permissions.includes(perm);
    const canManage = can('manage users');

    const [search, setSearch] = React.useState(filters.search ?? '');
    const [roleFilter, setRoleFilter] = React.useState(filters.role ?? '');
    const [statusFilter, setStatusFilter] = React.useState(filters.status ?? '');

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editingUser, setEditingUser] = React.useState<UserRow | null>(null);
    const [deletingUser, setDeletingUser] = React.useState<UserRow | null>(null);
    const [selected, setSelected] = React.useState<number[]>([]);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    // Debounced search
    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                apply({ search, page: 1 });
            }
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const apply = (patch: Partial<Filters & { page: number }>) => {
        router.get(
            companyUrl('/admin/users'),
            {
                search: patch.search ?? search ?? undefined,
                role: patch.role ?? roleFilter ?? undefined,
                status: patch.status ?? statusFilter ?? undefined,
                per_page: filters.per_page,
                sort: filters.sort,
                direction: filters.direction,
                page: patch.page ?? users.current_page,
            },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['users', 'stats', 'filters'],
                replace: true,
            },
        );
    };

    const resetFilters = () => {
        setSearch('');
        setRoleFilter('');
        setStatusFilter('');
        router.get(companyUrl('/admin/users'), {}, { preserveScroll: true, replace: true });
    };

    const activeFilterCount = [search, roleFilter, statusFilter].filter(Boolean).length;

    const toggleAll = () => {
        if (selected.length === users.data.filter((u) => !u.is_current).length) {
            setSelected([]);
        } else {
            setSelected(users.data.filter((u) => !u.is_current).map((u) => u.id));
        }
    };

    const toggleOne = (id: number) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const confirmDelete = () => {
        if (!deletingUser) return;
        setDeleteProcessing(true);
        router.delete(companyUrl(`/admin/users/${deletingUser.id}`), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Pengguna berhasil dihapus.');
                setDeletingUser(null);
            },
            onError: () => toast.error('Gagal menghapus pengguna.'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const confirmBulkDelete = () => {
        if (selected.length === 0) return;
        setDeleteProcessing(true);
        router.post(
            companyUrl('/admin/users/bulk-delete'),
            { ids: selected },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`Berhasil menghapus ${selected.length} pengguna.`);
                    setSelected([]);
                    setBulkDeleteOpen(false);
                },
                onError: () => toast.error('Gagal menghapus pengguna.'),
                onFinish: () => setDeleteProcessing(false),
            },
        );
    };

    const selectableCount = users.data.filter((u) => !u.is_current).length;
    const allSelected = selectableCount > 0 && selected.length === selectableCount;

    return (
        <>
            <Head title="Manajemen Pengguna" />

            <div className="space-y-6">
                <PageHeader
                    title="Manajemen Pengguna"
                    description="Kelola akun pengguna, peran akses, dan status keaktifan"
                    action={
                        canManage && (
                            <Button variant="primary" onClick={() => setCreateOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Tambah Pengguna
                            </Button>
                        )
                    }
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard
                        label="Total Pengguna"
                        value={stats.total}
                        icon={<UsersIcon />}
                        color="blue"
                    />
                    <StatsCard
                        label="Pengguna Aktif"
                        value={stats.active}
                        icon={<CheckCircle />}
                        color="green"
                    />
                    <StatsCard
                        label="Administrator"
                        value={stats.admins}
                        icon={<ShieldAlert />}
                        color="red"
                    />
                    <StatsCard
                        label="Finance Manager"
                        value={stats.finance_managers}
                        icon={<Briefcase />}
                        color="purple"
                    />
                </div>

                {/* Filter Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Combobox
                            label="Peran"
                            options={roleOptions}
                            value={roleFilter || null}
                            onChange={(v) => {
                                const next = v ? String(v) : '';
                                setRoleFilter(next);
                                apply({ role: next, page: 1 });
                            }}
                            placeholder="Semua peran"
                            searchPlaceholder="Cari peran..."
                            emptyText="Tidak ada peran"
                            clearable
                        />
                        <Combobox
                            label="Status"
                            options={[
                                { label: 'Aktif', value: 'active' },
                                { label: 'Tidak Aktif', value: 'inactive' },
                            ]}
                            value={statusFilter || null}
                            onChange={(v) => {
                                const next = v ? String(v) : '';
                                setStatusFilter(next);
                                apply({ status: next, page: 1 });
                            }}
                            placeholder="Semua status"
                            emptyText="Tidak ada status"
                            clearable
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                            <div className="w-full sm:w-64">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama, email, atau telepon..."
                                    icon={<Search className="w-4 h-4" />}
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                {activeFilterCount > 0 && (
                                    <>
                                        <Badge variant="blue">{activeFilterCount} filter aktif</Badge>
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="text-xs text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 inline-flex items-center gap-1"
                                        >
                                            <X className="w-3 h-3" />
                                            Reset
                                        </button>
                                    </>
                                )}
                                <div className="text-sm text-dark-500 dark:text-dark-400">
                                    <span className="hidden sm:inline">Menampilkan </span>
                                    {users.data.length}
                                    <span className="hidden sm:inline"> dari {users.total}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden bg-white dark:bg-dark-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-secondary-50/60 dark:bg-dark-800/60 border-b border-secondary-200 dark:border-dark-600">
                                <tr>
                                    {canManage && (
                                        <th className="px-4 py-3 w-10">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={toggleAll}
                                                disabled={selectableCount === 0}
                                            />
                                        </th>
                                    )}
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        Pengguna
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        Kontak
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        Peran
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        Status
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        Bergabung
                                    </th>
                                    {canManage && (
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400 w-32">
                                            Aksi
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManage ? 7 : 5} className="p-0">
                                            <EmptyState
                                                icon={<UsersIcon className="w-12 h-12" />}
                                                title="Belum ada pengguna"
                                                description="Tambahkan pengguna baru atau ubah filter pencarian."
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    users.data.map((user) => {
                                        const isSelected = selected.includes(user.id);
                                        const meta = roleMeta(user.role);
                                        return (
                                            <tr
                                                key={user.id}
                                                className={cn(
                                                    'hover:bg-secondary-50/80 dark:hover:bg-dark-800/50 transition-colors',
                                                    isSelected && 'bg-primary-50/40 dark:bg-primary-900/10',
                                                )}
                                            >
                                                {canManage && (
                                                    <td className="px-4 py-3 align-middle">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleOne(user.id)}
                                                            disabled={user.is_current}
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-3 py-3 align-middle">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar initials={user.initials} />
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-dark-900 dark:text-dark-50 flex items-center gap-2">
                                                                {user.name}
                                                                {user.is_current && (
                                                                    <Badge variant="zinc" className="text-[10px] px-1.5 py-0.5">Anda</Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-dark-500 dark:text-dark-400 truncate">
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 align-middle">
                                                    {user.phone_number ? (
                                                        <div className="flex items-center gap-1.5 text-dark-700 dark:text-dark-300">
                                                            <Phone className="w-3.5 h-3.5 text-dark-400" />
                                                            <span className="tabular-nums">{user.phone_number}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-dark-400 dark:text-dark-500 italic text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 align-middle">
                                                    {meta ? (
                                                        <Badge variant={meta.variant} className="inline-flex items-center gap-1">
                                                            {meta.icon}
                                                            {meta.label}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-dark-400 dark:text-dark-500 italic text-xs">Tanpa peran</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 align-middle">
                                                    <Badge variant={user.status === 'active' ? 'green' : 'red'}>
                                                        {user.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-3 align-middle text-dark-700 dark:text-dark-300 tabular-nums">
                                                    {formatDate(user.created_at)}
                                                </td>
                                                {canManage && (
                                                    <td className="px-3 py-3 align-middle">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setEditingUser(user)}
                                                                title="Edit pengguna"
                                                            >
                                                                <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                            </Button>
                                                            {!user.is_current && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => setDeletingUser(user)}
                                                                    title="Hapus pengguna"
                                                                >
                                                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {users.data.length > 0 && (
                        <div className="border-t border-secondary-200 dark:border-dark-600 px-4 py-3">
                            <Pagination
                                meta={{
                                    current_page: users.current_page,
                                    last_page: users.last_page,
                                    per_page: users.per_page,
                                    total: users.total,
                                    from: users.from,
                                    to: users.to,
                                }}
                                onPageChange={(p) => apply({ page: p })}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {canManage && selected.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <div className="bg-white dark:bg-dark-700 rounded-xl shadow-lg border border-secondary-200 dark:border-dark-600 p-4 min-w-[20rem]">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                    <div className="font-semibold text-dark-900 dark:text-dark-50">
                                        {selected.length} dipilih
                                    </div>
                                    <div className="text-xs text-dark-500 dark:text-dark-400">
                                        Pilih aksi untuk pengguna terpilih
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="red" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                                    <Trash2 className="w-4 h-4" />
                                    Hapus
                                </Button>
                                <Button variant="zinc" size="sm" onClick={() => setSelected([])}>
                                    <X className="w-4 h-4" />
                                    Batal
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit dialog */}
            <UserFormDialog
                open={createOpen || editingUser !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreateOpen(false);
                        setEditingUser(null);
                    }
                }}
                mode={editingUser ? 'edit' : 'create'}
                editingUser={editingUser}
                roleOptions={roleOptions}
            />

            {/* Single delete */}
            <ConfirmDialog
                open={deletingUser !== null}
                onOpenChange={(open) => !open && setDeletingUser(null)}
                onConfirm={confirmDelete}
                title="Hapus Pengguna"
                description={
                    deletingUser
                        ? `Apakah Anda yakin ingin menghapus pengguna "${deletingUser.name}"? Tindakan ini tidak dapat dibatalkan.`
                        : ''
                }
                variant="danger"
                confirmLabel="Hapus"
                loading={deleteProcessing}
            />

            {/* Bulk delete */}
            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                onConfirm={confirmBulkDelete}
                title={`Hapus ${selected.length} Pengguna`}
                description="Tindakan ini akan menghapus semua pengguna yang dipilih secara permanen. Lanjutkan?"
                variant="danger"
                confirmLabel="Hapus Semua"
                loading={deleteProcessing}
            />
        </>
    );
}

UsersIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
