import type { Box } from '../components/walkthrough';
import adminDelete from './screens/admin-delete.webp';
import adminIncome from './screens/admin-income.webp';
import adminInvoices from './screens/admin-invoices.webp';
import adminList from './screens/admin-list.webp';
import staffEdit from './screens/staff-edit.webp';
import staffFormContact from './screens/staff-form-contact.webp';
import staffFormEmpty from './screens/staff-form-empty.webp';
import staffFormFilled from './screens/staff-form-filled.webp';
import staffFormName from './screens/staff-form-name.webp';
import staffFormSave from './screens/staff-form-save.webp';
import staffFormTax from './screens/staff-form-tax.webp';
import staffFormType from './screens/staff-form-type.webp';
import staffList from './screens/staff-list.webp';
import staffListCreated from './screens/staff-list-created.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/clients/screens/*.webp.
 * Dari video/capture/clients.js; kotak bertanda "manual" diukur dari gambarnya.
 */
const form = {
    dialog: { x: 256, y: 36, w: 768, h: 648 },
    name: { x: 281, y: 232, w: 342, h: 40 },
    type: { x: 281, y: 314, w: 342, h: 36 },
    company: { x: 458, y: 314, w: 165, h: 36 }, // manual: tombol Perusahaan
    status: { x: 281, y: 392, w: 342, h: 36 },
    inactive: { x: 458, y: 392, w: 165, h: 36 }, // manual: tombol Tidak Aktif
    email: { x: 281, y: 470, w: 342, h: 40 },
    address: { x: 281, y: 552, w: 342, h: 40 },
    npwp: { x: 647, y: 232, w: 342, h: 40 },
    kpp: { x: 647, y: 314, w: 342, h: 40 },
    efin: { x: 647, y: 396, w: 342, h: 40 },
    pic: { x: 647, y: 478, w: 342, h: 40 },
    ar: { x: 647, y: 560, w: 342, h: 40 },
    arPhone: { x: 647, y: 642, w: 342, h: 40 },
};
const firstRow = {
    row: { x: 293, y: 447, w: 944, h: 73 },
    invoiceCell: { x: 896, y: 447, w: 70, h: 73 },
    finance: { x: 966, y: 447, w: 181, h: 73 },
    edit: { x: 1175, y: 469, w: 28, h: 28 },
    remove: { x: 1207, y: 469, w: 28, h: 28 },
};

export const SHOTS = {
    'staff-list': {
        ...firstRow,
        create: { x: 1114, y: 104, w: 123, h: 32 },
        stats: { x: 292, y: 180, w: 946, h: 102 },
        filters: { x: 292, y: 306, w: 946, h: 40 },
    },
    'staff-form-empty': form,
    'staff-form-name': form,
    'staff-form-type': form,
    'staff-form-contact': form,
    'staff-form-tax': form,
    'staff-form-filled': form,
    'staff-form-save': {
        arPhone: { x: 647, y: 558, w: 342, h: 40 },
        save: { x: 871, y: 631, w: 118, h: 36 },
        cancel: { x: 793, y: 631, w: 66, h: 36 },
    },
    'staff-list-created': {
        ...firstRow,
        row: { x: 293, y: 447, w: 954, h: 72 },
        search: { x: 292, y: 306, w: 311, h: 40 },
        status: { x: 844, y: 473, w: 48, h: 20 },
    },
    'staff-edit': form,
    'admin-list': { ...firstRow, remove: { x: 1197, y: 469, w: 28, h: 28 }, edit: { x: 1165, y: 469, w: 28, h: 28 } },
    'admin-delete': {
        dialog: { x: 448, y: 255, w: 384, h: 209 },
        confirm: { x: 697, y: 412, w: 110, h: 36 },
        cancel: { x: 619, y: 412, w: 66, h: 36 },
    },
    'admin-invoices': {
        summary: { x: 292, y: 164, w: 946, h: 196 },
        clientFilter: { x: 544, y: 458, w: 180, h: 40 }, // manual
        rows: { x: 292, y: 540, w: 946, h: 180 }, // manual
    },
    'admin-income': {
        total: { x: 293, y: 185, w: 303, h: 120 },
        clientFilter: { x: 532, y: 356, w: 228, h: 40 }, // manual
        table: { x: 293, y: 468, w: 944, h: 226 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-delete': adminDelete,
    'admin-income': adminIncome,
    'admin-invoices': adminInvoices,
    'admin-list': adminList,
    'staff-edit': staffEdit,
    'staff-form-contact': staffFormContact,
    'staff-form-empty': staffFormEmpty,
    'staff-form-filled': staffFormFilled,
    'staff-form-name': staffFormName,
    'staff-form-save': staffFormSave,
    'staff-form-tax': staffFormTax,
    'staff-form-type': staffFormType,
    'staff-list': staffList,
    'staff-list-created': staffListCreated,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
