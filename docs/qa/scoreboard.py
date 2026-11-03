#!/usr/bin/env python3
"""Hitung papan skor QA langsung dari dokumen test case.

Papan skor tidak boleh dihitung tangan: angka yang berselisih dengan tabel di
bawahnya menghancurkan kepercayaan pembaca pada seluruh laporan. Skrip ini
membaca sel Status apa adanya dan menormalkannya, karena penulis test case
memakai gaya berbeda (`Pass`, `**Fail**`, `Fail (BUG-x)`, `Pass (percobaan ke-2)`).

Jalankan dari root project:  python docs/qa/scoreboard.py
"""

import glob
import io
import os
import re
import sys

CASE_ROW = re.compile(r'^\|\s*(N|A|C)\d+\s*\|')


def klasifikasi(sel: str) -> str:
    """Normalisasi sel Status. Ambigu dihitung sebagai 'lainnya', bukan Pass."""
    t = sel.replace('*', '').strip().lower()
    if t.startswith('belum diuji') or t.startswith('not run'):
        return 'belum'
    if t.startswith('blocked'):
        return 'blocked'
    # 'Pass (keamanan) / Fail (...)' -> tidak boleh dibulatkan jadi Pass
    if 'fail' in t and 'pass' in t:
        return 'campuran'
    if t.startswith('fail'):
        return 'fail'
    if t.startswith('pass'):
        return 'pass'
    return 'lainnya'


def main() -> int:
    files = sorted(glob.glob('docs/qa/test-cases/*.md'))
    if not files:
        print('Tidak ada file test case di docs/qa/test-cases/', file=sys.stderr)
        return 1

    total = {k: 0 for k in ('pass', 'fail', 'belum', 'blocked', 'campuran', 'lainnya')}
    baris = []

    for f in files:
        hitung = {k: 0 for k in total}
        n = 0
        for line in io.open(f, encoding='utf-8', errors='replace'):
            if not CASE_ROW.match(line.rstrip('\n')):
                continue
            sel = [c.strip() for c in line.strip().strip('|').split('|')][-1]
            hitung[klasifikasi(sel)] += 1
            n += 1
        for k in total:
            total[k] += hitung[k]
        baris.append((os.path.basename(f)[:-3], n, hitung))

    lebar = max(len(b[0]) for b in baris) + 2
    print(f"{'modul':<{lebar}}{'case':>6}{'pass':>6}{'fail':>6}{'belum':>7}{'lain':>6}")
    print('-' * (lebar + 31))
    for nama, n, h in baris:
        lain = h['blocked'] + h['campuran'] + h['lainnya']
        print(f"{nama:<{lebar}}{n:>6}{h['pass']:>6}{h['fail']:>6}{h['belum']:>7}{lain:>6}")
    print('-' * (lebar + 31))
    jumlah = sum(b[1] for b in baris)
    lain = total['blocked'] + total['campuran'] + total['lainnya']
    print(f"{'TOTAL':<{lebar}}{jumlah:>6}{total['pass']:>6}{total['fail']:>6}{total['belum']:>7}{lain:>6}")
    print()
    print(f"{jumlah} test case dieksekusi")
    print(f"{total['pass']} lolos")
    print(f"{total['fail']} gagal")
    print(f"{total['belum']} belum diuji (tidak dibulatkan menjadi lolos)")
    if lain:
        print(f"{lain} berstatus campuran/lainnya — periksa manual, sengaja tidak dibulatkan")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
