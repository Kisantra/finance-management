import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminExpenseBulk from './screens/admin-expense-bulk.webp';
import adminIncomeDeleteConfirm from './screens/admin-income-delete-confirm.webp';
import adminPlOpex from './screens/admin-pl-opex.webp';
import adminPlTop from './screens/admin-pl-top.webp';
import fmExpenseEdit from './screens/fm-expense-edit.webp';
import fmExpenseFormCategory from './screens/fm-expense-form-category.webp';
import fmExpenseFormFilled from './screens/fm-expense-form-filled.webp';
import fmExpenseList from './screens/fm-expense-list.webp';
import fmExpenseListAfter from './screens/fm-expense-list-after.webp';
import fmFinancingFilled from './screens/fm-financing-filled.webp';
import fmFinancingList from './screens/fm-financing-list.webp';
import fmFinancingLocked from './screens/fm-financing-locked.webp';
import fmFinancingPicker from './screens/fm-financing-picker.webp';
import fmIncomeFormAmount from './screens/fm-income-form-amount.webp';
import fmIncomeFormCategory from './screens/fm-income-form-category.webp';
import fmIncomeFormEmpty from './screens/fm-income-form-empty.webp';
import fmIncomeFormFilled from './screens/fm-income-form-filled.webp';
import fmIncomeList from './screens/fm-income-list.webp';
import fmIncomeListAfter from './screens/fm-income-list-after.webp';
import fmIncomePaymentDetail from './screens/fm-income-payment-detail.webp';
import fmIncomeSaved from './screens/fm-income-saved.webp';
import fmTransferDetail from './screens/fm-transfer-detail.webp';
import fmTransferFormAccounts from './screens/fm-transfer-form-accounts.webp';
import fmTransferFormEmpty from './screens/fm-transfer-form-empty.webp';
import fmTransferFormFilled from './screens/fm-transfer-form-filled.webp';
import fmTransferFormSubmit from './screens/fm-transfer-form-submit.webp';
import fmTransferList from './screens/fm-transfer-list.webp';
import fmTransferListAfter from './screens/fm-transfer-list-after.webp';
import fmFinancingLockedDetail from './screens/fm-financing-locked-detail.webp';
import fmFinancingJournal from './screens/fm-financing-journal.webp';
import fmExpenseJournal from './screens/fm-expense-journal.webp';
import fmIncomeJournal from './screens/fm-income-journal.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/cash-flow/screens/*.webp.
 * Dihasilkan oleh video/capture/cash-flow.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Layar dialog (formulir, rincian, ubah, transfer) + layar *-journal diambil ulang 9 Nov 2026 (fitur Jurnal).
 * Kotak yang melewati tepi layar dipangkas manual; toast & beberapa sel tabel diukur manual dari gambar.
 */

export const SHOTS = {
    'admin-bank': {
        bca: { x: 301, y: 219, w: 203, h: 89 },
        bni: { x: 301, y: 405, w: 203, h: 89 },
    },
    'admin-expense-bulk': {
        row: { x: 315, y: 632, w: 965, h: 83 },
        checkbox: { x: 327, y: 665, w: 16, h: 16 },
        bar: { x: 461, y: 638, w: 359, h: 58 },
        remove: { x: 720, y: 651, w: 83, h: 32 },
    },
    'admin-income-delete-confirm': {
        dialog: { x: 448, y: 253, w: 384, h: 214 },
        text: { x: 533, y: 310, w: 274, h: 68 },
        confirm: { x: 721, y: 402, w: 86, h: 40 },
        cancel: { x: 644, y: 402, w: 69, h: 40 },
    },
    'admin-pl-opex': {
        heading: { x: 356, y: 84, w: 444, h: 23 },
        line: { x: 356, y: 178, w: 125, h: 21 },
        net: { x: 356, y: 597, w: 96, h: 21 },
    },
    'admin-pl-top': {
        revenue: { x: 356, y: 589, w: 444, h: 30 },
        panel: { x: 888, y: 265, w: 360, h: 261 },
        meetingRoom: { x: 922, y: 396, w: 191, h: 20 },
    },
    'fm-expense-edit': {
        dialog: { x: 304, y: 36, w: 672, h: 648 },
        amount: { x: 329, y: 50, w: 303, h: 68 },
        category: { x: 329, y: 134, w: 303, h: 68 },
        attachment: { x: 329, y: 515, w: 622, h: 68 },
        save: { x: 793, y: 619, w: 158, h: 40 },
        journal: { x: 329, y: 218, w: 622, h: 198 },
    },
    'fm-expense-form-category': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 68 },
        amount: { x: 281, y: 399, w: 347, h: 68 },
        date: { x: 281, y: 482, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        reference: { x: 652, y: 355, w: 347, h: 68 },
        upload: { x: 652, y: 438, w: 347, h: 154 },
        option: { x: 290, y: 527, w: 329, h: 36 },
        list: { x: 282, y: 425, w: 345, h: 240 },
    },
    'fm-expense-form-filled': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 68 },
        amount: { x: 281, y: 399, w: 347, h: 68 },
        date: { x: 281, y: 482, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        reference: { x: 652, y: 355, w: 347, h: 68 },
        upload: { x: 652, y: 438, w: 347, h: 88 },
    },
    'fm-expense-list': {
        create: { x: 1070, y: 86, w: 178, h: 40 },
        export: { x: 929, y: 86, w: 133, h: 40 },
        stats: { x: 292, y: 84, w: 956, h: 636 },
        filters: { x: 315, y: 400, w: 910, h: 68 },
        table: { x: 315, y: 519, w: 947, h: 201 },
    },
    'fm-expense-list-after': {
        create: { x: 1070, y: 86, w: 178, h: 40 },
        export: { x: 929, y: 86, w: 133, h: 40 },
        stats: { x: 292, y: 84, w: 956, h: 593 },
        filters: { x: 315, y: 400, w: 910, h: 68 },
        table: { x: 315, y: 532, w: 965, h: 122 },
        row: { x: 315, y: 571, w: 965, h: 83 },
        category: { x: 817, y: 587, w: 66, h: 52 },
    },
    'fm-financing-filled': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 135 },
        amount: { x: 281, y: 466, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        hint: { x: 281, y: 391, w: 347, h: 59 },
        tag: { x: 382, y: 351, w: 98, h: 22 },
    },
    'fm-financing-list': {
        cards: { x: 292, y: 233, w: 956, h: 121 },
        financingCard: { x: 616, y: 233, w: 308, h: 121 },
        totalCard: { x: 940, y: 233, w: 308, h: 121 },
        row: { x: 315, y: 571, w: 965, h: 73 },
    },
    'fm-financing-locked': {
        cards: { x: 292, y: 232, w: 956, h: 121 },
        row: { x: 315, y: 571, w: 947, h: 104 },
        lock: { x: 315, y: 571, w: 40, h: 104 },
        note: { x: 563, y: 628, w: 98, h: 16 },
    },
    'fm-financing-picker': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 68 },
        amount: { x: 281, y: 399, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        option: { x: 290, y: 526, w: 329, h: 36 },
        list: { x: 282, y: 425, w: 345, h: 240 },
        section: { x: 290, y: 470, w: 329, h: 25 },
    },
    'fm-income-form-amount': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 68 },
        addCategory: { x: 567, y: 317, w: 61, h: 16 },
        amount: { x: 281, y: 399, w: 347, h: 68 },
        date: { x: 281, y: 482, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        reference: { x: 652, y: 355, w: 347, h: 68 },
        upload: { x: 652, y: 438, w: 347, h: 154 },
    },
    'fm-income-form-category': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 68 },
        addCategory: { x: 567, y: 317, w: 61, h: 16 },
        amount: { x: 281, y: 399, w: 347, h: 68 },
        date: { x: 281, y: 482, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        reference: { x: 652, y: 355, w: 347, h: 68 },
        upload: { x: 652, y: 438, w: 347, h: 154 },
        option: { x: 290, y: 527, w: 329, h: 36 },
        list: { x: 282, y: 425, w: 345, h: 240 },
    },
    'fm-income-form-empty': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 68 },
        addCategory: { x: 567, y: 317, w: 61, h: 16 },
        amount: { x: 281, y: 399, w: 347, h: 68 },
        date: { x: 281, y: 482, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        reference: { x: 652, y: 355, w: 347, h: 68 },
        upload: { x: 652, y: 438, w: 347, h: 154 },
    },
    'fm-income-form-filled': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 231, w: 347, h: 68 },
        category: { x: 281, y: 315, w: 347, h: 68 },
        addCategory: { x: 567, y: 317, w: 61, h: 16 },
        amount: { x: 281, y: 399, w: 347, h: 68 },
        date: { x: 281, y: 482, w: 347, h: 68 },
        description: { x: 652, y: 231, w: 347, h: 108 },
        reference: { x: 652, y: 355, w: 347, h: 68 },
        upload: { x: 652, y: 438, w: 347, h: 154 },
    },
    'fm-income-list': {
        create: { x: 1076, y: 86, w: 172, h: 40 },
        export: { x: 935, y: 86, w: 133, h: 40 },
        stats: { x: 292, y: 84, w: 956, h: 636 },
        filters: { x: 315, y: 400, w: 910, h: 68 },
        table: { x: 315, y: 519, w: 910, h: 201 },
        invoiceRow: { x: 315, y: 648, w: 910, h: 61 },
        directRow: { x: 315, y: 559, w: 910, h: 89 },
        sourceCol: { x: 461, y: 519, w: 118, h: 40 },
        rows: { x: 315, y: 559, w: 910, h: 161 },
        cards: { x: 292, y: 233, w: 956, h: 121 },
    },
    'fm-income-list-after': {
        create: { x: 1076, y: 86, w: 172, h: 40 },
        export: { x: 935, y: 86, w: 133, h: 40 },
        stats: { x: 292, y: 84, w: 956, h: 587 },
        filters: { x: 315, y: 400, w: 910, h: 68 },
        table: { x: 315, y: 532, w: 910, h: 116 },
        row: { x: 315, y: 571, w: 910, h: 77 },
    },
    'fm-income-payment-detail': {
        dialog: { x: 304, y: 56, w: 672, h: 608 },
        note: { x: 329, y: 520, w: 622, h: 42 },
        journal: { x: 329, y: 306, w: 622, h: 198 },
    },
    'fm-income-saved': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 114, w: 347, h: 68 },
        category: { x: 281, y: 198, w: 347, h: 68 },
        addCategory: { x: 567, y: 200, w: 61, h: 16 },
        amount: { x: 281, y: 282, w: 347, h: 68 },
        date: { x: 281, y: 365, w: 347, h: 68 },
        description: { x: 652, y: 114, w: 347, h: 108 },
        reference: { x: 652, y: 238, w: 347, h: 68 },
        upload: { x: 652, y: 321, w: 347, h: 154 },
        save: { x: 836, y: 619, w: 163, h: 40 },
        close: { x: 755, y: 619, w: 72, h: 40 },
        toast: { x: 940, y: 41, w: 155, h: 20 },
    },
    'fm-transfer-detail': {
        dialog: { x: 304, y: 36, w: 672, h: 648 },
        sums: { x: 329, y: 63, w: 622, h: 107 },
        edit: { x: 305, y: 448, w: 670, h: 154 },
        save: { x: 793, y: 619, w: 158, h: 40 },
        journal: { x: 329, y: 185, w: 622, h: 230 },
    },
    'fm-transfer-form-accounts': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        flow: { x: 257, y: 144, w: 766, h: 576 },
        from: { x: 281, y: 279, w: 347, h: 68 },
        to: { x: 281, y: 363, w: 347, h: 68 },
        category: { x: 281, y: 446, w: 347, h: 68 },
        date: { x: 281, y: 530, w: 347, h: 68 },
        amount: { x: 652, y: 279, w: 347, h: 88 },
        fee: { x: 652, y: 383, w: 347, h: 88 },
        description: { x: 652, y: 486, w: 347, h: 106 },
        proof: { x: 652, y: 608, w: 347, h: 112 },
    },
    'fm-transfer-form-empty': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        from: { x: 281, y: 164, w: 347, h: 68 },
        to: { x: 281, y: 248, w: 347, h: 68 },
        category: { x: 281, y: 331, w: 347, h: 68 },
        date: { x: 281, y: 415, w: 347, h: 68 },
        amount: { x: 652, y: 164, w: 347, h: 88 },
        fee: { x: 652, y: 268, w: 347, h: 88 },
        description: { x: 652, y: 371, w: 347, h: 106 },
        proof: { x: 652, y: 493, w: 347, h: 134 },
        summary: { x: 281, y: 663, w: 718, h: 40 },
    },
    'fm-transfer-form-filled': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        flow: { x: 257, y: 144, w: 766, h: 576 },
        from: { x: 281, y: 279, w: 347, h: 68 },
        to: { x: 281, y: 363, w: 347, h: 68 },
        category: { x: 281, y: 446, w: 347, h: 68 },
        date: { x: 281, y: 530, w: 347, h: 68 },
        amount: { x: 652, y: 279, w: 347, h: 88 },
        fee: { x: 652, y: 383, w: 347, h: 88 },
        description: { x: 652, y: 486, w: 347, h: 106 },
        proof: { x: 652, y: 608, w: 347, h: 112 },
    },
    'fm-transfer-form-submit': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        flow: { x: 257, y: 0, w: 766, h: 602 },
        category: { x: 281, y: 0, w: 347, h: 25 },
        date: { x: 281, y: 41, w: 347, h: 68 },
        description: { x: 652, y: 0, w: 347, h: 103 },
        proof: { x: 652, y: 119, w: 347, h: 134 },
        summary: { x: 281, y: 289, w: 718, h: 40 },
        journal: { x: 281, y: 349, w: 718, h: 233 },
        submit: { x: 854, y: 619, w: 145, h: 40 },
    },
    'fm-transfer-list': {
        create: { x: 1100, y: 86, w: 148, h: 40 },
        export: { x: 959, y: 86, w: 133, h: 40 },
        stats: { x: 292, y: 165, w: 956, h: 126 },
        filters: { x: 292, y: 315, w: 956, h: 68 },
    },
    'fm-transfer-list-after': {
        create: { x: 1100, y: 86, w: 148, h: 40 },
        export: { x: 959, y: 86, w: 133, h: 40 },
        stats: { x: 292, y: 165, w: 956, h: 126 },
        filters: { x: 292, y: 315, w: 956, h: 68 },
        table: { x: 293, y: 443, w: 987, h: 140 },
        row: { x: 293, y: 488, w: 987, h: 96 },
        flowCell: { x: 474, y: 488, w: 314, h: 96 },
        debitCell: { x: 1201, y: 488, w: 79, h: 96 },
    },
    'fm-income-journal': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 11, w: 347, h: 68 },
        category: { x: 281, y: 95, w: 347, h: 68 },
        addCategory: { x: 567, y: 97, w: 61, h: 16 },
        amount: { x: 281, y: 179, w: 347, h: 68 },
        date: { x: 281, y: 262, w: 347, h: 68 },
        description: { x: 652, y: 11, w: 347, h: 108 },
        reference: { x: 652, y: 135, w: 347, h: 68 },
        upload: { x: 652, y: 218, w: 347, h: 154 },
        save: { x: 836, y: 619, w: 163, h: 40 },
        close: { x: 755, y: 619, w: 72, h: 40 },
        journal: { x: 281, y: 346, w: 347, h: 236 },
    },
    'fm-expense-journal': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 11, w: 347, h: 68 },
        category: { x: 281, y: 95, w: 347, h: 68 },
        amount: { x: 281, y: 179, w: 347, h: 68 },
        date: { x: 281, y: 262, w: 347, h: 68 },
        description: { x: 652, y: 11, w: 347, h: 108 },
        reference: { x: 652, y: 135, w: 347, h: 68 },
        upload: { x: 652, y: 218, w: 347, h: 88 },
        save: { x: 829, y: 619, w: 170, h: 40 },
        journal: { x: 281, y: 346, w: 347, h: 236 },
    },
    'fm-financing-journal': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        account: { x: 281, y: 0, w: 347, h: 12 },
        category: { x: 281, y: 28, w: 347, h: 135 },
        amount: { x: 281, y: 179, w: 347, h: 68 },
        description: { x: 652, y: 0, w: 347, h: 52 },
        save: { x: 829, y: 619, w: 170, h: 40 },
        journal: { x: 281, y: 346, w: 347, h: 236 },
    },
    'fm-financing-locked-detail': {
        dialog: { x: 304, y: 41, w: 672, h: 638 },
        note: { x: 420, y: 347, w: 98, h: 16 },
        journal: { x: 329, y: 379, w: 622, h: 198 },
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
    'fm-expense-list': fmExpenseList,
    'fm-expense-list-after': fmExpenseListAfter,
    'fm-financing-filled': fmFinancingFilled,
    'fm-financing-list': fmFinancingList,
    'fm-financing-locked': fmFinancingLocked,
    'fm-financing-picker': fmFinancingPicker,
    'fm-income-form-amount': fmIncomeFormAmount,
    'fm-income-form-category': fmIncomeFormCategory,
    'fm-income-form-empty': fmIncomeFormEmpty,
    'fm-income-form-filled': fmIncomeFormFilled,
    'fm-income-list': fmIncomeList,
    'fm-income-list-after': fmIncomeListAfter,
    'fm-income-payment-detail': fmIncomePaymentDetail,
    'fm-income-saved': fmIncomeSaved,
    'fm-transfer-detail': fmTransferDetail,
    'fm-transfer-form-accounts': fmTransferFormAccounts,
    'fm-transfer-form-empty': fmTransferFormEmpty,
    'fm-transfer-form-filled': fmTransferFormFilled,
    'fm-transfer-form-submit': fmTransferFormSubmit,
    'fm-transfer-list': fmTransferList,
    'fm-transfer-list-after': fmTransferListAfter,
    'fm-income-journal': fmIncomeJournal,
    'fm-expense-journal': fmExpenseJournal,
    'fm-financing-journal': fmFinancingJournal,
    'fm-financing-locked-detail': fmFinancingLockedDetail,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua field bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
