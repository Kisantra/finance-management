import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Mengenal halaman Kategori Transaksi. */
export const TOUR_STEPS: Step[] = [
    {
        src: img('fm-list'),
        caption: 'Buka Operasional › Kategori Transaksi. Di sini semua kategori dikelola: pemasukan, pengeluaran, pendanaan, transfer, dan penyesuaian.',
        duration: 110,
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].stats,
        zoom: 1.3,
        caption: 'Kategori Utama mengelompokkan Sub Kategori. Belum Diklasifikasi = kategori Pemasukan/Pengeluaran tanpa Grup Laba Rugi.',
        duration: 130,
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].table,
        zoom: 1.15,
        caption: 'Tabel menampilkan Tipe, Parent, Grup L/R, dan berapa kali kategori sudah dipakai.',
        duration: 110,
    },
];

/** Menambah kategori. */
export const CREATE_STEPS: Step[] = [
    {
        src: img('fm-list'),
        focus: S['fm-list'].create,
        cursor: S['fm-list'].create,
        click: true,
        zoom: 1.8,
        caption: 'Klik Tambah Kategori.',
        duration: 80,
    },
    {
        src: img('fm-form-type'),
        focus: S['fm-form-type'].type,
        cursor: S['fm-form-type'].expense,
        click: true,
        zoom: 1.6,
        caption: 'Pilih Tipe, mis. Pengeluaran. Transaksi berkategori Pengeluaran tampil di Arus Kas › Pengeluaran.',
        duration: 120,
    },
    {
        src: img('fm-form-name'),
        focus: S['fm-form-name'].name,
        cursor: S['fm-form-name'].name,
        type: S['fm-form-name'].name,
        zoom: 1.7,
        caption: 'Isi Nama Kategori, mis. "Iklan Media Sosial".',
        duration: 100,
    },
    {
        src: img('fm-form-plgroup'),
        focus: around(S['fm-form-plgroup'].plGroup, S['fm-form-plgroup'].listbox),
        cursor: S['fm-form-plgroup'].option,
        click: true,
        zoom: 1.4,
        caption: 'Pilih Grup Laba Rugi agar transaksinya masuk laporan, mis. Beban Operasional. Hanya ada untuk Pemasukan & Pengeluaran.',
        duration: 150,
    },
    {
        src: img('fm-form-filled'),
        focus: S['fm-form-filled'].parent,
        cursor: S['fm-form-filled'].parent,
        zoom: 1.7,
        caption: 'Pilih Parent agar menjadi sub kategori. Hanya sub kategori yang bisa dipilih saat mencatat transaksi.',
        duration: 130,
    },
    {
        src: img('fm-form-filled'),
        focus: S['fm-form-filled'].submit,
        cursor: S['fm-form-filled'].submit,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Kategori.',
        duration: 75,
    },
    {
        src: img('fm-created'),
        focus: S['fm-created'].created,
        zoom: 1.4,
        caption: 'Kategori baru tampil dengan parent dan grupnya, dan langsung bisa dipilih di form transaksi.',
        chime: true,
        duration: 110,
    },
];

/** Mengklasifikasikan kategori untuk Laba Rugi. */
export const CLASSIFY_STEPS: Step[] = [
    {
        src: img('fm-unclassified'),
        focus: S['fm-unclassified'].unclassified,
        cursor: S['fm-unclassified'].unclassified,
        click: true,
        zoom: 1.8,
        caption: 'Klik Belum diklasifikasi untuk menemukan kategori yang belum masuk Laba Rugi.',
        duration: 110,
    },
    {
        src: img('fm-unclassified'),
        focus: around(S['fm-unclassified'].software, S['fm-unclassified'].old),
        zoom: 1.3,
        caption: 'Langganan Software dibuat dari form transaksi, jadi belum punya grup, padahal sudah dipakai.',
        duration: 130,
    },
    {
        src: img('fm-edit'),
        focus: S['fm-edit'].plGroup,
        cursor: S['fm-edit'].plGroup,
        click: true,
        zoom: 1.6,
        caption: 'Klik ikon pensil di barisnya. Grup Laba Rugi masih Belum diklasifikasi.',
        duration: 110,
    },
    {
        src: img('fm-edit-filled'),
        focus: around(S['fm-edit-filled'].plGroup, S['fm-edit-filled'].submit),
        cursor: S['fm-edit-filled'].submit,
        click: true,
        zoom: 1.4,
        caption: 'Pilih Beban Operasional, lalu klik Perbarui Kategori.',
        duration: 110,
    },
    {
        src: img('fm-edit-saved'),
        focus: S['fm-edit-saved'].software,
        zoom: 1.4,
        caption: 'Grup L/R kini Beban Operasional. Semua transaksi lamanya langsung ikut terhitung di Laba Rugi.',
        chime: true,
        duration: 130,
    },
];

/** Menghapus kategori (dengan memindahkan datanya). */
export const DELETE_STEPS: Step[] = [
    {
        src: img('fm-delete-simple'),
        focus: S['fm-delete-simple'].dialog,
        zoom: 1.6,
        caption: 'Kategori yang belum pernah dipakai cukup dikonfirmasi lalu dihapus.',
        duration: 110,
    },
    {
        src: img('fm-reassign'),
        focus: S['fm-reassign'].warning,
        zoom: 1.6,
        caption: 'Kategori yang masih dipakai tidak bisa langsung dihapus. Dialog menunjukkan data apa saja yang memakainya.',
        duration: 130,
    },
    {
        src: img('fm-reassign-options'),
        focus: S['fm-reassign-options'].parents,
        zoom: 1.5,
        caption: 'Pilih kategori pengganti bertipe sama. Hati-hati: daftar ini juga memuat kategori utama seperti CAPEX dan HPP.',
        duration: 150,
    },
    {
        src: img('fm-reassign-filled'),
        focus: around(S['fm-reassign-filled'].target, S['fm-reassign-filled'].confirm),
        cursor: S['fm-reassign-filled'].confirm,
        click: true,
        zoom: 1.5,
        caption: 'Pilih sub kategori (Kategori utama → Sub kategori), lalu klik Pindahkan & Hapus.',
        duration: 120,
    },
    {
        src: img('fm-reassigned'),
        focus: S['fm-reassigned'].software,
        zoom: 1.4,
        caption: 'Transaksinya pindah ke Langganan Software (kini 2 pemakaian) dan kategori lama terhapus.',
        chime: true,
        duration: 120,
    },
    {
        src: img('fm-parent-locked'),
        focus: around(S['fm-parent-locked'].lock, S['fm-parent-locked'].tooltip),
        zoom: 1.7,
        caption: 'Kategori utama yang masih punya sub kategori tidak bisa dihapus. Hapus atau pindahkan sub kategorinya dulu.',
        duration: 130,
    },
];

/** Admin: jejak kategori di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-picker'),
        focus: around(S['admin-picker'].group, S['admin-picker'].option),
        zoom: 1.5,
        caption: 'Di form transaksi, kategori utama hanya menjadi judul kelompok; yang bisa dipilih adalah sub kategorinya.',
        duration: 140,
    },
    {
        src: img('admin-expense-moved'),
        focus: S['admin-expense-moved'].row,
        zoom: 1.3,
        caption: 'Setelah Pindahkan & Hapus, pengeluaran Zoom Pro di Arus Kas › Pengeluaran kini berkategori Langganan Software.',
        duration: 150,
    },
    {
        src: img('admin-breakdown'),
        focus: S['admin-breakdown'].breakdown,
        zoom: 1.4,
        caption: 'Breakdown Kategori di Rekening Bank ikut menggabungkannya: Langganan Software Rp 3.438.000.',
        duration: 130,
    },
    {
        src: img('admin-pl'),
        focus: S['admin-pl'].opex,
        zoom: 1.4,
        caption: 'Di Laba Rugi, Langganan Software kini masuk Beban Operasional. Laporan periode lama ikut dihitung ulang dengan grup ini.',
        duration: 150,
    },
    {
        src: img('admin-pl'),
        focus: S['admin-pl'].unclassified,
        zoom: 1.15,
        caption: 'Kategori lain yang belum punya grup tetap di panel Perlu Diklasifikasi sampai grupnya diatur.',
        duration: 130,
    },
];
