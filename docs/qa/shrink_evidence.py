#!/usr/bin/env python3
"""Perkecil tangkapan layar bukti QA agar repository tidak membengkak.

Tangkapan penuh 1440px berukuran 120–650 KB per berkas; pada laporan PDF
lebarnya hanya 30 mm, jadi resolusi sebesar itu tidak menambah keterbacaan
sedikit pun. Skrip ini menurunkannya ke lebar 840px (cukup untuk dizoom saat
ditinjau) dan mengompresnya.

Jalankan dari root project:  python docs/qa/shrink_evidence.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs' / 'qa' / 'evidence'
LEBAR_MAKS = 840


def main() -> int:
    berkas = sorted(EVIDENCE.rglob('*.png'))
    if not berkas:
        print('Tidak ada tangkapan layar di docs/qa/evidence/.')
        return 0

    sebelum = sesudah = 0
    for path in berkas:
        awal = path.stat().st_size
        sebelum += awal

        with Image.open(path) as img:
            img = img.convert('RGB')
            if img.width > LEBAR_MAKS:
                tinggi = round(img.height * LEBAR_MAKS / img.width)
                img = img.resize((LEBAR_MAKS, tinggi), Image.LANCZOS)
            img.save(path, 'PNG', optimize=True)

        akhir = path.stat().st_size
        sesudah += akhir
        print(f'  {path.relative_to(EVIDENCE)!s:<48} {awal // 1024:>4} KB -> {akhir // 1024:>4} KB')

    print()
    print(f'{len(berkas)} berkas: {sebelum // 1024} KB -> {sesudah // 1024} KB '
          f'({100 - sesudah * 100 // max(sebelum, 1)}% lebih kecil)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
