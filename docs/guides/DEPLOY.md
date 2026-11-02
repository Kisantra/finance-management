# Deploy ke Server (VPS)

Satu perintah dari folder aplikasi di server:

```bash
./deploy.sh            # tampilkan commit yang masuk, minta konfirmasi, lalu deploy
./deploy.sh --yes      # tanpa konfirmasi
./deploy.sh --force    # ulangi semua langkah walau tidak ada commit baru (mis. build ulang)
```

## Yang dilakukan, berurutan

| # | Langkah | Kenapa begini |
|---|---|---|
| 1 | Cek prasyarat (`git php composer node npm mysqldump gzip`, `.env`) | Gagal di awal lebih murah daripada di tengah. |
| 2 | `git fetch`, tolak bila ada file diubah langsung di server / branch bukan `main` / riwayat bercabang; tampilkan daftar commit, jumlah migrasi baru, dan apakah `composer.lock`/`package-lock.json` berubah | Tahu apa yang akan diterapkan sebelum situs dimatikan. Tidak ada commit baru → berhenti. |
| 3 | Backup database → `storage/backups/db-<waktu>.sql.gz` (10 terbaru disimpan) | Jalan pulang bila migrasi bermasalah. Kredensial dibaca dari `.env`; password lewat `MYSQL_PWD`, tidak tampil di daftar proses. |
| 4 | `php artisan down --retry=60` | Pengguna tidak melihat aplikasi setengah terpasang. |
| 5 | `git pull --ff-only` | Menolak merge diam-diam di server. |
| 6 | `composer install --no-dev --optimize-autoloader` | **Bukan `composer update`**: memasang versi persis dari `composer.lock` yang sudah dites di lokal. `update` mengambil versi terbaru yang belum pernah dites. |
| 7 | `npm ci` | **Bukan `npm install`**: versi persis dari `package-lock.json`. |
| 8 | `php artisan migrate --force` | Selalu dijalankan; tanpa migrasi baru perintah ini tidak melakukan apa-apa. |
| 9 | `npm run build` | `public/build` tidak disimpan di git. Plugin Wayfinder memanggil `php artisan` saat build. |
| 10 | `php artisan optimize:clear` lalu `optimize` | Buang cache config/route/view/event versi lama, lalu buat ulang dari kode baru agar tetap cepat. |
| 11 | `php artisan permission:cache-reset` | Permission/role baru dari migrasi langsung terbaca. |
| 12 | `php artisan queue:restart` | Worker antrean memuat kode baru setelah tugas yang sedang jalan selesai. |
| 13 | `php artisan up` | Situs kembali online. |

Selama berjalan, tiap langkah menampilkan nomor, jam mulai, spinner + waktu berjalan + baris terakhir output perintah, lalu ✓ dan durasinya. Output lengkap semua perintah: `storage/logs/deploy-<waktu>.log`.

## Bila gagal

Skrip berhenti di langkah yang gagal, menampilkan 20 baris terakhir log, dan **situs tetap maintenance**. Ia mencetak perintah pemulihan yang sudah terisi (commit sebelumnya, jumlah migrasi baru, lokasi backup):

1. Perbaiki lalu ulangi: `./deploy.sh --force`, atau buka apa adanya: `php artisan up`.
2. Kembali ke versi sebelumnya: `php artisan migrate:rollback --step=N` (bila migrasi sudah jalan, **sebelum** reset) → `git reset --hard <commit sebelumnya>` → `composer install … && npm ci && npm run build` → `php artisan optimize:clear && php artisan optimize && php artisan up`.
3. Pulihkan database dari backup: `gunzip < storage/backups/db-<waktu>.sql.gz | mysql -h <host> -u <user> -p <database>`.

## Permission baru: lewat migrasi, bukan seeder

`MasterPermissionSeeder` memanggil `syncPermissions()` untuk role admin, finance manager, dan staff — izin role **disetel ulang** ke daftar di seeder, sehingga perubahan dari halaman Izin & Peran hilang. Karena itu seeder **tidak** dijalankan saat deploy (hanya untuk instalasi baru).

Setiap permission baru dibawa oleh migrasi yang hanya menambah, contoh `database/migrations/2026_10_08_005001_add_manage_invoice_settings_permission.php`:

```php
app()[PermissionRegistrar::class]->forgetCachedPermissions();
Permission::firstOrCreate(['name' => 'manage invoice settings']);
foreach (['admin', 'finance manager'] as $roleName) {
    Role::where('name', $roleName)->first()?->givePermissionTo('manage invoice settings');
}
```

Tambahkan juga nama permission ke `MasterPermissionSeeder` agar instalasi baru ikut memilikinya.

## Persiapan sekali di server (bila belum)

- `.env` production: `APP_ENV=production`, `APP_DEBUG=false`, kredensial DB.
- `php artisan storage:link` (logo/tanda tangan di PDF).
- Worker antrean berjalan terus (Supervisor): `php artisan queue:work`.
- Cron scheduler: `* * * * * cd /path/aplikasi && php artisan schedule:run >> /dev/null 2>&1`.
- `storage/` dan `bootstrap/cache/` bisa ditulis user web server; `chmod +x deploy.sh` bila bit executable hilang.
