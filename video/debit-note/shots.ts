import type { Box } from '../components/walkthrough';
import adminExpense from './screens/admin-expense.webp';
import adminPay from './screens/admin-pay.webp';
import adminProfile from './screens/admin-profile.webp';
import staffClient from './screens/staff-client.webp';
import staffCode from './screens/staff-code.webp';
import staffDrawer from './screens/staff-drawer.webp';
import staffItem from './screens/staff-item.webp';
import staffJasa from './screens/staff-jasa.webp';
import staffJasaTotals from './screens/staff-jasa-totals.webp';
import staffList from './screens/staff-list.webp';
import staffNew from './screens/staff-new.webp';
import staffPublish from './screens/staff-publish.webp';
import staffTotals from './screens/staff-totals.webp';
import staffType from './screens/staff-type.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/debit-note/screens/*.webp.
 * Dihasilkan oleh video/capture/debit-note.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Kotak yang tidak bisa diukur skrip (nilai input, teks di header drawer) diukur dari screenshot (px ÷ 1,5).
 */
const editorTop = {
    title: { x: 348, y: 88, w: 377, h: 33 },
    type: { x: 315, y: 261, w: 449, h: 44 },
    debitNote: { x: 541, y: 265, w: 220, h: 36 },
    code: { x: 776, y: 261, w: 449, h: 42 },
    codeHint: { x: 776, y: 309, w: 449, h: 16 },
    publish: { x: 1055, y: 92, w: 193, h: 44 },
};
const nature = {
    nature: { x: 315, y: 358, w: 449, h: 44 },
    talangan: { x: 319, y: 362, w: 220, h: 36 },
    jasa: { x: 541, y: 362, w: 220, h: 36 },
    natureInfo: { x: 315, y: 410, w: 910, h: 68 },
};

export const SHOTS = {
    'staff-list': {
        create: { x: 1101, y: 96, w: 147, h: 44 },
        dnRow: { x: 315, y: 575, w: 918, h: 66 },
        dnBadge: { x: 606, y: 606, w: 101, h: 22 },
    },
    'staff-new': { ...editorTop, client: { x: 315, y: 452, w: 910, h: 42 } },
    'staff-type': { ...editorTop, ...nature },
    'staff-code': { ...editorTop, ...nature },
    'staff-client': {
        client: { x: 315, y: 174, w: 910, h: 42 },
        subject: { x: 315, y: 253, w: 910, h: 42 },
        attention: { x: 315, y: 333, w: 910, h: 42 },
    },
    'staff-item': {
        items: { x: 292, y: 217, w: 956, h: 370 },
        row1: { x: 315, y: 312, w: 910, h: 196 },
        name1: { x: 356, y: 325, w: 476, h: 34 },
        price1: { x: 997, y: 325, w: 99, h: 34 },
        desc1: { x: 356, y: 413, w: 856, h: 82 },
    },
    'staff-totals': {
        totals: { x: 292, y: 428, w: 956, h: 292 },
        summary: { x: 803, y: 499, w: 422, h: 198 },
        note: { x: 820, y: 625, w: 388, h: 55 },
    },
    'staff-publish': {
        dialog: { x: 416, y: 165, w: 448, h: 391 },
        number: { x: 441, y: 331, w: 397, h: 41 },
        confirm: { x: 712, y: 486, w: 127, h: 44 },
    },
    'staff-drawer': {
        number: { x: 433, y: 28, w: 330, h: 24 },
        status: { x: 767, y: 29, w: 61, h: 22 },
        metrics: { x: 385, y: 154, w: 871, h: 120 },
        talangan: { x: 1048, y: 154, w: 208, h: 120 },
        items: { x: 385, y: 385, w: 579, h: 90 },
        pay: { x: 1018, y: 20, w: 190, h: 40 },
    },
    'staff-jasa': { ...editorTop, ...nature },
    'staff-jasa-totals': {
        totals: { x: 292, y: 232, w: 956, h: 488 },
        ppn: { x: 315, y: 403, w: 464, h: 66 },
        pph: { x: 315, y: 556, w: 464, h: 87 },
    },
    'admin-profile': {
        heading: { x: 325, y: 312, w: 890, h: 24 },
        check: { x: 325, y: 392, w: 300, h: 20 },
        section: { x: 315, y: 300, w: 910, h: 150 },
    },
    'admin-pay': {
        dialog: { x: 384, y: 36, w: 512, h: 648 },
        amount: { x: 409, y: 134, w: 462, h: 108 },
        account: { x: 646, y: 258, w: 225, h: 68 },
        journal: { x: 409, y: 427, w: 462, h: 217 },
        credit: { x: 426, y: 566, w: 277, h: 33 },
    },
    'admin-expense': {
        category: { x: 409, y: 120, w: 462, h: 58 },
        hint: { x: 409, y: 185, w: 462, h: 58 },
        journal: { x: 409, y: 260, w: 462, h: 200 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-expense': adminExpense,
    'admin-pay': adminPay,
    'admin-profile': adminProfile,
    'staff-client': staffClient,
    'staff-code': staffCode,
    'staff-drawer': staffDrawer,
    'staff-item': staffItem,
    'staff-jasa': staffJasa,
    'staff-jasa-totals': staffJasaTotals,
    'staff-list': staffList,
    'staff-new': staffNew,
    'staff-publish': staffPublish,
    'staff-totals': staffTotals,
    'staff-type': staffType,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
