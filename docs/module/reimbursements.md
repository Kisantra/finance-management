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
2. Controller cek `can('approve reimbursements')` dan `can('pay reimbursements')`. Tab `all` (pengajuan semua pengguna) hanya untuk pemegang salah satu izin itu (`canSeeAll`); pengguna lain **selalu** `my` (dibatasi `user_id` sendiri) walau mengirim `?tab=all` lewat URL (QA 8 Okt 2026, BUG-06).
3. Filter: `search` (`whereAny(['title','description','category_input'])`), `status`, `category` (nilai `category_input`), `date_from`+`date_to` (rentang `expense_date`), `per_page`, `page`.
4. Query `Reimbursement::with(['user','reviewer'])->withSum('payments','amount')`, paginate; stats satu `selectRaw` (total, total_amount, pending_count, approved_count, total_paid).
5. Respons Inertia `reimbursements/index` berisi `rows` (dengan `amount_paid`, `amount_remaining` accessor, `payment_status`, flag `can_edit/can_delete/can_submit/can_review/can_pay`), `bankAccountOptions` (label + saldo terformat), `categoryOptions` (`TransactionCategory::selectOptions('expense')` — untuk dialog review), `canApprove`, `canPay`, `canSeeAll` (UI menampilkan tab "Semua Pengajuan" hanya bila `true`).
6. UI (`resources/js/pages/reimbursements/index.tsx`): stats card, `Tabs`, tabel dengan kolom pemohon di tab all, dialog detail, dialog review, dialog pay, Sheet create/edit.

**Penjelasan kode:** flag baris memadukan state machine model + kepemilikan:

```php
// app/Http/Controllers/ReimbursementController.php
'can_edit' => $r->canEdit() && $r->user_id === auth()->id(),
'can_delete' => $r->canDelete(),   // pemilik draft/ditolak; admin; tidak siapa pun bila sudah ada pembayaran
'can_submit' => $r->canSubmit() && $r->user_id === auth()->id(),  // draft atau ditolak
'can_review' => $r->canReview(),   // status pending
'can_pay' => $r->canPay(),         // approved && belum lunas
```

### Membuat Reimbursement (`GET /reimbursements/create`, `POST /reimbursements`)

**Alur step-by-step:**
1. Halaman `reimbursements/create.tsx` (route gate `can:create reimbursements`) atau Sheet di index; form: judul, deskripsi, nominal (`CurrencyInput`), tanggal pengeluaran, kategori (pilihan tetap `Reimbursement::categories()`), lampiran opsional.
2. `POST /reimbursements` → `StoreReimbursementRequest`: `amount` integer min 1, `description` opsional (boleh tidak dikirim sama sekali — controller memakai `?? null`), `category` **in-list** (`transport|meals|office_supplies|communication|accommodation|medical|other`), `attachment` mimes `jpg,jpeg,png,pdf` max 5MB, `action` in `draft,submit`. Pesan validasi berbahasa Indonesia (`lang/id/validation.php` + `messages()` untuk nominal & lampiran).
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
4. Dalam transaction: kelola lampiran (hapus/ganti), update field, `action=submit` → `submit()` — berlaku juga untuk pengajuan **ditolak** (pengajuan ulang).
5. Redirect ke index; flash "berhasil diajukan" hanya bila status benar-benar menjadi `pending`.

### Hapus (`DELETE /reimbursements/{id}`)

1. `ConfirmDialog` → `DELETE` (gate `can:delete reimbursements`).
2. `canDelete()`: **tidak siapa pun** bila `amount_paid > 0` (transaksi bank debitnya tetap memotong saldo — flash "Reimbursement yang sudah memiliki pembayaran tidak dapat dihapus."); selain itu admin boleh status apa pun, pengguna lain hanya **pemilik** dengan status `draft`/`rejected` (QA 8 Okt 2026, BUG-07 & BUG-09).
3. Hook `deleting` model menghapus file lampiran dari disk **`public`** (tempat controller menyimpannya); lalu `back()` dengan flash.

### Submit (`POST /reimbursements/{id}/submit`)

1. Hanya pemilik (`abort(403)`); `canSubmit()` → status `draft` **atau `rejected`** (pengajuan ulang setelah diperbaiki).
2. `submit()` → status `pending` dan mengosongkan `reviewed_by`/`reviewed_at`/`review_notes` (pengajuan ulang = review baru; catatan penolakan lama tidak disimpan); masuk antrean review + badge sidebar reviewer.

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
2. `PayReimbursementRequest`: `bank_account_id` exists, `payment_amount` integer min 1 **max sisa** (`amount_remaining`; pesan "Jumlah pembayaran melebihi sisa reimbursement (Rp X)."), `payment_date` tidak boleh setelah hari ini. Dialog bayar juga menolak nominal di atas sisa.
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
- **Pembayaran tidak boleh melebihi sisa** — ditegakkan `PayReimbursementRequest` (`max` = `amount_remaining`) dan dialog bayar. Sebelum 8 Okt 2026 overpay diterima (amount_paid > amount, kelebihan keluar dari kas); data lama bisa memuat anomali ini — cek `WHERE amount_paid > amount`.
- **`category_id` wajib saat approve** — tanpa itu transaksi bank pembayaran akan berkategori null; enforce lewat `required_if:action,approve`.
- **Edit/submit hanya pemilik, tanpa bypass admin** (berbeda dari fund request yang mengizinkan admin edit); admin hanya punya bypass di `canDelete()`.
- **Pengajuan yang sudah dibayar (sebagian/penuh) tidak bisa dihapus siapa pun**, termasuk admin — menghapusnya dulu meninggalkan `bank_transactions` yatim yang tetap memotong saldo.
- **Hapus hanya milik sendiri** — izin `delete reimbursements` tidak cukup; `canDelete()` mensyaratkan pemilik (kecuali admin).
- **Tab "Semua" ditegakkan server** — jangan hanya menyembunyikan tab di UI; `index()` memaksa `my` bila tidak `canSeeAll`.
- **`category_input` bukan teks bebas** — meski model berkomentar "user's text input", validasi membatasi ke 7 nilai tetap; jangan tampilkan sebagai input teks di UI, gunakan pilihan dari `Reimbursement::categories()`.
- **Pengajuan ulang setelah `rejected`** — `canSubmit()` menerima `draft` dan `rejected`; `submit()` mengosongkan data review. Sebelum 8 Okt 2026 alur ini gagal diam-diam (status tetap ditolak sementara toast sukses).
- **Lampiran di disk `public`** — simpan, hapus, dan cek keberadaan file selalu lewat `Storage::disk('public')`; disk default (`local`) adalah folder lain.
- Semua nominal integer rupiah penuh; di React wajib `CurrencyInput`.

## File Kunci

- `routes/web.php` (blok reimbursements, baris ±346-356)
- `app/Http/Controllers/ReimbursementController.php`
- `app/Models/Reimbursement.php` — state machine, `recordPayment()`, accessor `amount_remaining`, `category_label`
- `app/Models/ReimbursementPayment.php` — relasi `bankTransaction`, `payer`
- `app/Http/Requests/StoreReimbursementRequest.php`, `UpdateReimbursementRequest.php`, `ReviewReimbursementRequest.php`, `PayReimbursementRequest.php`
- `resources/js/pages/reimbursements/index.tsx` (tabs, sheet, dialog detail/review/pay), `create.tsx`, `edit.tsx`, `types.ts`
- `tests/Feature/ReimbursementControllerTest.php` (termasuk regresi QA 8 Okt 2026), `tests/Feature/AttachmentCleanupTest.php`
- QA dengan bukti: `docs/qa/test-cases/reimbursements.md`, laporan `docs/qa/report/Laporan-QA-Reimbursements.pdf`
