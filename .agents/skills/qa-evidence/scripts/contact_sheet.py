"""Render every screenshot a manifest references onto labelled contact sheets.

    python contact_sheet.py path/to/qa-manifest.json [out_dir]

The mandatory last look before a report is called done: one glance shows a
capture taken mid-spinner, a dialog that never opened, or two steps that are the
same picture. Reading the sheets next to the captions is how a wrong screenshot
gets caught by the tester instead of by the reader.

Sheets are throwaway review aids -- write them outside the repository (default:
a `_contact` folder next to `shots_src`) and do not commit them.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

from qa_manifest import Manifest

COLS, THUMB_W, LABEL_H, PER_SHEET = 4, 480, 22, 24


def main(manifest_path: str, out_dir: str | None = None) -> None:
    m = Manifest(manifest_path)
    src = m.rel('shots_src')
    if not src or not src.exists():
        sys.exit(f'shots_src tidak ditemukan: {src}')
    out = Path(out_dir) if out_dir else src.parent / '_contact'
    out.mkdir(parents=True, exist_ok=True)

    wanted = [(c['id'], n, s) for c in m.cases for n, s in enumerate(c.get('steps') or [], start=1)]
    found, missing = [], []
    for case_id, n, step in wanted:
        path = next((p for ext in ('.png', '.jpg', '.jpeg')
                     if (p := src / f"{step['img']}{ext}").exists()), None)
        (found if path else missing).append((case_id, n, step, path))

    widths = set()
    for start in range(0, len(found), PER_SHEET):
        chunk = found[start:start + PER_SHEET]
        thumbs = []
        for case_id, n, step, path in chunk:
            im = Image.open(path).convert('RGB')
            widths.add(im.width)
            im.thumbnail((THUMB_W - 6, THUMB_W))
            thumbs.append((f"{step['img']}  ({case_id} langkah {n})", im))
        row_h = max(t.height for _, t in thumbs) + LABEL_H + 6
        rows = (len(thumbs) + COLS - 1) // COLS
        sheet = Image.new('RGB', (COLS * THUMB_W, rows * row_h), 'white')
        draw = ImageDraw.Draw(sheet)
        for i, (label, im) in enumerate(thumbs):
            x, y = (i % COLS) * THUMB_W, (i // COLS) * row_h
            draw.text((x + 4, y + 4), label, fill='black')
            sheet.paste(im, (x + 3, y + LABEL_H))
        target = out / f"contact-{start // PER_SHEET + 1}.png"
        sheet.save(target)
        print(f'{target}  ({len(chunk)} gambar)')

    print(f'{len(found)} gambar dirender, lebar sumber: {sorted(widths)} px')
    if missing:
        print(f'PERINGATAN - {len(missing)} gambar di manifest tidak ada: '
              + ', '.join(s['img'] for _, _, s, _ in missing))
    print('Buka tiap lembar di samping caption-nya. Yang dicari: spinner/loading, dialog yang '
          'belum terbuka, pesan yang belum muncul, dua langkah bergambar sama.')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
