import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminExpenseBulk from './screens/admin-expense-bulk.webp';
import adminIncomeDeleteConfirm from './screens/admin-income-delete-confirm.webp';
import adminPlOpex from './screens/admin-pl-opex.webp';
import adminPlTop from './screens/admin-pl-top.webp';
import fmExpenseEdit from './screens/fm-expense-edit.webp';
import fmExpenseFormCategory from './screens/fm-expense-form-category.webp';
import fmExpenseFormFilled from './screens/fm-expense-form-filled.webp';
import fmExpenseListAfter from './screens/fm-expense-list-after.webp';
import fmExpenseList from './screens/fm-expense-list.webp';
import fmIncomeFormAmount from './screens/fm-income-form-amount.webp';
import fmIncomeFormCategory from './screens/fm-income-form-category.webp';
import fmIncomeFormEmpty from './screens/fm-income-form-empty.webp';
import fmIncomeFormFilled from './screens/fm-income-form-filled.webp';
import fmIncomeListAfter from './screens/fm-income-list-after.webp';
import fmIncomeList from './screens/fm-income-list.webp';
import fmIncomePaymentDetail from './screens/fm-income-payment-detail.webp';
import fmIncomeSaved from './screens/fm-income-saved.webp';
import fmTransferDetail from './screens/fm-transfer-detail.webp';
import fmTransferFormAccounts from './screens/fm-transfer-form-accounts.webp';
import fmTransferFormEmpty from './screens/fm-transfer-form-empty.webp';
import fmTransferFormFilled from './screens/fm-transfer-form-filled.webp';
import fmTransferFormSubmit from './screens/fm-transfer-form-submit.webp';
import fmTransferListAfter from './screens/fm-transfer-list-after.webp';
import fmTransferList from './screens/fm-transfer-list.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/cash-flow/screens/*.webp.
 * Dihasilkan oleh video/capture/cash-flow.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Kotak yang melewati tepi layar dipangkas manual; toast & beberapa sel tabel diukur manual dari gambar.
 */
const list = {
    create: { x: 1067, y: 102, w: 171, h: 36 },
    export: { x: 927, y: 102, w: 132, h: 36 },
    stats: { x: 292, y: 180, w: 946, h: 126 },
    filters: { x: 292, y: 330, w: 946, h: 66 },
};

const txForm = {
    dialog: { x: 256, y: 42, w: 768, h: 635 },
    account: { x: 281, y: 229, w: 347, h: 66 },
    category: { x: 281, y: 311, w: 347, h: 66 },
    addCategory: { x: 567, y: 313, w: 61, h: 16 },
    amount: { x: 281, y: 393, w: 347, h: 66 },
    date: { x: 281, y: 475, w: 347, h: 66 },
    description: { x: 652, y: 229, w: 347, h: 106 },
    reference: { x: 652, y: 351, w: 347, h: 66 },
    upload: { x: 652, y: 433, w: 347, h: 155 },
    save: { x: 837, y: 625, w: 163, h: 36 },
    close: { x: 755, y: 625, w: 70, h: 36 },
};

const transferTop = {
    dialog: { x: 256, y: 36, w: 768, h: 648 },
    from: { x: 281, y: 156, w: 342, h: 66 },
    to: { x: 281, y: 238, w: 342, h: 66 },
    category: { x: 281, y: 320, w: 342, h: 66 },
    date: { x: 281, y: 402, w: 342, h: 66 },
    amount: { x: 647, y: 156, w: 342, h: 86 },
    fee: { x: 647, y: 258, w: 342, h: 86 },
    description: { x: 647, y: 360, w: 342, h: 106 },
};

/** Setelah rekening dipilih, kartu Dari → Ke muncul dan field bergeser 114 px ke bawah. */
const transferFilled = {
    dialog: { x: 256, y: 36, w: 768, h: 648 },
    flow: { x: 281, y: 136, w: 708, h: 116 },
    from: { x: 281, y: 270, w: 342, h: 66 },
    to: { x: 281, y: 352, w: 342, h: 66 },
    category: { x: 281, y: 434, w: 342, h: 66 },
    date: { x: 281, y: 516, w: 342, h: 66 },
    amount: { x: 647, y: 270, w: 342, h: 86 },
    fee: { x: 647, y: 372, w: 342, h: 86 },
    description: { x: 647, y: 474, w: 342, h: 106 },
};

export const SHOTS = {
    'fm-income-list': {
        ...list,
        directRow: { x: 293, y: 501, w: 944, h: 61 },
        invoiceRow: { x: 293, y: 622, w: 944, h: 61 },
        sourceCol: { x: 458, y: 456, w: 126, h: 44 },
        rows: { x: 293, y: 456, w: 944, h: 264 },
    },
    'fm-income-form-empty': txForm,
    'fm-income-form-category': { ...txForm, option: { x: 287, y: 524, w: 334, h: 36 }, list: { x: 281, y: 418, w: 346, h: 216 } },
    'fm-income-form-amount': txForm,
    'fm-income-form-filled': txForm,
    'fm-income-saved': { ...txForm, toast: { x: 900, y: 24, w: 356, h: 52 } },
    'fm-income-list-after': {
        stats: { x: 292, y: 180, w: 956, h: 126 },
        search: { x: 1099, y: 330, w: 149, h: 66 },
        row: { x: 293, y: 513, w: 954, h: 61 },
    },
    'fm-income-payment-detail': {
        dialog: { x: 304, y: 174, w: 672, h: 372 },
        note: { x: 329, y: 415, w: 622, h: 42 },
    },
    'fm-expense-list': { ...list, create: { x: 1060, y: 102, w: 177, h: 36 }, export: { x: 920, y: 102, w: 132, h: 36 } },
    'fm-expense-form-category': {
        ...txForm,
        save: { x: 830, y: 625, w: 169, h: 36 },
        option: { x: 287, y: 520, w: 323, h: 36 },
        list: { x: 281, y: 418, w: 346, h: 240 },
    },
    'fm-expense-form-filled': {
        dialog: { x: 256, y: 66, w: 768, h: 588 },
        account: { x: 281, y: 252, w: 347, h: 66 },
        category: { x: 281, y: 334, w: 347, h: 66 },
        amount: { x: 281, y: 416, w: 347, h: 66 },
        date: { x: 281, y: 498, w: 347, h: 66 },
        description: { x: 652, y: 252, w: 347, h: 106 },
        reference: { x: 652, y: 374, w: 347, h: 66 },
        upload: { x: 652, y: 456, w: 347, h: 88 },
        save: { x: 830, y: 601, w: 169, h: 36 },
    },
    'fm-expense-list-after': {
        stats: { x: 292, y: 180, w: 956, h: 126 },
        row: { x: 293, y: 513, w: 954, h: 83 },
        category: { x: 826, y: 545, w: 113, h: 20 },
    },
    'fm-expense-edit': {
        dialog: { x: 304, y: 99, w: 672, h: 523 },
        amount: { x: 329, y: 218, w: 303, h: 66 },
        category: { x: 329, y: 300, w: 303, h: 66 },
        attachment: { x: 329, y: 464, w: 622, h: 68 },
        save: { x: 794, y: 569, w: 157, h: 36 },
    },
    'fm-transfer-list': {
        ...list,
        create: { x: 1091, y: 102, w: 147, h: 36 },
        export: { x: 951, y: 102, w: 132, h: 36 },
        empty: { x: 293, y: 420, w: 944, h: 300 },
    },
    'fm-transfer-form-empty': transferTop,
    'fm-transfer-form-accounts': transferFilled,
    'fm-transfer-form-filled': transferFilled,
    'fm-transfer-form-submit': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        amount: { x: 647, y: 56, w: 342, h: 86 },
        fee: { x: 647, y: 158, w: 342, h: 86 },
        summary: { x: 281, y: 554, w: 708, h: 40 },
        submit: { x: 846, y: 631, w: 143, h: 36 },
    },
    'fm-transfer-list-after': {
        stats: { x: 292, y: 180, w: 956, h: 126 },
        row: { x: 293, y: 501, w: 960, h: 96 },
        flowCell: { x: 445, y: 501, w: 313, h: 96 },
        toast: { x: 900, y: 24, w: 356, h: 52 },
    },
    'fm-transfer-detail': {
        dialog: { x: 304, y: 129, w: 672, h: 461 },
        sums: { x: 305, y: 227, w: 670, h: 143 },
        edit: { x: 305, y: 369, w: 670, h: 152 },
        save: { x: 794, y: 538, w: 157, h: 36 },
    },
    'admin-expense-bulk': {
        row: { x: 293, y: 362, w: 944, h: 84 },
        checkbox: { x: 309, y: 395, w: 16, h: 16 },
        bar: { x: 462, y: 638, w: 356, h: 58 },
        remove: { x: 718, y: 651, w: 83, h: 32 },
    },
    'admin-income-delete-confirm': {
        dialog: { x: 448, y: 255, w: 384, h: 209 },
        text: { x: 537, y: 310, w: 270, h: 60 },
        confirm: { x: 721, y: 412, w: 86, h: 36 },
        cancel: { x: 643, y: 412, w: 66, h: 36 },
    },
    'admin-bank': {
        bca: { x: 301, y: 234, w: 190, h: 88 },
        bni: { x: 301, y: 417, w: 190, h: 88 },
    },
    'admin-pl-top': {
        revenue: { x: 356, y: 588, w: 434, h: 30 },
        panel: { x: 878, y: 278, w: 360, h: 442 },
        meetingRoom: { x: 898, y: 651, w: 318, h: 69 },
    },
    'admin-pl-opex': {
        heading: { x: 356, y: 84, w: 434, h: 23 },
        line: { x: 356, y: 206, w: 434, h: 21 },
        net: { x: 356, y: 405, w: 434, h: 36 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-bank': adminBank,
    'admin-expense-bulk': adminExpenseBulk,
    'admin-income-delete-confirm': adminIncomeDeleteConfirm,
    'admin-pl-opex': adminPlOpex,
    'admin-pl-top': adminPlTop,
    'fm-expense-edit': fmExpenseEdit,
    'fm-expense-form-category': fmExpenseFormCategory,
    'fm-expense-form-filled': fmExpenseFormFilled,
    'fm-expense-list-after': fmExpenseListAfter,
    'fm-expense-list': fmExpenseList,
    'fm-income-form-amount': fmIncomeFormAmount,
    'fm-income-form-category': fmIncomeFormCategory,
    'fm-income-form-empty': fmIncomeFormEmpty,
    'fm-income-form-filled': fmIncomeFormFilled,
    'fm-income-list-after': fmIncomeListAfter,
    'fm-income-list': fmIncomeList,
    'fm-income-payment-detail': fmIncomePaymentDetail,
    'fm-income-saved': fmIncomeSaved,
    'fm-transfer-detail': fmTransferDetail,
    'fm-transfer-form-accounts': fmTransferFormAccounts,
    'fm-transfer-form-empty': fmTransferFormEmpty,
    'fm-transfer-form-filled': fmTransferFormFilled,
    'fm-transfer-form-submit': fmTransferFormSubmit,
    'fm-transfer-list-after': fmTransferListAfter,
    'fm-transfer-list': fmTransferList,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua field bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
