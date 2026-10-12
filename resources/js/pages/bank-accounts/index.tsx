import { Head, router } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowUpRight,
    Building2,
    Download,
    MoreHorizontal,
    Pencil,
    Plus,
    TrendingDown,
    TrendingUp,
    Trash2,
    Wallet,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Tabs } from '@/components/ui/tabs';
import { TutorialButton } from '@/components/tutorial/tutorial-button';
import { AppLayout } from '@/layouts/app-layout';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import * as bankAccountsRoutes from '@/routes/bank-accounts';
import { AccountCharts } from './components/account-charts';
import { AccountFormDialog } from './components/account-form-dialog';
import { AccountSidebar, MobileAccountSwitcher } from './components/account-sidebar';
import { PaymentsTab } from './components/payments-tab';
import { TransactionFormDialog } from './components/transaction-form-dialog';
import { TransactionsTab } from './components/transactions-tab';
import { TransferDialog } from './components/transfer-dialog';
import type { AccountDetail, AccountListItem, OverallSummary } from './types';

interface Props {
    accounts: AccountListItem[];
    overallSummary: OverallSummary;
    detail: AccountDetail | null;
    filters: {
        account: number | null;
        month: string;
    };
}

type TabKey = 'transactions' | 'payments';

export default function BankAccountsIndex({ accounts, overallSummary, detail, filters }: Props) {
    const { can } = useCan();
    const selectedAccount = accounts.find((a) => a.id === filters.account) ?? null;

    // Dialog state
    const [createOpen, setCreateOpen] = React.useState(false);
    const [editAccount, setEditAccount] = React.useState<AccountListItem | null>(null);
    const [deleteAccount, setDeleteAccount] = React.useState<AccountListItem | null>(null);
    const [deleteProcessing, setDeleteProcessing] = React.useState(false);

    const [txType, setTxType] = React.useState<'credit' | 'debit' | null>(null);
    const [transferOpen, setTransferOpen] = React.useState(false);

    // Persist active tab in localStorage
    const [activeTab, setActiveTab] = React.useState<TabKey>(() => {
        if (typeof window === 'undefined') return 'transactions';
        const stored = localStorage.getItem('bank-accounts.tab');
        return stored === 'payments' ? 'payments' : 'transactions';
    });
    React.useEffect(() => {
        localStorage.setItem('bank-accounts.tab', activeTab);
    }, [activeTab]);

    // refreshKey forces TransactionsTab / PaymentsTab to refetch after mutation
    const [refreshKey, setRefreshKey] = React.useState(0);

    const selectAccount = (id: number) => {
        router.get(
            bankAccountsRoutes.index.url({ query: { account: id } }),
            {},
            { preserveScroll: true, preserveState: true, only: ['detail', 'filters'] },
        );
    };

    const changeMonth = (month: string) => {
        router.get(
            bankAccountsRoutes.index.url({
                query: {
                    account: filters.account ?? undefined,
                    month: month || undefined,
                },
            }),
            {},
            { preserveScroll: true, preserveState: true, only: ['detail', 'filters'] },
        );
    };

    const handleAccountDelete = () => {
        if (!deleteAccount) return;
        setDeleteProcessing(true);
        router.delete(bankAccountsRoutes.destroy.url({ bankAccount: deleteAccount.id }), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Rekening berhasil dihapus');
                setDeleteAccount(null);
            },
            onError: () => toast.error('Gagal menghapus rekening'),
            onFinish: () => setDeleteProcessing(false),
        });
    };

    const exportPdf = () => {
        if (!filters.account) {
            toast.warning('Pilih rekening terlebih dulu');
            return;
        }
        const url = `/bank-account/export/pdf?bank_account_id=${filters.account}`;
        window.open(url, '_blank');
        toast.info('Membuka laporan PDF...');
    };

    return (
        <AppLayout>
            <Head title="Rekening Bank" />

            <div className="space-y-6">
                <PageHeader
                    title="Rekening Bank"
                    description="Pantau saldo, transaksi, dan pembayaran di semua rekening Anda."
                    action={
                        <div className="flex items-center gap-2 flex-wrap">
                            <TutorialButton slug="bank-accounts" />
                            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Tambah Rekening
                            </Button>
                        </div>
                    }
                />

                {accounts.length === 0 ? (
                    <div className="bg-white dark:bg-dark-700 border border-secondary-200 dark:border-dark-600 rounded-xl">
                        <EmptyState
                            icon={<Building2 className="w-7 h-7" />}
                            title="Belum ada rekening"
                            description="Mulai dengan menambahkan rekening bank pertama Anda untuk melacak transaksi."
                            action={
                                <Button onClick={() => setCreateOpen(true)}>
                                    <Plus className="w-4 h-4" />
                                    Tambah Rekening
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <>
                        {/* Mobile switcher */}
                        <MobileAccountSwitcher
                            accounts={accounts}
                            selectedAccountId={filters.account}
                            overall={overallSummary}
                            onSelect={selectAccount}
                            onCreate={() => setCreateOpen(true)}
                        />

                        {/* Master-detail grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <AccountSidebar
                                accounts={accounts}
                                selectedAccountId={filters.account}
                                overall={overallSummary}
                                onSelect={selectAccount}
                                onCreate={() => setCreateOpen(true)}
                            />

                            <div className="lg:col-span-9 space-y-6">
                                {selectedAccount && detail ? (
                                    <>
                                        {/* Selected account header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-linear-to-br from-primary-400 to-primary-600 shadow-md shadow-primary-200/40 dark:shadow-primary-900/30">
                                                    <Wallet className="w-6 h-6 text-white" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="text-xl font-bold text-dark-900 dark:text-dark-50 truncate">
                                                        {selectedAccount.account_name}
                                                    </h2>
                                                    <p className="text-sm text-dark-500 dark:text-dark-400 truncate">
                                                        {selectedAccount.bank_name}
                                                        {selectedAccount.account_number && (
                                                            <>
                                                                <span className="mx-2">·</span>
                                                                <span className="font-mono">{selectedAccount.account_number}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <TrendBadge trend={selectedAccount.trend} />
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                {can('create expense') && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => setTxType('debit')}
                                                        className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40"
                                                    >
                                                        <ArrowUpRight className="w-4 h-4" />
                                                        Pengeluaran
                                                    </Button>
                                                )}
                                                {can('create income') && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => setTxType('credit')}
                                                        className="bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/40"
                                                    >
                                                        <ArrowDownLeft className="w-4 h-4" />
                                                        Pemasukan
                                                    </Button>
                                                )}
                                                {can('create transfer') && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => setTransferOpen(true)}
                                                        className="bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40"
                                                    >
                                                        <ArrowLeftRight className="w-4 h-4" />
                                                        <span className="hidden sm:inline">Transfer</span>
                                                    </Button>
                                                )}

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuItem onClick={() => setEditAccount(selectedAccount)}>
                                                            <Pencil className="w-4 h-4" />
                                                            Edit Rekening
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={exportPdf}>
                                                            <Download className="w-4 h-4" />
                                                            Export PDF
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => setDeleteAccount(selectedAccount)}
                                                            className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Hapus Rekening
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        {/* Charts */}
                                        <AccountCharts
                                            detail={detail}
                                            selectedMonth={filters.month}
                                            onMonthChange={changeMonth}
                                        />

                                        {/* Tabs */}
                                        <div>
                                            <div className="flex items-center gap-4 mb-4">
                                                <Tabs
                                                    items={[
                                                        { value: 'transactions', label: 'Transaksi', icon: <ArrowLeftRight className="h-4 w-4" /> },
                                                        { value: 'payments', label: 'Pembayaran', icon: <Wallet className="h-4 w-4" /> },
                                                    ]}
                                                    value={activeTab}
                                                    onChange={(v) => setActiveTab(v as TabKey)}
                                                />
                                                <div className="hidden sm:flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="h-px flex-1 bg-linear-to-r from-zinc-200 dark:from-dark-600 to-transparent" />
                                                    <p className="text-xs text-dark-400 dark:text-dark-500 whitespace-nowrap">
                                                        {activeTab === 'transactions'
                                                            ? 'Transaksi yang dicatat manual'
                                                            : 'Pembayaran invoice ke rekening ini'}
                                                    </p>
                                                </div>
                                            </div>

                                            {activeTab === 'transactions' && (
                                                <TransactionsTab accountId={selectedAccount.id} refreshKey={refreshKey} />
                                            )}
                                            {activeTab === 'payments' && (
                                                <PaymentsTab accountId={selectedAccount.id} refreshKey={refreshKey} />
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-white dark:bg-dark-700 border border-secondary-200 dark:border-dark-600 rounded-xl">
                                        <EmptyState
                                            icon={<Building2 className="w-7 h-7" />}
                                            title="Pilih rekening"
                                            description="Klik salah satu rekening di sidebar untuk melihat detailnya."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Dialogs */}
            <AccountFormDialog open={createOpen} onOpenChange={setCreateOpen} />
            <AccountFormDialog
                open={editAccount !== null}
                onOpenChange={(open) => !open && setEditAccount(null)}
                account={editAccount}
            />
            <ConfirmDialog
                open={deleteAccount !== null}
                onOpenChange={(open) => !open && setDeleteAccount(null)}
                title="Hapus rekening?"
                description={`Rekening "${deleteAccount?.account_name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
                confirmLabel="Hapus"
                loading={deleteProcessing}
                onConfirm={handleAccountDelete}
            />
            {selectedAccount && txType && (
                <TransactionFormDialog
                    open={txType !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setTxType(null);
                            setRefreshKey((k) => k + 1);
                            // Also refresh the main page for stats/charts
                            router.reload({ only: ['detail', 'accounts', 'overallSummary'] });
                        }
                    }}
                    accountId={selectedAccount.id}
                    accounts={accounts}
                    type={txType}
                />
            )}
            <TransferDialog
                open={transferOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setTransferOpen(false);
                        setRefreshKey((k) => k + 1);
                        router.reload({ only: ['detail', 'accounts', 'overallSummary'] });
                    }
                }}
                accounts={accounts}
                fromAccountId={selectedAccount?.id ?? null}
            />
        </AppLayout>
    );
}

/* ─── Helpers ───────────────────────────────────────────────── */

function TrendBadge({ trend }: { trend: 'up' | 'down' }) {
    const isUp = trend === 'up';
    return (
        <span className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg',
            isUp
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
        )}>
            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isUp ? 'Naik' : 'Turun'}
        </span>
    );
}

