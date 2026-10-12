import type { Step } from '../components/walkthrough';
import { ROLES } from '../roles';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Finance manager: halaman Pemasukan + mencatat pemasukan langsung. */
export const INCOME_STEPS: Step[] = [
    {
        src: img('fm-income-list'),
        caption: 'Buka menu Arus Kas › Pemasukan. Semua uang yang masuk ke rekening perusahaan terkumpul di sini.',
        duration: 110,
    },
    {
        src: img('fm-income-list'),
        focus: S['fm-income-list'].rows,
        zoom: 1.2,
        caption: 'Kolom Sumber membedakan pembayaran Invoice (otomatis dari halaman Invoice) dan pemasukan Langsung yang dicatat di sini.',
        duration: 150,
    },
    {
        src: img('fm-income-list'),
        focus: S['fm-income-list'].create,
        cursor: S['fm-income-list'].create,
        click: true,
        zoom: 1.7,
        caption: 'Klik Input Pemasukan untuk mencatat uang masuk di luar invoice, mis. sewa ruang rapat.',
        duration: 110,
    },
    {
        src: img('fm-income-form-category'),
        focus: around(S['fm-income-form-category'].account, S['fm-income-form-category'].list),
        cursor: S['fm-income-form-category'].option,
        click: true,
        zoom: 1.3,
        caption: 'Pilih Rekening penerima dan Kategori. Kategori belum ada? Klik + Tambah di samping labelnya.',
        duration: 140,
    },
    {
        src: img('fm-income-form-amount'),
        focus: around(S['fm-income-form-amount'].amount, S['fm-income-form-amount'].date),
        cursor: S['fm-income-form-amount'].amount,
        click: true,
        zoom: 1.6,
        caption: 'Isi Jumlah yang diterima. Tanggal otomatis hari ini; ubah bila uangnya masuk di hari lain.',
        duration: 130,
    },
    {
        src: img('fm-income-form-filled'),
        focus: around(S['fm-income-form-filled'].description, S['fm-income-form-filled'].upload),
        cursor: S['fm-income-form-filled'].description,
        type: around(S['fm-income-form-filled'].description, S['fm-income-form-filled'].reference),
        zoom: 1.3,
        caption: 'Tulis Deskripsi yang jelas, Nomor Referensi (mis. nomor kuitansi), dan lampirkan bukti bila ada.',
        duration: 140,
    },
    {
        src: img('fm-income-form-filled'),
        focus: around(S['fm-income-form-filled'].close, S['fm-income-form-filled'].save),
        cursor: S['fm-income-form-filled'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Pemasukan.',
        duration: 80,
    },
    {
        src: img('fm-income-saved'),
        focus: S['fm-income-saved'].toast,
        zoom: 1.6,
        caption: 'Tersimpan! Form dikosongkan agar bisa langsung mencatat berikutnya. Klik Tutup bila selesai.',
        chime: true,
        duration: 120,
    },
    {
        src: img('fm-income-list-after'),
        focus: S['fm-income-list-after'].row,
        zoom: 1.3,
        caption: 'Catatan baru tampil dengan sumber Langsung, dan saldo rekening BCA langsung bertambah.',
        duration: 130,
    },
];

/** Finance manager: mencatat pengeluaran. */
export const EXPENSE_STEPS: Step[] = [
    {
        src: img('fm-expense-list'),
        focus: S['fm-expense-list'].create,
        cursor: S['fm-expense-list'].create,
        click: true,
        zoom: 1.7,
        caption: 'Uang keluar dicatat di Arus Kas › Pengeluaran lewat tombol Input Pengeluaran.',
        duration: 110,
    },
    {
        src: img('fm-expense-form-category'),
        focus: around(S['fm-expense-form-category'].category, S['fm-expense-form-category'].list),
        cursor: S['fm-expense-form-category'].option,
        click: true,
        zoom: 1.4,
        caption: 'Pilih Kategori biaya dengan teliti: kategori inilah yang menentukan barisnya di Laba Rugi.',
        duration: 140,
    },
    {
        src: img('fm-expense-form-filled'),
        focus: around(S['fm-expense-form-filled'].description, S['fm-expense-form-filled'].upload),
        cursor: S['fm-expense-form-filled'].upload,
        zoom: 1.3,
        caption: 'Isi Jumlah, Deskripsi, Nomor Referensi (mis. nomor tagihan), lalu unggah bukti di Lampiran Bukti (PDF, JPG, atau PNG, maks 5 MB).',
        duration: 140,
    },
    {
        src: img('fm-expense-form-filled'),
        focus: S['fm-expense-form-filled'].save,
        cursor: S['fm-expense-form-filled'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Pengeluaran.',
        duration: 80,
    },
    {
        src: img('fm-expense-list-after'),
        focus: S['fm-expense-list-after'].row,
        zoom: 1.3,
        caption: 'Tercatat dengan kategori OPEX BULANAN. Saldo rekening sumber langsung berkurang.',
        chime: true,
        duration: 130,
    },
];

/** Finance manager: transfer antar rekening. */
export const TRANSFER_STEPS: Step[] = [
    {
        src: img('fm-transfer-list'),
        focus: S['fm-transfer-list'].create,
        cursor: S['fm-transfer-list'].create,
        click: true,
        zoom: 1.7,
        caption: 'Memindahkan dana antar rekening sendiri? Buka Transfer & Penyesuaian, lalu klik Input Transfer.',
        duration: 120,
    },
    {
        src: img('fm-transfer-form-empty'),
        focus: around(S['fm-transfer-form-empty'].from, S['fm-transfer-form-empty'].date),
        zoom: 1.4,
        caption: 'Pilih Rekening Sumber, Rekening Tujuan (harus berbeda), Kategori bertipe transfer, dan Tanggal.',
        duration: 130,
    },
    {
        src: img('fm-transfer-form-accounts'),
        focus: S['fm-transfer-form-accounts'].flow,
        zoom: 1.5,
        caption: 'Kartu Dari → Ke menegaskan arahnya: dari BNI - Investasi ke BCA - Operasional.',
        duration: 110,
    },
    {
        src: img('fm-transfer-form-filled'),
        focus: around(S['fm-transfer-form-filled'].amount, S['fm-transfer-form-filled'].fee),
        cursor: S['fm-transfer-form-filled'].amount,
        click: true,
        type: around(S['fm-transfer-form-filled'].amount, S['fm-transfer-form-filled'].description),
        zoom: 1.6,
        caption: 'Jumlah Transfer = yang diterima rekening tujuan. Biaya Admin ditambahkan ke potongan rekening sumber.',
        duration: 150,
    },
    {
        src: img('fm-transfer-form-submit'),
        focus: around(S['fm-transfer-form-submit'].summary, S['fm-transfer-form-submit'].submit),
        cursor: S['fm-transfer-form-submit'].submit,
        click: true,
        zoom: 1.5,
        caption: 'Cek Total Debit: Rp 10.006.500 keluar dari BNI. Lalu klik Lakukan Transfer.',
        duration: 130,
    },
    {
        src: img('fm-transfer-list-after'),
        focus: S['fm-transfer-list-after'].row,
        zoom: 1.25,
        caption: 'Transfer tercatat. Satu baris ini mewakili dua transaksi: keluar dari BNI dan masuk ke BCA.',
        chime: true,
        duration: 140,
    },
];

/** Finance manager: mengoreksi catatan. */
export const EDIT_STEPS: Step[] = [
    {
        src: img('fm-expense-edit'),
        focus: around(S['fm-expense-edit'].amount, S['fm-expense-edit'].category),
        zoom: 1.5,
        caption: 'Salah input? Klik barisnya. Jumlah, tanggal, kategori, referensi, dan lampiran bisa diubah.',
        duration: 130,
    },
    {
        src: img('fm-expense-edit'),
        focus: S['fm-expense-edit'].save,
        cursor: S['fm-expense-edit'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Perubahan. Saldo rekening dan Laba Rugi ikut menyesuaikan.',
        duration: 110,
    },
    {
        src: img('fm-transfer-detail'),
        focus: S['fm-transfer-detail'].sums,
        zoom: 1.5,
        caption: 'Detail transfer menampilkan jumlah yang ditransfer, biaya admin, dan total debit.',
        duration: 120,
    },
    {
        src: img('fm-transfer-detail'),
        focus: S['fm-transfer-detail'].edit,
        zoom: 1.5,
        caption: 'Pada transfer hanya Tanggal dan Deskripsi yang bisa diubah. Salah nominal? Hapus lalu buat ulang.',
        duration: 140,
    },
    {
        src: img('fm-income-payment-detail'),
        focus: S['fm-income-payment-detail'].note,
        zoom: 1.6,
        caption: 'Baris Invoice hanya bisa dilihat. Untuk mengubah pembayaran invoice, buka halaman Invoice.',
        duration: 130,
    },
];

/** Admin: jejak catatan kas di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('fm-transfer-detail'),
        focus: S['fm-transfer-detail'].sums,
        zoom: 1.5,
        role: ROLES.fm,
        caption: 'Setiap catatan kas adalah transaksi bank. Transfer tadi membuat dua: keluar Rp 10.006.500 dan masuk Rp 10.000.000.',
        duration: 160,
    },
    {
        src: img('admin-bank'),
        focus: around(S['admin-bank'].bca, S['admin-bank'].bni),
        zoom: 1.5,
        caption: 'Di Keuangan › Rekening Bank, saldo BNI turun dan BCA naik. Saldo selalu dihitung ulang dari semua transaksinya.',
        duration: 160,
    },
    {
        src: img('admin-pl-opex'),
        focus: S['admin-pl-opex'].line,
        zoom: 1.9,
        caption: 'Pengeluaran internet tadi masuk Laba Rugi di Beban Operasional, karena grup kategori OPEX BULANAN adalah Beban Operasional.',
        duration: 160,
    },
    {
        src: img('admin-pl-opex'),
        focus: S['admin-pl-opex'].net,
        zoom: 1.7,
        caption: 'Laba Usaha sampai Laba Bersih ikut berkurang sebesar pengeluaran itu, pada bulan tanggal transaksinya.',
        duration: 140,
    },
    {
        src: img('admin-pl-top'),
        focus: S['admin-pl-top'].meetingRoom,
        zoom: 1.6,
        caption: 'Pemasukan Sewa Ruang Rapat belum dihitung: kategorinya belum punya grup Laba Rugi, jadi tertahan di Perlu Diklasifikasi.',
        duration: 160,
    },
];

/** Admin: menghapus catatan. */
export const ADMIN_DELETE_STEPS: Step[] = [
    {
        src: img('admin-expense-bulk'),
        focus: S['admin-expense-bulk'].row,
        cursor: S['admin-expense-bulk'].checkbox,
        click: true,
        zoom: 1.3,
        caption: 'Untuk menghapus, centang barisnya. Bar aksi muncul di bagian bawah layar.',
        duration: 120,
    },
    {
        src: img('admin-expense-bulk'),
        focus: S['admin-expense-bulk'].bar,
        cursor: S['admin-expense-bulk'].remove,
        click: true,
        zoom: 1.7,
        caption: 'Klik Hapus lalu konfirmasi. Penghapusan permanen; saldo dan Laba Rugi langsung berubah.',
        duration: 130,
    },
    {
        src: img('admin-income-delete-confirm'),
        focus: S['admin-income-delete-confirm'].text,
        zoom: 1.8,
        caption: 'Hati-hati di Pemasukan: menghapus baris Invoice ikut menghapus pembayarannya, tetapi status invoice tidak dihitung ulang.',
        duration: 160,
    },
    {
        src: img('admin-income-delete-confirm'),
        focus: around(S['admin-income-delete-confirm'].cancel, S['admin-income-delete-confirm'].confirm),
        cursor: S['admin-income-delete-confirm'].cancel,
        click: true,
        zoom: 1.8,
        caption: 'Ragu? Klik Batal. Koreksi pembayaran invoice sebaiknya dilakukan dari halaman Invoice.',
        duration: 130,
    },
];
