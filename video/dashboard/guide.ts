import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Ringkasan (dashboard): halaman baca-saja; semua angka dihitung dari modul lain (DashboardController). */
export const guide: ModuleGuide = {
    slug: 'dashboard',
    title: 'Ringkasan',
    group: 'Ringkasan',
    order: 10,
    path: '/dashboard',
    permission: 'view dashboard',
    summary:
        'Halaman pertama setelah masuk: total saldo kas, pemasukan dan pengeluaran bulan berjalan, grafik arus kas, rincian per kategori, invoice yang belum dibayar, saldo tiap rekening, dan transaksi terbaru. Tidak ada yang diinput di sini; semua angka dihitung ulang dari modul lain setiap kali halaman dibuka.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pembaca',
            can: [
                'Melihat ringkasan kas dan invoice **seluruh perusahaan**',
                'Mengganti periode grafik, filter rekening, dan rentang tanggal',
                'Membuka detail invoice yang belum dibayar, atau daftar lengkapnya lewat **Lihat semua**',
                'Membuat invoice lewat **Buat Invoice**',
            ],
            cannot: [
                'Tautan ke Arus Kas, Rekening, dan Laba Rugi tidak tampil (tanpa izin modul itu)',
                'Baris di kartu **Rekening** tetap bisa diklik, tetapi Staff bawaan akan melihat **Akses ditolak**',
            ],
        },
        {
            role: ROLES.fm,
            who: 'Pemantau keuangan',
            can: [
                'Semua yang bisa dilihat Staff',
                'Lanjut ke **Lihat pengeluaran / pemasukan**, **Semua rekening**, dan **Laporan Laba Rugi**',
                'Melihat arus satu rekening lewat filter rekening, lalu mencocokkan mutasinya di **Rekening Bank**',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: [
                'Semua yang bisa dilakukan Finance manager',
                'Menentukan siapa yang boleh membuka Ringkasan lewat izin **view dashboard**',
            ],
        },
    ],
    tasks: [
        {
            title: 'Membaca Ringkasan',
            role: ROLES.staff,
            steps: [
                'Klik **Ringkasan** di menu. Halaman ini juga yang terbuka pertama kali setelah masuk.',
                'Kartu **Arus Kas**: angka besar adalah **Total saldo** semua rekening saat ini. Di bawahnya **Pemasukan**, **Pengeluaran**, dan **Arus bersih** bulan berjalan.',
                'Strip **Sepanjang waktu** di paling bawah merangkum **Pendapatan**, **HPP**, **Laba kotor**, dan **Est. PPh final 0,5%** sejak awal pencatatan.',
                'Baris atas halaman menampilkan jam data diambil (**data per …**). Muat ulang halaman untuk angka terbaru.',
            ],
        },
        {
            title: 'Mengganti periode grafik',
            role: ROLES.staff,
            steps: [
                'Di kartu **Arus Kas**, pilih **Mingguan** (12 minggu), **Bulanan** (6 bulan), atau **Tahunan** (5 tahun).',
                'Pilih rekening di kotak **Semua rekening** untuk melihat grafik satu rekening saja. Total saldo dan angka bulan ini tetap seluruh perusahaan.',
                'Pilihan terakhir diingat di browser Anda dan dipakai lagi saat membuka Ringkasan.',
            ],
        },
        {
            title: 'Memilih rentang tanggal sendiri',
            role: ROLES.staff,
            steps: [
                'Di kartu **Periode Arus Kas**, klik tanggal awal, lalu klik tanggal akhir. Grafik langsung memakai rentang itu dan kartunya berlabel **Dipakai grafik**.',
                'Rentang maksimal sekitar 2 tahun (731 hari). Klik **Batal** atau tekan Escape untuk membatalkan pilihan setengah jadi.',
                'Klik **Kembali ke Bulanan** untuk kembali ke grafik 6 bulan.',
            ],
        },
        {
            title: 'Melihat rincian kategori dan invoice belum dibayar',
            role: ROLES.staff,
            steps: [
                'Kartu donat menampilkan **Pengeluaran** atau **Pemasukan** bulan ini per kategori; klik pilnya untuk berganti. Paling banyak 5 irisan, sisanya digabung jadi **Lainnya**; transaksi tanpa kategori masuk **Lainnya** atau **Tanpa kategori**.',
                'Kartu **Invoice Belum Dibayar** menampilkan 5 invoice terkirim yang belum lunas, yang jatuh temponya paling awal di atas. **Lihat semua** membuka daftar lengkapnya.',
                'Klik salah satu baris: detail invoice terbuka di atas Ringkasan tanpa berpindah halaman. Tombol di dalamnya (mis. **Catat pembayaran**) mengikuti hak akses modul Invoice.',
            ],
        },
        {
            title: 'Melanjutkan ke modul terkait',
            role: ROLES.fm,
            steps: [
                'Klik **Lihat pengeluaran →** atau **Lihat pemasukan →** di bawah donat untuk membuka Arus Kas.',
                'Klik **Semua rekening →** di kartu **Rekening**, atau **Lihat arus kas →** di **Transaksi Terbaru** (membuka **Arus Kas › Pemasukan**).',
                'Klik **Laporan Laba Rugi** di strip **Sepanjang waktu** untuk laporan laba rugi per periode.',
            ],
        },
        {
            title: 'Mengatur siapa yang boleh membuka Ringkasan',
            role: ROLES.admin,
            steps: [
                'Buka **Administrasi › Izin & Peran**, pilih peran, lalu cari **view dashboard**.',
                'Centang untuk mengizinkan. Pengguna tanpa izin ini dialihkan ke **Arus Kas › Pengeluaran** setiap kali membuka Ringkasan, jadi pastikan peran itu punya izin **view expense**.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saldo & rekening',
            tone: 'act',
            items: [
                '**Total saldo** = saldo awal rekening + pembayaran invoice + transaksi masuk − transaksi keluar.',
                'Saldo **tidak disimpan**; dihitung ulang setiap kali halaman dibuka.',
                'Menghapus atau mengubah transaksi lama langsung mengubah saldo dan grafik bulan lalu.',
            ],
        },
        {
            title: 'Arus bulan ini & grafik',
            tone: 'pos',
            items: [
                '**Pemasukan** = semua transaksi bank masuk (termasuk pinjaman yang diterima dan cicilan piutang) + pembayaran invoice.',
                '**Pengeluaran** = semua transaksi bank keluar, termasuk pembayaran reimbursement, pencairan dana, cicilan pinjaman, dan piutang yang diberikan.',
                '**Transfer antar rekening ikut terhitung** di kedua sisi.',
                'Donat memecah per kategori; transaksi tanpa kategori masuk **Lainnya** atau **Tanpa kategori**.',
            ],
        },
        {
            title: 'Invoice & Sepanjang waktu',
            tone: 'wait',
            items: [
                '**Invoice Belum Dibayar** = berstatus terkirim atau sebagian; draft tidak ikut.',
                '**Lewat tempo** dihitung dari tanggal jatuh tempo; status invoice tidak diubah.',
                '**Pendapatan** sepanjang waktu hanya pembayaran invoice.',
                '**HPP** dan **Est. PPh 0,5%** dari item invoice yang sudah dibayar sebagian/lunas.',
            ],
        },
    ],
    records: [
        {
            title: 'Asal setiap angka di Ringkasan',
            subtitle: 'Tidak ada angka yang diketik di halaman ini. Semuanya dihitung dari modul berikut.',
            rows: [
                { label: 'Total saldo', value: 'Saldo awal + pembayaran invoice + masuk − keluar', source: 'Rekening Bank', tone: 'act' },
                { label: 'Pemasukan', value: 'Transaksi masuk + pembayaran invoice (bulan ini)', source: 'Rekening Bank + Invoice', tone: 'pos' },
                { label: 'Pengeluaran', value: 'Semua transaksi keluar (bulan ini)', source: 'Rekening Bank', tone: 'pos' },
                { label: 'Invoice Belum Dibayar', value: 'Sisa tagihan invoice terkirim / sebagian', source: 'Invoice', tone: 'wait' },
                { label: 'Pendapatan', value: 'Semua pembayaran invoice, sejak awal', source: 'Invoice', tone: 'wait' },
                { label: 'Laba kotor', value: 'Pendapatan − HPP item invoice lunas / sebagian', source: 'Invoice', tone: 'wait' },
                { label: 'Est. PPh final 0,5%', value: '0,5% × item invoice lunas / sebagian, selain titipan pajak', source: 'Perkiraan', tone: 'neutral' },
            ],
            note: 'Est. PPh hanya **perkiraan** untuk PPh final UMKM, bukan pajak yang tercatat.',
        },
    ],
    warnings: [
        {
            title: 'Staff ikut melihat seluruh angka perusahaan',
            body: 'Bawaannya peran Staff punya izin **view dashboard**: total saldo, saldo tiap rekening, pendapatan, dan laba kotor. Cabut izin itu bila tidak diinginkan.',
        },
        {
            title: 'Mencabut Ringkasan tanpa memberi Pengeluaran',
            body: 'Pengguna tanpa **view dashboard** dialihkan ke Arus Kas › Pengeluaran. Staff bawaan tidak punya izin itu, sehingga setelah masuk ia langsung melihat halaman **Akses ditolak**, dan tombol **Ke Dashboard** di sana membawanya kembali ke halaman yang sama.',
        },
        {
            title: 'Pemasukan & pengeluaran memuat transfer',
            body: 'Transfer antar rekening sendiri tercatat keluar di satu rekening dan masuk di rekening lain, jadi keduanya ikut menggelembung. Arus bersih tetap benar (selisihnya hanya biaya admin).',
        },
        {
            title: 'Angka lama bisa berubah',
            body: 'Karena semua dihitung ulang, menghapus atau mengedit transaksi, pembayaran, atau rekening lama ikut mengubah saldo, grafik periode lalu, dan angka **Sepanjang waktu**.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat saldo, arus kas, dan invoice', cells: [true, true, true] },
        { action: 'Mengganti periode, rekening, dan rentang', cells: [true, true, true] },
        { action: 'Membuka detail invoice dari daftar', cells: [true, true, true] },
        { action: 'Tautan ke Arus Kas, Rekening, Laba Rugi', cells: [false, true, true] },
        { action: 'Mengatur izin view dashboard', cells: [false, false, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
