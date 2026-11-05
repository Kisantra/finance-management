import { Head, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import * as React from 'react';
import { AuthLink, PasswordInput } from '@/components/auth/auth-form';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AuthLayout from '@/layouts/auth-layout';

interface Props {
    token: string;
    email: string;
}

export default function ResetPassword({ token, email }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post('/reset-password', {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    }

    return (
        <>
            <Head title="Atur Ulang Kata Sandi" />

            <PageHeader title="Atur ulang kata sandi" description="Buat kata sandi baru yang kuat untuk akun Anda." />

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                <Input
                    label="Alamat email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    autoComplete="email"
                    required
                />

                <PasswordInput
                    label="Kata sandi baru"
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="new-password"
                    required
                />

                <PasswordInput
                    label="Konfirmasi kata sandi"
                    placeholder="••••••••"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation}
                    autoComplete="new-password"
                    required
                />

                <Button type="submit" variant="primary" size="lg" loading={processing} className="mt-1 w-full">
                    Simpan Kata Sandi Baru
                </Button>
            </form>

            <div className="mt-6 flex justify-center">
                <AuthLink href="/login" className="inline-flex items-center gap-1.5 text-[13px] text-ob-ink-2 hover:text-ob-ink">
                    <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                    Kembali ke halaman masuk
                </AuthLink>
            </div>
        </>
    );
}

ResetPassword.layout = (page: React.ReactNode) => <AuthLayout>{page}</AuthLayout>;
