import type { Box } from '../components/walkthrough';
import adminCompany from './screens/admin-company.webp';
import adminCompanyAssets from './screens/admin-company-assets.webp';
import adminCompanyTax from './screens/admin-company-tax.webp';
import adminEditor from './screens/admin-editor.webp';
import adminEditorSaved from './screens/admin-editor-saved.webp';
import adminEditorText from './screens/admin-editor-text.webp';
import adminHub from './screens/admin-hub.webp';
import adminPrint from './screens/admin-print.webp';
import adminTemplateDefault from './screens/admin-template-default.webp';
import adminTemplateDelete from './screens/admin-template-delete.webp';
import adminTemplateMenu from './screens/admin-template-menu.webp';
import adminTemplateNew from './screens/admin-template-new.webp';
import adminTemplatesEmpty from './screens/admin-templates-empty.webp';
import fmHub from './screens/fm-hub.webp';
import fmNumbering from './screens/fm-numbering.webp';
import fmNumberingDigits from './screens/fm-numbering-digits.webp';
import fmNumberingError from './screens/fm-numbering-error.webp';
import fmNumberingSave from './screens/fm-numbering-save.webp';
import fmNumberingValid from './screens/fm-numbering-valid.webp';
import staffDelete from './screens/staff-delete.webp';
import staffHub from './screens/staff-hub.webp';
import staffMenu from './screens/staff-menu.webp';
import staffPassword from './screens/staff-password.webp';
import staffPasswordCurrent from './screens/staff-password-current.webp';
import staffPasswordNew from './screens/staff-password-new.webp';
import staffPasswordSaved from './screens/staff-password-saved.webp';
import staffProfile from './screens/staff-profile.webp';
import staffProfileName from './screens/staff-profile-name.webp';
import staffProfileSaved from './screens/staff-profile-saved.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/settings/screens/*.webp.
 * Dihasilkan oleh video/capture/settings.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 */
const profile = {
    name: { x: 325, y: 247, w: 576, h: 40 },
    email: { x: 325, y: 333, w: 576, h: 40 },
    save: { x: 325, y: 401, w: 157, h: 36 },
    saveRow: { x: 325, y: 401, w: 245, h: 36 },
    danger: { x: 325, y: 516, w: 880, h: 84 },
    deleteBtn: { x: 1084, y: 530, w: 111, h: 36 },
};

const password = {
    current: { x: 325, y: 247, w: 576, h: 40 },
    next: { x: 325, y: 333, w: 576, h: 40 },
    confirm: { x: 325, y: 419, w: 576, h: 40 },
    save: { x: 325, y: 550, w: 161, h: 36 },
    saveRow: { x: 325, y: 550, w: 249, h: 36 },
};

const numbering = {
    pattern: { x: 325, y: 245, w: 500, h: 42 },
    tokens: { x: 325, y: 319, w: 500, h: 115 },
    tokenNo: { x: 325, y: 319, w: 129, h: 33 },
    padding: { x: 325, y: 465, w: 500, h: 76 },
    digits4: { x: 630, y: 489, w: 94, h: 36 },
    reset: { x: 325, y: 575, w: 500, h: 76 },
    yearly: { x: 494, y: 599, w: 161, h: 36 },
    preview: { x: 878, y: 188, w: 360, h: 260 },
    previewNumber: { x: 902, y: 270, w: 310, h: 101 },
    recent: { x: 902, y: 572, w: 310, h: 144 },
};

export const SHOTS = {
    'staff-menu': {
        account: { x: 1075, y: 20, w: 173, h: 44 },
        menu: { x: 1024, y: 70, w: 224, h: 156 },
        settings: { x: 1033, y: 111, w: 206, h: 34 },
    },
    'staff-hub': {
        akun: { x: 410, y: 165, w: 720, h: 178 },
        perusahaan: { x: 410, y: 366, w: 720, h: 103 },
        profile: { x: 411, y: 193, w: 718, h: 74 },
    },
    'staff-profile': profile,
    'staff-profile-name': profile,
    'staff-profile-saved': profile,
    'staff-delete': {
        dialog: { x: 416, y: 195, w: 448, h: 331 },
        password: { x: 441, y: 400, w: 398, h: 40 },
        confirm: { x: 694, y: 473, w: 146, h: 36 },
    },
    'staff-password': password,
    'staff-password-current': password,
    'staff-password-new': password,
    'staff-password-saved': password,
    'fm-hub': {
        invoice: { x: 410, y: 494, w: 720, h: 103 },
        numbering: { x: 411, y: 522, w: 718, h: 74 },
    },
    'fm-numbering': numbering,
    'fm-numbering-digits': numbering,
    'fm-numbering-error': {
        ...numbering,
        patternField: { x: 325, y: 221, w: 500, h: 103 },
        tokenNo: { x: 325, y: 335, w: 129, h: 33 },
        reset: { x: 325, y: 591, w: 500, h: 76 },
        previewNumber: { x: 902, y: 270, w: 310, h: 70 },
    },
    'fm-numbering-valid': {
        ...numbering,
        previewNumber: { x: 902, y: 270, w: 310, h: 70 },
        preview: { x: 878, y: 188, w: 360, h: 250 },
    },
    'fm-numbering-save': {
        note: { x: 325, y: 556, w: 438, h: 39 },
        save: { x: 519, y: 611, w: 91, h: 44 },
        restore: { x: 325, y: 611, w: 186, h: 44 },
        recent: { x: 902, y: 410, w: 310, h: 144 },
    },
    'admin-hub': {
        akun: { x: 410, y: 165, w: 720, h: 178 },
        perusahaan: { x: 410, y: 366, w: 720, h: 103 },
        invoice: { x: 410, y: 494, w: 720, h: 178 },
        company: { x: 411, y: 395, w: 718, h: 74 },
        templates: { x: 411, y: 597, w: 718, h: 74 },
    },
    'admin-company': {
        identity: { x: 325, y: 221, w: 880, h: 343 },
        name: { x: 325, y: 320, w: 880, h: 40 },
    },
    'admin-company-tax': {
        finance: { x: 325, y: 24, w: 880, h: 139 },
        tax: { x: 325, y: 187, w: 880, h: 93 },
        pkp: { x: 325, y: 260, w: 400, h: 20 },
    },
    'admin-company-assets': {
        assets: { x: 325, y: 24, w: 880, h: 578 },
        letterHead: { x: 773, y: 97, w: 432, h: 245 },
        signatureStamp: { x: 325, y: 358, w: 880, h: 245 },
    },
    'admin-templates-empty': {
        create: { x: 1118, y: 112, w: 130, h: 32 },
        list: { x: 292, y: 188, w: 956, h: 406 },
    },
    'admin-template-new': {
        dialog: { x: 416, y: 212, w: 448, h: 295 },
        name: { x: 417, y: 308, w: 446, h: 40 },
        description: { x: 417, y: 390, w: 446, h: 40 },
        submit: { x: 711, y: 455, w: 128, h: 36 },
    },
    'admin-editor': {
        back: { x: 313, y: 92, w: 75, h: 32 },
        canvas: { x: 500, y: 133, w: 443, h: 587 },
        band: { x: 525, y: 173, w: 390, h: 87 },
        tools: { x: 612, y: 677, w: 225, h: 42 },
        text: { x: 620, y: 681, w: 32, h: 32 },
        layers: { x: 293, y: 133, w: 205, h: 147 },
        actions: { x: 860, y: 92, w: 267, h: 32 },
        save: { x: 1138, y: 92, w: 88, h: 32 },
    },
    'admin-editor-text': {
        band: { x: 525, y: 173, w: 390, h: 87 },
        layers: { x: 293, y: 133, w: 205, h: 147 },
        props: { x: 953, y: 133, w: 274, h: 587 },
        content: { x: 963, y: 205, w: 254, h: 125 },
        save: { x: 1138, y: 92, w: 88, h: 32 },
    },
    'admin-editor-saved': {
        toast: { x: 900, y: 24, w: 356, h: 53 },
        save: { x: 1138, y: 92, w: 88, h: 32 },
    },
    'admin-template-menu': {
        row: { x: 526, y: 262, w: 689, h: 60 },
        menu: { x: 1044, y: 315, w: 154, h: 147 },
        setDefault: { x: 1049, y: 351, w: 145, h: 32 },
        duplicate: { x: 1049, y: 383, w: 145, h: 32 },
    },
    'admin-template-default': {
        row: { x: 326, y: 262, w: 889, h: 60 },
        badge: { x: 707, y: 282, w: 79, h: 20 },
    },
    'admin-template-delete': {
        dialog: { x: 448, y: 241, w: 384, h: 237 },
        confirm: { x: 668, y: 426, w: 140, h: 36 },
    },
    'admin-print': {
        dialog: { x: 100, y: 36, w: 1080, h: 648 },
        templates: { x: 125, y: 322, w: 372, h: 282 },
        custom: { x: 125, y: 468, w: 86, h: 136 },
        pdfHeader: { x: 543, y: 107, w: 590, h: 63 },
        pdfBank: { x: 552, y: 358, w: 278, h: 52 },
        pdfTotals: { x: 838, y: 358, w: 292, h: 166 },
        pdfSign: { x: 840, y: 528, w: 293, h: 82 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'staff-menu': staffMenu,
    'staff-hub': staffHub,
    'staff-profile': staffProfile,
    'staff-profile-name': staffProfileName,
    'staff-profile-saved': staffProfileSaved,
    'staff-delete': staffDelete,
    'staff-password': staffPassword,
    'staff-password-current': staffPasswordCurrent,
    'staff-password-new': staffPasswordNew,
    'staff-password-saved': staffPasswordSaved,
    'fm-hub': fmHub,
    'fm-numbering': fmNumbering,
    'fm-numbering-digits': fmNumberingDigits,
    'fm-numbering-error': fmNumberingError,
    'fm-numbering-valid': fmNumberingValid,
    'fm-numbering-save': fmNumberingSave,
    'admin-hub': adminHub,
    'admin-company': adminCompany,
    'admin-company-tax': adminCompanyTax,
    'admin-company-assets': adminCompanyAssets,
    'admin-templates-empty': adminTemplatesEmpty,
    'admin-template-new': adminTemplateNew,
    'admin-editor': adminEditor,
    'admin-editor-text': adminEditorText,
    'admin-editor-saved': adminEditorSaved,
    'admin-template-menu': adminTemplateMenu,
    'admin-template-default': adminTemplateDefault,
    'admin-template-delete': adminTemplateDelete,
    'admin-print': adminPrint,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua field bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
