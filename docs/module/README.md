# Dokumentasi Modul — Finance Management

> **Untuk AI agent & developer baru:** folder ini adalah sumber kebenaran naratif per modul.
> Sebelum mengubah sebuah modul, baca file modulnya di sini terlebih dahulu — jangan langsung
> scanning seluruh codebase. Setiap file menjelaskan seluruh fitur modul, cara kerjanya
> step-by-step, dan penjelasan kode mengikuti alur data.
>
> **Aturan pemeliharaan:** jika sebuah perubahan mengubah perilaku modul (alur, status,
> endpoint, aturan bisnis), perbarui dokumen modulnya **di commit yang sama**.

## Daftar Modul

| Dokumen | Cakupan | Route utama |
|---------|---------|-------------|
| [invoices.md](invoices.md) | Invoice, item, diskon, pembayaran, PDF/Excel | `/invoices`, `/payments`, `/invoice/{id}` |
| [recurring-invoices.md](recurring-invoices.md) | Template recurring, generate bulanan, publish | `/recurring-invoices` |
| [clients.md](clients.md) | Master data klien (individu/perusahaan, NPWP) | `/clients` |
| [services.md](services.md) | Master data layanan | `/services` |
| [bank-accounts.md](bank-accounts.md) | Kas & Bank: rekening bank + kas tunai/kas kecil (penanggung jawab, plafon, isi ulang), logo bank & saran Nama Bank, saldo terhitung, transaksi | `/bank-accounts` |
| [cash-flow.md](cash-flow.md) | Pemasukan & Pengeluaran (tab Semua/Pemasukan/Pengeluaran, filter Diinput oleh, ekspor Excel), Transfer, export PDF | `/cash-flow/*` |
| [transaction-categories.md](transaction-categories.md) | Kategori hierarkis, pl_group, reassign-delete, Pakai Template (template 15 induk/59 sub: pemasukan & pengeluaran bergrup L/R + bagian Pendanaan — juga isi awal perusahaan baru) | `/transaction-categories` |
| [fund-requests.md](fund-requests.md) | Permintaan dana: workflow + pencairan | `/fund-requests` |
| [reimbursements.md](reimbursements.md) | Reimbursement: workflow + pembayaran parsial | `/reimbursements` |
| [loans.md](loans.md) | Utang perusahaan + pembayaran pokok/bunga | `/loans` |
| [receivables.md](receivables.md) | Piutang (debtor polimorfik User/Client) | `/receivables` |
| [profit-loss.md](profit-loss.md) | Laporan Laba Rugi (basis kas, pl_group) | `/reports/profit-loss` |
| [dashboard.md](dashboard.md) | Dashboard & redirect fallback permission | `/dashboard` |
| [notifications.md](notifications.md) | Notifikasi in-app (bell + drawer) | `/notifications` |
| [feedbacks.md](feedbacks.md) | Feedback/bug report internal; laporan Bug diteruskan ke Watchpost | `/feedbacks` |
| [admin-users-permissions.md](admin-users-permissions.md) | User, role, permission (Spatie) | `/admin/*` |
| [settings.md](settings.md) | Profil, password, company, PDF template builder | `/settings/*` |
| [koneksi-claude.md](koneksi-claude.md) | Koneksi Claude (MCP, hanya baca) + OAuth Passport | `/mcp/keuangan`, `/oauth/*`, `/settings/claude` |

## Peta Alur Data Lintas Modul

Semua uang bermuara di dua tabel: `payments` (pembayaran invoice) dan `bank_transactions`
(semua mutasi kas lain). Saldo rekening **tidak pernah disimpan** — selalu dihitung:

```
saldo = initial_balance + Σ payments + Σ transaksi credit − Σ transaksi debit
```

Alur yang menghasilkan mutasi kas:

```
Invoice ──(payment)──────────────────────────► payments ─────────┐
Fund Request ──(disburse, 1 debit per item)──► bank_transactions │
Reimbursement ──(pay, per pembayaran)────────► bank_transactions ├──► Saldo Kas & Bank
Loan ──(create: credit FIN-LOAN-IN)──────────► bank_transactions │    (computed)
     ──(pay: debit FIN-LOAN-OUT+EXP-INTEREST)► bank_transactions │
Receivable ──(cair: debit FIN-RCV-OUT)───────► bank_transactions │
           ──(cicilan: credit FIN-RCV-IN)────► bank_transactions ┘
Cash Flow (input manual income/expense/transfer)──► bank_transactions
```

Laporan Laba Rugi membaca `payments` (pendapatan) + `bank_transactions` yang kategorinya
punya `pl_group` (revenue/other_income/cogs/opex/other_expense/tax) — lihat
[profit-loss.md](profit-loss.md) dan dokumen kebijakan `docs/design/laba-rugi.md`.

## Konvensi Lintas Modul

- **Pencatat uang masuk/keluar**: `bank_transactions` dan `payments` punya `created_by`/`updated_by` (id pengguna PUSAT, tanpa FK) yang diisi trait `App\Models\Concerns\MencatatPengguna` dari pengguna login. Update massal lewat query builder tidak memicu trait itu: isi `updated_by` sendiri (contoh: kaki lawan transfer, pemindahan kategori saat hapus kategori). Nama pengguna dicari di pusat lewat `whereIn`, jangan join dari database perusahaan.
- **Jenis akun Kas & Bank**: `bank_accounts.type` = `bank` (rekening) atau `cash` (kas tunai/kas kecil). Akun kas tetap punya `account_number` (kode `KAS-0001`, diisi model) dan `bank_name` `Tunai`, sehingga picker & label `nama — bank` di modul lain tidak perlu diubah; kenali kas lewat `type`/`isCash()`, bukan lewat nama bank. `custodian_id` (penanggung jawab) juga id pengguna PUSAT tanpa FK: nama lewat `BankAccount::custodianNames()` (`whereIn`), keanggotaan lewat `User::memberOfCurrentCompany()`. Total saldo di mana pun dirinci Total Bank + Total Kas memakai `withBalance()`. Detail di [bank-accounts.md](bank-accounts.md).
- **Currency**: semua nominal disimpan `bigint` rupiah penuh (150000 = Rp 150.000), tanpa desimal.
- **Permission**: Spatie Permission; gate di route (`can:...`), FormRequest, dan UI (`useCan`).
  Struktur lengkap: `database/seeders/MasterPermissionSeeder.php`.
- **Frontend**: Inertia + React; controller mengirim props, halaman di `resources/js/pages/<modul>/`.
  Komponen wajib pakai katalog di CLAUDE.md (Combobox, DatePicker, CurrencyInput, FileUpload, dll.).
- **Workflow status**: state machine hidup di model (`canSubmit()`, `approve()`, dst.), bukan controller.
- **Kategori sistem Loans/Receivables** (bug `code` SUDAH DIPERBAIKI 2026-08-11): kategori sistem
  kini diidentifikasi lewat kolom `system_key` (`FIN-LOAN-IN` dst.) via
  `TransactionCategory::findSystem()`; kategori ber-`system_key` tidak bisa diedit/dihapus dari UI.
  Detail di [transaction-categories.md](transaction-categories.md), [loans.md](loans.md),
  [receivables.md](receivables.md).
- **Multi-tenancy (Tahap 1–2 selesai)**: satu database per perusahaan (stancl/tenancy v3).
  Semua route aplikasi ber-prefix **`/c/{company}`** (slug); migration bisnis di
  `database/migrations/tenant/` (jalankan `tenants:migrate`, bukan `migrate`); Spatie teams
  (`company_id` string) dengan role global + assignment per perusahaan; model central
  (User/Role/Permission/Organization/AppNotification/Feedback) memakai trait `CentralConnection`;
  session/cache/queue di koneksi central. **Berkas** (lampiran, logo, ttd, stempel)
  disimpan per perusahaan di `storage/tenant{slug}/app/public` dan dilayani route
  `/c/{company}/storage/{path}` (`TenantStorageController`) — bukan symlink
  `public/storage`; URL-nya di-set oleh `SetCompanyUrlDefaults` sehingga
  `Storage::url()` otomatis benar. Konsekuensi keamanan: berkas hanya bisa diambil
  anggota perusahaan tersebut (dulu symlink melayani siapa pun tanpa login).
  Frontend: literal path WAJIB lewat `companyUrl()`
  (`@/lib/company`), pencocokan URL aktif lewat `appPath()`. Test: 1 database, URL auto-prefix
  di `tests/TestCase.php`. Rencana & status: `docs/multi-tenancy-runbook-eksekusi.md`.

- **Kategori sistem Loans/Receivables** (diperbaiki 2026-09-17): kategori sistem diidentifikasi
  lewat kolom `system_key` (`FIN-LOAN-IN`, `FIN-LOAN-OUT`, `FIN-RCV-OUT`, `FIN-RCV-IN`,
  `EXP-INTEREST`, `REV-INTEREST`) via `TransactionCategory::findSystem()`. Kolom `code` sudah
  di-drop sejak migration 2026_02_05; lookup lama melempar `Unknown column 'code'` di MySQL dan
  menjatuhkan create/pay loan serta approve/pay receivable. `system_key` di luar `$fillable`
  supaya tidak bisa diklaim lewat form. Detail di [loans.md](loans.md) / [receivables.md](receivables.md).
- **⚠ SQLite menutupi kesalahan kolom**: suite memakai SQLite in-memory (`phpunit.xml`), yang
  mem-fallback identifier tak dikenal menjadi string literal — query ke kolom yang tidak ada
  mengembalikan `null` diam-diam alih-alih error, persis yang membuat bug `code` lolos berbulan-bulan.
  Tes yang menyentuh kolom harus memeriksa **data yang terbentuk**, bukan sekadar status HTTP.
- **Halaman error**: setiap respons HTTP ≥ 400 untuk request halaman (bukan JSON) dirender sebagai
  halaman Inertia `error` oleh `App\Services\ErrorReportService`, dipasang lewat
  `$exceptions->respond()` di `bootstrap/app.php` — **bukan** `render()`: Handler Laravel mengubah
  `TokenMismatchException` menjadi `HttpException(419)` sebelum callback render dicocokkan, sehingga
  callback bertipe `TokenMismatchException` tidak pernah terpicu. Aturannya:
  - Aktif hanya saat `APP_DEBUG=false`; developer tetap mendapat halaman error Laravel lengkap.
    Untuk melihat halaman custom di lokal tanpa mematikan debug: `ERROR_PAGE_IN_DEBUG=true`.
    Catatan: saat `APP_DEBUG=true` tanpa saklar itu, error HTTP (404/403/419/...) tetap memakai
    view `errors/*` Blade — jadi yang tampil halaman cadangan, bukan halaman Inertia.
  - Setiap error diberi ID `ERR-XXXXXXXXXX` yang sama dengan `error_id` di `storage/logs/laravel.log`.
  - Detail teknis (exception, pesan, jejak kode aplikasi) hanya untuk role `admin` dan hanya 5xx —
    pesan exception bisa memuat SQL beserta datanya.
  - 419 pada `logout` langsung diarahkan ke login (sesinya memang sudah habis).
  - `Route::fallback()` di akhir `routes/web.php` wajib dipertahankan: tanpa itu URL tak dikenal gagal
    sebelum middleware `web`, dan pengguna yang login tampil sebagai tamu di halaman error.
  - Tombol logout wajib lewat klien Inertia (`router.post('/logout')`), bukan `<form>` dengan token dari
    `<meta>`: meta dirender sekali saat halaman pertama dimuat dan basi begitu sesi berganti.
  - Multi-tenancy: tombol "Laporkan ke Tim IT" dan tautan Dashboard hanya muncul bila tenancy sudah
    ter-inisialisasi (error di dalam `/c/{company}` setelah cek keanggotaan). Di luar itu — mis. 419,
    `/choose-company`, atau slug tak dikenal — tautan kembali ke `/choose-company`, tanpa tombol laporan.
    Tenancy ter-inisialisasi **tidak** berarti keanggotaan sudah dicek; keamanannya datang dari izin
    Spatie yang per tim. Pada 404 route model binding, `SubstituteBindings` gagal sebelum
    `SetPermissionsTeam` mana pun, sehingga tim masih `null` — `ErrorReportService` memasang tim
    perusahaan yang dibuka selama pengecekan izin lalu mengembalikannya. Jangan menulis ke
    `storage_path()` dari penanganan error: di dalam tenancy path itu diarahkan ke folder tenant.
  - Uji: `tests/Feature/ErrorPageTest.php`.

  - **Lapisan cadangan** (`resources/views/errors/*.blade.php`): dipakai ketika halaman Inertia
    sendiri gagal dirender (database mati, manifest Vite hilang). Berkas itu HARAM menyentuh
    database, session, auth, atau Vite — semuanya bisa jadi penyebab error yang sedang
    ditampilkan. `ViewServiceProvider` melewati view `errors.*` dan menelan kegagalan query
    profil perusahaan; tanpa itu halaman error ikut jatuh dan Laravel menampilkan halaman
    Symfony polos (kejadian 2026-09-17).
  - Uji: `tests/Feature/ErrorPageTest.php`, `tests/Feature/HalamanErrorCadanganTest.php`.
- **Test = spesifikasi**: aturan bisnis paling akurat ada di `tests/Feature/` per modul.
