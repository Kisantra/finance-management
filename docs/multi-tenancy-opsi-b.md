# Multi-Tenancy Opsi B — Database per Tenant

Dokumen ini menjelaskan rancangan multi-tenant alternatif untuk Finance Management System:
**setiap perusahaan mendapat database sendiri yang terpisah fisik**. Tidak ada kolom
`company_id` — isolasi ditegakkan oleh koneksi database, bukan `WHERE`.

Pembanding: [multi-tenancy-opsi-a.md](multi-tenancy-opsi-a.md) (single database + scoping).
Bagian §6 dokumen ini (user multi-perusahaan) berlaku untuk **kedua** opsi.

---

## 1. Arsitektur & Cara Kerja

### 1.1 Dua jenis database

```
central_db                          ← "siapa tenant-nya, siapa user-nya"
│   ├── tenants                     (daftar perusahaan + nama database-nya)
│   ├── users                       (semua user, lintas perusahaan)
│   ├── company_user                (pivot: user ↔ tenant + role)
│   ├── sessions, cache, jobs       (infrastruktur)
│
├── tenant_kisantra                 ← seluruh data bisnis Kisantra
│   ├── clients, services
│   ├── invoices, invoice_items, payments
│   ├── bank_accounts, bank_transactions
│   ├── reimbursements, fund_requests, loans, receivables
│   ├── transaction_categories, pdf_templates
│   ├── company_profile             (identitas PDF: logo, NPWP, ttd)
│   └── roles, permissions, model_has_roles   (Spatie per-tenant, lihat §6)
│
├── tenant_semesta                  ← struktur tabel SAMA, isi milik Semesta
└── tenant_agsa
```

### 1.2 Alur satu request

```
Request: https://kisantra.finance.test/invoices
   │
   ▼
[1] Middleware tenancy membaca subdomain "kisantra"
   │       (atau: membaca perusahaan aktif dari session user login)
   ▼
[2] Lookup di central_db: tenants → database = "tenant_kisantra"
   │
   ▼
[3] Bootstrapper MENUKAR runtime:
   │     • koneksi DB default  → tenant_kisantra
   │     • cache prefix        → tenant_kisantra:*
   │     • storage path        → storage/tenants/kisantra/
   │     • koneksi queue       → job membawa tenant id
   ▼
[4] Controller berjalan TANPA sadar tenant:
        Invoice::where('status', 'sent')->get()
        → memang hanya bisa mengembalikan data Kisantra,
          karena database yang tersambung cuma berisi itu
```

Konsekuensi menarik: **kode model & controller hampir tidak berubah** — `Invoice::all()`
polos sudah aman. Kompleksitas pindah dari kode aplikasi ke **infrastruktur**:
provisioning, migrasi per-DB, routing, storage, queue.

### 1.3 Dampak ke kode existing

| Titik di codebase | Opsi A | Opsi B |
|---|---|---|
| Model (Invoice, Client, ...) | +trait `BelongsToCompany` | **Tidak berubah** |
| `CompanyProfile::current()` | Ganti: profil milik user login | **Tidak berubah** (`first()` tetap benar — tiap DB memang cuma punya 1 baris) |
| Penomoran invoice `getMaxSequenceFromDb()` | Otomatis ter-scope | **Tidak berubah** (sequence per-DB) |
| Migrations | Tambah kolom di ±20 tabel | **Dipindah** ke `database/migrations/tenant/` |
| Queue jobs | Wajib bawa `company_id` + `runAs()` | Wajib tenant-aware (ditangani package) |
| Seeder/testing | Multi-company di 1 DB | Setup tenancy per test |
| Laporan lintas perusahaan | 1 query tanpa scope | **Loop semua DB** + agregasi manual |

---

## 2. Implementasi dengan `stancl/tenancy`

Package standar de facto untuk pola ini (v3, dokumentasi: tenancyforlaravel.com).
**Sesuai protokol CLAUDE.md: baca dokumentasi resminya dulu sebelum implementasi —
bagian ini peta jalannya, bukan pengganti dokumentasi.**

### 2.1 Instalasi & model Tenant

```bash
composer require stancl/tenancy
php artisan tenancy:install     # publish config, migration tenants, TenancyServiceProvider
```

```php
// app/Models/Tenant.php
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    public static function getCustomColumns(): array
    {
        return ['id', 'name', 'slug'];
    }
}
```

Membuat tenant baru = satu perintah, sisanya otomatis (create DB + migrate + seed
via event `TenantCreated`):

```php
$tenant = Tenant::create(['name' => 'PT Kisantra', 'slug' => 'kisantra']);
$tenant->domains()->create(['domain' => 'kisantra.finance.example.com']);
```

### 2.2 Pemisahan migrasi

```
database/migrations/          ← central: tenants, domains, users, company_user,
│                                sessions, cache, jobs
database/migrations/tenant/   ← SEMUA migration bisnis existing dipindah ke sini:
                                 clients, invoices, payments, bank_*, reimbursements,
                                 fund_requests, loans, receivables, recurring_*,
                                 transaction_categories, pdf_templates, feedbacks,
                                 app_notifications, company_profiles,
                                 + tabel Spatie (roles, permissions, ...)
```

Perintah operasionalnya berubah:

```bash
php artisan migrate                 # hanya central
php artisan tenants:migrate         # semua tenant, satu per satu
php artisan tenants:migrate --tenants=kisantra   # satu tenant saja
php artisan tenants:seed
php artisan tenants:run 'app:cleanup-notifications'   # jalankan command per tenant
```

### 2.3 Routing

```php
// routes/tenant.php — seluruh routes/web.php existing pindah ke sini
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,          // atau by-path/by-session, lihat §6
    PreventAccessFromCentralDomains::class,
])->group(function () {
    // /dashboard, /invoices, /cash-flow, ... (semua route aplikasi)
});

// routes/web.php — menyisakan halaman central:
// landing, login terpusat, pemilihan perusahaan, superadmin panel
```

---

## 3. Skenario di Server (Deployment)

Asumsi: satu VPS (mis. 4 GB RAM), Ubuntu + nginx + PHP-FPM 8.4 + MySQL 8 — semua
tenant menumpang di server & instance MySQL yang sama, hanya database-nya yang terpisah.
(Skala lanjut: tenant besar bisa dipindah ke server MySQL lain — cukup ubah kolom
koneksi di tabel `tenants`.)

### 3.1 DNS & nginx (identifikasi via subdomain)

```
DNS:    *.finance.example.com    A    203.0.113.10      ← wildcard, sekali setup

nginx:  server_name finance.example.com *.finance.example.com;
        root /var/www/finance-management/public;
        # SATU vhost untuk semua tenant — Laravel yang membaca subdomain
```

SSL: wildcard certificate via Let's Encrypt DNS-01 challenge
(`certbot -d "*.finance.example.com"`). **Tenant baru tidak butuh sentuhan
nginx/DNS/SSL sama sekali** — subdomain apa pun langsung tertangkap wildcard.

### 3.2 MySQL

```sql
-- Satu user MySQL untuk aplikasi, dengan hak membuat database:
CREATE USER 'finance_app'@'localhost' IDENTIFIED BY '...';
GRANT ALL PRIVILEGES ON `central_db`.* TO 'finance_app'@'localhost';
GRANT ALL PRIVILEGES ON `tenant\_%`.* TO 'finance_app'@'localhost';
GRANT CREATE ON *.* TO 'finance_app'@'localhost';
```

`.env` hanya berisi koneksi central; koneksi tenant dibuat dinamis oleh package:

```env
DB_DATABASE=central_db
TENANCY_DB_PREFIX=tenant_        # nama DB tenant: tenant_{slug}
```

### 3.3 Queue worker & scheduler

- **Worker:** tetap **satu pool worker untuk semua tenant** (Supervisor/Horizon seperti
  biasa). Package menyisipkan tenant id ke payload setiap job dan menginisialisasi
  tenancy sebelum `handle()` berjalan — job Kisantra otomatis tersambung ke
  `tenant_kisantra`. Tidak perlu worker per tenant.
- **Scheduler:** command yang menyentuh data bisnis dibungkus per tenant:

```php
// routes/console.php
Schedule::command('tenants:run app:cleanup-notifications')->daily();
```

### 3.4 Deployment flow

```bash
git pull && composer install --no-dev && npm run build
php artisan migrate --force            # central dulu
php artisan tenants:migrate --force    # lalu SEMUA tenant, berurutan
php artisan config:cache && php artisan queue:restart
```

⚠ Titik rawan khas Opsi B: `tenants:migrate` gagal di tenant ke-N → sebagian tenant
sudah di skema baru, sebagian belum, sementara kode sudah baru untuk semuanya.
Mitigasi: migration harus backward-compatible (expand-contract), staging yang
memigrasikan salinan semua tenant sebelum production, dan alert kalau ada tenant
yang gagal.

### 3.5 Backup & storage

```bash
# Backup per database — restore satu perusahaan tanpa menyentuh yang lain:
mysqldump central_db > backup/central-$(date +%F).sql.gz
for db in $(mysql -N -e "SHOW DATABASES LIKE 'tenant\_%'"); do
    mysqldump "$db" | gzip > "backup/$db-$(date +%F).sql.gz"
done
```

Storage file (logo, ttd, stempel, lampiran reimbursement) dipisah otomatis oleh
bootstrapper: `storage/tenants/{slug}/...` — backup file juga per folder tenant.

### 3.6 Provisioning tenant baru — end to end

```
Superadmin isi form "Perusahaan Baru" (nama, slug, admin pertama)
   │
   ▼
Tenant::create()  →  event TenantCreated  →  otomatis:
   ├── CREATE DATABASE tenant_{slug}
   ├── tenants:migrate untuk tenant itu
   ├── seed: company_profile, roles+permissions (MasterPermissionSeeder),
   │         transaction_categories default
   ├── buat folder storage/tenants/{slug}
   └── daftarkan user admin pertama di pivot company_user
   │
   ▼
https://{slug}.finance.example.com langsung hidup (wildcard DNS + SSL)
```

---

## 4. Operasional Sehari-hari: Apa yang Berubah

| Aktivitas | Sekarang (single) | Opsi B |
|---|---|---|
| Migrate saat deploy | 1× | 1× central + N× tenant |
| Backup | 1 dump | 1 + N dump (tapi restore per perusahaan bersih) |
| Debug via tinker | langsung query | `Tenant::find('kisantra')->run(fn () => Invoice::count())` |
| Laporan konsolidasi antar perusahaan | (belum ada) | Loop semua tenant, agregasi manual di PHP |
| Tenant baru | — | 1 form, provisioning otomatis (§3.6) |
| Test suite | biasa | tiap test butuh buat/switch tenant DB (lebih lambat) |

---

## 5. Kapan Opsi B Menang

1. **Compliance / kontrak**: klien mensyaratkan datanya terpisah fisik, bisa
   diserahkan (`mysqldump` satu file = seluruh data dia), atau bisa dihapus total.
2. **SaaS publik self-service**: pendaftaran perusahaan tanpa campur tangan developer.
3. **Skala & noisy neighbor**: tenant besar dipindah ke server DB sendiri tanpa
   mengubah kode.
4. **Restore granular**: salah hapus di satu perusahaan → restore DB itu saja.

Kalau tidak ada satu pun di atas, biaya operasional §4 tidak terbayar —
[Opsi A](multi-tenancy-opsi-a.md) lebih tepat. Jalur evolusi juga searah: A → B
mudah (pecah data per `company_id` ke DB masing-masing), B → A menyakitkan.

---

## 6. Skenario: User dengan Akses ke 2+ Perusahaan

> Bagian ini berlaku untuk **Opsi A maupun Opsi B**. Kebutuhan "user bisa pegang
> 2 perusahaan" mengubah satu asumsi fundamental: relasi user–perusahaan bukan lagi
> satu-ke-satu (`users.company_id`), melainkan **many-to-many + konsep
> "perusahaan aktif"**.

### 6.1 Model data: pivot dengan role per perusahaan

Kebutuhan nyata: Pak Budi adalah **finance manager di Kisantra** sekaligus hanya
**staff di Semesta**. Artinya role tidak melekat pada user, melainkan pada
**pasangan (user, perusahaan)**:

```php
// central DB (Opsi B) atau DB utama (Opsi A)
Schema::create('company_user', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('tenant_id');            // Opsi A: foreignId('company_id')
    $table->string('role');                 // 'admin' | 'finance manager' | 'staff'
    $table->timestamps();
    $table->unique(['user_id', 'tenant_id']);
});
```

```php
// User.php
public function companies(): BelongsToMany
{
    return $this->belongsToMany(Tenant::class, 'company_user')
        ->withPivot('role');
}
```

### 6.2 "Perusahaan aktif" — satu konteks pada satu waktu

User multi-perusahaan **tidak pernah melihat data dua perusahaan sekaligus di layar
yang sama**. Ia selalu bekerja dalam konteks SATU perusahaan aktif, dan berpindah
lewat **company switcher** (dropdown di header, pola seperti pilih workspace di
Slack/GitHub):

```
Login (central)
   │
   ├── punya 1 perusahaan  → langsung masuk, tanpa pertanyaan
   └── punya ≥2 perusahaan → halaman/dropdown "Pilih Perusahaan"
                                │
                                ▼
              ┌─  Opsi B: redirect ke kisantra.finance.example.com
              │            (subdomain = konteks; session menyimpan pilihan)
              └─  Opsi A: session/DB simpan active_company_id;
                           CurrentCompany membaca ini, bukan users.company_id
```

Aturan yang wajib dijaga:

- Ganti perusahaan = **full page reload** (bukan sekadar ganti state React) — semua
  props Inertia, notifikasi, dan permission harus dihitung ulang dari nol.
- Setiap request memvalidasi: *user ini benar terdaftar di `company_user` untuk
  perusahaan aktif?* Kalau tidak → 403. (Opsi B: middleware sesudah
  `InitializeTenancy...`; Opsi A: pengecekan di resolver `CurrentCompany`.)
- Yang tidak punya akses perusahaan mana pun tidak bisa masuk aplikasi.

### 6.3 Role & permission per perusahaan

Karena role Budi berbeda di tiap perusahaan, assignment role Spatie harus hidup
**di dalam konteks perusahaan**:

- **Opsi B — otomatis beres.** Tabel `roles`/`model_has_roles` ada **di setiap DB
  tenant**. Di `tenant_kisantra` Budi tercatat `finance manager`; di
  `tenant_semesta` ia `staff`. `$user->can('approve reimbursements')` otomatis
  menjawab sesuai DB yang sedang aktif — tanpa kode tambahan. (Definisi 50
  permission tetap seragam karena `MasterPermissionSeeder` dijalankan per tenant.)
- **Opsi A — pakai fitur `teams` Spatie Permission.** Set `'teams' => true` di
  config dengan `team_foreign_key = company_id`, lalu setiap request set konteks:
  `setPermissionsTeamId($activeCompanyId)`. Assignment role menjadi per
  (user, company). Ini menambah kompleksitas yang di dokumen Opsi A §4.3 sengaja
  dihindari — **konsekuensi langsung dari membolehkan multi-perusahaan**.

### 6.4 Dampak per role

| Role | Perilaku dengan multi-company |
|---|---|
| `staff` di 2 perusahaan | Reimbursement/fund request yang ia buat tercatat di perusahaan aktif saat itu. "My Requests" per perusahaan — pindah konteks, pindah daftar. |
| `finance manager` di 2 perusahaan | Approve/pay hanya dalam konteks aktif. Angka dashboard, cash flow, laba rugi selalu satu perusahaan. |
| `admin` | Admin adalah admin **per perusahaan** — admin Kisantra tidak otomatis admin Semesta. Manajemen user di dalam aplikasi = mengelola keanggotaan perusahaan aktif saja. |
| **Superadmin (baru)** | Pemilik grup yang boleh semua perusahaan + membuat tenant baru. Ini konsep **di luar** role Spatie per-tenant: flag di central (mis. `users.is_superadmin`) + panel central terpisah. Laporan konsolidasi lintas perusahaan (kalau dibutuhkan) hidup di panel ini — dan di Opsi B berarti loop antar DB (§4). |

### 6.5 Konsekuensi desain yang jujur perlu dicatat

1. Fitur multi-perusahaan per user **menghapus keunggulan kesederhanaan** `users.company_id`
   di Opsi A — pivot + teams Spatie + active-company session wajib ada.
2. Di Opsi B, kebutuhan yang sama nyaris gratis di sisi permission (§6.3), tapi
   menuntut login terpusat + switcher lintas subdomain (cookie/session central).
3. Notifikasi (`app_notifications`) menjadi per (user, perusahaan): badge bell hanya
   menghitung notifikasi perusahaan aktif.
4. **Putuskan di awal** apakah multi-company user benar-benar dibutuhkan sekarang.
   Kalau "nanti mungkin": tetap bangun pivot `company_user` sejak awal (dengan
   satu baris per user) — jauh lebih murah daripada migrasi dari FK tunggal
   ke pivot di kemudian hari.

---

## 7. Ringkasan

- **Opsi B = isolasi fisik**: central DB (tenants, users, pivot) + satu DB penuh per
  perusahaan; kode model hampir tak berubah, kompleksitas pindah ke infrastruktur.
- **Di server**: wildcard DNS + satu vhost nginx + wildcard SSL; satu pool queue
  worker untuk semua tenant; deploy = migrate central lalu `tenants:migrate` semua;
  backup per database; tenant baru ter-provision otomatis tanpa sentuhan server.
- **User 2+ perusahaan** (berlaku di A maupun B): pivot `company_user` dengan role
  per perusahaan, konsep "perusahaan aktif" + switcher, validasi keanggotaan tiap
  request. Di Opsi B role per perusahaan otomatis; di Opsi A butuh Spatie teams.
- Rekomendasi tetap: mulai **Opsi A** + pivot `company_user` sejak awal, simpan
  Opsi B untuk kebutuhan compliance/SaaS publik — jalur evolusi A → B terbuka.
