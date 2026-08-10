# Modul: Feedbacks

> Sistem umpan balik internal: user melaporkan bug, mengajukan fitur, atau memberi saran lewat tombol feedback melayang yang ada di semua halaman; admin meninjau di halaman `/feedbacks` (tab All/My), menanggapi, dan mengubah status `open → in_progress → resolved → closed`. Route prefix `/feedbacks`, digate permission `view feedbacks` (grup) plus `create/edit/delete/respond/manage feedbacks` per aksi.

## Tabel Database

| Tabel | Kolom | Keterangan |
|-------|-------|------------|
| `feedbacks` | `user_id`, `title`, `description`, `type` enum(`bug`,`feature`,`feedback`), `priority` enum(`low`,`medium`,`high`,`critical`), `status` enum(`open`,`in_progress`,`resolved`,`closed`), `page_url`, `attachment_path`, `attachment_name`, `admin_response`, `responded_by` (FK users), `responded_at` | Nama tabel eksplisit `protected $table = 'feedbacks'`. Lampiran di disk `public` folder `feedbacks/`. |

## Model `Feedback` (`app/Models/Feedback.php`) — Ringkasan Perilaku

- **Relasi**: `user()` (pengirim), `responder()` (`belongsTo User, 'responded_by'`).
- **Scopes**: `forUser`, `byStatus`, `byType`, `byPriority`, `open`, `pending` (open + in_progress).
- **State machine ringan**: `canEdit()` dan `canDelete()` hanya saat `status === 'open'`; `canRespond()` saat `open` atau `in_progress`.
- **Aksi**: `respond($responderId, $response, $newStatus)` mengisi `admin_response`, `responded_by`, `responded_at` (+ status bila diberikan); `changeStatus($status)`.
- **Sanitasi**: accessor `safe_description` / `safe_admin_response` — `strip_tags` dengan whitelist tag rich-text (`<p><br><strong><em>...`), dipakai saat menampilkan detail.
- **Lampiran**: `attachment_url` (`Storage::url`), deteksi `isImageAttachment()`/`isPdfAttachment()`; hook `static::deleting` **menghapus file dari storage** saat feedback dihapus.
- **Katalog UI**: `types()`, `priorities()`, `statuses()` mengembalikan opsi berlabel `__('feedback.*')` (i18n server-side), plus accessor warna/icon badge per type/priority/status.

## Fitur

### Tombol Feedback Melayang (semua halaman)

**Alur step-by-step:**
1. `resources/js/layouts/app-layout.tsx` me-render `<FloatingFeedbackButton />` di setiap halaman aplikasi (tombol bulat kanan-bawah, `fixed bottom-6 right-6`).
2. Klik tombol → Dialog form: `SegmentedControl` tipe (Bug/Fitur/Saran) dan prioritas (Rendah–Kritis), `Input` judul, `Textarea` deskripsi, `FileUpload` lampiran (jpg/jpeg/png/pdf, max 5 MB).
3. Saat dialog terbuka, `page_url` **otomatis diisi** `window.location.pathname` — admin jadi tahu di halaman mana masalah terjadi.
4. Submit → `post('/feedbacks', { forceFormData: true })`; sukses → toast Sonner + reset form.

**Penjelasan kode** (`resources/js/components/floating-feedback-button.tsx`):

```tsx
React.useEffect(() => {
    if (open) {
        setData('page_url', window.location.pathname);
    } else {
        clearErrors();
    }
}, [open]);
```

### Buat Feedback (`POST /feedbacks`)

**Alur step-by-step:**
1. Request dari floating button (atau halaman feedbacks) → middleware `can:view feedbacks` (grup) + `can:create feedbacks`.
2. Validasi `StoreFeedbackRequest` (`app/Http/Requests/StoreFeedbackRequest.php`): `title` max 255, `description` max 5000, `type` in `bug,feature,feedback`, `priority` in `low,medium,high,critical`, `page_url` nullable max 500, `attachment` nullable file `mimes:jpg,jpeg,png,pdf` max 5120 KB.
3. Dalam `DB::transaction`: file (bila ada) disimpan `$file->store('feedbacks', 'public')` dengan nama asli disimpan di `attachment_name`; `Feedback::create()` dengan `user_id = auth()->id()` dan `status = 'open'`.
4. `notifyAdmins($feedback)`: loop semua user role `admin`/`finance manager` → `AppNotification::notify(..., 'feedback_submitted', ...)` berisi `{feedback_id, url}`.
5. Redirect back + flash "Feedback berhasil dikirim. Terima kasih atas masukannya."

**Penjelasan kode** (`app/Http/Controllers/FeedbackController.php`):

```php
$feedback = Feedback::create([
    'user_id' => auth()->id(),
    'title' => $validated['title'],
    'description' => $validated['description'],
    'type' => $validated['type'],
    'priority' => $validated['priority'],
    'page_url' => $validated['page_url'] ?? null,
    'attachment_path' => $attachmentPath,
    'attachment_name' => $attachmentName,
    'status' => 'open',
]);
$this->notifyAdmins($feedback);
```

### Daftar Feedback — Tab All / My (`GET /feedbacks`)

**Alur step-by-step:**
1. User membuka Administrasi → Feedback → middleware `can:view feedbacks`.
2. `FeedbackController::index()` menghitung `$canManage = $user->can('manage feedbacks')`.
3. Tab default: `all` untuk pengelola, `mine` untuk lainnya. **Tab All hanya efektif jika `canManage`** — selain itu query selalu `Feedback::forUser($user->id)` (staff mustahil melihat feedback orang lain walau memaksa `?tab=all`).
4. Filter: `search` (title/description/nama user), `status`, `type`, `priority`; sorting + paginasi `withQueryString()`.
5. Stats dihitung satu query `selectRaw` (total, open, in_progress, resolved, bugs, features, feedbacks) dengan scope sama seperti tab.
6. Render `feedbacks/index` (React `resources/js/pages/feedbacks/index.tsx`) dengan prop `canManage`, `canRespond`, dan `showFeedback` — detail feedback dimuat server-side bila ada query `?show={id}` (juga di-scope kepemilikan bila bukan pengelola).
7. Tiap baris membawa flag `can_edit` / `can_delete` (milik sendiri + status open) dan `can_respond` untuk gating tombol di UI.

**Penjelasan kode:**

```php
$baseQuery = ($canManage && $tab === 'all')
    ? Feedback::query()
    : Feedback::forUser($user->id);
```

### Edit Feedback (`PUT /feedbacks/{feedback}`)

**Alur step-by-step:**
1. Pemilik membuka dialog edit (tombol hanya muncul jika `can_edit`).
2. Middleware `can:edit feedbacks` → guard controller: `abort_unless($feedback->user_id === auth()->id() && $feedback->canEdit(), 403)` — hanya **pemilik** dan hanya selama status masih `open` (belum diproses admin).
3. Validasi `UpdateFeedbackRequest` → `$feedback->update($validated)`.
4. Redirect back + flash "Feedback berhasil diperbarui."

### Hapus Feedback (`DELETE /feedbacks/{feedback}`)

**Alur step-by-step:**
1. Middleware `can:delete feedbacks`.
2. Guard: boleh dihapus oleh **pemilik** ATAU siapa pun dengan `manage feedbacks`; jika pemilik tetapi status bukan `open` → flash error "Feedback yang sudah diproses tidak dapat dihapus." (pengelola tetap boleh menghapus status apa pun).
3. `$feedback->delete()` — hook `deleting` di model otomatis menghapus file lampiran dari storage.
4. Redirect back + flash success.

**Penjelasan kode:**

```php
abort_unless($feedback->user_id === auth()->id() || auth()->user()->can('manage feedbacks'), 403);

if ($feedback->user_id === auth()->id() && ! $feedback->canDelete()) {
    return redirect()->back()->with('error', 'Feedback yang sudah diproses tidak dapat dihapus.');
}
```

### Tanggapi Feedback (`POST /feedbacks/{feedback}/respond`)

**Alur step-by-step:**
1. Admin/FM membuka detail feedback → menulis tanggapan + memilih status baru.
2. Middleware `can:respond feedbacks` + guard ganda di controller: `can('respond feedbacks')` dan `$feedback->canRespond()` (hanya `open`/`in_progress` — feedback resolved/closed tidak bisa ditanggapi lagi).
3. Validasi `RespondFeedbackRequest`: `response` max 5000, `status` in `in_progress,resolved,closed` (respond selalu memajukan status, tidak boleh kembali ke `open`).
4. `$feedback->respond(auth()->id(), $response, $status)` mengisi `admin_response`, `responded_by`, `responded_at`, `status`.
5. `AppNotification::notify($feedback->user_id, 'feedback_responded', ...)` — pemilik mendapat notifikasi bell.
6. Redirect back + flash "Tanggapan berhasil dikirim."

**Penjelasan kode** (`app/Models/Feedback.php`):

```php
public function respond(int $responderId, string $response, ?string $newStatus = null): bool
{
    $data = [
        'admin_response' => $response,
        'responded_by' => $responderId,
        'responded_at' => now(),
    ];
    if ($newStatus) {
        $data['status'] = $newStatus;
    }
    return $this->update($data);
}
```

### Ubah Status (`POST /feedbacks/{feedback}/status`)

**Alur step-by-step:**
1. Pengelola mengubah status langsung dari daftar/detail (tanpa menulis tanggapan).
2. Middleware `can:manage feedbacks` + guard `abort_unless(...can('manage feedbacks'), 403)`.
3. Validasi `ChangeStatusFeedbackRequest`: `status` in `open,in_progress,resolved,closed` — endpoint ini **boleh** mengembalikan ke `open` (berbeda dari respond).
4. `$feedback->changeStatus($status)` → flash "Status feedback diperbarui."

## Permission Matrix (dari `MasterPermissionSeeder`)

| Permission | admin | finance manager | staff | Fungsi |
|---|---|---|---|---|
| `view feedbacks` | ✓ | ✓ | ✓ | Akses halaman (staff otomatis ter-scope miliknya) |
| `create feedbacks` | ✓ | ✓ | ✓ | Kirim feedback (floating button) |
| `edit feedbacks` | ✓ | ✓ | ✓ | Edit milik sendiri saat masih `open` |
| `delete feedbacks` | ✓ | ✓ | ✓ | Hapus (pemilik saat open / pengelola kapan pun) |
| `respond feedbacks` | ✓ | ✓ | ✗ | Menulis `admin_response` |
| `manage feedbacks` | ✓ | ✓ | ✗ | Tab All, ubah status, hapus feedback siapa pun |

## Keterkaitan Antar Modul

- **Notifications**: create → `feedback_submitted` ke semua admin/FM; respond → `feedback_responded` ke pemilik. `data.url` menunjuk `route('feedbacks.index')` sehingga klik notifikasi membuka halaman feedback.
- **Permissions/Roles**: penerima broadcast dicari via `User::role(['admin', 'finance manager'])`; seluruh gating memakai permission `... feedbacks` dari `MasterPermissionSeeder`.
- **Layout React**: `FloatingFeedbackButton` dipasang di `resources/js/layouts/app-layout.tsx` — muncul di semua halaman ber-layout aplikasi.
- **i18n**: label type/priority/status dari `lang/*/feedback.php` (`__('feedback.type_bug')`, dst.).
- **Storage**: lampiran di disk `public` (`feedbacks/`), diakses via `Storage::url` — butuh `php artisan storage:link`.

## Invarian & Jebakan

- **Scoping kepemilikan dua lapis**: permission route + scope query (`forUser`) + guard `abort_unless` di controller. Staff dengan `view feedbacks` tetap tidak pernah melihat feedback user lain.
- **Edit/hapus pemilik hanya saat `open`** — begitu admin memproses (in_progress dst.), pemilik kehilangan kendali; hanya pengelola yang bisa menghapus.
- **`respond` vs `changeStatus`**: respond hanya untuk status maju (`in_progress|resolved|closed`) dan mensyaratkan `canRespond()`; changeStatus bebas keempat status termasuk kembali ke `open`, tetapi butuh `manage feedbacks`.
- **Tampilkan deskripsi lewat `safe_description` / `safe_admin_response`** — jangan render `description` mentah (mengandung HTML user, sanitasi whitelist ada di model).
- Hapus feedback otomatis menghapus lampirannya (hook `deleting`) — jangan hapus baris via query builder massal (`Feedback::where(...)->delete()`) karena hook model tidak terpanggil dan file yatim tertinggal.
- `page_url` diisi otomatis oleh frontend dari `window.location.pathname` — nullable, jangan diasumsikan selalu ada.
- Notifikasi ke admin dikirim **di dalam transaksi** create — gagal notifikasi menggagalkan pembuatan feedback (rollback).
- Nama tabel `feedbacks` dideklarasikan eksplisit karena bukan bentuk jamak standar Laravel (`feedback`).

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (baris 417–436 — blok feedbacks)
- `d:\Laravel\finance-management\app\Http\Controllers\FeedbackController.php`
- `d:\Laravel\finance-management\app\Models\Feedback.php`
- `d:\Laravel\finance-management\app\Http\Requests\StoreFeedbackRequest.php`, `UpdateFeedbackRequest.php`, `RespondFeedbackRequest.php`, `ChangeStatusFeedbackRequest.php`
- `d:\Laravel\finance-management\resources\js\components\floating-feedback-button.tsx`
- `d:\Laravel\finance-management\resources\js\layouts\app-layout.tsx` (mount floating button)
- `d:\Laravel\finance-management\resources\js\pages\feedbacks\index.tsx`
- `d:\Laravel\finance-management\lang\id\feedback.php` (label i18n)
- `d:\Laravel\finance-management\tests\Feature\FeedbackControllerTest.php`
