import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'clients',
    title: 'Klien',
    group: 'Master Data',
    order: 10,
    path: '/clients',
    permission: 'view clients',
    summary:
        'Data induk pelanggan yang ditagih lewat invoice: perorangan atau perusahaan, lengkap dengan data pajak (NPWP, KPP, EFIN) dan kontak. Data klien dipakai oleh Invoice, Invoice Berulang, Arus Kas, dan Piutang.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pengelola data klien',
            can: ['Melihat daftar klien beserta jumlah invoice & tagihannya', 'Menambah klien baru', 'Mengubah data dan status klien'],
            cannot: ['Tidak bisa menghapus klien (tombol hapus tetap tampil, tetapi ditolak dengan layar 403)'],
        },
        {
            role: ROLES.fm,
            who: 'Sama dengan Staff',
            can: ['Melihat daftar klien beserta jumlah invoice & tagihannya', 'Menambah klien baru', 'Mengubah data dan status klien'],
            cannot: ['Tidak bisa menghapus klien'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Staff & Finance manager', 'Menghapus klien, beserta seluruh invoice dan pembayarannya'],
        },
    ],
    tasks: [
        {
            title: 'Menambah klien',
            role: ROLES.staff,
            steps: [
                'Buka **Master Data › Klien**, lalu klik **Tambah Klien**.',
                'Isi **Nama Klien** (wajib), pilih **Tipe Klien** (Individu atau Perusahaan) dan **Status** (Aktif atau Tidak Aktif).',
                'Isi **Email** (tidak boleh sama dengan klien lain) dan **Alamat**.',
                'Di **Data Pajak & Kontak**, isi **NPWP**, **KPP**, dan **EFIN** (masing-masing maksimal 20 karakter), lalu **PIC (Person in Charge)**, **Account Representative**, dan **No. HP AR**. Semua opsional.',
                'Klik **Simpan Klien**. Klien Aktif langsung bisa dipilih saat membuat invoice.',
            ],
        },
        {
            title: 'Mencari & membaca daftar klien',
            role: ROLES.staff,
            steps: [
                'Ketik di kolom cari untuk mencari nama, email, atau NPWP; saring dengan **Semua Tipe** dan **Semua Status**.',
                'Kolom **Invoice** menunjukkan jumlah invoice yang ditagihkan ke klien itu.',
                'Kolom **Finansial**: **Total** = jumlah semua invoice (termasuk draft dan yang dibatalkan); **outstanding** = total invoice yang belum Lunas, tanpa dikurangi pembayaran sebagian. Sisa tagihan pasti ada di **Keuangan › Invoice**.',
            ],
        },
        {
            title: 'Mengubah data atau menonaktifkan klien',
            role: ROLES.staff,
            steps: [
                'Klik ikon pensil pada baris klien. Dialog **Edit Klien** terbuka.',
                'Ubah datanya, lalu klik **Perbarui Klien**.',
                'Pilih **Tidak Aktif** untuk klien yang sudah tidak dilayani: klien tidak muncul lagi di pilihan invoice baru, tetapi invoice lamanya tetap ada.',
            ],
        },
        {
            title: 'Menghapus klien',
            role: ROLES.admin,
            steps: [
                'Klik ikon tempat sampah pada baris klien, lalu **Hapus Klien**.',
                'Semua invoice klien itu ikut terhapus dan tidak bisa dikembalikan. Bila klien hanya berhenti dilayani, pilih **Tidak Aktif** saja.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat klien ditambah atau diubah',
            tone: 'act',
            items: [
                'Klien **Aktif** bisa dipilih di invoice dan invoice berulang; klien **Perusahaan** yang aktif juga menjadi pilihan debitur di Piutang.',
                'Inisial nama klien menjadi bagian nomor invoice saat invoice dikirim (format bawaan memakai token {KLIEN}).',
                'Invoice lama ikut menampilkan data klien terbaru (detail & PDF), tetapi nomor invoice yang sudah terbit tidak berubah.',
                '**Tidak Aktif** hanya menyembunyikan klien dari pilihan; invoice, pembayaran, dan laporannya tetap.',
            ],
        },
        {
            title: 'Saat klien dihapus (Admin)',
            tone: 'neg',
            items: [
                'Semua invoice yang ditagihkan ke klien itu ikut terhapus, beserta item dan **pembayarannya**.',
                'Saldo rekening penerima turun dan pemasukannya hilang dari **Arus Kas › Pemasukan**.',
                '**Laba Rugi** bulan-bulan lalu ikut berubah karena pendapatan dari pembayaran itu hilang.',
                'Template dan draft invoice berulang klien itu ikut terhapus.',
                'Tidak ada tombol batal atau pemulihan. Bila invoice terhapus itu memegang nomor urut terakhir periodenya, nomor urut itu dipakai lagi oleh invoice berikutnya.',
            ],
        },
    ],
    records: [
        {
            title: 'Ke mana data klien dipakai',
            subtitle: 'Isi form klien dan tempat ia muncul di modul lain.',
            rows: [
                { label: 'Nama Klien', value: 'Invoice, PDF invoice, Arus Kas › Pemasukan, inisial nomor invoice', source: 'Form klien', tone: 'act' },
                { label: 'Tipe Klien', value: 'Perusahaan aktif = pilihan debitur di Piutang', source: 'Form klien', tone: 'act' },
                { label: 'Status', value: 'Aktif = muncul di pilihan invoice & invoice berulang baru', source: 'Form klien', tone: 'act' },
                { label: 'NPWP', value: 'Detail invoice & token template PDF', source: 'Form klien', tone: 'pos' },
                { label: 'Email, Alamat, PIC', value: 'Token template PDF invoice', source: 'Form klien', tone: 'pos' },
                { label: 'No. HP AR', value: 'Token "telepon klien" di template PDF', source: 'Form klien', tone: 'pos' },
                { label: 'Invoice & Finansial', value: 'Dihitung dari invoice klien; tidak bisa diisi manual', source: 'Otomatis', tone: 'neutral' },
            ],
            note: 'KPP, EFIN, dan Account Representative hanya disimpan sebagai catatan di halaman Klien.',
        },
    ],
    warnings: [
        { title: 'Hapus klien = hapus semua invoice & pembayarannya', body: 'Larangan hapus invoice yang sudah dibayar di modul Invoice dilewati. Saldo rekening, Arus Kas, dan Laba Rugi periode lalu ikut berubah. Untuk klien yang berhenti, pilih Tidak Aktif saja.' },
        { title: 'Item atas nama klien di invoice lain ikut hilang', body: 'Item invoice klien lain yang tercatat atas nama klien ini ikut terhapus, tetapi total invoice tersebut tidak dihitung ulang.' },
        { title: 'Piutang klien itu tidak ikut terhapus', body: 'Piutang yang debiturnya klien ini tetap ada, tetapi tidak lagi terhubung ke data klien.' },
        { title: '"Outstanding" bukan sisa tagihan pasti', body: 'Angkanya total invoice yang belum Lunas (termasuk draft dan yang dibatalkan), belum dikurangi pembayaran sebagian. Cek sisa sebenarnya di halaman Invoice.' },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat daftar klien', cells: [true, true, true] },
        { action: 'Menambah klien', cells: [true, true, true] },
        { action: 'Mengubah data & status klien', cells: [true, true, true] },
        { action: 'Menghapus klien (+ semua invoice-nya)', cells: [false, false, true] },
    ],
};
