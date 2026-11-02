import type { Step } from '../components/walkthrough';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
/** Langkah tanpa durasi eksplisit: 100 frame (bukan 120) agar video tidak terlalu panjang. */
const brisk = (steps: Step[]): Step[] => steps.map((s) => ({ duration: 100, ...s }));
const S = SHOTS;

/** Semua pengguna: profil & kata sandi sendiri. */
export const STAFF_STEPS: Step[] = [
    {
        src: img('staff-menu'),
        focus: around(S['staff-menu'].account, S['staff-menu'].menu),
        cursor: S['staff-menu'].settings,
        click: true,
        zoom: 1.8,
        caption: 'Klik nama Anda di kanan atas, lalu pilih Pengaturan.',
        duration: 110,
    },
    {
        src: img('staff-hub'),
        focus: around(S['staff-hub'].akun, S['staff-hub'].perusahaan),
        zoom: 1.3,
        caption: 'Halaman Pengaturan berisi kartu-kartu. Menu yang tampil menyesuaikan izin Anda.',
    },
    {
        src: img('staff-hub'),
        focus: S['staff-hub'].profile,
        cursor: S['staff-hub'].profile,
        click: true,
        zoom: 1.6,
        caption: 'Klik Profil untuk mengubah nama atau email yang Anda pakai untuk masuk.',
        duration: 100,
    },
    {
        src: img('staff-profile'),
        focus: around(S['staff-profile'].name, S['staff-profile'].email),
        caption: 'Halaman Profil berisi Nama Lengkap dan Email akun Anda.',
        zoom: 1.4,
        duration: 80,
    },
    {
        src: img('staff-profile-name'),
        focus: S['staff-profile-name'].name,
        cursor: S['staff-profile-name'].name,
        click: true,
        type: S['staff-profile-name'].name,
        zoom: 1.8,
        caption: 'Ubah Nama Lengkap, mis. menambahkan nama belakang. Email harus belum dipakai akun lain.',
    },
    {
        src: img('staff-profile-saved'),
        focus: S['staff-profile-saved'].saveRow,
        cursor: S['staff-profile-saved'].save,
        click: true,
        zoom: 2,
        caption: 'Klik Simpan Perubahan. Tulisan Tersimpan menandakan berhasil.',
        chime: true,
        duration: 100,
    },
    {
        src: img('staff-password'),
        focus: around(S['staff-password'].current, S['staff-password'].confirm),
        zoom: 1.4,
        caption: 'Untuk mengganti kata sandi, buka Pengaturan › Kata sandi.',
        duration: 100,
    },
    {
        src: img('staff-password-current'),
        focus: S['staff-password-current'].current,
        cursor: S['staff-password-current'].current,
        click: true,
        type: S['staff-password-current'].current,
        zoom: 1.8,
        caption: 'Isi Kata Sandi Saat Ini sebagai bukti bahwa ini benar Anda.',
        duration: 110,
    },
    {
        src: img('staff-password-new'),
        focus: around(S['staff-password-new'].next, S['staff-password-new'].confirm),
        cursor: S['staff-password-new'].next,
        click: true,
        type: around(S['staff-password-new'].next, S['staff-password-new'].confirm),
        zoom: 1.6,
        caption: 'Kata Sandi Baru minimal 8 karakter, lalu ketik ulang di Konfirmasi Kata Sandi Baru.',
    },
    {
        src: img('staff-password-saved'),
        focus: S['staff-password-saved'].saveRow,
        cursor: S['staff-password-saved'].save,
        click: true,
        zoom: 2,
        caption: 'Klik Perbarui Kata Sandi. Gunakan kata sandi baru saat masuk berikutnya.',
        chime: true,
        duration: 100,
    },
    {
        src: img('staff-profile'),
        focus: S['staff-profile'].danger,
        zoom: 1.5,
        caption: 'Hapus Akun ada di bagian bawah Profil. Akun dan data Anda (reimbursement, pengajuan dana) ikut hilang permanen.',
        duration: 140,
    },
    {
        src: img('staff-delete'),
        focus: S['staff-delete'].dialog,
        zoom: 1.5,
        caption: 'Penghapusan wajib dikonfirmasi dengan kata sandi. Anda langsung keluar dan akun tidak bisa dipulihkan.',
        duration: 120,
    },
];

/** Finance manager: penomoran invoice (contoh tidak disimpan). */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-hub'),
        focus: S['fm-hub'].numbering,
        cursor: S['fm-hub'].numbering,
        click: true,
        zoom: 1.6,
        caption: 'Finance manager melihat kartu Invoice › Penomoran invoice di halaman Pengaturan.',
        duration: 110,
    },
    {
        src: img('fm-numbering'),
        focus: S['fm-numbering'].pattern,
        zoom: 1.8,
        caption: 'Pola nomor saat ini. Nomor baru diberikan saat invoice dikirim, bukan saat draft dibuat.',
    },
    {
        src: img('fm-numbering'),
        focus: S['fm-numbering'].tokens,
        zoom: 1.8,
        caption: 'Chip token: {NO} nomor urut, {PT} singkatan perusahaan, {KLIEN} inisial klien, bulan, dan tahun.',
        duration: 130,
    },
    {
        src: img('fm-numbering'),
        focus: S['fm-numbering'].preview,
        zoom: 1.6,
        caption: 'Pratinjau langsung menampilkan nomor berikutnya, bagian dari token ditandai biru.',
    },
    {
        src: img('fm-numbering-digits'),
        focus: around(S['fm-numbering-digits'].padding, S['fm-numbering-digits'].previewNumber),
        cursor: S['fm-numbering-digits'].digits4,
        click: true,
        zoom: 1.2,
        caption: 'Jumlah digit nomor urut: pilih 4 digit, nomor urut menjadi 0002. Ini batas minimum, bukan maksimum.',
        duration: 130,
    },
    {
        src: img('fm-numbering-error'),
        focus: around(S['fm-numbering-error'].patternField, S['fm-numbering-error'].tokenNo),
        cursor: S['fm-numbering-error'].tokenNo,
        click: true,
        zoom: 1.6,
        caption: 'Ketik teks bebas lalu klik chip {NO}. Pola tanpa bulan ditolak bila nomor kembali ke 1 tiap bulan.',
        duration: 140,
    },
    {
        src: img('fm-numbering-valid'),
        focus: around(S['fm-numbering-valid'].reset, S['fm-numbering-valid'].previewNumber),
        cursor: S['fm-numbering-valid'].yearly,
        click: true,
        zoom: 1.2,
        caption: 'Pilih Tiap tahun: pola cukup memuat tahun. Pesan hilang dan pratinjau menjadi INV-KSN/2026/0007.',
        duration: 140,
        chime: true,
    },
    {
        src: img('fm-numbering-save'),
        focus: around(S['fm-numbering-save'].note, S['fm-numbering-save'].save),
        cursor: S['fm-numbering-save'].save,
        zoom: 1.7,
        caption: 'Simpan berlaku untuk invoice yang dikirim sesudahnya. Kembalikan default mengisi ulang pola bawaan (tetap perlu Simpan).',
        duration: 130,
    },
    {
        src: img('fm-numbering-save'),
        focus: S['fm-numbering-save'].recent,
        zoom: 1.7,
        caption: 'Nomor yang sudah terbit tidak ikut berubah. Daftar ini menampilkan 4 nomor terakhir.',
    },
];

/** Admin: profil perusahaan (contoh tidak disimpan). */
export const ADMIN_COMPANY_STEPS: Step[] = brisk([
    {
        src: img('admin-hub'),
        focus: S['admin-hub'].invoice,
        zoom: 1.4,
        caption: 'Admin melihat semua kartu, termasuk Template PDF yang khusus Admin.',
        duration: 105,
    },
    {
        src: img('admin-hub'),
        focus: S['admin-hub'].company,
        cursor: S['admin-hub'].company,
        click: true,
        zoom: 1.6,
        caption: 'Buka Profil perusahaan: identitas yang tercetak di dokumen PDF.',
        duration: 100,
    },
    {
        src: img('admin-company'),
        focus: S['admin-company'].identity,
        zoom: 1.3,
        caption: 'Identitas Perusahaan: nama, alamat, email, dan telepon yang tercetak di dokumen PDF.',
    },
    {
        src: img('admin-company-tax'),
        focus: S['admin-company-tax'].finance,
        zoom: 1.4,
        caption: 'Penanggung Jawab Keuangan: nama dan jabatan di area tanda tangan PDF invoice, arus kas, dan pengajuan dana.',
        duration: 120,
    },
    {
        src: img('admin-company-tax'),
        focus: S['admin-company-tax'].pkp,
        cursor: S['admin-company-tax'].pkp,
        zoom: 1.9,
        caption: 'Centang PKP bila perusahaan Pengusaha Kena Pajak; kolom NPWP dan Tarif PPN (%) lalu muncul.',
        duration: 130,
    },
    {
        src: img('admin-company-assets'),
        focus: S['admin-company-assets'].assets,
        zoom: 1.1,
        caption: 'Aset Visual: unggah logo, kop surat, tanda tangan, dan stempel (JPG/PNG maks 2 MB), lalu Simpan Perubahan.',
        duration: 140,
    },
]);

/** Admin: template PDF invoice. */
export const ADMIN_TEMPLATE_STEPS: Step[] = brisk([
    {
        src: img('admin-templates-empty'),
        focus: S['admin-templates-empty'].create,
        cursor: S['admin-templates-empty'].create,
        click: true,
        zoom: 1.8,
        caption: 'Pengaturan › Template PDF. Klik Template Baru untuk merancang tampilan invoice sendiri.',
        duration: 110,
    },
    {
        src: img('admin-template-new'),
        focus: S['admin-template-new'].dialog,
        cursor: S['admin-template-new'].submit,
        click: true,
        zoom: 1.6,
        caption: 'Isi Nama Template dan Deskripsi (opsional), lalu klik Buat Template.',
    },
    {
        src: img('admin-editor'),
        focus: S['admin-editor'].canvas,
        zoom: 1.2,
        caption: 'Editor terbuka. Halaman dibagi pita: Header, Konten (tabel item), Footer Flow, dan Footer Tetap.',
    },
    {
        src: img('admin-editor'),
        focus: S['admin-editor'].tools,
        cursor: S['admin-editor'].text,
        click: true,
        zoom: 2,
        caption: 'Bilah alat bawah: teks, gambar, grid, kotak, garis, dan tabel item. Klik T untuk menambah teks.',
    },
    {
        src: img('admin-editor-text'),
        focus: S['admin-editor-text'].content,
        zoom: 1.8,
        caption: 'Atur isi teks di panel kanan. Sisipkan field memasukkan token yang diganti data asli saat dicetak.',
        duration: 130,
    },
    {
        src: img('admin-editor-saved'),
        focus: around(S['admin-editor'].actions, S['admin-editor-saved'].save),
        cursor: S['admin-editor-saved'].save,
        click: true,
        zoom: 1.8,
        caption: 'Klik Simpan. PDF dan Pratinjau membuka layout yang tersimpan; Preview menampilkan token terisi di kanvas.',
        chime: true,
        duration: 130,
    },
    {
        src: img('admin-template-menu'),
        focus: S['admin-template-menu'].menu,
        cursor: S['admin-template-menu'].setDefault,
        click: true,
        zoom: 1.8,
        caption: 'Di daftar, menu ••• berisi Ubah Nama, Jadikan Default, Duplikat, dan Hapus.',
    },
    {
        src: img('admin-template-default'),
        focus: S['admin-template-default'].row,
        zoom: 1.5,
        caption: 'Template bertanda Default tampil paling depan di antara template buatan saat mencetak.',
        duration: 110,
    },
]);

/** Admin: di mana pengaturan ini terlihat. */
export const ADMIN_IMPACT_STEPS: Step[] = brisk([
    {
        src: img('admin-print'),
        focus: S['admin-print'].templates,
        zoom: 1.5,
        caption: 'Invoice › Cetak: template buatan Admin muncul di samping template bawaan.',
        duration: 110,
    },
    {
        src: img('admin-print'),
        focus: S['admin-print'].pdfHeader,
        zoom: 1.8,
        caption: 'Kepala invoice Kisantra memakai Kop Surat dari Profil perusahaan; bila belum ada, tampil kotak berisi nama perusahaan.',
        duration: 130,
    },
    {
        src: img('admin-print'),
        focus: S['admin-print'].pdfSign,
        zoom: 2,
        caption: 'Nama dan jabatan penanggung jawab keuangan tercetak di area tanda tangan.',
    },
]);

/** Admin: menghapus template. */
export const ADMIN_DELETE_STEPS: Step[] = [
    {
        src: img('admin-template-delete'),
        focus: S['admin-template-delete'].dialog,
        cursor: S['admin-template-delete'].confirm,
        zoom: 1.6,
        caption: 'Hapus template menghapus layout-nya permanen. Invoice tidak berubah, hanya pilihan cetaknya hilang.',
        duration: 130,
    },
];
