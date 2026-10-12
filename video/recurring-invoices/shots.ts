import type { Box } from '../components/walkthrough';
import adminArchive from './screens/admin-archive.webp';
import adminDeleteTemplate from './screens/admin-delete-template.webp';
import adminInvoiceDrawer from './screens/admin-invoice-drawer.webp';
import adminInvoices from './screens/admin-invoices.webp';
import fmAnalytics from './screens/fm-analytics.webp';
import fmBulk from './screens/fm-bulk.webp';
import fmGenerate from './screens/fm-generate.webp';
import fmIndex from './screens/fm-index.webp';
import fmMonthly from './screens/fm-monthly.webp';
import fmMonthlyEdit from './screens/fm-monthly-edit.webp';
import fmMonthlyEmpty from './screens/fm-monthly-empty.webp';
import fmPublish from './screens/fm-publish.webp';
import fmPublished from './screens/fm-published.webp';
import fmTemplates from './screens/fm-templates.webp';
import fmTplClient from './screens/fm-tpl-client.webp';
import fmTplDates from './screens/fm-tpl-dates.webp';
import fmTplEmpty from './screens/fm-tpl-empty.webp';
import fmTplFilled from './screens/fm-tpl-filled.webp';
import fmTplItem1 from './screens/fm-tpl-item1.webp';
import fmTplLookup from './screens/fm-tpl-lookup.webp';
import fmTplName from './screens/fm-tpl-name.webp';
import fmTplStart from './screens/fm-tpl-start.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/recurring-invoices/screens/*.webp.
 * Dihasilkan oleh video/capture/recurring-invoices.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Disesuaikan manual: summary (panel kanan), kotak yang melewati tepi layar, dan isi drawer invoice.
 */
const tpl = {
    detail: { x: 292, y: 176, w: 703, h: 356 },
    name: { x: 317, y: 296, w: 317, h: 40 },
    client: { x: 654, y: 296, w: 317, h: 40 },
    start: { x: 317, y: 382, w: 317, h: 40 },
    end: { x: 654, y: 382, w: 317, h: 40 },
    frequency: { x: 317, y: 470, w: 654, h: 38 },
    items: { x: 292, y: 556, w: 703, h: 164 },
    lookup1: { x: 653, y: 670, w: 28, h: 28 },
    row1: { x: 293, y: 662, w: 702, h: 45 },
    addItem: { x: 845, y: 575, w: 125, h: 32 },
    submit: { x: 1036, y: 397, w: 185, h: 36 },
    summary: { x: 1020, y: 176, w: 217, h: 280 },
};
const monthly = {
    month: { x: 292, y: 253, w: 243, h: 34 },
    generate: { x: 939, y: 104, w: 167, h: 32 },
    manual: { x: 1114, y: 104, w: 124, h: 32 },
    stats: { x: 292, y: 316, w: 946, h: 102 },
    table: { x: 293, y: 442, w: 945, h: 174 },
    row: { x: 293, y: 487, w: 945, h: 65 },
    row2: { x: 293, y: 552, w: 945, h: 64 },
    publish: { x: 1145, y: 506, w: 26, h: 26 },
    edit: { x: 1175, y: 506, w: 26, h: 26 },
    remove: { x: 1205, y: 506, w: 26, h: 26 },
    toast: { x: 900, y: 24, w: 356, h: 53 },
};
const templates = {
    create: { x: 1101, y: 104, w: 136, h: 32 },
    tabs: { x: 292, y: 180, w: 356, h: 44 },
    stats: { x: 292, y: 248, w: 946, h: 102 },
    card: { x: 613, y: 442, w: 305, h: 254 },
    card2: { x: 292, y: 442, w: 305, h: 254 },
    progress: { x: 633, y: 624, w: 263, h: 50 },
    edit: { x: 840, y: 462, w: 26, h: 26 },
    remove: { x: 870, y: 462, w: 26, h: 26 },
};

export const SHOTS = {
    'fm-index': templates,
    'fm-tpl-empty': tpl,
    'fm-tpl-name': tpl,
    'fm-tpl-client': { ...tpl, option: { x: 660, y: 491, w: 303, h: 36 }, list: { x: 654, y: 377, w: 315, h: 228 } },
    'fm-tpl-start': { ...tpl, calendar: { x: 317, y: 69, w: 278, h: 309 }, day: { x: 365, y: 153, w: 36, h: 36 } },
    'fm-tpl-dates': tpl,
    'fm-tpl-lookup': { ...tpl, popover: { x: 653, y: 410, w: 256, h: 256 }, search: { x: 661, y: 418, w: 240, h: 30 } },
    'fm-tpl-item1': { ...tpl, row1: { x: 293, y: 662, w: 702, h: 45 }, submit: { x: 1036, y: 445, w: 185, h: 36 }, summary: { x: 1020, y: 176, w: 217, h: 330 } },
    'fm-tpl-filled': {
        ...tpl,
        detail: { x: 292, y: 153, w: 703, h: 356 },
        items: { x: 292, y: 533, w: 703, h: 187 },
        rows: { x: 293, y: 639, w: 702, h: 81 },
        addItem: { x: 845, y: 552, w: 125, h: 32 },
        submit: { x: 1036, y: 422, w: 185, h: 36 },
        summary: { x: 1020, y: 153, w: 217, h: 365 },
    },
    'fm-templates': templates,
    'fm-monthly-empty': monthly,
    'fm-generate': {
        dialog: { x: 416, y: 206, w: 448, h: 307 },
        issue: { x: 441, y: 396, w: 191, h: 40 },
        due: { x: 648, y: 396, w: 191, h: 40 },
        confirm: { x: 677, y: 461, w: 162, h: 36 },
    },
    'fm-monthly': monthly,
    'fm-monthly-edit': { dialog: { x: 192, y: 36, w: 896, h: 648 }, dates: { x: 217, y: 143, w: 836, h: 150 }, items: { x: 217, y: 340, w: 836, h: 197 } },
    'fm-publish': {
        dialog: { x: 448, y: 196, w: 384, h: 327 },
        note: { x: 473, y: 324, w: 334, h: 40 },
        issue: { x: 473, y: 406, w: 159, h: 40 },
        due: { x: 648, y: 406, w: 159, h: 40 },
        confirm: { x: 727, y: 471, w: 80, h: 36 },
    },
    'fm-published': { ...monthly, status: { x: 1016, y: 509, w: 77, h: 20 }, link: { x: 698, y: 520, w: 147, h: 16 }, toast: { x: 900, y: 24, w: 356, h: 73 } },
    'fm-bulk': { ...monthly, checkbox: { x: 309, y: 575, w: 16, h: 16 }, bar: { x: 454, y: 638, w: 372, h: 58 } },
    'fm-analytics': { kpi: { x: 292, y: 316, w: 946, h: 102 }, chart: { x: 292, y: 442, w: 946, h: 278 }, controls: { x: 292, y: 248, w: 400, h: 44 } },
    'admin-invoice-drawer': {
        drawer: { x: 360, y: 0, w: 920, h: 720 },
        header: { x: 385, y: 20, w: 240, h: 40 },
        dates: { x: 385, y: 80, w: 360, h: 56 },
        metrics: { x: 385, y: 154, w: 872, h: 104 },
        items: { x: 385, y: 370, w: 580, h: 145 },
        send: { x: 1059, y: 20, w: 149, h: 40 },
        history: { x: 385, y: 619, w: 579, h: 64 },
    },
    'admin-invoices': {
        summary: { x: 293, y: 165, w: 943, h: 210 },
        statusFilter: { x: 315, y: 423, w: 421, h: 40 },
        row: { x: 315, y: 567, w: 909, h: 63 },
    },
    'admin-archive': { dialog: { x: 448, y: 255, w: 384, h: 209 }, text: { x: 537, y: 310, w: 270, h: 60 }, cancel: { x: 654, y: 412, w: 66, h: 36 } },
    'admin-delete-template': { dialog: { x: 448, y: 255, w: 384, h: 209 }, text: { x: 537, y: 310, w: 270, h: 60 }, cancel: { x: 654, y: 412, w: 66, h: 36 } },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-archive': adminArchive,
    'admin-delete-template': adminDeleteTemplate,
    'admin-invoice-drawer': adminInvoiceDrawer,
    'admin-invoices': adminInvoices,
    'fm-analytics': fmAnalytics,
    'fm-bulk': fmBulk,
    'fm-generate': fmGenerate,
    'fm-index': fmIndex,
    'fm-monthly': fmMonthly,
    'fm-monthly-edit': fmMonthlyEdit,
    'fm-monthly-empty': fmMonthlyEmpty,
    'fm-publish': fmPublish,
    'fm-published': fmPublished,
    'fm-templates': fmTemplates,
    'fm-tpl-client': fmTplClient,
    'fm-tpl-dates': fmTplDates,
    'fm-tpl-empty': fmTplEmpty,
    'fm-tpl-filled': fmTplFilled,
    'fm-tpl-item1': fmTplItem1,
    'fm-tpl-lookup': fmTplLookup,
    'fm-tpl-name': fmTplName,
    'fm-tpl-start': fmTplStart,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
