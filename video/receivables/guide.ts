import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'receivables',
    title: 'Piutang',
    group: 'Utang & Piutang',
    order: 20,
    path: '/receivables',
    permission: 'view receivables',
    summary:
        'Pinjaman yang DIBERIKAN perusahaan kepada karyawan (kasbon) atau kepada klien perusahaan. Diajukan lebih dulu, disetujui dan dicairkan dari rekening oleh finance, lalu dicicil sampai lunas.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pemohon',
            can: ['Membuat pengajuan pinjaman (draft)', 'Mengajukan draft untuk disetujui', 'Melihat status & alasan penolakan'],
            cannot: ['Tidak bisa mengedit atau menghapus (ikonnya tampil, tetapi ditolak sistem)', 'Tidak bisa menyetujui atau mencatat cicilan'],
        },
        {
            role: ROLES.fm,
            who: 'Penyetuju & penagih',
            can: [
                'Menyetujui + mencairkan dari rekening, atau menolak dengan alasan',
                'Mencatat cicilan: transfer, kas, atau potong gaji',
                'Membuat piutang karyawan maupun perusahaan',
                'Merevisi draft / pengajuan ditolak, menghapus draft',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memantau dampaknya ke rekening, arus kas, dan laba rugi'],
        },
    ],
    flow: {
        steps: [
            { label: 'Draft', tone: 'neutral', role: ROLES.staff, what: 'Mengisi pengajuan, Simpan Draft' },
            { label: 'Menunggu', tone: 'wait', role: ROLES.staff, what: 'Mengajukan' },
            { label: 'Aktif', tone: 'act', role: ROLES.fm, what: 'Setujui & cairkan dari rekening' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Mencatat cicilan sampai pokok habis' },
        ],
        branch: {
            from: 1,
            label: 'Ditolak',
            tone: 'late',
            title: 'Kembali ke pengaju',
            down: 'Finance manager menolak dengan alasan',
            up: 'Finance manager / Admin merevisi → Draft, lalu diajukan ulang',
        },
        note: '**Dicicil?** Status tetap Aktif sampai seluruh pokok terbayar.',
    },
    tasks: [
        {
            title: 'Mengajukan pinjaman karyawan (kasbon)',
            role: ROLES.staff,
            steps: [
                'Buka **Utang & Piutang › Piutang**, lalu klik **Tambah Piutang**.',
                'Biarkan **Tipe Piutang** = **Pinjaman Karyawan**, lalu pilih nama Anda di **Karyawan**.',
                'Isi **Jumlah Pokok**, lalu pilih **Tipe Bunga**. **Persentase (%)**: **Suku Bunga (%)** adalah bunga flat atas pokok untuk seluruh masa pinjaman (bukan per tahun); kosongkan atau isi 0 bila tanpa bunga. **Tetap (fixed)**: isi total bunga di **Jumlah Bunga Tetap**.',
                'Isi **Jumlah Cicilan (bulan)** dan **Tanggal Pinjaman**. Cicilan per bulan = (pokok + bunga) ÷ jumlah bulan; jatuh tempo = tanggal pinjaman + jumlah bulan.',
                'Isi **Rekening/Cara Pencairan** (rekening Anda untuk menerima dana) dan **Tujuan**. **Catatan** dan **Dokumen Kontrak** opsional.',
                'Klik **Simpan Draft**. Status menjadi **Draft**.',
            ],
        },
        {
            title: 'Mengajukan draft',
            role: ROLES.staff,
            steps: [
                'Pada baris berstatus **Draft**, klik ikon **Ajukan** (pesawat kertas), atau buka detailnya lalu klik **Ajukan**.',
                'Di dialog **Ajukan Piutang?**, klik tombol kuning di kanan. Labelnya masih tertulis **Hapus**, tetapi yang dilakukan adalah mengajukan.',
                'Status berubah menjadi **Menunggu**. Bila ditolak, buka piutangnya untuk membaca **Alasan Penolakan**; staff tidak bisa mengedit, jadi minta Finance manager merevisi atau buat pengajuan baru.',
            ],
        },
        {
            title: 'Menyetujui atau menolak',
            role: ROLES.fm,
            steps: [
                'Pilih filter **Menunggu Persetujuan**, lalu klik piutang untuk membuka detailnya.',
                'Klik **Proses** (atau ikon jempol di baris).',
                'Pilih **✓ Setujui**, tentukan **Rekening Pencairan** (sumber dana, wajib), isi catatan bila perlu, lalu klik **Setujui & Cairkan**. Status menjadi **Aktif**.',
                'Atau pilih **✕ Tolak**, tulis **Alasan Penolakan**, lalu klik **Tolak**.',
            ],
        },
        {
            title: 'Mencatat cicilan',
            role: ROLES.fm,
            steps: [
                'Klik ikon **Catat Pembayaran** pada piutang **Aktif**, atau tombol **Catat Pembayaran** di detail.',
                'Pilih **Metode Pembayaran**: **Transfer Bank** (lalu pilih **Rekening** penerima), **Kas**, atau **Potongan Gaji**.',
                'Isi **Tanggal Pembayaran** (tidak boleh setelah hari ini), **Pembayaran Pokok** dan/atau **Pembayaran Bunga** (minimal salah satu), dan **Nomor Referensi** bila ada.',
                'Klik **Simpan Pembayaran**. Progres pembayaran bertambah; bila sisa pokok habis, status menjadi **Lunas**.',
            ],
        },
        {
            title: 'Merevisi, menghapus, dan piutang perusahaan',
            role: ROLES.fm,
            steps: [
                'Ikon **Edit** untuk piutang **Draft** atau **Ditolak**. Setelah **Simpan Perubahan**, statusnya kembali **Draft** dan alasan penolakan dihapus; ajukan ulang.',
                'Ikon **Hapus** hanya untuk **Draft**. Pengajuan **Ditolak** tidak bisa langsung dihapus: Edit dulu (statusnya kembali Draft), baru hapus.',
                'Untuk pinjaman ke klien, pilih **Pinjaman Perusahaan** lalu pilih di **Perusahaan** (klien bertipe perusahaan yang aktif).',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat disetujui & dicairkan',
            tone: 'act',
            items: [
                '**1 transaksi bank keluar** sebesar pokok dari Rekening Pencairan.',
                'Tanggalnya **hari persetujuan**, bukan Tanggal Pinjaman.',
                'Pendanaan: tidak tampil di Arus Kas › Pengeluaran dan tidak mengurangi laba, tetapi ikut kartu Pengeluaran di **Ringkasan** (dashboard).',
                'Status Aktif; penyetuju, waktu & catatan tersimpan (tidak tampil di halaman Piutang).',
            ],
        },
        {
            title: 'Cicilan lewat Transfer Bank',
            tone: 'pos',
            items: [
                'Pokok dan bunga menjadi **2 transaksi masuk** ke Rekening yang dipilih.',
                'Saldo rekening naik sebesar pokok + bunga; keduanya ikut kartu Pemasukan di **Ringkasan**.',
                '**Bunga** = pendapatan: tampil di Arus Kas › Pemasukan dan masuk Laba Rugi sesuai grup kategorinya.',
            ],
        },
        {
            title: 'Cicilan Kas / Potongan Gaji',
            tone: 'wait',
            items: [
                'Hanya mengurangi sisa piutang.',
                '**Tidak ada transaksi bank**: saldo rekening tidak berubah.',
                'Bunganya tidak masuk Arus Kas maupun Laba Rugi.',
            ],
        },
    ],
    records: [
        {
            title: 'Transaksi bank saat piutang dicairkan',
            subtitle: 'Contoh dari kasbon RCV-00003 tadi, beserta asal setiap datanya.',
            rows: [
                { label: 'Jenis', value: 'Keluar (debit)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Rekening', value: 'BCA - Operasional', source: 'Rekening Pencairan', tone: 'pos' },
                { label: 'Tanggal', value: '12 Okt 2026', source: 'Hari disetujui', tone: 'neutral' },
                { label: 'Jumlah', value: '−Rp 6.000.000', source: 'Jumlah Pokok', tone: 'act' },
                { label: 'Kategori', value: 'Piutang Diberikan', source: 'Otomatis', tone: 'neutral' },
                { label: 'Deskripsi', value: 'Piutang diberikan: RCV-00003 - Staf Uji', source: 'Otomatis', tone: 'neutral' },
                { label: 'Referensi', value: 'RCV-00003', source: 'Nomor piutang', tone: 'neutral' },
            ],
            note: '**Rekening/Cara Pencairan** yang diisi pemohon hanya informasi. Uang keluar dari rekening yang dipilih di dialog **Proses**.',
        },
        {
            title: 'Transaksi bank saat cicilan ditransfer',
            subtitle: 'Cicilan CV. Karya Bersama: Rp 5.000.000 pokok + Rp 300.000 bunga.',
            rows: [
                { label: 'Pokok', value: '+Rp 5.000.000 · Pembayaran piutang pokok: RCV-00001 - CV. Karya Bersama', source: 'Pembayaran Pokok', tone: 'pos' },
                { label: 'Kategori pokok', value: 'Pembayaran Piutang Diterima (pendanaan)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Bunga', value: '+Rp 300.000 · Pembayaran bunga piutang: RCV-00001 - CV. Karya Bersama', source: 'Pembayaran Bunga', tone: 'pos' },
                { label: 'Kategori bunga', value: 'Pendapatan Bunga (pendapatan)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Rekening & tanggal', value: 'BCA - Operasional · 12 Okt 2026', source: 'Dialog bayar', tone: 'pos' },
                { label: 'Referensi', value: 'TRF-KB-1012', source: 'Nomor Referensi', tone: 'act' },
            ],
        },
    ],
    warnings: [
        {
            title: 'Kas & potong gaji tidak tercatat di rekening',
            body: 'Pilih **Transfer Bank** bila uangnya memang masuk ke rekening. Saat Transfer Bank, pastikan **Rekening** terisi; bila kosong, cicilan tetap tercatat tanpa transaksi bank.',
        },
        {
            title: 'Semua pengguna melihat semua piutang',
            body: 'Siapa pun yang punya akses menu Piutang, termasuk Staff, melihat seluruh daftar: pinjaman karyawan lain dan klien ikut terlihat.',
        },
        {
            title: 'Nominal cicilan tidak dibatasi',
            body: 'Angka "maks." di label hanya informasi. Pokok yang melebihi sisa langsung membuat Lunas. Cicilan dan Lunas tidak bisa dibatalkan, dan setelah Lunas sisa bunga tidak bisa dicatat lagi.',
        },
        {
            title: 'Transaksi bank terpisah dari piutang',
            body: 'Mengubah atau menghapus transaksi pencairan/cicilan di Rekening Bank tidak mengubah status dan sisa piutang. Sisa dihitung dari catatan cicilan di modul ini.',
        },
        {
            title: 'Bunga perlu grup laba rugi',
            body: 'Bunga cicilan transfer hanya dihitung di Laba Rugi bila kategori **Pendapatan Bunga** sudah punya grup laba rugi. Bila belum, bunga muncul di panel Perlu Diklasifikasi.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat semua piutang', cells: [true, true, true] },
        { action: 'Membuat & mengajukan', cells: [true, true, true] },
        { action: 'Merevisi draft / ditolak', cells: [false, true, true] },
        { action: 'Menghapus draft', cells: [false, true, true] },
        { action: 'Menyetujui & mencairkan / menolak', cells: [false, true, true] },
        { action: 'Mencatat cicilan', cells: [false, true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
