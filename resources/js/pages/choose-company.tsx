import { Head, router, usePage } from '@inertiajs/react';
import { Building2, ChevronRight, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CompanyOption, SharedProps } from '@/types';

interface Props {
    companies: CompanyOption[];
}

export default function ChooseCompany({ companies }: Props) {
    const { auth } = usePage<SharedProps>().props;

    return (
        <>
            <Head title="Pilih Perusahaan" />
            <div className="flex min-h-screen items-center justify-center bg-secondary-50 px-4 dark:bg-dark-950">
                <div className="w-full max-w-md space-y-6">
                    <div className="space-y-1 text-center">
                        <h1 className="text-xl font-semibold text-secondary-900 dark:text-dark-200">
                            Pilih Perusahaan
                        </h1>
                        <p className="text-sm text-secondary-500 dark:text-dark-400">
                            {auth.user?.name}, pilih perusahaan yang ingin Anda kelola
                        </p>
                    </div>

                    <Card>
                        <CardContent className="divide-y divide-secondary-200 p-0 dark:divide-dark-500">
                            {companies.map((company) => (
                                <a
                                    key={company.slug}
                                    href={`/c/${company.slug}/dashboard`}
                                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary-50 dark:hover:bg-dark-600"
                                >
                                    <Avatar>
                                        <AvatarFallback>
                                            <Building2 className="size-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-secondary-900 dark:text-dark-200">
                                            {company.name}
                                        </p>
                                        <p className="text-xs text-secondary-500 dark:text-dark-400">
                                            {company.abbreviation}
                                        </p>
                                    </div>
                                    <ChevronRight className="size-4 text-secondary-400 dark:text-dark-400" />
                                </a>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="text-center">
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
