
# Panduan Migrasi Multi-Tenancy — Untuk Dipelajari, Bukan Sekadar Dijalankan

Dokumen ini untuk Anda yang akan **melakukan migrasinya sendiri**. Tujuannya
bukan menyalin perintah, tapi paham cukup untuk tahu kapan sesuatu salah dan
apa yang harus dilakukan.

| Dokumen | Untuk apa | Kapan dibaca |
|---|---|---|
| **Panduan ini** | Memahami + berlatih | Sekarang, jauh sebelum hari-H |
| [Runbook eksekusi](multi-tenancy-runbook-eksekusi.md) | Daftar periksa hari-H | Saat menjalankan, di sebelah terminal |

---

## 1. Apa yang sebenarnya berubah

Sebelum:

```
finance_management  <- satu database, semua data di sini
```

Sesudah:

```
finance_central     <- users, roles, permissions, sessions, notifications
tenant_kisantra     <- invoice, klien, bank, pembayaran milik Kisantra
tenant_semesta      <- invoice, klien, bank, pembayaran milik Semesta
```

**Satu perusahaan = satu database sendiri.** Data bisnis tidak pernah bercampur,
karena secara fisik memang terpisah — bukan disaring pakai `WHERE company_id`.

Yang tetap satu tempat: **siapa Anda** (user, sandi, role). Karena itu satu orang
bisa jadi anggota beberapa perusahaan, dan URL-nya kini berawalan perusahaan:

```
/invoices     menjadi     /c/kisantra/invoices
```

**Konsekuensi yang harus dipegang saat migrasi:** data lama Anda semuanya adalah
*data satu perusahaan*. Jadi migrasi bukan "memecah data", melainkan **mengangkat
database lama apa adanya menjadi tenant pertama**, lalu menyalin user-nya ke
database pusat yang baru.

Itu sebabnya perintahnya bernama `adopt` — mengadopsi, bukan mengonversi. Isi
tabel bisnis Anda tidak disentuh.

---

## 2. Kosakata

Tanpa ini, perintah-perintahnya terasa seperti mantra.

| Istilah | Artinya di sini |
|---|---|
| **central** | Database pusat. Berisi user, role, permission, daftar perusahaan. |
| **tenant** | Satu perusahaan beserta database-nya sendiri (`tenant_{slug}`). |
| **slug** | Nama pendek perusahaan yang dipakai di URL — `kisantra` pada `/c/kisantra`. Sekali dipilih susah diubah, karena ikut jadi nama database. |
| **organization** | Wadah di atas perusahaan. Punya kuota berapa perusahaan boleh dibuat. |
| **adopt** | Mendaftarkan database lama yang sudah ada sebagai tenant, tanpa mengosongkannya. |
| **bootstrap** | Menyalakan instalasi yang benar-benar kosong: bikin organization + admin pertama. |
| **cutover** | Saat peralihannya sendiri: aplikasi lama dimatikan, yang baru dinyalakan. Rentang waktu aplikasi tidak bisa dipakai. |
| **baseline** | Catatan angka **sebelum** migrasi (jumlah invoice, total pembayaran, dsb.) untuk dibandingkan sesudahnya. |
| **canary** | Menguji satu perusahaan dulu sebelum semuanya. |

---

## 3. Peta perintah

Yang paling penting dari tabel ini adalah kolom terakhir.

| Perintah | Gunanya | Merusak data? |
|---|---|---|
| `central:bootstrap` | Instalasi baru: organization + admin pertama + perusahaan pertama | Menolak jalan bila sudah ada user |
| `central:adopt-database {slug}` | Daftarkan DB lama sebagai tenant | Tidak — isi tabel tidak disentuh |
| `central:import-users {koneksi}` | Salin user + role dari DB lama ke central | Tidak — idempoten, aman diulang |
| `central:adopt-storage {slug}` | Pindahkan lampiran ke folder tenant | `--pindahkan` memindahkan; tanpa itu menyalin |
| `central:tenants-status` | Lihat status semua perusahaan | Hanya membaca |
| `central:backup` | Backup central + semua tenant | Hanya membaca |
| `central:deploy-migrate` | Migration terkontrol untuk rilis berikutnya | Mengubah struktur |
| `tenants:migrate` | Terapkan migration bisnis ke tenant | Mengubah struktur |
| `tenants:migrate-fresh` | **Mengosongkan lalu memigrasi ulang** | **YA — menghapus semua data tenant** |

Satu-satunya baris yang benar-benar berbahaya adalah yang terakhir. Jangan pernah
mengetiknya di server produksi, dan waspadai kemiripan namanya dengan
`tenants:migrate`.

Pakai `--dry-run` setiap kali tersedia — **selalu**, walau Anda yakin.

---

## 4. Anda ada di jalur yang mana?

```
Apakah server tujuan sudah punya data invoice/klien sungguhan?
|
+-- TIDAK  ->  Jalur A (Server Baru).      ~10 menit. Risiko nyaris nol.
|
+-- YA     ->  Jalur B (Server Berjalan).  ~1 jam, plus latihan.
                Latihan dulu wajib, bukan saran.
```

Menjalankan perintah jalur yang salah adalah cara tercepat merusak data.
Tentukan ini sebelum mengetik apa pun.

---

## 5. Jalur A — Server Baru

Situasinya: aplikasi dipasang di tempat yang belum punya data apa-apa.

### Langkah 0 — hanya bila Anda berlatih di mesin sendiri

Di server baru sungguhan langkah ini tidak ada: `.env` tinggal diisi sekali dan
tidak ada yang perlu diselamatkan. Tapi mesin Anda sudah berisi konfigurasi yang
dipakai sehari-hari, jadi cadangkan dulu sebelum mengarahkannya ke database
latihan.

```bash
cp .env .env-backup-belajar
sed -i 's/^DB_DATABASE=.*/DB_DATABASE=belajar_central/' .env
php artisan config:clear
grep '^DB_DATABASE=' .env
```

Baris terakhir harus mencetak `DB_DATABASE=belajar_central`. Kalau bukan itu,
jangan lanjut.

`config:clear` perlu karena Laravel bisa menyimpan konfigurasi di cache. Tanpa
itu `.env` sudah berubah tapi aplikasi masih memakai nilai lama — dan perintah
berikutnya menyasar database yang salah.

Kebiasaan yang dibangun di sini berlaku sampai hari-H: **setiap perintah yang
mengubah sesuatu, ikuti dengan perintah yang membuktikannya.** Jangan pernah
menganggap berhasil hanya karena tidak ada pesan error.

### Langkah

```bash
# 1. Kode & aset
git pull
composer install --no-dev -o
npm ci && npm run build

# 2. Periksa .env — daftar lengkapnya di bagian 7
#    DB_CONNECTION=mysql
#    DB_DATABASE=finance_central
#    APP_ENV=production, APP_DEBUG=false, APP_KEY terisi

# 3. Struktur database pusat
php artisan migrate --force

# 4. Hak akses & role — WAJIB
php artisan db:seed --class=MasterPermissionSeeder --force

# 5. Organization + admin pertama + perusahaan pertama
php artisan central:bootstrap

# 6. Storage & cache
php artisan storage:link
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

Langkah 5 tanpa argumen akan menanyakan satu per satu, dan sandi diketik
tersembunyi. Itu cara yang dianjurkan — sandi tidak tertinggal di riwayat shell.
Bila ingin sekali jalan:

```bash
php artisan central:bootstrap \
  --organization="Nusantara Group" --quota=5 \
  --name="Admin Nusantara" --email="admin@nusantara.test" \
  --company="Nusantara Jaya" --slug=nusantara --abbreviation=NSJ
```

### Kenapa langkah 5 butuh perintah tersendiri

Ini pantas dipahami, karena bentuknya aneh kalau tidak dijelaskan.

Database pusat yang baru dimigrasikan tidak punya satu pun user, jadi tidak ada
yang bisa login. Sementara satu-satunya layar untuk membuat perusahaan justru
mensyaratkan admin yang sudah login. Lingkaran itu tidak bisa diputus dari dalam
aplikasi. `central:bootstrap` memutusnya dari luar — sekali saja, selebihnya
lewat UI seperti biasa.

### Bagaimana tahu berhasil

```bash
php artisan central:tenants-status
```

Perusahaan harus berstatus **active** dengan **0 migration pending**. Lalu lewat
browser:

1. Login sebagai admin yang baru dibuat
2. `/c/{slug}/dashboard` terbuka
3. Menu **Perusahaan** memperlihatkan **kuota terpakai 1**

Nomor 3 bukan basa-basi. Kalau menu Perusahaan menjawab **403 "tidak terikat ke
organization mana pun"**, artinya admin terbentuk lepas dari organization —
hapus user itu dan ulangi langkah 5.

---

## 6. Jalur B — Server yang Sudah Berjalan

Situasinya: ada invoice, klien, pembayaran sungguhan yang tidak boleh hilang.

### Aturan yang tidak bisa ditawar

**Latih dulu dengan dump Anda sendiri**, bukan dengan data contoh. Latihan
memakai dump produksi sungguhan pada 2026-08-28 menemukan tiga cacat yang tidak
pernah muncul dengan data buatan, dan ketiganya menghentikan cutover di tengah
jalan — sebagian user sudah pindah, sebagian belum, tanpa petunjuk sudah sampai
mana.

### 6.1 Berlatih tanpa menyentuh produksi

Intinya: **salin database produksi dengan nama lain, lalu arahkan aplikasi ke
salinan itu.** Produksi tetap hidup dan tidak tersentuh.

```bash
# mysqldump sering tidak ada di PATH. Di Windows biasanya:
export PATH="/c/Program Files/MySQL/MySQL Server 8.0/bin:$PATH"

# 1. Ambil dump produksi
mysqldump -u root -p finance_management > dump-produksi.sql

# 2. Pulihkan DUA kali dengan nama berbeda:
#    latihan_produksi -> jadi "produksi hari ini", untuk mencatat baseline
#    tenant_latihan   -> jadi calon tenant yang akan diadopsi
mysql -u root -p -e "CREATE DATABASE latihan_produksi; CREATE DATABASE tenant_latihan;"
mysql -u root -p latihan_produksi < dump-produksi.sql
mysql -u root -p tenant_latihan   < dump-produksi.sql

# 3. Cadangkan .env sebelum mengarahkannya ke salinan
cp .env env-asli-backup
```

Kenapa dipulihkan dua kali? Yang satu jadi pembanding ("dulu angkanya berapa"),
yang satu jadi bahan yang diadopsi. Tanpa pembanding, Anda tidak punya cara
membuktikan tidak ada yang hilang.

### 6.2 Catat baseline dulu

Sebelum menyentuh apa pun, catat angkanya. Ini yang nanti membuktikan migrasi
berhasil — bukan perasaan "sepertinya aman".

Minimal: jumlah invoice, jumlah klien, jumlah user, total pembayaran, total saldo
bank, jumlah transaksi. Simpan ke berkas, jangan diingat-ingat.

### 6.3 Urutan cutover

```bash
php artisan down                      # 1. bekukan aplikasi
                                      # 2. backup penuh (di luar aplikasi juga)
php artisan migrate --force           # 3. struktur central
php artisan db:seed --class=MasterPermissionSeeder --force
php artisan permission:cache-reset
php artisan central:adopt-database latihan --dry-run
php artisan central:adopt-database latihan
php artisan central:import-users legacy --dry-run
php artisan central:import-users legacy
php artisan central:adopt-storage latihan --dry-run
php artisan central:adopt-storage latihan
php artisan storage:link
php artisan up                        # buka lagi
```

Lalu **bandingkan baseline**. Semua angka wajib identik. Kalau ada satu saja yang
berbeda, jangan buka akses — cari sebabnya dulu.

### 6.4 Smoke test canary

Angka yang sama belum berarti aplikasinya jalan. Uji satu perusahaan:

1. Login, pilih perusahaan, dashboard terbuka
2. Buat invoice draft — **nomor urutnya lanjut dari yang lama**, tidak mengulang dari 001
3. Hapus invoice draft itu
4. **Pengaturan > Profil Perusahaan** terbuka (membuktikan seeder permission berhasil)
5. **Unduh satu invoice sebagai PDF**
6. **Buka transaksi berlampiran, lihat pratinjaunya** (membuktikan `adopt-storage` berhasil)

Nomor 4 dan 6 sering dilewatkan, dan keduanya pernah gagal betulan.

---

## 7. Periksa `.env` sebelum apa pun

Empat nilai ini pernah mematikan migrasi. Periksa sebelum, bukan sesudah.

| Nilai | Kenapa penting | Cara memeriksa |
|---|---|---|
| `BCRYPT_ROUNDS` | Wajib **sama atau lebih tinggi** dari deployment lama. Laravel menolak hash yang cost-nya melampaui konfigurasi, sehingga impor mati dan **tidak ada yang bisa login** | `SELECT LEFT(password,7) FROM users LIMIT 1;` di DB lama. Hasil `$2y$12$` berarti cost 12 |
| `LEGACY_DB_DATABASE` | Sumber data `central:import-users`. Tanpa ini perintahnya tidak punya apa pun untuk dibaca | Isi dengan nama database lama |
| `SESSION_DRIVER` | Bila produksi memakai **redis**, jangan set `SESSION_CONNECTION=mysql` — hasilnya `Redis connection [mysql] not configured` | Samakan dengan produksi lama |
| `mysqldump` di PATH | Dipakai `central:backup` | `which mysqldump` |

---

## 8. Ketika ada yang salah

Gejala nyata yang pernah terjadi, beserta sebab dan tindakannya.

| Yang Anda lihat | Sebabnya | Yang harus dilakukan |
|---|---|---|
| `Could not verify the hashed value's configuration` | `BCRYPT_ROUNDS` server baru lebih rendah dari yang lama | Naikkan ke nilai sama atau lebih tinggi, ulangi impor |
| `RoleDoesNotExist` saat impor | Role sisa eksperimen di DB lama (`staff_test`, `admin_t`) | Sudah tidak menghentikan impor. Perintah melaporkan role yang dilewati beserta emailnya — tetapkan role penggantinya lewat menu Pengguna **sebelum go-live** |
| User bisa login tapi tidak punya akses apa pun | Role-nya termasuk yang dilewati di atas | Tetapkan role lewat menu Pengguna |
| Halaman Profil Perusahaan mati total untuk semua orang, termasuk admin | `MasterPermissionSeeder` belum dijalankan, sehingga permission `manage company profile` tidak ada di database | Jalankan seeder, lalu `permission:cache-reset` |
| Semua lampiran hilang padahal berkasnya masih ada di server | `central:adopt-storage` terlewat | Jalankan perintah itu, lalu `storage:link` |
| Menu Perusahaan 403 "tidak terikat ke organization mana pun" | Admin terbentuk lepas dari organization | Hapus user itu, ulangi `central:bootstrap` |
| Klik menu 404 setelah login | URL dibangun tanpa awalan `/c/{company}` | Bug frontend, bukan migrasi — pakai `companyUrl()` |

### Kalau gagal di tengah jalan

Perintah-perintah ini **idempoten** — aman dijalankan ulang. `import-users` yang
diulang melaporkan user lama sebagai "existing", bukan menduplikasi.

Kalau ragu, jalan mundurnya selalu sama: **pulihkan dari backup, arahkan `.env`
kembali ke database lama, `php artisan up`.** Itu sebabnya backup ada di urutan
pertama dan tidak boleh dilewati.

---

## 9. Cara membuktikan Anda sudah siap

Sebelum menyentuh produksi, Anda harus bisa menjawab semua ini dari pengalaman
sendiri, bukan dari membaca:

- [ ] Saya pernah menjalankan Jalur A dari nol sampai bisa login
- [ ] Saya pernah menjalankan Jalur B terhadap dump produksi saya sendiri
- [ ] Baseline saya cocok sebelum-sesudah pada latihan itu
- [ ] Enam langkah smoke test canary lulus semua pada latihan itu
- [ ] Saya tahu berapa lama latihan itu memakan waktu — itu perkiraan downtime saya
- [ ] Saya pernah sengaja menggagalkan satu langkah dan berhasil memulihkannya dari backup

Yang terakhir paling sering dilewati, dan paling menentukan saat sesuatu
benar-benar salah pada malam cutover.
