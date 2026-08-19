# Test Case — Profit & Loss (Laporan Laba Rugi)

Sumber teknis: [`docs/module/profit-loss.md`](../../module/profit-loss.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-lima` (DB `tenant_qa-lima`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

## Data uji yang dibangun sendiri (semua lewat endpoint aplikasi)

| Objek | Nilai |
|---|---|
| Klien | `PT Klien QA Lima` (id 1) |
| Rekening | `Kas QA5` BCA, saldo awal Rp 100.000.000 (id 1) |
| Invoice | id 1, `001/INV/QA5-PKQ/III/2026`, terbit **2026-03-01**, total **Rp 15.000.000** |
| Item 1 | Jasa Konsultasi Pajak — amount Rp 10.000.000, `cogs_amount` Rp 4.000.000, `is_tax_deposit=0` |
| Item 2 | Titipan Pajak Klien — amount Rp 5.000.000, `cogs_amount` 0, **`is_tax_deposit=1`** |
| Pembayaran | P1 **2026-03-10** Rp 3.000.000 · P2 **2026-04-15** Rp 6.000.000 · P3 **2026-05-20** Rp 6.000.000 |
| Transaksi bank | 10 baris Juni 2026 menutup semua `pl_group` + 1 financing + 1 transfer; 2 baris Juli 2026 sengaja "salah arah"; 1 baris Agustus 2026 |

Angka harapan dihitung tangan lebih dulu dari rumus di `ProfitLossService`
(titipan = Rp 5.000.000, `total_cogs` = Rp 4.000.000), baru dibandingkan dengan
keluaran aplikasi.

Akun tambahan yang dibuat khusus untuk menguji pemisahan permission:
`qa5-pelapor@qa.test` (user id 8) — punya `view profit-loss` + `view expense`,
**tanpa** `manage categories` dan **tanpa** `view dashboard`.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buka laporan tanpa filter (default YTD) | Admin `GET /c/qa-lima/reports/profit-loss` | HTTP 200, periode default 1 Jan tahun berjalan s/d hari ini | BE | 200; `period={"start":"2026-01-01","end":"2026-08-19"}` (hari uji 19 Agu 2026) | Pass |
| N02 | Pendapatan **tidak** diakui saat invoice terbit | Periode `2026-03-01..2026-03-09` (invoice sudah `sent` 1 Mar, belum ada pembayaran) | Semua nol — bukan Rp 15.000.000 | BE | `revenue.total=0 cogs.total=0 net_profit=0` | Pass |
| N03 | **Titipan pajak dulu** — uang masuk pertama habis untuk titipan | Periode `2026-03-01..2026-03-31` (masuk Rp 3.000.000, titipan Rp 5.000.000) | `revenue.invoice = max(0, 3jt − 5jt) = 0` | BE | `rev.invoice=0 cogs.invoice=0 gross=0 net=0` | Pass |
| N04 | **Cost-recovery HPP** — pendapatan menutup modal dulu | Periode `2026-04-01..2026-04-30` (kumulatif bayar 9jt → revenue 4jt) | `revenue.invoice=4.000.000`, `cogs.invoice=4.000.000`, laba kotor 0 | BE | `rev.invoice=4000000 cogs.invoice=4000000 gross=0` | Pass |
| N05 | HPP sudah tertutup penuh, sisa jadi laba | Periode `2026-05-01..2026-05-31` (kumulatif bayar 15jt → revenue 10jt) | `revenue.invoice=6.000.000`, `cogs.invoice=0`, laba kotor 6.000.000 | BE | `rev.invoice=6000000 cogs.invoice=0 gross=6000000 net=6000000` | Pass |
| N06 | Agregasi setahun konsisten dengan penjumlahan per bulan | Periode `2026-01-01..2026-12-31` | `revenue.invoice=10.000.000` (= 0 + 4jt + 6jt), `cogs.invoice=4.000.000` | BE | `rev.invoice=10000000 cogs.invoice=4000000` | Pass |
| N07 | Klasifikasi inline `pl_group` oleh admin | `PATCH /c/qa-lima/transaction-categories/{20,3,5,14,13,17}/pl-group` → `opex, cogs, revenue, other_income, other_expense, tax` | Semua 302; kolom `pl_group` terisi di DB | FE+BE | 6× HTTP 302. DB: `3=cogs, 5=revenue, 13=other_expense, 14=other_income, 17=tax, 20=opex` | Pass |
| N08 | Laporan lengkap setelah klasifikasi | Periode `2026-01-01..2026-12-31` | Pendapatan 13jt; HPP 5jt; laba kotor 8jt; opex 2jt; laba usaha 6jt; lain +500rb/−300rb; pra-pajak 6,2jt; pajak 700rb; **laba bersih Rp 5.500.000** | BE | `rev.invoice=10000000 rev.non_invoice=3000000 rev.total=13000000` / `cogs.invoice=4000000 cogs.manual=1000000 cogs.total=5000000` / `gross=8000000 opex=2000000 operating=6000000` / `other_inc=500000 other_exp=300000 pretax=6200000 tax=700000 NET=5500000` — **identik dengan hitungan tangan** | Pass |
| N09 | Unduh PDF laporan | `GET /c/qa-lima/reports/profit-loss/pdf?start_date=2026-01-01&end_date=2026-12-31` | HTTP 200, `Content-Type: application/pdf`, nama file bertanggal, isi = angka yang sama | BE | 200, 5.892 byte, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=laporan-laba-rugi-2026-01-01-2026-12-31.pdf`, magic `%PDF-1.7`. Teks hasil `pdftotext`: `RP 5.500.000` sebagai LABA BERSIH; blok "Catatan: Ada Transaksi Belum Diklasifikasi" memuat Kembali Dana Rp 150.000 & MAKAN MINUM Rp 250.000 | Pass |
| N10 | Finance manager boleh melihat laporan | Manager `GET .../reports/profit-loss` | 200 | BE | 200 | Pass |
| N11 | Prop `unclassifiedTypes` hanya memuat kategori yang masih belum terklasifikasi | Baca props halaman setelah N07 | Map `{category_id: income\|expense}` hanya untuk sisa unclassified | BE | `unclassifiedTypes={"15":"expense","28":"income"}` — tepat 2 kategori yang tersisa | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Staff tanpa `view profit-loss` | Staff `GET .../reports/profit-loss` dan `.../pdf` | 403 keduanya | BE | 403 dan 403 | Pass |
| A02 | **Pelapor boleh lihat, tidak boleh mengklasifikasi** | `qa5-pelapor` (punya `view profit-loss`, tanpa `manage categories`): GET laporan, lalu `PATCH .../transaction-categories/20/pl-group` | GET 200; PATCH **403**; DB tidak berubah | BE | GET 200, PDF 200, PATCH **403**; DB saat itu `id=20 pl_group=NULL` (tidak berubah) | Pass |
| A03 | Staff mencoba klasifikasi | Staff `PATCH .../transaction-categories/20/pl-group` | 403 | BE | 403 | Pass |
| A04 | Nilai `pl_group` di luar daftar sah | Admin `PATCH .../transaction-categories/15/pl-group` dengan `pl_group=laba_rahasia` | 422 | BE | 422 `{"pl_group":["The selected pl group is invalid."]}` | Pass |
| A05 | `end_date` lebih awal dari `start_date` | `?start_date=2026-06-01&end_date=2026-01-01` | Ditolak validasi (redirect back + error), bukan laporan terbalik | BE | HTTP 302 kembali ke URL sebelumnya — aturan `after_or_equal` bekerja, laporan tidak dirender | Pass |
| A06 | Tanggal tidak valid | `?start_date=2026-13-45&end_date=2026-01-01` | Ditolak validasi | BE | HTTP 302 (redirect validasi), tidak ada 500 | Pass |
| A07 | Bucket unclassified **tidak** ikut ke total mana pun | Sebelum N07, periode `2026-06-01..2026-06-30` | Seluruh baris laporan 0 meski ada transaksi; unclassified income 3.650.000, expense 4.250.000 | BE | `rev.invoice=0 cogs.invoice=0 gross=0 net=0 uncl_inc=3650000 uncl_exp=4250000` | Pass |
| A08 | Kategori `financing` & `transfer` dikecualikan **total** | Setoran Modal (financing) credit Rp 9.000.000 dan Transfer Internal (transfer) debit Rp 1.000.000 pada Juni | Tidak muncul di baris laporan **maupun** di bucket unclassified | BE | Bucket unclassified Juni hanya berisi 3 kategori income + 5 kategori expense; Setoran Modal & Transfer Internal **tidak ada di daftar mana pun**; total tidak terpengaruh | Pass |
| A09 | Transaksi **credit** pada kategori bertipe `expense` ber-`pl_group` NULL | Buat credit Rp 111.000 (2026-07-01) kategori 15 MAKAN MINUM (`type=expense`, `pl_group=NULL`), lalu buka periode Juli | Uang harus terlihat di suatu tempat — minimal di bucket unclassified | BE | Seluruh laporan Juli **nol**, termasuk `unclassified.income.total=0` dan `unclassified.expense.total=0`. Baris ada di DB (`bank_transactions.id=11`) tetapi hilang dari laporan | **Fail** (BUG-PL-01) |
| A10 | Transaksi **debit** pada kategori bertipe `income` ber-`pl_group=revenue` | Buat debit Rp 222.000 (2026-07-02) kategori 5 Penghasilan (`type=income`, `pl_group=revenue`) | Idem — minimal masuk unclassified | BE | Sama: laporan Juli nol seluruhnya. Baris ada di DB (`bank_transactions.id=12`) | **Fail** (BUG-PL-01) |
| A11 | Periode tanpa data sama sekali | `?start_date=2025-01-01&end_date=2025-12-31` | Semua nol, bukan error | BE | `rev=0 net=0 uncl_i=0 uncl_e=0` | Pass |
| A12 | Guest membuka laporan & PDF | Tanpa sesi `GET .../reports/profit-loss` dan `.../pdf` | 302 ke login | BE | 302 dan 302 | Pass |
| A13 | Mengosongkan kembali `pl_group` | Admin `PATCH .../transaction-categories/20/pl-group` dengan `pl_group=` (kosong) | 302; kolom kembali NULL | BE | 302; DB `id=20 pl_group=NULL` | Pass |
| A14 | Transaksi tanpa kategori ("(Tanpa Kategori)") | Coba buat `bank_transactions` tanpa `category_id` | — | BE | **Belum diuji lewat eksekusi.** `StoreBankTransactionRequest` mewajibkan `category_id` (`['required','exists:transaction_categories,id']`), sehingga cabang `(Tanpa Kategori)` di `ProfitLossService::unclassified()` tidak dapat dicapai dari endpoint mana pun. Diverifikasi lewat **pembacaan kode**, bukan eksekusi | Belum diuji |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Reklasifikasi kategori berlaku **retroaktif** ke periode lama | (1) Kosongkan `pl_group` kategori 20 → baca laporan `2026-01-01..2026-12-31`; (2) set kembali ke `opex` → baca ulang | Angka periode lama ikut berubah dua arah | FE+BE | Setelah dikosongkan: `opex=0 operating=8000000 net=7500000 uncl_exp=2250000` (OPEX BULANAN Rp 2.000.000 pindah ke bucket). Setelah dikembalikan: `opex=2000000 operating=6000000 net=5500000 uncl_exp=250000` | Pass |
| C02 | Transaksi baru langsung tercermin di laporan periode berjalan | Admin buat debit Rp 1.500.000 (2026-08-10, kategori 15 MAKAN MINUM yang `pl_group` NULL) → buka P&L `2026-08-01..2026-08-31` | Muncul di bucket unclassified, laba bersih tetap 0 | FE+BE | `net=0 uncl_exp=1500000 cats=[{"category_id":15,"category_label":"MAKAN MINUM","amount":1500000}]` | Pass |
| C03 | Pemisahan permission "lihat" vs "klasifikasi" dalam satu alur | `qa5-pelapor` buka laporan (panel unclassified tampil) → coba PATCH dari panel | Panel tampil, aksi ditolak server | FE+BE | GET 200 dengan `unclassifiedTypes` terisi (panel akan tampil di UI), PATCH 403 — persis jebakan yang didokumentasikan | Pass |

## Temuan

### BUG-PL-01 — Transaksi yang arahnya tidak cocok dengan tipe kategorinya hilang total dari laporan

- **SIFAT**: Cacat logika akuntansi — uang menghilang diam-diam dari laporan (bukan sekadar salah laci).
- **MENGGAGALKAN**: A09, A10.
- **GEJALA**: Dua transaksi bank nyata ada di database (`bank_transactions.id=11` credit Rp 111.000 pada kategori bertipe `expense`; `id=12` debit Rp 222.000 pada kategori bertipe `income` ber-`pl_group=revenue`), keduanya bertanggal Juli 2026. Laporan periode `2026-07-01..2026-07-31` mengembalikan **seluruh baris nol**, termasuk `unclassified.income.total=0` dan `unclassified.expense.total=0`. Total Rp 333.000 tidak muncul di baris mana pun dan tidak muncul di panel peringatan — user tidak punya cara apa pun untuk tahu ada uang yang tidak terhitung.
- **SEBAB**: `app/Services/ProfitLossService.php`
  - `transactionsByGroup()` (baris 164–188) memfilter `pl_group` **dan** arah (`transaction_type`) sekaligus; baris dengan `pl_group` benar tetapi arah berbeda tidak pernah cocok.
  - `unclassified()` (baris 199–232) — jaring pengaman — hanya menangkap baris yang (a) tanpa kategori, atau (b) kategorinya bertipe **sama dengan arah transaksi** (`$matchingType = $direction === 'credit' ? 'income' : 'expense'`, baris 201) **dan** `pl_group` NULL. Kombinasi "arah ≠ tipe kategori" jatuh di antara kedua jaring.
- **CAKUPAN**: Setiap transaksi bank yang kategorinya tidak sejalan dengan arah uangnya. Ini bukan kondisi teoretis: pengembalian dana atas beban (credit pada kategori beban) dan koreksi/pembatalan pemasukan (debit pada kategori pemasukan) adalah pola pembukuan lumrah, dan `POST /bank-transactions` mengizinkannya tanpa peringatan apa pun. Dampaknya laba bersih yang tampil salah tanpa jejak.
- **SARAN PERBAIKAN**: Dua lapis. (1) Ubah `unclassified()` menjadi benar-benar "sisa": kumpulkan id transaksi yang sudah terserap keenam query `transactionsByGroup()`, lalu masukkan semua transaksi income/expense di luar himpunan itu ke bucket — jaring pengaman harus menangkap semua sisa, bukan hanya sisa yang bentuknya sudah diduga. (2) Opsional, tolak atau peringatkan di `StoreBankTransactionRequest` bila arah transaksi tidak sejalan dengan `transaction_categories.type`, agar data ambigu tidak masuk sejak awal.

## Catatan pelaksanaan

- Seluruh case dieksekusi lewat **request HTTP dengan cookie sesi asli** (login nyata
  ke `/login`), bukan lewat layar browser. Props halaman dibaca dari atribut
  `<script data-page="app">` pada respons Inertia — jadi angka yang dikutip adalah
  angka yang benar-benar dikirim server ke React, bukan hasil pembacaan kode.
- Verifikasi database dilakukan langsung ke `tenant_qa-lima` untuk setiap perubahan
  `pl_group` dan setiap baris data uji.
- Data uji dibuat lewat endpoint aplikasi (`POST /clients`, `/bank-accounts`,
  `/invoices`, `/invoices/1/send`, `/invoices/1/payments`, `/bank-transactions`),
  bukan lewat `INSERT` langsung — supaya status invoice, `updateStatus()`, dan
  relasi terbentuk sebagaimana produksi.
- Angka harapan ditulis dan dihitung tangan **sebelum** melihat keluaran aplikasi.
- A14 jujur dinyatakan **Belum diuji lewat eksekusi**; cabang kodenya tidak dapat
  dicapai dari endpoint mana pun karena `category_id` wajib.
- Kolom `pl_group` seluruh kategori `tenant_qa-lima` masih NULL saat pengujian
  dimulai — klasifikasi pada N07 adalah perubahan pertama di DB ini.
- **Pembersihan**: akun `qa5-pelapor@qa.test` dihapus setelah pengujian selesai
  (database pusat dipakai bersama). Untuk mereproduksi A02/C03, buat ulang user
  dengan direct permission ter-scope `qa-lima`: `view profit-loss` + `view expense`,
  tanpa `manage categories`. Data uji di `tenant_qa-lima` (klien, rekening,
  invoice, pembayaran, transaksi bank, `pl_group` kategori) **ditinggalkan utuh**
  sebagai jejak bukti.
- Catatan tooling (bukan cacat aplikasi): `POST /invoices/{id}/send` sempat
  mengembalikan 422 `{"invoice_number":["The invoice number field is required."]}`
  karena percobaan pertama tidak menyertakan `invoice_number`. Ini kesalahan
  penguji, bukan bug — endpoint memang mensyaratkan nomor invoice saat `send`.
