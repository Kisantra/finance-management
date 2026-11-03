# Laporan QA — Finance Management, branch `multi-tenancy`

Pengujian menyeluruh 17 modul aplikasi setelah migrasi ke arsitektur
database-per-perusahaan. Dijalankan 19 Agustus 2026 di lingkungan lokal
terisolasi (`APP_ENV=local`, DB pusat `finance_central`) — **bukan production**.
Rincian lingkungan & cara baca tabel: [`../README.md`](../README.md).

## Papan skor

Dihitung otomatis dari dokumen sumber oleh [`../scoreboard.py`](../scoreboard.py)
— tidak pernah dihitung tangan.

```
646  test case dieksekusi
550  lolos
 91  gagal
  3  belum diuji (tidak dibulatkan menjadi lolos)
  2  berstatus campuran (sengaja tidak dibulatkan)
```

| Modul | Case | Lolos | Gagal |
|---|---:|---:|---:|
| [invoices](../test-cases/invoices.md) | 72 | 54 | 18 |
| [cash-flow](../test-cases/cash-flow.md) | 56 | 50 | 6 |
| [settings](../test-cases/settings.md) | 50 | 47 | 3 |
| [fund-requests](../test-cases/fund-requests.md) | 47 | 37 | 10 |
| [recurring-invoices](../test-cases/recurring-invoices.md) | 44 | 37 | 7 |
| [transaction-categories](../test-cases/transaction-categories.md) | 41 | 35 | 6 |
| [bank-accounts](../test-cases/bank-accounts.md) | 37 | 28 | 7 |
| [feedbacks](../test-cases/feedbacks.md) | 35 | 34 | 1 |
| [receivables](../test-cases/receivables.md) | 34 | 23 | 10 |
| [clients](../test-cases/clients.md) | 32 | 26 | 6 |
| [reimbursements](../test-cases/reimbursements.md) | 32 | 24 | 8 |
| [profit-loss](../test-cases/profit-loss.md) | 28 | 25 | 2 |
| [loans](../test-cases/loans.md) | 26 | 20 | 6 |
| [admin-users-permissions](../test-cases/admin-users-permissions.md) | 25 | 25 | 0 |
| [services](../test-cases/services.md) | 25 | 25 | 0 |
| [dashboard](../test-cases/dashboard.md) | 22 | 21 | 1 |
| [notifications](../test-cases/notifications.md) | 22 | 21 | 0 |
| [auth-multitenancy](../test-cases/auth-multitenancy.md) | 18 | 18 | 0 |

## Ringkasan dalam satu paragraf

Fondasi multi-tenancy **kokoh**: isolasi data antar perusahaan terbukti di level
database maupun HTTP (perusahaan asing 403, slug tak dikenal 404, tabel bisnis
tidak pernah ada di database pusat), dan otorisasi granular Cash Flow —
bagian tersulit di aplikasi ini — berperilaku persis seperti dirancang. Namun
**empat fungsi utama sama sekali tidak bisa dipakai** di konteks perusahaan
(manajemen user, pembuatan piutang, lampiran, unduh PDF invoice), dan ditemukan
**empat celah otorisasi** yang membiarkan user biasa membaca atau menghapus data
milik orang lain. Sepuluh temuan terparah sudah diperbaiki dan diberi test
regresi; sisanya terdokumentasi menunggu keputusan prioritas.

## Sudah diperbaiki (10, semua bertest regresi)

| # | Temuan | Sifat | Inti masalah |
|---|---|---|---|
| 1 | Menu 404 tepat setelah login | Blocker | Slug perusahaan disimpan di variabel modul, di-set lewat event `navigate` yang menyala **setelah** sidebar ter-render → seluruh menu kehilangan prefix `/c/{slug}` sampai halaman di-reload |
| 2 | Semua lampiran & logo gagal dimuat | Blocker | Root disk `public` dipindah per perusahaan, tetapi URL bacanya tidak — 16 pemanggilan `Storage::url()` memakai disk **default** (`local`). Sekaligus: hook `deleting` di 4 model salah disk → berkas lampiran tidak pernah benar-benar terhapus |
| 3 | User login membuka `/login` → 500 | Tinggi | `RedirectIfAuthenticated` bawaan memanggil `route('dashboard')` yang kini ber-parameter `{company}` |
| 4 | Manajemen user & role rusak total | Blocker | 7 aturan `exists:`/`unique:` menunjuk tabel pusat tetapi berjalan di koneksi tenant → `Table 'tenant_x.roles' doesn't exist` |
| 5 | Piutang mustahil dibuat/diedit | Blocker | Form multipart mengirim `installment_months` sebagai string; `Carbon::addMonths()` bertipe `int` → 500 |
| 6 | Staff membaca seluruh reimbursement orang lain | Tinggi (keamanan) | `?tab=all` diterima apa adanya; server tidak pernah membatasi ke milik sendiri |
| 7 | Staff menghapus reimbursement orang lain | Tinggi (keamanan) | `canDelete()` berkomentar *"owner only"* tetapi `user_id` tidak pernah diperiksa |
| 8 | Staff menghapus fund request orang lain | Tinggi (keamanan) | Akar sama dengan #7; asimetris dengan `update()`/`submit()` yang sudah mengecek |
| 9 | Siapa pun yang login menimpa profil perusahaan | Tinggi (keamanan) | Route `/settings/company` tanpa gate sama sekali. Ditambahkan permission `manage company profile` |
| 10 | 500 saat field opsional tidak dikirim | Sedang | `notes` / `description` nullable diakses tanpa `??` di Receivable & Reimbursement |

## Belum diperbaiki — butuh keputusan Anda

Yang tersisa bukan sekadar bug teknis; beberapa menyangkut kebijakan produk.

### Uang & integritas data

- **Tidak ada batas pembayaran di empat modul.** Reimbursement, pinjaman,
  piutang, dan invoice semuanya menerima pembayaran melebihi sisa; kas terpotong
  penuh dan sisa menjadi negatif (contoh terbukti: piutang pokok Rp 6 jt dibayar
  Rp 13,5 jt → sisa −Rp 7,5 jt). *Keputusan: tolak kelebihan, atau izinkan dan
  catat sebagai kelebihan bayar?*
- **Hapus klien merusak invoice klien lain.** Item milik klien terhapus ikut
  lenyap dari invoice pihak lain (header vs jumlah item jadi tidak cocok), dan
  pembayaran ikut terhapus lewat FK cascade — saldo turun tanpa peringatan.
- **Hapus rekening bank menghapus pembayaran** tanpa menghitung ulang status
  invoice: pembayaran nol tetapi invoice tetap `partially_paid`.
- **Menghapus pengajuan/loan/piutang tidak pernah mengoreksi mutasi bank** yang
  sudah tercatat → pengeluaran yatim di arus kas.
- **Uang hilang diam-diam dari Laporan Laba Rugi**: transaksi yang arahnya tidak
  cocok dengan tipe kategorinya tidak masuk baris laporan **maupun** bucket
  unclassified — jaring pengaman yang justru bocor.
- **Bunga pinjaman & piutang tidak masuk P&L** karena seeder tidak mengisi
  `pl_group` pada kategori sistem `EXP-INTEREST` / `REV-INTEREST`. Berdampak ke
  semua tenant baru.

### Kontrol & kebocoran lintas perusahaan

- **Nomor invoice sepenuhnya ditentukan klien** — endpoint `send` menerima nomor
  apa pun; `generateInvoiceNumber()` tidak pernah dipanggil controller mana pun.
  Nomor tanpa pola `/INV/` bahkan terkunci permanen (tidak bisa di-rollback).
- **Staff bisa `send` dan `rollback` invoice** hanya bermodal `view invoices`.
- **`userOptions` bocor lintas perusahaan** — nama user tenant lain muncul di
  dropdown pemohon.
- **Kategori induk bisa dipakai transaksi lewat API** meski UI melarangnya;
  dialog reassign juga menerima kategori induk.
- **Tidak ada pengecekan tipe kategori vs arah transaksi** — kategori pendapatan
  bisa dipakai pada pengeluaran dan muncul di grafik yang salah.
- **Nama database & SQL bocor** lewat error 500 dari parameter `sort` yang tidak
  divalidasi pada tab transaksi.

### Alur yang gagal diam-diam

- **Pengajuan ditolak tidak bisa diajukan ulang** (fund request & reimbursement):
  `submit()` mengembalikan `false` tetapi antarmuka tetap menampilkan flash
  **sukses**. Pengguna mengira berhasil padahal tidak.
- **Unduh PDF invoice 500 di tenant baru** — `company_profiles.bank_accounts`
  NULL sementara template melakukan `foreach` atasnya, dan form profil perusahaan
  tidak punya field untuk mengisinya.
- **Publish recurring tidak menyalin `is_tax_deposit` & `unit`** → invoice hasil
  publish punya subtotal yang tidak cocok dengan jumlah itemnya, dan pemisahan
  titipan pajak di PDF maupun P&L jadi salah.
- **Fallback dashboard mengunci pengguna**: akun tanpa `view dashboard` dan tanpa
  `view expense` dilempar ke halaman yang juga menolaknya — tidak ada satu layar
  pun yang bisa dibuka.

Daftar lengkap beserta bukti, langkah reproduksi, dan lokasi kode ada di bagian
**Temuan** pada masing-masing dokumen test case.

## Cara pengujian dijalankan

Enam belas modul dikerjakan **lima agent paralel**, masing-masing di perusahaan
(database) sendiri — `qa-satu` … `qa-lima` — sehingga tidak ada agent yang
merusak data agent lain. Pembuatan kelima perusahaan itu sekaligus membuktikan
fitur provisioning bekerja (4–12 detik per perusahaan, 22 tabel + 28 kategori).

Modul **Admin Users & Permissions** sengaja **tidak** diparalelkan: ia memutasi
`users`/`roles`/`permissions` di database pusat yang dipakai bersama semua agent;
mematikan permission sebuah role di tengah run akan memalsukan hasil modul lain.
Modul itu dijalankan supervisor secara serial setelah semua agent selesai,
memakai role sekali-pakai, dan integritas data bersama diverifikasi ulang
sesudahnya (3 user, 3 role, 75 permission utuh, ketiga akun masih bisa login).

Seluruh case dieksekusi lewat **HTTP dengan cookie sesi asli** dan diverifikasi
ke database — bukan diasumsikan dari kode. Modul Autentikasi & Multi-Tenancy juga
diuji lewat **UI sungguhan** di Chrome.

## Masalah tooling pengujian

Bukan cacat aplikasi; dicatat agar celah dalam rekaman tidak terlihat seperti
kelalaian.

- Berkas respons bawaan helper (`/tmp/qa_body.txt`) sempat dipakai bersama
  beberapa agent sehingga satu agent membaca respons agent lain; helper dipindah
  ke berkas per-sesi sebelum satu pun hasil dicatat.
- PHP di Windows tidak memetakan `/tmp` seperti Git Bash → beberapa skrip
  pembantu gagal membaca berkas dan diulang dengan path absolut.
- Klik lewat automasi browser sempat tidak memicu navigasi karena tata letak
  bergeser saat grafik ApexCharts render ulang; klik programatik pada elemen yang
  sama berhasil. **Ini kegagalan alat uji, bukan aplikasi.**
- Satu skrip supervisor melanjutkan query dengan variabel kosong setelah request
  500, memunculkan galat SQL beruntun di output — efek lanjutan skrip, bukan
  perilaku aplikasi.

## Catatan kejujuran

Sebagian besar kode yang diuji di sini ditulis oleh asisten yang sama yang
menjalankan pengujian, sehingga ada risiko pengujian mewarisi asumsi yang sama
dengan asumsi saat menulis kodenya. Satu bukti nyata risiko itu muncul dalam
sesi ini: perbaikan lampiran (temuan #2) sempat **dinyatakan selesai** oleh
supervisor padahal belum — verifikasinya menguji route-nya, bukan URL yang
benar-benar dihasilkan aplikasi. Agent QA yang menemukan kekeliruan itu, dan
perbaikannya baru lengkap setelah 16 pemanggilan `Storage::url()` ikut diubah.

**Yang sebaiknya diperiksa manusia secara independen:**

1. Buka satu invoice yang sudah dibayar sebagian di UI, unggah bukti bayar baru,
   lalu **pastikan gambarnya benar-benar tampil** di layar detail — bukan sekadar
   tersimpan dengan path yang benar. Jalur berkas adalah bagian yang paling
   sering tampak beres di test tetapi rusak di mata pengguna.
2. Periksa apakah kebijakan "pembayaran boleh melebihi sisa" memang diinginkan,
   karena empat modul saat ini mengizinkannya dan itu langsung memotong kas.

Aspek yang **tidak** diuji dan dinyatakan demikian: seluruh perilaku visual UI
React di 16 modul (bell/drawer notifikasi, kanvas editor template, tombol
feedback melayang), isi baris berkas Excel/PDF hasil ekspor (hanya tipe dan
ukuran yang diperiksa), paste-clipboard pada unggah berkas, dan race penomoran
saat pengajuan bersamaan.
