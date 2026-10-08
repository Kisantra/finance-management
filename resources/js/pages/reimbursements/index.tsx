import { Head, router } from '@inertiajs/react';
import { ChevronRight, Paperclip, Plus, Search } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/pagination';
import { AppLayout } from '@/layouts/app-layout';
import { openResource, useResource } from '@/lib/resource-modal';
import { cn, toLocalIso } from '@/lib/utils';
import { BTN, CARD, FIELD, longDate, rp } from '@/pages/invoices/components/ob';
import { PersonAvatar, ReimbursementStatusPill, STATUS_LABEL, type ReimbursementStatus } from './components/rb';
import { ReimbursementFormSheet, type CategoryOption } from './components/reimbursement-form-sheet';
import type { PaginationMeta, ReimbursementFilters, ReimbursementRow, ReimbursementStats } from './types';

/*
 * Daftar reimbursement (gaya Obsidian; pola referensi "Expense Approval Dashboard"): ringkasan
 * uang per tahap, pil status, tabel ringkas. Detail, review, dan pembayaran ada di drawer
 * `#reimbursement/{id}` (components/reimbursement-drawer.tsx) yang bisa dibuka dari halaman mana pun.
 */

interface Props {
    rows: ReimbursementRow[];
    pagination: PaginationMeta;
    stats: ReimbursementStats;
    statusCounts: Record<ReimbursementStatus, number>;
    filters: ReimbursementFilters;
    categoryOptions: CategoryOption[];
    canApprove: boolean;
    canPay: boolean;
    canSeeAll: boolean;
}

const STATUS_TABS: { value: '' | ReimbursementStatus; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'pending', label: STATUS_LABEL.pending },
    { value: 'approved', label: STATUS_LABEL.approved },
    { value: 'paid', label: STATUS_LABEL.paid },
    { value: 'rejected', label: STATUS_LABEL.rejected },
    { value: 'draft', label: STATUS_LABEL.draft },
];

const PILL = 'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill';

const parseIso = (s: string | null) => (s ? new Date(s + 'T00:00:00') : null);

export default function ReimbursementsIndex({ rows, pagination, stats, statusCounts, filters, categoryOptions, canSeeAll }: Props) {
    const [search, setSearch] = React.useState(filters.search ?? '');
    const [loading, setLoading] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);
    const resource = useResource();
    const openId = resource?.type === 'reimbursement' ? resource.id : null;

    // /reimbursements/create (route lama) mengarah ke ?create=1 → buka form langsung.
    React.useEffect(() => {
        const url = new URL(window.location.href);
        if (url.searchParams.get('create') === '1') {
            setCreateOpen(true);
            url.searchParams.delete('create');
            window.history.replaceState(window.history.state, '', url.toString());
        }
    }, []);

    const navigate = (patch: Partial<ReimbursementFilters>) => {
        const next = { ...filters, page: 1, ...patch };
        router.get(
            '/reimbursements',
            {
                tab: next.tab,
                search: next.search || undefined,
                status: next.status || undefined,
                category: next.category || undefined,
                date_from: next.date_from || undefined,
                date_to: next.date_to || undefined,
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
            if (search !== (filters.search ?? '')) navigate({ search });
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const hasFilters = !!(filters.search || filters.category || (filters.date_from && filters.date_to));
    const resetFilters = () => {
        setSearch('');
        navigate({ search: null, category: null, date_from: null, date_to: null, status: null });
    };

    const allCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const showRequester = filters.tab === 'all';

    return (
        <>
            <Head title="Reimbursement" />
            <div className="flex flex-col gap-6 pt-1">
                {/* ── judul ── */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink">Reimbursement</h1>
                        <p className="text-[13px] text-ob-ink-2">
                            {filters.tab === 'all' ? 'Pengajuan semua karyawan' : 'Pengajuan Anda'} · {stats.total} pengajuan
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canSeeAll && (
                            <div role="group" aria-label="Cakupan pengajuan" className="flex items-center gap-0.5 rounded-full border border-ob-line bg-ob-rail p-[3px]">
                                {[
                                    { value: 'all', label: 'Semua pengajuan' },
                                    { value: 'my', label: 'Pengajuan saya' },
                                ].map((t) => {
                                    const on = filters.tab === t.value;
                                    return (
                                        <button
                                            key={t.value}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => !on && navigate({ tab: t.value, status: null })}
                                            className={cn(PILL, on ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                                        >
                                            {t.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <Button className={BTN.primary} onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                            Buat pengajuan
                        </Button>
                    </div>
                </div>

                {/* ── ringkasan per tahap ── */}
                <section aria-label="Ringkasan reimbursement" className={cn(CARD, 'grid grid-cols-2 gap-y-5 lg:grid-cols-4 lg:divide-x lg:divide-ob-line')}>
                    <StatBlock
                        label="Menunggu review"
                        value={rp(stats.pending_amount)}
                        valueClass={stats.pending_count > 0 ? 'text-ob-wait' : undefined}
                        sub={`${stats.pending_count} pengajuan`}
                        onClick={stats.pending_count > 0 ? () => navigate({ status: 'pending' }) : undefined}
                    />
                    <StatBlock
                        label="Menunggu dibayar"
                        value={rp(stats.approved_remaining)}
                        valueClass={stats.approved_count > 0 ? 'text-ob-act' : undefined}
                        sub={`${stats.approved_count} pengajuan disetujui`}
                        onClick={stats.approved_count > 0 ? () => navigate({ status: 'approved' }) : undefined}
                    />
                    <StatBlock label="Sudah dibayar" value={rp(stats.total_paid)} valueClass="text-ob-pos" sub="termasuk cicilan" />
                    <StatBlock label="Total diajukan" value={rp(stats.total_amount)} sub={`${stats.total} pengajuan · semua status`} />
                </section>

                {/* ── daftar ── */}
                <section aria-label="Daftar reimbursement" className={cn(CARD, 'flex flex-col gap-4')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div role="group" aria-label="Filter status" className="ob-no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-ob-line bg-ob-rail p-[3px]">
                            {STATUS_TABS.map((t) => {
                                const on = (filters.status ?? '') === t.value;
                                const count = t.value ? statusCounts[t.value] : allCount;
                                return (
                                    <button
                                        key={t.value || 'all'}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => !on && navigate({ status: t.value || null })}
                                        className={cn(PILL, on ? 'bg-ob-invert font-semibold text-ob-invert-ink' : 'font-medium text-ob-ink-2 hover:text-ob-ink')}
                                    >
                                        {t.label}
                                        <span className={cn('text-xs', on ? 'opacity-70' : 'text-ob-ink-3')}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className={cn(FIELD, 'flex flex-wrap items-center gap-2 [&_button]:h-10 [&_input]:h-10')}>
                            <div className="w-full sm:w-56">
                                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pengajuan…" icon={<Search className="h-4 w-4" />} aria-label="Cari pengajuan" />
                            </div>
                            <div className="w-full sm:w-48">
                                <Combobox options={categoryOptions} value={filters.category} onChange={(v) => navigate({ category: v ? String(v) : null })} placeholder="Semua kategori" clearable />
                            </div>
                            <div className="w-full sm:w-56">
                                <DatePicker
                                    mode="range"
                                    value={{ from: parseIso(filters.date_from), to: parseIso(filters.date_to) }}
                                    onChange={(r) => navigate({ date_from: r.from ? toLocalIso(r.from) : null, date_to: r.to ? toLocalIso(r.to) : null })}
                                    placeholder="Tanggal pengeluaran"
                                    placeholderTo="…"
                                    clearable
                                />
                            </div>
                        </div>
                    </div>

                    {/* relative: teks sr-only (absolut) di dalam tabel tetap terpotong wadah ini, tidak melebarkan halaman. */}
                    {/* Ponsel: daftar bertumpuk (tabel lebar harus digeser dan memotong nominal/status). */}
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
                                          onClick={() => openResource('reimbursement', row.id)}
                                          className={cn(
                                              '-mx-2 flex w-[calc(100%+1rem)] flex-col gap-1.5 rounded-xl px-2 py-3 text-left transition-colors hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill',
                                              row.id === openId && 'bg-ob-hover',
                                          )}
                                      >
                                          <span className="flex items-start justify-between gap-3">
                                              <span className="min-w-0 truncate font-semibold text-ob-ink">{row.title}</span>
                                              <span className="shrink-0 font-semibold text-ob-ink">{rp(row.amount)}</span>
                                          </span>
                                          <span className="flex items-center justify-between gap-3">
                                              <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ob-ink-2">
                                                  {row.category_label}
                                                  {showRequester && row.user_name ? ` · ${row.user_name}` : ''}
                                                  {row.expense_date ? ` · ${longDate(row.expense_date)}` : ''}
                                                  {row.has_attachment && <Paperclip className="h-3 w-3 shrink-0" aria-label="Ada bukti" />}
                                              </span>
                                              <ReimbursementStatusPill status={row.status} />
                                          </span>
                                          {row.status === 'approved' && row.amount_paid > 0 && <span className="text-xs text-ob-ink-2">sisa {rp(row.amount_remaining)}</span>}
                                      </button>
                                  </li>
                              ))}
                    </ul>

                    <div className="relative -mx-2 hidden overflow-x-auto px-2 md:block">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead>
                                <tr className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3">
                                    <th className="py-2.5 pl-3 font-medium">Pengajuan</th>
                                    {showRequester && <th className="py-2.5 font-medium">Pemohon</th>}
                                    <th className="py-2.5 font-medium">Tgl pengeluaran</th>
                                    <th className="py-2.5 pr-6 text-right font-medium">Nominal</th>
                                    <th className="py-2.5 font-medium">Status</th>
                                    <th className="w-10 py-2.5">
                                        <span className="sr-only">Buka</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody aria-busy={loading}>
                                {loading
                                    ? Array.from({ length: 5 }, (_, i) => (
                                          <tr key={i} className="border-b border-ob-line-soft">
                                              <td colSpan={showRequester ? 6 : 5} className="py-3">
                                                  <Skeleton className="h-9 rounded-xl bg-ob-inner dark:bg-ob-inner" />
                                              </td>
                                          </tr>
                                      ))
                                    : rows.map((row) => (
                                          <tr
                                              key={row.id}
                                              onClick={() => openResource('reimbursement', row.id)}
                                              className={cn('group cursor-pointer border-b border-ob-line-soft transition-colors hover:bg-ob-hover', row.id === openId && 'bg-ob-hover')}
                                          >
                                              <td className="py-3 pl-3 pr-4">
                                                  <button
                                                      type="button"
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          openResource('reimbursement', row.id);
                                                      }}
                                                      className="block max-w-[360px] truncate text-left font-semibold text-ob-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill"
                                                  >
                                                      {row.title}
                                                  </button>
                                                  <span className="flex items-center gap-1.5 text-xs text-ob-ink-2">
                                                      {row.category_label}
                                                      {row.has_attachment && <Paperclip className="h-3 w-3" aria-label="Ada bukti" />}
                                                  </span>
                                              </td>
                                              {showRequester && (
                                                  <td className="py-3 pr-4">
                                                      <span className="flex items-center gap-2">
                                                          <PersonAvatar name={row.user_name} />
                                                          <span className="truncate text-ob-ink">{row.user_name ?? '—'}</span>
                                                      </span>
                                                  </td>
                                              )}
                                              <td className="py-3 pr-4 text-ob-ink-2">{row.expense_date ? longDate(row.expense_date) : '—'}</td>
                                              <td className="py-3 pr-6 text-right">
                                                  <span className="font-semibold text-ob-ink">{rp(row.amount)}</span>
                                                  {row.status === 'approved' && row.amount_paid > 0 && <span className="block text-xs text-ob-ink-2">sisa {rp(row.amount_remaining)}</span>}
                                              </td>
                                              <td className="py-3">
                                                  <ReimbursementStatusPill status={row.status} />
                                              </td>
                                              <td className="py-3 pr-2 text-right">
                                                  <ChevronRight className="ml-auto h-4 w-4 text-ob-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                              </td>
                                          </tr>
                                      ))}
                            </tbody>
                        </table>
                    </div>
                    {!loading && rows.length === 0 && (
                        <EmptyList
                            filtered={hasFilters || !!filters.status}
                            statusLabel={filters.status ? STATUS_LABEL[filters.status as ReimbursementStatus]?.toLowerCase() : null}
                            onReset={resetFilters}
                            onCreate={() => setCreateOpen(true)}
                        />
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ob-line pt-4 text-[13px] text-ob-ink-2">
                        <span>{pagination.total} pengajuan · terbaru lebih dulu</span>
                        {pagination.last_page > 1 && <Pagination meta={pagination} onPageChange={(page) => navigate({ page })} />}
                    </div>
                </section>
            </div>

            <ReimbursementFormSheet
                open={createOpen}
                onOpenChange={setCreateOpen}
                categoryOptions={categoryOptions}
                initial={null}
                onSaved={(id) => {
                    router.reload({
                        onSuccess: () => {
                            if (id) openResource('reimbursement', id);
                        },
                    });
                }}
            />
        </>
    );
}

/* ─────────────────────────────────── bagian ─── */

function StatBlock({ label, value, sub, valueClass, onClick }: { label: string; value: string; sub: string; valueClass?: string; onClick?: () => void }) {
    const body = (
        <>
            <span className="text-[13px] text-ob-ink-2">{label}</span>
            <span className={cn('text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ob-ink sm:text-[26px]', valueClass)}>{value}</span>
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

function EmptyList({ filtered, statusLabel, onReset, onCreate }: { filtered: boolean; statusLabel: string | null; onReset: () => void; onCreate: () => void }) {
    return (
        <div className="my-2 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ob-line-strong px-6 py-10 text-center">
            <span className="text-sm font-semibold text-ob-ink">
                {filtered ? `Tidak ada pengajuan ${statusLabel ?? ''} yang cocok`.replace(/\s+/g, ' ') : 'Belum ada pengajuan'}
            </span>
            <span className="max-w-[380px] text-[13px] text-ob-ink-2">
                {filtered ? 'Ubah atau hapus filter untuk melihat pengajuan lain.' : 'Catat biaya yang Anda bayar lebih dulu untuk keperluan kantor, lalu ajukan ke finance.'}
            </span>
            {filtered ? (
                <Button variant="outline" className={BTN.small} onClick={onReset}>
                    Hapus filter
                </Button>
            ) : (
                <Button variant="outline" className={BTN.small} onClick={onCreate}>
                    Buat pengajuan
                </Button>
            )}
        </div>
    );
}

ReimbursementsIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
