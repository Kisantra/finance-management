import type { Role, Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

export const ROLES = {
    staff: { label: 'Staff', tone: 'act' },
    fm: { label: 'Finance manager', tone: 'pos' },
    admin: { label: 'Admin', tone: 'neg' },
} satisfies Record<string, Role>;

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff mencatat & mengajukan. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-list'),
        caption: 'Buka menu Operasional › Reimbursement. Halaman ini berisi semua pengajuan Anda.',
        duration: 110,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].summary,
        zoom: 1.25,
        caption: 'Ringkasan menunjukkan uang Anda di tiap tahap: menunggu review, menunggu dibayar, dan sudah dibayar.',
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].statusFilter,
        zoom: 1.5,
        caption: 'Pil status menyaring daftar. Angka di sebelahnya adalah jumlah pengajuan.',
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].create,
        cursor: S['staff-list'].create,
        click: true,
        zoom: 1.6,
        caption: 'Klik Buat pengajuan untuk mencatat biaya yang sudah Anda bayar lebih dulu.',
        duration: 100,
    },
    {
        src: img('staff-form-empty'),
        focus: S['staff-form-empty'].sheet,
        caption: 'Form terbuka di panel samping. Isi dari atas ke bawah.',
        duration: 100,
    },
    {
        src: img('staff-form-title'),
        focus: S['staff-form-title'].title,
        cursor: S['staff-form-title'].title,
        click: true,
        type: S['staff-form-title'].title,
        zoom: 1.7,
        caption: 'Judul: tulis singkat untuk apa biaya ini, mis. "Taksi ke kantor PT Sinar Jaya".',
    },
    {
        src: img('staff-form-amount'),
        focus: around(S['staff-form-amount'].amount, S['staff-form-amount'].date),
        cursor: S['staff-form-amount'].amount,
        click: true,
        type: S['staff-form-amount'].amount,
        zoom: 1.7,
        caption: 'Nominal sesuai struk. Tanggal pengeluaran otomatis hari ini, ubah bila biayanya terjadi di hari lain.',
        duration: 140,
    },
    {
        src: img('staff-form-category'),
        focus: around(S['staff-form-category'].category, S['staff-form-category'].list),
        cursor: S['staff-form-category'].option,
        click: true,
        zoom: 1.3,
        caption: 'Pilih kategori biaya: transportasi, makan, perlengkapan kantor, dan lainnya.',
    },
    {
        src: img('staff-form-filled'),
        focus: around(S['staff-form-filled'].category, S['staff-form-filled'].description, S['staff-form-filled'].upload),
        cursor: S['staff-form-filled'].upload,
        zoom: 1.3,
        caption: 'Tambahkan keterangan dan unggah foto struk (JPG, PNG, atau PDF, maksimal 5 MB) agar peninjau bisa memeriksa.',
        duration: 140,
    },
    {
        src: img('staff-form-filled'),
        focus: around(S['staff-form-filled'].draft, S['staff-form-filled'].submit),
        cursor: S['staff-form-filled'].submit,
        click: true,
        zoom: 1.6,
        caption: 'Belum lengkap? Simpan draft. Sudah siap? Klik Ajukan untuk mengirimnya ke peninjau.',
        duration: 130,
    },
    {
        src: img('staff-drawer-pending'),
        focus: S['staff-drawer-pending'].status,
        zoom: 1.8,
        caption: 'Pengajuan terkirim. Statusnya kini Menunggu review.',
        chime: true,
        duration: 100,
    },
    {
        src: img('staff-drawer-pending'),
        focus: S['staff-drawer-pending'].history,
        zoom: 1.5,
        caption: 'Riwayat mencatat setiap langkah dan apa yang sedang ditunggu berikutnya.',
    },
];

/** Finance manager meninjau & membayar. */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-list'),
        focus: S['fm-list'].scope,
        zoom: 1.6,
        caption: 'Finance manager bisa melihat pengajuan semua karyawan, atau hanya pengajuannya sendiri.',
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].statusFilter,
        zoom: 1.5,
        caption: 'Filter Menunggu review menampilkan antrean yang perlu ditinjau.',
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].row,
        cursor: S['fm-list'].row,
        click: true,
        zoom: 1.3,
        caption: 'Klik sebuah pengajuan untuk membuka detailnya.',
        duration: 100,
    },
    {
        src: img('fm-drawer-pending'),
        focus: S['fm-drawer-pending'].proof,
        zoom: 1.3,
        caption: 'Periksa nominal, rincian, dan foto bukti dari pemohon.',
    },
    {
        src: img('fm-drawer-pending'),
        focus: around(S['fm-drawer-pending'].reject, S['fm-drawer-pending'].approve),
        cursor: S['fm-drawer-pending'].approve,
        click: true,
        zoom: 1.8,
        caption: 'Semua sesuai? Klik Setujui. Ada yang kurang? Klik Tolak.',
    },
    {
        src: img('fm-approve-empty'),
        focus: S['fm-approve-empty'].category,
        cursor: S['fm-approve-empty'].category,
        click: true,
        zoom: 1.6,
        caption: 'Saat menyetujui, pilih kategori akuntansi. Kategori ini dipakai untuk mencatat transaksi bank saat dibayar.',
        duration: 140,
    },
    {
        src: img('fm-approve-filled'),
        focus: around(S['fm-approve-filled'].category, S['fm-approve-filled'].notes),
        cursor: S['fm-approve-filled'].notes,
        type: around(S['fm-approve-filled'].category, S['fm-approve-filled'].notes),
        zoom: 1.6,
        caption: 'Catatan untuk pemohon boleh diisi atau dikosongkan.',
    },
    {
        src: img('fm-approve-filled'),
        focus: S['fm-approve-filled'].confirm,
        cursor: S['fm-approve-filled'].confirm,
        click: true,
        zoom: 1.8,
        caption: 'Klik Setujui.',
        duration: 80,
    },
    {
        src: img('fm-drawer-approved'),
        focus: S['fm-drawer-approved'].status,
        zoom: 1.8,
        caption: 'Status berubah menjadi Disetujui. Sekarang pengajuan menunggu pembayaran.',
        chime: true,
        duration: 100,
    },
    {
        src: img('fm-drawer-approved'),
        focus: S['fm-drawer-approved'].pay,
        cursor: S['fm-drawer-approved'].pay,
        click: true,
        zoom: 1.8,
        caption: 'Klik Bayar untuk mencairkan dana ke pemohon.',
        duration: 100,
    },
    {
        src: img('fm-pay'),
        focus: S['fm-pay'].account,
        cursor: S['fm-pay'].account,
        zoom: 1.6,
        caption: 'Pilih rekening sumber dana. Saldonya ikut ditampilkan.',
    },
    {
        src: img('fm-pay'),
        focus: around(S['fm-pay'].date, S['fm-pay'].amount),
        cursor: S['fm-pay'].amount,
        zoom: 1.6,
        caption: 'Nominal otomatis terisi sisa tagihan. Isi lebih kecil untuk mencicil; status tetap Disetujui sampai lunas.',
        duration: 150,
    },
    {
        src: img('fm-pay'),
        focus: around(S['fm-pay'].reference, S['fm-pay'].confirm),
        cursor: S['fm-pay'].confirm,
        click: true,
        zoom: 1.5,
        caption: 'Isi nomor referensi transfer (opsional), lalu klik Bayar lunas.',
    },
    {
        src: img('fm-drawer-paid'),
        focus: S['fm-drawer-paid'].metrics,
        zoom: 1.3,
        caption: 'Lunas! Pembayaran otomatis tercatat sebagai transaksi keluar di rekening bank.',
        chime: true,
        duration: 130,
    },
    {
        src: img('fm-drawer-paid'),
        focus: S['fm-drawer-paid'].history,
        zoom: 1.4,
        caption: 'Riwayatnya lengkap: dibuat, disetujui, lalu dibayar.',
        duration: 100,
    },
];

/** Finance manager menolak pengajuan. */
export const REJECT_FM_STEPS: Step[] = [
    {
        src: img('fm-reject'),
        focus: S['fm-reject'].notes,
        cursor: S['fm-reject'].notes,
        zoom: 1.6,
        caption: 'Menolak wajib disertai alasan, agar pemohon tahu apa yang harus diperbaiki.',
        duration: 130,
    },
    {
        src: img('fm-reject'),
        focus: S['fm-reject'].confirm,
        cursor: S['fm-reject'].confirm,
        click: true,
        zoom: 1.8,
        caption: 'Klik Tolak pengajuan. Pemohon akan melihat alasannya dan bisa memperbaiki lalu mengajukan ulang.',
        duration: 130,
    },
];

/** Staff menindaklanjuti pengajuan yang ditolak. */
export const REJECT_STAFF_STEPS: Step[] = [
    {
        src: img('staff-drawer-rejected'),
        focus: S['staff-drawer-rejected'].banner,
        zoom: 1.4,
        caption: 'Bila ditolak, buka pengajuannya untuk melihat siapa yang menolak beserta alasannya.',
        duration: 130,
    },
    {
        src: img('staff-drawer-rejected'),
        focus: S['staff-drawer-rejected'].resubmit,
        cursor: S['staff-drawer-rejected'].resubmit,
        click: true,
        zoom: 1.7,
        caption: 'Klik Perbaiki & ajukan ulang. Setelah diperbaiki dan diajukan, statusnya kembali Menunggu review.',
        duration: 150,
    },
];

/** Admin. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-list'),
        focus: S['admin-list'].scope,
        zoom: 1.6,
        caption: 'Admin memiliki semua akses Finance manager. Cara menyetujui dan membayar ada di tab Finance manager.',
        duration: 130,
    },
    {
        src: img('admin-drawer-menu'),
        focus: S['admin-drawer-menu'].menu,
        cursor: S['admin-drawer-menu'].menu,
        zoom: 1.9,
        caption: 'Hanya Admin yang bisa menghapus pengajuan siapa pun, lewat menu ••• › Hapus pengajuan, selama belum ada pembayaran.',
        duration: 150,
    },
];

/** Admin: jejak sebuah pembayaran di modul lain (riwayat → rekening → arus kas → laba rugi). */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('fm-drawer-paid'),
        focus: S['fm-drawer-paid'].history,
        zoom: 1.4,
        caption: 'Setiap pembayaran tercatat di riwayat pengajuan: tanggal, nominal, rekening sumber, dan siapa yang membayar.',
        duration: 150,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].account,
        zoom: 1.7,
        caption: 'Di Keuangan › Rekening Bank, saldo rekening sumber langsung berkurang sebesar nominal yang dibayar.',
        duration: 150,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].expenseStat,
        zoom: 1.7,
        caption: 'Total pengeluaran rekening itu ikut bertambah. Saldo selalu dihitung ulang dari semua transaksinya.',
        duration: 140,
    },
    {
        src: img('admin-expenses'),
        focus: S['admin-expenses'].row,
        zoom: 1.3,
        caption: 'Di Arus Kas › Pengeluaran, pembayaran muncul sebagai transaksi keluar dengan deskripsi otomatis dan nomor referensinya.',
        duration: 160,
    },
    {
        src: img('admin-expenses'),
        focus: S['admin-expenses'].category,
        zoom: 2,
        caption: 'Kategorinya adalah kategori akuntansi yang dipilih saat menyetujui, bukan kategori biaya yang dipilih pemohon.',
        duration: 150,
    },
    {
        src: img('admin-pl'),
        focus: S['admin-pl'].beban,
        zoom: 1.4,
        caption: 'Di Laporan › Laba Rugi, nominalnya masuk ke Beban Operasional pada bulan pembayaran (laporan berbasis kas).',
        duration: 150,
    },
    {
        src: img('admin-pl'),
        focus: S['admin-pl'].opexLine,
        zoom: 1.8,
        caption: 'Posisinya mengikuti grup laba rugi kategori tersebut. Kategori OPERASIONAL berada di grup Beban Operasional.',
        duration: 140,
    },
    {
        src: img('admin-pl'),
        focus: S['admin-pl'].unclassified,
        zoom: 1.2,
        caption: 'Kategori yang belum punya grup laba rugi tidak dihitung, tetapi muncul di panel Perlu Diklasifikasi sampai diatur.',
        duration: 160,
    },
];
