# Modul: Admin — Users & Permissions/Roles

> Modul administrasi untuk mengelola akun pengguna (CRUD + bulk delete, status aktif/nonaktif, assign role) dan sistem izin berbasis **Spatie Permission 6** (toggle permission per role, sync per modul, sync semua, CRUD role dengan icon). Route prefix `/admin` dengan nama route `admin.*`. Halaman user digate permission `manage users`; halaman permission digate `view permissions` (baca) dan `manage permissions` (mutasi).

## Tabel Database

| Tabel | Kolom penting | Keterangan |
|-------|---------------|------------|
| `users` | `name`, `email`, `password`, `phone_number`, `status` enum(`active`,`inactive`), `locale`, `email_verified_at` | Akun pengguna. `status` dicek via `User::isActive()`. |
| `roles` | `name`, `icon`, `guard_name` | Tabel Spatie + kolom custom `icon` (nama icon lucide, mis. `shield-check`). |
| `permissions` | `name`, `guard_name` | Format nama: `"{aksi} {modul}"`, mis. `view invoices`, `manage users`. |
| `model_has_roles` | `company_id`, `role_id`, `model_type`, `model_id` | Pivot user ↔ role (Spatie), **scoped per perusahaan** — PK komposit dimulai `company_id`. |
| `model_has_permissions` | `company_id`, `permission_id`, `model_type`, `model_id` | Pivot permission langsung ke user (tidak dipakai aplikasi — semua lewat role). |
| `role_has_permissions` | `permission_id`, `role_id` | Pivot role ↔ permission (tidak ter-scope team). |

## Multi-Tenancy: Spatie Teams (sejak 2026-08-11)

Fitur **teams** Spatie AKTIF dengan `team_foreign_key = company_id` (**string** — mengikuti `companies.id` yang berupa slug, mis. `kisantra`). Konsekuensi yang wajib dipahami:

- **Role bersifat GLOBAL** (`roles.company_id = NULL`) — definisi role & permission sama untuk semua perusahaan. **Assignment role per (user, perusahaan)** — Budi bisa `finance manager` di PT A sekaligus `staff` di PT B.
- **Konteks team WAJIB di-set sebelum permission check / assignRole.** Di HTTP ini otomatis: middleware `app/Http/Middleware/SetPermissionsTeam.php` (terdaftar sebelum `HandleInertiaRequests` di `bootstrap/app.php`) membaca `tenant()` (routing `/c/{company}`, Tahap 2) dengan fallback keanggotaan pertama user (`company_user`). Di seeder/job/command: panggil `setPermissionsTeamId()` manual — tanpa konteks, `assignRole` GAGAL (kolom `company_id` NOT NULL di pivot).
- **Membuat role global** di kode: `setPermissionsTeamId(null)` dulu (pola di `MasterPermissionSeeder`).
- **Keanggotaan perusahaan** hidup di pivot `company_user` (user_id, company_id) — TANPA kolom role; role selalu dari Spatie teams. `UserController@store` otomatis meng-attach user baru ke perusahaan aktif admin pembuatnya.
- Di test, `Tests\TestCase::setUp()` men-set team default `test-company`; test isolasi lihat `tests/Feature/CompanyPermissionIsolationTest.php`.
- Impor user deployment lama: `php artisan central:import-users {connection} --organization= --company=` (`app/Services/CentralUserImportService.php`, idempoten).

### Provisioning Perusahaan (`/admin/companies`, sejak Tahap 4)

Halaman **Perusahaan** (permission baru `manage companies`, admin only — migration
`2026_08_11_120000_add_manage_companies_permission_to_roles.php`) untuk membuat perusahaan
baru di organization admin yang login:

1. Form: nama, **kode URL/slug (permanen — menjadi `/c/{slug}`, nama DB `tenant_{slug}`,
   path storage)**, **singkatan dokumen (permanen, manual — dipakai nomor invoice)**.
   Validasi slug: regex `^[a-z0-9]+(-[a-z0-9]+)*$`, unik. Kuota organization dicek
   (`Organization::hasReachedCompanyQuota()`).
2. `Company::create()` → pipeline SINKRON: CreateDatabase → MigrateDatabase →
   SeedDatabase (`TenantDatabaseSeeder`) → **`App\Jobs\MarkCompanyActive`** (status → `active`).
   Gagal di tengah → status **`failed`** + tombol **Coba Ulang** (drop DB setengah jadi →
   hapus baris tanpa event → create ulang). Pembuat otomatis jadi anggota + role `admin`
   di perusahaan baru (`grantCreatorAccess`).
3. File: `app/Http/Controllers/Admin/CompanyController.php`,
   `app/Http/Requests/Admin/StoreCompanyRequest.php`,
   `resources/js/pages/admin/companies/index.tsx`;
   test `tests/Feature/Admin/CompanyControllerTest.php`.

**⚠ Invarian validasi lintas-database:** rule `unique:`/`exists:` yang menunjuk tabel
CENTRAL (users, companies) WAJIB diprefix koneksi central — `unique:mysql.users` — karena
di dalam konteks tenant, koneksi default validator menunjuk DB perusahaan. Sudah diterapkan
di StoreUserRequest/UpdateUserRequest/BulkDestroyUserRequest/StoreCompanyRequest.

## Struktur Permission — Sumber Kebenaran: `MasterPermissionSeeder`

File `database/seeders/MasterPermissionSeeder.php` adalah **sumber kebenaran** struktur permission. Seeder berjalan 4 tahap: (1) buat/update 3 role bawaan, (2) buat semua permission (idempoten via `firstOrCreate`) sekaligus **menghapus permission usang** hasil pemecahan cash-flow (`view transactions`, `view cash-flow`, dll.), (3) sync permission ke role, (4) pastikan minimal ada satu user admin (jika kosong, user pertama otomatis di-assign role admin).

Konvensi nama permission = `aksi + spasi + modul`. Modul dan aksinya:

| Modul | Permissions |
|-------|-------------|
| Dashboard | `view dashboard` |
| Clients / Services / Invoices / Payments / Bank Accounts | `view` / `create` / `edit` / `delete` per modul |
| Cash Flow (dipecah per tab) | `view/create/edit/delete income`, `... expense`, `... transfer` |
| Recurring Invoices | CRUD + `publish recurring-invoices` |
| Categories | `view categories`, `manage categories` |
| Reimbursements | CRUD + `approve reimbursements`, `pay reimbursements` |
| Fund Requests | CRUD + `approve fund requests`, `disburse fund requests` |
| Loans | CRUD + `pay loans` |
| Receivables | CRUD + `approve receivables`, `pay receivables` |
| Permission Mgmt | `view permissions`, `manage permissions` |
| User Mgmt | `manage users` (satu-satunya permission modul ini — tidak ada `view users`) |
| Feedbacks | CRUD + `respond feedbacks`, `manage feedbacks` |
| Reports | `view profit-loss` |
| PDF Templates | `manage pdf templates` |

### 3 Role Bawaan & Filosofinya

| Role | Icon | Filosofi |
|------|------|----------|
| `admin` | `shield-exclamation` | Akses penuh — `syncPermissions(Permission::all())`. Termasuk `manage users`, `manage permissions`, `manage pdf templates`. |
| `finance manager` | `banknotes` | Operasional keuangan penuh (invoice, payment, cash flow, approve/pay/disburse) **tanpa manajemen user & permission** — hanya `view permissions`, tidak dapat `manage users`, `manage permissions`, `manage pdf templates`. Juga tidak bisa `delete clients`/`delete services`. |
| `staff` | `user` | View/create milik sendiri: lihat klien & invoice, buat invoice, kelola reimbursement/fund request/feedback miliknya, request receivable. Tanpa approve/pay, tanpa bank-accounts/cash-flow, tanpa laporan. |

## Fitur

### Daftar & Statistik User (`GET /admin/users`)

**Alur step-by-step:**
1. User membuka menu Administrasi → Pengguna; sidebar hanya menampilkan menu jika `useCan().can('manage users')`.
2. Request `GET /admin/users` melewati middleware `can:manage users` (`routes/web.php` baris 509).
3. `UserController::index()` membangun query dengan filter `search` (whereAny name/email/phone_number), `role` (whereHas roles), `status`, sorting, dan paginasi (`per_page` default 10).
4. Controller menghitung stats: total, active, inactive, jumlah admin, jumlah finance manager.
5. Respons `Inertia::render('users/index', [...])` → halaman React `resources/js/pages/users/index.tsx` menampilkan DataTable + StatsCard.

**Penjelasan kode** (`app/Http/Controllers/Admin/UserController.php`):

```php
$users = User::query()
    ->with('roles')
    ->when($search, fn (Builder $q) => $q->whereAny(
        ['name', 'email', 'phone_number'], 'like', '%'.trim($search).'%'
    ))
    ->when($role, fn (Builder $q) => $q->whereHas('roles', fn ($qr) => $qr->where('name', $role)))
    ->when($status, fn (Builder $q) => $q->where('status', $status))
    ->orderBy($sort, $direction)
    ->paginate($perPage)
```

Setiap baris di-`through()` menjadi payload ringkas berisi `role` (role pertama), `role_icon`, `initials` (dari `User::initials()`), dan flag `is_current` (`$user->id === auth()->id()`) yang dipakai frontend untuk menonaktifkan tombol hapus akun sendiri.

### Tambah User (`POST /admin/users`)

**Alur step-by-step:**
1. Admin klik "Tambah Pengguna" di halaman index → dialog form terbuka.
2. Request `POST /admin/users` → middleware `can:manage users` + `$this->authorize('manage users')` di controller (dobel proteksi).
3. Validasi via `StoreUserRequest` (`app/Http/Requests/Admin/StoreUserRequest.php`): `name` required, `email` unique, `phone_number` nullable max 20, `status` in `active,inactive`, `password` min 8 + `confirmed`, `role` harus ada di `roles.name`.
4. Mutasi DB: `User::create()` dengan `Hash::make($password)` dan `email_verified_at => now()` (user buatan admin dianggap terverifikasi), lalu `$user->assignRole($validated['role'])` menulis ke `model_has_roles`.
5. Respons `redirect()->back()` dengan flash `success` → halaman index memuat ulang data dan menampilkan toast.

**Penjelasan kode:**

```php
$user = User::create([
    'name' => $validated['name'],
    'email' => $validated['email'],
    'phone_number' => $validated['phone_number'] ?? null,
    'status' => $validated['status'],
    'password' => Hash::make($validated['password']),
    'email_verified_at' => now(),
]);

$user->assignRole($validated['role']);
```

### Edit User (`PUT /admin/users/{user}`)

**Alur step-by-step:**
1. Admin klik edit pada baris user → dialog terisi data lama.
2. `PUT /admin/users/{user}` → `can:manage users` → validasi `UpdateUserRequest` (email unique ignore id sendiri; password opsional).
3. Controller update kolom profil; password hanya di-update **jika diisi** (`! empty($validated['password'])`).
4. `$user->syncRoles([$validated['role']])` mengganti role lama dengan role baru (single-role model — setiap user hanya punya satu role efektif).
5. Redirect back + flash success.

### Hapus User (`DELETE /admin/users/{user}`)

**Alur step-by-step:**
1. Admin klik hapus → `ConfirmDialog` variant danger.
2. `DELETE /admin/users/{user}` → `can:manage users`.
3. Guard di controller: jika `$user->id === auth()->id()` → redirect back dengan flash `error` "Anda tidak dapat menghapus akun sendiri." — **tidak ada mutasi**.
4. Selain itu `$user->delete()` (hard delete), lalu redirect back + success.

### Bulk Delete User (`POST /admin/users/bulk-delete`)

**Alur step-by-step:**
1. Admin mencentang beberapa baris di DataTable lalu klik hapus massal.
2. `POST /admin/users/bulk-delete` dengan body `{ ids: number[] }` → validasi `BulkDestroyUserRequest` (`ids.*` integer, exists di `users`).
3. Controller membuang id milik sendiri dari daftar: `array_diff($validated['ids'], [auth()->id()])`. Jika hasilnya kosong → flash error "Tidak ada pengguna yang dapat dihapus."
4. `User::whereIn('id', $ids)->delete()` lalu flash `"Berhasil menghapus {$count} pengguna."`.

**Penjelasan kode:**

```php
$ids = array_diff($validated['ids'], [auth()->id()]);
$count = count($ids);
if ($count === 0) {
    return redirect()->back()->with('error', 'Tidak ada pengguna yang dapat dihapus.');
}
User::whereIn('id', $ids)->delete();
```

### Halaman Permission Matrix (`GET /admin/permissions`)

**Alur step-by-step:**
1. User dengan `view permissions` (admin & finance manager) membuka Administrasi → Izin & Peran.
2. `PermissionController::index()` memuat semua role beserta `permission_ids`, `users_count`, `permissions_count`, dan icon (fallback `shield-check`).
3. Semua permission dikelompokkan per modul dengan memecah nama pada spasi pertama — kata setelah aksi menjadi nama grup (`view invoices` → grup `Invoices`).
4. Query string `?role={id}` menentukan role yang dipilih (default role pertama).
5. Render `permissions/index` (React: `resources/js/pages/permissions/index.tsx`) dengan prop `canManagePermissions` — jika `false` (finance manager), matriks bersifat read-only.

**Penjelasan kode** (`app/Http/Controllers/Admin/PermissionController.php`):

```php
$groupedPermissions = $permissions
    ->groupBy(function (Permission $p) {
        $parts = explode(' ', $p->name, 2);
        return count($parts) > 1 ? ucwords($parts[1]) : 'Other';
    })
    ->sortKeys()
```

### Toggle Permission per Role (`POST /admin/permissions/toggle`)

**Alur step-by-step:**
1. Admin mengklik checkbox satu permission pada role terpilih.
2. `POST /admin/permissions/toggle` → middleware `can:manage permissions` + `abort_unless(...can('manage permissions'), 403)` di controller.
3. Validasi inline: `role_id` dan `permission_id` wajib dan exists.
4. Jika role sudah punya permission → `revokePermissionTo()`; jika belum → `givePermissionTo()` (mutasi `role_has_permissions`).
5. `app(PermissionRegistrar::class)->forgetCachedPermissions()` membersihkan cache Spatie, lalu `redirect()->back()` — Inertia memuat ulang matriks.

**Penjelasan kode:**

```php
if ($role->permissions->contains('id', $permission->id)) {
    $role->revokePermissionTo($permission);
} else {
    $role->givePermissionTo($permission);
}
app(PermissionRegistrar::class)->forgetCachedPermissions();
```

### Sync per Modul (`POST /admin/permissions/sync-module`)

**Alur step-by-step:**
1. Admin klik "grant semua" / "revoke semua" pada header grup modul (mis. `Invoices`).
2. Body: `{ role_id, module, action: 'grant'|'revoke' }` → gate `manage permissions`.
3. Controller mencari permission yang bagian modulnya (setelah aksi) sama persis dengan `module` — query `LIKE` awal lalu difilter ulang dengan `explode` agar tepat (mis. `view invoices` cocok modul `Invoices`, `view recurring-invoices` tidak).
4. Loop `givePermissionTo` / `revokePermissionTo` untuk setiap permission modul tersebut.
5. Reset cache Spatie + redirect back.

### Sync Semua (`POST /admin/permissions/sync-all`)

**Alur step-by-step:**
1. Admin klik "Grant All" / "Revoke All" pada role terpilih.
2. Body `{ role_id, action }` → gate `manage permissions`.
3. `grant` → `$role->syncPermissions(Permission::all())`; `revoke` → `$role->syncPermissions([])` (mengosongkan `role_has_permissions` untuk role itu).
4. Reset cache + redirect back.

### Hapus Permission (`DELETE /admin/permissions/{permission}`)

**Alur step-by-step:**
1. Admin menghapus sebuah permission dari sistem (bukan sekadar mencabut dari role).
2. Gate `manage permissions` → dalam `DB::transaction`: cabut permission dari **semua role** yang memilikinya, lalu `$permission->delete()`.
3. Reset cache; sukses → flash success, exception → flash error dengan pesan.

**Penjelasan kode:**

```php
DB::transaction(function () use ($permission) {
    foreach ($permission->roles as $role) {
        $role->revokePermissionTo($permission);
    }
    $permission->delete();
});
```

### CRUD Role + Icon (`POST /admin/roles`, `PUT /admin/roles/{role}`, `DELETE /admin/roles/{role}`)

**Alur step-by-step (store/update):**
1. Admin membuat/mengedit role lewat dialog di halaman permissions.
2. Gate `manage permissions` → validasi: `name` unique di `roles` (update: ignore id sendiri), `icon` harus salah satu dari konstanta `RoleController::AVAILABLE_ICONS` (37 nama icon lucide).
3. Nama disimpan lowercase (`strtolower`), `guard_name` selalu `web`.
4. Reset cache + flash success.

**Alur step-by-step (destroy):**
1. Guard 1: role `admin` dan `staff` **tidak bisa dihapus** ("Peran default ... tidak dapat dihapus"). Catatan: `finance manager` tidak masuk daftar terlindungi.
2. Guard 2: admin tidak dapat menghapus role yang sedang ia sandang sendiri.
3. Dalam transaksi: user yang masih memakai role tersebut dipindahkan ke **role fallback** = role lain dengan jumlah permission paling sedikit (atau `staff` yang dibuat baru jika tidak ada), lalu `$role->delete()`.
4. Reset cache + flash.

**Penjelasan kode** (`app/Http/Controllers/Admin/RoleController.php`):

```php
$fallbackRole = Role::withCount('permissions')
    ->where('name', '!=', $role->name)
    ->orderBy('permissions_count', 'asc')
    ->first();
...
foreach ($usersWithRole as $user) {
    $user->syncRoles([$fallbackRole->name]);
}
$role->delete();
```

### Permission Cache

Spatie meng-cache seluruh tabel permission. Setiap mutasi di controller diikuti `app(PermissionRegistrar::class)->forgetCachedPermissions()`. Jika cache tersangkut (mis. setelah seeding manual atau edit DB langsung), jalankan:

```bash
php artisan permission:cache-reset
```

### Gating UI di React — hook `useCan`

`HandleInertiaRequests::share()` membagikan `auth.permissions` (hasil `getAllPermissions()->pluck('name')`) dan `auth.roles` ke semua halaman. Hook `resources/js/hooks/use-can.ts` membungkusnya:

```ts
export function useCan() {
    const { auth } = usePage<SharedProps>().props;
    const permissions = auth?.permissions ?? [];
    const can = (permission: string) => permissions.includes(permission);
    const canAny = (perms: string[]) => perms.some((p) => permissions.includes(p));
    return { can, canAny };
}
```

Dipakai di sidebar, halaman users, cash-flow, bank-accounts, dll. untuk menyembunyikan menu/tombol. **Gating frontend hanya UX** — otorisasi sebenarnya tetap di middleware route + `authorize()`/`abort_unless()` backend.

## Keterkaitan Antar Modul

- **Semua modul lain** digate oleh permission dari seeder ini via middleware `can:` di `routes/web.php`.
- **Sidebar & seluruh halaman React** membaca `auth.permissions` dari shared props Inertia (`app/Http/Middleware/HandleInertiaRequests.php`).
- **Feedbacks**: `FeedbackController::notifyAdmins()` mengirim notifikasi ke semua user ber-role `admin`/`finance manager` (`User::role([...])`).
- **Scheduler**: `invoices:notify-due-dates` juga menarget user ber-role admin/finance manager.
- **Settings → PDF Templates** digate `manage pdf templates`; **Users** page menampilkan `role_icon` dari kolom `roles.icon`.

## Invarian & Jebakan

- **Single-role efektif**: UI dan controller memakai `roles->first()` dan `syncRoles([...])` — walau Spatie mendukung multi-role, aplikasi ini berasumsi satu role per user.
- **Tidak boleh hapus diri sendiri** — berlaku di destroy tunggal maupun bulk (id sendiri difilter diam-diam).
- **Role `admin` & `staff` terlindungi dari penghapusan; `finance manager` TIDAK** — bisa terhapus, usernya jatuh ke role fallback dengan permission paling sedikit.
- **Setiap mutasi permission wajib reset cache Spatie** — lupa reset menyebabkan perubahan tidak terasa sampai cache kadaluarsa (`php artisan permission:cache-reset` sebagai obat).
- Seeder **menghapus** permission usang cash-flow (`view transactions`, `manage cash-flow`, dll.) — jangan referensikan nama lama itu di kode.
- `UserController::index` **tidak punya authorize() di method** — proteksinya hanya middleware route `can:manage users`; method mutasi punya dobel proteksi.
- `manage users` adalah permission tunggal (tidak ada `view users`) — user tanpa itu tidak bisa melihat daftar user sama sekali.
- Status `inactive` disimpan di `users.status`, tetapi penegakan login untuk user nonaktif bergantung pada logika auth (cek `User::isActive()` sebelum mengandalkannya).
- `email_verified_at` diisi `now()` saat admin membuat user — tidak ada alur verifikasi email untuk user buatan admin.

## File Kunci

- `d:\Laravel\finance-management\routes\web.php` (baris 477–519 — blok admin)
- `d:\Laravel\finance-management\app\Http\Controllers\Admin\UserController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Admin\PermissionController.php`
- `d:\Laravel\finance-management\app\Http\Controllers\Admin\RoleController.php`
- `d:\Laravel\finance-management\app\Http\Requests\Admin\StoreUserRequest.php`, `UpdateUserRequest.php`, `BulkDestroyUserRequest.php`
- `d:\Laravel\finance-management\database\seeders\MasterPermissionSeeder.php` — sumber kebenaran permission
- `d:\Laravel\finance-management\app\Models\User.php`
- `d:\Laravel\finance-management\app\Http\Middleware\HandleInertiaRequests.php`
- `d:\Laravel\finance-management\resources\js\hooks\use-can.ts`
- `d:\Laravel\finance-management\resources\js\pages\users\index.tsx`, `resources\js\pages\permissions\index.tsx`
- `d:\Laravel\finance-management\tests\Feature\Admin\UserControllerTest.php`
