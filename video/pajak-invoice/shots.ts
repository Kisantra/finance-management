import type { Box } from '../components/walkthrough';
import adminTaxOff from './screens/admin-tax-off.webp';
import adminTaxOn from './screens/admin-tax-on.webp';
import staffDrawer from './screens/staff-drawer.webp';
import staffFaktur from './screens/staff-faktur.webp';
import staffList from './screens/staff-list.webp';
import staffPphOff from './screens/staff-pph-off.webp';
import staffTax from './screens/staff-tax.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/pajak-invoice/screens/*.webp.
 * Dihasilkan oleh video/capture/pajak-invoice.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 */
const totals = {
    ppn: { x: 315, y: 402, w: 464, h: 66 },
    faktur: { x: 315, y: 481, w: 464, h: 42 },
    pph: { x: 315, y: 556, w: 464, h: 87 },
    pphRate: { x: 315, y: 655, w: 112, h: 42 },
    summary: { x: 803, y: 303, w: 422, h: 257 },
    total: { x: 820, y: 436, w: 388, h: 41 },
};

export const SHOTS = {
    'admin-tax-off': {
        heading: { x: 325, y: 108, w: 890, h: 24 },
        pkp: { x: 325, y: 208, w: 300, h: 20 },
        pph: { x: 325, y: 244, w: 330, h: 20 },
    },
    'admin-tax-on': {
        heading: { x: 325, y: 108, w: 890, h: 24 },
        pkp: { x: 325, y: 208, w: 300, h: 20 },
        npwp: { x: 325, y: 270, w: 437, h: 42 },
        ppnRate: { x: 778, y: 270, w: 437, h: 42 },
        pph: { x: 325, y: 328, w: 330, h: 20 },
        pphRate: { x: 325, y: 434, w: 437, h: 42 },
    },
    'staff-tax': totals,
    'staff-faktur': totals,
    'staff-pph-off': {
        ppn: { x: 315, y: 456, w: 464, h: 66 },
        pph: { x: 315, y: 610, w: 464, h: 87 },
        pphSwitch: { x: 743, y: 610, w: 36, h: 20 },
        summary: { x: 803, y: 357, w: 422, h: 229 },
        total: { x: 820, y: 462, w: 388, h: 41 },
    },
    'staff-drawer': {
        metrics: { x: 385, y: 154, w: 871, h: 106 },
        items: { x: 385, y: 369, w: 579, h: 90 },
        totals: { x: 664, y: 479, w: 300, h: 113 },
    },
    'staff-list': {
        summary: { x: 292, y: 164, w: 956, h: 218 },
        ppnCard: { x: 497, y: 187, w: 182, h: 98 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-tax-off': adminTaxOff,
    'admin-tax-on': adminTaxOn,
    'staff-drawer': staffDrawer,
    'staff-faktur': staffFaktur,
    'staff-list': staffList,
    'staff-pph-off': staffPphOff,
    'staff-tax': staffTax,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
