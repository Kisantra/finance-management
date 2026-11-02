import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Finance manager: membaca laporan. */
export const READ_STEPS: Step[] = [
    {
        src: img('fm-pl-top'),
        caption: 'Buka Laporan › Laba Rugi. Laporan tersusun otomatis dari pembayaran invoice dan transaksi Arus Kas.',
        duration: 120,
    },
    {
        src: img('fm-pl-top'),
        focus: S['fm-pl-top'].presets,
        zoom: 1.7,
        caption: 'Pilih periode: Bulan ini, Bulan lalu, Tahun berjalan (tampilan awal), atau Tahun lalu.',
        duration: 120,
    },
    {
        src: img('fm-pl-top'),
        focus: S['fm-pl-top'].range,
        zoom: 1.6,
        caption: 'Butuh rentang lain? Atur tanggal mulai dan akhir, lalu klik Terapkan.',
        duration: 110,
    },
    {
        src: img('fm-pl-top'),
        focus: around(S['fm-pl-top'].invoiceRevenue, S['fm-pl-top'].totalRevenue),
        zoom: 1.7,
        caption: 'Pendapatan dari Invoice dihitung saat pembayaran diterima, bukan saat invoice diterbitkan.',
        duration: 140,
    },
    {
        src: img('fm-pl-top'),
        focus: S['fm-pl-top'].cogsInvoice,
        zoom: 1.8,
        caption: 'HPP Invoice diambil dari HPP item invoice: uang yang masuk menutup modal dulu, sisanya baru menjadi laba.',
        duration: 150,
    },
    {
        src: img('fm-pl-doc-bottom'),
        focus: around(S['fm-pl-doc-bottom'].grossProfit, S['fm-pl-doc-bottom'].opexTotal),
        zoom: 1.3,
        caption: 'Laba Kotor dikurangi Beban Operasional, dirinci per kategori pengeluaran…',
        duration: 120,
    },
    {
        src: img('fm-pl-doc-bottom'),
        focus: around(S['fm-pl-doc-bottom'].operatingProfit, S['fm-pl-doc-bottom'].net),
        zoom: 1.5,
        caption: '…menjadi Laba Usaha, lalu Laba Sebelum Pajak, dan akhirnya Laba Bersih.',
        duration: 120,
    },
];

/** Finance manager: mengklasifikasi kategori dari panel. */
export const CLASSIFY_STEPS: Step[] = [
    {
        src: img('fm-pl-top'),
        focus: S['fm-pl-top'].panelHead,
        zoom: 1.8,
        caption: 'Panel Perlu Diklasifikasi berisi kategori yang belum punya grup Laba Rugi. Totalnya belum masuk laporan.',
        duration: 150,
    },
    {
        src: img('fm-pl-panel'),
        focus: S['fm-pl-panel'].card,
        zoom: 1.8,
        caption: 'Contoh: pemasukan Sewa Ruang Rapat Rp 2.250.000 belum dihitung sama sekali.',
        duration: 120,
    },
    {
        src: img('fm-pl-classify-open'),
        focus: around(S['fm-pl-classify-open'].card, S['fm-pl-classify-open'].list),
        cursor: S['fm-pl-classify-open'].option,
        click: true,
        zoom: 1.7,
        caption: 'Buka Pilih grup L/R, lalu pilih grupnya. Sewa ruang bukan usaha utama, jadi Pendapatan Lain.',
        duration: 150,
    },
    {
        src: img('fm-pl-classified'),
        focus: S['fm-pl-classified'].section,
        zoom: 1.7,
        caption: 'Laporan langsung dihitung ulang: Sewa Ruang Rapat kini tampil di Pendapatan & Beban Lain.',
        chime: true,
        duration: 130,
    },
    {
        src: img('fm-pl-classified'),
        focus: around(S['fm-pl-classified'].preTax, S['fm-pl-classified'].net),
        zoom: 1.6,
        caption: 'Laba Sebelum Pajak dan Laba Bersih ikut naik. Grup berlaku untuk semua transaksi kategori itu, termasuk periode lalu.',
        duration: 160,
    },
];

/** Finance manager: periode & PDF. */
export const PDF_STEPS: Step[] = [
    {
        src: img('fm-pl-month'),
        focus: S['fm-pl-month'].thisMonth,
        cursor: S['fm-pl-month'].thisMonth,
        click: true,
        zoom: 1.9,
        caption: 'Klik Bulan ini untuk melihat laporan bulan berjalan.',
        duration: 100,
    },
    {
        src: img('fm-pl-month'),
        focus: S['fm-pl-month'].period,
        zoom: 1.9,
        caption: 'Periode yang sedang tampil tertulis di kop laporan.',
        duration: 100,
    },
    {
        src: img('fm-pl-month'),
        focus: S['fm-pl-month'].pdf,
        cursor: S['fm-pl-month'].pdf,
        click: true,
        zoom: 1.9,
        caption: 'Klik Unduh PDF untuk menyimpan laporan periode itu. Pastikan panel Perlu Diklasifikasi sudah kosong.',
        duration: 140,
    },
];

/** Admin: dari mana angka-angka laporan berasal. */
export const ADMIN_TRACE_STEPS: Step[] = [
    {
        src: img('admin-pl-top'),
        focus: S['admin-pl-top'].invoiceRevenue,
        zoom: 1.8,
        caption: 'Pendapatan dari Invoice = pembayaran invoice yang diterima dalam periode, setelah dikurangi titipan pajak.',
        duration: 150,
    },
    {
        src: img('admin-income'),
        focus: S['admin-income'].invoiceRow,
        zoom: 1.4,
        caption: 'Pembayaran itu tampil di Arus Kas › Pemasukan bersumber Invoice. Menghapusnya di sana ikut menurunkan pendapatan.',
        duration: 160,
    },
    {
        src: img('admin-income'),
        focus: S['admin-income'].directRow,
        zoom: 1.4,
        caption: 'Pemasukan Langsung masuk laporan sesuai grup kategorinya. Tanpa grup, ia tertahan di panel Perlu Diklasifikasi.',
        duration: 160,
    },
    {
        src: img('admin-categories'),
        focus: S['admin-categories'].groupCol,
        zoom: 1.8,
        caption: 'Grup Laba Rugi tiap kategori tampil di Operasional › Kategori Transaksi, kolom Grup L/R. Ubah lewat ikon pensil pada kategorinya.',
        duration: 140,
    },
    {
        src: img('admin-categories'),
        focus: S['admin-categories'].opexRow,
        zoom: 1.4,
        caption: 'Contoh: OPERASIONAL bergrup Beban Operasional, jadi semua pengeluarannya masuk baris Beban Operasional.',
        duration: 150,
    },
    {
        src: img('admin-categories'),
        focus: S['admin-categories'].unclassified,
        zoom: 1.8,
        caption: 'Kartu Belum Diklasifikasi menghitung kategori pemasukan/pengeluaran tanpa grup, termasuk yang belum dipakai.',
        duration: 150,
    },
];
