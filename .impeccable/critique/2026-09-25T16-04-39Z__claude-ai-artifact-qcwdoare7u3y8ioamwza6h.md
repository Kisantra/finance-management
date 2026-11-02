---
target: mockup modul Invoice Obsidian (artifact QcWDoaRe7U3y8ioamwza6H v2)
total_score: 23
p0_count: 1
p1_count: 3
timestamp: 2026-09-25T16-04-39Z
slug: claude-ai-artifact-qcwdoare7u3y8ioamwza6h
---
Method: dual-agent (A: design review · B: detector + contrast + render evidence)

Target: mockup modul Invoice Obsidian, artifact QcWDoaRe7U3y8ioamwza6H v2 (Daftar, Editor, Detail, Dialog, EditorTerang, DaftarTerang).

Skor 23/40. P0: data mock bertentangan (nomor 003 ganda di editor & dialog kirim; "Sudah dibayar" tidak memuat invoice lunas ke-3; "6 invoice belum dibayar" vs 7; filter Sep menampilkan invoice Feb; "11 invoice tanpa draft" seharusnya 10).
P1: "Lewat tempo" diperlakukan sebagai status eksklusif padahal model hanya draft/sent/partially_paid/paid — jadikan modifier + filter "Perlu ditagih". P1: pratinjau cetak tidak terbaca (teks 6–8px pada kertas 500px), 200px kosong, stempel menabrak tanda tangan & bar TOTAL; perlu kertas ≥620px / zoom 100%, sorot baris aktif, sticky. P1: tidak ada state error/validasi/kosong/loading.
P2: editor padat (klien per baris selalu tampil, "Tambah item" & "Tambah baris" redundan, label HPP ambigu, breakpoint <1360px). P2: amber 4 makna, "Kirim invoice" menyesatkan (tidak mengirim ke klien) → "Terbitkan & beri nomor".
Bukti B: detektor hanya overused-font (false positive, 21×). Kontras UI lolos kecuali #a16207 pada chip amber terang 4,20:1; kertas #fff di #42b2cc 2,48:1 (warisan template PDF). role="switch" titipan tanpa nama aksesibel. Drawer: timeline pembayaran patah 4 baris, nama faktur patah di tengah token.
