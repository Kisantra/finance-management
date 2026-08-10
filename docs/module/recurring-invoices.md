# Modul: Recurring Invoices

> Otomasi penagihan berulang: user membuat **template** per klien (frekuensi monthly/quarterly/semi_annual/annual berisi snapshot item invoice dalam JSON), lalu tiap bulan men-generate **draft recurring invoice** dari template yang jatuh tempo, dan mem-**publish** draft menjadi Invoice sungguhan di tabel `invoices`. Route prefix: `/recurring-invoices`; permission: `view recurring-invoices`, `create recurring-invoices`, `edit recurring-invoices` (lihat `routes/web.php` baris ±208–254). Generate bersifat **manual** dari UI — tidak ada scheduled task.

## Tabel Database

### `recurring_templates`
| Kolom | Tipe/Catatan |
|---|---|
| `client_id` | FK → `clients.id` |
| `template_name` | string |
| `start_date`, `end_date` | date — batas masa berlaku siklus |
| `frequency` | enum: `monthly`, `quarterly`, `semi_annual`, `annual` |
| `status` | enum: `active`, `inactive`, `archived` |
| `invoice_template` | **JSON** (cast `array`) — snapshot invoice: `items[]` (client_id, service_name, quantity, unit, unit_price, amount, cogs_amount, is_tax_deposit), `subtotal`, `discount_type/value/amount/reason`, `total_amount` — semua nominal integer rupiah penuh |

### `recurring_invoices`
| Kolom | Tipe/Catatan |
|---|---|
| `template_id` | FK → `recurring_templates.id` |
| `client_id` | FK → `clients.id` (disalin dari template) |
| `scheduled_date` | date — tanggal 1 bulan penagihan (kunci unik logis per template+bulan) |
| `issue_date`, `due_date` | date nullable — diisi/di-overwrite saat publish |
| `invoice_data` | **JSON** (cast `array`) — struktur sama dengan `invoice_template`; boleh diedit per-draft tanpa mengubah template |
| `status` | enum: `draft`, `published` |
| `published_invoice_id` | FK nullable → `invoices.id` setelah publish |

## Fitur

### Halaman Utama (Index: tab Templates / Monthly / Analytics)
**Alur:** GET `/recurring-invoices` (`can:view recurring-invoices`) dengan query `tab`, `month`/`year`, `template_id`, `status`, `analytics_year`, `analytics_period` (`monthly`|`quarterly`). `RecurringInvoiceController::index()` mengirim satu payload Inertia (`recurring-invoices/index`) berisi: semua template (dengan progress `generated/published/remaining` dihitung dari `getValidMonths()`), daftar recurring invoice bulan terpilih + statistik bulanan (revenue/HPP/profit dari `invoice_data`), data analytics tahunan, serta opsi form (klien aktif, services, template aktif).

**Penjelasan kode** (`app/Http/Controllers/RecurringInvoiceController.php::formatTemplate`):
```php
$totalCount = $template->getTotalInvoicesCount();     // total siklus seumur hidup
$generatedCount = $invoices->count();
'progress_pct' => $totalCount > 0 ? round(($generatedCount / $totalCount) * 100) : 0,
```
Progress template = jumlah draft/publish yang sudah digenerate dibagi total siklus valid dari model interval.

### Template — Create / Update
**Alur step-by-step:**
1. GET `/recurring-invoices/templates/create` (`can:create recurring-invoices`) → halaman `create-template` dengan opsi klien aktif & services. Edit: GET `/templates/{template}/edit` (`can:edit`).
2. Submit POST `/recurring-invoices/templates` (atau PUT `/templates/{template}`), validasi `StoreTemplateRequest`/`UpdateTemplateRequest`: `frequency in:monthly,quarterly,semi_annual,annual`, `end_date after:start_date`, `items` min 1 (quantity **integer** min 1 di sini, beda dengan invoice biasa yang decimal).
3. Controller memanggil `buildInvoiceData($data)` untuk menyusun JSON `invoice_template`: hitung `amount = unit_price × quantity` per item, `subtotal` **mengecualikan item `is_tax_deposit`**, diskon fixed/percentage, `total_amount = max(0, subtotal − discount)`.
4. Insert/update `recurring_templates` (create selalu `status='active'`) dalam transaksi; respons redirect Inertia (atau JSON untuk non-Inertia).

**Penjelasan kode** (`buildInvoiceData`):
```php
if (! $isTaxDeposit) {
    $subtotal += $amount;   // titipan pajak tidak masuk subtotal template
}
```
Berbeda dengan `InvoiceController::store` (yang menjumlahkan semua item ke subtotal), builder recurring mengecualikan item titipan pajak dari subtotal/total.

### Template — Destroy (soft-archive) & Restore
**Alur:** DELETE `/recurring-invoices/templates/{template}` (`can:edit recurring-invoices`) → `destroyTemplate()`:
```php
$hasPublished = $template->recurringInvoices()->where('status', 'published')->exists();
if ($hasPublished) {
    $template->update(['status' => 'archived']);   // jejak audit dipertahankan
} else {
    $template->recurringInvoices()->delete();
    $template->delete();
}
```
Template yang sudah punya invoice terpublish **tidak dihapus**, hanya diarsipkan; kalau belum, template beserta seluruh draft-nya dihapus permanen. POST `/templates/{template}/restore` mengembalikan status ke `active` (dipakai untuk template `archived`/`inactive`).

### Kalkulasi Siklus (Model Interval)
**Penjelasan kode** (`app/Models/RecurringTemplate.php::getValidMonths`):
```php
$cycleDate = match ($this->frequency) {
    'monthly'     => $cycleDate->addMonth(),
    'quarterly'   => $cycleDate->addMonths(3),
    'semi_annual' => $cycleDate->addMonths(6),
    'annual'      => $cycleDate->addYear(),
};
if ($cycleDate->gt($endDate)) { break; }
$months[] = ['year' => ..., 'month' => ...];
```
Siklus maju dari `start_date` per interval; bulan penagihan pertama adalah **satu interval setelah start_date** (contoh di komentar kode: start 19 Feb, end 10 Des, monthly → tagihan 19 Mar … 19 Nov; 19 Des > end, berhenti). `isValidPeriodForGeneration($year, $month)` mengecek apakah pasangan tahun-bulan ada di daftar siklus valid; `getTotalInvoicesCount()` = jumlah siklus. Catatan: method bernama `calculateNextGenerationDate()`/`isDueForGeneration()` yang disebut di CLAUDE.md sudah digantikan model `getValidMonths()`/`isValidPeriodForGeneration()` di kode saat ini.

### Generate Monthly (batch dari template aktif)
**Alur step-by-step:**
1. Di tab Monthly, user memilih bulan/tahun target + `issue_date` & `due_date` lalu klik Generate → POST `/recurring-invoices/monthly/generate` (`can:create recurring-invoices`), validasi inline: `month` 1–12, `year`, `due_date after_or_equal:issue_date`.
2. `generateMonthly()` mengambil template `active` dengan `start_date < tanggal-1-bulan-target <= end_date`.
3. Per template dilewati jika: sudah ada `recurring_invoices` untuk template+bulan itu (idempoten, aman diklik ulang), atau bulan target bukan siklus valid (`isValidPeriodForGeneration` — inilah yang membuat template quarterly hanya tergenerate tiap 3 bulan).
4. Insert `recurring_invoices` status `draft` dengan `invoice_data` = **salinan** `invoice_template` dan `scheduled_date` = tanggal 1 bulan target.
5. Respons JSON `{generated, message}`.

### Monthly Draft — Store / Update / Destroy (manual per-draft)
**Alur:** POST `/recurring-invoices/monthly` (`StoreMonthlyRequest`) membuat satu draft manual dari template terpilih — ditolak 422 bila sudah ada draft template+bulan yang sama; `invoice_data` disusun ulang via `buildInvoiceData` dari item yang diedit user. PUT `/monthly/{invoice}` (`UpdateMonthlyRequest`) mengubah `scheduled_date`/tanggal/`invoice_data` — **ditolak 422 jika status `published`**. DELETE `/monthly/{invoice}` juga menolak draft yang sudah published. Semua respons JSON.

### Publish (draft → Invoice sungguhan)
**Alur step-by-step:**
1. User klik Publish pada draft → dialog minta `issue_date` & `due_date` → POST `/recurring-invoices/monthly/{invoice}/publish` (`can:edit recurring-invoices`).
2. `publishMonthly()` menolak jika sudah `published`; menyimpan issue/due date lalu memanggil `$invoice->publish()`.
3. Respons JSON berisi `invoice_number` hasil publish.

**Penjelasan kode** (`app/Models/RecurringInvoice.php::publish`):
```php
$invoice = Invoice::create([
    'invoice_number' => $this->generateInvoiceNumber(),  // format sama: {seq}/INV/...
    'billed_to_id' => $this->client_id,
    'subtotal' => $this->invoice_data['subtotal'],
    ...
    'status' => 'draft',
]);
foreach ($this->items as $itemData) { $invoice->items()->create([...]); }
$this->update(['status' => 'published', 'published_invoice_id' => $invoice->id]);
```
Publish membuat baris `invoices` + `invoice_items` nyata (idempoten: bila sudah published, mengembalikan `publishedInvoice` yang ada). Perhatikan dua hal: (1) invoice hasil publish **langsung diberi `invoice_number`** (sequence dihitung dari bulan `issue_date`) padahal statusnya `draft` — berbeda dengan alur invoice manual yang baru ber-nomor saat send; (2) `is_tax_deposit` dan `unit` **tidak disalin** ke `invoice_items` (hanya service_name, quantity, unit_price, amount, cogs_amount). `due_date` fallback = issue/scheduled + 30 hari.

### Bulk Publish & Bulk Destroy
**Alur:** POST `/monthly/bulk-publish` (payload `ids[]`, `issue_date`, `due_date`) — loop publish semua draft terpilih; kegagalan per-item dicatat ke log tanpa menghentikan sisanya; respons `{published}`. POST `/monthly/bulk-destroy` (payload `ids[]`) — `whereIn(id)->where('status','draft')->delete()`; yang published otomatis kebal terhapus.

### Analytics
**Alur:** Bagian dari index (query `analytics_year`, `analytics_period`). `buildAnalytics()` menghitung dari `invoice_data` (bukan tabel invoices!): total revenue tahun berjalan vs tahun lalu + growth rate, revenue per bulan/kuartal untuk chart, performa per template (revenue, success rate = published/total, profit margin dari `amount − cogs_amount` item), dan breakdown status draft vs published.

## Keterkaitan Antar Modul
- **Invoices:** `publish()` menulis ke `invoices` + `invoice_items`; setelah itu invoice mengikuti alur normal (send, payment, PDF). `published_invoice_id` menautkan balik.
- **Clients:** `client_id` di template & draft; klien juga dipakai untuk inisial nomor invoice saat publish.
- **Services:** master pilihan item saat menyusun template/draft (snapshot, bukan FK).
- **Dashboard/Sidebar:** jumlah draft recurring dipakai sebagai action count.

## Invarian & Jebakan
- **Satu recurring invoice per template per bulan** — dicek di `generateMonthly` dan `storeMonthly`; generate aman diulang (idempoten).
- Draft `published` **tidak bisa** diedit/dihapus; bulk-destroy diam-diam melewati yang published.
- Semua angka finansial recurring hidup di JSON (`invoice_template`/`invoice_data`) — analytics & stats membacanya langsung; mengubah template **tidak** mengubah draft yang sudah tergenerate (data disalin saat generate).
- Subtotal template mengecualikan item `is_tax_deposit` (beda dengan invoice manual); dan saat publish, flag `is_tax_deposit` + `unit` tidak ikut tersalin ke `invoice_items`.
- Invoice hasil publish berstatus `draft` tetapi **sudah ber-nomor** — nomor mengambil sequence bulan `issue_date`, jadi pilih issue_date dengan sadar saat publish agar penomoran bulan benar.
- Bulan penagihan pertama = start_date + 1 interval (bukan bulan start_date itu sendiri).
- Template dengan invoice terpublish tidak pernah dihapus, hanya `archived` (destroyTemplate).
- Nominal integer rupiah penuh di semua field JSON; `quantity` pada recurring divalidasi **integer** min 1.

## File Kunci
- `routes/web.php` (baris ±208–254) — route templates/monthly/bulk
- `app/Http/Controllers/RecurringInvoiceController.php`
- `app/Http/Requests/StoreTemplateRequest.php`, `UpdateTemplateRequest.php`, `StoreMonthlyRequest.php`, `UpdateMonthlyRequest.php`
- `app/Models/RecurringTemplate.php` (siklus interval), `app/Models/RecurringInvoice.php` (`publish()`, penomoran)
- `app/Models/Invoice.php`, `app/Models/InvoiceItem.php` (target publish)
- `resources/js/pages/recurring-invoices/index.tsx`, `create-template.tsx`, `edit-template.tsx`
