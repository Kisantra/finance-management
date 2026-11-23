import type { Box } from '../components/walkthrough';
import adminBank from './screens/admin-bank.webp';
import adminUsd from './screens/admin-usd.webp';
import fmPaid from './screens/fm-paid.webp';
import fmPay from './screens/fm-pay.webp';
import fmPayJournal from './screens/fm-pay-journal.webp';
import fmPayRate from './screens/fm-pay-rate.webp';
import staffDrawer from './screens/staff-drawer.webp';
import staffItem from './screens/staff-item.webp';
import staffItemRp from './screens/staff-item-rp.webp';
import staffNew from './screens/staff-new.webp';
import staffRate from './screens/staff-rate.webp';
import staffTotals from './screens/staff-totals.webp';
import staffUsd from './screens/staff-usd.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/tagihan-usd/screens/*.webp.
 * Dihasilkan oleh video/capture/tagihan-usd.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Kotak yang tidak bisa diukur skrip (teks subtotal, kartu Pembayaran drawer) diukur dari screenshot (px ÷ 1,5).
 */
const detail = {
    currency: { x: 315, y: 366, w: 449, h: 44 },
    usd: { x: 541, y: 370, w: 220, h: 36 },
    rate: { x: 819, y: 366, w: 406, h: 42 },
    rateBlock: { x: 315, y: 341, w: 910, h: 88 },
    info: { x: 315, y: 436, w: 910, h: 21 },
};
const pay = {
    dialog: { x: 384, y: 36, w: 512, h: 648 },
    received: { x: 463, y: 160, w: 171, h: 42 },
    rate: { x: 689, y: 160, w: 182, h: 42 },
    rateHint: { x: 646, y: 206, w: 225, h: 16 },
    result: { x: 409, y: 234, w: 462, h: 20 },
    account: { x: 646, y: 335, w: 225, h: 42 },
};

export const SHOTS = {
    'admin-usd': {
        heading: { x: 325, y: 312, w: 890, h: 24 },
        check: { x: 325, y: 392, w: 330, h: 20 },
        section: { x: 315, y: 300, w: 910, h: 150 },
    },
    'admin-bank': {
        heading: { x: 325, y: 67, w: 890, h: 24 },
        currency: { x: 325, y: 392, w: 144, h: 70 },
        branch: { x: 481, y: 392, w: 337, h: 68 },
        swift: { x: 830, y: 392, w: 337, h: 68 },
    },
    'staff-new': detail,
    'staff-usd': detail,
    'staff-rate': detail,
    'staff-item-rp': {
        row1: { x: 315, y: 358, w: 910, h: 104 },
        usdToggle: { x: 647, y: 415, w: 111, h: 32 },
        price1: { x: 997, y: 371, w: 99, h: 34 },
        qty1: { x: 880, y: 371, w: 76, h: 34 },
    },
    'staff-item': {
        row1: { x: 315, y: 343, w: 910, h: 134 },
        usdToggle: { x: 647, y: 400, w: 111, h: 32 },
        price1: { x: 964, y: 356, w: 132, h: 34 },
        qty1: { x: 880, y: 356, w: 76, h: 34 },
        hint: { x: 328, y: 444, w: 884, h: 20 },
        subtotal: { x: 1105, y: 363, w: 107, h: 20 },
    },
    'staff-totals': {
        ppn: { x: 315, y: 510, w: 464, h: 66 },
        pph: { x: 315, y: 610, w: 464, h: 87 },
        summary: { x: 803, y: 411, w: 422, h: 237 },
        usdLine: { x: 820, y: 537, w: 388, h: 28 },
    },
    'staff-drawer': {
        status: { x: 625, y: 29, w: 61, h: 22 },
        metrics: { x: 385, y: 154, w: 871, h: 122 },
        usdCard: { x: 385, y: 154, w: 209, h: 120 },
        items: { x: 385, y: 385, w: 579, h: 90 },
    },
    'fm-pay': pay,
    'fm-pay-rate': pay,
    'fm-pay-journal': { journal: { x: 409, y: 236, w: 462, h: 249 } },
    'fm-paid': {
        status: { x: 625, y: 29, w: 68, h: 22 },
        metrics: { x: 385, y: 154, w: 871, h: 122 },
        payments: { x: 985, y: 523, w: 271, h: 197 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-bank': adminBank,
    'admin-usd': adminUsd,
    'fm-paid': fmPaid,
    'fm-pay': fmPay,
    'fm-pay-journal': fmPayJournal,
    'fm-pay-rate': fmPayRate,
    'staff-drawer': staffDrawer,
    'staff-item': staffItem,
    'staff-item-rp': staffItemRp,
    'staff-new': staffNew,
    'staff-rate': staffRate,
    'staff-totals': staffTotals,
    'staff-usd': staffUsd,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
