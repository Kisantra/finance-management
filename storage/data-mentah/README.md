# Folder data mentah perusahaan

Taruh di sini berkas Excel **Template Kelengkapan Data SPT Tahunan** (format konsultan Kisantra)
milik perusahaan Mitra Group, lalu jalankan:

```bash
php artisan db:seed --class=DataPerusahaanSeeder --force
```

Panduan lengkap (apa yang diimpor, aturannya, dan langkah sesudah impor):
[`docs/guides/IMPOR-DATA-MENTAH.md`](../../docs/guides/IMPOR-DATA-MENTAH.md).

## Aturan folder

- **Satu berkas template per perusahaan.** Nama berkas bebas; perusahaannya dikenali dari sheet
  **01 Identitas › Nama Perusahaan**, jadi nama di sel itu harus nama perusahaan Mitra Group.
- **Boleh bersubfolder** (mis. hasil ekstrak zip `1. DATA MENTAH/`). Seeder membaca semua `.xlsx`
  di folder ini beserta subfoldernya.
- **Berkas lain boleh ikut** (rekap BUPOT, laporan keuangan draft, dsb.). Berkas tanpa sheet
  01 Identitas dilewati.
- **Berkas kembar** (isinya sama persis) cukup dibaca sekali. Dua berkas **berbeda** untuk satu
  perusahaan membuat perusahaan itu dilewati: sisakan satu.
- Setiap kali dijalankan, seeder menulis `laporan-impor.md` di folder ini: pencocokan total sheet
  dengan aplikasi dan semua koreksi yang dilakukan.

```
storage/data-mentah/
├── README.md                     ← berkas ini (satu-satunya yang ikut repo)
├── laporan-impor.md              ← dibuat seeder
├── 01 Template Kelengkapan Data PT Abdi Ocean Energy Th 2025.xlsx
├── AOE/                          ← subfolder boleh
│   └── BIAYA OPERASI.xlsx        ← bukan template, dilewati
└── ...
```

## Penting: jangan di-commit

Repo ini **publik**. Seluruh isi folder ini kecuali README ini di-gitignore
(`/storage/data-mentah/*`). Jangan memindahkan berkas data ke folder lain di repo, jangan
melampirkannya di issue/PR, dan hapus dari server bila sudah tidak diperlukan.
