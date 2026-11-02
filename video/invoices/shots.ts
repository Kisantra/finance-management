import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminDeleteBlocked from './screens/admin-delete-blocked.webp';
import adminDrawerPartial from './screens/admin-drawer-partial.webp';
import adminIncome from './screens/admin-income.webp';
import adminList from './screens/admin-list.webp';
import adminPaymentDelete from './screens/admin-payment-delete.webp';
import adminPl from './screens/admin-pl.webp';
import fmDrawerDraft from './screens/fm-drawer-draft.webp';
import fmDrawerPartial from './screens/fm-drawer-partial.webp';
import fmDrawerSent from './screens/fm-drawer-sent.webp';
import fmExport from './screens/fm-export.webp';
import fmListDraft from './screens/fm-list-draft.webp';
import fmMenu from './screens/fm-menu.webp';
import fmOverdue from './screens/fm-overdue.webp';
import fmPayEmpty from './screens/fm-pay-empty.webp';
import fmPayFilled from './screens/fm-pay-filled.webp';
import fmSend from './screens/fm-send.webp';
import printDialog from './screens/print-dialog.webp';
import staffCreateCatalog from './screens/staff-create-catalog.webp';
import staffCreateClient from './screens/staff-create-client.webp';
import staffCreateEmpty from './screens/staff-create-empty.webp';
import staffCreateItem1 from './screens/staff-create-item1.webp';
import staffCreateItem2 from './screens/staff-create-item2.webp';
import staffCreateTotals from './screens/staff-create-totals.webp';
import staffDrawerDraft from './screens/staff-drawer-draft.webp';
import staffList from './screens/staff-list.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/invoices/screens/*.webp.
 * Dihasilkan oleh video/capture/invoices.js + invoices-admin.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Disesuaikan manual: number (item1/item2), method/upload (dialog bayar), open, source/category, total (pemasukan), about.
 * fm-drawer-sent: toast "Invoice diterbitkan" dihapus dari gambar (kini disembunyikan oleh skrip capture).
 */
const editor = {
    back: { x: 292, y: 94, w: 40, h: 40 },
    number: { x: 1011, y: 187, w: 204, h: 32 },
    client: { x: 315, y: 259, w: 345, h: 42 },
    issueDate: { x: 672, y: 259, w: 265, h: 42 },
    dueDate: { x: 949, y: 259, w: 265, h: 42 },
    multi: { x: 1025, y: 317, w: 190, h: 20 },
    detail: { x: 292, y: 164, w: 946, h: 196 },
    items: { x: 292, y: 384, w: 946, h: 277 },
    row1: { x: 315, y: 479, w: 900, h: 104 },
    name1: { x: 356, y: 492, w: 486, h: 34 },
    catalog1: { x: 848, y: 492, w: 34, h: 34 },
    qty1: { x: 890, y: 492, w: 56, h: 34 },
    price1: { x: 987, y: 492, w: 100, h: 34 },
    unit1: { x: 406, y: 536, w: 96, h: 34 },
    cogs1: { x: 618, y: 536, w: 112, h: 34 },
    tax1: { x: 1081, y: 543, w: 121, h: 20 },
    addRow: { x: 315, y: 595, w: 900, h: 44 },
    preview: { x: 785, y: 92, w: 115, h: 44 },
    draft: { x: 908, y: 92, w: 129, h: 44 },
    publish: { x: 1045, y: 92, w: 193, h: 44 },
};

const drawer = {
    number: { x: 435, y: 30, w: 100, h: 20 },
    status: { x: 545, y: 29, w: 58, h: 22 },
    metrics: { x: 385, y: 154, w: 871, h: 105 },
    tabs: { x: 385, y: 305, w: 242, h: 44 },
    items: { x: 385, y: 368, w: 579, h: 146 },
    history: { x: 385, y: 619, w: 579, h: 64 },
    payments: { x: 984, y: 532, w: 272, h: 151 },
    send: { x: 1059, y: 20, w: 149, h: 40 },
    more: { x: 1216, y: 20, w: 40, h: 40 },
};

const pay = {
    dialog: { x: 384, y: 36, w: 512, h: 648 },
    amount: { x: 409, y: 134, w: 452, h: 67 },
    chips: { x: 409, y: 208, w: 452, h: 32 },
    date: { x: 409, y: 281, w: 220, h: 42 },
    account: { x: 641, y: 281, w: 220, h: 42 },
    method: { x: 409, y: 366, w: 452, h: 40 },
    reference: { x: 409, y: 448, w: 452, h: 42 },
    upload: { x: 409, y: 506, w: 452, h: 126 },
    confirm: { x: 658, y: 651, w: 203, h: 44 },
};

const sentBar = {
    status: { x: 602, y: 29, w: 73, h: 22 },
    number: { x: 435, y: 30, w: 160, h: 20 },
    print: { x: 904, y: 20, w: 107, h: 40 },
    pay: { x: 1018, y: 20, w: 190, h: 40 },
    more: { x: 1216, y: 20, w: 40, h: 40 },
};

export const SHOTS = {
    'staff-list': {
        create: { x: 1091, y: 96, w: 147, h: 44 },
        export: { x: 970, y: 96, w: 113, h: 44 },
        summary: { x: 292, y: 164, w: 946, h: 196 },
        list: { x: 292, y: 384, w: 946, h: 325 },
        statusFilter: { x: 315, y: 407, w: 421, h: 40 },
        overdue: { x: 744, y: 408, w: 143, h: 36 },
        period: { x: 747, y: 458, w: 176, h: 40 },
        row: { x: 315, y: 551, w: 923, h: 73 },
    },
    'staff-create-empty': editor,
    'staff-create-client': { ...editor, option: { x: 321, y: 457, w: 331, h: 36 }, list: { x: 315, y: 343, w: 343, h: 228 } },
    'staff-create-catalog': { ...editor, option: { x: 601, y: 450, w: 264, h: 36 }, popover: { x: 594, y: 179, w: 288, h: 308 } },
    'staff-create-item1': { ...editor, number: { x: 990, y: 187, w: 225, h: 32 } },
    'staff-create-item2': {
        ...editor,
        number: { x: 990, y: 187, w: 225, h: 32 },
        items: { x: 292, y: 384, w: 946, h: 336 },
        row2: { x: 315, y: 593, w: 900, h: 104 },
        name2: { x: 356, y: 605, w: 486, h: 34 },
        price2: { x: 987, y: 605, w: 100, h: 34 },
        cogs2: { x: 618, y: 649, w: 112, h: 34 },
        tax1: { x: 1037, y: 543, w: 121, h: 20 },
    },
    'staff-create-totals': {
        totals: { x: 292, y: 550, w: 946, h: 170 },
        discount: { x: 315, y: 604, w: 407, h: 68 },
        total: { x: 771, y: 640, w: 444, h: 32 },
        profit: { x: 771, y: 678, w: 444, h: 20 },
        items: { x: 292, y: 135, w: 946, h: 391 },
    },
    'staff-drawer-draft': drawer,
    'fm-list-draft': {
        statusFilter: { x: 315, y: 407, w: 421, h: 40 },
        row: { x: 315, y: 551, w: 923, h: 65 },
        summary: { x: 292, y: 164, w: 946, h: 196 },
    },
    'fm-drawer-draft': drawer,
    'fm-send': {
        dialog: { x: 416, y: 165, w: 448, h: 389 },
        sub: { x: 441, y: 222, w: 350, h: 63 },
        number: { x: 441, y: 330, w: 398, h: 42 },
        hint: { x: 441, y: 376, w: 398, h: 32 },
        confirm: { x: 690, y: 486, w: 149, h: 44 },
    },
    'fm-drawer-sent': { ...drawer, ...sentBar, payments: { x: 984, y: 532, w: 272, h: 132 } },
    'fm-menu': {
        more: { x: 1216, y: 20, w: 40, h: 40 },
        menu: { x: 1048, y: 64, w: 208, h: 115 },
        edit: { x: 1053, y: 69, w: 198, h: 32 },
        rollback: { x: 1053, y: 101, w: 198, h: 32 },
        remove: { x: 1053, y: 142, w: 198, h: 32 },
    },
    'fm-pay-empty': pay,
    'fm-pay-filled': pay,
    'fm-drawer-partial': { ...drawer, ...sentBar, metrics: { x: 385, y: 154, w: 861, h: 105 }, payments: { x: 974, y: 532, w: 272, h: 188 }, history: { x: 385, y: 619, w: 569, h: 100 } },
    'fm-overdue': {
        overdue: { x: 743, y: 408, w: 143, h: 36 },
        overdueStat: { x: 990, y: 187, w: 225, h: 76 },
        list: { x: 292, y: 384, w: 946, h: 336 },
        firstRow: { x: 315, y: 551, w: 923, h: 73 },
    },
    'fm-export': {
        export: { x: 970, y: 96, w: 113, h: 44 },
        menu: { x: 891, y: 144, w: 192, h: 74 },
    },
    'print-dialog': {
        dialog: { x: 100, y: 63, w: 1080, h: 593 },
        type: { x: 125, y: 184, w: 372, h: 44 },
        summary: { x: 125, y: 248, w: 372, h: 54 },
        templates: { x: 125, y: 349, w: 372, h: 136 },
        open: { x: 222, y: 588, w: 128, h: 44 },
        download: { x: 359, y: 588, w: 138, h: 44 },
        preview: { x: 542, y: 132, w: 607, h: 505 },
    },
    'admin-list': {
        summary: { x: 292, y: 164, w: 946, h: 196 },
        paidStat: { x: 540, y: 187, w: 225, h: 76 },
        list: { x: 292, y: 384, w: 946, h: 325 },
    },
    'admin-drawer-partial': {
        metrics: { x: 385, y: 154, w: 861, h: 105 },
        profit: { x: 1039, y: 154, w: 206, h: 105 },
        payments: { x: 974, y: 532, w: 272, h: 188 },
        history: { x: 385, y: 619, w: 569, h: 100 },
        editPay: { x: 1163, y: 581, w: 28, h: 28 },
        delPay: { x: 1201, y: 581, w: 28, h: 28 },
    },
    'admin-delete-blocked': {
        dialog: { x: 448, y: 265, w: 384, h: 189 },
        text: { x: 537, y: 320, w: 270, h: 40 },
    },
    'admin-payment-delete': {
        dialog: { x: 448, y: 255, w: 384, h: 209 },
        text: { x: 537, y: 310, w: 270, h: 60 },
    },
    'admin-bank': {
        account: { x: 301, y: 234, w: 190, h: 88 },
        income: { x: 534, y: 336, w: 226, h: 62 },
    },
    'admin-income': {
        total: { x: 293, y: 209, w: 303, h: 125 },
        row: { x: 293, y: 529, w: 944, h: 61 },
        source: { x: 471, y: 548, w: 76, h: 23 },
        number: { x: 597, y: 561, w: 322, h: 16 },
        category: { x: 930, y: 548, w: 50, h: 24 },
        amount: { x: 1126, y: 550, w: 99, h: 18 },
    },
    'admin-pl': {
        period: { x: 356, y: 308, w: 434, h: 16 },
        revenue: { x: 356, y: 387, w: 434, h: 29 },
        cogs: { x: 356, y: 509, w: 434, h: 29 },
        gross: { x: 356, y: 584, w: 434, h: 49 },
        about: { x: 879, y: 543, w: 358, h: 112 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-bank': adminBank,
    'admin-delete-blocked': adminDeleteBlocked,
    'admin-drawer-partial': adminDrawerPartial,
    'admin-income': adminIncome,
    'admin-list': adminList,
    'admin-payment-delete': adminPaymentDelete,
    'admin-pl': adminPl,
    'fm-drawer-draft': fmDrawerDraft,
    'fm-drawer-partial': fmDrawerPartial,
    'fm-drawer-sent': fmDrawerSent,
    'fm-export': fmExport,
    'fm-list-draft': fmListDraft,
    'fm-menu': fmMenu,
    'fm-overdue': fmOverdue,
    'fm-pay-empty': fmPayEmpty,
    'fm-pay-filled': fmPayFilled,
    'fm-send': fmSend,
    'print-dialog': printDialog,
    'staff-create-catalog': staffCreateCatalog,
    'staff-create-client': staffCreateClient,
    'staff-create-empty': staffCreateEmpty,
    'staff-create-item1': staffCreateItem1,
    'staff-create-item2': staffCreateItem2,
    'staff-create-totals': staffCreateTotals,
    'staff-drawer-draft': staffDrawerDraft,
    'staff-list': staffList,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua tombol bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
