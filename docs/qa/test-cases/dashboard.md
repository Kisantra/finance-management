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
| N01 | Admin membuka dashboard | `GET /c/qa-lima/dashboard` | 200 + 9 blok props terkirim | BE | 200; props berisi `financialOverview, stats, cashFlowChart, expensesByCategory, bankAccounts, pendingInvoices, recentTransactions, recentReimbursements, recentFundRequests` (9 blok, lengkap) | Pass |
| N02 | Total pendapatan = Σ seluruh pembayaran | Baca `financialOverview.total_income` | 15.000.000 (termasuk porsi titipan pajak — dashboard memakai basis kas mentah, berbeda dari P&L) | BE | `total_income="15000000"` — cocok. Catatan: P&L untuk data yang sama melaporkan pendapatan 10.000.000 karena mengeluarkan titipan pajak; perbedaan ini **memang by design**, dashboard tidak menerapkan aturan titipan | Pass |
| N03 | HPP & laba overview | Baca `total_hpp`, `total_profit` | 4.000.000 dan 11.000.000 | BE | `total_hpp="4000000"`, `total_profit=11000000` | Pass |
| N04 | **`total_pp` = 0,5% basis item non titipan pajak** | Baca `total_pp` | `round(10.000.000 × 0,005) = 50.000` — bukan 0,5% dari 15.000.000 (= 75.000) | BE | `total_pp=50000` — item `is_tax_deposit=1` benar-benar dikecualikan dari basis | Pass |
| N05 | Total saldo computed, bukan tersimpan | Baca `total_balance` & `bankAccounts[].balance` | 122.289.000 di kedua tempat | BE | `financialOverview.total_balance=122289000`; `bankAccounts=[{"id":1,"name":"Kas QA5","bank":"BCA","account_number":"5550001","balance":122289000}]`. Kolom saldo tersimpan tidak ada di tabel `bank_accounts` (hanya `initial_balance=100000000`) | Pass |
| N06 | Outstanding nol saat invoice lunas | Baca `total_outstanding` & `pendingInvoices` | 0 dan daftar kosong | BE | `total_outstanding=0`, `pendingInvoices=[]` (invoice id 1 berstatus `paid`) | Pass |
| N07 | Stats bulan berjalan | Baca `stats` pada 19 Agustus 2026, sebelum transaksi Agustus dibuat | Pemasukan/pengeluaran bulan ini 0 (semua transaksi Mar–Jul) | BE | `{"income_this_month":0,"expenses_this_month":0,"net_this_month":0,"pending_invoices_count":0,"pending_invoices_amount":0}` | Pass |
| N08 | Grafik cash flow 6 bulan | Baca `cashFlowChart` | 6 titik Mar–Agt; Juni income 12.650.000 & expense 5.250.000; Juli 111.000/222.000 | BE | `[Mar 0/0, Apr 0/0, Mei 0/0, Jun "12650000"/"5250000", Jul "111000"/"222000", Agt 0/0]` — cocok dengan penjumlahan tangan. Label bulan sudah dilokalkan (`Mei`, `Agt`) | Pass |
| N09 | Grafik hanya membaca `bank_transactions`, bukan `payments` | Bandingkan Mar/Apr/Mei (ada pembayaran invoice, tanpa transaksi bank) | Income Mar/Apr/Mei = 0 | BE | `Mar 0, Apr 0, Mei 0` meski ada pembayaran Rp 3jt/6jt/6jt — sesuai dokumentasi, grafik tidak menggabungkan `payments` | Pass |
| N10 | Feed transaksi menggabungkan dua sumber | Baca `recentTransactions` | Berisi baris dari `bank_transactions` (dan `payments` bila masuk 8 terbaru) | BE | 8 baris teratas semuanya `bank_transactions` (yang terbaru), mis. `{"date":"2026-07-02","description":"QA5 Debit pada kategori income","type":"expense","amount":222000,"account":"Kas QA5"}` — pembayaran Mar–Mei kalah baru sehingga tidak masuk 8 besar | Pass |
| N11 | Feed pengajuan dana | Buat fund request oleh staff, baca `recentFundRequests` | Muncul dengan nomor, nominal, status, pemohon | BE | `[{"id":1,"number":"QA5/001/VIII/2026","title":"Uji actionCounts","amount":500000,"status":"pending","priority":"medium","user":"Staff Demo","date":"19 Aug 2026"}]` | Pass |
| N12 | **`actionCounts` permission-aware** | Bandingkan prop `actionCounts` untuk admin, manager, staff, `qa5-pelapor` dengan 1 fund request `pending` di DB | Admin & manager 1 (punya `approve fund requests`); staff & pelapor 0 | FE+BE | admin `{"reimbursements":0,"fund_requests":1}`; manager `{"reimbursements":0,"fund_requests":1}`; staff `{"reimbursements":0,"fund_requests":0}`; pelapor `{"reimbursements":0,"fund_requests":0}` — badge sidebar tidak bocor ke user tanpa hak review | Pass |
| N13 | Dashboard perusahaan terbuka utuh di layar | Admin buka /c/qa-satu/dashboard | Kartu ringkasan, grafik arus kas 6 bulan, dan daftar rekening tampil | FE+BE | Ketiganya tampil; saldo rekening konsisten dengan bank-accounts N17 | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | **Fallback hardcoded** — user tanpa `view dashboard` | `qa5-pelapor` `GET /c/qa-lima/dashboard` | 302 ke halaman **Pengeluaran** (bukan 403, bukan pencarian modul dinamis) | BE | 302 `Location: http://127.0.0.1:8000/c/qa-lima/cash-flow/expenses`; setelah diikuti → 200. Tujuan redirect tetap ke Pengeluaran walaupun user ini juga punya `view profit-loss` — membuktikan fallback **tidak** dinamis | Pass |
| A02 | Fallback menabrak tembok saat user juga tak punya `view expense` | `qa5-nodash` `GET /c/qa-lima/dashboard`, lalu ikuti redirect | Menurut dokumentasi: 403 di halaman tujuan | BE | 302 → `/c/qa-lima/cash-flow/expenses` → **403**. Perilaku sesuai yang didokumentasikan sebagai jebakan | Pass (lihat TEMUAN-DASH-01) |
| A03 | Dampak A02 pada alur login penuh | Login `qa5-nodash@qa.test` dari nol → ikuti seluruh rantai redirect | User mendarat di suatu halaman yang bisa dibuka | FE+BE | `POST /login` 302 → `/choose-company` → auto-pilih `qa-lima` → `/c/qa-lima/dashboard` → 302 → `/c/qa-lima/cash-flow/expenses` → **403**. User terkunci total setelah login berhasil | **Fail** (TEMUAN-DASH-01) |
| A04 | Staff **punya** `view dashboard` | Staff `GET /c/qa-lima/dashboard` | 200 | BE | 200 (role `staff` memang memegang `view dashboard` di seeder) | Pass |
| A05 | Guest membuka dashboard | Tanpa sesi `GET /c/qa-lima/dashboard` | 302 ke login | BE | 302 | Pass |
| A06 | Route lama tanpa prefix perusahaan | `GET /dashboard` (tanpa `/c/{company}`) | 404 | BE | 404 | Pass |
| A07 | Donut pengeluaran per kategori saat bulan berjalan kosong | Baca `expensesByCategory` sebelum ada transaksi Agustus | Array kosong, bukan error | BE | `expensesByCategory=[]` | Pass |
| A08 | Reimbursement kosong | Baca `recentReimbursements` | Array kosong | BE | `recentReimbursements=[]` | Pass |

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
- **SARAN PERBAIKAN**: Pilih satu (a) jadikan fallback dinamis — cari rute pertama yang boleh diakses user dari daftar prioritas, dengan halaman "tidak ada modul yang bisa diakses" sebagai pilihan terakhir; atau (b) tegakkan invarian di sisi Permissions: `view expense` wajib menyala bila `view dashboard` dimatikan. Pilihan (a) lebih tahan terhadap perubahan matriks permission di masa depan.

### CATATAN-DASH-02 — Tipe data `financialOverview` tidak konsisten (string vs integer)

- **SIFAT**: Ketidakkonsistenan kontrak API — kosmetik, berisiko rendah.
- **MENGGAGALKAN**: Tidak ada case (ditemukan saat inspeksi props N02/N03).
- **GEJALA**: Dalam satu objek yang sama, `total_income` dan `total_hpp` dikirim sebagai **string** (`"15000000"`, `"4000000"`) sedangkan `total_profit`, `total_pp`, `total_outstanding`, `total_balance` dikirim sebagai **integer**. Hal yang sama terjadi di `cashFlowChart` (`"12650000"` vs `0`).
- **SEBAB**: Nilai yang berasal langsung dari agregat SQL (`sum()`) tidak di-cast, sedangkan nilai hasil aritmetika PHP menjadi integer. Ada di `app/Http/Controllers/DashboardController.php` (`getFinancialOverview()`, `getCashFlowChart()`).
- **CAKUPAN**: Semua konsumen prop ini. Belum menimbulkan gejala terlihat karena React memformat dengan `Intl.NumberFormat`, tetapi setiap operasi aritmetika atau perbandingan ketat di sisi TypeScript akan berperilaku berbeda antar-field.
- **SARAN PERBAIKAN**: Bungkus semua agregat dengan `(int)` sebelum dikirim, seperti yang sudah dilakukan konsisten di `ProfitLossService`.

## Catatan pelaksanaan

- Seluruh case dieksekusi lewat **request HTTP dengan cookie sesi asli**; props
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
