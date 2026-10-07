# Modul: Invoice & Pembayaran

> Modul inti untuk menagih klien: membuat invoice berisi item layanan (dengan HPP/COGS dan titipan pajak), mengirimkannya (penomoran resmi), mencatat pembayaran ke rekening bank, serta mengekspor rekap (Excel/PDF) dan mencetak invoice per-lembar (PDF klasik maupun template builder). Route prefix: `/invoices` (CRUD + export), `/payments` (update/hapus pembayaran), `/invoice/{invoice}/download|preview` (PDF), `POST /invoices/preview` (PDF pratinjau editor dari data belum tersimpan). Semua route digate permission Spatie: `view invoices` (grup), plus `create invoices`, `edit invoices`, `delete invoices` per aksi; `send` dan `rollback` ikut digate `edit invoices` (lihat `routes/web.php` baris 133–203).

## Tabel Database

### `invoices`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_number` | string, **nullable saat draft**; diisi saat "send" mengikuti **format yang bisa diatur** di Pengaturan › Penomoran invoice (default `{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}`, mis. `001/INV/KSN-ABC/VIII/2026`). Unique (divalidasi di `SendInvoiceRequest`). |
| `invoice_sequence` | unsigned int nullable — nomor urut di dalam `invoice_number`, **diisi otomatis** oleh hook `saving` model setiap kali `invoice_number` berubah (`InvoiceNumberService::sequenceOf()` dengan pola aktif); null untuk draft dan nomor manual yang tidak cocok pola. Dasar hitungan nomor berikutnya & aturan rollback. Diisi untuk data lama oleh migrasi 2026-10-08 (angka di depan `/INV/`). |
| `billed_to_id` | FK → `clients.id` (relasi `client()` di model) |
| `subtotal` | **integer rupiah penuh** — jumlah `amount` semua item |
| `discount_amount` / `discount_type` / `discount_value` / `discount_reason` | diskon; `discount_type` = `fixed` \| `percentage`; `discount_amount` adalah hasil hitung (integer) |
| `total_amount` | integer = `max(0, subtotal - discount_amount)` |
| `issue_date`, `due_date` | date (cast `date` di model) |
| `status` | enum: `draft`, `sent`, `paid`, `partially_paid`, `overdue`, `cancelled` |
| `faktur` | string nullable — nomor faktur pajak (konteks PKP/PPN). Saat ini hanya dibaca/ditampilkan (index & show); belum ada endpoint yang menulisnya. |

### `invoice_items`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_id` | FK → `invoices.id` |
| `client_id` | FK → `clients.id` — item bisa atas nama klien berbeda dari `billed_to_id` (kasus satu invoice menagih beberapa entitas klien) |
| `service_name` | string bebas (disalin dari master `services`, bukan FK) |
| `quantity` | decimal (cast `decimal:3`) — boleh pecahan, min `0.001` |
| `unit` | string satuan, default `'pcs'` |
| `unit_price`, `amount`, `cogs_amount` | integer rupiah penuh; `amount = round(unit_price × quantity)` |
| `is_tax_deposit` | boolean — item "titipan pajak": dikecualikan dari omzet/laba (lihat accessor `net_revenue`/`net_profit` di `app/Models/InvoiceItem.php`) |

### `payments`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_id` | FK → `invoices.id` |
| `bank_account_id` | FK → `bank_accounts.id` — **wajib** (`StorePaymentRequest`), pembayaran menaikkan saldo bank secara dinamis |
| `amount` | integer rupiah penuh, min 1 |
| `payment_date` | date |
| `payment_method` | enum: `cash` \| `bank_transfer` |
| `reference_number` | string nullable |
| `attachment_path`, `attachment_name` | bukti bayar (jpg/jpeg/png/pdf, max 5 MB) di disk `public` folder `payments/`; file ikut terhapus saat model dihapus (hook `deleting` di `app/Models/Payment.php`) |

## Fitur

### Daftar Invoice (Index + Statistik)
**Alur step-by-step:**
1. User membuka `/invoices` (GET, `can:view invoices`). Query string: `search`, `status` (`draft|sent|partially_paid|paid|overdue`), `client_ids[]`, `month` (default bulan berjalan `Y-m`), `date_from`/`date_to`, `per_page`, `sort`, `direction`.
2. `InvoiceController::index()` membangun query dengan join `clients` + subquery jumlah `payments` per invoice, memfilter periode via `applyPeriodFilter()` (range tanggal **menimpa** filter bulan bila salah satu bound terisi).
3. Kartu statistik mengikuti **semua** filter aktif termasuk tab status (sejak QA 2026-09-21; sebelumnya status diabaikan dan angka kartu terasa "tidak sesuai filter"). Hanya **hitungan per tab** yang mengabaikan status agar tab lain tidak membaca 0. Revenue/HPP/laba **mengecualikan `draft` dan `cancelled`**; `total_cogs` mengecualikan item `is_tax_deposit`; outstanding = billed − paid pada invoice `sent`/`partially_paid`.
4. **"Perlu ditagih"** (`status=overdue`) bukan status tersimpan: `applyStatusFilter()` memilih `sent`/`partially_paid` dengan `due_date < today` dan **mengabaikan filter periode** (lintas bulan), tetap ikut klien/pencarian. `stats.overdue_count` & `stats.overdue_amount` (Σ sisa tagihan) selalu dihitung lintas bulan, tidak terpengaruh tab.
5. Tanggal di baris daftar dikirim sebagai `Y-m-d` (bukan ISO UTC) — zona waktu app `Asia/Makassar` membuat ISO UTC mundur sehari di browser (QA 2026-09-26, BUG-02).
6. Respons: `Inertia::render('invoices/index', ...)` dengan props `invoices` (paginated), `stats`, `clients`, `customTemplates` (daftar `PdfTemplate` builder), `selectedInvoiceId`, `filters`.
7. UI (gaya Obsidian): kartu ringkasan (total ditagih, sudah dibayar, belum dibayar, perlu ditagih + bar sebaran status), pil status + pil "Perlu ditagih", tabel. Klik baris → drawer detail (lihat berikut).

Kelayakan rollback dihitung per invoice di `data()` (`rollbackable` = status `sent` dan `Invoice::isInvoiceLatestInMonth()`), sama dengan aturan yang ditegakkan `rollback()`.

### Detail Invoice (modal global `#invoice/{id}`)
Detail invoice adalah **modal yang menumpang di halaman mana pun**, seperti Settings di claude.ai: halaman di belakang tidak berganti, URL hanya ditambah hash. Contoh: dari Ringkasan → `/dashboard#invoice/13`; dari daftar → `/invoices?month=2026-09#invoice/13`.

**Alur step-by-step:**
1. Tautan detail adalah anchor biasa ke `#invoice/{id}` (`resourceHref()`), atau `openResource('invoice', id)` dari kode (klik baris daftar, notifikasi). Tidak ada permintaan ke server untuk halaman di belakang.
2. `lib/resource-modal.ts::installResourceModal()` (dipasang di `inertia.tsx` **sebelum** `createInertiaApp`) mencegat `popstate` yang hanya mengubah hash: Inertia tidak menangani (tidak menggulir ke atas / memasang ulang halaman), lalu `router.replace` sisi klien menyamakan URL & state riwayat Inertia.
3. `ResourceModalHost` (`components/resource-modal-host.tsx`, dirender `AppLayout`) membaca **`window.location.hash`** lewat `useResource()` — bukan `usePage().url`, karena saat halaman dimuat ulang Inertia menempelkan hash ke objek halamannya tanpa memicu render ulang — dan me-render `InvoiceDrawer` (dimuat malas).
4. Drawer mengambil `GET /invoices/{id}/data` (JSON: header + `amount_paid`/`amount_remaining`, klien, `items` (+ `client_name`), `payments` (+ `created_at`), `next_invoice_number` untuk draft, `rollbackable`, `custom_templates`, `created_at`/`updated_at`) — mandiri, tidak butuh props halaman invoice. 404 → "Invoice tidak ditemukan", halaman di belakang tetap.
5. Aksi di drawer (kirim, rollback, hapus, bayar) memakai **fetch JSON** (`send`/`rollback`/`destroy` menjawab JSON bila `expectsJson()`, lewat `actionResult()`), bukan kunjungan Inertia yang akan mengganti halaman di belakang. Setelah berhasil drawer memuat ulang datanya dan host memanggil `router.reload()` — URL sama sehingga Inertia mempertahankan hash dan modal tetap terbuka, sementara angka di halaman belakang ikut segar.
6. Tutup: bila modal dibuka dari dalam aplikasi → `history.back()`; bila datang dari tautan/refresh → `router.replace` ke URL tanpa hash. Back/Forward browser menutup/membuka ulang modal; refresh dan tautan yang dibagikan (tombol salin tautan menyalin `location.href`) membuka halaman yang sama dengan modal terbuka.
7. Rute lama `GET /invoices/{id}` (`show()`, notifikasi lama, redirect setelah simpan) tetap merender daftar dengan `selectedInvoiceId`; halaman daftar langsung mengubahnya menjadi `/invoices#invoice/{id}` (`showResource()`). Notifikasi jatuh tempo baru memakai `/invoices#invoice/{id}` dan membuka modal di halaman yang sedang dibuka.
8. Isi drawer: metrik (total, dibayar, sisa, laba kotor), tab **Ringkasan** (item, total, riwayat dari `created_at` + pembayaran, kartu klien, daftar pembayaran edit/hapus) dan **Pratinjau cetak** (PDF asli via `/invoice/{id}/preview`). Aksi: Cetak, Kirim invoice (draft), Catat pembayaran (sent/partial), menu Edit / Kembalikan ke draft / Hapus, salin tautan.

### Buat Invoice (Create + Store)
**Alur step-by-step:**
1. User klik "Buat Invoice" → GET `/invoices/create` (`can:create invoices`). Props dari `formOptions()`: klien `Active` (id, name, email, npwp, type) dan `services`. Editor (`InvoiceEditor` di `create.tsx`, dipakai juga `edit.tsx`): kiri isian, kanan **pratinjau PDF langsung**.
2. User memilih klien, tanggal (jatuh tempo default +14 hari), menyusun item (nama layanan dengan saran katalog saat mengetik, atau tombol katalog 🔍 di setiap baris yang mengisi nama & harga baris itu saja, qty, harga, satuan, **HPP baris** = HPP seluruh baris, sakelar titipan pajak), opsional "Tagih ke beberapa klien" (klien per baris), dan diskon nominal/persen + alasan. Ctrl+Enter menambah baris.
3. **Pratinjau langsung:** setiap isian berubah (jeda 350 ms, permintaan lama dibatalkan) editor mengirim `POST /invoices/preview` (`InvoicePreviewRequest`, semua field boleh kosong) → `preview()` membangun `Invoice` + `InvoiceItem` **tanpa menyimpan** (relasi di-`setRelation`), lalu `InvoicePrintService::renderPdf()` — jalur yang sama dengan unduhan — dan membalas **PDF**; nomor (tersimpan atau perkiraan `generateInvoiceNumber`) di header `X-Invoice-Number`. Parameter `highlight` (indeks baris yang sedang diedit) menyuntikkan CSS latar biru pada baris itu — hanya di pratinjau. Browser menampilkan PDF dengan penampil bawaan (`#toolbar=0&view=FitH`).
4. Submit → POST `/invoices`, divalidasi `StoreInvoiceRequest` (pesan Indonesia di `messages()`, mis. "Nama layanan baris 1 wajib diisi."). Tombol **Simpan draft** atau **Simpan & terbitkan** (`publish=1`).
5. `store()` dalam `DB::transaction`: `buildInvoiceData()` (satu-satunya tempat hitungan: `amount = round(unit_price × quantity)`, `subtotal`, `discount_amount`, `total_amount = max(0, subtotal − discount)`) → insert `draft` tanpa nomor + items; bila `publish`, `publish()` memberi `generateInvoiceNumber()` dan status `sent` di transaksi yang sama.
6. Redirect ke **`invoices.show`** (drawer invoice baru terbuka) dengan flash `success`.

**Penjelasan kode** (`app/Http/Controllers/InvoiceController.php::store`):
```php
$discountAmount = $discountType === 'percentage'
    ? (int) round($subtotal * $discountValue / 100)
    : $discountValue;
$totalAmount = max(0, $subtotal - $discountAmount);

$invoice = Invoice::create([... 'status' => 'draft']);
```
Diskon persentase dikonversi ke nominal integer saat simpan (kedua bentuk disimpan: `discount_value` mentah + `discount_amount` hasil). Invoice selalu lahir sebagai `draft` tanpa nomor — nomor baru diberikan saat "send".

### Edit Invoice (Edit + Update)
**Alur:** GET `/invoices/{invoice}/edit` (`can:edit invoices`) merender `invoices/edit` dengan data invoice + items; PUT `/invoices/{invoice}` divalidasi `UpdateInvoiceRequest` (identik dengan Store — `class UpdateInvoiceRequest extends StoreInvoiceRequest {}`). `update()` memakai `buildInvoiceData()` yang sama, lalu **menghapus semua item lama dan membuat ulang** dalam satu transaksi. Status dan `invoice_number` tidak diubah, kecuali `publish=1` pada invoice `draft` (Simpan & terbitkan). Redirect ke `invoices.show`.

### Hapus Invoice (Destroy)
**Alur:** DELETE `/invoices/{invoice}` (`can:delete invoices`) → **ditolak dengan flash `error`** bila invoice sudah punya pembayaran ("Invoice yang sudah memiliki pembayaran tidak dapat dihapus. Hapus pembayarannya terlebih dahulu."); jika tidak, transaksi: hapus `invoice_items` lalu invoice; redirect back. Guard ini mencegah FK cascade menghapus `payments` diam-diam (yang menurunkan saldo bank tanpa peringatan dan meninggalkan file lampiran yatim).

### Kirim Invoice (Send — penomoran resmi)
**Alur step-by-step:**
1. Di drawer invoice `draft`, user klik "Kirim invoice" → dialog **terisi otomatis** dengan `next_invoice_number` dari `/invoices/{id}/data` (dihitung server via `Invoice::generateInvoiceNumber($issue_date, $billed_to_id)` → `InvoiceNumberService::next()`, jadi inisial klien sama persis dengan backend); user masih boleh mengubahnya sebelum konfirmasi.
2. POST `/invoices/{invoice}/send` payload `{ invoice_number }`, divalidasi `SendInvoiceRequest` (`unique:invoices,invoice_number` kecuali dirinya; pesan "Nomor ini sudah dipakai invoice lain." + tautan "Pakai nomor yang disarankan" di UI).
3. `send()` menolak jika status bukan `draft` (flash `error`). Jika lolos: `$invoice->update(['invoice_number' => ..., 'status' => 'sent'])`; hook `saving` model mengisi `invoice_sequence` dari nomor itu.

**Penjelasan kode** (`app/Services/InvoiceNumberService.php` — satu-satunya tempat nomor disusun):

- `settings()` membaca `invoice_number_format`, `invoice_number_padding` (1–5, jumlah digit **minimum** `{NO}`; 1 = tanpa nol di depan; urutan tetap bertambah melewatinya), `invoice_number_reset` (`monthly`/`yearly`/`never`) dari `CompanyProfile::current()`, dengan default format lama bila belum diisi.
- `next($issueDate, $clientId)` = `render()` pola dengan `nextSequence()` (MAX `invoice_sequence` dalam periode reset `issue_date` + 1). Token: `{NO}` (urutan, diberi nol sesuai padding), `{PT}` (inisial **nama** perusahaan — sama dengan perilaku lama, bukan kolom `abbreviation`; "SPI" bila profil kosong), `{KLIEN}` (inisial klien/nama perusahaan klien, lewati PT/CV/dst.; "XXX" bila tidak ada), `{BLN_ROMAWI}`, `{BLN}`, `{THN}`, `{THN2}`.
- `sequenceOf($number)` membangun regex dari pola aktif: `{NO}` → `(\d+)`, token lain dicocokkan per jenis karakter (bukan nilainya) agar nomor tetap terbaca walau nama perusahaan/klien berubah. Dipakai hook `saving` model.
- `formatError($format, $reset)` — validasi pola (dipakai `UpdateInvoiceSettingsRequest`, dicerminkan di frontend): hanya token dikenal, `{NO}` tepat sekali, reset bulanan wajib memuat bulan + tahun, reset tahunan wajib memuat tahun (tanpa itu nomor periode berbeda akan bentrok).

Pengaturan pola ada di modul Settings (`/settings/invoice-numbering`, lihat `settings.md`). Default (format, 3 digit, reset bulanan) menghasilkan nomor yang persis sama dengan generator lama (`InvoiceNumberServiceTest::test_default_format_matches_the_company_numbering`).

### Rollback Invoice (Sent → Draft)
**Alur:** POST `/invoices/{invoice}/rollback` → `rollback()` menolak jika status bukan `sent`, dan menolak jika `Invoice::isLatestInNumberingPeriod($invoice)` false (hanya `invoice_sequence` **tertinggi** di periode reset `issue_date`-nya yang boleh, supaya tidak melubangi urutan nomor; invoice bernomor manual di luar pola tidak bisa di-rollback). Jika lolos: `invoice_number` di-null-kan (hook mengosongkan `invoice_sequence`) dan status kembali `draft`.

### Pembayaran — Catat (POST /invoices/{invoice}/payments)
**Alur step-by-step:**
1. Di drawer, user klik "Catat pembayaran" → dialog: `amount` (CurrencyInput + chip Sisa penuh / 50% / Nominal lain), `payment_date`, `bank_account_id` (wajib; `/api/bank-accounts`), `payment_method` (Transfer bank / Tunai — benar-benar dikirim, sebelumnya selalu `bank_transfer`), `reference_number`, `attachment`.
2. Frontend submit via `fetch` multipart POST ke `/invoices/{invoice}/payments` (route ber-middleware `can:create invoices`), validasi `StorePaymentRequest`.
3. `PaymentController::store()` menolak (422 JSON) jika status invoice `draft` atau `paid`, dan **jika nominal melebihi sisa tagihan** (`exceedsRemaining()`: "Melebihi sisa tagihan Rp X. Catat kelebihan sebagai transaksi terpisah."; UI juga memblokir sebelum kirim). `update()` memakai aturan yang sama dengan nominal lama ikut dihitung sebagai sisa. Lampiran disimpan ke `storage/app/public/payments`.
4. Insert `payments`, lalu **`$invoice->updateStatus()`** menghitung ulang status dari total pembayaran.
5. Respons JSON payment terformat; drawer memuat ulang `/data` dan halaman di belakang `router.reload()` (hash dipertahankan).

**Penjelasan kode** (`app/Models/Invoice.php::updateStatus`):
```php
if ($amountPaid == 0) {
    $this->status = $this->invoice_number ? 'sent' : 'draft';
} elseif ($amountPaid >= $this->total_amount) {
    $this->status = 'paid';
} else {
    $this->status = 'partially_paid';
}
$this->save();
```
Status murni turunan dari `amount_paid` vs `total_amount`. Bila **semua** pembayaran dihapus, invoice yang sudah ber-nomor kembali ke `sent` (bukan `draft`) — sebelumnya ia jatuh ke `draft` sambil tetap memegang nomor, yang membuat `isInvoiceLatestInMonth()` memblokir rollback invoice lain di bulan yang sama.

### Pembayaran — Ubah & Hapus (/payments/{payment})
**Alur:** POST `/payments/{payment}` dan DELETE `/payments/{payment}` digate `can:edit invoices`. `update()` (validasi `UpdatePaymentRequest` = Store + `remove_attachment` boolean) mengganti field, mengelola siklus lampiran (hapus file lama jika diganti/di-remove), lalu `$payment->invoice->updateStatus()`. `destroy()` menghapus payment (hook model ikut menghapus file lampiran) lalu `updateStatus()` pada invoice-nya. Keduanya merespons JSON.

### Export Rekap Excel & PDF
**Alur:** GET `/invoices/export/excel` dan `/invoices/export/pdf` (dalam grup `can:view invoices`) menerima query filter yang sama dengan index (tombol Ekspor mengirim semua filter aktif, termasuk `status=overdue`). `buildRecapData()` memakai `applyStatusFilter()` yang sama dengan daftar — "Perlu ditagih" lintas bulan dengan label periode "Perlu ditagih (lewat jatuh tempo, semua periode)" (BUG-07 QA 29 Sep: sebelumnya rekap berisi seluruh bulan terpilih) — membangun baris per invoice — **mengecualikan `draft` & `cancelled`** — dengan kolom: omzet (`total_amount`), HPP (Σ `cogs_amount` per invoice), profit (omzet − HPP), `pph_final = round(omzet × 0.5%)` (PPh Final UMKM PP 55/2022), terbayar, sisa; plus baris summary dan label periode (range tanggal menimpa bulan). Excel via `App\Exports\InvoiceRecapExport` (Maatwebsite); PDF via DomPDF view `pdf.invoice-recap` A4 landscape + `CompanyProfile`. Perilaku ini dikunci oleh test `InvoiceControllerTest` (`test_export_excludes_draft_and_cancelled_from_omzet`, `test_export_includes_hpp_profit_and_pph_final`, `test_date_range_overrides_month_in_export`, dll.).

### Download / Preview PDF Invoice (per lembar)
**Alur step-by-step:**
1. Dari `PrintInvoiceDialog` (`resources/js/pages/invoices/components/print-invoice-dialog.tsx`), user memilih jenis tagihan (Penuh / Uang muka `dp_amount` / Pelunasan `pelunasan_amount`, default Pelunasan bila sudah ada pembayaran) dan template (kartu Kisantra/Semesta/AGSA/Generik + template builder). Panel kanan menampilkan **PDF asli** dari `/invoice/{id}/preview` dengan parameter yang sama (nominal DP ditunda 400 ms).
2. GET `/invoice/{invoice}/download` atau `/invoice/{invoice}/preview` (`can:view invoices`), query: `template` (default `kisantra-invoice`), `dp_amount`, `pelunasan_amount`.
3. Routing template (closure di `routes/web.php` ±154–203):
   - `template=builder:{id}` → `PdfTemplate::findOrFail(id)` + `BuilderInvoicePrinter::render($pdfTemplate, $invoice, $dpAmount, $pelunasanAmount)`; nama file dari `->filename()` (prefix `DP-`/`Pelunasan-`).
   - selain itu → `InvoicePrintService::generateSingleInvoicePdf()` → `renderPdf()` dengan template Blade `resources/views/pdf/{template}.blade.php` (`kisantra-invoice`, `semesta-invoice`, `agsa-invoice`, `invoice`). `renderPdf()` adalah **satu-satunya** jalur render PDF Blade (unduhan, pratinjau tab/iframe, dan pratinjau editor).
4. `download` mengirim `streamDownload` (attachment); `preview` mengirim body PDF dengan `Content-Disposition: inline` (dibuka di tab/iframe).

**Penjelasan kode** (`app/Services/InvoicePrintService.php`):
```php
if ($template === 'semesta-invoice') {
    $ppnAmount = ($itemsTotal * $ppnRate / 100);          // PPN 11%
    $pph22Amount = $itemsTotal * 1.5 / 100;                // PPh 22 1,5%
    $grandTotal = $subtotalWithPpn - $pph22Amount - $discountAmount - (...);
} else { // kisantra (default)
    $ppnAmount = $company?->is_pkp ? ($displayAmount * $company->ppn_rate / 100) : 0;
    $grandTotal = $displayAmount + $ppnAmount;
}
```
Konteks PKP/PPN: template default hanya menambahkan PPN bila `CompanyProfile.is_pkp` true (rate `ppn_rate`, default 11%); template `semesta-invoice` selalu menghitung PPN 11% + potongan PPh 22 1,5%. Service juga memisahkan `regular_items` vs `tax_deposit_items`, menghitung `terbilang` (angka → kata bahasa Indonesia via `numberToWords()`), dan menyematkan logo/ttd/stempel sebagai base64. `BuilderInvoicePrinter` (`app/Services/BuilderInvoicePrinter.php`) me-render layout JSON `PdfTemplate` (banded atau flat legacy) dengan `paymentContext` mode `full|dp|pelunasan` dan custom font.

## Perhitungan Accessor (app/Models/Invoice.php)

| Accessor | Rumus |
|---|---|
| `amount_paid` | Σ `payments.amount` (pakai relasi yang sudah loaded bila ada) |
| `amount_remaining` | `total_amount − amount_paid` |
| `total_cogs` | Σ `items.cogs_amount` (catatan: **termasuk** item titipan pajak; stats index mengecualikannya via query terpisah) |
| `gross_profit` | `total_amount − total_cogs` |
| `outstanding_profit` / `paid_profit` | porsi laba yang belum/sudah "tertutup" pembayaran (model tutup-modal-dulu: pembayaran dianggap menutup HPP lebih dulu) |

## Keterkaitan Antar Modul
- **Bank Account:** setiap `Payment` ber-`bank_account_id`; saldo bank = `initial_balance + Σ payments + Σ tx credit − Σ tx debit` (accessor `getBalanceAttribute` di `app/Models/BankAccount.php`) — mencatat/menghapus pembayaran otomatis mengubah saldo tampilan tanpa menulis apa pun ke tabel bank.
- **Recurring Invoices:** `RecurringInvoice::publish()` membuat baris di `invoices` + `invoice_items` (lihat `docs/module/recurring-invoices.md`).
- **Clients:** `billed_to_id` dan `invoice_items.client_id`; menghapus klien meng-cascade hapus invoice & item-nya (override `Client::delete()`).
- **Services:** master harga saat menyusun item — hanya disalin (snapshot), tidak ada FK.
- **Cash Flow & Laporan Laba Rugi:** membaca `payments` (kas masuk) dan `cogs_amount`/`is_tax_deposit` untuk omzet/HPP.
- **PDF Templates (Settings):** `PdfTemplate` + `CustomFont` dipakai `BuilderInvoicePrinter`; daftar template builder dikirim ke halaman index sebagai `customTemplates`.

## Invarian & Jebakan
- Semua nominal **integer rupiah penuh** — jangan pernah pakai float; `quantity` satu-satunya decimal.
- Invoice `draft` tidak punya `invoice_number`; nomor hanya diberikan saat `send` (termasuk invoice hasil publish recurring), unik global, sequence reset sesuai pengaturan (default per bulan `issue_date`).
- **Urutan dibaca dari `invoice_sequence`, bukan dari teks nomor** — bentuk nomor bisa diganti kapan saja. Jangan menulis `invoice_sequence` manual kecuali sengaja; biarkan hook `saving` yang mengisinya. Mengganti pola tidak mengubah nomor yang sudah terbit.
- Rollback hanya untuk invoice `sent` dengan sequence **tertinggi** di periodenya (`isLatestInNumberingPeriod`) — jaga urutan nomor tanpa lubang.
- `updateStatus()` menghasilkan `sent` (ber-nomor, belum ada pembayaran) / `draft` (tanpa nomor) / `partially_paid` / `paid`. `overdue` dan `cancelled` ada di enum DB tetapi tidak ada transisi otomatis di kode saat ini (cancelled hanya dipakai sebagai filter pengecualian statistik/export).
- Invoice yang punya pembayaran **tidak bisa dihapus**; hapus pembayarannya dulu.
- `send`/`rollback` butuh `edit invoices` — user `view`+`create` saja (role staff) tidak bisa memberi nomor resmi.
- Pembayaran ditolak untuk invoice `draft` dan `paid` (`PaymentController::store`, HTTP 422).
- `update()` invoice **menghapus dan membuat ulang seluruh item** — ID `invoice_items` tidak stabil; jangan menyimpan referensi ke ID item.
- Statistik & export mengecualikan `draft` + `cancelled` dari omzet/HPP/laba dan **mengikuti tab status aktif** (hitungan tab tidak); item `is_tax_deposit` dikecualikan dari HPP di stats index tetapi accessor `total_cogs` model **tidak** mengecualikannya.
- Filter periode: backend memprioritaskan `date_from`/`date_to` atas `month`; UI menjaga keduanya saling eksklusif (pilih rentang → bulan dikosongkan, pilih bulan → rentang dikosongkan) supaya label tidak menyesatkan.
- Saldo bank dihitung dinamis — tidak ada kolom saldo yang perlu (atau boleh) di-update saat mencatat pembayaran.
- Endpoint payment & `/invoices/{id}/data` merespons **JSON**; `send`/`rollback`/`destroy` menjawab JSON untuk permintaan `expectsJson()` dan redirect + flash untuk yang lain. Jangan ubah aksi drawer menjadi kunjungan Inertia (`router.post`): redirect back mengganti halaman di belakang modal dan membuang hash.
- Modal detail ditentukan `location.hash` (`#invoice/{id}`), bukan path. Modul lain yang ingin detail ber-URL memakai `lib/resource-modal.ts` + `ResourceModalHost` yang sama.
- **Pratinjau = ekspor.** Pratinjau editor, tab Pratinjau cetak, dan dialog cetak menampilkan PDF dari `InvoicePrintService::renderPdf()`, bukan HTML tiruan. Render HTML di browser **tidak** identik dengan DomPDF (DomPDF mengabaikan `display:flex`, tinggi baris tabel berbeda — terukur ±9,7% piksel beda, QA 2026-09-26). `test_preview_pdf_is_identical_to_the_downloaded_pdf` mengunci kesamaan byte (kecuali stempel waktu & `/ID` acak). Satu-satunya pengecualian yang disengaja: sorotan baris `highlight` di pratinjau editor.
- `buildInvoiceData()` adalah satu-satunya tempat hitungan subtotal/diskon/total untuk store, update, dan pratinjau — jangan menduplikasi rumus.

## File Kunci
- `routes/web.php` (baris ±131–203) — definisi route invoices/payments/invoice PDF
- `app/Http/Controllers/InvoiceController.php`, `app/Http/Controllers/PaymentController.php`
- `app/Http/Requests/StoreInvoiceRequest.php`, `UpdateInvoiceRequest.php`, `SendInvoiceRequest.php`, `StorePaymentRequest.php`, `UpdatePaymentRequest.php`
- `app/Models/Invoice.php`, `app/Models/InvoiceItem.php`, `app/Models/Payment.php`, `app/Models/BankAccount.php`
- `app/Services/InvoicePrintService.php`, `app/Services/BuilderInvoicePrinter.php`, `app/Exports/InvoiceRecapExport.php`
- `resources/views/pdf/kisantra-invoice.blade.php` (+ `semesta-invoice`, `agsa-invoice`, `invoice`, `invoice-recap`)
- `app/Http/Requests/InvoicePreviewRequest.php`, `resources/js/lib/resource-modal.ts` + `components/resource-modal-host.tsx` (modal global berbasis hash), `resources/js/lib/navigation.ts`
- `resources/js/pages/invoices/index.tsx` (daftar), `create.tsx` (`InvoiceEditor`), `edit.tsx`, `components/invoice-drawer.tsx` (drawer + dialog kirim/bayar), `components/print-invoice-dialog.tsx`, `components/invoice-paper.tsx` (penampil PDF dua lapis), `components/ob.tsx` (status, format, kelas Obsidian), `components/item-table-helpers.tsx` (sel tabel lama, dipakai Invoice Berulang)
- `tests/Feature/InvoiceControllerTest.php`, `tests/Feature/PaymentControllerTest.php`, `tests/Feature/InvoiceNumberAssignmentTest.php`
