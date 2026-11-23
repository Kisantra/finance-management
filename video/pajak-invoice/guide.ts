import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan fitur PPN & potongan PPh 23 di invoice — lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'pajak-invoice',
    title: 'PPN & PPh 23',
    group: 'Keuangan',
    order: 11,
    path: '/invoices/create',
    permission: 'view invoices',
    summary:
        'Dua pajak yang paling sering muncul di invoice. **PPN** ditambahkan ke tagihan (mis. 11%) dan disetor ke negara, jadi bukan pendapatan. **PPh 23** dipotong oleh klien dari tagihan jasa dan disetorkan klien atas nama perusahaan, jadi yang ditransfer klien lebih kecil, tetapi potongannya tetap pendapatan (kredit pajak). Keduanya dinyalakan sekali di **Profil perusahaan**, lalu muncul sebagai sakelar di setiap invoice dan dihitung otomatis.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Penyusun invoice',
            can: [
                'Menagih PPN dan mengisi nomor faktur pajak',
                'Memotong PPh 23 atau mematikannya untuk klien yang tidak memotong',
                'Memeriksa Total yang akan ditransfer klien sebelum menyimpan',
            ],
            cannot: ['Tidak bisa mengubah invoice setelah tersimpan', 'Tidak bisa mengubah pengaturan pajak perusahaan'],
        },
        {
            role: ROLES.fm,
            who: 'Pengatur pajak & penagih',
            can: [
                'Semua yang bisa dilakukan Staff',
                'Menyalakan **PKP**, tarif PPN, dan **PPh 23** di Profil perusahaan',
                'Mengubah invoice, termasuk menambahkan nomor faktur pajak yang datang belakangan',
                'Mencatat pembayaran dan penyetoran PPN',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memahami dampak PPN dan PPh 23 ke jurnal dan Laba Rugi'],
        },
    ],
    tasks: [
        {
            title: 'Menyalakan PPN dan PPh 23',
            role: ROLES.fm,
            steps: [
                'Buka menu akun › **Pengaturan** › **Profil perusahaan**, lalu gulir ke **Status PKP & Pajak**.',
                'Centang **Perusahaan adalah Pengusaha Kena Pajak (PKP)** bila perusahaan wajib memungut PPN. Isi **NPWP** dan **Tarif PPN (%)**, mis. 11.',
                'Centang **Klien memotong PPh 23 dari invoice perusahaan ini** bila klien biasanya memotong PPh 23, lalu isi **Tarif PPh 23 bawaan (%)**, mis. 2 (atau 0,5).',
                'Klik **Simpan Perubahan**. Mematikannya nanti tidak mengubah invoice lama: tarif tersimpan di tiap invoice.',
            ],
        },
        {
            title: 'Menagih PPN di invoice',
            role: ROLES.staff,
            steps: [
                'Buat invoice seperti biasa. Di kartu **Penyesuaian**, sakelar **Tagih PPN 11%** sudah menyala untuk perusahaan PKP.',
                'PPN dihitung dari layanan **setelah diskon**; baris **Titipan pajak** tidak ikut dihitung.',
                'Isi **No. faktur pajak** bila sudah ada; boleh dikosongkan.',
                'Untuk invoice tanpa PPN, matikan sakelarnya.',
            ],
        },
        {
            title: 'Memotong PPh 23',
            role: ROLES.staff,
            steps: [
                'Di bawah PPN, sakelar **Dipotong PPh 23 oleh klien** menyala dengan tarif bawaan. Ubah **Tarif PPh 23** bila klien ini memakai tarif lain.',
                'Potongan dihitung dari dasar yang sama dengan PPN (layanan setelah diskon, tanpa titipan pajak).',
                'Periksa ringkasan: **Total** = layanan + PPN − PPh 23, yaitu jumlah yang ditransfer klien.',
                'Klien tidak memotong PPh? Matikan sakelarnya. Aplikasi mengingat pilihan itu: invoice berikutnya untuk klien yang sama ikut tidak dipotong.',
            ],
        },
        {
            title: 'Memeriksa PPN di daftar & detail invoice',
            role: ROLES.staff,
            steps: [
                'Di **Keuangan › Invoice**, kartu **PPN** menjumlahkan PPN dari invoice yang terbit pada periode yang dipilih.',
                'Buka sebuah invoice: rincian di bawah item menampilkan PPN, potongan PPh 23, dan Total.',
            ],
        },
        {
            title: 'Saat klien membayar',
            role: ROLES.fm,
            steps: [
                'Catat pembayaran sebesar **Total** yang ditransfer klien; invoice langsung **Lunas**.',
                'Kotak **Jurnal · Pratinjau** memisahkan **PPN Keluaran** dan mendebit **PPh 23 Dibayar di Muka** sebesar potongannya.',
                'Saat menyetor PPN ke negara, catat di **Arus Kas › Pengeluaran** dengan kategori **Setor PPN** (Pendanaan), bukan beban.',
            ],
        },
    ],
    impacts: [
        {
            title: 'PPN',
            tone: 'wait',
            items: [
                'Ikut ditagih dan masuk **Total**, sehingga sisa tagihan dan status Lunas memakai total ber-PPN.',
                'Bukan pendapatan: dibukukan ke **PPN Keluaran** dan tidak menambah laba.',
                'Disetor ke negara lewat Arus Kas dengan kategori **Setor PPN**.',
            ],
        },
        {
            title: 'PPh 23',
            tone: 'pos',
            items: [
                'Mengurangi **Total** yang ditransfer klien, tetapi tetap dihitung **pendapatan** (kredit pajak perusahaan).',
                'Jurnal pembayaran mendebit **PPh 23 Dibayar di Muka** sebesar bagian potongannya.',
            ],
        },
    ],
    records: [
        {
            title: 'Contoh hitungan',
            subtitle: 'Jasa konsultasi Rp 10.000.000, perusahaan PKP, klien memotong PPh 23 2%.',
            rows: [
                { label: 'Layanan', value: 'Rp 10.000.000', source: 'Diisi Staff', tone: 'act' },
                { label: 'PPN 11%', value: '+ Rp 1.100.000', source: 'Otomatis', tone: 'wait' },
                { label: 'PPh 23 2%', value: '− Rp 200.000', source: 'Otomatis', tone: 'wait' },
                { label: 'Total ditransfer', value: 'Rp 10.900.000', source: 'Otomatis', tone: 'pos' },
                { label: 'Pendapatan', value: 'Rp 10.000.000', source: 'Laba Rugi', tone: 'pos' },
            ],
            note: 'PPN bukan pendapatan; potongan PPh 23 tetap pendapatan karena menjadi kredit pajak perusahaan.',
        },
    ],
    warnings: [
        {
            title: 'Tarif tersimpan di setiap invoice',
            body: 'Mengganti tarif atau mematikan PKP di Profil perusahaan hanya berlaku untuk invoice baru. Invoice lama tetap memakai tarifnya.',
        },
        {
            title: 'Pilihan PPh diingat per klien',
            body: 'Mematikan PPh 23 untuk satu invoice membuat invoice berikutnya klien itu ikut tidak dipotong. Nyalakan lagi bila klien kembali memotong.',
        },
        {
            title: 'Belum semua jenis PPh',
            body: 'Semua potongan dicatat sebagai PPh 23 (PPh 4(2), 15, dan 22 belum dibedakan), dan invoice berulang belum memotong PPh 23.',
        },
    ],
    matrix: [
        { action: 'Menagih PPN & memotong PPh 23 di invoice', cells: [true, true, true] },
        { action: 'Mengubah faktur atau pajak invoice tersimpan', cells: [false, true, true] },
        { action: 'Menyalakan PKP & PPh 23 di Profil perusahaan', cells: [false, true, true] },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    insightRoles: ['admin', 'finance manager'],
};
