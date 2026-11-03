# Test Case — Clients (Klien)

Sumber teknis: [`docs/module/clients.md`](../../module/clients.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-satu` (DB `tenant_qa-satu`), eksekusi lewat HTTP
dengan cookie sesi asli + verifikasi database. Bukan production.

Aktor: `admin@gmail.com` (admin), `manager@gmail.com` (finance manager),
`staff@gmail.com` (staff). Peta permission klien yang berlaku (dibaca dari
`finance_central.role_has_permissions`):

| Role | view | create | edit | delete |
|---|---|---|---|---|
| admin | ya | ya | ya | ya |
| finance manager | ya | ya | ya | **tidak** |
| staff | ya | ya | ya | **tidak** |

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat klien badan usaha dengan seluruh field pajak | POST `/c/qa-satu/clients` `name=PT Alpha Beta Gamma`, `type=company`, `status=Active`, `email=alpha@qa.test`, `NPWP=01.234.567.8-901.000`, `KPP=KPP Pratama QA`, `EFIN=1234567890`, `account_representative=Budi AR`, `ar_phone_number=08123456789`, `person_in_charge=Siti PIC`, `address=Jl. Uji No. 1` | 302 + baris tersimpan utuh | BE | 302. DB: `id=1`, semua kolom terisi persis seperti input | Pass |
| N02 | Buat klien perorangan hanya dengan field wajib | POST `name=Rina Perorangan`, `type=individual`, `status=Active` | 302 + baris tersimpan, field opsional `NULL` | BE | 302. DB: `id=2`, `email/NPWP/KPP/EFIN/address/person_in_charge` semua `IS NULL = 1` | Pass |
| N03 | Field opsional dikirim sebagai string kosong dinormalkan jadi `NULL` (bukan `''`) | POST `name=CV Kosong Field`, `type=company`, `status=Inactive`, `email=`, `NPWP=`, `KPP=`, `EFIN=`, `address=`, `person_in_charge=` | Kolom tersimpan `NULL` | BE | 302. Query `email IS NULL` dsb. → `1` untuk semua kolom (`id=3`). Normalisasi `array_map(fn ($v) => $v ?: null, …)` bekerja | Pass |
| N04 | Ubah klien: status `Active` → `Inactive`, email tetap milik sendiri | PUT `/c/qa-satu/clients/1` dengan `email=alpha@qa.test`, `status=Inactive`, `NPWP=99.888.777.6-555.000` | 302, tidak ada galat unique pada email sendiri | BE | 302. DB `id=1`: `status=Inactive`, `email=alpha@qa.test`, `NPWP=99.888.777.6-555.000`. Override `unique:clients,email,{id}` di `UpdateClientRequest` terbukti | Pass |
| N05 | Staff (punya `create clients`) membuat klien | POST sebagai `staff@gmail.com` `name=Klien Dibuat Staff` | 302 + tersimpan | BE | 302, DB `id=6` tersimpan | Pass |
| N06 | Stats index sesuai isi DB | GET `/c/qa-satu/clients`, ambil prop `stats` | `total/active/individual/company` = hitungan DB | BE | Prop `{"total":5,"active":3,"individual":3,"company":2}`; SQL pembanding `total=5 aktif=3 indiv=3 comp=2` — identik | Pass |
| N07 | Filter `type` dan `status` (tanpa search) | GET `?type=company`; GET `?status=Inactive` | Hanya baris yang cocok | BE | `type=company` → `total=2`; `status=Inactive` → `total=2`. Sesuai DB | Pass |
| N08 | Pencarian berdasarkan NPWP | GET `?search=99.888` | Hanya klien 1 | BE | 1 baris: `1:PT Alpha Beta Gamma` | Pass |
| N09 | Ringkasan tagihan per klien dihitung dari relasi invoice | GET `?search=Rina`, baca `invoices_count`, `total_invoice_amount`, `paid_invoice_amount` | Sama dengan agregat DB untuk `billed_to_id=2` | BE | Prop `{"invoices_count":9,"total":52932003,"paid":0}`; SQL `cnt=9 total=52932003 paid=0` — identik | Pass |
| N10 | Hapus klien yang tidak punya invoice — hanya baris itu yang hilang | Buat `Klien Sekali Pakai` (`id=7`), DELETE `/c/qa-satu/clients/7`, hitung ulang seluruh tabel | `clients` −1; `invoices`, `invoice_items`, `payments` tidak berubah | BE | Sebelum `inv=10 it=10 pay=2 cl=6` → sesudah `inv=10 it=10 pay=2 cl=5`. Hanya klien yang hilang | Pass |
| N11 | Endpoint opsi `/api/clients` untuk Combobox lintas modul | GET `/c/qa-satu/api/clients` | 200, daftar `{label,value}` urut nama | BE | 200, 6 entri urut nama. Catatan: endpoint ini mengembalikan klien **Inactive juga** (`CV Kosong Field`, `PT Alpha Beta Gamma`), berbeda dengan `/invoices/create` yang memfilter `Active` | Pass (dengan catatan) |
| N12 | Buat klien badan usaha lewat dialog, dengan NPWP dan PIC | Menu Klien → Tambah Klien → tipe Perusahaan, nama "PT Bukti Visual QA", NPWP, PIC → Simpan | Tersimpan; jumlah total naik; baris baru menampilkan NPWP | FE+BE | Total naik 5 → 6; baris baru tampil lengkap dengan NPWP | Pass |
| N13 | Dialog hapus klien menyatakan penolakan, bukan menjanjikan cascade | Klik hapus pada klien yang masih punya 1 invoice | Teks dialog menyebut jumlah invoice dan menyatakan klien tidak bisa dihapus; server menolak | FE+BE | GAGAL pada percobaan pertama: dialog masih berbunyi "Semua invoice terkait akan ikut dihapus" padahal server sudah menolak. **Setelah diperbaiki** (`resources/js/pages/clients/index.tsx`): teks menyebut "masih memiliki 1 invoice" dan penghapusan ditolak sambil menyebut nomor invoice penahannya | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Field wajib `name` dihilangkan sama sekali | POST hanya `type=company&status=Active` | 422 | BE | 422 `{"name":["The name field is required."]}` | Pass |
| A02 | `type` di luar enum | POST `type=corporation` | 422 | BE | 422 `{"type":["The selected type is invalid."]}` | Pass |
| A03 | `status` huruf kecil `active` (uji case-sensitivity validasi) | POST `status=active` | 422 — validasi `in:Active,Inactive` case-sensitive | BE | 422 `{"status":["The selected status is invalid."]}`. Validasi menolak, **tetapi** kolom DB bercollation `utf8mb4_unicode_ci` (lihat A13) | Pass |
| A04 | Email duplikat pada create | POST `email=alpha@qa.test` (sudah dipakai klien 1) | 422 | BE | 422 `{"email":["The email has already been taken."]}` | Pass |
| A05 | Format email tidak valid | POST `email=bukan-email` | 422 | BE | 422 `{"email":["The email field must be a valid email address."]}` | Pass |
| A06 | Update memakai email milik klien lain | PUT `/clients/2` dengan `email=alpha@qa.test` | 422 | BE | 422 `{"email":["The email has already been taken."]}` | Pass |
| A07 | `NPWP` tepat 20 karakter (batas) | POST `NPWP` = 20× `A` | 302 diterima | BE | 302, tersimpan (`id=4`) | Pass |
| A08 | `NPWP` 21 karakter (satu langkah melewati batas) | POST `NPWP` = 21× `A` | 422 | BE | 422 `{"NPWP":["The n p w p field must not be greater than 20 characters."]}` | Pass |
| A09 | `name` tepat 255 karakter (batas) | POST `name` = 255× `N` | 302 diterima | BE | 302, tersimpan (`id=5`) | Pass |
| A10 | `name` 256 karakter | POST `name` = 256× `N` | 422 | BE | 422 `{"name":["The name field must not be greater than 255 characters."]}` | Pass |
| A11 | Staff menghapus klien lewat URL langsung (tanpa `delete clients`) | DELETE `/c/qa-satu/clients/4` sebagai staff | 403, baris tidak hilang | BE | 403 `"This action is unauthorized."`, klien 4 masih ada | Pass |
| A12 | Finance manager menghapus klien lewat URL langsung | DELETE `/c/qa-satu/clients/4` sebagai manager | 403 | BE | 403 `"This action is unauthorized."` | Pass |
| A13 | Filter status huruf kecil pada query (meniru `RecurringInvoiceController` yang memakai `'active'`) | GET `?status=inactive`; bandingkan SQL `status='active'` vs `'Active'` | Harus konsisten dengan `Active`/`Inactive` | BE | `?status=inactive` → 2 baris (sama dengan `Inactive`). SQL: `status='active'` → 4, `status='Active'` → 4. Collation `utf8mb4_unicode_ci` menutupi inkonsistensi kapitalisasi — bekerja **karena collation**, bukan karena kode benar | Pass (rapuh — lihat TEMUAN C-03) |
| A14 | Pencarian digabung filter `type` — presedens `orWhere` | GET `?search=Rina&type=company` (Rina berjenis `individual`) | 0 baris | FE+BE | GAGAL pada percobaan pertama: `?search=Rina&type=company` mengembalikan `Rina Perorangan` yang bertipe `individual`. **Setelah TEMUAN C-01 diperbaiki**: dijalankan lewat layar — filter "Rina" + "Perusahaan" menampilkan **0-0 dari 0 klien** | Pass (percobaan ke-2) |
| A15 | Pencarian digabung filter `status` | GET `?search=Rina&status=Inactive` (Rina `Active`) | 0 baris | FE+BE | GAGAL pada percobaan pertama karena akar yang sama. **Setelah diperbaiki**: `?search=Alpha&type=individual` tidak lagi mengembalikan `PT Alpha Beta Gamma`. Ditutup tes regresi `ClientIntegrityTest` | Pass (percobaan ke-2) |
| A16 | Pencarian digabung filter `type` arah sebaliknya | GET `?search=Alpha&type=individual` (Alpha `company`) | 0 baris | FE+BE | GAGAL pada percobaan pertama: `?search=Rina&status=Inactive` mengembalikan klien ber-status `Active`. **Setelah diperbaiki**: 0 hasil. Ditutup tes regresi | Pass (percobaan ke-2) |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | **Invarian destruktif**: hapus klien ikut menghapus seluruh invoice + itemnya | Kondisi awal klien 6: 2 invoice ditagih (`id=3` nomor `002/INV/QS-RP/VIII/2026` status `paid`, `id=4` status `sent`), 2 pembayaran (Rp 1 + Rp 99.000.000), 3 `invoice_items` tersebar di invoice 1, 3, 4. DELETE `/c/qa-satu/clients/6` | Invoice 3 & 4 + itemnya terhapus; **invoice milik klien lain tidak terpengaruh** | BE | 302. `inv 12→10`, `items 14→11`, `pay 3→1`, `clients 6→5`. Invoice 3 & 4 hilang **benar**; namun dua efek samping ikut terjadi — lihat C02 & C03 | Pass (bagian yang dimaksudkan) |
| C02 | Efek samping C01 — item milik klien terhapus di invoice **milik klien lain**, header invoice jadi tidak konsisten | Sebelum: invoice 1 (`billed_to_id=2`, nomor `001/INV/QS-RP/VIII/2026`, status `partially_paid`) berisi item `id=1` (client 2, Rp 3.000.000) dan item `id=2` (client **6**, Rp 800.000), `subtotal=3.800.000`. Setelah DELETE klien 6, jalankan query konsistensi header vs Σ item | Invoice 1 tidak boleh berubah sama sekali | FE+BE | GAGAL pada percobaan pertama: penghapusan klien merusak invoice milik klien lain (`header_subtotal=3800000` vs `sum_item=3000000`) dan menghapus 2 pembayaran, saldo turun Rp 99.000.001 tanpa peringatan. **Setelah TEMUAN C-02 diperbaiki**: penghapusan ditolak sambil menyebut nomor invoice penahannya; override cascade pada model dihapus; FK `invoice_items.client_id`, `payments.invoice_id`, dan `payments.bank_account_id` diubah menjadi `restrictOnDelete` | Pass (percobaan ke-2) |
| C03 | Efek samping C01 — pembayaran ikut terhapus dan saldo bank turun diam-diam | Baca saldo `QA Kas Utama` sebelum dan sesudah DELETE klien 6 | Saldo tidak boleh berubah karena penghapusan klien | FE+BE | GAGAL pada percobaan pertama (terpicu C02). **Setelah diperbaiki**: pembayaran tidak dapat lenyap karena invoice ber-pembayaran pun ditolak penghapusannya; saldo bank tidak berubah. Ditutup tes regresi `test_invoice_dengan_pembayaran_tidak_dapat_dihapus` | Pass (percobaan ke-2) |
| C04 | Klien `Inactive` tidak muncul di opsi form invoice, tetapi tetap diterima backend | GET `/c/qa-satu/invoices/create` prop `clients`; lalu POST invoice dengan `client_id=1` (status `Inactive`) | Opsi tidak memuat klien Inactive **dan** backend menolak | FE+BE | GAGAL pada percobaan pertama: `POST /invoices` dengan klien `Inactive` berhasil (302) — aturan hanya ada di frontend. **Setelah TEMUAN C-04 diperbaiki**: `StoreInvoiceRequest` memakai `Rule::exists(...)->where('status', Client::STATUS_ACTIVE)`, permintaan ditolak 422. Ditutup tes regresi | Pass (percobaan ke-2) |
| C05 | Inisial nama klien dipakai pada nomor invoice | Klien 2 `Rina Perorangan` → invoice dikirim dengan nomor `001/INV/QS-RP/VIII/2026` | Inisial `RP` terbentuk dari nama klien | BE (referensi) | Nomor tersimpan `001/INV/QS-RP/VIII/2026`. **Catatan kejujuran:** `Invoice::getClientInitials()` **tidak** dipanggil oleh alur send — inisial pada nomor ini diketik pada payload uji. Pembentukan inisial oleh model diverifikasi lewat **baca kode** (`app/Models/Invoice.php::extractInitials`), bukan eksekusi. Lihat TEMUAN I-01 di `invoices.md` | Pass (sebagian lewat baca kode) |

## Temuan

### TEMUAN C-01 — Filter `type`/`status` bocor saat digabung pencarian (presedens `orWhere`)

- **SIFAT**: Bug logika query — hasil daftar salah. Keparahan: sedang.
- **MENGGAGALKAN**: A14, A15, A16.
- **GEJALA**: `GET /c/qa-satu/clients?search=Rina&type=company` mengembalikan
  `Rina Perorangan` yang bertipe `individual`. Idem `?search=Alpha&type=individual`
  mengembalikan `PT Alpha Beta Gamma` (`company`), dan `?search=Rina&status=Inactive`
  mengembalikan klien ber-status `Active`.
- **SEBAB**: `app/Http/Controllers/ClientController.php:24-28` merangkai
  `->where('name','like',…)->orWhere('email',…)->orWhere('NPWP',…)` **tanpa closure
  pembungkus**, lalu `->when($type, …->where('type',$type))` (baris 29-30)
  menambahkan `AND` pada level yang sama. SQL yang terbentuk menjadi
  `name LIKE ? OR email LIKE ? OR (NPWP LIKE ? AND type = ?)` karena `AND` mengikat
  lebih kuat daripada `OR`. Dibuktikan dengan SQL pembanding: bentuk berkurung
  benar → `0` baris, bentuk sesuai kode → `1` baris.
- **CAKUPAN**: Hanya `ClientController::index()`. `InvoiceController::index()`
  sudah membungkus pencariannya dalam `function ($query) use ($search)`
  (`InvoiceController.php:57-60`) sehingga aman; `ServiceController::index()`
  hanya mencari satu kolom sehingga tidak terdampak.
- **DIPERBAIKI**: grup pencarian dibungkus closure di `ClientController::index()`, sehingga SQL yang terbentuk kembali menjadi `(name LIKE ? OR email LIKE ? OR NPWP LIKE ?) AND type = ?`. Ditutup dua tes regresi (`type` dan `status`) di `tests/Feature/ClientIntegrityTest.php`.

### TEMUAN C-02 — Menghapus klien merusak invoice milik klien lain dan menghapus pembayaran (saldo bank turun diam-diam)

- **SIFAT**: Kehilangan & korupsi data keuangan. Keparahan: **kritis**.
- **MENGGAGALKAN**: C02, C03 (terpicu oleh C01).
- **GEJALA**: Setelah `DELETE /c/qa-satu/clients/6`:
  1. Invoice 1 — milik klien **2**, bernomor resmi `001/INV/QS-RP/VIII/2026`,
     status `partially_paid` — kehilangan satu itemnya. Query konsistensi:
     `header_subtotal=3800000` vs `sum_item=3000000`.
  2. `payments` berkurang dari 3 menjadi 1 baris; saldo `QA Kas Utama` turun dari
     `109.100.001` menjadi `10.100.000` (−Rp 99.000.001) tanpa peringatan apa pun.
- **SEBAB**: Dua mekanisme bertumpuk.
  1. `app/Models/Client.php:54-59` (`delete()` override) memanggil
     `$this->invoiceItems()->delete()` — relasi lewat `invoice_items.client_id`,
     **bukan** item milik invoice klien tersebut. Item atas nama klien ini yang
     menempel di invoice orang lain ikut dihapus. Diperkuat FK
     `database/migrations/tenant/2023_01_01_000007_create_invoice_items_table.php:14`
     — `client_id` `constrained()->cascadeOnDelete()`, jadi cascade terjadi di
     level DB bahkan tanpa override model.
  2. `database/migrations/tenant/2023_01_01_000008_create_payments_table.php:13` —
     `payments.invoice_id ... onDelete('cascade')`. Karena `$this->invoices()->delete()`
     adalah mass-delete query (tidak memicu event model), pembayaran lenyap lewat FK
     tanpa jejak. Saldo bank adalah accessor terhitung
     (`app/Models/BankAccount.php::getBalanceAttribute`) sehingga ikut turun otomatis.
- **CAKUPAN**: Akar yang sama menjangkau (a) `DELETE /invoices/{invoice}` — dibuktikan
  di `invoices.md` C07: menghapus invoice ber-pembayaran menurunkan saldo bank
  Rp 1.000.000 tanpa konfirmasi; (b) FK `payments.bank_account_id ... onDelete('cascade')`
  pada migration yang sama — menghapus rekening bank akan menghapus seluruh riwayat
  pembayaran yang menunjuk padanya (**belum diuji** dalam sesi ini).
- **DIPERBAIKI**, keempat-empatnya:
  1. `ClientController::destroy()` menolak penghapusan selama klien masih punya invoice
     atau item, sambil menyebut nomor invoice penahannya.
  2. Override `Client::delete()` yang meng-cascade **dihapus seluruhnya** — ia menghapus
     item lewat `invoice_items.client_id`, yaitu item atas nama klien ini yang menempel
     di invoice orang lain. Digantikan `Client::isDeletable()` yang hanya membaca.
  3. Migration `2026_08_20_100000_restrict_cascade_on_financial_foreign_keys` mengubah
     `invoice_items.client_id`, `payments.invoice_id`, dan `payments.bank_account_id`
     menjadi `restrictOnDelete`. Penjagaan controller hanya berlaku untuk jalur yang
     melewatinya; constraint database berlaku untuk semua jalur.
  4. `InvoiceController::destroy()` menolak penghapusan invoice yang sudah punya
     pembayaran, menyebut jumlah dan nilai rupiahnya — menutup pula temuan `invoices.md` C07.
- **CATATAN**: FK `payments.bank_account_id` yang disebut "belum diuji" pada putaran
  pertama ikut diperketat pada migration yang sama.

### TEMUAN C-03 — Inkonsistensi kapitalisasi status hanya tertutup oleh collation DB

- **SIFAT**: Kerapuhan laten. Keparahan: rendah (belum menimbulkan gejala).
- **MENGGAGALKAN**: tidak ada case yang gagal — A03 & A13 lolos.
- **GEJALA**: Tidak ada saat ini. Validasi menolak `active` huruf kecil (422), namun
  query `WHERE status='active'` dan `WHERE status='Active'` sama-sama mengembalikan
  4 baris.
- **SEBAB**: `clients.status` bercollation `utf8mb4_unicode_ci` (case-insensitive),
  sehingga `RecurringInvoiceController` yang memfilter `where('status','active')`
  tetap bekerja meskipun data selalu tersimpan `Active`/`Inactive`
  (`StoreClientRequest.php` → `in:Active,Inactive`; `InvoiceController::create()`
  → `where('status','Active')`).
- **CAKUPAN**: Seluruh query yang menyaring `clients.status`. Akan langsung rusak bila
  collation kolom diubah ke `_bin`/`_cs`, atau bila DB dipindah ke mesin
  case-sensitive.
- **DIPERBAIKI**: konstanta `Client::STATUS_ACTIVE` / `Client::STATUS_INACTIVE` diperkenalkan dan dipakai di `ClientController`, `InvoiceController`, `ReceivableController`, serta `RecurringInvoiceController` — enam tempat yang sebelumnya menulis literal dengan kapitalisasi berbeda.

### TEMUAN C-04 — Klien `Inactive` disaring hanya di frontend

- **SIFAT**: Aturan bisnis tidak ditegakkan backend. Keparahan: sedang.
- **MENGGAGALKAN**: C04.
- **GEJALA**: `POST /c/qa-satu/invoices` dengan `client_id=1` (status `Inactive`)
  → 302, invoice `id=7` terbuat untuk klien nonaktif.
- **SEBAB**: `InvoiceController::create()` (`InvoiceController.php:377`) memfilter
  `Client::where('status','Active')` hanya untuk **prop opsi**. `StoreInvoiceRequest`
  hanya mensyaratkan `'client_id' => ['required','exists:clients,id']` — tidak ada
  pemeriksaan status. Aturan yang hanya ada di FE = tidak ditegakkan.
- **CAKUPAN**: Sama untuk `UpdateInvoiceRequest` (`extends StoreInvoiceRequest`) dan
  `items.*.client_id`. Endpoint `/api/clients` bahkan mengembalikan klien Inactive
  ke Combobox modul lain (N11).
- **DIPERBAIKI**: `StoreInvoiceRequest` (yang juga diwarisi `UpdateInvoiceRequest`) kini memakai `Rule::exists('clients','id')->where('status', Client::STATUS_ACTIVE)` untuk `client_id` **dan** `items.*.client_id`. Ditutup tes regresi `test_invoice_tidak_dapat_dibuat_untuk_klien_nonaktif`.

### TEMUAN C-05 — Kolom urut & `per_page` tidak divalidasi: 500 yang membocorkan nama database

- **SIFAT**: Cacat ketahanan + kebocoran informasi. Ditemukan saat menjalankan ulang lewat layar.
- **GEJALA**: `?sort=(select 1)&direction=drop` menjatuhkan halaman ke **500** dengan pesan SQL lengkap — termasuk nama database dan struktur query. `?per_page=99999` menarik seluruh tabel sekaligus.
- **SEBAB**: `ClientController::index()` meneruskan `sort` dan `direction` mentah ke `orderBy()`, dan `per_page` mentah ke `paginate()`.
- **CAKUPAN**: Siapa pun yang bisa membuka daftar klien dapat memancing pesan galat yang menyebut nama database — informasi yang berguna bagi penyerang dan tidak berguna bagi pengguna.
- **DIPERBAIKI**: `sort` disaring lewat whitelist `KOLOM_URUT` (6 kolom), `direction` hanya menerima `asc`/`desc`, `per_page` dijepit ke rentang 1–100. Diverifikasi lewat layar: URL yang sama kini memuat halaman normal (bukti `A17-1`).

### TEMUAN C-06 — Nama klien tanpa spasi mendorong seluruh kolom keluar layar

- **SIFAT**: Cacat tata letak. Hanya terlihat dari layar.
- **GEJALA**: Klien uji batas bernama 255 karakter `N` beruntun membuat tabel melebar sampai kolom Tipe, Kontak, Status, Invoice, Finansial, dan Aksi terdorong keluar viewport — tabel praktis tidak bisa dipakai.
- **SEBAB**: Sel nama tidak punya batas lebar maupun aturan pemenggalan, sehingga satu kata sepanjang 255 karakter menentukan lebar kolom.
- **CAKUPAN**: Setiap daftar yang menampilkan teks bebas dari pengguna. Data uji batas memang ekstrem, tetapi nama panjang tanpa spasi (mis. domain atau kode) bukan hal mustahil.
- **DIPERBAIKI**: sel nama diberi `max-w-xs` + `wrap-break-word`. Diverifikasi lewat layar pada baris yang sama (bukti `A17-1`).

## Catatan pelaksanaan

- Seluruh pengujian dijalankan **lewat HTTP** ke `http://127.0.0.1:8000` memakai
  cookie sesi hasil login sungguhan (`POST /login`) untuk tiga akun, dengan header
  `X-XSRF-TOKEN` + `Accept: application/json` agar galat validasi terbaca sebagai
  JSON 422. **Tidak ada pengujian lewat browser/UI** — tidak ada klaim tentang
  tampilan layar, dialog, atau interaksi React di dokumen ini.
- Verifikasi hasil dilakukan langsung ke `tenant_qa-satu` lewat PDO (hanya SELECT):
  nilai kolom, `IS NULL`, jumlah baris sebelum/sesudah, dan query konsistensi
  `header_subtotal` vs `SUM(invoice_items.amount)`.
- Prop halaman Inertia (`stats`, `clients`, `filters`) dibaca dari tag
  `<script type="application/json">` pada respons HTML — inilah data yang benar-benar
  dikirim controller ke React.
- **Yang tidak diuji**: perilaku `ConfirmDialog` sebelum penghapusan (murni FE, butuh
  browser); unggah `logo` klien (tidak divalidasi/di-set form manapun); relasi
  self-referential owners/companies (memang tidak ada di kode); isolasi antar
  perusahaan (milik modul auth/multi-tenancy); dampak FK
  `payments.bank_account_id ON DELETE CASCADE`.
- **Kegagalan tooling (bukan cacat aplikasi)**: file body respons bawaan helper
  (`/tmp/qa_body.txt`) ternyata dipakai bersama agent QA lain sehingga isinya sempat
  tertukar; sejak itu semua pemanggilan dialihkan ke `/tmp/qa1_body.txt` milik sesi
  ini. Satu pengambilan `MAX(id)` lewat PDO gagal (`Access denied for user 'root'`)
  karena kredensial ditulis manual, bukan dari `.env`; diulang memakai helper `qa_db`.
