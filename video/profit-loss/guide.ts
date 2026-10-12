import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan Laba Rugi — isi selaras dengan docs/module/profit-loss.md dan ProfitLossService. */
export const guide: ModuleGuide = {
    slug: 'profit-loss',
    title: 'Laba Rugi',
    group: 'Laporan',
    order: 10,
    path: '/reports/profit-loss',
    permission: 'view profit-loss',
    summary:
        'Laporan laba rugi **berbasis kas** yang tersusun otomatis: pendapatan invoice dari pembayaran yang diterima, HPP invoice, dan transaksi Arus Kas yang dikelompokkan menurut **grup Laba Rugi** kategorinya. Tidak ada input angka di halaman ini; tugas Anda memilih periode dan memastikan semua kategori sudah diklasifikasi. Staff tidak punya akses ke laporan ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pembaca & pengklasifikasi',
            can: [
                'Melihat laporan per periode (preset atau rentang tanggal)',
                'Mengklasifikasi kategori di panel **Perlu Diklasifikasi**',
                'Mengunduh laporan sebagai PDF',
            ],
            cannot: ['Tidak bisa mengubah angka langsung; koreksi di Invoice atau Arus Kas'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Menjaga grup Laba Rugi tiap kategori tetap benar'],
        },
    ],
    tasks: [
        {
            title: 'Membaca laporan',
            role: ROLES.fm,
            steps: [
                'Buka **Laporan › Laba Rugi**. Periode awal adalah **Tahun berjalan** (1 Januari sampai hari ini).',
                'Pilih preset **Bulan ini**, **Bulan lalu**, **Tahun berjalan**, atau **Tahun lalu**; atau atur rentang tanggal lalu klik **Terapkan**.',
                'Urutan laporan: Pendapatan → HPP → **Laba Kotor** → Beban Operasional → **Laba Usaha** → Pendapatan & Beban Lain (bila ada) → **Laba Sebelum Pajak** → Pajak Perusahaan (bila ada) → **Laba Bersih**.',
                'Pendapatan dihitung saat **uang masuk** (tanggal bayar invoice / tanggal transaksi), bukan saat invoice diterbitkan.',
            ],
        },
        {
            title: 'Mengklasifikasi kategori',
            role: ROLES.fm,
            steps: [
                'Panel **Perlu Diklasifikasi** di kanan berisi kategori yang transaksinya belum masuk laporan, beserta totalnya.',
                'Pada kartu kategori, buka **Pilih grup L/R →** lalu pilih grupnya: Pemasukan → **Pendapatan Usaha** / **Pendapatan Lain**; Pengeluaran → **Harga Pokok (HPP)** / **Beban Operasional** / **Beban Lain** / **Pajak Perusahaan**.',
                'Laporan langsung dihitung ulang dan kartu hilang dari panel. Bila semua beres, panel menampilkan **Semua sudah diklasifikasi**.',
                'Grup juga bisa diatur di **Operasional › Kategori Transaksi**: ikon pensil pada kategori › **Grup Laba Rugi (opsional)**; hasilnya tampil di kolom **Grup L/R**. Baris **(Tanpa Kategori)** harus diberi kategori dulu di transaksi rekening.',
            ],
        },
        {
            title: 'Mengunduh PDF',
            role: ROLES.fm,
            steps: ['Atur periode, lalu klik **Unduh PDF**. File berisi periode yang sedang tampil, dengan kop perusahaan.'],
        },
    ],
    impacts: [
        {
            title: 'Dari mana angkanya',
            tone: 'act',
            items: [
                '**Pendapatan dari Invoice**: pembayaran invoice yang diterima di periode, setelah dikurangi item titipan pajak.',
                '**HPP Invoice**: HPP item invoice, diakui seiring pembayaran masuk (uang menutup modal dulu).',
                'Baris lain: transaksi **Arus Kas** per grup Laba Rugi kategorinya, termasuk pembayaran reimbursement & pencairan permintaan dana.',
            ],
        },
        {
            title: 'Saat mengklasifikasi',
            tone: 'wait',
            items: [
                'Grup disimpan pada **kategori**, berlaku untuk semua transaksinya.',
                'Laporan periode lama ikut berubah (berlaku mundur).',
                'Butuh izin kelola kategori; Admin & Finance manager memilikinya.',
            ],
        },
        {
            title: 'Yang tidak dihitung',
            tone: 'late',
            items: [
                'Kategori bertipe Transfer, Pendanaan & Penyesuaian (transfer antar rekening, pinjaman, modal, pokok piutang); tidak muncul juga di panel Perlu Diklasifikasi.',
                'Biaya admin transfer (ikut kategori transfer).',
                'Kategori yang belum diklasifikasi, sampai dipilihkan grupnya.',
                'Invoice yang belum dibayar.',
            ],
        },
    ],
    records: [
        {
            title: 'Asal setiap baris laporan',
            subtitle: 'Koreksi angka di sumbernya, bukan di laporan.',
            rows: [
                { label: 'Pendapatan invoice', value: 'Pendapatan dari Invoice (kas)', source: 'Pembayaran invoice', tone: 'act' },
                { label: 'Pendapatan lainnya', value: 'Baris per kategori di Pendapatan', source: 'Pemasukan · Pendapatan Usaha', tone: 'pos' },
                { label: 'HPP', value: 'HPP Invoice + baris per kategori', source: 'Item invoice · Pengeluaran HPP', tone: 'wait' },
                { label: 'Beban Operasional', value: 'Baris per kategori', source: 'Pengeluaran · Beban Operasional', tone: 'late' },
                { label: 'Lain-lain', value: 'Pendapatan & Beban Lain (netto)', source: 'Grup Pendapatan / Beban Lain', tone: 'neutral' },
                { label: 'Pajak', value: 'Pajak Perusahaan', source: 'Pengeluaran · Pajak Perusahaan', tone: 'neutral' },
            ],
            note: 'Panel **Perlu Diklasifikasi** tidak dijumlahkan ke baris mana pun.',
        },
    ],
    warnings: [
        { title: 'Laba bersih belum final', body: 'Selama panel **Perlu Diklasifikasi** masih berisi, ada transaksi yang belum dihitung. Klasifikasikan dulu sebelum mengunduh atau melaporkan.' },
        { title: 'Reklasifikasi mengubah laporan lama', body: 'Mengganti grup sebuah kategori ikut mengubah laporan periode yang sudah lewat, termasuk yang PDF-nya mungkin sudah dibagikan.' },
        { title: 'Hindari HPP ganda', body: 'Jangan catat pengeluaran berkategori HPP untuk penjualan yang modalnya sudah diisi di item invoice; sistem tidak mencegahnya dan laba jadi terlalu kecil.' },
        { title: 'Angka mengikuti Arus Kas & Invoice', body: 'Menghapus atau mengubah transaksi/pembayaran di Arus Kas langsung mengubah laporan, termasuk periode yang sudah ditutup.' },
    ],
    matrixRoles: [ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat laporan & memilih periode', cells: [true, true] },
        { action: 'Mengklasifikasi kategori', cells: [true, true] },
        { action: 'Unduh PDF', cells: [true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
