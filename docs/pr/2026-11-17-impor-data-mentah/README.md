# Impor data mentah perusahaan Mitra Group + akun per perusahaan

PR ini berisi dua hal:

1. **Akun untuk setiap perusahaan Mitra Group.** Selain admin & finance manager yang memegang semua
   perusahaan, setiap perusahaan kini punya akun admin, finance manager, dan staff sendiri.
2. **Seeder yang memasukkan data keuangan asli** dari berkas Excel *Template Kelengkapan Data SPT
   Tahunan* (format konsultan Kisantra): klien, invoice, pembayaran, dan seluruh transaksi Arus Kas.
   Total di aplikasi sama dengan sheet.

Tidak ada migration, tidak ada perubahan izin, dan tidak ada perubahan tampilan. Semua perubahan ada
di seeder, test, dan dokumentasi.

> **Data asli tidak ada di PR ini.** Repo publik: berkas Excel diletakkan di `storage/data-mentah/`
> (di-gitignore, hanya README-nya yang ikut repo), kode hanya berisi aturan, dan test memakai Excel
> fiktif yang dibangun di dalam test. Karena itu PR ini tidak memuat screenshot data hasil impor.

---

## Ringkasan singkat

| | Sebelum | Sesudah |
|---|---|---|
| Akun per perusahaan Mitra Group | Hanya `staff.{kode}` | `admin.{kode}`, `manager.{kode}`, `staff.{kode}` |
| Data keuangan perusahaan Mitra Group | Kosong; diinput manual satu per satu | Satu perintah mengimpor semua perusahaan yang berkasnya ada |
| Berkas Excel data mentah | Tidak ada tempatnya | `storage/data-mentah/` (di-gitignore) + README petunjuk |
| Kecocokan dengan sheet | — | Laporan `laporan-impor.md`: total sheet vs aplikasi per perusahaan + semua koreksi |

**Yang tidak berubah:** perusahaan di luar Mitra Group, template kategori & seeder perusahaan baru,
cara menghitung invoice, saldo, dan Laba Rugi, serta hak akses.

---

## 1. Akun

`MitraGroupSeeder` (password semua akun `password`):

| Akun | Peran | Perusahaan |
|---|---|---|
| `admin@mitragroup.id` | admin | semua (10) — sudah ada |
| `manager@mitragroup.id` | finance manager | semua (10) — sudah ada |
| `admin.{kode}@mitragroup.id` | admin | satu perusahaan — **baru** |
| `manager.{kode}@mitragroup.id` | finance manager | satu perusahaan — **baru** |
| `staff.{kode}@mitragroup.id` | staff | satu perusahaan — sudah ada |

Daftar perusahaan kini konstanta publik `MitraGroupSeeder::PERUSAHAAN` (dipakai juga oleh seeder
impor), dengan penanda `holding` untuk PT Mitra Trisula Amanah. Nama "PT Alzam Ocean Energi" dibetulkan
menjadi "PT Alzam Ocean Energy" sesuai dokumen perusahaan (berlaku untuk provisioning baru; slug tetap
`alzam-ocean-energi`).

## 2. Impor data mentah

```bash
php artisan db:seed --class=DataPerusahaanSeeder --force
```

Panduan lengkap: [`docs/guides/IMPOR-DATA-MENTAH.md`](../../guides/IMPOR-DATA-MENTAH.md).

| Sheet template | Masuk ke |
|---|---|
| 01 Identitas | Mengenali perusahaan; NPWP/alamat/telepon/email ke Profil (hanya isian kosong) |
| 07 Arus Kas | Transaksi Kas & Bank, atau pembayaran invoice bila barisnya penerimaan pelanggan |
| 08 Invoice Jual | Klien, invoice bernomor asli + item, Status Bayar |

Aturan utamanya:

- **Setiap baris sheet masuk tepat sekali**, dengan nominal, tanggal, dan arah yang sama. Tidak ada
  pembayaran atau saldo yang dikarang.
- **Invoice dibayar hanya bila ada bukti di sheet:** penerimaan di Arus Kas yang cocok (nomor invoice,
  nama kapal, lalu invoice terbuka tertua pelanggan yang sama), atau Status Bayar "Lunas". Pembayaran
  dari status "Lunas" masuk ke akun terpisah **Penerimaan Invoice (Status Lunas)** agar Rekening
  Operasional tetap sama persis dengan sheet Arus Kas. Tanpa bukti, invoice tetap *Terkirim*.
- **Kategori ditebak dari deskripsi & pihak**, karena kolom Kategori di sheet kosong. Ada kategori
  tambahan untuk bongkar muat/keagenan (Upah TKBM, Sewa Alat Berat, PNBP Kepelabuhanan, Mooring, …).
- **Tidak ada biaya dobel di Laba Rugi.** Sheet mencatat uang yang diserahkan ke staf keuangan *dan*
  pembayaran staf ke vendor sebagai pengeluaran. Baris penyerahan dana tetap diimpor (total tetap sama
  dengan sheet), tetapi berkategori pendanaan **Mutasi Dana Internal**, sehingga tidak masuk Laba Rugi.
- **Baris janggal ditandai, bukan diubah:** penerimaan yang tercatat di kolom Pengeluaran masuk
  kategori **Perlu Ditinjau**; penerimaan untuk invoice yang sudah lunas masuk **Dana Titipan ›
  Penerimaan Belum Teridentifikasi**. Keduanya tidak masuk Laba Rugi dan tercantum di laporan.
- **Koreksi otomatis dicatat:** tanggal salah ketik di luar tahun buku, tanggal teks, nilai USD (tidak
  dikonversi, total 0 seperti sheet), baris TOTAL sheet yang rumusnya tidak mencakup semua baris.
- **Aman dijalankan ulang:** perusahaan yang hanya berisi hasil impor diimpor ulang dari nol (satu
  transaksi database); perusahaan yang sudah berisi data lain dilewati.
- **"Diinput oleh"** semua hasil impor = pengguna pusat **Impor Data Mentah**
  (`impor.data@mitragroup.id`, bukan anggota perusahaan, tidak bisa login).

Diuji pada data asli di lokal (database terpisah): 8 perusahaan terimpor dan **total pemasukan,
pengeluaran, dan invoice semuanya cocok dengan jumlah baris sheet**. Halaman Invoice, Arus Kas, Kas &
Bank, Klien, Kategori, dan Laba Rugi tampil normal dengan data hasil impor.

## 3. Database

Tidak ada migration. Yang ditulis seeder:

| Tempat | Isi |
|---|---|
| Pusat: `users` | Akun `admin.{kode}`/`manager.{kode}` baru + pengguna **Impor Data Mentah** |
| Pusat: `companies.data` | Kunci `impor_data_mentah` (nama berkas, waktu impor, jumlah invoice & klien) — penanda bahwa isi perusahaan itu hasil impor dan aman diimpor ulang |
| Database perusahaan | Profil (isian kosong saja), kategori tambahan, rekening/kas, klien, invoice, item, pembayaran, transaksi |

## 4. Yang perlu dilakukan saat deploy

Tidak ada langkah wajib; seeder tidak dijalankan `deploy.sh`. Bila ingin mengimpor di server:

1. Salin berkas Excel ke `storage/data-mentah/` di server.
2. `php artisan db:seed --class=DataPerusahaanSeeder --force`.
3. Lengkapi **Profil perusahaan** tiap perusahaan (sheet Identitas umumnya kosong; aplikasi mewajibkan
   alamat, email, telepon, dan penanggung jawab keuangan).
4. Hapus berkas Excel dari server bila sudah tidak diperlukan.

> `MitraGroupSeeder` memanggil `MasterPermissionSeeder`, yang menyetel ulang izin peran finance manager
> & staff ke bawaan. Perilaku ini sudah ada sebelumnya; perhatikan bila izin pernah diubah lewat UI.

## 5. File yang berubah

| File | Isi |
|---|---|
| `database/seeders/DataPerusahaanSeeder.php` | **Baru** — alur utama impor + laporan |
| `database/seeders/DataPerusahaan/` | **Baru** — pembaca Excel, klasifikasi Arus Kas, pencocokan penerimaan, kategori tambahan, penulis ke database |
| `database/seeders/MitraGroupSeeder.php` | Akun admin/manager per perusahaan, daftar perusahaan jadi konstanta publik |
| `storage/data-mentah/README.md` | **Baru** — petunjuk menaruh berkas Excel |
| `.gitignore` | Isi `storage/data-mentah/` diabaikan kecuali README-nya |
| `docs/guides/IMPOR-DATA-MENTAH.md` | **Baru** — panduan impor |
| `docs/module/invoices.md`, `docs/module/transaction-categories.md` | Catatan seeder impor & kategori tambahannya |
| `tests/Feature/DataPerusahaanSeederTest.php`, `tests/Unit/DataPerusahaan/` | **Baru** — tes dengan Excel fiktif |
| `tests/Feature/MitraGroupSeederTest.php` | Akun admin/manager per perusahaan |

## 6. Cara mencoba

Tanpa data asli, cukup jalankan tesnya (Excel fiktif dibangun di dalam tes):

```bash
php artisan test --compact tests/Feature/DataPerusahaanSeederTest.php tests/Unit/DataPerusahaan tests/Feature/MitraGroupSeederTest.php
```

Dengan data asli: taruh berkas template di `storage/data-mentah/`, jalankan seeder, lalu login
`admin@mitragroup.id` / `password` dan buka salah satu perusahaan.

## 7. Tes

- `DataPerusahaanSeederTest`: total cocok dengan sheet, penggabungan baris item & klien, pembayaran dari
  Arus Kas dan dari status Lunas, nilai USD, kategori, koreksi tanggal, pencatat impor, akun per
  perusahaan, impor ulang tanpa dobel, tidak menimpa data manual, folder kosong, dan halaman utama tetap
  tampil.
- `KlasifikasiDanPencocokanTest`: dana ke staf tidak terhitung dua kali, biaya holding, aturan kata
  kunci, DP + pelunasan ke invoice yang sama, nama kapal salah ketik, jenis sisa penerimaan, alias klien.
- Tes seeder lain yang terkait (`MitraGroupSeeder`, `ContohInvoiceSlu/BasSeeder`, `CategoryTemplateService`,
  `ProfitLossService`, `TeksServerMultiBahasaTest`) tetap lulus.
