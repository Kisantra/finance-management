import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Feedback & Saran: laporan bug / permintaan fitur / saran dari pengguna, ditanggapi Admin & Finance manager. */
export const guide: ModuleGuide = {
    slug: 'feedbacks',
    title: 'Feedback & Saran',
    group: 'Administrasi',
    order: 30,
    path: '/feedbacks',
    permission: 'view feedbacks',
    summary:
        'Saluran untuk melaporkan bug, meminta fitur, atau memberi saran tentang aplikasi. Siapa pun bisa mengirim dari tombol di setiap halaman; Admin dan Finance manager meninjau, menanggapi, dan menandai kemajuannya sampai selesai.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pelapor',
            can: [
                'Mengirim bug, permintaan fitur, atau saran dari tombol **Feedback** di setiap halaman',
                'Melihat status dan tanggapan atas feedback-nya',
                'Mengedit atau menghapus selama masih **Terbuka**',
            ],
            cannot: ['Hanya melihat feedback miliknya', 'Tidak bisa mengubah setelah diproses'],
        },
        {
            role: ROLES.fm,
            who: 'Peninjau & penanggap',
            can: [
                'Melihat feedback semua pengguna di tab **Semua Feedback**',
                'Menanggapi sambil memajukan status',
                'Mengubah status lewat **Ubah Status**',
                'Mendapat notifikasi setiap ada feedback baru',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Hak aksesnya sama dengan Finance manager', 'Juga mendapat notifikasi setiap ada feedback baru'],
        },
    ],
    flow: {
        steps: [
            { label: 'Terbuka', tone: 'wait', role: ROLES.staff, what: 'Mengirim feedback' },
            { label: 'Diproses', tone: 'act', role: ROLES.fm, what: 'Menanggapi: sedang dikerjakan' },
            { label: 'Selesai', tone: 'pos', role: ROLES.fm, what: 'Menandai sudah beres' },
            { label: 'Ditutup', tone: 'neutral', role: ROLES.fm, what: 'Menutup, tidak ditindaklanjuti lagi' },
        ],
        note: 'Tanggapan bisa langsung ke **Selesai** atau **Ditutup**. Selesai baru bisa ditanggapi lagi setelah dikembalikan lewat **Ubah Status**; Ditutup terkunci.',
    },
    tasks: [
        {
            title: 'Mengirim feedback',
            role: ROLES.staff,
            steps: [
                'Klik tombol biru bulat di kanan bawah halaman mana pun (tulisan **Feedback** muncul saat disorot), atau **Kirim Feedback** di **Administrasi › Feedback**.',
                'Pilih **Tipe**: Bug (ada yang salah), Fitur (permintaan fitur baru), atau Saran untuk masukan lain (di form halaman Feedback pilihan ini bernama **Feedback**).',
                'Isi **Judul** singkat dan **Deskripsi** yang jelas: apa yang Anda lakukan, apa yang terjadi, apa yang seharusnya.',
                'Pilih **Prioritas** (Rendah, Sedang, Tinggi, Kritis) dan lampirkan screenshot bila perlu (JPG, PNG, atau PDF, maksimal 5 MB).',
                'Klik **Kirim Feedback**. Statusnya **Terbuka**, dan alamat halaman tempat Anda berada ikut tercatat.',
                'Saat aplikasi menampilkan halaman error, tombol **Laporkan ke Tim IT** di halaman itu langsung mengirim feedback **Bug** berisi detail error (prioritas Tinggi untuk gangguan server, Sedang untuk lainnya).',
            ],
        },
        {
            title: 'Melihat tanggapan',
            role: ROLES.staff,
            steps: [
                'Saat feedback ditanggapi, lonceng notifikasi menampilkan **Tanggapan Feedback**. Klik untuk membuka halaman Feedback.',
                'Klik kartu feedback Anda. Tanggapan tampil di kotak **Tanggapan dari …** beserta waktunya.',
            ],
        },
        {
            title: 'Mengedit atau menghapus feedback',
            role: ROLES.staff,
            steps: [
                'Klik kartu feedback, lalu **Edit** atau **Hapus**.',
                'Kedua tombol hanya ada selama status **Terbuka**. Lampiran tidak bisa diganti lewat Edit.',
            ],
        },
        {
            title: 'Meninjau feedback masuk',
            role: ROLES.fm,
            steps: [
                'Buka **Administrasi › Feedback**. Tab **Semua Feedback** berisi feedback semua pengguna; **Feedback Saya** hanya milik Anda.',
                'Saring dengan **Tipe**, **Status**, **Prioritas**, atau kotak pencarian (judul, deskripsi, nama pengirim).',
                'Klik kartu untuk membaca deskripsi lengkap, **URL halaman** asal laporan, dan lampirannya.',
            ],
        },
        {
            title: 'Menanggapi feedback',
            role: ROLES.fm,
            steps: [
                'Di detail feedback, klik **Tanggapi**.',
                'Tulis **Tanggapan** untuk pengirim, lalu pilih **Status Baru**: Sedang Diproses, Selesai, atau Ditutup.',
                'Klik **Kirim Tanggapan**. Pengirim langsung mendapat notifikasi.',
                'Hanya untuk feedback **Terbuka** atau **Diproses**. Bila sudah ada tanggapan, tombolnya menjadi **Edit Tanggapan**.',
            ],
        },
        {
            title: 'Mengubah status tanpa tanggapan',
            role: ROLES.fm,
            steps: [
                'Di detail feedback, klik **Ubah Status** lalu pilih status baru, termasuk kembali ke **Terbuka**.',
                'Cara ini **tidak** mengirim notifikasi ke pengirim.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat dikirim',
            tone: 'wait',
            items: [
                'Status **Terbuka**; pengirim, alamat halaman asal, dan lampiran tercatat.',
                'Notifikasi **Feedback Baru** ke setiap Admin dan Finance manager.',
                'Tidak mengubah data keuangan apa pun.',
            ],
        },
        {
            title: 'Saat ditanggapi',
            tone: 'act',
            items: [
                'Tanggapan, penanggap, dan waktunya tersimpan di feedback.',
                'Status maju ke Diproses, Selesai, atau Ditutup.',
                'Notifikasi **Tanggapan Feedback** ke pengirim.',
                'Pengirim tidak bisa lagi mengedit atau menghapus.',
            ],
        },
        {
            title: 'Saat lewat Ubah Status',
            tone: 'neutral',
            items: [
                '**Tidak ada notifikasi** ke pengirim.',
                'Kembali ke **Terbuka**: pengirim bisa mengedit dan menghapus lagi.',
                '**Ditutup**: tidak bisa ditanggapi dan tombol Ubah Status hilang.',
            ],
        },
    ],
    records: [
        {
            title: 'Yang tercatat di sebuah feedback',
            subtitle: 'Contoh feedback dari Staff, beserta asal setiap datanya.',
            rows: [
                { label: 'Pengirim', value: 'Staf Uji', source: 'Otomatis', tone: 'neutral' },
                { label: 'URL halaman', value: '/dashboard (halaman saat tombol diklik)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Tipe · Prioritas', value: 'Fitur · Sedang', source: 'Form feedback', tone: 'act' },
                { label: 'Status', value: 'Terbuka → Diproses', source: 'Dialog Tanggapi', tone: 'pos' },
                { label: 'Tanggapan', value: 'Terima kasih, usulan ini masuk rencana rilis November.', source: 'Dialog Tanggapi', tone: 'pos' },
                { label: 'Penanggap & waktu', value: 'Fina Manager · saat Kirim Tanggapan', source: 'Otomatis', tone: 'neutral' },
            ],
            note: 'Hanya ada **satu** tanggapan per feedback. **Edit Tanggapan** menimpa tanggapan sebelumnya.',
        },
    ],
    warnings: [
        {
            title: 'Edit Tanggapan menimpa yang lama',
            body: 'Tidak ada riwayat percakapan. Tanggapan baru menggantikan tanggapan sebelumnya, dan pengirim mendapat notifikasi lagi.',
        },
        {
            title: 'Ubah Status tidak memberi tahu pengirim',
            body: 'Pakai **Tanggapi** bila pengirim perlu tahu feedback-nya sudah dikerjakan atau selesai.',
        },
        {
            title: 'Ditutup berarti terkunci',
            body: 'Feedback berstatus **Ditutup** tidak bisa ditanggapi dan tidak bisa dibuka kembali dari layar. Pilih **Selesai** bila masih mungkin ditindaklanjuti.',
        },
        {
            title: 'Hapus bersifat permanen',
            body: 'Lampirannya ikut terhapus dari server. Tombol **Hapus** hanya tampil bagi pengirim selama feedback masih Terbuka.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Mengirim feedback', cells: [true, true, true] },
        { action: 'Edit / hapus milik sendiri', cells: ['Selama Terbuka', 'Selama Terbuka', 'Selama Terbuka'] },
        { action: 'Melihat feedback semua pengguna', cells: [false, true, true] },
        { action: 'Menanggapi', cells: [false, true, true] },
        { action: 'Ubah Status', cells: [false, true, true] },
        { action: 'Notifikasi Feedback Baru', cells: [false, true, true] },
    ],
};
