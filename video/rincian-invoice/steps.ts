import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Perihal & ATTENTION di bagian atas invoice. */
export const DETAIL_STEPS: Step[] = [
    {
        src: img('staff-detail-empty'),
        focus: around(S['staff-detail-empty'].subject, S['staff-detail-empty'].attentionHint),
        zoom: 1.3,
        caption: 'Di bawah Klien ada Perihal dan Untuk perhatian (ATTENTION). Keduanya opsional dan tercetak di bagian atas invoice.',
        duration: 150,
    },
    {
        src: img('staff-detail'),
        focus: around(S['staff-detail'].subject, S['staff-detail'].attentionHint),
        type: around(S['staff-detail'].subject, S['staff-detail'].attention),
        zoom: 1.3,
        caption: 'Isi Perihal, mis. "Invoice speed boat MV. CONTOH JAYA", dan ATTENTION. ATTENTION kosong = PIC dari data klien.',
        duration: 170,
    },
];

/** Satu harga untuk beberapa pekerjaan: satu baris paket + keterangan bernomor. */
export const PACKAGE_STEPS: Step[] = [
    {
        src: img('staff-package'),
        focus: S['staff-package'].row1,
        zoom: 1.35,
        caption: 'Dua perjalanan, satu harga gabungan? Buat SATU baris: nama yang merangkum, Qty 1, satuan paket, dan harga gabungannya.',
        duration: 180,
    },
    {
        src: img('staff-package'),
        focus: S['staff-package'].addDesc,
        cursor: S['staff-package'].addDesc,
        click: true,
        zoom: 1.6,
        caption: 'Lalu klik Tambah keterangan di bawah nama layanan.',
        duration: 100,
    },
    {
        src: img('staff-package-desc'),
        focus: S['staff-package-desc'].desc1,
        zoom: 1.4,
        caption: 'Tulis setiap perjalanan di baris sendiri, lengkap dengan tanggalnya. Jangan memecah harga atau menambah baris berharga 0.',
        duration: 180,
    },
    {
        src: img('staff-print'),
        focus: S['staff-print'].row1,
        zoom: 1.3,
        chime: true,
        caption: 'Hasil cetaknya: satu baris bernomor dengan satu harga, dan kedua perjalanan terbaca di kolom Keterangan.',
        duration: 170,
    },
];

/** Harga satuan bersen dan pemeriksaan hasil. */
export const DECIMAL_STEPS: Step[] = [
    {
        src: img('staff-decimal'),
        focus: around(S['staff-decimal'].row2, S['staff-decimal'].subtotal2),
        zoom: 1.35,
        caption: 'Harga satuan boleh bersen: ketik 4.350,75 (koma untuk desimal, maksimal dua angka).',
        duration: 140,
    },
    {
        src: img('staff-decimal'),
        focus: around(S['staff-decimal'].qty2, S['staff-decimal'].subtotal2),
        zoom: 1.7,
        caption: 'Jumlah baris dibulatkan ke Rupiah penuh: 1.250 × 4.350,75 = 5.438.437,5 → Rp 5.438.438.',
        duration: 160,
    },
    {
        src: img('staff-drawer'),
        focus: S['staff-drawer'].items,
        zoom: 1.45,
        caption: 'Di detail invoice, paket tetap satu baris dan harga bersen tampil apa adanya. Keterangan terlihat di tab Pratinjau cetak.',
        duration: 170,
    },
    {
        src: img('staff-print'),
        focus: S['staff-print'].table,
        zoom: 1.15,
        caption: 'Tab Pratinjau cetak sama dengan PDF unduhan. Periksa di sini sebelum invoice dikirim ke klien.',
        duration: 150,
    },
];
