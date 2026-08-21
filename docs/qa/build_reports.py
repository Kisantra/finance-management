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

from reportlab.lib.units import mm  # noqa: E402

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

# Galeri bukti pada skrip skill disetel untuk tangkapan layar PONSEL: 4 kolom
# selebar 30 mm, pas untuk gambar potret tinggi. Aplikasi ini diuji lewat
# peramban desktop, jadi gambarnya lanskap — pada lebar 30 mm tingginya jadi
# ~19 mm dan isinya tidak terbaca sama sekali. Satu gambar selebar halaman
# per baris mengembalikan fungsinya sebagai bukti yang bisa ditelusuri ulang.
build_report.PER_ROW = 1
build_report.SHOT_W = 170 * mm


class GambarSiapPakai(build_report.Image):
    """Image yang sudah dimuat sebelum pemanggil menyetel ukurannya.

    reportlab memuat berkas gambar secara malas: menyentuh `imageWidth`
    memicu `_setup()` yang MENIMPA `drawWidth`/`drawHeight` dengan ukuran
    asli. Skrip skill menulis `img.drawWidth = SHOT_W` lalu membaca
    `img.imageHeight` pada baris berikutnya — jadi lebar yang baru saja
    disetel langsung hilang dan gambar digambar seukuran pikselnya,
    melar melewati batas halaman. Tingginya tetap benar, sehingga
    hasilnya gepeng, bukan sekadar kebesaran.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.imageWidth  # noqa: B018 — sengaja: paksa _setup() lebih dulu


build_report.Image = GambarSiapPakai


def sumber_terbaru(manifest: Path) -> float:
    """Waktu ubah terbaru dari manifest beserta tangkapan layar yang dipakainya."""
    import json

    terbaru = manifest.stat().st_mtime

    try:
        data = json.loads(manifest.read_text(encoding='utf-8'))
    except Exception:  # noqa: BLE001 — manifest rusak biar ditangani build_report
        return terbaru

    shots = data.get('shots_dst')
    if not shots:
        return terbaru

    folder = (manifest.parent / shots).resolve()
    if not folder.is_dir():
        return terbaru

    for berkas in folder.iterdir():
        if berkas.is_file():
            terbaru = max(terbaru, berkas.stat().st_mtime)

    return terbaru


def main() -> int:
    manifests = sorted(MANIFESTS.glob('*.json'))
    if not manifests:
        print('Tidak ada manifest. Jalankan build_manifests.py lebih dulu.', file=sys.stderr)
        return 1

    paksa = '--paksa' in sys.argv or '--force' in sys.argv

    gagal = 0
    dilewati = 0
    for path in manifests:
        pdf = ROOT / 'docs' / 'qa' / 'report' / f'Laporan-QA-{path.stem}.pdf'

        # PDF adalah berkas biner: tiap pembangunan ulang menghasilkan blob baru
        # yang tidak bisa dipadatkan terhadap versi sebelumnya, sehingga
        # membangun ulang ke-18-nya di tiap commit menumpuk di riwayat git
        # selamanya. Bangun ulang hanya yang manifest atau tangkapan layarnya
        # memang lebih baru.
        if not paksa and pdf.exists() and pdf.stat().st_mtime >= sumber_terbaru(path):
            dilewati += 1
            continue

        try:
            build_report.build(str(path))
        except Exception as e:  # noqa: BLE001 — laporkan, jangan hentikan sisanya
            print(f'GAGAL {path.name}: {type(e).__name__}: {e}', file=sys.stderr)
            gagal += 1

    print()
    dibangun = len(manifests) - gagal - dilewati
    print(f'{dibangun} PDF dibangun ulang, {dilewati} dilewati (tidak berubah), {gagal} gagal.')
    if dilewati:
        print('Pakai --paksa untuk membangun ulang semuanya.')
    return 1 if gagal else 0


if __name__ == '__main__':
    raise SystemExit(main())
