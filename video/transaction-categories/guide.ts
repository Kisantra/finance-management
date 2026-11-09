import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

export const guide: ModuleGuide = {
    slug: 'transaction-categories',
    title: 'Kategori Transaksi',
    group: 'Operasional',
    order: 30,
    path: '/transaction-categories',
    permission: 'view categories',
    summary:
        'Daftar kategori untuk mengelompokkan setiap uang masuk dan keluar: kategori utama sebagai kelompok, sub kategori sebagai pilihan saat mencatat transaksi. Tipe kategori menentukan halaman Arus Kas tempat transaksi tampil, dan Grup Laba Rugi menentukan barisnya di laporan Laba Rugi. Perusahaan baru langsung berisi template kategori yang sudah bergrup Laba Rugi; perusahaan lama bisa melengkapinya lewat Pakai Template. Staff tidak punya akses ke modul ini.',
    roles: [
        {
            role: ROLES.fm,
            who: 'Pengelola kategori',
            can: [
                'Mengisi kategori dari template (Pakai Template)',
                'Menambah kategori utama & sub kategori',
                'Mengatur Grup Laba Rugi tiap kategori',
                'Mengubah nama, tipe, dan parent kategori',
                'Menghapus kategori, sambil memindahkan datanya ke kategori lain',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Menjaga klasifikasi agar Laba Rugi benar'],
        },
    ],
    tasks: [
        {
            title: 'Mengisi kategori dari template',
            role: ROLES.fm,
            steps: [
                'Buka **Operasional › Kategori Transaksi**, lalu klik **Pakai Template**.',
                'Baca pratinjaunya. Kategori disusun mengikuti urutan bagan akun: Pemasukan dulu, lalu Pengeluaran. Tiap baris menunjukkan **Baris Laba Rugi** tujuannya dan statusnya: **Baru**, **Sudah ada**, atau **Dilewati** beserta alasannya.',
                'Klik **Buat N kategori**. Hanya yang berstatus Baru yang dibuat; nama, tipe, grup Laba Rugi, dan induk kategori lama tidak diubah.',
                'Notifikasi menyebut jumlah yang dibuat dan yang dilewati. Bila tombolnya **Tidak ada kategori baru**, semua kategori template sudah ada (perusahaan baru sudah berisi template sejak dibuat).',
            ],
        },
        {
            title: 'Menerapkan template di perusahaan yang sudah berjalan',
            role: ROLES.admin,
            steps: [
                'Di pratinjau **Pakai Template**, periksa grup berstatus **Dilewati**: induknya kategori sistem, atau sudah dipakai langsung oleh transaksi, item permintaan dana, atau reimbursement. Seluruh grup itu tidak dibuat.',
                'Periksa sub berstatus **Sudah ada** yang bercatatan **Sudah ada di grup …**: kategori lama itu tetap di grupnya dan Grup Laba Ruginya tidak diubah. Bila barisnya tertulis **Belum diklasifikasi**, atur grupnya lewat ikon pensil setelah template diterapkan.',
                'Cari nama yang mirip tetapi tidak sama, mis. "Biaya Listrik" dan "Listrik": template tetap membuat kategori barunya. Setelah diterapkan, gabungkan kembaran lewat **Pindahkan & Hapus**.',
                'Klik **Buat N kategori**, lalu buka **Laporan › Laba Rugi**: transaksi baru yang memakai kategori template langsung masuk barisnya, tidak ke panel **Perlu Diklasifikasi**.',
            ],
        },
        {
            title: 'Menambah kategori',
            role: ROLES.fm,
            steps: [
                'Buka **Operasional › Kategori Transaksi**, lalu klik **Tambah Kategori**.',
                'Pilih **Tipe**: Pemasukan, Pengeluaran, Pendanaan, Transfer, atau Penyesuaian.',
                'Isi **Nama Kategori**. Untuk Pemasukan/Pengeluaran, pilih **Grup Laba Rugi (opsional)**, mis. Beban Operasional.',
                'Pilih **Parent Kategori (opsional)** untuk membuat sub kategori. Dikosongkan = kategori utama.',
                'Klik **Simpan Kategori**.',
            ],
        },
        {
            title: 'Mengklasifikasikan kategori untuk Laba Rugi',
            role: ROLES.fm,
            steps: [
                'Klik tombol **Belum diklasifikasi** untuk menampilkan kategori Pemasukan/Pengeluaran yang belum punya grup. Kategori utama ikut tampil; yang terpenting adalah sub kategori, karena itulah yang dipilih saat mencatat transaksi.',
                'Klik ikon pensil di baris sub kategori, pilih **Grup Laba Rugi (opsional)**, lalu klik **Perbarui Kategori**.',
                'Cara lain: dari **Laporan › Laba Rugi**, lewat panel **Perlu Diklasifikasi**.',
            ],
        },
        {
            title: 'Mengubah kategori',
            role: ROLES.fm,
            steps: [
                'Klik ikon pensil di baris kategori untuk membuka **Edit Kategori**.',
                'Ubah **Tipe**, **Nama Kategori**, **Grup Laba Rugi**, atau **Parent Kategori**, lalu klik **Perbarui Kategori**.',
                'Mengklik **Tipe** mengosongkan **Grup Laba Rugi** dan **Parent Kategori**. Pilih ulang keduanya; tanpa parent, sub kategori berubah menjadi kategori utama dan tidak bisa dipilih lagi di form transaksi.',
                'Perubahan langsung berlaku untuk semua transaksi lama yang memakai kategori ini.',
            ],
        },
        {
            title: 'Menghapus kategori',
            role: ROLES.fm,
            steps: [
                'Klik ikon tempat sampah di baris kategori. Kategori yang masih punya sub kategori tidak bisa dihapus (ikonnya nonaktif).',
                'Belum pernah dipakai: klik **Hapus** pada konfirmasi.',
                'Sudah dipakai: pilih **Pindahkan ke Kategori** (tipenya harus sama), lalu klik **Pindahkan & Hapus**.',
            ],
        },
        {
            title: 'Membuat kategori dari form transaksi',
            role: ROLES.fm,
            steps: [
                'Di dialog **Catat Pemasukan** / **Catat Pengeluaran** (dari Rekening Bank atau Arus Kas), klik **+ Tambah** di sebelah **Kategori**.',
                'Pilih **Sub Kategori** (dengan **Kelompok Kategori**) atau **Kelompok**, isi namanya, lalu klik **Tambah**. Tipenya mengikuti form (Pemasukan/Pengeluaran) dan belum punya Grup Laba Rugi.',
                'Daftar **Kelompok Kategori** bisa juga memuat kelompok Transfer atau Penyesuaian. Pilih kelompok yang memang untuk pemasukan/pengeluaran.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat Pakai Template',
            tone: 'pos',
            items: [
                'Hanya kategori baru yang dibuat; kategori lama, transaksi, dan saldo tidak berubah.',
                'Setiap kategori template sudah bergrup Laba Rugi: transaksi yang memakainya langsung masuk barisnya, mis. **Gaji Karyawan → Beban Operasional**, bukan panel **Perlu Diklasifikasi**.',
                'Sub baru langsung muncul di pilihan kategori form transaksi, permintaan dana, dan reimbursement.',
                'Kategori lama yang belum diklasifikasi tetap di panel **Perlu Diklasifikasi**; template tidak mengisi grupnya.',
            ],
        },
        {
            title: 'Saat membuat kategori',
            tone: 'act',
            items: [
                'Belum ada uang yang bergerak: saldo dan laporan tidak berubah.',
                'Sub kategori langsung muncul di pilihan kategori form transaksi; kategori utama hanya sebagai judul kelompok.',
                'Kategori Pemasukan/Pengeluaran tanpa Grup Laba Rugi: transaksinya masuk panel **Perlu Diklasifikasi** dan tidak dihitung di Laba Rugi.',
            ],
        },
        {
            title: 'Saat mengubah kategori',
            tone: 'wait',
            items: [
                '**Grup Laba Rugi**: Laba Rugi dihitung ulang, termasuk bulan-bulan yang sudah lewat.',
                '**Nama**: semua transaksi lama ikut tampil dengan nama baru.',
                '**Tipe**: Grup Laba Rugi dikosongkan; transaksi lama pindah halaman Arus Kas, atau tidak tampil lagi di Pemasukan/Pengeluaran bila tipenya Pendanaan, Transfer, atau Penyesuaian (saldo rekening tidak berubah). Ketiga tipe itu juga keluar dari Laba Rugi.',
                '**Parent**: sub kategori pindah kelompok di pilihan kategori. Tanpa parent, ia menjadi kategori utama dan tidak bisa dipilih lagi di form transaksi.',
            ],
        },
        {
            title: 'Saat Pindahkan & Hapus',
            tone: 'neg',
            items: [
                'Transaksi bank, item permintaan dana, dan reimbursement dipindah ke kategori pengganti dalam satu langkah.',
                'Arus Kas, Breakdown Kategori rekening, dan Laba Rugi mengikuti kategori pengganti.',
                'Kategori lama terhapus permanen; tidak ada cara mengembalikannya.',
            ],
        },
    ],
    records: [
        {
            title: 'Yang dipindahkan saat Pindahkan & Hapus',
            subtitle: 'Contoh: kategori "Biaya Langganan (lama)" dihapus, datanya dipindah ke "Langganan Software".',
            rows: [
                { label: 'Transaksi bank', value: 'Kategori → Langganan Software', source: 'Rekening & Arus Kas', tone: 'pos' },
                { label: 'Item permintaan dana', value: 'Kategori → Langganan Software', source: 'Permintaan Dana', tone: 'act' },
                { label: 'Reimbursement', value: 'Kategori akuntansi → Langganan Software', source: 'Reimbursement', tone: 'act' },
                { label: 'Laba Rugi', value: 'Ikut Grup L/R kategori pengganti', source: 'Otomatis', tone: 'neutral' },
                { label: 'Kategori lama', value: 'Dihapus', source: 'Otomatis', tone: 'neutral' },
            ],
            note: 'Semua dipindah dalam **satu transaksi database**: berhasil semua atau tidak sama sekali.',
        },
        {
            title: 'Yang dibuat saat Pakai Template',
            subtitle: 'Template: 12 kategori utama dan 55 sub kategori, urut bagan akun (pendapatan, lalu harga pokok dan beban).',
            rows: [
                { label: 'Kategori utama baru', value: 'Nama template + Grup Laba Rugi, mis. Beban Karyawan → Beban Operasional', source: 'Pakai Template', tone: 'pos' },
                { label: 'Sub kategori baru', value: 'Di bawah induknya, Grup Laba Rugi sama dengan induk', source: 'Pakai Template', tone: 'pos' },
                { label: 'Induk lama bernama sama', value: 'Dipakai ulang tanpa diubah; sub baru ditempel ke sana', source: 'Otomatis', tone: 'act' },
                { label: 'Sub yang sudah ada', value: 'Dilewati, di grup mana pun ia berada', source: 'Otomatis', tone: 'neutral' },
                { label: 'Induk sistem / dipakai langsung', value: 'Seluruh grupnya dilewati, alasan tercantum', source: 'Otomatis', tone: 'wait' },
            ],
            note: 'Nama dibandingkan tanpa membedakan huruf besar/kecil dan spasi berlebih. Perusahaan baru sudah berisi template; menerapkan ulang tidak membuat apa pun.',
        },
    ],
    warnings: [
        {
            title: 'Nama mirip tidak dianggap sama',
            body: 'Pakai Template hanya mengabaikan huruf besar/kecil dan spasi berlebih. "Biaya Listrik" dan "Listrik", atau "Beban Karyawan Proyek" dan "Beban Karyawan", dianggap berbeda sehingga kategori template tetap dibuat. Periksa pratinjau, lalu gabungkan kembaran lewat Pindahkan & Hapus.',
        },
        {
            title: '"(Tanpa Invoice)" bukan untuk penjualan ber-invoice',
            body: 'Pendapatan dan HPP penjualan lewat invoice sudah dihitung otomatis di Laba Rugi dari pembayaran dan modal item invoice. Kategori **Pendapatan Usaha (Tanpa Invoice)** dan **Harga Pokok Penjualan (Tanpa Invoice)** hanya untuk yang tidak memakai invoice; mencatat ulang penjualan ber-invoice di sana membuatnya terhitung dua kali.',
        },
        {
            title: 'Grup Laba Rugi dibaca dari sub kategori',
            body: 'Laba Rugi membaca grup milik kategori yang dipakai transaksi, dan form transaksi hanya menawarkan sub kategori. Grup pada kategori utama tidak diwariskan ke sub kategorinya, jadi atur grup di tiap sub kategori.',
        },
        {
            title: 'Perubahan berlaku mundur',
            body: 'Mengubah Grup Laba Rugi atau Tipe mengubah laporan bulan-bulan lalu yang sudah dilihat atau dicetak. Lakukan dengan sadar, sebaiknya di awal periode.',
        },
        {
            title: 'Tipe kategori utama tidak menurun',
            body: 'Mengubah Tipe kategori utama tidak mengubah Tipe sub kategorinya, padahal pilihan kategori di form transaksi dikelompokkan menurut tipe kategori utama. Ubah tiap sub kategori satu per satu agar transaksinya tampil di halaman Arus Kas yang benar.',
        },
        {
            title: 'Pilih sub kategori sebagai pengganti',
            body: 'Daftar **Pindahkan ke Kategori** juga memuat kategori utama. Pilih yang berformat **Kategori utama → Sub kategori**, karena kategori utama tidak bisa dipilih di form transaksi.',
        },
        {
            title: 'Pendanaan, Transfer & Penyesuaian di luar Laba Rugi',
            body: 'Pinjaman, setoran modal, dan pindah dana antar rekening memang tidak dihitung sebagai pendapatan atau beban. Jangan memakai tipe ini untuk biaya operasional.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat daftar kategori', cells: [false, true, true] },
        { action: 'Mengisi kategori dari template', cells: [false, true, true] },
        { action: 'Menambah & mengubah kategori', cells: [false, true, true] },
        { action: 'Mengatur Grup Laba Rugi', cells: [false, true, true] },
        { action: 'Menghapus + memindahkan data', cells: [false, true, true] },
        { action: 'Memilih kategori saat mencatat transaksi', cells: ['Di permintaan dana', true, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
