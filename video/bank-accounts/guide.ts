import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'bank-accounts',
    title: 'Kas & Bank',
    group: 'Keuangan',
    order: 30,
    path: '/bank-accounts',
    permission: 'view bank-accounts',
    // Video peluncuran 45,6 dtk (sumber: video/launch/bank-accounts.html).
    overview: { src: '/videos/panduan/rekening-bank.mp4', poster: '/videos/panduan/rekening-bank-poster.jpg', seconds: 45 },
    summary:
        'Daftar rekening bank dan kas tunai (kas kecil) perusahaan beserta saldo terkininya. Dari sini Anda menambah rekening atau kas, mencatat pemasukan, pengeluaran, dan transfer antar akun, mengisi ulang kas kecil sampai plafonnya, lalu memantau arus uang tiap akun. Saldo tidak pernah diketik: aplikasi selalu menghitungnya dari saldo awal ditambah semua uang masuk dan dikurangi semua uang keluar. Staff tidak punya akses ke modul ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola kas & rekening',
            can: [
                'Menambah, mengubah, dan menghapus rekening bank & kas tunai',
                'Mengatur penanggung jawab dan plafon kas kecil',
                'Mencatat pemasukan & pengeluaran ke rekening atau kas',
                'Transfer antar akun (dengan biaya admin), termasuk **Isi ulang** kas kecil',
                'Menghapus transaksi & export laporan kas PDF',
            ],
            cannot: [
                'Pembayaran invoice hanya dilihat di sini, dicatat dari modul Invoice',
                'Mengubah transaksi tidak bisa dari halaman ini; lakukan di menu **Arus Kas**',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memastikan kategori tiap transaksi benar, karena kategori menentukan Arus Kas & Laba Rugi'],
        },
    ],
    tasks: [
        {
            title: 'Menambah rekening bank',
            role: ROLES.fm,
            steps: [
                'Buka **Keuangan › Kas & Bank**, lalu klik **Tambah Akun**.',
                'Pada **Jenis**, pilih **Bank**.',
                'Isi **Nama Pemilik Rekening** dan **Nomor Rekening** (tidak boleh sama dengan akun lain).',
                'Di **Nama Bank**, ketik beberapa huruf (mis. "bca" atau "mandiri") lalu pilih dari daftar, atau ketik sendiri bila bank Anda tidak ada di daftar. Bank yang dikenali tampil dengan logonya di form dan di panel **Akun**; nama bank lain tetap tersimpan apa adanya dengan ikon gedung.',
                'Isi **Cabang** (opsional) dan **Saldo Awal**: saldo rekening pada saat mulai dicatat di aplikasi.',
                'Klik **Tambah Rekening**. Rekening baru langsung terpilih di panel **Akun**.',
            ],
        },
        {
            title: 'Menambah kas kecil',
            role: ROLES.fm,
            steps: [
                'Klik **Tambah Akun**, lalu pada **Jenis** pilih **Kas**. Kolom nomor rekening, nama bank, dan cabang hilang karena kas tidak membutuhkannya.',
                'Isi **Nama Kas**, mis. "Kas Kecil Kantor". Aplikasi memberi kode **KAS-0001** sebagai pengganti nomor rekening dan nama bank **Tunai**, jadi di modul lain kas ini terbaca "Kas Kecil Kantor — Tunai".',
                'Pilih **Penanggung Jawab**, yaitu anggota perusahaan yang memegang uangnya, lalu isi **Plafon** (batas saldo kas kecil; kosongkan bila tidak ada).',
                'Isi **Saldo Awal** = uang tunai yang ada saat mulai dicatat, lalu klik **Tambah Kas**. Di daftar, kas bertanda ikon dompet dan label **Kas**.',
                'Rekening "bank" yang selama ini dipakai sebagai kas (mis. "CASH 0000") cukup diubah lewat **Ubah Rekening** → **Jenis** **Kas**: saldo dan transaksinya tetap.',
            ],
        },
        {
            title: 'Mengisi ulang kas kecil',
            role: ROLES.fm,
            steps: [
                'Kas yang saldonya di bawah plafon menampilkan **Perlu isi ulang Rp …** di panel **Akun** (= plafon − saldo).',
                'Pilih kas itu, lalu klik **Isi ulang**. Dialog **Transfer** terbuka dengan **Rekening Tujuan** = kas ini, **Jumlah Transfer** = kekurangannya, dan **Biaya Admin** Rp 0.',
                'Pilih **Rekening Sumber** (rekening bank asal uang) dan **Kategori** transfer, periksa jumlahnya, lalu klik **Lakukan Transfer**.',
            ],
        },
        {
            title: 'Membaca kondisi sebuah akun',
            role: ROLES.fm,
            steps: [
                'Klik akun di panel **Akun**. Saldo di bawah namanya adalah saldo terkini; **Ringkasan Total** memisahkan **Total Bank** dan **Total Kas**.',
                'Kartu **Pemasukan**, **Pengeluaran**, dan **Arus Bersih** akun terpilih menghitung semua uang masuk & keluar akun itu (termasuk transfer). Pilih bulan di kolom **Semua bulan** untuk satu periode.',
                '**Pemasukan** & **Pengeluaran** di **Ringkasan Total** (semua akun) tidak menghitung transfer antar akun sendiri, termasuk isi ulang kas; biaya admin transfer tetap pengeluaran.',
                'Grafik **Pemasukan vs Pengeluaran** menampilkan 12 bulan terakhir; **Rincian per Kategori** menampilkan 6 kategori uang keluar terbesar (termasuk transfer).',
                'Tab **Transaksi** berisi semua transaksi akun ini; tab **Pembayaran** berisi pembayaran invoice yang masuk ke akun ini.',
                'Klik deskripsi transaksi (atau nomor invoice di tab **Pembayaran**) untuk membuka **Rincian** hanya-lihat beserta kotak **Jurnal** (akun yang didebit & dikredit). Penyesuaian dan kaki transfer per akun hanya bisa dilihat jurnalnya di sini; mengubah transaksi tetap lewat **Arus Kas**.',
                'Lencana **Naik/Turun** hanya membandingkan transaksi masuk bulan ini dengan bulan lalu (tanpa pembayaran invoice).',
            ],
        },
        {
            title: 'Mencatat pemasukan atau pengeluaran',
            role: ROLES.fm,
            steps: [
                'Pilih rekening atau kas, lalu klik **Pengeluaran** atau **Pemasukan**.',
                'Isi **Jumlah** (paling atas), periksa **Tanggal** dan **Rekening** (terisi akun terpilih), lalu pilih **Kategori** (subkategori; kategori baru bisa dibuat lewat **+ Tambah**).',
                'Kotak **Jurnal · Pratinjau** di bawah Kategori menunjukkan akun yang didebit & dikredit (pemasukan: akun ini didebit; pengeluaran: akun ini dikredit). Kas ditulis dengan namanya saja, rekening bank "nama — bank".',
                'Isi **Deskripsi**, **Nomor Referensi** (opsional), dan **Lampiran Bukti** (PDF, JPG, atau PNG, maksimal 5 MB).',
                'Klik **Simpan Pengeluaran** / **Simpan Pemasukan**. Form dikosongkan agar bisa mencatat transaksi berikutnya; klik **Tutup** bila selesai.',
            ],
        },
        {
            title: 'Transfer antar akun',
            role: ROLES.fm,
            steps: [
                'Pilih rekening atau kas sumber, lalu klik **Transfer**.',
                'Pilih **Rekening Sumber**, **Rekening Tujuan**, **Kategori** (kategori bertipe Transfer), dan **Tanggal**.',
                'Isi **Jumlah Transfer** (yang diterima rekening tujuan) dan **Biaya Admin** (awalnya Rp 2.500; ikut dipotong dari rekening sumber).',
                'Isi **Deskripsi**, unggah **Bukti Transfer** bila ada, periksa **Total Keluar** dan kotak **Jurnal** (akun tujuan + Biaya Admin Transfer didebit, akun sumber dikredit), lalu klik **Lakukan Transfer**.',
            ],
        },
        {
            title: 'Menghapus transaksi',
            role: ROLES.fm,
            steps: [
                'Di tab **Transaksi**, klik ikon tempat sampah di baris transaksi, atau centang beberapa baris lalu klik **Hapus** di bilah bawah.',
                'Konfirmasi **Hapus**. Bila transaksinya bagian dari transfer, pasangannya di rekening lain ikut terhapus.',
            ],
        },
        {
            title: 'Mengubah, menghapus, atau mencetak laporan akun',
            role: ROLES.fm,
            steps: [
                'Pilih akun, lalu klik menu **•••** di samping tombol **Transfer**.',
                '**Ubah Rekening** / **Ubah Kas**: ubah data akun, termasuk **Jenis**, penanggung jawab, dan plafon kas. Mengubah **Saldo Awal** menggeser saldo terkini sebesar selisihnya.',
                '**Ekspor PDF**: laporan kas akun ini untuk semua waktu (filter bulan di halaman tidak ikut).',
                '**Hapus Rekening**: aplikasi tetap menghapus rekening yang sudah berisi transaksi (kecuali yang pernah dipakai membayar utang), jadi gunakan hanya untuk rekening yang belum pernah dipakai. Baca bagian peringatan sebelum menghapus.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat mencatat pemasukan / pengeluaran',
            tone: 'act',
            items: [
                '**1 transaksi bank** uang masuk atau uang keluar.',
                'Saldo akun dan Total Saldo di **Dashboard** (beserta rinciannya: Bank / Kas) langsung berubah; saldo selalu dihitung ulang dari semua transaksi.',
                'Tampil di **Arus Kas › Pemasukan / Pengeluaran** bila kategorinya bertipe Pemasukan / Pengeluaran.',
                'Masuk **Laba Rugi** sesuai Grup L/R kategorinya; kategori Pemasukan/Pengeluaran tanpa grup masuk panel **Perlu Diklasifikasi** dan belum dihitung.',
            ],
        },
        {
            title: 'Saat transfer / isi ulang kas',
            tone: 'wait',
            items: [
                '**2 transaksi bank** dengan nomor referensi TRF yang sama: keluar di sumber, masuk di tujuan.',
                'Sumber berkurang jumlah + biaya admin; tujuan bertambah jumlah transfer. **Isi ulang** kas kecil adalah transfer yang sama.',
                'Tampil di **Arus Kas › Transfer & Penyesuaian**.',
                'Di **Ringkasan** dan **Ringkasan Total** (semua akun) **bukan** pemasukan maupun pengeluaran; hanya biaya adminnya yang dihitung sebagai pengeluaran (irisan **Biaya admin transfer** di donat Ringkasan).',
                '**Tidak masuk Laba Rugi**, termasuk biaya adminnya.',
            ],
        },
        {
            title: 'Saat mengubah / menghapus rekening',
            tone: 'neg',
            items: [
                'Ubah **Saldo Awal**: saldo terkini dan saldo awal laporan kas PDF ikut bergeser, tanpa transaksi tercatat.',
                '**Hapus rekening**: semua transaksi bank, pembayaran invoice, dan riwayat pembayaran reimbursement di rekening itu ikut terhapus permanen.',
                'Saldo, Arus Kas, dan Laba Rugi langsung kehilangan angka-angka tersebut.',
            ],
        },
    ],
    records: [
        {
            title: 'Isi dua transaksi yang dibuat saat transfer',
            subtitle: 'Contoh transfer Rp 1.500.000 dengan biaya admin Rp 2.500, beserta asal setiap datanya.',
            rows: [
                { label: 'Referensi', value: 'TRF + kode waktu, sama di kedua transaksi', source: 'Otomatis', tone: 'neutral' },
                { label: 'Uang keluar', value: 'BRI - Proyek Klien · −Rp 1.502.500', source: 'Jumlah + Biaya Admin', tone: 'pos' },
                { label: 'Deskripsi keluar', value: 'Transfer + Admin Fee - Isi kas kecil proyek Oktober', source: 'Otomatis + Deskripsi', tone: 'neutral' },
                { label: 'Uang masuk', value: 'Jago - Kas Kecil · +Rp 1.500.000', source: 'Jumlah Transfer', tone: 'pos' },
                { label: 'Deskripsi masuk', value: 'Transfer masuk - Isi kas kecil proyek Oktober', source: 'Otomatis + Deskripsi', tone: 'neutral' },
                { label: 'Kategori & tanggal', value: 'Pindah Dana Antar Rekening · tanggal transfer', source: 'Dialog Transfer', tone: 'act' },
            ],
            note: 'Menghapus salah satu dari dua transaksi ini akan menghapus **keduanya**.',
        },
    ],
    warnings: [
        {
            title: 'Hapus rekening = hapus seluruh riwayatnya',
            body: 'Semua transaksi bank dan pembayaran invoice ke rekening itu ikut terhapus, tetapi status invoice, reimbursement, dan pengajuan dana tidak dihitung ulang (mis. tetap **Lunas** padahal catatan pembayarannya hilang). Rekening yang pernah dipakai membayar pinjaman gagal dihapus.',
        },
        {
            title: 'Ubah saldo awal hanya untuk koreksi',
            body: 'Saldo awal menggeser seluruh saldo rekening, termasuk laporan kas lama, tanpa jejak transaksi. Untuk uang yang benar-benar masuk/keluar, catat **Pemasukan** atau **Pengeluaran**.',
        },
        {
            title: 'Jangan hapus transaksi dari modul lain',
            body: 'Pembayaran reimbursement, pencairan dana, dan transaksi utang/piutang juga tampil di tab Transaksi. Bila dihapus di sini, saldo berubah tetapi status di modul asalnya tidak ikut kembali.',
        },
        {
            title: 'Pilih kategori yang tipenya sesuai',
            body: 'Daftar kategori Pemasukan/Pengeluaran juga memuat kategori Transfer & Penyesuaian. Transaksi dengan kategori itu tidak tampil di Arus Kas › Pemasukan/Pengeluaran (Penyesuaian tidak tampil di halaman Arus Kas mana pun) dan tidak dihitung di Laba Rugi.',
        },
        {
            title: 'Jangan awali Nomor Referensi dengan "TRF"',
            body: 'Referensi berawalan TRF dianggap transfer: saat dihapus, semua transaksi dengan nomor referensi yang sama ikut terhapus.',
        },
        {
            title: 'Plafon & penanggung jawab kas hanya informasi',
            body: 'Aplikasi tidak menolak pengeluaran saat saldo kas di bawah plafon (atau negatif), dan penanggung jawab tidak membatasi siapa yang mencatat: siapa pun yang punya izin Pemasukan/Pengeluaran bisa mencatat ke akun kas. Hitung uang fisiknya secara berkala.',
        },
        {
            title: 'Biaya admin transfer tidak masuk Laba Rugi',
            body: 'Biaya admin ikut kategori Transfer: dihitung sebagai pengeluaran di Ringkasan, tetapi tidak di Arus Kas › Pengeluaran maupun Laba Rugi. Bila ingin tercatat sebagai beban, isi **Biaya Admin** Rp 0 lalu catat **Pengeluaran** terpisah dengan kategori biaya bank.',
        },
        {
            title: 'Pemasukan di halaman ini ≠ pendapatan',
            body: 'Kartu Pemasukan/Pengeluaran **akun terpilih** menghitung semua uang masuk/keluar akun itu, termasuk transfer antar akun dan isi ulang kas; **Ringkasan Total** (semua akun) tidak menghitung transfer antar akun. Untuk pendapatan dan beban, lihat **Laporan › Laba Rugi**.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat saldo, grafik & transaksi', cells: [false, true, true] },
        { action: 'Menambah & mengubah rekening atau kas', cells: [false, true, true] },
        { action: 'Mencatat pemasukan & pengeluaran', cells: [false, true, true] },
        { action: 'Transfer antar akun & isi ulang kas', cells: [false, true, true] },
        { action: 'Menghapus transaksi', cells: [false, true, true] },
        { action: 'Menghapus rekening atau kas', cells: [false, true, true] },
        { action: 'Ekspor laporan kas PDF', cells: [false, true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
