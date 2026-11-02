import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'fund-requests',
    title: 'Permintaan Dana',
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
                'Membuat permintaan berisi satu atau beberapa item biaya + lampiran',
                'Menyimpan sebagai draft atau langsung mengajukan',
                'Mengubah & menghapus permintaan miliknya selama masih Draft atau Rejected',
            ],
            cannot: ['Hanya melihat permintaan sendiri', 'Tidak bisa menyetujui atau mencairkan'],
        },
        {
            role: ROLES.fm,
            who: 'Peninjau & pencair',
            can: [
                'Melihat permintaan semua karyawan (tab Semua Pengajuan)',
                'Menyetujui atau menolak permintaan Pending Review',
                'Mencairkan dana permintaan Approved dari rekening bank',
                'Juga bisa membuat permintaan sendiri',
            ],
            cannot: ['Tidak bisa mengubah permintaan orang lain', 'Menghapus hanya yang masih Draft / Rejected'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: [
                'Semua yang bisa dilakukan Finance manager',
                'Mengubah permintaan Draft / Rejected milik siapa pun',
                'Menghapus permintaan di status apa pun, termasuk yang sudah Disbursed',
            ],
        },
    ],
    flow: {
        steps: [
            { label: 'Draft', tone: 'neutral', role: ROLES.staff, what: 'Menyimpan rincian item' },
            { label: 'Pending Review', tone: 'wait', role: ROLES.staff, what: 'Mengajukan' },
            { label: 'Approved', tone: 'act', role: ROLES.fm, what: 'Menyetujui' },
            { label: 'Disbursed', tone: 'pos', role: ROLES.fm, what: 'Mencairkan dari rekening' },
        ],
        branch: { from: 1, label: 'Rejected', tone: 'late', title: 'Berhenti di sini', down: 'Finance manager menolak, sebaiknya dengan catatan' },
        note: '**Ditolak?** Permintaan Rejected tidak bisa diajukan ulang. Buat permintaan baru.',
    },
    tasks: [
        {
            title: 'Membuat permintaan dana',
            role: ROLES.staff,
            steps: [
                'Buka **Operasional › Permintaan Dana**, lalu klik **Buat Permintaan**.',
                '**Nomor Permintaan** terisi otomatis (mis. 001/KSN/X/2026) dan boleh diubah. Bila saat menyimpan muncul pesan nomor sudah dipakai, naikkan nomor urutnya.',
                'Isi **Judul**, pilih **Prioritas** (Low, Medium, High, Urgent) dan **Dibutuhkan Sebelum** (paling cepat hari ini; tanggal lampau ditolak saat menyimpan), lalu tulis **Tujuan / Keterangan**.',
                'Lampirkan penawaran atau nota bila ada (JPG, PNG, atau PDF, maksimal 5 MB).',
                'Di **Item Biaya**, isi **Nama Item**, **Kategori**, **Qty**, dan **Harga Satuan**. Klik **Tambah** untuk item berikutnya. Total dihitung otomatis.',
                'Klik **Simpan Draft** bila belum lengkap, atau **Ajukan** untuk mengirim ke peninjau. Status menjadi **Pending Review**.',
            ],
        },
        {
            title: 'Mengajukan draft',
            role: ROLES.staff,
            steps: [
                'Di daftar, permintaan berstatus **Draft** milik Anda punya tombol **Ajukan**.',
                'Klik **Ajukan**, lalu konfirmasi. Setelah diajukan, isinya tidak bisa diubah lagi.',
            ],
        },
        {
            title: 'Bila permintaan ditolak',
            role: ROLES.staff,
            steps: [
                'Klik permintaan berstatus **Rejected** untuk membaca **Catatan Review** dari peninjau.',
                'Permintaan yang ditolak **tidak bisa diajukan ulang**: tombol **Edit** hanya mengubah isinya, statusnya tetap Rejected.',
                'Buat permintaan baru dengan isi yang sudah diperbaiki. Yang lama boleh dihapus lewat ikon tempat sampah.',
            ],
        },
        {
            title: 'Meninjau permintaan',
            role: ROLES.fm,
            steps: [
                'Tab **Semua Pengajuan** terbuka otomatis. Saring dengan **Status** = Pending Review, **Prioritas**, atau **Pemohon**.',
                'Klik baris permintaan untuk membuka detail: tujuan, lampiran, dan rincian item biaya.',
                'Klik **Setujui** atau **Tolak**, isi **Catatan Review** (opsional, tetapi sebaiknya selalu diisi saat menolak), lalu konfirmasi.',
            ],
        },
        {
            title: 'Mencairkan dana',
            role: ROLES.fm,
            steps: [
                'Pada permintaan **Approved**, klik **Cairkan** di daftar (atau **Cairkan Dana** di detail).',
                'Pilih **Rekening Bank** sumber dana; saldonya ikut tampil. Aplikasi tidak memeriksa apakah saldonya cukup, jadi periksa sendiri.',
                '**Tanggal Pencairan** terisi hari ini dan tidak boleh setelah hari ini.',
                'Isi **Catatan Pencairan** (mis. nomor referensi transfer) dan lampirkan **Bukti Pembayaran** bila ada, lalu klik **Cairkan Dana**. Status menjadi **Disbursed**.',
            ],
        },
        {
            title: 'Mengubah & menghapus permintaan siapa pun',
            role: ROLES.admin,
            steps: [
                'Admin bisa mengubah permintaan **Draft** / **Rejected** milik siapa pun lewat ikon pensil.',
                'Admin bisa menghapus permintaan di status apa pun lewat ikon tempat sampah, lalu **Hapus**. Lihat bagian Perhatian sebelum menghapus yang sudah Disbursed.',
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
                'Saldo rekening sumber langsung berkurang sebesar total permintaan.',
                'Tampil di **Arus Kas › Pengeluaran** dengan kategori masing-masing item.',
                'Masuk **Laba Rugi** pada bulan Tanggal Pencairan, sesuai grup laba rugi kategorinya.',
                'Bukti pembayaran yang sama dilampirkan ke semua transaksi itu; status menjadi Disbursed.',
            ],
        },
    ],
    records: [
        {
            title: 'Isi transaksi bank yang dibuat otomatis',
            subtitle: 'Satu baris per item. Contoh item pertama dari permintaan tadi.',
            rows: [
                { label: 'Jenis', value: 'Keluar (debit)', source: 'Otomatis', tone: 'neutral' },
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
        { title: 'Menghapus permintaan Disbursed tidak mengembalikan uang', body: 'Transaksi pengeluaran dan saldo rekening tetap seperti semula. Bila pencairan memang dibatalkan, koreksi juga transaksinya di Arus Kas.' },
        { title: 'Pencairan tidak bisa dibatalkan dari modul ini', body: 'Tidak ada tombol batal cair. Menghapus atau mengubah transaksinya di Arus Kas juga tidak mengubah status permintaan, yang tetap Disbursed.' },
        { title: 'Finance manager bisa menyetujui permintaannya sendiri', body: 'Tidak ada pengecekan pemohon saat menyetujui atau mencairkan. Bila perlu pemisahan tugas, tinjau permintaan finance manager secara terpisah.' },
        { title: 'Menghapus rekening atau pengguna memutus jejaknya', body: 'Hapus rekening: semua transaksinya, termasuk hasil pencairan, ikut terhapus; status permintaan tetap Disbursed. Hapus pengguna: semua permintaan dananya ikut terhapus, transaksi pencairannya tetap.' },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Membuat & mengajukan permintaan', cells: [true, true, true] },
        { action: 'Mengubah Draft / Rejected', cells: ['Milik sendiri', 'Milik sendiri', 'Semua'] },
        { action: 'Melihat permintaan semua karyawan', cells: [false, true, true] },
        { action: 'Menyetujui / menolak', cells: [false, true, true] },
        { action: 'Mencairkan dana', cells: [false, true, true] },
        { action: 'Menghapus permintaan', cells: ['Draft / Rejected miliknya', 'Draft / Rejected', 'Semua status'] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
