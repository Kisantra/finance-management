# Pendanaan di Arus Kas & template kategori (Opsi A)

Setoran modal, prive, setor PPN, dan setor titipan pajak klien kini bisa **dicatat lewat Catat Pemasukan / Catat
Pengeluaran** sebagai **Pendanaan**: uangnya menggeser saldo rekening, tetapi **tidak masuk Laba Rugi**. Di daftar
Arus Kas barisnya diberi badge **Pendanaan** dan nominalnya dirinci di **kartu terpisah**. Pokok utang/piutang dari
menu Utang/Piutang ikut tampil, **hanya-lihat**. Template kategori mendapat bagian ketiga **Pendanaan**.

Tab tetap tiga (Semua · Pemasukan · Pengeluaran) — Opsi A yang disetujui; tab Pendanaan terpisah (Opsi B) tidak
dibuat.

**Masalah yang diselesaikan.** Pemilih kategori dulu hanya berisi kategori pemasukan/pengeluaran (+ transfer).
Staf terpaksa memilih kategori pendapatan/beban untuk setoran modal atau setor PPN → **Laba Rugi salah tanpa
tanda**; atau tidak mencatat sama sekali → saldo rekening (dihitung dari transaksi) tidak cocok dengan bank. Aturan
Laba Rugi sudah lama mewajibkan setor PPN & titipan pajak bertipe `financing`, tetapi kategorinya tidak bisa dipilih.

Tidak ada perubahan skema database atau izin. Laporan Laba Rugi tidak berubah. Perusahaan yang sudah berjalan
mendapat kategori pendanaannya lewat **Pakai Template** (5 kategori baru); perusahaan baru langsung berisi semuanya.

---

## Sebelum → sesudah

Semua screenshot memakai **data contoh yang sama** (perusahaan QA "PT Pendanaan Lama QA" di lingkungan terisolasi).
"Sebelum" diambil dari kode `main` (`1646872`) **sebelum** kode diubah; "sesudah" dari cabang `fitur/pendanaan`.

### 1. Pemilih kategori di Catat Pengeluaran

| Sebelum — grup terakhir **Transfer Internal**, tidak ada tempat untuk setor PPN | Sesudah — grup terakhir **Pendanaan · tidak masuk Laba Rugi**, dipisah garis |
|---|---|
| ![Sebelum: pemilih tanpa grup Pendanaan](screens/01-sebelum-pemilih.webp) | ![Sesudah: grup Pendanaan di bawah](screens/02-sesudah-pemilih.webp) |

| Setelah sub pendanaan dipilih: penanda + petunjuk | Grup yang sama di Catat Pemasukan |
|---|---|
| ![Penanda Pendanaan dan petunjuk saldo berkurang](screens/03-sesudah-petunjuk.webp) | ![Setoran Modal Pemilik di Catat Pemasukan](screens/04-sesudah-pemilih-pemasukan.webp) |

### 2. Daftar Pengeluaran + kartu ringkasan

**Sebelum** — kartu *Total Pengeluaran · Jumlah Transaksi · Periode*; pendanaan tidak tampil sama sekali.

![Sebelum: daftar Pengeluaran](screens/05-sebelum-pengeluaran.webp)

**Sesudah** — kartu **Beban (masuk Laba Rugi) · Pendanaan (tidak masuk Laba Rugi) · Total keluar** ("Beban +
Pendanaan"). Setor PPN berbadge **Pendanaan**; pokok utang dari menu Utang bergembok, **Hanya-lihat · kelola di
Utang →**; bunganya tetap beban biasa.

![Sesudah: daftar Pengeluaran dengan badge, baris hanya-lihat, kartu terpisah](screens/06-sesudah-pengeluaran.webp)

> Di layar tepat 1280 px kolom Jumlah perlu digulir ke samping di dalam kartu bila deskripsinya panjang (lihat
> *Catatan*). Di 1440 px semuanya muat.

### 3. Tab Pemasukan dan tab Semua

| Pemasukan — sebelum | Pemasukan — sesudah: **Pemasukan (masuk Laba Rugi)** termasuk pembayaran invoice · **Pendanaan** · **Total masuk** |
|---|---|
| ![Sebelum: Pemasukan](screens/07-sebelum-pemasukan.webp) | ![Sesudah: Pemasukan](screens/08-sesudah-pemasukan.webp) |

| Semua — sebelum | Semua — sesudah: tiap kartu menyebut porsi pendanaan; Selisih juga "tanpa pendanaan" |
|---|---|
| ![Sebelum: Semua](screens/09-sebelum-semua.webp) | ![Sesudah: Semua](screens/10-sesudah-semua.webp) |

### 4. Pakai Template

| Sebelum — berakhir di Pengeluaran, "Setiap kategori sudah punya baris Laba Rugi" | Sesudah — bagian ketiga **Pendanaan** ("Tidak masuk Laba Rugi"); Setoran/Penarikan Modal lama **Sudah ada** |
|---|---|
| ![Sebelum: Pakai Template tanpa Pendanaan](screens/11-sebelum-template.webp) | ![Sesudah: bagian Pendanaan](screens/12-sesudah-template.webp) |

Di perusahaan lama ringkasannya **Baru 5 · Sudah ada 69 · Dilewati 0** (persis mockup):

![Ringkasan Pakai Template di perusahaan lama](screens/13-sesudah-template-ringkasan.webp)

### 5. Laba Rugi tetap sama

| Sebelum (kode `main`) | Sesudah, setelah setoran modal Rp 25.000.000 dan setor PPN Rp 3.300.000 dicatat |
|---|---|
| ![Laba Rugi sebelum](screens/14-sebelum-laba-rugi.webp) | ![Laba Rugi sesudah](screens/15-sesudah-laba-rugi.webp) |

Bukan hanya tampilannya: keluaran `ProfitLossService` untuk November dibandingkan **seluruh strukturnya** di
database sebelum dan sesudah pendanaan dicatat — identik (laba bersih Rp 2.655.000).

### 6. Pokok utang: tautan ke Utang & Kas & Bank hanya-lihat

| Klik **kelola di Utang** → halaman Utang tersaring nomor utangnya | Kas & Bank: baris pencairan tanpa tombol hapus |
|---|---|
| ![Halaman Utang tersaring LOAN-00001](screens/16-utang-tautan.webp) | ![Kas & Bank hanya-lihat](screens/17-kas-bank-hanya-lihat.webp) |

### 7. Ponsel (390 px)

| Sebelum | Sesudah — kartu bertumpuk | Sesudah — badge di bawah deskripsi, baris hanya-lihat |
|---|---|---|
| <img src="screens/18-sebelum-ponsel.webp" alt="Ponsel sebelum" width="240"> | <img src="screens/19-sesudah-ponsel.webp" alt="Ponsel sesudah" width="240"> | <img src="screens/20-sesudah-ponsel-bawah.webp" alt="Ponsel sesudah, tabel" width="240"> |

---

## Yang berubah

### 1. Mencatat pendanaan

- Pemilih **Kategori** di dialog bersama Catat Pemasukan/Pengeluaran (Arus Kas dan header rekening Kas & Bank) punya
  **grup terakhir** "Pendanaan · tidak masuk Laba Rugi": induk `financing` non-sistem sebagai judul, sub-nya bisa
  dipilih. Grupnya sama untuk masuk dan keluar (setoran modal masuk, prive keluar, restitusi PPN masuk).
- Setelah dipilih: penanda **Pendanaan** di pemicu + petunjuk *"Pendanaan: saldo {rekening} bertambah/berkurang
  Rp X, Laba Rugi tidak berubah."* (tanpa nominal selama Jumlah kosong). Dialog ubah memakai grup & petunjuk yang sama.
- Server menolak dengan pesan terbaca: **kategori sistem** (pokok utang/piutang, bunga — "dipakai otomatis oleh
  modul Utang/Piutang … Catat lewat menu Utang atau Piutang."), **induk yang punya anak**, dan **induk pendanaan
  tanpa anak**. Saat mengubah transaksi, kategori hanya diperiksa bila diganti.

### 2. Daftar, kartu, filter

- Tab Semua/Pemasukan/Pengeluaran memuat pendanaan searah transaksinya, berbadge **Pendanaan** (netral: jenis,
  bukan arah/status).
- Kartu: Pengeluaran **Beban · Pendanaan · Total keluar**; Pemasukan **Pemasukan · Pendanaan · Total masuk**;
  Semua **Total masuk/keluar** ("Termasuk pendanaan Rp …") + **Selisih** ("Tanpa pendanaan: …").
- Filter Kategori punya grup Pendanaan (+ kategori pokok utang/piutang di bawah "Dari Utang & Piutang").

### 3. Pokok utang/piutang hanya-lihat

- Baris berkategori sistem `FIN-LOAN-*` / `FIN-RCV-*`: gembok, tanpa centang/hapus massal/dialog ubah, tautan
  **kelola di Utang/Piutang** ke data spesifiknya: `?search=` nomor utang/piutang untuk pencairan dan pembayaran pokok
  piutang; untuk pembayaran pokok **utang** ke halaman Utang tersaring **nama pemberi pinjaman** (nomor utangnya tidak
  tercatat di transaksi). Tautan tampil hanya bila pengguna boleh melihat modul itu.
- Server menolak ubah/hapus lewat `PUT/DELETE /bank-transactions/{id}`, `POST /bank-transactions/bulk-delete`,
  `POST /cash-flow/bulk-delete` (403 berpesan). Modul Utang/Piutang tidak terpengaruh. Pencairan utang **yatim**
  (data lama, utangnya sudah tidak ada) sengaja tidak dikunci agar saldo tetap bisa dikoreksi.

### 4. Ekspor

- Excel tab Semua: baris pendanaan ikut, kolom baru di **akhir** — `Jenis (Laba Rugi/Pendanaan)`; 10 kolom lama tidak
  bergeser.
- PDF buku mutasi rekening (sejak dulu memuat semua transaksi): kategori pendanaan diberi awalan "Pendanaan · ".

### 5. Template kategori (15 induk / 59 sub)

- Bagian ketiga **Pendanaan** (`financing`, tanpa grup Laba Rugi): Setoran Modal → Setoran Modal Pemilik; Penarikan
  Modal → Prive Pemilik; Pajak Titipan & PPN → Setor PPN, Setor Titipan Pajak Klien.
- Seeder perusahaan baru tidak lagi mendefinisikan Setoran/Penarikan Modal sendiri (satu sumber: template) →
  perusahaan baru 82 kategori (sebelumnya 77).
- Halaman Kategori: badge tipe Pendanaan netral, kolom Grup L/R "Tidak masuk Laba Rugi".

### 6. Komponen katalog (kompatibel mundur)

- `Combobox`: opsi `section` (judul bagian bergaris, tetap tampil saat mencari) dan `tag` (penanda di pemicu).
- `StatsCard`: prop `hint`.
- Baru: `components/shared/financing.tsx` — `FinancingBadge`, `FinancingHint`, `ManagedByNote`, `withFinancingGroup()`.

---

## Cara kerjanya (singkat)

1. `TransactionCategory::financingOptions()` membangun grup pendanaan (non-sistem, sub saja) dan selalu ditambahkan
   **di akhir** opsi pemilih (`transactionOptions()` dan `/api/transaction-categories?type=credit|debit`).
2. `CashFlowController` memperluas filter tipe kategori menjadi `income|financing` (masuk) dan `expense|financing`
   (keluar) di ketiga tab — tab Semua tetap gabungan persis dua tab lainnya — dan menghitung porsi pendanaan dalam
   query ringkasan yang sama.
3. `BankTransaction::moduleLockMessage()` / `moduleLinks()` menentukan baris hanya-lihat dan tautannya (satu query per
   halaman); request & controller ubah/hapus memeriksanya.
4. `ProfitLossService` tidak diubah: pendanaan sudah dikecualikan lewat tipenya.

## File yang berubah

| File | Isi |
|---|---|
| `app/Http/Controllers/CashFlowController.php` | Tiga tab memuat pendanaan; `ringkasanTab()`, porsi pendanaan tab Semua, `jenisBaris()`, opsi filter |
| `app/Models/TransactionCategory.php` | `POKOK_MODUL`, `financingOptions()`, `transactionOptions()`, `managingModule()` |
| `app/Models/BankTransaction.php` | `managingModule()`, `moduleLockMessage()`, `moduleLinks()` |
| `app/Http/Requests/Concerns/MemeriksaKategoriTransaksi.php` | **Baru** — aturan kategori pencatatan & pengubahan |
| `app/Http/Requests/{Store,Update,BulkDestroy}BankTransactionRequest.php` | Validasi kategori, penolakan baris hanya-lihat |
| `app/Http/Controllers/BankTransactionController.php` | Hapus ditolak untuk pokok utang/piutang; JSON tab Kas & Bank membawa `managed_by` |
| `app/Exports/ArusKasExport.php`, `app/Services/CashFlowExportService.php` | Kolom Jenis di akhir; awalan Pendanaan di PDF |
| `app/Services/CategoryTemplateService.php`, `database/seeders/TransactionCategorySeeder.php` | Bagian Pendanaan; seeder satu definisi |
| `routes/web.php` | `/api/transaction-categories`: grup Pendanaan terakhir |
| `resources/js/components/ui/combobox.tsx`, `components/shared/stats-card.tsx`, `components/shared/financing.tsx` | Katalog |
| `resources/js/pages/cash-flow/{all,income,expenses}.tsx`, `components/transaction-detail-dialog.tsx`, `types.ts` | Badge, kartu, baris hanya-lihat, filter |
| `resources/js/pages/bank-accounts/components/{transaction-form-dialog,transactions-tab}.tsx`, `types.ts` | Grup + petunjuk; baris hanya-lihat |
| `resources/js/pages/transaction-categories/{index.tsx,components/template-dialog.tsx}` | Bagian Pendanaan; badge netral |
| `tests/Feature/PendanaanTest.php` (**baru**, 16 tes), `ArusKasSemuaTest`, `CategoryTemplateServiceTest`, `TransactionCategoryTemplateTest`, `TransactionCategorySeederTest`, `tests/Tenancy/ProvisioningPipelineTest.php` | Tes |
| `docs/module/{cash-flow,transaction-categories,profit-loss,dashboard,bank-accounts,loans,receivables,README}.md`, `CLAUDE.md` | Dokumentasi |
| `video/cash-flow/*`, `video/transaction-categories/*`, `video/capture/{cash-flow,transaction-categories}.js` | Panduan, bab video baru, screenshot diambil ulang |
| `docs/qa/2026-11-09-pendanaan/` | QA berbukti (12 case) |

## Cara mencoba

1. `npm run build` (atau `composer dev`), login sebagai finance manager di perusahaan yang sudah berjalan.
2. **Operasional › Kategori Transaksi › Pakai Template** → bagian Pendanaan: 5 baru → **Buat 5 kategori**.
3. **Arus Kas › Pengeluaran › Input Pengeluaran** → Kategori → gulir ke paling bawah → **Setor PPN** → lihat penanda &
   petunjuk → simpan → kartu **Pendanaan** terisi, **Laporan › Laba Rugi** tidak berubah.
4. Catat utang di **Utang & Piutang › Utang** → di Arus Kas barisnya bergembok, tautan **kelola di Utang**.

## Pengujian

- [x] `npm run types` dan `npm run build` lolos (`public/hot` dev server tetap utuh)
- [x] `tests/Feature/PendanaanTest.php` 16 tes + tes kategori/template/seeder/Arus Kas yang diperbarui
- [x] Suite penuh `php artisan test --compact`: **969 lulus, 2 dilewati, 0 gagal** (4.940 asersi) di `6cde0d1`
- [x] QA berbukti 12 case (N/A/C), semua lolos: [`docs/qa/2026-11-09-pendanaan`](../../qa/2026-11-09-pendanaan/README.md)

## Catatan

- **Perilaku yang sengaja berubah**: tab Semua/Pemasukan/Pengeluaran kini memuat pendanaan (dulu dikecualikan), jadi
  angka Total masuk/keluar naik sebesar pendanaan — dan kini **sama dengan Ringkasan** (yang sejak dulu menghitungnya).
- **Kolom Excel** bernama `Jenis (Laba Rugi/Pendanaan)`, bukan `Jenis` polos, karena kolom ke-2 sudah bernama
  "Jenis" (Masuk/Keluar).
- **Induk pendanaan tanpa anak ditolak** untuk transaksi (permintaan aslinya: hanya sub yang bisa dipilih); kalau
  diizinkan, induk yang terpakai langsung membuat Pakai Template melewati grupnya.
- **Kategori sistem bunga** (`EXP-INTEREST`/`REV-INTEREST`) juga ditolak saat dipilih lewat payload rakitan untuk
  transaksi **baru** (pemilih memang tidak pernah menawarkannya); transaksi bunga lama tetap bisa diubah.
- Di layar tepat **1280 px**, tabel Pengeluaran dengan deskripsi panjang meluap ±40 px di dalam kartu (kolom Jumlah
  digulir ke samping). Baris tanpa pendanaan berdeskripsi panjang juga begitu; tidak diubah di PR ini.
- Data di screenshot adalah data contoh dari lingkungan QA, bukan data perusahaan.
