# Runbook Eksekusi Multi-Tenancy — Opsi B (Keputusan Final)

Langkah eksekusi step-by-step untuk mengimplementasikan dan men-deploy arsitektur di
[MultiTenancyKeputusanFinal.pdf](MultiTenancyKeputusanFinal.pdf): tiga level
vendor → organization → perusahaan, satu database per perusahaan, roles di pusat
(Spatie teams), perusahaan aktif di URL, stancl/tenancy v3.

> **Dokumen ini sudah dikalibrasi dengan hasil verifikasi codebase & dokumentasi resmi
> (Agustus 2026, 6 pemeriksaan paralel).** Setiap klaim PDF yang meleset dikoreksi di
> tempat, dengan bukti file:line.

> **STATUS EKSEKUSI (2026-08-11):**
> ✅ Tahap 0 selesai (0.1 system_key + test, 0.2 test/CI → MySQL — 415 test hijau,
> 0.4 route /api diamankan + storage dirapikan) — kecuali 0.3 (ukur version drift:
> butuh akses deployment berjalan, dikerjakan manual).
> ✅ Tahap 1 selesai (stancl/tenancy v3.10 terpasang; tabel `organizations`/`companies`/
> `company_user`; Spatie teams aktif `company_id` string + middleware `SetPermissionsTeam`;
> `central:import-users`; test isolasi `CompanyPermissionIsolationTest` 4/4 hijau).
> Catatan implementasi yang menyimpang dari rencana: stub migration Spatie ikut diubah
> ke kolom team STRING (fresh install benar), patch 110005 idempoten (no-op saat fresh);
> pipeline TenantCreated dev = CreateDatabase+MigrateDatabase (SeedDatabase menyusul
> Tahap 4, seeder tenant = `TenantDatabaseSeeder`, BUKAN DatabaseSeeder — rekursi).
> ✅ **Tahap 2 selesai (2026-08-11):** semua route aplikasi ber-prefix `/c/{company}`
> (InitializeTenancyByPath + EnsureUserBelongsToCompany + SetPermissionsTeam +
> SetCompanyUrlDefaults); halaman `/choose-company` + switcher di sidebar; frontend
> dikonversi (132 titik di 30 file → `companyUrl()`/`appPath()`, Wayfinder via
> `setUrlDefaults`); 44 migration bisnis pindah ke `database/migrations/tenant/`
> (13 FK ke users dilepas); model central di-pin `CentralConnection` (User, Role,
> Permission, Organization, AppNotification, Feedback) + session/cache/queue di
> koneksi `mysql` central; seeder dev = 2 perusahaan (kisantra, semesta) + user demo
> multi-company; `central:adopt-database` tersedia. **Smoke test live**: manager
> (2 PT) bisa keduanya, staff 403 di semesta, slug tak dikenal 404, pemilih
> auto-redirect user 1-perusahaan. Test: 415 hijau (mode 1-DB: bootstrappers
> dinonaktifkan di testing, URL auto-prefix di `tests/TestCase.php`).
> Penyimpangan dari rencana yang perlu diketahui: identifikasi organization via
> subdomain DITUNDA (belum ada `IdentifyOrganization`; organization sudah ada di
> data model, cukup satu domain untuk grup saat ini) — tambahkan saat dibutuhkan
> multi-organization publik.
> ✅ **Tahap 3 selesai (2026-08-11):** scheduler `invoices:notify-due-dates` dibungkus
> `tenants:run` (satu-satunya scheduled task bisnis); audit queue bersih (belum ada
> job ShouldQueue); queue/cache/storage pinning sudah dari Tahap 2.
> ✅ **Tahap 4 selesai (2026-08-11):**
> • **Provisioning UI** `/admin/companies` (permission baru `manage companies`, admin):
>   form nama+slug+singkatan (permanen, tervalidasi), cek kuota organization, pipeline
>   + job `MarkCompanyActive` → status `provisioning → active | failed`, tombol
>   **Coba Ulang** (drop DB setengah jadi → re-create), pembuat otomatis anggota+admin.
>   Smoke live: provisioning end-to-end 0,6 detik → perusahaan langsung bisa dibuka.
> • **`central:backup`** — dump gzip central + semua `tenant_%` (password via env,
>   streaming, prune `--keep-days`), lapor per DB, deteksi tenant yatim.
> • **`central:deploy-migrate --canary=`** — migrate central → canary (gagal = berhenti
>   total) → sisanya per-perusahaan dengan tabel laporan OK/FAILED/SKIPPED.
>   Penting: menjaga bug halus `migrate --force` yang diam-diam MEMBUAT DB hilang —
>   tenant tanpa DB dilaporkan FAILED, tidak dibuatkan DB kosong.
> • **`central:tenants-status`** — monitoring: status, keberadaan & ukuran DB,
>   anggota, migration pending per tenant.
> • Bug nyata yang ketemu saat smoke & diperbaiki: rule validasi `unique:`/`exists:`
>   ke tabel central WAJIB berprefix koneksi (`unique:mysql.users`) — diterapkan di
>   4 FormRequest admin.
> ⏭ Berikutnya: **go-live §G** (prasyarat manual: 0.3 ukur version drift; setup server
> G.1; cutover per deployment G.2 memakai `central:adopt-database` + `central:import-users`;
> rilis rutin = `central:deploy-migrate --canary=...`). Nanti: Tahap 5/6 + subdomain
> organization.

---

## 0. Hasil Verifikasi — Baca Dulu Sebelum Eksekusi

### 3 pertanyaan slide 17 — sekarang terjawab

| # | Pertanyaan | Jawaban terverifikasi |
|---|---|---|
| 1 | Identifikasi lewat path di stancl/tenancy? | **DIDUKUNG.** `InitializeTenancyByPath` resmi ada di v3; syarat kerasnya: `{tenant}` harus jadi **parameter route pertama** (source: `$route->parameterNames()[0]`). Dengan `Route::prefix('c/{company}')`, `{company}` memang parameter pertama — cocok. Nama parameter diganti via `PathTenantResolver::$tenantParameterName = 'company'`. Kombinasi subdomain(org)+path(company) **tidak built-in** — middleware organization ditulis sendiri (extension point resmi: "you're free to write additional tenant resolvers" / `tenancy()->initialize($tenant)`). |
| 2 | Di mana role disimpan? | **Pusat, Spatie teams, `team_foreign_key = company_id`.** Pivot `company_user` HANYA untuk keanggotaan (tanpa kolom role) — satu sumber kebenaran. **Koreksi klaim PDF**: migration Spatie memang memuat cabang `$teams`, TAPI sudah dieksekusi saat `teams => false` — tabel live TIDAK punya kolom team dan sudah terisi (74 permissions, 3 roles, 163 role_has_permissions, 1 model_has_roles). Ini **menambal, bukan tinggal mengaktifkan**: wajib migration patch baru (§Tahap 1.3). |
| 3 | Peran disamakan grup atau per perusahaan? | Spatie teams mendukung keduanya sekaligus: role dengan `company_id = NULL` = global (definisi sama se-grup), role dengan `company_id` terisi = khusus perusahaan itu. **Rekomendasi**: mulai dengan 3 role existing sebagai global (NULL) + assignment per perusahaan; role kustom per-PT bisa menyusul tanpa migrasi ulang. Keputusan produk final tetap di kamu. |

### Klaim PDF lain yang diverifikasi

| Klaim | Hasil |
|---|---|
| Bug kolom `code` di Loans/Receivables | **BENAR, 6 lokasi**: `LoanController.php:133,233,246`, `ReceivableController.php:286,354,367`. Direproduksi di MySQL: `QueryException 42S22`. Dampak: create loan, pay loan, approve receivable, pay receivable (jalur bank_transfer) — semuanya 500 + rollback. |
| Test SQLite menyembunyikan bug | **BENAR + lebih buruk**: `LoanControllerTest` (8 test) PASS di SQLite karena DQS fallback memperlakukan `"code"` sebagai string literal. `ReceivableControllerTest` **tidak ada sama sekali**. CI GitHub Actions juga full SQLite. |
| 55 file migration | **BENAR** (persis 55). |
| Migration Spatie "tinggal diaktifkan" | **SALAH** — lihat tabel di atas. |
| stancl/tenancy v3 | **BENAR**: v3.10.1 stabil, dukung Laravel 12 eksplisit. v4 masih WIP (belum ada tag stabil) — jangan dipakai. |
| Queue database di central | **DIDUKUNG RESMI**: `config/queue.php` → `connections.database.connection = 'central'`. |
| Cache | **TEMUAN BARU**: `CacheTenancyBootstrapper` butuh store ber-tagging (Redis) — **tidak kompatibel** dengan `CACHE_STORE=database` yang dipakai sekarang. Keputusan di §Tahap 3.2. |
| Frontend | **TEMUAN BARU**: hanya 63 call site pakai Wayfinder helper; **±194 string path hardcoded di 38 file** harus dimigrasi manual (sidebar 39 baris, breadcrumb header 23, dst). Plus **3 route `/api/*` tanpa auth** yang membocorkan data (web.php:51-99) — wajib diamankan. |

---

## TAHAP 0 — Beresi Dulu (blocker, kerjakan minggu ini)

Urutan di dalam tahap ini bebas; semuanya berdiri sendiri dan berguna walau arah berubah.

### 0.1 Perbaiki bug kolom `code` (½–1 hari)

Skema sekarang tidak punya kolom pengganti (`system_key`/`is_system` tidak ada — sudah
diverifikasi). Mekanisme pengganti yang aman:

1. Migration baru: tambah `system_key` `->string()->nullable()->unique()` di
   `transaction_categories`.
2. Update `TransactionCategorySeeder` — set `system_key` untuk 6 kategori sistem
   (mapping terverifikasi dari seeder): `FIN-LOAN-IN`→financing/"Penerimaan Pinjaman",
   `FIN-LOAN-OUT`→"Pembayaran Pokok Pinjaman", `FIN-RCV-OUT`→"Piutang Diberikan",
   `FIN-RCV-IN`→"Pembayaran Piutang Diterima", `EXP-INTEREST`→expense/"Beban Bunga
   Pinjaman", `REV-INTEREST`→income/"Pendapatan Bunga". Migration juga backfill
   berdasarkan `type`+`label` untuk data existing.
3. Ganti 6 lookup `where('code', ...)` → `where('system_key', ...)` di
   [LoanController.php](../app/Http/Controllers/LoanController.php) (:133, :233, :246)
   dan [ReceivableController.php](../app/Http/Controllers/ReceivableController.php)
   (:286, :354, :367).
4. Lindungi kategori sistem dari edit/hapus label di `TransactionCategoryController`
   (`system_key !== null` → tolak delete).
5. **Test baru**: `ReceivableControllerTest` (belum ada!) + perkuat `LoanControllerTest`
   dengan assertion `category_id` non-null di `bank_transactions` — tanpa assertion ini
   regresi "kategori jadi NULL" lolos lagi.
6. Update `docs/module/loans.md`, `receivables.md`, `transaction-categories.md`
   (bug ini terdokumentasi di sana sebagai "BUG AKTIF") di commit yang sama.

### 0.2 Pindahkan test & CI ke MySQL (1–2 hari)

1. `phpunit.xml` (baris 26-27): `DB_CONNECTION=mysql`,
   `DB_DATABASE=finance_management_test` + host/user/password; buat database test-nya.
2. `.github/workflows/tests.yml`: tambah `services: mysql` (mysql:8 + healthcheck),
   ganti `sed` DB ke mysql, hapus `touch database/database.sqlite`.
3. Jalankan suite penuh — **ekspektasikan kegagalan baru yang selama ini
   disembunyikan SQLite** (bug 0.1 salah satunya; strict mode/tipe kolom bisa
   memunculkan lainnya). Perbaiki satu per satu sebelum lanjut.
4. 41/42 file test pakai `RefreshDatabase` — akan lebih lambat dari `:memory:`;
   kalau terasa berat, `php artisan test --parallel` menyusul belakangan.

### 0.3 Satukan codebase & ukur version drift (½ hari pengukuran)

1. Untuk **setiap deployment yang berjalan**: catat `git rev-parse HEAD`,
   `php artisan migrate:status`, dan diff file di luar `resources/views/pdf/`.
2. Kalau ada modifikasi lokal di luar template PDF → normalisasi jadi konfigurasi/
   pengaturan dulu. Tanpa ini satu-codebase mustahil.
3. Hasil pengukuran menentukan besarnya Tahap 1 (impor user & data per deployment).

### 0.4 Rapikan dua hal yang ditemukan verifikasi (tidak ada di PDF)

1. **Konvensi storage campur**: aset company (logo/ttd/stempel) dibaca via
   `public_path()` dari `public/images/` ([CompanyProfile.php](../app/Models/CompanyProfile.php):43,56,69,82),
   tapi upload baru via `Storage::disk('public')` (`Settings/CompanyController.php:95-121`),
   dan `php artisan storage:link` belum jalan. Satukan ke `Storage::disk('public')`
   SEKARANG — Tahap 3 (pemisahan storage per tenant lewat bootstrapper) mengandalkan
   semua akses file lewat `Storage`.
2. **3 route JSON tanpa auth**: `GET /api/transaction-categories`, `/api/bank-accounts`,
   `/api/clients` (web.php:51-99) mengembalikan data tanpa `auth` sama sekali.
   Pindahkan ke dalam group `auth` sekarang; nanti otomatis ikut ter-prefix tenant.

**Checkpoint Tahap 0**: suite hijau di MySQL (lokal + CI), bug loans/receivables
tertutup test, semua deployment tercatat versi & drift-nya.

---

## TAHAP 1 — Database Pusat

### 1.1 Install & konfigurasi stancl/tenancy v3

```bash
composer require stancl/tenancy:^3.10
php artisan tenancy:install        # config, migration, TenancyServiceProvider
```

- Model `Company extends Stancl\Tenancy\Database\Models\Tenant implements TenantWithDatabase`
  (custom columns: `organization_id`, `name`, `slug`, `abbreviation`, `status`, `quota` info di org).
- `config/tenancy.php`: `database.prefix = 'tenant_'`; **matikan** `CacheTenancyBootstrapper`
  (lihat 3.2); aktifkan Database/Filesystem/Queue bootstrapper.
- `PathTenantResolver::$tenantParameterName = 'company'` (di AppServiceProvider/TenancyServiceProvider).

### 1.2 Skema central baru

Migration central (folder `database/migrations/` biasa):

1. `organizations` — id, name, slug (unique), company_quota, status, timestamps.
2. `companies` (tabel tenants stancl + kolom kustom) — id/slug **permanen** (dipakai di
   URL & path storage — keputusan PDF slide 12), `organization_id` FK,
   `abbreviation` (wajib manual, tidak auto — PDF slide 12), `database`,
   `status` (`provisioning|active|failed`).
3. `company_user` — user_id FK, company_id FK, unique(user_id, company_id).
   **TANPA kolom role** (keputusan §0 pertanyaan 2).
4. `users` — tambah `organization_id` FK.
5. `app_notifications` & `feedbacks` **tetap di central** (keputusan PDF slide 10;
   FK ke users yang terverifikasi di migration-nya jadi tetap sah karena satu DB
   dengan users) + tambah kolom `company_id` nullable untuk label/scoping bell per
   perusahaan.

### 1.3 Aktifkan Spatie teams — dengan migration patch (BUKAN cuma config)

Terverifikasi: tabel live tanpa kolom team & sudah terisi. Langkahnya:

1. `config/permission.php`: `'teams' => true`, `'column_names.team_foreign_key' => 'company_id'`.
2. **Migration patch baru** (jangan `migrate:fresh` di produksi):
   - `roles`: tambah `company_id` nullable + index; drop unique `['name','guard_name']`
     → unique `['company_id','name','guard_name']`. 3 role existing biarkan NULL = global.
   - `model_has_roles`: drop PK lama; tambah `company_id` **NOT NULL**; **backfill 1 baris
     existing** dengan company pertama; PK baru `['company_id','role_id','model_id','model_type']`.
   - `model_has_permissions`: sama (0 baris, aman).
   - `permissions` & `role_has_permissions`: tidak berubah.
3. Middleware baru `SetPermissionsTeam`: `setPermissionsTeamId($company->id)` —
   didaftarkan **sebelum** `HandleInertiaRequests` di web group (karena `share()`
   memanggil `getAllPermissions()`), dan otomatis sebelum 94+ route `can:`.
4. Update semua titik assignment tanpa konteks team (terverifikasi):
   `UserController.php:100,122`, `RoleController.php:96`,
   `MasterPermissionSeeder.php:415` — panggil `setPermissionsTeamId()` dulu.
5. Job/command yang menyentuh permission wajib set team id sendiri (tidak otomatis
   di luar HTTP).
6. `php artisan permission:cache-reset` setiap selesai.

### 1.4 Impor user dari deployment berjalan

Per deployment (pakai data drift dari 0.3): impor `users` → central (dedup by email),
buat `organizations` + `companies`, isi `company_user`, assign role via Spatie teams
per (user, company). Tulis sebagai command idempoten `php artisan central:import-users {dump}`.

**Checkpoint Tahap 1**: login memakai users central; `$user->can()` benar per konteks
company yang di-set manual di test; test isolasi permission hijau.

---

## TAHAP 2 — Routing, Pemilih Perusahaan & Frontend

### 2.1 Routing backend

1. Middleware `IdentifyOrganization` (buatan sendiri — tidak ada built-in):
   parse subdomain → cari `organizations.slug` → bind ke container; 404 jika tak ada.
2. Bungkus seluruh group auth (web.php:101 — terverifikasi SEMUA route aplikasi ada
   di satu group ini) dengan:
   ```php
   Route::prefix('c/{company}')->middleware([
       IdentifyOrganization::class,
       InitializeTenancyByPath::class,     // {company} = param pertama ✓
       EnsureUserBelongsToCompany::class,  // cek company_user + company ∈ organization → 403
       SetPermissionsTeam::class,
   ])->group(...)
   ```
3. Route auth (`routes/auth.php`), halaman pilih perusahaan, dan `POST /language`
   tetap DI LUAR prefix (level organization).
4. Redirect `/` dan legacy redirect (web.php:45, :519) diarahkan ke pemilih perusahaan.
5. `URL::defaults(['company' => $company->slug])` di middleware — supaya `route()`
   backend & Wayfinder tidak perlu param eksplisit di tiap call.

### 2.2 Frontend (bagian terbesar — hasil verifikasi: 194 string hardcoded, 38 file)

1. `HandleInertiaRequests::share()` + prop baru: `company` (aktif: id/slug/nama/logo)
   dan `companies` (daftar keanggotaan untuk switcher); scoping `actionCounts` &
   `notifications` per company (sekarang query global — terverifikasi :73-84).
2. Wayfinder: setelah route ber-prefix, regenerate otomatis via Vite. Di
   `resources/js/` boot (setup Inertia): `setUrlDefaults({ company: props.company.slug })`
   — 63 call site helper existing tetap bekerja; drift signature TypeScript akan
   tertangkap `npm run build`.
3. **Migrasi manual 194 string hardcoded** (daftar lengkap per file dari verifikasi;
   hotspot: `layouts/sidebar.tsx` 39 baris — `href` + `matchPrefix` untuk active state
   dua-duanya putus; `layouts/header.tsx` 23 baris breadcrumb keyed literal path;
   `pages/invoices` 22; `pages/recurring-invoices` 20; `pages/settings` 17; 7×
   `window.open`). Buat helper `companyUrl(path)` ATAU pindahkan semuanya ke Wayfinder
   helper sekalian (lebih benar, lebih lama). Sidebar `matchPrefix` dibanding terhadap
   path yang sudah dikupas prefix `/c/{slug}`.
4. Halaman baru: **pemilih perusahaan** (post-login; auto-redirect kalau cuma 1) dan
   **switcher di header** (ganti = navigasi penuh ke `/c/{slug-lain}/dashboard`).
5. Login flow: login di subdomain organization → redirect ke pemilih → `/c/{slug}/dashboard`.

### 2.3 Migrasi migration & data bisnis ke tenant

1. Pindahkan 44 migration bisnis (daftar terverifikasi di inventaris §hasil verifikasi)
   ke `database/migrations/tenant/`. Central tetap: users (+patch), cache, jobs,
   permission tables (+2 patch role), sessions, notifications, feedbacks.
2. **Lepas FK ke users di tabel tenant** — 13 constraint di 6 file migration
   (reimbursements ×3, reimbursement_payments ×2, receivables.approved_by,
   fund_requests ×3, feedbacks ×2*, app_notifications*): kolom user-id jadi
   `unsignedBigInteger` biasa (nilai menunjuk users di central, tanpa constraint).
   *feedbacks/app_notifications pindah central jadi FK-nya justru dipertahankan.
   Perhatian ekstra: `receivables.debtor_type/debtor_id` polymorphic bisa menunjuk User.
3. `company_profiles` menjadi tabel tenant berisi SATU baris per database —
   `CompanyProfile::current()` (= `first()`) **tetap benar tanpa diubah**, sesuai
   prediksi PDF.
4. Konversi data existing per perusahaan: `mysqldump` DB lama → restore sebagai
   `tenant_{slug}` → jalankan migration penyesuaian (drop tabel yang pindah central:
   users, sessions, cache, jobs, permission tables; lepas FK) → daftarkan baris
   `companies` menunjuk database itu. Tulis sebagai command `central:adopt-database`
   yang idempoten + dry-run.

**Checkpoint Tahap 2** (= PDF: "setelah Tahap 2, Mitra Group sudah bisa dipakai"):
satu organization dengan ≥2 company hidup berdampingan di lokal; test isolasi:
user A tanpa keanggotaan company B → 403; dua tab dua perusahaan aman; sequence
nomor invoice independen per company.

---

## TAHAP 3 — Efek Samping (queue, cache, storage, scheduler)

### 3.1 Queue — keputusan PDF: central. Terverifikasi didukung resmi

- `config/queue.php` → `connections.database` tambah `'connection' => 'central'`
  (kutipan persis dari docs stancl). Tabel `jobs` hidup di central.
- `QueueTenancyBootstrapper` aktif: tenant id otomatis masuk payload & tenancy
  di-reinit di worker. Satu pool worker untuk semua tenant (Supervisor seperti biasa).
- Job murni central (tanpa tenant): queue connection dengan `'central' => true` +
  `->onConnection('central')`.

### 3.2 Cache — keputusan yang HARUS diambil (temuan verifikasi, tidak ada di PDF)

`CacheTenancyBootstrapper` memakai cache TAGS → wajib Redis; `CACHE_STORE=database`
sekarang TIDAK kompatibel. Dua jalur:

- **Jalur A (minim perubahan, rekomendasi awal)**: JANGAN aktifkan
  CacheTenancyBootstrapper. Cache tetap database di central. Konsekuensi: key cache
  yang berisi data tenant wajib manual prefix tenant id (audit pemakaian
  `Cache::`/`remember` — `TranslationService` aman karena terjemahan teks→teks netral
  tenant). Cache permission Spatie tetap central — sejalan dengan roles di pusat;
  **jangan** terapkan resep integrasi spatie di docs stancl (resep itu justru untuk
  cache per-tenant).
- **Jalur B**: pindah Redis + aktifkan bootstrapper. Lebih bersih jangka panjang,
  tambah dependency infra. Bisa menyusul kapan saja.

### 3.3 Storage per tenant

- Aktifkan `FilesystemTenancyBootstrapper` → path `storage/` ter-suffix tenant
  otomatis. Prasyarat: 0.4 selesai (semua akses via `Storage::disk('public')`).
- Migrasikan file existing per perusahaan ke folder tenant masing-masing (script
  satu kali, bagian dari `central:adopt-database`).
- `php artisan storage:link` per konvensi stancl (docs: tenancy + public storage links).

### 3.4 Scheduler & command

- Command per-tenant dibungkus: `Schedule::command('tenants:run <cmd>')`.
- `AppNotification::cleanupOld()` pindah konteks central (tabel sudah di central).

**Checkpoint Tahap 3**: job PDF invoice ter-dispatch dari company A diproses worker
dan menghasilkan file di storage company A; scheduler jalan untuk semua tenant.

---

## TAHAP 4 — Alat Operasional (sebelum menerima pelanggan eksternal)

1. **Provisioning otomatis** — form "Perusahaan Baru" (cek kuota organization):
   `Company::create()` → event `TenantCreated` → `JobPipeline::make([CreateDatabase,
   MigrateDatabase, SeedDatabase])->shouldBeQueued(true)` (nama kelas terverifikasi
   dari docs; pipeline default SINKRON — wajib `shouldBeQueued(true)`).
   Status `provisioning → active | failed` + tombol retry + pembersihan DB sampah
   (keputusan PDF slide 12).
2. **Backup malam per database**: dump central + loop `tenant_%`; uji restore satu
   tenant secara berkala.
3. **Canary migrate**: wrapper deploy yang menjalankan `tenants:migrate --tenants=<uji>`
   dulu → verifikasi → sisanya; laporan per company (gagal di ke-7 → jelas 6 sudah,
   3 belum); alert saat gagal.
4. **Monitoring**: uptime per organization subdomain, ukuran DB per tenant, gagal-job
   per tenant. Export PDF/Excel besar (cash flow menaikkan memori ke 1 GB — risiko #3
   PDF) dipindah ke queue job.

---

## TAHAP 5 & 6 — Nanti (sesuai PDF)

- **5**: tarif pajak → pengaturan; template invoice hardcoded → penyusun template.
- **6**: laporan gabungan lintas perusahaan (loop antar DB, panel central superadmin).
  Prasyarat datanya disiapkan sejak Tahap 4.

---

## GO-LIVE DI SERVER — Urutan Eksekusi

### G.1 Setup server (sekali saja)

```bash
# 1. DNS wildcard
*.kisantra.com    A    <IP-server>

# 2. SSL wildcard (perlu DNS-01 challenge)
certbot certonly --dns-<provider> -d "kisantra.com" -d "*.kisantra.com"

# 3. nginx — SATU vhost untuk semua organization
server_name kisantra.com *.kisantra.com;
root /var/www/finance-management/public;

# 4. MySQL — DUA kredensial (pengetatan dari PDF slide 11: JANGAN GRANT CREATE ke app user)
CREATE USER 'finance_app'@'localhost' IDENTIFIED BY '<kuat>';
GRANT ALL ON `kisantra_core`.* TO 'finance_app'@'localhost';
GRANT ALL ON `tenant\_%`.*    TO 'finance_app'@'localhost';

CREATE USER 'finance_provisioner'@'localhost' IDENTIFIED BY '<kuat-lain>';
GRANT ALL ON `tenant\_%`.* TO 'finance_provisioner'@'localhost';
GRANT CREATE ON *.* TO 'finance_provisioner'@'localhost';
```

`.env` produksi: `DB_DATABASE=kisantra_core`, koneksi `tenancy` provisioning memakai
kredensial `finance_provisioner` (di `config/tenancy.php` database manager),
`SESSION_DOMAIN=.kisantra.com` (terverifikasi: cukup env, tidak ada Sanctum/Fortify),
`SESSION_SECURE_COOKIE=true`, `APP_URL=https://kisantra.com`.

### G.2 Urutan cutover deployment existing

1. Freeze + backup penuh deployment lama.
2. Deploy codebase baru (hasil Tahap 0–3) — belum diaktifkan.
3. `php artisan migrate --force` (central: buat organizations/companies/users/patch Spatie).
4. `central:import-users` + `central:adopt-database` per perusahaan (dump lama →
   `tenant_{slug}`).
5. Smoke test satu perusahaan (canary): login → pilih perusahaan → buat invoice draft
   → hapus. Cek nomor urut invoice lanjut dari sequence lama.
6. Arahkan DNS/subdomain organization; matikan deployment lama (redirect 301).
7. Aktifkan backup malam + monitoring sejak malam pertama.

### G.3 Setiap rilis berikutnya

```bash
git pull && composer install --no-dev && npm run build
php artisan migrate --force                          # central dulu
php artisan tenants:migrate --force --tenants=<uji>  # canary satu perusahaan
# verifikasi canary, lalu:
php artisan tenants:migrate --force                  # sisanya
php artisan config:cache && php artisan queue:restart
```

Aturan: migration tenant wajib **expand–contract** (kode baru jalan di skema lama &
baru) — konsekuensi sadar dari PDF slide 13: deploy buruk kini merusak semua
perusahaan, bukan satu.

---

## Ringkasan Urutan & Definisi Selesai

| Tahap | Inti | Selesai bila |
|---|---|---|
| 0 | Bug code-column, CI MySQL, drift, storage & /api | Suite hijau di MySQL; deployment terinventaris |
| 1 | Central DB + Spatie teams (patch!) | Login central; permission per-company di test |
| 2 | Path routing + pemilih + migrasi frontend | 2 company hidup berdampingan; isolasi 403 teruji |
| 3 | Queue central, cache (putuskan A/B), storage, scheduler | Job & file per tenant benar |
| 4 | Provisioning, backup, canary, monitoring | Perusahaan baru via form end-to-end |
| G | Server & cutover | Deployment lama mati, canary produksi lolos |

Dua keputusan yang masih terbuka untukmu: **cache Jalur A vs B** (§3.2) dan
**kebijakan role global vs per-PT** (§0, pertanyaan 3 — rekomendasi: global dulu).
