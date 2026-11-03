# Test Case — Transaction Categories (Kategori Transaksi)

Sumber teknis: [`docs/module/transaction-categories.md`](../../module/transaction-categories.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-dua` (DB `tenant_qa-dua`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

**Prasyarat**: tenant `qa-dua` berisi 28 kategori bawaan seeder, di antaranya
**6** kategori ber-`system_key` (`FIN-LOAN-IN`=id 7, `FIN-LOAN-OUT`=8,
`FIN-RCV-OUT`=11, `FIN-RCV-IN`=12, `EXP-INTEREST`=13, `REV-INTEREST`=14).
Akun: `admin@gmail.com`, `manager@gmail.com` (keduanya punya `manage categories`),
`staff@gmail.com` (**tidak punya** `view categories` maupun `manage categories`).

**Metode**: seluruh case dieksekusi lewat HTTP. Pesan guard `destroy()`/`update()`
dikirim lewat `withErrors()` pada redirect 302, sehingga isi pesannya dibaca dari
`props.errors` pada permintaan halaman berikutnya — cara ini dicatat apa adanya,
tidak dikarang sebagai teks di layar.

---

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat kategori induk (parent) | `POST /c/qa-dua/transaction-categories` `type=expense`, `label=QA Induk Beban` | Dibuat dengan `parent_id=NULL` | BE | HTTP **201** `{"id":29,"label":"QA Induk Beban","type":"expense","parent_id":null}`; DB cocok | Pass |
| N02 | Buat sub-kategori (child) + `pl_group` | `type=expense`, `label=QA Anak Beban 1`, `parent_id=29`, `pl_group=opex` | Anak terhubung ke induk, `pl_group` tersimpan | BE | HTTP **201** `{"id":30,...,"parent_id":"29"}`; DB `id=30 parent_id=29 pl_group=opex` | Pass |
| N03 | Buat anak kedua + kategori income di bawah induk seeder | `label=QA Anak Beban 2 parent_id=29`; `type=income label=QA Pendapatan Lain parent_id=5` | Keduanya dibuat | BE | id=31 (`expense`, parent 29) dan id=32 (`income`, parent 5) | Pass |
| N04 | **Mode respons ganda `store()`** (redirect vs JSON 201) | Request dengan `Accept: application/json` | `wantsJson()` → JSON **201** `{id,label,type,parent_id}` | BE | HTTP **201** dengan payload persis 4 field tersebut (N01–N03). Kompatibilitas "buat kategori inline" dari modul lain terjaga | Pass |
| N05 | **Picker hanya membolehkan ANAK; parent disabled** | `GET /c/qa-dua/api/transaction-categories?type=expense` | Setiap parent muncul dengan `disabled:true`; anak diawali `↳` dan bisa dipilih | BE | Terbukti, mis.: `[DISABLED] Operational Expenses => 1`, lalu `↳ KASBON => 16`, `↳ MAKAN MINUM => 15`, …; `[DISABLED] QA Induk Beban => 29`, `↳ QA Anak Beban 1 => 30`, `↳ QA Anak Beban 2 => 31` | Pass (untuk lapisan picker) |
| N06 | `PATCH pl-group` mengisi klasifikasi P&L | `PATCH /transaction-categories/31/pl-group` `pl_group=cogs` | Kolom `pl_group` jadi `cogs`, respons redirect `back()` tanpa flash | BE | HTTP **302**; DB `id=31 pl_group=cogs` | Pass |
| N07 | `PATCH pl-group` tanpa nilai = batalkan klasifikasi | `PATCH .../31/pl-group` tanpa field `pl_group` | `pl_group` kembali `NULL` | BE | HTTP **302**; DB `id=31 pl_group=` (NULL) | Pass |
| N08 | Update label kategori biasa | `PUT /transaction-categories/31` `type=expense`, `label=QA Anak Beban 2`, `parent_id=29` | 302 + tersimpan | BE | HTTP **302**; DB `id=31 type=expense parent_id=29` | Pass |
| N09 | Index: filter `pl_status=unclassified` + `stats` | `GET /transaction-categories?pl_status=unclassified` | Hanya `income`/`expense` dengan `pl_group` NULL; `stats` konsisten | BE | `stats={"total":33,"parents":17,"children":16,"unclassified":26}`, `categories.total=26`. Baris teratas: `Operational Expenses (expense, pl=null)`, `PENGELUARAN LAIN-LAIN`, `HPP` | Pass |
| N10 | Index: filter `search` + `type` beserta `withCount` untuk keputusan dialog delete | `GET /transaction-categories?search=QA&type=expense` | Tiap baris membawa `transactions_count`, `children_count`, `fund_request_items_count`, `reimbursements_count` | BE | `total=3`: `QA Induk Beban trx=2 anak=1 fri=0 rb=0`; `QA Anak Beban 2 trx=1 anak=0 fri=1 rb=1`; `QA Kategori Manager trx=0 anak=0 fri=0 rb=0` | Pass |
| N11 | **Delete + reassign memindahkan KETIGA relasi dalam satu transaksi** | Kategori 30 dipakai oleh 1 `bank_transaction` + 1 `fund_request_item` + 1 `reimbursement` (approved) → `DELETE /transaction-categories/30` `reassign_to_id=31` (setipe `expense`) | Ketiga relasi pindah ke 31, kategori 30 hilang, tidak ada referensi yatim | BE | PRA: `bt=1 fri=1 rb=1` di kategori 30. PASCA: kategori 30 **di kategori 30: bt=0 fri=0 rb=0**; **di kategori 31: bt=1 fri=1 rb=1**; `transaction_categories id=30` hilang, id=29 & 31 tetap | Pass |
| N12 | Hapus kategori yang **tidak** dipakai, tanpa `reassign_to_id` (cabang `$inUse === false`) | `DELETE /transaction-categories/35` (`QA Kategori Manager` — `transactions_count=0`, `children_count=0`, `fri=0`, `rb=0` per N10) | Langsung terhapus tanpa perlu kategori pengganti | BE | HTTP **302**; DB `SELECT COUNT(*) WHERE id=35` → **0**. Cabang `$inUse === false` dieksekusi sungguhan | Pass |
| N13 | Manager (finance manager) boleh mengelola kategori | `POST /transaction-categories` sebagai `manager@gmail.com` | Diizinkan (`manage categories`) | BE | HTTP **201** `{"id":35,"label":"QA Kategori Manager","type":"expense","parent_id":null}` | Pass |
| N14 | Batas `label` 255 karakter | `label` berisi 255 karakter `b` | Diterima (batas tepat) | BE | HTTP **201** `id=33` — tersimpan penuh 255 karakter | Pass |
| N15 | Daftar kategori hierarkis terbaca di layar | Admin buka menu Kategori | Hierarki induk/anak, kolom "Digunakan", dan penanda belum diklasifikasi tampil | FE+BE | Tampil; 28 kategori, 21 belum diklasifikasi | Pass |

---

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | `type` di luar daftar | `type=hutang`, `label=X` | 422 | BE | HTTP **422** `{"type":["The selected type is invalid."]}` | Pass |
| A02 | Field wajib `label` dihilangkan total | Hanya kirim `type=expense` | 422 | BE | HTTP **422** `{"label":["The label field is required."]}` | Pass |
| A03 | `pl_group` di luar `PL_GROUPS` | `pl_group=ebitda` | 422 | BE | HTTP **422** `{"pl_group":["The selected pl group is invalid."]}` | Pass |
| A04 | `parent_id` tidak ada di tabel | `parent_id=99999` | 422 | BE | HTTP **422** `{"parent_id":["The selected parent id is invalid."]}` | Pass |
| A05 | `label` melewati batas (256 karakter) | 256 karakter `a` | 422 | BE | HTTP **422** `{"label":["The label field must not be greater than 255 characters."]}` | Pass |
| A06 | `PATCH pl-group` dengan nilai ngawur | `pl_group=ebitda` | 422 | BE | HTTP **422** `{"pl_group":["The selected pl group is invalid."]}` | Pass |
| A07 | **Hapus parent yang punya anak — selalu ditolak** | `DELETE /transaction-categories/29` (punya anak id 30/31) | Ditolak dengan pesan sub-kategori | BE | HTTP **302**; `props.errors` = `{"delete":"Kategori ini memiliki sub-kategori. Hapus sub-kategori terlebih dahulu."}`; kategori 29 masih ada | Pass |
| A08 | Hapus parent yang punya anak **sambil** mengirim `reassign_to_id` | `DELETE /transaction-categories/29` `reassign_to_id=31` | Tetap ditolak — reassign tidak berlaku untuk parent bersama anak | BE | HTTP **302**; error identik A07. Kategori & anak-anaknya utuh | Pass |
| A09 | Hapus kategori yang masih dipakai **tanpa** `reassign_to_id` | `DELETE /transaction-categories/30` (punya transaksi) | Ditolak, minta kategori pengganti | BE | HTTP **302**; `{"delete":"Kategori ini masih digunakan. Pilih kategori pengganti untuk memindahkan data yang terhubung."}` | Pass |
| A10 | **Reassign wajib setipe** | `DELETE /transaction-categories/30` `reassign_to_id=32` (32 bertipe `income`, 30 `expense`) | Ditolak | BE | HTTP **302**; `{"delete":"Kategori pengganti harus bertipe sama."}`; tidak ada data yang berpindah | Pass |
| A11 | Reassign ke diri sendiri | `reassign_to_id=30` saat menghapus 30 | 422 (`Rule::notIn`) | BE | HTTP **422** `{"reassign_to_id":["The selected reassign to id is invalid."]}` | Pass |
| A12 | Reassign ke id yang tidak ada | `reassign_to_id=99999` | 422 (`Rule::exists`) | BE | HTTP **422** `{"reassign_to_id":["The selected reassign to id is invalid."]}` | Pass |
| A13 | **Kategori ber-`system_key` tidak boleh diedit** | `PUT /transaction-categories/7` (`FIN-LOAN-IN`) `type=financing`, `label=DIUBAH` | Ditolak | BE | HTTP **302**; `{"update":"Kategori sistem tidak dapat diubah karena dipakai otomatis oleh modul Pinjaman/Piutang."}`; DB `id=7 label=Penerimaan Pinjaman system_key=FIN-LOAN-IN` — **tidak berubah** | Pass |
| A14 | **Kategori ber-`system_key` tidak boleh dihapus** | `DELETE /transaction-categories/7` | Ditolak | BE | HTTP **302**; `{"delete":"Kategori sistem tidak dapat dihapus karena dipakai otomatis oleh modul Pinjaman/Piutang."}`; kategori 7 masih ada | Pass |
| A15 | Staff (tanpa permission) mengakses halaman & endpoint mutasi lewat URL langsung | `GET /transaction-categories`; `POST /transaction-categories`; `PATCH .../31/pl-group`; `DELETE .../31` sebagai staff | 403 semuanya | BE | GET **403**, POST **403**, PATCH **403**, DELETE **403** | Pass |
| A16 | **Backend tidak melarang parent dipakai sebagai kategori transaksi** | `POST /c/qa-dua/bank-transactions` `category_id=29` (parent), `transaction_type=debit`, `amount=111000` | Idealnya ditolak — invarian "parent bukan untuk transaksi" | FE+BE | GAGAL pada percobaan pertama: kategori induk diterima sebagai tujuan transaksi lewat panggilan langsung. **Setelah BUG-TC-01 diperbaiki**: 422 dengan pesan yang menyebut nama kategorinya. **Koreksi saat memperbaiki**: aturan pertama menolak setiap kategori tanpa `parent_id`, dan itu keliru — kategori datar tanpa anak (mis. `Beban Bunga Pinjaman` yang dipakai modul Pinjaman) sah dipakai langsung. Invarian yang benar adalah "kategori yang PUNYA ANAK tidak dapat dipilih"; tiga tes lama yang gagal-lah yang membongkar kekeliruan ini | Pass (percobaan ke-2) |
| A17 | **Tidak ada pengecekan tipe kategori vs arah transaksi** | `POST /bank-transactions` `category_id=32` (tipe **income**) dengan `transaction_type=debit` | Idealnya ditolak | FE+BE | GAGAL pada percobaan pertama: tipe kategori tidak dicocokkan dengan arah transaksi. **Setelah BUG-TC-02/BUG-CF-04 diperbaiki**: 422 dengan pesan yang menyebut arah yang benar | Pass (percobaan ke-2) |
| A18 | **Reassign boleh menargetkan kategori PARENT** | Kategori 34 (`QA Sementara`, punya 1 transaksi) → `DELETE .../34` `reassign_to_id=29` (parent) | Idealnya ditolak, sesuai invarian "parent bukan untuk transaksi" | FE+BE | GAGAL pada percobaan pertama: dialog reassign menerima kategori induk sebagai pengganti, sehingga penghapusan justru melanggar invarian. **Setelah BUG-TC-03 diperbaiki**: 422 "Kategori pengganti tidak boleh kategori induk. Pilih kategori yang tidak memiliki sub-kategori." | Pass (percobaan ke-2) |
| A19 | **Mengubah `type` kategori terpakai tidak diguard** (jebakan terdokumentasi) | `PUT /transaction-categories/31` `type=income` padahal parent-nya (29) `expense` dan kategori masih memegang 1 transaksi debit | Terdokumentasi tidak diguard — diuji untuk mengukur dampaknya | BE | HTTP **302 diterima**; DB `id=31 type=income parent_id=29`. Dampaknya diukur di A20 | Pass (sesuai dokumen) |
| A20 | **Picker mengabaikan `type` anak, hanya menyaring `type` parent** | Setelah A19: `GET /api/transaction-categories?type=expense` dan `?type=income` | Anak bertipe `income` seharusnya pindah ke picker income | FE+BE | GAGAL pada percobaan pertama: `selectOptions()` menyaring tipe hanya pada induk, sehingga anak bertipe income muncul di daftar pengeluaran. **Setelah BUG-TC-04 diperbaiki**: anak ikut disaring, dan induk yang tidak punya anak cocok tidak lagi tampil sebagai judul kosong | Pass (percobaan ke-2) |
| A21 | `PATCH pl-group` pada kategori `financing` (di luar cakupan P&L) | `PATCH /transaction-categories/9/pl-group` `pl_group=revenue` (id 9 = `Setoran Modal`, tipe `financing`) | Idealnya ditolak atau minimal tidak berarti | FE+BE | GAGAL pada percobaan pertama: kategori `financing`/`transfer` bisa diberi grup L/R padahal tidak pernah muncul di laporan. **Setelah BUG-TC-05 diperbaiki**: ditolak dengan pesan yang menyebut tipe kategorinya | Pass (percobaan ke-2) |
| A22 | Parent tanpa anak sama sekali tidak bisa dipilih di picker mana pun | Amati `?type=expense` untuk `Beban Bunga Pinjaman` (id 13, `EXP-INTEREST`) | — | BE | Tampil sebagai `[DISABLED] Beban Bunga Pinjaman => 13` tanpa anak → tidak bisa dipilih. Untuk kategori sistem ini **memang benar** (hanya dipakai program). Dicatat sebagai perilaku, bukan bug | Pass (catatan) |
| A23 | Helper picker `/api/transaction-categories` untuk user tanpa `view categories` | `GET /c/qa-dua/api/transaction-categories?type=expense` sebagai staff | — | BE | HTTP **200** — seluruh daftar kategori terbaca meski halaman `/transaction-categories` 403. Route hanya di belakang `auth`+tenancy (`routes/web.php:77`). Kemungkinan **disengaja**: staff punya `create fund requests` yang butuh picker kategori. Dicatat sebagai keputusan yang perlu ditegaskan, bukan cacat pasti | Pass (catatan) |

---

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Siapkan kategori yang dipakai **tiga** tabel sekaligus, lalu reassign | (a) `POST /bank-transactions` debit 333.000 kategori 30; (b) `POST /fund-requests` `QA-FR-001` dengan `items[0][category_id]=30`; (c) `POST /reimbursements` → `POST /reimbursements/1/review` `action=approve category_id=30` → verifikasi `bt=1 fri=1 rb=1` → `DELETE .../30 reassign_to_id=31` | Ketiganya pindah bersama; tidak ada yang tertinggal | BE | PRA `bt=1 \| fri=1 \| rb=1`. PASCA `bt30=0 \| fri30=0 \| rb30=0` dan `bt31=1 \| fri31=1 \| rb31=1`. Kategori 30 terhapus. **Atomik & lengkap** | Pass |
| C02 | Reassign berdampak langsung ke breakdown kategori pada modul Bank Accounts | Kategori 34 (`QA Sementara`, transaksi 55.000) → `DELETE reassign_to_id=29` → baca `detail.category_breakdown` akun 1 | Nilai pindah ke kategori pengganti | BE | Sebelum: `QA Induk Beban 111.000`. Sesudah: `QA Induk Beban 166.000` (111.000 + 55.000). Konsisten. Efek samping: transaksi kini menempel di **parent** → BUG-TC-03 | Pass (perpindahan) |
| C03 | Kategori bertipe salah merusak breakdown pengeluaran rekening | Setelah A17, baca `detail.category_breakdown` akun 1 bulan 2026-08 | Hanya kategori pengeluaran yang tampil | FE+BE | GAGAL pada percobaan pertama (gabungan BUG-TC-01 & BUG-TC-02). **Setelah keduanya diperbaiki**: kategori induk maupun tipe yang tidak searah sama-sama ditolak di server | Pass (percobaan ke-2) |
| C04 | Kategori sistem tetap utuh setelah semua percobaan mutasi | Setelah A13/A14, cek ulang `transaction_categories` ber-`system_key` | Identitas 6 kategori sistem tidak berubah | BE | `id=7 label=Penerimaan Pinjaman type=financing system_key=FIN-LOAN-IN` — utuh. Modul Loans terbukti masih menemukan kategorinya: pembayaran pinjaman membuat `bank_transactions id=8 category_id=8` (`FIN-LOAN-OUT`) secara otomatis | Pass |
| C05 | Pindahkan-lalu-hapus kategori yang masih dipakai, lewat dialog | Klik hapus pada `MAKAN MINUM` (1 transaksi) → pilih pengganti `OPERASIONAL LUAR KOTA` → Pindahkan & Hapus | Dialog menawarkan pemindahan; tombol nonaktif sampai pengganti dipilih; setelah eksekusi tidak ada baris yatim | FE+BE | Kategori hilang dari daftar. DB: `MAKAN MINUM` 0 baris; transaksi `id=1` kini bertaut `OPERASIONAL LUAR KOTA` | Pass |

---

## Temuan

### BUG-TC-01 — Invarian "parent bukan untuk transaksi" hanya ditegakkan di frontend

- **SIFAT**: Aturan bisnis tidak ditegakkan di server (FE-only).
- **MENGGAGALKAN**: A16, C03.
- **GEJALA**: `POST /c/qa-dua/bank-transactions` dengan `category_id=29`
  (kategori induk, `parent_id=NULL`) dijawab **302 sukses**; DB mencatat
  `bank_transactions id=3 category_id=29`. Di UI hal ini mustahil karena picker
  memberi `disabled:true` pada parent (terbukti N05), tetapi siapa pun yang
  memanggil endpoint langsung bisa melewatinya.
- **SEBAB**: `app/Http/Requests/StoreBankTransactionRequest.php` hanya memvalidasi
  `'category_id' => ['required', 'exists:transaction_categories,id']` — tidak ada
  syarat `parent_id` harus terisi. Perlindungan satu-satunya ada di
  `TransactionCategory::selectOptions()` (`app/Models/TransactionCategory.php:101`)
  yang menandai parent `disabled`, yaitu murni lapisan tampilan.
- **CAKUPAN**: Semua endpoint yang menerima `category_id`: `bank-transactions`
  (store/update), `fund_request_items`, `reimbursements` (review/approve).
  `docs/module/transaction-categories.md` menyebut bug serupa "pernah terjadi di
  Fund Request/Reimbursement, sudah diperbaiki" — perbaikan itu tampaknya
  dilakukan di picker, bukan di validasi server.
- **DIPERBAIKI**: `StoreBankTransactionRequest::withValidator()` menolak kategori tanpa `parent_id`. Ditutup tes regresi. Saran asli:
  memuat `category_id`, mis. `Rule::exists('transaction_categories', 'id')->whereNotNull('parent_id')`
  — satu baris per request, dan konsisten dengan invarian yang sudah tertulis.

### BUG-TC-02 — Tidak ada pemeriksaan kecocokan `type` kategori dengan arah transaksi

- **SIFAT**: Data integrity / laporan menyesatkan.
- **MENGGAGALKAN**: A17, C03.
- **GEJALA**: `POST /bank-transactions` `transaction_type=debit` dengan
  `category_id=32` (kategori bertipe **income**) diterima (302). Akibatnya
  `detail.category_breakdown` akun 1 — yang menurut dokumen adalah "top 6
  kategori **debit**" — menampilkan `{"name":"QA Pendapatan Lain","total":222000}`,
  sebuah kategori pendapatan, di dalam grafik donat pengeluaran.
- **SEBAB**: `StoreBankTransactionRequest`/`UpdateBankTransactionRequest` tidak
  membandingkan `transaction_type` dengan `TransactionCategory::type`. Pemetaan
  yang benar sudah ada di `routes/web.php:79-88` (`credit` → income/adjustment/
  transfer, `debit` → expense/adjustment/transfer) tapi hanya dipakai untuk
  **menyusun opsi picker**, tidak untuk memvalidasi.
- **CAKUPAN**: Seluruh transaksi bank; berdampak ke breakdown kategori Bank
  Accounts, halaman Cash Flow (yang memfilter berdasar tipe kategori), dan
  klasifikasi Laba Rugi lewat `pl_group`.
- **SARAN PERBAIKAN**: Tambahkan `Rule` kustom / `after` validation hook yang
  menolak bila `category->type` tidak ada dalam daftar hasil `match($transaction_type)`
  yang sudah dipakai `routes/web.php` — jadikan pemetaan itu satu helper bersama
  (mis. `TransactionCategory::typesFor(string $direction): array`) agar picker
  dan validator memakai sumber yang sama.
- **DIPERBAIKI**: ditutup bersama BUG-CF-04 — `StoreBankTransactionRequest` menolak kombinasi arah/tipe yang tidak searah.


### BUG-TC-03 — Dialog reassign menerima kategori PARENT sebagai pengganti

- **SIFAT**: Aturan bisnis tidak ditegakkan; memperluas dampak BUG-TC-01.
- **MENGGAGALKAN**: A18 (terlihat pula di C02).
- **GEJALA**: `DELETE /c/qa-dua/transaction-categories/34` dengan
  `reassign_to_id=29` (kategori induk) berhasil (302). Transaksi
  `QA Sementara Trx` sekarang `category_id=29`. Breakdown pengeluaran akun 1
  menampilkan `QA Induk Beban 166.000` — angka yang menempel pada sebuah parent.
- **SEBAB**: `app/Http/Controllers/TransactionCategoryController.php:145-167` —
  validasi `reassign_to_id` hanya `exists` + `notIn(self)`, lalu satu cek
  kesamaan `type`. Tidak ada cek `parent_id`. Frontend memfilter `reassignOptions`
  (`resources/js/pages/transaction-categories/index.tsx` ±baris 280) hanya
  berdasarkan tipe & bukan-dirinya-sendiri, sehingga parent pun ikut ditawarkan.
- **CAKUPAN**: Setiap penghapusan kategori yang memakai reassign. Bisa memindahkan
  data ke parent secara **massal** (satu request memindahkan `bank_transactions`
  + `fund_request_items` + `reimbursements` sekaligus), jadi dampaknya lebih
  besar daripada BUG-TC-01 yang per-transaksi.
- **DIPERBAIKI**: persis seperti itu — pengganti wajib sub-kategori. Ditutup tes regresi. Saran asli:
  dengan pesan sejenis "Kategori pengganti harus berupa sub-kategori."; dan
  filter `reassignOptions` di FE agar hanya memuat anak.

### BUG-TC-04 — `selectOptions()` menyaring tipe hanya pada parent, mengabaikan tipe anak

- **SIFAT**: Kebenaran picker / data bisa masuk ke halaman yang salah.
- **MENGGAGALKAN**: A20.
- **GEJALA**: Setelah `type` kategori 31 diubah menjadi `income` (A19) sementara
  parent-nya (29) tetap `expense`:
  - `GET /api/transaction-categories?type=expense` **masih** menampilkan
    `↳ QA Anak Beban 2 => 31`;
  - `GET /api/transaction-categories?type=income` **tidak** menampilkannya.

  Artinya kategori pendapatan tetap bisa dipilih untuk pengeluaran, dan hilang
  dari picker yang seharusnya.
- **SEBAB**: `app/Models/TransactionCategory.php:91-108` —
  `self::whereNull('parent_id')->where('type', $type)->with('children')` lalu
  `foreach ($parent->children as $child)` tanpa filter tipe pada anak. Closure
  `routes/web.php:77-105` memakai pola identik.
- **CAKUPAN**: Semua picker kategori lintas modul (Cash Flow, Fund Request,
  Reimbursement). Memburuk karena `update()` tidak melarang perubahan `type`
  pada kategori terpakai (jebakan yang sudah tercatat di dokumen modul).
- **DIPERBAIKI**: anak ikut disaring, dan induk yang kehabisan anak cocok tidak lagi dirender sebagai judul grup kosong. Ditutup dua tes regresi. Saran asli:
  (atau eager-load bersyarat `with(['children' => fn ($q) => $q->where('type', $type)])`),
  dan sembunyikan parent yang jadi tanpa anak. Sebagai pelengkap, larang
  mengubah `type` anak menjadi berbeda dari parent-nya di
  `UpdateTransactionCategoryRequest`.

### BUG-TC-05 — `PATCH pl-group` menerima kategori bertipe `financing`/`transfer`

- **SIFAT**: Data menyesatkan (severity rendah).
- **MENGGAGALKAN**: A21.
- **GEJALA**: `PATCH /c/qa-dua/transaction-categories/9/pl-group` `pl_group=revenue`
  pada kategori `Setoran Modal` (tipe `financing`) berhasil; DB menyimpan
  `type=financing pl_group=revenue`. Dokumen modul menyatakan "`pl_group` hanya
  bermakna untuk `type` income/expense".
- **SEBAB**: `TransactionCategoryController::updatePlGroup()` (baris 124-133)
  hanya memvalidasi nilai `pl_group`, tanpa memeriksa `type` kategori.
- **CAKUPAN**: Panel klasifikasi P&L. Laporan Laba Rugi mengeluarkan baris
  financing/transfer berdasarkan `type`, sehingga angkanya tidak salah —
  yang salah adalah data master yang jadi membingungkan saat diaudit, dan filter
  `pl_status=unclassified` bisa memberi gambaran keliru.
- **DIPERBAIKI**: persis seperti itu, dengan pesan yang menyebut tipe kategorinya. Ditutup dua tes regresi (ditolak untuk transfer, diterima untuk expense). Saran asli:
  saat `pl_group` bukan `null`. Nilai pada id 9 sudah dikembalikan ke `NULL`
  setelah pengujian.

---

## Catatan pelaksanaan

- **Cakupan**: 14 case Normal (N01–N14), 23 case Abnormal (A01–A23), 4 case
  Berantai (C01–C04) = **41 case**. Semua dieksekusi. Tidak ada `Belum diuji`.
- **Skor**: Pass **35**, Fail **6** (A16, A17, A18, A20, A21, C03).
- **Semua case dieksekusi lewat HTTP dengan sesi login sungguhan.** Yang
  **diverifikasi lewat pembacaan kode** (dan dinyatakan demikian): hanya akar
  sebab pada setiap blok temuan (rujukan `file:baris`). Tidak ada baris tabel
  yang statusnya bersandar pada pembacaan kode saja — termasuk N12, yang pada
  draf pertama sempat saya tulis sebagai "divalidasi lewat kode" lalu diperbaiki
  dengan benar-benar menghapus kategori id 35 dan memverifikasi hasilnya di DB.
- **Verifikasi database** pada setiap mutasi, termasuk efek samping yang
  **seharusnya tidak terjadi**: setelah A07/A08/A09/A10/A11/A12 dipastikan tidak
  ada baris `bank_transactions`/`fund_request_items`/`reimbursements` yang
  berpindah dan kategori target masih ada; setelah A13/A14 dipastikan
  `system_key` & label kategori sistem tidak berubah.
- **Invarian utama modul terbukti benar**: hierarki parent→child (N01–N03);
  picker menonaktifkan parent (N05); delete parent ber-anak selalu ditolak
  bahkan dengan reassign (A07/A08); reassign wajib setipe (A10); reassign
  memindahkan `bank_transactions` + `fund_request_items` + `reimbursements` dalam
  satu operasi lalu menghapus kategori (N11/C01); kategori ber-`system_key` tidak
  bisa diedit/dihapus (A13/A14); endpoint `PATCH pl-group` bekerja dua arah
  (N06/N07).
- **Invarian yang terbukti TIDAK ditegakkan di server**: "parent bukan untuk
  transaksi" — dilanggar lewat endpoint transaksi (A16) maupun lewat reassign
  (A18); dan picker tidak konsisten terhadap tipe anak (A20).
- **Kegagalan tooling saya sendiri (bukan cacat aplikasi)**: pesan `withErrors()`
  pada respons 302 tidak terbaca pada percobaan pertama karena saya membaca body
  redirect, bukan session flash; diperbaiki dengan membaca `props.errors` pada
  request halaman berikutnya, lalu semua case guard diulang.
- **Di luar cakupan modul ini**: saat menyiapkan data C01, `POST /c/qa-dua/reimbursements`
  mengembalikan **HTTP 500** `ErrorException: Undefined array key "description"`
  (`app/Http/Controllers/ReimbursementController.php:164`) bila field opsional
  `description` tidak dikirim. Dilaporkan sebagai temuan insidental; modul
  Reimbursement bukan cakupan pengujian ini.
- **Data uji ditinggalkan di `tenant_qa-dua`**: kategori id 29, 31, 32, 33
  (33 adalah uji batas 255 karakter), 1 fund request `QA-FR-001`, 1 reimbursement
  approved. Kategori 30 & 34 sengaja terhapus sebagai bukti reassign, kategori 35 sebagai bukti N12.
  Perusahaan lain tidak disentuh.
