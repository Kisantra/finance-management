import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Mengenal halaman Rekening Bank. */
export const TOUR_STEPS: Step[] = [
    {
        src: img('fm-overview'),
        caption: 'Buka Keuangan › Rekening Bank. Kiri: daftar rekening dan ringkasan total. Kanan: detail rekening yang dipilih.',
        duration: 120,
    },
    {
        src: img('fm-overview'),
        focus: S['fm-overview'].accountList,
        zoom: 1.5,
        caption: 'Angka di bawah nama rekening adalah saldo terkini, dihitung otomatis: saldo awal + uang masuk − uang keluar.',
        duration: 130,
    },
    {
        src: img('fm-overview'),
        focus: around(S['fm-overview'].stats, S['fm-overview'].month),
        zoom: 1.4,
        caption: 'Pemasukan, Pengeluaran, dan Arus Bersih rekening terpilih. Pilih bulan di kanan atas untuk melihat satu periode saja.',
        duration: 130,
    },
    {
        src: img('fm-overview'),
        focus: around(S['fm-overview'].chart, S['fm-overview'].breakdown),
        zoom: 1.2,
        caption: 'Grafik membandingkan uang masuk dan keluar selama 12 bulan; Breakdown Kategori menunjukkan ke mana uang rekening ini paling banyak keluar.',
        duration: 130,
    },
];

/** Menambah rekening baru. */
export const CREATE_STEPS: Step[] = [
    {
        src: img('fm-overview'),
        focus: S['fm-overview'].create,
        cursor: S['fm-overview'].create,
        click: true,
        zoom: 1.7,
        caption: 'Klik Tambah Rekening untuk mendaftarkan rekening baru.',
        duration: 80,
    },
    {
        src: img('fm-account-empty'),
        focus: S['fm-account-empty'].dialog,
        caption: 'Isi data rekening sesuai buku tabungan atau internet banking.',
        duration: 80,
    },
    {
        src: img('fm-account-name'),
        focus: S['fm-account-name'].name,
        cursor: S['fm-account-name'].name,
        click: true,
        type: S['fm-account-name'].name,
        zoom: 1.6,
        caption: 'Nama Pemilik Rekening: beri nama yang mudah dikenali, mis. "BRI - Proyek Klien".',
    },
    {
        src: img('fm-account-bank'),
        focus: around(S['fm-account-bank'].number, S['fm-account-bank'].bank),
        cursor: S['fm-account-bank'].bank,
        type: around(S['fm-account-bank'].number, S['fm-account-bank'].bank),
        zoom: 1.6,
        caption: 'Nomor Rekening tidak boleh sama dengan rekening lain. Lalu isi Nama Bank.',
    },
    {
        src: img('fm-account-filled'),
        focus: around(S['fm-account-filled'].branch, S['fm-account-filled'].initial),
        cursor: S['fm-account-filled'].initial,
        type: around(S['fm-account-filled'].branch, S['fm-account-filled'].initial),
        zoom: 1.6,
        caption: 'Cabang boleh dikosongkan. Saldo Awal = saldo rekening pada saat mulai dicatat di aplikasi.',
        duration: 130,
    },
    {
        src: img('fm-account-filled'),
        focus: S['fm-account-filled'].submit,
        cursor: S['fm-account-filled'].submit,
        click: true,
        zoom: 1.8,
        caption: 'Klik Tambah Rekening untuk menyimpan.',
        duration: 80,
    },
    {
        src: img('fm-account-new'),
        focus: S['fm-account-new'].selected,
        zoom: 1.6,
        caption: 'Rekening baru muncul di daftar dan langsung terpilih. Saldonya berawal dari Saldo Awal, lalu berubah setiap ada transaksi (contoh ini sudah berisi transaksi).',
        chime: true,
        duration: 150,
    },
];

/** Mencatat pengeluaran (dan pemasukan). */
export const EXPENSE_STEPS: Step[] = [
    {
        src: img('fm-account-new'),
        focus: S['fm-account-new'].actions,
        cursor: S['fm-account-new'].expense,
        click: true,
        zoom: 1.8,
        caption: 'Uang keluar dari rekening? Klik Pengeluaran. Uang masuk dicatat lewat Pemasukan.',
        duration: 110,
    },
    {
        src: img('fm-expense-empty'),
        focus: around(S['fm-expense-empty'].account, S['fm-expense-empty'].category),
        cursor: S['fm-expense-empty'].quickAdd,
        click: true,
        zoom: 1.5,
        caption: 'Rekening terisi otomatis. Pilih Kategori; belum ada yang cocok? Klik + Tambah untuk membuat kategori baru.',
        duration: 130,
    },
    {
        src: img('fm-quick-category'),
        focus: S['fm-quick-category'].dialog,
        cursor: S['fm-quick-category'].save,
        click: true,
        zoom: 1.4,
        caption: 'Pilih Kelompok Kategori, isi nama sub kategorinya, lalu klik Tambah. Kategori baru langsung terpilih.',
        duration: 120,
    },
    {
        src: img('fm-expense-category'),
        focus: S['fm-expense-category'].categoryTrigger,
        zoom: 1.7,
        caption: 'Langganan Software kini terpilih. Transaksi selalu memakai sub kategori (bertanda ↳).',
        duration: 90,
    },
    {
        src: img('fm-expense-amount'),
        focus: around(S['fm-expense-amount'].categoryTrigger, S['fm-expense-amount'].date),
        cursor: S['fm-expense-amount'].amount,
        type: S['fm-expense-amount'].amount,
        zoom: 1.5,
        caption: 'Isi Jumlah. Tanggal otomatis hari ini; ubah bila transaksinya terjadi di hari lain.',
    },
    {
        src: img('fm-expense-filled'),
        focus: around(S['fm-expense-filled'].description, S['fm-expense-filled'].upload),
        cursor: S['fm-expense-filled'].upload,
        type: around(S['fm-expense-filled'].description, S['fm-expense-filled'].upload),
        zoom: 1.5,
        caption: 'Isi Deskripsi dan Nomor Referensi, lalu lampirkan bukti: PDF, JPG, atau PNG, maksimal 5 MB.',
        duration: 130,
    },
    {
        src: img('fm-expense-filled'),
        focus: S['fm-expense-filled'].submit,
        cursor: S['fm-expense-filled'].submit,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Pengeluaran.',
        duration: 75,
    },
    {
        src: img('fm-expense-saved'),
        focus: S['fm-expense-saved'].dialog,
        caption: 'Tersimpan. Form dikosongkan agar bisa langsung mencatat transaksi berikutnya; klik Tutup bila selesai.',
        chime: true,
        duration: 110,
    },
    {
        src: img('fm-income-filled'),
        focus: S['fm-income-filled'].dialog,
        caption: 'Pemasukan dicatat dengan cara yang sama, mis. sewa ruang rapat Rp 750.000 dengan kategori Sewa Ruang Rapat.',
        duration: 130,
    },
];

/** Transfer antar rekening. */
export const TRANSFER_STEPS: Step[] = [
    {
        src: img('fm-account-new'),
        focus: S['fm-account-new'].transfer,
        cursor: S['fm-account-new'].transfer,
        click: true,
        zoom: 1.9,
        caption: 'Memindahkan dana ke rekening lain? Klik Transfer.',
        duration: 80,
    },
    {
        src: img('fm-transfer-accounts'),
        focus: around(S['fm-transfer-accounts'].flow, S['fm-transfer-accounts'].category),
        cursor: S['fm-transfer-accounts'].to,
        click: true,
        zoom: 1.3,
        caption: 'Rekening Sumber terisi rekening yang dibuka. Pilih Rekening Tujuan dan kategori bertipe Transfer.',
        duration: 130,
    },
    {
        src: img('fm-transfer-amount'),
        focus: around(S['fm-transfer-amount'].amount, S['fm-transfer-amount'].fee),
        cursor: S['fm-transfer-amount'].amount,
        type: S['fm-transfer-amount'].amount,
        zoom: 1.6,
        caption: 'Jumlah Transfer = uang yang diterima tujuan. Biaya Admin (awalnya Rp 2.500) dibebankan ke rekening sumber.',
        duration: 140,
    },
    {
        src: img('fm-transfer-submit'),
        focus: S['fm-transfer-submit'].summary,
        zoom: 1.5,
        caption: 'Setelah mengisi Deskripsi, periksa Total Debit: jumlah + biaya admin yang keluar dari rekening sumber.',
        duration: 130,
    },
    {
        src: img('fm-transfer-submit'),
        focus: S['fm-transfer-submit'].submit,
        cursor: S['fm-transfer-submit'].submit,
        click: true,
        zoom: 1.8,
        caption: 'Klik Lakukan Transfer.',
        duration: 75,
    },
];

/** Riwayat transaksi & pembayaran. */
export const HISTORY_STEPS: Step[] = [
    {
        src: img('fm-account-after'),
        focus: S['fm-account-after'].stats,
        zoom: 1.5,
        caption: 'Saldo dan ringkasan langsung diperbarui. Transfer keluar ikut terhitung di Pengeluaran rekening ini.',
        chime: true,
        duration: 130,
    },
    {
        src: img('fm-transactions'),
        focus: S['fm-transactions'].table,
        zoom: 1.15,
        caption: 'Tab Transaksi berisi semua transaksi rekening ini, lengkap dengan kategori, tanggal, dan lampirannya.',
        duration: 120,
    },
    {
        src: img('fm-transactions'),
        focus: S['fm-transactions'].transferRow,
        zoom: 1.6,
        caption: 'Transfer memakai nomor referensi TRF. Di rekening tujuan ada pasangannya: transaksi masuk Rp 1.500.000.',
        duration: 130,
    },
    {
        src: img('fm-transactions-right'),
        focus: S['fm-transactions-right'].deleteIcon,
        cursor: S['fm-transactions-right'].deleteIcon,
        click: true,
        zoom: 2,
        caption: 'Salah catat? Klik ikon tempat sampah. Menghapus satu sisi transfer ikut menghapus pasangannya.',
        duration: 120,
    },
    {
        src: img('fm-payments'),
        focus: S['fm-payments'].table,
        zoom: 1.15,
        caption: 'Tab Pembayaran menampilkan pembayaran invoice yang masuk ke rekening ini. Pembayaran dicatat dari modul Invoice.',
        duration: 130,
    },
];

/** Admin: jejak transaksi rekening di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-account'),
        focus: around(S['admin-account'].selected, S['admin-account'].jago),
        zoom: 1.7,
        caption: 'Setelah transfer, saldo BRI berkurang Rp 1.502.500 dan Jago bertambah Rp 1.500.000. Selisihnya adalah biaya admin.',
        duration: 150,
    },
    {
        src: img('admin-account'),
        focus: S['admin-account'].total,
        zoom: 1.6,
        caption: 'Ringkasan Total menjumlahkan semua rekening. Pemasukan & Pengeluaran di sini termasuk transfer antar rekening.',
        duration: 140,
    },
    {
        src: img('admin-expenses'),
        focus: S['admin-expenses'].row,
        zoom: 1.3,
        caption: 'Pengeluaran berkategori Pengeluaran tampil di Arus Kas › Pengeluaran, lengkap dengan rekening dan kategorinya.',
        duration: 140,
    },
    {
        src: img('admin-income'),
        focus: S['admin-income'].row,
        zoom: 1.3,
        caption: 'Pemasukan berkategori Pemasukan tampil di Arus Kas › Pemasukan dengan sumber Langsung, bukan dari invoice.',
        duration: 130,
    },
    {
        src: img('admin-transfers'),
        focus: S['admin-transfers'].row,
        zoom: 1.3,
        caption: 'Transfer tampil di Arus Kas › Transfer & Penyesuaian: dari, ke, jumlah, dan biaya admin.',
        duration: 130,
    },
    {
        src: img('admin-pl'),
        focus: S['admin-pl'].unclassified,
        zoom: 1.2,
        caption: 'Di Laporan › Laba Rugi, kategori Pemasukan/Pengeluaran tanpa Grup L/R masuk panel Perlu Diklasifikasi dan belum dihitung.',
        duration: 140,
    },
    {
        src: img('admin-pl'),
        focus: S['admin-pl'].sewa,
        zoom: 1.7,
        caption: 'Contohnya Sewa Ruang Rapat. Pilih grupnya langsung di panel ini atau di Kategori Transaksi. Transfer tidak masuk Laba Rugi.',
        duration: 150,
    },
];

/** Admin: edit & hapus rekening. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('fm-menu'),
        focus: S['fm-menu'].menu,
        cursor: S['fm-menu'].edit,
        zoom: 1.8,
        caption: 'Menu ••• di samping Transfer berisi Edit Rekening, Export PDF laporan kas, dan Hapus Rekening.',
        duration: 130,
    },
    {
        src: img('fm-account-edit'),
        focus: S['fm-account-edit'].initial,
        zoom: 1.7,
        caption: 'Mengubah Saldo Awal menggeser saldo terkini dan laporan lama, tanpa transaksi tercatat. Pakai hanya untuk koreksi.',
        duration: 150,
    },
    {
        src: img('fm-account-delete'),
        focus: S['fm-account-delete'].dialog,
        cursor: S['fm-account-delete'].cancel,
        zoom: 1.6,
        caption: 'Hapus Rekening ikut menghapus semua transaksi & pembayaran invoice-nya secara permanen. Hapus hanya rekening yang belum dipakai.',
        duration: 160,
    },
];
