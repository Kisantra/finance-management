import { Head, router } from '@inertiajs/react';
import { ChevronRight, Paperclip, Plus, Search } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Pagination } from '@/components/shared/pagination';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { AppLayout } from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BTN, CARD, FIELD, daysFromToday, longDate, rp } from '@/pages/invoices/components/ob';
import * as receivableRoutes from '@/routes/receivables';
import { ReceivableApproveSheet } from './components/receivable-approve-sheet';
import { ReceivableDrawer } from './components/receivable-drawer';
import { ReceivableFormSheet } from './components/receivable-form-sheet';
import { ReceivablePaySheet } from './components/receivable-pay-sheet';
import { ReceivableStatusPill, STATUS_LABEL, TYPE_LABEL } from './components/ptg';
import type { FilterOption, PaginationMeta, ReceivableFilters, ReceivableRow, ReceivableStats, ReceivableStatus } from './types';

/*
 * Daftar piutang (gaya Obsidian).
 *
 * Bahasanya sama dengan halaman Pinjaman, tetapi susunannya SENGAJA berbeda, karena
 * pertanyaannya berbeda. Pada Pinjaman kita yang menentukan kapan membayar; pada Piutang
 * kita tidak mengendalikan kapan uang kembali. Jadi:
 *
 *  - "Lewat tempo" naik jadi angka utama kedua — di Pinjaman angka itu tidak ada;
 *  - ada antrean persetujuan, jadi pil status membawa hitungan dan ringkasan memuat
 *    nilai yang sedang menunggu diputuskan;
 *  - tabel turun dari 9 kolom ke 6, dan tombol aksi per baris pindah ke panel rincian.
 */

interface Props {
    rows: ReceivableRow[];
    pagination: PaginationMeta;
    stats: ReceivableStats;
    statusCounts: Record<ReceivableStatus, number>;
    filters: ReceivableFilters;
    bankAccountOptions: FilterOption[];
    employeeOptions: FilterOption[];
    companyOptions: FilterOption[];
    nextReceivableNumber: string;
    canApprove: boolean;
    canPay: boolean;
}

const TAB_STATUS: { value: '' | ReceivableStatus; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'pending_approval', label: STATUS_LABEL.pending_approval },
    { value: 'active', label: STATUS_LABEL.active },
    { value: 'paid_off', label: STATUS_LABEL.paid_off },
    { value: 'draft', label: STATUS_LABEL.draft },
    { value: 'rejected', label: STATUS_LABEL.rejected },
];

const TIPE_OPTIONS: FilterOption[] = [
    { label: 'Karyawan', value: 'employee_loan' },
    { label: 'Perusahaan', value: 'company_loan' },
];

const PILL =
    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

export default function ReceivablesIndex({ rows, pagination, stats, statusCounts, filters, bankAccountOptions, employeeOptions, companyOptions, nextReceivableNumber }: Props) {
    const [search, setSearch] = React.useState(filters.search ?? '');
    const [loading, setLoading] = React.useState(false);
    const [detailRow, setDetailRow] = React.useState<ReceivableRow | null>(null);
    const [formRow, setFormRow] = React.useState<ReceivableRow | null>(null);
    const [formOpen, setFormOpen] = React.useState(false);
    const [payRow, setPayRow] = React.useState<ReceivableRow | null>(null);
    const [approveRow, setApproveRow] = React.useState<ReceivableRow | null>(null);
    const [deleteRow, setDeleteRow] = React.useState<ReceivableRow | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const [submitRow, setSubmitRow] = React.useState<ReceivableRow | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

    /*
     * Pencarian terakhir yang SUDAH dikirim. Pembandingnya tidak boleh `filters.search`:
     * prop itu baru berubah setelah respons tiba, sehingga "Hapus filter" memicu debounce
     * menembak sekali lagi dengan `filters` lama dan memasang kembali filter yang baru
     * saja dihapus. Cacat yang sama ditemukan dan diperbaiki di halaman Pinjaman.
     */
    const terkirim = React.useRef(filters.search ?? '');

    const navigate = (patch: Partial<ReceivableFilters>) => {
        const next = { ...filters, page: 1, ...patch };
        terkirim.current = next.search ?? '';
        router.get(
            receivableRoutes.index.url(),
            {
                search: next.search || undefined,
                status: next.status || undefined,
                type: next.type || undefined,
                per_page: next.per_page,
                page: next.page > 1 ? next.page : undefined,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
                only: ['rows', 'pagination', 'stats', 'statusCounts', 'filters'],
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };

    React.useEffect(() => {
        const t = setTimeout(() => {
            if (search !== terkirim.current) navigate({ search });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const resetFilters = () => {
        setSearch('');
        navigate({ search: null, status: null, type: null });
    };

    const ajukan = () => {
        if (!submitRow) return;
        setSubmitting(true);
        router.post(
            receivableRoutes.submit.url({ receivable: submitRow.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Piutang diajukan untuk persetujuan');
                    setSubmitRow(null);
                    setDetailRow(null);
                },
                onError: () => toast.error('Pengajuan gagal dikirim'),
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const hapus = () => {
        if (!deleteRow) return;
        setDeleting(true);
        router.delete(receivableRoutes.destroy.url({ receivable: deleteRow.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Piutang dihapus');
                setDeleteRow(null);
                setDetailRow(null);
            },
            onError: () => toast.error('Piutang gagal dihapus'),
            onFinish: () => setDeleting(false),
        });
    };

    const bukaForm = (row: ReceivableRow | null) => {
        setFormRow(row);
        setFormOpen(true);
        setDetailRow(null);
    };

    const terfilter = !!(filters.search || filters.status || filters.type);
    const semuaHitungan = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return (
        <>
            <Head title="Piutang" />
            <div className="ob-motion flex flex-col gap-6 pt-1">
                {/* ── judul ── */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">Piutang</h1>
                        <p className="text-[13px] text-ob-ink-2">Uang perusahaan yang dipinjam karyawan atau perusahaan lain · {stats.total} piutang</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <TutorialButton slug="receivables" />
                        <Button className={BTN.primary} onClick={() => bukaForm(null)} icon={<Plus className="h-4 w-4" />}>
                            Tambah piutang
                        </Button>
                    </div>
                </div>

                {/* ── ringkasan ── */}
                {/* Satu kolom di bawah sm: nominal 26 px tidak muat di separuh layar 360 px. */}
                <section aria-label="Ringkasan piutang" className={cn(CARD, 'grid grid-cols-1 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-ob-line')}>
                    <StatBlock
                        label="Belum kembali"
                        value={rp(stats.outstanding_principal)}
                        sub={stats.active_count > 0 ? `${stats.active_count} piutang aktif · dari ${rp(stats.total_principal_active)}` : 'tidak ada piutang aktif'}
                        onClick={stats.active_count > 0 ? () => navigate({ status: 'active' }) : undefined}
                    />
                    {/* Satu-satunya angka berwarna di baris ini: risiko yang tidak kita kendalikan. */}
                    <StatBlock
                        label="Lewat tempo"
                        value={rp(stats.overdue_amount)}
                        valueClass={stats.overdue_count > 0 ? 'text-ob-late' : 'text-ob-pos'}
                        sub={stats.overdue_count > 0 ? `${stats.overdue_count} piutang sudah lewat jatuh tempo` : 'tidak ada yang lewat tempo'}
                        onClick={stats.overdue_count > 0 ? () => navigate({ status: 'active' }) : undefined}
                    />
                    <StatBlock
                        label="Menunggu persetujuan"
                        value={rp(stats.pending_amount)}
                        sub={stats.pending_count > 0 ? `${stats.pending_count} pengajuan perlu diputuskan` : 'tidak ada pengajuan tertunda'}
                        onClick={stats.pending_count > 0 ? () => navigate({ status: 'pending_approval' }) : undefined}
                    />
                    <JatuhTempoBlock iso={stats.next_due} />
                </section>

                {/* ── daftar ── */}
                <section aria-label="Daftar piutang" className={cn(CARD, 'flex flex-col gap-4')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div
                            role="group"
                            aria-label="Filter status"
                            className="ob-no-scrollbar flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-ob-line bg-ob-rail p-[3px]"
                        >
                            {TAB_STATUS.map((t) => {
                                const on = (filters.status ?? '') === t.value;
                                const hitungan = t.value ? statusCounts[t.value] : semuaHitungan;
                                return (
                                    <button
                                        key={t.value || 'all'}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => !on && navigate({ status: t.value || null })}
                                        className={cn(PILL, on ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                                    >
                                        {t.label}
                                        <span className={cn('text-xs', on ? 'opacity-70' : 'text-ob-ink-3')}>{hitungan}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className={cn(FIELD, 'flex flex-wrap items-center gap-2 [&_button]:h-10 [&_input]:h-10')}>
                            <div className="w-full sm:w-60">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nomor atau tujuan…"
                                    icon={<Search className="h-4 w-4" />}
                                    aria-label="Cari piutang"
                                />
                            </div>
                            <div className="w-full sm:w-44">
                                <Combobox
                                    options={TIPE_OPTIONS}
                                    value={filters.type ?? ''}
                                    onChange={(v) => navigate({ type: v ? String(v) : null })}
                                    placeholder="Semua peminjam"
                                    emptyText="Tipe tidak ditemukan"
                                    clearable
                                />
                            </div>
                        </div>
                    </div>

                    {/* Ponsel: daftar bertumpuk — tabel uang 6 kolom tidak muat di 360 px tanpa memotong nominal. */}
                    <ul className="flex flex-col md:hidden" aria-busy={loading}>
                        {loading
                            ? Array.from({ length: 4 }, (_, i) => (
                                  <li key={i} className="border-b border-ob-line-soft py-3">
                                      <Skeleton className="h-12 rounded-xl bg-ob-inner dark:bg-ob-inner" />
                                  </li>
                              ))
                            : rows.map((row) => (
                                  <li key={row.id} className="border-b border-ob-line-soft last:border-0">
                                      <button
                                          type="button"
                                          onClick={() => setDetailRow(row)}
                                          className={cn(
                                              '-mx-2 flex w-[calc(100%+1rem)] flex-col gap-1.5 rounded-xl px-2 py-3 text-left transition-colors hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                                              row.id === detailRow?.id && 'bg-ob-hover',
                                          )}
                                      >
                                          <span className="flex items-start justify-between gap-3">
                                              <span className="min-w-0 truncate font-semibold text-ob-ink">{row.debtor_name ?? '—'}</span>
                                              <span className="shrink-0 font-semibold tabular-nums text-ob-ink">{rp(row.principal_amount)}</span>
                                          </span>
                                          <span className="flex items-center justify-between gap-3">
                                              <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ob-ink-2">
                                                  {row.receivable_number} · {TYPE_LABEL[row.type]}
                                                  {row.contract_attachment_url && <Paperclip className="h-3 w-3 shrink-0" aria-label="Ada kontrak" />}
                                              </span>
                                              <ReceivableStatusPill status={row.status} />
                                          </span>
                                          <SisaBaris row={row} />
                                      </button>
                                  </li>
                              ))}
                    </ul>

                    {/* relative: teks sr-only di <th> berposisi absolut dan tanpa ini melebarkan halaman. */}
                    <div className="relative -mx-2 hidden overflow-x-auto px-2 md:block">
                        <table className="w-full min-w-[800px] text-sm">
                            <thead>
                                <tr className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3">
                                    <th className="py-2.5 pl-3 font-medium">Peminjam</th>
                                    <th className="py-2.5 pr-4 text-right font-medium">Pokok</th>
                                    <th className="py-2.5 pr-4 font-medium">Cicilan</th>
                                    <th className="py-2.5 pr-4 font-medium">Jatuh tempo</th>
                                    <th className="py-2.5 pr-6 text-right font-medium">Belum kembali</th>
                                    <th className="py-2.5 font-medium">Status</th>
                                    <th className="w-10 py-2.5">
                                        <span className="sr-only">Buka rincian</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody aria-busy={loading}>
                                {loading
                                    ? Array.from({ length: 5 }, (_, i) => (
                                          <tr key={i} className="border-b border-ob-line-soft">
                                              <td colSpan={7} className="py-3">
                                                  <Skeleton className="h-9 rounded-xl bg-ob-inner dark:bg-ob-inner" />
                                              </td>
                                          </tr>
                                      ))
                                    : rows.map((row) => {
                                          const berjalan = row.status === 'active' || row.status === 'paid_off';
                                          const pct = row.principal_amount > 0 ? Math.round((row.paid_principal / row.principal_amount) * 100) : 0;
                                          const sisaHari = daysFromToday(row.due_date);
                                          const lewat = row.status === 'active' && sisaHari < 0 && row.remaining_principal > 0;
                                          const dekat = row.status === 'active' && sisaHari >= 0 && sisaHari <= 30;

                                          return (
                                              <tr
                                                  key={row.id}
                                                  onClick={() => setDetailRow(row)}
                                                  className={cn('group cursor-pointer border-b border-ob-line-soft transition-colors hover:bg-ob-hover', row.id === detailRow?.id && 'bg-ob-hover')}
                                              >
                                                  <td className="py-3 pl-3 pr-4">
                                                      {/* Baris <tr> yang bisa diklik tidak bisa dijangkau Tab; tombol asli di sel
                                                          pertama memberi pengguna papan ketik jalan masuk yang sama. */}
                                                      <button
                                                          type="button"
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              setDetailRow(row);
                                                          }}
                                                          className="block max-w-[240px] truncate text-left font-semibold text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                                      >
                                                          {row.debtor_name ?? '—'}
                                                      </button>
                                                      <span className="flex items-center gap-1.5 text-xs text-ob-ink-2">
                                                          {row.receivable_number} · {TYPE_LABEL[row.type]}
                                                          {row.contract_attachment_url && <Paperclip className="h-3 w-3" aria-label="Ada kontrak" />}
                                                      </span>
                                                  </td>
                                                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-ob-ink">{rp(row.principal_amount)}</td>
                                                  <td className="whitespace-nowrap py-3 pr-4 text-ob-ink-2">
                                                      <span className="block tabular-nums">{rp(row.installment_amount)}</span>
                                                      <span className="block text-xs text-ob-ink-3">{row.installment_months} bulan</span>
                                                  </td>
                                                  <td className="whitespace-nowrap py-3 pr-4">
                                                      <span className="block text-ob-ink-2">{longDate(row.due_date)}</span>
                                                      {(lewat || dekat) && (
                                                          <span className={cn('block text-xs font-semibold', lewat ? 'text-ob-late' : 'text-ob-neg')}>
                                                              {lewat ? `lewat ${-sisaHari} hari` : `${sisaHari} hari lagi`}
                                                          </span>
                                                      )}
                                                  </td>
                                                  <td className="whitespace-nowrap py-3 pr-6 text-right">
                                                      {berjalan ? (
                                                          <>
                                                              {/* Tinta biasa, bukan merah: `ob-neg` di atas baris terpilih (bg-ob-hover) hanya 4,28:1,
                                                                  dan merah di kolom ini bersaing dengan penanda "lewat N hari" di kolom jatuh tempo.
                                                                  Satu halaman, satu makna merah. */}
                                                              <span className={cn('block font-semibold tabular-nums', row.remaining_principal > 0 ? 'text-ob-ink' : 'text-ob-pos')}>
                                                                  {row.remaining_principal > 0 ? rp(row.remaining_principal) : 'lunas'}
                                                              </span>
                                                              <span
                                                                  className="mt-1 ml-auto block h-1 w-20 overflow-hidden rounded-full bg-ob-chip"
                                                                  role="progressbar"
                                                                  aria-valuenow={pct}
                                                                  aria-valuemin={0}
                                                                  aria-valuemax={100}
                                                                  aria-label={`Pokok sudah kembali ${pct} persen`}
                                                              >
                                                                  <span className="block h-full rounded-full bg-ob-act-fill" style={{ width: `${pct}%` }} />
                                                              </span>
                                                          </>
                                                      ) : (
                                                          /* Belum berjalan: tidak ada yang bisa kembali, jadi angkanya tidak dikarang. */
                                                          <span className="text-ob-ink-3">belum berjalan</span>
                                                      )}
                                                  </td>
                                                  <td className="py-3">
                                                      <ReceivableStatusPill status={row.status} />
                                                  </td>
                                                  <td className="py-3 pr-2 text-right">
                                                      <ChevronRight className="ml-auto h-4 w-4 text-ob-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                                  </td>
                                              </tr>
                                          );
                                      })}
                            </tbody>
                        </table>
                    </div>

                    {!loading && rows.length === 0 && (
                        <div className="my-2 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ob-line-strong px-6 py-10 text-center">
                            <span className="text-sm font-semibold text-ob-ink">{terfilter ? 'Tidak ada piutang yang cocok' : 'Belum ada piutang'}</span>
                            <span className="max-w-[380px] text-[13px] text-ob-ink-2">
                                {terfilter
                                    ? 'Ubah atau hapus filter untuk melihat piutang lain.'
                                    : 'Catat uang yang dipinjam karyawan atau perusahaan lain, lalu angsurannya bisa dilacak per termin di sini.'}
                            </span>
                            <Button variant="outline" className={BTN.small} onClick={terfilter ? resetFilters : () => bukaForm(null)}>
                                {terfilter ? 'Hapus filter' : 'Tambah piutang'}
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ob-line pt-4 text-[13px] text-ob-ink-2">
                        <span>{pagination.total} piutang · terbaru lebih dulu</span>
                        {pagination.last_page > 1 && <Pagination meta={pagination} onPageChange={(page) => navigate({ page })} />}
                    </div>
                </section>
            </div>

            <ReceivableDrawer
                row={detailRow}
                onOpenChange={(o) => !o && setDetailRow(null)}
                onEdit={(row) => bukaForm(row)}
                onPay={(row) => {
                    setDetailRow(null);
                    setPayRow(row);
                }}
                onApprove={(row) => {
                    setDetailRow(null);
                    setApproveRow(row);
                }}
                onSubmit={(row) => setSubmitRow(row)}
                onDelete={(row) => setDeleteRow(row)}
            />

            <ReceivableFormSheet
                open={formOpen}
                onOpenChange={setFormOpen}
                row={formRow}
                nextReceivableNumber={nextReceivableNumber}
                employeeOptions={employeeOptions}
                companyOptions={companyOptions}
            />

            <ReceivableApproveSheet row={approveRow} onOpenChange={(o) => !o && setApproveRow(null)} bankAccountOptions={bankAccountOptions} />

            <ReceivablePaySheet row={payRow} onOpenChange={(o) => !o && setPayRow(null)} bankAccountOptions={bankAccountOptions} />

            <ConfirmDialog
                open={!!submitRow}
                onOpenChange={(o) => !o && setSubmitRow(null)}
                onConfirm={ajukan}
                loading={submitting}
                title="Ajukan piutang ini?"
                description={`${submitRow?.receivable_number} dikirim ke penyetuju. Selama menunggu keputusan, isinya tidak bisa diubah lagi.`}
                variant="warning"
                // WAJIB diisi: ConfirmDialog default-nya confirmLabel='Hapus', sehingga dialog
                // pengajuan ini bertombol "Hapus" dan mengajak pengguna mengira ia menghapus.
                confirmLabel="Ajukan"
            />

            <ConfirmDialog
                open={!!deleteRow}
                onOpenChange={(o) => !o && setDeleteRow(null)}
                onConfirm={hapus}
                loading={deleting}
                title="Hapus piutang ini?"
                description={`${deleteRow?.receivable_number} atas nama ${deleteRow?.debtor_name ?? 'peminjam'} akan dihapus permanen.`}
                variant="danger"
                confirmLabel="Hapus piutang"
            />
        </>
    );
}

/* ─────────────────────────────────── bagian ─── */

/** Baris sisa pada daftar ponsel; piutang yang belum berjalan tidak punya sisa untuk ditampilkan. */
function SisaBaris({ row }: { row: ReceivableRow }) {
    if (row.status !== 'active' && row.status !== 'paid_off') {
        return <span className="text-xs text-ob-ink-3">belum berjalan · jatuh tempo {longDate(row.due_date)}</span>;
    }
    return (
        <span className="text-xs text-ob-ink-2">
            {row.remaining_principal > 0 ? (
                <>
                    belum kembali <span className="tabular-nums text-ob-neg">{rp(row.remaining_principal)}</span> · jatuh tempo {longDate(row.due_date)}
                </>
            ) : (
                <>pokok sudah kembali · {longDate(row.due_date)}</>
            )}
        </span>
    );
}

function StatBlock({ label, value, sub, valueClass, onClick }: { label: string; value: string; sub: string; valueClass?: string; onClick?: () => void }) {
    const body = (
        <>
            <span className="text-[13px] text-ob-ink-2">{label}</span>
            <span className={cn('whitespace-nowrap text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink sm:text-[26px]', valueClass)}>{value}</span>
            <span className="text-xs text-ob-ink-2">{sub}</span>
        </>
    );
    const cls = 'flex min-w-0 flex-col gap-1 px-0 text-left lg:px-6 lg:first:pl-0';
    return onClick ? (
        <button type="button" onClick={onClick} className={cn(cls, 'rounded-xl hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill')}>
            {body}
        </button>
    ) : (
        <div className={cls}>{body}</div>
    );
}

/** Jatuh tempo terdekat di antara piutang aktif; merah hanya kalau sudah lewat. */
function JatuhTempoBlock({ iso }: { iso: string | null }) {
    if (!iso) {
        return (
            <div className="flex min-w-0 flex-col gap-1 px-0 lg:px-6">
                <span className="text-[13px] text-ob-ink-2">Jatuh tempo terdekat</span>
                <span className="whitespace-nowrap text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink sm:text-[26px]">—</span>
                <span className="text-xs text-ob-ink-2">tidak ada piutang berjalan</span>
            </div>
        );
    }

    const hari = daysFromToday(iso);
    return (
        <div className="flex min-w-0 flex-col gap-1 px-0 lg:px-6">
            <span className="text-[13px] text-ob-ink-2">Jatuh tempo terdekat</span>
            <span className={cn('whitespace-nowrap text-[22px] font-semibold leading-tight tracking-[-0.01em] sm:text-[26px]', hari < 0 ? 'text-ob-late' : 'text-ob-ink')}>{longDate(iso)}</span>
            <span className="text-xs text-ob-ink-2">{hari < 0 ? `lewat ${-hari} hari` : hari === 0 ? 'hari ini' : `${hari} hari lagi`}</span>
        </div>
    );
}

ReceivablesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
