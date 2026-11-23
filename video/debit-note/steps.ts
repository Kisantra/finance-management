import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff membuat Debit Note talangan sampai terbit. */
export const STAFF_TALANGAN_STEPS: Step[] = [
    {
        src: img('staff-list'),
        focus: around(S['staff-list'].dnRow, S['staff-list'].dnBadge),
        zoom: 1.35,
        caption: 'Debit Note ada di menu yang sama dengan invoice: Keuangan › Invoice. Di daftar, ia ditandai label Debit Note.',
        duration: 140,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].create,
        cursor: S['staff-list'].create,
        click: true,
        zoom: 1.6,
        caption: 'Untuk membuatnya, klik Buat Invoice.',
        duration: 90,
    },
    {
        src: img('staff-new'),
        focus: S['staff-new'].type,
        cursor: S['staff-new'].debitNote,
        click: true,
        zoom: 1.5,
        caption: 'Pada Jenis dokumen, pilih Debit Note.',
        duration: 100,
    },
    {
        src: img('staff-type'),
        focus: around(S['staff-type'].title, S['staff-type'].type),
        zoom: 1.3,
        caption: 'Judul halaman berubah menjadi Buat Debit Note. Selebihnya, cara mengisinya sama dengan invoice.',
        duration: 120,
    },
    {
        src: img('staff-code'),
        focus: around(S['staff-code'].code, S['staff-code'].codeHint),
        type: around(S['staff-code'].code, S['staff-code'].codeHint),
        zoom: 1.6,
        caption: 'Isi Kode jenis sesuai biayanya, mis. PNBP. Petunjuk di bawahnya menunjukkan hasilnya di nomor: DN-PNBP.',
        duration: 150,
    },
    {
        src: img('staff-code'),
        focus: around(S['staff-code'].nature, S['staff-code'].natureInfo),
        zoom: 1.35,
        caption: 'Isi Debit Note: biarkan Talangan untuk biaya yang diganti klien. Ditagih tanpa PPN, tanpa PPh, dan bukan pendapatan.',
        duration: 170,
    },
    {
        src: img('staff-client'),
        focus: around(S['staff-client'].client, S['staff-client'].subject),
        zoom: 1.35,
        caption: 'Pilih klien, lalu isi Perihal agar klien tahu biaya apa yang diminta kembali.',
        duration: 140,
    },
    {
        src: img('staff-item'),
        focus: around(S['staff-item'].name1, S['staff-item'].price1),
        zoom: 1.45,
        caption: 'Tulis nama biaya dan harga persis sebesar yang dibayar perusahaan: PNBP jasa labuh, Rp 4.250.000.',
        duration: 150,
    },
    {
        src: img('staff-item'),
        focus: S['staff-item'].desc1,
        zoom: 1.5,
        caption: 'Klik Tambah keterangan untuk mencatat buktinya, mis. nomor NTPN dan tanggal bayar. Keterangan ikut tercetak.',
        duration: 150,
    },
    {
        src: img('staff-totals'),
        focus: S['staff-totals'].summary,
        zoom: 1.45,
        caption: 'Ringkasan menulis Talangan, bukan Subtotal layanan. Totalnya tanpa PPN dan tanpa potongan PPh.',
        duration: 140,
    },
    {
        src: img('staff-publish'),
        focus: S['staff-publish'].dialog,
        cursor: S['staff-publish'].confirm,
        click: true,
        zoom: 1.25,
        caption: 'Klik Simpan & terbitkan. Dialog menunjukkan nomor Debit Note berikutnya; klik Terbitkan.',
        duration: 140,
    },
    {
        src: img('staff-drawer'),
        focus: around(S['staff-drawer'].number, S['staff-drawer'].status),
        zoom: 1.6,
        chime: true,
        caption: 'Selesai: Debit Note terbit dengan nomor …/DN-PNBP/… dan status Terbit. Nomornya satu urutan dengan invoice.',
        duration: 150,
    },
    {
        src: img('staff-drawer'),
        focus: S['staff-drawer'].talangan,
        zoom: 1.6,
        caption: 'Kartu Talangan mengingatkan: uang ini diganti klien, bukan pendapatan. PDF dari tombol Cetak berjudul DEBIT NOTE.',
        duration: 150,
    },
];

/** Staff memilih sifat Tagihan jasa (tidak disimpan). */
export const STAFF_JASA_STEPS: Step[] = [
    {
        src: img('staff-jasa'),
        focus: around(S['staff-jasa'].nature, S['staff-jasa'].natureInfo),
        cursor: S['staff-jasa'].jasa,
        click: true,
        zoom: 1.35,
        caption: 'Bila isinya jasa perusahaan sendiri (mis. stevedoring untuk klien luar negeri), pilih Tagihan jasa.',
        duration: 150,
    },
    {
        src: img('staff-jasa-totals'),
        focus: around(S['staff-jasa-totals'].ppn, S['staff-jasa-totals'].pph),
        zoom: 1.3,
        caption: 'Sakelar PPN dan PPh 23 muncul lagi. Debit Note ini dihitung persis seperti invoice dan masuk pendapatan.',
        duration: 160,
    },
];

/** Admin menyalakan Debit Note untuk perusahaan. */
export const ADMIN_SETUP_STEPS: Step[] = [
    {
        src: img('admin-profile'),
        focus: S['admin-profile'].section,
        zoom: 1.35,
        caption: 'Debit Note dinyalakan sekali per perusahaan di Pengaturan › Profil perusahaan, bagian Debit Note.',
        duration: 140,
    },
    {
        src: img('admin-profile'),
        focus: S['admin-profile'].section,
        cursor: S['admin-profile'].check,
        click: true,
        zoom: 1.35,
        caption: 'Centang Perusahaan ini menerbitkan Debit Note, lalu Simpan Perubahan. Bagian ini hanya ada di perusahaan yang punya desain Debit Note.',
        duration: 170,
    },
];

/** Admin melihat jejak Debit Note talangan di pembayaran dan Arus Kas (tidak disimpan). */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-pay'),
        focus: around(S['admin-pay'].amount, S['admin-pay'].account),
        zoom: 1.3,
        caption: 'Saat klien mengganti biaya, catat pembayarannya seperti invoice: jumlah, tanggal, dan rekening tujuan.',
        duration: 140,
    },
    {
        src: img('admin-pay'),
        focus: S['admin-pay'].journal,
        zoom: 1.4,
        caption: 'Jurnalnya: rekening bertambah, kreditnya Talangan Biaya Klien. Tidak ada pendapatan atau PPN.',
        duration: 150,
    },
    {
        src: img('admin-expense'),
        focus: S['admin-expense'].category,
        zoom: 1.55,
        caption: 'Biaya yang perusahaan bayar ke negara dicatat di Arus Kas › Pengeluaran, kategori Bayar Talangan Klien.',
        duration: 150,
    },
    {
        src: img('admin-expense'),
        focus: around(S['admin-expense'].hint, S['admin-expense'].journal),
        zoom: 1.3,
        caption: 'Kategori Pendanaan: saldo berkurang, Laba Rugi tidak berubah. Dengan pembayaran klien, kedua jurnal saling menutup.',
        duration: 170,
    },
];
