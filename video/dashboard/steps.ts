import type { Step } from '../components/walkthrough';
import { ROLES } from '../roles';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;
const weeklyPill = { x: 430, y: 197, w: 74, h: 28 };

/** Staff (berlaku untuk semua peran): membaca Ringkasan & mengatur grafik. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-top'),
        caption: 'Ringkasan adalah halaman pertama setelah masuk. Semua angkanya dihitung otomatis dari modul lain; tidak ada yang perlu diisi.',
        duration: 130,
    },
    {
        src: img('staff-top'),
        focus: S['staff-top'].balanceBlock,
        zoom: 1.7,
        caption: 'Angka besar adalah total saldo seluruh rekening perusahaan saat ini.',
        duration: 110,
    },
    {
        src: img('staff-top'),
        focus: S['staff-top'].month,
        zoom: 1.7,
        caption: 'Di bawahnya: pemasukan, pengeluaran, dan arus bersih bulan berjalan. Tanda minus oranye berarti uang keluar lebih banyak.',
        duration: 130,
    },
    {
        src: img('staff-top'),
        focus: S['staff-top'].chart,
        zoom: 1.25,
        caption: 'Grafik membandingkan pemasukan (biru) dan pengeluaran (arsir) per bulan, 6 bulan terakhir.',
    },
    {
        src: img('staff-weekly'),
        focus: S['staff-weekly'].periods,
        cursor: weeklyPill,
        click: true,
        zoom: 1.8,
        caption: 'Klik Mingguan untuk 12 minggu terakhir, atau Tahunan untuk 5 tahun terakhir.',
    },
    {
        src: img('staff-account-open'),
        focus: around(S['staff-account-open'].account, S['staff-account-open'].list),
        cursor: S['staff-account-open'].option,
        click: true,
        zoom: 1.5,
        caption: 'Pilih satu rekening di kotak Semua rekening untuk melihat grafik rekening itu saja.',
    },
    {
        src: img('staff-account'),
        focus: S['staff-account'].balanceBlock,
        zoom: 1.6,
        caption: 'Total saldo dan angka bulan ini tetap seluruh perusahaan. Hanya grafik yang mengikuti rekening pilihan.',
        duration: 140,
    },
    {
        src: img('staff-range-first'),
        focus: S['staff-range-first'].calendarGrid,
        cursor: S['staff-range-first'].last,
        zoom: 1.6,
        caption: 'Butuh rentang sendiri? Di Periode Arus Kas, klik tanggal awal lalu arahkan ke tanggal akhir.',
        duration: 140,
    },
    {
        src: img('staff-range'),
        focus: around(S['staff-range'].badge, S['staff-range'].calendarGrid),
        cursor: S['staff-range-first'].last,
        click: true,
        zoom: 1.45,
        caption: 'Klik tanggal akhir: grafik langsung memakai rentang itu dan kartunya berlabel Dipakai grafik. Maksimal sekitar 2 tahun.',
        chime: true,
        duration: 150,
    },
    {
        src: img('staff-range'),
        focus: S['staff-range'].back,
        cursor: S['staff-range'].back,
        click: true,
        zoom: 2,
        caption: 'Klik Kembali ke Bulanan untuk kembali ke grafik 6 bulan. Pilihan terakhir Anda diingat di browser ini.',
        duration: 130,
    },
    {
        src: img('staff-mid'),
        focus: S['staff-mid'].category,
        zoom: 1.4,
        caption: 'Donat memecah pengeluaran bulan ini per kategori. Paling banyak 5 irisan; sisanya digabung jadi Lainnya.',
        duration: 130,
    },
    {
        src: img('staff-mid-income'),
        focus: S['staff-mid-income'].category,
        cursor: S['staff-mid-income'].categoryTabs,
        click: true,
        zoom: 1.4,
        caption: 'Klik Pemasukan untuk melihat dari mana uang masuk, termasuk pembayaran invoice.',
    },
    {
        src: img('staff-mid'),
        focus: S['staff-mid'].invoices,
        zoom: 1.3,
        caption: 'Invoice Belum Dibayar: invoice terkirim yang belum lunas. Yang jatuh temponya paling awal ada di atas.',
        duration: 130,
    },
    {
        src: img('staff-mid'),
        focus: S['staff-mid'].invoiceRow,
        cursor: S['staff-mid'].invoiceRow,
        click: true,
        zoom: 1.6,
        caption: 'Klik salah satu baris untuk membuka detail invoice-nya.',
        duration: 100,
    },
    {
        src: img('staff-invoice'),
        focus: S['staff-invoice'].metrics,
        zoom: 1.2,
        caption: 'Detail terbuka di atas Ringkasan: total, yang sudah dibayar, dan sisa tagihan. Tutup untuk kembali.',
        duration: 130,
    },
    {
        src: img('staff-bottom'),
        focus: S['staff-bottom'].accounts,
        zoom: 1.4,
        caption: 'Rekening: saldo tiap rekening, yang terbesar di atas. Gulir di dalam kartu untuk melihat sisanya.',
    },
    {
        src: img('staff-bottom'),
        focus: S['staff-bottom'].recent,
        zoom: 1.3,
        caption: 'Transaksi Terbaru: pemasukan, pengeluaran, dan pembayaran invoice paling baru dari semua rekening.',
    },
    {
        src: img('staff-bottom'),
        focus: S['staff-bottom'].allTime,
        zoom: 1.3,
        caption: 'Sepanjang waktu: pendapatan, HPP, laba kotor, dan perkiraan PPh final 0,5% sejak awal pencatatan.',
        duration: 140,
    },
];

/** Finance manager: tautan lanjut + cara membaca angka dengan benar. */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-top'),
        focus: S['fm-top'].cashflow,
        zoom: 1.1,
        caption: 'Finance manager melihat angka yang sama dengan semua peran. Cara membaca tiap kartu ada di tab Staff.',
        duration: 130,
    },
    {
        src: img('fm-mid'),
        focus: S['fm-mid'].expenseLink,
        cursor: S['fm-mid'].expenseLink,
        click: true,
        zoom: 2.2,
        caption: 'Bedanya, Anda bisa lanjut ke modul terkait. Lihat pengeluaran membuka rincian di Arus Kas.',
        duration: 130,
    },
    {
        src: img('fm-mid'),
        focus: S['fm-mid'].invoiceMore,
        cursor: S['fm-mid'].invoiceMore,
        zoom: 2.2,
        caption: 'Lihat semua membuka daftar invoice lengkap. Tautan ini juga tampil untuk Staff.',
    },
    {
        src: img('fm-bottom'),
        focus: S['fm-bottom'].accountsLink,
        cursor: S['fm-bottom'].accountsLink,
        zoom: 2.2,
        caption: 'Semua rekening membuka Rekening Bank untuk mencocokkan saldo dengan mutasi bank.',
    },
    {
        src: img('fm-bottom'),
        focus: S['fm-bottom'].recentLink,
        cursor: S['fm-bottom'].recentLink,
        zoom: 2.2,
        caption: 'Lihat arus kas membuka Arus Kas › Pemasukan: pembayaran invoice dan pemasukan lain.',
        duration: 110,
    },
    {
        src: img('fm-bottom'),
        focus: S['fm-bottom'].profitLoss,
        cursor: S['fm-bottom'].profitLoss,
        zoom: 2.2,
        caption: 'Laporan Laba Rugi menyusun laba rugi per periode dan mengelompokkan transaksi menurut kategorinya, jadi angkanya bisa beda dengan Ringkasan.',
    },
    {
        src: img('staff-mid-income'),
        focus: S['staff-mid-income'].biggest,
        zoom: 2.2,
        caption: 'Hati-hati: transfer antar rekening ikut dihitung sebagai pemasukan dan pengeluaran, seperti "pindah dana antar rekening" ini.',
        duration: 160,
    },
];

/** Admin: jejak angka Ringkasan di modul asalnya. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-top'),
        focus: S['admin-top'].balanceBlock,
        zoom: 1.7,
        caption: 'Total saldo di Ringkasan bukan angka tersimpan. Ia dijumlahkan dari saldo setiap rekening saat halaman dibuka.',
        duration: 150,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].total,
        zoom: 1.9,
        caption: 'Di Keuangan › Rekening Bank, Ringkasan Total menunjukkan angka yang sama.',
        duration: 130,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].accounts,
        zoom: 1.6,
        caption: 'Saldo tiap rekening = saldo awal + pembayaran invoice + transaksi masuk − transaksi keluar. Hapus satu transaksi, saldonya ikut berubah.',
        duration: 170,
    },
    {
        src: img('staff-mid-income'),
        focus: S['staff-mid-income'].biggest,
        zoom: 2.2,
        caption: 'Transfer antar rekening tercatat keluar dan masuk, jadi pemasukan dan pengeluaran bulan ini ikut membesar.',
        duration: 150,
    },
    {
        src: img('admin-bottom'),
        focus: S['admin-bottom'].allTime,
        zoom: 1.3,
        caption: 'Pendapatan sepanjang waktu hanya pembayaran invoice. HPP diambil dari item invoice yang sudah dibayar sebagian atau lunas; laba kotor = pendapatan − HPP.',
        duration: 160,
    },
];

/** Admin: mengatur izin Ringkasan. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-permissions'),
        focus: S['admin-permissions'].role,
        cursor: S['admin-permissions'].role,
        click: true,
        zoom: 1.6,
        caption: 'Siapa yang boleh membuka Ringkasan diatur di Administrasi › Izin & Peran. Pilih perannya, mis. Staff.',
        duration: 140,
    },
    {
        src: img('admin-permissions'),
        focus: S['admin-permissions'].search,
        cursor: S['admin-permissions'].search,
        click: true,
        zoom: 1.8,
        caption: 'Ketik dashboard di kotak pencarian.',
        duration: 100,
    },
    {
        src: img('admin-permissions'),
        focus: S['admin-permissions'].permission,
        cursor: S['admin-permissions'].permission,
        zoom: 2,
        caption: 'Izin view dashboard menentukan aksesnya. Bawaannya Staff juga punya, sehingga ikut melihat saldo dan laba perusahaan.',
        duration: 170,
    },
    {
        src: img('staff-forbidden'),
        focus: S['staff-forbidden'].message,
        zoom: 1.6,
        role: ROLES.staff,
        caption: 'Bila dicabut, Staff dialihkan ke Arus Kas › Pengeluaran yang juga tidak boleh ia buka, lalu melihat Akses ditolak. Beri izin view expense juga.',
        duration: 180,
    },
];
