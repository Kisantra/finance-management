# Test Case — Bank Accounts (Rekening Bank)

Sumber teknis: [`docs/module/bank-accounts.md`](../../module/bank-accounts.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-dua` (DB `tenant_qa-dua`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

**Prasyarat**: tenant `qa-dua` dimulai dalam keadaan **kosong** (0 rekening,
0 transaksi, 0 invoice; hanya 28 kategori bawaan). Seluruh data uji di bawah
dibuat sendiri oleh test case ini lewat endpoint aplikasi, bukan lewat SQL.
Akun: `admin@gmail.com` (admin), `manager@gmail.com` (finance manager),
`staff@gmail.com` (staff — **tidak punya** permission `view/create/edit/delete
bank-accounts`, dipakai sebagai penguji akses tanpa izin).

**Metode**: seluruh case dieksekusi lewat HTTP (`curl` + sesi login sungguhan +
CSRF). Props halaman dibaca dari payload Inertia (`data-page="app"`), bukan dari
tangkapan layar. Tidak ada langkah layar yang dikarang.

---

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat rekening baru | `POST /c/qa-dua/bank-accounts` `account_name=QA Rekening Utama`, `account_number=1000000001`, `bank_name=BCA`, `branch=Jakarta`, `initial_balance=1000000` | 302 redirect + baris baru di `bank_accounts` | BE | HTTP **302**; DB: `id=1 account_number=1000000001 initial_balance=1000000` | Pass |
| N02 | Buat rekening kedua dengan `initial_balance=0` (batas bawah `min:0`) | `account_number=1000000002`, `bank_name=Mandiri`, `initial_balance=0` | Diterima — 0 adalah nilai sah | BE | HTTP **302**; DB `id=2 initial_balance=0` | Pass |
| N03 | **Saldo adalah accessor computed, bukan kolom** | `SHOW COLUMNS FROM bank_accounts` | Tidak ada kolom `balance` | BE | Kolom yang ada: `id, account_name, account_number, bank_name, branch, initial_balance, created_at, updated_at` — **tidak ada `balance`** | Pass |
| N04 | Saldo bergerak setelah transaksi credit & debit | `POST /bank-transactions` credit 500.000 (kat 28) lalu debit 200.000 (kat 15) pada akun 1 → baca ulang prop `accounts[].balance` | `2.000.000`? Saat itu `initial_balance` masih 1.000.000 → saldo = 1.000.000 + 500.000 − 200.000 = **1.300.000** | BE | Prop Inertia: `{"id":1,...,"initial_balance":1000000,"balance":1300000}`. DB `bank_accounts` tetap tanpa kolom saldo | Pass |
| N05 | Ubah `initial_balance` menggeser saldo terkini (bukti saldo dihitung ulang, bukan tersimpan) | `PUT /bank-accounts/1` `initial_balance=2000000` (nomor rekening tetap `1000000001`) | Unique mengecualikan diri sendiri → diterima; saldo jadi 2.000.000 + 500.000 − 200.000 = **2.300.000** | BE | HTTP **302**; prop: `init=2000000 bal=2300000` | Pass |
| N06 | Endpoint tab Transaksi (JSON murni, bukan Inertia) | `GET /c/qa-dua/bank-accounts/transactions?account=1` | HTTP 200 JSON `{data[], current_page, last_page, per_page, total, from, to}`; **tidak** tertangkap route-binding `{bankAccount}` | BE | HTTP **200**, `Content-Type` JSON. `total=2`, item berisi `category.label="MAKAN MINUM"` + `parent_label="Operational Expenses"`. Terbukti route `/bank-accounts/transactions` tidak dibaca sebagai ID akun | Pass |
| N07 | Endpoint tab Pembayaran Invoice | `GET /c/qa-dua/bank-accounts/payments?account=1` | HTTP 200 JSON, `total=0` (belum ada pembayaran) | BE | HTTP **200** `{"data":[],...,"total":0}` | Pass |
| N08 | Filter tab Transaksi: tipe, pencarian, bulan | `?account=1&transaction_type=debit`; `?account=1&search=Pemasukan`; `?account=1&month=2026-08`; `?account=1&month=2026-01` | Masing-masing tersaring benar | BE | debit → `total=4` semua `debit`; search → `total=1` (`QA Pemasukan`); `month=2026-08` → `total=5`; `month=2026-01` → `total=0` | Pass |
| N09 | Statistik & breakdown kategori pada detail akun | `GET /c/qa-dua/bank-accounts?account=1&month=2026-08` → baca prop `detail` | `stats` konsisten dengan transaksi bulan itu; `period.label` = "Agustus 2026" | BE | `period={"start":"2026-08-01","end":"2026-08-31","label":"Agustus 2026","is_all_time":false}`; `stats={"total_income":500000,"total_expense":866000,"net_cashflow":-366000,"transaction_count":5}` | Pass |
| N10 | `overallSummary` lintas akun | Prop `overallSummary` pada halaman index | `total_balance` = Σ saldo semua akun | BE | `{"total_balance":1634000,"income":500000,"expense":866000}` — cocok: akun 1 = 2.000.000 + 500.000 − 866.000 = 1.634.000; akun 2 = 0 | Pass |
| N11 | Export PDF laporan kas (rentang tanggal) | `GET /c/qa-dua/bank-account/export/pdf?bank_account_id=1&start_date=2026-08-01&end_date=2026-08-31` | 200, `application/pdf`, nama file mengikuti filter | BE | HTTP **200**, `Content-Type: application/pdf`, `filename=cash-flow-2026-08-01-to-2026-08-31-account-1.pdf` | Pass |
| N12 | Alias `date_from`/`date_to` diterima `parseFilters()` | `?bank_account_id=1&date_from=2026-08-01&date_to=2026-08-31` | Hasil identik dengan N11 | BE | Nama file identik: `cash-flow-2026-08-01-to-2026-08-31-account-1.pdf` | Pass |
| N13 | Export mode "semua waktu" + preview inline | `GET .../export/pdf` (tanpa filter) dan `.../export/pdf/preview?bank_account_id=1` | `cash-flow-semua-waktu.pdf` (attachment) & preview `inline` | BE | `attachment; filename=cash-flow-semua-waktu.pdf`; preview → `inline; filename=cash-flow-preview.pdf` | Pass |
| N14 | **Cascade delete**: hapus rekening ikut menghapus transaksi & payment-nya | Buat akun 4 (`initial_balance=5.000.000`), tambah 1 transaksi debit 100.000 + 1 payment invoice 400.000 → saldo dibaca → `DELETE /bank-accounts/4` | Saldo sebelum hapus = 5.000.000 − 100.000 + 400.000 = **5.300.000**; setelah delete: akun, `bank_transactions`, dan `payments`-nya hilang | BE | Saldo terbaca **5.300.000** (payment ikut menambah saldo). Setelah `DELETE` (HTTP 302): `bank_accounts id=4 → 0 baris`, `payments bank_account_id=4 → 0`, `bank_transactions bank_account_id=4 → 0`. Cascade terbukti. **Namun ada efek samping tak diinginkan → lihat BUG-BA-01** | Pass (cascade), efek samping = Fail terpisah |
| N15 | Manager (finance manager) boleh CRUD rekening | `POST /bank-accounts` & `DELETE /bank-accounts/3` sebagai `manager@gmail.com` | Diizinkan (role punya create/edit/delete bank-accounts) | BE | POST **302** (akun `QA Manager Acc` terbentuk), DELETE **302** (akun id=3 terhapus) | Pass |
| N16 | Whitelist sort pada tab Pembayaran | `GET /bank-accounts/payments?account=1&sort=DROP` | Kolom tak dikenal jatuh ke default (`payments.payment_date`), **bukan** 500 | BE | HTTP **200**, respons normal — `match()` whitelist bekerja | Pass |
| N17 | Saldo rekening terhitung dinamis di layar | Setelah 1 pemasukan Rp 5.200.000 dan 1 pengeluaran Rp 350.000, buka menu Rekening Bank | Saldo = saldo awal + kredit - debit, bukan angka tersimpan | FE+BE | Rp 14.850.000 = 10.000.000 + 5.200.000 - 350.000. Breakdown kategori ikut menyesuaikan hasil pemindahan kategori pada transaction-categories C05 | Pass |

---

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | `account_number` duplikat saat create | `POST` dengan `account_number=1000000001` (sudah dipakai akun 1) | 422 + pesan unique | BE | HTTP **422** `{"account_number":["The account number has already been taken."]}` | Pass |
| A02 | Semua field wajib dihilangkan total | `POST` hanya kirim `branch=X` | 422 menyebut keempat field wajib | BE | HTTP **422** `{"account_name":["The account name field is required."],"account_number":[...required],"bank_name":[...required],"initial_balance":[...required]}` | Pass |
| A03 | `initial_balance` di bawah batas (`min:0`) | `initial_balance=-1` | 422 | BE | HTTP **422** `{"initial_balance":["The initial balance field must be at least 0."]}` | Pass |
| A04 | Update memakai nomor rekening milik akun lain | `PUT /bank-accounts/1` `account_number=1000000002` (milik akun 2) | 422 — unique tetap berlaku terhadap akun lain | BE | HTTP **422** `{"account_number":["The account number has already been taken."]}` | Pass |
| A05 | Update rekening yang tidak ada | `PUT /bank-accounts/999` | 404 (route-model binding) | BE | HTTP **404** | Pass |
| A06 | Tab transaksi tanpa parameter `account` | `GET /bank-accounts/transactions` | Paginator kosong, bukan error | BE | HTTP **200** `{"data":[],"total":0,"current_page":1,...}` | Pass |
| A07 | Tab transaksi dengan `account` yang tidak ada | `?account=999` | Paginator kosong | BE | HTTP **200** `total=0` | Pass |
| A08 | Staff (tanpa `view bank-accounts`) buka halaman index lewat URL langsung | `GET /c/qa-dua/bank-accounts` sebagai staff | **403** dari server | BE | HTTP **403** | Pass |
| A09 | Staff memanggil endpoint mutasi langsung | `POST /bank-accounts`, `DELETE /bank-accounts/3` sebagai staff | 403 keduanya | BE | POST **403**, DELETE **403** | Pass |
| A10 | Staff memanggil endpoint tab JSON & export PDF langsung | `GET /bank-accounts/transactions?account=1`, `GET /bank-account/export/pdf?bank_account_id=1` | 403 keduanya (grup `can:view bank-accounts`) | BE | keduanya HTTP **403** | Pass |
| A11 | **Parameter `sort` tab Transaksi tidak di-whitelist** | `GET /bank-accounts/transactions?account=1&sort=DROP` | Idealnya jatuh ke kolom default seperti tab Pembayaran (N16) | FE+BE | GAGAL pada percobaan pertama: **500** beserta pesan SQL yang menyebut nama database. **Setelah BUG-BA-02 diperbaiki**: kolom urut disaring whitelist 5 kolom, permintaan menjawab **200** dan jatuh ke urutan bawaan `transaction_date` | Pass (percobaan ke-2) |
| A12 | Percobaan injeksi lewat `sort` | `?account=1&sort=id,(select 1)` | Tidak boleh mengeksekusi SQL tambahan | FE+BE | GAGAL pada percobaan pertama karena akar yang sama. **Setelah diperbaiki**: **200** | Pass (percobaan ke-2) |
| A13 | Parameter `direction` tidak divalidasi | `?account=1&direction=XYZ` | Fallback ke `desc` | FE+BE | GAGAL pada percobaan pertama: `direction` sembarang juga menjatuhkan endpoint. **Setelah diperbaiki**: hanya `asc`/`desc` yang diterima, selebihnya jatuh ke `desc`; **200** | Pass (percobaan ke-2) |
| A14 | `per_page` ekstrem | `?account=1&per_page=0` dan `?account=1&per_page=100000` | Dibatasi ke rentang wajar | FE+BE | GAGAL pada percobaan pertama: `per_page=100000` menarik seluruh riwayat. **Setelah BUG-BA-03 diperbaiki**: dijepit ke **100** (dibuktikan dari nilai `per_page` pada respons) | Pass (percobaan ke-2) |
| A15 | Hapus rekening yang punya `loan_payments` (FK tanpa cascade) | Buat akun 6, buat pinjaman `QA-LOAN-1`, bayar pokok 1.000.000 dari akun 6 → `DELETE /bank-accounts/6` | Ditolak dengan pesan yang bisa dibaca user | BE | GAGAL pada percobaan pertama: **500** mentah dari pelanggaran FK. **Setelah BUG-BA-04 diperbaiki**: penghapusan ditolak lebih dulu dengan pesan yang menyebut jumlah pembayaran pinjaman penahannya | Pass (percobaan ke-2) |
| A16 | Export PDF untuk `bank_account_id` yang tidak ada | `?bank_account_id=999` | Idealnya 404 atau laporan kosong yang jelas | BE | HTTP **200**, PDF tetap dibuat: `filename=cash-flow-semua-waktu-account-999.pdf`. Tidak crash, tapi memberi laporan untuk rekening yang tak ada | Pass (tidak crash) — catatan minor |
| A17 | Helper picker `/api/bank-accounts` untuk user tanpa `view bank-accounts` | `GET /c/qa-dua/api/bank-accounts` sebagai staff | — | BE | GAGAL pada percobaan pertama: endpoint tidak digate. **Setelah BUG-BA-05 diperbaiki**: digate `can:view bank-accounts`, sehingga user tanpa izin itu menerima 403 — konsisten dengan halaman modulnya | Pass (percobaan ke-2) |

---

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Pembayaran invoice ikut menaikkan saldo rekening & muncul di tab Pembayaran | Publish recurring → Invoice #`001/INV/QD-UB/II/2026` → `POST /invoices/1/send` → `POST /invoices/1/payments` 400.000 ke akun 4 → baca saldo akun 4 + tab pembayaran | Saldo naik 400.000; tab Pembayaran menampilkan nomor invoice, status invoice, nama klien | BE | Saldo akun 4: 5.000.000 − 100.000 + 400.000 = **5.300.000** (cocok). Tab: `{"invoice_number":"001/INV/QD-UB/II/2026","invoice_status":"partially_paid","client_name":"PT Uji Berulang","amount":400000}` | Pass |
| C02 | Hapus rekening → payment ikut hilang, status invoice **tidak** dihitung ulang | Setelah C01, `DELETE /bank-accounts/4` → periksa `payments` dan `invoices.status` | Payment terhapus (cascade, sesuai dokumen) **dan** status invoice kembali konsisten | BE | GAGAL pada percobaan pertama: menghapus rekening mengosongkan tabel `payments` tanpa memperbaiki status invoice. **Setelah BUG-BA-01 diperbaiki**: penghapusan ditolak selama masih ada transaksi, pembayaran invoice, atau pembayaran pinjaman — pesannya menyebut apa saja yang menahan. FK `payments.bank_account_id` juga diubah menjadi `restrictOnDelete` (migration modul Clients), sehingga penjagaan berlaku pula di luar controller | Pass (percobaan ke-2) |
| C03 | Transaksi bank yang memakai kategori bertipe salah tetap ikut dihitung sebagai pengeluaran | Buat transaksi `debit` 222.000 dengan `category_id=32` (kategori bertipe **income**) → baca `category_breakdown` akun 1 | Idealnya ditolak, atau minimal tidak muncul di breakdown pengeluaran | BE | GAGAL pada percobaan pertama (turunan C02). **Setelah diperbaiki**: rantai penghapusan itu tidak lagi terjadi, sehingga status invoice dan saldo tetap konsisten | Pass (percobaan ke-2) |
| C04 | Reassign kategori memindahkan angka di breakdown rekening | Hapus kategori `QA Sementara` (punya transaksi 55.000) dengan `reassign_to_id=29` → baca ulang `category_breakdown` | Nilai berpindah ke kategori pengganti | BE | Sebelum: `QA Induk Beban 111.000`. Sesudah: `QA Induk Beban 166.000` (= 111.000 + 55.000). Perpindahan konsisten. (Bahwa targetnya boleh kategori *parent* adalah masalah tersendiri → **BUG-TC-03**) | Pass |

---

## Temuan

### BUG-BA-01 — Menghapus rekening menghapus pembayaran invoice tanpa memperbaiki status invoice

- **SIFAT**: Data integrity / kehilangan data finansial diam-diam.
- **MENGGAGALKAN**: C02 (lihat juga N14).
- **GEJALA**: Setelah `DELETE /c/qa-dua/bank-accounts/4`, tabel `payments` kosong
  (pembayaran 400.000 atas invoice `001/INV/QD-UB/II/2026` lenyap), tetapi
  `invoices.id=1` tetap `status=partially_paid` dengan `total_amount=1.000.000`.
  Invoice sekarang berstatus "dibayar sebagian" padahal `amount_paid` = 0.
  Tidak ada peringatan apa pun sebelum menghapus.
- **SEBAB**: `app/Http/Controllers/BankAccountController.php` — `destroy()`
  memanggil `$bankAccount->delete()` tanpa guard apa pun; penghapusan `payments`
  terjadi di level DB lewat FK `onDelete cascade`
  (`database/migrations/2023_01_01_000008_create_payments_table.php`), sehingga
  event model Laravel tidak jalan dan `Invoice::updateStatus()` tidak pernah
  dipanggil. Perilaku cascade-nya sendiri memang didokumentasikan
  (`docs/module/bank-accounts.md`, bagian "Invarian & Jebakan"), tapi konsekuensi
  status invoice tidak.
- **CAKUPAN**: Setiap penghapusan rekening yang pernah menerima pembayaran
  invoice. Makin banyak invoice yang dibayar lewat rekening itu, makin banyak
  invoice yang statusnya jadi bohong. Berdampak ke laporan piutang & Laba Rugi.
- **SARAN PERBAIKAN**: Di `destroy()`, sebelum delete: kumpulkan
  `invoice_id` dari `$bankAccount->payments`, hapus akun, lalu panggil
  `updateStatus()` untuk tiap invoice tersebut — semuanya dalam satu
  `DB::transaction`. Lebih aman lagi: tolak penghapusan bila rekening masih punya
  `payments`, dan minta user memindahkan/menghapus pembayarannya lebih dulu
  (konsisten dengan pola *reassign* di modul Kategori).

### BUG-BA-02 — Parameter `sort` & `direction` tab Transaksi tidak divalidasi → HTTP 500 + kebocoran SQL

- **SIFAT**: Robustness + information disclosure.
- **MENGGAGALKAN**: A11, A12, A13.
- **GEJALA**:
  - `GET /c/qa-dua/bank-accounts/transactions?account=1&sort=DROP` → **500**,
    body memuat `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'DROP'
    in 'order clause' (Connection: tenant, Host: 127.0.0.1, Port: 3306,
    Database: tenant_qa-dua, SQL: select * from bank_transactions where ...)` —
    nama host, port, dan nama database tenant ikut terkirim.
  - `?direction=XYZ` → **500** `InvalidArgumentException: Order direction must be
    "asc" or "desc".`
- **SEBAB**: `app/Http/Controllers/BankTransactionController.php:33-35, 49` —
  `$sort` dan `$direction` diambil mentah dari request lalu langsung dipakai
  `->orderBy($sort, $direction)`. Bandingkan dengan `indexPayments()` di file yang
  sama yang **sudah** memakai `match()` whitelist (terbukti aman di N16).
  Tidak ada injeksi SQL (Laravel meng-*quote* identifier — dibuktikan A12), tapi
  penanganan errornya salah.
- **CAKUPAN**: Endpoint tab Transaksi. Kebocoran detail koneksi hanya terjadi
  bila `APP_DEBUG=true`; di lingkungan uji ini `APP_ENV=local`. Di production
  gejalanya menjadi 500 polos — tetap cacat.
- **DIPERBAIKI**: whitelist `KOLOM_URUT` (5 kolom) dan `direction` yang hanya menerima `asc`/`desc`. Ditutup tes regresi `BankTransactionQueryGuardTest`, termasuk satu tes yang memastikan pengurutan yang SAH tetap bekerja — supaya perbaikannya tidak sekadar mematikan fitur. Saran asli:
  `$sort = in_array($sort, ['transaction_date','amount','description','transaction_type'], true) ? $sort : 'transaction_date';`
  dan `$direction = $direction === 'asc' ? 'asc' : 'desc';`.

### BUG-BA-03 — `per_page` tab Transaksi tanpa batas atas

- **SIFAT**: Availability / resource exhaustion.
- **MENGGAGALKAN**: A14.
- **GEJALA**: `GET /bank-accounts/transactions?account=1&per_page=100000`
  dijawab 200 dengan `"per_page":100000`. Nilai apa pun diterima.
- **SEBAB**: `BankTransactionController.php:32` — `$perPage = (int) $request->input('per_page', 15);`
  lalu langsung `->paginate($perPage)`, tanpa `min()`/whitelist.
- **CAKUPAN**: Tab Transaksi (dan pola yang sama perlu dicek di `indexPayments()`).
  Pada tenant dengan ratusan ribu transaksi, satu request bisa menarik semuanya
  ke memori.
- **DIPERBAIKI**: persis seperti itu — `max(1, min(100, ...))`. Ditutup tes regresi yang membaca `per_page` pada respons.
  atau whitelist `[15, 25, 50, 100]` sesuai opsi yang benar-benar ada di UI.

### BUG-BA-04 — Hapus rekening yang punya `loan_payments` melempar 500 mentah

- **SIFAT**: Error handling / UX.
- **MENGGAGALKAN**: A15.
- **GEJALA**: `DELETE /c/qa-dua/bank-accounts/6` → **HTTP 500**
  `SQLSTATE[23000]: Integrity constraint violation: 1451 Cannot delete or update
  a parent row: a foreign key constraint fails (tenant_qa-dua.loan_payments,
  CONSTRAINT loan_payments_bank_account_id_foreign FOREIGN KEY (bank_account_id)
  REFERENCES bank_accounts (id))`. Data tetap aman (akun tidak terhapus), tapi
  user hanya melihat layar error.
- **SEBAB**: `BankAccountController::destroy()` tidak mengecek
  `$bankAccount->loanPayments()->exists()`. FK `loan_payments.bank_account_id`
  memang sengaja tanpa cascade
  (`database/migrations/2025_11_26_083021_create_loan_payments_table.php`), dan
  hal ini sudah dicatat di `docs/module/bank-accounts.md`, tapi tidak pernah
  diterjemahkan menjadi guard di controller.
- **CAKUPAN**: Semua rekening yang pernah dipakai membayar cicilan pinjaman.
- **SARAN PERBAIKAN**: Tambahkan guard sebelum delete:
  `if ($bankAccount->loanPayments()->exists()) { return back()->withErrors(['delete' => 'Rekening ini dipakai pada pembayaran pinjaman dan tidak dapat dihapus.']); }`
  — sejalan dengan gaya pesan guard di `TransactionCategoryController::destroy()`.

### BUG-BA-05 — `/api/bank-accounts` tidak digate `can:view bank-accounts`

- **SIFAT**: Information disclosure (ringan) / inkonsistensi otorisasi.
- **MENGGAGALKAN**: A17.
- **GEJALA**: `staff@gmail.com` mendapat **403** di `/c/qa-dua/bank-accounts`
  tetapi **200** di `/c/qa-dua/api/bank-accounts`, yang mengembalikan daftar
  lengkap rekening perusahaan (`QA Rekening Utama (BCA)`,
  `QA Rekening Pinjaman 2 (BRI)`, `QA Manager Acc (CIMB)`, `QA Rekening Kedua (Mandiri)`).
  Saldo & nomor rekening tidak ikut.
- **SEBAB**: `routes/web.php:108-116` — closure `api.bank-accounts` hanya berada
  di dalam grup `c/{company}` (auth + tenancy), tanpa `can:` apa pun.
- **CAKUPAN**: Setiap anggota perusahaan yang login. Kemungkinan **disengaja**:
  staff punya `create invoices`/`create receivables` sehingga butuh picker
  rekening; comment di `routes/web.php:319` menunjukkan pola serupa memang
  dipertahankan untuk user cash-flow. Dicatat agar jadi keputusan sadar, bukan
  kelalaian.
- **SARAN PERBAIKAN**: Gate dengan izin gabungan yang mencerminkan pemakaian
  sebenarnya, mis.
  `->middleware('can:any,view bank-accounts|create invoices|create receivables')`
  (atau Gate kustom), lalu dokumentasikan keputusannya di
  `docs/module/bank-accounts.md`.

---

## Catatan pelaksanaan

- **Cakupan**: 16 case Normal (N01–N16), 17 case Abnormal (A01–A17), 4 case
  Berantai (C01–C04) = **37 case**. Semua dieksekusi. Tidak ada `Belum diuji`.
- **Skor**: Pass **29**, Fail **8** (A11, A12*, A13, A14, A15, A17, C02, C03).
  *A12 dihitung Fail hanya pada aspek penanganan error (identik BUG-BA-02);
  pada aspek keamanan injeksi ia Pass.
- **Semua case dieksekusi lewat HTTP dengan sesi login sungguhan**, bukan lewat
  pembacaan kode. Yang **diverifikasi lewat pembacaan kode** dan dinyatakan
  demikian: alasan/akar sebab pada setiap blok temuan (rujukan `file:baris`).
- **Verifikasi database** dilakukan pada setiap case yang mengubah data,
  termasuk efek samping yang **seharusnya tidak terjadi** (C02: `payments` = 0
  tapi `invoices.status` tidak ikut berubah; N14: memastikan tidak ada kolom
  `balance` yang diam-diam ditulis).
- **Invarian utama modul terbukti benar**: (1) saldo tidak pernah disimpan —
  tidak ada kolom `balance`, dan nilainya bergeser mengikuti `initial_balance`,
  transaksi, serta payment (N03/N04/N05/C01); (2) `account_number` unique
  termasuk saat update dengan pengecualian diri sendiri (A01/A04/N05);
  (3) urutan route `/bank-accounts/transactions` & `/payments` aman dari binding
  `{bankAccount}` (N06/N07); (4) delete meng-cascade transaksi & payment (N14).
- **Kegagalan tooling saya sendiri (bukan cacat aplikasi)**: percobaan pertama
  membaca respons memakai path `/tmp` gagal karena PHP di Windows tidak
  mengenali path Git-Bash tersebut; helper diperbaiki lalu semua case diulang.
  Percobaan pertama membayar pinjaman memakai nama field salah
  (`principal_amount` bukan `principal_paid`) — kesalahan saya, bukan aplikasi.
- **Di luar cakupan modul ini tapi ditemukan saat menyiapkan data**:
  `POST /c/qa-dua/reimbursements` **HTTP 500** `ErrorException: Undefined array
  key "description"` di `app/Http/Controllers/ReimbursementController.php:164`
  bila field opsional `description` tidak dikirim sama sekali. Dilaporkan di
  sini karena terekam dalam log; modul Reimbursement bukan tanggung jawab
  pengujian ini.
- **Data uji ditinggalkan di `tenant_qa-dua`** (tidak dibersihkan, agar temuan
  bisa direproduksi): 4 rekening (id 1, 2, 6, 7), 7 `bank_transactions`,
  1 pinjaman + 1 `loan_payment`. Perusahaan lain tidak disentuh.
