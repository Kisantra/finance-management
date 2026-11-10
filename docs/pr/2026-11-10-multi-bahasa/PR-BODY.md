Fitur multi bahasa kini **benar-benar berfungsi untuk Indonesia, English, dan 中文**. Sebelumnya fitur ini praktis mati sejak migrasi React:
- English ditolak diam-diam;
- 中文 campur, dengan validasi justru Inggris;
- pilihan bahasa tidak bertahan di sesi baru;
- PDF invoice dari sesi 中文 tercetak "??";
- email reset kata sandi selalu Inggris.

Syarat penerimaan pemilik: **di setiap menu, tab, dialog, dan keadaan, bila 中文 dipilih semua komponen tampil Mandarin, dan bila English dipilih tanpa sisa Indonesia.** QA "sesudah" dengan pemindai DOM (3 peran, 38 halaman, 1.083 layar 中文 + 1.109 English) menemukan **0 sisa teks antarmuka**, dan **54/54 case lulus**.

Ringkasan lengkap + semua screenshot: [`docs/pr/2026-11-10-multi-bahasa/README.md`](docs/pr/2026-11-10-multi-bahasa/README.md). QA berbukti: [`docs/qa/2026-11-10-multi-bahasa/`](docs/qa/2026-11-10-multi-bahasa/). Glosarium & pemeriksaan silang Mandarin: [`docs/i18n/`](docs/i18n/).

---

## Sebelum → sesudah

Data contoh yang sama (perusahaan QA di lingkungan terisolasi, 1280 px). "Sebelum" diambil dari `main` (`629312c`) sebelum kode diubah.

### Ringkasan dalam 中文

| Sebelum | Sesudah |
|---|---|
| ![Sebelum](docs/pr/2026-11-10-multi-bahasa/screens/01-sebelum-zh-dashboard.webp) | ![Sesudah](docs/pr/2026-11-10-multi-bahasa/screens/01-sesudah-zh-dashboard.webp) |

### Ringkasan dalam English (sebelumnya pilihan English ditolak)

| Sebelum | Sesudah |
|---|---|
| ![Sebelum](docs/pr/2026-11-10-multi-bahasa/screens/02-sebelum-en-dashboard.webp) | ![Sesudah](docs/pr/2026-11-10-multi-bahasa/screens/02-sesudah-en-dashboard.webp) |

### Dialog Catat Pemasukan dalam 中文

| Sebelum | Sesudah |
|---|---|
| ![Sebelum](docs/pr/2026-11-10-multi-bahasa/screens/03-sebelum-zh-dialog-pemasukan.webp) | ![Sesudah](docs/pr/2026-11-10-multi-bahasa/screens/03-sesudah-zh-dialog-pemasukan.webp) |

### PDF invoice dari sesi 中文: kini selalu Bahasa Indonesia dengan huruf benar

| Sebelum: "??" | Sesudah |
|---|---|
| ![Sebelum](docs/pr/2026-11-10-multi-bahasa/screens/08-sebelum-zh-pdf-invoice.webp) | ![Sesudah](docs/pr/2026-11-10-multi-bahasa/screens/08-sesudah-zh-pdf-invoice.webp) |

### Halaman masuk: pemilih bahasa untuk tamu

| Sebelum | Sesudah |
|---|---|
| ![Sebelum](docs/pr/2026-11-10-multi-bahasa/screens/07-sebelum-zh-login.webp) | ![Sesudah](docs/pr/2026-11-10-multi-bahasa/screens/07-sesudah-zh-login.webp) |

### Reimbursement dalam 中文 (halaman yang dulu masih campur)

![Sesudah](docs/pr/2026-11-10-multi-bahasa/screens/10-sesudah-zh-reimbursement.webp)

Arus Kas, Invoice, Izin & Peran, Kas & Bank, Invoice Berulang, dan regresi tampilan Indonesia ada di README.

---

## Yang berubah

- **Penentu bahasa tunggal:**
  - urutan: akun → sesi → Indonesia;
  - English aktif;
  - pilihan tamu di halaman masuk terbawa ke akun;
  - ganti bahasa memuat ulang penuh;
  - bawaan dipatok `id` di config, sehingga `APP_LOCALE=en` di `.env` diabaikan.
- **React:** i18next dengan **kunci = teks Indonesia persis** (keputusan pemilik). Kamus en/zh berisi ±2.190 kunci. Tanggal & DatePicker sadar bahasa. Rupiah tetap `Rp 1.500.000`.
- **Server:**
  - ±410 teks (flash, validasi + 90 nama field, error, notifikasi baru dalam bahasa pembaca) lewat `__()`;
  - validasi `lang/zh` kini Mandarin;
  - email bawaan Laravel diterjemahkan.
- **Tetap Indonesia dengan sengaja:**
  - PDF/Excel/kanvas template builder (16 rute + helper);
  - teks yang **disimpan** (deskripsi otomatis transaksi yang dibaca balik regex tautan modul);
  - jawaban alat **Koneksi Claude (MCP)**;
  - data & nama kategori;
  - isi panduan/video.
- **Perapian teks Indonesia** (288 pasangan): Pengajuan Dana, Masukan, Terbitkan/Terbit, Ubah, Menunggu persetujuan, Izin, Total Keluar, Hapus filter, Invoice Berulang, "Masuk". Panduan, skrip capture, dan dokumen modul diselaraskan; screenshot panduan diambil ulang di PR terpisah.
- **Ikut tertutup:**
  - editor Template PDF yang seluruh berkasnya rusak encoding;
  - "WIB" → zona aplikasi (WITA) di Laba Rugi;
  - "Type wajib diisi." → "Jenis wajib diisi.".
- **Penjaga CI:**
  - `npm run i18n:check` (teks tanpa terjemahan / kunci hilang / placeholder tidak cocok, dikunci tes fixture);
  - tes PHP untuk literal tanpa `__()`;
  - tes PHP untuk nama rute/kode status yang keliru diterjemahkan.

## Pengujian

- **PHPUnit:** suite lengkap **1.036 lulus, 0 gagal, 2 dilewati** (5.301 asersi).
- **Frontend:** `npm run types` bersih; `npm run i18n:check` 0 galat.
- **QA berbukti, tiga gelombang:**
  - gelombang 1 membuktikan bug lama;
  - gelombang 5 menemukan 13 sisa;
  - gelombang 5b: 54/54 lulus dan 0 sisa teks di 中文 & English.
- **Mandarin:** glosarium 276 istilah + pemeriksaan silang terjemah-balik (0 salah makna). **Belum ditinjau penutur asli.**

## Catatan deploy

Tidak ada migrasi baru; deploy biasa dengan `./deploy.sh`. `APP_LOCALE` di `.env` server tidak lagi berpengaruh.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
