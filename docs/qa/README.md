# QA — Finance Management (branch `multi-tenancy`)

Rekaman pengujian yang bisa ditelusuri ulang orang lain: setiap test case punya
ekspektasi tertulis, eksekusi lewat UI sungguhan, bukti layar per langkah, dan
verifikasi ke database — bukan sekadar klaim "sudah dites".

## Lingkungan uji (WAJIB dicatat, jangan diubah diam-diam)

| Aspek | Nilai |
|---|---|
| Branch | `multi-tenancy` (`156ff9f`) |
| APP_ENV | `local` — **bukan production** |
| Database pusat | `finance_central` (fresh `migrate:fresh --seed`) |
| Database perusahaan | `tenant_kisantra`, `tenant_semesta` |
| DB lama (tidak disentuh) | `finance_management` — tetap utuh, bukan target uji |
| URL | `http://127.0.0.1:8000` (`php artisan serve`) |
| Browser | Chrome via Chrome DevTools MCP, viewport dicatat per modul |
| Redis | session/cache/queue lokal (`SESSION_CONNECTION=default`) |

**Isolasi:** aplikasi menunjuk `finance_central`, database khusus QA hasil seed
ulang. Tidak ada data produksi yang tersentuh.

### Akun uji (semua password `password`)

| Email | Role | Perusahaan | Dipakai untuk |
|---|---|---|---|
| `admin@gmail.com` | admin | kisantra | Akses penuh, uji admin-only |
| `manager@gmail.com` | finance manager | kisantra + semesta | Approve/pay/disburse, uji lintas perusahaan |
| `staff@gmail.com` | staff | kisantra | Uji pembatasan permission & kepemilikan |

### Data awal hasil seeder (tenant_kisantra)

4 invoice (Jan–Mar 2026), 5 klien, 3 rekening bank (saldo awal Rp 180 jt),
10 transaksi bank, 28 kategori. `tenant_semesta` kosong (hanya 28 kategori) —
sengaja, dipakai untuk membuktikan isolasi data antar perusahaan.

> Data seed bertanggal Jan–Mar 2026 sedangkan hari uji Agustus 2026. Banyak
> halaman default memfilter **bulan berjalan**, sehingga tampil kosong. Ini
> perilaku benar, bukan bug — test case selalu menyebut filter yang dipakai.

## Cara membaca tabel test case

| Kolom | Isi |
|---|---|
| **ID** | `N##` normal, `A##` abnormal/edge, `C##` berantai (lintas aktor/modul). Stabil selamanya — laporan merujuk ID ini |
| **Skenario** | Satu baris: apa yang diuji |
| **Langkah** | Nilai input konkret, bukan "isi form" |
| **Hasil Diharapkan** | Hasil yang bisa diamati; bila error, kutip pesan yang seharusnya muncul |
| **Lapisan** | `FE`, `BE`, atau `FE+BE` — siapa yang **wajib** menegakkan aturan |
| **Hasil Aktual** | Diisi saat eksekusi; kutip pesan & ID sungguhan |
| **Status** | `Pass` / `Fail` / `Blocked` / `Belum diuji` |

**Kenapa kolom Lapisan penting:** aturan yang hanya ditegakkan di frontend
sama dengan tidak ditegakkan — seseorang bisa memanggil endpoint langsung.
Case ber-`FE+BE` diuji dua kali: lewat UI, lalu lewat request langsung.

## Status

| Status | Arti |
|---|---|
| `Pass` | Dieksekusi, berperilaku sesuai harapan |
| `Fail` | Dieksekusi, tidak sesuai harapan → wajib punya entri bug |
| `Blocked` | Tidak bisa dijalankan (prasyarat/lingkungan) |
| `Belum diuji` | Belum dicoba — tidak pernah dibulatkan jadi Pass |

Case yang lolos setelah perbaikan tetap `Pass`, tetapi Hasil Aktual wajib
memuat riwayatnya: gagal → sebab → perbaikan → lolos.

## Struktur folder

```
docs/qa/
├── README.md              ← file ini (lingkungan + cara baca)
├── test-cases/<modul>.md  ← test case + hasil aktual + bukti per langkah
├── evidence/<modul>/      ← screenshot — LOKAL SAJA, tidak masuk git
└── report/                ← laporan PDF per modul  ← yang dipush
```

**Tangkapan layar sengaja tidak disimpan di git.** Yang didorong ke repositori
adalah laporan jadinya, dan gambar-gambar itu **tertanam di dalam PDF** (148
gambar di 18 laporan) — jadi bukti visualnya tetap ikut, tetap bisa ditinjau
siapa pun yang membuka laporannya, tanpa menambah 79 berkas PNG ke riwayat.

Konsekuensi yang perlu diketahui:

- Pada salinan hasil `clone`, `build_reports.py` **tidak bisa** membangun ulang
  PDF karena gambarnya tidak ada. PDF yang sudah ada tetap terbaca utuh.
- `check_evidence.py` mendeteksi keadaan itu dan berhenti menuduh "utang bukti" —
  gerbang itu hanya bermakna di mesin yang benar-benar menjalankan QA.
- Untuk memulihkan gambar, QA harus dijalankan ulang terhadap aplikasi hidup
  dengan data yang setara. Karena itu, jangan hapus folder `evidence/` di mesin
  yang memegang hasil QA.

## Sumber test case

Setiap file test case merujuk dokumentasi modulnya di
[`docs/module/`](../module/README.md). Bagian **Invarian & Jebakan** di dokumen
modul adalah sumber test case bernilai tertinggi — di situlah aturan yang mudah
dilanggar sudah dituliskan.

## Lapisan menentukan bukti yang wajib ada

Kolom **Lapisan** bukan catatan tentang bagaimana case dijalankan. Ia klaim
tentang apa yang dijangkau case itu:

| Nilai | Arti | Kewajiban bukti |
|---|---|---|
| `FE` | Bisa dicapai pengguna dari layar | **Wajib tangkapan layar per langkah** |
| `FE+BE` | Bisa dari layar sekaligus dipanggil langsung | **Wajib tangkapan layar** + panggilan langsung + verifikasi DB |
| `BE` | Tidak terjangkau UI sama sekali — payload yang tidak pernah dikirim form, fixture yang hanya bisa dibuat di DB, invarian di bawah layar | Tidak perlu gambar, tetapi Hasil Aktual wajib menyebut *kenapa* UI tidak bisa mencapainya |

Menandai `FE+BE` lalu menjalankannya lewat HTTP saja menghasilkan laporan yang
mengklaim cakupan layar yang tidak pernah diperoleh — lebih buruk daripada
mengaku `BE`, karena tidak ada yang tahu harus kembali memeriksanya.

## Pipeline

```bash
python docs/qa/build_manifests.py   # test-cases/*.md  -> manifests/*.json
python docs/qa/check_evidence.py    # GERBANG: gagal selama case FE belum bergambar
python docs/qa/build_reports.py     # manifests/*.json -> report/*.pdf
python docs/qa/shrink_evidence.py   # kecilkan tangkapan layar
```

`build_reports.py` hanya membangun ulang PDF yang manifest atau tangkapan
layarnya memang berubah. Ini bukan sekadar penghematan waktu: PDF adalah berkas
biner yang tidak bisa dipadatkan terhadap versi sebelumnya, sehingga membangun
ulang ke-18-nya di setiap commit menumpuk ratusan kilobyte ke riwayat git
selamanya. Pakai `--paksa` bila memang perlu membangun ulang semuanya.

`check_evidence.py` keluar dengan status 1 selama masih ada case ber-lapisan
`FE`/`FE+BE` tanpa gambar, dan menandai case yang punya gambar tetapi berlabel
`BE` — entah labelnya salah, entah gambarnya cuma hiasan. Jalankan sebelum
membangun laporan; angkanya juga jadi ukuran kemajuan yang tidak bisa dikarang.

## Hasil putaran kedua (per modul, lewat layar)

Seluruh 18 modul dijalankan ulang satu per satu. Kolom Lapisan direklasifikasi
berdasarkan **apa yang dijangkau case**, bukan bagaimana case kebetulan
dijalankan, lalu setiap case ber-lapisan FE ditutup bukti layarnya.

```
668 case | butuh bukti UI: 149 | sudah bergambar: 149 (100%)
```

### Yang tersisa

| | jumlah |
|---|---|
| Case berstatus `Fail` | **1** dari 668 |
| Temuan tanpa perbaikan | **2** dari 76 |

Ketiganya bukan pekerjaan yang terlewat, melainkan yang sengaja tidak diputuskan
sepihak:

| Item | Alasan ditunda |
|---|---|
| invoices A18 / TEMUAN I-01 | Penomoran invoice manual dipertahankan sesuai keputusan produk. Dua akibatnya yang membuat aplikasi macet (invoice terkunci tak bisa rollback, preview urutan salah bulan) **sudah** ditutup. |
| services TEMUAN S-02 | Apakah nama layanan wajib unik adalah keputusan produk: menambah `unique` sepihak akan menolak penyuntingan baris yang selama ini normal bila di produksi sudah ada nama kembar yang sah. Bagian yang aman sudah dikerjakan — pemilih layanan menampilkan `tipe · harga` sehingga nama kembar tetap terbedakan. |

Dua hal lain diperbaiki **sebagian** dan sisanya dicatat sebagai **MASIH TERBUKA**
di modulnya: nominal bunga piutang yang disimpan sebagai persentase
(receivables BUG-C5 — pergeseran ditekan ~100× tetapi pembulatan tetap
pembulatan) dan sumber inisial perusahaan pada nomor invoice (invoices I-01 —
mengubahnya membuat nomor baru berbeda pola dari yang sudah terbit).

## Utang bukti visual pada putaran pertama

Putaran QA pertama dijalankan 5 agen paralel sementara Chrome DevTools MCP
hanya punya satu peramban, sehingga tidak ada agen yang bisa mengemudikan UI
dan seluruh eksekusi jatuh ke HTTP. Ironisnya bug paling penting yang ditemukan
(menu 404 setelah login) hanya terlihat dari layar, dan penangkapan susulan
secara serial langsung menemukan satu lagi (teks dialog hapus klien) yang
mustahil terlihat dari HTTP.

Case yang benar-benar dijalankan lewat layar dicatat sebagai case tersendiri —
bukan ditempelkan ke ID case lama yang isinya berbeda. Sisa utangnya nyata dan
angkanya keluar dari `check_evidence.py`, bukan dari klaim.

## Batasan yang jujur diakui di muka

- Sebagian kode yang diuji ditulis oleh asisten yang sama yang menjalankan
  pengujian ini → ada risiko pengujian mewarisi asumsi yang sama. Bagian
  "Catatan kejujuran" tiap laporan menyebut hal konkret yang perlu dicek manusia.
- Kondisi yang tidak bisa dicapai dari UI (mis. data legacy) diuji di level
  DB/endpoint dan **dinyatakan demikian**, tidak dikarang seolah lewat layar.
