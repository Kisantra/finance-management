import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan Arus Kas — isi selaras dengan docs/module/cash-flow.md dan kode BankTransactionController / CashFlowController. */
export const guide: ModuleGuide = {
    slug: 'cash-flow',
    title: 'Arus Kas',
    group: 'Arus Kas',
    order: 10,
    path: '/cash-flow/income',
    permission: ['view income', 'view expense', 'view transfer'],
    summary:
        'Pencatatan uang masuk dan keluar rekening bank perusahaan dalam tiga halaman: **Pemasukan** (pembayaran invoice + pemasukan langsung), **Pengeluaran**, dan **Transfer & Penyesuaian** (pindah dana antar rekening). Setiap catatan langsung mengubah saldo rekening dan, sesuai kategorinya, Laporan Laba Rugi. Staff tidak punya akses ke modul ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pencatat kas',
            can: [
                'Mencatat pemasukan & pengeluaran langsung beserta bukti',
                'Transfer antar rekening, termasuk biaya admin',
                'Mengedit & menghapus catatan kas',
                'Export PDF laporan arus kas',
            ],
            cannot: ['Pembayaran invoice hanya bisa dilihat di sini; ubah lewat halaman Invoice'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: [
                'Semua yang bisa dilakukan Finance manager',
                'Memastikan kategori tiap catatan benar, karena kategori menentukan Laba Rugi',
            ],
        },
    ],
    tasks: [
        {
            title: 'Mencatat pemasukan langsung',
            role: ROLES.fm,
            steps: [
                'Buka **Arus Kas › Pemasukan**, lalu klik **Input Pemasukan**.',
                'Pilih **Rekening** penerima dan **Kategori** (sub-kategori). Kategori belum ada? Klik **+ Tambah** di samping label Kategori.',
                'Isi **Jumlah** dan **Tanggal**, lalu **Deskripsi** (wajib). **Nomor Referensi** dan **Lampiran Bukti** (PDF/JPG/PNG, maks 5 MB, bisa juga tempel gambar dengan Ctrl+V) opsional.',
                'Klik **Simpan Pemasukan**. Form tetap terbuka dan dikosongkan untuk catatan berikutnya; klik **Tutup** bila selesai.',
                'Pembayaran invoice tidak diinput di sini: otomatis tampil dengan sumber **Invoice** setelah dicatat di halaman Invoice.',
            ],
        },
        {
            title: 'Mencatat pengeluaran',
            role: ROLES.fm,
            steps: [
                'Buka **Arus Kas › Pengeluaran**, lalu klik **Input Pengeluaran**.',
                'Pilih **Rekening** sumber dan **Kategori** biaya, isi **Jumlah**, **Tanggal**, dan **Deskripsi**.',
                'Tambahkan **Nomor Referensi** (mis. nomor tagihan) dan unggah bukti di **Lampiran Bukti**.',
                'Klik **Simpan Pengeluaran**. Saldo rekening langsung berkurang.',
            ],
        },
        {
            title: 'Transfer antar rekening',
            role: ROLES.fm,
            steps: [
                'Buka **Arus Kas › Transfer & Penyesuaian**, lalu klik **Input Transfer** (tombol muncul bila ada minimal 2 rekening).',
                'Pilih **Rekening Sumber** dan **Rekening Tujuan** (harus berbeda), **Kategori** bertipe transfer, dan **Tanggal**.',
                '**Jumlah Transfer** = uang yang diterima rekening tujuan. **Biaya Admin** (awalnya Rp 2.500) ditambahkan ke potongan rekening sumber.',
                'Periksa ringkasan **Total Debit** di bawah form, isi **Deskripsi**, lalu klik **Lakukan Transfer**.',
            ],
        },
        {
            title: 'Mengedit catatan',
            role: ROLES.fm,
            steps: [
                'Klik baris di tabel untuk membuka dialog **Edit Pemasukan** / **Edit Pengeluaran**.',
                'Ubah **Jumlah**, **Tanggal**, **Kategori**, **Referensi**, **Deskripsi**, atau **Lampiran**, lalu klik **Simpan Perubahan**.',
                '**Rekening** tidak bisa diubah. Salah rekening? Hapus lalu catat ulang.',
                'Transfer hanya bisa diubah **Tanggal** dan **Deskripsi**-nya (berlaku untuk kedua sisi). Salah nominal? Hapus lalu buat transfer baru.',
                'Baris bersumber **Invoice** hanya bisa dilihat (**Detail Pembayaran Invoice**).',
            ],
        },
        {
            title: 'Menghapus catatan',
            role: ROLES.admin,
            steps: [
                'Centang baris yang akan dihapus, lalu klik **Hapus** di bar yang muncul di bawah layar dan konfirmasi.',
                'Penghapusan permanen. Transfer terhapus kedua sisinya; baris **Invoice** ikut menghapus catatan pembayaran invoice-nya.',
                'Finance manager juga bisa menghapus. Satu catatan pun dihapus lewat centang yang sama (tidak ada tombol hapus di dialog detail).',
            ],
        },
        {
            title: 'Menyaring & export PDF',
            role: ROLES.fm,
            steps: [
                'Saring dengan **Rentang Tanggal**, **Klien** (Pemasukan), **Kategori**, **Rekening** (Pengeluaran) / **Rekening Terkait** (Transfer), atau kotak **Cari**.',
                'Di Pemasukan, filter **Klien** menyembunyikan baris **Langsung**, dan filter **Kategori** menyembunyikan baris **Invoice**.',
                'Kartu ringkasan (**Total Pemasukan/Pengeluaran/Transfer**, **Jumlah Transaksi**, **Periode**) mengikuti filter aktif.',
                '**Export PDF** membuka laporan arus kas rekening (masuk & keluar, saldo awal sampai akhir) untuk rentang tanggal terpilih; tanpa rentang = semua waktu. Filter klien & kategori tidak ikut ke PDF.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Pemasukan & pengeluaran',
            tone: 'act',
            items: [
                'Membuat **1 transaksi bank** (masuk atau keluar) di rekening yang dipilih.',
                'Saldo rekening berubah seketika; saldo selalu dihitung ulang dari semua transaksinya.',
                'Masuk Laba Rugi pada **tanggal transaksi**, di baris sesuai **grup Laba Rugi** kategorinya.',
                'Kategori tanpa grup Laba Rugi (termasuk yang baru dibuat lewat **+ Tambah**) masuk panel **Perlu Diklasifikasi**, belum dihitung.',
            ],
        },
        {
            title: 'Transfer',
            tone: 'wait',
            items: [
                'Membuat **2 transaksi berpasangan**: keluar di rekening sumber (jumlah + biaya admin) dan masuk di rekening tujuan.',
                'Total kas perusahaan turun sebesar **biaya admin** saja.',
                'Kategori transfer **tidak masuk Laba Rugi**, termasuk biaya adminnya.',
            ],
        },
        {
            title: 'Edit & hapus',
            tone: 'late',
            items: [
                'Mengubah jumlah/kategori/tanggal ikut mengubah saldo & Laba Rugi, termasuk periode lalu.',
                'Menghapus baris **Invoice** menghapus pembayarannya, tetapi **status invoice tetap**.',
                'Menghapus pembayaran Reimbursement ikut menghapus riwayat bayarnya, tetapi status & jumlah dibayarnya tetap.',
                'Mengubah nominal transaksi Reimbursement / Permintaan Dana tidak mengubah pengajuannya.',
            ],
        },
    ],
    records: [
        {
            title: 'Satu transfer = dua transaksi bank',
            subtitle: 'Contoh transfer Rp 10.000.000 dengan biaya admin Rp 6.500 dari BNI ke BCA.',
            rows: [
                { label: 'Keluar (debit)', value: 'BNI - Investasi −Rp 10.006.500', source: 'Jumlah + biaya admin', tone: 'late' },
                { label: 'Deskripsi', value: 'Transfer + Admin Fee - Tambah dana operasional Oktober', source: 'Otomatis', tone: 'neutral' },
                { label: 'Masuk (kredit)', value: 'BCA - Operasional +Rp 10.000.000', source: 'Jumlah Transfer', tone: 'pos' },
                { label: 'Deskripsi', value: 'Transfer masuk - Tambah dana operasional Oktober', source: 'Otomatis', tone: 'neutral' },
                { label: 'Referensi', value: 'TRF + angka waktu (sama di kedua sisi)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Kategori & bukti', value: 'Sama di kedua sisi', source: 'Form transfer', tone: 'act' },
            ],
            note: 'Biaya admin tidak dicatat sebagai baris tersendiri: selisih debit dan kredit itulah biaya adminnya.',
        },
    ],
    warnings: [
        { title: 'Pilih kategori dengan teliti', body: 'Kategori menentukan halaman tempat catatan tampil dan baris Laba Rugi. Kategori **Transfer** (atau **Penyesuaian**) yang dipilih di form Pemasukan/Pengeluaran membuat catatan **hilang** dari halaman itu dan dari Laba Rugi.' },
        { title: 'Menghapus pembayaran invoice', body: 'Baris **Invoice** di Pemasukan bisa ikut terhapus lewat hapus massal. Status invoice tetap (mis. Lunas) walau pembayarannya hilang. Koreksi pembayaran sebaiknya lewat halaman Invoice.' },
        { title: 'Jangan awali referensi dengan "TRF"', body: 'Referensi berawalan **TRF** (termasuk yang diketik saat membayar Reimbursement / mencairkan Permintaan Dana) dianggap transfer: perubahan nominal & kategori diabaikan, dan menghapusnya ikut menghapus semua transaksi berreferensi sama.' },
        { title: 'Penghapusan tidak bisa dibatalkan', body: 'Tidak ada tempat sampah atau riwayat hapus. Menghapus transaksi pembayaran Reimbursement / Permintaan Dana tidak mengembalikan status pengajuannya.' },
    ],
    matrixRoles: [ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat Pemasukan / Pengeluaran / Transfer', cells: [true, true] },
        { action: 'Input pemasukan & pengeluaran', cells: [true, true] },
        { action: 'Transfer antar rekening', cells: [true, true] },
        { action: 'Mengedit catatan', cells: [true, true] },
        { action: 'Menghapus catatan', cells: [true, true] },
        { action: 'Export PDF', cells: [true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
