# Test Case — Services (Layanan)

Sumber teknis: [`docs/module/services.md`](../../module/services.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-satu` (DB `tenant_qa-satu`), eksekusi lewat HTTP
dengan cookie sesi asli + verifikasi database. Bukan production.

Peta permission layanan yang berlaku (dibaca dari `finance_central.role_has_permissions`):

| Role | view | create | edit | delete |
|---|---|---|---|---|
| admin | ya | ya | ya | ya |
| finance manager | ya | ya | ya | **tidak** |
| staff | ya | **tidak** | **tidak** | **tidak** |

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat layanan untuk **tiap** tipe resmi (4 varian) | POST `/c/qa-satu/services` 4×: `Jasa Izin Usaha`/`Perizinan`/`1500000`; `Lapor SPT Tahunan`/`Administrasi Perpajakan`/`750000`; `Kelola Sosmed`/`Digital Marketing`/`2500000`; `Bangun Website`/`Sistem Digital`/`12000000` | 302 tiap kali; 4 baris tersimpan dengan `price` integer utuh | BE | 4× 302. DB `id=1..4` dengan `price` `1500000 / 750000 / 2500000 / 12000000` — tidak ada pembulatan/desimal | Pass |
| N02 | `price = 0` (batas bawah yang sah) | POST `name=Layanan Gratis`, `type=Perizinan`, `price=0` | 302 diterima | BE | 302, DB `id=5 price=0` | Pass |
| N03 | Finance manager mengubah harga (punya `edit services`) | PUT `/c/qa-satu/services/2` `price=800000` sebagai manager | 302, harga berubah | BE | 302. DB `id=2 name=Lapor SPT Tahunan price=800000` | Pass |
| N04 | Stat agregat index (`total`, `avg_price`, `highest_price`, `by_type`) cocok DB | GET `/c/qa-satu/services`, baca prop `stats`; bandingkan `SELECT COUNT(*), CAST(AVG(price) AS SIGNED), MAX(price)` | Angka identik, `avg_price` integer | BE | Prop `{"total":6,"avg_price":3050000,"highest_price":12000000,"by_type":{"Perizinan":3,"Administrasi Perpajakan":1,"Digital Marketing":1,"Sistem Digital":1}}`; SQL `total=6 avg_price=3050000 highest=12000000` — identik | Pass |
| N05 | Filter berdasarkan `type` | GET `?type=Perizinan` | Hanya layanan Perizinan | BE | `services.total = 2` (saat itu 2 layanan Perizinan aktif) — sesuai DB | Pass |
| N06 | Pencarian nama | GET `?search=Web` | Hanya `Bangun Website` | BE | 1 baris: `4:Bangun Website` | Pass |
| N07 | Pengurutan harga menurun | GET `?sort=price&direction=desc` | Harga urut besar→kecil | BE | `99000000 2500000 1500000 800000 0` — urut benar | Pass |
| N08 | Staff bisa membuka daftar layanan (punya `view services`) | GET `/c/qa-satu/services` sebagai staff | 200 | BE | 200 | Pass |
| N09 | Hapus layanan (admin) | DELETE `/c/qa-satu/services/1` (`Jasa Izin Usaha`, sedang dipakai 2 invoice item) | 302, baris hilang | BE | 302. DB: `id=1` hilang, tersisa `id=2,3,4,5`. Efeknya ke invoice diuji di C02 | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Field wajib `name` dihilangkan sama sekali | POST hanya `type=Perizinan&price=1000` | 422 | BE | 422 `{"name":["The name field is required."]}` | Pass |
| A02 | `type` di luar daftar resmi | POST `type=Konsultasi` | 422 | BE | 422 `{"type":["The selected type is invalid."]}` | Pass |
| A03 | Field wajib `price` dihilangkan sama sekali | POST `name=Tanpa Harga&type=Perizinan` | 422 | BE | 422 `{"price":["The price field is required."]}` | Pass |
| A04 | `price = -1` (satu langkah di bawah batas) | POST `price=-1` | 422 | BE | 422 `{"price":["The price field must be at least 0."]}` | Pass |
| A05 | `price` desimal — invarian "integer rupiah penuh" | POST `price=150000.5` | 422 | BE | 422 `{"price":["The price field must be an integer."]}` | Pass |
| A06 | `price` string terformat rupiah — apakah backend mem-parse sendiri? | POST `price=Rp 1.500.000` | 422 (tidak ada auto-parse) | BE | 422 `{"price":["The price field must be an integer."]}`. Helper `Service::parseAmount()` **tidak** dipanggil di jalur request; pembersihan format sepenuhnya tanggung jawab `CurrencyInput` di FE | Pass |
| A07 | `name` 256 karakter | POST `name` = 256× `S` | 422 | BE | 422 `{"name":["The name field must not be greater than 255 characters."]}` | Pass |
| A08 | Staff membuat layanan lewat URL langsung (tanpa `create services`) | POST `/c/qa-satu/services` sebagai staff | 403 | BE | 403 `"This action is unauthorized."` | Pass |
| A09 | Staff mengubah layanan lewat URL langsung (tanpa `edit services`) | PUT `/c/qa-satu/services/1` sebagai staff | 403, harga tidak berubah | BE | 403 `"This action is unauthorized."` | Pass |
| A10 | Finance manager menghapus layanan lewat URL langsung (tanpa `delete services`) | DELETE `/c/qa-satu/services/5` sebagai manager | 403, baris tetap ada | BE | 403 `"This action is unauthorized."`; `id=5` masih ada di DB | Pass |
| A11 | Nama layanan duplikat | POST `name=Jasa Izin Usaha` (sudah ada) | Diterima — memang tidak ada aturan `unique` | BE | 302 diterima; DB `SELECT COUNT(*) WHERE name='Jasa Izin Usaha'` → `2`. Konsekuensi: dua layanan bernama identik dengan harga berbeda tidak terbedakan di Combobox invoice selain lewat harga | Pass (dengan catatan) |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | **Invarian snapshot**: mengubah harga layanan tidak mengubah invoice historis | Sebelum: item `id=13` (invoice 3) `service_name=Bangun Website (revisi)` `unit_price=9.000.000`. PUT `/c/qa-satu/services/4` ubah harga `12.000.000` → `99.000.000`. Baca ulang `invoice_items` dan header invoice | Item & header invoice sama persis seperti sebelumnya | BE | 302. Item `id=13` tetap `unit_price=9000000 amount=9000000`; header invoice 1/3/4 tetap `3800000 / 8500000-9000000 / 750000-1000000`. Harga master berubah menjadi `99000000`, item tidak tersentuh | Pass |
| C02 | **Invarian snapshot**: menghapus layanan tidak merusak invoice historis | Sebelum: item `id=1` (invoice 1) & `id=6` (invoice 4) memakai `service_name='Jasa Izin Usaha'`. DELETE `/c/qa-satu/services/1`. Baca ulang item + header | Item tetap ada dengan nama & harga tersimpan; tidak ada FK yang putus | BE | 302. Item `id=1 unit_price=1500000 amount=3000000` dan `id=6 unit_price=1000000 amount=1000000` **tidak berubah**; header invoice 1/3/4 tidak berubah. Terbukti `invoice_items` menyimpan `service_name` string, bukan `service_id` | Pass |
| C03 | Layanan yang dihapus hilang dari opsi form invoice; layanan baru muncul | GET `/c/qa-satu/invoices/create`, baca prop `services` | Daftar mencerminkan master terkini | BE | Prop: `4:Bangun Website=99000000 / 6:Jasa Izin Usaha=1500000 / 3:Kelola Sosmed=2500000 / 2:Lapor SPT Tahunan=800000 / 5:Layanan Gratis=0`. Layanan `id=1` yang dihapus sudah tidak ada; harga baru `99000000` sudah terbawa ke opsi | Pass |
| C04 | Harga dari master hanya nilai awal — item invoice bisa memakai harga berbeda | POST invoice dengan `service_name=Kelola Sosmed` tetapi `unit_price=2500001` (master `2500000`), `quantity=2.5` | Item tersimpan dengan harga yang dikirim, bukan harga master | BE | Item `id=3`: `unit_price=2500001`, `amount=6250003` (= `round(2500001 × 2,5)`). Salinan dari master memang bebas diedit | Pass |
| C05 | Konsistensi daftar `type` antara controller dan aturan validasi | Bandingkan prop `types` di `/c/qa-satu/services` dengan aturan `in:` di `StoreServiceRequest` (uji A02) | Sama persis, 4 nilai | BE | Prop `types` = `["Perizinan","Administrasi Perpajakan","Digital Marketing","Sistem Digital"]`; A02 membuktikan validasi menolak nilai ke-5. Keduanya sinkron **saat ini**, tetapi tetap dua sumber kebenaran terpisah (`ServiceController::TYPES` vs aturan `in:` yang ditulis ulang di `StoreServiceRequest`) — lihat TEMUAN S-01 | Pass (dengan catatan) |

## Temuan

### TEMUAN S-01 — Daftar tipe layanan diduplikasi di dua tempat tanpa pengikat

- **SIFAT**: Risiko pemeliharaan, bukan cacat yang terlihat sekarang. Keparahan: rendah.
- **MENGGAGALKAN**: tidak ada case yang gagal (C05 lolos).
- **GEJALA**: Tidak ada. Kedua daftar kebetulan identik pada commit ini.
- **SEBAB**: Nilai yang sah ditulis dua kali secara terpisah —
  `app/Http/Controllers/ServiceController.php:16-21` (`public const TYPES`) untuk prop
  Combobox, dan string literal `in:Perizinan,Administrasi Perpajakan,Digital Marketing,Sistem Digital`
  di `app/Http/Requests/StoreServiceRequest.php` (diwarisi apa adanya oleh
  `UpdateServiceRequest` yang berbadan kosong). Menambah satu tipe di satu sisi saja
  menghasilkan opsi yang muncul di UI tetapi ditolak 422 saat disimpan (atau
  sebaliknya, nilai yang lolos validasi tetapi tak pernah bisa dipilih).
- **CAKUPAN**: Modul Services; `RecurringInvoiceController` juga mengirim daftar
  layanan tetapi memakai baris `services` dari DB, bukan konstanta tipe, sehingga
  tidak menambah duplikasi.
- **SARAN PERBAIKAN**: Jadikan `ServiceController::TYPES` (atau sebuah enum PHP 8.1)
  satu-satunya sumber, lalu susun aturan validasi dengan
  `Rule::in(ServiceController::TYPES)`.

### TEMUAN S-02 — Tidak ada aturan unik pada nama layanan

- **SIFAT**: Kualitas data master. Keparahan: rendah.
- **MENGGAGALKAN**: tidak ada (A11 lolos sebagai perilaku apa adanya).
- **GEJALA**: POST `name=Jasa Izin Usaha` yang sudah ada diterima (302); DB berisi
  2 baris dengan nama identik.
- **SEBAB**: `StoreServiceRequest` hanya menetapkan `['required','string','max:255']`
  untuk `name`; tidak ada aturan `unique:services,name` maupun indeks unik di
  `database/migrations/tenant/…_create_services_table.php`.
- **CAKUPAN**: Combobox pemilihan layanan di halaman Create/Edit Invoice dan Recurring
  Invoice menampilkan label yang sama dua kali; pengguna hanya bisa membedakan lewat
  harga yang ikut tersalin.
- **SARAN PERBAIKAN**: Bila duplikasi memang tidak dikehendaki produk, tambahkan
  `unique:services,name` (dan `unique:services,name,{id}` pada Update). Bila
  duplikasi sah (mis. paket berbeda dengan nama sama), tampilkan `type` pada label
  Combobox agar terbedakan.

## Catatan pelaksanaan

- Semua case dieksekusi **lewat HTTP** ke `http://127.0.0.1:8000` dengan cookie sesi
  hasil login sungguhan untuk `admin@gmail.com`, `manager@gmail.com`, dan
  `staff@gmail.com`, memakai header `X-XSRF-TOKEN` + `Accept: application/json`.
  **Tidak ada pengujian lewat browser/UI** — tidak ada klaim mengenai tampilan
  `CurrencyInput`, dialog, atau perilaku layar.
- Hasil diverifikasi ke `tenant_qa-satu` lewat PDO (hanya SELECT): nilai `price`,
  jumlah baris, dan agregat `COUNT/AVG/MAX` sebagai pembanding prop `stats`.
- Prop Inertia (`services`, `stats`, `types`) dibaca dari tag
  `<script type="application/json">` pada respons HTML index/create.
- **Yang tidak diuji**: perilaku komponen `CurrencyInput` (parse `Rp 1.500.000` →
  integer) — itu murni FE dan butuh browser; A06 hanya membuktikan backend **tidak**
  mem-parse string terformat. Juga tidak diuji: pemakaian layanan oleh modul
  Recurring Invoice (di luar cakupan tugas ini).
- **Kegagalan tooling (bukan cacat aplikasi)**: file body respons bawaan helper
  (`/tmp/qa_body.txt`) dipakai bersama agent QA lain sehingga isinya sempat tertukar;
  seluruh pemanggilan sejak itu memakai `/tmp/qa1_body.txt` khusus sesi ini.
