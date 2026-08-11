import { Head, router, useForm } from '@inertiajs/react';
import { Building2, CheckCircle2, Loader2, Plus, RotateCcw, XCircle } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { StatsCard } from '@/components/shared/stats-card';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { toastErrors } from '@/lib/utils';

interface CompanyRow {
    slug: string;
    name: string;
    abbreviation: string;
    status: 'provisioning' | 'active' | 'failed';
    members_count: number;
    created_at: string | null;
    is_current: boolean;
}

interface Props {
    companies: CompanyRow[];
    quota: { used: number; total: number };
    organizationName: string;
}

const STATUS_BADGE: Record<CompanyRow['status'], { variant: 'green' | 'yellow' | 'red'; label: string; icon: React.ReactNode }> = {
    active: { variant: 'green', label: 'Aktif', icon: <CheckCircle2 className="w-3 h-3" /> },
    provisioning: { variant: 'yellow', label: 'Provisioning', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    failed: { variant: 'red', label: 'Gagal', icon: <XCircle className="w-3 h-3" /> },
};

export default function CompaniesIndex({ companies, quota, organizationName }: Props) {
    const [createOpen, setCreateOpen] = React.useState(false);
    const [retryingSlug, setRetryingSlug] = React.useState<string | null>(null);

    const form = useForm({ name: '', slug: '', abbreviation: '' });
    const quotaFull = quota.used >= quota.total;

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post(companyUrl('/admin/companies'), {
            preserveScroll: true,
            onSuccess: () => {
                setCreateOpen(false);
                form.reset();
            },
            onError: (errors) => toastErrors(errors),
        });
    }

    function retry(slug: string) {
        setRetryingSlug(slug);
        router.post(companyUrl(`/admin/companies/${slug}/retry`), {}, {
            preserveScroll: true,
            onFinish: () => setRetryingSlug(null),
            onError: (errors) => toastErrors(errors),
        });
    }

    return (
        <AppLayout>
            <Head title="Perusahaan" />
            <div className="space-y-6">
                <PageHeader
                    title="Perusahaan"
                    description={`Provisioning perusahaan di organization ${organizationName} — setiap perusahaan mendapat database terpisah`}
                    action={
                        <Button onClick={() => setCreateOpen(true)} disabled={quotaFull}>
                            <Plus className="w-4 h-4" />
                            Perusahaan Baru
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatsCard
                        label="Perusahaan"
                        value={`${quota.used} / ${quota.total}`}
                        icon={<Building2 className="w-6 h-6" />}
                        color={quotaFull ? 'orange' : 'blue'}
                    />
                    <StatsCard
                        label="Aktif"
                        value={companies.filter((c) => c.status === 'active').length}
                        icon={<CheckCircle2 className="w-6 h-6" />}
                        color="green"
                    />
                </div>

                <div className="bg-white dark:bg-dark-700 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-secondary-200 dark:border-dark-600 text-left text-xs uppercase tracking-wide text-secondary-500 dark:text-dark-400">
                                    <th className="px-4 py-3">Perusahaan</th>
                                    <th className="px-4 py-3">Kode URL</th>
                                    <th className="px-4 py-3">Singkatan</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Anggota</th>
                                    <th className="px-4 py-3">Dibuat</th>
                                    <th className="px-4 py-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-100 dark:divide-dark-600">
                                {companies.map((company) => {
                                    const badge = STATUS_BADGE[company.status];
                                    return (
                                        <tr key={company.slug} className="text-secondary-800 dark:text-dark-300">
                                            <td className="px-4 py-3 font-medium">
                                                {company.name}
                                                {company.is_current && (
                                                    <Badge variant="blue" className="ml-2">Sedang dibuka</Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">/c/{company.slug}</td>
                                            <td className="px-4 py-3">{company.abbreviation}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={badge.variant} className="inline-flex items-center gap-1">
                                                    {badge.icon}
                                                    {badge.label}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">{company.members_count}</td>
                                            <td className="px-4 py-3">{company.created_at ?? '—'}</td>
                                            <td className="px-4 py-3 text-right">
                                                {company.status === 'failed' && (
                                                    <Button
                                                        variant="yellow"
                                                        size="sm"
                                                        disabled={retryingSlug === company.slug}
                                                        onClick={() => retry(company.slug)}
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        Coba Ulang
                                                    </Button>
                                                )}
                                                {company.status === 'active' && !company.is_current && (
                                                    <Button variant="outline" size="sm" asChild>
                                                        <a href={`/c/${company.slug}/dashboard`}>Buka</a>
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent size="md">
                    <DialogHeader>
                        <DialogTitle>Perusahaan Baru</DialogTitle>
                        <DialogDescription>
                            Provisioning membuat database baru dan memakan beberapa detik. Kode URL & singkatan bersifat permanen.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submit} className="space-y-4">
                        <Input
                            label="Nama Perusahaan"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            error={form.errors.name}
                            placeholder="PT Kinara Sejahtera"
                        />
                        <Input
                            label="Kode URL (permanen)"
                            value={form.data.slug}
                            onChange={(e) => form.setData('slug', e.target.value.toLowerCase())}
                            error={form.errors.slug}
                            placeholder="pt-kinara"
                            hint="Huruf kecil, angka, strip — menjadi alamat /c/{kode} dan tidak bisa diubah"
                        />
                        <Input
                            label="Singkatan Dokumen (permanen)"
                            value={form.data.abbreviation}
                            onChange={(e) => form.setData('abbreviation', e.target.value.toUpperCase())}
                            error={form.errors.abbreviation}
                            placeholder="KNR"
                            hint="Dipakai pada nomor invoice (mis. 001/INV/KNR-ABC/I/2026) — isi manual, jangan singkatan ambigu"
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Loader2 className="w-4 h-4 animate-spin" />}
                                {form.processing ? 'Provisioning…' : 'Buat Perusahaan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
