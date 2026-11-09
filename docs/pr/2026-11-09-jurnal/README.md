# Jurnal tampilan (Cara A): debit/kredit dari rekening & kategori

Setiap transaksi kas dan pembayaran invoice kini menampilkan kotak **Jurnal** — akun mana yang **didebit** dan mana yang
**dikredit** — saat **mencatat** (pratinjau langsung), **melihat**, dan **mengubah**. Jurnalnya **diturunkan** dari data
yang sudah ada (rekening + kategori + arah + jumlah; untuk pembayaran invoice dari titipan pajak & PPN invoicenya).

**Tidak ada yang disimpan**: tanpa migrasi, tabel, atau izin baru, dan Laporan Laba Rugi tidak berubah. Ini **bukan buku
besar** — belum ada bagan akun, saldo per akun, atau jurnal manual (fase terpisah yang ditunda); karena itu setiap kotak
berketerangan *"Jurnal otomatis dari rekening & kategori · belum buku besar"*.

**Mengapa.** Pemilik ingin melihat sisi akuntansi setiap transaksi (mis. setor PPN mengurangi "PPN Keluaran", bukan
beban) tanpa menunggu modul buku besar. Cara A dipilih karena tidak mengubah data: aman dipasang di perusahaan yang
sedang berjalan dan otomatis berlaku untuk transaksi lama.

---

## Sebelum → sesudah

Semua screenshot memakai **data contoh yang sama** (perusahaan QA "PT Jurnal QA" di lingkungan terisolasi). "Sebelum"
diambil dari kode `main` (`81c6957`) **sebelum** kode diubah; "sesudah" dari cabang `fitur/jurnal`, dengan langkah
skrip yang sama (dialog diisi lalu ditutup tanpa disimpan).

### 1. Catat Pengeluaran

| Sebelum | Sesudah — **Jurnal · Pratinjau** di bawah Tanggal: Debit Gaji Karyawan / Kredit BCA Operasional — BCA |
|---|---|
| ![Sebelum: Catat Pengeluaran tanpa jurnal](screens/01-sebelum-pengeluaran.webp) | ![Sesudah: Catat Pengeluaran dengan kotak Jurnal](screens/01-sesudah-pengeluaran.webp) |

### 2. Catat Pemasukan dengan kategori Pendanaan

| Sebelum — penanda & petunjuk Pendanaan saja | Sesudah — akun lawannya akun neraca **Modal Pemilik**, bukan nama kategori |
|---|---|
| ![Sebelum: Setoran Modal Pemilik](screens/02-sebelum-pemasukan-pendanaan.webp) | ![Sesudah: Debit BCA / Kredit Modal Pemilik](screens/02-sesudah-pemasukan-pendanaan.webp) |

### 3. Rincian pembayaran invoice ber-titipan & PPN (Arus Kas)

| Sebelum | Sesudah — pembayaran 4.000.000 dipecah "titipan dulu": **Titipan Pajak Klien 200.000 · PPN Keluaran 1.100.000 · Pendapatan dari Invoice 2.700.000** |
|---|---|
| ![Sebelum: Detail Pembayaran Invoice](screens/03-sebelum-detail-pembayaran.webp) | ![Sesudah: jurnal pembayaran titipan dulu](screens/03-sesudah-detail-pembayaran.webp) |

### 4. Transfer antar rekening

| Sebelum | Sesudah — Debit rekening tujuan + **Biaya Admin Transfer** / Kredit rekening sumber |
|---|---|
| ![Sebelum: Transfer Antar Rekening](screens/04-sebelum-transfer.webp) | ![Sesudah: jurnal transfer](screens/04-sesudah-transfer.webp) |

### 5. Baris pokok utang (hanya-lihat)

| Sebelum — baris bergembok tidak bisa dibuka (diklik, tidak terjadi apa-apa) | Sesudah — terbuka sebagai **Rincian** hanya-lihat dengan jurnal **Utang Pinjaman – Bank BRI**; tanpa isian, tanpa Simpan; server tetap 403 |
|---|---|
| ![Sebelum: baris utang tidak bisa dibuka](screens/05-sebelum-baris-utang.webp) | ![Sesudah: rincian hanya-lihat utang](screens/05-sesudah-baris-utang.webp) |

### 6. Ponsel (390 px)

| Sebelum | Sesudah — kotak Jurnal di bawah Tanggal, nominal tanpa "Rp" (ada di kepala kolom) agar muat |
|---|---|
| <img src="screens/06-sebelum-ponsel.webp" alt="Ponsel sebelum" width="260"> | <img src="screens/06-sesudah-ponsel.webp" alt="Ponsel sesudah" width="260"> |

### 7. Catat pembayaran invoice

| Sebelum | Sesudah — invoice PPN saja, uang muka 2.000.000: **PPN Keluaran 550.000** dulu, sisanya **Pendapatan dari Invoice 1.450.000** |
|---|---|
| ![Sebelum: Catat pembayaran](screens/07-sebelum-bayar-invoice.webp) | ![Sesudah: pratinjau jurnal pembayaran](screens/07-sesudah-bayar-invoice.webp) |

### 8. Ubah transaksi & Detail Transfer

| Ubah Setor PPN — sebelum | Sesudah — jurnal tersimpan: Debit **PPN Keluaran** |
|---|---|
| ![Sebelum: Edit Pengeluaran](screens/08-sebelum-ubah-setor-ppn.webp) | ![Sesudah: Edit Pengeluaran dengan jurnal](screens/08-sesudah-ubah-setor-ppn.webp) |

| Detail Transfer — sebelum | Sesudah |
|---|---|
| ![Sebelum: Detail Transfer](screens/09-sebelum-detail-transfer.webp) | ![Sesudah: Detail Transfer dengan jurnal](screens/09-sesudah-detail-transfer.webp) |

### 9. Baru di sesudah

| Ubah jumlah → kotak jadi **Pratinjau** | Kas & Bank: rincian hanya-lihat (penyesuaian Selisih Kas) |
|---|---|
| ![Pratinjau saat diubah](screens/12-sesudah-ubah-pratinjau.webp) | ![Rincian Kas & Bank](screens/10-sesudah-kas-bank-penyesuaian.webp) |

| Pengguna tanpa izin ubah: rincian hanya-lihat + jurnal | Pembayaran mundur tanggal menggeser pembagian pembayaran lain |
|---|---|
| ![Tanpa izin ubah](screens/11-sesudah-tanpa-izin-ubah.webp) | ![Mundur tanggal](screens/13-sesudah-mundur-tanggal.webp) |

---

## Aturan jurnal

| Transaksi | Debit | Kredit |
|---|---|---|
| Pemasukan (kategori pemasukan) | rekening | label kategori |
| Pengeluaran (kategori pengeluaran, termasuk bunga utang) | label kategori | rekening |
| Pendanaan template, masuk / keluar | rekening / akun neraca | akun neraca / rekening |
| ↳ Setoran Modal Pemilik → **Modal Pemilik**; Prive Pemilik → **Prive Pemilik**; Setor PPN → **PPN Keluaran**; Setor Titipan Pajak Klien → **Titipan Pajak Klien**; pendanaan buatan pengguna → labelnya | | |
| Pokok utang (FIN-LOAN-IN / OUT) | rekening / **Utang Pinjaman – {pemberi pinjaman}** | sebaliknya |
| Pokok piutang (FIN-RCV-IN / OUT) | rekening / **Piutang – {debitur}** | sebaliknya |
| Penyesuaian | label kategori menurut arah | |
| Transfer | rekening tujuan + **Biaya Admin Transfer** | rekening sumber (jumlah + biaya admin) |
| Pembayaran invoice | rekening (penuh) | **Titipan Pajak Klien** → **PPN Keluaran** → **Pendapatan dari Invoice** |

- Nama rekening: bank "BCA Operasional — BCA", kas cukup "Kas Kecil".
- Nama pihak utang/piutang dicari sekali per halaman; tidak ketemu (mis. utang yatim) → "Utang Pinjaman" / "Piutang".
- **Pembayaran invoice — "titipan dulu", bukan proporsional.** Bagian satu pembayaran = alokasi kumulatif *sesudah*
  pembayaran ini − *sebelumnya* (urut tanggal bayar, lalu urutan catat), dengan rumus yang **sama persis** dengan Laba
  Rugi (`Invoice::allocatePayments()`). Akibatnya Σ kredit "Pendapatan dari Invoice" dan "PPN Keluaran" pembayaran satu
  periode = pendapatan invoice & PPN Keluaran diterima di Laba Rugi periode itu (dites, dan dicek di QA C01). HPP tidak
  dijurnal di pembayaran: pengakuan HPP (cost recovery) tidak menggerakkan uang.
- "PPN Keluaran" dan "Titipan Pajak Klien" bernama sama di pembayaran invoice dan di setor PPN/titipan, sehingga terlihat
  saling menutup.
- Debit = kredit selalu (baris **Jumlah**); baris bernilai nol tidak tampil.

## Yang berubah

### Backend (satu definisi)

- **Baru** `app/Services/JournalService.php` — aturan di atas; `forTransactions()`/`forPayments()` menghitung per halaman
  (nama pihak, pembayaran sebelumnya, pasangan transfer: query per halaman, bukan per baris).
- `Invoice::allocatePayments()` — rumus "titipan dulu" diekstrak dari `ProfitLossService` (hasil Laba Rugi tidak berubah;
  tes Laba Rugi lolos tanpa diubah) dan dipakai jurnal.
- `CategoryTemplateService::JOURNAL_ACCOUNTS` — akun neraca sub pendanaan template, di samping `TEMPLATE`, dicocokkan
  dengan nama ternormalisasi yang sama dengan Pakai Template.
- `BankAccount::journalNameFor()` — nama rekening di jurnal.
- Baris Arus Kas (Semua/Pemasukan/Pengeluaran/Transfer) dan JSON tab Kas & Bank membawa `journal`; opsi kategori membawa
  `journal_account`, rekening `journal_name`, data invoice `tax_deposit_total` — bahan pratinjau di klien.
- `BankTransaction::receivableNumberFromDescription()` / `lenderFromDescription()` — dipakai bersama `moduleLinks()`.

### Frontend

- **Baru** komponen katalog `components/shared/journal-box.tsx` (`JournalBox`, gaya Obsidian, tabel semantik, akun kredit
  menjorok, muat 390 px) dan `lib/journal.ts` (cermin pratinjau, menunjuk sumber PHP-nya).
- Pratinjau di **Catat Pemasukan/Pengeluaran** (Arus Kas & Kas & Bank), **Transfer** (juga Isi ulang), **Catat
  pembayaran** invoice (juga ubah pembayaran).
- Jurnal tersimpan di **Detail Pembayaran Invoice**, **Detail Transfer**, dan dialog **ubah** (berganti Pratinjau begitu
  jumlah/kategori diubah).
- **Hanya-lihat**: baris pokok utang/piutang kini membuka rincian hanya-lihat (dulu tidak bisa diklik); pengguna tanpa izin
  ubah mendapat rincian hanya-lihat (dulu formulir ubah tanpa tombol simpan); Detail Transfer menyembunyikan isian ubah
  tanpa `edit transfer`. Kunci server **tidak berubah**.
- **Kas & Bank**: deskripsi transaksi dan nomor invoice di tab Pembayaran kini membuka rincian hanya-lihat dengan jurnal —
  satu-satunya tempat jurnal penyesuaian & kaki transfer per rekening terlihat. Mengubah tetap lewat Arus Kas.

### Dokumen & panduan

- `docs/module/{cash-flow,bank-accounts,invoices,profit-loss,transaction-categories,README}.md`, katalog `CLAUDE.md`,
  gaya `JournalBox` di `.claude/design-systems/archipelago.md`.
- `/panduan`: Arus Kas — tugas **Membaca kotak Jurnal**, dampak, contoh titipan dulu, peringatan "Jurnal bukan buku besar";
  16 layar dialog diambil ulang + 4 layar baru (data contoh); teks Kas & Bank dan Invoice diperbarui.

## File yang berubah

| File | Isi |
|---|---|
| `app/Services/JournalService.php` | **Baru** — aturan jurnal tampilan |
| `app/Models/Invoice.php`, `app/Services/ProfitLossService.php` | `allocatePayments()` satu rumus untuk Laba Rugi & jurnal |
| `app/Services/CategoryTemplateService.php` | `JOURNAL_ACCOUNTS`, `journalAccount()` |
| `app/Models/{BankAccount,BankTransaction,TransactionCategory}.php` | Nama rekening di jurnal; pengurai deskripsi utang/piutang; `journal_account` di opsi |
| `app/Http/Controllers/{CashFlow,BankTransaction,BankAccount,Invoice}Controller.php`, `routes/web.php` | `journal` per baris, data pratinjau |
| `resources/js/components/shared/journal-box.tsx`, `resources/js/lib/journal.ts` | **Baru** — komponen katalog + cermin pratinjau |
| `resources/js/pages/bank-accounts/components/{transaction-form-dialog,transfer-dialog,transactions-tab,payments-tab}.tsx`, `types.ts` | Pratinjau; rincian hanya-lihat Kas & Bank |
| `resources/js/pages/cash-flow/{all,income,expenses,transfers}.tsx`, `components/transaction-detail-dialog.tsx`, `types.ts` | Jurnal tersimpan/pratinjau; rincian hanya-lihat |
| `resources/js/pages/invoices/components/invoice-drawer.tsx` | Pratinjau jurnal Catat pembayaran |
| `tests/Feature/JurnalTest.php` (**baru**, 25 tes) | Semua aturan + invarian Laba Rugi |
| `docs/module/*`, `CLAUDE.md`, `.claude/design-systems/archipelago.md` | Dokumentasi |
| `video/{cash-flow,bank-accounts,invoices}/guide.ts`, `video/cash-flow/{steps,shots}.ts`, `video/cash-flow/screens/*`, `video/capture/{cash-flow,invoices}.js` | Panduan & video |
| `docs/qa/2026-11-09-jurnal/` | QA berbukti (16 case) |

## Cara mencoba

1. `npm run build` (atau `composer dev`), login sebagai finance manager.
2. **Arus Kas › Pemasukan & Pengeluaran › Input Pengeluaran** → pilih kategori, isi Jumlah → lihat **Jurnal · Pratinjau**.
3. Pilih **Setor PPN** (grup Pendanaan) → akun debitnya **PPN Keluaran**.
4. **Invoice** ber-PPN → **Catat pembayaran** → lihat pembagian PPN Keluaran / Pendapatan dari Invoice.
5. Klik baris bergembok pokok utang → rincian hanya-lihat dengan jurnal **Utang Pinjaman – {pemberi}**.

## Pengujian

- [x] `npm run types` dan `npm run build` lolos (`public/hot` dev server tetap utuh)
- [x] `tests/Feature/JurnalTest.php` 25 tes; tes Laba Rugi (`ProfitLossServiceTest`, `ProfitLossReportControllerTest`, `InvoicePpnTest`) lolos **tanpa diubah**
- [x] Suite penuh `php artisan test --compact`: **994 lulus, 2 dilewati, 0 gagal** (5.076 asersi, 313 detik) di `e505d2d`
- [x] QA berbukti 16 case (N/A/C), semua lolos: [`docs/qa/2026-11-09-jurnal`](../../qa/2026-11-09-jurnal/README.md)

## Catatan

- **Perilaku yang sengaja berubah**: baris pokok utang/piutang kini bisa dibuka (hanya-lihat); pengguna tanpa izin ubah
  mendapat rincian hanya-lihat, bukan formulir ubah tanpa tombol simpan; Kas & Bank punya rincian per transaksi.
- **Jurnal pembayaran bisa bergeser**: bila pembayaran bertanggal lebih awal dicatat belakangan, pembagian pembayaran
  sesudahnya ikut berubah (jumlah per invoice/periode tetap) — konsekuensi "titipan dulu" per tanggal, sama dengan Laba Rugi.
- **Dialog Catat lebih tinggi**: di layar setinggi 720 px tombol Simpan perlu digulir (dialog bergulir).
- **Biaya admin transfer** tampil sebagai akun "Biaya Admin Transfer" tetapi tetap tidak masuk Laba Rugi (kategori
  transfer, perilaku lama).
- Screenshot panduan Kas & Bank dan Invoice belum diambil ulang (teksnya sudah); alasannya di dokumen modul masing-masing.
- Data di screenshot adalah data contoh dari lingkungan QA, bukan data perusahaan.
