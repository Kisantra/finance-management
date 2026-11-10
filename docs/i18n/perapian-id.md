# Perapian teks Bahasa Indonesia (sebelum kamus EN/ZH)

> **Status:** v1, 10 Nov 2026, disusun T1. Keputusan pengguna: teks tampilan Bahasa Indonesia dirapikan di PR multi bahasa
> **sebelum** kamus en/zh dibuat, karena teks Indonesia adalah kunci terjemahan (K1).
>
> **Basis pindaian:** commit `4ed057d`, working tree bersih. Katalog dibangun otomatis dengan parser TypeScript dan pemindai
> string PHP, lalu dicocokkan **persis** per teks:
> - semua string literal, template literal, dan teks JSX di `resources/js/**` (tanpa `pages/guide/**`, rute hasil generator,
>   dan dua halaman yang tidak bisa dibuka: `template-builder-test.tsx` dialihkan rutenya, `welcome.tsx` tidak dirender rute mana pun);
> - string di `app/**`, `lang/id/*.php`, `routes/**`.
>
> **Penerap:** E1–E4 untuk kode, A2 untuk berkas di areanya, pemilik modul untuk panduan, capture, docs, dan test (§5).
> Istilah baku hasil perapian sudah dimasukkan ke [`glosarium.md`](glosarium.md); entrinya bertanda **[baku baru]**.

## Ringkasan

- **288 pasangan teks** (lama → baku), **415 kemunculan** di kode frontend dan server.
- **Nol** perubahan pada kode/enum, nama rute, kode izin, data tersimpan, dan teks dokumen PDF/Excel.
- **Teks tersimpan yang tersentuh:** hanya teks notifikasi Masukan yang **baru** dibuat (§4.1, keputusan T-7). Data lama tidak berubah.
- **Test yang meng-assert teks lama:** 5 baris di 3 berkas (§5).

| Modul (menurut letak berkas) | Kemunculan |
|---|---|
| Pengajuan Dana | 86 |
| Invoice Berulang | 55 |
| Masukan | 44 |
| Pengaturan | 40 |
| Izin & Peran | 33 |
| Invoice | 30 |
| Arus Kas | 21 |
| Komponen bersama (area A2) | 17 |
| Kas & Bank | 16 |
| Kategori Transaksi | 16 |
| Reimbursement | 12 |
| Piutang | 9 |
| Kerangka (area A2) | 6 |
| Perusahaan (admin) | 6 |
| Ringkasan | 5 |
| Laba Rugi | 4 |
| Utang | 3 |
| Klien | 3 |
| Pengguna | 3 |
| Autentikasi | 3 |
| Layanan | 1 |
| Halaman error | 1 |
| Setup | 1 |
| **Total** | **415** |

## 0. Cara memakai

1. **Satu baris = satu teks persis.** `${…}` menandai bagian ekspresi template literal JavaScript, `{$…}` interpolasi PHP. Ganti teksnya saja; ekspresinya jangan diubah.
2. **Lokasi** berformat `berkas:baris,baris`. Awalan `resources/js/` dan `app/Http/Controllers/` disingkat (`pages/…`, `Controllers/…`). Nomor baris mengikuti commit `4ed057d`; bila sudah bergeser, cari kutipan teksnya.
3. **Area A2** (`layouts/`, `components/`, `lib/`, `pages/services/`, `routes/web.php`, juga `Controllers/Settings/PdfTemplateController.php` yang sedang disentuh A2) ditulis "(area A2)" tanpa nomor baris; cari teks lamanya di berkas itu.
   **A2 sudah membungkus sebagian teks lama sebagai kunci kamus.** Kuncinya ikut diganti ke bentuk baku, termasuk entri `resources/js/locales/*.json` bila sudah dibuat:
   `layouts/header.tsx` & `layouts/sidebar.tsx`: `tk('Permintaan Dana')` → `tk('Pengajuan Dana')`, `tk('Feedback')` → `tk('Masukan')`;
   `layouts/auth-layout.tsx`: `t('Lewat tempo')` → `t('Lewat jatuh tempo')`, `t('Terkirim')` → `t('Terbit')` (status per 10 Nov 2026, saat dokumen ini disusun).
4. **Alasan** ditulis sekali, di baris pertama tiap ID. Kode aturan R1–R7 ada di §1.
5. **Urutan kerja:** terapkan perapian dulu, baru bungkus teksnya dengan `t()` / `__()`. Jangan membuat kunci kamus dari teks lama.
6. **Item bergantung keputusan** (§7) sudah berisi pilihan bawaan. Terapkan bawaan selama pengguna belum memutuskan lain.
7. **Pemilik modul** menyelaraskan berkas di §5 dalam PR yang sama: teks panduan, langkah video, pemilih teks di skrip capture, docs, dan test. Screenshot diambil ulang di PR terpisah.

## 1. Aturan perapian

| Kode | Aturan |
|---|---|
| R1 | Kata Inggris di teks Indonesia → Indonesia penuh. |
| R2 | Kecuali serapan yang lazim di kantor Indonesia **dan** dipakai konsisten (Invoice, Reimbursement, dll., §6). |
| R3 | Varian untuk satu konsep → satu bentuk baku. |
| R4 | Tidak disentuh: kode/enum (`draft`, `sent`, `feedback`, `Active`), nama rute & kode izin (`fund requests`, `edit invoices`), nilai tersimpan (D8), teks dokumen PDF/Excel (K2), teks alat MCP untuk Claude (D12), dan isi panduan `pages/guide/**` (K3). Kalimat panduan yang **mengutip label UI** tetap wajib diselaraskan pemilik modul (§5). |
| R5 | Teks tersimpan: target nol perubahan; yang tersentuh dipisahkan di §4. |
| R6 | Ejaan KBBI: *antrean* (bukan antrian), *subkategori* (bukan sub kategori / sub-kategori). |
| R7 | Kapitalisasi mengikuti pola sumber per teks (judul vs kalimat). Yang diseragamkan hanya teks yang sama dengan kapital berbeda. |

## 2. Pilihan baku yang paling berdampak

Muncul di menu, judul halaman, panduan, atau test.

| # | Konsep | Sebelum | Baku | Tampil di | Ikut terdampak (ringkas) | ID |
|---|---|---|---|---|---|---|
| 1 | Nama modul `fund requests` | Permintaan Dana / pengajuan dana | **Pengajuan Dana** | Menu, breadcrumb, judul halaman & dialog, toast, 15 pesan server | Panduan fund-requests + 6 modul lain; capture `fund-requests.js`, `fund-requests-admin.js`; judul `docs/module/fund-requests.md:1`, `README.md:22`; `CategoryTemplateServiceTest.php` | PD01 |
| 2 | Nama modul `feedbacks` | Feedback / Feedback & Saran / masukan | **Masukan** | Menu, breadcrumb, judul halaman, tombol melayang di setiap halaman, pesan server | Panduan feedbacks, notifications, settings, users-permissions; hampir semua skrip capture (tombol melayang "Feedback"); `feedbacks.md` | MS01 (T-2) |
| 3 | Aksi & status invoice `sent` | Kirim invoice / Terbitkan; status Terkirim | **Terbitkan**; status **Terbit** | Drawer & editor invoice, pil status (Invoice, Ringkasan, Kas & Bank), Penomoran invoice, pesan server | Panduan invoices, recurring-invoices, dashboard, notifications, clients, settings; capture `invoices.js`, `recurring-invoices.js`, `settings.js`; `InvoiceControllerTest.php:484` | INV01–INV04 (T-3) |
| 4 | Mengubah data | Edit … / Ubah … | **Ubah …** | ±45 tombol, judul dialog, aria-label, dan pesan server di 15 modul | Panduan 15 modul; 11 skrip capture | U01–U03 (T-4) |
| 5 | Invoice Berulang | Invoice Recurring, Generate, Publish/Published, Templates, Revenue/Profit | **Invoice Berulang, Buat Draft, Jadikan Invoice / Dijadikan invoice, Template, Pendapatan/Laba** | Judul halaman, tab, dialog, analitik, pesan server | Panduan & steps recurring-invoices (paling banyak), capture `recurring-invoices.js` | RI01–RI07 (T-5) |
| 6 | Status menunggu persetujuan | Pending Review / Menunggu review / Menunggu | **Menunggu persetujuan** | Pil status, kartu, filter di Pengajuan Dana, Reimbursement, Piutang | Panduan ketiga modul; capture `fund-requests.js`, `reimbursements.js`, `receivables-review.js` | PD02, PD04, RB01, PT01 |
| 7 | Label berbahasa Inggris | Approved/Rejected/Disbursed, Low…Urgent (Pengajuan Dana); Open…Closed, Low…Critical, Bug Report… (Masukan, server) | **Disetujui/Ditolak/Dicairkan, Rendah/Sedang/Tinggi/Mendesak; Terbuka/Diproses/Selesai/Ditutup, Kritis, Bug/Fitur/Saran** | Pil, filter, notifikasi | Panduan fund-requests & feedbacks | PD02, PD03, MS02 |
| 8 | Izin | Permission | **Izin** | Halaman Izin & Peran: judul, kartu, dialog, toast | Panduan & capture users-permissions | IZ01 |
| 9 | Hierarki kategori | Parent / Kategori Utama / Sub Kategori / sub-kategori | **Kategori induk / Subkategori** | Form & tabel kategori, 4 pesan validasi server + 1 alasan Pakai Template | Panduan transaction-categories; `PendanaanTest.php:131`, `CategoryTemplateServiceTest.php:311` | KT01 |
| 10 | Arah uang di luar kotak Jurnal | Total Debit, (debit)/(credit), transaksi debit/kredit | **Total Keluar, Uang masuk / Uang keluar** | Dialog Transfer, Detail Transfer, tab Transfer, filter Kas & Bank, Ringkasan | Panduan bank-accounts, cash-flow | KB02 |
| 11 | Menghapus semua filter | Reset / Reset filter / Hapus filter | **Hapus filter** | 10 halaman daftar | — | U07 |
| 12 | Lewat batas tanggal | Lewat tempo / lewat jatuh tempo | **Lewat jatuh tempo** | Pil Ringkasan, kartu Piutang, layout tamu | Panduan dashboard & settings; `receivables.md` | U09 |

## 3. Tabel utama (per modul)

"Lintas modul" berisi perubahan yang muncul di banyak modul (Edit, Default, Preview, Export, Reset, dst.).

### Lintas modul

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| U01 | `Edit` | `Ubah` | `pages/feedbacks/index.tsx:633`; `pages/fund-requests/index.tsx:733`; `pages/invoices/index.tsx:584`; `pages/loans/components/loan-drawer.tsx:142`; `pages/receivables/components/receivable-drawer.tsx:168`; `pages/recurring-invoices/index.tsx:1445`; `pages/settings/pdf-templates/edit.tsx:1872`; `pages/settings/pdf-templates/index.tsx:212` | Kata Inggris; sumber juga memakai "Ubah" (Ubah Status, Ubah Nama) untuk aksi yang sama. Kode izin `edit …` TIDAK diubah. |
| U02 | `Edit Kas` | `Ubah Kas` | `pages/bank-accounts/components/account-form-dialog.tsx:141`; `pages/bank-accounts/index.tsx:330` | Sama dengan U01 (judul dialog, tombol, aria-label). |
|  | `Edit Rekening Bank` | `Ubah Rekening Bank` | `pages/bank-accounts/components/account-form-dialog.tsx:141` |  |
|  | `Edit Rekening` | `Ubah Rekening` | `pages/bank-accounts/index.tsx:330` |  |
|  | `Edit Pemasukan` | `Ubah Pemasukan` | `pages/cash-flow/components/transaction-detail-dialog.tsx:309` |  |
|  | `Edit Pengeluaran` | `Ubah Pengeluaran` | `pages/cash-flow/components/transaction-detail-dialog.tsx:309` |  |
|  | `Edit Transfer` | `Ubah Transfer` | `pages/cash-flow/components/transaction-detail-dialog.tsx:645` |  |
|  | `Edit Klien` | `Ubah Klien` | `pages/clients/index.tsx:605` |  |
|  | `Edit Tanggapan` | `Ubah Tanggapan` | `pages/feedbacks/index.tsx:645` |  |
|  | `Edit invoice` | `Ubah invoice` | `pages/invoices/components/invoice-drawer.tsx:255` |  |
|  | `Edit Invoice` | `Ubah Invoice` | `pages/invoices/create.tsx:410,428` |  |
|  | `Edit pembayaran ${…}` | `Ubah pembayaran ${…}` | `pages/invoices/components/invoice-drawer.tsx:520` |  |
|  | `Edit pembayaran` | `Ubah pembayaran` | `pages/invoices/components/invoice-drawer.tsx:760` |  |
|  | `Edit utang` | `Ubah utang` | `pages/loans/components/loan-form-sheet.tsx:124` |  |
|  | `Edit piutang` | `Ubah piutang` | `pages/receivables/components/receivable-form-sheet.tsx:126` |  |
|  | `Edit Peran` | `Ubah Peran` | `pages/permissions/index.tsx:244` |  |
|  | `Edit peran` | `Ubah peran` | `pages/permissions/index.tsx:507` |  |
|  | `Edit Template — ${…}` | `Ubah Template — ${…}` | `pages/recurring-invoices/edit-template.tsx:62` |  |
|  | `Edit pengajuan` | `Ubah pengajuan` | `pages/reimbursements/components/reimbursement-drawer.tsx:219`; `pages/reimbursements/components/reimbursement-form-sheet.tsx:115` |  |
|  | `Edit Layanan` | `Ubah Layanan` | `pages/services/index.tsx` (area A2) |  |
|  | `Edit Kategori` | `Ubah Kategori` | `pages/transaction-categories/index.tsx:510` |  |
|  | `Edit Pengguna` | `Ubah Pengguna` | `pages/users/index.tsx:239` |  |
|  | `Edit pengguna` | `Ubah pengguna` | `pages/users/index.tsx:840` |  |
| U03 | `Lengkapi datanya lewat Edit, lalu jadwalnya muncul sendiri.` | `Lengkapi datanya lewat Ubah, lalu jadwalnya muncul sendiri.` | `components/jadwal-angsuran.tsx` (area A2) | "mengedit/diedit" → "mengubah/diubah" (U01). |
|  | `Pembayaran ini terhubung dengan invoice. Untuk mengedit, buka halaman Invoice.` | `Pembayaran ini terhubung dengan invoice. Untuk mengubahnya, buka halaman Invoice.` | `pages/cash-flow/components/transaction-detail-dialog.tsx:553` |  |
|  | `Utang yang sudah lunas tidak dapat diedit` | `Utang yang sudah lunas tidak dapat diubah` | `Controllers/LoanController.php:180` |  |
|  | `Piutang ini tidak dapat diedit` | `Piutang ini tidak dapat diubah` | `Controllers/ReceivableController.php:250` |  |
|  | `Reimbursement tidak dapat diedit` | `Reimbursement tidak dapat diubah` | `Controllers/ReimbursementController.php:244,257` |  |
| U04 | `Default` | `Bawaan` | `pages/settings/pdf-templates/index.tsx:186` | Kata Inggris; sumber sudah memakai "bawaan" (Termin bawaan, Bawaan di pemilih font). |
|  | `Jadikan Default` | `Jadikan Bawaan` | `pages/settings/pdf-templates/index.tsx:228` |  |
|  | `Sudah Default` | `Sudah Bawaan` | `pages/settings/pdf-templates/index.tsx:234` |  |
|  | `Kembalikan default` | `Kembalikan bawaan` | `pages/settings/invoice-numbering.tsx:314` |  |
|  | `Rekap Excel · Default` | `Rekap Excel · Bawaan` | `pages/invoices/index.tsx:242` |  |
|  | `"${…}" dijadikan template default.` | `"${…}" dijadikan template bawaan.` | `pages/settings/pdf-templates/index.tsx:130` |  |
|  | `Gagal mengubah template default.` | `Gagal mengubah template bawaan.` | `pages/settings/pdf-templates/index.tsx:131` |  |
|  | `Template default berhasil diubah.` | `Template bawaan berhasil diubah.` | `Controllers/Settings/PdfTemplateController.php` (area A2) |  |
|  | `Peran default '{$role->name}' tidak dapat dihapus.` | `Peran bawaan '{$role->name}' tidak dapat dihapus.` | `Controllers/Admin/RoleController.php:76` |  |
| U05 | `Preview` | `Pratinjau` | `components/shared/file-preview-dialog.tsx` (area A2); `pages/settings/pdf-templates/edit.tsx:1872,2690` | Kata Inggris; "Pratinjau" sudah dipakai 22 kali di aplikasi. |
|  | `PDF Preview` | `Pratinjau PDF` | `components/shared/file-preview-dialog.tsx` (area A2) |  |
|  | `Preview tidak tersedia untuk jenis file ini.` | `Pratinjau tidak tersedia untuk jenis file ini.` | `components/shared/file-preview-dialog.tsx` (area A2) |  |
| U06 | `Export PDF` | `Ekspor PDF` | `pages/bank-accounts/index.tsx:335`; `pages/cash-flow/expenses.tsx:198`; `pages/cash-flow/income.tsx:213`; `pages/cash-flow/transfers.tsx:179` | Kata Inggris; menu invoice sudah "Ekspor". |
|  | `Export Excel` | `Ekspor Excel` | `pages/cash-flow/all.tsx:198` |  |
| U07 | `Reset` | `Hapus filter` | `pages/bank-accounts/components/payments-tab.tsx:191`; `pages/bank-accounts/components/transactions-tab.tsx:259`; `pages/cash-flow/all.tsx:304`; `pages/cash-flow/expenses.tsx:279`; `pages/cash-flow/income.tsx:301`; `pages/cash-flow/transfers.tsx:241`; `pages/feedbacks/index.tsx:858`; `pages/fund-requests/index.tsx:408`; `pages/users/index.tsx:695` | Varian untuk satu aksi (menghapus semua filter): "Reset", "Reset filter", "Hapus filter". Dipilih "Hapus filter" (Indonesia, sudah dipakai 5 modul). |
|  | `Reset filter` | `Hapus filter` | `pages/clients/index.tsx:482` |  |
| U08 | `Reset ke semua waktu` | `Kembali ke semua waktu` | `pages/bank-accounts/components/account-charts.tsx:160` | Kata Inggris (bukan hapus filter, jadi tidak ikut U07). |
|  | `Reset lebar kolom ke default` | `Kembalikan lebar kolom bawaan` | `pages/recurring-invoices/create-template.tsx:305`; `pages/recurring-invoices/index.tsx:254` |  |
|  | `Reset Ukuran Kolom` | `Kembalikan Ukuran Kolom` | `pages/recurring-invoices/create-template.tsx:307`; `pages/recurring-invoices/index.tsx:256` |  |
|  | `Reset ke ukuran asli` | `Kembalikan ke ukuran asli` | `pages/settings/pdf-templates/edit.tsx:2459` |  |
| U09 | `Lewat tempo` | `Lewat jatuh tempo` | `layouts/auth-layout.tsx` (area A2); `pages/dashboard.tsx:139`; `pages/receivables/index.tsx:196` | Varian "lewat tempo" vs "lewat jatuh tempo"; dipilih bentuk lengkap yang sama dengan kolom "Jatuh tempo". Lihat juga INV02 untuk "terkirim". |
|  | `Invoice yang terkirim dan belum lunas akan muncul di sini, yang lewat tempo paling atas.` | `Invoice yang sudah terbit dan belum lunas akan muncul di sini, yang lewat jatuh tempo paling atas.` | `pages/dashboard.tsx:480` |  |
|  | `tidak ada yang lewat tempo` | `tidak ada yang lewat jatuh tempo` | `pages/receivables/index.tsx:199` |  |
|  | `lalu bertanyalah, misalnya “Berapa invoice yang lewat tempo bulan ini?”` | `lalu bertanyalah, misalnya “Berapa invoice yang lewat jatuh tempo bulan ini?”` | `pages/settings/claude.tsx:102` |  |
| U10 | `Masuk ke Dasbor` | `Masuk` | `pages/auth/login.tsx:75` | Menu sudah bernama "Ringkasan"; "Dasbor/Dashboard" sisa nama lama. |
|  | `Ke Dashboard` | `Ke Ringkasan` | `app/Services/ErrorReportService.php:224` |  |
| U11 | `Screenshot atau dokumen pendukung` | `Tangkapan layar atau dokumen pendukung` | `components/floating-feedback-button.tsx` (area A2) | Kata Inggris; padanan Indonesia sudah lazim (Seret & lepas, Unggah, Tempel). |
|  | `Sertakan screenshot atau dokumen pendukung` | `Sertakan tangkapan layar atau dokumen pendukung` | `pages/feedbacks/index.tsx:330` |  |
|  | `atau drag & drop` | `atau seret & lepas` | `components/shared/file-upload.tsx` (area A2) |  |
|  | `Ctrl+V untuk paste gambar` | `Ctrl+V untuk menempel gambar` | `components/shared/file-upload.tsx` (area A2) |  |
|  | `Scroll untuk zoom · Klik untuk toggle` | `Gulir untuk memperbesar · Klik untuk beralih` | `components/shared/file-preview-dialog.tsx` (area A2) |  |
|  | `Tidak ada bukti pembayaran diupload.` | `Tidak ada bukti pembayaran yang diunggah.` | `pages/fund-requests/index.tsx:700` |  |
|  | `Zoom kertas` | `Perbesaran kertas` | `pages/invoices/components/invoice-drawer.tsx:419`; `pages/invoices/components/print-invoice-dialog.tsx:181`; `pages/invoices/create.tsx:976` |  |
| U12 | `Breakdown Kategori` | `Rincian per Kategori` | `pages/bank-accounts/components/account-charts.tsx:229` | Kata Inggris; "Rincian per kategori" sudah dipakai di Ringkasan. |
|  | `Breakdown Status` | `Rincian Status` | `pages/recurring-invoices/index.tsx:1596` |  |
| U13 | `Est. PPh 0.5%` | `Est. PPh final 0,5%` | `pages/recurring-invoices/create-template.tsx:505` | Tiga varian label yang sama (Ringkasan memakai "Est. PPh final 0,5%"); "0.5%" juga memakai titik desimal Inggris. |
|  | `Est. PPh` | `Est. PPh final 0,5%` | `pages/invoices/create.tsx:699` |  |

### Invoice

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| INV01 | `Kirim invoice` | `Terbitkan invoice` | `pages/invoices/components/invoice-drawer.tsx:239,607,609` | Satu aksi, dua kata kerja ("Kirim invoice" di drawer, "Terbitkan"/"Simpan & terbitkan" di editor). Aksinya memberi nomor resmi tanpa mengirim email, jadi dipilih "Terbitkan". |
| INV02 | `Terkirim` | `Terbit` | `layouts/auth-layout.tsx` (area A2); `pages/bank-accounts/components/payments-tab.tsx:58,138`; `pages/dashboard.tsx:142`; `pages/invoices/components/ob.tsx:16,30`; `pages/invoices/index.tsx:95,103` | Label status `sent` mengikuti kata kerja INV01. Kode `sent` tidak berubah. **Tidak** termasuk `TemplateTokens.php` (nilai token PDF, K2). |
| INV03 | `Draft · belum dikirim` | `Draft · belum terbit` | `pages/recurring-invoices/index.tsx:1426` | Kalimat yang memakai "kirim/terkirim" untuk aksi INV01. |
|  | `Format penomoran disimpan. Berlaku untuk invoice yang dikirim setelah ini.` | `Format penomoran disimpan. Berlaku untuk invoice yang diterbitkan setelah ini.` | `pages/settings/invoice-numbering.tsx:153` |  |
|  | `Atur bentuk nomor yang diberikan saat invoice dikirim. Nomor yang sudah terbit tidak ikut berubah.` | `Atur bentuk nomor yang diberikan saat invoice diterbitkan. Nomor yang sudah terbit tidak ikut berubah.` | `pages/settings/invoice-numbering.tsx:166` |  |
|  | `Invoice lama belum punya urutan nomor. Tanpa urutan, invoice berikutnya bisa mengulang nomor yang sudah terkirim ke klien. Dengan pola di bawah:` | `Invoice lama belum punya urutan nomor. Tanpa urutan, invoice berikutnya bisa mengulang nomor yang sudah terbit. Dengan pola di bawah:` | `pages/settings/invoice-numbering.tsx:176` |  |
|  | `Berlaku untuk invoice yang dikirim setelah disimpan. Nomor tetap bisa diubah manual di dialog Kirim.` | `Berlaku untuk invoice yang diterbitkan setelah disimpan. Nomor tetap bisa diubah manual di dialog Terbitkan.` | `pages/settings/invoice-numbering.tsx:300` |  |
|  | `Format penomoran invoice disimpan. Berlaku untuk invoice yang dikirim setelah ini.` | `Format penomoran invoice disimpan. Berlaku untuk invoice yang diterbitkan setelah ini.` | `Controllers/Settings/InvoiceSettingsController.php:77` |  |
|  | `Tinjau nomor invoice lama dulu, supaya invoice berikutnya tidak mengulang nomor yang sudah terkirim.` | `Tinjau nomor invoice lama dulu, supaya invoice berikutnya tidak mengulang nomor yang sudah terbit.` | `app/Http/Middleware/EnsureCompanyProfileComplete.php:50` |  |
|  | `Hanya invoice draft yang dapat dikirim.` | `Hanya invoice draft yang dapat diterbitkan.` | `Controllers/InvoiceController.php:801` |  |
|  | `Invoice draft dibuat. Kirim invoice untuk mendapat nomor resmi.` | `Invoice draft dibuat. Terbitkan invoice untuk mendapat nomor resmi.` | `Controllers/RecurringInvoiceController.php:427` |  |
| INV04 | `Hanya invoice yang sudah terkirim yang bisa di-rollback.` | `Hanya invoice yang sudah terbit yang bisa dikembalikan ke draft.` | `Controllers/InvoiceController.php:815` | Kata Inggris "rollback"; tombolnya sudah bernama "Kembalikan ke draft". |
|  | `Hanya invoice dengan nomor urut terakhir di periodenya yang bisa di-rollback.` | `Hanya invoice dengan nomor urut terakhir di periodenya yang bisa dikembalikan ke draft.` | `Controllers/InvoiceController.php:819` |  |
|  | `Nomor berikutnya sesuai format di Pengaturan › Penomoran invoice. Boleh diubah selama belum dipakai. Bisa dibatalkan (rollback) selama ini nomor urut terakhir di periodenya.` | `Nomor berikutnya sesuai format di Pengaturan › Penomoran invoice. Boleh diubah selama belum dipakai. Bisa dikembalikan ke draft selama ini nomor urut terakhir di periodenya.` | `pages/invoices/components/invoice-number-dialog.tsx:95` |  |

### Invoice Berulang

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| RI01 | `Invoice Recurring` | `Invoice Berulang` | `pages/recurring-invoices/index.tsx:1172` | Judul halaman "Invoice Recurring" berbeda dari menu "Invoice Berulang"; kata Inggris. |
|  | `Buat Template Recurring` | `Buat Template` | `pages/recurring-invoices/create-template.tsx:608,619` |  |
|  | `Edit Template Recurring` | `Ubah Template` | `pages/recurring-invoices/edit-template.tsx:73` |  |
|  | `Buat Invoice Recurring` | `Buat Invoice Berulang` | `pages/recurring-invoices/index.tsx:646` |  |
|  | `Edit Invoice Recurring` | `Ubah Invoice Berulang` | `pages/recurring-invoices/index.tsx:646` |  |
|  | `Buat template recurring untuk generate invoice otomatis` | `Buat template agar draft invoice bisa dibuat otomatis` | `pages/recurring-invoices/index.tsx:1245` |  |
| RI02 | `Generate Otomatis` | `Buat Draft Otomatis` | `pages/recurring-invoices/index.tsx:1185` | Kata Inggris "generate"; yang dihasilkan adalah draft. |
|  | `Generate Invoice Otomatis` | `Buat Draft Invoice Otomatis` | `pages/recurring-invoices/index.tsx:781` |  |
|  | `Generate Sekarang` | `Buat Sekarang` | `pages/recurring-invoices/index.tsx:811` |  |
|  | `Generate` | `Buat Draft` | `pages/recurring-invoices/index.tsx:1375` |  |
|  | `Gagal generate.` | `Gagal membuat draft.` | `pages/recurring-invoices/index.tsx:764` |  |
|  | `Kelola template dan generate invoice otomatis berulang` | `Kelola template dan buat draft invoice berulang` | `pages/recurring-invoices/index.tsx:1173` |  |
|  | `Generate invoice dari template atau buat manual` | `Buat draft dari template atau buat manual` | `pages/recurring-invoices/index.tsx:1372` |  |
|  | `Item akan digunakan setiap kali invoice di-generate` | `Item dipakai setiap kali draft invoice dibuat` | `pages/recurring-invoices/create-template.tsx:295` |  |
|  | `Item per generate` | `Item per draft` | `pages/recurring-invoices/create-template.tsx:296` |  |
|  | `Template invoice yang akan di-generate secara periodik` | `Template invoice yang dibuat ulang secara berkala` | `pages/recurring-invoices/create-template.tsx:622` |  |
| RI03 | `Publish` | `Jadikan Invoice` | `pages/recurring-invoices/index.tsx:902,951,962,1442,1470` | Kata Inggris "publish". Bukan "Terbitkan": hasilnya invoice **Draft tanpa nomor** di menu Invoice, sedangkan "Terbitkan" (INV01) memberi nomor resmi. |
|  | `Publish Invoice` | `Jadikan Invoice` | `pages/recurring-invoices/index.tsx:872` |  |
|  | `Published` | `Dijadikan invoice` | `pages/recurring-invoices/index.tsx:1351,1435,1599` |  |
|  | `Gagal publish.` | `Gagal menjadikan invoice.` | `pages/recurring-invoices/index.tsx:855` |  |
|  | `Gagal bulk publish.` | `Gagal menjadikan invoice secara massal.` | `pages/recurring-invoices/index.tsx:934` |  |
|  | `Invoice akan dipublish dan menjadi invoice permanen. Tidak bisa diedit setelah dipublish.` | `Draft ini akan dijadikan invoice di menu Invoice dan tidak bisa diubah lagi di sini.` | `pages/recurring-invoices/index.tsx:882` |  |
|  | `Template "${…}" memiliki ${…} invoice terpublish. Template akan diarsipkan, bukan dihapus.` | `Template "${…}" sudah menghasilkan ${…} invoice. Template akan diarsipkan, bukan dihapus.` | `pages/recurring-invoices/index.tsx:1636` |  |
|  | `Template diarsipkan (memiliki invoice terpublish).` | `Template diarsipkan karena sudah menghasilkan invoice.` | `Controllers/RecurringInvoiceController.php:227` |  |
|  | `Invoice yang sudah dipublish tidak dapat diubah.` | `Invoice yang sudah dijadikan invoice tidak dapat diubah.` | `Controllers/RecurringInvoiceController.php:364` |  |
|  | `Invoice yang sudah dipublish tidak dapat dihapus.` | `Invoice yang sudah dijadikan invoice tidak dapat dihapus.` | `Controllers/RecurringInvoiceController.php:397` |  |
|  | `Invoice sudah dipublish.` | `Draft ini sudah dijadikan invoice.` | `Controllers/RecurringInvoiceController.php:408` |  |
|  | `{$published} invoice berhasil dipublish.` | `{$published} draft berhasil dijadikan invoice.` | `Controllers/RecurringInvoiceController.php:477` |  |
| RI04 | `Templates` | `Template` | `pages/recurring-invoices/index.tsx:1199` | Bentuk jamak Inggris. |
| RI05 | `Total Revenue` | `Total Pendapatan` | `pages/recurring-invoices/index.tsx:1361` | Kata Inggris di tab Analitik; "Sukses" = rasio draft yang sudah dijadikan invoice (RI03). |
|  | `Total Profit` | `Total Laba` | `pages/recurring-invoices/index.tsx:1362` |  |
|  | `Margin Profit` | `Margin Laba` | `pages/recurring-invoices/index.tsx:1363` |  |
|  | `Profit Pending` | `Laba Belum Diterima` | `pages/recurring-invoices/index.tsx:1364` |  |
|  | `Revenue ${…}` | `Pendapatan ${…}` | `pages/recurring-invoices/index.tsx:1508,1509` |  |
|  | `Revenue` | `Pendapatan` | `pages/recurring-invoices/index.tsx:1523,1528,1558` |  |
|  | `Sukses` | `Jadi invoice` | `pages/recurring-invoices/index.tsx:1560` |  |
| RI06 | `Tanggal Terbit` | `Tanggal Invoice` | `pages/recurring-invoices/index.tsx:676,795` | Yang diisi adalah `issue_date` invoice yang lahir sebagai Draft; editor invoice menamainya "Tanggal invoice". "Terbit" kini khusus untuk INV01. |
|  | `Tanggal Terbit *` | `Tanggal Invoice *` | `pages/recurring-invoices/index.tsx:886,956` |  |
| RI07 | `Contoh: Monthly Retainer` | `Contoh: Retainer Bulanan` | `pages/recurring-invoices/create-template.tsx:227` | Frasa contoh berbahasa Inggris ("Retainer" dipertahankan: istilah kontrak jasa yang lazim). |

### Pengajuan Dana

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| PD01 | `Permintaan Dana` | `Pengajuan Dana` | `layouts/header.tsx` (area A2); `layouts/sidebar.tsx` (area A2); `pages/fund-requests/index.tsx:320,324` | Satu modul, dua nama. Dipilih **Pengajuan Dana**: tiap catatan di modul ini dan di Reimbursement sudah disebut "pengajuan" (Semua Pengajuan, Pengajuan Saya, Total Pengajuan); sudah dipakai di halaman izin OAuth, pesan Profil perusahaan, dan alat MCP `daftar-pengajuan-dana`; "permintaan" juga dipakai halaman error untuk *HTTP request* ("Permintaan tidak valid"), jadi nama modul ini bertabrakan dengannya. Kode/rute/izin `fund requests` tidak berubah. |
|  | `Buat Permintaan Dana` | `Buat Pengajuan Dana` | `pages/fund-requests/create.tsx:89,97`; `pages/fund-requests/index.tsx:963` |  |
|  | `Edit Permintaan Dana` | `Ubah Pengajuan Dana` | `pages/fund-requests/edit.tsx:104,112`; `pages/fund-requests/index.tsx:963` |  |
|  | `Setujui Permintaan Dana` | `Setujui Pengajuan Dana` | `pages/fund-requests/index.tsx:746` |  |
|  | `Tolak Permintaan Dana` | `Tolak Pengajuan Dana` | `pages/fund-requests/index.tsx:746` |  |
|  | `Buat Permintaan` | `Buat Pengajuan` | `pages/fund-requests/index.tsx:331,424` |  |
|  | `Informasi Permintaan` | `Informasi Pengajuan` | `pages/fund-requests/create.tsx:103`; `pages/fund-requests/edit.tsx:118` |  |
|  | `Nomor Permintaan *` | `Nomor Pengajuan *` | `pages/fund-requests/create.tsx:107`; `pages/fund-requests/index.tsx:980` |  |
|  | `No. Permintaan` | `No. Pengajuan` | `pages/fund-requests/index.tsx:437,610` |  |
|  | `Gagal memuat data permintaan` | `Gagal memuat data pengajuan` | `pages/fund-requests/index.tsx:297` |  |
|  | `Belum ada permintaan dana` | `Belum ada pengajuan dana` | `pages/fund-requests/index.tsx:419` |  |
|  | `Buat permintaan dana baru untuk memulai.` | `Buat pengajuan dana baru untuk memulai.` | `pages/fund-requests/index.tsx:420` |  |
|  | `Ajukan permintaan dana?` | `Ajukan pengajuan dana ini?` | `pages/fund-requests/index.tsx:841` |  |
|  | `Hapus permintaan dana ini?` | `Hapus pengajuan dana ini?` | `pages/fund-requests/index.tsx:852` |  |
|  | `Permintaan dana berhasil dihapus` | `Pengajuan dana berhasil dihapus` | `Controllers/FundRequestController.php:426`; `pages/fund-requests/index.tsx:205` |  |
|  | `Permintaan dana berhasil diajukan` | `Pengajuan dana berhasil diajukan` | `pages/fund-requests/index.tsx:225` |  |
|  | `Permintaan dana disetujui` | `Pengajuan dana disetujui` | `pages/fund-requests/index.tsx:244` |  |
|  | `Permintaan dana ditolak` | `Pengajuan dana ditolak` | `Controllers/FundRequestController.php:462`; `pages/fund-requests/index.tsx:244` |  |
|  | `Permintaan dana berhasil diperbarui` | `Pengajuan dana berhasil diperbarui` | `Controllers/FundRequestController.php:403`; `pages/fund-requests/index.tsx:935` |  |
|  | `Permintaan dana berhasil dibuat` | `Pengajuan dana berhasil dibuat` | `pages/fund-requests/index.tsx:945` |  |
|  | `permintaan` | `pengajuan` | `pages/fund-requests/index.tsx:339` |  |
|  | `item permintaan dana` | `item pengajuan dana` | `pages/transaction-categories/index.tsx:545` |  |
|  | `{$category->fund_request_items_count} item permintaan dana` | `{$category->fund_request_items_count} item pengajuan dana` | `app/Services/CategoryTemplateService.php:391` |  |
|  | `Permintaan dana berhasil diajukan untuk persetujuan` | `Pengajuan dana berhasil diajukan untuk persetujuan` | `Controllers/FundRequestController.php:276,402,441` |  |
|  | `Permintaan dana berhasil disimpan sebagai draft` | `Pengajuan dana berhasil disimpan sebagai draft` | `Controllers/FundRequestController.php:277` |  |
|  | `Permintaan dana tidak dapat diedit` | `Pengajuan dana tidak dapat diubah` | `Controllers/FundRequestController.php:290,329` |  |
|  | `Permintaan dana tidak dapat dihapus` | `Pengajuan dana tidak dapat dihapus` | `Controllers/FundRequestController.php:421` |  |
|  | `Permintaan dana tidak dapat diajukan (pastikan ada item dengan jumlah valid)` | `Pengajuan dana tidak dapat diajukan (pastikan ada item dengan jumlah valid)` | `Controllers/FundRequestController.php:436` |  |
|  | `Permintaan dana tidak dapat ditinjau` | `Pengajuan dana tidak dapat ditinjau` | `Controllers/FundRequestController.php:449` |  |
|  | `Permintaan dana berhasil disetujui` | `Pengajuan dana berhasil disetujui` | `Controllers/FundRequestController.php:457` |  |
|  | `Permintaan dana tidak dapat dicairkan` | `Pengajuan dana tidak dapat dicairkan` | `Controllers/FundRequestController.php:470` |  |
|  | `Header dari pengajuan dana.` | `Data utama pengajuan dana.` | `pages/fund-requests/create.tsx:103`; `pages/fund-requests/edit.tsx:118` |  |
| PD02 | `Pending Review` | `Menunggu persetujuan` | `pages/fund-requests/index.tsx:88,1208` | Label status berbahasa Inggris; disamakan dengan Reimbursement & Piutang. Kode status tidak berubah. `FundRequestExportService` (PDF/Excel) **tidak** disentuh (K2). |
|  | `Approved` | `Disetujui` | `pages/fund-requests/index.tsx:89,341,1209` |  |
|  | `Rejected` | `Ditolak` | `pages/fund-requests/index.tsx:90,1210` |  |
|  | `Disbursed` | `Dicairkan` | `pages/fund-requests/index.tsx:91,1211` |  |
| PD03 | `Low` | `Rendah` | `pages/fund-requests/create.tsx:25`; `pages/fund-requests/edit.tsx:37`; `pages/fund-requests/index.tsx:95,873,1215` | Label prioritas berbahasa Inggris; Masukan sudah memakai Rendah/Sedang/Tinggi. |
|  | `Medium` | `Sedang` | `pages/fund-requests/create.tsx:26`; `pages/fund-requests/edit.tsx:38`; `pages/fund-requests/index.tsx:96,874,1216` |  |
|  | `High` | `Tinggi` | `pages/fund-requests/create.tsx:27`; `pages/fund-requests/edit.tsx:39`; `pages/fund-requests/index.tsx:97,875,1217` |  |
|  | `Urgent` | `Mendesak` | `pages/fund-requests/create.tsx:28`; `pages/fund-requests/edit.tsx:40`; `pages/fund-requests/index.tsx:98,876,1218` |  |
| PD04 | `Pending` | `Menunggu persetujuan` | `pages/fund-requests/index.tsx:340` | Kartu ringkasan berbahasa Inggris (kartu "Approved" ikut PD02). Sub kartu "permintaan" ikut PD01. |
|  | `menunggu review` | `perlu ditinjau` | `pages/fund-requests/index.tsx:340` |  |
| PD05 | `Review` | `Tinjau` | `pages/fund-requests/index.tsx:530` | Kata Inggris "review"; "Catatan peninjau" sudah dipakai Piutang; "antrian" → "antrean" (KBBI, sudah dipakai Reimbursement). |
|  | `Direview oleh` | `Ditinjau oleh` | `pages/fund-requests/index.tsx:617` |  |
|  | `Catatan Review` | `Catatan peninjau` | `pages/fund-requests/index.tsx:621,759` |  |
|  | `Setelah diajukan, permintaan akan masuk ke antrian review dan tidak dapat diedit.` | `Setelah diajukan, pengajuan masuk ke antrean persetujuan dan tidak dapat diubah.` | `pages/fund-requests/index.tsx:842` |  |
| PD06 | `transaksi pengeluaran dibuat di rekening ini — lihat di menu Pengeluaran.` | `transaksi pengeluaran dibuat di rekening ini — lihat di Arus Kas › Pemasukan & Pengeluaran.` | `pages/fund-requests/index.tsx:689` | Menyebut menu "Pengeluaran" yang tidak ada; menunya "Pemasukan & Pengeluaran". |

### Reimbursement

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| RB01 | `Menunggu review` | `Menunggu persetujuan` | `app/Models/Reimbursement.php:372,438`; `pages/reimbursements/components/rb.tsx:15,39`; `pages/reimbursements/index.tsx:154` | Kata Inggris "review/finance"; status menunggu disamakan di tiga alur persetujuan (Reimbursement, Pengajuan Dana, Piutang). Ikut `Reimbursement::statuses()` & `status_label` (juga dibaca alat MCP). |
|  | `Menunggu review finance` | `Menunggu persetujuan tim keuangan` | `pages/reimbursements/components/reimbursement-drawer.tsx:445` |  |
|  | `"${…}" sebesar ${…} masuk ke antrean review finance dan tidak bisa diubah selama ditinjau.` | `"${…}" sebesar ${…} masuk ke antrean persetujuan tim keuangan dan tidak bisa diubah selama ditinjau.` | `pages/reimbursements/components/reimbursement-drawer.tsx:287` |  |
|  | `Review reimbursement` | `Tinjau reimbursement` | `pages/reimbursements/components/reimbursement-drawer.tsx:554` |  |

### Piutang

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| PT01 | `Menunggu` | `Menunggu persetujuan` | `pages/receivables/components/ptg.tsx:9,35` | Pil status `pending_approval` hanya "Menunggu", padahal kartunya "Menunggu persetujuan"; tombol disamakan dengan Pengajuan Dana ("Ajukan untuk Persetujuan"); "pengaju" → "pemohon" (dipakai di semua modul). |
|  | `Ajukan persetujuan` | `Ajukan untuk persetujuan` | `pages/receivables/components/receivable-drawer.tsx:173` |  |
|  | `Dibaca pengaju saat memperbaiki pengajuannya` | `Dibaca pemohon saat memperbaiki pengajuannya` | `pages/receivables/components/receivable-approve-sheet.tsx:122` |  |

### Arus Kas

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| KB01 | `Input Pemasukan` | `Catat Pemasukan` | `pages/cash-flow/all.tsx:203`; `pages/cash-flow/income.tsx:218` | Kata Inggris; dialog yang dibukanya berjudul "Catat Pemasukan/Pengeluaran". |
|  | `Input Pengeluaran` | `Catat Pengeluaran` | `pages/cash-flow/all.tsx:209`; `pages/cash-flow/expenses.tsx:203` |  |
|  | `Input Transfer` | `Catat Transfer` | `pages/cash-flow/transfers.tsx:184` |  |

### Kas & Bank

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| KB02 | `Total Debit` | `Total Keluar` | `pages/bank-accounts/components/transfer-dialog.tsx:251`; `pages/cash-flow/components/transaction-detail-dialog.tsx:620`; `pages/cash-flow/transfers.tsx:275` | "debit/kredit" dalam arti rekening koran (debit = uang keluar) bertabrakan dengan kotak Jurnal, yang di dialog yang sama menaruh rekening sumber di sisi **Kredit**. Di luar kotak Jurnal, arah uang ditulis "masuk/keluar" (sudah dipakai tab Semua). "credit" juga kata Inggris. |
|  | `Akan ditambahkan ke debit rekening sumber.` | `Ikut dipotong dari rekening sumber.` | `pages/bank-accounts/components/transfer-dialog.tsx:223` |  |
|  | `↓ Pemasukan (credit)` | `↓ Uang masuk` | `pages/bank-accounts/components/transactions-tab.tsx:201` |  |
|  | `↑ Pengeluaran (debit)` | `↑ Uang keluar` | `pages/bank-accounts/components/transactions-tab.tsx:202` |  |
|  | `Daftar semua pengeluaran (debit) dari rekening bank Anda.` | `Daftar semua pengeluaran dari rekening dan kas Anda.` | `pages/cash-flow/expenses.tsx:192` |  |
|  | `Pasangan transfer (debit + credit) akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.` | `Kedua sisi transfer (keluar dan masuk) akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.` | `pages/cash-flow/transfers.tsx:379` |  |
|  | `Pengeluaran bulan ini akan dipecah per kategori begitu ada transaksi debit.` | `Pengeluaran bulan ini akan dipecah per kategori begitu ada uang keluar.` | `pages/dashboard.tsx:427` |  |
|  | `Pembayaran invoice dan transaksi kredit bulan ini akan dipecah per kategori di sini.` | `Pembayaran invoice dan uang masuk lain bulan ini akan dipecah per kategori di sini.` | `pages/dashboard.tsx:429` |  |
| KB03 | `Klik salah satu rekening atau kas di sidebar untuk melihat detailnya.` | `Klik salah satu rekening atau kas di daftar akun untuk melihat detailnya.` | `pages/bank-accounts/index.tsx:395` | Kata Inggris "sidebar" (yang dimaksud daftar akun, bukan menu samping). |

### Kategori Transaksi

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| KT01 | `Parent Kategori (opsional)` | `Kategori induk (opsional)` | `pages/transaction-categories/index.tsx:187` | Tiga istilah untuk satu konsep (Parent / Kategori Utama / induk); template kategori & dokumen modul sudah memakai "induk". "Subkategori" ditulis serangkai (KBBI: *sub-* terikat), menggantikan "Sub Kategori", "sub kategori", "sub-kategori". |
|  | `Kategori Utama (tanpa parent)` | `Tanpa induk` | `pages/transaction-categories/index.tsx:191` |  |
|  | `Kategori Utama` | `Kategori induk` | `pages/transaction-categories/index.tsx:331` |  |
|  | `Sub Kategori` | `Subkategori` | `components/shared/quick-add-category-dialog.tsx` (area A2); `pages/transaction-categories/index.tsx:332` |  |
|  | `Parent` | `Induk` | `pages/transaction-categories/index.tsx:383` |  |
|  | `Tipe, nama, dan parent kategori` | `Tipe, nama, dan induk kategori` | `pages/transaction-categories/index.tsx:138` |  |
|  | `Kelompok digunakan untuk mengelompokkan sub kategori — tidak bisa dipilih langsung saat mencatat transaksi.` | `Kelompok digunakan untuk mengelompokkan subkategori — tidak bisa dipilih langsung saat mencatat transaksi.` | `components/shared/quick-add-category-dialog.tsx` (area A2) |  |
|  | `Kategori ini memiliki sub-kategori. Hapus sub-kategori terlebih dahulu.` | `Kategori ini memiliki subkategori. Hapus subkategorinya terlebih dahulu.` | `Controllers/TransactionCategoryController.php:189` |  |
|  | `Kategori pengganti tidak boleh kategori induk. Pilih kategori yang tidak memiliki sub-kategori.` | `Kategori pengganti tidak boleh kategori induk. Pilih kategori yang tidak memiliki subkategori.` | `Controllers/TransactionCategoryController.php:219` |  |
|  | `" adalah kategori induk. Pilih salah satu sub-kategorinya.` | `" adalah kategori induk. Pilih salah satu subkategorinya.` | `app/Http/Requests/Concerns/MemeriksaKategoriTransaksi.php:32` |  |
|  | `Kategori \"{$kategori->label}\" adalah kategori induk pendanaan. Pilih sub-kategorinya; bila belum ada,` | `Kategori \"{$kategori->label}\" adalah kategori induk pendanaan. Pilih subkategorinya; bila belum ada,` | `app/Http/Requests/Concerns/MemeriksaKategoriTransaksi.php:37` |  |
|  | `Semua sub-kategorinya sudah ada di grup lain.` | `Semua subkategorinya sudah ada di grup lain.` | `app/Services/CategoryTemplateService.php:257` |  |
| KT02 | `Belum Diklasifikasi` | `Belum diklasifikasi` | `pages/transaction-categories/index.tsx:333` | Kapitalisasi beda untuk teks yang sama (kunci kamus akan kembar). |
| KT03 | `Harga Pokok (HPP)` | `Harga Pokok Penjualan (HPP)` | `pages/reports/profit-loss/index.tsx:61`; `pages/transaction-categories/components/pl-groups.ts:5` | Dua nama untuk grup L/R yang sama; laporan Laba Rugi memakai bentuk lengkap. |

### Laba Rugi

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| LR01 | `HPP Invoice (cost-recovery)` | `HPP Invoice (pemulihan biaya)` | `pages/reports/profit-loss/index.tsx:197` | Kata Inggris; padanan baku Indonesia untuk *cost recovery method* adalah "metode pemulihan biaya". PDF Laba Rugi tidak disentuh (K2). |
|  | `Basis: Kas · Cost-Recovery HPP` | `Basis: kas · HPP pemulihan biaya` | `pages/reports/profit-loss/index.tsx:260` |  |
|  | `cost-recovery` | `pemulihan biaya` | `pages/reports/profit-loss/index.tsx:524` |  |

### Masukan

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| MS01 | `Feedback` | `Masukan` | `components/floating-feedback-button.tsx` (area A2); `layouts/header.tsx` (area A2); `layouts/sidebar.tsx` (area A2) | Nama modul campur ("Feedback", "Feedback & Saran", "masukan" di kalimat). Dipilih **Masukan** (padanan lazim, mis. "Kirim masukan" di produk Google berbahasa Indonesia). Kode/rute/izin `feedbacks` tidak berubah. |
|  | `Feedback & Saran` | `Masukan` | `pages/feedbacks/index.tsx:747,751` |  |
|  | `Kirim Feedback` | `Kirim Masukan` | `components/floating-feedback-button.tsx` (area A2); `pages/feedbacks/index.tsx:279,348,758,885` |  |
|  | `Edit Feedback` | `Ubah Masukan` | `pages/feedbacks/index.tsx:279` |  |
|  | `Detail Feedback` | `Detail Masukan` | `pages/feedbacks/index.tsx:289` |  |
|  | `Tanggapi Feedback` | `Tanggapi Masukan` | `pages/feedbacks/index.tsx:409` |  |
|  | `Semua Feedback` | `Semua Masukan` | `pages/feedbacks/index.tsx:778` |  |
|  | `Feedback Saya` | `Masukan Saya` | `pages/feedbacks/index.tsx:779` |  |
|  | `Hapus Feedback` | `Hapus Masukan` | `pages/feedbacks/index.tsx:1002` |  |
|  | `Belum ada feedback` | `Belum ada masukan` | `pages/feedbacks/index.tsx:876` |  |
|  | `Anda belum mengirim feedback. Bantu kami dengan masukan Anda.` | `Anda belum mengirim masukan. Bantu kami memperbaiki aplikasi ini.` | `pages/feedbacks/index.tsx:879` |  |
|  | `Belum ada feedback yang masuk.` | `Belum ada masukan yang masuk.` | `pages/feedbacks/index.tsx:880` |  |
|  | `Feedback berhasil dikirim.` | `Masukan berhasil dikirim.` | `pages/feedbacks/index.tsx:251` |  |
|  | `Feedback berhasil diperbarui.` | `Masukan berhasil diperbarui.` | `Controllers/FeedbackController.php:181`; `pages/feedbacks/index.tsx:251` |  |
|  | `Feedback berhasil dihapus.` | `Masukan berhasil dihapus.` | `Controllers/FeedbackController.php:195`; `pages/feedbacks/index.tsx:726` |  |
|  | `Gagal menghapus feedback.` | `Gagal menghapus masukan.` | `pages/feedbacks/index.tsx:730` |  |
|  | `Hapus feedback "${…}"? Tindakan ini tidak dapat dibatalkan.` | `Hapus masukan "${…}"? Tindakan ini tidak dapat dibatalkan.` | `pages/feedbacks/index.tsx:1005` |  |
|  | `Feedback berhasil dikirim. Terima kasih atas masukannya!` | `Masukan berhasil dikirim. Terima kasih!` | `components/floating-feedback-button.tsx` (area A2) |  |
|  | `Notifikasi tentang invoice, pembayaran, dan feedback akan muncul di sini.` | `Notifikasi tentang invoice, pembayaran, dan masukan akan muncul di sini.` | `components/notifications/notification-drawer.tsx` (area A2) |  |
|  | `Feedback berhasil dikirim. Terima kasih atas masukannya.` | `Masukan berhasil dikirim. Terima kasih.` | `Controllers/FeedbackController.php:151` |  |
|  | `Feedback yang sudah diproses tidak dapat dihapus.` | `Masukan yang sudah diproses tidak dapat dihapus.` | `Controllers/FeedbackController.php:190` |  |
|  | `Status feedback diperbarui.` | `Status masukan diperbarui.` | `Controllers/FeedbackController.php:235` |  |
| MS02 | `Feedback` | `Saran` | `pages/feedbacks/index.tsx:143,163,792` | `lang/id/feedback.php` (label server, dipakai `Feedback::type_label` dkk.) berbahasa Inggris dan beda dari label frontend (Bug/Fitur/Saran, Rendah…Kritis, Terbuka…Ditutup). Jenis ketiga disamakan menjadi "Saran" (tombol melayang sudah "Saran"; halaman Masukan masih "Feedback"). |
|  | `Bug Report` | `Bug` | `lang/id/feedback.php:71` |  |
|  | `Feature Request` | `Fitur` | `lang/id/feedback.php:72` |  |
|  | `Kritik/Saran` | `Saran` | `lang/id/feedback.php:73` |  |
|  | `Open` | `Terbuka` | `lang/id/feedback.php:47` |  |
|  | `In Progress` | `Diproses` | `lang/id/feedback.php:48` |  |
|  | `Resolved` | `Selesai` | `lang/id/feedback.php:49` |  |
|  | `Closed` | `Ditutup` | `lang/id/feedback.php:50` |  |
|  | `Low` | `Rendah` | `lang/id/feedback.php:53` |  |
|  | `Medium` | `Sedang` | `lang/id/feedback.php:54` |  |
|  | `High` | `Tinggi` | `lang/id/feedback.php:55` |  |
|  | `Critical` | `Kritis` | `lang/id/feedback.php:56` |  |
|  | `Sedang Diproses` | `Diproses` | `pages/feedbacks/index.tsx:438` |  |

### Izin & Peran

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| IZ01 | `Manajemen Peran & Permission` | `Izin & Peran` | `pages/permissions/index.tsx:429,433` | Kata Inggris "permission/user/manager"; menu sudah "Izin & Peran" dan judul halaman disamakan dengan menu. Kode izin mentah (`view invoices`) tidak disentuh; labelnya akan diganti peta label (matriks §6 baris 25 rencana). |
|  | `Total Permission` | `Total Izin` | `pages/permissions/index.tsx:451` |  |
|  | `Beri Semua Permission` | `Beri Semua Izin` | `pages/permissions/index.tsx:728` |  |
|  | `Cabut Semua Permission` | `Cabut Semua Izin` | `pages/permissions/index.tsx:739` |  |
|  | `Hapus Permission` | `Hapus Izin` | `pages/permissions/index.tsx:712,719` |  |
|  | `Hapus permission` | `Hapus izin` | `pages/permissions/index.tsx:648` |  |
|  | `Cari permission...` | `Cari izin…` | `pages/permissions/index.tsx:559` |  |
|  | `Tidak ada permission ditemukan` | `Tidak ada izin yang cocok` | `pages/permissions/index.tsx:584` |  |
|  | `Gagal mengubah permission.` | `Gagal mengubah izin.` | `pages/permissions/index.tsx:354` |  |
|  | `Semua permission ${…} diberikan.` | `Semua izin ${…} diberikan.` | `pages/permissions/index.tsx:369` |  |
|  | `Semua permission ${…} dicabut.` | `Semua izin ${…} dicabut.` | `pages/permissions/index.tsx:369` |  |
|  | `Gagal memperbarui permission.` | `Gagal memperbarui izin.` | `pages/permissions/index.tsx:371,390` |  |
|  | `Semua permission diberikan.` | `Semua izin diberikan.` | `pages/permissions/index.tsx:386` |  |
|  | `Semua permission dicabut.` | `Semua izin dicabut.` | `pages/permissions/index.tsx:386` |  |
|  | `Permission berhasil dihapus.` | `Izin berhasil dihapus.` | `Controllers/Admin/PermissionController.php:177`; `pages/permissions/index.tsx:419` |  |
|  | `Gagal menghapus permission.` | `Gagal menghapus izin.` | `pages/permissions/index.tsx:422` |  |
|  | `Selalu memiliki semua hak akses; permission baru otomatis diberikan tiap pembaruan.` | `Selalu memiliki semua izin; izin baru otomatis diberikan tiap pembaruan.` | `pages/permissions/index.tsx:548` |  |
|  | `${…} dari ${…} permission diberikan` | `${…} dari ${…} izin diberikan` | `pages/permissions/index.tsx:549` |  |
|  | `Pilih salah satu peran di samping untuk melihat dan mengatur permission-nya.` | `Pilih salah satu peran di samping untuk melihat dan mengatur izinnya.` | `pages/permissions/index.tsx:668` |  |
|  | `Peran "${…}" memiliki ${…} pengguna. Mereka akan dipindahkan ke peran dengan permission paling sedikit.` | `Peran "${…}" memiliki ${…} pengguna. Mereka akan dipindahkan ke peran dengan izin paling sedikit.` | `pages/permissions/index.tsx:698` |  |
|  | `Permission "${…}" akan dicabut dari semua peran sebelum dihapus. Lanjutkan?` | `Izin "${…}" akan dicabut dari semua peran sebelum dihapus. Lanjutkan?` | `pages/permissions/index.tsx:715` |  |
|  | `Berikan semua permission ke peran "${…}"?` | `Berikan semua izin ke peran "${…}"?` | `pages/permissions/index.tsx:729` |  |
|  | `Cabut semua permission dari peran "${…}"?` | `Cabut semua izin dari peran "${…}"?` | `pages/permissions/index.tsx:740` |  |
|  | `Gagal menghapus permission:` | `Gagal menghapus izin:` | `Controllers/Admin/PermissionController.php:179` |  |
|  | `• ${…} user` | `• ${…} pengguna` | `pages/permissions/index.tsx:492` |  |
|  | `Misal: supervisor, auditor, manager` | `Misal: supervisor, auditor, manajer` | `pages/permissions/index.tsx:259` |  |

### Perusahaan (admin)

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| AD01 | `Beri akses user lain` | `Beri akses ke pengguna lain` | `pages/admin/companies/index.tsx:85,564` | Kata Inggris "user/edit". |
|  | `Satu-satunya anggota. User lain belum bisa masuk.` | `Satu-satunya anggota. Pengguna lain belum bisa masuk.` | `pages/admin/companies/index.tsx:79` |  |
|  | `Di Pengguna: edit user, centang perusahaan ini, lalu pilih peran.` | `Di Pengguna: ubah pengguna, centang perusahaan ini, lalu pilih peran.` | `pages/admin/companies/index.tsx:85` |  |
|  | `Akses diatur di halaman Pengguna: edit user, centang perusahaannya, lalu pilih peran. Peran itu berlaku di setiap perusahaan yang dicentang.` | `Akses diatur di halaman Pengguna: ubah pengguna, centang perusahaannya, lalu pilih peran. Peran itu berlaku di setiap perusahaan yang dicentang.` | `pages/admin/companies/index.tsx:301` |  |
|  | `Di Pengguna: edit user, centang ${…}, lalu pilih peran.` | `Di Pengguna: ubah pengguna, centang ${…}, lalu pilih peran.` | `pages/admin/companies/index.tsx:565` |  |

### Pengaturan

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| PG01 | `Regenerasi Favicon` | `Buat Ulang Favicon` | `pages/settings/company.tsx:369` | Kata Inggris "regenerate/login/user" ("favicon" istilah teknis, dipertahankan). |
|  | `Setelah mengganti logo, jalankan perintah berikut untuk regenerate favicon:` | `Setelah mengganti logo, jalankan perintah berikut untuk membuat ulang favicon:` | `pages/settings/company.tsx:370` |  |
|  | `Perlu login ulang` | `Perlu masuk ulang` | `pages/settings/claude.tsx:187` |  |
|  | `sebagai user situs, lalu buka ulang halaman ini.` | `sebagai pengguna situs, lalu buka ulang halaman ini.` | `pages/settings/claude.tsx:55` |  |
|  | `Sambungan berakhir sendiri setelah 30 hari tidak dipakai. Setelah itu Claude meminta login dan izin lagi.` | `Sambungan berakhir sendiri setelah 30 hari tidak dipakai. Setelah itu Claude meminta masuk dan izin lagi.` | `pages/settings/claude.tsx:110` |  |
|  | `Claude langsung kehilangan akses ke data keuangan dan harus login serta meminta izin lagi. Percakapan yang sudah ada di Claude tidak ikut terhapus.` | `Claude langsung kehilangan akses ke data keuangan dan harus masuk serta meminta izin lagi. Percakapan yang sudah ada di Claude tidak ikut terhapus.` | `pages/settings/claude.tsx:364` |  |
|  | `Sambungan Claude dicabut. Claude harus login dan meminta izin lagi.` | `Sambungan Claude dicabut. Claude harus masuk dan meminta izin lagi.` | `Controllers/Settings/KoneksiClaudeController.php:90` |  |

### Pengaturan (Template PDF)

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| PG02 | `Bold` | `Tebal` | `pages/settings/pdf-templates/edit.tsx:3243,3611` | Campuran: "Tebal (Bold)" di satu panel, "Bold" di panel lain; "Garis Border". Hanya yang padanannya sudah ada di builder ini. Istilah struktur (Header, Footer, Band, Grid, Field) → pertanyaan T-6. |
|  | `Tebal (Bold)` | `Tebal` | `pages/settings/pdf-templates/edit.tsx:2802` |  |
|  | `Miring (Italic)` | `Miring` | `pages/settings/pdf-templates/edit.tsx:2803` |  |
|  | `Border` | `Garis tepi` | `pages/settings/pdf-templates/edit.tsx:2479,2928,3707` |  |
|  | `Garis Border` | `Garis tepi` | `pages/settings/pdf-templates/edit.tsx:3192,3660` |  |
|  | `Warna border` | `Warna garis tepi` | `pages/settings/pdf-templates/edit.tsx:2483,2936,3711` |  |
|  | `Undo (Ctrl+Z)` | `Urungkan (Ctrl+Z)` | `pages/settings/pdf-templates/edit.tsx:1833` |  |
|  | `Redo (Ctrl+Shift+Z)` | `Ulangi (Ctrl+Shift+Z)` | `pages/settings/pdf-templates/edit.tsx:1836` |  |
|  | `Layers` | `Lapisan` | `pages/settings/pdf-templates/edit.tsx:1930` |  |
|  | `Seret dari toolbar.` | `Seret dari bilah alat.` | `pages/settings/pdf-templates/edit.tsx:1935` |  |

### Autentikasi

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| AU01 | `Kirim Tautan Reset` | `Kirim Tautan Atur Ulang` | `pages/auth/forgot-password.tsx:47` | Pesan server berbahasa Inggris di halaman Lupa kata sandi; halaman Atur ulang sudah memakai "Atur Ulang Kata Sandi". |
|  | `A reset link will be sent if the account exists.` | `Tautan atur ulang kata sandi akan dikirim bila akunnya terdaftar.` | `Controllers/Auth/PasswordResetLinkController.php:29` |  |

### Setup

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| SE01 | `Pastikan user MySQL di .env boleh membuat database, lalu coba lagi.` | `Pastikan pengguna MySQL di .env boleh membuat database, lalu coba lagi.` | `Controllers/SetupController.php:98` | Kata Inggris "user". |

### Klien

| ID | Teks sekarang | Teks baru (baku) | Lokasi | Alasan |
|---|---|---|---|---|
| KL01 | `PIC (Person in Charge)` | `PIC (Penanggung Jawab)` | `pages/clients/index.tsx:267` | Penjelasan singkatan dalam bahasa Inggris. |

## 4. Teks tersimpan

### 4.1 Perubahan yang menyentuh teks tersimpan

Hanya dua notifikasi Masukan, keduanya disimpan ke `app_notifications` saat dibuat. **Notifikasi lama tidak berubah.** Tidak ada kode
yang membaca balik teks notifikasi.

| Lokasi | Disimpan sekarang | Usulan | Catatan |
|---|---|---|---|
| `Controllers/FeedbackController.php:214-215` | judul `Tanggapan Feedback`; pesan `Feedback "{judul}" telah ditanggapi oleh {nama}` | `Tanggapan Masukan`; `Masukan "{judul}" telah ditanggapi oleh {nama}` | Ikut MS01 |
| `Controllers/FeedbackController.php:250-251` | judul `Feedback Baru`; pesan `{nama} mengirim {type_label}: {judul}` | `Masukan Baru`; `{nama} mengirim {jenis}: {judul}` | `type_label` mengambil label MS02 (`Bug Report` → `Bug`), jadi **MS02 sendiri sudah mengubah teks pesan baru ini** |

Target "nol perubahan teks tersimpan" hanya bisa dipenuhi dengan membiarkan label server berbahasa Inggris. Bawaan: ikut diubah,
menunggu konfirmasi T-7. Bila D7 (notifikasi `data.i18n`) dikerjakan E4, kuncinya memakai teks baru ini.

### 4.2 Teks tersimpan yang sengaja TIDAK diubah

| Teks | Lokasi | Alasan |
|---|---|---|
| `Transfer + Admin Fee - {deskripsi}`, `Transfer masuk - {deskripsi}` | `BankTransactionController` (transfer) | Deskripsi tersimpan (D8). "Admin Fee" berbahasa Inggris, tetapi sudah ada di data lama. |
| `Pembayaran pokok pinjaman - {nama}`, `Pembayaran piutang pokok: {nomor} - …` | `LoanController`, `ReceivableController` | D8. Dibaca balik oleh regex `BankTransaction::lenderFromDescription()` / `receivableNumberFromDescription()`; mengubahnya memutus tautan modul di Arus Kas. |
| `{jenis} Reimbursement: {judul} - {nama}` | `Controllers/ReimbursementController.php:382` | D8 |
| `Pencairan Dana: {judul} - {item}` | `Controllers/FundRequestController.php:495` | D8. Frasa "Pencairan Dana" tetap tepat, tidak ikut PD01. |
| Isian awal deskripsi `Isi ulang ${…}` | `pages/bank-accounts/index.tsx:459` | Tersimpan apa adanya bila pengguna tidak mengubahnya → biarkan Indonesia, **jangan** dibungkus `t()`. |
| Nama kategori template (`Setor PPN`, `Gaji Karyawan`, …) | `CategoryTemplateService::TEMPLATE` | Data; Pakai Template mencocokkan per nama. |
| Status klien `Active` / `Inactive` | `clients.status` | Nilai tersimpan. Tampilan sudah "Aktif / Tidak Aktif". |
| Nama bank `Tunai` pada akun kas | `bank_accounts.bank_name` | Lihat §4.3. |

### 4.3 Label yang bersumber dari nilai tersimpan: `Tunai`

Akun kas menyimpan `bank_name = 'Tunai'` (`BankAccount::CASH_BANK_NAME`) supaya label `nama — bank` di modul lain tidak perlu
menangani `null`. Akibatnya kata "Tunai" muncul sebagai *nama bank*, dan di EN/ZH kelak tetap berbahasa Indonesia karena ia data.

**Usulan (tanpa mengubah data):** label diturunkan dari `type`, memakai aturan yang sudah ada di `BankAccount::journalNameFor()`:
- akun kas → **nama akun saja** (mis. "Kas Kecil Kantor");
- sel yang menampilkan *nama bank* → untuk akun kas tampilkan label UI **"Kas"** (diterjemahkan), bukan nilai `Tunai`.

Titik perangkaian yang perlu diubah:

| Sisi | Lokasi | Sekarang |
|---|---|---|
| Server | `Controllers/CashFlowController.php:801` | `nama — bank` (opsi filter rekening) |
| Server | `Controllers/DashboardController.php:79` | `bank · nama` |
| Server | `Controllers/FundRequestController.php:123,142` | `nama — bank`, `nama — bank (saldo)` |
| Server | `Controllers/InvoiceController.php:496`, `Controllers/PaymentController.php:125` | `nama (bank)` |
| Server | `Controllers/LoanController.php:90`, `Controllers/ReceivableController.php:138`, `Controllers/ReimbursementController.php:413` | `nama — bank (saldo)` |
| Server | `routes/web.php` (area A2, `/api/bank-accounts`) | `nama (bank)` |
| Frontend | `pages/bank-accounts/components/transaction-form-dialog.tsx:117`, `pages/bank-accounts/components/transfer-dialog.tsx:103,109` | `` `${a.account_name} — ${a.bank_name}` `` |
| Frontend | `pages/bank-accounts/components/transfer-dialog.tsx:300` | `account.bank_name` di bawah nama akun |
| Frontend | `pages/cash-flow/all.tsx:387,390`, `pages/cash-flow/income.tsx:387`, `pages/cash-flow/expenses.tsx:370` | `row.bank_name` di kolom Keterangan (baris perlu membawa `account_type`) |

Sudah benar (tidak perlu diubah): `pages/bank-accounts/index.tsx:255` dan `account-sidebar.tsx` (cabang non-kas), `BankAccount::journalNameFor()`.
Label "Tunai" sebagai **metode pembayaran** (`payment_method = cash`) adalah peta kode → label dan tetap "Tunai".

## 5. Ikut terdampak

Kemunculan teks lama di luar kode aplikasi, untuk diselaraskan pemilik modul. Cara menyusunnya:
- `video/<slug>/guide.ts`, `steps.ts`, dan `video/capture/*.js` dicocokkan dengan pola teks lama per ID, sehingga prosa dan pemilih teks (`getByRole(..., { name: 'Edit' })`, `getByText`) ikut tertangkap.
- `docs/module/*.md` dan test hanya dihitung bila teks lama berada di dalam kutipan atau huruf tebal (label UI), supaya nama kode seperti `publishMonthly()` atau `'default'` tidak ikut. Untuk pola yang spesifik (nama modul, frasa), docs dicocokkan penuh.
- Test: baris komentar dilewati. Test alat MCP dan `koneksi-claude.md` dikecualikan karena teks MCP tidak diubah (D12).
- Kolom *Panduan* menulis `<slug>/guide.ts:baris`; *Capture* `capture/<skrip>.js:baris`; *docs* `<berkas>.md:baris`; *Test* relatif ke `tests/Feature/` kecuali tertulis lain.

**Test yang benar-benar meng-assert teks lama** (wajib ikut diubah):
- `tests/Feature/InvoiceControllerTest.php:484` → `Hanya invoice draft yang dapat dikirim.` (INV03);
- `tests/Feature/CategoryTemplateServiceTest.php:241,395` → kunci data `item permintaan dana`, di-assert di baris 256 (PD01);
- `tests/Feature/CategoryTemplateServiceTest.php:311` → `Semua sub-kategorinya sudah ada di grup lain.` (KT01);
- `tests/Feature/PendanaanTest.php:131` → `…Pilih salah satu sub-kategorinya.` (KT01).

**Skrip capture yang pasti patah:** 24 skrip di `video/capture/` login dengan `getByRole('button', { name: 'Masuk ke Dasbor' })`. U10 mengubah
tombol itu menjadi "Masuk", jadi pemilihnya harus ikut diganti; kalau tidak, seluruh pengambilan ulang screenshot gagal di langkah login.
Pemilih teks lain yang terdampak tercantum per ID di kolom *Capture*.

Hit test lain di tabel adalah nilai data (`'label' => 'Sub Kategori'`, `'Default Font'`) atau pesan assert untuk developer, dan sudah dibuang dari tabel.
`tests/browser/*.py` masih mencari teks UI Livewire lama (mis. "Category Breakdown") dan sudah tidak cocok dengan UI sekarang; berkas itu di luar PR ini.

| ID | Panduan (`guide.ts` / `steps.ts`) | Skrip capture | `docs/module` | Test |
|---|---|---|---|---|
| U01 | `feedbacks/guide.ts:75`; `fund-requests/guide.ts:81`; `loans/guide.ts:75`; `receivables/guide.ts:109`; `recurring-invoices/guide.ts:66` | `capture/bank-accounts.js:348,352`; `capture/clients.js:140`; `capture/feedbacks.js:84,85`; `capture/fund-requests.js:299`; `capture/invoices-admin.js:122`; `capture/invoices.js:195`; `capture/recurring-invoices.js:210,216`; `capture/settings.js:289`; `capture/users-permissions.js:85,88,147` | `loans.md:102` | — |
| U02 | `bank-accounts/guide.ts:58,117`; `cash-flow/guide.ts:102`; `clients/guide.ts:57`; `feedbacks/guide.ts:95,160,169`; `invoices/guide.ts:229`; `notifications/guide.ts:79`; `transaction-categories/guide.ts:77`; `users-permissions/guide.ts:53`; `bank-accounts/steps.ts:325`; `feedbacks/steps.ts:215`; `invoices/steps.ts:170`; `services/steps.ts:172`; `users-permissions/steps.ts:84` | `capture/bank-accounts.js:348,352,353`; `capture/cash-flow.js:218,365,371`; `capture/clients.js:140`; `capture/feedbacks.js:84`; `capture/invoices-admin.js:122`; `capture/invoices.js:195`; `capture/transaction-categories.js:165`; `capture/users-permissions.js:85,88,146,147` | `admin-users-permissions.md:363`; `bank-accounts.md:62,170`; `feedbacks.md:157`; `invoices.md:91` | — |
| U03 | `bank-accounts/guide.ts:20,146,207`; `dashboard/guide.ts:165`; `feedbacks/guide.ts:125,142`; `invoices/guide.ts:23,70`; `receivables/guide.ts:18,72`; `recurring-invoices/guide.ts:117`; `settings/guide.ts:37`; `users-permissions/guide.ts:25,119,124,208`; `receivables/steps.ts:137`; `recurring-invoices/steps.ts:193` | — | `cash-flow.md:438` | — |
| U04 | `invoices/guide.ts:103,104`; `settings/guide.ts:107,148`; `settings/steps.ts:176,291,297` | `capture/settings.js:182,286,292,296,297,300` | `admin-users-permissions.md:288`; `invoices.md:156` | — |
| U05 | `settings/guide.ts:106`; `settings/steps.ts:281` | — | `invoices.md:102` | — |
| U06 | `bank-accounts/guide.ts:118`; `cash-flow/guide.ts:24,49,142,143,164,243`; `bank-accounts/steps.ts:325` | `capture/bank-accounts.js:349`; `capture/cash-flow.js:82` | `bank-accounts.md:62,256,260,314`; `cash-flow.md:3,93,119,145,378`; `fund-requests.md:168` | — |
| U07 | — | — | — | — |
| U08 | — | — | — | — |
| U09 | `dashboard/guide.ts:128`; `settings/guide.ts:74` | — | `receivables.md:59,61,63,64` | — |
| U10 | `dashboard/guide.ts:157` | `capture/bank-accounts.js:38`; `capture/cash-flow.js:42`; `capture/clients.js:34`; `capture/dashboard.js:33`; `capture/feedbacks.js:38`; `capture/fund-requests-admin.js:36,41`; `capture/fund-requests.js:40,45`; `capture/invoices-admin.js:36`; `capture/invoices.js:39`; `capture/loans-after.js:32`; `capture/loans.js:35`; `capture/notifications.js:35`; `capture/profit-loss.js:32`; `capture/receivables-admin.js:32`; `capture/receivables-after.js:32`; `capture/receivables-review.js:32`; `capture/receivables.js:36`; `capture/recurring-invoices.js:44`; `capture/reimbursements-admin.js:29`; `capture/reimbursements.js:31`; `capture/services.js:42`; `capture/settings.js:40`; `capture/transaction-categories.js:43`; `capture/users-permissions.js:37` | `dashboard.md:190` | — |
| U11 | — | — | — | — |
| U12 | `bank-accounts/guide.ts:77`; `transaction-categories/guide.ts:138`; `bank-accounts/steps.ts:32`; `transaction-categories/steps.ts:275` | `capture/bank-accounts.js:105,374`; `capture/recurring-invoices.js:262`; `capture/transaction-categories.js:236,237,240` | — | — |
| U13 | `dashboard/guide.ts:54,130,145,147`; `invoices/guide.ts:69` | — | `dashboard.md:53` | — |
| INV01 | `invoices/guide.ts:30,44,113,114,229`; `notifications/guide.ts:69`; `recurring-invoices/guide.ts:36,77,118,143,151`; `invoices/steps.ts:179,196`; `recurring-invoices/steps.ts:209,245` | `capture/invoices.js:155,175,181,185`; `capture/recurring-invoices.js:272` | `invoices.md:69,76,109`; `recurring-invoices.md:98,141` | — |
| INV02 | `dashboard/guide.ts:81,142`; `invoices/guide.ts:44,56,91,114,121,184,225`; `notifications/guide.ts:123,124`; `recurring-invoices/guide.ts:36`; `dashboard/steps.ts:112`; `feedbacks/steps.ts:64`; `invoices/steps.ts:203` | `capture/invoices.js:150` | — | — |
| INV03 | `clients/guide.ts:77`; `recurring-invoices/guide.ts:77`; `recurring-invoices/steps.ts:209,273`; `settings/steps.ts:128,176` | `capture/settings.js:183` | `recurring-invoices.md:98,133` | `InvoiceControllerTest.php:484` |
| INV04 | — | — | — | — |
| RI01 | — | — | `README.md:16`; `services.md:3` | — |
| RI02 | `recurring-invoices/guide.ts:13,20,34,38,53,57,93,101,105,126,149,153,160`; `recurring-invoices/steps.ts:116,131,140,301` | `capture/recurring-invoices.js:7,186,189,193,194,199,201` | `recurring-invoices.md:121` | — |
| RI03 | `recurring-invoices/guide.ts:13,21,35,38,72,75,76,77,93,111,117,127,128,139,153,162`; `settings/guide.ts:117`; `recurring-invoices/steps.ts:155,176,184,193,200,218,301,308` | `capture/recurring-invoices.js:7,209,227,228,234,236,243` | — | — |
| RI04 | `recurring-invoices/guide.ts:45`; `recurring-invoices/steps.ts:13,22` | — | `admin-users-permissions.md:344`; `invoices.md:208` | — |
| RI05 | — | `capture/recurring-invoices.js:191,212,260` | — | — |
| RI06 | `recurring-invoices/guide.ts:57,75`; `recurring-invoices/steps.ts:140,193` | `capture/recurring-invoices.js:197,232` | — | — |
| RI07 | — | — | — | — |
| PD01 | `bank-accounts/guide.ts:173`; `cash-flow/guide.ts:195,231,232`; `fund-requests/guide.ts:6,57,60,61,157`; `notifications/guide.ts:88,89`; `profit-loss/guide.ts:66`; `transaction-categories/guide.ts:46,110,137,149,207`; `users-permissions/guide.ts:155`; `fund-requests/steps.ts:7,11,20,27,364` | `capture/fund-requests-admin.js:2,21`; `capture/fund-requests.js:2,7,25,87,92,93,97,181` | `bank-accounts.md:55,193,272,299`; `dashboard.md:139,150`; `fund-requests.md:1,192`; `README.md:22` | `CategoryTemplateServiceTest.php:241,395` |
| PD02 | `fund-requests/guide.ts:20,29,30,33,40,41,48,49,50,52,53,65,80,81,89,98,101,108,109,131,154,155,157,162,166`; `fund-requests/steps.ts:157,169,184,209,273,287,343,381,445,453` | `capture/fund-requests-admin.js:3`; `capture/fund-requests.js:178,231,259,266,283,297` | — | — |
| PD03 | `fund-requests/guide.ts:62`; `fund-requests/steps.ts:45` | `capture/fund-requests.js:112,113,114` | — | — |
| PD04 | `fund-requests/guide.ts:29,48,65,89`; `fund-requests/steps.ts:157,209`; `reimbursements/steps.ts:18` | `capture/fund-requests.js:88,178,203` | — | — |
| PD05 | `fund-requests/guide.ts:80,91`; `fund-requests/steps.ts:176,249,372` | `capture/fund-requests.js:205,219,221,224,274,276,279,294,298` | — | — |
| PD06 | — | — | — | — |
| RB01 | `reimbursements/guide.ts:35,50,58,65`; `reimbursements/steps.ts:18,89,113,257` | `capture/fund-requests.js:88,203`; `capture/reimbursements.js:112` | `reimbursements.md:42` | — |
| PT01 | `receivables/guide.ts:39,47,70,72,79,82`; `receivables/steps.ts:117,148` | `capture/receivables-review.js:87,91,98,106` | — | — |
| KB01 | `cash-flow/guide.ts:56,69,81,92`; `cash-flow/steps.ts:28,99,226` | `capture/cash-flow.js:99,107,153,172,174,212,235,313,314,316,359` | `cash-flow.md:74` | — |
| KB02 | `bank-accounts/guide.ts:100,101,128,161,163`; `cash-flow/guide.ts:95,204`; `fund-requests/guide.ts:140`; `receivables/guide.ts:150`; `reimbursements/guide.ts:117`; `bank-accounts/steps.ts:209`; `cash-flow/steps.ts:62,266` | `capture/bank-accounts.js:274,286`; `capture/cash-flow.js:330` | — | — |
| KB03 | — | `capture/bank-accounts.js:82` | `bank-accounts.md:164` | — |
| KT01 | `bank-accounts/guide.ts:88`; `cash-flow/guide.ts:58,82`; `transaction-categories/guide.ts:12,19,21,60,68,69,78,79,87,97,130,158,180,181,189,192,197`; `bank-accounts/steps.ts:125,132`; `cash-flow/steps.ts:160`; `transaction-categories/steps.ts:18,138,235,250,261` | `capture/bank-accounts.js:7,197`; `capture/cash-flow.js:7`; `capture/transaction-categories.js:130,143,248` | `transaction-categories.md:88,123,175` | `CategoryTemplateServiceTest.php:311`; `PendanaanTest.php:131` |
| KT02 | `profit-loss/steps.ts:170`; `transaction-categories/steps.ts:18` | `capture/transaction-categories.js:95` | — | — |
| KT03 | `profit-loss/guide.ts:47` | — | — | — |
| LR01 | `invoices/guide.ts:190`; `invoices/steps.ts:363` | `capture/invoices-admin.js:145,157`; `capture/profit-loss.js:89,147` | `profit-loss.md:62,79` | — |
| MS01 | `feedbacks/guide.ts:4,7,19,29,32,38,55,56,59,60,67,72,83,113,124,166,178,192`; `notifications/guide.ts:18,30,47,68,78,79,106,109,111,132,136,142`; `users-permissions/guide.ts:166`; `feedbacks/steps.ts:17,22,58,70,78,115,139,181,254,262,269`; `notifications/steps.ts:45,90,106,113,125`; `users-permissions/steps.ts:92` | `capture/bank-accounts.js:30`; `capture/cash-flow.js:34`; `capture/clients.js:26`; `capture/dashboard.js:25`; `capture/feedbacks.js:2,29,72,97,116,117,118,120,122,123,125,143,162,231,241`; `capture/fund-requests-admin.js:28`; `capture/fund-requests.js:32`; `capture/invoices-admin.js:28`; `capture/invoices.js:31`; `capture/loans-after.js:24`; `capture/loans.js:27`; `capture/notifications.js:4,5,27,95,96,114,115`; `capture/profit-loss.js:24`; `capture/receivables-admin.js:24`; `capture/receivables-after.js:24`; `capture/receivables-review.js:24`; `capture/receivables.js:28`; `capture/recurring-invoices.js:36`; `capture/reimbursements-admin.js:21`; `capture/reimbursements.js:23`; `capture/services.js:34`; `capture/settings.js:28`; `capture/transaction-categories.js:35`; `capture/users-permissions.js:25` | `feedbacks.md:51,129,135,146,183,198` | — |
| MS02 | `feedbacks/guide.ts:93`; `notifications/guide.ts:110`; `feedbacks/steps.ts:200` | `capture/feedbacks.js:187,188` | — | — |
| IZ01 | `users-permissions/guide.ts:75`; `users-permissions/steps.ts:129` | `capture/dashboard.js:197,202`; `capture/users-permissions.js:180,221,225,248,265` | `admin-users-permissions.md:247,333`; `cash-flow.md:426`; `dashboard.md:186`; `feedbacks.md:207`; `loans.md:186`; `notifications.md:142`; `README.md:75`; `receivables.md:173`; `settings.md:285`; `transaction-categories.md:255` | — |
| AD01 | — | — | — | — |
| PG01 | — | — | `settings.md:58,82,86,87` | — |
| PG02 | — | `capture/settings.js:267` | — | — |
| AU01 | — | — | — | — |
| SE01 | — | — | — | — |
| KL01 | `clients/guide.ts:40` | `capture/clients.js:91,117` | — | — |

## 6. Sengaja dibiarkan

| Kata / pasangan | Alasan |
|---|---|
| Invoice, Reimbursement | Serapan bisnis lazim dan konsisten (R2, contoh dari pengguna). |
| Draft | Lazim dan konsisten di semua modul. Juga tercetak di PDF/Excel (`InvoiceRecapExport`, `FundRequestExportService`) dan alat MCP yang tidak boleh diubah, sehingga mengubah UI saja menciptakan beda baru. **T-1.** |
| Template | Lazim dan konsisten (Template PDF, Pakai Template, template invoice berulang). KBBI: *templat*, jarang dipakai. |
| File, Email, Server, Database, Browser, Markdown, Favicon, Token, Font, Margin, Tab, Item, Detail, Filter, Status, Total, Subtotal, Qty, Logo, Video, Tutorial | Istilah UI/teknis yang lazim dan dipakai konsisten; aplikasi tidak memakai padanan Indonesia lain untuk konsep yang sama. |
| Bug | Lazim; label jenis Masukan sudah "Bug". |
| Admin, Finance Manager, Staff | Nama peran bawaan (`roles.name`, ditampilkan lewat peta label D3); juga jabatan di Profil perusahaan. |
| PIC, EFIN, Account Representative | Singkatan/jabatan resmi kantor & DJP (yang diubah hanya penjelasan "Person in Charge", KL01). |
| Retainer | Istilah kontrak jasa (hanya contoh nama template, RI07). |
| Istilah struktur template builder: Header, Footer Flow/Tetap, Band, Banded, Grid, Field, Repeat items, Padding, Line-height | Jargon desain di alat khusus admin. **T-6.** |
| "Rekening" vs "Akun" (Kas & Bank) | Sengaja: "Akun" mencakup rekening bank dan kas di modul Kas & Bank; "Rekening" dipakai modul lain untuk pemilih akun. Menyatukannya mengubah ±95 teks dan bertabrakan dengan "akun" pengguna & akun jurnal. |
| "Tipe" vs "Jenis" | Keduanya kata Indonesia baku, dipakai untuk atribut berbeda di modul berbeda. |
| "Perlu ditagih" vs "Lewat jatuh tempo" | Konsep berbeda: tab kerja invoice yang harus ditagih vs keadaan tanggal. |
| "Hak akses" di prosa | Kata Indonesia; satu-satunya kemunculan di label UI yang berdampingan dengan "permission" sudah disatukan ke "izin" (IZ01). |

## 7. Pertanyaan untuk pengguna

Setiap butir punya pilihan bawaan yang sudah dipakai di tabel §3.

| # | Pertanyaan | Bawaan | Alternatif | Dampak bila memilih alternatif |
|---|---|---|---|---|
| T-1 | Status/label **Draft** jadi ejaan KBBI **Draf**? | Tetap **Draft** (R2: lazim & konsisten; dokumen PDF/Excel & MCP ikut "Draft") | Draf | ±40 teks UI, panduan semua modul berstatus, beda dengan PDF/Excel |
| T-2 | Menu **Feedback** → **Masukan**? | **Masukan** (sumber tidak konsisten: "Feedback", "Feedback & Saran", "masukan") | Tetap "Feedback" (serapan lazim) — tetapi "Feedback & Saran" dan jenis "Feedback" tetap perlu disatukan | MS01 batal; MS02 tetap |
| T-3 | Selain kata kerja "Terbitkan", status invoice `sent` **Terkirim** → **Terbit**? | **Terbit** (aksi tidak mengirim apa pun; "Terkirim" menyiratkan email) | Tetap "Terkirim" | INV02 batal; kata kerja tetap "Terbitkan" |
| T-4 | **Edit** → **Ubah** di semua tombol & judul? | **Ubah** (R1, dan sumber sudah memakai "Ubah" untuk aksi sejenis) | Tetap "Edit" (KBBI mengenal *edit* = menyunting) lalu "Ubah Status/Ubah Nama" disamakan ke "Edit" | ±45 teks; panduan 15 modul & 11 skrip capture tidak perlu diubah |
| T-5 | Kata kerja **Publish** Invoice Berulang: **Jadikan Invoice / Dijadikan invoice**? | Ya (hasilnya invoice Draft tanpa nomor, jadi bukan "Terbitkan") | "Teruskan ke Invoice / Diteruskan" | Hanya kata di RI03 |
| T-6 | Istilah struktur **template builder** diindonesiakan? | Dibiarkan (hanya campuran Bold/Italic/Border/Undo/Redo/Layers/toolbar yang dirapikan, PG02) | Kepala / Kaki mengalir / Kaki tetap / Bagian / Per bagian / Tabel statis / Kolom data / Ulangi per item / Jarak dalam / Jarak baris | ±25 teks di `pages/settings/pdf-templates/edit.tsx`, panduan settings |
| T-7 | Teks notifikasi Masukan **baru** ikut memakai "Masukan" & label jenis baru (§4.1)? | Ya (hanya baris baru; tidak ada yang membacanya balik) | Tidak: label server MS02 harus tetap Inggris agar pesan tersimpan tidak berubah | Target "nol teks tersimpan" tercapai, tetapi label server tetap Inggris |
| T-8 | Teks di luar UI yang kini berbeda dari UI: alat MCP (`DaftarPengajuanDana` "Menunggu Review", `InvoiceBerulang` "Draft (belum dipublish)", `DaftarInvoice` "terkirim/lewat tempo") dan dokumen (`FundRequestExportService` "Menunggu Review", status token PDF "Terkirim", PDF Laba Rugi "cost-recovery") | Tidak diubah di PR ini (D12, K2) | PR terpisah untuk menyamakan istilahnya | — |

## 8. Catatan teknis (bukan perapian teks)

1. **Mojibake** di `pages/settings/pdf-templates/edit.tsx` (UTF-8 tersandi ganda) harus diperbaiki **sebelum** dibungkus `t()`. Yang tampil di layar:
   `571` `Tinggi otomatis â€” …` → `—`; `1920` `Menyimpanâ€¦` → `Menyimpan…`; `1997` `'â€¦'` → `'…'`; `1999` `Grid ${…}Ã—${…}` → `×`;
   `2334` `Teks â€” klik tambah / seret ke band` → `—`. 24 baris lainnya hanya komentar.
2. **Kunci flash yang tidak ada di berkas bahasa mana pun** (laten, karena toast sukses tidak menampilkan flash). E4 mengganti `__('pages.*')` dengan teks sumber; usulan teksnya:
   `pages.income_recorded_successfully` → `Pemasukan berhasil dicatat.`; `pages.expense_recorded_successfully` → `Pengeluaran berhasil dicatat.`
   (`BankTransactionController.php:223-224`); `pages.transaction_deleted_successfully` → `Transaksi berhasil dihapus.` (`:352`);
   `pages.transfer_completed_successfully` → `Transfer berhasil dicatat.` (`:453`); `pages.bulk_delete_done` → `:count catatan berhasil dihapus.` (`CashFlowController.php:639`).
3. **"WIB" pada stempel waktu Laba Rugi** (`pages/reports/profit-loss/index.tsx:259`, juga PDF `profit-loss.blade.php:215`), padahal zona aplikasi `Asia/Makassar` (WITA) dan layar memakai jam browser. Ini salah fakta, bukan soal kata; perlu diputuskan terpisah.
4. **Kunci mati** di `lang/id/feedback.php` (selain `type_*`, `status_*`, `priority_*`) dan `lang/id/common.php` banyak berbahasa Inggris campur. Tidak dirapikan; dihapus E4 (O7).
5. **`pages/guide/components/article.tsx:197`** menyebut menu "Pengguna & Izin", padahal nama menunya "Izin & Peran". Di luar cakupan dokumen ini (`pages/guide`), untuk pemilik panduan.
6. **`docs/module/fund-requests.md:1`** berjudul "Modul: Permintaan Dana (Fund Requests)" → ikut PD01 (pemilik modul).
