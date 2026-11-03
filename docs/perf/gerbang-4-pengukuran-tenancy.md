# Gerbang 4 — Pengukuran performa dengan tenancy MENYALA vs MATI

Diukur 2 November 2026. Branch `feature/multi-tenancy-rekonsiliasi`, commit **`ee37a32`**.
Semua angka mentah ada di `storage/perf-e/*.csv` dan `*.jsonl`; skrip pengukurnya di
`docs/perf/perf-e-*.php`. **Tidak ada kode produksi yang diubah untuk pengukuran ini.**

## 0. Ringkasan dalam satu paragraf

Dengan tenancy menyala, setiap request halaman yang sudah login membayar **+3 query**
dan **+2,3 ms** kerja PHP yang benar-benar milik tenancy (diukur di dalam satu basis
kode, bukan dengan mengurangi dua branch). Selisih ujung-ke-ujung antara branch ini dan
`main` memang lebih besar (**+24 s.d. +56 ms**), tetapi sebagian besarnya adalah biaya
**memuat 52 berkas kelas PHP tambahan per request** — biaya yang ditanggung OPcache di
produksi, bukan biaya database. Sebaliknya, pada halaman **dashboard** branch ini
**44 query LEBIH SEDIKIT** daripada `main` (50 vs 94), karena N+1 saldo rekening sudah
diperbaiki di sini dan belum di `main`. Yang benar-benar mahal bukan tenancy, melainkan
**laporan laba rugi: 297 query untuk 200 invoice**, N+1 yang tumbuh linear.

---

## 1. Cara pengukuran (dan mengapa begini)

### Dua kondisi

| | Kondisi A — tenancy MENYALA | Kondisi B — tenancy MATI |
|---|---|---|
| Kode | worktree `D:/tmp/perf-e-branch` @ `ee37a32` | worktree `D:/tmp/perf-e-main` @ `origin/main` (`23c9ff0`) |
| Database | `perf_central` + `tenant_perfa` | `perf_single` (satu database) |
| URL | `/c/perfa/...` | `/...` |
| Framework | laravel/framework 12.70.2 | **dinaikkan ke 12.70.2** (semula 12.65.0) |
| Indeks | — | `payments.payment_date` + `invoices.issue_date` **ditambahkan manual** |

Dua penyetaraan terakhir penting dan sengaja dilakukan:

- **Versi framework disamakan.** Awalnya B memakai 12.65.0. Selisih A−B tidak berubah
  setelah B dinaikkan ke 12.70.2 (`storage/perf-e/split-fw-sama.jsonl`), jadi versi
  vendor **bukan** penyebab selisih. Tanpa pemeriksaan ini, seluruh selisih bisa saja
  hanyalah beda tambalan Laravel.
- **Dua indeks milik branch ini ditambahkan ke B.** `2026_11_02_160528_add_performance_indexes`
  tidak ada di `main`. Membiarkannya berarti B diukur tanpa indeks dan A menang karena
  sebab yang tidak ada hubungannya dengan tenancy. Setelah penambahan, indeks
  `invoices`/`payments`/`bank_transactions` **identik** di kedua database (diperiksa
  dengan `SHOW INDEX`). Arah penyetaraan ini merugikan A — itu disengaja.

### Mekanisme pencacah

`docs/perf/perf-e-request.php` menangani **satu request per proses PHP**: ia membangun
`Illuminate\Http\Request`, mengikatnya ke container, membootstrap HTTP kernel,
memasang `DB::listen()`, lalu memanggil `$kernel->handle()`. Jadi yang terukur adalah
seluruh siklus request — global middleware, `InitializeTenancyByPath`, bootstrapper
tenancy, `SetPermissionsTeam`, gerbang `can:`, controller, dan
`HandleInertiaRequests::share()` — bukan hanya controller.

Satu proses per request, bukan satu proses untuk banyak request, karena PHP-FPM
membooting framework dari nol di setiap request. Mengulang `handle()` dalam satu proses
akan mewarisi container, konfigurasi, koneksi PDO, dan cache permission dari request
sebelumnya; justru bagian "biaya per-request" yang sedang diselidiki yang hilang.

Login dilakukan dengan `$app['auth']->guard()->setUser($user)` — mekanisme yang sama
dengan `actingAs()` milik Laravel. Query `User::find()` milik harness dibuang dari
hitungan.

**Temuan sampingan dari harness.** `AppServiceProvider::boot()` memanggil
`session('locale')` dan `auth()->check()`. Keduanya dievaluasi pada fase bootstrap,
yaitu **sebelum** `StartSession` berjalan, sehingga di HTTP nyata sesi belum ada dan
`auth()->check()` **selalu** `false`. Artinya cabang "pakai locale pilihan user" di
`AppServiceProvider` adalah kode mati di jalur HTTP (locale sebenarnya diurus
`SetLocale`). Bukan masalah performa besar, tapi menyesatkan siapa pun yang membacanya.
Konsekuensi teknisnya: skrip ukur harus mengikat `request` ke container **sebelum**
`$kernel->bootstrap()`, kalau tidak guard sesi melempar `TypeError`.

### Pengulangan

Setiap halaman diukur **7 kali**. Iterasi pertama dibuang dan dilaporkan terpisah
sebagai `handle_ms_dingin` di CSV (cache permission Redis kosong, koneksi pertama).
Angka di tabel adalah **median 6 iterasi hangat**.

### Dua varian OPcache

CLI PHP di mesin ini berjalan **tanpa OPcache** (`opcache.enable_cli=Off`), sehingga
setiap proses mem-parsing ulang ±9 MB PHP. Produksi tidak begitu. Karena itu setiap
kondisi diukur dua kali: apa adanya, dan dengan
`opcache.file_cache_only=1` (opcode dibaca dari disk, tidak di-parse ulang) sebagai
pengganti terdekat PHP-FPM ber-OPcache. OPcache memori-bersama milik PHP-FPM masih
lebih cepat dari keduanya — **tidak diukur**.

### Reproduksi

```bash
# siapkan
php artisan migrate --force                               # DB_DATABASE=perf_central
php artisan db:seed --class=MasterPermissionSeeder --force
php artisan central:bootstrap --organization="Perf E Org" --quota=20 \
  --name="Admin Perf" --email=admin@perf-e.test --password='PerfE2026#' \
  --company="Perf A" --slug=perfa --abbreviation=PFA --no-interaction
php docs/perf/perf-e-seed.php --business=tenant_perfa --auth=perf_central

# ukur  (semua perintah di atas & di bawah diawali:
#        SESSION_COOKIE=perf_e_session CACHE_PREFIX=perf_e_ DB_DATABASE=perf_central)
php docs/perf/perf-e-ukur.php --kondisi=A --ulang=7 --appenv=production \
  --base=D:/tmp/perf-e-branch --tag=a-prod
php docs/perf/perf-e-ukur.php --kondisi=B --ulang=7 --appenv=production --tag=b-prod

# varian pembanding
php docs/perf/perf-e-ukur.php --kondisi=A --ulang=7 --appenv=local   --base=D:/tmp/perf-e-branch --tag=a-local
php docs/perf/perf-e-ukur.php --kondisi=A --ulang=7 --appenv=production   --base=D:/tmp/perf-e-branch --opcache=D:/tmp/perf-e-opc --tag=a-prod-opcache

# pembedahan biaya tenancy di dalam satu basis kode
php docs/perf/perf-e-biaya-middleware.php --slug=perfa --ulang=30
php docs/perf/perf-e-biaya-tenancy.php    --slug=perfa --ulang=20

# daftar SQL satu halaman, untuk membandingkan query baris per baris
php docs/perf/perf-e-request.php --base=D:/tmp/perf-e-branch   --url=http://127.0.0.1:8102/c/perfa/invoices   --dump-sql=storage/perf-e/sql-a-invoices.txt
```

### Berkas hasil

| Berkas | Isi |
|---|---|
| `storage/perf-e/perbandingan-a-b.csv` | tabel §3 dalam bentuk mesin, A vs B + selisih |
| `kondisi-{a-local,a-prod,a-prod-opcache,b-prod,b-prod-opcache}.csv` | ringkasan per halaman per varian |
| `kondisi-*-mentah.jsonl` | **setiap** request, satu baris JSON (7 per halaman) |
| `biaya-middleware.csv` | 30 pasang pipeline tanpa/dengan tenancy |
| `biaya-tenancy.csv` | 20 iterasi PDO connect / `initialize()` / permission team |
| `profit-loss-skala.jsonl` | laba rugi pada 5 ukuran periode |
| `split-fw-sama.jsonl` | ulangan A/B setelah versi framework disamakan |
| `files-vs-time.jsonl` | korelasi jumlah berkas PHP vs waktu handle |
| `head-vs-pinned.jsonl` | commit `ee37a32` vs working tree saat pengukuran |
| `sql-{a,b}-invoices.txt`, `sql-a-profit-loss.txt` | daftar SQL lengkap satu request |
| `provisioning.csv` | 8 perusahaan, waktu per tahap (Gerbang 5) |

Semua skrip punya penjaga (`docs/perf/perf-e-guard.php`) yang **menolak** database yang
namanya bukan `perf_*` atau `tenant_perf*`. Dibuktikan untuk keempat skrip
(`perf-e-seed`, `perf-e-ukur`, `perf-e-provisioning`, `perf-e-biaya-middleware`):
dijalankan terhadap `finance_main_dev`, semuanya berhenti dengan kode keluar 2 tanpa
menyentuh apa pun.

---

## 2. Data uji (E.2) — dan bukti kedua kondisi identik

| Tabel | Baris | | Tabel | Baris |
|---|---|---|---|---|
| clients | 50 | | reimbursements | 100 |
| services | 10 | | fund_requests | 50 |
| bank_accounts | 5 | | fund_request_items | 100 |
| invoices | 200 | | loans | 20 |
| invoice_items | 500 | | loan_payments | 60 |
| payments | 190 | | receivables | 20 |
| bank_transactions | 500 | | receivable_payments | 40 |
| transaction_categories | 28 | | users (DB auth) | 5 |

Invoice tersebar rata di 364 hari terakhir; status `draft` 10 %, `sent` 10 %,
`partially_paid` 20 %, `paid` 60 %; 1–4 item per invoice; sebagian dibayar dua kali.

**Cara memastikan A dan B berisi data yang sama:** satu skrip
(`docs/perf/perf-e-seed.php`) dengan benih acak tetap (`mt_srand(20261102)`) menulis ke
kedua database. Buktinya sidik jari isi tabel, bukan sekadar jumlah baris:

| | `tenant_perfa` | `perf_single` |
|---|---|---|
| MD5 `invoices(id,total_amount,status,issue_date)` | `55321e72e0685d25481f2fd682eaa221` | `55321e72e0685d25481f2fd682eaa221` |
| MD5 `bank_transactions(id,amount,type,date)` | `e848eb9a8b2f65984987c6fd8927c98f` | `e848eb9a8b2f65984987c6fd8927c98f` |

Sama persis.

---

## 3. Tabel utama — A vs B per halaman

`APP_ENV=production`, `APP_DEBUG=false`, 10 perusahaan terdaftar, median 6 iterasi
hangat. `q` = jumlah query, `handle` = waktu `$kernel->handle()`.
Sumber: `storage/perf-e/perbandingan-a-b.csv`.

### 3a. Tanpa OPcache (mendekati server tanpa OPcache)

| Halaman | A q | A handle | A db | B q | B handle | B db | Δq | Δhandle |
|---|---|---|---|---|---|---|---|---|
| `/login` (tamu, HTML) | 0 | 110,9 ms | 0 ms | 1 | 122,8 ms | 3,2 ms | −1 | **−11,9 ms** |
| dashboard | 50 | 204,0 ms | 32,8 ms | 94 | 209,4 ms | 48,0 ms | **−44** | −5,4 ms |
| invoices | 27 | 166,1 ms | 15,6 ms | 24 | 128,0 ms | 12,7 ms | +3 | +38,1 ms |
| bank-accounts | 22 | 202,2 ms | 16,2 ms | 19 | 175,5 ms | 13,3 ms | +3 | +26,7 ms |
| cash-flow (redirect 302) | 4 | 116,9 ms | 2,4 ms | 3 | 100,2 ms | 1,9 ms | +1 | +16,7 ms |
| cash-flow/income | 19 | 167,2 ms | 18,4 ms | 16 | 134,9 ms | 15,9 ms | +3 | +32,3 ms |
| cash-flow/expenses | 19 | 162,3 ms | 12,9 ms | 16 | 123,6 ms | 9,7 ms | +3 | +38,7 ms |
| cash-flow/transfers | 18 | 152,1 ms | 10,3 ms | 15 | 122,0 ms | 7,2 ms | +3 | +30,0 ms |
| reimbursements | 17 | 159,3 ms | 10,4 ms | 14 | 114,0 ms | 7,0 ms | +3 | +45,3 ms |
| fund-requests | 34 | 193,5 ms | 21,8 ms | 30 | 163,6 ms | 17,6 ms | +4 | +29,9 ms |
| clients | 19 | 158,0 ms | 11,1 ms | 16 | 129,4 ms | 7,8 ms | +3 | +28,7 ms |
| **reports/profit-loss (YTD)** | **297** | **357,8 ms** | **130,3 ms** | **294** | **317,6 ms** | **126,1 ms** | +3 | +40,2 ms |
| choose-company | 7 | 113,0 ms | 2,6 ms | — | — | — | hanya A | hanya A |
| dashboard (HTML penuh) | 50 | 238,7 ms | 31,2 ms | 95 | 239,5 ms | 48,3 ms | −45 | −0,8 ms |

### 3b. Dengan OPcache file-cache (lebih dekat ke produksi)

| Halaman | A q | A handle | B q | B handle | Δhandle |
|---|---|---|---|---|---|
| `/login` | 0 | 94,6 ms | 1 | 110,7 ms | −16,1 ms |
| dashboard | 50 | 200,8 ms | 94 | 186,0 ms | +14,7 ms |
| invoices | 27 | 149,4 ms | 24 | 115,0 ms | +34,4 ms |
| bank-accounts | 22 | 202,0 ms | 19 | 146,1 ms | +56,0 ms |
| cash-flow | 4 | 112,8 ms | 3 | 90,0 ms | +22,9 ms |
| cash-flow/income | 19 | 150,2 ms | 16 | 120,5 ms | +29,6 ms |
| cash-flow/expenses | 19 | 149,9 ms | 16 | 112,7 ms | +37,3 ms |
| cash-flow/transfers | 18 | 139,2 ms | 15 | 107,9 ms | +31,3 ms |
| reimbursements | 17 | 143,2 ms | 14 | 105,1 ms | +38,1 ms |
| fund-requests | 34 | 183,9 ms | 30 | 144,2 ms | +39,8 ms |
| clients | 19 | 145,2 ms | 16 | 102,3 ms | +42,9 ms |
| reports/profit-loss | 297 | 326,8 ms | 294 | 302,8 ms | +24,0 ms |
| dashboard (HTML) | 50 | 201,0 ms | 95 | 202,8 ms | −1,8 ms |

Puncak memori: A 46–52 MB, B 50–56 MB (`peak_mb` di CSV) — tenancy **tidak** menaikkan
pemakaian memori; B justru sedikit lebih tinggi pada dashboard karena N+1 saldonya.

---

## 4. Jawaban atas lima pertanyaan Gerbang 4

### 4.1 Berapa tambahan query per request yang murni dari tenancy?

**+3 query per request halaman yang sudah login** (`APP_ENV=production`).
Diambil dari `storage/perf-e/sql-a-invoices.txt` vs `sql-b-invoices.txt` — bukan dari
pengurangan angka, tetapi dari membandingkan daftar SQL baris per baris:

| # | SQL | Asal |
|---|---|---|
| 1 | `select * from companies where id = ? limit 1` | `InitializeTenancyByPath` (resolver tenant) |
| 2 | `select exists(select * from companies inner join company_user on … where company_user.user_id = ? and companies.id = ?)` | `EnsureUserBelongsToCompany` |
| 3 | `select companies.id, name, abbreviation, … from companies inner join company_user … where company_user.user_id = ? and status = ?` | prop `companies` di `HandleInertiaRequests::share()` |

**Query keempat yang hanya muncul di `APP_ENV=local`:**

```sql
SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'tenant_perfa'
```

Sumbernya `vendor/stancl/tenancy/src/Bootstrappers/DatabaseTenancyBootstrapper.php:28`,
dibungkus `if (app()->environment('local'))`. Terbukti dari pengukuran pada worktree dan
data yang sama, hanya `APP_ENV` yang berbeda: `kondisi-a-local` **28** query untuk
`/invoices`, `kondisi-a-prod` **27**. **Jadi jangan pernah
menjalankan produksi dengan `APP_ENV=local`** — selain menyalakan
`Model::preventLazyLoading`, ia menambahkan satu query `information_schema`
(tabel non-InnoDB, tidak ter-cache) di setiap request.

Yang **tidak** bertambah: jumlah query permission. A dan B sama-sama 3 query
(`model_has_permissions`, `model_has_roles`, `role_has_permissions`). Mode *team*
Spatie hanya menambahkan kolom `company_id` pada `WHERE`, bukan query baru.

### 4.2 Berapa tambahan waktu dinding per request karena tenancy?

Dua angka, dan keduanya perlu dibaca bersama.

**(a) Diukur langsung, di dalam satu basis kode: +2,33 ms.**
`docs/perf/perf-e-biaya-middleware.php` menjalankan pipeline middleware **produksi**
terhadap route tiruan, 30× bolak-balik, sekali tanpa rantai tenancy dan sekali dengan:

| | median | query |
|---|---|---|
| `['auth','verified']` | 0,40 ms | 0 |
| `['auth','verified', InitializeTenancyByPath, EnsureUserBelongsToCompany, SetPermissionsTeam, SetCompanyUrlDefaults]` | 2,73 ms | 2 |
| **selisih** | **+2,33 ms** | **+2** |

Rinciannya (`docs/perf/perf-e-biaya-tenancy.php`, 20 iterasi):

| Tahap | median |
|---|---|
| `new PDO` ke database tenant | **0,81 ms** |
| `tenancy()->initialize()` + query pertama (semua bootstrapper) | **1,99 ms** |
| `setPermissionsTeamId()` + `getAllPermissions()` (cache kosong, 3 query, 77 izin) | 9,62 ms |

Baris ketiga **bukan** biaya tenancy — `main` membayar 8,48 ms untuk hal yang sama
(75 izin, tanpa team). Mode team hanya menambah **0,8 ms**.

**(b) Selisih ujung-ke-ujung A−B: +24 s.d. +56 ms.** Ini angka yang akan dirasakan
kalau branch ini menggantikan `main` hari ini — tetapi **bukan** biaya tenancy, dan
berikut buktinya:

| Yang diperiksa | Hasil |
|---|---|
| Beda versi framework? | **Bukan.** B dinaikkan ke 12.70.2, selisih tidak berubah. |
| Beda waktu database? | Hanya **+2 s.d. +4 ms** (kolom `db` di tabel 3a). |
| Middleware tenancy? | **+2,33 ms** (diukur di atas). |
| Controller + render Inertia? | **Tidak ada beda.** Diukur hangat dalam satu proses: A **6,93 ms**, B **7,59 ms** — A lebih cepat. |
| Di mana selisihnya muncul? | Seluruhnya **setelah `RouteMatched`**: A `sampai_match` 13,9 ms / `setelah_match` 132,9 ms; B 13,1 ms / 94,1 ms. |

Penjelasan yang didukung angka: **jumlah berkas PHP yang dimuat per request.**

| | berkas dimuat saat `handle()` | total berkas | total PHP di-`require` |
|---|---|---|---|
| A `/c/perfa/clients` | 359 | 1042 | 9,05 MB |
| B `/clients` | 307 | 976 | 8,79 MB |

Selisih bersih **+52 berkas**: 22 dari `vendor/stancl/tenancy`, 29 dari
`laravel/framework` (koneksi kedua, `DatabaseManager`), 3 model, 3 middleware,
`stancl/virtualcolumn`, `laravel/serializable-closure`.

Biaya marjinal per berkas, diukur di dalam masing-masing basis kode:

| Branch A | berkas saat handle | handle |
|---|---|---|
| `/login` | 253 | 87,1 ms |
| `/choose-company` | 256 | 92,5 ms |
| `/c/perfa/clients` | 359 | 168,5 ms |

Kemiringan A: (168,5 − 92,5) / (359 − 256) = **0,74 ms per berkas**.
Kemiringan B: (141,0 − 78,5) / (307 − 237) = **0,89 ms per berkas**.
52 berkas × ≈0,8 ms ≈ **42 ms** — sebesar selisih yang terlihat.

**Konsekuensinya:** biaya ini dibayar sekali per proses PHP untuk memuat & menautkan
kelas. Dengan OPcache memori-bersama (PHP-FPM yang dikonfigurasi benar), opcode-nya
sudah ada di memori dan yang tersisa hanya autoload + class linking. Berapa sisanya di
Linux dengan OPcache SHM: **tidak diukur** — mesin uji ini Windows, CLI, OPcache
file-cache. Yang bisa dinyatakan dengan yakin: **selisih 24–56 ms itu bukan biaya
database dan bukan biaya tenancy per se**, dan `/login` — yang tidak menyentuh tenancy —
justru **11–16 ms lebih cepat** di branch ini.

### 4.3 Halaman mana paling buruk, dan query mana yang paling banyak diulang?

**Paling buruk, jauh: laporan laba rugi.** 297 query, 130 ms waktu database,
327–358 ms handle. Dua pola ini sendirian **272 dari 297 query (92 %)**:

```sql
select sum(`amount`) as aggregate from `payments` where `invoice_id` = ? and `payment_date` <= ?   -- 136×
select sum(`amount`) as aggregate from `payments` where `invoice_id` = ? and `payment_date` <  ?   -- 136×
```

Sumber: `app/Services/ProfitLossService.php:141` dan `:145`. Lihat 4.4.

**Kedua: dashboard — tapi di `main`, bukan di sini.** `main` menjalankan:

```sql
select sum(`amount`) as aggregate from `bank_transactions` where `bank_transactions`.`bank_account_id` = ? …   -- 30×
select sum(`amount`) as aggregate from `payments` where `payments`.`bank_account_id` = ? …                      -- 15×
```

45 query untuk 5 rekening — itu accessor saldo lewat `$appends`, dipanggil ulang setiap
serialisasi. Branch ini sudah menggantinya dengan `BankAccount::withBalance()`, dan
hasilnya **50 query lawan 94**. Jadi untuk dashboard, tenancy bukan hanya tidak
memperburuk — branch ini **memperbaiki** keadaan.

**N+1 yang masih hidup di branch ini**, dashboard:

```sql
select sum(`amount`) as aggregate from `payments` where `invoice_id` = ?   -- 5× (satu per invoice tertunda)
```

Lima query karena daftar invoice tertunda di dashboard dibatasi lima baris. Tumbuh
dengan panjang daftar itu, bukan dengan jumlah invoice.

**Catatan metodologi yang penting.** Pencacah duplikat harus punya DUA definisi, kalau
tidak N+1 tidak akan pernah terlihat:

- `duplikat` — SQL **dan** bindings identik. Laba rugi: **0**.
- `pola_terulang` — SQL identik, bindings berbeda. Laba rugi: **278**.

Mengukur hanya yang pertama akan menyimpulkan laporan laba rugi "bersih".

### 4.4 Apakah N+1 di `ProfitLossService::invoiceContributions()` masih ada?

**Masih ada. Premis spec BENAR.** `app/Services/ProfitLossService.php` baris 141–147
menjalankan dua `Payment::sum()` di dalam loop per invoice.

Rumus terukur: **2N + ≈22 query**, N = jumlah invoice yang punya pembayaran di periode.
Bukan 2N+11 seperti catatan rencana lama, dan konstantanya tergantung jumlah kategori.

| Periode | Invoice ikut | Query | Waktu DB | handle |
|---|---|---|---|---|
| 2020 (tanpa data) | 0 | 22 | 27,5 ms | 214,8 ms |
| 1 Okt – 2 Nov 2026 | ≈16 | 55 | 27,5 ms | 199,3 ms |
| 1 Jul – 2 Nov 2026 | ≈58 | 139 | 59,7 ms | 237,1 ms |
| **1 Jan – 2 Nov 2026 (YTD)** | **136** | **298** | **134,5 ms** | 357,8 ms † |
| 1 Nov 2025 – 2 Nov 2026 | ≈160 | 343 | 166,5 ms | 443,8 ms |

† median dari seri `kondisi-a-prod` (7 iterasi); seri skala di
`profit-loss-skala.jsonl` hanya 3 iterasi dan satu di antaranya 627 ms.

Linear sempurna. Dengan **200 invoice** aktif setahun → ±420 query per pembukaan
laporan. Satu perusahaan dengan 2.000 invoice/tahun → ±4.000 query dalam satu request.

Keduanya bisa dihapus sepenuhnya dengan dua query agregat
(`GROUP BY invoice_id` untuk `<= end` dan untuk `< start`) — **dari 298 jadi 26 query**,
dan dari 134 ms waktu DB jadi diperkirakan <10 ms (**angka sesudah: dugaan, belum
diukur**; angka 298 → 26 adalah hitungan pasti dari pola yang tercatat).

### 4.5 Apakah `HandleInertiaRequests::share()` mengirim ±75 permission di setiap navigasi?

**Setengah benar, dan bagian yang salah justru penting.**

**Yang benar:** pada navigasi penuh, prop `auth` berisi 77 nama permission dan
berukuran **1.594 byte dari 6.717 byte total props (±24 %)** pada `/clients`.

**Yang salah:** "termasuk partial reload, karena dipasang sebagai closure biasa, bukan
lazy". Di branch ini `permissions` dan `roles` **adalah** closure
(`HandleInertiaRequests.php:49–50`), dan Inertia menyaring props **sebelum** menyelesaikan
closure. Diukur pada `/c/perfa/clients`:

Tabel di bawah diukur saat baru ada **1 perusahaan** (sebelum Gerbang 5 menambah
sampai 10), supaya prop `companies` tidak mengaburkan perbandingan:

| | query | props | kunci props yang terkirim |
|---|---|---|---|
| A navigasi penuh | 19 | 6.717 B | clients, auth, filters, flash, companies, company, stats, actionCounts, notifications, locale, errors |
| A partial `only=clients` | **11** | **4.641 B** | clients, errors |
| B navigasi penuh | 16 | 6.433 B | clients, auth, filters, flash, stats, actionCounts, notifications, locale, errors |
| B partial `only=clients` | 10 | 4.533 B | clients, errors |

Partial reload menghemat 8 query dan 2.076 byte. Di `main`, `permissions` masih nilai
eager (`$user->getAllPermissions()` dieksekusi di `share()`), jadi `main` tetap
**menghitung** 75 permission pada partial reload walaupun tidak mengirimnya — branch
ini tidak. Jadi untuk butir ini branch ini **lebih baik** daripada `main`.

Query yang hilang saat partial reload — yaitu yang benar-benar dipicu `share()` —
ada **8**, terbaca urut di `storage/perf-e/sql-a-invoices.txt` baris 21–28:

| # | query | prop |
|---|---|---|
| 21 | `role_has_permissions` (daftar izin per role) | `auth.permissions` |
| 22 | `companies` ∞ `company_user` | `companies` |
| 23–24 | `app_notifications` (10 terbaru + `COUNT(*)` belum dibaca) | `notifications` |
| 25–28 | 4× `COUNT(*)` — `reimbursements` pending/approved, `fund_requests` pending/approved | `actionCounts` |

Jadi `actionCounts` sendirian menjalankan **4 `COUNT(*)` di database tenant pada SETIAP
navigasi penuh**, hanya untuk angka kecil di sidebar.

Prop termahal bukan `auth`, melainkan data halaman: `fund-requests` 17.749 byte,
`cash-flow/income` 12.824 byte, `cash-flow/expenses` 10.667 byte.

**Prop `companies` tumbuh linear dengan jumlah perusahaan:** 55 byte saat ada 1
perusahaan, 549 byte saat ada 10 (±55 byte/perusahaan), tanpa tambahan query. Lihat
Gerbang 5 §5.

---

## 5. Hal lain yang terukur dan layak dicatat

1. **`APP_ENV=local` di produksi mahal.** Selain satu query `information_schema` per
   request (4.1), `handle` turun **23–30 %** saat `APP_ENV=production` — diukur pada
   worktree, database, dan data yang sama, hanya `APP_ENV` yang berbeda
   (`kondisi-a-local.csv` vs `kondisi-a-prod.csv`):

   | Halaman | `APP_ENV=local` | `APP_ENV=production` | selisih |
   |---|---|---|---|
   | invoices | 28 q / 235,9 ms | 27 q / 166,1 ms | −1 q / **−29,6 %** |
   | clients | 20 q / 206,8 ms | 19 q / 158,0 ms | −1 q / **−23,6 %** |
   | dashboard | 51 q / 253,9 ms | 50 q / 204,0 ms | −1 q / **−19,7 %** |
   | reimbursements | 18 q / 190,0 ms | 17 q / 159,3 ms | −1 q / −16,2 % |

   Penyebabnya `Model::preventLazyLoading(! isProduction())` di `AppServiceProvider`
   dan penanganan error debug.
2. **SSR Inertia memang mati.** `config/inertia.php` memaksa default `false`. Tidak ada
   satu pun request dalam ±1.400 pengukuran yang menggantung, dan tidak ada POST ke
   `127.0.0.1:13714`. Kalau gejala 300 detik itu muncul lagi, berarti ada yang
   menyalakannya kembali.
3. **Resolver tenant TIDAK di-cache.** `PathTenantResolver` mewarisi
   `CachedTenantResolver`, tetapi query `select * from companies where id = ?` tetap
   muncul di setiap request — jadi caching-nya tidak aktif. Menyalakannya menghapus
   1 dari 3 query tenancy.
4. **Perubahan cakupan central dari coordinator netral.** Diukur terhadap working tree
   yang berisi `AppNotification::forCurrentCompany()` dkk., dibandingkan commit
   `ee37a32`: `clients` 19 query / 7.211 B props pada keduanya, `dashboard` 50 query /
   6.471 B pada keduanya, handle dalam rentang derau
   (`storage/perf-e/head-vs-pinned.jsonl`).
5. **`public/hot` tidak mempengaruhi angka di dokumen ini.** Berkas itu tidak pernah ada
   di kedua worktree pengukuran (keduanya `git worktree` baru; `public/hot` di-gitignore).

---

## 6. Batas pengukuran ini — supaya tidak dikutip melebihi isinya

| Batas | Dampak |
|---|---|
| Windows 11, MySQL 8.0.45 lokal, PHP 8.5.4 CLI tanpa OPcache SHM | Waktu dinding absolut tidak bisa dipindahkan ke VPS Linux. Jumlah query bisa. |
| Server MySQL ini dipakai bersama ±20 database lain | `Opened_tables` 58.725 vs `Open_tables` 2.804 — cache tabel sudah berputar sebelum pengukuran dimulai. |
| `file_cache_only` bukan OPcache memori-bersama | Varian "dengan OPcache" masih lebih lambat daripada PHP-FPM yang benar. |
| Satu request pada satu waktu, tanpa beban bersamaan | Tidak mengukur perilaku di bawah 2 vCPU yang jenuh. **Tidak diukur.** |
| `main` punya 3 migrasi lebih sedikit | Dua indeks performa sudah ditambahkan manual ke `perf_single`; `restrict_cascade_on_financial_foreign_keys` dan `widen_receivable_interest_rate_precision` tidak — keduanya tidak menyentuh jalur baca. |
| Satu user, satu peran (admin, 77 izin) | Staff dengan 21 izin akan punya props lebih kecil. **Tidak diukur.** |

---

## 7. Penilaian jujur (E.4)

> **Kalau branch ini dideploy ke VPS 2 vCPU yang sudah berisi ±20 site, apakah gejala
> "semua halaman lambat" akan terulang?**

**Tidak — bukan karena tenancy.** Gejala "semua halaman" tidak bisa dijelaskan oleh
biaya tenancy yang terukur, dan dua penyebab yang jauh lebih besar sudah diperbaiki di
branch ini.

Alasannya, dengan angka:

1. Biaya tenancy per request yang terukur adalah **+3 query dan +2,3 ms**. Pada halaman
   yang totalnya 100–200 ms, itu **1–2 %**. Tidak ada mekanisme yang membuatnya
   membengkak: resolusi tenant memakai primary key, cek keanggotaan memakai dua kunci,
   dan membuka koneksi kedua hanya **0,81 ms**.
2. Dashboard — halaman yang pertama dibuka semua orang — justru **44 query lebih
   sedikit** di branch ini (50 vs 94). N+1 saldo rekening di `main` (30 + 15 query
   agregat untuk 5 rekening) sudah hilang di sini.
3. SSR Inertia, satu-satunya mekanisme yang benar-benar bisa membuat **semua** halaman
   lambat secara seragam (POST ke `127.0.0.1:13714` yang tidak dijawab, pernah
   menggantung 300 detik), sudah dimatikan di `config/inertia.php`, bukan hanya di
   `.env`. Tidak ada satu pun dari ±1.400 request pengukuran yang menggantung.

**Tapi ada dua jebakan yang bisa membuat gejala itu kembali, dan keduanya bukan
tenancy:**

- **`APP_ENV` bukan `production`.** Terukur: +1 query `information_schema` per request
  plus `Model::preventLazyLoading` aktif; `handle` turun **23–30 %** begitu
  `APP_ENV=production` (invoices 235,9 → 166,1 ms; tabel lengkap di §5.1). Catatan
  2 November menyebut `APP_DEBUG=true` di produksi — periksa juga `APP_ENV` di sana.
- **OPcache mati atau terlalu kecil.** Setiap request tenant memuat **1.042 berkas PHP
  (9,05 MB)**. Tanpa OPcache, itu di-parse ulang setiap kali. Di mesin uji biayanya
  **0,74–0,89 ms per berkas**; itulah seluruh selisih 24–56 ms antara branch ini dan
  `main`. Ini satu-satunya tempat tenancy membuat keadaan terukur lebih buruk — dan
  obatnya konfigurasi, bukan arsitektur.

### Pemisahan biaya

#### A. Melekat pada tenancy (hilang kalau arsitekturnya diganti)

| Biaya | Angka terukur |
|---|---|
| Resolusi tenant (`select * from companies where id = ?`) | 1 query |
| Cek keanggotaan (`EnsureUserBelongsToCompany`) | 1 query |
| Prop `companies` di `share()` | 1 query, 55 B/perusahaan |
| Seluruh rantai middleware tenancy | **+2,33 ms** |
| Koneksi PDO kedua | 0,81 ms (bagian dari 2,33 ms di atas) |
| 52 berkas kelas PHP tambahan per request | ±42 ms **tanpa** OPcache; dengan OPcache SHM **tidak diukur** |
| Query `information_schema` per request **jika `APP_ENV=local`** | 1 query |
| Provisioning perusahaan baru | 10,8 s median (94 % migration) |
| `tenants:migrate` per deploy | ±0,15 s per perusahaan |
| 22 tabel InnoDB per perusahaan | ambang `table_definition_cache` di ±40 perusahaan pada server sepadat mesin uji |

**Total biaya runtime yang melekat pada tenancy: +3 query dan +2,3 ms per request.**
Selebihnya biaya operasional (provisioning, deploy, kapasitas MySQL), bukan biaya
per-request.

#### B. Akan tetap ada di arsitektur apa pun

| Biaya | Angka terukur |
|---|---|
| **N+1 `ProfitLossService::invoiceContributions()`** | **2N+22 query**; 200 invoice → 297 query, 130 ms DB. Ada juga di `main` (294 query). |
| Resolusi permission Spatie per request | 3 query + **8,5–9,3 ms**, untuk 75–77 izin. Mode team hanya +0,8 ms. |
| `actionCounts` di `share()` | **4 `COUNT(*)`** di setiap navigasi penuh, demi angka di sidebar |
| Notifikasi di `share()` | 2 query di setiap navigasi penuh |
| Props gemuk | `fund-requests` 17,7 KB; `cash-flow/income` 12,8 KB; `auth` 1,6 KB (77 nama izin) |
| N+1 kecil di dashboard | 5× `sum(amount) … where invoice_id = ?` |
| `AppServiceProvider::boot()` membaca sesi & auth sebelum `StartSession` | kode mati, biaya kecil, membingungkan |
| Route tidak ter-cache | `route:cache` berhasil di branch ini; dampaknya **tidak diukur** |

#### C. Infrastruktur

| Biaya | Catatan |
|---|---|
| OPcache | Penentu terbesar waktu dinding yang terukur di sini: `boot` 500 → 330 ms hanya dengan OPcache file-cache. SHM lebih cepat lagi — tidak diukur. |
| `table_definition_cache` 2000 | 22 tabel/perusahaan; mulai thrashing ±40 perusahaan pada server sepadat mesin uji (1.078 tabel site lain). `Opened_tables` 58.725 vs `Open_tables` 2.804 → cache sudah berputar. |
| Redis untuk cache + sesi | Sudah dipakai (`CACHE_STORE=redis`, `SESSION_DRIVER=redis`). Kalau jatuh ke `database`, cache & sesi menambah query ke MySQL yang sama — **tidak diukur**. |
| `innodb_buffer_pool_size` 128 MB vs 11,27 MB data | Berlebih; bukan hambatan. Sejalan dengan temuan "hambatan CPU, bukan I/O". |
| Jumlah pool PHP-FPM di 2 vCPU | **Tidak diukur.** Pengukuran ini satu request pada satu waktu. |

### Usulan perbaikan, diurutkan (dampak terukur ÷ ongkos)

| # | Perbaikan | Dari → jadi | Ongkos | Diukur? |
|---|---|---|---|---|
| 1 | **Ganti loop `Payment::sum()` di `ProfitLossService` dengan dua agregat `GROUP BY invoice_id`** | **298 → 26 query** per pembukaan laporan; 130 ms DB → **<10 ms (dugaan)** | ±20 baris di satu service | Jumlah query: **ya, pasti**. Waktu sesudah: dugaan. |
| 2 | **Pastikan `APP_ENV=production` + `APP_DEBUG=false` di VPS** | `handle` **−23 s.d. −30 %** (invoices 235,9 → 166,1 ms); **−1 query** per request | satu baris `.env` | **Ya** |
| 3 | **Pastikan OPcache menyala dengan `memory_consumption` cukup untuk 9 MB** | `boot` **500 → 330 ms**; selisih 24–56 ms A−B sebagian/seluruhnya hilang | satu blok `php.ini` | Sebagian (file-cache). SHM: dugaan. |
| 4 | **`table_definition_cache`/`table_open_cache` → 8000** | menggeser ambang thrashing dari ±40 ke ±170 perusahaan | satu baris `my.cnf` + restart | Hitungan, bukan ukuran |
| 5 | **Jadikan `actionCounts` dan `notifications` prop *deferred* Inertia** | **−6 query** per navigasi penuh (19 → 13 pada `/clients`) | dua baris di `share()` + penyesuaian frontend | **Ya** (angka diambil dari selisih navigasi penuh vs partial reload) |
| 6 | **Nyalakan cache resolver tenant (`PathTenantResolver` sudah mewarisi `CachedTenantResolver`)** | **−1 query** per request (3 → 2 biaya tenancy) | konfigurasi; perlu invalidasi saat perusahaan di-nonaktifkan | Jumlah query: ya. Waktu: <1 ms, dalam derau. |
| 7 | **Pindahkan provisioning ke antrean (`shouldBeQueued(true)`)** | request `/admin/companies` **10,8 s → <100 ms (dugaan)**; pengguna dapat status `provisioning` | satu baris + UI polling | Dugaan |
| 8 | **Perbaiki 5× `payments.sum` per invoice tertunda di dashboard** | **−4 query** (50 → 46) | satu eager-load | **Ya** |
| 9 | **`route:cache` + `config:cache` saat deploy** | **tidak diukur** — tidak bisa dijalankan di repo bersama tanpa merusak worker lain | satu baris di `deploy.sh` | **Tidak diukur** |
| 10 | **Kurangi props `fund-requests` (17,7 KB) dan `cash-flow/income` (12,8 KB)** | payload per navigasi; dampak pada `handle` **tidak diukur** | perubahan controller + frontend | **Tidak diukur** |

Nomor 1 sendirian lebih besar daripada seluruh biaya tenancy dikalikan sepuluh. Kalau
hanya satu hal yang boleh dikerjakan, kerjakan nomor 1.

### Yang TIDAK saya ukur, dan karenanya tidak saya klaim

- Perilaku di bawah beban bersamaan pada 2 vCPU. Semua pengukuran satu request per waktu.
- Waktu dinding di Linux dengan OPcache memori-bersama.
- Dampak `route:cache`/`config:cache`.
- Dampak cache atau sesi di MySQL (kedua kondisi memakai Redis).
- Props/izin untuk peran `staff` (21 izin) dan `finance manager` (70 izin).
- Jumlah tabel InnoDB di VPS produksi.
