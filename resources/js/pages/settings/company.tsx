import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Building2,
    FileImage,
    Image as ImageIcon,
    Info,
    Mail,
    MapPin,
    Phone,
    Receipt,
    Stamp,
    Trash2,
    UserCog,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FileUpload } from '@/components/shared/file-upload';
import { FormSection } from '@/components/shared/form-section';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { companyUrl } from '@/lib/company';
import { cn } from '@/lib/utils';
import type { SharedProps } from '@/types';

interface Company {
    id: number;
    name: string;
    address: string;
    email: string;
    phone: string;
    is_pkp: boolean;
    npwp: string | null;
    ppn_rate: number;
    finance_manager_name: string;
    finance_manager_position: string;
    bank_accounts: unknown[];
    logo_path: string | null;
    letter_head_path: string | null;
    signature_path: string | null;
    stamp_path: string | null;
    logo_url: string | null;
    letter_head_url: string | null;
    signature_url: string | null;
    stamp_url: string | null;
}

interface Props extends SharedProps {
    company: Company | null;
}

interface CompanyFormData {
    name: string;
    address: string;
    email: string;
    phone: string;
    is_pkp: boolean;
    npwp: string;
    ppn_rate: string;
    finance_manager_name: string;
    finance_manager_position: string;
    logo: File | null;
    letter_head: File | null;
    signature: File | null;
    stamp: File | null;
}

type AssetKey = 'logo' | 'letter_head' | 'signature' | 'stamp';

const ASSET_META: Record<AssetKey, { label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
    logo: { label: 'Logo Perusahaan', description: 'Tampil di header invoice dan navigasi', icon: ImageIcon, color: 'blue' },
    letter_head: { label: 'Kop Surat', description: 'Tampil di header dokumen formal', icon: FileImage, color: 'purple' },
    signature: { label: 'Tanda Tangan', description: 'Tampil di area tanda tangan PDF invoice', icon: UserCog, color: 'green' },
    stamp: { label: 'Stempel', description: 'Tampil di samping tanda tangan PDF invoice', icon: Stamp, color: 'orange' },
};

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
};

export default function CompanySettings() {
    const { company } = usePage<Props>().props;

    const { data, setData, post, processing, errors, recentlySuccessful } = useForm<CompanyFormData>({
        name: company?.name ?? '',
        address: company?.address ?? '',
        email: company?.email ?? '',
        phone: company?.phone ?? '',
        is_pkp: company?.is_pkp ?? false,
        npwp: company?.npwp ?? '',
        ppn_rate: String(company?.ppn_rate ?? 11),
        finance_manager_name: company?.finance_manager_name ?? '',
        finance_manager_position: company?.finance_manager_position ?? '',
        logo: null,
        letter_head: null,
        signature: null,
        stamp: null,
    });

    const [previewAsset, setPreviewAsset] = React.useState<AssetKey | null>(null);
    const [deletingAsset, setDeletingAsset] = React.useState<AssetKey | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(companyUrl('/settings/company'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                toast.success('Profil perusahaan berhasil diperbarui.');
                setData({
                    ...data,
                    logo: null,
                    letter_head: null,
                    signature: null,
                    stamp: null,
                });
            },
            onError: () => toast.error('Periksa kembali isian form.'),
        });
    };

    const confirmDeleteAsset = () => {
        if (!deletingAsset) return;
        setDeleteProcessing(true);
        router.delete(companyUrl(`/settings/company/assets/${deletingAsset}`), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('File berhasil dihapus.');
                setDeletingAsset(null);
            },
            onError: () => toast.error('Gagal menghapus file.'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    return (
        <>
            <Head title="Profil Perusahaan" />

            <SettingsLayout
                title="Profil Perusahaan"
                description="Atur identitas perusahaan yang tampil di invoice, dokumen, dan komunikasi formal"
            >
                <form onSubmit={submit} className="space-y-6">
                    {/* Section: Identitas */}
                    <FormSection title="Identitas Perusahaan" description="Nama, alamat, dan informasi kontak utama">
                        <Input
                            label="Nama Perusahaan *"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={errors.name}
                            icon={<Building2 className="w-4 h-4" />}
                            placeholder="PT. Nama Perusahaan"
                        />
                        <Textarea
                            label="Alamat *"
                            value={data.address}
                            onChange={(e) => setData('address', e.target.value)}
                            error={errors.address}
                            rows={3}
                            placeholder="Alamat lengkap perusahaan"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Email *"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                error={errors.email}
                                icon={<Mail className="w-4 h-4" />}
                                placeholder="info@perusahaan.com"
                            />
                            <Input
                                label="Telepon *"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={errors.phone}
                                icon={<Phone className="w-4 h-4" />}
                                placeholder="021-xxxxxxx"
                            />
                        </div>
                    </FormSection>

                    {/* Section: Finance Manager */}
                    <FormSection title="Penanggung Jawab Keuangan" description="Nama yang tertera pada tanda tangan invoice">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Nama Finance Manager *"
                                value={data.finance_manager_name}
                                onChange={(e) => setData('finance_manager_name', e.target.value)}
                                error={errors.finance_manager_name}
                                placeholder="Nama lengkap"
                            />
                            <Input
                                label="Jabatan *"
                                value={data.finance_manager_position}
                                onChange={(e) => setData('finance_manager_position', e.target.value)}
                                error={errors.finance_manager_position}
                                placeholder="Misal: Finance Manager"
                            />
                        </div>
                    </FormSection>

                    {/* Section: PKP & Pajak */}
                    <FormSection title="Status PKP & Pajak" description="Pengaturan untuk perhitungan PPN di invoice">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <Checkbox
                                checked={data.is_pkp}
                                onCheckedChange={(c) => setData('is_pkp', Boolean(c))}
                            />
                            <span className="text-sm text-dark-900 dark:text-dark-50">
                                Perusahaan adalah <strong>Pengusaha Kena Pajak (PKP)</strong>
                            </span>
                        </label>

                        {data.is_pkp && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="NPWP"
                                    value={data.npwp}
                                    onChange={(e) => setData('npwp', e.target.value)}
                                    error={errors.npwp}
                                    icon={<Receipt className="w-4 h-4" />}
                                    placeholder="XX.XXX.XXX.X-XXX.XXX"
                                />
                                <Input
                                    label="Tarif PPN (%) *"
                                    type="number"
                                    step="0.01"
                                    value={data.ppn_rate}
                                    onChange={(e) => setData('ppn_rate', e.target.value)}
                                    error={errors.ppn_rate}
                                    placeholder="11"
                                />
                            </div>
                        )}
                    </FormSection>

                    {/* Section: Visual Assets */}
                    <FormSection title="Aset Visual" description="Logo, kop surat, tanda tangan, dan stempel untuk dokumen">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Object.keys(ASSET_META) as AssetKey[]).map((key) => {
                                const meta = ASSET_META[key];
                                const Icon = meta.icon;
                                const colors = COLOR_MAP[meta.color];
                                const currentUrl = company?.[`${key}_url` as keyof Company] as string | null;
                                const file = data[key];

                                return (
                                    <div
                                        key={key}
                                        className="rounded-xl border border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-800/40 p-4 space-y-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
                                                <Icon className={cn('w-5 h-5', colors.text)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-dark-900 dark:text-dark-50">{meta.label}</h4>
                                                <p className="text-xs text-dark-500 dark:text-dark-400 truncate">{meta.description}</p>
                                            </div>
                                        </div>

                                        {currentUrl && (
                                            <div className="rounded-lg bg-secondary-50/80 dark:bg-dark-800 p-2 flex items-center justify-between gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewAsset(key)}
                                                    className="flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
                                                >
                                                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">Lihat file saat ini</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeletingAsset(key)}
                                                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1"
                                                    title="Hapus file"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        <FileUpload
                                            value={file}
                                            onChange={(f) => setData(key, f)}
                                            accept={['.jpg', '.jpeg', '.png']}
                                            maxSizeMb={2}
                                            error={errors[key]}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </FormSection>

                    {company?.logo_url && (
                        <div className="rounded-xl border border-primary-200 dark:border-primary-900/50 bg-primary-50/70 dark:bg-primary-950/20 p-4 flex items-start gap-3">
                            <Info className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                            <div className="flex-1 text-xs text-primary-900 dark:text-primary-200">
                                <p className="font-semibold mb-1">Regenerasi Favicon</p>
                                <p className="mb-2">Setelah mengganti logo, jalankan perintah berikut untuk regenerate favicon:</p>
                                <code className="block px-3 py-2 bg-white dark:bg-dark-900 rounded-lg text-xs font-mono text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                                    php artisan favicon:generate
                                </code>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-4 border-t border-secondary-200 dark:border-dark-600">
                        <Button type="submit" variant="primary" loading={processing}>
                            Simpan Perubahan
                        </Button>
                        {recentlySuccessful && (
                            <span className="text-sm text-green-600 dark:text-green-400">Tersimpan</span>
                        )}
                    </div>
                </form>
            </SettingsLayout>

            {/* Preview Dialog */}
            <Dialog open={previewAsset !== null} onOpenChange={(o) => !o && setPreviewAsset(null)}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>
                            {previewAsset ? ASSET_META[previewAsset].label : ''}
                        </DialogTitle>
                    </DialogHeader>
                    {previewAsset && company && (
                        <div className="p-4 bg-secondary-50 dark:bg-dark-800 rounded-xl">
                            <img
                                src={company[`${previewAsset}_url` as keyof Company] as string}
                                alt={ASSET_META[previewAsset].label}
                                className="w-full max-h-[60vh] object-contain"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete asset confirm */}
            <ConfirmDialog
                open={deletingAsset !== null}
                onOpenChange={(o) => !o && setDeletingAsset(null)}
                onConfirm={confirmDeleteAsset}
                title={deletingAsset ? `Hapus ${ASSET_META[deletingAsset].label}?` : 'Hapus File'}
                description="File akan dihapus permanen dari sistem dan tidak dapat dikembalikan."
                variant="danger"
                confirmLabel="Hapus File"
                loading={deleteProcessing}
            />
        </>
    );
}

CompanySettings.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
