import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'fund-requests',
    title: 'Pengajuan Dana',
    group: 'Operasional',
    order: 20,
    path: '/fund-requests',
    permission: 'view fund requests',
    summary:
        'Pengajuan dana operasional **sebelum** uangnya dipakai: karyawan merinci kebutuhan per item biaya, finance meninjau, lalu mencairkan dananya dari rekening bank perusahaan. Setiap item yang dicairkan otomatis tercatat sebagai pengeluaran.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pemohon',
            can: [
                'Membuat pengajuan berisi satu atau beberapa item biaya + lampiran',
                'Menyimpan sebagai draft atau langsung mengajukan',
                'Mengubah & menghapus pengajuan miliknya selama masih Draft atau Ditolak',
            ],
            cannot: ['Hanya melihat pengajuan sendiri', 'Tidak bisa menyetujui atau mencairkan'],
        },
        {
            role: ROLES.fm,
            who: 'Peninjau & pencair',
            can: [
                'Melihat pengajuan semua karyawan (tab Semua Pengajuan)',
                'Menyetujui atau menolak pengajuan yang Menunggu persetujuan',
                'Mencairkan dana pengajuan Disetujui dari rekening bank',
                'Juga bisa membuat pengajuan sendiri',
            ],
            cannot: ['Tidak bisa mengubah pengajuan orang lain', 'Menghapus hanya yang masih Draft / Ditolak'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: [
                'Semua yang bisa dilakukan Finance manager',
                'Mengubah pengajuan Draft / Ditolak milik siapa pun',
                'Menghapus pengajuan di status apa pun, termasuk yang sudah Dicairkan',
            ],
        },
    ],
    flow: {
        steps: [
            { label: 'Draft', tone: 'neutral', role: ROLES.staff, what: 'Menyimpan rincian item' },
            { label: 'Menunggu persetujuan', tone: 'wait', role: ROLES.staff, what: 'Mengajukan' },
            { label: 'Disetujui', tone: 'act', role: ROLES.fm, what: 'Menyetujui' },
            { label: 'Dicairkan', tone: 'pos', role: ROLES.fm, what: 'Mencairkan dari rekening' },
        ],
        branch: { from: 1, label: 'Ditolak', tone: 'late', title: 'Berhenti di sini', down: 'Finance manager menolak, sebaiknya dengan catatan' },
        note: '**Ditolak?** Pengajuan Ditolak tidak bisa diajukan ulang. Buat pengajuan baru.',
    },
    tasks: [
        {
            title: 'Membuat pengajuan dana',
            role: ROLES.staff,
            steps: [
                'Buka **Operasional › Pengajuan Dana**, lalu klik **Buat Pengajuan**.',
                '**Nomor Pengajuan** terisi otomatis (mis. 001/KSN/X/2026) dan boleh diubah. Bila saat menyimpan muncul pesan nomor sudah dipakai, naikkan nomor urutnya.',
                'Isi **Judul**, pilih **Prioritas** (Rendah, Sedang, Tinggi, Mendesak) dan **Dibutuhkan Sebelum** (paling cepat hari ini; tanggal lampau ditolak saat menyimpan), lalu tulis **Tujuan / Keterangan**.',
                'Lampirkan penawaran atau nota bila ada (JPG, PNG, atau PDF, maksimal 5 MB).',
                'Di **Item Biaya**, isi **Nama Item**, **Kategori**, **Qty**, dan **Harga Satuan**. Klik **Tambah** untuk item berikutnya. Total dihitung otomatis.',
                'Klik **Simpan Draft** bila belum lengkap, atau **Ajukan** untuk mengirim ke peninjau. Status menjadi **Menunggu persetujuan**.',
            ],
        },
        {
            title: 'Mengajukan draft',
            role: ROLES.staff,
            steps: [
                'Di daftar, pengajuan berstatus **Draft** milik Anda punya tombol **Ajukan**.',
                'Klik **Ajukan**, lalu konfirmasi. Setelah diajukan, isinya tidak bisa diubah lagi.',
            ],
        },
        {
            title: 'Bila pengajuan ditolak',
            role: ROLES.staff,
            steps: [
                'Klik pengajuan berstatus **Ditolak** untuk membaca **Catatan peninjau** dari peninjau.',
                'Pengajuan yang ditolak **tidak bisa diajukan ulang**: tombol **Ubah** hanya mengubah isinya, statusnya tetap Ditolak.',
                'Buat pengajuan baru dengan isi yang sudah diperbaiki. Yang lama boleh dihapus lewat ikon tempat sampah.',
            ],
        },
        {
            title: 'Meninjau pengajuan',
            role: ROLES.fm,
            steps: [
                'Tab **Semua Pengajuan** terbuka otomatis. Saring dengan **Status** = Menunggu persetujuan, **Prioritas**, atau **Pemohon**.',
                'Klik baris pengajuan untuk membuka detail: tujuan, lampiran, dan rincian item biaya.',
                'Klik **Setujui** atau **Tolak**, isi **Catatan peninjau** (opsional, tetapi sebaiknya selalu diisi saat menolak), lalu konfirmasi.',
            ],
        },
        {
            title: 'Mencairkan dana',
            role: ROLES.fm,
            steps: [
                'Pada pengajuan **Disetujui**, klik **Cairkan** di daftar (atau **Cairkan Dana** di detail).',
                'Pilih **Rekening Bank** sumber dana; saldonya ikut tampil. Aplikasi tidak memeriksa apakah saldonya cukup, jadi periksa sendiri.',
                '**Tanggal Pencairan** terisi hari ini dan tidak boleh setelah hari ini.',
                'Isi **Catatan Pencairan** (mis. nomor referensi transfer) dan lampirkan **Bukti Pembayaran** bila ada, lalu klik **Cairkan Dana**. Status menjadi **Dicairkan**.',
            ],
        },
        {
            title: 'Mengubah & menghapus pengajuan siapa pun',
            role: ROLES.admin,
            steps: [
                'Admin bisa mengubah pengajuan **Draft** / **Ditolak** milik siapa pun lewat ikon pensil.',
                'Admin bisa menghapus pengajuan di status apa pun lewat ikon tempat sampah, lalu **Hapus**. Lihat bagian Perhatian sebelum menghapus yang sudah Dicairkan.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat diajukan & disetujui',
            tone: 'act',
            items: [
                'Diajukan: masuk antrean peninjau dan badge menu **Operasional** bertambah untuk yang bisa menyetujui.',
                'Disetujui: peninjau, waktu, dan catatannya tersimpan; badge kini muncul untuk yang bisa mencairkan.',
                '**Belum ada uang keluar**: saldo rekening dan laporan belum berubah.',
            ],
        },
        {
            title: 'Saat dicairkan',
            tone: 'pos',
            items: [
                '**1 transaksi bank keluar per item biaya**. Dua item berarti dua transaksi.',
                'Saldo rekening sumber langsung berkurang sebesar total pengajuan.',
                'Tampil di **Arus Kas › Pengeluaran** dengan kategori masing-masing item.',
                'Masuk **Laba Rugi** pada bulan Tanggal Pencairan, sesuai grup laba rugi kategorinya.',
                'Bukti pembayaran yang sama dilampirkan ke semua transaksi itu; status menjadi Dicairkan.',
            ],
        },
    ],
    records: [
        {
            title: 'Isi transaksi bank yang dibuat otomatis',
            subtitle: 'Satu baris per item. Contoh item pertama dari pengajuan tadi.',
            rows: [
                { label: 'Jenis', value: 'Uang keluar', source: 'Otomatis', tone: 'neutral' },
                { label: 'Rekening', value: 'BCA - Operasional', source: 'Dialog Cairkan', tone: 'pos' },
                { label: 'Tanggal', value: '12 Okt 2026 (Tanggal Pencairan)', source: 'Dialog Cairkan', tone: 'pos' },
                { label: 'Jumlah', value: '−Rp 875.000 (25 × Rp 35.000)', source: 'Item biaya', tone: 'act' },
                { label: 'Kategori', value: 'MAKAN MINUM', source: 'Item biaya', tone: 'act' },
                { label: 'Deskripsi', value: 'Pencairan Dana: Konsumsi & ATK pelatihan pajak klien - Snack box peserta pelatihan', source: 'Otomatis', tone: 'neutral' },
                { label: 'Referensi', value: 'BCA 1012-0458', source: 'Catatan Pencairan', tone: 'pos' },
            ],
            note: 'Kategori dipilih **pemohon** per item dan tidak bisa diubah saat menyetujui. Periksa sebelum menyetujui.',
        },
    ],
    warnings: [
        { title: 'Periksa kategori tiap item sebelum menyetujui', body: 'Kategori item langsung menjadi kategori pengeluaran di Arus Kas dan baris di Laba Rugi. Peninjau tidak bisa mengubahnya; tolak bila salah.' },
        { title: 'Jangan awali Catatan Pencairan dengan "TRF"', body: 'Catatan ini menjadi nomor referensi transaksi. Referensi berawalan TRF dianggap transfer antar rekening: menghapus satu transaksi ikut menghapus semua transaksi lain dengan referensi yang sama.' },
        { title: 'Menghapus pengajuan Dicairkan tidak mengembalikan uang', body: 'Transaksi pengeluaran dan saldo rekening tetap seperti semula. Bila pencairan memang dibatalkan, koreksi juga transaksinya di Arus Kas.' },
        { title: 'Pencairan tidak bisa dibatalkan dari modul ini', body: 'Tidak ada tombol batal cair. Menghapus atau mengubah transaksinya di Arus Kas juga tidak mengubah status pengajuan, yang tetap Dicairkan.' },
        { title: 'Finance manager bisa menyetujui pengajuannya sendiri', body: 'Tidak ada pengecekan pemohon saat menyetujui atau mencairkan. Bila perlu pemisahan tugas, tinjau pengajuan finance manager secara terpisah.' },
        { title: 'Menghapus rekening atau pengguna memutus jejaknya', body: 'Hapus rekening: semua transaksinya, termasuk hasil pencairan, ikut terhapus; status pengajuan tetap Dicairkan. Hapus pengguna: semua pengajuan dananya ikut terhapus, transaksi pencairannya tetap.' },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Membuat & mengajukan pengajuan', cells: [true, true, true] },
        { action: 'Mengubah Draft / Ditolak', cells: ['Milik sendiri', 'Milik sendiri', 'Semua'] },
        { action: 'Melihat pengajuan semua karyawan', cells: [false, true, true] },
        { action: 'Menyetujui / menolak', cells: [false, true, true] },
        { action: 'Mencairkan dana', cells: [false, true, true] },
        { action: 'Menghapus pengajuan', cells: ['Draft / Ditolak miliknya', 'Draft / Ditolak', 'Semua status'] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
