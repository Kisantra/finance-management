# Multi-Tenancy Opsi B — Progres Implementasi

Catatan perjalanan migrasi ke arsitektur database-per-perusahaan
([keputusan final](MultiTenancyKeputusanFinal.pdf), [runbook](multi-tenancy-runbook-eksekusi.md)):
apa yang **sudah selesai**, apa yang **berubah di codebase**, dan apa yang **berikutnya**.

Terakhir diperbarui: **11 Agustus 2026** — Tahap 0–4 selesai; suite 432 test hijau.
Yang tersisa sebelum menerima pelanggan: **go-live (§G runbook)** + pengukuran version
drift deployment lama (0.3, manual).

---

## Peta Status

| Tahap | Isi | Status |
|---|---|---|
| 0 | Beresi dulu: bug kolom `code`, test/CI → MySQL, keamanan `/api`, storage | ✅ Selesai (kecuali 0.3, lihat bawah) |
| 1 | Database pusat: organizations/companies/company_user + Spatie teams | ✅ Selesai |
| 2 | Routing `/c/{company}`, pemilih perusahaan, frontend, pemisahan migration | ✅ Selesai + smoke test live |
| 3 | Efek samping: queue/cache/storage/scheduler | ✅ Selesai (scheduler → `tenants:run`; queue audit bersih) |
| 4 | Alat operasional: provisioning UI, backup, canary, monitoring | ✅ Selesai |
| 5 | Hapus hardcode (tarif pajak, template) | ⬜ Nanti (sesuai PDF) |
| 6 | Laporan gabungan lintas perusahaan | ⬜ Nanti, kalau diminta |
| G | Go-live server & cutover | ⬜ Belum |

---

## TAHAP 0 — Yang Sudah Dilewati

### 0.1 Bug kolom `code` (Loans/Receivables) — DIPERBAIKI
- Kolom baru **`system_key`** (nullable unique) di `transaction_categories` + backfill 6 kategori
  sistem; lookup `where('code', ...)` → `TransactionCategory::findSystem()` di
  `LoanController` (3 titik) dan `ReceivableController` (3 titik).
- Kategori ber-`system_key` **diproteksi** dari edit/hapus di `TransactionCategoryController`.
- Test baru `ReceivableControllerTest` (8 test — sebelumnya tidak ada sama sekali) +
  `LoanControllerTest` diperkuat assertion `category_id`.
- Bonus bug yang ikut ketemu & diperbaiki: akses key request nullable tanpa null-safe di
  `ReceivableController` (approve/pay bisa 500).

### 0.2 Test & CI → MySQL — SELESAI
- `phpunit.xml`: `mysql` + `finance_management_test`; kredensial lokal di `.env.testing`
  (di-gitignore); CI GitHub Actions dapat **service mysql:8**.
- Pindah driver langsung membongkar bug tersembunyi: `BankAccountFactory` memakai
  `randomFloat` untuk kolom integer rupiah (selisih pembulatan 1 rupiah antar driver) — diperbaiki.

### 0.4 Keamanan & storage — SELESAI
- 3 route `/api/*` (kategori/rekening/klien) yang **tanpa auth** dipindah ke dalam group auth
  (kini juga ber-prefix company).
- Aset CompanyProfile dibaca via `Storage::disk('public')` + fallback legacy; `storage:link` dibuat.

### 0.3 Ukur version drift — ⚠ MASIH TUGAS MANUAL
Butuh akses ke setiap deployment yang berjalan: catat commit + `php artisan migrate:status` +
diff modifikasi lokal. Hasilnya menentukan besarnya pekerjaan impor saat cutover (§G).

---

## TAHAP 1 — Yang Sudah Dilewati

- **stancl/tenancy v3.10** terpasang; model [`Company`](../app/Models/Company.php) = tenant
  (`id` = **slug permanen** → URL, nama DB `tenant_{slug}`, path storage) +
  [`Organization`](../app/Models/Organization.php) (kuota perusahaan).
- **Skema central baru**: `organizations`, `companies`, pivot `company_user`
  (keanggotaan TANPA kolom role), `users.organization_id`, `company_id` di
  `app_notifications` & `feedbacks`.
- **Spatie teams AKTIF** — `team_foreign_key = company_id` (STRING, mengikuti slug):
  - Role **global** (`company_id NULL`), assignment **per (user, perusahaan)** —
    satu user bisa `finance manager` di PT A dan `staff` di PT B.
  - Dua koreksi terhadap asumsi rencana: (a) tabel Spatie live harus **ditambal migration
    baru** (bukan "tinggal aktifkan"); (b) stub migration Spatie diubah ke kolom team
    **string** supaya fresh install benar. Patch dibuat idempoten.
  - Middleware [`SetPermissionsTeam`](../app/Http/Middleware/SetPermissionsTeam.php)
    men-set konteks dari tenant aktif (fallback keanggotaan pertama).
- **`central:import-users`** + `CentralUserImportService` (idempoten) untuk menarik user
  deployment lama ke pusat.
- Test isolasi [`CompanyPermissionIsolationTest`](../tests/Feature/CompanyPermissionIsolationTest.php).

---

## TAHAP 2 — Yang Sudah Dilewati

### Routing & konteks (backend)
- SEMUA route aplikasi dibungkus `Route::prefix('c/{company}')` dengan rantai:
  `InitializeTenancyByPath` → `EnsureUserBelongsToCompany` (bukan anggota = 403) →
  `SetPermissionsTeam` → `SetCompanyUrlDefaults` (`URL::defaults` — `route()` backend
  tidak perlu menyebut company).
- Halaman **`/choose-company`** (central): 1 perusahaan → langsung dashboard; >1 → pemilih;
  0 → 403. Semua redirect auth diarahkan ke sana. Slug tak dikenal → **404**.
- **Pin koneksi central** (krusial & tak terlihat): trait `CentralConnection` di
  User, Role, Permission, Organization, AppNotification, Feedback; session + cache +
  queue database dipaku ke koneksi `mysql` central. Tanpa ini query auth/session
  nyasar ke DB tenant setelah bootstrapper menukar koneksi default.
- `ViewServiceProvider` & `actionCounts` di-guard `tenant()` (tabel tenant tidak boleh
  di-query dari konteks central).

### Frontend
- Helper baru [`@/lib/company`](../resources/js/lib/company.ts): `companyUrl()` (prefix path),
  `appPath()` (kupas prefix untuk matching), `setActiveCompany()` (boot + tiap navigasi,
  sekaligus mengisi `setUrlDefaults` Wayfinder).
- **132 titik di 30 file** dikonversi dari literal path ke `companyUrl()`
  (dikerjakan 8 agent paralel, diaudit per file).
- **Switcher perusahaan** di brand sidebar (muncul bila punya >1 perusahaan; ganti =
  full reload agar seluruh konteks dihitung ulang) + prop Inertia baru `company` &
  `companies`; `auth.permissions/roles` jadi lazy (dievaluasi setelah konteks tenant siap).

### Pemisahan database
- **44 migration bisnis** → `database/migrations/tenant/`; central menyisakan 17
  (users, cache, jobs, sessions, Spatie, organizations/companies/company_user,
  notifications, feedbacks).
- **13 FK ke `users` dilepas** di 4 migration tenant (reimbursements, reimbursement_payments,
  receivables, fund_requests) — lintas database tidak bisa ber-FK.
- Pipeline provisioning aktif: `Company::create()` → buat DB → migrate → seed master
  (`TenantDatabaseSeeder`: kategori transaksi + profil minimal dari nama tenant).
- **`central:adopt-database`**: mendaftarkan DB deployment lama (hasil restore ke
  `tenant_{slug}`) sebagai tenant + menyamakan skema.

### Infrastruktur test (kunci kelangsungan 415 test)
- Testing memakai **SATU database**: bootstrappers dikosongkan (tenant() tetap ter-set,
  koneksi tidak ditukar) + migration tenant dimuat ke DB test (`AppServiceProvider`).
- `tests/TestCase.php`: auto-prefix URI `/c/test-company`, auto-membership saat `actingAs`,
  company test dibuat per test — 40+ file test lama TIDAK diubah URL-nya satu per satu.

### Bukti smoke test live (bootstrapper nyata, server dev)

| Skenario | Hasil |
|---|---|
| manager (2 PT) → dashboard kisantra & semesta | 200 & 200 |
| staff (kisantra saja) → semesta | **403** |
| staff login → pemilih | auto-redirect ke kisantra |
| `/c/tidak-ada/...` | 404 |
| Isi DB | bisnis hanya di tenant DB; central bersih dari angka keuangan |

### Akun demo (`php artisan migrate:fresh --seed`)

| Akun | Perusahaan | Role |
|---|---|---|
| `admin@gmail.com` / `password` | kisantra | admin |
| `manager@gmail.com` / `password` | kisantra + semesta | finance manager di keduanya |
| `staff@gmail.com` / `password` | kisantra | staff |

### Penyimpangan sadar dari rencana
- **Identifikasi organization via subdomain DITUNDA** — struktur datanya sudah ada
  (organizations + kuota), tapi middleware subdomain belum dibuat; satu domain cukup
  untuk satu grup saat ini. Tambahkan saat menerima organization eksternal.
- Sebagian Tahap 3 **tertarik maju**: queue central (`queue.connections.database.connection`),
  keputusan cache **Jalur A** (CacheTenancyBootstrapper dimatikan — cache tetap database
  central; pindah Redis bila ingin cache per-tenant), `FilesystemTenancyBootstrapper` aktif.

---

## Perintah yang Berubah — Hafalkan

```bash
php artisan migrate               # HANYA central (users, roles, companies, ...)
php artisan tenants:migrate       # semua database perusahaan
php artisan tenants:migrate --tenants=kisantra   # satu perusahaan
php artisan tenants:seed          # TenantDatabaseSeeder (master data)
php artisan migrate:fresh --seed  # dev: reset central + buat ulang 2 tenant demo
php artisan central:import-users {koneksi} --organization= --company=
php artisan central:adopt-database {slug} --organization= --name= --abbreviation=
```

Aturan kode baru: migration tabel bisnis → `database/migrations/tenant/`;
URL frontend → `companyUrl()`; model central baru → trait `CentralConnection`;
job/command yang menyentuh permission → `setPermissionsTeamId()` manual.

---

## Tahap 3 & 4 — Yang Sudah Dilewati (2026-08-11)

- **Scheduler per-tenant**: `invoices:notify-due-dates` (satu-satunya scheduled task
  bisnis) dibungkus `tenants:run` — sebelumnya akan crash di konteks central. Audit
  queue: belum ada job `ShouldQueue`; QueueTenancyBootstrapper siap saat ada.
- **Provisioning UI `/admin/companies`** (permission `manage companies`, admin only):
  form nama + slug + singkatan (permanen), kuota organization dicek, pipeline
  `CreateDatabase → MigrateDatabase → SeedDatabase → MarkCompanyActive`; gagal →
  status `failed` + tombol **Coba Ulang**; pembuat otomatis anggota + admin perusahaan
  baru. 8 feature test; smoke live: provisioning **0,6 detik** end-to-end.
- **`central:backup {--dir=} {--keep-days=14}`** — dump gzip central + semua tenant
  (password via env `MYSQL_PWD`, streaming, prune folder lama, deteksi DB yatim,
  exit FAILURE bila ada dump gagal).
- **`central:deploy-migrate {--canary=} {--skip-central} {--force}`** — urutan deploy
  aman: central → canary (gagal = berhenti total, tenant lain tak tersentuh) →
  per-perusahaan dengan tabel laporan OK/FAILED/SKIPPED. Menjaga jebakan `migrate
  --force` yang diam-diam membuat DB hilang: tenant tanpa DB = FAILED.
- **`central:tenants-status`** — monitoring per perusahaan: status, keberadaan +
  ukuran DB (MB), jumlah anggota, migration tenant yang belum jalan.
- **Bug validasi lintas-database** (ditemukan smoke live): rule `unique:`/`exists:` ke
  tabel central wajib berprefix koneksi — `unique:mysql.users` — diterapkan di 4
  FormRequest admin. **Invarian baru untuk kode selanjutnya.**

---

## Yang Akan Kita Lakukan (urutan disarankan)

### 1. Go-live (§G runbook)
- [ ] **0.3 dulu**: ukur version drift semua deployment berjalan (manual).
- [ ] Setup server sekali: wildcard DNS + SSL, satu vhost nginx, **dua user MySQL**
      (`finance_app` tanpa CREATE; `finance_provisioner` khusus provisioning),
      `.env`: `SESSION_DOMAIN`, `APP_URL`, DB central.
- [ ] Cutover per deployment: freeze + backup → restore dump ke `tenant_{slug}` →
      `central:adopt-database` → `central:import-users` → smoke test → arahkan DNS →
      matikan deployment lama.
- [ ] Rilis rutin: migrate central → canary tenant → semua tenant → `queue:restart`;
      migration wajib **expand–contract**.

### 2. Nanti (sesuai PDF)
- [ ] Tahap 5: tarif pajak → pengaturan; template invoice hardcoded → penyusun template.
- [ ] Tahap 6: laporan gabungan lintas perusahaan (loop antar DB, panel central).
- [ ] Identifikasi organization via subdomain + login ter-namespace per organization.

---

## File Kunci yang Lahir/Berubah di Migrasi Ini

| Area | File |
|---|---|
| Tenant & org | `app/Models/Company.php`, `app/Models/Organization.php`, `config/tenancy.php`, `app/Providers/TenancyServiceProvider.php` |
| Permission | `app/Models/Role.php`, `app/Models/Permission.php`, `config/permission.php`, `app/Http/Middleware/SetPermissionsTeam.php`, migration `..._add_team_support_to_permission_tables.php` |
| Routing | `routes/web.php` (prefix `c/{company}`), `app/Http/Middleware/EnsureUserBelongsToCompany.php`, `SetCompanyUrlDefaults.php`, `app/Http/Controllers/ChooseCompanyController.php` |
| Frontend | `resources/js/lib/company.ts`, `resources/js/inertia.tsx`, `resources/js/pages/choose-company.tsx`, `layouts/sidebar.tsx` (switcher), + 30 file terkonversi |
| Data | `database/migrations/tenant/` (44 file), `database/seeders/DatabaseSeeder.php`, `TenantDatabaseSeeder.php`, `app/Console/Commands/CentralImportUsers.php`, `CentralAdoptDatabase.php` |
| Test | `tests/TestCase.php`, `tests/Feature/CompanyPermissionIsolationTest.php`, `tests/Feature/ReceivableControllerTest.php`, `phpunit.xml`, `.github/workflows/tests.yml` |
