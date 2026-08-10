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
| [bank-accounts.md](bank-accounts.md) | Rekening bank, saldo terhitung, transaksi | `/bank-accounts` |
| [cash-flow.md](cash-flow.md) | Pemasukan, Pengeluaran, Transfer, export PDF | `/cash-flow/*` |
| [transaction-categories.md](transaction-categories.md) | Kategori hierarkis, pl_group, reassign-delete | `/transaction-categories` |
| [fund-requests.md](fund-requests.md) | Permintaan dana: workflow + pencairan | `/fund-requests` |
| [reimbursements.md](reimbursements.md) | Reimbursement: workflow + pembayaran parsial | `/reimbursements` |
| [loans.md](loans.md) | Utang perusahaan + pembayaran pokok/bunga | `/loans` |
| [receivables.md](receivables.md) | Piutang (debtor polimorfik User/Client) | `/receivables` |
| [profit-loss.md](profit-loss.md) | Laporan Laba Rugi (basis kas, pl_group) | `/reports/profit-loss` |
| [dashboard.md](dashboard.md) | Dashboard & redirect fallback permission | `/dashboard` |
| [notifications.md](notifications.md) | Notifikasi in-app (bell + drawer) | `/notifications` |
| [feedbacks.md](feedbacks.md) | Feedback/bug report internal | `/feedbacks` |
| [admin-users-permissions.md](admin-users-permissions.md) | User, role, permission (Spatie) | `/admin/*` |
| [settings.md](settings.md) | Profil, password, company, PDF template builder | `/settings/*` |

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
Reimbursement ──(pay, per pembayaran)────────► bank_transactions ├──► Saldo Bank
Loan ──(create: credit FIN-LOAN-IN)──────────► bank_transactions │    (computed)
     ──(pay: debit FIN-LOAN-OUT+EXP-INTEREST)► bank_transactions │
Receivable ──(cair: debit FIN-RCV-OUT)───────► bank_transactions │
           ──(cicilan: credit FIN-RCV-IN)────► bank_transactions ┘
Cash Flow (input manual income/expense/transfer)──► bank_transactions
```

Laporan Laba Rugi membaca `payments` (pendapatan) + `bank_transactions` yang kategorinya
punya `pl_group` (revenue/other_income/cogs/opex/other_expense/tax) — lihat
[profit-loss.md](profit-loss.md) dan dokumen kebijakan `.claude/context/laba-rugi.md`.

## Konvensi Lintas Modul

- **Currency**: semua nominal disimpan `bigint` rupiah penuh (150000 = Rp 150.000), tanpa desimal.
- **Permission**: Spatie Permission; gate di route (`can:...`), FormRequest, dan UI (`useCan`).
  Struktur lengkap: `database/seeders/MasterPermissionSeeder.php`.
- **Frontend**: Inertia + React; controller mengirim props, halaman di `resources/js/pages/<modul>/`.
  Komponen wajib pakai katalog di CLAUDE.md (Combobox, DatePicker, CurrencyInput, FileUpload, dll.).
- **Workflow status**: state machine hidup di model (`canSubmit()`, `approve()`, dst.), bukan controller.
- **⚠ Kategori sistem Loans/Receivables**: `LoanController`/`ReceivableController` masih mencari
  kategori via `where('code', 'FIN-LOAN-IN')` dst., padahal kolom `code` **sudah di-drop** oleh
  migration `2026_02_05_..._refactor_transaction_categories...` — lookup ini bug laten
  (`QueryException`) yang harus diperbaiki sebelum fitur transaksi otomatis loan/receivable dipakai.
  Detail di [loans.md](loans.md) / [receivables.md](receivables.md).
- **Test = spesifikasi**: aturan bisnis paling akurat ada di `tests/Feature/` per modul.
