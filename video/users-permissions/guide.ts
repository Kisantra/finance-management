import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Administrasi › Pengguna + Izin & Peran. Lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'users-permissions',
    title: 'Pengguna & Izin',
    group: 'Administrasi',
    order: 10,
    path: '/admin/users',
    permission: ['manage users', 'view permissions'],
    summary:
        'Tempat Admin membuat akun karyawan, memberi satu peran (Admin, Finance manager, Staff, atau peran buatan sendiri), dan mengatur izin tiap peran. Menu dan tombol yang muncul di seluruh aplikasi mengikuti izin peran ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengamat izin',
            can: ['Membuka **Izin & Peran** untuk melihat izin tiap peran'],
            cannot: ['Tidak bisa mengubah izin atau peran', 'Tidak melihat menu **Pengguna**'],
        },
        {
            role: ROLES.admin,
            who: 'Pengelola akses',
            can: [
                'Menambah, mengedit, menonaktifkan, dan menghapus pengguna',
                'Memberi atau mengganti peran pengguna',
                'Mencentang izin per peran, per modul, atau sekaligus',
                'Menambah, mengganti nama, dan menghapus peran',
            ],
            cannot: [
                'Tidak bisa menghapus akun sendiri',
                'Tidak bisa menghapus peran **admin** dan **staff**, maupun peran yang sedang ia pakai',
            ],
        },
    ],
    tasks: [
        {
            title: 'Menambah pengguna',
            role: ROLES.admin,
            steps: [
                'Buka **Administrasi › Pengguna**, lalu klik **Tambah Pengguna**.',
                'Isi **Nama Lengkap**, **Email** (harus belum dipakai), dan **Nomor Telepon** bila ada. Biarkan **Status** di **Aktif**.',
                'Pilih **Peran**, lalu isi **Kata Sandi** (minimal 8 karakter) dan **Konfirmasi Kata Sandi**.',
                'Klik **Tambah Pengguna**. Akun langsung bisa dipakai masuk; tidak ada email verifikasi.',
            ],
        },
        {
            title: 'Mengubah peran, status, atau kata sandi pengguna',
            role: ROLES.admin,
            steps: [
                'Di baris pengguna, klik ikon pensil (**Edit pengguna**).',
                'Ganti **Peran** atau **Status** (**Aktif** / **Tidak Aktif**).',
                'Isi **Kata Sandi** + **Konfirmasi Kata Sandi** hanya bila ingin menggantinya; kosongkan bila tidak.',
                'Klik **Simpan Perubahan**. Peran lama diganti; satu pengguna hanya punya satu peran.',
            ],
        },
        {
            title: 'Mencari & menghapus pengguna',
            role: ROLES.admin,
            steps: [
                'Saring dengan **Peran**, **Status**, atau ketik di kotak **Cari nama, email, atau telepon...**.',
                'Klik ikon tempat sampah (**Hapus pengguna**) lalu **Hapus**, atau centang beberapa baris, klik **Hapus** di bilah bawah, lalu **Hapus Semua**.',
                'Akun Anda sendiri tidak bisa dihapus (tidak ada tombol hapus di baris bertanda **Anda**).',
            ],
        },
        {
            title: 'Mengatur izin sebuah peran',
            role: ROLES.admin,
            steps: [
                'Buka **Administrasi › Izin & Peran**, lalu klik peran di **Daftar Peran**.',
                'Centang atau hapus centang satu izin. Perubahan langsung tersimpan.',
                'Klik **Semua** / **None** di judul modul untuk seluruh izin modul itu, atau **Beri Semua** / **Cabut Semua** (dengan konfirmasi) untuk semua izin.',
                'Pakai **Cari permission...** untuk menyaring, mis. ketik "invoices".',
            ],
        },
        {
            title: 'Menambah atau menghapus peran',
            role: ROLES.admin,
            steps: [
                'Klik **Tambah Peran**, isi **Nama Peran** (otomatis huruf kecil), pilih **Ikon Peran**, lalu **Tambah Peran**. Peran baru belum punya izin apa pun.',
                'Ikon pensil di kartu peran untuk mengganti nama/ikon (pada peran bawaan **admin** dan **finance manager**, pilih ulang **Ikon Peran** sebelum **Simpan Perubahan**, bila tidak penyimpanan ditolak); ikon tempat sampah untuk menghapus.',
                'Peran **admin** dan **staff** tidak bisa dihapus, begitu pula peran yang sedang Anda pakai.',
            ],
        },
        {
            title: 'Melihat izin tiap peran',
            role: ROLES.fm,
            steps: [
                'Buka **Administrasi › Izin & Peran**, lalu klik peran di **Daftar Peran**.',
                'Kotak centang tampil redup: Finance manager hanya bisa melihat, tidak mengubah.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat pengguna ditambah / diedit',
            tone: 'act',
            items: [
                'Menu dan tombol di seluruh aplikasi langsung mengikuti izin perannya.',
                'Peran **admin** dan **finance manager** ikut menerima notifikasi feedback baru dan invoice jatuh tempo.',
                'Peran bernama **admin** juga membuka aturan khusus: menghapus reimbursement orang lain yang belum dibayar, mengedit pengajuan dana orang lain, dan menghapus pengajuan dana di status apa pun.',
                'Status **Tidak Aktif** menyembunyikannya dari pilihan karyawan di **Piutang**, tetapi **tidak memblokir login**.',
            ],
        },
        {
            title: 'Saat pengguna dihapus',
            tone: 'neg',
            items: [
                'Akun hilang permanen; tidak ada tempat sampah.',
                'Ikut terhapus: **reimbursement**, **pengajuan dana**, **feedback**, dan **notifikasi** miliknya.',
                'Transaksi bank dari pembayaran/pencairannya **tetap ada**, jadi saldo & laporan tidak berubah.',
                'Namanya sebagai peninjau, pencair dana, penyetuju piutang, atau penanggap feedback di data orang lain menjadi kosong.',
            ],
        },
        {
            title: 'Saat izin / peran diubah',
            tone: 'wait',
            items: [
                'Berlaku untuk **semua pengguna** berperan itu pada halaman berikutnya yang mereka buka.',
                'Menghapus peran memindahkan penggunanya ke peran dengan **izin paling sedikit**.',
                'Menghapus sebuah izin (tanda **×** merah) mencabutnya dari **semua peran**, termasuk admin.',
                'Angka tugas di menu **Reimbursement** dan **Permintaan Dana** ikut izin menyetujui, membayar, dan mencairkan peran itu.',
            ],
        },
    ],
    records: [
        {
            title: 'Apa yang terjadi pada data saat pengguna dihapus',
            subtitle: 'Hapus pengguna tidak bisa dibatalkan. Ini yang ikut terhapus dan yang tetap tinggal.',
            rows: [
                { label: 'Reimbursement', value: 'Semua pengajuannya + riwayat pembayarannya', source: 'Ikut terhapus', tone: 'neg' },
                { label: 'Pengajuan dana', value: 'Semua pengajuan + rinciannya', source: 'Ikut terhapus', tone: 'neg' },
                { label: 'Feedback & notifikasi', value: 'Semua miliknya', source: 'Ikut terhapus', tone: 'neg' },
                { label: 'Pembayaran yang ia catat', value: 'Riwayat bayar reimbursement orang lain yang ia bayar', source: 'Ikut terhapus', tone: 'neg' },
                { label: 'Transaksi bank', value: 'Pembayaran & pencairan yang sudah keluar', source: 'Tetap', tone: 'pos' },
                { label: 'Piutang karyawan', value: 'Tetap ada, nama peminjam menjadi kosong', source: 'Tetap', tone: 'wait' },
                { label: 'Peninjau / pencair', value: 'Namanya hilang dari data orang lain', source: 'Dikosongkan', tone: 'neutral' },
            ],
            note: 'Untuk karyawan yang keluar, lebih aman ubah **Status** ke **Tidak Aktif** dan ganti **Kata Sandi**-nya daripada menghapus. Ingat: keduanya tidak menutup sesi yang masih terbuka di perangkatnya.',
        },
    ],
    warnings: [
        {
            title: 'Menghapus pengguna ikut menghapus datanya',
            body: 'Reimbursement, pengajuan dana, feedback, dan notifikasinya hilang permanen. Untuk karyawan yang keluar, nonaktifkan dan ganti kata sandinya.',
        },
        {
            title: 'Tidak Aktif tidak mengunci akun',
            body: 'Pengguna berstatus **Tidak Aktif** masih bisa masuk. Ganti juga **Kata Sandi**-nya agar ia tidak bisa masuk lagi dengan sandi lama. Sesi yang sudah terbuka (termasuk **Ingat saya**) tidak otomatis berakhir, dan **Lupa kata sandi** tetap bisa dipakai bila ia masih memegang email akunnya.',
        },
        {
            title: 'Jangan cabut izin dari peran admin',
            body: 'Tidak ada pengaman: mencabut **manage permissions** atau **manage users** dari admin, atau mengganti peran akun Anda sendiri, bisa mengunci semua admin dari halaman ini.',
        },
        {
            title: 'Hapus izin = semua peran kehilangan akses',
            body: 'Tanda **×** merah menghapus izin dari sistem. Halaman yang memakainya tertutup untuk semua orang, termasuk admin, dan izin itu tidak bisa dibuat ulang dari aplikasi: perlu pengembang (migrasi/seeder).',
        },
        {
            title: 'Jangan ganti nama peran bawaan',
            body: 'Notifikasi dan aturan khusus admin mencari peran bernama **admin** dan **finance manager**; perlindungan hapus mencari **admin** dan **staff**. Mengganti namanya mematikan fitur itu.',
        },
        {
            title: 'Peran finance manager bisa terhapus',
            body: 'Hanya **admin** dan **staff** yang dilindungi. Bila finance manager dihapus, penggunanya pindah ke peran dengan izin paling sedikit.',
        },
    ],
    matrixRoles: [ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat daftar pengguna', cells: [false, true] },
        { action: 'Menambah, mengedit & menghapus pengguna', cells: [false, true] },
        { action: 'Melihat izin tiap peran', cells: [true, true] },
        { action: 'Mengubah izin peran', cells: [false, true] },
        { action: 'Menambah, mengubah & menghapus peran', cells: [false, true] },
        { action: 'Menghapus izin dari sistem (tanda ×)', cells: [false, true] },
    ],
};
