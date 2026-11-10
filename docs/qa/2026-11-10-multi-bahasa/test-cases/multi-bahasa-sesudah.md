# Test Case — Multi bahasa (ID · EN · ZH), keadaan SESUDAH perubahan

Sumber: rencana multi bahasa §1 (dugaan lama, kini dibalik), §6 (matriks 29 modul), §7 lapis 4–5. Pembanding: [`multi-bahasa-sebelum.md`](multi-bahasa-sebelum.md).
Cara baca tabel & kolom **Lapisan**: [`docs/qa/README.md`](../../README.md). Lingkungan, akun, dan langkah reproduksi: [`README.md`](../README.md). Hasil pemindai DOM per layar, daftar pengecualian sah, dan daftar temuan: [`pemindai-dom.md`](../pemindai-dom.md).

**Kriteria lulus utama (K7):** di setiap menu, tab, dialog, dan keadaan, bila 中文 dipilih semua komponen tampil Mandarin tanpa sisa teks antarmuka Indonesia maupun Inggris; bila English dipilih tidak ada sisa Indonesia. Pengecualian sah (data buatan pengguna/perusahaan, data bawaan sistem, nama diri/merek, akronim pajak, Rp dan angka, kode/ID/nomor/token, label aplikasi lain yang dikutip, isi dokumen PDF/Excel) didaftarkan di `pemindai-dom.md` dan tidak dihitung gagal.

**Status:** `Pass` = sesuai harapan; `Terbantah (dugaan lama dibalik: lulus)` = dugaan gelombang 1 yang dulu terbukti kini terbantah, jadi fiturnya berfungsi; `Fail (Fxx)` = ada temuan non-pengecualian, kode temuan di `pemindai-dom.md`.

**Prasyarat**: lingkungan `bhs_*` gelombang 1 + data tambahan (invoice draft/terbit/sebagian/lunas/lewat tempo, reimbursement dan pengajuan dana tiap status, utang dan piutang aktif dan lunas, template berulang, tiga Masukan, notifikasi). Akun: qa1–qa3 (finance manager), qa4 dan admin (admin), fm dan budi (finance manager dan staf). Kata sandi tidak dicantumkan.

## A. Kondisi normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Tampilan ID tetap normal | Login qa1 (finance manager) dengan users.locale = id → Dashboard → Arus Kas › Semua → Catat Pemasukan → Invoice. | Semua layar berbahasa Indonesia, pemilih menunjukkan ID. | FE | Sesuai. Pemilih "ID", `<html lang="id">`; Dashboard, Arus Kas, dialog Catat Pemasukan, dan Invoice berbahasa Indonesia. | Pass |
| N02 | Tampilan ID sama seperti sebelum, kecuali perapian disengaja | Bandingkan 5 layar ID (Dashboard, Arus Kas, dialog Catat Pemasukan, Invoice, Login) antara screenshot gelombang 1 dan sekarang. | Tata letak identik; beda hanya pada perapian teks yang disengaja. | FE | Sesuai. Perbedaan teramati seluruhnya disengaja: pemilih bahasa berikon di header dan di halaman login; "Terkirim" → "Terbit"; "Lewat tempo" → "Lewat jatuh tempo"; "Masuk ke Dasbor" → "Masuk"; "drag & drop" → "seret & lepas"; draft tanpa nomor "belum bernomor"; badge Operasional dan jumlah data bertambah karena data uji. Tidak ada pergeseran tata letak atau teks hilang. Regresi sampel per modul tersebar di C03–C29 (ID dipindai oleh crawler yang sama: 517 layar admin, 277 FM, 182 staf, tanpa halaman gagal selain 403 yang wajar untuk staf). | Pass |

## B. Kasus berdugaan gelombang 1 (dibalik) dan tata letak

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | EN bisa dipilih dan seluruh tampilan, toast, dan validasi berbahasa Inggris | Menu bahasa → English → Dashboard, Arus Kas, dialog Record Income; simpan pemasukan (toast); kirim formulir kosong (validasi). DB: users.locale, sesi. | EN berfungsi; toast dan validasi Inggris; users.locale = en. | FE+BE | Lulus. POST /language → 409 (muat ulang penuh), pemilih "EN", `<html lang="en-GB">`, users.locale = `en`. Toast sukses "Income recorded", toast galat "Please review the form entries". Validasi server: "The amount field must be at least 1.", "The transaction category field is required." Dialog dan Dashboard tanpa sisa Indonesia (kecuali data). | Terbantah (dugaan lama dibalik: lulus) |
| A02 | ZH: label, toast, dan validasi berbahasa Mandarin | Menu bahasa → 中文 → Dashboard, Arus Kas, dialog 登记收入; simpan pemasukan (toast); kirim formulir kosong (validasi). | Seluruh antarmuka, toast, dan validasi Mandarin; deskripsi yang disimpan tetap apa adanya. | FE+BE | Lulus. Pemilih "ZH", `<html lang="zh-CN">`, users.locale = `zh`. Toast sukses "收入已登记", toast galat "请检查表单填写内容". Validasi: "金额不能小于 1。", "交易类别不能为空。". Dialog, kotak Jurnal, tombol, dan Dashboard seluruhnya Mandarin; hanya data (nama rekening, kategori, deskripsi input pengguna) dan angka Rupiah tetap. DB: transaksi uji tersimpan dengan deskripsi persis seperti yang diketik. | Terbantah (dugaan lama dibalik: lulus) |
| A03 | ZH → keluar → sesi baru → login: bahasa kembali ZH | Dalam ZH: menu pengguna › 退出登录 → bersihkan cookie → halaman login → login ulang. Cek users.locale di tiap tahap. | Setelah login, tampilan ZH walau halaman login (tamu, tanpa identitas) berbahasa bawaan. | FE+BE | Lulus. users.locale: `zh` sebelum keluar, `zh` setelah keluar, `zh` sesudah login. Halaman login sesi baru berbahasa bawaan (ID), setelah login pemilih "ZH", `<html lang="zh-CN">`, seluruh layar Mandarin. (Lihat juga A08: pilihan tamu ikut tersimpan.) | Terbantah (dugaan lama dibalik: lulus) |
| A04 | Dokumen terkunci Indonesia | Sesi ZH: Invoice › 001/INV/BQA-MJ/XI/2026 › 打印 › 下载 PDF. Render halaman 1 dan baca teksnya; ulangi di sesi ID dan EN. | PDF Indonesia penuh, tanpa "?" dari huruf Mandarin. | FE | Lulus. PDF ZH (1 halaman): "INVOICE", "Ditagih Kepada :", "Syarat Pembayaran", "Terbilang: Tujuh Juta Tiga Ratus Ribu Rupiah", "TOTAL PELUNASAN"; karakter Mandarin di PDF: False. Satu "?" tersisa di judul kotak "? INFORMASI PELUNASAN" (ikon template yang tidak punya glyph; sudah ada di PDF ID sebelum perubahan, bukan akibat locale). PDF yang diunduh dari sesi ID dan EN juga Indonesia. Dialog Cetak sendiri ikut bahasa tampilan. | Terbantah (dugaan lama dibalik: lulus) |
| A05 | Kalender ikut bahasa aktif | Buka dialog Catat Pemasukan → klik kolom Tanggal di sesi ZH lalu EN. Baca judul, kepala hari, aria-label. | ZH: bulan dan hari Mandarin; EN: Inggris, minggu mulai Senin. | FE | Lulus. ZH: kolom "2026年11月10日", judul "2026年11月", kepala hari 一 二 三 四 五 六 日 (Senin pertama), aria-label 上个月/下个月 dan 星期一…星期日. EN: kolom "10 Nov 2026", kepala Mo Tu We Th Fr Sa Su, aria "Previous month"/"Next month"/"Monday…". Tidak ada lagi aria-label ganda berbahasa Inggris bawaan pustaka di ZH. | Terbantah (dugaan lama dibalik: lulus) |
| A06 | Label tanggal dan satuan grafik mengikuti bahasa | Sesi ZH dan EN: Dashboard (sumbu bulan, keterangan periode) dan Kas & Bank (grafik Pemasukan vs Pengeluaran). | Sumbu, keterangan, dan satuan mengikuti bahasa; nilai Rupiah tetap. | FE | Sebagian. Dashboard ZH: sumbu "6月…11月", satuan "150 百万", keterangan "1–10 11月 收入", rentang "6月1日 – 11月30日"; EN: "Jun…Nov", "100M", "Jan–… Nov" — seragam. Kas & Bank: sumbu X mengikuti bahasa ("12月 2025…", "Dec 2025…"), tetapi sumbu Y tetap "Rp 100jt … Rp 20jt" di EN dan ZH (juga ID): lihat F06; label aksesibilitas grafik berbahasa Inggris (F07). | Terbukti sebagian (F06) |
| A07 | Email id/en/zh sesuai bahasa halaman peminta | Tamu pilih ID, EN, ZH lewat pemilih di halaman login → /forgot-password → kirim untuk qa1 (ID), qa2 (EN), qa3 (ZH). Baca isi email dari log mail. | Tiga email, masing-masing sesuai bahasa; pesan konfirmasi di halaman juga sesuai. | FE+BE | Lulus. Email ID: judul "Pemberitahuan Atur Ulang Kata Sandi", isi "Halo! … Salam hormat"; email EN: "Reset Password Notification", "Hello! … Regards"; email ZH: judul "重置密码", isi "您好！… 此致". Pesan di halaman: ID "Tautan atur ulang kata sandi akan dikirim bila akunnya terdaftar.", EN "A password reset link will be sent if the account is registered.", ZH "如果该账户已注册，我们会发送重置密码的链接。". Token tautan disamarkan. | Terbantah (dugaan lama dibalik: lulus) |
| A08 | Tamu bisa memilih bahasa dan pilihannya ikut ke akun | Buka /login (sesi baru) → menu bahasa → EN → ZH → EN lalu login. Cek tampilan dan users.locale. | Halaman login berganti bahasa; setelah login langsung EN dan users.locale = en. | FE+BE | Lulus. 1 pemilih di halaman login. EN: `<html lang="en">`, ZH: `<html lang="zh-CN">`, teks "欢迎回来 / 登录您的账户以继续 / 登录". Setelah memilih EN lalu login: pemilih "EN", users.locale = `en`. | Terbantah (dugaan lama dibalik: lulus) |
| A09 | Cek teks terpotong, tumpang tindih, dan gulir horizontal | 26 halaman indeks × ID/EN/ZH × 1280 px dan 390 px: ukur gulir horizontal, elemen terpotong elipsis dibanding ID, dan teks yang melewati tepi layar; tinjau screenshot sampel. | Tanpa gulir horizontal; teks EN yang lebih panjang tidak memecah tata letak. | FE | Gulir horizontal halaman: 0 di semua kombinasi. 1280 px: tidak ada selisih terhadap ID. 390 px: (1) EN Invoice: tombol "Create Invoice" terpotong di tepi kanan dan tab "Partially paid" terpotong; (2) EN Profil Perusahaan: 3 deskripsi tambahan terpotong elipsis; (3) ZH: judul "应付借款"/"应收借款" terpotong elipsis di 390 px (1 elemen lebih banyak dari ID). Tidak ada tumpang tindih teks. Lihat F13. | Fail (F13) |

## C. Matriks modul §6 (pemindai DOM ZH dan EN)

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Matriks §6: Kerangka aplikasi: sidebar, header, pemilih bahasa, menu pengguna | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 7 layar / 1329 teks, EN 7 layar / 1329 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C02 | Matriks §6: Komponen katalog: Combobox, DatePicker, Dialog, FileUpload, Pagination | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 1 layar / 355 teks, EN 1 layar / 355 teks (pengecualian sah tercatat ZH 0, EN 0). Temuan non-pengecualian: F09 (Rendah). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C03 | Matriks §6: Dashboard | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 40 layar / 12446 teks, EN 40 layar / 12501 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C04 | Matriks §6: Klien | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 23 layar / 2211 teks, EN 23 layar / 2208 teks (pengecualian sah tercatat ZH 6, EN 0). Temuan non-pengecualian: F01 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C05 | Matriks §6: Layanan | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 39 layar / 3562 teks, EN 39 layar / 3499 teks (pengecualian sah tercatat ZH 0, EN 0). Temuan non-pengecualian: F03 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C06 | Matriks §6: Invoice & pembayaran | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 151 layar / 21311 teks, EN 154 layar / 21803 teks (pengecualian sah tercatat ZH 73, EN 0). Temuan non-pengecualian: F02 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C07 | Matriks §6: Invoice berulang | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 110 layar / 13974 teks, EN 101 layar / 12732 teks (pengecualian sah tercatat ZH 0, EN 0). Temuan non-pengecualian: F07 (Rendah), F08 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C08 | Matriks §6: Piutang | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 38 layar / 4528 teks, EN 38 layar / 4540 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C09 | Matriks §6: Laporan Laba Rugi | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 19 layar / 1922 teks, EN 20 layar / 2194 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C10 | Matriks §6: Kas & Bank | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 45 layar / 13504 teks, EN 47 layar / 14525 teks (pengecualian sah tercatat ZH 12, EN 0). Temuan non-pengecualian: F06 (Rendah), F07 (Rendah). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C11 | Matriks §6: Pemasukan & Pengeluaran | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 191 layar / 45871 teks, EN 192 layar / 45609 teks (pengecualian sah tercatat ZH 5, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C12 | Matriks §6: Kategori Transaksi | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 24 layar / 3068 teks, EN 25 layar / 3187 teks (pengecualian sah tercatat ZH 0, EN 0). Temuan non-pengecualian: F03 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C13 | Matriks §6: Reimbursement | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 119 layar / 15108 teks, EN 113 layar / 13972 teks (pengecualian sah tercatat ZH 1, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C14 | Matriks §6: Pengajuan Dana | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 91 layar / 11160 teks, EN 85 layar / 10710 teks (pengecualian sah tercatat ZH 0, EN 0). Temuan non-pengecualian: F03 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C15 | Matriks §6: Utang | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 26 layar / 2970 teks, EN 29 layar / 3473 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C16 | Matriks §6: Notifikasi | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 4 layar / 334 teks, EN 4 layar / 334 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C17 | Matriks §6: Masukan (Feedback) | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 27 layar / 2599 teks, EN 26 layar / 2506 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C18 | Matriks §6: Pengaturan: hub, Profil, Kata sandi | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 30 layar / 1701 teks, EN 30 layar / 1705 teks (pengecualian sah tercatat ZH 0, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C19 | Matriks §6: Pengaturan: Profil Perusahaan | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 7 layar / 600 teks, EN 7 layar / 603 teks (pengecualian sah tercatat ZH 6, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C20 | Matriks §6: Pengaturan: Penomoran Invoice | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 25 layar / 3139 teks, EN 25 layar / 3139 teks (pengecualian sah tercatat ZH 24, EN 24). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C21 | Matriks §6: Pengaturan: Template PDF & Builder | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 33 layar / 2501 teks, EN 33 layar / 2569 teks (pengecualian sah tercatat ZH 130, EN 0). Temuan non-pengecualian: F10 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C22 | Matriks §6: Koneksi Claude | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 9 layar / 771 teks, EN 9 layar / 771 teks (pengecualian sah tercatat ZH 36, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C23 | Matriks §6: Pengguna | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 17 layar / 1978 teks, EN 17 layar / 1973 teks (pengecualian sah tercatat ZH 3, EN 0). Temuan non-pengecualian: F03 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C24 | Matriks §6: Perusahaan (admin) | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 7 layar / 511 teks, EN 7 layar / 515 teks (pengecualian sah tercatat ZH 6, EN 0). Temuan non-pengecualian: F01 (Sedang), F03 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C25 | Matriks §6: Izin & Peran | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 15 layar / 4706 teks, EN 15 layar / 4710 teks (pengecualian sah tercatat ZH 1092, EN 0). Temuan non-pengecualian: F05 (Rendah), F12 (Rendah). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C26 | Matriks §6: Autentikasi & email | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 7 layar / 437 teks, EN 7 layar / 435 teks (pengecualian sah tercatat ZH 14, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C27 | Matriks §6: Setup & pemilihan perusahaan | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 2 layar / 124 teks, EN 2 layar / 124 teks (pengecualian sah tercatat ZH 4, EN 0). 0 temuan non-pengecualian; console tanpa "[i18n] belum diterjemahkan" untuk modul ini. | Pass |
| C28 | Matriks §6: Halaman error | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 3 layar / 37 teks, EN 3 layar / 37 teks (pengecualian sah tercatat ZH 0, EN 0). Temuan non-pengecualian: F04 (Sedang). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |
| C29 | Matriks §6: Panduan & video (di luar cakupan K3) | Kunjungi halaman indeks, tab, dialog/drawer/dropdown (klik semua tombol aman), picu validasi kosong pada dialog Tambah/Buat, di ZH dan EN; peran admin (semua halaman), finance manager, staf. | 0 teks non-pengecualian (Latin di ZH; teks Indonesia di EN); 0 "[i18n] belum diterjemahkan". | FE | Pindaian DOM: ZH 1 layar / 254 teks, EN 1 layar / 254 teks (pengecualian sah tercatat ZH 1, EN 0). Temuan non-pengecualian: F11 (Rendah). Rincian di pemindai-dom.md bagian Temuan. Gambar menunjukkan layar ZH dan EN. | Fail |

<!-- qa-evidence:start -->

# Bukti visual langkah per langkah

Screenshot diambil per langkah, bukan hanya hasil akhirnya, supaya alurnya
bisa ditelusuri ulang oleh orang lain. Test case yang kondisinya tidak bisa
dicapai dari layar dijalankan lewat API/DB dan ditandai eksplisit — tidak
dibuatkan screenshot seolah-olah ada alur UI-nya.


## N01 · Tampilan Indonesia (baseline sesudah perubahan) — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Dashboard (Ringkasan) bahasa Indonesia, pemilih ID. | <img src="../evidence/multi-bahasa-sesudah/N01-1.jpg" width="200"> |
| 2 | Arus Kas tab Semua, Indonesia. | <img src="../evidence/multi-bahasa-sesudah/N01-2.jpg" width="200"> |
| 3 | Dialog Catat Pemasukan, Indonesia. | <img src="../evidence/multi-bahasa-sesudah/N01-3.jpg" width="200"> |
| 4 | Daftar Invoice, Indonesia (status "Terbit" menggantikan "Terkirim"). | <img src="../evidence/multi-bahasa-sesudah/N01-4.jpg" width="200"> |

## N02 · Regresi tampilan Indonesia: sebelum vs sesudah — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Dashboard ID: kiri sebelum, kanan sesudah (pemilih bahasa kini berikon; badge Operasional; status "Terbit" menggantikan "Terkirim"; "Lewat jatuh tempo"). | <img src="../evidence/multi-bahasa-sesudah/N02-1.jpg" width="200"> |
| 2 | Arus Kas (Semua) ID: kiri sebelum, kanan sesudah; tata letak sama (data bertambah karena transaksi uji). | <img src="../evidence/multi-bahasa-sesudah/N02-2.jpg" width="200"> |
| 3 | Dialog Catat Pemasukan ID: kiri sebelum, kanan sesudah; "drag & drop" menjadi "seret & lepas"; selebihnya identik. | <img src="../evidence/multi-bahasa-sesudah/N02-3.jpg" width="200"> |
| 4 | Daftar Invoice ID: kiri sebelum, kanan sesudah; "Terkirim" menjadi "Terbit"; draft tanpa nomor menampilkan "belum bernomor". | <img src="../evidence/multi-bahasa-sesudah/N02-4.jpg" width="200"> |
| 5 | Login ID: kiri sebelum, kanan sesudah; tombol "Masuk ke Dasbor" menjadi "Masuk"; pemilih bahasa baru di pojok; panel pratinjau "Terkirim" menjadi "Terbit", "Lewat tempo" menjadi "Lewat jatuh tempo". | <img src="../evidence/multi-bahasa-sesudah/N02-5.jpg" width="200"> |

## A01 · Pilih EN: kini berfungsi — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Menu bahasa di header terbuka: Indonesia, English, 中文 (endonim) dengan ID terpilih. | <img src="../evidence/multi-bahasa-sesudah/A01-1.jpg" width="200"> |
| 2 | Setelah memilih EN: seluruh Dashboard berbahasa Inggris, pemilih menunjukkan EN. | <img src="../evidence/multi-bahasa-sesudah/A01-2.jpg" width="200"> |
| 3 | Dialog Record Income (EN) terisi: label, kotak Jurnal, tombol berbahasa Inggris. | <img src="../evidence/multi-bahasa-sesudah/A01-3.jpg" width="200"> |
| 4 | Toast sukses setelah menyimpan di sesi EN. | <img src="../evidence/multi-bahasa-sesudah/A01-4.jpg" width="200"> |
| 5 | Formulir kosong dikirim di sesi EN: pesan validasi server dan toast berbahasa Inggris. | <img src="../evidence/multi-bahasa-sesudah/A01-5.jpg" width="200"> |

## A02 · Pilih ZH: label, toast, dan validasi Mandarin — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Setelah memilih ZH: Dashboard seluruhnya Mandarin; pemilih menunjukkan ZH. | <img src="../evidence/multi-bahasa-sesudah/A02-1.jpg" width="200"> |
| 2 | Dialog 登记收入 (ZH) terisi: label, kotak Jurnal, dan tombol berbahasa Mandarin. | <img src="../evidence/multi-bahasa-sesudah/A02-2.jpg" width="200"> |
| 3 | Toast sukses setelah menyimpan di sesi ZH. | <img src="../evidence/multi-bahasa-sesudah/A02-3.jpg" width="200"> |
| 4 | Formulir kosong dikirim di sesi ZH: pesan validasi server dan toast berbahasa Mandarin. | <img src="../evidence/multi-bahasa-sesudah/A02-4.jpg" width="200"> |

## A03 · Preferensi bahasa bertahan lintas sesi — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Sesi ZH: menu pengguna dibuka, pilih Keluar (退出登录). | <img src="../evidence/multi-bahasa-sesudah/A03-1.jpg" width="200"> |
| 2 | Cookie dibersihkan (sesi baru), halaman login dibuka: tampilan mengikuti bahasa bawaan (belum ada identitas pengguna). | <img src="../evidence/multi-bahasa-sesudah/A03-2.jpg" width="200"> |
| 3 | Login ulang di sesi baru: bahasa ZH dipakai kembali (pemilih ZH, tampilan Mandarin) sesuai users.locale. | <img src="../evidence/multi-bahasa-sesudah/A03-3.jpg" width="200"> |

## A04 · PDF invoice di sesi ZH tetap Indonesia dengan huruf benar — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Sesi ZH: dialog 打印 (Cetak invoice) dalam bahasa Mandarin; dokumennya akan tetap Indonesia. | <img src="../evidence/multi-bahasa-sesudah/A04-1.jpg" width="200"> |
| 2 | Halaman 1 PDF invoice yang diunduh saat bahasa ZH: label dan terbilang Indonesia dengan huruf benar. | <img src="../evidence/multi-bahasa-sesudah/A04-2.jpg" width="200"> |

## A05 · DatePicker di sesi ZH dan EN — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | DatePicker pada dialog Catat Pemasukan di sesi ZH: judul bulan, kepala hari, dan aria-label. | <img src="../evidence/multi-bahasa-sesudah/A05-1.jpg" width="200"> |
| 2 | DatePicker pada dialog Catat Pemasukan di sesi EN: judul bulan, kepala hari, dan aria-label. | <img src="../evidence/multi-bahasa-sesudah/A05-2.jpg" width="200"> |

## A06 · Grafik Dashboard dan Kas & Bank di ZH dan EN — Terbukti sebagian

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Dashboard sesi ZH: sumbu grafik, keterangan periode, dan kalender. | <img src="../evidence/multi-bahasa-sesudah/A06-1.jpg" width="200"> |
| 2 | Kas & Bank sesi ZH, potongan grafik Pemasukan vs Pengeluaran. | <img src="../evidence/multi-bahasa-sesudah/A06-2.jpg" width="200"> |
| 3 | Dashboard sesi EN: sumbu grafik, keterangan periode, dan kalender. | <img src="../evidence/multi-bahasa-sesudah/A06-3.jpg" width="200"> |
| 4 | Kas & Bank sesi EN, potongan grafik Pemasukan vs Pengeluaran. | <img src="../evidence/multi-bahasa-sesudah/A06-4.jpg" width="200"> |

## A07 · Email lupa kata sandi dalam bahasa peminta — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Halaman lupa kata sandi, sesi ID. | <img src="../evidence/multi-bahasa-sesudah/A07-1.jpg" width="200"> |
| 2 | Setelah mengirim (ID): pesan konfirmasi berbahasa Indonesia di halaman. | <img src="../evidence/multi-bahasa-sesudah/A07-2.jpg" width="200"> |
| 3 | Halaman lupa kata sandi, sesi EN. | <img src="../evidence/multi-bahasa-sesudah/A07-3.jpg" width="200"> |
| 4 | Setelah mengirim (EN): pesan konfirmasi di halaman. | <img src="../evidence/multi-bahasa-sesudah/A07-4.jpg" width="200"> |
| 5 | Halaman lupa kata sandi, sesi ZH. | <img src="../evidence/multi-bahasa-sesudah/A07-5.jpg" width="200"> |
| 6 | Setelah mengirim (ZH): pesan konfirmasi di halaman. | <img src="../evidence/multi-bahasa-sesudah/A07-6.jpg" width="200"> |

## A08 · Pemilih bahasa di halaman login — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Halaman login (tamu, sesi baru): pemilih bahasa ID di pojok halaman. | <img src="../evidence/multi-bahasa-sesudah/A08-1.jpg" width="200"> |
| 2 | Menu pemilih bahasa di halaman login terbuka. | <img src="../evidence/multi-bahasa-sesudah/A08-2.jpg" width="200"> |
| 3 | Memilih EN sebagai tamu: halaman login berbahasa Inggris. | <img src="../evidence/multi-bahasa-sesudah/A08-3.jpg" width="200"> |
| 4 | Memilih ZH sebagai tamu: halaman login berbahasa Mandarin. | <img src="../evidence/multi-bahasa-sesudah/A08-4.jpg" width="200"> |
| 5 | Tamu memilih EN lalu login: dashboard langsung berbahasa Inggris dan users.locale tersimpan en. | <img src="../evidence/multi-bahasa-sesudah/A08-5.jpg" width="200"> |

## A09 · Tata letak EN dan ZH pada 1280 px dan 390 px — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | 390 px, Invoice: EN (kiri) tombol "Create Invoice" terpotong di tepi kanan dan tab "Partially paid" terpotong; ZH (kanan) muat. | <img src="../evidence/multi-bahasa-sesudah/A09-1.jpg" width="200"> |
| 2 | 390 px, Dashboard: EN (kiri) dan ZH (kanan) muat tanpa gulir horizontal; label sumbu grafik dipotong rapi (juga di ID). | <img src="../evidence/multi-bahasa-sesudah/A09-2.jpg" width="200"> |
| 3 | 390 px, Arus Kas: EN (kiri) dan ZH (kanan); tombol aksi turun baris, tidak ada tumpang tindih. | <img src="../evidence/multi-bahasa-sesudah/A09-3.jpg" width="200"> |
| 4 | 390 px, Profil Perusahaan: EN (kiri) deskripsi bagian terpotong elipsis; ZH (kanan) muat. | <img src="../evidence/multi-bahasa-sesudah/A09-4.jpg" width="200"> |
| 5 | 1280 px, Reimbursement: EN (kiri) dan ZH (kanan) tanpa pemotongan. | <img src="../evidence/multi-bahasa-sesudah/A09-5.jpg" width="200"> |

## C01 · Kerangka aplikasi: sidebar, header, pemilih bahasa, menu pengguna — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: sidebar semua grup dibuka, header, pemilih bahasa. | <img src="../evidence/multi-bahasa-sesudah/C01-1.jpg" width="200"> |
| 2 | EN: sidebar semua grup dibuka. | <img src="../evidence/multi-bahasa-sesudah/C01-2.jpg" width="200"> |
| 3 | ZH: menu pengguna (pengaturan, profil perusahaan, keluar). | <img src="../evidence/multi-bahasa-sesudah/C01-3.jpg" width="200"> |

## C02 · Komponen katalog: Combobox, DatePicker, Dialog, FileUpload, Pagination — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: dialog Catat Pemasukan (Combobox, DatePicker, FileUpload, kotak Jurnal). | <img src="../evidence/multi-bahasa-sesudah/C02-1.jpg" width="200"> |
| 2 | EN: dialog yang sama. | <img src="../evidence/multi-bahasa-sesudah/C02-2.jpg" width="200"> |
| 3 | ZH: validasi kosong pada dialog. | <img src="../evidence/multi-bahasa-sesudah/C02-3.jpg" width="200"> |

## C03 · Dashboard — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Dashboard. | <img src="../evidence/multi-bahasa-sesudah/C03-1.jpg" width="200"> |
| 2 | EN: Dashboard. | <img src="../evidence/multi-bahasa-sesudah/C03-2.jpg" width="200"> |

## C04 · Klien — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: daftar klien. | <img src="../evidence/multi-bahasa-sesudah/C04-1.jpg" width="200"> |
| 2 | ZH: dialog Tambah Klien. | <img src="../evidence/multi-bahasa-sesudah/C04-2.jpg" width="200"> |
| 3 | EN: dialog Add Client. | <img src="../evidence/multi-bahasa-sesudah/C04-3.jpg" width="200"> |

## C05 · Layanan — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: daftar layanan. | <img src="../evidence/multi-bahasa-sesudah/C05-1.jpg" width="200"> |
| 2 | ZH: validasi kosong Tambah Layanan. | <img src="../evidence/multi-bahasa-sesudah/C05-2.jpg" width="200"> |
| 3 | EN: validasi kosong Add Service. | <img src="../evidence/multi-bahasa-sesudah/C05-3.jpg" width="200"> |

## C06 · Invoice & pembayaran — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: daftar invoice (status Draft/Terbit/Sebagian/Lunas). | <img src="../evidence/multi-bahasa-sesudah/C06-1.jpg" width="200"> |
| 2 | EN: daftar invoice. | <img src="../evidence/multi-bahasa-sesudah/C06-2.jpg" width="200"> |
| 3 | ZH: editor invoice baru. | <img src="../evidence/multi-bahasa-sesudah/C06-3.jpg" width="200"> |
| 4 | ZH: drawer rincian invoice Sebagian dibayar (pembayaran, riwayat). | <img src="../evidence/multi-bahasa-sesudah/C06-4.jpg" width="200"> |

## C07 · Invoice berulang — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Invoice Berulang (Template). | <img src="../evidence/multi-bahasa-sesudah/C07-1.jpg" width="200"> |
| 2 | EN: Recurring Invoices. | <img src="../evidence/multi-bahasa-sesudah/C07-2.jpg" width="200"> |
| 3 | ZH: form template baru. | <img src="../evidence/multi-bahasa-sesudah/C07-3.jpg" width="200"> |

## C08 · Piutang — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: daftar piutang. | <img src="../evidence/multi-bahasa-sesudah/C08-1.jpg" width="200"> |
| 2 | EN: daftar piutang. | <img src="../evidence/multi-bahasa-sesudah/C08-2.jpg" width="200"> |
| 3 | ZH: validasi dialog Tambah Piutang. | <img src="../evidence/multi-bahasa-sesudah/C08-3.jpg" width="200"> |

## C09 · Laporan Laba Rugi — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Laba Rugi. | <img src="../evidence/multi-bahasa-sesudah/C09-1.jpg" width="200"> |
| 2 | EN: Profit & Loss. | <img src="../evidence/multi-bahasa-sesudah/C09-2.jpg" width="200"> |

## C10 · Kas & Bank — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Kas & Bank (grafik berlabel server). | <img src="../evidence/multi-bahasa-sesudah/C10-1.jpg" width="200"> |
| 2 | EN: Cash & Bank. | <img src="../evidence/multi-bahasa-sesudah/C10-2.jpg" width="200"> |

## C11 · Pemasukan & Pengeluaran — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Arus Kas tab Semua. | <img src="../evidence/multi-bahasa-sesudah/C11-1.jpg" width="200"> |
| 2 | EN: Cash Flow tab All. | <img src="../evidence/multi-bahasa-sesudah/C11-2.jpg" width="200"> |
| 3 | ZH: Transfer & Penyesuaian. | <img src="../evidence/multi-bahasa-sesudah/C11-3.jpg" width="200"> |

## C12 · Kategori Transaksi — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: kategori transaksi (nama kategori tetap Indonesia: data). | <img src="../evidence/multi-bahasa-sesudah/C12-1.jpg" width="200"> |
| 2 | EN: kategori transaksi. | <img src="../evidence/multi-bahasa-sesudah/C12-2.jpg" width="200"> |
| 3 | ZH: validasi dialog kategori. | <img src="../evidence/multi-bahasa-sesudah/C12-3.jpg" width="200"> |

## C13 · Reimbursement — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Reimbursement (halaman yang dikeluhkan pengguna). | <img src="../evidence/multi-bahasa-sesudah/C13-1.jpg" width="200"> |
| 2 | EN: Reimbursement. | <img src="../evidence/multi-bahasa-sesudah/C13-2.jpg" width="200"> |
| 3 | ZH: validasi dialog pengajuan. | <img src="../evidence/multi-bahasa-sesudah/C13-3.jpg" width="200"> |
| 4 | ZH: rincian reimbursement status Menunggu (tombol Tolak/Setujui), seluruh isi Mandarin. | <img src="../evidence/multi-bahasa-sesudah/C13-4.jpg" width="200"> |
| 5 | ZH: rincian reimbursement status Disetujui (tombol Bayar). | <img src="../evidence/multi-bahasa-sesudah/C13-5.jpg" width="200"> |

## C14 · Pengajuan Dana — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Pengajuan Dana (tiap status). | <img src="../evidence/multi-bahasa-sesudah/C14-1.jpg" width="200"> |
| 2 | EN: Fund Requests. | <img src="../evidence/multi-bahasa-sesudah/C14-2.jpg" width="200"> |
| 3 | ZH: form pengajuan baru. | <img src="../evidence/multi-bahasa-sesudah/C14-3.jpg" width="200"> |
| 4 | ZH: rincian pengajuan dana (status Disetujui, tombol Cairkan). | <img src="../evidence/multi-bahasa-sesudah/C14-4.jpg" width="200"> |

## C15 · Utang — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Utang. | <img src="../evidence/multi-bahasa-sesudah/C15-1.jpg" width="200"> |
| 2 | EN: Debts. | <img src="../evidence/multi-bahasa-sesudah/C15-2.jpg" width="200"> |
| 3 | ZH: validasi dialog Tambah Utang. | <img src="../evidence/multi-bahasa-sesudah/C15-3.jpg" width="200"> |

## C16 · Notifikasi — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: panel notifikasi (Masukan baru). | <img src="../evidence/multi-bahasa-sesudah/C16-1.jpg" width="200"> |
| 2 | EN: panel notifikasi. | <img src="../evidence/multi-bahasa-sesudah/C16-2.jpg" width="200"> |

## C17 · Masukan (Feedback) — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: daftar Masukan. | <img src="../evidence/multi-bahasa-sesudah/C17-1.jpg" width="200"> |
| 2 | EN: Feedback list. | <img src="../evidence/multi-bahasa-sesudah/C17-2.jpg" width="200"> |
| 3 | ZH: dialog Masukan melayang, validasi kosong. | <img src="../evidence/multi-bahasa-sesudah/C17-3.jpg" width="200"> |

## C18 · Pengaturan: hub, Profil, Kata sandi — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: hub Pengaturan. | <img src="../evidence/multi-bahasa-sesudah/C18-1.jpg" width="200"> |
| 2 | ZH: Profil. | <img src="../evidence/multi-bahasa-sesudah/C18-2.jpg" width="200"> |
| 3 | EN: Kata sandi. | <img src="../evidence/multi-bahasa-sesudah/C18-3.jpg" width="200"> |

## C19 · Pengaturan: Profil Perusahaan — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Profil Perusahaan. | <img src="../evidence/multi-bahasa-sesudah/C19-1.jpg" width="200"> |
| 2 | EN: Company Profile. | <img src="../evidence/multi-bahasa-sesudah/C19-2.jpg" width="200"> |

## C20 · Pengaturan: Penomoran Invoice — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Penomoran Invoice. | <img src="../evidence/multi-bahasa-sesudah/C20-1.jpg" width="200"> |
| 2 | EN: Invoice Numbering. | <img src="../evidence/multi-bahasa-sesudah/C20-2.jpg" width="200"> |

## C21 · Pengaturan: Template PDF & Builder — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: dialog Template baru. | <img src="../evidence/multi-bahasa-sesudah/C21-1.jpg" width="200"> |
| 2 | ZH: editor Template Builder (menu zh). | <img src="../evidence/multi-bahasa-sesudah/C21-2.jpg" width="200"> |
| 3 | EN: editor Template Builder. | <img src="../evidence/multi-bahasa-sesudah/C21-3.jpg" width="200"> |

## C22 · Koneksi Claude — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Koneksi Claude. | <img src="../evidence/multi-bahasa-sesudah/C22-1.jpg" width="200"> |
| 2 | EN: Claude Connection. | <img src="../evidence/multi-bahasa-sesudah/C22-2.jpg" width="200"> |

## C23 · Pengguna — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Pengguna. | <img src="../evidence/multi-bahasa-sesudah/C23-1.jpg" width="200"> |
| 2 | ZH: validasi dialog Tambah Pengguna. | <img src="../evidence/multi-bahasa-sesudah/C23-2.jpg" width="200"> |
| 3 | EN: Users. | <img src="../evidence/multi-bahasa-sesudah/C23-3.jpg" width="200"> |

## C24 · Perusahaan (admin) — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Perusahaan. | <img src="../evidence/multi-bahasa-sesudah/C24-1.jpg" width="200"> |
| 2 | ZH: dialog Perusahaan baru. | <img src="../evidence/multi-bahasa-sesudah/C24-2.jpg" width="200"> |
| 3 | EN: Companies. | <img src="../evidence/multi-bahasa-sesudah/C24-3.jpg" width="200"> |

## C25 · Izin & Peran — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: Izin & Peran (kode izin tampil sebagai kode kecil; judul grup Bank-accounts belum diterjemahkan). | <img src="../evidence/multi-bahasa-sesudah/C25-1.jpg" width="200"> |
| 2 | EN: Permissions & Roles. | <img src="../evidence/multi-bahasa-sesudah/C25-2.jpg" width="200"> |
| 3 | ZH: dialog Tambah Peran. | <img src="../evidence/multi-bahasa-sesudah/C25-3.jpg" width="200"> |

## C26 · Autentikasi & email — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: login. | <img src="../evidence/multi-bahasa-sesudah/C26-1.jpg" width="200"> |
| 2 | ZH: login dengan kredensial salah. | <img src="../evidence/multi-bahasa-sesudah/C26-2.jpg" width="200"> |
| 3 | ZH: lupa kata sandi, email tak valid. | <img src="../evidence/multi-bahasa-sesudah/C26-3.jpg" width="200"> |
| 4 | EN: atur ulang kata sandi, token palsu. | <img src="../evidence/multi-bahasa-sesudah/C26-4.jpg" width="200"> |

## C27 · Setup & pemilihan perusahaan — Pass

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: /choose-company dibuka oleh tamu: dialihkan ke login. | <img src="../evidence/multi-bahasa-sesudah/C27-1.jpg" width="200"> |
| 2 | EN: /setup dibuka oleh tamu: dialihkan ke login. | <img src="../evidence/multi-bahasa-sesudah/C27-2.jpg" width="200"> |

## C28 · Halaman error — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: halaman 403 (staf membuka /admin/users). | <img src="../evidence/multi-bahasa-sesudah/C28-1.jpg" width="200"> |
| 2 | ZH: halaman 404. | <img src="../evidence/multi-bahasa-sesudah/C28-2.jpg" width="200"> |
| 3 | EN: halaman 403. | <img src="../evidence/multi-bahasa-sesudah/C28-3.jpg" width="200"> |

## C29 · Panduan & video (di luar cakupan K3) — Fail

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | ZH: /panduan: isi tetap Indonesia sesuai keputusan K3. | <img src="../evidence/multi-bahasa-sesudah/C29-1.jpg" width="200"> |
| 2 | EN: /panduan. | <img src="../evidence/multi-bahasa-sesudah/C29-2.jpg" width="200"> |

<!-- qa-evidence:end -->
