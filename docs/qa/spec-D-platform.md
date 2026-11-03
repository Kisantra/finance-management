# PENGUJI D — Dashboard, Administrasi, Pengaturan, Notifikasi, Feedback

**Baca dulu `docs/qa/PENGARAHAN-QC.md`.**

```
slug: d      port: 8014
bash docs/qa/siapkan-lingkungan-qc.sh d 8014
bash docs/qa/jalankan-qc.sh d 8014     # biarkan jalan di latar
```

## Cakupan

| modul | halaman |
|---|---|
| Dashboard | ringkasan, grafik arus kas (mingguan/bulanan/tahunan), filter rekening |
| Pengguna | `/admin/users` — CRUD + **penugasan ke beberapa perusahaan** |
| Perusahaan | `/admin/companies` — provisioning perusahaan baru, kuota, retry |
| Izin & Peran | `/permissions` |
| Pengaturan | 10 halaman: profil, sandi, perusahaan, penomoran invoice, template PDF, font |
| Feedback | kirim, tanggapi, ubah status |
| Notifikasi | lonceng, drawer, tandai terbaca |
| Pemilihan perusahaan | `/choose-company`, pengalih di menu akun |

## Yang WAJIB dibuktikan

1. **Panel penugasan perusahaan** (baru). Tugaskan satu pengguna ke DUA
   perusahaan lewat UI, lalu buktikan di database ia benar-benar anggota
   keduanya **dan punya peran di keduanya** — anggota tanpa peran bisa masuk
   tetapi tidak boleh berbuat apa pun.
2. **Batas organisasi.** Admin tidak boleh menugaskan pengguna ke perusahaan
   milik organisasi lain, meski slug-nya dikirim langsung lewat HTTP.
3. **Admin tidak bisa mengunci dirinya sendiri** keluar dari perusahaan yang
   sedang dibuka.
4. **Tabel yang hidup di database PUSAT adalah titik lemahnya** — isolasi
   koneksi tidak melindunginya. Periksa ulang bahwa `/admin/users`, feedback,
   dan notifikasi HANYA menampilkan milik perusahaan aktif. Tiga kebocoran di
   sini baru saja ditutup; tugasmu memastikan tidak ada yang keempat.
5. **Lonceng dan drawer notifikasi menunjukkan jumlah yang SAMA.** Pernah
   berbeda (1 vs 2) karena penyaringan ditulis dua kali.
6. **Membuat perusahaan baru dari UI** `/admin/companies` benar-benar
   mem-provisioning database, menjalankan migration, dan perusahaan itu langsung
   bisa dipakai bertransaksi. Uji juga kuota organisasi.
7. **Pemilihan perusahaan**: pengguna 1 perusahaan langsung ke dashboard tanpa
   pemilih; pengguna 2 perusahaan melihat pemilih DAN pengalih di menu akun;
   pengguna 0 perusahaan mendapat pesan yang jelas (bukan 500, bukan pesan
   generik "tidak punya izin").
8. **Pengaturan penomoran invoice** benar-benar mengubah nomor yang terbit
   berikutnya, dan pengaturannya per perusahaan.

## Perhatian khusus

- Ada route `template-builder-test` (2 halaman). **Tentukan apakah itu route
  sandbox yang tidak seharusnya ada di produksi**, dan laporkan — jangan hapus.
- Halaman `/panduan` sengaja PUBLIK (bisa dibuka sebelum login, juga saat sudah
  login) dan memakai kerangkanya sendiri, bukan `AppLayout`. Itu desain, bukan
  cacat. Pastikan ia tidak membocorkan data perusahaan mana pun.
