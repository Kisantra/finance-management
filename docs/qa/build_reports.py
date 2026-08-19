#!/usr/bin/env python3
"""Kompilasi seluruh manifest QA menjadi PDF per modul.

Membungkus `build_report.py` bawaan skill qa-evidence dengan satu koreksi:
papan skornya memberi label "Bug diperbaiki" pada jumlah SELURUH temuan.
Pada QA ini sebagian besar temuan sengaja belum diperbaiki (menunggu prioritas),
jadi angka itu akan berbohong di halaman depan setiap laporan.

Scoreboard() ditambal agar menghitung hanya temuan ber-status
"SUDAH DIPERBAIKI" — skrip skill tidak diubah, hanya perilakunya di sini.

Jalankan dari root project:
    python docs/qa/build_manifests.py && python docs/qa/build_reports.py
"""

from __future__ import annotations

import sys
from pathlib import Path

SKILL_SCRIPTS = Path.home() / '.claude' / 'skills' / 'qa-evidence' / 'scripts'
ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = ROOT / 'docs' / 'qa' / 'manifests'

sys.path.insert(0, str(SKILL_SCRIPTS))

import qa_manifest  # noqa: E402
import build_report  # noqa: E402

_scoreboard_asli = qa_manifest.Manifest.scoreboard


def scoreboard_jujur(self) -> dict[str, int]:
    angka = _scoreboard_asli(self)
    angka['bugs'] = sum(
        1 for b in self.data.get('bugs', [])
        if b.get('status') == 'SUDAH DIPERBAIKI'
    )
    return angka


qa_manifest.Manifest.scoreboard = scoreboard_jujur
build_report.Manifest.scoreboard = scoreboard_jujur


def main() -> int:
    manifests = sorted(MANIFESTS.glob('*.json'))
    if not manifests:
        print('Tidak ada manifest. Jalankan build_manifests.py lebih dulu.', file=sys.stderr)
        return 1

    gagal = 0
    for path in manifests:
        try:
            build_report.build(str(path))
        except Exception as e:  # noqa: BLE001 — laporkan, jangan hentikan sisanya
            print(f'GAGAL {path.name}: {type(e).__name__}: {e}', file=sys.stderr)
            gagal += 1

    print()
    print(f'{len(manifests) - gagal} PDF terbentuk, {gagal} gagal.')
    return 1 if gagal else 0


if __name__ == '__main__':
    raise SystemExit(main())
