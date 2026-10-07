# Modul: Dashboard

> Halaman "Ringkasan" (redesign Obsidian, 25 Sep 2026): grid 12 kolom tiga baris tinggi tetap — Arus Kas (saldo, angka bulan ini, grafik periode/rekening) + Periode Arus Kas (kalender rentang tanggal untuk grafik); rincian per kategori bertab Pengeluaran | Pemasukan + Invoice Belum Dibayar; Rekening + Transaksi Terbaru; ditutup strip "Sepanjang waktu" (pendapatan, HPP, laba kotor, estimasi PPh). Route `GET /dashboard` (name `dashboard`), controller **invokable** `DashboardController`, digate permission togglable `view dashboard` — user tanpa permission di-redirect ke halaman Pengeluaran Cash Flow.

## Tabel Database

Dashboard **tidak punya tabel sendiri** — seluruhnya agregasi read-only dari tabel modul lain:

| Tabel | Dipakai untuk |
|-------|---------------|
| `bank_accounts` (+ `payments`, `bank_transactions`) | Total saldo (computed accessor `balance` — TIDAK tersimpan), daftar rekening |
| `bank_transactions` | Pemasukan/pengeluaran bulan ini, grafik cash flow 6 bulan, pengeluaran per kategori, transaksi terbaru |
| `payments` | Total pendapatan sepanjang waktu, pembayaran invoice tertunda, feed transaksi |
| `invoices` + `invoice_items` | Invoice tertunda (`sent`, `partially_paid`, `overdue`), HPP (`cogs_amount`), basis PP (item non `is_tax_deposit`) |
| `reimbursements` | 5 reimbursement terbaru |
| `fund_requests` | 5 pengajuan dana terbaru |

## Fitur

### Akses & Redirect Fallback (`GET /dashboard`)

**Alur step-by-step:**
1. User terautentikasi (grup middleware `auth`, `verified`) membuka `/dashboard` → `DashboardController::__invoke()`.
2. Route **tidak** memakai middleware `can:` — cek permission dilakukan di dalam controller karena butuh fallback redirect, bukan 403.
3. Bila user **tidak** punya permission `view dashboard`, controller me-redirect ke route `cash-flow.expenses` (halaman Pengeluaran) — fallback tetap (hardcoded), bukan pencarian dinamis "modul pertama yang boleh diakses".
4. Bila punya permission, controller merender `Inertia::render('dashboard', [...])` dengan 9 blok props.

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
4. `total_profit` = `total_income - total_hpp`.
5. `total_outstanding` = `max(0, total invoice tertunda - pembayaran atas invoice tertunda)` (status `sent`, `partially_paid`, `overdue`).
6. `total_pp` = 0,5% dari sum amount item invoice terbayar/sebagian yang **bukan** titipan pajak (`is_tax_deposit = false`) — estimasi PPh final UMKM, bukan pajak tercatat.
7. UI (`resources/js/pages/dashboard.tsx`): satu baris hening di bawah grid — Pendapatan, HPP, Laba kotor (hijau/merah mengikuti tanda), Est. PPh final 0,5%, tautan Laporan Laba Rugi (permission `view profit-loss`).

### Stats Bulan Berjalan → hero kartu Arus Kas

1. `getStats($start, $end)` dengan rentang `startOfMonth()`–`endOfMonth()` bulan berjalan.
2. **Invarian pemasukan:** `income_this_month` = `bank_transactions` kredit **+** `payments` dalam rentang, konsisten dengan rumus saldo rekening (`initial_balance + payments + tx credit − tx debit`). `expenses_this_month` = `bank_transactions` debit. `net_this_month` = selisihnya.
3. `pending_invoices_count` / `pending_invoices_amount` = jumlah & sisa tagihan invoice `sent`/`partially_paid`/`overdue`.
4. UI: angka besar 40 px = `total_balance` (stok); di bawahnya tiga figur Pemasukan / Pengeluaran / Arus bersih bulan berjalan (arus). Angka ini **tidak** diulang di kartu lain.

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

**Penjelasan kode:** `getCashFlowChart()` memuat kredit, debit, dan pembayaran dalam rentang bucket dengan **tiga query total** (bukan dua per bucket), lalu menjumlahkan per bucket di PHP agar sama di MySQL dan SQLite. Filter rekening hanya mengubah grafik; saldo total dan angka bulan ini tetap seluruh perusahaan (UI menegaskan dengan "grafik: BCA · Operasional" di bawah saldo). Frontend menyimpan pilihan terakhir di `localStorage` (`dashboard.chart`) dan memulihkannya bila URL tidak membawa `chart_*`. Komponen grafik: `resources/js/components/dashboard/cash-flow-chart.tsx` (SVG/CSS sendiri, tanpa ApexCharts; batang adaptif 6–31 bucket, tooltip hover/fokus, tabel `sr-only`). Gagal memuat → state gagal per widget dengan tombol "Coba lagi".

Tes: `tests/Feature/DashboardChartTest.php` (tiap periode, batas rentang, fallback nilai tidak valid, filter rekening, invarian pemasukan).

### Pengeluaran | Pemasukan per Kategori (donat bertab)

1. `getByCategory('debit'|'credit', $start, $end)` mengisi dua prop: `expensesByCategory` dan `incomeByCategory` — transaksi bank bulan berjalan yang berkategori, group by `category_id`, urut nilai.
2. Pemasukan menambahkan **pembayaran invoice** (`payments` bulan berjalan) sebagai satu kategori "Pembayaran invoice", sehingga total tab Pemasukan = angka Pemasukan di kartu Arus Kas (kredit bank + Payment).
3. Empat terbesar dikirim apa adanya; sisanya digabung menjadi satu irisan "Lainnya" (atau "Tanpa kategori" bila hanya transaksi tanpa kategori) — maksimal **5 irisan** agar legenda berukuran tetap.
4. UI: judul kartu adalah pil tab Pengeluaran | Pemasukan (state lokal, tanpa permintaan server); keadaan kosong & tautan "Lihat pengeluaran/pemasukan" mengikuti tab. Warna **tidak** dikirim server: donat memakai ramp netral satu hue (`donut-chart.tsx`).

### Daftar Rekening Bank

1. `getBankAccounts()` mengembalikan semua rekening (nama, bank, nomor, `balance` computed), urut saldo terbesar.
2. UI: viewport 3 baris (210 px) yang menggulir di dalam kartu; header "3 dari N".

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

## Keterkaitan Antar Modul

- **Cash Flow** — fallback redirect menuju `cash-flow.expenses`; grafik & stats bulanan bersumber dari `bank_transactions` yang dikelola modul Cash Flow / Bank Accounts.
- **Bank Accounts** — semua angka saldo memakai accessor `balance` computed (`initial_balance + payments credit + tx credit - tx debit`); dashboard tidak pernah membaca saldo tersimpan.
- **Invoices & Payments** — overview pendapatan, laba, outstanding, HPP, PP, invoice tertunda.
- **Reimbursements & Fund Requests** — feed 5 terbaru; badge sidebar via shared prop `actionCounts`.
- **Permissions** — `view dashboard` adalah permission togglable per role (seed di `MasterPermissionSeeder`); mematikannya mengubah landing user menjadi halaman Pengeluaran.

## Invarian & Jebakan

- **Fallback bukan dinamis** — implementasi nyata me-redirect tetap ke `cash-flow.expenses`, bukan mencari "modul pertama yang boleh diakses user". Jika role juga tidak punya `view cash flow`, user akan menabrak 403 di sana — pastikan role tanpa dashboard minimal punya akses cash flow.
- **Berat secara query** — `getBankAccounts()`/`total_balance` memuat relasi payments+transactions per akun untuk saldo computed, `getByCategory()` dan `getCashFlowChart()` memuat koleksi lalu menjumlahkan di PHP. Tidak ada caching; hati-hati menambah blok baru.
- **Definisi pemasukan harus sama di semua blok** — stats bulan ini dan seri grafik = kredit bank + Payment; `financialOverview.total_income` (sepanjang waktu) hanya Payment. Jangan menambah pemasukan Payment ke `bank_transactions` juga, karena saldo akan dihitung dua kali.
- **Parameter grafik tidak pernah 422** — `DashboardChartRequest` menyaring dan memakai default; jangan mengganti dengan `validated()` tanpa fallback.
- **Semua nominal integer rupiah penuh** — format tampilan di React dengan helper `formatCurrency` / `Intl.NumberFormat('id-ID')`, jangan bagi 100.
- **`total_pp` adalah estimasi 0,5% dibulatkan** (`round`) atas basis item non titipan pajak dari invoice `partially_paid|paid` — bukan angka pajak resmi tercatat.
- **Feed transaksi menggabungkan dua sumber** (`bank_transactions` + `payments`) — pembayaran invoice muncul sebagai income di feed meskipun bukan `BankTransaction`; jangan menjumlahkan feed ini untuk rekonsiliasi.
- Route `/` bukan dashboard — `Route::redirect('/', '/login')`; landing pasca-login diarahkan ke `/dashboard` yang kemudian bisa melempar ke Pengeluaran.

## File Kunci

- `app/Http/Controllers/DashboardController.php` — invokable, seluruh agregasi
- `routes/web.php` — `Route::get('/dashboard', DashboardController::class)->name('dashboard')` (baris ±106)
- `app/Http/Requests/DashboardChartRequest.php` — parameter grafik (periode, rentang, rekening) dengan fallback
- `resources/js/pages/dashboard.tsx` — halaman Ringkasan (grid Obsidian, partial reload grafik)
- `resources/js/components/dashboard/` — `cash-flow-chart.tsx`, `donut-chart.tsx`, `widget.tsx` (kartu, daftar gulir, state kosong/gagal, pil status), `range-calendar.tsx` (kalender periode Arus Kas)
- `app/Http/Middleware/HandleInertiaRequests.php` — shared prop `actionCounts` (badge sidebar) & `auth.permissions`
- `app/Models/BankAccount.php` — accessor `balance` computed yang menjadi dasar semua angka saldo
- `tests/Feature/DashboardAccessTest.php`, `DashboardTest.php`, `DashboardChartTest.php`
