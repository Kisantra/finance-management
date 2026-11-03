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

# Test Case — Reimbursement

Sumber teknis: [`docs/module/reimbursements.md`](../../module/reimbursements.md).
Cara baca tabel & kolom **Lapisan**: lihat [`../README.md`](../README.md).

**Ingat**: jalankan di database `finance_management_qc` (server lokal `127.0.0.1:8001`), bukan
database `finance_management`. Akun (password `password`):

| Akun | Peran | Izin reimbursement |
|---|---|---|
| `staff@qc.test` | staff | lihat, buat, edit, hapus (milik sendiri) |
| `fm@qc.test` | finance manager | lihat, buat, edit, setujui/tolak, bayar |
| `admin@gmail.com` | admin | semua izin + boleh menghapus status apa pun |

Data awal: database QC tanpa reimbursement sama sekali, 3 rekening bank, 18 kategori transaksi
pengeluaran. Lampiran uji: `struk-taksi.jpg` (gambar ±40 KB), `kuitansi-hotel.pdf`, `catatan.txt`
(tipe terlarang), `besar.pdf` (6 MB, melebihi batas 5 MB). Hari uji: 8 Oktober 2026.

Fokus: alur penuh pemohon → reviewer → pembayar, aturan nominal & lampiran, pembayaran cicilan dan
efeknya ke rekening/arus kas, serta **siapa yang menegakkan aturan** (UI vs server) untuk akses
lintas pengguna.

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

| N01 | Buat & langsung ajukan, dengan lampiran | Staff: **Buat Reimbursement**, judul "Taksi meeting klien PT Sanjaya", nominal Rp 185.000, tanggal hari ini − 2, kategori Transport, lampiran `struk-taksi.jpg`, klik **Ajukan** | Sheet tertutup, baris baru berstatus menunggu review; DB `status=pending`, file tersimpan di `storage/app/public/reimbursements` | FE+BE | Percobaan 1 berhenti karena selector tombol tanggal salah (alat uji). DB: status pending, expense_date 6 Okt, file jpg ada di disk public. | Pass |
| N02 | Simpan draft lalu ajukan dari daftar | Staff: buat "Makan siang tim proyek" Rp 420.000, Meals, tanpa lampiran, **Simpan Draft**; lalu tombol **Ajukan** di baris → konfirmasi | Setelah simpan: status Draft. Setelah konfirmasi: status menunggu review (`pending`) | FE+BE | DB: status pending setelah konfirmasi. | Pass |
| N03 | Edit draft | Staff: buat draft "ATK kantor" Rp 150.000; edit nominal → Rp 175.000, tambah lampiran `kuitansi-hotel.pdf`, **Simpan Draft** | Nominal Rp 175.000 dan ikon lampiran tampil; DB `amount=175000`, `attachment_name=kuitansi-hotel.pdf` | FE+BE | DB: amount 175000, attachment_name kuitansi-hotel.pdf. | Pass |
| N04 | Hapus draft beserta lampirannya | Staff: hapus draft "ATK kantor" (N03) → konfirmasi | Baris hilang; DB row terhapus **dan** file PDF-nya ikut terhapus dari disk | FE+BE | Percobaan 1: baris terhapus tetapi file PDF tertinggal di disk (BUG-01). Percobaan 2 (draft baru #7) setelah perbaikan: baris dan file terhapus. | Pass |
| N05 | Setujui dengan kategori resmi | FM: tab Semua → **Review** pada N01 → pilih kategori transaksi "OPERASIONAL", catatan "Sesuai struk", **Setujui** | Status disetujui; DB `status=approved`, `category_id` terisi, `reviewed_by`=FM, `review_notes` tersimpan | FE+BE | Percobaan 1 berhenti karena nama opsi kategori diawali "↳" (alat uji). DB: approved, category OPERASIONAL, reviewed_by fm@qc.test, catatan tersimpan. | Pass |
| N06 | Bayar sebagian (cicilan) | FM: **Bayar** pada N01, rekening pertama, tanggal hari ini, nominal Rp 100.000, catatan "TRF-001" | Status tetap disetujui dengan "sisa Rp 85.000"; DB `amount_paid=100000`, `payment_status=partial`; 1 `bank_transactions` debit Rp 100.000 berdeskripsi "Cicilan Reimbursement: …" berkategori sama | FE+BE | DB: amount_paid 100000, payment_status partial; tx#11 debit Rp 100.000 kategori OPERASIONAL "Cicilan Reimbursement: …". | Pass |
| N07 | Lunasi sisa | FM: **Bayar** lagi pada N01, nominal terisi otomatis Rp 85.000 | Status Lunas (`paid`), `amount_paid=185000`, 2 baris `reimbursement_payments`, transaksi kedua "Pelunasan Reimbursement: …"; tombol Bayar hilang | FE+BE | DB: status paid, amount_paid 185000, 2 baris reimbursement_payments; tx#12 "Pelunasan Reimbursement: …". | Pass |
| N08 | Filter, cari, rentang tanggal | FM tab Semua: filter status Lunas; lalu kategori Meals; lalu cari "taksi"; lalu rentang tanggal yang tidak memuat data | Tiap filter mempersempit daftar dengan benar; rentang kosong → state kosong; Reset mengembalikan semua | FE+BE | Percobaan 1: selector kolom Cari salah; percobaan 2: rentang tanggal ditutup dengan Escape padahal komponen menunggu tombol Terapkan (keduanya alat uji). | Pass |
| N09 | Detail & lampiran | Klik baris N01 | Dialog detail memuat pemohon, tanggal, kategori, nominal, sudah dibayar, peninjau + catatan, dan lampiran bisa dipratinjau | FE | Percobaan 1: isi lengkap tetapi console mencatat DOM tidak valid (BUG-02). Setelah perbaikan console bersih. | Pass |

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
| A15 | **Staff memaksa `?tab=all`** | GET `/c/qa-empat/reimbursements?tab=all` sebagai staff (tidak punya `approve reimbursements`) | Hanya baris milik staff yang boleh terlihat | FE+BE | GAGAL pada percobaan pertama: staff bisa melihat semua reimbursement lewat `?tab=all`. **Setelah BUG-R4 diperbaiki**: `tab` dipaksa `my` bagi yang tidak punya `approve reimbursements` | Pass (percobaan ke-2) |
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
- **DIPERBAIKI**: `PayReimbursementRequest` menghitung `max:` dinamis dari `amount_remaining`.


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
- **DIPERBAIKI**: `$tab` dipaksa `my` bagi yang tidak memegang `approve reimbursements`, termasuk pada query statistik.


### BUG-R5 — `canDelete()` tidak memeriksa kepemilikan
- **SIFAT**: Cacat otorisasi.
- **MENGGAGALKAN**: A16.
- **GEJALA**: `staff@gmail.com` menghapus reimbursement id 6 milik `manager@gmail.com` (status `draft`) → 302, record hilang dari DB.
- **SEBAB**: `app/Models/Reimbursement.php:173-185` — komentar di kode berbunyi "Owner can only delete if draft or rejected", tetapi kode hanya mengembalikan `in_array($this->status, ['draft','rejected'])` tanpa membandingkan `user_id` dengan user aktif. `ReimbursementController::destroy()` (baris 264) hanya memanggil `canDelete()`. Bandingkan dengan `edit`/`update`/`submit` yang punya `abort(403)` bila `user_id !== auth()->id()`.
- **CAKUPAN**: Semua user dengan permission `delete reimbursements` (role `admin` dan `staff` pada seeder saat ini). Target: semua reimbursement berstatus `draft`/`rejected` milik siapa pun.
- **SARAN PERBAIKAN**: Tambahkan syarat kepemilikan: `return $this->user_id === $user?->id && in_array($this->status, ['draft','rejected']);` (bypass admin sudah ditangani di cabang di atasnya).
- **DIPERBAIKI**: kepemilikan menjadi syarat wajib di `canDelete()` — komentar lama yang menjanjikan "owner only" kini benar-benar ditegakkan kodenya.


### BUG-R6 — HTTP 500 bila field opsional `description` tidak dikirim
- **SIFAT**: Cacat ketahanan (robustness).
- **MENGGAGALKAN**: A18.
- **GEJALA**: `POST /c/qa-empat/reimbursements` tanpa key `description` → HTTP 500, log: `local.ERROR: Undefined array key "description" ... at D:/Laravel/finance-management/app/Http/Controllers/ReimbursementController.php:164`.
- **SEBAB**: `description` divalidasi `nullable`, sehingga `validated()` tidak memuat key-nya bila field absen; controller mengaksesnya langsung (`$validated['description']`) di `store()` baris 164 dan `update()` baris 244.
- **CAKUPAN**: Form React selalu mengirim `description` (default string kosong), sehingga jalur UI normal **tidak** terdampak. Terpapar untuk pemanggilan API/integrasi/otomasi dan bila form diubah menjadi conditional field.
- **SARAN PERBAIKAN**: Gunakan `$validated['description'] ?? null` (atau `data_get`) pada kedua baris.
- **DIPERBAIKI**: `$validated['description'] ?? null` pada `store()` dan `update()`.


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

| A01 | Form kosong | Staff: buka form, langsung **Ajukan** | Tidak tersimpan; pesan per kolom (judul, nominal, kategori) dalam bahasa Indonesia | FE+BE | Percobaan 1: pesan berbahasa Inggris dan toast "Gagal menyimpan" (BUG-03). Server juga menolak form kosong (422). | Pass |
| A02 | Nominal 0 | Isi semua kecuali nominal Rp 0, **Simpan Draft** | Ditolak dengan pesan nominal minimal | FE+BE | Percobaan 1 memotret pesan lama karena menunggu dengan timer (alat uji). Server: 422 untuk amount 0. | Pass |
| A03 | Lampiran salah tipe / terlalu besar | Pilih `catatan.txt`, lalu `besar.pdf` (6 MB); juga kirim langsung ke server | UI menolak keduanya; server juga menolak (mimes, max 5 MB) | FE+BE | UI menolak keduanya; server: `catatan.txt` 422 (mimes), file 6 MB 422. Lihat CATATAN-1 tentang batas upload PHP 2 MB. | Pass |
| A04 | Setujui tanpa kategori | FM: dialog Setujui tanpa memilih kategori; lalu POST langsung `action=approve` tanpa `category_id` | Tombol Setujui nonaktif; server menjawab error validasi kategori, status tetap `pending` | FE+BE | API langsung tanpa category_id → 422; status N02 tetap pending. | Pass |
| A05 | Bayar melebihi sisa | FM: pada pengajuan disetujui Rp 420.000, isi nominal Rp 500.000 | Ditolak (UI dan server) dengan pesan sisa tagihan; tidak ada transaksi bank tercatat | FE+BE | Percobaan 1: Rp 500.000 untuk pengajuan Rp 420.000 diterima, BCA terpotong Rp 500.000 (BUG-04). Percobaan 2 (pengajuan #8 Rp 300.000): UI dan server menolak, tidak ada pembayaran tercatat. | Pass |
| A06 | Tanggal bayar di masa depan | FM: kirim langsung `payment_date` = besok | Server menolak (`before_or_equal:today`); UI tidak bisa memilih tanggal besok | FE+BE | API dengan payment_date besok → 422. | Pass |
| A07 | Staff membuka tab "Semua" lewat URL | Staff: buka `/reimbursements?tab=all` | Hanya pengajuan milik sendiri yang tampil (tab Semua hanya untuk reviewer) | BE | Percobaan 1 tidak konklusif: belum ada data milik pengguna lain karena fixture FM gagal dibuat (memicu BUG-05). Percobaan 2: kebocoran terbukti (BUG-06). Percobaan 3 setelah perbaikan: hanya milik sendiri. | Pass |
| A08 | Staff menghapus draft milik orang lain | FM membuat draft; staff mengirim `DELETE /reimbursements/{id}` langsung | Ditolak 403 / pesan error; row FM tetap ada | BE | Diverifikasi di level API + database (tidak ada alur layar karena tombol hapus memang tidak tampil untuk milik orang lain). Percobaan 1: DELETE /reimbursements/5 menghapus draft FM (BUG-07). Percobaan 2: DELETE /reimbursements/9 ditolak dengan flash "Reimbursement tidak dapat dihapus", row tetap ada. | Pass |
| A09 | Staff memanggil review / bayar | Staff: POST langsung ke `/review` dan `/pay` | 403; status tidak berubah | BE | Diverifikasi di level API: POST /review dan /pay sebagai staff → 403; status N02 tidak berubah. | Pass |
| A10 | Edit pengajuan yang sudah diajukan | Staff: buka `/reimbursements/{id}/edit` untuk N02 (pending), dan PUT langsung | Ditolak dengan pesan "tidak dapat diedit"; data tidak berubah | FE+BE | PUT langsung → redirect back, data tidak berubah. | Pass |
| A11 | Buat tanpa kolom deskripsi (API) | FM: POST `/reimbursements` tanpa kolom `description` sama sekali (judul, nominal Rp 65.000, kategori Other, draft) | Tersimpan sebagai draft dengan deskripsi kosong; tidak ada error server | BE | Diverifikasi di level API + database. Percobaan 1 (fixture FM): 500 "Undefined array key description" (BUG-05). Percobaan 2: 302 ke daftar, row #9 tersimpan dengan description null. | Pass |

## C. Alur Berantai (lintas aktor / modul)

Aksi pemohon dilakukan sebagai `staff@qc.test`, aksi reviewer/pembayar sebagai `fm@qc.test`, dan
penghapusan oleh admin sebagai `admin@gmail.com`. Yang diperiksa: perilaku di sisi aktor
berikutnya setelah tiap transisi, dan efek di modul lain.

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Ditolak → diperbaiki → diajukan ulang | FM menolak N02 dengan catatan "Lampirkan struk"; staff melihat status & catatan, edit (tambah lampiran) lalu **Ajukan** | Staff melihat Ditolak + catatan; setelah ajukan ulang status kembali menunggu review dan muncul lagi di antrean FM | FE+BE | Percobaan 1: pengajuan ulang gagal diam-diam (BUG-08). Percobaan 2: tombol Ajukan tersedia untuk status Ditolak, status kembali pending, data review lama dikosongkan, muncul lagi di antrean FM. | Pass |
| C02 | Pembayaran memotong saldo & masuk arus kas | Setelah N06–N07: cek saldo rekening & daftar Arus Kas → Pengeluaran | Saldo rekening turun Rp 185.000; dua transaksi debit tampil dengan kategori OPERASIONAL | FE+BE | Percobaan 1 tertahan karena server artisan serve sempat tidak merespons dan selector halaman rekening menunggu elemen tersembunyi (alat uji/lingkungan). DB: saldo BCA 64.802.500 → 64.617.500 (−185.000). | Pass |
| C03 | Badge antrean di sidebar | FM: catat badge Operasional; staff mengajukan 1; FM refresh; FM setujui | Badge bertambah setelah diajukan, tetap (pindah antrean bayar) setelah disetujui, berkurang setelah lunas | FE+BE | Badge FM: 0 → 1 setelah staff mengajukan → tetap 1 setelah disetujui (pindah ke antrean bayar) → 0 setelah lunas. | Pass |
| C04 | Admin menghapus pengajuan yang sudah dibayar | Admin: hapus N01 (Lunas) | Ditolak — pengajuan dengan pembayaran tidak boleh hilang sementara transaksi banknya tetap memotong saldo | FE+BE | Percobaan 1: terhapus, transaksi bank tx#11 & tx#12 tertinggal dan tetap memotong saldo (BUG-09). Percobaan 2: tombol hapus tidak tampil untuk baris yang sudah dibayar; DELETE langsung ditolak, data #6 dan pembayarannya tetap ada. | Pass |

<!-- qa-evidence:start -->

# Bukti visual langkah per langkah

Screenshot diambil per langkah, bukan hanya hasil akhirnya, supaya alurnya
bisa ditelusuri ulang oleh orang lain. Test case yang kondisinya tidak bisa
dicapai dari layar dijalankan lewat API/DB dan ditandai eksplisit — tidak
dibuatkan screenshot seolah-olah ada alur UI-nya.


## N01 · Buat & langsung ajukan, dengan lampiran — Pass (percobaan ke-2)

**1.** Staff membuka `/reimbursements` di database QC yang masih kosong: kartu statistik 0 dan state kosong "Belum ada reimbursement".

<img src="../evidence/reimbursements/N01-1.png" width="100%">

**2.** Form **Buat Pengajuan** terisi: judul "Taksi meeting klien PT Sanjaya", Rp 185.000, tanggal 06 Okt 2026, kategori Transport, lampiran `struk-taksi.jpg`.

<img src="../evidence/reimbursements/N01-2.png" width="100%">

**3.** Setelah **Ajukan**: sheet tertutup, baris baru berstatus **Pending Review** dengan ikon lampiran; toast "Reimbursement berhasil dibuat".

<img src="../evidence/reimbursements/N01-3.png" width="100%">


## N02 · Simpan draft lalu ajukan dari daftar — Pass

**1.** Form terisi "Makan siang tim proyek" Rp 420.000, kategori Meals & Entertainment, tanpa lampiran.

<img src="../evidence/reimbursements/N02-1.png" width="100%">

**2.** Setelah **Simpan Draft**: baris berstatus **Draft** dengan tombol **Ajukan** di kolom aksi.

<img src="../evidence/reimbursements/N02-2.png" width="100%">

**3.** Klik **Ajukan** di baris: dialog konfirmasi "Ajukan reimbursement ini?". (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/N02-3.png" width="100%">

**4.** Setelah konfirmasi: status berubah menjadi **Pending Review** dan tombol Ajukan hilang.

<img src="../evidence/reimbursements/N02-4.png" width="100%">


## N03 · Edit draft — Pass

**1.** Draft baru "ATK kantor" Rp 150.000 di daftar.

<img src="../evidence/reimbursements/N03-1.png" width="100%">

**2.** Sheet **Edit Reimbursement**: nominal diubah menjadi Rp 175.000 dan lampiran `kuitansi-hotel.pdf` ditambahkan.

<img src="../evidence/reimbursements/N03-2.png" width="100%">

**3.** Setelah **Simpan Draft**: baris menampilkan Rp 175.000 dan ikon lampiran.

<img src="../evidence/reimbursements/N03-3.png" width="100%">


## N04 · Hapus draft beserta lampirannya — Pass (percobaan ke-2)

**1.** Percobaan 1 — konfirmasi "Hapus reimbursement ini?" untuk draft "ATK kantor". (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/N04-1.png" width="100%">

**2.** Percobaan 1 — baris hilang dari daftar, namun pengecekan disk: `kuitansi-hotel.pdf` masih ada di `storage/app/public/reimbursements/` (BUG-01).

<img src="../evidence/reimbursements/N04-2.png" width="100%">

**3.** Percobaan 2 setelah perbaikan — konfirmasi hapus untuk draft "ATK kantor (uji ulang)" yang berlampiran PDF. (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/N04-3.png" width="100%">

**4.** Percobaan 2 — baris hilang; pengecekan database dan disk: row #7 dan file PDF-nya sama-sama terhapus.

<img src="../evidence/reimbursements/N04-4.png" width="100%">


## N05 · Setujui dengan kategori resmi — Pass (percobaan ke-2)

**1.** Finance manager di tab **Semua Pengajuan**: dua pengajuan Pending Review milik Staf Uji; badge sidebar Reimbursement 2.

<img src="../evidence/reimbursements/N05-1.png" width="100%">

**2.** Dialog **Setujui Reimbursement**: tombol Setujui baru aktif setelah kategori **OPERASIONAL** dipilih; catatan "Sesuai struk taksi.".

<img src="../evidence/reimbursements/N05-2.png" width="100%">

**3.** Setelah disetujui: status **Approved** dan muncul tombol **Bayar**.

<img src="../evidence/reimbursements/N05-3.png" width="100%">


## N06 · Bayar sebagian (cicilan) — Pass

**1.** Dialog **Proses Pembayaran**: sisa Rp 185.000, rekening BCA - Operasional (saldo Rp 64.802.500), nominal Rp 100.000, catatan TRF-001.

<img src="../evidence/reimbursements/N06-1.png" width="100%">

**2.** Setelah diproses: status tetap Approved dengan keterangan **sisa Rp 85.000**.

<img src="../evidence/reimbursements/N06-2.png" width="100%">


## N07 · Lunasi sisa — Pass

**1.** Dialog bayar kedua: nominal otomatis terisi sisa **Rp 85.000**.

<img src="../evidence/reimbursements/N07-1.png" width="100%">

**2.** Setelah diproses: status **Paid** dan tombol Bayar hilang.

<img src="../evidence/reimbursements/N07-2.png" width="100%">


## N08 · Filter, cari, rentang tanggal — Pass (percobaan ke-3)

**1.** Filter status **Paid**: hanya "Taksi meeting klien PT Sanjaya".

<img src="../evidence/reimbursements/N08-1.png" width="100%">

**2.** Filter kategori **Meals & Entertainment**: hanya "Makan siang tim proyek".

<img src="../evidence/reimbursements/N08-2.png" width="100%">

**3.** Cari "taksi": hanya satu baris yang cocok.

<img src="../evidence/reimbursements/N08-3.png" width="100%">

**4.** Rentang 1–3 Okt 2026 (URL `date_from=2026-10-01&date_to=2026-10-03`): tidak ada data, tampil state kosong.

<img src="../evidence/reimbursements/N08-4.png" width="100%">

**5.** **Reset**: kedua pengajuan tampil kembali.

<img src="../evidence/reimbursements/N08-5.png" width="100%">


## N09 · Detail & lampiran — Pass (percobaan ke-2)

**1.** Percobaan 1 — dialog detail: pemohon, tanggal, kategori, status Paid, Rp 185.000, sudah dibayar Rp 185.000, peninjau Fina Manager + catatan, deskripsi, tautan lampiran.

<img src="../evidence/reimbursements/N09-1.png" width="100%">

**2.** Pratinjau lampiran `struk-taksi.jpg` terbuka (gambar 600 px termuat).

<img src="../evidence/reimbursements/N09-2.png" width="100%">

**3.** Setelah perbaikan BUG-02 — dialog detail "Makan siang tim proyek" dibuka ulang; console tanpa error.

<img src="../evidence/reimbursements/N09-3.png" width="100%">


## A01 · Form kosong — Pass (percobaan ke-2)

**1.** Percobaan 1 — Ajukan form kosong: "The title field is required.", "The amount field must be at least 1.", "The category field is required."; toast generik "Gagal menyimpan".

<img src="../evidence/reimbursements/A01-1.png" width="100%">

**2.** Setelah perbaikan — "Judul wajib diisi.", "Nominal minimal Rp 1.", "Kategori wajib diisi."; toast merinci ketiga pesan dari server.

<img src="../evidence/reimbursements/A01-2.png" width="100%">


## A02 · Nominal 0 — Pass (percobaan ke-2)

**1.** Judul dan kategori terisi, nominal Rp 0 → **Simpan Draft** ditolak dengan pesan nominal minimal (teks masih berbahasa Inggris sebelum perbaikan BUG-03).

<img src="../evidence/reimbursements/A02-1.png" width="100%">


## A03 · Lampiran salah tipe / terlalu besar — Pass

**1.** Memilih `catatan.txt`: "Format file tidak didukung." dan file tidak diterima.

<img src="../evidence/reimbursements/A03-1.png" width="100%">

**2.** Memilih `besar.pdf` (6 MB): "Ukuran file melebihi batas 5MB.".

<img src="../evidence/reimbursements/A03-2.png" width="100%">


## A04 · Setujui tanpa kategori — Pass

**1.** Dialog Setujui tanpa kategori: tombol **Setujui** nonaktif. (Direkam ulang 8 Okt setelah animasi dialog selesai; rekaman pertama tertangkap saat dialog masih muncul. Perilakunya tidak berubah oleh perbaikan.)

<img src="../evidence/reimbursements/A04-1.png" width="100%">


## A05 · Bayar melebihi sisa — Pass (percobaan ke-2)

**1.** Percobaan 1 — dialog bayar "Hotel dinas Surabaya" (sisa Rp 420.000) diisi Rp 500.000; tombol tetap aktif.

<img src="../evidence/reimbursements/A05-1.png" width="100%">

**2.** Percobaan 1 — detail "Hotel dinas Surabaya" hasil pembayaran tadi: Jumlah Rp 420.000, **Sudah Dibayar Rp 500.000**, status Paid (BUG-04). (Direkam ulang setelah animasi dialog selesai; data yang tampil adalah sisa percobaan 1 yang masih ada di database QC.)

<img src="../evidence/reimbursements/A05-2.png" width="100%">

**3.** Setelah perbaikan — "Tiket kereta Bandung" (sisa Rp 300.000) diisi Rp 350.000: pesan "Melebihi sisa Rp 300.000.", tombol bayar nonaktif; server juga menjawab 422 "Jumlah pembayaran melebihi sisa reimbursement (Rp 300.000)."

<img src="../evidence/reimbursements/A05-3.png" width="100%">


## A06 · Tanggal bayar di masa depan — Pass

**1.** Kalender tanggal pembayaran: tanggal 9 Okt (besok) nonaktif.

<img src="../evidence/reimbursements/A06-1.png" width="100%">


## A07 · Staff membuka tab "Semua" lewat URL — Pass (percobaan ke-3)

**1.** Percobaan 2 — staff di `/reimbursements?tab=all` melihat kolom Pemohon dan draft **"Kurir dokumen kontrak (FM)" milik Fina Manager**; statistik Total 4 (semua pengguna).

<img src="../evidence/reimbursements/A07-1.png" width="100%">

**2.** Setelah perbaikan — URL yang sama hanya menampilkan pengajuan milik Staf Uji; draft FM (#9) tidak terlihat.

<img src="../evidence/reimbursements/A07-2.png" width="100%">


## A08 · Staff menghapus draft milik orang lain — Pass (percobaan ke-2)

_Tanpa langkah UI — Diverifikasi di level API + database (tidak ada alur layar karena tombol hapus memang tidak tampil untuk milik orang lain). Percobaan 1: DELETE /reimbursements/5 menghapus draft FM (BUG-07). Percobaan 2: DELETE /reimbursements/9 ditolak dengan flash "Reimbursement tidak dapat dihapus", row tetap ada._


## A09 · Staff memanggil review / bayar — Pass

_Tanpa langkah UI — Diverifikasi di level API: POST /review dan /pay sebagai staff → 403; status N02 tidak berubah._


## A10 · Edit pengajuan yang sudah diajukan — Pass

**1.** Staff membuka `/reimbursements/2/edit` (Pending): dialihkan ke daftar dengan toast "Reimbursement tidak dapat diedit".

<img src="../evidence/reimbursements/A10-1.png" width="100%">


## A11 · Buat tanpa kolom deskripsi (API) — Pass (percobaan ke-2)

_Tanpa langkah UI — Diverifikasi di level API + database. Percobaan 1 (fixture FM): 500 "Undefined array key description" (BUG-05). Percobaan 2: 302 ke daftar, row #9 tersimpan dengan description null._


## C01 · Ditolak → diperbaiki → diajukan ulang — Pass (percobaan ke-2)

**1.** FM menolak "Makan siang tim proyek" dengan catatan "Lampirkan struk/nota restoran.".

<img src="../evidence/reimbursements/C01-1.png" width="100%">

**2.** Status di sisi FM menjadi **Rejected**.

<img src="../evidence/reimbursements/C01-2.png" width="100%">

**3.** Staff membuka detail: status Rejected dan catatan penolakan terlihat; satu-satunya aksi adalah **Edit**. (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/C01-3.png" width="100%">

**4.** Staff menambahkan lampiran `struk-taksi.jpg` di sheet edit lalu klik **Ajukan**.

<img src="../evidence/reimbursements/C01-4.png" width="100%">

**5.** Percobaan 1 — toast "Reimbursement berhasil diperbarui", tetapi status **tetap Rejected** (DB: rejected) dan tidak ada cara lain untuk mengajukan (BUG-08).

<img src="../evidence/reimbursements/C01-5.png" width="100%">

**6.** Setelah perbaikan — baris Rejected kini memiliki tombol **Ajukan**.

<img src="../evidence/reimbursements/C01-6.png" width="100%">

**7.** Setelah konfirmasi: status **Pending Review**; toast "Reimbursement berhasil diajukan".

<img src="../evidence/reimbursements/C01-7.png" width="100%">

**8.** Di sisi FM pengajuan muncul lagi sebagai Pending Review dengan tombol **Review**.

<img src="../evidence/reimbursements/C01-8.png" width="100%">


## C02 · Pembayaran memotong saldo & masuk arus kas — Pass (percobaan ke-2)

**1.** Arus Kas → Pengeluaran: "Cicilan Reimbursement …" −Rp 100.000 (TRF-001) dan "Pelunasan Reimbursement …" −Rp 85.000 (TRF-002), kategori OPERASIONAL, rekening BCA - Operasional.

<img src="../evidence/reimbursements/C02-1.png" width="100%">

**2.** Halaman rekening bank setelah pembayaran: BCA - Operasional Rp 64.617.500.

<img src="../evidence/reimbursements/C02-2.png" width="100%">


## C03 · Badge antrean di sidebar — Pass

**1.** Awal: badge Reimbursement di sidebar FM kosong (0).

<img src="../evidence/reimbursements/C03-1.png" width="100%">

**2.** Staff mengajukan "Parkir gedung klien" Rp 25.000; setelah FM memuat ulang badge menjadi **1**.

<img src="../evidence/reimbursements/C03-2.png" width="100%">

**3.** FM menyetujui: badge tetap **1** (sekarang antrean bayar).

<img src="../evidence/reimbursements/C03-3.png" width="100%">

**4.** FM membayar lunas: badge kembali kosong.

<img src="../evidence/reimbursements/C03-4.png" width="100%">


## C04 · Admin menghapus pengajuan yang sudah dibayar — Pass (percobaan ke-2)

**1.** Percobaan 1 — admin: tombol hapus tampil pada baris Paid "Taksi meeting klien"; konfirmasi hapus. (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/C04-1.png" width="100%">

**2.** Percobaan 1 — baris hilang; DB: pengajuan & pembayaran terhapus tetapi 2 transaksi bank (Rp 185.000) tetap ada (BUG-09).

<img src="../evidence/reimbursements/C04-2.png" width="100%">

**3.** Setelah perbaikan — baris Paid "Parkir gedung klien" tanpa tombol hapus (draft lain masih bisa dihapus admin).

<img src="../evidence/reimbursements/C04-3.png" width="100%">

**4.** DELETE langsung ke `/reimbursements/6` → toast "Reimbursement yang sudah memiliki pembayaran tidak dapat dihapus."; data tetap ada.

<img src="../evidence/reimbursements/C04-4.png" width="100%">


<!-- qa-evidence:end -->
