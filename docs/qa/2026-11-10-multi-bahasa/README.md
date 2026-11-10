# QA 10 November 2026 — Multi bahasa (ID · EN · ZH), keadaan SEBELUM perubahan

Pengujian berbasis bukti untuk perilaku pemilih bahasa di kode saat ini (cabang `fitur/multi-bahasa`, commit `629312c`, belum ada
perubahan multi bahasa). Tujuannya membuktikan atau membantah dugaan dari pembacaan kode (rencana multi bahasa §1–§2) sebelum
pekerjaan dimulai. Cara membaca tabel, kolom **Lapisan**, dan kewajiban bukti mengikuti [`docs/qa/README.md`](../README.md).

| Berkas | Isi |
|---|---|
| [`test-cases/multi-bahasa-sebelum.md`](test-cases/multi-bahasa-sebelum.md) | 10 case (N01 + A01–A09): langkah, dugaan, hasil teramati, status, bukti layar per langkah |
| [`manifests/multi-bahasa-sebelum.json`](manifests/multi-bahasa-sebelum.json) | Sumber data case & bukti (skrip skill `qa-evidence`) |
| `evidence/multi-bahasa/` | 32 tangkapan layar per langkah, dikecilkan ke lebar ≤ 420 px (JPEG) |

## Ringkasan hasil

| Case | Dugaan | Status | Bukti ringkas |
|---|---|---|---|
| N01 | Tampilan ID normal | Pass | 4 layar berbahasa Indonesia |
| A01 | EN: tidak ada yang berubah | **Terbukti** | `POST /language` 302, tombol tetap ID, `users.locale` tetap `id` |
| A02 | ZH: label Indonesia; toast Mandarin; validasi Inggris | **Terbukti sebagian** | Label Indonesia dan validasi Inggris terbukti; toast **terbantah** (Indonesia, ditulis di klien) |
| A03 | Sesi baru kembali ke ID | **Terbukti** | `users.locale` = `zh` sepanjang alur, tetapi setelah login ulang tampil ID |
| A04 | PDF ZH berlabel "?" | **Terbukti** | Label Mandarin tercetak "??", terbilang Indonesia |
| A05 | DatePicker Indonesia di ZH | **Terbukti** | "November 2026", Sen Sel Rab …; aria Inggris bawaan pustaka |
| A06 | Label bulan server sudah Mandarin | **Terbukti (campur)** | "6月…11月", "1–10 11月" bercampur dengan "1 Jun – 30 Nov" |
| A07 | Email berbahasa Inggris | **Terbukti** | 3 email (sesi ID dan ZH) berisi Inggris |
| A08 | (tambahan) login tanpa pemilih bahasa | Terbukti | 0 tombol pemilih; EN/ZH tamu tidak mengubah tampilan |
| A09 | (tambahan) pindai teks DOM ZH | Terbukti | Dashboard 15 dari 214 baris Mandarin (hanya label bulan server); Arus Kas, Invoice, Login 0 |

## Lingkungan uji (terisolasi, bukan production)

| Aspek | Nilai |
|---|---|
| Berkas konfigurasi | `.env.bhs` = salinan `.env` + penimpaan: `APP_ENV=bhs`, `APP_URL=http://127.0.0.1:8149`, `DB_DATABASE=bhs_central`, `TENANCY_DB_PREFIX=bhs_central_tenant_`, `LEGACY_DB_DATABASE` kosong, sesi & cache `database` (cookie `bhs_session`, `CACHE_PREFIX=bhs_`), antrean `sync`, `MAIL_MAILER=log`, `LOG_CHANNEL=daily`, `MAIL_LOG_CHANNEL=daily`, `BROADCAST_CONNECTION=log`, `GEMINI_API_KEY` dan kunci AWS dikosongkan. `.env` tidak disentuh. Tidak diikutkan ke git (`.env.*` diabaikan) |
| URL | `http://127.0.0.1:8149` — `php artisan serve --env=bhs --host=127.0.0.1 --port=8149 --no-reload` |
| Database | `bhs_central` (migrate + `MasterPermissionSeeder` + `central:bootstrap`) dan `bhs_central_tenant_bahasaqa` (perusahaan "PT Bahasa QA", slug `bahasaqa`, singkatan BQA). MySQL 8.0.45, PHP 8.5.4 |
| Aset frontend | Vite dev server milik pengembang di `[::1]:5173` (tidak dimatikan atau diubah) |
| Browser | Chromium headless 145 lewat Python Playwright 1.58, viewport 1280×900 DPR 1. PDF dirender dengan PyMuPDF 1.27 |
| Log | Aplikasi menulis ke `storage/logs/laravel-2026-11-10.log` (saluran `daily`), terpisah dari `laravel.log` milik pengembang. Email (`MAIL_MAILER=log`) dibaca dari berkas itu |
| Basis data lain | Tidak disentuh; semua database yang dibuat berawalan `bhs_` |

**Bukti isolasi.** Skrip penyiapan menolak berjalan bila database pusat bukan `bhs_central` atau prefiks tenant bukan
`bhs_central_tenant_`; server `--env=bhs` memakai cookie `bhs_session`.

### Penyiapan (reproduksi)

1. `CREATE DATABASE bhs_central`; `php artisan migrate --env=bhs --force`; `php artisan db:seed --class=MasterPermissionSeeder --env=bhs --force`; `php artisan permission:cache-reset --env=bhs`.
2. `php artisan central:bootstrap --env=bhs --no-interaction --organization="Grup QA Bahasa" --quota=5 --name="Admin Bahasa" --email=admin@bhs.test --password=<rahasia> --company="PT Bahasa QA" --slug=bahasaqa --abbreviation=BQA` (provisioning memberi kategori template + Pendanaan, 86 kategori).
3. Skrip PHP di luar repo (dijalankan lewat `php artisan tinker --env=bhs`): akun finance manager dan staf, profil PKP 11 %, rekening BCA Operasional / Mandiri Cadangan / Kas Kecil, klien PT Maju Jaya dan CV Sinar Abadi, 3 invoice terbit bernomor (dengan PPN dan titipan pajak) + 3 pembayaran, 17 transaksi (termasuk transfer, utang, dan piutang).
4. `php artisan serve --env=bhs --host=127.0.0.1 --port=8149 --no-reload`.
5. Playwright headless: login `fm@bhs.test`, lalu ikuti langkah tiap case di `test-cases/multi-bahasa-sebelum.md`. Pemilih bahasa ada di header (tombol ID/EN/ZH → `POST /language`).

### Akun uji (lokal, hanya di `bhs_central`)

Satu kata sandi acak untuk semua akun QA, disimpan di luar repo (tidak dicantumkan di sini).

| Email | Peran | Dipakai di |
|---|---|---|
| `fm@bhs.test` (Rina Keuangan) | finance manager (`bahasaqa`) | semua case UI |
| `budi@bhs.test` (Budi Kasir) | staff (`bahasaqa`) | A07 (email, sesi ZH) |
| `admin@bhs.test` | admin | A07 (email tambahan, sesi ID) dan penyiapan |

## Catatan lingkungan

- Lingkungan **sengaja tidak dibongkar** (database dan `.env.bhs` dibiarkan) agar QA "sesudah" memakai data yang sama. Server dan browser ditutup di akhir QA; cadangan `mysqldump` ada di luar repo.
- Tidak ada perubahan pada kode aplikasi; PHPUnit tidak dijalankan.
- Baris log berlabel `bhs.` yang ditulis ke `storage/logs/browser.log` (log browser Boost, bersama) dicatat dan dibersihkan setelah QA.

## Screenshot untuk dokumen PR

Versi 1280 px (ID/EN/ZH × Dashboard, Arus Kas, dialog Catat Pemasukan, Invoice, Login, serta PDF invoice ZH dan ID) disimpan di luar repo
(scratchpad `bhs/pr-sebelum/`) dan dipindahkan ke `docs/pr/<tanggal>-multi-bahasa/` oleh orkestrator.

---

# Gelombang 5: QA "sesudah" (10 November 2026)

Setelah seluruh pekerjaan multi bahasa di-commit (cabang `fitur/multi-bahasa`, `b516112`), lingkungan `bhs` yang sama dipakai lagi.

| Berkas | Isi |
|---|---|
| [`test-cases/multi-bahasa-sesudah.md`](test-cases/multi-bahasa-sesudah.md) | 54 case (putaran 1 dan 2): N01–N02 (ID), A01–A09 (dugaan lama dibalik + tata letak), C01–C29 (matriks modul §6 dengan pemindai DOM) |
| [`pemindai-dom.md`](pemindai-dom.md) | Tabel per layar, daftar pengecualian sah, daftar temuan F01–F13 dengan lokasi dan dugaan berkas sumber |
| [`manifests/multi-bahasa-sesudah.json`](manifests/multi-bahasa-sesudah.json) | Sumber data case dan bukti |
| `evidence/multi-bahasa-sesudah/` | Tangkapan layar per langkah (420 px; perbandingan N02 dan tata letak A09 lebih lebar) |

## Skor per kriteria

| Kriteria | Hasil |
|---|---|
| K7 ZH: 0 sisa teks non-pengecualian | **Belum**: 12 temuan unik (F01–F12) di 1.111 layar/keadaan |
| K7 EN: 0 sisa Indonesia | **Belum**: 8 temuan unik (F01, F02, F05–F10), sebagian besar bukan kata Indonesia murni (F05–F08 adalah slug/satuan/bulan tetap) |
| Pemilih bahasa, persistensi, halaman login (A01, A02, A03, A08) | 4 dari 4 lulus |
| Dokumen tetap Indonesia dengan huruf benar (A04) | Lulus |
| DatePicker (A05) | Lulus |
| Grafik (A06) | Sebagian: sumbu X ikut bahasa; sumbu Y Kas & Bank memakai "jt" (F06), label aksesibilitas Inggris (F07) |
| Email reset kata sandi id/en/zh (A07) | Lulus |
| Tata letak (A09) | 1280 px tanpa selisih; 390 px: 1 temuan (F13, EN) |
| Regresi tampilan Indonesia (N01, N02) | Lulus; perbedaan hanya perapian yang disengaja |
| Matriks §6 (C01–C29) | 15 lulus, 14 gagal karena F01–F12 (tidak ada yang rusak total) |
| Console `[i18n] belum diterjemahkan` | 2 kunci: "Alamat", "Generik" |
| Halaman Reimbursement (keluhan pengguna) | Bersih di ZH dan EN: daftar, form, drawer rincian tiap status, dialog tinjau/bayar |

## Lingkungan tambahan

- Akun tambahan di `bhs_central` (kata sandi acak yang sama, di luar repo): `qa1`–`qa3@bhs.test` (finance manager), `qa4@bhs.test` (admin), dipakai agar proses paralel tidak berebut `users.locale`.
- Data tambahan lewat skrip yang menolak berjalan di luar `bhs_central`: layanan, invoice draft dan jatuh tempo lewat, reimbursement dan pengajuan dana tiap status, utang/piutang lunas, template berulang, tiga Masukan, notifikasi. Dua template PDF dan beberapa transaksi uji dibuat oleh crawler.
- Skrip (di luar repo, `...\scratchpadhs\`): `crawl.py`, `rows2.py`, `special.py`, `pdfbuilder.py`, `layout.py`, `rawscan.py`, `after1.py`, `after2.py`, `final_report.py`.
- Screenshot 1280 px untuk dokumen PR: `...\scratchpadhs\pr-sesudah\` (`{id,en,zh}-{dashboard,aruskas,dialog-pemasukan,invoice,login,reimbursement}.png` dan `{id,en,zh}-pdf-invoice.png`).

---

# Gelombang 5b: uji ulang setelah perbaikan (putaran 2, commit `1e7de08`)

Temuan F01–F13 diperbaiki; seluruh pemindaian dijalankan ulang dengan skrip yang sama pada lingkungan `bhs` yang sama, ditambah verifikasi tiap temuan di layar asalnya (case A10–A22, masing-masing dengan screenshot sebelum bila tersedia) dan regresi cepat ID (N03).

| Kriteria | Putaran 1 | Putaran 2 |
|---|---|---|
| K7 ZH, temuan non-pengecualian | 12 unik | **0** (1.083 layar/keadaan) |
| K7 EN, temuan non-pengecualian | 8 unik | **0** (1.109 layar/keadaan) |
| Tata letak EN 390 px (F13) | 1 temuan | 0; gulir horizontal 0 di semua kombinasi; 1280 px sama |
| Console `[i18n] belum diterjemahkan` | 2 kunci | 0 |
| Case lulus | 24 dari 40 | **54 dari 54** (29 lulus pada percobaan ke-2) |
| Status F01–F13 | terbuka | 13 dari 13 diperbaiki dan terverifikasi |
| Temuan baru | | tidak ada |

Pengecualian baru: kontrol pemutar Remotion ("Pause video", "Mute sound", "Enter Fullscreen", tertulis keras di pustaka) dan teks di dalam bingkai video Tutorial (isi video, K3). Daftar pengecualian final ada di [`pemindai-dom.md`](pemindai-dom.md).

Regresi ID: validasi Tambah Layanan kini "Jenis wajib diisi." (sebelumnya "Type wajib diisi."); layar ID lain tidak bergeser.

Screenshot PR terbaru (1280 px, ID/EN/ZH × dashboard, aruskas, dialog-pemasukan, invoice, reimbursement, izin, kasbank, berulang, login, pdf-invoice): `...\scratchpadhs\pr-sesudah\`. Skrip tambahan (di luar repo): `verify.py`, `prshots2.py`, `gen_docs3.py`.
