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
