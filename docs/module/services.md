# Modul: Services (Layanan)

> Master data layanan/jasa yang dijual perusahaan — nama, kategori (`type`), dan harga default (integer rupiah penuh). Dipakai sebagai sumber pilihan saat menyusun item invoice dan template recurring: nama & harga **disalin** (snapshot) ke item, bukan direferensikan via FK. Route prefix: `/services`; permission: `view services` (grup), `create services`, `edit services`, `delete services` (`routes/web.php` baris ±123–128). CRUD sepenuhnya di satu halaman index (modal).

## Tabel Database

### `services`
| Kolom | Tipe/Catatan |
|---|---|
| `name` | string, wajib |
| `type` | enum (divalidasi `in:`): `Perizinan`, `Administrasi Perpajakan`, `Digital Marketing`, `Sistem Digital` — daftar resmi ada di konstanta `ServiceController::TYPES` |
| `price` | **integer rupiah penuh** (cast `integer`), min 0 — harga default, dapat di-override per item invoice |

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
Stat card (total layanan, harga rata-rata, harga tertinggi) dihitung agregat di DB; `avg_price` di-cast `(int)` agar tetap konsisten integer rupiah.

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
- **Invoices:** `InvoiceController::create/edit` mengirim daftar services (id, name, price, type) sebagai opsi item; saat item dipilih, `service_name` & `unit_price` disalin dan bebas diedit.
- **Recurring Invoices:** `RecurringInvoiceController` mengirim daftar yang sama untuk penyusunan `invoice_template`/`invoice_data`.
- Tidak ada relasi Eloquent dari `Service` ke tabel lain — murni master snapshot.

## Invarian & Jebakan
- `price` integer rupiah penuh — jangan pernah kirim/parse desimal; helper `Service::parseAmount()` tersedia untuk membersihkan string berformat (`Rp 1.500.000` → `1500000`).
- Daftar `type` di-hardcode di dua tempat yang harus sinkron: `ServiceController::TYPES` dan aturan `in:` di `StoreServiceRequest`/`UpdateServiceRequest` — menambah tipe baru wajib mengubah keduanya.
- Menghapus/mengubah service tidak mengubah invoice historis (snapshot by design) — jangan "memperbaiki" ini dengan FK tanpa keputusan produk.

## File Kunci
- `routes/web.php` (baris ±123–128)
- `app/Http/Controllers/ServiceController.php`
- `app/Http/Requests/StoreServiceRequest.php`, `app/Http/Requests/UpdateServiceRequest.php`
- `app/Models/Service.php`
- `resources/js/pages/services/index.tsx`
- `tests/Feature/ServiceControllerTest.php`
