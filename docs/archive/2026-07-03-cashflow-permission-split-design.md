# Cash Flow Permission Split — Income / Expense / Transfer

**Date:** 2026-07-03
**Status:** Approved design, pending implementation plan

## Problem

Cash flow saat ini tidak membedakan hak akses antara pemasukan (income), pengeluaran (expense), dan transfer:

1. **`manage cash-flow` adalah permission mati** — terdaftar di seeder (admin & finance manager) tapi tidak pernah direferensikan di route/controller/frontend mana pun.
2. **Income & expense berbagi endpoint yang sama** (`bank-transactions.store/update/destroy`), dibedakan hanya oleh field `transaction_type` (`credit`=income, `debit`=expense). Mutasi digate oleh permission generik `create/edit/delete transactions` — tanpa pembedaan income vs expense. Siapa pun yang bisa membuat transaksi otomatis bisa membuat keduanya.
3. **Transfer** = sepasang transaksi berbagi `reference_number` berprefiks `TRF` (satu `debit` + satu `credit`), dibuat via `bank-transactions.transfer`, juga digate `create transactions`.
4. **Frontend sudah menerima `auth.permissions`** (array nama permission) via `HandleInertiaRequests::share()`, tetapi belum dipakai untuk menyembunyikan tombol apa pun.

**Konsekuensi arsitektural:** Karena income/expense berbagi endpoint dan `transaction_type` ada di payload (store) atau di model (update/destroy), otorisasi **tidak bisa** dilakukan di middleware route. Otorisasi harus pindah ke FormRequest `authorize()` / controller yang membaca `transaction_type`.

## Goals

- Setiap fitur cash flow (income, expense, transfer) punya hak akses CRUD terpisah dan simetris.
- Otorisasi ditegakkan di backend (FormRequest/controller), bukan hanya route middleware.
- Frontend menyembunyikan tombol aksi sesuai permission user.
- Bersihkan permission usang/mati dari DB.

## Non-Goals

- Tidak mengubah struktur data `bank_transactions` — `transaction_type` credit/debit tetap. Tidak ada migrasi data transaksi.
- Tidak menyentuh Chart of Accounts / Transaction Categories (pekerjaan terpisah).
- Tidak mengatur assignment permission per-role secara detail di seeder selain admin & finance manager — user mengelola role via UI Permissions sendiri.

## Permission Model (12 permission baru)

Simetris, penuh CRUD per fitur:

| Fitur | Permissions |
|-------|-------------|
| Income | `view income`, `create income`, `edit income`, `delete income` |
| Expense | `view expense`, `create expense`, `edit expense`, `delete expense` |
| Transfer | `view transfer`, `create transfer`, `edit transfer`, `delete transfer` |

**Dihapus dari sistem:**
- `manage cash-flow` (mati)
- `view cash-flow`
- `view transactions`, `create transactions`, `edit transactions`, `delete transactions` (generik)

## Enforcement (backend)

Pemetaan `transaction_type` → permission:
- `credit` (tanpa TRF) → **income**
- `debit` (tanpa TRF) → **expense**
- `reference_number` diawali `TRF` → **transfer** (abaikan credit/debit)

| Aksi | Lokasi otorisasi | Aturan |
|------|------------------|--------|
| Create transaksi | `StoreBankTransactionRequest::authorize()` | baca input `transaction_type`: `credit`→`create income`, `debit`→`create expense` |
| Update transaksi | `UpdateBankTransactionRequest::authorize()` | resolve dari model `bankTransaction` (route binding): TRF→`edit transfer`; credit→`edit income`; debit→`edit expense` |
| Delete tunggal | `DestroyBankTransactionRequest::authorize()` (FormRequest baru) atau `Gate` di controller | resolve dari model: TRF→`delete transfer`; credit→`delete income`; debit→`delete expense` |
| Bulk delete (bank-accounts) | `BulkDestroyBankTransactionRequest::authorize()` | ambil semua transaksi dari `ids`; untuk **setiap** tipe yang muncul, user wajib punya perm delete terkait; jika ada satu saja yang tidak → 403 |
| Bulk delete (cash-flow) | `CashFlowController::bulkDestroy` (authorize di controller) | sama seperti di atas; seleksi cash-flow bisa income/expense |
| Transfer | `TransferBankTransactionRequest::authorize()` | `create transfer` |

Helper resolusi tipe dipusatkan agar konsisten — satu method statis, mis. `BankTransaction::permissionFeature(): string` mengembalikan `'income'|'expense'|'transfer'`, dan helper `abilityFor(string $action)` → mis. `'delete transfer'`. Digunakan oleh FormRequest & controller.

## Route Changes (`routes/web.php`)

- Hapus `->middleware('can:create transactions')` dari `bank-transactions.store` dan `.transfer`.
- Hapus `->middleware('can:edit transactions')` dari `bank-transactions.update`.
- Hapus `->middleware('can:delete transactions')` dari `bank-transactions.destroy`, `.bulk-delete`, dan `cash-flow.bulk-destroy`.
  (Otorisasi kini di FormRequest/controller.)
- Grup `cash-flow`: ganti `->middleware('can:view cash-flow')` di level grup menjadi per-route:
  - `cash-flow.income` → `can:view income`
  - `cash-flow.expenses` → `can:view expense`
  - `cash-flow.transfers` → `can:view transfer`
  - `cash-flow.index` (redirect) → biarkan tanpa gate spesifik atau arahkan ke tab pertama yang boleh diakses. **Keputusan:** redirect tetap, tanpa middleware (hanya `auth`); tab tujuan yang menegakkan gate.
  - `cash-flow.export.*` → gate sesuai konteks; **keputusan:** butuh salah satu dari view income/expense/transfer (pakai `can:` per route mengikuti tab sumbernya bila terpisah, atau `view expense` untuk export pengeluaran). Detail final ditetapkan saat planning setelah cek param export.

## Frontend Gating

Tambah hook kecil `useCan()` (mis. `resources/js/hooks/use-can.ts`) membaca `auth.permissions` dari `usePage().props`:

```ts
export function useCan() {
  const { auth } = usePage<SharedData>().props;
  const perms = auth?.permissions ?? [];
  return (ability: string) => perms.includes(ability);
}
```

Titik gating:
- **Sidebar** (`layouts/sidebar.tsx`): item Pemasukan→`view income`, Pengeluaran→`view expense`, Transfer→`view transfer`; grup "Arus Kas" `anyPermission: ['view income','view expense','view transfer']`.
- **Bank-accounts** (`pages/bank-accounts/index.tsx`): tombol "Pemasukan"→`create income`, "Pengeluaran"→`create expense`, "Transfer"→`create transfer`.
- **Cash-flow income/expenses** (`pages/cash-flow/income.tsx`, `expenses.tsx`): bulk-delete bar → `delete income` / `delete expense`. Simpan pada edit dialog → `edit income` / `edit expense`.
- **Bank-accounts transactions tab** (`components/transactions-tab.tsx`): tombol delete per-baris digate sesuai tipe baris (income/expense/transfer); bulk delete tampil bila punya minimal satu perm delete relevan.
- **transaction-detail-dialog** (`pages/cash-flow/components/`): tombol simpan digate `edit income`/`edit expense` sesuai `kind`.

Gating frontend murni UX (sembunyikan tombol). Backend tetap sumber kebenaran.

## Seeder & Roles (`MasterPermissionSeeder.php`)

- Tambah 12 permission baru ke daftar `$allPermissions`.
- Hapus 6 permission usang dari daftar.
- **Cleanup DB:** setelah sync, `Permission::whereIn('name', [...obsolete])->delete()` agar tidak menggantung di production (Spatie tidak menghapus otomatis). Jalankan sebelum/ sesudah assignment dengan `permission:cache-reset`.
- **Admin:** otomatis semua via `Permission::all()`.
- **Finance manager:** ganti 6 perm lama (`view/create/edit/delete transactions`, `view/manage cash-flow`) dengan 12 perm baru.
- **Staff:** tidak diubah (tetap tanpa akses cash-flow). User mengelola sisanya via UI Permissions.

## Testing Plan

Feature test (PHPUnit) di `tests/Feature/CashFlowPermissionTest.php`:
- User dengan hanya `create income` → POST store credit **200/redirect**, POST store debit **403**.
- User dengan hanya `create expense` → kebalikannya.
- `edit income` vs `edit expense`: PUT update sesuai tipe model, cross-type → 403.
- `delete income`/`delete expense`: destroy tunggal sesuai tipe; bulk-delete campuran ditolak bila salah satu perm hilang; diterima bila kedua perm dimiliki.
- Transfer: `create transfer` untuk transfer; user tanpa `create transfer` tapi punya `create income` → transfer 403.
- `view income/expense/transfer`: GET tab terkait 200 vs 403.
- Gunakan factory `BankTransaction` + role/permission Spatie via helper.

## Files Touched (perkiraan)

Backend:
- `database/seeders/MasterPermissionSeeder.php`
- `app/Models/BankTransaction.php` (helper resolusi tipe→ability)
- `app/Http/Requests/StoreBankTransactionRequest.php`
- `app/Http/Requests/UpdateBankTransactionRequest.php`
- `app/Http/Requests/BulkDestroyBankTransactionRequest.php`
- `app/Http/Requests/TransferBankTransactionRequest.php`
- `app/Http/Requests/DestroyBankTransactionRequest.php` (baru, opsional)
- `app/Http/Controllers/BankTransactionController.php` (destroy)
- `app/Http/Controllers/CashFlowController.php` (bulkDestroy)
- `routes/web.php`
- `tests/Feature/CashFlowPermissionTest.php` (baru)

Frontend:
- `resources/js/hooks/use-can.ts` (baru)
- `resources/js/layouts/sidebar.tsx`
- `resources/js/pages/bank-accounts/index.tsx`
- `resources/js/pages/bank-accounts/components/transactions-tab.tsx`
- `resources/js/pages/cash-flow/income.tsx`
- `resources/js/pages/cash-flow/expenses.tsx`
- `resources/js/pages/cash-flow/components/transaction-detail-dialog.tsx`

## Open Items (diselesaikan saat planning)

- Gate final untuk `cash-flow.export.*` (perlu cek parameter export apakah per-tab).
- Apakah `DestroyBankTransactionRequest` dibuat sebagai FormRequest terpisah atau otorisasi inline via `Gate::authorize()` di controller — pilih yang paling konsisten dengan sibling.
