# Glosarium terjemahan ID → EN → 中文 (zh-CN)

> **Status:** v1.3, 10 Nov 2026. Disusun T1 (penerjemah Mandarin) untuk fitur multi bahasa (`fitur/multi-bahasa`).
> **v1.1:** kolom Indonesia mengikuti [`perapian-id.md`](perapian-id.md) (teks Indonesia dirapikan sebelum kamus dibuat).
> **v1.2:** pilihan yang berubah atau bertambah saat kamus `resources/js/locales/zh.json` diisi bertanda **[zh v1.2]**.
> Sebabnya hampir selalu **kunci bersama**: satu teks Indonesia dipakai beberapa layar dengan makna berbeda, padahal kamus
> hanya memberi satu terjemahan per kunci. Istilah baru (penyusun template PDF, penomoran, utang/piutang, Claude) ada di §2.8;
> pilihan untuk teks server (`lang/zh.json`, `validation.php`, `feedback.php`) di §2.9.
> **v1.3:** tindak lanjut [`pemeriksaan-silang-zh.md`](pemeriksaan-silang-zh.md), bertanda **[zh v1.3]**. Aksi & catatan pembayaran
> invoice → 收款 (kunci bersama diberi konteks `invoice` di `pages/invoices/**`), status invoice tetap 已付款/未付款/部分付款
> (§3 *Bayar*); AR → 税务客户经理; label "Buat …" diseragamkan ke 新建.
> Entri yang istilah Indonesianya berubah bertanda **[baku baru]** beserta ID perapiannya.
> **Belum ditinjau penutur asli Mandarin.** Setiap pilihan istilah pajak/akuntansi diberi alasan dan rujukan,
> supaya pemeriksa terjemah-balik (T2) dan peninjau kelak bisa menilai, bukan menebak.
>
> **Dipakai oleh:** T2 (kamus `en`), T1 (kamus `zh`), E1–E4 (bila ragu memilih kata saat membungkus teks).
> **Rujukan baku Mandarin:** 《企业会计准则》及应用指南（会计科目表）、《小企业会计准则》、《中华人民共和国增值税法》(2024)、
> GB/T 15834-2011《标点符号用法》、GB/T 15835-2011《出版物上数字用法》. Istilah pajak Indonesia mengikuti UU PPN/PPh dan PP 55/2022.

## 0. Cara memakai

1. Kunci terjemahan = teks Indonesia persis (K1). Glosarium ini menetapkan **istilah**, bukan kalimat. Kalimat utuh boleh disusun ulang.
2. Urutan prioritas bila ada yang bertentangan: **§1 aturan gaya** → **§3 kata ambigu** → **§2 tabel istilah**.
3. Satu konsep, satu istilah. Jangan bervariasi demi gaya (mis. jangan berganti-ganti 账户/帐户/户头).
4. Istilah yang belum ada di sini: pilih padanan baku, lalu laporkan ke T1 agar ditambahkan. Jangan mengarang istilah pajak.
5. **[baku baru]** Kata Inggris di teks sumber sudah dirapikan lewat [`perapian-id.md`](perapian-id.md). Yang tersisa hanya serapan yang sengaja dibiarkan (Invoice, Reimbursement, Draft, Template, File, Email, …; lihat §6 dokumen itu). Terjemahkan maknanya seperti biasa; kuncinya tetap teks sumber apa adanya.

---

## 1. Aturan gaya

### 1.1 Berlaku untuk EN dan ZH

| # | Aturan | Rincian |
|---|---|---|
| U1 | **Jangan diterjemahkan** | Merek & produk: Kisantra, Kisantra Finance, Claude, Anthropic, Watchpost, nama template PDF (Kisantra, Semesta, AGSA). Nama bank & dompet digital (BCA, BRI, Mandiri, Bank Jago, GoPay…). Kode & nomor: `KAS-0001`, `LOAN-00001`, `RCV-00001`, `TRF…`, nomor invoice. Token penomoran `{NO}` `{PT}` `{KLIEN}` `{BLN_ROMAWI}` `{BLN}` `{THN}` `{THN2}`. Format & teknis: PDF, Excel, JPG, PNG, MB, OAuth, URL, `POST`/`DELETE`, tombol keyboard (Ctrl+Enter, Esc). Nama bahasa di pemilih (Indonesia, English, 中文) tetap endonim. |
| U2 | **Label UI aplikasi lain** | Teks yang mengutip tombol/menu Claude.ai (`Settings › Connectors`, `Add custom connector`, `Connect`) dibiarkan persis. Pengguna akan mencarinya di layar Claude.ai yang berbahasa Inggris. |
| U3 | **Placeholder & tag** | `{{nama}}` (i18next), `<1>…</1>` (`<Trans>`), dan `:attribute` (Laravel) harus identik: nama sama, jumlah sama, pasangan tag utuh. Posisinya boleh dipindah. Isi di dalam tag diterjemahkan. Jangan menambah atau membuang placeholder. |
| U4 | **Rupiah & angka** | Nominal tetap `Rp 1.500.000` (format Indonesia, D6). Desimal yang tertulis langsung di teks juga tetap format Indonesia (`0,5%`), supaya sama dengan angka keluaran formatter di layar yang sama (lihat risiko #18). `%` menempel pada angka. |
| U5 | **Tanggal** | Jangan menulis nama bulan/hari di dalam terjemahan. Tanggal dirangkai helper (`formatTanggal()`/`dateLocale()`), lalu disisipkan lewat placeholder. |
| U6 | **Data vs label** | Yang diterjemahkan hanya **label**. Yang tidak: nama kategori (termasuk kategori template seperti "Setor PPN", "Gaji Karyawan"), nama klien/rekening/layanan, peran buatan pengguna, deskripsi tersimpan (D8: "Transfer masuk - …", "Pembayaran pokok pinjaman - …", "Pembayaran piutang pokok: …"), nilai `Tunai` sebagai nama bank akun kas, kode izin mentah (`view invoices`). |
| U7 | **Akronim pajak/akuntansi Indonesia** (PPN, PPh, PKP, NPWP, DPP, HPP) | Terjemahan bekerja per kunci, jadi "kemunculan pertama di layar" diwujudkan begini. Pada **label pembuka** (label field, judul kolom, judul kartu/bagian, opsi pilihan, menu, tab) tulis istilah sasaran + akronim asli dalam kurung: ZH `增值税（PPN）`, EN `VAT (PPN)`. Pada **kalimat, toast, hint, badge, dan sel tabel** cukup istilah sasaran: ZH `增值税`, EN `VAT`. Pesan yang berdiri sendiri (error, notifikasi) memakai bentuk berkurung sekali di kalimat itu. Di ZH akronim tidak pernah berdiri sendiri tanpa istilah Mandarin. Akronim dipertahankan karena PDF/Excel tetap berbahasa Indonesia (K2): pengguna perlu mencocokkan layar dengan dokumen. |
| U8 | **Sumber tidak konsisten** | Varian yang sudah diketahui disatukan lewat `perapian-id.md`. Bila masih ada dua kunci sumber yang berbeda hanya karena kapital/ejaan, terjemahannya memakai istilah sasaran yang sama. EN tetap mengikuti kapital masing-masing kunci. |
| U9 | **Jamak** | EN: `_one`/`_other`. ZH & ID: satu bentuk. Ikuti format sufiks kunci yang ditetapkan pilot A2; aturan jamak i18next untuk `zh` hanya mengenal `other`. |

### 1.2 English

| # | Aturan |
|---|---|
| E1 | Ejaan US (color, canceled, organization). Istilah akuntansi umum internasional: Revenue, COGS, Gross profit, Operating expenses, Net profit. Untuk "Laba" pakai **profit**, bukan *income*, supaya satu akar dengan *Profit & Loss*. |
| E2 | Kapitalisasi mengikuti pola sumber per kunci. Sumber Title Case → Title Case ("Nomor Referensi" → "Reference Number"). Sumber kalimat → sentence case ("Nomor referensi" → "Reference number"). Dalam Title Case, kata sandang/preposisi/konjungsi pendek (a, an, the, of, in, to, for, and, or) ditulis kecil kecuali di awal. |
| E3 | Tombol memakai kata kerja imperatif ("Save", "Record payment"). Toast sukses: "Category deleted." Toast gagal: "Couldn't delete debt." Keadaan kosong: "No debts yet" / "No matching requests". |
| E4 | "Anda" → *you/your*. Hindari *Please* kecuali instruksi wajib. Kontraksi boleh di toast & keadaan kosong; pesan validasi tanpa kontraksi. |
| E5 | Teks EN rata-rata 20–40% lebih panjang. Untuk tombol dan pil yang sempit, pilih padanan terpendek di tabel. QA A1 memeriksa 390 px. |

### 1.3 中文 (zh-CN)

| # | Aturan | Contoh |
|---|---|---|
| Z1 | Aksara sederhana, kosakata daratan Tiongkok. Bukan bentuk Taiwan/HK: 账户 (bukan 帳戶/户口), 默认 (bukan 預設), 文件 (bukan 檔案), 链接 (bukan 連結). | — |
| Z2 | Register sopan-ringkas: 您, bukan 你. Tanpa tanda seru di UI biasa. Tombol 2–4 aksara berawal kata kerja. | 保存、提交、登记收款（账单, **[zh v1.3]**） |
| Z3 | **Tanda baca lebar penuh** di kalimat Mandarin: `，` `。` `：` `；` `！` `？` `（）`. Pencacahan memakai `、`. Kutip `“ ”` (dalam kutip `‘ ’`). **Jangan** `「」` (gaya Taiwan/HK/Jepang). | 文件格式：PDF、JPG、PNG |
| Z4 | Kurung selalu lebar penuh `（）`, termasuk yang berisi akronim Latin atau `%`. | 增值税（PPN）、税率（%） |
| Z5 | Titik `。` hanya bila sumber berakhir titik. Label, judul, dan tombol tanpa titik. | 类别已删除。 |
| Z6 | Elipsis UI memakai satu karakter `…` (U+2026), mengikuti sumber. `...` di sumber → `…`. Bukan `……` (terlalu panjang untuk placeholder). | 搜索申请… |
| Z7 | Pemisah UI `·` `›` `→` `—` `/` dipertahankan persis seperti sumber, termasuk spasinya. Penanda wajib ` *` dipertahankan. `&` pada label → 与. Tanda `+`/`−` di rumus tetap. | 现金与银行；收入 + 筹资 |
| Z8 | **Spasi (DIPILIH: pakai spasi).** Satu spasi setengah lebar di antara aksara Han dan huruf Latin, angka, atau placeholder yang menghasilkan angka/Latin/data. Tidak ada spasi di sebelah tanda baca lebar penuh. Tidak ada spasi di sekitar placeholder yang menghasilkan label Mandarin terjemahan (mis. `{{module}}`, `{{status}}`). Konsisten dengan gaya UI zh-CN Apple/Microsoft. | 删除 {{count}} 笔交易？ · PDF 模板 · Claude 连接 · 请在{{module}}中管理 |
| Z9 | Kata penggolong untuk hitungan: lihat tabel Z9 di bawah. | {{count}} 张账单 |
| Z10 | Pola kalimat baku: lihat tabel Z10 di bawah. | — |

**Contoh lengkap (Z3–Z8):**

| Sumber | 中文 |
|---|---|
| `Pendanaan: saldo {{account}} bertambah {{amount}}, Laba Rugi tidak berubah.` | `筹资：{{account}} 余额增加 {{amount}}，损益不变。` |
| `Hapus {{count}} transaksi?` | `删除 {{count}} 笔交易？` |
| `{{count}} invoice terbit · tanpa draft` | `{{count}} 张已开具账单 · 不含草稿` |
| `Melebihi sisa tagihan {{amount}}. Catat kelebihan sebagai transaksi terpisah.` | `超出未付余额 {{amount}}。请将超出部分另行登记为一笔交易。` |
| `Tagih PPN {{rate}}%` | `收取增值税（PPN）{{rate}}%` |
| `Hanya-lihat · <1>kelola di {{module}}</1>` | `仅查看 · <1>请在{{module}}中管理</1>` |

**Tabel Z9 — kata penggolong**

| Benda | Penggolong | Contoh |
|---|---|---|
| invoice / 账单 | 张 | {{count}} 张账单 |
| transaksi, pembayaran, transfer, utang, piutang | 笔 | 删除 {{count}} 笔交易？ |
| pengajuan (reimbursement, pengajuan dana) | 份 | {{count}} 份申请 |
| notifikasi, masukan, catatan | 条 | {{count}} 条通知 |
| pengguna, anggota | 名 | {{count}} 名用户 |
| kategori, rekening, peran, template | 个 | {{count}} 个类别 |
| perusahaan **[zh v1.2]** | 家 | 每家公司 · 共 {{total}} 家公司 |
| item invoice / item biaya | 项 | {{count}} 项明细 |
| baris tabel | 行 | 第 {{n}} 行 |
| termin angsuran | 期 | 第 {{n}} 期 |
| hari / bulan (durasi) / tahun | 天 / 个月 / 年 | {{n}} 天 |
| digit | 位 | 最少 {{n}} 位 |

**Tabel Z10 — pola kalimat** (`[X]` = istilah Mandarin, jadi tanpa spasi)

| Pola sumber | Pola 中文 | Contoh |
|---|---|---|
| X berhasil disimpan / dihapus / diperbarui. | [X]已保存 / 已删除 / 已更新。 | 类别已删除。 |
| X dicatat / diajukan / disetujui | [X]已登记 / 已提交 / 已批准 | 应付借款已登记 |
| X gagal disimpan / dihapus | 保存 / 删除[X]失败 | 删除应付借款失败 |
| Hapus X ini? | 删除此[X]？ (untuk uang: 删除这笔[X]？) | 删除这笔应付借款？ |
| Belum ada X | 暂无[X] | 暂无交易 |
| Tidak ada X yang cocok | 没有符合条件的[X] | 没有符合条件的申请 |
| Cari X… | 搜索[X]… | 搜索应收借款… |
| Semua X (pilihan filter) | 全部[X] | 全部账户 |
| Pilih X (placeholder) / pesan validasi | 选择[X] / 请选择[X]。 | 请选择账户。 |
| X (opsional) | [X]（可选） | 参考编号（可选） |
| X wajib diisi. | [X]不能为空。 | 金额不能为空。 |
| Memuat… / Menyimpan… | 加载中… / 保存中… | — |

---

## 2. Tabel istilah

Kolom **Catatan/alasan**: "dipakai ulang" = pilihan dari berkas `lang/zh` lama yang dipertahankan. "Ganti lama" = pilihan lama yang diganti, beserta alasannya. Ringkasan penggantian ada di §7.

### 2.1 Akuntansi umum

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Debit (sisi jurnal) | Debit | 借方 | Pembukuan berpasangan PRC (借贷记账法). Kepala kolom "Debit (Rp)" → 借方（Rp）. **Hanya untuk sisi jurnal.** "debit" dalam arti uang keluar dari rekening: lihat §3 *Debit/Kredit*. |
| Kredit (sisi jurnal) | Credit | 贷方 | Idem. "Kredit (Rp)" → 贷方（Rp）. |
| didebit / dikredit | debited / credited | 借记 / 贷记 | "akun yang didebit dan dikredit" → 借记和贷记的科目. |
| Jurnal | Journal | 会计分录 | Kotak JournalBox memuat satu entri debit/kredit, yaitu 会计分录. Bukan 日记账 (= buku jurnal). "Jurnal · Pratinjau" → 会计分录 · 预览. |
| Jurnal otomatis … · belum buku besar | Automatic journal … · not a general ledger | 自动生成的分录 … · 尚未记入总账 | Keterangan tetap kotak Jurnal. |
| Akun (dalam jurnal) | Account | 科目 | 会计科目. **Bukan** 账户 (= Rekening dan akun pengguna, **[zh v1.2]**). |
| Bagan akun | Chart of accounts | 会计科目表 | Nama baku PRC. |
| Buku besar | General ledger | 总账 | 总分类账. |
| Σ debit = Σ kredit | Debits equal credits | 借贷平衡 | Prinsip 有借必有贷，借贷必相等. |
| Saldo | Balance | 余额 | Dipakai ulang. |
| Saldo awal (rekening) | Initial balance | 初始余额 | Dipakai ulang dari `lang/zh/pages.php`. 期初余额 dicadangkan untuk saldo awal **periode** laporan. |
| Total Saldo | Total balance | 总余额 | |
| Pendapatan | Revenue | 收入 | Istilah baku PRC (准则第14号《收入》). Berbagi aksara dengan Pemasukan: lihat §3. |
| Pendapatan Usaha | Operating revenue | 营业收入 | Pos laporan laba rugi PRC. Grup L/R `revenue`. |
| Pendapatan Lain | Other income | 其他收入 | Grup `other_income` (bunga bank, sewa, refund). Sengaja bukan 营业外收入/其他收益: pos PRC itu lebih sempit. |
| Pendapatan dari Invoice | Invoice revenue | 账单收入 | Akun jurnal sistem (`JournalService::INVOICE_REVENUE`). "Pendapatan dari Invoice (kas)" → 账单收入（收付实现制）. |
| Beban | Expense | 费用 | Istilah baku PRC. Berbeda dari Pengeluaran (支出). |
| Beban Operasional | Operating expenses | 运营费用 | Grup `opex`. PRC memecahnya menjadi 销售/管理/财务费用, tanpa satu pos gabungan. 营业费用 dihindari karena itu nama lama PRC untuk beban penjualan. |
| Beban Lain | Other expenses | 其他费用 | Grup `other_expense`. Pasangan 其他收入, bukan 营业外支出. |
| Harga Pokok Penjualan (HPP) | Cost of goods sold (COGS) | 营业成本 | **[baku baru]** "Harga Pokok (HPP)" disatukan ke bentuk lengkap (KT03). Pos laba rugi PRC 营业成本 (akun 主营业务成本). Label pembuka: 营业成本（HPP）. "HPP baris" → 本行成本. Lama 成本 terlalu umum. |
| Laba kotor | Gross profit | 毛利 | |
| Laba usaha | Operating profit | 营业利润 | Pos PRC. |
| Laba sebelum pajak | Profit before tax | 税前利润 | Nama formal PRC adalah 利润总额. 税前利润 lebih jelas bagi non-akuntan. |
| Laba bersih | Net profit | 净利润 | |
| Laba / Rugi (kata lepas) | Profit / Loss | 利润 / 亏损 | |
| Laporan Laba Rugi | Profit & Loss statement | 损益表 | Risiko #7. 利润表 adalah nama resmi PRC sejak 2006. 损益表 dipilih supaya satu akar dengan 计入损益. |
| masuk Laba Rugi / tidak masuk Laba Rugi | in P&L / not in P&L | 计入损益 / 不计入损益 | Frasa baku PRC "计入当期损益". |
| Grup Laba Rugi / Grup L/R | P&L group | 损益分组 | |
| Baris Laba Rugi | P&L line | 损益表项目 | |
| Belum diklasifikasi | Unclassified | 未归类 | Kategori tanpa grup L/R. **Berbeda** dari Tanpa Kategori. |
| Tanpa Kategori | Uncategorized | 未分类 | Akun jurnal sistem (`UNCATEGORIZED`). |
| Basis kas | Cash basis | 收付实现制 | Istilah baku PRC; akrual = 权责发生制. |
| Pemulihan biaya / tutup modal dulu | Cost recovery | 成本回收法 / 先回收成本 | **[baku baru]** dulu "cost-recovery" (LR01). "modal" di sini berarti biaya (lihat §3 *Modal*). |
| Kas (uang tunai, jenis akun) | Cash | 现金 | Akun neraca PRC 库存现金; di UI cukup 现金. |
| Bank (jenis akun) | Bank | 银行 | |
| Arus kas | Cash flow | 现金流 | PRC 现金流量（表）. |
| Arus bersih | Net cash flow | 净现金流 | |
| Pemasukan | Income | 收入 | Uang masuk, termasuk pendanaan berpenanda. Dipakai ulang. Lihat §3. |
| Pengeluaran | Expenses | 支出 | Uang keluar. 支出 ≠ 费用 (Beban). Dipakai ulang. |
| Masuk / Keluar; Uang masuk / Uang keluar (arah uang) | In / Out; Money in / Money out | 流入 / 流出 | **[baku baru]** "Uang masuk / Uang keluar" menggantikan "(credit) / (debit)" di filter Kas & Bank (KB02). "Total masuk" → 流入合计; "Total keluar" → 流出合计. **[zh v1.2]** Kunci lepas `Masuk` dan `Keluar` dipakai bersama oleh tombol masuk/keluar akun dan label arah uang (`bank-accounts/components/account-charts.tsx`, `cash-flow/all.tsx`), jadi zh sementara memakai makna autentikasi (登录 / 退出登录). Kode perlu konteks, mis. `t('Masuk', { context: 'arah' })` → kunci `Masuk_arah` → 流入. Risiko #23. |
| Selisih (masuk − keluar) | Net | 净额 | |
| Transaksi | Transaction | 交易 | "Transaksi Terbaru" → 最近交易. |
| Mutasi (rekening) | Account activity | 流水 | 银行流水. "rekening & mutasi" → 账户与流水. |
| Transfer (antar rekening) | Transfer | 转账 | Juga tipe kategori. |
| Biaya admin / Biaya Admin Transfer | Admin fee / Transfer fee | 手续费 / 转账手续费 | Akun jurnal sistem `TRANSFER_FEE` → 转账手续费. |
| Penyesuaian (tipe kategori) | Adjustment | 调整 | Lihat §3. |
| Pendanaan | Financing | 筹资 | Pos PRC 筹资活动. Badge "Pendanaan" → 筹资. "Pendanaan · tidak masuk Laba Rugi" → 筹资 · 不计入损益. Risiko #4. |
| Modal (ekuitas) | Capital | 资本 | Lihat §3 *Modal*. |
| Modal Pemilik (akun) | Owner's capital | 业主资本 | Akun lawan sub "Setoran Modal Pemilik" (`JOURNAL_ACCOUNTS`). Perseroan di PRC memakai 实收资本, tetapi pasangannya "prive" hanya bermakna pada usaha milik pemilik, jadi dipakai istilah buku teks 业主资本. |
| Setoran modal | Capital contribution | 业主注资 | Teks UI. Nama kategori template = data. |
| Prive / Prive Pemilik | Owner's drawings | 业主提款 | Istilah buku teks Mandarin untuk *drawings*. |
| Utang (arti umum) | Payable / liability | 应付款 / 负债 | Modul "Utang" → 应付借款 (§2.3). |
| Piutang (arti umum) | Receivable | 应收款 | 应收账款 (PRC 1122) khusus piutang dagang dari penjualan, sehingga tidak dipakai untuk modul Piutang. |
| Utang Pinjaman (akun) | Loan payable | 应付借款 | `JournalService::LOAN`. "Utang Pinjaman – {pemberi}" → 应付借款 – {…}. Sama dengan nama modul Utang. |
| Piutang (akun jurnal) | Receivable | 应收借款 | `JournalService::RECEIVABLE`. Semua piutang di aplikasi ini adalah pinjaman yang diberikan, jadi 应收借款 tepat dan sama dengan nama modul. |
| Pinjaman | Loan | 借款 | "Tujuan pinjaman" → 借款用途; "Tanggal pinjaman" → 借款日期. |
| Pokok | Principal | 本金 | "Sisa pokok" → 剩余本金; "Pokok terbayar" → 已还本金. |
| Bunga | Interest | 利息 | "Bunga dibayar" → 已付利息. |
| Angsuran / cicilan | Installment | 分期 / 期 | "Jadwal angsuran" → 分期计划; "angsuran ke-3" → 第 3 期. |
| Tenor | Term | 期限 | "Tenor (bulan)" → 期限（月）. |
| Uang muka (DP) | Down payment | 预付款 | Ganti lama 首付款: 首付 lazim untuk KPR/kendaraan. 定金 dihindari karena dalam hukum kontrak PRC bermakna uang jaminan yang bisa hangus. |
| Pelunasan | Final payment | 尾款 | Ganti lama 结算: 结算 juga berarti kliring/checkout. 尾款 = pembayaran sisa tagihan. |
| Omzet | Turnover | 营业额 | "Omzet tanpa PPN" → 不含增值税营业额. |

### 2.2 Pajak Indonesia

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| PPN (Pajak Pertambahan Nilai) | VAT (PPN) | 增值税（PPN） | Pajak tidak langsung yang sama konsepnya dengan 增值税 PRC. Lihat U7 untuk bentuk berkurung. |
| Tarif PPN | VAT rate | 增值税税率 | "Tarif PPN (%) *" → 增值税（PPN）税率（%） * |
| Tagih PPN {{rate}}% / ber-PPN / tanpa PPN | Charge VAT {{rate}}% / with VAT / without VAT | 收取增值税（PPN）{{rate}}% / 含增值税 / 不含增值税 | Label sakelar memakai bentuk berkurung (U7). |
| PPN Keluaran | Output VAT | 增值税销项税额 | Akun PRC 应交税费—应交增值税（销项税额）. Akun jurnal sistem (`PPN_KELUARAN`), sama persis dengan akun lawan "Setor PPN". |
| PPN Keluaran diterima | Output VAT received | 已收增值税销项税额 | Memo Laba Rugi. |
| PPN Masukan | Input VAT | 增值税进项税额 | Belum ada di UI. Dicantumkan supaya konsisten bila kelak ditambah. |
| PKP (Pengusaha Kena Pajak) | VAT-registered business (PKP) | 增值税纳税人（PKP） | Pengusaha yang dikukuhkan untuk memungut PPN. Sengaja **bukan** 一般纳税人, karena itu kategori khusus PRC (lawan 小规模纳税人). Non-PKP → 非增值税纳税人. Risiko #6. |
| NPWP | Tax ID (NPWP) | 税号（NPWP） | Dipakai ulang dari `lang/zh/invoice.php`. Bentuk formal 纳税人识别号; 税号 lebih ringkas dan lazim di dokumen. |
| Faktur pajak | Tax invoice | 税务发票 | Bukti pungutan PPN (e-Faktur), padanan fungsi fapiao PRC. Harfiah faktur = 发票, pajak = 税务, jadi terjemah-baliknya bersih. |
| No. faktur pajak | Tax invoice number | 税务发票号码 | Ganti lama: `'faktur' => '发票'` bertabrakan dengan `'invoice' => '发票'`. |
| DPP (Dasar Pengenaan Pajak) | Tax base (DPP) | 计税依据（DPP） | "DPP (dasar PPN)" → 计税依据（DPP）. Ganti lama 应税所得: itu "penghasilan kena pajak" (objek PPh), konsep yang berbeda. |
| PPh (Pajak Penghasilan) | Income tax (PPh) | 所得税（PPh） | Ganti lama 预扣税 (= pajak potong). Terlalu sempit: PPh 25/29/Final bukan pemotongan. |
| PPh Final | Final income tax (PPh Final) | 最终所得税（PPh Final） | Label "Est. PPh final 0,5%" → 预估最终所得税（PPh Final）0,5%; di kalimat cukup 最终所得税. |
| PPh Badan | Corporate income tax | 企业所得税 | |
| Pajak (umum) | Tax | 税费 | Label "Pajak" → 税费; di kata majemuk cukup 税. |
| Wajib pajak | Taxpayer | 纳税人 | |
| Titipan pajak (item invoice) | Tax deposit | 代收税款 | Uang pajak klien yang ditagihkan untuk disetorkan atas nama klien: pass-through, bukan pendapatan. PRC mencatat dana semacam ini di 其他应付款—代收款项. Ganti lama 税金寄存 (寄存 = menitipkan barang/bagasi, janggal di akuntansi). **Bukan** 代扣代缴, yang bermakna pemotongan oleh pemungut. Risiko #5. |
| Titipan Pajak Klien (akun) | Client tax deposits | 代收客户税款 | Akun jurnal sistem (`TAX_DEPOSIT`), sama persis dengan akun lawan "Setor Titipan Pajak Klien". |
| Titipan Pajak (PPh) | Tax deposit (PPh) | 代收所得税（PPh） | Label pembuka di tampilan invoice (U7: akronim tidak berdiri tanpa istilah Mandarin). **[zh v1.3]** Kunci lepas `Pajak` dan `PPh` kini hanya dipakai sebagai judul kolom/isian penanda titipan pajak (`recurring-invoices`, `item.is_tax_deposit` di penyusun template), jadi bernilai 代收税款, bukan 税费 / 所得税（PPh）. Bila kelak dipakai di layar lain dengan arti umum, beri konteks (mis. `Pajak_titipan`). |
| titipan negara | held for the state | 代国家收取 | "PPN Keluaran diterima (titipan negara, tidak termasuk pendapatan)" → 已收增值税销项税额（代国家收取，不计入收入）. |
| Setor PPN | Remit VAT | 缴纳增值税 | Untuk teks UI. Nama kategori template "Setor PPN" = data (U6). |
| Setor titipan pajak klien | Remit client taxes | 代客户缴纳税款 | Idem. |
| Terbilang | Amount in words | 金额大写 | Padanan fungsi "大写金额" di dokumen Tiongkok. Isi terbilang tetap Bahasa Indonesia (K2). Dipakai ulang (`'say' => '大写'`). |
| UMKM | MSME | 中小微企业 | |

### 2.3 Modul & menu

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Ringkasan (menu & halaman) | Overview | 概览 | Ganti lama 仪表板: sumber sudah mengganti "Dashboard" menjadi "Ringkasan". Kartu "Ringkasan utang" → 应付借款概览. Lihat §3. |
| Keuangan (grup menu) | Finance | 财务 | Dipakai ulang. |
| Invoice | Invoice | 账单 | **Bukan 发票.** Risiko #1, §3 *Invoice*. |
| Invoice Berulang | Recurring Invoices | 定期账单 | Ganti lama 循环发票. |
| Kas & Bank | Cash & Bank | 现金与银行 | Ganti lama 银行账户: menu kini mencakup akun kas. |
| Arus Kas (grup menu) | Cash Flow | 现金流 | Dipakai ulang. |
| Pemasukan & Pengeluaran | Income & Expenses | 收入与支出 | Tab Semua / Pemasukan / Pengeluaran → 全部 / 收入 / 支出. |
| Transfer & Penyesuaian | Transfers & Adjustments | 转账与调整 | |
| Operasional (grup menu) | Operations | 运营 | Dipakai ulang. |
| Reimbursement | Reimbursements | 报销 | Dipakai ulang. Satu pengajuan = 报销申请. |
| Pengajuan Dana | Fund Requests | 资金申请 | **[baku baru]** dulu "Permintaan Dana" (PD01). Dipakai ulang. "Cairkan Dana" → 拨付资金. |
| pengajuan (kata umum) | request | 申请 | "Pengajuan saya" → 我的申请; "Semua pengajuan" → 全部申请; "Buat pengajuan" → 新建申请. |
| Kategori Transaksi | Transaction Categories | 交易类别 | 收支类别 terlalu sempit, karena ada tipe transfer, penyesuaian, dan pendanaan. |
| Pakai Template | Use template | 使用模板 | "Pakai Template Kategori" → 使用类别模板. Status pratinjau Baru / Sudah ada / Dilewati → 新增 / 已存在 / 已跳过. |
| Kategori sistem | System category | 系统类别 | |
| Utang & Piutang (grup menu) | Debts & Receivables | 应付与应收 | |
| Utang (modul) | Debts | 应付借款 | Pinjaman yang **diterima** perusahaan. Ganti lama 贷款: dibaca dari sisi pemberi pinjaman. 借款 saja juga ambigu, karena di perusahaan Tiongkok "员工借款" justru piutang karyawan. Risiko #3. |
| Piutang (modul) | Receivables | 应收借款 | Pinjaman yang **diberikan** ke karyawan/perusahaan lain. Ganti lama 应收账款: itu piutang dagang dari penjualan (PRC 1122), bukan isi modul ini. |
| Master Data | Master Data | 基础资料 | Istilah ERP Tiongkok (金蝶/用友). Ganti lama 主数据 (kaku, istilah TI). |
| Klien | Clients | 客户 | Dipakai ulang. |
| Layanan | Services | 服务项目 | 服务 saja bisa terbaca "layanan pelanggan". "Katalog layanan" → 服务项目目录. |
| Laporan | Reports | 报表 | |
| Laba Rugi (menu) | Profit & Loss | 损益表 | Lihat 2.1. |
| Administrasi | Administration | 系统管理 | |
| Pengguna | Users | 用户 | Dipakai ulang. |
| Perusahaan (menu admin, tenant) | Companies | 公司 | Bedakan dari jenis klien/debitur "Perusahaan" → 企业 (§3). |
| Izin & Peran | Permissions & Roles | 权限与角色 | |
| Masukan | Feedback | 反馈 | **[baku baru]** dulu "Feedback" / "Feedback & Saran" (MS01, keputusan T-2). Dipakai ulang. |
| Panduan | Guide | 使用指南 | Isi panduan tetap Indonesia (K3). |
| Tutorial | Tutorial | 教程 | |
| Pengaturan | Settings | 设置 | Dipakai ulang. |
| Profil | Profile | 个人资料 | Dipakai ulang. |
| Profil perusahaan | Company profile | 公司资料 | Dipakai ulang. |
| Penomoran invoice | Invoice numbering | 账单编号规则 | "Pola nomor" → 编号格式; "Nomor kembali ke 1" → 编号重置周期. |
| Template PDF | PDF templates | PDF 模板 | |
| Koneksi Claude | Claude connection | Claude 连接 | "konektor" → 连接器; "Hanya membaca" → 只读. |
| Notifikasi | Notifications | 通知 | Dipakai ulang. |
| Pratinjau | Preview | 预览 | **[baku baru]** "Preview" diganti di semua tempat (U05). "Pratinjau cetak" → 打印预览. |
| Kas kecil | Petty cash | 备用金 | Plafon + isi ulang adalah sistem imprest (定额备用金制度), persis konsep 备用金 di PRC. |
| Kas tunai | Cash on hand | 现金 | "Kas tunai · Penanggung jawab: …" → 现金 · 保管人：… |
| Penanggung jawab (kas) | Custodian | 保管人 | Lihat §3: kata ini punya 3 makna. |
| Plafon (kas kecil) | Limit | 限额 | "Plafon Rp … · perlu isi ulang Rp …" → 限额 Rp … · 需补足 Rp … |
| Isi ulang | Top up | 补足 | Mengisi kembali **sampai plafon** (jumlah = plafon − saldo). |
| Hanya-lihat | View-only | 仅查看 | Baris pokok utang/piutang. Bedakan dari "Hanya membaca" (akses Claude) → 只读. |
| Diinput oleh | Entered by | 录入人 | "Tidak tercatat" → 未记录; "Pengguna dihapus" → 已删除用户. |
| Rekap (ekspor) | Recap | 汇总表 | **[baku baru]** "Rekap Excel · Bawaan" (dulu "· Default", U04) → 汇总表 Excel · 默认. |
| Analitik | Analytics | 分析 | Tab Invoice Berulang. |

### 2.4 Status

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Draft | Draft | 草稿 | Dipakai ulang. Ejaan KBBI "Draf" menunggu keputusan T-1 (`perapian-id.md` §7); bawaan tetap "Draft". |
| Belum diajukan | Not submitted | 未提交 | |
| Terbit (status invoice `sent`) | Issued | 已开具 | **[baku baru]** dulu "Terkirim" (INV02, keputusan T-3). Status sesudah nomor resmi diberikan; aplikasi **tidak** mengirim email. Ganti lama 已发送. Risiko #2. |
| Diterbitkan (dalam kalimat) | Issued | 已开具 | "Invoice diterbitkan: {nomor}" → 账单已开具：{nomor}. |
| Sebagian / dibayar sebagian | Partially paid | 部分付款 | **[zh v1.2]** netral arah: kunci `Sebagian` dipakai bersama oleh invoice, jadwal angsuran, tab pembayaran Kas & Bank, dan Ringkasan (v1.1: invoice 部分收款). **[zh v1.3]** tetap, lihat keputusan status di §3 *Bayar*. Risiko #14. |
| Lunas | Paid (invoice, reimbursement) / Paid off (utang, piutang) | 已结清 | Satu istilah Mandarin untuk semua modul; EN beda per modul. |
| Sudah dibayar | Paid | 已付款 | **[zh v1.2]** kunci bersama invoice & reimbursement (v1.1: invoice 已收款). **[zh v1.3]** tetap (status tagihan). §3 *Bayar*. |
| Belum dibayar | Unpaid | 未付款 | **[zh v1.2]** netral, sejalan dengan *Sudah dibayar*. "Invoice belum dibayar" → 未付款账单. **[zh v1.3]** tetap (status tagihan). |
| Belum kembali (piutang) | Not yet repaid | 未收回 | |
| Jatuh tempo | Due date (invoice) / Maturity date (utang) | 到期日 | "jatuh tempo terdekat" → 最近到期日. |
| Lewat jatuh tempo | Overdue | 逾期 | **[baku baru]** dulu juga "Lewat tempo" (U09). Dipakai ulang. "lewat {n} hari" → 逾期 {n} 天. |
| Terlambat (angsuran) | Late | 逾期 | Sama dengan lewat jatuh tempo. |
| Perlu ditagih | To collect | 待催收 | Tab invoice lewat jatuh tempo lintas bulan. 催收 = menagih piutang yang tertunda. |
| Menunggu persetujuan | Pending approval | 待审批 | **[baku baru]** satu label untuk status menunggu di Piutang (`pending_approval`), Pengajuan Dana, dan Reimbursement (`pending`); dulu "Menunggu", "Pending Review", "Menunggu review" (PT01, PD02, RB01). |
| Menunggu persetujuan tim keuangan | Awaiting finance approval | 待财务审批 | **[baku baru]** dulu "Menunggu review finance" (RB01). |
| Menunggu dibayar | Awaiting payment | 待付款 | Kartu reimbursement. |
| Menunggu perbaikan dari pemohon | Awaiting the requester's revision | 待申请人修改 | |
| Disetujui | Approved | 已批准 | **[baku baru]** label "Approved" di Pengajuan Dana diganti (PD02). Dipakai ulang. |
| Ditolak | Rejected | 已拒绝 | **[baku baru]** label "Rejected" di Pengajuan Dana diganti (PD02). **[zh v1.2]** kembali ke 已拒绝 (v1.1: 已驳回): kunci `Tolak` juga tombol penolakan akses di halaman OAuth Claude, tempat 驳回 tidak tepat, dan pasangan status/tombol harus seragam. "Alasan penolakan" → 拒绝原因; "Ditolak oleh {{name}}" → 由 {{name}} 拒绝. Risiko #13. |
| Dicairkan | Disbursed | 已拨付 | **[baku baru]** label "Disbursed" di Pengajuan Dana diganti (PD02). Dipakai ulang. |
| Aktif (utang/piutang) | Active | 还款中 | Pinjaman yang sedang dicicil. Ganti lama 活跃 (= ramai/aktif dalam arti keterlibatan). |
| Aktif / Tidak Aktif (pengguna, klien, template, perusahaan) | Active / Inactive | 启用 / 停用 | "Pengguna Aktif" (statistik) → 启用的用户. |
| Diarsipkan / Arsip | Archived / Archive | 已归档 / 归档 | |
| Dijadikan invoice (Invoice Berulang) | Converted to invoice | 已转为账单 | **[baku baru]** dulu "Published" (RI03, keputusan T-5). **Bukan** 已开具: hasilnya invoice Draft tanpa nomor. |
| Gagal (penyediaan perusahaan) | Failed | 失败 | |
| Mingguan / Bulanan / Triwulanan / Semesteran / Tahunan (frekuensi, periode grafik) | Weekly / Monthly / Quarterly / Semi-annual / Annual | 每周 / 每月 / 每季度 / 每半年 / 每年 | **[zh v1.2]** kunci `Bulanan` dipakai bersama oleh tab Invoice Berulang dan periode grafik Ringkasan, jadi tab pun → 每月 (v1.1: 月度). "Triwulanan (3 bln)" → 每季度（3 个月）. |
| Rendah / Sedang / Tinggi / Mendesak (prioritas Pengajuan Dana) | Low / Medium / High / Urgent | 低 / 中 / 高 / 紧急 | **[baku baru]** dulu label Inggris (PD03). |
| Kritis (prioritas Masukan) | Critical | 严重 | **[baku baru]** label server "Critical" diganti (MS02). Ganti lama 紧急, supaya tidak bertabrakan dengan Mendesak (紧急). |
| Terbuka / Diproses / Selesai / Ditutup (status Masukan) | Open / In progress / Resolved / Closed | 待处理 / 处理中 / 已解决 / 已关闭 | **[baku baru]** label server Inggris dan "Sedang Diproses" disatukan (MS02). Pola tiket baku. 处理中 menggantikan 进行中 lama: lebih jelas "sedang ditangani". |
| Bug / Fitur / Saran (jenis Masukan) | Bug / Feature request / Suggestion | 缺陷 / 功能请求 / 建议 | **[baku baru]** dulu "Bug Report / Feature Request / Kritik/Saran" (server) dan "Feedback" (halaman Masukan) (MS02). |

### 2.5 Peran & pihak

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Admin | Admin | 管理员 | Bedakan dari "Biaya Admin" (§3). |
| Finance Manager | Finance Manager | 财务经理 | Juga jabatan penanda tangan di Profil perusahaan ("Nama Finance Manager"). |
| Staff | Staff | 员工 | |
| Peran | Role | 角色 | Peran buatan pengguna = data (U6). |
| Pemohon | Requester | 申请人 | |
| Peninjau | Reviewer | 审核人 | |
| Penyetuju | Approver | 审批人 | |
| Pembayar (reimbursement) | Paid by | 付款人 | |
| Karyawan (jenis debitur) | Employee | 员工 | |
| Perusahaan (jenis debitur/klien) | Company | 公司 | **[zh v1.2]** kuncinya sama dengan tenant `Perusahaan`, jadi satu padanan 公司 (v1.1: 企业). |
| Individu / Perorangan (jenis klien) | Individual | 个人 | **[zh v1.2]** dua kunci sumber, satu padanan (U8). |
| Debitur | Borrower | 借款人 | |
| Pemberi pinjaman | Lender | 出借方 | Netral untuk bank maupun perorangan. |
| Anggota (perusahaan) | Member | 成员 | |
| Account Representative (AR, pegawai KPP) | Account Representative (AR) | 税务客户经理（AR） | **[zh v1.3]** pemeriksaan silang T3: lama 税务专管员 adalah jabatan administrasi pajak RRT yang sudah dihapus. "Nama AR" → 客户经理姓名; "No. HP AR" → 客户经理手机号. |
| Penanggung jawab keuangan | Finance officer | 财务负责人 | Bagian Profil perusahaan. |
| Tim IT | IT team | IT 团队 | |

### 2.6 Kata kerja UI

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Simpan / Simpan draft | Save / Save draft | 保存 / 保存草稿 | |
| Simpan & terbitkan | Save & issue | 保存并开具 | |
| Batal | Cancel | 取消 | |
| Tutup | Close | 关闭 | |
| Hapus | Delete | 删除 | |
| Ubah (tombol, judul) | Edit | 编辑 | **[baku baru]** "Edit" diganti "Ubah" (U01–U03, keputusan T-4). Di kalimat, "mengubah/diubah" → 修改/已修改. |
| Perbarui | Update | 更新 | "diperbarui" → 已更新. |
| Tambah | Add | 新增 | "+ Tambah" → + 新增. Gaya ERP Tiongkok. |
| Buat | Create / New | 新建 | Tombol/judul pembuka formulir ("Buat Invoice" → 新建账单). Di kalimat "dibuat" → 已创建. **[zh v1.3]** semua label "Buat …" diseragamkan ke 新建, termasuk label izin ("Buat klien" → 新建客户, "Buat utang" → 新建应付借款), "Buat perusahaan" → 新建公司, "Buat kategori" → 新建类别, "Buat Manual" → 手动新建. Pengecualian bermakna *menghasilkan*: "Buat Draft", "Buat Sekarang", "Buat Ulang Favicon" → 生成. Kalimat deskripsi ("Buat template PDF pertama Anda untuk…") boleh 创建. |
| Catat | Record | 登记 | **[baku baru]** "Input Pemasukan/Pengeluaran/Transfer" diganti "Catat …" (KB01). "Catat Pemasukan" → 登记收入; "dicatat" → 已登记. 登记 adalah kata baku pembukuan (收款登记、费用登记). |
| Catat pembayaran | Record payment | 登记付款 / 登记收款 (invoice) | **[zh v1.2]** satu kunci dipakai invoice, utang, piutang, dan label izin `create payments` (v1.1: 登记收款 / 登记还款). **[zh v1.3]** di `pages/invoices/**` dipanggil dengan konteks `invoice` → kunci `Catat pembayaran_invoice` → 登记收款; kunci dasar tetap 登记付款 untuk utang, piutang, dan label izin. Lihat §3 *Bayar*. |
| Ajukan | Submit | 提交 | "Ajukan untuk persetujuan" → 提交审批. |
| Perbaiki & ajukan ulang | Fix & resubmit | 修改并重新提交 | |
| Setujui | Approve | 批准 | |
| Tolak | Reject | 拒绝 | **[zh v1.2]** (v1.1: 驳回). Lihat status Ditolak. |
| Proses (pengajuan) | Process | 处理 | "Proses pengajuan" → 处理申请. |
| Tinjau | Review | 审核 | **[baku baru]** "Review" / "Direview" diganti (PD05, RB01). |
| Bayar (reimbursement) | Pay | 付款 | |
| Cairkan | Disburse | 拨付 | Pengajuan Dana. Untuk piutang lihat §3 *Cair*. |
| Terbitkan | Issue | 开具 | |
| Terbitkan invoice | Issue invoice | 开具账单 | **[baku baru]** dulu "Kirim invoice" (INV01): satu aksi, satu kata kerja. |
| Kirim (umum: masukan, tautan) | Send | 发送 | |
| Kembalikan ke draft | Revert to draft | 退回草稿 | |
| Buat Draft (Invoice Berulang) | Create drafts | 生成草稿 | **[baku baru]** dulu "Generate" (RI02). Membuat draft bulanan dari template. |
| Jadikan Invoice (Invoice Berulang) | Convert to invoice | 转为账单 | **[baku baru]** dulu "Publish" / "Publish Invoice" (RI03, keputusan T-5). |
| Unduh | Download | 下载 | |
| Ekspor | Export | 导出 | **[baku baru]** "Export PDF/Excel" diganti (U06). |
| Cetak | Print | 打印 | |
| Cari | Search | 搜索 | |
| Filter | Filter | 筛选 | |
| Pilih | Select | 选择 | |
| Salin | Copy | 复制 | "Salin tautan" → 复制链接. |
| Lihat | View | 查看 | |
| Kembali | Back | 返回 | |
| Coba lagi | Try again | 重试 | |
| Konfirmasi | Confirm | 确认 | |
| Masuk (login) | Log in | 登录 | |
| Keluar (logout) | Log out | 退出登录 | Ganti lama 登出 (jarang di zh-CN). |
| Hubungkan | Connect | 连接 | "Hubungkan Claude" → 连接 Claude. |
| Cabut (akses) | Revoke | 撤销 | |
| Izinkan | Allow | 允许 | |
| Unggah | Upload | 上传 | "seret & lepas" → 拖放. |
| Arsipkan / Pulihkan | Archive / Restore | 归档 / 恢复 | |
| Kelola | Manage | 管理 | |
| Atur ulang (kata sandi) | Reset | 重置 | **[baku baru]** "Kirim Tautan Reset" → "Kirim Tautan Atur Ulang" (AU01). |
| Hapus filter | Clear filters | 清除筛选 | **[baku baru]** dulu "Reset" / "Reset filter" (U07). |
| Tandai sudah dibaca | Mark as read | 标为已读 | |

### 2.7 Kata benda UI

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Rekening | Account | 账户 | Rekening bank maupun akun kas. Lihat §3 *Rekening*. |
| Nomor rekening | Account number | 银行账号 | Eksplisit "bank" agar jelas yang dimaksud nomor rekening bank. |
| Nama bank / Cabang | Bank name / Branch | 银行名称 / 支行 | |
| Rekening sumber / Rekening tujuan (transfer) | Source account / Destination account | 转出账户 / 转入账户 | Juga akun jurnal cadangan "Rekening asal/tujuan". |
| Kategori | Category | 类别 | Dipakai ulang. |
| Kategori induk | Parent category | 上级类别 | **[baku baru]** "Parent" / "Kategori Utama" disatukan (KT01). |
| Subkategori | Subcategory | 子类别 | **[baku baru]** dulu "Sub Kategori" / "sub kategori" / "sub-kategori" (KT01, KBBI). |
| Tipe / Jenis | Type | 类型 | |
| Deskripsi | Description | 描述 | **[zh v1.2]** satu padanan di semua konteks: kunci `Deskripsi` dipakai bersama oleh formulir uang dan non-uang (v1.1: 摘要 untuk uang). Lihat §3. |
| Keterangan | Notes / Description | 说明 | |
| Catatan | Notes | 备注 | Dipakai ulang. |
| Nomor referensi / Referensi | Reference number / Reference | 参考编号 / 参考 | |
| Lampiran | Attachment | 附件 | Dipakai ulang. |
| Bukti (transaksi, transfer, pembayaran) | Proof / Receipt | 凭证 | 原始凭证 = dokumen sumber. "Lampiran Bukti" → 凭证附件; "Bukti Transfer" → 转账凭证. Dipakai ulang. |
| Tanggal / Rentang tanggal | Date / Date range | 日期 / 日期范围 | |
| Periode | Period | 期间 | Dipakai ulang. "Periode khusus" → 自定义期间. |
| Bulan ini / Bulan lalu / Tahun berjalan / Tahun lalu | This month / Last month / Year to date / Last year | 本月 / 上月 / 本年至今 / 去年 | |
| Klien / Alias klien | Client / Client alias | 客户 / 客户简称 | Alias = sumber token `{KLIEN}`. |
| Layanan | Service | 服务项目 | |
| Termin (hari) | Payment terms (days) | 账期（天） | Lihat §3 *Termin*. |
| Diskon / Alasan diskon | Discount / Discount reason | 折扣 / 折扣原因 | |
| Total | Total | 合计 | Lihat §3 *Total*. |
| Subtotal | Subtotal | 小计 | Dipakai ulang. "Subtotal layanan" → 服务小计. |
| Sisa | Remaining | 剩余 / 余额 | Lihat §3 *Sisa*. |
| Sisa tagihan | Balance due | 未付余额 | **[zh v1.2]** netral, sejalan dengan 已付款 / 未付款 (v1.1: 未收余额). **[zh v1.3]** tetap: sisa adalah bagian dari status tagihan (§3 *Bayar*). Lama 应付余额 tetap ditolak: 应付 = utang kita. |
| Total ditagih | Total billed | 账单总额 | Bukan 开票总额: 开票 di Tiongkok daratan identik dengan menerbitkan fapiao. |
| Jumlah (uang) / Nominal | Amount | 金额 | Lihat §3 *Jumlah*. |
| Satuan / Harga satuan / Harga / Qty | Unit / Unit price / Price / Qty | 单位 / 单价 / 价格 / 数量 | Dipakai ulang. |
| Item / baris item | Item / line | 明细 / 明细行 | "Belum ada item" → 暂无明细; "Jumlah item" → 明细数量. |
| Nomor invoice / No. invoice | Invoice number / Invoice no. | 账单编号 | |
| Nomor urut | Sequence number | 序号 | |
| Riwayat | History | 历史记录 | |
| Rincian / Detail | Details | 详情 (dialog satu catatan) / 明细 (pecahan per kategori) | "Rincian per kategori" → 按类别明细. |
| Aksi | Actions | 操作 | Dipakai ulang. |
| Status | Status | 状态 | |
| Tautan | Link | 链接 | |
| Metode pembayaran: Transfer bank / Tunai / Potong gaji | Payment method: Bank transfer / Cash / Payroll deduction | 付款方式：银行转账 / 现金 / 工资扣款 | |
| Singkatan (perusahaan) | Abbreviation | 简称 | Sumber token `{PT}`. |
| Kode URL (permanen) | URL code (permanent) | 网址代码（永久） | **[zh v1.3]** "Kode URL *" → 网址代码 * (dulu URL 代码 *), sama dengan `kode-url` → 网址代码. |
| Kuota / Grup (organisasi) | Quota / Group | 配额 / 集团 | "Kuota grup" → 集团配额. |
| Izin | Permission | 权限 | **[baku baru]** "Permission" diganti (IZ01). |
| Akun (pengguna) | Account | 账户 | **[zh v1.2]** kunci `Akun` dipakai bersama oleh daftar Kas & Bank dan grup pengaturan akun, jadi semua → 账户 (v1.1: 账号). "Hapus Akun" → 删除账户. 账号 hanya tersisa di 银行账号 (Nomor rekening). |
| Kata sandi | Password | 密码 | |
| Nama lengkap / Jabatan / Telepon / Alamat / Email | Full name / Position / Phone / Address / Email | 姓名 / 职位 / 电话 / 地址 / 邮箱 | |
| Logo / Tanda tangan / Stempel / Kop surat | Logo / Signature / Stamp / Letterhead | 标志 / 签名 / 印章 / 信头 | Dipakai ulang (签名, 印章). |
| Tema: Gelap / Terang | Theme: Dark / Light | 主题：深色 / 浅色 | Ganti lama 暗色/亮色; 深色/浅色 adalah istilah Apple/Microsoft zh-CN. |
| Bahasa | Language | 语言 | |
| Opsional / Wajib | Optional / Required | 可选 / 必填 | |
| Bawaan | Default | 默认 | **[baku baru]** dulu "Default" (U04): template bawaan, peran bawaan, termin bawaan. |
| Catatan peninjau | Reviewer notes | 审核人备注 | **[baku baru]** dulu "Catatan Review" (PD05). |

### 2.8 Penyusun template PDF, penomoran & lainnya **[zh v1.2]**

Ditambahkan saat kamus `zh.json` frontend diisi. Istilah struktur penyusun template tetap diterjemahkan di zh.

| Indonesia | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Header / HEADER | Header | 页眉 | Band template PDF. |
| Konten / KONTEN | Content | 正文 | "Tabel item (band Konten)" → 明细表（正文区段）. |
| Footer Flow / Footer Tetap / Footer | Flow footer / Fixed footer / Footer | 随文页脚 / 固定页脚 / 页脚 | Footer Flow menempel setelah konten; Footer Tetap dipaku di dasar halaman. |
| Band / Ukuran Band | Band / Band size | 区段 / 区段尺寸 | "seret ke band" → 拖到区段. Risiko #22. |
| Banded (label mode penyusun) | Banded | 分段布局 | |
| Grid / Grid statis / Struktur Grid | Grid / Static grid / Grid structure | 网格 / 静态网格 / 网格结构 | |
| Field / Sisipkan field / Field Item | Field / Insert field / Item fields | 字段 / 插入字段 / 明细字段 | |
| Tabel Item | Item table | 明细表 | |
| Sel / Gabungkan sel / Pisahkan sel | Cell / Merge cells / Split cell | 单元格 / 合并单元格 / 拆分单元格 | "Sel B{{row}}·K{{col}}" → 单元格 {{row}} 行·{{col}} 列. |
| Lapisan / Properti / Kanvas / Elemen | Layers / Properties / Canvas / Element | 图层 / 属性 / 画布 / 元素 | |
| Margin Halaman / Padding | Page margins / Padding | 页边距 / 内边距 | |
| Atas / Kanan / Bawah / Kiri / Tengah | Top / Right / Bottom / Left / Center | 顶部 / 右侧 / 底部 / 左侧 / 居中 | Kunci bersama label margin dan tooltip perataan. |
| Rata H / Rata V / Rata / Rata penuh | Horizontal / Vertical align / Align / Justify | 水平对齐 / 垂直对齐 / 对齐 / 两端对齐 | |
| Tebal (konteks `garis`) / Tebal (teks) | Line width / Bold | 线宽 / 粗体 | |
| Garis tepi / Radius / Opasitas / Sorot | Border / Radius / Opacity / Highlight | 边框 / 圆角 / 不透明度 / 高亮 | Sorotan "Tidak aktif" → 关闭. |
| Line-height / Spasi huruf | Line height / Letter spacing | 行高 / 字间距 | |
| Isi / Isi kotak / Isi bg | Fill / Box fill / Background fill | 填充 / 背景填充 / 背景填充 | |
| Gandakan / Duplikat | Duplicate | 创建副本 | Beda dari Salin (复制). |
| Urungkan / Ulangi (redo) | Undo / Redo | 撤销 / 重做 | "Ulangi" pada header tiap halaman → 重复. |
| Font kustom / Unggah font | Custom font / Upload font | 自定义字体 / 上传字体 | Fon bawaan dikelompokkan di bawah 默认. |
| Token (penomoran invoice, template PDF) | Token | 变量 | "Sisipkan token" → 插入变量; "Token tidak dikenal" → 无法识别的变量. `{NO}`, `{PT}`, dst. tetap utuh. Risiko #21. |
| Urutan / Isi urutan (penomoran) | Sequence / Fill sequence | 序号 / 补填序号 | |
| Favicon | Favicon | 网站图标 | |
| Aset Visual | Visual assets | 视觉素材 | |
| Peminjam (piutang) | Borrower | 借款人 | Sama dengan Debitur. |
| Pencairan lewat / Rekening atau cara pencairan (piutang) | Disbursed via / Disbursement account or method | 放款途径 / 放款账户或方式 | |
| Rekening penerima pencairan (utang) | Proceeds account | 借款到账账户 | |
| Angsuran / bulan; Cicilan / bulan | Installment per month | 每月还款额 | |
| Sudah kembali / Belum kembali / Pengembalian pokok | Repaid / Not yet repaid / Principal repayment | 已收回 / 未收回 / 本金收回 | |
| Keputusan (proses pengajuan piutang) | Decision | 审批决定 | |
| Cara membayar (piutang) | Repayment method | 还款方式 | Opsi: 银行转账 / 现金 / 工资扣款. |
| Laba Belum Diterima / Performa Template / Margin Laba | Unrealized profit / Template performance / Profit margin | 待实现利润 / 模板表现 / 利润率 | Invoice Berulang. |
| Konektor / Sambungan (Claude) | Connector / Connection | 连接器 / 连接 | "Cabut sambungan {{name}}" → 撤销 {{name}} 的连接. Label Claude.ai dikutip persis (U2). |
| Pemasangan (setup) | Installation | 安装 | |
| Dibuat (kolom tabel & langkah lini masa) | Created | 创建 | Kunci bersama; lama 创建日期 hanya cocok untuk kolom. |
| jt (juta, satuan ringkas grafik) | M | 百万 | Kode membagi 1.000.000, jadi 万 tidak bisa dipakai. Desimal tetap koma (risiko #18): "+Rp 18,5 jt" → +Rp 18,5 百万. |
| Kategori induk / Induk / Tanpa induk | Parent category / Parent / No parent | 上级类别 / 上级类别 / 无上级类别 | Sesuai §2.7. |
| Ditransfer (dialog Detail Transfer) | Transferred | 已转出金额 | **[zh v1.3]** pemeriksaan silang T8 (dulu 转账金额, terlalu dekat dengan "Jumlah Transfer"). |

### 2.9 Teks server (`lang/zh.json`, `lang/zh/*.php`) **[zh v1.2]**

| Indonesia / sumber | English | 中文 | Catatan/alasan |
|---|---|---|---|
| Pesan validasi bawaan (`validation.php`) | — | `:attribute不能为空。` | Tanpa spasi di sebelah `:attribute` / `:other` (diganti nama kolom Mandarin dari `attributes`); satu spasi di sebelah `:min`, `:max`, `:value`, `:date`, `:values`. "X wajib diisi." → [X]不能为空。 (Z10). |
| organization / organisasi (pesan admin) | Organization | 集团 | Sama dengan "Grup (organisasi)" di §2.7. |
| Penyambung daftar " dan " (`implode(__(' dan '), …)`) | " and " | `，以及 ` | Diakhiri satu spasi karena bagian berikutnya diawali angka. |
| Status mentah `"failed"` dalam pesan | Failed | “创建失败” | Ditulis seperti label status di layar, bukan kodenya. |
| Email bawaan Laravel: Hello! / Regards, / Whoops! / All rights reserved. | — | 您好！ / 此致， / 出错了！ / 版权所有。 | Kunci Inggris (D13), nilai id di `lang/id.json`. |
| Contoh data "PT Contoh Klien" (pratinjau penomoran) | — | PT Contoh Klien | Dibiarkan: inisialnya `CK` dipatok di kode (risiko #24). |
| Label jenis/status/prioritas Masukan (`feedback.php`) | — | 缺陷 / 功能请求 / 建议; 待处理 / 处理中 / 已解决 / 已关闭; 低 / 中 / 高 / 严重 | Diselaraskan dengan §2.4 (dulu 缺陷报告, 意见/建议, 进行中, 紧急). |

---

## 3. Kata ambigu: aturan per konteks

| Kata sumber | Konteks | English | 中文 | Aturan & alasan |
|---|---|---|---|---|
| **Jumlah** | Isian uang ("Jumlah *", "Jumlah Transfer", "Jumlah pokok") | Amount | 金额 | Makna paling sering. "Jumlah Transfer" → 转账金额. |
| | Baris total di kotak Jurnal | Total | 合计 | Kaki tabel JournalBox. |
| | Banyaknya ("Jumlah item", "Jumlah digit", "Jumlah cicilan (bulan)", "jumlah baris", "berdasarkan jumlah invoice") | Number of… / Count | 数量 / 位数 / 期数 / 行数 | "Jumlah cicilan (bulan)" → 分期期数（月）; "berdasarkan jumlah invoice" → 按账单数量. |
| | Kuantitas barang | Quantity | 数量 | |
| **Total** | Label kartu/baris penjumlahan | Total | [X]合计 | "Total masuk" → 流入合计; "Total HPP" → 营业成本合计. |
| | Angka utama | Total … | 总[X] | "Total Saldo" → 总余额. |
| | "Total Keluar" di dialog Transfer, Detail Transfer, dan tab Transfer (= jumlah + biaya admin yang keluar dari rekening asal; dulu "Total Debit") | Total out | 转出合计 | **[baku baru]** sumber kini "Total Keluar" (KB02). **Jangan** 借方合计: kotak Jurnal di dialog yang sama menaruh rekening asal di sisi **Kredit**. |
| **Sisa** | Invoice, reimbursement ("sisa {{amount}}", "Sisa") | Balance due | 未付 / 未付余额 | **[zh v1.2]** (v1.1: 未收余额). |
| | Utang (pokok) | Remaining principal | 剩余本金 | |
| | Piutang ("belum kembali") | Not yet repaid | 未收回 | |
| | "Sisa setelah DP" | Remaining after down payment | 扣除预付款后余额 | |
| **Bayar / Pembayaran / dibayar** | Invoice: aksi & catatan pembayaran (klien membayar kita) | Payment | 收款 | **[zh v1.3]** (v1.2: 付款 netral; pemeriksaan silang T1: 付款 terbaca "kita yang membayar"). Kunci khusus invoice cukup diganti nilainya: "Pembayaran {{amount}} dicatat · tunai/transfer" → 已登记收款 {{amount}} · 现金/转账; "Pembayaran {{amount}} dicatat." → 收款 {{amount}} 已登记; "Belum ada pembayaran tercatat." → 暂无收款记录; "Hapus pembayaran {{amount}}" → 删除收款 {{amount}}; "Pembayaran dihapus." → 收款已删除。 Kunci bersama diberi konteks `invoice` di `pages/invoices/**`: `Catat pembayaran_invoice` 登记收款, `Hapus pembayaran_invoice` 删除收款, `Ubah pembayaran_invoice` 编辑收款, `Simpan pembayaran_invoice` 保存收款, `Pembayaran_invoice` (judul riwayat "… {n} 次") 收款. Teks lain yang memang khusus pembayaran invoice (Kas & Bank, Arus Kas, Ringkasan, server): "Pembayaran invoice" → 账单收款, "Detail Pembayaran Invoice" → 账单收款详情, tab Kas & Bank "Pembayaran" → 收款. "Rekening tujuan" → 收款账户. Risiko #14. |
| | Invoice: status & sisa tagihan | Paid / Unpaid / Partially paid | 已付款 / 未付款 / 部分付款 / 已付 {n}% / 未付余额 | **[zh v1.3]** Keputusan v1.3: **status & sisa invoice tetap sudut pandang tagihan** (已付款 / 未付款 / 部分付款 / 已结清, 已付 {n}%, 未付余额), seperti status 账单/订单 umumnya ("账单已付款"). Alasannya: kunci status `Sudah dibayar`, `Sebagian`, `Lunas` juga tampil di Ringkasan, tab Pembayaran Kas & Bank, reimbursement, dan jadwal angsuran; bila hanya halaman invoice yang diubah ke 已收款/部分收款, status yang sama tampil dengan dua kata berbeda. **Aksi & catatan pembayaran invoice** memakai sudut pandang perusahaan → 收款. |
| | Reimbursement (kita membayar karyawan) | Pay / paid | 付款 / 已付款 | |
| | Utang & piutang (cicilan pokok/bunga) | Payment | 还款 | "Pembayaran pokok" → 本金还款; "Pembayaran bunga" → 利息还款; "Tanggal pembayaran" → 还款日期; "Bayar utang" (izin) → 偿还应付借款. **[zh v1.2]** toast bersama "Pembayaran dicatat" (utang, piutang, reimbursement) → 付款已登记. |
| | Pengajuan Dana | Disbursement | 拨付 | Tidak memakai "bayar". |
| **Terbitkan / Terbit** | Invoice: memberi nomor resmi, status `sent` | Issue / Issued | 开具 / 已开具 | **[baku baru]** sumber kini satu kata kerja; dulu juga "Kirim invoice" dan status "Terkirim" (INV01–INV03). |
| | "Tanggal Invoice" (Invoice Berulang; dulu "Tanggal Terbit") | Invoice date | 账单日期 | **[baku baru]** sama dengan editor invoice (RI06): tanggal invoice yang lahir sebagai Draft. |
| | "Jadikan Invoice" (Invoice Berulang: draft → invoice Draft; dulu "Publish") | Convert to invoice | 转为账单 | **[baku baru]** (RI03). **Bukan** 开具; hasilnya belum bernomor. |
| | Kirim (masukan, tautan, email) | Send | 发送 | |
| **Kas** | Jenis akun / uang tunai | Cash | 现金 | |
| | Kas kecil | Petty cash | 备用金 | |
| | Kas & Bank (modul) | Cash & Bank | 现金与银行 | |
| | Arus Kas | Cash flow | 现金流 | |
| | Basis kas / "(kas)" di Laba Rugi | Cash basis | 收付实现制 | |
| | "Total Kas" / "Total Bank" | Total cash / Total bank | 现金合计 / 银行合计 | |
| **Rekening** | Umum (bank atau kas) | Account | 账户 | |
| | Nomor rekening | Account number | 银行账号 | |
| | "Rekening tujuan" di dialog pembayaran invoice | Receiving account | 收款账户 | Uang klien masuk ke sini. |
| | Rekening sumber / tujuan transfer | Source / destination account | 转出账户 / 转入账户 | |
| **Akun** | Kotak Jurnal ("Akun") | Account | 科目 | Akun buku besar. |
| | Akun pengguna ("Hapus Akun", "Informasi Akun") | Account | 账户 | **[zh v1.2]** (v1.1: 账号); lihat §2.7. |
| | Kas & Bank ("Tambah Akun", "Pilih akun", "Belum ada akun") | Account | 账户 | Akun bank/kas. |
| **Debit / Kredit** | Sisi jurnal (JournalBox) | Debit / Credit | 借方 / 贷方 | Sudut pandang pembukuan perusahaan: uang masuk = rekening didebit. |
| | Arah mutasi bank (kode `transaction_type`) | Money out / Money in | 流出 / 流入 | **[baku baru]** teks UI kini "Uang keluar / Uang masuk", bukan "debit / kredit" (KB02). Kode `debit` = uang keluar (sudut pandang rekening koran), kebalikan dari sisi jurnal rekening; **jangan** pakai 借/贷 di luar kotak Jurnal. |
| **Masuk / Keluar** | Arah uang | In / Out | 流入 / 流出 | |
| | Autentikasi | Log in / Log out | 登录 / 退出登录 | |
| **Pemasukan vs Pendapatan** | Pemasukan = uang masuk (tab, tipe kategori, "Catat Pemasukan") | Income | 收入 | Keduanya → 收入 dalam bentuk dasar. Bedanya dibawa kata majemuk & label: Pendapatan Usaha 营业收入, Pendapatan Lain 其他收入, "Pemasukan (masuk Laba Rugi)" → 收入（计入损益）. EN membedakan Income/Revenue. Risiko #8. |
| | Pendapatan = revenue Laba Rugi | Revenue | 收入 / 营业收入 | |
| **Pengeluaran vs Beban** | Pengeluaran = uang keluar | Expenses | 支出 | |
| | Beban = biaya di Laba Rugi | Expense | 费用 | "Beban (masuk Laba Rugi)" → 费用（计入损益）. |
| **Tagihan / tagih / ditagih** | Invoice sebagai dokumen | Invoice / bill | 账单 | "Jenis tagihan" → 账单类型. |
| | "Total ditagih" | Total billed | 账单总额 | Hindari 开票 (= menerbitkan fapiao). |
| | "Perlu ditagih" | To collect | 待催收 | |
| | "Tagih PPN" | Charge VAT | 收取增值税 | |
| | "Tagih ke beberapa klien" / "ditagihkan" | Bill multiple clients / billed | 向多个客户开具 / 计入账单 | |
| | "Tagihan pelunasan" | Final payment amount | 尾款金额 | |
| **Titipan** | Titipan pajak (klien) | Tax deposit | 代收税款 / 代收客户税款 | |
| | "titipan negara" (PPN) | held for the state | 代国家收取 | |
| | Aturan "titipan dulu" | tax deposit first | 代收税款优先 | "(titipan pajak dulu, lalu PPN)" → （先抵代收税款，再抵增值税）. |
| **Penyesuaian** | Tipe kategori `adjustment`; menu "Transfer & Penyesuaian" | Adjustment | 调整 | Koreksi saldo. |
| | Bagian editor invoice "Penyesuaian dan total" (diskon + PPN) | Adjustments | 调整项 | Bukan jurnal penyesuaian akuntansi. |
| **Invoice (ZH)** | Seluruh aplikasi | Invoice | 账单 | 发票 di Tiongkok daratan berarti **fapiao**, dokumen pajak resmi yang diterbitkan lewat sistem pajak negara, dan padanannya di sini adalah *faktur pajak* (税务发票). Bila Invoice → 发票, kolom "No. faktur pajak" di sebelahnya tidak bisa dibedakan (cacat terjemahan lama). 销售发票 tetap mengandung 发票. 请款单 terlalu internal. 账单 = dokumen tagihan komersial tanpa status pajak, lazim di layanan daring zh-CN (mis. konsol Alibaba Cloud memisahkan 账单 dari 发票管理). Risiko #1. |
| **Modal** | Ekuitas ("Modal Pemilik", "setoran modal") | Capital | 资本 / 业主资本 / 业主注资 | |
| | Biaya ("tutup modal dulu"; deskripsi Laba Rugi "Ringkasan pendapatan, modal, beban…") | Cost | 成本 | "modal" di sini = HPP. "Ringkasan pendapatan, modal, beban, dan laba bersih perusahaan" → 公司收入、成本、费用与净利润汇总. |
| **Setor / Setoran** | Ke negara (pajak) | Remit | 缴纳 | "Setor PPN" → 缴纳增值税. |
| | Modal pemilik | Contribute | 注资 | |
| | Uang tunai ke bank | Deposit | 存入 | |
| **Lunas** | Semua modul | Paid / Paid off | 已结清 | EN: invoice & reimbursement "Paid", utang & piutang "Paid off". |
| **Aktif** | Utang & piutang | Active | 还款中 | |
| | Pengguna, klien, template, perusahaan | Active | 启用 | |
| | Sakelar/keadaan ("PKP aktif", "selama PKP aktif") | On / enabled | 开启 | |
| **Termin** | Invoice "Termin (hari)" | Payment terms (days) | 账期（天） | Jarak tanggal invoice → jatuh tempo. |
| | Utang/piutang ("Rencana {n} termin", "termin berikutnya") | Installment | 期 | "termin berikutnya" → 下一期. |
| **Cair / Cairkan / Pencairan** | Pengajuan Dana | Disburse | 拨付 | Dipakai ulang. |
| | Piutang (uang perusahaan keluar ke debitur) | Disburse | 放款 | "Piutang disetujui dan dicairkan" → 应收借款已批准并放款. 放款 adalah istilah baku pencairan pinjaman. |
| | Utang (dana pinjaman masuk ke kita) | Proceeds received | 借款到账 | |
| **Pinjaman** | Umum | Loan | 借款 | |
| | "Pinjaman yang diterima perusahaan…" | Loans received | 公司借入的款项 | Deskripsi halaman Utang. |
| | Piutang karyawan/perusahaan | Employee loan / company loan | 员工借款 / 企业借款（借出） | |
| **Perusahaan** | Tenant / perusahaan kita (menu admin, pemilih perusahaan) | Company | 公司 | |
| | Jenis klien / jenis debitur | Company | 公司 | **[zh v1.2]** kuncinya sama dengan tenant (v1.1: 企业). Lawan dari 个人 / 员工. |
| **Penanggung jawab** | Akun kas | Custodian | 保管人 | |
| | Klien (`person_in_charge`, token template) | Person in charge | 负责人 | **[baku baru]** label form klien "PIC (Penanggung Jawab)" (KL01). |
| | Profil perusahaan ("Penanggung Jawab Keuangan") | Finance officer | 财务负责人 | |
| **Admin** | Peran | Admin | 管理员 | |
| | "Biaya Admin" | Admin fee | 手续费 | |
| **Deskripsi / Keterangan / Catatan** | Deskripsi (semua konteks) | Description | 描述 | **[zh v1.2]** (v1.1: 摘要 untuk catatan uang). Kunci `Deskripsi` dipakai bersama; "Deskripsi singkat transaksi" → 交易简要描述. Risiko #15. |
| | Keterangan | Notes / Description | 说明 | |
| | Catatan | Notes | 备注 | |
| **Ringkasan** | Menu & kartu ringkasan modul | Overview / Summary | 概览 | |
| | Ringkasan teks (judul masukan "Ringkasan singkat dan jelas") | Short summary | 简要概述 | |
| **Laba Rugi** | Kata benda (laporan, menu) | Profit & Loss | 损益表 | |
| | Kata sifat ("masuk Laba Rugi") | P&L | 损益 | |
| **Draft** | Status | Draft | 草稿 | **[baku baru]** "Draft · belum terbit" (dulu "· belum dikirim", INV03) → 草稿 · 未开具. Ejaan "Draf" menunggu keputusan T-1. |
| | "Simpan draft" / "Draft piutang dibuat" | Save draft / Receivable draft created | 保存草稿 / 应收借款草稿已创建 | |
| **Transfer** | Pindah dana antar rekening (kata benda/kerja, tipe kategori) | Transfer | 转账 | |
| | Metode pembayaran "Transfer bank" / "Transfer" | Bank transfer | 银行转账 | |
| | Deskripsi tersimpan "Transfer masuk - …" | — | (tidak diterjemahkan) | D8. |

---

## 4. Pemetaan yang sengaja tidak harfiah (untuk pemeriksa terjemah-balik T2)

Saat menerjemah-balik zh → id, pasangan di bawah ini **bukan** selisih makna. Selisih yang lain tolong dikembalikan ke T1.

| 中文 | Terjemah-balik harfiah | Sumber yang dimaksud |
|---|---|---|
| 账单 | tagihan | Invoice |
| 定期账单 | tagihan berkala | Invoice Berulang |
| 开具 / 开具账单 / 已开具 | menerbitkan / menerbitkan tagihan / sudah diterbitkan | Terbitkan / Terbitkan invoice / Terbit (**[baku baru]**, kini harfiah) |
| 转为账单 / 已转为账单 | jadikan tagihan / sudah dijadikan tagihan | Jadikan Invoice / Dijadikan invoice (**[baku baru]**) |
| 付款 / 登记付款 / 已付款 / 未付款 / 部分付款 | pembayaran / catat pembayaran / … | Pembayaran / Catat pembayaran / Sudah dibayar / Belum dibayar / Sebagian (**[zh v1.2]**, kini harfiah; untuk invoice hanya status) |
| 收款 / 登记收款 / 账单收款 / 收款记录 | penerimaan / catat penerimaan / penerimaan invoice | Pembayaran / Catat pembayaran / Pembayaran invoice (**[zh v1.3]**, aksi & catatan pembayaran invoice) |
| 税务客户经理（AR） | manajer klien pajak | Account Representative (**[zh v1.3]**) |
| 未付余额 | sisa belum dibayar | Sisa tagihan (**[zh v1.2]**) |
| 应付借款 / 应收借款 / 应付与应收 | pinjaman terutang / pinjaman tertagih / utang & tagihan | Utang / Piutang / Utang & Piutang |
| 筹资 | penghimpunan dana | Pendanaan |
| 损益表 / 计入损益 | laporan untung rugi / dibukukan ke L/R | Laba Rugi / masuk Laba Rugi |
| 收入 | pendapatan | Pemasukan **atau** Pendapatan |
| 支出 / 费用 | pengeluaran / biaya | Pengeluaran / Beban |
| 营业成本 | biaya usaha | HPP / Harga Pokok Penjualan |
| 企业所得税 | PPh badan | Pajak Perusahaan |
| 代收客户税款 / 代收税款 | pajak klien yang dipungut atas nama / pajak titipan | Titipan Pajak Klien / titipan pajak |
| 增值税纳税人（PKP） | wajib pajak PPN | PKP |
| 税务发票 | faktur pajak | Faktur pajak |
| 金额大写 | jumlah dalam huruf besar | Terbilang |
| 预付款 / 尾款 | pembayaran di muka / sisa akhir | Uang muka / Pelunasan |
| 待催收 | menunggu penagihan | Perlu ditagih |
| 已拒绝 / 拒绝 | ditolak / tolak | Ditolak / Tolak (**[zh v1.2]**, kini harfiah) |
| 还款中 | sedang dicicil | Aktif (utang/piutang) |
| 已结清 | sudah diselesaikan | Lunas |
| 备用金 / 保管人 / 限额 / 补足 | dana cadangan / penyimpan / batas / genapkan | Kas kecil / Penanggung jawab / Plafon / Isi ulang |
| 变量 | variabel | Token (penomoran invoice & template PDF; **[zh v1.2]**) |
| 区段 / 正文 / 随文页脚 / 固定页脚 | bagian / isi teks / footer ikut teks / footer tetap | Band / Konten / Footer Flow / Footer Tetap (**[zh v1.2]**) |
| 明细表 / 明细字段 | tabel rincian / kolom rincian | Tabel Item / Field Item (**[zh v1.2]**) |
| 创建副本 | buat salinan | Gandakan / Duplikat (**[zh v1.2]**) |
| 网站图标 | ikon situs | Favicon (**[zh v1.2]**) |
| 借款到账账户 / 放款途径 | rekening penerimaan pinjaman / jalur pencairan | Rekening penerima pencairan (utang) / Pencairan lewat (piutang) (**[zh v1.2]**) |
| 每月还款额 | jumlah pelunasan per bulan | Angsuran / bulan, Cicilan / bulan (**[zh v1.2]**) |
| 待实现利润 | laba yang belum terealisasi | Laba Belum Diterima (**[zh v1.2]**) |
| 概览 | ikhtisar | Ringkasan |
| 登记 / 新增 / 新建 | daftarkan / tambah baru / buat baru | Catat / Tambah / Buat |
| 转出合计 | total keluar | Total Keluar (dialog Transfer; **[baku baru]**, kini harfiah) |
| 流出 / 流入 (arah mutasi) | uang keluar / uang masuk | Uang keluar / Uang masuk (**[baku baru]**, dulu "debit / kredit") |
| 基础资料 | data dasar | Master Data |
| 服务项目 | item layanan | Layanan |

---

## 5. Keputusan berisiko: paling perlu diperiksa penutur asli

| # | Keputusan | Alasan | Alternatif yang ditolak | Yang perlu dinilai penutur asli |
|---|---|---|---|---|
| 1 | Invoice → **账单**, bukan 发票 | 发票 di Tiongkok daratan = fapiao (dokumen pajak resmi). Padanan fapiao di sini adalah faktur pajak (税务发票). Terjemahan lama menabrakkan keduanya. | 发票, 销售发票, 请款单 | Apakah akuntan Tionghoa di Indonesia lebih terbiasa menyebut invoice komersial 发票, dan apakah 账单 terasa "tagihan konsumen". |
| 2 | Terbit → **已开具**; Terbitkan → **开具** (**[baku baru]**) | Aplikasi tidak mengirim apa pun; aksinya memberi nomor resmi. Sumber kini satu kata kerja (INV01–INV03), jadi yang tersisa hanya soal kolokasi. | 已发送 / 发送账单 | Apakah 开具账单 wajar (kolokasi baku: 开具发票). |
| 3 | Utang → **应付借款**, Piutang → **应收借款**, grup → **应付与应收** | Simetris dan tak ambigu. 借款 saja bisa berarti piutang karyawan (员工借款); 应收账款 = piutang dagang. | 贷款, 借款, 应收账款, 应收款 | Apakah label menu terlalu panjang atau kaku. |
| 4 | Pendanaan → **筹资** | Mencerminkan sumber dan istilah laporan arus kas PRC. Namun sumber juga memasukkan setor PPN & titipan pajak ke Pendanaan, yang di PRC termasuk aktivitas operasi. | 融资, 资金往来, 非损益 | Apakah "缴纳增值税" di bawah label 筹资 membingungkan akuntan. |
| 5 | Titipan pajak → **代收税款**; Titipan Pajak Klien → **代收客户税款** | Dana pass-through (PRC: 其他应付款—代收款项). | 税金寄存 (lama), 代扣代缴, 暂收款 | Apakah 代收 bisa disangka pemungutan resmi oleh pemungut pajak. |
| 6 | PKP → **增值税纳税人（PKP）**; faktur pajak → **税务发票** | Deskriptif dan bebas kategori khusus PRC. | 一般纳税人, 增值税发票, 税票 | Apakah 增值税纳税人 cukup membedakan PKP dari non-PKP. |
| 7 | Laba Rugi → **损益表**; Pajak Perusahaan → **企业所得税** | 损益表 satu akar dengan 计入损益. Grup `tax` memang berisi PPh Badan. | 利润表; 公司税费 | Apakah 损益表 terasa usang di PRC; apakah 企业所得税 terlalu spesifik untuk label "Pajak Perusahaan". |
| 8 | Pemasukan dan Pendapatan sama-sama → **收入** | Pasangan 收入/支出 paling alami untuk uang masuk/keluar. Pembeda dibawa kata majemuk (营业收入) dan label "(计入损益)". | 进账, 收款, 流入 | Apakah tab 收入 yang juga memuat baris 筹资 menyesatkan. |
| 9 | Arah mutasi bank → **流出/流入**; "Total Keluar" (Transfer) → **转出合计** (**[baku baru]**) | Sumber kini "Uang masuk/keluar" dan "Total Keluar" (KB02); 借/贷 hanya di kotak Jurnal, sehingga tidak ada lagi arah yang terbalik di layar yang sama. | 借方合计 | Apakah pemisahan ini jelas bagi akuntan. |
| 10 | Kas kecil → **备用金**, Plafon → **限额**, Isi ulang → **补足**, Penanggung jawab → **保管人** | Persis sistem imprest (定额备用金). | 零用金 (TW), 定额, 补充, 负责人 | Apakah 补足 jelas sebagai tombol. |
| 11 | Modal Pemilik → **业主资本**, Prive → **业主提款** | Pasangan istilah buku teks untuk usaha milik pemilik. | 实收资本, 利润分配 | Apakah 业主提款 dikenali pengguna non-akuntan. |
| 12 | Beban Operasional → **运营费用**; Pendapatan/Beban Lain → **其他收入/其他费用** | Kategori aplikasi tidak memetakan 1:1 ke pos PRC (销售/管理/财务费用, 营业外收支). | 营业费用, 营业外收入/支出 | Apakah label ini terasa "tidak baku". |
| 13 | Ditolak → **已拒绝**, Tolak → **拒绝** (**[zh v1.2]**; v1.1: 已驳回 / 驳回) | Kunci `Tolak` juga tombol penolakan akses OAuth Claude; satu pasangan untuk semua layar. | 已驳回 / 驳回 | Apakah 已拒绝 cukup menyiratkan bahwa pengajuan masih bisa diperbaiki & diajukan ulang. |
| 14 | Lunas → **已结清** di semua modul; aksi & catatan pembayaran invoice → **收款** (konteks `invoice`), status & sisa invoice tetap **已付款 / 未付款 / 部分付款 / 未付余额** (**[zh v1.3]**; v1.2: semua 付款; v1.1: invoice 收款) | Arah uang invoice terbaca benar pada tombol dan riwayat; status memakai konvensi status tagihan dan kuncinya dipakai bersama di layar non-invoice. | 收款 juga untuk status (已收款 / 部分收款 / 未收余额) | Apakah campuran 登记收款 (tombol) + 已付款 (status) di satu panel terasa janggal bagi akuntan. |
| 15 | Deskripsi → **描述** di semua konteks (**[zh v1.2]**; v1.1: 摘要 untuk catatan uang) | Kunci bersama; 描述 jelas bagi pengguna non-akuntan. | 摘要, 说明 | Apakah kolom 描述 di daftar transaksi terasa kurang baku dibanding 摘要. |
| 16 | Uang muka → **预付款**, Pelunasan → **尾款**, Perlu ditagih → **待催收**, Terbilang → **金额大写** | Kolokasi tagihan B2B Tiongkok. | 首付款, 结算, 逾期, 大写 | Apakah 催收 terasa terlalu keras (konotasi penagihan utang macet). |
| 17 | Gaya: **spasi** antara Han dan Latin/angka; akronim berkurung hanya di label (U7, Z8) | Konsisten dengan UI zh-CN Apple/Microsoft. Aturan "pertama di layar" tidak bisa dijamin per kunci. | Tanpa spasi (gaya penerbitan PRC) | Apakah tampilan berspasi terasa wajar. |
| 18 | Desimal literal tetap format Indonesia (`0,5%`) di EN & ZH | Konsisten dengan angka dari formatter `id-ID` di layar yang sama (D6). | `0.5%` | Apakah koma desimal membingungkan pembaca Mandarin/Inggris. |
| 19 | Aktif (utang/piutang) → **还款中**; Aktif (pengguna dll.) → **启用** | Status pinjaman ≠ status akun. | 活跃 (lama), 有效 | — |
| 20 | Jadikan Invoice / Dijadikan invoice (Invoice Berulang) → **转为账单 / 已转为账单**, terpisah dari 开具 (**[baku baru]**) | Hasilnya invoice Draft tanpa nomor (RI03). | 发布, 开具, 生成账单 | Apakah 转为账单 jelas untuk "memindahkan ke menu Invoice". |
| 21 | Token (penomoran invoice & template PDF) → **变量** (**[zh v1.2]**) | "插入变量" lazim di templat SaaS Tiongkok; 令牌 bermakna token keamanan. | 令牌, 占位符, 标记 | Apakah 变量 jelas untuk `{NO}`, `{PT}`. |
| 22 | Band → **区段**; Header / Konten / Footer Flow / Footer Tetap → **页眉 / 正文 / 随文页脚 / 固定页脚**; Banded → **分段布局** (**[zh v1.2]**) | Istilah penyusun laporan dibuat terbaca orang awam. | 带区, 数据带, 栏 | Apakah 随文页脚 jelas untuk footer yang menempel setelah konten. |
| 23 | Kunci `Masuk` / `Keluar` (bersama login & arah uang) → makna autentikasi **登录 / 退出登录** (**[zh v1.2]**) | Satu kunci, satu terjemahan; salah di grafik lebih ringan daripada salah di tombol masuk. | 流入 / 流出 | Bukan soal bahasa: kodenya perlu konteks `arah`. |
| 24 | Contoh di placeholder dilokalkan (张伟; 主管、审计员、经理; 员工工资; 月度服务费) kecuali yang harus cocok dengan dokumen/data Indonesia (PT …, KSN, BCA, TRF-…, `(Tanpa Invoice)`) (**[zh v1.2]**) | Contoh harus terasa wajar; data tersimpan tetap apa adanya (D8). | Membiarkan contoh Indonesia | Apakah contoh nama peran Mandarin bertentangan dengan catatan "nama diubah ke huruf kecil". |

---

## 6. Temuan di sumber (janggal / tidak konsisten)

Untuk orkestrator dan pemilik modul. Glosarium sudah menetapkan cara menerjemahkannya.
**v1.1:** butir 1, 2, 3, 5, dan 6 (label klien) kini ditangani lewat [`perapian-id.md`](perapian-id.md); butir 4 (mojibake) dan 8 (`Tunai`) ada di §8 dan §4.3 dokumen itu.

1. **Kata Inggris di teks sumber Indonesia** sehingga kuncinya berbahasa Inggris: status & prioritas Permintaan Dana (`Pending Review`, `Approved`, `Rejected`, `Disbursed`, `Low`…`Urgent`, `fund-requests/index.tsx`, `create.tsx`, `edit.tsx`); label feedback di `lang/id/feedback.php` (`Open`, `In Progress`, `Bug Report`, `Critical`…); Invoice Berulang (`Published`, `Publish Invoice`); halaman izin (`Total Permission`, `Beri Semua Permission`, "Beri akses user lain"); menu `Feedback`; kategori `Parent`/`Sub Kategori`. Tampilan ID tetap campur; EN/ZH akan bersih.
2. **Satu aksi, dua kata kerja**: "Kirim invoice" (drawer) dan "Terbitkan"/"Simpan & terbitkan" (editor) melakukan hal yang sama. Status "Terkirim" padahal dialog sendiri menyatakan klien tidak menerima email.
3. **"Total Debit" bertentangan dengan kotak Jurnal** di dialog Transfer (`bank-accounts/components/transfer-dialog.tsx:251`) dan Detail Transfer (`cash-flow/components/transaction-detail-dialog.tsx:620`): angka itu adalah rekening asal di sisi **Kredit** jurnal. Teks kosong Ringkasan juga memakai "transaksi debit/kredit" dalam arti rekening koran. Pertimbangkan mengganti teks ID menjadi "Total keluar".
4. **Mojibake** (UTF-8 tersandi ganda) di `resources/js/pages/settings/pdf-templates/edit.tsx`, 29 baris. Sebagian tampil di layar: `Menyimpanâ€¦`, `Tinggi otomatis â€” mengikuti jumlah baris item invoice.`, `Grid …Ã—…`, `title="Teks â€” klik tambah / seret ke band"`. **Perbaiki encoding sebelum membungkus dengan `t()`**, kalau tidak kunci kamus berisi karakter rusak.
5. **Variasi untuk konsep yang sama** membuat kunci kembar: "Lewat tempo" / "lewat jatuh tempo" / "Perlu ditagih"; "Harga Pokok (HPP)" / "Harga Pokok Penjualan (HPP)"; "Belum diklasifikasi" / "Belum Diklasifikasi"; "Edit" / "Ubah"; "Permintaan Dana" (menu) / "pengajuan dana" (teks); "Izin & Peran" (menu) / "Manajemen Peran & Permission" (judul).
6. **"Penanggung jawab" bermakna tiga**: pemegang kas (`custodian_id`), PIC klien (`client.person_in_charge`, `TemplateTokens`), dan pejabat keuangan di Profil perusahaan.
7. **"Modal" bermakna dua**: ekuitas ("Modal Pemilik") dan biaya ("tutup modal dulu"; deskripsi halaman Laba Rugi "Ringkasan pendapatan, modal, beban, dan laba bersih").
8. **Nilai sistem tersimpan yang tampil di UI** akan tetap Indonesia di EN/ZH (D8): nama bank `Tunai` untuk akun kas (label "Kas Kecil — Tunai"), deskripsi tersimpan "Transfer + Admin Fee - …" (campur Inggris), dan deskripsi isian awal "Isi ulang {nama}" di dialog Isi ulang. Usul: label akun kas dirangkai saat tampil dari `type`, dan isian awal "Isi ulang {nama}" **tidak** diterjemahkan (yang tersimpan tetap Indonesia).
9. **Tanggal & waktu keras di kode**: array bulan `MONTHS` ('Jan'…'Mei'…'Agt'…) dan "hari ini / kemarin / {n} hari lalu" di `invoices/components/ob.tsx`. Harus pindah ke helper tanggal (A2), bukan dijadikan kunci terjemahan.
10. **Pajak & regulasi**: "Pendanaan" mencakup setor PPN & titipan pajak (secara akuntansi bukan pendanaan, tetapi sengaja diputuskan pemilik, Opsi A). `lang/id/invoice.php` `pph_final_note` masih merujuk PP 23/2018, padahal rekap PDF memakai PP 55/2022 yang menggantikannya. Hanya berdampak ke PDF (selalu ID).
11. **Berkas `lang/zh` lama** (lihat §7): `common.php` berisi nilai yang belum diterjemahkan (`expand_sidebar` = "Perlebar sidebar", `optional` = "opsional", blok "Hapus Akun"/"Password Saat Ini"); `invoice.php` menabrakkan `invoice` dan `faktur` (keduanya 发票); `dpp`, `pph`, `tax_deposit`, `balance_due` salah konsep. Setelah K2, `lang/zh/invoice.php` praktis mati (dipakai PDF yang kini selalu ID).
12. **"Jumlah" yang tidak jelas tanpa membaca kode**: "berdasarkan jumlah invoice" (`invoices/index.tsx:309`, di bawah bar sebaran status) bisa terbaca nominal, padahal maksudnya **banyaknya** invoice → EN "by number of invoices", ZH 按账单数量. Pola serupa wajib dicek konteksnya (§3 *Jumlah*).

---

## 7. Pilihan terjemahan lama: dipakai ulang vs diganti

| Berkas › kunci | Lama | Keputusan | Alasan singkat |
|---|---|---|---|
| `invoice.php` › `invoice`, `common.php` › `invoices` | 发票 | → 账单 | Fapiao; bertabrakan dengan faktur pajak (§3). |
| `invoice.php` › `faktur` | 发票 | → 税务发票 | Idem. |
| `invoice.php` › `npwp` | 税号 | Dipakai ulang → 税号（NPWP） | Ringkas dan lazim. |
| `invoice.php` › `ppn` | 增值税 | Dipakai ulang → 增值税（PPN） | |
| `invoice.php` › `pph` | 预扣税 | → 所得税（PPh） | Terlalu sempit (hanya pemotongan). |
| `invoice.php` › `dpp` | 应税所得 | → 计税依据（DPP） | Salah konsep (penghasilan kena pajak). |
| `invoice.php` › `tax_deposit` | 税金寄存 | → 代收税款 | 寄存 = titip barang/bagasi. |
| `invoice.php` › `down_payment` | 首付款 | → 预付款 | Konotasi KPR/kendaraan. |
| `invoice.php` › `settlement` | 结算 | → 尾款 | 结算 = kliring/checkout. |
| `invoice.php` › `balance_due` | 应付余额 | → 未收余额 | 应付 = utang kita. |
| `invoice.php`, `pages.php` › `sent` | 已发送 | → 已开具 | Tidak ada pengiriman email. |
| `invoice.php` › `say` | 大写 | Dipakai ulang → 金额大写 | |
| `common.php` › `dashboard` | 仪表板 | → 概览 | Sumber kini "Ringkasan". |
| `common.php` › `recurring_invoices` | 循环发票 | → 定期账单 | |
| `common.php` › `bank_accounts` | 银行账户 | → 现金与银行 (menu) | Menu kini mencakup kas. |
| `common.php` › `loans` | 贷款 | → 应付借款 | Sudut pandang pemberi pinjaman. |
| `common.php` › `receivables` | 应收账款 | → 应收借款 | Piutang dagang ≠ pinjaman yang diberikan. |
| `common.php` › `debt_receivables` | 债务与应收账款 | → 应付与应收 | |
| `common.php` › `master_data` | 主数据 | → 基础资料 | Istilah ERP Tiongkok. |
| `common.php` › `active` | 活跃 | → 启用 / 还款中 (per konteks) | 活跃 = ramai/aktif terlibat. |
| `common.php` › `rejected` | 已拒绝 | Dipakai ulang → 已拒绝 | **[zh v1.3]** v1.1 sempat menggantinya dengan 已驳回; sejak v1.2 kembali 已拒绝 (lihat §2.4 *Ditolak*). |
| `common.php` › `logout`/`log_out` | 登出 | → 退出登录 | Bentuk lazim zh-CN. |
| `common.php` › `light`/`dark` | 亮色 / 暗色 | → 浅色 / 深色 | Istilah tema zh-CN. |
| `feedback.php` › `priority_critical` | 紧急 | → 严重 | Hindari tabrakan dengan Urgent (紧急). |
| `feedback.php` › `status_in_progress` | 进行中 | → 处理中 | Pola tiket. |
| `common.php`, `pages.php` › `income`/`expenses` | 收入 / 支出 | Dipakai ulang | |
| `pages.php` › `disburse*` | 拨付 | Dipakai ulang | |
| `pages.php` › `initial_balance` | 初始余额 | Dipakai ulang | |
| `pages.php` › `*_proof` | 凭证 | Dipakai ulang | |
| `common.php` › `reimbursements`, `fund_requests`, `clients`, `categories`, `settings`, `users`, `notifications` | 报销, 资金申请, 客户, 类别, 设置, 用户, 通知 | Dipakai ulang | |
| `feedback.php` (sisa) | — | Dipakai ulang | Mutu baik; hanya dua kunci di atas yang diganti. |
