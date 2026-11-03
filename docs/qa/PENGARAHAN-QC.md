# Pengarahan bersama — QC berbasis bukti

Dibaca SEMUA penguji sebelum mulai. Yang khusus per modul ada di spesifikasi
masing-masing; yang di sini berlaku untuk semuanya.

Repo: `D:/Laravel/finance-management`, branch `feature/multi-tenancy-rekonsiliasi`.
**JANGAN** pindah branch, `git commit`, `git stash`, atau `git reset`.
Bahasa laporan: **Indonesia** (mengikuti dokumentasi repo).

---

## 1. Lingkungan — terisolasi, dan itu wajib

QC sengaja mengirim data sampah, menekan tombol berkali-kali, dan merusak
fixture. Dijalankan terhadap database yang sedang dipakai orang, sampahnya
tinggal di sana.

Bangun lingkunganmu sendiri, satu perintah:

```bash
bash docs/qa/siapkan-lingkungan-qc.sh <slug> <port>   # slug & port ada di spec-mu
bash docs/qa/jalankan-qc.sh <slug> <port>             # biarkan jalan di latar
```

Menghasilkan `qc<slug>_central`, `tenant_qc<slug>satu`, `tenant_qc<slug>dua`,
dan `.env.qc<slug>`. Empat akun, sandi semuanya `QcUji#2026`:

| akun | peran | perusahaan |
|---|---|---|
| `qc<slug>-admin@qc.test` | admin | KEDUA |
| `qc<slug>-fm@qc.test` | finance manager | KEDUA |
| `qc<slug>-staff@qc.test` | staff | hanya `qc<slug>satu` |
| `qc<slug>-luar@qc.test` | admin | hanya `qc<slug>dua` — untuk uji akses silang |

**JANGAN** menyentuh `finance_main_dev`, `demo_central`, `.env`, atau lingkungan
QC penguji lain. Membongkar punyamu di akhir: tambahkan `--hapus`.

Perusahaan dibuat dari nol, jadi master data (kategori transaksi, profil
perusahaan) sudah ada — **data bisnis belum**. Buat fixture modulmu sendiri;
kamu yang paling tahu kombinasi status apa yang perlu diuji.

### Jebakan yang sudah terbukti — patuhi, ini menghemat berjam-jam

1. **Cookie MENGABAIKAN nomor port.** Semua penguji ada di `127.0.0.1`. Isolasi
   datang dari `SESSION_COOKIE` + `CACHE_PREFIX` yang sudah disetel di
   `.env.qc<slug>`-mu. Jangan menimpanya.
2. **`php artisan serve` MEMBUANG environment variable** sebelum meneruskannya
   ke proses yang melayani request. Pakai `jalankan-qc.sh`, jangan `artisan
   serve`. Gejala kalau dilanggar: server menyala, `/login` 200, tetapi halaman
   perusahaan 500 dengan nama database yang SALAH.
3. **`.env` dibaca sekali saat server START.** Mengubahnya tidak berpengaruh
   sampai server di-restart.
4. **JANGAN `npm run build`.** Aset sudah di-build dan `public/build` dipakai
   bersama; build serentak menghasilkan manifest separuh jadi. Kalau yakin
   perlu, `ask` dulu.
5. **JANGAN sentuh `phpunit.xml`.** Pernah dirusak komentar XML berisi `--`
   (ilegal di XML) dan mematikan seluruh suite.
6. Kalau `public/hot` muncul dan halaman jadi putih: itu sisa `npm run dev`.
   Laporkan, jangan hapus — berkas itu dipakai bersama.

---

## 2. Menggerakkan UI sungguhan

Memanggil API dalam loop menguji API, bukan aplikasi. **Harus lewat UI.**

Perkakasnya sudah terpasang DI LUAR repo supaya dependensi proyek tidak berubah:

```bash
cd D:/tmp/qa-tools          # playwright-core sudah ada di sini
export CHROME_EXE="$LOCALAPPDATA/ms-playwright/chromium-1243/chrome-win64/chrome.exe"
```

Contoh yang sudah terbukti jalan — login sampai dashboard:

```js
const { chromium } = require('playwright-core');
const b = await chromium.launch({ executablePath: process.env.CHROME_EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
await p.fill('input[type=email]', EMAIL);
await p.fill('input[type=password]', PASS);
await Promise.all([p.waitForURL(/choose-company|dashboard/), p.click('button[type=submit]')]);
```

Tulis skrip Node-mu sendiri di `D:/tmp/qa-tools/`, JANGAN di dalam repo.

**Periksa setiap tangkapan layar sebelum lanjut.** Otomasi buta menghasilkan
bukti yang meyakinkan untuk layar yang salah. Kalau yang terpotret halaman
sebelumnya, langkahnya tidak terjadi.

---

## 3. Merancang kasus uji

Tiga golongan, masing-masing menangkap kelas cacat berbeda:

- **N##  normal** — jalur yang dilalui pengguna tiap hari
- **A##  abnormal/batas** — input buruk, nilai batas, prasyarat hilang, status
  yang seharusnya dicegah UI, klik ganda
- **C##  berantai** — lintas aktor atau lintas modul (pengaju → penyetuju →
  kembali ke pengaju). Di sinilah cacat yang tidak pernah terlihat oleh
  pengujian satu aktor

Setiap kasus menyebut **lapisan** yang disentuhnya:

| lapisan | artinya | bukti yang WAJIB |
|---|---|---|
| `FE` | hanya antarmuka | tangkapan layar tiap langkah |
| `FE+BE` | antarmuka sampai database | tangkapan layar tiap langkah |
| `BE` | tidak terjangkau UI (payload buatan, fixture DB) | tidak perlu gambar, **tapi tulis alasan UI tidak bisa mencapainya** |

Aturan yang tidak bisa ditawar: **aturan yang hanya ditegakkan di klien sama
dengan tidak ditegakkan.** Kalau kasusmu berkata "ditolak", sebutkan SIAPA yang
menolak — kalau hanya tombolnya yang disabled, coba juga lewat HTTP langsung.

---

## 4. Memverifikasi

Layar menampilkan "Lunas" dan barisnya benar-benar lunas adalah dua klaim
berbeda. **Periksa ke database tenant yang bersangkutan**: status, baris
terkait, saldo, penomoran.

Dan periksa juga **efek samping yang SEHARUSNYA TIDAK terjadi**. Menghapus satu
kaki transfer tidak boleh menghapus transfer lain. Membatalkan pengajuan tidak
boleh memajukan langkah persetujuan berikutnya.

---

## 5. Kalau ada yang gagal

Kegagalan adalah tujuan pengujian, bukan kecelakaan.

1. Reproduksi, lalu cari sebab sebenarnya — bukan tebakan pertama yang masuk akal
2. Periksa apakah sebab yang sama mengenai tempat lain
3. **JANGAN perbaiki kode produksi.** Laporkan. Coordinator yang memutuskan dan
   memperbaiki — beberapa penguji menulis file yang sama akan saling menimpa
4. Kalau benar-benar memblokir sehingga kamu tidak bisa lanjut: `ask`, tunggu

Pengecualian: berkas di jalurmu sendiri (`docs/qa/<modul>*`, `D:/tmp/qa-tools/`)
bebas kamu tulis.

---

## 6. Aturan kejujuran — ini yang membedakan laporan berguna dari laporan menenangkan

- **Kegagalan perkakasmu sendiri BUKAN cacat aplikasi.** Kalau skripmu menekan
  tombol yang salah, itu bug-mu. Catat terpisah dari temuan nyata.
- **Kasus yang tidak dijalankan TIDAK boleh dihitung lulus.** Kalau 4 tidak
  jalan, laporannya "17 diuji", bukan "21".
- **Hitung angkanya dengan program**, dari tabelnya sendiri. Papan skor yang
  dihitung tangan selalu melenceng, dan pembaca yang menemukan satu angka salah
  berhenti mempercayai sisanya.
- **Bedakan terverifikasi-dengan-dijalankan dari terverifikasi-dengan-membaca-kode.**
  Keduanya sah; mencampurnya tidak.
- **Laporkan kegagalan lingkungan secara terbuka** — server mati, port bentrok,
  reload yang memakan form. Menyembunyikannya membuat celah tak terjelaskan
  terlihat seperti kelalaian.
- **Diagnosis dulu sebelum menyalahkan perkakas.** "Server terus reload" adalah
  klaim, dan bisa sesalah klaim apa pun tentang aplikasi. Periksa lognya.
- Kalau premis di spec-mu ternyata SALAH, katakan dan tunjukkan buktinya. Spec
  ditulis coordinator dari ingatan dan sudah beberapa kali terbukti keliru —
  koreksi beralasan adalah hasil yang bagus, bukan pembangkangan.

---

## 7. Keluaran

1. `docs/qa/kasus/<modul>.md` — tabel kasus + hasil nyata + status, dengan bukti
   per langkah tertaut
2. `docs/qa/bukti/<modul>/` — tangkapan layar, nama `<ID>-<langkah>.png`,
   **diperkecil ke lebar ~420px** (±30 KB). Tangkapan penuh membengkakkan repo
   tanpa menambah keterbacaan
3. Ringkasan di `worker_done`: jumlah diuji / lulus / gagal, temuan MEMBLOKIR,
   dan apa yang TIDAK sempat diuji

Setiap tangkapan layar punya keterangan: apa yang ditampilkan dan mengapa itu
penting. Keterangan itulah yang membuat gambar menjadi bukti, bukan hiasan.
