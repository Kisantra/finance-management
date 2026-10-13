import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Pengaturan: akun sendiri, profil perusahaan, penomoran invoice, template PDF. Lihat video/guide.ts. */
export const guide: ModuleGuide = {
    slug: 'settings',
    title: 'Pengaturan',
    group: 'Pengaturan',
    order: 10,
    path: '/settings',
    summary:
        'Satu halaman untuk akun Anda (profil & kata sandi), identitas perusahaan yang tercetak di dokumen PDF, format nomor invoice, dan template PDF invoice. Dibuka dari menu akun di kanan atas › **Pengaturan**.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pemilik akun',
            can: ['Mengubah nama & email sendiri', 'Mengganti kata sandi sendiri', 'Menghapus akun sendiri', 'Membuka dan mengubah **Profil perusahaan** (tidak dibatasi izin)'],
            cannot: ['Tidak melihat **Penomoran invoice** & **Template PDF**'],
        },
        {
            role: ROLES.fm,
            who: 'Pengatur penomoran',
            can: ['Semua yang bisa dilakukan Staff', 'Mengatur **Penomoran invoice**: pola, jumlah digit, dan kapan nomor kembali ke 1'],
            cannot: ['Tidak melihat **Template PDF**'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Membuat, mengedit, dan menghapus **Template PDF** invoice', 'Mengunggah font kustom untuk template'],
        },
    ],
    tasks: [
        {
            title: 'Mengubah nama atau email',
            role: ROLES.staff,
            steps: [
                'Klik nama Anda di kanan atas, lalu **Pengaturan** › **Profil**.',
                'Ubah **Nama Lengkap** atau **Email** (huruf kecil, belum dipakai akun lain), lalu klik **Simpan Perubahan**.',
                'Email baru langsung dipakai untuk masuk berikutnya.',
            ],
        },
        {
            title: 'Mengganti kata sandi',
            role: ROLES.staff,
            steps: [
                'Buka **Pengaturan** › **Kata sandi**.',
                'Isi **Kata Sandi Saat Ini**, lalu **Kata Sandi Baru** (minimal 8 karakter) dan **Konfirmasi Kata Sandi Baru**.',
                'Klik **Perbarui Kata Sandi**. Tulisan **Tersimpan** muncul bila berhasil.',
            ],
        },
        {
            title: 'Menghapus akun sendiri',
            role: ROLES.staff,
            steps: [
                'Di **Profil**, klik **Hapus Akun**, isi kata sandi Anda, lalu **Hapus Akun Saya**.',
                'Akun dan data milik Anda (reimbursement, pengajuan dana, feedback, notifikasi) terhapus permanen dan Anda langsung keluar.',
            ],
        },
        {
            title: 'Mengatur penomoran invoice',
            role: ROLES.fm,
            steps: [
                'Buka **Pengaturan** › **Penomoran invoice**.',
                'Susun **Pola nomor**: ketik teks/pemisah bebas, lalu klik chip token (mis. **{NO}**, **{PT}**, **{THN}**) untuk menyisipkannya di posisi kursor. **{NO}** wajib tepat satu kali.',
                'Pilih **Jumlah digit nomor urut** dan kapan **Nomor kembali ke 1** (**Tiap bulan** / **Tiap tahun** / **Tidak pernah**). Tiap bulan wajib memuat bulan + tahun; tiap tahun wajib memuat tahun.',
                'Periksa kartu **Pratinjau**, lalu klik **Simpan** (perlu profil perusahaan sudah diisi). Berlaku untuk invoice yang **dikirim** setelahnya; nomor yang sudah terbit tidak berubah.',
            ],
        },
        {
            title: 'Melengkapi profil perusahaan',
            role: ROLES.admin,
            steps: [
                'Buka **Pengaturan** › **Profil perusahaan**.',
                'Isi **Identitas Perusahaan** (nama, alamat, email, telepon) dan **Penanggung Jawab Keuangan** (nama & jabatan untuk tanda tangan).',
                'Centang **Pengusaha Kena Pajak (PKP)** bila perusahaan PKP; kolom **NPWP** dan **Tarif PPN (%)** baru muncul setelah dicentang. Selama PKP aktif, invoice baru bisa ditagih PPN.',
                'Unggah **Kop Surat**, **Tanda Tangan**, **Stempel**, dan **Logo** (gambar maks 2 MB), lalu klik **Simpan Perubahan**.',
            ],
        },
        {
            title: 'Membuat template PDF invoice',
            role: ROLES.admin,
            steps: [
                'Buka **Pengaturan** › **Template PDF**, klik **Template Baru**, isi **Nama Template**, lalu **Buat Template**.',
                'Editor terbuka: tambahkan teks, gambar, grid, kotak, garis, atau tabel item dari bilah alat bawah; teks bisa memuat token data invoice (**Sisipkan field**).',
                'Klik **Simpan**. **PDF** membuka PDF uji dari layout yang sudah tersimpan dengan data invoice yang terakhir dibuat (**Pratinjau**: sama, dengan 3–60 baris item contoh); **Preview** menampilkan token terisi langsung di kanvas. **Kembali** tanpa Simpan membuang perubahan.',
                'Di daftar, menu **•••** berisi **Ubah Nama**, **Jadikan Default**, **Duplikat**, dan **Hapus**.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Profil perusahaan',
            tone: 'act',
            items: [
                'Nama perusahaan, **kop surat**, tanda tangan, stempel, serta nama & jabatan penanggung jawab tercetak di **PDF invoice**.',
                'Selama **PKP** aktif, editor invoice menampilkan sakelar **Tagih PPN** (menyala untuk invoice baru) dan invoice berulang yang di-publish ikut diberi PPN. **Tarif PPN** disimpan di setiap invoice saat dibuat.',
                'Mematikan PKP atau mengubah Tarif PPN hanya berlaku untuk invoice **baru**; invoice yang sudah ber-PPN tidak berubah.',
                'Nama perusahaan menentukan inisial **{PT}** di nomor invoice berikutnya & singkatan nomor pengajuan dana baru.',
                'Identitas & penanggung jawab juga ikut di PDF laporan arus kas & pengajuan dana; **NPWP** di PDF rekap invoice & laba rugi.',
            ],
        },
        {
            title: 'Penomoran invoice',
            tone: 'wait',
            items: [
                'Hanya untuk invoice yang **dikirim setelah disimpan**; draft belum bernomor.',
                'Nomor yang sudah terbit tidak ikut berubah.',
                'Urutan tetap lanjut dari nomor terbesar di periode yang sama.',
                'Nomor masih bisa diubah manual di dialog **Kirim** invoice.',
            ],
        },
        {
            title: 'Template PDF',
            tone: 'pos',
            items: [
                'Setiap template muncul sebagai pilihan di dialog **Cetak invoice**.',
                '**Default** hanya menaruhnya di urutan pertama daftar template buatan; pilihan awal dialog tetap Kisantra.',
                'Menghapus template menghilangkannya dari pilihan cetak; invoice tidak berubah.',
            ],
        },
    ],
    records: [
        {
            title: 'Ke mana isi profil perusahaan mengalir',
            subtitle: 'Isian di satu halaman ini dibaca oleh banyak dokumen PDF.',
            rows: [
                { label: 'Nama perusahaan', value: 'PDF invoice & laporan + inisial {PT} di nomor invoice', source: 'Identitas', tone: 'act' },
                { label: 'Alamat, email, telepon', value: 'Kepala PDF arus kas & pengajuan dana; invoice Semesta & Generik', source: 'Identitas', tone: 'act' },
                { label: 'Nama & jabatan', value: 'Tanda tangan PDF invoice, arus kas, pengajuan dana', source: 'Penanggung jawab', tone: 'pos' },
                { label: 'PKP & Tarif PPN', value: 'Sakelar Tagih PPN di invoice baru; tarif disimpan per invoice', source: 'Pajak', tone: 'wait' },
                { label: 'NPWP', value: 'PDF rekap invoice & laba rugi', source: 'Pajak', tone: 'wait' },
                { label: 'Kop surat', value: 'Kepala PDF invoice (Kisantra, Semesta, AGSA)', source: 'Aset visual', tone: 'neutral' },
                { label: 'Tanda tangan & stempel', value: 'PDF invoice; tanda tangan juga di arus kas', source: 'Aset visual', tone: 'neutral' },
                { label: 'Logo', value: 'Kepala PDF laporan arus kas (bukan invoice)', source: 'Aset visual', tone: 'neutral' },
            ],
            note: 'Rekening tujuan pembayaran yang tercetak di invoice **tidak** diatur di halaman ini. Template PDF buatan Admin hanya memakai data perusahaan yang disisipkan sebagai token.',
        },
    ],
    warnings: [
        {
            title: 'Semua pengguna bisa mengubah profil perusahaan',
            body: 'Halaman **Profil perusahaan** (termasuk menghapus gambar) tidak dibatasi izin, juga untuk Staff. Periksa isinya secara berkala.',
        },
        {
            title: 'Invoice sebelum fitur PPN memakai aturan lama',
            body: 'Invoice yang dibuat sebelum 13 Oktober 2026 tidak menyimpan PPN. Saat dicetak ulang: **Semesta** menambah PPN dari Tarif PPN walau PKP tidak dicentang; **Kisantra** & **Generik** tanpa baris PPN, tetapi bila PKP dicentang teks Terbilang ikut menghitung PPN sehingga berbeda dari angka TOTAL.',
        },
        {
            title: 'Ganti nama perusahaan = nomor dokumen berikutnya berubah',
            body: 'Inisial **{PT}** di nomor invoice berikutnya dan singkatan nomor pengajuan dana baru diambil dari nama perusahaan. Nomor yang sudah terbit tetap.',
        },
        {
            title: 'Hapus akun sendiri tidak bisa dibatalkan',
            body: 'Siapa pun bisa menghapus akunnya, termasuk admin terakhir. Reimbursement, pengajuan dana, feedback, dan notifikasi miliknya ikut terhapus, juga riwayat pembayaran reimbursement yang pernah ia catat; transaksi bank-nya tetap ada.',
        },
        {
            title: 'Unggah gambar menimpa file lama',
            body: 'Kop surat, tanda tangan, stempel, atau logo yang lama langsung dihapus dari server saat disimpan; tidak ada riwayat versi.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Mengubah profil & kata sandi sendiri', cells: [true, true, true] },
        { action: 'Menghapus akun sendiri', cells: [true, true, true] },
        { action: 'Mengubah profil perusahaan', cells: [true, true, true] },
        { action: 'Mengatur penomoran invoice', cells: [false, true, true] },
        { action: 'Mengelola template PDF & font', cells: [false, false, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
