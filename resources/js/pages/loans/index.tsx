import { Head, router } from '@inertiajs/react';
import { ChevronRight, Paperclip, Plus, Search } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Pagination } from '@/components/shared/pagination';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { AppLayout } from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BTN, CARD, FIELD, daysFromToday, longDate, rp } from '@/pages/invoices/components/ob';
import * as loanRoutes from '@/routes/loans';
import { LoanDrawer } from './components/loan-drawer';
import { LoanFormSheet } from './components/loan-form-sheet';
import { LoanPaySheet } from './components/loan-pay-sheet';
import { LoanStatusPill, interestLabel } from './components/pjm';
import type { FilterOption, LoanFilters, LoanRow, LoanStats, PaginationMeta } from './types';
import { t, tk, Trans } from '@/i18n';

/*
 * Daftar pinjaman (gaya Obsidian).
 *
 * Tata letaknya dirombak dari versi lama, yang memuat 10 kolom dan empat kartu statistik
 * berisi dua hitungan bergaya uang. Pertanyaan yang sebenarnya dibawa orang ke halaman ini
 * ada dua: "berapa sisa utang kita" dan "mana yang jatuh tempo berikutnya" — keduanya tidak
 * terjawab di versi lama. Jadi:
 *
 *  - ringkasan berisi sisa pokok, yang sudah dibayar, biaya bunga, dan jatuh tempo terdekat;
 *  - tabel turun ke 6 kolom, tombol aksi per baris pindah ke panel rincian (tiga tombol ikon
 *    per baris itulah yang memaksa 10 kolom dan mematikan layar sempit);
 *  - rincian memakai panel samping, bukan modal terpusat, karena berisi jadwal angsuran yang
 *    tingginya ikut tenor.
 */

interface Props {
    rows: LoanRow[];
    pagination: PaginationMeta;
    stats: LoanStats;
    filters: LoanFilters;
    bankAccountOptions: FilterOption[];
    nextLoanNumber: string;
}

const TAB_STATUS: { value: '' | LoanRow['status']; label: string; context?: string }[] = [
    { value: '', label: tk('Semua') },
    { value: 'active', label: tk('Aktif', 'pinjaman'), context: 'pinjaman' },
    { value: 'paid_off', label: tk('Lunas', 'pinjaman'), context: 'pinjaman' },
];

const PILL =
    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

export default function LoansIndex({ rows, pagination, stats, filters, bankAccountOptions, nextLoanNumber }: Props) {
    const [search, setSearch] = React.useState(filters.search ?? '');
    const [loading, setLoading] = React.useState(false);
    const [detailRow, setDetailRow] = React.useState<LoanRow | null>(null);
    const [formRow, setFormRow] = React.useState<LoanRow | null>(null);
    const [formOpen, setFormOpen] = React.useState(false);
    const [payRow, setPayRow] = React.useState<LoanRow | null>(null);
    const [deleteRow, setDeleteRow] = React.useState<LoanRow | null>(null);
    const [deleting, setDeleting] = React.useState(false);

    /*
     * Pencarian terakhir yang SUDAH dikirim. Pembandingnya tidak boleh `filters.search`:
     * prop itu baru berubah setelah respons tiba, sehingga "Hapus filter" (yang mengosongkan
     * kotak cari lalu menavigasi) memicu debounce menembak sekali lagi dengan `filters` lama —
     * dan status yang baru saja dihapus terpasang kembali. Terbukti: filter status bertahan
     * setelah tombol "Hapus filter" ditekan.
     */
    const terkirim = React.useRef(filters.search ?? '');

    const navigate = (patch: Partial<LoanFilters>) => {
        const next = { ...filters, page: 1, ...patch };
        terkirim.current = next.search ?? '';
        router.get(
            loanRoutes.index.url(),
            {
                search: next.search || undefined,
                status: next.status || undefined,
                per_page: next.per_page,
                page: next.page > 1 ? next.page : undefined,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
                only: ['rows', 'pagination', 'stats', 'filters'],
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== terkirim.current) navigate({ search });
        }, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const resetFilters = () => {
        setSearch('');
        navigate({ search: null, status: null });
    };

    const hapus = () => {
        if (!deleteRow) return;
        setDeleting(true);
        router.delete(loanRoutes.destroy.url({ loan: deleteRow.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Utang dihapus'));
                setDeleteRow(null);
                setDetailRow(null);
            },
            onError: () => toast.error(t('Utang gagal dihapus')),
            onFinish: () => setDeleting(false),
        });
    };

    const bukaForm = (row: LoanRow | null) => {
        setFormRow(row);
        setFormOpen(true);
        setDetailRow(null);
    };

    const terfilter = !!(filters.search || filters.status);

    return (
        <>
            <Head title={t('Utang', { context: 'menu' })} />
            <div className="ob-motion flex flex-col gap-6 pt-1">
                {/* ── judul ── */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">{t('Utang', { context: 'menu' })}</h1>
                        <p className="text-[13px] text-ob-ink-2">{t('Pinjaman yang diterima perusahaan dari bank, lembaga, atau perorangan · {{count}} utang', { count: stats.total })}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <TutorialButton slug="loans" />
                        <Button className={BTN.primary} onClick={() => bukaForm(null)} icon={<Plus className="h-4 w-4" />}>
                            {t('Tambah utang')}
                        </Button>
                    </div>
                </div>

                {/* ── ringkasan ── */}
                {/* Satu kolom di bawah sm: "Rp 375.500.000" pada 26 px tidak muat di separuh layar 360 px,
                    dan yang patah jadi "Rp" / "375.500.000" adalah angka utama halaman ini. */}
                <section aria-label={t('Ringkasan utang')} className={cn(CARD, 'grid grid-cols-1 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-ob-line')}>
                    <StatBlock
                        label={t('Sisa pokok')}
                        value={rp(stats.outstanding_principal)}
                        valueClass={stats.outstanding_principal > 0 ? 'text-ob-neg' : 'text-ob-pos'}
                        sub={stats.active_count > 0 ? t('{{count}} utang aktif · dari {{amount}}', { count: stats.active_count, amount: rp(stats.active_principal) }) : t('tidak ada utang aktif')}
                        onClick={stats.active_count > 0 ? () => navigate({ status: 'active' }) : undefined}
                    />
                    <StatBlock label={t('Pokok terbayar')} value={rp(stats.paid_principal)} sub={t('pada utang yang masih aktif')} />
                    <StatBlock label={t('Bunga dibayar')} value={rp(stats.paid_interest)} sub={t('biaya utang sejauh ini')} />
                    <JatuhTempoBlock iso={stats.next_maturity} />
                </section>

                {/* ── daftar ── */}
                <section aria-label={t('Daftar utang')} className={cn(CARD, 'flex flex-col gap-4')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div
                            role="group"
                            aria-label={t('Filter status')}
                            className="ob-no-scrollbar flex max-w-full min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-ob-line bg-ob-rail p-[3px]"
                        >
                            {TAB_STATUS.map((tab) => {
                                const on = (filters.status ?? '') === tab.value;
                                return (
                                    <button
                                        key={tab.value || 'all'}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                            !on &&
                                            navigate({
                                                status: tab.value || null,
                                            })
                                        }
                                        className={cn(PILL, on ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                                    >
                                        {t(tab.label, tab.context ? { context: tab.context } : undefined)}
                                    </button>
                                );
                            })}
                        </div>
                        <div className={cn(FIELD, 'w-full sm:w-72 [&_input]:h-10')}>
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('Cari nomor atau pemberi pinjaman…')}
                                icon={<Search className="h-4 w-4" />}
                                aria-label={t('Cari utang')}
                            />
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
                                              <span className="min-w-0 truncate font-semibold text-ob-ink">{row.lender_name}</span>
                                              <span className="shrink-0 font-semibold tabular-nums text-ob-ink">{rp(row.principal_amount)}</span>
                                          </span>
                                          <span className="flex items-center justify-between gap-3">
                                              <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ob-ink-2">
                                                  {t('{{number}} · {{months}} bln', { number: row.loan_number, months: row.term_months })}
                                                  {row.contract_attachment_url && <Paperclip className="h-3 w-3 shrink-0" aria-label={t('Ada kontrak')} />}
                                              </span>
                                              <LoanStatusPill status={row.status} />
                                          </span>
                                          <span className="text-xs text-ob-ink-2">
                                              {row.remaining_principal > 0 ? (
                                                  <Trans
                                                      i18nKey="sisa <b>{{amount}}</b> · jatuh tempo {{date}}"
                                                      values={{ amount: rp(row.remaining_principal), date: longDate(row.maturity_date) }}
                                                      components={{ b: <span className="tabular-nums text-ob-neg" /> }}
                                                  />
                                              ) : (
                                                  t('pokok lunas · {{date}}', { date: longDate(row.maturity_date) })
                                              )}
                                          </span>
                                      </button>
                                  </li>
                              ))}
                    </ul>

                    {/* relative: teks sr-only di <th> berposisi absolut dan tanpa ini melebarkan halaman. */}
                    <div className="relative -mx-2 hidden overflow-x-auto px-2 md:block">
                        <table className="w-full min-w-[780px] text-sm">
                            <thead>
                                <tr className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3">
                                    <th className="py-2.5 pl-3 font-medium">{t('Utang')}</th>
                                    <th className="py-2.5 pr-4 text-right font-medium">{t('Pokok')}</th>
                                    <th className="py-2.5 pr-4 font-medium">{t('Bunga & tenor')}</th>
                                    <th className="py-2.5 pr-4 font-medium">{t('Jatuh tempo')}</th>
                                    <th className="py-2.5 pr-6 text-right font-medium">{t('Sisa pokok')}</th>
                                    <th className="py-2.5 font-medium">{t('Status')}</th>
                                    <th className="w-10 py-2.5">
                                        <span className="sr-only">{t('Buka rincian')}</span>
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
                                          const pct = row.principal_amount > 0 ? Math.round((row.paid_principal / row.principal_amount) * 100) : 0;
                                          const sisaHari = daysFromToday(row.maturity_date);
                                          const dekat = row.status === 'active' && sisaHari >= 0 && sisaHari <= 30;
                                          const lewat = row.status === 'active' && sisaHari < 0;

                                          return (
                                              <tr
                                                  key={row.id}
                                                  onClick={() => setDetailRow(row)}
                                                  className={cn('group cursor-pointer border-b border-ob-line-soft transition-colors hover:bg-ob-hover', row.id === detailRow?.id && 'bg-ob-hover')}
                                              >
                                                  <td className="py-3 pl-3 pr-4">
                                                      {/* Baris <tr> yang bisa diklik tidak bisa dijangkau Tab. Tombol asli di sel pertama
                                                          memberi pengguna papan ketik jalan masuk yang sama; mouse tetap boleh klik satu baris penuh. */}
                                                      <button
                                                          type="button"
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              setDetailRow(row);
                                                          }}
                                                          className="block max-w-[260px] truncate text-left font-semibold text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                                      >
                                                          {row.lender_name}
                                                      </button>
                                                      <span className="flex items-center gap-1.5 text-xs text-ob-ink-2">
                                                          {row.loan_number}
                                                          {row.contract_attachment_url && <Paperclip className="h-3 w-3" aria-label={t('Ada kontrak')} />}
                                                      </span>
                                                  </td>
                                                  <td className="py-3 pr-4 text-right tabular-nums text-ob-ink">{rp(row.principal_amount)}</td>
                                                  <td className="py-3 pr-4 text-ob-ink-2">
                                                      <span className="block tabular-nums">{interestLabel(row)}</span>
                                                      <span className="block text-xs text-ob-ink-3">{t('{{count}} bulan', { count: row.term_months })}</span>
                                                  </td>
                                                  <td className="py-3 pr-4">
                                                      <span className="block text-ob-ink-2">{longDate(row.maturity_date)}</span>
                                                      {(dekat || lewat) && (
                                                          <span className={cn('block text-xs font-semibold', lewat ? 'text-ob-late' : 'text-ob-neg')}>
                                                              {lewat ? t('lewat {{count}} hari', { count: -sisaHari }) : t('{{count}} hari lagi', { count: sisaHari })}
                                                          </span>
                                                      )}
                                                  </td>
                                                  <td className="py-3 pr-6 text-right">
                                                      {/* Tinta biasa, bukan merah: `ob-neg` di atas baris terpilih (bg-ob-hover) hanya 4,28:1,
                                                          dan merah di kolom ini bersaing dengan penanda "lewat N hari" di kolom jatuh tempo.
                                                          Satu halaman, satu makna merah. */}
                                                      <span className={cn('block font-semibold tabular-nums', row.remaining_principal > 0 ? 'text-ob-ink' : 'text-ob-pos')}>
                                                          {row.remaining_principal > 0 ? rp(row.remaining_principal) : t('lunas')}
                                                      </span>
                                                      {/* Batang progres menggantikan kolom "dibayar" tersendiri. */}
                                                      <span
                                                          className="mt-1 ml-auto block h-1 w-20 overflow-hidden rounded-full bg-ob-chip"
                                                          role="progressbar"
                                                          aria-valuenow={pct}
                                                          aria-valuemin={0}
                                                          aria-valuemax={100}
                                                          aria-label={t('Pokok terbayar {{percent}} persen', { percent: pct })}
                                                      >
                                                          <span
                                                              className="block h-full rounded-full bg-ob-act-fill"
                                                              style={{
                                                                  width: `${pct}%`,
                                                              }}
                                                          />
                                                      </span>
                                                  </td>
                                                  <td className="py-3">
                                                      <LoanStatusPill status={row.status} />
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
                            <span className="text-sm font-semibold text-ob-ink">{terfilter ? t('Tidak ada utang yang cocok') : t('Belum ada utang')}</span>
                            <span className="max-w-[380px] text-[13px] text-ob-ink-2">
                                {terfilter ? t('Ubah atau hapus filter untuk melihat utang lain.') : t('Catat pinjaman yang diterima perusahaan, lalu angsurannya bisa dilacak per termin di sini.')}
                            </span>
                            <Button variant="outline" className={BTN.small} onClick={terfilter ? resetFilters : () => bukaForm(null)}>
                                {terfilter ? t('Hapus filter') : t('Tambah utang')}
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ob-line pt-4 text-[13px] text-ob-ink-2">
                        <span>{t('{{count}} utang · terbaru lebih dulu', { count: pagination.total })}</span>
                        {pagination.last_page > 1 && <Pagination meta={pagination} onPageChange={(page) => navigate({ page })} />}
                    </div>
                </section>
            </div>

            <LoanDrawer
                row={detailRow}
                onOpenChange={(o) => !o && setDetailRow(null)}
                onEdit={(row) => bukaForm(row)}
                onPay={(row) => {
                    setDetailRow(null);
                    setPayRow(row);
                }}
                onDelete={(row) => setDeleteRow(row)}
            />

            <LoanFormSheet open={formOpen} onOpenChange={setFormOpen} row={formRow} nextLoanNumber={nextLoanNumber} bankAccountOptions={bankAccountOptions} />

            <LoanPaySheet row={payRow} onOpenChange={(o) => !o && setPayRow(null)} bankAccountOptions={bankAccountOptions} />

            <ConfirmDialog
                open={!!deleteRow}
                onOpenChange={(o) => !o && setDeleteRow(null)}
                onConfirm={hapus}
                loading={deleting}
                title={t('Hapus utang ini?')}
                description={t('{{number}} dari {{lender}} akan dihapus, dan transaksi pencairannya di rekening bank ikut dibalik.', { number: deleteRow?.loan_number, lender: deleteRow?.lender_name })}
                confirmLabel={t('Hapus utang')}
                variant="danger"
            />
        </>
    );
}

/* ─────────────────────────────────── bagian ─── */

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

/** Jatuh tempo terdekat di antara pinjaman aktif; merah hanya kalau sudah lewat. */
function JatuhTempoBlock({ iso }: { iso: string | null }) {
    if (!iso) {
        return (
            <div className="flex min-w-0 flex-col gap-1 px-0 lg:px-6">
                <span className="text-[13px] text-ob-ink-2">{t('Jatuh tempo terdekat')}</span>
                <span className="whitespace-nowrap text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink sm:text-[26px]">—</span>
                <span className="text-xs text-ob-ink-2">{t('semua utang sudah lunas')}</span>
            </div>
        );
    }

    const hari = daysFromToday(iso);
    return (
        <div className="flex min-w-0 flex-col gap-1 px-0 lg:px-6">
            <span className="text-[13px] text-ob-ink-2">{t('Jatuh tempo terdekat')}</span>
            <span className={cn('whitespace-nowrap text-[22px] font-semibold leading-tight tracking-[-0.01em] sm:text-[26px]', hari < 0 ? 'text-ob-late' : 'text-ob-ink')}>{longDate(iso)}</span>
            <span className="text-xs text-ob-ink-2">{hari < 0 ? t('lewat {{count}} hari', { count: -hari }) : hari === 0 ? t('hari ini') : t('{{count}} hari lagi', { count: hari })}</span>
        </div>
    );
}

LoansIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
