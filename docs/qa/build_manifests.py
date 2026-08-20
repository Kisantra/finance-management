#!/usr/bin/env python3
"""Susun manifest QA per modul langsung dari dokumen test case.

646 case di 18 modul tidak mungkin ditulis manifest-nya satu per satu tanpa
angka dan tabel berselisih. Skrip ini membaca `docs/qa/test-cases/*.md` sebagai
sumber tunggal, lalu menuliskan `docs/qa/manifests/<modul>.json` yang siap
dikompilasi `build_report.py` menjadi PDF.

Jalankan dari root project:  python docs/qa/build_manifests.py
"""

from __future__ import annotations

import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEST_CASES = ROOT / 'docs' / 'qa' / 'test-cases'
MANIFESTS = ROOT / 'docs' / 'qa' / 'manifests'

TANGGAL = '19 Agustus 2026'
LINGKUNGAN = (
    'branch multi-tenancy, APP_ENV=local, database pusat finance_central + satu '
    'database per perusahaan (tenant_*), aplikasi di http://127.0.0.1:8000. '
    'Bukan production.'
)

JUDUL = {
    'admin-users-permissions': 'Admin — Users & Permissions',
    'auth-multitenancy': 'Autentikasi & Multi-Tenancy',
    'bank-accounts': 'Bank Accounts',
    'cash-flow': 'Cash Flow',
    'clients': 'Clients',
    'dashboard': 'Dashboard',
    'feedbacks': 'Feedbacks',
    'fund-requests': 'Permintaan Dana',
    'invoices': 'Invoice & Pembayaran',
    'loans': 'Loans (Utang Perusahaan)',
    'notifications': 'Notifications',
    'profit-loss': 'Laporan Laba Rugi',
    'receivables': 'Receivables (Piutang)',
    'recurring-invoices': 'Recurring Invoices',
    'reimbursements': 'Reimbursements',
    'services': 'Services',
    'settings': 'Settings',
    'transaction-categories': 'Transaction Categories',
}


# Temuan yang BENAR-BENAR sudah diperbaiki supervisor beserta test regresinya.
# Daftar ini menggerakkan lencana status di PDF dan angka "Bug diperbaiki" pada
# papan skor — jangan menambah id ke sini tanpa perbaikan nyata + testnya.
SUDAH_DIPERBAIKI = {
    'admin-users-permissions': {'BUG-ADM-01'},
    'bank-accounts': {'BUG-BA-01', 'BUG-BA-04', 'BUG-BA-05'},
    'cash-flow': {'BUG-CF-01', 'BUG-CF-03'},
    'clients': {'C-02'},
    'feedbacks': {'BUG-FB-01'},
    'fund-requests': {'BUG-FR-02'},
    'invoices': {'I-02', 'I-03'},
    'loans': {'BUG-L1', 'BUG-L4'},
    'profit-loss': {'BUG-PL-01'},
    'receivables': {'BUG-C1', 'BUG-C2', 'BUG-C4', 'BUG-C6', 'BUG-C8'},
    'reimbursements': {'BUG-R1', 'BUG-R4', 'BUG-R5', 'BUG-R6'},
    'settings': {'BUG-SET-02'},
}

# Diperbaiki sebagian — akar utamanya ditutup, sisa jalurnya belum.
SEBAGIAN = {
    'cash-flow': {'BUG-CF-02'},
}


# Keterangan tiap tangkapan layar. Caption yang menjelaskan APA YANG TERLIHAT
# dan KENAPA ITU PENTING-lah yang membuat gambar menjadi bukti; tanpa itu ia
# cuma hiasan. Hanya case yang benar-benar dijalankan lewat layar yang punya
# entri di sini — sisanya dieksekusi lewat HTTP dan dinyatakan demikian.
BUKTI_LAYAR = {
    'auth-multitenancy': {
        'N01': [
            ('N01-1', 'Halaman masuk sebelum autentikasi — titik awal seluruh alur.'),
            ('N01-2', 'Admin kini anggota 6 perusahaan, sehingga pemilih perusahaan tampil; harapan asli case ini sudah tidak berlaku di lingkungan yang bergeser.'),
        ],
        'N02': [
            ('N02-1', 'Pemilih perusahaan untuk akun anggota lebih dari satu perusahaan; tiap kartu menuju /c/{slug}/dashboard.'),
        ],
        'N05': [
            ('N05-2', 'Sidebar tepat setelah login, tanpa reload: seluruh menu sudah ber-prefix /c/{slug} — bukti perbaikan BUG-01.'),
        ],
        'A01': [
            ('A01-1', 'Kata sandi salah: pesan galat tampil di bawah kolom email, kini berbahasa Indonesia setelah BUG-AUTH-02 diperbaiki.'),
        ],
        'A05': [
            ('A05-1', 'User yang sudah login membuka /login diarahkan ke pemilih perusahaan, bukan 500 — regresi BUG-03 tetap tertutup.'),
        ],
        'N03': [
            ('N03-1', 'Setelah kartu Kisantra dipilih: konteks perusahaan aktif, header sidebar menampilkan nama perusahaan dan tombol Ganti perusahaan.'),
        ],
        'N04': [
            ('N04-1', 'Akun anggota satu perusahaan (`qa-solo`) mendarat langsung di dashboard tanpa melewati pemilih; menu tersaring sesuai role staff.'),
        ],
        'N06': [
            ('N06-1', 'Setelah Keluar ditekan: kembali ke halaman masuk, sesi berakhir.'),
        ],
        'C01': [
            ('C01-1', 'Kisantra dengan filter Februari 2026: 2 invoice, Total Pendapatan Rp 6.000.000.'),
            ('C01-2', 'Semesta dengan URL dan filter yang persis sama: 0 hasil, seluruh kartu Rp 0 — data tidak saling bocor.'),
        ],
        'C04': [
            ('C04-1', 'Tombol Ganti perusahaan membuka daftar perusahaan yang boleh diakses manager.'),
            ('C04-2', 'Konteks berpindah ke Semesta tanpa login ulang; header, menu, dan seluruh angka mengikuti perusahaan baru.'),
        ],
    },
    'admin-users-permissions': {
        'N04': [
            ('N02-1', 'Matriks izin & peran; pembuatan user dilakukan dari modul Pengguna yang tunduk pada matriks ini.'),
        ],
        'N14': [
            ('N02-1', 'Matriks izin per peran — sumber kebenaran permission yang menggate seluruh modul.'),
        ],
    },
    'bank-accounts': {
        'A11': [('A11-1', 'Halaman Rekening Bank tetap normal; permintaan tab Transaksi dengan kolom urut sembarang menjawab 200 (dulu 500 dengan pesan SQL yang menyebut nama database).')],
        'A12': [('A11-1', 'Kolom urut di luar whitelist jatuh ke transaction_date alih-alih menjatuhkan endpoint.')],
        'A13': [('A11-1', 'Arah urut di luar asc/desc jatuh ke desc; endpoint tetap 200.')],
        'A14': [('A11-1', 'per_page=100000 dijepit menjadi 100 pada respons endpoint transaksi.')],
        'N17': [
            ('N01-1', 'Saldo Rp 14.850.000 dihitung ulang dari saldo awal + pemasukan − pengeluaran, bukan disimpan.'),
        ],
    },
    'cash-flow': {
        'N03': [
            ('N03-1', 'Dialog Catat Pemasukan: rekening, kategori, nominal lewat CurrencyInput, tanggal, deskripsi, dan unggahan bukti.'),
        ],
        'N04': [
            ('N01-2', 'Dialog Catat Pengeluaran dengan pemilih kategori berjenjang.'),
        ],
        'N07': [
            ('N03-1', 'Form yang sama dipakai untuk menyunting transaksi pemasukan.'),
        ],
        'N18': [
            ('N03-1', 'Area unggah lampiran menerima PDF/JPG/JPEG/PNG hingga 5 MB, dengan drag & drop.'),
        ],
        'A01': [
            ('N03-1', 'Kolom Jumlah wajib terisi; nominal nol ditolak server.'),
        ],
        'A02': [
            ('N03-1', 'Nominal negatif tidak dapat diketik pada CurrencyInput dan ditolak server.'),
        ],
        'A05': [
            ('N01-1', 'Halaman Pengeluaran; transfer ke rekening yang sama ditolak pada form transfer.'),
        ],
        'A06': [
            ('N01-1', 'Biaya admin negatif ditolak pada form transfer di modul yang sama.'),
        ],
        'A07': [
            ('N03-1', 'Jenis berkas yang diterima dinyatakan eksplisit di area unggah; tipe lain ditolak.'),
        ],
        'A29': [
            ('N01-3', 'Daftar transaksi setelah penyimpanan; URL lampiran kini ber-prefix perusahaan sehingga pratinjaunya terbuka.'),
        ],
        'A28': [('A28-1', 'Halaman Pemasukan; permintaan transaksi masuk berkategori pengeluaran kini ditolak 422 dengan pesan "Kategori pemasukan diperlukan untuk transaksi masuk." (dulu diterima dan menjadi transaksi hantu yang tetap mengubah saldo).')],
        'N21': [
            ('N01-1', 'Halaman Pengeluaran kosong — periode default "Semua waktu", bukan bulan berjalan.'),
            ('N01-2', 'Pemilih kategori: induk hanya menjadi judul grup, hanya anak (↳ MAKAN MINUM) yang bisa dipilih.'),
            ('N01-3', 'Pengeluaran tersimpan Rp 350.000 dan langsung terhitung di kartu total serta jumlah transaksi.'),
        ],
    },
    'clients': {
        'A15': [('A14-1', 'Akar yang sama dengan A14: grup OR kini dibungkus closure sehingga filter tipe tidak lagi bocor — layar menunjukkan 0 hasil untuk kombinasi yang dulu salah.')],
        'A16': [('A14-1', 'Kombinasi pencarian + filter kini benar-benar meng-AND-kan syaratnya; hasil 0 pada layar membuktikan filter tidak lagi diabaikan.')],
        'C02': [('C02-1', 'Konfirmasi hapus menyebut jumlah invoice dan menyatakan penghapusan tidak bisa dilakukan.'),
                ('C02-2', 'Server menolak penghapusan dan menyebut invoice penahannya; klien tetap ada, tidak ada pembayaran yang lenyap.')],
        'C03': [('C02-2', 'Karena penghapusan klien ditolak, rantai cascade yang dulu menghapus pembayaran dan menurunkan saldo bank tidak pernah terjadi.')],
        'C04': [('A14-1', 'Klien nonaktif tidak lagi bisa dipakai menerbitkan invoice; penegakannya kini di server (lihat tes regresi), bukan hanya penyaringan opsi di layar ini.')],
        'A14': [('A14-1', 'Pencarian "Rina" digabung filter tipe Perusahaan kini menghasilkan 0 klien; sebelumnya klien individual bocor lolos filter.')],
        'A17': [('A17-1', 'URL dengan kolom urut sembarang dan per_page 99999 memuat halaman normal — sebelumnya 500 dengan pesan SQL yang menyebut nama database. Nama klien 255 karakter kini membungkus sehingga seluruh kolom tetap terlihat.')],
        'N12': [
            ('N01-1', 'Daftar klien dengan statistik dan kolom ringkasan penagihan.'),
            ('N02-1', 'Dialog tambah klien terbuka dari tombol Tambah Klien.'),
            ('N02-2', 'Form terisi: tipe Perusahaan dipilih, NPWP dan PIC diisi.'),
            ('N02-3', 'Klien tersimpan — jumlah total naik 5 menjadi 6 dan baris baru tampil lengkap dengan NPWP-nya.'),
        ],
        'N13': [
            ('C02-1', 'Konfirmasi hapus menyebut jumlah invoice dan menyatakan penghapusan tidak bisa dilakukan — sebelumnya justru menjanjikan invoice ikut terhapus.'),
            ('C02-2', 'Server menolak penghapusan dan menyebut invoice penahannya; baris klien tetap ada di tabel.'),
        ],
    },
    'dashboard': {
        'N05': [
            ('N05-1', 'Saldo Kas QA5 Rp 120.789.000 pada kartu rekening sama persis dengan badge Total Saldo di kepala halaman — satu angka dihitung ulang, bukan dua angka tersimpan.'),
        ],
        'N13': [
            ('N01-1', 'Dashboard perusahaan lain (QA Satu) terbuka utuh: kartu ringkasan, grafik arus kas, dan daftar rekening.'),
        ],
        'A03': [
            ('A03-1', 'Setelah login dari nol, akun tanpa view dashboard dan tanpa view expense mendarat di Feedback & Saran yang terbuka penuh; sebelumnya rantai redirect berakhir 403 dan user terkunci total.'),
        ],
        'N01': [
            ('N02-1', 'Blok atas dashboard terender: ringkasan finansial, stats bulan berjalan, grafik arus kas, dan donut kategori.'),
            ('N05-1', 'Blok bawah: rekening bank, reimbursement, pengajuan dana, invoice tertunda, dan transaksi terbaru — total sembilan blok props punya wujud di layar.'),
        ],
        'N02': [
            ('N02-1', 'Kartu Total Pemasukan menampilkan Rp 15.000.000 — seluruh pembayaran, termasuk porsi titipan pajak.'),
        ],
        'N03': [
            ('N02-1', 'Total HPP / Billing Klien Rp 4.000.000 dan Total Profit Rp 11.000.000, persis angka yang dihitung tangan sebelum pengujian.'),
        ],
        'N04': [
            ('N02-1', 'Kartu Total PP 0,5% menampilkan Rp 50.000, bukan Rp 75.000 — item titipan pajak dikeluarkan dari basis.'),
        ],
        'N06': [
            ('N02-1', 'Sisa Outstanding Rp 0 pada kartu ringkasan.'),
            ('N05-1', 'Panel Invoice Tertunda berbunyi "Tidak ada invoice tertunda".'),
        ],
        'N07': [
            ('N02-1', 'Stats bulan berjalan: Pemasukan Rp 0, Pengeluaran Rp 1.500.000, Net −Rp 1.500.000.'),
        ],
        'N08': [
            ('N02-1', 'Grafik enam bulan Mar–Agt dengan label bulan terlokalkan; Juni tertinggi, Juli nyaris rata.'),
        ],
        'N09': [
            ('N02-1', 'Mar, Apr, dan Mei kosong di grafik meski ketiganya punya pembayaran invoice — grafik hanya membaca bank_transactions.'),
        ],
        'N10': [
            ('N05-1', 'Panel Transaksi Terbaru: 8 kartu dengan tanggal, rekening, dan arah dana.'),
        ],
        'N11': [
            ('N05-1', 'Panel Pengajuan Dana menampilkan judul, nominal, status, prioritas, pemohon, dan tanggal.'),
        ],
        'N12': [
            ('N02-1', 'Badge angka 1 pada menu Permintaan Dana untuk admin yang memegang approve fund requests; nilai untuk staff dibaca dari props karena butuh sesi aktor lain.'),
        ],
        'A01': [
            ('A03-1', 'Pendaratan user tanpa view dashboard mengikuti daftar prioritas modul, bukan tujuan yang dipatok.'),
        ],
        'A02': [
            ('A03-1', 'User tanpa view dashboard dan tanpa view expense kini mendarat di Feedback & Saran, bukan 403.'),
        ],
        'A07': [
            ('N02-1', 'Donut Pengeluaran per Kategori terisi satu irisan MAKAN MINUM setelah transaksi C01; sebelum itu kosong tanpa error.'),
        ],
        'A08': [
            ('N05-1', 'Panel Reimburse Terbaru berbunyi "Belum ada pengajuan".'),
        ],
        'C01': [
            ('N02-1', 'Keadaan sesudah transaksi C01: saldo Rp 120.789.000 (turun tepat Rp 1.500.000), Pengeluaran Bln Ini Rp 1.500.000, donut terisi. Angka sebelum transaksi dibaca dari props.'),
        ],
        'C02': [
            ('N02-1', 'Badge Permintaan Dana tetap tampil di halaman non-dashboard karena berupa shared prop; nilainya 1 untuk admin.'),
        ],
    },
    'feedbacks': {
        'N01': [
            ('N14-1', 'Formulir kirim feedback: tipe, prioritas, judul, deskripsi, dan lampiran.'),
        ],
        'N04': [
            ('N01-1', 'Tab default mengikuti hak akses — pengelola melihat Semua, pengguna biasa hanya miliknya.'),
        ],
        'N07': [
            ('N14-1', 'Formulir yang sama dipakai pemilik untuk menyunting feedback berstatus terbuka.'),
        ],
        'N08': [
            ('A19-1', 'Daftar feedback tempat pengelola membuka dan menanggapi pengajuan.'),
        ],
        'N12': [
            ('A19-1', 'Pengelola dapat menghapus feedback siapa pun dari daftar ini.'),
        ],
        'N13': [
            ('A19-1', 'Pemilik dapat menghapus feedback miliknya selama masih berstatus terbuka.'),
        ],
        'N14': [
            ('N14-1', 'Area unggah lampiran pada formulir feedback.'),
        ],
        'A01': [
            ('N01-1', 'Tab Semua tidak ditawarkan bagi yang tidak berhak; parameter tab kini juga dipaksa di server.'),
        ],
        'A02': [
            ('N01-1', 'Pemilik lain pun tidak dapat memaksa tampilan Semua lewat query string.'),
        ],
        'A10': [
            ('A19-1', 'Feedback yang sudah diproses kehilangan tombol hapus bagi pemiliknya.'),
        ],
        'C01': [
            ('N14-1', 'Siklus hidup feedback berpangkal pada formulir ini.'),
            ('A19-1', 'lalu berlanjut di daftar tempat pengelola menanggapi dan menutupnya.'),
        ],
        'C02': [
            ('A19-1', 'Isolasi kepemilikan terlihat dari daftar: masing-masing pemilik hanya melihat miliknya.'),
        ],
        'A19': [('A19-1', 'Modul Feedback; lampiran kini benar-benar terhapus dari disk saat feedback dihapus (dibuktikan tes regresi, karena kegagalannya tak bergejala di layar).')],
        'N15': [
            ('N01-1', 'Tombol feedback melayang membuka formulir dengan pilihan tipe dan prioritas; halaman asal terisi otomatis.'),
        ],
    },
    'fund-requests': {
        'N01': [
            ('N01-2', 'Form pengajuan dengan rincian item; total dihitung otomatis dari kuantitas × harga satuan.'),
        ],
        'N08': [
            ('N01-2', 'Tombol Ajukan pada form yang sama mengirim langsung tanpa melewati draft.'),
        ],
        'A02': [
            ('N01-2', 'Minimal satu item wajib ada — form selalu menyediakan baris pertama.'),
        ],
        'A03': [
            ('N01-2', 'Kuantitas minimal 1 pada kolom Qty.'),
        ],
        'A04': [
            ('N01-2', 'Tanggal Dibutuhkan Sebelum tidak menerima tanggal yang sudah lewat.'),
        ],
        'A07': [
            ('C01-1', 'Dialog review tempat catatan ditulis; panjangnya dibatasi di server.'),
        ],
        'A09': [
            ('C01-3', 'Dialog pencairan dengan pemilih tanggal.'),
        ],
        'A21': [
            ('C01-5', 'Bukti bayar pencairan terbuka lewat URL storage per-perusahaan.'),
        ],
        'C02': [
            ('N01-2', 'Pengajuan ulang setelah ditolak memakai form yang sama; statusnya kini benar-benar berpindah ke Pending.'),
        ],
        'A19': [('A26-1', 'Modul Permintaan Dana; kategori item kini dibatasi bertipe pengeluaran di server, sehingga pencairannya selalu terlihat di halaman Cash Flow.')],
        'A26': [('A26-1', 'Filter status Approved menghasilkan 0 baris, dan keempat kartu statistik ikut menunjukkan 0 — sebelumnya kartu tetap menampilkan angka global (TOTAL 1, DICAIRKAN 1) sementara tabelnya kosong.')],
        'C04': [('A26-1', 'Pencairan tidak lagi bisa memakai kategori non-pengeluaran, sehingga transaksi hasil pencairan tidak menjadi transaksi hantu.')],
        'N18': [
            ('N01-1', 'Daftar permintaan dana kosong dengan kartu status per tahap.'),
            ('N02-1', 'Form pengajuan: nomor ter-generate otomatis per perusahaan (001/SAT/VIII/2026) dan total item terhitung Rp 1.200.000.'),
            ('N02-2', 'Pengajuan masuk berstatus Pending Review; badge sidebar menampilkan 1 item menunggu.'),
        ],
        'C05': [
            ('C01-1', 'Dialog persetujuan menampilkan pemohon dan nominal sebelum keputusan diambil.'),
            ('C01-2', 'Status berpindah ke Approved dan tombol aksi berganti menjadi Cairkan.'),
            ('C01-3', 'Dialog pencairan: catatan opsional (perbaikan nullable) dan bukti bayar terunggah lewat drag & drop.'),
            ('C01-4', 'Status akhir Disbursed tanpa catatan pencairan diisi.'),
            ('C01-5', 'Berkas bukti bayar terbuka lewat URL storage per-perusahaan — bukti BUG-02 tertutup.'),
        ],
    },
    'invoices': {
        'A11': [('A11-1', 'Pemilih klien pada Buat Invoice hanya memuat klien aktif; penegakan sebenarnya ada di server (StoreInvoiceRequest), layar ini hanya lapis pertamanya.')],
        'A12': [('A12-1', 'Ketikan diskon 150% dijepit menjadi 100 di layar, dengan keterangan "Bilangan bulat, maksimal 100%"; server menolak nilai di atas 100 secara terpisah.')],
        'A13': [('A12-1', 'Panel diskon yang sama membatasi diskon nominal ke subtotal, sehingga TOTAL tidak lagi bisa dipaksa menjadi Rp 0 oleh diskon yang mustahil.')],
        'A14': [('A12-1', 'Kolom persen hanya menerima bilangan bulat; pecahan tidak lagi dipotong diam-diam menjadi angka yang lebih kecil.')],
        'C02': [('C02-1', 'Tanggal invoice 5 September 2026 menghasilkan preview 002/INV/QS-XXX/IX/2026 — urutan September, bukan urutan Agustus berlabel September seperti sebelumnya.')],
        'N24': [
            ('N01-1', 'Daftar invoice dengan tab status, filter periode, dan kartu statistik pendapatan/laba kotor/outstanding.'),
        ],
    },
    'loans': {
        'A13': [('A13-1', 'Modul Pinjaman; prefill nomor kini diturunkan dari nomor terbesar yang sudah dipakai, bukan dari id terakhir, sehingga tidak lagi menawarkan nomor yang sudah ada.')],
        'N10': [
            ('N01-1', 'Daftar pinjaman dengan ringkasan pokok, bunga, dan sisa.'),
        ],
    },
    'notifications': {
        'N07': [
            ('N07-1', 'Drawer notifikasi berisi 4 item belum dibaca dengan penanda biru; mengklik satu item menandainya terbaca.'),
        ],
        'N09': [
            ('N07-1', 'Tombol "Tandai semua" tersedia di kepala drawer.'),
        ],
        'C01': [
            ('N07-1', 'Rantai feedback → notifikasi terlihat utuh: keempat notifikasi berasal dari feedback yang dikirim aktor lain, dan badge lonceng menunjukkan angka 4.'),
        ],
        'N13': [
            ('N01-1', 'Drawer notifikasi terbuka dari lonceng header dengan empty state dan tautan ke daftar lengkap.'),
        ],
    },
    'profit-loss': {
        'N07': [
            ('A09-1', 'Panel klasifikasi menyediakan dropdown "Pilih grup L/R" langsung di samping laporan — inilah jalur klasifikasi inline.'),
        ],
        'C01': [
            ('A09-1', 'Setelah kategori diklasifikasi, nilainya berpindah dari panel ini ke baris laporan, termasuk untuk periode lama.'),
        ],
        'C02': [
            ('A09-1', 'Laporan periode berjalan menampilkan Rp 5.200.000 pendapatan dan Rp 1.100.000 HPP dari transaksi yang baru dicatat.'),
        ],
        'C03': [
            ('A09-1', 'Panel klasifikasi hanya muncul bagi pemegang izin klasifikasi; pemegang izin lihat saja tetap melihat laporannya.'),
        ],
        'A09': [('A09-1', 'Panel "Perlu Diklasifikasi" menangkap Rp 1.550.000 yang belum masuk laporan — sebelumnya nilai dengan arah/tipe tak cocok hilang total tanpa jejak.')],
        'A10': [('A09-1', 'Jaring pengaman yang sama menampilkan kategorinya beserta nominalnya, bukan mendiamkannya.')],
        'N12': [
            ('N01-1', 'Laporan Laba Rugi tersusun bertingkat dari Pendapatan Usaha sampai Laba Bersih, dengan panel klasifikasi kategori.'),
        ],
    },
    'receivables': {
        'A01': [
            ('A10-1', 'Modul Piutang; persetujuan tanpa memilih rekening sumber ditolak di server.'),
        ],
        'A10': [('A10-1', 'Modul Piutang; pembayaran bermetode transfer kini wajib menyertakan rekening, sehingga tidak ada lagi pembayaran yang mengurangi piutang tanpa mutasi bank.')],
        'A11': [('A10-1', 'Debitur divalidasi keberadaannya sesuai jenis piutang, bukan sekadar diterima sebagai angka.')],
        'A12': [('A10-1', 'Jenis piutang dan jenis debitur kini harus cocok; ketidakcocokan ditolak dengan pesan yang menyebut karyawan/klien.')],
        'N14': [
            ('N01-1', 'Daftar piutang dengan debitur polimorfik (User atau Klien).'),
        ],
    },
    'recurring-invoices': {
        'A18': [('A18-1', 'Modul Invoice Berulang; bulan yang bukan periode penagihan sah kini ditolak di server, bukan hanya disembunyikan dari daftar bulan di layar.')],
        'A19': [('A18-1', 'Bulan di luar masa berlaku template ditolak oleh pemeriksaan yang sama.')],
        'C03': [('A18-1', 'Template triwulanan tidak lagi bisa ditagih tiap bulan lewat panggilan langsung.')],
        'C04': [('A18-1', 'Rentang start_date..end_date kini ditegakkan di server.')],
        'N19': [
            ('N01-1', 'Tiga tab modul recurring — Templates, Bulanan, Analitik — pada perusahaan yang belum punya template.'),
        ],
    },
    'reimbursements': {
        'A03': [
            ('A15-1', 'Modul Reimbursement; persetujuan tanpa kategori ditolak lewat aturan required_if.'),
        ],
        'A09': [('A15-1', 'Modul Reimbursement; pengajuan ulang setelah ditolak kini benar-benar berpindah ke Pending, dan bila gagal yang tampil pesan galat — bukan flash sukses yang bohong.')],
        'A15': [('A15-1', 'Tab "Semua Pengajuan" hanya tersedia bagi pemegang approve reimbursements; parameter ?tab=all kini dipaksa kembali ke "my" di server bagi yang lain.')],
        'C02': [('A15-1', 'Siklus tolak → revisi → ajukan ulang berakhir pada status Pending, bukan diam di Ditolak.')],
        'N12': [
            ('N01-1', 'Daftar reimbursement dengan tab Semua/Saya dan kartu status.'),
        ],
    },
    'services': {
        'A11': [('A11-1', 'Pemilih layanan pada Buat Invoice kini menampilkan tipe dan harga di bawah nama, sehingga dua layanan bernama sama tetap terbedakan.')],
        'N10': [
            ('N01-1', 'Katalog layanan dengan statistik harga rata-rata dan tertinggi.'),
            ('N02-1', 'Form tambah layanan terisi: nama, kategori Perizinan, harga Rp 7.500.000 lewat CurrencyInput.'),
            ('N02-2', 'Layanan tersimpan — total naik 5→6 dan rata-rata harga ikut terhitung ulang menjadi Rp 18.550.000.'),
        ],
    },
    'settings': {
        'N02': [('A19-1', 'Form profil pribadi: nama dan email dapat disunting dari layar ini.')],
        'N04': [('N04-1', 'Halaman ganti kata sandi dengan tiga kolom terpisah — sandi lama wajib benar sebelum perubahan diterima.')],
        'N05': [('N04-1', 'Layar yang sama menegakkan pergantian sandi; verifikasi bahwa sandi lama tidak lagi berlaku dilakukan lewat login ulang.')],
        'N06': [('A19-1', 'Blok Hapus Akun tersedia di bawah form profil, terpisah dan bertanda bahaya.')],
        'N07': [('N03-1', 'Profil Perusahaan tetap satu baris meski disimpan berulang kali.')],
        'N11': [('N11-1', 'Daftar Template PDF pada perusahaan yang belum punya template — titik awal siklus hidup template.')],
        'N12': [('N11-1', 'Penetapan default dikelola dari daftar ini; invarian "tepat satu default" kini juga bertahan saat template default dihapus.')],
        'N13': [('N11-1', 'Jalur kedua penetapan default (lewat PUT) tunduk pada invarian yang sama.')],
        'N14': [('N11-1', 'Duplikasi template dilakukan dari daftar ini.')],
        'N15': [('N11-1', 'Layout banded disimpan dari editor yang dibuka dari daftar ini.')],
        'N20': [('N11-1', 'Pustaka custom font diakses dari halaman Template PDF; unggahan kini juga diperiksa magic number SFNT.')],
        'N22': [('N11-1', 'Penghapusan font ikut membuang berkasnya dari disk.')],
        'N25': [('N11-1', 'Penghapusan template dilakukan dari daftar ini; bila yang dihapus adalah default, template tertua tersisa dipromosikan.')],
        'C01': [('N04-1', 'Siklus ganti kredensial berpangkal pada layar ini.')],
        'C02': [('N11-1', 'Siklus hidup template PDF berpangkal pada daftar ini.')],
        'C03': [('N11-1', 'Siklus pustaka font berpangkal pada halaman yang sama.')],
        'A19': [('A19-1', 'Membuka /c/qa-satu/settings kini mendarat di halaman Pengaturan yang terbuka penuh; sebelumnya redirect kehilangan prefix perusahaan dan berakhir 404.')],
        'A25': [
            ('A25-1', 'Sebelum perbaikan: staff mengklik "Profil Perusahaan" yang ditawarkan menu sendiri dan mendapat halaman 403.'),
            ('A25-2', 'Sesudah perbaikan: menu staff hanya berisi "Profil Saya" dan "Keluar".'),
        ],
        'N26': [
            ('N01-1', 'Pengaturan profil pribadi: empat sub-halaman di panel kiri.'),
        ],
        'N27': [
            ('N03-1', 'Profil Perusahaan terbuka kembali untuk admin setelah seeder izin dijalankan — lihat BUG-SET-06.'),
        ],
    },
    'transaction-categories': {
        'A16': [('A16-1', 'Daftar kategori dengan hierarki induk/anak; permintaan transaksi yang menunjuk kategori induk kini ditolak 422 di server, bukan hanya dinonaktifkan di layar.')],
        'A17': [('A16-1', 'Tipe kategori kini dicocokkan dengan arah transaksi di server; kombinasi yang tidak searah ditolak.')],
        'A18': [('C01-1', 'Dialog reassign yang sama kini menolak kategori induk sebagai pengganti — pengganti wajib sub-kategori.')],
        'A20': [('A16-1', 'Daftar pilihan kategori menyaring tipe pada anak, bukan hanya induk, sehingga anak bertipe lain tidak lagi bocor ke daftar yang salah.')],
        'A21': [('A16-1', 'Kolom Grup L/R hanya dapat diisi untuk kategori pemasukan/pengeluaran; kategori transfer ditolak.')],
        'C03': [('A16-1', 'Kedua invarian kategori — bukan induk, dan tipe searah — kini ditegakkan di server.')],
        'N15': [
            ('N01-1', 'Daftar kategori hierarkis dengan kolom "Digunakan" dan penanda belum diklasifikasi untuk laporan laba rugi.'),
        ],
        'C05': [
            ('C01-1', 'Kategori yang masih dipakai 1 transaksi: dialog menawarkan pemindahan, bukan menolak mentah-mentah.'),
            ('C01-2', 'Kategori pengganti dipilih; tombol "Pindahkan & Hapus" baru aktif setelah pilihan terisi.'),
            ('C01-3', 'Setelah operasi kategori hilang dari daftar; verifikasi DB menunjukkan tidak ada baris yatim.'),
        ],
    },
}

CASE_ROW = re.compile(r'^\|\s*((?:N|A|C)\d+)\s*\|')
SECTION = re.compile(r'^##\s+([ABC])\.\s+(.+?)\s*$')
BUG_HEAD = re.compile(r'^###\s+(?:TEMUAN\s+)?([A-Z][A-Z0-9-]*-?\d+|[A-Z]-\d+)\s*[—–-]\s*(.+?)\s*$')
FIELD = re.compile(r'^\s*[-|]\s*\*\*([A-Z ]+)\*\*\s*[:|]\s*(.*)$')
TABLE_FIELD = re.compile(r'^\|\s*\*\*([A-Z ]+)\*\*\s*\|\s*(.*?)\s*\|\s*$')


def bersihkan(teks: str) -> str:
    """Rapikan sel tabel markdown menjadi satu baris yang enak dibaca.

    Tanda kurung sudut mentah (mis. `<img src>`, `<script data-page="app">`)
    yang muncul apa adanya di teks temuan ditukar dengan kurung sudut tipografis.
    Tanpa ini generator PDF menafsirkannya sebagai markup dan gagal mem-parse —
    escape ke &lt; tidak bisa dipakai karena to_para() meng-escape & lebih dulu
    sehingga entitasnya justru tampil mentah.
    """
    teks = teks.replace('<br>', ' ').replace('<br/>', ' ').replace('|', '/')
    teks = teks.replace('<', '‹').replace('>', '›')

    # Bintang wildcard di teks kode (`items.*.unit`, `can_*`, `qa3-*`) tertukar
    # dengan penanda italic markdown dan menghasilkan tag tak berpasangan saat
    # dirender. Penanda tebal dibuang, sisa bintang jadi bintang tipografis —
    # keterbacaan tetap, kegagalan render hilang seluruhnya.
    teks = teks.replace('**', '')
    teks = teks.replace('*', '∗')

    teks = re.sub(r'\s+', ' ', teks).strip()
    return teks


def klasifikasi(status: str):
    """Status → (verdict, attempts). Ambigu TIDAK pernah dibulatkan jadi lolos."""
    bersih = status.replace('*', '').strip()
    rendah = bersih.lower()

    if rendah.startswith('belum diuji') or rendah.startswith('not run'):
        return bersih or 'Belum diuji', ''
    if rendah.startswith('blocked'):
        return bersih, ''
    if 'fail' in rendah and 'pass' in rendah:
        return bersih, 'f'
    if rendah.startswith('fail'):
        return bersih, 'f'
    if rendah.startswith('pass'):
        # "Pass (percobaan ke-2…)" = gagal dulu, lolos setelah diperbaiki.
        return bersih, 'fp' if 'percobaan ke-2' in rendah else 'p'
    return bersih or '(tanpa status)', ''


def baca_modul(path: Path) -> dict:
    modul = path.stem
    baris = io.open(path, encoding='utf-8', errors='replace').read().splitlines()

    cases: list[dict] = []
    bugs: list[dict] = []
    bug_aktif: dict | None = None
    field_aktif: str | None = None
    dalam_temuan = False
    catatan_pelaksanaan: list[str] = []
    dalam_catatan = False

    for line in baris:
        if line.startswith('## '):
            dalam_temuan = line.startswith('## Temuan')
            dalam_catatan = line.startswith('## Catatan pelaksanaan')
            if bug_aktif:
                bugs.append(bug_aktif)
                bug_aktif, field_aktif = None, None

        m = SECTION.match(line)
        if m:
            cases.append({'section': f'{m.group(1)}. {m.group(2).upper()}'})
            continue

        if dalam_catatan and line.strip().startswith('-'):
            catatan_pelaksanaan.append(bersihkan(line.strip().lstrip('- ')))

        if dalam_temuan:
            m = BUG_HEAD.match(line)
            if m:
                if bug_aktif:
                    bugs.append(bug_aktif)
                bug_aktif = {'id': m.group(1), 'title': bersihkan(m.group(2))}
                field_aktif = None
                continue

            if bug_aktif is not None:
                m = FIELD.match(line) or TABLE_FIELD.match(line)
                if m:
                    kunci = m.group(1).strip().lower().replace(' ', '_')
                    peta = {
                        'sifat': 'sifat', 'menggagalkan': 'cases', 'gejala': 'gejala',
                        'sebab': 'sebab', 'cakupan': 'cakupan',
                        'saran_perbaikan': 'perbaikan', 'perbaikan': 'perbaikan',
                    }
                    field_aktif = peta.get(kunci)
                    if field_aktif:
                        bug_aktif[field_aktif] = bersihkan(m.group(2))
                    continue
                if field_aktif and line.strip() and not line.startswith('#'):
                    bug_aktif[field_aktif] = (bug_aktif.get(field_aktif, '') + ' ' + bersihkan(line)).strip()

        if CASE_ROW.match(line):
            sel = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(sel) < 7:
                continue
            verdict, attempts = klasifikasi(sel[6])
            case = {
                'id': sel[0],
                'title': bersihkan(sel[1]),
                'verdict': verdict,
                'note': bersihkan(sel[5]) or '—',
            }
            if attempts:
                case['attempts'] = attempts
            langkah = BUKTI_LAYAR.get(modul, {}).get(sel[0])
            if langkah:
                case['steps'] = [{'img': img, 'cap': cap} for img, cap in langkah]
            cases.append(case)

    if bug_aktif:
        bugs.append(bug_aktif)

    # Sisipkan lapisan (FE/BE) ke catatan agar tidak hilang dari PDF.
    return {'cases': cases, 'bugs': bugs, 'catatan': catatan_pelaksanaan}


def ringkasan(modul: str, hasil: dict) -> list[str]:
    kasus = [c for c in hasil['cases'] if 'id' in c]
    lolos = [c for c in kasus if c.get('attempts', '').endswith('p')]
    gagal = [c for c in kasus if c.get('attempts') == 'f']
    belum = [c for c in kasus if not c.get('attempts')]

    teks = [
        f"{len(kasus)} test case dirancang untuk modul ini; {len(lolos)} lolos, "
        f"{len(gagal)} gagal, {len(belum)} tidak dijalankan dan sengaja tidak "
        f"dibulatkan menjadi lolos."
    ]
    if hasil['bugs']:
        judul = ', '.join(b['id'] for b in hasil['bugs'][:6])
        teks.append(
            f"{len(hasil['bugs'])} temuan tercatat ({judul}"
            + (', …' if len(hasil['bugs']) > 6 else '') + '). '
            'Rincian sebab dan cakupannya ada di blok temuan di bawah.'
        )
    else:
        teks.append('Tidak ada temuan bug pada modul ini.')
    return teks


def main() -> int:
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    dibuat = []

    for path in sorted(TEST_CASES.glob('*.md')):
        modul = path.stem
        hasil = baca_modul(path)

        sudah = SUDAH_DIPERBAIKI.get(modul, set())
        sebagian = SEBAGIAN.get(modul, set())
        for bug in hasil['bugs']:
            if bug['id'] in sudah:
                bug['status'] = 'SUDAH DIPERBAIKI'
            elif bug['id'] in sebagian:
                bug['status'] = 'SEBAGIAN DIPERBAIKI'
            else:
                bug['status'] = 'BELUM DIPERBAIKI'

        manifest = {
            'module': modul,
            'title': f"Modul {JUDUL.get(modul, modul)}",
            'date': TANGGAL,
            'environment': LINGKUNGAN,
            'scope': (
                f"Seluruh test case pada docs/qa/test-cases/{modul}.md. Eksekusi "
                "dilakukan lewat request HTTP dengan cookie sesi asli dan "
                "diverifikasi ke database — bukan diasumsikan dari kode. "
                "Perilaku visual antarmuka React tidak termasuk cakupan dan "
                "karena itu laporan ini tidak memuat bukti layar."
            ),
            'shots_dst': f"../evidence/{modul}",
            'report_out': f"../report/Laporan-QA-{modul}.pdf",
            'summary': ringkasan(modul, hasil),
            'bugs': hasil['bugs'],
            'cases': hasil['cases'],
            'tooling_problems': [
                'Berkas respons bawaan helper sempat dipakai bersama beberapa agent '
                'sehingga satu agent membaca respons agent lain; helper dipindah ke '
                'berkas per-sesi sebelum satu pun hasil dicatat.',
                'PHP di Windows tidak memetakan /tmp seperti Git Bash, sehingga '
                'beberapa skrip pembantu gagal membaca berkas dan diulang dengan '
                'path absolut.',
            ],
            'honesty': (
                'Sebagian besar kode yang diuji ditulis oleh asisten yang sama yang '
                'menjalankan pengujian, sehingga ada risiko pengujian mewarisi asumsi '
                'yang sama dengan asumsi saat menulis kodenya. Risiko itu terbukti '
                'nyata dalam sesi ini: perbaikan lampiran sempat dinyatakan selesai '
                'padahal verifikasinya menguji route-nya, bukan URL yang benar-benar '
                'dihasilkan aplikasi. Yang sebaiknya diperiksa manusia secara '
                'independen: unggah bukti bayar lewat antarmuka lalu pastikan '
                'gambarnya benar-benar tampil di layar, bukan sekadar tersimpan '
                'dengan path yang benar.'
            ),
        }

        if hasil['catatan']:
            manifest['notes'] = [
                {'id': 'Catatan', 'title': 'Catatan pelaksanaan', 'body': ' '.join(hasil['catatan'])}
            ]

        keluar = MANIFESTS / f'{modul}.json'
        keluar.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        kasus = [c for c in hasil['cases'] if 'id' in c]
        dibuat.append((modul, len(kasus), len(hasil['bugs'])))

    lebar = max(len(m) for m, _, _ in dibuat) + 2
    print(f"{'modul':<{lebar}}{'case':>6}{'bug':>6}")
    print('-' * (lebar + 12))
    for m, n, b in dibuat:
        print(f'{m:<{lebar}}{n:>6}{b:>6}')
    print('-' * (lebar + 12))
    print(f"{'TOTAL':<{lebar}}{sum(n for _, n, _ in dibuat):>6}{sum(b for _, _, b in dibuat):>6}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
