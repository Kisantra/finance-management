# Panduan Koneksi Claude

> Untuk pemilik, admin, dan finance manager yang ingin mendiskusikan data keuangan perusahaan
> dengan Claude. Tidak perlu latar belakang teknis. Dokumentasi teknis untuk pengembang ada di
> [`docs/module/koneksi-claude.md`](../module/koneksi-claude.md).

## Apa ini

Koneksi Claude membuat Claude (claude.ai, aplikasi Claude Desktop, dan Claude di ponsel) bisa
**membaca** data dari aplikasi Kisantra Finance saat Anda bertanya di chat. Teknologinya bernama
**MCP** (Model Context Protocol): aplikasi menyediakan 15 "alat", dan Claude memilih alat yang
cocok untuk menjawab pertanyaan Anda, misalnya "berapa invoice yang lewat tempo bulan ini?".

| Bisa | Tidak bisa |
|------|-----------|
| Membaca invoice, pembayaran, rekening & mutasi, arus kas, laba rugi, klien, layanan, invoice berulang, reimbursement, pengajuan dana, utang, piutang | Menambah, mengubah, menghapus, menyetujui, atau membayar apa pun. Semua alat **hanya membaca**. |
| Membandingkan beberapa perusahaan dalam satu grup | Membaca perusahaan yang Anda bukan anggotanya |
| Menghitung, merangkum, membuat tabel, dan menjelaskan angka | Membuka berkas lampiran (bukti transfer, faktur). Claude hanya tahu ada atau tidaknya lampiran. |

Claude membaca data **dengan hak akses akun Anda**. Peran dengan izin terbatas akan mendapat
data yang sama terbatasnya dengan yang terlihat di aplikasi.

## Syarat

1. **Akun Claude yang bisa menambah *custom connector*.** Ketersediaannya berbeda per paket dan
   bisa berubah; cek langsung di Claude, **Settings › Connectors**, ada tidaknya tombol
   **Add custom connector**.
2. **Izin `use claude`** di perusahaan yang ingin dibaca. Bawaannya dimiliki peran **Admin** dan
   **Finance Manager**. Peran lain bisa diberi lewat **Administrasi › Izin & Peran** (bagian Claude).
3. **Server sudah disiapkan** (sekali saja, oleh admin server): blok `/.well-known` di vhost
   CloudPanel harus meneruskan permintaan ke aplikasi. Lihat [Mengatasi masalah](#mengatasi-masalah).
   Kunci keamanan OAuth **tidak perlu dibuat manual**: kunci dibuat otomatis saat pemegang izin
   `use claude` pertama kali membuka **Pengaturan › Koneksi Claude** (atau saat `./deploy.sh`).

## Menghubungkan (sekali saja)

1. Di aplikasi, buka **Pengaturan › Koneksi Claude**, lalu salin **alamat konektor**:
   `https://finance.kisantra.com/mcp/keuangan`. Bila muncul kotak hijau **"Server baru saja
   disiapkan"**, kunci OAuth baru saja dibuat dan koneksi siap dipakai. Bila muncul kotak oranye
   **"Server belum siap untuk Claude"**, berhenti di sini dan hubungi admin server (lihat
   [Mengatasi masalah](#mengatasi-masalah)).
2. Di Claude (web atau desktop), buka **Settings › Connectors › Add custom connector**.
3. Isi nama **Kisantra Finance**, tempel alamat konektor, lalu klik **Add**.
4. Klik **Connect**. Claude membuka halaman aplikasi:
   - bila belum masuk, login dengan akun Anda seperti biasa;
   - halaman **"Izinkan Claude membaca data keuangan?"** menampilkan akun Anda dan **daftar
     perusahaan yang akan terbaca**. Periksa, lalu klik **Izinkan**.
5. Anda kembali ke Claude dan konektor berstatus terhubung. Konektor yang ditambahkan lewat web
   umumnya ikut tersedia di aplikasi Claude ponsel dengan akun Claude yang sama.

Tombol **Izinkan** tidak muncul bila akun Anda belum punya izin `use claude` di perusahaan mana pun.

## Memakai di chat

1. Di chat, aktifkan konektor **Kisantra Finance** dari menu alat (ikon alat/konektor di kolom chat).
2. Bertanyalah seperti kepada staf keuangan. Claude memanggil `daftar-perusahaan` dulu untuk
   tahu perusahaan mana yang bisa dibaca, lalu alat lain sesuai pertanyaan.
3. Claude bisa meminta persetujuan sebelum memakai sebuah alat. Pilih izinkan (sekali atau
   selalu untuk alat itu).

**Supaya jawabannya tepat:**
- Sebut **perusahaan** bila Anda punya lebih dari satu, mis. "untuk PT Kinara".
- Sebut **periode**: "Oktober 2026", "kuartal ini", "1 Januari s.d. hari ini". Tanpa periode,
  tiap alat memakai bawaannya (lihat referensi alat).
- Minta Claude **menyebut sumber angkanya** (alat dan periode) bila angka itu dipakai untuk
  keputusan.
- Untuk daftar panjang, Claude membaca per halaman (25–50 baris). Minta "baca semua halaman"
  bila perlu seluruh data.

### Contoh pertanyaan

**Kas & saldo**
- "Berapa total saldo semua rekening hari ini, dan rekening mana yang paling besar?"
- "Uang masuk dan keluar bulan ini berapa? Kategori pengeluaran terbesar apa?"
- "Tampilkan mutasi rekening BCA minggu lalu yang di atas Rp 5 juta."

**Penjualan & tagihan**
- "Invoice mana saja yang lewat jatuh tempo, urutkan dari sisa terbesar."
- "Klien mana yang paling banyak menunggak, dan sudah berapa lama?"
- "Rincikan invoice 001/INV/KSN-ABC/XI/2026: item, PPN, pembayaran, dan laba kotornya."
- "Template invoice berulang mana yang drafnya bulan ini belum dibuat?"

**Laba rugi**
- "Buat ringkasan laba rugi Januari sampai Oktober 2026 dan bandingkan margin per kuartal."
- "Kenapa laba bersih Oktober turun dibanding September?"

**Operasional**
- "Reimbursement apa saja yang sudah disetujui tapi belum dibayar?"
- "Pengajuan dana bulan ini berapa total yang sudah dicairkan?"
- "Cicilan utang yang jatuh tempo bulan depan berapa? Ada yang terlambat?"
- "Kasbon karyawan mana yang masih aktif dan berapa sisanya?"

**Grup (beberapa perusahaan)**
- "Bandingkan saldo kas dan piutang usaha semua perusahaan saya dalam satu tabel."

## Yang perlu diketahui tentang angka

- **Nominal dalam rupiah penuh**, tanpa desimal. Tanggal berformat tahun-bulan-tanggal.
- **Dua arti "pemasukan".** Ringkasan memberi dua angka berbeda dengan nama berbeda:
  - `kas.uang_masuk / uang_keluar`: semua uang yang masuk/keluar rekening, termasuk transfer
    antar rekening sendiri dan pencairan pinjaman (sama dengan kartu Arus Kas di Ringkasan).
  - `pemasukan / pengeluaran`: hanya transaksi berkategori pemasukan/pengeluaran dan pembayaran
    invoice (sama dengan halaman Arus Kas).
- **Laba rugi berbasis kas**: pendapatan invoice diakui saat dibayar, setelah dikurangi titipan
  pajak dan PPN keluaran. Transaksi yang belum diberi kategori Laba Rugi muncul di
  `belum_diklasifikasi` dan **tidak masuk total mana pun**; selama masih ada, laba belum final.
- **Sisa tagihan klien** dihitung dari pembayaran yang benar-benar masuk dan tanpa draf. Kolom
  "outstanding" di halaman Klien ikut menghitung draf, jadi bisa lebih besar.
- **Reimbursement dan pengajuan dana**: tanpa izin menyetujui/membayar, Anda hanya melihat
  pengajuan sendiri. Claude menandainya dengan `cakupan: milik_sendiri`.

## Keamanan & privasi

- **Hanya membaca.** Tidak ada alat yang bisa mengubah data, sekalipun Claude diminta.
- **Mengikuti izin per perusahaan.** Setiap alat memeriksa ulang izin Anda di perusahaan yang
  diminta. Perubahan izin di Izin & Peran berlaku pada panggilan berikutnya.
- **Data yang dibaca masuk ke percakapan** dan diproses oleh Anthropic. Perlakukan percakapan
  itu seperti laporan keuangan: jangan dibagikan ke orang yang tidak berhak.
- **Masa berlaku**: token akses 1 jam (diperbarui otomatis); bila konektor tidak dipakai 30 hari,
  Claude meminta login dan persetujuan ulang.
- Setiap pembacaan data perusahaan dicatat di log aplikasi (siapa, perusahaan, alat, filter).

## Mencabut akses

1. Di aplikasi, buka **Pengaturan › Koneksi Claude**. Bagian **Sambungan aktif** menampilkan
   setiap klien yang pernah Anda izinkan.
2. Klik **Cabut** pada sambungan itu lalu konfirmasi. Claude langsung tidak bisa membaca lagi
   dan harus meminta izin ulang.
3. Bila tidak ingin memakainya lagi, hapus juga konektornya di Claude (**Settings › Connectors**).

Admin juga bisa menutup akses suatu peran dengan mencabut izin `use claude` di Izin & Peran.

## Mengatasi masalah

| Gejala | Penyebab & solusi |
|--------|-------------------|
| Saat Connect, Claude menampilkan **"Connecting to the server Not found 500"** atau sejenisnya | Kunci OAuth server belum ada. Buka **Pengaturan › Koneksi Claude** sekali dengan akun ber-izin `use claude`: kunci dibuat otomatis. Lalu di Claude klik **Connect** lagi pada konektor yang sudah ada; jangan menambah konektor kedua dan jangan klik "Continue anyway". |
| Pengaturan › Koneksi Claude menampilkan kotak oranye "Server belum siap untuk Claude" | Kunci gagal dibuat otomatis, biasanya karena folder `storage` tidak bisa ditulis. Admin server: dari folder aplikasi, sebagai user situs (bukan root), jalankan `php artisan passport:keys`, lalu buka ulang halaman itu. |
| Claude menolak menambah konektor: "A connector with this URL already exists" | Konektor dengan alamat yang sama sudah ada. Pakai yang lama: **Settings › Connectors**, pilih **Kisantra Finance**, lalu **Connect**. |
| Saat Connect, Claude gagal menemukan halaman login | Server belum meneruskan `/.well-known/...` ke aplikasi. Admin server: CloudPanel › Sites › domain › **Vhost**, pada blok `location ~ /.well-known {` tambahkan `try_files $uri $uri/ /index.php?$query_string;` lalu Save. Cek: `https://finance.kisantra.com/.well-known/oauth-authorization-server` harus menampilkan JSON. |
| Claude menjawab "belum ada perusahaan yang boleh dibaca" | Peran Anda belum punya izin `use claude` di perusahaan itu. Minta admin mengaktifkannya, lalu tanya lagi (tidak perlu menghubungkan ulang). |
| "Perusahaan ... tidak bisa dibaca ... tidak punya izin view ..." | Peran Anda di perusahaan itu tidak boleh melihat modul tersebut. Sama dengan di aplikasi. |
| Claude meminta login lagi | Sambungan dicabut atau tidak dipakai lebih dari 30 hari. Klik Connect dan Izinkan lagi. |
| Angka berbeda dengan halaman aplikasi | Periksa periode dan definisi (lihat [Yang perlu diketahui tentang angka](#yang-perlu-diketahui-tentang-angka)). Minta Claude menyebut alat dan periode yang dipakai. |
| Bagian ringkasan hilang | Lihat `tidak_ditampilkan`: bagian itu butuh izin modul yang tidak dimiliki peran Anda. |

---

## Referensi alat

Anda tidak perlu memanggil alat sendiri; Claude yang memilih. Bagian ini menjelaskan apa yang
bisa ditanyakan, filter yang bisa Anda sebut dalam kalimat biasa, dan isi jawabannya.

Aturan umum semua alat:
- Semua alat kecuali `daftar-perusahaan` butuh **kode perusahaan** (mis. `utama`) dan izin
  `use claude` + izin modul di perusahaan itu.
- Daftar dibagi per **halaman**. **Ringkasan dan total selalu menghitung seluruh data yang cocok
  dengan filter**, bukan hanya halaman yang sedang dibaca.
- Status dikirim dalam kode aslinya beserta labelnya dalam bahasa Indonesia.

| Alat | Kegunaan singkat | Izin modul |
|------|------------------|------------|
| [`daftar-perusahaan`](#daftar-perusahaan) | Perusahaan yang boleh dibaca | — |
| [`ringkasan-keuangan`](#ringkasan-keuangan) | Gambaran keuangan satu periode | `view dashboard` |
| [`laba-rugi`](#laba-rugi) | Laporan laba rugi | `view profit-loss` |
| [`rekening-bank`](#rekening-bank) | Rekening & saldo | `view bank-accounts` |
| [`mutasi-rekening`](#mutasi-rekening) | Uang masuk/keluar per transaksi | `view bank-accounts` |
| [`kategori-transaksi`](#kategori-transaksi) | Pohon kategori | `view categories` |
| [`daftar-invoice`](#daftar-invoice) | Invoice & tagihan | `view invoices` |
| [`detail-invoice`](#detail-invoice) | Rincian satu invoice | `view invoices` |
| [`daftar-klien`](#daftar-klien) | Klien & tunggakannya | `view clients` |
| [`daftar-layanan`](#daftar-layanan) | Katalog layanan | `view services` |
| [`invoice-berulang`](#invoice-berulang) | Template & draf berulang | `view recurring-invoices` |
| [`daftar-reimbursement`](#daftar-reimbursement) | Penggantian biaya karyawan | `view reimbursements` |
| [`daftar-pengajuan-dana`](#daftar-pengajuan-dana) | Permintaan dana operasional | `view fund requests` |
| [`daftar-utang`](#daftar-utang) | Utang perusahaan (menu Utang) | `view loans` |
| [`daftar-piutang`](#daftar-piutang) | Pinjaman yang diberikan perusahaan | `view receivables` |

### `daftar-perusahaan`

Perusahaan yang datanya boleh Anda baca lewat Claude. Claude memanggilnya pertama kali.

- **Contoh:** "Perusahaan mana saja yang bisa kamu baca?"
- **Filter:** tidak ada.
- **Jawaban:** nama Anda, lalu per perusahaan: kode (dipakai alat lain), nama, singkatan, dan
  peran Anda di sana. Bila kosong, ada catatan cara meminta izin.

### `ringkasan-keuangan`

Gambaran keuangan satu periode dalam sekali baca.

- **Contoh:** "Ringkas keuangan bulan ini." · "Bagaimana posisi keuangan kuartal 3?"
- **Filter:** periode `dari`–`sampai` (bawaan: bulan berjalan).
- **Jawaban** (tiap bagian hanya bila Anda punya izin modulnya):
  - `kas`: total saldo saat ini (dirinci rekening bank dan kas tunai), jumlah rekening, uang
    masuk/keluar periode, arus bersih;
  - `pemasukan` / `pengeluaran`: total periode + 5 kategori terbesar + "Lainnya";
  - `invoice`: belum dibayar, lewat tempo, 5 jatuh tempo terdekat;
  - `piutang`: aktif, lewat tempo, menunggu persetujuan, jatuh tempo terdekat;
  - `utang`: aktif dan sisa pokok, jatuh tempo terdekat;
  - `reimbursement`, `pengajuan_dana`: antrean yang menunggu ditinjau/dibayar/dicairkan;
  - `tidak_ditampilkan`: bagian yang disembunyikan beserta izin yang dibutuhkan.
- **Catatan:** invoice, piutang, utang, dan antrean pengajuan adalah posisi hari ini, tidak
  ikut periode.

### `laba-rugi`

Laporan laba rugi, sama dengan **Laporan › Laba Rugi** di aplikasi.

- **Contoh:** "Laba rugi Januari s.d. Oktober?" · "Berapa margin laba kotor tahun ini?"
- **Filter:** periode `dari`–`sampai` (bawaan: 1 Januari tahun berjalan s.d. hari ini).
- **Jawaban:** pendapatan (dari invoice + per kategori), HPP, laba kotor, beban operasional,
  laba usaha, pendapatan & beban lain, laba sebelum pajak, pajak, laba bersih;
  `ppn_keluaran_diterima` (catatan, bukan pendapatan); `belum_diklasifikasi` + peringatan bila
  ada transaksi yang belum masuk Laba Rugi.

### `rekening-bank`

Semua akun **Kas & Bank** (rekening bank dan kas tunai / kas kecil) beserta saldo saat ini.

- **Contoh:** "Saldo tiap rekening berapa?" · "Kas kecil mana yang perlu diisi ulang?"
- **Filter:** tidak ada.
- **Jawaban:** total saldo (beserta total bank dan total kas), jumlah rekening, lalu per akun:
  id, jenis (`bank` / `kas`), nama, bank, nomor, cabang, saldo awal, saldo sekarang; untuk kas
  juga penanggung jawab, plafon, dan kekurangan dari plafon. Akun kas bernama bank "Tunai" dengan
  nomor berupa kode KAS-xxxx. Saldo = saldo awal + pembayaran invoice masuk + transaksi masuk −
  transaksi keluar.

### `mutasi-rekening`

Uang masuk dan keluar per transaksi (transaksi bank + pembayaran invoice), seperti mutasi rekening.

- **Contoh:** "Pengeluaran rekening Mandiri bulan lalu apa saja?" · "Cari transaksi dengan
  keterangan 'sewa' tahun ini."
- **Filter:**

  | Filter | Isi |
  |--------|-----|
  | `rekening` | id rekening (dari `rekening-bank`); kosong = semua rekening |
  | `arah` | `masuk` atau `keluar` |
  | `kategori` | id kategori (dari `kategori-transaksi`); kategori induk ikut menyertakan sub-kategorinya |
  | `kata_kunci` | keterangan, nomor referensi, nomor invoice, nama klien |
  | `dari`, `sampai` | periode (bawaan: bulan berjalan) |
  | `halaman`, `per_halaman` | bawaan 25 baris, maks. 50 |

- **Jawaban:** saldo awal & akhir periode, total masuk/keluar/bersih dan per jenis untuk seluruh
  hasil filter, lalu per mutasi: tanggal, arah, jumlah, rekening, jenis, kategori, keterangan,
  invoice/klien (untuk pembayaran), referensi, rekening pasangan & biaya admin (untuk transfer),
  dan tanda ada lampiran.
- **Catatan:** tanpa filter rekening, satu transfer antar rekening sendiri muncul di masuk **dan**
  keluar. Jenis `financing` = pokok pinjaman/piutang (bukan pendapatan/beban).

### `kategori-transaksi`

Pohon kategori transaksi (induk → sub) dan posisinya di Laba Rugi.

- **Contoh:** "Kategori pengeluaran apa saja yang ada?" · "Kategori mana yang belum masuk Laba Rugi?"
- **Filter:** `jenis` = `income` (pemasukan), `expense` (pengeluaran), `financing` (pendanaan),
  `transfer`, `adjustment` (penyesuaian).
- **Jawaban:** jumlah kategori, jumlah transaksi belum diklasifikasi, arti tiap jenis dan grup
  Laba Rugi, lalu pohon kategori: id, label, jenis, grup Laba Rugi, kode sistem.

### `daftar-invoice`

Daftar invoice dengan total, dibayar, sisa, dan keterlambatan.

- **Contoh:** "Invoice yang lewat jatuh tempo?" · "Invoice ke PT Contoh Jaya tahun ini?" ·
  "10 invoice dengan sisa terbesar."
- **Filter:**

  | Filter | Isi |
  |--------|-----|
  | `status` | `draft` (belum dikirim), `sent` (terkirim), `partially_paid` (dibayar sebagian), `paid` (lunas) |
  | `lewat_tempo` | ya = hanya yang lewat jatuh tempo; tidak = tanpa yang lewat jatuh tempo |
  | `klien` | nama (cocok sebagian) atau id klien |
  | `dari`, `sampai` | tanggal terbit; tanpa ini = semua periode |
  | `kata_kunci` | nomor invoice atau nama klien |
  | `urut` | `terbaru` (bawaan), `terlama`, `jatuh_tempo`, `sisa_terbesar`, `total_terbesar` |
  | `halaman`, `per_halaman` | bawaan 25 baris, maks. 50 |

- **Jawaban:** per invoice: id, nomor (kosong untuk draf), klien, tanggal terbit & jatuh tempo,
  total, dibayar, sisa, status, hari lewat tempo. Ringkasan: jumlah, total, dibayar, sisa, belum
  dibayar (tanpa draf), lewat tempo, dan draf.
- **Catatan:** lewat tempo = terkirim/dibayar sebagian yang jatuh temponya sudah lewat (tab "Perlu
  ditagih" di aplikasi).

### `detail-invoice`

Rincian lengkap satu invoice.

- **Contoh:** "Rincikan invoice 003/INV/KSN-YPM/XI/2026."
- **Filter:** `nomor` (nomor invoice persis) **atau** `id` (wajib untuk draf yang belum bernomor).
- **Jawaban:** status & tanggal, klien (nama, jenis, NPWP, email, alamat), item (layanan, qty,
  satuan, harga, jumlah, HPP, titipan pajak), nilai (subtotal, diskon, titipan pajak, DPP, tarif &
  nominal PPN, total, dibayar, sisa), laba (pendapatan, HPP, laba kotor), dan pembayaran (tanggal,
  nominal, rekening, metode, referensi, nama berkas lampiran).
- **Catatan:** laba kotor dihitung seperti drawer invoice di aplikasi: pendapatan tanpa PPN dan
  tanpa titipan pajak, dikurangi HPP item non-titipan.

### `daftar-klien`

Klien beserta rekap tagihannya.

- **Contoh:** "Klien mana yang paling banyak menunggak?" · "Data NPWP dan PIC PT Contoh Jaya."
- **Filter:**

  | Filter | Isi |
  |--------|-----|
  | `kata_kunci` | nama, email, atau NPWP |
  | `jenis` | `individual` (perorangan) atau `company` (perusahaan) |
  | `status` | `Active` atau `Inactive` |
  | `ada_sisa` | ya = hanya yang masih punya sisa tagihan |
  | `urut` | `nama` (bawaan), `sisa_terbesar`, `ditagih_terbesar` |
  | `halaman`, `per_halaman` | bawaan 25 baris, maks. 50 |

- **Jawaban:** per klien: id, nama, jenis, status, NPWP, PIC, email, jumlah invoice terbit,
  ditagih, dibayar, sisa, sisa lewat tempo, draf; plus ringkasan. Data sensitif pajak (EFIN, dll.)
  tidak dikirim.

### `daftar-layanan`

Katalog layanan/produk.

- **Contoh:** "Layanan apa saja dan berapa harganya?"
- **Filter:** `kata_kunci` (nama), `jenis` (Perizinan, Administrasi Perpajakan, Digital
  Marketing, Sistem Digital), `halaman`, `per_halaman` (bawaan 50).
- **Jawaban:** per layanan: id, nama, jenis, harga, tanggal dibuat; ringkasan katalog (jumlah,
  harga rata-rata/tertinggi, per jenis) untuk seluruh katalog.
- **Catatan:** harga katalog hanya acuan; harga di invoice bisa diubah saat invoice disusun.

### `invoice-berulang`

Invoice berulang (recurring): template dan draf bulanannya.

- **Contoh:** "Template mana yang drafnya belum dibuat bulan ini?" · "Draf berulang November yang
  belum dipublish?"
- **Filter:**

  | Filter | Isi |
  |--------|-----|
  | `tampilan` | `template` (bawaan) atau `bulanan` (otomatis bila `bulan`/`status` diisi) |
  | `status_template` | `active`, `inactive`, `archived` (khusus template) |
  | `bulan` | YYYY-MM, bawaan bulan ini (khusus bulanan) |
  | `status` | `draft` atau `published` (khusus bulanan) |
  | `halaman`, `per_halaman` | bawaan 50 |

- **Jawaban:** template: klien, frekuensi, nilai, masa berlaku, status, progres siklus, bulan
  berikutnya yang drafnya belum dibuat, bulan terlewat. Bulanan: draf/yang sudah dipublish beserta
  invoice hasilnya, plus ringkasan bulan.
- **Catatan:** nilai template belum termasuk PPN dan titipan pajak. Draf dibuat dan dipublish
  manual di aplikasi.

### `daftar-reimbursement`

Penggantian biaya yang sudah dikeluarkan karyawan.

- **Contoh:** "Reimbursement yang sudah disetujui tapi belum dibayar?" · "Total reimbursement Budi
  bulan ini?"
- **Filter:** `status` (`draft`, `pending` menunggu review, `approved` disetujui, `rejected`
  ditolak, `paid` lunas), `dari`/`sampai` (tanggal pengeluaran), `pemohon`, `kata_kunci` (judul,
  keterangan, kategori), `halaman` (50 baris).
- **Jawaban:** per pengajuan: pemohon, kategori, nominal, sudah dibayar, sisa, status, tanggal,
  peninjau, catatan tinjauan, ada bukti. Ringkasan: jumlah, nominal, dibayar, menunggu dibayar, dan
  per status. `cakupan` = `semua` atau `milik_sendiri`.
- **Catatan:** tanpa izin approve/pay reimbursements, hanya pengajuan Anda sendiri.

### `daftar-pengajuan-dana`

Permintaan dana operasional sebelum dipakai (dicairkan per item dari rekening).

- **Contoh:** "Pengajuan dana yang menunggu persetujuan?" · "Berapa yang sudah dicairkan bulan ini?"
- **Filter:** `status` (`draft`, `pending`, `approved`, `rejected`, `disbursed` sudah dicairkan),
  `dari`/`sampai` (tanggal dibuat), `pemohon`, `kata_kunci` (judul, tujuan, nomor), `halaman`.
- **Jawaban:** per pengajuan: nomor, pemohon, prioritas, total, jumlah item, status, tanggal
  dibutuhkan, peninjau, dan pencairan (tanggal, rekening, oleh siapa). Ringkasan per status;
  `cakupan`.
- **Catatan:** tanpa izin approve fund requests, hanya pengajuan Anda sendiri.

### `daftar-utang`

Utang perusahaan (menu **Utang**): pinjaman yang **diterima** dari bank atau pihak lain.

- **Contoh:** "Cicilan utang bulan depan berapa?" · "Ada angsuran yang terlambat?"
- **Filter:** `status` (`active` berjalan, `paid_off` lunas), `kata_kunci` (nomor atau pemberi
  pinjaman), `halaman`.
- **Jawaban:** per utang: pemberi, pokok, jenis & tarif bunga, total bunga, tenor, mulai &
  jatuh tempo, dibayar, sisa pokok & bunga, dan jadwal (jumlah termin, termin lunas, termin
  berikutnya beserta angsurannya, termin terlambat, tunggakan). Ringkasan per status dan sisa
  pokok utang aktif.
- **Catatan:** jadwal adalah rencana dari pokok, bunga, dan tenor; pembayaran dialokasikan ke
  termin paling awal.

### `daftar-piutang`

Pinjaman yang **diberikan** perusahaan kepada karyawan (kasbon) atau klien.

- **Contoh:** "Kasbon karyawan yang masih aktif?" · "Piutang ke klien yang lewat tempo?"
- **Filter:** `status` (`draft`, `pending_approval`, `active`, `paid_off`, `rejected`), `jenis`
  (`employee_loan` kasbon karyawan, `company_loan` pinjaman ke klien), `debitur` (nama), `halaman`.
- **Jawaban:** per piutang: debitur (nama, karyawan/klien), pokok, bunga, cicilan, dibayar, sisa,
  status, jadwal (termin berikutnya, terlambat, tunggakan), peninjau. Ringkasan per status, sisa
  pokok aktif, dan yang lewat tempo.
