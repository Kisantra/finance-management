# Test Case — Invoice & Pembayaran

Sumber teknis: [`docs/module/invoices.md`](../../module/invoices.md).
Cara baca tabel & kolom **Lapisan**: lihat [`../README.md`](../README.md).

**Ingat**: jalankan di database `finance_management_qc` (server lokal `127.0.0.1:8001`), bukan
database `finance_management`. Butuh tiga akun: `admin@gmail.com` (admin), `fm@qc.test`
(finance manager), `staff@qc.test` (staff) — semua password `password`.

Data awal dari seeder: 4 invoice Jan–Mar 2026 (nomor format lama `INV/01/KSN/01.26`),
4 pembayaran ke rekening BCA (#1), 5 klien, 3 rekening bank, 0 layanan.

Eksekusi: 21 September 2026; seluruh alur dijalankan ulang 22 September 2026 untuk tangkapan layar resolusi tinggi (hasil database identik). Fokus khusus modul ini: laporan **"total rekap invoice tidak sesuai
dengan filter"** (kasus N02, N03, A14, A16). Kasus bertanda **(API)** dijalankan lewat curl dengan
cookie sesi karena kondisinya tidak bisa dicapai dari layar; hasilnya diverifikasi di database.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Index bulan Februari 2026 menampilkan invoice + statistik yang benar | Buka `/invoices`, ubah filter Bulan → Februari 2026 | Tabel 2 baris (INV/02 Sebagian, INV/03 Lunas). Kartu: Pendapatan Rp 6.000.000, Laba Kotor Rp 4.100.000, Terbayar Rp 4.000.000, Outstanding Rp 2.000.000 "1 invoice belum lunas". Tab Sebagian 1, Lunas 1 | FE+BE | Persis sesuai ekspektasi, semua angka cocok dengan seed | Pass |
| N02 | Tab status "Lunas" pada Feb 2026 | Dari N01 klik tab Lunas | Kartu statistik mengikuti tab yang aktif | FE+BE | **Awalnya GAGAL**: tabel 1 baris (INV/03 Lunas) tetapi kartu tetap Pendapatan Rp 6.000.000 / Outstanding Rp 2.000.000 "1 invoice belum lunas" — inilah keluhan "rekap tidak sesuai filter" (CHG-01). **Setelah diperbaiki**: Pendapatan Rp 2.000.000, Laba Rp 1.600.000, Outstanding Rp 0 "0 invoice belum lunas"; hitungan tab tetap Sebagian 1 / Lunas 1 | Pass |
| N03 | Filter klien + rentang tanggal | Klien = PT. Teknologi Maju Indonesia, Rentang 01/01/2026–31/03/2026 | 2 baris (INV/01, INV/04). Pendapatan Rp 5.000.000, Laba 3.800.000, Terbayar 5.000.000, Outstanding 0 | FE+BE | Sesuai. (Sekaligus memunculkan A14: label Bulan masih "Februari 2026") | Pass |
| N04 | Buat invoice draft dengan 2 item (satu titipan pajak) | Klien CV. Karya Bersama; item "Jasa Pajak Bulanan" 1 × 3.000.000 HPP 500.000; "Titipan PPh 23" 1 × 200.000 titipan pajak; issue hari ini, due 30 Sep 2026 | Redirect ke index. DB: status `draft`, `invoice_number` NULL, subtotal 3.200.000, 2 item, item ke-2 `is_tax_deposit=1` | FE+BE | DB invoice #5: draft, nomor NULL, subtotal 3.200.000, item 1 cogs 500.000, item 2 tax=1, client_id item terisi otomatis dari klien penagihan. Diskon 10% tidak ikut terkirim karena kesalahan otomasi (ref field berubah setelah klik "%") — dicakup ulang di N08 | Pass |
| N05 | Kirim invoice draft → nomor resmi | Buka detail invoice N04 → Kirim | Dialog menampilkan nomor otomatis `001/INV/KSN-KB/IX/2026`, bisa diedit; status `sent` | FE+BE | **Awalnya GAGAL** (BUG-02): field nomor **kosong**, user harus mengetik sendiri; submit kosong → "The invoice number field is required." (Inggris, UX-03). Preview di form buat menulis `KSN-CKB` padahal backend `KSN-KB` (UX-02). Dikirim manual → DB sent, nomor benar. **Setelah diperbaiki**: dialog untuk draft #11 langsung terisi `005/INV/KSN-KB/IX/2026`, konfirmasi → sent | Pass |
| N06 | Catat pembayaran sebagian | Detail invoice N05 → Catat Pembayaran: Rp 1.000.000, rekening Mandiri (#2), ref TRF-QC-001 | Status `partially_paid`, sisa Rp 4.580.000. DB payments +1, saldo Mandiri 31.000.000 | FE+BE | DB: pay#5 1.000.000 acc=2 ref TRF-QC-001; #5 partially_paid remaining 4.580.000; Mandiri 31.000.000 | Pass |
| N07 | Pelunasan dengan lampiran | Tambah pembayaran Rp 4.580.000 + lampiran PNG ke Mandiri | Status `paid`, sisa 0, file tersimpan di `payments/`. Saldo Mandiri 35.580.000 | FE+BE | Percobaan 1 batal oleh tooling (file chooser & selector opsi). Percobaan 2: pay#6 4.580.000, attachment `payments/MPJP…png` ada di disk, #5 paid, Mandiri 35.580.000 | Pass |
| N08 | Edit invoice menghitung ulang total & membuat ulang item | Edit #5: qty item 1 → 2, diskon 10% "Diskon klien lama" | DB: subtotal 6.200.000, discount 620.000, total 5.580.000, item id baru | FE+BE | DB: sub 6.200.000, dval 10, damt 620.000, total 5.580.000, reason tersimpan; item lama (#6,#7) diganti #8,#9. Kolom klien per item tampil kosong di form edit → memicu A17 | Pass |
| N09 | Rollback invoice terkirim → draft | Kirim draft, lalu Rollback dari sheet | Status `draft`, `invoice_number` NULL; tombol hanya untuk sequence tertinggi | FE+BE | **Awalnya GAGAL**: rollback #7 (003) ditolak backend walau tombol tampil, karena draft #9 masih memegang nomor 004 akibat BUG-04. **Setelah diperbaiki**: #11 dikirim (005), rollback → draft, nomor NULL | Pass |
| N10 | Detail sheet menampilkan item & pembayaran | Klik baris invoice N07 | Sheet: 2 item, 2 pembayaran dengan nama rekening & lampiran, NPWP klien, sisa 0 | FE | Sheet #5 Lunas: 2 item, 2 pembayaran "Mandiri - Payroll" (Ref TRF-QC-001; N01-1.png), NPWP 55.666.777.8-555.000, sisa Rp 0 | Pass |
| N11 | Export Excel & PDF rekap mengikuti filter **(API)** | `GET /invoices/export/excel?month=2026-02` dan `/export/pdf?month=2026-02` | 200, content-type benar; Excel 2 baris tanpa draft, kolom omzet/HPP/profit/PPh final | BE | Excel 200 `spreadsheetml`, isi: INV/03 & INV/02, TOTAL 6.000.000 / HPP 1.900.000 / Profit 4.100.000 / PPh 30.000 / Terbayar 4.000.000 / Sisa 2.000.000. PDF 200 `application/pdf` 13,6 KB | Pass |
| N12 | Download & preview PDF invoice per lembar **(API)** | `GET /invoice/5/download`; `GET /invoice/5/preview?dp_amount=1000000` | Download attachment `Invoice-001-INV-KSN-KB-IX-2026.pdf`; preview inline `application/pdf` | BE | Download 200, filename sesuai, 10,2 KB; preview 200 inline 12,4 KB | Pass |
| N13 | Hapus invoice draft | Sheet draft → Hapus → konfirmasi | Baris hilang, DB invoice & item terhapus | FE+BE | Draft #10 (Rp 250.000) hilang dari tabel; DB invoice & item 0 | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Buat invoice tanpa item / form kosong | Submit form kosong; **(API)** `items: []` | Ditolak, tidak ada record | FE+BE | FE: item terakhir tidak bisa dihapus (tombol hapus baris tidak ada); submit kosong → toast "3 kesalahan ditemukan" (client id, due date, items.0.service_name). API `items: []` → 422 "The items field is required." Jumlah invoice tetap | Pass |
| A02 | Jatuh tempo sebelum tanggal invoice | Picker due date; **(API)** due = issue − 1 | Ditolak di kedua lapisan | FE+BE | FE: semua tanggal sebelum tgl invoice disabled di kalender. API → 422 "must be a date after or equal to issue date" | Pass |
| A03 | Quantity 0 **(API)** | `quantity: 0` | 422 `min:0.001` | BE | 422 "The items.0.quantity field must be at least 0.001." (FE tidak diuji khusus) | Pass |
| A04 | Bayar invoice draft **(API)** | `POST /invoices/11/payments` amount 1000 | 422 "Invoice tidak dapat menerima pembayaran." | BE | 422 dengan pesan persis | Pass |
| A05 | Bayar invoice yang sudah lunas | Sheet #5 Lunas; **(API)** `POST /invoices/5/payments` | Tombol Catat Pembayaran hilang; API 422 | FE+BE | Tombol tidak ada di sheet Lunas; API 422 "Invoice tidak dapat menerima pembayaran." | Pass |
| A06 | Pembayaran tanpa rekening / amount 0 | UI simpan tanpa rekening; **(API)** amount 0 tanpa bank_account_id | 422 dengan error `amount` & `bank_account_id` | FE+BE | UI: "Rekening tujuan wajib dipilih." tampil di bawah field (dari 422). API: errors amount + bank_account_id | Pass |
| A07 | Kirim invoice yang bukan draft **(API)** | `POST /invoices/5/send` (paid) nomor 999/… | Ditolak, data tidak berubah | BE | 302 back; DB #5 tetap paid, nomor tetap 001/… | Pass |
| A08 | Rollback invoice bukan sequence tertinggi **(API)** | #6 (002) & #7 (003) sent; rollback #6 | Ditolak | BE | #6 tetap sent 002; `isInvoiceLatestInMonth`=false | Pass |
| A09 | Kirim dengan nomor duplikat **(API)** | `POST /invoices/6/send` nomor 001/INV/KSN-KB/IX/2026 | 422 unique | BE | 422 "The invoice number has already been taken." | Pass |
| A10 | Data legacy: nomor format lama tidak merusak penomoran **(API)** | Seed `INV/01/KSN/01.26` ada; kirim #8 issue 2026-01-20 | Nomor `001/INV/KSN-TMI/I/2026`, tanpa error | BE | Backend menghitung 001/INV/KSN-TMI/I/2026; sent; maxSeq Jan = 1 setelahnya | Pass |
| A11 | Hapus semua pembayaran invoice terkirim **(API)** | #9 sent + bayar 50.000, hapus pembayarannya | Status kembali `sent`, nomor tetap | FE+BE | **Awalnya GAGAL** (BUG-04): status jadi `draft` **sambil tetap memegang nomor** 004/INV/KSN-BS/IX/2026 (tampil "Draft" bernomor di tabel) dan memblokir rollback #7. **Setelah diperbaiki**: #7 bayar 50.000 → hapus → tetap `sent` 003/… | Pass |
| A12 | Hapus invoice yang punya pembayaran | Sheet #5 (1 pembayaran Rp 4.580.000) → Hapus → konfirmasi | Ditolak dengan pesan jelas; pembayaran & saldo tidak berubah | FE+BE | **Percobaan 1 GAGAL** (BUG-05): dialog hanya menyebut "beserta semua item-nya"; invoice + pembayaran terhapus, saldo Mandiri 35.580.000 → 30.000.000 tanpa peringatan, file lampiran yatim. **Percobaan 2 GAGAL** (BUG-06): guard backend menahan (#6 & pembayarannya utuh) tetapi tidak ada pesan apa pun di layar — flash `error` tidak pernah dirender (toast sukses halaman tetap ada; hanya jalur error yang hilang). **Percobaan 3**: toast merah "Invoice yang sudah memiliki pembayaran tidak dapat dihapus…" tampil | Pass |
| A13 | Otorisasi via URL — staff **(API)** | Login `staff@qc.test` (view+create invoices): GET edit, DELETE, POST send, POST rollback | Semua 403 kecuali index/create | BE | **Awalnya GAGAL** (BUG-03): edit 403, delete 403, **tetapi send 302 → invoice #9 jadi `sent` bernomor 004** dan rollback 302 (route tanpa permission). **Setelah diperbaiki**: send 403, rollback 403, draft #11 tidak berubah | Pass |
| A14 | Rentang tanggal vs bulan | Bulan Feb 2026, lalu pilih rentang 01–30 Sep 2026 dari picker | Label bulan tidak menyesatkan | FE+BE | **Awalnya**: hasil mengikuti rentang tetapi label Bulan tetap "Februari 2026" (terlihat di N03). **Setelah diperbaiki**: memilih rentang mengosongkan bulan ("Pilih bulan…"), URL `month=`; memilih bulan mengosongkan rentang | Pass |
| A15 | Lampiran pembayaran tipe salah **(API)** | Upload `.txt` sebagai bukti | 422 `mimes` | BE | 422 "must be a file of type: jpg, jpeg, png, pdf." | Pass |
| A16 | Label kartu statistik jujur | Periode dengan 1 draft | Subjudul menggambarkan rumus yang dipakai | FE | **Awalnya**: draft Rp 5.580.000 tidak dihitung tetapi subjudul "Semua status invoice"; Laba Kotor "Pendapatan − HPP − Pajak" padahal tanpa pajak. **Setelah diperbaiki**: "Tanpa draft & dibatalkan" dan "Pendapatan − HPP" | Pass |
| A17 | Edit invoice multi-klien mempertahankan klien per item | DB: item #6 client_id=3 (billed_to 4); buka edit, simpan tanpa mengubah apa pun | Item tetap client 3 | FE+BE | **Awalnya GAGAL** (BUG-01): form edit menampilkan "Pilih klien…" dan setelah simpan client_id kembali ke 4 — data hilang diam-diam. **Setelah diperbaiki**: form menampilkan "PT. Global Solusi Prima", tersimpan client_id=3 | Pass |

## C. Alur Berantai (lintas modul)

Aksi pembayaran dilakukan dari sheet detail invoice (admin). Yang diuji: dampak di
Rekening Bank, Cash Flow Pemasukan, dan otorisasi akun staff.

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Pembayaran invoice muncul di Rekening Bank & Cash Flow | Setelah N07: `/bank-accounts?account=2` tab Pembayaran; `/cash-flow/income` | Saldo Mandiri naik; 2 baris pembayaran di tab; baris di Pemasukan | FE+BE | Sidebar Mandiri Rp 35.580.000, Pemasukan akun Rp 5.580.000; tab Pembayaran 2 baris (1.000.000 ref TRF-QC-001; 4.580.000 lampiran); Pemasukan menampilkan keduanya dengan kategori "—" (lihat NOTE-01) | Pass |
| C02 | Hapus pembayaran → status & saldo terkoreksi | Hapus pembayaran Rp 1.000.000 dari #5 Lunas via sheet | `partially_paid`, saldo Mandiri turun 1.000.000 | FE+BE | ConfirmDialog "Pembayaran sebesar Rp 1.000.000 … akan dihapus permanen"; DB #5 partially_paid paid 4.580.000, Mandiri 34.580.000 | Pass |
| C03 | Staff: buat invoice boleh, kirim tidak **(API)** | Login staff, POST /invoices; POST send | Buat sukses; kirim 403 | FE+BE | Draft #10 dibuat (302); kirim → lihat A13 (awalnya lolos, kini 403) | Pass |

<!-- qa-evidence:start -->

# Bukti visual langkah per langkah

Screenshot diambil per langkah, bukan hanya hasil akhirnya, supaya alurnya
bisa ditelusuri ulang oleh orang lain. Test case yang kondisinya tidak bisa
dicapai dari layar dijalankan lewat API/DB dan ditandai eksplisit — tidak
dibuatkan screenshot seolah-olah ada alur UI-nya.


## N01 · Index Februari 2026: tabel & statistik — Pass

**1.** Kondisi awal `/invoices`: bulan berjalan (September 2026) kosong karena seed berisi Jan–Mar.

<img src="../evidence/invoices/N01-1.png" width="100%">

**2.** Setelah pilih Februari 2026: 2 baris, Pendapatan Rp 6.000.000, Laba Rp 4.100.000, Terbayar Rp 4.000.000, Outstanding Rp 2.000.000 — cocok dengan seed.

<img src="../evidence/invoices/N01-2.png" width="100%">


## N02 · Tab status Lunas — kartu mengikuti filter — Pass (percobaan ke-2)

**1.** SEBELUM: tab Lunas aktif, tabel hanya INV/03, tetapi kartu masih Outstanding Rp 2.000.000 "1 invoice belum lunas".

<img src="../evidence/invoices/N02-1.png" width="100%">

**2.** SESUDAH: Pendapatan Rp 2.000.000, Laba Rp 1.600.000, Outstanding Rp 0 "0 invoice belum lunas"; subjudul baru "Tanpa draft & dibatalkan" dan "Pendapatan − HPP".

<img src="../evidence/invoices/N02-2.png" width="100%">


## N03 · Filter klien + rentang tanggal — Pass

**1.** Rentang 01 Jan–31 Mar + klien terpilih: baris Jan & Mar tampil; perhatikan label Bulan masih "Februari 2026" (A14).

<img src="../evidence/invoices/N03-1.png" width="100%">


## N04 · Buat invoice draft 2 item (titipan pajak) — Pass

**1.** Form terisi: klien CV. Karya Bersama, 2 item, item 2 ditandai Titipan Pajak (subtotal Rp 3.200.000, Titipan Rp 200.000).

<img src="../evidence/invoices/N04-1.png" width="100%">

**2.** Kembali ke index: baris baru "—" Draft Rp 3.200.000. DB: nomor NULL, 2 item, tax=1 pada item 2.

<img src="../evidence/invoices/N04-2.png" width="100%">


## N05 · Kirim invoice → nomor resmi — Pass (percobaan ke-2)

**1.** Sheet detail draft: tombol Kirim Invoice / Edit / Hapus.

<img src="../evidence/invoices/N05-1.png" width="100%">

**2.** SEBELUM: dialog Kirim Invoice dengan field nomor **kosong** (hanya placeholder).

<img src="../evidence/invoices/N05-2.png" width="100%">

**3.** Submit dengan nomor kosong ditolak: "The invoice number field is required." — validasi berbahasa Inggris (UX-03). Diambil ulang di kode final dengan mengosongkan field; perilaku validasinya sama di kedua versi.

<img src="../evidence/invoices/N05-3.png" width="100%">

**4.** Setelah diketik manual 001/INV/KSN-KB/IX/2026: status Terkirim, kartu terisi.

<img src="../evidence/invoices/N05-4.png" width="100%">

**5.** SESUDAH perbaikan: dialog untuk draft berikutnya langsung terisi 005/INV/KSN-KB/IX/2026.

<img src="../evidence/invoices/N05-5.png" width="100%">


## N06 · Pembayaran sebagian Rp 1.000.000 — Pass

**1.** Sheet invoice Terkirim: tombol Catat Pembayaran tersedia.

<img src="../evidence/invoices/N06-1.png" width="100%">

**2.** Dialog Catat Pembayaran: Rp 1.000.000, Mandiri - Payroll, ref TRF-QC-001.

<img src="../evidence/invoices/N06-2.png" width="100%">

**3.** Setelah simpan: Sudah Dibayar Rp 1.000.000, Sisa Rp 4.580.000, status Sebagian.

<img src="../evidence/invoices/N06-3.png" width="100%">


## N07 · Pelunasan + lampiran PNG — Pass (percobaan ke-2)

**1.** Dialog: Rp 4.580.000 (prefill sisa), rekening Mandiri terpilih, lampiran N01-1.png terpasang.

<img src="../evidence/invoices/N07-1.png" width="100%">

**2.** Setelah simpan: status Lunas, dua pembayaran tercatat. DB: attachment ada, Mandiri 35.580.000.

<img src="../evidence/invoices/N07-2.png" width="100%">


## N08 · Edit: qty ×2 + diskon 10% — Pass

**1.** Form edit terbuka: nilai tersimpan tampil, tetapi kolom klien per item "Pilih klien…" (gejala BUG-01).

<img src="../evidence/invoices/N08-1.png" width="100%">

**2.** Qty item 1 = 2, diskon 10% "Diskon klien lama"; Total Rp 6.200.000 sebelum diskon di ringkasan.

<img src="../evidence/invoices/N08-2.png" width="100%">


## N09 · Rollback terkirim → draft — Pass (percobaan ke-2)

**1.** Daftar September: 001 Lunas, 002 & 003 Terkirim, dan baris **004 berstatus Draft tetapi bernomor** (dampak BUG-04).

<img src="../evidence/invoices/N09-1.png" width="100%">

**2.** Sheet 003/INV/KSN-SN: tombol Rollback ke Draft tampil (FE menganggap eligible).

<img src="../evidence/invoices/N09-2.png" width="100%">

**3.** Setelah klik: 003 tetap Terkirim — backend menolak. FE dan BE tidak sepakat.

<img src="../evidence/invoices/N09-3.png" width="100%">

**4.** SESUDAH: #11 dikirim sebagai 005/INV/KSN-KB/IX/2026, sheet terbuka.

<img src="../evidence/invoices/N09-4.png" width="100%">

**5.** Rollback berhasil: baris kembali "—" Draft; DB nomor NULL.

<img src="../evidence/invoices/N09-5.png" width="100%">


## N10 · Detail sheet: item & riwayat pembayaran — Pass

**1.** Sheet Lunas: Riwayat Pembayaran 2 baris (ref TRF-QC-001; lampiran N01-1.png), Analisis Laba Rp 4.880.000.

<img src="../evidence/invoices/N10-1.png" width="100%">


## N11 · Export Excel & PDF rekap (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — GET export via curl. Excel: 2 baris Feb 2026, tanpa draft, kolom Omzet/HPP/Profit/PPh Final 0,5%; TOTAL 6.000.000/1.900.000/4.100.000/30.000. PDF 200 application/pdf._


## N12 · Download & preview PDF invoice (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI. Download: attachment Invoice-001-INV-KSN-KB-IX-2026.pdf (10,2 KB). Preview DP: inline application/pdf (12,4 KB)._


## N13 · Hapus invoice draft — Pass

**1.** Sheet draft Rp 250.000 (klien Siti Nurhaliza) sebelum dihapus.

<img src="../evidence/invoices/N13-1.png" width="100%">

**2.** Setelah konfirmasi: baris hilang dari tabel.

<img src="../evidence/invoices/N13-2.png" width="100%">


## A01 · Form kosong / tanpa item — Pass

**1.** Submit form kosong: error di bawah Klien, Jatuh Tempo, dan nama layanan; toast merah merangkum 3 kesalahan (pesan Inggris, UX-03).

<img src="../evidence/invoices/A01-1.png" width="100%">


## A02 · Jatuh tempo < tanggal invoice — Pass

**1.** Kalender Jatuh Tempo: tanggal 1–20 September abu-abu (disabled), 21 (hari ini) ke atas aktif — aturan ditegakkan di picker.

<img src="../evidence/invoices/A02-1.png" width="100%">


## A03 · Quantity 0 (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — 422 "must be at least 0.001"._


## A04 · Bayar invoice draft (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — 422 "Invoice tidak dapat menerima pembayaran."_


## A05 · Bayar invoice lunas — Pass

_Tanpa langkah UI — Tombol Catat Pembayaran hilang di sheet Lunas (lihat N10-1); API 422._


## A06 · Pembayaran tanpa rekening / amount 0 — Pass

**1.** Simpan tanpa rekening: "Rekening tujuan wajib dipilih." tampil merah di bawah field — pesan berasal dari respons 422 backend.

<img src="../evidence/invoices/A06-1.png" width="100%">


## A07 · Kirim invoice bukan draft (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — #5 tetap paid dengan nomor lama._


## A08 · Rollback bukan sequence tertinggi (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — #6 (002) tetap sent._


## A09 · Kirim dengan nomor duplikat (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — 422 unique._


## A10 · Nomor legacy tidak merusak sequence (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — #8 Jan 2026 mendapat 001/INV/KSN-TMI/I/2026 walau INV/01/KSN/01.26 ada._


## A11 · Hapus semua pembayaran invoice terkirim — Pass (percobaan ke-2)

**1.** SEBELUM: baris 004/INV/KSN-BS/IX/2026 berstatus **Draft** padahal bernomor — keadaan yang seharusnya mustahil.

<img src="../evidence/invoices/A11-1.png" width="100%">


## A12 · Hapus invoice yang punya pembayaran — Pass (percobaan ke-3)

**1.** SEBELUM: dialog hanya menyebut "beserta semua item-nya" — tidak ada peringatan soal pembayaran Rp 4.580.000.

<img src="../evidence/invoices/A12-1.png" width="100%">

**2.** Setelah konfirmasi: invoice hilang. DB: pembayaran ikut hilang, Mandiri 30.000.000, file lampiran yatim.

<img src="../evidence/invoices/A12-2.png" width="100%">

**3.** Percobaan 2 (guard terpasang): invoice 002 masih ada, tetapi tidak ada pesan apa pun — flash tidak dirender (BUG-06).

<img src="../evidence/invoices/A12-3.png" width="100%">

**4.** Percobaan 3 (handler flash global): toast merah "Invoice yang sudah memiliki pembayaran tidak dapat dihapus…".

<img src="../evidence/invoices/A12-5.png" width="100%">


## A13 · Otorisasi via URL — staff (API) — Pass (percobaan ke-2)

_Tanpa langkah UI — Tanpa langkah UI. Percobaan 1: edit/delete 403 tetapi **send & rollback lolos** (BUG-03) — invoice #9 jadi sent bernomor. Percobaan 2: keduanya 403._


## A14 · Rentang tanggal vs bulan — Pass (percobaan ke-2)

**1.** SEBELUM: Bulan "Februari 2026" + rentang Jan–Mar; baris Jan dan Mar tampil — label bulan bohong.

<img src="../evidence/invoices/A14-1.png" width="100%">

**2.** SESUDAH: pilih rentang 01–30 Sep dari picker → Bulan menjadi "Pilih bulan…", URL month= kosong.

<img src="../evidence/invoices/A14-2.png" width="100%">


## A15 · Lampiran .txt (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI — 422 mimes jpg/jpeg/png/pdf._


## A16 · Label kartu statistik jujur — Pass (percobaan ke-2)

**1.** SEBELUM: ada 1 Draft di periode, semua kartu Rp 0, tetapi subjudul "Semua status invoice" dan "Pendapatan − HPP − Pajak".

<img src="../evidence/invoices/A16-1.png" width="100%">


## A17 · Edit invoice multi-klien — Pass (percobaan ke-2)

**1.** SEBELUM: item yang di DB milik klien 3 tampil "Pilih klien…".

<img src="../evidence/invoices/A17-1.png" width="100%">

**2.** Setelah simpan tanpa perubahan: kembali ke index; DB client_id berubah menjadi 4 (klien penagih).

<img src="../evidence/invoices/A17-2.png" width="100%">

**3.** SESUDAH: form edit menampilkan "PT. Global Solusi Prima"; setelah simpan DB tetap client_id=3.

<img src="../evidence/invoices/A17-3.png" width="100%">


## C01 · Pembayaran tampil di Rekening Bank & Cash Flow — Pass

**1.** Rekening Bank: Mandiri - Payroll Rp 35.580.000, Pemasukan akun Rp 5.580.000.

<img src="../evidence/invoices/C01-1.png" width="100%">

**2.** Tab Pembayaran: dua pembayaran 001/INV/KSN-KB/IX/2026 (Rp 1.000.000 & Rp 4.580.000).

<img src="../evidence/invoices/C01-2.png" width="100%">

**3.** Cash Flow Pemasukan: kedua pembayaran muncul sebagai baris "Invoice" dengan kategori "—" (NOTE-01).

<img src="../evidence/invoices/C01-3.png" width="100%">


## C02 · Hapus pembayaran → status & saldo terkoreksi — Pass

**1.** ConfirmDialog hapus pembayaran Rp 1.000.000 dengan tanggal — jelas dan spesifik.

<img src="../evidence/invoices/C02-1.png" width="100%">

**2.** Setelah hapus: status Sebagian, Sisa Rp 1.000.000; saldo Mandiri turun sesuai.

<img src="../evidence/invoices/C02-2.png" width="100%">


## C03 · Staff: buat boleh, kirim tidak (API) — Pass

_Tanpa langkah UI — Tanpa langkah UI. Staff membuat draft (302 sukses). Pengiriman: lihat A13._


<!-- qa-evidence:end -->
