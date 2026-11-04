# Deploy ke Server (VPS)

Satu skrip untuk dua keadaan server. Jalankan dari folder aplikasi di server.

| Keadaan server | Perintah | Seberapa sering |
|---|---|---|
| Sudah multi-perusahaan (alamat `/c/<slug>/...`) | `./deploy.sh` | setiap rilis |
| Masih versi lama, satu database untuk satu perusahaan | `git fetch origin && bash <(git show origin/main:deploy.sh) --cutover --slug=<slug> --singkatan=<ABC>` | **sekali saja** |

Skrip memeriksa sendiri bentuk databasenya. `./deploy.sh` biasa di server lama menolak jalan dan menunjukkan perintah cutover; `--cutover` di server yang sudah multi-perusahaan juga menolak.

Istilah yang dipakai di bawah:

- **Database pusat**: satu database berisi akun user, role, daftar perusahaan.
- **Database perusahaan (tenant)**: satu database per perusahaan, bernama `tenant_<slug>`, berisi invoice, rekening, transaksi, dan data bisnis lain.
- **Maintenance**: situs menampilkan halaman "sedang perbaikan" selama deploy, supaya tidak ada yang memakai aplikasi setengah terpasang.
- **Canary**: perusahaan pertama yang dimigrasi sebagai percobaan. Kalau migrasinya gagal di sana, perusahaan lain tidak disentuh.

---

## Deploy rutin

```bash
./deploy.sh            # tampilkan commit yang masuk, minta konfirmasi, lalu deploy
./deploy.sh --yes      # tanpa konfirmasi
./deploy.sh --force    # ulangi semua langkah walau tidak ada commit baru (mis. build ulang)
```

| # | Langkah | Kenapa begini |
|---|---|---|
| 1 | Cek prasyarat (`git php composer node npm mysql mysqldump gzip tar`, `.env`, koneksi MySQL) | Gagal di awal lebih murah daripada di tengah. |
| 2 | `git fetch`; tolak bila ada file diubah langsung di server, branch bukan `main`, riwayat bercabang, cutover belum selesai, atau database masih versi lama. Tampilkan commit, jumlah migrasi baru (pusat / per perusahaan), canary, dan perubahan lockfile | Tahu apa yang akan diterapkan sebelum situs dimatikan. Tidak ada commit baru → berhenti. |
| 3 | `php artisan central:backup --dir=storage/app/backups/deploy-<waktu>` | Satu `.sql.gz` per database (pusat + semua perusahaan). Folder lebih tua dari 14 hari dibuang otomatis. |
| 4 | `php artisan down --retry=60` | Pengguna tidak melihat aplikasi setengah terpasang. |
| 5 | Buang cache config/route/event lama (hapus berkasnya), lalu `git merge --ff-only <commit yang tadi ditampilkan>` | Yang dipasang persis yang tadi ditampilkan, walau ada push baru di tengah jalan. Cache lama dibuang tanpa mengosongkan cache aplikasi, supaya worker antrean tidak restart saat kode belum lengkap. |
| 6 | `composer install --no-dev --optimize-autoloader` | **Bukan `composer update`**: versi persis dari `composer.lock` yang sudah dites. |
| 7 | `npm ci` | **Bukan `npm install`**: versi persis dari `package-lock.json`. |
| 8 | `php artisan central:deploy-migrate --force --canary=<slug>` | Database pusat dulu, lalu canary, lalu perusahaan lain satu per satu, dengan laporan per perusahaan. Canary = `DEPLOY_CANARY` di `.env`, atau perusahaan aktif tertua. |
| 9 | `npm run build` (berkas `public/hot` sisa `npm run dev` dihapus dulu) | `public/build` tidak disimpan di git. `public/hot` yang tertinggal membuat semua halaman putih. |
| 10 | `php artisan optimize:clear` lalu `optimize` | Buang cache lama, buat ulang dari kode baru. |
| 11 | `php artisan permission:cache-reset` | Permission/role baru dari migrasi langsung terbaca. |
| 12 | `php artisan queue:restart` | Worker antrean memuat kode baru setelah tugas yang sedang jalan selesai. |
| 13 | `php artisan up`, lalu tampilkan `central:tenants-status` | Situs online; tiap perusahaan harus `Migration pending 0`. |

Tiap langkah menampilkan nomor, jam mulai, spinner + waktu berjalan + baris terakhir output, lalu ✓ dan durasinya. Output lengkap: `storage/logs/deploy-<waktu>.log`.

### Bila deploy rutin gagal

Skrip berhenti, menampilkan 20 baris terakhir log, dan **situs tetap maintenance**. Perintah pemulihan dicetak sudah terisi:

1. Perbaiki lalu ulangi: `./deploy.sh --force` (migration yang sudah tercatat tidak diulang), atau buka apa adanya: `php artisan up`.
2. Kembali ke kode sebelumnya: `git reset --hard <commit sebelumnya>` → `composer install … && npm ci && npm run build` → `php artisan optimize:clear && php artisan optimize && php artisan up`. Database tidak perlu dikembalikan karena migration wajib **expand-contract**: hanya menambah (kolom/tabel baru, nullable), tidak menghapus, sehingga kode lama tetap jalan di skema baru.
3. Pulihkan satu database dari backup hanya bila datanya rusak: `gunzip < storage/app/backups/deploy-<waktu>/<database>.sql.gz | mysql -u <user> -p <database>`.

Kalau canary gagal, perusahaan lain tidak tersentuh. Kalau perusahaan lain yang gagal, tabel laporan di log menyebut perusahaan mana.

---

## Cutover sekali jalan: server lama → multi-perusahaan

Untuk server yang masih menjalankan versi satu-database. Cutover memindahkan data ke bentuk baru: database lama **disalin** menjadi database perusahaan, user dan role dipindah ke database pusat baru, berkas lampiran disalin ke folder perusahaan.

**Data di database lama tidak pernah diubah.** Satu-satunya tulisan ke sana adalah sinyal restart worker antrean di tabel `cache` (bila cache memakai database), supaya worker lama berhenti membaca antrean lama. Selama arsip `.env` lama masih ada, kembali ke versi lama selalu mungkin.

### Jangan jalankan `./deploy.sh` yang lama

`deploy.sh` yang ada di server masih versi lama. Ia akan menarik kode baru lalu menjalankan `migrate` ke database lama. Rilis ini memasang pengaman (`AppServiceProvider`): kode baru menolak menjalankan migration, maju maupun mundur, terhadap database satu-perusahaan, sebelum menyentuh apa pun. Kalau itu terlanjur terjadi, deploy lama berhenti dengan situs maintenance dan mencetak saran `migrate:rollback`. **Jangan ikuti saran itu** (pengaman juga menolaknya). Cukup kembalikan kode (`git reset --hard <commit sebelumnya>`, `composer install`, `npm ci`, `npm run build`, `php artisan optimize:clear`, `php artisan up`), lalu jalankan cutover di bawah.

### Sebelum hari-H

- **Latih dulu** di salinan bila memungkinkan: `docs/migrasi/latihan-cutover.sh`.
- **Pola nomor invoice.** Invoice lama yang belum punya urutan nomor dicocokkan dengan pola di *Pengaturan › Penomoran invoice*. Samakan polanya dengan riwayat nomor Anda di aplikasi lama sebelum cutover. Kalau ada yang tidak cocok, cutover berhenti sebelum situs dibuka (lihat "Dijeda" di bawah).
- **Hak MySQL.** User MySQL di `.env` harus boleh membuat dua database baru (pusat dan `tenant_<slug>`). Di CloudPanel biasanya tidak boleh: buat dulu dua database kosong itu lewat panel (utf8mb4), beri user aplikasi hak penuh atasnya. Skrip memakai database yang sudah ada asalkan masih kosong.
- **Jendela 1 jam.** Yang menentukan lamanya: dump + restore data, `composer install`, `npm ci`, `npm run build`.

### Perintah

```bash
cd /path/aplikasi
git fetch origin
bash <(git show origin/main:deploy.sh) --cutover --slug=kisantra --singkatan=KSN
```

| Opsi | Arti |
|---|---|
| `--slug=` (wajib) | 3-40 huruf kecil/angka/strip. **Permanen**: jadi alamat `/c/<slug>`, nama database `tenant_<slug>`, dan folder berkas. |
| `--singkatan=` (wajib) | 2-10 huruf, dipakai di nomor invoice (`{PT}`). |
| `--nama=` | Nama perusahaan. Bawaan: nama di profil perusahaan DB lama. |
| `--organisasi=` | Nama grup. Bawaan: sama dengan nama perusahaan. |
| `--db-pusat=` | Nama database pusat baru. Bawaan: `<slug>_central`. |
| `--abaikan-nomor-tak-cocok` | Lanjut walau masih ada nomor invoice lama di luar pola (nomor yang memang diketik manual). |
| `--yes` | Tanpa konfirmasi. Tanpa ini, skrip meminta Anda mengetik slug. |

Sebelum mematikan situs, skrip memeriksa: database lama memang satu-database; dua database tujuan baru atau kosong; `BCRYPT_ROUNDS` tidak lebih rendah dari cost hash sandi lama (kalau lebih rendah, impor user mati di user pertama); tidak ada migration perusahaan yang hanya diberi tanggal baru; dan kueri baseline cocok dengan skema lama. Lalu menampilkan rencana: nama-nama database, jumlah user/invoice/berkas, serta peringatan (invoice tanpa urutan, job antrean yang tertinggal, izin langsung per-user yang tidak ikut pindah).

### Yang dilakukan, berurutan

| # | Langkah | Catatan |
|---|---|---|
| 1-2 | Prasyarat, `git fetch`, pemeriksaan di atas, konfirmasi | Situs masih online. |
| 3 | Buat database pusat dan `tenant_<slug>` bila belum ada | Masih online. |
| 4 | `php artisan down --secret=<acak>` | Secret dipakai bila cutover dijeda. |
| 5 | Bekukan: dump DB lama → `freeze.sql.gz`, arsip `storage/app/public` → `storage-lama.tgz`, salin `.env` → `env-lama` | Disimpan di `storage/app/cutover/<slug>/`. |
| 6 | Baseline sebelum: jumlah baris, total nilai, saldo per rekening, nomor invoice | `docs/migrasi/verifikasi-baseline.sql`. |
| 7 | Pulihkan dump sebagai `tenant_<slug>`, cocokkan jumlah invoice & transaksi | |
| 8-11 | Tarik kode, `composer install`, `npm ci`, `npm run build` | |
| 12 | `.env`: `DB_DATABASE=<db pusat>`, `LEGACY_DB_DATABASE=<db lama>` | Mulai sini aplikasi membaca database pusat. |
| 13 | Database pusat: `migrate`, `MasterPermissionSeeder`, lalu **role & izin disalin dari DB lama** | Role buatan sendiri ikut; izin yang diubah lewat halaman Izin & Peran dipertahankan; izin yang baru ada di rilis ini mengikuti bawaan. |
| 14 | `central:bootstrap --tanpa-admin` | Hanya organization. Admin datang dari user lama. |
| 15 | `central:adopt-database` | Mendaftarkan perusahaan + menjalankan migration perusahaan. Lulus hanya bila **0 migration tertunda**. |
| 16 | `central:import-users legacy` | **ID user lama dipertahankan**: data bisnis menyimpan ID user (pemilik reimbursement, penyetuju, pencair dana). Dicek: setiap user lama punya pasangan ID + email yang sama di pusat. Sandi lama tetap berlaku. |
| 17 | Salin riwayat feedback ke database pusat | |
| 18 | `central:adopt-storage` (menyalin, asli tetap ada) + `storage:link` | Dicek: jumlah berkas di folder perusahaan ≥ folder lama. |
| 19-20 | Urutan nomor invoice: kering dulu, lalu isi | Lihat "Dijeda" di bawah. |
| 21 | Baseline sesudah dibandingkan dengan sebelum | Harus identik kecuali blok urutan & pola nomor invoice. Berbeda = berhenti. |
| 22 | Cache + restart worker antrean | Sinyal restart juga dikirim ke cache database lama: worker yang masih hidup membaca config lama dan menunggu sinyal di sana. |
| 23 | `php artisan up`, backup pertama arsitektur baru, `central:tenants-status` | |

### Dijeda di nomor invoice

Bila ada invoice lama yang nomornya tidak cocok dengan pola aktif, skrip berhenti dengan kode keluar 2, **situs tetap maintenance**, dan mencetak:

1. alamat untuk melewati maintenance (`<APP_URL>/<secret>`), lalu halaman *Pengaturan › Penomoran invoice* perusahaan baru. Login dengan akun admin lama, samakan pola dengan riwayat nomor;
2. perintah lanjut: `./deploy.sh --cutover --slug=<slug>`. Sisa nomor yang memang diketik manual di luar pola: tambahkan `--abaikan-nomor-tak-cocok`.

Tanpa urutan ini, invoice berikutnya bisa mengulang nomor yang sudah terkirim ke klien.

### Bila cutover gagal

Skrip berhenti di langkah itu dan mencatat langkah yang sudah selesai di `storage/app/cutover/<slug>/langkah`. Dua jalan:

1. **Lanjutkan**: perbaiki penyebabnya, jalankan perintah yang sama. Langkah yang sudah selesai dilewati.
2. **Kembali ke versi lama sepenuhnya** (data database lama tidak pernah diubah): `cp storage/app/cutover/<slug>/env-lama .env` (bila `.env` sudah diganti) → `git reset --hard <commit lama>` → `composer install … && npm ci && npm run build` → `php artisan optimize:clear && php artisan optimize && php artisan up`.

Mengulang dari nol: hapus database pusat baru, `tenant_<slug>`, dan folder `storage/app/cutover/<slug>`. Ketiganya salinan baru; lakukan manual setelah yakin.

### Sesudah selesai

- **Salin `storage/app/cutover/<slug>/` ke luar server**, lalu simpan. Isinya dump data lama dan rahasia `.env` lama.
- Cek dengan mata: login dengan akun + sandi lama; akun staff tetap ditolak di halaman yang memang bukan haknya, sama seperti versi lama (izin yang pernah diubah lewat Izin & Peran ikut terbawa); buat draft invoice → terbitkan → nomornya melanjutkan nomor terakhir → hapus; unduh satu PDF; buka satu transaksi berlampiran.
- Database lama dan `storage/app/public` biarkan dulu seminggu.
- Membuat perusahaan baru dari menu Perusahaan butuh user MySQL yang boleh `CREATE DATABASE` (runbook §G.1).
- Deploy berikutnya cukup `./deploy.sh`.

Penjelasan tiap langkah dan hasil latihannya: `docs/multi-tenancy-runbook-eksekusi.md` §G.2.

---

## Permission baru: lewat migrasi, bukan seeder

`MasterPermissionSeeder` memanggil `syncPermissions()` untuk role admin, finance manager, dan staff: izin role **disetel ulang** ke daftar di seeder, sehingga perubahan dari halaman Izin & Peran hilang. Karena itu seeder **tidak** dijalankan saat deploy rutin. (Cutover menjalankannya sekali ke database pusat yang masih kosong, lalu menimpanya dengan izin dari DB lama.)

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

- `.env` production: `APP_ENV=production`, `APP_DEBUG=false`, kredensial DB. Opsional `DEPLOY_CANARY=<slug>` untuk memilih canary.
- `php artisan storage:link`.
- Worker antrean berjalan terus (Supervisor): `php artisan queue:work`.
- Cron scheduler: `* * * * * cd /path/aplikasi && php artisan schedule:run >> /dev/null 2>&1`.
- `storage/` dan `bootstrap/cache/` bisa ditulis user web server; `chmod +x deploy.sh` bila bit executable hilang.
