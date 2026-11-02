import type { Step } from '../components/walkthrough';
import { ROLES } from '../roles';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
/** Langkah tanpa durasi eksplisit: 100 frame (bukan 120) agar video tidak terlalu panjang. */
const brisk = (steps: Step[]): Step[] => steps.map((s) => ({ duration: 100, ...s }));
const S = SHOTS;

/** Admin menambah pengguna baru. */
export const ADMIN_USER_STEPS: Step[] = brisk([
    {
        src: img('admin-users'),
        caption: 'Buka Administrasi › Pengguna. Semua akun yang bisa masuk ke aplikasi ada di sini, lengkap dengan peran dan statusnya.',
        duration: 105,
    },
    {
        src: img('admin-users'),
        focus: S['admin-users'].create,
        cursor: S['admin-users'].create,
        click: true,
        zoom: 1.8,
        caption: 'Klik Tambah Pengguna untuk membuat akun karyawan baru.',
        duration: 100,
    },
    {
        src: img('admin-form-empty'),
        focus: S['admin-form-empty'].dialog,
        caption: 'Form Tambah Pengguna: kiri informasi akun, kanan peran dan kata sandi.',
        duration: 80,
    },
    {
        src: img('admin-form-name'),
        focus: S['admin-form-name'].name,
        cursor: S['admin-form-name'].name,
        click: true,
        type: S['admin-form-name'].name,
        zoom: 1.8,
        caption: 'Nama Lengkap karyawan, mis. "Budi Santoso".',
        duration: 110,
    },
    {
        src: img('admin-form-contact'),
        focus: around(S['admin-form-contact'].email, S['admin-form-contact'].phone),
        cursor: S['admin-form-contact'].email,
        click: true,
        type: S['admin-form-contact'].email,
        zoom: 1.6,
        caption: 'Email untuk masuk (belum boleh dipakai akun lain) dan Nomor Telepon bila ada. Status biarkan Aktif.',
        duration: 130,
    },
    {
        src: img('admin-form-role'),
        focus: around(S['admin-form-role'].role, S['admin-form-role'].list),
        cursor: S['admin-form-role'].option,
        click: true,
        zoom: 1.6,
        caption: 'Pilih Peran. Peran menentukan menu dan tombol apa saja yang ia lihat. Satu pengguna hanya punya satu peran.',
        duration: 140,
    },
    {
        src: img('admin-form-filled'),
        focus: around(S['admin-form-filled'].password, S['admin-form-filled'].submit),
        cursor: S['admin-form-filled'].submit,
        zoom: 1.5,
        caption: 'Kata Sandi minimal 8 karakter + Konfirmasi, lalu klik Tambah Pengguna. Akun langsung bisa dipakai, tanpa verifikasi email.',
        duration: 150,
    },
    {
        src: img('admin-users-created'),
        focus: S['admin-users-created'].budiRow,
        zoom: 1.4,
        caption: 'Budi Santoso kini ada di daftar dengan peran Staff dan status Aktif.',
        chime: true,
    },
]);

/** Admin mengubah atau menghapus pengguna. */
export const ADMIN_EDIT_STEPS: Step[] = brisk([
    {
        src: img('admin-edit'),
        focus: S['admin-edit'].status,
        zoom: 1.8,
        caption: 'Ikon pensil membuka Edit Pengguna: ganti Peran atau Status, lalu Simpan Perubahan. Kata Sandi kosongkan bila tidak diubah. Ingat: Tidak Aktif tidak memblokir login.',
        duration: 150,
    },
    {
        src: img('admin-delete'),
        focus: S['admin-delete'].dialog,
        cursor: S['admin-delete'].confirm,
        zoom: 1.6,
        caption: 'Hapus pengguna tidak bisa dibatalkan dan ikut menghapus reimbursement, pengajuan dana, dan feedback miliknya. Pikirkan dulu sebelum klik Hapus.',
        duration: 150,
    },
]);

/** Admin mengatur peran & izin. */
export const ADMIN_PERM_STEPS: Step[] = brisk([
    {
        src: img('admin-perm'),
        focus: S['admin-perm'].roles,
        zoom: 1.6,
        caption: 'Buka Administrasi › Izin & Peran. Tiga peran bawaan: Admin, Finance Manager, dan Staff, dengan jumlah izin dan penggunanya.',
        duration: 130,
    },
    {
        src: img('admin-perm'),
        focus: S['admin-perm'].create,
        cursor: S['admin-perm'].create,
        click: true,
        zoom: 1.8,
        caption: 'Butuh peran baru, mis. untuk auditor? Klik Tambah Peran.',
        duration: 100,
    },
    {
        src: img('admin-role-name'),
        focus: S['admin-role-name'].name,
        cursor: S['admin-role-name'].name,
        zoom: 1.7,
        caption: 'Isi Nama Peran, mis. "Auditor", pilih Ikon Peran, lalu Tambah Peran. Peran baru dimulai tanpa izin apa pun.',
        duration: 130,
    },
    {
        src: img('admin-perm-toggled'),
        focus: S['admin-perm-toggled'].viewInvoices,
        cursor: S['admin-perm-toggled'].viewInvoices,
        click: true,
        zoom: 1.9,
        caption: 'Saring lewat Cari permission..., lalu centang izin, mis. view invoices. Perubahan langsung tersimpan.',
        duration: 130,
    },
    {
        src: img('admin-perm-module'),
        focus: S['admin-perm-module'].invHeader,
        cursor: S['admin-perm-module'].invAll,
        click: true,
        zoom: 1.6,
        caption: 'Semua di judul modul memberi seluruh izin Invoices sekaligus; None mencabutnya. Beri Semua / Cabut Semua untuk semua modul.',
        duration: 140,
        chime: true,
    },
    {
        src: img('admin-role-delete'),
        focus: S['admin-role-delete'].dialog,
        cursor: S['admin-role-delete'].confirm,
        zoom: 1.7,
        caption: 'Hapus peran lewat ikon tempat sampah. Bila masih ada penggunanya, mereka dipindah ke peran dengan izin paling sedikit.',
        duration: 130,
    },
]);

/** Admin: di mana efek pengguna & izin terlihat. */
export const ADMIN_IMPACT_STEPS: Step[] = brisk([
    {
        src: img('new-user-dashboard'),
        focus: S['new-user-dashboard'].account,
        zoom: 1.8,
        caption: 'Budi masuk dengan email dan kata sandi dari Admin. Perannya tampil di bawah namanya.',
        role: ROLES.staff,
    },
    {
        src: img('new-user-dashboard'),
        focus: S['new-user-dashboard'].nav,
        zoom: 1.2,
        caption: 'Menunya mengikuti izin Staff: tanpa Arus Kas dan Laporan yang dimiliki Admin.',
        role: ROLES.staff,
        duration: 130,
    },
]);

/** Finance manager: hanya melihat izin. */
export const FM_STEPS: Step[] = brisk([
    {
        src: img('fm-perm'),
        focus: S['fm-perm'].nav,
        zoom: 1.7,
        caption: 'Finance manager melihat menu Izin & Peran, tetapi tidak menu Pengguna.',
        duration: 110,
    },
    {
        src: img('fm-perm'),
        focus: S['fm-perm'].roles,
        cursor: S['fm-perm'].roles,
        zoom: 1.6,
        caption: 'Klik sebuah peran di Daftar Peran untuk melihat izinnya.',
    },
    {
        src: img('fm-perm'),
        focus: S['fm-perm'].header,
        zoom: 1.6,
        caption: 'Di pengaturan bawaan Finance Manager punya 69 dari 75 izin: tanpa kelola pengguna, izin, dan template PDF, serta tanpa hapus klien, layanan, dan reimbursement.',
        duration: 160,
    },
    {
        src: img('fm-perm'),
        focus: S['fm-perm'].groupPerms,
        zoom: 1.6,
        caption: 'Kotak centang tampil redup dan tidak bisa diklik. Tombol Tambah Peran dan Beri Semua juga tidak ada.',
        duration: 130,
    },
    {
        src: img('fm-perm'),
        caption: 'Perlu izin tambahan untuk seseorang? Minta Admin mengubah izin perannya.',
        duration: 105,
    },
]);
