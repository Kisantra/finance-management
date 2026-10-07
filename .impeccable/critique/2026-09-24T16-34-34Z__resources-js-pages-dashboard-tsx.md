---
target: Dashboard (resources/js/pages/dashboard.tsx)
total_score: 18
p0_count: 1
p1_count: 2
timestamp: 2026-09-24T16-34-34Z
slug: resources-js-pages-dashboard-tsx
---
Method: dual-agent (A: design-review subagent · B: detector subagent). Browser inspection tidak tersedia sesi ini (MCP browser gagal tersambung); kedua penilaian berbasis kode sumber dan detector CLI.

## Design Health Score

| # | Heuristik | Skor | Isu kunci |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | >20 query tanpa skeleton; tidak ada penanda periode (all-time vs bulan berjalan) |
| 2 | Match System / Real World | 2 | "Total PP 0,5%", "HPP / Billing Klien", tanggal ISO mentah di feed transaksi |
| 3 | User Control and Freedom | 1 | Periode grafik & donut hardcoded; tidak ada yang bisa diatur |
| 4 | Consistency and Standards | 2 | "Permintaan Dana" vs "Pengajuan Dana"; chart income biru (token CTA) vs sistem hijau; dua format tanda negatif |
| 5 | Error Prevention | 3 | `truncate` pada nilai rupiah bisa memotong angka |
| 6 | Recognition Rather Than Recall | 2 | Tidak ada tooltip PP/HPP; tiga link "Lihat semua" identik; biru berarti 4 hal |
| 7 | Flexibility and Efficiency | 1 | Tidak satu pun item feed bisa diklik; hanya 3 elemen fokusable |
| 8 | Aesthetic and Minimalist Design | 2 | 9 tile numerik sebelum grafik; 7 hue di layar pertama |
| 9 | Error Recovery | 2 | Tidak ada error state; profit negatif merah tanpa penjelasan |
| 10 | Help and Documentation | 1 | Nol bantuan kontekstual |
| **Total** | | **18/40** | **Poor — perombakan UX diperlukan** |

## Anti-Patterns Verdict

**LLM assessment:** Halaman memakai hampir seluruh kosakata "dashboard template": ikon kotak pastel + label kecil + angka besar diulang 9 kali, strip warna samping (`dashboard.tsx:177`), `hover:shadow-lg` pada kartu yang tidak bisa diklik (`176`, `205`), `rounded-xl` bahkan pada kotak ikon 36 px, gradient text pada h1 (`page-header.tsx:20`, dimandatkan `archipelago.md`), eyebrow uppercase tracked di sidebar (`sidebar.tsx:380`) dan `stats-card.tsx:62`, glassmorphism header (`header.tsx:130`), emoji bendera di language switcher (`header.tsx:61-63`). Dekorasi banyak, tidak ada yang mengkodekan makna finansial.

**Deterministic scan:** 0 temuan pada 9 file (exit 0), 44 rule. **False negative terverifikasi:** rule `gradient-text` hanya mengenali `bg-gradient-to-` (Tailwind v3); proyek memakai Tailwind v4 (`bg-linear-to-`), sehingga gradient text di `page-header.tsx:20` lolos. Detector terbukti berfungsi lewat file probe. Kesimpulan: 0 temuan bukan berarti bersih; LLM review menemukan 10 kategori tell yang regex tidak jangkau.

**Visual overlays:** tidak ada (browser tool tidak tersedia).

## Overall Impression
Halaman menjawab "berapa yang sudah dihasilkan sejak perusahaan berdiri" padahal pengguna bertanya "apa yang perlu saya lakukan hari ini". Angka terpenting (saldo kas) 14 px di pojok; angka yang tidak berubah dari hari ke hari 24 px di atas lipatan. Peluang terbesar: balikkan hierarki dan buat data yang perlu tindakan bisa diklik.

## What's Working
- Tile "Net Bln Ini" (`399-419`) state-aware konsisten di semua dimensi.
- Copy jatuh tempo dua tingkat "Terlambat N hari" / "Jatuh tempo N hari lagi" (`574-583`) — keputusan produk terbaik di halaman.
- Disiplin token dark mode (`dark-700/600/50/400`) menjaga parity light/dark.

## Priority Issues
- **[P0] Data yang perlu tindakan tidak terlihat dan tidak bisa ditindak** — `pending_invoices_count/amount` dihitung server (`DashboardController:55-65`) tapi tidak dirender; semua item feed `div` tanpa link. Fix: panel "Perlu Tindakan" di baris pertama memakai `actionCounts`; bungkus item feed dengan `Link`. Suggested: /impeccable layout, /impeccable shape.
- **[P1] Hierarki terbalik** — Total Saldo `text-sm`, akumulasi all-time `text-2xl`. Fix: saldo kas jadi satu-satunya hero + delta bulan ini; akumulasi turun ke satu baris "Sepanjang waktu". Suggested: /impeccable layout, /impeccable typeset.
- **[P1] Tujuh hue bersaing, biru primer dipakai untuk data** — chart income `#2563eb`, donut mulai `#2563eb`, pill Total Saldo biru. Fix: biru hanya untuk aksi/pilihan; income hijau, expense oranye; kategori donut tanpa biru. Suggested: /impeccable colorize, /impeccable quieter.
- **[P2] Aksesibilitas** — `text-[10px]` di 7 tempat, muted `dark-500` di `dark-700` ≈ 3,9:1, tiga link "Lihat semua" identik, h1 → h3 lompat, ikon-only tanpa label di header/sidebar. Suggested: /impeccable audit, /impeccable harden.
- **[P2] Format angka & edge case** — `truncate` pada rupiah, "Rp -500.000" vs "-Rp 500.000", sumbu Y "1250.0jt", tanggal ISO, "Jatuh tempo 0 hari lagi", badge Terkirim + teks Terlambat bertentangan. Suggested: /impeccable clarify, /impeccable harden.
- **[P3] Empty/loading state** — 7 empty state teks polos bukan `EmptyState`; tidak ada skeleton. Suggested: /impeccable onboard.

## Persona Red Flags
**Alex (power user):** tidak bisa klik apa pun dari feed; jumlah & nominal invoice tertunda tersedia tapi tidak ditampilkan; tidak ada pemilih periode; sidebar (`sidebar.tsx:291`) memberi tahu lebih banyak daripada dashboard.
**Sam (screen reader):** tab order hanya 3 link identik; h1 langsung h3; hamburger/dark toggle/collapse tanpa label; dua SVG chart tanpa nama; feed memakai div + space-y, bukan ul/li.

## Minor Observations
- `total_balance` dikirim dua kali (accessor computed dijalankan 2×).
- Docs menyebut "Total Pendapatan"; UI "Total Pemasukan" — drift.
- `stats-card.tsx` (komponen katalog wajib) tidak dipakai; dua sistem stat card berdampingan.
- Sidebar/header memakai `gray-*`/`zinc-*` mentah, bukan token `dark-*`.
- Feed transaksi menggabungkan `bank_transactions` + `payments` tanpa penanda sumber.
- `Building2`, `FileText`, `RefreshCw` diimpor tapi tidak dipakai.

## Questions to Consider
- Apakah angka "sepanjang waktu" pantas berada di dashboard, atau tempatnya di Laporan Laba Rugi?
- Jika badge sidebar sudah memberi tahu apa yang perlu ditindak, untuk apa dashboard ada?
- Kalau halaman ini diringkas satu kalimat ("Kas Rp X, bulan ini +Rp Y, 3 invoice terlambat senilai Rp Z"), berapa dari 9 tile yang bertahan?
