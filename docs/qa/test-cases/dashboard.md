# Test Case — Dashboard

Sumber teknis: [`docs/module/dashboard.md`](../../module/dashboard.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-lima` (DB `tenant_qa-lima`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

## Basis data & angka harapan

Data yang sama dengan modul Profit & Loss (lihat
[`profit-loss.md`](profit-loss.md)): 1 invoice Rp 15.000.000 (item titipan pajak
Rp 5.000.000), 3 pembayaran total Rp 15.000.000, rekening `Kas QA5` saldo awal
Rp 100.000.000, 12 transaksi bank, 1 fund request `pending`.

Angka harapan dihitung tangan lebih dulu:

| Metrik | Rumus | Nilai harapan |
|---|---|---|
| `total_income` | `Payment::sum(amount)` = 3jt + 6jt + 6jt | 15.000.000 |
| `total_hpp` | Σ `cogs_amount` item invoice `paid`/`partially_paid` | 4.000.000 |
| `total_profit` | `total_income − total_hpp` | 11.000.000 |
| `total_pp` | 0,5% × Σ amount item **non** `is_tax_deposit` (10.000.000) | 50.000 |
| `total_outstanding` | invoice tertunda − pembayarannya (invoice sudah `paid`) | 0 |
| `total_balance` | 100.000.000 + payments 15.000.000 + tx credit 12.761.000 − tx debit 5.472.000 | 122.289.000 |

Akun khusus yang dibuat untuk menguji fallback permission:

| Akun | Permission | Tujuan |
|---|---|---|
| `qa5-pelapor@qa.test` (id 8) | `view profit-loss`, `view expense` — **tanpa** `view dashboard` | Fallback berhasil mendarat |
| `qa5-nodash@qa.test` (id 9) | `view feedbacks`, `create feedbacks` — tanpa `view dashboard` **dan** tanpa `view expense` | Fallback hardcoded menabrak 403 |

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Admin membuka dashboard | `GET /c/qa-lima/dashboard` | 200 + 9 blok props terkirim | FE+BE | Dijalankan lewat layar sekaligus lewat props: 200; 9 blok props terkirim (`financialOverview, stats, cashFlowChart, expensesByCategory, bankAccounts, pendingInvoices, recentTransactions, recentReimbursements, recentFundRequests`) dan kesembilannya punya blok tampilan yang benar-benar dirender | Pass |
| N02 | Total pendapatan = Σ seluruh pembayaran | Baca `financialOverview.total_income` | 15.000.000 (termasuk porsi titipan pajak — dashboard memakai basis kas mentah, berbeda dari P&L) | FE+BE | Layar menampilkan **Total Pemasukan Rp 15.000.000**; prop `total_income=15000000`. Catatan: P&L untuk data yang sama melaporkan 10.000.000 karena mengeluarkan titipan pajak — perbedaan ini **memang by design** | Pass |
| N03 | HPP & laba overview | Baca `total_hpp`, `total_profit` | 4.000.000 dan 11.000.000 | FE+BE | Layar: **Total HPP / Billing Klien Rp 4.000.000** dan **Total Profit Rp 11.000.000**; cocok dengan prop | Pass |
| N04 | **`total_pp` = 0,5% basis item non titipan pajak** | Baca `total_pp` | `round(10.000.000 × 0,005) = 50.000` — bukan 0,5% dari 15.000.000 (= 75.000) | FE+BE | Layar: kartu **Total PP 0,5% Rp 50.000** — bukan 75.000. Item `is_tax_deposit=1` benar-benar dikecualikan dari basis | Pass |
| N05 | Total saldo computed, bukan tersimpan | Baca `total_balance` & `bankAccounts[].balance` | 122.289.000 di kedua tempat | FE+BE | Layar: badge **Total Saldo Rp 120.789.000** dan kartu rekening **Kas QA5 — BCA — Rp 120.789.000**, angka yang sama di dua tempat. (122.289.000 pada catatan awal adalah nilai sebelum C01 mengurangi Rp 1.500.000.) Tabel `bank_accounts` hanya menyimpan `initial_balance` | Pass |
| N06 | Outstanding nol saat invoice lunas | Baca `total_outstanding` & `pendingInvoices` | 0 dan daftar kosong | FE+BE | Layar: **Sisa Outstanding Rp 0** dan panel Invoice Tertunda berbunyi "Tidak ada invoice tertunda" | Pass |
| N07 | Stats bulan berjalan | Baca `stats` pada 19 Agustus 2026, sebelum transaksi Agustus dibuat | Pemasukan/pengeluaran bulan ini 0 (semua transaksi Mar–Jul) | FE+BE | Layar: **Pemasukan Bln Ini Rp 0**, **Pengeluaran Bln Ini Rp 1.500.000**, **Net Bln Ini −Rp 1.500.000** — nilai Agustus setelah transaksi C01; sebelum C01 ketiganya 0 | Pass |
| N08 | Grafik cash flow 6 bulan | Baca `cashFlowChart` | 6 titik Mar–Agt; Juni income 12.650.000 & expense 5.250.000; Juli 111.000/222.000 | FE+BE | Layar: grafik 6 kolom Mar–Agt; Jun jauh tertinggi (12,65jt masuk / 5,25jt keluar), Jul nyaris rata, Agt hanya batang merah. Label bulan terlokalkan (`Mei`, `Agt`) | Pass |
| N09 | Grafik hanya membaca `bank_transactions`, bukan `payments` | Bandingkan Mar/Apr/Mei (ada pembayaran invoice, tanpa transaksi bank) | Income Mar/Apr/Mei = 0 | FE+BE | Layar: Mar/Apr/Mei kosong sama sekali meski ada pembayaran Rp 3jt/6jt/6jt di bulan-bulan itu — grafik memang tidak menggabungkan `payments` | Pass |
| N10 | Feed transaksi menggabungkan dua sumber | Baca `recentTransactions` | Berisi baris dari `bank_transactions` (dan `payments` bila masuk 8 terbaru) | FE+BE | Layar: panel **Transaksi Terbaru** menampilkan 8 kartu, semuanya dari `bank_transactions` dengan tanggal, rekening, dan arah (+/−) yang benar | Pass |
| N11 | Feed pengajuan dana | Buat fund request oleh staff, baca `recentFundRequests` | Muncul dengan nomor, nominal, status, pemohon | FE+BE | Layar: panel **Pengajuan Dana** menampilkan "Uji actionCounts · Rp 500.000 · Menunggu · Sedang · Staff Demo · 19 Aug 2026" | Pass |
| N12 | **`actionCounts` permission-aware** | Bandingkan prop `actionCounts` untuk admin, manager, staff, `qa5-pelapor` dengan 1 fund request `pending` di DB | Admin & manager 1 (punya `approve fund requests`); staff & pelapor 0 | FE+BE | admin `{"reimbursements":0,"fund_requests":1}`; manager `{"reimbursements":0,"fund_requests":1}`; staff `{"reimbursements":0,"fund_requests":0}`; pelapor `{"reimbursements":0,"fund_requests":0}` — badge sidebar tidak bocor ke user tanpa hak review | Pass |
| N13 | Dashboard perusahaan terbuka utuh di layar | Admin buka /c/qa-satu/dashboard | Kartu ringkasan, grafik arus kas 6 bulan, dan daftar rekening tampil | FE+BE | Ketiganya tampil; saldo rekening konsisten dengan bank-accounts N17 | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Fallback untuk user tanpa `view dashboard` | User dengan `view expense` buka `/c/qa-lima/dashboard` | 302 ke halaman **Pengeluaran** | FE+BE | 302 → `/c/qa-lima/cash-flow/expenses`. Pengeluaran tetap tujuan pertama karena berada di puncak daftar prioritas; bedanya kini daftar itu **dicari**, bukan dipatok (lihat TEMUAN-DASH-01). Ditutup tes regresi `DashboardFallbackTest` | Pass |
| A02 | User tanpa `view dashboard` **dan** tanpa `view expense` | `qa5-nodash` (`view feedbacks` + `create feedbacks`) buka `/c/qa-lima/dashboard`, ikuti redirect | Mendarat di modul yang benar-benar boleh ia buka | FE+BE | Sebelum perbaikan: 302 → `/cash-flow/expenses` → **403**. **Setelah TEMUAN-DASH-01 diperbaiki**: 302 → `/c/qa-lima/feedbacks` → 200 | Pass (percobaan ke-2) |
| A03 | Dampak A02 pada alur login penuh | Login `qa5-nodash@qa.test` dari nol lewat layar → ikuti seluruh rantai redirect | User mendarat di suatu halaman yang bisa dibuka | FE+BE | GAGAL pada percobaan pertama: rantai berakhir **403**, user terkunci total setelah login berhasil. **Setelah diperbaiki**: login → mendarat di **Feedback & Saran** yang terbuka penuh, sidebar hanya menampilkan modul yang boleh ia akses | Pass (percobaan ke-2) |
| A04 | Staff **punya** `view dashboard` | Staff `GET /c/qa-lima/dashboard` | 200 | BE | 200 (role `staff` memang memegang `view dashboard` di seeder) | Pass |
| A05 | Guest membuka dashboard | Tanpa sesi `GET /c/qa-lima/dashboard` | 302 ke login | BE | 302 | Pass |
| A06 | Route lama tanpa prefix perusahaan | `GET /dashboard` (tanpa `/c/{company}`) | 404 | BE | 404 | Pass |
| A07 | Donut pengeluaran per kategori saat bulan berjalan kosong | Baca `expensesByCategory` sebelum ada transaksi Agustus | Array kosong, bukan error | FE+BE | Layar: donut terisi 1 irisan **MAKAN MINUM** setelah C01; sebelum C01 `expensesByCategory=[]` tanpa error | Pass |
| A08 | Reimbursement kosong | Baca `recentReimbursements` | Array kosong | FE+BE | Layar: panel **Reimburse Terbaru** berbunyi "Belum ada pengajuan" | Pass |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Transaksi baru langsung mengubah saldo computed, stats, dan donut | (1) Baca dashboard; (2) admin `POST /bank-transactions` debit Rp 1.500.000 tanggal 2026-08-10 kategori MAKAN MINUM; (3) baca dashboard lagi | Saldo turun tepat 1.500.000; `expenses_this_month` menjadi 1.500.000; donut terisi 1 slice | FE+BE | Sebelum: `balance=122289000 income_bulan_ini=0 expense_bulan_ini=0 expensesByCategory=[]`. Sesudah: `balance=120789000 income_bulan_ini=0 expense_bulan_ini=1500000 expensesByCategory=[{"name":"MAKAN MINUM","value":1500000,"color":"#2563eb"}]`. Selisih saldo tepat −1.500.000 | Pass |
| C02 | Fund request `pending` menyalakan badge hanya bagi pemroses | Staff kirim fund request → baca `actionCounts` di halaman **non-dashboard** (`/feedbacks`) untuk 3 aktor | Badge muncul di semua halaman (shared prop), tetapi hanya untuk yang berhak | FE+BE | Di `/c/qa-lima/feedbacks`: admin 1, manager 1, staff 0. Membuktikan `actionCounts` benar-benar shared prop lintas halaman, bukan milik controller dashboard | Pass |

## Temuan

### TEMUAN-DASH-01 — Fallback dashboard yang hardcoded dapat mengunci user sepenuhnya setelah login

- **SIFAT**: Cacat desain otorisasi/UX — bukan crash, tetapi user yang kredensialnya benar tidak bisa memakai aplikasi sama sekali.
- **MENGGAGALKAN**: A03 (A02 sendiri "Pass" karena persis seperti yang dijanjikan dokumentasi).
- **GEJALA**: Akun `qa5-nodash@qa.test` (punya `view feedbacks` + `create feedbacks`, tanpa `view dashboard` dan tanpa `view expense`) berhasil login (`POST /login` → 302), tetapi setiap jalur pendaratan berakhir buntu: `/c/qa-lima/dashboard` → 302 `/c/qa-lima/cash-flow/expenses` → **403**. Bahkan `/choose-company` pun berakhir di 403 yang sama karena auto-select perusahaan tunggal. Tidak ada layar apa pun yang bisa dibuka user ini lewat alur normal, padahal ia berhak membuka `/c/qa-lima/feedbacks`.
- **SEBAB**: `app/Http/Controllers/DashboardController.php::__invoke()` — redirect tetap `redirect()->route('cash-flow.expenses')` tanpa memeriksa apakah user berhak membuka tujuan itu. Dokumentasi modul sudah menyebut ini sebagai jebakan ("Fallback bukan dinamis"), jadi perilakunya diketahui; yang belum ada adalah pengamannya.
- **CAKUPAN**: Setiap role/kombinasi permission yang tidak memiliki `view dashboard` **dan** tidak memiliki `view expense`. Ini bukan konfigurasi mustahil: `view dashboard` disebut permission "togglable", dan tidak ada validasi apa pun di modul Permissions yang mencegah admin mematikan keduanya sekaligus.
- **DIPERBAIKI**: pilihan (a) diambil. `DashboardController::redirectToFirstAllowedModule()` menelusuri daftar prioritas 12 modul dan mengantar user ke yang pertama boleh ia buka; 403 hanya muncul bila memang tidak ada satu pun — dan kali itu penolakannya benar. Ditutup 4 tes regresi di `tests/Feature/DashboardFallbackTest.php` (mendarat di Pengeluaran, mendarat di Feedback saat tanpa `view expense`, urutan prioritas dipatuhi, 403 hanya saat kosong total). Diverifikasi ulang lewat layar: `qa5-nodash` login dan mendarat di Feedback (bukti `A03-1`).
- **CATATAN**: opsi (b) sengaja tidak diambil — mengunci matriks permission akan pecah lagi begitu modul baru ditambahkan, sedangkan pencarian dinamis ikut menyesuaikan sendiri.

### CATATAN-DASH-02 — Tipe data `financialOverview` tidak konsisten (string vs integer)

- **SIFAT**: Ketidakkonsistenan kontrak API — kosmetik, berisiko rendah.
- **MENGGAGALKAN**: Tidak ada case (ditemukan saat inspeksi props N02/N03).
- **GEJALA**: Dalam satu objek yang sama, `total_income` dan `total_hpp` dikirim sebagai **string** (`"15000000"`, `"4000000"`) sedangkan `total_profit`, `total_pp`, `total_outstanding`, `total_balance` dikirim sebagai **integer**. Hal yang sama terjadi di `cashFlowChart` (`"12650000"` vs `0`).
- **SEBAB**: Nilai yang berasal langsung dari agregat SQL (`sum()`) tidak di-cast, sedangkan nilai hasil aritmetika PHP menjadi integer. Ada di `app/Http/Controllers/DashboardController.php` (`getFinancialOverview()`, `getCashFlowChart()`).
- **CAKUPAN**: Semua konsumen prop ini. Belum menimbulkan gejala terlihat karena React memformat dengan `Intl.NumberFormat`, tetapi setiap operasi aritmetika atau perbandingan ketat di sisi TypeScript akan berperilaku berbeda antar-field.
- **DIPERBAIKI**: seluruh agregat di `getFinancialOverview()`, `getStats()`, `getCashFlowChart()`, `getExpensesByCategory()`, dan `getBankAccounts()` kini di-cast `(int)`. Ditutup tes regresi `test_agregat_dashboard_dikirim_sebagai_integer` yang memeriksa tipe 14 field sekaligus.

## Catatan pelaksanaan

- Putaran kedua: N01–N11, A01–A03, A07, A08 **dijalankan ulang lewat layar** di
  `/c/qa-lima/dashboard` dan dicocokkan dengan tabel angka harapan di atas.
  Angka yang tampil di layar identik dengan props, jadi kolom Lapisan-nya
  dinaikkan menjadi `FE+BE` — sebelumnya tertulis `BE` semata karena cara
  eksekusinya, bukan karena jangkauannya.
- Akun `qa5-nodash@qa.test` dibuat ulang untuk membuktikan perbaikan
  TEMUAN-DASH-01, lalu dihapus lagi setelah pengujian.
- Putaran pertama dieksekusi lewat **request HTTP dengan cookie sesi asli**; props
  dibaca dari atribut `<script data-page="app">` pada respons Inertia — angka yang
  dikutip adalah yang benar-benar dikirim server ke React.
- A01–A03 sengaja diuji dengan **dua akun berbeda** yang dibuat khusus, karena
  ketiga akun bawaan (admin/manager/staff) semuanya memiliki `view dashboard`
  sehingga tidak bisa membuktikan jalur fallback. Akun dibuat dengan direct
  permission ter-scope `qa-lima` (tanpa menyentuh role/permission bersama).
- N05 diverifikasi silang ke database: tabel `bank_accounts` hanya menyimpan
  `initial_balance`; tidak ada kolom saldo — konsisten dengan invarian "balance
  computed, bukan tersimpan".
- Angka pada N02–N05 dihitung tangan lebih dulu, baru dibandingkan.
- Perbedaan N02 (dashboard 15.000.000) vs laporan P&L (10.000.000) untuk data
  yang sama sengaja dicatat agar tidak disalahartikan sebagai bug: dashboard
  memang tidak menerapkan aturan titipan pajak.
- **Pembersihan**: akun `qa5-pelapor@qa.test` dan `qa5-nodash@qa.test` dihapus
  setelah pengujian selesai karena `users` berada di database pusat yang dipakai
  bersama. Untuk mereproduksi A01–A03, buat ulang dua user dengan direct
  permission ter-scope `qa-lima` sesuai tabel "Akun khusus" di atas. Data uji di
  `tenant_qa-lima` ditinggalkan utuh.
