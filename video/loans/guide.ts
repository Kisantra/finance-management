import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'loans',
    title: 'Pinjaman',
    group: 'Utang & Piutang',
    order: 10,
    path: '/loans',
    permission: 'view loans',
    summary:
        'Pinjaman yang DITERIMA perusahaan dari bank, koperasi, atau perorangan. Saat dicatat, dana pokok otomatis masuk ke rekening; setiap angsuran pokok dan bunga otomatis keluar dari rekening sampai pinjaman lunas.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola pinjaman',
            can: [
                'Mencatat pinjaman baru + rekening penerima dana',
                'Mencatat angsuran pokok dan bunga',
                'Mengubah pinjaman yang masih Aktif',
                'Menghapus pinjaman yang belum pernah dibayar',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memantau dampaknya ke rekening, arus kas, dan laba rugi'],
            cannot: ['Staff tidak melihat menu Pinjaman'],
        },
    ],
    flow: {
        steps: [
            { label: 'Aktif', tone: 'act', role: ROLES.fm, what: 'Mencatat pinjaman, dana masuk ke rekening' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Membayar angsuran sampai sisa pokok habis' },
        ],
        note: '**Lunas otomatis** begitu sisa pokok habis. Tidak ada tombol tandai lunas, dan status tidak bisa kembali ke Aktif.',
    },
    tasks: [
        {
            title: 'Mencatat pinjaman baru',
            role: ROLES.fm,
            steps: [
                'Buka **Utang & Piutang › Pinjaman**, lalu klik **Tambah Pinjaman**.',
                '**Nomor Pinjaman** terisi otomatis (mis. LOAN-00004); boleh diubah asal belum dipakai. Isi **Pemberi Pinjaman** dan **Jumlah Pokok**.',
                'Pilih **Tipe Bunga**: **Persentase (% p.a.)** lalu isi **Suku Bunga** per tahun, atau **Tetap (fixed)** lalu isi **Jumlah Bunga Tetap** (total bunga).',
                'Isi **Tenor (bulan)**. **Jatuh Tempo** terisi otomatis dari **Tanggal Mulai** + tenor, dan harus setelah tanggal mulai.',
                'Pilih rekening di **Rekening Penerima** (wajib): dana pokok dicatat masuk ke rekening ini pada tanggal mulai.',
                'Isi **Tujuan Pinjaman** dan unggah **Dokumen Kontrak** bila ada (PDF, JPG, atau PNG, maksimal 5 MB), lalu klik **Simpan Pinjaman**.',
            ],
        },
        {
            title: 'Membayar angsuran',
            role: ROLES.fm,
            steps: [
                'Klik ikon **Catat Pembayaran** pada baris pinjaman, atau buka detailnya lalu klik **Catat Pembayaran**.',
                'Pilih **Rekening Pembayaran** (saldonya ikut tampil) dan **Tanggal Pembayaran** (tidak boleh setelah hari ini).',
                'Isi **Pembayaran Pokok** dan/atau **Pembayaran Bunga**; minimal salah satu harus lebih dari nol. Kolom **Pembayaran Bunga** hanya muncul selama masih ada sisa bunga.',
                'Isi **Nomor Referensi** transfer dan **Catatan** bila perlu, lalu klik **Simpan Pembayaran**. Sisa pokok langsung berkurang.',
            ],
        },
        {
            title: 'Mengubah atau menghapus pinjaman',
            role: ROLES.fm,
            steps: [
                'Ikon **Edit** hanya ada selama pinjaman **Aktif**. Nomor pinjaman dan rekening penerima tidak bisa diubah.',
                'Ikon **Hapus** hanya muncul bila belum ada pokok yang dibayar, dan penghapusan ditolak bila sudah ada pembayaran apa pun.',
                'Mengubah atau menghapus pinjaman **tidak** mengoreksi transaksi dana masuk yang sudah tercatat di rekening.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat pinjaman disimpan',
            tone: 'act',
            items: [
                '**1 transaksi bank masuk** sebesar pokok di Rekening Penerima, bertanggal Tanggal Mulai.',
                'Saldo rekening itu langsung naik.',
                'Dicatat sebagai **pendanaan**, bukan pendapatan: tidak muncul di Arus Kas › Pemasukan dan tidak menambah laba. Di **Ringkasan** (dashboard) tetap ikut kartu Pemasukan, karena kartu itu menjumlah semua uang masuk.',
            ],
        },
        {
            title: 'Saat angsuran dibayar',
            tone: 'pos',
            items: [
                'Pokok dan bunga menjadi **2 transaksi keluar terpisah** dari Rekening Pembayaran.',
                'Saldo rekening berkurang sebesar pokok + bunga.',
                '**Pokok** = pendanaan: tidak tampil di Arus Kas › Pengeluaran dan tidak mengurangi laba (tetapi ikut kartu Pengeluaran di **Ringkasan**).',
                '**Bunga** = beban: tampil di Arus Kas › Pengeluaran dan masuk Laba Rugi sesuai grup kategorinya.',
                'Sisa pokok berkurang; bila habis, status menjadi Lunas.',
            ],
        },
    ],
    records: [
        {
            title: 'Transaksi bank saat pinjaman disimpan',
            subtitle: 'Contoh dari pinjaman PT BPR Dana Makmur tadi, beserta asal setiap datanya.',
            rows: [
                { label: 'Jenis', value: 'Masuk (kredit)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Rekening', value: 'BCA - Operasional', source: 'Rekening Penerima', tone: 'pos' },
                { label: 'Tanggal', value: '12 Okt 2026', source: 'Tanggal Mulai', tone: 'pos' },
                { label: 'Jumlah', value: '+Rp 50.000.000', source: 'Jumlah Pokok', tone: 'pos' },
                { label: 'Kategori', value: 'Penerimaan Pinjaman', source: 'Otomatis', tone: 'neutral' },
                { label: 'Deskripsi', value: 'Penerimaan pinjaman dari PT BPR Dana Makmur', source: 'Otomatis', tone: 'neutral' },
                { label: 'Referensi', value: 'LOAN-00004', source: 'Nomor Pinjaman', tone: 'act' },
            ],
            note: 'Bunga tidak ikut dicatat di sini. Bunga baru menjadi transaksi saat dibayar lewat **Catat Pembayaran**.',
        },
        {
            title: 'Transaksi bank saat angsuran dibayar',
            subtitle: 'Satu angsuran Rp 10.000.000 pokok + Rp 1.000.000 bunga menjadi dua transaksi.',
            rows: [
                { label: 'Pokok', value: '−Rp 10.000.000 · Pembayaran pokok pinjaman - PT Bank Mandiri (Persero) Tbk', source: 'Pembayaran Pokok', tone: 'pos' },
                { label: 'Kategori pokok', value: 'Pembayaran Pokok Pinjaman (pendanaan)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Bunga', value: '−Rp 1.000.000 · Pembayaran bunga pinjaman - PT Bank Mandiri (Persero) Tbk', source: 'Pembayaran Bunga', tone: 'pos' },
                { label: 'Kategori bunga', value: 'Beban Bunga Pinjaman (beban)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Rekening & tanggal', value: 'BCA - Operasional · 12 Okt 2026', source: 'Dialog bayar', tone: 'pos' },
                { label: 'Referensi', value: 'KMK-261012', source: 'Nomor Referensi', tone: 'act' },
            ],
        },
    ],
    warnings: [
        {
            title: 'Edit & hapus tidak mengoreksi rekening',
            body: 'Mengubah Jumlah Pokok / Tanggal Mulai atau menghapus pinjaman tidak mengubah transaksi dana masuk yang sudah tercatat. Koreksi manual di Rekening Bank. Status juga tidak dihitung ulang saat Jumlah Pokok diubah.',
        },
        {
            title: 'Nominal bayar tidak dibatasi',
            body: 'Angka "maks." di label hanya informasi. Pokok yang melebihi sisa langsung membuat Lunas, dan seluruh nominal tetap tercatat keluar dari rekening.',
        },
        {
            title: 'Pembayaran & Lunas tidak bisa dibatalkan',
            body: 'Tidak ada tombol hapus pembayaran. Sisa pinjaman dihitung dari catatan pembayaran di modul ini, jadi menghapus transaksinya di Rekening Bank tidak mengembalikan sisa.',
        },
        {
            title: 'Bayar sisa bunga sebelum Lunas',
            body: 'Begitu sisa pokok habis, status Lunas dan **Catat Pembayaran** hilang. Sisa bunga yang belum dibayar tidak bisa dicatat lagi di modul ini.',
        },
        {
            title: 'Bunga perlu grup laba rugi',
            body: 'Bunga hanya dihitung di Laba Rugi bila kategori **Beban Bunga Pinjaman** sudah punya grup laba rugi. Bila belum, bunga muncul di panel Perlu Diklasifikasi.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat daftar pinjaman', cells: [false, true, true] },
        { action: 'Mencatat pinjaman baru', cells: [false, true, true] },
        { action: 'Mencatat angsuran', cells: [false, true, true] },
        { action: 'Mengubah pinjaman', cells: [false, 'Selama Aktif', 'Selama Aktif'] },
        { action: 'Menghapus pinjaman', cells: [false, 'Belum dibayar', 'Belum dibayar'] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
