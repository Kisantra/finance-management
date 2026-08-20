# Test Case — Receivables (Piutang)

Sumber teknis: [`docs/module/receivables.md`](../../module/receivables.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-empat` (DB `tenant_qa-empat`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

Tanggal eksekusi: **2026-08-19** (`CURDATE()` server = `2026-08-19`).
Akun: `staff@gmail.com` (id 3 — `view`+`create` receivables), `manager@gmail.com`
(id 2 — approve & pay), `admin@gmail.com` (id 1 — edit & delete).
Debitur uji: User id 3 `Staff Demo` (employee_loan) dan Client id 1
`PT QA Empat Debitur` (`type=company`, `status=Active`). Rekening: `QA Ops` (id 1),
`QA Cadangan` (id 2). Kategori sistem: `FIN-RCV-OUT` id 11, `FIN-RCV-IN` id 12,
`REV-INTEREST` id 14.

> **Catatan metode penting.** Case A13/A14 membuktikan bahwa `store()` dan
> `update()` **selalu HTTP 500** bila `installment_months` dikirim sebagai string —
> yaitu persis bentuk yang dikirim form React (`forceFormData: true`). Agar sisa
> alur (submit → approve → pay) tetap bisa diuji, case lain dijalankan dengan body
> **JSON** sehingga `installment_months` terkirim sebagai angka. Hal ini dinyatakan
> eksplisit dan tidak dianggap sebagai jalur pemakaian normal.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat piutang karyawan (`employee_loan`) — debitur polimorfik ke `User` | `POST /c/qa-empat/receivables` (JSON) sebagai staff: `type=employee_loan`, `debtor_id=3`, `principal_amount=6000000`, `interest_type=fixed`, `interest_amount=600000`, `installment_months=6`, `loan_date=2026-07-01`, purpose & `disbursement_account` terisi | 302; `status=draft`; `debtor_type=App\Models\User`; belum ada mutasi bank | BE | 302. DB id 1 `RCV-00001`: `debtor_type=App\Models\User`, `debtor_id=3`, `status=draft`. Tidak ada `bank_transactions` baru | Pass |
| N02 | Buat piutang perusahaan (`company_loan`) — debitur polimorfik ke `Client` | POST JSON: `type=company_loan`, `debtor_id=1`, `principal_amount=40000000`, `interest_type=percentage`, `interest_rate=5`, `installment_months=10`, `loan_date=2026-06-15` | `debtor_type=App\Models\Client`; `installment_amount` & `due_date` terhitung | BE | 302. DB id 2 `RCV-00002`: `debtor_type=App\Models\Client`, `debtor_id=1`, `interest_rate=5.00` | Pass |
| N03 | Perhitungan cicilan & jatuh tempo | Verifikasi hasil N01 & N02 | N01: bunga 600.000 → rate 10,00; cicilan (6.000.000+600.000)/6 = 1.100.000; due = 2026-07-01 +6 bln = 2027-01-01. N02: bunga 5% = 2.000.000; cicilan (40.000.000+2.000.000)/10 = 4.200.000; due = 2027-04-15 | BE | Persis sesuai: id 1 `interest_rate=10.00`, `installment_amount=1100000`, `due_date=2027-01-01`; id 2 `installment_amount=4200000`, `due_date=2027-04-15` | Pass |
| N04 | Ajukan persetujuan (submit) — tanpa permission khusus | `POST /receivables/1/submit` & `/receivables/2/submit` sebagai staff (hanya punya `view`+`create`) | 302; `status=pending_approval` | BE | 302 keduanya; `status=pending_approval`. Sesuai dokumentasi: route submit hanya digate `can:view receivables` | Pass |
| N05 | Approve → pencairan otomatis debit `FIN-RCV-OUT` | `POST /receivables/1/approve` sebagai manager: `action=approve`, `bank_account_id=1`, `notes=Disetujui QA N04` | `status=active`, `approved_by=2`, `approved_at` terisi, `review_notes` tersimpan; 1 `BankTransaction` **debit** 6.000.000 kategori 11 | BE | 302. DB id 1: `status=active`, `approved_by=2`, `approved_at=2026-08-19 14:41:21`, `review_notes=Disetujui QA N04`. `bank_transactions` id 16: `debit` 6.000.000, `category_id=11`, `description=Piutang diberikan: RCV-00001 - Staff Demo`, `reference_number=RCV-00001` | Pass |
| N06 | Tolak (reject) — jejak penolak tersimpan, tanpa mutasi bank | `POST /receivables/2/approve`: `action=reject`, `notes=Plafon klien terlampaui` | `status=rejected`, `rejection_reason` terisi, `approved_by/at` terisi; tidak ada `bank_transactions` baru | BE | 302. DB id 2: `status=rejected`, `rejection_reason=Plafon klien terlampaui`, `approved_by=2`, `approved_at=2026-08-19 14:42:06`. Tidak ada mutasi bank | Pass |
| N07 | Cicilan `bank_transfer` → dua kredit masuk (pokok + bunga) | `POST /receivables/1/pay`: `payment_method=bank_transfer`, `bank_account_id=1`, `payment_date=2026-08-10`, `principal_paid=1000000`, `interest_paid=100000` | 2 tx **credit**: pokok kategori `FIN-RCV-IN`, bunga kategori `REV-INTEREST` | BE | 302. `bank_transactions` id 17 (credit 1.000.000, `category_id=12`, `Pembayaran piutang pokok: RCV-00001 - Staff Demo`) dan id 18 (credit 100.000, `category_id=14`, `Pembayaran bunga piutang: ...`) | Pass |
| N08 | Cicilan `cash` TIDAK menyentuh saldo | pay `payment_method=cash`, `principal_paid=1000000`, `interest_paid=100000`, `payment_date=2026-08-11` | Baris `receivable_payments` tercatat; **nol** `bank_transactions` baru | BE | 302. `receivable_payments` id 2 tercatat (`payment_method=cash`); tidak ada `bank_transactions` baru sama sekali | Pass |
| N09 | Cicilan `payroll_deduction` TIDAK menyentuh saldo | pay `payment_method=payroll_deduction`, `principal_paid=1000000`, `payment_date=2026-08-12` | Sama seperti N08 | BE | 302. `receivable_payments` id 3 tercatat; tidak ada `bank_transactions` baru | Pass |
| N10 | Pelunasan pokok → `paid_off` otomatis | Setelah akumulasi pokok ≥ `principal_amount` (lihat A08) | `status=paid_off` | BE | DB id 1 `status=paid_off` setelah akumulasi pokok 13.500.000 ≥ 6.000.000 | Pass |
| N11 | Edit piutang yang ditolak → status kembali `draft` | `PUT /receivables/2` (JSON) sebagai admin: pokok 40.000.000 → 30.000.000, rate 6%, tenor 12 bln | `status=draft`, `rejection_reason=NULL`, cicilan & due_date dihitung ulang | BE | 302. DB id 2: `status=draft`, `rejection_reason=NULL`, `interest_rate=6.00`, `installment_amount=2650000` ((30.000.000+1.800.000)/12), `due_date=2027-06-15`. **Namun `approved_by=2` dan `approved_at=2026-08-19 14:42:06` tidak dibersihkan** — lihat C02 | Pass (dengan catatan) |
| N12 | Hapus piutang berstatus `draft` tanpa pembayaran | `DELETE /receivables/3` dan `/receivables/2` sebagai admin | 302; record hilang | BE | 302 keduanya; id 2 & 3 hilang dari tabel | Pass |
| N13 | Staff bisa membuka index piutang | `GET /c/qa-empat/receivables` sebagai staff | 200 (staff punya `view receivables`) | BE | 200 | Pass |
| N14 | Daftar piutang terbuka dengan debitur polimorfik | Admin buka menu Piutang | Daftar tampil; kolom debitur menampilkan User maupun Klien | FE+BE | Tampil | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Approve tanpa memilih rekening sumber | `POST /receivables/1/approve` `action=approve` tanpa `bank_account_id` | 422 `required_if` | FE+BE | 422 `{"bank_account_id":["The bank account id field is required when action is approve."]}` | Pass |
| A02 | Submit pada status non-`draft` | `POST /receivables/1/submit` saat sudah `pending_approval` | 403 | BE | 403 `{"message":"Piutang ini tidak dapat diajukan"}` | Pass |
| A03 | Approve pada status non-`pending_approval` | `POST /receivables/3/approve` saat masih `draft` | 403 | BE | 403 `{"message":"Piutang ini tidak dapat diproses"}` | Pass |
| A04 | Bayar piutang yang sudah `paid_off` | `POST /receivables/1/pay` setelah lunas | 403 | BE | 403 `{"message":"Piutang ini tidak dapat dibayar"}` | Pass |
| A05 | Hapus piutang non-`draft` | `DELETE /receivables/1` (status `paid_off`) | 403 | BE | 403 `{"message":"Piutang ini tidak dapat dihapus"}` | Pass |
| A06 | Staff (tanpa `approve receivables`) menyetujui | `POST /receivables/1/approve` sebagai staff | 403 | BE | 403 `This action is unauthorized.` | Pass |
| A07 | Staff (tanpa `edit receivables`) mengedit | `PUT /receivables/1` sebagai staff | 403 | BE | 403 `This action is unauthorized.` | Pass |
| A08 | Bayar dengan pokok = 0 DAN bunga = 0 | pay `principal_paid=0&interest_paid=0` | Ditolak dengan pesan | BE | 302 + `errors: {"principal_paid":"Minimal salah satu harus diisi: Pembayaran Pokok atau Bunga"}`; tidak ada baris/tx baru | Pass |
| A09 | **Pembayaran pokok melebihi sisa** | Piutang id 1 sisa pokok Rp 2.500.000 → pay `principal_paid=10000000` via `bank_transfer` | Idealnya ditolak/di-clamp | BE | GAGAL pada percobaan pertama: pembayaran pokok melebihi sisa diterima. **Setelah BUG-C1 diperbaiki**: ditolak dengan menyebut sisa aktual | Pass (percobaan ke-2) |
| A10 | **`payment_method=bank_transfer` tanpa `bank_account_id`** | pay `payment_method=bank_transfer`, `principal_paid=500000`, tanpa `bank_account_id` | Ditolak (rekening wajib untuk transfer) | FE+BE | GAGAL pada percobaan pertama: metode transfer tanpa rekening tersimpan diam-diam **tanpa** mutasi bank — piutang berkurang tetapi uangnya tidak tercatat masuk ke mana pun. **Setelah BUG-C2 diperbaiki**: `required_if:payment_method,bank_transfer` dengan pesan berbahasa Indonesia | Pass (percobaan ke-2) |
| A11 | **`debtor_id` menunjuk ID yang tidak ada** | POST JSON `type=employee_loan`, `debtor_id=99999` | 422 (debitur tidak valid) | BE | GAGAL pada percobaan pertama: `debtor_id` hanya divalidasi `integer`, sehingga id yang tidak ada tetap diterima dan relasi polimorfiknya menunjuk entah ke mana. **Setelah BUG-C3 diperbaiki**: keberadaan debitur diperiksa sesuai jenis piutangnya | Pass (percobaan ke-2) |
| A12 | **`debtor_id` menunjuk entitas dari kelas yang salah** | POST JSON `type=employee_loan`, `debtor_id=1` (bermaksud Client id 1 `PT QA Empat Debitur`) | Idealnya divalidasi terhadap daftar debitur yang sah | BE | GAGAL pada percobaan pertama karena akar yang sama. **Setelah diperbaiki**: ditolak dengan pesan yang menyebut karyawan/klien sesuai jenisnya. Ditutup dua tes regresi | Pass (percobaan ke-2) |
| A13 | **`installment_months` sebagai string (bentuk yang dikirim form) pada create** | `POST /c/qa-empat/receivables` form-encoded/multipart dengan `installment_months=6` | Tersimpan seperti biasa | BE | HTTP **500** — `Carbon\Carbon::rawAddUnit(): Argument #3 ($value) must be of type int\|float, string given` (TypeError). Body JSON yang sama dengan `installment_months` berupa **angka** → 302 sukses | **Fail** (BUG-C4) |
| A14 | **`installment_months` sebagai string pada update** | `PUT /receivables/1` multipart sebagai admin | Tersimpan seperti biasa | BE | GAGAL pada percobaan pertama: **500** karena `installment_months` bertipe string diteruskan ke Carbon 3. **Setelah BUG-C4 diperbaiki**: di-cast `(int)` di `store()` dan `update()` | Pass (percobaan ke-2) |
| A15 | Pembulatan `interest_rate` menggeser nominal bunga | POST JSON `principal_amount=7000000`, `interest_type=fixed`, `interest_amount=500000`, `installment_months=5` | Bunga yang dihitung ulang idealnya = input | BE | GAGAL pada percobaan pertama: bunga nominal bergeser Rp 333 karena `interest_rate` dibulatkan 2 desimal. **Setelah BUG-C5 ditangani**: presisi kolom diperlebar ke `decimal(8,4)` dan pembulatan mengikuti, sehingga pergeseran turun ~100× menjadi ≤ Rp 10. Ditutup tes regresi yang merekonstruksi nominal dari rate | Pass (percobaan ke-2) |
| A16 | Tanggal bayar di masa depan | pay `payment_date` > hari ini | 422 | BE | Belum diuji — kehabisan piutang berstatus `active` setelah A09 membuat id 1 menjadi `paid_off`; endpoint `pay` menolak lebih dulu dengan 403 sehingga validasi tanggal tidak pernah dijangkau | Belum diuji |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | **Tanggal pencairan ≠ `loan_date`** | Piutang id 1 `loan_date=2026-07-01`, disetujui pada 2026-08-19 | Tanggal mutasi bank idealnya mencerminkan tanggal pinjam atau setidaknya konsisten | BE | GAGAL pada percobaan pertama: pencairan memakai tanggal hari ini, bukan `loan_date`. **Setelah BUG-C6 diperbaiki**: memakai `loan_date` | Pass (percobaan ke-2) |
| C02 | **Edit setelah reject tidak membersihkan jejak persetujuan** | id 2: submit → reject (`approved_by=2`, `approved_at=2026-08-19 14:42:06`) → edit sebagai admin | Setelah kembali ke `draft`, jejak reviewer lama idealnya ikut dibersihkan | BE | GAGAL pada percobaan pertama: revisi setelah ditolak tetap membawa `approved_by`/`approved_at` dari siklus sebelumnya — terbaca seolah revisi barunya sudah pernah disetujui. **Setelah BUG-C7 diperbaiki**: keduanya ikut dibersihkan. Ditutup tes regresi | Pass (percobaan ke-2) |
| C03 | Siklus penuh lintas aktor & rekonsiliasi kas | staff create (JSON) → staff submit → manager approve (debit 6.000.000 rek 1) → 4 pembayaran (transfer/cash/payroll/transfer) → cek saldo | Hanya pembayaran `bank_transfer` yang mengubah saldo; saldo = rumus computed | BE | Alur status `draft→pending_approval→active→paid_off` berjalan penuh. Dari 5 pembayaran, hanya 2 yang menghasilkan mutasi (`bank_transfer` dengan rekening). Saldo `QA Ops` dari props aplikasi = `505.200.000`, identik dengan hitung ulang SQL `initial_balance + Σcredit − Σdebit`; `QA Cadangan` = `94.800.000`, juga identik | Pass |
| C04 | Bunga piutang masuk P&L sebagai "Pendapatan Lain" | `GET /c/qa-empat/reports/profit-loss?start=2026-08-01&end=2026-08-31` setelah pembayaran bunga Rp 100.000 via transfer | Kategori `REV-INTEREST` muncul di `other_income`; pokok (`financing`) tidak masuk P&L | BE | GAGAL pada percobaan pertama: pendapatan bunga tidak masuk baris Pendapatan Lain karena `pl_group` NULL. **Setelah BUG-C8 diperbaiki**: seeder mengisi `other_income`/`other_expense` + migration backfill | Pass (percobaan ke-2) |
| C05 | Pembayaran `cash`/`payroll_deduction` tidak pernah masuk P&L | Bandingkan bunga Rp 100.000 yang dibayar `cash` (N08) dengan yang dibayar `bank_transfer` (N07) | Bunga tunai tidak muncul di laporan berbasis `bank_transactions` | BE | Benar: hanya Rp 100.000 dari N07 yang terbaca P&L; bunga Rp 100.000 dari N08 (cash) tidak muncul di mana pun karena tidak menghasilkan `bank_transactions`. Perilaku sesuai dokumentasi, tetapi berarti pendapatan bunga tunai hilang dari laporan laba rugi | Pass (perilaku terdokumentasi, berisiko) |

## Temuan

### BUG-C4 — Membuat & mengedit piutang dari form selalu HTTP 500 (BLOKIR)
- **SIFAT**: Cacat fatal / blocker fungsional.
- **MENGGAGALKAN**: A13, A14.
- **GEJALA**: `POST /c/qa-empat/receivables` dan `PUT /c/qa-empat/receivables/{id}` mengembalikan **HTTP 500** dengan `TypeError: Carbon\Carbon::rawAddUnit(): Argument #3 ($value) must be of type int|float, string given` setiap kali `installment_months` berupa string. Body JSON dengan `installment_months` berupa angka berhasil (302), membuktikan tipe datalah penyebabnya.
- **SEBAB**: `app/Http/Controllers/ReceivableController.php:169` (store) dan `:229` (update) memanggil `now()->parse($validated['loan_date'])->addMonths($installmentMonths)`. Aturan validasi `integer` di `StoreReceivableRequest`/`UpdateReceivableRequest` hanya memeriksa, **tidak meng-cast**, sehingga nilai tetap string. Carbon 3 menolak argumen string secara ketat.
- **CAKUPAN**: **Seluruh jalur UI**. `resources/js/pages/receivables/index.tsx:576` memakai `forceFormData: true` (multipart, semua nilai jadi string) dan baris 690 mengisi `installment_months` dari `e.target.value` (string). Artinya tombol "Tambah" dan "Edit" pada halaman Piutang tidak dapat dipakai sama sekali. Test suite yang ada tidak menangkapnya karena memanggil controller dengan integer PHP.
- **SARAN PERBAIKAN**: Cast eksplisit di kedua tempat: `$installmentMonths = (int) $validated['installment_months'];` (juga `(int) $validated['principal_amount']`), atau tambahkan `prepareForValidation()` di form request yang meng-cast field numerik. Tambahkan test feature yang mengirim payload berbentuk string agar regresi tertangkap.

### BUG-C1 — Tidak ada batas atas pembayaran pokok piutang
- **SIFAT**: Cacat validasi / kesalahan pencatatan kas.
- **MENGGAGALKAN**: A09.
- **GEJALA**: Piutang id 1 berpokok Rp 6.000.000 menerima total pembayaran pokok Rp 13.500.000 → sisa pokok tercatat **−Rp 7.500.000**, status langsung `paid_off`, dan rekening dikredit Rp 10.000.000 dengan kategori `FIN-RCV-IN` (pengembalian piutang) meski piutangnya sudah habis.
- **SEBAB**: `app/Http/Requests/PayReceivableRequest.php` hanya memberi `nullable|integer|min:0`. `ReceivableController::pay()` (baris 322-330) menghitung `$remainingPrincipal`/`$remainingInterest` tetapi hanya memakai `$remainingPrincipal` untuk menentukan `paid_off` (tidak untuk membatasi input).
- **CAKUPAN**: Semua user dengan `pay receivables`. Dampak: penerimaan berlebih terklasifikasi sebagai pengembalian pokok (kategori `financing`) sehingga tidak muncul sebagai pendapatan di P&L — uang masuk yang tidak terlacak.
- **SARAN PERBAIKAN**: Tolak `principal_paid > remainingPrincipal` (dan opsional `interest_paid > remainingInterest`) di form request/controller dengan pesan yang menyebut sisa aktual.

### BUG-C2 — `bank_transfer` tanpa rekening tercatat sebagai pembayaran tanpa mutasi bank
- **SIFAT**: Cacat validasi / inkonsistensi data.
- **MENGGAGALKAN**: A10.
- **GEJALA**: Pembayaran dengan `payment_method=bank_transfer` tetapi tanpa `bank_account_id` diterima (302). Baris `receivable_payments` id 4 tersimpan dengan metode `bank_transfer`, tetapi tidak ada satu pun `bank_transactions` dibuat. Sisa piutang berkurang sementara saldo rekening tidak pernah bertambah.
- **SEBAB**: `app/Http/Requests/PayReceivableRequest.php` mendefinisikan `bank_account_id` sebagai `nullable|exists:bank_accounts,id` — tanpa `required_if:payment_method,bank_transfer`. `ReceivableController::pay()` (baris ±358) hanya menulis mutasi bila `payment_method === 'bank_transfer' && bank_account_id` terisi, dan **diam** bila tidak. Di frontend, `resources/js/pages/receivables/index.tsx:925-936` memberi label "Rekening *" tetapi tidak ada validasi client-side.
- **CAKUPAN**: Semua user dengan `pay receivables`; dapat terjadi tanpa niat buruk (user memilih metode transfer lalu lupa memilih rekening).
- **DIPERBAIKI**: `required_if:payment_method,bank_transfer` beserta pesan berbahasa Indonesia.

### BUG-C3 — `debtor_id` tidak divalidasi terhadap debitur yang sah
- **SIFAT**: Cacat integritas referensial.
- **MENGGAGALKAN**: A11, A12.
- **GEJALA**: (a) `debtor_id=99999` diterima → piutang `RCV-00003` menunjuk User yang tidak ada; index merender `debtor_name: null`, dan deskripsi transaksi bank saat approve akan berbunyi `Piutang diberikan: RCV-00003 - ` (nama kosong). (b) `type=employee_loan` dengan `debtor_id=1` yang dimaksudkan sebagai Client id 1 justru dipetakan ke **User id 1 "Admin"** tanpa peringatan.
- **SEBAB**: `app/Http/Requests/StoreReceivableRequest.php` (dan Update) hanya memvalidasi `debtor_id` sebagai `required|integer` — tidak ada `exists`, dan tidak ada aturan yang mengaitkan `debtor_id` dengan `type`. `ReceivableController::store()` baris 170 menentukan `debtor_type` semata dari `type`.
- **CAKUPAN**: Semua user dengan `create receivables` (termasuk role `staff`). UI memang memakai `Combobox` dari `employeeOptions`/`companyOptions`, tetapi tidak ada penegakan di backend — sehingga panggilan langsung, bug frontend, atau perubahan opsi bisa membuat piutang atas nama pihak yang salah.
- **DIPERBAIKI**: `withValidator()` memeriksa keberadaan debitur sesuai jenis piutang. Filter status (`users.status=active`, `clients.type=company`) sengaja **tidak** ditambahkan: itu mempersempit siapa yang boleh berutang, dan menutup kasus yang sah (mis. karyawan nonaktif yang utangnya belum lunas) — keputusan produk, bukan perbaikan bug.

### BUG-C5 — Nominal bunga bergeser karena `interest_rate` dibulatkan 2 desimal
- **SIFAT**: Cacat presisi perhitungan (invarian terdokumentasi, terbukti).
- **MENGGAGALKAN**: A15.
- **GEJALA**: Input bunga `fixed` Rp 500.000 atas pokok Rp 7.000.000 disimpan sebagai `interest_rate=7.14`. Setiap perhitungan ulang (mis. sisa bunga di dialog bayar, `ReceivableController.php:327`) menghasilkan Rp 499.800 — geser Rp 200. Sementara `installment_amount` (Rp 1.500.000) masih dihitung dari bunga asli Rp 500.000, sehingga dua angka di layar yang sama tidak konsisten.
- **SEBAB**: `ReceivableController::store()` baris 161-163 mengonversi nominal ke rate dengan `round($totalInterest / $principalAmount * 100, 2)`; kolom `receivables.interest_rate` bertipe `decimal(5,2)` sehingga nominal asli tidak disimpan di mana pun.
- **CAKUPAN**: Setiap piutang dengan `interest_type=fixed` yang nominalnya bukan kelipatan bulat dari 0,01% pokok. Selisih kecil per record tetapi konsisten dan tidak pernah bisa dilunasi tepat.
- **DITANGANI SEBAGIAN** dengan alternatif presisi: kolom diperlebar ke `decimal(8,4)` dan pembulatan mengikuti, menekan pergeseran dari ±Rp 333 menjadi ≤ Rp 10 untuk pokok Rp 10 juta.
- **MASIH TERBUKA**: menyimpan nominal apa adanya di kolom tersendiri tetap lebih benar — pembulatan berapa pun tetap pembulatan. Ditunda karena menuntut penulisan ulang jalur perhitungan bunga beserta backfill piutang lama, dan dampaknya kini di bawah satu rupiah per juta.

### BUG-C6 — Pencairan piutang memakai tanggal hari ini, bukan `loan_date`
- **SIFAT**: Cacat pencatatan periode (invarian terdokumentasi, terbukti).
- **MENGGAGALKAN**: C01.
- **GEJALA**: Piutang `RCV-00001` dengan `loan_date=2026-07-01` disetujui pada 2026-08-19; `bank_transactions` id 16 bertanggal `2026-08-19`. Selisih 49 hari dan lintas bulan buku.
- **SEBAB**: `app/Http/Controllers/ReceivableController.php:290` — `'transaction_date' => now()->format('Y-m-d')`.
- **CAKUPAN**: Semua piutang yang persetujuannya tidak di hari yang sama dengan tanggal pinjam. Dampak: Cash Flow per periode dan rekonsiliasi bank tidak cocok dengan tanggal pinjam yang tercatat di piutang.
- **SARAN PERBAIKAN**: Pakai `$receivable->loan_date`, atau tegaskan di UI bahwa tanggal pencairan = tanggal persetujuan dan tampilkan tanggal itu di detail piutang. Bila keduanya perlu, simpan `disbursed_at` tersendiri.

### BUG-C7 — Edit setelah reject tidak membersihkan `approved_by`/`approved_at`
- **SIFAT**: Data menyesatkan (invarian terdokumentasi, terbukti).
- **MENGGAGALKAN**: C02 (catatan pada N11).
- **GEJALA**: Piutang id 2 yang ditolak lalu diedit kembali ke `status=draft` dengan `rejection_reason=NULL`, tetapi masih menyimpan `approved_by=2` dan `approved_at=2026-08-19 14:42:06`. Di UI, kolom peninjau akan menampilkan nama manager pada piutang yang secara status belum pernah diajukan.
- **SEBAB**: `ReceivableController::update()` (baris 232-250) menyetel `status => 'draft'` dan `rejection_reason => null` tetapi tidak menyentuh `approved_by`, `approved_at`, maupun `review_notes`.
- **CAKUPAN**: Semua piutang yang melewati jalur reject → revisi.
- **DIPERBAIKI**: `approved_by` dan `approved_at` ikut dikosongkan (kolom `review_notes` tidak ada pada tabel ini). Ditutup tes regresi.

### BUG-C8 — Pendapatan bunga piutang tidak masuk baris "Pendapatan Lain" di P&L
- **SIFAT**: Cacat konfigurasi data awal (seeder) dengan dampak pelaporan. **Sama akarnya dengan BUG-L4 di modul Loans.**
- **MENGGAGALKAN**: C04.
- **GEJALA**: Pendapatan bunga Rp 100.000 (kategori `REV-INTEREST`, id 14) muncul di blok `unclassified.income` pada Laporan Laba Rugi; `other_income.by_category` kosong dan `other_income.total = 0`.
- **SEBAB**: `database/seeders/TransactionCategorySeeder.php:27-28` membuat `REV-INTEREST` dan `EXP-INTEREST` tanpa `pl_group`; di `tenant_qa-empat` kolom `pl_group` keduanya NULL. `docs/module/receivables.md` menyatakan `REV-INTEREST` "(income/`other_income`) menambah laba".
- **CAKUPAN**: Setiap tenant yang di-provisioning dengan seeder saat ini.
- **SARAN PERBAIKAN**: Isi `pl_group` di seeder (`other_income` / `other_expense`) plus backfill untuk tenant yang sudah ada; atau perbarui dokumentasi modul bila penetapan `pl_group` memang diserahkan ke admin.

## Catatan pelaksanaan

- Semua case dieksekusi lewat HTTP `http://127.0.0.1:8000` dengan cookie sesi
  sungguhan, lalu diverifikasi ke DB `tenant_qa-empat` (`receivables`,
  `receivable_payments`, `bank_transactions`, `bank_accounts`,
  `transaction_categories`).
- **Batasan metode yang harus diketahui pembaca**: karena BUG-C4, `store()` dan
  `update()` tidak bisa dilewati dengan payload berbentuk form (bentuk yang
  dipakai UI). Case N01, N02, N11, A11, A12, A15 karenanya dijalankan dengan body
  JSON agar `installment_months` terkirim sebagai angka. Ini **bukan** jalur
  pemakaian normal dan dinyatakan apa adanya; case A13/A14 justru
  mendokumentasikan kegagalan jalur normalnya.
- Pengujian dilakukan lewat endpoint, bukan lewat klik di browser. Klaim tentang
  perilaku frontend (label "Rekening *" pada A10, `forceFormData: true` pada
  BUG-C4) berasal dari **membaca** `resources/js/pages/receivables/index.tsx`,
  bukan dari observasi layar, dan ditulis demikian.
- A16 tetap `Belum diuji` — tidak dibulatkan menjadi Pass. Setelah A09 membuat
  satu-satunya piutang `active` menjadi `paid_off`, guard status (403) menyalip
  validasi tanggal sehingga case tidak bisa dijalankan tanpa membuat piutang baru
  lewat jalur JSON tambahan.
- Efek samping yang SEHARUSNYA TIDAK terjadi ikut diperiksa: N06 (reject tidak
  membuat mutasi bank), N08/N09 (cash & payroll benar-benar nol mutasi — tabel
  `bank_transactions` tidak bertambah sama sekali), A08 (0/0 tidak membuat baris
  pembayaran), A02-A07 (403/422 tanpa perubahan DB).
- Rekonsiliasi saldo dilakukan dua arah (props aplikasi vs `initial_balance +
  Σcredit − Σdebit` lewat SQL) dan cocok persis untuk kedua rekening.
- Data uji yang tertinggal sebagai bukti: piutang id 1 `RCV-00001` (`paid_off`,
  pokok terbayar 13.500.000 atas pokok 6.000.000), id 4 `RCV-00002` (uji
  pembulatan bunga), id 5 `RCV-00005` (debitur salah kelas), serta
  `bank_transactions` id 16-19.
- Tidak ada perubahan kode aplikasi, migrasi, seeding, atau `.env` selama
  pengujian.
