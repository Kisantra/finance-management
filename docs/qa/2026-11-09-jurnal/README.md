# QA 9 November 2026 — Jurnal tampilan (Cara A)

Pengujian berbasis bukti untuk kotak **Jurnal**: akun yang didebit dan dikredit, diturunkan dari rekening + kategori +
arah + jumlah (dan untuk pembayaran invoice dari titipan pajak & PPN invoicenya), tampil saat mencatat (pratinjau),
melihat, dan mengubah. Tidak ada yang disimpan; bukan buku besar. Kode yang diuji: cabang `fitur/jurnal` — `b6cfdcd`
(rumus "titipan dulu" jadi satu fungsi) + `6afad9d` (fitur) + `f234992` (panduan), belum di-push.

Cara membaca tabel (kolom **Lapisan**, status, kewajiban bukti) mengikuti [`docs/qa/README.md`](../README.md).
Tata letak folder sama dengan [`2026-11-09-pendanaan`](../2026-11-09-pendanaan/README.md).

| Berkas | Isi |
|---|---|
| [`test-cases/jurnal.md`](test-cases/jurnal.md) | 16 test case (N/A/C) + hasil aktual + bukti layar per langkah |
| [`report/Laporan-QA-jurnal.md`](report/Laporan-QA-jurnal.md) | Laporan: skor terhitung, ringkasan, hasil per case, catatan, kendala alat uji, catatan kejujuran |
| [`report/Laporan-QA-jurnal.pdf`](report/Laporan-QA-jurnal.pdf) | Laporan yang sama dalam PDF (gambar tertanam) |
| [`manifests/jurnal.json`](manifests/jurnal.json) | Sumber laporan & skor (dibaca skrip skill `qa-evidence`) |
| `evidence/jurnal/` | Tangkapan layar per langkah, dikecilkan ke lebar ≤ 420 px (JPEG) |

## Lingkungan uji (terisolasi, bukan production)

| Aspek | Nilai |
|---|---|
| Berkas konfigurasi | `.env.jrn` = salinan `.env` + penimpaan `APP_ENV=jrn`, `APP_URL`, `DB_DATABASE=jrn_central`, `TENANCY_DB_PREFIX=jrn_central_tenant_`, sesi `database` di koneksi `mysql` (cookie `jrn_session`), cache `database` (`CACHE_PREFIX=jrn_`), antrean `sync`, mail `log`, broadcast `log`; `LEGACY_DB_DATABASE`, `GEMINI_API_KEY`, kunci AWS & kredensial mail dikosongkan. `.env` tidak disentuh. Dibuang ke Recycle Bin setelah QA |
| URL | `http://127.0.0.1:8147` — `php artisan serve --env=jrn --host=127.0.0.1 --port=8147 --no-reload` |
| Database | `jrn_central` (migrate + `MasterPermissionSeeder` + `central:bootstrap`), perusahaan `jrn_central_tenant_jurnalqa` (QA) dan `jrn_central_tenant_contoh` (data contoh untuk screenshot panduan & dokumen PR). MySQL 8.0.45. Semua di-drop dengan nama persis setelah QA (dump disimpan di luar repo) |
| Aset frontend | Vite dev server milik pengembang di `[::1]:5173` (tidak dimatikan/diubah; `public/hot` utuh) |
| Browser | Chromium **headless** lewat Python Playwright 1.58 (aturan pemilik: tanpa jendela). Viewport 1280×(1000–1400) DPR 1, dialog difoto per elemen; A04 390×844 DPR 2 (ponsel, sentuh) |
| Basis data lain | Tidak disentuh. Semua database yang dibuat berawalan `jrn_` |

**Bukti isolasi.** Skrip penyiapan dan pemeriksaan DB menolak berjalan bila database pusat bukan `jrn_central` atau
prefiks tenant bukan `jrn_central_tenant_`; setiap keluaran pemeriksaan DB mencatat nama database tenant
(`jrn_central_tenant_jurnalqa`). Server `--env=jrn` memakai cookie `jrn_session`.

### Penyiapan

1. `CREATE DATABASE jrn_central`, `php artisan migrate --env=jrn`, `db:seed --class=MasterPermissionSeeder`, `permission:cache-reset`.
2. `php artisan central:bootstrap --env=jrn` — organisasi "Grup QA Jurnal", admin pertama, perusahaan "PT Jurnal QA"
   (`jurnalqa`, `JQA`); provisioning memberi 82 kategori (template + Pendanaan).
3. Skrip PHP di luar repo (menolak berjalan di luar `jrn_central`): akun FM Rina, staf Budi (debitur piutang), Lina
   (peran uji "lihat arus kas"), profil PKP 11 %, rekening BCA Operasional / Mandiri Cadangan / Kas Kecil, kategori
   buatan pengguna "Pendanaan Lain › Pinjaman dari Direksi" dan "Penyesuaian › Selisih Kas", 3 invoice + 3 pembayaran,
   17 transaksi bank termasuk transfer berpasangan dan utang/piutang berformat persis controller-nya (lihat prasyarat
   di test case).
4. Screenshot **sebelum** untuk dokumen PR diambil pada titik ini, masih di kode `main` (`81c6957`), sebelum cabang
   `fitur/jurnal` dibuat. Screenshot **sesudah** diambil dengan langkah yang sama sebelum QA mengubah data.
5. Data contoh panduan: organisasi "Grup Contoh QC", perusahaan `contoh` (provisioning + seeder demo, sub "Sewa Ruang
   Rapat" tanpa grup L/R, satu utang contoh Bank BRI), akun sesuai header `video/capture/*.js`.

### Akun uji (lokal, hanya di `jrn_central`, ikut terhapus saat database di-drop)

Satu sandi acak untuk akun QA (disimpan di luar repo, tidak dicetak di dokumen); akun data contoh memakai sandi yang
tertulis di header skrip capture.

| Email | Peran | Dipakai di |
|---|---|---|
| `fm@jrn.test` (Rina Keuangan) | finance manager (`jurnalqa`) | semua case kecuali A03 |
| `lihat@jrn.test` (Lina Hanya Lihat) | "lihat arus kas" (`jurnalqa`) | A03 |
| `budi@jrn.test` (Budi Kasir) | staff (`jurnalqa`) | debitur piutang RCV-00001 |
| `admin@jrn.test` | admin (`jurnalqa`) | penyiapan |

### Efek samping di luar lingkungan `jrn`

Tidak ada server/DB lain yang disentuh. Runner headless tidak memakai Playwright/Chrome DevTools MCP. Baris log aplikasi
berlabel `jrn.` dan baris log browser Boost dari sesi ini dicadangkan lalu dihapus dari log bersama setelah QA.

## Membangun ulang laporan

Skrip dari skill `qa-evidence` (`~/.claude/skills/qa-evidence/scripts/`), dijalankan dari folder ini:

```bash
python <skill>/scripts/build_evidence.py manifests/jurnal.json   # sambung bukti ke test case
python <skill>/scripts/check_evidence.py test-cases manifests      # gerbang: case FE/FE+BE wajib bergambar
python <skill>/scripts/build_report.py   manifests/jurnal.json   # PDF; skor dihitung dari manifest
python <skill>/scripts/check_links.py    .                        # tautan & gambar
```

Tangkapan layar mentah (resolusi penuh), keluaran pemeriksaan DB (JSON), dan dump database tidak disimpan di repo.
