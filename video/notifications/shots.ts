import type { Box } from '../components/walkthrough';
import adminDrawer from './screens/admin-drawer.webp';
import adminHeader from './screens/admin-header.webp';
import adminPopover from './screens/admin-popover.webp';
import adminReadAll from './screens/admin-read-all.webp';
import fmAfterClick from './screens/fm-after-click.webp';
import fmPopover from './screens/fm-popover.webp';
import staffAfterClick from './screens/staff-after-click.webp';
import staffDrawer from './screens/staff-drawer.webp';
import staffDrawerRead from './screens/staff-drawer-read.webp';
import staffHeader from './screens/staff-header.webp';
import staffPopover from './screens/staff-popover.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/notifications/screens/*.webp.
 * Dihasilkan oleh video/capture/notifications.js. Lonceng bergeser sesuai lebar nama pengguna di header.
 */
const pop = (dx: number) => ({
    popover: { x: 746 + dx, y: 66, w: 352, h: 300 },
    header: { x: 747 + dx, y: 67, w: 350, h: 61 },
    markAll: { x: 988 + dx, y: 89, w: 94, h: 16 },
    first: { x: 747 + dx, y: 128, w: 350, h: 96 },
    second: { x: 747 + dx, y: 225, w: 350, h: 96 },
    seeAll: { x: 763 + dx, y: 332, w: 318, h: 24 },
});
const drawer = {
    drawer: { x: 832, y: 0, w: 448, h: 720 },
    header: { x: 857, y: 16, w: 399, h: 42 },
    summary: { x: 909, y: 42, w: 153, h: 16 },
    markAll: { x: 1129, y: 21, w: 127, h: 32 },
    first: { x: 833, y: 75, w: 447, h: 110 },
    second: { x: 833, y: 186, w: 447, h: 110 },
    list: { x: 833, y: 75, w: 447, h: 221 },
};
const staffBell = { x: 1066, y: 26, w: 32, h: 32 };
const fmBell = { x: 1015, y: 26, w: 32, h: 32 };
const adminBell = { x: 1070, y: 26, w: 32, h: 32 };

export const SHOTS = {
    'staff-header': { bell: staffBell, header: { x: 260, y: 0, w: 1020, h: 84 } },
    'staff-popover': { bell: staffBell, ...pop(0) },
    'staff-after-click': { bell: staffBell, heading: { x: 292, y: 84, w: 616, h: 40 } },
    'staff-drawer': drawer,
    'staff-drawer-read': drawer,
    'fm-popover': { bell: fmBell, ...pop(-51) },
    'fm-after-click': { bell: fmBell, heading: { x: 292, y: 84, w: 616, h: 40 } },
    'admin-header': { bell: adminBell },
    'admin-popover': { bell: adminBell, ...pop(4) },
    'admin-read-all': {
        bell: adminBell,
        popover: { x: 750, y: 66, w: 352, h: 284 },
        first: { x: 751, y: 112, w: 350, h: 96 },
        seeAll: { x: 767, y: 316, w: 318, h: 24 },
    },
    'admin-drawer': drawer,
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

export const SCREENS: Record<ShotName, string> = {
    'admin-drawer': adminDrawer,
    'admin-header': adminHeader,
    'admin-popover': adminPopover,
    'admin-read-all': adminReadAll,
    'fm-after-click': fmAfterClick,
    'fm-popover': fmPopover,
    'staff-after-click': staffAfterClick,
    'staff-drawer': staffDrawer,
    'staff-drawer-read': staffDrawerRead,
    'staff-header': staffHeader,
    'staff-popover': staffPopover,
};
