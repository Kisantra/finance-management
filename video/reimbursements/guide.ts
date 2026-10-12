import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Contoh acuan untuk modul lain: lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'reimbursements',
    title: 'Reimbursement',
    group: 'Operasional',
    path: '/reimbursements',
    permission: 'view reimbursements',
    summary:
        'Penggantian biaya yang dibayar karyawan lebih dulu untuk keperluan kantor: karyawan mengajukan dengan bukti, finance meninjau, lalu membayar (boleh dicicil) dari rekening bank perusahaan.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pemohon',
            can: ['Mencatat biaya + mengunggah struk', 'Mengajukan untuk ditinjau', 'Memperbaiki & mengajukan ulang bila ditolak', 'Menghapus draft / pengajuan ditolak miliknya'],
            cannot: ['Hanya melihat pengajuan sendiri'],
        },
        {
            role: ROLES.fm,
            who: 'Peninjau & pembayar',
            can: ['Melihat pengajuan semua karyawan', 'Menyetujui (pilih kategori akuntansi) atau menolak dengan alasan', 'Membayar lunas atau dicicil dari rekening bank', 'Juga bisa mengajukan reimbursement sendiri'],
            cannot: ['Tidak bisa menghapus pengajuan'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Menghapus pengajuan siapa pun yang belum dibayar'],
        },
    ],
    flow: {
        steps: [
            { label: 'Draft', tone: 'neutral', role: ROLES.staff, what: 'Mencatat biaya + struk' },
            { label: 'Menunggu review', tone: 'wait', role: ROLES.staff, what: 'Mengajukan' },
            { label: 'Disetujui', tone: 'act', role: ROLES.fm, what: 'Menyetujui + pilih kategori' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Membayar dari rekening' },
        ],
        branch: { from: 1, label: 'Ditolak', tone: 'late', title: 'Kembali ke pemohon', down: 'Finance manager menolak, wajib dengan alasan', up: 'Staff memperbaiki, lalu mengajukan ulang' },
        note: '**Dicicil?** Status tetap Disetujui sampai seluruh nominal terbayar.',
    },
    tasks: [
        {
            title: 'Mengajukan reimbursement',
            role: ROLES.staff,
            steps: [
                'Buka **Operasional › Reimbursement**, lalu klik **Buat pengajuan**.',
                'Isi **Judul** (untuk apa biayanya), **Nominal** sesuai struk, **Tanggal pengeluaran**, dan **Kategori** biaya.',
                'Tambahkan keterangan bila perlu dan unggah foto struk (JPG, PNG, atau PDF, maksimal 5 MB).',
                'Klik **Simpan draft** bila belum lengkap, atau **Ajukan** untuk mengirim ke peninjau. Status menjadi **Menunggu review**.',
            ],
        },
        {
            title: 'Memperbaiki pengajuan yang ditolak',
            role: ROLES.staff,
            steps: [
                'Buka pengajuan berstatus **Ditolak** dan baca alasan dari peninjau.',
                'Klik **Perbaiki & ajukan ulang**, ubah isinya, lalu **Ajukan ulang**. Status kembali **Menunggu review**.',
            ],
        },
        {
            title: 'Meninjau pengajuan',
            role: ROLES.fm,
            steps: [
                'Pilih **Semua pengajuan**, lalu filter **Menunggu review**.',
                'Klik pengajuan untuk membuka detail; periksa nominal, rincian, dan foto bukti.',
                'Klik **Setujui** dan pilih **Kategori akuntansi** (catatan opsional), atau klik **Tolak** dan tulis alasannya.',
            ],
        },
        {
            title: 'Membayar reimbursement',
            role: ROLES.fm,
            steps: [
                'Buka pengajuan berstatus **Disetujui**, lalu klik **Bayar**.',
                'Pilih **Rekening sumber** (saldonya ikut tampil) dan **Tanggal bayar** (tidak boleh setelah hari ini).',
                '**Nominal** terisi sisa tagihan. Isi lebih kecil untuk mencicil; tidak bisa melebihi sisa.',
                'Isi nomor referensi transfer (opsional), lalu klik **Bayar lunas** atau **Bayar sebagian**.',
            ],
        },
        {
            title: 'Menghapus pengajuan',
            role: ROLES.admin,
            steps: [
                'Buka pengajuan, klik menu **•••**, lalu **Hapus pengajuan**.',
                'Hanya bisa selama belum ada pembayaran. Staff hanya bisa menghapus draft / pengajuan ditolak miliknya sendiri.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat disetujui',
            tone: 'act',
            items: [
                'Status menjadi Disetujui; peninjau, waktu, dan catatannya masuk riwayat.',
                'Kategori akuntansi disimpan, dan baru dipakai saat pembayaran dicatat.',
                '**Belum ada uang keluar**: saldo rekening dan laporan belum berubah.',
                'Masuk antrean bayar: badge di menu Operasional bertambah.',
            ],
        },
        {
            title: 'Saat dibayar',
            tone: 'pos',
            items: [
                '**1 transaksi bank keluar** per pembayaran. Dicicil 2× berarti 2 transaksi.',
                'Saldo rekening sumber langsung berkurang.',
                'Tampil di Arus Kas › Pengeluaran dengan kategori akuntansinya.',
                'Masuk Laba Rugi sesuai grup kategori, mis. Beban Operasional.',
                'Sisa berkurang; bila sudah penuh, status menjadi Lunas.',
            ],
        },
    ],
    records: [
        {
            title: 'Isi transaksi bank yang dibuat otomatis',
            subtitle: 'Contoh dari pembayaran tadi, beserta asal setiap datanya.',
            rows: [
                { label: 'Jenis', value: 'Keluar (debit)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Rekening', value: 'BCA - Operasional', source: 'Dialog Bayar', tone: 'pos' },
                { label: 'Tanggal', value: '11 Okt 2026 (tanggal bayar)', source: 'Dialog Bayar', tone: 'pos' },
                { label: 'Jumlah', value: '−Rp 185.000', source: 'Dialog Bayar', tone: 'pos' },
                { label: 'Kategori', value: 'OPERASIONAL', source: 'Dialog Setujui', tone: 'act' },
                { label: 'Deskripsi', value: 'Pelunasan Reimbursement: Taksi ke kantor PT Sinar Jaya - Staf Uji', source: 'Otomatis', tone: 'neutral' },
                { label: 'Referensi', value: 'TRF-2026-1011', source: 'Dialog Bayar', tone: 'pos' },
            ],
            note: 'Pembayaran sebagian memakai awalan **Cicilan**; pembayaran yang melunasi memakai **Pelunasan**.',
        },
    ],
    warnings: [
        { title: 'Pilih kategori akuntansi dengan teliti', body: 'Kategori ini menentukan baris di Arus Kas dan Laba Rugi. Salah kategori berarti laporannya ikut salah.' },
        { title: 'Jangan hapus atau ubah transaksi pembayarannya', body: 'Bila transaksi itu dihapus atau diubah di Arus Kas / Rekening, status dan sisa reimbursement tidak ikut kembali. Pengajuan tetap tercatat lunas.' },
        { title: 'Yang sudah dibayar tidak bisa dihapus', body: 'Termasuk oleh Admin. Hapus pengajuan hanya sebelum ada pembayaran.' },
        { title: 'Menghapus rekening bank menghapus semua transaksinya', body: 'Termasuk catatan pembayaran reimbursement dari rekening itu. Status reimbursement tidak ikut berubah.' },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Membuat & mengajukan pengajuan', cells: [true, true, true] },
        { action: 'Mengedit & mengajukan ulang (milik sendiri)', cells: [true, true, true] },
        { action: 'Melihat pengajuan semua karyawan', cells: [false, true, true] },
        { action: 'Menyetujui / menolak', cells: [false, true, true] },
        { action: 'Membayar (lunas / cicilan)', cells: [false, true, true] },
        { action: 'Menghapus pengajuan', cells: ['Draft / ditolak miliknya', false, 'Semua yang belum dibayar'] },
    ],
};
