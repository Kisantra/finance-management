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
$category = TransactionCategory::where('code', 'FIN-LOAN-IN')->first();
BankTransaction::create([..., 'category_id' => $category?->id]);
```

**PERHATIAN (lihat Jebakan):** lookup ini masih memakai kolom `code`, padahal kolom tersebut sudah di-drop oleh migration 2026-02-05.

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
- **JEBAKAN AKTIF — kolom `code` sudah tidak ada.** Skema saat ini (pasca migration `2026_02_05_..._remove_code_add_parent_id`) tidak lagi punya kolom `code`, tetapi `LoanController` dan `ReceivableController` masih menjalankan `TransactionCategory::where('code', 'FIN-LOAN-IN')` dll. Query ke kolom yang tidak ada akan melempar `QueryException` saat fitur loan/receivable membuat transaksi otomatis. Perbaikan yang konsisten: identifikasi kategori sistem dengan mekanisme lain (mis. label/seeder id) atau kembalikan kolom `code` — jangan menulis kode baru yang bergantung pada `code`.
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
