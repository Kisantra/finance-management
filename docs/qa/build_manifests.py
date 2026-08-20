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
        'N14': [
            ('N02-1', 'Matriks izin per peran — sumber kebenaran permission yang menggate seluruh modul.'),
        ],
    },
    'bank-accounts': {
        'N17': [
            ('N01-1', 'Saldo Rp 14.850.000 dihitung ulang dari saldo awal + pemasukan − pengeluaran, bukan disimpan.'),
        ],
    },
    'cash-flow': {
        'N21': [
            ('N01-1', 'Halaman Pengeluaran kosong — periode default "Semua waktu", bukan bulan berjalan.'),
            ('N01-2', 'Pemilih kategori: induk hanya menjadi judul grup, hanya anak (↳ MAKAN MINUM) yang bisa dipilih.'),
            ('N01-3', 'Pengeluaran tersimpan Rp 350.000 dan langsung terhitung di kartu total serta jumlah transaksi.'),
        ],
    },
    'clients': {
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
        'N13': [
            ('N01-1', 'Dashboard QA Satu: kartu ringkasan, grafik arus kas 6 bulan, dan daftar rekening dengan saldo terhitung.'),
        ],
    },
    'feedbacks': {
        'N15': [
            ('N01-1', 'Tombol feedback melayang membuka formulir dengan pilihan tipe dan prioritas; halaman asal terisi otomatis.'),
        ],
    },
    'fund-requests': {
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
        'N24': [
            ('N01-1', 'Daftar invoice dengan tab status, filter periode, dan kartu statistik pendapatan/laba kotor/outstanding.'),
        ],
    },
    'loans': {
        'N10': [
            ('N01-1', 'Daftar pinjaman dengan ringkasan pokok, bunga, dan sisa.'),
        ],
    },
    'notifications': {
        'N13': [
            ('N01-1', 'Drawer notifikasi terbuka dari lonceng header dengan empty state dan tautan ke daftar lengkap.'),
        ],
    },
    'profit-loss': {
        'N12': [
            ('N01-1', 'Laporan Laba Rugi tersusun bertingkat dari Pendapatan Usaha sampai Laba Bersih, dengan panel klasifikasi kategori.'),
        ],
    },
    'receivables': {
        'N14': [
            ('N01-1', 'Daftar piutang dengan debitur polimorfik (User atau Klien).'),
        ],
    },
    'recurring-invoices': {
        'N19': [
            ('N01-1', 'Tiga tab modul recurring — Templates, Bulanan, Analitik — pada perusahaan yang belum punya template.'),
        ],
    },
    'reimbursements': {
        'N12': [
            ('N01-1', 'Daftar reimbursement dengan tab Semua/Saya dan kartu status.'),
        ],
    },
    'services': {
        'N10': [
            ('N01-1', 'Katalog layanan dengan statistik harga rata-rata dan tertinggi.'),
            ('N02-1', 'Form tambah layanan terisi: nama, kategori Perizinan, harga Rp 7.500.000 lewat CurrencyInput.'),
            ('N02-2', 'Layanan tersimpan — total naik 5→6 dan rata-rata harga ikut terhitung ulang menjadi Rp 18.550.000.'),
        ],
    },
    'settings': {
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
