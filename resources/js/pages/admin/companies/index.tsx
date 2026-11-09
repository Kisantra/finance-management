import { Head, router, useForm } from '@inertiajs/react';
import { Check, ChevronDown, Info, Loader2, Plus, RotateCcw, UserPlus } from 'lucide-react';
import * as React from 'react';
import { AppLink } from '@/components/app-link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import { suggestAbbreviation, suggestSlug } from '@/lib/company-name';
import { cn, toastErrors } from '@/lib/utils';
import { CARD, initials, longDate } from '@/pages/invoices/components/ob';

interface Member {
    id: number;
    name: string;
    role: string | null;
}

interface CompanyRow {
    slug: string;
    name: string;
    abbreviation: string;
    status: 'provisioning' | 'active' | 'failed';
    members_count: number;
    members: Member[];
    created_at: string | null;
    is_current: boolean;
    is_member: boolean;
}

interface Preview {
    databasePrefix: string;
    databaseSuffix: string;
    invoiceFormat: string;
    invoicePadding: number;
}

interface Quota {
    used: number;
    total: number;
}

interface Props {
    organizationCompanies: CompanyRow[];
    quota: Quota;
    organizationName: string;
    preview: Preview;
}

interface CompanyForm {
    name: string;
    slug: string;
    abbreviation: string;
}

const STATUS: Record<CompanyRow['status'], { label: string; variant: 'green' | 'yellow' | 'red' }> = {
    active: { label: 'Aktif', variant: 'green' },
    provisioning: { label: 'Sedang dibuat', variant: 'yellow' },
    failed: { label: 'Gagal dibuat', variant: 'red' },
};

const PERAN: Record<string, string> = { admin: 'Admin', 'finance manager': 'Finance Manager', staff: 'Staff' };

function labelPeran(role: string | null): string {
    if (!role) {
        return 'Tanpa peran';
    }

    return PERAN[role] ?? role.replace(/\b\w/g, (huruf) => huruf.toUpperCase());
}

/** Yang terjadi setelah "Buat perusahaan" — sesuai CompanyController::store, TenantDatabaseSeeder, dan gerbang profil. */
const LANGKAH = [
    { otomatis: true, judul: 'Database dibuat', rinci: 'Lengkap dengan seluruh tabelnya. Butuh beberapa detik, dan halaman ini menunggu sampai selesai.' },
    { otomatis: true, judul: 'Data awal diisi', rinci: 'Template kategori transaksi yang sudah ber-grup Laba Rugi, plus profil berisi nama dan singkatan.' },
    { otomatis: true, judul: 'Anda menjadi Admin', rinci: 'Satu-satunya anggota. User lain belum bisa masuk.' },
    {
        otomatis: false,
        judul: 'Lengkapi profil',
        rinci: 'Saat pertama dibuka: alamat, email, telepon, dan penanggung jawab keuangan wajib diisi sebelum menu lain terbuka.',
    },
    { otomatis: false, judul: 'Beri akses user lain', rinci: 'Di Pengguna: edit user, centang perusahaan ini, lalu pilih peran.' },
];

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Nomor invoice pertama perusahaan baru, dirakit seperti InvoiceNumberService::render(). */
function nomorInvoicePertama(format: string, padding: number, singkatan: string, tanggal: Date): string {
    const tahun = String(tanggal.getFullYear());
    const nilai: Record<string, string> = {
        '{NO}': '1'.padStart(padding, '0'),
        '{PT}': singkatan || 'ABC',
        '{KLIEN}': 'KLN',
        '{BLN_ROMAWI}': ROMAWI[tanggal.getMonth()],
        '{BLN}': String(tanggal.getMonth() + 1).padStart(2, '0'),
        '{THN}': tahun,
        '{THN2}': tahun.slice(2),
    };

    return format.replace(/\{[A-Z0-9_]+\}/g, (token) => nilai[token] ?? token);
}

export default function CompaniesIndex({ organizationCompanies: companies, quota, organizationName, preview }: Props) {
    const [createOpen, setCreateOpen] = React.useState(false);
    const [retryingSlug, setRetryingSlug] = React.useState<string | null>(null);
    const quotaFull = quota.used >= quota.total;

    function retry(slug: string) {
        setRetryingSlug(slug);
        router.post(
            companyUrl(`/admin/companies/${slug}/retry`),
            {},
            {
                preserveScroll: true,
                onFinish: () => setRetryingSlug(null),
                onError: (errors) => toastErrors(errors),
            },
        );
    }

    return (
        <>
            <Head title="Perusahaan" />
            <div className="ob-motion flex flex-col gap-6 pt-1">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">Perusahaan</h1>
                        <p className="text-[13px] text-ob-ink-2">
                            {organizationName} · {quota.used} dari {quota.total} perusahaan terpakai
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Button onClick={() => setCreateOpen(true)} disabled={quotaFull} icon={<Plus className="h-4 w-4" />}>
                            Perusahaan baru
                        </Button>
                        {quotaFull && <span className="text-xs text-ob-ink-3">Kuota grup sudah penuh</span>}
                    </div>
                </div>

                <section aria-label="Daftar perusahaan" className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                    {companies.map((company) => (
                        <CompanyCard
                            key={company.slug}
                            company={company}
                            retrying={retryingSlug === company.slug}
                            onRetry={() => retry(company.slug)}
                        />
                    ))}
                </section>

                <AccessCard multiCompany={companies.length > 1} />
            </div>

            <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} quota={quota} preview={preview} />
        </>
    );
}

CompaniesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

function CompanyCard({ company, retrying, onRetry }: { company: CompanyRow; retrying: boolean; onRetry: () => void }) {
    const [showMembers, setShowMembers] = React.useState(false);
    const status = STATUS[company.status];
    const titleId = `perusahaan-${company.slug}`;
    const listId = `anggota-${company.slug}`;
    const faces = company.members.slice(0, 5);
    const more = company.members_count - faces.length;
    const canOpen = company.status === 'active' && !company.is_current;

    return (
        <article aria-labelledby={titleId} className={cn(CARD, 'flex flex-col gap-5')}>
            <div className="flex items-start gap-4">
                <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ob-chip text-sm font-bold text-ob-ink-2"
                >
                    {initials(company.name)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-ob-ink">
                            {company.name}
                        </h2>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {company.is_current && <Badge variant="outline">Sedang dibuka</Badge>}
                    </div>
                    <p className="mt-1 text-[13px] text-ob-ink-2">
                        <span className="font-mono">/c/{company.slug}</span>
                        <span aria-hidden="true"> · </span>Singkatan {company.abbreviation}
                        {company.created_at && (
                            <>
                                <span aria-hidden="true"> · </span>Dibuat {longDate(company.created_at)}
                            </>
                        )}
                    </p>
                </div>
            </div>

            {company.status === 'failed' ? (
                <p className="rounded-2xl bg-ob-inner p-4 text-[13px] text-ob-ink-2">
                    Pembuatan berhenti di tengah jalan, jadi perusahaan ini belum bisa dibuka.{' '}
                    <span className="font-semibold text-ob-ink">Coba ulang</span> membuang database yang setengah jadi, lalu membuatnya dari awal.
                </p>
            ) : (
                <div className="rounded-2xl bg-ob-inner p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            {faces.length > 0 && (
                                <div aria-hidden="true" className="flex shrink-0 -space-x-2">
                                    {faces.map((member) => (
                                        <Avatar key={member.id} className="h-8 w-8 ring-2 ring-ob-inner">
                                            <AvatarFallback className="text-[11px]">{initials(member.name)}</AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {more > 0 && (
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ob-chip text-[11px] font-semibold text-ob-ink-2 ring-2 ring-ob-inner">
                                            +{more}
                                        </span>
                                    )}
                                </div>
                            )}
                            <span className="min-w-0 text-sm text-ob-ink-2">{company.members_count} anggota bisa membuka perusahaan ini</span>
                        </div>
                        {company.members_count > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 self-start sm:self-auto"
                                aria-expanded={showMembers}
                                aria-controls={listId}
                                onClick={() => setShowMembers((shown) => !shown)}
                            >
                                {showMembers ? 'Sembunyikan' : 'Lihat siapa saja'}
                                <ChevronDown
                                    aria-hidden="true"
                                    className={cn('h-3.5 w-3.5 transition-transform duration-150 motion-reduce:transition-none', showMembers && 'rotate-180')}
                                />
                            </Button>
                        )}
                    </div>
                    {showMembers && (
                        <ul id={listId} className="mt-3 max-h-72 divide-y divide-ob-line-soft overflow-y-auto">
                            {company.members.map((member) => (
                                <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="text-[10px]">{initials(member.name)}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate text-sm text-ob-ink">{member.name}</span>
                                    </span>
                                    <Badge variant={member.role ? 'default' : 'outline'}>{labelPeran(member.role)}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {(company.status === 'failed' || canOpen) && (
                <div className="flex flex-wrap items-center justify-end gap-3">
                    {company.status === 'failed' && (
                        <Button
                            onClick={onRetry}
                            disabled={retrying}
                            icon={retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        >
                            {retrying ? 'Membuat ulang…' : 'Coba ulang'}
                        </Button>
                    )}
                    {canOpen &&
                        (company.is_member ? (
                            <Button variant="outline" asChild>
                                {/* <a> biasa, bukan AppLink: tujuannya perusahaan LAIN, dan berpindah
                                    perusahaan memuat ulang halaman penuh (sama dengan pengalih di header). */}
                                <a href={`/c/${company.slug}/dashboard`}>Buka perusahaan</a>
                            </Button>
                        ) : (
                            <span className="text-xs text-ob-ink-3">Anda belum menjadi anggota perusahaan ini</span>
                        ))}
                </div>
            )}
        </article>
    );
}

function AccessCard({ multiCompany }: { multiCompany: boolean }) {
    return (
        <section aria-labelledby="akses-judul" className={cn(CARD, 'flex flex-col gap-4 md:flex-row md:items-center md:justify-between')}>
            <div className="flex items-start gap-4">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ob-chip text-ob-ink-2">
                    <UserPlus className="h-5 w-5" />
                </span>
                <div>
                    <h2 id="akses-judul" className="text-base font-semibold text-ob-ink">
                        Mengatur siapa yang bisa masuk
                    </h2>
                    <p className="mt-1 max-w-2xl text-[13px] text-ob-ink-2">
                        Akses diatur di halaman Pengguna: edit user, centang perusahaannya, lalu pilih peran. Peran itu berlaku di setiap perusahaan
                        yang dicentang.
                        {!multiCompany && ' Pilihan perusahaan muncul di sana setelah grup punya lebih dari satu perusahaan.'}
                    </p>
                </div>
            </div>
            <Button variant="outline" className="shrink-0 self-start md:self-auto" asChild>
                <AppLink href="/admin/users">Buka Pengguna</AppLink>
            </Button>
        </section>
    );
}

function CreateCompanyDialog({
    open,
    onOpenChange,
    quota,
    preview,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quota: Quota;
    preview: Preview;
}) {
    const form = useForm<CompanyForm>({ name: '', slug: '', abbreviation: '' });
    const [slugTouched, setSlugTouched] = React.useState(false);
    const [abbreviationTouched, setAbbreviationTouched] = React.useState(false);
    const [created, setCreated] = React.useState<Pick<CompanyForm, 'name' | 'slug'> | null>(null);
    const host = window.location.host;

    function close(next: boolean) {
        // Pembuatan berjalan sinkron di server; menutup dialog tidak menghentikannya.
        if (form.processing) {
            return;
        }
        onOpenChange(next);
        if (!next) {
            setCreated(null);
            form.clearErrors();
        }
    }

    function changeName(name: string) {
        form.setData((data) => ({
            ...data,
            name,
            slug: slugTouched ? data.slug : suggestSlug(name),
            abbreviation: abbreviationTouched ? data.abbreviation : suggestAbbreviation(name),
        }));
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();
        const snapshot = { name: form.data.name, slug: form.data.slug };
        form.post(companyUrl('/admin/companies'), {
            preserveScroll: true,
            onSuccess: () => {
                setCreated(snapshot);
                form.reset();
                setSlugTouched(false);
                setAbbreviationTouched(false);
            },
            onError: (errors) => toastErrors(errors),
        });
    }

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent size="4xl" className="overflow-hidden p-0">
                {created ? (
                    <CreatedView created={created} host={host} onClose={() => close(false)} />
                ) : (
                    <form onSubmit={submit}>
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <DialogTitle>Perusahaan baru</DialogTitle>
                            <DialogDescription>
                                Setiap perusahaan punya database sendiri. Cukup isi tiga hal ini; sisanya dilengkapi saat perusahaan pertama kali dibuka.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid max-h-[70vh] grid-cols-1 gap-6 overflow-y-auto px-6 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                            <div className="flex flex-col gap-4">
                                <Input
                                    label="Nama perusahaan"
                                    value={form.data.name}
                                    onChange={(event) => changeName(event.target.value)}
                                    error={form.errors.name}
                                    placeholder="PT Semesta Raya"
                                    autoFocus
                                />
                                <Input
                                    label="Kode URL (permanen)"
                                    value={form.data.slug}
                                    onChange={(event) => {
                                        setSlugTouched(true);
                                        form.setData('slug', event.target.value.toLowerCase());
                                    }}
                                    error={form.errors.slug}
                                    placeholder="semesta-raya"
                                    hint="Huruf kecil, angka, dan tanda hubung. Menjadi alamat perusahaan dan tidak bisa diubah."
                                />
                                <Input
                                    label="Singkatan"
                                    value={form.data.abbreviation}
                                    onChange={(event) => {
                                        setAbbreviationTouched(true);
                                        form.setData('abbreviation', event.target.value.toUpperCase());
                                    }}
                                    error={form.errors.abbreviation}
                                    placeholder="SR"
                                    maxLength={10}
                                    hint="Kode perusahaan di nomor invoice. Bisa diubah nanti di Profil Perusahaan."
                                />
                                <p className="flex gap-2.5 rounded-2xl bg-ob-inner p-3.5 text-xs text-ob-ink-2">
                                    <Info aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-ob-ink-3" />
                                    <span>Kode URL tidak bisa diubah, dan perusahaan belum bisa dihapus dari aplikasi. Hindari membuat perusahaan percobaan.</span>
                                </p>
                            </div>

                            <PreviewPanel data={form.data} processing={form.processing} host={host} quota={quota} preview={preview} />
                        </div>

                        <DialogFooter className="border-t border-ob-line px-6 py-4">
                            <Button type="button" variant="outline" onClick={() => close(false)} disabled={form.processing}>
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.processing}
                                icon={form.processing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                            >
                                {form.processing ? 'Membuat perusahaan…' : 'Buat perusahaan'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

function PreviewPanel({
    data,
    processing,
    host,
    quota,
    preview,
}: {
    data: CompanyForm;
    processing: boolean;
    host: string;
    quota: Quota;
    preview: Preview;
}) {
    const name = data.name.trim() || 'Nama perusahaan';
    const slug = data.slug || 'kode-url';

    return (
        <aside aria-label="Pratinjau perusahaan baru" className="flex flex-col gap-5 rounded-2xl bg-ob-inner p-5">
            <div className="flex items-center gap-3">
                <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ob-chip text-[13px] font-bold text-ob-ink-2"
                >
                    {initials(name)}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ob-ink">{name}</p>
                    <p className="text-xs text-ob-ink-3">Pratinjau, berubah mengikuti isian</p>
                </div>
            </div>

            <dl className="grid gap-3 text-[13px]">
                <PreviewRow label="Alamat" value={<span className="break-all font-mono">{`${host}/c/${slug}`}</span>} />
                <PreviewRow
                    label="Invoice pertama"
                    value={
                        <span className="break-all font-mono">
                            {nomorInvoicePertama(preview.invoiceFormat, preview.invoicePadding, data.abbreviation, new Date())}
                        </span>
                    }
                    note="KLN diganti kode klien"
                />
                <PreviewRow
                    label="Data"
                    value="Database sendiri, terpisah dari perusahaan lain"
                    note={`${preview.databasePrefix}${slug}${preview.databaseSuffix}`}
                    noteMono
                />
                <PreviewRow label="Akses awal" value="Hanya Anda, sebagai Admin" />
                <PreviewRow label="Kuota grup" value={`${Math.min(quota.used + 1, quota.total)} dari ${quota.total} terpakai setelah dibuat`} />
            </dl>

            <div aria-live="polite">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ob-ink">
                    {processing && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-ob-ink-2" />}
                    {processing ? 'Sedang dibuat. Jangan tutup halaman ini.' : 'Setelah Anda klik Buat perusahaan'}
                </h3>
                <ol className="mt-3 flex flex-col gap-3">
                    {LANGKAH.map((langkah, index) => (
                        <li key={langkah.judul} className="flex gap-3">
                            <span
                                aria-hidden="true"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ob-chip text-[11px] font-bold text-ob-ink-2"
                            >
                                {index + 1}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-ob-ink">
                                    {langkah.judul}{' '}
                                    <span className="font-normal text-ob-ink-3">· {langkah.otomatis ? 'otomatis' : 'oleh Anda'}</span>
                                </p>
                                <p className="text-xs text-ob-ink-2">{langkah.rinci}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </aside>
    );
}

function PreviewRow({ label, value, note, noteMono }: { label: string; value: React.ReactNode; note?: string; noteMono?: boolean }) {
    return (
        <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3">
            <dt className="text-ob-ink-3">{label}</dt>
            <dd className="min-w-0 text-ob-ink">
                {value}
                {note && <span className={cn('mt-0.5 block text-xs text-ob-ink-3', noteMono && 'break-all font-mono')}>{note}</span>}
            </dd>
        </div>
    );
}

function CreatedView({ created, host, onClose }: { created: Pick<CompanyForm, 'name' | 'slug'>; host: string; onClose: () => void }) {
    return (
        <>
            <div className="flex flex-col gap-6 px-6 pt-6 pb-4">
                <div className="flex items-start gap-4">
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ob-pos/12 text-ob-pos">
                        <Check className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 space-y-1">
                        <DialogTitle>{created.name} siap</DialogTitle>
                        <DialogDescription>
                            <span className="break-all font-mono">{`${host}/c/${created.slug}`}</span> sudah dibuat: database, data awal, dan akses Admin
                            untuk Anda.
                        </DialogDescription>
                    </div>
                </div>
                <ol className="flex flex-col gap-3">
                    <NextStep
                        number={1}
                        title="Buka perusahaan, lalu lengkapi profilnya"
                        detail="Aplikasi langsung membuka Profil Perusahaan. Menu lain terbuka setelah profil disimpan."
                        action={
                            <Button asChild>
                                <a href={`/c/${created.slug}/dashboard`}>Buka perusahaan</a>
                            </Button>
                        }
                    />
                    <NextStep
                        number={2}
                        title="Beri akses user lain"
                        detail={`Di Pengguna: edit user, centang ${created.name}, lalu pilih peran.`}
                        action={
                            <Button variant="outline" asChild>
                                <AppLink href="/admin/users">Buka Pengguna</AppLink>
                            </Button>
                        }
                    />
                </ol>
            </div>
            <DialogFooter className="border-t border-ob-line px-6 py-4">
                <Button variant="ghost" onClick={onClose}>
                    Tutup
                </Button>
            </DialogFooter>
        </>
    );
}

function NextStep({ number, title, detail, action }: { number: number; title: string; detail: string; action: React.ReactNode }) {
    return (
        <li className="flex flex-col gap-3 rounded-2xl bg-ob-inner p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
                <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ob-chip text-[11px] font-bold text-ob-ink-2"
                >
                    {number}
                </span>
                <div>
                    <p className="text-sm font-semibold text-ob-ink">{title}</p>
                    <p className="text-xs text-ob-ink-2">{detail}</p>
                </div>
            </div>
            <div className="shrink-0 pl-9 sm:pl-0">{action}</div>
        </li>
    );
}
