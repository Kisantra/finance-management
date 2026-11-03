# PENGUJI C — Reimbursement, Fund Request, Pinjaman, Piutang

**Baca dulu `docs/qa/PENGARAHAN-QC.md`.**

```
slug: c      port: 8013
bash docs/qa/siapkan-lingkungan-qc.sh c 8013
bash docs/qa/jalankan-qc.sh c 8013     # biarkan jalan di latar
```

## Cakupan

Empat modul yang semuanya punya **mesin status** dan melibatkan **lebih dari
satu aktor**. Di sinilah kasus berantai (C##) paling berharga — gunakan ketiga
akun: `staff` mengajukan, `fm`/`admin` menyetujui dan membayar.

| modul | alur status |
|---|---|
| Reimbursement | `draft → pending → approved → paid` (atau `rejected`) |
| Fund Request | `draft → pending → approved → disbursed` (atau `rejected`) |
| Pinjaman | buat → bayar angsuran → lunas |
| Piutang | buat → ajukan → setujui → bayar |

## Yang WAJIB dibuktikan

1. **Setiap transisi status yang SAH berhasil**, dan **setiap transisi yang
   TIDAK sah ditolak** — termasuk lewat HTTP langsung, bukan hanya karena
   tombolnya disabled. Contoh: menyetujui yang masih `draft`, membayar yang
   belum `approved`, mengubah yang sudah `paid`.
2. **Staff hanya melihat miliknya sendiri.** Reimbursement/fund request milik
   orang lain harus 404/403 bagi staff, termasuk dengan menebak id di URL.
3. **Pencairan membuat transaksi bank**, dan **membatalkan/menghapusnya
   mengembalikan saldo**. Hapus pinjaman yang sudah dicairkan → pencairannya
   harus ikut dibalik, bukan meninggalkan uang hantu.
4. **Efek samping yang SEHARUSNYA TIDAK terjadi.** Menolak pengajuan tidak boleh
   membuat transaksi bank. Membatalkan di tengah tidak boleh memajukan langkah
   persetujuan berikutnya. Periksa ini eksplisit — ini kelas cacat yang paling
   sering lolos.
5. **Nomor fund request tidak duplikat.** Pernah memakai `count()` bukan
   `max()`, sehingga menghapus satu pengajuan di bulan yang sama menghasilkan
   nomor kembar yang bentrok dengan unique index. Buat 3, hapus yang tengah,
   buat lagi — nomornya harus tetap unik.
6. **Piutang berdebitur polimorfik** (User ATAU Client). Uji keduanya.
7. **Lampiran bukti**: unggah di reimbursement, buktikan URL-nya ber-prefix
   `/c/{slug}/storage/`, bisa dibuka pemiliknya, dan **404/403 dari perusahaan
   lain**.

## Perhatian khusus

Dua modul memakai gaya penolakan berbeda: `ClientController::destroy` memakai
`withErrors`, `InvoiceController::destroy` memakai `with('error')`. Kalau kamu
menemukan ketidakkonsistenan serupa di modulmu — pesan gagal yang tidak muncul
di layar karena halaman membacanya dari tempat yang salah — itu temuan yang
layak dilaporkan meski tidak memblokir.
