# Test Case — Admin: Users & Permissions/Roles

Sumber teknis: [`docs/module/admin-users-permissions.md`](../../module/admin-users-permissions.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-satu` (data user/role/permission ada di database
**pusat** `finance_central`), eksekusi lewat HTTP dengan cookie sesi asli +
verifikasi database. Bukan production.

**Kenapa modul ini dijalankan terpisah (serial):** ia memutasi data pusat
(`users`, `roles`, `permissions`) yang dipakai bersama oleh kelima agent QA
paralel. Mematikan permission sebuah role di tengah run mereka akan memalsukan
hasil modul lain. Karena itu modul ini dikerjakan supervisor setelah semua agent
selesai, dengan **role & user sekali-pakai** yang dibersihkan kembali.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Admin membuka daftar user | GET `/c/qa-satu/admin/users` sebagai admin | 200, daftar user + statistik | BE | HTTP **200** | Pass |
| N02 | Admin membuka matriks permission | GET `/admin/permissions` sebagai admin | 200 | BE | HTTP **200** | Pass |
| N03 | Finance manager membuka matriks (read-only) | GET `/admin/permissions` sebagai manager | 200 (punya `view permissions`) | BE | HTTP **200** | Pass |
| N04 | Tambah user baru | POST `/admin/users` `name/email/password/status=active/role=staff` | 302, user tersimpan, `email_verified_at` terisi, role ter-assign **ter-scope perusahaan** | FE+BE | **302**; user id 12 `status=active`; `model_has_roles` → `role=staff, company_id=qa-satu` | Pass (percobaan ke-2, setelah BUG-ADM-01 diperbaiki) |
| N05 | Ubah user (role & status) | PUT `/admin/users/12` `status=inactive`, `role=finance manager`, password dikosongkan | 302; nama/status/role berubah; **password lama dipertahankan** | BE | **302**; `status=inactive`, role `finance manager`; hash password tidak berubah | Pass (percobaan ke-2) |
| N06 | Hapus user | DELETE `/admin/users/12` | 302, baris hilang | BE | **302**, `COUNT=0` | Pass |
| N07 | Buat role baru + icon | POST `/admin/roles` `name=qa-uji-role`, `icon=shield-check` | 302; nama disimpan lowercase, `guard_name=web` | BE | **302**; `name=qa-uji-role, icon=shield-check, guard_name=web` | Pass (percobaan ke-2) |
| N08 | Toggle permission ON | POST `/admin/permissions/toggle` `role_id`, `permission_id` (`view invoices`) | Permission ditambahkan | BE | **302**; `role_has_permissions` 0 → **1** | Pass (percobaan ke-2) |
| N09 | Toggle permission OFF (idempoten dua arah) | Toggle permission yang sama sekali lagi | Permission dicabut | BE | **302**; 1 → **0** | Pass |
| N10 | Sync per modul (grant) | POST `/admin/permissions/sync-module` `module=Invoices`, `action=grant` | Hanya permission modul Invoices yang diberikan | BE | **302**; jumlah = **4** (view/create/edit/delete invoices) — `recurring-invoices` tidak ikut | Pass |
| N11 | Sync semua (grant) | POST `/admin/permissions/sync-all` `action=grant` | Role mendapat seluruh permission | BE | **302**; **75 dari 75** | Pass |
| N12 | Sync semua (revoke) | POST `/admin/permissions/sync-all` `action=revoke` | Seluruh permission dicabut | BE | **302**; **0** | Pass |
| N13 | Hapus role non-default | DELETE `/admin/roles/{qa-uji-role}` | 302, role hilang | BE | **302**, `COUNT=0` | Pass |
| N14 | Matriks izin per peran terbaca di layar | Admin buka menu Izin & Peran | Matriks permission x role tampil utuh; ini sumber kebenaran gate seluruh modul | FE+BE | Matriks tampil; dipakai memverifikasi keputusan produk #4 | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Staff membuka daftar user lewat URL langsung | GET `/admin/users` sebagai staff | **403** — menu tersembunyi bukan kontrol akses | BE | HTTP **403** | Pass |
| A02 | Finance manager membuka daftar user | GET `/admin/users` sebagai manager | **403** — FM sengaja tidak punya `manage users` | BE | HTTP **403** | Pass |
| A03 | Staff membuka matriks permission | GET `/admin/permissions` sebagai staff | **403** | BE | HTTP **403** | Pass |
| A04 | Staff mencoba membuat user | POST `/admin/users` payload lengkap sebagai staff | **403**, tidak ada baris baru | BE | HTTP **403** | Pass |
| A05 | Finance manager mencoba toggle permission | POST `/admin/permissions/toggle` sebagai manager | **403** — FM read-only (`view permissions` tanpa `manage permissions`) | BE | HTTP **403** | Pass |
| A06 | Admin menghapus akunnya sendiri | DELETE `/admin/users/{id admin sendiri}` | Ditolak dengan flash error; akun **tetap ada** | BE | **302**; `COUNT=1` — akun tidak terhapus | Pass |
| A07 | Email duplikat | POST `/admin/users` dengan email yang sudah dipakai | **422** validasi | BE | HTTP **422** | Pass |
| A08 | Password terlalu pendek | `password=abc` (min 8) | **422** | BE | HTTP **422** | Pass |
| A09 | Role tidak dikenal | `role=dewa` | **422** — bukan 500 | BE | HTTP **422** | Pass (percobaan ke-2) |
| A10 | Hapus role bawaan `admin` | DELETE `/admin/roles/{admin}` | Ditolak; role tetap ada | BE | **302**; role `admin` masih ada | Pass |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Role ter-scope per perusahaan (Spatie teams) | Buat user di konteks `qa-satu`, periksa pivot | `model_has_roles.company_id` = `qa-satu`, bukan global | BE (DB) | `role=staff, company_id=qa-satu` | Pass |
| C02 | Integritas data bersama setelah seluruh QA | Setelah 603+ case dari 5 agent + modul ini | 3 user, 3 role bawaan, 75 permission utuh; ketiga akun masih bisa login | BE (DB) | `users=3`; `roles=admin,finance manager,staff`; `permissions=75`; admin 75, staff 21; ketiga akun → dashboard **200** | Pass |

## Temuan

### BUG-ADM-01 — Manajemen user & role sepenuhnya rusak di konteks perusahaan

| | |
|---|---|
| **SIFAT** | **Blocker rilis** — admin tidak bisa membuat, mengubah, atau mengelola user dan role sama sekali selama berada di konteks perusahaan (yaitu selalu, karena seluruh route aplikasi ber-prefix `/c/{company}`). |
| **MENGGAGALKAN** | N04, N05, N07, N08, N10, N11, N12, A07, A08, A09 |
| **GEJALA** | `POST /c/{company}/admin/users` → **HTTP 500**. Log: `SQLSTATE[42S02]: Base table or view not found: 1146 Table 'tenant_qa-satu.roles' doesn't exist (Connection: tenant, SQL: select count(*) as aggregate from `roles` ...)`. Validasi apa pun gagal lebih dulu, sehingga A07–A09 ikut 500 alih-alih 422. |
| **SEBAB** | Aturan validasi `exists:`/`unique:` memakai **koneksi default**, yang di dalam konteks perusahaan menunjuk database tenant. Tabel `roles`/`permissions`/`users` hidup di database **pusat**. `StoreUserRequest.php:22` memakai `exists:roles,name`; `PermissionController.php:65,66,88,125` memakai `exists:roles,id` / `exists:permissions,id`; `RoleController.php:31,51` memakai `Rule::unique('roles','name')`. Dokumentasi modul sudah memperingatkan invarian ini ("rule yang menunjuk tabel CENTRAL WAJIB diprefix koneksi") dan sebagian sudah diperbaiki (`unique:mysql.users`), tetapi 7 titik ini terlewat. |
| **CAKUPAN** | Seluruh modul Admin: tambah/ubah user, CRUD role, toggle permission, sync per modul, sync semua. Tidak terdeteksi test suite karena test berjalan pada **satu database** (bootstrapper tenancy dinonaktifkan), sehingga `roles` selalu ada di koneksi yang sama. |
| **PERBAIKAN** | Ketujuh rule diprefix koneksi central (`exists:mysql.roles,name`, `exists:mysql.roles,id`, `exists:mysql.permissions,id`, `Rule::unique('mysql.roles','name')`). Diverifikasi ulang: seluruh N04–N13 dan A07–A09 lolos, termasuk role ter-assign dengan `company_id` yang benar. |

## Catatan pelaksanaan

- Seluruh case dieksekusi lewat **request HTTP dengan cookie sesi asli** dan
  diverifikasi ke database `finance_central`. Tidak ada alur layar yang dikarang.
- Mutasi permission dilakukan pada **role sekali-pakai** `qa-uji-role`, bukan role
  bawaan; role tersebut dihapus kembali (N13) dan integritas data bersama
  diverifikasi ulang di C02.
- Case yang **tidak** diuji dan dinyatakan demikian: bulk delete user (berisiko
  terhadap akun bersama yang masih dipakai agent lain), penggantian role fallback
  saat role yang masih dipakai dihapus (butuh user korban khusus), dan seluruh
  perilaku UI React (matriks checkbox, dialog) — modul ini diuji di lapisan
  server saja.
- Kegagalan tooling penguji (bukan cacat aplikasi): skrip pembantu sempat
  melanjutkan query dengan variabel `$uid` kosong setelah request 500, sehingga
  memunculkan galat sintaks SQL beruntun di output; itu efek lanjutan skrip saya,
  bukan perilaku aplikasi.
- **DIPERBAIKI**: tujuh aturan validasi diberi prefix koneksi `mysql.` agar menunjuk database pusat tempat `users`/`roles`/`permissions` benar-benar berada.

