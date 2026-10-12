import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminDrawerMenu from './screens/admin-drawer-menu.webp';
import adminExpenses from './screens/admin-expenses.webp';
import adminList from './screens/admin-list.webp';
import adminPl from './screens/admin-pl.webp';
import fmApproveEmpty from './screens/fm-approve-empty.webp';
import fmApproveFilled from './screens/fm-approve-filled.webp';
import fmDrawerApproved from './screens/fm-drawer-approved.webp';
import fmDrawerPaid from './screens/fm-drawer-paid.webp';
import fmDrawerPending from './screens/fm-drawer-pending.webp';
import fmList from './screens/fm-list.webp';
import fmPay from './screens/fm-pay.webp';
import fmReject from './screens/fm-reject.webp';
import staffDrawerPending from './screens/staff-drawer-pending.webp';
import staffDrawerRejected from './screens/staff-drawer-rejected.webp';
import staffFormAmount from './screens/staff-form-amount.webp';
import staffFormCategory from './screens/staff-form-category.webp';
import staffFormEmpty from './screens/staff-form-empty.webp';
import staffFormFilled from './screens/staff-form-filled.webp';
import staffFormTitle from './screens/staff-form-title.webp';
import staffList from './screens/staff-list.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot remotion/reimbursements/screens/*.webp.
 * Dihasilkan oleh remotion/capture/reimbursements.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 */
const formFields = {
    sheet: { x: 720, y: 0, w: 560, h: 720 },
    title: { x: 745, y: 112, w: 501, h: 42 },
    amount: { x: 788, y: 199, w: 199, h: 42 },
    date: { x: 1003, y: 199, w: 242, h: 42 },
    category: { x: 745, y: 285, w: 501, h: 42 },
    description: { x: 745, y: 372, w: 501, h: 80 },
    upload: { x: 745, y: 498, w: 501, h: 109 },
    draft: { x: 1009, y: 660, w: 129, h: 44 },
    submit: { x: 1146, y: 660, w: 110, h: 44 },
};

export const SHOTS = {
    'staff-list': {
        create: { x: 1068, y: 96, w: 169, h: 44 },
        summary: { x: 292, y: 164, w: 946, h: 122 },
        list: { x: 292, y: 310, w: 946, h: 546 },
        statusFilter: { x: 315, y: 332, w: 560, h: 40 },
    },
    'staff-form-empty': formFields,
    'staff-form-title': formFields,
    'staff-form-amount': formFields,
    'staff-form-category': { ...formFields, option: { x: 751, y: 375, w: 477, h: 36 }, list: { x: 745, y: 369, w: 499, h: 240 } },
    'staff-form-filled': {
        ...formFields,
        title: { x: 745, y: 112, w: 511, h: 42 },
        category: { x: 745, y: 285, w: 511, h: 42 },
        description: { x: 745, y: 372, w: 511, h: 80 },
        upload: { x: 745, y: 497, w: 511, h: 42 },
    },
    'staff-drawer-pending': {
        status: { x: 515, y: 29, w: 131, h: 22 },
        metrics: { x: 465, y: 162, w: 781, h: 85 },
        history: { x: 946, y: 267, w: 300, h: 152 },
        proof: { x: 465, y: 478, w: 461, h: 242 },
    },
    'staff-drawer-rejected': {
        banner: { x: 465, y: 162, w: 791, h: 77 },
        resubmit: { x: 990, y: 20, w: 218, h: 40 },
        status: { x: 515, y: 29, w: 75, h: 22 },
    },
    'fm-list': {
        scope: { x: 795, y: 98, w: 266, h: 40 },
        summary: { x: 292, y: 164, w: 946, h: 122 },
        statusFilter: { x: 315, y: 332, w: 561, h: 40 },
        row: { x: 315, y: 537, w: 900, h: 61 },
    },
    'fm-drawer-pending': {
        approve: { x: 1145, y: 20, w: 111, h: 40 },
        reject: { x: 1037, y: 20, w: 101, h: 40 },
        proof: { x: 465, y: 478, w: 461, h: 242 },
        metrics: { x: 465, y: 162, w: 781, h: 85 },
    },
    'fm-approve-empty': {
        dialog: { x: 416, y: 126, w: 448, h: 469 },
        category: { x: 441, y: 347, w: 398, h: 42 },
        notes: { x: 441, y: 429, w: 398, h: 80 },
        confirm: { x: 729, y: 525, w: 111, h: 44 },
    },
    'fm-approve-filled': {
        dialog: { x: 416, y: 126, w: 448, h: 469 },
        category: { x: 441, y: 347, w: 398, h: 42 },
        notes: { x: 441, y: 429, w: 398, h: 80 },
        confirm: { x: 729, y: 525, w: 111, h: 44 },
    },
    'fm-drawer-approved': {
        status: { x: 515, y: 29, w: 78, h: 22 },
        pay: { x: 1153, y: 20, w: 103, h: 40 },
        history: { x: 946, y: 313, w: 300, h: 256 },
    },
    'fm-pay': {
        dialog: { x: 416, y: 103, w: 448, h: 513 },
        account: { x: 441, y: 300, w: 398, h: 67 },
        date: { x: 441, y: 383, w: 191, h: 67 },
        amount: { x: 648, y: 383, w: 191, h: 67 },
        reference: { x: 441, y: 490, w: 398, h: 42 },
        confirm: { x: 699, y: 548, w: 140, h: 44 },
    },
    'fm-drawer-paid': {
        status: { x: 515, y: 29, w: 68, h: 22 },
        metrics: { x: 465, y: 162, w: 781, h: 105 },
        history: { x: 946, y: 313, w: 300, h: 286 },
    },
    'fm-reject': {
        dialog: { x: 416, y: 167, w: 448, h: 386 },
        notes: { x: 441, y: 388, w: 398, h: 80 },
        confirm: { x: 666, y: 484, w: 173, h: 44 },
    },
    'admin-list': {
        scope: { x: 795, y: 98, w: 266, h: 40 },
        summary: { x: 292, y: 164, w: 946, h: 122 },
        list: { x: 292, y: 310, w: 946, h: 410 },
    },
    'admin-drawer-menu': {
        more: { x: 1217, y: 20, w: 40, h: 40 },
        menu: { x: 1064, y: 64, w: 192, h: 42 },
    },
    // Dari remotion/capture/reimbursements-admin.js; expenseStat, beban, opexLine & unclassified disesuaikan manual.
    'admin-bank': {
        account: { x: 301, y: 234, w: 190, h: 88 },
        expenseStat: { x: 773, y: 336, w: 224, h: 60 },
    },
    'admin-expenses': {
        row: { x: 293, y: 501, w: 944, h: 61 },
        category: { x: 802, y: 521, w: 107, h: 20 },
        total: { x: 292, y: 222, w: 307, h: 128 },
    },
    'admin-pl': {
        beban: { x: 350, y: 222, w: 446, h: 150 },
        opexLine: { x: 350, y: 296, w: 446, h: 26 },
        unclassified: { x: 878, y: 70, w: 362, h: 500 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-drawer-menu': adminDrawerMenu,
    'admin-list': adminList,
    'admin-bank': adminBank,
    'admin-expenses': adminExpenses,
    'admin-pl': adminPl,
    'fm-approve-empty': fmApproveEmpty,
    'fm-approve-filled': fmApproveFilled,
    'fm-drawer-approved': fmDrawerApproved,
    'fm-drawer-paid': fmDrawerPaid,
    'fm-drawer-pending': fmDrawerPending,
    'fm-list': fmList,
    'fm-pay': fmPay,
    'fm-reject': fmReject,
    'staff-drawer-pending': staffDrawerPending,
    'staff-drawer-rejected': staffDrawerRejected,
    'staff-form-amount': staffFormAmount,
    'staff-form-category': staffFormCategory,
    'staff-form-empty': staffFormEmpty,
    'staff-form-filled': staffFormFilled,
    'staff-form-title': staffFormTitle,
    'staff-list': staffList,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua tombol bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
