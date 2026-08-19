# Test Case — Autentikasi & Multi-Tenancy

Sumber teknis: [`docs/module/admin-users-permissions.md`](../../module/admin-users-permissions.md),
[`docs/module/dashboard.md`](../../module/dashboard.md),
[`docs/multi-tenancy-runbook-eksekusi.md`](../../multi-tenancy-runbook-eksekusi.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Ingat**: dijalankan di `finance_central` lokal, bukan production.
**Prasyarat**: 3 akun seed (admin/manager/staff), 2 perusahaan (`kisantra`, `semesta`);
`manager@gmail.com` anggota keduanya, `staff@gmail.com` hanya `kisantra`.
Viewport browser 1440×900.

Modul ini adalah fondasi seluruh QA lain: bila isolasi perusahaan bocor di sini,
hasil pengujian modul lain tidak bermakna.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Login admin (1 perusahaan) | `admin@gmail.com` / `password` → Masuk | Langsung ke `/c/kisantra/dashboard`, tanpa pemilih perusahaan | FE+BE | HTTP 200 di `/c/kisantra/dashboard`; dashboard tampil dengan data Kisantra | Pass |
| N02 | Login manager (2 perusahaan) | `manager@gmail.com` → Masuk | Muncul halaman **Pilih Perusahaan** berisi Kisantra (KSN) & Semesta (SPI) | FE+BE | Halaman `/choose-company` tampil 2 kartu: "Kisantra KSN", "Semesta SPI" | Pass |
| N03 | Pilih perusahaan dari pemilih | Klik kartu "Kisantra" | Masuk `/c/kisantra/dashboard`; sidebar menampilkan nama perusahaan + tombol "Ganti perusahaan" | FE+BE | Navigasi ke `/c/kisantra/dashboard`; tombol "Kisantra Ganti perusahaan" tampil | Pass |
| N04 | Staff 1 perusahaan auto-redirect | `staff@gmail.com` → Masuk | Tanpa pemilih, langsung ke dashboard perusahaannya | FE+BE | Rantai: `POST /login` 302 → `/choose-company` 302 → `/c/kisantra/dashboard` 200 | Pass |
| N05 | Menu sidebar ber-prefix perusahaan segera setelah login (regresi BUG-01) | Login staff → **tanpa reload** baca `href` semua item sidebar | Semua `href` = `/c/kisantra/...`; klik menu berpindah halaman | FE | `["/c/kisantra/dashboard","/c/kisantra/clients","/c/kisantra/services","/c/kisantra/invoices","/c/kisantra/fund-requests"]`; klik "Klien" → `/c/kisantra/clients` | Pass (percobaan ke-2, setelah BUG-01 diperbaiki) |
| N06 | Logout | Menu user → Keluar | Sesi berakhir, kembali ke `/login` | FE+BE | Redirect ke `/login`; request berikutnya sebagai guest | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Password salah | `staff@gmail.com` / `salah123` | Tetap di halaman login, muncul pesan kredensial tidak cocok; tidak ada sesi | FE+BE | Login ditolak, tidak terbentuk sesi (request lanjutan tetap guest) | Pass |
| A02 | Slug perusahaan tidak dikenal | Buka `/c/tidak-ada/dashboard` sebagai staff | **404**, bukan 500 | BE | HTTP **404** | Pass |
| A03 | Akses perusahaan yang bukan anggotanya | Staff (hanya Kisantra) buka `/c/semesta/dashboard` | **403** — ditolak di server, bukan sekadar menu disembunyikan | BE | HTTP **403** ("Anda tidak memiliki akses ke perusahaan ini") | Pass |
| A04 | Guest membuka halaman perusahaan | Tanpa login buka `/c/kisantra/dashboard` | Redirect ke `/login` | BE | HTTP **302** → `/login` | Pass |
| A05 | User sudah login membuka `/login` (regresi BUG-03) | Sesi aktif → buka `/login` | Diarahkan ke pemilih perusahaan, **bukan 500** | BE | Sebelum perbaikan: **HTTP 500** `UrlGenerationException`. Setelah perbaikan: **302 → `/choose-company`**; guest tetap 200 | Pass (percobaan ke-2, setelah BUG-03 diperbaiki) |
| A06 | Route lama tanpa prefix perusahaan | Staff buka `/dashboard` | 404 — route lama sudah tidak ada | BE | HTTP **404** | Pass |
| A07 | Staff membuka halaman admin lewat URL langsung | `/c/kisantra/admin/users` | **403** — menu tersembunyi bukan kontrol akses | BE | HTTP **403** | Pass |
| A08 | Staff membuka laporan Laba Rugi lewat URL langsung | `/c/kisantra/reports/profit-loss` | **403** | BE | HTTP **403** | Pass |

## C. Alur Berantai (lintas aktor / lintas perusahaan)

Manager adalah satu-satunya akun anggota dua perusahaan, sehingga hanya dia yang
bisa membuktikan isolasi tanpa berganti akun.

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Isolasi data antar perusahaan | Login manager → buka `/c/kisantra/invoices?month=2026-02` lalu `/c/semesta/invoices?month=2026-02` (URL & filter identik) | Kisantra menampilkan data invoice-nya; Semesta menampilkan 0 — data tidak saling bocor | FE+BE | Kisantra: **2 invoice, Total Pendapatan Rp 6.000.000**. Semesta: **0 dari 0**, Rp 0. DB: `tenant_kisantra.invoices`=4 baris, `tenant_semesta.invoices`=0 | Pass |
| C02 | Isolasi database fisik | Periksa skema `finance_central` vs `tenant_*` | Tabel bisnis (invoices, bank_transactions, clients) **tidak ada** di DB pusat | BE (DB) | `finance_central` 19 tabel tanpa tabel bisnis; `tenant_kisantra`/`tenant_semesta` 22 tabel bisnis masing-masing | Pass |
| C03 | Role ter-scope per perusahaan (Spatie teams) | Periksa `model_has_roles` | Manager punya baris role terpisah untuk tiap perusahaan; staff hanya untuk kisantra | BE (DB) | manager → `finance manager @ kisantra` + `finance manager @ semesta`; staff → `staff @ kisantra`; admin → `admin @ kisantra` | Pass |
| C04 | Ganti perusahaan tanpa login ulang | Manager di Kisantra → tombol "Ganti perusahaan" → Semesta | Konteks berpindah; seluruh URL sidebar berubah ke `/c/semesta/...`; data mengikuti perusahaan baru | FE+BE | URL berubah ke `/c/semesta/...`, sidebar & breadcrumb mengikuti, daftar invoice kosong sesuai isi DB Semesta | Pass |

## Catatan pelaksanaan

- A02–A08 dieksekusi lewat **request HTTP langsung dengan cookie sesi asli**
  (bukan lewat layar), karena yang diuji justru perilaku server saat UI di-bypass —
  ini persis alasan kolom Lapisan ada. Dinyatakan apa adanya, bukan dikarang
  sebagai alur layar.
- N01–N06, C01, C04 dieksekusi lewat UI sungguhan di Chrome.
- C02–C03 diverifikasi langsung di database (kondisi tidak dapat diamati dari layar).
