# Multi-Tenancy Opsi A — Single Database + `company_id` Scoping

Dokumen ini menjelaskan rancangan multi-tenant untuk Finance Management System dengan pendekatan **satu database bersama, semua data milik tenant diberi kolom `company_id`, dan setiap query otomatis difilter berdasarkan perusahaan user yang sedang login**.

Aturan bisnisnya: **satu user terikat tepat ke satu perusahaan** dan tidak pernah bisa membaca/menulis data perusahaan lain.

---

## 1. Cara Kerja (Big Picture)

```
Request masuk
   │
   ▼
Auth middleware  ──►  auth()->user()->company_id   (mis. 3)
   │
   ▼
Controller menjalankan query biasa:
   Invoice::where('status', 'sent')->get()
   │
   ▼
Global Scope (trait BelongsToCompany) menyisipkan otomatis:
   ... AND invoices.company_id = 3
   │
   ▼
Hasil: hanya data perusahaan #3 yang pernah terlihat
```

Tiga mekanisme yang menegakkan isolasi:

1. **Global scope** — setiap query `SELECT/UPDATE/DELETE` lewat Eloquent otomatis ditambah `WHERE company_id = ?`. Developer tidak perlu (dan tidak boleh) menulis filter ini manual.
2. **Auto-fill saat create** — event `creating` mengisi `company_id` dari user login, sehingga data baru tidak mungkin "nyasar" ke tenant lain.
3. **Route model binding ikut ter-scope** — `GET /invoices/{invoice}` milik perusahaan lain otomatis `404`, karena binding memakai query Eloquent yang sudah difilter scope. Tidak perlu cek kepemilikan manual di controller.

Kelebihan pendekatan ini dibanding database-per-tenant: infrastruktur tidak berubah (satu DB, satu proses migrate, satu backup), seeding & testing tetap sederhana, dan isolasi ditegakkan di **satu titik** (trait) bukan tersebar di ratusan query.

---

## 2. Komponen Inti

### 2.1 Model `Company` (evolusi dari `CompanyProfile`)

Saat ini `CompanyProfile` adalah **singleton** — `CompanyProfile::current()` hanya memanggil `static::first()` ([app/Models/CompanyProfile.php](../app/Models/CompanyProfile.php)). Di dunia multi-tenant, tabel ini menjadi daftar tenant, dan "current" berarti "perusahaan milik user yang login".

Dua jalur yang mungkin:

- **Rename penuh** `company_profiles` → `companies` (bersih, tapi refactor menyebar), atau
- **Pertahankan nama** `CompanyProfile` dan cukup ubah makna `current()` (perubahan minimal — **direkomendasikan untuk fase awal**).

```php
// app/Models/CompanyProfile.php
public static function current(): ?self
{
    if (app()->bound(CurrentCompany::class)) {
        return app(CurrentCompany::class)->get();      // konteks eksplisit (queue/CLI)
    }

    return auth()->user()?->company;                   // konteks web biasa
}
```

Semua pemanggil `CompanyProfile::current()` / `CompanyProfile::first()` (InvoicePrintService, TemplateTokens, export services, FundRequest, RecurringInvoice, Invoice numbering, dll.) **tidak perlu berubah** — mereka otomatis mendapat profil perusahaan yang benar. Kecuali `CompanyProfile::first()` yang dipanggil langsung (mis. `Invoice::getCompanyInitials()` di [app/Models/Invoice.php](../app/Models/Invoice.php)) — itu wajib diganti ke `current()`.

### 2.2 Kolom `company_id` di `users`

```php
Schema::table('users', function (Blueprint $table) {
    $table->foreignId('company_id')
        ->constrained('company_profiles')
        ->restrictOnDelete();
});
```

Satu user = satu perusahaan, jadi cukup FK biasa (bukan pivot). Relasi di `User`:

```php
public function company(): BelongsTo
{
    return $this->belongsTo(CompanyProfile::class, 'company_id');
}
```

### 2.3 Trait `BelongsToCompany` — jantung sistem

Satu trait dipasang di semua model milik tenant. Ini satu-satunya tempat logika isolasi hidup.

```php
<?php

namespace App\Models\Concerns;

use App\Models\CompanyProfile;
use App\Support\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', function (Builder $query) {
            $companyId = static::resolveCurrentCompanyId();

            if ($companyId !== null) {
                $query->where($query->getModel()->getTable().'.company_id', $companyId);
            }
        });

        static::creating(function (Model $model) {
            if (empty($model->company_id)) {
                $model->company_id = static::resolveCurrentCompanyId()
                    ?? throw new \RuntimeException(
                        'Tidak ada konteks perusahaan saat membuat '.static::class
                    );
            }
        });
    }

    protected static function resolveCurrentCompanyId(): ?int
    {
        if (app()->bound(CurrentCompany::class)) {
            return app(CurrentCompany::class)->id();
        }

        return auth()->user()?->company_id;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(CompanyProfile::class, 'company_id');
    }
}
```

Poin penting desain:

- **Scope hanya aktif jika konteks ada.** Di CLI/queue tanpa konteks, query TIDAK difilter — tetapi `creating` justru **melempar exception** jika konteks kosong. Ini disengaja: membaca lintas tenant dari artisan (mis. `migrate`, laporan global admin) sah, tapi *membuat* data tanpa pemilik adalah bug yang harus meledak keras, bukan diam-diam.
- **Nama tabel disertakan** di `where` (`invoices.company_id`) supaya aman saat query pakai `join`.
- Melewati scope secara sadar: `Invoice::withoutGlobalScope('company')` — hanya untuk kode administratif lintas tenant, dan sebaiknya di-review ketat setiap muncul di PR.

### 2.4 `CurrentCompany` — konteks eksplisit untuk queue & CLI

Queue job dan artisan command tidak punya `auth()->user()`. Konteks tenant harus dibawa eksplisit:

```php
<?php

namespace App\Support;

use App\Models\CompanyProfile;

class CurrentCompany
{
    public function __construct(private CompanyProfile $company) {}

    public function get(): CompanyProfile { return $this->company; }

    public function id(): int { return $this->company->id; }

    /** Jalankan callback dalam konteks satu perusahaan */
    public static function runAs(CompanyProfile $company, \Closure $callback): mixed
    {
        app()->instance(self::class, new self($company));

        try {
            return $callback();
        } finally {
            app()->forgetInstance(self::class);
        }
    }
}
```

Pola di job:

```php
class GenerateInvoicePdfJob implements ShouldQueue
{
    public function __construct(
        public int $invoiceId,
        public int $companyId,          // WAJIB ikut di-serialize
    ) {}

    public function handle(): void
    {
        $company = CompanyProfile::findOrFail($this->companyId);

        CurrentCompany::runAs($company, function () {
            $invoice = Invoice::findOrFail($this->invoiceId);   // scope aktif ✓
            // ... generate PDF
        });
    }
}
```

**Invarian: setiap job yang menyentuh model ber-tenant wajib menerima `company_id` di constructor** dan membungkus `handle()` dengan `runAs()`.

---

## 3. Tabel yang Mendapat `company_id`

| Kelompok | Tabel | Catatan |
|---|---|---|
| Identitas | `users` | FK ke `company_profiles` |
| Master data | `clients`, `services`, `transaction_categories`, `pdf_templates`, `custom_fonts` | Kategori transaksi jadi per-tenant (tiap perusahaan punya taksonomi sendiri) |
| Invoice | `invoices`, `invoice_items`*, `payments`* | |
| Recurring | `recurring_templates`, `recurring_invoices` | |
| Bank | `bank_accounts`, `bank_transactions`* | |
| Workflow | `reimbursements`, `reimbursement_payments`*, `fund_requests`, `fund_request_items`* | |
| Pinjaman | `loans`, `loan_payments`*, `receivables`, `receivable_payments`* | |
| Lainnya | `feedbacks`, `app_notifications` | Notifikasi sudah per-user; `company_id` untuk kemudahan query/cleanup |

Tabel bertanda `*` adalah **anak** yang selalu diakses lewat induknya (`invoice->items`, `loan->payments`). Dua pilihan:

- **Denormalisasi** — beri `company_id` juga di tabel anak + pasang trait. Redundan tapi paling aman (query langsung ke `Payment::where(...)` pun ter-scope). **Direkomendasikan**, karena codebase ini memang punya query langsung ke `Payment`/`BankTransaction` (cash flow, laporan).
- Tanpa kolom di anak — mengandalkan induk yang sudah ter-scope. Lebih ramping tapi rapuh.

**Yang tetap global (tanpa `company_id`):** `roles`, `permissions`, `role_has_permissions`, `model_has_roles`, `migrations`, `sessions`, `cache`, `jobs`.

---

## 4. Perubahan Perilaku yang Wajib Dikawal

### 4.1 Penomoran invoice per perusahaan

`Invoice::getMaxSequenceFromDb()` menghitung sequence bulanan. Karena scope global sudah memfilter `company_id`, **sequence otomatis menjadi per-perusahaan tanpa mengubah logikanya** — `001/INV/KSN-.../I/2026` dan `001/INV/SPI-.../I/2026` bisa hidup berdampingan.

Dua hal yang tetap harus diubah:

1. `getCompanyInitials()` saat ini memanggil `CompanyProfile::first()` → ganti ke `CompanyProfile::current()`.
2. Unique constraint `invoice_number` (jika ada yang global) menjadi **komposit**: `unique(['company_id', 'invoice_number'])`. Berlaku juga untuk nomor fund request (`001/KSN/I/2026`).

Tambahan pengaman race condition antar-tenant tidak berubah — `whereYear/whereMonth` yang sama tetap dipakai, hanya ruangnya menyempit per tenant.

### 4.2 Saldo bank tetap computed

`BankAccount->balance` dihitung dinamis (initial + credit − debit). Karena `payments` dan `bank_transactions` ter-scope, perhitungan tidak berubah — tapi pastikan relasi yang dipakai accessor tidak memakai `withoutGlobalScope`.

### 4.3 Spatie Permission tetap global

Role `admin` / `finance manager` / `staff` dan 50 permission **tidak perlu fitur teams**. Alasannya: permission mengatur *apa yang boleh dilakukan*, sedangkan `company_id` mengatur *pada data siapa*. Seorang `admin` perusahaan A tetap tidak bisa melihat data perusahaan B — scope-lah yang menjaminnya, bukan role.

Jika suatu saat butuh "super admin" lintas perusahaan, itu kasus khusus: buat permission `manage all companies` dan berikan bypass scope secara eksplisit di tempat yang terkendali — **jangan** melonggarkan trait.

### 4.4 PDF, Excel export, laporan

Semua service (InvoicePrintService, CashFlowExportService, FundRequestExportService, ProfitLossReportController) membangun query dari model ber-scope dan mengambil identitas via `CompanyProfile::current()` — keduanya otomatis benar per-tenant. Yang perlu diaudit: pemanggilan `DB::` mentah atau `withoutGlobalScope` (semestinya tidak ada).

### 4.5 Notifikasi

`AppNotification::notify()` sudah per-user; user hanya milik satu perusahaan, jadi aman. `cleanupOld($days)` berjalan dari scheduler (tanpa konteks) — sesuai desain trait, *membaca/menghapus* lintas tenant dari CLI diperbolehkan, jadi cleanup tetap jalan global.

---

## 5. Langkah Implementasi (Urutan Eksekusi)

### Fase 0 — Fondasi
1. Migrasi: `users.company_id` (nullable dulu), backfill semua user existing ke perusahaan pertama, lalu ubah jadi `NOT NULL`.
2. Buat `App\Support\CurrentCompany` + trait `App\Models\Concerns\BelongsToCompany`.
3. Ubah `CompanyProfile::current()` sesuai §2.1; hapus asumsi singleton di halaman Settings → Company (menjadi "profil perusahaan saya", bukan "satu-satunya profil").
4. Registrasi/undangan user harus menetapkan `company_id` (admin membuat user hanya untuk perusahaannya sendiri).

### Fase 1 — Master data
5. Migrasi `company_id` untuk `clients`, `services`, `transaction_categories`, `pdf_templates`, `custom_fonts` (nullable → backfill → NOT NULL, pola yang sama untuk semua tabel).
6. Pasang trait di kelima model; jalankan test modul terkait.

### Fase 2 — Invoice & bank
7. Migrasi + trait: `invoices`, `invoice_items`, `payments`, `recurring_templates`, `recurring_invoices`, `bank_accounts`, `bank_transactions`.
8. Ganti `CompanyProfile::first()` → `current()` di `Invoice::getCompanyInitials()`.
9. Unique komposit untuk `invoice_number`.

### Fase 3 — Workflow & sisanya
10. `reimbursements(+payments)`, `fund_requests(+items)`, `loans(+payments)`, `receivables(+payments)`, `feedbacks`, `app_notifications`.
11. Audit semua job queue → tambahkan `company_id` + `runAs()`.

### Fase 4 — Pengerasan
12. Seeder: `DatabaseSeeder` membuat ≥2 perusahaan + 1 admin per perusahaan, data demo tersebar di keduanya (supaya kebocoran langsung ketahuan saat development).
13. Test isolasi (lihat §6).
14. Update dokumen modul di `docs/module/` yang alurnya berubah (aturan CLAUDE.md: perubahan perilaku modul = update dokumen di commit yang sama).

**Pola migrasi per tabel (dipakai berulang):**

```php
public function up(): void
{
    Schema::table('invoices', function (Blueprint $table) {
        $table->foreignId('company_id')->nullable()
            ->constrained('company_profiles')->restrictOnDelete();
    });

    DB::table('invoices')->whereNull('company_id')
        ->update(['company_id' => DB::table('company_profiles')->min('id')]);

    Schema::table('invoices', function (Blueprint $table) {
        $table->foreignId('company_id')->nullable(false)->change();
        $table->index('company_id');
    });
}
```

---

## 6. Strategi Testing

Isolasi tenant adalah invarian keamanan — wajib punya test khusus, bukan hanya happy path.

```php
public function test_user_cannot_see_other_companies_invoices(): void
{
    [$companyA, $companyB] = CompanyProfile::factory()->count(2)->create();
    $userA = User::factory()->for($companyA, 'company')->create();

    $invoiceB = CurrentCompany::runAs($companyB,
        fn () => Invoice::factory()->create());

    $this->actingAs($userA);

    $this->assertSame(0, Invoice::count());                       // scope query
    $this->getJson(route('invoices.show', $invoiceB))
        ->assertNotFound();                                       // route binding
}

public function test_created_records_are_stamped_with_company(): void
{
    $user = User::factory()->create();
    $this->actingAs($user);

    $client = Client::factory()->create();

    $this->assertSame($user->company_id, $client->company_id);
}

public function test_creating_without_company_context_throws(): void
{
    $this->expectException(\RuntimeException::class);

    Client::factory()->create();     // tanpa actingAs, tanpa runAs
}
```

Tambahan yang disarankan: satu test per modul yang memastikan **sequence nomor invoice independen antar perusahaan**, dan test bahwa job PDF/export menghasilkan data perusahaan yang benar saat dijalankan via `runAs`.

---

## 7. Jebakan yang Sudah Diantisipasi

| Jebakan | Mitigasi |
|---|---|
| Query `DB::table()` mentah melewati global scope | Konvensi: selalu `Model::query()` (sudah aturan Laravel Boost); audit `DB::` saat rollout |
| Job queue membaca semua tenant karena tanpa konteks | `creating` melempar exception tanpa konteks; konvensi `company_id` wajib di constructor job |
| `firstOrCreate`/`updateOrCreate` di CLI membuat baris tanpa tenant | Sama — exception dari `creating` |
| Lupa pasang trait di model baru | Test isolasi per modul + checklist review; opsional: test reflektif yang memastikan semua model (kecuali whitelist) memakai trait |
| Unique constraint lama masih global | Diubah komposit di fase migrasi tabel terkait |
| `CompanyProfile::first()` tersisa di kode lama | Grep `CompanyProfile::first` harus kosong setelah Fase 2 |
| Cache key bentrok antar tenant (mis. hasil laporan di-cache) | Sertakan `company_id` di cache key untuk semua cache berisi data tenant |

---

## 8. Ringkasan

- **Satu database, satu kolom, satu trait.** `company_id` di semua tabel milik tenant, `BelongsToCompany` menegakkan filter + stempel otomatis.
- **User → tepat satu perusahaan** via `users.company_id`; role Spatie tetap global.
- **`CompanyProfile` berhenti jadi singleton**; `current()` = perusahaan milik user login (atau konteks `CurrentCompany` di queue/CLI).
- **Penomoran invoice & fund request otomatis per-tenant** berkat scope, plus unique komposit.
- **Queue/CLI memakai konteks eksplisit** (`CurrentCompany::runAs`) — membuat data tanpa konteks langsung exception.
- Rollout bertahap per modul dengan pola migrasi nullable → backfill → NOT NULL, dikawal test isolasi.
