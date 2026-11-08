import { Building2, ChevronRight, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import type { AccountListItem, OverallSummary } from '../types';

/** Ikon jenis akun: gedung = rekening bank, dompet = kas tunai. */
export function AccountTypeIcon({ account, className }: { account: Pick<AccountListItem, 'type'>; className?: string }) {
    return account.type === 'cash' ? <Wallet className={className} /> : <Building2 className={className} />;
}

/**
 * Baris kedua kartu akun (kartu ponsel): nama bank untuk rekening; label **Kas** + penanggung
 * jawab untuk kas. Label Kas sengaja di baris ini, bukan di samping nama, supaya nama kas tidak
 * terpotong (QA UX-01). Teks boleh turun baris; tidak ada yang dipotong.
 */
export function AccountSubtitle({ account }: { account: AccountListItem }) {
    if (account.type !== 'cash') {
        return <div className="break-words text-xs text-dark-500 dark:text-dark-400">{account.bank_name}</div>;
    }

    return (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-dark-500 dark:text-dark-400">
            <Badge variant="outline" size="sm" className="shrink-0">
                Kas
            </Badge>
            {account.custodian_name && <span className="min-w-0 break-words">{account.custodian_name}</span>}
        </div>
    );
}

interface Props {
    accounts: AccountListItem[];
    selectedAccountId: number | null;
    overall: OverallSummary;
    onSelect: (id: number) => void;
    /** Tidak diisi bila pengguna tidak boleh menambah akun: tombol Tambah Akun tidak dirender. */
    onCreate?: () => void;
}

/* Render-as-prop pattern to share data between desktop sidebar & mobile switcher. */
export function AccountSidebar({ accounts, selectedAccountId, overall, onSelect, onCreate }: Props) {
    const net = overall.income - overall.expense;

    return (
        <div className="hidden lg:block lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-4">
                {/* List */}
                <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 overflow-hidden">
                    <div className="px-4 py-3 border-b border-secondary-200 dark:border-dark-600 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-dark-900 dark:text-dark-50 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            Akun
                        </h3>
                        <span className="text-xs text-dark-500 dark:text-dark-400 font-medium">
                            {accounts.length}
                        </span>
                    </div>

                    <div className="p-2 space-y-1 max-h-[calc(100vh-28rem)] overflow-y-auto">
                        {accounts.map((account) => (
                            <AccountItem
                                key={account.id}
                                account={account}
                                active={selectedAccountId === account.id}
                                onSelect={() => onSelect(account.id)}
                            />
                        ))}
                        {onCreate && (
                            <button
                                onClick={onCreate}
                                className="group w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500 text-dark-400 dark:text-dark-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                            >
                                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
                                <span className="text-xs font-medium">Tambah Akun</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Overall summary */}
                <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 p-4 space-y-3">
                    <h4 className="text-[11px] font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                        Ringkasan Total
                    </h4>

                    <SummaryRow label="Total Saldo" value={overall.total_balance} bold accent="primary" />
                    <SummaryRow label="Total Bank" value={overall.total_bank} accent="primary" icon={<Building2 className="w-3.5 h-3.5" />} />
                    <SummaryRow label="Total Kas" value={overall.total_cash} accent="primary" icon={<Wallet className="w-3.5 h-3.5" />} />

                    <div className="h-px bg-secondary-200 dark:bg-dark-600" />

                    <SummaryRow label="Pemasukan" value={overall.income} accent="green" dot />
                    <SummaryRow label="Pengeluaran" value={overall.expense} accent="red" dot />

                    <div className="h-px bg-secondary-200 dark:bg-dark-600" />

                    <SummaryRow
                        label="Arus Bersih"
                        value={net}
                        bold
                        accent={net >= 0 ? 'blue' : 'orange'}
                        prefix={net >= 0 ? '+' : ''}
                    />
                </div>
            </div>
        </div>
    );
}

/* ─── Item ──────────────────────────────────────────────────── */

interface AccountItemProps {
    account: AccountListItem;
    active: boolean;
    onSelect: () => void;
}

function AccountItem({ account, active, onSelect }: AccountItemProps) {
    return (
        <button
            onClick={onSelect}
            className={cn(
                'group w-full text-left px-3 py-3 rounded-xl transition-all duration-150',
                active
                    ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700'
                    : 'hover:bg-secondary-50 dark:hover:bg-dark-600 border border-transparent',
            )}
        >
            <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-linear-to-br from-primary-400 to-primary-600 shadow-sm">
                        <AccountTypeIcon account={account} className="w-4 h-4 text-white" />
                    </div>
                    {active && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary-500 ring-2 ring-white dark:ring-dark-700" />
                    )}
                </div>

                {/*
                  * Daftar ini sempit (teks ±130 px pada 1280 px dengan menu terbuka). Nama mendapat
                  * baris sendiri dan turun baris, tidak dipotong: kas sering bernama mirip ("Kas Kecil
                  * …", "Kas Proyek …") dan dulu semuanya tampil "Kas …" (QA UX-01). Label Kas,
                  * penanggung jawab, dan tren pindah ke baris kedua.
                  */}
                <div className="min-w-0 flex-1">
                    <span className={cn(
                        'block break-words text-sm font-semibold leading-snug',
                        active ? 'text-primary-900 dark:text-primary-100' : 'text-dark-900 dark:text-dark-50',
                    )}>
                        {account.account_name}
                    </span>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-dark-500 dark:text-dark-400">
                        {account.type === 'cash' && <Badge variant="outline" size="sm" className="shrink-0">Kas</Badge>}
                        <AccountDetailText account={account} />
                        <span className="ml-auto shrink-0">
                            {account.trend === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                            )}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-1.5 pl-12 flex flex-wrap items-center justify-between gap-x-1">
                <span className={cn(
                    'whitespace-nowrap text-sm font-bold tracking-tight',
                    account.balance >= 0
                        ? 'text-dark-900 dark:text-dark-50'
                        : 'text-red-600 dark:text-red-400',
                )}>
                    {formatCurrency(account.balance)}
                </span>
                <ChevronRight
                    className={cn(
                        'w-3.5 h-3.5 transition-transform',
                        active
                            ? 'text-primary-500 translate-x-0.5'
                            : 'text-dark-300 dark:text-dark-500',
                    )}
                />
            </div>

            {account.refill_amount > 0 && (
                <div className="mt-1 pl-12 text-xs font-medium text-ob-wait">
                    Perlu isi ulang <span className="whitespace-nowrap">{formatCurrency(account.refill_amount)}</span>
                </div>
            )}
        </button>
    );
}

/**
 * Nama bank (rekening) atau penanggung jawab (kas) di baris kedua daftar desktop. Satu baris:
 * yang tidak muat dipotong, dan Tooltip menampilkan teks lengkapnya. Nama akun sendiri tidak
 * pernah dipotong; teks lengkap ini juga selalu terbaca di header akun terpilih.
 */
function AccountDetailText({ account }: { account: AccountListItem }) {
    const text = account.type === 'cash' ? account.custodian_name : account.bank_name;
    if (!text) return null;

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="min-w-0 truncate">{text}</span>
                </TooltipTrigger>
                <TooltipContent>{account.type === 'cash' ? `Penanggung jawab: ${text}` : text}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* ─── Summary row ───────────────────────────────────────────── */

interface SummaryRowProps {
    label: string;
    value: number;
    bold?: boolean;
    prefix?: string;
    accent: 'primary' | 'green' | 'red' | 'blue' | 'orange';
    dot?: boolean;
    icon?: React.ReactNode;
}

function SummaryRow({ label, value, bold, prefix, accent, dot, icon }: SummaryRowProps) {
    const accentMap = {
        primary: 'text-dark-900 dark:text-dark-50',
        green: 'text-green-600 dark:text-green-400',
        red: 'text-red-600 dark:text-red-400',
        blue: 'text-blue-600 dark:text-blue-400',
        orange: 'text-orange-600 dark:text-orange-400',
    };
    const dotColor = {
        primary: 'bg-primary-500',
        green: 'bg-green-500',
        red: 'bg-red-500',
        blue: 'bg-blue-500',
        orange: 'bg-orange-500',
    };

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-dark-600 dark:text-dark-400">
                {dot && <span className={cn('w-2 h-2 rounded-full', dotColor[accent])} />}
                {icon && <span className="text-dark-400 dark:text-dark-500">{icon}</span>}
                <span>{label}</span>
            </div>
            <span className={cn(
                'tracking-tight tabular-nums',
                bold ? 'text-sm font-bold' : 'text-sm font-semibold',
                accentMap[accent],
            )}>
                {prefix}{formatCurrency(value)}
            </span>
        </div>
    );
}

/* ─── Mobile horizontal switcher (separate export) ─────────── */

interface MobileSwitcherProps {
    accounts: AccountListItem[];
    selectedAccountId: number | null;
    overall: OverallSummary;
    onSelect: (id: number) => void;
    /** Tidak diisi bila pengguna tidak boleh menambah akun: kartu Tambah tidak dirender. */
    onCreate?: () => void;
}

export function MobileAccountSwitcher({
    accounts,
    selectedAccountId,
    overall,
    onSelect,
    onCreate,
}: MobileSwitcherProps) {
    if (accounts.length === 0) return null;

    return (
        <div className="lg:hidden space-y-3">
            <div className="overflow-x-auto pb-2 -mx-1 px-1">
                <div className="flex gap-3 min-w-max">
                    {accounts.map((account) => {
                        const active = selectedAccountId === account.id;
                        return (
                            <button
                                key={account.id}
                                onClick={() => onSelect(account.id)}
                                className={cn(
                                    'shrink-0 w-52 p-3 rounded-xl border-2 transition-all text-left',
                                    active
                                        ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-secondary-200 dark:border-dark-600 bg-white dark:bg-dark-700 hover:border-primary-300 dark:hover:border-primary-700',
                                )}
                            >
                                <div className="flex items-start gap-2.5 mb-2">
                                    <div className="h-8 w-8 bg-linear-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shrink-0">
                                        <AccountTypeIcon account={account} className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="break-words text-sm font-semibold leading-snug text-dark-900 dark:text-dark-50">
                                            {account.account_name}
                                        </div>
                                        <AccountSubtitle account={account} />
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-dark-900 dark:text-dark-50 tabular-nums">
                                    {formatCurrency(account.balance)}
                                </div>
                                {account.refill_amount > 0 && (
                                    <div className="mt-0.5 text-xs font-medium text-ob-wait">
                                        Isi ulang <span className="whitespace-nowrap">{formatCurrency(account.refill_amount)}</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                    {onCreate && (
                        <button
                            onClick={onCreate}
                            className="shrink-0 w-32 p-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500 flex flex-col items-center justify-center gap-2 transition-colors"
                        >
                            <Plus className="w-5 h-5 text-dark-400 dark:text-dark-500" />
                            <span className="text-xs text-dark-500 dark:text-dark-400">Tambah</span>
                        </button>
                    )}
                </div>
            </div>

            {/*
              * Ubin ringkasan dua kolom (Total Saldo selebar baris), urutannya sama dengan Ringkasan
              * Total di desktop. Tiga kolom hanya ±90 px per angka di ponsel 390 px sehingga
              * "Rp 51.500.000" terpotong (QA UX-01).
              */}
            <div className="grid grid-cols-2 gap-2">
                <CompactStat label="Total Saldo" value={overall.total_balance} tone="primary" className="col-span-2" />
                <CompactStat label="Total Bank" value={overall.total_bank} tone="primary" />
                <CompactStat label="Total Kas" value={overall.total_cash} tone="primary" />
                <CompactStat label="Pemasukan" value={overall.income} tone="green" />
                <CompactStat label="Pengeluaran" value={overall.expense} tone="red" />
            </div>
        </div>
    );
}

function CompactStat({ label, value, tone, className }: { label: string; value: number; tone: 'primary' | 'green' | 'red'; className?: string }) {
    const valueColor = {
        primary: 'text-dark-900 dark:text-dark-50',
        green: 'text-green-600 dark:text-green-400',
        red: 'text-red-600 dark:text-red-400',
    };
    return (
        <div className={cn('bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 p-3 text-center', className)}>
            <p className="text-[11px] text-dark-500 dark:text-dark-400 mb-0.5">{label}</p>
            {/* Tanpa truncate: angka yang tidak muat turun baris di spasi setelah "Rp", tidak terpotong. */}
            <p className={cn('text-sm font-bold tabular-nums leading-tight', valueColor[tone])}>
                {formatCurrency(value)}
            </p>
        </div>
    );
}
