import { Head, useForm } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';
import * as React from 'react';
import { AuthIcon, AuthStatus } from '@/components/auth/auth-form';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';

interface Props {
    status?: string;
}

export default function VerifyEmail({ status }: Props) {
    const { post: resend, processing: resending } = useForm({});
    const { post: logout, processing: loggingOut } = useForm({});

    function handleResend(e: React.FormEvent) {
        e.preventDefault();
        resend('/email/verification-notification');
    }

    function handleLogout(e: React.FormEvent) {
        e.preventDefault();
        logout('/logout');
    }

    return (
        <>
            <Head title="Verifikasi Email" />

            <AuthIcon>
                <MailCheck className="h-5 w-5" />
            </AuthIcon>

            {/* Akun dibuat oleh admin, jadi tanpa "terima kasih telah mendaftar". */}
            <PageHeader
                title="Verifikasi email Anda"
                description="Sebelum memulai, verifikasi alamat email Anda lewat tautan yang baru saja kami kirimkan. Belum menerima email? Kirim ulang di bawah."
            />

            {status === 'verification-link-sent' && (
                <AuthStatus className="mt-6">Tautan verifikasi baru telah dikirimkan ke alamat email Anda.</AuthStatus>
            )}

            <div className="mt-8 flex flex-col gap-3">
                <form onSubmit={handleResend}>
                    <Button type="submit" variant="primary" size="lg" loading={resending} className="w-full">
                        Kirim Ulang Email Verifikasi
                    </Button>
                </form>

                <form onSubmit={handleLogout}>
                    <Button type="submit" variant="outline" size="lg" loading={loggingOut} className="w-full">
                        Keluar
                    </Button>
                </form>
            </div>
        </>
    );
}

VerifyEmail.layout = (page: React.ReactNode) => <AuthLayout>{page}</AuthLayout>;
