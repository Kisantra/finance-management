import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan fitur Tagihan USD & kurs manual (bagian modul Invoice) — lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'tagihan-usd',
    title: 'Tagihan USD',
    group: 'Keuangan',
    order: 14,
    path: '/invoices/create',
    permission: 'view invoices',
    summary:
        'Untuk klien yang membayar dalam **dolar AS (USD)**. Anda menagih dalam USD dengan **kurs yang diisi sendiri** di setiap invoice, sementara pembukuan perusahaan tetap dalam **Rupiah**. Saat uang diterima, Anda mencatat jumlah USD-nya dan kurs hari itu; aplikasi menghitung Rupiah yang masuk ke rekening dan selisih kursnya. Pilihan ini hanya muncul untuk perusahaan yang menyalakan **Tagihan USD** di Profil perusahaan.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Penyusun tagihan',
            can: [
                'Membuat invoice atau Debit Note dalam **USD**',
                'Mengisi kurs dan harga USD per baris',
                'Menagih dalam Rupiah dengan tarif USD (mis. $0,75 per ton)',
            ],
            cannot: ['Tidak bisa mengubah tagihan setelah tersimpan'],
        },
        {
            role: ROLES.fm,
            who: 'Penagih',
            can: [
                'Semua yang bisa dilakukan Staff',
                'Mencatat pembayaran USD dengan **kurs saat diterima**',
                'Mengubah atau menghapus pembayaran',
                'Menyalakan Tagihan USD dan menambah rekening USD di **Profil perusahaan**',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memahami selisih kurs di jurnal dan Laba Rugi'],
        },
    ],
    tasks: [
        {
            title: 'Menyalakan Tagihan USD',
            role: ROLES.fm,
            steps: [
                'Buka menu akun › **Pengaturan** › **Profil perusahaan**, lalu di bagian **Tagihan USD** centang **Perusahaan ini bisa menagih dalam USD**.',
                'Di **Rekening Pembayaran**, tambahkan rekening USD: pilih **Mata uang rekening: USD**, lalu isi **Cabang** dan **Kode Swift** (dibutuhkan bank klien luar negeri).',
                'Klik **Simpan Perubahan**. Tagihan USD mencetak rekening USD; tagihan Rupiah tetap mencetak rekening Rupiah.',
            ],
        },
        {
            title: 'Membuat tagihan dalam USD',
            role: ROLES.staff,
            steps: [
                'Buka **Keuangan › Invoice**, klik **Buat Invoice**, lalu pada **Mata uang tagihan** pilih **USD**.',
                'Isi **Kurs (Rp per 1 USD)** hari itu, mis. **18.300**. Kurs terakhir yang dipakai terisi otomatis sebagai awalan; ganti bila sudah berubah.',
                'Pilih klien, lalu isi baris item. Nyalakan **Harga USD** di baris itu dan ketik harga per unitnya, mis. **0,82** per MT. Di bawah baris tampil Rupiahnya: harga USD × kurs.',
                'Baris lain boleh tetap berharga Rupiah (mis. biaya transport lokal).',
                'Periksa ringkasan: **Total** dalam Rupiah (untuk pembukuan) dan **Tagihan USD (total ÷ kurs)**, yaitu jumlah yang harus dibayar klien. PPN dan PPh 23, bila dinyalakan, tetap dihitung dalam Rupiah.',
                'Klik **Simpan & terbitkan**. PDF mencetak total Rupiah, kurs, **TOTAL OUTSTANDING (USD)**, dan rekening USD.',
            ],
        },
        {
            title: 'Menagih dalam Rupiah dengan tarif USD',
            role: ROLES.staff,
            steps: [
                'Untuk invoice **Rupiah** yang tarifnya dalam USD (mis. stevedoring $0,75 per ton), biarkan **Mata uang tagihan: Rupiah**.',
                'Nyalakan **Harga USD** di baris itu dan isi **Kurs**. Klien membayar dalam Rupiah; PDF mencetak kurs dan tarif USD-nya.',
            ],
        },
        {
            title: 'Mencatat pembayaran USD',
            role: ROLES.fm,
            steps: [
                'Buka tagihan USD yang sudah terbit, lalu klik **Catat pembayaran**.',
                'Isi **Diterima (USD)**. Pilihan **Sisa penuh** dan **50%** dihitung dalam USD.',
                'Isi **Kurs saat diterima (Rp per 1 USD)**, yaitu kurs saat bank mengonversi uangnya. Awalnya terisi kurs invoice. Aplikasi menampilkan **Masuk ke rekening: Rp …**.',
                'Pilih **Rekening tujuan** (rekening Rupiah tempat uang hasil konversi masuk). Kotak **Jurnal · Pratinjau** menunjukkan pendapatan dengan kurs invoice dan **Selisih Kurs**-nya.',
                'Klik **Simpan pembayaran**. Status menjadi **Lunas** bila USD yang diterima menutup sisa tagihan USD, berapa pun kursnya.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat tagihan USD terbit',
            tone: 'act',
            items: [
                'Pembukuan memakai Rupiah dengan kurs invoice: total, PPN, dan PPh tetap Rupiah.',
                'Sisa tagihan dan status Lunas dihitung dari **USD**, bukan Rupiah.',
            ],
        },
        {
            title: 'Saat pembayaran USD dicatat',
            tone: 'pos',
            items: [
                'Rekening Rupiah yang dipilih bertambah sebesar USD × kurs saat diterima.',
                'Kurs naik dibanding kurs invoice → **laba selisih kurs** (Pendapatan Lain). Kurs turun → **rugi selisih kurs** (Beban Lain).',
                'Jurnalnya memakai akun **Selisih Kurs**; pendapatan invoice tetap sebesar nilai tagihannya.',
            ],
        },
    ],
    records: [
        {
            title: 'Contoh hitungan tagihan USD',
            subtitle: '20.000 MT jasa stevedoring × USD 0,82, dibayar saat kurs naik.',
            rows: [
                { label: 'Kurs invoice', value: 'Rp 18.300 per USD', source: 'Diisi Staff', tone: 'act' },
                { label: 'Total pembukuan', value: 'Rp 300.120.000', source: 'Otomatis', tone: 'neutral' },
                { label: 'Tagihan klien', value: 'USD 16.400,00', source: 'Total ÷ kurs', tone: 'wait' },
                { label: 'Diterima', value: 'USD 16.400 dengan kurs Rp 18.400', source: 'Diisi saat bayar', tone: 'act' },
                { label: 'Masuk rekening', value: 'Rp 301.760.000', source: 'Otomatis', tone: 'pos' },
                { label: 'Selisih kurs', value: 'Rp 1.640.000 (laba)', source: 'Otomatis', tone: 'pos' },
            ],
            note: 'Status **Lunas** karena USD 16.400 sudah diterima penuh; selisih Rupiahnya dicatat sebagai selisih kurs.',
        },
    ],
    warnings: [
        {
            title: 'Kurs selalu diisi manual',
            body: 'Aplikasi tidak mengambil kurs dari internet. Periksa kurs invoice sebelum menerbitkan dan kurs saat diterima sebelum menyimpan pembayaran.',
        },
        {
            title: 'Mata uang terkunci setelah ada pembayaran',
            body: 'Setelah tagihan menerima pembayaran, mata uangnya tidak bisa diganti. Hapus pembayarannya dulu bila memang salah.',
        },
        {
            title: 'Cetak tagihan USD hanya tagihan penuh',
            body: 'Uang muka dan pelunasan masih dalam Rupiah. Satu kurs dipakai untuk semuanya, termasuk PPN.',
        },
    ],
    matrix: [
        { action: 'Membuat tagihan USD', cells: [true, true, true] },
        { action: 'Mengubah tagihan yang tersimpan', cells: [false, true, true] },
        { action: 'Mencatat pembayaran USD', cells: [false, true, true] },
        { action: 'Menyalakan Tagihan USD di Profil perusahaan', cells: [false, true, true] },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    insightRoles: ['admin', 'finance manager'],
};
