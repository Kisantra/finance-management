import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Finance manager menambah akun kas kecil. */
export const NEW_STEPS: Step[] = [
    {
        src: img('fm-list'),
        focus: S['fm-list'].bankCash,
        zoom: 1.6,
        caption: 'Kas & Bank memisahkan Total Bank dan Total Kas. Kas kecil adalah akun berjenis Kas di halaman ini.',
        duration: 140,
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].add,
        cursor: S['fm-list'].add,
        click: true,
        zoom: 1.6,
        caption: 'Untuk membuat kas kecil baru, klik Tambah Akun.',
        duration: 100,
    },
    {
        src: img('fm-new-bank'),
        focus: S['fm-new-bank'].type,
        cursor: S['fm-new-bank'].cash,
        click: true,
        zoom: 1.4,
        caption: 'Pada Jenis, pilih Kas. Kas tidak butuh nomor rekening atau nama bank.',
        duration: 120,
    },
    {
        src: img('fm-new-cash'),
        focus: around(S['fm-new-cash'].name, S['fm-new-cash'].limitHint),
        zoom: 1.3,
        caption: 'Isinya tinggal Nama Kas, Penanggung Jawab (pemegang uang), Plafon (batas saldo), dan Saldo Awal.',
        duration: 150,
    },
    {
        src: img('fm-new-filled'),
        focus: around(S['fm-new-filled'].name, S['fm-new-filled'].opening),
        type: around(S['fm-new-filled'].name, S['fm-new-filled'].opening),
        zoom: 1.3,
        caption: 'Contoh: Kas Kecil Gudang, dipegang Staf Uji, plafon Rp 3.000.000, saldo awal Rp 0.',
        duration: 160,
    },
    {
        src: img('fm-new-filled'),
        focus: S['fm-new-filled'].submit,
        cursor: S['fm-new-filled'].submit,
        click: true,
        zoom: 1.6,
        chime: true,
        caption: 'Klik Tambah Kas. Akun baru muncul di panel Akun dengan label Kas.',
        duration: 110,
    },
];

/** Finance manager mengisi ulang kas kecil dari rekening bank. */
export const REFILL_STEPS: Step[] = [
    {
        src: img('fm-cash'),
        focus: S['fm-cash'].kasCard,
        zoom: 1.6,
        caption: 'Saldo Kas Kecil Kantor di bawah plafon, jadi kartunya menulis Perlu isi ulang Rp 2.175.000.',
        duration: 140,
    },
    {
        src: img('fm-cash'),
        focus: S['fm-cash'].header,
        zoom: 1.45,
        caption: 'Di atas: penanggung jawab, plafon Rp 5.000.000, dan kekurangannya. Kekurangan = plafon − saldo.',
        duration: 150,
    },
    {
        src: img('fm-cash'),
        focus: S['fm-cash'].refill,
        cursor: S['fm-cash'].refill,
        click: true,
        zoom: 1.7,
        caption: 'Klik Isi ulang.',
        duration: 90,
    },
    {
        src: img('fm-refill'),
        focus: around(S['fm-refill'].source, S['fm-refill'].fee),
        zoom: 1.3,
        caption: 'Dialog Transfer terbuka: tujuan sudah Kas Kecil Kantor dan jumlahnya sudah Rp 2.175.000. Pilih Rekening Sumber dan Kategori.',
        duration: 180,
    },
    {
        src: img('fm-refill-filled'),
        focus: around(S['fm-refill-filled'].summary, S['fm-refill-filled'].journal),
        zoom: 1.25,
        caption: 'Jurnal: kas bertambah, rekening BCA berkurang. Ini perpindahan uang, bukan pengeluaran.',
        duration: 160,
    },
    {
        src: img('fm-refill-filled'),
        focus: S['fm-refill-filled'].submit,
        cursor: S['fm-refill-filled'].submit,
        click: true,
        zoom: 1.6,
        caption: 'Klik Lakukan Transfer.',
        duration: 90,
    },
    {
        src: img('fm-refill-done'),
        focus: around(S['fm-refill-done'].kasCard, S['fm-refill-done'].header),
        zoom: 1.3,
        chime: true,
        caption: 'Saldo kas kembali penuh sesuai plafon, dan tanda Perlu isi ulang hilang.',
        duration: 140,
    },
];
