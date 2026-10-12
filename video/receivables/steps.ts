import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff mengajukan kasbon. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-list'),
        caption: 'Buka menu Utang & Piutang › Piutang. Daftar ini berisi pinjaman yang diberikan perusahaan.',
        duration: 110,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].create,
        cursor: S['staff-list'].create,
        click: true,
        zoom: 1.7,
        caption: 'Klik Tambah Piutang untuk mengajukan pinjaman (kasbon).',
        duration: 100,
    },
    {
        src: img('staff-form-empty'),
        focus: S['staff-form-empty'].type,
        zoom: 1.6,
        caption: 'Tipe Piutang: biarkan Pinjaman Karyawan. Pinjaman Perusahaan dipakai finance untuk pinjaman ke klien.',
    },
    {
        src: img('staff-form-debtor'),
        focus: around(S['staff-form-debtor'].debtor, S['staff-form-debtor'].list),
        cursor: S['staff-form-debtor'].option,
        click: true,
        zoom: 1.4,
        caption: 'Di kolom Karyawan, pilih nama Anda sendiri.',
        duration: 110,
    },
    {
        src: img('staff-form-amount'),
        focus: S['staff-form-amount'].amount,
        cursor: S['staff-form-amount'].amount,
        click: true,
        zoom: 1.7,
        caption: 'Isi Jumlah Pokok yang ingin dipinjam, mis. Rp 6.000.000.',
    },
    {
        src: img('staff-form-months'),
        focus: around(S['staff-form-months'].interestType, S['staff-form-months'].months),
        cursor: S['staff-form-months'].rate,
        zoom: 1.5,
        caption: 'Tipe Bunga Persentase (%): Suku Bunga adalah bunga flat untuk seluruh masa pinjaman, bukan per tahun. Isi 0 bila tanpa bunga.',
        duration: 150,
    },
    {
        src: img('staff-form-months'),
        focus: around(S['staff-form-months'].months, S['staff-form-months'].date),
        zoom: 1.6,
        caption: 'Cicilan per bulan = (pokok + bunga) ÷ Jumlah Cicilan. Jatuh tempo = Tanggal Pinjaman + jumlah bulan.',
        duration: 140,
    },
    {
        src: img('staff-form-disbursement'),
        focus: S['staff-form-disbursement'].disbursement,
        cursor: S['staff-form-disbursement'].disbursement,
        click: true,
        zoom: 1.6,
        caption: 'Rekening/Cara Pencairan: rekening Anda untuk menerima dana. Isian ini hanya informasi untuk finance.',
        duration: 140,
    },
    {
        src: img('staff-form-filled'),
        focus: around(S['staff-form-filled'].purpose, S['staff-form-filled'].notes),
        cursor: S['staff-form-filled'].purpose,
        type: around(S['staff-form-filled'].purpose, S['staff-form-filled'].notes),
        zoom: 1.4,
        caption: 'Tujuan wajib diisi. Catatan dan dokumen kontrak boleh dikosongkan.',
    },
    {
        src: img('staff-form-filled'),
        focus: S['staff-form-filled'].save,
        cursor: S['staff-form-filled'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Draft.',
        duration: 80,
    },
    {
        src: img('staff-list-draft'),
        focus: S['staff-list-draft'].row,
        zoom: 1.3,
        caption: 'Pengajuan tersimpan sebagai Draft. Belum ada yang dikirim ke finance.',
        chime: true,
        duration: 110,
    },
    {
        src: img('staff-list-draft'),
        focus: S['staff-list-draft'].actions,
        cursor: S['staff-list-draft'].submit,
        click: true,
        zoom: 2,
        caption: 'Klik ikon Ajukan (pesawat kertas) untuk mengirimnya ke finance.',
        duration: 110,
    },
    {
        src: img('staff-submit-confirm'),
        focus: S['staff-submit-confirm'].dialog,
        cursor: S['staff-submit-confirm'].confirm,
        click: true,
        zoom: 1.6,
        caption: 'Konfirmasi dengan tombol kuning di kanan. Labelnya masih tertulis "Hapus", tetapi yang dilakukan adalah mengajukan.',
        duration: 160,
    },
    {
        src: img('staff-list-pending'),
        focus: S['staff-list-pending'].row,
        zoom: 1.3,
        caption: 'Status menjadi Menunggu. Finance manager akan menyetujui atau menolaknya.',
        chime: true,
        duration: 110,
    },
];

/** Staff membaca penolakan. */
export const REJECT_STAFF_STEPS: Step[] = [
    {
        src: img('staff-detail-rejected'),
        focus: S['staff-detail-rejected'].reason,
        zoom: 1.5,
        caption: 'Bila ditolak, buka piutangnya untuk membaca Alasan Penolakan dari finance.',
        duration: 130,
    },
    {
        src: img('staff-detail-rejected'),
        focus: around(S['staff-detail-rejected'].reason, S['staff-detail-rejected'].edit),
        cursor: S['staff-detail-rejected'].edit,
        zoom: 1.4,
        caption: 'Ikon Edit memang tampil, tetapi Staff tidak berizin mengedit (ditolak sistem). Minta Finance manager merevisi, atau buat pengajuan baru.',
        duration: 150,
    },
];

/** Finance manager menyetujui & mencairkan. */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-list-pending'),
        focus: S['fm-list-pending'].filter,
        zoom: 1.6,
        caption: 'Pilih filter Menunggu Persetujuan untuk melihat antrean pengajuan.',
    },
    {
        src: img('fm-list-pending'),
        focus: S['fm-list-pending'].row,
        cursor: S['fm-list-pending'].row,
        click: true,
        zoom: 1.3,
        caption: 'Klik pengajuan untuk membuka detailnya. Ikon jempol di kolom Aksi langsung membuka dialog persetujuan.',
        duration: 130,
    },
    {
        src: img('fm-detail-pending'),
        focus: S['fm-detail-pending'].dialog,
        zoom: 1.2,
        caption: 'Periksa peminjam, pokok, suku bunga, cicilan, dan jatuh tempo.',
    },
    {
        src: img('fm-detail-pending'),
        focus: S['fm-detail-pending'].process,
        cursor: S['fm-detail-pending'].process,
        click: true,
        zoom: 1.6,
        caption: 'Klik Proses.',
        duration: 80,
    },
    {
        src: img('fm-approve-empty'),
        focus: around(S['fm-approve-empty'].summary, S['fm-approve-empty'].choice),
        zoom: 1.5,
        caption: 'Dialog Proses Persetujuan: pilih ✓ Setujui untuk mencairkan, atau ✕ Tolak.',
    },
    {
        src: img('fm-approve-filled'),
        focus: S['fm-approve-filled'].bank,
        cursor: S['fm-approve-filled'].bank,
        click: true,
        zoom: 1.6,
        caption: 'Pilih Rekening Pencairan. Uang benar-benar keluar dari rekening ini, bukan dari rekening yang ditulis pemohon.',
        duration: 150,
    },
    {
        src: img('fm-approve-filled'),
        focus: S['fm-approve-filled'].notes,
        cursor: S['fm-approve-filled'].notes,
        type: S['fm-approve-filled'].notes,
        zoom: 1.6,
        caption: 'Catatan (opsional) tersimpan bersama persetujuan, tetapi tidak ditampilkan di halaman Piutang. Sampaikan hal penting langsung ke pemohon.',
        duration: 100,
    },
    {
        src: img('fm-approve-filled'),
        focus: S['fm-approve-filled'].confirm,
        cursor: S['fm-approve-filled'].confirm,
        click: true,
        zoom: 1.8,
        caption: 'Klik Setujui & Cairkan.',
        duration: 80,
    },
    {
        src: img('fm-list-active'),
        focus: S['fm-list-active'].row,
        zoom: 1.3,
        caption: 'Status menjadi Aktif, dan pokok Rp 6.000.000 otomatis tercatat keluar dari rekening yang dipilih.',
        chime: true,
        duration: 140,
    },
];

/** Finance manager mencatat cicilan. */
export const PAY_STEPS: Step[] = [
    {
        src: img('fm-detail-active'),
        focus: S['fm-detail-active'].progress,
        zoom: 1.4,
        caption: 'Detail piutang Aktif menampilkan progres pembayaran pokok.',
        duration: 100,
    },
    {
        src: img('fm-detail-active'),
        focus: S['fm-detail-active'].pay,
        cursor: S['fm-detail-active'].pay,
        click: true,
        zoom: 1.6,
        caption: 'Klik Catat Pembayaran.',
        duration: 80,
    },
    {
        src: img('fm-pay-method'),
        focus: around(S['fm-pay-method'].method, S['fm-pay-method'].list),
        cursor: S['fm-pay-method'].option,
        click: true,
        zoom: 1.5,
        caption: 'Pilih Metode Pembayaran: Transfer Bank, Kas, atau Potongan Gaji.',
    },
    {
        src: img('fm-pay-payroll'),
        focus: around(S['fm-pay-payroll'].principal, S['fm-pay-payroll'].reference),
        cursor: S['fm-pay-payroll'].principal,
        zoom: 1.5,
        caption: 'Untuk Potongan Gaji, isi pokok yang dipotong bulan ini dan nomor referensinya. Tidak ada rekening yang dipilih.',
        duration: 150,
    },
    {
        src: img('fm-pay-payroll'),
        focus: S['fm-pay-payroll'].save,
        cursor: S['fm-pay-payroll'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Pembayaran.',
        duration: 80,
    },
    {
        src: img('admin-detail-after'),
        focus: S['admin-detail-after'].progress,
        zoom: 1.5,
        caption: 'Progres naik ke 17%. Kas dan Potongan Gaji hanya mengurangi sisa piutang; saldo rekening tidak berubah.',
        chime: true,
        duration: 150,
    },
    {
        src: img('fm-pay-transfer'),
        focus: around(S['fm-pay-transfer'].method, S['fm-pay-transfer'].bank),
        cursor: S['fm-pay-transfer'].bank,
        click: true,
        zoom: 1.5,
        caption: 'Untuk Transfer Bank, pilih Rekening tempat uang cicilan masuk. Pastikan terisi.',
        duration: 130,
    },
    {
        src: img('fm-pay-transfer'),
        focus: around(S['fm-pay-transfer'].principal, S['fm-pay-transfer'].interest),
        cursor: S['fm-pay-transfer'].interest,
        type: around(S['fm-pay-transfer'].principal, S['fm-pay-transfer'].interest),
        zoom: 1.5,
        caption: 'Isi Pembayaran Pokok dan Pembayaran Bunga. Angka "maks." hanya informasi.',
    },
    {
        src: img('fm-pay-transfer-save'),
        focus: S['fm-pay-transfer-save'].save,
        cursor: S['fm-pay-transfer-save'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan Pembayaran. Pokok dan bunga masuk ke rekening sebagai dua transaksi.',
        duration: 120,
    },
];

/** Finance manager menolak. */
export const REJECT_FM_STEPS: Step[] = [
    {
        src: img('fm-reject'),
        focus: around(S['fm-reject'].choice, S['fm-reject'].notes),
        cursor: S['fm-reject'].notes,
        zoom: 1.5,
        caption: 'Pilih ✕ Tolak lalu tulis Alasan Penolakan, agar pemohon tahu apa yang harus diperbaiki.',
        duration: 140,
    },
    {
        src: img('fm-reject'),
        focus: S['fm-reject'].confirm,
        cursor: S['fm-reject'].confirm,
        click: true,
        zoom: 1.8,
        caption: 'Klik Tolak. Untuk merevisi, klik ikon Edit; setelah disimpan statusnya kembali Draft dan bisa diajukan ulang.',
        duration: 150,
    },
];

/** Admin: jejak piutang di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].account,
        zoom: 1.7,
        caption: 'Di Keuangan › Rekening Bank, saldo turun saat piutang dicairkan dan naik saat cicilan ditransfer.',
        duration: 140,
    },
    {
        src: img('admin-bank'),
        focus: S['admin-bank'].disburse,
        zoom: 1.5,
        caption: 'Pencairan: satu transaksi keluar sebesar pokok, bertanggal hari disetujui, referensinya nomor piutang.',
        duration: 150,
    },
    {
        src: img('admin-bank'),
        focus: around(S['admin-bank'].principal, S['admin-bank'].interest),
        zoom: 1.4,
        caption: 'Cicilan lewat Transfer Bank: pokok dan bunga menjadi dua transaksi masuk.',
        duration: 130,
    },
    {
        src: img('admin-income'),
        focus: S['admin-income'].table,
        zoom: 1.3,
        caption: 'Di Arus Kas › Pemasukan hanya bunganya yang tampil (Pendapatan Bunga). Cicilan kas dan potong gaji tidak muncul.',
        duration: 160,
    },
];

/** Admin: satu daftar untuk semua. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-list'),
        focus: S['admin-list'].table,
        zoom: 1.2,
        caption: 'Semua piutang karyawan dan perusahaan ada di satu daftar. Staff pun melihat daftar yang sama, termasuk pinjaman orang lain.',
        duration: 160,
    },
];
