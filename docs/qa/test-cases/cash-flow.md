# Test Case — Cash Flow (Arus Kas)

Sumber teknis: [`docs/module/cash-flow.md`](../../module/cash-flow.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-tiga` (DB `tenant_qa-tiga`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

Data awal yang dibuat sendiri untuk modul ini (semua lewat endpoint aplikasi):

| Objek | Nilai |
|---|---|
| `bank_accounts` id 1 | `QA3 Rek 1` / `QA3-0001`, saldo awal Rp 100.000.000 |
| `bank_accounts` id 2 | `QA3 Rek 2` / `QA3-0002`, saldo awal Rp 100.000.000 |
| `clients` id 1 | `PT Klien QA Tiga` |
| `invoices` id 1 | `001/INV/QA3-PKQT/VIII/2026`, total Rp 5.000.000, status `sent` |
| `payments` id 1 | Rp 2.000.000, 05/08/2026, rekening 1 |
| Kategori dipakai | 5 `Penghasilan` (income), 28 `Kembali Dana` (income), 15 `MAKAN MINUM` (expense), 19 `OPERASIONAL` (expense), 6 `Transfer Internal` (transfer) |

Aktor uji (lihat *Catatan pelaksanaan* soal role `qa3-*` yang dibuat khusus):

| Sesi | Akun | Permission cash-flow |
|---|---|---|
| `admin` | `admin@gmail.com` | semua |
| `staff` | `staff@gmail.com` | **tidak punya satu pun** permission cash-flow |
| `income-only` | `qa3.income@example.test` | `view/create/edit/delete income` + `view expense` + `view transfer` |
| `expense-only` | `qa3.expense@example.test` | `view/create/edit/delete expense` + `view income` + `view transfer` |
| `nodel` | `qa3.nodel@example.test` | `create transfer`, `delete income`, `delete expense` — **tanpa** `delete transfer` |
| `trf-only` | `qa3.trf@example.test` | hanya `view transfer` |

---

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Redirect index cash-flow | `GET /c/qa-tiga/cash-flow` sebagai admin | 302 ke `cash-flow.income` | BE | `302 → http://127.0.0.1:8000/c/qa-tiga/cash-flow/income` | Pass |
| N02 | Halaman Income = UNION payment + transaksi | Buat transaksi credit Rp 3.000.000 kategori 5; buka `/cash-flow/income` | 2 baris: `payment-1` (2.000.000) + `transaction-1` (3.000.000); `stats.total_amount = 5.000.000` | BE | Prop: `stats={"total_amount":5000000,"total_count":2}`; rows `transaction-1(3000000)`, `payment-1(2000000)` dengan `client_name="PT Klien QA Tiga"`, `invoice_number="001/INV/QA3-PKQT/VIII/2026"` | Pass |
| N03 | Catat pemasukan | `POST /bank-transactions` `{bank_account_id:1, category_id:5, amount:3000000, transaction_date:2026-08-10, transaction_type:credit}` | 302 + baris credit tersimpan | FE+BE | 302; DB `bank_transactions` id 1 `amount=3000000 type=credit category_id=5` | Pass |
| N04 | Catat pengeluaran | `POST /bank-transactions` `{category_id:15, amount:750000, transaction_type:debit}` | 302; muncul di halaman Expenses | FE+BE | 302; DB id 2; prop expenses `stats={"total_amount":750000,"total_count":1}`, `category_label="MAKAN MINUM"` | Pass |
| N05 | Transfer antar rekening + biaya admin | `POST /bank-transactions/transfer` `{from:1,to:2,category_id:6,amount:10000000,admin_fee:6500,transfer_date:2026-08-12}` | Dua baris berbagi `reference_number` `TRF…`; debit = `amount+admin_fee` | BE | id 3 `debit 10.006.500` rek 1, id 4 `credit 10.000.000` rek 2, keduanya `reference_number=TRF1787121385`, kategori 6 | Pass |
| N06 | Halaman Transfers merekonstruksi pasangan | `GET /cash-flow/transfers` | Satu baris: `amount` 10.000.000, `total_debit` 10.006.500, `admin_fee` 6.500, from/to benar | BE | Row: `{"id":4,"debit_id":3,"amount":10000000,"total_debit":10006500,"admin_fee":6500,"from_account":"QA3 Rek 1","to_account":"QA3 Rek 2"}` | Pass |
| N07 | Edit transaksi income (nominal + kategori + reference) | `PUT /bank-transactions/1` `{transaction_date:2026-08-15, description:"…(revisi)", amount:3500000, category_id:28, reference_number:INV-QA3-9}` | Semua field ikut berubah | FE+BE | DB id 1: `amount=3500000 category_id=28 reference_number=INV-QA3-9 transaction_date=2026-08-15` | Pass |
| N08 | Edit leg transfer tersinkron ke pasangan | `PUT /bank-transactions/3` `{transaction_date:2026-08-20, description:"Transfer direvisi QA3"}` | Tanggal & deskripsi kedua leg ikut berubah | BE | id 3 **dan** id 4 keduanya `transaction_date=2026-08-20`, `description="Transfer direvisi QA3"` | Pass |
| N09 | Hapus satu leg transfer menghapus keduanya | Buat transfer #2 (`TRF1787121534`), `DELETE /bank-transactions/8` (leg debit) sebagai admin | Kedua baris hilang | BE | Sebelum: 2 baris; sesudah: `COUNT=0` untuk reference tsb | Pass |
| N10 | Bulk delete transaksi bank (satu fitur) | `POST /bank-transactions/bulk-delete` `{ids:[5]}` sebagai income-only (id 5 = transaksi income) | 302, baris terhapus | BE | 302; id 5 hilang dari DB | Pass |
| N11 | Bulk delete cash-flow uid leg transfer | Buat transfer #3 (`TRF1787121779`), `POST /cash-flow/bulk-delete` `{uids:["transaction-15"]}` (leg credit) | Kedua leg hilang | BE | 302; `COUNT` untuk `TRF1787121779` = 0 (id 14 & 15 hilang) | Pass |
| N12 | Export PDF tanpa filter = SEMUA WAKTU | `GET /cash-flow/export/pdf` sebagai admin | 200 `application/pdf`, nama file `cash-flow-semua-waktu.pdf`, judul periode "SEMUA WAKTU" | BE | 200, 5.785 byte, `Content-Disposition: attachment; filename=cash-flow-semua-waktu.pdf`; teks PDF: `PERIODE: SEMUA WAKTU`, `SALDO AWAL (TANGGAL 04/08/2026) Rp 200.000.000` | Pass |
| N13 | Export PDF rentang tanggal + satu rekening | `GET /cash-flow/export/pdf?date_from=2026-08-01&date_to=2026-08-12&bank_accounts=1` | Nama file mencerminkan periode & akun | BE | `filename=cash-flow-2026-08-01-to-2026-08-12-account-1.pdf`, 200 (4.388 byte) | Pass |
| N14 | Preview PDF inline | `GET /cash-flow/export/pdf/preview?section=expenses` | 200, `Content-Disposition: inline` | BE | `inline; filename=cash-flow-preview.pdf`, 200 | Pass |
| N15 | Filter tanggal halaman Income | `?date_from=2026-08-01&date_to=2026-08-10` | Hanya `payment-1` (05/08) | BE | `stats={"total_amount":2000000,"total_count":1}`, row `payment-1` | Pass |
| N16 | Filter rekening/kategori/pencarian halaman Expenses | `?bank_accounts=2`, `?categories=15`, `?search=Operasional` | Masing-masing menyaring benar | BE | `bank_accounts=2` → 1 baris (id 10, QA3 Rek 2/OPERASIONAL, 333.000); `categories=15` → 3 baris (1.022.000); `search=Operasional` → 1 baris (333.000); tanpa filter 4 baris (1.355.000) | Pass |
| N17 | Sorting + paginasi Expenses | `?sort=amount&direction=desc&per_page=2` | 2 baris terurut menurun, `last_page=2` | BE | `pagination={"current_page":1,"last_page":2,"per_page":2,"total":4}`; rows `2:750000`, `10:333000` | Pass |
| N18 | Unggah lampiran PNG pada pengeluaran | `POST /bank-transactions` multipart + `attachment=bukti.png` | Tersimpan di `transaction-attachments/` disk public | FE+BE | id 7 `attachment_path=transaction-attachments/Ttrphi….png`, `attachment_name=bukti.png`; file ada di `storage/tenantqa-tiga/app/public/transaction-attachments/` | Pass |
| N19 | `remove_attachment` menghapus berkas fisik | Buat transaksi berlampiran (id 13) lalu `PUT` dengan `remove_attachment=1` | Kolom lampiran null **dan** file hilang dari disk | BE | `attachment_path` menjadi kosong; jumlah file di folder 3 → 2 | Pass |
| N20 | Saldo rekening computed mengikuti mutasi | Cek prop `accounts[].balance` setelah tiap mutasi | Saldo = `initial + payments + credit − debit` | BE | Setelah N02–N04: rek1 `104.250.000` (100jt + 2jt + 3jt − 750rb). Setelah transfer N05: rek1 `94.243.500`, rek2 `110.000.000` (biaya admin 6.500 hilang dari total kas) | Pass |
| N21 | Catat pengeluaran lewat form, termasuk pemilih kategori berjenjang | Menu Pengeluaran → Input Pengeluaran → rekening, kategori `MAKAN MINUM`, Rp 350.000, deskripsi "Konsumsi rapat tim QA" → Simpan | Tersimpan; kartu total & jumlah transaksi ikut naik; induk kategori tidak bisa dipilih | FE+BE | Tersimpan. Induk "OPERATIONAL EXPENSES" hanya tampil sebagai judul grup, tidak dapat dipilih. DB `bank_transactions id=1 amount=350000 transaction_type=debit` | Pass |

---

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Nominal 0 | `POST /bank-transactions` `amount=0` | 422 | FE+BE | 422 `"The amount field must be at least 1."` | Pass |
| A02 | Nominal negatif | `amount=-5000` | 422 | FE+BE | 422 `"The amount field must be at least 1."` | Pass |
| A03 | `transaction_type` tidak dikenal | `transaction_type=kredit` | **422**, bukan 403 (harus lolos `authorize()` agar jadi pesan validasi) | BE | 422 `"The selected transaction type is invalid."` | Pass |
| A04 | `transaction_type` kosong | Field dihilangkan (sesi income-only) | 422, bukan 403 | BE | 422 `"The transaction type field is required."` | Pass |
| A05 | Transfer ke rekening yang sama | `from_account_id=1&to_account_id=1` | 422 | FE+BE | 422 `"The from account id field and to account id must be different."` | Pass |
| A06 | Biaya admin negatif | `admin_fee=-500` | 422 | FE+BE | 422 `"The admin fee field must be at least 0."` | Pass |
| A07 | Lampiran bertipe salah | Unggah `bukti.txt` | 422 | FE+BE | 422 `"The attachment field must be a file of type: pdf, jpg, jpeg, png."` | Pass |
| A08 | Punya `create income`, TANPA `create expense` → kirim `debit` | Sesi income-only, `transaction_type=debit`, `category_id=15` | 403; tidak ada baris baru | BE | **403** `"This action is unauthorized."` (`AccessDeniedHttpException`); DB tidak bertambah | Pass |
| A09 | Sesi yang sama boleh `credit` | Sesi income-only, `transaction_type=credit` | 302, tersimpan | BE | 302; DB id 5 `credit 111.000` | Pass |
| A10 | Punya `create expense`, TANPA `create income` → kirim `credit` | Sesi expense-only, `transaction_type=credit` | 403 | BE | **403** `"This action is unauthorized."` | Pass |
| A11 | Sesi yang sama boleh `debit` | Sesi expense-only, `transaction_type=debit` | 302 | BE | 302; DB id 6 `debit 222.000` | Pass |
| A12 | Edit lintas fitur — income-only mengedit pengeluaran | `PUT /bank-transactions/2` | 403 | BE | 403; `description`/`transaction_date` id 2 tidak berubah | Pass |
| A13 | Edit lintas fitur — income-only mengedit leg transfer | `PUT /bank-transactions/3` | 403 (butuh `edit transfer`) | BE | 403; id 3 tidak berubah | Pass |
| A14 | Nominal & kategori leg transfer tidak bisa diubah lewat edit | `PUT /bank-transactions/3` menyertakan `amount=99999999` & `category_id=15` | Hanya tanggal & deskripsi berubah | BE | `amount` tetap `10006500`, `category_id` tetap `6`; hanya tanggal & deskripsi berubah (dan tersinkron ke id 4) | Pass |
| A15 | Hapus leg transfer tanpa `delete transfer` | Sesi nodel, `DELETE /bank-transactions/8` | 403; kedua leg tetap ada | BE | 403; `COUNT` untuk `TRF1787121534` tetap 2 | Pass |
| A16 | Bulk delete campur income+expense oleh income-only | `POST /bank-transactions/bulk-delete` `{ids:[1,2]}` | **403 untuk seluruh request**, tidak ada yang terhapus | BE | 403; id 1 **dan** id 2 masih ada | Pass |
| A17 | Bulk delete campur expense+transfer oleh nodel | `{ids:[2,3]}` | 403 seluruhnya | BE | 403; id 2, 3, 4 semua masih ada | Pass |
| A18 | Bulk delete cash-flow uid payment oleh expense-only | `POST /cash-flow/bulk-delete` `{uids:["payment-1"]}` | 403 (payment = fitur income) | BE | 403; payment id 1 masih ada | Pass |
| A19 | Bulk delete cash-flow campuran oleh income-only | `{uids:["payment-1","transaction-2"]}` (transaction-2 = expense) | 403 seluruhnya | BE | 403; payment tetap 1 baris, transaksi id 2 tetap ada | Pass |
| A20 | Transfer tanpa `create transfer` | Sesi income-only `POST /bank-transactions/transfer` | 403 | BE | 403 | Pass |
| A21 | User tanpa permission cash-flow membuka halaman | Sesi staff `GET /cash-flow/income` dan `GET /cash-flow` | 403 keduanya | BE | 403 & 403 | Pass |
| A22 | Redirect index untuk user yang hanya punya `view transfer` | Sesi trf-only `GET /cash-flow` | 302 ke halaman transfers; `/cash-flow/income` 403 | BE | `302 → /c/qa-tiga/cash-flow/transfers`; `/cash-flow/income` = 403 | Pass |
| A23 | Export PDF tanpa `view bank-accounts` | Sesi staff & income-only `GET /cash-flow/export/pdf` | 403 | BE | 403 keduanya | Pass |
| A24 | Bulk delete tanpa `ids` | `POST /bank-transactions/bulk-delete` tanpa body | 422 | BE | 422 `"The ids field is required."` | Pass |
| A25 | Hapus transaksi yang tidak ada | `DELETE /bank-transactions/99999` | 404 | BE | 404 | Pass |
| A26 | Akses tanpa login | `GET /c/qa-tiga/cash-flow/income` tanpa cookie | 302 ke `/login` | BE | `302 → http://127.0.0.1:8000/login` | Pass |
| A27 | Akses perusahaan yang bukan keanggotaannya | Sesi income-only `GET /c/qa-satu/cash-flow/income` | 403 | BE | 403 | Pass |
| A28 | Credit dengan kategori bertipe `expense` | `POST /bank-transactions` `{transaction_type:credit, category_id:15}` | Perilaku terdokumentasi: tidak tampil di Income (kategori bukan `income`) dan tidak di Expenses (arah bukan debit), tetapi saldo tetap berubah — **tanpa validasi penolakan** | BE | Diterima (302), DB id 11 `credit 444.000 category_id=15`. Income tetap `total_count=2`, Expenses tetap `total_count=4`. Saldo rek1 naik 94.471.500 → **94.915.500**. Muncul hanya di PDF (`QA3 CREDIT KATEGORI EXPENSE Rp 444.000`) → lihat **BUG-CF-04** | Fail |
| A29 | URL lampiran yang dikirim server | Ambil `attachment_url` dari prop lalu akses | URL bisa dibuka pemilik sesi | BE | Prop memberi `/storage/transaction-attachments/Ttrphi….png` → **403**. URL yang benar `/c/qa-tiga/storage/transaction-attachments/Ttrphi….png` → 200 `image/png`. Lihat **BUG-CF-01** | Fail |
| A30 | Berkas lampiran saat transaksi dihapus | Hapus transaksi berlampiran (id 7 via bulk, id 12 via `DELETE` tunggal) | Hook `deleting` menghapus file fisik | BE | Baris terhapus, tetapi **file tetap ada** di `storage/tenantqa-tiga/app/public/transaction-attachments/` (2 berkas yatim tersisa di akhir sesi). Lihat **BUG-CF-02** | Fail |
| A31 | Tanggal transaksi di masa depan | `PUT /bank-transactions/3` `transaction_date=2026-08-20` (hari uji 2026-08-19) | — (tidak ada aturan tertulis) | BE | Diterima tanpa peringatan; akibatnya baris hilang dari laporan mode SEMUA WAKTU (lihat C05 / **BUG-CF-05**) | Fail |

---

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Filter Income saling eksklusif | (1) Tanpa filter; (2) `?clients=1`; (3) `?categories=28` | (1) payment+transaksi; (2) hanya baris payment; (3) hanya baris transaksi | BE | (1) `total 5.500.000 / 2 baris` (`transaction-1`, `payment-1`); (2) `2.000.000 / 1 baris` — hanya `payment-1`; (3) `3.500.000 / 1 baris` — hanya `transaction-1`. Sesuai invarian terdokumentasi | Pass |
| C02 | Bulk delete cash-flow menghapus pembayaran invoice | Admin `POST /cash-flow/bulk-delete` `{uids:["payment-1","transaction-11"]}`; invoice 1 semula `partially_paid` | Payment terhapus **dan** status invoice dihitung ulang → `sent` | BE | Payment terhapus (`COUNT=0`) dan transaksi 11 terhapus, tetapi invoice 1 **tetap `partially_paid`** padahal tidak ada pembayaran tersisa. Lihat **BUG-CF-03** | Fail |
| C03 | Siklus transfer: buat → klasifikasi → hapus | Buat transfer 250.000 + fee 2.500 (`TRF1787121779`); cek Income/Expenses; hapus lewat `cash-flow/bulk-delete` satu leg | Tidak muncul di Income/Expenses; hapus satu leg menghapus pasangan dan saldo pulih | BE | Leg credit & debit tidak muncul di Income/Expenses (kategori bertipe `transfer`); `POST /cash-flow/bulk-delete {uids:["transaction-15"]}` → sisa baris 0 untuk reference tsb | Pass |
| C04 | Lintas modul: pencairan Fund Request → Cash Flow Pengeluaran | Cairkan `001/TIG/VIII/2026` (2 item) ke rekening 1 | Dua baris debit muncul di Expenses dengan kategori per item | BE | `?search=Pencairan` → `stats={"total_amount":1850000,"total_count":2}`; row 16 `1.500.000 / OPERASIONAL`, row 17 `350.000 / MAKAN MINUM`, keduanya `reference_number=REF-CAIR-QA3-001` | Pass |
| C05 | Konsistensi saldo akhir PDF vs saldo rekening | (1) Export tanpa filter (SEMUA WAKTU); (2) export `date_from=2026-08-01&date_to=2026-08-31` | Saldo akhir laporan = jumlah saldo rekening | BE | (1) SEMUA WAKTU: baris transfer (20/08/2026) **tidak ikut**, `TOTAL … Rp 204.589.000`. (2) Rentang 01–31/08: transfer ikut, `Rp 204.582.500` = jumlah saldo rekening sebenarnya. Selisih Rp 6.500 = biaya admin yang tercecer. Lihat **BUG-CF-05** | Fail |

---

## Temuan

### BUG-CF-01 — `attachment_url` tidak ber-prefix perusahaan → semua pratinjau lampiran 403
- **SIFAT**: Regresi multi-tenancy / fitur tidak berfungsi.
- **MENGGAGALKAN**: A29 (dan berdampak ke Fund Requests, lihat `fund-requests.md`).
- **GEJALA**: Prop `attachment_url` bernilai `/storage/transaction-attachments/TtrphiVHluKrELCzZxrIAbQH47VLZwRqZNywdO4D.png`. `GET http://127.0.0.1:8000/storage/…` → **403**. Berkas yang sama lewat `GET http://127.0.0.1:8000/c/qa-tiga/storage/…` → **200 `image/png`**. Karena `AttachmentPreviewButton` memakai nilai prop apa adanya (`<img src>` / `<iframe src>`), pratinjau lampiran di Income/Expenses/Transfers tidak pernah tampil.
- **SEBAB**: `app/Http/Controllers/CashFlowController.php:146,242,369` dan `app/Http/Controllers/BankTransactionController.php:67,140` memakai `Storage::url($path)`. Disk `public` di `config/filesystems.php:44` mendefinisikan `'url' => env('APP_URL') . '/storage'` — tanpa segmen `c/{company}`. Satu-satunya route yang bisa melayani berkas tenant adalah `routes/web.php:135` `Route::get('/storage/{path}', TenantStorageController::class)` **di dalam** grup `Route::prefix('c/{company}')`. Tidak ada helper di frontend yang menambahkan prefix: `resources/js/components/shared/file-preview-dialog.tsx:216` meneruskan `url` mentah, dan tidak ada pemakaian `companyUrl()` di berkas itu.
- **CAKUPAN**: Semua modul yang memanggil `Storage::url()` untuk lampiran tenant — terverifikasi di Cash Flow dan Fund Requests (`disbursement_attachment_url` juga `/storage/…` → 403). Berlaku untuk semua perusahaan.
- **SARAN PERBAIKAN**: Ganti `Storage::url($path)` dengan `route('tenant.storage', ['company' => tenant()->getTenantKey(), 'path' => $path])` (atau helper `tenant_storage_url()` di `app/helpers.php`) sehingga URL selalu `/c/{company}/storage/{path}`. Alternatif: override `url` disk `public` saat tenancy diinisialisasi.

### BUG-CF-02 — Lampiran transaksi tidak pernah terhapus dari disk saat transaksi dihapus
- **SIFAT**: Kebocoran penyimpanan (orphan file) + hook tak berfungsi.
- **MENGGAGALKAN**: A30.
- **GEJALA**: Transaksi id 7 (`transaction-attachments/Ttrphi….png`) dihapus lewat `POST /cash-flow/bulk-delete`, dan transaksi id 12 (`…BLkALzZ….png`) dihapus lewat `DELETE /bank-transactions/12`. Kedua baris hilang dari DB, tetapi kedua berkas **masih ada** di `storage/tenantqa-tiga/app/public/transaction-attachments/` di akhir sesi. Kontrol positif: `PUT` dengan `remove_attachment=1` **berhasil** menghapus berkas (jumlah berkas 3 → 2).
- **SEBAB**: Dua sebab bertumpuk. (1) `app/Models/BankTransaction.php:121-125` — hook `deleting` memakai `Storage::exists()` / `Storage::delete()` pada disk **default**, dan `.env` memasang `FILESYSTEM_DISK=local` (root `storage/app/private`), padahal berkas disimpan ke disk `public` (`BankTransactionController.php:171` `$file->store('transaction-attachments', 'public')`). Karena itu `Storage::exists()` selalu `false` dan hook tidak pernah menghapus apa pun. Bandingkan `BankTransactionController.php:207,213` yang benar memakai `Storage::disk('public')->delete(...)`. (2) Kalaupun hook diperbaiki, `CashFlowController.php:447,453` dan bulk delete di `BankTransactionController` memakai *mass delete* (`whereIn(...)->delete()`) yang tidak membangkitkan event model sama sekali.
- **CAKUPAN**: Semua penghapusan transaksi bank di semua perusahaan; berkas menumpuk tanpa batas dan tidak bisa ditelusuri lagi karena barisnya hilang.
- **SARAN PERBAIKAN**: Ubah hook menjadi `Storage::disk('public')` dan ganti mass delete pada jalur bulk menjadi iterasi `$model->delete()` (atau hapus berkas secara eksplisit sebelum mass delete). Tambahkan pengaman untuk lampiran transfer yang dibagi dua leg: hapus berkas hanya bila tidak ada baris lain yang merujuk `attachment_path` yang sama.

### BUG-CF-03 — Bulk delete Cash Flow menghapus pembayaran tanpa menghitung ulang status invoice
- **SIFAT**: Inkonsistensi data lintas modul.
- **MENGGAGALKAN**: C02.
- **GEJALA**: Invoice id 1 (`001/INV/QA3-PKQT/VIII/2026`, total Rp 5.000.000) berstatus `partially_paid` karena satu pembayaran Rp 2.000.000. Setelah `POST /c/qa-tiga/cash-flow/bulk-delete` dengan `uids[]=payment-1`, tabel `payments` kosong (`COUNT=0`) tetapi `invoices.status` **tetap `partially_paid`**. Invoice tampak sudah dibayar sebagian padahal tidak ada pembayaran sama sekali.
- **SEBAB**: `app/Http/Controllers/CashFlowController.php:438` `Payment::whereIn('id', $paymentIds)->delete()` — mass delete tanpa memuat model dan tanpa memanggil `updateStatus()`. Jalur resmi `app/Http/Controllers/PaymentController.php:83-90` melakukannya dengan benar (`$payment->delete(); $invoice->updateStatus();`). Model `Payment` tidak punya hook `deleted` yang merapikan status (`app/Models/Payment.php` hanya menyebut penghapusan lampiran di komentar baris 69).
- **CAKUPAN**: Setiap user dengan `delete income` yang memakai bulk delete di halaman Cash Flow → Pemasukan. Dampak: daftar invoice, dashboard piutang, dan `amount_remaining` salah; sama seperti BUG-CF-02, lampiran pembayaran juga tertinggal di disk.
- **SARAN PERBAIKAN**: Muat model dulu (`Payment::with('invoice')->whereIn('id', $ids)->get()`), hapus satu per satu di dalam `DB::transaction`, lalu panggil `$invoice->updateStatus()` untuk setiap invoice unik yang terdampak.

### BUG-CF-04 — Tidak ada validasi kecocokan tipe kategori dengan arah transaksi
- **SIFAT**: Celah validasi dengan dampak pelaporan (uang "tak terlihat").
- **MENGGAGALKAN**: A28.
- **GEJALA**: `POST /bank-transactions` dengan `transaction_type=credit` + `category_id=15` (kategori bertipe `expense`) diterima (302, DB id 11 `amount=444000`). Baris itu **tidak muncul di halaman Income** (syarat `transaction_categories.type='income'`) **maupun Expenses** (syarat `transaction_type='debit'`), tetapi saldo rekening 1 naik dari 94.471.500 menjadi 94.915.500. Satu-satunya tempat ia terlihat adalah PDF (`QA3 CREDIT KATEGORI EXPENSE … Rp 444.000`). Kasus yang sama terjadi lewat Fund Request (lihat `fund-requests.md` A19/C04): transaksi debit berkategori `income` tidak tampil di halaman mana pun.
- **SEBAB**: `app/Http/Requests/StoreBankTransactionRequest.php` hanya memvalidasi `category_id` dengan `exists:transaction_categories,id` — tidak ada aturan yang mengaitkan `type` kategori dengan `transaction_type`. Pembatasan hanya ada di frontend, yang memuat opsi dari `TransactionCategory::selectOptions('income'|'expense')`.
- **CAKUPAN**: Semua user dengan `create income`/`create expense`/`disburse fund requests`. Bukan eksploitasi hak akses, tetapi menghasilkan mutasi kas yang tidak pernah muncul di layar operasional — sulit direkonsiliasi.
- **SARAN PERBAIKAN**: Tambahkan aturan `Rule::exists('transaction_categories','id')->where('type', $type === 'credit' ? 'income' : 'expense')` (dan `transfer` untuk endpoint transfer), atau sebuah `withValidator` yang menolak kombinasi tak cocok dengan pesan jelas. Untuk Fund Request, batasi `items.*.category_id` ke tipe `expense`.

### BUG-CF-05 — Mode "SEMUA WAKTU" dipotong hari ini sehingga saldo akhir laporan tidak cocok dengan saldo rekening
- **SIFAT**: Ketidakcocokan laporan (reporting) — bukan korupsi data.
- **MENGGAGALKAN**: C05 (dan A31 sebagai pemicunya).
- **GEJALA**: Hari uji 19/08/2026. Setelah leg transfer diberi `transaction_date=2026-08-20` (diterima tanpa peringatan lewat `PUT /bank-transactions/3`), export tanpa filter menghasilkan `PERIODE: SEMUA WAKTU` dengan `TOTAL … Rp 204.589.000`, sedangkan saldo rekening sebenarnya `94.915.500 + 109.667.000 = Rp 204.582.500`. Export dengan rentang eksplisit `2026-08-01..2026-08-31` menampilkan kedua leg transfer dan berakhir tepat di `Rp 204.582.500`.
- **SEBAB**: `app/Services/CashFlowExportService.php:61-67` — pada mode tanpa filter, `$end = now()->endOfDay()`, sehingga transaksi bertanggal setelah hari ini tidak ikut, padahal `BankAccount::getBalanceAttribute` menjumlahkan **semua** transaksi tanpa batas tanggal. Pemicunya: `app/Http/Requests/UpdateBankTransactionRequest.php` (dan `StoreBankTransactionRequest`) hanya memakai `['required','date']` untuk `transaction_date` — tidak ada `before_or_equal:today`.
- **CAKUPAN**: Setiap perusahaan yang punya transaksi bertanggal di masa depan (salah ketik tanggal sudah cukup). Dampak: laporan kas "semua waktu" tidak bisa direkonsiliasi dengan saldo yang ditampilkan aplikasi.
- **SARAN PERBAIKAN**: Pilih salah satu dan konsistenkan — (a) batasi `transaction_date` ke `before_or_equal:today` di kedua FormRequest, atau (b) pada mode SEMUA WAKTU pakai `$end = max(now(), MAX(transaction_date), MAX(payment_date))` agar laporan benar-benar mencakup seluruh data.

---

## Catatan pelaksanaan

- **Cara eksekusi.** Semua case dijalankan lewat HTTP ke `http://127.0.0.1:8000` dengan cookie sesi hasil login sungguhan (`POST /login`) + header `X-XSRF-TOKEN`. Prop halaman dibaca dari `<script data-page="app" type="application/json">` pada respons HTML Inertia — jadi yang dinilai adalah data yang benar-benar dikirim ke React, bukan tebakan. Verifikasi efek samping dilakukan langsung ke `tenant_qa-tiga` lewat PDO. **Tidak ada case yang dijalankan lewat klik di browser**; kolom "Lapisan" berisi `FE+BE` hanya bila penegakan di frontend juga terbaca di kode (mis. `income.tsx:62-63` `can('delete income')` / `can('create income')`), sedangkan bukti eksekusi yang dilampirkan selalu dari sisi BE.
- **Role & user khusus QA (sudah dibersihkan).** Role bersama (`admin`, `finance manager`, `staff`) dan permission-nya **tidak diubah sama sekali**. Untuk menguji permission sempit dibuat 4 role baru ber-prefix `qa3-` (`qa3-income-only`, `qa3-expense-only`, `qa3-nodeltransfer`, `qa3-transferonly`) yang di-scope ke `company_id='qa-tiga'`, masing-masing dengan satu user baru (`qa3.income@example.test`, `qa3.expense@…`, `qa3.nodel@…`, `qa3.trf@…`) yang hanya menjadi anggota `qa-tiga`. **Setelah pengujian selesai, keempat role dan keempat user itu dihapus kembali** beserta barisnya di `role_has_permissions`, `model_has_roles`, `company_user`, dan `sessions`, lalu `php artisan permission:cache-reset`. Verifikasi setelah pembersihan: `roles` tersisa `admin`, `finance manager`, `staff`; `users` tersisa akun bersama (id 1–3) + akun milik agent QA lain (id 8–10); ketiga akun bersama masih bisa login dan membuka modul (200).
- **Kegagalan tooling (bukan cacat aplikasi).** Upaya membuat role lewat UI aplikasi (`POST /c/qa-tiga/admin/roles`) mengembalikan 500: `SQLSTATE[42S02] … Table 'tenant_qa-tiga.roles' doesn't exist … select count(*) from 'roles' where name = …`. Penyebabnya `Rule::unique('roles','name')` di `app/Http/Controllers/Admin/RoleController.php:31` berjalan pada koneksi default yang sudah dialihkan ke tenant, sedangkan tabel `roles` ada di `finance_central`. **Ini bukan modul yang saya uji** dan saya laporkan apa adanya di sini; karena jalur UI buntu, role/user QA dibuat langsung lewat SQL ke `finance_central` (hanya baris baru — tidak ada baris milik role/user bersama yang diubah), diikuti `php artisan permission:cache-reset`.
- **Batasan yang jujur diakui.** (a) Tampilan visual (posisi tombol, disabled state, dialog konfirmasi) **tidak diuji** — hanya kontrak data/endpoint. (b) Fitur *paste clipboard* pada `FileUpload` tidak bisa diuji lewat HTTP → **Belum diuji**. (c) Pemecahan tabel PDF per 250 baris tidak diuji karena data uji hanya belasan baris → **Belum diuji**. (d) Perilaku `ConfirmDialog` dan bulk-select di UI tidak diuji langsung; yang diuji adalah endpoint yang dipanggilnya.
- **Sisa data uji di `tenant_qa-tiga`** (sengaja ditinggal sebagai bukti temuan, bukan lupa dibersihkan): 10 `bank_transactions` termasuk dua transaksi pencairan yatim (id 16 & 17, total Rp 1.850.000) milik fund request yang sudah dihapus, invoice id 1 berstatus `partially_paid` tanpa pembayaran, dan 3 berkas di `storage/tenantqa-tiga/app/public/transaction-attachments/` (2 di antaranya yatim). Perusahaan lain tidak disentuh.
- **Reproduksi.** Karena role/user `qa3-*` sudah dihapus, mengulang case A08–A23 membutuhkan pembuatan ulang role+user ber-permission sempit yang sama (daftar permission per role ada di tabel aktor di bagian atas berkas ini).
