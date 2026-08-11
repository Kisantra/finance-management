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
