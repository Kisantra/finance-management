# Deploy ke Server (VPS)

Satu perintah untuk semua keadaan server, dijalankan dari folder aplikasi:

```bash
./deploy.sh            # tampilkan rencana, minta konfirmasi, lalu jalankan
./deploy.sh --yes      # tanpa konfirmasi
./deploy.sh --force    # pembaruan rutin walau tidak ada commit baru (mis. build ulang)
```

Tidak ada nilai yang perlu diketik. Skrip memilih sendiri dari bentuk database di `.env` (`DB_DATABASE`):

| Bentuk database | Yang dilakukan `./deploy.sh` | Lalu di website |
|---|---|---|
| **Kosong** (server baru) | Instalasi: struktur database, peran & izin, lalu mencetak **tautan pemasangan** sekali pakai | Walkthrough: akun admin → perusahaan pertama → profil perusahaan |
| **Versi lama** (satu perusahaan, sebelum multi-perusahaan) | Konversi otomatis: perusahaan yang sudah berjalan menjadi **perusahaan utama** (`/c/utama`) | Admin melengkapi profil (singkatan dll.) dan meninjau nomor invoice lama |
| **Multi-perusahaan** | Pembaruan rutin | — |

Nama, singkatan, dan kode URL perusahaan lain **selalu diatur di website**, tidak pernah di terminal.

**Server yang masih memakai `deploy.sh` lama** (versi sebelum multi-perusahaan): jalankan versi baru ini **satu kali** dari folder aplikasi:

```bash
git fetch origin && bash <(git show origin/main:deploy.sh)
```

Sesudah itu cukup `./deploy.sh`. **`deploy.sh` memperbarui dirinya sendiri:** sebelum memilih mode, ia mengambil info dari GitHub; bila `deploy.sh` di `origin/main` berbeda dari yang ada di server, versi terbaru itu yang dijalankan (pesan "versi terbaru itu yang dijalankan" muncul di baris pertama). Jadi langkah deploy baru berlaku pada deploy yang sama, bukan baru pada deploy berikutnya. Ini berlaku setelah versi yang punya fitur ini sudah sekali terpasang di server. Kalau yang terlanjur dijalankan `./deploy.sh` lama, ia berhenti dengan aman di langkah migrasi (kode baru menolak `migrate` maupun `migrate:rollback` di database lama) dan situs tetap maintenance. **Jangan ikuti saran `migrate:rollback` yang dicetaknya.** Kembalikan kode (`git reset --hard <commit sebelumnya>`, `composer install`, `npm ci`, `npm run build`, `php artisan optimize:clear`, `php artisan up`), lalu jalankan perintah di atas.

Istilah:

- **Database pusat**: berisi akun user, role, daftar perusahaan.
- **Database perusahaan**: satu per perusahaan, berisi invoice, rekening, transaksi, dan data bisnis lain.
- **Maintenance**: situs menampilkan halaman "sedang perbaikan" selama deploy.
- **Canary**: perusahaan pertama yang dimigrasi sebagai percobaan; kalau gagal, perusahaan lain tidak disentuh.

---

## Pembaruan rutin

| # | Langkah | Kenapa begini |
|---|---|---|
| 1 | Cek prasyarat (`git php composer node npm mysql mysqldump gzip tar`, `.env`) | Gagal di awal lebih murah daripada di tengah. |
| 2 | `git fetch`; tolak bila ada file diubah langsung di server, branch bukan `main`, atau riwayat bercabang. Tampilkan commit, jumlah migrasi baru (pusat / per perusahaan), canary, perubahan lockfile | Tahu apa yang akan diterapkan sebelum situs dimatikan. Tidak ada commit baru → berhenti. |
| 3 | `php artisan central:backup --dir=storage/app/backups/deploy-<waktu>` | Satu `.sql.gz` per database. Folder lebih tua dari 14 hari dibuang otomatis. |
| 4 | `php artisan down --retry=60` | Pengguna tidak melihat aplikasi setengah terpasang. |
| 5 | Buang cache config/route/event lama (hapus berkasnya), lalu `git merge --ff-only <commit yang tadi ditampilkan>` | Yang dipasang persis yang ditampilkan. Cache lama dibuang tanpa mengosongkan cache aplikasi, supaya worker antrean tidak restart saat kode belum lengkap. |
| 6 | `composer install --no-dev --optimize-autoloader` | Versi persis dari `composer.lock`. |
| 7 | `npm ci` | Versi persis dari `package-lock.json`. |
| 8 | `php artisan central:deploy-migrate --force --canary=<slug>` | Database pusat dulu, lalu canary, lalu perusahaan lain satu per satu. Canary = `DEPLOY_CANARY` di `.env`, atau perusahaan aktif tertua. |
| 9 | `php artisan central:sync-admin-permissions` | Role **admin** selalu memegang **semua** permission, termasuk yang baru. |
| 10 | `npm run build` (berkas `public/hot` dihapus dulu) | `public/hot` sisa `npm run dev` membuat semua halaman putih. |
| 11 | `php artisan optimize:clear` lalu `optimize` | Buang cache lama, buat ulang dari kode baru. |
| 12 | `php artisan permission:cache-reset` | Permission/role baru langsung terbaca. |
| 13 | `php artisan queue:restart` | Worker antrean memuat kode baru. |
| 14 | `php artisan up`, lalu `central:tenants-status` | Situs online; tiap perusahaan harus `Migration pending 0`. |

### Bila pembaruan gagal

Skrip berhenti, menampilkan 20 baris terakhir log, dan **situs tetap maintenance**. Perintah pemulihan dicetak sudah terisi:

1. Perbaiki lalu ulangi: `./deploy.sh --force` (migration yang sudah tercatat tidak diulang), atau buka apa adanya: `php artisan up`.
2. Kembali ke kode sebelumnya: `git reset --hard <commit sebelumnya>` → `composer install … && npm ci && npm run build` → `php artisan optimize:clear && php artisan optimize && php artisan up`. Database tidak perlu dikembalikan: migration wajib **expand-contract** (hanya menambah), jadi kode lama tetap jalan di skema baru.
3. Pulihkan satu database dari backup hanya bila datanya rusak: `gunzip < storage/app/backups/deploy-<waktu>/<database>.sql.gz | mysql -u <user> -p <database>`.

---

## Konversi server lama (otomatis, sekali)

Database lama **disalin** menjadi database perusahaan utama, user dan role dipindah ke database pusat baru, berkas lampiran disalin ke folder perusahaan. **Data di database lama tidak pernah diubah** (satu-satunya tulisan: sinyal restart worker antrean di tabel `cache`-nya), jadi kembali ke versi lama selalu mungkin.

Nama yang dipakai, semuanya diturunkan dari nama database lama (`<db_lama>`) supaya unik walau server MySQL dipakai bersama instalasi lain:

| | Nama |
|---|---|
| Database pusat | `<db_lama>_central` |
| Database perusahaan utama | `<db_lama>_tenant_utama` |
| Awalan database perusahaan berikutnya (`TENANCY_DB_PREFIX` di `.env`) | `<db_lama>_tenant_` |
| Alamat perusahaan utama | `/c/utama/...` |

### Persiapan

- **Hak MySQL.** User MySQL di `.env` harus boleh membuat dan memakai database berawalan nama database lama. Sekali, sebagai root (di CloudPanel: kredensial master, `clpctl db:show:master-credentials`):
  ```sql
  GRANT ALL PRIVILEGES ON `<db_lama>\_%`.* TO '<user_app>'@'<host>';
  ```
  `<host>` mengikuti user itu (`SELECT CURRENT_USER();` sebagai user aplikasi): CloudPanel membuatnya `%`, bukan `localhost`, dan GRANT ke host yang salah ditolak MySQL. Izin yang sama dipakai nanti saat menambah perusahaan dari menu Perusahaan. Tanpa izin ini, skrip berhenti **sebelum** situs dimatikan dan mencetak perintah GRANT yang persis untuk server itu.
- **Jendela 1 jam.** Lamanya ditentukan dump + restore data, `composer install`, `npm ci`, `npm run build`.

### Yang dilakukan, berurutan

| # | Langkah | Catatan |
|---|---|---|
| 1-2 | Prasyarat, `git fetch`, pemeriksaan sebelum downtime, konfirmasi | Pemeriksaan: database tujuan baru/kosong; `BCRYPT_ROUNDS` tidak lebih rendah dari cost hash sandi lama; tidak ada migration perusahaan yang hanya diberi tanggal baru; kueri baseline cocok dengan skema lama. Situs masih online. |
| 3 | Buat database pusat dan database perusahaan utama | Masih online. |
| 4 | `php artisan down` | |
| 5 | Bekukan: dump DB lama → `freeze.sql.gz`, arsip `storage/app/public`, salinan `.env` → `env-lama` | Di `storage/app/cutover/utama/`. |
| 6 | Baseline sebelum: jumlah baris, total nilai, saldo per rekening, nomor invoice | `docs/migrasi/verifikasi-baseline.sql`. |
| 7 | Pulihkan dump sebagai database perusahaan utama, cocokkan jumlah invoice & transaksi | |
| 8-11 | Tarik kode, `composer install`, `npm ci`, `npm run build` | |
| 12 | `.env`: `DB_DATABASE`, `LEGACY_DB_DATABASE`, `TENANCY_DB_PREFIX` | Mulai sini aplikasi membaca database pusat. |
| 13 | Database pusat: `migrate`, `MasterPermissionSeeder`, role & izin disalin dari DB lama, admin diberi semua izin | Role buatan sendiri dan izin yang pernah diubah lewat Izin & Peran ikut. |
| 14 | Grup (organization) dari nama perusahaan | |
| 15 | `central:adopt-database utama` | Lulus hanya bila 0 migration perusahaan tertunda. |
| 16 | `central:import-users legacy` | **ID user lama dipertahankan** (data bisnis menyimpan ID user); sandi lama tetap berlaku. |
| 17 | Salin riwayat feedback | |
| 18 | `central:adopt-storage utama` (menyalin) + `storage:link` | |
| 19 | Baseline sesudah dibandingkan | Harus identik kecuali blok urutan & pola nomor invoice. |
| 20 | Cache + restart worker antrean | Sinyal restart juga ke cache database lama, tempat worker lama menunggu. |
| 21 | `php artisan up`, backup pertama, `central:tenants-status` | |

### Sesudahnya di website (segera, sebelum staff masuk)

1. Login sebagai admin dengan sandi lama. Aplikasi langsung membuka **Profil Perusahaan**: lengkapi isian yang kosong, terutama **Singkatan** (kode di nomor invoice; form menampilkan nomor invoice terakhir sebagai rujukan).
2. Bila ada invoice lama yang belum punya urutan nomor, aplikasi membuka **Penomoran invoice** dengan pratinjau: berapa nomor cocok dengan pola, mana yang tidak. Pola menentukan nomor invoice **berikutnya**: ubah hanya bila nomor lama memakai format yang masih ingin dilanjutkan (Simpan). Nomor berformat lama yang sudah tidak dipakai atau diketik manual biarkan saja; nomornya tetap sah, dan nomor baru berformat lain tidak bisa sama (kolom nomor invoice unik). Lalu klik **Isi urutan & selesai meninjau**.
3. Sampai kedua langkah itu selesai, user lain melihat halaman "perusahaan belum disiapkan". Bookmark lama staf (mis. `/invoices`) tetap jalan: alamat modul tanpa `/c/...` diarahkan ke perusahaan pengguna (tamu diminta login dulu; anggota beberapa perusahaan ke pemilih perusahaan).
4. Cek: buat draft invoice → terbitkan → nomornya melanjutkan nomor terakhir → hapus draft itu; unduh satu PDF.
5. **Salin `storage/app/cutover/utama/` ke luar server.** Isinya dump data lama dan rahasia `.env` lama. Biarkan database lama dan `storage/app/public` dulu seminggu.

### Bila konversi gagal

Skrip berhenti di langkah itu dan mencatat langkah yang sudah selesai. Dua jalan:

1. **Lanjutkan**: perbaiki penyebabnya, jalankan perintah yang sama (`./deploy.sh`, atau versi dari GitHub bila kode belum ditarik). Langkah yang sudah selesai dilewati.
2. **Kembali ke versi lama sepenuhnya** (data database lama tidak pernah diubah): `cp storage/app/cutover/utama/env-lama .env` (bila `.env` sudah diganti) → `git reset --hard <commit lama>` → `composer install … && npm ci && npm run build` → `php artisan optimize:clear && php artisan optimize && php artisan up`.

Mengulang dari nol: hapus database pusat baru, database perusahaan utama, dan folder `storage/app/cutover/utama`. Ketiganya salinan baru; lakukan manual setelah yakin.

---

## Instalasi baru (server kosong)

1. Di panel (CloudPanel): buat situs dan **database kosong**. Taruh kode di folder situs dan isi `.env` (salinan `.env.example`): `APP_URL`, `APP_ENV=production`, `APP_DEBUG=false`, kredensial `DB_*`.
2. Hak MySQL untuk membuat database perusahaan (sekali, sebagai root): `` GRANT ALL PRIVILEGES ON `<db>\_%`.* TO '<user_app>'@'<host>'; `` (host mengikuti user itu; di CloudPanel `%`). User buatan panel biasanya hanya berhak atas satu database; `deploy.sh` memeriksanya lebih dulu (membuat lalu menghapus database uji `<db>_tenant_cek<angka>`) dan berhenti sambil mencetak perintah GRANT ini bila haknya belum ada.
3. Jalankan `./deploy.sh`. Ia memasang paket, membangun aset, membuat `APP_KEY` bila kosong, mengisi `TENANCY_DB_PREFIX=<db>_tenant_`, menyiapkan database pusat (struktur, peran, izin), lalu mencetak **tautan pemasangan** `https://domain/setup/<token>`.
4. Buka tautan itu. Walkthrough meminta:
   - **Akun admin**: nama, email, kata sandi.
   - **Perusahaan pertama**: nama, **kode URL** (permanen, dengan pratinjau alamat), **singkatan**. Kode URL & singkatan disarankan otomatis dari nama.
5. Sesudah disimpan, Anda langsung masuk dan dibawa ke **Profil Perusahaan** yang wajib dilengkapi (alamat, kontak, penanggung jawab keuangan). Setelah itu aplikasi siap.

Tautan itu sekali pakai: berkasnya terhapus begitu admin pertama dibuat. Selama belum dipakai, semua halaman situs diarahkan ke walkthrough.

Instalasi yang terputus (atau tautannya hilang sebelum walkthrough selesai): jalankan `./deploy.sh` lagi. Selama database pusat belum punya user, skrip tetap memilih mode instalasi, mengulang langkah yang aman diulang, dan mencetak tautan yang sama. Bila pembuatan database perusahaan gagal di walkthrough, sisa percobaan itu dibuang sehingga kode URL yang sama bisa langsung dicoba lagi.

`deploy.sh` menolak jalan bila `DB_DATABASE` berisi tabel yang bukan milik aplikasi ini (mis. salah menunjuk database aplikasi lain).

---

## Permission baru: lewat migrasi, bukan seeder

`MasterPermissionSeeder` memanggil `syncPermissions()` untuk role admin, finance manager, dan staff: izin role **disetel ulang** ke daftar di seeder, sehingga perubahan dari halaman Izin & Peran hilang. Karena itu seeder **tidak** dijalankan saat pembaruan rutin (hanya saat instalasi/konversi ke database pusat yang masih kosong).

Setiap permission baru dibawa oleh migrasi yang hanya menambah, contoh `database/migrations/2026_10_08_005001_add_manage_invoice_settings_permission.php`:

```php
app()[PermissionRegistrar::class]->forgetCachedPermissions();
Permission::firstOrCreate(['name' => 'manage invoice settings']);
foreach (['admin', 'finance manager'] as $roleName) {
    Role::where('name', $roleName)->first()?->givePermissionTo('manage invoice settings');
}
```

Tambahkan juga nama permission ke `MasterPermissionSeeder` agar instalasi baru ikut memilikinya.

**Role admin tidak perlu diurus.** Tiap deploy menjalankan `php artisan central:sync-admin-permissions`, yang memberi role `admin` semua permission yang ada. Halaman Izin & Peran mengunci role admin (tidak bisa dicabut izinnya atau diganti namanya), supaya admin tidak bisa mengunci dirinya sendiri keluar.

## Persiapan sekali di server (bila belum)

- `.env` production: `APP_ENV=production`, `APP_DEBUG=false`, kredensial DB. Opsional `DEPLOY_CANARY=<slug>` untuk memilih canary.
- **`TENANCY_DB_PREFIX` jangan diubah** setelah diisi `deploy.sh`: nama database perusahaan yang dibuat sebelumnya bergantung padanya.
- Worker antrean berjalan terus (Supervisor): `php artisan queue:work`.
- Cron scheduler: `* * * * * cd /path/aplikasi && php artisan schedule:run >> /dev/null 2>&1`.
- **Watchpost (pemantauan error):** isi `WATCHPOST_URL` dan `WATCHPOST_TOKEN` di `.env` (dari Watchpost › Website › Tambah website; token hanya tampil sekali), lalu `php artisan watchpost:test`. Selama kosong, package `kisantra/watchpost-laravel` tidak mengirim apa pun. Hanya `APP_ENV=production` yang melapor. Heartbeat tiap menit berjalan lewat cron scheduler di atas, jadi kalau cron mati Watchpost ikut tahu. Laporan **Bug** dari menu Feedback diteruskan ke Watchpost lewat antrean (worker di atas wajib jalan); matikan dengan `WATCHPOST_TICKETS=false`. Status tiketnya kembali ke pelapor lewat `watchpost:sync-tickets` tiap menit, jadi cron scheduler juga wajib jalan. Watchpost harus sudah punya endpoint `/api/ingest/tickets` dan `/api/ingest/tickets/updates` (rilis 6 Nov 2026) sebelum fitur ini dipakai. Pengaturan lain: README package.
- `storage/` dan `bootstrap/cache/` bisa ditulis user web server; `chmod +x deploy.sh` bila bit executable hilang.
- **Koneksi Claude (MCP):** PHP wajib memuat ekstensi `sodium` (cek `php -m | grep sodium`; tanpa itu `composer install` gagal). Kunci OAuth `storage/oauth-{private,public}.key` dibuat sekali bila belum ada, oleh `deploy.sh` atau otomatis saat pemegang izin `use claude` membuka Pengaturan › Koneksi Claude, dan **tidak pernah ditimpa**; jangan menghapusnya, karena kunci baru memutus semua sambungan Claude yang sudah disetujui. Cadangkan kedua berkas itu bersama `.env`. Detail: `docs/module/koneksi-claude.md`.
