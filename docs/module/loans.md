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
4. Dalam `DB::transaction`: (a) `Loan::create` dengan status `active`; hanya salah satu field bunga yang diisi sesuai `interest_type`; (b) dibuat **`BankTransaction` credit** sebesar pokok pada rekening terpilih, tanggal = `start_date`, kategori dicari by code sistem `FIN-LOAN-IN`.
5. Respons `back()->with('success')` → toast + tabel ter-refresh; saldo rekening naik otomatis (saldo bank = computed, bukan stored).

**Penjelasan kode:**
```php
// app/Http/Controllers/LoanController.php:133-143
$category = TransactionCategory::where('code', 'FIN-LOAN-IN')->first();

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
Pencairan pinjaman dicatat sebagai transaksi **credit** (uang masuk). Lookup kategori memakai null-safe `$category?->id`. **PERHATIAN: kolom `code` sudah tidak ada di tabel `transaction_categories`** — lihat bagian Invarian & Jebakan.

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
   - Jika `principal_paid > 0` → `BankTransaction` **debit** kategori code `FIN-LOAN-OUT` (pembayaran pokok).
   - Jika `interest_paid > 0` → `BankTransaction` **debit** kategori code `EXP-INTEREST` (beban bunga — inilah yang seharusnya mengalir ke baris "Beban Lain" di Laporan Laba Rugi).
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
- **Transaction Categories** — transaksi diberi kategori sistem via lookup `code` (`FIN-LOAN-IN`, `FIN-LOAN-OUT`, `EXP-INTEREST`). Kategori bertipe `financing` dikecualikan dari Laporan Laba Rugi; `EXP-INTEREST` (expense, `pl_group=other_expense`) masuk baris Beban Lain.
- **Profit & Loss** — pokok pinjaman (masuk/keluar) tidak boleh memengaruhi laba; hanya bunga (`EXP-INTEREST`) yang masuk P&L. Pemisahan ini bergantung sepenuhnya pada kategori transaksi.
- **Permission System** — 5 permission (`view/create/edit/delete/pay loans`) di `database/seeders/MasterPermissionSeeder.php:156-160`; role `admin` dan `finance manager` mendapatkannya.

## Invarian & Jebakan

- **[BUG AKTIF] Lookup kategori `where('code', ...)` menunjuk kolom yang sudah dihapus.** Migration `database/migrations/2026_02_05_041553_refactor_transaction_categories_remove_code_add_parent_id.php` men-drop kolom `code` dan `parent_code` dari `transaction_categories` (diverifikasi juga di skema MySQL live — kolom `code` tidak ada). Akibatnya di **produksi (MySQL)** `TransactionCategory::where('code', 'FIN-LOAN-IN')->first()` melempar `SQLSTATE[42S22] Unknown column 'code'` → `DB::transaction` rollback → **create loan dan pay loan gagal 500**. Tes feature (`tests/Feature/LoanControllerTest.php`) tetap hijau karena suite memakai SQLite in-memory (`phpunit.xml:26-27`) dan SQLite mem-fallback identifier ber-kutip-ganda yang tak dikenal menjadi string literal, sehingga query diam-diam mengembalikan `null` dan `$category?->id` menjadi `null`. Perbaikan yang benar: ganti mekanisme lookup (mis. by `label`/kolom penanda sistem baru) — jangan andalkan `code`.
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
