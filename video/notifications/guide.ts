import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Notifikasi in-app (lonceng di header). Pengirim: FeedbackController + perintah terjadwal invoices:notify-due-dates. */
export const guide: ModuleGuide = {
    slug: 'notifications',
    title: 'Notifikasi',
    group: 'Ringkasan',
    order: 20,
    path: '/dashboard',
    summary:
        'Lonceng di kanan atas setiap halaman memberi tahu hal yang perlu Anda lihat: tanggapan atas feedback Anda, feedback baru dari pengguna lain, dan invoice yang akan jatuh tempo. Setiap orang hanya melihat notifikasinya sendiri.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Penerima',
            can: [
                'Menerima **Tanggapan Feedback** saat feedback-nya ditanggapi',
                'Membuka notifikasi untuk langsung ke halaman terkait',
                'Menandai semua sudah dibaca',
                'Melihat notifikasi lama di **Semua Notifikasi**',
            ],
            cannot: ['Hanya melihat notifikasi miliknya sendiri'],
        },
        {
            role: ROLES.fm,
            who: 'Penerima laporan & pengingat',
            can: [
                'Semua yang diterima Staff',
                '**Feedback Baru** setiap kali ada pengguna mengirim feedback',
                'Pengingat **invoice jatuh tempo** 3 hari sebelumnya dan pada hari-H',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Penerima laporan & pengingat',
            can: ['Menerima notifikasi yang sama dengan Finance manager', 'Tidak ada pengaturan penerima; ditentukan oleh peran'],
        },
    ],
    tasks: [
        {
            title: 'Membaca notifikasi',
            role: ROLES.staff,
            steps: [
                'Lihat ikon lonceng di kanan atas. Angka merah adalah jumlah notifikasi yang **belum dibaca** (paling banyak tampil 99+).',
                'Klik lonceng: muncul 10 notifikasi terbaru dari 30 hari terakhir. Yang belum dibaca tebal dan bertitik biru.',
                'Klik salah satu notifikasi: notifikasi ditandai dibaca, lalu halaman terkait terbuka (mis. halaman Feedback).',
            ],
        },
        {
            title: 'Menandai semua sudah dibaca',
            role: ROLES.staff,
            steps: ['Klik lonceng, lalu **Tandai semua** di pojok kanan atas daftar. Angka merah di lonceng hilang.'],
        },
        {
            title: 'Melihat notifikasi lama',
            role: ROLES.staff,
            steps: [
                'Klik lonceng, lalu **Lihat semua notifikasi** di bagian bawah.',
                'Panel **Semua Notifikasi** menampilkan jumlah total dan yang belum dibaca, tanpa batas 30 hari.',
                'Klik **Muat lebih banyak** untuk menampilkan 20 notifikasi berikutnya.',
            ],
        },
        {
            title: 'Menindaklanjuti feedback & invoice jatuh tempo',
            role: ROLES.fm,
            steps: [
                '**Feedback Baru**: klik untuk membuka daftar Administrasi › Feedback (bukan langsung ke feedback-nya), cari feedback-nya, lalu **Tanggapi**.',
                '**Invoice Jatuh Tempo 3 Hari Lagi / Hari Ini**: klik untuk membuka detail invoice-nya, lalu **Kirim invoice** bila masih Draft, atau tagih sisa pembayarannya.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Yang membuat notifikasi',
            tone: 'act',
            items: [
                'Pengguna mengirim feedback → **Feedback Baru** ke semua Admin dan Finance manager.',
                'Feedback ditanggapi lewat **Tanggapi** (juga setiap kali **Edit Tanggapan**) → **Tanggapan Feedback** ke pengirimnya.',
                'Setiap hari pukul 08.00 WITA → pengingat invoice **Draft** atau **Sebagian** yang jatuh tempo 3 hari lagi dan hari ini, ke semua Admin dan Finance manager.',
            ],
        },
        {
            title: 'Yang tidak membuat notifikasi',
            tone: 'wait',
            items: [
                'Mengubah status feedback lewat **Ubah Status**.',
                'Reimbursement, permintaan dana, piutang, dan pembayaran invoice, termasuk saat pengajuan Anda disetujui, ditolak, atau dibayar.',
                'Antrean reimbursement & permintaan dana hanya ditandai badge kuning di menu **Operasional** (bagi yang berwenang).',
                'Tidak ada email atau WhatsApp; notifikasi hanya di dalam aplikasi.',
            ],
        },
        {
            title: 'Saat dibuka',
            tone: 'pos',
            items: [
                'Notifikasi ditandai dibaca dan angka lonceng berkurang.',
                'Tidak bisa dikembalikan menjadi belum dibaca.',
                'Notifikasi tidak bisa dihapus dari layar.',
            ],
        },
    ],
    records: [
        {
            title: 'Isi sebuah notifikasi',
            subtitle: 'Contoh notifikasi Feedback Baru yang dibuat otomatis saat Staff mengirim feedback.',
            rows: [
                { label: 'Penerima', value: 'Setiap Admin & Finance manager (1 notifikasi per orang)', source: 'Peran', tone: 'act' },
                { label: 'Judul', value: 'Feedback Baru', source: 'Otomatis', tone: 'neutral' },
                { label: 'Pesan', value: 'Staf Uji mengirim Feature Request: Ekspor arus kas ke Excel per bulan', source: 'Form feedback', tone: 'pos' },
                { label: 'Tautan', value: 'Halaman Administrasi › Feedback', source: 'Otomatis', tone: 'neutral' },
                { label: 'Dibaca', value: 'Kosong sampai diklik atau ditandai semua', source: 'Penerima', tone: 'wait' },
            ],
            note: 'Karena satu notifikasi per penerima, membaca notifikasi di akun Anda **tidak** menandainya dibaca di akun Admin atau Finance manager lain.',
        },
    ],
    warnings: [
        {
            title: 'Pengingat jatuh tempo butuh penjadwal di server',
            body: 'Pengingat dikirim oleh tugas terjadwal pukul 08.00 WITA. Bila cron **schedule:run** tidak aktif di server, tidak ada pengingat sama sekali, dan hari yang terlewat tidak dikirim susulan.',
        },
        {
            title: 'Invoice Terkirim tidak diingatkan',
            body: 'Pengingat hanya untuk invoice berstatus **Draft** atau **Sebagian**, tepat 3 hari sebelum dan pada hari jatuh tempo. Invoice **Terkirim** yang belum dibayar sama sekali, dan invoice yang sudah lewat jatuh tempo, tidak diingatkan; pantau di Ringkasan › Invoice Belum Dibayar. Invoice Draft belum bernomor, jadi nomornya kosong di pesan pengingat.',
        },
        {
            title: 'Lonceng hanya 30 hari terakhir',
            body: 'Notifikasi lebih lama tidak tampil di lonceng, tetapi tetap ada di **Lihat semua notifikasi**.',
        },
        {
            title: 'Admin juga menerima feedback miliknya',
            body: 'Feedback Baru dikirim ke semua Admin dan Finance manager, termasuk pengirimnya sendiri bila ia Admin atau Finance manager.',
        },
        {
            title: 'Penerima mengikuti nama peran',
            body: 'Feedback Baru dan pengingat jatuh tempo dikirim ke peran bernama **admin** dan **finance manager**, bukan menurut izin. Peran buatan sendiri di Izin & Peran tidak menerimanya. Jangan mengganti nama atau menghapus kedua peran itu: pengiriman feedback akan gagal dan pengingat berhenti.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Tanggapan atas feedback sendiri', cells: [true, true, true] },
        { action: 'Feedback Baru dari pengguna lain', cells: [false, true, true] },
        { action: 'Pengingat invoice jatuh tempo', cells: [false, true, true] },
        { action: 'Membaca & tandai semua dibaca', cells: [true, true, true] },
        { action: 'Melihat notifikasi orang lain', cells: [false, false, false] },
    ],
};
