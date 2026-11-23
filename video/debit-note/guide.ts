import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan fitur Debit Note (jenis dokumen di modul Invoice) — lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'debit-note',
    title: 'Debit Note',
    group: 'Keuangan',
    order: 13,
    path: '/invoices/create',
    permission: 'view invoices',
    summary:
        'Debit Note adalah tagihan untuk **meminta kembali uang yang sudah perusahaan keluarkan atas nama klien**, mis. PNBP pelabuhan, demurrage, atau overtime hari libur. Klien mengganti persis sebesar yang dibayar, tanpa PPN, dan uangnya **bukan pendapatan**. Debit Note dibuat dari menu **Invoice** (pilih jenis dokumen **Debit Note**), memakai urutan nomor yang sama dengan invoice, dan dibayar dengan cara yang sama. Hanya tersedia untuk perusahaan yang punya desain Debit Note dan sudah menyalakannya.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Penyusun Debit Note',
            can: [
                'Membuat Debit Note **talangan** atau **tagihan jasa**',
                'Menyimpan sebagai draft atau langsung **Simpan & terbitkan**',
            ],
            cannot: ['Tidak bisa mengubah Debit Note setelah tersimpan', 'Tidak bisa mengubah nomor saat menerbitkan'],
        },
        {
            role: ROLES.fm,
            who: 'Penerbit & penagih',
            can: [
                'Semua yang bisa dilakukan Staff',
                'Menerbitkan draft dan mengubah nomor sebelum terbit',
                'Mencatat pembayaran dari klien',
                'Mengembalikan ke draft untuk mengganti jenis atau kode',
                'Mencatat biaya yang dibayar ke negara di **Arus Kas**',
                'Menyalakan pilihan Debit Note di **Profil perusahaan**',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Pengatur perusahaan',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memahami dampak Debit Note ke rekening, jurnal, dan Laba Rugi'],
        },
    ],
    flow: {
        steps: [
            { label: 'Draft', tone: 'neutral', role: ROLES.staff, what: 'Pilih jenis Debit Note, isi item, Simpan draft' },
            { label: 'Terbit', tone: 'act', role: ROLES.staff, what: 'Simpan & terbitkan: dapat nomor DN' },
            { label: 'Sebagian', tone: 'wait', role: ROLES.fm, what: 'Klien membayar sebagian' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Klien mengganti seluruhnya' },
        ],
        note: 'Alurnya **sama dengan invoice**. Bedanya hanya judul dokumen, kode **DN** di nomor, dan cara uangnya dibukukan.',
    },
    tasks: [
        {
            title: 'Menyalakan Debit Note untuk perusahaan',
            role: ROLES.admin,
            steps: [
                'Buka menu akun di kanan atas › **Pengaturan** › **Profil perusahaan** (admin atau finance manager).',
                'Gulir ke bagian **Debit Note**, lalu centang **Perusahaan ini menerbitkan Debit Note**. Bagian ini hanya muncul untuk perusahaan yang punya desain Debit Note (saat ini PT Samboja Laju Utama, PT Berkah Andalan Samboja, PT Mitra Kellian Baruna, PT Bahtera Cipta Bersama, dan PT Abdi Ocean Energy).',
                'Klik **Simpan Perubahan**. Sejak itu editor invoice menampilkan pilihan **Jenis dokumen: Invoice / Debit Note**. Mematikannya lagi tidak menghapus Debit Note yang sudah ada.',
            ],
        },
        {
            title: 'Membuat Debit Note talangan',
            role: ROLES.staff,
            steps: [
                'Buka **Keuangan › Invoice**, lalu klik **Buat Invoice**.',
                'Pada **Jenis dokumen** pilih **Debit Note**. Judul halaman berubah menjadi **Buat Debit Note**.',
                'Isi **Kode jenis** sesuai biayanya, mis. **PNBP**, **DEM** (demurrage), atau **OT** (overtime). Petunjuk **Di nomor** langsung menunjukkan hasilnya, mis. `DN-PNBP`. Kode yang pernah dipakai muncul sebagai saran.',
                'Biarkan **Isi Debit Note** pada **Talangan** (pilihan bawaan). Artinya semua item adalah biaya yang diganti klien: tanpa PPN, tanpa potongan PPh 23, dan tidak dihitung pendapatan.',
                'Pilih **Klien** dan isi **Perihal**, mis. "Penggantian biaya PNBP jasa labuh MV. CONTOH JAYA".',
                'Di baris item, ketik nama biayanya dan **Harga satuan** persis sebesar yang perusahaan bayar. Klik **Tambah keterangan** untuk bukti pembayarannya, mis. nomor NTPN atau nomor nota.',
                'Periksa ringkasan di kartu **Penyesuaian**: tertulis **Talangan** dan **Total** yang ditagih, tanpa PPN.',
                'Klik **Simpan & terbitkan**, periksa nomornya di dialog (mis. `107/BCB-CBS/DN-PNBP/XI/2026`), lalu klik **Terbitkan**. PDF-nya berjudul **DEBIT NOTE**.',
            ],
        },
        {
            title: 'Membuat Debit Note tagihan jasa',
            role: ROLES.staff,
            steps: [
                'Pakai pilihan ini bila dokumennya berjudul Debit Note tetapi isinya **jasa perusahaan sendiri** (mis. Debit Note stevedoring untuk klien luar negeri), bukan biaya yang diganti.',
                'Ikuti langkah Debit Note talangan, tetapi pada **Isi Debit Note** pilih **Tagihan jasa**.',
                'Semua isian invoice muncul kembali: **HPP**, **Titipan pajak**, sakelar **Tagih PPN**, dan **Dipotong PPh 23 oleh klien**. Hitungannya persis seperti invoice; hanya judul dan nomornya Debit Note.',
                'WHT 23 yang **ditambahkan** ke tagihan (bukan dipotong klien) ditulis sebagai baris item tersendiri dengan **Titipan pajak** menyala.',
            ],
        },
        {
            title: 'Mencatat pembayaran Debit Note',
            role: ROLES.fm,
            steps: [
                'Buka Debit Note yang sudah terbit, lalu klik **Catat pembayaran**.',
                'Isi **Jumlah**, **Tanggal**, dan **Rekening tujuan**, sama seperti invoice.',
                'Kotak **Jurnal · Pratinjau** menunjukkan uangnya masuk ke rekening dan dikreditkan ke **Talangan Biaya Klien**, bukan pendapatan. Klik **Simpan pembayaran**.',
            ],
        },
        {
            title: 'Mencatat biaya yang dibayar ke negara',
            role: ROLES.fm,
            steps: [
                'Saat perusahaan membayar biaya itu (mis. PNBP), buka **Arus Kas › Pemasukan & Pengeluaran**, lalu klik **Catat Pengeluaran**.',
                'Pilih kategori **Bayar Talangan Klien** (bertanda **Pendanaan**). Petunjuk di bawahnya mengonfirmasi bahwa saldo berkurang tetapi **Laba Rugi tidak berubah**.',
                'Isi jumlah, rekening, dan deskripsi, lalu simpan. Jangan memakai kategori beban: biaya ini bukan beban perusahaan karena diganti klien.',
            ],
        },
        {
            title: 'Mengganti jenis atau kode setelah terbit',
            role: ROLES.fm,
            steps: [
                'Jenis dokumen dan kode sudah menjadi bagian nomor, jadi keduanya terkunci setelah terbit.',
                'Buka dokumennya, klik **•••** › **Kembalikan ke draft** (hanya untuk nomor urut terakhir yang belum dibayar), ubah jenis atau kodenya, lalu terbitkan lagi.',
                'Sifat **Talangan / Tagihan jasa** dan isi item tetap bisa diubah lewat **Ubah** tanpa kembali ke draft.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat klien membayar Debit Note talangan',
            tone: 'pos',
            items: [
                'Saldo rekening tujuan bertambah sebesar pembayaran.',
                'Jurnalnya: debit rekening, kredit **Talangan Biaya Klien**. Tidak ada pendapatan, PPN, atau PPh.',
                'Laba Rugi tidak berubah; rekap invoice tidak menghitungnya sebagai omzet.',
            ],
        },
        {
            title: 'Saat perusahaan membayar biayanya ke negara',
            tone: 'wait',
            items: [
                'Dicatat di **Arus Kas** dengan kategori **Bayar Talangan Klien** (Pendanaan): saldo berkurang, Laba Rugi tetap.',
                'Jurnalnya: debit **Talangan Biaya Klien**, kredit rekening. Bersama pembayaran klien, keduanya saling menutup.',
            ],
        },
        {
            title: 'Debit Note tagihan jasa',
            tone: 'act',
            items: ['Dibukukan persis seperti invoice: PPN Keluaran, potongan PPh 23, dan **pendapatan** di Laba Rugi.'],
        },
    ],
    records: [
        {
            title: 'Contoh Debit Note talangan',
            subtitle: 'PNBP jasa labuh Rp 4.250.000 yang sudah dibayar perusahaan lebih dulu.',
            rows: [
                { label: 'Item', value: 'PNBP jasa labuh kapal · Rp 4.250.000', source: 'Diisi Staff', tone: 'act' },
                { label: 'PPN', value: 'Rp 0', source: 'Otomatis', tone: 'neutral' },
                { label: 'Potongan PPh 23', value: 'Tidak ada', source: 'Otomatis', tone: 'neutral' },
                { label: 'Total ditagih', value: 'Rp 4.250.000', source: 'Otomatis', tone: 'pos' },
                { label: 'Pendapatan', value: 'Rp 0 (bukan pendapatan)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Nomor', value: '107/BCB-CBS/DN-PNBP/XI/2026', source: 'Saat terbit', tone: 'wait' },
            ],
            note: 'Pada **Tagihan jasa**, PPN, PPh 23, dan pendapatan dihitung seperti invoice biasa.',
        },
    ],
    warnings: [
        {
            title: 'Pilih sifat yang benar',
            body: '**Talangan** untuk biaya yang diganti klien; **Tagihan jasa** untuk jasa perusahaan. Salah pilih membuat pendapatan dan PPN di laporan ikut salah.',
        },
        {
            title: 'Jangan catat biaya talangan sebagai beban',
            body: 'Pembayaran ke negara dicatat dengan kategori **Bayar Talangan Klien**. Bila memakai kategori beban, Laba Rugi turun padahal biayanya diganti klien.',
        },
        {
            title: 'Jenis & kode terkunci setelah terbit',
            body: 'Untuk menggantinya, kembalikan ke draft dulu. Nomor yang sudah dikirim ke klien sebaiknya tidak diganti.',
        },
    ],
    matrix: [
        { action: 'Membuat & menerbitkan Debit Note', cells: [true, true, true] },
        { action: 'Mengubah Debit Note yang tersimpan', cells: [false, true, true] },
        { action: 'Mencatat pembayaran', cells: [false, true, true] },
        { action: 'Kembalikan ke draft', cells: [false, true, true] },
        { action: 'Menyalakan Debit Note di Profil perusahaan', cells: [false, true, true] },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    insightRoles: ['admin', 'finance manager'],
};
