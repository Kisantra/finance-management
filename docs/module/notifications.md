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
| `feedback_submitted` | `FeedbackController::notifyAdmins()` (baris 174) | Semua user role `admin` + `finance manager` | User mengirim feedback baru |
| `feedback_responded` | `FeedbackController::respond()` (baris 147) | Pemilik feedback | Admin menanggapi feedback |
| `invoice_due_soon` | `app/Console/Commands/NotifyInvoiceDueDates.php` (`notifyMany`, baris 37 & 54) | Semua admin + finance manager | Scheduler harian: invoice `draft`/`partially_paid` jatuh tempo H-3 dan H-0 |
| `feedback_status_changed`, `invoice_created`, `invoice_payment_received`, `invoice_deleted`, `payment_deleted` | — | — | Terdefinisi di peta icon/warna model & frontend, tetapi **saat ini tidak ada pemanggilnya** di codebase (siap pakai untuk event mendatang) |

Scheduler: `routes/console.php` → `Schedule::command('invoices:notify-due-dates')->dailyAt('08:00');`

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
1. User klik "Tandai semua" di header popover bell.
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
3. **`NotificationDrawer`** (`notification-drawer.tsx`): Sheet samping; setiap kali `open` menjadi true, `fetch('/notifications')` halaman 1 (JSON endpoint), mendukung load-more via `has_more`. Klik item → POST read (efeknya juga menyegarkan prop `notifications` sehingga badge bell ikut turun — inilah pengganti event `notification-read` lama).
4. Peta icon/warna per `type` diduplikasi di kedua komponen (`TYPE_ICON_MAP`, `COLOR_MAP`) memakai icon lucide.

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

- `d:\Laravel\finance-management\app\Models\AppNotification.php`
- `d:\Laravel\finance-management\app\Http\Controllers\NotificationController.php`
- `d:\Laravel\finance-management\routes\web.php` (baris 446–453) dan `routes\console.php` (jadwal `invoices:notify-due-dates`)
- `d:\Laravel\finance-management\app\Console\Commands\NotifyInvoiceDueDates.php`
- `d:\Laravel\finance-management\app\Http\Middleware\HandleInertiaRequests.php` (`getNotifications()`)
- `d:\Laravel\finance-management\resources\js\layouts\header.tsx`
- `d:\Laravel\finance-management\resources\js\components\notifications\notification-bell.tsx`
- `d:\Laravel\finance-management\resources\js\components\notifications\notification-drawer.tsx`
- `d:\Laravel\finance-management\app\Http\Controllers\FeedbackController.php` (contoh pemanggil `notify()`)
