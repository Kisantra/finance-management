# Modul: Loans (Utang Perusahaan)

> **Nama di aplikasi: "Utang"** (menu Utang & Piutang › Utang). Sebelum Nov 2026 bernama "Pinjaman"; yang diganti hanya label tampilan. Route `/loans`, izin `view|create|edit|delete|pay loans`, nomor `LOAN-xxxxx`, dan nama kategori sistem ("Penerimaan Pinjaman", "Pembayaran Pokok Pinjaman", "Beban Bunga Pinjaman") tetap. Field "Pemberi pinjaman" dan "Tujuan pinjaman" juga tetap karena tetap tepat untuk sebuah utang. Jangan mengganti kata "Pinjaman" secara massal: jenis piutang "Pinjaman Karyawan"/"Pinjaman Perusahaan" adalah uang yang DIPINJAMKAN perusahaan (modul Receivables).

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
3. Stats agregat dihitung satu query `selectRaw` (total, total_principal, active_count, active_principal, `next_maturity` = jatuh tempo paling awal di antara pinjaman **aktif**).
4. Satu query tambahan menjumlahkan pembayaran yang **dicakup ke pinjaman aktif** (`LoanPayment::whereHas('loan', status=active)`) → `paid_principal`, `paid_interest`, dan `outstanding_principal = active_principal − paid_principal`.
   **Cakupan ini wajib.** Tanpanya, pembayaran pinjaman yang sudah lunas ikut terjumlah dan "sisa pokok" di layar menyusut oleh utang yang sudah selesai — makin melenceng pada pinjaman yang ditandai lunas manual (pembayarannya tidak genap). Dijaga `LoanControllerTest::test_ringkasan_sisa_pokok_hanya_mencakup_pinjaman_aktif`.
5. Controller juga mengirim `bankAccountOptions` (semua rekening + saldo terformat) dan `nextLoanNumber` hasil `generateLoanNumber()`.
6. Respons `Inertia::render('loans/index', ...)` → halaman React (gaya Obsidian) menampilkan ringkasan 4 angka (sisa pokok, pokok terbayar, bunga dibayar, jatuh tempo terdekat), pil status, dan tabel 6 kolom dengan sisa pokok (`remaining_principal = principal_amount − Σprincipal_paid`) + batang progres.
   Aksi per baris **tidak ada lagi di tabel**; semuanya ada di panel rincian yang terbuka saat baris diklik (`components/loan-drawer.tsx`), berisi jadwal angsuran, Edit, Catat pembayaran, dan Hapus.

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

4. Dalam `DB::transaction`: (a) `Loan::create` dengan status `active`; hanya salah satu field bunga yang diisi sesuai `interest_type`; (b) dibuat **`BankTransaction` credit** sebesar pokok pada rekening terpilih, tanggal = `start_date`, kategori dicari lewat `system_key` `FIN-LOAN-IN`.
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

Pencairan pinjaman dicatat sebagai transaksi **credit** (uang masuk). Lookup kategori memakai null-safe `$category?->id`. Kategori sistem diidentifikasi lewat kolom `system_key` (dulu `code`, sudah di-drop).

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

### Jadwal Angsuran (Schedule)

**Alur step-by-step:**
1. Panel rincian terbuka → React memanggil `GET /c/{company}/loans/{loan}/schedule` lewat `api()` (`resources/js/components/jadwal-angsuran.tsx`). Dihitung **saat panel dibuka**, bukan ikut payload daftar: 15 baris × 2 query agregat untuk data yang belum tentu dilihat.
2. `LoanController::schedule` (`can:view loans`) memanggil `JadwalAngsuranService::untukPinjaman()` dan mengembalikan `{ rows, summary }`.
3. Service menyusun jadwal **rencana** dari pokok, bunga, tenor, dan tanggal mulai, lalu mengalokasikan pembayaran **nyata** secara kumulatif dari termin paling awal → status per termin `lunas` / `sebagian` / `belum`, plus penanda `terlambat`.

**Kenapa rencana-vs-realisasi, bukan "termin ke-3 lunas":** `loan_payments` menyimpan pecahan `principal_paid`/`interest_paid` **tanpa nomor termin**. Pengguna boleh membayar sebagian, menggabungkan dua termin, atau membayar bunga lebih dulu. Mengklaim termin tertentu lunas berarti mengarang keterkaitan yang tidak ada di database — karena itu panelnya memuat satu kalimat yang menyatakan cara alokasinya, dan satu-satunya klaim "termin mana" yang ditampilkan adalah *termin berikutnya yang harus dibayar* (= yang paling awal belum lunas).

**Dua rumus bunga, sengaja tidak disatukan:**

| | Rumus |
|---|---|
| Pinjaman | bunga TAHUNAN diprorata — `principal × rate/100/12 × term_months` |
| Piutang | persentase atas SELURUH pokok — `principal × rate/100` |

Keduanya sudah dipakai controller masing-masing sebelum service ini ada; menyeragamkannya akan mengubah angka pada data yang sudah berjalan.

**Invarian:** jumlah seluruh termin PERSIS sama dengan pokok + bunga — sisa pembagian rupiah ditumpuk ke termin terakhir. Dijaga `JadwalAngsuranServiceTest` dan ditampilkan di baris total tabel supaya bisa dicek mata.

Komponennya dipakai bersama modul Piutang (`/receivables/{id}/schedule` mengembalikan bentuk yang sama persis).

### Panduan & video tutorial (tombol **Tutorial** di header daftar)

1. `<TutorialButton slug="loans" />` di samping **Tambah utang** membuka video per role; halaman `/panduan/loans` memuat panduan teks yang sama. Staff tidak punya `view loans`, jadi hanya ada video **Finance manager** (`LoansFinanceManager`: mencatat pinjaman, membayar angsuran) dan **Admin** (`LoansAdmin`: peran, dampak ke rekening/Arus Kas/Laba Rugi, isi transaksi dana masuk & angsuran, jejak di Rekening Bank & Arus Kas › Pengeluaran, peringatan, hapus pinjaman).
2. Sumber: `video/loans/guide.ts` (teks `/panduan` + adegan), `steps.ts`, `shots.ts`, `tutorial.tsx`, `screens/*.webp`.
3. Ambil ulang screenshot: server QC (`DB_DATABASE=finance_management_qc php artisan serve --port=8016`), jalankan `video/capture/loans.js` (form diisi, **tidak** disimpan) lalu `video/capture/loans-after.js` (hanya membaca) lewat Playwright MCP (`browser_run_code_unsafe`), kemudian `python video/capture/to-webp.py loans` dan salin koordinat ke `shots.ts`. Data contoh: pinjaman "PT Bank Mandiri (Persero) Tbk" (aktif, 2 angsuran), "KSP Mitra Usaha Mandiri" (lunas), dan hasil simpan "PT BPR Dana Makmur" + angsuran ke-3 Mandiri (ref `KMK-261012`).
4. Karena bug lookup kategori `code` (lihat Invarian), simpan pinjaman & bayar angsuran gagal 500 di MySQL; data hasil simpan untuk screenshot dibuat langsung di DB QC dengan isi yang sama persis dengan yang ditulis controller (kategori memakai label seeder: Penerimaan Pinjaman, Pembayaran Pokok Pinjaman, Beban Bunga Pinjaman). Setelah bug diperbaiki, langkah simpan bisa dijalankan lewat UI.
5. **Perubahan UI/alur modul ini harus diikuti ambil ulang screenshot + perbarui `guide.ts`/`steps.ts`.**

## Keterkaitan Antar Modul

- **Bank Accounts / Cash Flow** — setiap create loan (credit) dan pay loan (debit) menulis ke `bank_transactions`, sehingga saldo rekening (computed: `initial_balance + payments(credit) + tx(credit) − tx(debit)`) dan halaman Cash Flow otomatis mencerminkan pinjaman.
- **Transaction Categories** — transaksi diberi kategori sistem via `findSystem()` — kolom `system_key` (`FIN-LOAN-IN`, `FIN-LOAN-OUT`, `EXP-INTEREST`). Kategori bertipe `financing` dikecualikan dari Laporan Laba Rugi; `EXP-INTEREST` (expense, `pl_group=other_expense`) masuk baris Beban Lain.

- **Transaction Categories** — transaksi diberi kategori sistem via `system_key` (`FIN-LOAN-IN`, `FIN-LOAN-OUT`, `EXP-INTEREST`). Kategori bertipe `financing` dikecualikan dari Laporan Laba Rugi; `EXP-INTEREST` (expense, `pl_group=other_expense`) masuk baris Beban Lain.
- **Profit & Loss** — pokok pinjaman (masuk/keluar) tidak boleh memengaruhi laba; hanya bunga (`EXP-INTEREST`) yang masuk P&L. Pemisahan ini bergantung sepenuhnya pada kategori transaksi.
- **Permission System** — 5 permission (`view/create/edit/delete/pay loans`) di `database/seeders/MasterPermissionSeeder.php:156-160`; role `admin` dan `finance manager` mendapatkannya.

## Invarian & Jebakan

- **[DIPERBAIKI 2026-08-11] Bug lookup kolom `code`.** Lookup kategori sistem kini memakai `TransactionCategory::findSystem()` (kolom `system_key`); test suite juga sudah berjalan di MySQL (bukan SQLite) dan `LoanControllerTest` meng-assert `category_id` terisi, sehingga regresi serupa akan tertangkap. Jangan menulis lookup kategori sistem dengan cara lain.

- **[DIPERBAIKI 2026-09-17] Lookup kategori sistem pindah dari `code` ke `system_key`.** Migration `2026_02_05_041553_refactor_transaction_categories_remove_code_add_parent_id.php` men-drop kolom `code`, sehingga `TransactionCategory::where('code', 'FIN-LOAN-IN')` melempar `SQLSTATE[42S22] Unknown column 'code'` di MySQL → `DB::transaction` rollback → **create loan & pay loan gagal 500** (dilaporkan dari produksi, ERR-YWPSETE9FI). Sekarang dipakai `TransactionCategory::findSystem('FIN-LOAN-IN')` di atas kolom `system_key` (migration `2026_09_17_000000`, mengisi kategori lama berdasarkan type+label). **Jebakan yang tersisa:** suite memakai SQLite in-memory (`phpunit.xml`), yang mem-fallback identifier tak dikenal menjadi string literal — query salah kolom mengembalikan `null` diam-diam, bukan error. Karena itu tes wajib memeriksa `category_id` transaksi yang terbentuk, bukan sekadar status 302; lihat `tests/Feature/SystemTransactionCategoryTest.php`.
- Status hanya dua nilai: `active → paid_off`; transisi satu arah dan otomatis (tidak ada tombol "tandai lunas" manual, tidak ada jalan kembali ke `active`).
- Edit/hapus loan **tidak mengoreksi** `BankTransaction` yang sudah dibuat — mengubah `principal_amount` atau menghapus loan meninggalkan mutasi bank lama apa adanya. Koreksi harus manual lewat modul Bank Transactions.
- Tidak ada cap pembayaran: `principal_paid` boleh melebihi sisa pokok (langsung `paid_off`), `interest_paid` boleh melebihi sisa bunga. Sisa bunga hanya informasi tampilan.
- `interest_amount` vs `interest_rate` saling eksklusif — controller menulis `null` ke field yang tidak sesuai `interest_type` baik saat store maupun update.
- Semua nilai uang integer rupiah penuh (tanpa desimal); di frontend wajib `CurrencyInput`.
- `loan_number` unik; prefill `LOAN-{id+1}` bisa bentrok jika ada record dihapus lalu nomor dipakai manual — validasi unique yang jadi penjaga terakhir.

## File Kunci

| File | Peran |
|------|------|
| `app/Http/Controllers/LoanController.php` | Seluruh logic index/store/update/destroy/pay + generate nomor |
| `app/Http/Requests/StoreLoanRequest.php` / `UpdateLoanRequest.php` / `PayLoanRequest.php` | Validasi |
| `app/Models/Loan.php`, `app/Models/LoanPayment.php` | Model + casts + relasi |
| `routes/web.php` (baris 458-464) | Route + permission middleware |
| `app/Services/JadwalAngsuranService.php` | Penyusun jadwal angsuran (dipakai Pinjaman & Piutang) + sumber tunggal rumus bunga |
| `resources/js/pages/loans/index.tsx` (+ `types.ts`) | Halaman Inertia: ringkasan, pil status, tabel 6 kolom |
| `resources/js/pages/loans/components/` | `loan-drawer.tsx` (rincian + jadwal), `loan-form-sheet.tsx`, `loan-pay-sheet.tsx`, `pjm.tsx` (status/bunga bersama) |
| `resources/js/components/jadwal-angsuran.tsx` | Tabel jadwal angsuran, dipakai bersama modul Piutang |
| `database/migrations/2026_02_05_041553_refactor_transaction_categories_remove_code_add_parent_id.php` | Migration yang menghapus kolom `code` (sumber bug lookup kategori) |
| `tests/Feature/LoanControllerTest.php` | Tes feature, termasuk cakupan ringkasan ke pinjaman aktif |
| `tests/Feature/JadwalAngsuranServiceTest.php` | Invarian jadwal: total termin = pokok + bunga, alokasi kumulatif, jatuh tempo akhir bulan |
