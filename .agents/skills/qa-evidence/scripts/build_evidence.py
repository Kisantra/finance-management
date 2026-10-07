"""Copy the screenshots actually used into the repo, and splice the per-case
evidence section into the test case markdown.

    python build_evidence.py path/to/qa-manifest.json

Only images referenced by a step are copied -- failed captures and retries stay
in the scratch directory and never reach the repository.
"""

import os
import re
import shutil
import sys
from pathlib import Path

from qa_manifest import Manifest

BEGIN, END = '<!-- qa-evidence:start -->', '<!-- qa-evidence:end -->'
# Older files may predate the fence; fall back to a heading match so re-running
# replaces the section instead of appending a duplicate.
HEADING = re.compile(r'^#{1,2} +Bukti visual.*$', re.M | re.I)
INTRO = (
    'Screenshot diambil per langkah, bukan hanya hasil akhirnya, supaya alurnya\n'
    'bisa ditelusuri ulang oleh orang lain. Test case yang kondisinya tidak bisa\n'
    'dicapai dari layar dijalankan lewat API/DB dan ditandai eksplisit — tidak\n'
    'dibuatkan screenshot seolah-olah ada alur UI-nya.\n'
)


def rel_url(from_file: Path, to_file: Path) -> str:
    """Relative POSIX path from a markdown file to an image, whatever the nesting."""
    return os.path.relpath(to_file, from_file.parent).replace(os.sep, '/')


def main(manifest_path: str) -> None:
    m = Manifest(manifest_path)
    src, dst = m.rel('shots_src'), m.rel('shots_dst')
    doc = m.rel('evidence_into')
    if not src or not src.exists():
        sys.exit(f'shots_src tidak ditemukan: {src}')
    dst.mkdir(parents=True, exist_ok=True)

    lines, copied, missing = [], 0, []

    for case in m.cases:
        steps = case.get('steps') or []
        header = f"\n## {case['id']} · {case['title']}"
        if case.get('verdict'):
            header += f" — {case['verdict']}"
        lines.append(header + '\n')

        if not steps:
            lines.append(
                f"_Tanpa langkah UI — {case.get('note', 'dijalankan lewat API/DB.')}_\n")
            continue

        # "shots_per_row": 1 (desktop) -> one block per step, image at full width.
        # Default stays the compact three-column table that suits phone captures.
        one_per_row = int(m.get('shots_per_row', 4)) == 1
        if not one_per_row:
            lines.append('| # | Langkah & yang terlihat | Layar |')
            lines.append('|---|---|---|')
        for n, step in enumerate(steps, start=1):
            stem = step['img']
            found = next((p for ext in ('.jpg', '.jpeg', '.png')
                          if (p := src / f'{stem}{ext}').exists()), None)
            if not found:
                missing.append(stem)
                lines.append(f"**{n}.** {step['cap']} _(gambar hilang: {stem})_\n" if one_per_row
                             else f"| {n} | {step['cap']} | _(gambar hilang: {stem})_ |")
                continue
            target = dst / found.name
            # Re-running with shots already in place is normal; copying a file
            # onto itself raises PermissionError on Windows.
            if found.resolve() != target.resolve():
                shutil.copy2(found, target)
                copied += 1
            url = rel_url(doc, target) if doc else f'{dst.name}/{found.name}'
            if one_per_row:
                lines.append(f"**{n}.** {step['cap']}\n\n<img src=\"{url}\" width=\"100%\">\n")
            else:
                lines.append(f"| {n} | {step['cap']} | <img src=\"{url}\" width=\"200\"> |")

    body = '\n'.join(lines) + '\n'

    section = (f'{BEGIN}\n\n# Bukti visual langkah per langkah\n\n{INTRO}\n{body}\n{END}\n')

    if doc and doc.exists():
        text = doc.read_text(encoding='utf-8')
        if BEGIN in text and END in text:
            head, rest = text.split(BEGIN, 1)
            tail = rest.split(END, 1)[1]
            new = f'{head.rstrip()}\n\n{section}{tail.lstrip()}'
        elif (hit := HEADING.search(text)):
            new = f'{text[:hit.start()].rstrip()}\n\n{section}'
        else:
            new = f'{text.rstrip()}\n\n{section}'
        doc.write_text(new, encoding='utf-8')
        print(f'disambungkan ke: {doc}')
    else:
        out = m.base / f"bukti-visual-{m.get('module', 'modul')}.md"
        out.write_text(body, encoding='utf-8')
        print(f'ditulis ke: {out}')

    print(f'{copied} gambar disalin ke {dst}')
    if missing:
        print(f'PERINGATAN — {len(missing)} gambar tidak ditemukan: {", ".join(missing)}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
