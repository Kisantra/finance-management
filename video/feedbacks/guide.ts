import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Masukan: laporan bug / permintaan fitur / saran dari pengguna, ditanggapi Admin & Finance manager. */
export const guide: ModuleGuide = {
    slug: 'feedbacks',
    title: 'Masukan',
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
                'Mengirim bug, permintaan fitur, atau saran dari tombol **Masukan** di setiap halaman',
                'Melihat status dan tanggapan atas masukannya',
                'Mengubah atau menghapus selama masih **Terbuka**',
            ],
            cannot: ['Hanya melihat masukan miliknya', 'Tidak bisa mengubah setelah diproses'],
        },
        {
            role: ROLES.fm,
            who: 'Peninjau & penanggap',
            can: [
                'Melihat masukan semua pengguna di tab **Semua Masukan**',
                'Menanggapi sambil memajukan status',
                'Mengubah status lewat **Ubah Status**',
                'Mendapat notifikasi setiap ada masukan baru',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Hak aksesnya sama dengan Finance manager', 'Juga mendapat notifikasi setiap ada masukan baru'],
        },
    ],
    flow: {
        steps: [
            { label: 'Terbuka', tone: 'wait', role: ROLES.staff, what: 'Mengirim masukan' },
            { label: 'Diproses', tone: 'act', role: ROLES.fm, what: 'Menanggapi: sedang dikerjakan' },
            { label: 'Selesai', tone: 'pos', role: ROLES.fm, what: 'Menandai sudah beres' },
            { label: 'Ditutup', tone: 'neutral', role: ROLES.fm, what: 'Menutup, tidak ditindaklanjuti lagi' },
        ],
        note: 'Tanggapan bisa langsung ke **Selesai** atau **Ditutup**. Selesai baru bisa ditanggapi lagi setelah dikembalikan lewat **Ubah Status**; Ditutup terkunci.',
    },
    tasks: [
        {
            title: 'Mengirim masukan',
            role: ROLES.staff,
            steps: [
                'Klik tombol biru bulat di kanan bawah halaman mana pun (tulisan **Masukan** muncul saat disorot), atau **Kirim Masukan** di **Administrasi › Masukan**.',
                'Pilih **Tipe**: Bug (ada yang salah), Fitur (permintaan fitur baru), atau Saran untuk masukan lain.',
                'Isi **Judul** singkat dan **Deskripsi** yang jelas: apa yang Anda lakukan, apa yang terjadi, apa yang seharusnya.',
                'Pilih **Prioritas** (Rendah, Sedang, Tinggi, Kritis) dan lampirkan tangkapan layar bila perlu (JPG, PNG, atau PDF, maksimal 5 MB).',
                'Klik **Kirim Masukan**. Statusnya **Terbuka**, dan alamat halaman tempat Anda berada ikut tercatat.',
                'Saat aplikasi menampilkan halaman error, tombol **Laporkan ke Tim IT** di halaman itu langsung mengirim masukan **Bug** berisi detail error (prioritas Tinggi untuk gangguan server, Sedang untuk lainnya).',
            ],
        },
        {
            title: 'Melihat tanggapan',
            role: ROLES.staff,
            steps: [
                'Saat masukan ditanggapi, lonceng notifikasi menampilkan **Tanggapan Masukan**. Klik untuk membuka halaman Masukan.',
                'Klik kartu masukan Anda. Tanggapan tampil di kotak **Tanggapan dari …** beserta waktunya.',
            ],
        },
        {
            title: 'Mengubah atau menghapus masukan',
            role: ROLES.staff,
            steps: [
                'Klik kartu masukan, lalu **Ubah** atau **Hapus**.',
                'Kedua tombol hanya ada selama status **Terbuka**. Lampiran tidak bisa diganti lewat Ubah.',
            ],
        },
        {
            title: 'Meninjau masukan masuk',
            role: ROLES.fm,
            steps: [
                'Buka **Administrasi › Masukan**. Tab **Semua Masukan** berisi masukan semua pengguna; **Masukan Saya** hanya milik Anda.',
                'Saring dengan **Tipe**, **Status**, **Prioritas**, atau kotak pencarian (judul, deskripsi, nama pengirim).',
                'Klik kartu untuk membaca deskripsi lengkap, **URL halaman** asal laporan, dan lampirannya.',
            ],
        },
        {
            title: 'Menanggapi masukan',
            role: ROLES.fm,
            steps: [
                'Di detail masukan, klik **Tanggapi**.',
                'Tulis **Tanggapan** untuk pengirim, lalu pilih **Status Baru**: Diproses, Selesai, atau Ditutup.',
                'Klik **Kirim Tanggapan**. Pengirim langsung mendapat notifikasi.',
                'Hanya untuk masukan **Terbuka** atau **Diproses**. Bila sudah ada tanggapan, tombolnya menjadi **Ubah Tanggapan**.',
            ],
        },
        {
            title: 'Mengubah status tanpa tanggapan',
            role: ROLES.fm,
            steps: [
                'Di detail masukan, klik **Ubah Status** lalu pilih status baru, termasuk kembali ke **Terbuka**.',
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
                'Notifikasi **Masukan Baru** ke setiap Admin dan Finance manager.',
                'Tipe **Bug** otomatis diteruskan ke **Watchpost** tim IT sebagai tiket, beserta halaman, jejak langkah, dan lampirannya. Fitur dan Saran tidak.',
                'Tidak mengubah data keuangan apa pun.',
            ],
        },
        {
            title: 'Saat ditanggapi',
            tone: 'act',
            items: [
                'Tanggapan, penanggap, dan waktunya tersimpan di masukan.',
                'Status maju ke Diproses, Selesai, atau Ditutup.',
                'Notifikasi **Tanggapan Masukan** ke pengirim.',
                'Pengirim tidak bisa lagi mengedit atau menghapus.',
            ],
        },
        {
            title: 'Saat tim IT memperbarui tiket Watchpost',
            tone: 'act',
            items: [
                'Khusus **Bug** yang sudah diteruskan: statusnya ikut tiket (Diproses, Selesai, atau Ditutup bila diabaikan), paling lambat semenit kemudian.',
                'Notifikasi **Laporan Bug Diperbarui** ke pengirim setiap kali statusnya berubah.',
                'Status bug ini tidak bisa diubah dari aplikasi. **Tanggapi** tetap bisa untuk menulis balasan.',
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
            title: 'Yang tercatat di sebuah masukan',
            subtitle: 'Contoh masukan dari Staff, beserta asal setiap datanya.',
            rows: [
                { label: 'Pengirim', value: 'Staf Uji', source: 'Otomatis', tone: 'neutral' },
                { label: 'URL halaman', value: '/dashboard (halaman saat tombol diklik, termasuk detail yang sedang terbuka)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Tiket Watchpost', value: '#12 (hanya untuk Bug, terlihat oleh pengelola)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Tipe · Prioritas', value: 'Fitur · Sedang', source: 'Form masukan', tone: 'act' },
                { label: 'Status', value: 'Terbuka → Diproses', source: 'Dialog Tanggapi', tone: 'pos' },
                { label: 'Tanggapan', value: 'Terima kasih, usulan ini masuk rencana rilis November.', source: 'Dialog Tanggapi', tone: 'pos' },
                { label: 'Penanggap & waktu', value: 'Fina Manager · saat Kirim Tanggapan', source: 'Otomatis', tone: 'neutral' },
            ],
            note: 'Hanya ada **satu** tanggapan per masukan. **Ubah Tanggapan** menimpa tanggapan sebelumnya.',
        },
    ],
    warnings: [
        {
            title: 'Status Bug diatur tim IT di Watchpost',
            body: 'Laporan **Bug** dikirim ke Watchpost sekali saat dikirim, lalu statusnya mengikuti tiket di sana. Mengubah, menanggapi, atau menghapus masukan di sini tidak mengubah tiketnya.',
        },
        {
            title: 'Ubah Tanggapan menimpa yang lama',
            body: 'Tidak ada riwayat percakapan. Tanggapan baru menggantikan tanggapan sebelumnya, dan pengirim mendapat notifikasi lagi.',
        },
        {
            title: 'Ubah Status tidak memberi tahu pengirim',
            body: 'Pakai **Tanggapi** bila pengirim perlu tahu masukannya sudah dikerjakan atau selesai.',
        },
        {
            title: 'Ditutup berarti terkunci',
            body: 'Masukan berstatus **Ditutup** tidak bisa ditanggapi dan tidak bisa dibuka kembali dari layar. Pilih **Selesai** bila masih mungkin ditindaklanjuti.',
        },
        {
            title: 'Hapus bersifat permanen',
            body: 'Lampirannya ikut terhapus dari server. Tombol **Hapus** hanya tampil bagi pengirim selama masukan masih Terbuka.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Mengirim masukan', cells: [true, true, true] },
        { action: 'Ubah / hapus milik sendiri', cells: ['Selama Terbuka', 'Selama Terbuka', 'Selama Terbuka'] },
        { action: 'Melihat masukan semua pengguna', cells: [false, true, true] },
        { action: 'Menanggapi', cells: [false, true, true] },
        { action: 'Ubah Status', cells: [false, true, true] },
        { action: 'Notifikasi Masukan Baru', cells: [false, true, true] },
    ],
};
