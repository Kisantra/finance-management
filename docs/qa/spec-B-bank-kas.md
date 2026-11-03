# PENGUJI B — Bank, Arus Kas, Kategori, Laporan Laba Rugi

**Baca dulu `docs/qa/PENGARAHAN-QC.md`.**

```
slug: b      port: 8012
bash docs/qa/siapkan-lingkungan-qc.sh b 8012
bash docs/qa/jalankan-qc.sh b 8012     # biarkan jalan di latar
```

## Cakupan

| modul | halaman |
|---|---|
| Rekening Bank | index, create, edit, transaksi per rekening |
| Transaksi Bank | tambah, ubah, hapus, hapus massal, transfer antar rekening |
| Arus Kas | overview, income, expenses, transfers, ekspor |
| Kategori Transaksi | index + CRUD |
| Laporan | Laba Rugi (rentang tanggal, termasuk YTD) |

## Yang WAJIB dibuktikan

1. **Saldo dihitung, bukan disimpan**: `saldo_awal + pembayaran + kredit −
   debit`. Buat transaksi, lalu cocokkan angka di layar dengan hitungan manual
   dari baris database. Termasuk setelah transaksi dihapus.
2. **Transfer antar rekening membuat DUA kaki** yang berpasangan lewat
   `transfer_group_id`. Lalu yang paling penting:
   **buat dua transfer pada detik yang sama, hapus salah satunya, dan buktikan
   kaki transfer yang LAIN masih utuh dan saldo kedua rekening benar.** Versi
   lama memasangkan dengan `'TRF'.time()` beresolusi detik sehingga menghapus
   satu transfer ikut menghapus keempat kaki.
3. **Menghapus transaksi berlampiran** benar-benar menghapus berkasnya. Hapus
   massal pun harus menjalankan hook yang sama — pernah memakai mass-delete yang
   melewatinya sehingga berkas jadi yatim.
4. **Kategori sistem tidak boleh dihapus.** Coba hapus `FIN-LOAN-IN` atau
   kategori ber-`system_key` lain; harus ditolak. Kalau berhasil terhapus, itu
   MEMBLOKIR — modul pinjaman akan mati.
5. **Laba rugi**: angka pendapatan/HPP/laba cocok dengan data yang kamu buat.
   Basis kas — pendapatan diakui saat pembayaran diterima, bukan saat invoice
   terbit. Item `is_tax_deposit` TIDAK boleh ikut omzet.
6. **Jumlah query laba rugi tidak tumbuh mengikuti jumlah invoice.** Baru saja
   diperbaiki dari 2N+22. Kalau bisa, ukur dengan 5 lalu 25 invoice dan
   bandingkan — kalau naik sebanding, N+1-nya kembali.
7. **Akses silang**: transaksi perusahaan pertama tidak terlihat/terubah dari
   perusahaan kedua.

## Perhatian khusus

Laporan laba rugi punya ember "belum terklasifikasi" yang sengaja TIDAK
dijumlahkan ke total — supaya pengguna dipaksa mengklasifikasikan, bukan
diam-diam salah kategori. Pastikan transaksi tanpa `pl_group` muncul di sana,
bukan hilang.
