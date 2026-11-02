import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminDetailAfter from './screens/admin-detail-after.webp';
import adminIncome from './screens/admin-income.webp';
import adminList from './screens/admin-list.webp';
import fmApproveEmpty from './screens/fm-approve-empty.webp';
import fmApproveFilled from './screens/fm-approve-filled.webp';
import fmDetailActive from './screens/fm-detail-active.webp';
import fmDetailPending from './screens/fm-detail-pending.webp';
import fmListActive from './screens/fm-list-active.webp';
import fmListPending from './screens/fm-list-pending.webp';
import fmPayMethod from './screens/fm-pay-method.webp';
import fmPayPayroll from './screens/fm-pay-payroll.webp';
import fmPayTransferSave from './screens/fm-pay-transfer-save.webp';
import fmPayTransfer from './screens/fm-pay-transfer.webp';
import fmReject from './screens/fm-reject.webp';
import staffDetailRejected from './screens/staff-detail-rejected.webp';
import staffFormAmount from './screens/staff-form-amount.webp';
import staffFormDebtor from './screens/staff-form-debtor.webp';
import staffFormDisbursement from './screens/staff-form-disbursement.webp';
import staffFormEmpty from './screens/staff-form-empty.webp';
import staffFormFilled from './screens/staff-form-filled.webp';
import staffFormMonths from './screens/staff-form-months.webp';
import staffListDraft from './screens/staff-list-draft.webp';
import staffListPending from './screens/staff-list-pending.webp';
import staffList from './screens/staff-list.webp';
import staffSubmitConfirm from './screens/staff-submit-confirm.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/receivables/screens/*.webp.
 * Dari video/capture/receivables*.js; fm-pay-method, label field di dialog bayar, dan lebar baris
 * admin-bank disesuaikan manual dari gambar.
 */
const formTop = {
    sheet: { x: 704, y: 0, w: 576, h: 720 },
    type: { x: 729, y: 204, w: 517, h: 42 },
    debtor: { x: 729, y: 287, w: 517, h: 40 },
    amount: { x: 772, y: 487, w: 474, h: 40 },
    interestType: { x: 729, y: 569, w: 517, h: 42 },
    rate: { x: 729, y: 652, w: 250, h: 40 },
    months: { x: 995, y: 652, w: 250, h: 40 },
    save: { x: 1136, y: 668, w: 120, h: 36 },
};
const formBottom = {
    sheet: { x: 704, y: 0, w: 576, h: 720 },
    disbursement: { x: 729, y: 350, w: 517, h: 40 },
    purpose: { x: 729, y: 432, w: 517, h: 40 },
    notes: { x: 729, y: 514, w: 517, h: 80 },
    save: { x: 1136, y: 668, w: 120, h: 36 },
};
const approve = {
    dialog: { x: 416, y: 117, w: 448, h: 486 },
    summary: { x: 417, y: 178, w: 446, h: 110 },
    choice: { x: 417, y: 288, w: 446, h: 42 },
    bank: { x: 417, y: 346, w: 446, h: 66 },
    notes: { x: 417, y: 454, w: 446, h: 80 },
    confirm: { x: 695, y: 550, w: 144, h: 36 },
};

export const SHOTS = {
    'staff-list': {
        create: { x: 1092, y: 104, w: 145, h: 32 },
        stats: { x: 292, y: 180, w: 946, h: 106 },
        table: { x: 293, y: 406, w: 944, h: 299 },
    },
    'staff-form-empty': formTop,
    'staff-form-debtor': {
        ...formTop,
        option: { x: 735, y: 483, w: 503, h: 36 },
        list: { x: 729, y: 331, w: 517, h: 230 },
    },
    'staff-form-amount': formTop,
    'staff-form-months': {
        amount: { x: 772, y: 184, w: 474, h: 40 },
        interestType: { x: 729, y: 266, w: 517, h: 42 },
        rate: { x: 729, y: 350, w: 250, h: 40 },
        months: { x: 995, y: 350, w: 250, h: 40 },
        date: { x: 729, y: 406, w: 250, h: 66 },
    },
    'staff-form-disbursement': formBottom,
    'staff-form-filled': formBottom,
    'staff-list-draft': {
        row: { x: 293, y: 447, w: 944, h: 65 },
        status: { x: 1057, y: 469, w: 50, h: 20 },
        submit: { x: 1133, y: 465, w: 28, h: 28 },
        actions: { x: 1121, y: 447, w: 116, h: 65 },
    },
    'staff-submit-confirm': {
        dialog: { x: 448, y: 265, w: 384, h: 189 },
        confirm: { x: 732, y: 402, w: 75, h: 36 },
    },
    'staff-list-pending': {
        row: { x: 293, y: 447, w: 944, h: 65 },
        status: { x: 1027, y: 469, w: 82, h: 20 },
    },
    'staff-detail-rejected': {
        dialog: { x: 384, y: 117, w: 512, h: 485 },
        status: { x: 658, y: 211, w: 61, h: 20 },
        reason: { x: 385, y: 475, w: 510, h: 66 },
        edit: { x: 385, y: 567, w: 44, h: 35 },
    },
    'fm-list-pending': {
        filter: { x: 583, y: 310, w: 279, h: 40 },
        stats: { x: 292, y: 180, w: 956, h: 106 },
        row: { x: 293, y: 447, w: 954, h: 53 },
        process: { x: 1207, y: 459, w: 28, h: 28 },
    },
    'fm-detail-pending': {
        dialog: { x: 384, y: 158, w: 512, h: 404 },
        process: { x: 385, y: 529, w: 510, h: 32 },
    },
    'fm-approve-empty': approve,
    'fm-approve-filled': approve,
    'fm-reject': {
        dialog: { x: 416, y: 158, w: 448, h: 404 },
        choice: { x: 417, y: 329, w: 446, h: 42 },
        notes: { x: 417, y: 413, w: 446, h: 80 },
        confirm: { x: 773, y: 509, w: 67, h: 36 },
    },
    'fm-list-active': {
        stats: { x: 292, y: 180, w: 946, h: 106 },
        row: { x: 293, y: 447, w: 944, h: 65 },
        remaining: { x: 981, y: 447, w: 119, h: 65 },
        pay: { x: 1197, y: 465, w: 28, h: 28 },
    },
    'fm-detail-active': {
        dialog: { x: 384, y: 102, w: 512, h: 515 },
        status: { x: 658, y: 196, w: 48, h: 20 },
        progress: { x: 385, y: 460, w: 510, h: 96 },
        pay: { x: 385, y: 585, w: 510, h: 32 },
    },
    'fm-pay-method': {
        dialog: { x: 416, y: 57, w: 448, h: 607 },
        method: { x: 417, y: 226, w: 446, h: 40 },
        list: { x: 417, y: 270, w: 446, h: 158 },
        option: { x: 423, y: 386, w: 433, h: 36 },
    },
    'fm-pay-payroll': {
        dialog: { x: 416, y: 98, w: 448, h: 525 },
        method: { x: 417, y: 241, w: 446, h: 66 },
        date: { x: 417, y: 323, w: 446, h: 66 },
        principal: { x: 417, y: 409, w: 446, h: 66 },
        reference: { x: 417, y: 491, w: 446, h: 66 },
        save: { x: 670, y: 570, w: 169, h: 36 },
    },
    'fm-pay-transfer': {
        summary: { x: 417, y: 98, w: 436, h: 110 },
        method: { x: 417, y: 207, w: 436, h: 66 },
        bank: { x: 417, y: 289, w: 436, h: 66 },
        date: { x: 417, y: 371, w: 436, h: 66 },
        principal: { x: 417, y: 457, w: 436, h: 62 },
        interest: { x: 417, y: 539, w: 436, h: 62 },
        reference: { x: 417, y: 621, w: 436, h: 62 },
    },
    'fm-pay-transfer-save': {
        principal: { x: 417, y: 388, w: 436, h: 62 },
        interest: { x: 417, y: 470, w: 436, h: 62 },
        reference: { x: 417, y: 552, w: 436, h: 62 },
        save: { x: 660, y: 631, w: 169, h: 36 },
    },
    'admin-list': {
        table: { x: 293, y: 406, w: 944, h: 299 },
        row: { x: 293, y: 447, w: 944, h: 65 },
        rejected: { x: 293, y: 512, w: 944, h: 65 },
    },
    'admin-detail-after': {
        dialog: { x: 384, y: 102, w: 512, h: 515 },
        progress: { x: 385, y: 460, w: 510, h: 96 },
    },
    'admin-bank': {
        account: { x: 301, y: 162, w: 190, h: 88 },
        search: { x: 534, y: 236, w: 256, h: 36 },
        disburse: { x: 535, y: 333, w: 750, h: 65 },
        principal: { x: 535, y: 398, w: 750, h: 77 },
        interest: { x: 535, y: 475, w: 750, h: 65 },
    },
    'admin-income': {
        row: { x: 293, y: 513, w: 954, h: 61 },
        table: { x: 293, y: 468, w: 954, h: 166 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-bank': adminBank,
    'admin-detail-after': adminDetailAfter,
    'admin-income': adminIncome,
    'admin-list': adminList,
    'fm-approve-empty': fmApproveEmpty,
    'fm-approve-filled': fmApproveFilled,
    'fm-detail-active': fmDetailActive,
    'fm-detail-pending': fmDetailPending,
    'fm-list-active': fmListActive,
    'fm-list-pending': fmListPending,
    'fm-pay-method': fmPayMethod,
    'fm-pay-payroll': fmPayPayroll,
    'fm-pay-transfer-save': fmPayTransferSave,
    'fm-pay-transfer': fmPayTransfer,
    'fm-reject': fmReject,
    'staff-detail-rejected': staffDetailRejected,
    'staff-form-amount': staffFormAmount,
    'staff-form-debtor': staffFormDebtor,
    'staff-form-disbursement': staffFormDisbursement,
    'staff-form-empty': staffFormEmpty,
    'staff-form-filled': staffFormFilled,
    'staff-form-months': staffFormMonths,
    'staff-list-draft': staffListDraft,
    'staff-list-pending': staffListPending,
    'staff-list': staffList,
    'staff-submit-confirm': staffSubmitConfirm,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
