import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan fitur Kas Kecil (jenis akun Kas di modul Kas & Bank) — lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'kas-kecil',
    title: 'Kas Kecil',
    group: 'Keuangan',
    order: 31,
    path: '/bank-accounts',
    permission: 'view bank-accounts',
    summary:
        'Uang tunai untuk belanja harian kantor (bensin, ATK, konsumsi) yang dipegang satu orang. Di aplikasi, kas kecil adalah akun berjenis **Kas** di menu **Kas & Bank**: punya **penanggung jawab** dan **plafon** (batas saldo). Setiap belanja dicatat sebagai pengeluaran dari kas itu, dan bila saldonya di bawah plafon, aplikasi menghitung kekurangannya dan menyediakan tombol **Isi ulang** dari rekening bank.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola kas',
            can: [
                'Menambah akun kas dengan penanggung jawab dan plafon',
                'Mencatat pengeluaran dan pemasukan kas',
                '**Isi ulang** kas kecil dari rekening bank',
                'Memantau Total Kas di Ringkasan Total',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memahami bahwa isi ulang adalah transfer, bukan pengeluaran'],
        },
    ],
    tasks: [
        {
            title: 'Menambah kas kecil',
            role: ROLES.fm,
            steps: [
                'Buka **Keuangan › Kas & Bank**, lalu klik **Tambah Akun**.',
                'Pada **Jenis** pilih **Kas**. Isian nomor rekening dan nama bank hilang karena kas tidak membutuhkannya.',
                'Isi **Nama Kas** (mis. "Kas Kecil Gudang"), pilih **Penanggung Jawab** (orang yang memegang uangnya), dan isi **Plafon** (mis. Rp 3.000.000). Plafon boleh dikosongkan.',
                'Isi **Saldo Awal** = uang tunai yang ada saat mulai dicatat, lalu klik **Tambah Kas**.',
            ],
        },
        {
            title: 'Mencatat belanja dari kas kecil',
            role: ROLES.fm,
            steps: [
                'Pilih akun kas di panel **Akun**, lalu klik **Pengeluaran**.',
                'Isi jumlah, pilih kategori biaya (mis. **BBM, Tol & Parkir**), tulis deskripsi, lalu simpan. Lampirkan foto nota bila ada.',
                'Saldo kas berkurang. Bila turun di bawah plafon, kartu kas menampilkan **Perlu isi ulang Rp …**.',
            ],
        },
        {
            title: 'Mengisi ulang kas kecil',
            role: ROLES.fm,
            steps: [
                'Pilih kas yang bertanda **Perlu isi ulang**. Di bawah namanya tertulis plafon dan kekurangannya.',
                'Klik **Isi ulang**. Dialog **Transfer Antar Rekening** terbuka dengan **Rekening Tujuan** = kas ini dan **Jumlah Transfer** = kekurangannya.',
                'Pilih **Rekening Sumber** (rekening bank asal uang) dan **Kategori** transfer, mis. **Antar Rekening Sendiri**, lalu periksa kotak **Jurnal**.',
                'Klik **Lakukan Transfer**. Saldo kas kembali penuh sesuai plafon dan tanda **Perlu isi ulang** hilang.',
            ],
        },
        {
            title: 'Memantau semua kas',
            role: ROLES.fm,
            steps: [
                'Kartu **Ringkasan Total** di Kas & Bank memisahkan **Total Bank** dan **Total Kas**.',
                'Setiap kartu kas menampilkan label **Kas**, nama penanggung jawabnya, dan saldo saat ini.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat belanja dicatat dari kas',
            tone: 'wait',
            items: [
                'Saldo kas berkurang, dan pengeluarannya tampil di **Arus Kas › Pengeluaran**.',
                'Masuk **Laba Rugi** sesuai kategori yang dipilih (mis. beban operasional).',
            ],
        },
        {
            title: 'Saat kas diisi ulang',
            tone: 'act',
            items: [
                'Ini **transfer**: saldo rekening sumber berkurang, saldo kas bertambah dengan jumlah yang sama.',
                'Bukan pengeluaran dan bukan pendapatan: **Laba Rugi tidak berubah**.',
            ],
        },
    ],
    records: [
        {
            title: 'Contoh isi ulang',
            subtitle: 'Kas Kecil Kantor dengan plafon Rp 5.000.000.',
            rows: [
                { label: 'Plafon', value: 'Rp 5.000.000', source: 'Diatur Finance manager', tone: 'act' },
                { label: 'Saldo sekarang', value: 'Rp 2.825.000', source: 'Dihitung', tone: 'neutral' },
                { label: 'Perlu isi ulang', value: 'Rp 2.175.000 (plafon − saldo)', source: 'Otomatis', tone: 'wait' },
                { label: 'Transfer', value: 'BCA - Operasional → Kas Kecil Kantor', source: 'Isi ulang', tone: 'act' },
                { label: 'Saldo setelahnya', value: 'Rp 5.000.000', source: 'Dihitung', tone: 'pos' },
            ],
        },
    ],
    warnings: [
        {
            title: 'Plafon dan penanggung jawab hanya informasi',
            body: 'Aplikasi tidak menolak pengeluaran saat saldo kas di bawah plafon, dan siapa pun yang punya izin bisa mencatat ke akun kas. Hitung uang fisiknya secara berkala.',
        },
        {
            title: 'Biaya admin isi ulang tidak masuk Laba Rugi',
            body: 'Biaya admin transfer ikut kategori transfer. Bila ingin tercatat sebagai beban, isi Biaya Admin Rp 0 lalu catat pengeluaran terpisah dengan kategori biaya bank.',
        },
    ],
    matrix: [
        { action: 'Menambah & mengubah akun kas', cells: [false, true, true] },
        { action: 'Mencatat pengeluaran kas', cells: [false, true, true] },
        { action: 'Isi ulang kas kecil', cells: [false, true, true] },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    insightRoles: ['admin', 'finance manager'],
};
