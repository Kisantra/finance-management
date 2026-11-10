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
        'Tagihan rutin ke klien (bulanan, triwulanan, semesteran, tahunan) disusun sekali sebagai template. Setiap bulan, template yang jatuh tempo dibuat menjadi draft, diperiksa, lalu dijadikan invoice draft di menu Invoice untuk diterbitkan. Menu ini hanya untuk Finance manager dan Admin.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola tagihan rutin',
            can: [
                'Membuat & mengubah template (klien, item, periode, frekuensi)',
                'Membuat draft bulanan otomatis atau draft manual',
                'Mengubah, menghapus, dan menjadikan draft sebagai invoice',
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
            { label: 'Draft', tone: 'wait', role: ROLES.fm, what: 'Buat draft tiap bulan, lalu periksa / sesuaikan' },
            { label: 'Dijadikan invoice', tone: 'pos', role: ROLES.fm, what: 'Jadikan Invoice: jadi invoice draft di menu Invoice' },
            { label: 'Terbit', tone: 'act', role: ROLES.fm, what: 'Terbitkan invoice di menu Invoice: dapat nomor resmi' },
        ],
        note: '**Tidak otomatis:** pembuatan draft harus diklik setiap bulan. Template yang dihapus padahal sudah menghasilkan invoice hanya **diarsipkan**.',
    },
    tasks: [
        {
            title: 'Membuat template',
            role: ROLES.fm,
            steps: [
                'Buka **Keuangan › Invoice Berulang**, tab **Template**, lalu klik **Buat Template**.',
                'Isi **Nama Template**, pilih **Klien**, lalu **Tanggal Mulai** dan **Tanggal Berakhir**. Tagihan pertama jatuh satu periode setelah Tanggal Mulai (mulai 1 Sep, bulanan → tagihan pertama Oktober).',
                'Pilih **Frekuensi**: Bulanan, Triwulanan (3 bln), Semesteran (6 bln), atau Tahunan.',
                'Di **Item Invoice**, pilih layanan lewat ikon kaca pembesar (katalog Layanan) atau ketik namanya. Isi **Qty** (bilangan bulat; desimal ditolak saat disimpan), **Satuan**, **Harga Sat.**, dan **HPP**. Centang **PPh** untuk item titipan pajak.',
                'Isi **Diskon** bila perlu, periksa ringkasan di kanan, lalu klik **Simpan Template**.',
            ],
        },
        {
            title: 'Membuat draft bulanan',
            role: ROLES.fm,
            steps: [
                'Buka tab **Bulanan** dan pilih bulan dengan tombol panah.',
                'Klik **Buat Draft Otomatis**, isi **Tanggal Invoice** dan **Jatuh Tempo**, lalu **Buat Sekarang**.',
                'Satu draft dibuat untuk setiap template aktif yang jatuh tempo di bulan itu. Template yang sudah punya baris di bulan itu (draft atau dijadikan invoice) dilewati, jadi aman diklik ulang.',
                'Perlu tagihan di luar jadwal? Klik **Buat Manual**, pilih **Template** (wajib diisi walau berlabel opsional), atur **Tanggal Terjadwal**, lalu **Buat Invoice**. Satu template hanya boleh punya satu baris per bulan.',
            ],
        },
        {
            title: 'Menyesuaikan draft bulan ini',
            role: ROLES.fm,
            steps: [
                'Klik ikon pensil (**Ubah**) pada baris draft.',
                'Ubah tanggal atau item khusus untuk bulan ini, lalu **Simpan Perubahan**. Template tidak ikut berubah.',
                'Draft yang tidak jadi ditagih bisa dihapus lewat ikon tempat sampah (**Hapus**) lalu konfirmasi. **Hapus** di bilah bawah (baris tercentang) langsung menghapus tanpa konfirmasi.',
            ],
        },
        {
            title: 'Menjadikan draft sebagai invoice',
            role: ROLES.fm,
            steps: [
                'Klik ikon kirim (**Jadikan Invoice**) pada baris draft, periksa **Tanggal Invoice** dan **Jatuh Tempo**, lalu klik **Jadikan Invoice**.',
                'Untuk banyak draft sekaligus, centang barisnya, klik **Jadikan Invoice** di bilah bawah, isi tanggal (berlaku untuk semua yang dipilih), lalu **Jadikan Invoice**.',
                'Status menjadi **Dijadikan invoice** dan muncul tautan **Draft · belum terbit**. Buka tautan itu lalu klik **Terbitkan invoice** agar invoice mendapat nomor resmi.',
            ],
        },
        {
            title: 'Membaca analitik',
            role: ROLES.fm,
            steps: [
                'Tab **Analitik** menampilkan pendapatan per bulan atau triwulan, performa tiap template, dan perbandingan draft vs dijadikan invoice.',
                'Angkanya dihitung dari draft dan invoice hasil draft di modul ini, bukan dari pembayaran yang sudah diterima.',
            ],
        },
        {
            title: 'Mengarsipkan atau menghapus template',
            role: ROLES.admin,
            steps: [
                'Klik ikon tempat sampah pada kartu template, lalu konfirmasi.',
                'Template yang sudah menghasilkan invoice **diarsipkan** (tidak dibuatkan draft lagi; draft-nya yang belum dijadikan invoice tetap ada). Yang belum, **dihapus permanen** beserta semua draft-nya.',
                'Template arsip bisa diaktifkan lagi lewat ikon putar di filter **Diarsipkan**.',
                'Finance manager juga bisa melakukannya; hak aksesnya sama dengan Admin di modul ini.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat template disimpan & draft dibuat',
            tone: 'neutral',
            items: [
                'Belum ada invoice: template dan draft hanya tercatat di modul ini.',
                'Pembuatan draft **menyalin** item template ke draft. Mengubah template sesudahnya tidak mengubah draft yang sudah ada.',
                'Ringkasan Bulanan dan Analitik ikut naik karena dihitung dari draft.',
                'Tidak ada transaksi bank, saldo, arus kas, atau laporan yang berubah.',
            ],
        },
        {
            title: 'Saat dijadikan invoice',
            tone: 'pos',
            items: [
                '**1 invoice berstatus Draft** dibuat di Keuangan › Invoice, tanpa nomor.',
                'Nama layanan, qty, harga, HPP, dan diskon disalin; **satuan & tanda titipan pajak tidak ikut**.',
                'Bila perusahaan **PKP** saat draft dijadikan invoice, invoice diberi **PPN** dari Tarif PPN dan Total invoice bertambah sebesar PPN (angka di kartu & tab Bulanan tetap tanpa PPN).',
                'Baris bulanan menjadi Dijadikan invoice dan terkunci: tidak bisa diubah atau dihapus.',
                'Invoice draft belum dihitung di Total ditagih; nomor resmi diberikan saat **Terbitkan invoice**.',
                'Selama masih Draft, invoice ini ikut pengingat jatuh tempo (notifikasi H-3 & hari-H) untuk Admin dan Finance manager.',
            ],
        },
        {
            title: 'Saat dihapus',
            tone: 'late',
            items: [
                'Hapus draft: permanen, dan bulan itu bisa dibuatkan draft ulang.',
                'Hapus template yang belum menghasilkan invoice: template + semua draft-nya hilang.',
                'Template yang sudah menghasilkan invoice hanya diarsipkan; invoice yang sudah dibuat tidak tersentuh.',
            ],
        },
    ],
    records: [
        {
            title: 'Invoice yang dibuat saat draft dijadikan invoice',
            subtitle: 'Contoh dari draft "Retainer Pembukuan Bulanan" Oktober 2026, beserta asal datanya.',
            rows: [
                { label: 'Status', value: 'Draft, belum bernomor', source: 'Otomatis', tone: 'neutral' },
                { label: 'Klien', value: 'PT. Global Solusi Prima', source: 'Template', tone: 'act' },
                { label: 'Tanggal', value: '12 Okt 2026, jatuh tempo 11 Nov 2026', source: 'Dialog Jadikan Invoice', tone: 'pos' },
                { label: 'Item', value: 'Pembukuan & Lapor Pajak Bulanan, Maintenance website', source: 'Draft bulanan', tone: 'wait' },
                { label: 'Satuan', value: 'pcs (satuan "bulan" tidak ikut)', source: 'Bawaan', tone: 'late' },
                { label: 'Total', value: 'Rp 1.950.000 (HPP Rp 500.000)', source: 'Draft bulanan', tone: 'wait' },
                { label: 'Nomor', value: 'Diberikan saat Terbitkan invoice', source: 'Menu Invoice', tone: 'act' },
            ],
            note: 'Setelah diterbitkan, invoice mengikuti alur menu Invoice: pembayaran dicatat di sana, dan pembayaran itulah yang menambah saldo rekening, pemasukan Arus Kas, dan Laba Rugi.',
        },
    ],
    warnings: [
        { title: 'Pembuatan draft tidak berjalan sendiri', body: 'Tidak ada jadwal otomatis. Bila **Buat Draft Otomatis** tidak diklik, tagihan bulan itu tidak pernah dibuat.' },
        { title: 'Hindari Tanggal Mulai 29–31', body: 'Siklus dihitung dengan menambah bulan dari Tanggal Mulai. Mulai 31 Jan → siklus berikutnya 3 Mar, sehingga **Februari terlewat**. Pakai tanggal 1–28.' },
        { title: 'Titipan pajak & satuan hilang saat dijadikan invoice', body: 'Item titipan pajak menjadi item biasa (ikut Subtotal layanan) padahal Total invoice tidak memuat nilainya, dan satuan menjadi pcs. Periksa invoice hasilnya sebelum **Terbitkan invoice**.' },
        { title: 'Total di form ≠ total tersimpan', body: 'Form menambahkan titipan pajak ke Total, tetapi yang disimpan (dan tampil di kartu & tab Bulanan) tidak termasuk titipan pajak.' },
        { title: 'Menghapus invoice hasil draft', body: 'Baris Bulanan tetap Dijadikan invoice tanpa tautan, tidak bisa dihapus, dan bulan itu **tidak bisa dibuatkan draft ulang** untuk template tersebut.' },
        { title: 'Menghapus klien menghapus templatenya', body: 'Template dan semua baris Bulanan milik klien itu ikut terhapus, termasuk yang sudah dijadikan invoice. Invoice klien itu juga ikut terhapus.' },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat template, bulanan, analitik', cells: [false, true, true] },
        { action: 'Membuat & mengubah template', cells: [false, true, true] },
        { action: 'Buat draft otomatis / manual', cells: [false, true, true] },
        { action: 'Mengubah & menghapus draft', cells: [false, true, true] },
        { action: 'Jadikan invoice (satuan / massal)', cells: [false, true, true] },
        { action: 'Mengarsipkan / menghapus template', cells: [false, true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
