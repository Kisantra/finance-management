# Modul: Services (Layanan)

> Master data layanan/jasa yang dijual perusahaan — nama, kategori (`type`), dan harga default (integer rupiah penuh). Dipakai sebagai sumber pilihan saat menyusun item invoice dan template recurring: nama & harga **disalin** (snapshot) ke item, bukan direferensikan via FK. Route prefix: `/services`; permission: `view services` (grup), `create services`, `edit services`, `delete services` (`routes/web.php` baris ±131–135). CRUD sepenuhnya di satu halaman index (modal).

## Tabel Database

### `services`
| Kolom | Tipe/Catatan |
|---|---|
| `name` | string, wajib |
| `type` | kolom `enum` di DB + divalidasi `in:`: `Perizinan`, `Administrasi Perpajakan`, `Digital Marketing`, `Sistem Digital` — daftar untuk UI ada di konstanta `ServiceController::TYPES` |
| `price` | `bigint`, **integer rupiah penuh** (cast `integer`), min 0 — harga default, dapat di-override per item invoice |

## Fitur

### Daftar Layanan (Index)
**Alur step-by-step:**
1. GET `/services` (`can:view services`), query: `search` (name), `type`, `per_page` (default 10), `sort` (default `created_at`), `direction` (default `desc`).
2. `ServiceController::index()` mem-paginate hasil dan menghitung stats agregat satu query (`COUNT`, `AVG(price)`, `MAX(price)`) plus breakdown jumlah per `type`.
3. Respons `Inertia::render('services/index', ...)` dengan props `services`, `stats`, `types` (untuk Combobox filter/form), `filters`.

**Penjelasan kode** (`app/Http/Controllers/ServiceController.php`):
```php
$aggregate = Service::selectRaw('COUNT(*) as total, AVG(price) as avg_price, MAX(price) as highest_price')
    ->toBase()->first();
```
Stat card (total layanan, harga rata-rata, harga tertinggi) dihitung agregat di DB atas **seluruh** katalog (tidak ikut filter); `avg_price` di-cast `(int)` agar tetap konsisten integer rupiah.

**Tombol aksi tidak disaring per izin:** **Tambah Layanan**, pensil, dan tempat sampah tampil untuk semua peran. Penolakan terjadi di server (middleware `can:`) → 403, yang di produksi dirender sebagai halaman error Inertia **Akses ditolak** (`ErrorReportService::respond`).

### Tambah Layanan (Store)
**Alur:** Dialog form → POST `/services` (`can:create services`), validasi `StoreServiceRequest`:
```php
'name' => ['required', 'string', 'max:255'],
'type' => ['required', 'in:Perizinan,Administrasi Perpajakan,Digital Marketing,Sistem Digital'],
'price' => ['required', 'integer', 'min:0'],
```
`Service::create($request->validated())` → redirect back flash `success`. Input harga di UI memakai `CurrencyInput` (mengirim raw integer).

### Ubah Layanan (Update)
**Alur:** PUT `/services/{service}` (`can:edit services`), validasi `UpdateServiceRequest` (aturan sama), `$service->update()`, redirect back. Perubahan harga **tidak** mempengaruhi invoice/template yang sudah ada (harga di-snapshot ke item saat penyusunan).

### Hapus Layanan (Destroy)
**Alur:** DELETE `/services/{service}` (`can:delete services`) → `$service->delete()`, redirect back. Aman terhadap data historis: `invoice_items` menyimpan `service_name` string, bukan `service_id`, sehingga tidak ada FK yang putus.

## Keterkaitan Antar Modul
- **Invoices:** `InvoiceController::create/edit` (`formOptions()`) mengirim daftar services (id, name, price, type) sebagai opsi item. Di editor (`pages/invoices/create.tsx`) tombol kaca pembesar **Dari katalog** (`CatalogPicker`) menyalin `service_name` & `unit_price` ke baris (menimpa harga baris); mengetik nama yang persis sama dengan katalog (datalist) hanya mengisi harga bila harga baris masih 0. Kategori (`type`) tidak ikut disalin.
- **Recurring Invoices:** `RecurringInvoiceController` mengirim daftar yang sama untuk editor template (`create-template.tsx`/`edit-template.tsx`, tombol `ServiceLookup`) dan form draft bulanan (datalist di `index.tsx`) → disimpan di `invoice_template`/`invoice_data` sebagai snapshot.
- Tidak ada relasi Eloquent dari `Service` ke tabel lain — murni master snapshot.

## Invarian & Jebakan
- `price` integer rupiah penuh — jangan pernah kirim/parse desimal; helper `Service::parseAmount()` tersedia untuk membersihkan string berformat (`Rp 1.500.000` → `1500000`).
- Daftar `type` di-hardcode di tiga tempat yang harus sinkron: `ServiceController::TYPES`, aturan `in:` di `StoreServiceRequest` (diwarisi `UpdateServiceRequest`), dan kolom `enum` di migrasi `create_services_table` — menambah tipe baru wajib mengubah ketiganya (termasuk migrasi baru untuk mengubah enum).
- Nama layanan tidak unik (tidak ada aturan `unique` maupun indeks) — duplikat diperbolehkan.
- `sort`/`direction`/`per_page` dari query string langsung dipakai (`orderBy($sort, $direction)`, `paginate($perPage)`) tanpa whitelist — kolom yang tidak ada memicu error SQL 500.
- Menghapus/mengubah service tidak mengubah invoice historis (snapshot by design) — jangan "memperbaiki" ini dengan FK tanpa keputusan produk.

### Panduan & video tutorial

- Tombol **Tutorial** di header daftar (`<TutorialButton slug="services" />`, di samping **Tambah Layanan**) dan halaman `/panduan` membaca `video/services/guide.ts` (teks panduan: peran, tugas, dampak, data yang disalin, peringatan, matriks hak akses) dan `video/services/tutorial.tsx` (komposisi Remotion `ServicesStaff`, `ServicesFinanceManager`, `ServicesAdmin`).
- Isi video: Staff mencari/menyaring katalog lalu memakai **Dari katalog** di editor invoice; Finance manager menambah layanan lalu menaikkan harganya; Admin melihat peran, dampak (katalog hanya sumber salinan — tanpa transaksi/saldo/laporan), contoh baris yang disalin, jejak di editor invoice & template Invoice Berulang, peringatan, lalu menghapus layanan.
- File: `video/services/{guide.ts, shots.ts, steps.ts, tutorial.tsx, screens/*.webp}`; capture `video/capture/services.js` (menambah layanan contoh di DB QC bila belum ada dan membuat ulang "Laporan SPT Tahunan Badan"; tidak menyimpan invoice/template).
- Ambil ulang screenshot bila UI/alur berubah: jalankan server QC (`DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8012`), jalankan `video/capture/services.js` lewat Playwright MCP (`browser_run_code_unsafe`), lalu `python video/capture/to-webp.py services` dan salin koordinat ke `shots.ts`. Pratinjau: `npm run video`.

## File Kunci
- `routes/web.php` (baris ±131–135)
- `app/Http/Controllers/ServiceController.php`
- `app/Http/Requests/StoreServiceRequest.php`, `app/Http/Requests/UpdateServiceRequest.php`
- `app/Models/Service.php`
- `resources/js/pages/services/index.tsx`
- `video/services/` (panduan & video tutorial), `video/capture/services.js`
- `tests/Feature/ServiceControllerTest.php`
