# Modul: Invoice & Pembayaran

> Modul inti untuk menagih klien: membuat invoice berisi item layanan (dengan HPP/COGS dan titipan pajak), mengirimkannya (penomoran resmi), mencatat pembayaran ke rekening bank, serta mengekspor rekap (Excel/PDF) dan mencetak invoice per-lembar (PDF klasik maupun template builder). Route prefix: `/invoices` (CRUD + export), `/payments` (update/hapus pembayaran), `/invoice/{invoice}/download|preview` (PDF). Semua route digate permission Spatie: `view invoices` (grup), plus `create invoices`, `edit invoices`, `delete invoices` per aksi (lihat `routes/web.php` baris 133–203).

## Tabel Database

### `invoices`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_number` | string, **nullable saat draft**; diisi saat "send" dengan format `{seq 3 digit}/INV/{inisial perusahaan}-{inisial klien}/{bulan romawi}/{tahun}` (mis. `001/INV/KSN-ABC/VIII/2026`). Unique (divalidasi di `SendInvoiceRequest`). |
| `billed_to_id` | FK → `clients.id` (relasi `client()` di model) |
| `subtotal` | **integer rupiah penuh** — jumlah `amount` semua item |
| `discount_amount` / `discount_type` / `discount_value` / `discount_reason` | diskon; `discount_type` = `fixed` \| `percentage`; `discount_amount` adalah hasil hitung (integer) |
| `total_amount` | integer = `max(0, subtotal - discount_amount)` |
| `issue_date`, `due_date` | date (cast `date` di model) |
| `status` | enum: `draft`, `sent`, `paid`, `partially_paid`, `overdue`, `cancelled` |
| `faktur` | string nullable — nomor faktur pajak (konteks PKP/PPN). Saat ini hanya dibaca/ditampilkan (index & show); belum ada endpoint yang menulisnya. |

### `invoice_items`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_id` | FK → `invoices.id` |
| `client_id` | FK → `clients.id` — item bisa atas nama klien berbeda dari `billed_to_id` (kasus satu invoice menagih beberapa entitas klien) |
| `service_name` | string bebas (disalin dari master `services`, bukan FK) |
| `quantity` | decimal (cast `decimal:3`) — boleh pecahan, min `0.001` |
| `unit` | string satuan, default `'pcs'` |
| `unit_price`, `amount`, `cogs_amount` | integer rupiah penuh; `amount = round(unit_price × quantity)` |
| `is_tax_deposit` | boolean — item "titipan pajak": dikecualikan dari omzet/laba (lihat accessor `net_revenue`/`net_profit` di `app/Models/InvoiceItem.php`) |

### `payments`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_id` | FK → `invoices.id` |
| `bank_account_id` | FK → `bank_accounts.id` — **wajib** (`StorePaymentRequest`), pembayaran menaikkan saldo bank secara dinamis |
| `amount` | integer rupiah penuh, min 1 |
| `payment_date` | date |
| `payment_method` | enum: `cash` \| `bank_transfer` |
| `reference_number` | string nullable |
| `attachment_path`, `attachment_name` | bukti bayar (jpg/jpeg/png/pdf, max 5 MB) di disk `public` folder `payments/`; file ikut terhapus saat model dihapus (hook `deleting` di `app/Models/Payment.php`) |

## Fitur

### Daftar Invoice (Index + Statistik)
**Alur step-by-step:**
1. User membuka `/invoices` (GET, `can:view invoices`). Query string: `search`, `status`, `client_ids[]`, `month` (default bulan berjalan `Y-m`), `date_from`/`date_to`, `per_page`, `sort`, `direction`.
2. `InvoiceController::index()` membangun query dengan join `clients` + subquery jumlah `payments` per invoice, memfilter periode via `applyPeriodFilter()` (range tanggal **menimpa** filter bulan bila salah satu bound terisi).
3. Statistik dihitung dari scope terfilter yang sama tetapi **tanpa** filter status (karena tab status): revenue/HPP/laba **mengecualikan `draft` dan `cancelled`**; `total_cogs` mengecualikan item `is_tax_deposit`; outstanding = billed − paid pada invoice `sent`/`partially_paid`.
4. Respons: `Inertia::render('invoices/index', ...)` dengan props `invoices` (paginated), `stats`, `clients`, `rollbackableIds`, `customTemplates` (daftar `PdfTemplate` builder), `filters`.
5. UI menampilkan DataTable + StatsCard + tab per status; klik baris membuka Sheet detail yang fetch `/invoices/{id}` (JSON).

**Penjelasan kode** (`app/Http/Controllers/InvoiceController.php`):
```php
$rollbackableIds = Invoice::where('status', 'sent')
    ->whereNotNull('invoice_number')
    ->where('invoice_number', 'LIKE', '%/INV/%')
    ->get(['id', 'invoice_number', 'issue_date'])
    ->groupBy(fn ($inv) => date('Y-m', strtotime($inv->issue_date)))
    ->map(fn ($group) => $group->sortByDesc(fn ($inv) => (int) explode('/INV/', $inv->invoice_number)[0])->first())
    ->pluck('id');
```
Hanya invoice `sent` dengan **sequence tertinggi per bulan** yang boleh di-rollback — dikirim ke frontend agar tombol rollback hanya muncul di invoice yang eligible (menjaga penomoran tetap berurutan).

### Detail Invoice (Show — JSON)
**Alur:** UI (Sheet di `resources/js/pages/invoices/index.tsx`) melakukan `fetch('/invoices/{id}')` → `show()` mengembalikan JSON lengkap: header invoice + accessor `amount_paid`/`amount_remaining`, data klien (termasuk `NPWP`), daftar `items`, dan daftar `payments` beserta nama rekening bank & URL lampiran. Bukan halaman Inertia terpisah — semua interaksi detail terjadi dalam modal/sheet di halaman index.

### Buat Invoice (Create + Store)
**Alur step-by-step:**
1. User klik "Buat Invoice" → GET `/invoices/create` (`can:create invoices`). Controller mengirim props: klien `Active`, daftar `services` (id, name, price, type), `nextSeq` (preview nomor berikutnya), `companyInitials`.
2. User memilih klien penagihan, menyusun item (pilih service → `service_name` & `unit_price` terisi dari master, bisa diedit; isi `quantity`, `unit`, `cogs_amount`, centang `is_tax_deposit` bila item titipan pajak), atur diskon (`fixed`/`percentage`) + alasan, tanggal terbit & jatuh tempo.
3. Submit → POST `/invoices` (`can:create invoices`), divalidasi `StoreInvoiceRequest` (`items` min 1; `quantity` numeric min 0.001; `unit_price`/`cogs_amount` integer; `due_date after_or_equal:issue_date`).
4. `store()` dalam `DB::transaction`: hitung `amount = round(unit_price × quantity)` per item, `subtotal` = Σ amount, `discount_amount` (persen dihitung dari subtotal), `total_amount = max(0, subtotal − discount)`; insert `invoices` dengan `status='draft'` dan **tanpa `invoice_number`**, lalu insert semua `invoice_items`.
5. Redirect ke `invoices.index` dengan flash `success`.

**Penjelasan kode** (`app/Http/Controllers/InvoiceController.php::store`):
```php
$discountAmount = $discountType === 'percentage'
    ? (int) round($subtotal * $discountValue / 100)
    : $discountValue;
$totalAmount = max(0, $subtotal - $discountAmount);

$invoice = Invoice::create([... 'status' => 'draft']);
```
Diskon persentase dikonversi ke nominal integer saat simpan (kedua bentuk disimpan: `discount_value` mentah + `discount_amount` hasil). Invoice selalu lahir sebagai `draft` tanpa nomor — nomor baru diberikan saat "send".

### Edit Invoice (Edit + Update)
**Alur:** GET `/invoices/{invoice}/edit` (`can:edit invoices`) merender `invoices/edit` dengan data invoice + items; PUT `/invoices/{invoice}` divalidasi `UpdateInvoiceRequest` (identik dengan Store — `class UpdateInvoiceRequest extends StoreInvoiceRequest {}`). `update()` menghitung ulang subtotal/diskon/total seperti store, lalu **menghapus semua item lama dan membuat ulang** (`$invoice->items()->delete()` + insert baru) dalam satu transaksi. Status dan `invoice_number` **tidak diubah** oleh update.

### Hapus Invoice (Destroy)
**Alur:** DELETE `/invoices/{invoice}` (`can:delete invoices`) → transaksi: hapus `invoice_items` lalu invoice; redirect back. Catatan: pembayaran terkait tidak dihapus eksplisit di controller (bergantung pada FK constraint DB) — hapus invoice yang sudah punya pembayaran perlu kehati-hatian.

### Kirim Invoice (Send — penomoran resmi)
**Alur step-by-step:**
1. Di sheet detail invoice `draft`, user klik "Kirim" → dialog menampilkan nomor yang akan dipakai (frontend memakai `nextSeq` + inisial).
2. POST `/invoices/{invoice}/send` payload `{ invoice_number }`, divalidasi `SendInvoiceRequest` (`unique:invoices,invoice_number` kecuali dirinya).
3. `send()` menolak jika status bukan `draft` (flash `error`). Jika lolos: `$invoice->update(['invoice_number' => ..., 'status' => 'sent'])`.

**Penjelasan kode** (`app/Models/Invoice.php`):
```php
return sprintf('%03d/INV/%s-%s/%s/%d',
    $sequence, $companyInitials, $clientInitials, $romanMonth, $year);
```
`generateInvoiceNumber()` membentuk nomor. `getMaxSequenceFromDb()` mengambil sequence tertinggi dari invoice ber-nomor (`LIKE '%/INV/%'`) pada bulan-tahun `issue_date` yang sama, lalu +1 — sequence di-reset per bulan (dibuktikan `InvoiceNumberAssignmentTest::test_generate_invoice_number_starts_at_001_for_new_month`). Inisial diambil dari `CompanyProfile` dan nama klien dengan melewati kata badan usaha (`pt`, `cv`, dst.) via `extractInitials()`. Catatan: format praktis yang terlihat di data KSN adalah varian `{seq}/INV/KSN-.../{romawi}/{tahun}` (KSN = inisial perusahaan).

### Rollback Invoice (Sent → Draft)
**Alur:** POST `/invoices/{invoice}/rollback` → `rollback()` menolak jika status bukan `sent`, dan menolak jika `Invoice::isInvoiceLatestInMonth($invoice)` false (hanya sequence **tertinggi** di bulan `issue_date`-nya yang boleh, supaya tidak melubangi urutan nomor). Jika lolos: `invoice_number` di-null-kan dan status kembali `draft`.

### Pembayaran — Catat (POST /invoices/{invoice}/payments)
**Alur step-by-step:**
1. Di sheet detail, user klik "Tambah Pembayaran" → form: `amount` (CurrencyInput), `payment_date`, `payment_method` (`cash`/`bank_transfer`), `bank_account_id` (wajib; daftar dari `/api/bank-accounts`), `reference_number`, `attachment`.
2. Frontend submit via `fetch` multipart POST ke `/invoices/{invoice}/payments` (route ber-middleware `can:create invoices`), validasi `StorePaymentRequest`.
3. `PaymentController::store()` menolak (422 JSON) jika status invoice `draft` atau `paid` — hanya `sent`/`partially_paid` (dan status lain non-draft/paid) yang bisa dibayar. Lampiran disimpan ke `storage/app/public/payments`.
4. Insert `payments`, lalu **`$invoice->updateStatus()`** menghitung ulang status dari total pembayaran.
5. Respons JSON payment terformat; frontend `router.reload({ only: ['invoices', 'stats'] })`.

**Penjelasan kode** (`app/Models/Invoice.php::updateStatus`):
```php
if ($amountPaid == 0) {
    $this->status = 'draft';
} elseif ($amountPaid >= $this->total_amount) {
    $this->status = 'paid';
} else {
    $this->status = 'partially_paid';
}
$this->save();
```
Status murni turunan dari `amount_paid` vs `total_amount`. Gotcha: bila **semua** pembayaran dihapus, invoice jatuh ke `draft` (bukan `sent`), meskipun masih ber-nomor.

### Pembayaran — Ubah & Hapus (/payments/{payment})
**Alur:** POST `/payments/{payment}` dan DELETE `/payments/{payment}` digate `can:edit invoices`. `update()` (validasi `UpdatePaymentRequest` = Store + `remove_attachment` boolean) mengganti field, mengelola siklus lampiran (hapus file lama jika diganti/di-remove), lalu `$payment->invoice->updateStatus()`. `destroy()` menghapus payment (hook model ikut menghapus file lampiran) lalu `updateStatus()` pada invoice-nya. Keduanya merespons JSON.

### Export Rekap Excel & PDF
**Alur:** GET `/invoices/export/excel` dan `/invoices/export/pdf` (dalam grup `can:view invoices`) menerima query filter yang sama dengan index. `buildRecapData()` membangun baris per invoice — **mengecualikan `draft` & `cancelled`** — dengan kolom: omzet (`total_amount`), HPP (Σ `cogs_amount` per invoice), profit (omzet − HPP), `pph_final = round(omzet × 0.5%)` (PPh Final UMKM PP 55/2022), terbayar, sisa; plus baris summary dan label periode (range tanggal menimpa bulan). Excel via `App\Exports\InvoiceRecapExport` (Maatwebsite); PDF via DomPDF view `pdf.invoice-recap` A4 landscape + `CompanyProfile`. Perilaku ini dikunci oleh test `InvoiceControllerTest` (`test_export_excludes_draft_and_cancelled_from_omzet`, `test_export_includes_hpp_profit_and_pph_final`, `test_date_range_overrides_month_in_export`, dll.).

### Download / Preview PDF Invoice (per lembar)
**Alur step-by-step:**
1. Dari `PrintInvoiceDialog` (`resources/js/pages/invoices/components/print-invoice-dialog.tsx`), user memilih template dan mode pembayaran: full, DP (`dp_amount`), atau Pelunasan (`pelunasan_amount`).
2. GET `/invoice/{invoice}/download` atau `/invoice/{invoice}/preview` (`can:view invoices`), query: `template` (default `kisantra-invoice`), `dp_amount`, `pelunasan_amount`.
3. Routing template (closure di `routes/web.php` ±154–203):
   - `template=builder:{id}` → `PdfTemplate::findOrFail(id)` + `BuilderInvoicePrinter::render($pdfTemplate, $invoice, $dpAmount, $pelunasanAmount)`; nama file dari `->filename()` (prefix `DP-`/`Pelunasan-`).
   - selain itu → `InvoicePrintService::generateSingleInvoicePdf($invoice, $dp, $pelunasan, $template)` dengan template Blade `resources/views/pdf/{template}.blade.php` (`kisantra-invoice`, `semesta-invoice`, `agsa-invoice`, `invoice`).
4. `download` mengirim `streamDownload` (attachment); `preview` mengirim body PDF dengan `Content-Disposition: inline` (dibuka di tab/iframe).

**Penjelasan kode** (`app/Services/InvoicePrintService.php`):
```php
if ($template === 'semesta-invoice') {
    $ppnAmount = ($itemsTotal * $ppnRate / 100);          // PPN 11%
    $pph22Amount = $itemsTotal * 1.5 / 100;                // PPh 22 1,5%
    $grandTotal = $subtotalWithPpn - $pph22Amount - $discountAmount - (...);
} else { // kisantra (default)
    $ppnAmount = $company?->is_pkp ? ($displayAmount * $company->ppn_rate / 100) : 0;
    $grandTotal = $displayAmount + $ppnAmount;
}
```
Konteks PKP/PPN: template default hanya menambahkan PPN bila `CompanyProfile.is_pkp` true (rate `ppn_rate`, default 11%); template `semesta-invoice` selalu menghitung PPN 11% + potongan PPh 22 1,5%. Service juga memisahkan `regular_items` vs `tax_deposit_items`, menghitung `terbilang` (angka → kata bahasa Indonesia via `numberToWords()`), dan menyematkan logo/ttd/stempel sebagai base64. `BuilderInvoicePrinter` (`app/Services/BuilderInvoicePrinter.php`) me-render layout JSON `PdfTemplate` (banded atau flat legacy) dengan `paymentContext` mode `full|dp|pelunasan` dan custom font.

## Perhitungan Accessor (app/Models/Invoice.php)

| Accessor | Rumus |
|---|---|
| `amount_paid` | Σ `payments.amount` (pakai relasi yang sudah loaded bila ada) |
| `amount_remaining` | `total_amount − amount_paid` |
| `total_cogs` | Σ `items.cogs_amount` (catatan: **termasuk** item titipan pajak; stats index mengecualikannya via query terpisah) |
| `gross_profit` | `total_amount − total_cogs` |
| `outstanding_profit` / `paid_profit` | porsi laba yang belum/sudah "tertutup" pembayaran (model tutup-modal-dulu: pembayaran dianggap menutup HPP lebih dulu) |

## Keterkaitan Antar Modul
- **Bank Account:** setiap `Payment` ber-`bank_account_id`; saldo bank = `initial_balance + Σ payments + Σ tx credit − Σ tx debit` (accessor `getBalanceAttribute` di `app/Models/BankAccount.php`) — mencatat/menghapus pembayaran otomatis mengubah saldo tampilan tanpa menulis apa pun ke tabel bank.
- **Recurring Invoices:** `RecurringInvoice::publish()` membuat baris di `invoices` + `invoice_items` (lihat `docs/module/recurring-invoices.md`).
- **Clients:** `billed_to_id` dan `invoice_items.client_id`; menghapus klien meng-cascade hapus invoice & item-nya (override `Client::delete()`).
- **Services:** master harga saat menyusun item — hanya disalin (snapshot), tidak ada FK.
- **Cash Flow & Laporan Laba Rugi:** membaca `payments` (kas masuk) dan `cogs_amount`/`is_tax_deposit` untuk omzet/HPP.
- **PDF Templates (Settings):** `PdfTemplate` + `CustomFont` dipakai `BuilderInvoicePrinter`; daftar template builder dikirim ke halaman index sebagai `customTemplates`.

## Invarian & Jebakan
- Semua nominal **integer rupiah penuh** — jangan pernah pakai float; `quantity` satu-satunya decimal.
- Invoice `draft` tidak punya `invoice_number`; nomor hanya diberikan saat `send`, unik global, sequence reset per bulan `issue_date`.
- Rollback hanya untuk invoice `sent` dengan sequence **tertinggi** di bulannya (`isInvoiceLatestInMonth`) — jaga urutan nomor tanpa lubang.
- `updateStatus()` hanya menghasilkan `draft`/`partially_paid`/`paid`. Status `sent` diset manual oleh `send()`; `overdue` dan `cancelled` ada di enum DB tetapi tidak ada transisi otomatis di kode saat ini (cancelled hanya dipakai sebagai filter pengecualian statistik/export). Menghapus semua pembayaran invoice `sent` menjatuhkannya ke `draft`.
- Pembayaran ditolak untuk invoice `draft` dan `paid` (`PaymentController::store`, HTTP 422).
- `update()` invoice **menghapus dan membuat ulang seluruh item** — ID `invoice_items` tidak stabil; jangan menyimpan referensi ke ID item.
- Statistik & export mengecualikan `draft` + `cancelled` dari omzet/HPP/laba; item `is_tax_deposit` dikecualikan dari HPP di stats index tetapi accessor `total_cogs` model **tidak** mengecualikannya.
- Filter periode: `date_from`/`date_to` diam-diam menimpa `month` bila terisi.
- Saldo bank dihitung dinamis — tidak ada kolom saldo yang perlu (atau boleh) di-update saat mencatat pembayaran.
- Endpoint payment & show merespons **JSON** (dipakai via `fetch`), bukan redirect Inertia — jangan diubah ke redirect tanpa menyesuaikan frontend.

## File Kunci
- `routes/web.php` (baris ±131–203) — definisi route invoices/payments/invoice PDF
- `app/Http/Controllers/InvoiceController.php`, `app/Http/Controllers/PaymentController.php`
- `app/Http/Requests/StoreInvoiceRequest.php`, `UpdateInvoiceRequest.php`, `SendInvoiceRequest.php`, `StorePaymentRequest.php`, `UpdatePaymentRequest.php`
- `app/Models/Invoice.php`, `app/Models/InvoiceItem.php`, `app/Models/Payment.php`, `app/Models/BankAccount.php`
- `app/Services/InvoicePrintService.php`, `app/Services/BuilderInvoicePrinter.php`, `app/Exports/InvoiceRecapExport.php`
- `resources/views/pdf/kisantra-invoice.blade.php` (+ `semesta-invoice`, `agsa-invoice`, `invoice`, `invoice-recap`)
- `resources/js/pages/invoices/index.tsx`, `create.tsx`, `edit.tsx`, `components/print-invoice-dialog.tsx`
- `tests/Feature/InvoiceControllerTest.php`, `tests/Feature/PaymentControllerTest.php`, `tests/Feature/InvoiceNumberAssignmentTest.php`
