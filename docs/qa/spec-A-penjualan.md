# PENGUJI A — Penjualan: Invoice, Klien, Layanan, Invoice Berulang

**Baca dulu `docs/qa/PENGARAHAN-QC.md`.** Aturan lingkungan, perkakas browser,
format kasus, dan aturan kejujuran ada di sana.

```
slug: a      port: 8011
bash docs/qa/siapkan-lingkungan-qc.sh a 8011
bash docs/qa/jalankan-qc.sh a 8011     # biarkan jalan di latar
```

## Cakupan

Semua halaman GET di bawah ini, plus alur tulisnya:

| modul | halaman |
|---|---|
| Invoice | index, create, show, edit, data, export excel, export pdf |
| Unduh PDF | `/invoice/{invoice}/download` (termasuk parameter dp & pelunasan) |
| Klien | index + CRUD |
| Layanan | index + CRUD |
| Invoice Berulang | templates, monthly, analytics + publish |

## Yang WAJIB dibuktikan

1. **Siklus hidup invoice penuh**: draft (tanpa nomor) → kirim (nomor terbit) →
   bayar sebagian → lunas. Periksa `status` dan `invoice_sequence` di database
   tenant, bukan hanya di layar.
2. **Nomor invoice independen per perusahaan.** Invoice pertama di perusahaan
   KEDUA harus mulai dari urutannya sendiri, bukan melanjutkan perusahaan
   pertama. Ini invarian inti multi-perusahaan — buktikan dengan nomor yang
   benar-benar terbit di keduanya.
3. **Pembayaran melebihi sisa tagihan ditolak**, dan pesannya menyebut sisa yang
   sebenarnya. Uji juga lewat HTTP langsung, bukan hanya lewat form.
4. **Mengubah total invoice yang sudah dibayar** → status dihitung ulang dengan
   benar (jangan sampai "lunas" padahal totalnya naik).
5. **PDF benar-benar terunduh** dan ukurannya masuk akal (bukan 0 byte, bukan
   halaman error). Uji keempat template bila bisa dipilih.
6. **Publish invoice berulang** menyalin `unit` dan `is_tax_deposit`. Keduanya
   pernah hilang saat rekonsiliasi; item titipan pajak yang kehilangan
   penandanya akan terhitung sebagai omzet dan membuat dasar PPh salah.
7. **Akses silang**: `qca-luar@qc.test` (hanya perusahaan kedua) tidak boleh
   membuka invoice perusahaan pertama — lewat URL langsung sekalipun.

## Perhatian khusus

- Halaman Invoice menyaring **bulan berjalan** secara bawaan. Invoice bertanggal
  lama tidak muncul sampai filternya diubah. Itu perilaku, bukan cacat — tapi
  pastikan filternya benar-benar bekerja dan bisa dikosongkan.
- `/api/invoices/next-sequence` baru saja diperbaiki (sebelumnya selalu 500).
  Uji: ia harus mengembalikan urutan berikutnya, dan menolak pengguna tanpa izin
  `create invoices`.
