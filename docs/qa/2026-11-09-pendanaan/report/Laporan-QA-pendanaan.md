# QA — Pendanaan (Opsi A): Arus Kas & Template Kategori

_QA 9 NOVEMBER 2026 · ARUS KAS · KATEGORI TRANSAKSI · PENDANAAN_

Eksekusi 12 test case di `test-cases/pendanaan.md` untuk fitur **Pendanaan**: bagian Pendanaan di Pakai Template
(perusahaan lama & baru), mencatat setoran modal / setor PPN / prive lewat Catat Pemasukan & Pengeluaran (grup
pemilih, penanda, petunjuk), badge & kartu ringkasan terpisah di tab Semua/Pemasukan/Pengeluaran, filter Kategori,
ekspor Excel kolom *Jenis (Laba Rugi/Pendanaan)*, Laba Rugi yang tidak berubah, pokok utang hanya-lihat (UI +
penolakan server), payload rakitan, pengguna hanya-lihat, ponsel 390 px, dan konsistensi dengan Ringkasan.
Aktor: Admin QA, Finance manager (Rina), pengguna hanya-lihat (Lina).

Dokumen sumber: [`test-cases/pendanaan.md`](../test-cases/pendanaan.md) (tabel + bukti per langkah),
[`manifests/pendanaan.json`](../manifests/pendanaan.json), PDF: [`Laporan-QA-pendanaan.pdf`](Laporan-QA-pendanaan.pdf).
Lingkungan & akun: [`README.md`](../README.md).

## Skor (dihitung dari tabel test case dan manifest)

```
 12  test case dijalankan (dari 12; belum diuji/blocked: 0)
 12  akhirnya lolos   (status tabel: Pass 12)
  0  gagal di percobaan pertama karena aplikasi
  2  percobaan pertama batal karena skrip uji (N05, N06 — bukan cacat aplikasi)
11/11 case ber-lapisan FE/FE+BE punya bukti layar (gerbang check_evidence.py: LULUS)
```

Komposisi: N=7, A=3, C=2; lapisan BE=1, FE=1, FE+BE=10.

## Ringkasan

Seluruh 12 test case lolos; tidak ada cacat aplikasi yang menggagalkan case.

Di perusahaan lama (diprovisioning di kode `main` sebelum fitur ini), **Pakai Template** menampilkan persis rencana
mockup: **Baru 5, Sudah ada 69, Dilewati 0**. Induk *Setoran Modal* dan *Penarikan Modal* yang dulu dibuat seeder
tanpa anak dipakai ulang, sub barunya ditempel ke sana (diverifikasi di DB lewat `parent_id`), semuanya
`type=financing` dengan `pl_group` null. Klik ulang menghasilkan 0/74/0. Perusahaan baru yang dibuat lewat layar
langsung berisi 82 kategori (22 utama, 60 sub, 0 belum diklasifikasi) dan pratinjaunya 0/74/0.

Setoran modal Rp 25.000.000 dan setor PPN Rp 3.300.000 bisa dicatat lewat dialog biasa: grup terakhir
"Pendanaan · tidak masuk Laba Rugi", penanda **Pendanaan** di pemicu, dan petunjuk "saldo BCA Operasional
bertambah/berkurang Rp X, Laba Rugi tidak berubah". Saldo BCA bergeser tepat (Rp 53.605.000 → Rp 75.305.000),
kartu Pendanaan terisi terpisah dari Beban/Pemasukan, dan **Laporan Laba Rugi November identik** sebelum dan
sesudah — dibandingkan seluruh struktur keluaran `ProfitLossService`, bukan hanya angka di layar.

Pokok utang yang dicatat lewat menu Utang tampil hanya-lihat dengan tautan ke utangnya (`?search=LOAN-00001` untuk
pencairan; nama pemberi pinjaman untuk pembayaran pokok); bunga tetap beban biasa. Keempat jalur ubah/hapus lewat
Arus Kas dan Kas & Bank ditolak 403 dengan pesan terbaca dan DB tidak berubah. Payload rakitan dengan kategori
sistem/induk/arah salah ditolak 422. Ringkasan bulan ini kini sama persis dengan tab Semua (Rp 90.120.000 /
Rp 19.965.000 / +Rp 70.155.000) — sebelum fitur ini keduanya berbeda karena tab Semua mengecualikan pendanaan.

## Temuan

Tidak ada bug aplikasi yang ditemukan selama QA. Temuan di luar lingkup / batas tata letak (tidak diperbaiki):

| ID | Temuan | Keterangan |
|---|---|---|
| K-P1 | Tabel Pengeluaran meluap ±40 px di layar tepat 1280 px | Deskripsi panjang (mis. "Pembayaran pokok pinjaman - Bank BRI") + kolom Diinput oleh (mulai xl) → tabel 964 px di wadah 926 px; Jumlah perlu digulir ke samping di dalam kartu. Halaman tidak meluap. Baris tanpa pendanaan berdeskripsi panjang mengalami hal sama (screenshot panduan `fm-expense-list-after`), jadi ini batas lama yang kini lebih sering terlihat. Pas di 1440 px. |
| K-P2 | Breadcrumb header bertumpuk dengan tombol di 390 px | Sama di kode `main` (screenshot sebelum). |
| K-P3 | Kategori Penyesuaian ditawarkan pemilih tetapi ditolak server | Perilaku lama; perubahan `adjustment` di luar lingkup. |

## Hasil per case

| ID | Skenario | Percobaan | Catatan | Status |
|---|---|---|---|---|
| N01 | Pakai Template di perusahaan lama | ✅ | 5/69/0 → 0/74/0; DB 82 kategori, sub menempel ke induk lama | Pass |
| N02 | Catat Setoran Modal (Pemasukan) | ✅ | Petunjuk "bertambah Rp 25.000.000"; kartu Pendanaan Rp 25.000.000 | Pass |
| N03 | Catat Setor PPN (Pengeluaran) | ✅ | Kartu 12.465.000 / 3.300.000 / 15.765.000; saldo BCA 75.305.000 | Pass |
| N04 | Laba Rugi tidak berubah | ✅ | Struktur laporan identik; laba bersih 2.655.000 | Pass |
| N05 | Tab Semua, filter, Excel kolom Jenis | ⬜✅ | Percobaan 1: lokator skrip. Excel 11 kolom, kolom terakhir Laba Rugi/Pendanaan | Pass (percobaan ke-2) |
| N06 | Perusahaan baru 82 kategori | ⬜✅ | Percobaan 1: perusahaan terbentuk, skrip timeout menunggu teks | Pass (percobaan ke-2) |
| N07 | Ponsel 390 px | ✅ | Overflow halaman 0 px; badge di bawah deskripsi | Pass |
| A01 | Payload rakitan ditolak (BE) | ✅ | 5× 422 berpesan; DB tidak berubah | Pass |
| A02 | Pengguna hanya-lihat | ✅ | 0 tombol catat, 0 centang; POST 403 | Pass |
| A03 | Ubah transaksi ke kategori sistem | ✅ | Dialog memuat grup Pendanaan; PUT 422 | Pass |
| C01 | Utang → hanya-lihat + penolakan server | ✅ | Tautan ke Utang; 4× 403; DB tidak berubah; Kas & Bank tanpa tombol hapus | Pass |
| C02 | Ringkasan = tab Semua | ✅ | 90.120.000 / 19.965.000 / +70.155.000 | Pass |

⬜ = percobaan batal karena alat uji, ✅ = lolos. Bukti visual per langkah ada di
[`test-cases/pendanaan.md`](../test-cases/pendanaan.md) › *Bukti visual langkah per langkah* dan di PDF.

## Kendala alat uji (bukan cacat aplikasi)

1. **N05 percobaan 1** — skrip mencari tombol bernama "Semua kategori"; nama aksesibel pemicu Combobox berlabel
   adalah labelnya ("Kategori"). Lokator diperbaiki, case dijalankan ulang dari awal.
2. **N06 percobaan 1** — perusahaan `pdnbaru` terbentuk (status `active` 16:36:22, DB tenant ada), tetapi skrip
   menunggu teks "siap dipakai" hingga 240 detik lalu timeout. Dua lanjutan juga terhenti oleh skrip: login admin
   (kini anggota dua perusahaan) mendarat di `/choose-company`, dan skrip mencoba membuka **Input Pengeluaran** di
   perusahaan tanpa rekening (tombol itu memang disembunyikan bila belum ada rekening). Perusahaan tidak dibuat
   ulang; pemilihnya diperiksa lewat endpoint yang dipanggil dialog.
3. Runner headless memutus WebSocket HMR Vite di setiap konteks; tidak ada pemuatan ulang halaman yang teramati.

## Catatan kejujuran

Kode fitur dan test case-nya ditulis oleh asisten yang sama, jadi titik buta penulis ikut terbawa. Mohon periksa
sendiri: (1) dialog Catat Pengeluaran di perusahaan nyata yang punya kategori pendanaan buatan sendiri (bukan dari
template); (2) pencairan utang lama yang utangnya terhapus sebelum `LoanController::destroy` membalik pencairan —
sengaja tidak dikunci; (3) tabel Pengeluaran di laptop 1280–1366 px (K-P1). Yang terbukti lewat eksekusi: semua
baris tabel di atas (UI headless + pemeriksaan DB). Yang hanya terbukti lewat tes otomatis, bukan QA layar ini:
penanda hanya-lihat untuk **piutang** (`FIN-RCV-*`), PDF Arus Kas berawalan "Pendanaan · ", dan pengecualian
pencairan yatim (`PendanaanTest`).
