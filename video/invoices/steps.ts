import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff menyusun invoice & menyimpan draft. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-list'),
        caption: 'Buka menu Keuangan › Invoice. Daftar menampilkan invoice bulan berjalan untuk semua klien.',
        duration: 110,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].summary,
        zoom: 1.25,
        caption: 'Ringkasan: total ditagih (tanpa draft), yang sudah dan belum dibayar, serta yang perlu ditagih karena lewat jatuh tempo.',
        duration: 140,
    },
    {
        src: img('staff-list'),
        focus: around(S['staff-list'].statusFilter, S['staff-list'].overdue, S['staff-list'].period),
        zoom: 1.45,
        caption: 'Saring daftar per status, per klien, per bulan, atau rentang tanggal. Pil Perlu ditagih mencakup semua bulan.',
        duration: 130,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].create,
        cursor: S['staff-list'].create,
        click: true,
        zoom: 1.6,
        caption: 'Klik Buat Invoice untuk menyusun tagihan baru.',
        duration: 90,
    },
    {
        src: img('staff-create-empty'),
        focus: S['staff-create-empty'].detail,
        zoom: 1.25,
        caption: 'Tanggal invoice terisi hari ini dan jatuh tempo 14 hari kemudian. Nomor belum ada: nomor resmi diberikan saat invoice terbit.',
        duration: 140,
    },
    {
        src: img('staff-create-client'),
        focus: around(S['staff-create-client'].client, S['staff-create-client'].list),
        cursor: S['staff-create-client'].option,
        click: true,
        zoom: 1.35,
        caption: 'Pilih Klien yang ditagih. Email dan NPWP-nya tampil di bawah untuk dicek.',
    },
    {
        src: img('staff-create-catalog'),
        focus: around(S['staff-create-catalog'].catalog1, S['staff-create-catalog'].popover),
        cursor: S['staff-create-catalog'].option,
        click: true,
        zoom: 1.4,
        caption: 'Klik ikon kaca pembesar untuk memilih layanan dari katalog: nama dan harganya langsung terisi. Bisa juga mengetik nama sendiri.',
        duration: 140,
    },
    {
        src: img('staff-create-item1'),
        focus: S['staff-create-item1'].row1,
        cursor: S['staff-create-item1'].cogs1,
        click: true,
        zoom: 1.5,
        caption: 'Lengkapi Satuan dan HPP baris, yaitu modal untuk seluruh baris (bukan per unit). HPP dipakai menghitung laba.',
        duration: 140,
    },
    {
        src: img('staff-create-item2'),
        focus: S['staff-create-item2'].row2,
        cursor: S['staff-create-item2'].cogs2,
        type: S['staff-create-item2'].items,
        zoom: 1.45,
        caption: 'Klik Tambah baris (atau Ctrl+Enter) untuk item berikutnya: Domain & hosting 1 tahun, Rp 900.000, HPP Rp 600.000.',
        duration: 140,
    },
    {
        src: img('staff-create-item2'),
        focus: S['staff-create-item2'].tax1,
        cursor: S['staff-create-item2'].tax1,
        zoom: 2,
        caption: 'Titipan pajak: untuk pajak klien yang hanya dititipkan. Tetap ditagih, tetapi tidak dihitung pendapatan, HPP, atau dasar PPh.',
        duration: 140,
    },
    {
        src: img('staff-create-totals'),
        focus: around(S['staff-create-totals'].total, S['staff-create-totals'].profit),
        zoom: 1.7,
        caption: 'Di bawah: diskon (opsional), Total, Laba kotor, dan perkiraan PPh final 0,5%. Pastikan angkanya benar.',
        duration: 130,
    },
    {
        src: img('staff-create-item2'),
        focus: around(S['staff-create-item2'].draft, S['staff-create-item2'].publish),
        cursor: S['staff-create-item2'].draft,
        click: true,
        zoom: 1.7,
        caption: 'Simpan draft agar diperiksa dulu, atau Simpan & terbitkan untuk langsung memberi nomor. Setelah tersimpan, Staff tidak bisa mengeditnya.',
        duration: 150,
    },
    {
        src: img('staff-drawer-draft'),
        focus: around(S['staff-drawer-draft'].number, S['staff-drawer-draft'].status),
        zoom: 2,
        caption: 'Tersimpan sebagai Draft, belum bernomor. Finance manager akan memeriksa lalu menerbitkannya.',
        chime: true,
        duration: 120,
    },
    {
        src: img('staff-drawer-draft'),
        focus: around(S['staff-drawer-draft'].items, S['staff-drawer-draft'].payments),
        zoom: 1.2,
        caption: 'Detail menampilkan item, HPP, total, klien, dan nanti setiap pembayaran yang masuk.',
        duration: 120,
    },
];

/** Cetak PDF (dipakai Staff & Finance manager). */
export const PRINT_STEPS: Step[] = [
    {
        src: img('print-dialog'),
        focus: S['print-dialog'].type,
        cursor: S['print-dialog'].type,
        zoom: 1.6,
        caption: 'Klik Cetak di invoice bernomor. Pilih jenis tagihan: Penuh, Uang muka (isi nominal DP), atau Pelunasan (sisa, bila sudah dibayar sebagian).',
        duration: 150,
    },
    {
        src: img('print-dialog'),
        focus: around(S['print-dialog'].templates, S['print-dialog'].preview),
        zoom: 1.1,
        caption: 'Pilih template. Pratinjau di kanan adalah PDF yang sama persis dengan hasil unduhan.',
        duration: 130,
    },
    {
        src: img('print-dialog'),
        focus: around(S['print-dialog'].open, S['print-dialog'].download),
        cursor: S['print-dialog'].download,
        click: true,
        zoom: 1.8,
        caption: 'Klik Unduh PDF, lalu kirim ke klien. Aplikasi tidak mengirim email otomatis.',
        duration: 110,
    },
];

/** Finance manager menerbitkan draft. */
export const FM_SEND_STEPS: Step[] = [
    {
        src: img('fm-list-draft'),
        focus: S['fm-list-draft'].statusFilter,
        zoom: 1.6,
        caption: 'Klik pil Draft untuk melihat invoice yang menunggu diterbitkan.',
        duration: 110,
    },
    {
        src: img('fm-list-draft'),
        focus: S['fm-list-draft'].row,
        cursor: S['fm-list-draft'].row,
        click: true,
        zoom: 1.3,
        caption: 'Klik invoice untuk membuka detailnya.',
        duration: 90,
    },
    {
        src: img('fm-drawer-draft'),
        focus: S['fm-drawer-draft'].items,
        zoom: 1.4,
        caption: 'Periksa item, harga, dan HPP. Ada yang salah? Perbaiki lewat menu ••• › Edit invoice.',
        duration: 130,
    },
    {
        src: img('fm-drawer-draft'),
        focus: S['fm-drawer-draft'].send,
        cursor: S['fm-drawer-draft'].send,
        click: true,
        zoom: 1.9,
        caption: 'Sudah benar? Klik Kirim invoice.',
        duration: 90,
    },
    {
        src: img('fm-send'),
        focus: around(S['fm-send'].number, S['fm-send'].hint),
        cursor: S['fm-send'].number,
        zoom: 1.7,
        caption: 'Nomor berikutnya terisi otomatis sesuai format di Pengaturan › Penomoran invoice. Boleh diubah, asal belum dipakai invoice lain.',
        duration: 150,
    },
    {
        src: img('fm-send'),
        focus: S['fm-send'].confirm,
        cursor: S['fm-send'].confirm,
        click: true,
        zoom: 1.8,
        caption: 'Klik Kirim invoice. Klien tidak menerima email otomatis: unduh PDF setelah terbit.',
        duration: 110,
    },
    {
        src: img('fm-drawer-sent'),
        focus: around(S['fm-drawer-sent'].number, S['fm-drawer-sent'].status),
        zoom: 2,
        caption: 'Invoice terbit dengan nomor 001/INV/KSN-GSP/X/2026 dan status Terkirim.',
        chime: true,
        duration: 110,
    },
    {
        src: img('fm-menu'),
        focus: S['fm-menu'].menu,
        cursor: S['fm-menu'].rollback,
        zoom: 1.9,
        caption: 'Salah terbit? Kembalikan ke draft membatalkan nomornya. Hanya untuk nomor urut terakhir di periodenya yang belum dibayar.',
        duration: 150,
    },
];

/** Finance manager mencatat pembayaran. */
export const FM_PAY_STEPS: Step[] = [
    {
        src: img('fm-drawer-sent'),
        focus: S['fm-drawer-sent'].pay,
        cursor: S['fm-drawer-sent'].pay,
        click: true,
        zoom: 1.9,
        caption: 'Uang dari klien sudah masuk? Klik Catat pembayaran.',
        duration: 100,
    },
    {
        src: img('fm-pay-empty'),
        focus: around(S['fm-pay-empty'].amount, S['fm-pay-empty'].chips),
        zoom: 1.6,
        caption: 'Jumlah terisi sisa tagihan. Pilih Sisa penuh, 50%, atau Nominal lain. Tidak boleh melebihi sisa.',
        duration: 130,
    },
    {
        src: img('fm-pay-filled'),
        focus: around(S['fm-pay-filled'].amount, S['fm-pay-filled'].chips),
        cursor: { x: 516, y: 208, w: 50, h: 32 },
        click: true,
        type: around(S['fm-pay-filled'].amount, S['fm-pay-filled'].chips),
        zoom: 1.6,
        caption: 'Klien membayar uang muka 50%: Rp 2.700.000.',
        duration: 110,
    },
    {
        src: img('fm-pay-filled'),
        focus: around(S['fm-pay-filled'].date, S['fm-pay-filled'].account, S['fm-pay-filled'].method),
        cursor: S['fm-pay-filled'].account,
        zoom: 1.6,
        caption: 'Isi tanggal uang diterima, pilih Rekening tujuan (wajib), dan metode Transfer bank atau Tunai.',
        duration: 140,
    },
    {
        src: img('fm-pay-filled'),
        focus: around(S['fm-pay-filled'].reference, S['fm-pay-filled'].upload),
        cursor: S['fm-pay-filled'].reference,
        zoom: 1.5,
        caption: 'Nomor referensi dan bukti transfer (JPG, PNG, PDF, maks 5 MB) membantu saat rekonsiliasi.',
        duration: 130,
    },
    {
        src: img('fm-pay-filled'),
        focus: S['fm-pay-filled'].confirm,
        cursor: S['fm-pay-filled'].confirm,
        click: true,
        zoom: 1.9,
        caption: 'Klik Simpan pembayaran.',
        duration: 80,
    },
    {
        src: img('fm-drawer-partial'),
        focus: S['fm-drawer-partial'].metrics,
        zoom: 1.3,
        caption: 'Status otomatis menjadi Sebagian: sudah dibayar Rp 2.700.000, sisa Rp 2.700.000. Lunas saat sisanya dicatat.',
        chime: true,
        duration: 140,
    },
    {
        src: img('fm-drawer-partial'),
        focus: around(S['fm-drawer-partial'].payments, S['fm-drawer-partial'].history),
        zoom: 1.25,
        caption: 'Setiap pembayaran tercatat di kartu Pembayaran dan Riwayat. Salah catat? Ubah dengan ikon pensil atau hapus.',
        duration: 140,
    },
];

/** Finance manager: menagih yang lewat jatuh tempo & ekspor rekap. */
export const FM_FOLLOWUP_STEPS: Step[] = [
    {
        src: img('fm-overdue'),
        focus: S['fm-overdue'].overdueStat,
        zoom: 1.6,
        caption: 'Kartu Perlu ditagih menjumlahkan sisa tagihan yang sudah lewat jatuh tempo, dari semua bulan.',
        duration: 130,
    },
    {
        src: img('fm-overdue'),
        focus: around(S['fm-overdue'].overdue, S['fm-overdue'].firstRow),
        cursor: S['fm-overdue'].overdue,
        click: true,
        zoom: 1.3,
        caption: 'Pil Perlu ditagih menampilkan daftarnya, lengkap dengan berapa hari terlambat. Cetak tagihannya (Pelunasan bila sudah dicicil) lalu kirim ke klien.',
        duration: 150,
    },
    {
        src: img('fm-export'),
        focus: around(S['fm-export'].export, S['fm-export'].menu),
        cursor: S['fm-export'].menu,
        zoom: 1.8,
        caption: 'Ekspor › Rekap Excel / PDF mengikuti filter aktif: omzet, HPP, profit, PPh final 0,5%, terbayar, dan sisa (tanpa draft).',
        duration: 150,
    },
];

/** Admin: jejak pembayaran invoice di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-drawer-partial'),
        focus: S['admin-drawer-partial'].payments,
        zoom: 1.6,
        caption: 'Pembayaran Rp 2.700.000 ke BCA - Operasional tadi. Mari lihat di mana saja efeknya muncul.',
        duration: 120,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].account,
        zoom: 1.8,
        caption: 'Keuangan › Rekening Bank: saldo BCA - Operasional langsung bertambah. Saldo dihitung dari saldo awal + pembayaran + transaksi.',
        duration: 150,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].income,
        zoom: 1.8,
        caption: 'Total pemasukan rekening itu ikut naik. Tidak ada transaksi bank terpisah yang dibuat.',
        duration: 120,
    },
    {
        src: img('admin-income'),
        focus: S['admin-income'].row,
        zoom: 1.35,
        caption: 'Arus Kas › Pemasukan: muncul sebagai sumber Invoice, dengan nama klien dan nomor invoice.',
        duration: 130,
    },
    {
        src: img('admin-income'),
        focus: around(S['admin-income'].source, S['admin-income'].category),
        zoom: 1.9,
        caption: 'Pemasukan invoice tidak berkategori. Jangan menghapusnya dari sini: status invoice tidak ikut dihitung ulang.',
        duration: 150,
    },
    {
        src: img('admin-pl'),
        focus: around(S['admin-pl'].period, S['admin-pl'].revenue),
        zoom: 1.5,
        caption: 'Laporan › Laba Rugi (basis kas): Rp 2.700.000 masuk Pendapatan dari Invoice pada bulan tanggal bayar.',
        duration: 140,
    },
    {
        src: img('admin-pl'),
        focus: around(S['admin-pl'].cogs, S['admin-pl'].gross),
        zoom: 1.6,
        caption: 'HPP ditutup lebih dulu (cost-recovery): seluruh HPP Rp 2.100.000 diakui sekarang, laba kotor Rp 600.000. Pelunasan nanti jadi laba penuh.',
        duration: 160,
    },
];

/** Admin: penghapusan & pengamannya. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-delete-blocked'),
        focus: S['admin-delete-blocked'].dialog,
        zoom: 1.7,
        caption: 'Invoice yang sudah punya pembayaran tidak bisa dihapus. Hapus pembayarannya dulu.',
        duration: 130,
    },
    {
        src: img('admin-payment-delete'),
        focus: S['admin-payment-delete'].dialog,
        zoom: 1.7,
        caption: 'Menghapus pembayaran langsung menurunkan saldo rekening, pemasukan, dan laba rugi. Status invoice dihitung ulang.',
        duration: 150,
    },
];
