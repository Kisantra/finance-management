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

export interface LoanRow {
    id: number;
    loan_number: string;
    lender_name: string;
    principal_amount: number;
    interest_type: 'fixed' | 'percentage';
    interest_amount: number | null;
    interest_rate: number | null;
    term_months: number;
    start_date: string;
    maturity_date: string;
    status: 'active' | 'paid_off';
    purpose: string | null;
    contract_attachment_url: string | null;
    paid_principal: number;
    paid_interest: number;
    remaining_principal: number;
}

export interface LoanFilters {
    search: string | null;
    status: string | null;
    per_page: number;
    page: number;
}

export interface LoanStats {
    total: number;
    total_principal: number;
    active_count: number;
    active_principal: number;
    /** Pokok pinjaman aktif yang belum dibayar — angka utama halaman. */
    outstanding_principal: number;
    /** Pokok & bunga yang sudah dibayar, dicakup ke pinjaman aktif saja. */
    paid_principal: number;
    paid_interest: number;
    /** Jatuh tempo terdekat di antara pinjaman aktif; null bila tidak ada yang aktif. */
    next_maturity: string | null;
}
