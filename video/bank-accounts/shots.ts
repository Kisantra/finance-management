import type { Box } from '../components/walkthrough';
import adminAccount from './screens/admin-account.webp';
import adminExpenses from './screens/admin-expenses.webp';
import adminIncome from './screens/admin-income.webp';
import adminPl from './screens/admin-pl.webp';
import adminTransfers from './screens/admin-transfers.webp';
import fmAccountAfter from './screens/fm-account-after.webp';
import fmAccountBank from './screens/fm-account-bank.webp';
import fmAccountDelete from './screens/fm-account-delete.webp';
import fmAccountEdit from './screens/fm-account-edit.webp';
import fmAccountEmpty from './screens/fm-account-empty.webp';
import fmAccountFilled from './screens/fm-account-filled.webp';
import fmAccountName from './screens/fm-account-name.webp';
import fmAccountNew from './screens/fm-account-new.webp';
import fmExpenseAmount from './screens/fm-expense-amount.webp';
import fmExpenseCategory from './screens/fm-expense-category.webp';
import fmExpenseEmpty from './screens/fm-expense-empty.webp';
import fmExpenseFilled from './screens/fm-expense-filled.webp';
import fmExpenseSaved from './screens/fm-expense-saved.webp';
import fmIncomeFilled from './screens/fm-income-filled.webp';
import fmMenu from './screens/fm-menu.webp';
import fmOverview from './screens/fm-overview.webp';
import fmPayments from './screens/fm-payments.webp';
import fmQuickCategory from './screens/fm-quick-category.webp';
import fmTransactions from './screens/fm-transactions.webp';
import fmTransactionsRight from './screens/fm-transactions-right.webp';
import fmTransferAccounts from './screens/fm-transfer-accounts.webp';
import fmTransferAmount from './screens/fm-transfer-amount.webp';
import fmTransferEmpty from './screens/fm-transfer-empty.webp';
import fmTransferFilled from './screens/fm-transfer-filled.webp';
import fmTransferSubmit from './screens/fm-transfer-submit.webp';
import fmTxDelete from './screens/fm-tx-delete.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/bank-accounts/screens/*.webp.
 * Dihasilkan oleh video/capture/bank-accounts.js; kotak kartu/baris yang terpotong disesuaikan manual.
 */
const page = {
    create: { x: 1064, y: 102, w: 174, h: 36 },
    tutorial: { x: 941, y: 98, w: 115, h: 44 },
    accountList: { x: 292, y: 180, w: 218, h: 318 },
    total: { x: 292, y: 514, w: 218, h: 206 },
    month: { x: 1062, y: 280, w: 176, h: 40 },
    stats: { x: 534, y: 336, w: 704, h: 62 },
    chart: { x: 534, y: 414, w: 416, h: 306 },
    breakdown: { x: 966, y: 414, w: 272, h: 306 },
};
/** Rekening terpilih (BRI) di kolom kanan: tombol aksi berada di dua baris. */
const bri = {
    ...page,
    selected: { x: 301, y: 263, w: 190, h: 88 },
    title: { x: 534, y: 194, w: 353, h: 49 },
    expense: { x: 904, y: 180, w: 121, h: 32 },
    income: { x: 1033, y: 180, w: 116, h: 32 },
    transfer: { x: 904, y: 222, w: 95, h: 32 },
    actions: { x: 904, y: 180, w: 245, h: 74 },
    more: { x: 1007, y: 222, w: 40, h: 32 },
};
const accountForm = {
    dialog: { x: 304, y: 140, w: 672, h: 439 },
    name: { x: 329, y: 286, w: 622, h: 40 },
    number: { x: 329, y: 368, w: 303, h: 40 },
    bank: { x: 648, y: 368, w: 303, h: 40 },
    branch: { x: 329, y: 450, w: 303, h: 40 },
    initial: { x: 648, y: 450, w: 303, h: 40 },
    submit: { x: 802, y: 527, w: 150, h: 36 },
};
const txForm = {
    dialog: { x: 256, y: 42, w: 768, h: 635 },
    account: { x: 281, y: 255, w: 347, h: 40 },
    category: { x: 281, y: 311, w: 347, h: 66 },
    categoryTrigger: { x: 281, y: 337, w: 347, h: 40 },
    quickAdd: { x: 567, y: 313, w: 61, h: 16 },
    amount: { x: 281, y: 419, w: 347, h: 40 },
    date: { x: 281, y: 501, w: 347, h: 40 },
    description: { x: 652, y: 255, w: 347, h: 80 },
    reference: { x: 652, y: 377, w: 347, h: 40 },
    upload: { x: 652, y: 459, w: 347, h: 109 },
    submit: { x: 830, y: 625, w: 169, h: 36 },
    close: { x: 748, y: 625, w: 70, h: 36 },
};
const transfer = {
    dialog: { x: 256, y: 36, w: 768, h: 648 },
    flow: { x: 281, y: 156, w: 708, h: 94 },
    from: { x: 281, y: 296, w: 342, h: 40 },
    to: { x: 281, y: 378, w: 342, h: 40 },
    category: { x: 281, y: 460, w: 342, h: 40 },
    date: { x: 281, y: 542, w: 342, h: 40 },
    amount: { x: 647, y: 296, w: 342, h: 40 },
    fee: { x: 647, y: 398, w: 342, h: 40 },
    description: { x: 647, y: 500, w: 342, h: 80 },
};
const confirm = {
    dialog: { x: 448, y: 255, w: 384, h: 209 },
    confirm: { x: 732, y: 412, w: 75, h: 36 },
    cancel: { x: 654, y: 412, w: 66, h: 36 },
};

export const SHOTS = {
    'fm-overview': {
        ...page,
        actions: { x: 871, y: 180, w: 367, h: 32 },
        expense: { x: 871, y: 180, w: 121, h: 32 },
        income: { x: 1000, y: 180, w: 116, h: 32 },
        transfer: { x: 1124, y: 180, w: 95, h: 32 },
        selected: { x: 301, y: 234, w: 190, h: 88 },
    },
    'fm-account-empty': accountForm,
    'fm-account-name': accountForm,
    'fm-account-bank': accountForm,
    'fm-account-filled': accountForm,
    'fm-account-new': bri,
    'fm-expense-empty': txForm,
    'fm-quick-category': {
        dialog: { x: 448, y: 172, w: 384, h: 376 },
        mode: { x: 473, y: 266, w: 334, h: 37 },
        group: { x: 473, y: 345, w: 334, h: 40 },
        name: { x: 473, y: 426, w: 334, h: 42 },
        save: { x: 737, y: 500, w: 70, h: 32 },
    },
    'fm-expense-category': txForm,
    'fm-expense-amount': txForm,
    'fm-expense-filled': {
        dialog: { x: 256, y: 66, w: 768, h: 588 },
        account: { x: 281, y: 278, w: 347, h: 40 },
        categoryTrigger: { x: 281, y: 360, w: 347, h: 40 },
        amount: { x: 281, y: 442, w: 347, h: 40 },
        date: { x: 281, y: 524, w: 347, h: 40 },
        description: { x: 652, y: 278, w: 347, h: 80 },
        reference: { x: 652, y: 400, w: 347, h: 40 },
        upload: { x: 652, y: 482, w: 347, h: 42 },
        submit: { x: 830, y: 601, w: 169, h: 36 },
        close: { x: 748, y: 601, w: 70, h: 36 },
    },
    'fm-expense-saved': { ...txForm, toast: { x: 1090, y: 18, w: 178, h: 30 } },
    'fm-income-filled': txForm,
    'fm-transfer-empty': transfer,
    'fm-transfer-accounts': transfer,
    'fm-transfer-amount': transfer,
    'fm-transfer-filled': transfer,
    'fm-transfer-submit': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        amount: { x: 647, y: 82, w: 342, h: 40 },
        fee: { x: 647, y: 184, w: 342, h: 40 },
        summary: { x: 281, y: 537, w: 708, h: 57 },
        submit: { x: 846, y: 631, w: 143, h: 36 },
    },
    'fm-account-after': bri,
    'fm-transactions': {
        tabs: { x: 534, y: 145, w: 269, h: 44 },
        filters: { x: 534, y: 205, w: 704, h: 88 },
        table: { x: 535, y: 309, w: 703, h: 368 },
        expenseRow: { x: 535, y: 354, w: 703, h: 77 },
        zoomRow: { x: 535, y: 431, w: 703, h: 93 },
        incomeRow: { x: 535, y: 524, w: 703, h: 77 },
        transferRow: { x: 535, y: 600, w: 703, h: 76 },
    },
    'fm-transactions-right': {
        table: { x: 535, y: 309, w: 703, h: 368 },
        expenseRow: { x: 535, y: 354, w: 703, h: 77 },
        amounts: { x: 1094, y: 309, w: 144, h: 368 },
        deleteIcon: { x: 1199, y: 379, w: 26, h: 26 },
    },
    'fm-tx-delete': confirm,
    'fm-payments': {
        tabs: { x: 534, y: 169, w: 269, h: 44 },
        table: { x: 535, y: 334, w: 703, h: 386 },
    },
    'fm-menu': {
        ...bri,
        menu: { x: 851, y: 260, w: 192, h: 115 },
        edit: { x: 855, y: 265, w: 182, h: 32 },
        exportPdf: { x: 855, y: 297, w: 182, h: 32 },
        remove: { x: 855, y: 338, w: 182, h: 32 },
    },
    'fm-account-edit': {
        dialog: { x: 304, y: 130, w: 672, h: 459 },
        initial: { x: 648, y: 440, w: 303, h: 60 },
        submit: { x: 794, y: 537, w: 157, h: 36 },
    },
    'fm-account-delete': confirm,
    'admin-account': {
        ...page,
        selected: { x: 301, y: 263, w: 190, h: 88 },
        jago: { x: 301, y: 354, w: 190, h: 88 },
        total: { x: 292, y: 514, w: 218, h: 206 },
    },
    'admin-expenses': {
        row: { x: 293, y: 513, w: 945, h: 83 },
        category: { x: 807, y: 545, w: 140, h: 20 },
        amount: { x: 1137, y: 545, w: 99, h: 18 },
    },
    'admin-income': { row: { x: 293, y: 574, w: 945, h: 60 } },
    'admin-transfers': {
        row: { x: 293, y: 513, w: 955, h: 96 },
        fee: { x: 1176, y: 525, w: 69, h: 40 },
    },
    'admin-pl': {
        unclassified: { x: 879, y: 278, w: 358, h: 442 },
        sewa: { x: 899, y: 651, w: 318, h: 69 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-account': adminAccount,
    'admin-expenses': adminExpenses,
    'admin-income': adminIncome,
    'admin-pl': adminPl,
    'admin-transfers': adminTransfers,
    'fm-account-after': fmAccountAfter,
    'fm-account-bank': fmAccountBank,
    'fm-account-delete': fmAccountDelete,
    'fm-account-edit': fmAccountEdit,
    'fm-account-empty': fmAccountEmpty,
    'fm-account-filled': fmAccountFilled,
    'fm-account-name': fmAccountName,
    'fm-account-new': fmAccountNew,
    'fm-expense-amount': fmExpenseAmount,
    'fm-expense-category': fmExpenseCategory,
    'fm-expense-empty': fmExpenseEmpty,
    'fm-expense-filled': fmExpenseFilled,
    'fm-expense-saved': fmExpenseSaved,
    'fm-income-filled': fmIncomeFilled,
    'fm-menu': fmMenu,
    'fm-overview': fmOverview,
    'fm-payments': fmPayments,
    'fm-quick-category': fmQuickCategory,
    'fm-transactions': fmTransactions,
    'fm-transactions-right': fmTransactionsRight,
    'fm-transfer-accounts': fmTransferAccounts,
    'fm-transfer-amount': fmTransferAmount,
    'fm-transfer-empty': fmTransferEmpty,
    'fm-transfer-filled': fmTransferFilled,
    'fm-transfer-submit': fmTransferSubmit,
    'fm-tx-delete': fmTxDelete,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua field bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
