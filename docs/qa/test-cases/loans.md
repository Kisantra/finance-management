# Test Case — Loans (Utang Perusahaan)

Sumber teknis: [`docs/module/loans.md`](../../module/loans.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-empat` (DB `tenant_qa-empat`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

Tanggal eksekusi: **2026-08-19**. Akun: `admin@gmail.com` (create/edit/delete),
`manager@gmail.com` (pay), `staff@gmail.com` (kontrol permission — role `staff`
TIDAK punya permission loans sama sekali).
Rekening: `QA Ops` (id 1, saldo awal Rp 500.000.000), `QA Cadangan` (id 2, saldo
awal Rp 100.000.000). Kategori sistem tenant: `FIN-LOAN-IN` id 7, `FIN-LOAN-OUT`
id 8, `EXP-INTEREST` id 13.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat pinjaman bunga `fixed` → otomatis mencatat dana masuk | `POST /c/qa-empat/loans` sebagai admin: `loan_number=LOAN-00001`, lender `Bank QA Sejahtera`, `principal_amount=100000000`, `interest_type=fixed`, `interest_amount=12000000`, `term_months=12`, `start_date=2026-08-01`, `maturity_date=2027-08-01`, `bank_account_id=1` | 302; loan `status=active`; 1 `BankTransaction` **credit** 100.000.000 tanggal `2026-08-01`, kategori `FIN-LOAN-IN`, `reference_number=LOAN-00001` | BE | 302. Loan id 1 `status=active`, `interest_amount=12000000`, `interest_rate=NULL`. `bank_transactions` id 5: `credit`, `amount=100000000`, `transaction_date=2026-08-01`, **`category_id=7`** (terisi, bukan NULL), `description=Penerimaan pinjaman dari Bank QA Sejahtera`, `reference_number=LOAN-00001` | Pass |
| N02 | Buat pinjaman bunga `percentage` — field bunga saling eksklusif | POST `loan_number=LOAN-00002`, lender `Koperasi QA`, `principal_amount=60000000`, `interest_type=percentage`, `interest_rate=12`, `term_months=6`, `bank_account_id=2` | `interest_rate=12.00`, `interest_amount=NULL`; credit `FIN-LOAN-IN` di rekening 2 | BE | 302. Loan id 2: `interest_rate=12.00`, `interest_amount=NULL`. `bank_transactions` id 6: credit 60.000.000, `category_id=7`, rekening 2 | Pass |
| N03 | Index menghitung sisa pokok & prefill nomor | GET `/c/qa-empat/loans` sebagai admin | Props memuat `remaining_principal`, `paid_principal`, `paid_interest`, `nextLoanNumber` | BE | Props baris LOAN-00002: `"paid_principal":0,"paid_interest":0,"remaining_principal":60000000`; `"nextLoanNumber":"LOAN-00001"` saat tabel masih kosong | Pass |
| N04 | Bayar pokok + bunga → DUA transaksi bank terpisah | `POST /loans/1/pay` sebagai manager: `bank_account_id=1`, `payment_date=2026-08-10`, `principal_paid=20000000`, `interest_paid=1000000`, `reference_number=ANG-01` | 2 tx debit: 20.000.000 kategori `FIN-LOAN-OUT`, 1.000.000 kategori `EXP-INTEREST`; 1 baris `loan_payments` dengan `total_paid=21000000` | BE | 302. `bank_transactions` id 7 (`debit` 20.000.000, `category_id=8`, `Pembayaran pokok pinjaman - Bank QA Sejahtera`) dan id 8 (`debit` 1.000.000, `category_id=13`, `Pembayaran bunga pinjaman - ...`). `loan_payments` id 1: `principal_paid=20000000`, `interest_paid=1000000`, `total_paid=21000000` | Pass |
| N05 | Bayar pokok saja → hanya satu transaksi | `POST /loans/1/pay`: `principal_paid=10000000` (tanpa `interest_paid`) | Hanya 1 tx debit `FIN-LOAN-OUT` | BE | 302. Hanya `bank_transactions` id 9 (debit 10.000.000, `category_id=8`). `loan_payments` id 2 `interest_paid=0` | Pass |
| N06 | Pelunasan pokok tepat → `active` → `paid_off` otomatis | `POST /loans/2/pay`: `principal_paid=60000000` (= pokok penuh) | Status berubah `paid_off` tanpa aksi manual | BE | 302. Loan id 2: `status=paid_off`, akumulasi pokok 60.000.000, sisa 0 | Pass |
| N07 | Edit pinjaman `active` | `PUT /loans/3`: lender `Investor QA Revisi`, `principal_amount` 25.000.000 → 90.000.000, `interest_type` `fixed` → `percentage` `9.5` | Field terbarui; `interest_amount` di-NULL-kan | BE | 302. Loan id 3: `lender_name=Investor QA Revisi`, `principal_amount=90000000`, `interest_type=percentage`, `interest_rate=9.50`, `interest_amount=NULL` | Pass |
| N08 | Hapus pinjaman yang belum punya pembayaran | `DELETE /loans/3` sebagai admin | 302; record hilang | BE | 302; loan id 3 hilang dari tabel | Pass |
| N09 | Rumus bunga `percentage` = pokok × rate% / 12 × tenor | Loan id 2: 60.000.000 × 12% / 12 × 6 = Rp 3.600.000 | BE dan FE memakai rumus yang sama | BE | **Diverifikasi lewat baca kode, bukan lewat output aplikasi**: `LoanController.php:205-207` dan `resources/js/pages/loans/index.tsx:659-663` identik. Nilai total bunga tidak dikirim sebagai prop sehingga tidak bisa dibuktikan dari respons; secara tidak langsung dikonfirmasi A07 (bayar bunga 5.000.000 > 3.600.000 tetap diterima karena tidak ada cap) | Pass (verifikasi kode) |
| N10 | Daftar pinjaman terbuka dengan ringkasan pokok, bunga, dan sisa | Admin buka menu Pinjaman | Daftar dan ringkasan tampil | FE+BE | Tampil | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Nomor pinjaman duplikat | POST dengan `loan_number=LOAN-00001` yang sudah ada | 422 unique | BE | 422 `{"loan_number":["The loan number has already been taken."]}` | Pass |
| A02 | `maturity_date` = `start_date` | POST `start_date=2026-08-01`, `maturity_date=2026-08-01` | 422 `after:start_date` | BE | 422 `{"maturity_date":["The maturity date field must be a date after start date."]}` | Pass |
| A03 | Pokok 0 | POST `principal_amount=0` | 422 min 1 | BE | 422 `{"principal_amount":["The principal amount field must be at least 1."]}` | Pass |
| A04 | Rekening penampung tidak dikirim | POST tanpa `bank_account_id` | 422 required | BE | 422 `{"bank_account_id":["The bank account id field is required."]}` | Pass |
| A05 | Bayar dengan pokok = 0 DAN bunga = 0 | `POST /loans/1/pay` `principal_paid=0&interest_paid=0` | Ditolak dengan pesan | BE | 302 + `errors: {"principal_paid":"Minimal salah satu harus diisi: Pembayaran Pokok atau Bunga"}`; tidak ada baris pembayaran/tx baru | Pass |
| A06 | Tanggal bayar di masa depan | pay `payment_date=2027-01-01` | 422 | BE | 422 `{"payment_date":["The payment date field must be a date before or equal to today."]}` | Pass |
| A07 | **Bayar bunga melebihi total bunga** | Loan id 2 total bunga Rp 3.600.000 → pay `interest_paid=5000000` | Idealnya ditolak/dibatasi | FE+BE | 302 — DITERIMA penuh. `loan_payments` id 3 `interest_paid=5000000`; `bank_transactions` id 10 debit 5.000.000 kategori `EXP-INTEREST`. Label FE `Pembayaran Bunga (maks. Rp 3.600.000)` hanya kosmetik | **Fail** (BUG-L1) |
| A08 | **Bayar pokok melebihi sisa pokok** | Loan id 1 sisa pokok 70.000.000 → pay `principal_paid=100000000` | Idealnya ditolak/di-clamp | FE+BE | 302 — DITERIMA. Akumulasi pokok terbayar 130.000.000 atas pokok 100.000.000 → **sisa −30.000.000**, `status=paid_off`. `bank_transactions` id 12 mendebit rekening penuh 100.000.000 | **Fail** (BUG-L1) |
| A09 | Bayar pinjaman yang sudah `paid_off` | `POST /loans/2/pay` setelah lunas | 403 | BE | 403 `{"message":"Pinjaman ini tidak dapat dibayar"}` | Pass |
| A10 | Edit pinjaman yang sudah `paid_off` | `PUT /loans/2` | 403 | BE | 403 `{"message":"Pinjaman yang sudah lunas tidak dapat diedit"}` | Pass |
| A11 | Hapus pinjaman yang sudah punya pembayaran | `DELETE /loans/1` | 403 | BE | 403 `{"message":"Pinjaman yang sudah memiliki pembayaran tidak dapat dihapus"}` | Pass |
| A12 | Staff (tanpa `view loans`) mengakses modul | `GET /c/qa-empat/loans` sebagai staff | 403 | BE | 403 | Pass |
| A13 | **Prefill `nextLoanNumber` bentrok dengan nomor yang sudah dipakai** | Buat loan bernomor manual `LOAN-00006` (mendapat id 5) → GET index → submit form dengan `loan_number` = nilai prefill apa adanya | Prefill seharusnya selalu berupa nomor yang bebas | BE | Prefill yang dikirim server = `LOAN-00006`, padahal nomor itu sudah dipakai loan id 5. Submit apa adanya → 422 `{"loan_number":["The loan number has already been taken."]}`. User harus mengarang nomor sendiri | **Fail** (BUG-L2) |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Siklus penuh: terima pinjaman → 2× angsuran → pelunasan otomatis, kas terekonsiliasi | Loan id 2: create (credit 60.000.000 ke rek 2) → pay bunga 5.000.000 → pay pokok 60.000.000 → cek saldo | Saldo rekening = saldo awal + credit − seluruh debit; status `paid_off` | BE | Rekening `QA Cadangan`: 100.000.000 + 60.000.000 − 5.000.000 − 60.000.000 − 200.000 (tx reimbursement) = **94.800.000**; props aplikasi menunjukkan `balance=94800000`. Rekening `QA Ops` juga cocok persis (505.200.000). Status loan id 2 `paid_off` | Pass |
| C02 | **Edit pinjaman tidak mengoreksi mutasi bank** | Loan id 3: create `principal_amount=25000000` (credit 25.000.000 tercatat) → edit menjadi 90.000.000 & lender `Investor QA Revisi` → cek `bank_transactions` | Idealnya mutasi ikut dikoreksi atau perubahan pokok dilarang setelah dana masuk | BE | Loan menjadi Rp 90.000.000 atas nama `Investor QA Revisi`, tetapi `bank_transactions` id 13 tetap `amount=25000000` dengan deskripsi `Penerimaan pinjaman dari Investor QA` (nama lama). Buku kas dan catatan utang berbeda Rp 65.000.000 | **Fail** (BUG-L3, invarian terdokumentasi) |
| C03 | **Hapus pinjaman meninggalkan dana masuk yatim** | `DELETE /loans/3` (belum ada pembayaran) → cek `bank_transactions` | — | BE | Loan hilang, tetapi `bank_transactions` id 13 (credit Rp 25.000.000, kategori `FIN-LOAN-IN`, `reference_number=LOAN-00003`) tetap ada. Saldo `QA Ops` tetap naik 25.000.000 tanpa utang yang menaunginya | **Fail** (BUG-L3, invarian terdokumentasi) |
| C04 | Bunga pinjaman masuk Laporan Laba Rugi sebagai "Beban Lain" | `GET /c/qa-empat/reports/profit-loss?start=2026-08-01&end=2026-08-31` setelah membayar bunga | Kategori `EXP-INTEREST` muncul di `other_expense`; pokok (`financing`) tidak masuk P&L | BE | Pokok memang tidak masuk P&L (benar), tetapi `other_expense.by_category` **kosong** — `Beban Bunga Pinjaman` (kategori id 13) muncul di blok **`unclassified.expense`**, bukan "Beban Lain" | **Fail** (BUG-L4) |

## Temuan

### BUG-L1 — Tidak ada batas atas pembayaran pokok maupun bunga
- **SIFAT**: Cacat validasi / kebocoran uang.
- **MENGGAGALKAN**: A07, A08.
- **GEJALA**: Loan id 1 (pokok Rp 100.000.000) menerima total pembayaran pokok Rp 130.000.000 → sisa pokok tercatat **−30.000.000** dan status langsung `paid_off`. Loan id 2 (total bunga Rp 3.600.000) menerima pembayaran bunga Rp 5.000.000. Semua nominal berlebih ikut mendebit rekening bank secara penuh.
- **SEBAB**: `app/Http/Requests/PayLoanRequest.php` hanya memberi `nullable|integer|min:0` pada `principal_paid`/`interest_paid`. `app/Http/Controllers/LoanController.php:202-212` menghitung `$remainingPrincipal` dan `$remainingInterest` tetapi **tidak pernah memakainya untuk memvalidasi** — hanya `$remainingPrincipal` yang dipakai di baris 258 untuk menentukan `paid_off`. Di frontend, `resources/js/pages/loans/index.tsx:731` menulis label "maks." tanpa atribut/validasi apa pun.
- **CAKUPAN**: Semua user dengan permission `pay loans` (admin, finance manager). Dampak: kas keluar melebihi kewajiban, laporan sisa pokok bernilai negatif, beban bunga di P&L membengkak.
- **SARAN PERBAIKAN**: Validasi di controller (atau `withValidator` pada `PayLoanRequest` yang membaca route model binding): tolak bila `principal_paid > remainingPrincipal` atau `interest_paid > remainingInterest`, dengan pesan yang menyebut sisa aktual. Bila overpayment memang sah secara bisnis (penalti/denda), pisahkan ke field/kategori tersendiri.

### BUG-L2 — Prefill `nextLoanNumber` bisa bentrok dengan nomor yang sudah ada
- **SIFAT**: Cacat kegunaan (usability) / logika generator.
- **MENGGAGALKAN**: A13.
- **GEJALA**: Setelah ada loan bernomor `LOAN-00006` dengan `id=5`, server mengirim `nextLoanNumber = "LOAN-00006"`. Form yang disubmit apa adanya ditolak 422 `The loan number has already been taken.`
- **SEBAB**: `app/Http/Controllers/LoanController.php:267-273` `generateLoanNumber()` menurunkan nomor dari **`id` terakhir + 1**, bukan dari nomor terbesar yang sudah dipakai. Karena `loan_number` boleh diketik manual (dan record boleh dihapus), urutan `id` dan urutan nomor bisa berbeda.
- **CAKUPAN**: Setiap perusahaan yang pernah mengetik nomor pinjaman manual atau menghapus pinjaman. Bukan korupsi data — validasi `unique` tetap jadi penjaga terakhir — tetapi menghambat alur create.
- **SARAN PERBAIKAN**: Turunkan nomor dari `MAX(CAST(SUBSTRING(loan_number, 6) AS UNSIGNED))` + 1, dan/atau ulangi increment sampai menemukan nomor yang belum dipakai.

### BUG-L3 — Edit & hapus pinjaman tidak mengoreksi mutasi bank
- **SIFAT**: Inkonsistensi data lintas modul (invarian terdokumentasi, terbukti).
- **MENGGAGALKAN**: C02, C03.
- **GEJALA**: (a) Pokok diubah 25.000.000 → 90.000.000 dan lender diganti, tetapi `bank_transactions` id 13 tetap `amount=25000000` dengan deskripsi nama lender lama. (b) Pinjaman dihapus, transaksi credit Rp 25.000.000 tetap tinggal sebagai dana masuk tanpa sumber; saldo rekening tetap membesar.
- **SEBAB**: `LoanController::update()` (baris 149-183) hanya memanggil `$loan->update(...)`; `LoanController::destroy()` (baris 185-196) hanya menghapus loan + lampiran. Tidak ada relasi/hook antara `Loan` dan `BankTransaction` (keterkaitan hanya lewat `reference_number` berupa string).
- **CAKUPAN**: Role dengan `edit loans` / `delete loans` (admin, finance manager). Dampak: saldo bank dan Cash Flow tidak lagi bisa direkonsiliasi dengan daftar pinjaman.
- **SARAN PERBAIKAN**: Simpan FK `bank_transaction_id` pada `loans` saat pencairan, lalu (a) sinkronkan `amount`/`description`/`transaction_date` saat update, dan (b) hapus atau buat transaksi pembalik saat destroy — semuanya dalam satu `DB::transaction`. Alternatif minimal: larang mengubah `principal_amount`/`start_date` setelah pencairan dan tampilkan peringatan eksplisit saat menghapus.

### BUG-L4 — Beban bunga pinjaman tidak masuk baris "Beban Lain" di Laporan Laba Rugi
- **SIFAT**: Cacat konfigurasi data awal (seeder) dengan dampak pelaporan.
- **MENGGAGALKAN**: C04.
- **GEJALA**: Setelah pembayaran bunga Rp 6.000.000 (1.000.000 + 5.000.000), P&L periode Agustus 2026 menampilkan `other_expense.by_category = []` dan `other_expense.total = 0`; kategori `Beban Bunga Pinjaman` (id 13) justru muncul di blok `unclassified.expense`.
- **SEBAB**: `database/seeders/TransactionCategorySeeder.php:27-28` membuat `EXP-INTEREST` dan `REV-INTEREST` **tanpa `pl_group`**. Di `tenant_qa-empat` kolom `pl_group` kedua kategori itu NULL, sedangkan `docs/module/loans.md` menyatakan `EXP-INTEREST` "(expense, `pl_group=other_expense`) masuk baris Beban Lain".
- **CAKUPAN**: Setiap tenant yang baru di-provisioning (kategori sistem dibuat oleh seeder yang sama). Pengaruhnya ke seluruh modul yang mengandalkan kategori sistem bunga — Loans dan Receivables.
- **SARAN PERBAIKAN**: Isi `pl_group` di seeder (`other_expense` untuk `EXP-INTEREST`, `other_income` untuk `REV-INTEREST`) dan tambahkan migrasi/backfill untuk tenant yang sudah ada. Bila memang disengaja agar admin yang menetapkan, perbarui `docs/module/loans.md` dan `receivables.md` agar tidak menjanjikan hal yang tidak terjadi.

## Catatan pelaksanaan

- Semua case dieksekusi lewat HTTP `http://127.0.0.1:8000` dengan cookie sesi
  sungguhan, lalu diverifikasi ke DB `tenant_qa-empat` (tabel `loans`,
  `loan_payments`, `bank_transactions`, `bank_accounts`).
- N09 adalah satu-satunya case yang **tidak** dapat dibuktikan dari output
  aplikasi: total bunga tidak dikirim sebagai prop Inertia dan tidak disimpan di
  DB, sehingga verifikasi dilakukan dengan membaca kode BE dan FE. Ditandai
  eksplisit sebagai "Pass (verifikasi kode)", bukan Pass hasil observasi.
- Regresi lama yang dicek ulang: `category_id` pada transaksi pinjaman **terisi**
  di semua kasus (7 untuk pencairan, 8 untuk pokok, 13 untuk bunga) — tidak ada
  NULL. Bug lookup kolom `code` yang tercatat "DIPERBAIKI 2026-08-11" tidak
  muncul lagi.
- Efek samping yang SEHARUSNYA TIDAK terjadi ikut diperiksa: A05 (0/0 tidak
  membuat baris `loan_payments` maupun `bank_transactions`), A09/A10/A11 (403
  tanpa mutasi), N05 (bayar pokok saja hanya menghasilkan satu transaksi, tidak
  ada tx bunga bernilai 0).
- Rekonsiliasi saldo dilakukan dua arah: nilai `balance` dari props aplikasi
  dibandingkan dengan `initial_balance + Σcredit − Σdebit` yang dihitung ulang
  lewat SQL. Keduanya identik untuk kedua rekening.
- Data uji yang tertinggal sebagai bukti: loan id 1 (`paid_off`, pokok terbayar
  130.000.000), id 2 (`paid_off`), id 4 & 5 (`active`), serta `bank_transactions`
  id 5-14 termasuk id 13 yang yatim (BUG-L3).
- Tidak ada perubahan kode aplikasi, migrasi, seeding, atau `.env` selama
  pengujian. Rekening bank dan klien uji dibuat lewat endpoint aplikasi biasa.
