import type { Box } from '../components/walkthrough';
import staffDecimal from './screens/staff-decimal.webp';
import staffDetail from './screens/staff-detail.webp';
import staffDetailEmpty from './screens/staff-detail-empty.webp';
import staffDrawer from './screens/staff-drawer.webp';
import staffPackage from './screens/staff-package.webp';
import staffPackageDesc from './screens/staff-package-desc.webp';
import staffPrint from './screens/staff-print.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/rincian-invoice/screens/*.webp.
 * Dihasilkan oleh video/capture/rincian-invoice.js + rincian-invoice-print.js — ambil ulang bila UI berubah.
 * Kotak di dalam gambar PDF (staff-print) dan teks subtotal diukur dari screenshot (px ÷ 1,5).
 */
const detail = {
    client: { x: 315, y: 140, w: 910, h: 42 },
    subject: { x: 315, y: 220, w: 910, h: 42 },
    attention: { x: 315, y: 299, w: 910, h: 42 },
    attentionHint: { x: 315, y: 345, w: 910, h: 16 },
};

export const SHOTS = {
    'staff-detail-empty': detail,
    'staff-detail': detail,
    'staff-package': {
        row1: { x: 315, y: 185, w: 910, h: 104 },
        name1: { x: 356, y: 198, w: 476, h: 34 },
        qty1: { x: 880, y: 198, w: 76, h: 34 },
        unit1: { x: 880, y: 242, w: 76, h: 34 },
        price1: { x: 997, y: 198, w: 99, h: 34 },
        addDesc: { x: 356, y: 242, w: 138, h: 32 },
    },
    'staff-package-desc': {
        row1: { x: 315, y: 185, w: 910, h: 196 },
        desc1: { x: 356, y: 286, w: 856, h: 82 },
    },
    'staff-decimal': {
        row1: { x: 315, y: 94, w: 910, h: 196 },
        row2: { x: 315, y: 300, w: 910, h: 104 },
        qty2: { x: 880, y: 313, w: 76, h: 34 },
        price2: { x: 997, y: 313, w: 99, h: 34 },
        subtotal2: { x: 1122, y: 320, w: 90, h: 20 },
    },
    'staff-drawer': {
        items: { x: 385, y: 369, w: 579, h: 147 },
        row1: { x: 385, y: 402, w: 579, h: 57 },
        row2: { x: 385, y: 459, w: 579, h: 57 },
    },
    'staff-print': {
        table: { x: 500, y: 119, w: 679, h: 309 },
        row1: { x: 500, y: 160, w: 679, h: 141 },
        desc: { x: 570, y: 160, w: 252, h: 141 },
        row2: { x: 500, y: 301, w: 679, h: 61 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'staff-decimal': staffDecimal,
    'staff-detail': staffDetail,
    'staff-detail-empty': staffDetailEmpty,
    'staff-drawer': staffDrawer,
    'staff-package': staffPackage,
    'staff-package-desc': staffPackageDesc,
    'staff-print': staffPrint,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
