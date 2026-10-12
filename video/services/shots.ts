import type { Box } from '../components/walkthrough';
import adminDelete from './screens/admin-delete.webp';
import adminInvoice from './screens/admin-invoice.webp';
import adminInvoiceCatalog from './screens/admin-invoice-catalog.webp';
import adminInvoicePicked from './screens/admin-invoice-picked.webp';
import adminList from './screens/admin-list.webp';
import adminTemplateLookup from './screens/admin-template-lookup.webp';
import fmEdit from './screens/fm-edit.webp';
import fmEditOpen from './screens/fm-edit-open.webp';
import fmFormCategory from './screens/fm-form-category.webp';
import fmFormCategorySet from './screens/fm-form-category-set.webp';
import fmFormEmpty from './screens/fm-form-empty.webp';
import fmFormFilled from './screens/fm-form-filled.webp';
import fmFormName from './screens/fm-form-name.webp';
import fmList from './screens/fm-list.webp';
import fmListAdded from './screens/fm-list-added.webp';
import fmListUpdated from './screens/fm-list-updated.webp';
import staffInvoice from './screens/staff-invoice.webp';
import staffInvoiceCatalog from './screens/staff-invoice-catalog.webp';
import staffInvoicePicked from './screens/staff-invoice-picked.webp';
import staffList from './screens/staff-list.webp';
import staffSearch from './screens/staff-search.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/services/screens/*.webp.
 * Dihasilkan oleh video/capture/services.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 * Tinggi tabel dipotong manual ke batas layar (720).
 */
const listPage = {
    create: { x: 1095, y: 104, w: 143, h: 32 },
    stats: { x: 292, y: 180, w: 946, h: 102 },
    search: { x: 292, y: 306, w: 256, h: 40 },
    typeFilter: { x: 560, y: 306, w: 208, h: 40 },
    table: { x: 293, y: 370, w: 944, h: 340 },
    firstRow: { x: 293, y: 411, w: 944, h: 53 },
    edit: { x: 1165, y: 423, w: 28, h: 28 },
    remove: { x: 1197, y: 423, w: 28, h: 28 },
    price: { x: 859, y: 411, w: 147, h: 53 },
};
const form = {
    dialog: { x: 416, y: 145, w: 448, h: 429 },
    name: { x: 441, y: 285, w: 398, h: 40 },
    category: { x: 441, y: 367, w: 398, h: 40 },
    price: { x: 441, y: 449, w: 398, h: 40 },
    cancel: { x: 620, y: 522, w: 66, h: 36 },
    submit: { x: 699, y: 522, w: 140, h: 36 },
};
const invoice = {
    item: { x: 356, y: 492, w: 486, h: 34 },
    pick: { x: 848, y: 492, w: 34, h: 34 },
    items: { x: 292, y: 384, w: 946, h: 277 },
    popover: { x: 594, y: 530, w: 288, h: 100 },
    option: { x: 601, y: 588, w: 274, h: 36 },
    price: { x: 987, y: 492, w: 100, h: 34 },
    row: { x: 328, y: 492, w: 874, h: 34 },
};

export const SHOTS = {
    'staff-list': listPage,
    'staff-search': { search: listPage.search, table: { x: 293, y: 370, w: 944, h: 146 }, count: { x: 780, y: 324, w: 63, h: 22 } },
    'staff-invoice': invoice,
    'staff-invoice-catalog': invoice,
    'staff-invoice-picked': invoice,
    'fm-list': listPage,
    'fm-form-empty': form,
    'fm-form-name': form,
    'fm-form-category': { ...form, option: { x: 447, y: 491, w: 385, h: 36 }, list: { x: 441, y: 449, w: 397, h: 156 } },
    'fm-form-category-set': form,
    'fm-form-filled': form,
    'fm-list-added': { ...listPage, actions: { x: 1139, y: 423, w: 85, h: 28 }, toast: { x: 900, y: 24, w: 356, h: 53 } },
    'fm-edit-open': { ...form, cancel: { x: 615, y: 522, w: 66, h: 36 }, submit: { x: 693, y: 522, w: 146, h: 36 } },
    'fm-edit': { ...form, cancel: { x: 615, y: 522, w: 66, h: 36 }, submit: { x: 693, y: 522, w: 146, h: 36 } },
    'fm-list-updated': listPage,
    'admin-list': listPage,
    'admin-delete': { dialog: { x: 448, y: 265, w: 384, h: 189 }, confirm: { x: 674, y: 402, w: 133, h: 36 }, cancel: { x: 596, y: 402, w: 66, h: 36 } },
    'admin-invoice': invoice,
    'admin-invoice-catalog': invoice,
    'admin-invoice-picked': invoice,
    'admin-template-lookup': {
        lookup: { x: 653, y: 670, w: 28, h: 28 },
        popover: { x: 653, y: 410, w: 256, h: 256 },
        items: { x: 292, y: 556, w: 703, h: 164 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-delete': adminDelete,
    'admin-invoice': adminInvoice,
    'admin-invoice-catalog': adminInvoiceCatalog,
    'admin-invoice-picked': adminInvoicePicked,
    'admin-list': adminList,
    'admin-template-lookup': adminTemplateLookup,
    'fm-edit': fmEdit,
    'fm-edit-open': fmEditOpen,
    'fm-form-category': fmFormCategory,
    'fm-form-category-set': fmFormCategorySet,
    'fm-form-empty': fmFormEmpty,
    'fm-form-filled': fmFormFilled,
    'fm-form-name': fmFormName,
    'fm-list': fmList,
    'fm-list-added': fmListAdded,
    'fm-list-updated': fmListUpdated,
    'staff-invoice': staffInvoice,
    'staff-invoice-catalog': staffInvoiceCatalog,
    'staff-invoice-picked': staffInvoicePicked,
    'staff-list': staffList,
    'staff-search': staffSearch,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
