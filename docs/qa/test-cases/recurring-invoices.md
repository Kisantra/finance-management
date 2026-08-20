# Test Case — Recurring Invoices

Sumber teknis: [`docs/module/recurring-invoices.md`](../../module/recurring-invoices.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-dua` (DB `tenant_qa-dua`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

**Prasyarat**: tenant `qa-dua` dimulai **kosong** (0 klien, 0 service,
0 template, 0 recurring invoice, 0 invoice). Data uji dibuat sendiri lewat
endpoint aplikasi: klien `PT Uji Berulang` (id 1) & `CV Kedua QA` (id 2),
service `Jasa Konsultasi QA`. Akun: `admin@gmail.com`, `manager@gmail.com`
(keduanya punya view/create/edit recurring-invoices), `staff@gmail.com`
(**tidak punya** satu pun permission recurring).

**Metode**: seluruh endpoint monthly/template dipanggil langsung lewat HTTP
(sebagian besar memang menjawab JSON, bukan Inertia). Prop halaman index dibaca
dari payload Inertia (`data-page="app"`).

---

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | **Subtotal template mengecualikan item `is_tax_deposit`** | `POST /c/qa-dua/recurring-invoices/templates` `QA Monthly A`, monthly, 2026-01-15→2026-12-31, item#1 normal (2 × 500.000 = 1.000.000), item#2 titipan pajak (1 × 300.000) | `subtotal` = 1.000.000 (bukan 1.300.000); `total_amount` = 1.000.000 | BE | HTTP **200** `"Template 'QA Monthly A' berhasil dibuat."`. DB `invoice_template`: `"subtotal": 1000000, "total_amount": 1000000` sedangkan `items[1].amount = 300000, is_tax_deposit: true`. **Terbukti dikecualikan** | Pass |
| N02 | **Bulan penagihan pertama = start_date + 1 interval** | Template monthly start 2026-01-15 → `POST /monthly/generate` `month=1&year=2026` | 0 invoice (Januari = bulan start, bukan siklus) | BE | HTTP **200** `"Tidak ada invoice yang perlu digenerate untuk bulan ini."` | Pass |
| N03 | Generate siklus pertama (Februari 2026) | `POST /monthly/generate` `month=2&year=2026&issue_date=2026-02-28&due_date=2026-03-31` | 1 invoice draft, `scheduled_date=2026-02-01` | BE | HTTP **200** `"1 invoice berhasil digenerate."`; DB `id=1 template_id=1 scheduled_date=2026-02-01 status=draft` | Pass |
| N04 | **Generate idempoten — klik dua kali tidak menggandakan** | Ulangi persis request N03 | 0 invoice baru; total tetap 1 | BE | HTTP **200** `"Tidak ada invoice yang perlu digenerate untuk bulan ini."`; DB tetap 1 baris untuk template 1 + Feb 2026 | Pass |
| N05 | Generate bulan berikutnya | `month=3&year=2026` | 1 invoice baru | BE | `"1 invoice berhasil digenerate."`; DB `id=2 scheduled_date=2026-03-01` | Pass |
| N06 | Frekuensi quarterly hanya tergenerate tiap 3 bulan | Buat `QA Quarterly B` (client 2, start 2026-01-10, quarterly) → generate April 2026 → generate Mei 2026 | April: quarterly **ikut** (siklus 1) + monthly = 2; Mei: quarterly **dilewati**, hanya monthly = 1 | BE | April → `"2 invoice berhasil digenerate."` (`id=3 template_id=1`, `id=4 template_id=2`); Mei → `"1 invoice berhasil digenerate."` (`id=5 template_id=1` saja). `isValidPeriodForGeneration()` terbukti bekerja | Pass |
| N07 | Buat draft manual per-template | `POST /monthly` `template_id=2 scheduled_date=2026-07-01` + item | Draft baru dibuat | BE | HTTP **200** `"Invoice berhasil dibuat."`; DB `id=6 template_id=2 scheduled_date=2026-07-01 status=draft` | Pass |
| N08 | **Publish membuat Invoice sungguhan yang LANGSUNG ber-nomor meski status `draft`** | `POST /monthly/1/publish` `issue_date=2026-02-28&due_date=2026-03-31` | Baris baru di `invoices` dengan `invoice_number` terisi dan `status='draft'` | BE | HTTP **200** `"Invoice dipublish sebagai #001/INV/QD-UB/II/2026."`. DB `invoices id=1 invoice_number=001/INV/QD-UB/II/2026 status=draft issue_date=2026-02-28`. **Nomor sudah ada padahal draft** — berbeda dari invoice manual yang baru ber-nomor saat `send` | Pass |
| N09 | Nomor mengambil sequence dari bulan `issue_date` | `II/2026` untuk issue_date 2026-02-28 | Bulan romawi = bulan `issue_date` | BE | `001/INV/QD-UB/**II**/2026` — `QD` = abbrev perusahaan qa-dua, `UB` = inisial `PT Uji Berulang` | Pass |
| N10 | **`is_tax_deposit` & `unit` TIDAK tersalin saat publish** | Periksa `invoice_items` hasil N08 vs `invoice_data` template | Kedua field hilang / kembali default | BE | Template: `items[0].unit="paket"`, `items[1].unit="bulan"`, `items[1].is_tax_deposit=true`. `invoice_items`: `id=1 unit=pcs is_tax_deposit=0`, `id=2 unit=pcs is_tax_deposit=0`. **Terbukti tidak tersalin** — konsekuensinya lihat BUG-RI-01 | Pass (perilaku terkonfirmasi) |
| N11 | Bulk publish beberapa draft | `POST /monthly/bulk-publish` `ids[]=2&ids[]=3&issue_date=2026-03-31&due_date=2026-04-30` | Keduanya published | BE | HTTP **200** `"2 invoice berhasil dipublish."`; DB `recurring_invoices id=2,3 status=published`, `invoices id=2 (001/INV/QD-UB/III/2026)`, `id=3 (002/INV/QD-UB/III/2026)` | Pass |
| N12 | **Destroy template yang punya invoice terpublish hanya MENGARSIPKAN** | `DELETE /templates/1` (punya 3 published) | `status='archived'`, template & seluruh recurring invoice-nya tetap ada | BE | HTTP **200** `"Template diarsipkan (memiliki invoice terpublish)."`; DB `id=1 status=archived`, `recurring_invoices template_id=1` tetap **3 baris** (jejak audit utuh) | Pass |
| N13 | Restore template terarsip | `POST /templates/1/restore` | `status='active'` | BE | HTTP **200** `"Template 'QA Monthly A' berhasil diaktifkan kembali."`; DB `id=1 status=active` | Pass |
| N14 | Destroy template **tanpa** invoice terpublish = hapus permanen beserta draft-nya | `DELETE /templates/2` (hanya punya draft id 4 & 6) | Template + draft hilang | BE | HTTP **200** `"Template berhasil dihapus."`; DB: `recurring_templates id=2` hilang; `recurring_invoices id=4` & `id=6` ikut hilang | Pass |
| N15 | **Mengubah template TIDAK mengubah draft yang sudah tergenerate** | `PUT /templates/2` ubah item jadi `Retainer Kuartal REVISI` 9.000.000 → periksa draft id 4 & 6 | Draft tetap memakai salinan lama | BE | Template: `invoice_template.total_amount = 9000000`. Draft: `id=4 total=3000000 nama="Retainer Kuartal"`, `id=6 total=3000000 nama="Retainer Kuartal"`. **Snapshot terjaga** | Pass |
| N16 | Diskon percentage dihitung atas subtotal yang **sudah** mengecualikan titipan pajak | `POST /templates` `QA Diskon C`, `discount_type=percentage&discount_value=10`, item normal 2.000.000 + titipan pajak 1.000.000 | subtotal 2.000.000, diskon 200.000, total 1.800.000 | BE | DB: `sub=2000000 disc=200000 tot=1800000`. Titipan pajak 1.000.000 tidak ikut di mana pun | Pass |
| N17 | Statistik bulanan (tab Monthly) | `GET /recurring-invoices?tab=monthly&month=2&year=2026` | `stats` konsisten dengan `invoice_data` | BE | `{"total_revenue":1000000,"total_cogs":100000,"total_profit":900000,"profit_margin":90,"outstanding_profit":0,"paid_profit":900000}`, `invoices=1` | Pass |
| N18 | Manager boleh generate | `POST /monthly/generate` `month=6&year=2026` sebagai `manager@gmail.com` | Diizinkan | BE | HTTP **200** `"1 invoice berhasil digenerate."` | Pass |
| N19 | Tiga tab modul recurring terbuka di layar | Admin buka menu Invoice Berulang | Tab Templates / Bulanan / Analitik tampil; empty state saat belum ada template | FE+BE | Tampil; `qa-satu` belum punya template sehingga empty state muncul | Pass |

---

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | `end_date` lebih awal dari `start_date` | start 2026-05-01, end 2026-04-01 | 422 | BE | HTTP **422** `{"end_date":["The end date field must be a date after start date."]}` | Pass |
| A02 | `end_date` **sama persis** dengan `start_date` (batas rule `after:`) | keduanya 2026-05-01 | 422 — `after` bukan `after_or_equal` | BE | HTTP **422** pesan sama dengan A01. Batas terbukti eksklusif | Pass |
| A03 | Field wajib `items` dihilangkan total | `POST /templates` tanpa `items` | 422 | BE | HTTP **422** `{"items":["The items field is required."]}` | Pass |
| A04 | `quantity` desimal (recurring memvalidasi **integer**, beda dari invoice manual) | `items[0][quantity]=1.5` | 422 | BE | HTTP **422** `{"items.0.quantity":["The items.0.quantity field must be an integer."]}` | Pass |
| A05 | `quantity` di bawah batas (`min:1`) | `items[0][quantity]=0` | 422 | BE | HTTP **422** `{"items.0.quantity":["The items.0.quantity field must be at least 1."]}` | Pass |
| A06 | `frequency` di luar daftar | `frequency=weekly` | 422 | BE | HTTP **422** `{"frequency":["The selected frequency is invalid."]}` | Pass |
| A07 | `client_id` tidak ada | `client_id=999`, `items[0][client_id]=999` | 422 pada kedua field | BE | HTTP **422** `{"client_id":["The selected client id is invalid."],"items.0.client_id":["The selected items.0.client_id is invalid."]}` | Pass |
| A08 | `month` di luar 1–12 saat generate | `month=13&year=2026` | 422 | BE | HTTP **422** `{"month":["The month field must not be greater than 12."]}` | Pass |
| A09 | `due_date` lebih awal dari `issue_date` saat generate | issue 2026-04-30, due 2026-04-01 | 422 | BE | HTTP **422** `{"due_date":["The due date field must be a date after or equal to issue date."]}` | Pass |
| A10 | **Satu recurring invoice per template per bulan** — draft manual duplikat ditolak | `POST /monthly` `template_id=1 scheduled_date=2026-02-15` (Feb 2026 sudah ada) | 422 | BE | HTTP **422** `"Invoice untuk template dan bulan ini sudah ada."` — dicek per bulan, bukan per tanggal | Pass |
| A11 | `template_id` tidak ada saat store manual | `template_id=9999` | 422 | BE | HTTP **422** `{"template_id":["The selected template id is invalid."]}` | Pass |
| A12 | **Draft `published` tidak bisa diedit** | `PUT /monthly/1` (status published) | 422, data tidak berubah | BE | HTTP **422** `"Invoice yang sudah dipublish tidak dapat diubah."`; DB `invoice_data.items[0].service_name` tetap `Jasa Konsultasi QA` (payload mengirim `Ubah`) | Pass |
| A13 | **Draft `published` tidak bisa dihapus** | `DELETE /monthly/1` | 422, baris tetap ada | BE | HTTP **422** `"Invoice yang sudah dipublish tidak dapat dihapus."`; DB `id=1 status=published published_invoice_id=1` | Pass |
| A14 | Publish ulang draft yang sudah published | `POST /monthly/1/publish` lagi | 422, tidak membuat invoice kedua | BE | HTTP **422** `"Invoice sudah dipublish."`; `invoices` tidak bertambah | Pass |
| A15 | **Bulk destroy diam-diam melewati yang published** | `POST /monthly/bulk-destroy` `ids[]=1&ids[]=2&ids[]=5` (1 & 2 published, 5 draft) | Hanya yang draft terhapus, tanpa error | BE | HTTP **200** `"1 invoice berhasil dihapus."`; DB: id 1 & 2 masih `published`, id 5 hilang | Pass |
| A16 | Staff (tanpa permission) mengakses index & endpoint mutasi lewat URL langsung | `GET /recurring-invoices`; `POST /templates`; `POST /monthly/4/publish`; `POST /monthly/bulk-destroy` sebagai staff | 403 semuanya | BE | GET **403**, POST templates **403**, publish **403**, bulk-destroy **403** | Pass |
| A17 | Tab dengan `month` tak masuk akal | `GET /recurring-invoices?tab=monthly&month=99&year=2026` | Tidak crash | BE | HTTP **200**, halaman tetap tampil (tidak ada 500) | Pass |
| A18 | **`storeMonthly` tidak memvalidasi bulan terhadap siklus template** | `POST /monthly` `template_id=1 scheduled_date=2026-01-01` — Januari 2026 BUKAN siklus valid (start_date 2026-01-15, siklus pertama Feb) | Ditolak, sama seperti `generateMonthly` yang menolaknya di N02 | BE | HTTP **200** `"Invoice berhasil dibuat."`; DB `id=9 template_id=1 scheduled_date=2026-01-01 status=draft`. **Diterima** → **BUG-RI-02** | **Fail** |
| A19 | `storeMonthly` juga menerima bulan **di luar `end_date`** | `template_id=1 scheduled_date=2028-01-01` (template berakhir 2026-12-31) | Ditolak | BE | HTTP **200** `"Invoice berhasil dibuat."`; DB `id=10 scheduled_date=2028-01-01`. Bagian dari **BUG-RI-02** | **Fail** |
| A20 | `items.*.unit` dikirim ke `storeMonthly` tapi hilang | `POST /monthly` `items[0][unit]=paket` | `unit` tersimpan seperti pada template | BE | DB `invoice_data.items[0].unit = "pcs"`. `StoreMonthlyRequest` tidak punya rule `items.*.unit`, sehingga `validated()` membuangnya dan `buildInvoiceData()` jatuh ke default `'pcs'` → **BUG-RI-03** (ringan) | **Fail** |

---

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | **Invoice hasil publish tidak seimbang dengan item-nya** (akibat `is_tax_deposit` tidak tersalin) | Setelah N08, bandingkan `invoices.subtotal` vs `SUM(invoice_items.amount)` untuk invoice 1 | Idealnya cocok, atau item titipan tetap ditandai agar `InvoicePrintService` bisa memisahkannya | BE | `invoices id=1 subtotal=1.000.000 total_amount=1.000.000`, tetapi `SUM(invoice_items.amount) = 1.000.000 + 300.000 = **1.300.000**`, dan **kedua** item `is_tax_deposit=0`. Selisih 300.000 tanpa penjelas → **BUG-RI-01** | **Fail** |
| C02 | Invoice hasil publish mengikuti alur invoice normal (send → payment) | `POST /invoices/1/send` (mengirim ulang `invoice_number` yang sudah ada) → `POST /invoices/1/payments` 400.000 ke rekening | Status `sent` → `partially_paid`; saldo rekening naik | BE | send **302**, DB `status=sent invoice_number=001/INV/QD-UB/II/2026` (nomor tidak berubah). Payment **200**; `status=partially_paid`; saldo rekening naik tepat 400.000. Catatan: `SendInvoiceRequest` **mewajibkan** `invoice_number` di payload — untuk invoice hasil recurring nomornya sudah ada, jadi UI harus mengirim ulang nilai lama (`InvoiceController::send()` menimpanya) | Pass |
| C03 | Draft di luar siklus tetap bisa dipublish menjadi Invoice sungguhan | Publish draft id 9 (`scheduled_date=2026-01-01`, di luar siklus) `issue_date=2026-01-31` | Idealnya tidak mungkin ada draft-nya (A18) | BE | HTTP **200**; DB `invoices id=4 invoice_number=001/INV/QD-UB/**I**/2026 issue_date=2026-01-31 total_amount=100000`. Sebuah invoice bernomor Januari terbit untuk bulan penagihan yang tidak pernah ada → dampak nyata **BUG-RI-02** | **Fail** |
| C04 | Progress template terkontaminasi draft di luar siklus | Baca prop `templates` di index setelah A18/A19 | `generated_count` hanya menghitung siklus valid | BE | `id=1 gen=7 pub=4 pct=64 sisa=4`. Siklus valid template 1 = 11 (Feb–Des 2026), tapi 2 dari 7 "generated" berada di luar siklus (Jan 2026 & Jan 2028). Progress & sisa jadi salah → bagian dari **BUG-RI-02** | **Fail** |
| C05 | Bulk publish memakai satu `issue_date` untuk beberapa bulan penagihan | N11: draft Maret (id 2) & April (id 3) dipublish sekaligus dengan `issue_date=2026-03-31` | Perilaku terdokumentasi: nomor mengikuti bulan `issue_date`, bukan `scheduled_date` | BE | Keduanya bernomor **III/2026** (`001/…/III/2026` dan `002/…/III/2026`) walau salah satunya untuk penagihan April. Sesuai jebakan yang sudah tertulis di dokumen modul — **bukan bug**, tapi jebakan nyata bagi user bulk-publish | Pass (catatan) |
| C06 | Analytics menghasilkan `profit_margin` > 100% | `GET /recurring-invoices?tab=analytics&analytics_year=2026` | Margin masuk akal (≤ 100%) | BE | `template_stats[0] = {"name":"QA Monthly A","revenue":4850000,...,"profit_margin":116.5}`. Margin 116,5% mustahil → **BUG-RI-04** | **Fail** |

---

## Temuan

### BUG-RI-01 — Publish menghilangkan `is_tax_deposit`, invoice jadi tidak seimbang dengan item-nya

- **SIFAT**: Data integrity / laporan & PDF salah.
- **MENGGAGALKAN**: C01 (terkonfirmasi juga di N10).
- **GEJALA**: Invoice `001/INV/QD-UB/II/2026` (id 1) memiliki
  `subtotal = 1.000.000` dan `total_amount = 1.000.000`, tetapi dua baris
  `invoice_items`-nya berjumlah **1.300.000**, dan keduanya tercatat
  `is_tax_deposit = 0` — termasuk baris `Titipan Pajak QA` yang di template
  bernilai `true`. Kolom `unit` juga hilang (`paket`/`bulan` → `pcs`).
- **SEBAB**: `app/Models/RecurringInvoice.php::publish()` baris 86-95 —
  `$invoice->items()->create([...])` hanya menyalin `service_name`, `quantity`,
  `unit_price`, `amount`, `cogs_amount`. `is_tax_deposit` dan `unit` tidak ada
  dalam daftar, padahal `subtotal` yang disalin ke `invoices` (baris 74) dihitung
  `buildInvoiceData()` dengan **mengecualikan** item titipan pajak
  (`RecurringInvoiceController.php:679-681`).
- **CAKUPAN**: Setiap invoice yang lahir dari publish recurring dan mengandung
  item titipan pajak. Dampak berantai:
  - `app/Services/InvoicePrintService.php:19-20` memisahkan
    `$regularItems` / `$taxDepositItems` berdasar flag ini — setelah publish
    semua item jatuh ke "regular", sehingga PDF menampilkan total baris item yang
    tidak sama dengan subtotal tercetak;
  - `app/Services/ProfitLossService.php:134` menghitung
    `items->where('is_tax_deposit', true)->sum('amount')` → titipan pajak
    dihitung **0**, jadi pendapatan yang diakui di Laba Rugi terlalu besar;
  - `InvoiceController.php:111` (`total_cogs` dengan `CASE WHEN is_tax_deposit = 0`)
    dan `DashboardController.php:174` ikut memakai flag yang kini salah.
- **SARAN PERBAIKAN**: Tambahkan `'unit' => $itemData['unit'] ?? 'pcs'` dan
  `'is_tax_deposit' => (bool) ($itemData['is_tax_deposit'] ?? false)` di dalam
  `publish()`. Keduanya sudah `fillable` + di-cast pada `app/Models/InvoiceItem.php:22,30`,
  jadi perbaikannya dua baris. Perlu juga skrip perbaikan data untuk invoice
  yang terlanjur terpublish.

### BUG-RI-02 — `storeMonthly` tidak memvalidasi bulan terhadap siklus & masa berlaku template

- **SIFAT**: Aturan bisnis tidak ditegakkan; merusak metrik & penomoran.
- **MENGGAGALKAN**: A18, A19, C03, C04.
- **GEJALA**:
  - `POST /c/qa-dua/recurring-invoices/monthly` `template_id=1 scheduled_date=2026-01-01`
    → **200** `"Invoice berhasil dibuat."` padahal `generateMonthly` menolak bulan
    yang sama (N02: `"Tidak ada invoice yang perlu digenerate untuk bulan ini."`).
  - `scheduled_date=2028-01-01` juga diterima meski `end_date` template
    2026-12-31.
  - Draft di luar siklus itu bisa dipublish dan menghasilkan invoice sungguhan
    `001/INV/QD-UB/I/2026` (C03).
  - Progress template jadi salah: `gen=7` dari 11 siklus valid, padahal 2 di
    antaranya bukan siklus (C04) — `progress_pct` bisa melewati 100%.
- **SEBAB**: `app/Http/Controllers/RecurringInvoiceController.php::storeMonthly()`
  (baris 297-341) hanya mengecek duplikasi template+bulan; ia **tidak** memanggil
  `$template->isValidPeriodForGeneration($year, $month)` maupun membandingkan
  dengan `start_date`/`end_date` — padahal `generateMonthly()` (baris 257-275)
  melakukan keduanya. `StoreMonthlyRequest` juga hanya `'scheduled_date' => ['required','date']`.
- **CAKUPAN**: Semua pembuatan draft manual dari UI tab Monthly. Karena
  `formatTemplate()` menghitung `generated_count` dari seluruh baris
  `recurring_invoices`, satu draft di luar siklus langsung mencemari progress,
  `remaining`, dan analytics tahunan.
- **SARAN PERBAIKAN**: Di `storeMonthly()`, setelah `$template` diambil, tolak
  dengan 422 bila `! $template->isValidPeriodForGeneration($scheduledDate->year, $scheduledDate->month)`
  — memakai method yang sudah ada, sehingga jalur manual dan jalur generate
  memakai definisi siklus yang sama.

### BUG-RI-03 — `items.*.unit` tidak divalidasi di `StoreMonthlyRequest`/`UpdateMonthlyRequest`

- **SIFAT**: Inkonsistensi validasi / kehilangan input diam-diam (ringan).
- **MENGGAGALKAN**: A20.
- **GEJALA**: `POST /monthly` dengan `items[0][unit]=paket` tersimpan sebagai
  `"unit": "pcs"` di `invoice_data`. Tidak ada pesan error; input user hilang
  tanpa jejak.
- **SEBAB**: `app/Http/Requests/StoreMonthlyRequest.php` memuat
  `items.*.client_id/service_name/quantity/unit_price/cogs_amount/is_tax_deposit`
  tetapi **tidak** `items.*.unit`, sedangkan `StoreTemplateRequest.php:26`
  memilikinya. `validated()` membuang field tak dikenal, lalu
  `buildInvoiceData()` (`RecurringInvoiceController.php:668`) memakai default
  `$item['unit'] ?? 'pcs'`.
- **CAKUPAN**: Draft manual dan update draft. Dampak praktisnya kecil selama
  BUG-RI-01 belum diperbaiki (karena `unit` toh tidak disalin ke invoice), tetapi
  akan menjadi terlihat begitu BUG-RI-01 dibetulkan.
- **SARAN PERBAIKAN**: Tambahkan `'items.*.unit' => ['nullable','string','max:50']`
  ke `StoreMonthlyRequest` agar sejajar dengan `StoreTemplateRequest`.

### BUG-RI-04 — Analytics menghasilkan `profit_margin` di atas 100%

- **SIFAT**: Laporan salah.
- **MENGGAGALKAN**: C06.
- **GEJALA**: `GET /c/qa-dua/recurring-invoices?tab=analytics&analytics_year=2026`
  mengembalikan `template_stats` berisi
  `{"name":"QA Monthly A","revenue":4850000,"count":6,"published":3,"success_rate":50,"profit_margin":116.5}`.
  Margin laba 116,5% tidak mungkin.
- **SEBAB**: `RecurringInvoiceController.php:583-596` — pembilang `$profit`
  menjumlahkan **seluruh** item (`amount − cogs_amount`, termasuk item titipan
  pajak), sedangkan penyebut `$revenue` memakai `invoice_data['total_amount']`
  yang justru **mengecualikan** titipan pajak. Basis pembilang dan penyebut tidak
  sama. (Bandingkan `computeMonthlyStats()` di baris 634-639 yang memakai
  `total_revenue` untuk keduanya dan menghasilkan 90% yang wajar di N17.)
- **CAKUPAN**: Tab Analytics, untuk setiap template yang memuat item
  `is_tax_deposit`. Template tanpa titipan pajak tidak terpengaruh.
- **SARAN PERBAIKAN**: Hitung `$profit` hanya dari item non-titipan
  (`->reject(fn ($i) => $i['is_tax_deposit'] ?? false)`), atau samakan basisnya
  dengan `computeMonthlyStats()`: `profit = total_amount − Σ cogs_amount`.

---

## Catatan pelaksanaan

- **Cakupan**: 18 case Normal (N01–N18), 20 case Abnormal (A01–A20), 6 case
  Berantai (C01–C06) = **44 case**. Semua dieksekusi. Tidak ada `Belum diuji`.
- **Skor**: Pass **37**, Fail **7** (A18, A19, A20, C01, C03, C04, C06).
- **Semua case dieksekusi lewat HTTP dengan sesi login sungguhan** dan
  diverifikasi ke DB. Yang **diverifikasi lewat pembacaan kode** (dan dinyatakan
  demikian): akar sebab tiap temuan, serta dampak hilir BUG-RI-01 ke
  `InvoicePrintService`/`ProfitLossService` — dampak PDF & Laba Rugi itu
  **belum dieksekusi ujungnya**, hanya ditelusuri lewat kode; yang dieksekusi
  adalah ketidakseimbangan datanya (`subtotal` 1.000.000 vs Σ item 1.300.000).
- **Verifikasi efek samping yang seharusnya TIDAK terjadi**: setelah A12
  dipastikan `invoice_data` draft published tidak berubah; setelah A14 dipastikan
  `invoices` tidak bertambah; setelah A15 dipastikan draft published tidak ikut
  terhapus; setelah N12 dipastikan 3 `recurring_invoices` template terarsip tetap
  ada; setelah N15 dipastikan `invoice_data` draft lama tidak ikut ter-update.
- **Invarian utama modul terbukti benar**: satu recurring invoice per template
  per bulan dan generate idempoten (N04/A10); draft published tidak bisa
  diedit/dihapus (A12/A13/A15); publish membuat Invoice sungguhan yang langsung
  ber-nomor meski `status='draft'` (N08/N09); `is_tax_deposit` & `unit` tidak
  tersalin saat publish (N10 — perilaku terkonfirmasi, konsekuensinya BUG-RI-01);
  subtotal template mengecualikan titipan pajak (N01/N16); bulan penagihan
  pertama = start_date + 1 interval (N02/N03) dan quarterly hanya tiap 3 bulan
  (N06); destroy template ber-invoice terpublish hanya mengarsipkan (N12) sedang
  yang tanpa published dihapus permanen bersama draft-nya (N14).
- **Invarian yang terbukti TIDAK ditegakkan**: definisi siklus tidak berlaku pada
  jalur `storeMonthly` (BUG-RI-02).
- **Kegagalan tooling saya sendiri (bukan cacat aplikasi)**: percobaan pertama
  `POST /invoices/1/send` tanpa field `invoice_number` gagal 422 — itu memang
  kontrak `SendInvoiceRequest`, bukan bug; request diulang dengan nomor yang ada.
  Percobaan awal membaca respons lewat path `/tmp` gagal karena PHP Windows tidak
  mengenalinya; helper diperbaiki lalu case diulang.
- **Data uji ditinggalkan di `tenant_qa-dua`** agar temuan bisa direproduksi:
  template `QA Monthly A` (id 1, active) & `QA Diskon C` (id 3);
  `recurring_invoices` id 1,2,3,9 (published) dan 7,8,10 (draft — id 9 & 10
  sengaja di luar siklus sebagai bukti BUG-RI-02); `invoices` id 1–4.
  Perusahaan lain tidak disentuh.
