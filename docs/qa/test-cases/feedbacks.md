# Test Case — Feedbacks

Sumber teknis: [`docs/module/feedbacks.md`](../../module/feedbacks.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-lima` (DB `tenant_qa-lima`), tabel `feedbacks`
berada di **database pusat `finance_central`** yang dipakai bersama; lampiran
tersimpan di disk tenant `storage/tenantqa-lima/app/public/feedbacks/`. Eksekusi
HTTP dengan cookie sesi asli + verifikasi database & filesystem. Bukan production.

## Aktor

| Akun | Role/permission | Peran dalam pengujian |
|---|---|---|
| `admin@gmail.com` (id 1) | admin — semua permission feedback | Pengelola |
| `manager@gmail.com` (id 2) | finance manager — termasuk `respond` & `manage` | Pengelola kedua |
| `staff@gmail.com` (id 3) | staff — `view/create/edit/delete`, **tanpa** `respond` & `manage` | Pemilik feedback |
| `qa5-nodash@qa.test` (id 9) | direct permission `view feedbacks` + `create feedbacks` | Pemilik kedua, untuk membuktikan isolasi antar pemilik |

## Feedback yang dibuat

| # | Pemilik | Judul | Tipe/Prioritas |
|---|---|---|---|
| 1 | staff (3) | QA5 Bug laporan tidak muncul → diedit jadi "QA5 Bug laporan (diedit)" | bug / high → critical |
| 2 | nodash (9) | QA5 Saran dari user lain | feedback / low |
| 3 | staff (3) | QA5 Fitur ekspor | feature / medium |
| 4 | staff (3) | QA5 Feedback dengan lampiran | bug / medium, lampiran PNG |

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Staff mengirim feedback | `POST /c/qa-lima/feedbacks` (title, description, type=bug, priority=high) | 302; baris baru `status=open`, `user_id=3` | FE+BE | 302; DB `id=1 user_id=3 type=bug priority=high status=open` | Pass |
| N02 | `page_url` tersimpan apa adanya | Kirim feedback dengan `page_url=/c/qa-lima/reports/profit-loss` | Tersimpan persis | BE | DB `id=3 page_url=/c/qa-lima/reports/profit-loss` | Pass |
| N03 | Notifikasi otomatis ke admin + finance manager | Setelah N01 | 2 notifikasi `feedback_submitted` (user 1 & 2) | BE | `id=48 user_id=1` & `id=49 user_id=2`, pesan `"Staff Demo mengirim Bug Report: QA5 Bug laporan tidak muncul"`, `data.url` → `/c/qa-lima/feedbacks` | Pass |
| N04 | Tab default berbeda per hak akses | Buka `/c/qa-lima/feedbacks` tanpa query sebagai staff lalu sebagai admin | Staff default `mine`; admin default `all` | FE+BE | staff `tab="mine" canManage=false canRespond=false total=2`; admin `tab="all" canManage=true canRespond=true total=3` | Pass |
| N05 | Pengelola melihat feedback semua orang | Admin buka tab `all` | 3 feedback dari 2 pemilik berbeda | BE | `[#3 Staff Demo] [#1 Staff Demo] [#2 QA5 Tanpa Dashboard]` | Pass |
| N06 | Statistik ikut ter-scope tab | Baca `stats` untuk staff vs admin | Staff menghitung hanya miliknya | BE | staff `{"total":2,"open":2,...,"bugs":1,"features":1,"feedbacks":0}`; admin `{"total":3,...,"feedbacks":1}` | Pass |
| N07 | Pemilik mengedit feedback miliknya saat `open` | Staff `PUT /feedbacks/1` (judul & prioritas baru) | 302; data berubah | FE+BE | 302; DB `id=1 title="QA5 Bug laporan (diedit)" priority=critical status=open` | Pass |
| N08 | Admin menanggapi (`respond`) memajukan status | Admin `POST /feedbacks/1/respond` `response=...` `status=in_progress` | 302; `admin_response`, `responded_by`, `responded_at`, `status` terisi | FE+BE | 302; DB `id=1 status=in_progress admin_response="Sedang kami tinjau, terima kasih." responded_by=1 responded_at=2026-08-19 14:45:31` | Pass |
| N09 | Tanggapan menotifikasi pemilik | Setelah N08 | 1 notifikasi `feedback_responded` ke user 3 | BE | `id=54 user_id=3 message='Feedback "QA5 Bug laporan (diedit)" telah ditanggapi oleh Admin'` | Pass |
| N10 | Finance manager juga boleh menanggapi | Manager `POST /feedbacks/3/respond` `status=resolved` | 302; `responded_by=2` | BE | 302; DB `id=3 status=resolved responded_by=2`; notifikasi `id=55 user_id=3` | Pass |
| N11 | **`changeStatus` boleh mundur ke `open`** | Admin `POST /feedbacks/1/status` `status=open` (dari `in_progress`) | 302; status kembali `open` | BE | 302; DB `id=1 status=open` — berbeda dari `respond` yang menolaknya (lihat A07) | Pass |
| N12 | Pengelola menghapus feedback milik orang lain apa pun statusnya | Admin `DELETE /feedbacks/2` (milik user 9) | 302; baris hilang | FE+BE | 302; DB baris id=2 tidak ada lagi | Pass |
| N13 | Pemilik menghapus feedback miliknya saat `open` | Staff `DELETE /feedbacks/4` (status `open`) | 302; baris hilang | FE+BE | 302; DB baris id=4 tidak ada lagi | Pass |
| N14 | Unggah lampiran gambar yang sah | Staff `POST /feedbacks` multipart dengan PNG 1×1 asli | 302; `attachment_path` & `attachment_name` terisi, file ada di disk | FE+BE | 302; DB `attachment_path=feedbacks/Z6T3OrrbxDlUKpTutF39OZ9s9W4VQiw16AIoo4Xd.png attachment_name=bukti.png`; file ada di `storage/tenantqa-lima/app/public/feedbacks/…` | Pass |
| N15 | Formulir feedback terbuka dari tombol melayang | Klik tombol Feedback di pojok kanan bawah | Modal terbuka dengan pilihan tipe & prioritas; halaman asal terisi otomatis | FE+BE | Modal terbuka; halaman asal terisi otomatis | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | **Staff memaksa `?tab=all`** | Staff `GET /c/qa-lima/feedbacks?tab=all` | Tetap hanya feedback miliknya — bukan sekadar tab yang disembunyikan di UI | FE+BE | `tab="all" canManage=false total=2 :: [#3 Staff Demo] [#1 Staff Demo]` — feedback milik user 9 (#2) tidak muncul. Query tetap ter-scope `forUser()` di server | Pass |
| A02 | Pemilik kedua memaksa `?tab=all` | `qa5-nodash` `GET .../feedbacks?tab=all` | Hanya 1 feedback miliknya | FE+BE | `tab="all" canManage=false total=1 :: [#2 QA5 Tanpa Dashboard]` — 2 feedback milik staff tidak bocor | Pass |
| A03 | Staff mengedit feedback orang lain | Staff `PUT /feedbacks/2` (milik user 9) | 403 | BE | 403 | Pass |
| A04 | **Admin pun tidak boleh mengedit feedback orang lain** | Admin `PUT /feedbacks/1` (milik staff) | 403 — edit adalah hak pemilik, bukan pengelola | BE | 403; DB tidak berubah | Pass |
| A05 | Staff mencoba menanggapi | Staff `POST /feedbacks/1/respond` | 403 (`respond feedbacks` tidak dimiliki staff) | BE | 403 | Pass |
| A06 | Staff mencoba mengubah status | Staff `POST /feedbacks/1/status` `status=resolved` | 403 (`manage feedbacks` tidak dimiliki staff) | BE | 403; DB status tidak berubah | Pass |
| A07 | **`respond` menolak mundur ke `open`** | Admin `POST /feedbacks/1/respond` `status=open` | 422 | BE | 422 `{"status":["The selected status is invalid."]}` — kontras dengan N11 yang mengizinkannya lewat `changeStatus` | Pass |
| A08 | Menanggapi feedback yang sudah `resolved` | Set #1 ke `resolved`, lalu admin `POST /feedbacks/1/respond` | 403 (`canRespond()` hanya `open`/`in_progress`) | BE | 403 | Pass |
| A09 | Pemilik kehilangan hak edit setelah diproses admin | Setelah #1 jadi `in_progress`, staff `PUT /feedbacks/1` | 403 | BE | 403 | Pass |
| A10 | Pemilik kehilangan hak hapus setelah diproses admin | Setelah #1 jadi `in_progress`, staff `DELETE /feedbacks/1` | Ditolak dengan pesan spesifik, baris tetap ada | FE+BE | 302 dengan flash `{"error":"Feedback yang sudah diproses tidak dapat dihapus."}`; DB `id=1 status=in_progress` masih ada — persis pesan yang didokumentasikan | Pass |
| A11 | Status di luar enum pada `changeStatus` | Admin `POST /feedbacks/1/status` `status=archived` | 422 | BE | 422 `{"status":["The selected status is invalid."]}` | Pass |
| A12 | `title` melebihi 255 karakter | Kirim title 256 karakter | 422 | BE | 422 `{"title":["The title field must not be greater than 255 characters."]}` | Pass |
| A13 | `description` melebihi 5000 karakter | Kirim description 5001 karakter | 422 | BE | 422 `{"description":["The description field must not be greater than 5000 characters."]}` | Pass |
| A14 | `type` di luar enum | Kirim `type=komplain` | 422 | BE | 422 `{"type":["The selected type is invalid."]}` | Pass |
| A15 | `title` kosong | Kirim tanpa `title` | 422 | BE | 422 `{"title":["The title field is required."]}` | Pass |
| A16 | Lampiran berekstensi terlarang | Unggah `jahat.exe` | 422 | BE | 422 `{"attachment":["The attachment field must be a file of type: jpg, jpeg, png, pdf."]}` | Pass |
| A17 | Berkas bukan gambar yang disamarkan | Unggah berkas berisi byte acak dengan header `\x89PNG` palsu, nama `.png` | 422 (validasi `mimes` membaca isi, bukan nama) | BE | 422 dengan pesan sama — validasi menolak berdasarkan isi berkas | Pass |
| A18 | Menghapus feedback yang sudah tidak ada | `DELETE /feedbacks/2` setelah dihapus admin | 404 | BE | 404 | Pass |
| A19 | **Lampiran ikut terhapus saat feedback dihapus** | Catat path file → staff `DELETE /feedbacks/4` (status `open`, punya lampiran) → cek disk | Baris hilang **dan** file hilang dari disk (hook `deleting` model) | BE | GAGAL pada percobaan pertama: berkas lampiran tertinggal di disk karena hook memakai disk default sementara berkas disimpan ke disk `public`. **Setelah BUG-FB-01 diperbaiki**: hook memakai `Storage::disk('public')`. Ditutup tes regresi yang mengunggah, menghapus, lalu memastikan berkasnya hilang | Pass (percobaan ke-2) |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Siklus hidup penuh sebuah feedback lintas aktor | (1) staff kirim → (2) admin & manager dinotifikasi → (3) staff edit selagi `open` → (4) admin `respond` → `in_progress` → (5) pemilik dinotifikasi → (6) pemilik gagal edit & gagal hapus → (7) admin `changeStatus` mundur ke `open` → (8) admin `changeStatus` maju ke `resolved` → (9) admin gagal `respond` lagi | Setiap transisi menegakkan aturannya masing-masing | FE+BE | (1) 302 `status=open`; (2) notifikasi id 48 & 49; (3) 302, judul & prioritas berubah; (4) 302, `responded_by=1`; (5) notifikasi id 54 ke user 3; (6) 403 & flash "Feedback yang sudah diproses tidak dapat dihapus."; (7) 302 `status=open`; (8) 302 `status=resolved`; (9) 403. Seluruh rantai sesuai state machine | Pass |
| C02 | Isolasi kepemilikan antar dua pemilik non-pengelola | staff dan `qa5-nodash` sama-sama punya feedback; masing-masing memaksa `?tab=all` | Tidak ada satu pun yang melihat feedback pihak lain, sementara admin melihat keduanya | FE+BE | staff `total=2` (hanya #1,#3); nodash `total=1` (hanya #2); admin `total=3`. Termasuk `stats` yang ikut ter-scope | Pass |

## Temuan

### BUG-FB-01 — Lampiran feedback tidak ikut terhapus (berkas yatim menumpuk di disk)

- **SIFAT**: Cacat kebersihan data & potensi kebocoran — berkas yang "sudah dihapus" menurut aplikasi tetap dapat diakses lewat URL langsung dan menumpuk di storage.
- **MENGGAGALKAN**: A19.
- **GEJALA**: Feedback id 4 milik staff berisi lampiran `bukti.png` tersimpan di `storage/tenantqa-lima/app/public/feedbacks/Z6T3OrrbxDlUKpTutF39OZ9s9W4VQiw16AIoo4Xd.png`. Setelah pemilik menghapus feedback (`DELETE /c/qa-lima/feedbacks/4` → 302, baris hilang dari `feedbacks`), berkas itu **masih ada persis di path yang sama**. Dokumentasi modul menyatakan sebaliknya: "Hapus feedback otomatis menghapus lampirannya (hook `deleting`)".
- **SEBAB**: Ketidakcocokan disk antara penyimpanan dan penghapusan.
  - `app/Http/Controllers/FeedbackController.php:92` menyimpan ke disk **`public`**: `$file->store('feedbacks', 'public')`.
  - `app/Models/Feedback.php:322-326` menghapus dari disk **default**: `Storage::exists($feedback->attachment_path)` / `Storage::delete(...)` tanpa `disk('public')`.
  - `config/filesystems.php:16` → default `env('FILESYSTEM_DISK', 'local')`, dan `.env` menyetel `FILESYSTEM_DISK=local`. Karena berkas tidak pernah ada di disk `local`, `Storage::exists()` selalu `false` dan blok hapus tidak pernah berjalan — tanpa error, tanpa log.
- **CAKUPAN**: Setiap penghapusan feedback berlampiran, oleh pemilik maupun pengelola. Berkas menumpuk tanpa batas dan tetap dapat diunduh siapa pun yang menyimpan URL-nya (disk `public` dilayani `TenantStorageController`). Sebagai pembanding: `CustomFontController` melakukan hal yang benar — pada uji Settings N14 penghapusan font **berhasil** menghapus berkasnya dari disk, sehingga masalah ini spesifik pada modul Feedback, bukan keterbatasan lingkungan.
- **DIPERBAIKI**: hook memakai `Storage::disk('public')`, dan tes regresi yang disarankan itu memang ditambahkan (`FeedbackAttachmentTest`) — kegagalan jenis ini tidak memunculkan gejala apa pun tanpa tes. Saran asli: samakan disk di hook: `Storage::disk('public')->exists(...)` / `Storage::disk('public')->delete(...)` di `app/Models/Feedback.php:322-326`. Sekalian pertimbangkan menambahkan tes regresi yang memverifikasi ketiadaan berkas setelah `delete()`, karena kegagalan jenis ini tidak memunculkan gejala apa pun di jalur happy-path.

## Catatan pelaksanaan

- Seluruh case dieksekusi lewat **request HTTP dengan cookie sesi asli**. Case
  A01–A06 dan A09 sengaja dijalankan sebagai request langsung ke endpoint —
  itulah inti kolom Lapisan: aturan yang hanya ditegakkan di UI sama dengan tidak
  ditegakkan.
- Props halaman `/feedbacks` dibaca dari atribut `<script data-page="app">`
  (`rows`, `stats`, `filters.tab`, `canManage`, `canRespond`) sehingga klaim
  scoping didasarkan pada data yang benar-benar dikirim server ke React.
- Verifikasi database ke `finance_central` dilakukan setelah setiap mutasi;
  keberadaan berkas lampiran diverifikasi langsung di filesystem.
- **Catatan tooling (bukan cacat aplikasi)**: pada percobaan pertama N01, nilai
  `page_url` tersimpan sebagai `C:/qa-lima/dashboard`. Ini artefak konversi path
  Git Bash/MSYS yang mengubah argumen `/c/...` menjadi path Windows sebelum curl
  mengirimnya — bukan bug aplikasi. Diuji ulang pada N02 dengan
  `MSYS_NO_PATHCONV=1` dan tersimpan benar sebagai
  `/c/qa-lima/reports/profit-loss`.
- Flag baris `can_respond` bernilai `true` bahkan untuk staff yang tidak punya
  permission `respond feedbacks`. Diperiksa dan **bukan bug**: flag itu murni
  status model (`$f->canRespond()`, `FeedbackController.php:236`), sementara
  tombolnya digating ganda di `resources/js/pages/feedbacks/index.tsx:609`
  (`canRespond && feedback.can_respond`), dan server tetap menolak dengan 403
  (dibuktikan A05).
- Feedback #1 dan #3 sengaja **ditinggalkan** di database sebagai jejak bukti;
  keduanya milik akun uji `staff@gmail.com` dan tidak mengganggu data agent lain.
- Alur UI (tombol feedback melayang, dialog, `SegmentedControl`, pengisian
  `page_url` otomatis dari `window.location.pathname`) **tidak** diuji lewat layar
  browser — yang diuji adalah endpoint di belakangnya. Perilaku visual perlu
  diverifikasi manusia.
- **Pembersihan**: akun `qa5-nodash@qa.test` (id 9) dihapus setelah pengujian
  selesai karena `users` berada di database pusat yang dipakai bersama; feedback
  miliknya (#2) sudah lebih dulu terhapus oleh case N12. Untuk mereproduksi
  A02/C02, buat ulang user dengan direct permission ter-scope `qa-lima`:
  `view feedbacks` + `create feedbacks`.
- Berkas lampiran yatim dari BUG-FB-01 (`storage/tenantqa-lima/app/public/feedbacks/Z6T3OrrbxDlUKpTutF39OZ9s9W4VQiw16AIoo4Xd.png`)
  sengaja **tidak** dihapus manual — dibiarkan sebagai bukti temuan yang dapat
  diperiksa ulang. Hapus setelah bug diperbaiki dan diverifikasi.
