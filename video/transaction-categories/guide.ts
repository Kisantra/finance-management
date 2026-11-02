import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'transaction-categories',
    title: 'Kategori Transaksi',
    group: 'Operasional',
    order: 30,
    path: '/transaction-categories',
    permission: 'view categories',
    summary:
        'Daftar kategori untuk mengelompokkan setiap uang masuk dan keluar: kategori utama sebagai kelompok, sub kategori sebagai pilihan saat mencatat transaksi. Tipe kategori menentukan halaman Arus Kas tempat transaksi tampil, dan Grup Laba Rugi menentukan barisnya di laporan Laba Rugi. Staff tidak punya akses ke modul ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola kategori',
            can: [
                'Menambah kategori utama & sub kategori',
                'Mengatur Grup Laba Rugi tiap kategori',
                'Mengubah nama, tipe, dan parent kategori',
                'Menghapus kategori, sambil memindahkan datanya ke kategori lain',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Menjaga klasifikasi agar Laba Rugi benar'],
        },
    ],
    tasks: [
        {
            title: 'Menambah kategori',
            role: ROLES.fm,
            steps: [
                'Buka **Operasional › Kategori Transaksi**, lalu klik **Tambah Kategori**.',
                'Pilih **Tipe**: Pemasukan, Pengeluaran, Pendanaan, Transfer, atau Penyesuaian.',
                'Isi **Nama Kategori**. Untuk Pemasukan/Pengeluaran, pilih **Grup Laba Rugi (opsional)**, mis. Beban Operasional.',
                'Pilih **Parent Kategori (opsional)** untuk membuat sub kategori. Dikosongkan = kategori utama.',
                'Klik **Simpan Kategori**.',
            ],
        },
        {
            title: 'Mengklasifikasikan kategori untuk Laba Rugi',
            role: ROLES.fm,
            steps: [
                'Klik tombol **Belum diklasifikasi** untuk menampilkan kategori Pemasukan/Pengeluaran yang belum punya grup. Kategori utama ikut tampil; yang terpenting adalah sub kategori, karena itulah yang dipilih saat mencatat transaksi.',
                'Klik ikon pensil di baris sub kategori, pilih **Grup Laba Rugi (opsional)**, lalu klik **Perbarui Kategori**.',
                'Cara lain: dari **Laporan › Laba Rugi**, lewat panel **Perlu Diklasifikasi**.',
            ],
        },
        {
            title: 'Mengubah kategori',
            role: ROLES.fm,
            steps: [
                'Klik ikon pensil di baris kategori untuk membuka **Edit Kategori**.',
                'Ubah **Tipe**, **Nama Kategori**, **Grup Laba Rugi**, atau **Parent Kategori**, lalu klik **Perbarui Kategori**.',
                'Mengklik **Tipe** mengosongkan **Grup Laba Rugi** dan **Parent Kategori**. Pilih ulang keduanya; tanpa parent, sub kategori berubah menjadi kategori utama dan tidak bisa dipilih lagi di form transaksi.',
                'Perubahan langsung berlaku untuk semua transaksi lama yang memakai kategori ini.',
            ],
        },
        {
            title: 'Menghapus kategori',
            role: ROLES.fm,
            steps: [
                'Klik ikon tempat sampah di baris kategori. Kategori yang masih punya sub kategori tidak bisa dihapus (ikonnya nonaktif).',
                'Belum pernah dipakai: klik **Hapus** pada konfirmasi.',
                'Sudah dipakai: pilih **Pindahkan ke Kategori** (tipenya harus sama), lalu klik **Pindahkan & Hapus**.',
            ],
        },
        {
            title: 'Membuat kategori dari form transaksi',
            role: ROLES.fm,
            steps: [
                'Di dialog **Catat Pemasukan** / **Catat Pengeluaran** (dari Rekening Bank atau Arus Kas), klik **+ Tambah** di sebelah **Kategori**.',
                'Pilih **Sub Kategori** (dengan **Kelompok Kategori**) atau **Kelompok**, isi namanya, lalu klik **Tambah**. Tipenya mengikuti form (Pemasukan/Pengeluaran) dan belum punya Grup Laba Rugi.',
                'Daftar **Kelompok Kategori** bisa juga memuat kelompok Transfer atau Penyesuaian. Pilih kelompok yang memang untuk pemasukan/pengeluaran.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat membuat kategori',
            tone: 'act',
            items: [
                'Belum ada uang yang bergerak: saldo dan laporan tidak berubah.',
                'Sub kategori langsung muncul di pilihan kategori form transaksi; kategori utama hanya sebagai judul kelompok.',
                'Kategori Pemasukan/Pengeluaran tanpa Grup Laba Rugi: transaksinya masuk panel **Perlu Diklasifikasi** dan tidak dihitung di Laba Rugi.',
            ],
        },
        {
            title: 'Saat mengubah kategori',
            tone: 'wait',
            items: [
                '**Grup Laba Rugi**: Laba Rugi dihitung ulang, termasuk bulan-bulan yang sudah lewat.',
                '**Nama**: semua transaksi lama ikut tampil dengan nama baru.',
                '**Tipe**: Grup Laba Rugi dikosongkan; transaksi lama pindah halaman Arus Kas, atau tidak tampil lagi di Pemasukan/Pengeluaran bila tipenya Pendanaan, Transfer, atau Penyesuaian (saldo rekening tidak berubah). Ketiga tipe itu juga keluar dari Laba Rugi.',
                '**Parent**: sub kategori pindah kelompok di pilihan kategori. Tanpa parent, ia menjadi kategori utama dan tidak bisa dipilih lagi di form transaksi.',
            ],
        },
        {
            title: 'Saat Pindahkan & Hapus',
            tone: 'neg',
            items: [
                'Transaksi bank, item permintaan dana, dan reimbursement dipindah ke kategori pengganti dalam satu langkah.',
                'Arus Kas, Breakdown Kategori rekening, dan Laba Rugi mengikuti kategori pengganti.',
                'Kategori lama terhapus permanen; tidak ada cara mengembalikannya.',
            ],
        },
    ],
    records: [
        {
            title: 'Yang dipindahkan saat Pindahkan & Hapus',
            subtitle: 'Contoh: kategori "Biaya Langganan (lama)" dihapus, datanya dipindah ke "Langganan Software".',
            rows: [
                { label: 'Transaksi bank', value: 'Kategori → Langganan Software', source: 'Rekening & Arus Kas', tone: 'pos' },
                { label: 'Item permintaan dana', value: 'Kategori → Langganan Software', source: 'Permintaan Dana', tone: 'act' },
                { label: 'Reimbursement', value: 'Kategori akuntansi → Langganan Software', source: 'Reimbursement', tone: 'act' },
                { label: 'Laba Rugi', value: 'Ikut Grup L/R kategori pengganti', source: 'Otomatis', tone: 'neutral' },
                { label: 'Kategori lama', value: 'Dihapus', source: 'Otomatis', tone: 'neutral' },
            ],
            note: 'Semua dipindah dalam **satu transaksi database**: berhasil semua atau tidak sama sekali.',
        },
    ],
    warnings: [
        {
            title: 'Grup Laba Rugi dibaca dari sub kategori',
            body: 'Laba Rugi membaca grup milik kategori yang dipakai transaksi, dan form transaksi hanya menawarkan sub kategori. Grup pada kategori utama tidak diwariskan ke sub kategorinya, jadi atur grup di tiap sub kategori.',
        },
        {
            title: 'Perubahan berlaku mundur',
            body: 'Mengubah Grup Laba Rugi atau Tipe mengubah laporan bulan-bulan lalu yang sudah dilihat atau dicetak. Lakukan dengan sadar, sebaiknya di awal periode.',
        },
        {
            title: 'Tipe kategori utama tidak menurun',
            body: 'Mengubah Tipe kategori utama tidak mengubah Tipe sub kategorinya, padahal pilihan kategori di form transaksi dikelompokkan menurut tipe kategori utama. Ubah tiap sub kategori satu per satu agar transaksinya tampil di halaman Arus Kas yang benar.',
        },
        {
            title: 'Pilih sub kategori sebagai pengganti',
            body: 'Daftar **Pindahkan ke Kategori** juga memuat kategori utama. Pilih yang berformat **Kategori utama → Sub kategori**, karena kategori utama tidak bisa dipilih di form transaksi.',
        },
        {
            title: 'Pendanaan, Transfer & Penyesuaian di luar Laba Rugi',
            body: 'Pinjaman, setoran modal, dan pindah dana antar rekening memang tidak dihitung sebagai pendapatan atau beban. Jangan memakai tipe ini untuk biaya operasional.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat daftar kategori', cells: [false, true, true] },
        { action: 'Menambah & mengubah kategori', cells: [false, true, true] },
        { action: 'Mengatur Grup Laba Rugi', cells: [false, true, true] },
        { action: 'Menghapus + memindahkan data', cells: [false, true, true] },
        { action: 'Memilih kategori saat mencatat transaksi', cells: ['Di permintaan dana', true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
