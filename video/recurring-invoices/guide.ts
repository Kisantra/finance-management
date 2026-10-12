import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan modul Invoice Berulang. Lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'recurring-invoices',
    title: 'Invoice Berulang',
    group: 'Keuangan',
    order: 20,
    path: '/recurring-invoices',
    permission: 'view recurring-invoices',
    summary:
        'Tagihan rutin ke klien (bulanan, triwulanan, semesteran, tahunan) disusun sekali sebagai template. Setiap bulan, template yang jatuh tempo di-generate menjadi draft, diperiksa, lalu di-publish menjadi invoice draft di menu Invoice untuk dikirim. Menu ini hanya untuk Finance manager dan Admin.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola tagihan rutin',
            can: [
                'Membuat & mengubah template (klien, item, periode, frekuensi)',
                'Generate draft bulanan atau membuat draft manual',
                'Mengubah, menghapus, dan mem-publish draft',
                'Menghapus / mengarsipkan template, memulihkan arsip, melihat analitik',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Hak akses keduanya sama di modul ini'],
        },
    ],
    flow: {
        steps: [
            { label: 'Aktif', tone: 'neutral', role: ROLES.fm, what: 'Menyusun template: klien, item, periode, frekuensi' },
            { label: 'Draft', tone: 'wait', role: ROLES.fm, what: 'Generate tiap bulan, lalu periksa / sesuaikan' },
            { label: 'Published', tone: 'pos', role: ROLES.fm, what: 'Publish: jadi invoice draft di menu Invoice' },
            { label: 'Terkirim', tone: 'act', role: ROLES.fm, what: 'Kirim invoice di menu Invoice: dapat nomor resmi' },
        ],
        note: '**Tidak otomatis:** generate harus diklik setiap bulan. Template yang dihapus padahal sudah punya invoice terpublish hanya **diarsipkan**.',
    },
    tasks: [
        {
            title: 'Membuat template',
            role: ROLES.fm,
            steps: [
                'Buka **Keuangan › Invoice Berulang**, tab **Templates**, lalu klik **Buat Template**.',
                'Isi **Nama Template**, pilih **Klien**, lalu **Tanggal Mulai** dan **Tanggal Berakhir**. Tagihan pertama jatuh satu periode setelah Tanggal Mulai (mulai 1 Sep, bulanan → tagihan pertama Oktober).',
                'Pilih **Frekuensi**: Bulanan, Triwulanan (3 bln), Semesteran (6 bln), atau Tahunan.',
                'Di **Item Invoice**, pilih layanan lewat ikon kaca pembesar (katalog Layanan) atau ketik namanya. Isi **Qty** (bilangan bulat; desimal ditolak saat disimpan), **Satuan**, **Harga Sat.**, dan **HPP**. Centang **PPh** untuk item titipan pajak.',
                'Isi **Diskon** bila perlu, periksa ringkasan di kanan, lalu klik **Simpan Template**.',
            ],
        },
        {
            title: 'Generate draft bulanan',
            role: ROLES.fm,
            steps: [
                'Buka tab **Bulanan** dan pilih bulan dengan tombol panah.',
                'Klik **Generate Otomatis**, isi **Tanggal Terbit** dan **Jatuh Tempo**, lalu **Generate Sekarang**.',
                'Satu draft dibuat untuk setiap template aktif yang jatuh tempo di bulan itu. Template yang sudah punya baris di bulan itu (draft atau published) dilewati, jadi aman diklik ulang.',
                'Perlu tagihan di luar jadwal? Klik **Buat Manual**, pilih **Template** (wajib diisi walau berlabel opsional), atur **Tanggal Terjadwal**, lalu **Buat Invoice**. Satu template hanya boleh punya satu baris per bulan.',
            ],
        },
        {
            title: 'Menyesuaikan draft bulan ini',
            role: ROLES.fm,
            steps: [
                'Klik ikon pensil (**Edit**) pada baris draft.',
                'Ubah tanggal atau item khusus untuk bulan ini, lalu **Simpan Perubahan**. Template tidak ikut berubah.',
                'Draft yang tidak jadi ditagih bisa dihapus lewat ikon tempat sampah (**Hapus**) lalu konfirmasi. **Hapus** di bilah bawah (baris tercentang) langsung menghapus tanpa konfirmasi.',
            ],
        },
        {
            title: 'Publish menjadi invoice',
            role: ROLES.fm,
            steps: [
                'Klik ikon kirim (**Publish**) pada baris draft, periksa **Tanggal Terbit** dan **Jatuh Tempo**, lalu klik **Publish**.',
                'Untuk banyak draft sekaligus, centang barisnya, klik **Publish** di bilah bawah, isi tanggal (berlaku untuk semua yang dipilih), lalu **Publish**.',
                'Status menjadi **Published** dan muncul tautan **Draft · belum dikirim**. Buka tautan itu lalu klik **Kirim invoice** agar invoice mendapat nomor resmi.',
            ],
        },
        {
            title: 'Membaca analitik',
            role: ROLES.fm,
            steps: [
                'Tab **Analitik** menampilkan revenue per bulan atau triwulan, performa tiap template, dan perbandingan draft vs published.',
                'Angkanya dihitung dari draft dan published di modul ini, bukan dari pembayaran yang sudah diterima.',
            ],
        },
        {
            title: 'Mengarsipkan atau menghapus template',
            role: ROLES.admin,
            steps: [
                'Klik ikon tempat sampah pada kartu template, lalu konfirmasi.',
                'Template yang sudah punya invoice terpublish **diarsipkan** (tidak di-generate lagi; draft-nya yang belum dipublish tetap ada). Yang belum, **dihapus permanen** beserta semua draft-nya.',
                'Template arsip bisa diaktifkan lagi lewat ikon putar di filter **Diarsipkan**.',
                'Finance manager juga bisa melakukannya; hak aksesnya sama dengan Admin di modul ini.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat template disimpan & di-generate',
            tone: 'neutral',
            items: [
                'Belum ada invoice: template dan draft hanya tercatat di modul ini.',
                'Generate **menyalin** item template ke draft. Mengubah template sesudahnya tidak mengubah draft yang sudah ada.',
                'Ringkasan Bulanan dan Analitik ikut naik karena dihitung dari draft.',
                'Tidak ada transaksi bank, saldo, arus kas, atau laporan yang berubah.',
            ],
        },
        {
            title: 'Saat di-publish',
            tone: 'pos',
            items: [
                '**1 invoice berstatus Draft** dibuat di Keuangan › Invoice, tanpa nomor.',
                'Nama layanan, qty, harga, HPP, dan diskon disalin; **satuan & tanda titipan pajak tidak ikut**.',
                'Baris bulanan menjadi Published dan terkunci: tidak bisa diedit atau dihapus.',
                'Invoice draft belum dihitung di Total ditagih; nomor resmi diberikan saat **Kirim invoice**.',
                'Selama masih Draft, invoice ini ikut pengingat jatuh tempo (notifikasi H-3 & hari-H) untuk Admin dan Finance manager.',
            ],
        },
        {
            title: 'Saat dihapus',
            tone: 'late',
            items: [
                'Hapus draft: permanen, dan bulan itu bisa di-generate ulang.',
                'Hapus template tanpa invoice terpublish: template + semua draft-nya hilang.',
                'Template dengan invoice terpublish hanya diarsipkan; invoice yang sudah dibuat tidak tersentuh.',
            ],
        },
    ],
    records: [
        {
            title: 'Invoice yang dibuat saat publish',
            subtitle: 'Contoh dari draft "Retainer Pembukuan Bulanan" Oktober 2026, beserta asal datanya.',
            rows: [
                { label: 'Status', value: 'Draft, belum bernomor', source: 'Otomatis', tone: 'neutral' },
                { label: 'Klien', value: 'PT. Global Solusi Prima', source: 'Template', tone: 'act' },
                { label: 'Tanggal', value: '12 Okt 2026, jatuh tempo 11 Nov 2026', source: 'Dialog Publish', tone: 'pos' },
                { label: 'Item', value: 'Pembukuan & Lapor Pajak Bulanan, Maintenance website', source: 'Draft bulanan', tone: 'wait' },
                { label: 'Satuan', value: 'pcs (satuan "bulan" tidak ikut)', source: 'Bawaan', tone: 'late' },
                { label: 'Total', value: 'Rp 1.950.000 (HPP Rp 500.000)', source: 'Draft bulanan', tone: 'wait' },
                { label: 'Nomor', value: 'Diberikan saat Kirim invoice', source: 'Menu Invoice', tone: 'act' },
            ],
            note: 'Setelah dikirim, invoice mengikuti alur menu Invoice: pembayaran dicatat di sana, dan pembayaran itulah yang menambah saldo rekening, pemasukan Arus Kas, dan Laba Rugi.',
        },
    ],
    warnings: [
        { title: 'Generate tidak berjalan sendiri', body: 'Tidak ada jadwal otomatis. Bila **Generate Otomatis** tidak diklik, tagihan bulan itu tidak pernah dibuat.' },
        { title: 'Hindari Tanggal Mulai 29–31', body: 'Siklus dihitung dengan menambah bulan dari Tanggal Mulai. Mulai 31 Jan → siklus berikutnya 3 Mar, sehingga **Februari terlewat**. Pakai tanggal 1–28.' },
        { title: 'Titipan pajak & satuan hilang saat publish', body: 'Item titipan pajak menjadi item biasa (ikut Subtotal layanan) padahal Total invoice tidak memuat nilainya, dan satuan menjadi pcs. Periksa invoice hasil publish sebelum **Kirim invoice**.' },
        { title: 'Total di form ≠ total tersimpan', body: 'Form menambahkan titipan pajak ke Total, tetapi yang disimpan (dan tampil di kartu & tab Bulanan) tidak termasuk titipan pajak.' },
        { title: 'Menghapus invoice hasil publish', body: 'Baris Bulanan tetap Published tanpa tautan, tidak bisa dihapus, dan bulan itu **tidak bisa di-generate ulang** untuk template tersebut.' },
        { title: 'Menghapus klien menghapus templatenya', body: 'Template dan semua baris Bulanan milik klien itu ikut terhapus, termasuk yang sudah published. Invoice klien itu juga ikut terhapus.' },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat template, bulanan, analitik', cells: [false, true, true] },
        { action: 'Membuat & mengubah template', cells: [false, true, true] },
        { action: 'Generate / buat draft manual', cells: [false, true, true] },
        { action: 'Mengubah & menghapus draft', cells: [false, true, true] },
        { action: 'Publish (satuan / massal)', cells: [false, true, true] },
        { action: 'Mengarsipkan / menghapus template', cells: [false, true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
