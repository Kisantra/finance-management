import type { Box } from '../components/walkthrough';
import guestLogin from './screens/guest-login.webp';
import guestLoginEn from './screens/guest-login-en.webp';
import staffEn from './screens/staff-en.webp';
import staffEnInvoice from './screens/staff-en-invoice.webp';
import staffId from './screens/staff-id.webp';
import staffMenu from './screens/staff-menu.webp';
import staffZh from './screens/staff-zh.webp';

/*
 * Posisi elemen (px CSS, layar 1280×720) di tiap screenshot video/bahasa/screens/*.webp.
 * Dihasilkan oleh video/capture/bahasa.js — ambil ulang bila UI berubah, lalu salin angkanya ke sini.
 */
const nav = { x: 0, y: 0, w: 260, h: 720 };

export const SHOTS = {
    'staff-id': { switcher: { x: 984, y: 20, w: 66, h: 44 }, heading: { x: 292, y: 92, w: 253, h: 33 }, nav },
    'staff-menu': {
        switcher: { x: 984, y: 20, w: 66, h: 44 },
        menu: { x: 874, y: 70, w: 176, h: 153 },
        english: { x: 883, y: 143, w: 158, h: 36 },
        chinese: { x: 883, y: 178, w: 158, h: 36 },
    },
    'staff-en': { switcher: { x: 980, y: 20, w: 70, h: 44 }, heading: { x: 292, y: 92, w: 277, h: 33 }, nav },
    'staff-en-invoice': {
        switcher: { x: 980, y: 20, w: 70, h: 44 },
        heading: { x: 348, y: 88, w: 307, h: 33 },
        detail: { x: 292, y: 164, w: 956, h: 376 },
    },
    'staff-zh': { switcher: { x: 980, y: 20, w: 70, h: 44 }, heading: { x: 292, y: 92, w: 240, h: 33 }, nav },
    'guest-login': { switcher: { x: 476, y: 65, w: 62, h: 40 }, form: { x: 112, y: 299, w: 380, h: 263 } },
    'guest-login-en': { switcher: { x: 472, y: 65, w: 66, h: 40 }, form: { x: 112, y: 299, w: 380, h: 263 } },
} satisfies Record<string, Record<string, Box>>;

export type ShotName = keyof typeof SHOTS;

/** URL screenshot (diimpor agar ikut ter-bundle di Remotion Studio maupun di aplikasi lewat Vite). */
export const SCREENS: Record<ShotName, string> = {
    'guest-login': guestLogin,
    'guest-login-en': guestLoginEn,
    'staff-en': staffEn,
    'staff-en-invoice': staffEnInvoice,
    'staff-id': staffId,
    'staff-menu': staffMenu,
    'staff-zh': staffZh,
};

/** Kotak yang melingkupi beberapa kotak. */
export function around(...boxes: Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}
