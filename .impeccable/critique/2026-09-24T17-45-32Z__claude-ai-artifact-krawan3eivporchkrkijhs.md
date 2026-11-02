---
target: mockup dashboard Obsidian (artifact KRaWAn3EivPorcHkrKijHS v8)
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-09-24T17-45-32Z
slug: claude-ai-artifact-krawan3eivporchkrkijhs
---
Method: dual-agent (A: design review sub-agent, selesai) · ⚠️ B: sub-agent terhenti oleh batas sesi API sebelum melapor; detektor, grep, dan hitung kontras dijalankan inline oleh konteks induk setelah A selesai.

Target: mockup dashboard Obsidian, artifact KRaWAn3EivPorcHkrKijHS Version 8 (Main, Layout, Komponen, Navigasi).

## Design Health Score

| # | Heuristik | Skor | Key issue |
|---|-----------|------|-----------|
| 1 | Visibility of system status | 3 | "data per 08.41", "3 dari 5", skeleton, fade ada; ganti pil periode belum punya state memuat untuk grafik. |
| 2 | Match system / real world | 3 | "Pengajuan dana" (kartu) vs "Permintaan Dana" (nav); "Est. PPh final" tanpa penanda estimasi. |
| 3 | User control & freedom | 3 | Esc, pilihan tersimpan, "Coba lagi" per widget; alert merah kronis tidak bisa diredam/ditindak. |
| 4 | Consistency & standards | 2 | Satu seri dua enkode di kartu Arus Kas (titik hijau/oranye vs biru/bergaris); biru 4 makna; kuning = menunggu dan sebagian; pil 26 vs 32px. |
| 5 | Error prevention | 3 | Spec range max 2 tahun + fallback; state "Rentang" dan "Grafik: BCA" belum digambar. |
| 6 | Recognition over recall | 2 | Rel ciut 8 ikon tanpa label; ikon Utang & Piutang dan Administrasi tidak self-evident. |
| 7 | Flexibility & efficiency | 3 | Ctrl K, `[`, localStorage; baris invoice bukan tautan; tidak ada aksi cepat menagih/review/cairkan. |
| 8 | Aesthetic & minimalist | 3 | Rp 5.180.000 tampil 3×; kalimat "Terbesar" mengulang legenda. |
| 9 | Error recovery | 4 | Widget gagal: sebab + yang masih valid + satu aksi; copy toast sangat baik. |
| 10 | Help & documentation | 2 | Tidak ada afordans bantuan; HPP, PPh final, Arus bersih tanpa definisi. |
| **Total** | | **28/40** | **Good** (dari 19: Poor) |

## Anti-Patterns Verdict

**LLM:** bukan slop generik. Aritmetika sebagian besar nyata (5 rekening = Rp 190.580.000; 5 debit = Rp 5.180.000 = pusat donat; persentase donat berjumlah 100; 212 hari benar; 26–27 Sep memang akhir pekan). Dua retak yang tersisa: invoice 003 "Terkirim, sisa 5.580.000" padahal feed mencatat dua pembayaran 003 berjumlah 5.580.000; dan "Pemasukan 1–22 Sep" tersusun dari Payment sementara backend hanya menjumlahkan BankTransaction kredit.

**Detektor (inline):** exit 2, 16 temuan, semuanya false positive: overused-font ×12 dan single-font ×2 (satu keluarga font disengaja untuk product UI), flat-type-hierarchy ×2 (artboard anotasi). Grep ban: nol side-stripe, gradient text, backdrop-filter, uppercase eyebrow, emoji, title=, onclick, role=button; satu `!important` hanya di blok prefers-reduced-motion (sah). Nol teks di bawah 12px. Nol `{{`. #5b5b66 dipakai sebagai teks hanya di tooltip terang (5,99:1, lolos).

**Kontras (terhitung):** #a3a3ab 7,28 / #8b8b95 5,40 di kartu, 5,03 di kartu-dalam, 4,46 di chip #26262c (nyaris); #fff di #2563eb 5,17; #c2410c di tooltip 4,63; semua chip status ≥ 6,6. Gagal non-teks: batang bulan lampau rgba(59,130,246,.38) ≈ #233e6c hanya 1,72:1 (70% alpha → 3,03); irisan donat berdampingan 1,4–2,0:1 dan irisan terakhir vs track 1,23:1.

**Bukti render (Chromium headless, sebelum sesi B terputus):** tidak ada overflow atau clipping di keempat artboard; baseline judul sejajar; viewport gulir menampilkan baris utuh; badge tidak patah; strip 14 hari muat. Overlay injection dilewati: tidak ada browser yang bisa diskrip.

## Overall Impression
Dari 19 ke 28: struktur, aksesibilitas, dan disiplin ukuran sekarang nyata, bukan klaim. Yang tersisa bukan lagi soal tampilan, tetapi kontrak data dan perilaku pada kondisi ekstrem: grafik yang hanya didesain untuk 6 bucket padahal pil Mingguan/Rentang akan mengirim 12–31, baris merah lewat tempo yang hanya punya bentuk n=1 dan tanpa jalan penyelesaian, serta seri pemasukan yang tidak bisa dihasilkan backend.

## What's Working
1. **Ukuran tetap benar-benar dihitung**: Rekening 184 = 3×56+2×8, Transaksi 184 = 4×46, Invoice 5×42 muat persis; header 32px menyejajarkan semua judul.
2. **Aksesibilitas bawaan**: tabel sr-only untuk grafik, aria-pressed, tabindex + aria-label di viewport gulir, aria-current di strip, teks sr "masuk/keluar", prefers-reduced-motion.
3. **Arah uang tahan buta warna**: bergaris vs solid di grafik plus tanda +/− eksplisit; warna hanya redundansi.

## Priority Issues

**[P1] Grafik hanya didesain untuk 6 bucket.** Spec endpoint mengirim 12 bucket (mingguan) sampai 31 (rentang harian); batang 26px×2 + gap 22 tidak muat di ±780px, label "22–28 Sep" ×12 meluap, kolom sumbu 36px tidak muat "1,2 M". **Fix:** lebar batang `clamp(6px, …, 26px)`, gap bucket `clamp(6px, 2.4%, 22px)`, ≥12 bucket → gap pasangan 3px radius 4; label setiap k-th dengan min 56px per label, bucket berjalan selalu berlabel; kolom Y 48px dengan formatter jt/M; gambar state 12 dan 31 bucket. Command: `/impeccable harden`, `/impeccable layout`.

**[P1] Baris merah lewat tempo hanya punya bentuk n=1 dan tanpa jalan penyelesaian.** Judul menyebut satu klien; 12 invoice lewat tempo tidak punya copy; tanpa aksi, baris jadi wallpaper merah permanen (alarm fatigue). **Fix:** copy dua bentuk (n=1: "Invoice lewat tempo 212 hari / CV. Karya Bersama · Rp 2.000.000"; n>1: "{n} invoice lewat tempo / Total Rp {sum} · terlama {d} hari"); tautan ke `/invoices?status=overdue&sort=due_date`; aksi sekunder 32px saat hover/fokus (Kirim pengingat / Review / Cairkan), selalu tampil di sentuh; umur > 90 hari: "212 hari · pertimbangkan penagihan". Command: `/impeccable clarify`, `/impeccable harden`.

**[P1] Data mockup kontradiktif dan tidak bisa dihasilkan backend.** Invoice 003 vs dua pembayaran 003; Pemasukan 6.630.000 = jumlah Payment, sedangkan `income_this_month` dan seri grafik hanya membaca BankTransaction kredit. **Fix:** di mockup jadikan 003 total Rp 11.160.000 status Sebagian sisa 5.580.000; di docs tambahkan invarian: seri income = BankTransaction kredit + Payment (konsisten dengan rumus saldo), atau ubah label hero jadi "Transaksi bank 1–22 Sep"; uji di DashboardChartTest. Command: `/impeccable audit`.

**[P2] Overflow pada Rp 1.234.567.890.** Hero row ±874px > 816px; kolom nominal 130px + " sisa" nowrap meluap; nama rekening tanpa ellipsis wrap 2 baris. **Fix:** hero `flex-wrap: wrap; row-gap: 12px`, saldo `clamp(32px, 2.8vw, 40px)`; kolom nominal 150px, "sisa" ke baris kedua 12px; ellipsis pada kedua span nama rekening; `dl` hero `min-width: 150px` per kolom. Command: `/impeccable harden`.

**[P2] Batang bulan lampau 1,72:1 dan dua enkode untuk seri yang sama.** **Fix:** bulan lampau rgba(59,130,246,.70) (3,03:1) atau #3566c4, bulan berjalan #60a5fa; hapus titik hijau/oranye di dl hero atau samakan dengan swatch legenda; border hatch rgba(255,255,255,.35); donat: tambah pemisah 2px #151518 antar irisan dan irisan terakhir #4a4f5c. Command: `/impeccable colorize`, `/impeccable polish`.

## Persona Red Flags

**Alex:** baris Invoice Belum Dibayar bukan `<a>`; tidak ada "Catat pembayaran"; primer tunggal "Buat Invoice" bukan pekerjaan pagi finance manager; ganti pil memicu reload tanpa state memuat grafik; filter rekening hanya memfilter grafik tanpa label penegas; hover baris Rekening tak terlihat (#1c1c21 di atas #1c1c21); "Lihat semua →" tanpa hover.

**Sam:** angka "3" dan "2" aria-hidden dan tidak ada di teks; tooltip grafik hanya hover, batang tidak fokusabel; mask has-more memotong cincin fokus baris terakhir; "Semua rekening" dan "Rentang" tanpa aria-haspopup/expanded; batang 38% tak terlihat; #c2410c di tooltip 4,63 nyaris.

**Riley:** 12/31 bucket memecahkan grafik; 12 invoice lewat tempo memecahkan judul; Rp 1.234.567.890 meluap di tiga tempat; arus bersih negatif tidak digambar (sr "naik" hardcoded); semua kartu nol belum digambar kecuali Rekening; "14 hari ke depan · 22 Sep – 5 Okt" lalu baris "6 Okt" di luar jendela; rel lebar ±900px meluap di laptop 768px tanpa overflow-y; label lintas tahun "Des 25" hanya di docs.

## Minor Observations
- Tooltip September dipasang permanen (artefak mock) dan menutupi puncak batang.
- Badge bel kuning = "belum dibaca" padahal kuning didefinisikan "menunggu".
- "Lihat arus kas →" menuju overview yang tidak ada di 17 tujuan rel.
- `a{color:#8ab4ff}` global tidak pernah dipakai.
- Pil periode 26px di kartu vs 32px di Komponen; dokumentasikan varian xs.
- `dl` hero `repeat(3, auto)` melompat lebar tiap bulan; beri min-width.
- Header "Selasa, 22 September 2026" sudah tiga hari di belakang sesi.
- Est. PPh final layak ikon info + tooltip "estimasi, bukan pajak tercatat".

## Questions to Consider
1. Kalau pekerjaan pukul 09.00 adalah menagih, mereview, dan mencairkan, kenapa satu-satunya tombol primer adalah membuat invoice?
2. Piutang 212 hari: alert harian, atau kasus penagihan yang seharusnya keluar dari dashboard ke alur sendiri?
3. Kalau 90% pemasukan masuk sebagai Payment, apakah grafik yang hanya membaca BankTransaction akan menampilkan perusahaan tanpa pemasukan?
4. Siapa yang menindaklanjuti "HPP sepanjang waktu" setiap pagi?
5. Filter rekening hidup di kartu yang saldo 40px-nya tetap seluruh perusahaan: fitur, atau jebakan?
