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
            cannot: ['Tidak bisa mengubah, menerbitkan draft yang sudah tersimpan, atau menghapus invoice', 'Tidak bisa mengubah / menghapus pembayaran'],
        },
        {
            role: ROLES.fm,
            who: 'Penerbit & penagih',
            can: [
                'Semua yang bisa dilakukan Staff',
                'Menerbitkan draft (**Terbitkan invoice**) dan mengembalikannya ke draft',
                'Mengubah invoice (juga yang sudah dibayar) dan menghapus invoice yang belum dibayar',
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
            { label: 'Terbit', tone: 'act', role: ROLES.fm, what: 'Terbitkan invoice: dapat nomor resmi' },
            { label: 'Sebagian', tone: 'wait', role: ROLES.fm, what: 'Catat pembayaran pertama' },
            { label: 'Lunas', tone: 'pos', role: ROLES.fm, what: 'Pembayaran menutup sisa' },
        ],
        branch: {
            from: 1,
            label: 'Draft',
            tone: 'neutral',
            title: 'Nomor dibatalkan',
            down: 'Kembalikan ke draft: hanya nomor urut terakhir & belum ada pembayaran',
            up: 'Diperbaiki, lalu diterbitkan lagi',
        },
        note: '**Perlu ditagih** bukan status: invoice Terbit / Sebagian yang lewat jatuh tempo.',
    },
    tasks: [
        {
            title: 'Membuat invoice',
            role: ROLES.staff,
            steps: [
                'Buka **Keuangan › Invoice**, lalu klik **Buat Invoice**.',
                'Pilih **Klien**. Belum ada? Ketik namanya di kotak cari, klik **Buat klien baru** di bawah daftar, isi **Alamat** di modal **Klien baru**, lalu **Simpan klien**: klien langsung terpilih. Alias, NPWP, dan PIC bisa dilengkapi nanti di **Master Data › Klien**. **Tanggal invoice** terisi hari ini; **Jatuh tempo** dihitung dari **Termin (hari)** di sampingnya. Ubah termin dan jatuh tempo ikut bergeser, atau pilih tanggalnya langsung (tidak boleh sebelum tanggal invoice). Finance manager & admin bisa menekan **Jadikan N hari bawaan** agar invoice berikutnya memakai termin itu.',
                'Bila format nomor perusahaan memakai kode jenis (mis. PT Nusantara Armada Indonesia), isian **Kode jenis** tampil di atas Klien: isi mis. **FINAL** atau **DEM** dan kode itu ikut ke nomor (`…/INV-FINAL/…`); kosongkan untuk nomor tanpa kode (`…/INV/…`).',
                'Isi baris item: ketik nama layanan atau klik ikon kaca pembesar untuk memilih dari katalog (nama + harga terisi), lalu **Qty** dan **Harga satuan**. Harga satuan boleh bersen, mis. **0,85** atau **9.459,46** (koma untuk desimal, titik untuk ribuan); jumlah baris dibulatkan ke Rupiah. Berlaku juga untuk Debit Note. Rincian di bawah nama layanan (mis. pelabuhan muat atau rincian jam) diisi lewat **Tambah keterangan**; **Perihal** (opsional) diisi di bawah Klien. Keduanya tercetak bila desain invoice perusahaan memakainya. Perusahaan dengan desain invoice sendiri juga punya isian **Untuk perhatian (ATTENTION)** (opsional, mis. Direktur Finance & Accounting) yang tercetak di baris ATTENTION; kosong = PIC di data klien.',
                'Di bawah **Qty** isi **satuan** (mis. MT, jam), dan di bawah **Harga satuan** isi **HPP** (modal untuk seluruh baris, bukan per unit). Nyalakan **Titipan pajak** untuk baris pajak klien yang hanya dititipkan: ditagih, tetapi tidak dihitung pendapatan.',
                'Klik **Tambah baris** (atau Ctrl+Enter) untuk item berikutnya. Bila perlu, nyalakan **Beri diskon** di kartu **Penyesuaian** (nominal atau persen, beserta alasan yang tercetak di invoice); mematikannya menghapus diskon.',
                'Bila perusahaan **PKP**, sakelar **Tagih PPN** (mis. 11%) sudah menyala: PPN dihitung dari layanan setelah diskon (titipan pajak tidak ikut) dan masuk ke Total. Matikan untuk invoice tanpa PPN; isi **No. faktur pajak** bila sudah ada.',
                'Bila perusahaan memakai **potongan PPh 23** (diatur admin di Pengaturan › Profil perusahaan), sakelar **Dipotong PPh 23 oleh klien** sudah menyala dengan tarif bawaan (mis. 2 atau 0,5). Potongan dihitung dari dasar yang sama dengan PPN, dan **Total** menjadi yang ditransfer klien (layanan + PPN − PPh 23). Matikan untuk klien yang tidak memotong; invoice klien itu berikutnya ikut tidak dipotong. Perusahaan yang tidak memakainya tidak melihat sakelar ini.',
                'Periksa **Total** (termasuk PPN, setelah potongan PPh 23), **Laba kotor** (tanpa PPN; potongan PPh 23 tetap dihitung pendapatan), dan **Est. PPh final 0,5%** di bagian bawah, lalu klik **Simpan draft** atau **Simpan & terbitkan**. **Simpan & terbitkan** membuka dialog berisi nomor invoice berikutnya sesuai format; Finance manager & admin boleh mengubahnya (asal belum dipakai) sebelum klik **Terbitkan**, Staff melihat nomor otomatisnya saja.',
                'Staff tidak bisa mengubah invoice setelah tersimpan: periksa sebelum menyimpan, atau minta finance manager memperbaikinya.',
            ],
        },
        {
            title: 'Membuat Debit Note (talangan atau tagihan jasa)',
            role: ROLES.staff,
            steps: [
                'Hanya untuk perusahaan yang punya desain Debit Note (saat ini PT Samboja Laju Utama, PT Berkah Andalan Samboja, PT Mitra Kellian Baruna, PT Bahtera Cipta Bersama, dan PT Abdi Ocean Energy) **dan** sudah menyalakannya di **Pengaturan › Profil perusahaan › Debit Note** (bawaan mati; selama mati, editor hanya membuat invoice). Biasanya dipakai untuk menagih kembali biaya yang perusahaan bayar lebih dulu **atas nama klien** (mis. PNBP, demurrage, biaya operasional, overtime hari libur), persis sebesar yang dibayar. Sebagian Debit Note justru menagih jasa perusahaan (mis. Debit Note PT Bahtera Cipta Bersama untuk klien luar negeri: tarif per ton dalam USD, PPN, WHT 23); untuk itu pilih sifat **Tagihan jasa**.',
                'Klik **Buat Invoice**, lalu pada **Jenis dokumen** pilih **Debit Note**. Judul halaman berubah menjadi **Buat Debit Note**.',
                'Isi **Kode jenis** bila perlu (mis. **PNBP**; saran muncul dari kode yang pernah dipakai). Kode ikut ke nomor: petunjuk **Di nomor** menunjukkan hasilnya, mis. `DN-PNBP`. Invoice biasa juga boleh diberi kode (mis. **FINAL** → `INV-FINAL`).',
                'Pada **Isi Debit Note** pilih **Talangan** (bawaan) atau **Tagihan jasa**. **Talangan**: semua item otomatis dianggap talangan — tanpa PPN, tanpa potongan PPh 23, tanpa HPP, dan tidak dihitung pendapatan; sakelar PPN, PPh 23, HPP, dan Titipan pajak tidak tampil. **Tagihan jasa**: Debit Note dihitung persis seperti invoice (PPN, PPh 23, HPP, Titipan pajak, harga USD); hanya judul dan nomornya Debit Note.',
                'Isi klien, perihal, dan item seperti invoice. Rincian seperti nomor nota tagihan, NTPN, atau tanggal on board/complete ditulis lewat **Tambah keterangan** di baris item.',
                'Tagihan jasa dengan **WHT 23 yang ditambahkan ke tagihan** (bukan dipotong klien): tambah baris **WHT 23 (2%)**, ketik nominalnya, dan nyalakan **Titipan pajak** di baris itu. Baris itu ikut ditagih tetapi tidak dihitung pendapatan. Bila jumlah baris bukan hasil qty × harga (mis. sisa tagihan setelah proforma), isi qty **1** dengan jumlahnya sebagai harga, lalu tulis tonase (mis. **Quantity : 50.750 MT**) di keterangan.',
                'Klik **Simpan & terbitkan**. Nomor memakai urutan yang sama dengan invoice (mis. `040/SLU-CBN/DN-PNBP/X/2026` setelah `039/SLU-CBN/INV-TKBM/X/2026`). PDF-nya berjudul **DEBIT NOTE**. Di PT Berkah Andalan Samboja (kolom **DAY** dan **PRICE**) dan PT Mitra Kellian Baruna / PT Bahtera Cipta Bersama / PT Abdi Ocean Energy (kolom **Quantity** dan **PRICE**), kolom jumlah & harga hanya tercetak bila ada item dengan jumlah selain 1 (mis. demurrage 3 hari × tarif harian); tagihan sekali bayar cukup kolom Keterangan dan Total.',
                'Setelah terbit, jenis dan kode tidak bisa diganti karena sudah menjadi bagian nomor. Untuk menggantinya, Finance manager mengembalikannya ke draft dulu. Sifat (Talangan / Tagihan jasa) tetap bisa diubah lewat **Ubah**.',
                'Debit Note talangan: saat membayar biaya itu ke negara, catat di **Arus Kas › Pengeluaran** dengan kategori **Bayar Talangan Klien** (grup Pendanaan), bukan beban, agar Laba Rugi tidak berubah.',
            ],
        },
        {
            title: 'Menagih dalam USD (kurs manual)',
            role: ROLES.staff,
            steps: [
                'Hanya untuk perusahaan yang menyalakan **Tagihan USD** di **Pengaturan › Profil perusahaan** (mis. klien luar negeri PT Bahtera Cipta Bersama). Perusahaan lain tidak melihat pilihan ini.',
                'Di **Detail invoice**, pilih **Mata uang tagihan: USD**, lalu isi **Kurs (Rp per 1 USD)** hari itu. Kurs terakhir yang dipakai terisi otomatis sebagai awalan.',
                'Isi item seperti biasa. Untuk harga per ton/unit dalam USD (mis. $0,82/MT), nyalakan **Harga USD** di baris itu dan ketik harga USD-nya; Rupiahnya = jumlah × harga USD × kurs. Baris lain boleh tetap berharga Rupiah (mis. transport TKBM).',
                'PPN dan potongan PPh 23 tetap dihitung dalam Rupiah. Ringkasan menampilkan **Tagihan USD (total ÷ kurs)** — inilah yang harus dibayar klien. PDF mencetak GRAND TOTAL (IDR), kurs, dan **TOTAL OUTSTANDING (USD)**, beserta rekening USD dari Profil perusahaan.',
                'Invoice **Rupiah** bertarif USD (mis. invoice FINAL stevedoring: $0,75 × kurs = Rp 13.423,50/MT) cukup memakai **Harga USD** + **Kurs** tanpa mengganti mata uang tagihan; PDF mencetak baris Exchange Rate dan Rate Stevedoring seperti dokumen Word.',
                'Mata uang tagihan tidak bisa diganti setelah invoice menerima pembayaran.',
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
                'Pilih **Template**, periksa pratinjau di kanan (PDF yang sama persis dengan unduhan), lalu klik **Unduh PDF** atau **Buka PDF**. Perusahaan yang punya desain invoice sendiri hanya melihat template perusahaannya.',
            ],
        },
        {
            title: 'Mencatat pembayaran',
            role: ROLES.staff,
            steps: [
                'Buka invoice berstatus **Terbit** atau **Sebagian**, lalu klik **Catat pembayaran**.',
                '**Jumlah** terisi sisa tagihan. Pilih **Sisa penuh**, **50%**, atau **Nominal lain**; tidak boleh melebihi sisa.',
                'Isi **Tanggal** uang diterima, pilih **Rekening tujuan** (wajib) dan **Metode** (**Transfer bank** / **Tunai**).',
                'Tagihan **USD**: isi **Diterima (USD)** dan **Kurs saat diterima** (terisi kurs invoice; ganti dengan kurs saat uang dikonversi). Aplikasi menghitung **Masuk ke rekening: Rp …** dan mencatatnya ke rekening Rupiah yang dipilih. Batas sisa dihitung dalam USD.',
                'Kotak **Jurnal · Pratinjau** menunjukkan pembagiannya: rekening didebit penuh; kreditnya menutup **Titipan Pajak Klien** dulu, lalu **PPN Keluaran**, sisanya **Pendapatan dari Invoice** — sama dengan cara Laba Rugi mengakui pendapatan. Uang muka kecil bisa seluruhnya masuk titipan. Pembayaran **Debit Note talangan** seluruhnya dikredit ke **Talangan Biaya Klien**; Debit Note tagihan jasa dijurnal seperti invoice.',
                'Isi **Nomor referensi** dan unggah bukti transfer (JPG, PNG, PDF, maks 5 MB) bila ada, lalu klik **Simpan pembayaran**.',
                'Status otomatis menjadi **Sebagian** atau **Lunas**. Pembayaran yang salah bisa diubah (ikon pensil) atau dihapus (ikon tempat sampah) di kartu **Pembayaran**, tetapi hanya oleh Finance manager / Admin.',
            ],
        },
        {
            title: 'Mengekspor rekap',
            role: ROLES.staff,
            steps: [
                'Atur filter (status, klien, bulan, atau rentang tanggal), lalu klik **Ekspor** dan pilih **Rekap Excel · Bawaan**, **Rekap Excel · JSM**, atau **Rekap PDF**.',
                '**Bawaan** & **PDF** memuat omzet (tanpa PPN, titipan pajak, dan talangan Debit Note), PPN, HPP, profit, PPh final 0,5%, terbayar, dan sisa (termasuk PPN). **JSM** mengelompokkan invoice per bulan dengan Total Invoice, PPN (nilai PPN invoice; invoice sebelum fitur PPN memakai rumus yang bisa dihapus per baris), Grand Total, tanggal bayar terakhir, dan keterangan dari nama layanan.',
                'Semua rekap mengikuti filter aktif dan tidak memuat draft. Untuk rekap setahun, pakai rentang tanggal 1 Januari – 31 Desember.',
            ],
        },
        {
            title: 'Menerbitkan invoice (memberi nomor)',
            role: ROLES.fm,
            steps: [
                'Klik pil **Draft** di daftar, lalu buka invoice yang akan diterbitkan.',
                'Klik **Terbitkan invoice**. **Nomor invoice** terisi otomatis sesuai format di **Pengaturan › Penomoran invoice**; boleh diubah, tetapi harus unik.',
                'Klik **Terbitkan invoice**. Status menjadi **Terbit**. Aplikasi tidak mengirim email ke klien: unduh PDF lalu kirimkan sendiri.',
            ],
        },
        {
            title: 'Membatalkan nomor (kembalikan ke draft)',
            role: ROLES.fm,
            steps: [
                'Buka invoice **Terbit**, klik menu **•••**, lalu **Kembalikan ke draft**.',
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
                'Terbit: nomor urut periode itu terpakai, invoice masuk **Total ditagih** dan **Belum dibayar**; bila ber-PPN, PPN-nya juga dijumlahkan di kartu **PPN** ringkasan (tampil selama perusahaan PKP).',
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
                'Jurnal pembayaran (tampilan, tidak disimpan) memakai rumus titipan dulu yang sama: total kredit **Pendapatan dari Invoice** dan **PPN Keluaran** sebulan = pendapatan invoice & PPN Keluaran di Laba Rugi bulan itu. Terlihat di dialog Catat pembayaran dan di rincian pembayaran Arus Kas / Kas & Bank.',
                'Status menjadi **Sebagian** / **Lunas**; ringkasan invoice dan **Dashboard** (saldo & pemasukan) ikut berubah.',
                'Invoice yang **dipotong PPh 23**: transfer sebesar Total (setelah potongan) langsung **Lunas**. Potongannya tidak masuk rekening, tetapi tetap pendapatan: jurnal mendebit **PPh 23 Dibayar di Muka** (kredit pajak) dan Laba Rugi mencatatnya di **Catatan · PPh 23 dipotong klien**. Simpan bukti potong dari klien untuk SPT.',
                '**Debit Note talangan**: saldo dan pemasukan arus kas bertambah seperti invoice, tetapi pendapatan & laba (Laba Rugi, Ringkasan, rekap) tidak berubah — uangnya mengganti talangan yang dicatat lewat kategori **Bayar Talangan Klien**. **Debit Note tagihan jasa** menambah pendapatan seperti invoice (kecuali baris Titipan pajak, mis. WHT 23 yang ditambahkan).',
                '**Tagihan USD**: invoice **Lunas** saat USD-nya terbayar penuh, berapa pun Rupiah yang masuk. Pendapatan di Laba Rugi tetap sebesar tagihan dengan kurs invoice; bila kurs saat diterima lebih tinggi/rendah, selisihnya tercatat sebagai **Laba selisih kurs** (Pendapatan Lain) atau **Rugi selisih kurs** (Beban Lain), dan jurnalnya memakai akun **Selisih Kurs**.',
            ],
        },
        {
            title: 'Saat dihapus / diubah',
            tone: 'neg',
            items: [
                'Hapus pembayaran: saldo turun, pemasukan & laba rugi berkurang, status dihitung ulang.',
                'Invoice dengan pembayaran tidak bisa dihapus.',
                'Mengubah item invoice yang sudah dibayar mengubah laba rugi periode lalu.',
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
                { label: 'Status invoice', value: 'Terbit → Sebagian', source: 'Otomatis', tone: 'act' },
            ],
            note: 'Tidak ada transaksi bank terpisah: saldo rekening dan Arus Kas membaca **langsung** dari data pembayaran ini.',
        },
        {
            title: 'Masuk ke Laba Rugi Oktober',
            subtitle: 'Basis kas + pemulihan biaya: uang masuk menutup HPP dulu, baru sisanya laba.',
            rows: [
                { label: 'Pendapatan', value: 'Rp 2.700.000 (dari invoice, kas)', source: 'Pembayaran', tone: 'pos' },
                { label: 'HPP', value: 'Rp 2.100.000 (seluruh HPP baris tertutup)', source: 'HPP baris', tone: 'act' },
                { label: 'Laba kotor', value: 'Rp 600.000', source: 'Otomatis', tone: 'neutral' },
                { label: 'Pelunasan nanti', value: 'Rp 2.700.000 pendapatan, HPP Rp 0', source: 'Otomatis', tone: 'neutral' },
                { label: 'Titipan pajak', value: 'Ditutup lebih dulu, tidak pernah jadi pendapatan', source: 'Sakelar baris', tone: 'neutral' },
                { label: 'PPN (bila PKP)', value: 'Ditutup setelah titipan pajak, tercatat terpisah sebagai PPN Keluaran', source: 'Sakelar PPN', tone: 'neutral' },
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
            title: 'Mengubah invoice setelah dibayar tidak mengubah status',
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
            title: 'Tarif PPN terkunci di invoice',
            body: 'Invoice ber-PPN menyimpan tarifnya sendiri. Mengubah Tarif PPN atau mematikan PKP di Pengaturan hanya berlaku untuk invoice **baru**; invoice yang sudah ber-PPN tetap ditagih dengan PPN-nya.',
        },
        {
            title: 'Potongan PPh 23 hanya mengikuti isian invoice',
            body: 'Aplikasi tidak tahu apakah klien benar-benar memotong PPh 23. Bila klien mentransfer penuh tanpa memotong, matikan **Dipotong PPh 23 oleh klien** di invoice itu (Finance manager) agar Total dan sisa tagihannya kembali benar. Mematikan pengaturan PPh 23 di Profil perusahaan tidak mengubah invoice yang sudah dipotong. Invoice berulang selalu diterbitkan tanpa potongan PPh.',
        },
        {
            title: 'Tagihan USD: satu kurs manual, uang muka belum didukung',
            body: 'Kurs diisi manual dan dipakai untuk semua hitungan Rupiah invoice itu, termasuk PPN. Bila faktur pajak harus memakai kurs Menteri Keuangan (KMK), pastikan kurs yang diisi sesuai atau konsultasikan dengan tim pajak. Tagihan USD hanya bisa dicetak **Penuh** (belum uang muka/pelunasan), diskon tetap dalam Rupiah, dan rekap Excel tetap Rupiah.',
        },
        {
            title: 'Nomor Debit Note lama tidak berubah jenis',
            body: 'Saat fitur Debit Note dipasang, nomor lama berawalan **DN** (bila ada) tetap tercatat sebagai invoice biasa, sehingga itemnya masih dihitung pendapatan. Periksa dan perbaiki manual bila perlu.',
        },
        {
            title: 'Pengingat jatuh tempo terbatas',
            body: 'Notifikasi H-3 dan hari-H (penjadwal pukul 08.00) hanya untuk invoice **Draft** dan **Sebagian**. Invoice Terbit yang belum dibayar tidak diingatkan: pantau pil **Perlu ditagih**.',
        },
        {
            title: 'Staff melihat tombol yang tidak bisa dipakai',
            body: 'Tombol Terbitkan invoice, Ubah invoice, Hapus invoice, serta ikon ubah / hapus pembayaran tetap tampil untuk Staff, tetapi ditolak server. Draft dari Staff diterbitkan oleh Finance manager / Admin.',
        },
    ],
    matrixRoles: [ROLES.staff, ROLES.fm, ROLES.admin],
    matrix: [
        { action: 'Melihat, mencetak PDF & ekspor rekap', cells: [true, true, true] },
        { action: 'Membuat (simpan draft / terbitkan)', cells: [true, true, true] },
        { action: 'Menerbitkan draft tersimpan & mengembalikannya ke draft', cells: [false, true, true] },
        { action: 'Mengubah invoice', cells: [false, true, true] },
        { action: 'Mencatat pembayaran', cells: [true, true, true] },
        { action: 'Mengubah / menghapus pembayaran', cells: [false, true, true] },
        { action: 'Menghapus invoice', cells: [false, 'Belum dibayar', 'Belum dibayar'] },
    ],
    insightRoles: ['admin', 'finance manager'],
};
