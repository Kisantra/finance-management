# Test Case — Reimbursement

Sumber teknis: [`docs/module/reimbursements.md`](../../module/reimbursements.md).
Cara baca tabel & kolom **Lapisan**: lihat [`../README.md`](../README.md).

**Ingat**: jalankan di database `finance_management_qc` (server lokal `127.0.0.1:8001`), bukan
database `finance_management`. Akun (password `password`):

| Akun | Peran | Izin reimbursement |
|---|---|---|
| `staff@qc.test` | staff | lihat, buat, edit, hapus (milik sendiri) |
| `fm@qc.test` | finance manager | lihat, buat, edit, setujui/tolak, bayar |
| `admin@gmail.com` | admin | semua izin + boleh menghapus status apa pun |

Data awal: database QC tanpa reimbursement sama sekali, 3 rekening bank, 18 kategori transaksi
pengeluaran. Lampiran uji: `struk-taksi.jpg` (gambar ±40 KB), `kuitansi-hotel.pdf`, `catatan.txt`
(tipe terlarang), `besar.pdf` (6 MB, melebihi batas 5 MB). Hari uji: 8 Oktober 2026.

Fokus: alur penuh pemohon → reviewer → pembayar, aturan nominal & lampiran, pembayaran cicilan dan
efeknya ke rekening/arus kas, serta **siapa yang menegakkan aturan** (UI vs server) untuk akses
lintas pengguna.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Buat & langsung ajukan, dengan lampiran | Staff: **Buat Reimbursement**, judul "Taksi meeting klien PT Sanjaya", nominal Rp 185.000, tanggal hari ini − 2, kategori Transport, lampiran `struk-taksi.jpg`, klik **Ajukan** | Sheet tertutup, baris baru berstatus menunggu review; DB `status=pending`, file tersimpan di `storage/app/public/reimbursements` | FE+BE | Percobaan 1 berhenti karena selector tombol tanggal salah (alat uji). DB: status pending, expense_date 6 Okt, file jpg ada di disk public. | Pass |
| N02 | Simpan draft lalu ajukan dari daftar | Staff: buat "Makan siang tim proyek" Rp 420.000, Meals, tanpa lampiran, **Simpan Draft**; lalu tombol **Ajukan** di baris → konfirmasi | Setelah simpan: status Draft. Setelah konfirmasi: status menunggu review (`pending`) | FE+BE | DB: status pending setelah konfirmasi. | Pass |
| N03 | Edit draft | Staff: buat draft "ATK kantor" Rp 150.000; edit nominal → Rp 175.000, tambah lampiran `kuitansi-hotel.pdf`, **Simpan Draft** | Nominal Rp 175.000 dan ikon lampiran tampil; DB `amount=175000`, `attachment_name=kuitansi-hotel.pdf` | FE+BE | DB: amount 175000, attachment_name kuitansi-hotel.pdf. | Pass |
| N04 | Hapus draft beserta lampirannya | Staff: hapus draft "ATK kantor" (N03) → konfirmasi | Baris hilang; DB row terhapus **dan** file PDF-nya ikut terhapus dari disk | FE+BE | Percobaan 1: baris terhapus tetapi file PDF tertinggal di disk (BUG-01). Percobaan 2 (draft baru #7) setelah perbaikan: baris dan file terhapus. | Pass |
| N05 | Setujui dengan kategori resmi | FM: tab Semua → **Review** pada N01 → pilih kategori transaksi "OPERASIONAL", catatan "Sesuai struk", **Setujui** | Status disetujui; DB `status=approved`, `category_id` terisi, `reviewed_by`=FM, `review_notes` tersimpan | FE+BE | Percobaan 1 berhenti karena nama opsi kategori diawali "↳" (alat uji). DB: approved, category OPERASIONAL, reviewed_by fm@qc.test, catatan tersimpan. | Pass |
| N06 | Bayar sebagian (cicilan) | FM: **Bayar** pada N01, rekening pertama, tanggal hari ini, nominal Rp 100.000, catatan "TRF-001" | Status tetap disetujui dengan "sisa Rp 85.000"; DB `amount_paid=100000`, `payment_status=partial`; 1 `bank_transactions` debit Rp 100.000 berdeskripsi "Cicilan Reimbursement: …" berkategori sama | FE+BE | DB: amount_paid 100000, payment_status partial; tx#11 debit Rp 100.000 kategori OPERASIONAL "Cicilan Reimbursement: …". | Pass |
| N07 | Lunasi sisa | FM: **Bayar** lagi pada N01, nominal terisi otomatis Rp 85.000 | Status Lunas (`paid`), `amount_paid=185000`, 2 baris `reimbursement_payments`, transaksi kedua "Pelunasan Reimbursement: …"; tombol Bayar hilang | FE+BE | DB: status paid, amount_paid 185000, 2 baris reimbursement_payments; tx#12 "Pelunasan Reimbursement: …". | Pass |
| N08 | Filter, cari, rentang tanggal | FM tab Semua: filter status Lunas; lalu kategori Meals; lalu cari "taksi"; lalu rentang tanggal yang tidak memuat data | Tiap filter mempersempit daftar dengan benar; rentang kosong → state kosong; Reset mengembalikan semua | FE+BE | Percobaan 1: selector kolom Cari salah; percobaan 2: rentang tanggal ditutup dengan Escape padahal komponen menunggu tombol Terapkan (keduanya alat uji). | Pass |
| N09 | Detail & lampiran | Klik baris N01 | Dialog detail memuat pemohon, tanggal, kategori, nominal, sudah dibayar, peninjau + catatan, dan lampiran bisa dipratinjau | FE | Percobaan 1: isi lengkap tetapi console mencatat DOM tidak valid (BUG-02). Setelah perbaikan console bersih. | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Form kosong | Staff: buka form, langsung **Ajukan** | Tidak tersimpan; pesan per kolom (judul, nominal, kategori) dalam bahasa Indonesia | FE+BE | Percobaan 1: pesan berbahasa Inggris dan toast "Gagal menyimpan" (BUG-03). Server juga menolak form kosong (422). | Pass |
| A02 | Nominal 0 | Isi semua kecuali nominal Rp 0, **Simpan Draft** | Ditolak dengan pesan nominal minimal | FE+BE | Percobaan 1 memotret pesan lama karena menunggu dengan timer (alat uji). Server: 422 untuk amount 0. | Pass |
| A03 | Lampiran salah tipe / terlalu besar | Pilih `catatan.txt`, lalu `besar.pdf` (6 MB); juga kirim langsung ke server | UI menolak keduanya; server juga menolak (mimes, max 5 MB) | FE+BE | UI menolak keduanya; server: `catatan.txt` 422 (mimes), file 6 MB 422. Lihat CATATAN-1 tentang batas upload PHP 2 MB. | Pass |
| A04 | Setujui tanpa kategori | FM: dialog Setujui tanpa memilih kategori; lalu POST langsung `action=approve` tanpa `category_id` | Tombol Setujui nonaktif; server menjawab error validasi kategori, status tetap `pending` | FE+BE | API langsung tanpa category_id → 422; status N02 tetap pending. | Pass |
| A05 | Bayar melebihi sisa | FM: pada pengajuan disetujui Rp 420.000, isi nominal Rp 500.000 | Ditolak (UI dan server) dengan pesan sisa tagihan; tidak ada transaksi bank tercatat | FE+BE | Percobaan 1: Rp 500.000 untuk pengajuan Rp 420.000 diterima, BCA terpotong Rp 500.000 (BUG-04). Percobaan 2 (pengajuan #8 Rp 300.000): UI dan server menolak, tidak ada pembayaran tercatat. | Pass |
| A06 | Tanggal bayar di masa depan | FM: kirim langsung `payment_date` = besok | Server menolak (`before_or_equal:today`); UI tidak bisa memilih tanggal besok | FE+BE | API dengan payment_date besok → 422. | Pass |
| A07 | Staff membuka tab "Semua" lewat URL | Staff: buka `/reimbursements?tab=all` | Hanya pengajuan milik sendiri yang tampil (tab Semua hanya untuk reviewer) | BE | Percobaan 1 tidak konklusif: belum ada data milik pengguna lain karena fixture FM gagal dibuat (memicu BUG-05). Percobaan 2: kebocoran terbukti (BUG-06). Percobaan 3 setelah perbaikan: hanya milik sendiri. | Pass |
| A08 | Staff menghapus draft milik orang lain | FM membuat draft; staff mengirim `DELETE /reimbursements/{id}` langsung | Ditolak 403 / pesan error; row FM tetap ada | BE | Diverifikasi di level API + database (tidak ada alur layar karena tombol hapus memang tidak tampil untuk milik orang lain). Percobaan 1: DELETE /reimbursements/5 menghapus draft FM (BUG-07). Percobaan 2: DELETE /reimbursements/9 ditolak dengan flash "Reimbursement tidak dapat dihapus", row tetap ada. | Pass |
| A09 | Staff memanggil review / bayar | Staff: POST langsung ke `/review` dan `/pay` | 403; status tidak berubah | BE | Diverifikasi di level API: POST /review dan /pay sebagai staff → 403; status N02 tidak berubah. | Pass |
| A10 | Edit pengajuan yang sudah diajukan | Staff: buka `/reimbursements/{id}/edit` untuk N02 (pending), dan PUT langsung | Ditolak dengan pesan "tidak dapat diedit"; data tidak berubah | FE+BE | PUT langsung → redirect back, data tidak berubah. | Pass |
| A11 | Buat tanpa kolom deskripsi (API) | FM: POST `/reimbursements` tanpa kolom `description` sama sekali (judul, nominal Rp 65.000, kategori Other, draft) | Tersimpan sebagai draft dengan deskripsi kosong; tidak ada error server | BE | Diverifikasi di level API + database. Percobaan 1 (fixture FM): 500 "Undefined array key description" (BUG-05). Percobaan 2: 302 ke daftar, row #9 tersimpan dengan description null. | Pass |

## C. Alur Berantai (lintas aktor / modul)

Aksi pemohon dilakukan sebagai `staff@qc.test`, aksi reviewer/pembayar sebagai `fm@qc.test`, dan
penghapusan oleh admin sebagai `admin@gmail.com`. Yang diperiksa: perilaku di sisi aktor
berikutnya setelah tiap transisi, dan efek di modul lain.

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Ditolak → diperbaiki → diajukan ulang | FM menolak N02 dengan catatan "Lampirkan struk"; staff melihat status & catatan, edit (tambah lampiran) lalu **Ajukan** | Staff melihat Ditolak + catatan; setelah ajukan ulang status kembali menunggu review dan muncul lagi di antrean FM | FE+BE | Percobaan 1: pengajuan ulang gagal diam-diam (BUG-08). Percobaan 2: tombol Ajukan tersedia untuk status Ditolak, status kembali pending, data review lama dikosongkan, muncul lagi di antrean FM. | Pass |
| C02 | Pembayaran memotong saldo & masuk arus kas | Setelah N06–N07: cek saldo rekening & daftar Arus Kas → Pengeluaran | Saldo rekening turun Rp 185.000; dua transaksi debit tampil dengan kategori OPERASIONAL | FE+BE | Percobaan 1 tertahan karena server artisan serve sempat tidak merespons dan selector halaman rekening menunggu elemen tersembunyi (alat uji/lingkungan). DB: saldo BCA 64.802.500 → 64.617.500 (−185.000). | Pass |
| C03 | Badge antrean di sidebar | FM: catat badge Operasional; staff mengajukan 1; FM refresh; FM setujui | Badge bertambah setelah diajukan, tetap (pindah antrean bayar) setelah disetujui, berkurang setelah lunas | FE+BE | Badge FM: 0 → 1 setelah staff mengajukan → tetap 1 setelah disetujui (pindah ke antrean bayar) → 0 setelah lunas. | Pass |
| C04 | Admin menghapus pengajuan yang sudah dibayar | Admin: hapus N01 (Lunas) | Ditolak — pengajuan dengan pembayaran tidak boleh hilang sementara transaksi banknya tetap memotong saldo | FE+BE | Percobaan 1: terhapus, transaksi bank tx#11 & tx#12 tertinggal dan tetap memotong saldo (BUG-09). Percobaan 2: tombol hapus tidak tampil untuk baris yang sudah dibayar; DELETE langsung ditolak, data #6 dan pembayarannya tetap ada. | Pass |

<!-- qa-evidence:start -->

# Bukti visual langkah per langkah

Screenshot diambil per langkah, bukan hanya hasil akhirnya, supaya alurnya
bisa ditelusuri ulang oleh orang lain. Test case yang kondisinya tidak bisa
dicapai dari layar dijalankan lewat API/DB dan ditandai eksplisit — tidak
dibuatkan screenshot seolah-olah ada alur UI-nya.


## N01 · Buat & langsung ajukan, dengan lampiran — Pass (percobaan ke-2)

**1.** Staff membuka `/reimbursements` di database QC yang masih kosong: kartu statistik 0 dan state kosong "Belum ada reimbursement".

<img src="../evidence/reimbursements/N01-1.png" width="100%">

**2.** Form **Buat Pengajuan** terisi: judul "Taksi meeting klien PT Sanjaya", Rp 185.000, tanggal 06 Okt 2026, kategori Transport, lampiran `struk-taksi.jpg`.

<img src="../evidence/reimbursements/N01-2.png" width="100%">

**3.** Setelah **Ajukan**: sheet tertutup, baris baru berstatus **Pending Review** dengan ikon lampiran; toast "Reimbursement berhasil dibuat".

<img src="../evidence/reimbursements/N01-3.png" width="100%">


## N02 · Simpan draft lalu ajukan dari daftar — Pass

**1.** Form terisi "Makan siang tim proyek" Rp 420.000, kategori Meals & Entertainment, tanpa lampiran.

<img src="../evidence/reimbursements/N02-1.png" width="100%">

**2.** Setelah **Simpan Draft**: baris berstatus **Draft** dengan tombol **Ajukan** di kolom aksi.

<img src="../evidence/reimbursements/N02-2.png" width="100%">

**3.** Klik **Ajukan** di baris: dialog konfirmasi "Ajukan reimbursement ini?". (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/N02-3.png" width="100%">

**4.** Setelah konfirmasi: status berubah menjadi **Pending Review** dan tombol Ajukan hilang.

<img src="../evidence/reimbursements/N02-4.png" width="100%">


## N03 · Edit draft — Pass

**1.** Draft baru "ATK kantor" Rp 150.000 di daftar.

<img src="../evidence/reimbursements/N03-1.png" width="100%">

**2.** Sheet **Edit Reimbursement**: nominal diubah menjadi Rp 175.000 dan lampiran `kuitansi-hotel.pdf` ditambahkan.

<img src="../evidence/reimbursements/N03-2.png" width="100%">

**3.** Setelah **Simpan Draft**: baris menampilkan Rp 175.000 dan ikon lampiran.

<img src="../evidence/reimbursements/N03-3.png" width="100%">


## N04 · Hapus draft beserta lampirannya — Pass (percobaan ke-2)

**1.** Percobaan 1 — konfirmasi "Hapus reimbursement ini?" untuk draft "ATK kantor". (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/N04-1.png" width="100%">

**2.** Percobaan 1 — baris hilang dari daftar, namun pengecekan disk: `kuitansi-hotel.pdf` masih ada di `storage/app/public/reimbursements/` (BUG-01).

<img src="../evidence/reimbursements/N04-2.png" width="100%">

**3.** Percobaan 2 setelah perbaikan — konfirmasi hapus untuk draft "ATK kantor (uji ulang)" yang berlampiran PDF. (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/N04-3.png" width="100%">

**4.** Percobaan 2 — baris hilang; pengecekan database dan disk: row #7 dan file PDF-nya sama-sama terhapus.

<img src="../evidence/reimbursements/N04-4.png" width="100%">


## N05 · Setujui dengan kategori resmi — Pass (percobaan ke-2)

**1.** Finance manager di tab **Semua Pengajuan**: dua pengajuan Pending Review milik Staf Uji; badge sidebar Reimbursement 2.

<img src="../evidence/reimbursements/N05-1.png" width="100%">

**2.** Dialog **Setujui Reimbursement**: tombol Setujui baru aktif setelah kategori **OPERASIONAL** dipilih; catatan "Sesuai struk taksi.".

<img src="../evidence/reimbursements/N05-2.png" width="100%">

**3.** Setelah disetujui: status **Approved** dan muncul tombol **Bayar**.

<img src="../evidence/reimbursements/N05-3.png" width="100%">


## N06 · Bayar sebagian (cicilan) — Pass

**1.** Dialog **Proses Pembayaran**: sisa Rp 185.000, rekening BCA - Operasional (saldo Rp 64.802.500), nominal Rp 100.000, catatan TRF-001.

<img src="../evidence/reimbursements/N06-1.png" width="100%">

**2.** Setelah diproses: status tetap Approved dengan keterangan **sisa Rp 85.000**.

<img src="../evidence/reimbursements/N06-2.png" width="100%">


## N07 · Lunasi sisa — Pass

**1.** Dialog bayar kedua: nominal otomatis terisi sisa **Rp 85.000**.

<img src="../evidence/reimbursements/N07-1.png" width="100%">

**2.** Setelah diproses: status **Paid** dan tombol Bayar hilang.

<img src="../evidence/reimbursements/N07-2.png" width="100%">


## N08 · Filter, cari, rentang tanggal — Pass (percobaan ke-3)

**1.** Filter status **Paid**: hanya "Taksi meeting klien PT Sanjaya".

<img src="../evidence/reimbursements/N08-1.png" width="100%">

**2.** Filter kategori **Meals & Entertainment**: hanya "Makan siang tim proyek".

<img src="../evidence/reimbursements/N08-2.png" width="100%">

**3.** Cari "taksi": hanya satu baris yang cocok.

<img src="../evidence/reimbursements/N08-3.png" width="100%">

**4.** Rentang 1–3 Okt 2026 (URL `date_from=2026-10-01&date_to=2026-10-03`): tidak ada data, tampil state kosong.

<img src="../evidence/reimbursements/N08-4.png" width="100%">

**5.** **Reset**: kedua pengajuan tampil kembali.

<img src="../evidence/reimbursements/N08-5.png" width="100%">


## N09 · Detail & lampiran — Pass (percobaan ke-2)

**1.** Percobaan 1 — dialog detail: pemohon, tanggal, kategori, status Paid, Rp 185.000, sudah dibayar Rp 185.000, peninjau Fina Manager + catatan, deskripsi, tautan lampiran.

<img src="../evidence/reimbursements/N09-1.png" width="100%">

**2.** Pratinjau lampiran `struk-taksi.jpg` terbuka (gambar 600 px termuat).

<img src="../evidence/reimbursements/N09-2.png" width="100%">

**3.** Setelah perbaikan BUG-02 — dialog detail "Makan siang tim proyek" dibuka ulang; console tanpa error.

<img src="../evidence/reimbursements/N09-3.png" width="100%">


## A01 · Form kosong — Pass (percobaan ke-2)

**1.** Percobaan 1 — Ajukan form kosong: "The title field is required.", "The amount field must be at least 1.", "The category field is required."; toast generik "Gagal menyimpan".

<img src="../evidence/reimbursements/A01-1.png" width="100%">

**2.** Setelah perbaikan — "Judul wajib diisi.", "Nominal minimal Rp 1.", "Kategori wajib diisi."; toast merinci ketiga pesan dari server.

<img src="../evidence/reimbursements/A01-2.png" width="100%">


## A02 · Nominal 0 — Pass (percobaan ke-2)

**1.** Judul dan kategori terisi, nominal Rp 0 → **Simpan Draft** ditolak dengan pesan nominal minimal (teks masih berbahasa Inggris sebelum perbaikan BUG-03).

<img src="../evidence/reimbursements/A02-1.png" width="100%">


## A03 · Lampiran salah tipe / terlalu besar — Pass

**1.** Memilih `catatan.txt`: "Format file tidak didukung." dan file tidak diterima.

<img src="../evidence/reimbursements/A03-1.png" width="100%">

**2.** Memilih `besar.pdf` (6 MB): "Ukuran file melebihi batas 5MB.".

<img src="../evidence/reimbursements/A03-2.png" width="100%">


## A04 · Setujui tanpa kategori — Pass

**1.** Dialog Setujui tanpa kategori: tombol **Setujui** nonaktif. (Direkam ulang 8 Okt setelah animasi dialog selesai; rekaman pertama tertangkap saat dialog masih muncul. Perilakunya tidak berubah oleh perbaikan.)

<img src="../evidence/reimbursements/A04-1.png" width="100%">


## A05 · Bayar melebihi sisa — Pass (percobaan ke-2)

**1.** Percobaan 1 — dialog bayar "Hotel dinas Surabaya" (sisa Rp 420.000) diisi Rp 500.000; tombol tetap aktif.

<img src="../evidence/reimbursements/A05-1.png" width="100%">

**2.** Percobaan 1 — detail "Hotel dinas Surabaya" hasil pembayaran tadi: Jumlah Rp 420.000, **Sudah Dibayar Rp 500.000**, status Paid (BUG-04). (Direkam ulang setelah animasi dialog selesai; data yang tampil adalah sisa percobaan 1 yang masih ada di database QC.)

<img src="../evidence/reimbursements/A05-2.png" width="100%">

**3.** Setelah perbaikan — "Tiket kereta Bandung" (sisa Rp 300.000) diisi Rp 350.000: pesan "Melebihi sisa Rp 300.000.", tombol bayar nonaktif; server juga menjawab 422 "Jumlah pembayaran melebihi sisa reimbursement (Rp 300.000)."

<img src="../evidence/reimbursements/A05-3.png" width="100%">


## A06 · Tanggal bayar di masa depan — Pass

**1.** Kalender tanggal pembayaran: tanggal 9 Okt (besok) nonaktif.

<img src="../evidence/reimbursements/A06-1.png" width="100%">


## A07 · Staff membuka tab "Semua" lewat URL — Pass (percobaan ke-3)

**1.** Percobaan 2 — staff di `/reimbursements?tab=all` melihat kolom Pemohon dan draft **"Kurir dokumen kontrak (FM)" milik Fina Manager**; statistik Total 4 (semua pengguna).

<img src="../evidence/reimbursements/A07-1.png" width="100%">

**2.** Setelah perbaikan — URL yang sama hanya menampilkan pengajuan milik Staf Uji; draft FM (#9) tidak terlihat.

<img src="../evidence/reimbursements/A07-2.png" width="100%">


## A08 · Staff menghapus draft milik orang lain — Pass (percobaan ke-2)

_Tanpa langkah UI — Diverifikasi di level API + database (tidak ada alur layar karena tombol hapus memang tidak tampil untuk milik orang lain). Percobaan 1: DELETE /reimbursements/5 menghapus draft FM (BUG-07). Percobaan 2: DELETE /reimbursements/9 ditolak dengan flash "Reimbursement tidak dapat dihapus", row tetap ada._


## A09 · Staff memanggil review / bayar — Pass

_Tanpa langkah UI — Diverifikasi di level API: POST /review dan /pay sebagai staff → 403; status N02 tidak berubah._


## A10 · Edit pengajuan yang sudah diajukan — Pass

**1.** Staff membuka `/reimbursements/2/edit` (Pending): dialihkan ke daftar dengan toast "Reimbursement tidak dapat diedit".

<img src="../evidence/reimbursements/A10-1.png" width="100%">


## A11 · Buat tanpa kolom deskripsi (API) — Pass (percobaan ke-2)

_Tanpa langkah UI — Diverifikasi di level API + database. Percobaan 1 (fixture FM): 500 "Undefined array key description" (BUG-05). Percobaan 2: 302 ke daftar, row #9 tersimpan dengan description null._


## C01 · Ditolak → diperbaiki → diajukan ulang — Pass (percobaan ke-2)

**1.** FM menolak "Makan siang tim proyek" dengan catatan "Lampirkan struk/nota restoran.".

<img src="../evidence/reimbursements/C01-1.png" width="100%">

**2.** Status di sisi FM menjadi **Rejected**.

<img src="../evidence/reimbursements/C01-2.png" width="100%">

**3.** Staff membuka detail: status Rejected dan catatan penolakan terlihat; satu-satunya aksi adalah **Edit**. (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/C01-3.png" width="100%">

**4.** Staff menambahkan lampiran `struk-taksi.jpg` di sheet edit lalu klik **Ajukan**.

<img src="../evidence/reimbursements/C01-4.png" width="100%">

**5.** Percobaan 1 — toast "Reimbursement berhasil diperbarui", tetapi status **tetap Rejected** (DB: rejected) dan tidak ada cara lain untuk mengajukan (BUG-08).

<img src="../evidence/reimbursements/C01-5.png" width="100%">

**6.** Setelah perbaikan — baris Rejected kini memiliki tombol **Ajukan**.

<img src="../evidence/reimbursements/C01-6.png" width="100%">

**7.** Setelah konfirmasi: status **Pending Review**; toast "Reimbursement berhasil diajukan".

<img src="../evidence/reimbursements/C01-7.png" width="100%">

**8.** Di sisi FM pengajuan muncul lagi sebagai Pending Review dengan tombol **Review**.

<img src="../evidence/reimbursements/C01-8.png" width="100%">


## C02 · Pembayaran memotong saldo & masuk arus kas — Pass (percobaan ke-2)

**1.** Arus Kas → Pengeluaran: "Cicilan Reimbursement …" −Rp 100.000 (TRF-001) dan "Pelunasan Reimbursement …" −Rp 85.000 (TRF-002), kategori OPERASIONAL, rekening BCA - Operasional.

<img src="../evidence/reimbursements/C02-1.png" width="100%">

**2.** Halaman rekening bank setelah pembayaran: BCA - Operasional Rp 64.617.500.

<img src="../evidence/reimbursements/C02-2.png" width="100%">


## C03 · Badge antrean di sidebar — Pass

**1.** Awal: badge Reimbursement di sidebar FM kosong (0).

<img src="../evidence/reimbursements/C03-1.png" width="100%">

**2.** Staff mengajukan "Parkir gedung klien" Rp 25.000; setelah FM memuat ulang badge menjadi **1**.

<img src="../evidence/reimbursements/C03-2.png" width="100%">

**3.** FM menyetujui: badge tetap **1** (sekarang antrean bayar).

<img src="../evidence/reimbursements/C03-3.png" width="100%">

**4.** FM membayar lunas: badge kembali kosong.

<img src="../evidence/reimbursements/C03-4.png" width="100%">


## C04 · Admin menghapus pengajuan yang sudah dibayar — Pass (percobaan ke-2)

**1.** Percobaan 1 — admin: tombol hapus tampil pada baris Paid "Taksi meeting klien"; konfirmasi hapus. (Dialog terekam saat animasi muncul belum selesai sehingga masih tembus pandang; isinya tetap terbaca. Keadaan ini tidak bisa direkam ulang karena datanya sudah berubah.)

<img src="../evidence/reimbursements/C04-1.png" width="100%">

**2.** Percobaan 1 — baris hilang; DB: pengajuan & pembayaran terhapus tetapi 2 transaksi bank (Rp 185.000) tetap ada (BUG-09).

<img src="../evidence/reimbursements/C04-2.png" width="100%">

**3.** Setelah perbaikan — baris Paid "Parkir gedung klien" tanpa tombol hapus (draft lain masih bisa dihapus admin).

<img src="../evidence/reimbursements/C04-3.png" width="100%">

**4.** DELETE langsung ke `/reimbursements/6` → toast "Reimbursement yang sudah memiliki pembayaran tidak dapat dihapus."; data tetap ada.

<img src="../evidence/reimbursements/C04-4.png" width="100%">


<!-- qa-evidence:end -->
