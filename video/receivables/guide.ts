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
            cannot: ['Tidak bisa mengubah atau menghapus (ikonnya tampil, tetapi ditolak sistem)', 'Tidak bisa menyetujui atau mencatat cicilan'],
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
            { label: 'Menunggu persetujuan', tone: 'wait', role: ROLES.staff, what: 'Mengajukan' },
            { label: 'Aktif', tone: 'act', role: ROLES.fm, what: 'Setujui & cairkan dari rekening' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Mencatat cicilan sampai pokok habis' },
        ],
        branch: {
            from: 1,
            label: 'Ditolak',
            tone: 'late',
            title: 'Kembali ke pemohon',
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
                'Buka **Utang & Piutang › Piutang**, lalu klik **Tambah piutang**.',
                'Biarkan **Dipinjam oleh** = **Karyawan**, lalu pilih nama Anda di daftar **Karyawan**.',
                'Isi **Jumlah pokok**, lalu pilih **Cara hitung bunga**. **Persentase (%)**: **Suku bunga** adalah bunga flat atas seluruh pokok untuk seluruh masa pinjaman (bukan per tahun); kosongkan atau isi 0 bila tanpa bunga. **Nominal tetap**: isi total bunganya di **Jumlah bunga**.',
                'Isi **Jumlah cicilan (bulan)** dan **Tanggal pinjaman**. Cicilan per bulannya langsung terlihat di bawah form sebelum disimpan; jatuh tempo = tanggal pinjaman + jumlah bulan.',
                'Isi **Rekening atau cara pencairan** (rekening Anda untuk menerima dana) dan **Tujuan**. **Catatan** dan **Dokumen kontrak** opsional.',
                'Klik **Simpan draft**. Status menjadi **Draft**.',
            ],
        },
        {
            title: 'Mengajukan draft',
            role: ROLES.staff,
            steps: [
                'Klik baris berstatus **Draft** untuk membuka panel rincian, periksa jadwal angsurannya, lalu klik **Ajukan untuk persetujuan**.',
                'Di dialog **Ajukan piutang ini?**, klik **Ajukan**. Setelah diajukan, isinya tidak bisa diubah lagi selama menunggu keputusan.',
                'Status berubah menjadi **Menunggu persetujuan**. Bila ditolak, buka piutangnya: **Alasan penolakan** tampil paling atas di panel. Staff tidak bisa mengubah, jadi minta Finance manager merevisi atau buat pengajuan baru.',
            ],
        },
        {
            title: 'Menyetujui atau menolak',
            role: ROLES.fm,
            steps: [
                'Klik pil **Menunggu persetujuan** di atas tabel (angkanya menunjukkan berapa yang perlu diputuskan), lalu klik piutangnya untuk membuka panel rincian.',
                'Periksa jadwal angsuran yang diusulkan di panel, lalu klik **Proses pengajuan**.',
                'Pilih **Setujui**, tentukan **Rekening pencairan** (sumber dana, wajib — saldonya langsung berkurang), isi catatan bila perlu, lalu klik **Setujui & cairkan**. Status menjadi **Aktif**.',
                'Atau pilih **Tolak**, tulis **Alasan penolakan** (dibaca pemohon saat memperbaiki pengajuannya), lalu klik **Tolak pengajuan**.',
            ],
        },
        {
            title: 'Melihat jadwal angsuran',
            role: ROLES.fm,
            steps: [
                'Klik baris piutangnya. Panel rincian terbuka di sisi kanan berisi pokok, bunga, cicilan per bulan, progres pengembalian, dan **Jadwal angsuran**.',
                'Jadwalnya dibagi rata sepanjang masa cicilan. Termin yang jatuh temponya sudah lewat ditandai **lewat N hari**.',
                'Status per termin (**Lunas**, **Sebagian**, **Belum**) dihitung dengan menutup termin dari yang paling awal memakai pembayaran yang sudah masuk. Setiap pembayaran hanya mencatat pokok dan bunga, **tanpa nomor termin**, jadi sistem tidak bisa tahu satu pembayaran dimaksudkan untuk termin yang mana.',
                'Pada piutang yang belum disetujui, jadwalnya tetap bisa dilihat sebagai rencana, tetapi tidak ada termin yang ditandai "berikutnya" karena belum ada yang berjalan.',
            ],
        },
        {
            title: 'Mencatat cicilan',
            role: ROLES.fm,
            steps: [
                'Klik baris piutang **Aktif** untuk membuka panel rincian, lalu klik **Catat pembayaran**.',
                'Pilih **Cara membayar**: **Transfer** (lalu pilih **Rekening penerima**), **Kas**, atau **Potong gaji**. Kas dan potong gaji tidak menyentuh rekening bank, jadi pilihan rekeningnya tidak muncul.',
                'Isi **Tanggal pembayaran** (tidak boleh setelah hari ini), **Pembayaran pokok** dan/atau **Pembayaran bunga** (minimal salah satu), dan **Nomor referensi** bila ada. Totalnya terlihat di kiri bawah panel.',
                'Klik **Simpan pembayaran**. Progres dan jadwal angsuran langsung menyesuaikan; bila sisa pokok habis, status menjadi **Lunas**.',
            ],
        },
        {
            title: 'Merevisi, menghapus, dan piutang perusahaan',
            role: ROLES.fm,
            steps: [
                'Ikon **Ubah** untuk piutang **Draft** atau **Ditolak**. Setelah **Simpan Perubahan**, statusnya kembali **Draft** dan alasan penolakan dihapus; ajukan ulang.',
                'Ikon **Hapus** hanya untuk **Draft**. Pengajuan **Ditolak** tidak bisa langsung dihapus: Ubah dulu (statusnya kembali Draft), baru hapus.',
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
                { label: 'Jenis', value: 'Uang keluar', source: 'Otomatis', tone: 'neutral' },
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
