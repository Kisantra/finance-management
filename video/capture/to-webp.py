"""Ubah screenshot PNG hasil capture menjadi WebP (±5x lebih kecil), lalu hapus PNG-nya.

Jalankan setelah capture: python video/capture/to-webp.py <slug>   (tanpa slug = semua modul)
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SLUG = sys.argv[1] if len(sys.argv) > 1 else '*'
for png in glob.glob(os.path.join(ROOT, SLUG, 'screens', '*.png')):
    Image.open(png).convert('RGB').save(png[:-4] + '.webp', 'WEBP', quality=86, method=6)
    os.remove(png)
    print('webp', os.path.relpath(png[:-4] + '.webp', ROOT))
