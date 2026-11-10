import { Head, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import * as React from 'react';
import { AuthLink, AuthStatus } from '@/components/auth/auth-form';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import AuthLayout from '@/layouts/auth-layout';

interface Props {
    status?: string;
}

export default function ForgotPassword({ status }: Props) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post('/forgot-password');
    }

    return (
        <>
            <Head title={t('Lupa Kata Sandi')} />

            <PageHeader
                title={t('Lupa kata sandi?')}
                description={t('Masukkan email Anda dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi.')}
            />

            {status && <AuthStatus className="mt-6">{status}</AuthStatus>}

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
                <Input
                    label={t('Alamat email')}
                    type="email"
                    placeholder={t('nama@perusahaan.com')}
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    autoComplete="email"
                    autoFocus
                    required
                />

                <Button type="submit" variant="primary" size="lg" loading={processing} className="mt-1 w-full">
                    {t('Kirim Tautan Atur Ulang')}
                </Button>
            </form>

            <div className="mt-6 flex justify-center">
                <AuthLink href="/login" className="inline-flex items-center gap-1.5 text-[13px] text-ob-ink-2 hover:text-ob-ink">
                    <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                    {t('Kembali ke halaman masuk')}
                </AuthLink>
            </div>
        </>
    );
}

ForgotPassword.layout = (page: React.ReactNode) => <AuthLayout>{page}</AuthLayout>;
