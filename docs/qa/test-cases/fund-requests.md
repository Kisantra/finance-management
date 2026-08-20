# Test Case — Permintaan Dana (Fund Requests)

Sumber teknis: [`docs/module/fund-requests.md`](../../module/fund-requests.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-tiga` (DB `tenant_qa-tiga`), eksekusi HTTP dengan
cookie sesi asli + verifikasi database. Bukan production.

Aktor uji:

| Sesi | Akun | Permission relevan |
|---|---|---|
| `staff` | `staff@gmail.com` | `view/create/edit/delete fund requests` — **tanpa** approve/disburse |
| `manager` | `manager@gmail.com` | semua fund request + `approve` + `disburse` + cash-flow penuh |
| `admin` | `admin@gmail.com` | semua, role `admin` |
| `income-only` | `qa3.income@example.test` | **tanpa** `view fund requests` (untuk uji gate) |

Rekening & kategori yang dipakai sama dengan berkas
[`cash-flow.md`](cash-flow.md): rekening 1 & 2 (saldo awal Rp 100.000.000 masing-masing),
kategori expense 15 `MAKAN MINUM`, 18 `OPERASIONAL LUAR KOTA`, 19 `OPERASIONAL`,
dan kategori **income** 5 `Penghasilan` (dipakai sengaja pada A19).

Objek yang dibuat selama pengujian:

| # | Nomor | Pemohon | Isi | Nasib akhir |
|---|---|---|---|---|
| 1 | `001/TIG/VIII/2026` | staff | 2 item, Rp 1.850.000 | draft → pending → approved → **disbursed** → dihapus admin |
| 2 | `002/TIG/VIII/2026` | staff | 1 item ATK | pending → **rejected** → diedit (Rp 120.000) |
| 3 | `003/TIG/VIII/2026` | staff | Tiket pesawat | draft → diedit admin → dihapus pemilik |
| 4 | `004/TIG/VIII/2026` | staff | 1 item berkategori **income** | draft → pending → approved → **disbursed** |
| 5 | `005/TIG/VIII/2026` | manager | draft | dihapus oleh **staff** (lihat BUG-FR-02) |
| 6 | `006/TIG/VIII/2026` | staff | draft + lampiran | dihapus pemilik (berkas ikut terhapus) |

---

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat pengajuan draft + total dihitung dari item | Sesi staff `POST /c/qa-tiga/fund-requests` `{title, purpose, priority:high, needed_by_date:2026-08-25, action:draft, items:[{Sewa kendaraan, cat 19, qty 2 × 750.000},{Konsumsi tim, cat 15, qty 10 × 35.000}]}` | 302; status `draft`; `total_amount = 1.850.000`; item `amount = qty × unit_price` | FE+BE | 302. DB: `id=1 status=draft total_amount=1850000`; item id 1 `amount=1500000`, item id 2 `amount=350000` | Pass |
| N02 | Penomoran otomatis | Baca prop `nextNumber` pada `/fund-requests` sebelum ada data | Format `001/{ABBR}/{ROMAWI}/{TAHUN}` | BE | `"001/TIG/VIII/2026"` (abbreviation `TIG` dari profil perusahaan "QA Tiga", bulan VIII, tahun 2026) | Pass |
| N03 | Submit oleh pemilik | Sesi staff `POST /fund-requests/1/submit` | 302; status `pending`; total dihitung ulang | BE | 302; `status=pending total_amount=1850000` | Pass |
| N04 | Approve oleh reviewer | Sesi manager `POST /fund-requests/1/review` `{action:approve, review_notes:"Disetujui untuk operasional lapangan"}` | Status `approved`, jejak review terisi | BE | `status=approved reviewed_by=2 reviewed_at=2026-08-19 14:43:54 review_notes="Disetujui untuk operasional lapangan"` | Pass |
| N05 | Reject oleh reviewer | Sesi manager `POST /fund-requests/2/review` `{action:reject, review_notes:"Anggaran ATK sudah habis bulan ini"}` | Status `rejected` + catatan | BE | `id=2 status=rejected review_notes="Anggaran ATK sudah habis bulan ini" reviewed_by=2` | Pass |
| N06 | **Pencairan**: satu transaksi debit per item | Sesi manager multipart `POST /fund-requests/1/disburse` `{bank_account_id:1, disbursement_date:2026-08-19, disbursement_notes:REF-CAIR-QA3-001, attachment:bukti.png}` | 2 transaksi debit (satu per item), kategori mengikuti item, bukti dibagi, hanya transaksi pertama tertaut, saldo turun | BE | 302. `bank_transactions` id 16 `1.500.000 debit cat 19` + id 17 `350.000 debit cat 15`; keduanya `reference_number=REF-CAIR-QA3-001` dan `attachment_path=transaction-attachments/hkI8PTYOdIrRvidwq6QtguC6XBuuF7mOVBswieEK.png` (**path identik**). `fund_requests.id=1`: `status=disbursed bank_transaction_id=16 disbursed_by=2 disbursement_date=2026-08-19`. Saldo rek 1: `92.460.500 → 90.610.500` (−1.850.000) | Pass |
| N07 | Edit draft = hapus semua item lalu buat ulang | `PUT /fund-requests/2` dengan 1 item `qty 2 × 60.000` | Item lama hilang, item baru ber-ID baru, total menyesuaikan | BE | Item `id=3 amount=300000` hilang; muncul `id=4 quantity=2 amount=120000`; `total_amount=120000` | Pass |
| N08 | Buat langsung dengan `action=submit` | Sesi staff `POST /fund-requests` `action=submit` (1 item 5 × 60.000) | Langsung `pending`, total Rp 300.000 | FE+BE | `id=2 status=pending total_amount=300000` | Pass |
| N09 | Hapus draft milik sendiri | Sesi staff `DELETE /fund-requests/3` | 302 success; item ikut terhapus (cascade) | BE | 302; baris `id=3` hilang; `COUNT(fund_request_items WHERE fund_request_id=3) = 0` | Pass |
| N10 | Admin boleh mengedit draft milik user lain | Sesi admin `PUT /fund-requests/3` (milik staff) | 302; data berubah | BE | 302; `title="QA3 Pengajuan Perjalanan Dinas (admin edit)" total_amount=1200000` | Pass |
| N11 | Tab default per permission | Buka `/fund-requests` sebagai staff dan sebagai manager | staff → tab `my`; manager (punya approve) → tab `all` + `userOptions` | BE | staff: `tab="my" rows=2 canApprove=false`; manager: `tab="all" rows=2 canApprove=true canDisburse=true`; `?tab=my` untuk manager → `rows=0` (manager tidak punya pengajuan sendiri) | Pass |
| N12 | Filter daftar | `?status=disbursed`, `?status=rejected`, `?priority=low`, `?month=2026-08`, `?month=2026-07`, `?search=ATK`, `?user_id=3` | Baris tersaring sesuai kriteria | BE | rows berturut-turut: 1, 1, 2, 2, **0**, 1, 2 — semuanya sesuai. (Catatan: `stats` tidak ikut tersaring, lihat **BUG-FR-06**) | Pass |
| N13 | Export PDF rekap (tanpa filter) | Sesi manager `GET /fund-requests/export/pdf?show_requestor=1` | 200 PDF, nama `Rekap-Pengajuan-Dana-all.pdf`, periode "Semua Periode" | BE | 200 `application/pdf` (3.847 byte), `filename=Rekap-Pengajuan-Dana-all.pdf`; teks: `Periode: Semua Periode`, `Total Pengajuan : 2 pengajuan`, `Dicetak oleh : Manager Demo`, `TOTAL Rp 220.000` | Pass |
| N14 | Export PDF terfilter | `?month=2026-08&status=disbursed` | Nama file mengandung bulan; hanya 1 baris; label filter tercetak | BE | `filename=Rekap-Pengajuan-Dana-2026-08.pdf`; teks: `Periode: Agustus 2026`, `Filter Status : Dicairkan`, `Total Pengajuan : 1 pengajuan`, `004/TIG/VIII/2026 … 100.000`, `TOTAL Rp 100.000` | Pass |
| N15 | Preview PDF inline | `GET /fund-requests/export/pdf/preview` | 200 `Content-Disposition: inline` | BE | 200, `Content-Disposition: inline` | Pass |
| N16 | Lampiran pengajuan disimpan & ikut terhapus | Buat `006/TIG/VIII/2026` multipart dengan `attachment=bukti.png`, lalu `DELETE` | Berkas tersimpan di `fund-requests/` dan hilang saat pengajuan dihapus | BE | `attachment_path=fund-requests/kukGdanW453It1BuhhmsnOYb10gmE5Y888nT7ylT.png attachment_name=bukti.png`, file ada di `storage/tenantqa-tiga/app/public/fund-requests/`. Setelah `DELETE`: folder **kosong** (hook `deleting` bekerja — berbeda dengan `BankTransaction`, lihat BUG-CF-02 di `cash-flow.md`) | Pass |
| N17 | Prop detail pencairan pada baris | Baca baris `disbursed` di prop `rows` | `disbursement_account_name` & bukti bayar diambil dari `BankTransaction` tertaut | BE | `"disbursement_account_name":"QA3 Rek 1 — Bank QA3"`, `"disbursement_attachment_name":"bukti.png"`, `"disbursement_attachment_url":"/storage/transaction-attachments/hkI8PT….png"` — isi prop benar (rekening & nama berkas diambil dari `BankTransaction` tertaut), tetapi URL-nya tidak bisa dibuka; kegagalan URL dilacak terpisah di A21 | Pass |
| N18 | Ajukan permintaan dana lewat form, nomor ter-generate otomatis | Buat Permintaan → judul, prioritas, dibutuhkan 29 Agu 2026, 1 item (2 × Rp 600.000) → Ajukan | Nomor terisi otomatis per perusahaan; total item terhitung; status Pending Review | FE+BE | Nomor `001/SAT/VIII/2026`; total Rp 1.200.000; status Pending Review; badge sidebar menampilkan 1 | Pass |

---

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | `total_amount` palsu dari client | `POST /fund-requests` menyertakan `total_amount=999999999` + item senilai 1.850.000 | Kiriman client diabaikan; total = sum item | BE | Tersimpan `total_amount=1850000` — nilai palsu **tidak dipakai sama sekali** | Pass |
| A02 | Tanpa item | `POST /fund-requests` tanpa `items` | 422 | FE+BE | 422 `"The items field is required."` | Pass |
| A03 | Kuantitas 0 | `items[0][quantity]=0` | 422 | FE+BE | 422 `"The items.0.quantity field must be at least 1."` | Pass |
| A04 | `needed_by_date` di masa lalu | `needed_by_date=2026-08-01` (hari uji 19/08/2026) | 422 | FE+BE | 422 `"The needed by date field must be a date after or equal to today."` | Pass |
| A05 | Prioritas tidak dikenal | `priority=super` | 422 | BE | 422 `"The selected priority is invalid."` | Pass |
| A06 | Nomor pengajuan duplikat | `request_number=001/TIG/VIII/2026` (sudah ada) | 422 | BE | 422 `"The request number has already been taken."` | Pass |
| A07 | `review_notes` > 500 karakter | `POST /fund-requests/2/review` dengan 600 karakter | 422 | FE+BE | 422 `"The review notes field must not be greater than 500 characters."` | Pass |
| A08 | Aksi review tidak dikenal | `action=hapus` | 422 | BE | 422 `"The selected action is invalid."` | Pass |
| A09 | Tanggal pencairan di masa depan | `disbursement_date=2026-09-01` | 422 | FE+BE | 422 `"The disbursement date field must be a date before or equal to today."` | Pass |
| A10 | Rekening pencairan tidak ada | `bank_account_id=999` | 422 | BE | 422 `"The selected bank account id is invalid."` | Pass |
| A11 | Submit pengajuan milik orang lain | Sesi manager `POST /fund-requests/1/submit` (milik staff) | 403; status tidak berubah | BE | **403**; `status` tetap `draft` | Pass |
| A12 | Staff mencoba review | Sesi staff `POST /fund-requests/1/review` `action=approve` | 403 | BE | 403 | Pass |
| A13 | Staff mencoba mencairkan | Sesi staff `POST /fund-requests/1/disburse` | 403 | BE | 403 | Pass |
| A14 | Cairkan pengajuan yang belum `approved` | Sesi manager `POST /fund-requests/1/disburse` saat status `pending` | Ditolak; **tidak ada** transaksi bank dibuat | BE | 302 + flash `error: "Permintaan dana tidak dapat dicairkan"`; `COUNT(bank_transactions WHERE description LIKE 'Pencairan%') = 0`; status tetap `pending` | Pass |
| A15 | Review pengajuan yang sudah `disbursed` | Sesi manager `POST /fund-requests/4/review` `action=approve` | Ditolak | BE | 302 + flash `error: "Permintaan dana tidak dapat ditinjau"` | Pass |
| A16 | Edit pengajuan `disbursed` (oleh admin) | Sesi admin `PUT /fund-requests/4` | Ditolak; data tidak berubah | BE | 302 + flash `error: "Permintaan dana tidak dapat diedit"`; `title`/`total_amount` id 4 tidak berubah | Pass |
| A17 | Non-pemilik non-admin mengedit draft | Sesi manager `PUT /fund-requests/3` (milik staff) | 403 | BE | **403** (`FundRequestController::update()` baris 308-310) | Pass |
| A18 | User tanpa `view fund requests` | Sesi income-only `GET /fund-requests` dan `GET /fund-requests/export/pdf` | 403 keduanya | BE | 403 & 403 | Pass |
| A19 | Item memakai kategori bertipe **income** | `POST /fund-requests` `items[0][category_id]=5` (`Penghasilan`, type `income`) | Ditolak (kategori item harus `expense`) | BE | **Diterima** (302), tersimpan `id=4 total_amount=100000`. Prop `categories` yang dikirim ke UI memang hanya 18 opsi bertipe expense dan **tidak memuat id 5** — jadi penjagaan hanya di frontend. Lihat **BUG-FR-05** dan C04 | Fail |
| A20 | Staff menghapus pengajuan `disbursed` | Sesi staff `DELETE /fund-requests/4` | Ditolak | BE | 302 + flash `error: "Permintaan dana tidak dapat dihapus"`; `id=4` tetap `disbursed` | Pass |
| A21 | URL bukti bayar pencairan | Akses `disbursement_attachment_url` dari prop | URL bisa dibuka | BE | `/storage/transaction-attachments/hkI8PT….png` → **403**; `/c/qa-tiga/storage/transaction-attachments/hkI8PT….png` → **200**. Sama persis dengan **BUG-CF-01** di `cash-flow.md` | Fail |
| A22 | **Staff menghapus draft milik MANAGER** | manager membuat `005/TIG/VIII/2026` (draft, `user_id=2`); sesi staff `DELETE /fund-requests/5` | 403 — bukan pemilik & bukan admin | BE | **302 + flash `success: "Permintaan dana berhasil dihapus"`**; baris `id=5` hilang dari DB. Lihat **BUG-FR-02** | Fail |
| A23 | Nomor berbasis COUNT bentrok setelah penghapusan | Setelah `001` dihapus (4 → 3 pengajuan), baca `nextNumber`, lalu kirim sebagai `request_number` | `nextNumber` harus nomor yang belum dipakai | BE | `nextNumber` berubah `005/TIG/VIII/2026` → **`004/TIG/VIII/2026`**, padahal `004` masih ada. Submit dengan nomor itu → 422 `"The request number has already been taken."` Lihat **BUG-FR-04** | Fail |
| A24 | Admin menghapus pengajuan `disbursed` | Sesi admin `DELETE /fund-requests/1` (status `disbursed`) | Transaksi bank hasil pencairan ikut ditangani (dihapus / dibalik) | BE | 302 success; `fund_requests id=1` hilang, tetapi `bank_transactions` **id 16 (1.500.000) & id 17 (350.000) tetap ada** dengan deskripsi menyebut pengajuan yang sudah tidak ada; saldo rek 1 tetap `90.610.500`. Lihat **BUG-FR-03** | Fail |
| A25 | `userOptions` pada filter pemohon | Baca prop `userOptions` sebagai manager di `/c/qa-tiga/fund-requests` | Hanya user yang menjadi anggota `qa-tiga` | BE | 9 user, termasuk `QA5 Pelapor` (id 8) dan `QA5 Tanpa Dashboard` (id 9) yang di `company_user` **hanya terdaftar di `qa-lima`**. Lihat **BUG-FR-07** | Fail |
| A26 | Kartu statistik saat filter aktif | `?month=2026-07` (0 baris) dan `?status=disbursed` (1 baris) | Statistik mencerminkan filter | BE | `stats` selalu `{"total":2,"total_amount":220000,"pending_count":0,"approved_count":0,"disbursed_count":1}` untuk **semua** kombinasi filter, termasuk yang menghasilkan 0 baris. Lihat **BUG-FR-06** | Fail |

---

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Siklus penuh lintas aktor & lintas modul | staff buat draft → staff submit → manager approve → manager cairkan ke rek 1 → cek Cash Flow → cek saldo | Status berjalan `draft→pending→approved→disbursed`; 2 debit muncul di Cash Flow → Pengeluaran; saldo turun tepat Rp 1.850.000 | BE | Semua langkah sesuai. Cash Flow `?search=Pencairan` → `stats={"total_amount":1850000,"total_count":2}`, baris 16 `1.500.000 / OPERASIONAL` dan 17 `350.000 / MAKAN MINUM`, `reference_number=REF-CAIR-QA3-001`. Saldo rek 1 `92.460.500 → 90.610.500` | Pass |
| C02 | **Jebakan terdokumentasi**: pengajuan ulang setelah `rejected` | (1) `002` di-reject; (2) staff `PUT /fund-requests/2` dengan `action=submit`; (3) staff `POST /fund-requests/2/submit` | Setelah edit + `action=submit`, status harus `pending` — atau paling tidak pesan gagal yang jujur | BE | (2) `302` + flash **`success: "Permintaan dana berhasil diajukan untuk persetujuan"`** padahal DB tetap `status=rejected` (item & total ikut berubah jadi 120.000, jadi edit-nya berhasil — hanya submit-nya yang gagal diam-diam). (3) flash `error: "Permintaan dana tidak dapat diajukan (pastikan ada item dengan jumlah valid)"`. Pemohon tidak punya jalan untuk mengajukan ulang. Lihat **BUG-FR-01** | Fail |
| C03 | Hapus pengajuan `disbursed` → pengeluaran yatim + nomor bentrok | admin hapus `001` (disbursed) → cek `bank_transactions`, saldo, dan `nextNumber` | Transaksi ikut ditangani; penomoran berikutnya tetap aman | BE | Transaksi 16 & 17 (total Rp 1.850.000) tertinggal tanpa induk; saldo tidak dikembalikan; `nextNumber` jatuh ke `004/TIG/VIII/2026` yang sudah dipakai → form berikutnya gagal 422. Dua cacat sekaligus: **BUG-FR-03** + **BUG-FR-04** | Fail |
| C04 | Pencairan dengan kategori item bertipe `income` | Buat `004` dengan item kategori 5 → submit → approve → cairkan ke rek 2 → cek halaman Income & Expenses | Transaksi pencairan terlihat di Cash Flow → Pengeluaran | BE | `bank_transactions id=18 debit 100.000 category_id=5`. Halaman **Expenses** memuat id `17,16,10,13,6,2` — **tanpa id 18**; halaman **Income** juga tidak memuatnya (arah `debit`). Saldo rek 2 tetap turun `109.667.000 → 109.567.000`. Pengeluaran Rp 100.000 tidak muncul di layar mana pun. Lihat **BUG-FR-05** (+ **BUG-CF-04**) | Fail |
| C05 | Siklus penuh lewat layar: ajukan → setujui → cairkan + bukti bayar | Review → Setujui → Cairkan (pilih rekening, catatan dikosongkan, unggah bukti PNG) → buka berkas buktinya | Status berpindah tiap tahap; catatan pencairan boleh kosong; bukti tersimpan dan bisa dibuka | FE+BE | Pending → Approved → Disbursed tanpa catatan diisi. DB: `bank_transactions id=2` Rp 1.200.000 debit dengan `attachment_path` terisi. Berkas terbuka di `/c/qa-satu/storage/transaction-attachments/…` — BUG-02 tertutup end-to-end lewat UI | Pass |

---

## Temuan

### BUG-FR-01 — Pengajuan ulang setelah `rejected` gagal diam-diam sambil menampilkan flash sukses
- **SIFAT**: Cacat state machine + pesan menyesatkan (alur bisnis buntu).
- **MENGGAGALKAN**: C02.
- **GEJALA**: Pengajuan `002/TIG/VIII/2026` berstatus `rejected`. Pemilik mengirim `PUT /c/qa-tiga/fund-requests/2` dengan `action=submit`. Respons 302 dan halaman berikutnya menampilkan flash `success: "Permintaan dana berhasil diajukan untuk persetujuan"`, tetapi DB tetap `status=rejected` (item & `total_amount` memang ikut berubah menjadi Rp 120.000, jadi bagian *edit*-nya berhasil). Jalur alternatif `POST /fund-requests/2/submit` menolak dengan flash `error: "Permintaan dana tidak dapat diajukan (pastikan ada item dengan jumlah valid)"` — pesan yang juga menyesatkan karena itemnya valid; masalahnya status.
- **SEBAB**: `app/Models/FundRequest.php:169-172` `canEdit()` menerima `draft` **dan** `rejected`, tetapi `canSubmit()` (baris 184-190) hanya menerima `draft`. `app/Http/Controllers/FundRequestController.php:318-362` — di dalam `DB::transaction` dipanggil `$fundRequest->submit()` tanpa memeriksa nilai kembaliannya, sedangkan `FundRequest::submit()` (baris 108-118) `return false` diam-diam bila `canSubmit()` gagal. Pesan flash disusun di baris 364-368 semata-mata dari `$validated['action']`, bukan dari hasil `submit()`. `update()` juga tidak pernah mereset status `rejected` → `draft`.
- **CAKUPAN**: Semua pemohon yang pengajuannya ditolak, di semua perusahaan. Dampak: pengajuan yang ditolak **tidak bisa diajukan ulang sama sekali** lewat UI, dan pemohon percaya sudah mengajukan sehingga tidak menindaklanjuti.
- **SARAN PERBAIKAN**: Di `update()`, reset status ke `draft` ketika `canEdit()` benar dan status saat ini `rejected` (bersihkan `reviewed_by`/`reviewed_at`/`review_notes` atau simpan sebagai riwayat), lalu panggil `submit()` dan **pakai nilai kembaliannya** untuk memilih pesan flash. Minimal: bila `submit()` mengembalikan `false`, kirim flash `error`, jangan `success`.

### BUG-FR-02 — Siapa pun ber-permission `delete fund requests` bisa menghapus pengajuan milik orang lain
- **SIFAT**: Celah otorisasi (kepemilikan tidak dicek) → kehilangan data.
- **MENGGAGALKAN**: A22.
- **GEJALA**: `manager@gmail.com` (user id 2) membuat draft `005/TIG/VIII/2026`. `staff@gmail.com` (user id 3, bukan admin, bukan pemilik) mengirim `DELETE /c/qa-tiga/fund-requests/5` → 302 dengan flash `success: "Permintaan dana berhasil dihapus"` dan baris hilang dari DB.
- **SEBAB**: `app/Http/Controllers/FundRequestController.php:371-380` — `destroy()` hanya memanggil `$fundRequest->canDelete()`, yang di `app/Models/FundRequest.php:174-182` hanya memeriksa **role admin** dan **status** (`draft`/`rejected`) — tidak pernah `user_id`. Bandingkan `update()` (baris 308-310) dan `submit()` (baris 384-386) yang **memang** memeriksa kepemilikan dengan `abort(403)`. Asimetri ini juga tercermin di prop baris: `'can_edit' => canEdit() && (pemilik || admin)` tetapi `'can_delete' => canDelete()` saja, jadi tombol hapus pun muncul untuk milik orang lain.
- **CAKUPAN**: Role `staff` di aplikasi ini memiliki `delete fund requests`, sehingga setiap staff bisa menghapus draft/pengajuan ditolak milik rekan kerjanya (termasuk milik manajer). Berlaku di semua perusahaan.
- **SARAN PERBAIKAN**: Samakan dengan `update()`: `abort_if($fundRequest->user_id !== auth()->id() && ! auth()->user()->hasRole('admin'), 403)` di awal `destroy()`, dan sertakan cek yang sama pada flag `can_delete` di `index()`. Idealnya pindahkan seluruh aturan ini ke `FundRequestPolicy` agar route, controller, dan prop memakai satu sumber kebenaran.

### BUG-FR-03 — Menghapus pengajuan `disbursed` meninggalkan pengeluaran yatim di bank
- **SIFAT**: Inkonsistensi data lintas modul (invarian terdokumentasi, terbukti).
- **MENGGAGALKAN**: A24, C03.
- **GEJALA**: Admin menghapus `001/TIG/VIII/2026` yang berstatus `disbursed`. Baris `fund_requests` hilang, tetapi `bank_transactions` id 16 (Rp 1.500.000) dan id 17 (Rp 350.000) tetap ada dengan deskripsi `"Pencairan Dana: QA3 Pengajuan Operasional Lapangan - …"` merujuk pengajuan yang sudah tidak ada. Saldo rekening 1 tetap `90.610.500` — tidak dikembalikan, dan tidak ada jejak untuk merekonsiliasi.
- **SEBAB**: `app/Http/Controllers/FundRequestController.php:371-380` `destroy()` hanya memanggil `$fundRequest->delete()`. `canDelete()` (`app/Models/FundRequest.php:174-182`) memberi admin izin pada **status apa pun**, termasuk `disbursed`. Tidak ada hook maupun relasi terbalik yang membereskan transaksi: `fund_requests.bank_transaction_id` bahkan hanya menunjuk **transaksi pertama** (`FundRequestController::disburse()` menyimpan `$transactionIds[0]`), sehingga transaksi item ke-2 dan seterusnya tidak terjangkau dari fund request sama sekali.
- **CAKUPAN**: Semua role `admin`. Efeknya paling terasa di Cash Flow → Pengeluaran dan Laporan Laba Rugi: beban tetap tercatat tanpa dokumen sumber.
- **SARAN PERBAIKAN**: Tolak penghapusan pengajuan berstatus `disbursed` (paling aman), atau — jika penghapusan tetap diizinkan — simpan seluruh id transaksi (tabel pivot atau kolom `fund_request_id` di `bank_transactions`) lalu hapus/balik semuanya dalam satu `DB::transaction` dan tampilkan konfirmasi yang menyebut nominal yang akan ikut dihapus.

### BUG-FR-04 — Pratinjau nomor (`nextNumber`) berbasis COUNT bisa bentrok dengan nomor yang masih ada
- **SIFAT**: Cacat generator / kegunaan.
- **MENGGAGALKAN**: A23, C03.
- **GEJALA**: Dengan 4 pengajuan di Agustus 2026, `nextNumber = "005/TIG/VIII/2026"`. Setelah `001` dihapus, `nextNumber` menjadi **`004/TIG/VIII/2026`** — nomor yang masih dipakai pengajuan id 4. Form yang disubmit apa adanya ditolak `422 "The request number has already been taken."`
- **SEBAB**: `app/Models/FundRequest.php` `generateRequestNumber()` menghitung `COUNT` pengajuan pada bulan+tahun berjalan lalu `+1`, bukan mengambil nomor urut terbesar yang sudah dipakai. Rule `unique:fund_requests,request_number` di `StoreFundRequestRequest` menahan duplikasi sehingga tidak terjadi korupsi data — tetapi alur pembuatan jadi buntu sampai user mengetik nomor manual.
- **CAKUPAN**: Setiap perusahaan yang pernah menghapus pengajuan pada bulan berjalan. Ada juga potensi race pada submit bersamaan (dua request membaca COUNT yang sama).
- **SARAN PERBAIKAN**: Turunkan sequence dari nomor urut terbesar yang ada pada bulan+tahun tersebut (`MAX(CAST(SUBSTRING_INDEX(request_number,'/',1) AS UNSIGNED))`) + 1, dan ulangi increment sampai menemukan nomor bebas. Untuk race, bungkus pembuatan dalam transaksi dengan `lockForUpdate` atau tangani `QueryException` unique dengan retry.

### BUG-FR-05 — Kategori item tidak divalidasi bertipe `expense`, pencairannya jadi tak terlihat di Cash Flow
- **SIFAT**: Celah validasi dengan dampak pelaporan.
- **MENGGAGALKAN**: A19, C04.
- **GEJALA**: Pengajuan `004/TIG/VIII/2026` dibuat dengan `items[0][category_id]=5` (`Penghasilan`, type `income`) dan diterima. Setelah disetujui dan dicairkan ke rekening 2, terbentuk `bank_transactions id=18 debit Rp 100.000 category_id=5`. Baris itu **tidak muncul di halaman Expenses** (kategori bukan `expense`) dan **tidak di Income** (arah `debit`) — daftar Expenses berisi id `17,16,10,13,6,2` saja — sementara saldo rekening 2 tetap turun dari `109.667.000` ke `109.567.000`.
- **SEBAB**: `app/Http/Requests/StoreFundRequestRequest.php` / `UpdateFundRequestRequest.php` memvalidasi `items.*.category_id` tanpa membatasi `type`. Pembatasan hanya di frontend: controller mengirim prop `categories` dari `TransactionCategory::selectOptions('expense')` (terverifikasi: 18 opsi, **tidak** memuat id 5). Kategori item lalu diteruskan apa adanya ke `BankTransaction::create()` di `FundRequestController::disburse()`, dan halaman Cash Flow menyaring berdasarkan tipe kategori (lihat `docs/module/cash-flow.md` — "Klasifikasi halaman bergantung tipe kategori").
- **CAKUPAN**: Siapa pun yang bisa membuat pengajuan dan memanggil endpoint langsung; juga kategori yang tipenya diubah admin **setelah** pengajuan dibuat. Dampak: beban yang benar-benar mengurangi kas tetapi tidak pernah tampil di laporan pengeluaran operasional.
- **SARAN PERBAIKAN**: Tambahkan `Rule::exists('transaction_categories','id')->where('type','expense')` pada `items.*.category_id` di kedua FormRequest, dan cek ulang tipe kategori saat `disburse()` (kategori bisa berubah di antara pengajuan dan pencairan). Terkait erat dengan **BUG-CF-04**.

### BUG-FR-06 — Kartu statistik tidak mengikuti filter yang sedang aktif
- **SIFAT**: Inkonsistensi UI/laporan (ringan).
- **MENGGAGALKAN**: A26.
- **GEJALA**: Dengan filter apa pun — `?status=disbursed` (1 baris), `?month=2026-07` (**0 baris**), `?search=ATK` (1 baris) — prop `stats` selalu `{"total":2,"total_amount":220000,"pending_count":0,"approved_count":0,"disbursed_count":1}`. Pengguna melihat "2 pengajuan / Rp 220.000" di atas tabel yang kosong.
- **SEBAB**: `app/Http/Controllers/FundRequestController.php:68-78` — `$statsQuery = FundRequest::query()` dibuat dari nol dan hanya menerapkan filter `tab`; seluruh filter `search`/`status`/`priority`/`user_id`/`month` yang sudah dibangun di `$query` tidak ikut. Bandingkan `CashFlowController` yang mengklon query terfilter sebelum menghitung `stats` — di sana statistik memang ikut menyaring (terverifikasi di `cash-flow.md` N15/N16).
- **CAKUPAN**: Semua pengguna halaman Fund Requests. Tidak merusak data, tetapi angka ringkasan menyesatkan saat filter dipakai.
- **SARAN PERBAIKAN**: Hitung statistik dari klon query yang sudah difilter (`(clone $query)->selectRaw(...)`) sebelum paginasi — persis pola yang dipakai `CashFlowController`. Bila statistik global memang disengaja, beri label eksplisit ("total keseluruhan") di UI.

### BUG-FR-07 — `userOptions` membocorkan nama pengguna dari perusahaan lain
- **SIFAT**: Kebocoran data lintas tenant (informasi, bukan finansial).
- **MENGGAGALKAN**: A25.
- **GEJALA**: Prop `userOptions` pada `/c/qa-tiga/fund-requests` (sesi manager) berisi 9 user, termasuk `QA5 Pelapor` (id 8) dan `QA5 Tanpa Dashboard` (id 9). Pemeriksaan `finance_central.company_user` menunjukkan kedua user itu **hanya** anggota `qa-lima`, bukan `qa-tiga`. Nama-nama itu tampil di dropdown filter "Pemohon".
- **SEBAB**: `app/Http/Controllers/FundRequestController.php:131-133` — `User::orderBy('name')->get()` tanpa pembatasan keanggotaan perusahaan, padahal `users` tinggal di database pusat yang dipakai bersama semua tenant.
- **CAKUPAN**: Semua user dengan `approve fund requests` di perusahaan mana pun. Yang bocor adalah nama (dan id) pengguna organisasi/perusahaan lain — bukan data transaksi. Perlu dicek apakah pola `User::…->get()` tanpa scope juga dipakai modul lain (di luar cakupan pengujian ini).
- **SARAN PERBAIKAN**: Batasi ke anggota perusahaan aktif, mis. `User::whereHas('companies', fn ($q) => $q->where('companies.id', tenant()->getTenantKey()))->orderBy('name')->get()`, atau tambahkan global scope keanggotaan pada model `User` saat konteks tenant aktif.

> Catatan: temuan **BUG-CF-01** (URL lampiran tanpa prefix perusahaan → 403) juga
> berlaku penuh di modul ini lewat `disbursement_attachment_url` (case A21).
> Rinciannya ditulis satu kali di [`cash-flow.md`](cash-flow.md) agar tidak ganda.

---

## Catatan pelaksanaan

- **Cara eksekusi.** Semua case dijalankan lewat HTTP ke `http://127.0.0.1:8000` dengan cookie sesi hasil login sungguhan + `X-XSRF-TOKEN`; prop Inertia dibaca dari `<script data-page="app">` pada respons HTML; efek samping diverifikasi langsung ke `tenant_qa-tiga` dan `finance_central` lewat PDO. **Tidak ada case yang dijalankan lewat klik di browser.** Kolom `FE+BE` diisi hanya bila penegakan sisi frontend juga terbaca di kode/prop (mis. prop `categories` yang hanya berisi kategori `expense` pada A19, atau flag `can_*` per baris); bukti eksekusi yang dilampirkan selalu dari sisi BE.
- **Yang dibuktikan lewat eksekusi vs lewat baca kode.** Seluruh baris "Hasil Aktual" adalah hasil eksekusi nyata (status HTTP, isi flash, isi prop, isi tabel). Rujukan file:baris pada blok Temuan adalah hasil pembacaan kode untuk menjelaskan **sebab** — bukan sumber klaim gejalanya.
- **Tidak ada perubahan kode aplikasi.** Bug dilaporkan, tidak diperbaiki.
- **Batasan yang jujur diakui.** (a) Tampilan dialog detail/review/disburse, Sheet create/edit, dan tab di UI **tidak diuji secara visual** — hanya kontrak data. (b) Jalur `GET /fund-requests/create` dan `/fund-requests/{id}/edit` (halaman penuh) tidak dirender-uji; seluruh create/update diuji lewat endpoint `POST`/`PUT` yang sama. (c) Perilaku badge sidebar (`getActionCounts`) dan seksi Dashboard "Pengajuan Dana" **Belum diuji** — di luar cakupan yang diminta. (d) Race condition penomoran pada submit bersamaan **Belum diuji** (butuh permintaan paralel; hanya dianalisis dari kode). (e) `show_requestor=1` pada export menghasilkan susunan teks yang terlihat janggal saat diekstrak dengan `pdftotext` (baris "Pengaju:" muncul sebelum judul pada satu baris dan tidak muncul pada baris lain) — **tidak saya laporkan sebagai bug** karena bisa jadi artefak ekstraksi teks, bukan tampilan PDF sesungguhnya; perlu dicek manusia secara visual.
- **Kegagalan tooling (bukan cacat aplikasi).** Berkas respons sementara helper QA (`/tmp/qa_body.txt`) dipakai bersama oleh sesi agent lain sehingga sempat menampilkan respons milik perusahaan `qa-lima`; helper diubah agar menulis ke direktori khusus (`/tmp/qa3/`) sebelum satu pun hasil dicatat. Tidak ada hasil di dokumen ini yang berasal dari berkas bersama itu.
- **Sisa data uji** di `tenant_qa-tiga`: 2 fund request (`002` rejected, `004` disbursed) dan transaksi pencairan yatim id 16 & 17 — sengaja ditinggal sebagai bukti BUG-FR-03. Satu-satunya aktor tambahan yang dipakai di modul ini (`qa3.income@example.test`, hanya untuk A18) dibuat khusus untuk QA dan **sudah dihapus** setelah pengujian; rinciannya di [`cash-flow.md`](cash-flow.md) bagian *Catatan pelaksanaan*. Role bersama `admin`/`finance manager`/`staff` tidak diubah.
