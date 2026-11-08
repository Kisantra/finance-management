# QA pra-rilis 6 November 2026 — Kas & Bank

Pengujian berbasis bukti sebelum deploy rilis yang memuat commit `cd01099`
(*feat(kas-bank): jenis akun Kas & Bank, penanggung jawab dan plafon kas kecil*).
Kode yang diuji: `main` lokal = `origin/main` `1c4c160` + `cd01099` (belum di-push saat QA).

Cara membaca tabel (kolom **Lapisan**, status, kewajiban bukti) mengikuti
[`docs/qa/README.md`](../README.md). Tata letak folder ini mengikuti konvensi yang sama
(`test-cases/`, `evidence/`, `manifests/`, `report/`), dikelompokkan per putaran QA.

| Berkas | Isi |
|---|---|
| [`test-cases/kas-bank.md`](test-cases/kas-bank.md) | 22 test case (N/A/C) + hasil aktual + bukti layar per langkah |
| [`report/Laporan-QA-kas-bank.md`](report/Laporan-QA-kas-bank.md) | Laporan: skor terhitung, ringkasan, hasil per case, catatan, kendala alat uji, catatan kejujuran |
| [`report/Laporan-QA-kas-bank.pdf`](report/Laporan-QA-kas-bank.pdf) | Laporan yang sama dalam PDF (gambar tertanam) |
| [`manifests/kas-bank.json`](manifests/kas-bank.json) | Sumber laporan & skor (dibaca skrip skill `qa-evidence`) |
| `evidence/kas-bank/` | 41 tangkapan layar, sudah dipotong ke wilayah yang relevan dan dikecilkan ke lebar ≤ 420 px (JPEG) |

## Cakupan

Brief awal berisi enam butir (Kas & Bank, Invoice, Arus Kas, alias klien, rename Utang,
smoke Feedback). **Di tengah sesi pengguna mempersempit cakupan menjadi Kas & Bank saja.**
Butir lain tidak diuji dan tidak dilaporkan; tiga tangkapan layar Invoice yang sempat diambil
sudah dikeluarkan dari folder ini.

## Lingkungan uji (terisolasi, bukan production)

| Aspek | Nilai |
|---|---|
| Berkas konfigurasi | `.env.qakb` = salinan `.env` + penimpaan di bawah; `.env` tidak disentuh. Dihapus setelah QA |
| `APP_ENV` | `qakb` (lihat *Penyimpangan dari brief*) · `APP_DEBUG=true` |
| URL | `http://127.0.0.1:8137` — `php artisan serve --env=qakb --host=127.0.0.1 --port=8137` |
| Database pusat | `qakb_central` (dibuat dengan nama eksplisit, `migrate` + `MasterPermissionSeeder`) |
| Database perusahaan | `qakb_central_tenant_qakb` (`TENANCY_DB_PREFIX=qakb_central_tenant_`, slug `qakb`) |
| Cache / sesi / antrean / mail | `database` / `database` (`SESSION_CONNECTION=mysql`, cookie `qakb_session`) / `sync` / `log` |
| Dinonaktifkan | `LEGACY_DB_DATABASE` dan `GEMINI_API_KEY` dikosongkan agar tidak ada sambungan ke DB lama atau API luar |
| Aset frontend | Vite dev server milik pengembang di `[::1]:5173` (`public/hot` ada; tidak di-restart, tidak ada `npm run build`) |
| Browser | Chrome lewat Chrome DevTools MCP, satu *isolated context* per peran; viewport 1280×800 DPR 1 (N10: 390×844 ponsel, C04 langkah 3: 1600×900) |
| Basis data lain | Tidak disentuh. Semua database yang dibuat berawalan `qakb_` dan di-drop dengan nama persis setelah QA (dump disimpan di luar repo) |

**Bukti isolasi.** Setelah server menyala, satu `GET /login` menghasilkan cookie `qakb_session`
dan satu baris di `qakb_central.sessions`. Dengan `.env` biasa, sesi akan masuk Redis dengan nama
cookie lain — jadi request HTTP terbukti membaca `.env.qakb`, bukan `.env` (yang menunjuk `demo_central`).

### Penyimpangan dari brief: `APP_ENV=qakb`, bukan `local`

`artisan serve` hanya meneruskan beberapa environment variable ke proses PHP yang melayani request
(`ServeCommand::$passthroughVariables`), dan `APP_ENV` salah satunya. Proses itu memuat `.env.{APP_ENV}`
(`LoadEnvironmentVariables::checkForSpecificEnvironmentFile`). Dengan `APP_ENV=local` di `.env.qakb`,
setiap request akan mencari `.env.local` (tidak ada) lalu jatuh ke `.env` → database `demo_central`.
Dengan `APP_ENV=qakb`, request memuat `.env.qakb`. Aplikasi hanya memeriksa `isProduction()` dan
`testing`, jadi `qakb` berperilaku seperti `local`; perintah konsol dengan `--env=qakb` memang
sudah bernama lingkungan `qakb`. Jebakan ini juga tercatat di [`docs/qa/jalankan-qc.sh`](../jalankan-qc.sh).

### Penyiapan

1. `CREATE DATABASE qakb_central`, `php artisan migrate --env=qakb`, `db:seed --class=MasterPermissionSeeder`, `permission:cache-reset`.
2. `php artisan central:bootstrap --env=qakb` (organisasi "Grup QA Kas Bank", admin pertama, perusahaan "PT Kas Bank QA", slug `qakb`, singkatan `KBQ`).
   Walkthrough `/setup` **tidak** dipakai: berkas tokennya (`storage/app/setup-token`) dipakai bersama
   semua lingkungan di folder ini, sehingga membuatnya akan mengalihkan aplikasi pengembang yang sedang
   berjalan di port 8000 ke `/setup`.
3. Lewat UI: profil perusahaan dilengkapi (gerbang `EnsureCompanyProfileComplete`), peran uji
   "hanya pemasukan" dibuat di Izin & Peran, pengguna dibuat di Administrasi › Pengguna.

### Akun uji (lokal, hanya di `qakb_central`, ikut terhapus saat database di-drop)

| Email | Peran | Sandi (dibangkitkan acak untuk QA ini) | Dipakai di |
|---|---|---|---|
| `admin@qakb.test` | admin | `Qakb-07r1mJJ0Wcxu#7` | hampir semua case |
| `fm@qakb.test` | finance manager | `Qakb-7VmSTHZw5WrH#7` | penanggung jawab kas (N03) |
| `staff@qakb.test` | staff | `Qakb-lVNV0kxOyrZ6#7` | uji izin A07, penanggung jawab N08 |
| `pemasukan@qakb.test` | hanya pemasukan (`view income`, A08: + `view bank-accounts`) | `Qakb-bu3oBHQ2bMVp#7` | uji izin A08, penanggung jawab C04 |
| `luar@qakb.test` | staff — **dihapus** di C04 | `Qakb-v7DqlfrUBBl8#7` | penanggung jawab yang keluar (C04) |

### Data uji

Dibuat lewat UI: rekening BCA, Kas Kecil Kantor (`KAS-0001`), Kas Proyek Lapangan (`KAS-0002`, lalu
diubah jadi rekening Mandiri), Kas Lama Kantor (nomor `0000`, bank → kas), satu isi ulang, satu
pemasukan, satu pengeluaran, klien "CV Contoh Pelanggan", invoice `001/INV/KBQ-CP/XI/2026` dan
pembayaran Rp 400.000 ke kas. Fixture lewat database/request rakitan (dipulihkan setelah dipakai):
pengguna pusat non-anggota #6 (A02, dibuat & dihapus lewat tinker) dan akun probe #5 (A04, dihapus).

### Efek samping di luar lingkungan `qakb`

Laravel Boost meneruskan pesan konsol dari halaman uji ke berkas bersama `storage/logs/browser.log`
(baris ber-channel `qakb.`). Baris itu dipakai sebagai bukti tidak ada error konsol (K-06) dan
dibersihkan dari berkas saat pembongkaran lingkungan. Tidak ada efek samping lain yang ditemukan:
log harian `qakb` tidak terbentuk, folder `storage/tenantqakb` tidak terbentuk.

## Membangun ulang laporan

Skrip dari skill `qa-evidence` (`~/.claude/skills/qa-evidence/scripts/`), dijalankan dari folder ini:

```bash
python <skill>/scripts/build_evidence.py manifests/kas-bank.json   # sambung bukti ke test case
python <skill>/scripts/check_evidence.py test-cases manifests      # gerbang: 22 case, 18 butuh bukti UI, 18 bergambar
python <skill>/scripts/build_report.py   manifests/kas-bank.json   # PDF; skor dihitung dari manifest
python <skill>/scripts/check_links.py    .                          # tautan & gambar
```

Tangkapan layar mentah (resolusi penuh) dan dump database tidak disimpan di repo.
