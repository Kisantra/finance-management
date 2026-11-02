# Gerbang 5 — Perusahaan kedua (dan kesepuluh) dari nol

Dijalankan 2 November 2026 di branch `feature/multi-tenancy-rekonsiliasi` (`ee37a32`).
Angka mentah: `storage/perf-e/provisioning.csv`. Skrip:
`docs/perf/perf-e-provisioning.php` (punya penjaga nama database `perf_*`/`tenant_perf*`).

## 0. Ringkasan

Membuat site baru dari database pusat kosong **berhasil** dan jalurnya terbukti.
Membuat perusahaan baru di site yang sudah hidup **berhasil 10 dari 10**, dan perusahaan
kedua langsung bisa dipakai bertransaksi sampai nomor invoice terbit. Tetapi
**biaya provisioning jauh lebih besar daripada yang dicatat rencana lama:
median 10,8 detik per perusahaan, bukan 0,6 detik dan bukan 6,1 detik** — dan 94 %-nya
adalah `tenants:migrate` menjalankan 52 migration. Biaya per-request **tidak** tumbuh
dengan jumlah perusahaan; satu-satunya hal yang tumbuh adalah prop `companies`
(±55 byte/perusahaan, tanpa tambahan query).

---

## 1. Runbook terbukti — site baru di domain lain, dari nol

Semua perintah dijalankan apa adanya, keluarannya nyata. Variabel lingkungan
`SESSION_COOKIE`/`CACHE_PREFIX` di sini khusus isolasi pengukuran; di site produksi
cukup `.env` milik site itu.

### Langkah 1 — database pusat kosong

```sql
CREATE DATABASE perf_central CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Langkah 2 — migration central

```bash
DB_DATABASE=perf_central php artisan migrate --force --no-interaction
```

Keluaran: 19 migration dijalankan (`users`, `cache`, `jobs`, `permission_tables`,
`feedbacks`, `app_notifications`, `organizations`, `companies`, `company_user`,
`add_team_support_to_permission_tables`, …). Total 19 tabel, 0,62 MB.

### Langkah 3 — master permission (WAJIB sebelum bootstrap)

```bash
DB_DATABASE=perf_central php artisan db:seed --class=MasterPermissionSeeder --force --no-interaction
```

Keluaran:

```
✓ Admin: 77 permissions
✓ Finance Manager: 70 permissions
✓ Staff: 21 permissions
⚠ No admin users found!
✗ No users/companies in database to assign admin role!
✅ Master Permission Seeder completed successfully!
```

Dua baris merah itu **normal pada instalasi baru** dan bukan kegagalan — belum ada user
untuk diberi role. Waktu: 1,4 s.

`central:bootstrap` akan menolak jalan kalau langkah ini dilewati
(`Role "admin" belum ada`), jadi urutannya tidak bisa dibalik.

### Langkah 4 — organization + admin pertama + perusahaan pertama

```bash
DB_DATABASE=perf_central php artisan central:bootstrap \
  --organization="Perf E Org" --quota=20 \
  --name="Admin Perf" --email=admin@perf-e.test --password='PerfE2026#' \
  --company="Perf A" --slug=perfa --abbreviation=PFA --no-interaction
```

Keluaran:

```
Organization dibuat: Perf E Org (kuota 20 perusahaan)
Admin pertama dibuat: admin@perf-e.test
Menyiapkan perusahaan Perf A — database tenant_perfa dibuat dan dimigrasikan...
Perusahaan siap: /c/perfa

Login di /login sebagai admin@perf-e.test, lalu buka /c/perfa/dashboard
```

Waktu total perintah: **7,9 s** (termasuk ±0,6 s boot CLI dan seluruh pipeline
provisioning).

Perintah ini idempoten-aman: kalau tabel `users` sudah berisi, ia menolak jalan dan
mengarahkan ke `central:adopt-database` + `central:import-users` — jadi tidak bisa
dipakai menimpa deployment lama secara tidak sengaja.

### Langkah 5 — verifikasi

```bash
DB_DATABASE=perf_central php artisan central:tenants-status
```

```
+-------+--------+--------+----------+-------------+---------+-------------------+
| Slug  | Nama   | Status | Database | Ukuran (MB) | Anggota | Migration pending |
+-------+--------+--------+----------+-------------+---------+-------------------+
| perfa | Perf A | active | OK       | 1.36        | 1       | 0                 |
+-------+--------+--------+----------+-------------+---------+-------------------+
Total: 1 perusahaan | aktif: 1 | failed: 0 | DB hilang: 0
```

Setelah ini login di `/login` lalu `/c/perfa/dashboard` sudah bisa dibuka (dibuktikan
oleh pengukuran Gerbang 4: HTTP 200, 50 query).

---

## 2. Perusahaan kedua dari nol — bukti lengkap

Dibuat lewat jalur yang **sama dengan UI** `/admin/companies`: `Company::create()`
memicu `TenantCreated` → `JobPipeline(CreateDatabase → MigrateDatabase → SeedDatabase →
MarkCompanyActive)`, lalu keanggotaan + role admin diberikan seperti
`CompanyController::grantCreatorAccess()`.

```bash
DB_DATABASE=perf_central php docs/perf/perf-e-provisioning.php \
  --slug=perfb --nama="Perf B" --singkatan=PFB
```

Bukti yang diperiksa program, bukan diasumsikan:

| Yang dibuktikan | Hasil |
|---|---|
| Database tenant terbentuk | `tenant_perfb` ada, **22 tabel** |
| Migration tenant jalan semua | **52 baris** di `tenant_perfb.migrations`, `central:tenants-status` → pending **0** |
| Seeder jalan | **28 kategori transaksi**, di antaranya **6 kategori sistem** |
| Kategori sistem ada | `EXP-INTEREST, FIN-LOAN-IN, FIN-LOAN-OUT, FIN-RCV-IN, FIN-RCV-OUT, REV-INTEREST` |
| Profil perusahaan terbentuk | `company_profiles` 1 baris, nama "Perf B" (dari `TenantDatabaseSeeder`) |
| Status akhir | `active` (ditulis `MarkCompanyActive`, jadi pipeline sukses sampai ujung) |
| Admin punya akses | baris `company_user` + role `admin` pada team `perfb` |

### Bisa dipakai bertransaksi

Dibuat 1 klien + 1 invoice draft + 1 item, lalu diterbitkan lewat
`InvoiceNumberService::next()` — jalur yang sama dengan aksi "Kirim" di UI:

```
sebelum send: nomor=NULL status=draft
NOMOR TERBIT: 001/INV/PB-KP/XI/2026  status=sent
invoice=1 item=1 klien=1
```

Nomor invoice **mulai dari 001 di perusahaan baru** — urutan per perusahaan, tidak
bocor dari `perfa` yang sudah punya 200 invoice. Inisial `PB` dari singkatan perusahaan,
`KP` dari nama klien, `XI/2026` dari bulan terbit. Itu membuktikan `invoice_sequence`
dan `InvoiceNumberService` benar-benar berada di database tenant.

---

## 3. Waktu provisioning per perusahaan — angka sebenarnya

8 perusahaan diukur bertahap (`perfb`, lalu `perfd`…`perfj`). `perfc` dibuat saat skrip
masih diperbaiki sehingga tidak punya rincian waktu.

| Slug | total | insert+CREATE DATABASE | tenants:migrate | seed | MarkCompanyActive | beri akses |
|---|---|---|---|---|---|---|
| perfb | 12.779 ms | — | 12.539 ms | 173 ms | 7,8 ms | 23,2 ms |
| perfd | 9.313 ms | 29,9 ms | 9.110 ms | 149 ms | 4,6 ms | 19,8 ms |
| perfe | 9.148 ms | 12,3 ms | 8.980 ms | 142 ms | 4,4 ms | 9,5 ms |
| perff | 6.096 ms | 14,4 ms | 5.926 ms | 140 ms | 4,4 ms | 11,3 ms |
| perfg | 12.334 ms | 12,4 ms | 12.126 ms | 182 ms | 4,6 ms | 9,4 ms |
| perfh | 6.438 ms | 14,6 ms | 6.245 ms | 163 ms | 4,9 ms | 10,6 ms |
| perfi | 12.259 ms | 12,4 ms | 11.218 ms | 1.015 ms | 4,6 ms | 8,8 ms |
| perfj | 13.555 ms | 10,7 ms | 13.382 ms | 148 ms | 4,4 ms | 9,5 ms |

| | median | min | maks |
|---|---|---|---|
| **total end-to-end** | **10.786 ms** | 6.096 ms | 13.555 ms |
| `tenants:migrate` | **10.164 ms** | 5.926 ms | 13.382 ms |

Pembagian biaya, memakai median:

| Tahap | ms | % |
|---|---|---|
| INSERT baris `companies` + `CREATE DATABASE` | ≈13 | 0,1 % |
| **MigrateDatabase (52 migration)** | **≈10.164** | **94,2 %** |
| SeedDatabase (`TenantDatabaseSeeder`) | ≈150 | 1,4 % |
| MarkCompanyActive | ≈4,6 | 0,04 % |
| keanggotaan + role admin | ≈10 | 0,1 % |

### Dua premis yang terbantah

| Klaim | Hasil ukur |
|---|---|
| Rencana lama: **0,6 detik** per perusahaan | **Salah, 18× terlalu optimis.** 0,6 s kira-kira sebesar boot CLI Laravel saja. |
| Worker lain: **6,1 detik** per database `tenants:migrate` | **Terlalu rendah.** 6,1 s adalah nilai terbaik yang pernah terjadi (perff 5,9 s); median 10,2 s, terburuk 13,4 s. |

Sebarannya lebar (5,9–13,4 s) karena mesin ini berbagi MySQL dengan ±20 database lain
dan CLI PHP berjalan tanpa OPcache, sehingga 52 berkas migration di-parse ulang di
setiap pemanggilan. **Angka di VPS Linux: tidak diukur.** Yang tidak akan berubah:
`CREATE DATABASE` murah, seeder murah, dan 94 % biayanya ada di menjalankan migration.

### Konsekuensi untuk UI

`CompanyController::store()` menjalankan pipeline ini **sinkron di dalam request HTTP**.
Pada 10,8 s median dan 13,6 s terburuk, itu sudah di ambang batas banyak konfigurasi
(`max_execution_time` 30 s, proxy timeout 60 s) — aman, tapi tanpa margin besar, dan
pengguna menatap tombol selama belasan detik. Pipeline-nya sudah disiapkan untuk
antrean (`->shouldBeQueued(false)` dengan komentar "you probably want to make this
`true` for production"). Memindahkannya ke antrean menukar 11 detik tunggu dengan
status `provisioning` + polling — **tidak diukur**, tapi itu perubahan satu baris.

---

## 4. Naik ke 10 perusahaan

```bash
DB_DATABASE=perf_central php docs/perf/perf-e-provisioning.php \
  --banyak=perfd,perfe,perff,perfg,perfh,perfi,perfj
```

`central:tenants-status` dengan 10 perusahaan — masih waras, 1,9 s:

```
+-------+--------+--------+----------+-------------+---------+-------------------+
| Slug  | Nama   | Status | Database | Ukuran (MB) | Anggota | Migration pending |
+-------+--------+--------+----------+-------------+---------+-------------------+
| perfa | Perf A | active | OK       | 1.36        | 1       | 0                 |
| perfb | Perf B | active | OK       | 1.03        | 1       | 0                 |
| perfc | Perf C | active | OK       | 1.03        | 1       | 0                 |
| perfd | Perf D | active | OK       | 1.03        | 1       | 0                 |
| perfe | Perf E | active | OK       | 1.03        | 1       | 0                 |
| perff | Perf F | active | OK       | 1.03        | 1       | 0                 |
| perfg | Perf G | active | OK       | 1.03        | 1       | 0                 |
| perfh | Perf H | active | OK       | 1.03        | 1       | 0                 |
| perfi | Perf I | active | OK       | 1.03        | 1       | 0                 |
| perfj | Perf J | active | OK       | 1.03        | 1       | 0                 |
+-------+--------+--------+----------+-------------+---------+-------------------+
Total: 10 perusahaan | aktif: 10 | failed: 0 | DB hilang: 0
```

Perintah ini membuka koneksi ke setiap database tenant untuk membaca ukuran dan
migration pending, jadi biayanya linear: ±0,13 s per perusahaan di atas boot CLI.
Di 100 perusahaan → ±14 s. Masih dapat dipakai, tetapi bukan lagi perintah "sekali
lihat".

### Biaya yang dibayar setiap deploy

| Perintah | 10 database | per database |
|---|---|---|
| `tenants:migrate` tanpa migration pending (3×: 1,60 / 1,41 / 1,48 s) | **±1,5 s** | ±0,09 s |
| `tenants:rollback --step=1` | 1,94 s | ±0,19 s |
| `tenants:migrate` dengan **1 migration pending** | **2,10 s** | ±0,21 s |

Jadi deploy yang membawa satu migration tenant: ±2,1 s untuk 10 perusahaan, ±0,15 s
tambahan per perusahaan. Ekstrapolasi (**hitungan, bukan ukuran**): 100 perusahaan
≈ 15–20 s per migration tenant per deploy. Yang mahal bukan ini, melainkan membuat
perusahaan BARU (52 migration sekaligus, §3).

### Apakah ada halaman yang melambat hanya karena jumlah perusahaan bertambah?

Pertanyaan ini yang paling penting, dan jawabannya: **tidak, kecuali satu prop yang
tumbuh linear dan tidak menambah query.**

Halaman yang sama (`/c/perfa/clients`), kode yang sama, `APP_ENV=production`, admin
anggota 1 perusahaan vs 10 perusahaan:

| | 1 perusahaan | 10 perusahaan | selisih |
|---|---|---|---|
| query | 19 | **19** | **0** |
| `handle` median | 162,2 ms † | 158,0 ms | **−4,2 ms** (dalam derau) |
| total props | 6.717 B | 7.211 B | +494 B |
| prop `companies` | 55 B | **549 B** | **+494 B (±55 B/perusahaan)** |

† dua seri `kondisi-a-prod` terpisah (sebelum dan sesudah provisioning 9 perusahaan
tambahan), keduanya median 6 iterasi hangat, kode dan database yang sama. Arah
selisihnya negatif — 10 perusahaan tidak lebih lambat.

Penyebabnya `HandleInertiaRequests::share()`:

```php
'companies' => fn () => $user->companies()->where('status', 'active')->get([...])
```

Satu query yang mengembalikan **semua** perusahaan milik user, di setiap navigasi penuh.
Jumlah query tetap 1 — yang tumbuh hanya jumlah baris dan ukuran JSON. Ekstrapolasi
(**hitungan**): user anggota 100 perusahaan → ±5,5 KB prop tambahan per navigasi.

Halaman `/choose-company` ikut berubah perilaku: dengan 1 perusahaan ia **redirect 302**
(2 query, 113 ms); dengan 10 perusahaan ia **merender pemilih, HTTP 200, 7 query**.
Itu memang yang diinginkan, bukan regresi.

Yang **tidak** tumbuh dengan jumlah perusahaan: resolusi tenant (`WHERE id = ?` pada
primary key), cek keanggotaan (`EXISTS` dengan dua kunci), konteks permission team,
jumlah query halaman mana pun. Tidak ada satu pun query yang memindai tabel `companies`
tanpa kondisi di jalur request.

---

## 5. Tabel InnoDB dan batas MySQL

| Database | Tabel | Ukuran |
|---|---|---|
| `perf_central` | 19 | 0,62 MB |
| `tenant_perfa` (berisi data uji) | 22 | 1,36 MB |
| `tenant_perfb` … `tenant_perfj` (kosong) | 22 masing-masing | 1,03 MB masing-masing |
| **Total 1 pusat + 10 tenant** | **239** | **11,27 MB** |

**22 tabel per perusahaan. 19 tabel sekali saja untuk database pusat.**

Konfigurasi MySQL 8.0.45 di mesin ini (nilai bawaan, tidak disetel khusus):

| Variabel | Nilai |
|---|---|
| `table_open_cache` | 4000 |
| `table_definition_cache` | 2000 |
| `open_files_limit` | 10209 |
| `innodb_open_files` | 4000 |
| `innodb_buffer_pool_size` | 134.217.728 (128 MB) |
| `innodb_file_per_table` | ON |
| `max_connections` | 151 |

Status saat pengukuran (server ini juga berisi ±20 database site lain, **1.078 tabel
InnoDB total**):

| Status | Nilai |
|---|---|
| `Open_tables` | 2.804 |
| `Opened_tables` | 58.725 |
| `Open_table_definitions` | 377 |

### Apakah konfigurasi bawaan akan kewalahan, dan pada jumlah berapa?

**Pada 10 perusahaan: tidak, sama sekali tidak dekat.** 239 tabel terhadap
`table_definition_cache` 2000 adalah 12 %.

Batas yang mengikat lebih dulu adalah **`table_definition_cache` = 2000**, karena ia
dihitung per-tabel (bukan per-koneksi) dan dibagi dengan semua database di server:

| Skenario | Tabel dipakai | Terhadap batas |
|---|---|---|
| hanya aplikasi ini, 10 perusahaan | 239 | 12 % dari 2000 |
| hanya aplikasi ini, **50 perusahaan** | 1.119 | 56 % |
| hanya aplikasi ini, **90 perusahaan** | 1.999 | **100 % — mulai thrashing** |
| **mesin uji ini** (1.078 tabel InnoDB milik site lain) + 10 perusahaan | 1.298 | 65 % |
| mesin uji ini + **42 perusahaan** | 2.002 | **100 %** |

Jadi: **di server yang sudah berisi ±20 site sepadat mesin uji ini, konfigurasi bawaan
mulai kewalahan di sekitar 40 perusahaan**; di server yang hanya menjalankan aplikasi
ini, di sekitar 90 perusahaan. Jumlah tabel InnoDB di VPS produksi **tidak diukur** —
angka 1.078 itu milik mesin uji; periksa dengan
`SELECT COUNT(*) FROM information_schema.tables WHERE engine='InnoDB'` di sana sebelum
memakai ambang 40 itu. `table_open_cache` 4000 dan `open_files_limit` 10209 memberi ruang
sampai ratusan perusahaan dan bukan batas pertama.

Angka `Opened_tables` 58.725 terhadap `Open_tables` 2.804 menunjukkan cache tabel di
mesin ini **sudah** berputar hari ini — sebelum perusahaan Paket E ditambahkan. Itu
bukti bahwa menambah 220 tabel (+20 % dari 1.078 yang sudah ada) bukan tindakan netral
di server bersama. Perbaikannya murah dan satu baris:
`table_definition_cache = 8000`, `table_open_cache = 8000`. Dampak persisnya pada waktu
request: **tidak diukur.**

`innodb_buffer_pool_size` 128 MB terhadap 11,27 MB data 10 perusahaan: berlebih jauh,
sejalan dengan temuan 2 November bahwa buffer pool bukan hambatan dan hambatannya CPU.

---

## 6. Pembersihan

Seluruh artefak Paket E ada di nama yang berpola `perf_*` / `tenant_perf*` dan bisa
dihapus tanpa risiko:

```sql
DROP DATABASE perf_central; DROP DATABASE perf_single;
DROP DATABASE tenant_perfa; -- … sampai tenant_perfj
```

```bash
git worktree remove D:/tmp/perf-e-branch
git worktree remove D:/tmp/perf-e-main      # vendor-nya terpasang sendiri, bukan junction
rm -rf D:/tmp/perf-e-opc D:/tmp/perf-e-opc2
```

Worktree `D:/tmp/perf-e-branch` memakai *junction* ke `vendor/`, `node_modules/`, dan
`public/build` milik repo utama — **jangan** menghapus isinya secara rekursif dari dalam
worktree itu; pakai `git worktree remove`.
