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
