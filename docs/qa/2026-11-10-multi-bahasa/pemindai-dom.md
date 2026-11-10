# Pemindai DOM otomatis: hasil per layar (QA sesudah multi bahasa, putaran 1 dan 2)

Putaran 1 dijalankan pada commit `b516112` (13 temuan, F01–F13). Putaran 2 dijalankan pada commit `1e7de08` setelah perbaikan, dengan crawler yang sama: `login → tiap halaman indeks → klik semua tombol aman: tab, dialog, drawer, dropdown, pemilih → kirim kosong pada dialog Tambah/Buat → klik baris daftar → dialog/drawer rincian`. Setiap layar/keadaan memindai teks yang terlihat plus `aria-label`, `title`, `placeholder`, `alt`.

- **ZH**: setiap kata berhuruf Latin di luar pengecualian ditandai.
- **EN dan ZH**: setiap teks yang SAMA PERSIS dengan kunci Indonesia di `resources/js/locales/{en,zh}.json` atau `lang/{en,zh}.json` (yang terjemahannya berbeda) ditandai sebagai jatuh kembali ke Indonesia; log console `[i18n] belum diterjemahkan` dikumpulkan.
- **EN**: ditambah daftar kata Indonesia umum dan perbandingan teks layar EN dengan layar ID untuk 38 halaman dasar (hasil: hanya kata yang memang sama di kedua bahasa: Total, Status, Menu, Kisantra, nama bulan dan kode).

## Skor K7

| | Putaran 1 (`b516112`) | Putaran 2 (`1e7de08`) |
|---|---|---|
| Layar/keadaan ZH | 1111 | 1083 |
| Layar/keadaan EN | 1100 | 1109 |
| Temuan non-pengecualian ZH | 12 unik (F01–F12) | **0** |
| Temuan non-pengecualian EN | 8 unik (F01, F02, F05–F10) | **0** |
| Temuan tata letak (F13) | 1 | **0** |
| Console `[i18n] belum diterjemahkan` | 2 kunci | **0** |
| Pembanding mentah 38 halaman (strict ZH; EN vs ID) | setara | 0 sisa selain pengecualian dan kata yang sama |

## Cakupan putaran 2

| Peran | EN | ZH |
|---|---|---|
| admin | 545 layar. 93.603 teks | 519 layar. 83.447 teks |
| finance manager | 276 layar. 41.643 teks | 274 layar. 41.264 teks |
| staf | 185 layar. 20.354 teks | 186 layar. 20.834 teks |

Tambahan: kerangka, halaman tamu, 403/404, widget Masukan (20 layar × 2 bahasa), klik baris daftar (± 62 layar × EN dan ZH, menunggu skeleton hilang), editor Template Builder (21 keadaan × EN dan ZH), pindaian dasar mentah 38 halaman × 3 bahasa.

## Status temuan F01–F13

| Kode | Prioritas | Temuan putaran 1 | Putaran 2 | Case |
|---|---|---|---|---|
| F01 | Sedang | Label "Alamat" di Klien › Tambah Klien dan Perusahaan › Perusahaan baru | **Diperbaiki, terverifikasi**: Alamat → 地址 / Address; tanpa "[i18n] belum diterjemahkan" | A10 |
| F02 | Sedang | Pilihan template cetak "Generik" (Invoice baru, dialog Cetak) | **Diperbaiki, terverifikasi**: Generik → 通用 / Generic; console bersih | A11 |
| F03 | Sedang | Nama atribut mentah di pesan validasi (type, role, label, slug, abbreviation, items.*) | **Diperbaiki, terverifikasi**: ZH "类型不能为空。", "角色不能为空。"; ID "Jenis wajib diisi."; EN "The type field is required." | A12 |
| F04 | Sedang | Pesan 403 bawaan Inggris di ZH dan ID | **Diperbaiki, terverifikasi**: ZH "您无权执行此操作。"; ID "Anda tidak memiliki izin untuk melakukan tindakan ini." | A13 |
| F05 | Rendah | Judul grup Izin & Peran "Bank-accounts", "Profit-loss", "Recurring-invoices" | **Diperbaiki, terverifikasi**: Tidak ada lagi slug mentah di ZH dan EN (0 judul huruf kecil-tanda-hubung) | A14 |
| F06 | Rendah | Sumbu Y Kas & Bank "Rp 100jt" | **Diperbaiki, terverifikasi**: ZH "Rp 100 百万", EN "Rp 100M", ID "Rp 100 jt" | A15 |
| F07 | Rendah | aria-label grafik ApexCharts berbahasa Inggris | **Diperbaiki, terverifikasi**: ZH "按月收入与支出柱状图", EN "Bar chart of income and expenses per month", ID "Grafik batang pemasukan dan pengeluaran per bulan" | A16 |
| F08 | Sedang | Invoice Berulang › Analitik: bulan Inggris tetap dan "Rp 0.0M" | **Diperbaiki, terverifikasi**: ZH "1月…12月", EN "Jan…Dec", ID "Jan…Mei…Agt…Okt…Des" | A17 |
| F09 | Rendah | aria-label cmdk "Suggestions" | **Diperbaiki, terverifikasi**: ZH "选项列表", EN "Options", ID "Daftar pilihan" | A18 |
| F10 | Sedang | Template PDF: kolom daftar dan lencana Template Builder | **Diperbaiki, terverifikasi**: ZH: 0 baris Indonesia di daftar dan editor; EN: hanya "Status" (kata yang sama) | A19 |
| F11 | Rendah | Dialog Tutorial: durasi, tab peran, label tutorial | **Diperbaiki, terverifikasi**: Judul dialog "教程：概览", durasi dan tab peran Mandarin. Tersisa sebagai PENGECUALIAN: label kontrol pemutar Remotion "Pause video", "Mute sound", "Enter Fullscreen" (tertulis keras di pustaka, ±baris 1689–1690, 2393–2394, 2449–2450 `node_modules/@remotion/player/dist/esm/index.mjs`) dan teks di dalam bingkai video ("Tutorial · Ringkasan", isi Indonesia sesuai K3) | A20 |
| F12 | Rendah | title nama ikon mentah di Tambah Peran | **Diperbaiki, terverifikasi**: 0 title/aria-label berisi nama ikon | A22 |
| F13 | Sedang | EN 390 px: tombol Create Invoice dan tab status terpotong | **Diperbaiki, terverifikasi**: Tombol turun baris dan utuh, tab status membungkus; gulir horizontal 0; 1280 px tetap sama | A21 |

Tidak ada temuan baru pada putaran 2.

## Tabel per layar (halaman indeks), putaran 2

Kolom temuan = jumlah kemunculan non-pengecualian (semua 0). Pengecualian sah dihitung terpisah.

| Halaman | Layar ZH | Layar EN | Teks ZH | Teks EN | Temuan ZH | Temuan EN | Pengecualian ZH/EN |
|---|---|---|---|---|---|---|---|
| `/admin/companies` | 7 | 7 | 521 | 521 | — | — | 6/0 |
| `/admin/users` | 17 | 17 | 2031 | 2031 | — | — | 7/0 |
| `/bank-accounts` | 48 | 46 | 14547 | 14070 | — | — | 22/0 |
| `/cash-flow/all` | 63 | 82 | 18142 | 26959 | — | — | 11/0 |
| `/cash-flow/expenses` | 39 | 38 | 7318 | 6986 | — | — | 9/0 |
| `/cash-flow/income` | 39 | 41 | 7835 | 8400 | — | — | 9/0 |
| `/cash-flow/transfers` | 31 | 31 | 3770 | 3760 | — | — | 8/0 |
| `/clients` | 23 | 23 | 2215 | 2211 | — | — | 20/0 |
| `/dashboard` | 40 | 40 | 12476 | 12427 | — | — | 13/0 |
| `/feedbacks` | 25 | 26 | 2119 | 2288 | — | — | 13/0 |
| `/fund-requests` | 43 | 42 | 6297 | 6318 | — | — | 13/0 |
| `/fund-requests/1/edit` | 21 | 21 | 2151 | 2030 | — | — | 0/0 |
| `/fund-requests/create` | 29 | 29 | 3216 | 3268 | — | — | 0/0 |
| `/invoices` | 43 | 42 | 5704 | 5735 | — | — | 16/0 |
| `/invoices/1` | 39 | 43 | 5340 | 6191 | — | — | 16/0 |
| `/invoices/7/edit` | 26 | 27 | 3418 | 3669 | — | — | 25/0 |
| `/invoices/create` | 40 | 40 | 5997 | 5967 | — | — | 43/0 |
| `/loans` | 26 | 32 | 2967 | 3988 | — | — | 8/0 |
| `/notifications` | 3 | 3 | 0 | 0 | — | — | 0/0 |
| `/permissions` | 15 | 15 | 4636 | 4635 | — | — | 1100/0 |
| `/receivables` | 40 | 42 | 4918 | 5232 | — | — | 13/0 |
| `/recurring-invoices` | 30 | 23 | 3491 | 1930 | — | — | 8/0 |
| `/recurring-invoices/templates/1/edit` | 42 | 42 | 5746 | 5746 | — | — | 0/0 |
| `/recurring-invoices/templates/create` | 42 | 42 | 5662 | 5662 | — | — | 0/0 |
| `/reimbursements` | 45 | 45 | 5380 | 5600 | — | — | 13/0 |
| `/reimbursements/1/edit` | 13 | 12 | 1329 | 1182 | — | — | 5/0 |
| `/reimbursements/create` | 44 | 44 | 5503 | 5448 | — | — | 13/0 |
| `/reports/profit-loss` | 20 | 20 | 2180 | 2257 | — | — | 8/0 |
| `/services` | 40 | 42 | 3658 | 3833 | — | — | 13/0 |
| `/settings` | 9 | 9 | 599 | 599 | — | — | 13/0 |
| `/settings/claude` | 9 | 9 | 771 | 771 | — | — | 36/0 |
| `/settings/company` | 7 | 7 | 602 | 602 | — | — | 6/0 |
| `/settings/invoice-numbering` | 25 | 25 | 3139 | 3139 | — | — | 24/24 |
| `/settings/password` | 9 | 9 | 486 | 483 | — | — | 0/0 |
| `/settings/pdf-templates` | 6 | 6 | 263 | 208 | — | — | 5/0 |
| `/settings/pdf-templates (editor)` | 21 | 21 | 2105 | 2094 | — | — | 130/0 |
| `/settings/profile` | 12 | 12 | 623 | 623 | — | — | 0/0 |
| `/template-builder-test` | 6 | 6 | 263 | 263 | — | — | 5/0 |
| `/transaction-categories` | 23 | 25 | 2922 | 3179 | — | — | 8/0 |
| `login` | 3 | 3 | 0 | 0 | — | — | 0/0 |
| `khusus: /panduan` | 1 | 1 | 254 | 254 | — | — | 2/0 |
| `khusus: 403 staf membuka /admin/users` | 1 | 1 | 13 | 13 | — | — | 0/0 |
| `khusus: 404` | 1 | 1 | 12 | 12 | — | — | 0/0 |
| `khusus: 404 di luar perusahaan` | 1 | 1 | 12 | 12 | — | — | 0/0 |
| `khusus: Masukan` | 1 | 1 | 358 | 355 | — | — | 0/0 |
| `khusus: atur ulang kata sandi` | 2 | 2 | 127 | 127 | — | — | 4/0 |
| `khusus: bel notifikasi` | 1 | 1 | 334 | 334 | — | — | 0/0 |
| `khusus: kerangka dasar` | 1 | 1 | 328 | 328 | — | — | 0/0 |
| `khusus: login` | 3 | 3 | 194 | 194 | — | — | 6/0 |
| `khusus: lupa kata sandi` | 2 | 2 | 116 | 116 | — | — | 4/0 |
| `khusus: menu bahasa` | 1 | 1 | 337 | 337 | — | — | 0/0 |
| `khusus: menu pengguna` | 1 | 1 | 334 | 334 | — | — | 0/0 |
| `khusus: pilih perusahaan` | 1 | 1 | 62 | 62 | — | — | 2/0 |
| `khusus: setup` | 1 | 1 | 62 | 62 | — | — | 2/0 |
| `khusus: sidebar semua grup dibuka` | 1 | 1 | 330 | 330 | — | — | 0/0 |
| `khusus: tombol Masukan melayang` | 1 | 1 | 355 | 355 | — | — | 0/0 |

## Pengecualian sah (daftar final)

| Kategori | Contoh yang ditemukan |
|---|---|
| Data buatan pengguna/perusahaan & data bawaan sistem | Nama klien/rekening/kategori template, deskripsi transaksi (mis. "Pembayaran bunga piutang: RCV-00001 - Budi Kasir"), nama akun uji (Qa Satu…), judul transaksi dan template uji. Dicocokkan dengan 232 string dari database pusat dan tenant. |
| Nama diri/merek | Kisantra Finance, Finance Management, Claude, Anthropic, nama bank (BCA, Mandiri, BRI), nama template cetak bawaan (Kisantra, Semesta, AGSA), "Indonesia"/"English"/"中文". |
| Akronim pajak | PPN, PPh, PPh Final, NPWP, PKP, NIB, DPP. |
| Rp & angka | Semua nominal "Rp 1.500.000", tanggal numerik, jam "17.48", persen. |
| Kode/ID/nomor/token format | Nomor invoice "001/INV/BQA-MJ/XI/2026", "RCV-00001", "ERR-0BAAJCIG55", token "{KLIEN}", "{BLN_ROMAWI}", kode izin kecil di Izin & Peran ("view invoices"), nama kolom data template ("item.description"). |
| Pintasan papan ketik & contoh format isian | "Ctrl+Enter", "alt+T", "按 Ctrl+V 粘贴图片", "08xx-xxxx-xxxx", "021-xxxxxxx", "XX.XXX.XXX.X-XXX.XXX". |
| Label aplikasi lain yang dikutip persis | "Settings › Connectors", "Add custom connector", "Connect" pada halaman Koneksi Claude. |
| Nama contoh di placeholder | "PT Semesta Raya", "semesta-raya", "PT Kisantra Solidaritas", "Sudirman 支行", "bhs_central_tenant_…", nama perusahaan contoh di panel pratinjau halaman login. |
| Format berkas | "复制 Markdown" (Markdown = nama format). |
| Isi dokumen/kanvas (K2) | Teks default kanvas ("Invoice {{invoice.number}}"), isi PDF/Excel. |
| Isi video Tutorial & halaman Panduan (K3) | Seluruh /panduan ("Staff", "Pengantar", …) dan teks di dalam bingkai video Tutorial ("Tutorial · Ringkasan"): tetap Indonesia sesuai keputusan K3. |
| Kontrol pemutar Remotion (BARU di putaran 2) | "Pause video", "Mute sound", "Enter Fullscreen": tertulis keras di pustaka, bukan kode aplikasi. Bukti: `node_modules/@remotion/player/dist/esm/index.mjs` ±baris 1689–1690, 2393–2394, 2449–2450 (dari laporan perbaikan) dan hasil uji A20. |

## Console

- `[i18n] belum diterjemahkan`: 0 pada putaran 2 (putaran 1: "Alamat", "Generik").
- Peringatan non-bahasa (tidak berubah): Radix "Missing `Description` or `aria-describedby`", React "`<div>` cannot be a descendant of `<p>`" (hydration), lisensi Remotion; respons 409 pada ganti bahasa dan 403/422 yang disengaja.

## Tata letak

Gulir horizontal halaman: 0 di semua kombinasi 26 halaman × ID/EN/ZH × 1280 dan 390 px. F13 teratasi. Pengamatan ringan yang tidak berubah dan bukan temuan: elipsis deskripsi Profil Perusahaan EN dan judul "应付借款"/"应收借款" ZH di 390 px.
