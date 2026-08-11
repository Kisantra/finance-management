export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
}

export interface Auth {
    user: User | null;
    permissions: string[];
    roles: string[];
}

export interface Flash {
    success?: string | null;
    error?: string | null;
    warning?: string | null;
    info?: string | null;
}

export interface NotificationItem {
    id: number;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown> | null;
    read_at: string | null;
    created_at: string;
    icon: string;
    color: string;
}

export interface SharedNotifications {
    recent: NotificationItem[];
    unread_count: number;
}

export interface CompanyOption {
    slug: string;
    name: string;
    abbreviation: string;
}

export type SharedProps = {
    auth: Auth;
    locale: string;
    flash: Flash;
    company: CompanyOption | null;
    companies: CompanyOption[];
    notifications: SharedNotifications | null;
    actionCounts: { reimbursements: number; fund_requests: number } | null;
    [key: string]: unknown;
};
