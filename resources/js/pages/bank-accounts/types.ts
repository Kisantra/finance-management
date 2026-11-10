/* Shared types for the bank-accounts page family */

import type { ManagedBy } from '@/components/shared/financing';
import type { JournalLine } from '@/lib/journal';

import { t } from '@/i18n';

/** `bank` = rekening bank, `cash` = kas tunai / kas kecil (nomor diisi kode KAS-xxxx, bank "Tunai"). */
export type AccountType = 'bank' | 'cash';

export interface AccountListItem {
    id: number;
    type: AccountType;
    account_name: string;
    account_number: string;
    bank_name: string;
    /** Nama akun ini di jurnal (BankAccount::journalNameFor): "BCA Operasional — BCA" / "Kas Kecil". */
    journal_name: string;
    branch: string | null;
    initial_balance: number;
    balance: number;
    /** Penanggung jawab kas (id pengguna pusat); null untuk rekening bank. */
    custodian_id: number | null;
    custodian_name: string | null;
    /** Plafon kas kecil; null = tanpa plafon. */
    cash_limit: number | null;
    /** Plafon − saldo bila saldo di bawah plafon; 0 bila tidak perlu diisi ulang. */
    refill_amount: number;
    trend: 'up' | 'down';
}

export interface OverallSummary {
    total_balance: number;
    total_bank: number;
    total_cash: number;
    income: number;
    expense: number;
}

export interface CustodianOption {
    value: number;
    label: string;
}

export interface AccountStats {
    total_income: number;
    total_expense: number;
    net_cashflow: number;
    transaction_count: number;
}

export interface ChartMonth {
    month: string;
    income: number;
    expense: number;
}

export interface CategoryBreakdown {
    name: string;
    total: number;
}

export interface PeriodInfo {
    start: string | null;
    end: string | null;
    label: string;
    is_all_time: boolean;
}

export interface AccountDetail {
    period: PeriodInfo;
    stats: AccountStats;
    chart_months: ChartMonth[];
    category_breakdown: CategoryBreakdown[];
}

export interface TransactionRow {
    id: number;
    description: string;
    transaction_type: 'credit' | 'debit';
    transaction_date: string;
    amount: number;
    reference_number: string | null;
    category: {
        id: number;
        label: string;
        parent_label: string | null;
        type: string;
    } | null;
    /** Pokok utang/piutang yang dicatat modul Utang/Piutang: hanya-lihat (tanpa hapus). */
    managed_by: ManagedBy | null;
    /** Jurnal tampilan dari server (JournalService); kaki transfer = jurnal transfer lengkapnya. */
    journal: JournalLine[];
    attachment_url: string | null;
    attachment_name: string | null;
}

export interface PaymentRow {
    id: number;
    payment_date: string;
    amount: number;
    payment_method: 'cash' | 'bank_transfer' | string;
    reference_number: string | null;
    invoice_number: string | null;
    invoice_status: string;
    client_name: string;
    client_type: string;
    /** Jurnal tampilan pembayaran invoice ("titipan dulu") dari server. */
    journal: JournalLine[];
    attachment_url: string | null;
    attachment_name: string | null;
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface CategoryOption {
    label: string;
    value: number;
    disabled?: boolean;
    /** Kategori bertipe `financing` (grup Pendanaan, selalu terakhir). */
    financing?: boolean;
    /** Akun lawan di pratinjau jurnal (JournalService::counterAccount); hanya opsi yang bisa dipilih. */
    journal_account?: string;
}

export interface AccountOption {
    label: string;
    value: number;
}

/** Minimal account shape the create/transfer dialogs need for their pickers. */
export interface AccountPickerItem {
    id: number;
    account_name: string;
    bank_name: string;
    /** Nama akun ini di jurnal (BankAccount::journalNameFor). */
    journal_name: string;
    /** Jenis akun; bila ada, akun kas ditampilkan "Tunai" sesuai bahasa, bukan nilai tersimpan. */
    type?: AccountType;
}

/**
 * Label tampilan nama bank: akun kas menyimpan `bank_name = 'Tunai'` (data), tetapi yang tampil
 * diturunkan dari jenis akun supaya ikut bahasa aktif.
 */
export function bankNameLabel(bankName: string, type?: AccountType | string | null): string {
    return type === 'cash' || (type == null && bankName === 'Tunai') ? t('Tunai') : bankName;
}
