# QC Penjualan — Invoice, Klien, Layanan, Invoice Berulang

Penguji A. Lingkungan `qca` (port 8011), dua perusahaan `qcasatu` / `qcadua`,
database tenant terpisah. Semua kasus dijalankan lewat UI sungguhan (Chromium
headless, 1440×950) kecuali yang bertanda `BE`; verifikasi akhir dibaca langsung
dari database tenant. Bukti: [`../bukti/penjualan/`](../bukti/penjualan/).

**Sumber data uji:** klien, layanan, invoice, dan template berulang semuanya
dibuat lewat UI sebagai bagian dari kasus. Hanya rekening bank (modul Penguji B)
dan satu akun beizin `view invoices` saja yang disiapkan sebagai fixture.

---

## Papan skor

<!-- SKOR:MULAI -->
| | |
|---|---|
| **Diuji (benar-benar dijalankan)** | **51** |
| Lulus | 48 |
| Gagal | 3 — A-LYN-A02, A-PDF-N02, A-BRL-N04 |
| Golongan | 32 normal · 17 abnormal/batas · 2 berantai |
| Lapisan | 39 lewat UI sampai database · 12 lewat HTTP langsung |
| Berkas bukti | 75 tangkapan layar / render PDF |

Per modul: Invoice 21 · Invoice Berulang 9 · Klien 8 · Layanan 5 · PDF 3 · API 2 · Ekspor 1 · Akses silang 1 · Sapuan GET 1

**Temuan:** 1 tinggi (T-04) · 2 sedang (T-01, T-02) · 3 rendah (T-03, T-05, T-06).
**Tidak ada temuan yang memblokir pengujian** — semua kasus bisa dijalankan sampai selesai.

Tujuh hal yang WAJIB dibuktikan spesifikasi: **6 terbukti benar**
(siklus hidup penuh, nomor independen per perusahaan, penolakan bayar melebihi
sisa beserta nominal sisanya, hitung ulang status setelah total naik, unduhan PDF
keempat template, akses silang ditolak). Yang ketujuh — publish berulang menyalin
`unit` dan `is_tax_deposit` — **terbukti berjalan**, tetapi pengujiannya membuka
cacat lain pada invoice hasil publish yang sama (T-04).
<!-- SKOR:SELESAI -->

Golongan: **N** normal · **A** abnormal/batas · **C** berantai (lintas aktor/modul).
Lapisan: **FE+BE** antarmuka sampai database · **BE** lewat HTTP langsung
(dipakai saat aturannya harus dibuktikan ditegakkan server, bukan hanya oleh UI).

---

## Klien

| ID | Lapisan | Kasus | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|
| A-KLN-N01 | FE+BE | Tambah klien tipe Perusahaan + NPWP + PIC | Tersimpan; `clients.id=1 PT Alpha Nusantara type=company NPWP=01.234.567.8-901.000 status=Active`; kartu statistik Perusahaan naik jadi 1 | LULUS | [form](../bukti/penjualan/KLN-N01-1-form.png) · [hasil](../bukti/penjualan/KLN-N01-2-hasil.png) |
| A-KLN-N02 | FE+BE | Tambah klien tipe Individu | Tersimpan; `clients.id=2 type=individual` | LULUS | [hasil](../bukti/penjualan/KLN-N02-1-hasil.png) |
| A-KLN-N03 | FE+BE | Ubah nama + NPWP klien | `Siti Rahma` → `Siti Rahmawati`, NPWP terisi di DB | LULUS | [dialog](../bukti/penjualan/KLN-N03-1-dialog.png) · [hasil](../bukti/penjualan/KLN-N03-2-hasil.png) |
| A-KLN-N04 | FE+BE | Cari "Alpha" | Hanya PT Alpha tersisa di tabel; Siti tersaring keluar | LULUS | [cari](../bukti/penjualan/KLN-N04-1-cari.png) |
| A-KLN-N05 | FE+BE | Hapus klien yang belum punya data terkait | Konfirmasi biasa, klien terhapus | LULUS | [konfirmasi](../bukti/penjualan/KLN-N05-1-konfirmasi.png) · [terhapus](../bukti/penjualan/KLN-N05-2-terhapus.png) |
| A-KLN-A01 | FE+BE | Simpan klien dengan email yang sudah dipakai | Ditolak **server**: "Email sudah digunakan."; dialog tetap terbuka; `PT Kembar` tidak ada di DB | LULUS | [tolak](../bukti/penjualan/KLN-A01-1-tolak.png) |
| A-KLN-A02 | FE+BE | Simpan klien tanpa nama | Ditolak: "Nama wajib diisi." | LULUS | [tolak](../bukti/penjualan/KLN-A02-1-tolak.png) |
| A-KLN-A03 | FE+BE, BE | Hapus klien yang punya invoice **lunas** | Ditolak, menyebut jumlah invoice-nya. Lewat HTTP langsung juga ditolak (redirect + error sesi, bukan penghapusan): klien, 7 invoice, dan 4 pembayaran utuh. **Cascade destruktif yang didokumentasikan sudah diganti penjagaan** | LULUS | [prasyarat](../bukti/penjualan/KLN-A03-1-sebelum.png) · [konfirmasi](../bukti/penjualan/KLN-A03-2-konfirmasi.png) · [http](../bukti/penjualan/KLN-A03-4-http.png) |

## Layanan

| ID | Lapisan | Kasus | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|
| A-LYN-N01 | FE+BE | Tambah 2 layanan (kategori + CurrencyInput) | `Jasa Konsultasi Pajak / Administrasi Perpajakan / 5000000` dan `Pembuatan Izin Usaha / Perizinan / 2500000` tersimpan sebagai integer | LULUS | [form](../bukti/penjualan/LYN-N01-1-form.png) · [hasil](../bukti/penjualan/LYN-N01-2-hasil.png) |
| A-LYN-N02 | FE+BE | Ubah harga 2.500.000 → 3.000.000 | `services.price=3000000`; invoice lama tidak berubah (harga di-snapshot) | LULUS | [dialog](../bukti/penjualan/LYN-N02-1-dialog.png) · [hasil](../bukti/penjualan/LYN-N02-2-hasil.png) |
| A-LYN-N03 | FE+BE | Hapus layanan | Terhapus dari katalog; `invoice_items` lama tetap utuh (9 item) karena menyimpan nama sebagai teks | LULUS | [terhapus](../bukti/penjualan/LYN-N03-1-terhapus.png) |
| A-LYN-A01 | FE+BE | Simpan form layanan kosong | Ditolak: "Nama wajib diisi. Type wajib diisi." (label `Type` tidak diterjemahkan — lihat T-06) | LULUS | [tolak](../bukti/penjualan/LYN-A01-1-tolak.png) |
| A-LYN-A02 | BE | `?sort=kolom_palsu` lewat URL | **HTTP 500**, halaman "Terjadi kesalahan di sistem". `/clients` dan `/invoices` dengan parameter sama tetap 200 | **GAGAL** → T-01 | [500 di services](../bukti/penjualan/LYN-A02-1-sort.png) · [200 di clients](../bukti/penjualan/LYN-A02-2-klien.png) |

## Invoice — siklus hidup

| ID | Lapisan | Kasus | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|
| A-INV-N01 | FE+BE | Buat draft: 2 item (1 titipan pajak), satuan `paket` & `berkas`, HPP 3.000.000 | `invoices.id=1 invoice_number=NULL invoice_sequence=NULL status=draft subtotal=12000000`; item menyimpan `unit` dan `is_tax_deposit=1` apa adanya. Badge editor: "nomor diberikan saat terbit" | LULUS | [editor](../bukti/penjualan/INV-N01-1-editor.png) · [tersimpan](../bukti/penjualan/INV-N01-2-draft.png) |
| A-INV-N02 | FE+BE | Kirim invoice | Nomor usulan server `001/INV/SQ-AN/XI/2026` terisi otomatis; setelah kirim DB: `invoice_number=001/INV/SQ-AN/XI/2026 invoice_sequence=1 status=sent` | LULUS | [drawer](../bukti/penjualan/INV-N02-1-drawer.png) · [dialog](../bukti/penjualan/INV-N02-2-dialog.png) · [terkirim](../bukti/penjualan/INV-N02-3-terkirim.png) |
| A-INV-N03 | FE+BE | Bayar sebagian Rp 5.000.000 | `payments.id=1 amount=5000000 method=bank_transfer`; status → `partially_paid`; sisa Rp 7.000.000 | LULUS | [dialog](../bukti/penjualan/INV-N03-1-dialog.png) · [sebagian](../bukti/penjualan/INV-N03-2-sebagian.png) |
| A-INV-N04 | FE+BE | Pelunasan lewat chip "Sisa penuh", metode **Tunai** | Chip mengisi tepat Rp 7.000.000; `payments.id=2 method=cash` (metode benar-benar dikirim, bukan selalu transfer); status → `paid` | LULUS | [dialog](../bukti/penjualan/INV-N04-1-dialog.png) · [lunas](../bukti/penjualan/INV-N04-2-lunas.png) |
| A-INV-N05 | FE+BE | Naikkan qty invoice **lunas** 2 → 4 (total 12jt → 22jt) | Status dihitung ulang menjadi **Sebagian**: Total 22.000.000, dibayar 12.000.000, sisa 10.000.000. Tidak tertinggal "Lunas" | LULUS | [editor](../bukti/penjualan/INV-N05-1-edit.png) · [naik](../bukti/penjualan/INV-N05-2-naik.png) · [hasil](../bukti/penjualan/INV-N05-3-hasil.png) |
| A-INV-N06 | BE | Pembayaran susulan setelah total naik | HTTP 200 — invoice tidak terkunci oleh status lamanya; kembali `paid` di 22.000.000 | LULUS | — |
| A-INV-N07 | FE+BE | **Invoice pertama di perusahaan KEDUA** | `qcadua` punya daftar klien sendiri (PT Alpha tidak ada di sana). Editor memperkirakan `001/INV/DQ-BM/XI/2026`; terbit dengan `invoice_sequence=1`, sementara `qcasatu` juga memegang `001` — **urutan berdiri sendiri per perusahaan** | LULUS | [klien qcadua](../bukti/penjualan/INV-N07-1-klien-dua.png) · [editor](../bukti/penjualan/INV-N07-2-editor.png) · [terbit](../bukti/penjualan/INV-N07-3-terbit.png) |
| A-INV-N08 | FE+BE, BE | Rollback invoice urutan terakhir (003) | HTTP 200 "Invoice berhasil dikembalikan ke draft."; DB: `invoice_number=NULL invoice_sequence=NULL status=draft` | LULUS | [sebelum](../bukti/penjualan/INV-N08-1-sebelum.png) · [sesudah](../bukti/penjualan/INV-N08-2-sesudah.png) |
| A-INV-A01 | FE+BE | Bayar Rp 10.000.000 padahal sisa Rp 7.000.000 (lewat form) | UI memblokir sebelum kirim: tombol simpan diredupkan + pesan **"Melebihi sisa tagihan Rp 7.000.000."** — menyebut sisa yang sebenarnya | LULUS | [blokir](../bukti/penjualan/INV-A01-1-blokir.png) |
| A-INV-A02 | BE | Nominal sama, lewat HTTP langsung | **422** dengan pesan identik termasuk sisa sebenarnya — aturannya ditegakkan server, bukan hanya klien | LULUS | — |
| A-INV-A03 | BE | Bayar Rp 1.000 pada invoice yang sudah lunas | 422 "Melebihi sisa tagihan Rp 0." (penolakan benar; penyebutannya kurang tepat — lihat T-05) | LULUS | — |
| A-INV-A04 | FE+BE, BE | Rollback invoice urutan 002 (bukan ekor deret) | 422 "Hanya invoice dengan nomor urut terakhir di periodenya yang bisa di-rollback."; menu rollback juga tidak ditawarkan di drawer | LULUS | [drawer](../bukti/penjualan/INV-A02-1-drawer.png) |
| A-INV-A05 | BE | Kirim invoice memakai nomor yang sudah dipakai invoice lain | 422 "Nomor ini sudah dipakai invoice lain." | LULUS | — |
| A-INV-A06 | BE | Hapus invoice yang punya 3 pembayaran | 422 "Invoice yang sudah memiliki pembayaran tidak dapat dihapus. Hapus pembayarannya terlebih dahulu."; pembayaran utuh | LULUS | — |
| A-INV-A07 | FE+BE | Simpan invoice dengan jatuh tempo lebih awal dari tanggal invoice | Ditolak server: "Jatuh tempo tidak boleh sebelum tanggal invoice.", error ditempel di field + ringkasan "1 isian perlu diperbaiki". Tidak ada baris baru di DB. **Tetapi** jatuh tempo tidak ikut bergeser saat tanggal invoice diubah — lihat T-03 | LULUS | [maju](../bukti/penjualan/INV-A05-1-maju.png) · [mundur](../bukti/penjualan/INV-A05-2-mundur.png) · [ditolak](../bukti/penjualan/INV-A05-3-simpan.png) |

## Invoice — daftar & penyaringan

| ID | Lapisan | Kasus | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|
| A-INV-N09 | FE+BE | Daftar tanpa parameter | Hanya bulan berjalan (Nov 2026); invoice bertanggal Mei 2024 tidak muncul — perilaku yang memang dirancang | LULUS | [bawaan](../bukti/penjualan/INV-N09-1-bawaan.png) |
| A-INV-N10 | FE+BE | `?month=2024-05` | Invoice `001/INV/SQ-AN/V/2024` muncul, invoice November tersaring keluar — filter bekerja dua arah | LULUS | [mei 2024](../bukti/penjualan/INV-N10-1-mei2024.png) |
| A-INV-N11 | FE+BE | `?date_from=2024-01-01&date_to=2026-12-31` | Mei 2024 **dan** November 2026 tampil bersamaan; rentang menimpa filter bulan | LULUS | [rentang](../bukti/penjualan/INV-N11-1-rentang.png) |
| A-INV-N12 | FE+BE | `?month=` (dikosongkan, tanpa rentang) | Seluruh periode tampil — **filter benar-benar bisa dikosongkan** | LULUS | [kosong](../bukti/penjualan/INV-N12-1-kosong.png) |
| A-INV-N13 | FE+BE | Pil "Perlu ditagih" dengan invoice jatuh tempo 888 hari lalu | Pil menghitung 1 walau daftar sedang disaring ke November — hitungan memang lintas periode; tab menampilkan invoice Mei 2024 itu | LULUS | [pil](../bukti/penjualan/INV-N13-1-pil.png) · [tab](../bukti/penjualan/INV-N13-2-overdue.png) |

## PDF & ekspor

| ID | Lapisan | Kasus | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|
| A-PDF-N01 | FE+BE | Unduh PDF invoice, **keempat** template Blade | Semua berawalan `%PDF-`, ukuran wajar, nama berkas benar: kisantra 9.525 B · semesta 3.595 B · agsa 4.536 B · generik 36.586 B. Tidak ada 0 byte maupun halaman error | LULUS | [kisantra](../bukti/penjualan/PDF-inv1-kisantra-invoice.png) |
| A-PDF-N02 | BE | Parameter `dp_amount` & `pelunasan_amount` | DP 5jt → `DP-Invoice-….pdf` 12.083 B; pelunasan 7jt → `Pelunasan-….pdf` 12.586 B; DP negatif diabaikan (jatuh ke penuh). **DP 99jt pada invoice 22jt tetap dicetak** sebagai "TOTAL DOWN PAYMENT IDR 99.000.000" dengan "Sisa Pembayaran Rp -77.000.000" | **GAGAL** → T-02 | [DP 5jt](../bukti/penjualan/PDF-inv1-DP_5_000_000.png) · [DP melebihi total](../bukti/penjualan/PDF-inv1-DP_melebihi_total.png) · [pelunasan](../bukti/penjualan/PDF-inv1-pelunasan_7jt.png) |
| A-PDF-N03 | BE | Pratinjau `/invoice/1/preview` | HTTP 200, `content-type: application/pdf`, `Content-Disposition: inline` — jalur render yang sama dengan unduhan | LULUS | — |
| A-EXP-N01 | FE+BE | Ekspor rekap: Excel Default, Excel JSM, PDF, PDF "Perlu ditagih" | Keempatnya terunduh dengan tanda tangan berkas benar (XLSX `PK`, PDF `%PDF-`): 7.620 B · 7.841 B · 15.031 B · 12.635 B | LULUS | [menu](../bukti/penjualan/EXP-N01-1-menu.png) · [PDF rekap](../bukti/penjualan/PDF-rekap.png) |

## Invoice Berulang

| ID | Lapisan | Kasus | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|
| A-BRL-N01 | FE+BE | Buat template bulanan, 2 item, satuan `bulan`/`berkas`, 1 bertanda titipan pajak | `invoice_template` JSON menyimpan `unit` dan `is_tax_deposit` per item; `subtotal=8000000` mengecualikan titipan 1.500.000 (aturan khusus recurring) | LULUS | [form](../bukti/penjualan/BRL-N01-1-form.png) · [hasil](../bukti/penjualan/BRL-N01-2-hasil.png) |
| A-BRL-N02 | FE+BE | Generate otomatis November 2026 | 1 draft `scheduled_date=2026-11-01 status=draft`; kartu revenue/profit terisi dari `invoice_data` | LULUS | [dialog](../bukti/penjualan/BRL-N02-1-dialog.png) · [hasil](../bukti/penjualan/BRL-N02-2-hasil.png) |
| A-BRL-N03 | FE+BE | **Publish draft → invoice sungguhan** | `invoices.id=6 status=draft invoice_number=NULL`. Item hasil salinan: `unit=bulan` dan `unit=berkas` (**bukan** default `pcs`), `is_tax_deposit=1` pada item titipan. Keduanya tersalin utuh | LULUS | [draft](../bukti/penjualan/BRL-N03-1-draft.png) · [published](../bukti/penjualan/BRL-N03-3-published.png) |
| A-BRL-N04 | FE+BE | Invoice hasil publish dilihat dari modul Invoice & PDF-nya | `total_amount=8.000.000` padahal Σ baris item = **9.500.000**. Satu-satunya invoice di DB yang totalnya tidak sama dengan jumlah barisnya. PDF mencantumkan baris titipan Rp 1.500.000 dan catatan "* Termasuk titipan pajak sebesar Rp 1.500.000" tetapi menagih IDR 8.000.000 | **GAGAL** → T-04 | [drawer](../bukti/penjualan/BRL-N04-1-drawer.png) · [PDF](../bukti/penjualan/PDF-inv6-publish.png) |
| A-BRL-N05 | FE+BE | Tab Analitik | Revenue 2026 Rp 8.000.000, pertumbuhan, performa per template (1/1, margin 87,5%), breakdown Published 1 (100%) — dihitung dari `invoice_data` | LULUS | [analitik](../bukti/penjualan/BRL-N05-1-analitik.png) |
| A-BRL-A01 | BE | Generate ulang bulan yang sama | `{"generated":0}` "Tidak ada invoice yang perlu digenerate untuk bulan ini." — idempoten | LULUS | — |
| A-BRL-A02 | BE | Publish draft yang sudah published | 422 "Invoice sudah dipublish." | LULUS | — |
| A-BRL-A03 | BE | Ubah & hapus draft yang sudah published (payload sah) | Ubah 422 "Invoice yang sudah dipublish tidak dapat diubah."; hapus 422 "Invoice yang sudah dipublish tidak dapat dihapus." | LULUS | — |
| A-BRL-A04 | FE+BE | Hapus template yang punya invoice terpublish | Tidak dihapus melainkan **diarsipkan**: `{"archived":true}`, `recurring_templates.status=archived` — jejak audit dipertahankan | LULUS | [arsip](../bukti/penjualan/BRL-A04-1-arsip.png) |

## Akses, izin, dan API

| ID | Lapisan | Kasus | Hasil nyata | Status | Bukti |
|---|---|---|---|---|---|
| A-SEC-C01 | FE+BE, BE | `qca-luar@qc.test` (anggota `qcadua` saja) menembak 6 URL `qcasatu` langsung | Semuanya **403**, tanpa satu pun data `qcasatu` bocor: daftar invoice, detail invoice, `/invoices/1/data`, unduh PDF, daftar klien, edit invoice. Kontrol: perusahaannya sendiri tetap 200 dan menampilkan PT Beta — penolakan memang penjagaan, bukan kerusakan | LULUS | [mendarat](../bukti/penjualan/SEC-C01-1-pilih.png) · [ditolak](../bukti/penjualan/SEC-C01-2-tolak.png) · [kontrol](../bukti/penjualan/SEC-C01-3-kontrol.png) |
| A-API-N01 | BE | `/api/invoices/next-sequence` sebagai admin | **HTTP 200** (tidak lagi 500): tanpa `date` → 2; `date=2026-11-20` → 2; `date=2026-12-01` → 1; `date=2026-01-15` → 1 — reset bulanan dihormati, dan dihitung dari bulan tanggal yang diminta. Di `qcadua` urutannya terpisah | LULUS | — |
| A-API-A01 | FE+BE, BE | Pengguna beizin `view invoices` **tanpa** `create invoices` | next-sequence **403**, sementara daftar invoice tetap 200 — gerbangnya memang izin `create invoices`, bukan sekadar "sudah login" | LULUS | [view-only](../bukti/penjualan/API-A01-1-viewonly.png) |
| A-INV-C01 | FE+BE, BE | Staff (`view`+`create invoices`, tanpa `edit`) mencoba menerbitkan invoice | Server menolak: `POST send` 403, `DELETE` 403, `/invoices/1/edit` 403; invoice tetap draft tanpa nomor. **Tetapi UI tetap menawarkan tombol "Kirim invoice" dan membuka dialognya**, lalu gagal dengan pesan Inggris "This action is unauthorized." | LULUS | [tombol](../bukti/penjualan/INV-C01-1-staff.png) · [dialog](../bukti/penjualan/INV-C01-2-dialog.png) · [gagal](../bukti/penjualan/INV-C01-3-gagal.png) |
| A-SWP-N01 | FE+BE | Sapuan 17 halaman GET dalam cakupan | 16 menjawab 200, 1 menjawab 404 sebagaimana mestinya (`/invoices/9999/data`). Tidak ada galat JavaScript selain pesan 404 yang diharapkan | LULUS | [daftar akhir](../bukti/penjualan/SWP-N01-1-index.png) |

---

## Temuan

### T-01 · `/services?sort=<kolom tak dikenal>` → HTTP 500 — **sedang**

`ServiceController::index()` meneruskan `sort` dan `direction` dari query string
langsung ke `orderBy()` tanpa daftar putih:

```php
$sort = $request->input('sort', 'created_at');
->orderBy($sort, $direction)
```

`ClientController` sudah punya penangkalnya (`self::KOLOM_URUT` + `in_array`),
dan `/clients?sort=kolom_palsu` memang menjawab 200. Hanya Layanan yang
terlewat. Dampak: tautan tersimpan atau bookmark dengan parameter sort lama
menampilkan halaman error, bukan daftar layanan.
**Perbaikan:** tiru pola `KOLOM_URUT` milik `ClientController`.
Bukti: [LYN-A02-1-sort](../bukti/penjualan/LYN-A02-1-sort.png).

### T-02 · `dp_amount` tidak dibatasi server — PDF menagih melebihi total — **sedang**

`GET /invoice/{invoice}/download?dp_amount=99000000` pada invoice bernilai
Rp 22.000.000 menghasilkan PDF siap kirim bertuliskan **TOTAL DOWN PAYMENT
IDR 99.000.000** dan **"Sisa Pembayaran: Rp -77.000.000"**.

Batasannya hanya ada di klien — `print-invoice-dialog.tsx:59` memakai
`dpAmount > 0 && dpAmount <= totalAmount`, sedangkan rutenya hanya mengecor nilai
mentah: `(int) $request->query('dp_amount')` (`routes/web.php:225` dan `:253`).
Siapa pun yang menyunting URL mendapat dokumen tagihan yang tampak sah dengan
angka mustahil. DP negatif aman (diabaikan, jatuh ke tagihan penuh).
**Perbaikan:** batasi di rute atau `InvoicePrintService` —
`max(0, min($dp, $invoice->total_amount))`.
Bukti: [PDF-inv1-DP_melebihi_total](../bukti/penjualan/PDF-inv1-DP_melebihi_total.png).

### T-03 · Jatuh tempo tidak mengikuti tanggal invoice meski labelnya "14 hari" — **rendah**

Label di editor berbunyi **"Jatuh tempo · 14 hari"**, tetapi mengubah tanggal
invoice tidak menggeser jatuh tempo sama sekali:

| aksi | tanggal invoice | jatuh tempo | selisih |
|---|---|---|---|
| bawaan | 03 Nov 2026 | 17 Nov 2026 | 14 hari |
| dimajukan | 10 Des 2026 | 17 Nov 2026 | **−23 hari** |
| dimundurkan | 15 Sep 2026 | 17 Nov 2026 | 63 hari |

Server menolak kasus yang mustahil dengan pesan yang jelas (A-INV-A07), jadi
tidak ada data rusak — tetapi pengguna yang memundurkan tanggal invoice menabrak
error validasi yang tidak ia sebabkan, dan yang memajukan tanggal menyimpan
invoice bertempo 63 hari tanpa sadar.
**Perbaikan:** geser jatuh tempo mengikuti tanggal invoice selama pengguna belum
menyetelnya sendiri.
Bukti: [maju](../bukti/penjualan/INV-A05-1-maju.png) · [mundur](../bukti/penjualan/INV-A05-2-mundur.png).

### T-04 · Invoice hasil publish berulang tidak menagih item titipan pajak — **tinggi**

Invoice hasil `RecurringInvoice::publish()` adalah satu-satunya invoice di
database yang `total_amount`-nya tidak sama dengan jumlah baris itemnya:

| invoice | asal | Σ baris item | ditagih | titipan pajak |
|---|---|---|---|---|
| #1 | manual | 22.000.000 | **22.000.000** | 2.000.000 (ikut ditagih) |
| #6 | publish berulang | 9.500.000 | **8.000.000** | 1.500.000 (**tidak** ditagih) |

Penyebabnya: `RecurringInvoiceController::buildInvoiceData()` mengecualikan item
titipan dari `subtotal` template, lalu `publish()` menyalin `subtotal` dan
`total_amount` apa adanya sementara **seluruh** item ikut disalin. Jalur manual
(`InvoiceController::store`) menjumlahkan semua item. Dua jalur, dua hasil, untuk
dokumen yang sama jenisnya.

Yang membuatnya jelas cacat dan bukan keputusan desain: PDF-nya mencetak baris
titipan Rp 1.500.000 **dan** catatan "* Termasuk titipan pajak sebesar
Rp 1.500.000" di samping nama klien — padahal totalnya tidak memuatnya.
Dokumennya membantah dirinya sendiri, dan perusahaan menagih kurang sebesar nilai
titipan setiap kali template berisi item titipan dipublish.
**Perbaikan:** samakan aturan subtotal kedua jalur, atau jangan salin item
titipan saat publish — jangan biarkan keduanya berbeda.
Bukti: [drawer](../bukti/penjualan/BRL-N04-1-drawer.png) · [PDF](../bukti/penjualan/PDF-inv6-publish.png).

### T-05 · Aksi yang pasti ditolak tetap ditawarkan UI — **rendah**

Staff tanpa izin `edit invoices` tetap melihat tombol **"Kirim invoice"** di
drawer, dan dialognya terbuka lengkap dengan nomor usulan. Baru setelah tombol
ditekan ia ditolak server. Pola yang sama sudah tercatat untuk tombol edit/hapus
di Klien & Layanan (`docs/module/clients.md`, `services.md`), jadi ini bukan kasus
tunggal melainkan konvensi yang belum rapi. Tidak ada celah keamanan: server
menolak 403 di semua jalur yang diuji.

Terkait: penolakan pembayaran pada invoice yang sudah lunas berbunyi
"Melebihi sisa tagihan **Rp 0**" alih-alih menyebut bahwa invoicenya memang sudah
lunas — benar secara hitungan, menyesatkan secara sebab.
Bukti: [tombol](../bukti/penjualan/INV-C01-1-staff.png) · [dialog](../bukti/penjualan/INV-C01-2-dialog.png).

### T-06 · Pesan berbahasa Inggris & nama field mentah di antarmuka Indonesia — **rendah**

Dua tempat keluar dari bahasa aplikasi:

- Penolakan izin memunculkan toast **"This action is unauthorized."** (bawaan
  Laravel) di antarmuka yang seluruhnya berbahasa Indonesia.
- Validasi layanan berbunyi **"Type wajib diisi."** — nama kolom mentah;
  labelnya di form adalah "Kategori".

Bukti: [toast Inggris](../bukti/penjualan/INV-C01-3-gagal.png) · [Type wajib diisi](../bukti/penjualan/LYN-A01-1-tolak.png).

---

## Dokumen modul yang sudah tidak sesuai kode

Ketiganya ditemukan saat membandingkan dokumen dengan perilaku nyata. Semua
arahnya sama: **kode sudah lebih baik daripada yang didokumentasikan**, sehingga
pembaca dokumen akan mengira ada cacat yang sebenarnya sudah diperbaiki.

| Dokumen | Yang tertulis | Yang terbukti dijalankan |
|---|---|---|
| `docs/module/recurring-invoices.md` | "`is_tax_deposit` dan `unit` **tidak disalin** ke `invoice_items`… satuan jatuh ke default `pcs`" (disebut dua kali: bagian Publish dan Invarian) | Keduanya **disalin** — `unit=bulan`/`berkas`, `is_tax_deposit=1`. Kode memuat komentar yang menjelaskan kenapa itu wajib (A-BRL-N03) |
| `docs/module/invoices.md` | "Status dan `invoice_number` tidak diubah" pada bagian Edit Invoice | `update()` memanggil `updateStatus()` bila invoice sudah pernah dibayar; status benar-benar dihitung ulang (A-INV-N05) |
| `docs/module/clients.md` | "**Hapus klien = hapus semua invoice + item-nya**… tidak ada soft delete", dengan peringatan panjang soal pembayaran yang lenyap | `ClientController::destroy` **menolak** penghapusan selama masih ada invoice/item terkait, menyebut nomor invoice-nya. Cascade destruktif itu sudah tidak bisa terjadi lewat UI maupun HTTP (A-KLN-A03) |

---

## Premis spesifikasi yang perlu dikoreksi

- Spec menulis `/api/invoices/next-sequence` "baru saja diperbaiki (sebelumnya
  selalu 500)" — **benar dan terbukti**: endpoint menjawab 200 dengan urutan yang
  tepat per periode reset dan per perusahaan, serta menolak 403 tanpa izin
  `create invoices`.
- Spec menulis publish berulang "menyalin `unit` dan `is_tax_deposit`" —
  **benar**, berlawanan dengan `docs/module/recurring-invoices.md` yang masih
  menyatakan sebaliknya. Yang perlu diperbaiki adalah dokumennya.
- Spec menyiratkan hapus klien melakukan cascade destruktif — **tidak lagi**;
  sudah ada penjagaan. Lihat tabel di atas.

---

## Yang TIDAK diuji

- **PPN / perusahaan PKP.** Profil perusahaan QC lahir dengan `is_pkp=0`,
  sehingga seluruh invoice yang diuji ber-`ppn_rate=0`. Jalur PPN (sakelar
  "Tagih PPN", nomor faktur, DPP, PPN di PDF dan rekap, pembekuan tarif) **tidak
  tersentuh sama sekali**. Ini lubang terbesar dalam cakupan saya.
- **Template PDF builder** (`template=builder:{id}`) — belum ada `PdfTemplate` di
  lingkungan QC; hanya keempat template Blade yang diuji.
- **Penyesuaian format penomoran** di Pengaturan › Penomoran invoice (padding,
  reset tahunan/never, token lain). Hanya format bawaan (3 digit, reset bulanan)
  yang teruji — termasuk bahwa resetnya benar lintas bulan dan lintas tahun.
- **Diskon** (nominal dan persen) serta **"Tagih ke beberapa klien"** di editor
  invoice.
- **Ubah dan hapus pembayaran** (`/payments/{payment}`) — hanya pencatatan yang
  diuji, bukan penyuntingan/penghapusannya.
- **Frekuensi berulang selain `monthly`** (quarterly / semi_annual / annual) dan
  bulk publish / bulk destroy.
- **Isi PDF selain nominal** — kecocokan byte pratinjau vs unduhan, logo, tanda
  tangan, stempel, terbilang untuk nilai pelik.

## Catatan kejujuran — kegagalan perkakas saya sendiri

Dicatat terpisah karena bukan cacat aplikasi:

1. Selektor tombol simpan di dialog edit klien saya tulis "Simpan", aslinya
   "Perbarui Klien" — A-KLN-N03 gagal sekali lalu diulang.
2. Pembacaan caption DatePicker saya anggap satu baris, padahal dua
   ("November", lalu "2026"). Loop mundur sampai batas 30 iterasi dan mendarat di
   **Mei 2024**, bukan September 2026. Dua kesimpulan filter sempat salah;
   seluruh kasus A-INV-N09…N12 diulang setelah helper diperbaiki. Invoice
   bertanggal 2024 yang terlanjur dibuat justru berguna: ia membuktikan reset
   urutan lintas tahun dan mengisi kasus "Perlu ditagih".
3. Pemeriksaan "tombol simpan disabled" memakai `button:last-of-type` yang
   mengenai tombol lain; sempat terbaca `false` padahal tangkapan layarnya jelas
   menunjukkan tombol teredup. Dikoreksi dari gambar.
4. `DELETE /clients/3` lewat `fetch` sempat terbaca **405**. Penyebabnya
   `redirect()->back()` yang diikuti `fetch` lalu diulang dengan metode DELETE ke
   URL daftar — artefak perkakas, bukan rute yang hilang. Diulang dengan
   `redirect: 'manual'`.
5. Tujuh tangkapan layar dari jalannya yang tergantikan sudah dihapus agar tidak
   ikut sebagai bukti yang menyesatkan.

Tidak ada kegagalan lingkungan: server QC di port 8011 menyala sepanjang sesi,
tidak ada bentrok port, tidak ada `public/hot`, dan `.env` / `finance_main_dev` /
`demo_central` tidak tersentuh.
