# Laporan Laba Rugi (P&L) — Keputusan Desain

> **Tujuan akhir:** sistem dapat menghasilkan Laporan Laba Rugi tingkat perusahaan.
> **Status:** keputusan kebijakan **FINAL** (dikonfirmasi 2026-05-25). Implementasi **belum dimulai**.
> **Sifat laporan:** untuk kebutuhan **manajemen** (bukan audit resmi).

---

## Konteks Bisnis

- Perusahaan **jasa**, **UMKM** (pakai PPh final 0,5% / PP 23/2018 → indikasi basis kas).
- Pendekatan **bertahap**:
  - **Fase 1** — P&L manajemen, dirakit langsung dari data yang sudah ada. (target sekarang)
  - **Fase 2 (opsional, nanti)** — General Ledger + double-entry untuk laporan grade-audit + Neraca. Tidak wajib untuk P&L.

---

## Fondasi yang SUDAH ADA (tidak perlu dibangun lagi)

- Invoice item menyimpan `cogs_amount` (modal per item) → laba kotor per invoice otomatis (`Invoice::gross_profit`, `total_cogs`).
- `transaction_categories.type` bernilai **income / expense / financing / transfer** → sudah memisahkan arus P&L (income/expense) dari arus non-P&L (financing/transfer). Ini bagian tersulit, sudah beres by design.
- Reimbursement (`Reimbursement::recordPayment`) & Fund Request (`FundRequest::disburse`, kolom `bank_transaction_id`) keduanya bermuara ke **`BankTransaction`** → BankTransaction = **satu sumber kebenaran** untuk arus keluar. Menjumlahkan transaksi debit ber-kategori `expense` sudah menangkap reimbursement & fund request sekali (tidak dobel).
- Bank balance = computed (`initial_balance + payments(credit) + tx(credit) − tx(debit)`). **Payment dan BankTransaction TERPISAH** (tidak overlap) → aman dijumlahkan masing-masing.

---

## 4 Keputusan Kebijakan (FINAL)

### 1. HPP dari DUA sumber
- Penjualan **via invoice** → HPP **hanya** dari `invoice_items.cogs_amount`.
- Pendapatan **tanpa invoice** → HPP **hanya** dari transaksi manual (kategori HPP, `BankTransaction` debit).
- **ATURAN ANTI-DOBEL (wajib):** JANGAN mencatat HPP manual untuk penjualan yang sudah punya invoice. Kalau dilanggar, modal terhitung 2× dan laba jadi terlalu kecil.
- Alasan dua sumber: ada beberapa pendapatan yang tidak dibuat lewat invoice.

### 2. Basis KAS
- Pendapatan diakui saat **uang MASUK**, bukan saat invoice diterbitkan.
- Sesuai status UMKM PPh final (berbasis kas).

### 3. Fund Request = LANGSUNG BEBAN
- Begitu dana **dicairkan (disbursed)** → langsung masuk kolom beban di P&L.
- **Bukan** diperlakukan sebagai uang muka (advance) yang baru jadi beban setelah dipertanggungjawabkan.

### 5. TITIPAN PAJAK KLIEN (`is_tax_deposit`) — passthrough, dikecualikan dari P&L (dikonfirmasi 2026-05-26)

Perusahaan ini konsultan pajak. Klien sering **menitipkan uang pajaknya lewat invoice** (PPN, PPh unifikasi/21/final, denda, dll. — istilahnya generic **"titipan pajak"**, bukan PPh saja) supaya konsultan yang menyetorkan ke kas negara atas nama klien. Item invoice yang `is_tax_deposit=true` adalah passthrough:

- **Tidak masuk pendapatan** konsultan (net efek ke P&L = nol)
- **Tidak masuk beban** konsultan saat disetor

Alokasi pembayaran: **"titipan dulu"** — setiap uang masuk menutup titipan dulu sampai lunas, baru sisanya jadi pendapatan jasa. Setelah itu cost-recovery HPP berlaku seperti biasa pada porsi pendapatan jasa.

Rumus per invoice:
```
paid_through_X     = SUM(payments dgn payment_date <= X)
revenue_through_X  = MAX(0, paid_through_X − total_titipan)
cogs_through_X     = MIN(revenue_through_X, total_cogs)
```

**Setor titipan ke negara** dicatat sebagai transaksi keluar dengan **kategori `type=financing`** (mis. "Titipan Pajak Klien") agar otomatis dikecualikan dari P&L.

**Catatan terminologi:**
- "Titipan Pajak Klien" = passthrough (is_tax_deposit di invoice). Tidak masuk P&L.
- "Pajak Perusahaan" = kewajiban pajak perusahaan sendiri (PPh Badan / PPh Final / PPN terutang). MASUK ke baris Pajak Perusahaan di P&L via kategori dengan `pl_group=tax`.
- "PPh" sebagai istilah dihindari di UI titipan karena bisa rancu — titipan bukan cuma PPh.

### 4. Timing HPP invoice = METODE "TUTUP MODAL DULU" (cost recovery)
- Setiap uang masuk dipakai **menutup modal (HPP) dulu** sampai modal tertutup penuh. Baru setelah itu, sisa uang dihitung sebagai laba.
- **Rumus:**
  - HPP diakui s/d suatu tanggal = `MIN(akumulasi_pembayaran_invoice, total_HPP_invoice)`
  - HPP diakui dalam satu periode = `MIN(bayar_kumulatif_akhir, total_HPP) − MIN(bayar_kumulatif_awal, total_HPP)`
- **Contoh** — Invoice Rp 100jt, modal Rp 60jt:

  | | Uang masuk | Modal diakui | Laba kotor |
  |---|---|---|---|
  | Bulan 1 | Rp 50jt | Rp 50jt (semua nutup modal) | Rp 0 |
  | Bulan 2 | Rp 50jt | Rp 10jt (sisa modal) | Rp 40jt |
  | **Total** | Rp 100jt | Rp 60jt | **Rp 40jt** |

- Sifat: **konservatif** — tidak mengakui laba sebelum modal kembali.

---

## Struktur Laporan

```
PENDAPATAN USAHA                                              = A
  • Dari invoice yang dibayar (uang pembayaran yang masuk)
  • Pendapatan tanpa invoice (transaksi masuk, kategori income)

(−) HARGA POKOK (Modal)                                       = B
  • Modal dari invoice (metode "tutup modal dulu")
  • Modal manual (transaksi keluar, kategori HPP)
  ──────────────────────────────────────────────────────────
  = LABA KOTOR                                                = A − B

(−) BEBAN OPERASIONAL                                         = C
  • Transaksi keluar, kategori type=expense (selain HPP)
  • Dikelompokkan per kategori (Makan Minum, Operasional, Admin Bank, dst.)
  • Sudah termasuk reimbursement & fund request yang dibayar
  ──────────────────────────────────────────────────────────
  = LABA USAHA                                                = (A−B) − C

(±) PENDAPATAN / BEBAN LAIN                                   = D
  • Pendapatan Bunga (+)
  • Beban Bunga Pinjaman (−)
  ──────────────────────────────────────────────────────────
  = LABA BERSIH (sebelum pajak)                               = (A−B−C) ± D

(−) PAJAK (PPh)                                               = E   [baris tersendiri]
  ──────────────────────────────────────────────────────────
  = LABA BERSIH                                               = hasil akhir

DIKECUALIKAN (tidak masuk laporan):
  • Semua type=financing (pokok pinjaman, modal/prive, piutang diberikan/diterima)
  • Semua type=transfer (pindah antar-rekening, tukar cash karyawan)
```

---

## Sumber Data per Baris

| Baris | Sumber |
|-------|--------|
| Pendapatan (invoice) | Σ `Payment.amount` dalam periode (basis kas) |
| Pendapatan (non-invoice) | Σ `BankTransaction` credit, kategori `type=income`, dalam periode |
| HPP (invoice) | metode tutup-modal-dulu dari `Payment` vs `Invoice.total_cogs` |
| HPP (manual) | Σ `BankTransaction` debit, kategori HPP, dalam periode |
| Beban Operasional | Σ `BankTransaction` debit, kategori `type=expense` (selain HPP), per kategori |
| Pendapatan Lain | `BankTransaction` credit kategori "Pendapatan Bunga" (income) |
| Beban Lain | `BankTransaction` debit kategori "Beban Bunga Pinjaman" (expense) |
| Dikecualikan | semua `type=financing` + `type=transfer` |

---

## Pembersihan Kategori (disarankan sebelum/saat membangun)

Snapshot kategori per 2026-05-25 punya beberapa yang "salah laci" / akan merusak laporan:

| Kategori | Masalah | Tindakan |
|----------|---------|----------|
| `asdasd` → `Rizky` | data sampah uji coba | **Hapus** |
| `CAPEX → ASET PERUSAHAAN` (expense) | beli aset ≠ biaya; hanya penyusutan yang masuk P&L | tinjau; idealnya keluar dari expense |
| `Operational Expenses → KASBON` | itu piutang karyawan, bukan beban | tinjau; idealnya bukan expense |
| `PENGELUARAN LAIN-LAIN → PEMBAYARAN PIUTANG` | utang-piutang (numpang lewat), tumpang tindih dgn financing | tinjau |
| `PAJAK PERUSAHAAN` (di Operational) | PPh badan biasanya baris sendiri di bawah laba usaha | pindah ke baris pajak (minor) |
| `Penghasilan → Kembali Dana` (income) | refund, mungkin contra bukan pendapatan | tinjau |

> Catatan: penyusutan aset, beban dibayar-di-muka/akrual antar-periode, dan uang muka belum dilacak. Untuk **versi awal** hal-hal ini disederhanakan/diabaikan; bisa disempurnakan di iterasi berikutnya.

---

## Keputusan Teknis: Klasifikasi Kategori → Baris P&L (dikonfirmasi 2026-05-25)

Kolom `transaction_categories.type` (income/expense/financing/transfer) belum cukup untuk P&L karena di dalam "expense" tercampur HPP, beban operasional, beban lain, dan pajak. **Keputusan: tambah kolom `pl_group`** di `transaction_categories` (dipilih ketimbang menebak dari label, supaya akurat & bisa diubah user lewat UI Kategori).

Nilai `pl_group` (hanya berlaku untuk type income/expense; financing & transfer tetap dikecualikan via `type`):

| pl_group | Baris P&L | Untuk type |
|----------|-----------|-----------|
| `revenue` | Pendapatan Usaha | income |
| `other_income` | Pendapatan Lain (mis. bunga) | income |
| `cogs` | Harga Pokok (HPP) | expense |
| `opex` | Beban Operasional | expense |
| `other_expense` | Beban Lain (mis. bunga pinjaman) | expense |
| `tax` | Pajak (PPh) | expense |
| `null` | tidak diklasifikasi / dikecualikan | — |

Catatan: baris **Pendapatan invoice** & **HPP invoice** TIDAK digerakkan kategori — sumbernya Payment + invoice items (cost-recovery). `pl_group` hanya untuk baris berbasis `BankTransaction` (pendapatan non-invoice, HPP manual, beban, pajak).

## Rencana Implementasi (3 langkah, commit per langkah)

1. **Fondasi kategori** — migration kolom `pl_group`; field di form Kategori (React + controller); bereskan kategori sampah/salah-laci; klasifikasi kategori existing ke `pl_group`.
2. **Mesin hitung** — `ProfitLossService` (hitung tiap baris per periode, termasuk cost-recovery HPP per batas periode) + unit test.
3. **Halaman laporan** — controller + Inertia page `reports/profit-loss` (filter periode bulan/kuartal/tahun/custom, tampilan, export) + permission `view reports`/`view profit-loss`.

---

## Keputusan Teknis: Klasifikasi Kategori → Baris P&L (dikonfirmasi 2026-05-25)

Kolom `transaction_categories.type` (income/expense/financing/transfer) belum cukup untuk P&L karena di dalam "expense" tercampur HPP, beban operasional, beban lain, dan pajak. **Keputusan: tambah kolom `pl_group`** di `transaction_categories` (dipilih ketimbang menebak dari label, supaya akurat & bisa diubah user lewat UI Kategori).

Nilai `pl_group` (hanya berlaku untuk type income/expense; financing & transfer tetap dikecualikan via `type`):

| pl_group | Baris P&L | Untuk type |
|----------|-----------|-----------|
| `revenue` | Pendapatan Usaha | income |
| `other_income` | Pendapatan Lain (mis. bunga) | income |
| `cogs` | Harga Pokok (HPP) | expense |
| `opex` | Beban Operasional | expense |
| `other_expense` | Beban Lain (mis. bunga pinjaman) | expense |
| `tax` | Pajak (PPh) | expense |
| `null` | tidak diklasifikasi / dikecualikan | — |

Catatan: baris **Pendapatan invoice** & **HPP invoice** TIDAK digerakkan kategori — sumbernya Payment + invoice items (cost-recovery). `pl_group` hanya untuk baris berbasis `BankTransaction` (pendapatan non-invoice, HPP manual, beban, pajak).

## Rencana Implementasi (3 langkah, commit per langkah)

1. **Fondasi kategori** — migration kolom `pl_group`; field di form Kategori (React + controller); bereskan kategori sampah/salah-laci; klasifikasi kategori existing ke `pl_group`.
2. **Mesin hitung** — `ProfitLossService` (hitung tiap baris per periode, termasuk cost-recovery HPP per batas periode) + unit test.
3. **Halaman laporan** — controller + Inertia page `reports/profit-loss` (filter periode bulan/kuartal/tahun/custom, tampilan, export) + permission `view reports`/`view profit-loss`.
