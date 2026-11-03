# QC Penguji C -- Reimbursement, Permintaan Dana, Pinjaman, Piutang

Lingkungan: `qcc_central` + `tenant_qccsatu` / `tenant_qccdua`, server `http://127.0.0.1:8013`
(`bash docs/qa/siapkan-lingkungan-qc.sh c 8013`). Branch `feature/multi-tenancy-rekonsiliasi`.
Tanggal uji: 3 November 2026. Bukti: [`docs/qa/bukti/operasional/`](../bukti/operasional/).

Semua kasus di bawah **dijalankan**; tidak ada yang dihitung lulus karena hanya dibaca kodenya.
Kasus berlapis `BE` tidak punya tangkapan layar karena UI memang tidak menyediakan jalannya --
tombolnya tidak dirender untuk status itu -- sehingga permintaannya disusun sendiri dengan token
CSRF sesi yang sedang login; alasannya ditulis di kolom Langkah. Verifikasi status, baris terkait,
dan saldo selalu dilakukan dengan query langsung ke database tenant, bukan dari tampilan layar.

## Papan skor

| Modul | Diuji | Lulus | Gagal | Temuan non-blokir |
|---|---:|---:|---:|---:|
| Reimbursement | 37 | 36 | 0 | 1 |
| Permintaan Dana (Fund Request) | 23 | 21 | 2 | 0 |
| Pinjaman (Loans) | 10 | 10 | 0 | 0 |
| Piutang (Receivables) | 22 | 20 | 1 | 1 |
| Lintas perusahaan | 6 | 6 | 0 | 0 |
| **Total** | **98** | **93** | **3** | **2** |

Per lapisan: `BE` 67 kasus, `FE` 3 kasus, `FE+BE` 28 kasus.
Berkas bukti: 62 tangkapan layar (lebar 420px), seluruhnya tertaut dari tabel kasus.

### Rekonsiliasi saldo -- bukti tidak ada uang hantu

Sesudah seluruh pengujian, `bank_transactions` di `tenant_qccsatu` berjumlah 13 baris dengan
netto **-Rp 9.190.000**, dan angka itu cocok persis dengan penjumlahan tangan atas setiap aksi
yang memang seharusnya menyentuh kas:

```
-    500.000  pembayaran reimbursement (2 transaksi: cicilan + pelunasan)
-    270.000  pencairan permintaan dana (2 transaksi, satu per item)
+ 10.000.000  penerimaan pinjaman LOAN-00001
- 10.600.000  pembayaran pinjaman (4 transaksi: 2x pokok, 2x bunga)
-  3.000.000  pencairan piutang RCV-00001
+  3.180.000  pelunasan piutang RCV-00001 (pokok + bunga)
-  8.000.000  pencairan piutang RCV-00002
------------
-  9.190.000  = netto terukur di database
```

Yang TIDAK meninggalkan jejak di kas, dan memang tidak boleh: setiap penolakan
(R-N06, Pt-N07), setiap transisi tidak sah yang ditolak (67 kasus `BE`), dan pinjaman
LOAN-00002 yang dihapus -- mutasi masuknya Rp 5.000.000 ikut terhapus (P-A03).

## Kasus uji

### Reimbursement

| ID | Lapisan | Kasus | Langkah / payload | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|---|
| `R-N01` | FE+BE | Staff membuat pengajuan sebagai draft | Sheet buat: judul, Rp 500.000, kategori Transportasi, keterangan -> Simpan draft | DB: `status=draft`, `payment_status=unpaid`, `category_input=transport`, `category_id=NULL`. Drawer `#reimbursement/1` terbuka | LULUS | [1-form-terisi](../bukti/operasional/R-N01-1-form-terisi.png)<br>[2-tersimpan](../bukti/operasional/R-N01-2-tersimpan.png) |
| `R-N02` | FE+BE | Staff mengajukan draft untuk review | Drawer -> Ajukan -> konfirmasi | `draft -> pending`, toast "Reimbursement berhasil diajukan untuk persetujuan" | LULUS | [1-drawer-draft](../bukti/operasional/R-N02-1-drawer-draft.png)<br>[2-konfirmasi](../bukti/operasional/R-N02-2-konfirmasi.png)<br>[3-pending](../bukti/operasional/R-N02-3-pending.png) |
| `R-N03` | FE+BE | FM menyetujui + menetapkan kategori akuntansi | Drawer -> Setujui -> kategori "MAKAN MINUM" | `pending -> approved`, `category_id=15`, `reviewed_by=2` | LULUS | [1-drawer-pending](../bukti/operasional/R-N03-1-drawer-pending.png)<br>[2-dialog-setujui](../bukti/operasional/R-N03-2-dialog-setujui.png)<br>[3-approved](../bukti/operasional/R-N03-3-approved.png) |
| `R-N04` | FE+BE | FM membayar SEBAGIAN (Rp 200.000 dari Rp 500.000) | Dialog bayar, rekening Kas Utama; tombol berubah jadi "Bayar sebagian" | `amount_paid=200000`, `payment_status=partial`, status tetap `approved`; BankTransaction debit Rp 200.000 kategori 15 "Cicilan Reimbursement..."; saldo 100.000.000 -> 99.800.000 | LULUS | [1-dialog-terisi](../bukti/operasional/R-N04-1-dialog-terisi.png)<br>[2-sesudah-bayar](../bukti/operasional/R-N04-2-sesudah-bayar.png) |
| `R-N05` | FE+BE | FM melunasi sisa (Rp 300.000) | Dialog bayar; tombol "Bayar lunas" | `status=paid`, `payment_status=paid`, `amount_paid=500000`; transaksi kedua "Pelunasan Reimbursement..."; saldo 99.500.000 | LULUS | [1-dialog-terisi](../bukti/operasional/R-N05-1-dialog-terisi.png)<br>[2-sesudah-bayar](../bukti/operasional/R-N05-2-sesudah-bayar.png) |
| `R-N06` | FE+BE | FM menolak + alasan -- **tanpa efek samping bank** | Drawer -> Tolak -> alasan "Struk tidak terlampir..." | `pending -> rejected`, `review_notes` tersimpan. **`bank_transactions` tetap 2 baris** -- penolakan tidak membuat transaksi apa pun | LULUS | [1-drawer-pending](../bukti/operasional/R-N06-1-drawer-pending.png)<br>[2-dialog-tolak](../bukti/operasional/R-N06-2-dialog-tolak.png)<br>[3-ditolak](../bukti/operasional/R-N06-3-ditolak.png) |
| `R-N07` | FE+BE | Staff memperbaiki & mengajukan ulang pengajuan ditolak | Drawer ditolak -> "Perbaiki & ajukan ulang" -> lampirkan bukti -> Ajukan ulang | `rejected -> pending`; `reviewed_by`/`reviewed_at`/`review_notes` **direset NULL**; lampiran tetap terpasang | LULUS | [1-drawer-ditolak](../bukti/operasional/R-N07-1-drawer-ditolak.png)<br>[2-sheet-edit-lampiran](../bukti/operasional/R-N07-2-sheet-edit-lampiran.png)<br>[3-diajukan-ulang](../bukti/operasional/R-N07-3-diajukan-ulang.png) |
| `R-N08` | FE+BE | Lampiran bukti: prefix URL tenant & bisa dibuka pemilik | Unggah PNG -> baca `attachment_url` dari `/reimbursements/3/data` | URL `http://127.0.0.1:8013/c/qccsatu/storage/reimbursements/...png` (**ber-prefix `/c/{slug}/storage/`**); pemilik membuka -> `200 image/png` | LULUS | [1-drawer-dengan-bukti](../bukti/operasional/R-N08-1-drawer-dengan-bukti.png) |
| `R-A01` | BE | Setujui pengajuan DRAFT lewat HTTP langsung | `POST /reimbursements/2/review {action:approve,category_id:15}` -- UI tidak merender tombol Setujui untuk draft, jadi hanya terjangkau lewat HTTP | 422 `{"message":"Reimbursement tidak dapat ditinjau"}` | LULUS | -- |
| `R-A02` | BE | Setujui pengajuan yang sudah LUNAS | `POST /reimbursements/1/review` (status `paid`) | 422 "Reimbursement tidak dapat ditinjau" | LULUS | -- |
| `R-A03` | BE | Bayar pengajuan DRAFT (belum disetujui) | `POST /reimbursements/2/pay` | 422 "Reimbursement tidak dapat dibayar" | LULUS | -- |
| `R-A04` | BE | Bayar pengajuan PENDING (belum disetujui) | `POST /reimbursements/3/pay` | 422 "Reimbursement tidak dapat dibayar" | LULUS | -- |
| `R-A05` | BE | Bayar lagi pengajuan yang sudah lunas | `POST /reimbursements/1/pay`, sisa Rp 0 | 422 "Jumlah pembayaran melebihi sisa reimbursement (Rp 0)." | LULUS | -- |
| `R-A06` | BE | Hapus pengajuan yang sudah ada pembayarannya | `DELETE /reimbursements/1` | 403 -- ditolak; transaksi debitnya sudah memotong saldo sehingga penghapusan memang harus dicegah | LULUS | -- |
| `R-A07` | BE | Ajukan ulang pengajuan yang sudah lunas | `POST /reimbursements/1/submit` | 403 | LULUS | -- |
| `R-A08` | BE | Setujui tanpa `category_id` (wajib saat approve) | `POST .../review {action:approve}` | 422 "Kategori transaksi wajib diisi ketika aksi bernilai approve." | LULUS | -- |
| `R-A09` | BE | Setujui dengan `category_id` tidak ada (99999) | `POST .../review {category_id:99999}` | 422 "Kategori transaksi yang dipilih tidak valid." | LULUS | -- |
| `R-A10` | BE | FM mengedit pengajuan milik staff (bukan pemilik) | `PUT /reimbursements/1` | 403 -- edit reimbursement tidak punya bypass admin/FM | LULUS | -- |
| `R-A11` | BE | **Staff membaca pengajuan milik FM dengan menebak id** | `GET /reimbursements/4/data` (milik `user_id=2`) | **404** -- bukan pemilik dan bukan reviewer/pembayar | LULUS | -- |
| `R-A12` | BE | Kontrol positif: staff membaca pengajuan MILIKNYA | `GET /reimbursements/2/data` | 200 + JSON lengkap -- membuktikan 404 di R-A11 bukan karena endpointnya rusak | LULUS | -- |
| `R-A13` | BE | Staff mengedit pengajuan milik FM | `PUT /reimbursements/4` | 403 | LULUS | -- |
| `R-A14` | BE | Staff mengajukan pengajuan milik FM | `POST /reimbursements/4/submit` | 403 | LULUS | -- |
| `R-A15` | BE | Staff **menghapus** pengajuan milik FM (staff PUNYA izin `delete reimbursements`) | `DELETE /reimbursements/4` | 422 "Reimbursement tidak dapat dihapus" -- izin saja tidak cukup, `canDelete()` mensyaratkan kepemilikan | LULUS | -- |
| `R-A16` | BE | Staff menyetujui tanpa izin `approve` | `POST /reimbursements/3/review` | 403 "This action is unauthorized." | LULUS | -- |
| `R-A17` | BE | Staff membayar tanpa izin `pay` | `POST /reimbursements/3/pay` | 403 | LULUS | -- |
| `R-A18` | FE+BE | **Staff memaksa `?tab=all`** untuk melihat pengajuan semua orang | `GET /reimbursements?tab=all` | Props balik `tab:"my"`, `canSeeAll:false`, 3 baris (semuanya miliknya). FM pada URL sama: `tab:"all"`, 4 baris. **Cakupan ditegakkan server** | LULUS | [1-staff-tab-all](../bukti/operasional/R-A18-1-staff-tab-all.png) |
| `R-A19` | BE | **Lampiran dibuka dari perusahaan lain** | Akun `luar` (anggota qccdua saja) membuka URL lampiran qccsatu | **403**; URL diubah ke `/c/qccdua/storage/...` -> **404** | LULUS | -- |
| `R-A20` | BE | Bayar melebihi sisa (Rp 250.001 dari sisa Rp 250.000) | `POST .../pay` | 422 "Jumlah pembayaran melebihi sisa reimbursement (Rp 250.000)." | LULUS | -- |
| `R-A21` | BE | Tanggal bayar di masa depan | `payment_date: 2027-01-01` | 422 "Tanggal pembayaran tidak boleh setelah hari ini." | LULUS | -- |
| `R-A22` | BE | Bayar nominal 0 | `payment_amount: 0` | 422 "Jumlah pembayaran minimal 1." | LULUS | -- |
| `R-A23` | BE | Bayar nominal negatif | `payment_amount: -50000` | 422 "Jumlah pembayaran minimal 1." | LULUS | -- |
| `R-A24` | BE | Bayar dari rekening yang tidak ada | `bank_account_id: 9999` | 422 "Rekening bank yang dipilih tidak valid." | LULUS | -- |
| `R-A25` | BE | Buat pengajuan nominal 0 | `amount: 0` | 422 "Nominal minimal Rp 1." | LULUS | -- |
| `R-A26` | BE | Buat pengajuan kategori di luar 7 nilai tetap | `category: "kategori_palsu"` | 422 "Kategori yang dipilih tidak valid." | LULUS | -- |
| `R-A27` | BE | Buat pengajuan langsung `action=approve` (lompat antrean review) | `action: "approve"` | 422 "Aksi yang dipilih tidak valid." | LULUS | -- |
| `R-A28` | BE | Review dengan `action` tak dikenal | `action: "hapus"` | 422 "Aksi yang dipilih tidak valid." | LULUS | -- |
| `R-C02` | FE | Dialog konfirmasi **Ajukan** memakai gaya destruktif | Drawer draft -> Ajukan | Judul "Ajukan pengajuan ini?" tetapi ikonnya **tong sampah merah** dan tombol konfirmasinya **merah (varian bahaya)** -- padahal aksinya hanya mengirim ke antrean review | TEMUAN | [1-dialog-ajukan-bergaya-destruktif](../bukti/operasional/R-C02-1-dialog-ajukan-bergaya-destruktif.png) |

### Permintaan Dana (Fund Request)

| ID | Lapisan | Kasus | Langkah / payload | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|---|
| `F-N01` | FE+BE | Staff membuat permintaan dana 1 item | Sheet: judul, tujuan, prioritas Medium, dibutuhkan 28 Nov, item Kertas A4 3 x Rp 50.000 | DB: `001/SC/XI/2026`, `total_amount=150000` **dihitung server** dari item (3x50.000), `status=draft` | LULUS | [1-tersimpan](../bukti/operasional/F-N01-1-tersimpan.png) |
| `F-N02` | FE+BE | Staff membuat permintaan 2 item lalu Ajukan | Item A 2 x Rp 75.000 + Item B 1 x Rp 120.000; form menampilkan "Total Pengajuan: Rp 270.000" | `total_amount=270000`, 2 baris `fund_request_items` dengan kategori berbeda (19 & 15), `status=pending` | LULUS | [1-form-dua-item](../bukti/operasional/F-N02-1-form-dua-item.png)<br>[2-diajukan](../bukti/operasional/F-N02-2-diajukan.png) |
| `F-N03` | FE+BE | FM menyetujui permintaan | Baris pending -> Review -> Setujui | `pending -> approved`, toast "Permintaan dana disetujui" | LULUS | [1-daftar-pending](../bukti/operasional/F-N03-1-daftar-pending.png)<br>[2-dialog-review](../bukti/operasional/F-N03-2-dialog-review.png)<br>[3-disetujui](../bukti/operasional/F-N03-3-disetujui.png) |
| `F-N04` | FE+BE | FM mencairkan -> **satu transaksi bank PER ITEM** | Dialog Cairkan, rekening Kas Utama, tanggal hari ini | `status=disbursed`; **2** BankTransaction debit: Rp 150.000 kategori 19 + Rp 120.000 kategori 15, deskripsi "Pencairan Dana: ... - {item}"; `bank_transaction_id` menunjuk transaksi pertama; saldo 99.500.000 -> 99.230.000 | LULUS | [1-dialog-cairkan](../bukti/operasional/F-N04-1-dialog-cairkan.png)<br>[2-dicairkan](../bukti/operasional/F-N04-2-dicairkan.png) |
| `F-A01` | FE+BE | **Nomor tidak duplikat** sesudah menghapus pengajuan di bulan yang sama | Buat 001, 002, 003 -> hapus 002 -> buat lagi | Nomor baru **004**, bukan 003 yang duplikat. Pratinjau `nextNumber` juga 004 sebelum dan sesudah penghapusan. Kode memakai `max()` + loop anti-tabrakan, bukan `count()` -- premis spec sudah tidak berlaku | LULUS | [1-tiga-pengajuan](../bukti/operasional/F-A01-1-tiga-pengajuan.png)<br>[2-sesudah-hapus-tengah](../bukti/operasional/F-A01-2-sesudah-hapus-tengah.png)<br>[3-buat-lagi](../bukti/operasional/F-A01-3-buat-lagi.png) |
| `F-A02` | BE | Setujui permintaan DRAFT | `POST /fund-requests/1/review {action:approve}` | Ditolak, flash `error`: "Permintaan dana tidak dapat ditinjau" | LULUS | -- |
| `F-A03` | BE | Setujui permintaan yang sudah DICAIRKAN | `POST /fund-requests/5/review` | Ditolak, flash "Permintaan dana tidak dapat ditinjau" | LULUS | -- |
| `F-A04` | BE | Cairkan permintaan DRAFT (belum disetujui) | `POST /fund-requests/1/disburse` | Ditolak, flash "Permintaan dana tidak dapat dicairkan" | LULUS | -- |
| `F-A05` | BE | Cairkan DUA KALI permintaan yang sama | `POST /fund-requests/5/disburse` pada status `disbursed` | Ditolak -- tidak terbentuk transaksi bank kedua | LULUS | -- |
| `F-A06` | BE | Cairkan dengan tanggal di masa depan | `disbursement_date: 2027-01-01` | 422 | LULUS | -- |
| `F-A07` | BE | Edit permintaan yang sudah dicairkan | `PUT /fund-requests/5` | 403 | LULUS | -- |
| `F-A08` | BE | Ajukan permintaan yang sudah dicairkan | `POST /fund-requests/5/submit` | 403 | LULUS | -- |
| `F-A09` | BE | `needed_by_date` di masa lalu | `2020-01-01` | 422 | LULUS | -- |
| `F-A10` | BE | Buat permintaan tanpa item | `items: []` | 422 "Items wajib diisi." | LULUS | -- |
| `F-A11` | BE | Item `quantity` 0 | `quantity: 0` | 422 | LULUS | -- |
| `F-A12` | BE | Nomor yang sengaja dibuat bentrok | `request_number: "001/SC/XI/2026"` | 422 "Request number sudah digunakan." -- unique index terjaga | LULUS | -- |
| `F-A13` | FE+BE | **Staff memaksa `?tab=all`** | `GET /fund-requests?tab=all` sebagai staff (hanya punya `view fund requests`) | **Props balik `tab:"all"` dan menampilkan permintaan milik Finance Manager**: judul, tujuan, nominal Rp 777.000, prioritas, nama pemohon. Bandingkan R-A18 -- modul reimbursement memaksa `my` | **GAGAL** | [1-staff-tab-all](../bukti/operasional/F-A13-1-staff-tab-all.png) |
| `F-A14` | BE | `total_amount` dipaksa dari client | Kirim `total_amount: 9000000000` dengan 1 item Rp 1.000 | Tersimpan `total_amount=1000` -- nilai client diabaikan, total dihitung ulang dari item | LULUS | -- |
| `F-A15` | BE | Staff menghapus draft milik FM (staff PUNYA `delete fund requests`) | `DELETE /fund-requests/7`, juga dicoba lewat `POST ...?_method=DELETE` | Baris tetap ada pada kedua percobaan. `canDelete()` memeriksa kepemilikan | LULUS | [1-daftar-sesudah-coba-hapus](../bukti/operasional/F-A15-1-daftar-sesudah-coba-hapus.png) |
| `F-A16` | FE | Admin membuka detail permintaan yang sudah dicairkan | Dialog detail baris `disbursed` | Tidak ada tombol hapus sama sekali; dialog justru memberi tahu "2 transaksi pengeluaran dibuat di rekening ini" | LULUS | [1-detail-disbursed](../bukti/operasional/F-A16-1-detail-disbursed.png) |
| `F-A17` | BE | **Admin menghapus permintaan yang sudah dicairkan** (uji uang hantu) | `DELETE /fund-requests/5` sebagai admin -- UI tidak menyediakan tombolnya (lihat F-A16) | Ditolak; `errors.delete` = "Pengajuan yang sudah dicairkan tidak dapat dihapus karena pencairannya sudah tercatat sebagai pengeluaran bank." Baris dan kedua transaksi pencairan tetap utuh | LULUS | [1-disbursed-masih-ada](../bukti/operasional/F-A17-1-disbursed-masih-ada.png) |
| `F-A18` | BE | Ajukan ulang sesudah ditolak -- dua jalur berbeda | `POST .../submit` vs `PUT ... {action:submit}` pada status `rejected` | `POST /submit` **ditolak** ("tidak dapat diajukan"), tetapi `PUT` dengan `action=submit` **berhasil** (`rejected -> pending`). Pengajuan ulang memang hanya lewat Edit, konsisten dengan `can_submit:false` di UI | LULUS | -- |
| `F-C01` | FE+BE | **Baris basi**: hapus ditolak tetapi UI melapor berhasil | Tab A memuat daftar (003 masih `draft`, ikon hapus tampil) -> tab B mengajukan 003 -> tab A menekan ikon hapus -> konfirmasi | Server **benar** menolak (baris tetap ada, status `pending`), tetapi pengguna melihat **dua toast sekaligus**: hijau "Permintaan dana berhasil dihapus" **dan** merah "Permintaan dana tidak dapat dihapus" | **GAGAL** | [1-tabA-draft](../bukti/operasional/F-C01-1-tabA-draft.png)<br>[2-konfirmasi-basi](../bukti/operasional/F-C01-2-konfirmasi-basi.png)<br>[3-hasil-basi](../bukti/operasional/F-C01-3-hasil-basi.png) |

### Pinjaman (Loans)

| ID | Lapisan | Kasus | Langkah / payload | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|---|
| `P-N01` | FE+BE | FM mencatat pinjaman baru -> dana masuk ke rekening | Form: Bank QC Sejahtera, pokok Rp 10.000.000, bunga 12% p.a., tenor 6 bulan, rekening Kas Utama | `status=active`; jatuh tempo **dihitung otomatis** 03 Mei 2027 dari mulai + tenor; `interest_rate=12.00` dan `interest_amount=NULL` (saling eksklusif, benar); BankTransaction **credit** Rp 10.000.000 kategori 7 (`FIN-LOAN-IN`); saldo 99.230.000 -> 109.230.000 | LULUS | [1-form-terisi](../bukti/operasional/P-N01-1-form-terisi.png)<br>[2-tersimpan](../bukti/operasional/P-N01-2-tersimpan.png) |
| `P-N02` | FE+BE | Bayar angsuran (pokok + bunga) | Dialog Catat Pembayaran: pokok Rp 4.000.000, bunga Rp 200.000 | `loan_payments` 1 baris; **dua** transaksi debit terpisah -- pokok kategori 8 (`FIN-LOAN-OUT`) dan bunga kategori 13 (`EXP-INTEREST`); status tetap `active` | LULUS | [1-dialog-terisi](../bukti/operasional/P-N02-1-dialog-terisi.png)<br>[2-sesudah-bayar](../bukti/operasional/P-N02-2-sesudah-bayar.png) |
| `P-N03` | FE+BE | Lunasi sisa -> `paid_off` | Pokok Rp 6.000.000 + bunga Rp 400.000 | `status=paid_off`; total pokok dibayar 10.000.000 = pokok pinjaman; 2 transaksi debit lagi | LULUS | [1-dialog-pelunasan](../bukti/operasional/P-N03-1-dialog-pelunasan.png)<br>[2-lunas](../bukti/operasional/P-N03-2-lunas.png) |
| `P-A01` | BE | Staff mengakses modul Pinjaman | `GET /loans` sebagai staff (tidak punya `view loans` sama sekali) | **403** "This action is unauthorized." | LULUS | -- |
| `P-A02` | BE | Bayar pokok melebihi sisa | Sisa Rp 6.000.000, kirim Rp 9.000.000 | Ditolak: "Pembayaran pokok melebihi sisa pokok (Rp 6.000.000)." -- **ada cap** | LULUS | -- |
| `P-A03` | FE+BE | **Hapus pinjaman yang dananya sudah masuk** (uji uang hantu) | Buat LOAN-00002 (credit Rp 5.000.000 masuk) -> `DELETE /loans/{id}` | Flash: "Pinjaman berhasil dihapus **beserta mutasi pencairannya**". Transaksi credit Rp 5.000.000 **ikut terhapus** -- tidak ada uang hantu; saldo kembali seperti sebelum pinjaman dicatat | LULUS | [1-dua-pinjaman](../bukti/operasional/P-A03-1-dua-pinjaman.png)<br>[2-sesudah-hapus](../bukti/operasional/P-A03-2-sesudah-hapus.png) |
| `P-A04` | BE | Nomor pinjaman duplikat | `loan_number: "LOAN-00001"` | 422 "Loan number sudah digunakan." | LULUS | -- |
| `P-A05` | BE | Jatuh tempo sebelum tanggal mulai | mulai 2026-11-03, jatuh tempo 2026-10-01 | 422 "Maturity date harus tanggal setelah tanggal mulai." | LULUS | -- |
| `P-A06` | BE | Bayar pinjaman yang sudah `paid_off` | `POST /loans/1/pay` | 403 "Pinjaman ini tidak dapat dibayar" | LULUS | -- |
| `P-A07` | BE | Pokok pinjaman negatif | `principal_amount: -5000` | 422 "Principal amount minimal 1." | LULUS | -- |

### Piutang (Receivables)

| ID | Lapisan | Kasus | Langkah / payload | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|---|
| `Pt-N01` | FE+BE | Buat piutang berdebitur **User** (pinjaman karyawan) | Form: karyawan QC Staff, pokok Rp 3.000.000, bunga 6%, 3 cicilan -> Simpan Draft | Berhasil -- **bug 500 `installment_months` yang masih didokumentasikan sebagai aktif sudah tidak terjadi**. `debtor_type=App\Models\User`, `debtor_id=3`; cicilan Rp 1.060.000 = (3.000.000+180.000)/3; jatuh tempo +3 bulan | LULUS | [1-form-terisi](../bukti/operasional/Pt-N01-1-form-terisi.png)<br>[2-hasil](../bukti/operasional/Pt-N01-2-hasil.png) |
| `Pt-N02` | FE+BE | Buat piutang berdebitur **Client** (pinjaman perusahaan) | Ganti tipe -> label berubah "Karyawan" menjadi "Perusahaan"; PT Debitur QC Sc, Rp 8.000.000, 10%, 4 cicilan | `debtor_type=App\Models\Client`, `debtor_id=1` -- relasi polimorfik bekerja untuk kedua jenis debitur | LULUS | [1-form-klien](../bukti/operasional/Pt-N02-1-form-klien.png)<br>[2-tersimpan](../bukti/operasional/Pt-N02-2-tersimpan.png) |
| `Pt-N03` | FE+BE | Ajukan piutang untuk persetujuan | Baris draft -> tombol ajukan -> konfirmasi | `draft -> pending_approval`, toast "Piutang berhasil diajukan untuk persetujuan" | LULUS | [2-diajukan](../bukti/operasional/Pt-N03-2-diajukan.png) |
| `Pt-N04` | FE+BE | Setujui & cairkan -> dana keluar | Dialog Proses Persetujuan: Setujui, rekening Kas Utama -> "Setujui & Cairkan" | `pending_approval -> active`, `approved_by=2`; BankTransaction **debit** Rp 3.000.000 kategori 11 (`FIN-RCV-OUT`) "Piutang diberikan: RCV-00001 - QC Staff" | LULUS | [1-dialog-persetujuan](../bukti/operasional/Pt-N04-1-dialog-persetujuan.png)<br>[2-dialog-terisi](../bukti/operasional/Pt-N04-2-dialog-terisi.png)<br>[3-aktif](../bukti/operasional/Pt-N04-3-aktif.png) |
| `Pt-N05` | FE+BE | Bayar lunas (transfer bank) -> `paid_off` | Pokok Rp 3.000.000 + bunga Rp 180.000, metode Transfer Bank | `status=paid_off`; **dua** transaksi credit -- pokok kategori 12 (`FIN-RCV-IN`) dan bunga kategori 14 (`REV-INTEREST`) | LULUS | [1-dialog-bayar](../bukti/operasional/Pt-N05-1-dialog-bayar.png)<br>[2-dialog-terisi](../bukti/operasional/Pt-N05-2-dialog-terisi.png)<br>[3-lunas](../bukti/operasional/Pt-N05-3-lunas.png) |
| `Pt-N06` | BE | Setujui piutang berdebitur Client | `POST /receivables/2/approve` sesudah submit | Berhasil, `status=active` -- alur yang sama berlaku untuk debitur Client | LULUS | -- |
| `Pt-N07` | FE+BE | Tolak piutang -- **tanpa efek samping bank** | Buat + ajukan RCV-00003 -> `POST .../approve {action:reject}` | `pending_approval -> rejected`. **Jumlah `bank_transactions` tidak bertambah** (tetap 13) -- penolakan tidak mencairkan apa pun | LULUS | [1-ditolak](../bukti/operasional/Pt-N07-1-ditolak.png) |
| `Pt-N08` | BE | Edit piutang yang ditolak -> kembali draft | `PUT /receivables/3` | `rejected -> draft`, `rejection_reason` dibersihkan -- siap diajukan ulang | LULUS | -- |
| `Pt-A01` | BE | Setujui piutang DRAFT | `POST /receivables/2/approve` saat masih `draft` | 403 "Piutang ini tidak dapat diproses" | LULUS | -- |
| `Pt-A02` | BE | Bayar piutang DRAFT (belum `active`) | `POST /receivables/2/pay` | 403 "Piutang ini tidak dapat dibayar" | LULUS | -- |
| `Pt-A03` | BE | Bayar piutang yang sudah `paid_off` | `POST /receivables/1/pay` | 403 "Piutang ini tidak dapat dibayar" | LULUS | -- |
| `Pt-A04` | BE | Ajukan piutang yang sudah `paid_off` | `POST /receivables/1/submit` | 403 "Piutang ini tidak dapat diajukan" | LULUS | -- |
| `Pt-A05` | BE | Setujui ulang piutang yang sudah `paid_off` | `POST /receivables/1/approve` | 403 "Piutang ini tidak dapat diproses" | LULUS | -- |
| `Pt-A06` | BE | Edit piutang yang sudah `paid_off` | `PUT /receivables/1` | 403 "Piutang ini tidak dapat diedit" | LULUS | -- |
| `Pt-A07` | BE | Hapus piutang yang sudah punya pembayaran | `DELETE /receivables/1` | 403 "Piutang ini tidak dapat dihapus" | LULUS | -- |
| `Pt-A08` | BE | Bayar pokok melebihi sisa | Sisa Rp 8.000.000, kirim Rp 9.000.000 | Ditolak: "Pembayaran pokok melebihi sisa pokok (Rp 8.000.000)." | LULUS | -- |
| `Pt-A09` | FE+BE | Staff melihat SELURUH piutang perusahaan | `GET /receivables` sebagai staff (hanya punya `view` + `create`) | Staff melihat **kedua** piutang termasuk piutang klien Rp 8.000.000 yang bukan urusannya. `canApprove:false`, `canPay:false` sehingga aksinya tetap terkunci. Daftar memang tidak disaring per pemilik -- berbeda dari reimbursement | TEMUAN | [1-staff-daftar](../bukti/operasional/Pt-A09-1-staff-daftar.png) |
| `Pt-A10` | BE | Staff menyetujui tanpa izin | `POST /receivables/2/approve` | 403 | LULUS | -- |
| `Pt-A11` | BE | Staff membayar tanpa izin | `POST /receivables/2/pay` | 403 | LULUS | -- |
| `Pt-A12` | BE | Staff mengedit tanpa izin | `PUT /receivables/2` | 403 | LULUS | -- |
| `Pt-A13` | BE | Staff menghapus tanpa izin | `DELETE /receivables/2` | 403 | LULUS | -- |
| `Pt-A14` | FE | **Dialog "Ajukan Piutang?" bertombol konfirmasi "Hapus"** | Baris draft -> tombol ajukan | Judul "Ajukan Piutang?", isi "Piutang RCV-00001 akan diajukan untuk persetujuan", tetapi tombol konfirmasinya bertuliskan **"Hapus"** -- `ConfirmDialog` dipanggil tanpa `confirmLabel` sehingga memakai teks default | **GAGAL** | [1-tombol-konfirmasi-hapus](../bukti/operasional/Pt-A14-1-tombol-konfirmasi-hapus.png) |

### Lintas perusahaan

| ID | Lapisan | Kasus | Langkah / payload | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|---|
| `X-A01` | BE | Akun perusahaan lain membuka `/c/qccsatu/reimbursements` | Akun `luar` (admin, anggota qccdua saja) | 403 "Anda tidak memiliki akses..." | LULUS | -- |
| `X-A02` | BE | Akun perusahaan lain membuka `/c/qccsatu/fund-requests` | idem | 403 | LULUS | -- |
| `X-A03` | BE | Akun perusahaan lain membuka `/c/qccsatu/loans` | idem | 403 | LULUS | -- |
| `X-A04` | BE | Akun perusahaan lain membuka `/c/qccsatu/receivables` | idem | 403 | LULUS | -- |
| `X-A05` | BE | Akun perusahaan lain membaca data reimbursement id 1/2/3 | `GET /c/qccsatu/reimbursements/{1,2,3}/data` | 403 untuk ketiganya | LULUS | -- |
| `X-A06` | FE+BE | Kontrol: data qccsatu tidak bocor ke qccdua | Props `/c/qccdua/{reimbursements,fund-requests,loans,receivables}` | `rows=0` di keempat modul -- pemisahan database per perusahaan utuh | LULUS | [1-qccdua-kosong](../bukti/operasional/X-A3-1-qccdua-kosong.png) |

---

## Temuan

### F-A13 — MEMBLOKIR: staff bisa membaca permintaan dana milik orang lain lewat `?tab=all`

**Kelas:** kebocoran data antar pengguna dalam satu perusahaan.

`FundRequestController::index()` mengambil cakupan apa adanya dari query string:

```php
// app/Http/Controllers/FundRequestController.php — index()
$tab = $request->input('tab', $canApprove ? 'all' : 'my');
// ...
if ($tab === 'my') {
    $query->where('user_id', auth()->id());
}
```

Tidak ada pemeriksaan izin atas nilai `tab` yang dikirim pengguna. Siapa pun yang punya
`view fund requests` — termasuk Staff, yang tidak punya `approve` maupun `disburse` —
cukup menambahkan `?tab=all` di URL untuk melihat **seluruh** permintaan dana perusahaan
beserta judul, tujuan, nominal, prioritas, dan nama pemohonnya.

Dibuktikan: Finance Manager membuat "QC-FR-FM rahasia" senilai Rp 777.000; akun staff
membuka `/fund-requests?tab=all` dan baris itu muncul di tabel
([bukti](../bukti/operasional/F-A13-1-staff-tab-all.png)).

**Modul reimbursement sudah benar dan bisa dicontoh langsung** — `ReimbursementController::index()`
memaksa `my` di server bila pengguna tidak boleh melihat semua (dibuktikan di R-A18: staff
yang memaksa `?tab=all` tetap mendapat `tab:"my"`, `canSeeAll:false`). Perbaikannya menyamakan
pola: tolak atau abaikan `tab=all` bila `! $canApprove && ! $canDisburse`.

Dampaknya masih di tingkat *baca*: `can_edit`, `can_delete`, dan `can_submit` tetap `false`
untuk baris milik orang lain, dan percobaan hapus lewat HTTP langsung memang ditolak (F-A15).
Jadi ini kebocoran kerahasiaan, bukan kebocoran kendali.

### F-C01 — toast "berhasil dihapus" muncul untuk penghapusan yang GAGAL

**Kelas:** UI melaporkan hasil yang berlawanan dengan yang terjadi di server.

Dua gaya penolakan dipakai di `FundRequestController::destroy()`:

| Kondisi | Cara menolak | Yang terjadi di Inertia |
|---|---|---|
| status `disbursed` | `redirect()->back()->withErrors([...])` | masuk `errors.delete` → `onError` |
| `canDelete()` false | `back()->with('error', ...)` | masuk `flash.error` → **redirect sukses** |

Cabang kedua adalah redirect yang *berhasil* bagi Inertia, sehingga `onSuccess` di
`resources/js/pages/fund-requests/index.tsx:198` tetap berjalan dan menampilkan
`toast.success('Permintaan dana berhasil dihapus')`, sementara `app-layout.tsx:42`
menampilkan `flash.error` yang asli. Pengguna melihat **dua toast bertentangan sekaligus**
padahal barisnya masih ada ([bukti](../bukti/operasional/F-C01-3-hasil-basi.png)).

Jalur yang dilalui pengguna sungguhan adalah baris basi: tab A memuat daftar saat pengajuan
masih `draft` sehingga ikon hapus dirender; tab B (atau rekan kerja) mengajukannya; tab A
menekan ikon hapus. Server menolak dengan benar, UI mengaku berhasil.

Cabang pertama punya masalah cermin: pesan spesifik yang susah payah ditulis
("…karena pencairannya sudah tercatat sebagai pengeluaran bank") tidak pernah sampai ke
layar, karena `onError` membuang isinya dan menampilkan "Gagal menghapus" generik. Saat ini
belum terlihat pengguna karena tombol hapus memang tidak dirender untuk baris `disbursed`
(F-A16) — tetapi pesannya tetap tidak berguna selama handler-nya begitu.

Saran: samakan ke satu gaya. Bila memakai `with('error')`, `onSuccess` harus memeriksa
`page.props.flash.error` sebelum mengaku berhasil; bila memakai `withErrors`, tampilkan isi
errornya, bukan teks generik.

### Pt-A14 — tombol konfirmasi "Ajukan Piutang?" bertuliskan "Hapus"

Dialog bertajuk **"Ajukan Piutang?"** dengan isi "Piutang RCV-00001 akan diajukan untuk
persetujuan", tetapi tombol konfirmasinya bertuliskan **"Hapus"**
([bukti](../bukti/operasional/Pt-A14-1-tombol-konfirmasi-hapus.png)). Penyebabnya
`ConfirmDialog` dipanggil tanpa prop `confirmLabel` sehingga memakai teks default. Pengguna
yang membaca tombolnya — bukan judulnya — akan menyangka datanya akan dihapus lalu
membatalkan pengajuan yang sebenarnya aman. Perbaikannya satu prop: `confirmLabel="Ajukan"`.

### R-C02 — dialog "Ajukan pengajuan ini?" bergaya destruktif (kosmetik)

Kelas yang sama dengan Pt-A14 tetapi lebih ringan: label tombolnya sudah benar ("Ajukan"),
yang keliru ikonnya (**tong sampah**) dan warnanya (**merah, varian bahaya**) untuk aksi yang
cuma mengirim pengajuan ke antrean review
([bukti](../bukti/operasional/R-C02-1-dialog-ajukan-bergaya-destruktif.png)).

### Pt-A09 — daftar piutang tidak disaring per pemilik (observasi, bukan vonis)

Staff yang hanya punya `view receivables` + `create receivables` melihat **seluruh** piutang
perusahaan, termasuk piutang klien Rp 8.000.000 yang tidak ada hubungannya dengan dirinya
([bukti](../bukti/operasional/Pt-A09-1-staff-daftar.png)). Aksinya tetap terkunci
(`canApprove:false`, `canPay:false`, dan Pt-A10 sampai Pt-A13 semuanya 403), jadi ini murni
soal kerahasiaan.

Berbeda dari F-A13: di sini tidak ada mekanisme cakupan yang dilanggar — modul piutang memang
tidak pernah punya konsep "punya saya". Apakah ini cacat bergantung pada kebijakan, karena
piutang karyawan memuat data yang biasanya tidak dibagikan antar karyawan. Diserahkan ke
coordinator, tidak diperlakukan sebagai bug.

### Konsistensi pesan validasi (kosmetik, lintas modul)

Reimbursement memberi pesan Indonesia penuh: *"Nominal minimal Rp 1."*, *"Jumlah pembayaran
melebihi sisa reimbursement (Rp 250.000)."*, *"Tanggal pembayaran tidak boleh setelah hari ini."*

Tiga modul lain memakai nama atribut mentah berbahasa Inggris, dan kadang kata Inggris di
tengah kalimat Indonesia:

| Modul | Pesan apa adanya |
|---|---|
| Fund Request | "Needed by date harus tanggal yang sama atau setelah **today**." |
| Fund Request | "**Items.0.quantity** minimal 1." |
| Fund Request | "**Request number** sudah digunakan." |
| Fund Request | "Disbursement date harus tanggal yang sama atau sebelum **today**." |
| Pinjaman | "**Loan number** sudah digunakan." |
| Pinjaman | "**Maturity date** harus tanggal setelah tanggal mulai." |
| Pinjaman | "**Principal amount** minimal 1." |

Perbaikannya menambahkan `attributes()` (atau `messages()`) di form request terkait, seperti
yang sudah dilakukan reimbursement.

---

## Premis spec & dokumentasi modul yang ternyata sudah tidak berlaku

Delapan hal diuji karena spec atau dokumen modul menyebutnya sebagai masalah aktif, dan
semuanya **sudah diperbaiki di kode**. Dokumen modulnya yang belum menyusul — ini melanggar
aturan pemeliharaan di `CLAUDE.md` ("perubahan yang mengubah perilaku modul WAJIB memperbarui
dokumen modulnya di commit yang sama") dan membuat penguji berikutnya memburu hantu.

| Klaim | Sumber | Keadaan sebenarnya | Kasus |
|---|---|---|---|
| Nomor fund request pakai `count()`; hapus satu → nomor kembar | spec C butir 5 + `docs/module/fund-requests.md` ("Nomor berbasis COUNT, bukan MAX") | Sudah `max()` + loop anti-tabrakan di `FundRequest::generateRequestNumber()` | F-A01 |
| `destroy()` fund request tidak memeriksa pemilik | `docs/module/fund-requests.md` | `canDelete()` memeriksa `user_id` secara eksplisit, lengkap dengan komentar alasannya | F-A15 |
| Admin bisa hapus fund request `disbursed` → pengeluaran yatim | `docs/module/fund-requests.md` | `destroy()` menolak status `disbursed` lebih dulu | F-A17 |
| Ajukan ulang sesudah `rejected` gagal diam-diam dengan flash sukses | `docs/module/fund-requests.md` | `PUT` dengan `action=submit` benar-benar memindahkan `rejected → pending` | F-A18 |
| Pembayaran pinjaman tanpa cap; pokok boleh melebihi sisa | `docs/module/loans.md` | Ditolak: "Pembayaran pokok melebihi sisa pokok (Rp 6.000.000)." | P-A02 |
| Hapus/edit pinjaman tidak mengoreksi `BankTransaction` | `docs/module/loans.md` | Hapus pinjaman **ikut menghapus mutasi pencairannya** | P-A03 |
| **[BUG AKTIF]** Simpan Draft piutang gagal 500 (`installment_months` string) | `docs/module/receivables.md` | Simpan Draft lewat UI berhasil; `installment_months=3` tersimpan benar | Pt-N01 |
| Piutang tanpa cap pembayaran | `docs/module/receivables.md` | Ditolak: "Pembayaran pokok melebihi sisa pokok (Rp 8.000.000)." | Pt-A08 |

Yang **masih berlaku** dari dokumen: kebocoran `?tab=all` fund request (F-A13), label tombol
"Hapus" di dialog Ajukan Piutang (Pt-A14), dan daftar piutang yang tidak disaring per pemilik
(Pt-A09).

Catatan tambahan untuk spec butir 3 ("hapus pinjaman yang sudah dicairkan → pencairannya harus
ikut dibalik"): dua modul menjawabnya dengan cara berbeda, dan keduanya menutup celah uang
hantu. Pinjaman **membalik** mutasinya saat dihapus (P-A03); permintaan dana **menolak**
penghapusannya (F-A17). Tidak ada sisa pengeluaran yatim pada keduanya.

---

## Kegagalan perkakas penguji (bukan cacat aplikasi)

Dicatat terpisah supaya tidak terbaca sebagai temuan:

1. **ffmpeg bawaan Playwright tidak punya dekoder PNG** — pemerkecil tangkapan layar awal
   gagal dengan "Invalid data found when processing input". Diganti dengan canvas di dalam
   browser.
2. **Salah header CSRF** — 10 permintaan pertama dibalas 419 "CSRF token mismatch" karena
   token polos dikirim lewat `X-XSRF-TOKEN`; diperbaiki ke `X-CSRF-TOKEN` berisi
   `meta[name=csrf-token]`. Semua kasus terdampak dijalankan ulang.
3. **`fetch(..., {redirect:'follow'})` pada DELETE/PUT** mengulang metode yang sama ke URL
   tujuan redirect dan menghasilkan **405 palsu** (F-A17 dan F-A18 sempat terbaca begitu).
   Diperbaiki ke `redirect:'manual'` dengan flash dibaca dari permintaan GET terpisah; kedua
   kasus dijalankan ulang dan mendapat status yang benar.
4. **Locator `button` tanpa scope** menembus sheet yang sedang terbuka dan mengenai tombol di
   tabel belakangnya ("subtree intercepts pointer events"); diperbaiki dengan menyaring ke
   `[role=dialog]`.
5. **Tombol hapus permintaan dana hanya ikon** (`Trash2`, tanpa teks), sehingga pencarian
   berdasarkan teks "Hapus" mengembalikan 0 — sempat terbaca seolah tombolnya tidak ada.
6. **Props Inertia ada di `<script data-page="app">`**, bukan di atribut `data-page` seperti
   dugaan awal; pembaca props sempat mengembalikan `rows: []` kosong untuk semua halaman.

Tidak ada kegagalan lingkungan: server port 8013 menyala sepanjang pengujian, tidak ada
`public/hot`, dan `npm run build` tidak pernah dijalankan.

---

## Yang TIDAK diuji

- **Export PDF rekap permintaan dana** (`/fund-requests/export/pdf` dan `/preview`) — endpoint
  ada tetapi `index.tsx` belum merender tombolnya sehingga tidak ada jalur UI; tidak sempat
  diuji lewat URL langsung.
- **Pembayaran piutang metode `cash` / `payroll_deduction`** — hanya `bank_transfer` yang
  diuji. Menurut `docs/module/receivables.md` kedua metode itu tidak membuat `BankTransaction`
  sehingga pendapatan bunganya tidak pernah masuk Laba Rugi; klaim itu **belum diverifikasi**.
- **Lampiran kontrak** pada pinjaman dan piutang — hanya lampiran reimbursement yang diuji
  penuh (termasuk akses lintas perusahaan).
- **Lampiran bukti bayar pencairan fund request** (`transaction-attachments/`, satu berkas
  fisik dibagi ke banyak transaksi) — pencairan diuji tanpa lampiran.
- **Catatan pencairan berawalan `TRF`** — menurut dokumen, referensi `TRF*` diperlakukan
  sebagai pasangan transfer sehingga menghapus satu transaksi ikut menghapus semua transaksi
  berreferensi sama, termasuk item lain dari pencairan yang sama. Tidak diuji; bersinggungan
  dengan modul Bank/Arus Kas (Penguji B).
- **Tabrakan nomor pada pengajuan serentak** (race pada `generateRequestNumber`) — perlu dua
  permintaan yang betul-betul bersamaan.
- **Pembayaran cicilan piutang bertahap** — hanya pelunasan sekali bayar yang diuji.
- **Badge sidebar** (`getActionCounts`) untuk reimbursement dan fund request — tidak dihitung
  ulang terhadap jumlah pending/approved.
