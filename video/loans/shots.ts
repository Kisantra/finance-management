import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminDelete from './screens/admin-delete.webp';
import adminExpenses from './screens/admin-expenses.webp';
import adminList from './screens/admin-list.webp';
import fmDetailAfter from './screens/fm-detail-after.webp';
import fmDetail from './screens/fm-detail.webp';
import fmFormAmount from './screens/fm-form-amount.webp';
import fmFormBank from './screens/fm-form-bank.webp';
import fmFormEmpty from './screens/fm-form-empty.webp';
import fmFormFilled from './screens/fm-form-filled.webp';
import fmFormLender from './screens/fm-form-lender.webp';
import fmFormRate from './screens/fm-form-rate.webp';
import fmFormTenor from './screens/fm-form-tenor.webp';
import fmListAfter from './screens/fm-list-after.webp';
import fmList from './screens/fm-list.webp';
import fmPayEmpty from './screens/fm-pay-empty.webp';
import fmPayFilled from './screens/fm-pay-filled.webp';
import fmPayPrincipal from './screens/fm-pay-principal.webp';
import fmPaySave from './screens/fm-pay-save.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/loans/screens/*.webp.
 * Dari video/capture/loans.js & loans-after.js; fm-form-bank.bank/section, fm-form-filled.upload,
 * fm-list.stats & fm-list.pay disesuaikan manual dari gambar.
 */
const form = {
    sheet: { x: 704, y: 0, w: 576, h: 720 },
    number: { x: 729, y: 204, w: 250, h: 40 },
    lender: { x: 995, y: 204, w: 250, h: 40 },
    amount: { x: 772, y: 286, w: 474, h: 40 },
    interestType: { x: 729, y: 485, w: 517, h: 42 },
    rate: { x: 729, y: 569, w: 250, h: 40 },
    tenor: { x: 995, y: 569, w: 250, h: 40 },
    start: { x: 729, y: 625, w: 250, h: 66 },
    maturity: { x: 995, y: 625, w: 250, h: 66 },
    save: { x: 1110, y: 668, w: 146, h: 36 },
};

const pay = {
    dialog: { x: 416, y: 36, w: 448, h: 648 },
    summary: { x: 417, y: 98, w: 436, h: 110 },
    bank: { x: 417, y: 207, w: 436, h: 66 },
    date: { x: 417, y: 289, w: 436, h: 66 },
    principal: { x: 417, y: 371, w: 436, h: 66 },
    interest: { x: 417, y: 453, w: 436, h: 66 },
    reference: { x: 417, y: 535, w: 436, h: 66 },
    notes: { x: 417, y: 617, w: 436, h: 66 },
};

export const SHOTS = {
    'fm-list': {
        create: { x: 1095, y: 104, w: 153, h: 32 },
        stats: { x: 292, y: 180, w: 956, h: 102 },
        table: { x: 293, y: 402, w: 954, h: 186 },
        row: { x: 293, y: 459, w: 954, h: 65 },
        remaining: { x: 966, y: 459, w: 119, h: 65 },
        actions: { x: 1163, y: 459, w: 84, h: 65 },
    },
    'fm-form-empty': form,
    'fm-form-lender': form,
    'fm-form-amount': form,
    'fm-form-rate': form,
    'fm-form-tenor': form,
    'fm-form-bank': {
        section: { x: 729, y: 125, w: 517, h: 110 },
        bank: { x: 729, y: 193, w: 517, h: 40 },
        option: { x: 735, y: 280, w: 503, h: 36 },
        list: { x: 729, y: 237, w: 517, h: 230 },
    },
    'fm-form-filled': {
        sheet: { x: 704, y: 0, w: 576, h: 720 },
        bank: { x: 729, y: 260, w: 517, h: 40 },
        purpose: { x: 729, y: 460, w: 517, h: 80 },
        upload: { x: 729, y: 600, w: 517, h: 44 },
        save: { x: 1110, y: 668, w: 146, h: 36 },
    },
    'fm-list-after': {
        stats: { x: 292, y: 180, w: 956, h: 102 },
        row: { x: 293, y: 459, w: 954, h: 65 },
        mandiri: { x: 293, y: 524, w: 954, h: 65 },
        mandiriRemaining: { x: 944, y: 524, w: 109, h: 65 },
    },
    'fm-detail': {
        dialog: { x: 384, y: 90, w: 512, h: 541 },
        progress: { x: 385, y: 392, w: 510, h: 96 },
        pay: { x: 385, y: 598, w: 461, h: 32 },
    },
    'fm-detail-after': {
        dialog: { x: 384, y: 90, w: 512, h: 541 },
        progress: { x: 385, y: 392, w: 510, h: 96 },
    },
    'fm-pay-empty': pay,
    'fm-pay-principal': pay,
    'fm-pay-filled': pay,
    'fm-pay-save': {
        notes: { x: 417, y: 548, w: 436, h: 66 },
        save: { x: 660, y: 631, w: 169, h: 36 },
    },
    'admin-list': {
        row: { x: 293, y: 459, w: 954, h: 65 },
        actions: { x: 1131, y: 459, w: 116, h: 65 },
        paidRow: { x: 293, y: 588, w: 954, h: 64 },
    },
    'admin-delete': {
        dialog: { x: 448, y: 265, w: 384, h: 189 },
    },
    'admin-bank': {
        account: { x: 301, y: 162, w: 190, h: 88 },
        search: { x: 534, y: 153, w: 256, h: 36 },
        credit: { x: 535, y: 251, w: 750, h: 65 },
        principal: { x: 535, y: 315, w: 750, h: 77 },
        interest: { x: 535, y: 392, w: 750, h: 77 },
    },
    'admin-expenses': {
        row: { x: 293, y: 513, w: 944, h: 65 },
        table: { x: 293, y: 468, w: 944, h: 252 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-bank': adminBank,
    'admin-delete': adminDelete,
    'admin-expenses': adminExpenses,
    'admin-list': adminList,
    'fm-detail-after': fmDetailAfter,
    'fm-detail': fmDetail,
    'fm-form-amount': fmFormAmount,
    'fm-form-bank': fmFormBank,
    'fm-form-empty': fmFormEmpty,
    'fm-form-filled': fmFormFilled,
    'fm-form-lender': fmFormLender,
    'fm-form-rate': fmFormRate,
    'fm-form-tenor': fmFormTenor,
    'fm-list-after': fmListAfter,
    'fm-list': fmList,
    'fm-pay-empty': fmPayEmpty,
    'fm-pay-filled': fmPayFilled,
    'fm-pay-principal': fmPayPrincipal,
    'fm-pay-save': fmPaySave,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
