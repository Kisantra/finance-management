import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan modul Layanan (katalog harga). Lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'services',
    title: 'Layanan',
    group: 'Master Data',
    order: 20,
    path: '/services',
    permission: 'view services',
    summary:
        'Katalog layanan yang dijual perusahaan beserta harga standarnya. Katalog ini dipakai untuk mengisi baris item invoice dan template invoice berulang dengan cepat: nama dan harga disalin ke baris, lalu tetap bisa diubah di sana.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pemakai katalog',
            can: ['Melihat, mencari, dan menyaring layanan per kategori', 'Memilih layanan dari katalog saat membuat invoice'],
            cannot: ['Tidak bisa menambah, mengubah, atau menghapus layanan (tombolnya tampil, tetapi ditolak saat disimpan)'],
        },
        {
            role: ROLES.fm,
            who: 'Pengelola katalog',
            can: ['Menambah layanan baru', 'Mengubah nama, kategori, dan harga', 'Memakai katalog di invoice dan template invoice berulang'],
            cannot: ['Tidak bisa menghapus layanan (tempat sampah tampil, tetapi ditolak)'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Menghapus layanan dari katalog'],
        },
    ],
    tasks: [
        {
            title: 'Mencari layanan di katalog',
            role: ROLES.staff,
            steps: [
                'Buka **Master Data › Layanan**.',
                'Ketik sebagian nama di kolom **Cari layanan...**, atau pilih kategori di **Semua Kategori** untuk menyaring.',
                'Kolom **Harga** adalah harga standar; harga di invoice tetap bisa disesuaikan.',
            ],
        },
        {
            title: 'Memakai layanan saat membuat invoice',
            role: ROLES.staff,
            steps: [
                'Di **Keuangan › Invoice**, klik **Buat Invoice**.',
                'Pada baris item, klik tombol kaca pembesar (**Dari katalog**) di samping nama layanan.',
                'Ketik untuk mencari, lalu klik layanannya: **nama** dan **harga satuan** baris itu langsung terisi.',
                'Ubah harga bila perlu; perubahan itu hanya berlaku untuk invoice tersebut.',
            ],
        },
        {
            title: 'Menambah layanan',
            role: ROLES.fm,
            steps: [
                'Klik **Tambah Layanan**.',
                'Isi **Nama Layanan**, pilih **Kategori** (Perizinan, Administrasi Perpajakan, Digital Marketing, atau Sistem Digital), lalu isi **Harga** dalam rupiah.',
                'Klik **Simpan Layanan**. Layanan langsung tersedia di katalog invoice dan template invoice berulang.',
            ],
        },
        {
            title: 'Mengubah harga atau nama',
            role: ROLES.fm,
            steps: [
                'Klik ikon pensil di kolom **Aksi** pada baris layanan.',
                'Ubah data yang perlu, lalu klik **Perbarui Layanan**.',
                'Harga baru hanya dipakai untuk baris yang dipilih sesudahnya. Invoice dan template yang sudah ada tidak ikut berubah.',
            ],
        },
        {
            title: 'Menghapus layanan',
            role: ROLES.admin,
            steps: [
                'Klik ikon tempat sampah di kolom **Aksi**, lalu konfirmasi **Hapus Layanan**.',
                'Layanan hilang dari katalog. Invoice dan template lama tetap menyimpan nama dan harganya sendiri.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat ditambah / diubah',
            tone: 'act',
            items: [
                'Langsung muncul di katalog **editor invoice** dan **editor template Invoice Berulang**.',
                'Memilih layanan **menyalin** nama dan harga ke baris item, bukan menautkannya.',
                'Mengubah harga **tidak** mengubah invoice, template, atau draft bulanan yang sudah ada.',
                'Tidak ada transaksi, saldo, arus kas, atau laporan yang berubah.',
            ],
        },
        {
            title: 'Saat dihapus',
            tone: 'late',
            items: [
                'Layanan hilang dari katalog dan tidak bisa dipilih lagi.',
                'Invoice dan template lama **tetap utuh**: nama dan harga sudah tersimpan di barisnya.',
                'Penghapusan permanen; untuk memakainya lagi, layanan harus ditambah ulang.',
            ],
        },
    ],
    records: [
        {
            title: 'Yang disalin ke baris invoice',
            subtitle: 'Contoh saat memilih "Laporan SPT Tahunan Badan" dari katalog.',
            rows: [
                { label: 'Nama layanan', value: 'Laporan SPT Tahunan Badan', source: 'Katalog', tone: 'act' },
                { label: 'Harga satuan', value: 'Rp 3.500.000 (bisa diubah)', source: 'Katalog', tone: 'act' },
                { label: 'Qty & satuan', value: '1, diisi sendiri', source: 'Diisi manual', tone: 'pos' },
                { label: 'HPP', value: 'Diisi sendiri per baris', source: 'Diisi manual', tone: 'pos' },
                { label: 'Kategori', value: 'Tidak ikut disalin', source: 'Hanya di katalog', tone: 'neutral' },
            ],
            note: 'Karena disalin, invoice lama **tidak terpengaruh** bila layanan diubah atau dihapus.',
        },
    ],
    warnings: [
        { title: 'Kenaikan harga tidak mengubah template berulang', body: 'Template Invoice Berulang menyimpan harga saat disusun. Setelah menaikkan harga di katalog, perbarui juga template yang memakai layanan itu.' },
        { title: 'Nama ganda tidak dicegah', body: 'Sistem tidak menolak nama layanan yang sama. Cari dulu di katalog sebelum menambah agar tidak ada dua harga untuk layanan yang sama.' },
        { title: 'Tombol tampil untuk semua peran', body: 'Staff tetap melihat **Tambah Layanan**, pensil, dan tempat sampah; Finance manager tetap melihat tempat sampah. Form atau konfirmasinya tetap terbuka, tetapi saat disimpan muncul halaman **Akses ditolak** dan tidak ada yang berubah.' },
        { title: 'Kategori adalah daftar tetap', body: 'Hanya ada empat kategori: Perizinan, Administrasi Perpajakan, Digital Marketing, dan Sistem Digital. Kategori baru perlu ditambahkan oleh tim pengembang.' },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat & mencari katalog', cells: [true, true, true] },
        { action: 'Memakai katalog di invoice', cells: [true, true, true] },
        { action: 'Memakai katalog di template Invoice Berulang', cells: [false, true, true] },
        { action: 'Menambah layanan', cells: [false, true, true] },
        { action: 'Mengubah nama, kategori, harga', cells: [false, true, true] },
        { action: 'Menghapus layanan', cells: [false, false, true] },
    ],
};
