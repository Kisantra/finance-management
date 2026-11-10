# Modul: Kas & Bank (Bank Accounts)

> Menu **Keuangan › Kas & Bank** (dulu "Rekening Bank"; route, nama route, dan izin tetap `bank-accounts`). Satu tabel `bank_accounts` menampung dua jenis akun: **rekening bank** (`type = bank`) dan **kas tunai / kas kecil** (`type = cash`) dengan penanggung jawab dan plafon — lihat [Jenis akun Kas & Bank](#jenis-akun-kas--bank).
>
> Modul CRUD akun sekaligus pusat monitoring kas per akun: daftar akun dengan saldo terkini, statistik income/expense per periode, chart 12 bulan, breakdown kategori pengeluaran, tab riwayat transaksi & pembayaran invoice, serta export laporan kas PDF. Route prefix utama `/bank-accounts` (halaman single-page Inertia `bank-accounts/index`). Seluruh grup digate `can:view bank-accounts`; mutasi digate granular `can:create|edit|delete bank-accounts`. **Saldo TIDAK PERNAH disimpan di database** — selalu dihitung dinamis dari `initial_balance + payments + transaksi credit − transaksi debit`.

## Tabel Database

### `bank_accounts`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint PK | — |
| `type` | string(10), default `bank` | `bank` = rekening bank, `cash` = kas tunai / kas kecil. Baris lama otomatis `bank` (nilai bawaan migrasi `2026_11_06_113009`) |
| `account_name` | string | Nama pemilik/label rekening, atau nama kas ("Kas Kecil Kantor") |
| `account_number` | string, **unique** (validasi) | Nomor rekening; akun kas tanpa nomor diberi kode `KAS-0001`, `KAS-0002`, … oleh model |
| `bank_name` | string | Nama bank, **teks bebas** (form menyarankan nama dari katalog logo, lihat [Logo bank](#logo-bank--saran-nama-bank)); akun kas tanpa nama bank diisi `Tunai` oleh model |
| `branch` | string, nullable | Cabang (hanya rekening bank; form kas mengosongkannya) |
| `initial_balance` | bigint (cast `integer`) | Saldo awal, rupiah penuh tanpa desimal |
| `custodian_id` | unsignedBigInteger, nullable | Penanggung jawab kas = id pengguna **pusat**, tanpa FK. `null` untuk rekening bank |
| `cash_limit` | bigint, nullable | Plafon kas kecil (rupiah penuh). `null` = tanpa plafon / rekening bank |
| `created_at`/`updated_at` | timestamp | — |

`account_number` dan `bank_name` sengaja tetap **NOT NULL** walau kas tidak membutuhkannya: modul lain (picker rekening, Arus Kas, ekspor, PDF, MCP) menyusun label `nama — bank` dan tidak perlu menangani `null`.

**Tidak ada kolom `balance`.** Saldo adalah accessor (`$appends = ['balance']`) di `app/Models/BankAccount.php`.

Tabel terkait (bukan milik modul ini tapi menjadi sumber saldo):

- `bank_transactions` — `bank_account_id` FK **onDelete cascade** (`database/migrations/2023_01_01_000009_create_bank_transactions_table.php`)
- `payments` — `bank_account_id` FK **onDelete cascade** (`database/migrations/2023_01_01_000008_create_payments_table.php`)
- `loan_payments` — `bank_account_id` FK **tanpa cascade** (restrict) (`database/migrations/2025_11_26_083021_create_loan_payments_table.php`)

## Fitur

### Jenis akun Kas & Bank

Menggantikan kebiasaan "kas palsu" (rekening bank bernama mis. "CASH 0000"). Sengaja ramping: **tanpa izin baru** (semua lewat `view/create/edit/delete bank-accounts`) dan **belum ada opname** (hitung fisik kas).

**Aturan data** (`app/Models/BankAccount.php`):

1. Konstanta `TYPE_BANK = 'bank'`, `TYPE_CASH = 'cash'`, `CASH_BANK_NAME = 'Tunai'`, `CASH_CODE_PREFIX = 'KAS-'`; `$attributes` membuat model baru bertipe `bank`; helper `isCash()`.
2. Listener `saving` di `booted()`: untuk akun kas, `bank_name` kosong → `Tunai`, `account_number` kosong → `generateCashCode()` (melanjutkan kode `KAS-` terbesar yang ada, 4 digit). Berlaku di jalur mana pun (form, factory `cash()`, seeder, tinker). Nomor yang sudah terisi **tidak pernah diganti**.
3. `refillAmount(?int $balance)` = `max(0, cash_limit − saldo)` untuk kas berplafon, 0 selain itu. Saldo yang sudah dihitung boleh dioper agar tidak dihitung dua kali.
4. `BankAccount::custodianNames($akun)` = peta id → nama penanggung jawab lewat `User::whereIn` di database pusat (tanpa join, tanpa relasi Eloquent — konvensi yang sama dengan `created_by`). Id yang penggunanya sudah dihapus ditampilkan "Pengguna dihapus".

**Validasi** (`StoreBankAccountRequest`, `UpdateBankAccountRequest` — pesan berbahasa Indonesia):

- `type` wajib `bank|cash`; bila tidak dikirim (klien lama) `prepareForValidation()` mengisinya `bank`.
- Rekening bank: `account_number` & `bank_name` **wajib** seperti dulu. Kas: keduanya `nullable`. `account_number` tetap unik di semua akun (Update mengabaikan akun sendiri lewat `uniqueAccountNumber()`).
- `custodian_id` & `cash_limit` memakai `exclude_unless:type,cash`: untuk rekening bank keduanya tidak divalidasi dan tidak ikut `validated()`. Untuk kas: `custodian_id` harus **anggota perusahaan aktif** — closure memanggil `User::memberOfCurrentCompany()` (database pusat), bukan rule `exists`; `cash_limit` integer ≥ 0.

**Penyimpanan** (`BankAccountController::accountAttributes()`): kas tanpa nama bank dikirim `null` agar model mengisi `Tunai`; kas tanpa nomor **tidak menimpa** nomor yang tersimpan (kode `KAS-` saat edit, atau nomor lama saat rekening diubah menjadi kas), dan akun kas baru diberi kode oleh model; plafon `0` disimpan `null`; rekening bank selalu `custodian_id = cash_limit = null`.

**Label di modul lain**: tidak ada perubahan di picker Transaksi, Pembayaran invoice, Pengajuan Dana, Reimbursement, Utang, Piutang, Arus Kas — karena `bank_name = Tunai`, kas otomatis terbaca "Kas Kecil Kantor — Tunai (Rp …)" atau "Kas Kecil Kantor (Tunai)". Ringkasan (dashboard) menampilkan "Kas tunai" + tile `KAS` untuk akun kas.

**UI** (`resources/js/pages/bank-accounts/`):

- `account-form-dialog.tsx`: `SegmentedControl` **Jenis** (Bank / Kas). Kas menampilkan **Penanggung Jawab** (`Combobox` dari prop `custodianOptions`) dan **Plafon** (`CurrencyInput`), menyembunyikan nomor rekening, nama bank, dan cabang; kolom tersembunyi dikirim kosong lewat `transform()`. Mengganti Kas → Bank mengosongkan nilai bawaan `Tunai`/`KAS-…` agar diisi data sebenarnya. Penanggung jawab yang sudah bukan anggota tetap tampil sebagai "(bukan anggota lagi)" agar penolakan server bisa dipahami.
- Daftar akun (`account-sidebar.tsx`, desktop & ponsel): logo bank untuk rekening yang banknya dikenali (lihat [Logo bank](#logo-bank--saran-nama-bank)), ikon dompet untuk kas, **Perlu isi ulang Rp …** bila saldo di bawah plafon. **Nama akun selalu utuh** — mendapat baris sendiri dan turun baris, tidak pernah dipotong: pada layar 1280 px dengan menu terbuka teks di daftar desktop hanya ±120 px, dan dulu label Kas di samping nama memotong semua kas menjadi "Kas …" sehingga tidak terbedakan (QA UX-01, 9 Nov 2026). Baris kedua berisi label **Kas** + nama penanggung jawab (rekening bank: nama bank) + ikon tren; di daftar desktop baris ini satu baris dan yang tidak muat dipotong dengan **Tooltip** berisi teks lengkap ("Penanggung jawab: …", juga selalu utuh di header akun terpilih), sedangkan di kartu ponsel (`AccountSubtitle`) teksnya turun baris. Ringkasan Total memuat **Total Bank** dan **Total Kas** di bawah Total Saldo; di ponsel ubinnya dua kolom — Total Saldo selebar baris, lalu Total Bank | Total Kas dan Pemasukan | Pengeluaran — karena tiga kolom memotong angka ("Rp 51.500.…"). Batas yang tersisa: di bawah ±1200 px dengan menu terbuka (mis. 1024 px, kartu daftar ±150 px) nama turun 2–3 baris dan saldo besar bisa melebihi kartu — kondisi itu sudah ada sebelum perbaikan ini; menciutkan menu (pintasan `[`) melebarkan daftar.
- Header akun terpilih: nama, badge **Kas**, dan lencana Naik/Turun dalam satu baris yang boleh turun; subjudul (bank · nomor, atau "Kas tunai · Penanggung jawab: …"), baris "Plafon Rp … · perlu isi ulang Rp …", dan tombol **Isi ulang** (butuh `create transfer`) yang membuka **dialog Transfer yang sama** dengan prop `preset` (tujuan = kas ini, jumlah = plafon − saldo, biaya admin 0, deskripsi "Isi ulang {nama}"). Transaksinya transfer biasa (`POST /bank-transactions/transfer`). Blok judul punya lebar dasar 24rem: bila tombol aksi tidak muat di sebelahnya, tombol turun ke baris bawah alih-alih memotong nama dan penanggung jawab.
- Tombol kelola akun mengikuti izin route-nya (QA UX-02): **Tambah Akun** (header, kondisi kosong, kartu putus-putus di daftar, kartu **Tambah** di ponsel) hanya untuk `create bank-accounts`; **Ubah Rekening/Kas** untuk `edit bank-accounts`; **Hapus Rekening/Kas** untuk `delete bank-accounts`. **Ekspor PDF** hanya butuh `view bank-accounts` (izin halaman ini), jadi menu ••• tidak pernah kosong. Server tetap menolak dengan 403 bila route dipanggil langsung.

Tes: `tests/Feature/KasBankTest.php`.

### Logo bank & saran Nama Bank

Murni tampilan (frontend); tidak ada kolom, endpoint, atau validasi baru. `bank_name` tetap teks bebas dan data lama tidak diubah.

1. **Katalog** `resources/js/lib/banks.ts` → `BANKS`: 40 bank & dompet digital Indonesia (`slug`, `name` yang diisikan saat dipilih, `description` = nama resmi/keterangan, `aliases` = singkatan, nama lama, nama produk). Logonya `public/images/banks/{slug}.svg`.
2. **Pengenalan** `findBank(bankName)`: nama dinormalisasi (huruf kecil, tanda baca & kata "PT"/"Tbk"/"Persero" dibuang), lalu cocok bila salah satu ejaan muncul sebagai **kata utuh**; ejaan terpanjang menang. Jadi "Bank Central Asia", "PT. BCA Tbk", "BCA KCP Sudirman" → BCA, tetapi "BCA Syariah" → BCA Syariah dan "Danamas" tidak terbaca Danamon. Nama yang tidak dikenali (atau "Tunai") → `null`.
3. **Tampilan** `components/shared/bank-logo.tsx` (`BankLogo`): tile putih di kedua tema (logo resmi dirancang untuk latar terang); bila tidak dikenali atau berkas gagal dimuat, merender `fallback`. Di halaman ini dibungkus `AccountAvatar` (`account-sidebar.tsx`): rekening yang banknya dikenali → logo; rekening lain dan **semua akun kas** → ikon gedung/dompet di tile biru seperti sebelumnya. Dipakai di daftar akun desktop (36 px), kartu ponsel (32 px), dan header akun terpilih (48 px).
4. **Form** `account-form-dialog.tsx`: **Nama Bank** memakai `Autocomplete` (`components/ui/autocomplete.tsx`) — saat difokus semua saran tampil (logo + nama + keterangan), mengetik menyaring berdasarkan nama/keterangan/alias ("dki" → Bank Jakarta), panah + Enter atau klik mengisi `name`, Esc hanya menutup daftar. Nama di luar daftar tetap boleh diketik dan tersimpan apa adanya. Ikon di kiri field menampilkan logo nama yang sedang diketik (ikon gedung bila tidak dikenali).

**Berkas logo** diambil dari Wikimedia Commons / Wikipedia (versi terbaru per Nov 2026, mis. BRI 2025, Bank Jago 2026, Danamon 2024, Bank Jakarta 2025) dan, bila tidak ada di sana, dari situs resmi bank (Jenius, ShopeePay, blu, Sinarmas). Semuanya dibersihkan (svgo: tanpa metadata, skrip, atau referensi luar) dan dibuat **persegi**: logo yang lebar dipotong ke simbolnya bila simbol itu sendiri dikenal (CIMB Niaga, Permata, Panin, HSBC, SeaBank, GoPay, ShopeePay, neobank, Superbank, Sinarmas, Muamalat), selebihnya logo utuh dengan ruang napas kecil di viewBox. Sinarmas, Muamalat, KB Bank, dan blu hanya tersedia raster, jadi disematkan sebagai WebP di dalam SVG.

**Menambah bank:** simpan SVG persegi di `public/images/banks/{slug}.svg` (latar transparan, ruang napas sudah di viewBox) lalu tambahkan entri di `BANKS`. Bank tanpa logo layak sengaja tidak masuk katalog (mis. bank bjb, Bank Jateng); penggunanya tetap bisa mengetik namanya.

### Saldo Dinamis (Computed Balance)

Bukan endpoint, tapi fondasi seluruh modul.

**Alur step-by-step:**

1. Kapan pun properti `balance` diakses (serialisasi Inertia, PDF, dsb.), accessor `getBalanceAttribute()` dipanggil.
2. Accessor memilih jalur termurah yang tersedia, berurutan:
   1. **Sudah dihitung di SQL** oleh scope `withBalance()` → kolom `payments_sum`/`credits_sum`/`debits_sum` dipakai langsung, **nol query tambahan**.
   2. Relasi `payments` + `transactions` sudah di-eager-load → sum di memori.
   3. Belum keduanya → **3 query agregat per rekening**. Inilah jalur yang harus dihindari untuk daftar.
3. Rumus: `initial_balance + Σ payments.amount + Σ transaksi credit − Σ transaksi debit`.

**`BankAccount::withBalance()`** menghitung ketiga agregat sebagai subquery skalar dalam SATU statement, berapa pun jumlah rekeningnya. Pakai ini untuk daftar dan total; `with(['transactions','payments'])` tetap tepat bila baris transaksinya memang dibutuhkan (mis. perhitungan tren di `index()`).

> Dulu `DashboardController` memanggil `BankAccount::all()->sum(fn ($a) => $a->balance)` **tiga kali** — `3 × (1 + 3N)` query hanya untuk saldo; pada 5 rekening itu 48 query, pada 10 rekening 93. Sekarang satu memo `rekening()` memakai `withBalance()` → **1 query**. Dikunci `tests/Feature/BankAccountBalanceQueryTest.php` dan pagar regresi `DashboardTest::test_dashboard_tidak_menambah_query_seiring_jumlah_rekening()`.

Kolom bantu `payments_sum`/`credits_sum`/`debits_sum` masuk `$hidden` — internal, tidak ikut terserialisasi ke frontend.

**Penjelasan kode** (`app/Models/BankAccount.php`):

```php
public function getBalanceAttribute(): int
{
    if ($this->relationLoaded('payments') && $this->relationLoaded('transactions')) {
        $payments = $this->payments->sum('amount');
        $credits = $this->transactions->where('transaction_type', 'credit')->sum('amount');
        $debits = $this->transactions->where('transaction_type', 'debit')->sum('amount');
    } else {
        $payments = $this->payments()->sum('amount');
        $credits = $this->transactions()->where('transaction_type', 'credit')->sum('amount');
        $debits = $this->transactions()->where('transaction_type', 'debit')->sum('amount');
    }

    return $this->initial_balance + $payments + $credits - $debits;
}
```

`payments` (pembayaran invoice) selalu bersifat pemasukan (credit); arah transaksi bank ditentukan enum `transaction_type` (`credit`/`debit`). Ada juga accessor tampilan `formatted_balance` (`Rp 1.500.000`) dan helper `BankAccount::parseAmount()` untuk membersihkan string rupiah menjadi integer.

### Halaman Index + Stats + Charts

**Alur step-by-step:**

1. User membuka `/bank-accounts` (opsional query `?account={id}&month=YYYY-MM`).
2. Request `GET /bank-accounts` → route name `bank-accounts.index` → middleware `auth` + `can:view bank-accounts` (`routes/web.php`).
3. `BankAccountController::index()` memuat semua akun dengan `with(['transactions', 'payments'])` supaya accessor `balance` dan kalkulasi trend berjalan di memori.
4. Per akun dihitung `trend` (`up`/`down`) dengan membandingkan total transaksi **credit** bulan ini vs bulan lalu.
5. `overallSummary` (sidebar) dihitung lintas semua akun: `total_balance`, `total_bank` & `total_cash` (rincian per jenis dari koleksi yang sama, `total_bank = total_balance − total_cash`, tanpa query tambahan), `income` (Σ payments + Σ credit − transfer antar akun sendiri), `expense` (Σ debit − transfer antar akun sendiri) via satu `selectRaw SUM(CASE ...)` + `BankTransaction::internalTransferTotal()` (semua waktu). Isi ulang kas dan transfer lain antar akun sendiri **bukan** pemasukan/pengeluaran di Ringkasan Total; biaya admin transfer tetap pengeluaran — aturan yang sama dengan Ringkasan (`docs/module/dashboard.md` › Transfer antar akun sendiri). Statistik per akun di langkah 6 tetap menghitung transfer sebagai uang masuk/keluar akun itu. Tiap akun juga membawa `type`, `custodian_id`, `custodian_name` (satu `whereIn` ke database pusat untuk semua akun), `cash_limit`, `refill_amount`.
6. Jika ada akun terpilih (default: akun pertama), `buildAccountDetail()` menghasilkan: `period` (bulan terpilih atau "semua waktu"), `stats` (total_income/total_expense/net_cashflow/transaction_count), `chart_months` (12 bulan income vs expense), dan `category_breakdown` (top 6 kategori debit untuk donut chart).
7. Respons `Inertia::render('bank-accounts/index', [...])` → halaman React `resources/js/pages/bank-accounts/index.tsx` merender sidebar akun (`account-sidebar.tsx`) + panel detail. Prop `custodianOptions` (anggota perusahaan, `User::memberOfCurrentCompany()`) berupa closure — hanya dihitung saat halaman dimuat penuh, dan kosong bagi pengguna tanpa `create`/`edit bank-accounts`.
8. Ganti akun/bulan di UI memicu `router.get()` partial reload `only: ['detail', 'filters']` (index.tsx baris ~88) — hanya prop detail yang dihitung ulang.

**Penjelasan kode** (`app/Http/Controllers/BankAccountController.php`):

```php
$accounts = BankAccount::with(['transactions', 'payments'])->get();
...
$totalBalance = (int) $accountsData->sum('balance');
$totalCash = (int) $accountsData->where('type', BankAccount::TYPE_CASH)->sum('balance');

// Semua akun: transfer antar akun sendiri bukan pemasukan/pengeluaran, biaya admin tetap.
$pindahAntarAkun = BankTransaction::internalTransferTotal();

$overallSummary = [
    'total_balance' => $totalBalance,
    'total_bank' => $totalBalance - $totalCash,
    'total_cash' => $totalCash,
    'income' => (int) Payment::sum('amount') + (int) ($overallTrxStats->credit_total ?? 0) - $pindahAntarAkun,
    'expense' => (int) ($overallTrxStats->debit_total ?? 0) - $pindahAntarAkun,
];
```

Chart dirender di `resources/js/pages/bank-accounts/components/account-charts.tsx` menggunakan `react-apexcharts`: bar chart income vs expense 12 bulan (`chart_months`) dan donut breakdown kategori pengeluaran (`category_breakdown`). Filter bulan pada chart mengirim ulang query `month` ke controller.

### Create Akun (Rekening / Kas)

**Alur step-by-step:**

1. User klik **Tambah Akun** (hanya tampil bagi pemegang `create bank-accounts`) → dialog `account-form-dialog.tsx`, pilih **Jenis** Bank atau Kas (CurrencyInput untuk saldo awal & plafon; **Nama Bank** = `Autocomplete` dengan saran dari katalog logo, teks bebas tetap diterima).
2. `POST /bank-accounts` payload `{type, account_name, account_number, bank_name, branch?, initial_balance, custodian_id?, cash_limit?}` (kas mengirim nomor/bank/cabang kosong).
3. Middleware `can:create bank-accounts`.
4. Validasi `StoreBankAccountRequest` (`app/Http/Requests/StoreBankAccountRequest.php`): bank → `account_number` & `bank_name` wajib; kas → opsional; `account_number` **unik**; `initial_balance` `integer|min:0`; kas → `custodian_id` anggota perusahaan, `cash_limit` `integer|min:0` (detail di [Jenis akun Kas & Bank](#jenis-akun-kas--bank)).
5. `BankAccount::create($this->accountAttributes(...))` — satu insert (model mengisi `Tunai`/`KAS-0001` untuk kas), tidak ada pencatatan saldo lain.
6. Redirect ke `bank-accounts.index?account={id baru}` dengan flash `success` (`__('pages.account_created_successfully')`).
7. UI: akun baru langsung terpilih di daftar akun.

### Update Akun

**Alur step-by-step:**

1. User klik **Ubah Rekening** / **Ubah Kas** di menu ••• akun (hanya tampil bagi pemegang `edit bank-accounts`) → dialog form terisi data lama. **Jenis** boleh diganti (rekening "kas palsu" → Kas tanpa kehilangan saldo/transaksi; Kas → Bank mewajibkan nomor & nama bank lagi).
2. `PUT /bank-accounts/{bankAccount}` payload sama dengan create.
3. Middleware `can:edit bank-accounts`.
4. Validasi `UpdateBankAccountRequest` — extends Store, hanya rule unique yang mengecualikan akun sendiri:

```php
// app/Http/Requests/UpdateBankAccountRequest.php
protected function uniqueAccountNumber(): Unique
{
    return Rule::unique('bank_accounts', 'account_number')->ignore($this->route('bankAccount'));
}
```

5. `$bankAccount->update($this->accountAttributes(...))` → `redirect()->back()` + flash success. Kas tanpa nomor mempertahankan nomor/kode yang tersimpan.
6. Mengubah `initial_balance` otomatis menggeser saldo terkini karena saldo selalu dihitung ulang.

### Delete Rekening

**Alur step-by-step:**

1. User klik **Hapus Rekening** / **Hapus Kas** di menu ••• (hanya tampil bagi pemegang `delete bank-accounts`), lalu konfirmasi via `ConfirmDialog`.
2. `DELETE /bank-accounts/{bankAccount}` → middleware `can:delete bank-accounts`.
3. `BankAccountController::destroy()` memanggil `$bankAccount->delete()` **tanpa guard tambahan**.
4. Efek DB: `bank_transactions` dan `payments` milik akun ikut terhapus (FK cascade), berantai ke `reimbursement_payments` (FK `bank_transaction_id` cascade); `fund_requests.bank_transaction_id` menjadi `null` (nullOnDelete). Karena terjadi di level DB, event Eloquent tidak jalan: status invoice, `amount_paid`/`payment_status` reimbursement, dan status pengajuan dana **tidak dihitung ulang**, dan file lampiran tertinggal di storage. Jika akun punya `loan_payments`, delete **gagal di level DB** (FK tanpa cascade) dan tidak ditangkap controller (respons error 500).
5. Redirect ke index + flash success.

### Tab Transaksi (JSON) — `GET /bank-accounts/transactions`

Endpoint JSON (bukan Inertia) untuk tab "Transaksi" pada detail akun, dipanggil via `axios`/fetch dari `transactions-tab.tsx`.

**Alur step-by-step:**

1. User membuka tab Transaksi / mengganti filter (search, tipe, kategori, bulan, sort, per_page) → komponen React fetch `GET /bank-accounts/transactions?account={id}&search=&transaction_type=&category_id=&month=YYYY-MM&per_page=15&sort=transaction_date&direction=desc`.
2. Route berada dalam grup `can:view bank-accounts` (route name `bank-accounts.transactions`). Tidak bentrok dengan `/bank-accounts/{bankAccount}` karena route ber-parameter itu hanya `PUT`/`DELETE`.
3. `BankTransactionController::indexTransactions()` — tanpa `account` valid, balas paginator kosong.
4. Query `BankTransaction::with(['category.parent'])` + filter `when(...)`, lalu `paginate($perPage)`.
5. Respons JSON: `data[]` (id, description, transaction_type, transaction_date, amount, reference_number, category{label, parent_label}, `managed_by`, `journal`, attachment_url/name) + meta paginasi (`current_page`, `last_page`, `total`, `from`, `to`). `journal` = jurnal tampilan dari `JournalService::forTransactions()` (nama pihak pokok utang/piutang dan pasangan kaki transfer dicari sekali per halaman; kaki transfer menampilkan jurnal transfer lengkapnya — Debit tujuan + biaya admin / Kredit asal), lihat [cash-flow.md › Jurnal tampilan](cash-flow.md#jurnal-tampilan-cara-a--debitkredit-dari-rekening--kategori).
6. UI merender tabel sendiri (checkbox, ikon tempat sampah per baris yang digate `delete income|expense|transfer` sesuai `featureOf()`) + `Pagination`. Deskripsi tiap baris adalah tombol yang membuka **Rincian** hanya-lihat (`TransactionDetailDialog` dengan `read_only`: jumlah, tanggal, kategori, referensi, deskripsi, lampiran, catatan hanya-lihat untuk pokok, dan kotak **Jurnal**) — satu-satunya tempat jurnal penyesuaian (`adjustment`) dan kaki transfer per rekening terlihat. Mengubah transaksi tetap lewat Arus Kas. Baris berkategori pendanaan berbadge **Pendanaan**; pokok utang/piutang (`managed_by` dari JSON, `BankTransaction::moduleLinks()`) tampil "Hanya-lihat · kelola di Utang/Piutang" tanpa centang & tombol hapus — server juga menolak hapusnya (403). Filter kategori (API tanpa `type`) ikut memuat grup Pendanaan + "Dari Utang & Piutang". Hapus satu/massal memanggil `bank-transactions.destroy` / `bank-transactions.bulk-destroy` lewat axios lalu hanya mengambil ulang daftar tab ini — saldo sidebar & kartu statistik baru diperbarui setelah halaman dimuat ulang. Counter `refreshKey` dinaikkan halaman induk setelah dialog Pemasukan/Pengeluaran/Transfer ditutup (sekaligus `router.reload({ only: ['detail', 'accounts', 'overallSummary'] })`).

**Penjelasan kode** (`app/Http/Controllers/BankTransactionController.php`):

```php
$query = BankTransaction::with(['category.parent'])
    ->where('bank_account_id', $accountId)
    ->when($search, fn ($q) => $q->where(function ($qq) use ($search) {
        $qq->where('description', 'like', "%{$search}%")
            ->orWhere('reference_number', 'like', "%{$search}%");
    }))
    ->when($type, fn ($q) => $q->where('transaction_type', $type))
    ->when($month, fn ($q) => $q
        ->whereYear('transaction_date', substr((string) $month, 0, 4))
        ->whereMonth('transaction_date', substr((string) $month, 5, 2)))
    ->orderBy($sort, $direction);
```

### Tab Pembayaran Invoice (JSON) — `GET /bank-accounts/payments`

**Alur step-by-step:**

1. Tab "Pembayaran" fetch `GET /bank-accounts/payments?account={id}&search=&payment_method=&invoice_status=&month=&per_page=&sort=&direction=`.
2. Grup middleware sama (`can:view bank-accounts`).
3. `BankTransactionController::indexPayments()` melakukan join manual `payments → invoices → clients` untuk menampilkan nomor invoice, status invoice, dan nama klien per pembayaran.
4. Sorting di-whitelist via `match` (`invoice_number`, `client_name`, `amount`, `payment_method`, `payment_date`; default `payments.payment_date`).
5. Respons JSON shape sama seperti tab transaksi, ditambah `invoice_number`, `invoice_status`, `client_name`, `client_type`, dan `journal` (jurnal pembayaran "titipan dulu" dari `JournalService::forPayments()`: dua query per halaman). Nomor invoice tiap baris adalah tombol yang membuka **Detail Pembayaran Invoice** hanya-lihat dengan jurnalnya.

```php
$query = Payment::query()
    ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
    ->join('clients', 'invoices.billed_to_id', '=', 'clients.id')
    ->select(['payments.*', 'invoices.invoice_number',
        'invoices.status as invoice_status', 'clients.name as client_name', ...])
    ->where('payments.bank_account_id', $accountId);
```

Pembayaran invoice **tidak bisa dibuat/dihapus dari modul ini** — dikelola modul Invoices; di sini hanya read-only.

### Catat Pemasukan / Pengeluaran / Transfer dari halaman rekening

Tombol di header rekening terpilih membuka dialog yang memanggil endpoint bersama modul Cash Flow (otorisasi per fitur, bukan `bank-accounts`):

1. **Pengeluaran** / **Pemasukan** (tampil bila `can('create expense')` / `can('create income')`) → `transaction-form-dialog.tsx`; **Rekening** terisi rekening terpilih. Dialog satu kolom (Jumlah → Tanggal | Rekening → Kategori → Jurnal → Deskripsi → Nomor Referensi → Lampiran, lihat [cash-flow.md › Jurnal tampilan](cash-flow.md#jurnal-tampilan-cara-a--debitkredit-dari-rekening--kategori)); di bawah Kategori tampil **Jurnal · Pratinjau** (rekening dari `journal_name` akun — prop `accounts` kini membawanya, `BankAccount::journalNameFor()`: "BCA Operasional — BCA", kas cukup namanya — dan akun lawan dari `journal_account` opsi kategori), lihat [cash-flow.md › Jurnal tampilan](cash-flow.md#jurnal-tampilan-cara-a--debitkredit-dari-rekening--kategori). Daftar **Kategori** dari `GET /api/transaction-categories?type=debit|credit` = kelompok (disabled) + subkategori bertipe expense/income **ditambah adjustment & transfer**, lalu **grup Pendanaan di urutan terakhir** (sub `financing` non-sistem, judul "Pendanaan · tidak masuk Laba Rugi"; memilihnya menampilkan penanda Pendanaan + petunjuk "saldo {rekening} bertambah/berkurang Rp X, Laba Rugi tidak berubah" — lihat [cash-flow.md](cash-flow.md) › Pendanaan). Link **+ Tambah** membuka `QuickAddCategoryDialog` (`POST /transaction-categories`, butuh `manage categories`; kategori baru bertipe income/expense tanpa `pl_group`). Submit `POST /bank-transactions` (`StoreBankTransactionRequest`: `create income|expense` sesuai `transaction_type`; deskripsi wajib, lampiran pdf/jpg/jpeg/png ≤ 5 MB). Sukses → form dikosongkan, dialog tetap terbuka; **Tutup** memicu reload `detail/accounts/overallSummary`.
2. **Transfer** (`can('create transfer')`) → `transfer-dialog.tsx`; kategori dari `?type=transfer`, **Biaya Admin** default 2.500. Pratinjau jurnal: Debit rekening tujuan + **Biaya Admin Transfer** / Kredit rekening sumber. Submit `POST /bank-transactions/transfer` (`TransferBankTransactionRequest`: `create transfer`) → dua `BankTransaction` dalam satu `DB::transaction` dengan `reference_number = 'TRF'.time()`: debit di sumber (`amount + admin_fee`, deskripsi `Transfer + Admin Fee - …`) dan credit di tujuan (`amount`, deskripsi `Transfer masuk - …`), kategori & lampiran sama.
3. Hapus transaksi dari tab Transaksi: referensi berawalan `TRF` → semua transaksi dengan referensi itu ikut dihapus. Edit transaksi tidak tersedia di halaman ini (hanya di halaman Cash Flow); halaman ini hanya punya **Rincian** hanya-lihat dengan jurnalnya.

Detail aturan & efeknya ke Arus Kas / Laba Rugi ada di `docs/module/cash-flow.md`.

### Ekspor PDF Laporan Kas — `GET /bank-account/export/pdf`

**Alur step-by-step:**

1. User klik **Ekspor PDF** di menu `•••` akun terpilih → `window.open('/bank-account/export/pdf?bank_account_id={id}')` — dari halaman ini **hanya** `bank_account_id` yang dikirim (filter bulan halaman tidak ikut), jadi laporannya selalu semua waktu. Endpoint juga menerima `month`, `year`, `start_date`, `end_date` (dipakai halaman Cash Flow lewat `/cash-flow/export/pdf`); `/bank-account/export/pdf/preview` untuk stream inline.
2. Middleware `can:view bank-accounts`.
3. `CashFlowExportController::exportPdf()` menormalkan filter via `parseFilters()` (menerima `start_date`/`end_date` **atau** alias `date_from`/`date_to`, `bank_account_id` tunggal **atau** `bank_accounts` comma-separated).
4. `CashFlowExportService::generatePdf()` membangun data (saldo awal per tanggal mulai, gabungan bank_transactions + payments terurut tanggal, saldo akhir) lalu render Blade `resources/views/pdf/cash-flow-report.blade.php` via DomPDF.
5. Respons: `$pdf->download($filename)` — nama file mengikuti filter, mis. `cash-flow-2026-01-01-to-2026-01-31-account-2.pdf`, `cash-flow-semua-waktu-account-2.pdf` (dari halaman Kas & Bank), atau `cash-flow-semua-waktu.pdf` tanpa filter.

Detail lengkap perilaku export (mode SEMUA WAKTU, chunking DomPDF, limit memori) ada di `docs/module/cash-flow.md` karena controller & service-nya dibagi dengan modul Cash Flow.

### Panduan & video tutorial

1. Tombol **Tutorial** (`<TutorialButton slug="bank-accounts" />`) di header halaman, di samping **Tambah Akun**, membuka video per role; halaman publik `/panduan/bank-accounts` memuat panduan teks yang sama. Staff tidak punya akses modul ini, jadi hanya ada video **Finance manager** dan **Admin**.
2. Isi panduan: `video/bank-accounts/guide.ts` (judul **Kas & Bank**; peran, tugas — termasuk **Menambah kas kecil** dan **Mengisi ulang kas kecil** —, dampak lintas modul, isi transaksi transfer, peringatan — termasuk plafon & penanggung jawab yang hanya informasi —, matriks akses). Screenshot `screens/*.webp` masih tampilan sebelum jenis akun Kas dan sebelum logo bank & saran Nama Bank (belum diambil ulang; langkah "Menambah rekening bank" di `guide.ts` dan caption `steps.ts` sudah menjelaskan saran Nama Bank); caption `steps.ts` hanya diperbarui jalur menunya, dan (9 Nov 2026) caption Ringkasan Total disesuaikan dengan aturan transfer antar akun — angka Pemasukan/Pengeluaran di screenshot `admin-account` masih hasil aturan lama, tetapi gambar itu tidak menampilkan rincian transfer sehingga tidak bertentangan dengan captionnya. Video: `video/bank-accounts/tutorial.tsx` (komposisi `BankAccountsFinanceManager` — mengenal halaman, tambah rekening, pemasukan & pengeluaran, transfer, riwayat; `BankAccountsAdmin` — peran, dampak, isi transaksi transfer, jejak di Arus Kas & Laba Rugi, peringatan, edit & hapus rekening, ringkasan hak akses), langkah walkthrough `steps.ts`, koordinat `shots.ts`, screenshot `screens/*.webp`. Video "Sekilas" = field `overview` di `guide.ts` → `public/videos/panduan/rekening-bank.mp4` (+ poster), sumber `video/launch/bank-accounts.html`.
3. Video Admin menjelaskan dampak: transaksi → saldo → Arus Kas (Pemasukan / Pengeluaran / Transfer & Penyesuaian) → Laba Rugi (per `pl_group`, panel Perlu Diklasifikasi), pasangan transaksi transfer `TRF…`, serta peringatan hapus rekening (cascade `bank_transactions` + `payments` + `reimbursement_payments`, status invoice/reimbursement/pengajuan dana tidak ikut kembali) dan ubah saldo awal.
4. Ambil ulang screenshot bila UI/alur berubah (skrip sudah memakai label baru **Tambah Akun** dan panel **Akun**): jalankan server QC (`DB_DATABASE=finance_management_qc php artisan serve --port=8013`), jalankan `video/capture/bank-accounts.js` lewat Playwright MCP (`browser_run_code_unsafe`), lalu `python video/capture/to-webp.py bank-accounts` dan salin koordinat hasilnya ke `shots.ts`. Skrip membuat rekening "BRI - Proyek Klien" & "Jago - Kas Kecil" beserta transaksinya di DB QC (langkah yang datanya sudah ada dilewati — pada jalankan ulang, `fm-account-new` sudah memperlihatkan saldo setelah transaksi, karena itu caption langkahnya menyebut "contoh ini sudah berisi transaksi"; ambil di DB QC segar agar layar sesuai alur). Jalankan sebelum `video/capture/transaction-categories.js`.
5. **Perubahan UI/alur/hak akses modul ini harus diikuti ambil ulang screenshot + perbarui `guide.ts`/`steps.ts`.** Pratinjau: `npm run video`.
6. Fitur Jurnal (9 Nov 2026): `guide.ts` menjelaskan kotak **Jurnal · Pratinjau** di dialog Pemasukan/Pengeluaran/Transfer dan **Rincian** hanya-lihat (dengan jurnal) di tab Transaksi & Pembayaran. Screenshot dialog modul ini **belum** diambil ulang — set layar ini memang sudah tertinggal (lihat butir 2) dan skrip `bank-accounts.js` bergantung pada data QC lama; ambil ulang seluruhnya sekaligus.

## Keterkaitan Antar Modul

- **Dashboard (Ringkasan)** — kartu Arus Kas menampilkan Total saldo beserta rincian **Bank** / **Kas** (`stats.total_bank`, `stats.total_cash` dari `BankAccount::withBalance()`); kartu Rekening menandai akun kas ("Kas tunai", tile `KAS`). Pemasukan/Pengeluaran Ringkasan dan Ringkasan Total di halaman ini memakai definisi transfer yang sama (`BankTransaction::internalTransferGroups()`/`internalTransferTotal()`). Lihat `docs/module/dashboard.md`.
- **Koneksi Claude (MCP)** — `rekening-bank` mengirim `jenis` (`bank`/`kas`), `total_bank`/`total_kas`, dan untuk kas `penanggung_jawab`, `plafon`, `kurang_dari_plafon`; `ringkasan-keuangan` bagian `kas` memuat `total_bank`/`total_kas` dan `uang_masuk`/`uang_keluar` tanpa transfer antar akun sendiri (biaya admin tetap keluar). Lihat `docs/module/koneksi-claude.md`.
- **Invoices/Payments** — pembayaran invoice menambah saldo rekening (komponen `payments` pada rumus saldo) dan tampil di tab Pembayaran.
- **Cash Flow** — semua transaksi income/expense/transfer dibuat lewat endpoint `bank-transactions.*` (lihat `docs/module/cash-flow.md`) dan langsung memengaruhi saldo.
- **Loans & Receivables** — `LoanController`/`ReceivableController` membuat `BankTransaction` otomatis (pencairan, cicilan, bunga) pada rekening terpilih; `loan_payments` juga ber-FK ke `bank_accounts` (tanpa cascade → rekening yang pernah dipakai membayar pinjaman tidak bisa dihapus).
- **Reimbursements & Fund Requests** — pembayaran reimbursement (`ReimbursementController::pay`) dan pencairan dana (`FundRequestController`, satu transaksi per item) membuat `BankTransaction` debit; ikut tampil di tab Transaksi dan bisa dihapus dari sana tanpa mengembalikan status di modul asal.
- **Transaction Categories** — breakdown donut per kategori join ke `transaction_categories`.
- **Company Profile** — header laporan PDF (`CompanyProfile::current()`).
- Endpoint helper `GET /api/bank-accounts` (`routes/web.php`) menyediakan opsi `{label, value, journal_name}` untuk Combobox lintas modul (label `nama (bank)`, kas → "Kas Kecil (Tunai)"; `journal_name` = nama akun di jurnal, dipakai pratinjau jurnal Catat pembayaran invoice). Route ini (beserta `/api/transaction-categories` & `/api/clients`) berada di grup `/c/{company}` (login + keanggotaan perusahaan) dan masing-masing digate izin lihat modulnya (`/api/bank-accounts`: `can:view bank-accounts`).

## Invarian & Jebakan

- **Akun kas tetap punya `account_number` & `bank_name`.** Jangan mengubah kolom itu menjadi nullable atau menyaring `bank_name = 'Tunai'` untuk mengenali kas — pakai `type`/`isCash()`. Pengisian otomatis ada di listener `saving` model; update massal lewat query builder melewatinya.
- **`custodian_id` = id pengguna pusat tanpa FK** (sama dengan `created_by`): cari namanya lewat `BankAccount::custodianNames()` / `User::whereIn`, jangan join `users` dari database perusahaan. Validasi keanggotaan lewat `User::memberOfCurrentCompany()`, bukan rule `exists`.
- **Plafon & penanggung jawab hanya informasi.** Tidak ada pemblokiran transaksi saat saldo kas melewati/di bawah plafon, dan penanggung jawab tidak membatasi siapa yang mencatat transaksi ke kas. Isi ulang = transfer biasa (masuk Arus Kas › Transfer & Penyesuaian, tidak masuk Laba Rugi, dan bukan pemasukan/pengeluaran di Ringkasan maupun Ringkasan Total — biaya adminnya tetap pengeluaran di sana).
- **Ringkasan Total ≠ jumlah statistik per akun.** Statistik per akun menghitung transfer sebagai uang masuk/keluar akun itu; Ringkasan Total (semua akun) tidak. Jadi Pemasukan semua akun yang dijumlah lebih besar dari Pemasukan Ringkasan Total sebesar transfer antar akun — disengaja (QA K-02, 9 Nov 2026).
- **Total Kas + Total Bank = Total Saldo**; `total_bank` dihitung sebagai selisih supaya jumlahnya selalu cocok.
- **Logo bank hanya hasil tebakan dari `bank_name`.** Jangan mengandalkan `findBank()` untuk logika bisnis (mis. mengenali kas atau mengelompokkan laporan) dan jangan menormalkan `bank_name` yang sudah tersimpan ke nama katalog — teks bebas pengguna tetap sumber kebenaran.
- **Saldo tidak pernah disimpan.** Jangan pernah menambah kolom `balance` atau meng-update saldo secara manual; semua fitur (export, stats, chart) mengandalkan formula yang sama. Saldo salah = periksa `transaction_type` transaksi, bukan tabel akun.
- **Jangan pernah mengakses `balance` massal tanpa salah satu jalur murah.** `$appends = ['balance']` membuat setiap serialisasi memicu 3 sum query bila relasi belum dimuat. Untuk daftar/total pakai `BankAccount::withBalance()` (1 query); pakai `with(['transactions','payments'])` hanya bila baris transaksinya memang diperlukan, seperti perhitungan tren di `index()`.
- **Delete akun = cascade.** Menghapus rekening ikut menghapus seluruh `bank_transactions` dan `payments`-nya (berantai ke `reimbursement_payments`) tanpa konfirmasi tambahan di backend dan tanpa menghitung ulang status invoice/reimbursement/pengajuan dana; sebaliknya gagal dengan error FK (500) bila ada `loan_payments`.
- **Route `/bank-accounts/{bankAccount}` hanya PUT/DELETE.** Karena itu `GET /bank-accounts/transactions` & `/payments` tidak tertangkap binding; bila kelak ditambah `GET /bank-accounts/{bankAccount}`, daftarkan kedua route JSON itu lebih dulu.
- **Trend hanya membandingkan credit transaksi bank** (tanpa payments), bulan ini vs bulan lalu — indikator kasar, bukan net cashflow.
- Semua nominal adalah **integer rupiah penuh**; gunakan `CurrencyInput` di React dan `parseAmount()` di backend.
- Kedua endpoint tab mengembalikan **JSON murni**, bukan respons Inertia — jangan dipanggil dengan `router.visit`.

## File Kunci

| File | Peran |
|------|-------|
| `app/Models/BankAccount.php` | Accessor `balance` (rumus saldo dinamis), relasi transactions/payments/loanPayments, jenis akun (`TYPE_*`, `isCash()`, pengisian `Tunai`/`KAS-xxxx`, `refillAmount()`, `custodianNames()`), nama akun di jurnal (`journalNameFor()`/`journalName()`) |
| `database/migrations/tenant/2026_11_06_113009_add_kas_columns_to_bank_accounts_table.php` | Kolom `type`, `custodian_id`, `cash_limit` |
| `app/Http/Controllers/BankAccountController.php` | Index (stats, chart, breakdown), store, update, destroy |
| `app/Http/Controllers/BankTransactionController.php` | Endpoint JSON `indexTransactions()` & `indexPayments()` untuk tab detail; `store`/`transfer`/`destroy`/`bulkDestroy` dipakai dialog & tab di halaman ini (dibagi dengan Cash Flow) |
| `app/Http/Requests/StoreBankAccountRequest.php` / `UpdateBankAccountRequest.php` | Validasi CRUD akun: jenis, nomor/bank wajib hanya untuk bank, unique account_number, penanggung jawab anggota perusahaan, plafon |
| `app/Http/Controllers/CashFlowExportController.php` + `app/Services/CashFlowExportService.php` | Ekspor PDF laporan kas |
| `resources/views/pdf/cash-flow-report.blade.php` | Template PDF laporan kas |
| `routes/web.php` | Grup route `can:view bank-accounts` + granular create/edit/delete |
| `resources/js/pages/bank-accounts/index.tsx` | Halaman utama (partial reload `only: ['detail', ...]`) |
| `resources/js/lib/banks.ts` + `public/images/banks/*.svg` | Katalog bank & dompet digital (`BANKS`, `findBank()`, `bankLogoUrl()`) dan logonya |
| `resources/js/components/shared/bank-logo.tsx`, `resources/js/components/ui/autocomplete.tsx` | Tile logo bank; field teks bebas dengan saran (Nama Bank) |
| `resources/js/pages/bank-accounts/components/` | `account-sidebar` (+ `AccountTypeIcon`, `AccountAvatar`, `AccountSubtitle`), `account-charts` (ApexCharts), `transactions-tab`, `payments-tab`, `account-form-dialog`, `transaction-form-dialog`, `transfer-dialog` (prop `preset` untuk Isi ulang) |
| `tests/Feature/BankAccountControllerTest.php`, `tests/Feature/KasBankTest.php`, `tests/Feature/TransferAntarAkunTest.php` | Test feature modul ini (KasBankTest: jenis akun, nilai bawaan kas, validasi, total Kas/Bank, MCP; TransferAntarAkunTest: Ringkasan Total tanpa transfer antar akun, statistik per akun tetap dengan transfer) |
