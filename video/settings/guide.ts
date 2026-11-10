import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Pengaturan: akun sendiri, koneksi Claude, profil perusahaan, penomoran invoice, template PDF. Lihat video/guide.ts. */
export const guide: ModuleGuide = {
    slug: 'settings',
    title: 'Pengaturan',
    group: 'Pengaturan',
    order: 10,
    path: '/settings',
    summary:
        'Satu halaman untuk akun Anda (profil, kata sandi, dan koneksi Claude), identitas perusahaan yang tercetak di dokumen PDF, format nomor invoice, dan template PDF invoice. Dibuka dari menu akun di kanan atas › **Pengaturan**.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Pemilik akun',
            can: ['Mengubah nama & email sendiri', 'Mengganti kata sandi sendiri', 'Menghapus akun sendiri'],
            cannot: [
                'Tidak membuka **Profil perusahaan**, **Penomoran invoice**, & **Template PDF**',
                'Tidak menghubungkan **Claude** selama perannya belum diberi izin **use claude**',
            ],
        },
        {
            role: ROLES.fm,
            who: 'Pengatur penomoran',
            can: [
                'Semua yang bisa dilakukan Staff',
                'Mengubah **Profil perusahaan**, termasuk **Singkatan** yang menjadi kode di nomor invoice',
                'Mengatur **Penomoran invoice**: pola, jumlah digit, dan kapan nomor kembali ke 1',
                'Menghubungkan **Claude** ke data keuangan (hanya baca) dan mencabut sambungannya di **Koneksi Claude**',
            ],
            cannot: ['Tidak melihat **Template PDF**'],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Membuat, mengedit, dan menghapus **Template PDF** invoice', 'Mengunggah font kustom untuk template'],
        },
    ],
    tasks: [
        {
            title: 'Mengubah nama atau email',
            role: ROLES.staff,
            steps: [
                'Klik nama Anda di kanan atas, lalu **Pengaturan** › **Profil**.',
                'Ubah **Nama Lengkap** atau **Email** (huruf kecil, belum dipakai akun lain), lalu klik **Simpan Perubahan**.',
                'Email baru langsung dipakai untuk masuk berikutnya.',
            ],
        },
        {
            title: 'Mengganti kata sandi',
            role: ROLES.staff,
            steps: [
                'Buka **Pengaturan** › **Kata sandi**.',
                'Isi **Kata Sandi Saat Ini**, lalu **Kata Sandi Baru** (minimal 8 karakter) dan **Konfirmasi Kata Sandi Baru**.',
                'Klik **Perbarui Kata Sandi**. Tulisan **Tersimpan** muncul bila berhasil.',
            ],
        },
        {
            title: 'Menghapus akun sendiri',
            role: ROLES.staff,
            steps: [
                'Di **Profil**, klik **Hapus Akun**, isi kata sandi Anda, lalu **Hapus Akun Saya**.',
                'Akun dan data milik Anda (reimbursement, pengajuan dana, masukan, notifikasi) terhapus permanen dan Anda langsung keluar.',
            ],
        },
        {
            title: 'Menghubungkan Claude ke data keuangan',
            role: ROLES.fm,
            steps: [
                'Buka **Pengaturan** › **Koneksi Claude**, lalu klik **Salin** di samping **Alamat konektor**. Menu ini hanya tampil bila peran Anda punya izin **use claude** di perusahaan yang sedang dibuka.',
                'Di Claude (web atau desktop), buka **Settings › Connectors**, pilih **Add custom connector**, beri nama **Kisantra Finance**, tempel alamatnya, lalu klik **Connect**.',
                'Halaman aplikasi ini terbuka: masuk bila diminta, periksa daftar perusahaan yang akan terbaca, lalu pilih **Izinkan**.',
                'Di percakapan, aktifkan konektor **Kisantra Finance** lalu bertanyalah, mis. "Berapa invoice yang lewat jatuh tempo bulan ini?"',
                'Untuk memutus akses, klik **Cabut** di **Sambungan aktif**. Claude langsung kehilangan akses dan harus meminta izin lagi.',
            ],
        },
        {
            title: 'Mengatur penomoran invoice',
            role: ROLES.fm,
            steps: [
                'Buka **Pengaturan** › **Penomoran invoice**.',
                'Susun **Pola nomor**: ketik teks/pemisah bebas, lalu klik chip token (mis. **{NO}**, **{PT}**, **{THN}**) untuk menyisipkannya di posisi kursor. **{NO}** wajib tepat satu kali.',
                'Pilih **Jumlah digit nomor urut** dan kapan **Nomor kembali ke 1** (**Tiap bulan** / **Tiap tahun** / **Tidak pernah**). Tiap bulan wajib memuat bulan + tahun; tiap tahun wajib memuat tahun.',
                'Periksa kartu **Pratinjau**, lalu klik **Simpan** (perlu profil perusahaan sudah diisi). Berlaku untuk invoice yang **diterbitkan** setelahnya; nomor yang sudah terbit tidak berubah.',
                'Sesudah server lama dipindah ke versi baru, halaman ini terbuka **otomatis** bila ada invoice lama tanpa urutan nomor. Bila nomor lama memakai format yang masih dipakai, samakan pola sampai tercantum "cocok" lalu **Simpan**. Nomor berformat lama yang sudah tidak dipakai atau diketik manual **biarkan saja**: pola menentukan nomor berikutnya. Lalu klik **Isi urutan & selesai meninjau**.',
            ],
        },
        {
            title: 'Melengkapi profil perusahaan',
            role: ROLES.admin,
            steps: [
                'Buka **Pengaturan** › **Profil perusahaan**. Perusahaan baru (atau yang profilnya belum lengkap) membuka halaman ini **otomatis** sesudah masuk: aplikasi belum bisa dipakai siapa pun sampai profil disimpan.',
                'Isi **Identitas Perusahaan**: nama, **Singkatan** (2-10 huruf, mis. KSN; menjadi kode di nomor invoice), alamat, email, telepon. Bila sudah pernah ada invoice, form menampilkan **nomor invoice terakhir**: samakan kodenya supaya nomor bersambung.',
                'Isi **Penanggung Jawab Keuangan** (nama & jabatan untuk tanda tangan).',
                'Centang **Pengusaha Kena Pajak (PKP)** bila perusahaan PKP; kolom **NPWP** dan **Tarif PPN (%)** baru muncul setelah dicentang. Selama PKP aktif, invoice baru bisa ditagih PPN.',
                'Unggah **Kop Surat**, **Tanda Tangan**, **Stempel**, dan **Logo** (gambar maks 2 MB), lalu klik **Simpan Perubahan**.',
            ],
        },
        {
            title: 'Membuat template PDF invoice',
            role: ROLES.admin,
            steps: [
                'Buka **Pengaturan** › **Template PDF**, klik **Template Baru**, isi **Nama Template**, lalu **Buat Template**.',
                'Editor terbuka: tambahkan teks, gambar, grid, kotak, garis, atau tabel item dari bilah alat bawah; teks bisa memuat token data invoice (**Sisipkan field**).',
                'Klik **Simpan**. **PDF** membuka PDF uji dari layout yang sudah tersimpan dengan data invoice yang terakhir dibuat (**Pratinjau PDF** di menu sesudahnya: sama, dengan 3–60 baris item contoh); tombol **Pratinjau** (ikon mata) menampilkan token terisi langsung di kanvas, lalu berganti menjadi **Ubah**. **Kembali** tanpa Simpan membuang perubahan.',
                'Di daftar, menu **•••** berisi **Ubah Nama**, **Jadikan Bawaan**, **Duplikat**, dan **Hapus**.',
            ],
        },
    ],
    impacts: [
        {
            title: 'Profil perusahaan',
            tone: 'act',
            items: [
                'Nama perusahaan, **kop surat**, tanda tangan, stempel, serta nama & jabatan penanggung jawab tercetak di **PDF invoice**.',
                'Selama **PKP** aktif, editor invoice menampilkan sakelar **Tagih PPN** (menyala untuk invoice baru) dan invoice berulang yang di-publish ikut diberi PPN. **Tarif PPN** disimpan di setiap invoice saat dibuat.',
                'Mematikan PKP atau mengubah Tarif PPN hanya berlaku untuk invoice **baru**; invoice yang sudah ber-PPN tidak berubah.',
                '**Singkatan** menjadi kode **{PT}** di nomor invoice berikutnya & nomor pengajuan dana baru, serta label perusahaan di pemilih perusahaan.',
                'Identitas & penanggung jawab juga ikut di PDF laporan arus kas & pengajuan dana; **NPWP** di PDF rekap invoice & laba rugi.',
            ],
        },
        {
            title: 'Penomoran invoice',
            tone: 'wait',
            items: [
                'Hanya untuk invoice yang **diterbitkan setelah disimpan**; draft belum bernomor.',
                'Nomor yang sudah terbit tidak ikut berubah.',
                'Urutan tetap lanjut dari nomor terbesar di periode yang sama.',
                'Nomor masih bisa diubah manual di dialog **Kirim** invoice.',
            ],
        },
        {
            title: 'Koneksi Claude',
            tone: 'neutral',
            items: [
                'Claude hanya **membaca**: tidak bisa menambah, mengubah, atau menghapus data apa pun.',
                'Yang terbaca mengikuti izin peran pengguna di tiap perusahaan; perusahaan tempat perannya tidak punya **use claude** tidak terbaca.',
                'Sambungan berakhir sendiri setelah 30 hari tidak dipakai; **Cabut** memutusnya seketika.',
                'Saat pemegang **use claude** pertama kali membuka **Koneksi Claude**, server menyiapkan kunci keamanan OAuth secara otomatis. Sekali saja: kunci yang sudah ada tidak pernah diganti, karena menggantinya memutus semua sambungan Claude.',
            ],
        },
        {
            title: 'Template PDF',
            tone: 'pos',
            items: [
                'Setiap template muncul sebagai pilihan di dialog **Cetak invoice**.',
                '**Bawaan** hanya menaruhnya di urutan pertama daftar template buatan; pilihan awal dialog tetap Kisantra.',
                'Menghapus template menghilangkannya dari pilihan cetak; invoice tidak berubah.',
            ],
        },
    ],
    records: [
        {
            title: 'Ke mana isi profil perusahaan mengalir',
            subtitle: 'Isian di satu halaman ini dibaca oleh banyak dokumen PDF.',
            rows: [
                { label: 'Nama perusahaan', value: 'PDF invoice & laporan', source: 'Identitas', tone: 'act' },
                { label: 'Singkatan', value: 'Kode {PT} di nomor invoice & pengajuan dana; label di pemilih perusahaan', source: 'Identitas', tone: 'act' },
                { label: 'Alamat, email, telepon', value: 'Kepala PDF arus kas & pengajuan dana; invoice Semesta & Generik', source: 'Identitas', tone: 'act' },
                { label: 'Nama & jabatan', value: 'Tanda tangan PDF invoice, arus kas, pengajuan dana', source: 'Penanggung jawab', tone: 'pos' },
                { label: 'PKP & Tarif PPN', value: 'Sakelar Tagih PPN di invoice baru; tarif disimpan per invoice', source: 'Pajak', tone: 'wait' },
                { label: 'NPWP', value: 'PDF rekap invoice & laba rugi', source: 'Pajak', tone: 'wait' },
                { label: 'Kop surat', value: 'Kepala PDF invoice (Kisantra, Semesta, AGSA)', source: 'Aset visual', tone: 'neutral' },
                { label: 'Tanda tangan & stempel', value: 'PDF invoice; tanda tangan juga di arus kas', source: 'Aset visual', tone: 'neutral' },
                { label: 'Logo', value: 'Kepala PDF laporan arus kas (bukan invoice)', source: 'Aset visual', tone: 'neutral' },
            ],
            note: 'Rekening tujuan pembayaran yang tercetak di invoice **tidak** diatur di halaman ini. Template PDF buatan Admin hanya memakai data perusahaan yang disisipkan sebagai token.',
        },
    ],
    warnings: [
        {
            title: 'Perusahaan belum bisa dipakai sebelum profilnya lengkap',
            body: 'Selama nama, **Singkatan**, alamat, kontak, atau penanggung jawab keuangan masih kosong, Admin & Finance manager langsung dibawa ke **Profil perusahaan**, sedangkan pengguna lain melihat halaman "belum disiapkan". Isi segera setelah perusahaan dibuat.',
        },
        {
            title: 'Invoice sebelum fitur PPN memakai aturan lama',
            body: 'Invoice yang dibuat sebelum 13 Oktober 2026 tidak menyimpan PPN. Saat dicetak ulang: **Semesta** menambah PPN dari Tarif PPN walau PKP tidak dicentang; **Kisantra** & **Generik** tanpa baris PPN, tetapi bila PKP dicentang teks Terbilang ikut menghitung PPN sehingga berbeda dari angka TOTAL.',
        },
        {
            title: 'Ganti singkatan = kode di nomor dokumen berikutnya berubah',
            body: 'Kode **{PT}** di nomor invoice berikutnya dan nomor pengajuan dana baru diambil dari **Singkatan**. Nomor urut tetap bersambung; nomor yang sudah terbit tidak berubah.',
        },
        {
            title: 'Hapus akun sendiri tidak bisa dibatalkan',
            body: 'Siapa pun bisa menghapus akunnya, termasuk admin terakhir. Reimbursement, pengajuan dana, masukan, dan notifikasi miliknya ikut terhapus, juga riwayat pembayaran reimbursement yang pernah ia catat; transaksi bank-nya tetap ada.',
        },
        {
            title: 'Data yang dibaca Claude ikut diproses Anthropic',
            body: 'Isi yang dibaca Claude masuk ke percakapan dan diproses oleh Anthropic. Hubungkan hanya akun yang memang perlu, dan cabut sambungan yang tidak dipakai lagi di **Koneksi Claude**.',
        },
        {
            title: 'Unggah gambar menimpa file lama',
            body: 'Kop surat, tanda tangan, stempel, atau logo yang lama langsung dihapus dari server saat disimpan; tidak ada riwayat versi.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Mengubah profil & kata sandi sendiri', cells: [true, true, true] },
        { action: 'Menghapus akun sendiri', cells: [true, true, true] },
        { action: 'Menghubungkan Claude (hanya baca)', cells: [false, true, true] },
        { action: 'Mengubah profil perusahaan', cells: [false, true, true] },
        { action: 'Mengatur penomoran invoice', cells: [false, true, true] },
        { action: 'Mengelola template PDF & font', cells: [false, false, true] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
