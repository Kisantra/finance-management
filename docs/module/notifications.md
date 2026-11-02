# Modul: Notifications (AppNotification)

> Sistem notifikasi in-app sederhana berbasis satu tabel `app_notifications` (bukan Laravel Notification bawaan). Modul lain menulis notifikasi lewat factory statis `AppNotification::notify()` / `notifyMany()`; UI menampilkan lonceng (bell) + drawer di header dengan unread count dari shared props Inertia. Route prefix `/notifications` (nama route `notifications.*`), tanpa gate permission — setiap user login hanya melihat notifikasi miliknya sendiri.

## Tabel Database

| Tabel | Kolom | Keterangan |
|-------|-------|------------|
| `app_notifications` | `user_id`, `type` (string), `title`, `message`, `data` (JSON, cast array), `read_at` (nullable datetime) | Satu baris per penerima. `data` biasanya berisi `{..._id, url}` — `url` dipakai frontend untuk navigasi saat notifikasi diklik. |

## Model `AppNotification` (`app/Models/AppNotification.php`)

- **Scopes**: `unread()` (`read_at` null), `forUser($userId)`, `recent($days = 30)`.
- **Helpers**: `isUnread()`, `isRead()`, `markAsRead()` (idempoten — jika sudah dibaca langsung `return true`).
- **Accessors presentasi**: `icon` dan `color` dipetakan dari `type` via `match` (mis. `invoice_payment_received` → icon `banknotes`, warna `green`); ada juga `icon_bg_color`/`icon_color` (kelas Tailwind, sisa era Livewire — frontend React memetakan sendiri).
- **Factory**:

```php
public static function notify(int $userId, string $type, string $title, string $message, array $data = []): self
{
    return self::create([
        'user_id' => $userId, 'type' => $type, 'title' => $title,
        'message' => $message, 'data' => $data,
    ]);
}

public static function notifyMany(array $userIds, ...): void  // loop notify() per user
```

- **Cleanup**:

```php
public static function cleanupOld(int $days = 90): int
{
    return self::where('created_at', '<', now()->subDays($days))
        ->whereNotNull('read_at')
        ->delete();
}
```

`cleanupOld()` hanya menghapus notifikasi **yang sudah dibaca** dan lebih tua dari `$days`. Saat ini **tidak dijadwalkan** di `routes/console.php` — tersedia untuk dipanggil manual/tinker atau dijadwalkan kemudian.

## Tipe Notifikasi & Pengirimnya (hasil grep `AppNotification::notify`)

| Type | Pengirim | Penerima | Pemicu |
|------|----------|----------|--------|
| `feedback_submitted` | `FeedbackController::notifyAdmins()` (baris 178) | Semua user role `admin` + `finance manager` | User mengirim feedback baru |
| `feedback_responded` | `FeedbackController::respond()` (baris 147) | Pemilik feedback | Pemegang izin `respond feedbacks` menanggapi feedback (juga setiap kali tanggapan diedit) |
| `invoice_due_soon` | `app/Console/Commands/NotifyInvoiceDueDates.php` (`notifyMany`, baris 38 & 55) | Semua admin + finance manager | Scheduler harian: invoice `draft`/`partially_paid` jatuh tempo tepat H-3 dan H-0 (`sent` tidak ikut; draft belum bernomor sehingga nomornya kosong di pesan). `url` = `route('invoices.index').'#invoice/{id}'` (absolut dari `APP_URL` karena dibuat di console) |
| `feedback_status_changed`, `invoice_created`, `invoice_payment_received`, `invoice_deleted`, `payment_deleted` | — | — | Terdefinisi di peta icon/warna model & frontend, tetapi **saat ini tidak ada pemanggilnya** di codebase (siap pakai untuk event mendatang) |

Scheduler: `routes/console.php` → `Schedule::command('invoices:notify-due-dates')->dailyAt('08:00');` — jam mengikuti `config('app.timezone')` = `Asia/Makassar` (WITA); butuh cron `schedule:run` di server, dan hari yang terlewat tidak dikirim susulan.

Penerima broadcast dicari dengan `User::role(['admin', 'finance manager'])` — **nama peran**, bukan izin. Spatie `scopeRole()` memanggil `Role::findByName()` yang melempar `RoleDoesNotExist` bila salah satu nama tidak ada; karena `RoleController::update()` membolehkan ganti nama peran dan `destroy()` hanya melindungi `admin`/`staff`, mengganti nama/menghapus `finance manager` (atau mengganti nama `admin`) membuat `FeedbackController::store()` gagal (transaksi di-rollback, feedback tidak tersimpan) dan command pengingat error.

## Fitur

### Daftar Notifikasi — JSON (`GET /notifications`)

**Alur step-by-step:**
1. User membuka drawer "Lihat semua notifikasi" → frontend `fetch('/notifications?page=N&per_page=20')` dengan header `Accept: application/json` + CSRF.
2. Route `notifications.index` (auth only) → `NotificationController::index()`.
3. Query `AppNotification::forUser(auth()->id())` urut terbaru; **pagination kumulatif**: `limit($perPage * $page)` — halaman 2 mengembalikan 40 item pertama (pola "load more", bukan offset).
4. Respons JSON: `items` (dengan `icon` & `color` hasil accessor), `total`, `unread_count`, `has_more`.
5. Drawer me-render daftar; tombol "Muat lebih banyak" menaikkan `page`.

**Penjelasan kode** (`app/Http/Controllers/NotificationController.php`):

```php
$query = AppNotification::forUser($userId)->orderByDesc('created_at');
$total = (clone $query)->count();
$items = $query->limit($perPage * $page)->get()->map(fn (AppNotification $n) => [
    'id' => $n->id, 'type' => $n->type, 'title' => $n->title,
    'message' => $n->message, 'data' => $n->data,
    'read_at' => $n->read_at?->toIso8601String(), ...
]);
```

### Tandai Dibaca (`POST /notifications/{notification}/read`)

**Alur step-by-step:**
1. User mengklik satu notifikasi di bell popover atau drawer.
2. Frontend `router.post('/notifications/{id}/read', {}, { only: ['notifications'] })`.
3. Controller: `abort_unless($notification->user_id === auth()->id(), 403)` — user tidak bisa membaca notifikasi orang lain (route model binding tanpa scope, jadi guard manual ini penting).
4. `$notification->markAsRead()` mengisi `read_at = now()`.
5. `redirect()->back()` → Inertia partial reload prop `notifications` → badge unread berkurang; `onSuccess` frontend lalu `router.visit(item.data.url)` jika notifikasi membawa `url`.

### Tandai Semua Dibaca (`POST /notifications/mark-all-read`)

**Alur step-by-step:**
1. User klik "Tandai semua" di header popover bell atau di header drawer "Semua Notifikasi" (tombol hanya tampil bila ada yang belum dibaca).
2. Controller: `AppNotification::forUser(auth()->id())->unread()->update(['read_at' => now()])` — satu query massal.
3. `redirect()->back()` + partial reload `only: ['notifications']` → badge menjadi 0 tanpa kehilangan state halaman (`preserveState: true`).

### Shared Props Inertia — Unread Count di Semua Halaman

`app/Http/Middleware/HandleInertiaRequests.php::share()` membagikan prop **lazy** `notifications`:

```php
'notifications' => fn () => $user ? $this->getNotifications($user->id) : null,
```

`getNotifications()` mengembalikan:

```php
return [
    'recent' => $recent->values()->toArray(),   // 10 terbaru dari 30 hari terakhir (scope recent())
    'unread_count' => AppNotification::forUser($userId)->unread()->count(),
];
```

Karena berupa closure, query hanya dijalankan saat prop diminta, dan bisa di-refresh sendirian via `router.reload({ only: ['notifications'] })`. Middleware yang sama juga membagikan `actionCounts` (badge sidebar reimbursement/fund request pending — permission-aware), `auth.permissions`, `locale`, dan `flash`.

### Alur UI: Bell → Drawer

Implementasi React saat ini memakai **props/callback antar komponen**, bukan browser event — deskripsi lama `dispatch('open-notification-drawer')` di CLAUDE.md adalah warisan era Livewire/Alpine.

1. `resources/js/layouts/header.tsx` memegang state `drawerOpen` dan me-render keduanya:

```tsx
<NotificationBell onOpenDrawer={() => setDrawerOpen(true)} />
...
<NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
```

2. **`NotificationBell`** (`resources/js/components/notifications/notification-bell.tsx`): membaca `usePage().props.notifications` (shared prop), menampilkan badge merah `unread_count` (cap "99+"), popover berisi 10 item `recent`. Klik item → POST read → visit `data.url`. Tombol "Lihat semua notifikasi" memanggil `onOpenDrawer()`.
3. **`NotificationDrawer`** (`notification-drawer.tsx`): Sheet samping berjudul "Semua Notifikasi" (`{total} total · {unread} belum dibaca`); setiap kali `open` menjadi true, `fetch('/notifications')` halaman 1 (JSON endpoint), mendukung load-more ("Muat lebih banyak") via `has_more`. Klik item → POST read (tanpa `only`, jadi semua prop termasuk `notifications` ikut segar sehingga badge bell turun — inilah pengganti event `notification-read` lama) → drawer ditutup; `url` berakhiran `#invoice/{id}` atau `/invoices/{id}` dibuka sebagai modal detail invoice di halaman saat ini (`openResource`), selain itu `router.visit(url)`.
4. Peta icon/warna per `type` diduplikasi di kedua komponen (`TYPE_ICON_MAP`, `COLOR_MAP`) memakai icon lucide.

### Panduan & video tutorial

1. Notifikasi tidak punya halaman sendiri (lonceng di header semua halaman), jadi **tidak ada** `<TutorialButton>`; panduannya tampil di `/panduan/notifications` (kelompok Ringkasan) dan videonya diputar dari sana.
2. Teks panduan (halaman `/panduan` dan adegan video) bersumber dari `video/notifications/guide.ts`: siapa menerima apa, yang tidak memicu notifikasi, isi satu notifikasi, peringatan (penjadwal & WITA, hanya invoice Draft/Sebagian, batas 30 hari lonceng, penerima mengikuti nama peran).
3. Komposisi Remotion di `video/notifications/tutorial.tsx`: **`NotificationsStaff`** (lonceng, klik notifikasi, Tandai semua, panel Semua Notifikasi — berlaku untuk semua peran), **`NotificationsFinanceManager`** (Feedback Baru + kartu pengingat jatuh tempo + 2 peringatan pertama), **`NotificationsAdmin`** (peran, sumber notifikasi, isi notifikasi, layar Admin, semua peringatan, rekap). Langkah walkthrough di `steps.ts`, koordinat (px CSS layar 1280×720) di `shots.ts`, screenshot di `screens/*.webp`.
4. Ambil ulang screenshot: jalankan server QC (`DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8017`), jalankan dulu `video/capture/feedbacks.js` lewat Playwright MCP (`browser_run_code_unsafe`) — skrip itu membuat 2 feedback staff di DB QC beserta notifikasi Feedback Baru (Admin & Finance manager) dan Tanggapan Feedback (staff) yang belum dibaca — lalu `video/capture/notifications.js` (menandai notifikasi ketiga akun uji dibaca), kemudian `python video/capture/to-webp.py notifications` dan salin koordinat hasilnya ke `shots.ts`. Pratinjau: `npm run video`.
5. **Menambah pengirim/tipe notifikasi, mengubah penerima, jam penjadwal, atau tampilan lonceng/drawer → perbarui `guide.ts` (`impacts`, `records`, `matrix`, `warnings`) dan `steps.ts`, serta ambil ulang screenshot bila tampilan berubah.**

## Keterkaitan Antar Modul

- **Feedbacks** — pengirim notifikasi terbanyak (`feedback_submitted` ke admin/FM, `feedback_responded` ke pemilik).
- **Invoices** — command terjadwal `invoices:notify-due-dates` (H-3/H-0) ke admin/FM; tipe `invoice_created`/`invoice_payment_received`/`invoice_deleted`/`payment_deleted` sudah disiapkan di peta icon.
- **Permission/Roles** — penerima notifikasi broadcast ditentukan via `User::role(['admin', 'finance manager'])`.
- **HandleInertiaRequests** — jembatan unread count ke seluruh halaman React.

## Invarian & Jebakan

- **Kepemilikan ketat**: semua query lewat `forUser(auth()->id())`; `markAsRead` menjaga dengan `abort_unless(user_id === auth()->id(), 403)`. Jangan tambah endpoint tanpa guard serupa.
- `data.url` adalah **konvensi** — frontend menavigasi ke sana setelah read; selalu sertakan `url` di `data` saat memanggil `notify()` agar notifikasi bisa diklik.
- Pagination index bersifat **kumulatif** (`limit(perPage * page)`) — `page=3` mengembalikan 60 item, bukan item ke-41..60; `has_more = items.count() < total`.
- Bell hanya menampilkan notifikasi **30 hari terakhir** (scope `recent()`), maksimal 10 — notifikasi lama hanya terlihat di drawer (endpoint JSON tanpa filter recent).
- `notifyMany()` melakukan insert **per user dalam loop** — untuk penerima sangat banyak pertimbangkan bulk insert.
- `cleanupOld()` tidak pernah menghapus notifikasi belum dibaca, dan **belum dijadwalkan** — tabel akan tumbuh terus tanpa intervensi.
- Menambah `type` baru: cukup string bebas, tetapi tanpa entri di `match` model dan `TYPE_ICON_MAP`/`COLOR_MAP` frontend akan jatuh ke icon `bell` warna `gray` — tambahkan di tiga tempat (model + 2 komponen React).
- Prop `notifications` lazy — saat memutasi notifikasi dari halaman React, gunakan `only: ['notifications']` agar tidak memicu reload penuh.

## File Kunci

- `app/Models/AppNotification.php`
- `app/Http/Controllers/NotificationController.php`
- `routes/web.php` (baris 458–464) dan `routes/console.php` (jadwal `invoices:notify-due-dates`)
- `app/Console/Commands/NotifyInvoiceDueDates.php`
- `app/Http/Middleware/HandleInertiaRequests.php` (`getNotifications()`)
- `resources/js/layouts/header.tsx`
- `resources/js/components/notifications/notification-bell.tsx`
- `resources/js/components/notifications/notification-drawer.tsx`
- `app/Http/Controllers/FeedbackController.php` (contoh pemanggil `notify()`)
