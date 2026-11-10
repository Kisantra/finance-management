# CLAUDE.md

Panduan untuk Claude Code saat bekerja di repository ini.

## Project Overview

**Finance Management System** — Laravel 12 + **Inertia.js + React 18 + shadcn/ui**. Konteks bisnis Indonesia (NPWP/PKP, Terbilang, Rupiah).

Stack frontend **sepenuhnya React/Inertia** — migrasi dari Livewire + TallStackUI sudah selesai. Tidak ada lagi komponen Livewire atau view Blade untuk halaman aplikasi (Blade hanya dipakai untuk template PDF). Jangan menulis kode Livewire/TallStackUI/Alpine baru.

**Fitur:** Invoice & Pembayaran, Recurring Invoice, Reimbursement, Bank Account & Transaksi, Cash Flow, Loans & Receivables, Multi-role Permission, PDF Generation, Notifications, Feedback System, Multi-language (id/en/zh), Excel Export.

## Dokumentasi Modul (WAJIB DIBACA)

**CRITICAL: Sebelum mengerjakan atau memodifikasi sebuah modul, WAJIB baca dokumentasi modulnya di [`docs/module/`](docs/module/README.md).** Folder itu berisi satu file per modul yang menjelaskan seluruh fitur, cara kerja step-by-step, penjelasan kode mengikuti alur data, keterkaitan antar modul, dan invarian yang tidak boleh dilanggar — mulai dari `docs/module/README.md` (indeks + peta alur data lintas modul). Jangan scanning seluruh codebase untuk memahami sebuah modul; dokumen itu pintu masuknya.

**Aturan pemeliharaan:** perubahan yang mengubah perilaku modul (alur, status, endpoint, aturan bisnis) WAJIB memperbarui dokumen modulnya di commit yang sama.

## Panduan Pengguna & Video Tutorial (`/panduan`)

Panduan untuk pengguna (bukan dokumentasi teknis) ada di `video/<slug>/` — satu folder per modul, ditemukan otomatis oleh halaman `/panduan`, tombol `<TutorialButton slug>` di header modul, dan Remotion Studio:
- `guide.ts` — isi panduan (`ModuleGuide`, skema di `video/guide.ts`): peran, alur, langkah per tugas, **dampak ke modul lain / data otomatis / perhatian** (khusus admin). Sumber yang sama dipakai teks halaman dan adegan video.
- `shots.ts` + `screens/*.webp` (screenshot QC, diambil `video/capture/<slug>.js` lalu `python video/capture/to-webp.py <slug>`), `steps.ts` (walkthrough), `tutorial.tsx` (`TUTORIALS` per role).

**Akses:** `/panduan` **selalu publik** (di luar grup `auth`) agar calon pengguna bisa belajar sebelum punya akun — **juga saat sudah login**: halaman ini tidak pernah memakai `AppLayout`, melainkan kerangkanya sendiri (`pages/guide/components/shell.tsx`), dan semua orang melihat semua modul, semua peran, dan semua bagian (bedanya hanya tombol kanan: "Masuk" / "Buka aplikasi"). Penyaringan per peran ada di lensa "Baca sebagai" (`?peran=staff|fm|admin`). Dialog Tutorial di dalam aplikasi tetap menyaring tab sesuai peran (`components/tutorial/access.ts`). Karena publik, screenshot & contoh di panduan WAJIB memakai data contoh (DB QC), jangan data perusahaan asli. Video "Sekilas" per modul = field `overview` di `guide.ts` (MP4 di `public/videos/panduan/`).

**Aturan pemeliharaan:** perubahan perilaku/label/hak akses modul WAJIB juga memperbarui `video/<slug>/guide.ts` (dan screenshot/steps bila tampilan berubah) — kalau tidak, panduan & video mengajarkan hal yang salah. Folder bernama `video/` (bukan `remotion/`) agar tidak bentrok dengan paket npm `remotion`.

## Common Commands

```bash
composer dev                           # Start all servers (artisan + queue + vite)
./deploy.sh                            # Deploy di server (VPS) — lihat docs/guides/DEPLOY.md
php artisan migrate:fresh --seed       # Fresh migration + seeders
php artisan test                       # Run tests
./vendor/bin/pint                      # Format code
php artisan pail                       # View logs real-time
npm run build                          # Build for production
npm run i18n:check                     # Pemindai multi bahasa (teks tanpa t(), kunci kamus en/zh) — wajib 0 galat
npm run video                          # Remotion Studio (video tutorial, folder video/)
npm run video:render -- <Id> out/x.mp4 # Render video, mis. ReimbursementStaff
```

---

## Architecture

**Inertia + React 18** — controller Laravel mengembalikan `Inertia::render()` dengan props; halaman React menerimanya.

| Path | Isi |
|------|-----|
| `resources/js/pages/` | Halaman React (per module) |
| `resources/js/components/ui/` | Komponen UI primitif (shadcn/ui + custom) |
| `resources/js/components/shared/` | Komponen shared (PageHeader, DataTable, dll.) |
| `resources/js/types/` | TypeScript types |
| `resources/js/routes/` | Wayfinder generated type-safe routes |
| `app/Http/Controllers/` | Inertia controllers |

### Currency Storage (integer)

Mata uang disimpan sebagai **integer** di DB (rupiah penuh, tanpa desimal).

```
DB: 150000 → Display: Rp 150.000
```

Di React, gunakan komponen `CurrencyInput` (lihat React Component Catalog) yang menangani parse/format otomatis dan menyimpan raw integer.

---

## UI/UX Design System

**CRITICAL: Semua page baru atau redesign HARUS mengikuti design system ini untuk konsistensi.**

**Satu-satunya sumber kebenaran:** `.claude/design-systems/archipelago.md` — **baca file ini terlebih dahulu** sebelum membuat atau memodifikasi UI apa pun. Design system yang **aktif adalah Obsidian** (bagian akhir file itu: token `ob-*` sinkron dengan `resources/css/app.css`, aturan bentuk, dan gaya tiap komponen katalog). Bagian Archipelago di awal file hanya warisan untuk halaman yang belum dimigrasi; jangan dipakai di kode baru. Jangan menyalin nilai token ke dokumen lain; rujuk file itu.

---

## React Component Catalog

**CRITICAL: Semua halaman React WAJIB menggunakan komponen yang ada sebelum menulis raw HTML/JSX. Jangan pernah menulis `<select>`, `<input type="date">`, `<input>` biasa, atau pola UI lainnya secara manual jika sudah ada komponen yang tersedia.**

Semua komponen sudah bergaya **Obsidian** sebagai bawaan (spesifikasi per komponen: `archipelago.md` › Obsidian › "Komponen katalog — gaya bawaan Obsidian"); halaman cukup memakainya apa adanya. Token yang berlaku:
- `ob-page` / `ob-card` / `ob-inner` / `ob-chip` / `ob-hover` — permukaan berlapis (halaman → kartu → isi kartu → chip/tile → hover)
- `ob-ink` / `ob-ink-2` / `ob-ink-3` — teks utama / sekunder / paling redup
- `ob-line` / `ob-line-soft` / `ob-line-strong` — tepi 1 px
- `ob-act-fill` — tombol primer & cincin fokus; `ob-pos` · `ob-neg` · `ob-wait` · `ob-late` · `ob-act` — nada status (satu hue satu makna)
- Radius: kartu `rounded-3xl`, kartu-dalam `rounded-2xl`, kontrol `rounded-xl`, tombol & chip `rounded-full`
- Tanpa awalan `dark:` — variabel `--ob-*` berganti sendiri per tema

### Komponen UI Primitif (`@/components/ui/`)

| Komponen | Import | Menggantikan | Keterangan |
|----------|--------|-------------|------------|
| `Button` | `@/components/ui/button` | `<button>` manual | Variants: `primary`, `zinc`, `red`, `green`, `yellow`, `blue`, `outline`, `ghost`, `link`. Sizes: `sm`, `md`, `lg`, `xl`, `icon`. |
| `Badge` | `@/components/ui/badge` | Status tag manual | Variants: `default`, `blue`, `green`, `emerald`, `yellow`, `orange`, `red`, `purple`, `zinc`, `outline`. |
| `Input` | `@/components/ui/input` | `<input>` biasa | Props: `label`, `hint`, `error`, `icon`, `iconRight`. |
| `Textarea` | `@/components/ui/textarea` | `<textarea>` biasa | Props: `label`, `hint`, `error`. |
| `Checkbox` | `@/components/ui/checkbox` | `<input type="checkbox">` | Tercentang `ob-act-fill`. |
| `Switch` | `@/components/ui/switch` | Toggle HTML manual | Aktif `ob-act-fill`, mati `ob-chip`. |
| `ColorInput` | `@/components/ui/color-input` | **`<input type="color">` + hex text manual — WAJIB** | Swatch + hex field combo. Props: `value`, `onChange`, `label`, `error`. Stores lowercase hex string. |
| `Slider` | `@/components/ui/slider` | **`<input type="range">` manual — WAJIB** | Styled range with optional suffix label. Props: `value`, `onChange`, `min`, `max`, `step`, `label`, `suffix`, `disabled`. |
| `SegmentedControl` | `@/components/ui/segmented-control` | **Tombol pilihan segmented/radio manual** | Pilihan eksklusif berbentuk grup tombol (mis. tipe/prioritas/status). Props: `options` (`{value,label,icon?,activeClassName?}`), `value`, `onChange`, `columns`, `layout` (`stack`\|`inline`), `label`, `error`. Generic atas tipe value. |
| `Label` | `@/components/ui/label` | `<label>` manual | 13 px `text-ob-ink-2`. |
| `Combobox` | `@/components/ui/combobox` | **`<select>` — WAJIB** | Searchable dropdown via `cmdk`. Props: `options`, `value`, `onChange`, `placeholder`, `searchPlaceholder`, `emptyText`. Opsi: `disabled` = judul grup; `section`/`sectionIcon` = judul bagian bergaris (tetap tampil saat mencari); `tag`/`tagIcon` = penanda di pemicu saat terpilih. |
| `Autocomplete` | `@/components/ui/autocomplete` | **`<input>` + `<datalist>` / saran manual** | Teks bebas dengan daftar saran (nilai tidak wajib salah satu opsi — beda dengan `Combobox`). Props: `value` (string), `onChange`, `options` (`{value,label?,description?,icon?,keywords?}`), `icon` (slot kiri 24 px), `label`, `hint`, `error`. Panah/Enter/Esc; Enter tanpa saran tersorot tetap mengirim form. |
| `DatePicker` | `@/components/ui/date-picker` | **`<input type="date">` — WAJIB** | Indonesian locale, hari terpilih `ob-act-fill`, react-day-picker v10. Single: `value`, `onChange`. Range: tambah `mode="range"`, `value={from,to}`, `placeholderTo`. |
| `Dialog` | `@/components/ui/dialog` | Modal HTML manual | Sizes: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `full`. Exports: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`. |
| `Card` | `@/components/ui/card` | Div wrapper manual | `bg-ob-card`, `rounded-3xl`, tepi `ob-line`, tanpa bayangan. Exports: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `CardFooter`. |
| `Tabs` | `@/components/ui/tabs` | Tab custom HTML | Pill/segment style. Props: `items`, `value`, `onChange`. Export `TabsPanel` untuk content. |
| `Popover` | `@/components/ui/popover` | Tooltip/flyout manual | Panel melayang `bg-ob-card`, `rounded-2xl`. Exports: `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`. |
| `DropdownMenu` | `@/components/ui/dropdown-menu` | Dropdown manual | Panel `bg-ob-card`, hover `ob-hover`. Exports: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, dll. |
| `Tooltip` | `@/components/ui/tooltip` | `title=` attribute | Exports: `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`. |
| `Avatar` | `@/components/ui/avatar` | Initials div manual | Fallback `bg-ob-chip`. Exports: `Avatar`, `AvatarImage`, `AvatarFallback`. |
| `Skeleton` | `@/components/ui/skeleton` | Loading state manual | `bg-ob-chip` animate-pulse, berbentuk baris. |
| `ScrollArea` | `@/components/ui/scroll-area` | `overflow-y-auto` manual | Thumb `ob-line-strong`. Exports: `ScrollArea`, `ScrollBar`. |
| `Separator` | `@/components/ui/separator` | `<hr>` / border manual | `ob-line`. Horizontal dan vertical. |

### Komponen Shared (`@/components/shared/`)

| Komponen | Import | Keterangan |
|----------|--------|------------|
| `PageHeader` | `@/components/shared/page-header` | Header halaman: judul 26/600 tanpa gradient. Props: `title`, `description`, `action`. WAJIB di semua halaman utama. |
| `StatsCard` | `@/components/shared/stats-card` | Stats card horizontal. Props: `label`, `value`, `icon`, `color` (`blue`\|`green`\|`purple`\|`red`\|`emerald`\|`yellow`\|`orange`\|`indigo` — mewarnai ikon saja, ungu & indigo jadi netral), `inModal` (boolean), `hint` (keterangan kecil di bawah angka). |
| `FormSection` | `@/components/shared/form-section` | Section header dalam form. Props: `title`, `description`. |
| `DataTable` | `@/components/shared/data-table` | Tabel data dengan sorting. Props: `columns`, `data`, `loading`, `emptyState`. Berbasis `@tanstack/react-table`. |
| `Pagination` | `@/components/shared/pagination` | Pagination navigasi. Props: `currentPage`, `lastPage`, `perPage`, `total`, `onPageChange`. |
| `EmptyState` | `@/components/shared/empty-state` | State kosong. Props: `icon`, `title`, `description`, `action`. |
| `ConfirmDialog` | `@/components/shared/confirm-dialog` | Dialog konfirmasi. Props: `open`, `onOpenChange`, `onConfirm`, `title`, `description`, `variant` (`danger`\|`warning`). |
| `CurrencyInput` | `@/components/shared/currency-input` | **Input Rupiah — WAJIB untuk semua input mata uang.** Props: `value`, `onChange`, `label`, `hint`, `error`. Format integer, display `Rp 1.500.000`. |
| `FinancingBadge`, `FinancingHint`, `ManagedByNote`, `withFinancingGroup()` | `@/components/shared/financing` | **Penanda Pendanaan — WAJIB di mana pun kategori `financing` tampil/dipilih.** Badge `outline` + `Landmark`; petunjuk "saldo … bertambah/berkurang, Laba Rugi tidak berubah"; catatan hanya-lihat "kelola di Utang/Piutang"; opsi kategori server → Combobox dengan bagian "Pendanaan · tidak masuk Laba Rugi". |
| `JournalBox` | `@/components/shared/journal-box` | **Kotak Jurnal (debit/kredit) — WAJIB di mana pun jurnal transaksi/pembayaran tampil.** Props: `lines` (`JournalLine[]` dari `@/lib/journal`; null/kosong → `placeholder`), `mode` (`saved` = dari server \| `preview` = berpenanda "Pratinjau"), `placeholder`, `caption` (bawaan "Jurnal otomatis dari rekening & kategori · belum buku besar"). Jurnal tersimpan WAJIB dari server (`JournalService`); pratinjau formulir lewat cermin di `@/lib/journal` (`cashJournal`, `transferJournal`, `paymentJournal`). |
| `FileUpload` | `@/components/shared/file-upload` | **Upload file/gambar — WAJIB, bukan `<input type="file">`.** Berbasis react-dropzone. Props: `value` (File|null), `onChange`, `label`, `hint`, `error`, `accept` (array ekstensi). Single file. |
| `BankLogo` | `@/components/shared/bank-logo` | Logo bank di tile putih dari nama bank bebas (katalog `@/lib/banks`: `BANKS`, `findBank()`; berkas `public/images/banks/{slug}.svg`). Props: `bankName`, `className` (ukuran & radius), `fallback` (bila tidak dikenali). |

### Quick Decision: "Mana yang harus saya pakai?"

```
Input teks/angka biasa            → Input
Input Rupiah/currency             → CurrencyInput       ← JANGAN input biasa
Pilihan dari daftar (select)      → Combobox            ← JANGAN <select> HTML
Teks bebas + saran dari daftar    → Autocomplete        ← bila nilai di luar daftar boleh
Logo bank dari nama bank          → BankLogo
Pilihan tanggal (single)          → DatePicker          ← JANGAN <input type="date">
Pilihan rentang tanggal           → DatePicker mode="range"
Toggle on/off                     → Switch
Pilih warna / hex input           → ColorInput          ← JANGAN <input type="color"> manual
Slider numerik (range)            → Slider              ← JANGAN <input type="range"> manual
Pilihan eksklusif (radio/segment) → SegmentedControl    ← JANGAN tombol custom
Yes/No checkbox                   → Checkbox
Label standalone                  → Label
Teks area panjang                 → Textarea
Upload file/lampiran              → FileUpload          ← JANGAN <input type="file">
Preview/pilih gambar              → FileUpload
Tombol aksi                       → Button (pilih variant sesuai context)
Status/kategori label             → Badge (pilih variant warna sesuai status)
Kategori/baris pendanaan          → withFinancingGroup + FinancingBadge (shared/financing)
Jurnal debit/kredit transaksi     → JournalBox (shared/journal-box) ← JANGAN tabel jurnal manual
Header halaman                    → PageHeader
Stats di halaman utama            → StatsCard
Stats di dalam modal              → StatsCard dengan inModal={true}
Section header form               → FormSection
Tabel data                        → DataTable
Konfirmasi hapus/aksi kritis      → ConfirmDialog
State kosong (no data)            → EmptyState
Navigasi halaman                  → Pagination
Tab navigasi                      → Tabs + TabsPanel
Kartu container                   → Card + CardContent
Modal/dialog                      → Dialog + DialogContent dll.
Dropdown menu                     → DropdownMenu dll.
Tooltip                           → TooltipProvider + Tooltip + TooltipTrigger + TooltipContent
Popover/flyout                    → Popover + PopoverTrigger + PopoverContent
Avatar user                       → Avatar + AvatarFallback
Scroll area custom                → ScrollArea
Pemisah visual                    → Separator
Loading skeleton                  → Skeleton
```

---

## Modules Overview

> **Multi-tenancy:** semua route modul di bawah kini ber-prefix **`/c/{company}`**
> (mis. `/c/kisantra/invoices`) — satu database per perusahaan via stancl/tenancy.
> Migration bisnis ada di `database/migrations/tenant/` (`php artisan tenants:migrate`).
> Di React, bangun URL dengan `companyUrl()` dari `@/lib/company` (JANGAN literal path);
> pencocokan URL aktif pakai `appPath()`.
> Cara migrasi + latihannya: `docs/panduan-migrasi.md` (untuk dipelajari);
> daftar periksa hari-H: `docs/multi-tenancy-runbook-eksekusi.md`.
> Deploy: satu perintah `./deploy.sh` memilih mode dari bentuk database (instalasi baru →
> walkthrough `/setup`; server lama → konversi otomatis ke perusahaan utama `/c/utama`;
> multi-perusahaan → pembaruan rutin), lihat `docs/guides/DEPLOY.md`. Nama database
> perusahaan = `TENANCY_DB_PREFIX` + slug (unik per instalasi); JANGAN mematok `tenant_`,
> pakai `$company->database()->getName()`. Gerbang `EnsureCompanyProfileComplete` mewajibkan
> profil lengkap + peninjauan nomor invoice lama sebelum perusahaan bisa dipakai.

| Module | Route | Fitur / Halaman |
|--------|-------|-----------------|
| Dashboard | `/dashboard` | Overview stats |
| Clients | `/clients` | Index, Create, Edit, Delete, Show |
| Services | `/services` | Index, Create, Edit, Delete |
| Invoices | `/invoices` | Index, Create, Edit, Delete, Show + Payments |
| Recurring | `/recurring-invoices` | Templates, Monthly, Analytics + CRUD |
| Kas & Bank | `/bank-accounts` | Index, Create, Edit, Delete, Transactions; jenis akun `bank`/`cash` (kas kecil: penanggung jawab, plafon, Isi ulang via transfer); label menu "Kas & Bank", route & izin tetap `bank-accounts` |
| Cash Flow | `/cash-flow` | Menu **Pemasukan & Pengeluaran** (tab Semua `/all` — butuh `view income` + `view expense`, ekspor Excel —, Pemasukan, Pengeluaran; kolom & filter Diinput oleh; **Pendanaan** (`financing`) bisa dicatat lewat grup terakhir pemilih kategori, tampil berbadge & kartu terpisah karena tidak masuk Laba Rugi, pokok utang/piutang hanya-lihat, rinciannya bisa dibuka hanya-lihat) + menu Transfer & Penyesuaian; kotak **Jurnal** (debit/kredit diturunkan dari rekening + kategori, pembayaran invoice "titipan dulu" seperti Laba Rugi — tidak disimpan, bukan buku besar; `JournalService`) di dialog Catat, rincian, ubah, Transfer, Catat pembayaran invoice, dan rincian Kas & Bank |
| Tx Categories | `/transaction-categories` | Index, Create, Update, Delete, Pakai Template (15 induk/59 sub: pemasukan & pengeluaran bergrup L/R + bagian Pendanaan tanpa L/R, `CategoryTemplateService`; seeder perusahaan baru memakai template yang sama → 82 kategori) |
| Reimbursements | `/reimbursements` | All/My Requests, Create, Review, Payment |
| Fund Requests | `/fund-requests` | All/My Requests, Create, Review, Disburse |
| Loans | `/loans` | Index, Create, Update, Delete, PayLoan |
| Receivables | `/receivables` | Index, Create, Update, Submit, Approve, Pay |
| Feedbacks | `/feedbacks` | All/My, Create, Show, Respond |
| Settings | `/settings/*` | Hub, Profile, Password, Company, Penomoran Invoice, PDF Templates |
| Users | `/admin/users` | Index, Create, Edit, Delete |
| Permissions/Roles | `/permissions` | Permissions + Roles CRUD |
| Companies | `/admin/companies` | Provisioning perusahaan baru + anggota & peran tiap perusahaan (admin, kuota per organization; menu Administrasi › Perusahaan) |
| Koneksi Claude | `/mcp/keuangan` (pusat), `/settings/claude` | Server MCP **hanya baca** untuk Claude + OAuth Passport; izin `use claude` (admin & FM). Lihat `docs/module/koneksi-claude.md` |

### Key Business Logic

**Invoice:** default `001/INV/KSN-XXX/I/2026` (`{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}`; `{KLIEN}` = alias klien, atau inisial nama bila kosong) — format, digit & periode reset bisa diatur di Pengaturan › Penomoran invoice (`InvoiceNumberService`); nomor baru diisi saat `send`, sebelum itu `null`; urutan tersimpan di `invoice_sequence`; status: `draft → sent → partially_paid → paid`; jatuh tempo = tanggal + termin (bawaan `company_profiles.default_due_days`, disetel dari form invoice baru)
**Reimbursement:** `draft → pending → approved → paid` (or `rejected`)
**Fund Request:** `draft → pending → approved → disbursed` (or `rejected`); format `001/KSN/I/2026`
**Recurring:** Manual generation (no scheduled tasks); frequencies: monthly/quarterly/semi_annual/annual
**Kas & Bank:** `bank_accounts.type` = `bank` | `cash`; akun kas tanpa nomor/bank diisi model `KAS-0001` + `Tunai` (kolom tetap NOT NULL), `custodian_id` = user pusat tanpa FK, `cash_limit` = plafon; total saldo dirinci Total Bank + Total Kas
**Bank Balance:** COMPUTED dynamically — `initial_balance + payments(credit) + tx(credit) - tx(debit)` — NOT stored. Untuk daftar/total WAJIB `BankAccount::withBalance()` (1 query); tanpa itu accessor menjalankan 3 query agregat **per rekening** dan `$appends` memanggilnya tiap serialisasi
**Receivable Debtor:** Polymorphic — User OR Client

**Notification events:** `Bell → dispatch('open-notification-drawer') → Drawer` / `Drawer → dispatch('notification-read') → Bell`

---

## Models Reference

| Model | File | Notes |
|-------|------|-------|
| Invoice | `app/Models/Invoice.php` | Accessors: amount_paid, amount_remaining, total_cogs, gross_profit; `updateStatus()` |
| InvoiceItem | `app/Models/InvoiceItem.php` | Fields: quantity, unit, unit_price, cogs_amount, is_tax_deposit |
| Payment | `app/Models/Payment.php` | belongsTo Invoice + BankAccount |
| BankAccount | `app/Models/BankAccount.php` | balance = computed accessor, NOT stored; `type` bank\|cash, `isCash()`, `refillAmount()`, `custodianNames()` |
| BankTransaction | `app/Models/BankTransaction.php` | transaction_type: `credit` \| `debit` |
| TransactionCategory | `app/Models/TransactionCategory.php` | Hierarchical (parent_code); accessor: `full_path` |
| Reimbursement | `app/Models/Reimbursement.php` | submit/approve/reject/recordPayment + canEdit/canDelete/canSubmit/canReview/canPay |
| FundRequest | `app/Models/FundRequest.php` | submit/approve/reject/disburse + check methods |
| RecurringTemplate | `app/Models/RecurringTemplate.php` | calculateNextGenerationDate(), isDueForGeneration() |
| RecurringInvoice | `app/Models/RecurringInvoice.php` | publish() converts draft → actual Invoice |
| Client | `app/Models/Client.php` | type: `individual` \| `company`; self-referential owners/companies |
| CompanyProfile | `app/Models/CompanyProfile.php` | Singleton via `current()`; base64 logo/signature/stamp for PDF |
| Receivable | `app/Models/Receivable.php` | Polymorphic debtor (User OR Client) |
| AppNotification | `app/Models/AppNotification.php` | `notify()` factory method; `cleanupOld($days)` |

---

## Permission System

**Roles:** `admin` (full access), `finance manager` (no user mgmt), `staff` (view/create own)

**50 permissions across modules:** view/create/edit/delete + module-specific (approve, pay, publish, disburse, manage, respond)

```php
Route::middleware('can:view invoices')->name('invoices.index')
```

Reset cache: `php artisan permission:cache-reset`

**Permission baru WAJIB lewat migrasi** (`Permission::firstOrCreate` + `givePermissionTo` ke role yang perlu) **dan** didaftarkan di `MasterPermissionSeeder` untuk instalasi baru. Jangan mengandalkan seeder saat deploy — `syncPermissions()` di seeder menyetel ulang izin role yang diatur lewat UI. Lihat `docs/guides/DEPLOY.md`.

**Role `admin` selalu memegang SEMUA permission**: `deploy.sh` menjalankan `php artisan central:sync-admin-permissions` tiap rilis, dan halaman Izin & Peran menolak mengubah izin atau nama role admin. Migrasi permission baru cukup memberi role lain yang perlu.

---

## PDF Generation

**Service:** `app/Services/InvoicePrintService.php`

**Templates:** `kisantra-invoice` (default), `semesta-invoice`, `agsa-invoice`, `invoice`

```php
GET /invoice/{invoice}/download?dp_amount=X&pelunasan_amount=Y&template=kisantra-invoice
$pdf = (new InvoicePrintService())->generateSingleInvoicePdf($invoice, $dp, $pelunasan, $template);
```

---

## Tech Stack

**Backend:** Laravel 12, Spatie Permission 6.21, DomPDF 3.1, Maatwebsite Excel 3.1, ngekoding/terbilang, PHP 8.4

**Frontend (Inertia + React):** React 18, TypeScript, Inertia.js 3, shadcn/ui, Tailwind CSS 4.1, Wayfinder (type-safe routes), react-hook-form + zod, @tanstack/react-table, react-day-picker v10, cmdk, Sonner, i18next + react-i18next, react-apexcharts, react-chartjs-2, react-dropzone, Vite 6.0

> Blade dipertahankan **hanya** untuk template PDF (`resources/views/pdf/`). Tidak ada Livewire/TallStackUI/Alpine.

---

## Development Guidelines

### Multi Bahasa (id · en · zh)

**CRITICAL: setiap teks yang tampil ke pengguna WAJIB lewat `t()` (React) atau `__()` (server). CI menolak teks keras (`npm run i18n:check` + `TeksServerMultiBahasaTest`).**

**Keputusan tetap.** K1: kunci terjemahan = **teks Indonesia persis** (`t('Simpan Pemasukan')`); Bahasa Indonesia tidak butuh kamus, terjemahan yang belum ada tampil Indonesia (bukan kunci mentah). K2: PDF, Excel, isi template builder & terbilang **selalu Bahasa Indonesia**. K3: cakupan = tampilan aplikasi + pesan server + email; `/panduan`, video, isi dialog Tutorial, nama kategori & semua data pengguna tampil apa adanya. K4: belum ada peninjau Mandarin — istilah WAJIB ikut `docs/i18n/glosarium.md`. Rupiah & angka tetap format `id-ID` (`Rp 1.500.000`) di semua bahasa.

**Aturan emas.** Terjemahkan teks yang **tampil pada request/render ini**. Teks yang **disimpan** ke database (deskripsi transaksi otomatis yang dibaca ulang regex, nomor dokumen, teks notifikasi) atau **dikirim ke sistem lain** (Watchpost, alat MCP Claude) tetap Bahasa Indonesia — jangan dibungkus `__()`/`t()`.

**Cara kerja.**
- Penentu bahasa TUNGGAL: `App\Http\Middleware\SetLocale` — pengguna login → `users.locale`; tamu → sesi; selain itu `id`. `config/app.php`: `available_locales` = `['id','en','zh']`; `locale` & `fallback_locale` dipatok `'id'` (bukan dari `.env`: fallback `en` membuat layar Mandarin jatuh ke Inggris). Carbon ikut otomatis lewat event `LocaleUpdated`.
- Ganti bahasa: `<LanguageSwitcher>` (`@/components/language-switcher`, header + layout tamu) → `POST /language` (`LanguageController`) → `users.locale` (tamu: sesi + penanda, dibawa ke akun saat masuk oleh `App\Listeners\TerapkanBahasaPilihanTamu`) → `Inertia::location` = **muat ulang penuh**. `HandleInertiaRequests::version()` memuat bahasa, jadi kunjungan Inertia yang bahasanya berubah (masuk/keluar, tab lain) juga dimuat ulang penuh — tidak ada sisa bahasa lama.
- Frontend: `resources/js/i18n.ts`; `initI18n()` dipanggil `inertia.tsx` SEBELUM render pertama dan memuat `resources/js/locales/{en,zh}.json` (hanya bahasa aktif). Kunci belum diterjemahkan → teks Indonesia + `console.warn('[i18n] belum diterjemahkan: …')` di build dev.
- Server: `__('teks Indonesia', ['nama' => $x])` + `lang/en.json` & `lang/zh.json`. Teks bawaan Laravel (validasi, auth, pagination, email reset/verifikasi) lewat `lang/{id,en,zh}/*.php` dan `lang/{id,zh}.json` (kuncinya Inggris). Kunci satu kata yang sama dengan nama berkas grup (`feedback`, `invoice`, `pages`, …) ditafsir sebagai grup — hindari.
- Dokumen: rute PDF/Excel/pratinjau PDF **WAJIB** middleware `locale.dokumen` (`SetDocumentLocale`) dan didaftarkan di `MultiBahasaTest::RUTE_DOKUMEN`; isi dokumen yang dibangun di request tampilan dibungkus `withDocumentLocale(fn () => …)` (contoh: kanvas `PdfTemplateController::edit`).

**API frontend** — `import { t, tk, Trans, formatTanggal, dateLocale, polaTanggal } from '@/i18n'`:

| Kebutuhan | Pakai |
|---|---|
| Teks di komponen/fungsi | `t('Simpan')` saat render/fungsi berjalan — satu cara untuk komponen maupun helper (tanpa hook) |
| Konstanta tingkat modul (peta status, opsi, menu) | `tk('Lunas')` saat didefinisikan, `t(PETA[kode])` saat render. **DILARANG** `t()` di level modul (kamus belum dimuat) |
| Nilai di dalam kalimat | SATU kalimat utuh + placeholder berbahasa Inggris (`{{name}}`, `{{amount}}`, `{{date}}`, `{{count}}`); nilai diformat dulu (`formatCurrency`, `formatTanggal`). Jangan merangkai potongan kalimat |
| Bilangan + benda | `t('{{count}} invoice', { count })` → kamus en `…_one` + `…_other`, zh `…_other`. Angka yang bukan hitungan benda: nama lain (`{{n}}`) |
| Tebal/tautan di dalam kalimat | `<Trans i18nKey="Pengguna baru? <tautan>…</tautan>" values={…} components={{ tautan: <AuthLink href="…" /> }} />`; nama tag `<b>`, `<tautan>` (bukan nama tag HTML kosong seperti `link`/`br`) |
| Kata sama, terjemahan beda | konteks: `t('Jumlah', { context: 'jurnal' })` / `tk('Lunas', 'angsuran')` → kunci kamus `Jumlah_jurnal`. Nama modul/menu (menu, breadcrumb, judul halaman, `<Head>`) memakai konteks `menu` (EN jamak "Invoices", kolom "Invoice") |
| Kode yang = teks Indonesia (tipe layanan, peran bawaan) | tampilkan `t(kode)`, simpan/saring tetap kode; daftarkan kodenya dengan `tk()` (`TYPE_COLORS` di `pages/services`, `roleLabel()` di `@/lib/roles`) |
| Tanggal | `formatDate(v)` (tabel, `@/lib/utils`) atau `formatTanggal(v, 'pendek'\|'panjang'\|'hari'\|'bulan'\|'waktu'\|opsi Intl)`; date-fns di kalender: `format(d, polaTanggal('tanggal'), { locale: dateLocale() })`. Jangan menulis nama bulan/hari sendiri |
| Label aria pustaka | `DatePicker`, kalender Ringkasan & `Toaster` sudah meneruskan bahasa; komponen pustaka baru wajib diberi `locale`/label dari `dateLocale()`/`t()` |

Jangan menamai variabel lokal `t` di berkas yang mengimpor `t` (ganti: `timer`, `tone`, `tab`) — pemindai menolaknya.

**Pemindai** (0 galat sebelum merge; CI `tests.yml`):
- Frontend `npm run i18n:check` (`scripts/i18n-check.mjs`): teks JSX, prop teks, toast, `<Head title>`, peta label, nilai bawaan prop, kalimat di return/variabel/setState/penugasan; kunci `t()`/`tk()`/`<Trans>` wajib ada di `locales/{en,zh}.json` dengan placeholder & tag identik dan jamak en. `-- --scope pages/invoices` = satu folder; `-- --kunci-hilang out.json` = ekspor kunci yang belum ada (bahan penerjemah). Pengecualian SATU baris: `// i18n-abaikan: <alasan>` (JSX: `{/* i18n-abaikan: <alasan> */}`) di baris itu, atau di baris tepat di atasnya **bila baris itu murni komentar** (komentar di ekor kode tidak menutup baris berikutnya); pengecualian sebuah kunci `t()` hanya berlaku bila SEMUA pemakaiannya diabaikan. Kolom tabel (`header:`), `meta`, dan peta `*Subtitle` ikut dipindai. Contoh pola yang wajib gagal: `tests/Fixtures/i18n-pemindai` (`PemindaiI18nTest`, `--root <folder>`). `pages/guide/**` tidak dipindai.
- Server `tests/Unit/TeksServerMultiBahasaTest.php`: literal tanpa `__()` di flash, `withErrors`, `ValidationException::withMessages`, `'message'` JSON, `abort*()`, `messages()`/`attributes()` FormRequest; kunci `__()` ada di `lang/{en,zh}.json`; `lang/{en,zh}/*.php` sejajar `lang/id`. Perilaku: `tests/Feature/MultiBahasaTest.php`.

**Menambah teks baru:** tulis teks Indonesia di `t()`/`__()` → `npm run i18n:check -- --scope <folder>` → tambah entri ke `resources/js/locales/en.json` & `zh.json` (server: `lang/en.json` & `lang/zh.json`) memakai istilah glosarium → 0 galat.

#### Panduan ekstraksi (contoh nyata dari pilot)

```tsx
// 1. <Head> & judul halaman = nama modul → konteks 'menu'                       (pages/services/index.tsx)
<Head title="Layanan" />                     →  <Head title={t('Layanan', { context: 'menu' })} />

// 2. Toast
toast.success('Layanan berhasil ditambahkan.')  →  toast.success(t('Layanan berhasil ditambahkan.'))

// 3. Kalimat dengan nilai: satu kalimat utuh + placeholder
description={`Apakah Anda yakin ingin menghapus "${deleteTarget.name}"?`}
  →  description={t('Apakah Anda yakin ingin menghapus "{{name}}"?', { name: deleteTarget.name })}
{services.from ?? 0}–{services.to ?? 0} dari {services.total}
  →  {t('{{from}}–{{to}} dari {{total}}', { from: services.from ?? 0, to: services.to ?? 0, total: services.total })}

// 4. Peta status/kode: tk() saat didefinisikan, t() saat render                  (components/jadwal-angsuran.tsx)
const STATUS = { lunas: { label: 'Lunas', tone: 'pos' }, … }
  →  const STATUS = { lunas: { label: tk('Lunas', 'angsuran'), tone: 'pos' }, … }  …  {t(label, { context: 'angsuran' })}
//    kode tersimpan yang sekaligus teks Indonesia                               (pages/services/index.tsx)
const TYPE_COLORS = { [tk('Perizinan')]: 'blue', … }  …  <Badge>{t(s.type)}</Badge>   // simpan & saring tetap s.type

// 5. Jamak                                                                         (notification-drawer.tsx)
`${m} menit lalu`  →  t('{{count}} menit lalu', { count: m })
//    en.json: "{{count}} menit lalu_one": "{{count}} minute ago", "{{count}} menit lalu_other": "{{count}} minutes ago"
//    zh.json: "{{count}} menit lalu_other": "{{count}} 分钟前"

// 6. Bagian tebal di dalam kalimat (Trans)                                         (components/shared/pagination.tsx)
Menampilkan <span className="…">{from}</span>–<span className="…">{to}</span> dari <span className="…">{total}</span> data
  →  <Trans i18nKey="Menampilkan <b>{{from}}</b>–<b>{{to}}</b> dari <b>{{count}}</b> data" count={total}
            values={{ from, to }} components={{ b: <span className="font-medium text-ob-ink-2" /> }} />
//    kalimat bervariasi = beberapa kalimat utuh, bukan potongan                    (components/shared/financing.tsx)
tk('<b>Pendanaan:</b> saldo {{account}} bertambah {{amount}}, Laba Rugi tidak berubah.')  // + "berkurang", + tanpa nominal
```

```php
// 7. Server: teks yang tampil di request ini
return back()->with('success', 'Layanan berhasil ditambahkan.');
  →  return back()->with('success', __('Layanan berhasil ditambahkan.'));   // + entri lang/en.json & lang/zh.json
// Teks yang DISIMPAN (deskripsi transfer otomatis, dibaca ulang regex) TIDAK dibungkus __().
```

### Currency

Di React: **SELALU gunakan komponen `CurrencyInput`** (`@/components/shared/currency-input`) untuk semua input mata uang — bukan `Input` biasa. Komponen ini menyimpan raw integer dan menampilkan `Rp 1.500.000`. Untuk display read-only, format dengan `Intl.NumberFormat('id-ID')` atau helper format rupiah yang ada.

### Component Usage Protocol

**CRITICAL: Sebelum implementasi ANY external component — baca dokumentasi resminya dulu (WebSearch + WebFetch atau MCP shadcn). Jangan implement berdasarkan asumsi atau memory.**

Berlaku untuk: shadcn/ui components, library React (react-day-picker, cmdk, react-hook-form, dll.), dan Laravel packages.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission issues | `php artisan permission:cache-reset` |
| PDF not generating | Cek `storage/` writable, `php artisan storage:link`, company profile has assets |
| Inertia props not updating | Pastikan controller mengirim ulang prop; gunakan `router.reload({ only: [...] })` untuk partial reload |
| Balance incorrect | Balance is computed dynamically, NOT stored — cek transaction types |
| Currency display | Simpan integer; tampilkan dengan `CurrencyInput` atau `Intl.NumberFormat('id-ID')` |
| Vite/React changes not visible | Run `npm run build` atau `composer run dev` |
| Teks tetap Indonesia di EN/ZH | Belum dibungkus `t()`/`__()` (jalankan `npm run i18n:check`) atau kunci belum ada di kamus (console dev: `[i18n] belum diterjemahkan`) |

---

## Important Files Reference

| File | Purpose |
|------|---------|
| **`docs/module/README.md`** | **Indeks dokumentasi per modul + peta alur data lintas modul — WAJIB dibaca sebelum menyentuh modul apa pun** |
| `docs/archive/MIGRATION_PLAN.md` | Status migrasi, fase & progress |
| `.claude/design-systems/archipelago.md` | Design system tokens, typography, spacing, color palette |
| `app/Services/InvoicePrintService.php` | PDF generation |
| `app/Models/Invoice.php` | Status & profit calculations |
| `app/Models/Reimbursement.php` | Workflow state machine |
| `app/Models/RecurringTemplate.php` | Recurring date calculations |
| `app/Models/BankAccount.php` | Dynamic balance |
| `app/Http/Middleware/HandleInertiaRequests.php` | Shared Inertia props (auth, locale, flash, notifications) |
| `app/helpers.php` | `withDocumentLocale()` (isi dokumen selalu Bahasa Indonesia) |
| `resources/js/i18n.ts` | Inti multi bahasa: `t`, `tk`, `Trans`, `initI18n`, helper tanggal; kamus `resources/js/locales/{en,zh}.json` |
| `app/Http/Middleware/SetLocale.php` | Satu-satunya penentu bahasa per request; `SetDocumentLocale` = alias `locale.dokumen` |
| `scripts/i18n-check.mjs` | Pemindai teks multi bahasa frontend (`npm run i18n:check`) |
| `database/seeders/MasterPermissionSeeder.php` | Permission structure |
| `routes/web.php` | All route definitions |
| `resources/views/pdf/kisantra-invoice.blade.php` | Main invoice template |
| `resources/css/app.css` | Color variables, fonts, @source tracking |
| `resources/js/components/ui/` | React UI primitives (shadcn/ui + custom) |
| `resources/js/components/shared/` | React shared components (PageHeader, DataTable, dll.) |
| `resources/js/pages/` | Inertia React pages (per module) |

===

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application and its main Laravel ecosystems package & versions are below. You are an expert with them all. Ensure you abide by these specific packages & versions.

- php - 8.4.8
- laravel/framework (LARAVEL) - v12
- laravel/prompts (PROMPTS) - v0
- livewire/livewire (LIVEWIRE) - v3
- livewire/volt (VOLT) - v1
- laravel/boost (BOOST) - v2
- laravel/mcp (MCP) - v0
- laravel/pail (PAIL) - v1
- laravel/pint (PINT) - v1
- laravel/sail (SAIL) - v1
- phpunit/phpunit (PHPUNIT) - v11
- alpinejs (ALPINEJS) - v3
- tailwindcss (TAILWINDCSS) - v4

## Skills Activation

This project has domain-specific skills available. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

- `tailwindcss-development` — Styles applications using Tailwind CSS v4 utilities. Activates when adding styles, restyling components, working with gradients, spacing, layout, flex, grid, responsive design, dark mode, colors, typography, or borders; or when the user mentions CSS, styling, classes, Tailwind, restyle, hero section, cards, buttons, or any visual/UI changes.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

- Laravel Boost is an MCP server that comes with powerful tools designed specifically for this application. Use them.

## Artisan

- Use the `list-artisan-commands` tool when you need to call an Artisan command to double-check the available parameters.

## URLs

- Whenever you share a project URL with the user, you should use the `get-absolute-url` tool to ensure you're using the correct scheme, domain/IP, and port.

## Tinker / Debugging

- You should use the `tinker` tool when you need to execute PHP to debug code or query Eloquent models directly.
- Use the `database-query` tool when you only need to read from the database.
- Use the `database-schema` tool to inspect table structure before writing migrations or models.

## Reading Browser Logs With the `browser-logs` Tool

- You can read browser logs, errors, and exceptions using the `browser-logs` tool from Boost.
- Only recent browser logs will be useful - ignore old logs.

## Searching Documentation (Critically Important)

- Boost comes with a powerful `search-docs` tool you should use before trying other approaches when working with Laravel or Laravel ecosystem packages. This tool automatically passes a list of installed packages and their versions to the remote Boost API, so it returns only version-specific documentation for the user's circumstance. You should pass an array of packages to filter on if you know you need docs for particular packages.
- Search the documentation before making code changes to ensure we are taking the correct approach.
- Use multiple, broad, simple, topic-based queries at once. For example: `['rate limiting', 'routing rate limiting', 'routing']`. The most relevant results will be returned first.
- Do not add package names to queries; package information is already shared. For example, use `test resource table`, not `filament 4 test resource table`.

### Available Search Syntax

1. Simple Word Searches with auto-stemming - query=authentication - finds 'authenticate' and 'auth'.
2. Multiple Words (AND Logic) - query=rate limit - finds knowledge containing both "rate" AND "limit".
3. Quoted Phrases (Exact Position) - query="infinite scroll" - words must be adjacent and in that order.
4. Mixed Queries - query=middleware "rate limit" - "middleware" AND exact phrase "rate limit".
5. Multiple Queries - queries=["authentication", "middleware"] - ANY of these terms.

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.

## Constructors

- Use PHP 8 constructor property promotion in `__construct()`.
    - `public function __construct(public GitHub $github) { }`
- Do not allow empty `__construct()` methods with zero parameters unless the constructor is private.

## Type Declarations

- Always use explicit return type declarations for methods and functions.
- Use appropriate PHP type hints for method parameters.

```php
protected function isAccessible(User $user, ?string $path = null): bool
{
    ...
}
```

## Enums

- Typically, keys in an Enum should be TitleCase. For example: `FavoritePerson`, `BestLake`, `Monthly`.

## Comments

- Prefer PHPDoc blocks over inline comments. Never use comments within the code itself unless the logic is exceptionally complex.

## PHPDoc Blocks

- Add useful array shape type definitions when appropriate.

=== tests rules ===

# Test Enforcement

- Every change must be programmatically tested. Write a new test or update an existing test, then run the affected tests to make sure they pass.
- Run the minimum number of tests needed to ensure code quality and speed. Use `php artisan test --compact` with a specific filename or filter.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using the `list-artisan-commands` tool.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

## Database

- Always use proper Eloquent relationship methods with return type hints. Prefer relationship methods over raw queries or manual joins.
- Use Eloquent models and relationships before suggesting raw database queries.
- Avoid `DB::`; prefer `Model::query()`. Generate code that leverages Laravel's ORM capabilities rather than bypassing them.
- Generate code that prevents N+1 query problems by using eager loading.
- Use Laravel's query builder for very complex database operations.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `list-artisan-commands` to check the available options to `php artisan make:model`.

### APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## Controllers & Validation

- Always create Form Request classes for validation rather than inline validation in controllers. Include both validation rules and custom error messages.
- Check sibling Form Requests to see if the application uses array or string based validation rules.

## Authentication & Authorization

- Use Laravel's built-in authentication and authorization features (gates, policies, Sanctum, etc.).

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Queues

- Use queued jobs for time-consuming operations with the `ShouldQueue` interface.

## Configuration

- Use environment variables only in configuration files - never use the `env()` function directly outside of config files. Always use `config('app.name')`, not `env('APP_NAME')`.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

=== laravel/v12 rules ===

# Laravel 12

- CRITICAL: ALWAYS use `search-docs` tool for version-specific Laravel documentation and updated code examples.
- Since Laravel 11, Laravel has a new streamlined file structure which this project uses.

## Laravel 12 Structure

- In Laravel 12, middleware are no longer registered in `app/Http/Kernel.php`.
- Middleware are configured declaratively in `bootstrap/app.php` using `Application::configure()->withMiddleware()`.
- `bootstrap/app.php` is the file to register middleware, exceptions, and routing files.
- `bootstrap/providers.php` contains application specific service providers.
- The `app\Console\Kernel.php` file no longer exists; use `bootstrap/app.php` or `routes/console.php` for console configuration.
- Console commands in `app/Console/Commands/` are automatically available and do not require manual registration.

## Database

- When modifying a column, the migration must include all of the attributes that were previously defined on the column. Otherwise, they will be dropped and lost.
- Laravel 12 allows limiting eagerly loaded records natively, without external packages: `$query->latest()->limit(10);`.

### Models

- Casts can and likely should be set in a `casts()` method on a model rather than the `$casts` property. Follow existing conventions from other models.

=== livewire/core rules ===

# Livewire

- Livewire allows you to build dynamic, reactive interfaces using only PHP — no JavaScript required.
- Instead of writing frontend code in JavaScript frameworks, you use Alpine.js to build the UI when client-side interactions are required.
- State lives on the server; the UI reflects it. Validate and authorize in actions (they're like HTTP requests).

=== volt/core rules ===

# Livewire Volt

- Single-file Livewire components: PHP logic and Blade templates in one file.
- Always check existing Volt components to determine functional vs class-based style.
- IMPORTANT: Always use `search-docs` tool for version-specific Volt documentation and updated code examples.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== phpunit/core rules ===

# PHPUnit

- This application uses PHPUnit for testing. All tests must be written as PHPUnit classes. Use `php artisan make:test --phpunit {name}` to create a new test.
- If you see a test using "Pest", convert it to PHPUnit.
- Every time a test has been updated, run that singular test.
- When the tests relating to your feature are passing, ask the user if they would like to also run the entire test suite to make sure everything is still passing.
- Tests should cover all happy paths, failure paths, and edge cases.
- You must not remove any tests or test files from the tests directory without approval. These are not temporary or helper files; these are core to the application.

## Running Tests

- Run the minimal number of tests, using an appropriate filter, before finalizing.
- To run all tests: `php artisan test --compact`.
- To run all tests in a file: `php artisan test --compact tests/Feature/ExampleTest.php`.
- To filter on a particular test name: `php artisan test --compact --filter=testName` (recommended after making a change to a related file).

=== tailwindcss/core rules ===

# Tailwind CSS

- Always use existing Tailwind conventions; check project patterns before adding new ones.
- IMPORTANT: Always use `search-docs` tool for version-specific Tailwind CSS documentation and updated code examples. Never rely on training data.
- IMPORTANT: Activate `tailwindcss-development` every time you're working with a Tailwind CSS or styling-related task.

</laravel-boost-guidelines>
