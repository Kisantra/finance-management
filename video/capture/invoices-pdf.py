"""PDF invoice hasil unduhan capture (out/invoices/invoice.pdf) → PNG halaman 1 untuk pratinjau cetak.

Penampil PDF bawaan Chromium tidak menggambar apa pun saat headless, jadi invoices-admin.js
menampilkan gambar PDF asli ini di dalam iframe pratinjau. Jalankan: python video/capture/invoices-pdf.py
"""
import os

import fitz

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'out', 'invoices')
doc = fitz.open(os.path.join(OUT, 'invoice.pdf'))
doc[0].get_pixmap(matrix=fitz.Matrix(2.5, 2.5)).save(os.path.join(OUT, 'invoice.png'))
print('png', os.path.join(OUT, 'invoice.png'), doc.page_count, 'halaman')
