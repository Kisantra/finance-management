# Test Case — Invoice (redesign Obsidian + pratinjau PDF langsung)

Sumber teknis: [`docs/module/invoices.md`](../../module/invoices.md).
Cara baca tabel & kolom **Lapisan**: lihat [`../README.md`](../README.md).
Pengujian modul lama (sebelum redesign): [`invoices.md`](invoices.md).

**Ingat**: jalankan di database `finance_management_qc` (server lokal `127.0.0.1:8001`), bukan
database `finance_management`. Akun: `admin@gmail.com` / `password`.

Data awal: database QC dari pengujian 21–22 September 2026 (9 invoice Jan–Sep 2026, 5 klien,
3 rekening). Pengujian ini menambah invoice #12 (`005/INV/KSN-TMI/IX/2026`) dan #13
(`006/INV/KSN-BS/IX/2026`) beserta 2 pembayaran. Hari uji: 26 September 2026.

Fokus: permintaan user bahwa **pratinjau di samping editor harus sama persis dengan hasil ekspor**,
tautan `/invoices/{id}` membuka drawer detail (termasuk dari Ringkasan), dan alur baru
(Simpan & terbitkan, Perlu ditagih, pembayaran melebihi sisa).

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Daftar invoice tampil | Buka `/invoices?month=` | Ringkasan 4 angka + bar sebaran status, pil status + "Perlu ditagih", tabel | FE+BE | **Awalnya GAGAL** (BUG-01): halaman putih, `React.Children.only` dari `Button asChild`. **Setelah diperbaiki**: Total ditagih Rp 14.600.000, Perlu ditagih Rp 2.500.000 (2), 9 baris | Pass |
| N02 | Klik baris → drawer, Back menutup | Klik baris Budi Santoso `002/…`, lalu tombol Back browser | URL jadi `/invoices/6?month=`, drawer terbuka; Back → `/invoices?month=`, drawer tertutup | FE | **Awalnya GAGAL** (BUG-02): daftar 21 Sep / 5 Okt, drawer 22 Sep / 6 Okt. **Setelah diperbaiki**: keduanya 22 Sep / 6 Okt; URL dan Back sesuai | Pass |
| N03 | Tautan langsung `/invoices/{id}` | Buka `/invoices/6` langsung, tutup drawer | Drawer terbuka di atas daftar; tutup → `/invoices` | FE+BE | Sesuai | Pass |
| N04 | Dari Ringkasan ke detail invoice, lalu kembali | Di `/dashboard` klik baris invoice Siti Nurhaliza, tutup drawer | `/invoices/7` dengan drawer; tutup → kembali ke `/dashboard` | FE | Percobaan 1 salah klik tautan "Buat invoice" (tooling). Percobaan 2 sesuai; sebelum redesign tautan ini membuka JSON mentah | Pass |
| N05 | Editor: pratinjau langsung mengikuti isian | Klien Budi Santoso; item Website 1 × 4.500.000 (HPP 1.200.000), Maintenance 3 × 450.000, Titipan PPh 23 135.000; lalu qty baris 2 → 4 | Pratinjau = PDF template kisantra, baris yang diedit disorot, angka berubah setiap isian berubah | FE+BE | **Awalnya GAGAL** dua kali: input harga menutupi subtotal & tanggal terpotong (BUG-03), dan pratinjau HTML tidak identik dengan PDF (BUG-05, lihat N09). **Setelah diperbaiki**: pratinjau adalah PDF asli; baris 2 disorot; 4 × 450.000 = 1.800.000, TOTAL 6.435.000; nomor perkiraan `006/INV/KSN-BS/IX/2026` | Pass |
| N06 | Simpan & terbitkan | Editor berisi 3 item (klien PT. Teknologi Maju) → Simpan & terbitkan | Nomor = perkiraan, status Terkirim, drawer invoice baru terbuka | FE+BE | Toast "Invoice diterbitkan: 005/INV/KSN-TMI/IX/2026", URL `/invoices/12`. DB: `sent`, subtotal = total 6.435.000, 3 item, titipan `is_tax_deposit=1` | Pass |
| N07 | Catat pembayaran 50% tunai | Drawer #12 → Catat pembayaran → chip 50%, rekening BCA, Tunai, ref KW-QA-0926 | Nominal 3.217.500, status Sebagian, metode tunai tersimpan | FE+BE | DB: pembayaran 3.217.500 `cash` rekening 1 ref KW-QA-0926; #12 `partially_paid` sisa 3.217.500. Chip aktif awalnya tidak tampak aktif (BUG-04), tangkapan ulang setelah perbaikan | Pass |
| N08 | Dialog cetak: pelunasan & uang muka | Drawer #12 → Cetak; lalu Uang muka Rp 2.000.000 → Unduh PDF | Default Pelunasan (sudah ada pembayaran); panel kanan PDF asli mengikuti jenis tagihan; unduhan berjalan | FE+BE | Pratinjau "TOTAL PELUNASAN" lalu "TOTAL DOWN PAYMENT IDR 2.000.000"; berkas `DP-Invoice-005-INV-KSN-TMI-IX-2026.pdf` | Pass |
| N09 | Pratinjau sama persis dengan ekspor | Ambil PDF pratinjau editor (data invoice #13) dan PDF `/invoice/13/download`; bandingkan byte dan piksel | Identik | BE | **Awalnya GAGAL** (BUG-05): pratinjau HTML vs PDF beda 15,2% piksel (margin), lalu 9,66% setelah margin dibetulkan (flex & tinggi baris). **Setelah diganti PDF asli**: 10.797 vs 10.797 byte, identik setelah stempel waktu & `/ID` dibuang, 0 piksel berbeda | Pass |
| N10 | Simpan draft | Editor N05 → Simpan draft | Draft tanpa nomor, drawer terbuka | FE+BE | Toast "Invoice disimpan sebagai draft.", `/invoices/13`, "belum bernomor" | Pass |
| N11 | Filter "Perlu ditagih" lintas bulan | Bulan Sep 2026 aktif → klik pil "Perlu ditagih 2" | Tampil invoice terkirim/sebagian yang lewat jatuh tempo dari bulan mana pun | FE+BE | 2 baris: `INV/02/KSN/02.26` (lewat 216 hari, sisa 2.000.000) dan `001/INV/KSN-TMI/I/2026` (lewat 235 hari) walau bulan = Sep | Pass |
| N12 | Tab "Pratinjau cetak" di drawer | Drawer #12 → tab Pratinjau cetak | PDF asli invoice tersimpan | FE | Sesuai (percobaan 1: skrip menunggu body penampil PDF yang dianggap tersembunyi — tooling) | Pass |
| N13 | Mode terang | Tema terang: daftar dan edit #12 | Token terang, kontras terbaca, pratinjau tetap PDF | FE | Sesuai | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Simpan form kosong | Buka editor, langsung Simpan draft | Banner "2 isian perlu diperbaiki", galat di field, toast; tidak ada data tersimpan | FE+BE | Percobaan 1: skrip mengklik sebelum Inertia selesai inisialisasi sehingga kunjungan tak pernah selesai (tooling; klik kedua dan klik setelah halaman siap selalu berhasil). Pesan awalnya bahasa Inggris "The client id field is required." (BUG-06). **Setelah diperbaiki**: "Klien wajib dipilih.", "Nama layanan baris 1 wajib diisi." | Pass |
| A02 | Pembayaran melebihi sisa | #12 sisa 3.217.500 → Nominal lain 5.000.000; lalu kirim langsung ke API | UI memblokir tombol simpan; server menolak 422 | FE+BE | UI: "Melebihi sisa tagihan Rp 3.217.500. Catat kelebihan sebagai transaksi terpisah.", tombol nonaktif. `POST /invoices/12/payments` amount 5.000.000 via sesi yang sama → **422** pesan sama; tidak ada pembayaran baru | Pass |
| A03 | Tautan ke invoice yang tidak ada | Buka `/invoices/999999` | Daftar tetap tampil, drawer "Invoice tidak ditemukan" | FE+BE | Sesuai; `/invoices/999999/data` → 404 (diharapkan) | Pass |
| A04 | Kirim dengan nomor yang sudah dipakai | Draft CV. Karya Bersama → Kirim, ganti nomor jadi `005/INV/KSN-TMI/IX/2026` | Ditolak, tawarkan nomor yang disarankan | FE+BE | Awalnya pesan Inggris (BUG-06), tautan saran bergaya kotak field (BUG-04), dan galat tetap tampil setelah memakai saran. **Setelah diperbaiki**: "Nomor ini sudah dipakai invoice lain." + "Pakai nomor yang disarankan" → `007/INV/KSN-KB/IX/2026`, galat hilang; status tetap draft | Pass |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Draft → Kirim → Lunas → saldo bank | Draft #13 → Kirim invoice (nomor saran) → Catat pembayaran Sisa penuh ke BCA ref TRF-QA-0926 → tutup drawer | Nomor `006/INV/KSN-BS/IX/2026`, status Lunas, daftar segar, saldo BCA bertambah | FE+BE | DB: #13 `paid`, dibayar 6.435.000 `bank_transfer` ref TRF-QA-0926; saldo BCA (terhitung) 64.702.500; daftar menampilkan #13 Lunas tanpa muat ulang manual | Pass |

## D. Pembaruan 28 September 2026 — modal berbasis hash

Masukan user setelah uji di atas: detail yang dibuka dari Ringkasan memindahkan halaman ke daftar
invoice (N04), padahal yang diinginkan adalah modal yang menumpang di halaman mana pun seperti Settings
di claude.ai. N02–N04 di atas mencatat perilaku lama dan **digantikan** oleh kasus berikut.
Diverifikasi dengan eksekusi di browser (Playwright, database QC); tangkapan layar hanya untuk
pemeriksaan penulis (skala 1×), tidak disertakan sebagai bukti laporan.

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| M01 | Modal di atas Ringkasan | Di `/dashboard` klik invoice Siti Nurhaliza; refresh; tutup; buka lagi; Back; Forward; tutup | URL `/dashboard#invoice/7`, halaman tetap Ringkasan di setiap langkah; Back menutup, Forward membuka | FE | Semua langkah sesuai; posisi gulir halaman terjaga (444 px sebelum dan sesudah membuka/menutup). Percobaan pertama gagal: setelah refresh modal tidak muncul karena `usePage().url` tidak memuat hash — diperbaiki dengan membaca `location.hash` | Pass |
| M02 | Modal dari daftar invoice | Klik baris di `/invoices?month=`, tutup | `/invoices?month=#invoice/13`, tutup → `/invoices?month=` | FE | Sesuai | Pass |
| M03 | Tautan lama `/invoices/{id}` | Buka `/invoices/7` langsung, tutup | Menjadi `/invoices#invoice/7`, tutup → `/invoices` | FE+BE | Sesuai | Pass |
| M04 | Aksi tanpa menutup modal | Di `/dashboard#invoice/6` catat pembayaran Rp 100.000; di daftar draft kirim lalu kembalikan ke draft | Modal tetap terbuka, halaman di belakang ikut segar | FE+BE | Sisa tagihan drawer 950.000 → 850.000 dan kartu Ringkasan 194.702.500 → 194.802.500 dengan modal tetap terbuka; kirim `007/INV/KSN-KB/IX/2026` lalu rollback, URL tetap `…#invoice/11` | Pass |

## E. Filter & Ekspor (29 September 2026)

Dijalankan lewat layar (bukan API) di atas data QC yang sama; setiap angka dicocokkan dengan query
database dan isi berkas ekspor dibaca ulang (Excel via openpyxl, PDF via PyMuPDF).

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N14 | Filter bulan | Pemilih bulan → Feb 2026 | 2 invoice (INV/02 Sebagian, INV/03 Lunas); Total ditagih 6.000.000, dibayar 4.000.000, belum dibayar 2.000.000 | FE+BE | Persis sesuai database; "Perlu ditagih" tetap 2.500.000 (lintas bulan) | Pass |
| N15 | Tab status di dalam bulan | Dari N14 klik pil "Lunas" | Hanya INV/03; kartu mengikuti tab, hitungan pil tidak | FE+BE | 1 baris; kartu 2.000.000 / 2.000.000 / 0; pil tetap Sebagian 1, Lunas 1 | Pass |
| N16 | Filter klien + semua bulan | Kosongkan bulan (×), klien = PT. Teknologi Maju Indonesia | 4 invoice; ditagih 11.935.000, dibayar 8.217.500, belum 3.717.500 (2), perlu ditagih 500.000 (1) | FE+BE | Persis sesuai perhitungan dari database | Pass |
| N17 | Pencarian | Semua bulan, cari "Budi" | 3 invoice Budi Santoso | FE+BE | 006, 002, 004 — "Semua periode · 3 invoice" | Pass |
| N18 | Rentang tanggal | Rentang 1 Jan – 28 Feb 2026 | 4 invoice; bulan ditandai "Rentang aktif"; ditagih 9.500.000, dibayar 7.000.000 | FE+BE | Sesuai; judul "1 Jan 2026 – 28 Feb 2026 · 4 invoice". Percobaan 1 gagal karena skrip (klik saat halaman memuat, tombol panah kalender tanpa label) | Pass |
| N19 | Urut kolom Jumlah | Klik judul Jumlah dua kali | Turun lalu naik; teks footer sesuai | FE+BE | Urutan benar (4.000.000→500.000, lalu sebaliknya), `aria-sort` benar. **Awalnya GAGAL** (BUG-08): footer "urut jumlah terlama". **Setelah diperbaiki**: "urut jumlah terkecil" | Pass |
| N20 | Paginasi menjaga filter | `/invoices?month=&per_page=5` → halaman 2 | Data 6–10 dari 11, filter tetap | FE+BE | "Menampilkan 6–10 dari 11 data", URL tetap `month=&per_page=5` | Pass |
| N21 | Ekspor Excel dari layar | Dengan filter N16 → Ekspor → Rekap Excel | Isi berkas = baris di layar | FE+BE | URL membawa `client_ids[]=1&month=`; berkas 4 baris, TOTAL 11.935.000 / terbayar 8.217.500 / sisa 3.717.500 | Pass |
| N22 | Ekspor PDF dari layar | Filter sama → Rekap PDF | Isi PDF = baris di layar | FE+BE | 4 baris dan kartu ringkasan identik dengan Excel & layar | Pass |
| A05 | Ekspor saat "Perlu ditagih" aktif | Pil "Perlu ditagih" → Ekspor Excel & PDF | Berkas hanya berisi invoice lewat jatuh tempo yang tampil | FE+BE | **Awalnya GAGAL** (BUG-07): layar 2 invoice (Feb & Jan), Excel berisi 5 invoice September, tak satu pun lewat tempo. **Setelah diperbaiki**: Excel & PDF 2 invoice, sisa 2.500.000 = kartu "Perlu ditagih", periode "Perlu ditagih (lewat jatuh tempo, semua periode)" | Pass |
| A06 | Filter tanpa hasil | Tab Lunas + cari "zzz-tidak-ada" → "Hapus filter" | Keadaan kosong + satu aksi pemulih | FE | "Tidak ada invoice lunas · Coba bulan lain atau hapus filter."; Hapus filter → bulan berjalan, 6 invoice | Pass |
| A07 | Ekspor mengikuti tab + pencarian | Semua bulan, tab Lunas, cari "Teknologi" → Ekspor Excel | 2 invoice lunas milik PT. Teknologi Maju | FE+BE | INV/04 & INV/01, TOTAL 5.000.000 — sama dengan layar | Pass |
| N23 | Katalog per baris (masukan user) | Buat invoice, tambah baris ke-2 → 🔍 baris 2 pilih "Maintenance website"; 🔍 baris 1 pilih "Website company profile" | Tiap pilihan mengisi nama & harga baris itu sendiri; tidak ada tombol katalog di header kartu | FE | Baris 1 "Website company profile" 4.500.000, baris 2 "Maintenance website" 450.000; tombol header sudah tidak ada | Pass |

<!-- qa-evidence:start -->

# Bukti visual langkah per langkah

Screenshot diambil per langkah, bukan hanya hasil akhirnya, supaya alurnya
bisa ditelusuri ulang oleh orang lain. Test case yang kondisinya tidak bisa
dicapai dari layar dijalankan lewat API/DB dan ditandai eksplisit — tidak
dibuatkan screenshot seolah-olah ada alur UI-nya.


## N01 · Daftar invoice tampil — Pass (percobaan ke-2)

**1.** `/invoices?month=` setelah perbaikan: ringkasan Total ditagih Rp 14.600.000, Sudah dibayar Rp 9.050.000 (62%), Belum dibayar Rp 5.550.000, Perlu ditagih Rp 2.500.000; bar sebaran status; tabel 9 baris.

<img src="../evidence/invoices-redesign/N01-1.png" width="100%">


## N02 · Klik baris → drawer, Back menutup — Pass (percobaan ke-2)

**1.** Klik baris Budi Santoso `002/INV/KSN-BS/IX/2026`: URL `/invoices/6?month=`, drawer menampilkan Diterbitkan 22 Sep 2026 · jatuh tempo 6 Okt 2026 — sama dengan kolom daftar.

<img src="../evidence/invoices-redesign/N02-1.png" width="100%">

**2.** Tombol Back browser: drawer tertutup, URL kembali `/invoices?month=` dengan filter utuh.

<img src="../evidence/invoices-redesign/N02-2.png" width="100%">


## N03 · Tautan langsung /invoices/{id} — Pass

**1.** Membuka `/invoices/6` langsung: daftar dirender server dengan drawer invoice #6 sudah terbuka.

<img src="../evidence/invoices-redesign/N03-1.png" width="100%">

**2.** Tutup drawer: URL menjadi `/invoices`, daftar tetap di tempat.

<img src="../evidence/invoices-redesign/N03-2.png" width="100%">


## N04 · Dari Ringkasan ke detail invoice dan kembali — Pass (percobaan ke-2)

**1.** Ringkasan: tautan invoice Siti Nurhaliza (bingkai oranye ditambahkan skrip untuk penanda) mengarah ke `/invoices/7`.

<img src="../evidence/invoices-redesign/N04-1.png" width="100%">

**2.** Setelah klik: `/invoices/7` dengan drawer `003/INV/KSN-SN/IX/2026` Terkirim. Sebelum redesign tautan ini membuka JSON mentah.

<img src="../evidence/invoices-redesign/N04-2.png" width="100%">

**3.** Tutup drawer: kembali ke `/dashboard` (Ringkasan), bukan ke daftar invoice.

<img src="../evidence/invoices-redesign/N04-3.png" width="100%">


## N05 · Editor: pratinjau PDF langsung — Pass (percobaan ke-4)

**1.** Editor kosong: kiri isian, kanan pratinjau berlabel "terbaru" — sudah PDF asli (kertas di penampil PDF browser).

<img src="../evidence/invoices-redesign/N05-1.png" width="100%">

**2.** Setelah mengisi klien Budi Santoso dan 3 item (satu titipan pajak) dan fokus di qty baris 2: status "baris 2 disorot", baris 2 berwarna biru di PDF, nomor perkiraan `006/INV/KSN-BS/IX/2026`.

<img src="../evidence/invoices-redesign/N05-2.png" width="100%">

**3.** Qty baris 2 diubah 3 → 4: subtotal kiri Rp 1.800.000 dan PDF ikut berubah (4 bulan, 1.800.000, TOTAL IDR 6.435.000).

<img src="../evidence/invoices-redesign/N05-3.png" width="100%">


## N06 · Simpan & terbitkan — Pass

**1.** Setelah Simpan & terbitkan: toast "Invoice diterbitkan: 005/INV/KSN-TMI/IX/2026", URL `/invoices/12`, drawer invoice baru status Terkirim.

<img src="../evidence/invoices-redesign/N06-1.png" width="100%">


## N07 · Catat pembayaran 50% tunai — Pass (percobaan ke-2)

**1.** Dialog Catat pembayaran: chip 50% aktif mengisi Rp 1.608.750 (tangkapan ulang saat sisa sudah 3.217.500), rekening BCA, metode Tunai, ref KW-QA-0926.

<img src="../evidence/invoices-redesign/N07-1.png" width="100%">

**2.** Setelah simpan (percobaan asli, 50% dari 6.435.000): toast "Pembayaran Rp 3.217.500 dicatat.", status Sebagian, riwayat "dicatat · tunai".

<img src="../evidence/invoices-redesign/N07-2.png" width="100%">


## N08 · Dialog cetak: pelunasan & uang muka — Pass

**1.** Cetak dari drawer #12: jenis tagihan default Pelunasan (sudah ada pembayaran), panel kanan PDF asli "TOTAL PELUNASAN IDR 3.217.500".

<img src="../evidence/invoices-redesign/N08-1.png" width="100%">

**2.** Uang muka Rp 2.000.000: ringkasan kiri "Sisa setelah DP Rp 4.435.000" dan PDF kanan "TOTAL DOWN PAYMENT IDR 2.000.000". Unduh PDF menghasilkan `DP-Invoice-005-INV-KSN-TMI-IX-2026.pdf`.

<img src="../evidence/invoices-redesign/N08-2.png" width="100%">


## N09 · Pratinjau sama persis dengan ekspor — Pass (percobaan ke-2)

**1.** SEBELUM: pratinjau HTML (kiri) vs PDF unduhan (tengah) vs tumpang tindih (kanan): beda 9,66% piksel — kotak TOTAL tertata berbeda dan isi bawah bergeser.

<img src="../evidence/invoices-redesign/N09-1.png" width="100%">

**2.** SESUDAH: PDF pratinjau editor (kiri) vs PDF `/invoice/13/download` (tengah): 10.797 byte keduanya, identik setelah stempel waktu & ID acak dibuang, selisih piksel 0 (kanan putih polos).

<img src="../evidence/invoices-redesign/N09-2.png" width="100%">


## N10 · Simpan draft — Pass

**1.** Simpan draft dari editor N05: toast "Invoice disimpan sebagai draft.", `/invoices/13`, drawer "belum bernomor" status Draft dengan tombol Kirim invoice.

<img src="../evidence/invoices-redesign/N10-1.png" width="100%">


## N11 · Filter Perlu ditagih lintas bulan — Pass (percobaan ke-2)

**1.** Pil "Perlu ditagih" aktif: invoice Feb dan Jan 2026 yang lewat jatuh tempo (penanda "lewat 216/235 hari") tampil walau filter bulan September; pemilih bulan diredupkan.

<img src="../evidence/invoices-redesign/N11-1.png" width="100%">


## N12 · Tab Pratinjau cetak di drawer — Pass

**1.** Drawer #12 tab Pratinjau cetak: PDF asli invoice tersimpan dengan pilihan Pas lebar/100%.

<img src="../evidence/invoices-redesign/N12-1.png" width="100%">


## N13 · Mode terang — Pass

**1.** Daftar invoice mode terang.

<img src="../evidence/invoices-redesign/N13-1.png" width="100%">

**2.** Edit invoice #12 mode terang, fokus baris 1: "baris 1 disorot" dan baris 1 biru di PDF; tombol tunggal Simpan perubahan karena invoice sudah terbit.

<img src="../evidence/invoices-redesign/N13-2.png" width="100%">


## A01 · Simpan form kosong — Pass (percobaan ke-3)

**1.** Banner "2 isian perlu diperbaiki", galat di bawah Klien ("Klien wajib dipilih.") dan baris 1 ("Nama layanan baris 1 wajib diisi."), toast daftar galat; URL tetap `/invoices/create`.

<img src="../evidence/invoices-redesign/A01-1.png" width="100%">


## A02 · Pembayaran melebihi sisa (FE+BE) — Pass (percobaan ke-2)

**1.** Nominal lain Rp 5.000.000 > sisa 3.217.500: "Melebihi sisa tagihan Rp 3.217.500. Catat kelebihan sebagai transaksi terpisah.", chip Nominal lain aktif, tombol Simpan nonaktif.

<img src="../evidence/invoices-redesign/A02-1.png" width="100%">


## A03 · Tautan ke invoice yang tidak ada — Pass

**1.** `/invoices/999999`: daftar tetap tampil, drawer "Invoice tidak ditemukan" dengan tombol Tutup.

<img src="../evidence/invoices-redesign/A03-1.png" width="100%">


## A04 · Kirim dengan nomor yang sudah dipakai — Pass (percobaan ke-3)

**1.** Nomor `005/INV/KSN-TMI/IX/2026` (milik #12) ditolak: "Nomor ini sudah dipakai invoice lain." + tautan "Pakai nomor yang disarankan".

<img src="../evidence/invoices-redesign/A04-1.png" width="100%">

**2.** Klik tautan: nomor kembali ke saran `007/INV/KSN-KB/IX/2026` dan galat di bawah field hilang (toast galat sengaja tidak menutup sendiri). Dialog lalu dibatalkan; invoice tetap draft.

<img src="../evidence/invoices-redesign/A04-2.png" width="100%">


## C01 · Draft → Kirim → Lunas → saldo bank — Pass

**1.** Kirim invoice draft #13: nomor terisi otomatis `006/INV/KSN-BS/IX/2026`, ringkasan klien & total.

<img src="../evidence/invoices-redesign/C01-1.png" width="100%">

**2.** Setelah kirim: status Terkirim, tombol utama berganti Catat pembayaran.

<img src="../evidence/invoices-redesign/C01-2.png" width="100%">

**3.** Catat pembayaran Sisa penuh Rp 6.435.000 ke BCA: status Lunas, sisa Rp 0.

<img src="../evidence/invoices-redesign/C01-3.png" width="100%">

**4.** Tutup drawer: daftar sudah segar — #13 Lunas, ringkasan Sudah dibayar naik; toast pembayaran masih terlihat.

<img src="../evidence/invoices-redesign/C01-4.png" width="100%">


## N14 · Filter bulan Feb 2026 — Pass

**1.** Bulan Feb 2026: INV/03 Lunas & INV/02 Sebagian; Total ditagih Rp 6.000.000, dibayar Rp 4.000.000, belum dibayar Rp 2.000.000 — sama dengan database.

<img src="../evidence/invoices-redesign/N14-1.png" width="100%">


## N15 · Tab status di dalam bulan — Pass

**1.** Pil Lunas: hanya INV/03; kartu 2.000.000 / 2.000.000 / 0, sedangkan hitungan pil tetap Sebagian 1 · Lunas 1.

<img src="../evidence/invoices-redesign/N15-1.png" width="100%">


## N16 · Filter klien + semua bulan — Pass

**1.** Klien PT. Teknologi Maju Indonesia, semua bulan: 4 invoice; ditagih Rp 11.935.000, dibayar Rp 8.217.500, belum dibayar Rp 3.717.500, perlu ditagih Rp 500.000.

<img src="../evidence/invoices-redesign/N16-1.png" width="100%">


## N17 · Pencarian — Pass

**1.** Cari "Budi" di semua bulan: 3 invoice Budi Santoso (006, 002, 004).

<img src="../evidence/invoices-redesign/N17-1.png" width="100%">


## N18 · Rentang tanggal — Pass (percobaan ke-2)

**1.** Kalender rentang: 1 Jan – 28 Feb 2026 dipilih lewat pemilih bulan.

<img src="../evidence/invoices-redesign/N18-1.png" width="100%">

**2.** Hasil: 4 invoice, judul "1 Jan 2026 – 28 Feb 2026 · 4 invoice", pemilih bulan berlabel "Rentang aktif"; ditagih Rp 9.500.000, dibayar Rp 7.000.000.

<img src="../evidence/invoices-redesign/N18-2.png" width="100%">


## N19 · Urut kolom Jumlah — Pass (percobaan ke-2)

**1.** Urut Jumlah naik: 100.000 → 6.435.000, footer "11 invoice · urut jumlah terkecil" (sebelumnya tertulis "terlama").

<img src="../evidence/invoices-redesign/N19-1.png" width="100%">


## N20 · Paginasi menjaga filter — Pass

**1.** `per_page=5`, semua bulan: halaman 1 berisi 5 dari 11 invoice, pager 1 2 3.

<img src="../evidence/invoices-redesign/N20-1.png" width="100%">

**2.** Halaman 2: "Menampilkan 6–10 dari 11 data", URL tetap `month=&per_page=5`.

<img src="../evidence/invoices-redesign/N20-2.png" width="100%">


## N21 · Ekspor Excel dari layar — Pass

**1.** Menu Ekspor dengan filter N16 aktif; tautan Rekap Excel membawa `month=&client_ids[]=1`.

<img src="../evidence/invoices-redesign/N21-1.png" width="100%">

**2.** Isi berkas Excel yang terunduh: 4 baris PT. Teknologi Maju, TOTAL omzet 11.935.000, terbayar 8.217.500, sisa 3.717.500 — sama dengan layar.

<img src="../evidence/invoices-redesign/N21-2.png" width="100%">


## N22 · Ekspor PDF dari layar — Pass

**1.** Rekap PDF yang terunduh (dirender ulang dari berkas): kartu Omzet 11.935.000 & Outstanding 3.717.500, 4 baris sama dengan Excel.

<img src="../evidence/invoices-redesign/N22-1.png" width="100%">


## A05 · Ekspor saat "Perlu ditagih" aktif — Pass (percobaan ke-2)

**1.** Layar: pil Perlu ditagih aktif, 2 invoice lewat tempo (Feb & Jan); menu Ekspor terbuka. Tangkapan sebelum perbaikan: tautan belum membawa `status=overdue`.

<img src="../evidence/invoices-redesign/A05-1.png" width="100%">

**2.** SEBELUM: Excel berisi 5 invoice September, tidak satu pun lewat jatuh tempo — rekap tidak sesuai layar.

<img src="../evidence/invoices-redesign/A05-2.png" width="100%">

**3.** SESUDAH: Excel berisi tepat 2 invoice yang tampil, sisa 2.500.000 = kartu Perlu ditagih; periode "Perlu ditagih (lewat jatuh tempo, semua periode)".

<img src="../evidence/invoices-redesign/A05-3.png" width="100%">

**4.** SESUDAH: Rekap PDF menampilkan 2 invoice yang sama.

<img src="../evidence/invoices-redesign/A05-4.png" width="100%">


## A06 · Filter tanpa hasil — Pass (percobaan ke-2)

**1.** Tab Lunas + cari "zzz-tidak-ada": keadaan kosong "Tidak ada invoice lunas" dengan tombol Hapus filter.

<img src="../evidence/invoices-redesign/A06-1.png" width="100%">

**2.** Setelah Hapus filter: kembali ke bulan berjalan tanpa pencarian/status, 6 invoice.

<img src="../evidence/invoices-redesign/A06-2.png" width="100%">


## A07 · Ekspor mengikuti tab + pencarian — Pass

**1.** Semua bulan, pil Lunas, cari "Teknologi": INV/04 dan INV/01.

<img src="../evidence/invoices-redesign/A07-1.png" width="100%">

**2.** Excel yang terunduh: dua baris yang sama, TOTAL 5.000.000.

<img src="../evidence/invoices-redesign/A07-2.png" width="100%">


## N23 · Katalog per baris (masukan user) — Pass

**1.** Tombol 🔍 di samping nama layanan setiap baris; katalog dibuka dari baris 2 (layanan uji ditambahkan ke database QC).

<img src="../evidence/invoices-redesign/N23-1.png" width="100%">

**2.** Hasil: baris 1 "Website company profile" Rp 4.500.000 dan baris 2 "Maintenance website" Rp 450.000 — masing-masing terisi di barisnya sendiri; pratinjau PDF ikut memuat keduanya.

<img src="../evidence/invoices-redesign/N23-2.png" width="100%">


<!-- qa-evidence:end -->
