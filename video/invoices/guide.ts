import type { ModuleGuide } from '../guide';
import { ROLES } from '../roles';

/** Panduan modul Invoice — lihat video/guide.ts untuk arti tiap bagian. */
export const guide: ModuleGuide = {
    slug: 'invoices',
    title: 'Invoice',
    group: 'Keuangan',
    order: 10,
    path: '/invoices',
    permission: 'view invoices',
    summary:
        'Tagihan ke klien: susun item layanan (beserta HPP dan titipan pajak), terbitkan dengan nomor resmi, cetak PDF, lalu catat setiap pembayaran yang masuk ke rekening bank. Pembayaran inilah yang menambah saldo rekening, pemasukan arus kas, dan pendapatan di laba rugi.',
    roles: [
        {
            role: ROLES.staff,
            who: 'Penyusun invoice',
            can: [
                'Melihat semua invoice, mencetak PDF, dan mengekspor rekap',
                'Membuat invoice: **Simpan draft** atau **Simpan & terbitkan**',
                'Mencatat pembayaran pada invoice yang sudah terbit',
            ],
            cannot: ['Tidak bisa mengedit, menerbitkan draft yang sudah tersimpan, atau menghapus invoice', 'Tidak bisa mengubah / menghapus pembayaran'],
        },
        {
            role: ROLES.fm,
            who: 'Penerbit & penagih',
            can: [
                'Semua yang bisa dilakukan Staff',
                'Menerbitkan draft (**Kirim invoice**) dan mengembalikannya ke draft',
                'Mengedit invoice (juga yang sudah dibayar) dan menghapus invoice yang belum dibayar',
                'Mengubah / menghapus pembayaran',
            ],
        },
        {
            role: ROLES.admin,
            who: 'Akses penuh',
            can: ['Semua yang bisa dilakukan Finance manager', 'Memahami dampak tiap pembayaran ke rekening, arus kas, dan laba rugi'],
        },
    ],
    flow: {
        steps: [
            { label: 'Draft', tone: 'neutral', role: ROLES.staff, what: 'Menyusun item, Simpan draft' },
            { label: 'Terkirim', tone: 'act', role: ROLES.fm, what: 'Kirim invoice: dapat nomor resmi' },
            { label: 'Sebagian', tone: 'wait', role: ROLES.fm, what: 'Catat pembayaran pertama' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Pembayaran menutup sisa' },
        ],
        branch: {
            from: 1,
            label: 'Draft',
            tone: 'neutral',
            title: 'Nomor dibatalkan',
            down: 'Kembalikan ke draft: hanya nomor urut terakhir & belum ada pembayaran',
            up: 'Diperbaiki, lalu dikirim lagi',
        },
        note: '**Perlu ditagih** bukan status: invoice Terkirim / Sebagian yang lewat jatuh tempo.',
    },
    tasks: [
        {
            title: 'Membuat invoice',
            role: ROLES.staff,
            steps: [
                'Buka **Keuangan › Invoice**, lalu klik **Buat Invoice**.',
                'Pilih **Klien**. **Tanggal invoice** terisi hari ini dan **Jatuh tempo** +14 hari; ubah bila perlu (jatuh tempo tidak boleh sebelum tanggal invoice).',
                'Isi baris item: ketik nama layanan atau klik ikon kaca pembesar untuk memilih dari katalog (nama + harga terisi), lalu **Qty**, **Harga satuan**, dan **Satuan**.',
                'Isi **HPP baris** (modal untuk seluruh baris, bukan per unit). Nyalakan **Titipan pajak** untuk baris pajak klien yang hanya dititipkan: ditagih, tetapi tidak dihitung pendapatan.',
                'Klik **Tambah baris** (atau Ctrl+Enter) untuk item berikutnya. Bila perlu, klik **Tambah diskon** (nominal atau persen, beserta alasan yang tercetak di invoice).',
                'Periksa **Total**, **Laba kotor**, dan **Est. PPh** di bagian bawah, lalu klik **Simpan draft** atau **Simpan & terbitkan**.',
                'Staff tidak bisa mengedit invoice setelah tersimpan: periksa sebelum menyimpan, atau minta finance manager memperbaikinya.',
            ],
        },
        {
            title: 'Menagih ke beberapa klien sekaligus',
            role: ROLES.staff,
            steps: ['Nyalakan **Tagih ke beberapa klien**, lalu pilih klien di setiap baris item. Invoice tetap ditujukan ke klien di kolom **Klien**.'],
        },
        {
            title: 'Mencetak / mengunduh PDF',
            role: ROLES.staff,
            steps: [
                'Buka invoice yang sudah bernomor, lalu klik **Cetak**.',
                'Pilih **Jenis tagihan**: **Penuh**, **Uang muka** (isi nominal DP), atau **Pelunasan** (hanya muncul bila sudah dibayar sebagian; menagih sisanya).',
                'Pilih **Template**, periksa pratinjau di kanan (PDF yang sama persis dengan unduhan), lalu klik **Unduh PDF** atau **Buka PDF**.',
            ],
        },
        {
            title: 'Mencatat pembayaran',
            role: ROLES.staff,
            steps: [
                'Buka invoice berstatus **Terkirim** atau **Sebagian**, lalu klik **Catat pembayaran**.',
                '**Jumlah** terisi sisa tagihan. Pilih **Sisa penuh**, **50%**, atau **Nominal lain**; tidak boleh melebihi sisa.',
                'Isi **Tanggal** uang diterima, pilih **Rekening tujuan** (wajib) dan **Metode** (**Transfer bank** / **Tunai**).',
                'Isi **Nomor referensi** dan unggah bukti transfer (JPG, PNG, PDF, maks 5 MB) bila ada, lalu klik **Simpan pembayaran**.',
                'Status otomatis menjadi **Sebagian** atau **Lunas**. Pembayaran yang salah bisa diubah (ikon pensil) atau dihapus (ikon tempat sampah) di kartu **Pembayaran**, tetapi hanya oleh Finance manager / Admin.',
            ],
        },
        {
            title: 'Mengekspor rekap',
            role: ROLES.staff,
            steps: [
                'Atur filter (status, klien, bulan, atau rentang tanggal), lalu klik **Ekspor** dan pilih **Rekap Excel · Default**, **Rekap Excel · JSM**, atau **Rekap PDF**.',
                '**Default** & **PDF** memuat omzet, HPP, profit, PPh final 0,5%, terbayar, dan sisa. **JSM** mengelompokkan invoice per bulan dengan Total Invoice, PPN (rumus, bisa dihapus per baris), Grand Total, tanggal bayar terakhir, dan keterangan dari nama layanan.',
                'Semua rekap mengikuti filter aktif dan tidak memuat draft. Untuk rekap setahun, pakai rentang tanggal 1 Januari – 31 Desember.',
            ],
        },
        {
            title: 'Menerbitkan invoice (memberi nomor)',
            role: ROLES.fm,
            steps: [
                'Klik pil **Draft** di daftar, lalu buka invoice yang akan diterbitkan.',
                'Klik **Kirim invoice**. **Nomor invoice** terisi otomatis sesuai format di **Pengaturan › Penomoran invoice**; boleh diubah, tetapi harus unik.',
                'Klik **Kirim invoice**. Status menjadi **Terkirim**. Aplikasi tidak mengirim email ke klien: unduh PDF lalu kirimkan sendiri.',
            ],
        },
        {
            title: 'Membatalkan nomor (kembalikan ke draft)',
            role: ROLES.fm,
            steps: [
                'Buka invoice **Terkirim**, klik menu **•••**, lalu **Kembalikan ke draft**.',
                'Menu ini hanya muncul untuk invoice bernomor urut terakhir di periodenya dan belum dibayar, agar urutan nomor tidak berlubang. Nomor yang diketik manual di luar format penomoran tidak bisa dibatalkan.',
            ],
        },
        {
            title: 'Menagih invoice yang lewat jatuh tempo',
            role: ROLES.fm,
            steps: [
                'Klik pil **Perlu ditagih** (atau kartu **Perlu ditagih** di ringkasan). Daftar ini mencakup semua bulan.',
                'Buka invoice, klik **Cetak** (**Penuh**, atau **Pelunasan** bila sudah dibayar sebagian), kirim ke klien, lalu catat pembayarannya saat uang masuk.',
            ],
        },
        {
            title: 'Menghapus invoice',
            role: ROLES.fm,
            steps: [
                'Buka invoice, klik menu **•••**, lalu **Hapus invoice**.',
                'Invoice yang sudah punya pembayaran tidak bisa dihapus: hapus pembayarannya dulu (saldo rekening ikut turun).',
            ],
        },
    ],
    impacts: [
        {
            title: 'Saat disimpan / diterbitkan',
            tone: 'act',
            items: [
                '**Draft** tidak dihitung di **Total ditagih**, rekap, maupun laporan.',
                'Terbit: nomor urut periode itu terpakai, invoice masuk **Total ditagih** dan **Belum dibayar**.',
                '**Belum ada uang masuk**: saldo, arus kas, dan laba rugi belum berubah.',
            ],
        },
        {
            title: 'Saat pembayaran dicatat',
            tone: 'pos',
            items: [
                'Saldo **Rekening tujuan** langsung bertambah (dihitung dari data pembayaran).',
                'Muncul di **Arus Kas › Pemasukan** dengan sumber **Invoice**, tanpa kategori.',
                '**Laba Rugi** bulan tanggal bayar: pendapatan dari invoice (kas), HPP ditutup lebih dulu.',
                'Status menjadi **Sebagian** / **Lunas**; ringkasan invoice dan **Dashboard** (saldo & pemasukan) ikut berubah.',
            ],
        },
        {
            title: 'Saat dihapus / diubah',
            tone: 'neg',
            items: [
                'Hapus pembayaran: saldo turun, pemasukan & laba rugi berkurang, status dihitung ulang.',
                'Invoice dengan pembayaran tidak bisa dihapus.',
                'Mengedit item invoice yang sudah dibayar mengubah laba rugi periode lalu.',
            ],
        },
    ],
    records: [
        {
            title: 'Isi pembayaran yang tercatat',
            subtitle: 'Contoh pembayaran 50% tadi, beserta asal setiap datanya.',
            rows: [
                { label: 'Invoice', value: '001/INV/KSN-GSP/X/2026', source: 'Otomatis', tone: 'neutral' },
                { label: 'Jumlah', value: '+Rp 2.700.000', source: 'Dialog Catat pembayaran', tone: 'pos' },
                { label: 'Tanggal', value: '12 Okt 2026 (tanggal uang diterima)', source: 'Dialog Catat pembayaran', tone: 'pos' },
                { label: 'Rekening', value: 'BCA - Operasional', source: 'Dialog Catat pembayaran', tone: 'pos' },
                { label: 'Metode · Ref', value: 'Transfer bank · TRF-GSP-1012', source: 'Dialog Catat pembayaran', tone: 'pos' },
                { label: 'Kategori', value: '— (pemasukan invoice tidak berkategori)', source: 'Otomatis', tone: 'neutral' },
                { label: 'Status invoice', value: 'Terkirim → Sebagian', source: 'Otomatis', tone: 'act' },
            ],
            note: 'Tidak ada transaksi bank terpisah: saldo rekening dan Arus Kas membaca **langsung** dari data pembayaran ini.',
        },
        {
            title: 'Masuk ke Laba Rugi Oktober',
            subtitle: 'Basis kas + cost-recovery: uang masuk menutup HPP dulu, baru sisanya laba.',
            rows: [
                { label: 'Pendapatan', value: 'Rp 2.700.000 (dari invoice, kas)', source: 'Pembayaran', tone: 'pos' },
                { label: 'HPP', value: 'Rp 2.100.000 (seluruh HPP baris tertutup)', source: 'HPP baris', tone: 'act' },
                { label: 'Laba kotor', value: 'Rp 600.000', source: 'Otomatis', tone: 'neutral' },
                { label: 'Pelunasan nanti', value: 'Rp 2.700.000 pendapatan, HPP Rp 0', source: 'Otomatis', tone: 'neutral' },
                { label: 'Titipan pajak', value: 'Ditutup lebih dulu, tidak pernah jadi pendapatan', source: 'Sakelar baris', tone: 'neutral' },
            ],
            note: 'Laporan dihitung ulang dari item invoice **saat ini**: mengubah HPP atau titipan pajak juga mengubah laporan bulan lalu.',
        },
    ],
    warnings: [
        {
            title: 'Hapus pembayaran dari detail invoice',
            body: 'Menghapus baris pembayaran invoice lewat **Arus Kas › Pemasukan** tidak menghitung ulang status: invoice tetap Lunas / Sebagian padahal uangnya hilang dari saldo.',
        },
        {
            title: 'Edit setelah dibayar tidak mengubah status',
            body: 'Mengubah total invoice yang sudah dibayar tidak menghitung ulang status. Mis. total dinaikkan setelah Lunas: tetap Lunas walau ada sisa.',
        },
        {
            title: 'Menghapus klien menghapus invoicenya',
            body: 'Hapus klien (Master Data) ikut menghapus semua invoice klien itu beserta pembayarannya, juga baris item atas nama klien itu di invoice lain. Saldo dan laporan langsung turun.',
        },
        {
            title: 'Menghapus rekening menghapus pembayarannya',
            body: 'Pembayaran invoice ke rekening itu ikut terhapus (pemasukan & laba rugi turun), tetapi status invoice tidak dihitung ulang: tetap Lunas / Sebagian.',
        },
        {
            title: 'Pengingat jatuh tempo terbatas',
            body: 'Notifikasi H-3 dan hari-H (penjadwal pukul 08.00) hanya untuk invoice **Draft** dan **Sebagian**. Invoice Terkirim yang belum dibayar tidak diingatkan: pantau pil **Perlu ditagih**.',
        },
        {
            title: 'Staff melihat tombol yang tidak bisa dipakai',
            body: 'Tombol Kirim invoice, Edit invoice, Hapus invoice, serta ikon ubah / hapus pembayaran tetap tampil untuk Staff, tetapi ditolak server. Draft dari Staff diterbitkan oleh Finance manager / Admin.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat, mencetak PDF & ekspor rekap', cells: [true, true, true] },
        { action: 'Membuat (simpan draft / terbitkan)', cells: [true, true, true] },
        { action: 'Menerbitkan draft tersimpan & rollback', cells: [false, true, true] },
        { action: 'Mengedit invoice', cells: [false, true, true] },
        { action: 'Mencatat pembayaran', cells: [true, true, true] },
        { action: 'Mengubah / menghapus pembayaran', cells: [false, true, true] },
        { action: 'Menghapus invoice', cells: [false, 'Belum dibayar', 'Belum dibayar'] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
