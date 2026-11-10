# Modul: Masukan (Feedbacks)

> Sistem umpan balik internal: user melaporkan bug, mengajukan fitur, atau memberi saran lewat tombol feedback melayang yang ada di semua halaman; admin meninjau di halaman `/feedbacks` (tab All/My), menanggapi, dan mengubah status `open → in_progress → resolved → closed`. Route prefix `/feedbacks`, digate permission `view feedbacks` (grup) plus `create/edit/delete/respond/manage feedbacks` per aksi. Laporan bertipe **Bug** juga diteruskan ke **Watchpost** (pemantau error tim IT) menjadi tiket, lewat antrean (lihat "Penerusan ke Watchpost").

## Tabel Database

| Tabel | Kolom | Keterangan |
|-------|-------|------------|
| `feedbacks` | `user_id`, `company_id` (slug perusahaan, tanpa FK), `title`, `description`, `type` enum(`bug`,`feature`,`feedback`), `priority` enum(`low`,`medium`,`high`,`critical`), `status` enum(`open`,`in_progress`,`resolved`,`closed`), `page_url` (≤2000: path + query + `#hash`), `trace_id` (uuid Watchpost, dari halaman error), `error_id` (`ERR-…` halaman error), `breadcrumbs` (json, jejak langkah dari skrip browser Watchpost), `user_agent`, `attachment_path`, `attachment_name`, `watchpost_ticket_id`, `watchpost_ticket_number` (`#12`), `watchpost_ticket_url`, `admin_response`, `responded_by` (FK users), `responded_at` | Tabel di database **pusat** (`CentralConnection`); isolasi per perusahaan hanya lewat `company_id` + `scopeForCurrentCompany()`. Nama tabel eksplisit `protected $table = 'feedbacks'`. Lampiran di disk `public` folder `feedbacks/`, yang di dalam `/c/{company}` menunjuk storage perusahaan (`storage/tenant{slug}/app/public`). |

## Model `Feedback` (`app/Models/Feedback.php`) — Ringkasan Perilaku

- **Relasi**: `user()` (pengirim), `responder()` (`belongsTo User, 'responded_by'`).
- **Scopes**: `forUser`, `byStatus`, `byType`, `byPriority`, `open`, `pending` (open + in_progress).
- **State machine ringan**: `canEdit()` dan `canDelete()` hanya saat `status === 'open'`; `canRespond()` saat `open` atau `in_progress`.
- **Aksi**: `respond($responderId, $response, $newStatus)` mengisi `admin_response`, `responded_by`, `responded_at` (+ status bila diberikan); `changeStatus($status)`.
- **Sanitasi**: accessor `safe_description` / `safe_admin_response` — `strip_tags` dengan whitelist tag rich-text (`<p><br><strong><em>...`), dipakai saat menampilkan detail.
- **Lampiran**: `attachment_url` (`Storage::url`), deteksi `isImageAttachment()`/`isPdfAttachment()`; hook `static::deleting` **menghapus file dari storage** saat feedback dihapus.
- **Katalog UI**: `types()`, `priorities()`, `statuses()` mengembalikan opsi berlabel `__('feedback.*')` (i18n server-side), plus accessor warna/icon badge per type/priority/status.

## Fitur

### Tombol Masukan Melayang (semua halaman)

**Alur step-by-step:**
1. `resources/js/layouts/app-layout.tsx` me-render `<FloatingFeedbackButton />` di setiap halaman aplikasi (tombol bulat kanan-bawah, `fixed bottom-6 right-6`).
2. Klik tombol → Dialog form: `SegmentedControl` tipe (Bug/Fitur/Saran) dan prioritas (Rendah–Kritis), `Input` judul, `Textarea` deskripsi, `FileUpload` lampiran (jpg/jpeg/png/pdf, max 5 MB).
3. Saat dialog terbuka, `page_url` **otomatis diisi** `currentPageUrl()` (`resources/js/lib/watchpost.ts`): path + query + `#hash`, jadi detail yang terbuka sebagai modal (`#invoice/12`) dan filter aktif ikut tercatat.
4. Submit → `transform()` menambahkan `breadcrumbs` dari `watchpostTrail()` (langkah terakhir di tab itu, dari skrip browser package Watchpost; kosong bila Watchpost tidak aktif), lalu `post('/feedbacks', { forceFormData: true })`; sukses → toast Sonner + reset form.

**Penjelasan kode** (`resources/js/components/floating-feedback-button.tsx`):

```tsx
React.useEffect(() => {
    if (open) {
        setData('page_url', currentPageUrl());
    } else {
        clearErrors();
    }
}, [open]);
```

### Buat Masukan (`POST /feedbacks`)

**Alur step-by-step:**
1. Request dari floating button (atau halaman feedbacks) → middleware `can:view feedbacks` (grup) + `can:create feedbacks`.
2. Validasi `StoreFeedbackRequest` (`app/Http/Requests/StoreFeedbackRequest.php`): `title` max 255, `description` max 5000, `type` in `bug,feature,feedback`, `priority` in `low,medium,high,critical`, `page_url` nullable max 2000, `trace_id` nullable uuid, `error_id` nullable `ERR-` + 10 huruf/angka kapital, `breadcrumbs` nullable array ≤50 (`type` in `page,click,submit,request`, `label` ≤200, `at` tanggal), `attachment` nullable file `mimes:jpg,jpeg,png,pdf` max 5120 KB. `UpdateFeedbackRequest` membuang semua field konteks ini (milik saat laporan dikirim, bukan bahan edit).
3. Dalam `DB::transaction`: file (bila ada) disimpan `$file->store('feedbacks', 'public')` dengan nama asli disimpan di `attachment_name`; `Feedback::create()` dengan `user_id = auth()->id()`, `company_id = tenant()`, konteks di atas, `user_agent` dari request, dan `status = 'open'`.
4. `notifyAdmins($feedback)`: user role `admin`/`finance manager` **anggota perusahaan ini** (`memberOfCurrentCompany()`) → `AppNotification::notify(..., 'feedback_submitted', ...)` berisi `{feedback_id, url}`. Tanpa cakupan itu judul feedback bocor ke admin perusahaan lain.
5. Bila `type = bug`: `KirimLaporanBugKeWatchpost::dispatch($feedback->id)` setelah transaksi (lihat bagian berikut).
6. Redirect back + flash "Masukan berhasil dikirim. Terima kasih."
   **Kecuali** request meminta JSON (`wantsJson()`) → `201 {"id": <feedback_id>}`. Dipakai tombol
   "Laporkan ke Tim IT" di halaman error (`useHttp`): redirect `back()` di sana justru memuat ulang
   halaman yang sedang error. Laporan dari halaman error berupa `type=bug`, `priority` `high` untuk
   5xx / `medium` untuk lainnya, dengan deskripsi Markdown berisi ID referensi `ERR-…`, plus
   `error_id` (ID yang sama), `trace_id` (prop `report.trace_id` dari `Watchpost::traceId()`, trace
   request yang error itu) dan `breadcrumbs` (`watchpostTrail()` saat tombol ditekan). Berkat
   `trace_id`, laporan ini menempel ke tiket error yang sama di Watchpost.

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

### Penerusan ke Watchpost (laporan Bug)

Watchpost adalah panel pemantau error tim IT (`kisantra/watchpost-laravel` ≥ 1.2, `WATCHPOST_URL`/`WATCHPOST_TOKEN` di `.env`, lihat `docs/guides/DEPLOY.md`). Laporan **Bug** dikirim ke `POST {WATCHPOST_URL}/api/ingest/tickets` agar tim bekerja di satu tempat; Fitur dan Saran tetap hanya di aplikasi.

**Alur step-by-step** (`app/Jobs/KirimLaporanBugKeWatchpost.php`):
1. `store()` men-dispatch job berisi **ID** feedback (bukan model) setelah feedback tersimpan. Di produksi job masuk antrean `database`; `QueueTenancyBootstrapper` memulihkan konteks perusahaan di worker, sehingga disk `public` menunjuk storage perusahaan pemilik lampiran.
2. `handle()` berhenti bila `Watchpost::reportsBugs()` false (environment bukan `production`, URL/token kosong, atau `WATCHPOST_TICKETS=false`), bila feedback sudah dihapus, bukan bug, atau sudah punya `watchpost_ticket_id`.
3. Menyusun `BugReport`: `reference = "feedback-{id}"` (ID unik se-instalasi, tabel pusat), judul, deskripsi apa adanya, pelapor (nama + email user pusat), prioritas dipetakan `low→low`, `medium→normal`, `high→high`, `critical→urgent`, `company = "{nama} ({slug})"`, `page_url`, `trace_id`, `error_id`, `breadcrumbs`, `user_agent`, dan path lampiran bila berkasnya ada. Package menambahkan platform asal (`APP_NAME`, `APP_URL`, environment, commit).
4. Watchpost menjawab tiket: baru (tipe Perbaikan bug), atau tiket error yang sama bila `trace_id` cocok. Job menyimpan `watchpost_ticket_id`, `watchpost_ticket_number`, `watchpost_ticket_url`.
5. Belum terkirim (`reportBug()` = `null`: Watchpost mati, menolak, timeout) → `release()` dengan jeda 1 menit, 5 menit, 15 menit, 1 jam; `tries = 5`; `failed()` mencatat `Log::warning`. Feedback-nya tidak pernah ikut gagal. Mengirim ulang aman: Watchpost mengembalikan tiket yang sama untuk `reference` yang sama.

**Kode ERR di setiap error.** `AppServiceProvider` mendaftarkan `Watchpost::context()` berisi `error_id` (`ErrorReportService::referenceId()`, sama dengan yang tampil di halaman error dan di `laravel.log`; hanya untuk request web) dan `company` (slug). Laporan pengguna "muncul ERR-…" bisa dicari di detail error Watchpost.

**Di layar.** Detail feedback menampilkan "Diteruskan ke Watchpost: tiket #12 · status mengikuti tiket ini" (tautan) **hanya** untuk pemegang `manage feedbacks`; prop `showFeedback.watchpost` bernilai `null` untuk yang lain.

### Status dari Watchpost kembali ke pelapor (Fase 2)

**Alur step-by-step:**
1. Scheduler menjalankan `watchpost:sync-tickets` (package ≥ 1.3) tiap menit, di **konteks pusat** (tanpa tenancy). Command itu menarik `GET {WATCHPOST_URL}/api/ingest/tickets/updates?since=…` (kursor di cache `watchpost:tickets:since`) dan memicu event `Kisantra\Watchpost\Events\TicketUpdated` per tiket yang berubah. Watchpost hanya ditanya bila ada listener.
2. `App\Listeners\PerbaruiFeedbackDariWatchpost` (ditemukan otomatis oleh event discovery) mengambil ID dari `references` (`feedback-{id}`), lalu memperbarui feedback `type = bug` yang `watchpost_ticket_id`-nya sama dengan tiket itu **atau masih kosong** (job pengirim belum sempat mencatat).
3. Status dipetakan `open→open`, `in_progress→in_progress`, `resolved→resolved`, `ignored→closed`; nomor & URL tiket ikut diperbarui (laporan bisa menempel ke tiket error).
4. Hanya bila statusnya **berubah**: notifikasi `feedback_responded` "Laporan Bug Diperbarui" ke pelapor, dengan `company_id` = perusahaan feedback (parameter baru `AppNotification::notify(..., $companyId)`, karena listener berjalan tanpa tenant) dan tautan `/c/{company}/feedbacks?show={id}`. Tiket yang sama sering datang berulang (komentar, detik kursor); perbandingan status mencegah notifikasi ganda.

**Status bug yang sudah diteruskan hanya baca di aplikasi** (`Feedback::statusIkutWatchpost()` = bug + `watchpost_ticket_id` terisi):
- `POST /feedbacks/{id}/status` ditolak dengan flash error "Status laporan ini mengikuti tiket Watchpost #12 dan diatur tim IT di sana."; dropdown **Ubah Status** disembunyikan.
- **Tanggapi** tetap bisa: `RespondFeedbackRequest` tidak mewajibkan `status` untuk bug yang diteruskan dan controller mengabaikan status kiriman; dialog menampilkan catatan, bukan pilihan status. Prop `showFeedback.status_ikut_watchpost` untuk semua pengguna.

### Daftar Masukan — Tab All / My (`GET /feedbacks`)

**Alur step-by-step:**
1. User membuka Administrasi → Masukan → middleware `can:view feedbacks`.
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

### Ubah Masukan (`PUT /feedbacks/{feedback}`)

**Alur step-by-step:**
1. Pemilik membuka dialog edit (tombol hanya muncul jika `can_edit`).
2. Middleware `can:edit feedbacks` → guard controller: `abort_unless($feedback->user_id === auth()->id() && $feedback->canEdit(), 403)` — hanya **pemilik** dan hanya selama status masih `open` (belum diproses admin).
3. Validasi `UpdateFeedbackRequest` → `$feedback->update($validated)`.
4. Redirect back + flash "Masukan berhasil diperbarui."

### Hapus Masukan (`DELETE /feedbacks/{feedback}`)

**Alur step-by-step:**
1. Middleware `can:delete feedbacks`.
2. Guard: boleh dihapus oleh **pemilik** ATAU siapa pun dengan `manage feedbacks`; jika pemilik tetapi status bukan `open` → flash error "Masukan yang sudah diproses tidak dapat dihapus." (pengelola tetap boleh menghapus status apa pun).
3. `$feedback->delete()` — hook `deleting` di model otomatis menghapus file lampiran dari storage.
   Catatan UI: tombol **Hapus** di dialog detail hanya tampil bila `can_delete` (pemilik + `open`); hak pengelola menghapus feedback siapa pun hanya bisa dipakai lewat endpoint, tidak ada tombolnya di layar.
4. Redirect back + flash success.

**Penjelasan kode:**

```php
abort_unless($feedback->user_id === auth()->id() || auth()->user()->can('manage feedbacks'), 403);

if ($feedback->user_id === auth()->id() && ! $feedback->canDelete()) {
    return redirect()->back()->with('error', 'Masukan yang sudah diproses tidak dapat dihapus.');
}
```

### Tanggapi Masukan (`POST /feedbacks/{feedback}/respond`)

**Alur step-by-step:**
1. Admin/FM membuka detail feedback → menulis tanggapan + memilih status baru.
2. Middleware `can:respond feedbacks` + guard ganda di controller: `can('respond feedbacks')` dan `$feedback->canRespond()` (hanya `open`/`in_progress` — feedback resolved/closed tidak bisa ditanggapi lagi).
3. Validasi `RespondFeedbackRequest`: `response` max 5000, `status` in `in_progress,resolved,closed` (respond selalu memajukan status, tidak boleh kembali ke `open`).
4. `$feedback->respond(auth()->id(), $response, $status)` mengisi `admin_response`, `responded_by`, `responded_at`, `status`.
5. `AppNotification::notify($feedback->user_id, 'feedback_responded', ...)` — pemilik mendapat notifikasi bell. Hanya ada satu `admin_response`: menanggapi ulang (tombol berubah menjadi **Ubah Tanggapan** di UI) menimpa tanggapan lama dan mengirim notifikasi lagi.
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
1. Pengelola mengubah status dari dropdown **Ubah Status** di dialog detail (tanpa menulis tanggapan). Dropdown disembunyikan bila status `closed`; endpoint sendiri tidak menolak `closed`.
2. Middleware `can:manage feedbacks` + guard `abort_unless(...can('manage feedbacks'), 403)`.
3. Validasi `ChangeStatusFeedbackRequest`: `status` in `open,in_progress,resolved,closed` — endpoint ini **boleh** mengembalikan ke `open` (berbeda dari respond).
4. `$feedback->changeStatus($status)` → flash "Status feedback diperbarui." **Tidak** mengirim notifikasi ke pemilik.

## Permission Matrix (dari `MasterPermissionSeeder`)

| Permission | admin | finance manager | staff | Fungsi |
|---|---|---|---|---|
| `view feedbacks` | ✓ | ✓ | ✓ | Akses halaman (staff otomatis ter-scope miliknya) |
| `create feedbacks` | ✓ | ✓ | ✓ | Kirim feedback (floating button) |
| `edit feedbacks` | ✓ | ✓ | ✓ | Edit milik sendiri saat masih `open` |
| `delete feedbacks` | ✓ | ✓ | ✓ | Hapus (pemilik saat open / pengelola kapan pun) |
| `respond feedbacks` | ✓ | ✓ | ✗ | Menulis `admin_response` |
| `manage feedbacks` | ✓ | ✓ | ✗ | Tab All, ubah status, hapus feedback siapa pun (hanya via endpoint; UI tidak menampilkan tombolnya) |

### Panduan & video tutorial

1. Tombol **Tutorial** di header halaman Masukan (`<TutorialButton slug="feedbacks" />`, di samping **Kirim Masukan**) membuka video per role; teks lengkap di `/panduan/feedbacks`.
2. Isi panduan: `video/feedbacks/guide.ts` (alur Terbuka → Diproses → Selesai → Ditutup, cara mengirim/menanggapi, dampak notifikasi, peringatan). Video: `video/feedbacks/tutorial.tsx` (`FeedbacksStaff`, `FeedbacksFinanceManager`, `FeedbacksAdmin`), langkah di `steps.ts`, koordinat di `shots.ts`.
3. Ambil ulang screenshot: jalankan server QC di port 8017, lalu `video/capture/feedbacks.js` lewat Playwright MCP. Skrip itu membuat 2 feedback milik `staff@qc.test` (Fitur → Diproses, Bug → Selesai, lampiran `video/capture/fixtures/feedback-tangkapan-layar.png`) beserta notifikasinya; hapus dulu keduanya bila ingin mengulang. Lalu `python video/capture/to-webp.py feedbacks`.
4. Perubahan alur status, tombol, atau notifikasi modul ini harus diikuti pembaruan `guide.ts`, ambil ulang screenshot, dan `shots.ts`/`steps.ts`.

## Keterkaitan Antar Modul

- **Watchpost** (sistem luar, tim IT): laporan Bug → tiket (`KirimLaporanBugKeWatchpost`); setiap error membawa `error_id` + `company` (`Watchpost::context` di `AppServiceProvider`); halaman error membawa `trace_id` (`ErrorReportService`).
- **Notifications**: create → `feedback_submitted` ke admin/FM perusahaan ini; respond → `feedback_responded` ke pemilik. `data.url` menunjuk `route('feedbacks.index')` sehingga klik notifikasi membuka halaman feedback.
- **Permissions/Roles**: penerima broadcast dicari via `User::role(['admin', 'finance manager'])`; seluruh gating memakai permission `... feedbacks` dari `MasterPermissionSeeder`.
- **Layout React**: `FloatingFeedbackButton` dipasang di `resources/js/layouts/app-layout.tsx` — muncul di semua halaman ber-layout aplikasi.
- **i18n**: label type/priority/status dari `lang/*/feedback.php` (`__('feedback.type_bug')`, dst.).
- **Storage**: lampiran di disk `public` (`feedbacks/`) milik perusahaan (`storage/tenant{slug}/app/public`), dilayani route `/c/{company}/storage/{path}`; `Storage::url` sudah ber-prefix perusahaan (tidak lewat `storage:link`).

## Invarian & Jebakan

- **Scoping kepemilikan dua lapis**: permission route + scope query (`forUser`) + guard `abort_unless` di controller. Staff dengan `view feedbacks` tetap tidak pernah melihat feedback user lain.
- **Edit/hapus pemilik hanya saat `open`** — begitu admin memproses (in_progress dst.), pemilik kehilangan kendali; hanya pengelola yang bisa menghapus.
- **`respond` vs `changeStatus`**: respond hanya untuk status maju (`in_progress|resolved|closed`) dan mensyaratkan `canRespond()`; changeStatus bebas keempat status termasuk kembali ke `open`, tetapi butuh `manage feedbacks`.
- **Tampilkan deskripsi lewat `safe_description` / `safe_admin_response`** — jangan render `description` mentah (mengandung HTML user, sanitasi whitelist ada di model).
- Hapus feedback otomatis menghapus lampirannya (hook `deleting`) — jangan hapus baris via query builder massal (`Feedback::where(...)->delete()`) karena hook model tidak terpanggil dan file yatim tertinggal.
- `page_url` diisi otomatis oleh frontend dari `window.location.pathname` — nullable, jangan diasumsikan selalu ada.
- Notifikasi ke admin dikirim **di dalam transaksi** create — gagal notifikasi menggagalkan pembuatan feedback (rollback). Transaksinya dibuka di **koneksi pusat** (`DB::connection((new Feedback)->getConnectionName())`): `DB::transaction()` biasa memakai database perusahaan di dalam `/c/{company}` sehingga tidak melindungi tabel pusat (diperbaiki 6 Nov 2026, dikunci `tests/Tenancy/FeedbackTransaksiPusatTest.php`).
- Nama tabel `feedbacks` dideklarasikan eksplisit karena bukan bentuk jamak standar Laravel (`feedback`).
- **Hanya Bug yang diteruskan ke Watchpost**, sekali (`watchpost_ticket_id` terisi = selesai). Edit feedback setelah terkirim, tanggapan, dan hapus feedback **tidak** dikirim ke tiket. Arah sebaliknya ada: **status** tiket kembali ke feedback lewat `watchpost:sync-tickets`, dan Watchpost menjadi satu-satunya sumber status bug yang diteruskan.
- Listener berjalan **tanpa tenancy**: jangan memakai `tenant()`, `route()` tanpa parameter `company`, atau `AppNotification::notify()` tanpa `$companyId` di sana.
- Job wajib di-dispatch dari konteks perusahaan dan menerima **ID**: lampiran dibaca dari storage perusahaan yang dipulihkan `QueueTenancyBootstrapper` (dikunci `tests/Tenancy/LaporanBugWatchpostTenantTest.php`).
- Prioritas Finance ≠ prioritas Watchpost: peta ada di `KirimLaporanBugKeWatchpost::PRIORITAS`. Menambah prioritas baru di sini wajib menambah petanya (BugReport menolak nilai di luar `low/normal/high/urgent`).

## File Kunci

- `routes/web.php` (baris 428–446 — blok feedbacks)
- `app/Http/Controllers/FeedbackController.php`
- `app/Models/Feedback.php`
- `app/Http/Requests/StoreFeedbackRequest.php`, `UpdateFeedbackRequest.php`, `RespondFeedbackRequest.php`, `ChangeStatusFeedbackRequest.php`
- `resources/js/components/floating-feedback-button.tsx`
- `resources/js/layouts/app-layout.tsx` (mount floating button)
- `resources/js/pages/feedbacks/index.tsx`
- `lang/id/feedback.php` (label i18n)
- `tests/Feature/FeedbackControllerTest.php`
- `app/Jobs/KirimLaporanBugKeWatchpost.php`, `app/Listeners/PerbaruiFeedbackDariWatchpost.php`, `resources/js/lib/watchpost.ts`
- `tests/Feature/FeedbackWatchpostTest.php`, `tests/Feature/StatusTiketWatchpostTest.php`, `tests/Tenancy/LaporanBugWatchpostTenantTest.php`, `tests/Tenancy/FeedbackTransaksiPusatTest.php`
