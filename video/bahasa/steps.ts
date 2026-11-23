import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Pengguna mengganti bahasa tampilan setelah masuk. */
export const SWITCH_STEPS: Step[] = [
    {
        src: img('staff-id'),
        focus: S['staff-id'].switcher,
        zoom: 1.8,
        caption: 'Tombol bahasa ada di kanan atas, di samping lonceng notifikasi. Kodenya menunjukkan bahasa aktif: ID.',
        duration: 140,
    },
    {
        src: img('staff-menu'),
        focus: around(S['staff-menu'].switcher, S['staff-menu'].menu),
        cursor: S['staff-menu'].english,
        click: true,
        zoom: 1.7,
        caption: 'Klik tombolnya, lalu pilih bahasa: Indonesia, English, atau 中文.',
        duration: 130,
    },
    {
        src: img('staff-en'),
        chime: true,
        caption: 'Halaman dimuat ulang dalam bahasa baru: menu, judul, dan tombol berganti. Pilihan ini tersimpan di akun Anda.',
        duration: 160,
    },
    {
        src: img('staff-en-invoice'),
        focus: S['staff-en-invoice'].detail,
        zoom: 1.2,
        caption: 'Formulir ikut berganti, mis. Create Invoice. Data yang Anda ketik dan dokumen PDF tetap dalam Bahasa Indonesia.',
        duration: 170,
    },
    {
        src: img('staff-zh'),
        caption: 'Hal yang sama untuk 中文. Angka dan Rupiah tetap ditulis Rp 1.500.000 di semua bahasa.',
        duration: 150,
    },
];

/** Tamu memilih bahasa di halaman masuk. */
export const GUEST_STEPS: Step[] = [
    {
        src: img('guest-login'),
        focus: S['guest-login'].switcher,
        cursor: S['guest-login'].switcher,
        click: true,
        zoom: 1.8,
        caption: 'Belum masuk? Tombol bahasa juga ada di halaman Masuk.',
        duration: 120,
    },
    {
        src: img('guest-login-en'),
        focus: around(S['guest-login-en'].switcher, S['guest-login-en'].form),
        zoom: 1.3,
        caption: 'Halaman masuk tampil dalam bahasa pilihan, dan pilihan itu disimpan ke akun Anda begitu Anda masuk.',
        duration: 160,
    },
];
