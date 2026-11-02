# Scripts

Manifest-driven, so they work in any project without editing the code. Write one
`qa-manifest.json` per module in the project, then run the scripts against it.

```bash
pip install reportlab pillow

python contact_sheet.py  path/to/qa-manifest.json   # REVIEW FIRST: every shot on labelled sheets
python build_evidence.py path/to/qa-manifest.json   # copy shots + evidence markdown
python build_report.py   path/to/qa-manifest.json   # PDF
python check_links.py    path/to/docs               # dead-link check
```

## Manifest schema

Paths are resolved **relative to the manifest file**, so the manifest can live
next to the docs it describes and the whole thing stays portable.

```jsonc
{
  "module": "cuti",                       // used in filenames
  "title": "Modul Cuti",                  // report heading
  "date": "28 Juli 2026",
  "environment": "database attendance_qc, backend lokal 192.168.1.41:8000, emulator Pixel 6 (Android 14)",
  "scope": "Eksekusi seluruh 21 test case di docs/qc/test-cases/cuti.md ...",

  "shots_src": "../../../_scratch/shots/cuti",   // raw captures, OUTSIDE the repo
  "shots_dst": "../bukti/cuti",                  // where used shots are committed
  "evidence_into": "../test-cases/cuti.md",      // markdown file to splice into
  "report_out": "../laporan/Laporan-QC-Cuti.pdf",
  "shots_per_row": 1,                     // 1 = desktop: one step per row, full content width. Omit (4) for phone grids

  "summary": [
    "Seluruh test case akhirnya lolos. Tiga gagal di percobaan pertama ...",
    "Temuan terpenting adalah BUG-03: ..."
  ],

  "bugs": [
    {
      "id": "BUG-03",
      "title": "Semua form pengajuan tidak bisa dipakai di Android",
      "sifat": "Penghambat rilis Android",
      "cases": "N01, N02",
      "gejala": "Dialog kalender muncul sendiri dan tidak bisa ditutup.",
      "sebab": "Komponen DateTimePicker dirender tanpa syarat ...",
      "cakupan": "Tiga form terkena: cuti (2 picker), lembur (3), koreksi (3).",
      "perbaikan": "Dibuat komponen bersama ui/date-field.tsx ..."
    }
  ],

  "cases": [
    { "section": "A. KONDISI NORMAL" },
    {
      "id": "N01",
      "title": "Ajukan cuti tahunan valid",
      "verdict": "Pass (percobaan ke-2)",
      "attempts": "fp",                    // f=app defect, t=tooling problem, p=passed
      "note": "Percobaan 1 gagal: form tidak bisa diisi (BUG-03). Percobaan 2 lolos.",
      "steps": [
        { "img": "N01-1", "cap": "Kondisi awal: daftar pengajuan yang sudah ada." },
        { "img": "N01-2", "cap": "Tekan **Ajukan Cuti** — form terbuka." }
      ]
    }
  ],

  "notes": [
    { "id": "BUG-04", "title": "Beranda tidak menunjukkan pengguna sedang cuti",
      "body": "Server memblokir dengan benar, tapi endpoint ... tidak mengirim info cuti." }
  ],

  "tooling_problems": [
    "Menyimpan screenshot ke dalam folder proyek memicu Metro memuat ulang aplikasi."
  ],

  "honesty": "Sebagian besar kode yang diuji ditulis oleh asisten yang sama ..."
}
```

### Notes on fields

- `attempts` drives the coloured squares in the results table. One character per
  attempt. Keep the real history — `fp` (failed, then passed) is more useful
  than pretending it passed first time.
- A `cases` entry containing only `section` renders a group header row.
- `steps` may be omitted for cases with no UI flow (API/DB-verified). Say so in
  `note`; do not invent screenshots.
- Captions support `**bold**` and `` `code` `` in both markdown and PDF output.
- Scoreboard numbers are **computed** from `cases`, never hand-written.
- `shots_per_row` controls both outputs. `1` is required for desktop/web
  captures: the PDF places each step on its own row at the content width (never
  past the margins, caption kept with its image, over-tall captures scaled to fit
  one page) and the markdown emits a caption line plus a `width="100%"` image per
  step. Omitted, it stays the four-per-row grid / 200 px table meant for portrait
  phone captures.
- `contact_sheet.py` writes to `_contact/` next to `shots_src` by default. The
  sheets are review aids — do not commit them.

## Language

The scripts emit only structural labels. Every human-facing string comes from the
manifest, so writing the manifest in Indonesian produces an Indonesian report and
writing it in English produces an English one.
