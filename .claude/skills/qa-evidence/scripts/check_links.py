"""Verify every relative link and image in a docs tree resolves to a real file.

    python check_links.py path/to/docs [more/paths ...]

Reorganising docs silently breaks links; markdown has no compiler to catch it.
Run this after any move, and before committing a report.
"""

import re
import sys
from pathlib import Path

LINK = re.compile(r'\[[^\]]*\]\(([^)\s]+)\)')
IMG = re.compile(r'<img[^>]+src="([^"]+)"')
SKIP = ('http://', 'https://', '#', 'mailto:', 'tel:')


def check(roots: list[Path]) -> int:
    files: list[Path] = []
    for root in roots:
        files.extend(sorted(root.rglob('*.md')) if root.is_dir() else [root])

    bad, checked = [], 0
    for md in files:
        text = md.read_text(encoding='utf-8', errors='replace')
        # code blocks and spans hold illustrative paths, not real links
        text = re.sub(r'```.*?```', '', text, flags=re.S)
        text = re.sub(r'`[^`\n]*`', '', text)

        for m in list(LINK.finditer(text)) + list(IMG.finditer(text)):
            target = m.group(1).split('#')[0]
            if not target or target.startswith(SKIP):
                continue
            checked += 1
            if not (md.parent / target).resolve().exists():
                bad.append((md, target))

    print(f'{checked} tautan diperiksa di {len(files)} berkas')
    if bad:
        print(f'\n{len(bad)} TAUTAN MATI:')
        for f, t in bad:
            print(f'  {f}  ->  {t}')
        return 1
    print('Semua tautan valid.')
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.exit(check([Path(a).resolve() for a in sys.argv[1:]]))
