# QA 9 November 2026 — Pendanaan (Opsi A) di Arus Kas & Template Kategori

Pengujian berbasis bukti untuk fitur **Pendanaan**: kategori bertipe `financing` (setoran modal, prive, setor PPN,
setor titipan pajak klien) bisa dicatat lewat Catat Pemasukan/Pengeluaran, tampil berbadge **Pendanaan** di tab
Semua/Pemasukan/Pengeluaran dengan kartu ringkasan terpisah, ikut ekspor Excel (kolom terakhir *Jenis (Laba
Rugi/Pendanaan)*), tidak mengubah Laba Rugi; pokok utang/piutang hanya-lihat; template kategori mendapat bagian
Pendanaan. Kode yang diuji: cabang `fitur/pendanaan` — `6c4ef5e` (template kategori) + `b58a7e0` (Arus Kas) +
`273be20` (panduan), belum di-push.

Cara membaca tabel (kolom **Lapisan**, status, kewajiban bukti) mengikuti [`docs/qa/README.md`](../README.md).
Tata letak folder sama dengan [`2026-11-09-template-kategori`](../2026-11-09-template-kategori/README.md).

| Berkas | Isi |
|---|---|
| [`test-cases/pendanaan.md`](test-cases/pendanaan.md) | 12 test case (N/A/C) + hasil aktual + bukti layar per langkah |
| [`report/Laporan-QA-pendanaan.md`](report/Laporan-QA-pendanaan.md) | Laporan: skor terhitung, ringkasan, temuan, hasil per case, kendala alat uji, catatan kejujuran |
| [`report/Laporan-QA-pendanaan.pdf`](report/Laporan-QA-pendanaan.pdf) | Laporan yang sama dalam PDF (gambar tertanam) |
| [`manifests/pendanaan.json`](manifests/pendanaan.json) | Sumber laporan & skor (dibaca skrip skill `qa-evidence`) |
| `evidence/pendanaan/` | Tangkapan layar per langkah, dikecilkan ke lebar ≤ 420 px (JPEG) |

## Lingkungan uji (terisolasi, bukan production)

| Aspek | Nilai |
|---|---|
| Berkas konfigurasi | `.env.pdn` = salinan `.env` + penimpaan `APP_ENV=pdn`, `APP_URL`, `DB_DATABASE=pdn_central`, `TENANCY_DB_PREFIX=pdn_central_tenant_`, sesi `database` di koneksi `mysql` (cookie `pdn_session`), cache `database` (`CACHE_PREFIX=pdn_`), antrean `sync`, mail `log`, broadcast `log`, `LEGACY_DB_DATABASE` & `GEMINI_API_KEY` dikosongkan. `.env` tidak disentuh. Dibuang ke Recycle Bin setelah QA |
| URL | `http://127.0.0.1:8141` — `php artisan serve --env=pdn --host=127.0.0.1 --port=8141 --no-reload` |
| Database | `pdn_central` (migrate + `MasterPermissionSeeder` + `central:bootstrap`), perusahaan `pdn_central_tenant_pdnlama` (QA), `…_pdnbaru` (dibuat lewat layar di N06); untuk cek pengembang & screenshot panduan juga `…_pdndev`, `…_contoh`, `…_contoh-lama`. MySQL 8.0.45. Semua di-drop dengan nama persis setelah QA (dump disimpan di luar repo) |
| Aset frontend | Vite dev server milik pengembang di `[::1]:5173` (tidak dimatikan/diubah) |
| Browser | Chromium **headless** lewat Python Playwright 1.58 (aturan pemilik: tanpa jendela). Viewport 1280×800 DPR 1; N07 390×844 DPR 2 (mode ponsel, sentuh). WebSocket HMR diputus di konteks uji agar halaman tidak dimuat ulang di tengah langkah |
| Basis data lain | Tidak disentuh. Semua database yang dibuat berawalan `pdn_` |

**Bukti isolasi.** Satu `GET /login` ke server menghasilkan cookie `pdn_session` dan satu baris di
`pdn_central.sessions`; semua perintah konsol `--env=pdn` dan skrip pemeriksaan DB menolak berjalan bila database
pusat bukan `pdn_central` atau prefiks tenant bukan `pdn_central_tenant_`. Setiap keluaran pemeriksaan DB mencatat
nama database tenant (`pdn_central_tenant_pdnlama`).

### Penyiapan

1. `CREATE DATABASE pdn_central`, `php artisan migrate --env=pdn`, `db:seed --class=MasterPermissionSeeder`, `permission:cache-reset`.
2. `php artisan central:bootstrap --env=pdn` — organisasi "Grup QA Pendanaan", admin pertama, perusahaan "PT Pendanaan
   Lama QA" (`pdnlama`, `PDL`). Provisioning dijalankan **di kode `main` (1646872)**, jadi kategorinya persis perusahaan lama:
   77 kategori, induk pendanaan "Setoran Modal" & "Penarikan Modal" **tanpa anak**.
3. Skrip PHP di luar repo (menolak berjalan di luar `pdn_central`): akun FM (2) dan pengguna hanya-lihat + peran uji
   "lihat arus kas" (`view dashboard`, `view income`, `view expense`, `view categories`), profil perusahaan, rekening
   BCA Operasional / Mandiri Cadangan / Kas Kecil, klien PT Maju Jaya + 1 invoice lunas Rp 11.000.000 (4 Nov),
   2 pemasukan & 4 pengeluaran November.
4. Screenshot "sebelum" untuk dokumen PR diambil pada titik ini, masih di kode `main`. Baru setelah itu cabang
   `fitur/pendanaan` dibuat dan kodenya diubah.

### Akun uji (lokal, hanya di `pdn_central`, ikut terhapus saat database di-drop)

Satu sandi acak untuk semua akun QA (disimpan di luar repo, tidak dicetak di dokumen).

| Email | Peran | Dipakai di |
|---|---|---|
| `fm@pdn.test` (Rina Keuangan) | finance manager (`pdnlama`) | N01–N05, N07, A01, A03, C01, C02 |
| `budi@pdn.test` (Budi Kasir) | finance manager (`pdnlama`) | pencatat sebagian data awal |
| `lihat@pdn.test` (Lina Hanya Lihat) | "lihat arus kas" (`pdnlama`) | A02 |
| `admin@pdn.test` | admin (`pdnlama`, lalu `pdnbaru`) | N06 |

### Data contoh untuk screenshot panduan (bukan bagian case QA)

Organisasi "Grup Contoh QC": perusahaan `contoh` (provisioning baru + seeder demo `ClientSeeder`, `BankAccountSeeder`,
`InvoiceSeeder`, `BankTransactionSeeder`, sub "Sewa Ruang Rapat" tanpa grup L/R, satu utang contoh Bank BRI) dan
`contoh-lama` (kategori bentuk lama). Akun sesuai header `video/capture/*.js`. `video/capture/cash-flow.js` dijalankan
headless lewat runner Node kecil di luar repo; layar Kategori Transaksi yang berubah diambil ulang dengan lokator yang
sama.

### Efek samping di luar lingkungan `pdn`

Tidak ada server/DB lain yang disentuh. Runner headless tidak memakai Playwright/Chrome DevTools MCP, jadi tidak ada
berkas `.playwright-mcp/`. Unduhan Excel N05 disimpan di folder sementara di luar repo.

## Membangun ulang laporan

Skrip dari skill `qa-evidence` (`~/.claude/skills/qa-evidence/scripts/`), dijalankan dari folder ini:

```bash
python <skill>/scripts/build_evidence.py manifests/pendanaan.json   # sambung bukti ke test case
python <skill>/scripts/check_evidence.py test-cases manifests       # gerbang: case FE/FE+BE wajib bergambar
python <skill>/scripts/build_report.py   manifests/pendanaan.json   # PDF; skor dihitung dari manifest
python <skill>/scripts/check_links.py    .                           # tautan & gambar
```

Tangkapan layar mentah (resolusi penuh), keluaran pemeriksaan DB (JSON), dan dump database tidak disimpan di repo.
