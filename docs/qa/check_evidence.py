#!/usr/bin/env python3
"""Jalankan gerbang bukti visual skill qa-evidence pada tata letak project ini.

Implementasinya ada di skill (`scripts/check_evidence.py`) supaya aturan yang
sama berlaku untuk project lain. Di sini hanya path-nya yang ditunjuk.

    python docs/qa/check_evidence.py
"""

from __future__ import annotations

import sys
from pathlib import Path

SKILL_SCRIPTS = Path.home() / '.claude' / 'skills' / 'qa-evidence' / 'scripts'
ROOT = Path(__file__).resolve().parents[2]

sys.path.insert(0, str(SKILL_SCRIPTS))

import check_evidence  # noqa: E402

if __name__ == '__main__':
    raise SystemExit(check_evidence.main([
        str(ROOT / 'docs' / 'qa' / 'test-cases'),
        str(ROOT / 'docs' / 'qa' / 'manifests'),
    ]))
