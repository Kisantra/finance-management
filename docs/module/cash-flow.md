# Modul: Cash Flow (Arus Kas)

> Modul monitoring dan pencatatan arus kas dalam dua menu: **Pemasukan & Pengeluaran** — satu halaman bertab **Semua** (`/cash-flow/all`, pemasukan + pengeluaran) | **Pemasukan** (`/cash-flow/income`) | **Pengeluaran** (`/cash-flow/expenses`) — dan **Transfer & Penyesuaian** (`/cash-flow/transfers`, pindah dana antar rekening). Route prefix `/cash-flow` untuk halaman, sedangkan mutasi memakai endpoint bersama `/bank-transactions/*`. Permission granular per fitur: `view|create|edit|delete income`, `view|create|edit|delete expense`, `view|create|edit|delete transfer` — tab **Semua** butuh `view income` **dan** `view expense`; otorisasi mutasi dilakukan di FormRequest/Gate (bukan middleware route), sehingga endpoint bersama bisa dipakai user cash-flow yang tidak punya akses `bank-accounts`. Ketiga tab punya kolom & filter **Diinput oleh** (`created_by`). Export PDF digate `can:view bank-accounts`; ekspor Excel tab Semua mengikuti izin tab Semua.

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
| `reference_number` | string, nullable | Prefix `TRF` menandai leg transfer. **Label untuk dibaca manusia saja** — bukan penanda pasangan |
| `transfer_group_id` | char(26) nullable, index | ULID yang dibagi kedua kaki satu transfer. **Ini penanda pasangan yang sesungguhnya** |
| `attachment_path` / `attachment_name` | string, nullable | Bukti transaksi di disk `public` |
| `created_by` / `updated_by` | bigint nullable (created_by ber-index), **tanpa FK** | Id pengguna di database PUSAT yang mencatat / terakhir mengubah (trait `MencatatPengguna`). Kosong untuk data sebelum Nov 2026 dan untuk proses tanpa login. `updated_by` kosong = belum pernah diubah |

### `payments` (read-only di modul ini)

`invoice_id`, `bank_account_id`, `amount`, `payment_date`, `payment_method`, `reference_number`, `attachment_path/name`, `created_by`/`updated_by` (sama dengan `bank_transactions`) — sumber kedua halaman Income; dibuat oleh modul Invoices.

## Fitur

### Redirect Index — `GET /cash-flow`

**Alur step-by-step:**

1. User membuka `/cash-flow` (menu sidebar **Pemasukan & Pengeluaran**).
2. Closure route (`routes/web.php`) mengecek permission user secara berurutan: `view income` **dan** `view expense` → redirect ke `cash-flow.all` (tab Semua); kalau tidak, `view income` → `cash-flow.income`; kalau tidak, `view expense` → `cash-flow.expenses`; kalau tidak, `view transfer` → `cash-flow.transfers`.
3. Tanpa satu pun permission tersebut → `abort(403)`.

```php
Route::get('/', function () {
    $user = request()->user();
    if ($user?->can('view income') && $user->can('view expense')) return redirect()->route('cash-flow.all');
    if ($user?->can('view income')) return redirect()->route('cash-flow.income');
    if ($user?->can('view expense')) return redirect()->route('cash-flow.expenses');
    if ($user?->can('view transfer')) return redirect()->route('cash-flow.transfers');
    abort(403);
})->name('index');
```

Diverifikasi `tests/Feature/CashFlowPermissionTest.php::test_cash_flow_index_redirects_to_first_allowed_tab` dan `tests/Feature/ArusKasSemuaTest.php::test_tab_semua_butuh_izin_pemasukan_dan_pengeluaran`.

### Navigasi: menu, tab, breadcrumb

1. Grup sidebar **Arus Kas** (`resources/js/layouts/sidebar.tsx`) berisi dua item: **Pemasukan & Pengeluaran** (`href: '/cash-flow'`, `permission: ['view income', 'view expense']` — array berarti cukup salah satu; aktif untuk prefix `/cash-flow/all`, `/cash-flow/income`, `/cash-flow/expenses`) dan **Transfer & Penyesuaian** (tidak berubah). `NavItem.permission` dan `matchPrefix` menerima `string | string[]`.
2. Klik menu → `GET /cash-flow` → redirect ke tab pertama yang diizinkan (di atas).
3. Ketiga tab memakai judul halaman yang sama, "Pemasukan & Pengeluaran", dan tab bar `CashFlowTabs` (`resources/js/pages/cash-flow/components/cash-flow-tabs.tsx`, komponen katalog `Tabs`). Tab disaring `useCan` dengan aturan yang sama dengan middleware route: **Semua** = `view income` && `view expense`, **Pemasukan** = `view income`, **Pengeluaran** = `view expense`. Ganti tab = `router.get()` ke URL tab itu tanpa membawa filter (filter tiap tab berbeda).
4. Breadcrumb header (`resources/js/layouts/header.tsx`): `/cash-flow/all` → Arus Kas › Pemasukan & Pengeluaran; `/cash-flow/income` dan `/cash-flow/expenses` → Arus Kas › Pemasukan & Pengeluaran (tautan ke `/cash-flow`) › Pemasukan / Pengeluaran.

### Tab Semua — `GET /cash-flow/all` (`can:view income` + `can:view expense`)

Pemasukan dan pengeluaran dalam satu daftar. Definisi tiap sisi **sama persis** dengan tab Pemasukan dan Pengeluaran — `UNION ALL` tiga sumber:

- pembayaran invoice (`payments`) → `direction = 'in'`;
- `bank_transactions` `credit` yang kategorinya bertipe `income` → `direction = 'in'`;
- `bank_transactions` `debit` yang kategorinya bertipe `expense` → `direction = 'out'`.

Transfer (kategori `transfer`) dan pokok utang/piutang (kategori `financing`) **tidak** termasuk; bunga (`EXP-INTEREST` / `REV-INTEREST`, bertipe `expense` / `income`) termasuk. Tidak ada saldo berjalan.

**Alur step-by-step:**

1. Filter dari query string (`filterSemua()`): `date_from` + `date_to` (berlaku bila keduanya ada), `bank_accounts` (CSV id), `categories` (CSV id), `input_by` (id pengguna pusat), `search` (nomor invoice, nama klien, referensi, nama bank, deskripsi), `sort` (`date` | `amount`), `direction`, `per_page` (dibatasi 1–100), `page`.
2. `kasGabungan()` membangun tiga subquery dengan kolom seragam (`uid`, `id`, `source_type`, `direction`, `date`, `amount`, `reference_number`, lampiran, `invoice_number`, `client_name`, `bank_name`, `category_id`/`category_label`, `description`, `created_by`) lalu menggabungkannya dengan `unionAll` di dalam `fromSub(..., 'combined')`. Filter **kategori** mengecualikan sisi pembayaran (pembayaran tidak berkategori), sama dengan tab Pemasukan.
3. Ringkasan dalam satu query: `SUM(CASE WHEN direction = 'in' ...)`, `SUM(CASE WHEN direction = 'out' ...)`, `COUNT(*)` → `stats {total_in, total_out, net, total_count}`.
4. Baris: `orderBy(sort, direction)` + `orderBy('uid')` sebagai pemecah seri, `offset/limit`; `barisKas()` memetakan baris dan mengisi `input_by` (nama pencatat, satu query `whereIn` ke pusat per halaman).
5. Respons Inertia `cash-flow/all`: `rows`, `pagination`, `stats`, `filters`, `incomeCategoryOptions` + `expenseCategoryOptions`, `bankAccountOptions`, `inputByOptions`, `accounts`. Opsi kategori sengaja **terpisah per jenis**: filter memakai gabungannya, sedangkan dialog ubah hanya menawarkan kategori sejenis transaksinya — validasi update cuma `exists`, dan kategori pengeluaran di transaksi masuk membuatnya hilang dari tab Pemasukan maupun Pengeluaran.
6. UI (`resources/js/pages/cash-flow/all.tsx`): 3 `StatsCard` (**Total Masuk**, **Total Keluar**, **Selisih** bertanda), filter (**Rentang Tanggal**, **Rekening**, **Kategori**, **Diinput oleh**, **Cari** ber-debounce 350 ms), tabel (Tanggal, Jenis Masuk/Keluar, Keterangan — pembayaran: klien + nomor invoice + bank, transaksi: deskripsi + bank —, Kategori, Diinput oleh, Jumlah `+` hijau / `−` `ob-neg`), `Pagination`. Klik baris membuka `TransactionDetailDialog` dengan jenis `payment` / `income` / `expense` sesuai sumber & arah (pemetaan sama dengan tab Pemasukan/Pengeluaran). Tombol **Input Pemasukan** / **Input Pengeluaran** (izin `create income` / `create expense`, dan ada rekening) membuka `TransactionFormDialog`. **Tidak ada hapus massal** di tab ini — hapus lewat tab Pemasukan/Pengeluaran.

```php
$sumber = array_filter([
    $f['categories'] ? null : $pembayaran,       // filter kategori → tanpa pembayaran invoice
    $transaksi('credit', 'income', 'in'),
    $transaksi('debit', 'expense', 'out'),
]);
foreach (array_values($sumber) as $i => $q) {
    $bagian = DB::query()->fromSub($q, "s{$i}");
    $gabungan = $gabungan ? $gabungan->unionAll($bagian) : $bagian;
}
return DB::query()->fromSub($gabungan, 'combined');
```

Diverifikasi `tests/Feature/ArusKasSemuaTest.php` (gabungan tanpa transfer & pendanaan, urutan, ringkasan, filter, izin).

### Ekspor Excel tab Semua — `GET /cash-flow/all/export/excel` (`can:view income` + `can:view expense`)

1. Tombol **Export Excel** membuka `/cash-flow/all/export/excel?{filter aktif}` (`date_from`, `date_to`, `bank_accounts`, `categories`, `input_by`, `search`) di tab baru lewat `companyUrl()`.
2. `exportAll()` memakai `filterSemua()` + `kasGabungan()` yang sama dengan halaman, **tanpa paginasi**, urut tanggal naik (lalu `uid`).
3. `App\Exports\ArusKasExport` (`FromArray`): kolom Tanggal (`d/m/Y`), Jenis (Masuk/Keluar), Sumber (Pembayaran invoice / Transaksi langsung), Rekening, Keterangan, Kategori, Diinput oleh (`Tidak tercatat` bila kosong), Masuk (Rp), Keluar (Rp), No. Referensi; kolom nominal berformat `#,##0`. Tanpa saldo berjalan.
4. Nama file `arus-kas_{date_from}_{date_to}.xlsx`, atau `arus-kas_semua-waktu.xlsx` tanpa rentang tanggal.

### Kolom & filter "Diinput oleh" (tab Semua, Pemasukan, Pengeluaran)

1. Sumber: `created_by` di `payments` / `bank_transactions` — id pengguna PUSAT tanpa FK, diisi trait `MencatatPengguna` sejak Nov 2026.
2. Filter `?input_by={id}` (`pencatatDipilih()`) diterapkan di setiap sisi query (`payments.created_by` / `bank_transactions.created_by`).
3. Nama dicari `namaPengguna()`: `User::whereIn('id', ...)` di database pusat untuk id di halaman itu saja — **jangan** join/`whereHas` tabel `users` dari query bisnis (database perusahaan). `created_by` kosong → UI menampilkan **Tidak tercatat** (redup); id yang tidak ditemukan di pusat → **Pengguna dihapus**.
4. Pilihan filter `inputByOptions` (`pilihanPencatat()`): pengguna yang pernah mencatat transaksi bank **atau** pembayaran di perusahaan ini (distinct `created_by` kedua tabel), urut nama.
5. Kolom tampil mulai `lg` di tab Semua dan mulai `xl` di tab Pemasukan/Pengeluaran (kolomnya lebih banyak); di layar kecil tabel memprioritaskan keterangan & nominal.

### Halaman Income — `GET /cash-flow/income` (`can:view income`)

Income adalah **UNION dua sumber**: pembayaran invoice (`payments`) + transaksi bank `credit` yang kategorinya bertipe `income`.

**Alur step-by-step:**

1. User membuka halaman / mengubah filter (`date_from`, `date_to`, `clients` (CSV id), `categories` (CSV id), `input_by` (id pencatat), `search`, `sort`, `direction`, `per_page`, `page`).
2. `CashFlowController::income()` membangun dua subquery:
   - **Payment side**: join `payments → invoices → clients → bank_accounts`, kolom diseragamkan (`uid = 'payment-{id}'`, `source_type='payment'`, `category_* = NULL`).
   - **Transaction side**: join `bank_transactions → bank_accounts → transaction_categories` dengan `transaction_type='credit'` **dan** `transaction_categories.type='income'` (`uid = 'transaction-{id}'`).
3. Kedua subquery digabung `unionAll` dalam `DB::query()->fromSub(...)`. Kekhususan filter: memilih filter **client** mengecualikan sisi transaksi (client hanya ada di payments); memilih filter **kategori** mengecualikan sisi payments.
4. `sum('amount')` dan `count()` dihitung dari union untuk `stats`; baris diambil manual dengan `offset/limit` (paginasi manual `paginationMeta()`).
5. Respons `Inertia::render('cash-flow/income', ...)` dengan `rows` (termasuk `input_by` = nama pencatat atau `null`), `pagination`, `stats {total_amount, total_count}`, `filters`, `clientOptions`, `categoryOptions` (dari `TransactionCategory::selectOptions('income')`), `inputByOptions`, `accounts` (untuk dialog create).
6. UI (`resources/js/pages/cash-flow/income.tsx`): tab bar, 3 `StatsCard`, filter (termasuk **Diinput oleh**), tabel dengan checkbox bulk dan kolom **Diinput oleh**, tombol Export PDF, dialog create income (via `bank-transactions.store`), detail dialog dengan preview attachment.

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

1. Filter: `date_from/date_to`, `categories`, `bank_accounts`, `input_by`, `search`, sort/paginasi.
2. Query tunggal: `bank_transactions` join `bank_accounts` + `transaction_categories`, dengan `transaction_type='debit'` **dan** `transaction_categories.type='expense'`. (Leg debit transfer tidak muncul karena kategorinya bertipe `transfer`.)
3. `stats` = sum + count dari query terklon sebelum select/limit.
4. Respons Inertia `cash-flow/expenses` + `categoryOptions('expense')`, `bankAccountOptions`, `inputByOptions`, `accounts`; tiap baris membawa `input_by`.
5. UI menampilkan tab bar, 3 `StatsCard`, tabel dengan kolom **Diinput oleh**, filter Combobox kategori/rekening/**Diinput oleh**, dialog create expense, bulk delete, Export PDF (menyertakan `bank_accounts` terpilih).

### Halaman Transfers — `GET /cash-flow/transfers` (`can:view transfer`)

Satu transfer = **dua baris** `bank_transactions` (debit di rekening asal, credit di rekening tujuan) yang berbagi **`transfer_group_id`** (ULID). Halaman menampilkan pasangan tersebut sebagai satu baris.

> **Invarian:** pasangan kaki transfer ditentukan `transfer_group_id`, **tidak pernah** `reference_number`.
> Sebelum 2026-11-02 pasangan dibentuk konvensi string `'TRF'.time()` yang beresolusi **detik**: dua
> transfer di detik yang sama berbagi `reference_number`, sehingga menghapus salah satunya ikut
> menghapus kedua kaki transfer yang lain dan menggeser saldo tanpa jejak. `reference_number` kini
> berformat `TRF{Ymd}-{6 karakter terakhir ULID}` dan hanya dipakai sebagai label.
> Baris warisan yang `transfer_group_id`-nya masih null tetap dipasangkan lewat `reference_number`
> sebagai cadangan — dan untuk baris itu ambiguitasnya masih ada. Migrasi
> `2026_11_02_143410` memberi ULID hanya pada kelompok yang terurai **bersih** (tepat satu debit +
> satu kredit); kelompok ambigu sengaja dibiarkan null dan dicatat ke log untuk ditinjau manual.

**Alur step-by-step:**

1. Filter: `date_from/date_to`, `bank_accounts`, `search`, paginasi.
2. Query dasar mengambil **sisi credit** saja: `transaction_type='credit'`, kategori bertipe `transfer`, `reference_number` not null.
3. Setelah paginasi, seluruh `reference_number` di halaman itu dicari pasangan **debit**-nya dalam satu query, di-key by reference. (Tampilan daftar masih memakai reference; yang pindah ke `transfer_group_id` adalah jalur **ubah dan hapus**, tempat salah-pasangan merusak data.)
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
3. `BankTransactionController::update()` mendeteksi leg transfer lewat helper `kakiTransfer()` (`transfer_group_id` bila ada, cadangan `reference_number` berprefix `TRF` untuk baris warisan):
   - **Bukan transfer**: amount, category, reference, dan attachment (ganti/hapus, file lama dihapus dari disk) ikut diupdate.
   - **Transfer**: hanya `transaction_date` + `description` yang diubah, lalu **disinkronkan ke pasangan** (leg dengan tipe berlawanan dalam `transfer_group_id` yang sama) — nominal transfer tidak boleh diubah lewat edit.
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

1. Tab Pemasukan/Pengeluaran mengirim `POST /cash-flow/bulk-delete` payload `{uids: ['payment-3', 'transaction-9', ...]}`. (Tab Semua sengaja tanpa hapus massal.)
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
3. Disimpan ke disk `public` (`transaction-attachments/` untuk income/expense, `bank-transactions/` untuk transfer). **Multi-tenancy:** root disk `public` ada di `storage/tenant{slug}/app/public`, dan `Storage::url()` menghasilkan `/c/{company}/storage/{path}` — dilayani `TenantStorageController` di dalam grup auth + cek keanggotaan, **bukan** symlink `public/storage`. Symlink lama tidak bisa melayani berkas tenant (dulu menyebabkan semua lampiran 403).
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

### Panduan & video tutorial (tombol **Tutorial** di header tab Semua / Pemasukan / Pengeluaran dan Transfer)

1. `<TutorialButton slug="cash-flow" />` di keempat halaman membuka dialog video per role: **Finance manager** (`CashFlowFinanceManager`: input pemasukan, pengeluaran, transfer, koreksi) dan **Admin** (`CashFlowAdmin`: peran, dampak ke saldo & Laba Rugi, isi dua transaksi transfer, jejak di Rekening Bank & Laba Rugi, peringatan, hapus massal). Staff tidak punya izin modul ini sehingga tidak ada video Staff.
2. Teks panduan (halaman `/panduan` dan adegan video) bersumber dari `video/cash-flow/guide.ts`; langkah walkthrough di `video/cash-flow/steps.ts`, koordinat di `video/cash-flow/shots.ts`, komposisi di `video/cash-flow/tutorial.tsx`, screenshot di `video/cash-flow/screens/`.
3. Ambil ulang screenshot: jalankan server QC (`DB_DATABASE=finance_management_qc php artisan serve --port=8014`), jalankan `video/capture/cash-flow.js` lewat Playwright MCP (`browser_run_code_unsafe`), lalu `python video/capture/to-webp.py cash-flow` dan salin koordinat hasilnya ke `shots.ts`. Skrip menambah 1 pemasukan, 1 pengeluaran, 1 transfer di DB QC dan butuh sub-kategori transfer (kategori transfer tanpa sub-kategori tidak bisa dipilih di form). Jalankan sebelum `video/capture/profit-loss.js`.
4. **Perubahan UI/alur modul ini harus diikuti ambil ulang screenshot + perbarui `guide.ts`/`steps.ts`.**

## Keterkaitan Antar Modul

- **Bank Accounts** — setiap mutasi di sini langsung menggeser saldo dinamis rekening; endpoint mutasi juga dipakai tab transaksi halaman bank-accounts.
- **Invoices/Payments** — sisi payment pada halaman Income bersumber dari pembayaran invoice; menghapusnya lewat bulk delete cash-flow benar-benar menghapus record pembayaran (status invoice dihitung ulang oleh modul Invoices).
- **Transaction Categories** — tipe kategori (`income`/`expense`/`transfer`) menentukan halaman mana yang menampilkan transaksi; opsi picker dari `TransactionCategory::selectOptions()` dan `GET /api/transaction-categories?type=credit|debit`.
- **Loans & Receivables** — membuat `BankTransaction` otomatis (kategori sistem). Pokoknya (kategori `financing`) tidak tampil di tab Semua/Pemasukan/Pengeluaran; bunganya (`EXP-INTEREST` / `REV-INTEREST`, bertipe `expense` / `income`) tampil.
- **Permissions (Spatie)** — 12 permission granular (`view|create|edit|delete` × `income|expense|transfer`), diseed `database/seeders/MasterPermissionSeeder.php`.

## Invarian & Jebakan

- **Tab Semua = gabungan persis sisi Pemasukan + sisi Pengeluaran.** Mengubah definisi salah satu sisi (sumber, tipe transaksi, tipe kategori) wajib diterapkan di `income()`/`expenses()` **dan** `kasGabungan()` sekaligus. Transfer dan pokok utang/piutang tetap di luar.
- **Izin tab Semua hidup di tiga tempat**: middleware route (`can:view income` + `can:view expense`, termasuk ekspor Excel), redirect `GET /cash-flow`, dan `CashFlowTabs`. Ubah ketiganya bersamaan.
- **Nama pencatat dicari di database pusat** (`User::whereIn`), tidak pernah join/`whereHas` tabel `users` dari query bisnis — tabel itu tidak ada di database perusahaan.
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
| `app/Http/Controllers/CashFlowController.php` | Tab Semua (`all`, UNION 3 sumber) + ekspor Excel (`exportAll`), halaman income (UNION), expenses, transfers, bulk delete uid, helper "Diinput oleh" (`namaPengguna`, `pilihanPencatat`) |
| `app/Exports/ArusKasExport.php` | Lembar Excel tab Semua (Masuk/Keluar terpisah, tanpa saldo berjalan) |
| `app/Http/Controllers/BankTransactionController.php` | store/update/destroy/bulkDestroy/transfer + endpoint tab JSON |
| `app/Http/Requests/StoreBankTransactionRequest.php` | Otorisasi `create income`/`create expense` berdasar `transaction_type` |
| `app/Http/Requests/UpdateBankTransactionRequest.php` | Otorisasi `abilityFor('edit')` per fitur |
| `app/Http/Requests/BulkDestroyBankTransactionRequest.php` | Otorisasi delete per fitur untuk seluruh seleksi |
| `app/Http/Requests/TransferBankTransactionRequest.php` | Otorisasi `create transfer` + validasi rekening berbeda |
| `app/Models/BankTransaction.php` | `permissionFeature()`, `abilityFor()`, `featureForType()`, hook hapus attachment |
| `app/Http/Controllers/CashFlowExportController.php` | Normalisasi filter export (alias tanggal, `bank_accounts` CSV), nama file |
| `app/Services/CashFlowExportService.php` | Data laporan, saldo awal/akhir, mode SEMUA WAKTU, limit 1G/300s |
| `resources/views/pdf/cash-flow-report.blade.php` | Template PDF, tabel di-chunk 250 baris |
| `resources/js/pages/cash-flow/` | `all.tsx` (tab Semua), `income.tsx`, `expenses.tsx`, `transfers.tsx` + `components/` (`cash-flow-tabs.tsx` tab bar, `table-parts.tsx` bahan tabel bersama + sel "Diinput oleh", stats transfer, detail dialog) |
| `resources/js/layouts/sidebar.tsx`, `resources/js/layouts/header.tsx` | Menu Arus Kas (izin & prefix berbentuk array) dan breadcrumb tab |
| `resources/js/components/shared/file-upload.tsx` | Upload + paste clipboard bukti transaksi |
| `routes/web.php` | Redirect index per permission (Semua bila boleh keduanya), route `cash-flow.all` + `cash-flow.all.export`, route `bank-transactions.*` tanpa middleware can |
| `tests/Feature/CashFlowPermissionTest.php`, `BankTransactionControllerTest.php`, `CashFlowExportControllerTest.php`, `ArusKasSemuaTest.php` | Test perilaku permission, CRUD, export PDF, tab Semua + ekspor Excel + "Diinput oleh" |
