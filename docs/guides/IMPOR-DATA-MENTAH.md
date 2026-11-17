# Panduan Impor Data Mentah Perusahaan (Mitra Group)

> Untuk admin/pengembang yang memasukkan data keuangan perusahaan Mitra Group dari berkas Excel
> **Template Kelengkapan Data SPT Tahunan** (format konsultan Kisantra) ke aplikasi. Dokumentasi
> kode ada di docblock `database/seeders/DataPerusahaanSeeder.php` dan `database/seeders/DataPerusahaan/`.

## Ringkasnya

```bash
# 1. Salin berkas Excel template ke folder ini (lihat storage/data-mentah/README.md)
storage/data-mentah/

# 2. Jalankan
php artisan db:seed --class=DataPerusahaanSeeder --force

# 3. Baca hasil pencocokan & koreksinya
storage/data-mentah/laporan-impor.md
```

Satu perintah itu:

1. Menjalankan `MitraGroupSeeder`: organization **Mitra Group**, 10 perusahaan (database masing-masing),
   dan semua akun (lihat [Akun](#akun)).
2. Membaca setiap berkas template di `storage/data-mentah/` dan mengenali perusahaannya dari sheet
   **01 Identitas › Nama Perusahaan**.
3. Untuk setiap perusahaan yang berkasnya ada, mengisi profil, kategori, rekening/kas, klien, invoice,
   pembayaran invoice, dan seluruh transaksi Arus Kas.

> **Data asli tidak boleh masuk repo.** Repo ini publik. Folder `storage/data-mentah/` di-gitignore
> (kecuali README-nya), kode seeder hanya berisi aturan, dan test memakai Excel fiktif yang dibangun
> di dalam test.

## Akun

Password semua akun: `password`. Ganti setelah login pertama bila dipakai di server sungguhan.

| Akun | Peran | Perusahaan |
|---|---|---|
| `admin@mitragroup.id` | admin | semua (10) |
| `manager@mitragroup.id` | finance manager | semua (10) |
| `admin.{kode}@mitragroup.id` | admin | satu perusahaan |
| `manager.{kode}@mitragroup.id` | finance manager | satu perusahaan |
| `staff.{kode}@mitragroup.id` | staff | satu perusahaan |

`{kode}`: `aoe` Abdi Ocean Energy · `alz` Alzam Ocean Energy · `bcb` Bahtera Cipta Bersama ·
`bas` Berkah Andalan Samboja · `lns` Lintas Nusa Samudra · `mkb` Mitra Kellian Baruna ·
`mta` Mitra Trisula Amanah (holding) · `nbm` Namora Berlian Mahakam · `nai` Nusantara Armada Indonesia ·
`slu` Samboja Laju Utama.

Selain itu ada pengguna pusat **Impor Data Mentah** (`impor.data@mitragroup.id`): semua transaksi dan
pembayaran hasil impor tercatat "Diinput oleh" pengguna ini. Ia bukan anggota perusahaan mana pun dan
kata sandinya acak, jadi tidak bisa dipakai login.

## Apa yang diimpor

Hanya dari berkas **Template Kelengkapan Data**. Berkas lain (rekap BUPOT, laporan keuangan draft,
rekap faktur, dsb.) tidak dibaca.

| Sheet | Masuk ke |
|---|---|
| **01 Identitas** | Mengenali perusahaan; NPWP, alamat, telepon, email ke Profil perusahaan (**hanya isian yang masih kosong**) |
| **07 Arus Kas** | Transaksi Kas & Bank, atau pembayaran invoice bila barisnya penerimaan dari pelanggan |
| **08 Invoice Jual** | Klien, invoice (nomor asli), item, dan kolom Status Bayar |

Tidak diimpor: **09 Invoice Beli** dan **10 Biaya Operasi** (pembayarannya sudah ada di Arus Kas;
mengimpornya membuat biaya dobel), serta **03 Aset, 04 Utang, 05 Piutang, 06 Gaji** (umumnya kosong).

## Aturan pemetaan

### Prinsip: nilai aplikasi = sheet

Setiap baris sheet masuk **tepat sekali**, dengan nominal, tanggal, dan arah (masuk/keluar) yang sama.
Hasilnya: total uang masuk/keluar di aplikasi sama dengan jumlah baris sheet, dan total invoice sama
dengan total Invoice Jual. Tidak ada pembayaran atau saldo yang dikarang. Nominal berdesimal dibulatkan
ke rupiah penuh.

### Arus Kas → Kas & Bank

| Baris sheet | Akun di aplikasi |
|---|---|
| Biasa | **Rekening Operasional** (bank). Nomor & nama bank dari tabel "Daftar Rekening Aktif" di sheet, atau rekening pertama di Profil; bila kosong, nomornya `-` |
| Seksi **PC** (penanda di kolom A) | **Kas Kecil** (kas, penanggung jawab `staff.{kode}`) |
| Seksi **PNBP** | **Dana PNBP** (kas, penanggung jawab `staff.{kode}`) |

Kolom Kategori di sheet kosong, jadi kategori ditebak dari **deskripsi** dan **pihak**
(`KlasifikasiArusKas`). Selain template kategori bawaan, ditambahkan kategori untuk usaha bongkar muat
dan keagenan kapal (`KategoriImpor`), mis. *Biaya Operasional Pelabuhan & Kapal › Upah TKBM, Sewa Alat
Berat, PNBP Kepelabuhanan, Mooring, Foreman, Jasa Pandu & Tunda …*

Baris yang **bukan pendapatan/biaya** tetap diimpor, tetapi berkategori pendanaan supaya tidak masuk
Laba Rugi:

| Pola di sheet | Kategori |
|---|---|
| Uang perusahaan → staf keuangan (persiapan dana PNBP, petty cash, kasbon), lalu staf membayar vendor | **Mutasi Dana Internal › Dana Operasional ke Staf** — pembayaran staf ke vendor tetap biaya, jadi biayanya tidak dobel |
| Refund kelebihan dana dari staf ke perusahaan | **Mutasi Dana Internal › Pengembalian Dana dari Staf** |
| Isi ulang kas / amprah / top up | **Mutasi Dana Internal › Isi Ulang Kas & Dana Operasional** |
| "SALDO AKHIR … SALDO AWAL …" | **Mutasi Dana Internal › Saldo Pindahan Periode** |
| Salah transfer, penerimaan untuk invoice perusahaan lain | **Dana Titipan › Dana Titipan & Salah Transfer** |
| Penerimaan yang invoicenya sudah lunas (kemungkinan tercatat dua kali) | **Dana Titipan › Penerimaan Belum Teridentifikasi** |
| "TERIMA PEMBAYARAN …" tetapi di kolom Pengeluaran | **Perlu Ditinjau › Arah Transaksi Janggal** (dicatat sebagai pengeluaran sesuai sheet) |

### Invoice Jual → Invoice

- **Nomor invoice asli** dari sheet. Baris tanpa nomor, tanggal, dan pelanggan adalah **item** invoice
  di atasnya; baris lain dengan nomor yang sama digabung menjadi satu invoice.
- **Klien** dibuat dari nama pelanggan. Variasi penulisan ("PT. X" / "X", salah ketik 1–2 huruf)
  digabung. Alias klien diambil dari kode di nomor invoice bila kode itu memang singkatan nama klien.
- Item: satuan `paket`, jumlah 1. Total = kolom Total sheet; PPN = total − DPP. Jatuh tempo = tanggal
  invoice + termin bawaan Profil.
- Nilai mata uang asing ("USD …") tidak dikonversi: totalnya 0 seperti rumus di sheet, nilai aslinya
  dicatat di keterangan item.

### Status bayar: hanya dari bukti di sheet

| Bukti | Hasil |
|---|---|
| Penerimaan pelanggan di Arus Kas | Pembayaran di rekening & tanggal penerimaan itu. Dicocokkan lewat **nomor invoice** di deskripsi, lalu **nama kapal** ("MV. …"), lalu invoice terbuka tertua pelanggan yang sama |
| Kolom Status Bayar **"Lunas"**, tanpa penerimaan di Arus Kas | Pembayaran di akun terpisah **Penerimaan Invoice (Status Lunas)** bertanggal invoice, agar Rekening Operasional tetap sama persis dengan sheet Arus Kas |
| Tidak ada keduanya | Invoice tetap **Terkirim** (belum dibayar) |

### Koreksi saat membaca (semua tercatat di laporan)

- Tanggal di luar tahun buku (mis. 2026 untuk data 2025) dianggap salah ketik dan dikembalikan ke tahun buku.
- Tanggal teks ("19 Maret 2025", "2-Mei-25") diurai; tanggal kosong memakai tanggal baris sebelumnya.
- Nominal negatif dipindah ke arah sebaliknya; baris tanpa nominal dilewati.
- Baris TOTAL di sheet yang rumusnya tidak mencakup semua baris dilaporkan; aplikasi mengikuti baris-barisnya.

## Menjalankan ulang

Aman dijalankan berkali-kali:

- Perusahaan yang **hanya berisi hasil impor sebelumnya** dihapus data impornya lalu diimpor ulang dari
  nol (dalam satu transaksi database; gagal di tengah = data lama utuh).
- Perusahaan yang **sudah berisi data lain** (diinput manual, seeder contoh) **dilewati** dengan
  peringatan, agar tidak tertimpa.
- Perusahaan tanpa berkas dilewati.

> **Peringatan untuk server sungguhan:** `MitraGroupSeeder` memanggil `MasterPermissionSeeder`, yang
> menyetel ulang izin peran *finance manager* dan *staff* ke bawaan. Izin yang pernah diubah lewat
> **Administrasi › Izin & Peran** akan kembali ke bawaan.

## Sesudah impor

1. **Lengkapi Profil perusahaan.** Sheet Identitas umumnya kosong, sementara aplikasi mewajibkan
   alamat, email, telepon, dan penanggung jawab keuangan sebelum perusahaan bisa dipakai. Login sebagai
   admin; aplikasi langsung membuka **Pengaturan › Profil Perusahaan** dan menyebut isian yang kurang.
2. **Isi nomor rekening** Rekening Operasional yang masih `-` di **Kas & Bank**.
3. **Tinjau kategori Perlu Ditinjau dan Penerimaan Belum Teridentifikasi**, serta bagian
   "Perlu diperhatikan" di `laporan-impor.md`, ke sumber datanya.
4. **Invoice yang belum dibayar** bisa dicatat pembayarannya lewat tombol **Catat pembayaran** begitu
   buktinya ada.

## Tanya jawab

**Saldo rekening minus, padahal invoice-nya besar.**
Saldo = saldo awal + uang masuk − uang keluar. Kolom saldo awal di sheet kosong (jadi 0), dan sebagian
sheet Arus Kas tidak mencatat penerimaan dari pelanggan sama sekali, hanya pengeluaran. Saldo aplikasi
sama dengan jumlah baris pemasukan − pengeluaran di sheet itu sendiri (baris "NET CASH FLOW"). Isi saldo awal dari rekening koran, atau catat
pembayaran invoice yang memang sudah diterima.

**Invoice sudah masuk, tetapi pendapatan di Laba Rugi 0.**
Laba Rugi memakai basis kas: pendapatan invoice dihitung saat **pembayarannya** dicatat. Invoice tanpa
bukti bayar di sheet tetap *Terkirim* dan hanya tampil di "Invoice Belum Dibayar". PPN juga bukan
pendapatan (titipan untuk negara), jadi pendapatan = DPP yang sudah dibayar.

**Apakah invoice masuk Arus Kas?**
Invoice-nya tidak; yang masuk Arus Kas adalah **pembayarannya** (baris "Pembayaran invoice" di
Pemasukan & Pengeluaran, saldo Kas & Bank, dan Ringkasan).

**Total Pemasukan di aplikasi beda dengan sheet.**
Saring rekeningnya ke **Rekening Operasional** (ditambah Kas Kecil dan Dana PNBP bila ada). Tanpa
saringan, totalnya ikut memuat akun **Penerimaan Invoice (Status Lunas)**, yang memang tidak ada di
sheet Arus Kas.

## Peta kode

| Berkas | Isi |
|---|---|
| `database/seeders/DataPerusahaanSeeder.php` | Alur utama: akun, baca folder, impor per perusahaan, laporan |
| `database/seeders/MitraGroupSeeder.php` | 10 perusahaan + akun (`PERUSAHAAN`, `emailPerusahaan()`) |
| `DataPerusahaan/PembacaDataMentah.php` | Membaca template Excel (PhpSpreadsheet), mengurai tanggal & nominal |
| `DataPerusahaan/KlasifikasiArusKas.php` | Aturan kategori baris Arus Kas |
| `DataPerusahaan/PencocokanPenerimaan.php` | Memasangkan penerimaan ke invoice |
| `DataPerusahaan/KategoriImpor.php` | Kategori tambahan bongkar muat/keagenan/holding |
| `DataPerusahaan/ImporDataPerusahaan.php` | Menulis ke database perusahaan |
| `tests/Feature/DataPerusahaanSeederTest.php`, `tests/Unit/DataPerusahaan/` | Tes dengan Excel fiktif |
