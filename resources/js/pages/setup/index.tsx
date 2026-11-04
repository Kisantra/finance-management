import { Head, useForm, usePage } from '@inertiajs/react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { SharedProps } from '@/types';

/**
 * Walkthrough instalasi baru (SetupController): akun admin pertama + perusahaan pertama.
 * Sesudahnya admin dibawa ke Profil Perusahaan yang wajib dilengkapi sebelum aplikasi dipakai.
 */

interface Props {
    unlocked: boolean;
    appUrl: string;
}

interface SetupForm {
    admin_name: string;
    admin_email: string;
    admin_password: string;
    admin_password_confirmation: string;
    company_name: string;
    slug: string;
    abbreviation: string;
}

const LEGAL = /^(pt|cv|ud|pd|tb)\.?\s+/i;

function suggestSlug(name: string): string {
    return name
        .replace(LEGAL, '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

function suggestAbbreviation(name: string): string {
    return name
        .replace(LEGAL, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase())
        .join('')
        .slice(0, 10);
}

export default function Setup({ unlocked, appUrl }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const form = useForm<SetupForm>({
        admin_name: '',
        admin_email: '',
        admin_password: '',
        admin_password_confirmation: '',
        company_name: '',
        slug: '',
        abbreviation: '',
    });
    const { data, setData, errors } = form;
    // Saran otomatis berhenti begitu pengguna mengubah isiannya sendiri.
    const [slugTouched, setSlugTouched] = React.useState(false);
    const [abbrTouched, setAbbrTouched] = React.useState(false);

    const onCompanyName = (value: string) => {
        setData((current) => ({
            ...current,
            company_name: value,
            slug: slugTouched ? current.slug : suggestSlug(value),
            abbreviation: abbrTouched ? current.abbreviation : suggestAbbreviation(value),
        }));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/setup', { preserveScroll: true });
    };

    return (
        <>
            <Head title="Pemasangan" />
            <div className="flex min-h-screen items-center justify-center bg-secondary-50 px-4 py-10 dark:bg-dark-950">
                <div className="w-full max-w-xl space-y-6">
                    <div className="space-y-1 text-center">
                        <h1 className="text-xl font-semibold text-secondary-900 dark:text-dark-200">Pemasangan aplikasi</h1>
                        <p className="text-sm text-secondary-500 dark:text-dark-400">
                            Dua langkah: akun admin pertama, lalu perusahaan pertama. Sesudahnya Anda melengkapi profil perusahaan.
                        </p>
                    </div>

                    {!unlocked ? (
                        <Card>
                            <CardContent className="space-y-2 p-6 text-sm text-secondary-700 dark:text-dark-300">
                                <p className="font-semibold text-secondary-900 dark:text-dark-200">Buka tautan pemasangan</p>
                                <p>
                                    Halaman ini hanya bisa dibuka lewat tautan sekali pakai yang dicetak <span className="font-mono">deploy.sh</span>{' '}
                                    di akhir instalasi (bentuknya <span className="font-mono">{appUrl}/setup/…</span>).
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <form onSubmit={submit} className="space-y-6">
                            {flash?.error && (
                                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                                    {flash.error}
                                </p>
                            )}

                            <Card>
                                <CardContent className="space-y-4 p-6">
                                    <h2 className="font-semibold text-secondary-900 dark:text-dark-200">1. Akun admin</h2>
                                    <Input label="Nama lengkap *" value={data.admin_name} onChange={(e) => setData('admin_name', e.target.value)} error={errors.admin_name} />
                                    <Input
                                        label="Email *"
                                        type="email"
                                        value={data.admin_email}
                                        onChange={(e) => setData('admin_email', e.target.value)}
                                        error={errors.admin_email}
                                        hint="Dipakai untuk masuk."
                                    />
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Input
                                            label="Kata sandi *"
                                            type="password"
                                            value={data.admin_password}
                                            onChange={(e) => setData('admin_password', e.target.value)}
                                            error={errors.admin_password}
                                            hint="Minimal 8 karakter."
                                        />
                                        <Input
                                            label="Ulangi kata sandi *"
                                            type="password"
                                            value={data.admin_password_confirmation}
                                            onChange={(e) => setData('admin_password_confirmation', e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="space-y-4 p-6">
                                    <h2 className="font-semibold text-secondary-900 dark:text-dark-200">2. Perusahaan pertama</h2>
                                    <Input
                                        label="Nama perusahaan *"
                                        value={data.company_name}
                                        onChange={(e) => onCompanyName(e.target.value)}
                                        error={errors.company_name}
                                        placeholder="PT Nama Perusahaan"
                                    />
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
                                        <Input
                                            label="Kode URL *"
                                            value={data.slug}
                                            onChange={(e) => {
                                                setSlugTouched(true);
                                                setData('slug', e.target.value.toLowerCase());
                                            }}
                                            error={errors.slug}
                                            hint={`Alamat: ${appUrl}/c/${data.slug || 'kode'}/dashboard. PERMANEN, tidak bisa diganti.`}
                                        />
                                        <Input
                                            label="Singkatan *"
                                            value={data.abbreviation}
                                            onChange={(e) => {
                                                setAbbrTouched(true);
                                                setData('abbreviation', e.target.value.toUpperCase());
                                            }}
                                            error={errors.abbreviation}
                                            maxLength={10}
                                            hint="Kode di nomor invoice."
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Button type="submit" variant="primary" className="w-full" loading={form.processing}>
                                Pasang & masuk
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </>
    );
}
