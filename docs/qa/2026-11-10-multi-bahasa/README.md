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
