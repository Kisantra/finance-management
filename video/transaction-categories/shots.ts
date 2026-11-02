import type { Box } from '../components/walkthrough';
import adminBreakdown from './screens/admin-breakdown.webp';
import adminExpenseMoved from './screens/admin-expense-moved.webp';
import adminPicker from './screens/admin-picker.webp';
import adminPl from './screens/admin-pl.webp';
import fmCreated from './screens/fm-created.webp';
import fmDeleteSimple from './screens/fm-delete-simple.webp';
import fmEdit from './screens/fm-edit.webp';
import fmEditFilled from './screens/fm-edit-filled.webp';
import fmEditSaved from './screens/fm-edit-saved.webp';
import fmFormEmpty from './screens/fm-form-empty.webp';
import fmFormFilled from './screens/fm-form-filled.webp';
import fmFormName from './screens/fm-form-name.webp';
import fmFormPlgroup from './screens/fm-form-plgroup.webp';
import fmFormType from './screens/fm-form-type.webp';
import fmList from './screens/fm-list.webp';
import fmParentLocked from './screens/fm-parent-locked.webp';
import fmReassign from './screens/fm-reassign.webp';
import fmReassignFilled from './screens/fm-reassign-filled.webp';
import fmReassignOptions from './screens/fm-reassign-options.webp';
import fmReassigned from './screens/fm-reassigned.webp';
import fmUnclassified from './screens/fm-unclassified.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/transaction-categories/screens/*.webp.
 * Dihasilkan oleh video/capture/transaction-categories.js; kotak daftar pilihan & tooltip disesuaikan manual.
 */
const list = {
    create: { x: 1093, y: 104, w: 145, h: 32 },
    tutorial: { x: 970, y: 98, w: 115, h: 44 },
    stats: { x: 292, y: 180, w: 946, h: 102 },
    unclassifiedStat: { x: 1013, y: 180, w: 224, h: 102 },
    filters: { x: 292, y: 306, w: 626, h: 40 },
    unclassified: { x: 764, y: 314, w: 154, h: 32 },
    table: { x: 293, y: 370, w: 944, h: 350 },
    firstRow: { x: 293, y: 411, w: 944, h: 53 },
    actionsCol: { x: 1165, y: 370, w: 72, h: 350 },
};
/** Halaman dengan hasil pencarian (lebar konten sedikit berbeda karena tanpa scrollbar). */
const results = {
    create: { x: 1103, y: 104, w: 145, h: 32 },
    search: { x: 292, y: 306, w: 256, h: 40 },
    unclassified: { x: 764, y: 314, w: 153, h: 32 },
    unclassifiedStat: { x: 1021, y: 180, w: 227, h: 102 },
    row1: { x: 293, y: 411, w: 954, h: 53 },
    row2: { x: 293, y: 464, w: 954, h: 52 },
};
const form = {
    dialog: { x: 416, y: 62, w: 448, h: 595 },
    type: { x: 441, y: 202, w: 398, h: 124 },
    expense: { x: 644, y: 202, w: 195, h: 36 },
    name: { x: 441, y: 368, w: 398, h: 40 },
    plGroup: { x: 441, y: 450, w: 398, h: 40 },
    parent: { x: 441, y: 532, w: 398, h: 40 },
    submit: { x: 697, y: 605, w: 143, h: 36 },
};
const reassign = {
    dialog: { x: 416, y: 165, w: 448, h: 391 },
    warning: { x: 441, y: 250, w: 398, h: 134 },
    target: { x: 441, y: 426, w: 398, h: 40 },
    confirm: { x: 683, y: 507, w: 156, h: 32 },
};

export const SHOTS = {
    'fm-list': list,
    'fm-unclassified': {
        ...results,
        software: { x: 293, y: 411, w: 954, h: 53 },
        old: { x: 293, y: 464, w: 954, h: 52 },
        groupCol: { x: 841, y: 370, w: 177, h: 146 },
        usageCol: { x: 1005, y: 411, w: 120, h: 105 },
    },
    'fm-form-empty': {
        dialog: { x: 416, y: 144, w: 448, h: 431 },
        type: { x: 441, y: 284, w: 398, h: 124 },
        expense: { x: 644, y: 284, w: 195, h: 36 },
        name: { x: 441, y: 450, w: 398, h: 40 },
        submit: { x: 697, y: 523, w: 143, h: 36 },
    },
    'fm-form-type': form,
    'fm-form-name': form,
    'fm-form-plgroup': {
        ...form,
        listbox: { x: 441, y: 494, w: 397, h: 194 },
        option: { x: 447, y: 574, w: 385, h: 36 },
    },
    'fm-form-filled': form,
    'fm-created': {
        ...results,
        created: { x: 293, y: 411, w: 954, h: 52 },
        group: { x: 817, y: 411, w: 185, h: 52 },
        parentCell: { x: 614, y: 411, w: 203, h: 52 },
    },
    'fm-delete-simple': {
        dialog: { x: 448, y: 275, w: 384, h: 169 },
        confirm: { x: 732, y: 392, w: 75, h: 36 },
    },
    'fm-edit': { ...form, submit: { x: 691, y: 605, w: 148, h: 36 } },
    'fm-edit-filled': { ...form, submit: { x: 691, y: 605, w: 148, h: 36 } },
    'fm-edit-saved': {
        ...results,
        software: { x: 293, y: 411, w: 954, h: 53 },
        group: { x: 841, y: 411, w: 177, h: 53 },
    },
    'fm-reassign': reassign,
    'fm-reassign-options': {
        ...reassign,
        listbox: { x: 441, y: 144, w: 398, h: 278 },
        parents: { x: 447, y: 258, w: 380, h: 106 },
    },
    'fm-reassign-filled': reassign,
    'fm-reassigned': {
        ...results,
        software: { x: 293, y: 411, w: 954, h: 52 },
        usage: { x: 1024, y: 427, w: 93, h: 20 },
    },
    'fm-parent-locked': {
        row: { x: 293, y: 411, w: 954, h: 52 },
        lock: { x: 1207, y: 423, w: 28, h: 28 },
        tooltip: { x: 956, y: 388, w: 320, h: 66 },
    },
    'admin-pl': {
        opex: { x: 356, y: 356, w: 434, h: 212 },
        line: { x: 356, y: 388, w: 434, h: 29 },
        unclassified: { x: 879, y: 80, w: 358, h: 640 },
    },
    'admin-expense-moved': {
        row: { x: 293, y: 513, w: 945, h: 56 },
        category: { x: 747, y: 531, w: 140, h: 20 },
    },
    'admin-breakdown': {
        breakdown: { x: 966, y: 70, w: 272, h: 360 },
        legend: { x: 990, y: 314, w: 236, h: 30 },
    },
    'admin-picker': {
        trigger: { x: 281, y: 337, w: 347, h: 40 },
        listbox: { x: 281, y: 418, w: 346, h: 240 },
        group: { x: 287, y: 428, w: 323, h: 20 },
        option: { x: 287, y: 520, w: 323, h: 36 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-breakdown': adminBreakdown,
    'admin-expense-moved': adminExpenseMoved,
    'admin-picker': adminPicker,
    'admin-pl': adminPl,
    'fm-created': fmCreated,
    'fm-delete-simple': fmDeleteSimple,
    'fm-edit': fmEdit,
    'fm-edit-filled': fmEditFilled,
    'fm-edit-saved': fmEditSaved,
    'fm-form-empty': fmFormEmpty,
    'fm-form-filled': fmFormFilled,
    'fm-form-name': fmFormName,
    'fm-form-plgroup': fmFormPlgroup,
    'fm-form-type': fmFormType,
    'fm-list': fmList,
    'fm-parent-locked': fmParentLocked,
    'fm-reassign': fmReassign,
    'fm-reassign-filled': fmReassignFilled,
    'fm-reassign-options': fmReassignOptions,
    'fm-reassigned': fmReassigned,
    'fm-unclassified': fmUnclassified,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua field bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
