# Multi bahasa yang benar-benar berfungsi: Indonesia · English · 中文

Fitur multi bahasa sudah lama tercantum di daftar fitur, tetapi **praktis tidak berfungsi sejak migrasi ke React**. QA
"sebelum" membuktikannya di lingkungan terisolasi:

| Gejala lama | Akibat |
|---|---|
| Pilihan **English** ditolak diam-diam | Memilihnya tidak mengubah apa pun |
| **中文** menghasilkan tampilan campur | Label Indonesia, toast Mandarin, pesan validasi justru Inggris |
| Pilihan bahasa tidak bertahan | Sesi baru kembali ke Indonesia |
| **PDF invoice** ikut bahasa staf yang mencetak | Di 中文 semua labelnya tercetak "??" |
| **Email reset kata sandi** | Selalu berbahasa Inggris, juga untuk pengguna Indonesia |

PR ini membuat ketiga bahasa bisa dipakai penuh. Syarat penerimaan dari pemilik:

> bila 中文 dipilih, **setiap menu, tab, dialog, dan keadaan** tampil Mandarin, tanpa sisa teks antarmuka Indonesia maupun
> Inggris; bila English dipilih, tanpa sisa Indonesia.

**QA "sesudah"** dengan pemindai DOM otomatis memeriksa 3 peran, 38 halaman, 1.083 layar/keadaan 中文 dan 1.109 English.
Hasilnya **0 teks antarmuka yang tertinggal** di luar pengecualian yang sah (lihat bawah).

## Keputusan pemilik yang membentuk PR ini

| # | Keputusan |
|---|---|
| K1 | Kunci terjemahan = **teks Indonesia persis** (`t('Simpan Pemasukan')`). Tampilan Indonesia tidak butuh kamus. Kunci tanpa terjemahan tampil Indonesia, bukan kunci mentah. |
| K2 | **PDF, Excel, isi template builder, dan terbilang selalu Bahasa Indonesia**, apa pun bahasa tampilan. |
| K3 | Cakupan: seluruh antarmuka + pesan server + email. Panduan/video dan **data** (termasuk nama kategori template & deskripsi otomatis transaksi) tetap Indonesia. |
| K4 | Tidak ada penutur Mandarin yang meninjau. Mitigasinya: glosarium 276 istilah + pemeriksaan silang terjemah-balik (0 salah makna). |
| K5–K6 | **Teks Indonesia dirapikan sekalian** (kata Inggris dan varian istilah → satu bentuk baku) sebelum kamus dibuat. |
| K7 | Syarat penerimaan di atas: tidak ada sisa teks di menu mana pun. |

---

## Sebelum → sesudah

Semua screenshot memakai **data contoh yang sama** (perusahaan QA "PT Bahasa QA" di lingkungan terisolasi `bhs`, 1280 px).
"Sebelum" diambil dari kode `main` (`629312c`) sebelum diubah. Pada "sebelum", gambar English identik dengan Indonesia
karena pilihan English ditolak.

### 1. Ringkasan dalam 中文

| Sebelum: memilih 中文 hampir tidak mengubah apa pun | Sesudah: seluruh antarmuka Mandarin (bulan grafik 6月…11月, satuan 百万, kalender 一…日, status invoice) |
|---|---|
| ![Sebelum: Ringkasan zh](screens/01-sebelum-zh-dashboard.webp) | ![Sesudah: Ringkasan zh](screens/01-sesudah-zh-dashboard.webp) |

### 2. Ringkasan dalam English

| Sebelum: English ditolak, tampilan tetap Indonesia | Sesudah: English penuh |
|---|---|
| ![Sebelum: Ringkasan en](screens/02-sebelum-en-dashboard.webp) | ![Sesudah: Ringkasan en](screens/02-sesudah-en-dashboard.webp) |

### 3. Dialog Catat Pemasukan dalam 中文

| Sebelum: label Indonesia, nama bulan Indonesia | Sesudah: dialog, DatePicker, dan validasi Mandarin |
|---|---|
| ![Sebelum: dialog zh](screens/03-sebelum-zh-dialog-pemasukan.webp) | ![Sesudah: dialog zh](screens/03-sesudah-zh-dialog-pemasukan.webp) |

### 4. Dialog Catat Pemasukan dalam English

| Sebelum | Sesudah |
|---|---|
| ![Sebelum: dialog en](screens/04-sebelum-en-dialog-pemasukan.webp) | ![Sesudah: dialog en](screens/04-sesudah-en-dialog-pemasukan.webp) |

### 5. Arus Kas dalam 中文

| Sebelum | Sesudah: kolom, filter, lencana Pendanaan, dan arah uang (流入/流出) Mandarin; data tetap apa adanya |
|---|---|
| ![Sebelum: arus kas zh](screens/05-sebelum-zh-aruskas.webp) | ![Sesudah: arus kas zh](screens/05-sesudah-zh-aruskas.webp) |

### 6. Daftar Invoice dalam 中文

| Sebelum | Sesudah: status 已开具 / 部分付款 / 已付款, kartu ringkasan, dan tab Mandarin |
|---|---|
| ![Sebelum: invoice zh](screens/06-sebelum-zh-invoice.webp) | ![Sesudah: invoice zh](screens/06-sesudah-zh-invoice.webp) |

### 7. Halaman masuk

| Sebelum: tidak ada pemilih bahasa untuk tamu | Sesudah: pemilih bahasa di halaman tamu; pilihan tamu terbawa ke akun saat masuk |
|---|---|
| ![Sebelum: login](screens/07-sebelum-zh-login.webp) | ![Sesudah: login zh](screens/07-sesudah-zh-login.webp) |

### 8. PDF invoice yang dicetak dari sesi 中文

| Sebelum: label tercetak "??" (font PDF tanpa huruf Mandarin), terbilang Indonesia, jadi dokumen untuk klien rusak | Sesudah: **selalu Bahasa Indonesia** dengan huruf benar, apa pun bahasa tampilan (K2) |
|---|---|
| ![Sebelum: PDF zh](screens/08-sebelum-zh-pdf-invoice.webp) | ![Sesudah: PDF zh](screens/08-sesudah-zh-pdf-invoice.webp) |

### 9. Tampilan Indonesia: tidak berubah selain perapian yang disengaja

| Sebelum | Sesudah: sama, selain istilah yang dirapikan (mis. Terkirim → Terbit) dan pemilih bahasa berikon |
|---|---|
| ![Sebelum: ringkasan id](screens/09-sebelum-id-dashboard.webp) | ![Sesudah: ringkasan id](screens/09-sesudah-id-dashboard.webp) |

### 10–14. Layar lain sesudah perubahan

| Reimbursement 中文 (halaman yang dulu dikeluhkan masih campur) | Reimbursement English |
|---|---|
| ![Reimbursement zh](screens/10-sesudah-zh-reimbursement.webp) | ![Reimbursement en](screens/11-sesudah-en-reimbursement.webp) |

| Izin & Peran 中文: kode izin kini berlabel | Kas & Bank 中文 | Invoice Berulang 中文 |
|---|---|---|
| ![Izin zh](screens/12-sesudah-zh-izin.webp) | ![Kas & Bank zh](screens/13-sesudah-zh-kasbank.webp) | ![Invoice Berulang zh](screens/14-sesudah-zh-berulang.webp) |

---

## Cara kerjanya

- **Satu penentu bahasa** (`SetLocale`): pilihan akun → sesi → Indonesia.
  - English kini tersedia.
  - Pilihan tamu di halaman masuk terbawa ke akun.
  - Ganti bahasa memuat ulang halaman penuh; versi Inertia ikut bahasa, jadi masuk/keluar lintas bahasa juga memuat ulang.
  - Bahasa bawaan dipatok `id` di `config/app.php`, karena `.env` lama berisi `APP_LOCALE=en`.
  - Blok locale ganda di `AppServiceProvider` (`auth()->check()` setiap request) dihapus.
- **Antarmuka React:**
  - Teks dibungkus i18next dengan **kunci = teks Indonesia** (`t()`, `tk()` untuk peta label, konteks untuk kata bermakna ganda, `<Trans>` untuk kalimat berformat, jamak lewat `count`).
  - Kamus `resources/js/locales/{en,zh}.json` (±2.190 kunci) dimuat sebelum render pertama.
  - Tanggal lewat helper sadar bahasa (id/enGB/zhCN); Rupiah tetap `Rp 1.500.000`.
- **Server:**
  - ±410 teks tampil (flash, validasi + 90 nama field, error, notifikasi baru) lewat `__()` + `lang/{en,zh}.json`.
  - Validasi `lang/zh` kini Mandarin sungguhan.
  - Email bawaan Laravel diterjemahkan ke Indonesia (`lang/id.json`) dan Mandarin.
- **Yang sengaja TIDAK diterjemahkan:**
  - Teks yang **disimpan** atau dikirim ke sistem lain: deskripsi otomatis transaksi (dibaca balik oleh regex tautan modul), notifikasi lama, laporan ke Watchpost, dan jawaban alat **Koneksi Claude (MCP)**. Rute MCP dikunci Indonesia.
  - Notifikasi baru menyimpan teks Indonesia + kunci & parameter, lalu tampil dalam bahasa **pembaca**.
- **Dokumen:** middleware `locale.dokumen` di 16 rute PDF/Excel + helper `withDocumentLocale` untuk kanvas template builder.
- **Penjaga di CI:**
  - `npm run i18n:check` gagal bila ada teks antarmuka tanpa terjemahan, kunci en/zh hilang, atau placeholder/tag tidak cocok. Pemindai ini dikunci dengan tes fixture yang sengaja salah.
  - Tes PHP menolak literal tampil tanpa `__()`.
  - Tes PHP lain menolak nama rute/kode status yang dibungkus `__()`; kesalahan itu sempat terjadi dan tertangkap sebelum rilis.

## Perapian teks Indonesia (K5)

288 pasangan teks, 415 kemunculan, mengikuti [`docs/i18n/perapian-id.md`](../../i18n/perapian-id.md). Yang paling terlihat:

| Sebelum | Sesudah |
|---|---|
| Permintaan Dana | **Pengajuan Dana** |
| Feedback | **Masukan** |
| Kirim invoice / Terkirim | **Terbitkan / Terbit** |
| Edit | **Ubah** |
| Pending Review, Disbursed, Low…Urgent | **Menunggu persetujuan, Dicairkan, Rendah…Mendesak** |
| Permission | **Izin** |
| Total Debit | **Total Keluar** |
| Reset | **Hapus filter** |
| Invoice Recurring | **Invoice Berulang** |
| Masuk ke Dasbor | **Masuk** |

Halaman Izin & Peran kini menampilkan 78 kode izin dengan label baku, misalnya "Lihat invoice". Teks panduan, langkah
video, skrip capture, dan dokumen modul diselaraskan. **Screenshot panduan diambil ulang di PR terpisah.**

## Bug yang ikut tertutup

- PDF invoice di sesi 中文 tercetak "??".
- Email reset kata sandi & verifikasi selalu Inggris.
- Validasi 中文 berbahasa Inggris; nama field mentah ("Type wajib diisi.") bahkan di Indonesia.
- Seluruh berkas editor Template PDF rusak encoding (mojibake ─ — … → tampil di layar) — dipulihkan.
- Stempel waktu Laba Rugi bertuliskan "WIB" padahal zona aplikasi WITA — kini dari zona aplikasi (layar & PDF).
- Pilihan bahasa tidak bertahan di sesi baru; English mati; halaman masuk tanpa pemilih bahasa.

## Pengujian

- **PHPUnit:** suite lengkap **1.036 lulus, 0 gagal, 2 dilewati** (5.301 asersi).
  Tes baru:
  - `MultiBahasaTest` (resolusi bahasa, ganti bahasa, rute dokumen & MCP);
  - `TeksServerLokaleTest` (flash/validasi per bahasa, notifikasi, deskripsi tersimpan tetap Indonesia + tautan modul);
  - `NamaAtributValidasiTest`;
  - `TeksServerMultiBahasaTest` (pemindai server + paritas kamus);
  - `KunciTerjemahanBukanKodeTest`;
  - `PemindaiI18nTest`.
- **Frontend:** `npm run types` bersih; `npm run i18n:check` = 0 galat.
- **QA berbukti** di [`docs/qa/2026-11-10-multi-bahasa/`](../../qa/2026-11-10-multi-bahasa/):
  - **Gelombang 1 "sebelum":** 9 dugaan dari pembacaan kode — 8 terbukti, 1 sebagian.
  - **Gelombang 5 "sesudah":** 13 temuan F01–F13 lalu diperbaiki.
  - **Gelombang 5b:** **54/54 case lulus**, pemindaian DOM 0 sisa di 中文 & English, 0 gulir horizontal di 1280/390 px.
- **Kualitas Mandarin:**
  - Glosarium ([`docs/i18n/glosarium.md`](../../i18n/glosarium.md), v1.3).
  - Pemeriksaan silang terjemah-balik ([`docs/i18n/pemeriksaan-silang-zh.md`](../../i18n/pemeriksaan-silang-zh.md)): 200 sampel acak + 258 entri istilah berisiko, **0 salah makna**.
  - Pembayaran invoice dibaca sebagai uang masuk (收款).

## Pengecualian yang sah (tetap tidak diterjemahkan)

- Data buatan pengguna/perusahaan dan data bawaan sistem: nama kategori template, deskripsi otomatis transaksi.
- Merek & nama diri (Kisantra, Claude, nama bank), akronim pajak (PPN, PPh, NPWP, PKP, DPP), `Rp`/angka, dan kode/nomor dokumen/token format.
- Label aplikasi lain yang dikutip persis (menu Claude "Settings › Connectors").
- Isi dokumen PDF/Excel (K2), serta isi panduan & video tutorial (K3).
- Label bawaan kontrol pemutar video Remotion ("Pause video", dst.). Labelnya tertulis keras di pustaka, dan mengubahnya berarti membangun kontrol pemutar sendiri.
- **Terjemahan Mandarin belum ditinjau penutur asli.** Kealamian gaya dan konvensi RRT/Taiwan sebaiknya dicek bila ada pengguna Tionghoa nyata.

## Catatan untuk deploy & tindak lanjut

- **Tidak ada migrasi baru.** Deploy biasa dengan `./deploy.sh` (termasuk `npm run build`).
- `APP_LOCALE`/`APP_FALLBACK_LOCALE` di `.env` server kini diabaikan; bahasa bawaan selalu Indonesia.
- **Tindak lanjut (PR terpisah):**
  - ambil ulang screenshot panduan;
  - kontrol pemutar video berbahasa bila diinginkan;
  - teks MCP & PDF/Excel yang masih memakai istilah lama (T-8);
  - rujukan peraturan di catatan PDF invoice (PP 23/2018) berbeda dengan rekap (PP 55/2022) — perlu dicek pemilik;
  - ikon "?" di judul kotak "INFORMASI PELUNASAN" PDF (sudah ada sebelum PR ini).
