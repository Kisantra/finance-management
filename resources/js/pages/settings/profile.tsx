import { Head, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, Mail, ShieldOff, User as UserIcon } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

interface ProfileUser {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
    must_verify_email: boolean;
}

interface Props extends SharedProps {
    user: ProfileUser;
    status: string | null;
}

export default function ProfileSettings() {
    const { user, status } = usePage<Props>().props;

    const { data, setData, patch, processing, errors, recentlySuccessful } = useForm({
        name: user.name,
        email: user.email,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(companyUrl('/settings/profile'), {
            preserveScroll: true,
            onSuccess: () => toast.success('Profil berhasil diperbarui.'),
            onError: () => toast.error('Periksa kembali isian form.'),
        });
    };

    const resendVerification = () => {
        // POST to verification.send route
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/email/verification-notification';
        const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = '_token';
        csrfInput.value = csrf;
        form.appendChild(csrfInput);
        document.body.appendChild(form);
        form.submit();
    };

    return (
        <>
            <Head title="Pengaturan Profil" />

            <SettingsLayout title="Profil" description="Perbarui informasi profil dan alamat email akun Anda">
                <form onSubmit={submit} className="space-y-5 max-w-xl">
                    <Input
                        label="Nama Lengkap *"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        error={errors.name}
                        icon={<UserIcon className="w-4 h-4" />}
                        autoComplete="name"
                        autoFocus
                    />

                    <Input
                        label="Email *"
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={errors.email}
                        icon={<Mail className="w-4 h-4" />}
                        autoComplete="email"
                    />

                    {user.must_verify_email && user.email_verified_at === null && (
                        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                                <div className="flex-1 text-sm text-yellow-900 dark:text-yellow-100">
                                    <p>Alamat email Anda belum diverifikasi.</p>
                                    <button
                                        type="button"
                                        onClick={resendVerification}
                                        className="mt-2 font-medium underline hover:no-underline text-yellow-700 dark:text-yellow-200"
                                    >
                                        Kirim ulang email verifikasi
                                    </button>
                                    {status === 'verification-link-sent' && (
                                        <p className="mt-2 text-green-700 dark:text-green-400 font-medium">
                                            Email verifikasi baru telah dikirim.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <Button type="submit" variant="primary" loading={processing}>
                            Simpan Perubahan
                        </Button>
                        {recentlySuccessful && (
                            <span className="text-sm text-green-600 dark:text-green-400">Tersimpan</span>
                        )}
                    </div>
                </form>

                <DeleteAccountSection />
            </SettingsLayout>
        </>
    );
}

ProfileSettings.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

/* ─────────────────────────────────── delete account ─── */

function DeleteAccountSection() {
    const [open, setOpen] = React.useState(false);
    const { data, setData, delete: destroy, processing, errors, reset, clearErrors } = useForm({
        password: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        destroy(companyUrl('/settings/profile'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Akun berhasil dihapus.');
                setOpen(false);
                reset();
            },
            onError: () => {
                toast.error('Kata sandi salah.');
            },
        });
    };

    return (
        <>
            <div className="mt-10 pt-8 border-t border-secondary-200 dark:border-dark-600">
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-5">
                    <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                        <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                                <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-red-900 dark:text-red-100">Hapus Akun</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1 max-w-md">
                                    Setelah akun dihapus, seluruh data Anda akan hilang permanen. Pastikan Anda telah mengunduh data yang ingin disimpan.
                                </p>
                            </div>
                        </div>
                        <Button variant="red" onClick={() => setOpen(true)}>
                            Hapus Akun
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog
                open={open}
                onOpenChange={(o) => {
                    if (!o) {
                        clearErrors();
                        reset();
                    }
                    setOpen(o);
                }}
            >
                <DialogContent size="md" className="p-0 overflow-hidden">
                    <form onSubmit={submit}>
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                                    <ShieldOff className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold text-dark-900 dark:text-dark-50">
                                        Konfirmasi Hapus Akun
                                    </DialogTitle>
                                    <p className="text-sm text-dark-500 dark:text-dark-400">Tindakan ini tidak dapat dibatalkan</p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="px-6 py-4 space-y-4">
                            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-700 dark:text-red-300">
                                Masukkan kata sandi Anda untuk mengonfirmasi penghapusan akun permanen.
                            </div>
                            <Input
                                label="Kata Sandi *"
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                error={errors.password}
                                placeholder="Kata sandi saat ini"
                                autoFocus
                                autoComplete="current-password"
                            />
                        </div>

                        <DialogFooter className="px-6 py-4 border-t border-secondary-200 dark:border-dark-600 bg-zinc-50/50 dark:bg-dark-800/30">
                            <Button type="button" variant="zinc" onClick={() => setOpen(false)} disabled={processing} className="w-full sm:w-auto order-2 sm:order-1">
                                Batal
                            </Button>
                            <Button type="submit" variant="red" loading={processing} className="w-full sm:w-auto order-1 sm:order-2">
                                Hapus Akun Saya
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
