# QC Bank & Kas — Rekening, Transaksi, Arus Kas, Kategori, Laba Rugi

Penguji B. Lingkungan `qcb` (port 8012), dua perusahaan `qcbsatu` / `qcbdua`,
database tenant terpisah. Semua kasus dijalankan lewat UI sungguhan (Chromium
headless 1440×950) kecuali yang bertanda `BE`; verifikasi akhir selalu dibaca
langsung dari database tenant, bukan dari layar.
Bukti: [`../bukti/bank-kas/`](../bukti/bank-kas/).

**Sumber data uji:** rekening, transaksi, transfer, kategori, klien, layanan,
invoice pertama, dan kedua pembayarannya dibuat lewat UI sebagai bagian dari
kasus. Hanya 50 invoice massal untuk pengukuran jumlah query yang diisi lewat
skrip — membuatnya lewat UI memakan waktu berjam-jam dan tidak menguji apa pun
yang belum diuji invoice pertama.

---

## Papan skor

<!-- SKOR:MULAI -->
| | |
|---|---|
| **Diuji (benar-benar dijalankan)** | **72** |
| Lulus | 63 |
| Gagal | 9 — B-TRX-N12, B-TRX-A46, B-TRF-A10, B-TRF-A40, B-TRF-A41, B-TRF-N60, B-PL-N54, B-PL-N55, B-PL-N56 |
| Golongan | 35 normal · 29 abnormal/batas · 8 berantai |
| Lapisan | 42 lewat UI sampai database · 29 lewat HTTP langsung / baca database · 1 hanya antarmuka |
| Berkas bukti | 65 tangkapan layar (1.072 KB, rata-rata 16,5 KB) |

Per modul: Transaksi 15 · Kategori 11 · Laba Rugi 11 · Transfer 10 · Rekening 8 ·
Arus Kas 5 · Akses silang 5 · Saldo 4 · Lampiran 2 · Izin 1

> Angka di atas dihitung program dari tabel kasus di dokumen ini, bukan tangan
> (`D:/tmp/qa-tools/b/hitung-skor.py`); skrip yang sama memeriksa tidak ada ID
> ganda, tidak ada tautan bukti mati, dan tidak ada berkas bukti yang tidak
> tertaut. Hitungan tangan saya meleset 1 kasus dan 3 angka lapisan sebelum
> dikoreksi skrip ini.

**Temuan:** 1 **MEMBLOKIR** (T-01) · 2 tinggi (T-02, T-03) · 2 sedang (T-04, T-05) ·
3 rendah (T-06, T-07, T-08).

Tujuh hal yang WAJIB dibuktikan spesifikasi: **ketujuhnya terbukti benar** — saldo dihitung
bukan disimpan (termasuk setelah hapus), transfer sepasang lewat `transfer_group_id`
dengan tiga transfer di **detik yang sama** dan hapus-satu tidak menyentuh yang lain,
hapus transaksi berlampiran (tunggal **dan** massal) benar-benar membuang berkasnya,
kategori sistem tidak bisa dihapus, angka laba rugi cocok sampai rupiah terakhir
dengan titipan pajak dikecualikan, dan jumlah query **datar di 26** dari 6 sampai 51
invoice, serta akses silang ditolak. **Tetapi** pengujian
membuka satu cacat yang memblokir pemakaian halaman Laba Rugi itu sendiri (T-01)
dan satu jalur kehilangan data yang bisa dipicu pengguna biasa (T-02).
<!-- SKOR:SELESAI -->

Golongan: **N** normal · **A** abnormal/batas · **C** berantai (lintas aktor/modul).
Lapisan: **FE+BE** antarmuka sampai database · **BE** lewat HTTP langsung atau
pembacaan database (dipakai saat aturannya harus dibuktikan ditegakkan server,
bukan hanya oleh UI, atau saat yang diukur memang tidak dirender halaman).

---

## Rekening Bank

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-REK-N01 | FE+BE | Buka `/bank-accounts` di perusahaan yang baru dibuat | Empty state "Belum ada rekening" ([bukti](../bukti/bank-kas/B-REK-N01-index-kosong.png)) | LULUS |
| B-REK-N02 | FE+BE | Tambah rekening "Kas Operasional", saldo awal 10.000.000 | Tersimpan; sidebar **Rp 10.000.000**; DB `initial_balance=10000000` ([form](../bukti/bank-kas/B-REK-N02-a-form-rekening.png), [hasil](../bukti/bank-kas/B-REK-N02-b-saldo-awal-10jt.png)) | LULUS |
| B-REK-N03 | FE+BE | Tambah rekening kedua "Kas Cadangan" 5.000.000 | Total Rp 15.000.000 ([bukti](../bukti/bank-kas/B-REK-N03-rekening-kedua.png)) | LULUS |
| B-REK-A01 | FE+BE | Nomor rekening duplikat (`1110001`) lewat dialog | Ditolak; dialog tetap terbuka dengan pesan di bawah field ([bukti](../bukti/bank-kas/B-REK-A01-nomor-duplikat-ditolak.png)) | LULUS |
| B-REK-A02 | BE | Nomor duplikat lewat `POST /bank-accounts` langsung | `422` `{"errors":{"account_number":[…]}}` — ditolak **server**, bukan hanya klien | LULUS |
| B-REK-A03 | BE | `initial_balance = -500000` lewat HTTP | `422` `initial_balance` | LULUS |
| B-REK-N04 | FE+BE | Ubah saldo awal Kas Cadangan 5.000.000 → 7.500.000 | Total bergeser **tepat +2.500.000** (224.706.500 → 227.206.500) — bukti saldo dihitung dari `initial_balance`, bukan disimpan ([form](../bukti/bank-kas/B-REK-N04-a-ubah-saldo-awal.png), [hasil](../bukti/bank-kas/B-REK-N04-b-total-bergeser.png)) | LULUS |
| B-REK-N05 | FE+BE | Hapus rekening yang masih punya 11 transaksi | **Ditolak server** (303 + `withErrors`); rekening dan seluruh transaksinya utuh. Dialog konfirmasi tidak memperingatkan apa pun, dan pesan server yang rinci dibuang jadi "Gagal menghapus rekening" → **T-06** ([konfirmasi](../bukti/bank-kas/B-REK-N05-a-konfirmasi-tanpa-peringatan.png), [hasil](../bukti/bank-kas/B-REK-N05-b-ditolak-pesan-generik.png)) | LULUS |

> Dokumen modul `docs/module/bank-accounts.md` masih menulis bahwa `destroy()`
> berjalan "**tanpa guard tambahan**" dan menghapus berantai. Itu **tidak lagi
> benar** — `BankAccountController::destroy()` baris 124-150 menolak selama masih
> ada transaksi / pembayaran invoice / pembayaran pinjaman. Dokumennya yang perlu
> diperbarui, bukan kodenya.

## Saldo dihitung, bukan disimpan — WAJIB #1

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-SLD-A04 | BE | `SHOW COLUMNS FROM bank_accounts` | Tidak ada kolom `balance`. Kolom: id, account_name, account_number, bank_name, branch, initial_balance, timestamps | LULUS |
| B-SLD-N06 | FE+BE | Cocokkan angka layar dengan hitungan manual dari baris DB setelah 1 pemasukan + 1 pengeluaran | Layar Rp 11.750.000 / total Rp 16.750.000. Manual: `10.000.000 + 0 + 3.000.000 − 1.250.000 = 11.750.000` ✓ ([bukti](../bukti/bank-kas/B-TRX-N11-b-saldo-11750000.png)) | LULUS |
| B-SLD-N07 | FE+BE | Saldo **setelah transaksi dihapus** (hapus transfer "Borong Q" 101.000) | Sebelum 7.024.500 / 9.715.000 → sesudah **7.125.500 / 9.614.000**; layar total Rp 16.739.500 = jumlah keduanya ✓ ([bukti](../bukti/bank-kas/B-TRF-C02-d-saldo-benar.png)) | LULUS |
| B-SLD-N08 | FE+BE | Pembayaran invoice 5.000.000 masuk komponen saldo | 7.125.500 → 12.125.500 ✓ | LULUS |

## Transaksi Bank

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-TRX-N10 | FE+BE | Catat pemasukan 3.000.000, kategori "Kembali Dana", ref `REF-N10` | Tersimpan `credit` ([form](../bukti/bank-kas/B-TRX-N10-a-form-pemasukan.png), [hasil](../bukti/bank-kas/B-TRX-N10-b-pemasukan-tersimpan.png)) | LULUS |
| B-TRX-N11 | FE+BE | Catat pengeluaran 1.250.000, kategori "MAKAN MINUM" | Tersimpan `debit` ([bukti](../bukti/bank-kas/B-TRX-N11-a-form-pengeluaran.png)) | LULUS |
| B-TRX-N12 | FE+BE | Ubah nominal + kategori + deskripsi dari Arus Kas › Pengeluaran, klik **Simpan Perubahan** | **GAGAL.** `TypeError: Cannot read properties of undefined (reading 'toString')`; **tidak ada satu pun request HTTP terkirim**; DB tidak berubah. Dicoba 2× (dengan dan tanpa mengubah kategori) → **T-02b** ([dialog](../bukti/bank-kas/B-TRX-N12-a-dialog-edit.png), [terisi](../bukti/bank-kas/B-TRX-N12-b-form-terisi.png), [tidak tersimpan](../bukti/bank-kas/B-TRX-N12-c-simpan-tidak-terjadi.png)) | **GAGAL** |
| B-TRX-A30 | BE | `amount = 0` | `422 amount` | LULUS |
| B-TRX-A31 | BE | `amount = -100000` | `422 amount` | LULUS |
| B-TRX-A32 | BE | `description` kosong | `422 description` | LULUS |
| B-TRX-A33 | BE | `transaction_type = "gado-gado"` | `422 transaction_type` (bukan 403 — sesuai desain `authorize()`) | LULUS |
| B-TRX-A34 | BE | `bank_account_id = 9999` | `422 bank_account_id` | LULUS |
| B-TRX-A35 | BE | `category_id = 9999` | `422 category_id` | LULUS |
| B-TRX-A36 | BE | `transaction_date = "13 Brumaire"` | `422 transaction_date` | LULUS |
| B-TRX-A42 | BE | `debit` dengan kategori bertipe **income** | `422 category_id` | LULUS |
| B-TRX-A43 | BE | `credit` dengan kategori bertipe **expense** | `422 category_id` | LULUS |
| B-TRX-A44 | BE | `debit` dengan kategori **induk** (id 1) | `422 category_id` | LULUS |
| B-TRX-A45 | BE | `debit` dengan kategori **financing** (id 7) | `422 category_id` | LULUS |
| B-TRX-A46 | FE+BE | Catat **tiga biaya kantor biasa** (Sewa 500.000, Listrik 300.000, Internet 200.000) yang kebetulan diberi Nomor Referensi sama `TRF-NOV-2026` lewat dialog Pengeluaran, lalu hapus **satu** baris saja | **GAGAL — KEHILANGAN DATA.** Ketiganya terhapus. DB: `SELECT … WHERE reference_number='TRF-NOV-2026'` → kosong. Rp 1.000.000 biaya lenyap dari pembukuan dengan satu toast sukses → **T-02a** ([tiga baris](../bukti/bank-kas/B-TRX-A46-a-tiga-biaya-ref-TRF.png), [konfirmasi](../bukti/bank-kas/B-TRX-A46-b-konfirmasi-satu-baris.png), [lenyap](../bukti/bank-kas/B-TRX-A46-c-ketiganya-lenyap.png)) | **GAGAL** |

> A42–A45 lulus mulus; kontrasnya penting — endpoint pemasukan/pengeluaran
> memvalidasi tipe & keinduk-an kategori dengan benar. Yang tidak melakukannya
> hanyalah endpoint transfer (B-TRF-A40/A41), jadi itu kelalaian, bukan pilihan desain.

## Lampiran — WAJIB #3

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-LMP-N30 | FE+BE | 3 pengeluaran berlampiran PNG; hapus **satu** lewat ikon tempat sampah | Baris hilang **dan** berkasnya hilang dari `storage/tenantqcbsatu/app/public/transaction-attachments/` ([tiga berlampiran](../bukti/bank-kas/B-LMP-N30-a-tiga-berlampiran.png), [baris target](../bukti/bank-kas/B-LMP-N30-b-baris-target.png), [terhapus](../bukti/bank-kas/B-LMP-N30-c-hapus-tunggal.png)) | LULUS |
| B-LMP-N31 | FE+BE | Centang 2 baris berlampiran, **hapus massal** | Keduanya terhapus **dan** kedua berkasnya hilang. Folder lampiran kosong total — **0 berkas yatim** dari 3 yang dibuat ([dipilih](../bukti/bank-kas/B-LMP-N31-a-dua-dipilih.png), [konfirmasi](../bukti/bank-kas/B-LMP-N31-b-konfirmasi-massal.png), [hasil](../bukti/bank-kas/B-LMP-N31-c-massal-terhapus.png)) | LULUS |

> Jalur mass-delete yang dulu melewati hook `deleting` sudah diganti iterasi
> per-model (`BankTransactionController::bulkDestroy()` baris 306-338, dengan
> komentar yang menjelaskan alasannya). Terbukti benar.

## Transfer antar rekening — WAJIB #2

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-TRF-A10 | FE+BE | Buka dialog Transfer di perusahaan yang **baru dibuat** | **GAGAL.** Picker Kategori (wajib) hanya menampilkan judul grup "TRANSFER INTERNAL" yang disabled; `[cmdk-item]` = **0**. `/api/transaction-categories?type=transfer` → `[{"label":"Transfer Internal","value":6,"disabled":true}]`. Tidak ada tombol "+ Tambah" di dialog ini. **Transfer mustahil dilakukan** sampai seseorang menebak harus membuat sub-kategori dulu → **T-05** ([bukti](../bukti/bank-kas/B-TRF-A10-kategori-kosong-di-perusahaan-baru.png)) | **GAGAL** |
| B-TRF-N13 | FE+BE | Setelah sub-kategori dibuat: transfer 2.000.000 + biaya admin 2.500 | 2 baris berbagi satu `transfer_group_id` ULID; debit 2.002.500 di asal, credit 2.000.000 di tujuan ([form](../bukti/bank-kas/B-TRF-C01-a-form-transfer-1.png)) | LULUS |
| B-TRF-C01 | FE+BE | Transfer kedua 1.000.000 + admin 5.000 | Dua grup dengan ULID **berbeda** (`…9QBEGC` / `…ARKJ52`) dan `reference_number` berbeda; saldo total Rp 16.742.500 cocok hitungan manual ([form](../bukti/bank-kas/B-TRF-C01-b-form-transfer-2.png), [saldo](../bukti/bank-kas/B-TRF-C01-c-saldo-setelah-dua-transfer.png)) | LULUS |
| B-TRF-C02 | FE+BE | **Tiga transfer lahir di DETIK YANG SAMA** (`created_at = 2026-11-03 15:48:01`, grup `…WVDB3G` / `…ZPCT60` / `…P8HQ04`, referensi ketiganya berbeda). Lalu **hapus satu** (Borong Q) lewat ikon tempat sampah di tab Transaksi | **Hanya pasangannya yang hilang.** Kedua kaki Borong Q terhapus; **Borong P dan Borong R — lahir di detik yang sama — tetap utuh 2 kaki**, begitu pula 7 grup lain (9 grup × 2 kaki). Saldo: 7.024.500 → 7.125.500 dan 9.715.000 → 9.614.000, tepat ±101.000 ([cari](../bukti/bank-kas/B-TRF-C02-a-pilih-satu-dari-detik-sama.png), [konfirmasi](../bukti/bank-kas/B-TRF-C02-b-konfirmasi.png), [sesudah](../bukti/bank-kas/B-TRF-C02-c-setelah-hapus.png), [saldo](../bukti/bank-kas/B-TRF-C02-d-saldo-benar.png)) | LULUS |
| B-TRF-N60 | FE+BE | Ubah deskripsi transfer dari halaman Arus Kas › Transfer | **GAGAL.** `TypeError` yang sama dengan B-TRX-N12; tidak ada request; pasangan tidak tersinkron karena tidak ada apa pun yang terjadi → **T-02b** ([dialog](../bukti/bank-kas/B-TRF-N60-a-dialog-edit-transfer.png), [tidak tersimpan](../bukti/bank-kas/B-TRF-N60-b-simpan-tidak-terjadi.png)) | **GAGAL** |
| B-TRF-A37 | BE | `from_account_id == to_account_id` | `422 from_account_id` | LULUS |
| B-TRF-A38 | BE | `amount = 0` | `422 amount` | LULUS |
| B-TRF-A39 | BE | `admin_fee = -5000` | `422 admin_fee` | LULUS |
| B-TRF-A40 | BE | Transfer dengan `category_id` bertipe **expense** (18) | **DITERIMA** (302). Akibatnya nyata: kaki **debit** muncul di halaman Pengeluaran sebagai biaya biasa, kaki **credit** tidak muncul di mana-mana, dan pasangannya tak pernah tampil di halaman Transfer → pemindahan dana internal terhitung sebagai **beban usaha** → **T-03** ([bocor](../bukti/bank-kas/B-TRF-A40-a-bocor-ke-pengeluaran.png), [hilang](../bukti/bank-kas/B-TRF-A40-b-hilang-dari-transfer.png)) | **GAGAL** |
| B-TRF-A41 | BE | Transfer dengan kategori **induk** (id 6, disabled di semua picker) | **DITERIMA** (302); dua baris tercipta menunjuk kategori induk, melanggar invarian "parent tidak pernah memegang transaksi" → **T-03** | **GAGAL** |

## Arus Kas

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-AK-N40 | FE+BE | Buka `/cash-flow` sebagai admin | Redirect ke `/cash-flow/income` | LULUS |
| B-AK-N41 | FE+BE | Halaman Pemasukan | 1 baris Rp 3.000.000, sumber "Langsung"; kaki credit transfer **tidak** ikut muncul (kategorinya bertipe transfer) ([bukti](../bukti/bank-kas/B-AK-N41-pemasukan.png)) | LULUS |
| B-AK-N42 | FE+BE | Halaman Pengeluaran | 1 baris Rp 1.250.000; kaki debit transfer tidak muncul ([bukti](../bukti/bank-kas/B-AK-N42-pengeluaran.png)) | LULUS |
| B-AK-N43 | FE+BE | Halaman Transfer | 9 pasangan; biaya admin direkonstruksi benar (Total Debit Rp 402.000 "+ admin Rp 2.000" untuk jumlah Rp 400.000); total Rp 4.614.000 = jumlah kesembilan nominal ([bukti](../bukti/bank-kas/B-AK-N43-transfer.png)) | LULUS |
| B-AK-N44 | BE | Export PDF: semua-waktu, rentang+akun, per-rekening, dan `/preview` | Keempatnya `200 application/pdf`; nama berkas mengikuti filter (`cash-flow-2026-11-01-to-2026-11-30-account-1.pdf`, dst.); `/preview` `inline`. Isi PDF akun 2: saldo berjalan menyambung dan saldo akhir **Rp 9.614.000** persis sama dengan hitungan DB. **Tetapi** footer setiap PDF memuat "🤖 Generated with Claude Code" → **T-04** | LULUS |

## Kategori Transaksi — WAJIB #4

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-KAT-N20 | FE+BE | Buka index | 28 kategori, 14 utama / 14 sub, 19 belum diklasifikasi; kolom "Digunakan" terisi ([bukti](../bukti/bank-kas/B-KAT-N20-index.png)) | LULUS |
| B-KAT-N21 | FE+BE | Tambah sub-kategori transfer "Pindah Dana Internal" di bawah "Transfer Internal" | Tersimpan `type=transfer, parent_id=6` ([form](../bukti/bank-kas/B-KAT-N21-a-form-subkategori-transfer.png), [hasil](../bukti/bank-kas/B-KAT-N21-b-tersimpan.png)) | LULUS |
| B-KAT-N22 | FE+BE | Hapus kategori yang belum dipakai (KASBON) | `ConfirmDialog` biasa; terhapus; DB tidak lagi memuat id 16 ([konfirmasi](../bukti/bank-kas/B-KAT-N22-a-konfirmasi-hapus.png), [hasil](../bukti/bank-kas/B-KAT-N22-b-terhapus.png)) | LULUS |
| B-KAT-A20 | FE+BE | Hapus kategori sistem `FIN-LOAN-IN` lewat UI | **Ditolak** dengan toast "Kategori sistem tidak dapat dihapus karena dipakai otomatis oleh modul Pinjaman/Piutang."; kategori utuh. Catatan: ikon pensil & tempat sampah tetap **aktif** untuk kategori sistem dan dialog konfirmasi tetap terbuka setelah penolakan → **T-07** ([tombol aktif](../bukti/bank-kas/B-KAT-A20-a-tombol-hapus-aktif.png), [konfirmasi](../bukti/bank-kas/B-KAT-A20-b-konfirmasi.png), [ditolak](../bukti/bank-kas/B-KAT-A20-c-ditolak-server.png)) | LULUS |
| B-KAT-A21 | BE | Paksa hapus **enam** kategori sistem (`FIN-LOAN-IN`, `FIN-LOAN-OUT`, `FIN-RCV-OUT`, `FIN-RCV-IN`, `EXP-INTEREST`, `REV-INTEREST`) lewat form HTTP dengan `_method=DELETE` | Keenamnya **masih ada** di DB dengan `system_key`, `type`, dan `pl_group` tidak berubah. **Tidak memblokir modul Pinjaman/Piutang.** | LULUS |
| B-KAT-A22 | BE | Paksa `PUT` kategori sistem id 7 → `{type: expense, label: "DIBAJAK", pl_group: opex}` | Ditolak; DB tetap `Penerimaan Pinjaman / financing / pl_group NULL` | LULUS |
| B-KAT-A23 | FE+BE | Hapus kategori induk beranak ("Operational Expenses", 6 sub) | Ikon hapus **disabled** di UI; dipaksa lewat HTTP pun kategori dan keenam anaknya tetap ada ([bukti](../bukti/bank-kas/B-KAT-A23-induk-tombol-nonaktif.png)) | LULUS |
| B-KAT-C10 | FE+BE | Hapus kategori **terpakai** (MAKAN MINUM, 1 transaksi) → dialog reassign → pindahkan ke "OPERASIONAL LUAR KOTA" | Dialog menyebut "1 transaksi"; setelah **Pindahkan & Hapus**: transaksi id 2 berpindah `category_id 15 → 18`, kategori 15 hilang, tidak ada referensi yatim ([dialog](../bukti/bank-kas/B-KAT-C10-a-dialog-reassign.png), [pengganti](../bukti/bank-kas/B-KAT-C10-b-pengganti-dipilih.png), [selesai](../bukti/bank-kas/B-KAT-C10-c-reassign-selesai.png)) | LULUS |
| B-KAT-A24 | BE | Reassign ke kategori **induk** (HPP, id 3) | Ditolak; kategori asal masih ada | LULUS |
| B-KAT-A25 | BE | Reassign ke **tipe berbeda** (income, id 28) | Ditolak | LULUS |
| B-KAT-A26 | BE | Reassign ke **diri sendiri** (id 15) | Ditolak | LULUS |

> A24–A26 dibuktikan tidak hanya oleh respons, tetapi oleh hasil akhir: transaksi
> yang menunggu akhirnya pindah ke kategori **18** — bukan 3, bukan 28, bukan tetap
> di 15. Kalau salah satu dari ketiga percobaan itu lolos, tujuannya akan berbeda.

## Laporan Laba Rugi — WAJIB #5 & #6

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-PL-N50 | FE+BE | Buka laporan saat ada 1 pemasukan 3.000.000 + 1 pengeluaran 1.250.000 yang kategorinya belum punya `pl_group` | Panel "Perlu Diklasifikasi (2)" menampilkan keduanya dan menyatakan "Total Rp 4.250.000 **belum masuk laporan**". Seluruh total laporan tetap **Rp 0** — ember itu benar-benar tidak dijumlahkan. Kaki transfer tidak muncul di sana (dikecualikan lewat `type`) ([bukti](../bukti/bank-kas/B-PL-N50-ember-belum-terklasifikasi.png)) | LULUS |
| B-PL-N51 | FE+BE | Invoice Rp 12.000.000 (item jasa 10.000.000 HPP 4.000.000 + item **titipan pajak** 2.000.000), dibayar **sebagian** 5.000.000 | Pendapatan **Rp 3.000.000** = `5.000.000 − 2.000.000 titipan`. Titipan pajak **tidak** ikut omzet ✓. Basis kas ✓ (invoice 12 juta, diakui hanya yang masuk) ([bukti](../bukti/bank-kas/B-PL-N52-basis-kas-bayar-sebagian.png)) | LULUS |
| B-PL-N52 | FE+BE | Periksa HPP cost-recovery pada pembayaran sebagian yang sama | HPP **Rp 3.000.000** = `min(3.000.000, 4.000.000)`; **Laba kotor Rp 0** — modal ditutup lebih dulu, persis kebijakan "tutup modal dulu" | LULUS |
| B-PL-N53 | FE+BE | Lunasi sisa 7.000.000 | Pendapatan **Rp 10.000.000**, HPP **Rp 4.000.000**, Laba kotor **Rp 6.000.000** — sama persis dengan "Laba kotor Rp 6.000.000" di halaman invoice ([bukti](../bukti/bank-kas/B-PL-N53-setelah-lunas.png)) | LULUS |
| B-PL-N54 | FE+BE | Klasifikasikan "OPERASIONAL LUAR KOTA" → Beban Operasional dari panel Perlu Diklasifikasi | **GAGAL.** `PATCH http://127.0.0.1:8012/transaction-categories/18/pl-group` — **tanpa prefiks `/c/qcbsatu`** → `405`, respons `is_guest:true`. UI menampilkan "Menyimpan…" lalu kembali seperti semula **tanpa pesan error**; DB `pl_group` tetap `NULL` → **T-01** ([opsi](../bukti/bank-kas/B-PL-N54-a-opsi-klasifikasi.png), [gagal diam](../bukti/bank-kas/B-PL-N54-b-klasifikasi-gagal-diam.png)) | **GAGAL** |
| B-PL-N55 | FE+BE | Klik preset periode "Bulan ini" | **GAGAL.** Pindah ke `http://127.0.0.1:8012/reports/profit-loss?...` tanpa prefiks perusahaan → halaman **404 "Halaman tidak ditemukan"**. Pengguna terlempar keluar dari konteks perusahaan → **T-01** ([bukti](../bukti/bank-kas/B-PL-N55-filter-periode-404.png)) | **GAGAL** |
| B-PL-N56 | FE | `href` tombol **Unduh PDF** | `/reports/profit-loss/pdf?start_date=…` — tanpa prefiks perusahaan; mengkliknya memberi 404 → **T-01** | **GAGAL** |
| B-PL-N57 | BE | `GET /c/qcbsatu/reports/profit-loss/pdf` dengan URL yang benar | `200 application/pdf`, `laporan-laba-rugi-2026-01-01-2026-12-31.pdf`. Isi: Pendapatan 10.000.000 / HPP 4.000.000 / Laba Bersih 6.000.000 — sama dengan layar, plus catatan eksplisit bahwa transaksi belum terklasifikasi **tidak dihitung**. Endpointnya sehat; hanya tautannya yang salah | LULUS |
| B-PL-N58 | FE+BE | Aritmetika pada **51 invoice** (1 lewat UI + 50 massal; 1 di antaranya sengaja tanpa pembayaran) | Pendapatan **Rp 157.000.000** = `10.000.000 + 49 × 3.000.000`; HPP **Rp 53.000.000** = `4.000.000 + 49 × 1.000.000`; Laba kotor **Rp 104.000.000**. Cocok sampai rupiah terakhir ([bukti](../bukti/bank-kas/B-PL-N58-51-invoice.png)) | LULUS |
| B-PL-N59 | BE | **Jumlah query** halaman laba rugi pada 6 / 16 / 26 / 51 invoice (request HTTP sungguhan lewat kernel, `DB::listen` dipasang dari luar — jumlah query tidak dirender halaman mana pun) | **26 / 26 / 26 / 26 — datar.** Jalur invoice sepenuhnya di-batch: satu `whereIn` invoices, satu `whereIn` invoice_items, satu agregat payments. Pada rumus lama 2N+22 angka di 51 invoice semestinya ±124. **N+1 tidak kembali** | LULUS |
| B-PL-N60 | BE | Invoice `BULK-0001` yang tidak punya pembayaran sama sekali | Kontribusi pendapatan **0** — konsisten dengan basis kas (terbukti dari selisih 157.000.000 vs 50 invoice) | LULUS |

## Akses silang antar perusahaan — WAJIB #7

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-XC-C20 | FE+BE | `qcb-luar@qc.test` (admin **hanya** `qcbdua`) membuka 4 halaman `qcbsatu`: rekening, arus kas, kategori, laba rugi | **403 keempatnya** ([bukti](../bukti/bank-kas/B-XC-C20-luar-ditolak.png)) | LULUS |
| B-XC-C21 | BE | `luar` memaksa `DELETE /c/qcbsatu/bank-transactions/1` dan `/bank-accounts/1` lewat form HTTP | Data `qcbsatu` **utuh**: 2 rekening, 20 transaksi, id 1 keduanya masih ada | LULUS |
| B-XC-C22 | FE+BE | `luar` membuka rekening di perusahaannya sendiri | Tidak ada jejak data `qcbsatu` (tidak ada "Kas Operasional"/"1110001") ([bukti](../bukti/bank-kas/B-XC-C22-perusahaan-sendiri-bersih.png)) | LULUS |
| B-XC-C23 | FE+BE | `qcb-staff@qc.test` (anggota **hanya** `qcbsatu`) membuka `/c/qcbdua/dashboard` | **403** ([bukti](../bukti/bank-kas/B-XC-C23-staff-ditolak.png)) | LULUS |
| B-XC-C24 | FE+BE | Buat transaksi di `qcbdua` sehingga **id = 1 ada di KEDUA perusahaan**, lalu hapus id 1 dari `qcbdua` lewat UI | `qcbdua` kosong; `qcbsatu` id 1 ("Pemasukan uji N10", Rp 3.000.000) **utuh**. Isolasi bertahan bahkan saat primary key bertabrakan ([id sama](../bukti/bank-kas/B-XC-C24-a-id-sama-di-dua-perusahaan.png), [dihapus di dua](../bukti/bank-kas/B-XC-C24-b-dihapus-di-perusahaan-dua.png)) | LULUS |

## Izin

| ID | Lap. | Yang dilakukan | Hasil nyata | Status |
|---|---|---|---|---|
| B-IZN-N01 | FE+BE | `staff` membuka 7 halaman modul ini (rekening, cash-flow ×4, kategori, laba rugi) | **403 ketujuhnya** — sesuai model izin yang didokumentasikan ([bukti](../bukti/bank-kas/B-IZN-N01-staff-403.png)) | LULUS |

---

# Temuan

## T-01 — MEMBLOKIR · Halaman Laba Rugi kehilangan konteks perusahaan; semua kendalinya mati

**Gejala.** Di `/c/{company}/reports/profit-loss`, ketiga kendali halaman rusak:
1. preset/rentang periode → navigasi ke `/reports/profit-loss?…` → **404**;
2. panel "Perlu Diklasifikasi" → `PATCH /transaction-categories/{id}/pl-group` → **405**, gagal **tanpa pesan**;
3. tautan **Unduh PDF** → `href` tanpa prefiks → **404**.

Laporan hanya bisa dilihat pada periode bawaan (YTD). Begitu pengguna menyentuh
apa pun, ia terlempar ke halaman 404.

**Sebab.** `ProfitLossReportController::index()` baris 35-39 mengirim prop bernama
`company` berisi **profil perusahaan** (`{name, address, npwp}`). Nama itu bentrok
dengan prop bersama `company` dari `HandleInertiaRequests::share()` baris 52-56 yang
berisi **identitas tenant** (`{slug, name, abbreviation}`) dan menimpanya. Objek
profil tidak punya `slug`, sehingga di `resources/js/inertia.tsx:13`
`setActiveCompany(undefined ?? null)` membuat `activeCompanySlug = null`.

Sekali null, **kedua** pengaman mati sekaligus:
- `companyUrl()` (`resources/js/lib/company.ts:28`) mengembalikan path apa adanya;
- jaring pengaman global `installCompanyUrlPrefix()` (baris 94) `return` lebih awal
  karena `!getActiveCompany()`.

Jadi walaupun `profit-loss/index.tsx:335` **sudah** memakai `companyUrl()` dengan
benar, hasilnya tetap tanpa prefiks.

**Perbaikan yang disarankan.** Ganti nama prop halaman menjadi `companyProfile`
(atau sejenisnya) di controller + halaman React. Tambahan yang membuat kelas cacat
ini tidak bisa terulang: jadikan `syncActiveCompany()` tidak menurunkan slug yang
sudah ada menjadi null — slug perusahaan aktif tidak pernah berubah dalam satu
sesi `/c/{slug}`, jadi menerima `null` dari prop halaman selalu salah.

**Sebab yang sama di tempat lain.** `app/Http/Controllers/Settings/CompanyController.php:21`
mengirim prop `company` dengan bentuk profil yang juga tanpa `slug` (halaman
Pengaturan › Perusahaan — wilayah Penguji D). **Saya tidak mengujinya**; hanya
dibaca dari kode. Layak diperiksa di commit perbaikan yang sama.
`ClientController`, `TemplateBuilderController`, dan `InvoiceController` juga
memuat kata `'company' =>` tetapi bukan sebagai prop Inertia tingkat atas
(masing-masing di dalam `stats`, data contoh, dan view PDF) — tidak terdampak.

## T-02 — TINGGI · Dua cacat pada transaksi bank

### T-02a Kehilangan data: referensi berawalan `TRF` menghapus baris lain (B-TRX-A46)

Field **Nomor Referensi** di dialog Pemasukan/Pengeluaran adalah teks bebas. Kalau
pengguna mengisinya dengan sesuatu yang berawalan `TRF` — misalnya menyalin nomor
batch dari rekening koran — maka:
- `BankTransaction::permissionFeature()` menganggap baris itu kaki transfer, dan
- `BankTransactionController::kakiTransfer()` (baris 216-219) memasangkannya lewat
  `reference_number` (jalur cadangan untuk baris warisan),

sehingga `destroy()` menghapus **semua** baris dengan referensi itu. Tiga biaya
kantor yang tak berhubungan lenyap sekaligus, hanya dengan satu toast sukses.
Dialog konfirmasinya memang menyebut "Transaksi terkait transfer akan ikut
dihapus", tetapi pengguna tidak punya alasan menganggap tiga biaya kantor sebagai
"terkait transfer", dan dialog tidak menyebut jumlah maupun baris mana.

Perbaikan paling murah: tolak `reference_number` berawalan `TRF` di
`StoreBankTransactionRequest`/`UpdateBankTransactionRequest` (prefiks itu memang
sudah dinyatakan milik sistem di dokumen modul). Jalur cadangan `reference_number`
sendiri sebaiknya dibatasi pada baris yang `transfer_group_id`-nya null **dan**
kategorinya bertipe `transfer`.

### T-02b Simpan perubahan transaksi tidak berfungsi sama sekali (B-TRX-N12, B-TRF-N60)

`resources/js/pages/cash-flow/components/transaction-detail-dialog.tsx:169`:

```js
post(bankTransactionsRoutes.update.url(data.id), { … })
```

`update.url` (Wayfinder, `resources/js/routes/bank-transactions/index.ts:84`) menerima
objek `{company?, bankTransaction}` atau array `[company, bankTransaction]` — **bukan**
skalar telanjang. Dengan angka, `parsedArgs.bankTransaction` menjadi `undefined` dan
baris 104 melempar `TypeError: Cannot read properties of undefined (reading 'toString')`.
Tidak ada request yang terkirim; tombol **Simpan Perubahan** diam total di ketiga
halaman Arus Kas (Pemasukan, Pengeluaran, Transfer). Perbaikan satu baris:
`update.url({ bankTransaction: data.id })`.

Pola yang sama dicari di seluruh `resources/js/pages` dan `resources/js/components`
— **hanya satu kemunculan ini**. Juga ada di bundel `public/build`
(`transaction-detail-dialog-9fGr1aGV.js`), jadi bukan efek server dev.

## T-03 — TINGGI · Endpoint transfer tidak memvalidasi kategori (B-TRF-A40, B-TRF-A41)

`TransferBankTransactionRequest` hanya memeriksa `category_id` **ada**, tidak bahwa
tipenya `transfer` dan bukan kategori induk. Dua transfer berhasil dibuat dengan
kategori bertipe `expense` dan dengan kategori induk.

Dampaknya bukan kosmetik: kaki **debit** transfer berkategori `expense` tampil di
halaman Pengeluaran sebagai biaya biasa, kaki **credit**-nya tidak tampil di mana
pun, dan pasangannya hilang dari halaman Transfer. Begitu kategori itu diberi
`pl_group = opex`, **pemindahan dana antar rekening sendiri akan terhitung sebagai
beban operasional di Laporan Laba Rugi.**

Endpoint pemasukan/pengeluaran sudah melakukan validasi ini dengan benar
(B-TRX-A42…A45 semuanya `422`), jadi tinggal menyamakan aturannya.

## T-04 — SEDANG · Baris atribusi AI tercetak di laporan kas pelanggan

`resources/views/pdf/cash-flow-report.blade.php:386` mencetak
`🤖 Generated with Claude Code` di footer **setiap** PDF laporan kas — dari halaman
Arus Kas maupun Rekening Bank. Terbukti ada di keluaran nyata (lihat B-AK-N44).
Ini baris atribusi pesan commit yang bocor ke dokumen keuangan yang dikirim ke
pelanggan. Perbaikan: hapus ketiga baris itu. Template PDF lain (termasuk
`pdf/profit-loss.blade.php`) bersih.

Di berkas yang sama baris 377 memakai nilai cadangan
`{{ $company->finance_manager_name ?? 'DEWI SEPTYANINGRUM' }}` — nama orang
sungguhan sebagai default untuk perusahaan mana pun yang belum mengisi field itu.
Tidak terpicu di lingkungan QC (nilainya terisi `-`), jadi ini **terverifikasi
dengan membaca kode saja**, bukan dijalankan.

## T-05 — SEDANG · Transfer tidak bisa dipakai di perusahaan yang baru dibuat (B-TRF-A10)

`TenantDatabaseSeeder` membuat kategori "Transfer Internal" sebagai kategori
**induk tanpa anak**. Karena semua picker hanya menawarkan anak, picker Kategori di
dialog Transfer kosong — dan kategori itu wajib. Dialog Transfer juga tidak punya
tombol "+ Tambah" seperti dialog Pemasukan/Pengeluaran, jadi tidak ada jalan keluar
dari dalam dialog. Pelanggan baru akan menyimpulkan fitur transfer rusak.

Perbaikan paling murah: seed satu sub-kategori transfer bawaan (mis. "Pindah Dana
Internal") di `TenantDatabaseSeeder`. Alternatif: tampilkan "+ Tambah" juga di
dialog Transfer, atau beri pesan kosong yang mengarahkan ke Kategori Transaksi.

## T-06 — RENDAH · Pesan gagal hapus rekening dibuang (B-REK-N05)

`BankAccountController::destroy()` baris 146-149 menyusun pesan yang justru berguna
— "Rekening tidak dapat dihapus karena masih terkait dengan 11 transaksi (…), N
pembayaran invoice (…). Pindahkan atau hapus data tersebut terlebih dahulu." —
tetapi `resources/js/pages/bank-accounts/index.tsx:119` membuangnya:
`onError: () => toast.error('Gagal menghapus rekening')`. Pengguna tahu gagal, tidak
tahu apa yang menahannya. Dialog konfirmasinya juga masih berbunyi "akan dihapus,
tindakan ini tidak dapat dibatalkan" padahal besar kemungkinan akan ditolak.

## T-07 — RENDAH · Kategori sistem tidak ditandai di UI (B-KAT-A20)

Ikon ubah dan hapus tampil **aktif** untuk kategori ber-`system_key`, tanpa lencana
atau tooltip yang menerangkan statusnya — padahal UI yang sama sudah tahu caranya
menonaktifkan tombol dengan alasan (kategori induk beranak, B-KAT-A23). Setelah
penolakan, dialog konfirmasi tetap terbuka dan harus ditutup manual. Servernya
benar; yang kurang hanya petunjuknya.

## T-08 — RENDAH · Pesan validasi mencampur nama field Inggris dalam kalimat Indonesia

`"Account number sudah digunakan."`, `"Initial balance minimal 0."` (B-REK-A01/A02/A03).

---

# Catatan kejujuran

**Kegagalan perkakas saya sendiri, bukan cacat aplikasi.**
Pada percobaan pertama B-REK-A02/A21 saya mengirim `DELETE` lewat `fetch`, yang
mengikuti `redirect()->back()` dengan metode yang sama dan berakhir `405` di URL
koleksi. Itu kekeliruan saya, bukan aplikasinya; semua kasus HTTP langsung kemudian
diulang lewat form HTML sungguhan dengan `_method` spoofing. Script pengisi 50
invoice juga sempat gagal dua kali (nama kolom `issue_date`, enum
`payment_method`), menyisakan `BULK-0001` tanpa pembayaran — yang kebetulan menjadi
kasus uji yang berguna (B-PL-N60) dan sudah diperhitungkan dalam aritmetika B-PL-N58.

**Kondisi lingkungan yang wajib dilaporkan.**
`public/hot` **ada** (dibuat 2026-11-03 12:54, sebelum sesi saya) dan menunjuk ke
`http://[::1]:5174`; server Vite itu hidup, sehingga seluruh aset JS di lingkungan
QC saya dilayani dari sana, bukan dari `public/build`. Sesuai pengarahan saya
**tidak menghapusnya**. Pengaruh terhadap temuan: tidak ada untuk semua temuan sisi
server (saldo, transfer, lampiran, kategori, laba rugi, jumlah query, isolasi
tenant). Untuk kedua temuan sisi klien saya sudah memeriksa silang ke sumber dan
ke bundel produksi: T-01 berakar di controller PHP + `lib/company.ts`, dan T-02b
terbukti ada juga di `public/build/assets/transaction-detail-dialog-9fGr1aGV.js`.
Keduanya bukan artefak server dev.

**Yang TIDAK sempat diuji** (tidak dihitung lulus maupun gagal):
- Chart 12 bulan & donut breakdown kategori di halaman Rekening Bank — hanya
  dilihat terender, isinya tidak dicocokkan dengan data.
- Filter & pengurutan tab Transaksi/Pembayaran (search, tipe, kategori, bulan,
  sort, `per_page`) selain pencarian deskripsi yang dipakai sebagai alat.
- Filter halaman Arus Kas (rentang tanggal, klien, kategori, rekening) dan sifat
  saling-eksklusif filter klien vs kategori di halaman Pemasukan.
- `POST /cash-flow/bulk-delete` (hapus massal yang mencampur payment + transaksi
  lewat `uid`) — yang diuji adalah `bank-transactions/bulk-delete`.
- Lampiran pada transfer (berkas yang dibagi dua kaki) dan penggantian/penghapusan
  lampiran lewat edit — terhalang T-02b yang mematikan seluruh jalur edit.
- Batas ukuran & tipe lampiran (5 MB, mimes) — tidak dicoba.
- Export Excel, dan laporan PDF kas dengan >250 baris (pemecahan chunk DomPDF).
- Peran `finance manager` pada modul ini (yang diuji `admin`, `staff`, dan admin
  perusahaan lain).

**Koreksi terhadap dokumentasi** (bukan cacat aplikasi, tapi akan menyesatkan
pembaca berikutnya):
1. `docs/module/bank-accounts.md` — bagian "Delete Rekening" menyatakan
   `destroy()` berjalan "tanpa guard tambahan" dan menghapus berantai. Sudah tidak
   benar; ada guard yang menolak (B-REK-N05).
2. `docs/module/cash-flow.md` — bagian "Transfer Antar Rekening" dan "Delete
   Transaksi" masih menulis `reference_number = 'TRF'.time()` dan pemasangan lewat
   `reference_number`. Kode sekarang memakai ULID `transfer_group_id`
   (`BankTransactionController::transfer()` baris 354-356). Bagian invarian di
   dokumen yang sama sudah benar — yang dua itu tertinggal.
3. `docs/module/transaction-categories.md` & `bank-accounts.md` — keduanya
   memperingatkan `/api/transaction-categories`, `/api/bank-accounts`, `/api/clients`
   "berada **di luar** grup `auth` … bisa diakses tanpa login". Sekarang ketiganya
   ada **di dalam** grup `c/{company}` ber-middleware (`routes/web.php:85-116`);
   tanpa login dijawab redirect ke `/login`, dan `api.transaction-categories`
   bahkan digate `can:view categories`.

---

## Cara mengulang

```bash
bash docs/qa/siapkan-lingkungan-qc.sh b 8012
bash docs/qa/jalankan-qc.sh b 8012          # biarkan jalan di latar
```

Akun: `qcb-admin@qc.test` / `qcb-fm@qc.test` / `qcb-staff@qc.test` /
`qcb-luar@qc.test`, sandi `QcUji#2026`. Skrip Playwright, pembantu query database
per-tenant, dan pengukur jumlah query ada di `D:/tmp/qa-tools/b/` (di luar repo,
sesuai pengarahan).
