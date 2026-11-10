import { t, tk } from '@/i18n';

/**
 * Label izin berbahasa Indonesia baku per kode izin (sumber kode: MasterPermissionSeeder + migrasi izin).
 * Kode tetap dipakai untuk pencocokan, pencarian, dan server; label hanya tampilan.
 */
const LABEL_IZIN: Record<string, string> = {
    'view dashboard': tk('Lihat ringkasan'),
    'view clients': tk('Lihat klien'),
    'create clients': tk('Buat klien'),
    'edit clients': tk('Ubah klien'),
    'delete clients': tk('Hapus klien'),
    'view services': tk('Lihat layanan'),
    'create services': tk('Buat layanan'),
    'edit services': tk('Ubah layanan'),
    'delete services': tk('Hapus layanan'),
    'view invoices': tk('Lihat invoice'),
    'create invoices': tk('Buat invoice'),
    'edit invoices': tk('Ubah invoice'),
    'delete invoices': tk('Hapus invoice'),
    'view payments': tk('Lihat pembayaran'),
    'create payments': tk('Catat pembayaran'),
    'edit payments': tk('Ubah pembayaran'),
    'delete payments': tk('Hapus pembayaran'),
    'view bank-accounts': tk('Lihat akun Kas & Bank'),
    'create bank-accounts': tk('Buat akun Kas & Bank'),
    'edit bank-accounts': tk('Ubah akun Kas & Bank'),
    'delete bank-accounts': tk('Hapus akun Kas & Bank'),
    'view income': tk('Lihat pemasukan'),
    'create income': tk('Catat pemasukan'),
    'edit income': tk('Ubah pemasukan'),
    'delete income': tk('Hapus pemasukan'),
    'view expense': tk('Lihat pengeluaran'),
    'create expense': tk('Catat pengeluaran'),
    'edit expense': tk('Ubah pengeluaran'),
    'delete expense': tk('Hapus pengeluaran'),
    'view transfer': tk('Lihat transfer'),
    'create transfer': tk('Catat transfer'),
    'edit transfer': tk('Ubah transfer'),
    'delete transfer': tk('Hapus transfer'),
    'view recurring-invoices': tk('Lihat invoice berulang'),
    'create recurring-invoices': tk('Buat invoice berulang'),
    'edit recurring-invoices': tk('Ubah invoice berulang'),
    'delete recurring-invoices': tk('Hapus invoice berulang'),
    'publish recurring-invoices': tk('Jadikan draft invoice berulang sebagai invoice'),
    'view categories': tk('Lihat kategori transaksi'),
    'manage categories': tk('Kelola kategori transaksi'),
    'view reimbursements': tk('Lihat reimbursement'),
    'create reimbursements': tk('Buat reimbursement'),
    'edit reimbursements': tk('Ubah reimbursement'),
    'delete reimbursements': tk('Hapus reimbursement'),
    'approve reimbursements': tk('Setujui reimbursement'),
    'pay reimbursements': tk('Bayar reimbursement'),
    'view fund requests': tk('Lihat pengajuan dana'),
    'create fund requests': tk('Buat pengajuan dana'),
    'edit fund requests': tk('Ubah pengajuan dana'),
    'delete fund requests': tk('Hapus pengajuan dana'),
    'approve fund requests': tk('Setujui pengajuan dana'),
    'disburse fund requests': tk('Cairkan pengajuan dana'),
    'view loans': tk('Lihat utang'),
    'create loans': tk('Buat utang'),
    'edit loans': tk('Ubah utang'),
    'delete loans': tk('Hapus utang'),
    'pay loans': tk('Bayar utang'),
    'view receivables': tk('Lihat piutang'),
    'create receivables': tk('Buat piutang'),
    'edit receivables': tk('Ubah piutang'),
    'delete receivables': tk('Hapus piutang'),
    'approve receivables': tk('Setujui piutang'),
    'pay receivables': tk('Catat pembayaran piutang'),
    'view permissions': tk('Lihat izin & peran'),
    'manage permissions': tk('Kelola izin & peran'),
    'manage users': tk('Kelola pengguna'),
    'manage companies': tk('Kelola perusahaan'),
    'view feedbacks': tk('Lihat masukan'),
    'create feedbacks': tk('Kirim masukan'),
    'edit feedbacks': tk('Ubah masukan'),
    'delete feedbacks': tk('Hapus masukan'),
    'respond feedbacks': tk('Tanggapi masukan'),
    'manage feedbacks': tk('Kelola masukan'),
    'view profit-loss': tk('Lihat Laba Rugi'),
    'manage pdf templates': tk('Kelola template PDF'),
    'manage company profile': tk('Kelola profil perusahaan'),
    'manage invoice settings': tk('Kelola penomoran invoice'),
    'use claude': tk('Pakai koneksi Claude'),
};

/**
 * Nama modul = kunci kelompok dari server (`ucwords` bagian kedua kode izin, mis. "Fund Requests").
 * Kuncinya tetap dikirim apa adanya ke server; label hanya tampilan.
 */
const LABEL_MODUL: Record<string, string> = {
    'Dashboard': tk('Ringkasan', 'menu'),
    'Clients': tk('Klien', 'menu'),
    'Services': tk('Layanan', 'menu'),
    'Invoices': tk('Invoice', 'menu'),
    'Payments': tk('Pembayaran', 'menu'),
    'Bank-Accounts': tk('Kas & Bank', 'menu'),
    'Income': tk('Pemasukan', 'menu'),
    'Expense': tk('Pengeluaran', 'menu'),
    'Transfer': tk('Transfer', 'menu'),
    'Recurring-Invoices': tk('Invoice Berulang', 'menu'),
    'Categories': tk('Kategori Transaksi', 'menu'),
    'Reimbursements': tk('Reimbursement', 'menu'),
    'Fund Requests': tk('Pengajuan Dana', 'menu'),
    'Loans': tk('Utang', 'menu'),
    'Receivables': tk('Piutang', 'menu'),
    'Permissions': tk('Izin & Peran', 'menu'),
    'Users': tk('Pengguna', 'menu'),
    'Companies': tk('Perusahaan', 'menu'),
    'Feedbacks': tk('Masukan', 'menu'),
    'Profit-Loss': tk('Laba Rugi', 'menu'),
    'Pdf Templates': tk('Template PDF', 'menu'),
    'Company Profile': tk('Profil Perusahaan', 'menu'),
    'Invoice Settings': tk('Penomoran Invoice', 'menu'),
    'Claude': tk('Koneksi Claude', 'menu'),
    'Other': tk('Lainnya', 'menu'),
};

/** Label tampilan sebuah kode izin; kode yang belum dipetakan tampil apa adanya. */
export function izinLabel(kode: string): string {
    const label = LABEL_IZIN[kode];
    return label ? t(label) : kode;
}

/** Label tampilan sebuah kelompok modul izin; kelompok yang belum dipetakan tampil apa adanya. */
export function modulIzinLabel(kunci: string): string {
    const label = LABEL_MODUL[kunci];
    return label ? t(label, { context: 'menu' }) : kunci;
}
