import type { Box } from '../components/walkthrough';
import adminCategories from './screens/admin-categories.webp';
import adminIncome from './screens/admin-income.webp';
import adminPlTop from './screens/admin-pl-top.webp';
import fmPlClassified from './screens/fm-pl-classified.webp';
import fmPlClassifyOpen from './screens/fm-pl-classify-open.webp';
import fmPlDocBottom from './screens/fm-pl-doc-bottom.webp';
import fmPlMonth from './screens/fm-pl-month.webp';
import fmPlPanel from './screens/fm-pl-panel.webp';
import fmPlTop from './screens/fm-pl-top.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/profit-loss/screens/*.webp.
 * Dihasilkan oleh video/capture/profit-loss.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Kotak yang melewati tepi layar dipangkas manual; `section`/`preTax` di fm-pl-classified diukur dari gambar.
 */
const header = {
    pdf: { x: 1127, y: 104, w: 111, h: 32 },
    presets: { x: 309, y: 201, w: 361, h: 32 },
    thisMonth: { x: 309, y: 201, w: 62, h: 32 },
    range: { x: 703, y: 197, w: 518, h: 40 },
    period: { x: 356, y: 476, w: 434, h: 16 },
    panelHead: { x: 898, y: 298, w: 318, h: 58 },
};

export const SHOTS = {
    'fm-pl-top': {
        ...header,
        invoiceRevenue: { x: 356, y: 555, w: 434, h: 29 },
        totalRevenue: { x: 356, y: 588, w: 434, h: 30 },
        cogsInvoice: { x: 356, y: 677, w: 434, h: 29 },
        card: { x: 898, y: 651, w: 318, h: 69 },
    },
    'fm-pl-doc-bottom': {
        grossProfit: { x: 356, y: 71, w: 434, h: 49 },
        opexTitle: { x: 356, y: 148, w: 434, h: 23 },
        opexTotal: { x: 356, y: 299, w: 434, h: 30 },
        operatingProfit: { x: 356, y: 341, w: 434, h: 49 },
        preTax: { x: 356, y: 403, w: 434, h: 49 },
        net: { x: 356, y: 464, w: 434, h: 49 },
    },
    'fm-pl-panel': {
        card: { x: 898, y: 342, w: 318, h: 120 },
        select: { x: 911, y: 409, w: 293, h: 40 },
    },
    'fm-pl-classify-open': {
        card: { x: 898, y: 342, w: 318, h: 120 },
        select: { x: 911, y: 409, w: 293, h: 40 },
        option: { x: 918, y: 533, w: 279, h: 36 },
        list: { x: 912, y: 491, w: 291, h: 84 },
    },
    'fm-pl-classified': {
        section: { x: 356, y: 380, w: 434, h: 96 },
        meetingRoom: { x: 356, y: 416, w: 434, h: 29 },
        operatingProfit: { x: 356, y: 308, w: 434, h: 49 },
        preTax: { x: 356, y: 497, w: 434, h: 49 },
        net: { x: 356, y: 552, w: 434, h: 49 },
    },
    'fm-pl-month': header,
    'admin-pl-top': {
        ...header,
        invoiceRevenue: { x: 356, y: 555, w: 434, h: 29 },
        totalRevenue: { x: 356, y: 588, w: 434, h: 30 },
        cogsInvoice: { x: 356, y: 677, w: 434, h: 29 },
    },
    'admin-income': {
        invoiceRow: { x: 293, y: 622, w: 944, h: 61 },
        directRow: { x: 293, y: 501, w: 944, h: 61 },
        sourceCol: { x: 458, y: 456, w: 126, h: 44 },
    },
    'admin-categories': {
        groupCol: { x: 855, y: 370, w: 164, h: 40 },
        opexRow: { x: 293, y: 675, w: 944, h: 45 },
        opexGroup: { x: 867, y: 691, w: 131, h: 20 },
        unclassified: { x: 1013, y: 180, w: 224, h: 102 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-categories': adminCategories,
    'admin-income': adminIncome,
    'admin-pl-top': adminPlTop,
    'fm-pl-classified': fmPlClassified,
    'fm-pl-classify-open': fmPlClassifyOpen,
    'fm-pl-doc-bottom': fmPlDocBottom,
    'fm-pl-month': fmPlMonth,
    'fm-pl-panel': fmPlPanel,
    'fm-pl-top': fmPlTop,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
