---
target: mockup dashboard Obsidian (artifact KRaWAn3EivPorcHkrKijHS v7)
total_score: 19
p0_count: 2
p1_count: 3
timestamp: 2026-09-24T17-07-47Z
slug: claude-ai-artifact-krawan3eivporchkrkijhs
---
Method: dual-agent (A: design review · B: detector + contrast + headless render)

Target: mockup dashboard Obsidian — artifact KRaWAn3EivPorcHkrKijHS (Main.dc.html hi-fi 1440×1290, Layout.dc.html, Komponen.dc.html), Version 7.

## Design Health Score

| # | Heuristik | Skor | Key issue |
|---|-----------|------|-----------|
| 1 | Visibility of system status | 2 | Tidak ada loading/empty/error per widget; tidak ada stempel "data per HH:MM". |
| 2 | Match system / real world | 2 | "Outstanding", header hari `S S R K J S M` (tiga S), ↗ untuk tautan internal, `⌘K` di Windows. |
| 3 | User control & freedom | 2 | Pil "Rentang" tanpa pemilih tanggal; item Perlu Tindakan tidak bisa di-dismiss. |
| 4 | Consistency & standards | 1 | h2 18 vs 16px; `-Rp` putih vs `−Rp` oranye di daftar yang sama; "3 rekening" vs 5 baris; `INV/02` vs `001/INV/KSN-KB`; 16 nilai radius. |
| 5 | Error prevention | 3 | Halaman baca-saja; toast sudah menyebut sebab + solusi. |
| 6 | Recognition over recall | 2 | Rel ikon-saja tanpa label; tooltip dijanjikan di Layout, tidak ada di hi-fi. |
| 7 | Flexibility & efficiency | 2 | Tidak ada aksi cepat (Buat Invoice / Catat Pembayaran); baris aksi menuju halaman daftar, bukan item. |
| 8 | Aesthetic & minimalist | 2 | Pemasukan September tampil 4×; kalender 190px untuk satu titik; Bulan Ini ~80px kosong; kalimat insight dikarang. |
| 9 | Error recovery | 2 | Tidak ada state gagal-muat per widget. |
| 10 | Help & documentation | 1 | Tidak ada tooltip istilah (HPP, PPh final, Outstanding). |
| **Total** | | **19/40** | **Poor → batas Acceptable** (naik dari 18/40 halaman lama; struktur benar, eksekusi belum) |

## Anti-Patterns Verdict

**LLM:** Bukan template "4 stat card + eyebrow + gradient". Lapisan permukaan, pil aktif putih, dan hatch pengeluaran adalah keputusan yang punya sudut pandang. Tetapi masih terbaca sebagai "Dribbble dark dashboard" generik: donat + kotak insight buatan, kalender dekoratif, pil periode yang backend-nya tidak ada. Untuk alat keuangan yang fatal adalah **angka yang saling bertentangan** di dalam mockup.

**Detektor:** exit 2, 14 temuan, semuanya false positive atau satu fakta yang dihitung berulang: overused-font ×9 dan single-font ×2 (satu keluarga font memang disengaja untuk product UI), flat-type-hierarchy ×2 (hanya di artboard anotasi), numbered-section-markers ×1 (sel kalender 02/10/11/12). Nol ban absolut: tidak ada side-stripe, gradient text, backdrop-filter, eyebrow uppercase, emoji, !important.

**Bukti render (Chromium headless, font termuat):**
- Perlu Tindakan meluap 470px: baris kalender 28/29/30 terpotong, caption "30 Sep · 001/INV/KSN-KB · Rp 5.580.000 jatuh tempo" tertutup kartu di bawahnya.
- Placeholder pencarian terpotong tanpa elipsis: "Cari invoice, klien, transa".
- Fade 28px menutupi baris nyata (Rekening: Mandiri; Invoice: 15 Okt) sehingga terbaca "nonaktif".
- Bulan Ini: ~80px kosong antara Pengeluaran dan Arus bersih.
- Judul baris 1 beda baseline ~9px (Arus Kas vs Perlu Tindakan); baris 2 ~6px (Pengeluaran).
- Komponen: sel "Rp 5.580.000" patah dua baris; 300px bawah artboard kosong.
- Overlay injection dilewati: tidak ada browser yang bisa diskrip sesi ini.

**Kontras (terhitung):** #6b6b75 gagal 4,5:1 di semua permukaan (3,46 di kartu, 3,22 di kartu-dalam); #5b5b66 (disabled) 2,53 gagal keduanya; #fff di #3b82f6 3,68 gagal untuk teks 10–13px (tombol primer, badge rel, tooltip, hari terpilih). Batang bulan lampau #26262c di #151518 ≈ 1,2:1 (grafik butuh 3:1). Semua chip status tinted lolos.

## Overall Impression
Struktur halaman sudah benar dan tenang: hero saldo menjawab pertanyaan pertama pagi hari dalam satu detik. Yang menahannya di 19/40 adalah eksekusi: angka contoh yang saling bertentangan, kartu paling penting meluap, grafik 8 kolom yang efektif hanya menampilkan satu batang, dan lima hue semantik yang masing-masing berarti empat hal. Peluang terbesar: rapikan kebenaran data + kontras, lalu buang redundansi (Bulan Ini, Pengajuan, insight) agar ruangnya kembali ke Invoice Tertunda.

## What's Working
1. **Disiplin permukaan** #0b0b0d → #0f0f12 → #151518 → #1c1c21, tepi putih 6–8%, tanpa bayangan. Konsisten di 8 kartu, terasa mahal tanpa berisik.
2. **Hatch untuk pengeluaran, padat untuk pemasukan.** Membedakan seri lewat tekstur, tahan buta warna dan cetak.
3. **Hero 40px tabular-nums + pil aktif putih.** Biru tetap berarti "aksi/aktif"; prinsip Archipelago "blue is a signal" dijaga lebih tegas dari app sekarang.

## Priority Issues

**[P0] Angka mockup saling bertentangan.** "3 rekening" vs 5 baris; Pengeluaran "Rp 9 jt / 30 hari" vs Bulan Ini "Rp 50.000 / 1–22 Sep" (controller hanya hitung bulan berjalan); transaksi "25 Mar" di antara September; `-Rp` putih vs `−Rp` oranye; `INV/02` vs `001/INV/KSN-KB`; "Rp 5,53 jt" vs "Rp 5.580.000". Kalimat insight "Iklan naik 12%" tidak punya sumber data. — **Kenapa:** alat keuangan kehilangan kepercayaan pada kontradiksi pertama, dan kontradiksi mockup disalin ke implementasi. — **Fix:** satu sumber per angka (`stats.total_balance` + `bankAccounts.length`); label periode statis sama di Pengeluaran dan Bulan Ini; urut `date desc`; debit selalu `−` U+2212 + #fb923c, kredit `+` + #34d399; satu format nomor invoice; chip hero pakai angka penuh, singkatan "jt" hanya di sumbu. Hapus insight. — **Command:** /impeccable harden, /impeccable audit

**[P0] Perlu Tindakan meluap di 470px; kalender tidak sepadan ruangnya.** Markup 36 sel = 6 baris (1 kosong depan + 30 + 5 belakang), dan bulan yang mulai Sabtu memang 6 baris. Caption jatuh tempo hilang di render. 190px grid untuk satu titik oranye yang sudah tertulis "30 Sep · 8 hari lagi" di Invoice Tertunda. — **Fix:** ganti dengan strip 14 hari ke depan (14 sel 26px satu baris, hari ini biru, jatuh tempo oranye + jumlah) + 2 baris "Jatuh tempo berikutnya"; tinggi ≈110px, tidak pernah meluap. Kalau kalender penuh dipertahankan: header `Sen Sel Rab Kam Jum Sab Min`, sel 22px, `grid-auto-rows: 22px`, kartu ≥ 498px. — **Command:** /impeccable distill, /impeccable layout

**[P1] Grafik Arus Kas: 5 dari 6 bulan nyaris tak terlihat.** Batang lampau #26262c ≈ 1,2:1; hatch 22% < 3:1; label sumbu #6b6b75 gagal. Pil Mingguan/Tahunan/Rentang dan filter rekening tidak punya endpoint (`getCashFlowChart` hanya 6 bulan). — **Fix:** batang lampau `rgba(59,130,246,0.38)`, bulan ini #3b82f6; hatch 40% putih, tepi 25%; label sumbu #8b8b95 13px; tooltip terang di setiap batang saat hover; hapus pil dan filter sampai endpoint ada (atau tulis spesifikasinya di docs/module). — **Command:** /impeccable colorize, /impeccable harden

**[P1] Gulir-di-dalam-kartu: fade memotong baris nyata; keyboard/sentuh belum dispesifikasikan.** Fade 28px menutup Mandiri dan 15 Okt; nested scroll di halaman 1290px yang juga menggulir; `overflow:auto` tanpa `tabindex` tidak bisa digulir keyboard di Firefox/Safari; scrollbar 6px tidak ada di sentuh. — **Fix:** tinggi viewport daftar = kelipatan baris persis (Rekening 3×56+2×8 = 184; Invoice 3×48+2×4 = 152; Transaksi 4×48 = 192); fade 12px hanya di zona gap dan hanya saat masih ada sisa (toggle class); `tabindex="0"`, `aria-label="Daftar rekening, 5 item"`, `overscroll-behavior: contain`; hitungan di header "3 dari 5" / "5 dari 40" (`stats.pending_invoices_count`). — **Command:** /impeccable harden, /impeccable polish

**[P1] Warna semantik kelebihan beban + rel mengamputasi 8 modul.** Oranye berarti 4 hal (pengeluaran, "8 hari lagi", "6 item", kategori Gaji); kuning 4 hal (Sebagian, Menunggu, Iklan, hitungan reimbursement); titik 8px oranye vs kuning beda hue ~20°. Rel 76px memuat 9 tujuan; Klien, Layanan, Recurring, Kategori, Feedback, Pengguna, Permissions, Piutang tidak punya rumah, padahal app sekarang punya sidebar berlabel. — **Fix:** donat pakai ramp satu hue netral (#dfe3ea, #a3a8b3, #6b7280, #3f4450); oranye = uang keluar, kuning = menunggu, merah = lewat tempo, hijau = masuk/lunas, biru = aktif/terkirim; badge "6 item" netral. Rel: item "Lainnya" yang membuka panel berlabel, atau rel yang mengembang ke 224px dengan label; tooltip wajib; `:focus-visible` ring 2px #3b82f6. — **Command:** /impeccable colorize, /impeccable quieter, /impeccable layout

**[P2] Redundansi: Bulan Ini, Pengajuan, kotak insight.** Pemasukan September tampil 4×; Bulan Ini ~80px kosong; Pengajuan mengulang Perlu Tindakan dan menampilkan "Dibayar" yang tidak butuh tindakan. — **Fix:** lipat Bulan Ini jadi tiga figur kecil di kanan hero Arus Kas; slot kosongnya untuk Invoice Tertunda span 8 dua-lini; Pengajuan filter pending|approved saja atau hapus. — **Command:** /impeccable distill

**[P2] Copy & i18n.** "Outstanding" → "Belum dibayar"; "Reimburse" → "Reimbursement"; "Terlambat" → "Lewat tempo"; "Semua ↗" → "Lihat semua →"; `⌘K` → `Ctrl K` di Windows; "Sumbu: juta rupiah" → "dalam juta rupiah"; placeholder pencarian dipendekkan atau elipsis. — **Command:** /impeccable clarify

**[P3] Polesan tipografi & token.** #6b6b75 → #8b8b95 untuk semua teks (#6b6b75 hanya ikon dekoratif); minimum teks 12px (42 deklarasi 11px sekarang); h2 semua kartu 16px/600; strip Sepanjang Waktu `1px solid rgba(255,255,255,0.06)` + latar #151518 (garis putus = placeholder menurut vocab sendiri); radius dikunci ke skala 24/16/12/8/999 (sekarang 16 nilai); padding kartu satu nilai (sekarang 24 26 / 24 22 / 22); `letter-spacing` hero −0.01em; tombol primer teks #fff di #3b82f6 hanya ≥14px/600 atau pakai #2563eb. — **Command:** /impeccable typeset, /impeccable polish

## Persona Red Flags

**Alex (power user):** "Apa yang lewat tempo" harus dipindai ke baris ketiga di dua kartu; tidak ada baris merah di posisi teratas. Baris aksi → halaman daftar → klik lagi: dua klik untuk satu review. Roda mouse tersangkut di kartu (nested scroll). Pil periode akan diklik lalu kosong. Tidak ada "Buat Invoice" / "Catat Pembayaran" di halaman yang dibuka tiap pagi.

**Sam (screen reader / keyboard / low-vision):** Sel kalender `<span>` dalam `role="grid"` tanpa row/gridcell, tidak fokusabel. `role="img"` grafik hanya menyebut September; perlu tabel sr-only 6 baris. Chip hero "↑" tanpa teks "naik". #6b6b75 dan #5b5b66 gagal AA. `overflow-y:auto` tanpa `tabindex`. Tidak ada spesifikasi `prefers-reduced-motion`.

**Riley (stress tester):** 0 rekening → kartu 268px kosong, tidak ada empty state. 40 invoice → "Outstanding" mencakup 40 tapi daftar 5 tanpa "5 dari 40". Rp 1.234.567.890 di grid `82px|1fr|auto` menyisakan ~60px untuk nama klien. Arus bersih negatif, saldo negatif, grafik lintas tahun ("Des" tanpa tahun), bulan 6 baris, 8 transaksi "Transaksi Bank" identik: semuanya belum didesain.

## Minor Observations
- Badge "Dibayar" abu identik dengan "Draft" di vocab: dua status, satu wujud.
- Titik notifikasi biru sama dengan warna "aktif"; unread butuh warna sendiri.
- Kontrol header (cari, pil pengguna, bel) memakai #151518 seperti kartu sehingga header terasa bagian grid; coba #0f0f12.
- Layout.dc masih menulis tinggi 300/190/170, hi-fi 470/300/268: sinkronkan.
- `scrollbar-gutter: stable` + `padding-right: 6px` membuat kartu-dalam tidak simetris.
- Stub pengeluaran Sep 4px padahal skala 2px; pakai `min-height: 2px`.
- Layout wireframe punya ruang kosong 60–155px di tiap kartu; Komponen 300px bawah kosong.

## Questions to Consider
1. Kalau kartu Bulan Ini dihapus dan tiga angkanya ditaruh di samping hero, apa yang hilang selain 80px ruang kosong?
2. Kalender bulanan menjawab pertanyaan apa yang tidak dijawab "30 Sep · 8 hari lagi"? Kalau tidak ada, mengapa ia dapat 190px di kartu paling penting?
3. Mengapa invoice 211 hari lewat tempo punya bobot visual sama dengan "3 reimbursement menunggu"? Apa yang terjadi di layar saat angkanya 400 hari?
4. Empat pil periode dan filter rekening dijanjikan; controller hanya punya 6 bulan. Siapa yang membangun endpoint-nya, atau desain berhenti menjanjikan?
5. Delapan modul tidak ada di rel. Obsidian mendesain ulang dashboard atau aplikasi, dan kalau aplikasi, di mana navigasinya?
