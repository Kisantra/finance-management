Setoran modal, prive, setor PPN, dan setor titipan pajak klien kini bisa **dicatat lewat Catat Pemasukan / Catat Pengeluaran** sebagai **Pendanaan**: saldo rekening bergeser, **Laba Rugi tidak berubah**. Di daftar Arus Kas barisnya berbadge **Pendanaan** dan nominalnya dirinci di **kartu terpisah**; pokok utang/piutang dari menu Utang/Piutang ikut tampil **hanya-lihat**. Template kategori mendapat bagian ketiga **Pendanaan**.

Opsi A yang disetujui: tab tetap tiga (Semua · Pemasukan · Pengeluaran). Tidak ada perubahan skema database atau izin. Perusahaan yang sudah berjalan mendapat kategorinya lewat **Pakai Template** (5 kategori baru); perusahaan baru langsung berisi semuanya.

**Masalahnya dulu:** pemilih kategori hanya berisi kategori pemasukan/pengeluaran. Staf terpaksa memakai kategori pendapatan/beban untuk setoran modal atau setor PPN (Laba Rugi salah tanpa tanda), atau tidak mencatatnya (saldo rekening tidak cocok dengan bank).

Ringkasan lengkap + semua screenshot: [`docs/pr/2026-11-09-pendanaan/README.md`](docs/pr/2026-11-09-pendanaan/README.md). QA berbukti: [`docs/qa/2026-11-09-pendanaan/`](docs/qa/2026-11-09-pendanaan/README.md).

---

## Sebelum → sesudah

Data contoh yang sama (perusahaan QA di lingkungan terisolasi). "Sebelum" diambil dari `main` (`1646872`) sebelum kode diubah.

### Pemilih kategori di Catat Pengeluaran

| Sebelum — tidak ada tempat untuk setor PPN | Sesudah — grup terakhir **Pendanaan · tidak masuk Laba Rugi** |
|---|---|
| ![Sebelum](docs/pr/2026-11-09-pendanaan/screens/01-sebelum-pemilih.webp) | ![Sesudah](docs/pr/2026-11-09-pendanaan/screens/02-sesudah-pemilih.webp) |

Setelah sub pendanaan dipilih: penanda **Pendanaan** + petunjuk *"saldo BCA Operasional berkurang Rp 2.200.000, Laba Rugi tidak berubah."*

![Penanda dan petunjuk](docs/pr/2026-11-09-pendanaan/screens/03-sesudah-petunjuk.webp)

### Daftar Pengeluaran + kartu ringkasan

**Sebelum** — *Total Pengeluaran · Jumlah Transaksi · Periode*; pendanaan tidak tampil.

![Sebelum: Pengeluaran](docs/pr/2026-11-09-pendanaan/screens/05-sebelum-pengeluaran.webp)

**Sesudah** — **Beban (masuk Laba Rugi) · Pendanaan (tidak masuk Laba Rugi) · Total keluar**; Setor PPN berbadge **Pendanaan**; pokok utang bergembok, **Hanya-lihat · kelola di Utang →**; bunganya tetap beban biasa.

![Sesudah: Pengeluaran](docs/pr/2026-11-09-pendanaan/screens/06-sesudah-pengeluaran.webp)

| Tab Pemasukan — sesudah | Tab Semua — sesudah (porsi pendanaan disebut di tiap kartu) |
|---|---|
| ![Pemasukan](docs/pr/2026-11-09-pendanaan/screens/08-sesudah-pemasukan.webp) | ![Semua](docs/pr/2026-11-09-pendanaan/screens/10-sesudah-semua.webp) |

### Pakai Template

| Sebelum | Sesudah — bagian **Pendanaan**; Setoran/Penarikan Modal lama **Sudah ada** (Baru 5 · Sudah ada 69 · Dilewati 0) |
|---|---|
| ![Sebelum](docs/pr/2026-11-09-pendanaan/screens/11-sebelum-template.webp) | ![Sesudah](docs/pr/2026-11-09-pendanaan/screens/12-sesudah-template.webp) |

### Laba Rugi tetap sama · ponsel

| Laba Rugi sesudah setoran modal Rp 25 jt & setor PPN Rp 3,3 jt — identik dengan sebelumnya (dibandingkan di DB) | Ponsel 390 px |
|---|---|
| ![Laba Rugi](docs/pr/2026-11-09-pendanaan/screens/15-sesudah-laba-rugi.webp) | <img src="docs/pr/2026-11-09-pendanaan/screens/20-sesudah-ponsel-bawah.webp" alt="Ponsel" width="260"> |

---

## Yang berubah

- **Mencatat**: grup Pendanaan (sub `financing` non-sistem) selalu terakhir di pemilih Catat Pemasukan/Pengeluaran (juga di header rekening Kas & Bank dan dialog ubah), penanda + petunjuk saldo. Server menolak kategori sistem, induk yang punya anak, dan induk pendanaan tanpa anak — dengan pesan terbaca.
- **Daftar & kartu**: tab Semua/Pemasukan/Pengeluaran memuat pendanaan berbadge; kartu memisahkan uang non-Laba Rugi; filter Kategori punya grup Pendanaan.
- **Pokok utang/piutang hanya-lihat**: gembok, tanpa aksi, tautan **kelola di Utang/Piutang** ke datanya (`?search=` nomor; pembayaran pokok utang → nama pemberi pinjaman). Ubah/hapus lewat Arus Kas & Kas & Bank ditolak 403.
- **Ekspor**: Excel tab Semua memuat pendanaan + kolom terakhir `Jenis (Laba Rugi/Pendanaan)` (10 kolom lama tidak bergeser); PDF memberi awalan "Pendanaan · ".
- **Template kategori** 15 induk / 59 sub: Setoran Modal → Setoran Modal Pemilik; Penarikan Modal → Prive Pemilik; Pajak Titipan & PPN → Setor PPN, Setor Titipan Pajak Klien. Seeder memakai satu definisi (perusahaan baru 82 kategori).
- **Katalog** (kompatibel mundur): `Combobox` opsi `section`/`tag`, `StatsCard` prop `hint`, komponen baru `shared/financing.tsx`.
- **Laba Rugi**: tidak ada perubahan kode; pendanaan sudah dikecualikan lewat tipenya.
- Dokumentasi modul (cash-flow, transaction-categories, profit-loss, dashboard, bank-accounts, loans, receivables), `CLAUDE.md`, panduan `/panduan` + video (bab baru *Pendanaan*, 29 screenshot Arus Kas diambil ulang).

## Cara mencoba

1. `npm run build` (atau `composer dev`), login sebagai finance manager di perusahaan yang sudah berjalan.
2. **Kategori Transaksi › Pakai Template** → bagian Pendanaan → **Buat 5 kategori**.
3. **Arus Kas › Pengeluaran › Input Pengeluaran** → Kategori paling bawah → **Setor PPN** → simpan → kartu **Pendanaan** terisi; **Laba Rugi** tidak berubah.
4. Catat utang di **Utang & Piutang › Utang** → di Arus Kas barisnya bergembok dengan tautan **kelola di Utang**.

## Pengujian

- [x] `npm run types` dan `npm run build` lolos
- [x] `php artisan test --compact` (suite penuh): **969 lulus, 2 dilewati (skipped), 0 gagal** — 4.940 asersi, 277 detik (MySQL `finance_management_test`, di `6cde0d1`)
- [x] `tests/Feature/PendanaanTest.php` (16 tes): validasi, opsi pemilih, daftar & kartu per tab, baris hanya-lihat + penolakan server, ekspor Excel/PDF, Laba Rugi tetap, Ringkasan = tab Semua, pengguna hanya-lihat; tes kategori/template/seeder/Arus Kas diperbarui
- [x] QA berbukti 12 case (N/A/C) di lingkungan terisolasi, Chromium headless, semua lolos — [`docs/qa/2026-11-09-pendanaan`](docs/qa/2026-11-09-pendanaan/README.md)

## Catatan

- **Perilaku yang sengaja berubah**: tab Semua/Pemasukan/Pengeluaran kini memuat pendanaan, jadi Total masuk/keluar naik sebesar pendanaan — dan kini **sama dengan Ringkasan**.
- Kolom Excel bernama `Jenis (Laba Rugi/Pendanaan)` karena kolom ke-2 sudah bernama "Jenis".
- Pencairan utang **yatim** (data lama; utangnya sudah tidak ada) sengaja tidak dikunci agar saldo tetap bisa dikoreksi.
- Di layar tepat 1280 px, tabel Pengeluaran berdeskripsi panjang meluap ±40 px di dalam kartu (kolom Jumlah digulir ke samping); baris tanpa pendanaan berdeskripsi panjang juga begitu. Tidak diubah di PR ini.
- Data di screenshot adalah data contoh lingkungan QA.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
