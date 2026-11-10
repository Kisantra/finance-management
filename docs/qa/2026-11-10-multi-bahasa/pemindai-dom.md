# Pemindai DOM otomatis: hasil per layar (QA sesudah multi bahasa)

Dihasilkan dari crawler Playwright headless (`login → tiap halaman indeks → klik semua tombol aman: tab, dialog, drawer, dropdown, pemilih → kirim kosong pada dialog Tambah/Buat → klik baris daftar → dialog/drawer rincian`). Setiap layar/keadaan memindai teks yang terlihat plus `aria-label`, `title`, `placeholder`, `alt`.

- **ZH**: setiap kata berhuruf Latin di luar pengecualian ditandai.
- **EN dan ZH**: setiap teks yang SAMA PERSIS dengan kunci Indonesia di `resources/js/locales/{en,zh}.json` atau `lang/{en,zh}.json` (yang terjemahannya berbeda) ditandai sebagai jatuh kembali ke Indonesia; log console `[i18n] belum diterjemahkan` dikumpulkan.
- **EN**: ditambah daftar kata Indonesia umum dan perbandingan teks layar EN dengan layar ID untuk 38 halaman dasar.

## Cakupan

| Peran | ID | EN | ZH |
|---|---|---|---|
| admin | 517 layar. 86.567 teks | 547 layar. 93.733 teks | 552 layar. 94.356 teks |
| finance manager | 277 layar. 41.484 teks | 273 layar. 41.249 teks | 271 layar. 40.345 teks |
| staf | 182 layar. 20.182 teks | 176 layar. 19.270 teks | 186 layar. 20.632 teks |

Tambahan: kerangka, halaman tamu, 403/404, widget Masukan (20 layar × 3 bahasa), klik baris daftar (± 60 layar × EN dan ZH), editor Template Builder (21 keadaan × EN dan ZH), pindaian dasar mentah 38 halaman × 3 bahasa.

## Tabel per layar (halaman indeks)

Kolom temuan menghitung kemunculan (layar × keadaan); kode temuan di bagian Temuan. "—" = 0. Pengecualian sah dihitung terpisah dan tidak dianggap gagal.

| Halaman | Layar ZH | Layar EN | Teks ZH | Teks EN | Temuan ZH | Temuan EN | Pengecualian ZH/EN |
|---|---|---|---|---|---|---|---|
| `/admin/companies` | 7 | 7 | 511 | 515 | F01×2, F03×2 | F01×1 | 6/0 |
| `/admin/users` | 17 | 17 | 1978 | 1973 | F03×1, F09×3, F11×7 | — | 3/0 |
| `/bank-accounts` | 45 | 47 | 13504 | 14525 | F06×212, F07×86, F09×9, F11×11 | F06×1, F07×1 | 12/0 |
| `/cash-flow/all` | 84 | 82 | 27573 | 26676 | F09×21, F11×13 | — | 3/0 |
| `/cash-flow/expenses` | 38 | 38 | 6888 | 6885 | F09×7, F11×13 | — | 1/0 |
| `/cash-flow/income` | 38 | 41 | 7652 | 8294 | F09×7, F11×13 | — | 1/0 |
| `/cash-flow/transfers` | 31 | 31 | 3758 | 3754 | F09×8, F11×13 | — | 0/0 |
| `/clients` | 23 | 23 | 2211 | 2208 | F01×6, F09×6, F11×22 | F01×1 | 6/0 |
| `/dashboard` | 40 | 40 | 12446 | 12501 | F09×3, F11×22 | — | 0/0 |
| `/feedbacks` | 26 | 25 | 2244 | 2151 | F09×8, F11×22 | — | 0/0 |
| `/fund-requests` | 41 | 43 | 5918 | 6283 | F09×14, F11×22 | — | 0/0 |
| `/fund-requests/1/edit` | 21 | 21 | 2031 | 2147 | F03×3, F09×2 | — | 0/0 |
| `/fund-requests/create` | 29 | 21 | 3211 | 2280 | F09×4 | — | 0/0 |
| `/invoices` | 43 | 43 | 5715 | 5719 | F09×1, F11×22 | — | 3/0 |
| `/invoices/1` | 43 | 42 | 6422 | 6098 | F09×1, F11×22 | F02×1 | 3/0 |
| `/invoices/7/edit` | 25 | 29 | 3201 | 4073 | F02×2, F09×4 | F02×1 | 24/0 |
| `/invoices/create` | 40 | 40 | 5973 | 5913 | F02×3, F09×6 | F02×1 | 43/0 |
| `/loans` | 26 | 29 | 2970 | 3473 | F09×2, F11×13 | — | 0/0 |
| `/notifications` | 3 | 3 | 0 | 0 | — | — | 0/0 |
| `/permissions` | 15 | 15 | 4706 | 4710 | F05×42, F11×10, F12×70 | F05×1 | 1092/0 |
| `/receivables` | 38 | 38 | 4528 | 4540 | F09×5, F11×22 | — | 0/0 |
| `/recurring-invoices` | 26 | 17 | 2518 | 1332 | F07×5, F08×16, F11×14 | F07×1, F08×1 | 0/0 |
| `/recurring-invoices/templates/1/edit` | 42 | 42 | 5771 | 5715 | F09×4 | — | 0/0 |
| `/recurring-invoices/templates/create` | 42 | 42 | 5685 | 5685 | F09×4 | — | 0/0 |
| `/reimbursements` | 51 | 47 | 6289 | 5809 | F09×5, F11×22 | — | 1/0 |
| `/reimbursements/1/edit` | 14 | 12 | 1488 | 1175 | F09×2, F11×7 | — | 0/0 |
| `/reimbursements/create` | 54 | 54 | 7331 | 6988 | F09×9, F11×22 | — | 0/0 |
| `/reports/profit-loss` | 19 | 20 | 1922 | 2194 | F11×13 | — | 0/0 |
| `/services` | 39 | 39 | 3562 | 3499 | F03×16, F09×11, F11×21 | — | 0/0 |
| `/settings` | 9 | 9 | 599 | 599 | F11×22 | — | 0/0 |
| `/settings/claude` | 9 | 9 | 771 | 771 | — | — | 36/0 |
| `/settings/company` | 7 | 7 | 600 | 603 | — | — | 6/0 |
| `/settings/invoice-numbering` | 25 | 25 | 3139 | 3139 | — | — | 24/24 |
| `/settings/password` | 9 | 9 | 483 | 483 | — | — | 0/0 |
| `/settings/pdf-templates` | 6 | 6 | 211 | 211 | — | — | 0/0 |
| `/settings/pdf-templates (editor)` | 21 | 21 | 2079 | 2147 | F10×91 | F10×83 | 130/0 |
| `/settings/profile` | 12 | 12 | 619 | 623 | — | — | 0/0 |
| `/template-builder-test` | 6 | 6 | 211 | 211 | — | — | 0/0 |
| `/transaction-categories` | 24 | 25 | 3068 | 3187 | F03×5, F09×2, F11×13 | — | 0/0 |
| `login` | 3 | 3 | 0 | 0 | — | — | 0/0 |
| `khusus: /panduan` | 1 | 1 | 254 | 254 | F11×1 | — | 1/0 |
| `khusus: 403 staf membuka /admin/users` | 1 | 1 | 13 | 13 | F04×1 | — | 0/0 |
| `khusus: 404` | 1 | 1 | 12 | 12 | — | — | 0/0 |
| `khusus: 404 di luar perusahaan` | 1 | 1 | 12 | 12 | — | — | 0/0 |
| `khusus: Masukan` | 1 | 1 | 355 | 355 | — | — | 0/0 |
| `khusus: atur ulang kata sandi` | 2 | 2 | 127 | 126 | — | — | 4/0 |
| `khusus: bel notifikasi` | 1 | 1 | 334 | 334 | — | — | 0/0 |
| `khusus: kerangka dasar` | 1 | 1 | 328 | 328 | — | — | 0/0 |
| `khusus: login` | 3 | 3 | 194 | 193 | — | — | 6/0 |
| `khusus: lupa kata sandi` | 2 | 2 | 116 | 116 | — | — | 4/0 |
| `khusus: menu bahasa` | 1 | 1 | 337 | 337 | — | — | 0/0 |
| `khusus: menu pengguna` | 1 | 1 | 334 | 334 | — | — | 0/0 |
| `khusus: pilih perusahaan` | 1 | 1 | 62 | 62 | — | — | 2/0 |
| `khusus: setup` | 1 | 1 | 62 | 62 | — | — | 2/0 |
| `khusus: sidebar semua grup dibuka` | 1 | 1 | 330 | 330 | — | — | 0/0 |
| `khusus: tombol Masukan melayang` | 1 | 1 | 355 | 355 | — | — | 0/0 |

Catatan kolom EN: F01, F02, F05–F08 untuk EN diambil dari log console `[i18n]` dan pembanding layar ID/EN, bukan dari pemindai teks Latin (yang tidak relevan untuk EN).

## Pengecualian sah yang didaftarkan

| Kategori | Contoh yang ditemukan |
|---|---|
| Data buatan pengguna/perusahaan & data bawaan sistem | Nama klien/rekening/kategori template, deskripsi transaksi (mis. "Pembayaran bunga piutang: RCV-00001 - Budi Kasir"), nama akun uji (Qa Satu…), judul transaksi uji ("QA income EN"). Dicocokkan dengan 232 string dari database pusat dan tenant. |
| Nama diri/merek | Kisantra Finance, Finance Management, Claude, Anthropic, nama bank (BCA, Mandiri, BRI), nama template cetak bawaan (Kisantra, Semesta, AGSA), "Indonesia"/"English"/"中文" (nama bahasa dalam bahasanya sendiri). |
| Akronim pajak | PPN, PPh, PPh Final, NPWP, PKP, NIB, DPP. |
| Rp & angka | Semua nominal "Rp 1.500.000", tanggal numerik, jam "17.48", persen. |
| Kode/ID/nomor/token format | Nomor invoice "001/INV/BQA-MJ/XI/2026", "RCV-00001", "ERR-0BAAJCIG55", token "{KLIEN}", "{BLN_ROMAWI}", kode izin kecil di Izin & Peran ("view invoices"), nama kolom data template ("item.description"). |
| Pintasan papan ketik & contoh format isian | "Ctrl+Enter", "alt+T", "按 Ctrl+V 粘贴图片", "08xx-xxxx-xxxx", "021-xxxxxxx", "XX.XXX.XXX.X-XXX.XXX". |
| Label aplikasi lain yang dikutip persis | "Settings › Connectors", "Add custom connector", "Connect" pada halaman Koneksi Claude. |
| Nama contoh di placeholder | "PT Semesta Raya", "semesta-raya", "PT Kisantra Solidaritas", "Sudirman 支行", "bhs_central_tenant_…" (pola nama basis data), nama perusahaan contoh di panel pratinjau halaman login. |
| Format berkas | "复制 Markdown" (Markdown = nama format). |
| Isi dokumen/kanvas (K2) dan isi Panduan/Tutorial (K3) | Teks default kanvas ("Invoice {{invoice.number}}"), isi video/halaman Panduan (/panduan dan dialog Tutorial): tetap Indonesia. Hanya kontrol pemutar dan judul dialog Tutorial dihitung sebagai UI (F11). |

## Temuan non-pengecualian (urut prioritas)

| Kode | Prioritas | Bahasa | Lokasi | Teks | Dugaan berkas sumber |
|---|---|---|---|---|---|
| F01 | Sedang | EN, ZH | Klien › Tambah Klien (label bidang "Alamat"); Perusahaan › Perusahaan baru (baris pratinjau "Alamat") | "Alamat" (tetap Indonesia) | resources/js/pages/clients/index.tsx:232, resources/js/pages/admin/companies/index.tsx:486; kunci "Alamat" belum ada di resources/js/locales/en.json dan zh.json (console: "[i18n] belum diterjemahkan: Alamat") |
| F02 | Sedang | EN, ZH | Invoice › editor (pilihan template cetak), dialog Cetak invoice, Invoice baru | "Generik" (nama template cetak, tetap Indonesia) | resources/js/pages/invoices/create.tsx:95, resources/js/pages/invoices/components/print-invoice-dialog.tsx:36; kunci "Generik" belum ada di en.json/zh.json (console "[i18n] belum diterjemahkan: Generik") |
| F03 | Sedang | ZH, ID (EN tampak wajar) | Pesan validasi server: Layanan, Kategori Transaksi, Pengguna, Perusahaan, Pengajuan Dana (item) | Nama atribut mentah: "type不能为空。", "role不能为空。", "label…", "slug…", "abbreviation…", "items.0.description不能为空。", "items.0.category_id…", "items.0.unit_price…"; di ID: "Type wajib diisi." | lang/zh/validation.php dan lang/id/validation.php, bagian attributes: tambah type, role, label, slug, abbreviation, items.*.description, items.*.category_id, items.*.unit_price (dan en bila ingin rapi) |
| F04 | Sedang | ZH, ID (EN kebetulan benar) | Halaman error 403 (staf membuka /admin/users) | "This action is unauthorized." di bawah judul 访问被拒绝 / Akses ditolak | Pesan bawaan Laravel (AuthorizationException) diteruskan ke halaman error; kunci "This action is unauthorized." belum ada di lang/id.json dan lang/zh.json, atau halaman error perlu memetakan pesan bawaan |
| F08 | Sedang | ID, EN, ZH | Invoice Berulang › tab Analitik | Sumbu X berbahasa Inggris tetap ("Jan Feb … May Aug Oct Dec", juga di sesi ID dan ZH) dan sumbu Y "Rp 0.0M" | resources/js/pages/recurring-invoices (komponen grafik analitik): nama bulan dan satuan dipatok, tidak memakai dateLocale()/t() |
| F10 | Sedang | EN, ZH | Pengaturan › Template PDF: daftar (judul kolom "Nama", "Diperbarui", "Status") dan editor Template Builder (lencana kanvas "Halaman pertama", "Tiap halaman", "Dinamis ⇕", "Setelah konten"; lencana panel properti "Halaman") | Tetap Indonesia di EN dan ZH | resources/js/pages/settings/pdf-templates/index.tsx:164,195 (header: literal), resources/js/pages/settings/pdf-templates/edit.tsx:1800-1801,2401 (literal di objek band/meta; yang di baris 562-585 sudah t()) |
| F13 | Sedang | EN (390 px) | Invoice, header halaman pada lebar 390 px | Tombol "Create Invoice" terpotong di tepi kanan layar; tab "Partially paid" terpotong; deskripsi bagian Profil Perusahaan terpotong elipsis | baris aksi PageHeader pada invoices/index.tsx: perlu flex-wrap atau ikon saja di lebar sempit |
| F05 | Rendah | ID, EN, ZH | Izin & Peran › judul grup modul | "Bank-accounts", "Profit-loss", "Recurring-invoices" (slug mentah berhuruf besar awal) | resources/js/pages/permissions (judul grup memakai CSS capitalize pada slug modul); perlu peta label modul seperti grup lain (交易类别, 客户) |
| F06 | Rendah | ID, EN, ZH | Kas & Bank › grafik Pemasukan vs Pengeluaran (sumbu Y) | "Rp 100jt", "Rp 80jt", … "Rp 1jt" (singkatan Indonesia "jt"; Dashboard sudah memakai "M"/"百万") | resources/js/pages/bank-accounts/components/account-charts.tsx:19 (template `Rp ${…}jt`), bandingkan resources/js/components/dashboard/cash-flow-chart.tsx:34 yang memakai t() |
| F07 | Rendah | ID, EN, ZH | Grafik ApexCharts (Kas & Bank, Invoice Berulang › Analitik) | aria-label Inggris bawaan pustaka: "bar chart with 2 data series: 收入, 支出", "donut chart with 6 data series" | konfigurasi ApexCharts (chart.accessibility / locale) di account-charts.tsx dan analitik invoice berulang |
| F09 | Rendah | ID, EN, ZH | Setiap Combobox (daftar pilihan cmdk) | aria-label "Suggestions" (bawaan cmdk) pada daftar pilihan | resources/js/components/ui/combobox.tsx / autocomplete.tsx: beri label pada <Command.List label={t(...)}> |
| F11 | Rendah | ZH (EN: judul "Tutorial: ringkasan" memakai nama modul Indonesia) | Dialog Tutorial (semua modul) | Pengendali pemutar berbahasa Inggris: "Pause video", "Mute sound", "Enter Fullscreen"; "Bab tutorial", "Tutorial Admin", tab peran "Staff"; judul tercampur "教程：ringkasan"; durasi "1 mnt 27 dtk" | resources/js/components/tutorial/* (tutorial-videos.tsx:14 durasi "mnt/dtk" literal; kontrol pemutar Remotion); isi panduan sendiri sengaja Indonesia (K3) |
| F12 | Rendah | ZH (juga EN, ID) | Izin & Peran › dialog Tambah Peran › pemilih ikon | title/aria-label berupa nama ikon mentah ("shield-check", "banknote", "briefcase", …) | resources/js/pages/permissions/index.tsx:285 (title={iconName}) |

Tidak ada temuan dengan prioritas Tinggi: tidak ada layar utama yang rusak atau seluruhnya berbahasa salah, dan tidak ada data yang tersimpan dalam bahasa yang salah.

## Console

- `[i18n] belum diterjemahkan`: hanya dua kunci: "Alamat" (F01) dan "Generik" (F02), keduanya di EN dan ZH.
- Peringatan non-bahasa: Radix "Missing `Description` or `aria-describedby`" (DialogContent, 285×); React "`<div>` cannot be a descendant of `<p>`" (hydration, 15×); lisensi Remotion (163×); respons 409 pada ganti bahasa dan 403/422 yang disengaja (staf membuka halaman admin, validasi kosong).
