# Test Case — Reimbursements

Sumber teknis: [`docs/module/reimbursements.md`](../../module/reimbursements.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-empat` (DB `tenant_qa-empat`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

Tanggal eksekusi: **2026-08-19** (`CURDATE()` server = `2026-08-19`).
Akun: `staff@gmail.com` (id 3, role staff — pemohon), `manager@gmail.com` (id 2,
finance manager — reviewer & pembayar), `admin@gmail.com` (id 1, admin).
Data pendukung yang dibuat lewat aplikasi: rekening `QA Ops` (id 1, saldo awal
Rp 500.000.000) dan `QA Cadangan` (id 2, saldo awal Rp 100.000.000).
Kategori transaksi memakai seed tenant (id 15 `MAKAN MINUM`, 18 `OPERASIONAL LUAR
KOTA`, 19 `OPERASIONAL`).

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Staff membuat reimbursement sebagai draft | `POST /c/qa-empat/reimbursements` sebagai staff: title `N01 Taksi ke klien`, description `Perjalanan dinas`, amount `250000`, expense_date `2026-08-10`, category `transport`, action `draft` | HTTP 302; row baru `status=draft`, `payment_status=unpaid`, `category_input=transport`, `category_id` NULL, `amount_paid=0` | BE | 302. DB id 1: `status=draft`, `payment_status=unpaid`, `category_input=transport`, `category_id=NULL`, `amount_paid=0`, `user_id=3` | Pass |
| N02 | Staff membuat + langsung mengajukan (`action=submit`) | POST sama dengan `amount=1200000`, `category=meals`, `action=submit` | 302; status langsung `pending` | BE | 302. DB id 2 `status=pending`. Catatan: percobaan pertama tanpa field `description` menghasilkan HTTP 500 — lihat A18 | Pass |
| N03 | Finance approve + menetapkan `category_id` | `POST /reimbursements/2/review` sebagai manager: `action=approve`, `category_id=15`, `review_notes=Disetujui QA N03` | 302; `status=approved`, `category_id=15`, `reviewed_by=2`, `reviewed_at` terisi | BE | 302. DB id 2: `status=approved`, `category_id=15`, `reviewed_by=2`, `reviewed_at=2026-08-19 14:32:57`, `review_notes=Disetujui QA N03` | Pass |
| N04 | Pembayaran parsial (cicilan) membuat SATU BankTransaction debit | `POST /reimbursements/2/pay`: `bank_account_id=1`, `payment_date=2026-08-15`, `payment_amount=400000`, `reference_notes=CICIL-1` | 302; tepat 1 `bank_transactions` debit 400.000 kategori 15, deskripsi diawali "Cicilan"; `amount_paid=400000`; `payment_status=partial`; `status` tetap `approved` | BE | 302. `bank_transactions` id 1: `amount=400000`, `transaction_type=debit`, `transaction_date=2026-08-15`, `category_id=15`, `description=Cicilan Reimbursement: N02 Makan tim - Staff Demo`, `reference_number=CICIL-1`. `reimbursement_payments` id 1 tertaut `bank_transaction_id=1`, `paid_by=2`. Reimb id 2: `amount_paid=400000`, `payment_status=partial`, `status=approved` | Pass |
| N05 | Pelunasan sisa → status `paid` | `POST /reimbursements/2/pay`: `payment_amount=800000`, `payment_date=2026-08-16`, `reference_notes=LUNAS-2` | 302; tx debit kedua (deskripsi "Pelunasan"); `amount_paid=1200000`; `status=paid`, `payment_status=paid` | BE | 302. `bank_transactions` id 2 = 800.000 debit kategori 15, deskripsi `Pelunasan Reimbursement: ...`. Reimb id 2: `amount_paid=1200000`, `status=paid`, `payment_status=paid` | Pass |
| N06 | Finance menolak pengajuan | `POST /reimbursements/3/review`: `action=reject`, `review_notes=Nota tidak jelas` | 302; `status=rejected`, `reviewed_by=2` | BE | 302. DB id 3 `status=rejected`, `reviewed_by=2` | Pass |
| N07 | Pemilik mengedit draft miliknya | `PUT /reimbursements/1` sebagai staff: title `N01 Taksi ke klien (revisi)`, amount `275000` | 302; field terbarui, status tetap `draft` | BE | 302. DB id 1: title `N01 Taksi ke klien (revisi)`, `amount=275000`, `status=draft` | Pass |
| N08 | Pemilik menghapus draft miliknya | `DELETE /reimbursements/1` sebagai staff | 302; record hilang | BE | 302; id 1 tidak ada lagi di tabel | Pass |
| N09 | Filter index (status / search / kategori / rentang tanggal) | GET index dengan `?status=paid`, `?search=Pulsa`, `?category=medical`, `?date_from=2026-08-01&date_to=2026-08-06` | Masing-masing hanya mengembalikan baris yang cocok | BE | `status=paid` → `N02 Makan tim`, `A05 Obat`. `search=Pulsa` → `N06 Pulsa kantor rev`. `category=medical` → `A05 Obat`. Rentang tanggal → `A05 Obat` (06-08), `N06 Pulsa kantor rev` (05-08). Semua benar | Pass |
| N10 | Stats agregat index | GET index sebagai admin | `total=3`, `total_amount=2.000.000`, `total_paid=1.900.000` (1.200.000 + 700.000) | BE | `"stats":{"total":3,"total_amount":2000000,"pending_count":0,"approved_count":0,"total_paid":1900000}` — cocok | Pass |
| N11 | Saldo rekening (computed) berkurang persis sebesar pembayaran | GET `/c/qa-empat/bank-accounts` setelah 4 pembayaran reimbursement | `QA Ops` = 500.000.000 − (400.000+800.000+700.000) = 498.100.000; `QA Cadangan` = 100.000.000 − 200.000 = 99.800.000 | BE | Props: `QA Ops balance=498100000`, `QA Cadangan balance=99800000` — cocok persis | Pass |
| N12 | Daftar reimbursement terbuka dengan tab Semua/Saya | Admin buka menu Reimbursement | Tab dan kartu status tampil | FE+BE | Tampil | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Kategori di luar 7 nilai tetap ditolak | POST store dengan `category=parkir` | 422 dengan pesan validasi kategori | BE | 422 `{"category":["The selected category is invalid."]}` | Pass |
| A02 | Nominal 0 ditolak | POST store dengan `amount=0` | 422 `amount min 1` | BE | 422 `{"amount":["The amount field must be at least 1."]}` | Pass |
| A03 | Approve tanpa `category_id` ditolak (`required_if`) | `POST /reimbursements/2/review` `action=approve` tanpa `category_id` | 422 | FE+BE | 422 `{"category_id":["The category id field is required when action is approve."]}` | Pass |
| A04 | Tanggal bayar di masa depan ditolak | pay dengan `payment_date=2026-12-31` | 422 `before_or_equal:today` | BE | 422 `{"payment_date":["The payment date field must be a date before or equal to today."]}` | Pass |
| A05 | **Pembayaran melebihi sisa** | Reimb id 4 `amount=500000`, `status=approved`, sisa 500.000. pay `payment_amount=700000` | Idealnya ditolak / dipotong ke sisa | BE | GAGAL pada percobaan pertama: pembayaran melebihi sisa diterima dan kas terdebit berlebih. **Setelah BUG-R1 diperbaiki**: `PayReimbursementRequest` menghitung `max:` dinamis dari sisa | Pass (percobaan ke-2) |
| A06 | Bayar reimbursement yang belum `approved` | pay pada id 1 (`draft`) | Ditolak dengan flash error, tanpa efek samping | BE | 302 + flash `{"error":"Reimbursement tidak dapat dibayar"}`; `amount_paid` tetap 0, tidak ada baris pembayaran/tx baru | Pass |
| A07 | Admin (bukan pemilik) mengedit reimbursement staff | `PUT /reimbursements/1` & `GET /reimbursements/1/edit` sebagai admin | 403 (tidak ada bypass admin untuk edit) | BE | 403 pada keduanya | Pass |
| A08 | Non-pemilik mengajukan (submit) | `POST /reimbursements/1/submit` sebagai manager | 403 | BE | 403 | Pass |
| A09 | **Ajukan ulang setelah `rejected` lewat edit `action=submit`** | `PUT /reimbursements/3` sebagai pemilik dengan `action=submit` (status `rejected`) | Idealnya status jadi `pending` ATAU flash error yang jujur | FE+BE | GAGAL pada percobaan pertama. **Setelah BUG-R2 diperbaiki**: status `rejected` direset ke `draft` sebelum `submit()`, dan bila submit tetap gagal yang tampil flash **error**, bukan sukses | Pass (percobaan ke-2) |
| A10 | Staff (tanpa `approve reimbursements`) mereview | `POST /reimbursements/2/review` sebagai staff | 403 | BE | 403 `This action is unauthorized.` | Pass |
| A11 | Staff (tanpa `pay reimbursements`) membayar | `POST /reimbursements/2/pay` sebagai staff | 403 | BE | 403 `This action is unauthorized.` | Pass |
| A12 | Rekening bank tidak ada | pay dengan `bank_account_id=999` | 422 exists | BE | 422 `{"bank_account_id":["The selected bank account id is invalid."]}` | Pass |
| A13 | Lampiran bukan jpg/jpeg/png/pdf | store multipart dengan `attachment=@qa_bukti.txt` | 422 mimes | BE | 422 `{"attachment":["The attachment field must be a file of type: jpg, jpeg, png, pdf."]}` | Pass |
| A14 | `amount_paid` tidak tersinkron bila baris pembayaran dihapus | Hapus `reimbursement_payments` id 3 langsung di DB, baca ulang reimb id 4 | Idealnya `amount_paid` ikut turun / ada mekanisme rekonsiliasi | BE | GAGAL pada percobaan pertama: `amount_paid` hanya diinkremen, tidak pernah turun saat pembayaran dihapus. **Setelah BUG-R3 diperbaiki**: `ReimbursementPayment` merekonsiliasi `amount_paid` dan `payment_status` pada setiap `saved`/`deleted`. Ditutup dua tes regresi (hapus → kembali 0/unpaid, sebagian → partial) | Pass (percobaan ke-2) |
| A15 | **Staff memaksa `?tab=all`** | GET `/c/qa-empat/reimbursements?tab=all` sebagai staff (tidak punya `approve reimbursements`) | Hanya baris milik staff yang boleh terlihat | BE | GAGAL pada percobaan pertama: staff bisa melihat semua reimbursement lewat `?tab=all`. **Setelah BUG-R4 diperbaiki**: `tab` dipaksa `my` bagi yang tidak punya `approve reimbursements` | Pass (percobaan ke-2) |
| A16 | **Staff menghapus reimbursement milik user lain** | `DELETE /reimbursements/6` sebagai staff (record milik manager, status `draft`) | 403 | BE | GAGAL pada percobaan pertama: `canDelete()` tidak memeriksa kepemilikan. **Setelah BUG-R5 diperbaiki**: kepemilikan wajib, penghapusan milik orang lain ditolak | Pass (percobaan ke-2) |
| A17 | Finance manager (tanpa `delete reimbursements`) menghapus | `DELETE /reimbursements/5` sebagai manager | 403 dari middleware | BE | 403 | Pass |
| A18 | **Field opsional `description` tidak dikirim** | `POST /reimbursements` tanpa key `description` sama sekali | 422 atau tersimpan dengan description NULL | BE | GAGAL pada percobaan pertama: **500** bila `description` tidak dikirim. **Setelah BUG-R6 diperbaiki**: `$validated['description'] ?? null` pada `store()` dan `update()` | Pass (percobaan ke-2) |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Siklus penuh lintas aktor: staff ajukan → manager approve → dua kali bayar → kas berkurang | staff store `action=submit` (id 2) → manager review approve `category_id=15` → pay 400.000 → pay 800.000 → cek `bank_accounts` | Status berjalan `pending→approved→(partial)→paid`; 2 BankTransaction debit; saldo `QA Ops` berkurang 1.200.000 | BE | Berjalan persis: `pending` → `approved` → `partial` (amount_paid 400.000) → `paid` (1.200.000). Dua tx debit id 1 & 2, keduanya `category_id=15`. Saldo QA Ops turun tepat 1.200.000 dari kontribusi reimbursement ini | Pass |
| C02 | Siklus penolakan: ajukan → ditolak → revisi + ajukan ulang | staff store submit (id 3) → manager reject → staff `PUT` dengan `action=submit` | Setelah revisi, pengajuan kembali masuk antrean `pending` | FE+BE | GAGAL pada percobaan pertama (sama dengan A09). **Setelah diperbaiki**: siklus tolak → revisi → ajukan ulang berakhir pada status `pending`. Ditutup tes regresi | Pass (percobaan ke-2) |
| C03 | Admin menghapus reimbursement yang sudah `paid` | `DELETE /reimbursements/5` sebagai admin (status `paid`, sudah punya 1 pembayaran Rp 200.000 dari rekening `QA Cadangan`) | Record hilang; efek kas idealnya ikut dikoreksi atau setidaknya diperingatkan | BE | GAGAL pada percobaan pertama: menghapus reimbursement `paid` meninggalkan pengeluaran yatim di kas. **Setelah BUG-R7 diperbaiki**: penghapusan ditolak selama ada pembayaran, dengan pesan yang menyebut nilainya | Pass (percobaan ke-2) |

## Temuan

### BUG-R1 — Pembayaran boleh melebihi sisa, kas terdebit berlebih
- **SIFAT**: Cacat validasi / kebocoran uang.
- **MENGGAGALKAN**: A05.
- **GEJALA**: Reimbursement id 4 bernominal Rp 500.000 dibayar Rp 700.000 dalam satu transaksi. DB: `amount=500000`, `amount_paid=700000`, `status=paid`. Rekening `QA Ops` didebit penuh Rp 700.000 (`bank_transactions` id 3). Tidak ada peringatan apa pun.
- **SEBAB**: `app/Http/Requests/PayReimbursementRequest.php` hanya memvalidasi `payment_amount` `integer|min:1`; tidak ada batas atas. `app/Http/Controllers/ReimbursementController.php:323` hanya memakai perbandingan `>= amount_remaining` untuk memilih label "Pelunasan/Cicilan", bukan untuk membatasi nominal. `app/Models/Reimbursement.php:245` (`recordPayment`) menambah `amount_paid` apa adanya.
- **CAKUPAN**: Semua user dengan permission `pay reimbursements` (admin, finance manager). State machine hanya mencegah pembayaran *berikutnya*, bukan kelebihan pada pembayaran terakhir.
- **SARAN PERBAIKAN**: Tambahkan aturan batas atas pada form request (mis. `max:` sisa yang dihitung dari route model binding lewat `withValidator`/rule kustom), atau clamp `payment_amount` ke `amount_remaining` di controller sebelum membuat `BankTransaction`.

### BUG-R2 — Ajukan ulang setelah ditolak gagal diam-diam, flash tetap "berhasil"
- **SIFAT**: Cacat alur kerja + pesan menyesatkan.
- **MENGGAGALKAN**: A09, C02.
- **GEJALA**: `PUT /reimbursements/3` dengan `action=submit` pada record `rejected` mengembalikan 302 dan flash `success: "Reimbursement berhasil diajukan untuk persetujuan"`, tetapi `status` tetap `rejected`. Pengajuan tidak pernah masuk antrean reviewer, dan pemohon merasa sudah mengajukan.
- **SEBAB**: `app/Models/Reimbursement.php:187` `canSubmit()` hanya menerima `draft`; `canEdit()` (baris 168) menerima `draft` dan `rejected`. `ReimbursementController::update()` memanggil `$reimbursement->submit()` tanpa memeriksa nilai kembaliannya, lalu selalu menyusun pesan sukses berdasar `action` saja (baris ±250-256).
- **CAKUPAN**: Setiap pemohon yang merevisi reimbursement yang ditolak — jalur "revisi lalu ajukan ulang" yang merupakan tujuan utama status `rejected`.
- **DIPERBAIKI** dengan opsi reset + pemeriksaan nilai kembalian. Melonggarkan `canSubmit()` ditolak: status `rejected` membawa jejak review (`reviewed_by`/`reviewed_at`/`review_notes`) yang harus dibersihkan agar tidak terbaca sebagai review atas revisi baru — reset eksplisit menangani itu sekaligus.

### BUG-R3 — `amount_paid` tersimpan tanpa rekonsiliasi
- **SIFAT**: Risiko integritas data.
- **MENGGAGALKAN**: A14.
- **GEJALA**: Setelah baris `reimbursement_payments` dihapus (level DB), `reimbursements.amount_paid` tetap `700000` sedangkan jumlah pembayaran riil `0`. Status tetap `paid`.
- **SEBAB**: `app/Models/Reimbursement.php:245` `recordPayment()` menginkremen kolom tersimpan; tidak ada observer/hook `deleted` pada `ReimbursementPayment`, dan tidak ada accessor yang menghitung ulang dari relasi.
- **CAKUPAN**: Belum ada endpoint aplikasi yang menghapus pembayaran, jadi saat ini hanya terpapar lewat intervensi DB, migrasi data, atau fitur "hapus pembayaran" di masa depan. Diuji di level DB, bukan lewat layar.
- **DIPERBAIKI** dengan opsi observer. Mengubah `amount_paid` menjadi accessor ditolak: kolomnya dipakai untuk memfilter dan mengurutkan di level query (`scopePaid`, kartu statistik), sehingga menghapus kolomnya akan memindahkan beban itu ke PHP. Observer menjaga nilainya tetap benar tanpa mengubah kontrak query.

### BUG-R4 — Staff bisa melihat semua reimbursement dengan `?tab=all`
- **SIFAT**: Kebocoran data (otorisasi hanya di frontend).
- **MENGGAGALKAN**: A15.
- **GEJALA**: `GET /c/qa-empat/reimbursements?tab=all` sebagai `staff@gmail.com` mengembalikan seluruh baris perusahaan, termasuk milik user lain (`"A15 Milik Manager"`, Rp 777.000, deskripsi `rahasia`) lengkap dengan nominal, kategori, dan nama pemohon.
- **SEBAB**: `app/Http/Controllers/ReimbursementController.php:26` — `$tab = $request->input('tab', $canApprove ? 'all' : 'my')`; nilai `tab` diambil mentah dari query string dan hanya dipakai sebagai kondisi filter (baris 39 & 60). Tidak ada pemeriksaan bahwa hanya user ber-`approve reimbursements` yang boleh memakai `all`. Pembatasan hanya ada di UI: `resources/js/pages/reimbursements/index.tsx:289` menyembunyikan tab "Semua Pengajuan" bila `!canApprove`.
- **CAKUPAN**: Semua user dengan `view reimbursements` tetapi tanpa `approve reimbursements` (role `staff`). Reimbursement memuat data pengeluaran pribadi karyawan.
- **SARAN PERBAIKAN**: Paksa `$tab = 'my'` bila `! $canApprove`, mis. `$tab = $canApprove ? $request->input('tab','all') : 'my';` — dan terapkan hal yang sama pada query statistik.

### BUG-R5 — `canDelete()` tidak memeriksa kepemilikan
- **SIFAT**: Cacat otorisasi.
- **MENGGAGALKAN**: A16.
- **GEJALA**: `staff@gmail.com` menghapus reimbursement id 6 milik `manager@gmail.com` (status `draft`) → 302, record hilang dari DB.
- **SEBAB**: `app/Models/Reimbursement.php:173-185` — komentar di kode berbunyi "Owner can only delete if draft or rejected", tetapi kode hanya mengembalikan `in_array($this->status, ['draft','rejected'])` tanpa membandingkan `user_id` dengan user aktif. `ReimbursementController::destroy()` (baris 264) hanya memanggil `canDelete()`. Bandingkan dengan `edit`/`update`/`submit` yang punya `abort(403)` bila `user_id !== auth()->id()`.
- **CAKUPAN**: Semua user dengan permission `delete reimbursements` (role `admin` dan `staff` pada seeder saat ini). Target: semua reimbursement berstatus `draft`/`rejected` milik siapa pun.
- **SARAN PERBAIKAN**: Tambahkan syarat kepemilikan: `return $this->user_id === $user?->id && in_array($this->status, ['draft','rejected']);` (bypass admin sudah ditangani di cabang di atasnya).

### BUG-R6 — HTTP 500 bila field opsional `description` tidak dikirim
- **SIFAT**: Cacat ketahanan (robustness).
- **MENGGAGALKAN**: A18.
- **GEJALA**: `POST /c/qa-empat/reimbursements` tanpa key `description` → HTTP 500, log: `local.ERROR: Undefined array key "description" ... at D:/Laravel/finance-management/app/Http/Controllers/ReimbursementController.php:164`.
- **SEBAB**: `description` divalidasi `nullable`, sehingga `validated()` tidak memuat key-nya bila field absen; controller mengaksesnya langsung (`$validated['description']`) di `store()` baris 164 dan `update()` baris 244.
- **CAKUPAN**: Form React selalu mengirim `description` (default string kosong), sehingga jalur UI normal **tidak** terdampak. Terpapar untuk pemanggilan API/integrasi/otomasi dan bila form diubah menjadi conditional field.
- **SARAN PERBAIKAN**: Gunakan `$validated['description'] ?? null` (atau `data_get`) pada kedua baris.

### BUG-R7 — Menghapus reimbursement `paid` meninggalkan pengeluaran yatim di kas
- **SIFAT**: Inkonsistensi data lintas modul (invarian terdokumentasi, terbukti).
- **MENGGAGALKAN**: C03.
- **GEJALA**: Admin menghapus reimbursement id 5 (`paid`, sudah dibayar Rp 200.000). Reimbursement dan barisnya di `reimbursement_payments` hilang, tetapi `bank_transactions` id 4 (debit Rp 200.000, deskripsi `Pelunasan Reimbursement: C03 Hotel - Staff Demo`) tetap ada dan saldo `QA Cadangan` tetap 99.800.000.
- **SEBAB**: `ReimbursementController::destroy()` (baris 264-273) hanya memanggil `$reimbursement->delete()`; `canDelete()` memberi admin bypass untuk status apa pun (`Reimbursement.php:176-179`). Tidak ada pembersihan/pembalikan `BankTransaction`.
- **CAKUPAN**: Role `admin`. Dampak: Cash Flow dan Laporan Laba Rugi memuat pengeluaran tanpa dokumen sumber yang bisa ditelusuri.
- **DIPERBAIKI** dengan opsi larangan, sejalan dengan modul Loans. Penolakannya berupa pesan galat yang menyebut nilai pembayaran yang menahan, bukan 403 kosong.

## Catatan pelaksanaan

- Seluruh case dieksekusi lewat HTTP `http://127.0.0.1:8000` dengan cookie sesi
  hasil login sungguhan (CSRF token dari cookie `XSRF-TOKEN`), lalu diverifikasi
  langsung ke `tenant_qa-empat` via PDO. Tidak ada case yang "dibulatkan" Pass.
- Pengujian dilakukan lewat endpoint, **bukan** lewat klik di browser. Perilaku
  frontend (mis. penyembunyian tab pada A15, label wajib pada dialog) diverifikasi
  dengan **membaca kode** `resources/js/pages/reimbursements/index.tsx` dan
  dinyatakan demikian di kolom Lapisan — bukan diklaim sebagai observasi layar.
- A14 satu-satunya case yang memanipulasi DB langsung (menghapus lalu memulihkan
  `reimbursement_payments` id 3) karena aplikasi tidak menyediakan jalur untuk
  menghapus pembayaran. Baris sudah dikembalikan ke kondisi semula.
- Efek samping yang SEHARUSNYA TIDAK terjadi ikut diperiksa: A06 (tidak ada baris
  pembayaran/tx baru saat pembayaran ditolak), A01–A04/A12/A13 (tidak ada record
  tersimpan saat 422), A10/A11 (403 tanpa mutasi apa pun).
- Data uji yang tertinggal di `tenant_qa-empat` sengaja dibiarkan sebagai bukti:
  reimbursement id 2 (`paid`), id 3 (`rejected`), id 4 (`paid` dengan
  `amount_paid` > `amount`), dan `bank_transactions` id 1-4.
- Kegagalan tooling yang bukan cacat aplikasi: skrip helper `qa_errors` awalnya
  tidak bisa membaca `/tmp/qa_body.txt` (perbedaan resolusi path Git Bash vs PHP
  di Windows). Diganti dengan `head -c` langsung; tidak memengaruhi hasil uji.
