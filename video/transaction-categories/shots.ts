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
import fmTemplate from './screens/fm-template.webp';
import fmTemplateDone from './screens/fm-template-done.webp';
import fmTemplateExisting from './screens/fm-template-existing.webp';
import fmTemplateFinancing from './screens/fm-template-financing.webp';
import fmTemplateSkipped from './screens/fm-template-skipped.webp';
import fmUnclassified from './screens/fm-unclassified.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/transaction-categories/screens/*.webp.
 * Dihasilkan oleh video/capture/transaction-categories.js (data contoh DB QC, 9 Nov 2026; fm-list & fm-template* diambil
 * ulang sore harinya untuk bagian Pendanaan); kotak daftar pilihan,
 * tooltip, panel Perlu Diklasifikasi, dan kartu Breakdown disesuaikan manual.
 */
const list = {
    create: { x: 1069, y: 86, w: 170, h: 40 },
    template: { x: 902, y: 86, w: 159, h: 40 },
    tutorial: { x: 779, y: 84, w: 116, h: 44 },
    stats: { x: 292, y: 164, w: 947, h: 98 },
    unclassifiedStat: { x: 1014, y: 164, w: 225, h: 98 },
    filters: { x: 292, y: 286, w: 627, h: 42 },
    unclassified: { x: 764, y: 296, w: 155, h: 32 },
    table: { x: 293, y: 353, w: 945, h: 367 },
    firstRow: { x: 293, y: 394, w: 945, h: 65 },
    actionsCol: { x: 1160, y: 353, w: 78, h: 367 },
};
/** Halaman dengan hasil pencarian (lebar konten sedikit berbeda karena tanpa scrollbar). */
const results = {
    create: { x: 1079, y: 86, w: 170, h: 40 },
    template: { x: 912, y: 86, w: 159, h: 40 },
    search: { x: 292, y: 286, w: 256, h: 42 },
    unclassified: { x: 764, y: 296, w: 154, h: 32 },
    unclassifiedStat: { x: 1022, y: 164, w: 227, h: 98 },
    row1: { x: 293, y: 394, w: 955, h: 57 },
    row2: { x: 293, y: 451, w: 955, h: 56 },
};
const form = {
    dialog: { x: 416, y: 50, w: 448, h: 620 },
    type: { x: 441, y: 198, w: 398, h: 124 },
    expense: { x: 644, y: 198, w: 195, h: 36 },
    name: { x: 441, y: 363, w: 398, h: 42 },
    plGroup: { x: 441, y: 447, w: 398, h: 42 },
    parent: { x: 441, y: 530, w: 398, h: 42 },
    submit: { x: 696, y: 605, w: 144, h: 40 },
};
const reassign = {
    dialog: { x: 416, y: 156, w: 448, h: 409 },
    warning: { x: 441, y: 250, w: 398, h: 134 },
    target: { x: 441, y: 425, w: 398, h: 42 },
    confirm: { x: 683, y: 508, w: 157, h: 32 },
};
/** Dialog Pakai Template (perusahaan contoh "lama"). */
const template = {
    dialog: { x: 304, y: 36, w: 672, h: 648 },
    list: { x: 305, y: 203, w: 670, h: 399 },
    create: { x: 809, y: 619, w: 142, h: 40 },
    cancel: { x: 732, y: 619, w: 69, h: 40 },
};

export const SHOTS = {
    'fm-list': {
        ...list,
        create: { x: 1078, y: 86, w: 170, h: 40 },
        template: { x: 911, y: 86, w: 159, h: 40 },
        tutorial: { x: 787, y: 84, w: 116, h: 44 },
        stats: { x: 292, y: 164, w: 956, h: 98 },
        unclassifiedStat: { x: 1021, y: 164, w: 227, h: 98 },
        search: { x: 292, y: 287, w: 256, h: 42 },
        type: { x: 560, y: 287, w: 192, h: 42 },
        unclassified: { x: 764, y: 297, w: 156, h: 32 },
        table: { x: 293, y: 354, w: 954, h: 366 },
        head: { x: 293, y: 354, w: 954, h: 40 },
        firstRow: { x: 293, y: 394, w: 954, h: 57 },
    },
    'fm-unclassified': {
        ...results,
        software: { x: 293, y: 394, w: 955, h: 57 },
        old: { x: 293, y: 451, w: 955, h: 56 },
        groupCol: { x: 909, y: 353, w: 90, h: 154 },
        usageCol: { x: 1000, y: 394, w: 120, h: 113 },
    },
    'fm-form-empty': {
        dialog: { x: 416, y: 134, w: 448, h: 453 },
        type: { x: 441, y: 281, w: 398, h: 124 },
        expense: { x: 644, y: 281, w: 195, h: 36 },
        name: { x: 441, y: 447, w: 398, h: 42 },
        submit: { x: 696, y: 522, w: 144, h: 40 },
    },
    'fm-form-type': form,
    'fm-form-name': form,
    'fm-form-plgroup': {
        ...form,
        listbox: { x: 442, y: 530, w: 396, h: 160 },
        option: { x: 450, y: 574, w: 380, h: 36 },
    },
    'fm-form-filled': form,
    'fm-created': {
        ...results,
        created: { x: 293, y: 394, w: 955, h: 56 },
        group: { x: 798, y: 394, w: 189, h: 56 },
        parentCell: { x: 622, y: 394, w: 176, h: 56 },
    },
    'fm-delete-simple': {
        dialog: { x: 448, y: 276, w: 384, h: 168 },
        confirm: { x: 732, y: 379, w: 75, h: 40 },
    },
    'fm-edit': { ...form, submit: { x: 690, y: 605, w: 149, h: 40 } },
    'fm-edit-filled': { ...form, submit: { x: 690, y: 605, w: 149, h: 40 } },
    'fm-edit-saved': {
        ...results,
        software: { x: 293, y: 451, w: 955, h: 57 },
        group: { x: 872, y: 451, w: 158, h: 57 },
    },
    'fm-reassign': reassign,
    'fm-reassign-options': {
        ...reassign,
        listbox: { x: 442, y: 180, w: 396, h: 240 },
        entries: { x: 450, y: 186, w: 371, h: 216 },
    },
    'fm-reassign-filled': reassign,
    'fm-reassigned': {
        ...results,
        software: { x: 293, y: 451, w: 955, h: 56 },
        usage: { x: 1042, y: 469, w: 93, h: 20 },
    },
    'fm-parent-locked': {
        row: { x: 293, y: 394, w: 955, h: 56 },
        lock: { x: 1204, y: 406, w: 32, h: 32 },
        tooltip: { x: 963, y: 375, w: 317, h: 28 },
    },
    'fm-template': {
        ...template,
        intro: { x: 329, y: 223, w: 622, h: 187 },
        summary: { x: 329, y: 430, w: 622, h: 86 },
    },
    'fm-template-existing': {
        ...template,
        group: { x: 329, y: 202, w: 622, h: 311 },
        note: { x: 362, y: 411, w: 320, h: 20 },
    },
    'fm-template-skipped': {
        ...template,
        group: { x: 329, y: 202, w: 622, h: 340 },
        reason: { x: 346, y: 239, w: 323, h: 54 },
    },
    'fm-template-financing': {
        ...template,
        heading: { x: 346, y: 244, w: 336, h: 20 },
        group: { x: 329, y: 272, w: 622, h: 83 },
        newGroup: { x: 329, y: 462, w: 622, h: 120 },
    },
    'fm-template-done': {
        template: { x: 911, y: 86, w: 159, h: 40 },
        toast: { x: 900, y: 24, w: 356, h: 92 },
        stats: { x: 292, y: 164, w: 956, h: 98 },
    },
    'admin-pl': {
        opex: { x: 356, y: 268, w: 435, h: 212 },
        line: { x: 356, y: 388, w: 435, h: 29 },
        unclassified: { x: 880, y: 109, w: 359, h: 259 },
    },
    'admin-expense-moved': {
        row: { x: 315, y: 548, w: 911, h: 72 },
        category: { x: 713, y: 567, w: 104, h: 36 },
    },
    'admin-breakdown': {
        breakdown: { x: 967, y: 83, w: 272, h: 347 },
        legend: { x: 985, y: 318, w: 240, h: 22 },
    },
    'admin-picker': {
        trigger: { x: 281, y: 340, w: 342, h: 42 },
        listbox: { x: 282, y: 424, w: 341, h: 240 },
        group: { x: 290, y: 427, w: 315, h: 32 },
        option: { x: 290, y: 460, w: 315, h: 36 },
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
    'fm-template': fmTemplate,
    'fm-template-done': fmTemplateDone,
    'fm-template-existing': fmTemplateExisting,
    'fm-template-financing': fmTemplateFinancing,
    'fm-template-skipped': fmTemplateSkipped,
    'fm-unclassified': fmUnclassified,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua field bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
