# Dokumentasi Modul — Gabungan

> File ini adalah gabungan seluruh dokumen di `docs/module/` (digenerate dari file per-modul).
> Sumber kebenaran tetap file per-modul; regenerate file ini bila ada perubahan.

## Daftar Isi

- [Dokumentasi Modul — Finance Management](#README)
- [Modul: Invoice & Pembayaran](#invoices)
- [Modul: Recurring Invoices](#recurring-invoices)
- [Modul: Clients (Klien)](#clients)
- [Modul: Services (Layanan)](#services)
- [Modul: Bank Accounts (Rekening Bank)](#bank-accounts)
- [Modul: Cash Flow (Arus Kas)](#cash-flow)
- [Modul: Transaction Categories (Kategori Transaksi)](#transaction-categories)
- [Modul: Permintaan Dana (Fund Requests)](#fund-requests)
- [Modul: Reimbursement](#reimbursements)
- [Modul: Loans (Utang Perusahaan)](#loans)
- [Modul: Receivables (Piutang)](#receivables)
- [Modul: Profit & Loss (Laporan Laba Rugi)](#profit-loss)
- [Modul: Dashboard](#dashboard)
- [Modul: Notifications (AppNotification)](#notifications)
- [Modul: Feedbacks](#feedbacks)
- [Modul: Admin — Users & Permissions/Roles](#admin-users-permissions)
- [Modul: Settings (Profil, Password, Perusahaan, PDF Template Builder)](#settings)

---

<a id="README"></a>

# Dokumentasi Modul — Finance Management

> **Untuk AI agent & developer baru:** folder ini adalah sumber kebenaran naratif per modul.
> Sebelum mengubah sebuah modul, baca file modulnya di sini terlebih dahulu — jangan langsung
> scanning seluruh codebase. Setiap file menjelaskan seluruh fitur modul, cara kerjanya
> step-by-step, dan penjelasan kode mengikuti alur data.
>
> **Aturan pemeliharaan:** jika sebuah perubahan mengubah perilaku modul (alur, status,
> endpoint, aturan bisnis), perbarui dokumen modulnya **di commit yang sama**.

## Daftar Modul

| Dokumen | Cakupan | Route utama |
|---------|---------|-------------|
| [invoices.md](#invoices) | Invoice, item, diskon, pembayaran, PDF/Excel | `/invoices`, `/payments`, `/invoice/{id}` |
| [recurring-invoices.md](#recurring-invoices) | Template recurring, generate bulanan, publish | `/recurring-invoices` |
| [clients.md](#clients) | Master data klien (individu/perusahaan, NPWP) | `/clients` |
| [services.md](#services) | Master data layanan | `/services` |
| [bank-accounts.md](#bank-accounts) | Rekening bank, saldo terhitung, transaksi | `/bank-accounts` |
| [cash-flow.md](#cash-flow) | Pemasukan, Pengeluaran, Transfer, export PDF | `/cash-flow/*` |
| [transaction-categories.md](#transaction-categories) | Kategori hierarkis, pl_group, reassign-delete | `/transaction-categories` |
| [fund-requests.md](#fund-requests) | Permintaan dana: workflow + pencairan | `/fund-requests` |
| [reimbursements.md](#reimbursements) | Reimbursement: workflow + pembayaran parsial | `/reimbursements` |
| [loans.md](#loans) | Utang perusahaan + pembayaran pokok/bunga | `/loans` |
| [receivables.md](#receivables) | Piutang (debtor polimorfik User/Client) | `/receivables` |
| [profit-loss.md](#profit-loss) | Laporan Laba Rugi (basis kas, pl_group) | `/reports/profit-loss` |
| [dashboard.md](#dashboard) | Dashboard & redirect fallback permission | `/dashboard` |
| [notifications.md](#notifications) | Notifikasi in-app (bell + drawer) | `/notifications` |
| [feedbacks.md](#feedbacks) | Feedback/bug report internal | `/feedbacks` |
| [admin-users-permissions.md](#admin-users-permissions) | User, role, permission (Spatie) | `/admin/*` |
| [settings.md](#settings) | Profil, password, company, PDF template builder | `/settings/*` |

## Peta Alur Data Lintas Modul

Semua uang bermuara di dua tabel: `payments` (pembayaran invoice) dan `bank_transactions`
(semua mutasi kas lain). Saldo rekening **tidak pernah disimpan** — selalu dihitung:

```
saldo = initial_balance + Σ payments + Σ transaksi credit − Σ transaksi debit
```

Alur yang menghasilkan mutasi kas:

```
Invoice ──(payment)──────────────────────────► payments ─────────┐
Fund Request ──(disburse, 1 debit per item)──► bank_transactions │
Reimbursement ──(pay, per pembayaran)────────► bank_transactions ├──► Saldo Bank
Loan ──(create: credit FIN-LOAN-IN)──────────► bank_transactions │    (computed)
     ──(pay: debit FIN-LOAN-OUT+EXP-INTEREST)► bank_transactions │
Receivable ──(cair: debit FIN-RCV-OUT)───────► bank_transactions │
           ──(cicilan: credit FIN-RCV-IN)────► bank_transactions ┘
Cash Flow (input manual income/expense/transfer)──► bank_transactions
```

Laporan Laba Rugi membaca `payments` (pendapatan) + `bank_transactions` yang kategorinya
punya `pl_group` (revenue/other_income/cogs/opex/other_expense/tax) — lihat
[profit-loss.md](#profit-loss) dan dokumen kebijakan `.claude/context/laba-rugi.md`.

## Konvensi Lintas Modul

- **Currency**: semua nominal disimpan `bigint` rupiah penuh (150000 = Rp 150.000), tanpa desimal.
- **Permission**: Spatie Permission; gate di route (`can:...`), FormRequest, dan UI (`useCan`).
  Struktur lengkap: `database/seeders/MasterPermissionSeeder.php`.
- **Frontend**: Inertia + React; controller mengirim props, halaman di `resources/js/pages/<modul>/`.
  Komponen wajib pakai katalog di CLAUDE.md (Combobox, DatePicker, CurrencyInput, FileUpload, dll.).
- **Workflow status**: state machine hidup di model (`canSubmit()`, `approve()`, dst.), bukan controller.
- **Kategori sistem Loans/Receivables** (bug `code` SUDAH DIPERBAIKI 2026-08-11): kategori sistem
  kini diidentifikasi lewat kolom `system_key` (`FIN-LOAN-IN` dst.) via
  `TransactionCategory::findSystem()`; kategori ber-`system_key` tidak bisa diedit/dihapus dari UI.
  Detail di [transaction-categories.md](#transaction-categories), [loans.md](#loans),
  [receivables.md](#receivables).
- **Multi-tenancy (Tahap 1–2 selesai)**: satu database per perusahaan (stancl/tenancy v3).
  Semua route aplikasi ber-prefix **`/c/{company}`** (slug); migration bisnis di
  `database/migrations/tenant/` (jalankan `tenants:migrate`, bukan `migrate`); Spatie teams
  (`company_id` string) dengan role global + assignment per perusahaan; model central
  (User/Role/Permission/Organization/AppNotification/Feedback) memakai trait `CentralConnection`;
  session/cache/queue di koneksi central. Frontend: literal path WAJIB lewat `companyUrl()`
  (`@/lib/company`), pencocokan URL aktif lewat `appPath()`. Test: 1 database, URL auto-prefix
  di `tests/TestCase.php`. Rencana & status: `docs/multi-tenancy-runbook-eksekusi.md`.
- **Test = spesifikasi**: aturan bisnis paling akurat ada di `tests/Feature/` per modul.

---

<a id="invoices"></a>

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

---

<a id="recurring-invoices"></a>

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

---

<a id="clients"></a>

# Modul: Clients (Klien)

> Master data klien — perorangan (`individual`) atau badan usaha (`company`) — dengan atribut perpajakan Indonesia (NPWP, KPP, EFIN, Account Representative). Klien adalah pihak tertagih pada invoice (`invoices.billed_to_id`) dan pemilik item invoice (`invoice_items.client_id`). Route prefix: `/clients`; permission: `view clients` (grup), `create clients`, `edit clients`, `delete clients` (`routes/web.php` baris ±116–121). Seluruh CRUD berlangsung di satu halaman index (modal), tanpa halaman create/edit/show terpisah.

## Tabel Database

### `clients`
| Kolom | Tipe/Catatan |
|---|---|
| `name` | string, wajib |
| `type` | enum: `individual` \| `company` |
| `email` | nullable, unique |
| `NPWP` | string(20) nullable — Nomor Pokok Wajib Pajak; tampil di invoice PDF & detail invoice |
| `KPP` | string(20) nullable — Kantor Pelayanan Pajak terdaftar |
| `EFIN` | string(20) nullable — Electronic Filing Identification Number |
| `logo` | nullable (ada di fillable model; tidak divalidasi/di-set oleh form saat ini) |
| `status` | `Active` \| `Inactive` (divalidasi `in:Active,Inactive`; **case-sensitive**, lihat Jebakan) |
| `account_representative`, `ar_phone_number` | AR pajak + nomor teleponnya |
| `person_in_charge` | PIC klien |
| `address` | text nullable |

Catatan relasi: CLAUDE.md menyebut relasi self-referential owners/companies, tetapi **kode saat ini tidak memilikinya** — `app/Models/Client.php` hanya mendefinisikan `invoices()`, `invoiceItems()`, dan `receivables()` (morphMany sebagai `debtor`). Sisa jejak legacy: `Invoice::getClientInitials()` masih membaca `$client->company_name`, kolom yang tidak ada di fillable — selalu jatuh ke `$client->name`.

## Fitur

### Daftar Klien (Index)
**Alur step-by-step:**
1. GET `/clients` (`can:view clients`), query: `search` (name/email/NPWP), `type`, `status`, `per_page` (default 10), `sort` (default `name`), `direction`.
2. `ClientController::index()` memuat klien + `withCount('invoices')` + eager load invoice ringkas untuk menghitung `total_invoice_amount` dan `paid_invoice_amount` per klien.
3. Stats: total, `Active`, per `type`.
4. Respons `Inertia::render('clients/index', ...)`; UI: DataTable + StatsCard + tombol tambah/edit/hapus via dialog.

**Penjelasan kode** (`app/Http/Controllers/ClientController.php`):
```php
->withCount('invoices')
->with(['invoices' => fn ($q) => $q->select('id', 'billed_to_id', 'total_amount', 'status')])
...
'total_invoice_amount' => $client->invoices->sum('total_amount'),
'paid_invoice_amount' => $client->invoices->where('status', 'paid')->sum('total_amount'),
```
Ringkasan penagihan per klien dihitung in-memory dari relasi yang di-load minimum kolom — inilah sumber kolom "total tagihan" dan "sudah dibayar" di tabel klien.

### Tambah Klien (Store)
**Alur:** User klik "Tambah" → dialog form → POST `/clients` (`can:create clients`), validasi `StoreClientRequest` (`type in:individual,company`, `email unique:clients`, `status in:Active,Inactive`, field pajak nullable max 20). Controller menormalkan string kosong menjadi `null` (`array_map(fn ($v) => $v ?: null, $validated)`) sebelum `Client::create()`, lalu redirect back dengan flash `success` ("Klien berhasil ditambahkan.").

### Ubah Klien (Update)
**Alur:** PUT `/clients/{client}` (`can:edit clients`), validasi `UpdateClientRequest` — mewarisi `StoreClientRequest` tetapi meng-override aturan email menjadi `unique:clients,email,{id}` sehingga email milik klien itu sendiri tidak dianggap duplikat. Pola sama dengan store (normalisasi empty→null, `$client->update()`), redirect back.

### Hapus Klien (Destroy) — cascade manual
**Alur:** DELETE `/clients/{client}` (`can:delete clients`) → `$client->delete()`.

**Penjelasan kode** (`app/Models/Client.php`):
```php
public function delete()
{
    $this->invoiceItems()->delete();  // hapus semua item milik klien
    $this->invoices()->delete();      // hapus semua invoice tertagih ke klien
    return parent::delete();
}
```
Model meng-override `delete()` untuk cascade manual: **menghapus klien ikut menghapus seluruh invoice dan invoice item-nya** — destruktif dan tidak bisa dibatalkan; UI wajib memakai `ConfirmDialog`. Pembayaran (`payments`) pada invoice tersebut tidak dihapus eksplisit di sini.

## Keterkaitan Antar Modul
- **Invoices:** `invoices.billed_to_id` → klien tertagih; `invoice_items.client_id` → item bisa atas nama klien lain dalam satu invoice; nama & `NPWP` klien tampil di invoice PDF; inisial nama klien dipakai dalam format nomor invoice (`{seq}/INV/{perusahaan}-{klien}/...`).
- **Recurring Invoices:** template & draft terikat `client_id`; hanya klien aktif yang muncul di opsi form.
- **Receivables:** klien bisa menjadi debtor polymorphic (`receivables()` morphMany).
- **API kecil:** GET `/api/clients` (closure di `routes/web.php`) menyediakan opsi label/value untuk Combobox lintas modul.
- Halaman create invoice hanya menampilkan klien `status = 'Active'`.

## Invarian & Jebakan
- **Hapus klien = hapus semua invoice + item-nya** (override `delete()`); tidak ada soft delete.
- Inkonsistensi kapitalisasi status: form/validasi memakai `Active`/`Inactive` dan `InvoiceController::create` memfilter `where('status', 'Active')`, tetapi `RecurringInvoiceController` memfilter `where('status', 'active')` (lowercase) — berfungsi hanya bila collation DB case-insensitive; jangan "merapikan" salah satu sisi tanpa menyamakan keduanya.
- Relasi self-referential owners/companies **tidak ada** di kode saat ini meskipun terdokumentasi di CLAUDE.md; `company_name` juga bukan kolom nyata (legacy di kalkulasi inisial).
- `email` unique tapi nullable — banyak klien tanpa email tidak masalah.
- Field kosong disimpan sebagai `NULL`, bukan string kosong (normalisasi di controller).
- Nama kolom pajak memakai huruf besar apa adanya (`NPWP`, `KPP`, `EFIN`) — ikuti persis di query/props.

## File Kunci
- `routes/web.php` (baris ±116–121, plus `/api/clients` baris ±92–99)
- `app/Http/Controllers/ClientController.php`
- `app/Http/Requests/StoreClientRequest.php`, `app/Http/Requests/UpdateClientRequest.php`
- `app/Models/Client.php`
- `resources/js/pages/clients/index.tsx`
- `tests/Feature/ClientControllerTest.php`

---

<a id="services"></a>

# Modul: Services (Layanan)

> Master data layanan/jasa yang dijual perusahaan — nama, kategori (`type`), dan harga default (integer rupiah penuh). Dipakai sebagai sumber pilihan saat menyusun item invoice dan template recurring: nama & harga **disalin** (snapshot) ke item, bukan direferensikan via FK. Route prefix: `/services`; permission: `view services` (grup), `create services`, `edit services`, `delete services` (`routes/web.php` baris ±123–128). CRUD sepenuhnya di satu halaman index (modal).

## Tabel Database

### `services`
| Kolom | Tipe/Catatan |
|---|---|
| `name` | string, wajib |
| `type` | enum (divalidasi `in:`): `Perizinan`, `Administrasi Perpajakan`, `Digital Marketing`, `Sistem Digital` — daftar resmi ada di konstanta `ServiceController::TYPES` |
| `price` | **integer rupiah penuh** (cast `integer`), min 0 — harga default, dapat di-override per item invoice |

## Fitur

### Daftar Layanan (Index)
**Alur step-by-step:**
1. GET `/services` (`can:view services`), query: `search` (name), `type`, `per_page` (default 10), `sort` (default `created_at`), `direction` (default `desc`).
2. `ServiceController::index()` mem-paginate hasil dan menghitung stats agregat satu query (`COUNT`, `AVG(price)`, `MAX(price)`) plus breakdown jumlah per `type`.
3. Respons `Inertia::render('services/index', ...)` dengan props `services`, `stats`, `types` (untuk Combobox filter/form), `filters`.

**Penjelasan kode** (`app/Http/Controllers/ServiceController.php`):
```php
$aggregate = Service::selectRaw('COUNT(*) as total, AVG(price) as avg_price, MAX(price) as highest_price')
    ->toBase()->first();
```
Stat card (total layanan, harga rata-rata, harga tertinggi) dihitung agregat di DB; `avg_price` di-cast `(int)` agar tetap konsisten integer rupiah.

### Tambah Layanan (Store)
**Alur:** Dialog form → POST `/services` (`can:create services`), validasi `StoreServiceRequest`:
```php
'name' => ['required', 'string', 'max:255'],
'type' => ['required', 'in:Perizinan,Administrasi Perpajakan,Digital Marketing,Sistem Digital'],
'price' => ['required', 'integer', 'min:0'],
```
`Service::create($request->validated())` → redirect back flash `success`. Input harga di UI memakai `CurrencyInput` (mengirim raw integer).

### Ubah Layanan (Update)
**Alur:** PUT `/services/{service}` (`can:edit services`), validasi `UpdateServiceRequest` (aturan sama), `$service->update()`, redirect back. Perubahan harga **tidak** mempengaruhi invoice/template yang sudah ada (harga di-snapshot ke item saat penyusunan).

### Hapus Layanan (Destroy)
**Alur:** DELETE `/services/{service}` (`can:delete services`) → `$service->delete()`, redirect back. Aman terhadap data historis: `invoice_items` menyimpan `service_name` string, bukan `service_id`, sehingga tidak ada FK yang putus.

## Keterkaitan Antar Modul
- **Invoices:** `InvoiceController::create/edit` mengirim daftar services (id, name, price, type) sebagai opsi item; saat item dipilih, `service_name` & `unit_price` disalin dan bebas diedit.
- **Recurring Invoices:** `RecurringInvoiceController` mengirim daftar yang sama untuk penyusunan `invoice_template`/`invoice_data`.
- Tidak ada relasi Eloquent dari `Service` ke tabel lain — murni master snapshot.

## Invarian & Jebakan
- `price` integer rupiah penuh — jangan pernah kirim/parse desimal; helper `Service::parseAmount()` tersedia untuk membersihkan string berformat (`Rp 1.500.000` → `1500000`).
- Daftar `type` di-hardcode di dua tempat yang harus sinkron: `ServiceController::TYPES` dan aturan `in:` di `StoreServiceRequest`/`UpdateServiceRequest` — menambah tipe baru wajib mengubah keduanya.
- Menghapus/mengubah service tidak mengubah invoice historis (snapshot by design) — jangan "memperbaiki" ini dengan FK tanpa keputusan produk.

## File Kunci
- `routes/web.php` (baris ±123–128)
- `app/Http/Controllers/ServiceController.php`
- `app/Http/Requests/StoreServiceRequest.php`, `app/Http/Requests/UpdateServiceRequest.php`
- `app/Models/Service.php`
- `resources/js/pages/services/index.tsx`
- `tests/Feature/ServiceControllerTest.php`

---

<a id="bank-accounts"></a>

# Modul: Bank Accounts (Rekening Bank)

> Modul CRUD rekening bank sekaligus pusat monitoring kas per rekening: daftar akun dengan saldo terkini, statistik income/expense per periode, chart 12 bulan, breakdown kategori pengeluaran, tab riwayat transaksi & pembayaran invoice, serta export laporan kas PDF. Route prefix utama `/bank-accounts` (halaman single-page Inertia `bank-accounts/index`). Seluruh grup digate `can:view bank-accounts`; mutasi digate granular `can:create|edit|delete bank-accounts`. **Saldo TIDAK PERNAH disimpan di database** — selalu dihitung dinamis dari `initial_balance + payments + transaksi credit − transaksi debit`.

## Tabel Database

### `bank_accounts`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint PK | — |
| `account_name` | string | Nama pemilik/label rekening |
| `account_number` | string, **unique** | Nomor rekening |
| `bank_name` | string | Nama bank |
| `branch` | string, nullable | Cabang |
| `initial_balance` | bigint (cast `integer`) | Saldo awal, rupiah penuh tanpa desimal |
| `created_at`/`updated_at` | timestamp | — |

**Tidak ada kolom `balance`.** Saldo adalah accessor (`$appends = ['balance']`) di `app/Models/BankAccount.php`.

Tabel terkait (bukan milik modul ini tapi menjadi sumber saldo):

- `bank_transactions` — `bank_account_id` FK **onDelete cascade** (`database/migrations/2023_01_01_000009_create_bank_transactions_table.php`)
- `payments` — `bank_account_id` FK **onDelete cascade** (`database/migrations/2023_01_01_000008_create_payments_table.php`)
- `loan_payments` — `bank_account_id` FK **tanpa cascade** (restrict) (`database/migrations/2025_11_26_083021_create_loan_payments_table.php`)

## Fitur

### Saldo Dinamis (Computed Balance)

Bukan endpoint, tapi fondasi seluruh modul.

**Alur step-by-step:**

1. Kapan pun properti `balance` diakses (serialisasi Inertia, PDF, dsb.), accessor `getBalanceAttribute()` dipanggil.
2. Jika relasi `payments` dan `transactions` sudah di-eager-load, sum dilakukan di memori (menghindari N+1); jika belum, sum via query DB.
3. Rumus: `initial_balance + Σ payments.amount + Σ transaksi credit − Σ transaksi debit`.

**Penjelasan kode** (`app/Models/BankAccount.php`):

```php
public function getBalanceAttribute(): int
{
    if ($this->relationLoaded('payments') && $this->relationLoaded('transactions')) {
        $payments = $this->payments->sum('amount');
        $credits = $this->transactions->where('transaction_type', 'credit')->sum('amount');
        $debits = $this->transactions->where('transaction_type', 'debit')->sum('amount');
    } else {
        $payments = $this->payments()->sum('amount');
        $credits = $this->transactions()->where('transaction_type', 'credit')->sum('amount');
        $debits = $this->transactions()->where('transaction_type', 'debit')->sum('amount');
    }

    return $this->initial_balance + $payments + $credits - $debits;
}
```

`payments` (pembayaran invoice) selalu bersifat pemasukan (credit); arah transaksi bank ditentukan enum `transaction_type` (`credit`/`debit`). Ada juga accessor tampilan `formatted_balance` (`Rp 1.500.000`) dan helper `BankAccount::parseAmount()` untuk membersihkan string rupiah menjadi integer.

### Halaman Index + Stats + Charts

**Alur step-by-step:**

1. User membuka `/bank-accounts` (opsional query `?account={id}&month=YYYY-MM`).
2. Request `GET /bank-accounts` → route name `bank-accounts.index` → middleware `auth` + `can:view bank-accounts` (`routes/web.php`).
3. `BankAccountController::index()` memuat semua akun dengan `with(['transactions', 'payments'])` supaya accessor `balance` dan kalkulasi trend berjalan di memori.
4. Per akun dihitung `trend` (`up`/`down`) dengan membandingkan total transaksi **credit** bulan ini vs bulan lalu.
5. `overallSummary` (sidebar) dihitung lintas semua akun: `total_balance`, `income` (Σ payments + Σ credit), `expense` (Σ debit) via satu `selectRaw SUM(CASE ...)`.
6. Jika ada akun terpilih (default: akun pertama), `buildAccountDetail()` menghasilkan: `period` (bulan terpilih atau "semua waktu"), `stats` (total_income/total_expense/net_cashflow/transaction_count), `chart_months` (12 bulan income vs expense), dan `category_breakdown` (top 6 kategori debit untuk donut chart).
7. Respons `Inertia::render('bank-accounts/index', [...])` → halaman React `resources/js/pages/bank-accounts/index.tsx` merender sidebar akun (`account-sidebar.tsx`) + panel detail.
8. Ganti akun/bulan di UI memicu `router.get()` partial reload `only: ['detail', 'filters']` (index.tsx baris ~88) — hanya prop detail yang dihitung ulang.

**Penjelasan kode** (`app/Http/Controllers/BankAccountController.php`):

```php
$accounts = BankAccount::with(['transactions', 'payments'])->get();
...
$overallSummary = [
    'total_balance' => (int) $accountsData->sum('balance'),
    'income' => (int) Payment::sum('amount') + (int) ($overallTrxStats->credit_total ?? 0),
    'expense' => (int) ($overallTrxStats->debit_total ?? 0),
];
```

Chart dirender di `resources/js/pages/bank-accounts/components/account-charts.tsx` menggunakan `react-apexcharts`: bar chart income vs expense 12 bulan (`chart_months`) dan donut breakdown kategori pengeluaran (`category_breakdown`). Filter bulan pada chart mengirim ulang query `month` ke controller.

### Create Rekening

**Alur step-by-step:**

1. User klik tombol tambah akun → dialog `account-form-dialog.tsx` (CurrencyInput untuk saldo awal).
2. `POST /bank-accounts` payload `{account_name, account_number, bank_name, branch?, initial_balance}`.
3. Middleware `can:create bank-accounts`.
4. Validasi `StoreBankAccountRequest` (`app/Http/Requests/StoreBankAccountRequest.php`): `account_number` wajib **unique:bank_accounts**, `initial_balance` `integer|min:0`.
5. `BankAccount::create()` — satu insert, tidak ada pencatatan saldo lain.
6. Redirect ke `bank-accounts.index?account={id baru}` dengan flash `success` (`__('pages.account_created_successfully')`).
7. UI: akun baru langsung terpilih di sidebar.

### Update Rekening

**Alur step-by-step:**

1. User klik edit pada akun → dialog form terisi data lama.
2. `PUT /bank-accounts/{bankAccount}` payload sama dengan create.
3. Middleware `can:edit bank-accounts`.
4. Validasi `UpdateBankAccountRequest` — extends Store, tapi rule unique mengecualikan akun sendiri:

```php
// app/Http/Requests/UpdateBankAccountRequest.php
$rules['account_number'] = ['required', 'string', 'max:255',
    "unique:bank_accounts,account_number,{$this->route('bankAccount')->id}"];
```

5. `$bankAccount->update([...])` → `redirect()->back()` + flash success.
6. Mengubah `initial_balance` otomatis menggeser saldo terkini karena saldo selalu dihitung ulang.

### Delete Rekening

**Alur step-by-step:**

1. User konfirmasi hapus via `ConfirmDialog`.
2. `DELETE /bank-accounts/{bankAccount}` → middleware `can:delete bank-accounts`.
3. `BankAccountController::destroy()` memanggil `$bankAccount->delete()` **tanpa guard tambahan**.
4. Efek DB: `bank_transactions` dan `payments` milik akun ikut terhapus (FK cascade). Jika akun punya `loan_payments`, delete **gagal di level DB** (FK tanpa cascade).
5. Redirect ke index + flash success.

### Tab Transaksi (JSON) — `GET /bank-accounts/transactions`

Endpoint JSON (bukan Inertia) untuk tab "Transaksi" pada detail akun, dipanggil via `axios`/fetch dari `transactions-tab.tsx`.

**Alur step-by-step:**

1. User membuka tab Transaksi / mengganti filter (search, tipe, kategori, bulan, sort, per_page) → komponen React fetch `GET /bank-accounts/transactions?account={id}&search=&transaction_type=&category_id=&month=YYYY-MM&per_page=15&sort=transaction_date&direction=desc`.
2. Route berada dalam grup `can:view bank-accounts` (route name `bank-accounts.transactions`, terdaftar **sebelum** route resource agar tidak tertangkap `{bankAccount}`).
3. `BankTransactionController::indexTransactions()` — tanpa `account` valid, balas paginator kosong.
4. Query `BankTransaction::with(['category.parent'])` + filter `when(...)`, lalu `paginate($perPage)`.
5. Respons JSON: `data[]` (id, description, transaction_type, transaction_date, amount, reference_number, category{label, parent_label}, attachment_url/name) + meta paginasi (`current_page`, `last_page`, `total`, `from`, `to`).
6. UI merender `DataTable` + `Pagination`; setelah mutasi (hapus transaksi) komponen menaikkan counter refresh untuk re-fetch.

**Penjelasan kode** (`app/Http/Controllers/BankTransactionController.php`):

```php
$query = BankTransaction::with(['category.parent'])
    ->where('bank_account_id', $accountId)
    ->when($search, fn ($q) => $q->where(function ($qq) use ($search) {
        $qq->where('description', 'like', "%{$search}%")
            ->orWhere('reference_number', 'like', "%{$search}%");
    }))
    ->when($type, fn ($q) => $q->where('transaction_type', $type))
    ->when($month, fn ($q) => $q
        ->whereYear('transaction_date', substr((string) $month, 0, 4))
        ->whereMonth('transaction_date', substr((string) $month, 5, 2)))
    ->orderBy($sort, $direction);
```

### Tab Pembayaran Invoice (JSON) — `GET /bank-accounts/payments`

**Alur step-by-step:**

1. Tab "Pembayaran" fetch `GET /bank-accounts/payments?account={id}&search=&payment_method=&invoice_status=&month=&per_page=&sort=&direction=`.
2. Grup middleware sama (`can:view bank-accounts`).
3. `BankTransactionController::indexPayments()` melakukan join manual `payments → invoices → clients` untuk menampilkan nomor invoice, status invoice, dan nama klien per pembayaran.
4. Sorting di-whitelist via `match` (`invoice_number`, `client_name`, `amount`, `payment_method`, `payment_date`; default `payments.payment_date`).
5. Respons JSON shape sama seperti tab transaksi, ditambah `invoice_number`, `invoice_status`, `client_name`, `client_type`.

```php
$query = Payment::query()
    ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
    ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
    ->select(['payments.*', 'invoices.invoice_number',
        'invoices.status as invoice_status', 'clients.name as client_name', ...])
    ->where('payments.bank_account_id', $accountId);
```

Pembayaran invoice **tidak bisa dibuat/dihapus dari modul ini** — dikelola modul Invoices; di sini hanya read-only.

### Export PDF Laporan Kas — `GET /bank-account/export/pdf`

**Alur step-by-step:**

1. User klik Export PDF (bisa dari halaman bank accounts maupun cash flow) → browser membuka `GET /bank-account/export/pdf?bank_account_id={id}&month=&year=&start_date=&end_date=` (atau `/bank-account/export/pdf/preview` untuk stream inline).
2. Middleware `can:view bank-accounts`.
3. `CashFlowExportController::exportPdf()` menormalkan filter via `parseFilters()` (menerima `start_date`/`end_date` **atau** alias `date_from`/`date_to`, `bank_account_id` tunggal **atau** `bank_accounts` comma-separated).
4. `CashFlowExportService::generatePdf()` membangun data (saldo awal per tanggal mulai, gabungan bank_transactions + payments terurut tanggal, saldo akhir) lalu render Blade `resources/views/pdf/cash-flow-report.blade.php` via DomPDF.
5. Respons: `$pdf->download($filename)` — nama file mengikuti filter, mis. `cash-flow-2026-01-01-to-2026-01-31-account-2.pdf` atau `cash-flow-semua-waktu.pdf` tanpa filter.

Detail lengkap perilaku export (mode SEMUA WAKTU, chunking DomPDF, limit memori) ada di `docs/module/cash-flow.md` karena controller & service-nya dibagi dengan modul Cash Flow.

## Keterkaitan Antar Modul

- **Invoices/Payments** — pembayaran invoice menambah saldo rekening (komponen `payments` pada rumus saldo) dan tampil di tab Pembayaran.
- **Cash Flow** — semua transaksi income/expense/transfer dibuat lewat endpoint `bank-transactions.*` (lihat `docs/module/cash-flow.md`) dan langsung memengaruhi saldo.
- **Loans & Receivables** — `LoanController`/`ReceivableController` membuat `BankTransaction` otomatis (pencairan, cicilan, bunga) pada rekening terpilih; `loan_payments` juga ber-FK ke `bank_accounts`.
- **Transaction Categories** — breakdown donut per kategori join ke `transaction_categories`.
- **Company Profile** — header laporan PDF (`CompanyProfile::current()`).
- Endpoint helper `GET /api/bank-accounts` (`routes/web.php`) menyediakan opsi `{label, value}` untuk Combobox lintas modul.

## Invarian & Jebakan

- **Saldo tidak pernah disimpan.** Jangan pernah menambah kolom `balance` atau meng-update saldo secara manual; semua fitur (export, stats, chart) mengandalkan formula yang sama. Saldo salah = periksa `transaction_type` transaksi, bukan tabel akun.
- **Eager-load sebelum akses `balance` massal.** `$appends = ['balance']` berarti serialisasi setiap akun memicu 3 sum query bila relasi belum dimuat — selalu `with(['transactions', 'payments'])` seperti di `index()`.
- **Delete akun = cascade.** Menghapus rekening ikut menghapus seluruh `bank_transactions` dan `payments`-nya tanpa konfirmasi tambahan di backend; sebaliknya gagal dengan error FK bila ada `loan_payments`.
- **Urutan route penting.** `/bank-accounts/transactions` dan `/bank-accounts/payments` harus terdaftar sebelum binding `{bankAccount}` — jika dipindah ke bawah, URL "transactions" akan dianggap ID akun (404).
- **Trend hanya membandingkan credit transaksi bank** (tanpa payments), bulan ini vs bulan lalu — indikator kasar, bukan net cashflow.
- Semua nominal adalah **integer rupiah penuh**; gunakan `CurrencyInput` di React dan `parseAmount()` di backend.
- Kedua endpoint tab mengembalikan **JSON murni**, bukan respons Inertia — jangan dipanggil dengan `router.visit`.

## File Kunci

| File | Peran |
|------|-------|
| `app/Models/BankAccount.php` | Accessor `balance` (rumus saldo dinamis), relasi transactions/payments/loanPayments |
| `app/Http/Controllers/BankAccountController.php` | Index (stats, chart, breakdown), store, update, destroy |
| `app/Http/Controllers/BankTransactionController.php` | Endpoint JSON `indexTransactions()` & `indexPayments()` untuk tab detail |
| `app/Http/Requests/StoreBankAccountRequest.php` / `UpdateBankAccountRequest.php` | Validasi CRUD akun (unique account_number) |
| `app/Http/Controllers/CashFlowExportController.php` + `app/Services/CashFlowExportService.php` | Export PDF laporan kas |
| `resources/views/pdf/cash-flow-report.blade.php` | Template PDF laporan kas |
| `routes/web.php` | Grup route `can:view bank-accounts` + granular create/edit/delete |
| `resources/js/pages/bank-accounts/index.tsx` | Halaman utama (partial reload `only: ['detail', ...]`) |
| `resources/js/pages/bank-accounts/components/` | `account-sidebar`, `account-charts` (ApexCharts), `transactions-tab`, `payments-tab`, `account-form-dialog`, `transaction-form-dialog`, `transfer-dialog` |
| `tests/Feature/BankAccountControllerTest.php` | Test feature modul ini |

---

<a id="cash-flow"></a>

# Modul: Cash Flow (Arus Kas)

> Modul monitoring dan pencatatan arus kas dalam tiga halaman: **Income** (pemasukan), **Expenses** (pengeluaran), dan **Transfers** (pindah dana antar rekening). Route prefix `/cash-flow` untuk halaman, sedangkan mutasi memakai endpoint bersama `/bank-transactions/*`. Permission granular per fitur: `view|create|edit|delete income`, `view|create|edit|delete expense`, `view|create|edit|delete transfer` — otorisasi mutasi dilakukan di FormRequest/Gate (bukan middleware route), sehingga endpoint bersama bisa dipakai user cash-flow yang tidak punya akses `bank-accounts`. Export PDF digate `can:view bank-accounts`.

## Tabel Database

### `bank_transactions` (tabel utama)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint PK | — |
| `bank_account_id` | FK → `bank_accounts`, cascade | Rekening asal/tujuan |
| `amount` | bigint (cast `integer`) | Rupiah penuh |
| `transaction_date` | date (cast `date`) | — |
| `transaction_type` | enum `credit` \| `debit` | credit = uang masuk, debit = uang keluar |
| `category_id` | FK → `transaction_categories` | Menentukan halaman mana yang menampilkan baris |
| `description` | string | — |
| `reference_number` | string, nullable | Prefix `TRF` menandai leg transfer |
| `attachment_path` / `attachment_name` | string, nullable | Bukti transaksi di disk `public` |

### `payments` (read-only di modul ini)

`invoice_id`, `bank_account_id`, `amount`, `payment_date`, `payment_method`, `reference_number`, `attachment_path/name` — sumber kedua halaman Income; dibuat oleh modul Invoices.

## Fitur

### Redirect Index — `GET /cash-flow`

**Alur step-by-step:**

1. User membuka `/cash-flow` (menu sidebar).
2. Closure route (`routes/web.php`) mengecek permission user secara berurutan: `view income` → redirect ke `cash-flow.income`; kalau tidak, `view expense` → `cash-flow.expenses`; kalau tidak, `view transfer` → `cash-flow.transfers`.
3. Tanpa satu pun permission tersebut → `abort(403)`.

```php
Route::get('/', function () {
    $user = request()->user();
    if ($user?->can('view income')) return redirect()->route('cash-flow.income');
    if ($user?->can('view expense')) return redirect()->route('cash-flow.expenses');
    if ($user?->can('view transfer')) return redirect()->route('cash-flow.transfers');
    abort(403);
})->name('index');
```

Diverifikasi `tests/Feature/CashFlowPermissionTest.php::test_cash_flow_index_redirects_to_first_allowed_tab`.

### Halaman Income — `GET /cash-flow/income` (`can:view income`)

Income adalah **UNION dua sumber**: pembayaran invoice (`payments`) + transaksi bank `credit` yang kategorinya bertipe `income`.

**Alur step-by-step:**

1. User membuka halaman / mengubah filter (`date_from`, `date_to`, `clients` (CSV id), `categories` (CSV id), `search`, `sort`, `direction`, `per_page`, `page`).
2. `CashFlowController::income()` membangun dua subquery:
   - **Payment side**: join `payments → invoices → clients → bank_accounts`, kolom diseragamkan (`uid = 'payment-{id}'`, `source_type='payment'`, `category_* = NULL`).
   - **Transaction side**: join `bank_transactions → bank_accounts → transaction_categories` dengan `transaction_type='credit'` **dan** `transaction_categories.type='income'` (`uid = 'transaction-{id}'`).
3. Kedua subquery digabung `unionAll` dalam `DB::query()->fromSub(...)`. Kekhususan filter: memilih filter **client** mengecualikan sisi transaksi (client hanya ada di payments); memilih filter **kategori** mengecualikan sisi payments.
4. `sum('amount')` dan `count()` dihitung dari union untuk `stats`; baris diambil manual dengan `offset/limit` (paginasi manual `paginationMeta()`).
5. Respons `Inertia::render('cash-flow/income', ...)` dengan `rows`, `pagination`, `stats {total_amount, total_count}`, `filters`, `clientOptions`, `categoryOptions` (dari `TransactionCategory::selectOptions('income')`), `accounts` (untuk dialog create).
6. UI (`resources/js/pages/cash-flow/income.tsx`): DataTable dengan checkbox bulk, tombol Export PDF, dialog create income (via `bank-transactions.store`), detail dialog dengan preview attachment.

**Penjelasan kode** (`app/Http/Controllers/CashFlowController.php`):

```php
$includePayments = empty($categoryIds);
$includeTransactions = empty($clientIds);

$unionQuery = DB::query();
if ($includePayments && $includeTransactions) {
    $unionQuery->fromSub(function ($q) use ($paymentsSelect, $transactionsSelect) {
        $q->fromSub($paymentsSelect, 'p')->unionAll(DB::query()->fromSub($transactionsSelect, 't'));
    }, 'combined');
}
```

`uid` (`payment-N` / `transaction-N`) dipakai UI untuk membedakan sumber baris saat bulk delete.

### Halaman Expenses — `GET /cash-flow/expenses` (`can:view expense`)

**Alur step-by-step:**

1. Filter: `date_from/date_to`, `categories`, `bank_accounts`, `search`, sort/paginasi.
2. Query tunggal: `bank_transactions` join `bank_accounts` + `transaction_categories`, dengan `transaction_type='debit'` **dan** `transaction_categories.type='expense'`. (Leg debit transfer tidak muncul karena kategorinya bertipe `transfer`.)
3. `stats` = sum + count dari query terklon sebelum select/limit.
4. Respons Inertia `cash-flow/expenses` + `categoryOptions('expense')`, `bankAccountOptions`, `accounts`.
5. UI menampilkan tabel, filter Combobox rekening/kategori, dialog create expense, bulk delete, Export PDF (menyertakan `bank_accounts` terpilih).

### Halaman Transfers — `GET /cash-flow/transfers` (`can:view transfer`)

Satu transfer = **dua baris** `bank_transactions` (debit di rekening asal, credit di rekening tujuan) yang berbagi `reference_number` berprefix `TRF`. Halaman menampilkan pasangan tersebut sebagai satu baris.

**Alur step-by-step:**

1. Filter: `date_from/date_to`, `bank_accounts`, `search`, paginasi.
2. Query dasar mengambil **sisi credit** saja: `transaction_type='credit'`, kategori bertipe `transfer`, `reference_number` not null.
3. Setelah paginasi, seluruh `reference_number` di halaman itu dicari pasangan **debit**-nya dalam satu query, di-key by reference.
4. Tiap baris digabung: `amount` (nominal diterima), `total_debit` (nominal keluar dari rekening asal), `admin_fee = max(0, total_debit − amount)`, `from_account` (dari leg debit), `to_account` (dari leg credit), attachment.
5. Respons Inertia `cash-flow/transfers`; UI menampilkan arah transfer antar-rekening, biaya admin, dan dialog create transfer.

```php
$rows = $credits->map(function ($c) use ($debits, &$totalTransferAmount) {
    $debit = $debits->get($c->reference_number);
    return [
        'amount' => (int) $c->amount,
        'total_debit' => $debit ? (int) $debit->total_debit : (int) $c->amount,
        'admin_fee' => $debit ? max(0, (int) $debit->total_debit - (int) $c->amount) : 0,
        ...
    ];
});
```

### Create Income/Expense — `POST /bank-transactions`

Endpoint bersama tanpa middleware permission di route (komentar di `routes/web.php`: harus tetap bisa diakses user cash-flow yang tidak punya akses bank-accounts). Otorisasi ada di FormRequest.

**Alur step-by-step:**

1. User klik "Catat Pemasukan"/"Catat Pengeluaran" → dialog form (DatePicker, Combobox kategori, CurrencyInput, FileUpload).
2. `POST /bank-transactions` multipart payload `{bank_account_id, category_id, amount, transaction_date, transaction_type: 'credit'|'debit', description, reference_number?, attachment?}`.
3. **Otorisasi di `StoreBankTransactionRequest::authorize()`**: tipe `credit` menuntut permission `create income`, `debit` menuntut `create expense` — dipetakan `BankTransaction::featureForType()`. Tipe invalid/kosong diloloskan ke validasi agar respons 422, bukan 403.
4. Validasi: `amount integer|min:1`, `attachment mimes:pdf,jpg,jpeg,png|max:5120`, dll.
5. Attachment (jika ada) disimpan ke `transaction-attachments/` disk `public`; `BankTransaction::create($data)`.
6. Redirect back + flash (`pages.income_recorded_successfully` / `pages.expense_recorded_successfully`); halaman Inertia refresh otomatis.

**Penjelasan kode** (`app/Http/Requests/StoreBankTransactionRequest.php`):

```php
public function authorize(): bool
{
    $type = $this->input('transaction_type');
    if (! in_array($type, ['credit', 'debit'], true)) {
        return true; // defer ke validasi (422), bukan 403
    }
    return $this->user()?->can('create '.BankTransaction::featureForType($type)) ?? false;
}
```

Dan resolusi fitur di model (`app/Models/BankTransaction.php`):

```php
public function permissionFeature(): string
{
    if ($this->reference_number && str_starts_with($this->reference_number, 'TRF')) {
        return 'transfer';
    }
    return $this->transaction_type === 'credit' ? 'income' : 'expense';
}

public function abilityFor(string $action): string
{
    return $action.' '.$this->permissionFeature(); // mis. "edit income", "delete transfer"
}
```

### Update Transaksi — `PUT /bank-transactions/{bankTransaction}`

**Alur step-by-step:**

1. User edit dari detail dialog → `PUT /bank-transactions/{id}` payload `{transaction_date, description, amount?, category_id?, reference_number?, attachment?, remove_attachment?}`.
2. **Otorisasi di `UpdateBankTransactionRequest::authorize()`**: `user->can($transaction->abilityFor('edit'))` — jadi leg transfer butuh `edit transfer`, transaksi credit butuh `edit income`, dst.
3. `BankTransactionController::update()` mendeteksi leg transfer (`reference_number` diawali `TRF`):
   - **Bukan transfer**: amount, category, reference, dan attachment (ganti/hapus, file lama dihapus dari disk) ikut diupdate.
   - **Transfer**: hanya `transaction_date` + `description` yang diubah, lalu **disinkronkan ke pasangan** (leg dengan tipe berlawanan dan reference sama) — nominal transfer tidak boleh diubah lewat edit.
4. Redirect back + flash `pages.transaction_updated_successfully`.

```php
if ($isTransfer) {
    $pairType = $bankTransaction->transaction_type === 'credit' ? 'debit' : 'credit';
    BankTransaction::where('reference_number', $bankTransaction->reference_number)
        ->where('transaction_type', $pairType)
        ->update(['transaction_date' => ..., 'description' => ...]);
}
```

### Delete Transaksi — `DELETE /bank-transactions/{bankTransaction}`

**Alur step-by-step:**

1. Konfirmasi via `ConfirmDialog` → `DELETE /bank-transactions/{id}` (dipanggil axios dari tab/halaman).
2. Otorisasi di controller: `Gate::authorize($bankTransaction->abilityFor('delete'))` (`delete income`/`delete expense`/`delete transfer`).
3. Jika leg transfer: **kedua leg** dengan `reference_number` sama dihapus. Selain itu, hapus satu baris.
4. Event model `deleting` (boot di `BankTransaction`) menghapus file attachment dari storage.
5. Redirect back + flash success.

### Bulk Delete Transaksi — `POST /bank-transactions/bulk-delete`

**Alur step-by-step:**

1. User mencentang beberapa baris (tab transaksi bank-accounts) → `POST /bank-transactions/bulk-delete` payload `{ids: number[]}`.
2. `BulkDestroyBankTransactionRequest::authorize()` memuat semua transaksi, memetakan `permissionFeature()` unik, dan menuntut `delete {feature}` untuk **setiap** fitur dalam seleksi — satu saja gagal, seluruh request 403.
3. Controller memisahkan transfer refs (hapus kedua leg per reference) dari id non-transfer, lalu delete.
4. Redirect back + flash `pages.bulk_delete_success`.

### Bulk Delete Cash Flow — `POST /cash-flow/bulk-delete`

Versi halaman cash-flow yang bisa mencampur payments dan transaksi.

**Alur step-by-step:**

1. Halaman income/expenses mengirim `POST /cash-flow/bulk-delete` payload `{uids: ['payment-3', 'transaction-9', ...]}`.
2. `CashFlowController::bulkDestroy()` memecah uid per sumber. Otorisasi via `Gate::authorize()` per fitur: adanya `paymentIds` menuntut `delete income` (payment = uang masuk), tiap fitur transaksi (`income`/`expense`/`transfer`) menuntut `delete {feature}`.
3. Payments dihapus by id; transaksi transfer dihapus per pasangan reference; sisanya by id.
4. Redirect back + flash `pages.bulk_delete_done` dengan jumlah baris terhapus.

### Transfer Antar Rekening — `POST /bank-transactions/transfer`

**Alur step-by-step:**

1. User buka dialog Transfer (`transfer-dialog.tsx`): pilih rekening asal & tujuan, kategori (tipe `transfer`), nominal, biaya admin, tanggal, deskripsi, bukti.
2. `POST /bank-transactions/transfer` payload `{from_account_id, to_account_id, category_id, amount, admin_fee, description, transfer_date, attachment?}`.
3. Otorisasi `TransferBankTransactionRequest::authorize()` = `can('create transfer')`. Validasi: `from_account_id different:to_account_id`, `admin_fee integer|min:0`.
4. Controller membuat `reference_number = 'TRF'.time()` dan `totalDebit = amount + admin_fee`; attachment (jika ada) disimpan **sekali** ke `bank-transactions/` lalu path yang sama dipakai kedua leg (satu bukti dibagi 2 transaksi).
5. Dalam `DB::transaction()` dibuat dua baris: **debit** `totalDebit` di rekening asal (deskripsi `"Transfer + Admin Fee - {desc}"`) dan **credit** `amount` di rekening tujuan (deskripsi `"Transfer masuk - {desc}"`), keduanya berbagi kategori, tanggal, reference, dan attachment.
6. Redirect back + flash `pages.transfer_completed_successfully`; biaya admin otomatis "hilang" dari total kas (selisih debit−credit).

```php
$refNumber = 'TRF'.time();
$totalDebit = $validated['amount'] + $validated['admin_fee'];

DB::transaction(function () use (...) {
    BankTransaction::create([...,'transaction_type' => 'debit', 'amount' => $totalDebit,
        'description' => 'Transfer + Admin Fee - '.$validated['description'], ...]);
    BankTransaction::create([...,'transaction_type' => 'credit', 'amount' => $validated['amount'],
        'description' => 'Transfer masuk - '.$validated['description'], ...]);
});
```

### Attachment Transaksi (upload + paste clipboard)

**Alur step-by-step:**

1. Semua form transaksi memakai komponen `FileUpload` (`resources/js/components/shared/file-upload.tsx`) berbasis react-dropzone — drag-and-drop, klik pilih file, **atau paste gambar dari clipboard** (listener global `document paste` mengubah `clipboardData.items` bertipe image menjadi `File` bernama `clipboard-{timestamp}.png`).
2. File dikirim multipart, divalidasi `mimes:pdf,jpg,jpeg,png|max:5120` (5 MB).
3. Disimpan ke disk `public` (`transaction-attachments/` untuk income/expense, `bank-transactions/` untuk transfer); URL publik dihasilkan `Storage::url()` (butuh `php artisan storage:link`).
4. Edit non-transfer bisa mengganti (`attachment`) atau menghapus (`remove_attachment: true`) — file lama dihapus dari disk.
5. Saat model dihapus, hook `static::deleting` di `BankTransaction` menghapus file fisiknya.

### Export PDF — `GET /cash-flow/export/pdf` & `GET /bank-account/export/pdf` (+ `/preview`)

Keduanya menunjuk `CashFlowExportController` yang sama dan digate `can:view bank-accounts` (laporan level rekening).

**Alur step-by-step:**

1. Tombol Export di halaman income/expenses membuka tab baru `GET /cash-flow/export/pdf?section=...&date_from=&date_to=&bank_accounts=1,2`; halaman bank-accounts memakai `/bank-account/export/pdf?bank_account_id=&month=&year=`.
2. `parseFilters()` menormalkan parameter: `start_date|date_from`, `end_date|date_to` (alias legacy vs param halaman cash-flow), `bank_account_id` tunggal digabung `bank_accounts` comma-separated → array id unik (atau `null` = semua rekening).
3. `CashFlowExportService::buildReportData()` menentukan periode:
   - `start+end` → rentang tanggal (`d/m/Y - d/m/Y`);
   - `month`/`year` → satu bulan (nama bulan Indonesia, mis. `AGUSTUS 2026`);
   - **tanpa filter apa pun → mode "SEMUA WAKTU"**: start = tanggal paling awal dari `min(bank_transactions.transaction_date, payments.payment_date)`, end = hari ini.
4. Data laporan: `openingBalance` = saldo sebelum tanggal mulai memakai rumus yang sama dengan `BankAccount::getBalanceAttribute` (`initial_balance + payments + credit − debit` yang terjadi sebelum `start`); `transactions` = gabungan bank_transactions + payments (payments tampil sebagai baris credit "Pembayaran Invoice - {client}") diurutkan tanggal; `closingBalance` dihitung berjalan.
5. `generatePdf()` menaikkan limit: `ini_set('memory_limit', '1024M')` + `set_time_limit(300)` agar export besar tidak mati, lalu `Pdf::loadView('pdf.cash-flow-report', $data)` A4 portrait.
6. Template Blade **memecah tabel per 250 baris** (`$transactions->chunk(250)` — `resources/views/pdf/cash-flow-report.blade.php` baris ~246): DomPDF sangat lambat merender satu `<table>` raksasa, jadi tiap chunk jadi `<table>` sendiri dengan saldo berjalan (`$runningBalance`) menyambung antar chunk.
7. Respons: `download($filename)` (nama file mencerminkan periode + akun, mis. `cash-flow-semua-waktu-account-2.pdf`) atau `stream()` untuk endpoint `/preview`.

**Penjelasan kode** (`app/Services/CashFlowExportService.php`):

```php
} else {
    $earliest = collect([
        BankTransaction::min('transaction_date'),
        Payment::min('payment_date'),
    ])->filter()->min();
    $start = $earliest ? Carbon::parse($earliest)->startOfDay() : now()->startOfDay();
    $end = now()->endOfDay();
    $periodText = 'SEMUA WAKTU';
}
```

Perilaku ini ditest di `tests/Feature/CashFlowExportControllerTest.php`.

## Keterkaitan Antar Modul

- **Bank Accounts** — setiap mutasi di sini langsung menggeser saldo dinamis rekening; endpoint mutasi juga dipakai tab transaksi halaman bank-accounts.
- **Invoices/Payments** — sisi payment pada halaman Income bersumber dari pembayaran invoice; menghapusnya lewat bulk delete cash-flow benar-benar menghapus record pembayaran (status invoice dihitung ulang oleh modul Invoices).
- **Transaction Categories** — tipe kategori (`income`/`expense`/`transfer`) menentukan halaman mana yang menampilkan transaksi; opsi picker dari `TransactionCategory::selectOptions()` dan `GET /api/transaction-categories?type=credit|debit`.
- **Loans & Receivables** — membuat `BankTransaction` otomatis (kategori sistem) yang ikut tampil di halaman income/expenses.
- **Permissions (Spatie)** — 12 permission granular (`view|create|edit|delete` × `income|expense|transfer`), diseed `database/seeders/MasterPermissionSeeder.php`.

## Invarian & Jebakan

- **Otorisasi mutasi TIDAK di route.** Route `bank-transactions.*` sengaja tanpa `can:` middleware; keamanan sepenuhnya di `authorize()` FormRequest + `Gate::authorize()` di `destroy()`/`bulkDestroy()`. Menambah endpoint baru di grup ini tanpa authorize = lubang keamanan.
- **Transfer selalu sepasang.** Invariannya: dua baris berbagi `reference_number` `TRF...`; hapus/edit satu leg harus menjaga pasangannya (controller sudah menangani — jangan hapus leg via query manual). Deteksi transfer memakai `str_starts_with($reference_number, 'TRF')` — jangan beri reference berprefix `TRF` pada transaksi biasa.
- **Nominal transfer tidak bisa diedit** lewat `PUT /bank-transactions/{id}` — hanya tanggal & deskripsi (disinkron ke pasangan). Ubah nominal = hapus lalu buat transfer baru.
- **Admin fee melekat di leg debit** (`total_debit = amount + admin_fee`); tidak ada baris terpisah untuk biaya admin. `admin_fee` direkonstruksi di halaman transfers sebagai selisih debit−credit.
- **Klasifikasi halaman bergantung tipe kategori**, bukan hanya arah transaksi: credit dengan kategori non-`income` tidak muncul di halaman Income (mis. leg credit transfer); debit dengan kategori non-`expense` (financing, transfer) tidak muncul di Expenses — tapi semuanya tetap memengaruhi saldo & laporan PDF.
- **Filter income saling eksklusif**: filter client menyembunyikan baris transaksi; filter kategori menyembunyikan baris payment (kolomnya memang tidak ada di sumber lain).
- **Export tanpa filter = SEMUA WAKTU**, bukan bulan berjalan. Jangan "memperbaiki" dengan default month — itu perilaku yang disengaja (commit `3456b38`).
- **Jangan hilangkan chunk 250** di template PDF — satu tabel besar membuat DomPDF kehabisan memori/waktu meski limit sudah 1G/300s (commit `b91b899`).
- `attachment` transfer dishare kedua leg (path sama). Hook `deleting` menghapus file — menghapus satu leg lewat model bisa menghapus file yang masih dirujuk leg pasangan; controller menghindarinya dengan menghapus keduanya sekaligus.
- Semua nominal **integer rupiah penuh**; `amount min:1`, `admin_fee min:0`.

## File Kunci

| File | Peran |
|------|-------|
| `app/Http/Controllers/CashFlowController.php` | Halaman income (UNION), expenses, transfers, bulk delete uid |
| `app/Http/Controllers/BankTransactionController.php` | store/update/destroy/bulkDestroy/transfer + endpoint tab JSON |
| `app/Http/Requests/StoreBankTransactionRequest.php` | Otorisasi `create income`/`create expense` berdasar `transaction_type` |
| `app/Http/Requests/UpdateBankTransactionRequest.php` | Otorisasi `abilityFor('edit')` per fitur |
| `app/Http/Requests/BulkDestroyBankTransactionRequest.php` | Otorisasi delete per fitur untuk seluruh seleksi |
| `app/Http/Requests/TransferBankTransactionRequest.php` | Otorisasi `create transfer` + validasi rekening berbeda |
| `app/Models/BankTransaction.php` | `permissionFeature()`, `abilityFor()`, `featureForType()`, hook hapus attachment |
| `app/Http/Controllers/CashFlowExportController.php` | Normalisasi filter export (alias tanggal, `bank_accounts` CSV), nama file |
| `app/Services/CashFlowExportService.php` | Data laporan, saldo awal/akhir, mode SEMUA WAKTU, limit 1G/300s |
| `resources/views/pdf/cash-flow-report.blade.php` | Template PDF, tabel di-chunk 250 baris |
| `resources/js/pages/cash-flow/` | `income.tsx`, `expenses.tsx`, `transfers.tsx` + `components/` (stats, detail dialog) |
| `resources/js/components/shared/file-upload.tsx` | Upload + paste clipboard bukti transaksi |
| `routes/web.php` | Redirect index per permission, route `bank-transactions.*` tanpa middleware can |
| `tests/Feature/CashFlowPermissionTest.php`, `BankTransactionControllerTest.php`, `CashFlowExportControllerTest.php` | Test perilaku permission, CRUD, dan export |

---

<a id="transaction-categories"></a>

# Modul: Transaction Categories (Kategori Transaksi)

> Master data kategori transaksi hierarkis dua level (parent → child) yang menjadi tulang punggung klasifikasi Cash Flow, Fund Request, Reimbursement, hingga Laporan Laba Rugi (via `pl_group`). Route prefix `/transaction-categories`; seluruh grup digate `can:view categories`, mutasi (store/update/pl-group/destroy) digate `can:manage categories`. Fitur khas: guard delete dengan dialog **reassign** yang memindahkan seluruh data terhubung ke kategori pengganti dalam satu transaksi DB.

## Tabel Database

### `transaction_categories`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint PK | — |
| `parent_id` | FK self-referential → `transaction_categories.id`, nullable, **onDelete cascade** | `NULL` = kategori induk (parent) |
| `type` | string | `income` \| `expense` \| `transfer` \| `adjustment` \| `financing` |
| `pl_group` | string, nullable | Grup Laba Rugi: `revenue` \| `cogs` \| `opex` \| `other_income` \| `other_expense` \| `tax` (konstanta `TransactionCategory::PL_GROUPS`) |
| `label` | string | Nama kategori |
| `created_at`/`updated_at` | timestamp | — |

Sejarah skema penting: tabel awal (2025-09-30) punya `code` unique + `parent_code`; migration `2026_02_05_..._refactor_transaction_categories_remove_code_add_parent_id.php` memigrasikan hierarki ke `parent_id` dan **men-drop kolom `code` & `parent_code`**. `pl_group` ditambahkan `2026_05_25_..._add_pl_group_to_transaction_categories_table.php`.

Tabel yang mereferensikan `category_id`: `bank_transactions`, `fund_request_items`, `reimbursements`.

## Fitur

### Halaman Index — `GET /transaction-categories` (`can:view categories`)

**Alur step-by-step:**

1. User membuka `/transaction-categories` dengan filter opsional `search`, `type`, `pl_status` (`classified`/`unclassified`), `per_page`, `sort`, `direction`.
2. `TransactionCategoryController::index()` mengeksekusi query berpaginasi dengan `with('parent')` + `withCount(['transactions', 'children', 'fundRequestItems', 'reimbursements'])` — count inilah yang dipakai UI untuk menentukan apakah delete perlu dialog reassign.
3. Filter `pl_status=unclassified` = kategori `income`/`expense` yang `pl_group`-nya masih `NULL` (belum diklasifikasi untuk Laba Rugi).
4. Prop tambahan: `stats` (total/parents/children/unclassified), `parentOptions` (kandidat induk untuk form), `reassignOptions` (semua kategori dengan label `full_path` untuk dialog reassign).
5. Respons `Inertia::render('transaction-categories/index', ...)` → halaman React `resources/js/pages/transaction-categories/index.tsx` (tabel, badge type/pl_group, dialog create/edit/delete).

**Penjelasan kode** (`app/Http/Controllers/TransactionCategoryController.php`):

```php
$categories = TransactionCategory::with(['parent'])
    ->withCount(['transactions', 'children', 'fundRequestItems', 'reimbursements'])
    ->when($search, fn ($q) => $q->where('label', 'like', "%{$search}%"))
    ->when($type, fn ($q) => $q->where('type', $type))
    ->when($plStatus === 'unclassified', fn ($q) => $q->whereIn('type', ['income', 'expense'])->whereNull('pl_group'))
    ->orderBy($sort, $direction)
    ->paginate($perPage);
```

### Create Kategori — `POST /transaction-categories` (`can:manage categories`)

**Alur step-by-step:**

1. User klik tambah → dialog form: SegmentedControl `type`, input `label`, Combobox `parent_id` (opsi `parentOptions` difilter bertipe sama), Combobox `pl_group` opsional.
2. `POST /transaction-categories` payload `{type, pl_group?, label, parent_id?}`.
3. Middleware `can:manage categories`; validasi `StoreTransactionCategoryRequest`:

```php
return [
    'type' => ['required', 'in:income,expense,financing,transfer,adjustment'],
    'pl_group' => ['nullable', Rule::in(TransactionCategory::PL_GROUPS)],
    'label' => ['required', 'string', 'max:255'],
    'parent_id' => ['nullable', 'exists:transaction_categories,id'],
];
```

4. `TransactionCategory::create($request->validated())`.
5. Respons ganda: request biasa → redirect back + flash "Kategori berhasil ditambahkan."; request `wantsJson()` → JSON 201 `{id, label, type, parent_id}` — dipakai fitur "buat kategori inline" dari modul lain tanpa meninggalkan form.

### Update Kategori — `PUT /transaction-categories/{transactionCategory}`

**Alur step-by-step:**

1. Dialog edit terisi data lama (`type`, `pl_group`, `label`, `parent_id`).
2. `PUT /transaction-categories/{id}` → middleware `can:manage categories` → `UpdateTransactionCategoryRequest` (extends Store, rules identik).
3. `$transactionCategory->update($request->validated())` → redirect back + flash "Kategori berhasil diperbarui.".
4. Catatan: tidak ada guard yang mencegah mengubah `type` kategori yang sudah dipakai transaksi — mengubahnya memindahkan baris antar halaman cash-flow (lihat Jebakan).

### Update pl_group Saja — `PATCH /transaction-categories/{id}/pl-group`

Endpoint ringan untuk klasifikasi inline dari side panel halaman Laba Rugi (P&L).

**Alur step-by-step:**

1. Di panel klasifikasi P&L user memilih grup untuk sebuah kategori.
2. `PATCH /transaction-categories/{id}/pl-group` payload `{pl_group: 'revenue'|'cogs'|'opex'|'other_income'|'other_expense'|'tax'|null}`.
3. Middleware `can:manage categories`; validasi inline `Rule::in(TransactionCategory::PL_GROUPS)`, nullable (kirim null = batalkan klasifikasi).
4. Update satu kolom lalu `back()` (tanpa flash) — Inertia me-refresh prop halaman pemanggil.

```php
$validated = $request->validate([
    'pl_group' => ['nullable', Rule::in(TransactionCategory::PL_GROUPS)],
]);
$transactionCategory->update(['pl_group' => $validated['pl_group'] ?? null]);
```

`pl_group` hanya bermakna untuk `type` income/expense; financing & transfer memang dikeluarkan dari P&L berdasarkan tipenya (lihat PHPDoc konstanta di model).

### Delete + Dialog Reassign — `DELETE /transaction-categories/{transactionCategory}`

**Alur step-by-step:**

1. User klik hapus. UI menghitung `deleteUsageCount = transactions_count + fund_request_items_count + reimbursements_count`; jika > 0, ConfirmDialog menampilkan Combobox **kategori pengganti** (`reassignOptions` difilter: tipe sama & bukan dirinya sendiri — `index.tsx` baris ~280).
2. `DELETE /transaction-categories/{id}` payload `{reassign_to_id?}` → middleware `can:manage categories`.
3. Guard bertingkat di `destroy()`:
   - Punya sub-kategori (`children()->exists()`) → **ditolak**: "Kategori ini memiliki sub-kategori. Hapus sub-kategori terlebih dahulu." (reassign tidak berlaku untuk parent yang masih punya anak).
   - Validasi `reassign_to_id`: harus ada di tabel dan `Rule::notIn([$id sendiri])`.
   - Masih dipakai (`transactions`/`fundRequestItems`/`reimbursements` exists) tapi tanpa reassign → ditolak: "Kategori ini masih digunakan. Pilih kategori pengganti...".
   - Kategori pengganti bertipe berbeda → ditolak: "Kategori pengganti harus bertipe sama."
4. Eksekusi dalam **satu transaksi DB**: ketiga relasi di-update massal ke kategori pengganti, lalu kategori dihapus — tidak mungkin ada referensi yatim.
5. Redirect back + flash "Kategori berhasil dihapus."; error dikirim via `withErrors(['delete' => ...])` dan ditampilkan di dialog.

**Penjelasan kode** (`app/Http/Controllers/TransactionCategoryController.php`):

```php
DB::transaction(function () use ($transactionCategory, $reassignTo, $inUse) {
    if ($inUse) {
        $transactionCategory->transactions()->update(['category_id' => $reassignTo->id]);
        $transactionCategory->fundRequestItems()->update(['category_id' => $reassignTo->id]);
        $transactionCategory->reimbursements()->update(['category_id' => $reassignTo->id]);
    }
    $transactionCategory->delete();
});
```

Skenario-skenario ini dicakup `tests/Feature/TransactionCategoryControllerTest.php`.

### Helper Picker Lintas Modul — `TransactionCategory::selectOptions()` & `GET /api/transaction-categories`

**Alur step-by-step:**

1. Modul lain (Cash Flow, Fund Request, Reimbursement) butuh dropdown kategori → panggil `TransactionCategory::selectOptions($type)` di controller, atau frontend fetch `GET /api/transaction-categories?type=credit|debit|income|expense|adjustment|transfer` (closure di `routes/web.php`; `credit` dipetakan ke tipe `income+adjustment+transfer`, `debit` ke `expense+adjustment+transfer`).
2. Keduanya menghasilkan format yang sama untuk Combobox: **parent sebagai header disabled, hanya anak yang bisa dipilih** (prefix `↳ `).

**Penjelasan kode** (`app/Models/TransactionCategory.php`):

```php
foreach ($parents as $parent) {
    $options[] = ['label' => $parent->label, 'value' => $parent->id, 'disabled' => true];
    foreach ($parent->children as $child) {
        $options[] = ['label' => '↳ '.$child->label, 'value' => $child->id];
    }
}
```

Konsekuensinya: transaksi selalu diklasifikasikan ke **kategori anak**, parent hanya pengelompokan visual. Accessor `full_path` (`"Parent → Child"`) dipakai untuk tampilan lengkap (kolom kategori PDF, opsi reassign).

### Kategori Sistem untuk Loans/Receivables

Modul Loans & Receivables mencatat kas otomatis dengan mencari kategori sistem tertentu, lalu memakai id-nya sebagai `category_id` transaksi yang dibuat:

| Kode | Dipakai saat | Arah |
|------|--------------|------|
| `FIN-LOAN-IN` | Penerimaan pinjaman (`LoanController::store`) | credit |
| `FIN-LOAN-OUT` | Pembayaran pokok pinjaman (`LoanController` payLoan) | debit |
| `EXP-INTEREST` | Pembayaran bunga pinjaman | debit |
| `FIN-RCV-OUT` | Pencairan piutang (`ReceivableController` approve) | debit |
| `FIN-RCV-IN` | Pembayaran pokok piutang | credit |
| `REV-INTEREST` | Pembayaran bunga piutang | credit |

```php
// app/Http/Controllers/LoanController.php
$category = TransactionCategory::findSystem('FIN-LOAN-IN');
BankTransaction::create([..., 'category_id' => $category?->id]);
```

Identitas kategori sistem hidup di kolom **`system_key`** (nullable unique, ditambahkan migration `2026_08_11_..._add_system_key_to_transaction_categories.php` sebagai pengganti kolom `code` yang di-drop 2026-02-05). `system_key` sengaja di luar `$fillable`; hanya seeder/migration yang mengisinya. Helper: `TransactionCategory::findSystem($key)` dan `$category->isSystem()`.

## Keterkaitan Antar Modul

- **Cash Flow** — `type` kategori menentukan halaman (income/expense/transfer) tempat transaksi muncul; picker income/expense/transfer memakai `selectOptions()`/`/api/transaction-categories`.
- **Bank Accounts** — donut breakdown pengeluaran per kategori; kolom kategori pada laporan PDF memakai `full_path`.
- **Fund Requests** (`fund_request_items.category_id`) dan **Reimbursements** (`reimbursements.category_id`) — ikut dipindahkan oleh mekanisme reassign delete.
- **Laba Rugi (P&L)** — `pl_group` memetakan kategori ke baris laporan (revenue/cogs/opex/other_income/other_expense/tax); side panel P&L memakai endpoint PATCH pl-group; filter `pl_status=unclassified` membantu menemukan kategori yang belum dipetakan.
- **Loans & Receivables** — konsumen kategori sistem di atas.
- **Permissions** — `view categories` (lihat), `manage categories` (semua mutasi).

## Invarian & Jebakan

- **Hierarki maksimal dua level secara praktis**: picker hanya menawarkan parent sebagai induk, dan `selectOptions()` hanya merender parent → children (cucu tidak akan tampil di picker meskipun DB tidak melarangnya).
- **Parent tidak untuk transaksi.** Semua picker menonaktifkan parent — jangan menulis picker baru yang membiarkan parent dipilih (pernah menjadi bug di Fund Request/Reimbursement, sudah diperbaiki).
- **Delete parent yang punya anak selalu ditolak**, bahkan dengan reassign. Tapi hati-hati: FK `parent_id` di DB adalah **onDelete cascade** — menghapus parent lewat query manual (bukan controller) akan ikut menghapus seluruh anaknya secara diam-diam.
- **Reassign harus setipe** (`income` → `income`, dst.) dan dieksekusi atomik dalam `DB::transaction`; ketiga relasi (`bank_transactions`, `fund_request_items`, `reimbursements`) selalu dipindah bersama — jika menambah tabel baru ber-`category_id`, wajib menambahkannya ke `destroy()` dan `withCount` di `index()`.
- **Mengubah `type` kategori yang sudah dipakai tidak diguard** — transaksinya akan berpindah/lenyap dari halaman cash-flow terkait (halaman memfilter berdasar tipe kategori). Lakukan dengan sadar.
- **`pl_group` NULL = belum masuk P&L.** Kategori income/expense tanpa `pl_group` tidak terklasifikasi di Laba Rugi; gunakan filter `unclassified` untuk audit.
- **[DIPERBAIKI 2026-08-11] Bug kolom `code`.** Lookup lama `where('code', ...)` (kolom sudah di-drop 2026-02-05) diganti kolom `system_key` + `TransactionCategory::findSystem()`. **Kategori ber-`system_key` diproteksi controller**: `update()` dan `destroy()` menolaknya — jangan melonggarkan proteksi ini, modul Loans/Receivables bergantung pada identitas kategori tersebut. Kode baru yang butuh kategori sistem WAJIB memakai `findSystem()`, bukan label.
- `store()` punya dua mode respons (redirect vs JSON 201 `wantsJson()`); jaga kompatibilitas keduanya saat mengubah method ini.

## File Kunci

| File | Peran |
|------|-------|
| `app/Models/TransactionCategory.php` | Konstanta `PL_GROUPS`, relasi parent/children/transactions/reimbursements/fundRequestItems, `selectOptions()`, accessor `full_path` |
| `app/Http/Controllers/TransactionCategoryController.php` | Index (filter + withCount), store (dual respons), update, updatePlGroup, destroy dengan guard & reassign |
| `app/Http/Requests/StoreTransactionCategoryRequest.php` / `UpdateTransactionCategoryRequest.php` | Validasi type/pl_group/label/parent_id |
| `routes/web.php` | Grup `can:view categories` + `can:manage categories`; closure `GET /api/transaction-categories` |
| `resources/js/pages/transaction-categories/index.tsx` | Halaman tunggal: tabel, form dialog, dialog delete + Combobox reassign |
| `database/migrations/2025_09_30_085156_create_transaction_categories_table.php` | Skema awal (masih ber-code) |
| `database/migrations/2026_02_05_041553_refactor_transaction_categories_remove_code_add_parent_id.php` | Migrasi ke `parent_id`, drop `code`/`parent_code` |
| `database/migrations/2026_05_25_160957_add_pl_group_to_transaction_categories_table.php` | Penambahan kolom `pl_group` |
| `app/Http/Controllers/LoanController.php`, `ReceivableController.php` | Konsumen kategori sistem (FIN-LOAN-*, EXP-INTEREST, FIN-RCV-*, REV-INTEREST) |
| `tests/Feature/TransactionCategoryControllerTest.php` | Test CRUD, guard delete, reassign |

---

<a id="fund-requests"></a>

# Modul: Permintaan Dana (Fund Requests)

> Modul pengajuan dana operasional dengan alur persetujuan berjenjang: karyawan menyusun pengajuan berisi rincian item biaya, mengajukannya untuk direview, lalu setelah disetujui dananya dicairkan oleh finance dari rekening bank — pencairan otomatis membuat transaksi bank debit per item. Route prefix `/fund-requests`, seluruh grup digate `can:view fund requests`, dengan permission tambahan `create/edit/delete/approve/disburse fund requests` per aksi.

## Tabel Database

### `fund_requests`
| Kolom | Keterangan |
|-------|------------|
| `request_number` | Nomor otomatis format `001/KSN/I/2026` (unique) |
| `user_id` | Pemohon (FK `users`) |
| `title`, `purpose` | Judul & tujuan penggunaan dana |
| `total_amount` | Total (integer rupiah penuh) — **dihitung otomatis** dari sum item |
| `priority` | enum: `low`, `medium`, `high`, `urgent` |
| `needed_by_date` | Tanggal dana dibutuhkan |
| `attachment_path`, `attachment_name` | Lampiran pengajuan (opsional, disk `public` folder `fund-requests/`) |
| `status` | enum: `draft`, `pending`, `approved`, `rejected`, `disbursed` |
| `reviewed_by`, `reviewed_at`, `review_notes` | Jejak review (FK `users`) |
| `disbursed_by`, `disbursed_at`, `disbursement_date`, `disbursement_notes` | Metadata pencairan |
| `bank_transaction_id` | FK ke **transaksi bank pertama** yang dibuat saat pencairan |

### `fund_request_items`
| Kolom | Keterangan |
|-------|------------|
| `fund_request_id` | FK parent |
| `description` | Deskripsi item biaya |
| `category_id` | FK `transaction_categories` (tipe `expense`) |
| `quantity`, `unit_price` | Qty (min 1) × harga satuan (integer) |
| `amount` | `quantity * unit_price`, dihitung di controller |
| `notes` | Catatan opsional |

## Fitur

### Daftar Pengajuan — Tab "Semua Pengajuan" vs "Pengajuan Saya" (`GET /fund-requests`)

**Alur step-by-step:**
1. User membuka `/fund-requests` → route `fund-requests.index` → `FundRequestController::index()` (gate `can:view fund requests`).
2. Controller mengecek `can('approve fund requests')` dan `can('disburse fund requests')`. Tab default: `all` bila punya approve permission, selain itu `my`.
3. Tab `my` menambahkan `where('user_id', auth()->id())`; tab `all` menampilkan semua data + filter tambahan `user_id` (pemohon).
4. Filter query string: `search` (title/purpose LIKE), `status`, `priority`, `user_id` (hanya tab all), `month` (`YYYY-MM`, filter `created_at`), `per_page`, `page`.
5. Query eager-load `user, reviewer, disburser, items.category, bankTransaction.bankAccount` lalu dipaginate; stats (total, total_amount, pending/approved/disbursed count) dihitung dalam satu `selectRaw`.
6. Respons `Inertia::render('fund-requests/index', ...)` berisi `rows` (termasuk flag `can_edit/can_delete/can_submit/can_review/can_disburse` per baris), `stats`, `bankAccountOptions` (dengan saldo terformat), `userOptions` (hanya bila bisa approve), `categories`, `nextNumber`, `canApprove`, `canDisburse`.
7. UI (`resources/js/pages/fund-requests/index.tsx`): stats card, komponen `Tabs`, tabel dengan kolom pemohon (hanya tab all), tombol aksi kontekstual per baris berdasarkan flag `can_*`.

**Penjelasan kode:** flag aksi per baris digabungkan dengan cek kepemilikan di controller — state machine di model, ownership di controller:

```php
// app/Http/Controllers/FundRequestController.php
'can_edit' => $r->canEdit() && ($r->user_id === auth()->id() || auth()->user()->hasRole('admin')),
'can_delete' => $r->canDelete(),
'can_submit' => $r->canSubmit() && $r->user_id === auth()->id(),
'can_review' => $r->canReview(),
'can_disburse' => $r->canDisburse(),
```

### Membuat Pengajuan (`GET /fund-requests/create`, `POST /fund-requests`)

Ada dua jalur UI: halaman penuh `fund-requests/create.tsx` dan **Sheet** (slide panel) di halaman index — keduanya submit ke endpoint yang sama.

**Alur step-by-step:**
1. User klik "Buat Pengajuan" → Sheet terbuka di index (props `categories` + `nextNumber` sudah tersedia) atau halaman `/fund-requests/create` (`can:create fund requests`).
2. `nextNumber` (pratinjau nomor) dihasilkan `FundRequest::generateRequestNumber()` dan dikirim sebagai prop.
3. User mengisi judul, tujuan, prioritas (`low/medium/high/urgent`), tanggal dibutuhkan, lampiran opsional, dan minimal 1 item (deskripsi, kategori expense, qty, harga satuan).
4. Submit `POST /fund-requests` (`can:create fund requests`) → validasi `StoreFundRequestRequest`: `request_number` unique, `needed_by_date` `after_or_equal:today`, `attachment` mimes `pdf,jpg,jpeg,png` max 5MB, `items` array min 1, `items.*.quantity|unit_price` integer min 1, `action` in `draft,submit`.
5. Lampiran disimpan ke `storage/app/public/fund-requests`.
6. Dalam `DB::transaction`: create `FundRequest` (status `draft`, `total_amount` 0), create tiap `FundRequestItem` dengan `amount = quantity * unit_price`. Hook `created` pada item memanggil `calculateTotalAmount()` parent.
7. Bila `action === 'submit'`, langsung `$fundRequest->submit()` → status `pending`.
8. Redirect ke index dengan flash success ("disimpan sebagai draft" / "diajukan untuk persetujuan").

**Penjelasan kode:** total tak pernah dikirim client — dihitung ulang dari item lewat hook model:

```php
// app/Models/FundRequestItem.php — booted()
static::created(function ($item) {
    $fundRequest = $item->relationLoaded('fundRequest')
        ? $item->fundRequest
        : FundRequest::find($item->fund_request_id);
    $fundRequest?->calculateTotalAmount(); // sum('amount') item → save
});
```

### Penomoran Otomatis (`generateRequestNumber`)

**Alur step-by-step:**
1. Saat model dibuat tanpa `request_number` (hook `creating`) atau saat controller butuh pratinjau, `FundRequest::generateRequestNumber()` dipanggil.
2. Abbreviation perusahaan diambil dari `CompanyProfile::current()->computed_abbreviation` — memakai kolom `abbreviation` bila diisi, jika tidak dibentuk dari inisial nama perusahaan (kata `PT`, `CV`, `TBK` dll. dilewati); fallback `CO` bila profil kosong.
3. Bulan berjalan dikonversi ke angka Romawi via `toRoman()`.
4. Sequence = jumlah pengajuan pada bulan+tahun berjalan (`COUNT` per `created_at`) + 1, dipad 3 digit.

```php
// app/Models/FundRequest.php
$sequence = str_pad($count + 1, 3, '0', STR_PAD_LEFT);
// Format: 001/KSN/I/2026
return sprintf('%s/%s/%s/%s', $sequence, $companyAbbreviation, $romanMonth, $year);
```

### Edit Pengajuan (`GET /fund-requests/{id}/edit`, `PUT /fund-requests/{id}`, dan Sheet `?edit={id}`)

**Alur step-by-step:**
1. Dua jalur: halaman `fund-requests/edit.tsx` (route `fund-requests.edit`, gate `can:edit fund requests`) atau Sheet edit di index — index membaca query `?edit={id}` dan controller memuat `editFundRequest` bila lolos cek `(pemilik || admin) && canEdit()`.
2. `canEdit()` hanya true saat status `draft` atau `rejected`; selain pemilik, hanya role `admin` yang boleh (cek eksplisit `abort(403)`).
3. Submit `PUT` → `UpdateFundRequestRequest` (sama dengan store minus `request_number`, plus `remove_attachment` boolean).
4. Dalam transaction: lampiran lama dihapus bila `remove_attachment` atau diganti file baru; field header di-update; **seluruh item lama dihapus (`items()->delete()`) lalu dibuat ulang** dari payload; `action=submit` langsung memanggil `submit()`.
5. Redirect ke index dengan flash.

### Hapus Pengajuan (`DELETE /fund-requests/{id}`)

**Alur step-by-step:**
1. Tombol hapus → `ConfirmDialog` → `DELETE` (gate `can:delete fund requests`).
2. Controller cek `canDelete()`: status `draft`/`rejected`, **atau user ber-role `admin` (status apa pun)**.
3. `$fundRequest->delete()` — hook `deleting` menghapus file lampiran dari disk `public`; item ikut terhapus (cascade FK).
4. `back()` dengan flash success/error.

### Submit untuk Persetujuan (`POST /fund-requests/{id}/submit`)

**Alur step-by-step:**
1. Tombol "Ajukan" (hanya muncul bila `can_submit`) → `POST .../submit` (tanpa middleware permission tambahan, tapi controller `abort(403)` bila bukan pemilik).
2. `canSubmit()`: status `draft` **dan** punya ≥1 item **dan** `sum(amount) > 0`.
3. `submit()` memanggil `calculateTotalAmount()` dulu (recalculate), lalu update status → `pending`.
4. `back()` dengan flash; badge sidebar reviewer bertambah (lihat Keterkaitan).

### Review — Approve / Reject (`POST /fund-requests/{id}/review`)

**Alur step-by-step:**
1. Reviewer (permission `approve fund requests`, dicek di middleware route **dan** `abort_if` di controller) membuka dialog review dari baris berstatus `pending`.
2. Payload divalidasi `ReviewFundRequestRequest`: `action` in `approve,reject`, `review_notes` nullable max 500.
3. `canReview()` → status harus `pending`.
4. `approve()`/`reject()` mengisi `status`, `reviewed_by`, `reviewed_at`, `review_notes`.
5. `back()` dengan flash "disetujui" / "ditolak". Pengajuan `rejected` bisa diedit & diajukan ulang oleh pemohon.

### Pencairan Dana (`POST /fund-requests/{id}/disburse`)

Fitur inti finansial modul ini — menghubungkan pengajuan ke mutasi rekening bank.

**Alur step-by-step:**
1. Finance (permission `disburse fund requests`) klik "Cairkan" pada baris `approved` → dialog disburse di `index.tsx`: pilih rekening bank (`Combobox`, label menampilkan saldo), tanggal pencairan (`DatePicker`, default hari ini), catatan opsional, bukti bayar opsional (`FileUpload`).
2. `POST .../disburse` → `DisburseFundRequestRequest`: `bank_account_id` exists, `disbursement_date` `before_or_equal:today`, `disbursement_notes` max 500, `attachment` mimes `pdf,jpg,jpeg,png` max 5MB (5120 KB).
3. Controller `abort_if` tanpa permission; `canDisburse()` → status harus `approved`.
4. Bukti bayar disimpan sekali ke `transaction-attachments/` (disk `public`).
5. Dalam `DB::transaction`: **satu `BankTransaction` debit dibuat PER ITEM** — amount per item, kategori mengikuti `category_id` item, deskripsi `"Pencairan Dana: {title} - {item description}"`, `reference_number` diisi catatan pencairan, dan **path bukti bayar yang sama dibagikan ke semua transaksi**.
6. ID transaksi pertama ditautkan balik: `$fundRequest->disburse($transactionIds[0], ...)` menyimpan `bank_transaction_id`, `disbursement_date`, `disbursed_by`, `disbursed_at`, `disbursement_notes`, dan status → `disbursed`.
7. `back()` dengan flash "Dana berhasil dicairkan"; saldo rekening (computed) langsung berkurang.

**Penjelasan kode:**

```php
// app/Http/Controllers/FundRequestController.php — disburse()
foreach ($fundRequest->items as $item) {
    $transaction = BankTransaction::create([
        'bank_account_id' => $validated['bank_account_id'],
        'amount' => $item->amount,
        'transaction_type' => 'debit',
        'category_id' => $item->category_id,
        'description' => "Pencairan Dana: {$fundRequest->title} - {$item->description}",
        'reference_number' => $validated['disbursement_notes'] ?? null,
        'attachment_path' => $attachmentPath,   // dibagikan ke semua transaksi
        'attachment_name' => $attachmentName,
    ]);
    $transactionIds[] = $transaction->id;
}
$fundRequest->disburse($transactionIds[0], $validated['disbursement_date'], auth()->id(), ...);
```

### Dialog Detail

Baris tabel dapat dibuka menjadi dialog detail (`index.tsx`) yang menampilkan: header pengajuan, lampiran pengajuan (`AttachmentPreviewButton`), daftar item (deskripsi, kategori, qty × harga, amount), jejak review, dan **seksi Pencairan** — nama rekening tujuan (`disbursement_account_name` dari `bankTransaction.bankAccount`) serta bukti bayar (`disbursement_attachment_url/name` diambil dari `BankTransaction` tertaut, bukan dari fund request sendiri).

### Export PDF Rekap (`GET /fund-requests/export/pdf` dan `/fund-requests/export/pdf/preview`)

**Alur step-by-step:**
1. Kedua endpoint digate `can:view fund requests`, didefinisikan sebagai closure di `routes/web.php` (nama route `fund-requests.export.pdf` dan `.preview`).
2. Query string: `month` (`YYYY-MM`), `status`, `priority`, `user_id`, `search`, `show_requestor` (bool — tampilkan kolom pemohon, dipakai untuk rekap "Semua Pengajuan").
3. `FundRequestExportService::generate($filters, $showRequestor)`: query `FundRequest::with(['user','items'])` urut `created_at` asc, filter month/status/priority/user_id/search (title, purpose, request_number).
4. Data view: `CompanyProfile::current()`, label periode (`F Y` atau "Semua Periode"), label status Indonesia, nama pemohon filter, `printedBy` = user login.
5. `Pdf::loadView('pdf.fund-requests', $data)->setPaper('a4', 'landscape')` (DomPDF).
6. Endpoint `export/pdf` → `streamDownload` dengan nama `Rekap-Pengajuan-Dana-{month|all}.pdf`; endpoint `/preview` → response inline (untuk pratinjau di tab browser).
7. Catatan: per penulisan ini `index.tsx` belum merender tombol export — endpoint diakses via URL (route Wayfinder `resources/js/routes/fund-requests/export/` sudah tergenerate).

## Keterkaitan Antar Modul

- **Bank Accounts / Cash Flow** — pencairan membuat `BankTransaction` debit per item; saldo `BankAccount` adalah accessor computed (`initial_balance + credit - debit`), jadi pencairan langsung menurunkan saldo tanpa update kolom. Transaksi pencairan tampil di halaman Cash Flow → Pengeluaran.
- **Transaction Categories** — `category_id` item diambil dari `TransactionCategory::selectOptions('expense')` (parent disabled, child dipilih); kategori terbawa ke transaksi bank sehingga pengeluaran pencairan terklasifikasi otomatis.
- **Company Profile** — `computed_abbreviation` menentukan segmen kedua nomor pengajuan (`KSN`).
- **Sidebar badge (`HandleInertiaRequests::getActionCounts`)** — hitungan `fund_requests` = jumlah `pending` (bila user bisa approve) + jumlah `approved` (bila user bisa disburse); permission-aware.
- **Dashboard** — seksi "Pengajuan Dana" menampilkan 5 pengajuan terbaru (`getRecentFundRequests`).
- **Laporan Laba Rugi** — sesuai kebijakan project, pencairan fund request langsung menjadi beban lewat transaksi bank berkategori.

## Invarian & Jebakan

- **`total_amount` tidak pernah dipercaya dari client** — selalu hasil `sum(items.amount)` via hook `FundRequestItem::booted()` dan recalculasi di `submit()`. Jangan set manual.
- **Update = delete-all + recreate items** — ID `fund_request_items` berubah setiap edit; jangan menyimpan referensi ke ID item.
- **Nomor berbasis COUNT, bukan MAX** — jika pengajuan bulan berjalan dihapus, `count + 1` bisa bertabrakan dengan nomor yang masih ada; tertahan oleh rule `unique:fund_requests,request_number` (gagal validasi, bukan silent). Ada juga potensi race pada submit bersamaan.
- **Hanya transaksi pertama yang tertaut** — `fund_requests.bank_transaction_id` menunjuk transaksi item pertama saja; menghapus/mengubah transaksi lain tidak terdeteksi dari fund request.
- **Admin bisa hapus status apa pun** (`canDelete`), termasuk `disbursed` — transaksi bank yang sudah dibuat **tidak ikut terhapus**, menyisakan pengeluaran yatim di cash flow.
- **Jebakan submit ulang setelah `rejected`** — `canEdit()` menerima `rejected`, tetapi `canSubmit()` hanya menerima `draft` dan `update()` **tidak mereset status**. Akibatnya `action=submit` pada edit pengajuan `rejected` gagal diam-diam (`submit()` return false) sementara flash tetap "berhasil diajukan"; endpoint `POST .../submit` juga menolak dengan flash error. Perhatikan ini saat mengubah alur pengajuan ulang.
- **Ownership edit/submit dicek di controller, bukan policy** — endpoint `submit` tidak punya middleware permission; satu-satunya penjaga adalah `user_id === auth()->id()`.
- **Bukti bayar pencairan disimpan di `transaction-attachments/`** dan hanya satu file fisik untuk banyak transaksi — menghapus satu transaksi yang ikut menghapus file akan mematahkan lampiran transaksi lain.
- Currency integer rupiah penuh (`unit_price`, `amount`, `total_amount`) — di React wajib `CurrencyInput`.

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (blok fund-requests, baris ±361-414 termasuk closure export)
- `d:\Laravel\finance-management\app\Http\Controllers\FundRequestController.php`
- `d:\Laravel\finance-management\app\Models\FundRequest.php` — state machine, `generateRequestNumber()`, `calculateTotalAmount()`
- `d:\Laravel\finance-management\app\Models\FundRequestItem.php` — hook auto-recalc total
- `d:\Laravel\finance-management\app\Http\Requests\StoreFundRequestRequest.php`, `UpdateFundRequestRequest.php`, `ReviewFundRequestRequest.php`, `DisburseFundRequestRequest.php`
- `d:\Laravel\finance-management\app\Services\FundRequestExportService.php` + `resources\views\pdf\fund-requests.blade.php`
- `d:\Laravel\finance-management\resources\js\pages\fund-requests\index.tsx` (tabs, sheet create/edit, dialog detail/review/disburse), `create.tsx`, `edit.tsx`, `types.ts`
- `d:\Laravel\finance-management\tests\Feature\FundRequestControllerTest.php`

---

<a id="reimbursements"></a>

# Modul: Reimbursement

> Modul penggantian biaya karyawan: karyawan mencatat pengeluaran pribadi untuk kepentingan kantor, mengajukannya, finance mereview (sekaligus menetapkan kategori transaksi resmi), lalu membayarnya — bisa dicicil — dari rekening bank; setiap pembayaran membuat `BankTransaction` debit. Route prefix `/reimbursements`, digate `can:view reimbursements`, dengan permission per aksi `create/edit/delete/approve/pay reimbursements`.

## Tabel Database

### `reimbursements`
| Kolom | Keterangan |
|-------|------------|
| `user_id` | Pemohon (FK `users`) |
| `title`, `description` | Judul & deskripsi pengeluaran |
| `amount` | Nominal diminta (integer rupiah penuh) |
| `amount_paid` | Akumulasi yang sudah dibayar (integer, default 0) |
| `expense_date` | Tanggal pengeluaran terjadi |
| `category_input` | **Kategori pilihan user** — string dari daftar tetap: `transport`, `meals`, `office_supplies`, `communication`, `accommodation`, `medical`, `other` |
| `category_id` | **FK `transaction_categories` — di-set finance saat approve**, dipakai untuk transaksi bank |
| `attachment_path`, `attachment_name` | Bukti/struk (opsional, folder `reimbursements/`) |
| `status` | `draft`, `pending`, `approved`, `rejected`, `paid` |
| `payment_status` | `unpaid`, `partial`, `paid` |
| `reviewed_by`, `reviewed_at`, `review_notes` | Jejak review |

### `reimbursement_payments`
| Kolom | Keterangan |
|-------|------------|
| `reimbursement_id` | FK parent |
| `bank_transaction_id` | FK `bank_transactions` — **satu transaksi bank debit per pembayaran** |
| `amount` | Nominal pembayaran (integer) |
| `payment_date` | Tanggal bayar |
| `notes` | Catatan/referensi |
| `paid_by` | User finance yang membayar (relasi `payer()`) |

## Fitur

### Daftar Reimbursement — Tab "All" vs "My" (`GET /reimbursements`)

**Alur step-by-step:**
1. User membuka `/reimbursements` → `ReimbursementController::index()` (gate `can:view reimbursements`).
2. Controller cek `can('approve reimbursements')` dan `can('pay reimbursements')`; tab default `all` bila bisa approve, selain itu `my` (dibatasi `user_id` sendiri).
3. Filter: `search` (`whereAny(['title','description','category_input'])`), `status`, `category` (nilai `category_input`), `date_from`+`date_to` (rentang `expense_date`), `per_page`, `page`.
4. Query `Reimbursement::with(['user','reviewer'])->withSum('payments','amount')`, paginate; stats satu `selectRaw` (total, total_amount, pending_count, approved_count, total_paid).
5. Respons Inertia `reimbursements/index` berisi `rows` (dengan `amount_paid`, `amount_remaining` accessor, `payment_status`, flag `can_edit/can_delete/can_submit/can_review/can_pay`), `bankAccountOptions` (label + saldo terformat), `categoryOptions` (`TransactionCategory::selectOptions('expense')` — untuk dialog review), `canApprove`, `canPay`.
6. UI (`resources/js/pages/reimbursements/index.tsx`): stats card, `Tabs`, tabel dengan kolom pemohon di tab all, dialog detail, dialog review, dialog pay, Sheet create/edit.

**Penjelasan kode:** flag baris memadukan state machine model + kepemilikan:

```php
// app/Http/Controllers/ReimbursementController.php
'can_edit' => $r->canEdit() && $r->user_id === auth()->id(),
'can_submit' => $r->canSubmit() && $r->user_id === auth()->id(),
'can_review' => $r->canReview(),   // status pending
'can_pay' => $r->canPay(),         // approved && belum lunas
```

### Membuat Reimbursement (`GET /reimbursements/create`, `POST /reimbursements`)

**Alur step-by-step:**
1. Halaman `reimbursements/create.tsx` (route gate `can:create reimbursements`) atau Sheet di index; form: judul, deskripsi, nominal (`CurrencyInput`), tanggal pengeluaran, kategori (pilihan tetap `Reimbursement::categories()`), lampiran opsional.
2. `POST /reimbursements` → `StoreReimbursementRequest`: `amount` integer min 1, `category` **in-list** (`transport|meals|office_supplies|communication|accommodation|medical|other`), `attachment` mimes `jpg,jpeg,png,pdf` max 5MB, `action` in `draft,submit`.
3. Lampiran disimpan ke `storage/app/public/reimbursements`.
4. Dalam `DB::transaction`: create dengan `status='draft'`, `payment_status='unpaid'`, `category_input` diisi dari field `category` (bukan `category_id` — itu urusan finance nanti).
5. `action === 'submit'` → langsung `submit()` (status `pending`).
6. Redirect ke index dengan flash.

**Penjelasan kode:**

```php
// app/Http/Controllers/ReimbursementController.php — store()
$reimbursement = Reimbursement::create([
    'user_id' => auth()->id(),
    ...
    'category_input' => $validated['category'], // input user
    'status' => 'draft',
    'payment_status' => 'unpaid',
]);
```

### Dua Lapis Kategori: `category_input` vs `category_id`

- `category_input` — dipilih pemohon dari daftar tetap (bukan teks bebas — divalidasi `in:` di form request); untuk display memakai accessor `category_label` yang me-map value ke label (`meals` → "Meals & Entertainment").
- `category_id` — FK kategori transaksi resmi (hierarkis) yang **wajib di-set finance saat approve** (`required_if:action,approve` di `ReviewReimbursementRequest`). Kategori inilah yang dipakai untuk `BankTransaction` pembayaran, sehingga pengeluaran reimbursement terklasifikasi sesuai chart kategori keuangan, bukan kategori kasual user.
- Accessor `getCategoryLabelAttribute()` memprioritaskan relasi `category` (FK) bila sudah dimuat, fallback ke mapping `category_input`.

### Edit (`GET /reimbursements/{id}/edit`, `PUT /reimbursements/{id}`)

**Alur step-by-step:**
1. Halaman `reimbursements/edit.tsx` (gate `can:edit reimbursements`) atau Sheet edit di index; hanya **pemilik** (`abort(403)` bila bukan — tidak ada bypass admin, berbeda dari fund request).
2. `canEdit()` → status `draft` atau `rejected`.
3. `UpdateReimbursementRequest` = store + `remove_attachment` boolean.
4. Dalam transaction: kelola lampiran (hapus/ganti), update field, `action=submit` → `submit()`.
5. Redirect ke index.

### Hapus (`DELETE /reimbursements/{id}`)

1. `ConfirmDialog` → `DELETE` (gate `can:delete reimbursements`).
2. `canDelete()`: status `draft`/`rejected`, atau role `admin` (status apa pun).
3. Hook `deleting` model menghapus file lampiran; lalu `back()` dengan flash.

### Submit (`POST /reimbursements/{id}/submit`)

1. Hanya pemilik (`abort(403)`); `canSubmit()` → status harus `draft` (tidak ada syarat minimal nominal karena `amount` sudah wajib min 1 saat create).
2. `submit()` → status `pending`; masuk antrean review + badge sidebar reviewer.

### Review — Approve / Reject (`POST /reimbursements/{id}/review`)

**Alur step-by-step:**
1. Reviewer (permission `approve reimbursements`, middleware + `abort_if`) membuka dialog review dari baris `pending`; saat approve, dialog mewajibkan memilih kategori transaksi (`Combobox` dari `categoryOptions`), plus catatan opsional.
2. `ReviewReimbursementRequest`: `action` in `approve,reject`, `review_notes` max 500, `category_id` `required_if:action,approve` + exists.
3. `canReview()` → status `pending`.
4. Approve: controller **meng-update `category_id` dulu**, lalu `approve()` (status `approved`, `reviewed_by/at`, `review_notes`). Reject: `reject()` → status `rejected` (pemohon bisa edit & ajukan ulang).

```php
// app/Http/Controllers/ReimbursementController.php — review()
if ($validated['action'] === 'approve') {
    $reimbursement->update(['category_id' => $validated['category_id']]);
    $reimbursement->approve(auth()->id(), $validated['review_notes'] ?? null);
}
```

### Pembayaran — Penuh atau Parsial (`POST /reimbursements/{id}/pay`)

**Alur step-by-step:**
1. Finance (permission `pay reimbursements`) klik "Bayar" pada baris `approved` yang belum lunas → dialog pay: rekening bank, tanggal bayar (`before_or_equal:today`), nominal (`CurrencyInput`, bisa kurang dari sisa = cicilan), catatan referensi opsional.
2. `PayReimbursementRequest`: `bank_account_id` exists, `payment_amount` integer min 1.
3. Controller `abort_if` tanpa permission; `canPay()` → `status === 'approved' && !isFullyPaid()`.
4. Dalam `DB::transaction`:
   - Tentukan tipe: `payment_amount >= amount_remaining` → "Pelunasan", selain itu "Cicilan".
   - Buat `BankTransaction` debit: amount = nominal bayar, `category_id` dari reimbursement (yang di-set saat approve), deskripsi `"{Pelunasan|Cicilan} Reimbursement: {title} - {nama pemohon}"`, `reference_number` = catatan.
   - `recordPayment()` di model: buat row `reimbursement_payments` (tertaut `bank_transaction_id`, `paid_by`), tambah `amount_paid`, lalu update status.
5. `back()` dengan flash "Pembayaran berhasil diproses"; saldo rekening (computed) berkurang.

**Penjelasan kode:** transisi status pembayaran terjadi di model:

```php
// app/Models/Reimbursement.php — recordPayment()
$this->amount_paid += $amount;
if ($this->isFullyPaid()) {            // amount_paid >= amount
    $this->payment_status = 'paid';
    $this->status = 'paid';            // status final
} else {
    $this->payment_status = 'partial'; // status tetap 'approved'
}
return $this->save();
```

## Keterkaitan Antar Modul

- **Bank Accounts / Cash Flow** — setiap pembayaran = satu `BankTransaction` debit; saldo rekening computed dinamis sehingga langsung terpotong. Pembayaran tampil di Cash Flow → Pengeluaran dengan kategori resmi.
- **Transaction Categories** — `category_id` (di-set finance) diteruskan ke transaksi bank; `categoryOptions` diambil dari `selectOptions('expense')` (parent disabled, child dipilih).
- **Sidebar badge (`HandleInertiaRequests::getActionCounts`)** — hitungan `reimbursements` = `pending` count (bila bisa approve) + `approved` count (bila bisa pay); permission-aware per user.
- **Dashboard** — seksi "Reimburse Terbaru" menampilkan 5 reimbursement terbaru (`getRecentReimbursements`).
- **Users** — relasi `user` (pemohon), `reviewer` (`reviewed_by`), dan `payer` (`paid_by` di payment).

## Invarian & Jebakan

- **`amount_paid` adalah kolom tersimpan, bukan computed** — diinkremen di `recordPayment()`. Jika `BankTransaction` atau `reimbursement_payments` dihapus manual, `amount_paid` tidak menyesuaikan (tidak ada hook sinkronisasi).
- **Status `paid` mengunci pembayaran berikutnya** — `canPay()` mensyaratkan status `approved`; setelah lunas status menjadi `paid` sehingga overpay tidak mungkin lewat state machine, tetapi validasi request **tidak** membatasi `payment_amount ≤ amount_remaining`; pembayaran terakhir yang melebihi sisa tetap tercatat penuh (amount_paid bisa melampaui amount).
- **`category_id` wajib saat approve** — tanpa itu transaksi bank pembayaran akan berkategori null; enforce lewat `required_if:action,approve`.
- **Edit/submit hanya pemilik, tanpa bypass admin** (berbeda dari fund request yang mengizinkan admin edit); admin hanya punya bypass di `canDelete()`.
- **Admin bisa menghapus reimbursement yang sudah `paid`** — transaksi bank dan row pembayaran tidak dibersihkan otomatis (pengeluaran yatim di cash flow).
- **`category_input` bukan teks bebas** — meski model berkomentar "user's text input", validasi membatasi ke 7 nilai tetap; jangan tampilkan sebagai input teks di UI, gunakan pilihan dari `Reimbursement::categories()`.
- **Jebakan submit ulang setelah `rejected`** — `canEdit()` menerima `rejected`, tetapi `canSubmit()` hanya menerima `draft` dan `update()` tidak mereset status. `action=submit` pada edit reimbursement `rejected` gagal diam-diam (`submit()` return false) sementara flash tetap mengklaim "berhasil diajukan". Perhatikan perilaku ini saat mengubah alur pengajuan ulang.
- Semua nominal integer rupiah penuh; di React wajib `CurrencyInput`.

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (blok reimbursements, baris ±346-356)
- `d:\Laravel\finance-management\app\Http\Controllers\ReimbursementController.php`
- `d:\Laravel\finance-management\app\Models\Reimbursement.php` — state machine, `recordPayment()`, accessor `amount_remaining`, `category_label`
- `d:\Laravel\finance-management\app\Models\ReimbursementPayment.php` — relasi `bankTransaction`, `payer`
- `d:\Laravel\finance-management\app\Http\Requests\StoreReimbursementRequest.php`, `UpdateReimbursementRequest.php`, `ReviewReimbursementRequest.php`, `PayReimbursementRequest.php`
- `d:\Laravel\finance-management\resources\js\pages\reimbursements\index.tsx` (tabs, sheet, dialog detail/review/pay), `create.tsx`, `edit.tsx`, `types.ts`
- `d:\Laravel\finance-management\tests\Feature\ReimbursementControllerTest.php`

---

<a id="loans"></a>

# Modul: Loans (Utang Perusahaan)

> Modul untuk mencatat **pinjaman yang DITERIMA perusahaan dari pihak luar** (bank, lender perorangan, dsb.) — kebalikan dari modul Receivables. Mencakup CRUD pinjaman, lampiran kontrak, dan pencatatan pembayaran (pokok + bunga) yang otomatis membuat mutasi rekening (`BankTransaction`). Route prefix: `/loans` (satu halaman Inertia `loans/index` dengan dialog). Digate permission Spatie: `view loans` (grup), lalu per-aksi `create loans`, `edit loans`, `delete loans`, `pay loans` (`routes/web.php:458-464`).

## Tabel Database

### `loans`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint | PK |
| `loan_number` | varchar, **unique** | Nomor pinjaman, format auto `LOAN-00001` (bisa diedit user saat create) |
| `lender_name` | varchar | Nama pemberi pinjaman |
| `principal_amount` | bigint | Pokok pinjaman — **integer rupiah penuh** |
| `interest_type` | enum(`fixed`,`percentage`) | Tipe bunga |
| `interest_amount` | bigint, nullable | Total bunga nominal — terisi hanya jika `interest_type=fixed` |
| `interest_rate` | decimal(5,2), nullable | Persentase bunga **per tahun** — terisi hanya jika `interest_type=percentage` |
| `term_months` | int | Tenor (bulan) |
| `start_date` | date | Tanggal mulai / dana masuk (indexed) |
| `maturity_date` | date | Tanggal jatuh tempo (harus `after:start_date`) |
| `status` | enum(`active`,`paid_off`) | Default `active` saat dibuat (indexed) |
| `purpose` | text, nullable | Tujuan pinjaman |
| `contract_attachment` | varchar, nullable | Path file kontrak di disk `public` (folder `loans/`) |

### `loan_payments`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `loan_id` | bigint FK → `loans` | cascade on delete |
| `bank_account_id` | bigint FK → `bank_accounts` | Rekening sumber pembayaran |
| `payment_date` | date | Tanggal bayar (indexed, juga composite `loan_id+payment_date`) |
| `principal_paid` | bigint | Porsi pokok yang dibayar |
| `interest_paid` | bigint | Porsi bunga yang dibayar |
| `total_paid` | bigint | `principal_paid + interest_paid` (dihitung controller) |
| `reference_number` | varchar, nullable | No. referensi transfer |
| `notes` | text, nullable | Catatan |

Model: `app/Models/Loan.php` (relasi `payments()` hasMany), `app/Models/LoanPayment.php` (belongsTo `loan`, `bankAccount`). Semua kolom uang di-cast `integer`, tanggal di-cast `date`.

## Fitur

### Daftar Pinjaman (Index)

**Alur step-by-step:**
1. User membuka `/loans` → `GET loans.index` → middleware `auth` + `can:view loans`.
2. `LoanController::index` membangun query `Loan::withSum('payments','principal_paid')->withSum('payments','interest_paid')` dengan filter `search` (loan_number/lender_name LIKE), `status`, paginasi (`per_page` default 15), urut `start_date` desc.
3. Stats agregat dihitung satu query `selectRaw` (total, total_principal, active_count, active_principal).
4. Controller juga mengirim `bankAccountOptions` (semua rekening + saldo terformat) dan `nextLoanNumber` hasil `generateLoanNumber()`.
5. Respons `Inertia::render('loans/index', ...)` → halaman React menampilkan StatsCard, filter, DataTable dengan kolom sisa pokok (`remaining_principal = principal_amount − Σprincipal_paid`), dan tombol aksi per baris.

**Penjelasan kode:**
```php
// app/Http/Controllers/LoanController.php:267-273
private function generateLoanNumber(): string
{
    $latest = Loan::latest('id')->first();
    $nextId = $latest ? $latest->id + 1 : 1;

    return 'LOAN-'.str_pad($nextId, 5, '0', STR_PAD_LEFT);
}
```
Nomor berikutnya diturunkan dari `id` terakhir + 1 (bukan dari nomor terbesar), lalu dikirim sebagai prefill form create — user masih bisa mengubahnya, keunikan dijaga validasi `unique:loans,loan_number`.

### Buat Pinjaman (Store) — otomatis mencatat dana masuk

**Alur step-by-step:**
1. User klik "Tambah" di `resources/js/pages/loans/index.tsx` → dialog form (useForm Inertia, `forceFormData: true` karena ada upload file).
2. `POST /loans` → middleware `can:create loans` → validasi `StoreLoanRequest` (`app/Http/Requests/StoreLoanRequest.php`): `loan_number` required+unique, `principal_amount` integer min:1, `interest_type` in:fixed,percentage, `maturity_date` after:start_date, `contract_attachment` mimes pdf/jpg/jpeg/png max 5 MB, dan **`bank_account_id` required** (rekening penampung dana).
3. File kontrak (jika ada) disimpan ke `storage/app/public/loans/`.
4. Dalam `DB::transaction`: (a) `Loan::create` dengan status `active`; hanya salah satu field bunga yang diisi sesuai `interest_type`; (b) dibuat **`BankTransaction` credit** sebesar pokok pada rekening terpilih, tanggal = `start_date`, kategori sistem `FIN-LOAN-IN` via `TransactionCategory::findSystem()`.
5. Respons `back()->with('success')` → toast + tabel ter-refresh; saldo rekening naik otomatis (saldo bank = computed, bukan stored).

**Penjelasan kode:**
```php
// app/Http/Controllers/LoanController.php:133-143
$category = TransactionCategory::findSystem('FIN-LOAN-IN');

BankTransaction::create([
    'bank_account_id' => $validated['bank_account_id'],
    'amount' => $validated['principal_amount'],
    'transaction_type' => 'credit',
    'transaction_date' => $validated['start_date'],
    'description' => "Penerimaan pinjaman dari {$validated['lender_name']}",
    'reference_number' => $validated['loan_number'],
    'category_id' => $category?->id,
]);
```
Pencairan pinjaman dicatat sebagai transaksi **credit** (uang masuk). Lookup kategori memakai null-safe `$category?->id` dan kolom `system_key` (lihat transaction-categories.md).

### Edit Pinjaman (Update)

**Alur step-by-step:**
1. User klik "Edit" pada baris berstatus `active` → dialog form ter-prefill.
2. `PUT /loans/{loan}` → `can:edit loans` → guard controller: `abort_if($loan->status !== 'active', 403)` — pinjaman lunas tidak bisa diedit.
3. Validasi `UpdateLoanRequest` (mirip store, tanpa `bank_account_id`).
4. Lampiran: flag `remove_attachment` menghapus file lama; upload baru menggantikan (file lama di-delete dari disk `public`).
5. `$loan->update(...)` — **tidak menyentuh `BankTransaction` awal**: mengubah `principal_amount` TIDAK mengoreksi transaksi credit yang sudah tercatat saat create.
6. Respons `back()` dengan flash success.

### Hapus Pinjaman (Destroy)

**Alur step-by-step:**
1. User klik "Hapus" → `ConfirmDialog` (`variant danger`).
2. `DELETE /loans/{loan}` → `can:delete loans` → guard: `abort_if($loan->payments()->exists(), 403)` — pinjaman yang sudah punya pembayaran tidak bisa dihapus.
3. File kontrak dihapus dari storage, lalu `$loan->delete()`.
4. **`BankTransaction` credit dari saat create TIDAK ikut dihapus** — mutasi dana masuk tetap tercatat di rekening.

### Bayar Pinjaman (Pay) — pokok & bunga jadi dua transaksi bank

**Alur step-by-step:**
1. User klik "Bayar" pada pinjaman `active` → `PayLoanDialog` (`loans/index.tsx:649`) menampilkan sisa pokok/bunga, input `CurrencyInput` pokok & bunga, pilihan rekening, tanggal, referensi, catatan.
2. `POST /loans/{loan}/pay` → `can:pay loans` → guard `status === 'active'`.
3. Validasi `PayLoanRequest`: `bank_account_id` required, `payment_date` required `before_or_equal:today`, `principal_paid`/`interest_paid` nullable integer min:0.
4. Guard tambahan controller: minimal salah satu dari pokok/bunga harus > 0, kalau tidak `back()->withErrors(...)`.
5. Dalam `DB::transaction`:
   - `LoanPayment::create` dengan `total_paid = principal + interest`.
   - Jika `principal_paid > 0` → `BankTransaction` **debit** kategori sistem `FIN-LOAN-OUT` (findSystem) (pembayaran pokok).
   - Jika `interest_paid > 0` → `BankTransaction` **debit** kategori sistem `EXP-INTEREST` (findSystem) (beban bunga — inilah yang seharusnya mengalir ke baris "Beban Lain" di Laporan Laba Rugi).
   - Jika akumulasi pokok terbayar ≥ `principal_amount` → `$loan->update(['status' => 'paid_off'])`.
6. Respons `back()` → dialog tertutup, status/sisa ter-update, saldo rekening berkurang.

**Penjelasan kode:**
```php
// app/Http/Controllers/LoanController.php:205-207 (estimasi total bunga utk info sisa)
$totalInterest = $loan->interest_type === 'fixed'
    ? (int) ($loan->interest_amount ?? 0)
    : (int) round($loan->principal_amount * ($loan->interest_rate ?? 0) / 100 / 12 * $loan->term_months);
```
Untuk tipe `percentage`, total bunga dihitung sebagai **bunga tahunan diprorata bulanan × tenor** (`pokok × rate% / 12 × term_months`).

```php
// app/Http/Controllers/LoanController.php:258-261
$newRemaining = $remainingPrincipal - $principalPaid;
if ($newRemaining <= 0) {
    $loan->update(['status' => 'paid_off']);
}
```
Pelunasan otomatis: status berubah `paid_off` begitu sisa pokok ≤ 0. Tidak ada validasi yang mencegah bayar melebihi sisa pokok/bunga (lihat Jebakan).

## Keterkaitan Antar Modul

- **Bank Accounts / Cash Flow** — setiap create loan (credit) dan pay loan (debit) menulis ke `bank_transactions`, sehingga saldo rekening (computed: `initial_balance + payments(credit) + tx(credit) − tx(debit)`) dan halaman Cash Flow otomatis mencerminkan pinjaman.
- **Transaction Categories** — transaksi diberi kategori sistem via `findSystem()` — kolom `system_key` (`FIN-LOAN-IN`, `FIN-LOAN-OUT`, `EXP-INTEREST`). Kategori bertipe `financing` dikecualikan dari Laporan Laba Rugi; `EXP-INTEREST` (expense, `pl_group=other_expense`) masuk baris Beban Lain.
- **Profit & Loss** — pokok pinjaman (masuk/keluar) tidak boleh memengaruhi laba; hanya bunga (`EXP-INTEREST`) yang masuk P&L. Pemisahan ini bergantung sepenuhnya pada kategori transaksi.
- **Permission System** — 5 permission (`view/create/edit/delete/pay loans`) di `database/seeders/MasterPermissionSeeder.php:156-160`; role `admin` dan `finance manager` mendapatkannya.

## Invarian & Jebakan

- **[DIPERBAIKI 2026-08-11] Bug lookup kolom `code`.** Lookup kategori sistem kini memakai `TransactionCategory::findSystem()` (kolom `system_key`); test suite juga sudah berjalan di MySQL (bukan SQLite) dan `LoanControllerTest` meng-assert `category_id` terisi, sehingga regresi serupa akan tertangkap. Jangan menulis lookup kategori sistem dengan cara lain.
- Status hanya dua nilai: `active → paid_off`; transisi satu arah dan otomatis (tidak ada tombol "tandai lunas" manual, tidak ada jalan kembali ke `active`).
- Edit/hapus loan **tidak mengoreksi** `BankTransaction` yang sudah dibuat — mengubah `principal_amount` atau menghapus loan meninggalkan mutasi bank lama apa adanya. Koreksi harus manual lewat modul Bank Transactions.
- Tidak ada cap pembayaran: `principal_paid` boleh melebihi sisa pokok (langsung `paid_off`), `interest_paid` boleh melebihi sisa bunga. Sisa bunga hanya informasi tampilan.
- `interest_amount` vs `interest_rate` saling eksklusif — controller menulis `null` ke field yang tidak sesuai `interest_type` baik saat store maupun update.
- Semua nilai uang integer rupiah penuh (tanpa desimal); di frontend wajib `CurrencyInput`.
- `loan_number` unik; prefill `LOAN-{id+1}` bisa bentrok jika ada record dihapus lalu nomor dipakai manual — validasi unique yang jadi penjaga terakhir.

## File Kunci

| File | Peran |
|------|------|
| `d:\Laravel\finance-management\app\Http\Controllers\LoanController.php` | Seluruh logic index/store/update/destroy/pay + generate nomor |
| `d:\Laravel\finance-management\app\Http\Requests\StoreLoanRequest.php` / `UpdateLoanRequest.php` / `PayLoanRequest.php` | Validasi |
| `d:\Laravel\finance-management\app\Models\Loan.php`, `app\Models\LoanPayment.php` | Model + casts + relasi |
| `d:\Laravel\finance-management\routes\web.php` (baris 458-464) | Route + permission middleware |
| `d:\Laravel\finance-management\resources\js\pages\loans\index.tsx` (+ `types.ts`) | Halaman Inertia: tabel, dialog create/edit/pay/detail/hapus |
| `d:\Laravel\finance-management\database\migrations\2026_02_05_041553_refactor_transaction_categories_remove_code_add_parent_id.php` | Migration yang menghapus kolom `code` (sumber bug lookup kategori) |
| `d:\Laravel\finance-management\tests\Feature\LoanControllerTest.php` | Tes feature (SQLite in-memory) |

---

<a id="receivables"></a>

# Modul: Receivables (Piutang)

> Modul untuk mencatat **pinjaman yang DIBERIKAN perusahaan** kepada karyawan (`employee_loan`) atau klien perusahaan (`company_loan`) — kebalikan dari modul Loans. Debitur bersifat **polimorfik** (`debtor_type`/`debtor_id` → `App\Models\User` ATAU `App\Models\Client`), dengan workflow persetujuan `draft → pending_approval → active → paid_off` (atau `rejected`), skema cicilan, dan integrasi otomatis ke mutasi rekening saat pencairan & pembayaran. Route prefix: `/receivables` (satu halaman Inertia `receivables/index`). Permission: grup `view receivables`, per-aksi `create/edit/delete/approve/pay receivables` (`routes/web.php:466-474`).

## Tabel Database

### `receivables`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `receivable_number` | varchar, **unique** | Auto `RCV-00001` (dari `id` terakhir + 1) |
| `type` | enum(`employee_loan`,`company_loan`) | Menentukan kelas debitur |
| `debtor_type` | varchar | Kelas morph: `App\Models\User` (employee_loan) atau `App\Models\Client` (company_loan); composite index `debtor_type+debtor_id` |
| `debtor_id` | bigint | ID debitur |
| `principal_amount` | bigint | Pokok pinjaman (integer rupiah) |
| `interest_rate` | decimal(5,2) | Persentase bunga **flat atas pokok** (bukan per tahun) — selalu tersimpan sebagai rate walau input user `fixed` nominal |
| `installment_months` | int | Jumlah bulan cicilan |
| `installment_amount` | bigint | Cicilan/bulan = `round((pokok + total_bunga) / installment_months)` |
| `loan_date` | date | Tanggal pinjam (indexed) |
| `due_date` | date | `loan_date + installment_months` bulan (dihitung controller) |
| `status` | enum(`draft`,`pending_approval`,`active`,`paid_off`,`rejected`) | indexed |
| `purpose` / `notes` | text | Tujuan (required) / catatan |
| `disbursement_account` | varchar | **String bebas** info rekening tujuan pencairan (bukan FK) |
| `approved_by` / `approved_at` | FK users (set null) / timestamp | Diisi saat approve ATAU reject |
| `rejection_reason` / `review_notes` | text | Alasan tolak / catatan reviewer |
| `contract_attachment_path` / `contract_attachment_name` | varchar | File kontrak di disk `public` folder `receivables/` + nama asli file |

### `receivable_payments`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `receivable_id` | FK → `receivables` | cascade on delete |
| `payment_date` | date | indexed (+ composite dengan `receivable_id`) |
| `principal_paid` / `interest_paid` / `total_paid` | bigint | `total_paid = principal + interest` (dihitung controller) |
| `payment_method` | enum(`cash`,`payroll_deduction`,`bank_transfer`) | Hanya `bank_transfer` yang menulis mutasi bank |
| `reference_number` / `notes` | varchar / text | Referensi & catatan |

Model: `app/Models/Receivable.php` — relasi `debtor(): MorphTo`, `payments(): HasMany`, `approver(): BelongsTo(User, 'approved_by')`, scope `pendingApproval()`. `app/Models/ReceivablePayment.php` — belongsTo `receivable` (catatan: **tidak** menyimpan `bank_account_id`; rekening hanya tercatat di `BankTransaction`).

## Fitur

### Daftar Piutang (Index)

**Alur step-by-step:**
1. `GET /receivables` → `auth` + `can:view receivables` → `ReceivableController::index`.
2. Query `Receivable::with(['debtor','approver'])->withSum('payments','principal_paid')->withSum('payments','interest_paid')` + filter `search` (receivable_number/purpose), `status`, `type`, paginasi, urut `loan_date` desc.
3. Tiap baris dikirim dengan flag kemampuan yang dihitung server:
```php
// app/Http/Controllers/ReceivableController.php:86-90
'can_submit' => $r->status === 'draft',
'can_approve' => $r->status === 'pending_approval' && auth()->user()->can('approve receivables'),
'can_pay' => $r->status === 'active' && auth()->user()->can('pay receivables'),
'can_edit' => in_array($r->status, ['draft', 'rejected']),
'can_delete' => $r->status === 'draft' && ! $r->payments()->exists(),
```
4. Props tambahan: stats (total, active, pending, total pokok aktif), `bankAccountOptions` (dengan saldo), `employeeOptions` (User `status=active`), `companyOptions` (Client `type=company`, `status=Active`), `nextReceivableNumber`, `canApprove`, `canPay`.
5. React (`resources/js/pages/receivables/index.tsx`) merender tabel + tombol aksi per baris sesuai flag `can_*`.

### Buat Piutang (Store) — mulai dari `draft`

**Alur step-by-step:**
1. Dialog "Tambah" → pilih `type` (menentukan daftar debitur: karyawan atau klien company), debitur, pokok, tipe bunga (`fixed` nominal / `percentage`), tenor cicilan, tanggal, tujuan, rekening pencairan (teks), lampiran.
2. `POST /receivables` → `can:create receivables` → validasi `StoreReceivableRequest`: `type` in:employee_loan,company_loan; `debtor_id` required integer; `principal_amount` min:1; `interest_type` in:fixed,percentage; `installment_months` min:1; `purpose` & `disbursement_account` required; lampiran mimes pdf/jpg/jpeg/png max 5 MB.
3. Controller menormalkan bunga ke satu representasi (`interest_rate`) lalu menghitung cicilan & jatuh tempo:
```php
// app/Http/Controllers/ReceivableController.php:160-170
if ($validated['interest_type'] === 'fixed') {
    $totalInterest = (int) ($validated['interest_amount'] ?? 0);
    $interestRate = $principalAmount > 0 ? round($totalInterest / $principalAmount * 100, 2) : 0;
} else {
    $interestRate = (float) ($validated['interest_rate'] ?? 0);
    $totalInterest = (int) round($principalAmount * $interestRate / 100);
}

$installmentAmount = (int) round(($principalAmount + $totalInterest) / $installmentMonths);
$dueDate = now()->parse($validated['loan_date'])->addMonths($installmentMonths);
$debtorType = $validated['type'] === 'employee_loan' ? User::class : Client::class;
```
4. `Receivable::create` dengan `status='draft'`, nomor dari `generateReceivableNumber()` (`RCV-` + pad 5 digit). **Belum ada mutasi bank apa pun di tahap ini.**
5. Respons `back()->with('success')`.

### Edit Piutang (Update) — hanya `draft`/`rejected`, reset ke `draft`

**Alur step-by-step:**
1. Tombol Edit muncul jika `can_edit` (`draft` atau `rejected`).
2. `PUT /receivables/{receivable}` → `can:edit receivables` → guard `abort_if(! in_array($status, ['draft','rejected']), 403)`.
3. Validasi `UpdateReceivableRequest` (paralel dengan store); lampiran bisa dihapus (`remove_attachment`) atau diganti.
4. Hitung ulang `interest_rate`, `installment_amount`, `due_date` (rumus sama dengan store), lalu `update(...)` termasuk **`status => 'draft'` dan `rejection_reason => null`** — piutang yang ditolak otomatis kembali ke draft setelah direvisi, siap diajukan ulang.

### Hapus Piutang (Destroy)

**Alur step-by-step:**
1. `DELETE /receivables/{receivable}` → `can:delete receivables`.
2. Guard ganda: `status === 'draft'` DAN belum punya pembayaran; jika tidak → 403.
3. File kontrak dihapus dari storage, record di-delete (payments ikut cascade — walau pada praktiknya draft tak mungkin punya payment).

### Ajukan Persetujuan (Submit)

**Alur step-by-step:**
1. Tombol "Ajukan" (baris `draft`) → `ConfirmDialog` → `POST /receivables/{receivable}/submit`.
2. Route ini **tidak punya middleware permission tambahan** — cukup `can:view receivables` dari grup (`routes/web.php:471`).
3. Guard `abort_if($status !== 'draft', 403)` → `update(['status' => 'pending_approval'])` → flash success.

### Setujui / Tolak (Approve) — pencairan otomatis ke mutasi bank

**Alur step-by-step:**
1. Reviewer (punya `approve receivables`) membuka `ApproveReceivableDialog` pada baris `pending_approval`: pilih aksi approve/reject, rekening sumber pencairan (wajib jika approve), catatan.
2. `POST /receivables/{receivable}/approve` → middleware `can:approve receivables` + double-check `abort_if(! auth()->user()->can('approve receivables'), 403)` di controller → guard status `pending_approval`.
3. Validasi `ApproveReceivableRequest`: `action` in:approve,reject; `bank_account_id` `required_if:action,approve`; `notes` max:500.
4. Jika **approve**, dalam `DB::transaction`: dibuat `BankTransaction` **debit** (dana keluar) sebesar pokok, kategori sistem `FIN-RCV-OUT` via `TransactionCategory::findSystem()`, lalu status → `active` + `approved_by/at` + `review_notes`:
```php
// app/Http/Controllers/ReceivableController.php:286-296
$category = TransactionCategory::findSystem('FIN-RCV-OUT');

BankTransaction::create([
    'bank_account_id' => $validated['bank_account_id'],
    'amount' => $receivable->principal_amount,
    'transaction_date' => now()->format('Y-m-d'),   // tanggal HARI INI, bukan loan_date
    'transaction_type' => 'debit',
    'description' => "Piutang diberikan: {$receivable->receivable_number} - {$receivable->debtor?->name}",
    'reference_number' => $receivable->receivable_number,
    'category_id' => $category?->id,
]);
```
5. Jika **reject**: status → `rejected` + `rejection_reason` (dari field `notes`) + `approved_by/at` tetap terisi (jejak siapa yang menolak). Tanpa mutasi bank.

### Bayar Cicilan (Pay) — kredit masuk hanya untuk `bank_transfer`

**Alur step-by-step:**
1. Kasir (punya `pay receivables`) membuka `PayReceivableDialog` pada baris `active`: isi pokok/bunga (`CurrencyInput`), `payment_method` (`cash` | `payroll_deduction` | `bank_transfer`), rekening (bila transfer), tanggal, referensi, catatan.
2. `POST /receivables/{receivable}/pay` → middleware + double-check `can('pay receivables')` → guard status `active`.
3. Validasi `PayReceivableRequest`: `payment_method` required in:cash,payroll_deduction,bank_transfer; `bank_account_id` nullable exists; `payment_date` `before_or_equal:today`; pokok/bunga nullable min:0. Guard controller: minimal salah satu pokok/bunga > 0.
4. Dalam `DB::transaction`:
   - `ReceivablePayment::create` (`total_paid = pokok + bunga`).
   - **Hanya jika** `payment_method === 'bank_transfer' && bank_account_id` terisi:
     - pokok > 0 → `BankTransaction` **credit** kategori sistem `FIN-RCV-IN` (findSystem);
     - bunga > 0 → `BankTransaction` **credit** kategori sistem `REV-INTEREST` (findSystem) (pendapatan bunga → baris "Pendapatan Lain" di P&L).
   - Jika akumulasi pokok terbayar ≥ pokok → status `paid_off`.
5. Metode `cash` / `payroll_deduction` hanya tercatat di `receivable_payments` — **tidak menyentuh saldo rekening sama sekali** (dan karenanya tidak pernah muncul di P&L yang berbasis `bank_transactions`).

**Penjelasan kode:**
```php
// app/Http/Controllers/ReceivableController.php:327 (total bunga utk info sisa)
$totalInterest = (int) round($receivable->principal_amount * $receivable->interest_rate / 100);
```
Bunga piutang bersifat **flat sekali** atas pokok (beda dengan Loan yang memprorata rate tahunan per bulan × tenor).

## Keterkaitan Antar Modul

- **Users & Clients** — debitur polimorfik: `employee_loan` → `User` (opsi: user `status=active`), `company_loan` → `Client` (opsi: `type=company`, `status=Active`). Relasi `debtor(): MorphTo` di `app/Models/Receivable.php:43`.
- **Bank Accounts / Cash Flow** — pencairan (approve) menulis debit `FIN-RCV-OUT`; pembayaran via transfer menulis credit `FIN-RCV-IN` + `REV-INTEREST`. Saldo rekening (computed) otomatis mengikuti.
- **Transaction Categories / Profit & Loss** — pokok piutang (keluar/masuk) memakai kategori `financing` (dikecualikan dari P&L); hanya bunga (`REV-INTEREST`, income/`other_income`) yang menambah laba.
- **Permission System** — 6 permission (`view/create/edit/delete/approve/pay receivables`) di `MasterPermissionSeeder.php:163-168`; role `staff` hanya mendapat `view` + `create` (baris 385-386).

## Invarian & Jebakan

- **[DIPERBAIKI 2026-08-11 — sama dengan modul Loans]** Lookup kategori sistem kini memakai `TransactionCategory::findSystem()` (kolom `system_key`). Coverage baru `tests/Feature/ReceivableControllerTest.php` menguji approve/pay (termasuk assertion `category_id` terisi) dan berjalan di MySQL. Catatan perbaikan ikutan: approve/pay kini null-safe terhadap key request opsional (`notes`, `reference_number`, `bank_account_id`) yang sebelumnya diakses langsung.
- Workflow state machine ketat, dijaga `abort_if` per endpoint: edit hanya `draft|rejected`; submit hanya `draft`; approve/reject hanya `pending_approval`; pay hanya `active`; delete hanya `draft` tanpa payment. `paid_off` dan `rejected` final (rejected bisa "hidup lagi" hanya lewat edit → reset ke draft).
- **Pencairan memakai tanggal hari ini (`now()`), bukan `loan_date`** — jika approval terlambat, tanggal mutasi bank ≠ tanggal pinjam di record piutang.
- `disbursement_account` hanyalah string informasi dari pemohon; rekening sumber dana sesungguhnya dipilih reviewer saat approve (`bank_account_id`). Keduanya bisa tidak konsisten.
- `interest_rate` selalu tersimpan sebagai persen flat — input `fixed` nominal dikonversi balik ke rate (`bunga/pokok×100`, dibulatkan 2 desimal), sehingga nominal bunga hasil hitung ulang bisa bergeser beberapa rupiah dari input asli.
- Pembayaran `cash`/`payroll_deduction` tidak membuat `BankTransaction` → pendapatan bunga dari metode ini **tidak akan pernah masuk P&L** (P&L membaca `bank_transactions`).
- Tidak ada cap: pokok dibayar boleh melebihi sisa (langsung `paid_off`); `submit` tidak butuh permission khusus selain `view receivables`.
- Edit setelah reject menghitung ulang cicilan/due date dan menghapus `rejection_reason`, tetapi `approved_by/at` lama tidak dibersihkan.
- Menghapus/mengubah piutang **tidak pernah** mengoreksi `BankTransaction` yang sudah tercatat.

## File Kunci

| File | Peran |
|------|------|
| `d:\Laravel\finance-management\app\Http\Controllers\ReceivableController.php` | index/store/update/destroy/submit/approve/pay + generate nomor |
| `d:\Laravel\finance-management\app\Http\Requests\StoreReceivableRequest.php` / `UpdateReceivableRequest.php` / `ApproveReceivableRequest.php` / `PayReceivableRequest.php` | Validasi per endpoint |
| `d:\Laravel\finance-management\app\Models\Receivable.php`, `app\Models\ReceivablePayment.php` | Model, morph `debtor`, casts |
| `d:\Laravel\finance-management\routes\web.php` (baris 466-474) | Route + permission middleware |
| `d:\Laravel\finance-management\resources\js\pages\receivables\index.tsx` (+ `types.ts`) | Halaman Inertia: tabel, dialog create/edit, ApproveReceivableDialog, PayReceivableDialog, ConfirmDialog submit/hapus |
| `d:\Laravel\finance-management\database\seeders\MasterPermissionSeeder.php` | Definisi 6 permission receivables per role |

---

<a id="profit-loss"></a>

# Modul: Profit & Loss (Laporan Laba Rugi)

> Laporan laba rugi tingkat perusahaan **berbasis kas** untuk kebutuhan manajemen (bukan audit), dirakit langsung dari data `payments` (pendapatan invoice), `invoice_items` (HPP metode tutup-modal-dulu + pengecualian titipan pajak), dan `bank_transactions` yang diklasifikasi per `transaction_categories.pl_group`. Kebijakan final terdokumentasi di `.claude/context/laba-rugi.md` dan implementasinya di `ProfitLossService` **sesuai** dokumen tersebut. Route: `GET /reports/profit-loss` + `GET /reports/profit-loss/pdf`, keduanya digate permission `view profit-loss` (`routes/web.php:441-444`). Klasifikasi inline memakai endpoint terpisah `PATCH /transaction-categories/{id}/pl-group` (gate `manage categories`).

## Tabel Database

Modul ini **tidak punya tabel sendiri** — murni membaca:

| Tabel | Peran dalam laporan |
|-------|---------------------|
| `payments` | Pendapatan invoice basis kas: `Σ amount` per `payment_date` dalam periode |
| `invoices` + `invoice_items` | `total_cogs` (Σ `cogs_amount`) untuk cost-recovery HPP; `is_tax_deposit=true` = titipan pajak klien (passthrough, dikeluarkan dari pendapatan) |
| `bank_transactions` | Semua baris non-invoice: pendapatan non-invoice, HPP manual, opex, pendapatan/beban lain, pajak — difilter `transaction_type` (credit/debit) + `transaction_date` |
| `transaction_categories` | Kolom penggerak klasifikasi: `type` (income/expense/financing/transfer) dan **`pl_group`** (varchar nullable, indexed — ditambahkan migration `2026_05_25_160957_add_pl_group_to_transaction_categories_table.php`) |

Nilai sah `pl_group` (konstanta `TransactionCategory::PL_GROUPS`, `app/Models/TransactionCategory.php:21`): `revenue`, `cogs`, `opex`, `other_income`, `other_expense`, `tax`. Hanya bermakna untuk kategori `type=income/expense`; `financing` & `transfer` dikecualikan seluruhnya lewat `type`.

## Fitur

### Lihat Laporan (Index) + Filter Periode

**Alur step-by-step:**
1. User membuka `/reports/profit-loss` → `auth` + `can:view profit-loss` → `ProfitLossReportController::index`.
2. `resolvePeriod()` memvalidasi `start_date`/`end_date` (nullable date, `end >= start`); default **awal tahun berjalan s/d hari ini** (YTD).
3. `ProfitLossService::generate($start, $end)` membangun array laporan lengkap (lihat struktur di bawah).
4. Controller menambah `unclassifiedTypes` — map `{category_id: 'income'|'expense'}` agar panel klasifikasi tahu opsi `pl_group` mana yang boleh ditawarkan per kategori.
5. `Inertia::render('reports/profit-loss/index', ...)` + profil perusahaan (nama/alamat/NPWP) untuk kop laporan.
6. Di React: preset periode "Bulan ini / Bulan lalu / YTD / Tahun lalu" atau `DatePicker` custom → `router.get('/reports/profit-loss', {start_date, end_date})` (reload penuh, `preserveState: false`).

**Penjelasan kode:**
```php
// app/Http/Controllers/ProfitLossReportController.php:68-74
$start = isset($validated['start_date'])
    ? Carbon::parse($validated['start_date'])->startOfDay()
    : Carbon::now()->startOfYear();

$end = isset($validated['end_date'])
    ? Carbon::parse($validated['end_date'])->endOfDay()
    : Carbon::now()->endOfDay();
```

### Mesin Hitung (`ProfitLossService::generate`) — struktur laporan

Urutan perhitungan (`app/Services/ProfitLossService.php:40-94`), persis mengikuti struktur di `laba-rugi.md`:

```
PENDAPATAN USAHA  = invoice (basis kas, titipan-dulu) + non-invoice (pl_group=revenue, credit)
(−) HPP           = invoice (cost-recovery) + manual (pl_group=cogs, debit)
= LABA KOTOR      (gross_profit)
(−) BEBAN OPERASIONAL (pl_group=opex, debit, dirinci per kategori)
= LABA USAHA      (operating_profit)
(+) PENDAPATAN LAIN   (pl_group=other_income, credit)   ← mis. bunga piutang REV-INTEREST
(−) BEBAN LAIN        (pl_group=other_expense, debit)   ← mis. bunga pinjaman EXP-INTEREST
= LABA SEBELUM PAJAK  (pre_tax_profit)
(−) PAJAK PERUSAHAAN  (pl_group=tax, debit)
= LABA BERSIH     (net_profit)

+ bucket 'unclassified' (income & expense) — TERPISAH, TIDAK masuk total mana pun
```

**Pendapatan & HPP invoice — "titipan dulu" + cost recovery** (`invoiceContributions()`, baris 117-157). Untuk setiap invoice yang menerima pembayaran dalam periode:

```php
// app/Services/ProfitLossService.php:146-153
$revenueThroughEnd = max(0, $paidThroughEnd - $taxDeposit);          // titipan-dulu
$revenueThroughStartPrev = max(0, $paidThroughStartPrev - $taxDeposit);

$totalRevenue += $revenueThroughEnd - $revenueThroughStartPrev;

if ($invoiceCogs > 0) {
    $totalCogs += min($revenueThroughEnd, $invoiceCogs) - min($revenueThroughStartPrev, $invoiceCogs);
}
```
- **Titipan dulu**: uang masuk menutup Σ item `is_tax_deposit=true` lebih dahulu (passthrough pajak klien, bukan pendapatan konsultan), sisanya baru diakui pendapatan.
- **Cost recovery ("tutup modal dulu")**: porsi pendapatan menutup `total_cogs` invoice dulu sampai penuh; HPP periode = selisih kumulatif `MIN(pendapatan_kumulatif, total_cogs)` di batas akhir vs batas awal periode. Invoice lunas sebelum periode otomatis berkontribusi 0 (delta kolaps).

**Baris berbasis kategori** (`transactionsByGroup()`, baris 164-188): join `bank_transactions × transaction_categories`, filter `pl_group` + arah (`credit`/`debit`) + rentang `transaction_date`, group by kategori → `{by_category: [{category_id, category_label, amount}], total}`.

**Bucket unclassified** (`unclassified()`, baris 199-232): transaksi (a) tanpa kategori sama sekali, atau (b) kategorinya bertipe income/expense tapi `pl_group` masih NULL. Sengaja **tidak digulung ke total** — memaksa user mengklasifikasi alih-alih salah laci diam-diam. Kategori `financing`/`transfer` tidak muncul di sini (dikecualikan by design — termasuk setoran titipan pajak ke negara).

### Panel Klasifikasi Inline (`PATCH /transaction-categories/{id}/pl-group`)

**Alur step-by-step:**
1. Jika ada bucket unclassified, halaman menampilkan panel peringatan (ikon `TriangleAlert`) berisi daftar kategori + jumlah nominal yang belum terklasifikasi.
2. User memilih `pl_group` dari `Combobox` per baris; opsi dibatasi berdasarkan `unclassifiedTypes` — kategori `income` → `revenue`/`other_income`; `expense` → `cogs`/`opex`/`other_expense`/`tax` (`PL_GROUP_OPTIONS`, `index.tsx:52-63`).
3. Frontend: `router.patch('/transaction-categories/{id}/pl-group', {pl_group}, {preserveScroll, preserveState})` (`index.tsx:323-329`).
4. Route → middleware `can:manage categories` (`routes/web.php:339`) → `TransactionCategoryController::updatePlGroup`:
```php
// app/Http/Controllers/TransactionCategoryController.php:120-129
$validated = $request->validate([
    'pl_group' => ['nullable', Rule::in(TransactionCategory::PL_GROUPS)],
]);

$transactionCategory->update(['pl_group' => $validated['pl_group'] ?? null]);

return back();
```
5. `back()` memicu Inertia me-reload props → laporan langsung terhitung ulang dengan kategori yang baru diklasifikasi (angka pindah dari bucket unclassified ke barisnya).
6. Transaksi yang **tanpa kategori** (`category_id NULL`, label "(Tanpa Kategori)") tidak bisa diklasifikasi dari panel ini — harus diberi kategori dulu di modul Bank Transactions.

### Unduh PDF

**Alur step-by-step:**
1. Tombol "Unduh PDF" adalah link `<a target="_blank">` ke `/reports/profit-loss/pdf?start_date=...&end_date=...` membawa filter aktif (`index.tsx:422,442-446`).
2. `GET reports.profit-loss.pdf` → `can:view profit-loss` → `ProfitLossReportController::downloadPdf`.
3. Periode di-resolve dengan aturan yang sama, laporan digenerate ulang oleh service, lalu dirender via DomPDF:
```php
// app/Http/Controllers/ProfitLossReportController.php:49-58
$pdf = Pdf::loadView('pdf.profit-loss', [
    'report' => $report,
    'company' => $company,
    'start' => $start,
    'end' => $end,
])->setPaper('a4', 'portrait');

$filename = sprintf('laporan-laba-rugi-%s-%s.pdf', $start->toDateString(), $end->toDateString());

return $pdf->download($filename);
```
4. Template Blade `resources/views/pdf/profit-loss.blade.php` (Blade hanya dipakai untuk PDF di project ini).

## Keterkaitan Antar Modul

- **Invoices & Payments** — sumber baris Pendapatan Usaha (invoice) dan HPP invoice; bergantung pada `invoice_items.cogs_amount` dan flag `is_tax_deposit`. Pendapatan diakui saat pembayaran masuk (basis kas), bukan saat invoice terbit.
- **Bank Transactions / Cash Flow** — satu-satunya sumber untuk semua baris non-invoice. Reimbursement (`Reimbursement::recordPayment`) dan Fund Request (`FundRequest::disburse`) bermuara ke `BankTransaction`, sehingga otomatis tertangkap sekali sebagai beban (fund request = langsung beban saat cair, sesuai kebijakan #3).
- **Transaction Categories** — `pl_group` adalah penggerak klasifikasi; UI kategori (`/transaction-categories`) juga menampilkan status classified/unclassified dan stats-nya (`TransactionCategoryController::index`).
- **Loans & Receivables** — pokok pinjaman/piutang harus berkategori `financing` (dikecualikan dari P&L); bunga pinjaman (`EXP-INTEREST` → `other_expense`) dan bunga piutang (`REV-INTEREST` → `other_income`) yang seharusnya mengisi baris Beban/Pendapatan Lain. Catatan: saat ini lookup kategori by `code` di kedua controller itu rusak (kolom `code` sudah dihapus) — lihat Jebakan.
- **Company Profile & Permission** — kop laporan dari `CompanyProfile::first()`; permission `view profit-loss` diseed di `MasterPermissionSeeder.php:186` (admin & finance manager; staff tidak).

## Invarian & Jebakan

- **Anti-dobel HPP adalah disiplin input, bukan constraint sistem** — jangan catat HPP manual (`pl_group=cogs`) untuk penjualan yang sudah lewat invoice; kalau dilanggar, modal terhitung 2× dan laba mengecil. Sistem tidak memblokir ini (didokumentasikan eksplisit di komentar service).
- **Bucket unclassified tidak masuk total** — laba bersih yang tampil bisa "belum final" selama masih ada transaksi belum terklasifikasi; panel peringatan sengaja mencolok agar diklasifikasi dulu.
- **Klasifikasi inline butuh permission berbeda**: melihat laporan cukup `view profit-loss`, tetapi PATCH pl-group digate `manage categories` — user pelapor tanpa permission kategori akan mendapat 403 saat mencoba mengklasifikasi dari panel.
- `pl_group` di-set per **kategori**, berlaku retroaktif ke seluruh transaksi historis kategori itu (laporan periode lama ikut berubah saat kategori direklasifikasi).
- Kategori `financing`/`transfer` dikecualikan total — pokok pinjaman/piutang, transfer antar rekening, dan **setoran titipan pajak klien ke negara** (harus dikategorikan `type=financing`) tidak pernah menyentuh P&L.
- Baris pendapatan invoice & HPP invoice **tidak digerakkan kategori** sama sekali — murni `payments` + `invoice_items`; `pl_group=revenue` hanya untuk pendapatan non-invoice. Jangan mengklasifikasi transaksi credit hasil pembayaran invoice ke `revenue` (payment invoice memang tidak lewat `bank_transactions`, jadi normalnya tidak dobel — `Payment` dan `BankTransaction` adalah dua tabel terpisah yang tidak overlap).
- **Dampak bug kolom `code`** (modul Loans/Receivables): karena `TransactionCategory::where('code', ...)` gagal di MySQL, transaksi bunga pinjaman/piutang saat ini gagal tercatat sama sekali (endpoint-nya error) — baris Pendapatan/Beban Lain berpotensi kosong bukan karena datanya nol, melainkan karena pencatatannya gagal. Setelah bug diperbaiki dengan lookup non-`code`, pastikan kategori penggantinya memiliki `pl_group` `other_expense`/`other_income` yang benar.
- Penyusutan aset, akrual antar-periode, dan uang muka **belum dilacak** — disederhanakan by design untuk versi awal (dicatat di `laba-rugi.md`).
- Verifikasi implementasi vs dokumen kebijakan: keempat keputusan final (basis kas; HPP dua sumber; fund request langsung beban; cost-recovery HPP) plus aturan titipan pajak **sudah terimplementasi sesuai** di `ProfitLossService`; satu-satunya deviasi minor dari rencana adalah bucket unclassified (penambahan, bukan penyimpangan — memperketat, bukan melonggarkan, kebijakan).

## File Kunci

| File | Peran |
|------|------|
| `d:\Laravel\finance-management\.claude\context\laba-rugi.md` | Dokumen kebijakan final (basis kas, HPP, titipan pajak, pl_group) |
| `d:\Laravel\finance-management\app\Services\ProfitLossService.php` | Mesin hitung: cost-recovery, titipan-dulu, agregasi per pl_group, bucket unclassified |
| `d:\Laravel\finance-management\app\Http\Controllers\ProfitLossReportController.php` | index (resolve periode, unclassifiedTypes) + downloadPdf |
| `d:\Laravel\finance-management\app\Http\Controllers\TransactionCategoryController.php` (`updatePlGroup`, baris 120-129) | Endpoint klasifikasi inline |
| `d:\Laravel\finance-management\app\Models\TransactionCategory.php` | Konstanta `PL_GROUPS`, kolom `pl_group` |
| `d:\Laravel\finance-management\database\migrations\2026_05_25_160957_add_pl_group_to_transaction_categories_table.php` | Penambahan kolom `pl_group` (nullable, indexed) |
| `d:\Laravel\finance-management\resources\js\pages\reports\profit-loss\index.tsx` | Halaman laporan: preset periode, dokumen P&L, panel klasifikasi, tombol PDF |
| `d:\Laravel\finance-management\resources\views\pdf\profit-loss.blade.php` | Template PDF (DomPDF, A4 portrait) |
| `d:\Laravel\finance-management\routes\web.php` (baris 339, 441-444) | Route + permission (`view profit-loss`, `manage categories`) |
| `d:\Laravel\finance-management\tests\Feature\ProfitLossServiceTest.php`, `ProfitLossReportControllerTest.php` | Tes mesin hitung & controller |

---

<a id="dashboard"></a>

# Modul: Dashboard

> Halaman ringkasan keuangan bisnis: overview finansial global (pendapatan, laba, outstanding, HPP, PP, total saldo), statistik bulan berjalan, grafik cash flow 6 bulan, komposisi pengeluaran per kategori, daftar rekening bank, serta feed invoice tertunda, transaksi, reimbursement, dan pengajuan dana terbaru. Route `GET /dashboard` (name `dashboard`), controller **invokable** `DashboardController`, digate permission togglable `view dashboard` — user tanpa permission di-redirect ke halaman Pengeluaran Cash Flow.

## Tabel Database

Dashboard **tidak punya tabel sendiri** — seluruhnya agregasi read-only dari tabel modul lain:

| Tabel | Dipakai untuk |
|-------|---------------|
| `bank_accounts` (+ `payments`, `bank_transactions`) | Total saldo (computed accessor `balance` — TIDAK tersimpan), daftar rekening |
| `bank_transactions` | Pemasukan/pengeluaran bulan ini, grafik cash flow 6 bulan, pengeluaran per kategori, transaksi terbaru |
| `payments` | Total pendapatan sepanjang waktu, pembayaran invoice tertunda, feed transaksi |
| `invoices` + `invoice_items` | Invoice tertunda (`sent`, `partially_paid`, `overdue`), HPP (`cogs_amount`), basis PP (item non `is_tax_deposit`) |
| `reimbursements` | 5 reimbursement terbaru |
| `fund_requests` | 5 pengajuan dana terbaru |

## Fitur

### Akses & Redirect Fallback (`GET /dashboard`)

**Alur step-by-step:**
1. User terautentikasi (grup middleware `auth`, `verified`) membuka `/dashboard` → `DashboardController::__invoke()`.
2. Route **tidak** memakai middleware `can:` — cek permission dilakukan di dalam controller karena butuh fallback redirect, bukan 403.
3. Bila user **tidak** punya permission `view dashboard`, controller me-redirect ke route `cash-flow.expenses` (halaman Pengeluaran) — fallback tetap (hardcoded), bukan pencarian dinamis "modul pertama yang boleh diakses".
4. Bila punya permission, controller merender `Inertia::render('dashboard', [...])` dengan 9 blok props.

**Penjelasan kode:**

```php
// app/Http/Controllers/DashboardController.php
public function __invoke(): Response|RedirectResponse
{
    // Dashboard is a togglable permission; roles without it land on Pengeluaran.
    if (! auth()->user()?->can('view dashboard')) {
        return redirect()->route('cash-flow.expenses');
    }
    ...
}
```

Perilaku ini dites di `tests/Feature/DashboardAccessTest.php`:
- `test_user_with_permission_sees_dashboard`
- `test_user_without_dashboard_is_redirected_to_expenses`

### Financial Overview (baris kartu atas)

**Alur step-by-step:**
1. `getFinancialOverview()` dihitung sekali per render (semua data all-time, tanpa filter tanggal).
2. `total_income` = `Payment::sum('amount')` (seluruh pembayaran invoice).
3. `total_hpp` = sum `cogs_amount` item dari invoice berstatus `partially_paid`/`paid`.
4. `total_profit` = `total_income - total_hpp`.
5. `total_outstanding` = `max(0, total invoice tertunda - pembayaran atas invoice tertunda)` (status `sent`, `partially_paid`, `overdue`).
6. `total_pp` = 0,5% dari sum amount item invoice terbayar/sebagian yang **bukan** titipan pajak (`is_tax_deposit = false`) — estimasi PPh final UMKM.
7. `total_balance` = `BankAccount::all()->sum(fn ($a) => $a->balance)` — saldo computed per akun.
8. UI (`resources/js/pages/dashboard.tsx`): kartu Total Pendapatan, Total Laba (aksen hijau/merah mengikuti tanda), Outstanding, HPP, PP, plus badge "Total Saldo" di header.

**Penjelasan kode:**

```php
// app/Http/Controllers/DashboardController.php — getFinancialOverview()
$ppBase = InvoiceItem::whereHas('invoice', fn ($q) => $q->whereIn('status', ['partially_paid', 'paid'])
)->where('is_tax_deposit', false)->sum('amount');
...
'total_pp' => (int) round($ppBase * 0.005),
'total_balance' => BankAccount::all()->sum(fn ($a) => $a->balance),
```

### Stats Bulan Berjalan

**Alur step-by-step:**
1. `getStats($start, $end)` dengan rentang `startOfMonth()`–`endOfMonth()` bulan berjalan.
2. `income_this_month` / `expenses_this_month` = sum `bank_transactions` bertipe `credit` / `debit` dalam rentang; `net_this_month` = selisihnya.
3. `pending_invoices_count` dan `pending_invoices_amount` = jumlah & sisa tagihan invoice berstatus `sent`/`partially_paid`/`overdue` (total dikurangi pembayaran yang sudah masuk).
4. Ditampilkan sebagai kartu statistik di bawah overview.

### Grafik Cash Flow 6 Bulan

**Alur step-by-step:**
1. `getCashFlowChart()` melakukan loop 6 iterasi (bulan berjalan mundur 5 bulan).
2. Per bulan: sum `bank_transactions` credit (income) dan debit (expenses) — **2 query per bulan, 12 query total**.
3. Label bulan memakai `translatedFormat('M')` (mengikuti locale aktif).
4. Frontend merender `ReactApexChart` (react-apexcharts) dua seri "Pemasukan"/"Pengeluaran".

### Pengeluaran per Kategori (donut)

**Alur step-by-step:**
1. `getExpensesByCategory($start, $end)` memuat semua transaksi debit bulan berjalan yang berkategori (`whereNotNull('category_id')`, eager `category`).
2. Group by `category_id`, sum amount, ambil 5 terbesar; transaksi debit tanpa kategori digabung sebagai "Tanpa Kategori" bila > 0.
3. Setiap slice diberi warna dari palet tetap 6 warna.
4. Dirender sebagai donut chart ApexCharts.

### Daftar Rekening Bank

1. `getBankAccounts()` mengembalikan semua rekening (nama, bank, nomor, `balance` computed), diurutkan saldo terbesar.
2. Ditampilkan di kartu "Rekening Bank" dengan saldo terformat `Intl.NumberFormat('id-ID')`.

### Invoice Tertunda (top 5)

1. `getPendingInvoices()` — invoice status `sent`/`partially_paid`/`overdue`, urut `due_date`, ambil 5, eager `client`.
2. Per invoice: sisa tagihan (`total_amount - sum payments`) dan `days_until_due` (`Carbon::today()->diffInDays($due_date, false)` — negatif bila lewat jatuh tempo).
3. Kartu "Invoice Tertunda" dengan link ke `/invoices`.

### Transaksi Terbaru (gabungan)

1. `getRecentTransactions()` menggabungkan 8 `bank_transactions` terbaru (deskripsi fallback ke label kategori / "Transaksi Bank") dan 5 `payments` terbaru (deskripsi "Pembayaran {invoice_number} — {client}").
2. Digabung, sort desc by date, ambil 8 teratas untuk feed.

### Reimburse Terbaru & Pengajuan Dana Terbaru

1. `getRecentReimbursements()` / `getRecentFundRequests()` — masing-masing 5 record terbaru by `created_at` dengan nama pemohon, nominal, status (dan prioritas untuk fund request).
2. Kartu bertautan ke `/reimbursements` dan `/fund-requests` (komponen `SectionHeader` dengan prop `href`).

### Sidebar Action Counts (shared prop, bukan bagian controller Dashboard)

Bukan dihitung di `DashboardController`, melainkan shared Inertia prop `actionCounts` di `HandleInertiaRequests::share()` — tampil sebagai badge angka di item sidebar Reimbursements dan Fund Requests di **semua** halaman.

**Alur step-by-step:**
1. Setiap request Inertia, middleware mengevaluasi lazy prop `actionCounts` untuk user login.
2. `reimbursements` = count status `pending` (bila user `can('approve reimbursements')`) + count status `approved` (bila `can('pay reimbursements')`).
3. `fund_requests` = count status `pending` (bila `can('approve fund requests')`) + count status `approved` (bila `can('disburse fund requests')`).
4. User tanpa permission review/pay/disburse mendapat 0 — badge tidak tampil.

```php
// app/Http/Middleware/HandleInertiaRequests.php — getActionCounts()
$fundRequests = 0;
if ($user->can('approve fund requests')) {
    $fundRequests += FundRequest::where('status', 'pending')->count();
}
if ($user->can('disburse fund requests')) {
    $fundRequests += FundRequest::where('status', 'approved')->count();
}
```

## Keterkaitan Antar Modul

- **Cash Flow** — fallback redirect menuju `cash-flow.expenses`; grafik & stats bulanan bersumber dari `bank_transactions` yang dikelola modul Cash Flow / Bank Accounts.
- **Bank Accounts** — semua angka saldo memakai accessor `balance` computed (`initial_balance + payments credit + tx credit - tx debit`); dashboard tidak pernah membaca saldo tersimpan.
- **Invoices & Payments** — overview pendapatan, laba, outstanding, HPP, PP, invoice tertunda.
- **Reimbursements & Fund Requests** — feed 5 terbaru; badge sidebar via shared prop `actionCounts`.
- **Permissions** — `view dashboard` adalah permission togglable per role (seed di `MasterPermissionSeeder`); mematikannya mengubah landing user menjadi halaman Pengeluaran.

## Invarian & Jebakan

- **Fallback bukan dinamis** — implementasi nyata me-redirect tetap ke `cash-flow.expenses`, bukan mencari "modul pertama yang boleh diakses user". Jika role juga tidak punya `view cash flow`, user akan menabrak 403 di sana — pastikan role tanpa dashboard minimal punya akses cash flow.
- **Berat secara query** — `getCashFlowChart()` 12 query, `getBankAccounts()`/`total_balance` memuat relasi payments+transactions per akun untuk saldo computed, `getExpensesByCategory()` memuat koleksi penuh lalu group di PHP. Tidak ada caching; hati-hati menambah blok baru.
- **Semua nominal integer rupiah penuh** — format tampilan di React dengan helper `formatCurrency` / `Intl.NumberFormat('id-ID')`, jangan bagi 100.
- **`total_pp` adalah estimasi 0,5% dibulatkan** (`round`) atas basis item non titipan pajak dari invoice `partially_paid|paid` — bukan angka pajak resmi tercatat.
- **Feed transaksi menggabungkan dua sumber** (`bank_transactions` + `payments`) — pembayaran invoice muncul sebagai income di feed meskipun bukan `BankTransaction`; jangan menjumlahkan feed ini untuk rekonsiliasi.
- Route `/` bukan dashboard — `Route::redirect('/', '/login')`; landing pasca-login diarahkan ke `/dashboard` yang kemudian bisa melempar ke Pengeluaran.

## File Kunci

- `d:\Laravel\finance-management\app\Http\Controllers\DashboardController.php` — invokable, seluruh agregasi
- `d:\Laravel\finance-management\routes\web.php` — `Route::get('/dashboard', DashboardController::class)->name('dashboard')` (baris ±106)
- `d:\Laravel\finance-management\resources\js\pages\dashboard.tsx` — kartu overview, ApexCharts (cash flow & donut), feed section
- `d:\Laravel\finance-management\app\Http\Middleware\HandleInertiaRequests.php` — shared prop `actionCounts` (badge sidebar) & `auth.permissions`
- `d:\Laravel\finance-management\app\Models\BankAccount.php` — accessor `balance` computed yang menjadi dasar semua angka saldo
- `d:\Laravel\finance-management\tests\Feature\DashboardAccessTest.php`, `DashboardTest.php`

---

<a id="notifications"></a>

# Modul: Notifications (AppNotification)

> Sistem notifikasi in-app sederhana berbasis satu tabel `app_notifications` (bukan Laravel Notification bawaan). Modul lain menulis notifikasi lewat factory statis `AppNotification::notify()` / `notifyMany()`; UI menampilkan lonceng (bell) + drawer di header dengan unread count dari shared props Inertia. Route prefix `/notifications` (nama route `notifications.*`), tanpa gate permission — setiap user login hanya melihat notifikasi miliknya sendiri.

## Tabel Database

| Tabel | Kolom | Keterangan |
|-------|-------|------------|
| `app_notifications` | `user_id`, `type` (string), `title`, `message`, `data` (JSON, cast array), `read_at` (nullable datetime) | Satu baris per penerima. `data` biasanya berisi `{..._id, url}` — `url` dipakai frontend untuk navigasi saat notifikasi diklik. |

## Model `AppNotification` (`app/Models/AppNotification.php`)

- **Scopes**: `unread()` (`read_at` null), `forUser($userId)`, `recent($days = 30)`.
- **Helpers**: `isUnread()`, `isRead()`, `markAsRead()` (idempoten — jika sudah dibaca langsung `return true`).
- **Accessors presentasi**: `icon` dan `color` dipetakan dari `type` via `match` (mis. `invoice_payment_received` → icon `banknotes`, warna `green`); ada juga `icon_bg_color`/`icon_color` (kelas Tailwind, sisa era Livewire — frontend React memetakan sendiri).
- **Factory**:

```php
public static function notify(int $userId, string $type, string $title, string $message, array $data = []): self
{
    return self::create([
        'user_id' => $userId, 'type' => $type, 'title' => $title,
        'message' => $message, 'data' => $data,
    ]);
}

public static function notifyMany(array $userIds, ...): void  // loop notify() per user
```

- **Cleanup**:

```php
public static function cleanupOld(int $days = 90): int
{
    return self::where('created_at', '<', now()->subDays($days))
        ->whereNotNull('read_at')
        ->delete();
}
```

`cleanupOld()` hanya menghapus notifikasi **yang sudah dibaca** dan lebih tua dari `$days`. Saat ini **tidak dijadwalkan** di `routes/console.php` — tersedia untuk dipanggil manual/tinker atau dijadwalkan kemudian.

## Tipe Notifikasi & Pengirimnya (hasil grep `AppNotification::notify`)

| Type | Pengirim | Penerima | Pemicu |
|------|----------|----------|--------|
| `feedback_submitted` | `FeedbackController::notifyAdmins()` (baris 174) | Semua user role `admin` + `finance manager` | User mengirim feedback baru |
| `feedback_responded` | `FeedbackController::respond()` (baris 147) | Pemilik feedback | Admin menanggapi feedback |
| `invoice_due_soon` | `app/Console/Commands/NotifyInvoiceDueDates.php` (`notifyMany`, baris 37 & 54) | Semua admin + finance manager | Scheduler harian: invoice `draft`/`partially_paid` jatuh tempo H-3 dan H-0 |
| `feedback_status_changed`, `invoice_created`, `invoice_payment_received`, `invoice_deleted`, `payment_deleted` | — | — | Terdefinisi di peta icon/warna model & frontend, tetapi **saat ini tidak ada pemanggilnya** di codebase (siap pakai untuk event mendatang) |

Scheduler: `routes/console.php` → `Schedule::command('invoices:notify-due-dates')->dailyAt('08:00');`

## Fitur

### Daftar Notifikasi — JSON (`GET /notifications`)

**Alur step-by-step:**
1. User membuka drawer "Lihat semua notifikasi" → frontend `fetch('/notifications?page=N&per_page=20')` dengan header `Accept: application/json` + CSRF.
2. Route `notifications.index` (auth only) → `NotificationController::index()`.
3. Query `AppNotification::forUser(auth()->id())` urut terbaru; **pagination kumulatif**: `limit($perPage * $page)` — halaman 2 mengembalikan 40 item pertama (pola "load more", bukan offset).
4. Respons JSON: `items` (dengan `icon` & `color` hasil accessor), `total`, `unread_count`, `has_more`.
5. Drawer me-render daftar; tombol "Muat lebih banyak" menaikkan `page`.

**Penjelasan kode** (`app/Http/Controllers/NotificationController.php`):

```php
$query = AppNotification::forUser($userId)->orderByDesc('created_at');
$total = (clone $query)->count();
$items = $query->limit($perPage * $page)->get()->map(fn (AppNotification $n) => [
    'id' => $n->id, 'type' => $n->type, 'title' => $n->title,
    'message' => $n->message, 'data' => $n->data,
    'read_at' => $n->read_at?->toIso8601String(), ...
]);
```

### Tandai Dibaca (`POST /notifications/{notification}/read`)

**Alur step-by-step:**
1. User mengklik satu notifikasi di bell popover atau drawer.
2. Frontend `router.post('/notifications/{id}/read', {}, { only: ['notifications'] })`.
3. Controller: `abort_unless($notification->user_id === auth()->id(), 403)` — user tidak bisa membaca notifikasi orang lain (route model binding tanpa scope, jadi guard manual ini penting).
4. `$notification->markAsRead()` mengisi `read_at = now()`.
5. `redirect()->back()` → Inertia partial reload prop `notifications` → badge unread berkurang; `onSuccess` frontend lalu `router.visit(item.data.url)` jika notifikasi membawa `url`.

### Tandai Semua Dibaca (`POST /notifications/mark-all-read`)

**Alur step-by-step:**
1. User klik "Tandai semua" di header popover bell.
2. Controller: `AppNotification::forUser(auth()->id())->unread()->update(['read_at' => now()])` — satu query massal.
3. `redirect()->back()` + partial reload `only: ['notifications']` → badge menjadi 0 tanpa kehilangan state halaman (`preserveState: true`).

### Shared Props Inertia — Unread Count di Semua Halaman

`app/Http/Middleware/HandleInertiaRequests.php::share()` membagikan prop **lazy** `notifications`:

```php
'notifications' => fn () => $user ? $this->getNotifications($user->id) : null,
```

`getNotifications()` mengembalikan:

```php
return [
    'recent' => $recent->values()->toArray(),   // 10 terbaru dari 30 hari terakhir (scope recent())
    'unread_count' => AppNotification::forUser($userId)->unread()->count(),
];
```

Karena berupa closure, query hanya dijalankan saat prop diminta, dan bisa di-refresh sendirian via `router.reload({ only: ['notifications'] })`. Middleware yang sama juga membagikan `actionCounts` (badge sidebar reimbursement/fund request pending — permission-aware), `auth.permissions`, `locale`, dan `flash`.

### Alur UI: Bell → Drawer

Implementasi React saat ini memakai **props/callback antar komponen**, bukan browser event — deskripsi lama `dispatch('open-notification-drawer')` di CLAUDE.md adalah warisan era Livewire/Alpine.

1. `resources/js/layouts/header.tsx` memegang state `drawerOpen` dan me-render keduanya:

```tsx
<NotificationBell onOpenDrawer={() => setDrawerOpen(true)} />
...
<NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
```

2. **`NotificationBell`** (`resources/js/components/notifications/notification-bell.tsx`): membaca `usePage().props.notifications` (shared prop), menampilkan badge merah `unread_count` (cap "99+"), popover berisi 10 item `recent`. Klik item → POST read → visit `data.url`. Tombol "Lihat semua notifikasi" memanggil `onOpenDrawer()`.
3. **`NotificationDrawer`** (`notification-drawer.tsx`): Sheet samping; setiap kali `open` menjadi true, `fetch('/notifications')` halaman 1 (JSON endpoint), mendukung load-more via `has_more`. Klik item → POST read (efeknya juga menyegarkan prop `notifications` sehingga badge bell ikut turun — inilah pengganti event `notification-read` lama).
4. Peta icon/warna per `type` diduplikasi di kedua komponen (`TYPE_ICON_MAP`, `COLOR_MAP`) memakai icon lucide.

## Keterkaitan Antar Modul

- **Feedbacks** — pengirim notifikasi terbanyak (`feedback_submitted` ke admin/FM, `feedback_responded` ke pemilik).
- **Invoices** — command terjadwal `invoices:notify-due-dates` (H-3/H-0) ke admin/FM; tipe `invoice_created`/`invoice_payment_received`/`invoice_deleted`/`payment_deleted` sudah disiapkan di peta icon.
- **Permission/Roles** — penerima notifikasi broadcast ditentukan via `User::role(['admin', 'finance manager'])`.
- **HandleInertiaRequests** — jembatan unread count ke seluruh halaman React.

## Invarian & Jebakan

- **Kepemilikan ketat**: semua query lewat `forUser(auth()->id())`; `markAsRead` menjaga dengan `abort_unless(user_id === auth()->id(), 403)`. Jangan tambah endpoint tanpa guard serupa.
- `data.url` adalah **konvensi** — frontend menavigasi ke sana setelah read; selalu sertakan `url` di `data` saat memanggil `notify()` agar notifikasi bisa diklik.
- Pagination index bersifat **kumulatif** (`limit(perPage * page)`) — `page=3` mengembalikan 60 item, bukan item ke-41..60; `has_more = items.count() < total`.
- Bell hanya menampilkan notifikasi **30 hari terakhir** (scope `recent()`), maksimal 10 — notifikasi lama hanya terlihat di drawer (endpoint JSON tanpa filter recent).
- `notifyMany()` melakukan insert **per user dalam loop** — untuk penerima sangat banyak pertimbangkan bulk insert.
- `cleanupOld()` tidak pernah menghapus notifikasi belum dibaca, dan **belum dijadwalkan** — tabel akan tumbuh terus tanpa intervensi.
- Menambah `type` baru: cukup string bebas, tetapi tanpa entri di `match` model dan `TYPE_ICON_MAP`/`COLOR_MAP` frontend akan jatuh ke icon `bell` warna `gray` — tambahkan di tiga tempat (model + 2 komponen React).
- Prop `notifications` lazy — saat memutasi notifikasi dari halaman React, gunakan `only: ['notifications']` agar tidak memicu reload penuh.

## File Kunci

- `d:\Laravel\finance-management\app\Models\AppNotification.php`
- `d:\Laravel\finance-management\app\Http\Controllers\NotificationController.php`
- `d:\Laravel\finance-management\routes\web.php` (baris 446–453) dan `routes\console.php` (jadwal `invoices:notify-due-dates`)
- `d:\Laravel\finance-management\app\Console\Commands\NotifyInvoiceDueDates.php`
- `d:\Laravel\finance-management\app\Http\Middleware\HandleInertiaRequests.php` (`getNotifications()`)
- `d:\Laravel\finance-management\resources\js\layouts\header.tsx`
- `d:\Laravel\finance-management\resources\js\components\notifications\notification-bell.tsx`
- `d:\Laravel\finance-management\resources\js\components\notifications\notification-drawer.tsx`
- `d:\Laravel\finance-management\app\Http\Controllers\FeedbackController.php` (contoh pemanggil `notify()`)

---

<a id="feedbacks"></a>

# Modul: Feedbacks

> Sistem umpan balik internal: user melaporkan bug, mengajukan fitur, atau memberi saran lewat tombol feedback melayang yang ada di semua halaman; admin meninjau di halaman `/feedbacks` (tab All/My), menanggapi, dan mengubah status `open → in_progress → resolved → closed`. Route prefix `/feedbacks`, digate permission `view feedbacks` (grup) plus `create/edit/delete/respond/manage feedbacks` per aksi.

## Tabel Database

| Tabel | Kolom | Keterangan |
|-------|-------|------------|
| `feedbacks` | `user_id`, `title`, `description`, `type` enum(`bug`,`feature`,`feedback`), `priority` enum(`low`,`medium`,`high`,`critical`), `status` enum(`open`,`in_progress`,`resolved`,`closed`), `page_url`, `attachment_path`, `attachment_name`, `admin_response`, `responded_by` (FK users), `responded_at` | Nama tabel eksplisit `protected $table = 'feedbacks'`. Lampiran di disk `public` folder `feedbacks/`. |

## Model `Feedback` (`app/Models/Feedback.php`) — Ringkasan Perilaku

- **Relasi**: `user()` (pengirim), `responder()` (`belongsTo User, 'responded_by'`).
- **Scopes**: `forUser`, `byStatus`, `byType`, `byPriority`, `open`, `pending` (open + in_progress).
- **State machine ringan**: `canEdit()` dan `canDelete()` hanya saat `status === 'open'`; `canRespond()` saat `open` atau `in_progress`.
- **Aksi**: `respond($responderId, $response, $newStatus)` mengisi `admin_response`, `responded_by`, `responded_at` (+ status bila diberikan); `changeStatus($status)`.
- **Sanitasi**: accessor `safe_description` / `safe_admin_response` — `strip_tags` dengan whitelist tag rich-text (`<p><br><strong><em>...`), dipakai saat menampilkan detail.
- **Lampiran**: `attachment_url` (`Storage::url`), deteksi `isImageAttachment()`/`isPdfAttachment()`; hook `static::deleting` **menghapus file dari storage** saat feedback dihapus.
- **Katalog UI**: `types()`, `priorities()`, `statuses()` mengembalikan opsi berlabel `__('feedback.*')` (i18n server-side), plus accessor warna/icon badge per type/priority/status.

## Fitur

### Tombol Feedback Melayang (semua halaman)

**Alur step-by-step:**
1. `resources/js/layouts/app-layout.tsx` me-render `<FloatingFeedbackButton />` di setiap halaman aplikasi (tombol bulat kanan-bawah, `fixed bottom-6 right-6`).
2. Klik tombol → Dialog form: `SegmentedControl` tipe (Bug/Fitur/Saran) dan prioritas (Rendah–Kritis), `Input` judul, `Textarea` deskripsi, `FileUpload` lampiran (jpg/jpeg/png/pdf, max 5 MB).
3. Saat dialog terbuka, `page_url` **otomatis diisi** `window.location.pathname` — admin jadi tahu di halaman mana masalah terjadi.
4. Submit → `post('/feedbacks', { forceFormData: true })`; sukses → toast Sonner + reset form.

**Penjelasan kode** (`resources/js/components/floating-feedback-button.tsx`):

```tsx
React.useEffect(() => {
    if (open) {
        setData('page_url', window.location.pathname);
    } else {
        clearErrors();
    }
}, [open]);
```

### Buat Feedback (`POST /feedbacks`)

**Alur step-by-step:**
1. Request dari floating button (atau halaman feedbacks) → middleware `can:view feedbacks` (grup) + `can:create feedbacks`.
2. Validasi `StoreFeedbackRequest` (`app/Http/Requests/StoreFeedbackRequest.php`): `title` max 255, `description` max 5000, `type` in `bug,feature,feedback`, `priority` in `low,medium,high,critical`, `page_url` nullable max 500, `attachment` nullable file `mimes:jpg,jpeg,png,pdf` max 5120 KB.
3. Dalam `DB::transaction`: file (bila ada) disimpan `$file->store('feedbacks', 'public')` dengan nama asli disimpan di `attachment_name`; `Feedback::create()` dengan `user_id = auth()->id()` dan `status = 'open'`.
4. `notifyAdmins($feedback)`: loop semua user role `admin`/`finance manager` → `AppNotification::notify(..., 'feedback_submitted', ...)` berisi `{feedback_id, url}`.
5. Redirect back + flash "Feedback berhasil dikirim. Terima kasih atas masukannya."

**Penjelasan kode** (`app/Http/Controllers/FeedbackController.php`):

```php
$feedback = Feedback::create([
    'user_id' => auth()->id(),
    'title' => $validated['title'],
    'description' => $validated['description'],
    'type' => $validated['type'],
    'priority' => $validated['priority'],
    'page_url' => $validated['page_url'] ?? null,
    'attachment_path' => $attachmentPath,
    'attachment_name' => $attachmentName,
    'status' => 'open',
]);
$this->notifyAdmins($feedback);
```

### Daftar Feedback — Tab All / My (`GET /feedbacks`)

**Alur step-by-step:**
1. User membuka Administrasi → Feedback → middleware `can:view feedbacks`.
2. `FeedbackController::index()` menghitung `$canManage = $user->can('manage feedbacks')`.
3. Tab default: `all` untuk pengelola, `mine` untuk lainnya. **Tab All hanya efektif jika `canManage`** — selain itu query selalu `Feedback::forUser($user->id)` (staff mustahil melihat feedback orang lain walau memaksa `?tab=all`).
4. Filter: `search` (title/description/nama user), `status`, `type`, `priority`; sorting + paginasi `withQueryString()`.
5. Stats dihitung satu query `selectRaw` (total, open, in_progress, resolved, bugs, features, feedbacks) dengan scope sama seperti tab.
6. Render `feedbacks/index` (React `resources/js/pages/feedbacks/index.tsx`) dengan prop `canManage`, `canRespond`, dan `showFeedback` — detail feedback dimuat server-side bila ada query `?show={id}` (juga di-scope kepemilikan bila bukan pengelola).
7. Tiap baris membawa flag `can_edit` / `can_delete` (milik sendiri + status open) dan `can_respond` untuk gating tombol di UI.

**Penjelasan kode:**

```php
$baseQuery = ($canManage && $tab === 'all')
    ? Feedback::query()
    : Feedback::forUser($user->id);
```

### Edit Feedback (`PUT /feedbacks/{feedback}`)

**Alur step-by-step:**
1. Pemilik membuka dialog edit (tombol hanya muncul jika `can_edit`).
2. Middleware `can:edit feedbacks` → guard controller: `abort_unless($feedback->user_id === auth()->id() && $feedback->canEdit(), 403)` — hanya **pemilik** dan hanya selama status masih `open` (belum diproses admin).
3. Validasi `UpdateFeedbackRequest` → `$feedback->update($validated)`.
4. Redirect back + flash "Feedback berhasil diperbarui."

### Hapus Feedback (`DELETE /feedbacks/{feedback}`)

**Alur step-by-step:**
1. Middleware `can:delete feedbacks`.
2. Guard: boleh dihapus oleh **pemilik** ATAU siapa pun dengan `manage feedbacks`; jika pemilik tetapi status bukan `open` → flash error "Feedback yang sudah diproses tidak dapat dihapus." (pengelola tetap boleh menghapus status apa pun).
3. `$feedback->delete()` — hook `deleting` di model otomatis menghapus file lampiran dari storage.
4. Redirect back + flash success.

**Penjelasan kode:**

```php
abort_unless($feedback->user_id === auth()->id() || auth()->user()->can('manage feedbacks'), 403);

if ($feedback->user_id === auth()->id() && ! $feedback->canDelete()) {
    return redirect()->back()->with('error', 'Feedback yang sudah diproses tidak dapat dihapus.');
}
```

### Tanggapi Feedback (`POST /feedbacks/{feedback}/respond`)

**Alur step-by-step:**
1. Admin/FM membuka detail feedback → menulis tanggapan + memilih status baru.
2. Middleware `can:respond feedbacks` + guard ganda di controller: `can('respond feedbacks')` dan `$feedback->canRespond()` (hanya `open`/`in_progress` — feedback resolved/closed tidak bisa ditanggapi lagi).
3. Validasi `RespondFeedbackRequest`: `response` max 5000, `status` in `in_progress,resolved,closed` (respond selalu memajukan status, tidak boleh kembali ke `open`).
4. `$feedback->respond(auth()->id(), $response, $status)` mengisi `admin_response`, `responded_by`, `responded_at`, `status`.
5. `AppNotification::notify($feedback->user_id, 'feedback_responded', ...)` — pemilik mendapat notifikasi bell.
6. Redirect back + flash "Tanggapan berhasil dikirim."

**Penjelasan kode** (`app/Models/Feedback.php`):

```php
public function respond(int $responderId, string $response, ?string $newStatus = null): bool
{
    $data = [
        'admin_response' => $response,
        'responded_by' => $responderId,
        'responded_at' => now(),
    ];
    if ($newStatus) {
        $data['status'] = $newStatus;
    }
    return $this->update($data);
}
```

### Ubah Status (`POST /feedbacks/{feedback}/status`)

**Alur step-by-step:**
1. Pengelola mengubah status langsung dari daftar/detail (tanpa menulis tanggapan).
2. Middleware `can:manage feedbacks` + guard `abort_unless(...can('manage feedbacks'), 403)`.
3. Validasi `ChangeStatusFeedbackRequest`: `status` in `open,in_progress,resolved,closed` — endpoint ini **boleh** mengembalikan ke `open` (berbeda dari respond).
4. `$feedback->changeStatus($status)` → flash "Status feedback diperbarui."

## Permission Matrix (dari `MasterPermissionSeeder`)

| Permission | admin | finance manager | staff | Fungsi |
|---|---|---|---|---|
| `view feedbacks` | ✓ | ✓ | ✓ | Akses halaman (staff otomatis ter-scope miliknya) |
| `create feedbacks` | ✓ | ✓ | ✓ | Kirim feedback (floating button) |
| `edit feedbacks` | ✓ | ✓ | ✓ | Edit milik sendiri saat masih `open` |
| `delete feedbacks` | ✓ | ✓ | ✓ | Hapus (pemilik saat open / pengelola kapan pun) |
| `respond feedbacks` | ✓ | ✓ | ✗ | Menulis `admin_response` |
| `manage feedbacks` | ✓ | ✓ | ✗ | Tab All, ubah status, hapus feedback siapa pun |

## Keterkaitan Antar Modul

- **Notifications**: create → `feedback_submitted` ke semua admin/FM; respond → `feedback_responded` ke pemilik. `data.url` menunjuk `route('feedbacks.index')` sehingga klik notifikasi membuka halaman feedback.
- **Permissions/Roles**: penerima broadcast dicari via `User::role(['admin', 'finance manager'])`; seluruh gating memakai permission `... feedbacks` dari `MasterPermissionSeeder`.
- **Layout React**: `FloatingFeedbackButton` dipasang di `resources/js/layouts/app-layout.tsx` — muncul di semua halaman ber-layout aplikasi.
- **i18n**: label type/priority/status dari `lang/*/feedback.php` (`__('feedback.type_bug')`, dst.).
- **Storage**: lampiran di disk `public` (`feedbacks/`), diakses via `Storage::url` — butuh `php artisan storage:link`.

## Invarian & Jebakan

- **Scoping kepemilikan dua lapis**: permission route + scope query (`forUser`) + guard `abort_unless` di controller. Staff dengan `view feedbacks` tetap tidak pernah melihat feedback user lain.
- **Edit/hapus pemilik hanya saat `open`** — begitu admin memproses (in_progress dst.), pemilik kehilangan kendali; hanya pengelola yang bisa menghapus.
- **`respond` vs `changeStatus`**: respond hanya untuk status maju (`in_progress|resolved|closed`) dan mensyaratkan `canRespond()`; changeStatus bebas keempat status termasuk kembali ke `open`, tetapi butuh `manage feedbacks`.
- **Tampilkan deskripsi lewat `safe_description` / `safe_admin_response`** — jangan render `description` mentah (mengandung HTML user, sanitasi whitelist ada di model).
- Hapus feedback otomatis menghapus lampirannya (hook `deleting`) — jangan hapus baris via query builder massal (`Feedback::where(...)->delete()`) karena hook model tidak terpanggil dan file yatim tertinggal.
- `page_url` diisi otomatis oleh frontend dari `window.location.pathname` — nullable, jangan diasumsikan selalu ada.
- Notifikasi ke admin dikirim **di dalam transaksi** create — gagal notifikasi menggagalkan pembuatan feedback (rollback).
- Nama tabel `feedbacks` dideklarasikan eksplisit karena bukan bentuk jamak standar Laravel (`feedback`).

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (baris 417–436 — blok feedbacks)
- `d:\Laravel\finance-management\app\Http\Controllers\FeedbackController.php`
- `d:\Laravel\finance-management\app\Models\Feedback.php`
- `d:\Laravel\finance-management\app\Http\Requests\StoreFeedbackRequest.php`, `UpdateFeedbackRequest.php`, `RespondFeedbackRequest.php`, `ChangeStatusFeedbackRequest.php`
- `d:\Laravel\finance-management\resources\js\components\floating-feedback-button.tsx`
- `d:\Laravel\finance-management\resources\js\layouts\app-layout.tsx` (mount floating button)
- `d:\Laravel\finance-management\resources\js\pages\feedbacks\index.tsx`
- `d:\Laravel\finance-management\lang\id\feedback.php` (label i18n)
- `d:\Laravel\finance-management\tests\Feature\FeedbackControllerTest.php`

---

<a id="admin-users-permissions"></a>

# Modul: Admin — Users & Permissions/Roles

> Modul administrasi untuk mengelola akun pengguna (CRUD + bulk delete, status aktif/nonaktif, assign role) dan sistem izin berbasis **Spatie Permission 6** (toggle permission per role, sync per modul, sync semua, CRUD role dengan icon). Route prefix `/admin` dengan nama route `admin.*`. Halaman user digate permission `manage users`; halaman permission digate `view permissions` (baca) dan `manage permissions` (mutasi).

## Tabel Database

| Tabel | Kolom penting | Keterangan |
|-------|---------------|------------|
| `users` | `name`, `email`, `password`, `phone_number`, `status` enum(`active`,`inactive`), `locale`, `email_verified_at` | Akun pengguna. `status` dicek via `User::isActive()`. |
| `roles` | `name`, `icon`, `guard_name` | Tabel Spatie + kolom custom `icon` (nama icon lucide, mis. `shield-check`). |
| `permissions` | `name`, `guard_name` | Format nama: `"{aksi} {modul}"`, mis. `view invoices`, `manage users`. |
| `model_has_roles` | `company_id`, `role_id`, `model_type`, `model_id` | Pivot user ↔ role (Spatie), **scoped per perusahaan** — PK komposit dimulai `company_id`. |
| `model_has_permissions` | `company_id`, `permission_id`, `model_type`, `model_id` | Pivot permission langsung ke user (tidak dipakai aplikasi — semua lewat role). |
| `role_has_permissions` | `permission_id`, `role_id` | Pivot role ↔ permission (tidak ter-scope team). |

## Multi-Tenancy: Spatie Teams (sejak 2026-08-11)

Fitur **teams** Spatie AKTIF dengan `team_foreign_key = company_id` (**string** — mengikuti `companies.id` yang berupa slug, mis. `kisantra`). Konsekuensi yang wajib dipahami:

- **Role bersifat GLOBAL** (`roles.company_id = NULL`) — definisi role & permission sama untuk semua perusahaan. **Assignment role per (user, perusahaan)** — Budi bisa `finance manager` di PT A sekaligus `staff` di PT B.
- **Konteks team WAJIB di-set sebelum permission check / assignRole.** Di HTTP ini otomatis: middleware `app/Http/Middleware/SetPermissionsTeam.php` (terdaftar sebelum `HandleInertiaRequests` di `bootstrap/app.php`) membaca `tenant()` (routing `/c/{company}`, Tahap 2) dengan fallback keanggotaan pertama user (`company_user`). Di seeder/job/command: panggil `setPermissionsTeamId()` manual — tanpa konteks, `assignRole` GAGAL (kolom `company_id` NOT NULL di pivot).
- **Membuat role global** di kode: `setPermissionsTeamId(null)` dulu (pola di `MasterPermissionSeeder`).
- **Keanggotaan perusahaan** hidup di pivot `company_user` (user_id, company_id) — TANPA kolom role; role selalu dari Spatie teams. `UserController@store` otomatis meng-attach user baru ke perusahaan aktif admin pembuatnya.
- Di test, `Tests\TestCase::setUp()` men-set team default `test-company`; test isolasi lihat `tests/Feature/CompanyPermissionIsolationTest.php`.
- Impor user deployment lama: `php artisan central:import-users {connection} --organization= --company=` (`app/Services/CentralUserImportService.php`, idempoten).

### Provisioning Perusahaan (`/admin/companies`, sejak Tahap 4)

Halaman **Perusahaan** (permission baru `manage companies`, admin only — migration
`2026_08_11_120000_add_manage_companies_permission_to_roles.php`) untuk membuat perusahaan
baru di organization admin yang login:

1. Form: nama, **kode URL/slug (permanen — menjadi `/c/{slug}`, nama DB `tenant_{slug}`,
   path storage)**, **singkatan dokumen (permanen, manual — dipakai nomor invoice)**.
   Validasi slug: regex `^[a-z0-9]+(-[a-z0-9]+)*$`, unik. Kuota organization dicek
   (`Organization::hasReachedCompanyQuota()`).
2. `Company::create()` → pipeline SINKRON: CreateDatabase → MigrateDatabase →
   SeedDatabase (`TenantDatabaseSeeder`) → **`App\Jobs\MarkCompanyActive`** (status → `active`).
   Gagal di tengah → status **`failed`** + tombol **Coba Ulang** (drop DB setengah jadi →
   hapus baris tanpa event → create ulang). Pembuat otomatis jadi anggota + role `admin`
   di perusahaan baru (`grantCreatorAccess`).
3. File: `app/Http/Controllers/Admin/CompanyController.php`,
   `app/Http/Requests/Admin/StoreCompanyRequest.php`,
   `resources/js/pages/admin/companies/index.tsx`;
   test `tests/Feature/Admin/CompanyControllerTest.php`.

**⚠ Invarian validasi lintas-database:** rule `unique:`/`exists:` yang menunjuk tabel
CENTRAL (users, companies) WAJIB diprefix koneksi central — `unique:mysql.users` — karena
di dalam konteks tenant, koneksi default validator menunjuk DB perusahaan. Sudah diterapkan
di StoreUserRequest/UpdateUserRequest/BulkDestroyUserRequest/StoreCompanyRequest.

## Struktur Permission — Sumber Kebenaran: `MasterPermissionSeeder`

File `database/seeders/MasterPermissionSeeder.php` adalah **sumber kebenaran** struktur permission. Seeder berjalan 4 tahap: (1) buat/update 3 role bawaan, (2) buat semua permission (idempoten via `firstOrCreate`) sekaligus **menghapus permission usang** hasil pemecahan cash-flow (`view transactions`, `view cash-flow`, dll.), (3) sync permission ke role, (4) pastikan minimal ada satu user admin (jika kosong, user pertama otomatis di-assign role admin).

Konvensi nama permission = `aksi + spasi + modul`. Modul dan aksinya:

| Modul | Permissions |
|-------|-------------|
| Dashboard | `view dashboard` |
| Clients / Services / Invoices / Payments / Bank Accounts | `view` / `create` / `edit` / `delete` per modul |
| Cash Flow (dipecah per tab) | `view/create/edit/delete income`, `... expense`, `... transfer` |
| Recurring Invoices | CRUD + `publish recurring-invoices` |
| Categories | `view categories`, `manage categories` |
| Reimbursements | CRUD + `approve reimbursements`, `pay reimbursements` |
| Fund Requests | CRUD + `approve fund requests`, `disburse fund requests` |
| Loans | CRUD + `pay loans` |
| Receivables | CRUD + `approve receivables`, `pay receivables` |
| Permission Mgmt | `view permissions`, `manage permissions` |
| User Mgmt | `manage users` (satu-satunya permission modul ini — tidak ada `view users`) |
| Feedbacks | CRUD + `respond feedbacks`, `manage feedbacks` |
| Reports | `view profit-loss` |
| PDF Templates | `manage pdf templates` |

### 3 Role Bawaan & Filosofinya

| Role | Icon | Filosofi |
|------|------|----------|
| `admin` | `shield-exclamation` | Akses penuh — `syncPermissions(Permission::all())`. Termasuk `manage users`, `manage permissions`, `manage pdf templates`. |
| `finance manager` | `banknotes` | Operasional keuangan penuh (invoice, payment, cash flow, approve/pay/disburse) **tanpa manajemen user & permission** — hanya `view permissions`, tidak dapat `manage users`, `manage permissions`, `manage pdf templates`. Juga tidak bisa `delete clients`/`delete services`. |
| `staff` | `user` | View/create milik sendiri: lihat klien & invoice, buat invoice, kelola reimbursement/fund request/feedback miliknya, request receivable. Tanpa approve/pay, tanpa bank-accounts/cash-flow, tanpa laporan. |

## Fitur

### Daftar & Statistik User (`GET /admin/users`)

**Alur step-by-step:**
1. User membuka menu Administrasi → Pengguna; sidebar hanya menampilkan menu jika `useCan().can('manage users')`.
2. Request `GET /admin/users` melewati middleware `can:manage users` (`routes/web.php` baris 509).
3. `UserController::index()` membangun query dengan filter `search` (whereAny name/email/phone_number), `role` (whereHas roles), `status`, sorting, dan paginasi (`per_page` default 10).
4. Controller menghitung stats: total, active, inactive, jumlah admin, jumlah finance manager.
5. Respons `Inertia::render('users/index', [...])` → halaman React `resources/js/pages/users/index.tsx` menampilkan DataTable + StatsCard.

**Penjelasan kode** (`app/Http/Controllers/Admin/UserController.php`):

```php
$users = User::query()
    ->with('roles')
    ->when($search, fn (Builder $q) => $q->whereAny(
        ['name', 'email', 'phone_number'], 'like', '%'.trim($search).'%'
    ))
    ->when($role, fn (Builder $q) => $q->whereHas('roles', fn ($qr) => $qr->where('name', $role)))
    ->when($status, fn (Builder $q) => $q->where('status', $status))
    ->orderBy($sort, $direction)
    ->paginate($perPage)
```

Setiap baris di-`through()` menjadi payload ringkas berisi `role` (role pertama), `role_icon`, `initials` (dari `User::initials()`), dan flag `is_current` (`$user->id === auth()->id()`) yang dipakai frontend untuk menonaktifkan tombol hapus akun sendiri.

### Tambah User (`POST /admin/users`)

**Alur step-by-step:**
1. Admin klik "Tambah Pengguna" di halaman index → dialog form terbuka.
2. Request `POST /admin/users` → middleware `can:manage users` + `$this->authorize('manage users')` di controller (dobel proteksi).
3. Validasi via `StoreUserRequest` (`app/Http/Requests/Admin/StoreUserRequest.php`): `name` required, `email` unique, `phone_number` nullable max 20, `status` in `active,inactive`, `password` min 8 + `confirmed`, `role` harus ada di `roles.name`.
4. Mutasi DB: `User::create()` dengan `Hash::make($password)` dan `email_verified_at => now()` (user buatan admin dianggap terverifikasi), lalu `$user->assignRole($validated['role'])` menulis ke `model_has_roles`.
5. Respons `redirect()->back()` dengan flash `success` → halaman index memuat ulang data dan menampilkan toast.

**Penjelasan kode:**

```php
$user = User::create([
    'name' => $validated['name'],
    'email' => $validated['email'],
    'phone_number' => $validated['phone_number'] ?? null,
    'status' => $validated['status'],
    'password' => Hash::make($validated['password']),
    'email_verified_at' => now(),
]);

$user->assignRole($validated['role']);
```

### Edit User (`PUT /admin/users/{user}`)

**Alur step-by-step:**
1. Admin klik edit pada baris user → dialog terisi data lama.
2. `PUT /admin/users/{user}` → `can:manage users` → validasi `UpdateUserRequest` (email unique ignore id sendiri; password opsional).
3. Controller update kolom profil; password hanya di-update **jika diisi** (`! empty($validated['password'])`).
4. `$user->syncRoles([$validated['role']])` mengganti role lama dengan role baru (single-role model — setiap user hanya punya satu role efektif).
5. Redirect back + flash success.

### Hapus User (`DELETE /admin/users/{user}`)

**Alur step-by-step:**
1. Admin klik hapus → `ConfirmDialog` variant danger.
2. `DELETE /admin/users/{user}` → `can:manage users`.
3. Guard di controller: jika `$user->id === auth()->id()` → redirect back dengan flash `error` "Anda tidak dapat menghapus akun sendiri." — **tidak ada mutasi**.
4. Selain itu `$user->delete()` (hard delete), lalu redirect back + success.

### Bulk Delete User (`POST /admin/users/bulk-delete`)

**Alur step-by-step:**
1. Admin mencentang beberapa baris di DataTable lalu klik hapus massal.
2. `POST /admin/users/bulk-delete` dengan body `{ ids: number[] }` → validasi `BulkDestroyUserRequest` (`ids.*` integer, exists di `users`).
3. Controller membuang id milik sendiri dari daftar: `array_diff($validated['ids'], [auth()->id()])`. Jika hasilnya kosong → flash error "Tidak ada pengguna yang dapat dihapus."
4. `User::whereIn('id', $ids)->delete()` lalu flash `"Berhasil menghapus {$count} pengguna."`.

**Penjelasan kode:**

```php
$ids = array_diff($validated['ids'], [auth()->id()]);
$count = count($ids);
if ($count === 0) {
    return redirect()->back()->with('error', 'Tidak ada pengguna yang dapat dihapus.');
}
User::whereIn('id', $ids)->delete();
```

### Halaman Permission Matrix (`GET /admin/permissions`)

**Alur step-by-step:**
1. User dengan `view permissions` (admin & finance manager) membuka Administrasi → Izin & Peran.
2. `PermissionController::index()` memuat semua role beserta `permission_ids`, `users_count`, `permissions_count`, dan icon (fallback `shield-check`).
3. Semua permission dikelompokkan per modul dengan memecah nama pada spasi pertama — kata setelah aksi menjadi nama grup (`view invoices` → grup `Invoices`).
4. Query string `?role={id}` menentukan role yang dipilih (default role pertama).
5. Render `permissions/index` (React: `resources/js/pages/permissions/index.tsx`) dengan prop `canManagePermissions` — jika `false` (finance manager), matriks bersifat read-only.

**Penjelasan kode** (`app/Http/Controllers/Admin/PermissionController.php`):

```php
$groupedPermissions = $permissions
    ->groupBy(function (Permission $p) {
        $parts = explode(' ', $p->name, 2);
        return count($parts) > 1 ? ucwords($parts[1]) : 'Other';
    })
    ->sortKeys()
```

### Toggle Permission per Role (`POST /admin/permissions/toggle`)

**Alur step-by-step:**
1. Admin mengklik checkbox satu permission pada role terpilih.
2. `POST /admin/permissions/toggle` → middleware `can:manage permissions` + `abort_unless(...can('manage permissions'), 403)` di controller.
3. Validasi inline: `role_id` dan `permission_id` wajib dan exists.
4. Jika role sudah punya permission → `revokePermissionTo()`; jika belum → `givePermissionTo()` (mutasi `role_has_permissions`).
5. `app(PermissionRegistrar::class)->forgetCachedPermissions()` membersihkan cache Spatie, lalu `redirect()->back()` — Inertia memuat ulang matriks.

**Penjelasan kode:**

```php
if ($role->permissions->contains('id', $permission->id)) {
    $role->revokePermissionTo($permission);
} else {
    $role->givePermissionTo($permission);
}
app(PermissionRegistrar::class)->forgetCachedPermissions();
```

### Sync per Modul (`POST /admin/permissions/sync-module`)

**Alur step-by-step:**
1. Admin klik "grant semua" / "revoke semua" pada header grup modul (mis. `Invoices`).
2. Body: `{ role_id, module, action: 'grant'|'revoke' }` → gate `manage permissions`.
3. Controller mencari permission yang bagian modulnya (setelah aksi) sama persis dengan `module` — query `LIKE` awal lalu difilter ulang dengan `explode` agar tepat (mis. `view invoices` cocok modul `Invoices`, `view recurring-invoices` tidak).
4. Loop `givePermissionTo` / `revokePermissionTo` untuk setiap permission modul tersebut.
5. Reset cache Spatie + redirect back.

### Sync Semua (`POST /admin/permissions/sync-all`)

**Alur step-by-step:**
1. Admin klik "Grant All" / "Revoke All" pada role terpilih.
2. Body `{ role_id, action }` → gate `manage permissions`.
3. `grant` → `$role->syncPermissions(Permission::all())`; `revoke` → `$role->syncPermissions([])` (mengosongkan `role_has_permissions` untuk role itu).
4. Reset cache + redirect back.

### Hapus Permission (`DELETE /admin/permissions/{permission}`)

**Alur step-by-step:**
1. Admin menghapus sebuah permission dari sistem (bukan sekadar mencabut dari role).
2. Gate `manage permissions` → dalam `DB::transaction`: cabut permission dari **semua role** yang memilikinya, lalu `$permission->delete()`.
3. Reset cache; sukses → flash success, exception → flash error dengan pesan.

**Penjelasan kode:**

```php
DB::transaction(function () use ($permission) {
    foreach ($permission->roles as $role) {
        $role->revokePermissionTo($permission);
    }
    $permission->delete();
});
```

### CRUD Role + Icon (`POST /admin/roles`, `PUT /admin/roles/{role}`, `DELETE /admin/roles/{role}`)

**Alur step-by-step (store/update):**
1. Admin membuat/mengedit role lewat dialog di halaman permissions.
2. Gate `manage permissions` → validasi: `name` unique di `roles` (update: ignore id sendiri), `icon` harus salah satu dari konstanta `RoleController::AVAILABLE_ICONS` (37 nama icon lucide).
3. Nama disimpan lowercase (`strtolower`), `guard_name` selalu `web`.
4. Reset cache + flash success.

**Alur step-by-step (destroy):**
1. Guard 1: role `admin` dan `staff` **tidak bisa dihapus** ("Peran default ... tidak dapat dihapus"). Catatan: `finance manager` tidak masuk daftar terlindungi.
2. Guard 2: admin tidak dapat menghapus role yang sedang ia sandang sendiri.
3. Dalam transaksi: user yang masih memakai role tersebut dipindahkan ke **role fallback** = role lain dengan jumlah permission paling sedikit (atau `staff` yang dibuat baru jika tidak ada), lalu `$role->delete()`.
4. Reset cache + flash.

**Penjelasan kode** (`app/Http/Controllers/Admin/RoleController.php`):

```php
$fallbackRole = Role::withCount('permissions')
    ->where('name', '!=', $role->name)
    ->orderBy('permissions_count', 'asc')
    ->first();
...
foreach ($usersWithRole as $user) {
    $user->syncRoles([$fallbackRole->name]);
}
$role->delete();
```

### Permission Cache

Spatie meng-cache seluruh tabel permission. Setiap mutasi di controller diikuti `app(PermissionRegistrar::class)->forgetCachedPermissions()`. Jika cache tersangkut (mis. setelah seeding manual atau edit DB langsung), jalankan:

```bash
php artisan permission:cache-reset
```

### Gating UI di React — hook `useCan`

`HandleInertiaRequests::share()` membagikan `auth.permissions` (hasil `getAllPermissions()->pluck('name')`) dan `auth.roles` ke semua halaman. Hook `resources/js/hooks/use-can.ts` membungkusnya:

```ts
export function useCan() {
    const { auth } = usePage<SharedProps>().props;
    const permissions = auth?.permissions ?? [];
    const can = (permission: string) => permissions.includes(permission);
    const canAny = (perms: string[]) => perms.some((p) => permissions.includes(p));
    return { can, canAny };
}
```

Dipakai di sidebar, halaman users, cash-flow, bank-accounts, dll. untuk menyembunyikan menu/tombol. **Gating frontend hanya UX** — otorisasi sebenarnya tetap di middleware route + `authorize()`/`abort_unless()` backend.

## Keterkaitan Antar Modul

- **Semua modul lain** digate oleh permission dari seeder ini via middleware `can:` di `routes/web.php`.
- **Sidebar & seluruh halaman React** membaca `auth.permissions` dari shared props Inertia (`app/Http/Middleware/HandleInertiaRequests.php`).
- **Feedbacks**: `FeedbackController::notifyAdmins()` mengirim notifikasi ke semua user ber-role `admin`/`finance manager` (`User::role([...])`).
- **Scheduler**: `invoices:notify-due-dates` juga menarget user ber-role admin/finance manager.
- **Settings → PDF Templates** digate `manage pdf templates`; **Users** page menampilkan `role_icon` dari kolom `roles.icon`.

## Invarian & Jebakan

- **Single-role efektif**: UI dan controller memakai `roles->first()` dan `syncRoles([...])` — walau Spatie mendukung multi-role, aplikasi ini berasumsi satu role per user.
- **Tidak boleh hapus diri sendiri** — berlaku di destroy tunggal maupun bulk (id sendiri difilter diam-diam).
- **Role `admin` & `staff` terlindungi dari penghapusan; `finance manager` TIDAK** — bisa terhapus, usernya jatuh ke role fallback dengan permission paling sedikit.
- **Setiap mutasi permission wajib reset cache Spatie** — lupa reset menyebabkan perubahan tidak terasa sampai cache kadaluarsa (`php artisan permission:cache-reset` sebagai obat).
- Seeder **menghapus** permission usang cash-flow (`view transactions`, `manage cash-flow`, dll.) — jangan referensikan nama lama itu di kode.
- `UserController::index` **tidak punya authorize() di method** — proteksinya hanya middleware route `can:manage users`; method mutasi punya dobel proteksi.
- `manage users` adalah permission tunggal (tidak ada `view users`) — user tanpa itu tidak bisa melihat daftar user sama sekali.
- Status `inactive` disimpan di `users.status`, tetapi penegakan login untuk user nonaktif bergantung pada logika auth (cek `User::isActive()` sebelum mengandalkannya).
- `email_verified_at` diisi `now()` saat admin membuat user — tidak ada alur verifikasi email untuk user buatan admin.

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (baris 477–519 — blok admin)
- `d:\Laravel\finance-management\app\Http\Controllers\Admin\UserController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Admin\PermissionController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Admin\RoleController.php`
- `d:\Laravel\finance-management\app\Http\Requests\Admin\StoreUserRequest.php`, `UpdateUserRequest.php`, `BulkDestroyUserRequest.php`
- `d:\Laravel\finance-management\database\seeders\MasterPermissionSeeder.php` — sumber kebenaran permission
- `d:\Laravel\finance-management\app\Models\User.php`
- `d:\Laravel\finance-management\app\Http\Middleware\HandleInertiaRequests.php`
- `d:\Laravel\finance-management\resources\js\hooks\use-can.ts`
- `d:\Laravel\finance-management\resources\js\pages\users\index.tsx`, `resources\js\pages\permissions\index.tsx`
- `d:\Laravel\finance-management\tests\Feature\Admin\UserControllerTest.php`

---

<a id="settings"></a>

# Modul: Settings (Profil, Password, Perusahaan, PDF Template Builder)

> Modul pengaturan pribadi (profil & kata sandi), profil perusahaan tunggal (identitas, NPWP/PKP, aset gambar untuk PDF), dan **WYSIWYG PDF Template Builder** beserta pustaka font kustom global. Route prefix `/settings` dengan nama route `settings.*`. Profil/password/company terbuka untuk semua user login; sub-grup `pdf-templates` (termasuk custom fonts) digate permission `manage pdf templates`.

## Tabel Database

| Tabel | Kolom penting | Keterangan |
|-------|---------------|------------|
| `users` | `name`, `email`, `password`, `phone_number`, `locale`, `status` | Data akun yang diedit di profile/password. |
| `company_profiles` | `name`, `abbreviation`, `address`, `email`, `phone`, `logo_path`, `letter_head_path`, `signature_path`, `stamp_path`, `is_pkp` (bool), `npwp`, `ppn_rate` (decimal:2), `bank_accounts` (JSON), `finance_manager_name`, `finance_manager_position` | Singleton — hanya satu baris, diakses via `CompanyProfile::current()`. |
| `pdf_templates` | `name`, `description`, `layout` (JSON), `is_default` (bool) | Layout builder: banded (`{paper, bands:{header, content, footerFlow, footerFixed}}`) atau legacy flat-array. |
| `custom_fonts` | `name` (unique), `filename` | Font .ttf global untuk semua template; file di `storage/app/public/fonts/custom/`. |

## Fitur

### Profil — Edit & Hapus Akun (`GET/PATCH/DELETE /settings/profile`)

**Alur step-by-step (edit):**
1. User membuka Pengaturan → Profil (`GET /settings/profile`, route `settings.profile`).
2. `ProfileController::edit()` merender `settings/profile` dengan data user + flag `must_verify_email`.
3. User mengubah nama/email lalu submit `PATCH /settings/profile`.
4. Validasi inline: `name` required; `email` required, lowercase, unique ignore diri sendiri.
5. Jika email berubah (`$user->isDirty('email')`), `email_verified_at` di-null-kan (harus verifikasi ulang).
6. `$user->save()` → redirect back + flash "Profil berhasil diperbarui."

**Penjelasan kode** (`app/Http/Controllers/Settings/ProfileController.php`):

```php
$user->fill($validated);
if ($user->isDirty('email')) {
    $user->email_verified_at = null;
}
$user->save();
```

Catatan: form update profil di controller saat ini hanya memvalidasi `name` dan `email`. Kolom `phone_number` dan `locale` ada di `$fillable` model `User`, tetapi `phone_number` diedit lewat modul Admin Users, dan `locale` aktif dikelola via session (`POST /language` di `routes/web.php`).

**Alur step-by-step (hapus akun):**
1. User klik "Hapus Akun" → dialog konfirmasi meminta password.
2. `DELETE /settings/profile` memvalidasi `password` dengan rule `current_password`.
3. `Auth::logout()` → `$user->delete()` (hard delete) → session di-invalidate + token regenerate.
4. Redirect ke `/` (halaman publik/login).

### Ganti Kata Sandi (`GET/PUT /settings/password`)

**Alur step-by-step:**
1. `GET /settings/password` merender halaman `settings/password` (tanpa props khusus).
2. Submit `PUT /settings/password` dengan `current_password`, `password`, `password_confirmation`.
3. Validasi: `current_password` rule bawaan Laravel (mencocokkan hash password aktif), `password` mengikuti `PasswordRule::defaults()` + `confirmed`.
4. `Auth::user()->update(['password' => Hash::make(...)])` → flash "Kata sandi berhasil diperbarui."

### Profil Perusahaan (`GET/POST /settings/company`)

**Alur step-by-step:**
1. `GET /settings/company` → `CompanyController::edit()` memuat `CompanyProfile::first()` dan merender `settings/company` dengan seluruh field + URL aset ber-cache-buster (`?v=filemtime`).
2. User mengisi identitas (nama, alamat, email, telepon), status pajak (`is_pkp`, `npwp`, `ppn_rate` 0–100), penanggung jawab keuangan (`finance_manager_name/position`), serta mengunggah aset (logo, letterhead, signature, stamp — masing-masing image max 2 MB).
3. Submit `POST /settings/company` → validasi `UpdateCompanyRequest` (`app/Http/Requests/Settings/UpdateCompanyRequest.php`).
4. `CompanyProfile::firstOrNew()` — baris pertama dipakai atau dibuat baru (menjaga singleton), lalu `fill()` field teks.
5. Untuk tiap file yang diunggah, `replaceFile()` menghapus file lama di disk `public` lalu `storeAs('images', "{nama}-{timestamp}.{ext}")`.
6. `$company->save()` → flash "Profil perusahaan berhasil diperbarui."

**Penjelasan kode** (`app/Http/Controllers/Settings/CompanyController.php`):

```php
private function replaceFile(CompanyProfile $company, string $column, $file, string $baseName): void
{
    if ($company->{$column} && Storage::disk('public')->exists($company->{$column})) {
        Storage::disk('public')->delete($company->{$column});
    }
    $ext = $file->getClientOriginalExtension() ?: 'png';
    $company->{$column} = $file->storeAs('images', "{$baseName}.{$ext}", 'public');
}
```

### Hapus Aset Perusahaan (`DELETE /settings/company/assets/{asset}`)

**Alur step-by-step:**
1. User klik tombol hapus pada preview salah satu aset.
2. Param `{asset}` divalidasi whitelist: `logo`, `letter_head`, `signature`, `stamp` — selain itu 404.
3. File dihapus dari disk `public` (jika ada), kolom `{asset}_path` di-null-kan, save.
4. Flash "File berhasil dihapus."

### Model `CompanyProfile` — Singleton, Base64, Abbreviation

**Penjelasan kode** (`app/Models/CompanyProfile.php`):

- `CompanyProfile::current()` = `static::first()` — pola singleton; seluruh service PDF memanggil ini.
- Accessor `logo_base64`, `signature_base64`, `letter_head_base64`, `stamp_base64` membaca file dari `public_path()` dan mengembalikan `data:image/png;base64,...` — dipakai template Blade PDF agar DomPDF tidak perlu HTTP fetch:

```php
public function getLogoBase64Attribute(): string
{
    if (! $this->logo_path) { return ''; }
    $fullPath = public_path($this->logo_path);
    return file_exists($fullPath)
        ? 'data:image/png;base64,'.base64_encode(file_get_contents($fullPath))
        : '';
}
```

- `computed_abbreviation` untuk nomor dokumen (mis. `001/KSN/I/2026`): pakai kolom `abbreviation` jika terisi, jika tidak auto-generate dari inisial kata bermakna pada nama (skip `PT`, `CV`, `TBK`, dst.):

```php
// "PT. Semesta Pertambangan Indonesia" → "SPI"
$filtered = array_filter($words, fn ($word) => ! in_array(strtoupper($word), $skipWords));
$initials = array_map(fn ($word) => strtoupper(substr($word, 0, 1)), $filtered);
return implode('', $initials) ?: 'CO';
```

### PDF Template Builder — Daftar Template (`GET /settings/pdf-templates`)

Seluruh grup route ini bermiddleware `can:manage pdf templates` (`routes/web.php` baris 539).

**Alur step-by-step:**
1. `PdfTemplateController::index()` memuat semua template diurutkan default dulu, lalu nama.
2. Render `settings/pdf-templates/index` (React) dengan `id`, `name`, `description`, `is_default`, `updated_at`.

### Buat / Update Metadata / Hapus Template

**Alur step-by-step:**
1. **Store** (`POST /settings/pdf-templates`): validasi `name` + `description`; membuat template dengan `layout => []`, `is_default => false`; redirect langsung ke halaman editor (`settings.pdf-templates.edit`).
2. **Update** (`PUT /settings/pdf-templates/{pdfTemplate}`): ganti nama/deskripsi; jika request `is_default=true` → panggil `setAsDefault()`.
3. **Destroy** (`DELETE .../{pdfTemplate}`): hapus baris lalu redirect ke index.

### Duplicate & Set Default

**Alur step-by-step:**
1. **Duplicate** (`POST .../{pdfTemplate}/duplicate`): membuat salinan dengan nama `"{nama} (Salinan)"`, layout di-copy utuh, `is_default => false`, lalu redirect ke editor salinan.
2. **Set default** (`POST .../{pdfTemplate}/set-default`): `PdfTemplate::setAsDefault()` menegakkan keunikan — semua template lain di-set `is_default = false` dulu:

```php
// app/Models/PdfTemplate.php
public function setAsDefault(): void
{
    static::query()->where('id', '!=', $this->id)->update(['is_default' => false]);
    $this->update(['is_default' => true]);
}
```

### Editor WYSIWYG (`GET /settings/pdf-templates/{pdfTemplate}/edit`)

**Alur step-by-step:**
1. `PdfTemplateController::edit()` memilih invoice preview via `resolvePreviewInvoice()` — invoice terbaru di DB, atau sample in-memory (`TemplateTokens::sampleInvoice()`) bila DB kosong.
2. Controller membangun: `tokenCatalog` (daftar token `{{...}}` yang bisa dipakai), `sampleData` (token → nilai resolved), `itemColumnCatalog` + `sampleItems` (untuk elemen tabel), dan `customFonts` (id, name, browser URL untuk `@font-face` di editor).
3. Render halaman React `settings/pdf-templates/edit` — canvas drag-and-drop dengan band header/content/footer.
4. User menyusun elemen (text dengan token, image, grid, table, rect, line) lalu klik Simpan.

### Simpan Layout (`POST /settings/pdf-templates/{pdfTemplate}/save`)

**Alur step-by-step:**
1. Frontend mengirim `{ layout }` — dua bentuk didukung.
2. Jika layout punya key `bands` (model **banded**): validasi ketat `layout.paper.margins.top/right/bottom/left` numeric dan keempat band (`header`, `content`, `footerFlow`, `footerFixed`) wajib array.
3. Jika tidak (layout **legacy** flat-array): cukup `layout` present+array.
4. `$pdfTemplate->update(['layout' => $layout])` → flash "Layout tersimpan."

### Render PDF (`GET /settings/pdf-templates/{pdfTemplate}/pdf[/{invoice}]`)

**Alur step-by-step:**
1. Tanpa param invoice → pakai invoice terbaru / sample; dengan param → invoice tersebut.
2. Custom fonts dimuat sebagai `{name, path}` (path disk untuk DomPDF `@font-face`).
3. Layout banded → `pdfBanded()`: resolve token teks & grid per band via `TemplateTokens::resolveText()`, tabel item via `ItemColumns::resolveItems()` (atau mode TRB row-band bila `rows` array), footerFixed dirender `position:fixed` tiap halaman. Query `?items=N` (1–200) menghasilkan N sample row untuk uji paginasi.
4. Layout legacy → map flat elements (text/table/grid/image) lalu render.
5. Keduanya berakhir `Pdf::loadView('pdf.template-builder', [...])->setPaper('A4', 'portrait')->stream('template.pdf')`.

### Render Invoice Produksi via Builder — `BuilderInvoicePrinter`

Download invoice (`GET /invoice/{invoice}/download?template=builder:{id}`) dan preview di modul Invoice mendeteksi prefix `builder:`:

```php
// routes/web.php
if (str_starts_with((string) $template, 'builder:')) {
    $templateId = (int) substr((string) $template, 8);
    $pdfTemplate = PdfTemplate::findOrFail($templateId);
    $pdf = $printer->render($pdfTemplate, $invoice, $dpAmount, $pelunasanAmount);
}
```

`app/Services/BuilderInvoicePrinter.php::render(PdfTemplate, Invoice, ?int $dpAmount, ?int $pelunasanAmount)` menentukan `paymentContext` mode `full` / `dp` / `pelunasan` (nominal integer rupiah penuh), me-resolve token dengan konteks pembayaran itu, memuat custom fonts, dan mengembalikan instance DomPDF siap stream/download.

### Pustaka Custom Font Global (`/settings/pdf-templates/custom-fonts`)

**Alur step-by-step (upload):**
1. Di editor, user membuka pengelola font → `POST /settings/pdf-templates/custom-fonts` dengan `name` + `file`.
2. Validasi (`CustomFontController::store`): `name` unique di `custom_fonts` max 80; `file` max 5 MB, mimetypes varian TTF/SFNT, plus closure yang menolak ekstensi selain `.ttf`.
3. Filename deterministik `{slug}_{hash8}.ttf` disimpan ke disk public `fonts/custom/`.
4. `CustomFont::create(['name', 'filename'])` → flash sukses. Font muncul di picker editor (browser URL) dan di PDF (disk path — berada dalam chroot DomPDF karena `storage/app/public` di bawah project root).

**Alur step-by-step (list & delete):**
- `GET .../custom-fonts` mengembalikan JSON `{id, name, url}` (fallback; editor utamanya menerima daftar via prop Inertia dari `edit()`).
- `DELETE .../custom-fonts/{customFont}` menghapus file dari disk lalu baris DB.

### Redirect Route Lama (`/template-builder-test`)

`GET /template-builder-test` sekarang **redirect** ke `settings.pdf-templates.index`. `POST /template-builder-test` dan `GET /template-builder-test/pdf` masih menunjuk `TemplateBuilderController` (sandbox lama: satu baris template "Sandbox", token dari konstanta `SAMPLE`, elemen `text|image` saja) — legacy, bukan jalur produksi.

## Keterkaitan Antar Modul

- **Invoice/PDF**: `InvoicePrintService` dan template Blade `resources/views/pdf/*.blade.php` memakai `CompanyProfile::current()` + accessor base64 (logo/letterhead/signature/stamp) dan `ppn_rate`/`is_pkp`/`npwp` untuk perhitungan & tampilan pajak.
- **Fund Request**: nomor dokumen `001/KSN/I/2026` memakai `computed_abbreviation`.
- **Invoice download/preview** menerima `template=builder:{id}` → `BuilderInvoicePrinter` (lihat `routes/web.php` baris 158–196).
- **Permissions**: `manage pdf templates` didefinisikan di `MasterPermissionSeeder` (hanya admin).
- **Header React** (`resources/js/layouts/header.tsx`): switcher bahasa memanggil `POST /language` yang menyimpan `locale` ke session — dibaca `HandleInertiaRequests` sebagai prop `locale`.

## Invarian & Jebakan

- **CompanyProfile adalah singleton** — selalu `current()`/`first()`/`firstOrNew()`; jangan pernah membuat baris kedua.
- **Hanya satu template `is_default`** — selalu ubah lewat `setAsDefault()`, jangan update kolom langsung.
- Accessor base64 membaca dari `public_path($path)` sementara upload disimpan ke disk `public` (`storage/app/public/images/...`) — **symlink `php artisan storage:link` wajib ada**; tanpa itu PDF kehilangan logo/tanda tangan.
- Upload aset **menghapus file lama** — tidak ada versi/riwayat; nama file diberi timestamp agar URL berubah (cache-buster tambahan `?v=filemtime`).
- Layout template punya **dua skema** (banded vs legacy flat-array) — semua kode yang membaca `layout` harus cabang pada keberadaan key `bands`.
- Custom font **global** (dipakai semua template) — menghapus font yang masih direferensikan layout membuat teks jatuh ke font default DomPDF.
- Validasi font double-layer: mimetypes longgar (`application/octet-stream` diterima) namun ekstensi wajib `.ttf` — jangan hapus salah satunya.
- `ppn_rate` disimpan `decimal:2` (persen, 0–100), **bukan** nilai uang — jangan ikut aturan integer rupiah.
- Hapus akun di profil = hard delete user beserta relasi permission via cascade Spatie — tidak ada soft delete.
- Route `custom-fonts` berada **di dalam** prefix `pdf-templates` — URL penuhnya `/settings/pdf-templates/custom-fonts` dan ikut tergate `manage pdf templates`.

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (baris 521–556 — blok settings; 109–111 redirect sandbox; 155–196 download builder)
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\ProfileController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\PasswordController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\CompanyController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\PdfTemplateController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\CustomFontController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\TemplateBuilderController.php` (sandbox legacy)
- `d:\Laravel\finance-management\app\Http\Requests\Settings\UpdateCompanyRequest.php`
- `d:\Laravel\finance-management\app\Models\CompanyProfile.php`, `PdfTemplate.php`, `CustomFont.php`
- `d:\Laravel\finance-management\app\Services\BuilderInvoicePrinter.php`, `TemplateTokens.php`, `ItemColumns.php`
- `d:\Laravel\finance-management\resources\views\pdf\template-builder.blade.php`
- `d:\Laravel\finance-management\resources\js\pages\settings\profile.tsx`, `password.tsx`, `company.tsx`, `pdf-templates\`
- Tests: `d:\Laravel\finance-management\tests\Feature\Settings\ProfileUpdateTest.php`, `PasswordUpdateTest.php`, `tests\Feature\PdfTemplate*Test.php`, `TemplateBuilderControllerTest.php`
