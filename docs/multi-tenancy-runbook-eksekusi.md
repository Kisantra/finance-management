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
>
> ✅ **LATIHAN CUTOVER (2026-11-02):** seluruh rangkaian Jalur B dijalankan
> terhadap salinan database berisi invoice bernomor gaya produksi. Hasil:
> 11 metrik baseline identik sebelum-sesudah, nomor invoice berikutnya
> menyambung (`INV/05/KSN/03.26`, bukan mengulang 01), jalan mundur terbukti
> memulihkan keadaan persis. **Dua penghenti cutover ditemukan dan BELUM
> diperbaiki di kode**: migration tenant yang diberi tanggal baru (§G.2.8a) dan
> URL lampiran yang tidak sadar tenant (§G.2.8b). Runbook §G.2 kini memuat
> urutan yang sudah terbukti; latihannya bisa diulang dengan
> `docs/migrasi/latihan-cutover.sh`.

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
- Migrasikan file existing per perusahaan ke folder tenant masing-masing dengan
  **`php artisan central:adopt-storage {slug}`**.
  **Koreksi:** dokumen ini sebelumnya menyatakan pemindahan berkas adalah "bagian
  dari `central:adopt-database`". Itu tidak benar — perintah tersebut hanya
  menyentuh database. Tanpa langkah terpisah ini, seluruh lampiran transaksi,
  bukti pencairan, berkas reimbursement, serta tanda tangan/stempel PDF tetap ada
  di disk tetapi tidak pernah ditemukan aplikasi, karena
  `FilesystemTenancyBootstrapper` memindahkan pembacaan ke
  `storage/tenant{slug}/app/public/`.
  Jalankan `--dry-run` lebih dulu untuk melihat daftarnya. Bawaannya **menyalin**
  (berkas asli tetap utuh); hapus manual setelah verifikasi.
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

## Dua Jalur Pemasangan — Pilih Satu

Ada dua situasi yang sama sekali berbeda, dan mencampurnya adalah cara tercepat
merusak data. Tentukan dulu Anda berada di yang mana.

| | **Jalur A — Server baru** | **Jalur B — Server lama yang sudah berjalan** |
|---|---|---|
| Kondisi awal | Belum ada data sama sekali | Sudah ada invoice, klien, pembayaran nyata |
| Perintah inti | `central:bootstrap` | `central:adopt-database` + `central:import-users` |
| Risiko | Nyaris nol — tidak ada yang bisa hilang | Tinggi — wajib backup, wajib latihan dulu |
| Waktu | ± 10 menit | ± 1 jam, plus waktu latihan sebelumnya |

**Jangan pernah menjalankan `central:bootstrap` di server yang sudah berisi
data.** Perintah itu menolak jalan bila menemukan user, tapi jangan bersandar
pada penolakan itu — sandarkan pada tahu Anda di jalur mana.

---

## Jalur A — Server Baru (belum punya data)

Dilatih penuh pada 2026-08-28 di database kosong; seluruh 16 halaman modul
merespons 200 setelah langkah terakhir.

```bash
# 1. Kode & dependensi
git pull && composer install --no-dev -o && npm ci && npm run build

# 2. .env — periksa sebelum lanjut
#    DB_CONNECTION=mysql
#    DB_DATABASE=<nama database pusat, mis. finance_central>
#    APP_ENV=production, APP_DEBUG=false, APP_KEY terisi

# 3. Database pusat (dibuat otomatis bila belum ada)
php artisan migrate --force

# 4. Hak akses & role — WAJIB, tanpa ini langkah 5 menolak jalan
php artisan db:seed --class=MasterPermissionSeeder --force

# 5. Organization + admin pertama + perusahaan pertama
php artisan central:bootstrap   --organization="Nusantara Group" --quota=5   --name="Admin Nusantara" --email="admin@nusantara.test"   --company="Nusantara Jaya" --slug=nusantara --abbreviation=NSJ
#    Sandi ditanyakan tersembunyi bila --password tidak diberikan — lebih baik
#    begitu, supaya sandi tidak tertinggal di riwayat shell.
#    --company boleh dilewati; perusahaan bisa dibuat lewat menu Perusahaan.

# 6. Tautan storage & cache produksi
php artisan storage:link
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

**Kenapa langkah 5 perlu perintah sendiri.** Database pusat yang baru
dimigrasikan tidak punya satu pun user, jadi tidak ada yang bisa login;
sementara satu-satunya layar untuk membuat perusahaan justru menuntut admin
yang sudah login. Tanpa `central:bootstrap`, instalasi baru mentok di
lingkaran itu dan hanya bisa dibuka lewat tinker di server produksi.

**Verifikasi sebelum menyerahkan ke pengguna:**

```bash
php artisan central:tenants-status          # perusahaan berstatus "active", 0 pending
```

Lalu lewat browser: login → `/c/{slug}/dashboard` terbuka → menu Perusahaan
(`/c/{slug}/admin/companies`) memperlihatkan kuota terpakai 1. Bila menu
Perusahaan menjawab 403 "tidak terikat ke organization mana pun", admin
terbentuk lepas dari organization — hapus user itu dan ulangi langkah 5.

---

## Jalur B — Server Lama yang Sudah Berjalan

Urutan lengkap, terukur, dan **sudah pernah dijalankan** ada di
[§G.2](#g2-urutan-cutover-deployment-existing--sudah-dilatih-bukan-direncanakan).
Ringkasnya:

1. **Latih dulu di salinan, jangan langsung di produksi.** Skripnya sudah ada:
   `DB_PASSWORD=… SUMBER=<db-lama> SLUG=<slug> bash docs/migrasi/latihan-cutover.sh`.
   Latihan penuh 2026-11-02 menemukan **dua penghenti cutover** yang tidak
   pernah muncul dengan data buatan: migration tenant yang diberi tanggal baru
   (adopt-database mati di `Duplicate column name`) dan URL lampiran yang tidak
   sadar tenant. Keduanya di §G.2.7–G.2.8.
2. Catat **baseline** sebelum menyentuh apa pun — `docs/migrasi/verifikasi-baseline.sql`
   mencetak jumlah baris per tabel, total nilai, saldo per rekening, dan nomor
   invoice. Jalankan sebelum dan sesudah, lalu `diff`. Tanpa baseline,
   "sepertinya aman" hanyalah perasaan.
3. `artisan down` → backup → baseline → restore dump jadi `tenant_{slug}` →
   migrate central → seed permission → organization →
   **rekonsiliasi buku migration** → `central:adopt-database` →
   `central:import-users` → `central:adopt-storage` + `storage:link` →
   **setel pola penomoran + `invoice:backfill-sequence`** → verifikasi →
   `artisan up`.
4. Bandingkan baseline. Baru buka akses.

Dua langkah yang **tidak ada** di versi lama daftar ini dan keduanya wajib:
rekonsiliasi buku migration (tanpa itu langkah adopsi mati) dan backfill urutan
invoice (tanpa itu invoice berikutnya mengulang nomor yang sudah terkirim ke
klien).

**Otomatis: `deploy.sh --cutover`.** Seluruh urutan ini dijalankan satu perintah,
lengkap dengan pemeriksaan sebelum downtime, gerbang verifikasi per langkah, dan
bisa dilanjutkan bila berhenti di tengah. Lihat [DEPLOY.md](guides/DEPLOY.md).
Urutan manual di §G.2 tetap berlaku sebagai penjelasan dan jalan cadangan.

**`central:bootstrap` di jalur ini: pakai `--tanpa-admin`.** Opsi itu hanya membuat
organization (idempoten). Jangan membuat akun operator sebelum impor: akun itu tanpa
keanggotaan (403 di mana-mana) dan merebut ID yang dipakai user lama, sehingga
`central:import-users` menolak jalan (§G.2.7 butir 6). Admin yang sebenarnya datang
dari `central:import-users`.

---

## GO-LIVE DI SERVER — Urutan Eksekusi

### G.1 Setup server (sekali saja)

> **KOREKSI 2026-11-02 — TIDAK ADA wildcard DNS/SSL.**
> Bagian ini sebelumnya menyuruh memasang `*.kisantra.com` beserta sertifikat
> wildcard lewat DNS-01 challenge. Itu peninggalan rancangan subdomain yang
> **dibatalkan**. Yang akhirnya dibangun adalah identifikasi perusahaan lewat
> **PATH**: `/c/{slug}/...`, dengan `InitializeTenancyByPath` sebagai satu-satunya
> resolver (diverifikasi: tidak ada `InitializeTenancyByDomain` di mana pun, dan
> seluruh 63 route modul ber-prefix `c/{company}`).
>
> Artinya **satu domain biasa sudah cukup**, sertifikat Let's Encrypt standar
> sudah cukup, dan tidak perlu akses API DNS provider. Ini justru alasan utama
> path dipilih dulu. Jangan kejar wildcard — Anda akan membuang waktu pada
> syarat yang tidak ada.
>
> Pelanggan di domain lain = **site CloudPanel baru** dengan instalasi sendiri
> (lihat Jalur A). Di dalam tiap site, grup pelanggan itu boleh punya banyak
> perusahaan lewat `/c/{slug}`.

```bash
# 1. DNS — satu A record biasa, tanpa wildcard
finance.kisantra.com    A    <IP-server>

# 2. SSL — Let's Encrypt standar (HTTP-01). Di CloudPanel cukup lewat UI.
certbot --nginx -d finance.kisantra.com

# 3. nginx — satu vhost, satu nama. Perusahaan dibedakan oleh PATH, bukan host.
server_name finance.kisantra.com;
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
`SESSION_SECURE_COOKIE=true`, `APP_URL=https://finance.kisantra.com`.

`SESSION_DOMAIN` **dikosongkan saja** — nilai `.kisantra.com` berawalan titik itu
gunanya berbagi cookie antar subdomain, dan kita tidak memakai subdomain. Cookie
cukup terikat ke satu host.

Dua hal lagi yang sudah terbukti perlu, dan tidak ada di PDF:

- **`php8.4-redis` wajib dipasang bila `.env` memakai `REDIS_CLIENT=phpredis`.**
  Tanpa ekstensinya, cache/session gagal saat boot, bukan degradasi halus.
  Alternatif tanpa pasang apa pun: `REDIS_CLIENT=predis` (sudah ada di composer).
- **Pastikan `public/hot` TIDAK ikut ter-deploy.** Berkas itu dibuat
  `npm run dev` dan membelokkan SELURUH aset ke Vite di port 5173. Kalau
  tertinggal di server, setiap halaman jadi layar putih tanpa pesan error apa
  pun. Sudah ter-gitignore, tetapi periksa sekali setelah rilis pertama.

### G.2 Urutan cutover deployment existing — **SUDAH DILATIH, BUKAN DIRENCANAKAN**

> **Latihan penuh 2026-11-02.** Seluruh rangkaian di bawah dijalankan terhadap
> **salinan** database berisi invoice bernomor gaya produksi
> (`INV/01/KSN/01.26` … `INV/04/KSN/03.26`), bukan data buatan. Dua langkah
> **GAGAL** saat latihan; keduanya akan menghentikan cutover produksi di tengah
> jalan kalau tidak diurus. Rinciannya di
> [G.2.7 Kegagalan nyata saat latihan](#g27-kegagalan-nyata-saat-latihan).
>
> **Diotomatiskan dan diuji 2026-11-04: `deploy.sh --cutover`.** Simulasi server
> produksi lama: klon repo di commit `4483821` (satu-database terakhir), `.env`
> bergaya produksi (cache/session/antrean `database`, config ter-cache), salinan
> DB dengan ID user berlubang (1, 3, 7, 9), role buatan sendiri, izin staff yang
> diubah lewat UI, feedback berlampiran, dan nomor invoice manual di luar pola.
> Hasil: `deploy.sh` lama dihentikan pengaman tanpa mengubah DB (begitu pula
> `migrate:rollback` yang disarankannya); lima penolakan sebelum downtime lulus;
> cutover dijeda di nomor invoice lalu dilanjutkan; ID user, role & izin (0 beda),
> feedback, berkas, dan baseline cocok; login dengan sandi lama, akses per peran,
> dan lampiran lewat `/c/{slug}/storage` lulus via HTTP; deploy rutin, canary
> gagal, rilis perbaikan, dan jalan "kembali ke versi lama" sesudah cutover
> selesai juga lulus. Dua cacat skrip ketemu dan diperbaiki sebelum rilis:
> `DELETE` multi-tabel tanpa database default ("No database selected") dan cek
> dump `gzip | grep -q` yang mati SIGPIPE pada dump besar.
>
> Latihannya bisa diulang siapa pun:
> `DB_PASSWORD=… bash docs/migrasi/latihan-cutover.sh`
> (sumber bawaan `finance_main_dev`; untuk dump Anda sendiri setel
> `SUMBER=` dan `SLUG=`). Skripnya **hanya membaca** database sumber dan hanya
> membuat/menghapus `latihan_*` + satu `tenant_{SLUG}`.

#### G.2.0 Prasyarat — periksa SEBELUM mengumumkan jadwal downtime

| Yang diperiksa | Perintah / cara | Harus bernilai |
|---|---|---|
| `BCRYPT_ROUNDS` server baru | `SELECT LEFT(password,7) FROM users LIMIT 1;` di DB lama | **≥** cost DB lama. `$2y$12$` berarti cost 12 → `BCRYPT_ROUNDS` wajib ≥ 12 |
| Koneksi `legacy` terdaftar | `LEGACY_DB_DATABASE=<nama db lama>` di `.env` | terisi; `config/database.php` sudah punya blok `legacy` |
| `mysqldump` di PATH | `which mysqldump` | ada. Windows biasanya `/c/Program Files/MySQL/MySQL Server 8.0/bin` |
| Buku migration tenant | `bash docs/migrasi/cek-migrasi-redate.sh tenant_{slug}` | tidak ada migration "hanya berubah tanggal" — kalau ada, lihat langkah 6 |
| Role warisan | `SELECT DISTINCT r.name FROM roles r JOIN model_has_roles m ON m.role_id=r.id;` di DB lama | hanya `admin`, `finance manager`, `staff`. Selain itu akan dilewati impor |

**`BCRYPT_ROUNDS` — terverifikasi di lapisan yang benar.** `Hash::check()`
**tidak** peduli cost (diuji: `BCRYPT_ROUNDS=10` tetap `true` untuk hash cost 12).
Yang peduli adalah cast `'password' => 'hashed'` di model `User`, dan
`central:import-users` menulis lewat cast itu:

```
BCRYPT_ROUNDS=12 → OK: cast menerima hash cost 12
BCRYPT_ROUNDS=10 → RuntimeException: Could not verify the hashed value's configuration.
```

Jadi gejalanya bukan "tidak bisa login", melainkan **impor mati di user pertama**.

#### G.2.1 Urutan perintah — salin-tempel

Ganti `{slug}`, `{org}`, `{DB_LAMA}` sesuai milik Anda. Contoh di sini memakai
slug `kisantra`, organization `kisantra-group`, DB lama `kisantra-finance`.

```bash
# ───── 1. BEKUKAN + BACKUP (titik mundur satu-satunya) ─────────────────────
php artisan down
mysqldump -u root -p --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 kisantra-finance > ~/cutover/freeze.sql
tar czf ~/cutover/storage-lama.tgz storage/app/public
cp .env ~/cutover/env-lama
ls -la ~/cutover/freeze.sql          # WAJIB bukan 0 byte

# ───── 2. BASELINE SEBELUM ──────────────────────────────────────────────────
mysql -u root -p kisantra-finance \
  < docs/migrasi/verifikasi-baseline.sql > ~/cutover/sebelum.txt

# ───── 3. PULIHKAN DUMP SEBAGAI DATABASE TENANT ─────────────────────────────
mysql -u root -p -e "CREATE DATABASE \`tenant_kisantra\` \
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p tenant_kisantra < ~/cutover/freeze.sql

# ───── 4. KODE BARU + DATABASE PUSAT ────────────────────────────────────────
#   .env: DB_DATABASE=<db pusat BARU, mis. kisantra_core>, LEGACY_DB_DATABASE=kisantra-finance
git pull && composer install --no-dev -o && npm ci && npm run build
php artisan migrate --force
php artisan db:seed --class=MasterPermissionSeeder --force
php artisan permission:cache-reset

# ───── 5. ORGANIZATION (tanpa akun) ────────────────────────────────────────
php artisan central:bootstrap --tanpa-admin --organization="Kisantra Group" --quota=5
#   Jangan buat akun operator: ia merebut ID user lama dan impor menolak jalan.

# ───── 6. REKONSILIASI BUKU MIGRATION — SEBELUM ADOPT, BUKAN SESUDAH ───────
bash docs/migrasi/cek-migrasi-redate.sh tenant_kisantra
#   Untuk setiap pasangan yang dilaporkan: bandingkan isinya dulu
#   diff <(git show main:database/migrations/<nama-lama>.php) \
#        database/migrations/tenant/<nama-baru>.php
#   Identik → jalankan pernyataan INSERT yang dicetak perintah itu.
#   Berbeda → JANGAN; telaah manual.

# ───── 7. ADOPSI DATABASE (IREVERSIBEL mulai di sini) ──────────────────────
php artisan central:adopt-database kisantra --organization=kisantra-group \
  --name="PT. Kinara Sadayatra Nusantara" --abbreviation=KSN
#   --abbreviation opsional: tanpa itu, admin wajib mengisi Singkatan di Profil
#   Perusahaan saat login pertama (gerbang EnsureCompanyProfileComplete).

# ───── 8. IMPOR USER ───────────────────────────────────────────────────────
php artisan central:import-users legacy --organization=kisantra-group \
  --company=kisantra --dry-run
php artisan central:import-users legacy --organization=kisantra-group \
  --company=kisantra

# ───── 9. BERKAS / LAMPIRAN ────────────────────────────────────────────────
php artisan central:adopt-storage kisantra --dry-run
php artisan central:adopt-storage kisantra        # MENYALIN, asli tetap ada
php artisan storage:link                          # aman bila sudah ada

# ───── 10. URUTAN NOMOR INVOICE — jangan dilewati, lihat G.2.5 ─────────────
#   10a. pola dulu: Pengaturan › Penomoran invoice → samakan dengan riwayat
#   10b. periksa:
php artisan tenants:run invoice:backfill-sequence \
  --tenants=kisantra --option="dry-run=1"
#   10c. kalau laporan "tidak cocok" sudah kosong (atau tinggal nomor manual):
php artisan tenants:run invoice:backfill-sequence --tenants=kisantra

# ───── 11. VERIFIKASI (G.2.3) lalu buka ────────────────────────────────────
mysql -u root -p tenant_kisantra \
  < docs/migrasi/verifikasi-baseline.sql > ~/cutover/sesudah.txt
diff ~/cutover/sebelum.txt ~/cutover/sesudah.txt
php artisan central:tenants-status
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan up
```

**Catatan sintaks yang memakan waktu saat latihan:** `tenants:run` meneruskan
opsi sebagai `key=value`. Menulis `--option=dry-run` (tanpa `=1`) menghasilkan
`Undefined array key 1` di dalam paket tenancy, bukan pesan yang membantu.
Flag boolean tetap harus ditulis `--option="dry-run=1"`.

#### G.2.2 Mana yang ireversibel, dan apa yang dibackup lebih dulu

| Langkah | Ireversibel? | Mundurnya |
|---|---|---|
| 1 backup, 2 baseline | tidak | — |
| 3 restore ke `tenant_{slug}` | tidak | `DROP DATABASE tenant_{slug}` |
| 4 `migrate --force` (pusat) | tidak, DB pusat **baru** | `DROP DATABASE` DB pusat, buat ulang |
| 5 `central:bootstrap --tanpa-admin` | tidak | hapus baris organization, atau buang DB pusat |
| 6 rekonsiliasi buku migration | menulis ke `tenant_{slug}.migrations` | `DELETE FROM migrations WHERE migration='…'` |
| **7 `central:adopt-database`** | **YA** | hanya lewat dump langkah 1: `DROP` + `CREATE` + restore `freeze.sql` |
| 8 `central:import-users` | tidak (idempoten) | hapus baris user/`company_user` di DB pusat |
| 9 `central:adopt-storage` tanpa `--pindahkan` | tidak | hapus `storage/tenant{slug}/` |
| 9 `central:adopt-storage --pindahkan` | **YA** — berkas asli hilang dari tempat lama | `storage-lama.tgz` langkah 1 |
| 10 `invoice:backfill-sequence` | menulis kolom | `UPDATE invoices SET invoice_sequence=NULL` |

Langkah 7 ireversibel karena `tenants:migrate` mengubah skema tenant: tiga
foreign key keuangan menjadi `RESTRICT` dan `receivables.interest_rate` menjadi
`decimal(8,4)`. Tidak ada `down()` yang dipanggil otomatis, dan sebagian
perubahan itu bisa gagal dibalik kalau sudah ada data yang memanfaatkannya.

**Jalan mundur penuh, terbukti pada latihan** (2,8 detik untuk DB 1,8 MB):

```bash
mysql -u root -p -e "DROP DATABASE \`tenant_kisantra\`; \
  CREATE DATABASE \`tenant_kisantra\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p tenant_kisantra < ~/cutover/freeze.sql
```

Hasil latihan: `diff` baseline sesudah pemulihan **identik** dengan sebelum —
nol baris berbeda. Kalau ingin kembali sepenuhnya ke deployment lama:
`cp ~/cutover/env-lama .env && php artisan config:clear && php artisan up`.

**`central:backup` tidak mencakup berkas.** Perintah itu men-dump DB pusat +
semua `tenant_%` ke gzip (latihan: `latihan_central` 4,8 KB +
`tenant_latihanc` 10,2 KB dalam 1,8 detik, dan dump pusat terbukti bisa
dipulihkan — jumlah baris `users`/`companies`/`company_user`/`model_has_roles`/
`permissions` 6/1/5/4/77 sama persis setelah restore). Folder
`storage/tenant*/` **tidak** ikut; backup berkas tetap manual (`tar czf`).

#### G.2.3 Cara memverifikasi tiap langkah SEBELUM lanjut

| Setelah langkah | Periksa | Lulus bila |
|---|---|---|
| 1 | `ls -la freeze.sql` | ukuran puluhan KB atau lebih, **bukan 0** |
| 3 | `SELECT COUNT(*) FROM tenant_{slug}.invoices;` | sama dengan DB lama |
| 4 | `php artisan migrate:status` | 0 Pending di pusat |
| 4 | keluaran seeder | `Total: 77 permissions`, `Admin: 77 / Finance Manager: 70 / Staff: 21` |
| 5 | keluaran perintah | "Organization dibuat" |
| 6 | `cek-migrasi-redate.sh` diulang | blok "hanya berubah tanggal" kosong |
| 7 | keluaran `tenants:migrate` | semua `DONE`, tidak ada `FAIL` |
| 7 | `php artisan central:tenants-status` | status `active`, Database `OK`, **Migration pending 0** |
| 8 | `SELECT COUNT(*) FROM users;` di pusat | = jumlah user DB lama, dengan **ID + email sama persis** (butir 6 §G.2.7) |
| 8 | daftar "role dilewati" | kosong, atau sudah Anda tangani |
| 9 | `find storage/tenant{slug} -type f \| wc -l` | = jumlah berkas yang dilaporkan perintah |
| 10 | laporan dry-run | "tidak cocok" kosong, atau tinggal nomor yang memang ketikan manual |
| 11 | `diff sebelum.txt sesudah.txt` | **hanya** blok urutan & pola invoice yang berbeda |

Tambahan yang hanya bisa dicek lewat browser (semuanya dilalui saat latihan
dengan akun hasil impor, bukan akun buatan):

| Halaman | Hasil latihan |
|---|---|
| `/login` dengan sandi lama | 302 → `/choose-company` — **sandi lama tetap berlaku**, hash tersalin apa adanya |
| `/c/{slug}/dashboard`, `invoices`, `clients`, `bank-accounts`, `reimbursements`, `fund-requests`, `loans`, `receivables`, `recurring-invoices`, `transaction-categories`, `services`, `feedbacks`, `settings`, `settings/company`, `settings/invoice-numbering`, `admin/users`, `admin/companies`, `admin/permissions`, `cash-flow/income`, `cash-flow/expenses`, `reports/profit-loss`, `invoices/1` | **200 semua** sebagai admin |
| `/c/{slug}/cash-flow` & `bank-accounts` sebagai **staff** | **403** — pembatasan peran ikut terbawa, bukan hilang |
| `/c/{slug}/invoice/1/download` | 200, `application/pdf`, 8.958 byte |

Angka baseline latihan, untuk gambaran bentuk keluarannya:

```
clients 5 | invoices 4 | invoice_items 5 | payments 4 | bank_accounts 3
bank_transactions 10 | transaction_categories 28 | sisanya 0
invoices.total_amount 11.000.000 | payments 9.000.000
bank_tx credit 5.000.000 | debit 9.000.000
saldo #1 BCA 55.000.000 | #2 Mandiri 30.000.000 | #3 BNI 100.000.000
```

Ketiga saldo itu dihitung ulang **lewat kode aplikasi sendiri**
(`BankAccount::withBalance()`, di dalam konteks tenant) dan cocok dengan rumus
di `verifikasi-baseline.sql`. Saldo tidak pernah disimpan, jadi kalau nilainya
berubah, yang berubah adalah data pembentuknya — bukan "angka saldonya".

#### G.2.4 Berapa lama — hasil ukur latihan

Latihan memakai DB **1,8 MB / 4 invoice / 3 rekening / 5 berkas (785 KB)** di
mesin lokal (MySQL 8.0, SSD). Angka ini **batas bawah**, bukan ramalan untuk
produksi Anda:

| Langkah | Waktu | Skala dengan |
|---|---|---|
| `mysqldump` sumber | 0,4 s | ukuran data |
| restore ke `tenant_{slug}` | 2,8–4,6 s | ukuran data |
| `migrate --force` (19 migration pusat) | 3,0 s | tetap |
| `MasterPermissionSeeder` | 1,5 s | tetap |
| `central:bootstrap` | 1,2 s | tetap |
| `cek-migrasi-redate.sh` | 2,1 s | tetap |
| rekonsiliasi buku migration | 0,1 s | tetap |
| `central:adopt-database` (2 migration berjalan) | 1,4 s | jumlah baris yang disentuh ALTER |
| `central:import-users` | 1,1 s | jumlah user |
| `central:adopt-storage` | 1,1 s | jumlah & ukuran berkas |
| `invoice:backfill-sequence` | 1,1 s (kering) / 1,7 s | jumlah invoice |
| `central:backup` (2 DB) | 1,8 s | ukuran data |
| **jalan mundur** (drop + create + restore) | **2,8 s** | ukuran data |

Seluruh skrip latihan — dari dump sumber sampai verifikasi selesai — berjalan
**28 detik** (`bash docs/migrasi/latihan-cutover.sh`, diukur `time`). Yang menentukan
downtime produksi bukan ini, melainkan (a) dump + restore data Anda yang
sebenarnya, (b) `npm ci && npm run build`, dan (c) waktu Anda membaca keluaran
tiap langkah sebelum lanjut. Rencanakan jendela **1 jam**, bukan 1 menit.

#### G.2.5 Jebakan `invoice_sequence` — tempatnya di langkah 10, sesudah adopsi

**Apa yang terjadi.** `invoices.invoice_sequence` diisi model hanya ketika
`invoice_number` **berubah** (`Invoice::booted()`). Invoice lama tidak pernah
berubah nomornya, jadi kolomnya kosong. Migrasi
`2026_10_08_004959_add_invoice_numbering_settings` memang mencoba mengisinya,
tapi dengan regex yang dipatok satu format: `^(\d+)\/INV\/`. Nomor berformat
`INV/01/KSN/01.26` tidak cocok satu pun — migrasi berhasil, kolom tetap NULL,
tanpa satu pun peringatan.

Akibatnya `InvoiceNumberService::nextSequence()` menghitung
`max(invoice_sequence) + 1` = `max(NULL) + 1` = **1**.

**Dibuktikan di latihan, dengan pola yang sudah disamakan ke riwayat**
(`INV/{NO}/{PT}/{BLN}.{THN2}`, padding 2, reset `yearly`):

```
SEBELUM BACKFILL -> nextSequence=1  nomor=INV/01/KSN/03.26
nomor yang sudah terbit: INV/01/KSN/01.26, INV/02/KSN/02.26,
                         INV/03/KSN/02.26, INV/04/KSN/03.26
```

Reset `yearly` berarti nomor **01 tahun 2026 sudah terpakai** — dan sudah
terkirim ke klien. Invoice berikutnya akan memakai urutan 01 lagi. Dua invoice
bernomor urut sama di tahun yang sama; yang ketiga, keempat, dan seterusnya
juga menabrak.

**Urutan yang benar — pola dulu, kering dulu, baru sungguhan.**

1. **Setel pola** di Pengaturan › Penomoran invoice sampai cocok dengan riwayat.
   Halaman itu memvalidasi polanya dan menampilkan pratinjau nomor berikutnya.
   Jangan membalik urutannya: `invoice:backfill-sequence` membaca **pola yang
   sedang berlaku**, jadi backfill dengan pola salah hanya menghasilkan nol.
2. **Dry-run**, lalu **baca laporan nomor tidak cocok.** Dengan pola bawaan yang
   belum disesuaikan, latihan menghasilkan tepat yang seharusnya:

   ```
   Pola aktif : {NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}
   Padding    : 3   Reset: monthly

   0 invoice AKAN diisi urutannya.

   4 nomor tidak cocok dengan pola aktif dan dibiarkan kosong:
     INV/01/KSN/01.26
     INV/02/KSN/02.26
     INV/03/KSN/02.26
     INV/04/KSN/03.26
   ```

   Sesudah polanya disamakan:

   ```
   Pola aktif : INV/{NO}/{PT}/{BLN}.{THN2}
   Padding    : 2   Reset: yearly

   4 invoice AKAN diisi urutannya.
   ```

   Nomor yang **tetap** tidak cocok karena memang diketik manual di luar pola
   apa pun aman dibiarkan kosong — tapi lihat dulu satu per satu, jangan
   diabaikan massal.
3. **Jalankan sungguhan**, lalu buktikan nomor berikutnya **menyambung**:

   ```
   #1 INV/01/KSN/01.26 urutan=1
   #2 INV/02/KSN/02.26 urutan=2
   #3 INV/03/KSN/02.26 urutan=3
   #4 INV/04/KSN/03.26 urutan=4
   SESUDAH BACKFILL -> nextSequence=5  NOMOR BERIKUTNYA=INV/05/KSN/03.26
   ```

4. **Canary nomor sungguhan** — bukan cuma hitungan di layanan. Latihan membuat
   draft, menerbitkannya, lalu menghapusnya kembali:

   ```
   draft dibuat  : id=5 nomor=NULL
   sesudah send  : nomor=INV/05/KSN/03.26 urutan=5
   nomor berikut : INV/06/KSN/03.26
   canary dihapus; jumlah invoice kembali ke 4
   nomor berikut setelah hapus: INV/05/KSN/03.26
   ```

   Urutan terisi otomatis saat nomor diberikan, dan menghapus canary
   mengembalikan deret — tidak meninggalkan lubang.

**Mengapa langkah 10 ada SESUDAH langkah 7, bukan sebelum.** Dua alasan:
`invoice:backfill-sequence` dijalankan lewat `tenants:run`, yang butuh
perusahaan sudah terdaftar; dan pola penomoran disimpan di
`company_profiles` **di dalam database tenant**, yang baru bisa dibuka lewat
aplikasi setelah adopsi. Tapi langkah 10 harus selesai **sebelum satu pun
invoice baru diterbitkan** — jadi: sebelum `php artisan up`.

#### G.2.6 Setelah go-live, sebelum tidur

```bash
php artisan central:tenants-status     # active, DB OK, 0 pending
php artisan central:backup             # backup pertama arsitektur baru
tar czf ~/cutover/storage-tenant.tgz storage/tenant{slug}
```

Lalu: arahkan DNS/subdomain, matikan deployment lama (redirect 301), aktifkan
backup malam + monitoring **sejak malam pertama**. Tabel sisa central di DB
adopsi (`users`, `roles`, `sessions`, `jobs`, `cache`, …) tidak dipakai lagi —
biarkan dulu seminggu, bersihkan setelah yakin.

#### G.2.7 Kegagalan nyata saat latihan

Lima hal pertama di bawah ini gagal atau menyesatkan saat latihan; keempat yang
pertama akan menghentikan cutover produksi. Butir 6-7 ditemukan kemudian, saat
menyiapkan `deploy.sh --cutover`.

**1. `central:adopt-database` MATI: `Duplicate column name 'system_key'`** —
ini kegagalan terpenting yang ditemukan latihan.

```
2026_08_11_102452_add_system_key_to_transaction_categories ......... 28.71ms FAIL
SQLSTATE[42S21]: Column already exists: 1060 Duplicate column name 'system_key'
```

Sebabnya: branch tenancy **memberi tanggal baru** pada dua migration yang di
`main` sudah berjalan di produksi, dan isinya **byte-identik** (diperiksa dengan
`diff`):

| Nama di produksi (`main`) | Nama di branch tenancy |
|---|---|
| `2026_09_17_000000_add_system_key_to_transaction_categories` | `2026_08_11_102452_add_system_key_to_transaction_categories` |
| `2026_09_17_000001_set_pl_group_on_interest_system_categories` | `2026_08_19_100000_set_pl_group_on_interest_system_categories` |

Laravel melacak migration **berdasarkan nama berkas**, jadi nama baru dianggap
belum pernah jalan. `tenants:migrate` menjalankannya ulang dan mati di `ALTER`
pertama. Dari 4 migration yang hendak dijalankan terhadap DB produksi, hanya 2
yang benar-benar baru:

```
2026_08_11_102452_add_system_key_to_transaction_categories      ← duplikat, mematikan
2026_08_19_100000_set_pl_group_on_interest_system_categories    ← duplikat
2026_08_20_100000_restrict_cascade_on_financial_foreign_keys    ← benar-benar baru
2026_08_20_110000_widen_receivable_interest_rate_precision      ← benar-benar baru
```

Penyelesaian saat latihan: catat nama baru sebagai sudah-dijalankan **sebelum**
adopsi (langkah 6), lalu ulangi — `central:adopt-database` aman diulang, ia
melaporkan "sudah terdaftar — melewati pembuatan, lanjut migrate" dan hanya
menjalankan 2 migration yang memang baru. `docs/migrasi/cek-migrasi-redate.sh`
dibuat untuk mendeteksi pasangan semacam ini, termasuk yang muncul di kemudian
hari.

**Catatan penting soal sifat `central:adopt-database`:** ia **tidak atomik**.
Baris `companies` dibuat lebih dulu, `tenants:migrate` menyusul. Saat migrate
gagal, perusahaan tetap terdaftar berstatus `active` padahal skemanya belum
selesai. Yang menyelamatkan adalah `central:tenants-status` → kolom
**Migration pending** harus 0. Jangan percaya status `active` saja.

**2. `--option=dry-run` bukan sintaks yang sah.** `tenants:run` memecah opsi
jadi `key=value`; tanpa `=` ia melempar `Undefined array key 1` dari dalam
paket. Tulis `--option="dry-run=1"`.

**3. Dua perintah di dokumen tidak ada / tidak lengkap** (sudah dikoreksi di
[Panduan Migrasi](panduan-migrasi.md) §6.3):

```
php artisan central:adopt-database latihan --dry-run
  → The "--dry-run" option does not exist.
php artisan central:import-users legacy --dry-run
  → Organization / company tujuan tidak ditemukan.   (wajib --organization + --company)
```

`central:adopt-database` memang tidak punya mode kering. Yang bisa dikeringkan
adalah `import-users`, `adopt-storage`, dan `invoice:backfill-sequence`.

**4. Admin hasil `central:bootstrap` 403 di mana-mana.** Tanpa `--company`,
perintah itu membuat organization + user, tetapi **tanpa keanggotaan perusahaan
dan tanpa role**. Di Jalur B itulah pemakaiannya — jadi akun itu memang lumpuh:

```
login ops@… → 302 /choose-company
/choose-company        → 403
/c/{slug}/dashboard    → 403
```

Pilihannya: (a) tambahkan akun itu sebagai anggota + beri role lewat menu
Pengguna memakai akun admin hasil impor, atau (b) jangan buat akun operator
sama sekali — hanya organization yang dibutuhkan langkah 7, dan admin datang
dari `central:import-users`. Latihan memakai (b) untuk kerja nyatanya.

**Status 2026-11-04:** (b) kini satu opsi, `central:bootstrap --tanpa-admin`, dan
(a) tidak lagi bisa dilakukan sebelum impor: akun operator merebut ID user lama
(butir 6).

**5. Role warisan dilewati — persis seperti dijanjikan.** Satu akun berrole
`staff_test` diimpor **tanpa** role, dan dilaporkan terang-terangan:

```
Selesai: 3 user baru, 0 sudah ada, 3 keanggotaan baru → company "latihanc".
Role berikut tidak ada di sistem baru — user terkait diimpor TANPA role:
  staff_test       1 user: staf.uji@kisantra.test
```

Role lain terbawa utuh: `admin` → `admin`, `finance manager` →
`finance manager`, `staff` → `staff`, semuanya ter-scope ke
`company_id = {slug}`. Impor diulang tiga kali: `0 user baru, 5 sudah ada,
0 keanggotaan baru` — idempoten, dan hash sandi **identik byte-per-byte** dengan
DB lama (dibandingkan dengan `l.password = c.password` di SQL).

**Status 2026-11-04:** `deploy.sh --cutover` menyalin role buatan sendiri beserta
izinnya dari DB lama sebelum impor, jadi user seperti ini tetap punya hak yang sama.

**6. ID user tidak dipertahankan saat impor** (ditemukan 2026-11-04, sudah
diperbaiki). Tabel bisnis di database perusahaan menyimpan ID user sebagai angka
tanpa FK: `reimbursements.user_id`/`reviewed_by`/`paid_by`,
`reimbursement_payments.paid_by`, `fund_requests.user_id`/`reviewed_by`/
`disbursed_by`, `receivables.approved_by`, dan debitur polimorfik
`receivables.debtor_id`. Impor lama membuat user dengan ID auto-increment, jadi
begitu ID lama berlubang (pernah ada user dihapus) atau akun operator dibuat lebih
dulu, catatan itu diam-diam menunjuk orang lain. Terbukti di DB demo:
`admin@gmail.com` ber-ID 1 di DB lama, ID 2 di pusat. Latihan tidak menangkapnya
karena ID sumbernya kebetulan rapat dan tanpa akun operator. Kini
`central:import-users` memakai ID lama dan **menolak jalan sebelum menulis apa pun**
bila ID itu sudah dipakai email lain, atau email itu sudah ada dengan ID lain
(`CentralUserImportTest`).

**7. Izin role yang diubah lewat UI dan riwayat feedback tidak ikut pindah**
(ditemukan 2026-11-04, ditangani `deploy.sh --cutover`). `MasterPermissionSeeder`
mengisi database pusat dengan izin bawaan, sehingga perubahan dari halaman Izin &
Peran hilang. `feedbacks` hidup di database pusat dan tidak tersalin oleh perintah
mana pun. Cutover kini menyalin keduanya (role/izin sesudah seeder; feedback
dengan `company_id = {slug}`).

#### G.2.8 Cacat produk yang ditemukan latihan — SUDAH diperbaiki

> **Status 2026-11-04: keduanya sudah diperbaiki di kode.** (a) Kedua berkas kembali
> bernama seperti di `main` produksi (`2026_09_17_000000_…`, `2026_09_17_000001_…`);
> `deploy.sh --cutover` tetap memeriksa pola ini sebelum downtime. (b) Berkas
> perusahaan dilayani route `/c/{slug}/storage/{path}` (`TenantStorageController`,
> dengan cek keanggotaan), dan middleware `SetCompanyUrlDefaults` mengarahkan
> `Storage::disk('public')->url()` ke route itu. Perusahaan kedua boleh di-onboard.
> Uraian di bawah dipertahankan sebagai catatan sejarah.

Dua hal di bawah ini ada di kode, bukan di prosedur. Latihan ini hanya
mendokumentasikannya.

**(a) Migration tenant yang diberi tanggal baru.** Dua berkas di
`database/migrations/tenant/` adalah salinan byte-identik dari migration `main`
dengan timestamp berbeda (tabel di G.2.7). Perbaikan sebenarnya: kembalikan nama
berkasnya ke nama di `main`, sehingga tidak ada deployment lama yang perlu
rekonsiliasi manual. Sampai itu dilakukan, langkah 6 **wajib** dan
`cek-migrasi-redate.sh` wajib dijalankan tiap cutover.

**(b) URL lampiran tidak sadar tenant.** `FilesystemTenancyBootstrapper`
memindahkan *root* disk `public` ke `storage/tenant{slug}/app/public`, tapi
`Storage::disk('public')->url()` tetap mengembalikan `APP_URL/storage/<path>` —
dan `public/storage` adalah symlink ke `storage/app/public` yang **central**.
Dibuktikan: berkas yang hanya ada di folder tenant tidak terlayani, sementara
berkas yang salinannya masih di folder central terlayani.

```
Storage::disk('public')->url(...)  → http://localhost/storage/bukti-url/khusus-tenant.txt
ada di disk tenant?                → true
ada di public/storage/… ?           → false
GET /storage/bukti-url/khusus-tenant.txt                        → 403 (tidak ada)
GET /storage/transaction-attachments/<lampiran nyata>.png       → 200 (salinan central)
```

Semua lampiran dilayani lewat jalur ini (`BankTransactionController`,
`CashFlowController`, `FundRequestController`, dst. memanggil
`Storage::disk('public')->url()`).

**Konsekuensi untuk cutover sekarang:**

- Jalankan `central:adopt-storage` **tanpa** `--pindahkan` (bawaan: menyalin).
- **JANGAN** hapus `storage/app/public` meski perintah menyarankannya. Selama
  masih ada **tepat satu** perusahaan, salinan central itulah yang membuat
  lampiran tetap tampil.
- Langkah verifikasi "buka transaksi berlampiran, pratinjaunya tampil" **lulus
  secara menyesatkan**: yang tampil adalah salinan central, bukan berkas tenant.
- **Perusahaan kedua tidak boleh di-onboard sebelum ini diperbaiki** — dua
  perusahaan akan berbagi satu folder central dan nama berkas bisa bertabrakan.

Perbaikan yang perlu dikerjakan di kode (di luar lingkup dokumen ini): layani
berkas tenant lewat route terkontrol (`TenantAssetsController` sudah ada di
paket) atau setel `url_override` + symlink per tenant, lalu ganti semua
`Storage::disk('public')->url()` untuk berkas milik tenant.

#### G.2.9 Daftar periksa sebelum menyebut cutover selesai

- [ ] `freeze.sql` + `storage-lama.tgz` + `env-lama` tersimpan di luar server, ukuran bukan 0
- [ ] `diff sebelum.txt sesudah.txt` hanya berbeda di blok urutan & pola invoice
- [ ] `central:tenants-status`: `active`, Database `OK`, **Migration pending 0**
- [ ] jumlah user di pusat = jumlah user DB lama; daftar "role dilewati" sudah ditangani
- [ ] satu user nyata berhasil login dengan **sandi lamanya**
- [ ] satu user berrole `staff` tetap 403 di halaman yang memang bukan haknya
- [ ] `invoice:backfill-sequence` sudah jalan; nomor berikutnya **menyambung**, bukan mengulang
- [ ] canary invoice: buat draft → terbitkan → nomornya lanjut → hapus
- [ ] satu invoice bisa diunduh sebagai PDF
- [ ] satu transaksi berlampiran tampil pratinjaunya (sadari peringatan G.2.8b)
- [ ] `central:backup` pertama sudah jalan dan hasilnya pernah **dicoba dipulihkan**
- [ ] `storage/app/public` **belum** dihapus (lihat G.2.8b)

### G.3 Setiap rilis berikutnya

`./deploy.sh` ([DEPLOY.md](guides/DEPLOY.md)): backup semua database
(`central:backup`), lalu `central:deploy-migrate --canary=<slug>` — database pusat
dulu, satu perusahaan sebagai percobaan, baru sisanya; bila canary gagal,
perusahaan lain tidak disentuh. Padanan manualnya:

```bash
git pull && composer install --no-dev && npm run build
php artisan central:deploy-migrate --force --canary=<uji>   # pusat → canary → sisanya
php artisan optimize && php artisan queue:restart
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
