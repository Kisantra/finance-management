# QA — Kategori Transaksi › Pakai Template

_QA 9 NOVEMBER 2026 · KATEGORI TRANSAKSI · PAKAI TEMPLATE_

Eksekusi 10 test case di `test-cases/template-kategori.md` untuk fitur **Pakai Template**: template 12 induk / 55 sub
yang sudah bergrup Laba Rugi, pratinjau (prop Inertia opsional `templatePreview`), penerapan lewat
`POST /transaction-categories/template`, pencocokan nama ternormalisasi, penjaga induk, idempoten, izin
`manage categories`, perusahaan baru yang langsung berisi template, tampilan ponsel, serta dampaknya ke pemilih
kategori dan Laporan Laba Rugi. Aktor: Admin QA, Finance manager QA, pengguna hanya-lihat kategori.

Dokumen sumber: [`test-cases/template-kategori.md`](../test-cases/template-kategori.md) (tabel + bukti per langkah),
[`manifests/template-kategori.json`](../manifests/template-kategori.json), PDF:
[`Laporan-QA-template-kategori.pdf`](Laporan-QA-template-kategori.pdf). Lingkungan & akun: [`README.md`](../README.md).

## Skor (dihitung dari tabel test case dan manifest)

```
 10  test case dijalankan (dari 10; belum diuji/blocked: 0)
 10  akhirnya lolos   (status tabel: Pass 10)
  0  gagal di percobaan pertama
  1  temuan tampilan diperbaiki selama QA (UX-T1; tidak menggagalkan case)
 9/9 case ber-lapisan FE/FE+BE punya bukti layar (gerbang check_evidence.py: LULUS)
```

Komposisi: N=4, A=5, C=1 (N normal, A tidak normal, C berantai); lapisan BE=1, FE=3, FE+BE=6.

## Ringkasan

Seluruh 10 test case lolos pada percobaan pertama; tidak ada bug aplikasi yang menggagalkan case. Perusahaan baru
yang dibuat lewat layar langsung berisi 77 kategori — 6 kategori sistem Utang/Piutang, Setoran & Penarikan Modal,
Transfer Internal → Antar Rekening Sendiri, dan 67 kategori template — tanpa satu pun pemasukan/pengeluaran yang
belum diklasifikasi dan tanpa kategori bawaan khas Kisantra; pratinjaunya 0 / 67 / 0 dengan tombol nonaktif.

Di perusahaan lama, pratinjau persis sesuai rencana yang dihitung tangan dari fixture: 59 baru, 3 sudah ada
(induk `BEBAN  KANTOR` yang beda huruf dan berspasi ganda, sub `LISTRIK`, sub `Internet & telepon` di induk lain),
5 dilewati (grup Beban Pemasaran karena induknya dipakai langsung oleh transaksi). Nama yang hanya mirip
(*Beban Karyawan Proyek*) tidak digabung. Setelah diterapkan, 35 baris lama identik sampai `updated_at` (md5 sama),
59 baris baru semuanya bergrup Laba Rugi, klik ulang membuat 0, dan daftar rakitan dari klien diabaikan server.
Selama proses, tombol Buat dan Batal nonaktif; klik kedua tidak mengirim permintaan kedua.

Rantai lintas modul terbukti: sub template **Gaji Karyawan** langsung bisa dipilih di Input Pengeluaran, dan
transaksinya masuk baris Beban Operasional Laba Rugi, bukan panel Perlu Diklasifikasi. Pengguna yang hanya boleh
melihat kategori tidak melihat tombol Pakai Template, mendapat pratinjau `null`, dan POST-nya 403. Di layar ponsel
390 px dialog tidak meluap ke samping.

Pemeriksaan pendukung di luar case: suite PHPUnit penuh dijalankan sekali di akhir sesi (angka di bagian
*Pemeriksaan otomatis*), `npm run types` dan `npm run build` lulus. Skrip `video/capture/bank-accounts.js` dijalankan
penuh di data contoh baru (berhasil setelah perbaikan kecil pemilih tombol "Tutup"), dan
`video/capture/transaction-categories.js` mengambil ulang 25 screenshot panduan.

## Bug / temuan yang diperbaiki

Tidak ada case yang gagal karena cacat aplikasi. Satu penghalusan tampilan dibuat selama QA:

### UX-T1 · Catatan "Sudah ada di grup …" berulang untuk sub yang sudah di grupnya sendiri — DIPERBAIKI · `5073700`

| | |
|---|---|
| **SIFAT** | Rendah — kebisingan tampilan, data benar |
| **MENGGAGALKAN** | Tidak ada case (terlihat saat A03 dibuka; bukti lama tersisa di N02-4) |
| **GEJALA** | Setelah template diterapkan, setiap sub berstatus Sudah ada menampilkan "Sudah ada di grup ‹grupnya sendiri›, tidak diubah." — 62 baris catatan tanpa informasi. |
| **SEBAB** | Dialog menampilkan catatan untuk semua sub berstatus `existing` tanpa membedakan apakah induknya sama dengan induk grup template. |
| **CAKUPAN** | Hanya dialog Pakai Template; aturan pencocokan dan data tidak terpengaruh. |
| **PERBAIKAN** | `CategoryTemplateService::plan()` kini menyertakan `existing_parent_id`; dialog menampilkan catatan hanya bila berbeda dari `category_id` grup. Diverifikasi ulang di A03 (hanya Internet & Telepon yang bercatatan) dan screenshot panduan `fm-template-existing`; `CategoryTemplateServiceTest` diperbarui. |

## Hasil per test case

Percobaan: 🟩 lolos · 🟥 gagal karena bug aplikasi · ⬜ terganggu kendala alat uji (bukan bug).

| ID | Skenario | Lapisan | Percobaan | Catatan | Status |
|---|---|---|---|---|---|
| **A. KONDISI NORMAL** | | | | | |
| N01 | Perusahaan baru langsung berisi template; pratinjau semua Sudah ada | FE+BE | 🟩 | 77 kategori, 0 belum diklasifikasi, 0 label lama; dialog 0/67/0, tombol "Tidak ada kategori baru". | Pass |
| N02 | Pratinjau campuran di perusahaan lama | FE | 🟩 | 59 / 3 / 5 sesuai rencana; alasan penjaga terbaca; nama mirip tidak digabung. | Pass |
| N03 | Buat kategori: hanya yang baru, kategori lama tidak berubah | FE+BE | 🟩 | 1 POST walau diklik dua kali; 35 baris lama identik (md5); 59 baru bergrup L/R; toast sesuai. | Pass |
| N04 | Dialog di layar ponsel | FE | 🟩 | 390×844: tidak ada geser samping (dokumen & isi dialog). | Pass |
| **B. KONDISI TIDAK NORMAL / EDGE CASE** | | | | | |
| A01 | Pengguna hanya-lihat | FE+BE | 🟩 | Tanpa tombol; pratinjau `null`; POST 403; DB tetap 94. | Pass |
| A02 | Induk dipakai langsung: grup dilewati, transaksi lama tetap bisa diedit | FE+BE | 🟩 | Beban Pemasaran tetap datar; edit tersimpan, `category_id` tetap 102. | Pass |
| A03 | Klik ulang setelah diterapkan | FE+BE | 🟩 | 0 / 62 / 5, tombol nonaktif; POST langsung → 0 dibuat. | Pass |
| A04 | Pratinjau gagal dimuat | FE | 🟩 | Galat di dalam dialog + Coba lagi; skeleton terbukti lewat linimasa DOM. | Pass |
| A05 | Daftar dari klien diabaikan | BE | 🟩 | POST rakitan → 0 dibuat; tidak terjangkau UI (form tidak mengirim daftar). | Pass |
| **C. ALUR BERANTAI (LINTAS MODUL)** | | | | | |
| C01 | Gaji Karyawan dari template → Beban Operasional | FE+BE | 🟩 | Rp 5.000.000 di Beban Operasional; Perlu Diklasifikasi hanya MAKAN MINUM. | Pass |

Bukti layar per langkah ada di [`test-cases/template-kategori.md`](../test-cases/template-kategori.md) › *Bukti visual
langkah per langkah* dan di PDF.

## Catatan tambahan (di luar lingkup, tidak diperbaiki)

- **K-T1** — Tombol **Tambah Kategori** dan ikon edit/hapus tetap tampil untuk pengguna hanya-lihat (server menolak 403). Pola yang sama dengan UX-02 Kas & Bank. Tombol Pakai Template yang baru sudah digate.
- **K-T2** — Dialog Edit transaksi yang kategorinya induk datar menampilkan "Pilih kategori" (kategori datar tidak ditawarkan pemilih); `category_id` tetap terkirim dan tersimpan (A02).
- **K-T3** — Pemilih kategori Input Pengeluaran ikut menawarkan sub transfer "↳ Antar Rekening Sendiri" (`/api/transaction-categories?type=debit`). Terdokumentasi di modul.
- **K-T4** — Tabel Kategori Transaksi membungkus badge/teks pada nama induk template yang panjang di 1280 px (kosmetik; tabel masih berkerangka lama).
- **K-T5** — Peringatan konsol "Missing `Description`" berasal dari dialog Catat/Edit Pengeluaran, bukan dialog template.
- **Skrip capture modul lain** — `feedbacks.js` masih memakai pola tombol "Tutup" yang ambigu (sudah diperbaiki di `bank-accounts.js` dan `cash-flow.js`); dua kotak koordinat `bank-accounts.js` (`fm-expense-filled.upload`, `fm-menu.more`) tidak ditemukan. Teks panduan modul Arus Kas, Permintaan Dana, Reimbursement, Kas & Bank, Laba Rugi masih menyebut label kategori lama sesuai screenshot mereka sekarang — perbarui bersamaan saat screenshot modul itu diambil ulang.

## Kendala alat uji

Bukan kegagalan test case.

- Skeleton pratinjau hanya bertahan ±2,3 detik walau jaringan DevTools diset *Slow 3G* — lebih singkat dari jeda antar-panggilan alat, sehingga tangkapan layar selalu jatuh setelah pratinjau termuat. Keberadaannya dibuktikan lewat linimasa DOM (A04).
- Toast hasil penerapan (N03) hilang sebelum tangkapan layar berikutnya; teksnya dibaca langsung dari DOM. Toast yang sama terlihat di screenshot panduan `fm-template-done`.
- Di C01 alat uji mengklik tanggal hari ini yang sudah terpilih sehingga react-day-picker membatalkan pilihannya; tanggal dipilih ulang sebelum menyimpan. Kesalahan langkah alat uji.

## Pemeriksaan otomatis

- Tes terfokus: `CategoryTemplateServiceTest` (17), `TransactionCategoryTemplateTest` (7), `TransactionCategorySeederTest` (5); tes lama yang bergantung pada kategori bawaan (`ProfitLossSafetyNetTest`, `PaymentCapTest`, `TransferAntarAkunTest`, `LoanControllerTest`, `ReceivableControllerTest`, `SystemTransactionCategoryTest`, `TransactionCategoryControllerTest`, `WajibProfilPerusahaanTest`) 82 lulus; `tests/Tenancy/ProvisioningPipelineTest.php` 6 lulus (provisioning sungguhan berisi template).
- Suite penuh `php artisan test --compact` (Unit + Feature + TenancyReal), sekali di akhir sesi: **951 lulus, 2 dilewati, 0 gagal** (4643 asersi, 322 detik).
- `npm run types` lulus; `npm run build` lulus.

## Catatan kejujuran

Kode fitur ini ditulis oleh asisten yang sama yang menjalankan QA, sehingga pengujian bisa mewarisi asumsi yang
sama dengan saat menulis kodenya. Fixture perusahaan lama dibuat lewat skrip, bukan data produksi asli.
Disarankan memeriksa ulang secara mandiri satu hal: di salinan database perusahaan nyata yang sudah lama berjalan,
buka pratinjau Pakai Template dan bandingkan daftar *Dilewati*/*Sudah ada* dengan kategori yang memang ada —
terutama nama yang hanya beda tanda baca (mis. "BBM/Tol/Parkir" vs "BBM, Tol & Parkir"), yang menurut aturan akan
dibuat sebagai kategori baru.

---

Lingkungan uji: database `tplkat_central` + `tplkat_central_tenant_tpllama` / `_tplbaru` (dibuat khusus, di-drop
setelah QA), `php artisan serve --env=tplkat` di `http://127.0.0.1:8139`, Vite dev server pengguna (`[::1]:5173`),
Chrome DevTools MCP 1280×800 DPR 1 (N04: 390×844 DPR 2), kode `main` `c32e3ff` + `5073700`.
