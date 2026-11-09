# Modul: Transaction Categories (Kategori Transaksi)

> Master data kategori transaksi hierarkis dua level (parent → child) yang menjadi tulang punggung klasifikasi Cash Flow, Fund Request, Reimbursement, hingga Laporan Laba Rugi (via `pl_group`). Route prefix `/transaction-categories`; seluruh grup digate `can:view categories`, mutasi (store/template/update/pl-group/destroy) digate `can:manage categories`. Fitur khas: guard delete dengan dialog **reassign** yang memindahkan seluruh data terhubung ke kategori pengganti dalam satu transaksi DB, dan **Pakai Template** (12 induk + 55 sub siap pakai yang sudah bergrup Laba Rugi) — template yang sama diisikan seeder ke setiap perusahaan baru.

## Tabel Database

### `transaction_categories`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint PK | — |
| `parent_id` | FK self-referential → `transaction_categories.id`, nullable, **onDelete cascade** | `NULL` = kategori induk (parent) |
| `type` | string | `income` \| `expense` \| `transfer` \| `adjustment` \| `financing` |
| `pl_group` | string, nullable | Grup Laba Rugi: `revenue` \| `cogs` \| `opex` \| `other_income` \| `other_expense` \| `tax` (konstanta `TransactionCategory::PL_GROUPS`) |
| `label` | string | Nama kategori |
| `created_at`/`updated_at` | timestamp | — |

Sejarah skema penting: tabel awal (2025-09-30) punya `code` unique + `parent_code`; migration `2026_02_05_..._refactor_transaction_categories_remove_code_add_parent_id.php` memigrasikan hierarki ke `parent_id` dan **men-drop kolom `code` & `parent_code`**. `pl_group` ditambahkan `2026_05_25_..._add_pl_group_to_transaction_categories_table.php`.

Tabel yang mereferensikan `category_id`: `bank_transactions`, `fund_request_items`, `reimbursements`.

## Fitur

### Halaman Index — `GET /transaction-categories` (`can:view categories`)

**Alur step-by-step:**

1. User membuka `/transaction-categories` dengan filter opsional `search`, `type`, `pl_status` (`classified`/`unclassified`), `per_page`, `sort`, `direction`.
2. `TransactionCategoryController::index()` mengeksekusi query berpaginasi dengan `with('parent')` + `withCount(['transactions', 'children', 'fundRequestItems', 'reimbursements'])` — count inilah yang dipakai UI untuk menentukan apakah delete perlu dialog reassign.
3. Filter `pl_status=unclassified` = kategori `income`/`expense` yang `pl_group`-nya masih `NULL` (belum diklasifikasi untuk Laba Rugi).
4. Prop tambahan: `stats` (total/parents/children/unclassified), `parentOptions` (kandidat induk untuk form), `reassignOptions` (semua kategori dengan label `full_path` untuk dialog reassign), dan `templatePreview` — prop **opsional** (`Inertia::optional`) yang tidak pernah ikut kunjungan biasa; hanya dihitung saat dialog Pakai Template memintanya (lihat di bawah).
5. Respons `Inertia::render('transaction-categories/index', ...)` → halaman React `resources/js/pages/transaction-categories/index.tsx` (header `PageHeader` dengan tombol Tutorial / Pakai Template / Tambah Kategori, tabel, badge type/pl_group, dialog create/edit/delete, dialog template di `components/template-dialog.tsx`).

**Penjelasan kode** (`app/Http/Controllers/TransactionCategoryController.php`):

```php
$categories = TransactionCategory::with(['parent'])
    ->withCount(['transactions', 'children', 'fundRequestItems', 'reimbursements'])
    ->when($search, fn ($q) => $q->where('label', 'like', "%{$search}%"))
    ->when($type, fn ($q) => $q->where('type', $type))
    ->when($plStatus === 'unclassified', fn ($q) => $q->whereIn('type', ['income', 'expense'])->whereNull('pl_group'))
    ->orderBy($sort, $direction)
    ->paginate($perPage);
```

### Pakai Template — pratinjau + `POST /transaction-categories/template` (`can:manage categories`)

Template kategori siap pakai: **12 induk, 55 sub**, nama saja (tanpa kode akun), tersusun mengikuti urutan bagan akun — pendapatan (4, 7) dulu, lalu HPP dan beban (5, 6, 8, 9). `pl_group` diisi pada induk **dan** sub (sama dengan induknya), jadi tidak ada yang "belum diklasifikasi". Isi lengkapnya hidup di satu tempat: konstanta `CategoryTemplateService::TEMPLATE` (`app/Services/CategoryTemplateService.php`).

| Induk (type) | `pl_group` | Sub |
|---|---|---|
| Pendapatan Usaha (Tanpa Invoice) (income) | revenue | Pendapatan Jasa; Penjualan Barang; Komisi & Fee |
| Pendapatan Lain-lain (income) | other_income | Bunga & Jasa Giro Bank; Pengembalian Dana (Refund); Pendapatan Sewa; Pendapatan Lainnya |
| Harga Pokok Penjualan (Tanpa Invoice) (expense) | cogs | Pembelian Barang Dagang; Bahan Baku; Jasa Vendor & Subkon; Ongkos Kirim Pembelian |
| Beban Karyawan (expense) | opex | Gaji Karyawan; Tunjangan & Lembur; THR & Bonus; BPJS Kesehatan; BPJS Ketenagakerjaan; PPh 21 Karyawan; Honor Tenaga Lepas; Pelatihan Karyawan |
| Beban Kantor (expense) | opex | Sewa Kantor; Listrik; Air; Internet & Telepon; Kebersihan & Keamanan; Konsumsi Kantor & Rapat |
| Beban Administrasi & Umum (expense) | opex | ATK & Perlengkapan Kantor; Cetak & Fotokopi; Kurir & Pengiriman; Bea Meterai; Perizinan & Legalitas; Jasa Profesional (Notaris, Konsultan); Langganan Software & Aplikasi; Asuransi |
| Beban Perjalanan & Transportasi (expense) | opex | Transportasi Lokal; BBM, Tol & Parkir; Tiket Perjalanan Dinas; Hotel & Akomodasi; Uang Harian Dinas |
| Beban Pemasaran (expense) | opex | Iklan & Promosi; Materi Promosi & Cetak; Jamuan Klien; Komisi Penjualan |
| Beban Pemeliharaan (expense) | opex | Perbaikan Gedung & Kantor; Servis Kendaraan; Perawatan Peralatan & Komputer |
| Beban Pajak & Retribusi (expense) | opex | PBB & Pajak Daerah; Pajak Kendaraan; Setoran PPh 23 & 4(2) |
| Beban Lain-lain (expense) | other_expense | Biaya Administrasi Bank; Pajak Jasa Giro; Denda & Sanksi; Sumbangan & Donasi |
| Pajak Penghasilan Badan (expense) | tax | PPh 25 (Angsuran Bulanan); PPh 29 (Kurang Bayar Tahunan); PPh Final UMKM 0,5% |

"(Tanpa Invoice)": pendapatan dan HPP penjualan lewat invoice sudah dihitung otomatis oleh Laba Rugi dari `payments` dan `invoice_items.cogs_amount`; kategori ini hanya untuk yang tidak memakai invoice (aturan anti-dobel HPP, `docs/design/laba-rugi.md`). Template sengaja **tanpa** kategori `financing` — celah Pendanaan (kategori pendanaan belum bisa dipilih di formulir transaksi) adalah pekerjaan terpisah.

**Alur step-by-step:**

1. Tombol **Pakai Template** di aksi header, hanya bila `can('manage categories')`, membuka dialog.
2. Setiap kali dialog dibuka, klien memanggil `router.reload({ only: ['templatePreview'] })`. Prop opsional itu menjalankan `CategoryTemplateService::plan()` — atau `null` bila pengguna tidak punya `manage categories` (pratinjau tidak tersedia baginya). Kegagalan HTTP/jaringan ditangani di dialog (`onHttpException`/`onNetworkError` mengembalikan `false`): tampil state galat + **Coba lagi**, halaman tidak berpindah. Selama memuat tampil skeleton.
3. Dialog menampilkan ringkasan **Baru / Sudah ada / Dilewati** (StatsCard `inModal`), lalu daftar per jenis (Pemasukan, Pengeluaran) → induk + subnya, masing-masing dengan **baris Laba Rugi** tujuan dan Badge status (+ alasan bila dilewati, + "Sudah ada di grup …" bila sub itu tinggal di grup lain). Footer: **Batal** + **Buat N kategori** (nonaktif dengan teks "Tidak ada kategori baru" bila N = 0; nonaktif + spinner selama memproses).
4. `POST /transaction-categories/template` (tanpa isi) → `TransactionCategoryController::applyTemplate()` → `CategoryTemplateService::apply()`: di dalam `DB::transaction` rencana **dihitung ulang** dari database (daftar dari klien tidak dipakai), lalu tiap grup: induk baru dibuat dulu, baru sub-sub barunya.
5. Redirect back + flash `"N kategori dibuat, M dilewati karena sudah ada."` — bila ada yang dilewati penjaga ditambah `" K lainnya dilewati, alasannya tercantum di pratinjau Pakai Template."`. Halaman menampilkannya sebagai toast. Klik ulang = `0 kategori dibuat, …` (idempoten).

**Aturan pencocokan** (`CategoryTemplateService::plan()`, semua kategori dimuat sekali lalu dibandingkan di PHP):

- Nama dinormalisasi: `trim`, spasi berurutan jadi satu, `mb_strtolower`. Nama yang hanya mirip ("Biaya Listrik" vs "Listrik") **tidak** dianggap sama.
- **Induk** template = *sudah ada* bila ada kategori **induk** (`parent_id` null) dengan `type` sama + nama ternormalisasi sama → dipakai ulang, sub barunya ditempel ke sana.
- **Penjaga induk:** induk yang cocok hanya boleh dijadikan grup bila bukan kategori sistem (`system_key` null) **dan** tidak dipakai langsung oleh `bank_transactions`, `fund_request_items`, atau `reimbursements`. Kalau tidak, seluruh grup berstatus *dilewati* dengan alasan terbaca — menempelkan sub akan menjadikannya judul grup yang tidak bisa dipilih, padahal data lama memakainya. Bila ada beberapa induk kembar, dipakai yang lolos penjaga.
- **Sub** template = *sudah ada* bila ada kategori **sub** (`parent_id` tidak null) dengan `type` sama + nama ternormalisasi sama **di induk mana pun** → tidak dibuat (mencegah nama kembar di pemilih).
- Induk baru yang semua subnya sudah ada di grup lain tidak dibuat (status *dilewati*: "Semua sub-kategorinya sudah ada di grup lain.") — ia hanya akan menjadi judul grup kosong.
- **Baris yang sudah ada tidak pernah diubah** (label, type, pl_group, parent, system_key).

**Penjelasan kode** (`app/Services/CategoryTemplateService.php`):

```php
return DB::transaction(function (): array {
    $plan = $this->plan();               // dihitung ulang di server
    foreach ($plan['groups'] as $group) {
        if ($group['status'] === self::STATUS_SKIPPED) { continue; }
        $parentId = $group['category_id']; // induk lama yang dipakai ulang
        if ($group['status'] === self::STATUS_NEW) {
            $parentId = TransactionCategory::create([... 'pl_group' => $group['pl_group'], 'parent_id' => null])->id;
        }
        // sub berstatus new → create dengan type & pl_group grupnya, parent_id = $parentId
    }
});
```

Tidak ada unique index pada `transaction_categories`; dua permintaan yang benar-benar bersamaan (dua tab) bisa membuat kembaran — dicatat sebagai komentar `ponytail:` di `apply()`, ditekan dengan tombol nonaktif selama memproses.

### Kategori Awal Perusahaan Baru — `TransactionCategorySeeder`

Dijalankan pipeline provisioning (`TenantDatabaseSeeder` → `SeedDatabase`); **deploy tidak menjalankannya**, jadi perusahaan yang sudah ada tidak berubah (mereka memakai Pakai Template). Isinya, idempoten:

1. Kategori sistem `FIN-LOAN-IN`, `FIN-LOAN-OUT`, `FIN-RCV-OUT`, `FIN-RCV-IN` (financing), `EXP-INTEREST` (+`pl_group` other_expense), `REV-INTEREST` (+other_income) — logika patch lama dipertahankan: `system_key` dipasang bila belum, `pl_group` hanya diisi bila masih kosong (pilihan pengguna tidak ditimpa).
2. `Setoran Modal` & `Penarikan Modal` (financing, tanpa anak).
3. `Transfer Internal → Antar Rekening Sendiri` — WAJIB: tanpa sub, pemilih kategori dialog Transfer kosong.
4. Template lewat `CategoryTemplateService::apply()` — satu sumber kebenaran dengan tombol Pakai Template.

Kategori bawaan lama yang khas satu perusahaan (`Operational Expenses` + 6 anak, `PENGELUARAN LAIN-LAIN` + 2, `HPP` + 4, `CAPEX` + 1, `Penghasilan` + `Kembali Dana`) **tidak lagi** diisikan. Hasil di perusahaan baru: 77 kategori (8 tetap + 2 transfer + 67 template), 0 pemasukan/pengeluaran yang belum diklasifikasi. Seeder demo `BankTransactionSeeder` kini hanya memakai **sub** kategori (label template yang sesuai deskripsinya, mis. "Gaji Karyawan", "Bunga & Jasa Giro Bank"), bukan `where('type', …)->first()` yang bisa mengambil induk.

### Create Kategori — `POST /transaction-categories` (`can:manage categories`)

**Alur step-by-step:**

1. User klik **Tambah Kategori** → dialog form: grid tombol **Tipe** (5 tombol; mengklik salah satunya mengosongkan `parent_id` & `pl_group`), input **Nama Kategori**, Combobox **Grup Laba Rugi (opsional)** (hanya tampil untuk income/expense, opsi difilter sesuai tipe), Combobox **Parent Kategori (opsional)** (opsi `parentOptions` difilter bertipe sama; hanya tampil bila ada kandidat).
2. `POST /transaction-categories` payload `{type, pl_group?, label, parent_id?}`.
3. Middleware `can:manage categories`; validasi `StoreTransactionCategoryRequest`:

```php
return [
    'type' => ['required', 'in:income,expense,financing,transfer,adjustment'],
    'pl_group' => ['nullable', Rule::in(TransactionCategory::PL_GROUPS)],
    'label' => ['required', 'string', 'max:255'],
    'parent_id' => ['nullable', 'exists:transaction_categories,id'],
];
```

4. `TransactionCategory::create($request->validated())`.
5. Respons ganda: request biasa → redirect back + flash "Kategori berhasil ditambahkan."; request `wantsJson()` → JSON 201 `{id, label, type, parent_id}` — dipakai fitur "buat kategori inline" dari modul lain tanpa meninggalkan form.

### Update Kategori — `PUT /transaction-categories/{transactionCategory}`

**Alur step-by-step:**

1. Dialog edit terisi data lama (`type`, `pl_group`, `label`, `parent_id`).
2. `PUT /transaction-categories/{id}` → middleware `can:manage categories` → `UpdateTransactionCategoryRequest` (extends Store, rules identik).
3. `$transactionCategory->update($request->validated())` → redirect back + flash "Kategori berhasil diperbarui.".
4. Catatan: tidak ada guard yang mencegah mengubah `type` kategori yang sudah dipakai transaksi — mengubahnya memindahkan baris antar halaman cash-flow (lihat Jebakan).

### Update pl_group Saja — `PATCH /transaction-categories/{id}/pl-group`

Endpoint ringan untuk klasifikasi inline dari side panel halaman Laba Rugi (P&L).

**Alur step-by-step:**

1. Di panel klasifikasi P&L user memilih grup untuk sebuah kategori.
2. `PATCH /transaction-categories/{id}/pl-group` payload `{pl_group: 'revenue'|'cogs'|'opex'|'other_income'|'other_expense'|'tax'|null}`.
3. Middleware `can:manage categories`; validasi inline `Rule::in(TransactionCategory::PL_GROUPS)`, nullable (kirim null = batalkan klasifikasi).
4. Update satu kolom lalu `back()` (tanpa flash) — Inertia me-refresh prop halaman pemanggil.

```php
$validated = $request->validate([
    'pl_group' => ['nullable', Rule::in(TransactionCategory::PL_GROUPS)],
]);
$transactionCategory->update(['pl_group' => $validated['pl_group'] ?? null]);
```

`pl_group` hanya bermakna untuk `type` income/expense; financing & transfer memang dikeluarkan dari P&L berdasarkan tipenya (lihat PHPDoc konstanta di model).

### Delete + Dialog Reassign — `DELETE /transaction-categories/{transactionCategory}`

**Alur step-by-step:**

1. User klik hapus (ikon dinonaktifkan + tooltip bila `children_count > 0`). UI menghitung `deleteUsageCount = transactions_count + fund_request_items_count + reimbursements_count`; jika 0 → `ConfirmDialog` biasa (tombol **Hapus**); jika > 0 → `Dialog` berisi rincian pemakaian + Combobox **Pindahkan ke Kategori** (`reassignOptions` difilter: tipe sama & bukan dirinya sendiri — `index.tsx` baris ~281; opsi juga memuat kategori utama) dan tombol **Pindahkan & Hapus**.
2. `DELETE /transaction-categories/{id}` payload `{reassign_to_id?}` → middleware `can:manage categories`.
3. Guard bertingkat di `destroy()`:
   - Punya sub-kategori (`children()->exists()`) → **ditolak**: "Kategori ini memiliki sub-kategori. Hapus sub-kategori terlebih dahulu." (reassign tidak berlaku untuk parent yang masih punya anak).
   - Validasi `reassign_to_id`: harus ada di tabel dan `Rule::notIn([$id sendiri])`.
   - Masih dipakai (`transactions`/`fundRequestItems`/`reimbursements` exists) tapi tanpa reassign → ditolak: "Kategori ini masih digunakan. Pilih kategori pengganti...".
   - Kategori pengganti bertipe berbeda → ditolak: "Kategori pengganti harus bertipe sama."
4. Eksekusi dalam **satu transaksi DB**: ketiga relasi di-update massal ke kategori pengganti, lalu kategori dihapus — tidak mungkin ada referensi yatim.
5. Redirect back + flash "Kategori berhasil dihapus."; error dikirim via `withErrors(['delete' => ...])` dan ditampilkan di dialog.

**Penjelasan kode** (`app/Http/Controllers/TransactionCategoryController.php`):

```php
DB::transaction(function () use ($transactionCategory, $reassignTo, $inUse) {
    if ($inUse) {
        $transactionCategory->transactions()->update(['category_id' => $reassignTo->id]);
        $transactionCategory->fundRequestItems()->update(['category_id' => $reassignTo->id]);
        $transactionCategory->reimbursements()->update(['category_id' => $reassignTo->id]);
    }
    $transactionCategory->delete();
});
```

Skenario-skenario ini dicakup `tests/Feature/TransactionCategoryControllerTest.php`.

### Helper Picker Lintas Modul — `TransactionCategory::selectOptions()` & `GET /api/transaction-categories`

**Alur step-by-step:**

1. Modul lain (Cash Flow, Fund Request, Reimbursement) butuh dropdown kategori → panggil `TransactionCategory::selectOptions($type)` di controller, atau frontend fetch `GET /api/transaction-categories?type=credit|debit|income|expense|adjustment|transfer` (closure di `routes/web.php`; `credit` dipetakan ke tipe `income+adjustment+transfer`, `debit` ke `expense+adjustment+transfer`).
2. Keduanya menghasilkan format yang sama untuk Combobox: **parent sebagai header disabled, hanya anak yang bisa dipilih** (prefix `↳ `).

**Penjelasan kode** (`app/Models/TransactionCategory.php`):

```php
foreach ($parents as $parent) {
    $options[] = ['label' => $parent->label, 'value' => $parent->id, 'disabled' => true];
    foreach ($parent->children as $child) {
        $options[] = ['label' => '↳ '.$child->label, 'value' => $child->id];
    }
}
```

Konsekuensinya: transaksi selalu diklasifikasikan ke **kategori anak**, parent hanya pengelompokan visual. Accessor `full_path` (`"Parent → Child"`) dipakai untuk tampilan lengkap (kolom kategori PDF, opsi reassign).

### Kategori Sistem untuk Loans/Receivables

Modul Loans & Receivables mencatat kas otomatis dengan mencari kategori sistem tertentu, lalu memakai id-nya sebagai `category_id` transaksi yang dibuat:

| Kode | Dipakai saat | Arah |
|------|--------------|------|
| `FIN-LOAN-IN` | Penerimaan pinjaman (`LoanController::store`) | credit |
| `FIN-LOAN-OUT` | Pembayaran pokok pinjaman (`LoanController` payLoan) | debit |
| `EXP-INTEREST` | Pembayaran bunga pinjaman | debit |
| `FIN-RCV-OUT` | Pencairan piutang (`ReceivableController` approve) | debit |
| `FIN-RCV-IN` | Pembayaran pokok piutang | credit |
| `REV-INTEREST` | Pembayaran bunga piutang | credit |

```php
// app/Http/Controllers/LoanController.php
$category = TransactionCategory::findSystem('FIN-LOAN-IN');
BankTransaction::create([..., 'category_id' => $category?->id]);
```

Identitas kategori sistem hidup di kolom **`system_key`** (nullable unique, ditambahkan migration `2026_08_11_..._add_system_key_to_transaction_categories.php` sebagai pengganti kolom `code` yang di-drop 2026-02-05). `system_key` sengaja di luar `$fillable`; hanya seeder/migration yang mengisinya. Helper: `TransactionCategory::findSystem($key)` dan `$category->isSystem()`.

### Panduan & video tutorial

1. Tombol **Tutorial** (`<TutorialButton slug="transaction-categories" />`) di header halaman, di samping **Tambah Kategori**, membuka video per role; halaman `/panduan/transaction-categories` memuat panduan teks yang sama. Staff tidak punya akses modul ini, jadi hanya ada video **Finance manager** dan **Admin**.
2. Isi panduan: `video/transaction-categories/guide.ts`. Video: `video/transaction-categories/tutorial.tsx` (komposisi `TransactionCategoriesFinanceManager`, `TransactionCategoriesAdmin`), `steps.ts`, `shots.ts`, `screens/*.webp`.
3. Video Admin menjelaskan dampak: tipe → halaman Arus Kas, `pl_group` → baris Laba Rugi (berlaku mundur), Pakai Template (yang dibuat/dilewati, penjaga induk), Pindahkan & Hapus (memindahkan `bank_transactions`, `fund_request_items`, `reimbursements`), picker yang hanya menawarkan sub kategori, dan peringatan: nama mirip tidak dianggap sama, "(Tanpa Invoice)" bukan untuk penjualan ber-invoice, opsi reassign juga memuat kategori utama. Video Finance manager punya bab **Pakai Template** (`TEMPLATE_STEPS`).
4. `/panduan/transaction-categories` publik (tanpa login), jadi screenshot wajib dari DB QC (data contoh, bukan data perusahaan asli). Ambil ulang screenshot: siapkan lingkungan QC terisolasi dengan akun di header skrip (`fm@qc.test` & `admin@gmail.com` di perusahaan contoh hasil provisioning, `fm.lama@qc.test` di perusahaan contoh "lama" yang kategorinya dibuat sebelum template ada; masing-masing anggota satu perusahaan agar alamat tanpa `/c/{slug}` dialihkan), jalankan `video/capture/bank-accounts.js` lebih dulu (membuat "Langganan Software" & "Biaya Langganan (lama)" + transaksinya; butuh sub "Sewa Ruang Rapat" tanpa grup L/R), lalu `video/capture/transaction-categories.js` lewat Playwright MCP, `python video/capture/to-webp.py transaction-categories`, dan salin koordinat ke `shots.ts`. Skrip hanya mengubah kategori buatannya sendiri, plus menerapkan template di perusahaan "lama" (layar `fm-template*`). Screenshot saat ini diambil 9 Nov 2026 dari data contoh lingkungan QC `tplkat`.
5. Perubahan UI/label/alur modul ini wajib diikuti pembaruan `guide.ts` dan, bila tampilan berubah, ambil ulang screenshot + `shots.ts`/`steps.ts`. Pratinjau: `npm run video`; render: `npm run video:render -- TransactionCategoriesAdmin out/x.mp4`.

## Keterkaitan Antar Modul

- **Cash Flow** — `type` kategori menentukan halaman (income/expense/transfer) tempat transaksi muncul; picker income/expense/transfer memakai `selectOptions()`/`/api/transaction-categories`.
- **Bank Accounts** — donut breakdown pengeluaran per kategori; kolom kategori pada laporan PDF memakai `full_path`.
- **Fund Requests** (`fund_request_items.category_id`) dan **Reimbursements** (`reimbursements.category_id`) — ikut dipindahkan oleh mekanisme reassign delete.
- **Laba Rugi (P&L)** — `pl_group` memetakan kategori ke baris laporan (revenue/cogs/opex/other_income/other_expense/tax); side panel P&L memakai endpoint PATCH pl-group; filter `pl_status=unclassified` membantu menemukan kategori yang belum dipetakan. Kategori template sudah bergrup pada sub-nya sendiri (P&L membaca `pl_group` kategori milik transaksi, bukan induknya), jadi transaksinya langsung masuk baris yang benar.
- **Provisioning perusahaan** (`TenantDatabaseSeeder`) — memanggil `TransactionCategorySeeder`, yang mengisi template lewat `CategoryTemplateService`.
- **Loans & Receivables** — konsumen kategori sistem di atas.
- **Permissions** — `view categories` (lihat), `manage categories` (semua mutasi).

## Invarian & Jebakan

- **Hierarki maksimal dua level secara praktis**: picker hanya menawarkan parent sebagai induk, dan `selectOptions()` hanya merender parent → children (cucu tidak akan tampil di picker meskipun DB tidak melarangnya).
- **Parent tidak untuk transaksi.** Semua picker menonaktifkan parent — jangan menulis picker baru yang membiarkan parent dipilih (pernah menjadi bug di Fund Request/Reimbursement, sudah diperbaiki).
- **Delete parent yang punya anak selalu ditolak**, bahkan dengan reassign. Tapi hati-hati: FK `parent_id` di DB adalah **onDelete cascade** — menghapus parent lewat query manual (bukan controller) akan ikut menghapus seluruh anaknya secara diam-diam.
- **Reassign harus setipe** (`income` → `income`, dst.) dan dieksekusi atomik dalam `DB::transaction`; ketiga relasi (`bank_transactions`, `fund_request_items`, `reimbursements`) selalu dipindah bersama — jika menambah tabel baru ber-`category_id`, wajib menambahkannya ke `destroy()` dan `withCount` di `index()`.
- **Mengubah `type` kategori yang sudah dipakai tidak diguard** — transaksinya akan berpindah/lenyap dari halaman cash-flow terkait (halaman memfilter berdasar tipe kategori). Lakukan dengan sadar.
- **`pl_group` NULL = belum masuk P&L.** Kategori income/expense tanpa `pl_group` tidak terklasifikasi di Laba Rugi; gunakan filter `unclassified` untuk audit.
- **[DIPERBAIKI 2026-08-11] Bug kolom `code`.** Lookup lama `where('code', ...)` (kolom sudah di-drop 2026-02-05) diganti kolom `system_key` + `TransactionCategory::findSystem()`. **Kategori ber-`system_key` diproteksi controller**: `update()` dan `destroy()` menolaknya — jangan melonggarkan proteksi ini, modul Loans/Receivables bergantung pada identitas kategori tersebut. Kode baru yang butuh kategori sistem WAJIB memakai `findSystem()`, bukan label.
- `store()` punya dua mode respons (redirect vs JSON 201 `wantsJson()`); jaga kompatibilitas keduanya saat mengubah method ini.
- **Tidak ada guard parent = diri sendiri / parent bertingkat.** Form Edit menawarkan semua kategori utama setipe sebagai parent, termasuk kategori yang sedang diedit, dan `StoreTransactionCategoryRequest` hanya memeriksa `exists`. Memilihnya membuat `parent_id = id` sendiri (kategori lenyap dari picker `selectOptions()` beserta anaknya); memberi parent pada kategori utama yang punya anak membuat hierarki tiga level.
- **Quick-add kategori dari form transaksi** (`components/shared/quick-add-category-dialog.tsx`) memakai opsi grup dari `/api/transaction-categories?type=credit|debit`, yang juga memuat kelompok `transfer`/`adjustment`; sub kategori baru (tipe income/expense) bisa tercipta di bawah kelompok bertipe lain. Tombol **+ Tambah** juga tidak digate `manage categories` di frontend (server tetap menolak 403).
- **`/api/transaction-categories` (dan `/api/bank-accounts`, `/api/clients`) berada di luar grup `auth`** di `routes/web.php` — bisa dibaca tanpa login.
- **Template tidak pernah mengubah kategori yang sudah ada** dan pencocokannya hanya nama ternormalisasi (huruf besar/kecil + spasi). Jangan menambah pencocokan "mirip" (fuzzy) diam-diam: hasilnya menempelkan sub ke induk yang salah tanpa bisa ditelusuri. Isi template diubah di `CategoryTemplateService::TEMPLATE` saja (seeder dan tombol ikut); perubahan isi tidak menyentuh perusahaan lama sampai mereka menekan Pakai Template.
- **Penjaga induk wajib ikut bila ada tabel baru ber-`category_id`**: tambahkan relasinya ke `withCount` di `CategoryTemplateService::plan()` dan ke `blockReason()`, sama seperti `destroy()`/`index()`.
- **Batas klik ganda bersamaan** (komentar `ponytail:` di `apply()`): tanpa unique index, dua POST serentak dari dua tab bisa membuat kembaran; rapikan lewat Pindahkan & Hapus. Penguat bila perlu: `lockForUpdate()` saat memuat kategori di dalam transaksi.
- **Pratinjau hanya untuk `manage categories`**: prop opsional `templatePreview` mengembalikan `null` untuk pengguna lain, POST-nya 403. (Tombol **Tambah Kategori** dan ikon edit/hapus masih tampil untuk pengguna yang hanya `view categories` — server menolak 403; perilaku lama, belum diubah.)

## File Kunci

| File | Peran |
|------|-------|
| `app/Models/TransactionCategory.php` | Konstanta `PL_GROUPS`, relasi parent/children/transactions/reimbursements/fundRequestItems, `selectOptions()`, accessor `full_path` |
| `app/Services/CategoryTemplateService.php` | Isi template (`TEMPLATE`), `plan()` (pratinjau + penjaga), `apply()` (transaksi DB), `normalize()` |
| `app/Http/Controllers/TransactionCategoryController.php` | Index (filter + withCount + prop opsional `templatePreview`), store (dual respons), applyTemplate, update, updatePlGroup, destroy dengan guard & reassign |
| `database/seeders/TransactionCategorySeeder.php` | Kategori awal perusahaan baru: sistem + modal + transfer + template (lewat service) |
| `resources/js/pages/transaction-categories/components/template-dialog.tsx` | Dialog Pakai Template (pratinjau, skeleton, galat + Coba lagi, ScrollArea) |
| `app/Http/Requests/StoreTransactionCategoryRequest.php` / `UpdateTransactionCategoryRequest.php` | Validasi type/pl_group/label/parent_id |
| `routes/web.php` | Grup `can:view categories` + `can:manage categories`; closure `GET /api/transaction-categories` |
| `resources/js/pages/transaction-categories/index.tsx` | Halaman tunggal: tabel, form dialog, dialog delete + Combobox reassign |
| `database/migrations/2025_09_30_085156_create_transaction_categories_table.php` | Skema awal (masih ber-code) |
| `database/migrations/2026_02_05_041553_refactor_transaction_categories_remove_code_add_parent_id.php` | Migrasi ke `parent_id`, drop `code`/`parent_code` |
| `database/migrations/2026_05_25_160957_add_pl_group_to_transaction_categories_table.php` | Penambahan kolom `pl_group` |
| `app/Http/Controllers/LoanController.php`, `ReceivableController.php` | Konsumen kategori sistem (FIN-LOAN-*, EXP-INTEREST, FIN-RCV-*, REV-INTEREST) |
| `tests/Feature/TransactionCategoryControllerTest.php` | Test CRUD, guard delete, reassign |
| `tests/Feature/CategoryTemplateServiceTest.php`, `TransactionCategoryTemplateTest.php`, `TransactionCategorySeederTest.php` | Isi template, pencocokan, penjaga, idempoten, 403 & pratinjau, seeder perusahaan baru |
