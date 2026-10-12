import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;

/** Staff / Finance manager menambah klien. */
export const CREATE_STEPS: Step[] = [
    {
        src: img('staff-list'),
        caption: 'Buka Master Data › Klien. Semua pelanggan yang ditagih lewat invoice dicatat di sini.',
        duration: 110,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].stats,
        zoom: 1.25,
        caption: 'Kartu ringkasan: jumlah klien, yang aktif, serta jumlah perorangan dan perusahaan.',
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].filters,
        zoom: 1.35,
        caption: 'Cari berdasarkan nama, email, atau NPWP, lalu saring per tipe dan status.',
    },
    {
        src: img('staff-list'),
        focus: around(S['staff-list'].invoiceCell, S['staff-list'].finance),
        zoom: 1.8,
        caption: 'Invoice dan Finansial dihitung otomatis dari invoice klien. Outstanding belum dikurangi pembayaran sebagian.',
        duration: 150,
    },
    {
        src: img('staff-list'),
        focus: S['staff-list'].create,
        cursor: S['staff-list'].create,
        click: true,
        zoom: 1.8,
        caption: 'Klik Tambah Klien untuk mencatat pelanggan baru.',
        duration: 90,
    },
    {
        src: img('staff-form-empty'),
        focus: S['staff-form-empty'].dialog,
        caption: 'Form terbagi dua: Informasi Dasar di kiri, Data Pajak & Kontak di kanan.',
        duration: 110,
    },
    {
        src: img('staff-form-name'),
        focus: S['staff-form-name'].name,
        cursor: S['staff-form-name'].name,
        click: true,
        type: S['staff-form-name'].name,
        zoom: 1.8,
        caption: 'Nama Klien wajib diisi. Tulis nama resminya, karena nama ini tercetak di invoice.',
    },
    {
        src: img('staff-form-type'),
        focus: S['staff-form-type'].type,
        cursor: S['staff-form-type'].company,
        click: true,
        zoom: 1.8,
        caption: 'Pilih Tipe Klien: Individu atau Perusahaan. Klien Perusahaan juga bisa menjadi debitur di Piutang.',
        duration: 140,
    },
    {
        src: img('staff-form-type'),
        focus: S['staff-form-type'].status,
        zoom: 1.8,
        caption: 'Status Aktif berarti klien muncul di pilihan saat membuat invoice.',
        duration: 110,
    },
    {
        src: img('staff-form-contact'),
        focus: around(S['staff-form-contact'].email, S['staff-form-contact'].address),
        cursor: S['staff-form-contact'].email,
        click: true,
        type: around(S['staff-form-contact'].email, S['staff-form-contact'].address),
        zoom: 1.6,
        caption: 'Email harus berbeda dari klien lain. Alamat bisa ditampilkan di template invoice.',
    },
    {
        src: img('staff-form-tax'),
        focus: around(S['staff-form-tax'].npwp, S['staff-form-tax'].efin),
        cursor: S['staff-form-tax'].npwp,
        click: true,
        type: around(S['staff-form-tax'].npwp, S['staff-form-tax'].efin),
        zoom: 1.5,
        caption: 'Data pajak: NPWP, KPP, dan EFIN, masing-masing maksimal 20 karakter. NPWP tampil di detail invoice.',
        duration: 140,
    },
    {
        src: img('staff-form-filled'),
        focus: around(S['staff-form-filled'].pic, S['staff-form-filled'].arPhone),
        cursor: S['staff-form-filled'].arPhone,
        click: true,
        type: around(S['staff-form-filled'].pic, S['staff-form-filled'].arPhone),
        zoom: 1.5,
        caption: 'Kontak: PIC di sisi klien, Account Representative pajaknya, dan No. HP AR. Semua kolom ini opsional.',
        duration: 140,
    },
    {
        src: img('staff-form-save'),
        focus: S['staff-form-save'].save,
        cursor: S['staff-form-save'].save,
        click: true,
        zoom: 1.9,
        caption: 'Klik Simpan Klien.',
        duration: 80,
    },
    {
        src: img('staff-list-created'),
        focus: S['staff-list-created'].row,
        zoom: 1.3,
        caption: 'Klien baru tersimpan dengan status Aktif dan langsung bisa dipilih di invoice.',
        chime: true,
        duration: 120,
    },
];

/** Staff / Finance manager mengubah & menonaktifkan klien. */
export const EDIT_STEPS: Step[] = [
    {
        src: img('staff-list-created'),
        focus: S['staff-list-created'].edit,
        cursor: S['staff-list-created'].edit,
        click: true,
        zoom: 2,
        caption: 'Untuk mengubah data, klik ikon pensil pada baris klien.',
        duration: 100,
    },
    {
        src: img('staff-edit'),
        focus: S['staff-edit'].status,
        cursor: S['staff-edit'].inactive,
        click: true,
        zoom: 1.8,
        caption: 'Klien sudah tidak dilayani? Pilih Tidak Aktif: ia hilang dari pilihan invoice baru, invoice lamanya tetap.',
        duration: 150,
    },
    {
        src: img('staff-edit'),
        focus: around(S['staff-edit'].name, S['staff-edit'].npwp),
        zoom: 1.4,
        caption: 'Perubahan nama atau NPWP ikut tampil di invoice lama, karena invoice membaca data klien terbaru.',
        duration: 150,
    },
    {
        src: img('staff-list-created'),
        focus: S['staff-list-created'].remove,
        cursor: S['staff-list-created'].remove,
        zoom: 2,
        caption: 'Ikon tempat sampah hanya berfungsi untuk Admin. Staff dan Finance manager akan melihat layar 403.',
        duration: 140,
    },
];

/** Admin: jejak klien di modul lain. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-list'),
        focus: around(S['admin-list'].invoiceCell, S['admin-list'].finance),
        zoom: 1.8,
        caption: 'Budi Santoso punya 3 invoice senilai Rp 7.535.000. Semuanya terikat ke data klien ini.',
        duration: 140,
    },
    {
        src: img('admin-invoices'),
        focus: S['admin-invoices'].clientFilter,
        zoom: 1.9,
        caption: 'Di Keuangan › Invoice, saring per klien untuk melihat semua tagihannya.',
        duration: 120,
    },
    {
        src: img('admin-invoices'),
        focus: S['admin-invoices'].summary,
        zoom: 1.3,
        caption: 'Bila klien dihapus, ketiga invoice ini beserta catatan pembayarannya ikut hilang.',
        duration: 140,
    },
    {
        src: img('admin-income'),
        focus: S['admin-income'].clientFilter,
        zoom: 1.9,
        caption: 'Di Arus Kas › Pemasukan, pembayaran dari klien ini juga bisa disaring per klien.',
        duration: 120,
    },
    {
        src: img('admin-income'),
        focus: S['admin-income'].table,
        zoom: 1.3,
        caption: 'Pembayaran ini menambah saldo rekening dan pendapatan di Laba Rugi. Menghapus klien ikut menghapusnya.',
        duration: 150,
    },
];

/** Admin: menghapus klien. */
export const ADMIN_STEPS: Step[] = [
    {
        src: img('admin-list'),
        focus: S['admin-list'].remove,
        cursor: S['admin-list'].remove,
        click: true,
        zoom: 2,
        caption: 'Hanya Admin yang bisa menghapus klien, lewat ikon tempat sampah.',
        duration: 100,
    },
    {
        src: img('admin-delete'),
        focus: S['admin-delete'].dialog,
        cursor: S['admin-delete'].cancel,
        zoom: 1.7,
        caption: 'Semua invoice klien ikut dihapus dan tidak bisa dikembalikan. Untuk klien yang berhenti, pilih Batal lalu nonaktifkan.',
        duration: 160,
    },
];
