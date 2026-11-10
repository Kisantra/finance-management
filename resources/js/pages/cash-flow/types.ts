/* Shared types for cash-flow pages */

import type { ManagedBy } from '@/components/shared/financing';
import type { JournalLine } from '@/lib/journal';

export interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface FilterOption {
    label: string;
    value: number;
    disabled?: boolean;
    /** Kategori bertipe `financing` (grup Pendanaan, selalu terakhir). */
    financing?: boolean;
    /** Akun lawan di pratinjau jurnal (JournalService::counterAccount); hanya opsi yang bisa dipilih. */
    journal_account?: string;
}

/**
 * Ringkasan tab. Pemasukan/Pengeluaran: `total_amount` = `pl_amount` (masuk Laba Rugi, termasuk
 * pembayaran invoice) + `financing_amount` (pendanaan, tidak masuk Laba Rugi). Tab Transfer hanya
 * mengisi `total_amount` & `total_count`.
 */
export interface CashFlowStats {
    total_amount: number;
    total_count: number;
    pl_amount?: number;
    financing_amount?: number;
}

/** Penanda jenis baris dari server: pendanaan & modul pengelola (pokok utang/piutang, hanya-lihat). */
export interface RowKind {
    category_type: 'income' | 'expense' | 'financing' | string | null;
    is_financing: boolean;
    managed_by: ManagedBy | null;
    /** Jurnal tampilan dari server (JournalService) — sumber tunggal untuk transaksi tersimpan. */
    journal: JournalLine[];
}

/* ─── Tab Semua (pemasukan + pengeluaran) ──────────── */

export interface CombinedRow extends RowKind {
    /** `payment-{id}` atau `transaction-{id}` */
    uid: string;
    id: number;
    source_type: 'payment' | 'transaction';
    direction: 'in' | 'out';
    date: string;
    amount: number;
    reference_number: string | null;
    invoice_number: string | null;
    client_name: string | null;
    bank_name: string;
    account_type?: string | null;
    category_id: number | null;
    category_label: string | null;
    description: string | null;
    /** Nama pencatat; null = data lama sebelum pencatat direkam ("Tidak tercatat"). */
    input_by: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
}

export interface CombinedStats {
    total_in: number;
    total_out: number;
    net: number;
    total_count: number;
    /** Bagian pendanaan yang SUDAH termasuk di total_in / total_out. */
    financing_in: number;
    financing_out: number;
}

export interface CombinedFilters {
    date_from: string | null;
    date_to: string | null;
    bank_accounts: number[];
    categories: number[];
    input_by: number | null;
    search: string | null;
    sort: string;
    direction: 'asc' | 'desc';
    per_page: number;
    page: number;
}

/* ─── Income page ──────────────────────────────────── */

export interface IncomeRow extends RowKind {
    uid: string;
    id: number;
    source_type: 'payment' | 'transaction' | string;
    date: string;
    amount: number;
    reference_number: string | null;
    invoice_number: string | null;
    client_name: string | null;
    bank_name: string;
    account_type?: string | null;
    category_id: number | null;
    category_label: string | null;
    description: string | null;
    input_by: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
}

export interface IncomeFilters {
    date_from: string | null;
    date_to: string | null;
    clients: number[];
    categories: number[];
    input_by: number | null;
    search: string | null;
    sort: string;
    direction: 'asc' | 'desc';
    per_page: number;
    page: number;
}

/* ─── Expenses page ────────────────────────────────── */

export interface ExpenseRow extends RowKind {
    id: number;
    transaction_date: string;
    amount: number;
    description: string | null;
    reference_number: string | null;
    category_id: number;
    category_label: string | null;
    bank_name: string;
    account_type?: string | null;
    account_name: string;
    input_by: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
}

export interface ExpenseFilters {
    date_from: string | null;
    date_to: string | null;
    categories: number[];
    bank_accounts: number[];
    input_by: number | null;
    search: string | null;
    sort: string;
    direction: 'asc' | 'desc';
    per_page: number;
    page: number;
}

/* ─── Transfers page ───────────────────────────────── */

export interface TransferRow {
    id: number;
    debit_id: number | null;
    transaction_date: string;
    reference_number: string | null;
    amount: number;
    total_debit: number;
    admin_fee: number;
    description: string | null;
    from_account: {
        id: number;
        account_name: string;
        bank_name: string;
    } | null;
    to_account: {
        id: number;
        account_name: string;
        bank_name: string;
    };
    /** Jurnal tampilan dari server: Debit tujuan (+ biaya admin) / Kredit asal. */
    journal: JournalLine[];
    attachment_url: string | null;
    attachment_name: string | null;
}

export interface TransferFilters {
    date_from: string | null;
    date_to: string | null;
    bank_accounts: number[];
    search: string | null;
    per_page: number;
    page: number;
}
