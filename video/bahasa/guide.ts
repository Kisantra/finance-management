import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan mengganti bahasa tampilan (Indonesia · English · 中文) — lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'bahasa',
    title: 'Ganti Bahasa',
    group: 'Pengaturan',
    order: 20,
    path: '/dashboard',
    summary:
        'Aplikasi bisa ditampilkan dalam **Bahasa Indonesia**, **English**, atau **中文 (Mandarin)**. Pilih bahasanya lewat tombol kode bahasa (mis. **ID**) di kanan atas; pilihan tersimpan di akun Anda, jadi ikut terbawa di perangkat lain. Yang berganti hanya tampilan: dokumen PDF dan Excel, data yang Anda ketik, serta panduan ini tetap dalam Bahasa Indonesia.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Setiap pengguna',
            can: ['Memilih bahasa tampilan untuk akunnya sendiri', 'Memilih bahasa di halaman masuk sebelum login'],
            cannot: ['Tidak mengubah bahasa pengguna lain'],
        },
        {
            role: ROLES.fm,
            who: 'Setiap pengguna',
            can: ['Sama seperti Staff: bahasa berlaku untuk akunnya sendiri'],
        },
        {
            role: ROLES.admin,
            who: 'Setiap pengguna',
            can: ['Sama seperti Staff: bahasa berlaku untuk akunnya sendiri'],
        },
    ],
    tasks: [
        {
            title: 'Mengganti bahasa setelah masuk',
            role: ROLES.staff,
            steps: [
                'Klik tombol bahasa di kanan atas, di samping lonceng notifikasi. Tombol ini menampilkan kode bahasa aktif, mis. **ID**.',
                'Pilih **Indonesia**, **English**, atau **中文**.',
                'Halaman dimuat ulang dalam bahasa baru: menu, tombol, judul, dan pesan semuanya berganti.',
                'Pilihan tersimpan di akun Anda. Saat masuk lagi, termasuk dari perangkat lain, aplikasi langsung tampil dalam bahasa itu.',
            ],
        },
        {
            title: 'Memilih bahasa di halaman masuk',
            role: ROLES.staff,
            steps: [
                'Di halaman **Masuk**, klik tombol bahasa di kanan atas formulir lalu pilih bahasanya.',
                'Saat Anda masuk, pilihan itu otomatis disimpan ke akun Anda.',
            ],
        },
        {
            title: 'Yang tetap dalam Bahasa Indonesia',
            role: ROLES.staff,
            steps: [
                '**Dokumen**: PDF invoice, rekap Excel/PDF, dan isi template selalu dalam Bahasa Indonesia, apa pun bahasa tampilan Anda.',
                '**Data yang diketik**: nama klien, nama kategori, deskripsi transaksi, dan nomor dokumen tampil apa adanya.',
                '**Panduan & video tutorial** ini tersedia dalam Bahasa Indonesia.',
                'Format angka dan Rupiah tetap sama di semua bahasa, mis. **Rp 1.500.000**.',
            ],
        },
    ],
    matrix: [{ action: 'Mengganti bahasa akun sendiri', cells: [true, true, true] }],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
};
