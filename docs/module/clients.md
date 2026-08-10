# Modul: Clients (Klien)

> Master data klien — perorangan (`individual`) atau badan usaha (`company`) — dengan atribut perpajakan Indonesia (NPWP, KPP, EFIN, Account Representative). Klien adalah pihak tertagih pada invoice (`invoices.billed_to_id`) dan pemilik item invoice (`invoice_items.client_id`). Route prefix: `/clients`; permission: `view clients` (grup), `create clients`, `edit clients`, `delete clients` (`routes/web.php` baris ±116–121). Seluruh CRUD berlangsung di satu halaman index (modal), tanpa halaman create/edit/show terpisah.

## Tabel Database

### `clients`
| Kolom | Tipe/Catatan |
|---|---|
| `name` | string, wajib |
| `type` | enum: `individual` \| `company` |
| `email` | nullable, unique |
| `NPWP` | string(20) nullable — Nomor Pokok Wajib Pajak; tampil di invoice PDF & detail invoice |
| `KPP` | string(20) nullable — Kantor Pelayanan Pajak terdaftar |
| `EFIN` | string(20) nullable — Electronic Filing Identification Number |
| `logo` | nullable (ada di fillable model; tidak divalidasi/di-set oleh form saat ini) |
| `status` | `Active` \| `Inactive` (divalidasi `in:Active,Inactive`; **case-sensitive**, lihat Jebakan) |
| `account_representative`, `ar_phone_number` | AR pajak + nomor teleponnya |
| `person_in_charge` | PIC klien |
| `address` | text nullable |

Catatan relasi: CLAUDE.md menyebut relasi self-referential owners/companies, tetapi **kode saat ini tidak memilikinya** — `app/Models/Client.php` hanya mendefinisikan `invoices()`, `invoiceItems()`, dan `receivables()` (morphMany sebagai `debtor`). Sisa jejak legacy: `Invoice::getClientInitials()` masih membaca `$client->company_name`, kolom yang tidak ada di fillable — selalu jatuh ke `$client->name`.

## Fitur

### Daftar Klien (Index)
**Alur step-by-step:**
1. GET `/clients` (`can:view clients`), query: `search` (name/email/NPWP), `type`, `status`, `per_page` (default 10), `sort` (default `name`), `direction`.
2. `ClientController::index()` memuat klien + `withCount('invoices')` + eager load invoice ringkas untuk menghitung `total_invoice_amount` dan `paid_invoice_amount` per klien.
3. Stats: total, `Active`, per `type`.
4. Respons `Inertia::render('clients/index', ...)`; UI: DataTable + StatsCard + tombol tambah/edit/hapus via dialog.

**Penjelasan kode** (`app/Http/Controllers/ClientController.php`):
```php
->withCount('invoices')
->with(['invoices' => fn ($q) => $q->select('id', 'billed_to_id', 'total_amount', 'status')])
...
'total_invoice_amount' => $client->invoices->sum('total_amount'),
'paid_invoice_amount' => $client->invoices->where('status', 'paid')->sum('total_amount'),
```
Ringkasan penagihan per klien dihitung in-memory dari relasi yang di-load minimum kolom — inilah sumber kolom "total tagihan" dan "sudah dibayar" di tabel klien.

### Tambah Klien (Store)
**Alur:** User klik "Tambah" → dialog form → POST `/clients` (`can:create clients`), validasi `StoreClientRequest` (`type in:individual,company`, `email unique:clients`, `status in:Active,Inactive`, field pajak nullable max 20). Controller menormalkan string kosong menjadi `null` (`array_map(fn ($v) => $v ?: null, $validated)`) sebelum `Client::create()`, lalu redirect back dengan flash `success` ("Klien berhasil ditambahkan.").

### Ubah Klien (Update)
**Alur:** PUT `/clients/{client}` (`can:edit clients`), validasi `UpdateClientRequest` — mewarisi `StoreClientRequest` tetapi meng-override aturan email menjadi `unique:clients,email,{id}` sehingga email milik klien itu sendiri tidak dianggap duplikat. Pola sama dengan store (normalisasi empty→null, `$client->update()`), redirect back.

### Hapus Klien (Destroy) — cascade manual
**Alur:** DELETE `/clients/{client}` (`can:delete clients`) → `$client->delete()`.

**Penjelasan kode** (`app/Models/Client.php`):
```php
public function delete()
{
    $this->invoiceItems()->delete();  // hapus semua item milik klien
    $this->invoices()->delete();      // hapus semua invoice tertagih ke klien
    return parent::delete();
}
```
Model meng-override `delete()` untuk cascade manual: **menghapus klien ikut menghapus seluruh invoice dan invoice item-nya** — destruktif dan tidak bisa dibatalkan; UI wajib memakai `ConfirmDialog`. Pembayaran (`payments`) pada invoice tersebut tidak dihapus eksplisit di sini.

## Keterkaitan Antar Modul
- **Invoices:** `invoices.billed_to_id` → klien tertagih; `invoice_items.client_id` → item bisa atas nama klien lain dalam satu invoice; nama & `NPWP` klien tampil di invoice PDF; inisial nama klien dipakai dalam format nomor invoice (`{seq}/INV/{perusahaan}-{klien}/...`).
- **Recurring Invoices:** template & draft terikat `client_id`; hanya klien aktif yang muncul di opsi form.
- **Receivables:** klien bisa menjadi debtor polymorphic (`receivables()` morphMany).
- **API kecil:** GET `/api/clients` (closure di `routes/web.php`) menyediakan opsi label/value untuk Combobox lintas modul.
- Halaman create invoice hanya menampilkan klien `status = 'Active'`.

## Invarian & Jebakan
- **Hapus klien = hapus semua invoice + item-nya** (override `delete()`); tidak ada soft delete.
- Inkonsistensi kapitalisasi status: form/validasi memakai `Active`/`Inactive` dan `InvoiceController::create` memfilter `where('status', 'Active')`, tetapi `RecurringInvoiceController` memfilter `where('status', 'active')` (lowercase) — berfungsi hanya bila collation DB case-insensitive; jangan "merapikan" salah satu sisi tanpa menyamakan keduanya.
- Relasi self-referential owners/companies **tidak ada** di kode saat ini meskipun terdokumentasi di CLAUDE.md; `company_name` juga bukan kolom nyata (legacy di kalkulasi inisial).
- `email` unique tapi nullable — banyak klien tanpa email tidak masalah.
- Field kosong disimpan sebagai `NULL`, bukan string kosong (normalisasi di controller).
- Nama kolom pajak memakai huruf besar apa adanya (`NPWP`, `KPP`, `EFIN`) — ikuti persis di query/props.

## File Kunci
- `routes/web.php` (baris ±116–121, plus `/api/clients` baris ±92–99)
- `app/Http/Controllers/ClientController.php`
- `app/Http/Requests/StoreClientRequest.php`, `app/Http/Requests/UpdateClientRequest.php`
- `app/Models/Client.php`
- `resources/js/pages/clients/index.tsx`
- `tests/Feature/ClientControllerTest.php`
