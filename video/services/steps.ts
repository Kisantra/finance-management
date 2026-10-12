import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff: membaca katalog lalu memakainya di invoice. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-list'),
        caption: 'Buka menu Master Data › Layanan. Halaman ini berisi semua layanan yang dijual beserta harga standarnya.',
        duration: 120,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].stats,
        zoom: 1.25,
        caption: 'Ringkasan di atas: jumlah layanan, harga rata-rata, dan harga tertinggi di katalog.',
    },
    {
        src: img('staff-search'),
        focus: S['staff-search'].search,
        cursor: S['staff-search'].search,
        click: true,
        type: S['staff-search'].search,
        zoom: 1.8,
        caption: 'Ketik sebagian nama di kolom Cari layanan, mis. "lapor". Daftar langsung tersaring.',
    },
    {
        src: img('staff-search'),
        focus: S['staff-search'].table,
        zoom: 1.3,
        caption: 'Hasilnya dua layanan perpajakan. Kolom Harga adalah harga standar yang akan disalin ke invoice.',
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].typeFilter,
        cursor: S['staff-list'].typeFilter,
        zoom: 1.8,
        caption: 'Atau saring per kategori lewat Semua Kategori: Perizinan, Administrasi Perpajakan, Digital Marketing, Sistem Digital.',
        duration: 130,
    },
    {
        src: img('staff-invoice'),
        focus: S['staff-invoice'].items,
        zoom: 1.2,
        caption: 'Katalog dipakai saat membuat invoice. Di Keuangan › Invoice, klik Buat Invoice, lalu lihat bagian Item.',
    },
    {
        src: img('staff-invoice'),
        focus: around(S['staff-invoice'].item, S['staff-invoice'].pick),
        cursor: S['staff-invoice'].pick,
        click: true,
        zoom: 1.9,
        caption: 'Klik tombol kaca pembesar (Dari katalog) di samping kolom nama layanan.',
        duration: 100,
    },
    {
        src: img('staff-invoice-catalog'),
        focus: around(S['staff-invoice-catalog'].pick, S['staff-invoice-catalog'].popover),
        cursor: S['staff-invoice-catalog'].option,
        click: true,
        zoom: 1.8,
        caption: 'Cari "SPT", lalu klik layanannya. Harga standarnya ikut tampil di daftar.',
    },
    {
        src: img('staff-invoice-picked'),
        focus: S['staff-invoice-picked'].row,
        zoom: 1.4,
        caption: 'Nama dan harga satuan baris ini terisi otomatis. Harganya tetap boleh diubah khusus untuk invoice ini.',
        chime: true,
        duration: 140,
    },
    {
        src: img('staff-list'),
        focus: around(S['staff-list'].create, S['staff-list'].edit),
        zoom: 1.2,
        caption: 'Tombol Tambah dan pensil tetap tampil, tetapi hanya Finance manager & Admin yang bisa menyimpan; tempat sampah khusus Admin.',
        duration: 140,
    },
];

/** Finance manager: menambah lalu menaikkan harga. */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-list'),
        focus: S['fm-list'].table,
        zoom: 1.15,
        caption: 'Master Data › Layanan: setiap baris adalah satu layanan dengan kategori dan harga standarnya.',
        duration: 110,
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].create,
        cursor: S['fm-list'].create,
        click: true,
        zoom: 2,
        caption: 'Klik Tambah Layanan untuk memasukkan layanan baru ke katalog.',
        duration: 100,
    },
    {
        src: img('fm-form-empty'),
        focus: S['fm-form-empty'].dialog,
        zoom: 1.3,
        caption: 'Form berisi tiga isian wajib: nama, kategori, dan harga.',
        duration: 100,
    },
    {
        src: img('fm-form-name'),
        focus: S['fm-form-name'].name,
        cursor: S['fm-form-name'].name,
        click: true,
        type: S['fm-form-name'].name,
        zoom: 1.9,
        caption: 'Nama Layanan: tulis seperti yang akan tampil di invoice, mis. "Laporan SPT Tahunan Badan".',
    },
    {
        src: img('fm-form-category'),
        focus: around(S['fm-form-category'].category, S['fm-form-category'].list),
        cursor: S['fm-form-category'].option,
        click: true,
        zoom: 1.6,
        caption: 'Pilih Kategori. Kategori hanya untuk mengelompokkan katalog; tidak ikut tercetak di invoice.',
        duration: 130,
    },
    {
        src: img('fm-form-category-set'),
        focus: S['fm-form-category-set'].category,
        zoom: 1.9,
        caption: 'Kategori terpilih: Administrasi Perpajakan.',
        duration: 70,
    },
    {
        src: img('fm-form-filled'),
        focus: S['fm-form-filled'].price,
        cursor: S['fm-form-filled'].price,
        click: true,
        type: S['fm-form-filled'].price,
        zoom: 1.9,
        caption: 'Harga dalam rupiah penuh, tanpa desimal. Ketik angkanya saja; titik ribuan muncul sendiri.',
    },
    {
        src: img('fm-form-filled'),
        focus: around(S['fm-form-filled'].cancel, S['fm-form-filled'].submit),
        cursor: S['fm-form-filled'].submit,
        click: true,
        zoom: 2,
        caption: 'Klik Simpan Layanan.',
        duration: 90,
    },
    {
        src: img('fm-list-added'),
        focus: S['fm-list-added'].firstRow,
        zoom: 1.4,
        caption: 'Layanan baru berada paling atas dan langsung bisa dipilih di invoice maupun template invoice berulang.',
        chime: true,
        duration: 130,
    },
    {
        src: img('fm-list-added'),
        focus: S['fm-list-added'].edit,
        cursor: S['fm-list-added'].edit,
        click: true,
        zoom: 2.2,
        caption: 'Harga naik tahun ini? Klik ikon pensil pada barisnya.',
        duration: 100,
    },
    {
        src: img('fm-edit-open'),
        focus: S['fm-edit-open'].dialog,
        zoom: 1.3,
        caption: 'Form Edit Layanan terbuka dengan data saat ini.',
        duration: 80,
    },
    {
        src: img('fm-edit'),
        focus: S['fm-edit'].price,
        cursor: S['fm-edit'].price,
        click: true,
        type: S['fm-edit'].price,
        zoom: 1.9,
        caption: 'Ubah Harga menjadi Rp 3.500.000, lalu klik Perbarui Layanan.',
    },
    {
        src: img('fm-list-updated'),
        focus: S['fm-list-updated'].firstRow,
        zoom: 1.4,
        caption: 'Harga baru hanya dipakai untuk baris yang dipilih sesudahnya. Invoice dan template yang sudah ada tidak berubah.',
        chime: true,
        duration: 150,
    },
    {
        src: img('fm-list-updated'),
        focus: S['fm-list-updated'].remove,
        zoom: 2.2,
        caption: 'Menghapus hanya bisa dilakukan Admin. Tempat sampah tetap tampil, tetapi Finance manager akan ditolak.',
        duration: 130,
    },
];

/** Admin: jejak katalog di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-invoice'),
        focus: S['admin-invoice'].items,
        zoom: 1.2,
        caption: 'Katalog tidak membuat transaksi apa pun. Ia hanya mempercepat pengisian baris item di Keuangan › Invoice.',
        duration: 140,
    },
    {
        src: img('admin-invoice-catalog'),
        focus: around(S['admin-invoice-catalog'].pick, S['admin-invoice-catalog'].popover),
        cursor: S['admin-invoice-catalog'].option,
        click: true,
        zoom: 1.8,
        caption: 'Tombol Dari katalog membuka daftar layanan beserta harganya. Ketik untuk mencari, lalu klik layanannya.',
    },
    {
        src: img('admin-invoice-picked'),
        focus: S['admin-invoice-picked'].row,
        zoom: 1.4,
        caption: 'Nama dan harga disalin ke baris ini. Sejak itu baris berdiri sendiri: mengubah atau menghapus layanan tidak menyentuhnya.',
        duration: 160,
    },
    {
        src: img('admin-template-lookup'),
        focus: around(S['admin-template-lookup'].lookup, S['admin-template-lookup'].popover),
        cursor: S['admin-template-lookup'].lookup,
        zoom: 1.5,
        caption: 'Hal yang sama di template Keuangan › Invoice Berulang. Template menyimpan harga saat disusun, jadi perbarui manual bila harga katalog naik.',
        duration: 170,
    },
];

/** Admin: menghapus layanan. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-list'),
        focus: S['admin-list'].remove,
        cursor: S['admin-list'].remove,
        click: true,
        zoom: 2.2,
        caption: 'Untuk menghapus, klik ikon tempat sampah pada baris layanan.',
        duration: 100,
    },
    {
        src: img('admin-delete'),
        focus: S['admin-delete'].dialog,
        cursor: S['admin-delete'].confirm,
        zoom: 1.8,
        caption: 'Konfirmasi dengan Hapus Layanan. Penghapusan permanen, tetapi invoice dan template lama tetap utuh.',
        duration: 150,
    },
];
