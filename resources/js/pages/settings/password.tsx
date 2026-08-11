import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { companyUrl } from '@/lib/company';

export default function PasswordSettings() {
    const { data, setData, put, processing, errors, reset, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const [showCurrent, setShowCurrent] = React.useState(false);
    const [showNew, setShowNew] = React.useState(false);
    const [showConfirm, setShowConfirm] = React.useState(false);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(companyUrl('/settings/password'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Kata sandi berhasil diperbarui.');
                reset();
            },
            onError: () => {
                toast.error('Periksa kembali isian form.');
                reset('current_password', 'password', 'password_confirmation');
            },
        });
    };

    const passwordField = (
        label: string,
        field: 'current_password' | 'password' | 'password_confirmation',
        show: boolean,
        toggleShow: () => void,
        placeholder?: string,
        autoComplete?: string,
    ) => (
        <div className="relative">
            <Input
                label={label}
                type={show ? 'text' : 'password'}
                value={data[field]}
                onChange={(e) => setData(field, e.target.value)}
                error={errors[field]}
                icon={<KeyRound className="w-4 h-4" />}
                placeholder={placeholder}
                autoComplete={autoComplete}
            />
            <button
                type="button"
                onClick={toggleShow}
                className="absolute right-3 top-[2.1rem] text-dark-400 hover:text-dark-600 dark:hover:text-dark-200"
                tabIndex={-1}
            >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );

    return (
        <>
            <Head title="Pengaturan Kata Sandi" />

            <SettingsLayout
                title="Kata Sandi"
                description="Pastikan akun menggunakan kata sandi yang kuat dan tidak digunakan di tempat lain"
            >
                <form onSubmit={submit} className="space-y-5 max-w-xl">
                    {passwordField(
                        'Kata Sandi Saat Ini *',
                        'current_password',
                        showCurrent,
                        () => setShowCurrent(!showCurrent),
                        'Kata sandi saat ini',
                        'current-password',
                    )}
                    {passwordField(
                        'Kata Sandi Baru *',
                        'password',
                        showNew,
                        () => setShowNew(!showNew),
                        'Minimal 8 karakter',
                        'new-password',
                    )}
                    {passwordField(
                        'Konfirmasi Kata Sandi Baru *',
                        'password_confirmation',
                        showConfirm,
                        () => setShowConfirm(!showConfirm),
                        'Ulangi kata sandi baru',
                        'new-password',
                    )}

                    <div className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-zinc-50/60 dark:bg-dark-800/40 p-3">
                        <div className="flex items-start gap-2">
                            <ShieldCheck className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-dark-600 dark:text-dark-400">
                                Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol untuk keamanan maksimal.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <Button type="submit" variant="primary" loading={processing}>
                            Perbarui Kata Sandi
                        </Button>
                        {recentlySuccessful && (
                            <span className="text-sm text-green-600 dark:text-green-400">Tersimpan</span>
                        )}
                    </div>
                </form>
            </SettingsLayout>
        </>
    );
}

PasswordSettings.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
