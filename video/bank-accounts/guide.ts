import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'bank-accounts',
    title: 'Rekening Bank',
    group: 'Keuangan',
    order: 30,
    path: '/bank-accounts',
    permission: 'view bank-accounts',
    // Video peluncuran 45,6 dtk (sumber: video/launch/bank-accounts.html).
    overview: { src: '/videos/panduan/rekening-bank.mp4', poster: '/videos/panduan/rekening-bank-poster.jpg', seconds: 45 },
    summary:
        'Daftar rekening bank perusahaan beserta saldo terkininya. Dari sini Anda menambah rekening, mencatat pemasukan, pengeluaran, dan transfer antar rekening, lalu memantau arus uang tiap rekening. Saldo tidak pernah diketik: aplikasi selalu menghitungnya dari saldo awal ditambah semua uang masuk dan dikurangi semua uang keluar. Staff tidak punya akses ke modul ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola rekening',
            can: [
                'Menambah, mengedit, dan menghapus rekening',
                'Mencatat pemasukan & pengeluaran ke rekening',
                'Transfer antar rekening (dengan biaya admin)',
                'Menghapus transaksi & export laporan kas PDF',
            ],
            cannot: [
                'Pembayaran invoice hanya dilihat di sini, dicatat dari modul Invoice',
                'Mengedit transaksi tidak bisa dari halaman ini; lakukan di menu **Arus Kas**',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memastikan kategori tiap transaksi benar, karena kategori menentukan Arus Kas & Laba Rugi'],
        },
    ],
    tasks: [
        {
            title: 'Menambah rekening',
            role: ROLES.fm,
            steps: [
                'Buka **Keuangan › Rekening Bank**, lalu klik **Tambah Rekening**.',
                'Isi **Nama Pemilik Rekening**, **Nomor Rekening** (tidak boleh sama dengan rekening lain), **Nama Bank**, dan **Cabang** (opsional).',
                'Isi **Saldo Awal**: saldo rekening pada saat mulai dicatat di aplikasi.',
                'Klik **Tambah Rekening**. Rekening baru langsung terpilih di panel **Rekening**.',
            ],
        },
        {
            title: 'Membaca kondisi sebuah rekening',
            role: ROLES.fm,
            steps: [
                'Klik rekening di panel **Rekening**. Saldo di bawah namanya adalah saldo terkini.',
                'Kartu **Pemasukan**, **Pengeluaran**, dan **Arus Bersih** menghitung semua uang masuk & keluar rekening (termasuk transfer). Pilih bulan di kolom **Semua bulan** untuk satu periode.',
                'Grafik **Pemasukan vs Pengeluaran** menampilkan 12 bulan terakhir; **Breakdown Kategori** menampilkan 6 kategori uang keluar terbesar (termasuk transfer).',
                'Tab **Transaksi** berisi semua transaksi bank rekening ini; tab **Pembayaran** berisi pembayaran invoice yang masuk ke rekening ini.',
                'Lencana **Naik/Turun** hanya membandingkan transaksi masuk bulan ini dengan bulan lalu (tanpa pembayaran invoice).',
            ],
        },
        {
            title: 'Mencatat pemasukan atau pengeluaran',
            role: ROLES.fm,
            steps: [
                'Pilih rekening, lalu klik **Pengeluaran** atau **Pemasukan**.',
                'Periksa **Rekening**, pilih **Kategori** (sub kategori; kategori baru bisa dibuat lewat **+ Tambah**), isi **Jumlah** dan **Tanggal**.',
                'Isi **Deskripsi**, **Nomor Referensi** (opsional), dan **Lampiran Bukti** (PDF, JPG, atau PNG, maksimal 5 MB).',
                'Klik **Simpan Pengeluaran** / **Simpan Pemasukan**. Form dikosongkan agar bisa mencatat transaksi berikutnya; klik **Tutup** bila selesai.',
            ],
        },
        {
            title: 'Transfer antar rekening',
            role: ROLES.fm,
            steps: [
                'Pilih rekening sumber, lalu klik **Transfer**.',
                'Pilih **Rekening Sumber**, **Rekening Tujuan**, **Kategori** (kategori bertipe Transfer), dan **Tanggal**.',
                'Isi **Jumlah Transfer** (yang diterima rekening tujuan) dan **Biaya Admin** (awalnya Rp 2.500; ditambahkan ke debit rekening sumber).',
                'Isi **Deskripsi**, unggah **Bukti Transfer** bila ada, periksa **Total Debit**, lalu klik **Lakukan Transfer**.',
            ],
        },
        {
            title: 'Menghapus transaksi',
            role: ROLES.fm,
            steps: [
                'Di tab **Transaksi**, klik ikon tempat sampah di baris transaksi, atau centang beberapa baris lalu klik **Hapus** di bilah bawah.',
                'Konfirmasi **Hapus**. Bila transaksinya bagian dari transfer, pasangannya di rekening lain ikut terhapus.',
            ],
        },
        {
            title: 'Mengedit, menghapus, atau mencetak laporan rekening',
            role: ROLES.fm,
            steps: [
                'Pilih rekening, lalu klik menu **•••** di samping tombol **Transfer**.',
                '**Edit Rekening**: ubah data rekening. Mengubah **Saldo Awal** menggeser saldo terkini sebesar selisihnya.',
                '**Export PDF**: laporan kas rekening ini untuk semua waktu (filter bulan di halaman tidak ikut).',
                '**Hapus Rekening**: aplikasi tetap menghapus rekening yang sudah berisi transaksi (kecuali yang pernah dipakai membayar pinjaman), jadi gunakan hanya untuk rekening yang belum pernah dipakai. Baca bagian peringatan sebelum menghapus.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat mencatat pemasukan / pengeluaran',
            tone: 'act',
            items: [
                '**1 transaksi bank** masuk (credit) atau keluar (debit).',
                'Saldo rekening dan Total Saldo di **Dashboard** langsung berubah; saldo selalu dihitung ulang dari semua transaksi.',
                'Tampil di **Arus Kas › Pemasukan / Pengeluaran** bila kategorinya bertipe Pemasukan / Pengeluaran.',
                'Masuk **Laba Rugi** sesuai Grup L/R kategorinya; kategori Pemasukan/Pengeluaran tanpa grup masuk panel **Perlu Diklasifikasi** dan belum dihitung.',
            ],
        },
        {
            title: 'Saat transfer',
            tone: 'wait',
            items: [
                '**2 transaksi bank** dengan nomor referensi TRF yang sama: keluar di sumber, masuk di tujuan.',
                'Sumber berkurang jumlah + biaya admin; tujuan bertambah jumlah transfer.',
                'Tampil di **Arus Kas › Transfer & Penyesuaian**.',
                '**Tidak masuk Laba Rugi**, termasuk biaya adminnya.',
            ],
        },
        {
            title: 'Saat mengedit / menghapus rekening',
            tone: 'neg',
            items: [
                'Ubah **Saldo Awal**: saldo terkini dan saldo awal laporan kas PDF ikut bergeser, tanpa transaksi tercatat.',
                '**Hapus rekening**: semua transaksi bank, pembayaran invoice, dan riwayat pembayaran reimbursement di rekening itu ikut terhapus permanen.',
                'Saldo, Arus Kas, dan Laba Rugi langsung kehilangan angka-angka tersebut.',
            ],
        },
    ],
    records: [
        {
            title: 'Isi dua transaksi yang dibuat saat transfer',
            subtitle: 'Contoh transfer Rp 1.500.000 dengan biaya admin Rp 2.500, beserta asal setiap datanya.',
            rows: [
                { label: 'Referensi', value: 'TRF + kode waktu, sama di kedua transaksi', source: 'Otomatis', tone: 'neutral' },
                { label: 'Keluar (debit)', value: 'BRI - Proyek Klien · −Rp 1.502.500', source: 'Jumlah + Biaya Admin', tone: 'pos' },
                { label: 'Deskripsi keluar', value: 'Transfer + Admin Fee - Isi kas kecil proyek Oktober', source: 'Otomatis + Deskripsi', tone: 'neutral' },
                { label: 'Masuk (credit)', value: 'Jago - Kas Kecil · +Rp 1.500.000', source: 'Jumlah Transfer', tone: 'pos' },
                { label: 'Deskripsi masuk', value: 'Transfer masuk - Isi kas kecil proyek Oktober', source: 'Otomatis + Deskripsi', tone: 'neutral' },
                { label: 'Kategori & tanggal', value: 'Pindah Dana Antar Rekening · tanggal transfer', source: 'Dialog Transfer', tone: 'act' },
            ],
            note: 'Menghapus salah satu dari dua transaksi ini akan menghapus **keduanya**.',
        },
    ],
    warnings: [
        {
            title: 'Hapus rekening = hapus seluruh riwayatnya',
            body: 'Semua transaksi bank dan pembayaran invoice ke rekening itu ikut terhapus, tetapi status invoice, reimbursement, dan permintaan dana tidak dihitung ulang (mis. tetap **Lunas** padahal catatan pembayarannya hilang). Rekening yang pernah dipakai membayar pinjaman gagal dihapus.',
        },
        {
            title: 'Ubah saldo awal hanya untuk koreksi',
            body: 'Saldo awal menggeser seluruh saldo rekening, termasuk laporan kas lama, tanpa jejak transaksi. Untuk uang yang benar-benar masuk/keluar, catat **Pemasukan** atau **Pengeluaran**.',
        },
        {
            title: 'Jangan hapus transaksi dari modul lain',
            body: 'Pembayaran reimbursement, pencairan dana, dan transaksi pinjaman/piutang juga tampil di tab Transaksi. Bila dihapus di sini, saldo berubah tetapi status di modul asalnya tidak ikut kembali.',
        },
        {
            title: 'Pilih kategori yang tipenya sesuai',
            body: 'Daftar kategori Pemasukan/Pengeluaran juga memuat kategori Transfer & Penyesuaian. Transaksi dengan kategori itu tidak tampil di Arus Kas › Pemasukan/Pengeluaran (Penyesuaian tidak tampil di halaman Arus Kas mana pun) dan tidak dihitung di Laba Rugi.',
        },
        {
            title: 'Jangan awali Nomor Referensi dengan "TRF"',
            body: 'Referensi berawalan TRF dianggap transfer: saat dihapus, semua transaksi dengan nomor referensi yang sama ikut terhapus.',
        },
        {
            title: 'Biaya admin transfer tidak masuk Laba Rugi',
            body: 'Biaya admin ikut kategori Transfer. Bila ingin tercatat sebagai beban, isi **Biaya Admin** Rp 0 lalu catat **Pengeluaran** terpisah dengan kategori biaya bank.',
        },
        {
            title: 'Pemasukan di halaman ini ≠ pendapatan',
            body: 'Kartu Pemasukan/Pengeluaran menghitung semua uang masuk/keluar rekening, termasuk transfer antar rekening. Untuk pendapatan dan beban, lihat **Laporan › Laba Rugi**.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat saldo, grafik & transaksi', cells: [false, true, true] },
        { action: 'Menambah & mengedit rekening', cells: [false, true, true] },
        { action: 'Mencatat pemasukan & pengeluaran', cells: [false, true, true] },
        { action: 'Transfer antar rekening', cells: [false, true, true] },
        { action: 'Menghapus transaksi', cells: [false, true, true] },
        { action: 'Menghapus rekening', cells: [false, true, true] },
        { action: 'Export laporan kas PDF', cells: [false, true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
