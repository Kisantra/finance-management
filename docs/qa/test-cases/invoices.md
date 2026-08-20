# Test Case — Invoice & Pembayaran

Sumber teknis: [`docs/module/invoices.md`](../../module/invoices.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-satu` (DB `tenant_qa-satu`), eksekusi lewat HTTP
dengan cookie sesi asli + verifikasi database. Bukan production.

Prasyarat data yang dibuat sendiri di awal sesi: rekening `QA Kas Utama (Bank QA)`
`id=1` dengan `initial_balance = 10.000.000`; klien `Rina Perorangan` (`id=2`,
Active) dan `Klien Dibuat Staff` (`id=6`, Active); 5 layanan.
`company_profiles`: `name = "QA Satu"`, `abbreviation = "SAT"`, `bank_accounts = NULL`.

Peta permission invoice yang berlaku (dibaca dari `finance_central.role_has_permissions`):

| Role | view | create | edit | delete |
|---|---|---|---|---|
| admin | ya | ya | ya | ya |
| finance manager | ya | ya | ya | ya |
| staff | ya | ya | **tidak** | **tidak** |

Catatan gate route: `send` dan `rollback` **hanya** berada di grup
`can:view invoices` (`routes/web.php:180-181`) — tidak ada middleware tambahan.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat invoice draft 2 item, item kedua atas nama klien lain | POST `/c/qa-satu/invoices` `client_id=2`, `issue_date=2026-08-05`, `due_date=2026-08-20`, item1 `Jasa Izin Usaha` qty `2` × `1.500.000` cogs `400.000`, item2 `Lapor SPT Tahunan` (`client_id=6`) qty `1` × `800.000` cogs `100.000`, diskon `fixed 0` | Invoice `status=draft`, `invoice_number` **NULL**, `subtotal=3.800.000`, `total_amount=3.800.000`; 2 item dengan `amount` benar | BE | 302. DB `id=1`: `invoice_number` kosong/NULL, `status=draft`, `subtotal=3800000`, `total_amount=3800000`. Item `id=1 amount=3000000 client_id=2`, `id=2 amount=800000 client_id=6` | Pass |
| N02 | `quantity` pecahan → `amount = round(unit_price × quantity)` | POST 1 item `Kelola Sosmed` `quantity=2.5`, `unit_price=2.500.001` (hasil eksak `6.250.002,5`) | `amount = 6.250.003` (pembulatan ke atas), disimpan integer | BE | DB item `id=3`: `quantity=2.500`, `amount=6250003`, header `subtotal=6250003` | Pass |
| N03 | Diskon **percentage** dihitung dari subtotal dan disimpan dua bentuk | POST 2 item (`12.000.000` + `5.000.000` titipan pajak), `discount_type=percentage`, `discount_value=10` | `subtotal=17.000.000`, `discount_amount=1.700.000`, `total_amount=15.300.000`; `discount_value` mentah tetap `10` | BE | DB `id=3`: `subtotal=17000000 discount_type=percentage discount_value=10 discount_amount=1700000 total_amount=15300000` | Pass |
| N04 | Diskon **fixed** dipakai apa adanya | POST 1 item `1.000.000`, `discount_type=fixed`, `discount_value=250000` | `discount_amount=250.000`, `total_amount=750.000` | BE | DB `id=4`: `discount_amount=250000 total_amount=750000` | Pass |
| N05 | Item `is_tax_deposit` tersimpan sebagai boolean | Lihat item ke-2 pada N03 (`Titipan PPh 21`, `is_tax_deposit=true`) | Kolom `is_tax_deposit=1` | BE | DB item `id=5`: `is_tax_deposit=1`, `cogs_amount=5000000` | Pass |
| N06 | Kirim invoice draft — nomor terpasang, status jadi `sent` | POST `/c/qa-satu/invoices/1/send` `invoice_number=001/INV/QS-RP/VIII/2026` | 302; `invoice_number` terisi, `status=sent` | BE | DB `id=1`: `invoice_number=001/INV/QS-RP/VIII/2026`, `status=sent`. **Nomor ini diketik pada payload uji**, bukan dihasilkan server — lihat TEMUAN I-01 | Pass (dengan catatan berat) |
| N07 | Sequence bertambah dalam bulan yang sama | Kirim invoice 3 dengan `002/INV/QS-RP/VIII/2026`; lalu invoice 11 dengan `003/…`; lalu invoice 13 dengan `004/…` | Nomor unik, urut naik dalam bulan VIII/2026 | BE | Semua diterima 302; DB menyimpan `001`, `002`, `003`, `004` untuk Agustus. **Urutan ditentukan oleh nilai yang dikirim klien**, server tidak menghitungnya | Pass (dengan catatan berat) |
| N08 | Sequence **reset per bulan** `issue_date` | Buat invoice `issue_date=2026-09-02`; kirim `001/INV/QS-RP/IX/2026` | Diterima meski Agustus sudah punya `001`–`003` | BE | DB `id=12`: `001/INV/QS-RP/IX/2026`, `issue_date=2026-09-02`. `getMaxSequenceFromDb()` menyaring per bulan `issue_date`, terbukti lewat `rollbackableIds` di N09 | Pass |
| N09 | `rollbackableIds` = sequence tertinggi **per bulan**, khusus status `sent` | GET `/c/qa-satu/invoices?month=2026-08`, baca prop `rollbackableIds` | Hanya 1 ID per bulan-tahun | BE | Saat Agustus max = `002` (inv 3) dan September `001` (inv 12) → prop `[11,12]` (inv 11 = `003` Agustus, inv 12 = September). Pada pemeriksaan sebelumnya `[3]` saat inv 3 satu-satunya. Pengelompokan per `Y-m` benar; invoice `sent` bernomor tanpa pola `/INV/` (inv 4) **tidak** masuk daftar | Pass |
| N10 | Rollback invoice dengan sequence tertinggi di bulannya | POST `/c/qa-satu/invoices/3/rollback` (nomor `002`, tertinggi saat itu) | Flash `success`; `invoice_number` jadi NULL, `status=draft` | BE | Flash `{"success":"Invoice berhasil dikembalikan ke draft."}`. DB `id=3`: `invoice_number` NULL, `status=draft` | Pass |
| N11 | Pembayaran sebagian → `partially_paid`, saldo bank naik | POST `/c/qa-satu/invoices/1/payments` `amount=1.000.000`, `payment_date=2026-08-19`, `payment_method=bank_transfer`, `bank_account_id=1`, `reference_number=TRX-001` | 200 JSON payment; invoice `partially_paid`; saldo `10.000.000` → `11.000.000` | BE | 200, JSON `{"id":1,"amount":1000000,…,"bank_account_name":"QA Kas Utama (Bank QA)"}`. DB `id=1 status=partially_paid`. Prop saldo `10000000` → `11000000` | Pass |
| N12 | Pelunasan → `paid`, saldo naik lagi | POST pembayaran kedua `amount=2.800.000` (total tagihan `3.800.000`) | Invoice `paid`; saldo `13.800.000` | BE | 200. DB `id=1 status=paid`. Saldo prop `13800000`. Saldo memang **terhitung** (`initial_balance + Σ payments + credit − debit`), tidak ada kolom saldo yang ditulis | Pass |
| N13 | Hapus **semua** pembayaran → invoice jatuh ke `draft` (invarian yang didokumentasikan) | DELETE `/c/qa-satu/payments/1` lalu `/payments/2` pada invoice 1 (status `paid`, bernomor) | Setelah pembayaran ke-1 dihapus: `partially_paid`; setelah semua dihapus: `draft` **dengan nomor tetap terpasang** | BE | Setelah hapus pembayaran 1 → `partially_paid`; setelah hapus pembayaran 2 → `status=draft`, `invoice_number=001/INV/QS-RP/VIII/2026` masih ada. Konsekuensi berbahaya di A20 & TEMUAN I-04 | Pass (invarian terbukti) |
| N14 | Update invoice **menghapus & membuat ulang** seluruh item; status & nomor tidak berubah | PUT `/c/qa-satu/invoices/3` — ganti 2 item jadi 1 item `9.000.000`, `client_id` berubah 2 → 6, `due_date` 2026-08-30 → 2026-09-01, diskon fixed `500.000` | Item lama hilang (ID baru), header dihitung ulang, `invoice_number` & `status` tetap, pembayaran tetap | BE | Item `id=4,5` → hilang; muncul `id=13`. Header: `subtotal=9000000 discount_amount=500000 total_amount=8500000 billed_to_id=6 due_date=2026-09-01`, `invoice_number=002/INV/QS-RP/VIII/2026` & `status=paid` tetap. Pembayaran `id=3,4` masih ada. **ID item tidak stabil — terbukti** | Pass |
| N15 | Endpoint detail `show` merespons JSON lengkap (bukan halaman Inertia) | GET `/c/qa-satu/invoices/3` dengan `Accept: application/json` | 200 JSON berisi header + `client` + `items` + `payments` + accessor | BE | 200 `{"status":"paid","number":"002/INV/QS-RP/VIII/2026","total":8500000,"paid":99000001,"remaining":-90500001,"client":"Klien Dibuat Staff","items":1,"payments":2}` | Pass |
| N16 | Statistik index mengecualikan `draft` + `cancelled` | GET `?month=2026-08`, bandingkan prop `stats` dengan SQL yang sama | `invoice_count` & `total_revenue` hanya dari status non-draft/cancelled | BE | Prop `{"invoice_count":3,"total_revenue":13050000,…}`; SQL `cnt=3 rev=13050000` — identik. `total_outstanding=4450000` cocok dengan (3.800.000 + 750.000) − 100.000 | Pass |
| N17 | Item `is_tax_deposit` **dikecualikan** dari HPP di stats index | Buat + kirim invoice berisi item biasa (cogs `1.000.000`) + item titipan pajak (cogs `1.100.000`). Bandingkan `stats.total_cogs` sebelum/sesudah | Naik hanya `1.000.000` | BE | `total_cogs` `2.700.000` → `3.700.000` (+1.000.000). Item titipan (cogs `1.100.000`) diabaikan. Sesuai `SUM(CASE WHEN is_tax_deposit = 0 …)` | Pass |
| N18 | Ubah pembayaran (`POST /payments/{id}`) memicu hitung ulang status | POST `/c/qa-satu/payments/6` `amount=40.000.000` pada invoice `total=40.000.000`; lalu kembalikan ke `5.100.000` | Status `partially_paid` → `paid` → `partially_paid` | BE | Naik ke `40.000.000` → DB `id=11 status=paid`; turun ke `5.100.000` → `status=partially_paid`. `updateStatus()` dipanggil di kedua arah | Pass |
| N19 | Export rekap Excel & PDF terfilter | GET `/c/qa-satu/invoices/export/excel?month=2026-08` dan `/export/pdf?month=2026-08` | 200 dengan MIME yang benar | BE | Excel: `200`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 7.665 byte. PDF: `200`, `application/pdf`, 15.212 byte, magic `%PDF-1.7`. **Isi baris tidak dibuka/diperiksa** — pengecualian draft/cancelled hanya diverifikasi lewat baca kode (`buildRecapData()` `whereNotIn(['draft','cancelled'])`) dan lewat N16 yang memakai aturan sama | Pass (isi belum diperiksa) |
| N20 | `date_from`/`date_to` menimpa filter `month` | GET `?month=2026-08` lalu `?month=2026-08&date_from=2026-09-01&date_to=2026-09-30` | Query kedua hanya memuat data September | BE | `month=2026-08` → `count=2 rev=43.800.000`; ditambah range September → `count=1 rev=2.000.000` (hanya invoice `id=12`). Presedens range atas bulan terbukti | Pass |
| N21 | Alur berantai izin: staff membuat, admin mengirim, manager mencatat pembayaran | Staff POST invoice (`3 × 1.000.000`, diskon 5%); admin POST send `004/INV/QS-RP/VIII/2026`; manager POST pembayaran `1.000.000` | Ketiganya berhasil sesuai permission masing-masing | BE | Staff store 302 → DB `id=13 subtotal=3000000 discount_amount=150000 total_amount=2850000 status=draft`. Admin send 302 → `004/INV/QS-RP/VIII/2026 status=sent`. Manager payment 200 → `status=partially_paid` | Pass |
| N22 | Staff boleh membuka form buat invoice | GET `/c/qa-satu/invoices/create` sebagai staff | 200 | BE | 200 | Pass |
| N23 | Staff boleh mencatat pembayaran (route digate `can:create invoices`) | POST `/c/qa-satu/invoices/1/payments` `amount=100.000` sebagai staff | 200, pembayaran tercatat | BE | 200 JSON `{"id":5,"amount":100000,…}` | Pass |
| N24 | Daftar invoice terbuka dengan tab status, filter periode, dan kartu statistik | Admin buka menu Invoice | Tab status, filter periode, dan kartu pendapatan/laba kotor/outstanding tampil | FE+BE | Ketiganya tampil | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | `items` dihilangkan sama sekali | POST tanpa key `items` | 422 | BE | 422 `{"items":["The items field is required."]}` | Pass |
| A02 | `items` array kosong (batas `min:1`) | POST `items=[]` | 422 | BE | 422 `{"items":["The items field is required."]}` | Pass |
| A03 | `due_date` satu hari **sebelum** `issue_date` | `issue_date=2026-08-10`, `due_date=2026-08-09` | 422 | BE | 422 `{"due_date":["The due date field must be a date after or equal to issue date."]}` | Pass |
| A04 | `due_date` **sama dengan** `issue_date` (batas `after_or_equal`) | keduanya `2026-08-10` | 302 diterima | BE | 302, invoice `id=5` terbuat | Pass |
| A05 | `quantity = 0` | item `quantity=0` | 422 | BE | 422 `{"items.0.quantity":["The items.0.quantity field must be at least 0.001."]}` | Pass |
| A06 | `quantity = 0.0009` (satu langkah di bawah batas) | item `quantity=0.0009` | 422 | BE | 422 `{"items.0.quantity":["… must be at least 0.001."]}` | Pass |
| A07 | `quantity = 0.001` (batas) | item `quantity=0.001`, `unit_price=1.000.000` | 302 diterima | BE | 302, invoice `id=6`, `amount=1000` (`round(1.000.000 × 0,001)`) | Pass |
| A08 | `unit_price` desimal — invarian integer rupiah | item `unit_price=1000.5` | 422 | BE | 422 `{"items.0.unit_price":["The items.0.unit_price field must be an integer."]}` | Pass |
| A09 | `client_id` tidak ada di DB | `client_id=9999` | 422 | BE | 422 `{"client_id":["The selected client id is invalid."]}` | Pass |
| A10 | `items.*.client_id` tidak ada di DB | item `client_id=8888` | 422 | BE | 422 `{"items.0.client_id":["The selected items.0.client_id is invalid."]}` | Pass |
| A11 | Invoice untuk klien **Inactive** lewat request langsung | `client_id=1` (status `Inactive`) | Seharusnya ditolak (opsi FE menyaringnya) | FE+BE | GAGAL pada percobaan pertama: invoice terbit untuk klien nonaktif. **Setelah TEMUAN C-04 (clients.md) diperbaiki**: `StoreInvoiceRequest` menolak 422 untuk `client_id` maupun `items.*.client_id` | Pass (percobaan ke-2) |
| A12 | Diskon persentase `150%` (tanpa batas atas) | `discount_type=percentage`, `discount_value=150`, subtotal `1.000.000` | Seharusnya ditolak atau dibatasi 100% | FE+BE | GAGAL pada percobaan pertama: diskon 150% tersimpan `discount_amount=1.500.000`. **Setelah TEMUAN I-05 diperbaiki**: server menolak 422 "Diskon persen tidak boleh melebihi 100%", dan layar menjepit ketikan 150 menjadi 100 sebelum sempat dikirim | Pass (percobaan ke-2) |
| A13 | Diskon fixed melebihi subtotal | `discount_type=fixed`, `discount_value=5.000.000`, subtotal `1.000.000` | Seharusnya ditolak | FE+BE | GAGAL pada percobaan pertama: diskon nominal Rp 5.000.000 atas subtotal Rp 1.000.000 tersimpan. **Setelah diperbaiki**: ditolak 422 dengan menyebut batas subtotalnya; input nominal di layar juga dijepit ke subtotal | Pass (percobaan ke-2) |
| A14 | Diskon persentase pecahan `12,5%` | `discount_type=percentage`, `discount_value=12.5`, subtotal `1.000.000` | Diskon `125.000`, atau ditolak dengan pesan jelas | FE+BE | GAGAL pada percobaan pertama: 12,5% dipotong diam-diam menjadi 12 (selisih Rp 5.000 hilang tanpa pesan). **Setelah TEMUAN I-06 diperbaiki**: pecahan ditolak dengan pesan yang menjelaskan alasannya, dan input layar hanya menerima bilangan bulat | Pass (percobaan ke-2) |
| A15 | `discount_value` negatif | `discount_value=-10` | 422 | BE | 422 `{"discount_value":["The discount value field must be at least 0."]}` | Pass |
| A16 | `discount_type` di luar enum | `discount_type=nominal` | 422 | BE | 422 `{"discount_type":["The selected discount type is invalid."]}` | Pass |
| A17 | Kirim invoice dengan nomor **duplikat** | POST send invoice 4 dengan `001/INV/QS-RP/VIII/2026` (sudah dipakai invoice 1) | 422 | BE | 422 `{"invoice_number":["The invoice number has already been taken."]}` | Pass |
| A18 | Kirim invoice dengan nomor **berformat sembarang** | POST send invoice 4 dengan `invoice_number=NOMOR-ASAL-SAJA-999` | Seharusnya ditolak — format nomor invoice adalah aturan bisnis | BE | Nomor berformat sembarang tetap diterima. **Bukan diperbaiki, melainkan keputusan produk**: penomoran manual dipertahankan untuk sekarang, pengaturan pola nomor per perusahaan direncanakan menyusul. Akibat lanjutannya (A21: invoice terkunci tak bisa rollback) **sudah** ditutup | **Fail** (disengaja — lihat TEMUAN I-01) |
| A19 | Rollback invoice yang **bukan** sequence tertinggi di bulannya | POST `/invoices/1/rollback` saat inv 1 = `001` dan inv 3 = `002` | Ditolak dengan pesan | BE | Flash `{"error":"Hanya invoice terbaru di bulan ini yang bisa di-rollback."}`; nomor & status invoice 1 tidak berubah | Pass |
| A20 | Rollback invoice ber-status `draft` | POST `/invoices/2/rollback` (draft) | Ditolak | BE | Flash `{"error":"Hanya invoice yang sudah terkirim yang bisa di-rollback."}` | Pass |
| A21 | Rollback invoice `sent` yang nomornya tidak mengandung pola `/INV/` | POST `/invoices/4/rollback` (nomor `NOMOR-ASAL-SAJA-999`) | — | BE | GAGAL pada percobaan pertama: invoice bernomor di luar pola `/INV/` tidak pernah bisa di-rollback. **Setelah diperbaiki**: `isInvoiceLatestInMonth()` jatuh ke penilaian urutan penerbitan bila pola tidak dikenali, sehingga invoice terakhir pada bulannya tetap dapat di-rollback | Pass (percobaan ke-2) |
| A22 | Pembayaran pada invoice `draft` | POST `/invoices/2/payments` `amount=100.000` | 422 dengan pesan | BE | 422 `"Invoice tidak dapat menerima pembayaran."` | Pass |
| A23 | Pembayaran pada invoice `paid` | POST `/invoices/1/payments` `amount=1` saat invoice `paid` | 422 | BE | 422 `"Invoice tidak dapat menerima pembayaran."` | Pass |
| A24 | Pembayaran `amount = 0` | POST `amount=0` | 422 | BE | 422 `{"amount":["The amount field must be at least 1."]}` | Pass |
| A25 | Pembayaran `amount = 1` (batas bawah) | POST `amount=1` pada invoice `sent` | 200 diterima | BE | 200; invoice `id=3` jadi `partially_paid` | Pass |
| A26 | `bank_account_id` dihilangkan sama sekali | POST tanpa `bank_account_id` | 422, pesan Indonesia kustom | BE | 422 `{"bank_account_id":["Rekening tujuan wajib dipilih."]}` | Pass |
| A27 | `bank_account_id` tidak ada di DB | POST `bank_account_id=999` | 422 | BE | 422 `{"bank_account_id":["Rekening yang dipilih tidak valid."]}` | Pass |
| A28 | `payment_method` di luar enum | POST `payment_method=transfer` | 422 | BE | 422 `{"payment_method":["The selected payment method is invalid."]}` | Pass |
| A29 | Pembayaran **melebihi** sisa tagihan | Invoice `id=3` total `15.300.000`, sudah dibayar `1`; POST `amount=99.000.000` | Seharusnya ditolak atau dibatasi sisa tagihan | BE | GAGAL pada percobaan pertama: pembayaran Rp 99.000.000 atas sisa Rp 15.299.999 diterima, `remaining` menjadi −83.700.001. **Setelah TEMUAN I-03 diperbaiki**: `StorePaymentRequest` menghitung `max:` dinamis dari sisa tagihan (menambahkan kembali nominal pembayaran yang sedang diedit), permintaan ditolak 422 | Pass (percobaan ke-2) |
| A30 | Invoice `draft` yang **masih bernomor** (hasil N13) tidak bisa dibayar | POST `/invoices/1/payments` `amount=500.000` saat inv 1 = `draft` + nomor `001/INV/QS-RP/VIII/2026` | — | BE | GAGAL pada percobaan pertama: invoice bernomor jatuh ke `draft` setelah pembayarannya dihapus, lalu menolak pembayaran baru **dan** rollback. **Setelah TEMUAN I-04 diperbaiki**: `updateStatus()` mengembalikannya ke `sent` karena nomornya ada, sehingga penagihan berlanjut normal | Pass (percobaan ke-2) |
| A31 | Update invoice `paid` yang menaikkan total — status tidak dihitung ulang | Invoice `id=11` `paid` (total `5.100.000`, dibayar `5.100.000`). PUT dengan item `40.000.000` | Status harus turun ke `partially_paid` | BE | GAGAL pada percobaan pertama: invoice `paid` yang totalnya dinaikkan tetap `paid`, sisa Rp 34.900.000 tak bisa ditagih. **Setelah TEMUAN I-02 diperbaiki**: `update()` memanggil `updateStatus()` untuk invoice yang sudah pernah dibayar | Pass (percobaan ke-2) |
| A32 | Staff mengubah invoice lewat URL langsung (tanpa `edit invoices`) | PUT `/c/qa-satu/invoices/1` sebagai staff | 403 | BE | 403 `"This action is unauthorized."` | Pass |
| A33 | Staff menghapus invoice lewat URL langsung | DELETE `/c/qa-satu/invoices/1` sebagai staff | 403 | BE | 403 `"This action is unauthorized."` | Pass |
| A34 | Staff membuka halaman edit invoice | GET `/c/qa-satu/invoices/1/edit` sebagai staff | 403 | BE | 403 | Pass |
| A35 | Staff menghapus pembayaran (tanpa `edit invoices`) | DELETE `/c/qa-satu/payments/3` sebagai staff | 403 | BE | 403 `"This action is unauthorized."` | Pass |
| A36 | **Staff mengirim invoice** (memberi nomor resmi) lewat URL langsung | POST `/c/qa-satu/invoices/2/send` `invoice_number=003/INV/QS-RP/VIII/2026` sebagai staff | Seharusnya butuh permission lebih dari sekadar `view invoices` | BE | GAGAL pada percobaan pertama: staff ber-izin baca berhasil `POST /invoices/{id}/send`. **Setelah TEMUAN I-07 diperbaiki**: route memakai `can:edit invoices`, staff menerima **403**. Ditutup tes regresi | Pass (percobaan ke-2) |
| A37 | **Staff me-rollback invoice** (mencabut nomor resmi) | POST `/c/qa-satu/invoices/2/rollback` sebagai staff | Seharusnya ditolak | BE | GAGAL pada percobaan pertama: staff berhasil me-rollback dan mencabut nomor invoice. **Setelah diperbaiki**: **403**, nomor tetap utuh | Pass (percobaan ke-2) |
| A38 | ID invoice tidak ada | GET `/invoices/99999`; POST `/invoices/99999/send` | 404 | BE | 404 pada keduanya | Pass |
| A39 | Unduh PDF invoice dengan template **default** (`kisantra-invoice`) | GET `/c/qa-satu/invoice/11/download` | 200 + `application/pdf` | BE | GAGAL pada percobaan pertama: **500** karena `company_profiles.bank_accounts` NULL. **Setelah TEMUAN I-08 diperbaiki**: **200** — diverifikasi ulang pada tenant `qa-satu` yang kolomnya memang masih NULL | Pass (percobaan ke-2) | **Fail** (TEMUAN I-08) |
| A40 | Preview PDF invoice (inline) | GET `/c/qa-satu/invoice/11/preview` | 200 + `application/pdf` inline | BE | GAGAL pada percobaan pertama: template `invoice` juga **500**. **Setelah diperbaiki**: **200** | Pass (percobaan ke-2) |
| A41 | Semua template Blade bawaan | GET `…/download?template=` untuk `kisantra-invoice`, `semesta-invoice`, `agsa-invoice`, `invoice` | Semua 200 | BE | GAGAL pada percobaan pertama. **Setelah diperbaiki**: **200**. Penjagaan dipasang dua lapis — `InvoicePrintService` mengirim `[]` alih-alih NULL, dan ketiga template Blade membungkus `@foreach` dengan `?? []` | Pass (percobaan ke-2) |
| A42 | Nama template PDF yang tidak dikenal (dari query string) | GET `…/download?template=tidak-ada` | 404 atau pesan ramah | BE | GAGAL pada percobaan pertama: `?template=tidak-ada` → **500** `View [pdf.tidak-ada] not found`. **Setelah TEMUAN I-09 diperbaiki**: **404** lewat allowlist `InvoicePrintService::TEMPLATE_SAH` | Pass (percobaan ke-2) |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Siklus penuh: buat → kirim → bayar sebagian → lunas, saldo bank mengikuti | Invoice 1 (`3.800.000`): send `001/INV/QS-RP/VIII/2026` → bayar `1.000.000` → bayar `2.800.000` | `draft` → `sent` → `partially_paid` → `paid`; saldo `10.000.000` → `11.000.000` → `13.800.000` | BE | Persis seperti diharapkan pada tiap langkah (lihat N06, N11, N12). Saldo memang accessor terhitung — tidak ada kolom saldo yang ditulis | Pass |
| C02 | Preview nomor pada halaman create memakai bulan **sekarang**, bukan `issue_date` yang dipilih | GET `/c/qa-satu/invoices/create` (hari uji 2026-08-19, Agustus sudah punya `003`) → prop `nextSeq`; bandingkan dengan sequence September yang benar (`001`) | `nextSeq` seharusnya mengikuti bulan `issue_date` yang dipilih pengguna | FE+BE | GAGAL pada percobaan pertama: memilih tanggal September pada hari kerja Agustus menampilkan urutan Agustus (`004`) dengan label September. **Setelah diperbaiki**: endpoint `/api/invoices/next-sequence?date=` menghitung urutan per bulan tanggal invoice; layar menampilkan `002/INV/QS-XXX/IX/2026` untuk 5 Sep 2026 (Agustus 4, September 2, Oktober 1) | Pass (percobaan ke-2) |
| C03 | Pemulihan invoice yang jatuh ke `draft` karena semua pembayarannya dihapus | Invoice 1 `draft` + nomor `001/…`; POST send dengan nomor yang **sama** | Diterima (aturan `unique` mengecualikan dirinya sendiri) | BE | 302; DB `id=1` kembali `status=sent` dengan nomor sama. Pemulihan mungkin, tetapi menuntut pengguna mengetik ulang nomor persis sama — tidak ada bantuan dari sistem | Pass (pemulihan manual) |
| C04 | Snapshot layanan: ubah harga & hapus layanan tidak menyentuh invoice historis | PUT harga `Bangun Website` `12.000.000` → `99.000.000`; DELETE layanan `Jasa Izin Usaha` yang dipakai 2 item | Item & header invoice tidak berubah | BE | Item `id=1`, `id=6`, `id=13` tidak berubah sama sekali; header invoice 1/3/4 tidak berubah. Detail di `services.md` C01/C02 | Pass |
| C05 | Hapus klien meruntuhkan invoice, item, dan pembayarannya | DELETE `/c/qa-satu/clients/6` | Invoice ditagih ke klien itu terhapus | BE | GAGAL pada percobaan pertama. **Setelah TEMUAN C-02 (clients.md) diperbaiki**: penghapusan klien ditolak selama masih ada invoice/item, dan FK diubah menjadi `restrictOnDelete` | Pass (percobaan ke-2) |
| C06 | Hapus invoice yang punya pembayaran → pembayaran ikut hilang, saldo bank turun | Saldo `16.200.000`; DELETE `/c/qa-satu/invoices/13` (punya pembayaran `1.000.000`) sebagai manager | Minimal ada penolakan atau peringatan | BE | GAGAL pada percobaan pertama: pembayaran ikut hilang dan saldo bank turun Rp 1.000.000 tanpa konfirmasi. **Setelah diperbaiki**: `InvoiceController::destroy()` menolak penghapusan invoice yang punya pembayaran, menyebut jumlah dan nilai rupiahnya | Pass (percobaan ke-2) |
| C07 | Pemisahan wewenang lintas aktor pada satu invoice | Staff buat → admin kirim → manager bayar → manager hapus invoice | Tiap aktor hanya boleh melakukan aksi yang izinnya dimiliki | BE | Semua langkah berhasil sesuai permission (N21, C06). Namun A36/A37 menunjukkan staff **juga** bisa mengirim & me-rollback — pemisahan wewenang bocor pada dua aksi tersebut | Pass (dengan kebocoran di A36/A37) |

## Temuan

### TEMUAN I-01 — Nomor invoice sepenuhnya ditentukan klien: format & urutan tidak ditegakkan di mana pun

- **SIFAT**: Aturan bisnis inti tidak ditegakkan; integritas dokumen penagihan.
  Keparahan: **tinggi**.
- **MENGGAGALKAN**: A18, A21; melemahkan N06, N07; menjelaskan C02.
- **GEJALA**: `POST /c/qa-satu/invoices/4/send` dengan
  `invoice_number=NOMOR-ASAL-SAJA-999` mengembalikan 302 dan menyimpan nomor itu apa
  adanya dengan `status=sent`. Akibat lanjutan (A21): invoice tersebut tidak bisa
  di-rollback selamanya — `Flash: "Hanya invoice terbaru di bulan ini yang bisa
  di-rollback."` — karena `isInvoiceLatestInMonth()` mensyaratkan pola `/INV/`.
- **SEBAB**: Tiga hal berlapis.
  1. `app/Http/Requests/SendInvoiceRequest.php` hanya memvalidasi
     `['required','string','max:100', "unique:invoices,invoice_number,{$invoice->id}"]`
     — tidak ada `regex` format, tidak ada pemeriksaan sequence.
  2. `app/Http/Controllers/InvoiceController.php::send()` menyimpan
     `$request->invoice_number` langsung; **tidak pernah memanggil**
     `Invoice::generateInvoiceNumber()`. Penelusuran pemanggil menunjukkan metode itu
     hanya dipakai `tests/Feature/InvoiceNumberAssignmentTest.php` (baris 45, 66) dan
     versi terpisah milik `app/Models/RecurringInvoice.php:107` — **tidak ada satu pun
     controller yang memakainya**.
  3. Di sisi FE, dialog "Kirim Invoice" pada `resources/js/pages/invoices/index.tsx:293`
     & `:306` mengisi field dengan `data.invoice_number ?? ''` — untuk draft nilainya
     selalu NULL, jadi kolom **kosong** dan pengguna mengetik nomor secara bebas.
     Props `nextSeq`/`companyInitials` hanya dikirim ke halaman *create*
     (`InvoiceController.php:388-391`), bukan ke dialog kirim.
- **CAKUPAN**: Seluruh penomoran invoice manual. Aspek terkait (C02):
  `$nextSeq = Invoice::getMaxSequenceFromDb(now()) + 1` memakai **bulan berjalan**,
  sedangkan `create.tsx:83` menyusun preview dengan bulan romawi dari `issue_date`
  yang dipilih pengguna — untuk invoice bertanggal September pada hari uji Agustus
  preview berbunyi `004/INV/QS-RP/IX/2026` padahal sequence September yang benar
  adalah `001`. Terpisah tetapi searah: `Invoice::getCompanyInitials()` memakai
  `extractInitials(CompanyProfile->name)` → `"QA Satu"` menjadi `QS`, **bukan** kolom
  `abbreviation` (`SAT`) yang tersimpan di profil — dokumentasi modul menyebut
  "inisial perusahaan/abbrev", implementasinya inisial nama.
- **KEPUTUSAN PRODUK**: penomoran manual **dipertahankan** untuk sekarang; pengaturan
  pola nomor per perusahaan direncanakan menyusul. Karena itu A18 sengaja tetap `Fail`
  dan tidak ditutup dengan aturan `regex`.
- **DIPERBAIKI (akibat lanjutannya)**: dua konsekuensi yang membuat aplikasi macet
  sudah ditutup, karena keduanya tidak bergantung pada keputusan format nomor.
  1. `isInvoiceLatestInMonth()` tidak lagi menolak nomor di luar pola `/INV/`; bila
     pola tidak dikenali ia menilai dari urutan penerbitan, sehingga invoice tidak
     lagi terkunci selamanya tanpa bisa di-rollback (A21).
  2. Urutan preview dihitung dari **bulan tanggal invoice** lewat endpoint
     `/api/invoices/next-sequence?date=`, bukan dari bulan berjalan (C02).
- **MASIH TERBUKA**: `Invoice::getCompanyInitials()` memakai inisial nama perusahaan
  (`QA Satu` → `QS`) alih-alih kolom `abbreviation` (`SAT`) yang tersimpan di profil.
  Perlu keputusan mana yang benar sebelum diubah — mengubahnya akan membuat nomor
  invoice baru berbeda pola dari yang sudah terbit.

### TEMUAN I-02 — `update()` invoice tidak memanggil `updateStatus()`; invoice bisa terkunci `paid` padahal masih ada sisa

- **SIFAT**: Bug status/keuangan yang mengunci penagihan. Keparahan: **tinggi**.
- **MENGGAGALKAN**: A31.
- **GEJALA**: Invoice `id=11` berstatus `paid` (total `5.100.000`, dibayar
  `5.100.000`). Setelah PUT yang menaikkan total menjadi `40.000.000`, `show`
  mengembalikan `{"status":"paid","total":40000000,"paid":5100000,"remaining":34900000}`.
  Karena statusnya `paid`, `PaymentController::store()` menolak pembayaran lanjutan
  dengan `"Invoice tidak dapat menerima pembayaran."` — sisa Rp 34.900.000 tidak bisa
  ditagih lewat aplikasi.
- **SEBAB**: `app/Http/Controllers/InvoiceController.php::update()` menghitung ulang
  `subtotal`/`discount_amount`/`total_amount` lalu `$invoice->update([...])` dan
  membuat ulang item, tetapi **tidak** memanggil `$invoice->updateStatus()` — berbeda
  dengan `PaymentController::store/update/destroy` yang selalu memanggilnya.
  Konsekuensinya status menjadi basi terhadap `total_amount` yang baru.
- **CAKUPAN**: Setiap perubahan invoice yang mengubah `total_amount` ke atas maupun ke
  bawah. Arah sebaliknya juga salah: invoice `partially_paid` yang totalnya diturunkan
  di bawah `amount_paid` akan tetap `partially_paid` meski sebenarnya lunas
  (`RecurringInvoice::publish()` tidak terdampak karena membuat invoice baru).
- **DIPERBAIKI**: `update()` memanggil `updateStatus()` untuk invoice yang sudah pernah dibayar, dan `updateStatus()` diperbaiki bersamaan (lihat I-04) sehingga invoice `sent` tanpa pembayaran tidak lagi turun ke `draft`.

### TEMUAN I-03 — Pembayaran melebihi sisa tagihan diterima tanpa batas

- **SIFAT**: Tidak ada penjagaan nilai keuangan. Keparahan: sedang.
- **MENGGAGALKAN**: A29.
- **GEJALA**: Invoice `id=3` bersisa `15.299.999`; POST pembayaran `99.000.000`
  → 200. `show` mengembalikan `"remaining": -83700001`. Saldo bank ikut naik penuh
  `99.000.000`.
- **SEBAB**: `app/Http/Requests/StorePaymentRequest.php` hanya menetapkan
  `'amount' => ['required','integer','min:1']` — tidak ada batas atas terhadap
  `$invoice->amount_remaining`. `PaymentController::store()` hanya memeriksa status
  (`draft`/`paid`), bukan nominal. `Invoice::getAmountRemainingAttribute()` melakukan
  pengurangan biasa sehingga menghasilkan angka negatif.
- **CAKUPAN**: Juga berlaku pada `PaymentController::update()` (memakai
  `UpdatePaymentRequest extends StorePaymentRequest`). Angka negatif merambat ke
  `show`, kolom "sisa" di daftar invoice (`amount_remaining` di
  `InvoiceController::index()`), `total_outstanding`, dan kolom sisa pada rekap
  Excel/PDF (`buildRecapData()`), selain menggelembungkan saldo bank terhitung.
- **SARAN PERBAIKAN**: Tambahkan aturan `max:` dinamis pada `amount` yang membaca
  `$invoice->amount_remaining` (memperhitungkan pembayaran yang sedang diedit), atau
  penolakan eksplisit di controller dengan pesan Indonesia. Bila kelebihan bayar sah
  secara bisnis, catat sebagai saldo lebih/uang muka, jangan sebagai sisa negatif.

### TEMUAN I-04 — Menghapus semua pembayaran menjatuhkan invoice bernomor ke `draft` dan mengunci pembayaran berikutnya

- **SIFAT**: Status tidak konsisten yang menghambat operasi. Keparahan: sedang.
- **MENGGAGALKAN**: A30 (invarian yang menyebabkannya sendiri lolos di N13).
- **GEJALA**: Setelah dua pembayaran invoice 1 dihapus, DB menunjukkan
  `status=draft` **dengan** `invoice_number=001/INV/QS-RP/VIII/2026`. Pada kondisi itu
  POST pembayaran baru ditolak 422 `"Invoice tidak dapat menerima pembayaran."`, dan
  rollback juga ditolak karena statusnya bukan `sent`.
- **SEBAB**: `app/Models/Invoice.php::updateStatus()` hanya mengenal tiga keluaran —
  `draft` bila `amount_paid == 0`, `paid` bila `>= total_amount`, selain itu
  `partially_paid`. Status `sent` hanya diset manual oleh `send()`, sehingga tidak ada
  jalan kembali ke `sent`. `PaymentController::store()` lalu menolak status `draft`.
- **CAKUPAN**: Setiap penghapusan/penurunan pembayaran hingga nol pada invoice yang
  sudah dikirim — lewat `DELETE /payments/{payment}` maupun `POST /payments/{payment}`.
  Juga memengaruhi statistik: invoice yang jatuh ke `draft` langsung dikeluarkan dari
  omzet/HPP/laba di index dan rekap export, sehingga pendapatan yang sudah ditagih
  menghilang dari laporan.
- **DIPERBAIKI**: persis seperti itu — `updateStatus()` mengembalikan `sent` bila pembayaran nol tetapi `invoice_number` terisi, dan tetap `draft` bila nomornya belum ada. Nomor invoice adalah penanda dokumen pernah terbit, jadi ia yang menentukan dasar pijakannya. Ditutup dua tes regresi di `tests/Feature/InvoiceHardeningTest.php`.

### TEMUAN I-05 — Diskon boleh melebihi subtotal (persentase > 100% dan fixed > subtotal)

- **SIFAT**: Validasi bisnis kurang. Keparahan: rendah–sedang.
- **MENGGAGALKAN**: A12, A13.
- **GEJALA**: `discount_type=percentage, discount_value=150` atas subtotal
  `1.000.000` → tersimpan `discount_amount=1.500.000`, `total_amount=0`.
  `discount_type=fixed, discount_value=5.000.000` atas subtotal `1.000.000` →
  `discount_amount=5.000.000`, `total_amount=0`.
- **SEBAB**: `app/Http/Requests/StoreInvoiceRequest.php` menetapkan
  `'discount_value' => ['nullable','numeric','min:0']` — tidak ada `max`. Controller
  hanya melindungi total akhir dengan `max(0, $subtotal - $discountAmount)`
  (`InvoiceController::store()`), sehingga `discount_amount` yang mustahil tetap
  tersimpan di DB dan akan tercetak di PDF/rekap.
- **CAKUPAN**: `store()` dan `update()` (aturan diwarisi `UpdateInvoiceRequest`).
  Invoice bertotal `0` yang dikirim juga membuat `updateStatus()` menandai `paid`
  begitu ada pembayaran sekecil apa pun (`amount_paid >= 0`).
- **DIPERBAIKI**: `StoreInvoiceRequest::withValidator()` menolak persen di atas 100 dan nominal di atas subtotal (subtotal dihitung dari item pada request yang sama). Layar juga menjepit ketikan sebelum dikirim, sehingga preview tidak lagi sempat menampilkan TOTAL Rp 0 dengan diskon yang mustahil.

### TEMUAN I-06 — Diskon persentase pecahan dipotong diam-diam menjadi bilangan bulat

- **SIFAT**: Kehilangan presisi tanpa pemberitahuan. Keparahan: rendah–sedang.
- **MENGGAGALKAN**: A14.
- **GEJALA**: `discount_type=percentage, discount_value=12.5` atas subtotal
  `1.000.000` → DB menyimpan `discount_value=12`, `discount_amount=120.000`,
  `total_amount=880.000`. Diskon yang benar `125.000`; selisih Rp 5.000 hilang dan
  tidak ada pesan apa pun kepada pengguna.
- **SEBAB**: Validasi mengizinkan pecahan (`'discount_value' => ['nullable','numeric','min:0']`)
  tetapi `InvoiceController::store()`/`update()` melakukan
  `$discountValue = (int) ($validated['discount_value'] ?? 0);` sebelum menghitung,
  dan `app/Models/Invoice.php` men-cast `'discount_value' => 'integer'`. Pemotongan
  terjadi dua kali dan diam-diam.
- **CAKUPAN**: Store dan update invoice. Diskon `fixed` tidak terdampak karena rupiah
  memang integer; diskon persentase pecahan (12,5%, 7,5%, 2,5%) adalah kasus nyata
  dalam praktik penagihan.
- **DIPERBAIKI** dengan opsi (a): `discount_value` kini `integer`, disertai pesan yang menjelaskan bahwa diskon persen pecahan belum didukung dan menyarankan diskon nominal. Opsi (b) sengaja tidak diambil: kolomnya berkomentar "value * 100 (1500 = 15.00%)" sedangkan controller memperlakukannya sebagai persen biasa — mengubahnya ke desimal tanpa memastikan makna data lama justru berisiko salah tafsir. **Ketidakcocokan komentar skema vs implementasi itu sendiri layak dirapikan terpisah.**

### TEMUAN I-07 — Staff dapat mengirim dan me-rollback invoice hanya dengan izin `view invoices`

- **SIFAT**: Kebocoran pemisahan wewenang. Keparahan: sedang–tinggi.
- **MENGGAGALKAN**: A36, A37.
- **GEJALA**: Sebagai `staff@gmail.com` (izin invoice hanya `view invoices` +
  `create invoices`): `POST /c/qa-satu/invoices/2/send` dengan
  `003/INV/QS-RP/VIII/2026` → 302, DB `status=sent` dengan nomor tersebut; lalu
  `POST /c/qa-satu/invoices/2/rollback` → 302, nomor dicabut kembali menjadi NULL.
  Sebaliknya `PUT /invoices/1`, `DELETE /invoices/1`, `GET /invoices/1/edit`, dan
  `DELETE /payments/3` semuanya benar-benar 403 untuk staff.
- **SEBAB**: `routes/web.php:180-181` mendaftarkan `send` dan `rollback` di dalam grup
  `Route::prefix('invoices')->middleware('can:view invoices')` **tanpa** middleware
  per-aksi, berbeda dengan `store`/`update`/`destroy` yang masing-masing memakai
  `can:create|edit|delete invoices`. Controller juga tidak melakukan otorisasi
  tambahan — `InvoiceController::send()` hanya memeriksa status.
- **CAKUPAN**: Semua pengguna dengan izin `view invoices` — termasuk peran apa pun
  yang hanya diberi hak baca. Dampaknya bukan sekadar baca: nomor invoice resmi
  adalah dokumen berurutan, dan rollback mencabut nomor yang mungkin sudah dikirim
  ke klien.
- **DIPERBAIKI**: kedua route memakai `can:edit invoices`. Ditutup tes regresi yang memastikan pemegang `view invoices` saja menerima 403 pada `send` maupun `rollback`, dan nomor invoice tetap NULL sesudahnya.

### TEMUAN I-08 — Semua unduhan/preview PDF invoice gagal 500 pada perusahaan yang `bank_accounts`-nya belum diisi

- **SIFAT**: Fitur inti mati total pada tenant baru. Keparahan: **tinggi**.
- **MENGGAGALKAN**: A39, A40, A41.
- **GEJALA**: `GET /c/qa-satu/invoice/11/download` dan `/preview` mengembalikan
  HTTP 500 `text/html`, isi:
  `ErrorException — foreach() argument must be of type array|object, null given`,
  jejak teratas `resources\views\pdf\kisantra-invoice.blade.php:577`.
  Per template: `kisantra-invoice` (default) **500**, `invoice` **500**,
  `semesta-invoice` 200, `agsa-invoice` 200.
- **SEBAB**: `company_profiles.bank_accounts` bernilai NULL pada perusahaan
  `qa-satu` yang baru diprovisioning (`SELECT bank_accounts IS NULL` → `1`).
  `app/Services/InvoicePrintService.php:111` meneruskan `'bank_accounts' => $company->bank_accounts`
  apa adanya (cast `array`, NULL tetap NULL), lalu
  `resources/views/pdf/kisantra-invoice.blade.php:577` melakukan
  `@foreach ($company['bank_accounts'] as $index => $bank)` **tanpa penjaga**.
  `resources/views/pdf/invoice.blade.php:380` dan
  `resources/views/pdf/single-invoice.blade.php:438` memakai pola yang sama.
  `semesta-invoice.blade.php:493` selamat karena membungkusnya dengan
  `@if(isset($company['bank_accounts']) && count(...) > 0)`. Jalur fallback
  `getFallbackCompanyInfo()` (baris 123-140) memang menyediakan array, tetapi hanya
  dipakai bila **tidak ada** baris `CompanyProfile` sama sekali — bukan kasus di sini.
- **CAKUPAN**: Setiap perusahaan yang belum mengisi rekening di Pengaturan Perusahaan
  — yaitu kondisi bawaan tiap tenant yang baru dibuat. Template terdampak:
  `kisantra-invoice` (default sistem), `invoice`, dan `single-invoice`. Rekap
  Excel/PDF (`/invoices/export/*`) **tidak** terdampak (keduanya 200) karena memakai
  view `pdf.invoice-recap`.
- **SARAN PERBAIKAN**: Beri nilai bawaan array kosong di service
  (`'bank_accounts' => $company->bank_accounts ?? []`) **dan** tambahkan penjaga
  `@if(!empty($company['bank_accounts']))` di ketiga template. Sebagai pelengkap:
  isi `bank_accounts` dengan `[]` saat provisioning perusahaan agar kolom tidak
  pernah NULL.
- **DIPERBAIKI** dua lapis: `InvoicePrintService` mengirim `$company->bank_accounts ?? []`
  sehingga sumbernya tidak lagi NULL, dan `kisantra-invoice`, `invoice`, serta
  `single-invoice` membungkus `@foreach` dengan `?? []`. Diverifikasi pada tenant
  `qa-satu` yang kolomnya memang masih NULL: unduhan default, `invoice`, dan
  `semesta-invoice` semuanya 200. Ditutup tes regresi yang membuat profil perusahaan
  tanpa rekening lalu mengunduh PDF-nya.

### TEMUAN I-09 — Nama template PDF dari query string dipakai langsung sebagai nama view (500, bukan 404)

- **SIFAT**: Penanganan input tidak tepat. Keparahan: rendah.
- **MENGGAGALKAN**: A42.
- **GEJALA**: `GET /c/qa-satu/invoice/11/download?template=tidak-ada` → HTTP 500
  `InvalidArgumentException: View [pdf.tidak-ada] not found.`
- **SEBAB**: Closure route (`routes/web.php`, blok `invoice.download`) mengambil
  `$request->query('template', 'kisantra-invoice')` dan meneruskannya ke
  `InvoicePrintService::generateSingleInvoicePdf(...)` yang merender
  `view("pdf.{$template}")` tanpa memvalidasi terhadap daftar template yang sah.
- **CAKUPAN**: Route `invoice.download` dan `invoice.preview`. Nilai
  `builder:{id}` sudah aman karena memakai `PdfTemplate::findOrFail()` (404). Tidak
  ditemukan indikasi path traversal ke luar folder `pdf.` dalam pengujian ini
  (**tidak diuji khusus**), tetapi 500 dari input pengguna tetap tidak semestinya.
- **DIPERBAIKI**: allowlist `InvoicePrintService::TEMPLATE_SAH` dipasang pada route `invoice.download` dan `invoice.preview`; template di luar daftar menghasilkan 404. Diverifikasi pada tenant nyata: default 200, `invoice` 200, `semesta-invoice` 200, `tidak-ada` 404.

## Catatan pelaksanaan

- **Semua case dieksekusi lewat HTTP** ke `http://127.0.0.1:8000` dengan cookie sesi
  hasil login sungguhan (`POST /login`) untuk `admin@gmail.com`, `manager@gmail.com`,
  dan `staff@gmail.com`. Endpoint pembayaran dan `show` memang merespons JSON,
  sehingga dipanggil dengan `Accept: application/json`; endpoint invoice bernested
  `items[]` dikirim sebagai `Content-Type: application/json`. **Tidak ada pengujian
  lewat browser/UI** — dokumen ini tidak membuat klaim apa pun tentang Sheet detail,
  dialog kirim, `PrintInvoiceDialog`, atau perilaku layar React.
- **Verifikasi hasil ke database** `tenant_qa-satu` lewat PDO (hanya SELECT) di setiap
  langkah: kolom `invoice_number`/`status`/`subtotal`/`discount_*`/`total_amount`,
  baris `invoice_items` (termasuk perubahan ID untuk membuktikan hapus-buat-ulang),
  baris `payments`, jumlah baris sebelum/sesudah, definisi FK dari
  `information_schema.REFERENTIAL_CONSTRAINTS`, dan query konsistensi
  `subtotal` vs `SUM(invoice_items.amount)`.
- **Saldo bank** dibaca dari prop `accounts[].balance` pada `/c/qa-satu/bank-accounts`
  (accessor terhitung), bukan dari kolom — memang tidak ada kolom saldo.
- **Prop Inertia** (`stats`, `rollbackableIds`, `flash`, `nextSeq`, `companyInitials`,
  `clients`, `services`) dibaca dari tag `<script type="application/json">` pada
  respons HTML, karena aksi `send`/`rollback` menyampaikan hasilnya lewat flash
  session, bukan body respons.
- **Diverifikasi lewat baca kode, bukan eksekusi** (disebut eksplisit di baris terkait):
  isi baris file Excel/PDF rekap (N19 hanya memeriksa status, MIME, ukuran, dan magic
  bytes); pembentukan inisial oleh `Invoice::extractInitials()`; klaim bahwa
  `generateInvoiceNumber()` tidak pernah dipanggil controller (ditelusuri dengan
  pencarian pemanggil di `app/`, `routes/`, `resources/`, `tests/`).
- **Tidak bisa diuji dalam sesi ini**: template builder (`template=builder:{id}`) —
  belum ada baris `PdfTemplate` di tenant `qa-satu`; unggah lampiran pembayaran
  (`attachment`) beserta siklus hapus filenya — perlu unggahan multipart dan
  pemeriksaan disk per-tenant; status `overdue` dan `cancelled` — tidak ada endpoint
  yang menghasilkannya (memang tidak ada transisi otomatis di kode); dampak FK
  `payments.bank_account_id ON DELETE CASCADE`; kemungkinan path traversal lewat
  parameter `template` (I-09).
- **Kegagalan tooling (bukan cacat aplikasi)**: file body respons bawaan helper
  (`/tmp/qa_body.txt`) ternyata dipakai bersama agent QA lain sehingga sempat berisi
  respons perusahaan `qa-tiga`; sejak temuan itu seluruh pemanggilan dialihkan ke
  `/tmp/qa1_body.txt` khusus sesi ini dan hasil sebelum pengalihan tidak dipakai.
  Percobaan menjalankan `php artisan tinker` untuk memanggil
  `Invoice::generateInvoiceNumber()` secara langsung gagal (`Unknown column 'slug'`
  pada tabel `companies`) dan **tidak diulang** — karena itu pembentukan nomor oleh
  model dilaporkan sebagai hasil baca kode, bukan eksekusi.
