import { Head, router, usePage } from '@inertiajs/react';
import { Building2, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SharedProps } from '@/types';

/**
 * Tampil untuk user tanpa izin `manage company profile` selama profil perusahaan belum
 * lengkap (EnsureCompanyProfileComplete). Admin diarahkan ke form profil, bukan ke sini.
 */
export default function CompanyNotReady() {
    const { company, companies } = usePage<SharedProps>().props;

    return (
        <>
            <Head title="Perusahaan belum disiapkan" />
            <div className="flex min-h-screen items-center justify-center bg-secondary-50 px-4 dark:bg-dark-950">
                <div className="w-full max-w-md space-y-6">
                    <Card>
                        <CardContent className="space-y-4 p-6 text-center">
                            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-secondary-100 dark:bg-dark-600">
                                <Building2 className="size-6 text-secondary-600 dark:text-dark-300" />
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-lg font-semibold text-secondary-900 dark:text-dark-200">
                                    {company?.name ?? 'Perusahaan ini'} belum disiapkan
                                </h1>
                                <p className="text-sm text-secondary-600 dark:text-dark-400">
                                    Admin perlu melengkapi profil perusahaan lebih dulu: nama, singkatan, alamat, kontak,
                                    dan penanggung jawab keuangan. Hubungi admin perusahaan Anda, lalu muat ulang halaman ini.
                                </p>
                            </div>
                            <Button variant="primary" onClick={() => router.reload()}>
                                <RefreshCw className="size-4" />
                                Muat ulang
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-center gap-2">
                        {companies.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => router.visit('/choose-company')}>
                                Pilih perusahaan lain
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => router.post('/logout')}>
                            <LogOut className="size-4" />
                            Keluar
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
