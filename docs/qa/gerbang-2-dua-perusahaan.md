# Gerbang 2 — Bukti QA dua perusahaan, setiap modul, nol kebocoran

**Branch:** `feature/multi-tenancy-rekonsiliasi` · **Tanggal uji:** 2 November 2026
**Metode:** HTTP sungguhan ke `php artisan serve` di `127.0.0.1:8101`, sesi login nyata
(cookie + CSRF). **Tidak ada** `actingAs()`, tidak ada `TestCase::call()`.
**Lingkungan terisolasi:** central `qa_central`, tenant `tenant_qaalpha` + `tenant_qabeta`,
`SESSION_COOKIE=qa_d_session`, `CACHE_PREFIX=qa_d_`. `.env` tidak diubah.
**Tidak ada satu pun berkas produksi yang disentuh** (`git status`: hanya `docs/qa/` + `storage/qa-d/`).

---

## 1. Ringkasan: **TIDAK LULUS**

Isolasi database-per-perusahaan itu sendiri **terbukti utuh**: dari 504 probe halaman
(63 route GET × 2 perusahaan × 4 pengguna), 236 respons 200 disapu untuk penanda
perusahaan lawan dan **230 bersih**; 180 kolom teks di kedua database tenant disapu dan
**0 baris** memuat penanda lawan; 24 probe akses paksa lintas perusahaan menjawab 404/403
sesuai harapan di 23 kasus (1 penyimpangan terbukti bukan kebocoran); lampiran terkunci
per perusahaan (8/8 pemeriksaan lulus); izin dihitung ulang per perusahaan (70 vs 21 izin,
bergantian dua putaran); dan **seluruh enam alur tulis inti selesai penuh di kedua
perusahaan** dengan nomor invoice yang benar-benar independen (urutan 1 lalu 2 di masing-
masing, bukan 1 lalu 3). Yang menggagalkan gerbang ini adalah **tabel yang hidup di
database central**, persis titik lemah yang sudah dicurigai: `/admin/users` melisting dan
**bisa mengubah** pengguna seluruh perusahaan, dan daftar feedback membocorkan isi feedback
perusahaan lain ke admin perusahaan tetangga. Enam dari 236 halaman bocor, dan keenamnya
ada di dua endpoint central itu. Sampai Temuan 1 dan 2 ditutup, aplikasi ini belum boleh
dipakai dua perusahaan yang tidak saling percaya.

---

## 2. Cara mereproduksi, dari nol

Prasyarat: MySQL di `127.0.0.1:3306` (root), aset frontend sudah `npm run build`.

```bash
cd /d/Laravel/finance-management

# 1. Bangun lingkungan (idempoten; menolak jalan kalau nama DB bukan qa_*/tenant_qa*)
bash docs/qa/bangun-dua-perusahaan.sh

# 2. Dev server terisolasi (cookie + cache prefix sendiri)
SESSION_COOKIE=qa_d_session CACHE_PREFIX=qa_d_ DB_DATABASE=qa_central \
  php artisan serve --host=127.0.0.1 --port=8101

# 3. Rangkaian uji (di terminal lain)
php storage/qa-d/sweep.php      # D.2 matriks 504 probe + D.3.1 penanda silang
php storage/qa-d/paksa.php      # D.3.2 akses paksa lintas perusahaan
php storage/qa-d/kebocoran.php  # D.3.3 lampiran, D.3.4 tabel central, D.3.5 konteks izin
php storage/qa-d/pilih.php      # D.4 alur pemilihan perusahaan
php storage/qa-d/tulis.php      # D.5 enam alur tulis penuh
php storage/qa-d/verify.php     # sapu kolom + nomor invoice independen + folder lampiran
```

Pengguna (sandi semuanya `QaGerbang#2026`):

| Email | Peran | Perusahaan |
|---|---|---|
| `alpha-admin@qa.test` | admin | **hanya** qaalpha |
| `beta-admin@qa.test` | admin | **hanya** qabeta |
| `both-manager@qa.test` | finance manager | qaalpha **dan** qabeta |
| `alpha-staff@qa.test` | staff | **hanya** qaalpha |
| `nobody@qa.test` | — | tanpa perusahaan |
| `mixed-roles@qa.test` | finance manager / staff | qaalpha / qabeta (**tambahan**, lihat §7) |

Data uji bertanda `ALPHA-<modul>-01` / `BETA-<modul>-01` di klien, layanan, rekening,
kategori, invoice, item, pembayaran, transaksi bank, reimbursement (dengan lampiran),
fund request, pinjaman, piutang, template recurring, template PDF, feedback, notifikasi.
Id qabeta sengaja dimulai dari **501** supaya uji akses paksa punya arti (lihat §7).

Berkas keluaran: `storage/qa-d/01-bangun.log`, `02-matriks.csv`, `03-penanda-silang.log`,
`03-akses-paksa.log`, `03-kebocoran.log`, `04-pilih-perusahaan.log`, `05-tulis.log`,
`05-tulis.json`, `05-verifikasi.log`.

---

## 3. Matriks halaman (D.2)

Daftar halaman diturunkan dari sumber otoritatif `php artisan route:list --json`
(`storage/qa-d/routes.json`), difilter metode **GET** di bawah `c/{company}`:
**63 route**. Setiap (halaman × perusahaan × pengguna) ditembak satu kali.
CSV penuh: **`storage/qa-d/02-matriks.csv`** (kolom `halaman,perusahaan,pengguna,status,ukuran,komponen_inertia,catatan`).

| Status | Jumlah | Keterangan |
|---|---:|---|
| 200 | 236 | semuanya merender komponen Inertia yang benar, atau PDF/Excel/JSON/berkas sesuai jenis route |
| 403 | 239 | 189 karena bukan anggota perusahaan + 50 karena izin peran (rincian di bawah) |
| 302 | 24 | redirect yang memang dirancang (5 halaman, rincian di bawah) |
| 500 | 5 | **semua** di `/c/{slug}/api/invoices/next-sequence` → **Temuan 4** |
| 404 | 0 | — |
| tidak diuji | 0 | tiap parameter route punya id nyata |
| **total** | **504** | 63 × 2 × 4 |

Komponen pada 236 respons 200 (kutipan): `dashboard` 5, `invoices/index` 10,
`invoices/create` 5, `invoices/edit` 4, `clients/index` 5, `services/index` 5,
`bank-accounts/index` 4, `cash-flow/{income,expenses,transfers}` 4 masing-masing,
`transaction-categories/index` 4, `reimbursements/index` 5, `fund-requests/index` 5,
`fund-requests/create` 5, `loans/index` 4, `receivables/index` 5,
`recurring-invoices/{index,create-template,edit-template}` 4 masing-masing,
`feedbacks/index` 5, `reports/profit-loss/index` 4, `permissions/index` 4,
`users/index` 2, `admin/companies/index` 2, `settings/*` 2–5,
`(pdf)` 54, `(json)` 38, `(excel)` 5, berkas lampiran 5.

### 403 yang BENAR, dengan dasar kodenya

- **189 probe — bukan anggota perusahaan.** `EnsureUserBelongsToCompany` di grup
  middleware `c/{company}` (`routes/web.php:72-84`). Contoh: `alpha-admin` ke
  `/c/qabeta/*` → 403 di seluruh 63 halaman.
- **50 probe — anggota, tetapi peran tidak punya izinnya.**
  - `both-manager` (finance manager) 18 halaman: `admin/companies` (izin
    `manage companies` hanya admin, migrasi `2026_08_11_120000`), `admin/users`
    (`manage users` hanya admin), seluruh keluarga `settings/pdf-templates`
    (`manage pdf templates` tidak ada di daftar finance manager,
    `MasterPermissionSeeder.php:340-369`), dan dua halaman `*/edit` di bawah ini.
  - `alpha-staff` (staff, 21 izin) 31 halaman: semua modul di luar 21 izin itu —
    bank-accounts, cash-flow, loans, recurring-invoices, transaction-categories,
    reports/profit-loss, settings/company, settings/invoice-numbering,
    settings/pdf-templates, admin/*, dan `invoices/{id}/edit` (`edit invoices`
    tidak diberikan).
  - `alpha-admin` 1 halaman: `/c/qaalpha/reimbursements/1/edit` — pemeriksaan
    kepemilikan `$reimbursement->user_id !== auth()->id()` di
    `ReimbursementController.php:238-240`; reimbursement itu milik `alpha-staff`.

### 302 yang BENAR (5 halaman, 24 probe)

| Halaman | Tujuan | Dasar |
|---|---|---|
| `cash-flow` | `cash-flow/income` | `routes/web.php:370-382` |
| `permissions` | `admin/permissions` | redirect legacy, `routes/web.php:591` |
| `reimbursements/create` | `reimbursements?create=1` | halaman pakai drawer, bukan halaman terpisah |
| `template-builder-test` | `settings/pdf-templates` | `routes/web.php:166` |
| `{reimbursements,fund-requests}/{id}/edit` | index + flash error | `canEdit()` false untuk status `pending` (`Reimbursement.php:169-172`) |

---

## 4. Bukti NOL KEBOCORAN (D.3)

### D.3.1 Penanda silang — **6 dari 236 halaman bocor**

Setiap respons 200 milik anggota perusahaan diperiksa: body dari `/c/qaalpha/*` tidak
boleh memuat `BETA-`, dan sebaliknya. Log: `storage/qa-d/03-penanda-silang.log`.

| | Jumlah |
|---|---:|
| halaman 200 diperiksa | **236** |
| bersih | **230** |
| bocor | **6** |

Keenam kebocoran, semuanya di dua endpoint yang datanya hidup di database **central**:

```
BOCOR  /c/qaalpha/feedbacks       pengguna=alpha-admin@qa.test   penanda=BETA-
BOCOR  /c/qaalpha/feedbacks       pengguna=both-manager@qa.test  penanda=BETA-
BOCOR  /c/qabeta/feedbacks        pengguna=beta-admin@qa.test    penanda=ALPHA-
BOCOR  /c/qabeta/feedbacks        pengguna=both-manager@qa.test  penanda=ALPHA-
BOCOR  /c/qaalpha/notifications   pengguna=both-manager@qa.test  penanda=BETA-
BOCOR  /c/qabeta/notifications    pengguna=both-manager@qa.test  penanda=ALPHA-
```

`alpha-staff` **tidak** bocor di `/feedbacks` — ia tidak punya izin `manage feedbacks`,
sehingga jatuh ke cabang `Feedback::forUser()` yang tersaring per pengguna. Itu memastikan
akar masalahnya cabang `Feedback::query()`, bukan hal lain. → **Temuan 2, Temuan 3.**

**Pelengkap di level penyimpanan** (`storage/qa-d/05-verifikasi.log`, bagian V1): seluruh
kolom bertipe teks/JSON di kedua database tenant disapu dengan `LIKE '%BETA-%'` /
`'%ALPHA-%'`:

| Database | Kolom teks diperiksa | Baris memuat penanda lawan |
|---|---:|---:|
| `tenant_qaalpha` | 90 | **0** |
| `tenant_qabeta` | 90 | **0** |

### D.3.2 Akses paksa lintas perusahaan — **23 dari 24 probe sesuai harapan, 0 kebocoran**

Sebagai `alpha-admin@qa.test` (admin **hanya** di qaalpha), 12 sasaran milik qabeta
(id 501) ditembak di dua jalur. Untuk modul tanpa route GET detail dipakai `PUT` dengan
body kosong: **404 = baris tidak terjangkau**, **422 = baris DITEMUKAN (kebocoran)**,
karena validasi baru jalan setelah route-model binding. Log: `storage/qa-d/03-akses-paksa.log`.

| Sasaran (id 501 milik qabeta) | `/c/qaalpha/...` | `/c/qabeta/...` |
|---|---|---|
| `invoices/501` (show) | **200** ⟵ penyimpangan | 403 ✔ |
| `invoices/501/data` | 404 ✔ | 403 ✔ |
| `invoices/501/edit` | 404 ✔ | 403 ✔ |
| `invoice/501/download` (PDF) | 404 ✔ | 403 ✔ |
| `reimbursements/501/data` | 404 ✔ | 403 ✔ |
| `reimbursements/501/edit` | 404 ✔ | 403 ✔ |
| `fund-requests/501/edit` | 404 ✔ | 403 ✔ |
| `PUT loans/501` | 404 ✔ | 403 ✔ |
| `PUT receivables/501` | 404 ✔ | 403 ✔ |
| `PUT bank-accounts/501` | 404 ✔ | 403 ✔ |
| `PUT clients/501` | 404 ✔ | 403 ✔ |
| `storage/reimbursements/beta-lampiran-01.txt` | 404 ✔ | 403 ✔ |

Satu penyimpangan itu **bukan kebocoran**, dan dasarnya di kode:
`InvoiceController.php:431-434` — `show()` tidak memakai route-model binding, ia hanya
meneruskan id ke `index()` sebagai "baris yang di-highlight"; drawer detail-nya mengambil
datanya sendiri dari `invoices/{id}/data`, dan endpoint **itu** 404 dengan benar.
Body respons 200 itu diperiksa: memuat `ALPHA-`, **tidak memuat `BETA-`**, komponen
`invoices/index`, props spesifik invoice kosong (`[]`). → **Temuan 5** (status, bukan data).

### D.3.3 Lampiran — **8 dari 8 pemeriksaan lulus**

| Pemeriksaan | Hasil |
|---|---|
| `attachment_url` dari backend untuk qaalpha ber-prefix `/c/qaalpha/storage/` | ✔ `http://127.0.0.1:8101/c/qaalpha/storage/reimbursements/alpha-lampiran-01.txt` |
| idem untuk qabeta | ✔ `.../c/qabeta/storage/reimbursements/beta-lampiran-01.txt` |
| anggota qaalpha mengambil lampirannya | ✔ 200, isi memuat `ALPHA-LAMPIRAN-01` |
| anggota qabeta mengambil lampirannya | ✔ 200, isi memuat `BETA-LAMPIRAN-01` |
| alpha-admin meminta berkas **beta** di jalur **alpha** | ✔ 404 |
| beta-admin meminta berkas **alpha** di jalur **beta** | ✔ 404 |
| alpha-admin (bukan anggota) ke jalur **beta** | ✔ 403 |
| beta-admin (bukan anggota) ke jalur **alpha** | ✔ 403 |

Unggahan baru lewat HTTP (D.5) juga mendarat di folder yang benar
(`05-verifikasi.log`, bagian V3):

| Folder | Berkas | Berkas milik perusahaan lawan yang ada di sini |
|---|---:|---:|
| `storage/tenantqaalpha/app/public` | 4 (`fund-requests/`, `payments/`, `reimbursements/` ×2) | **0** |
| `storage/tenantqabeta/app/public` | 4 (idem) | **0** |

### D.3.4 Tabel yang hidup di database CENTRAL — **titik lemahnya terbukti**

Pertama, dijawab dulu **di mana tabelnya hidup** (`storage/qa-d/01-bangun.log`):

| Tabel | `qa_central` | `tenant_qaalpha` | `tenant_qabeta` |
|---|---|---|---|
| `users`, `roles`, `permissions`, `companies`, `company_user` | ada | — | — |
| `feedbacks` | **2 baris** | tabel tidak ada | tabel tidak ada |
| `app_notifications` | **2 baris** | tabel tidak ada | tabel tidak ada |

Keduanya memakai trait `CentralConnection` (`AppNotification.php:12`, `Feedback.php:13`)
dan **punya kolom `company_id` yang terisi benar** saat dibuat
(`AppNotification.php:140` → `tenant()?->getTenantKey()`):

```
feedbacks:          id=1 company_id=qaalpha ALPHA-FEEDBACK-01 | id=2 company_id=qabeta BETA-FEEDBACK-01
app_notifications:  id=1 company_id=qaalpha ALPHA-NOTIF-01    | id=2 company_id=qabeta BETA-NOTIF-01
```

Jadi datanya **sudah bertanda perusahaan**; yang tidak dilakukan adalah **menyaringnya saat dibaca**.

| Halaman | Hasil |
|---|---|
| `/c/qaalpha/admin/users` sebagai `alpha-admin` | **BOCOR.** 6 dari 6 email terlihat, termasuk `beta-admin@qa.test`, `nobody@qa.test`, `mixed-roles@qa.test`. Dugaan coordinator **TERBUKTI masih benar di branch ini.** |
| `/c/qaalpha/admin/permissions` | **bersih.** Tidak ada email lintas perusahaan. Peran memang GLOBAL by design (`MasterPermissionSeeder.php:24` `setPermissionsTeamId(null)`); penugasan tetap per perusahaan. |
| `GET /c/{slug}/notifications` sebagai `both-manager` | **BOCOR.** Mengirim `["BETA-NOTIF-01","ALPHA-NOTIF-01"]` dengan `unread_count=2` di **kedua** perusahaan. |
| prop bel di `/c/{slug}/dashboard` (pembanding) | **bersih.** `/c/qaalpha` → `["ALPHA-NOTIF-01"] unread=1`; `/c/qabeta` → `["BETA-NOTIF-01"] unread=1`. |
| `/c/{slug}/feedbacks?tab=all` | **BOCOR.** `alpha-admin` melihat `BETA-FEEDBACK-01`; `beta-admin` melihat `ALPHA-FEEDBACK-01`. |

Severitas `/admin/users` bukan sekadar "terlihat" — **bisa diubah**. Probe non-destruktif
`PUT /c/qaalpha/admin/users/2` (id milik `beta-admin`) dengan body kosong menjawab **422
dengan error validasi field**, artinya model User milik perusahaan lain **berhasil
di-bind** dan hanya tertahan validasi, bukan otorisasi. Route `update`, `destroy`, dan
`bulk-delete` memakai binding yang sama.

### D.3.5 Konteks izin per perusahaan — **LULUS, terbukti dengan angka**

Diuji dengan `mixed-roles@qa.test` (finance manager di qaalpha, staff di qabeta) — lihat
§7 soal mengapa `both-manager` tidak bisa membuktikan ini. Jumlah izin dibaca dari prop
Inertia `auth.permissions` pada tiap kunjungan:

| Langkah | Halaman | Jumlah izin | `view profit-loss` |
|---|---|---:|---|
| 1 | `/c/qaalpha/dashboard` | **70** | ya |
| 2 | `/c/qabeta/dashboard` | **21** | tidak |
| 3 | `/c/qaalpha/dashboard` | **70** | ya |
| 4 | `/c/qabeta/dashboard` | **21** | tidak |

Berpindah ke perusahaan lain **menurunkan** izin, dan kembali **memulihkannya** — tidak
tercache dari perusahaan sebelumnya. Dikonfirmasi lagi di tingkat halaman:
`/c/qaalpha/reports/profit-loss` → **200**, `/c/qabeta/reports/profit-loss` → **403**,
dalam satu sesi yang sama.

---

## 5. Alur pemilihan perusahaan (D.4)

Log: `storage/qa-d/04-pilih-perusahaan.log`.

| Pengguna | Yang SEBENARNYA terjadi | Sesuai harapan? |
|---|---|---|
| `alpha-staff` (1 perusahaan) | `POST /login` → 302 `/choose-company` → 302 `/c/qaalpha/dashboard` → 200 `dashboard`. Pemilih **tidak pernah terlihat**. `/c/qabeta/dashboard` → 403. | ✔ |
| `both-manager` (2 perusahaan) | `/choose-company` → 200 komponen `choose-company`, `props.companies` = kedua perusahaan. Kedua dashboard 200. Semua halaman mengirim `props.companies` + `props.company` → data switcher sidebar tersedia. | ✔ |
| `nobody` (0 perusahaan) | `/choose-company` → **403**, bukan 500. Halaman error Inertia: judul "Akses ditolak", deskripsi "Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin bila Anda merasa seharusnya bisa." | ✔ tidak 500, **tetapi** pesan spesifiknya hilang → **Temuan 6** |

`ChooseCompanyController.php:28` memanggil
`abort_if($companies->isEmpty(), 403, 'Akun Anda belum terdaftar di perusahaan mana pun. Hubungi administrator.')`,
tetapi `ErrorReportService.php:30` mengganti deskripsi dengan teks tetap per status.
Pesan yang jauh lebih berguna itu **tidak pernah sampai ke pengguna**.

---

## 6. Alur TULIS (D.5) — enam modul, dua perusahaan, semua selesai

Semua lewat POST ber-CSRF ke dev server; setiap langkah diverifikasi langsung di
`tenant_qaalpha` / `tenant_qabeta` lewat PDO. Log: `storage/qa-d/05-tulis.log`,
ringkasan mesin: `05-tulis.json`.

| Modul | qaalpha (db `tenant_qaalpha`) | qabeta (db `tenant_qabeta`) |
|---|---|---|
| **Invoice** draft → kirim → bayar | draft id=2 → nomor **`001/INV/AQ-A/XI/2026`** (`invoice_sequence=1`) → bayar 3.000.000 → status `partially_paid`, saldo rek#1 102.500.000 → **105.500.000** (Δ +3.000.000), lampiran `payments/LGzQ….png` | draft id=502 → nomor **`001/INV/BQ-B/XI/2026`** (`invoice_sequence=1`) → bayar 3.000.000 → `partially_paid`, saldo rek#501 102.500.000 → **105.500.000**, lampiran `payments/iBo4….png` |
| **Reimbursement** ajukan → setujui → bayar | id=2, `pending` → `approved` → **`paid/paid`**, lampiran `reimbursements/3RNd….png` | id=502, `pending` → `approved` → **`paid/paid`**, lampiran `reimbursements/WHar….png` |
| **Fund request** ajukan → setujui → cairkan | id=2, nomor **`001/ALP/XI/2026`**, `pending` → `approved` → **`disbursed`**, saldo 105.050.000 → 103.850.000 (Δ −1.200.000) | id=502, nomor **`001/BTA/XI/2026`**, `pending` → `approved` → **`disbursed`**, saldo 105.050.000 → 103.850.000 |
| **Transfer** + hapus satu kaki | transfer 1.000.000 + fee 6.500 → **2 kaki** (debit 1.006.500 di rek#1, credit 1.000.000 di rek#2, satu `transfer_group_id`); hapus kaki id=4 → **tepat 2 baris hilang**, 0 kaki tersisa, saldo kembali **103.850.000 / 50.000.000** (persis seperti sebelum transfer) | idem; hapus kaki id=504 → **tepat 2 baris hilang**, saldo kembali **103.850.000 / 50.000.000** |
| **Pinjaman** buat → bayar angsuran | id=2, pokok 10.000.000 masuk rek#1 (103.850.000 → 113.850.000); angsuran 1.666.667 + bunga 100.000 tercatat (1 baris `loan_payments`), **2 transaksi bank dengan `category_id` non-NULL** | id=502, idem, saldo 113.850.000 → 112.083.333 |
| **Piutang** buat → ajukan → setujui → bayar | id=2 nomor `RCV-00002`, `draft` → `pending_approval` → `active` (6.000.000 keluar) → bayar 2.000.000+100.000, 1 baris `receivable_payments` | id=502 nomor `RCV-00502`, rantai status identik, 1 baris `receivable_payments` |

Saldo akhir, dicocokkan **dua arah** (hitung langsung di DB vs prop halaman HTTP) — identik:
qaalpha `{bank1: 108.183.333, bank2: 50.000.000}`, qabeta `{bank1: 108.183.333, bank2: 50.000.000}`.
Dua perusahaan menghasilkan angka yang sama karena datanya sengaja simetris; yang
dibuktikan di sini adalah keduanya diproses di database masing-masing.

### Nomor dokumen independen per perusahaan — **TERBUKTI**

Invoice **kedua** diterbitkan di kedua perusahaan, bergantian (alpha lalu beta). Kalau
urutan dibagi, qabeta akan mendapat 3 (`05-verifikasi.log`, bagian V2):

```
tenant_qaalpha  id=1 ALPHA-INV-0001           seq=NULL  (data awal, dibuat langsung)
tenant_qaalpha  id=2 001/INV/AQ-A/XI/2026     seq=1
tenant_qaalpha  id=3 002/INV/AQ-A/XI/2026     seq=2
tenant_qabeta   id=501 BETA-INV-0001          seq=NULL
tenant_qabeta   id=502 001/INV/BQ-B/XI/2026   seq=1   ← bukan 2
tenant_qabeta   id=503 002/INV/BQ-B/XI/2026   seq=2   ← bukan 3
```

Dasarnya `InvoiceNumberService::nextSequence()` yang bekerja atas `Invoice::query()` pada
koneksi tenant — per konstruksi per perusahaan. Nomor fund request juga independen
(`001/ALP/XI/2026` vs `001/BTA/XI/2026`, keduanya urutan 001).

Dua catatan presisi, bukan cacat:
- Segmen `{PT}` pada nomor invoice adalah **inisial nama** di CompanyProfile, bukan kolom
  `abbreviation` ("PT Alpha Qa" → `AQ`, bukan `ALP`) — `InvoiceNumberService::companyInitials()`.
- `receivable_number` diturunkan dari **id baris** (`ReceivableController.php:420-426`,
  `'RCV-'.str_pad($last->id + 1, 5)`), bukan urutan yang direset per periode. Di lingkungan
  ini qabeta tampak "maju" (`RCV-00502`) **hanya** karena saya menyetel `AUTO_INCREMENT=501`
  di qabeta dengan sengaja. Pada instalasi normal keduanya mulai dari `RCV-00001` dan tetap
  independen.

---

## 7. Premis dalam spesifikasi yang perlu dikoreksi

1. **"both-manager = finance manager di KEDUA perusahaan" membuat D.3.5 tidak membuktikan apa pun.**
   Peran yang sama di dua perusahaan menghasilkan daftar izin yang sama, jadi izin yang
   tercache dan izin yang dihitung ulang **tidak bisa dibedakan**. Pengukuran pertama saya
   memang keluar `70 / 70` — tanpa daya pisah. Saya menambahkan `mixed-roles@qa.test`
   (finance manager di qaalpha, **staff** di qabeta); baru di situ angkanya memisah
   (70 / 21) dan klaim "dihitung per perusahaan" punya bukti. Pengguna yang diminta
   spesifikasi tetap dibuat semuanya, apa adanya.
2. **Spesifikasi mengasumsikan id baris berbeda antar perusahaan. Tidak.** Pada bangunan
   pertama, qaalpha dan qabeta sama-sama punya id 1 di setiap tabel, sehingga
   `/c/qaalpha/<modul>/<id-milik-beta>` menembak baris **milik alpha sendiri** dan uji
   akses paksa jadi hampa. Skrip pembangun kini menyetel `AUTO_INCREMENT=501` untuk
   qabeta, dan alasannya ditulis di komentar skripnya.
3. **"Jalankan `npm run build` sekali supaya halaman benar-benar ter-render" — build bukan
   penghalangnya.** Aset build memang sudah ada dan tersaji (`GET /build/assets/…` → 200),
   tetapi berkas `public/hot` yang tertinggal membelokkan `@vite` ke dev server Vite di
   `http://[::1]:5173` yang **tidak ada** (port tertutup). Jadi di peramban sungguhan
   halaman akan putih sampai `public/hot` dihapus — bukan karena build. Saya tidak
   menyentuhnya (di luar jalur saya) → **Temuan 7**.
4. **Dugaan `Admin\UserController::index()` melisting seluruh users: BENAR,** dan lebih
   buruk dari yang dicatat — bukan hanya melisting, tetapi juga bisa **mengubah dan
   menghapus** (bukti 422 di §D.3.4).
5. **SSR Inertia tetap mati.** Tidak ada satu pun request menggantung ke `127.0.0.1:13714`
   di seluruh 500-an probe. Tidak ada yang menyalakannya kembali.
6. **"710 test hijau": tidak saya ukur.** Saya tidak menjalankan suite PHPUnit dalam paket
   ini; seluruh bukti di dokumen ini datang dari aplikasi yang berjalan.
7. **`npm run build` tidak dijalankan ulang**, sesuai larangan. Manifest diperiksa utuh dan
   aset tersaji 200.

---

## 8. TEMUAN

### Temuan 1 — `/admin/users` melisting DAN bisa mengubah pengguna seluruh perusahaan — **MEMBLOKIR**

- **Gejala.** `alpha-admin@qa.test`, admin **hanya** di qaalpha, membuka
  `/c/qaalpha/admin/users` dan melihat **6 dari 6** pengguna seluruh instalasi, termasuk
  `beta-admin@qa.test`. Lebih jauh, `PUT /c/qaalpha/admin/users/2` (id milik `beta-admin`)
  menjawab **422 error validasi**, bukan 404 — artinya baris milik perusahaan lain
  berhasil di-bind dan hanya tertahan validasi field.
- **Reproduksi.**
  ```bash
  php storage/qa-d/kebocoran.php    # bagian D.3.4, baris pertama
  # login alpha-admin, lalu:
  # GET  /c/qaalpha/admin/users?per_page=100   -> body memuat beta-admin@qa.test
  # PUT  /c/qaalpha/admin/users/2 (body kosong) -> 422, bukan 404
  ```
- **Akar masalah.** `users` hidup di database **central**, jadi isolasi tingkat koneksi
  tidak melindunginya, dan controller tidak menambahkan penyaring keanggotaan:
  `app/Http/Controllers/Admin/UserController.php:29` (`User::query()` tanpa
  `whereHas('companies', …)`), statistik di `:54`, `:55`, `:61`, `:62`, serta
  `update()` `:111`, `destroy()` `:133`, `bulkDestroy()` `:146` yang semuanya memakai
  route-model binding tanpa pemeriksaan perusahaan.
- **Penghambat produksi.** **MEMBLOKIR.** Admin satu perusahaan bisa membaca daftar
  pengguna, mengubah email/peran/status, dan menghapus akun perusahaan lain.

### Temuan 2 — daftar feedback membocorkan isi feedback perusahaan lain — **MEMBLOKIR**

- **Gejala.** `alpha-admin` di `/c/qaalpha/feedbacks?tab=all` melihat `BETA-FEEDBACK-01`
  beserta deskripsinya; `beta-admin` di `/c/qabeta/feedbacks?tab=all` melihat
  `ALPHA-FEEDBACK-01`. 4 dari 6 kebocoran penanda silang berasal dari sini.
- **Reproduksi.**
  ```bash
  php storage/qa-d/sweep.php   # 03-penanda-silang.log -> 4 baris BOCOR pada /feedbacks
  ```
- **Akar masalah.** `feedbacks` hidup di database **central**
  (`app/Models/Feedback.php:13` trait `CentralConnection`), dan cabang "lihat semua" tidak
  menyaring `company_id` yang sudah ada isinya:
  `app/Http/Controllers/FeedbackController.php:37` (`Feedback::query()` saat
  `canManage && tab === 'all'`), juga `:57` dan `:219`. Terbukti karena `alpha-staff`
  yang tidak punya `manage feedbacks` jatuh ke `Feedback::forUser()` dan **tidak** bocor.
- **Penghambat produksi.** **MEMBLOKIR.** Isi laporan/keluhan internal satu perusahaan
  terbaca penuh oleh admin perusahaan lain.

### Temuan 3 — drawer notifikasi tidak disaring per perusahaan, padahal belnya sudah — **PERLU DIPERBAIKI**

- **Gejala.** Sebagai `both-manager`:

  | | `/c/qaalpha` | `/c/qabeta` |
  |---|---|---|
  | prop bel (`props.notifications`) | `["ALPHA-NOTIF-01"]`, unread **1** | `["BETA-NOTIF-01"]`, unread **1** |
  | `GET /notifications` (isi drawer) | `["BETA-NOTIF-01","ALPHA-NOTIF-01"]`, unread **2** | sama, unread **2** |

  Jadi bel menampilkan 1 dan drawer menampilkan 2 di layar yang sama.
- **Reproduksi.** login `both-manager@qa.test`, lalu `GET /c/qaalpha/dashboard`
  (lihat `props.notifications`) dan `GET /c/qaalpha/notifications`.
- **Akar masalah.** Penyaring yang benar **sudah ada** di
  `app/Http/Middleware/HandleInertiaRequests.php:111-118`
  (`whereNull('company_id')->orWhere('company_id', tenant()->getTenantKey())`), tetapi
  tidak dipakai di `app/Http/Controllers/NotificationController.php:19` dan `:36`
  (`AppNotification::forUser($userId)` saja), maupun di `markAllAsRead()` `:51` —
  sehingga "tandai semua terbaca" di satu perusahaan juga menandai notifikasi perusahaan lain.
- **Penghambat produksi.** **PERLU DIPERBAIKI.** Yang bocor adalah notifikasi milik
  pengguna itu sendiri (bukan data orang lain), tetapi judul notifikasi membawa konteks
  perusahaan lain, angkanya tidak konsisten dengan bel, dan `markAllAsRead` melintasi batas.

### Temuan 4 — `/api/invoices/next-sequence` selalu 500: memanggil metode yang tidak ada — **CATATAN**

- **Gejala.** 5 dari 5 permintaan anggota ke `/c/{slug}/api/invoices/next-sequence`
  menjawab **500**: `Call to undefined method App\Models\Invoice::getMaxSequenceFromDb()`.
  Satu-satunya status 500 di seluruh 504 probe.
- **Reproduksi.** login pengguna mana pun dengan izin `create invoices`, lalu
  `GET /c/qaalpha/api/invoices/next-sequence`.
- **Akar masalah.** `routes/web.php:145` memanggil `Invoice::getMaxSequenceFromDb($tanggal)`.
  Metode itu tidak ada di mana pun di `app/` (grep: satu-satunya kemunculan nama itu ada di
  `routes/web.php` sendiri). Padanannya yang hidup adalah
  `InvoiceNumberService::nextSequence(CarbonInterface $date)`
  (`app/Services/InvoiceNumberService.php:80`).
- **Penghambat produksi.** **CATATAN.** Endpoint ini **mati**: `grep` di
  `resources/js/pages` dan `resources/js/components` tidak menemukan satu pun pemanggil
  (hanya berkas Wayfinder hasil generate yang menyebut namanya). Alur Buat Invoice terbukti
  berjalan penuh di D.5. Jadi ini kode mati yang rusak — pilihannya perbaiki atau hapus,
  bukan penghambat rilis.

### Temuan 5 — `invoices/{id}` menjawab 200 untuk id yang tidak ada — **CATATAN**

- **Gejala.** `/c/qaalpha/invoices/501` (id milik qabeta, tidak ada di database alpha)
  menjawab **200**, bukan 404.
- **Reproduksi.** `php storage/qa-d/paksa.php`, baris pertama.
- **Akar masalah.** `app/Http/Controllers/InvoiceController.php:431-434` — `show()`
  menerima `string $invoice` dan meneruskannya ke `index()` sebagai id yang di-highlight,
  tanpa route-model binding. Halaman daftar milik perusahaan aktif tetap yang dirender.
- **Penghambat produksi.** **CATATAN.** **Bukan kebocoran** — body diperiksa: memuat
  `ALPHA-`, tidak memuat `BETA-`, props invoice kosong, dan `invoices/501/data` (yang
  mengambil isi drawer) 404 dengan benar. Hanya status HTTP-nya yang terlalu lunak;
  menautkan invoice yang sudah dihapus akan membuka daftar kosong tanpa penjelasan.

### Temuan 6 — pesan 403 yang spesifik dibuang, pengguna tanpa perusahaan tidak diberi tahu apa pun — **CATATAN**

- **Gejala.** `nobody@qa.test` (0 perusahaan) login lalu ke `/choose-company` → 403
  (benar, bukan 500), tetapi halaman error berbunyi "Akun Anda tidak memiliki izin untuk
  membuka halaman ini" — bukan "Akun Anda belum terdaftar di perusahaan mana pun. Hubungi
  administrator." yang memang sudah dituliskan di kode.
- **Reproduksi.** `php storage/qa-d/pilih.php`, blok `nobody@qa.test`.
- **Akar masalah.** `app/Http/Controllers/ChooseCompanyController.php:28` memberikan pesan
  pada `abort_if(...)`, tetapi `app/Services/ErrorReportService.php:30` mengganti deskripsi
  dengan teks tetap per kode status tanpa memeriksa pesan pada exception.
- **Penghambat produksi.** **CATATAN.** Pengguna baru yang belum ditautkan ke perusahaan
  akan menyimpulkan akunnya rusak, lalu membuka tiket dukungan yang tidak perlu.

### Temuan 7 — `public/hot` tertinggal: setiap halaman menunjuk dev server Vite yang mati — **CATATAN (lingkungan lokal)**

- **Gejala.** HTML setiap halaman memuat
  `import RefreshRuntime from 'http://[::1]:5173/@react-refresh'`. Port 5173 **tertutup**
  (diuji `fsockopen`, connection timeout). Di peramban sungguhan hasilnya layar putih,
  walaupun `public/build/manifest.json` utuh dan `GET /build/assets/…` menjawab **200**.
- **Reproduksi.** `cat public/hot` → `http://[::1]:5173`;
  `php -r '$f=@fsockopen("127.0.0.1",5173,$e,$s,2); echo $f?"terbuka":"tertutup";'`
- **Akar masalah.** Berkas `public/hot` (sisa `npm run dev` yang tidak berhenti rapi;
  gitignored di `.gitignore:4`) membuat `@vite` memilih mode dev server, bukan manifest.
  Perbaikannya satu perintah: `rm public/hot`. Saya **tidak** menjalankannya — `public/`
  di luar jalur yang diizinkan untuk paket ini dan dipakai bersama worker lain.
- **Penghambat produksi.** **CATATAN.** Artefak lingkungan pengembangan, tidak ikut ter-commit.
  **Akibatnya untuk laporan ini:** seluruh matriks di §3 mengukur payload Inertia yang
  dirender server (nama komponen dibaca dari
  `<script data-page="app" type="application/json">`), yang memang ukuran yang tepat untuk
  "halaman merender komponen yang benar". Yang **tidak** saya ukur adalah rendering sisi
  klien di peramban sungguhan.

---

## 9. Yang diukur dan yang tidak

**Diukur:** 504 probe halaman GET (status, ukuran, komponen Inertia); 236 body disapu
penanda silang; 180 kolom teks di dua database tenant disapu; 24 probe akses paksa lintas
perusahaan; 8 pemeriksaan lampiran lewat HTTP + 8 berkas di disk; 4 endpoint tabel central;
4 kunjungan bergantian untuk konteks izin; 3 alur pemilihan perusahaan; 6 alur tulis penuh
× 2 perusahaan dengan verifikasi PDO per langkah; 6 nomor invoice dan 2 nomor fund request
yang benar-benar terbit.

**Tidak diukur:** rendering sisi klien di peramban sungguhan (Temuan 7); suite PHPUnit
(tidak dijalankan di paket ini); perilaku di bawah beban/konkurensi — `php artisan serve`
berjalan satu worker, jadi semua probe serial; perusahaan ke-3 dan seterusnya; jalur
provisioning `/admin/companies` lewat UI (perusahaan dibuat lewat `Company::create()`
yang memicu pipeline `TenantCreated` yang sama); modul Excel export selain status HTTP-nya;
dan apakah temuan-temuan di atas juga muncul pada data produksi yang sudah ada.
