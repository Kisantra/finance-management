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
