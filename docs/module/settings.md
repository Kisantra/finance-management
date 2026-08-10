# Modul: Settings (Profil, Password, Perusahaan, PDF Template Builder)

> Modul pengaturan pribadi (profil & kata sandi), profil perusahaan tunggal (identitas, NPWP/PKP, aset gambar untuk PDF), dan **WYSIWYG PDF Template Builder** beserta pustaka font kustom global. Route prefix `/settings` dengan nama route `settings.*`. Profil/password/company terbuka untuk semua user login; sub-grup `pdf-templates` (termasuk custom fonts) digate permission `manage pdf templates`.

## Tabel Database

| Tabel | Kolom penting | Keterangan |
|-------|---------------|------------|
| `users` | `name`, `email`, `password`, `phone_number`, `locale`, `status` | Data akun yang diedit di profile/password. |
| `company_profiles` | `name`, `abbreviation`, `address`, `email`, `phone`, `logo_path`, `letter_head_path`, `signature_path`, `stamp_path`, `is_pkp` (bool), `npwp`, `ppn_rate` (decimal:2), `bank_accounts` (JSON), `finance_manager_name`, `finance_manager_position` | Singleton — hanya satu baris, diakses via `CompanyProfile::current()`. |
| `pdf_templates` | `name`, `description`, `layout` (JSON), `is_default` (bool) | Layout builder: banded (`{paper, bands:{header, content, footerFlow, footerFixed}}`) atau legacy flat-array. |
| `custom_fonts` | `name` (unique), `filename` | Font .ttf global untuk semua template; file di `storage/app/public/fonts/custom/`. |

## Fitur

### Profil — Edit & Hapus Akun (`GET/PATCH/DELETE /settings/profile`)

**Alur step-by-step (edit):**
1. User membuka Pengaturan → Profil (`GET /settings/profile`, route `settings.profile`).
2. `ProfileController::edit()` merender `settings/profile` dengan data user + flag `must_verify_email`.
3. User mengubah nama/email lalu submit `PATCH /settings/profile`.
4. Validasi inline: `name` required; `email` required, lowercase, unique ignore diri sendiri.
5. Jika email berubah (`$user->isDirty('email')`), `email_verified_at` di-null-kan (harus verifikasi ulang).
6. `$user->save()` → redirect back + flash "Profil berhasil diperbarui."

**Penjelasan kode** (`app/Http/Controllers/Settings/ProfileController.php`):

```php
$user->fill($validated);
if ($user->isDirty('email')) {
    $user->email_verified_at = null;
}
$user->save();
```

Catatan: form update profil di controller saat ini hanya memvalidasi `name` dan `email`. Kolom `phone_number` dan `locale` ada di `$fillable` model `User`, tetapi `phone_number` diedit lewat modul Admin Users, dan `locale` aktif dikelola via session (`POST /language` di `routes/web.php`).

**Alur step-by-step (hapus akun):**
1. User klik "Hapus Akun" → dialog konfirmasi meminta password.
2. `DELETE /settings/profile` memvalidasi `password` dengan rule `current_password`.
3. `Auth::logout()` → `$user->delete()` (hard delete) → session di-invalidate + token regenerate.
4. Redirect ke `/` (halaman publik/login).

### Ganti Kata Sandi (`GET/PUT /settings/password`)

**Alur step-by-step:**
1. `GET /settings/password` merender halaman `settings/password` (tanpa props khusus).
2. Submit `PUT /settings/password` dengan `current_password`, `password`, `password_confirmation`.
3. Validasi: `current_password` rule bawaan Laravel (mencocokkan hash password aktif), `password` mengikuti `PasswordRule::defaults()` + `confirmed`.
4. `Auth::user()->update(['password' => Hash::make(...)])` → flash "Kata sandi berhasil diperbarui."

### Profil Perusahaan (`GET/POST /settings/company`)

**Alur step-by-step:**
1. `GET /settings/company` → `CompanyController::edit()` memuat `CompanyProfile::first()` dan merender `settings/company` dengan seluruh field + URL aset ber-cache-buster (`?v=filemtime`).
2. User mengisi identitas (nama, alamat, email, telepon), status pajak (`is_pkp`, `npwp`, `ppn_rate` 0–100), penanggung jawab keuangan (`finance_manager_name/position`), serta mengunggah aset (logo, letterhead, signature, stamp — masing-masing image max 2 MB).
3. Submit `POST /settings/company` → validasi `UpdateCompanyRequest` (`app/Http/Requests/Settings/UpdateCompanyRequest.php`).
4. `CompanyProfile::firstOrNew()` — baris pertama dipakai atau dibuat baru (menjaga singleton), lalu `fill()` field teks.
5. Untuk tiap file yang diunggah, `replaceFile()` menghapus file lama di disk `public` lalu `storeAs('images', "{nama}-{timestamp}.{ext}")`.
6. `$company->save()` → flash "Profil perusahaan berhasil diperbarui."

**Penjelasan kode** (`app/Http/Controllers/Settings/CompanyController.php`):

```php
private function replaceFile(CompanyProfile $company, string $column, $file, string $baseName): void
{
    if ($company->{$column} && Storage::disk('public')->exists($company->{$column})) {
        Storage::disk('public')->delete($company->{$column});
    }
    $ext = $file->getClientOriginalExtension() ?: 'png';
    $company->{$column} = $file->storeAs('images', "{$baseName}.{$ext}", 'public');
}
```

### Hapus Aset Perusahaan (`DELETE /settings/company/assets/{asset}`)

**Alur step-by-step:**
1. User klik tombol hapus pada preview salah satu aset.
2. Param `{asset}` divalidasi whitelist: `logo`, `letter_head`, `signature`, `stamp` — selain itu 404.
3. File dihapus dari disk `public` (jika ada), kolom `{asset}_path` di-null-kan, save.
4. Flash "File berhasil dihapus."

### Model `CompanyProfile` — Singleton, Base64, Abbreviation

**Penjelasan kode** (`app/Models/CompanyProfile.php`):

- `CompanyProfile::current()` = `static::first()` — pola singleton; seluruh service PDF memanggil ini.
- Accessor `logo_base64`, `signature_base64`, `letter_head_base64`, `stamp_base64` membaca file dari `public_path()` dan mengembalikan `data:image/png;base64,...` — dipakai template Blade PDF agar DomPDF tidak perlu HTTP fetch:

```php
public function getLogoBase64Attribute(): string
{
    if (! $this->logo_path) { return ''; }
    $fullPath = public_path($this->logo_path);
    return file_exists($fullPath)
        ? 'data:image/png;base64,'.base64_encode(file_get_contents($fullPath))
        : '';
}
```

- `computed_abbreviation` untuk nomor dokumen (mis. `001/KSN/I/2026`): pakai kolom `abbreviation` jika terisi, jika tidak auto-generate dari inisial kata bermakna pada nama (skip `PT`, `CV`, `TBK`, dst.):

```php
// "PT. Semesta Pertambangan Indonesia" → "SPI"
$filtered = array_filter($words, fn ($word) => ! in_array(strtoupper($word), $skipWords));
$initials = array_map(fn ($word) => strtoupper(substr($word, 0, 1)), $filtered);
return implode('', $initials) ?: 'CO';
```

### PDF Template Builder — Daftar Template (`GET /settings/pdf-templates`)

Seluruh grup route ini bermiddleware `can:manage pdf templates` (`routes/web.php` baris 539).

**Alur step-by-step:**
1. `PdfTemplateController::index()` memuat semua template diurutkan default dulu, lalu nama.
2. Render `settings/pdf-templates/index` (React) dengan `id`, `name`, `description`, `is_default`, `updated_at`.

### Buat / Update Metadata / Hapus Template

**Alur step-by-step:**
1. **Store** (`POST /settings/pdf-templates`): validasi `name` + `description`; membuat template dengan `layout => []`, `is_default => false`; redirect langsung ke halaman editor (`settings.pdf-templates.edit`).
2. **Update** (`PUT /settings/pdf-templates/{pdfTemplate}`): ganti nama/deskripsi; jika request `is_default=true` → panggil `setAsDefault()`.
3. **Destroy** (`DELETE .../{pdfTemplate}`): hapus baris lalu redirect ke index.

### Duplicate & Set Default

**Alur step-by-step:**
1. **Duplicate** (`POST .../{pdfTemplate}/duplicate`): membuat salinan dengan nama `"{nama} (Salinan)"`, layout di-copy utuh, `is_default => false`, lalu redirect ke editor salinan.
2. **Set default** (`POST .../{pdfTemplate}/set-default`): `PdfTemplate::setAsDefault()` menegakkan keunikan — semua template lain di-set `is_default = false` dulu:

```php
// app/Models/PdfTemplate.php
public function setAsDefault(): void
{
    static::query()->where('id', '!=', $this->id)->update(['is_default' => false]);
    $this->update(['is_default' => true]);
}
```

### Editor WYSIWYG (`GET /settings/pdf-templates/{pdfTemplate}/edit`)

**Alur step-by-step:**
1. `PdfTemplateController::edit()` memilih invoice preview via `resolvePreviewInvoice()` — invoice terbaru di DB, atau sample in-memory (`TemplateTokens::sampleInvoice()`) bila DB kosong.
2. Controller membangun: `tokenCatalog` (daftar token `{{...}}` yang bisa dipakai), `sampleData` (token → nilai resolved), `itemColumnCatalog` + `sampleItems` (untuk elemen tabel), dan `customFonts` (id, name, browser URL untuk `@font-face` di editor).
3. Render halaman React `settings/pdf-templates/edit` — canvas drag-and-drop dengan band header/content/footer.
4. User menyusun elemen (text dengan token, image, grid, table, rect, line) lalu klik Simpan.

### Simpan Layout (`POST /settings/pdf-templates/{pdfTemplate}/save`)

**Alur step-by-step:**
1. Frontend mengirim `{ layout }` — dua bentuk didukung.
2. Jika layout punya key `bands` (model **banded**): validasi ketat `layout.paper.margins.top/right/bottom/left` numeric dan keempat band (`header`, `content`, `footerFlow`, `footerFixed`) wajib array.
3. Jika tidak (layout **legacy** flat-array): cukup `layout` present+array.
4. `$pdfTemplate->update(['layout' => $layout])` → flash "Layout tersimpan."

### Render PDF (`GET /settings/pdf-templates/{pdfTemplate}/pdf[/{invoice}]`)

**Alur step-by-step:**
1. Tanpa param invoice → pakai invoice terbaru / sample; dengan param → invoice tersebut.
2. Custom fonts dimuat sebagai `{name, path}` (path disk untuk DomPDF `@font-face`).
3. Layout banded → `pdfBanded()`: resolve token teks & grid per band via `TemplateTokens::resolveText()`, tabel item via `ItemColumns::resolveItems()` (atau mode TRB row-band bila `rows` array), footerFixed dirender `position:fixed` tiap halaman. Query `?items=N` (1–200) menghasilkan N sample row untuk uji paginasi.
4. Layout legacy → map flat elements (text/table/grid/image) lalu render.
5. Keduanya berakhir `Pdf::loadView('pdf.template-builder', [...])->setPaper('A4', 'portrait')->stream('template.pdf')`.

### Render Invoice Produksi via Builder — `BuilderInvoicePrinter`

Download invoice (`GET /invoice/{invoice}/download?template=builder:{id}`) dan preview di modul Invoice mendeteksi prefix `builder:`:

```php
// routes/web.php
if (str_starts_with((string) $template, 'builder:')) {
    $templateId = (int) substr((string) $template, 8);
    $pdfTemplate = PdfTemplate::findOrFail($templateId);
    $pdf = $printer->render($pdfTemplate, $invoice, $dpAmount, $pelunasanAmount);
}
```

`app/Services/BuilderInvoicePrinter.php::render(PdfTemplate, Invoice, ?int $dpAmount, ?int $pelunasanAmount)` menentukan `paymentContext` mode `full` / `dp` / `pelunasan` (nominal integer rupiah penuh), me-resolve token dengan konteks pembayaran itu, memuat custom fonts, dan mengembalikan instance DomPDF siap stream/download.

### Pustaka Custom Font Global (`/settings/pdf-templates/custom-fonts`)

**Alur step-by-step (upload):**
1. Di editor, user membuka pengelola font → `POST /settings/pdf-templates/custom-fonts` dengan `name` + `file`.
2. Validasi (`CustomFontController::store`): `name` unique di `custom_fonts` max 80; `file` max 5 MB, mimetypes varian TTF/SFNT, plus closure yang menolak ekstensi selain `.ttf`.
3. Filename deterministik `{slug}_{hash8}.ttf` disimpan ke disk public `fonts/custom/`.
4. `CustomFont::create(['name', 'filename'])` → flash sukses. Font muncul di picker editor (browser URL) dan di PDF (disk path — berada dalam chroot DomPDF karena `storage/app/public` di bawah project root).

**Alur step-by-step (list & delete):**
- `GET .../custom-fonts` mengembalikan JSON `{id, name, url}` (fallback; editor utamanya menerima daftar via prop Inertia dari `edit()`).
- `DELETE .../custom-fonts/{customFont}` menghapus file dari disk lalu baris DB.

### Redirect Route Lama (`/template-builder-test`)

`GET /template-builder-test` sekarang **redirect** ke `settings.pdf-templates.index`. `POST /template-builder-test` dan `GET /template-builder-test/pdf` masih menunjuk `TemplateBuilderController` (sandbox lama: satu baris template "Sandbox", token dari konstanta `SAMPLE`, elemen `text|image` saja) — legacy, bukan jalur produksi.

## Keterkaitan Antar Modul

- **Invoice/PDF**: `InvoicePrintService` dan template Blade `resources/views/pdf/*.blade.php` memakai `CompanyProfile::current()` + accessor base64 (logo/letterhead/signature/stamp) dan `ppn_rate`/`is_pkp`/`npwp` untuk perhitungan & tampilan pajak.
- **Fund Request**: nomor dokumen `001/KSN/I/2026` memakai `computed_abbreviation`.
- **Invoice download/preview** menerima `template=builder:{id}` → `BuilderInvoicePrinter` (lihat `routes/web.php` baris 158–196).
- **Permissions**: `manage pdf templates` didefinisikan di `MasterPermissionSeeder` (hanya admin).
- **Header React** (`resources/js/layouts/header.tsx`): switcher bahasa memanggil `POST /language` yang menyimpan `locale` ke session — dibaca `HandleInertiaRequests` sebagai prop `locale`.

## Invarian & Jebakan

- **CompanyProfile adalah singleton** — selalu `current()`/`first()`/`firstOrNew()`; jangan pernah membuat baris kedua.
- **Hanya satu template `is_default`** — selalu ubah lewat `setAsDefault()`, jangan update kolom langsung.
- Accessor base64 membaca dari `public_path($path)` sementara upload disimpan ke disk `public` (`storage/app/public/images/...`) — **symlink `php artisan storage:link` wajib ada**; tanpa itu PDF kehilangan logo/tanda tangan.
- Upload aset **menghapus file lama** — tidak ada versi/riwayat; nama file diberi timestamp agar URL berubah (cache-buster tambahan `?v=filemtime`).
- Layout template punya **dua skema** (banded vs legacy flat-array) — semua kode yang membaca `layout` harus cabang pada keberadaan key `bands`.
- Custom font **global** (dipakai semua template) — menghapus font yang masih direferensikan layout membuat teks jatuh ke font default DomPDF.
- Validasi font double-layer: mimetypes longgar (`application/octet-stream` diterima) namun ekstensi wajib `.ttf` — jangan hapus salah satunya.
- `ppn_rate` disimpan `decimal:2` (persen, 0–100), **bukan** nilai uang — jangan ikut aturan integer rupiah.
- Hapus akun di profil = hard delete user beserta relasi permission via cascade Spatie — tidak ada soft delete.
- Route `custom-fonts` berada **di dalam** prefix `pdf-templates` — URL penuhnya `/settings/pdf-templates/custom-fonts` dan ikut tergate `manage pdf templates`.

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (baris 521–556 — blok settings; 109–111 redirect sandbox; 155–196 download builder)
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\ProfileController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\PasswordController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\CompanyController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\PdfTemplateController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Settings\CustomFontController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\TemplateBuilderController.php` (sandbox legacy)
- `d:\Laravel\finance-management\app\Http\Requests\Settings\UpdateCompanyRequest.php`
- `d:\Laravel\finance-management\app\Models\CompanyProfile.php`, `PdfTemplate.php`, `CustomFont.php`
- `d:\Laravel\finance-management\app\Services\BuilderInvoicePrinter.php`, `TemplateTokens.php`, `ItemColumns.php`
- `d:\Laravel\finance-management\resources\views\pdf\template-builder.blade.php`
- `d:\Laravel\finance-management\resources\js\pages\settings\profile.tsx`, `password.tsx`, `company.tsx`, `pdf-templates\`
- Tests: `d:\Laravel\finance-management\tests\Feature\Settings\ProfileUpdateTest.php`, `PasswordUpdateTest.php`, `tests\Feature\PdfTemplate*Test.php`, `TemplateBuilderControllerTest.php`
