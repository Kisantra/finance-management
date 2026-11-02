import type { Step } from '../components/walkthrough';
import { SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff (berlaku untuk semua peran): membaca, membuka, dan menandai notifikasi. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-header'),
        focus: S['staff-header'].bell,
        zoom: 2.6,
        caption: 'Lonceng ada di kanan atas setiap halaman. Angka merah adalah jumlah notifikasi yang belum Anda baca.',
        duration: 130,
    },
    {
        src: img('staff-popover'),
        focus: S['staff-popover'].popover,
        cursor: S['staff-popover'].bell,
        click: true,
        zoom: 1.6,
        caption: 'Klik lonceng: muncul 10 notifikasi terbaru dari 30 hari terakhir.',
        duration: 110,
    },
    {
        src: img('staff-popover'),
        focus: S['staff-popover'].first,
        zoom: 2,
        caption: 'Yang belum dibaca bercetak tebal dan bertitik biru. Contoh ini: feedback Anda sudah ditanggapi.',
        duration: 130,
    },
    {
        src: img('staff-popover'),
        focus: S['staff-popover'].first,
        cursor: S['staff-popover'].first,
        click: true,
        zoom: 2,
        caption: 'Klik notifikasinya: otomatis ditandai dibaca, lalu halaman terkait terbuka.',
        duration: 110,
    },
    {
        src: img('staff-after-click'),
        focus: S['staff-after-click'].bell,
        zoom: 2.6,
        caption: 'Halaman Feedback terbuka, dan angka di lonceng berkurang satu.',
        chime: true,
        duration: 110,
    },
    {
        src: img('staff-popover'),
        focus: S['staff-popover'].markAll,
        cursor: S['staff-popover'].markAll,
        zoom: 2.4,
        caption: 'Ingin membersihkan sekaligus? Klik Tandai semua. Notifikasi tidak bisa dikembalikan menjadi belum dibaca.',
        duration: 140,
    },
    {
        src: img('staff-popover'),
        focus: S['staff-popover'].seeAll,
        cursor: S['staff-popover'].seeAll,
        click: true,
        zoom: 2.2,
        caption: 'Lihat semua notifikasi membuka daftar lengkap, termasuk yang lebih lama dari 30 hari.',
    },
    {
        src: img('staff-drawer'),
        focus: S['staff-drawer'].drawer,
        zoom: 1.2,
        caption: 'Panel Semua Notifikasi menampilkan jumlah total dan yang belum dibaca. Muat lebih banyak ada di bawah bila daftarnya panjang.',
        duration: 140,
    },
    {
        src: img('staff-drawer-read'),
        focus: S['staff-drawer-read'].header,
        zoom: 2.2,
        caption: 'Tandai semua di panel ini juga bisa dipakai. Setelahnya: 0 belum dibaca, dan angka merah di lonceng hilang.',
        chime: true,
        duration: 140,
    },
];

/** Finance manager: notifikasi feedback baru. */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-popover'),
        focus: S['fm-popover'].popover,
        cursor: S['fm-popover'].bell,
        click: true,
        zoom: 1.6,
        caption: 'Finance manager menerima Feedback Baru setiap kali ada pengguna mengirim feedback.',
        duration: 130,
    },
    {
        src: img('fm-popover'),
        focus: S['fm-popover'].first,
        zoom: 2,
        caption: 'Pesannya menyebut pengirim, tipe, dan judul feedback.',
        duration: 110,
    },
    {
        src: img('fm-popover'),
        focus: S['fm-popover'].first,
        cursor: S['fm-popover'].first,
        click: true,
        zoom: 2,
        caption: 'Klik untuk membuka halaman Feedback, lalu cari feedback-nya dan tanggapi.',
        duration: 110,
    },
    {
        src: img('fm-after-click'),
        focus: S['fm-after-click'].heading,
        zoom: 1.6,
        caption: 'Halaman Feedback terbuka. Cara menanggapi ada di tutorial modul Feedback.',
        chime: true,
        duration: 120,
    },
];

/** Admin: dari mana notifikasi datang & sifatnya. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-header'),
        focus: S['admin-header'].bell,
        zoom: 2.6,
        caption: 'Lonceng Admin bertambah setiap ada feedback baru dan setiap pengingat invoice jatuh tempo pukul 08.00 WITA.',
        duration: 150,
    },
    {
        src: img('admin-popover'),
        focus: S['admin-popover'].popover,
        zoom: 1.6,
        caption: 'Satu feedback menghasilkan satu notifikasi untuk setiap Admin dan setiap Finance manager.',
        duration: 140,
    },
    {
        src: img('admin-read-all'),
        focus: S['admin-read-all'].popover,
        cursor: S['admin-read-all'].bell,
        zoom: 1.6,
        caption: 'Tandai semua hanya berlaku untuk akun Anda. Finance manager tetap melihat notifikasinya sebagai belum dibaca.',
        chime: true,
        duration: 160,
    },
    {
        src: img('admin-drawer'),
        focus: S['admin-drawer'].list,
        zoom: 1.6,
        caption: 'Semua Notifikasi menyimpan riwayat lengkap. Tidak ada tombol hapus, dan notifikasi lama tidak dibersihkan otomatis.',
        duration: 160,
    },
];
