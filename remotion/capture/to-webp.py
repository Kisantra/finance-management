"""Ubah screenshot PNG hasil capture menjadi WebP (±5x lebih kecil), lalu hapus PNG-nya.

Jalankan setelah capture: python remotion/capture/to-webp.py
"""
import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
for png in glob.glob(os.path.join(ROOT, '*', 'screens', '*.png')):
    Image.open(png).convert('RGB').save(png[:-4] + '.webp', 'WEBP', quality=86, method=6)
    os.remove(png)
    print('webp', os.path.relpath(png[:-4] + '.webp', ROOT))
