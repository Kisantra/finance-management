import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'loans',
    title: 'Utang',
    group: 'Utang & Piutang',
    order: 10,
    path: '/loans',
    permission: 'view loans',
    summary:
        'Utang perusahaan: pinjaman yang DITERIMA dari bank, koperasi, atau perorangan. Saat dicatat, dana pokok otomatis masuk ke rekening; setiap angsuran pokok dan bunga otomatis keluar dari rekening sampai utang lunas.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola utang',
            can: [
                'Mencatat utang baru + rekening penerima dana',
                'Mencatat angsuran pokok dan bunga',
                'Mengubah utang yang masih Aktif',
                'Menghapus utang yang belum pernah dibayar',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memantau dampaknya ke rekening, arus kas, dan laba rugi'],
            cannot: ['Staff tidak melihat menu Utang'],
        },
    ],
    flow: {
        steps: [
            { label: 'Aktif', tone: 'act', role: ROLES.fm, what: 'Mencatat utang, dana masuk ke rekening' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Membayar angsuran sampai sisa pokok habis' },
        ],
        note: '**Lunas otomatis** begitu sisa pokok habis. Tidak ada tombol tandai lunas, dan status tidak bisa kembali ke Aktif.',
    },
    tasks: [
        {
            title: 'Mencatat utang baru',
            role: ROLES.fm,
            steps: [
                'Buka **Utang & Piutang › Utang**, lalu klik **Tambah utang**.',
                '**Nomor utang** terisi otomatis (mis. LOAN-00004); boleh diubah asal belum dipakai. Isi **Pemberi pinjaman** dan **Jumlah pokok**.',
                'Pilih **Cara hitung bunga**: **Persentase (% per tahun)** lalu isi **Suku bunga**, atau **Nominal tetap** lalu isi **Jumlah bunga** (total bunga untuk seluruh tenor).',
                'Isi **Tenor (bulan)**. **Jatuh tempo** terisi otomatis dari **Tanggal mulai** + tenor, dan harus setelah tanggal mulai.',
                'Pilih rekening di **Rekening penerima pencairan** (wajib): dana pokok dicatat masuk ke rekening ini pada tanggal mulai.',
                'Isi **Tujuan pinjaman** dan unggah **Dokumen kontrak** bila ada (PDF, JPG, atau PNG, maksimal 5 MB), lalu klik **Simpan utang**.',
            ],
        },
        {
            title: 'Membayar angsuran',
            role: ROLES.fm,
            steps: [
                'Klik baris utangnya untuk membuka panel rincian di sisi kanan, lalu klik **Catat pembayaran**.',
                'Pilih **Rekening pembayaran** (saldonya ikut tampil) dan **Tanggal pembayaran** (tidak boleh setelah hari ini).',
                'Isi **Pembayaran pokok** dan/atau **Pembayaran bunga**; minimal salah satu harus lebih dari nol. Kolom **Pembayaran bunga** hanya muncul selama masih ada sisa bunga.',
                'Isi **Nomor referensi** transfer dan **Catatan** bila perlu, lalu klik **Simpan pembayaran**. Sisa pokok dan jadwal angsuran langsung menyesuaikan.',
            ],
        },
        {
            title: 'Melihat jadwal angsuran',
            role: ROLES.fm,
            steps: [
                'Klik baris utangnya. Panel rincian terbuka di sisi kanan berisi pokok, total bunga, angsuran per bulan, progres pelunasan, dan **Jadwal angsuran**.',
                'Jadwalnya adalah **rencana** yang dibagi rata sepanjang tenor. Termin bertanda biru adalah yang perlu dibayar berikutnya; yang jatuh temponya sudah lewat ditandai **lewat N hari**.',
                'Status per termin (**Lunas**, **Sebagian**, **Belum**) dihitung dengan menutup termin dari yang paling awal memakai pembayaran yang sudah masuk. Setiap pembayaran hanya mencatat pokok dan bunga, **tanpa nomor termin**, jadi sistem tidak bisa tahu satu pembayaran dimaksudkan untuk termin yang mana.',
                'Baris paling bawah menjumlahkan seluruh termin: angkanya selalu sama persis dengan pokok + bunga.',
            ],
        },
        {
            title: 'Mengubah atau menghapus utang',
            role: ROLES.fm,
            steps: [
                'Buka panel rincian dengan mengklik baris utangnya. Tombol **Edit** hanya ada selama utang **Aktif**; nomor utang dan rekening penerima tidak bisa diubah.',
                'Tombol **Hapus** hanya muncul bila belum ada pokok yang dibayar, dan penghapusan ditolak bila sudah ada pembayaran apa pun.',
                'Mengubah atau menghapus utang **tidak** mengoreksi transaksi dana masuk yang sudah tercatat di rekening.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat utang disimpan',
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
            title: 'Transaksi bank saat utang disimpan',
            subtitle: 'Contoh dari utang ke PT BPR Dana Makmur tadi, beserta asal setiap datanya.',
            rows: [
                { label: 'Jenis', value: 'Masuk (kredit)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Rekening', value: 'BCA - Operasional', source: 'Rekening Penerima', tone: 'pos' },
                { label: 'Tanggal', value: '12 Okt 2026', source: 'Tanggal Mulai', tone: 'pos' },
                { label: 'Jumlah', value: '+Rp 50.000.000', source: 'Jumlah Pokok', tone: 'pos' },
                { label: 'Kategori', value: 'Penerimaan Pinjaman', source: 'Otomatis', tone: 'neutral' },
                { label: 'Deskripsi', value: 'Penerimaan pinjaman dari PT BPR Dana Makmur', source: 'Otomatis', tone: 'neutral' },
                { label: 'Referensi', value: 'LOAN-00004', source: 'Nomor utang', tone: 'act' },
            ],
            note: 'Bunga tidak ikut dicatat di sini. Bunga baru menjadi transaksi saat dibayar lewat **Catat pembayaran**.',
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
            body: 'Mengubah Jumlah Pokok / Tanggal Mulai atau menghapus utang tidak mengubah transaksi dana masuk yang sudah tercatat. Koreksi manual di Rekening Bank. Status juga tidak dihitung ulang saat Jumlah Pokok diubah.',
        },
        {
            title: 'Nominal bayar tidak dibatasi',
            body: 'Angka "maks." di label hanya informasi. Pokok yang melebihi sisa langsung membuat Lunas, dan seluruh nominal tetap tercatat keluar dari rekening.',
        },
        {
            title: 'Pembayaran & Lunas tidak bisa dibatalkan',
            body: 'Tidak ada tombol hapus pembayaran. Sisa utang dihitung dari catatan pembayaran di modul ini, jadi menghapus transaksinya di Rekening Bank tidak mengembalikan sisa.',
        },
        {
            title: 'Bayar sisa bunga sebelum Lunas',
            body: 'Begitu sisa pokok habis, status Lunas dan **Catat pembayaran** hilang. Sisa bunga yang belum dibayar tidak bisa dicatat lagi di modul ini.',
        },
        {
            title: 'Bunga perlu grup laba rugi',
            body: 'Bunga hanya dihitung di Laba Rugi bila kategori **Beban Bunga Pinjaman** sudah punya grup laba rugi. Bila belum, bunga muncul di panel Perlu Diklasifikasi.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat daftar utang', cells: [false, true, true] },
        { action: 'Mencatat utang baru', cells: [false, true, true] },
        { action: 'Mencatat angsuran', cells: [false, true, true] },
        { action: 'Mengubah utang', cells: [false, 'Selama Aktif', 'Selama Aktif'] },
        { action: 'Menghapus utang', cells: [false, 'Belum dibayar', 'Belum dibayar'] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
