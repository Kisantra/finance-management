
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
| **dump** | Salinan database sebagai berkas teks berisi perintah SQL — `CREATE TABLE` untuk rangkanya, `INSERT INTO` untuk datanya. Bukan foto database, melainkan resep membangunnya ulang. Diambil dengan `mysqldump` (hanya membaca), dipulihkan dengan `mysql < berkas.sql`. |
| **restore** | Menjalankan isi dump ke sebuah database kosong sehingga isinya kembali seperti asal. |
| **cutover** | Saat peralihannya sendiri: aplikasi lama dimatikan, yang baru dinyalakan. Rentang waktu aplikasi tidak bisa dipakai. |
| **baseline** | Catatan angka **sebelum** migrasi (jumlah invoice, total pembayaran, dsb.) untuk dibandingkan sesudahnya. |
| **canary** | Menguji satu perusahaan dulu sebelum semuanya. |

---

## 3. Peta perintah

Yang paling penting dari tabel ini adalah kolom terakhir.

| Perintah | Gunanya | Merusak data? |
|---|---|---|
| `central:bootstrap` | Instalasi baru: organization + admin pertama + perusahaan pertama. Di Jalur B dipakai **tanpa `--company`**, hanya untuk membuat organization | Menolak jalan bila sudah ada user |
| `central:adopt-database {slug}` | Daftarkan DB lama sebagai tenant, lalu `tenants:migrate` untuk tenant itu | Isi tabel tidak disentuh, **tapi skemanya diubah** — ini titik ireversibel |
| `central:import-users {koneksi}` | Salin user + role dari DB lama ke central. `--organization` dan `--company` **wajib**, juga untuk `--dry-run` | Tidak — idempoten, aman diulang |
| `central:adopt-storage {slug}` | Salin/pindahkan lampiran ke folder tenant | `--pindahkan` memindahkan; tanpa itu menyalin |
| `invoice:backfill-sequence` | Isi urutan nomor invoice lama sesuai pola yang berlaku. Dijalankan lewat `tenants:run … --option="dry-run=1"` | Hanya mengisi kolom yang masih kosong |
| `central:tenants-status` | Lihat status semua perusahaan + **migration pending** | Hanya membaca |
| `central:backup` | Backup central + semua tenant (DB saja, **bukan berkas**) | Hanya membaca |
| `central:deploy-migrate` | Migration terkontrol untuk rilis berikutnya | Mengubah struktur |
| `tenants:migrate` | Terapkan migration bisnis ke tenant | Mengubah struktur |
| `tenants:migrate-fresh` | **Mengosongkan lalu memigrasi ulang** | **YA — menghapus semua data tenant** |

Tiga berkas pendamping di `docs/migrasi/`:

| Berkas | Gunanya |
|---|---|
| `docs/migrasi/verifikasi-baseline.sql` | Cetak jumlah baris, total nilai, saldo per rekening, nomor invoice — untuk dibandingkan sebelum/sesudah |
| `docs/migrasi/cek-migrasi-redate.sh` | Deteksi migration tenant yang diberi tanggal baru (penyebab `central:adopt-database` mati), dan cetak pernyataan perbaikannya |
| `docs/migrasi/latihan-cutover.sh` | Jalankan seluruh latihan Jalur B di salinan, dari nol sampai terverifikasi |

Satu-satunya perintah yang benar-benar berbahaya adalah `tenants:migrate-fresh`.
Jangan pernah mengetiknya di server produksi, dan waspadai kemiripan namanya
dengan `tenants:migrate`.

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

**Latih dulu dengan dump Anda sendiri**, bukan dengan data contoh. Latihan penuh
pada **2026-11-02** menemukan dua cacat yang menghentikan cutover di tengah
jalan, dan tiga perintah di dokumen ini yang ternyata tidak bisa dijalankan apa
adanya. Tidak satu pun muncul dengan data buatan.

Yang paling berbahaya bukan yang bikin error, tapi yang **lulus secara
menyesatkan**: urutan nomor invoice yang diam-diam mengulang dari 01 (§6.5) dan
pratinjau lampiran yang tampil padahal yang terbaca salinan lama (§6.4).

### 6.1 Berlatih tanpa menyentuh produksi

Intinya: salin database produksi dengan nama lain, lalu arahkan aplikasi ke
salinan itu. Produksi tetap hidup dan tidak tersentuh.

**Cara tercepat: jalankan skrip latihan yang sudah ada.** Skrip ini memainkan
seluruh rangkaian cutover dari nol sampai terverifikasi, dan inilah yang dipakai
untuk membuktikan runbook pada 2026-11-02:

```bash
export PATH="/c/Program Files/MySQL/MySQL Server 8.0/bin:$PATH"   # Windows
DB_PASSWORD='<sandi mysql>' SUMBER=<db-produksi-anda> SLUG=<slug>   bash docs/migrasi/latihan-cutover.sh
```

Skrip itu **hanya membaca** database sumber, dan hanya membuat/menghapus
database berawalan `latihan_` plus satu `tenant_{SLUG}`. Di akhir ia mencetak
cara membereskannya.

Kalau Anda ingin melakukannya manual — dan sebaiknya begitu, sekali, supaya
paham — Anda akan memulihkan dump yang sama **dua kali** dengan nama berbeda.
Ini inti Jalur B, bukan pemborosan:

| Database | Perannya | Berubah? |
|---|---|---|
| `latihan_sumber` | Pembanding — sumber angka baseline, "dulu invoice-nya berapa" | Dibiarkan utuh |
| `tenant_{slug}` | Bahan yang akan diadopsi menjadi tenant | Inilah yang dimigrasi |
| `latihan_central` | Database pusat latihan (dibuat kosong, bukan hasil restore) | Dibuat baru |
| produksi asli | Sumber dump; tidak dibuka, tidak ditulis | Aman |

Tanpa pembanding, Anda tidak punya cara membuktikan tidak ada data yang hilang —
hanya perasaan bahwa semuanya baik-baik saja.

**Nama `tenant_{slug}` bukan pilihan bebas.** `central:adopt-database` menyusun
nama database sebagai `'tenant_' . $slug` (prefix `tenant_` dari
`config/tenancy.php`). Jadi memulihkan ke `tenant_latihan` berarti slug
perusahaannya `latihan` — dan slug itu **permanen**: menjadi URL `/c/latihan`,
nama database, sekaligus nama folder storage `storage/tenantlatihan/`. Untuk
produksi sungguhan, pulihkan ke `tenant_{slug-yang-Anda-mau}`, misalnya
`tenant_kisantra`.

```bash
# mysqldump sering tidak ada di PATH. Di Windows biasanya:
export PATH="/c/Program Files/MySQL/MySQL Server 8.0/bin:$PATH"

# 1. Ambil salinan produksi. Ini hanya MEMBACA — produksi tidak berubah.
#    --single-transaction supaya dump konsisten tanpa mengunci tabel.
mysqldump -u root -p --single-transaction --routines --triggers   --default-character-set=utf8mb4 <db-produksi> > dump-produksi.sql

# 2. Siapkan database salinan.
mysql -u root -p -e "CREATE DATABASE latihan_sumber CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE DATABASE \`tenant_latihan\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Tuang dump yang SAMA ke keduanya. Tanda < berarti "baca berkas ini".
mysql -u root -p latihan_sumber < dump-produksi.sql
mysql -u root -p tenant_latihan < dump-produksi.sql

# 4. Cadangkan .env sebelum diarahkan ke salinan. Berkas itu satu-satunya
#    yang menentukan aplikasi menunjuk ke database mana.
cp .env env-asli-backup
```

Periksa hasilnya: `ls -lh dump-produksi.sql` harus menunjukkan ukuran puluhan KB
atau lebih — **bukan 0**. Berkas 0 byte berarti dump gagal, dan dua database
tadi akan kosong tanpa satu pun pesan error.

**Jangan arahkan `.env` latihan ke database pusat produksi.** Buat database
pusat latihan sendiri (`latihan_central`). Alternatif tanpa menyentuh `.env`
sama sekali — ini yang dipakai skrip latihan — adalah menaruh nama database di
environment perintahnya, karena Laravel tidak menimpa variabel yang sudah ada:

```bash
DB_DATABASE=latihan_central LEGACY_DB_DATABASE=latihan_sumber php artisan migrate --force
```

### 6.2 Catat baseline dulu

Sebelum menyentuh apa pun, catat angkanya. Ini yang nanti membuktikan migrasi
berhasil — bukan perasaan "sepertinya aman".

Kuerinya sudah disiapkan: **`docs/migrasi/verifikasi-baseline.sql`**. Ia mencetak
empat blok — jumlah baris per tabel, total nilai, **saldo per rekening**, dan
nomor + urutan invoice beserta pola penomoran yang berlaku.

```bash
mysql -u root -p latihan_sumber  < docs/migrasi/verifikasi-baseline.sql > sebelum.txt
# ... cutover ...
mysql -u root -p tenant_latihan  < docs/migrasi/verifikasi-baseline.sql > sesudah.txt
diff sebelum.txt sesudah.txt
```

Saldo rekening **tidak disimpan** di database — ia dihitung ulang dari
`initial_balance + pembayaran + transaksi kredit − transaksi debit`. Kueri di
atas memakai rumus yang sama dengan kode aplikasi
(`BankAccount::withBalance()`), jadi kalau hasilnya cocok, yang cocok bukan
sekadar satu angka tersimpan — tapi seluruh data pembentuknya.

Yang **boleh** berbeda sesudahnya hanya dua: blok urutan invoice (NULL → terisi,
hasil §6.5) dan pola penomoran kalau Anda mengubahnya. Selisih di jumlah baris,
total nilai, atau saldo berarti **berhenti**.

### 6.3 Urutan cutover

Urutan di bawah **sudah dijalankan penuh** pada 2026-11-02 terhadap salinan
database berisi invoice bernomor gaya produksi. Versi lengkap dengan waktu,
titik ireversibel, dan cara mundur per langkah ada di
[Runbook §G.2](multi-tenancy-runbook-eksekusi.md#g2-urutan-cutover-deployment-existing--sudah-dilatih-bukan-direncanakan).

```bash
php artisan down                      # 1. bekukan aplikasi
                                      # 2. backup penuh DB + storage + .env
mysql -u root -p <DB_LAMA> < docs/migrasi/verifikasi-baseline.sql > sebelum.txt  # 3. baseline

# 4. pulihkan dump jadi database tenant
mysql -u root -p -e "CREATE DATABASE \`tenant_<slug>\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p tenant_<slug> < dump-produksi.sql

# 5. struktur + hak akses database pusat
php artisan migrate --force
php artisan db:seed --class=MasterPermissionSeeder --force
php artisan permission:cache-reset

# 6. organization (admin sebenarnya datang dari langkah 8)
php artisan central:bootstrap --organization="<Nama Grup>" --quota=5 --name="Operator" --email="ops@example.com"

# 7. REKONSILIASI BUKU MIGRATION — tanpa ini langkah 8 MATI
bash docs/migrasi/cek-migrasi-redate.sh tenant_<slug>
#    jalankan pernyataan INSERT yang dicetak, setelah membandingkan isi berkasnya

# 8. adopsi database (mulai dari sini IREVERSIBEL)
php artisan central:adopt-database <slug> --organization=<org-slug> --name="<Nama PT>" --abbreviation=<SINGKATAN>

# 9. user + berkas
php artisan central:import-users legacy --organization=<org-slug> --company=<slug> --dry-run
php artisan central:import-users legacy --organization=<org-slug> --company=<slug>
php artisan central:adopt-storage <slug> --dry-run
php artisan central:adopt-storage <slug>
php artisan storage:link

# 10. URUTAN NOMOR INVOICE — lihat 6.5, jangan dilewati
#     10a. setel pola di Pengaturan > Penomoran invoice sampai cocok riwayat
php artisan tenants:run invoice:backfill-sequence --tenants=<slug> --option="dry-run=1"
php artisan tenants:run invoice:backfill-sequence --tenants=<slug>

# 11. bandingkan, lalu buka
mysql -u root -p tenant_<slug> < docs/migrasi/verifikasi-baseline.sql > sesudah.txt
diff sebelum.txt sesudah.txt
php artisan central:tenants-status
php artisan up
```

**Tiga hal yang salah di versi sebelumnya dokumen ini**, dan sudah diuji:

| Yang tertulis dulu | Kenyataannya |
|---|---|
| `central:adopt-database <slug> --dry-run` | `The "--dry-run" option does not exist.` Perintah itu tidak punya mode kering |
| `central:import-users legacy --dry-run` | `Organization / company tujuan tidak ditemukan.` `--organization` dan `--company` wajib, juga untuk dry-run |
| `--option=dry-run` pada `tenants:run` | `Undefined array key 1` dari dalam paket. Harus `--option="dry-run=1"` |

Dan dua langkah yang **tidak ada** di versi sebelumnya, keduanya wajib:
**langkah 7** (rekonsiliasi buku migration) dan **langkah 10** (backfill urutan
invoice).

Lalu **bandingkan baseline**. Yang boleh berbeda hanya dua blok: urutan invoice
(NULL → terisi) dan pola penomoran (kalau Anda mengubahnya di langkah 10a).
Selisih apa pun di jumlah baris, total nilai, atau saldo berarti **jangan buka
akses** — mundur ke backup dan cari sebabnya.

### 6.4 Smoke test canary

Angka yang sama belum berarti aplikasinya jalan. Uji satu perusahaan:

1. Login **dengan sandi lama seorang user nyata**, pilih perusahaan, dashboard terbuka
2. Buat invoice draft, terbitkan — **nomornya lanjut dari yang lama**, tidak mengulang
3. Hapus invoice draft itu; nomor berikutnya kembali ke nomor yang tadi
4. **Pengaturan > Profil Perusahaan** terbuka (membuktikan seeder permission berhasil)
5. **Unduh satu invoice sebagai PDF**
6. **Buka transaksi berlampiran, lihat pratinjaunya** (lihat peringatan di bawah)
7. Login sebagai user berrole `staff` — halaman yang bukan haknya **tetap 403**

Nomor 4 dan 6 sering dilewatkan, dan keduanya pernah gagal betulan.

> **Peringatan tentang nomor 6.** Saat ini pratinjau lampiran bisa lulus secara
> menyesatkan: yang tampil adalah salinan di `storage/app/public` (folder
> central), bukan berkas di folder tenant. Karena itu: jalankan
> `central:adopt-storage` **tanpa** `--pindahkan`, dan **jangan hapus**
> `storage/app/public` walau perintahnya menyarankan begitu. Penjelasan
> lengkapnya di [Runbook §G.2.8b](multi-tenancy-runbook-eksekusi.md#g28-cacat-produk-yang-ditemukan-latihan--belum-diperbaiki).
> Perusahaan kedua **tidak boleh** di-onboard sebelum ini diperbaiki di kode.

### 6.5 Jebakan urutan nomor invoice

Ini jebakan paling mahal di seluruh migrasi, karena akibatnya bukan error
melainkan **dua invoice bernomor sama** — dan yang satu sudah dikirim ke klien.

Kolom `invoices.invoice_sequence` hanya terisi saat nomor invoice **berubah**.
Invoice lama tidak pernah berubah nomornya, jadi kolomnya kosong. Migrasi yang
mencoba mengisinya memakai pola yang dipatok satu format (`001/INV/...`), jadi
nomor berformat lain seperti `INV/01/KSN/01.26` tidak terisi — tanpa peringatan.

Dibuktikan di latihan:

```
SEBELUM backfill -> nomor berikutnya = INV/01/KSN/03.26
nomor yang sudah terbit = INV/01/KSN/01.26 ... INV/04/KSN/03.26
                          ^^ 01 sudah dipakai di tahun yang sama

SESUDAH backfill -> nomor berikutnya = INV/05/KSN/03.26   (menyambung)
```

Urutan yang benar, dan **tidak boleh dibalik**:

1. **Pola dulu.** Buka Pengaturan › Penomoran invoice dan samakan polanya dengan
   riwayat nomor Anda. `invoice:backfill-sequence` membaca pola yang **sedang
   berlaku**; dengan pola yang salah, ia mengisi nol invoice dan melapor nol.
2. **Dry-run, lalu baca laporannya.** Perintah mencetak daftar nomor yang tidak
   cocok. Kalau daftarnya masih penuh, polanya belum benar — perbaiki, ulangi.
3. **Jalankan sungguhan.** Nomor yang tetap tidak cocok karena memang diketik
   manual aman dibiarkan kosong, tapi periksa satu per satu.
4. **Buktikan nomor berikutnya menyambung** — buat draft, terbitkan, lihat
   nomornya, hapus lagi.

Semua ini wajib selesai **sebelum `php artisan up`**, karena begitu aplikasi
dibuka siapa pun bisa menerbitkan invoice.

---

## 7. Periksa `.env` sebelum apa pun

Lima hal ini pernah mematikan migrasi. Periksa sebelum, bukan sesudah.

| Yang diperiksa | Kenapa penting | Cara memeriksa |
|---|---|---|
| `BCRYPT_ROUNDS` | Wajib **sama atau lebih tinggi** dari deployment lama. Bukan `Hash::check()` yang menolak (sudah diuji: cost lebih tinggi tetap lolos), tapi cast `'password' => 'hashed'` di model `User` — dan `central:import-users` menulis lewat cast itu. Gejalanya: **impor mati di user pertama** | `SELECT LEFT(password,7) FROM users LIMIT 1;` di DB lama. Hasil `$2y$12$` berarti cost 12 |
| `LEGACY_DB_DATABASE` | Sumber data `central:import-users`. Tanpa ini perintahnya tidak punya apa pun untuk dibaca | Isi dengan nama database lama |
| `SESSION_DRIVER` | Bila produksi memakai **redis**, jangan set `SESSION_CONNECTION=mysql` — hasilnya `Redis connection [mysql] not configured` | Samakan dengan produksi lama |
| `mysqldump` di PATH | Dipakai `central:backup` | `which mysqldump` |
| Buku migration tenant | Migration yang diberi tanggal baru akan dijalankan ulang dan mematikan `central:adopt-database` | `bash docs/migrasi/cek-migrasi-redate.sh tenant_<slug>` |

## 8. Ketika ada yang salah

Gejala nyata yang pernah terjadi, beserta sebab dan tindakannya.

| Yang Anda lihat | Sebabnya | Yang harus dilakukan |
|---|---|---|
| `Duplicate column name 'system_key'` saat `central:adopt-database` | Migration tenant diberi tanggal baru di branch; Laravel melacak per nama berkas, jadi yang sudah jalan dianggap belum | Jalankan `docs/migrasi/cek-migrasi-redate.sh`, bandingkan isi berkasnya, catat nama baru sebagai sudah-dijalankan, ulangi perintahnya (aman diulang) |
| Perusahaan `active` tapi halaman error aneh | `central:adopt-database` tidak atomik: baris perusahaan dibuat dulu, migrate menyusul dan bisa gagal | `php artisan central:tenants-status` — kolom **Migration pending wajib 0**. Jangan percaya status `active` saja |
| `Undefined array key 1` dari dalam paket tenancy | Opsi `tenants:run` ditulis tanpa `=`, mis. `--option=dry-run` | Tulis `--option="dry-run=1"` |
| `The "--dry-run" option does not exist.` | `central:adopt-database` tidak punya mode kering | Yang bisa dikeringkan: `import-users`, `adopt-storage`, `invoice:backfill-sequence` |
| `Could not verify the hashed value's configuration` | `BCRYPT_ROUNDS` server baru lebih rendah dari yang lama | Naikkan ke nilai sama atau lebih tinggi, ulangi impor |
| `RoleDoesNotExist` saat impor | Role sisa eksperimen di DB lama (`staff_test`, `admin_t`) | Sudah tidak menghentikan impor. Perintah melaporkan role yang dilewati beserta emailnya — tetapkan role penggantinya lewat menu Pengguna **sebelum go-live** |
| User bisa login tapi tidak punya akses apa pun | Role-nya termasuk yang dilewati di atas | Tetapkan role lewat menu Pengguna |
| Akun hasil `central:bootstrap` 403 di semua halaman, termasuk `/choose-company` | Tanpa `--company`, perintah itu tidak membuat keanggotaan perusahaan maupun role | Tambahkan akun itu sebagai anggota + beri role lewat menu Pengguna memakai admin hasil impor — atau jangan buat akun operator sama sekali |
| Invoice baru bernomor 01 padahal 01 sudah terkirim ke klien | `invoice_sequence` kosong untuk invoice lama | §6.5 — setel pola, dry-run, backfill. **Sebelum** aplikasi dibuka |
| Halaman Profil Perusahaan mati total untuk semua orang, termasuk admin | `MasterPermissionSeeder` belum dijalankan, sehingga permission `manage company profile` tidak ada di database | Jalankan seeder, lalu `permission:cache-reset` |
| Semua lampiran hilang padahal berkasnya masih ada di server | `central:adopt-storage` terlewat | Jalankan perintah itu, lalu `storage:link` |
| Lampiran hilang **setelah** Anda menghapus `storage/app/public` | URL lampiran belum sadar tenant — yang dilayani adalah folder central | Pulihkan dari `storage-lama.tgz`. Jangan hapus folder itu sampai cacatnya diperbaiki di kode (Runbook §G.2.8b) |
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
- [ ] `diff sebelum.txt sesudah.txt` saya hanya berbeda di blok urutan & pola invoice
- [ ] `central:tenants-status` saya menunjukkan **Migration pending 0**
- [ ] Saya sudah menjalankan `cek-migrasi-redate.sh` terhadap dump saya dan tahu hasilnya
- [ ] Saya pernah login dengan **sandi lama** seorang user nyata hasil impor
- [ ] Saya pernah melihat nomor invoice berikutnya **menyambung** sesudah backfill, dan tahu berapa nomornya
- [ ] Tujuh langkah smoke test canary (§6.4) lulus semua pada latihan itu
- [ ] Saya tahu berapa lama latihan itu memakan waktu — itu perkiraan downtime saya
- [ ] Saya pernah sengaja menggagalkan satu langkah dan berhasil memulihkannya dari backup

Yang terakhir paling sering dilewati, dan paling menentukan saat sesuatu
benar-benar salah pada malam cutover. Jalan mundurnya cuma satu dan harus sudah
Anda coba: `DROP DATABASE tenant_{slug}` → `CREATE` → restore dump beku.
