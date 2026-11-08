import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminBottom from './screens/admin-bottom.webp';
import adminPermissions from './screens/admin-permissions.webp';
import adminTop from './screens/admin-top.webp';
import fmBottom from './screens/fm-bottom.webp';
import fmMid from './screens/fm-mid.webp';
import fmTop from './screens/fm-top.webp';
import staffAccount from './screens/staff-account.webp';
import staffAccountOpen from './screens/staff-account-open.webp';
import staffBottom from './screens/staff-bottom.webp';
import staffForbidden from './screens/staff-forbidden.webp';
import staffInvoice from './screens/staff-invoice.webp';
import staffMid from './screens/staff-mid.webp';
import staffMidIncome from './screens/staff-mid-income.webp';
import staffRange from './screens/staff-range.webp';
import staffRangeFirst from './screens/staff-range-first.webp';
import staffTop from './screens/staff-top.webp';
import staffWeekly from './screens/staff-weekly.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/dashboard/screens/*.webp.
 * Diambil ulang 9 Nov 2026 (data contoh di lingkungan QA terisolasi, setelah Ringkasan berhenti
 * menghitung transfer antar rekening sebagai pemasukan/pengeluaran) dengan lokator yang sama
 * dengan video/capture/dashboard.js; `chart` dan `donut` (donat + legenda) disesuaikan manual.
 */
const top = {
    header: { x: 292, y: 92, w: 947, h: 54 },
    tutorial: { x: 978, y: 97, w: 116, h: 44 },
    createInvoice: { x: 1102, y: 97, w: 137, h: 44 },
    cashflow: { x: 292, y: 168, w: 625, h: 470 },
    balanceBlock: { x: 315, y: 245, w: 579, h: 65 },
    month: { x: 315, y: 322, w: 579, h: 42 },
    periods: { x: 428, y: 195, w: 234, h: 34 },
    account: { x: 670, y: 191, w: 224, h: 42 },
    chart: { x: 315, y: 378, w: 578, h: 258 },
    calendar: { x: 937, y: 168, w: 302, h: 470 },
    calendarGrid: { x: 960, y: 279, w: 257, h: 254 },
    calendarSummary: { x: 960, y: 545, w: 257, h: 90 },
    bell: { x: 1062, y: 21, w: 42, h: 42 },
};
const mid = {
    category: { x: 292, y: 400, w: 302, h: 320 },
    categoryTabs: { x: 315, y: 423, w: 208, h: 34 },
    donut: { x: 315, y: 505, w: 257, h: 140 },
    biggest: { x: 315, y: 659, w: 257, h: 39 },
    invoices: { x: 614, y: 400, w: 625, h: 320 },
    invoiceRow: { x: 637, y: 467, w: 579, h: 47 },
    invoiceMore: { x: 1082, y: 433, w: 134, h: 16 },
};
const bottom = {
    accounts: { x: 292, y: 258, w: 383, h: 300 },
    accountRow: { x: 315, y: 324, w: 328, h: 62 },
    recent: { x: 695, y: 258, w: 544, h: 300 },
    recentRow: { x: 718, y: 324, w: 489, h: 54 },
    allTime: { x: 292, y: 580, w: 947, h: 60 },
};

export const SHOTS = {
    'staff-top': top,
    'staff-weekly': top,
    'staff-range-first': { ...top, calendarSummary: { x: 960, y: 545, w: 257, h: 107 }, first: { x: 1185, y: 299, w: 32, h: 34 }, last: { x: 960, y: 379, w: 32, h: 34 } },
    'staff-range': { ...top, calendarSummary: { x: 960, y: 545, w: 257, h: 140 }, back: { x: 1064, y: 600, w: 137, h: 30 }, badge: { x: 1109, y: 198, w: 107, h: 22 } },
    'staff-account-open': { ...top, list: { x: 671, y: 274, w: 222, h: 196 }, option: { x: 679, y: 318, w: 206, h: 36 } },
    'staff-account': { ...top, note: { x: 633, y: 293, w: 187, h: 16 } },
    'staff-mid': { ...mid, biggest: { x: 315, y: 678, w: 257, h: 20 } },
    'staff-mid-income': mid,
    'staff-bottom': bottom,
    'staff-invoice': { dialog: { x: 361, y: 0, w: 920, h: 720 }, metrics: { x: 386, y: 154, w: 871, h: 105 } },
    'staff-forbidden': { message: { x: 385, y: 134, w: 510, h: 245 }, home: { x: 504, y: 330, w: 153, h: 40 } },
    'fm-top': { ...top, bell: { x: 1006, y: 21, w: 42, h: 42 } },
    // Tautan "Lihat pengeluaran →" terbagi dua baris: `expenseLink` = keduanya (fokus), `expenseLinkText` = baris kedua (kursor).
    'fm-mid': { ...mid, expenseLink: { x: 315, y: 660, w: 245, h: 35 }, expenseLinkText: { x: 315, y: 680, w: 85, h: 15 } },
    'fm-bottom': {
        ...bottom,
        accountsLink: { x: 547, y: 291, w: 105, h: 16 },
        recentLink: { x: 1127, y: 291, w: 89, h: 16 },
        profitLoss: { x: 1094, y: 602, w: 122, h: 16 },
    },
    'admin-top': { ...top, bell: { x: 1043, y: 21, w: 42, h: 42 } },
    'admin-bottom': { ...bottom, profitLoss: { x: 1094, y: 602, w: 122, h: 16 } },
    'admin-bank': {
        accounts: { x: 292, y: 164, w: 219, h: 319 },
        total: { x: 292, y: 499, w: 219, h: 142 },
        // Baris Pemasukan & Pengeluaran Ringkasan Total (semua akun, tanpa transfer antar akun sendiri).
        totalFlow: { x: 292, y: 648, w: 219, h: 62 },
    },
    'admin-permissions': {
        role: { x: 301, y: 549, w: 203, h: 66 },
        search: { x: 788, y: 303, w: 224, h: 42 },
        permission: { x: 554, y: 475, w: 219, h: 42 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

export const SCREENS: Record<ShotName, string> = {
    'admin-bank': adminBank,
    'admin-bottom': adminBottom,
    'admin-permissions': adminPermissions,
    'admin-top': adminTop,
    'fm-bottom': fmBottom,
    'fm-mid': fmMid,
    'fm-top': fmTop,
    'staff-account': staffAccount,
    'staff-account-open': staffAccountOpen,
    'staff-bottom': staffBottom,
    'staff-forbidden': staffForbidden,
    'staff-invoice': staffInvoice,
    'staff-mid': staffMid,
    'staff-mid-income': staffMidIncome,
    'staff-range': staffRange,
    'staff-range-first': staffRangeFirst,
    'staff-top': staffTop,
    'staff-weekly': staffWeekly,
};

export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
