# Modul: Invoice & Pembayaran

> Modul inti untuk menagih klien: membuat invoice berisi item layanan (dengan HPP/COGS dan titipan pajak), mengirimkannya (penomoran resmi), mencatat pembayaran ke rekening bank, serta mengekspor rekap (Excel/PDF) dan mencetak invoice per-lembar (PDF klasik maupun template builder). Route prefix: `/invoices` (CRUD + export), `/payments` (update/hapus pembayaran), `/invoice/{invoice}/download|preview` (PDF), `POST /invoices/preview` (PDF pratinjau editor dari data belum tersimpan). Semua route digate permission Spatie: `view invoices` (grup), plus `create invoices`, `edit invoices`, `delete invoices` per aksi; `send` dan `rollback` ikut digate `edit invoices` (lihat `routes/web.php` baris 133–203).

## Tabel Database

### `invoices`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_number` | string, **nullable saat draft**; diisi saat "send" mengikuti **format yang bisa diatur** di Pengaturan › Penomoran invoice (default `{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}`, mis. `001/INV/KSN-ABC/VIII/2026`). Unique (divalidasi di `SendInvoiceRequest`). |
| `invoice_sequence` | unsigned int nullable — nomor urut di dalam `invoice_number`, **diisi otomatis** oleh hook `saving` model setiap kali `invoice_number` berubah (`InvoiceNumberService::sequenceOf()` dengan pola aktif); null untuk draft dan nomor manual yang tidak cocok pola. Dasar hitungan nomor berikutnya & aturan rollback. Untuk data lama: migrasi 2026-10-08 memakai regex tetap `^(\d+)\/INV\/` dan **gagal diam-diam pada instalasi yang memakai format lain** (mis. `INV/01/KSN/01.26`) — tidak mengisi apa pun, tanpa peringatan. Pakai `php artisan invoice:backfill-sequence` yang membaca **pola aktif** lewat `sequenceOf()` dan melaporkan nomor yang tidak cocok, atau dari website: perusahaan hasil konversi wajib melewati **peninjauan nomor lama** di Penomoran invoice (pratinjau kering + tombol isi urutan; keduanya memakai `InvoiceNumberService::backfillSequences()`, lihat settings.md). |
| `billed_to_id` | FK → `clients.id` (relasi `client()` di model) |
| `subject` | string nullable — **perihal** invoice. Diisi di editor (opsional), di-`trim`, kosong → `null`. Saat ini hanya tercetak oleh template perusahaan yang memakainya (PT SLU, PT BAS); template bawaan mengabaikannya. |
| `subtotal` | **integer rupiah penuh** — jumlah `amount` semua item |
| `discount_amount` / `discount_type` / `discount_value` / `discount_reason` | diskon; `discount_type` = `fixed` \| `percentage`; `discount_amount` adalah hasil hitung (integer) |
| `ppn_rate` | decimal(5,2) nullable — tarif PPN (persen) yang **dibekukan** di invoice saat dibuat/diberi PPN. `NULL` = invoice sebelum fitur PPN (2026-10-13; tanpa data PPN, laporan lama tetap seperti dulu), `0` = tanpa PPN, `> 0` = ber-PPN. |
| `ppn_amount` | unsigned integer, default 0 — `Invoice::ppnFor(DPP, ppn_rate)`; ikut di `total_amount` |
| `total_amount` | integer = `max(0, subtotal - discount_amount) + ppn_amount` — yang ditagih ke klien |
| `issue_date`, `due_date` | date (cast `date` di model) |
| `status` | enum: `draft`, `sent`, `paid`, `partially_paid`, `overdue`, `cancelled` |
| `faktur` | string nullable (maks. 50) — nomor faktur pajak. Diisi di editor (kolom muncul saat PPN aktif), di-`trim`, kosong → `null`; tercetak di header PDF Kisantra/Generik/Semesta dan token `{{invoice.faktur}}`. |

### `invoice_items`
| Kolom | Tipe/Catatan |
|---|---|
| `invoice_id` | FK → `invoices.id` |
| `client_id` | FK → `clients.id` — item bisa atas nama klien berbeda dari `billed_to_id` (kasus satu invoice menagih beberapa entitas klien) |
| `service_name` | string bebas (disalin dari master `services`, bukan FK) |
| `description` | text nullable (maks. 2000) — **keterangan tambahan** di bawah nama layanan, boleh beberapa baris (mis. pelabuhan muat, rincian jam kerja, nomor nota). Editor: tautan "Tambah keterangan" per baris; kosong → `null`. Tercetak oleh template perusahaan yang memakainya. |
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
7. UI (gaya Obsidian): kartu ringkasan (total ditagih, **PPN** — hanya bila `ppnEnabled` (perusahaan PKP) atau `stats.total_ppn > 0`, berisi Σ `ppn_amount` + `stats.ppn_invoice_count` invoice terbit ber-PPN di filter aktif —, sudah dibayar, belum dibayar, perlu ditagih + bar sebaran status; 4 atau 5 kolom, ukuran angka mengikuti lebar baris lewat container query `--stat-cols`/`--stat-pad`), pil status + pil "Perlu ditagih", tabel. Klik baris → drawer detail (lihat berikut).

Kelayakan rollback dihitung per invoice di `data()` (`rollbackable` = status `sent` dan `Invoice::isInvoiceLatestInMonth()`), sama dengan aturan yang ditegakkan `rollback()`.

### Detail Invoice (modal global `#invoice/{id}`)
Detail invoice adalah **modal yang menumpang di halaman mana pun**, seperti Settings di claude.ai: halaman di belakang tidak berganti, URL hanya ditambah hash. Contoh: dari Ringkasan → `/dashboard#invoice/13`; dari daftar → `/invoices?month=2026-09#invoice/13`.

**Alur step-by-step:**
1. Tautan detail adalah anchor biasa ke `#invoice/{id}` (`resourceHref()`), atau `openResource('invoice', id)` dari kode (klik baris daftar, notifikasi). Tidak ada permintaan ke server untuk halaman di belakang.
2. `lib/resource-modal.ts::installResourceModal()` (dipasang di `inertia.tsx` **sebelum** `createInertiaApp`) mencegat `popstate` yang hanya mengubah hash: Inertia tidak menangani (tidak menggulir ke atas / memasang ulang halaman), lalu `router.replace` sisi klien menyamakan URL & state riwayat Inertia.
3. `ResourceModalHost` (`components/resource-modal-host.tsx`, dirender `AppLayout`) membaca **`window.location.hash`** lewat `useResource()` — bukan `usePage().url`, karena saat halaman dimuat ulang Inertia menempelkan hash ke objek halamannya tanpa memicu render ulang — dan me-render `InvoiceDrawer` (dimuat malas).
4. Drawer mengambil `GET /invoices/{id}/data` (JSON: header + `amount_paid`/`amount_remaining`, `tax_deposit_total` (Σ item titipan pajak, untuk pratinjau jurnal pembayaran), klien, `items` (+ `client_name`), `payments` (+ `created_at`), `next_invoice_number` untuk draft, `rollbackable`, `custom_templates`, `created_at`/`updated_at`) — mandiri, tidak butuh props halaman invoice. 404 → "Invoice tidak ditemukan", halaman di belakang tetap.
5. Aksi di drawer (kirim, rollback, hapus, bayar) memakai **fetch JSON** (`send`/`rollback`/`destroy` menjawab JSON bila `expectsJson()`, lewat `actionResult()`), bukan kunjungan Inertia yang akan mengganti halaman di belakang. Setelah berhasil drawer memuat ulang datanya dan host memanggil `router.reload()` — URL sama sehingga Inertia mempertahankan hash dan modal tetap terbuka, sementara angka di halaman belakang ikut segar.
6. Tutup: bila modal dibuka dari dalam aplikasi → `history.back()`; bila datang dari tautan/refresh → `router.replace` ke URL tanpa hash. Back/Forward browser menutup/membuka ulang modal; refresh dan tautan yang dibagikan (tombol salin tautan menyalin `location.href`) membuka halaman yang sama dengan modal terbuka.
7. Rute lama `GET /invoices/{id}` (`show()`, notifikasi lama, redirect setelah simpan) tetap merender daftar dengan `selectedInvoiceId`; halaman daftar langsung mengubahnya menjadi `/invoices#invoice/{id}` (`showResource()`). Notifikasi jatuh tempo baru memakai `/invoices#invoice/{id}` dan membuka modal di halaman yang sedang dibuka.
8. Isi drawer: metrik (total, dibayar, sisa, laba kotor), tab **Ringkasan** (item, total, riwayat dari `created_at` + pembayaran, kartu klien, daftar pembayaran ubah/hapus) dan **Pratinjau cetak** (PDF asli via `/invoice/{id}/preview`). Aksi: Cetak, Terbitkan invoice (draft), Catat pembayaran (sent/partial), menu Ubah / Kembalikan ke draft / Hapus, salin tautan.

### Buat Invoice (Create + Store)
**Alur step-by-step:**
1. User klik "Buat Invoice" → GET `/invoices/create` (`can:create invoices`). Props dari `formOptions()`: klien `Active` (id, name, email, npwp, type) dan `services`. Editor (`InvoiceEditor` di `create.tsx`, dipakai juga `edit.tsx`): kiri isian, kanan **pratinjau PDF langsung**.
2. User memilih klien, tanggal, dan **termin** (isian "Termin (hari)" di samping Jatuh tempo; jatuh tempo = tanggal invoice + termin, saling mengikuti: ubah termin → tanggal bergeser, ganti tanggal invoice → jatuh tempo ikut bergeser dengan termin yang sama, pilih tanggal manual → termin menyesuaikan; nilai awal = `company_profiles.default_due_days`, prop `defaultDueDays` dari `formOptions()`). Di form **invoice baru**, pemegang `manage invoice settings` melihat tombol "Jadikan N hari bawaan" bila termin berbeda dari bawaan → `PUT /settings/invoice-numbering/due-days` (`InvoiceSettingsController::updateDueDays`, 0–365 hari, partial reload `defaultDueDays`) — tanpa membuka halaman Pengaturan. Lalu user menyusun item (nama layanan dengan saran katalog saat mengetik, atau tombol katalog 🔍 di setiap baris yang mengisi nama & harga baris itu saja, qty, harga, satuan, **HPP baris** = HPP seluruh baris, sakelar titipan pajak), opsional "Tagih ke beberapa klien" (klien per baris), diskon nominal/persen + alasan, dan — bila perusahaan PKP — sakelar **Tagih PPN x%** (bawaan menyala) + nomor faktur pajak (lihat "PPN"). Ctrl+Enter menambah baris.
3. **Pratinjau langsung:** setiap isian berubah (jeda 350 ms, permintaan lama dibatalkan) editor mengirim `POST /invoices/preview` (`InvoicePreviewRequest`, semua field boleh kosong) → `preview()` membangun `Invoice` + `InvoiceItem` **tanpa menyimpan** (relasi di-`setRelation`), lalu `InvoicePrintService::renderPdf()` — jalur yang sama dengan unduhan — dan membalas **PDF**; nomor (tersimpan atau perkiraan `generateInvoiceNumber`) di header `X-Invoice-Number`. Parameter `highlight` (indeks baris yang sedang diedit) menyuntikkan CSS latar biru pada baris itu — hanya di pratinjau. Browser menampilkan PDF dengan penampil bawaan (`#toolbar=0&view=FitH`).
4. Submit → POST `/invoices`, divalidasi `StoreInvoiceRequest` (pesan Indonesia di `messages()`, mis. "Nama layanan baris 1 wajib diisi."). Tombol **Simpan draft** atau **Simpan & terbitkan** (`publish=1`). **Simpan & terbitkan** lebih dulu membuka dialog **nomor invoice** (komponen bersama `components/invoice-number-dialog.tsx`, juga dipakai "Terbitkan invoice" di drawer): terisi `GET /invoices/next-number?client_id=&issue_date=` (`NextInvoiceNumberRequest` → `Invoice::generateInvoiceNumber()`, sama persis dengan nomor otomatis), bisa diubah oleh pemegang `edit invoices` (pengguna lain melihatnya read-only). Konfirmasi mengirim `publish=1` + `invoice_number`. Bila yang ditolak hanya nomornya (mis. "Nomor ini sudah dipakai invoice lain."), dialog tetap terbuka dengan tautan "Pakai nomor yang disarankan"; galat lain menutup dialog dan tampil di form. Tanpa klien/tanggal, tombol langsung mengirim agar validasi server menunjukkan yang kurang.
5. `store()` dalam `DB::transaction`: `buildInvoiceData()` (satu-satunya tempat hitungan: `amount = round(unit_price × quantity)`, `subtotal`, `discount_amount`, `ppn_rate`/`ppn_amount` lewat `resolvePpnRate()`, `total_amount = max(0, subtotal − discount) + ppn_amount`) → insert `draft` tanpa nomor + items; bila `publish`, `publish()` memberi nomor dari dialog (`invoice_number`, divalidasi `unique` di `StoreInvoiceRequest` — update mengabaikan dirinya; **dipakai hanya bila pengguna punya `edit invoices`**, selain itu diabaikan) atau `generateInvoiceNumber()` bila kosong, lalu status `sent` di transaksi yang sama.
6. Redirect ke **`invoices.show`** (drawer invoice baru terbuka) dengan flash `success`.

**Penjelasan kode** (`app/Http/Controllers/InvoiceController.php::store`):
```php
$discountAmount = $discountType === 'percentage'
    ? (int) round($subtotal * $discountValue / 100)
    : $discountValue;
$ppnRate = $this->resolvePpnRate($validated, $existing);
$ppnAmount = Invoice::ppnFor($subtotal - $taxDeposits - $discountAmount, $ppnRate);
'total_amount' => max(0, $subtotal - $discountAmount) + $ppnAmount,
```
Diskon persentase dikonversi ke nominal integer saat simpan (kedua bentuk disimpan: `discount_value` mentah + `discount_amount` hasil). Invoice selalu lahir sebagai `draft` tanpa nomor — nomor baru diberikan saat "send".

### Ubah Invoice (Edit + Update)
**Alur:** GET `/invoices/{invoice}/edit` (`can:edit invoices`) merender `invoices/edit` dengan data invoice + items; PUT `/invoices/{invoice}` divalidasi `UpdateInvoiceRequest` (identik dengan Store — `class UpdateInvoiceRequest extends StoreInvoiceRequest {}`). `update()` memakai `buildInvoiceData($validated, $invoice)` yang sama (invoice lama ikut dikirim agar tarif PPN tersimpannya dipakai), lalu **menghapus semua item lama dan membuat ulang** dalam satu transaksi. Status dan `invoice_number` tidak diubah, kecuali `publish=1` pada invoice `draft` (Simpan & terbitkan). Redirect ke `invoices.show`.

### PPN (perusahaan PKP)
Sejak 2026-10-13. PPN dipilih **per invoice**, hanya selama Pengaturan › Profil perusahaan berstatus PKP dengan `ppn_rate > 0` (`formOptions()['ppn'] = {enabled, rate}`).

1. Editor menampilkan sakelar **Tagih PPN {rate}%** bila PKP aktif, atau bila invoice yang diedit sudah ber-PPN (tarif tersimpannya). Bawaan: invoice baru menyala bila PKP; invoice yang diedit mengikuti keadaannya (`apply_ppn = ppn_rate !== null`). Saat menyala muncul isian **No. faktur pajak (opsional)**; mematikan sakelar mengosongkan faktur.
2. Payload membawa `apply_ppn` (boolean, opsional) + `faktur` — divalidasi `StoreInvoiceRequest`/`InvoicePreviewRequest`.
3. `resolvePpnRate($validated, $existing)`: invoice yang sudah ber-PPN memakai **tarif tersimpannya** (tidak ikut bila tarif di Pengaturan diganti atau PKP dimatikan); invoice baru hanya bisa ber-PPN selama PKP; `apply_ppn` kosong = bawaan di atas; `apply_ppn=true` saat perusahaan tidak PKP diabaikan (PPN 0, bukan error). Invoice lama (`ppn_rate NULL`) yang diedit tanpa PPN tetap `NULL`.
4. **DPP = subtotal layanan − titipan pajak − diskon** (`Invoice::dpp_amount`); `ppn_amount = round(DPP × rate / 100)` (`Invoice::ppnFor()`, satu-satunya rumus — dipakai juga publish invoice berulang). PPN masuk `total_amount`, sehingga sisa tagihan, status Lunas, dan pembayaran memakai total **termasuk PPN**.
5. PPN **bukan pendapatan**: `gross_profit` model, laba kotor drawer/editor, statistik daftar (`gross_profit = total_revenue − total_ppn − HPP`; `stats.total_ppn` & `stats.ppn_invoice_count` tampil di kartu **PPN** daftar invoice), Ringkasan (`total_profit` dikurangi PPN yang sudah dibayar klien), rekap (omzet tanpa PPN), dan Laba Rugi (`ppn_output`, lihat `profit-loss.md`).
6. PDF: lihat "Download / Preview PDF Invoice".

### Hapus Invoice (Destroy)
**Alur:** DELETE `/invoices/{invoice}` (`can:delete invoices`) → **ditolak dengan flash `error`** bila invoice sudah punya pembayaran ("Invoice yang sudah memiliki pembayaran tidak dapat dihapus. Hapus pembayarannya terlebih dahulu."); jika tidak, transaksi: hapus `invoice_items` lalu invoice; redirect back. Guard ini mencegah FK cascade menghapus `payments` diam-diam (yang menurunkan saldo bank tanpa peringatan dan meninggalkan file lampiran yatim).

### Terbitkan Invoice (Send — penomoran resmi)
**Alur step-by-step:**
1. Di drawer invoice `draft`, user klik "Terbitkan invoice" → dialog **terisi otomatis** dengan `next_invoice_number` dari `/invoices/{id}/data` (dihitung server via `Invoice::generateInvoiceNumber($issue_date, $billed_to_id)` → `InvoiceNumberService::next()`, jadi inisial klien sama persis dengan backend); user masih boleh mengubahnya sebelum konfirmasi.
2. POST `/invoices/{invoice}/send` payload `{ invoice_number }`, divalidasi `SendInvoiceRequest` (`unique:invoices,invoice_number` kecuali dirinya; pesan "Nomor ini sudah dipakai invoice lain." + tautan "Pakai nomor yang disarankan" di UI).
3. `send()` menolak jika status bukan `draft` (flash `error`). Jika lolos: `$invoice->update(['invoice_number' => ..., 'status' => 'sent'])`; hook `saving` model mengisi `invoice_sequence` dari nomor itu.

**Penjelasan kode** (`app/Services/InvoiceNumberService.php` — satu-satunya tempat nomor disusun):

- `settings()` membaca `invoice_number_format`, `invoice_number_padding` (1–5, jumlah digit **minimum** `{NO}`; 1 = tanpa nol di depan; urutan tetap bertambah melewatinya), `invoice_number_reset` (`monthly`/`yearly`/`never`) dari `CompanyProfile::current()`, dengan default format lama bila belum diisi.
- `next($issueDate, $clientId)` = `render()` pola dengan `nextSequence()` (MAX `invoice_sequence` dalam periode reset `issue_date` + 1). Token: `{NO}` (urutan, diberi nol sesuai padding), `{PT}` (**singkatan** di Profil Perusahaan, `company_profiles.abbreviation`, milik tiap perusahaan; cadangan bila kosong: inisial nama perusahaan, lalu "SPI". Gerbang `EnsureCompanyProfileComplete` mewajibkan singkatan sebelum perusahaan dipakai, jadi cadangan tidak tercapai lewat web), `{KLIEN}` (**alias klien** bila diisi di data klien, selain itu inisial nama/nama perusahaan klien, lewati PT/CV/dst.; "XXX" bila tidak ada — `clientCode()`), `{BLN_ROMAWI}`, `{BLN}`, `{THN}`, `{THN2}`.
- `sequenceOf($number)` membangun regex dari pola aktif: `{NO}` → `(\d+)`, token lain dicocokkan per jenis karakter (bukan nilainya) agar nomor tetap terbaca walau nama perusahaan/klien berubah. Dipakai hook `saving` model.
- `formatError($format, $reset)` — validasi pola (dipakai `UpdateInvoiceSettingsRequest`, dicerminkan di frontend): hanya token dikenal, `{NO}` tepat sekali, reset bulanan wajib memuat bulan + tahun, reset tahunan wajib memuat tahun (tanpa itu nomor periode berbeda akan bentrok).

Pengaturan pola ada di modul Settings (`/settings/invoice-numbering`, lihat `settings.md`). Default (format, 3 digit, reset bulanan) menghasilkan nomor yang persis sama dengan generator lama (`InvoiceNumberServiceTest::test_default_format_matches_the_company_numbering`).

### Rollback Invoice (Sent → Draft)
**Alur:** POST `/invoices/{invoice}/rollback` → `rollback()` menolak jika status bukan `sent`, dan menolak jika `Invoice::isLatestInNumberingPeriod($invoice)` false (hanya `invoice_sequence` **tertinggi** di periode reset `issue_date`-nya yang boleh, supaya tidak melubangi urutan nomor).

Untuk invoice ber-`invoice_sequence` null (nomor manual atau warisan yang tidak cocok pola) berlaku dua aturan berbeda, dan bedanya penting:
- Periode itu **masih punya** invoice bernomor urut → ekor deret adalah miliknya, nomor manual **tidak** bisa di-rollback (perilaku lama, dikunci `test_manual_number_outside_the_format_does_not_move_the_counter`).
- Periode itu **tidak punya satu pun** urutan (mis. seluruh riwayat memakai format lama) → yang **terakhir diterbitkan** dianggap ekornya. Tanpa cadangan ini seluruh riwayat terkunci selamanya: tidak bisa di-rollback, jadi tidak bisa dikoreksi. Dikunci `test_invoice_bernomor_warisan_tanpa_urutan_tidak_terkunci_selamanya`. Jika lolos: `invoice_number` di-null-kan (hook mengosongkan `invoice_sequence`) dan status kembali `draft`.

### Pembayaran — Catat (POST /invoices/{invoice}/payments)
**Alur step-by-step:**
1. Di drawer, user klik "Catat pembayaran" → dialog: `amount` (CurrencyInput + chip Sisa penuh / 50% / Nominal lain), `payment_date`, `bank_account_id` (wajib; `/api/bank-accounts`), `payment_method` (Transfer bank / Tunai — benar-benar dikirim, sebelumnya selalu `bank_transfer`), `reference_number`, `attachment`. Di bawah Metode tampil **Jurnal · Pratinjau** (sejak 9 Nov 2026): Debit rekening tujuan (`journal_name` dari `/api/bank-accounts`) / Kredit dipecah "titipan dulu" — **Titipan Pajak Klien**, lalu **PPN Keluaran**, sisanya **Pendapatan dari Invoice** — dari `tax_deposit_total` & `ppn_amount` invoice dan pembayaran yang sudah ada sebelum tanggal ini (urut tanggal, id; pembayaran yang diubah tidak dihitung). Rumusnya cermin `JournalService::paymentLines()` / `Invoice::allocatePayments()` di `resources/js/lib/journal.ts`; jurnal tersimpan tampil di rincian pembayaran Arus Kas & Kas & Bank. Lihat [cash-flow.md › Jurnal tampilan](cash-flow.md#jurnal-tampilan-cara-a--debitkredit-dari-rekening--kategori).
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
**Alur:** GET `/invoices/export/excel` dan `/invoices/export/pdf` (dalam grup `can:view invoices`) menerima query filter yang sama dengan index (tombol Ekspor mengirim semua filter aktif, termasuk `status=overdue`). `buildRecapData()` memakai `applyStatusFilter()` yang sama dengan daftar — "Perlu ditagih" lintas bulan dengan label periode "Perlu ditagih (lewat jatuh tempo, semua periode)" (BUG-07 QA 29 Sep: sebelumnya rekap berisi seluruh bulan terpilih) — membangun baris per invoice — **mengecualikan `draft` & `cancelled`** — dengan kolom: omzet (`total_amount − ppn_amount`), **PPN** (`ppn_amount`; baris juga membawa `ppn_rate`, `null` untuk invoice lama), HPP (Σ `cogs_amount` per invoice), profit (omzet − HPP), `pph_final = round(omzet × 0.5%)` (PPh Final UMKM PP 55/2022), terbayar, sisa (`total_amount − terbayar`, termasuk PPN); summary `total_ppn`. Excel Default 12 kolom (A–L, PPN di G); PDF menampilkan kolom/kartu PPN hanya bila `total_ppn > 0`; plus baris summary dan label periode (range tanggal menimpa bulan). Excel via `App\Exports\InvoiceRecapExport` (Maatwebsite); PDF via DomPDF view `pdf.invoice-recap` A4 landscape + `CompanyProfile`. Perilaku ini dikunci oleh test `InvoiceControllerTest` (`test_export_excludes_draft_and_cancelled_from_omzet`, `test_export_includes_hpp_profit_and_pph_final`, `test_date_range_overrides_month_in_export`, dll.).

**Template Excel (`?template=`):** tanpa parameter = **Bawaan** (`InvoiceRecapExport`, di atas). `template=jsm` = **JSM** (`App\Exports\InvoiceRecapJsmExport`, meniru "Rekap Invoice JSM 2026 (Nisa).xlsx", 12 Okt 2026): judul `Recap Invoice[ {klien bila tepat satu klien difilter}] - {inisial perusahaan}` (`InvoiceNumberService::companyInitials()`), baris periode ramah (`jsmRecapPeriod()`: setahun penuh → "2026", satu bulan → "Oktober 2026", rentang → "1 Januari 2026 – 31 Maret 2026"), invoice dikelompokkan per bulan terbit (urut tanggal lalu `invoice_sequence`), kolom No. (berlanjut) · No. Invoice · Date Invoice · Company · Total Invoice (omzet tanpa PPN) · PPN {ppn_rate}% (invoice sejak fitur PPN: nilai `ppn_amount` tersimpan — 0 bila tanpa PPN; invoice lama `ppn_rate NULL`: tetap **rumus** `=F×rate%` tarif perusahaan, baris non-PPN dihapus manual di Excel) · Grand Total (rumus) · Payment (tanggal `payments.payment_date` terakhir) · Keterangan (nama layanan item non-titipan, dipisah koma); baris Total per bulan & Grand Total berupa rumus `SUM`. Data tambahan (`items_description`, `last_payment_date`, `invoice_sequence`) diisi `buildRecapData()` dengan dua query batch. Menu **Ekspor** di daftar: "Rekap Excel · Default", "Rekap Excel · JSM", "Rekap PDF". Dikunci `tests/Feature/InvoiceRecapJsmExportTest.php`.

### Download / Preview PDF Invoice (per lembar)
**Alur step-by-step:**
1. Dari `PrintInvoiceDialog` (`resources/js/pages/invoices/components/print-invoice-dialog.tsx`), user memilih jenis tagihan (Penuh / Uang muka `dp_amount` / Pelunasan `pelunasan_amount`, default Pelunasan bila sudah ada pembayaran) dan template (kartu Kisantra/Semesta/AGSA/Generik + template builder — **atau**, bila perusahaan punya template sendiri, hanya kartu template perusahaan + template builder; lihat "Template invoice per perusahaan"). Panel kanan menampilkan **PDF asli** dari `/invoice/{id}/preview` dengan parameter yang sama (nominal DP ditunda 400 ms).
2. GET `/invoice/{invoice}/download` atau `/invoice/{invoice}/preview` (`can:view invoices`), query: `template` (default `CompanyInvoiceTemplate::defaultTemplate()`: `perusahaan` bila perusahaan punya template sendiri, selain itu `kisantra-invoice`), `dp_amount`, `pelunasan_amount`. Nilai Blade yang sah = `CompanyInvoiceTemplate::allowed()`; selain itu 404.
3. Routing template (closure di `routes/web.php` ±154–203):
   - `template=builder:{id}` → `PdfTemplate::findOrFail(id)` + `BuilderInvoicePrinter::render($pdfTemplate, $invoice, $dpAmount, $pelunasanAmount)`; nama file dari `->filename()` (prefix `DP-`/`Pelunasan-`).
   - selain itu → `InvoicePrintService::generateSingleInvoicePdf()` → `renderPdf()` dengan template Blade `resources/views/pdf/{template}.blade.php` (`kisantra-invoice`, `semesta-invoice`, `agsa-invoice`, `invoice`). `renderPdf()` adalah **satu-satunya** jalur render PDF Blade (unduhan, pratinjau tab/iframe, dan pratinjau editor).
4. `download` mengirim `streamDownload` (attachment); `preview` mengirim body PDF dengan `Content-Disposition: inline` (dibuka di tab/iframe).

### Template invoice per perusahaan (statis)
Desain invoice milik satu perusahaan ditulis di kode, bukan diatur lewat menu: folder `resources/views/pdf/perusahaan/{slug}/` berisi `invoice.blade.php` + gambar/font yang dipakainya (logo, font judul). **File itu hanya berisi desain** (susunan, warna, font, label tetap seperti "TERM PAYMENT"). Sejak 2026-11-12 data perusahaan dibaca dari Pengaturan › Profil perusahaan lewat `$company` (`getCompanyInfo()`): nama, alamat, email, telepon, rekening `bank_accounts`, penanda tangan + kota `signature.city` (`signature_city`) — admin mengubahnya tanpa deploy. Template boleh menata data itu (mis. nama selalu kapital, alamat BAS kapital per baris lewat `nl2br`) tetapi tidak menulis nilainya. **Gambar tanda tangan & stempel tidak pernah disimpan di repo (repo publik)** — dari upload Profil perusahaan (`signature_base64`/`stamp_base64`, dikirim `buildViewData()` sebagai `$tanda_tangan`/`$stempel`; kosong = ruang tanda tangan basah). Mengganti desain = ubah file lalu deploy. Saat ini: PT Samboja Laju Utama (`samboja-laju-utama`) dan PT Berkah Andalan Samboja (`berkah-andalan-samboja`), masing-masing ditiru dari invoice Word perusahaannya. Menambah perusahaan = folder baru dengan slug perusahaan itu; tidak ada kode lain yang perlu diubah.

**Penjelasan kode** (`app/Services/CompanyInvoiceTemplate.php`):
- `view()` → `pdf.perusahaan.{slug}.invoice` bila view itu ada untuk `tenant()` aktif, selain itu `null`. Slug divalidasi `[a-z0-9-]` karena ikut menjadi path.
- `allowed()` → `['perusahaan']` untuk perusahaan bertemplate, selain itu `InvoicePrintService::BLADE_TEMPLATES`. Dipakai rute download/preview (404) dan `InvoicePreviewRequest` (422): perusahaan bertemplate **tidak bisa** mencetak dengan template bawaan perusahaan lain lewat URL.
- `defaultTemplate()` → `perusahaan` / `kisantra-invoice`; dipakai rute PDF, pratinjau editor, dan tab Pratinjau cetak di drawer (tanpa parameter).
- `option()` → `{value: 'perusahaan', label: <nama perusahaan>}` atau `null`; dikirim sebagai prop `companyTemplate` (index, create/edit lewat `formOptions()`) dan `company_template` (`/invoices/{id}/data`). Dialog cetak & editor hanya menawarkan opsi ini bila ada.
- `viewFor($template)` dipakai `InvoicePrintService::renderPdf()`; `asset($file)` mengembalikan data URI berkas di folder perusahaan aktif (`$aset('logo.jpg')` di Blade; nama berkas dengan path ditolak).
- Font milik template ditaruh di `fonts/` folder perusahaan (SLU: Carlito-Bold, pengganti Calibri berukuran identik, lisensi OFL di sebelahnya; BAS: Carlito-Bold untuk judul + Caladea Regular/Bold, pengganti Cambria berukuran identik, lisensi Apache 2.0 di sebelahnya) dan dimuat `@font-face` dengan `CompanyInvoiceTemplate::path()`. Folder tiap perusahaan berdiri sendiri, jadi font yang sama disalin (git menyimpan isi yang identik sekali). Khusus template perusahaan, `renderPdf()` memberi DomPDF `chroot`/`fontDir`/`fontCache` dari `config/dompdf.php` + subsetting font: `setOptions()` tanpa config membuat chroot = folder paket vendor sehingga berkas font di `resources/` ditolak diam-diam (judul jatuh ke Helvetica). Dikunci `CompanyInvoiceTemplateTest` (PDF memuat `Carlito-Bold`; BAS juga `Caladea-Regular`/`Caladea-Bold`).
- Tinggi baris DomPDF = `line-height` × (ascender − descender font) × `font_height_ratio` 1,1 (`config/dompdf.php`), bukan `line-height` × ukuran huruf seperti di browser. Untuk meniru spasi tunggal Word, `line-height` disesuaikan per font (Times 1,15; Caladea 0,91) — lihat komentar di Blade BAS.
- Template perusahaan memakai data yang sama dengan template lain (`buildViewData()`), termasuk mode DP/pelunasan, dan **tidak menghitung apa pun**. Baris total disusun sistem: `App\Services\InvoiceTotalRows::for()` → `$baris_total`, larik `{jenis, nomor, label, jumlah}` dengan jenis `diskon` · `dpp` (Total Invoice (Sebelum PPN), hanya bila ber-PPN) · `ppn` (bernomor = jumlah item + 1) · `total` + `diterima` (pembayaran masuk; hanya tagihan uang muka/pelunasan) · `tagihan` (baris terakhir: GRAND TOTAL / TAGIHAN UANG MUKA (DP x%) / TAGIHAN PELUNASAN). Nominal dari `subtotal`, `discount_amount`, `ppn_amount`, `total_amount`, pembayaran tersimpan. Template cukup me-loop baris itu dan memberi gaya per jenis (`tr.baris-{jenis}`); label boleh diganti per jenis bila desain perusahaan memakai kata lain. Aturan baru (mis. potongan PPh 23) ditambahkan di `InvoiceTotalRows`, sehingga semua template perusahaan ikut. Dikunci `InvoiceTotalRowsTest`. Tabel item wajib berkelas `items-table` dengan baris item di `tbody` agar sorotan `highlight` pratinjau editor bekerja; baris total di tabel terpisah.
- Pemindahan data ke profil (2026-11-12) tidak mengubah PDF: render SLU & BAS sebelum/sesudah dibandingkan per piksel untuk 7 kasus (penuh, uang muka, pelunasan, diskon, multi-halaman, tanpa PPN, satuan berbeda) dan identik. Agar invoice yang sudah dicetak dengan template SLU tidak kehilangan rekening saat deploy, migration tenant `2026_11_12_224348_isi_rekening_dan_kota_template_perusahaan` mengisi `bank_accounts` & `signature_city` SLU/BAS dengan nilai yang dulu tertulis di Blade, **hanya bila masih kosong** (perusahaan lain tidak tersentuh). Nama, alamat, dan telepon tidak diisi migration: di server, periksa isian Profil kedua perusahaan itu (mis. alamat BAS sebaiknya per baris seperti dokumen asli).
- Data contoh lokal: `php artisan db:seed --class=ContohInvoiceSluSeeder` — memprovisioning PT SLU saja (organization `mitra-group`), akun `admin.slu@mitragroup.id` (admin) & `staff.slu@mitragroup.id` (staff), password `password`, profil + format nomor SLU, satu klien dan empat invoice **fiktif**, serta gambar tanda tangan "CONTOH" yang digambar seeder (tidak menimpa tanda tangan yang sudah diunggah). Idempoten dan cocok dengan `MitraGroupSeeder`. PT BAS: `php artisan db:seed --class=ContohInvoiceBasSeeder` — sama, untuk BAS saja: akun `admin.bas@mitragroup.id` (admin) & `staff.bas@mitragroup.id` (staff), satu klien, dua invoice terbit (satu meniru invoice Word, satu dengan dua item bersatuan beda) dan satu draft, email profil `@example.com` (dokumen asli tidak mencantumkan email). Kedua seeder hanya berisi data; alurnya di `ContohInvoicePerusahaanSeeder` (abstrak). Belum ada di template SLU maupun BAS: judul DEBIT NOTE, kode jenis di nomor (`INV-FINAL`, `DN-PNBP`, …), dan potongan PPh 23 (BAS 0,5%, SLU 2%) — ketiganya butuh data/aturan baru, bukan desain.
- Template BAS (`berkah-andalan-samboja/invoice.blade.php`) meniru `INVOICE FINAL … .docx`: logo kiri atas dan judul `I N V O I C E` berkotak hanya di halaman pertama (dokumen asli tidak memakai header Word), tabel item bergaya tabel Excel tersemat (judul kolom merah `#da5a5a`, garis bawah ganda), kotak alamat (kapital, per baris sesuai isian Alamat) & kotak rekening dengan tinggi masing-masing, lalu kota-tanggal dan penanda tangan — semuanya dari Profil perusahaan. Margin kanan 1,78 cm karena tabel Excel di dokumen asli selebar 16,86 cm (melewati margin kanan Word 2,4 cm); blok nomor/klien tetap selebar teks Word. Karena PPh 23 belum ada, baris "Total Invoice + PPN (belum dipotong PPh)" dan "PPh 23" dari dokumen asli tidak tercetak; GRAND TOTAL = `total_amount`.

**Penjelasan kode** (`app/Services/InvoicePrintService.php`):
```php
if ($invoice->ppn_rate !== null) {          // invoice sejak fitur PPN
    $ppnAmount = (int) $invoice->ppn_amount;  // sudah termasuk total_amount
    $grandTotal = $displayAmount;             // terbilang = TOTAL tercetak
} elseif ($template === 'semesta-invoice') { // invoice lama: rumus lama
    $ppnAmount = ($itemsTotal * $ppnRate / 100);
    $grandTotal = $subtotalWithPpn - $pph22Amount - $discountAmount - (...);
} else {
    $ppnAmount = $company?->is_pkp ? ($displayAmount * $company->ppn_rate / 100) : 0;
    $grandTotal = $displayAmount + $ppnAmount;
}
```
Konteks PKP/PPN: invoice ber-data PPN (`ppn_rate` tidak null) memakai PPN tersimpannya — Kisantra mengganti blok PP 55 (DPP − 0,5% / PP 55 / Grand total) dengan **DPP** (layanan − diskon) + **PPN x%** bila `ppn_amount > 0`; Generik menambah baris PPN; Semesta memakai PPN tersimpan + baris diskon dan TOTAL = `total_amount`; nomor faktur tercetak di header ketiganya. Invoice lama (`ppn_rate NULL`) tetap memakai rumus lama di atas (Kisantra/Generik: PPN hanya ke `terbilang` bila `is_pkp`; Semesta: PPN dari `ppn_rate` perusahaan + PPh 22 1,5%). `agsa-invoice` memakai rumus tetapnya sendiri (tidak tersentuh). Token template builder: `{{invoice.dpp}}`, `{{invoice.ppn_rate}}`, `{{invoice.ppn_amount}}`, `{{invoice.faktur}}` (`TemplateTokens`). Service juga memisahkan `regular_items` vs `tax_deposit_items`, menghitung `terbilang` (angka → kata bahasa Indonesia via `numberToWords()`), dan menyematkan logo/ttd/stempel sebagai base64. `BuilderInvoicePrinter` (`app/Services/BuilderInvoicePrinter.php`) me-render layout JSON `PdfTemplate` (banded atau flat legacy) dengan `paymentContext` mode `full|dp|pelunasan` dan custom font.

### Panduan & video tutorial

- Tombol **Tutorial** di header daftar (`<TutorialButton slug="invoices" />`) dan halaman `/panduan` membaca `video/invoices/guide.ts` (teks panduan: peran, alur, tugas, dampak, peringatan, matriks hak akses) dan `video/invoices/tutorial.tsx` (komposisi Remotion `InvoicesStaff`, `InvoicesFinanceManager`, `InvoicesAdmin`).
- Isi video: Staff menyusun invoice + cetak; Finance manager menerbitkan, cetak, mencatat pembayaran, Perlu ditagih & ekspor; Admin melihat dampak pembayaran (saldo rekening, Arus Kas › Pemasukan, Laba Rugi pemulihan biaya) + peringatan (hapus pembayaran via Arus Kas, ubah setelah dibayar, cascade hapus klien/rekening, pengingat jatuh tempo).
- File: `video/invoices/{guide.ts, shots.ts, steps.ts, tutorial.tsx, screens/*.webp}`; capture `video/capture/invoices.js` (membuat 1 invoice di DB QC), `video/capture/invoices-pdf.py`, `video/capture/invoices-admin.js` (hanya membaca).
- Fitur Jurnal (9 Nov 2026): `guide.ts` menjelaskan kotak **Jurnal · Pratinjau** di dialog Catat pembayaran (titipan dulu) dan dampaknya. Layar `fm-pay-empty`/`fm-pay-filled` **belum** diambil ulang (masih tanpa kotak Jurnal): `invoices.js` butuh data QC lengkap (mis. layanan katalog "Website company profile …") yang tidak tersedia di lingkungan QA fitur ini; target `journal` sudah ditambahkan di skrip untuk pengambilan berikutnya.
- Ambil ulang screenshot bila UI/alur berubah: jalankan server QC (`DB_DATABASE=finance_management_qc php artisan serve --port=8011`), `invoices.js` lewat Playwright MCP (`browser_run_code_unsafe`), `python video/capture/invoices-pdf.py` (PDF unduhan → gambar; penampil PDF Chromium headless kosong sehingga pratinjau cetak memakai gambar PDF asli), `invoices-admin.js` (ubah `ID`/`NUMBER` sesuai hasil `invoices.js`), lalu `python video/capture/to-webp.py invoices` dan salin koordinat ke `shots.ts`. Pratinjau: `npm run video`.

## Perhitungan Accessor (app/Models/Invoice.php)

| Accessor | Rumus |
|---|---|
| `amount_paid` | Σ `payments.amount` (pakai relasi yang sudah loaded bila ada) |
| `amount_remaining` | `total_amount − amount_paid` |
| `total_cogs` | Σ `items.cogs_amount` (catatan: **termasuk** item titipan pajak; stats index mengecualikannya via query terpisah) |
| `gross_profit` | `total_amount − ppn_amount − total_cogs` (PPN bukan laba) |
| `dpp_amount` | `max(0, subtotal − Σ item titipan pajak − discount_amount)` — dasar PPN |
| `allocatePayments($paid, $taxDeposit, $ppn)` (statis) | "Titipan dulu": `{tax_deposit, ppn, revenue}` dari jumlah yang sudah dibayar — satu rumus untuk Laba Rugi dan jurnal pembayaran |
| `outstanding_profit` / `paid_profit` | porsi laba yang belum/sudah "tertutup" pembayaran (model tutup-modal-dulu: pembayaran dianggap menutup HPP lebih dulu) |

## Keterkaitan Antar Modul
- **Bank Account:** setiap `Payment` ber-`bank_account_id`; saldo bank = `initial_balance + Σ payments + Σ tx credit − Σ tx debit` (accessor `getBalanceAttribute` di `app/Models/BankAccount.php`) — mencatat/menghapus pembayaran otomatis mengubah saldo tampilan tanpa menulis apa pun ke tabel bank.
- **Recurring Invoices:** `RecurringInvoice::publish()` membuat baris di `invoices` + `invoice_items` (lihat `docs/module/recurring-invoices.md`).
- **Clients:** `billed_to_id` dan `invoice_items.client_id`; menghapus klien meng-cascade hapus invoice & item-nya (override `Client::delete()`).
- **Services:** master harga saat menyusun item — hanya disalin (snapshot), tidak ada FK.
- **Cash Flow & Laporan Laba Rugi:** membaca `payments` (kas masuk) dan `cogs_amount`/`is_tax_deposit` untuk omzet/HPP. Jurnal tampilan pembayaran (Arus Kas, Kas & Bank, dialog Catat pembayaran) memecah setiap pembayaran dengan rumus "titipan dulu" yang sama dengan Laba Rugi (`Invoice::allocatePayments()`), sehingga Σ kredit "Pendapatan dari Invoice" dan "PPN Keluaran" pembayaran satu periode sama dengan angka Laba Rugi periode itu. HPP tidak dijurnal di pembayaran (tidak ada uang yang bergerak).
- **PDF Templates (Settings):** `PdfTemplate` + `CustomFont` dipakai `BuilderInvoicePrinter`; daftar template builder dikirim ke halaman index sebagai `customTemplates`.

## Invarian & Jebakan
- Semua nominal **integer rupiah penuh** — jangan pernah pakai float; `quantity` satu-satunya decimal.
- Invoice `draft` tidak punya `invoice_number`; nomor hanya diberikan saat `send` (termasuk invoice hasil publish recurring), unik global, sequence reset sesuai pengaturan (default per bulan `issue_date`).
- **Urutan dibaca dari `invoice_sequence`, bukan dari teks nomor** — bentuk nomor bisa diganti kapan saja. Jangan menulis `invoice_sequence` manual kecuali sengaja; biarkan hook `saving` yang mengisinya. Mengganti pola tidak mengubah nomor yang sudah terbit.
- Rollback hanya untuk invoice `sent` dengan sequence **tertinggi** di periodenya (`isLatestInNumberingPeriod`) — jaga urutan nomor tanpa lubang.
- `updateStatus()` menghasilkan `sent` (ber-nomor, belum ada pembayaran) / `draft` (tanpa nomor) / `partially_paid` / `paid`. `overdue` dan `cancelled` ada di enum DB tetapi tidak ada transisi otomatis di kode saat ini (cancelled hanya dipakai sebagai filter pengecualian statistik/export).
- Invoice yang punya pembayaran **tidak bisa dihapus**; hapus pembayarannya dulu.
- `send`/`rollback` dan **memilih nomor sendiri** di dialog terbit butuh `edit invoices`. User `view`+`create` saja (role staff) tetap bisa **Simpan & terbitkan** saat membuat invoice (sesuai panduan pengguna), tetapi nomornya selalu otomatis: `invoice_number` dari request diabaikan.
- Pembayaran ditolak untuk invoice `draft` dan `paid` (`PaymentController::store`, HTTP 422).
- `update()` invoice **menghapus dan membuat ulang seluruh item** — ID `invoice_items` tidak stabil; jangan menyimpan referensi ke ID item.
- Statistik & export mengecualikan `draft` + `cancelled` dari omzet/HPP/laba dan **mengikuti tab status aktif** (hitungan tab tidak); item `is_tax_deposit` dikecualikan dari HPP di stats index tetapi accessor `total_cogs` model **tidak** mengecualikannya.
- Filter periode: backend memprioritaskan `date_from`/`date_to` atas `month`; UI menjaga keduanya saling eksklusif (pilih rentang → bulan dikosongkan, pilih bulan → rentang dikosongkan) supaya label tidak menyesatkan.
- Saldo bank dihitung dinamis — tidak ada kolom saldo yang perlu (atau boleh) di-update saat mencatat pembayaran.
- Endpoint payment & `/invoices/{id}/data` merespons **JSON**; `send`/`rollback`/`destroy` menjawab JSON untuk permintaan `expectsJson()` dan redirect + flash untuk yang lain. Jangan ubah aksi drawer menjadi kunjungan Inertia (`router.post`): redirect back mengganti halaman di belakang modal dan membuang hash.
- Modal detail ditentukan `location.hash` (`#invoice/{id}`), bukan path. Modul lain yang ingin detail ber-URL memakai `lib/resource-modal.ts` + `ResourceModalHost` yang sama.
- **Pratinjau = ekspor.** Pratinjau editor, tab Pratinjau cetak, dan dialog cetak menampilkan PDF dari `InvoicePrintService::renderPdf()`, bukan HTML tiruan. Render HTML di browser **tidak** identik dengan DomPDF (DomPDF mengabaikan `display:flex`, tinggi baris tabel berbeda — terukur ±9,7% piksel beda, QA 2026-09-26). `test_preview_pdf_is_identical_to_the_downloaded_pdf` mengunci kesamaan byte (kecuali stempel waktu & `/ID` acak). Satu-satunya pengecualian yang disengaja: sorotan baris `highlight` di pratinjau editor.
- **Template perusahaan menang.** Perusahaan yang punya folder `resources/views/pdf/perusahaan/{slug}/` hanya bisa mencetak dengan template itu (+ template builder miliknya); jangan menambah jalan pintas yang menerima template bawaan untuknya. Hitungan tetap di `buildInvoiceData()`/model dan baris total di `InvoiceTotalRows`, bukan di Blade perusahaan; data perusahaan (alamat, rekening, kota, penanda tangan) dari Profil perusahaan, bukan ditulis di Blade. Gambar tanda tangan/stempel asli tidak boleh di-commit (repo publik) — selalu lewat upload Profil perusahaan.
- `buildInvoiceData()` adalah satu-satunya tempat hitungan subtotal/diskon/total untuk store, update, dan pratinjau — jangan menduplikasi rumus. Rumus PPN hanya `Invoice::ppnFor()`.
- **Tarif PPN dibekukan per invoice.** Mengubah tarif atau mematikan PKP di Pengaturan tidak mengubah invoice yang sudah ber-PPN; hanya invoice baru yang tidak lagi diberi PPN. Jangan menghitung ulang PPN invoice lama dari `CompanyProfile`.
- `ppn_rate NULL` ≠ `0`: NULL = invoice sebelum fitur PPN (PDF/rekap JSM memakai perilaku lama), 0 = sengaja tanpa PPN. Jangan menormalkan NULL menjadi 0 lewat migrasi data.
- PPN ikut `total_amount` tetapi **tidak pernah** dihitung sebagai omzet/pendapatan/laba — kurangi `ppn_amount` di setiap angka laba/omzet baru.

## File Kunci
- `routes/web.php` (baris ±131–203) — definisi route invoices/payments/invoice PDF
- `app/Http/Controllers/InvoiceController.php`, `app/Http/Controllers/PaymentController.php`
- `app/Http/Requests/StoreInvoiceRequest.php`, `UpdateInvoiceRequest.php`, `SendInvoiceRequest.php`, `StorePaymentRequest.php`, `UpdatePaymentRequest.php`
- `app/Models/Invoice.php`, `app/Models/InvoiceItem.php`, `app/Models/Payment.php`, `app/Models/BankAccount.php`
- `app/Services/InvoicePrintService.php`, `app/Services/BuilderInvoicePrinter.php`, `app/Exports/InvoiceRecapExport.php`
- `resources/views/pdf/kisantra-invoice.blade.php` (+ `semesta-invoice`, `agsa-invoice`, `invoice`, `invoice-recap`)
- `app/Services/CompanyInvoiceTemplate.php`, `app/Services/InvoiceTotalRows.php`, `resources/views/pdf/perusahaan/{slug}/` (template statis per perusahaan), `database/seeders/ContohInvoicePerusahaanSeeder.php` (+ `ContohInvoiceSluSeeder`, `ContohInvoiceBasSeeder`), `tests/Feature/CompanyInvoiceTemplateTest.php`, `tests/Feature/ContohInvoiceSluSeederTest.php`, `tests/Feature/ContohInvoiceBasSeederTest.php`, `tests/Feature/InvoiceTotalRowsTest.php`, `tests/Feature/IsiRekeningTemplatePerusahaanTest.php`
- `app/Http/Requests/InvoicePreviewRequest.php`, `resources/js/lib/resource-modal.ts` + `components/resource-modal-host.tsx` (modal global berbasis hash), `resources/js/lib/navigation.ts`
- `resources/js/pages/invoices/index.tsx` (daftar), `create.tsx` (`InvoiceEditor`), `edit.tsx`, `components/invoice-drawer.tsx` (drawer + dialog kirim/bayar), `components/print-invoice-dialog.tsx`, `components/invoice-paper.tsx` (penampil PDF dua lapis), `components/ob.tsx` (status, tanggal lewat helper `@/i18n`, kelas Obsidian; `shortDate`/`longDate`/`dateTime`/`monthLabel` dipakai juga oleh Pinjaman, Piutang, Reimbursement, Pengaturan), `components/item-table-helpers.tsx` (sel tabel lama, dipakai Invoice Berulang)
- `tests/Feature/InvoiceControllerTest.php`, `tests/Feature/PaymentControllerTest.php`, `tests/Feature/InvoiceNumberAssignmentTest.php`, `tests/Feature/InvoicePpnTest.php` (PPN: simpan, snapshot tarif, invoice lama, status Lunas, faktur, PDF Kisantra, Laba Rugi, rekap, invoice berulang, Ringkasan)
- `database/migrations/2026_10_13_135211_add_ppn_to_invoices_table.php`
