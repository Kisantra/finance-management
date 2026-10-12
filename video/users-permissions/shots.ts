import type { Box } from '../components/walkthrough';
import adminDashboard from './screens/admin-dashboard.webp';
import adminDelete from './screens/admin-delete.webp';
import adminEdit from './screens/admin-edit.webp';
import adminFormContact from './screens/admin-form-contact.webp';
import adminFormEmpty from './screens/admin-form-empty.webp';
import adminFormFilled from './screens/admin-form-filled.webp';
import adminFormName from './screens/admin-form-name.webp';
import adminFormRole from './screens/admin-form-role.webp';
import adminPerm from './screens/admin-perm.webp';
import adminPermAuditor from './screens/admin-perm-auditor.webp';
import adminPermModule from './screens/admin-perm-module.webp';
import adminPermSearch from './screens/admin-perm-search.webp';
import adminPermToggled from './screens/admin-perm-toggled.webp';
import adminRoleDelete from './screens/admin-role-delete.webp';
import adminRoleIcon from './screens/admin-role-icon.webp';
import adminRoleName from './screens/admin-role-name.webp';
import adminUsers from './screens/admin-users.webp';
import adminUsersCreated from './screens/admin-users-created.webp';
import fmPerm from './screens/fm-perm.webp';
import newUserDashboard from './screens/new-user-dashboard.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/users-permissions/screens/*.webp.
 * Dihasilkan oleh video/capture/users-permissions.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 */
const userForm = {
    dialog: { x: 304, y: 77, w: 672, h: 567 },
    name: { x: 329, y: 273, w: 299, h: 40 },
    email: { x: 329, y: 355, w: 299, h: 40 },
    phone: { x: 329, y: 437, w: 299, h: 40 },
    status: { x: 329, y: 519, w: 299, h: 36 },
    role: { x: 652, y: 273, w: 299, h: 40 },
    password: { x: 652, y: 355, w: 299, h: 40 },
    confirm: { x: 652, y: 437, w: 299, h: 40 },
    note: { x: 652, y: 494, w: 299, h: 63 },
    submit: { x: 796, y: 590, w: 155, h: 36 },
};

const permPage = {
    create: { x: 1088, y: 102, w: 150, h: 36 },
    stats: { x: 292, y: 180, w: 946, h: 102 },
    roles: { x: 292, y: 306, w: 218, h: 303 },
    adminRole: { x: 301, y: 359, w: 201, h: 78 },
    fmRole: { x: 301, y: 441, w: 201, h: 78 },
    staffRole: { x: 301, y: 522, w: 201, h: 78 },
    header: { x: 555, y: 322, w: 662, h: 80 },
    search: { x: 783, y: 322, w: 224, h: 40 },
    bulk: { x: 783, y: 326, w: 359, h: 76 },
    firstGroup: { x: 535, y: 419, w: 702, h: 57 },
    moduleButtons: { x: 1048, y: 431, w: 169, h: 32 },
    firstPerm: { x: 551, y: 492, w: 217, h: 42 },
    groupPerms: { x: 545, y: 484, w: 682, h: 108 },
    deleteBadge: { x: 752, y: 484, w: 24, h: 24 },
};

const auditorSearch = {
    search: { x: 779, y: 322, w: 224, h: 40 },
    auditorRole: { x: 301, y: 441, w: 201, h: 66 },
    header: { x: 555, y: 322, w: 662, h: 80 },
    invHeader: { x: 535, y: 419, w: 702, h: 57 },
    invAll: { x: 1048, y: 431, w: 86, h: 32 },
    invButtons: { x: 1048, y: 431, w: 169, h: 32 },
    invPerms: { x: 535, y: 476, w: 702, h: 125 },
    viewInvoices: { x: 551, y: 544, w: 217, h: 42 },
    toast: { x: 900, y: 24, w: 356, h: 53 },
};

export const SHOTS = {
    'admin-users': {
        create: { x: 1058, y: 102, w: 179, h: 36 },
        stats: { x: 292, y: 180, w: 946, h: 102 },
        filters: { x: 292, y: 306, w: 946, h: 122 },
        table: { x: 293, y: 452, w: 944, h: 268 },
        yogaRow: { x: 293, y: 497, w: 944, h: 65 },
        actions: { x: 1149, y: 511, w: 76, h: 36 },
        dimasStatus: { x: 912, y: 576, w: 80, h: 36 },
    },
    'admin-form-empty': userForm,
    'admin-form-name': userForm,
    'admin-form-contact': userForm,
    'admin-form-role': { ...userForm, option: { x: 659, y: 433, w: 286, h: 36 }, list: { x: 653, y: 317, w: 298, h: 158 } },
    'admin-form-filled': userForm,
    'admin-users-created': {
        toast: { x: 900, y: 24, w: 356, h: 53 },
        stats: { x: 292, y: 180, w: 946, h: 102 },
        budiRow: { x: 293, y: 497, w: 944, h: 65 },
    },
    'admin-edit': {
        dialog: { x: 304, y: 77, w: 672, h: 567 },
        status: { x: 329, y: 519, w: 299, h: 36 },
        role: { x: 652, y: 273, w: 299, h: 40 },
        password: { x: 652, y: 355, w: 299, h: 40 },
        passwordSection: { x: 652, y: 174, w: 299, h: 383 },
        submit: { x: 794, y: 590, w: 157, h: 36 },
    },
    'admin-delete': {
        dialog: { x: 448, y: 255, w: 384, h: 209 },
        confirm: { x: 732, y: 412, w: 75, h: 36 },
    },
    'admin-perm': permPage,
    'admin-role-name': {
        dialog: { x: 384, y: 77, w: 512, h: 567 },
        name: { x: 409, y: 200, w: 462, h: 40 },
        icons: { x: 409, y: 308, w: 462, h: 250 },
        icon: { x: 669, y: 461, w: 40, h: 40 },
        submit: { x: 746, y: 591, w: 126, h: 36 },
    },
    'admin-role-icon': {
        dialog: { x: 384, y: 77, w: 512, h: 567 },
        icons: { x: 409, y: 308, w: 462, h: 250 },
        icon: { x: 668, y: 460, w: 42, h: 42 },
        submit: { x: 746, y: 591, w: 126, h: 36 },
    },
    'admin-perm-auditor': {
        ...permPage,
        roles: { x: 292, y: 306, w: 218, h: 373 },
        auditorRole: { x: 301, y: 441, w: 201, h: 66 },
        header: { x: 555, y: 322, w: 662, h: 80 },
        search: { x: 779, y: 322, w: 224, h: 40 },
    },
    'admin-perm-search': auditorSearch,
    'admin-perm-toggled': auditorSearch,
    'admin-perm-module': auditorSearch,
    'admin-role-delete': {
        dialog: { x: 448, y: 265, w: 384, h: 189 },
        confirm: { x: 691, y: 402, w: 116, h: 36 },
    },
    'fm-perm': {
        header: { x: 555, y: 322, w: 662, h: 48 },
        roles: { x: 292, y: 306, w: 218, h: 303 },
        firstGroup: { x: 535, y: 387, w: 702, h: 45 },
        groupPerms: { x: 545, y: 440, w: 682, h: 108 },
        firstPerm: { x: 551, y: 448, w: 217, h: 42 },
        nav: { x: 0, y: 440, w: 259, h: 106 },
    },
    'new-user-dashboard': {
        nav: { x: 0, y: 82, w: 259, h: 380 },
        account: { x: 1075, y: 20, w: 173, h: 44 },
    },
    'admin-dashboard': {
        nav: { x: 0, y: 82, w: 259, h: 324 },
        account: { x: 1118, y: 20, w: 130, h: 44 },
    },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'admin-users': adminUsers,
    'admin-form-empty': adminFormEmpty,
    'admin-form-name': adminFormName,
    'admin-form-contact': adminFormContact,
    'admin-form-role': adminFormRole,
    'admin-form-filled': adminFormFilled,
    'admin-users-created': adminUsersCreated,
    'admin-edit': adminEdit,
    'admin-delete': adminDelete,
    'admin-perm': adminPerm,
    'admin-role-name': adminRoleName,
    'admin-role-icon': adminRoleIcon,
    'admin-perm-auditor': adminPermAuditor,
    'admin-perm-search': adminPermSearch,
    'admin-perm-toggled': adminPermToggled,
    'admin-perm-module': adminPermModule,
    'admin-role-delete': adminRoleDelete,
    'fm-perm': fmPerm,
    'new-user-dashboard': newUserDashboard,
    'admin-dashboard': adminDashboard,
};

/** Kotak yang melingkupi beberapa kotak (mis. dua field bersebelahan). */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
