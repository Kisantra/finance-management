import { Head, useForm } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { AuthIcon, PasswordInput } from '@/components/auth/auth-form';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ password: '' });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post('/confirm-password', { onFinish: () => reset('password') });
    }

    return (
        <>
            <Head title="Konfirmasi Kata Sandi" />

            <AuthIcon>
                <ShieldCheck className="h-5 w-5" />
            </AuthIcon>

            <PageHeader
                title="Konfirmasi kata sandi"
                description="Ini adalah area aman dari aplikasi. Harap konfirmasi kata sandi Anda sebelum melanjutkan."
            />

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                <PasswordInput
                    label="Kata sandi"
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="current-password"
                    autoFocus
                    required
                />

                <Button type="submit" variant="primary" size="lg" loading={processing} className="mt-1 w-full">
                    Konfirmasi
                </Button>
            </form>
        </>
    );
}

ConfirmPassword.layout = (page: React.ReactNode) => <AuthLayout>{page}</AuthLayout>;
