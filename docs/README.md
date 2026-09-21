# Dokumentasi — Finance Management

| Folder | Isi | Kapan dibaca |
|--------|-----|--------------|
| [`module/`](module/README.md) | **Sumber kebenaran per modul** — fitur, alur step-by-step, keterkaitan antar modul, invarian & jebakan. Mulai dari `module/README.md` (indeks + peta alur data). | **Wajib** sebelum menyentuh modul apa pun. |
| [`design/`](design/) | Keputusan desain & rencana fitur yang masih berlaku: [`laba-rugi.md`](design/laba-rugi.md) (kebijakan Laporan Laba Rugi), [`template-builder.md`](design/template-builder.md) (rencana sprint PDF Template Builder). | Saat mengubah P&L atau template builder. |
| [`guides/`](guides/) | Panduan teknis lintas modul: [`AUTO_TRANSLATION.md`](guides/AUTO_TRANSLATION.md), [`TRANSLATION_QUICK_REFERENCE.md`](guides/TRANSLATION_QUICK_REFERENCE.md). | Saat menyentuh `lang/`, `translate_text()`, atau PDF/Excel berbahasa. |
| [`archive/`](archive/) | Dokumen historis yang sudah selesai dieksekusi: rencana migrasi Livewire → Inertia, spec pemecahan permission cash-flow. Tidak perlu dibaca untuk pekerjaan sehari-hari. | Hanya untuk konteks sejarah. |

**Aturan pemeliharaan:** perubahan perilaku modul (alur, status, endpoint, aturan bisnis) wajib memperbarui dokumen di `module/` pada commit yang sama. Dokumen yang sudah tidak menggambarkan kode aktif dipindahkan ke `archive/`, bukan dihapus.
