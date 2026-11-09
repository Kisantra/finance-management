import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan Arus Kas — isi selaras dengan docs/module/cash-flow.md dan kode BankTransactionController / CashFlowController. */
export const guide: ModuleGuide = {
    slug: 'cash-flow',
    title: 'Arus Kas',
    group: 'Arus Kas',
    order: 10,
    path: '/cash-flow',
    permission: ['view income', 'view expense', 'view transfer'],
    summary:
        'Pencatatan uang masuk dan keluar rekening bank perusahaan dalam dua menu: **Pemasukan & Pengeluaran** (tab **Semua**, **Pemasukan** — pembayaran invoice + pemasukan langsung —, dan **Pengeluaran**) serta **Transfer & Penyesuaian** (pindah dana antar rekening). Setiap catatan menyimpan siapa yang menginputnya, langsung mengubah saldo rekening dan, sesuai kategorinya, Laporan Laba Rugi. **Pendanaan** (setoran modal, prive, setor PPN, setor titipan pajak klien, pokok utang/piutang) ikut tampil dengan badge **Pendanaan** dan kartu terpisah karena tidak masuk Laba Rugi. Staff tidak punya akses ke modul ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pencatat kas',
            can: [
                'Mencatat pemasukan & pengeluaran langsung beserta bukti',
                'Mencatat pendanaan: setoran modal, prive, setor PPN, setor titipan pajak klien',
                'Melihat semua uang masuk & keluar di tab **Semua**, lengkap dengan siapa yang menginputnya',
                'Transfer antar rekening, termasuk biaya admin',
                'Mengedit & menghapus catatan kas',
                'Export PDF laporan arus kas & Export Excel tab Semua',
            ],
            cannot: [
                'Pembayaran invoice hanya bisa dilihat di sini; ubah lewat halaman Invoice',
                'Pokok utang/piutang hanya bisa dilihat di sini; kelola lewat menu Utang / Piutang',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: [
                'Semua yang bisa dilakukan Finance manager',
                'Memastikan kategori tiap catatan benar, karena kategori menentukan Laba Rugi',
            ],
        },
    ],
    tasks: [
        {
            title: 'Melihat semua uang masuk & keluar',
            role: ROLES.fm,
            steps: [
                'Buka **Arus Kas › Pemasukan & Pengeluaran**. Bila Anda boleh melihat pemasukan **dan** pengeluaran, tab **Semua** terbuka lebih dulu; tab **Pemasukan** dan **Pengeluaran** ada di sebelahnya.',
                'Tab **Semua** menggabungkan pembayaran invoice, pemasukan langsung, pengeluaran, dan pendanaan dalam satu tabel; kolom **Jenis** menandai **Masuk** atau **Keluar**, dan baris pendanaan berbadge **Pendanaan**. Transfer antar rekening tidak termasuk (lihat menu **Transfer & Penyesuaian**).',
                'Kartu **Total masuk**, **Total keluar**, dan **Selisih** mengikuti filter aktif. Di bawah angkanya tertulis berapa yang berasal dari pendanaan, dan selisih **tanpa pendanaan**.',
                'Kolom **Diinput oleh** (layar lebar) menunjukkan siapa yang mencatat; catatan lama dari sebelum fitur ini tampil **Tidak tercatat**. Saring per orang dengan filter **Diinput oleh**.',
                'Klik **Export Excel** untuk mengunduh daftar sesuai filter aktif (semua halaman, urut tanggal): masuk dan keluar di kolom terpisah, lengkap dengan kolom Diinput oleh, dan kolom terakhir **Jenis (Laba Rugi/Pendanaan)**.',
            ],
        },
        {
            title: 'Mencatat pemasukan langsung',
            role: ROLES.fm,
            steps: [
                'Buka **Arus Kas › Pemasukan & Pengeluaran**, lalu klik **Input Pemasukan** (ada di tab **Semua** dan **Pemasukan**).',
                'Isian berurutan dari atas: **Jumlah** yang diterima, lalu **Tanggal** dan **Rekening** penerima (berdampingan; bertumpuk di ponsel).',
                'Pilih **Kategori** (sub-kategori). Kategori belum ada? Klik **+ Tambah** di samping label Kategori.',
                'Di bawah Kategori, kotak **Jurnal · Pratinjau** menunjukkan akun yang didebit dan dikredit (lihat **Membaca kotak Jurnal**); isinya berubah mengikuti Jumlah, Rekening, dan Kategori.',
                'Isi **Deskripsi** (wajib). **Nomor Referensi** dan **Lampiran Bukti** (PDF/JPG/PNG, maks 5 MB, bisa juga tempel gambar dengan Ctrl+V) opsional.',
                'Klik **Simpan Pemasukan**. Form tetap terbuka dan dikosongkan untuk catatan berikutnya; klik **Tutup** bila selesai.',
                'Pembayaran invoice tidak diinput di sini: otomatis tampil dengan sumber **Invoice** setelah dicatat di halaman Invoice.',
            ],
        },
        {
            title: 'Mencatat pengeluaran',
            role: ROLES.fm,
            steps: [
                'Buka **Arus Kas › Pemasukan & Pengeluaran**, lalu klik **Input Pengeluaran** (ada di tab **Semua** dan **Pengeluaran**).',
                'Isi **Jumlah**, lalu **Tanggal** dan **Rekening** sumber, lalu pilih **Kategori** biaya.',
                'Periksa kotak **Jurnal** di bawah Kategori: kategori biaya didebit, rekening dikredit.',
                'Isi **Deskripsi**, tambahkan **Nomor Referensi** (mis. nomor tagihan), dan unggah bukti di **Lampiran Bukti**.',
                'Klik **Simpan Pengeluaran**. Saldo rekening langsung berkurang.',
            ],
        },
        {
            title: 'Mencatat pendanaan (setoran modal, prive, setor PPN)',
            role: ROLES.fm,
            steps: [
                'Pendanaan adalah uang yang menggeser saldo tetapi **bukan** pendapatan atau beban: setoran modal pemilik, prive (penarikan pemilik), setor PPN, dan setor titipan pajak klien.',
                'Pakai tombol yang sama: **Input Pemasukan** untuk setoran modal, **Input Pengeluaran** untuk prive, setor PPN, dan setor titipan pajak.',
                'Di **Kategori**, gulir ke grup paling bawah **Pendanaan · tidak masuk Laba Rugi**, lalu pilih sub-kategorinya (mis. **Setor PPN**). Grup ini belum ada? Minta admin klik **Pakai Template** di halaman Kategori Transaksi.',
                'Kolom Kategori menampilkan penanda **Pendanaan**, dan petunjuk di bawahnya menegaskan: saldo rekening bertambah/berkurang sebesar Jumlah, **Laba Rugi tidak berubah**.',
                'Kotak **Jurnal** memakai akun neraca, bukan nama kategori: Setoran Modal Pemilik → **Modal Pemilik**, Prive Pemilik → **Prive Pemilik**, Setor PPN → **PPN Keluaran**, Setor Titipan Pajak Klien → **Titipan Pajak Klien**.',
                'Isi Jumlah, Tanggal, Deskripsi, lalu simpan. Di daftar, barisnya berbadge **Pendanaan** dan nominalnya masuk kartu **Pendanaan (tidak masuk Laba Rugi)**.',
            ],
        },
        {
            title: 'Transfer antar rekening',
            role: ROLES.fm,
            steps: [
                'Buka **Arus Kas › Transfer & Penyesuaian**, lalu klik **Input Transfer** (tombol muncul bila ada minimal 2 rekening).',
                'Pilih **Rekening Sumber** dan **Rekening Tujuan** (harus berbeda), **Kategori** bertipe transfer, dan **Tanggal**.',
                '**Jumlah Transfer** = uang yang diterima rekening tujuan. **Biaya Admin** (awalnya Rp 2.500) ditambahkan ke potongan rekening sumber.',
                'Periksa ringkasan **Total Debit** dan kotak **Jurnal** di bawah form (rekening tujuan + **Biaya Admin Transfer** didebit, rekening sumber dikredit), isi **Deskripsi**, lalu klik **Lakukan Transfer**.',
            ],
        },
        {
            title: 'Mengedit catatan',
            role: ROLES.fm,
            steps: [
                'Klik baris di tabel (tab **Semua**, **Pemasukan**, atau **Pengeluaran**) untuk membuka dialog **Edit Pemasukan** / **Edit Pengeluaran**.',
                'Urutan isiannya sama dengan dialog Catat. Ubah **Jumlah**, **Tanggal**, **Kategori**, **Deskripsi**, **Nomor Referensi**, atau **Lampiran**, lalu klik **Simpan Perubahan**. Kotak **Jurnal** menampilkan jurnal tersimpan; begitu Jumlah atau Kategori diubah, ia menjadi **Pratinjau** jurnal setelah disimpan.',
                'Tanpa izin ubah, dialognya berupa **Rincian** hanya-lihat (dengan jurnal) tanpa tombol simpan.',
                '**Rekening** tampil nonaktif dan tidak bisa diubah. Salah rekening? Hapus lalu catat ulang.',
                'Transfer hanya bisa diubah **Tanggal** dan **Deskripsi**-nya (berlaku untuk kedua sisi). Salah nominal? Hapus lalu buat transfer baru.',
                'Baris bersumber **Invoice** hanya bisa dilihat (**Detail Pembayaran Invoice**, beserta jurnalnya).',
                'Baris pokok utang/piutang (ikon gembok, tulisan **Hanya-lihat · kelola di Utang/Piutang**) bisa dibuka untuk melihat **Rincian** dan jurnalnya, tetapi tidak bisa diubah atau dihapus di sini. Klik tautannya untuk mengelolanya di menu Utang / Piutang.',
            ],
        },
        {
            title: 'Membaca kotak Jurnal',
            role: ROLES.fm,
            steps: [
                'Setiap catatan menampilkan kotak **Jurnal**: akun mana yang **didebit** dan **dikredit**. Akun kredit ditulis menjorok; baris **Jumlah** di bawah memastikan debit = kredit.',
                'Uang **masuk**: rekening didebit, kategori (pemasukan) dikredit. Uang **keluar**: kategori (biaya) didebit, rekening dikredit. Rekening bank ditulis "nama — bank", kas cukup namanya.',
                '**Pendanaan** memakai akun neraca: Modal Pemilik, Prive Pemilik, PPN Keluaran, Titipan Pajak Klien (pendanaan buatan sendiri memakai namanya). Pokok utang: **Utang Pinjaman – {pemberi pinjaman}**; pokok piutang: **Piutang – {debitur}**.',
                '**Transfer**: rekening tujuan dan **Biaya Admin Transfer** didebit, rekening sumber dikredit.',
                '**Pembayaran invoice**: rekening didebit penuh; kreditnya mengikuti aturan Laba Rugi — menutup **Titipan Pajak Klien** dulu, lalu **PPN Keluaran**, sisanya **Pendapatan dari Invoice**. Uang muka kecil bisa seluruhnya masuk titipan.',
                'Saat mencatat, kotak berlabel **Pratinjau** dan berubah mengikuti isian; sebelum kategori dipilih tampil "Pilih kategori untuk melihat jurnalnya", tanpa Jumlah nominalnya "—".',
                'Jurnal **dihitung otomatis dan tidak disimpan** — belum buku besar: belum ada daftar akun atau saldo per akun.',
            ],
        },
        {
            title: 'Menghapus catatan',
            role: ROLES.admin,
            steps: [
                'Di tab **Pemasukan** atau **Pengeluaran** (tab **Semua** tidak punya hapus massal), centang baris yang akan dihapus, lalu klik **Hapus** di bar yang muncul di bawah layar dan konfirmasi.',
                'Penghapusan permanen. Transfer terhapus kedua sisinya; baris **Invoice** ikut menghapus catatan pembayaran invoice-nya.',
                'Finance manager juga bisa menghapus. Satu catatan pun dihapus lewat centang yang sama (tidak ada tombol hapus di dialog detail).',
                'Baris pokok utang/piutang tidak punya centang dan tidak bisa dihapus dari sini (juga dari Kas & Bank): dikelola menu Utang / Piutang.',
            ],
        },
        {
            title: 'Menyaring & export',
            role: ROLES.fm,
            steps: [
                'Saring dengan **Rentang Tanggal**, **Klien** (Pemasukan), **Kategori**, **Rekening** (Semua, Pengeluaran) / **Rekening Terkait** (Transfer), **Diinput oleh** (Semua, Pemasukan, Pengeluaran), atau kotak **Cari**.',
                'Di tab Pemasukan, filter **Klien** menyembunyikan baris **Langsung**. Di tab Pemasukan dan Semua, filter **Kategori** menyembunyikan pembayaran invoice (tidak berkategori).',
                'Filter **Kategori** punya grup **Pendanaan** di bagian bawah (termasuk kategori pokok utang/piutang di bawah judul **Dari Utang & Piutang**).',
                'Kartu ringkasan mengikuti filter aktif: tab Pemasukan **Pemasukan (masuk Laba Rugi)** · **Pendanaan (tidak masuk Laba Rugi)** · **Total masuk**; tab Pengeluaran **Beban (masuk Laba Rugi)** · **Pendanaan (tidak masuk Laba Rugi)** · **Total keluar**; tab Semua **Total masuk**, **Total keluar**, **Selisih** dengan porsi pendanaannya; halaman Transfer **Total Transfer**, **Jumlah Transaksi**, **Periode**.',
                '**Export PDF** (tab Pemasukan, Pengeluaran, dan halaman Transfer) membuka laporan arus kas rekening (semua mutasi, saldo awal sampai akhir) untuk rentang tanggal terpilih; tanpa rentang = semua waktu. Filter klien & kategori tidak ikut ke PDF. Baris pendanaan berawalan **Pendanaan ·** di kolom uraian.',
                '**Export Excel** (tab Semua) mengunduh daftar persis sesuai semua filter aktif, tanpa saldo berjalan.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Pemasukan & pengeluaran',
            tone: 'act',
            items: [
                'Membuat **1 transaksi bank** (masuk atau keluar) di rekening yang dipilih.',
                'Saldo rekening berubah seketika; saldo selalu dihitung ulang dari semua transaksinya.',
                'Masuk Laba Rugi pada **tanggal transaksi**, di baris sesuai **grup Laba Rugi** kategorinya.',
                'Kategori tanpa grup Laba Rugi (termasuk yang baru dibuat lewat **+ Tambah**) masuk panel **Perlu Diklasifikasi**, belum dihitung.',
            ],
        },
        {
            title: 'Pendanaan',
            tone: 'act',
            items: [
                'Membuat **1 transaksi bank** berkategori pendanaan; saldo rekening berubah seketika.',
                '**Tidak masuk Laba Rugi** di baris mana pun, juga tidak di panel Perlu Diklasifikasi.',
                'Tampil di tab Pemasukan/Pengeluaran/Semua berbadge **Pendanaan**, dihitung di kartu **Pendanaan (tidak masuk Laba Rugi)**, dan berlabel di Export Excel & PDF.',
                'Ikut angka Pemasukan/Pengeluaran bulan ini di **Ringkasan** (sama dengan Total masuk/keluar tab Semua bila tidak ada transfer & penyesuaian).',
                'Pokok utang/piutang yang dicatat menu Utang/Piutang tampil **hanya-lihat**; server menolak ubah/hapusnya dari Arus Kas maupun Kas & Bank.',
            ],
        },
        {
            title: 'Jurnal',
            tone: 'act',
            items: [
                '**Tidak menyimpan apa pun**: jurnal diturunkan dari rekening, kategori, arah, dan jumlah setiap kali tampil. Mengubah kategori/jumlah langsung mengubah jurnalnya, juga untuk catatan lama.',
                'Tidak mengubah saldo maupun Laba Rugi. Pembayaran invoice dipecah dengan rumus **titipan dulu yang sama dengan Laba Rugi**, sehingga kredit "Pendapatan dari Invoice" dan "PPN Keluaran" satu periode sama dengan angka Laba Rugi periode itu.',
                'HPP tidak dijurnal di pembayaran: pengakuan HPP tidak menggerakkan uang.',
                'Belum buku besar: tidak ada bagan akun, saldo per akun, atau jurnal manual (fase terpisah).',
            ],
        },
        {
            title: 'Transfer',
            tone: 'wait',
            items: [
                'Membuat **2 transaksi berpasangan**: keluar di rekening sumber (jumlah + biaya admin) dan masuk di rekening tujuan.',
                'Total kas perusahaan turun sebesar **biaya admin** saja.',
                'Kategori transfer **tidak masuk Laba Rugi**, termasuk biaya adminnya.',
            ],
        },
        {
            title: 'Edit & hapus',
            tone: 'late',
            items: [
                'Mengubah jumlah/kategori/tanggal ikut mengubah saldo & Laba Rugi, termasuk periode lalu.',
                'Menghapus baris **Invoice** menghapus pembayarannya, tetapi **status invoice tetap**.',
                'Menghapus pembayaran Reimbursement ikut menghapus riwayat bayarnya, tetapi status & jumlah dibayarnya tetap.',
                'Mengubah nominal transaksi Reimbursement / Permintaan Dana tidak mengubah pengajuannya.',
            ],
        },
    ],
    records: [
        {
            title: 'Satu transfer = dua transaksi bank',
            subtitle: 'Contoh transfer Rp 10.000.000 dengan biaya admin Rp 6.500 dari BNI ke BCA.',
            rows: [
                { label: 'Keluar (debit)', value: 'BNI - Investasi −Rp 10.006.500', source: 'Jumlah + biaya admin', tone: 'late' },
                { label: 'Deskripsi', value: 'Transfer + Admin Fee - Tambah dana operasional Oktober', source: 'Otomatis', tone: 'neutral' },
                { label: 'Masuk (kredit)', value: 'BCA - Operasional +Rp 10.000.000', source: 'Jumlah Transfer', tone: 'pos' },
                { label: 'Deskripsi', value: 'Transfer masuk - Tambah dana operasional Oktober', source: 'Otomatis', tone: 'neutral' },
                { label: 'Referensi', value: 'TRF + angka waktu (sama di kedua sisi)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Kategori & bukti', value: 'Sama di kedua sisi', source: 'Form transfer', tone: 'act' },
            ],
            note: 'Biaya admin tidak dicatat sebagai baris tersendiri: selisih debit dan kredit itulah biaya adminnya.',
        },
        {
            title: 'Jurnal pembayaran invoice: titipan dulu',
            subtitle: 'Contoh invoice jasa Rp 10.000.000 + titipan pajak klien Rp 500.000 + PPN 11% Rp 1.100.000 (total Rp 11.600.000), dibayar tiga kali.',
            rows: [
                { label: 'Uang muka Rp 300.000', value: 'Kredit Titipan Pajak Klien Rp 300.000', source: 'Titipan belum tertutup', tone: 'wait' },
                { label: 'Pembayaran Rp 4.000.000', value: 'Titipan Rp 200.000 · PPN Keluaran Rp 1.100.000 · Pendapatan dari Invoice Rp 2.700.000', source: 'Sisa titipan, lalu PPN, lalu pendapatan', tone: 'act' },
                { label: 'Pelunasan Rp 7.300.000', value: 'Kredit Pendapatan dari Invoice Rp 7.300.000', source: 'Titipan & PPN sudah tertutup', tone: 'pos' },
                { label: 'Debit setiap pembayaran', value: 'Rekening penerima sebesar pembayaran', source: 'Otomatis', tone: 'neutral' },
            ],
            note: 'Urutan pembayaran mengikuti tanggal bayar (lalu urutan catat). Bukan dibagi proporsional — sama persis dengan cara Laba Rugi mengakui pendapatan.',
        },
    ],
    warnings: [
        { title: 'Pilih kategori dengan teliti', body: 'Kategori menentukan tab tempat catatan tampil dan baris Laba Rugi. Kategori **Transfer** yang dipilih di form Pemasukan/Pengeluaran membuat catatan **hilang** dari tab Semua, Pemasukan, dan Pengeluaran, serta dari Laba Rugi.' },
        { title: 'Setoran modal & setor PPN bukan pendapatan/beban', body: 'Jangan catat setoran modal sebagai pemasukan, atau setor PPN / titipan pajak klien / prive sebagai beban: Laba Rugi jadi salah tanpa tanda. Pakai grup **Pendanaan** di pemilih kategori. Mencatatnya sama sekali tetap wajib, agar saldo rekening cocok dengan bank.' },
        { title: 'Pokok utang/piutang dikelola modulnya', body: 'Baris bergembok berasal dari menu Utang / Piutang. Rinciannya bisa dibuka (hanya-lihat, dengan jurnal), tetapi salah nominal harus diperbaiki dari modul asalnya; Arus Kas dan Kas & Bank menolak mengubah atau menghapusnya.' },
        { title: 'Jurnal bukan buku besar', body: 'Kotak **Jurnal** hanya penjelas otomatis dari rekening & kategori. Ia tidak disimpan, tidak punya saldo per akun, dan tidak menggantikan laporan. Jurnalnya salah? Perbaiki **kategori** atau **jumlah** catatannya — jurnal ikut berubah.' },
        { title: 'Menghapus pembayaran invoice', body: 'Baris **Invoice** di tab Pemasukan bisa ikut terhapus lewat hapus massal. Status invoice tetap (mis. Lunas) walau pembayarannya hilang. Koreksi pembayaran sebaiknya lewat halaman Invoice.' },
        { title: 'Jangan awali referensi dengan "TRF"', body: 'Referensi berawalan **TRF** (termasuk yang diketik saat membayar Reimbursement / mencairkan Permintaan Dana) dianggap transfer: perubahan nominal & kategori diabaikan, dan menghapusnya ikut menghapus semua transaksi berreferensi sama.' },
        { title: 'Penghapusan tidak bisa dibatalkan', body: 'Tidak ada tempat sampah atau riwayat hapus. Menghapus transaksi pembayaran Reimbursement / Permintaan Dana tidak mengembalikan status pengajuannya.' },
    ],
    matrixRoles: [ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat Pemasukan & Pengeluaran (tab Semua, Pemasukan, Pengeluaran) / Transfer', cells: [true, true] },
        { action: 'Input pemasukan & pengeluaran', cells: [true, true] },
        { action: 'Input pendanaan (setoran modal, prive, setor PPN/titipan pajak)', cells: [true, true] },
        { action: 'Mengubah/menghapus pokok utang/piutang dari Arus Kas', cells: [false, false] },
        { action: 'Transfer antar rekening', cells: [true, true] },
        { action: 'Mengedit catatan', cells: [true, true] },
        { action: 'Menghapus catatan', cells: [true, true] },
        { action: 'Export PDF & Export Excel (tab Semua)', cells: [true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
