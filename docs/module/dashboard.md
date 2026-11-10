# Modul: Dashboard

> Halaman "Ringkasan" (redesign Obsidian, 25 Sep 2026): grid 12 kolom tiga baris tinggi tetap — Arus Kas (saldo, angka bulan ini, grafik periode/rekening) + Periode Arus Kas (kalender rentang tanggal untuk grafik); rincian per kategori bertab Pengeluaran | Pemasukan + Invoice Belum Dibayar; Rekening + Transaksi Terbaru; ditutup strip "Sepanjang waktu" (pendapatan, HPP, laba kotor, estimasi PPh). Route `GET /dashboard` (name `dashboard`), controller **invokable** `DashboardController`, digate permission togglable `view dashboard` — user tanpa permission di-redirect ke halaman Pengeluaran Cash Flow.

## Tabel Database

Dashboard **tidak punya tabel sendiri** — seluruhnya agregasi read-only dari tabel modul lain:

| Tabel | Dipakai untuk |
|-------|---------------|
| `bank_accounts` (+ `payments`, `bank_transactions`) | Total saldo (computed accessor `balance` — TIDAK tersimpan) beserta rincian Bank / Kas per kolom `type`, daftar rekening |
| `bank_transactions` (+ `transaction_categories.type`) | Pemasukan/pengeluaran bulan ini, grafik cash flow 6 bulan, pengeluaran per kategori, transaksi terbaru. Kategori bertipe `transfer` menandai kaki transfer antar akun sendiri, yang dinetralkan (lihat [Transfer antar akun sendiri](#transfer-antar-akun-sendiri-bukan-pemasukan-maupun-pengeluaran)) |
| `payments` | Total pendapatan sepanjang waktu, pembayaran invoice tertunda, feed transaksi |
| `invoices` + `invoice_items` | Invoice tertunda (`sent`, `partially_paid`, `overdue`), HPP (`cogs_amount`), basis PP (item non `is_tax_deposit`) |

## Fitur

### Akses & Redirect Fallback (`GET /dashboard`)

**Alur step-by-step:**
1. User terautentikasi (grup middleware `auth`, `verified`) membuka `/dashboard` → `DashboardController::__invoke()`.
2. Route **tidak** memakai middleware `can:` — cek permission dilakukan di dalam controller karena butuh fallback redirect, bukan 403.
3. Bila user **tidak** punya permission `view dashboard`, controller me-redirect ke route `cash-flow.expenses` (halaman Pengeluaran) — fallback tetap (hardcoded), bukan pencarian dinamis "modul pertama yang boleh diakses".
4. Bila punya permission, controller merender `Inertia::render('dashboard', [...])` dengan props `generatedAt`, `period`, `financialOverview`, `stats`, `cashFlowChart` (lazy), `accountOptions`, `expensesByCategory`, `incomeByCategory`, `bankAccounts`, `pendingInvoices`, `recentTransactions`.

**Penjelasan kode:**

```php
// app/Http/Controllers/DashboardController.php
public function __invoke(): Response|RedirectResponse
{
    // Dashboard is a togglable permission; roles without it land on Pengeluaran.
    if (! auth()->user()?->can('view dashboard')) {
        return redirect()->route('cash-flow.expenses');
    }
    ...
}
```

Perilaku ini dites di `tests/Feature/DashboardAccessTest.php`:
- `test_user_with_permission_sees_dashboard`
- `test_user_without_dashboard_is_redirected_to_expenses`

### Financial Overview → strip "Sepanjang waktu"

**Alur step-by-step:**
1. `getFinancialOverview()` dihitung sekali per render (semua data all-time, tanpa filter tanggal).
2. `total_income` = `Payment::sum('amount')` (seluruh pembayaran invoice).
3. `total_hpp` = sum `cogs_amount` item dari invoice berstatus `partially_paid`/`paid`.
4. `total_profit` = `total_income − PPN yang sudah dibayar − total_hpp`. PPN yang dibayar per invoice ber-PPN = `min(max(0, Σ pembayaran − Σ titipan pajak), ppn_amount)` (urutan "titipan dulu" sama dengan Laba Rugi) — PPN titipan negara, bukan laba (sejak 2026-10-13).
5. `total_outstanding` = `max(0, total invoice tertunda - pembayaran atas invoice tertunda)` (status `sent`, `partially_paid`, `overdue`).
6. `total_pp` = 0,5% dari sum amount item invoice terbayar/sebagian yang **bukan** titipan pajak (`is_tax_deposit = false`) — estimasi PPh final UMKM, bukan pajak tercatat.
7. UI (`resources/js/pages/dashboard.tsx`): satu baris hening di bawah grid — Pendapatan, HPP, Laba kotor (hijau/merah mengikuti tanda), Est. PPh final 0,5%, tautan Laporan Laba Rugi (permission `view profit-loss`).

### Stats Bulan Berjalan → hero kartu Arus Kas

1. `getStats($start, $end)` dengan rentang `startOfMonth()`–`endOfMonth()` bulan berjalan.
2. **Invarian pemasukan:** `income_this_month` = `bank_transactions` kredit **+** `payments` dalam rentang **−** transfer antar akun sendiri, konsisten dengan rumus saldo rekening (`initial_balance + payments + tx credit − tx debit`). `expenses_this_month` = `bank_transactions` debit **−** transfer antar akun sendiri (biaya admin transfer tetap di sini). `net_this_month` = selisihnya = perubahan total saldo bulan itu. Aturan transfer di bagian berikut.
3. `pending_invoices_count` / `pending_invoices_amount` = jumlah & sisa tagihan invoice `sent`/`partially_paid`/`overdue`.
4. **Rincian Kas & Bank:** `total_bank` dan `total_cash` dihitung dari memo `rekening()` yang sama (`BankAccount::withBalance()`, tanpa query tambahan): kas = akun `type = cash` (`isCash()`), `total_bank = total_balance − total_cash` sehingga jumlahnya selalu cocok.
5. UI: angka besar 40 px = `total_balance` (stok); tepat di bawahnya "Total saldo · Bank Rp … · Kas Rp …" (+ "grafik: …" bila filter rekening aktif); lalu tiga figur Pemasukan / Pengeluaran / Arus bersih bulan berjalan (arus). Angka ini **tidak** diulang di kartu lain.

### Transfer antar akun sendiri (bukan pemasukan maupun pengeluaran)

Keputusan pengguna 9 Nov 2026 (temuan QA K-02, sejak kas kecil membuat **Isi ulang** jadi rutin): dulu satu transfer (mis. isi ulang kas Rp 2.500.000) terhitung di Pemasukan **dan** Pengeluaran, dan donat Pengeluaran menulis "Antar Rekening Sendiri 98%". Aturannya sekarang:

1. **Di tingkat perusahaan** (semua akun) uang yang hanya berpindah antar akun sendiri bukan pemasukan maupun pengeluaran. **Biaya admin transfer adalah beban nyata** dan tetap di Pengeluaran.
2. **Angka satu rekening** tetap menghitung transfer sebagai uang masuk/keluar rekening itu: grafik Ringkasan dengan filter rekening (`chart_account`) dan statistik/grafik/donat per akun di Kas & Bank (`BankAccountController::buildAccountDetail()`).
3. **Satu definisi** di `app/Models/BankTransaction.php`: `internalTransferGroups($dari, $sampai)` (baris per kelompok) dan `internalTransferTotal($dari, $sampai)` (jumlahnya, dihitung di database). Kaki transfer = baris berkategori bertipe `transfer`, dikelompokkan per **tanggal** + **tautan**: `transfer_group_id`, atau `reference_number` berawalan `TRF` untuk pasangan warisan yang `transfer_group_id`-nya null. Kaki tanpa tautan (dicatat lewat dialog Pemasukan/Pengeluaran, yang juga menawarkan kategori transfer) berkumpul satu kelompok per tanggal. Per kelompok `internal = min(Σ kredit, Σ debit)`.
4. **Rumus**: Pemasukan = kredit + pembayaran invoice − Σ `internal`; Pengeluaran = debit − Σ `internal`. Karena dikurangkan dari kedua sisi, **Pemasukan − Pengeluaran = perubahan total saldo** periode itu (rumus saldo tidak berubah). Untuk transfer berpasangan hasilnya sama dengan "kredit transfer dibuang, debit transfer tinggal biaya admin"; bedanya hanya pada kaki tanpa lawan, yang tetap uang masuk/keluar di kategorinya — bukan pengeluaran negatif atau "biaya admin".
5. **Donat**: kaki transfer tidak dijumlah per baris. Sisa debit kelompok bertautan (= biaya admin) menjadi irisan **"Biaya admin transfer"**; sisa kelompok tanpa lawan tetap di label kategorinya. Jumlah irisan tetap sama dengan angka di kartu Arus Kas.
6. **Pemakai**: kartu Arus Kas bulan ini (`getStats`), grafik semua rekening (`getCashFlowChart`, per bucket), kedua donat (`getByCategory`), Ringkasan Total di Kas & Bank (`BankAccountController::index`, semua waktu), dan alat Claude `ringkasan-keuangan` bagian `kas` (`uang_masuk`/`uang_keluar`). Tidak terpengaruh: tab Arus Kas (sejak awal menyaring tipe kategori `income`/`expense`), Laba Rugi (`pl_group`), strip Sepanjang waktu (hanya `payments` + saldo), Transaksi Terbaru (daftar baris), alat Claude `mutasi-rekening` (mutasi per baris; deskripsinya menyebut transfer muncul di masuk dan keluar).
7. **Penyesuaian & pendanaan tidak dinetralkan**: kategori `adjustment` (menu "Transfer & Penyesuaian" hanya menampilkan pasangan transfer) dan `financing` (pokok utang/piutang, setoran modal, prive, setor PPN/titipan pajak) adalah perubahan saldo satu kaki yang nyata, jadi tetap dihitung. **Konsistensi dengan Arus Kas (sejak 9 Nov 2026):** tab Arus Kas › Semua kini juga memuat pendanaan (berpenanda, porsinya disebut di kartu), sehingga tanpa transfer & penyesuaian, Pemasukan/Pengeluaran/Arus bersih bulan ini di sini = Total masuk/Total keluar/Selisih tab Semua untuk bulan yang sama (`PendanaanTest::test_tanpa_transfer_dan_penyesuaian_selisih_arus_kas_semua_sama_dengan_dashboard`). Selisih yang tersisa hanya biaya admin transfer (poin 8) dan penyesuaian.
8. **Biaya admin di tiga tempat**: dihitung sebagai Pengeluaran di Ringkasan dan Ringkasan Total Kas & Bank, tetapi tidak muncul di tab Pengeluaran Arus Kas maupun Laba Rugi (kategorinya bertipe `transfer`). Selisih sebesar biaya admin antara Pengeluaran Ringkasan dan Total Keluar Arus Kas › Semua itu disengaja.

Tes: `tests/Feature/TransferAntarAkunTest.php` (isi ulang dengan biaya admin + pengeluaran + pembayaran, pasangan warisan tanpa `transfer_group_id`, filter satu rekening, penyesuaian & pendanaan, kaki tanpa pasangan, invarian Pemasukan − Pengeluaran = perubahan total saldo di kartu, grafik, Ringkasan Total, dan alat Claude).

### Grafik Arus Kas (periode & filter rekening)

Route tetap `GET /dashboard`; parameter dibaca `DashboardChartRequest` dan prop `cashFlowChart` adalah closure (lazy) sehingga pil periode / filter rekening memakai partial reload `router.reload({ only: ['cashFlowChart'], data: {...} })` tanpa menghitung ulang blok lain.

| Param | Nilai | Default | Keterangan |
|-------|-------|---------|------------|
| `chart_period` | `weekly`, `monthly`, `yearly`, `range` | `monthly` | Granularitas dan jangkauan bucket |
| `chart_from`, `chart_to` | `Y-m-d` | – | Wajib bila `range`; maksimal 731 hari; `from ≤ to` |
| `chart_account` | id `bank_accounts` | – (semua) | Filter satu rekening; id yang tidak ada diabaikan |

**Nilai tidak valid → jatuh ke default, bukan 422** (`DashboardChartRequest::failedValidation()` sengaja no-op; `chart()` menyaring sendiri) supaya halaman ringkasan selalu terbuka.

| `chart_period` | Bucket | Label |
|---------------|--------|-------|
| `weekly` | 12 minggu terakhir, Senin–Minggu | `21–27 Sep`, lintas bulan `27 Jul–2 Agt` |
| `monthly` | 6 bulan terakhir | `Sep`; lintas tahun `Des 25` |
| `yearly` | 5 tahun terakhir | `2026` |
| `range` | ≤ 31 hari → harian (`23 Agt`), ≤ 26 minggu → mingguan, selebihnya bulanan | mengikuti granularitas |

**Bentuk prop:**

```php
[
    'period' => 'monthly', 'granularity' => 'monthly',
    'range' => ['from' => '2026-04-01', 'to' => '2026-09-30'],
    'account' => null, // atau ['id' => 2, 'label' => 'BCA · Operasional']
    'labels' => ['Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep'],
    'income' => [...], 'expenses' => [...], // integer rupiah per bucket
]
```

**Penjelasan kode:** `getCashFlowChart()` memuat kredit, debit, dan pembayaran dalam rentang bucket dengan **tiga query total** (bukan dua per bucket), lalu menjumlahkan per bucket di PHP agar sama di MySQL dan SQLite. Tanpa filter rekening, query keempat (`BankTransaction::internalTransferGroups()`) mengurangkan transfer antar akun sendiri dari kedua seri per bucket menurut tanggalnya; dengan filter rekening transfer tetap dihitung (lihat bagian Transfer antar akun sendiri). Filter rekening hanya mengubah grafik; saldo total dan angka bulan ini tetap seluruh perusahaan (UI menegaskan dengan "grafik: BCA · Operasional" di bawah saldo). Frontend menyimpan pilihan terakhir di `localStorage` (`dashboard.chart`) dan memulihkannya bila URL tidak membawa `chart_*`. Komponen grafik: `resources/js/components/dashboard/cash-flow-chart.tsx` (SVG/CSS sendiri, tanpa ApexCharts; batang adaptif 6–31 bucket, tooltip hover/fokus, tabel `sr-only`). Gagal memuat → state gagal per widget dengan tombol "Coba lagi".

Tes: `tests/Feature/DashboardChartTest.php` (tiap periode, batas rentang, fallback nilai tidak valid, filter rekening, invarian pemasukan) dan `tests/Feature/TransferAntarAkunTest.php` (transfer per bucket, filter satu rekening).

### Pengeluaran | Pemasukan per Kategori (donat bertab)

1. `getByCategory('debit'|'credit', $start, $end)` mengisi dua prop: `expensesByCategory` dan `incomeByCategory` — transaksi bank bulan berjalan yang berkategori **selain** tipe `transfer`, group by `category_id`, urut nilai. Kaki transfer masuk lewat kelompoknya: hanya sisa setelah yang pindah antar akun dikurangkan — **"Biaya admin transfer"** untuk sisa debit transfer bertautan, label kategorinya untuk kaki tanpa lawan.
2. Pemasukan menambahkan **pembayaran invoice** (`payments` bulan berjalan) sebagai satu kategori "Pembayaran invoice", sehingga total tab Pemasukan = angka Pemasukan di kartu Arus Kas (kredit bank + Payment − transfer antar akun).
3. Empat terbesar dikirim apa adanya; sisanya digabung menjadi satu irisan "Lainnya" (atau "Tanpa kategori" bila hanya transaksi tanpa kategori) — maksimal **5 irisan** agar legenda berukuran tetap.
4. UI: judul kartu adalah pil tab Pengeluaran | Pemasukan (state lokal, tanpa permintaan server); keadaan kosong & tautan "Lihat pengeluaran/pemasukan" mengikuti tab. Warna **tidak** dikirim server: donat memakai ramp netral satu hue (`donut-chart.tsx`).

### Daftar Rekening Bank

1. `getBankAccounts()` mengembalikan semua akun Kas & Bank (`type`, nama, bank, nomor, `balance` computed), urut saldo terbesar.
2. UI: viewport 3 baris (210 px) yang menggulir di dalam kartu; header "3 dari N". Akun kas tampil dengan tile `KAS` dan subjudul "Kas tunai" (bukan "Tunai · KAS-0001").

### Invoice Belum Dibayar (top 5)

1. `getPendingInvoices()` — invoice `sent`/`partially_paid`/`overdue`, urut `due_date`, ambil 5, eager `client`.
2. Per invoice: `total_amount`, `paid`, `remaining`, `days_until_due` (negatif bila lewat), dan `status` yang **diturunkan menjadi `overdue`** bila `due_date < hari ini` (status tersimpan tidak diubah).
3. Header kartu memuat `pending_invoices_count` + `pending_invoices_amount` dan "5 dari N · Lihat semua"; tiap baris menautkan ke `#invoice/{id}` — detail invoice terbuka sebagai modal **di atas Ringkasan** (URL `/dashboard#invoice/{id}`), halaman tidak berganti (lihat `docs/module/invoices.md`, Detail Invoice).

### Periode Arus Kas (kalender rentang)

Menggantikan kartu "Perlu Tindakan" dan pil "Rentang" (keputusan user 29 Sep 2026: invoice belum dibayar tampil dua kali di Ringkasan). Tidak ada prop server sendiri — memakai parameter `chart_period=range&chart_from&chart_to` yang sama dengan grafik.

1. `components/dashboard/range-calendar.tsx`: kalender bulan yang selalu tampil (react-day-picker `mode="range"`, `fixedWeeks` agar tinggi tetap). Klik pertama = awal, klik kedua = akhir (dibalik otomatis bila terbalik) → langsung `loadChart({ period: 'range', from, to })`. Rentang > 731 hari ditolak di kalender dengan pesan, sama dengan batas `DashboardChartRequest`.
2. **Satu sumber periode aktif.** Saat rentang dipakai: pil Mingguan/Bulanan/Tahunan tanpa pilihan, redup, bertepi putus-putus, dan `aria-label` menyebut "tidak dipakai"; kalender berlabel "Dipakai grafik" dan menampilkan "1 Sep – 20 Sep 2026 · 20 hari" + tombol "Kembali ke Bulanan". Saat pil dipakai: kalender redup tanpa sorotan dengan label "Tidak dipakai".
3. **Kartu ringkasan di bawah kalender** (gaya ubin seperti referensi desain): arus bersih periode yang sedang tampil di grafik (`Σ income − Σ expenses` dari `cashFlowChart`, jadi ikut pil maupun rentang), teks status rentang/instruksi/error, dan tombol "Kembali ke Bulanan" saat rentang aktif. Hari di luar bulan tampil sebagai ubin berarsir tanpa angka; hari ini bertepi biru dengan titik.
   - **Penanda klik pertama (8 Okt 2026).** react-day-picker 10 hanya memberi `range_start` bila `from` dan `to` sama-sama terisi, jadi tanggal awal yang baru diklik dulu tidak bertanda. Sekarang dipasang lewat `modifiers` sendiri: tanggal awal solid biru + cincin; saat kursor/fokus berada di tanggal lain, rentang calon tampil bergaris putus-putus dan ujungnya bertepi biru; status kartu berwarna biru ("5–12 Okt 2026 · 8 hari · klik untuk terapkan"); tombol "Batal" atau tombol Escape membatalkan pilihan setengah jadi.
4. Antrean reimbursement & permintaan dana yang dulu ada di kartu ini kini hanya terlihat lewat badge rel navigasi (`actionCounts`).

### Transaksi Terbaru (gabungan)

1. `getRecentTransactions()` menggabungkan 8 `bank_transactions` terbaru dan 8 `payments` terbaru, sort desc by date, ambil 8.
2. UI: viewport 4 baris (216 px) menggulir di dalam kartu; kredit `+` hijau, debit `−` (U+2212) oranye, teks `sr-only` "masuk/keluar".

> Kartu "Reimburse Terbaru" dan "Pengajuan Dana Terbaru" **dihapus** pada redesign Obsidian (25 Sep 2026): isinya kini terwakili badge rel navigasi (kartu Perlu Tindakan juga dihapus 29 Sep 2026).

### Sidebar Action Counts (shared prop, bukan bagian controller Dashboard)

Bukan dihitung di `DashboardController`, melainkan shared Inertia prop `actionCounts` di `HandleInertiaRequests::share()` — tampil sebagai badge kuning di grup Operasional (rel ciut) dan di sub-item Reimbursement / Permintaan Dana (rel lebar) di **semua** halaman.

**Alur step-by-step:**
1. Setiap request Inertia, middleware mengevaluasi lazy prop `actionCounts` untuk user login.
2. `reimbursements` = count status `pending` (bila user `can('approve reimbursements')`) + count status `approved` (bila `can('pay reimbursements')`).
3. `fund_requests` = count status `pending` (bila `can('approve fund requests')`) + count status `approved` (bila `can('disburse fund requests')`).
4. User tanpa permission review/pay/disburse mendapat 0 — badge tidak tampil.

```php
// app/Http/Middleware/HandleInertiaRequests.php — getActionCounts()
$fundRequests = 0;
if ($user->can('approve fund requests')) {
    $fundRequests += FundRequest::where('status', 'pending')->count();
}
if ($user->can('disburse fund requests')) {
    $fundRequests += FundRequest::where('status', 'approved')->count();
}
```

### Panduan & video tutorial

- Tombol **Tutorial** di header Ringkasan (`<TutorialButton slug="dashboard" />`, di samping **Buat Invoice**) dan halaman `/panduan/dashboard` membaca `video/dashboard/guide.ts` (peran, cara membaca tiap kartu, asal setiap angka, dampak, peringatan, matriks hak akses) dan `video/dashboard/tutorial.tsx` (komposisi Remotion `DashboardStaff`, `DashboardFinanceManager`, `DashboardAdmin`).
- Isi video: Staff membaca saldo/arus bulan ini, mengatur grafik (periode, rekening, kalender rentang), donat kategori, invoice belum dibayar, rekening, transaksi terbaru, strip Sepanjang waktu; Finance manager memakai tautan lanjut (Lihat pengeluaran, Lihat semua, Semua rekening, Lihat arus kas → Pemasukan, Laporan Laba Rugi) + cara membaca transfer antar rekening (bukan pemasukan/pengeluaran; biaya admin tetap pengeluaran); Admin melihat asal angka (saldo computed = Ringkasan Total di Kas & Bank, transfer antar akun dinetralkan, Sepanjang waktu) dan mengatur izin `view dashboard` (tanpa `view expense` → halaman **Akses ditolak**).
- File: `video/dashboard/{guide.ts, shots.ts, steps.ts, tutorial.tsx, screens/*.webp}`; capture `video/capture/dashboard.js` (hanya membaca, tidak menulis data).
- Screenshot saat ini diambil ulang 9 Nov 2026 (temuan K-02: screenshot lama menampilkan "pindah dana antar rekening" sebagai kategori pemasukan & pengeluaran terbesar) dari data contoh di lingkungan QA terisolasi, lewat Chrome DevTools MCP dengan lokator yang sama dengan `video/capture/dashboard.js`, 1280×720 DPR 1,5.
- Ambil ulang screenshot bila UI/alur berubah: jalankan server QC (`DB_DATABASE=finance_management_qc php artisan serve --port=8017`), `video/capture/dashboard.js` lewat Playwright MCP (`browser_run_code_unsafe`), lalu `python video/capture/to-webp.py dashboard` dan salin koordinat ke `shots.ts`. Catatan: skrip itu masih memakai URL sebelum multi-tenancy (`BASE + '/dashboard'`) dan tanggal kalender Oktober 2026 — sesuaikan ke `/c/{slug}/...` dan tanggal bulan berjalan sebelum menjalankannya. `staff-forbidden` harus diambil dengan `APP_DEBUG=false` (mis. `APP_DEBUG=false DB_DATABASE=finance_management_qc php artisan serve ...`) — dengan debug aktif Laravel menampilkan halaman 403 bawaan berbahasa Inggris, bukan halaman `error` **Akses ditolak** yang dilihat pengguna. Pratinjau: `npm run video`.
- Bila rumus angka (saldo, pemasukan, pengeluaran, invoice tertunda, Sepanjang waktu), tautan lanjut, atau izin `view dashboard` berubah, perbarui `impacts`/`records`/`warnings`/`matrix` di `guide.ts` dan caption di `steps.ts`.

## Keterkaitan Antar Modul

- **Cash Flow** — fallback redirect menuju `cash-flow.expenses`; grafik & stats bulanan bersumber dari `bank_transactions` yang dikelola modul Cash Flow / Bank Accounts.
- **Kas & Bank (Bank Accounts)** — semua angka saldo memakai accessor `balance` computed (`initial_balance + payments credit + tx credit - tx debit`); dashboard tidak pernah membaca saldo tersimpan. Rincian Bank / Kas mengikuti kolom `bank_accounts.type` (lihat `docs/module/bank-accounts.md` › Jenis akun Kas & Bank). Pemasukan/Pengeluaran di Ringkasan Total halaman Kas & Bank memakai aturan transfer yang sama (semua waktu); statistik per akun tidak.
- **Koneksi Claude (MCP)** — `ringkasan-keuangan` bagian `kas` (`uang_masuk`, `uang_keluar`, `arus_bersih`) = kartu Arus Kas, termasuk aturan transfer antar akun sendiri.
- **Invoices & Payments** — overview pendapatan, laba, outstanding, HPP, PP, invoice tertunda.
- **Reimbursements & Fund Requests** — tidak dibaca `DashboardController` lagi; antreannya hanya tampil sebagai badge rel navigasi via shared prop `actionCounts`. Pembayaran reimbursement & pencairan dana tetap masuk angka Pengeluaran karena tercatat sebagai `bank_transactions` debit.
- **Loans & Receivables** — penerimaan pinjaman / cicilan piutang (kredit) dan cicilan pinjaman / piutang yang diberikan (debit) adalah `bank_transactions` berkategori `financing`, jadi ikut angka Pemasukan/Pengeluaran bulan ini, grafik, dan donat (hanya tipe `transfer` yang dinetralkan). Hal yang sama berlaku untuk pendanaan yang dicatat manual dari Arus Kas (setoran modal, prive, setor PPN/titipan pajak); di Arus Kas angka itu kini juga tampil, berpenanda Pendanaan.
- **Permissions** — `view dashboard` adalah permission togglable per role (seed di `MasterPermissionSeeder`); mematikannya mengubah landing user menjadi halaman Pengeluaran.

## Invarian & Jebakan

- **Fallback bukan dinamis** — implementasi nyata me-redirect tetap ke `cash-flow.expenses`, bukan mencari "modul pertama yang boleh diakses user". Jika role juga tidak punya `view expense`, user menabrak 403 di sana (halaman `error` **Akses ditolak**) tepat setelah login, dan tombol **Ke Ringkasan** di halaman itu (`home_url` = `route('dashboard')`) membawanya kembali ke 403 yang sama — pastikan role tanpa dashboard minimal punya `view expense`. Staff bawaan tidak punya `view expense`.
- **Berat secara query** — `getBankAccounts()`/`total_balance` memuat relasi payments+transactions per akun untuk saldo computed, `getByCategory()` dan `getCashFlowChart()` memuat koleksi lalu menjumlahkan di PHP. Tidak ada caching; hati-hati menambah blok baru.
- **Definisi pemasukan harus sama di semua blok** — stats bulan ini, seri grafik semua rekening, dan donat = kredit bank + Payment − transfer antar akun sendiri; `financialOverview.total_income` (sepanjang waktu) hanya Payment. Jangan menambah pemasukan Payment ke `bank_transactions` juga, karena saldo akan dihitung dua kali.
- **Transfer dinetralkan lewat SATU definisi** — `BankTransaction::internalTransferGroups()` / `internalTransferTotal()`; jangan menulis ulang `SUM(CASE …)` sendiri di controller lain. Jebakannya: cukup membuang baris berkategori `transfer` dari kedua sisi ikut membuang **biaya admin** (melekat di kaki debit, `jumlah + biaya admin`), padahal itu beban nyata. Dan menjumlah `Σ debit transfer − Σ kredit transfer` sebagai pengeluaran membuat kaki masuk tanpa lawan menjadi pengeluaran negatif — karena itu kelompoknya per tanggal + tautan, `min(kredit, debit)` per kelompok.
- **Jumlah statistik per akun ≠ angka perusahaan** — bagi satu rekening, transfer adalah uang masuk/keluar (filter rekening di grafik, statistik per akun di Kas & Bank), jadi Pemasukan semua akun yang dijumlahkan lebih besar dari Pemasukan Ringkasan sebesar transfer antar akun. Itu disengaja.
- **Parameter grafik tidak pernah 422** — `DashboardChartRequest` menyaring dan memakai default; jangan mengganti dengan `validated()` tanpa fallback.
- **Semua nominal integer rupiah penuh** — format tampilan di React dengan helper `formatCurrency` / `Intl.NumberFormat('id-ID')`, jangan bagi 100.
- **`total_pp` adalah estimasi 0,5% dibulatkan** (`round`) atas basis item non titipan pajak dari invoice `partially_paid|paid` — bukan angka pajak resmi tercatat.
- **Feed transaksi menggabungkan dua sumber** (`bank_transactions` + `payments`) — pembayaran invoice muncul sebagai income di feed meskipun bukan `BankTransaction`; jangan menjumlahkan feed ini untuk rekonsiliasi.
- Route `/` bukan dashboard — `Route::redirect('/', '/login')`; landing pasca-login diarahkan ke `/dashboard` yang kemudian bisa melempar ke Pengeluaran.

## File Kunci

- `app/Http/Controllers/DashboardController.php` — invokable, seluruh agregasi
- `routes/web.php` — `Route::get('/dashboard', DashboardController::class)->name('dashboard')` (baris ±114)
- `app/Http/Requests/DashboardChartRequest.php` — parameter grafik (periode, rentang, rekening) dengan fallback
- `resources/js/pages/dashboard.tsx` — halaman Ringkasan (grid Obsidian, partial reload grafik)
- `resources/js/components/dashboard/` — `cash-flow-chart.tsx`, `donut-chart.tsx`, `widget.tsx` (kartu, daftar gulir, state kosong/gagal, pil status), `range-calendar.tsx` (kalender periode Arus Kas)
- `app/Http/Middleware/HandleInertiaRequests.php` — shared prop `actionCounts` (badge sidebar) & `auth.permissions`
- `app/Models/BankAccount.php` — accessor `balance` computed yang menjadi dasar semua angka saldo
- `app/Models/BankTransaction.php` — `internalTransferGroups()` / `internalTransferTotal()`: definisi transfer antar akun sendiri untuk angka tingkat perusahaan
- `tests/Feature/DashboardAccessTest.php`, `DashboardTest.php`, `DashboardChartTest.php`, `KasBankTest.php` (rincian Total Bank / Total Kas), `TransferAntarAkunTest.php` (aturan transfer + invarian saldo)
