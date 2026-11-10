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
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { t } from '@/i18n';
import { roleLabel } from '@/lib/roles';
import { cn, formatDate } from '@/lib/utils';
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
    companies: { slug: string; name: string }[];
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
    companyOptions: FilterOption[];
    filters: Filters;
}

/* ─────────────────────────────────── blank form ─── */

interface UserFormData {
    name: string;
    email: string;
    phone_number: string;
    status: 'active' | 'inactive';
    role: string;
    companies: string[];
    password: string;
    password_confirmation: string;
}

const blankForm: UserFormData = {
    name: '',
    email: '',
    phone_number: '',
    status: 'active',
    role: '',
    companies: [],
    password: '',
    password_confirmation: '',
};

/* ─────────────────────────────────── role meta ─── */

const ROLE_META: Record<string, { variant: 'red' | 'blue' | 'green' | 'purple' | 'zinc'; icon: React.ReactNode }> = {
    admin: { variant: 'red', icon: <ShieldAlert className="w-3 h-3" /> },
    'finance manager': { variant: 'blue', icon: <Briefcase className="w-3 h-3" /> },
    staff: { variant: 'green', icon: <UsersIcon className="w-3 h-3" /> },
};

/** Peran bawaan: huruf awal tiap kata kapital; peran buatan sendiri = data, hanya huruf pertama. */
function roleDisplay(role: string): string {
    const label = roleLabel(role);
    if (role in ROLE_META) {
        return label.replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
    }
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function roleMeta(role: string | null) {
    if (!role) return null;
    return { ...(ROLE_META[role] ?? { variant: 'zinc' as const, icon: <Shield className="w-3 h-3" /> }), label: roleDisplay(role) };
}

/* ─────────────────────────────────── user form (dialog body) ─── */

function UserFormDialog({
    open,
    onOpenChange,
    mode,
    editingUser,
    roleOptions,
    companyOptions,
    activeCompany,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    editingUser: UserRow | null;
    roleOptions: FilterOption[];
    companyOptions: FilterOption[];
    activeCompany: string | null;
}) {
    const [showPassword, setShowPassword] = React.useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = React.useState(false);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<UserFormData>(blankForm);
    const roleOptionsLabeled = roleOptions.map((o) => ({ ...o, label: roleDisplay(o.value) }));

    React.useEffect(() => {
        if (open && mode === 'edit' && editingUser) {
            setData({
                name: editingUser.name,
                email: editingUser.email,
                phone_number: editingUser.phone_number ?? '',
                status: editingUser.status,
                role: editingUser.role ?? '',
                companies: editingUser.companies.map((c) => c.slug),
                password: '',
                password_confirmation: '',
            });
        } else if (open && mode === 'create') {
            reset();
            // Pengguna baru default-nya masuk perusahaan yang sedang dibuka —
            // perilaku lama sebelum ada pilihan ini, dan tebakan yang paling sering benar.
            if (activeCompany) {
                setData('companies', [activeCompany]);
            }
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
                toast.success(mode === 'create' ? t('Pengguna berhasil ditambahkan.') : t('Pengguna berhasil diperbarui.'));
                reset();
            },
            onError: () => {
                toast.error(t('Periksa kembali isian form.'));
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
                                    {mode === 'create' ? t('Tambah Pengguna') : t('Ubah Pengguna')}
                                </DialogTitle>
                                <p className="text-sm text-dark-500 dark:text-dark-400">
                                    {mode === 'create'
                                        ? t('Buat akun pengguna baru dengan peran tertentu')
                                        : t('Perbarui informasi pengguna dan peran akses')}
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left column */}
                            <FormSection title={t('Informasi Akun')} description={t('Identitas dan kontak pengguna')}>
                                <Input
                                    label={t('Nama Lengkap *')}
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    error={errors.name}
                                    placeholder={t('Misal: Budi Santoso')}
                                    autoFocus
                                />

                                <Input
                                    label={t('Email *')}
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    error={errors.email}
                                    icon={<Mail className="h-4 w-4" />}
                                    placeholder="nama@perusahaan.com"
                                />

                                <Input
                                    label={t('Nomor Telepon')}
                                    value={data.phone_number}
                                    onChange={(e) => setData('phone_number', e.target.value)}
                                    error={errors.phone_number}
                                    icon={<Phone className="h-4 w-4" />}
                                    placeholder="08xx-xxxx-xxxx"
                                />

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                        {t('Status *')}
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
                                                {s === 'active' ? t('Aktif') : t('Tidak Aktif')}
                                            </button>
                                        ))}
                                    </div>
                                    {errors.status && <p className="text-xs text-red-600 dark:text-red-400">{errors.status}</p>}
                                </div>
                            </FormSection>

                            {/* Right column */}
                            <FormSection
                                title={t('Peran & Kata Sandi')}
                                description={
                                    mode === 'create'
                                        ? t('Kata sandi wajib diisi')
                                        : t('Kosongkan kata sandi jika tidak ingin mengubah')
                                }
                            >
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                        {t('Peran *')}
                                    </label>
                                    <Combobox
                                        options={roleOptionsLabeled}
                                        value={data.role || null}
                                        onChange={(v) => setData('role', v ? String(v) : '')}
                                        placeholder={t('Pilih peran pengguna')}
                                        emptyText={t('Peran tidak ditemukan')}
                                    />
                                    {errors.role && <p className="text-xs text-red-600 dark:text-red-400">{errors.role}</p>}
                                </div>

                                {/*
                                 * Penugasan perusahaan. Hanya muncul kalau organisasi ini
                                 * memang punya lebih dari satu perusahaan — instalasi satu
                                 * perusahaan tidak perlu melihat konsep ini sama sekali.
                                 *
                                 * Peran di atas berlaku untuk SETIAP perusahaan yang dicentang:
                                 * peran bersifat per-perusahaan, jadi mencentang perusahaan
                                 * tanpa memberi peran di sana menghasilkan akun yang bisa masuk
                                 * tetapi tidak boleh berbuat apa pun.
                                 */}
                                {companyOptions.length > 1 && (
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                            {t('Perusahaan *')}
                                        </label>
                                        <p className="text-xs text-dark-500 dark:text-dark-400">
                                            {t('Peran di atas berlaku di setiap perusahaan yang dipilih.')}
                                        </p>
                                        <div className="space-y-1 rounded-xl border border-secondary-200 p-3 dark:border-dark-600">
                                            {companyOptions.map((c) => {
                                                const dipilih = data.companies.includes(c.value);

                                                return (
                                                    <label
                                                        key={c.value}
                                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-secondary-50 dark:hover:bg-dark-600"
                                                    >
                                                        <Checkbox
                                                            checked={dipilih}
                                                            onCheckedChange={(v) =>
                                                                setData(
                                                                    'companies',
                                                                    v === true
                                                                        ? [...data.companies, c.value]
                                                                        : data.companies.filter((x) => x !== c.value),
                                                                )
                                                            }
                                                        />
                                                        <span className="text-sm text-dark-900 dark:text-dark-300">{c.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {errors.companies && (
                                            <p className="text-xs text-red-600 dark:text-red-400">{errors.companies}</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                        {mode === 'create' ? t('Kata Sandi *') : t('Kata Sandi')}
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            error={errors.password}
                                            placeholder={mode === 'create' ? t('Minimal 8 karakter') : t('Kosongkan jika tidak diubah')}
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
                                        {mode === 'create' ? t('Konfirmasi Kata Sandi *') : t('Konfirmasi Kata Sandi')}
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswordConfirm ? 'text' : 'password'}
                                            value={data.password_confirmation}
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            placeholder={t('Ulangi kata sandi')}
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
                                        {t('Pengguna baru otomatis terverifikasi email-nya dan dapat langsung masuk ke sistem.')}
                                    </p>
                                </div>
                            </FormSection>
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4">
                        <Button
                            type="button"
                            variant="zinc"
                            onClick={() => onOpenChange(false)}
                            disabled={processing}
                            className="w-full sm:w-auto order-2 sm:order-1"
                        >
                            {t('Batal')}
                        </Button>
                        <Button
                            type="submit"
                            variant={mode === 'create' ? 'green' : 'blue'}
                            loading={processing}
                            className="w-full sm:w-auto order-1 sm:order-2"
                        >
                            {mode === 'create' ? t('Tambah Pengguna') : t('Simpan Perubahan')}
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
    const { users, stats, roleOptions, companyOptions, filters, auth, company } = usePage<Props>().props;

    const roleOptionsLabeled = roleOptions.map((o) => ({ ...o, label: roleDisplay(o.value) }));
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
        const timer = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                apply({ search, page: 1 });
            }
        }, 350);
        return () => clearTimeout(timer);
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
                toast.success(t('Pengguna berhasil dihapus.'));
                setDeletingUser(null);
            },
            onError: () => toast.error(t('Gagal menghapus pengguna.')),
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
                    toast.success(t('Berhasil menghapus {{count}} pengguna.', { count: selected.length }));
                    setSelected([]);
                    setBulkDeleteOpen(false);
                },
                onError: () => toast.error(t('Gagal menghapus pengguna.')),
                onFinish: () => setDeleteProcessing(false),
            },
        );
    };

    const selectableCount = users.data.filter((u) => !u.is_current).length;
    const allSelected = selectableCount > 0 && selected.length === selectableCount;

    return (
        <>
            <Head title={t('Manajemen Pengguna', { context: 'menu' })} />

            <div className="space-y-6">
                <PageHeader
                    title={t('Manajemen Pengguna', { context: 'menu' })}
                    description={t('Kelola akun pengguna, peran akses, dan status keaktifan')}
                    action={
                        <div className="flex items-center gap-2">
                            <TutorialButton slug="users-permissions" />
                            {canManage && (
                                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                                    <Plus className="w-4 h-4" />
                                    {t('Tambah Pengguna')}
                                </Button>
                            )}
                        </div>
                    }
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard
                        label={t('Total Pengguna')}
                        value={stats.total}
                        icon={<UsersIcon />}
                        color="blue"
                    />
                    <StatsCard
                        label={t('Pengguna Aktif')}
                        value={stats.active}
                        icon={<CheckCircle />}
                        color="green"
                    />
                    <StatsCard
                        label={t('Administrator')}
                        value={stats.admins}
                        icon={<ShieldAlert />}
                        color="red"
                    />
                    <StatsCard
                        label={t('Finance Manager')}
                        value={stats.finance_managers}
                        icon={<Briefcase />}
                        color="purple"
                    />
                </div>

                {/* Filter Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Combobox
                            label={t('Peran')}
                            options={roleOptionsLabeled}
                            value={roleFilter || null}
                            onChange={(v) => {
                                const next = v ? String(v) : '';
                                setRoleFilter(next);
                                apply({ role: next, page: 1 });
                            }}
                            placeholder={t('Semua peran')}
                            searchPlaceholder={t('Cari peran...')}
                            emptyText={t('Tidak ada peran')}
                            clearable
                        />
                        <Combobox
                            label={t('Status')}
                            options={[
                                { label: t('Aktif'), value: 'active' },
                                { label: t('Tidak Aktif'), value: 'inactive' },
                            ]}
                            value={statusFilter || null}
                            onChange={(v) => {
                                const next = v ? String(v) : '';
                                setStatusFilter(next);
                                apply({ status: next, page: 1 });
                            }}
                            placeholder={t('Semua status')}
                            emptyText={t('Tidak ada status')}
                            clearable
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                            <div className="w-full sm:w-64">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('Cari nama, email, atau telepon...')}
                                    icon={<Search className="w-4 h-4" />}
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                {activeFilterCount > 0 && (
                                    <>
                                        <Badge variant="blue">{t('{{count}} filter aktif', { count: activeFilterCount })}</Badge>
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="text-xs text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 inline-flex items-center gap-1"
                                        >
                                            <X className="w-3 h-3" />
                                            {t('Hapus filter')}
                                        </button>
                                    </>
                                )}
                                <div className="text-sm text-dark-500 dark:text-dark-400">
                                    <span className="sm:hidden">{users.data.length}</span>
                                    <span className="hidden sm:inline">{t('Menampilkan {{shown}} dari {{total}}', { shown: users.data.length, total: users.total })}</span>
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
                                        {t('Pengguna')}
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        {t('Kontak')}
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        {t('Peran')}
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        {t('Status')}
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400">
                                        {t('Bergabung')}
                                    </th>
                                    {canManage && (
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-dark-500 dark:text-dark-400 w-32">
                                            {t('Aksi')}
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
                                                title={t('Belum ada pengguna')}
                                                description={t('Tambahkan pengguna baru atau ubah filter pencarian.')}
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
                                                                    <Badge variant="zinc" className="text-[10px] px-1.5 py-0.5">{t('Anda')}</Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-dark-500 dark:text-dark-400 truncate">
                                                                {user.email}
                                                            </div>
                                                            {/* Hanya ditampilkan bila orang ini memang bekerja di lebih
                                                                dari satu perusahaan — selain itu cuma menambah bising. */}
                                                            {user.companies.length > 1 && (
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {user.companies.map((c) => (
                                                                        <Badge key={c.slug} variant="outline" className="text-[10px] px-1.5 py-0.5">
                                                                            {c.name}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
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
                                                        <span className="text-dark-400 dark:text-dark-500 italic text-xs">{t('Tanpa peran')}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 align-middle">
                                                    <Badge variant={user.status === 'active' ? 'green' : 'red'}>
                                                        {user.status === 'active' ? t('Aktif') : t('Tidak Aktif')}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-3 align-middle text-dark-700 dark:text-dark-300 tabular-nums">
                                                    {user.created_at ? formatDate(user.created_at) : '—'}
                                                </td>
                                                {canManage && (
                                                    <td className="px-3 py-3 align-middle">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setEditingUser(user)}
                                                                title={t('Ubah pengguna')}
                                                            >
                                                                <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                            </Button>
                                                            {!user.is_current && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => setDeletingUser(user)}
                                                                    title={t('Hapus pengguna')}
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
                                        {t('{{count}} dipilih', { count: selected.length })}
                                    </div>
                                    <div className="text-xs text-dark-500 dark:text-dark-400">
                                        {t('Pilih aksi untuk pengguna terpilih')}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="red" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                                    <Trash2 className="w-4 h-4" />
                                    {t('Hapus')}
                                </Button>
                                <Button variant="zinc" size="sm" onClick={() => setSelected([])}>
                                    <X className="w-4 h-4" />
                                    {t('Batal')}
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
                companyOptions={companyOptions}
                activeCompany={company?.slug ?? null}
            />

            {/* Single delete */}
            <ConfirmDialog
                open={deletingUser !== null}
                onOpenChange={(open) => !open && setDeletingUser(null)}
                onConfirm={confirmDelete}
                title={t('Hapus Pengguna')}
                description={
                    deletingUser
                        ? t('Apakah Anda yakin ingin menghapus pengguna "{{name}}"? Tindakan ini tidak dapat dibatalkan.', { name: deletingUser.name })
                        : ''
                }
                variant="danger"
                confirmLabel={t('Hapus')}
                loading={deleteProcessing}
            />

            {/* Bulk delete */}
            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                onConfirm={confirmBulkDelete}
                title={t('Hapus {{count}} Pengguna', { count: selected.length })}
                description={t('Tindakan ini akan menghapus semua pengguna yang dipilih secara permanen. Lanjutkan?')}
                variant="danger"
                confirmLabel={t('Hapus Semua')}
                loading={deleteProcessing}
            />
        </>
    );
}

UsersIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
