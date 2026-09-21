# WYSIWYG Invoice Template Builder — Rencana Agile

> **Tujuan akhir:** pengguna merancang template invoice PDF secara visual (drag-and-drop), lalu mencetak invoice nyata memakai template itu.
> **Status:** **Sprint 1 SELESAI** (`0b9a009`). **Sprint 2 SELESAI** — katalog token `app/Services/TemplateTokens.php`. **Sprint 3 SELESAI** — tabel item data-bound (`app/Services/ItemColumns.php`, elemen `table`, model PDF dua-zona: absolute layer + flow table yg paginate). **⚠ ISU TERBUKA:** model dua-zona meng-clip elemen bebas yg ditaruh DI BAWAH Y tabel (total/dll hilang di PDF → langgar WYSIWYG). **Solusi terkunci = model 3-zona:** elemen `y < tableY` = Header (absolute page 1); Tabel = flow paginate; elemen `y >= tableY` = zona Bawah yang mengalir SETELAH item terakhir (X dipertahankan, jarak Y antar-elemen dijaga via container relative). Editor tampilkan garis batas zona ("Mengalir setelah tabel"). **Zona-bawah SELESAI**. **Sprint 4 SELESAI (4a grid statis + 4b merge cell)** — elemen `grid` statis (Word) 3×3 sel teks/token, posisi bebas (ikut 3-zona), styling per-sel, `tests/Feature/PdfTemplateGridTest.php`. 4b menambah **merge cell** (grid statis: anchor+Shift-click→Gabungkan/Pisahkan, colspan/rowspan; tabel item: grup header) — `PdfTemplateMergeTest.php`. DomPDF colspan/rowspan OK. **Sprint 5a SELESAI** (properti teks kotak Word-like + gambar, font kurасi, `PdfTemplateRichPropsTest`). **Sprint 5b SELESAI** (upload font kustom `.ttf` → `custom_fonts` + DomPDF @font-face + browser @font-face, `CustomFontController`, `PdfTemplateCustomFontTest`). **Sprint 5c SELESAI** (elemen `rect` Kotak + `line` Garis/Divider, `PdfTemplateShapeTest`). **SPRINT 5 LENGKAP.** **SPRINT 6 SELESAI** — integrasi cetak: `PrintInvoiceDialog` Combobox grup Bawaan/Kustom, render via route lama `template=builder:{id}` → `BuilderInvoicePrinter`, token `payment.*` (mirror InvoicePrintService) dukung Full/DP/Pelunasan, `PdfTemplatePrintIntegrationTest`. Berikutnya **S7** poles (slice terakhir).> **Eksekutor:** Sonnet, **satu sprint per sesi**, commit di akhir tiap sprint.
> **Sifat:** kebutuhan internal, konteks UMKM Indonesia.

---

## ARSITEKTUR v2 — BANDED (disepakati 2026-06-24, MENGGANTIKAN model absolut untuk invoice)

Dokumen = pita (band) **mengalir**, bukan kanvas absolut bebas. Elemen lama (teks/gambar/grid/shape/font/token/merge) **dipakai ulang** sebagai editor-mini di DALAM tiap band.

**Skema layout baru:**
```
{
  paper: { margins: { top, right, bottom, left } },        // px
  bands: {
    header:      { height, repeat:boolean, elements:[] },  // Fixed; repeat→tiap halaman, else→halaman 1
    content:     { table: <TableEl|null> },                // Detail dinamis: tabel item, paginate
    footerFlow:  { height, elements:[] },                  // mengalir setelah content (sekali, di akhir)
    footerFixed: { height, elements:[] }                   // position:fixed, dasar SETIAP halaman
  }
}
```
Elemen di dalam band = **absolut relatif ke band** (1:1, presisi). Antar-band = **mengalir** (header→tabel→footerFlow); footerFixed dipaku ke dasar.

**Margin per-sisi:** area cetak = kertas − margin; di PDF `@page { margin: T R B L }`; footerFixed nempel tepat di atas margin bawah.

**Perilaku konten (A/B/C):** item sedikit → 1 halaman; mendekati batas → footerFlow pindah **utuh** (`page-break-inside: avoid`); melebihi halaman → tabel **paginate** (`<thead>` berulang), footerFlow **setelah baris terakhir**, footerFixed di **tiap** halaman. Elemen setelah tabel = footerFlow → posisinya selalu "setelah baris terakhir", bukan Y tetap.

**Footer 2 mode (bisa bersamaan):** Flow (setelah konten, sekali) + Fixed (dasar tiap halaman).

**Editor:** 3–4 area berlabel + badge mode (Fixed / Dinamis ⇕ / Flow / Fixed-bawah), tinggi band Header/Footer bisa di-drag, garis **margin** & **batas halaman**, **Preview-dengan-N-item**. WYSIWYG: gaya tiap band 1:1; paginasi data-dinamis dilihat via Preview-N.

**Slice:** B1 model+editor band · B2 margin per-sisi · B3 render PDF banded-flow · B4 footerFixed + header-repeat · B5 preview-N + poles. Backward-compat: layout lama (array datar) ditangani aman (jangan crash; bungkus ke band header).

> Catatan: arsitektur ini **menggantikan** model 3-zona absolut (Sprint 3–6) untuk dokumen invoice. Elemen tetap di-drag bebas, tapi **di dalam band**-nya.

## Pola Kerja (WAJIB diikuti eksekutor)

- **Irisan vertikal kecil.** Satu kapabilitas per langkah, di atas yang sudah jalan. Jangan bangun banyak hal sekaligus.
- **Ponytail (cara, bukan cakupan).** Pakai yang sudah terpasang: **DomPDF** (bukan Puppeteer), native > library, dependency baru hanya bila beberapa baris tak cukup. Reuse **katalog komponen React** (`CLAUDE.md` → "React Component Catalog") + token **Archipelago**. UI berbahasa Indonesia. Catatan: *cakupan* fitur sengaja kaya (setara Word/Excel) atas permintaan user — ponytail berlaku pada CARA implementasi (minimal, reuse, inkremental), bukan memangkas fitur.
- **UI/UX dengan `/design-taste-frontend`.** Setiap sprint yang menyentuh UI editor/panel dikerjakan dengan standar skill ini: audit-first untuk redesign, anti-slop, hasil rapi & intuitif. Target rasa: sekuat alat familiar pengguna (Word/Excel) tapi lebih bersih.
- **Verifikasi nyata sebelum klaim selesai:** `npm run build` tiap ubah frontend; `php artisan test --compact --filter=...` tiap ubah backend; lihat **editor DAN PDF asli**.
- **Commit per sprint** — pesan terstruktur: ringkas tujuan, lalu bagian *Apa / Kenapa / Batasan (ponytail) / Tests*.
- **JANGAN bertanya saat eksekusi.** Untuk keputusan yang bisa dibatalkan, ambil default paling masuk akal (ponytail), **catat di laporan akhir, lalu lanjut** — jangan berhenti menunggu jawaban (lingkungan ini tak bisa melanjutkan agen yang dijeda → harus diluncurkan ulang, boros). Berhenti HANYA untuk keputusan irreversible/berisiko tinggi, dan itu pun berupa laporan ke orchestrator. Semua "Titik Keputusan" sprint diselesaikan orchestrator dengan user SEBELUM agen diluncurkan, lalu ditanam ke prompt.
- **Konvensi teknis tetap:** koordinat px @96dpi (A4 = 793,7×1122,5 → kertas PDF 793×1122 + `overflow:hidden`), gambar disimpan **base64**, mata uang **integer**, token dinamis `{{path}}`.
- **WYSIWYG adalah kontrak:** tampilan editor HARUS identik hasil PDF. Setiap perbedaan editor↔PDF = bug (mis. kasus `img{max-width:100%}` preflight yang sudah diperbaiki).

---

## Batasan Masalah

**In-scope (v1):**
- Elemen: **teks**, **gambar**, **tabel** (rincian item invoice, baris dinamis).
- **Data binding** ke Invoice / Client / CompanyProfile nyata.
- **Multi-template**: buat, beri nama, edit, hapus, pilih.
- **Integrasi cetak**: invoice bisa dicetak memakai template pilihan.

**Out-of-scope (v1) — sengaja:**
- Engine pixel-perfect (tetap DomPDF; keterbatasan posisi/clip diterima).
- Editor kolaboratif / real-time multi-user.
- Marketplace template, dokumen non-invoice.
- Pagination kompleks bebas; tabel panjang ditangani sederhana dulu (lihat Sprint 3 & risiko).
- Tidak mengganti template Blade lama (`kisantra-invoice`, dst.) — builder = opsi tambahan, hidup berdampingan.

---

## Kondisi Saat Ini (SUDAH selesai — jangan dibangun ulang)

Sandbox di `GET /template-builder-test` (`resources/js/pages/template-builder-test.tsx` + `TemplateBuilderController` + `pdf_templates` + `pdf/template-builder.blade.php`):

- Kanvas A4 (3-kolom: Layers · kanvas · Inspector), toolbar mengambang, dark canvas.
- Elemen **teks** (edit inline, ukuran, bold, warna, token) & **gambar** (resize handle 2D, lock/unlock rasio, reset ke ukuran asli).
- Interaksi: drag bebas (boleh keluar kanvas → clip), drag-drop dari toolbar/OS, paste gambar/teks clipboard, copy ke clipboard OS, Ctrl+D duplikat, undo/redo, Delete, zoom Ctrl+scroll ke kursor, reorder z-order di Layers.
- **Data binding:** field picker sisip token, toggle Edit/Preview (resolve dgn data contoh).
- **Persistence:** Simpan layout (JSON) → 1 row "Sandbox"; muat saat load.
- **PDF:** DomPDF, resolve token server-side (data contoh), clip di tepi A4. Test: `tests/Feature/TemplateBuilderControllerTest.php` (7 lulus).

---

## Target Properti Elemen (kelengkapan ala Word/Excel)

> **Permintaan user:** properti tiap elemen selengkap mungkin meniru Word/Excel (dulu user bikin template invoice di sana). Implementasi **inkremental** — properti inti dulu, ekor panjang menyusul — tapi katalog target = di bawah, jadi panel properti dirancang sejak awal agar bisa tumbuh.

- **Umum (semua elemen):** X/Y, lebar/tinggi, z-order, kunci, opacity, rotasi, border (per sisi: gaya/warna/tebal), background/fill, padding.
- **Teks (ala Word):** font-family, ukuran, bold/italic/underline/strikethrough, warna teks, highlight/background, rata horizontal (kiri/tengah/kanan/justify) + vertikal, line-height, letter-spacing, padding, format token (Rupiah/tanggal/angka).
- **Gambar:** lebar/tinggi + lock rasio + reset asli, opacity, border, radius sudut, rotasi, crop/object-fit.
- **Tabel (ala Excel — paling mendalam):** lihat Sprint 3 & 4.
- **(Opsional, menyusul) Shape/Garis/Divider:** garis & kotak sebagai pembatas/aksen.

## Backlog → Sprint (urut prioritas; tiap sprint shippable & di-commit)

### Sprint 1 — Promosi ke modul nyata + multi-template CRUD
**Goal:** keluar dari "sandbox 1 row" jadi modul yang mengelola banyak template bernama.
- Rute & menu **di bawah `/settings`** (mis. `/settings/pdf-templates`), dekat Company Profile. Permission baru `manage pdf templates`. Entri di navigasi settings.
- `pdf_templates`: tambah `description` (nullable) **dan `is_default` (boolean)** — satu template bisa ditandai default (dipakai saat tak ada pilihan eksplisit; jaga hanya satu yang true). Migrasi baru (jangan ubah data lama).
- Halaman daftar template (pakai `DataTable`/`PageHeader`/`EmptyState`): buat, ganti nama, hapus, duplikat.
- Editor menyunting template **berdasarkan id** (route `/pdf-templates/{template}/edit`), Simpan menyimpan ke id itu.
- **Acceptance:** bisa punya ≥2 template berbeda, edit & hapus masing-masing; sandbox lama boleh tetap ada atau diarahkan ke modul baru.
- **Tests:** CRUD (store/update/destroy), permission gate, isolasi antar-template.

### Sprint 2 — Data binding invoice nyata
**Goal:** token me-resolve dari Invoice/Client/CompanyProfile asli, bukan contoh.
- Katalog token dari field nyata: `invoice.number/issue_date/due_date/total_amount/amount_paid/...`, `client.name/npwp/...`, `company.name/npwp/address/...`. Definisikan satu sumber kebenaran token (PHP + TS sinkron) + format (Rupiah, tanggal).
- `@pdf` menerima `Invoice` (mis. `/pdf-templates/{template}/preview/{invoice?}`) dan resolve dari model. Helper format Rupiah pakai pola integer→`Rp x.xxx`.
- Preview editor: pilih satu invoice contoh (atau invoice terbaru) untuk Preview.
- **Acceptance:** cetak template dengan data invoice nyata; nilai & format benar.
- **Tests:** resolusi token dari Invoice nyata (factory), format Rupiah/tanggal, token tak dikenal dibiarkan.

### Sprint 3 — Tabel: fondasi data-bound + multi-halaman
**Goal:** elemen `table` terikat `invoice.items`, baris dinamis, pecah multi-halaman.
- Tipe `table`: **pilih field** dari DB (deskripsi, qty, unit, harga satuan, cogs, jumlah, flag pajak, dst.) + kolom statis/komputasi (no. urut, qty×harga).
- Per kolom: label header, lebar, rata, format (Rp/angka/tanggal), mapping field.
- Header kolom (thead) **berulang tiap halaman** (DomPDF otomatis). Baris footer sum per kolom **opsional** (default mati).
- **Grand total (Total/DP/Sisa) BUKAN bagian tabel** — ditaruh sebagai elemen teks bebas memakai token (keputusan user).
- **Multi-halaman:** tabel item = **zona mengalir** (bukan absolute) agar DomPDF memaginasi baris. Model kertas di PDF: elemen absolute (header/gambar/total/teks) render di halaman 1; tabel item = `<table>` normal-flow dgn `padding-top = Y tabel` sehingga mulai di bawah header lalu mengalir & pecah ke halaman 2+. Editor: tabel punya X/Y/lebar (Y = awal band mengalir), tinggi dinamis dari baris contoh.
- Editor: baris contoh; PDF: item nyata.
- **Acceptance:** mencetak item terpilih; angka rata kanan; invoice banyak item pecah rapi ke halaman 2+ dgn header kolom berulang.
- **Tests:** render PDF sedikit & banyak item (lintas-halaman); kolom benar.
- **Keputusan terkunci (2026-06-23):** lingkup S3 = **tabel data-bound item SAJA** (grid statis bebas → Sprint 4); kolom default **Standar** (No · Deskripsi · Qty · Harga Satuan · Jumlah); **total via elemen teks bebas** — risiko tabrakan saat invoice multi-halaman **diterima** (user bertanggung jawab atas penempatan).

### Sprint 4 — Tabel grid statis (ala Word) + struktur & gaya ala Excel (merge cell)
**Goal:** tabel sefleksibel & sefamiliar Excel (permintaan user).
- **Tabel grid statis bebas (ala Word, keputusan user):** elemen tabel KEDUA — grid baris×kolom tetap, diposisikan **bebas (absolute)** untuk layout sembarang; bila melebihi halaman → clip (bukan paginate, beda dari tabel item S3).
- **Editor grid interaktif** ala Excel: pilih sel/range, atur per sel/baris/kolom.
- Styling: border per sisi (gaya/warna/tebal), fill, font, padding, rata (h+v), zebra rows, garis grid.
- **Merge cell** — penuh pada area **struktur** (header/footer & sel statis). Body data dinamis = "baris template" yang berulang per item, jadi merge antar-baris-data terbatas (perjelas di awal sprint — lihat Titik Keputusan).
- Panel/grid dirapikan dgn **`/design-taste-frontend`**.
- **Acceptance:** template tabel kompleks (header ber-merge, border kustom, fill) tercetak benar lintas halaman.
- **Tests:** render PDF tabel ber-merge + border kustom.
- **Risiko:** **batas DomPDF** untuk border/merge kompleks bisa **memajukan keputusan naik engine** — bila fidelity gagal, eskalasi ke user sebelum memaksakan.

### Sprint 5 — Properti elemen kaya (Word/Excel-like) — DIPECAH 5a/5b/5c
**Keputusan terkunci (2026-06-24):** font = daftar aman DomPDF **+ upload font kustom**; **rotasi DILEWATI** (DomPDF tak render andal → langgar WYSIWYG); **shape Garis/Divider + Kotak DITAMBAHKAN**. Panel properti dirapikan dgn **`/design-taste-frontend`**.

**5a — Properti teks & gambar (font kurасi):**
- Teks (ala Word): **font-family** (daftar aman: Helvetica/Arial, Times New Roman, Courier, DejaVu Sans), bold/italic/underline/strikethrough, warna, highlight, rata **h + v**, line-height, letter-spacing, padding, border/fill. **TANPA rotasi.**
- Gambar: opacity, border, radius sudut, object-fit/crop. **TANPA rotasi.**
- Pastikan tiap properti tercermin sama di editor & PDF (DomPDF-safe). Acceptance: layout kaya (label rata, nominal rata kanan, judul highlight); editor=PDF.

**5b — Upload font kustom:**
- Upload `.ttf` → simpan + **registrasi ke DomPDF** (agar render di PDF) + **`@font-face` di browser** (agar render di editor) → muncul di font picker. Editor=PDF wajib.

**5c — Elemen shape:**
- **Garis/Divider** + **Kotak** (border/fill, posisi/ukuran). Murah di DomPDF. Ikut model 3-zona seperti elemen lain.

- **Tests (tiap slice):** snapshot nilai + cek render properti/shape/font kunci di PDF; editor=PDF; no regresi.

### Sprint 6 — Integrasi alur cetak invoice
**Goal:** end-user mencetak invoice memakai template builder.
**Keputusan terkunci (2026-06-24):** template builder **digabung ke Combobox template** di `PrintInvoiceDialog` yang ada (grup **Bawaan** Kisantra/Semesta/AGSA/Generic + **Kustom** dari `pdf_templates`). **Dukung mode DP/Pelunasan** juga (bukan full saja) — tambah token sadar-konteks `payment.*` yang me-mirror semantik `InvoicePrintService` (mode + dp_amount/pelunasan_amount).
- **Dipilih saat cetak** — TANPA kolom baru di `invoices`. Default ter-preselect bila ada `is_default`.
- Render: `Invoice` + `PdfTemplate` + mode/amounts → PDF; koeksistensi dgn `InvoicePrintService` lama (opsi tambahan, bukan pengganti). Dialog teruskan template id + tipe cetak + jumlah ke route render builder.
- **Acceptance:** user memilih template, PDF invoice tercetak dgn data benar.
- **Tests:** endpoint cetak invoice-by-template (200, application/pdf, data benar).

### Sprint 7 — Poles & pengerasan
**Goal:** rasa pro + tahan kasus tepi.
- Snap/garis bantu, nudge panah keyboard, fit-to-screen, margin/safe-area, multi-select.
- Validasi, empty state, kunci elemen.
- Tinjau ulang keterbatasan DomPDF & keputusan engine final.

---

## Definition of Done (tiap sprint)

1. `npm run build` hijau; backend test terkait **lulus** (`--compact`).
2. Diverifikasi di **editor DAN PDF asli** (bukan hanya test).
3. UI Indonesia, pakai katalog komponen + Archipelago.
4. Tak ada regresi pada sandbox/fitur sebelumnya.
5. Commit dengan pesan terstruktur. Keputusan penting → tambah catatan di dokumen ini.

---

## Keputusan (sudah dikunci 2026-06-23)

- ✅ **Lokasi modul:** di bawah **`/settings`** (mis. `/settings/pdf-templates`). (Sprint 1)
- ✅ **Default template:** **ada** — kolom `is_default`, jaga hanya satu yang true. (Sprint 1)
- ✅ **Relasi template↔invoice:** **dipilih saat cetak**, TANPA kolom di tabel `invoices`. (Sprint 6)
- ✅ **Tabel panjang:** **multi-halaman otomatis** → tabel di zona mengalir, bukan absolute. (Sprint 3)
- ✅ **Kelengkapan properti:** target setara **Word/Excel** (lihat "Target Properti Elemen"); tabel **ala Excel** termasuk merge cell. Implementasi inkremental.
- ✅ **UI/UX:** dikerjakan dengan **`/design-taste-frontend`** pada tiap sprint UI.

## Titik Keputusan tersisa (putuskan saat sprint relevan)

- **Cakupan field token** yang diekspos (Sprint 2).
- **Kolom tabel default** + apakah perlu **tabel grid statis bebas** (ala Word) selain tabel data-bound item (Sprint 3/4).
- **Merge cell di baris data dinamis** — sejauh mana didukung vs hanya area struktur (Sprint 4).
- **Properti teks/gambar** mana yang prioritas vs ekor panjang (Sprint 5).
- **Engine PDF:** tetap DomPDF; naik ke Puppeteer/Gotenberg hanya bila fidelity jadi blocker — **paling mungkin muncul di Sprint 4** (border/merge kompleks), final di Sprint 7. Jangan ganti tanpa persetujuan user.

---

## REWORK v3 — TABEL TERPADU ROW-BAND (TRB)

> **Tujuan:** menggantikan model tabel kolom-rigid dengan model baris-band spreadsheet-like yang mendukung merge, styling per-sel, baris statis di atas/bawah detail, DAN baris detail yang repeat per item — sambil tetap menggunakan DomPDF native pagination.

### Model Data Baru

```typescript
type TableCell = {
  content: string;          // teks atau token {{item.key}}
  colSpan?: number;         // colspan HTML
  rowSpan?: number;         // rowspan HTML (TIDAK boleh melintas ke/dari band detail)
  align: 'left'|'center'|'right';
  bold?: boolean;
  color?: string;           // hex warna teks
  fill?: string;            // hex background sel
  fontSize?: number;        // px
  merged?: boolean;         // true = sel ini disembunyikan (tertelan colspan/rowspan lain)
};
type TableRow = {
  kind: 'head'|'body'|'foot';
  repeat?: 'items';         // HANYA pada 'body' — baris template yang diulang per item
  cells: TableCell[];
};
type TableEl = {
  id: number; type: 'table';
  x: number; y: number; width: number;
  colWidths: number[];      // lebar tiap kolom dalam px
  rows: TableRow[];         // semua baris dalam urutan
  border: { width: number; color: string };
  // Field LEGACY (hanya untuk deteksi migrasi):
  columns?: unknown;
  showFooterSum?: boolean;
  headerGroups?: unknown;
};
```

### Alur Render PDF (DomPDF)

- `<thead>`: semua baris `kind:'head'` → DomPDF mengulang thead di tiap halaman otomatis (`display:table-header-group`)
- `<tbody>`: baris `kind:'body'` secara berurutan:
  - Jika `repeat:'items'` → diklon sekali per InvoiceItem, token `{{item.*}}` di-resolve via `TemplateTokens::itemMap($item, $idx)` per item
  - Jika tidak ada `repeat` → dirender sekali (baris statis)
- `<tfoot>`: semua baris `kind:'foot'` → dirender sekali setelah semua item

### Token Scope untuk Baris Detail

- Baris `repeat:'items'` → token `{{item.no}}`, `{{item.description}}`, `{{item.quantity}}`, `{{item.unit}}`, `{{item.unit_price}}`, `{{item.amount}}`, `{{item.cogs_amount}}`, `{{item.is_tax_deposit}}` di-resolve dari `TemplateTokens::itemMap()`
- Baris statis (head/body non-repeat/foot) → token di-resolve dari scope invoice seperti biasa via `TemplateTokens::resolveText()`

### Migrasi Backward-Compat (Old Column-Based → Row-Band)

Deteksi: `Array.isArray(el.columns) && !Array.isArray(el.rows)`

Hasil migrasi:
1. Head row dari `headerGroups` (jika ada) — colSpan sesuai `span`
2. Head row dari `columns[].label`
3. ONE detail row `kind:'body', repeat:'items'` — satu sel per kolom, `content = {{item.<key>}}`
4. Foot row jika `showFooterSum:true`
- `colWidths` dari `columns[].width`
- `border` default `{width:1, color:'#e2e8f0'}`

**Deteksi di blade:** `isset($tableEl['rows'][0]['kind'])` — memastikan `rows[0]` punya key `kind` (bukan flat pre-resolved row lama).

### Batasan yang Disepakati

- **rowspan TIDAK boleh melintas ke/dari band detail** — rowspan harus sepenuhnya di dalam satu band (semua head, atau semua body-non-repeat, atau semua foot). Crossing ke repeat-items band tidak didukung dan tidak dienforce secara kode (tanggung jawab editor T2).

### Slice Plan T1..T5

| Slice | Status | Isi |
|-------|--------|-----|
| **T1** | ✅ SELESAI | Model + engine: type TS baru, migration, `$renderRowBandTable`, `itemMap()`, controller bifurcation, 8 tes baru |
| **T2** | Berikutnya | Editor baris/sel: UI edit kind/repeat/cells, tambah/hapus baris & kolom, merge antar-baris |
| **T3** | — | Margin safe-area clamp |
| **T3.5** | — | Smart guides inti (snap ke elemen lain) |
| **T4** | — | Band drag-resize (tinggi band bisa di-drag) |
| **T5** | — | Poles + integrasi akhir |

### File yang Diubah di T1

| File | Perubahan |
|------|-----------|
| `resources/js/pages/settings/pdf-templates/edit.tsx` | `TableCell`, `TableRow` types; `TableEl` redefined (colWidths+rows+border); `isLegacyTableEl()`, `migrateTableElToRowBand()`; `makeDefaultTable()` baru; `tableEditorHeight/Preview()` baru; `TablePreview` rewrite (`<table>`-based); `TableInspector` stub T2; migration wired at load; column ops → no-ops |
| `app/Services/TemplateTokens.php` | `itemMap(InvoiceItem, int): array<string,string>` static method |
| `resources/views/pdf/template-builder.blade.php` | `$renderRowBandTable` closure (head/body/foot, repeat:'items', per-cell styling); TRB detection di banded path menggunakan `isset(rows[0]['kind'])` |
| `app/Http/Controllers/Settings/PdfTemplateController.php` | `pdfBanded()` bifurcated — TRB path passes `$trbItems` (Collection); legacy path passes pre-resolved rows |
| `tests/Feature/PdfTemplateTrbTest.php` | 8 tes baru (60 item, colspan, static body, foot, per-cell style, token binding, migration, save) |
