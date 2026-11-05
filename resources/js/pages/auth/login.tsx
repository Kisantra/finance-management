import { Head, useForm } from '@inertiajs/react';
import * as React from 'react';
import { AuthLink, AuthStatus, PasswordInput } from '@/components/auth/auth-form';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

interface Props {
    status?: string;
}

export default function Login({ status }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post('/login', { onFinish: () => reset('password') });
    }

    return (
        <>
            <Head title="Masuk" />

            <PageHeader title="Selamat datang kembali" description="Masuk ke akun Anda untuk melanjutkan" />

            {status && <AuthStatus className="mt-6">{status}</AuthStatus>}

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                <Input
                    label="Alamat email"
                    type="email"
                    placeholder="nama@perusahaan.com"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    autoComplete="email"
                    autoFocus
                    required
                />

                <PasswordInput
                    label="Kata sandi"
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="current-password"
                    required
                />

                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <div className="flex items-center gap-2.5">
                        <Checkbox
                            id="remember"
                            checked={data.remember}
                            onCheckedChange={(checked) => setData('remember', !!checked)}
                        />
                        <Label htmlFor="remember" className="cursor-pointer select-none">
                            Ingat saya selama 30 hari
                        </Label>
                    </div>
                    <AuthLink href="/forgot-password" className="text-[13px]">
                        Lupa kata sandi?
                    </AuthLink>
                </div>

                <Button type="submit" variant="primary" size="lg" loading={processing} className="mt-1 w-full">
                    Masuk ke Dasbor
                </Button>
            </form>
        </>
    );
}

Login.layout = (page: React.ReactNode) => <AuthLayout>{page}</AuthLayout>;
