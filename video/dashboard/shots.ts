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
 * Dihasilkan oleh video/capture/dashboard.js; `chart`, `calendarGrid`, `first` disesuaikan manual.
 */
const top = {
    header: { x: 292, y: 92, w: 946, h: 54 },
    tutorial: { x: 977, y: 97, w: 115, h: 44 },
    createInvoice: { x: 1100, y: 97, w: 137, h: 44 },
    cashflow: { x: 292, y: 168, w: 624, h: 470 },
    balanceBlock: { x: 315, y: 243, w: 578, h: 66 },
    month: { x: 315, y: 320, w: 578, h: 42 },
    periods: { x: 427, y: 194, w: 234, h: 34 },
    account: { x: 669, y: 191, w: 224, h: 40 },
    chart: { x: 315, y: 378, w: 578, h: 258 },
    calendar: { x: 936, y: 168, w: 302, h: 470 },
    calendarGrid: { x: 959, y: 278, w: 256, h: 256 },
    calendarSummary: { x: 959, y: 545, w: 256, h: 90 },
    bell: { x: 1066, y: 26, w: 32, h: 32 },
};
const mid = {
    category: { x: 292, y: 400, w: 302, h: 320 },
    categoryTabs: { x: 315, y: 422, w: 208, h: 34 },
    donut: { x: 315, y: 504, w: 260, h: 150 },
    biggest: { x: 315, y: 665, w: 256, h: 46 },
    invoices: { x: 614, y: 400, w: 624, h: 320 },
    invoiceRow: { x: 637, y: 466, w: 578, h: 47 },
    invoiceMore: { x: 1081, y: 432, w: 134, h: 16 },
};
const bottom = {
    accounts: { x: 292, y: 258, w: 382, h: 300 },
    accountRow: { x: 315, y: 325, w: 326, h: 62 },
    recent: { x: 694, y: 258, w: 543, h: 300 },
    recentRow: { x: 717, y: 325, w: 487, h: 54 },
    allTime: { x: 292, y: 580, w: 946, h: 60 },
};

export const SHOTS = {
    'staff-top': top,
    'staff-weekly': top,
    'staff-range-first': { ...top, calendarSummary: { x: 959, y: 545, w: 256, h: 107 }, first: { x: 1071, y: 299, w: 31, h: 34 }, last: { x: 959, y: 379, w: 31, h: 34 } },
    'staff-range': { ...top, calendarSummary: { x: 959, y: 545, w: 256, h: 93 }, back: { x: 1063, y: 608, w: 137, h: 30 }, badge: { x: 1108, y: 198, w: 107, h: 22 } },
    'staff-account-open': { ...top, list: { x: 669, y: 272, w: 222, h: 228 }, option: { x: 675, y: 314, w: 210, h: 36 } },
    'staff-account': { ...top, note: { x: 315, y: 290, w: 420, h: 17 } },
    'staff-mid': mid,
    'staff-mid-income': mid,
    'staff-bottom': bottom,
    'staff-invoice': { dialog: { x: 360, y: 0, w: 920, h: 720 }, metrics: { x: 385, y: 154, w: 871, h: 105 } },
    'staff-forbidden': { message: { x: 385, y: 134, w: 510, h: 245 }, home: { x: 503, y: 343, w: 150, h: 36 } },
    'fm-top': { ...top, bell: { x: 1015, y: 26, w: 32, h: 32 } },
    'fm-mid': { ...mid, expenseLink: { x: 385, y: 693, w: 116, h: 15 } },
    'fm-bottom': {
        ...bottom,
        accountsLink: { x: 546, y: 290, w: 105, h: 16 },
        recentLink: { x: 1126, y: 290, w: 89, h: 16 },
        profitLoss: { x: 1093, y: 602, w: 122, h: 16 },
    },
    'admin-top': top,
    'admin-bottom': { ...bottom, profitLoss: { x: 1093, y: 602, w: 122, h: 16 } },
    'admin-bank': { accounts: { x: 292, y: 180, w: 218, h: 318 }, total: { x: 292, y: 515, w: 218, h: 100 } },
    'admin-permissions': {
        role: { x: 301, y: 498, w: 203, h: 65 },
        search: { x: 788, y: 322, w: 224, h: 40 },
        permission: { x: 554, y: 492, w: 219, h: 42 },
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
