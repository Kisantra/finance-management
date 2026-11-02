import type { ReimbursementStatus } from './components/rb';

export interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

/** Baris ringkas daftar; detail lengkap diambil drawer dari /reimbursements/{id}/data. */
export interface ReimbursementRow {
    id: number;
    title: string;
    amount: number;
    amount_paid: number;
    amount_remaining: number;
    expense_date: string | null;
    category_input: string;
    category_label: string;
    status: ReimbursementStatus;
    user_name: string | null;
    user_id: number;
    has_attachment: boolean;
    created_at: string;
}

export interface ReimbursementFilters {
    tab: string;
    search: string | null;
    status: string | null;
    category: string | null;
    date_from: string | null;
    date_to: string | null;
    per_page: number;
    page: number;
}

export interface ReimbursementStats {
    total: number;
    total_amount: number;
    pending_count: number;
    pending_amount: number;
    approved_count: number;
    approved_remaining: number;
    total_paid: number;
}
