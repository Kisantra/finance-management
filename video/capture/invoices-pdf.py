"""PDF invoice hasil unduhan capture (out/<folder>/invoice.pdf) → PNG halaman 1 untuk pratinjau cetak.

Penampil PDF bawaan Chromium tidak menggambar apa pun saat headless, jadi skrip capture (invoices-admin.js,
rincian-invoice-print.js) menampilkan gambar PDF asli ini di dalam iframe pratinjau.
Jalankan: python video/capture/invoices-pdf.py [folder]   (bawaan folder = invoices)
"""
import os
import sys

import fitz

FOLDER = sys.argv[1] if len(sys.argv) > 1 else 'invoices'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'out', FOLDER)
doc = fitz.open(os.path.join(OUT, 'invoice.pdf'))
doc[0].get_pixmap(matrix=fitz.Matrix(2.5, 2.5)).save(os.path.join(OUT, 'invoice.png'))
print('png', os.path.join(OUT, 'invoice.png'), doc.page_count, 'halaman')
