Setiap transaksi kas dan pembayaran invoice kini menampilkan kotak **Jurnal** — akun yang **didebit** dan **dikredit** — saat mencatat (pratinjau langsung), melihat, dan mengubah. Jurnal **diturunkan** dari rekening + kategori + arah + jumlah (pembayaran invoice: dari titipan pajak & PPN invoicenya).

**Cara A**: tidak ada yang disimpan — tanpa migrasi, tabel, atau izin baru; Laba Rugi tidak berubah. Bukan buku besar (bagan akun & jurnal manual adalah fase terpisah); setiap kotak berketerangan *"Jurnal otomatis dari rekening & kategori · belum buku besar"*.

Ringkasan lengkap + semua screenshot: [`docs/pr/2026-11-09-jurnal/README.md`](docs/pr/2026-11-09-jurnal/README.md). QA berbukti: [`docs/qa/2026-11-09-jurnal/`](docs/qa/2026-11-09-jurnal/README.md).

---

## Sebelum → sesudah

Data contoh yang sama (perusahaan QA di lingkungan terisolasi). "Sebelum" diambil dari `main` (`81c6957`) sebelum kode diubah; dialog Catat/Ubah "sesudah" diambil setelah tata letak satu kolom (jam browser dipatok 9 Nov 2026 agar tanggal bawaan sama).

### Catat Pengeluaran

| Sebelum — dua kolom | Sesudah — satu kolom seperti Catat pembayaran: Jumlah → Tanggal \| Rekening → Kategori → **Jurnal · Pratinjau** → Deskripsi → Referensi → Lampiran |
|---|---|
| ![Sebelum](docs/pr/2026-11-09-jurnal/screens/01-sebelum-pengeluaran.webp) | ![Sesudah](docs/pr/2026-11-09-jurnal/screens/01-sesudah-pengeluaran.webp) |

### Catat Pemasukan berkategori Pendanaan

| Sebelum | Sesudah — akun neraca **Modal Pemilik**, bukan nama kategori |
|---|---|
| ![Sebelum](docs/pr/2026-11-09-jurnal/screens/02-sebelum-pemasukan-pendanaan.webp) | ![Sesudah](docs/pr/2026-11-09-jurnal/screens/02-sesudah-pemasukan-pendanaan.webp) |

### Rincian pembayaran invoice ber-titipan & PPN

| Sebelum | Sesudah — "titipan dulu": Titipan Pajak Klien 200.000 · PPN Keluaran 1.100.000 · Pendapatan dari Invoice 2.700.000 |
|---|---|
| ![Sebelum](docs/pr/2026-11-09-jurnal/screens/03-sebelum-detail-pembayaran.webp) | ![Sesudah](docs/pr/2026-11-09-jurnal/screens/03-sesudah-detail-pembayaran.webp) |

### Transfer

| Sebelum | Sesudah — Debit tujuan + Biaya Admin Transfer / Kredit sumber |
|---|---|
| ![Sebelum](docs/pr/2026-11-09-jurnal/screens/04-sebelum-transfer.webp) | ![Sesudah](docs/pr/2026-11-09-jurnal/screens/04-sesudah-transfer.webp) |

### Baris pokok utang hanya-lihat · ponsel

| Sebelum — tidak bisa dibuka | Sesudah — rincian hanya-lihat dengan **Utang Pinjaman – Bank BRI** (server tetap 403) | Ponsel 390 px — sesudah |
|---|---|---|
| ![Sebelum](docs/pr/2026-11-09-jurnal/screens/05-sebelum-baris-utang.webp) | ![Sesudah](docs/pr/2026-11-09-jurnal/screens/05-sesudah-baris-utang.webp) | <img src="docs/pr/2026-11-09-jurnal/screens/06-sesudah-ponsel.webp" alt="Ponsel" width="220"> |

### Catat pembayaran invoice

| Sebelum | Sesudah — invoice PPN saja: PPN Keluaran 550.000 dulu, sisanya Pendapatan dari Invoice |
|---|---|
| ![Sebelum](docs/pr/2026-11-09-jurnal/screens/07-sebelum-bayar-invoice.webp) | ![Sesudah](docs/pr/2026-11-09-jurnal/screens/07-sesudah-bayar-invoice.webp) |

---

## Aturan

- Pemasukan: Debit rekening / Kredit kategori. Pengeluaran: Debit kategori / Kredit rekening. Rekening bank "nama — bank", kas cukup namanya.
- Pendanaan template → akun neraca: Setoran Modal Pemilik → **Modal Pemilik**, Prive Pemilik → **Prive Pemilik**, Setor PPN → **PPN Keluaran**, Setor Titipan Pajak Klien → **Titipan Pajak Klien** (satu peta di samping template, nama ternormalisasi); pendanaan buatan pengguna → labelnya.
- Pokok utang/piutang: **Utang Pinjaman – {pemberi}** / **Piutang – {debitur}** (dicari sekali per halaman; cadangan tanpa nama). Bunga = beban/pendapatan biasa.
- Transfer: Debit tujuan + **Biaya Admin Transfer** / Kredit sumber. Penyesuaian: label kategori.
- Pembayaran invoice: Debit rekening / Kredit **Titipan Pajak Klien → PPN Keluaran → Pendapatan dari Invoice**, alokasi kumulatif sesudah − sebelum (urut tanggal, id) — rumus yang sama dengan Laba Rugi (`Invoice::allocatePayments()`), bukan proporsional. HPP tidak dijurnal (tidak ada uang bergerak).
- Debit = kredit selalu; baris nol tidak tampil.

## Yang berubah

- **Backend**: `JournalService` (baru, satu definisi; per halaman, tanpa N+1), `Invoice::allocatePayments()` diekstrak dari `ProfitLossService` (hasil Laba Rugi tidak berubah, tesnya tidak diubah), `CategoryTemplateService::JOURNAL_ACCOUNTS`, `BankAccount::journalNameFor()`. Baris Arus Kas & JSON Kas & Bank membawa `journal`; opsi kategori `journal_account`, rekening `journal_name`, invoice `tax_deposit_total`.
- **Frontend**: komponen katalog `JournalBox` + cermin pratinjau `lib/journal.ts`; pratinjau di Catat Pemasukan/Pengeluaran, Transfer, Catat pembayaran; jurnal tersimpan di rincian/ubah/Detail Transfer.
- **Tata letak dialog Catat & Ubah satu kolom** (seperti Catat pembayaran invoice, tanpa ruang kosong di samping isian pendek): Jumlah → Tanggal | Rekening → Kategori → Jurnal → Deskripsi → Nomor Referensi → Lampiran; Dialog `lg`; di Ubah Rekening tampil nonaktif. Tanpa perubahan perilaku. Dialog Transfer & rincian hanya-lihat tidak berubah.
- **Hanya-lihat**: baris pokok utang/piutang kini bisa dibuka (rincian + jurnal); pengguna tanpa izin ubah mendapat rincian hanya-lihat; Kas & Bank mendapat rincian per transaksi/pembayaran. Kunci server tidak berubah.
- **Dokumen**: modul cash-flow, bank-accounts, invoices, profit-loss, transaction-categories, README; katalog `CLAUDE.md`; `archipelago.md`; panduan `/panduan` (Arus Kas: tugas baru, 16 layar diambil ulang + 4 baru).

## Cara mencoba

1. `npm run build` (atau `composer dev`), login sebagai finance manager.
2. **Arus Kas › Input Pengeluaran** → pilih kategori, isi Jumlah → **Jurnal · Pratinjau**; pilih **Setor PPN** → Debit **PPN Keluaran**.
3. **Invoice** ber-PPN → **Catat pembayaran** → pembagian PPN Keluaran / Pendapatan dari Invoice.
4. Klik baris bergembok pokok utang → rincian hanya-lihat dengan jurnalnya.

## Pengujian

- [x] `npm run types` dan `npm run build` lolos
- [x] `php artisan test --compact` (suite penuh): **994 lulus, 2 dilewati (skipped), 0 gagal** — 5.076 asersi, 313 detik (MySQL `finance_management_test`, di `e505d2d`)
- [x] `tests/Feature/JurnalTest.php` (25 tes): semua aturan, nama pihak + cadangan, query per halaman konstan, transfer, penyesuaian, pembayaran (tanpa titipan, titipan saja, PPN saja, keduanya, DP < titipan, tanggal sama, mundur tanggal), debit = kredit, invarian Σ kredit Pendapatan dari Invoice / PPN Keluaran per periode = Laba Rugi
- [x] QA berbukti 16 case (N/A/C) di lingkungan terisolasi, Chromium headless, semua lolos — [`docs/qa/2026-11-09-jurnal`](docs/qa/2026-11-09-jurnal/README.md)
- [x] Redesign dialog satu kolom (tanpa perubahan PHP; suite PHP di atas tetap berlaku): `npm run types` & `npm run build` lolos, QA ulang 6 case yang melewati dialog Catat/Ubah lolos

## Catatan

- Pembayaran bertanggal lebih awal yang dicatat belakangan menggeser pembagian jurnal pembayaran sesudahnya (jumlah per invoice/periode tetap) — sama dengan Laba Rugi.
- **Dialog Catat/Ubah lebih tinggi**: tata letak satu kolom berisi ±1.030 px (Catat dengan jurnal, diukur headless). Di layar setinggi 720, 800, dan 900 px dialog bergulir dan tombol Simpan baru terlihat setelah digulir; di 1080 px terlihat langsung. Dua kolom sebelumnya ±900 px (diukur dari screenshot) — juga sudah perlu digulir di 720 px.
- Screenshot panduan Kas & Bank dan Invoice belum diambil ulang (teksnya sudah).
- Data di screenshot adalah data contoh lingkungan QA.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
