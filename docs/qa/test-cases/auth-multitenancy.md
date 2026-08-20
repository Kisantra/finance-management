# Test Case — Autentikasi & Multi-Tenancy

Sumber teknis: [`docs/module/admin-users-permissions.md`](../../module/admin-users-permissions.md),
[`docs/module/dashboard.md`](../../module/dashboard.md),
[`docs/multi-tenancy-runbook-eksekusi.md`](../../multi-tenancy-runbook-eksekusi.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Ingat**: dijalankan di `finance_central` lokal, bukan production.
**Prasyarat**: 3 akun seed (admin/manager/staff), 2 perusahaan (`kisantra`, `semesta`);
`manager@gmail.com` anggota keduanya, `staff@gmail.com` hanya `kisantra`.
Viewport browser 1440×900.

**Pergeseran lingkungan (dicatat, bukan ditutupi)**: putaran QA berikutnya membuat
5 perusahaan uji (`qa-satu`..`qa-lima`) dan memasukkan ketiga akun seed sebagai
anggotanya. Akibatnya `admin` dan `staff` kini anggota 6 perusahaan, sehingga
N01/N04 tidak lagi dapat diuji dengan akun itu — keduanya sekarang melewati
pemilih perusahaan, yang justru perilaku benar untuk user multi-perusahaan.
Agar maksud case tetap teruji, dibuat akun `qa-solo@qa.test` (sandi `password`,
role `staff`, anggota **hanya** `qa-satu`).

Modul ini adalah fondasi seluruh QA lain: bila isolasi perusahaan bocor di sini,
hasil pengujian modul lain tidak bermakna.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Login admin | `admin@gmail.com` / `password` → Masuk | Kredensial benar diterima dan pengguna masuk ke aplikasi | FE+BE | Dijalankan lewat layar. **Harapan asli ("langsung ke dashboard tanpa pemilih") sudah tidak berlaku**: admin kini anggota 6 perusahaan, sehingga pemilih tampil — perilaku yang benar. Jalur satu-perusahaan dipindahkan ke N04 | Pass |
| N02 | Login manager (2 perusahaan) | `manager@gmail.com` → Masuk | Muncul halaman **Pilih Perusahaan** berisi Kisantra (KSN) & Semesta (SPI) | FE+BE | Halaman `/choose-company` tampil 2 kartu: "Kisantra KSN", "Semesta SPI" | Pass |
| N03 | Pilih perusahaan dari pemilih | Manager login → klik kartu "Kisantra" | Masuk `/c/kisantra/dashboard`; sidebar menampilkan nama perusahaan + tombol "Ganti perusahaan" | FE+BE | Dijalankan lewat layar: pemilih menampilkan 7 kartu (Kisantra, Semesta, dan 5 perusahaan QA); klik Kisantra → `/c/kisantra/dashboard`, header sidebar "Kisantra / Ganti perusahaan" | Pass |
| N04 | Anggota 1 perusahaan auto-redirect | `qa-solo@qa.test` → Masuk | Tanpa pemilih, langsung ke dashboard perusahaannya | FE+BE | Dijalankan lewat layar: login → **langsung** `/c/qa-satu/dashboard`, tanpa `/choose-company`. Header sidebar menampilkan "QA Satu / Finance Management" (bukan tombol "Ganti perusahaan"), dan menu tersaring sesuai role `staff` | Pass |
| N05 | Menu sidebar ber-prefix perusahaan segera setelah login (regresi BUG-01) | Login staff → **tanpa reload** baca `href` semua item sidebar | Semua `href` = `/c/kisantra/...`; klik menu berpindah halaman | FE | `["/c/kisantra/dashboard","/c/kisantra/clients","/c/kisantra/services","/c/kisantra/invoices","/c/kisantra/fund-requests"]`; klik "Klien" → `/c/kisantra/clients` | Pass (percobaan ke-2, setelah BUG-01 diperbaiki) |
| N06 | Logout | Menu user → Keluar | Sesi berakhir, kembali ke `/login` | FE+BE | Dijalankan lewat layar: klik "Keluar" pada menu user → halaman login tampil kembali | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Password salah | `staff@gmail.com` / `salah123` | Tetap di halaman login, muncul pesan kredensial tidak cocok; tidak ada sesi | FE+BE | Dijalankan lewat layar: pesan galat tampil merah tepat di bawah kolom email, sesi tidak terbentuk. Awalnya pesan berbahasa **Inggris** ("These credentials do not match our records.") di aplikasi berbahasa Indonesia — lihat BUG-AUTH-02; setelah `lang/id/auth.php` ditambahkan pesannya menjadi "Email atau kata sandi tidak cocok dengan data kami." | Pass |
| A02 | Slug perusahaan tidak dikenal | Buka `/c/tidak-ada/dashboard` sebagai staff | **404**, bukan 500 | BE | HTTP **404** | Pass |
| A03 | Akses perusahaan yang bukan anggotanya | Staff (hanya Kisantra) buka `/c/semesta/dashboard` | **403** — ditolak di server, bukan sekadar menu disembunyikan | BE | HTTP **403** ("Anda tidak memiliki akses ke perusahaan ini") | Pass |
| A04 | Guest membuka halaman perusahaan | Tanpa login buka `/c/kisantra/dashboard` | Redirect ke `/login` | BE | HTTP **302** → `/login` | Pass |
| A05 | User sudah login membuka `/login` (regresi BUG-03) | Sesi aktif → buka `/login` | Diarahkan ke pemilih perusahaan, **bukan 500** | FE+BE | Sebelum perbaikan: **HTTP 500** `UrlGenerationException`. Setelah perbaikan: **302 → `/choose-company`**; guest tetap 200 | Pass (percobaan ke-2, setelah BUG-03 diperbaiki) |
| A06 | Route lama tanpa prefix perusahaan | Staff buka `/dashboard` | 404 — route lama sudah tidak ada | BE | HTTP **404** | Pass |
| A07 | Staff membuka halaman admin lewat URL langsung | `/c/kisantra/admin/users` | **403** — menu tersembunyi bukan kontrol akses | BE | HTTP **403** | Pass |
| A08 | Staff membuka laporan Laba Rugi lewat URL langsung | `/c/kisantra/reports/profit-loss` | **403** | BE | HTTP **403** | Pass |

## C. Alur Berantai (lintas aktor / lintas perusahaan)

Manager adalah satu-satunya akun anggota dua perusahaan, sehingga hanya dia yang
bisa membuktikan isolasi tanpa berganti akun.

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Isolasi data antar perusahaan | Login manager → buka `/c/kisantra/invoices?month=2026-02` lalu `/c/semesta/invoices?month=2026-02` (URL & filter identik) | Kisantra menampilkan data invoice-nya; Semesta menampilkan 0 — data tidak saling bocor | FE+BE | Dijalankan lewat layar dengan URL & filter identik. Kisantra: **2 invoice, Total Pendapatan Rp 6.000.000**. Semesta: **0-0 dari 0**, seluruh kartu Rp 0, "Tidak ada invoice ditemukan". DB: `tenant_kisantra.invoices`=4 baris, `tenant_semesta.invoices`=0 | Pass |
| C02 | Isolasi database fisik | Periksa skema `finance_central` vs `tenant_*` | Tabel bisnis (invoices, bank_transactions, clients) **tidak ada** di DB pusat | BE (DB) | `finance_central` 19 tabel tanpa tabel bisnis; `tenant_kisantra`/`tenant_semesta` 22 tabel bisnis masing-masing | Pass |
| C03 | Role ter-scope per perusahaan (Spatie teams) | Periksa `model_has_roles` | Manager punya baris role terpisah untuk tiap perusahaan; staff hanya untuk kisantra | BE (DB) | manager → `finance manager @ kisantra` + `finance manager @ semesta`; staff → `staff @ kisantra`; admin → `admin @ kisantra` | Pass |
| C04 | Ganti perusahaan tanpa login ulang | Manager di Kisantra → tombol "Ganti perusahaan" → Semesta | Konteks berpindah; seluruh URL sidebar berubah ke `/c/semesta/...`; data mengikuti perusahaan baru | FE+BE | Dijalankan lewat layar: tombol "Ganti perusahaan" membuka daftar 7 perusahaan → pilih Semesta → dashboard Semesta terbuka, header sidebar berubah menjadi "Semesta", seluruh angka Rp 0 sesuai isi DB Semesta, tanpa login ulang | Pass |

## Catatan pelaksanaan

- A02–A08 dieksekusi lewat **request HTTP langsung dengan cookie sesi asli**
  (bukan lewat layar), karena yang diuji justru perilaku server saat UI di-bypass —
  ini persis alasan kolom Lapisan ada. Dinyatakan apa adanya, bukan dikarang
  sebagai alur layar.
- N01–N06, C01, C04 dieksekusi lewat UI sungguhan di Chrome, dengan tangkapan
  layar per langkah.
- C02–C03 diverifikasi langsung di database (kondisi tidak dapat diamati dari layar).

### Kegagalan tooling (bukan cacat aplikasi)

Saat menjalankan C04, tombol "Ganti perusahaan" tampak **tidak merespons**: baik
klik maupun tombol Enter tidak mengubah `aria-expanded`, dan tidak ada elemen
`[role="menu"]` di DOM. Sempat terlihat seperti cacat nyata.

Ternyata pembacaannya yang terlalu cepat: menu Radix dipasang setelah render
berikutnya, sedangkan pemeriksaan DOM dijalankan pada tick yang sama dengan
klik. Ketika DOM dibaca sekali lagi, `data-state` sudah `open` dan seluruh 7
perusahaan ada di dalam menu. Klik pada item menu juga perlu menyasar elemen
`<a>` di dalamnya, bukan wadah `menuitem`-nya.

Dicatat sebagai masalah alat uji, bukan temuan aplikasi — mencampur keduanya
akan membuat pembaca laporan kehilangan pegangan mana yang benar-benar rusak.

## Temuan

### BUG-AUTH-02 — Pesan autentikasi, reset sandi, dan paginasi keluar dalam bahasa Inggris

- **SIFAT**: Cacat lokalisasi. Terlihat hanya dari layar; pengujian lewat HTTP hanya membaca kode status, sehingga cacat ini lolos pada putaran pertama.
- **TERKAIT**: A01.
- **GEJALA**: Salah memasukkan kata sandi menampilkan "These credentials do not match our records." pada antarmuka yang seluruhnya berbahasa Indonesia.
- **SEBAB**: `config/app.php` menetapkan locale `id`, tetapi direktori `lang/id/` sama sekali tidak memuat `auth.php`, `passwords.php`, maupun `pagination.php` — hanya `lang/en/` yang punya. Laravel jatuh ke fallback bahasa Inggris. Hal yang sama berlaku untuk `lang/zh/`.
- **CAKUPAN**: Setiap pesan gagal login, seluruh alur lupa/atur ulang kata sandi (5 pesan), dan tautan paginasi bawaan. Semuanya jalur yang ditemui pengguna saat sedang bermasalah — justru saat kejelasan bahasa paling dibutuhkan.
- **DIPERBAIKI**: `lang/id/{auth,passwords,pagination}.php` dan `lang/zh/{auth,passwords,pagination}.php` ditambahkan. Diverifikasi ulang lewat layar (bukti `A01-1`).

### CATATAN-AUTH-01 — Halaman login masih mengiklankan "121+ Komponen Livewire"

- **SIFAT**: Salin teks usang, risiko rendah, tetapi tampil di halaman pertama
  yang dilihat setiap pengguna.
- **GEJALA**: Panel kiri halaman `/login` menampilkan statistik "121+ / Komponen
  Livewire".
- **SEBAB**: Livewire sudah sepenuhnya dilepas (lihat `CLAUDE.md`: seluruh
  frontend kini Inertia + React); teks promosi ini tertinggal dari versi lama.
- **CAKUPAN**: Kosmetik, tetapi menyesatkan siapa pun yang menilai tumpukan
  teknologi aplikasi dari layar login.
- **SARAN PERBAIKAN**: Ganti dengan angka yang benar-benar mewakili produk, atau
  hapus kartu statistik itu.
