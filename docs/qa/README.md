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
├── evidence/<modul>/      ← screenshot, nama file <CASE-ID>-<langkah>.png
└── report/                ← laporan terkompilasi per modul + ringkasan
```

## Sumber test case

Setiap file test case merujuk dokumentasi modulnya di
[`docs/module/`](../module/README.md). Bagian **Invarian & Jebakan** di dokumen
modul adalah sumber test case bernilai tertinggi — di situlah aturan yang mudah
dilanggar sudah dituliskan.

## Cakupan bukti visual (jujur, per modul)

Sebagian besar case dieksekusi lewat **HTTP dengan cookie sesi asli**, bukan
lewat layar. Itu sah dan tercatat apa adanya, tetapi bukan bukti UI. Tabel di
bawah menyatakan berapa banyak langkah yang benar-benar ditangkap dari peramban
per modul — sisanya tidak punya tangkapan layar, dan tidak diklaim punya.

| Modul | Langkah ber-tangkapan layar | Sifat bukti |
|---|---|---|
| fund-requests | 8 | Alur berantai penuh lewat UI: ajukan → setujui → cairkan + unggah bukti → berkas terbuka |
| clients | 6 | Buat klien lewat form + dialog hapus yang diperbaiki di sesi ini |
| transaction-categories | 4 | Pindahkan-lalu-hapus kategori terpakai, diverifikasi ke DB |
| auth-multitenancy | 3 | Login, pemilih perusahaan, sidebar ber-prefix perusahaan |
| cash-flow | 3 | Input pengeluaran termasuk pemilih kategori berjenjang |
| services | 3 | Tambah layanan dan dampaknya ke statistik |
| settings | 2 | Profil pribadi + Profil Perusahaan setelah BUG-SET-06 |
| bank-accounts, dashboard, feedbacks, invoices, loans, notifications, profit-loss, receivables, recurring-invoices, reimbursements, admin-users-permissions | 1 masing-masing | Halaman utama modul saja — alur di dalamnya dieksekusi lewat HTTP |

Kekurangan ini nyata dan disebabkan pilihan eksekusi: putaran QA pertama
dijalankan 5 agen paralel, sedangkan Chrome DevTools MCP hanya punya satu
peramban — sehingga agen tidak bisa mengemudikan UI dan seluruh eksekusi jatuh
ke HTTP. Ironisnya bug paling penting yang ditemukan (menu 404 setelah login)
hanya terlihat dari layar. Penangkapan layar susulan dilakukan serial oleh
supervisor, dan langsung menemukan satu cacat lagi (teks dialog hapus klien)
yang tidak mungkin terlihat dari HTTP.

## Batasan yang jujur diakui di muka

- Sebagian kode yang diuji ditulis oleh asisten yang sama yang menjalankan
  pengujian ini → ada risiko pengujian mewarisi asumsi yang sama. Bagian
  "Catatan kejujuran" tiap laporan menyebut hal konkret yang perlu dicek manusia.
- Kondisi yang tidak bisa dicapai dari UI (mis. data legacy) diuji di level
  DB/endpoint dan **dinyatakan demikian**, tidak dikarang seolah lewat layar.
