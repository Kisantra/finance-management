import type { Box } from '../components/walkthrough';
import fmCash from './screens/fm-cash.webp';
import fmList from './screens/fm-list.webp';
import fmNewBank from './screens/fm-new-bank.webp';
import fmNewCash from './screens/fm-new-cash.webp';
import fmNewFilled from './screens/fm-new-filled.webp';
import fmRefill from './screens/fm-refill.webp';
import fmRefillDone from './screens/fm-refill-done.webp';
import fmRefillFilled from './screens/fm-refill-filled.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/kas-kecil/screens/*.webp.
 * Dihasilkan oleh video/capture/kas-kecil.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Kartu Ringkasan Total dan baris ringkasan transfer diukur dari screenshot (px ÷ 1,5).
 */
const cashForm = {
    dialog: { x: 304, y: 57, w: 672, h: 606 },
    type: { x: 329, y: 218, w: 622, h: 36 },
    name: { x: 329, y: 300, w: 622, h: 42 },
    custodian: { x: 329, y: 383, w: 303, h: 42 },
    limit: { x: 691, y: 383, w: 260, h: 42 },
    limitHint: { x: 648, y: 429, w: 303, h: 48 },
    opening: { x: 372, y: 519, w: 260, h: 42 },
    submit: { x: 839, y: 598, w: 112, h: 40 },
};
const cashPage = {
    kasCard: { x: 301, y: 281, w: 203, h: 131 },
    header: { x: 537, y: 165, w: 711, h: 65 },
    info: { x: 597, y: 214, w: 651, h: 16 },
    refill: { x: 537, y: 250, w: 94, h: 32 },
};

export const SHOTS = {
    'fm-list': {
        add: { x: 1102, y: 86, w: 146, h: 40 },
        totals: { x: 293, y: 501, w: 219, h: 219 },
        bankCash: { x: 309, y: 575, w: 188, h: 59 },
    },
    'fm-new-bank': {
        dialog: { x: 304, y: 84, w: 672, h: 553 },
        type: { x: 329, y: 222, w: 622, h: 36 },
        cash: { x: 644, y: 222, w: 307, h: 36 },
    },
    'fm-new-cash': cashForm,
    'fm-new-filled': cashForm,
    'fm-cash': cashPage,
    'fm-refill': {
        dialog: { x: 256, y: 36, w: 768, h: 648 },
        source: { x: 281, y: 305, w: 347, h: 42 },
        target: { x: 281, y: 388, w: 347, h: 42 },
        amount: { x: 695, y: 305, w: 304, h: 42 },
        fee: { x: 695, y: 408, w: 304, h: 42 },
    },
    'fm-refill-filled': {
        summary: { x: 281, y: 323, w: 718, h: 42 },
        journal: { x: 281, y: 382, w: 718, h: 200 },
        submit: { x: 854, y: 619, w: 145, h: 40 },
    },
    'fm-refill-done': { ...cashPage, kasCard: { x: 301, y: 281, w: 203, h: 95 } },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'fm-cash': fmCash,
    'fm-list': fmList,
    'fm-new-bank': fmNewBank,
    'fm-new-cash': fmNewCash,
    'fm-new-filled': fmNewFilled,
    'fm-refill': fmRefill,
    'fm-refill-done': fmRefillDone,
    'fm-refill-filled': fmRefillFilled,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
