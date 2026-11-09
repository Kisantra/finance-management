# QA 9 November 2026 — Kategori Transaksi › Pakai Template

Pengujian berbasis bukti untuk fitur **Pakai Template** kategori transaksi (template 12 induk / 55 sub yang
sudah bergrup Laba Rugi, dipakai tombol di halaman Kategori Transaksi dan oleh seeder perusahaan baru).
Kode yang diuji: `main` lokal `c32e3ff` + `5073700` (*feat(kategori): Pakai Template kategori transaksi + template untuk perusahaan baru*, belum di-push).

Cara membaca tabel (kolom **Lapisan**, status, kewajiban bukti) mengikuti [`docs/qa/README.md`](../README.md).
Tata letak folder sama dengan [`2026-11-06-predeploy`](../2026-11-06-predeploy/README.md).

| Berkas | Isi |
|---|---|
| [`test-cases/template-kategori.md`](test-cases/template-kategori.md) | 10 test case (N/A/C) + hasil aktual + bukti layar per langkah |
| [`report/Laporan-QA-template-kategori.md`](report/Laporan-QA-template-kategori.md) | Laporan: skor terhitung, ringkasan, temuan, hasil per case, catatan, kendala alat uji, catatan kejujuran |
| [`report/Laporan-QA-template-kategori.pdf`](report/Laporan-QA-template-kategori.pdf) | Laporan yang sama dalam PDF (gambar tertanam) |
| [`manifests/template-kategori.json`](manifests/template-kategori.json) | Sumber laporan & skor (dibaca skrip skill `qa-evidence`) |
| `evidence/template-kategori/` | 25 tangkapan layar, dipotong/dikecilkan ke lebar ≤ 420 px (JPEG) |

## Lingkungan uji (terisolasi, bukan production)

| Aspek | Nilai |
|---|---|
| Berkas konfigurasi | `.env.tplkat` = salinan `.env` + penimpaan `APP_ENV=tplkat`, `APP_URL`, `DB_DATABASE=tplkat_central`, `TENANCY_DB_PREFIX=tplkat_central_tenant_`, sesi `database` di koneksi `mysql` (cookie `tplkat_session`), cache `database` (`CACHE_PREFIX=tplkat_`), antrean `sync`, mail `log`, broadcast `log`, `LEGACY_DB_DATABASE` & `GEMINI_API_KEY` dikosongkan. `.env` tidak disentuh. Dibuang ke Recycle Bin setelah QA |
| URL | `http://127.0.0.1:8139` — `php artisan serve --env=tplkat --host=127.0.0.1 --port=8139 --no-reload` |
| Database | `tplkat_central` (migrate + `MasterPermissionSeeder` + `central:bootstrap`), perusahaan `tplkat_central_tenant_tpllama` dan `tplkat_central_tenant_tplbaru`; untuk screenshot panduan juga `…_contoh` dan `…_contoh-lama`. MySQL 8.0.45. Semua di-drop dengan nama persis setelah QA (dump disimpan di luar repo) |
| Aset frontend | Vite dev server milik pengembang di `[::1]:5173` (tidak di-restart; perubahan kode tampil lewat hot reload) |
| Browser | Chrome lewat Chrome DevTools MCP, satu *isolated context* per peran, viewport 1280×800 DPR 1 (N04: 390×844 DPR 2 mode ponsel). Screenshot panduan: Playwright MCP 1280×720 DPR 1,5 |
| Basis data lain | Tidak disentuh. Semua database yang dibuat berawalan `tplkat_` |

**Bukti isolasi.** Setelah server menyala, satu `GET /login` menghasilkan cookie `tplkat_session` dan baris di
`tplkat_central.sessions`; perintah konsol `--env=tplkat` terbukti menulis ke `tplkat_central` (tabel `migrations`
berisi 26 baris di sana). Dengan `.env` biasa sesi akan masuk Redis dengan nama cookie lain.

`APP_ENV=tplkat` (bukan `local`) karena proses PHP yang melayani `artisan serve` memuat `.env.{APP_ENV}` —
alasan yang sama dengan putaran 6 November (lihat README predeploy › *Penyimpangan dari brief*).

### Penyiapan

1. `CREATE DATABASE tplkat_central`, `php artisan migrate --env=tplkat`, `db:seed --class=MasterPermissionSeeder`, `permission:cache-reset`.
2. `php artisan central:bootstrap --env=tplkat` — organisasi "Grup QA Template Kategori", admin pertama, perusahaan "PT Kategori Lama QA" (`tpllama`, `TKL`). Provisioning ini sudah memakai seeder baru (77 kategori).
3. Skrip PHP di luar repo (menolak berjalan bila database bukan `tplkat_central` / prefiks tenant bukan `tplkat_central_tenant_`):
   akun FM dan pengguna hanya-lihat + peran uji "hanya lihat kategori", profil perusahaan `tpllama`, lalu kategori `tpllama`
   **diganti** dengan kumpulan kategori sebelum template (lihat test case › Prasyarat), rekening BCA Operasional,
   dan dua transaksi (Iklan Instagram Oktober → Beban Pemasaran datar; Konsumsi rapat bulanan → MAKAN MINUM).
4. Perusahaan `tplbaru` dibuat lewat layar di N01.

### Akun uji (lokal, hanya di `tplkat_central`, ikut terhapus saat database di-drop)

Satu sandi acak untuk semua akun QA: `Tplkat-m8i2VFFa7AIZ#9`.

| Email | Peran | Dipakai di |
|---|---|---|
| `admin@tplkat.test` | admin (`tpllama`, lalu `tplbaru`) | N01 |
| `fm@tplkat.test` | finance manager (`tpllama`) | N02, N03, N04, A02, A03, A04, A05, C01 |
| `lihat@tplkat.test` | "hanya lihat kategori" (`view dashboard`, `view categories`) | A01 |

### Data contoh untuk screenshot panduan (bukan bagian case QA)

Setelah case QA selesai, skrip kedua di luar repo membuat organisasi "Grup Contoh QC" dengan perusahaan
`contoh` (provisioning = template + data demo `ClientSeeder`, `BankAccountSeeder`, `InvoiceSeeder`,
`BankTransactionSeeder`; profil contoh, bukan `CompanyProfileSeeder` yang berisi data perusahaan asli) dan
`contoh-lama` (kategori sebelum template). Akun sesuai header `video/capture/transaction-categories.js`
(`fm@qc.test`, `admin@gmail.com`, `fm.lama@qc.test`, sandi `password` — lingkungan lokal yang dibuang).
`video/capture/bank-accounts.js` dijalankan dengan keluaran screenshot ke folder sementara (bukti skrip itu tetap
berjalan dengan label template), lalu `video/capture/transaction-categories.js` mengambil 25 screenshot panduan.

### Efek samping di luar lingkungan `tplkat`

Laravel Boost meneruskan pesan konsol halaman uji ke berkas bersama `storage/logs/browser.log` (channel `tplkat.`);
baris itu dibersihkan saat pembongkaran. Playwright MCP menulis berkas sementara di `.playwright-mcp/` (diabaikan
git); berkas milik sesi ini (`tplkat-*.js` dan log/snapshot 9 Nov 13:28) dihapus. Lampiran contoh yang diunggah
`bank-accounts.js` membentuk `storage/tenantcontoh/` (berkas perusahaan contoh) — folder itu dihapus saat
pembongkaran; folder untuk `tpllama`/`tplbaru` tidak terbentuk.

## Membangun ulang laporan

Skrip dari skill `qa-evidence` (`~/.claude/skills/qa-evidence/scripts/`), dijalankan dari folder ini:

```bash
python <skill>/scripts/build_evidence.py manifests/template-kategori.json   # sambung bukti ke test case
python <skill>/scripts/check_evidence.py test-cases manifests               # gerbang: 10 case, 9 butuh bukti UI, 9 bergambar
python <skill>/scripts/build_report.py   manifests/template-kategori.json   # PDF; skor dihitung dari manifest
python <skill>/scripts/check_links.py    .                                   # tautan & gambar
```

Tangkapan layar mentah (resolusi penuh) dan dump database tidak disimpan di repo.
