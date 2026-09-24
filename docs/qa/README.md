# QA dengan Bukti

Folder ini berisi hasil pengujian yang bisa diaudit ulang: tiap test case punya ekspektasi tertulis,
rekaman eksekusi, screenshot per langkah, dan vonis yang ditelusuri ke keadaan database — bukan
sekadar "sudah dites, aman".

| Folder | Isi |
|---|---|
| `test-cases/<modul>.md` | Tabel test case + hasil aktual + status, dengan bukti visual per langkah di bagian bawah |
| `evidence/<modul>/` | Screenshot yang dipakai laporan (2732×1800 px, tanpa pengecilan) |
| `report/` | Manifest JSON per modul (sumber scoreboard) dan laporan PDF hasil kompilasi |

## Lingkungan uji (jangan pernah production)

Semua eksekusi dilakukan di database terpisah `finance_management_qc` yang di-seed ulang, dilayani
server lokal terpisah agar `.env` dan database kerja tidak tersentuh:

```bash
DB_DATABASE=finance_management_qc php artisan migrate:fresh --seed --force
DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8001
```

Akun uji: `admin@gmail.com` (admin, dari seeder), `fm@qc.test` (finance manager), `staff@qc.test`
(staff). Semua password `password`. Browser: Chromium via Playwright MCP, viewport 1366×900 pada skala perangkat 2×.

## Cara membaca tabel

| Kolom | Arti |
|---|---|
| **ID** | `N##` normal, `A##` abnormal/edge, `C##` berantai lintas modul. Stabil — laporan merujuk ID ini |
| **Lapisan** | Siapa yang harus menegakkan aturan: `FE` (UI), `BE` (server), atau `FE+BE`. Aturan yang hanya ada di client dianggap tidak ada, karena endpoint bisa dipanggil langsung |
| **Status** | `Pass`, `Fail`, `Blocked`, `Belum diuji`. Kasus yang lolos setelah diperbaiki tetap `Pass`, tetapi kolom Hasil Aktual menyimpan riwayatnya |

Kasus yang kondisinya tidak bisa dicapai dari layar dijalankan lewat API (curl dengan cookie sesi)
atau tinker dan ditandai eksplisit; tidak pernah dibuatkan screenshot palsu.

## Membangun ulang laporan

```bash
python .claude/skills/qa-evidence/scripts/contact_sheet.py  docs/qa/report/qa-manifest-invoices.json   # periksa dulu semua gambar
python .claude/skills/qa-evidence/scripts/build_evidence.py docs/qa/report/qa-manifest-invoices.json
python .claude/skills/qa-evidence/scripts/build_report.py   docs/qa/report/qa-manifest-invoices.json
python .claude/skills/qa-evidence/scripts/check_links.py    docs/qa
```

## Modul yang sudah diuji

| Modul | Test case | Laporan |
|---|---|---|
| Invoice & Pembayaran | [`test-cases/invoices.md`](test-cases/invoices.md) | [`report/Laporan-QA-Invoices.pdf`](report/Laporan-QA-Invoices.pdf) |
