# Pemeriksaan silang terjemahan Mandarin (zh → id)

> Disusun T2, 10 Nov 2026. Mitigasi K4 (belum ada penutur asli Mandarin). Pemeriksa adalah model bahasa, bukan penutur asli:
> hasil ini menangkap salah makna, info hilang, dan ketidakkonsistenan istilah, **bukan** kewajaran gaya bagi pembaca Tionghoa.
> Berkas yang diperiksa: `resources/js/locales/zh.json` (2169 kunci), `lang/zh.json` (421 kunci), glosarium v1.2.
> Tidak ada berkas kamus atau kode yang diubah.

## 1. Metode

1. **Terjemah-balik buta.** Nilai zh dicetak tanpa kunci Indonesianya, diterjemahkan balik ke Indonesia dari nol, baru dibandingkan dengan kunci.
2. **(a) Glosarium §2:** 322 baris (kolom 中文) diterjemahkan balik dan dicocokkan dengan kolom Indonesia. Tambahan otomatis: 313 kunci yang persis sama dengan istilah glosarium (atau `_menu`) dibandingkan dengan nilai di `zh.json`.
3. **(b) Sampel acak:** 150 kunci `locales/zh.json` + 50 kunci `lang/zh.json`.
   - **Seed `20261110`.**
   - PRNG mulberry32.
   - Kunci diurutkan alfabetis (`Array.sort()` bawaan), diacak Fisher-Yates dengan PRNG itu, lalu diambil N pertama (150 untuk frontend, 50 untuk server, seed sama).
   - Bisa diulang selama isi kamus tidak berubah.
4. **(c) Istilah berisiko tinggi (glosarium §5):** semua entri zh yang memuat salah satu dari: 增值税, PPN, PPh, PKP, NPWP, 代收, 筹资, 损益, 所得税, 税务, 应付借款, 应收借款, 开具, 金额大写, 预付款, 尾款, 营业成本, HPP, 业主, 借方, 贷方, 会计分录, 收付实现, 成本回收, 待催收, 备用金, 摘要, 税号, 计税, DPP, 税 → **258 entri** (197 frontend, 61 server), diterjemahkan balik buta lalu dibandingkan dengan kunci.
5. **Cek otomatis:**
   - huruf Latin sisa;
   - angka dan negasi hilang;
   - kunci yang sama (dinormalisasi) bernilai zh berbeda;
   - larangan kata dari glosarium (发票 selain 税务发票, 贷款, 融资, 应收账款, 零用金, 利润表, 活跃, 开票, 发布).

## 2. Hasil per golongan

### Sampel 200 entri (150 frontend + 50 server)

| Golongan | Jumlah |
|---|---|
| Cocok (sama setelah dinormalisasi: huruf kecil, tanda baca, tag) | 93 |
| Beda gaya (makna sama) | 107 |
| Beda makna | **0** pasti (3 perlu konteks, lihat T3, T4, T8) |
| Hilang info (placeholder, angka, negasi) | **0** |
| Tidak konsisten (dari sampel) | 0 (ditemukan lewat pemindaian penuh, §3) |

Contoh beda gaya yang wajar: "Masuk sebagai" → 当前登录身份; "Individu" → 个人 (dibaca "perorangan"); "Account Representative" → 税务专管员（AR）; "Misal: Budi Santoso" → 例如：张伟 (nama contoh dilokalkan, bagus).

### Seluruh glosarium (a)
- 322 baris diterjemahkan balik.
- Seluruhnya terbaca kembali ke istilah Indonesia yang dimaksud, atau ke salah satu pemetaan sengaja tidak harfiah di glosarium §4 (收入, 账单, 开具, 筹资, 摘要, dan seterusnya).
- Dari 313 kunci yang dicek langsung ke `zh.json`: 289 sama dengan glosarium, 24 berbeda. Semuanya karena konteks atau kunci bersama:
  - `Akun`: 账户 vs 科目
  - `Masuk`: 登录 vs 流入
  - `Utang`: 应付借款 vs 应付款
  - `Aktif`: 启用 vs 还款中
  - `Sisa`: 未付 vs 剩余
  - `Tebal`: 粗体 vs 线宽 (kunci berkonteks)
  - `Rekening sumber/tujuan`: 付款/收款账户 vs 转出/转入账户
  - `Pajak` dan `PPh`: 代收税款 (lihat T2)
  - `Angsuran`, `Referensi`, dan beberapa lain
- Tidak ada salah makna di sini.

### Istilah berisiko tinggi (c), 258 entri
- 0 salah makna.
- Pasangan simetris 应付借款/应收借款 (Utang/Piutang) konsisten di seluruh 100+ entri.
- 筹资 selalu disertai "不计入损益" atau "损益不变" (tidak pernah berdiri sendiri sebagai arus).
- 代收税款 vs 增值税 tidak tertukar.
- 开具 hanya dipakai untuk menerbitkan invoice, 转为账单 hanya untuk "Jadikan Invoice".
- Tidak ada 发票 selain 税务发票, juga tidak ada 贷款, 融资, 应收账款, 零用金, 利润表.
- Dua catatan kecil: T2 dan T3.

### Cek otomatis
- **Huruf Latin sisa:** 38 kunci, semuanya sah (merek, kode, tag, label UI Claude yang dikutip persis, contoh `例如：TRF-2026-1008`, nama bank).
- **Angka hilang:** nol yang sungguhan. 5 temuan semuanya reformulasi sah ("Nomor kembali ke 1" → 编号重置周期, "Bulan 2 digit" → 两位数月份).
- **Negasi hilang:** 6 temuan, semuanya terjemahan sah dengan kata lain (待实现利润, 停用, 关闭).
- **Placeholder:** tidak diperiksa ulang (sudah dijaga pemindai dan test).

## 3. Temuan (beda makna, hilang info, tidak konsisten)

Tingkat: **S** = sebaiknya diperbaiki, **R** = risiko makna bila kunci dipakai di konteks lain, **C** = kosmetik/konsistensi.

| # | Tingkat | Kunci | zh sekarang | Terjemah-balik | Usul zh | Alasan |
|---|---|---|---|---|---|---|
| T1 | R | Seluruh teks pembayaran invoice (82 entri): `Catat pembayaran`, `Pembayaran invoice`, `Sudah dibayar`, `Belum dibayar`, `Sisa tagihan`, `Invoice Belum Dibayar`, `Sebagian`, `Semua invoice sudah dibayar`, dan lainnya | 登记付款, 账单付款, 已付款, 未付款, 未付余额, 未付款账单, 部分付款 | catat pembayaran-keluar, tagihan dibayar, belum dibayar, sisa belum dibayar | Tetap (keputusan glosarium v1.2 "netral arah"); bila owner ingin tegas: invoice-saja → 收款 (`账单收款`, `未收款账单`, `未收余额`) lewat kunci berkonteks | Dalam akuntansi Tionghoa 付款 = perusahaan membayar, 收款 = perusahaan menerima. Layar invoice (klien membayar kita) terbaca "kita membayar". Keputusan sadar karena kunci bersama dengan reimbursement, tapi ini risiko salah baca terbesar di kamus. `Sisa tagihan` → 未付余额 paling berisiko: terbaca utang kita. |
| T2 | R | `Pajak`, `PPh` (kolom item tabel invoice / `item.is_tax_deposit` di penyusun template) | 代收税款 (keduanya) | titipan pajak | Tidak diubah sekarang; kunci bersama berisiko | Maksud: kolom flag titipan pajak, sehingga benar di konteks itu. Tetapi `Pajak` umum di glosarium = 税费 dan `PPh` = 所得税（PPh）. Bila `Pajak`/`PPh` dipakai di layar lain, zh-nya salah. Disarankan kunci berkonteks (`Pajak_titipan`). |
| T3 | C | `Account Representative` | 税务专管员（AR） | petugas pajak khusus (AR) | 税务客户经理（AR） atau `Account Representative（AR）` | 税务专管员 = jabatan administrasi pajak RRT yang sudah dihapus; menambah makna "pajak khusus". AR di KPP Indonesia = pegawai pajak pendamping wajib pajak. |
| T4 | C | `Cicilan` (frontend) vs `Cicilan` (server) | 分期 vs 部分付款 | angsuran vs bayar sebagian | Tidak perlu diubah (konteks berbeda) | Satu teks, dua makna. Hanya dicatat sebagai contoh kunci bersama. |
| T5 | C | `Buat …` | 新建 / 新增 / 创建 / 生成 bercampur: `Buat Invoice Berulang` → 新建定期账单 tetapi `Buat invoice berulang` → 新增定期账单; `Buat piutang/utang/klien/layanan` → 新增; `Buat reimbursement/Pengajuan` → 新建; `Buat perusahaan/kategori/template` → 创建 | membuat-baru, menambah, mencipta | Seragamkan sesuai glosarium (Buat → 新建; Tambah → 新增): minimal pasangan huruf besar/kecil T5-1 `Buat invoice berulang` → 新建定期账单 | Glosarium §2.6: Buat → 新建; Tambah → 新增. Kini 4 kata dipakai bergantian untuk satu kata Indonesia. Tidak salah makna. |
| T6 | C | `Kode URL *` vs `kode-url`/`Kode URL (permanen)` | URL 代码 * vs 网址代码 | kode URL | 网址代码 * | Glosarium: 网址代码（永久）. |
| T7 | C | `Cari nama...` vs `Cari nama…` | 搜索姓名… vs 搜索名称… | cari nama | Satu istilah (姓名 untuk orang, 名称 untuk entitas) | Pasangan kunci yang hanya beda `...` dan `…` bernilai beda. |
| T8 | C | `Ditransfer` (dialog Detail Transfer) | 转账金额 | jumlah transfer | 已转出金额 | Label "sudah ditransfer"; 转账金额 dekat dengan "Jumlah Transfer". Bukan salah. |
| T9 | C | `Selisih` | 净额 | bersih | 差额 | Glosarium memilih 净额 (masuk − keluar). Terjemah-balik "bersih" ≠ "selisih" tetapi sesuai keputusan. |
| T10 | C | Dokumen glosarium sisa v1.1 | `登记收款` di aturan Z2 (§1.3, baris 58); `common.php › rejected` → 已驳回 (baris ~705) | n/a | Perbarui contoh Z2 ke 登记付款; baris 705 ke 已拒绝 | Glosarium v1.2 sudah memindahkan 收款 → 付款 dan 驳回 → 拒绝, tapi dua baris lama belum diperbarui. Kamus sudah benar, dokumen yang usang. |

Catatan:
- **Klaim "收款" tidak ada di kamus bukan bug.** Glosarium v1.2 memutuskannya (T1).
- **Tag `<tautan>`, `<b>`, `<kode>` dan placeholder `{{…}}`/`:nama`** utuh di seluruh sampel dan di 258 entri berisiko.

## 4. Penilaian umum

Kamus zh **layak dipakai** untuk rilis awal, dengan satu syarat dan satu saran.

- **Mutu terjemahan.**
  - Dari 200 sampel acak dan 258 entri berisiko, tidak ada satu pun kesalahan makna, info hilang, atau placeholder rusak.
  - Terminologi pajak/akuntansi konsisten dan sesuai glosarium.
  - Terjemah-balik seluruh glosarium kembali ke istilah Indonesia yang dimaksud.
- **Risiko terbesar adalah T1** (arah pembayaran invoice). Ini keputusan tingkat produk, bukan salah ketik. Sebaiknya diputuskan owner / penutur asli sebelum rilis ke pengguna Tionghoa nyata.
- **Saran lanjutan.**
  - Seragamkan T5 (verba Buat).
  - Bereskan T6.
  - Segarkan dua baris glosarium usang (T10).
  - Bila ada peninjau penutur asli, minta ia menilai tiga hal: T1, T3, dan keterbacaan label ber-akronim ("增值税（PPN）").
- **Keterbatasan.** Pemeriksaan ini tidak menilai naturalness gaya, panjang label di layar sempit, atau konvensi antar-daerah (RRT vs Taiwan). Itu butuh penutur asli.

## 5. Status tindak lanjut (T1, 10 Nov 2026 · glosarium v1.3)

| # | Status | Tindakan |
|---|---|---|
| T1 | **Ditangani** | Aksi & catatan pembayaran invoice → 收款. Kunci khusus invoice cukup diganti nilainya (登记收款, 已登记收款 {{amount}} · 现金/转账, 收款 {{amount}} 已登记, 删除收款, 暂无收款记录, dst.). Kunci bersama diberi konteks `invoice` di `invoices/components/invoice-drawer.tsx` (`Catat pembayaran_invoice`, `Hapus pembayaran_invoice`, `Ubah pembayaran_invoice`, `Simpan pembayaran_invoice`, `Pembayaran_invoice`). Teks lain yang khusus pembayaran invoice (Arus Kas, Kas & Bank, Ringkasan, server) → 账单收款 / 收款. **Status & sisa invoice tetap** 已付款 / 未付款 / 部分付款 / 未付余额: konvensi status tagihan, dan kuncinya dipakai bersama di layar non-invoice (alasan lengkap: glosarium §3 *Bayar*, risiko #14). |
| T2 | Dicatat | Tidak diubah. `Pajak` dan `PPh` kini hanya dipakai untuk kolom penanda titipan pajak; catatan & saran konteks `Pajak_titipan` ada di glosarium §2.2 (baris *Titipan Pajak (PPh)*). |
| T3 | **Diperbaiki** | `Account Representative` → 税务客户经理（AR）; ikut diseragamkan `Nama AR` → 客户经理姓名, `No. HP AR` → 客户经理手机号. |
| T4 | Dibiarkan | Konteks berbeda (angsuran piutang vs status bayar reimbursement di server). |
| T5 | **Diperbaiki** | 12 label "Buat …" → 新建 (izin klien/layanan/akun Kas & Bank/invoice berulang/utang/piutang, perusahaan, kategori, "Buat {{count}} kategori", "Buat Template Pertama", "Buat Manual" → 手动新建). "Buat Draft", "Buat Sekarang", "Buat Ulang Favicon" (= menghasilkan) tetap 生成; kalimat deskripsi boleh 创建. |
| T6 | **Diperbaiki** | `Kode URL *` → 网址代码 *. |
| T7 | Dibiarkan | Keduanya sudah sesuai konteks: `Cari nama...` (penanggung jawab kas = orang) → 搜索姓名…; `Cari nama…` (peminjam = karyawan atau perusahaan) → 搜索名称…. |
| T8 | **Diperbaiki** | `Ditransfer` → 已转出金额. |
| T9 | Dibiarkan | Keputusan glosarium (净额 = masuk − keluar). |
| T10 | **Diperbaiki** | Contoh Z2 kini 登记收款（账单）, sah lagi sejak v1.3; baris `common.php › rejected` → 已拒绝. |
