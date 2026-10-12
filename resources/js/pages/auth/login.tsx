import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import AuthLayout from '@/layouts/auth-layout';

interface Props {
    status?: string;
}

export default function Login({ status }: Props) {
    const [showPassword, setShowPassword] = React.useState(false);

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

            <div className="space-y-7">
                {/* Heading */}
                <div className="space-y-1.5">
                    <h2 className="text-2xl font-bold text-dark-900 dark:text-dark-50">
                        Selamat datang kembali
                    </h2>
                    <p className="text-sm text-dark-500 dark:text-dark-400">
                        Masuk ke akun Anda untuk melanjutkan
                    </p>
                </div>

                {/* Status flash */}
                {status && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                        {status}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <Input
                        label="Alamat Email"
                        type="email"
                        placeholder="nama@perusahaan.com"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={errors.email}
                        icon={<Mail className="h-4 w-4" />}
                        autoComplete="email"
                        autoFocus
                        required
                    />

                    <div className="space-y-1">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-dark-900 dark:text-dark-300">
                                Kata Sandi
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                            >
                                Lupa kata sandi?
                            </Link>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className={[
                                    'flex h-9 w-full rounded-lg border text-sm transition-colors',
                                    'bg-white dark:bg-dark-800',
                                    'text-dark-900 dark:text-dark-300',
                                    'placeholder:text-dark-400 dark:placeholder:text-dark-400',
                                    'focus:outline-none focus:ring-2 focus:ring-offset-0',
                                    'pr-9 pl-3 py-1.5',
                                    errors.password
                                        ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                                        : 'border-secondary-300 dark:border-dark-600 focus:ring-primary-500',
                                ].join(' ')}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-3 flex items-center text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        {errors.password && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Checkbox
                            id="remember"
                            checked={data.remember}
                            onCheckedChange={(checked) => setData('remember', !!checked)}
                        />
                        <label
                            htmlFor="remember"
                            className="text-sm text-dark-600 dark:text-dark-400 cursor-pointer select-none"
                        >
                            Ingat saya selama 30 hari
                        </label>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={processing}
                        className="w-full mt-2"
                        icon={<LogIn className="h-4 w-4" />}
                    >
                        Masuk ke Dasbor
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-dark-600 dark:text-dark-400">
                    Pengguna baru?{' '}
                    <Link href="/panduan" className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                        Pelajari dulu di Panduan
                    </Link>
                </p>
            </div>
        </>
    );
}

Login.layout = (page: React.ReactNode) => <AuthLayout>{page}</AuthLayout>;
