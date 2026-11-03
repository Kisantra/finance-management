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
    value: number | string;
}

export interface ReceivableRow {
    id: number;
    receivable_number: string;
    type: 'employee_loan' | 'company_loan';
    debtor_id: number;
    debtor_name: string | null;
    debtor_type: string;
    principal_amount: number;
    interest_rate: number;
    installment_months: number;
    installment_amount: number;
    loan_date: string;
    due_date: string;
    status: 'draft' | 'pending_approval' | 'active' | 'paid_off' | 'rejected';
    purpose: string;
    notes: string | null;
    disbursement_account: string;
    approved_by_name: string | null;
    approved_at: string | null;
    review_notes: string | null;
    rejection_reason: string | null;
    contract_attachment_url: string | null;
    contract_attachment_name: string | null;
    paid_principal: number;
    paid_interest: number;
    remaining_principal: number;
    can_submit: boolean;
    can_approve: boolean;
    can_pay: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

export interface ReceivableFilters {
    search: string | null;
    status: string | null;
    type: string | null;
    per_page: number;
    page: number;
}

export type ReceivableStatus = 'draft' | 'pending_approval' | 'active' | 'paid_off' | 'rejected';

export interface ReceivableStats {
    total: number;
    active_count: number;
    pending_count: number;
    total_principal_active: number;
    /** Pokok piutang aktif yang belum kembali — angka utama halaman. */
    outstanding_principal: number;
    paid_principal: number;
    paid_interest: number;
    /** Nilai pokok yang sedang menunggu persetujuan. */
    pending_amount: number;
    /** Piutang aktif yang lewat jatuh tempo dan pokoknya belum tertutup. */
    overdue_count: number;
    overdue_amount: number;
    /** Jatuh tempo terdekat di antara piutang aktif; null bila tidak ada yang aktif. */
    next_due: string | null;
}
