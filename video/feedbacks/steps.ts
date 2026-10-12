import type { Step } from '../components/walkthrough';
import { ROLES } from '../roles';
import { around, SCREENS, SHOTS, type ShotName } from './shots';

const img = (name: ShotName) => SCREENS[name];
const S = SHOTS;
const featureOption = { x: 563, y: 265, w: 144, h: 67 };

/** Staff: kirim lewat tombol melayang. */
export const STAFF_SEND_STEPS: Step[] = [
    {
        src: img('staff-floating'),
        focus: S['staff-floating'].floating,
        cursor: S['staff-floating'].floating,
        click: true,
        zoom: 1.8,
        caption: 'Tombol Feedback ada di kanan bawah setiap halaman. Klik saat menemukan masalah atau punya usulan.',
    },
    {
        src: img('staff-float-empty'),
        focus: S['staff-float-empty'].dialog,
        caption: 'Form Kirim Feedback terbuka. Alamat halaman tempat Anda berada ikut tercatat otomatis.',
        duration: 110,
    },
    {
        src: img('staff-float-type'),
        focus: S['staff-float-type'].type,
        cursor: featureOption,
        click: true,
        zoom: 1.7,
        caption: 'Pilih Tipe: Bug bila ada yang salah, Fitur untuk usulan fitur baru, atau Saran untuk masukan lain.',
        duration: 130,
    },
    {
        src: img('staff-float-title'),
        focus: S['staff-float-title'].title,
        cursor: S['staff-float-title'].title,
        click: true,
        type: S['staff-float-title'].title,
        zoom: 1.8,
        caption: 'Judul: singkat dan jelas, mis. "Ekspor arus kas ke Excel per bulan".',
    },
    {
        src: img('staff-float-filled'),
        focus: S['staff-float-filled'].description,
        cursor: S['staff-float-filled'].description,
        type: S['staff-float-filled'].description,
        zoom: 1.6,
        caption: 'Deskripsi: ceritakan kebutuhannya, atau langkah yang membuat masalah muncul dan apa yang seharusnya terjadi.',
        duration: 140,
    },
    {
        src: img('staff-float-filled'),
        focus: S['staff-float-filled'].submit,
        cursor: S['staff-float-filled'].submit,
        click: true,
        zoom: 1.9,
        caption: 'Prioritas bawaannya Sedang; gulir form untuk mengubahnya. Lalu klik Kirim Feedback.',
    },
    {
        src: img('staff-float-sent'),
        focus: S['staff-float-sent'].toast,
        zoom: 1.8,
        caption: 'Terkirim. Admin dan Finance manager langsung mendapat notifikasi.',
        chime: true,
        duration: 100,
    },
];

/** Staff: kirim dari halaman Feedback + kelola miliknya. */
export const STAFF_PAGE_STEPS: Step[] = [
    {
        src: img('staff-list-one'),
        focus: S['staff-list-one'].create,
        cursor: S['staff-list-one'].create,
        click: true,
        zoom: 1.7,
        caption: 'Semua feedback Anda ada di Administrasi › Feedback. Dari sini juga bisa klik Kirim Feedback.',
    },
    {
        src: img('staff-form-priority'),
        focus: around(S['staff-form-priority'].type, S['staff-form-priority'].priority),
        caption: 'Contoh laporan Bug dengan Prioritas Tinggi, karena mengganggu pekerjaan sehari-hari.',
    },
    {
        src: img('staff-form-filled'),
        focus: S['staff-form-filled'].upload,
        cursor: S['staff-form-filled'].upload,
        zoom: 1.6,
        caption: 'Lampirkan screenshot (JPG, PNG, atau PDF, maksimal 5 MB) agar tim langsung melihat masalahnya.',
        duration: 130,
    },
    {
        src: img('staff-list'),
        focus: around(S['staff-list'].cardBug, S['staff-list'].cardFeature),
        zoom: 1.4,
        caption: 'Kedua feedback berstatus Terbuka: menunggu ditinjau Admin atau Finance manager.',
        chime: true,
    },
    {
        src: img('staff-show-open'),
        focus: S['staff-show-open'].editRemove,
        zoom: 1.9,
        caption: 'Klik kartu untuk melihat detail. Edit dan Hapus hanya tersedia selama status masih Terbuka.',
        duration: 130,
    },
];

/** Staff: melihat tanggapan. */
export const STAFF_REPLY_STEPS: Step[] = [
    {
        src: img('staff-list-after'),
        focus: S['staff-list-after'].bell,
        zoom: 2.2,
        caption: 'Saat feedback Anda ditanggapi, lonceng notifikasi menampilkan Tanggapan Feedback.',
        duration: 110,
    },
    {
        src: img('staff-list-after'),
        focus: around(S['staff-list-after'].cardBug, S['staff-list-after'].cardFeature),
        zoom: 1.4,
        caption: 'Statusnya ikut berubah: Diproses berarti sedang dikerjakan, Selesai berarti sudah beres.',
    },
    {
        src: img('staff-show-responded'),
        focus: S['staff-show-responded'].response,
        zoom: 1.5,
        caption: 'Buka kartunya untuk membaca tanggapan, siapa yang menanggapi, dan kapan.',
        duration: 130,
    },
];

/** Finance manager: meninjau & menanggapi. */
export const FM_STEPS: Step[] = [
    {
        src: img('fm-list'),
        focus: S['fm-list'].tabs,
        zoom: 1.9,
        caption: 'Semua Feedback berisi laporan dari semua pengguna. Feedback Saya hanya yang Anda kirim sendiri.',
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].stats,
        zoom: 1.3,
        caption: 'Kartu angka menunjukkan Total serta jumlah yang Terbuka, Diproses, dan Selesai. Terbuka berarti belum diproses.',
        duration: 110,
    },
    {
        src: img('fm-list'),
        focus: around(S['fm-list'].filters, S['fm-list'].search),
        zoom: 1.3,
        caption: 'Saring berdasarkan Tipe, Status, Prioritas, atau cari judul, deskripsi, dan nama pengirim.',
    },
    {
        src: img('fm-list'),
        focus: S['fm-list'].cardFeature,
        cursor: S['fm-list'].cardFeature,
        click: true,
        zoom: 1.5,
        caption: 'Klik kartu untuk membuka detailnya.',
        duration: 90,
    },
    {
        src: img('fm-show'),
        focus: S['fm-show'].pageUrl,
        zoom: 1.8,
        caption: 'URL halaman menunjukkan dari mana feedback dikirim. Lampiran, bila ada, tampil di bawahnya.',
    },
    {
        src: img('fm-show'),
        focus: S['fm-show'].respond,
        cursor: S['fm-show'].respond,
        click: true,
        zoom: 2,
        caption: 'Klik Tanggapi untuk membalas pengirim.',
        duration: 90,
    },
    {
        src: img('fm-respond-empty'),
        focus: S['fm-respond-empty'].dialog,
        caption: 'Dialog Tanggapi Feedback terbuka, dengan judul feedback di bagian atas.',
        duration: 90,
    },
    {
        src: img('fm-respond-text'),
        focus: S['fm-respond-text'].response,
        cursor: S['fm-respond-text'].response,
        click: true,
        type: S['fm-respond-text'].response,
        zoom: 1.6,
        caption: 'Tulis tanggapan yang jelas: apa yang akan dilakukan, atau kapan bisa dicoba.',
        duration: 130,
    },
    {
        src: img('fm-respond-status'),
        focus: around(S['fm-respond-status'].status, S['fm-respond-status'].list),
        cursor: S['fm-respond-status'].option,
        click: true,
        zoom: 1.5,
        caption: 'Pilih Status Baru: Sedang Diproses, Selesai, atau Ditutup.',
    },
    {
        src: img('fm-respond-text'),
        focus: S['fm-respond-text'].submit,
        cursor: S['fm-respond-text'].submit,
        click: true,
        zoom: 2,
        caption: 'Klik Kirim Tanggapan. Pengirim langsung mendapat notifikasi.',
        duration: 100,
    },
    {
        src: img('fm-show-responded'),
        focus: around(S['fm-show-responded'].badges, S['fm-show-responded'].response),
        zoom: 1.3,
        caption: 'Status kini Diproses dan tanggapan tersimpan. Tombolnya menjadi Edit Tanggapan, yang menimpa tanggapan lama.',
        chime: true,
        duration: 150,
    },
];

/** Finance manager: Ubah Status. */
export const FM_STATUS_STEPS: Step[] = [
    {
        src: img('fm-status-menu'),
        focus: around(S['fm-status-menu'].changeStatus, S['fm-status-menu'].menu),
        cursor: S['fm-status-menu'].changeStatus,
        zoom: 1.7,
        caption: 'Ubah Status mengganti status tanpa menulis tanggapan, termasuk kembali ke Terbuka. Pengirim tidak diberi tahu.',
        duration: 150,
    },
    {
        src: img('fm-list-after'),
        focus: S['fm-list-after'].cardBug,
        zoom: 1.5,
        caption: 'Yang sudah beres ditandai Selesai. Ditutup berarti terkunci: tidak bisa ditanggapi atau diubah lagi.',
        duration: 140,
    },
];

/** Admin: jejak feedback di modul Notifikasi. */
export const ADMIN_IMPACT_STEPS: Step[] = [
    {
        src: img('admin-list'),
        focus: S['admin-list'].bell,
        zoom: 2.2,
        caption: 'Setiap feedback baru menambah angka di lonceng semua Admin dan Finance manager.',
        duration: 120,
    },
    {
        src: img('admin-bell'),
        focus: S['admin-bell'].popover,
        cursor: S['admin-bell'].first,
        zoom: 1.6,
        caption: 'Notifikasi Feedback Baru menyebut pengirim, tipe, dan judulnya. Klik untuk membuka halaman Feedback.',
        duration: 150,
    },
    {
        src: img('staff-list-after'),
        focus: S['staff-list-after'].bell,
        zoom: 2.2,
        role: ROLES.staff,
        caption: 'Saat ditanggapi lewat Tanggapi, pengirim mendapat notifikasi Tanggapan Feedback. Ubah Status tidak mengirim apa pun.',
        duration: 160,
    },
    {
        src: img('admin-list'),
        focus: S['admin-list'].stats,
        zoom: 1.3,
        caption: 'Feedback tidak mengubah data keuangan apa pun. Jejaknya hanya di halaman ini dan di notifikasi.',
        duration: 120,
    },
];
