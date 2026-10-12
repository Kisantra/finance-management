import type { Box } from '../components/walkthrough';
import adminBell from './screens/admin-bell.webp';
import adminList from './screens/admin-list.webp';
import fmList from './screens/fm-list.webp';
import fmListAfter from './screens/fm-list-after.webp';
import fmRespondEmpty from './screens/fm-respond-empty.webp';
import fmRespondStatus from './screens/fm-respond-status.webp';
import fmRespondText from './screens/fm-respond-text.webp';
import fmShow from './screens/fm-show.webp';
import fmShowResponded from './screens/fm-show-responded.webp';
import fmStatusMenu from './screens/fm-status-menu.webp';
import staffFloatEmpty from './screens/staff-float-empty.webp';
import staffFloatFilled from './screens/staff-float-filled.webp';
import staffFloatSent from './screens/staff-float-sent.webp';
import staffFloatTitle from './screens/staff-float-title.webp';
import staffFloatType from './screens/staff-float-type.webp';
import staffFloating from './screens/staff-floating.webp';
import staffFormFilled from './screens/staff-form-filled.webp';
import staffFormPriority from './screens/staff-form-priority.webp';
import staffList from './screens/staff-list.webp';
import staffListAfter from './screens/staff-list-after.webp';
import staffListOne from './screens/staff-list-one.webp';
import staffShowOpen from './screens/staff-show-open.webp';
import staffShowResponded from './screens/staff-show-responded.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/feedbacks/screens/*.webp.
 * Dihasilkan oleh video/capture/feedbacks.js; `filters`, `upload`, dan kotak dialog yang tertutup popover disesuaikan manual.
 */
const floatForm = {
    dialog: { x: 384, y: 68, w: 512, h: 583 },
    type: { x: 409, y: 239, w: 452, h: 94 },
    title: { x: 409, y: 374, w: 452, h: 40 },
    description: { x: 409, y: 456, w: 452, h: 98 },
    submit: { x: 711, y: 599, w: 160, h: 36 },
};
const respondForm = {
    dialog: { x: 384, y: 146, w: 512, h: 429 },
    response: { x: 409, y: 269, w: 462, h: 138 },
    status: { x: 409, y: 423, w: 462, h: 66 },
    submit: { x: 705, y: 522, w: 167, h: 36 },
};
const showResponded = {
    dialog: { x: 304, y: 134, w: 672, h: 453 },
    badges: { x: 393, y: 158, w: 558, h: 71 },
    description: { x: 329, y: 267, w: 622, h: 69 },
    pageUrl: { x: 329, y: 356, w: 622, h: 18 },
    response: { x: 329, y: 394, w: 622, h: 107 },
    footer: { x: 329, y: 538, w: 622, h: 32 },
};
const list = {
    stats: { x: 292, y: 180, w: 946, h: 102 },
    tabs: { x: 292, y: 306, w: 344, h: 44 },
    filters: { x: 292, y: 372, w: 946, h: 68 },
    search: { x: 292, y: 456, w: 256, h: 40 },
    cardBug: { x: 292, y: 520, w: 305, h: 229 },
    cardFeature: { x: 613, y: 520, w: 305, h: 229 },
    bell: { x: 1015, y: 26, w: 32, h: 32 },
};
const staffCards = {
    stats: { x: 292, y: 180, w: 956, h: 102 },
    filters: { x: 292, y: 304, w: 956, h: 68 },
    cardBug: { x: 292, y: 452, w: 308, h: 229 },
    cardFeature: { x: 616, y: 452, w: 308, h: 229 },
    bell: { x: 1066, y: 26, w: 32, h: 32 },
};

export const SHOTS = {
    'staff-floating': { floating: { x: 1130, y: 648, w: 126, h: 48 } },
    'staff-float-empty': floatForm,
    'staff-float-type': floatForm,
    'staff-float-title': floatForm,
    'staff-float-filled': floatForm,
    'staff-float-sent': { toast: { x: 900, y: 24, w: 356, h: 73 } },
    'staff-list-one': {
        header: { x: 292, y: 84, w: 956, h: 72 },
        create: { x: 1088, y: 102, w: 160, h: 36 },
        tutorial: { x: 964, y: 98, w: 115, h: 44 },
        floating: { x: 1198, y: 648, w: 58, h: 48 },
        card: { x: 292, y: 452, w: 308, h: 207 },
    },
    'staff-form-priority': {
        dialog: { x: 304, y: 36, w: 672, h: 648 },
        type: { x: 329, y: 206, w: 612, h: 94 },
        title: { x: 329, y: 342, w: 612, h: 40 },
        description: { x: 329, y: 424, w: 612, h: 118 },
        priority: { x: 329, y: 558, w: 612, h: 62 },
    },
    'staff-form-filled': {
        priority: { x: 329, y: 410, w: 612, h: 62 },
        upload: { x: 329, y: 495, w: 612, h: 110 },
        submit: { x: 791, y: 638, w: 160, h: 36 },
    },
    'staff-list': staffCards,
    'staff-show-open': {
        dialog: { x: 304, y: 163, w: 672, h: 394 },
        badges: { x: 393, y: 188, w: 558, h: 71 },
        pageUrl: { x: 329, y: 386, w: 622, h: 18 },
        attachment: { x: 329, y: 423, w: 622, h: 48 },
        editRemove: { x: 723, y: 508, w: 164, h: 32 },
    },
    'staff-list-after': staffCards,
    'staff-show-responded': showResponded,
    'fm-list': list,
    'fm-show': {
        dialog: { x: 304, y: 197, w: 672, h: 326 },
        badges: { x: 393, y: 222, w: 558, h: 71 },
        description: { x: 329, y: 330, w: 622, h: 69 },
        pageUrl: { x: 329, y: 420, w: 622, h: 18 },
        changeStatus: { x: 663, y: 474, w: 115, h: 32 },
        respond: { x: 786, y: 474, w: 101, h: 32 },
    },
    'fm-respond-empty': respondForm,
    'fm-respond-text': respondForm,
    'fm-respond-status': { ...respondForm, list: { x: 409, y: 530, w: 461, h: 120 }, option: { x: 415, y: 536, w: 449, h: 36 } },
    'fm-show-responded': { ...showResponded, changeStatus: { x: 627, y: 538, w: 115, h: 32 }, respond: { x: 750, y: 538, w: 137, h: 32 } },
    'fm-status-menu': { ...showResponded, changeStatus: { x: 627, y: 538, w: 115, h: 32 }, menu: { x: 614, y: 573, w: 128, h: 138 } },
    'fm-list-after': list,
    'admin-list': { ...list, bell: { x: 1070, y: 26, w: 32, h: 32 } },
    'admin-bell': { popover: { x: 750, y: 66, w: 352, h: 300 }, first: { x: 751, y: 128, w: 350, h: 96 } },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

export const SCREENS: Record<ShotName, string> = {
    'admin-bell': adminBell,
    'admin-list': adminList,
    'fm-list': fmList,
    'fm-list-after': fmListAfter,
    'fm-respond-empty': fmRespondEmpty,
    'fm-respond-status': fmRespondStatus,
    'fm-respond-text': fmRespondText,
    'fm-show': fmShow,
    'fm-show-responded': fmShowResponded,
    'fm-status-menu': fmStatusMenu,
    'staff-float-empty': staffFloatEmpty,
    'staff-float-filled': staffFloatFilled,
    'staff-float-sent': staffFloatSent,
    'staff-float-title': staffFloatTitle,
    'staff-float-type': staffFloatType,
    'staff-floating': staffFloating,
    'staff-form-filled': staffFormFilled,
    'staff-form-priority': staffFormPriority,
    'staff-list': staffList,
    'staff-list-after': staffListAfter,
    'staff-list-one': staffListOne,
    'staff-show-open': staffShowOpen,
    'staff-show-responded': staffShowResponded,
};

export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
