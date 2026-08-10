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
