import { Building2, ChevronRight, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import type { AccountListItem, OverallSummary } from '../types';

/** Ikon jenis akun: gedung = rekening bank, dompet = kas tunai. */
export function AccountTypeIcon({ account, className }: { account: Pick<AccountListItem, 'type'>; className?: string }) {
    return account.type === 'cash' ? <Wallet className={className} /> : <Building2 className={className} />;
}

/** Baris kedua kartu akun: nama bank untuk rekening, penanggung jawab untuk kas. */
export function accountSubtitle(account: AccountListItem): string {
    if (account.type !== 'cash') return account.bank_name;
    return account.custodian_name ? `Kas tunai · ${account.custodian_name}` : 'Kas tunai';
}

interface Props {
    accounts: AccountListItem[];
    selectedAccountId: number | null;
    overall: OverallSummary;
    onSelect: (id: number) => void;
    onCreate: () => void;
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
                        <button
                            onClick={onCreate}
                            className="group w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500 text-dark-400 dark:text-dark-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
                            <span className="text-xs font-medium">Tambah Akun</span>
                        </button>
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
            <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-linear-to-br from-primary-400 to-primary-600 shadow-sm">
                        <AccountTypeIcon account={account} className="w-4 h-4 text-white" />
                    </div>
                    {active && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary-500 ring-2 ring-white dark:ring-dark-700" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn(
                            'font-semibold text-sm truncate',
                            active ? 'text-primary-900 dark:text-primary-100' : 'text-dark-900 dark:text-dark-50',
                        )}>
                            {account.account_name}
                        </span>
                        {account.type === 'cash' && <Badge variant="outline" size="sm" className="shrink-0">Kas</Badge>}
                    </div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 truncate">
                        {accountSubtitle(account)}
                    </div>
                </div>

                <div className="shrink-0">
                    {account.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                </div>
            </div>

            <div className="mt-1.5 pl-12 flex items-center justify-between">
                <span className={cn(
                    'text-sm font-bold tracking-tight',
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
                    Perlu isi ulang {formatCurrency(account.refill_amount)}
                </div>
            )}
        </button>
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
    onCreate: () => void;
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
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className="h-8 w-8 bg-linear-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shrink-0">
                                        <AccountTypeIcon account={account} className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-semibold text-sm text-dark-900 dark:text-dark-50 truncate">
                                            {account.account_name}
                                        </div>
                                        <div className="text-xs text-dark-500 dark:text-dark-400 truncate">
                                            {accountSubtitle(account)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-dark-900 dark:text-dark-50 tabular-nums">
                                    {formatCurrency(account.balance)}
                                </div>
                                {account.refill_amount > 0 && (
                                    <div className="mt-0.5 text-xs font-medium text-ob-wait truncate">
                                        Isi ulang {formatCurrency(account.refill_amount)}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                    <button
                        onClick={onCreate}
                        className="shrink-0 w-32 p-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500 flex flex-col items-center justify-center gap-2 transition-colors"
                    >
                        <Plus className="w-5 h-5 text-dark-400 dark:text-dark-500" />
                        <span className="text-xs text-dark-500 dark:text-dark-400">Tambah</span>
                    </button>
                </div>
            </div>

            {/* Compact stats */}
            <div className="grid grid-cols-3 gap-2">
                <CompactStat label="Total Saldo" value={overall.total_balance} tone="primary" />
                <CompactStat label="Pemasukan" value={overall.income} tone="green" />
                <CompactStat label="Pengeluaran" value={overall.expense} tone="red" />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <CompactStat label="Total Bank" value={overall.total_bank} tone="primary" />
                <CompactStat label="Total Kas" value={overall.total_cash} tone="primary" />
            </div>
        </div>
    );
}

function CompactStat({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'green' | 'red' }) {
    const valueColor = {
        primary: 'text-dark-900 dark:text-dark-50',
        green: 'text-green-600 dark:text-green-400',
        red: 'text-red-600 dark:text-red-400',
    };
    return (
        <div className="bg-white dark:bg-dark-700 rounded-xl border border-secondary-200 dark:border-dark-600 p-3 text-center">
            <p className="text-[11px] text-dark-500 dark:text-dark-400 mb-0.5">{label}</p>
            <p className={cn('text-sm font-bold tabular-nums truncate', valueColor[tone])}>
                {formatCurrency(value)}
            </p>
        </div>
    );
}
