import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Finance manager mencatat pinjaman baru. */
export const CREATE_STEPS: Step[] = [
    {
        src: img('fm-list'),
        caption: 'Buka menu Utang & Piutang › Pinjaman. Di sini tercatat semua pinjaman yang diterima perusahaan.',
        duration: 110,
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].stats,
        zoom: 1.3,
        caption: 'Ringkasan: jumlah pinjaman, yang masih aktif, total pokok, dan pokok dari pinjaman yang belum lunas.',
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].row,
        zoom: 1.3,
        caption: 'Setiap baris menampilkan pokok, bunga, tenor, jatuh tempo, dan Sisa Pokok yang belum dibayar.',
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].create,
        cursor: S['fm-list'].create,
        click: true,
        zoom: 1.7,
        caption: 'Klik Tambah Pinjaman untuk mencatat pinjaman yang baru diterima.',
        duration: 100,
    },
    {
        src: img('fm-form-empty'),
        focus: S['fm-form-empty'].number,
        zoom: 1.6,
        caption: 'Nomor Pinjaman terisi otomatis. Boleh diganti, misalnya dengan nomor kontrak, asal belum pernah dipakai.',
    },
    {
        src: img('fm-form-lender'),
        focus: S['fm-form-lender'].lender,
        cursor: S['fm-form-lender'].lender,
        click: true,
        type: S['fm-form-lender'].lender,
        zoom: 1.7,
        caption: 'Pemberi Pinjaman: nama bank, koperasi, atau perorangan, mis. PT BPR Dana Makmur.',
    },
    {
        src: img('fm-form-amount'),
        focus: S['fm-form-amount'].amount,
        cursor: S['fm-form-amount'].amount,
        click: true,
        type: S['fm-form-amount'].amount,
        zoom: 1.7,
        caption: 'Jumlah Pokok: dana yang diterima. Ketik angkanya saja, format rupiah muncul otomatis.',
    },
    {
        src: img('fm-form-rate'),
        focus: around(S['fm-form-rate'].interestType, S['fm-form-rate'].rate),
        cursor: S['fm-form-rate'].rate,
        click: true,
        type: S['fm-form-rate'].rate,
        zoom: 1.5,
        caption: 'Persentase (% p.a.) berarti suku bunga per tahun. Pilih Tetap (fixed) bila bunganya berupa nominal total.',
        duration: 150,
    },
    {
        src: img('fm-form-tenor'),
        focus: S['fm-form-tenor'].tenor,
        cursor: S['fm-form-tenor'].tenor,
        click: true,
        type: S['fm-form-tenor'].tenor,
        zoom: 1.6,
        caption: 'Isi Tenor (bulan). Jatuh Tempo di bawahnya terisi otomatis: Tanggal Mulai ditambah tenor.',
        duration: 130,
    },
    {
        src: img('fm-form-bank'),
        focus: around(S['fm-form-bank'].bank, S['fm-form-bank'].list),
        cursor: S['fm-form-bank'].option,
        click: true,
        zoom: 1.3,
        caption: 'Rekening Penerima wajib dipilih: dana pokok otomatis dicatat masuk ke rekening ini pada Tanggal Mulai.',
        duration: 150,
    },
    {
        src: img('fm-form-filled'),
        focus: around(S['fm-form-filled'].purpose, S['fm-form-filled'].upload),
        cursor: S['fm-form-filled'].upload,
        zoom: 1.4,
        caption: 'Tambahkan tujuan pinjaman dan unggah dokumen kontrak (PDF, JPG, atau PNG, maksimal 5 MB).',
    },
    {
        src: img('fm-form-filled'),
        focus: S['fm-form-filled'].save,
        cursor: S['fm-form-filled'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Pinjaman.',
        duration: 80,
    },
    {
        src: img('fm-list-after'),
        focus: S['fm-list-after'].row,
        zoom: 1.3,
        caption: 'Pinjaman tercatat dengan status Aktif. Sisa Pokok masih penuh karena belum ada angsuran.',
        chime: true,
        duration: 130,
    },
    {
        src: img('fm-list-after'),
        focus: S['fm-list-after'].stats,
        zoom: 1.3,
        caption: 'Ringkasan ikut bertambah, dan Rp 50.000.000 otomatis tercatat masuk ke rekening BCA - Operasional.',
        duration: 130,
    },
];

/** Finance manager membayar angsuran. */
export const PAY_STEPS: Step[] = [
    {
        src: img('fm-list'),
        focus: S['fm-list'].row,
        cursor: S['fm-list'].row,
        click: true,
        zoom: 1.3,
        caption: 'Klik baris pinjaman untuk membuka detailnya. Ikon uang di kolom Aksi juga langsung membuka form bayar.',
        duration: 130,
    },
    {
        src: img('fm-detail'),
        focus: S['fm-detail'].progress,
        zoom: 1.4,
        caption: 'Detail menampilkan pokok, bunga beserta total bunganya, dan progres pembayaran pokok.',
    },
    {
        src: img('fm-detail'),
        focus: S['fm-detail'].pay,
        cursor: S['fm-detail'].pay,
        click: true,
        zoom: 1.6,
        caption: 'Klik Catat Pembayaran.',
        duration: 80,
    },
    {
        src: img('fm-pay-empty'),
        focus: S['fm-pay-empty'].summary,
        zoom: 1.6,
        caption: 'Bagian atas menunjukkan Sisa Pokok dan Sisa Bunga pinjaman ini.',
        duration: 110,
    },
    {
        src: img('fm-pay-principal'),
        focus: around(S['fm-pay-principal'].bank, S['fm-pay-principal'].date),
        cursor: S['fm-pay-principal'].bank,
        click: true,
        zoom: 1.5,
        caption: 'Pilih Rekening Pembayaran (saldonya ikut tampil). Tanggal Pembayaran tidak boleh setelah hari ini.',
        duration: 140,
    },
    {
        src: img('fm-pay-principal'),
        focus: S['fm-pay-principal'].principal,
        cursor: S['fm-pay-principal'].principal,
        type: S['fm-pay-principal'].principal,
        zoom: 1.7,
        caption: 'Isi Pembayaran Pokok. Angka "maks." hanya informasi; sistem tidak menolak nominal yang lebih besar.',
        duration: 140,
    },
    {
        src: img('fm-pay-filled'),
        focus: around(S['fm-pay-filled'].interest, S['fm-pay-filled'].notes),
        cursor: S['fm-pay-filled'].interest,
        type: around(S['fm-pay-filled'].interest, S['fm-pay-filled'].notes),
        zoom: 1.4,
        caption: 'Isi Pembayaran Bunga, nomor referensi transfer, dan catatan. Minimal pokok atau bunga harus terisi.',
        duration: 140,
    },
    {
        src: img('fm-pay-save'),
        focus: S['fm-pay-save'].save,
        cursor: S['fm-pay-save'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Pembayaran.',
        duration: 80,
    },
    {
        src: img('fm-detail-after'),
        focus: S['fm-detail-after'].progress,
        zoom: 1.5,
        caption: 'Progres naik menjadi 25%, sisa pokok Rp 90.000.000. Saat sisa pokok habis, status otomatis Lunas.',
        chime: true,
        duration: 140,
    },
    {
        src: img('fm-list-after'),
        focus: S['fm-list-after'].mandiriRemaining,
        zoom: 2,
        caption: 'Sisa Pokok di daftar ikut diperbarui.',
        duration: 90,
    },
];

/** Admin: jejak pinjaman di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].account,
        zoom: 1.7,
        caption: 'Di Keuangan › Rekening Bank, saldo BCA - Operasional ikut naik saat dana pinjaman masuk dan turun saat angsuran dibayar.',
        duration: 150,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].credit,
        zoom: 1.5,
        caption: 'Saat pinjaman disimpan: satu transaksi masuk sebesar pokok, dengan referensi nomor pinjaman.',
        duration: 140,
    },
    {
        src: img('admin-bank'),
        focus: around(S['admin-bank'].principal, S['admin-bank'].interest),
        zoom: 1.4,
        caption: 'Saat angsuran dibayar: pokok dan bunga menjadi dua transaksi keluar dengan nomor referensi yang sama.',
        duration: 150,
    },
    {
        src: img('admin-expenses'),
        focus: S['admin-expenses'].table,
        zoom: 1.25,
        caption: 'Di Arus Kas › Pengeluaran hanya bunganya yang muncul (Beban Bunga Pinjaman). Pokok pinjaman bukan biaya.',
        duration: 160,
    },
];

/** Admin: menghapus pinjaman. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-list'),
        focus: around(S['admin-list'].actions, S['admin-list'].paidRow),
        zoom: 1.5,
        caption: 'Ikon Hapus hanya ada pada pinjaman yang belum dibayar pokoknya. Pinjaman Lunas tidak punya aksi apa pun.',
        duration: 140,
    },
    {
        src: img('admin-delete'),
        focus: S['admin-delete'].dialog,
        zoom: 1.6,
        caption: 'Menghapus pinjaman tidak menghapus transaksi dana masuknya di rekening. Koreksi di Rekening Bank bila perlu.',
        duration: 150,
    },
];
