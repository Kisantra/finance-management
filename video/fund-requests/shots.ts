import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminDelete from './screens/admin-delete.webp';
import adminExpenses from './screens/admin-expenses.webp';
import adminList from './screens/admin-list.webp';
import adminPl from './screens/admin-pl.webp';
import fmApproveEmpty from './screens/fm-approve-empty.webp';
import fmApprove from './screens/fm-approve.webp';
import fmDetailDisbursed from './screens/fm-detail-disbursed.webp';
import fmDetailPending from './screens/fm-detail-pending.webp';
import fmDisburseBank from './screens/fm-disburse-bank.webp';
import fmDisburseFilled from './screens/fm-disburse-filled.webp';
import fmDisburseNoted from './screens/fm-disburse-noted.webp';
import fmDisbursePicked from './screens/fm-disburse-picked.webp';
import fmListApproved from './screens/fm-list-approved.webp';
import fmList from './screens/fm-list.webp';
import fmRejectEmpty from './screens/fm-reject-empty.webp';
import fmReject from './screens/fm-reject.webp';
import staffDetailRejected from './screens/staff-detail-rejected.webp';
import staffFormAttach from './screens/staff-form-attach.webp';
import staffFormCategory from './screens/staff-form-category.webp';
import staffFormDate from './screens/staff-form-date.webp';
import staffFormDated from './screens/staff-form-dated.webp';
import staffFormEmpty from './screens/staff-form-empty.webp';
import staffFormItem1Cat from './screens/staff-form-item1-cat.webp';
import staffFormItem1Done from './screens/staff-form-item1-done.webp';
import staffFormItem1 from './screens/staff-form-item1.webp';
import staffFormItem2 from './screens/staff-form-item2.webp';
import staffFormItems from './screens/staff-form-items.webp';
import staffFormPriority from './screens/staff-form-priority.webp';
import staffFormPurpose from './screens/staff-form-purpose.webp';
import staffFormTitle from './screens/staff-form-title.webp';
import staffListEmpty from './screens/staff-list-empty.webp';
import staffListFinal from './screens/staff-list-final.webp';
import staffListPending from './screens/staff-list-pending.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/fund-requests/screens/*.webp.
 * Dari video/capture/fund-requests.js + fund-requests-admin.js; kotak yang diberi komentar "manual" diukur dari gambarnya.
 */
const head = {
    sheet: { x: 704, y: 0, w: 576, h: 720 },
    number: { x: 729, y: 121, w: 517, h: 40 },
    title: { x: 729, y: 223, w: 250, h: 40 },
    priority: { x: 995, y: 223, w: 250, h: 40 },
    date: { x: 729, y: 305, w: 517, h: 40 },
    purpose: { x: 729, y: 387, w: 517, h: 80 },
    upload: { x: 729, y: 483, w: 517, h: 135 },
    draft: { x: 1050, y: 668, w: 121, h: 36 },
    submit: { x: 1179, y: 668, w: 77, h: 36 },
};
const item1 = {
    name: { x: 746, y: 296, w: 483, h: 40 },
    category: { x: 746, y: 374, w: 483, h: 40 },
    qty: { x: 746, y: 452, w: 236, h: 40 },
    price: { x: 1036, y: 452, w: 192, h: 40 },
    items: { x: 729, y: 173, w: 517, h: 459 },
    add: { x: 1136, y: 186, w: 93, h: 32 },
    total: { x: 730, y: 582, w: 515, h: 49 },
    badge: { x: 1043, y: 186, w: 186, h: 32 },
    draft: head.draft,
    submit: head.submit,
};
const listRow = { x: 109, y: 624, w: 1138, h: 62 };

export const SHOTS = {
    'staff-list-empty': {
        create: { x: 1072, y: 102, w: 166, h: 36 },
        stats: { x: 292, y: 180, w: 946, h: 118 },
        filters: { x: 292, y: 322, w: 946, h: 66 },
    },
    'staff-form-empty': head,
    'staff-form-title': head,
    'staff-form-priority': { ...head, option: { x: 1002, y: 382, w: 237, h: 36 }, list: { x: 996, y: 304, w: 249, h: 156 } },
    'staff-form-date': { ...head, day: { x: 885, y: 521, w: 36, h: 36 }, calendar: { x: 741, y: 405, w: 252, h: 239 } },
    'staff-form-dated': head,
    'staff-form-purpose': head,
    'staff-form-attach': { ...head, upload: { x: 729, y: 483, w: 517, h: 68 } },
    'staff-form-items': item1,
    'staff-form-item1': item1,
    'staff-form-category': { ...item1, option: { x: 752, y: 558, w: 459, h: 36 }, list: { x: 746, y: 456, w: 482, h: 240 } },
    'staff-form-item1-cat': item1,
    'staff-form-item1-done': item1,
    // item2: blok "Item #2" (manual).
    'staff-form-item2': { ...item1, item2: { x: 729, y: 240, w: 517, h: 262 } },
    'staff-list-pending': {
        row: { x: 293, y: 493, w: 954, h: 62 },
        status: { x: 1060, y: 514, w: 112, h: 20 },
    },
    'fm-list': {
        tabs: { x: 108, y: 322, w: 301, h: 44 },
        stats: { x: 108, y: 180, w: 1140, h: 118 },
        filters: { x: 108, y: 382, w: 1140, h: 76 }, // manual
        row: listRow,
        review: { x: 1146, y: 639, w: 89, h: 32 },
        requester: { x: 684, y: 416, w: 276, h: 40 },
    },
    'fm-detail-pending': {
        dialog: { x: 384, y: 45, w: 512, h: 630 },
        status: { x: 644, y: 258, w: 116, h: 24 }, // manual
        attachment: { x: 409, y: 370, w: 210, h: 20 },
        items: { x: 405, y: 410, w: 470, h: 174 }, // manual
        approve: { x: 746, y: 626, w: 63, h: 32 },
        reject: { x: 817, y: 626, w: 54, h: 32 },
    },
    'fm-approve-empty': {
        notes: { x: 441, y: 375, w: 398, h: 80 },
    },
    'fm-approve': {
        dialog: { x: 416, y: 176, w: 448, h: 369 },
        notes: { x: 441, y: 375, w: 398, h: 80 },
        confirm: { x: 776, y: 496, w: 63, h: 32 },
    },
    'fm-list-approved': {
        row: listRow,
        status: { x: 989, y: 645, w: 78, h: 20 },
        disburse: { x: 1167, y: 639, w: 68, h: 32 },
    },
    'fm-disburse-bank': {
        dialog: { x: 416, y: 36, w: 448, h: 648 },
        summary: { x: 441, y: 122, w: 388, h: 72 },
        bank: { x: 441, y: 235, w: 388, h: 40 },
        option: { x: 447, y: 323, w: 374, h: 36 },
        list: { x: 441, y: 317, w: 386, h: 192 },
    },
    'fm-disburse-picked': {
        bank: { x: 441, y: 235, w: 388, h: 40 },
        date: { x: 441, y: 317, w: 388, h: 40 },
        notes: { x: 441, y: 399, w: 388, h: 80 },
    },
    'fm-disburse-noted': {
        notes: { x: 441, y: 399, w: 388, h: 80 },
        upload: { x: 441, y: 521, w: 388, h: 109 },
    },
    'fm-disburse-filled': {
        dialog: { x: 416, y: 42, w: 448, h: 636 },
        summary: { x: 441, y: 127, w: 398, h: 72 },
        bank: { x: 441, y: 241, w: 398, h: 40 },
        date: { x: 441, y: 323, w: 398, h: 40 },
        notes: { x: 441, y: 405, w: 398, h: 80 },
        upload: { x: 441, y: 505, w: 398, h: 72 }, // manual
        confirm: { x: 740, y: 629, w: 99, h: 32 },
    },
    'fm-detail-disbursed': {
        items: { x: 409, y: 214, w: 452, h: 176 }, // manual
        disbursement: { x: 409, y: 405, w: 452, h: 222 },
        accountLine: { x: 409, y: 420, w: 452, h: 104 }, // manual
    },
    'fm-reject-empty': {
        dialog: { x: 416, y: 176, w: 448, h: 369 },
        notes: { x: 441, y: 375, w: 398, h: 80 },
    },
    'fm-reject': {
        dialog: { x: 416, y: 176, w: 448, h: 369 },
        notes: { x: 441, y: 375, w: 398, h: 80 },
        confirm: { x: 785, y: 496, w: 54, h: 32 },
    },
    'staff-list-final': {
        row1: { x: 293, y: 556, w: 954, h: 62 },
        row2: { x: 293, y: 493, w: 954, h: 63 },
        edit: { x: 1157, y: 506, w: 36, h: 36 },
        remove: { x: 1197, y: 506, w: 36, h: 36 }, // manual
    },
    'staff-detail-rejected': {
        dialog: { x: 384, y: 37, w: 512, h: 645 },
        status: { x: 648, y: 251, w: 73, h: 20 },
        notes: { x: 409, y: 312, w: 462, h: 70 }, // manual: "Direview oleh" + "Catatan Review"
        edit: { x: 801, y: 634, w: 71, h: 32 },
    },
    'admin-list': {
        tabs: { x: 108, y: 322, w: 301, h: 44 },
        row: listRow,
        rows: { x: 109, y: 562, w: 1138, h: 124 }, // manual
        remove: { x: 1199, y: 637, w: 36, h: 36 },
    },
    'admin-delete': {
        dialog: { x: 448, y: 275, w: 384, h: 169 },
        confirm: { x: 732, y: 392, w: 75, h: 36 },
    },
    'admin-bank': {
        account: { x: 117, y: 234, w: 236, h: 88 },
        expenseStat: { x: 682, y: 308, w: 272, h: 62 }, // manual
    },
    'admin-expenses': {
        row1: { x: 109, y: 501, w: 1128, h: 84 },
        row2: { x: 109, y: 584, w: 1128, h: 84 },
        category: { x: 690, y: 520, w: 120, h: 112 }, // manual: kolom Kategori dua baris
    },
    'admin-pl': {
        beban: { x: 168, y: 80, w: 626, h: 212 }, // manual
        lines: { x: 168, y: 142, w: 626, h: 60 }, // manual: MAKAN MINUM + OPERASIONAL
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-bank': adminBank,
    'admin-delete': adminDelete,
    'admin-expenses': adminExpenses,
    'admin-list': adminList,
    'admin-pl': adminPl,
    'fm-approve': fmApprove,
    'fm-approve-empty': fmApproveEmpty,
    'fm-detail-disbursed': fmDetailDisbursed,
    'fm-detail-pending': fmDetailPending,
    'fm-disburse-bank': fmDisburseBank,
    'fm-disburse-filled': fmDisburseFilled,
    'fm-disburse-noted': fmDisburseNoted,
    'fm-disburse-picked': fmDisbursePicked,
    'fm-list': fmList,
    'fm-list-approved': fmListApproved,
    'fm-reject': fmReject,
    'fm-reject-empty': fmRejectEmpty,
    'staff-detail-rejected': staffDetailRejected,
    'staff-form-attach': staffFormAttach,
    'staff-form-category': staffFormCategory,
    'staff-form-date': staffFormDate,
    'staff-form-dated': staffFormDated,
    'staff-form-empty': staffFormEmpty,
    'staff-form-item1': staffFormItem1,
    'staff-form-item1-cat': staffFormItem1Cat,
    'staff-form-item1-done': staffFormItem1Done,
    'staff-form-item2': staffFormItem2,
    'staff-form-items': staffFormItems,
    'staff-form-priority': staffFormPriority,
    'staff-form-purpose': staffFormPurpose,
    'staff-form-title': staffFormTitle,
    'staff-list-empty': staffListEmpty,
    'staff-list-final': staffListFinal,
    'staff-list-pending': staffListPending,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua tombol bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
