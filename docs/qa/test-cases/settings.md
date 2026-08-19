# Test Case — Settings (Profil, Password, Profil Perusahaan, PDF Template Builder)

Sumber teknis: [`docs/module/settings.md`](../../module/settings.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-lima` (DB `tenant_qa-lima`; `users` ada di
`finance_central`), eksekusi HTTP dengan cookie sesi asli + verifikasi database
dan filesystem. Bukan production.

## Akun uji khusus (dibuat & dibersihkan sendiri)

| Akun | Tujuan | Nasib |
|---|---|---|
| `qa5-sandi@qa.test` (id 10) | Uji ganti profil & ganti kata sandi tanpa menyentuh akun bersama | Email berubah jadi `qa5-sandi2@qa.test`, sandi berubah jadi `RahasiaQA5!2026` |
| `qa5-hapus@qa.test` (id 11) | Uji hapus akun (destruktif) | **Terhapus** oleh case N09 |

Akun bersama (`admin/manager/staff@gmail.com`) **tidak** diubah kata sandinya dan
tidak dihapus.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Halaman pengaturan pribadi terbuka untuk user biasa | `qa5-sandi` `GET /c/qa-lima/settings/profile` dan `.../settings/password` | 200 keduanya (tanpa gate permission) | BE | 200 dan 200 | Pass |
| N02 | Ubah nama profil | `PATCH /c/qa-lima/settings/profile` `name=QA5 Ganti Sandi (Baru)` | 302; nama berubah | FE+BE | 302; DB `id=10 name="QA5 Ganti Sandi (Baru)"` | Pass |
| N03 | **Ganti email me-null-kan `email_verified_at`** | `PATCH .../settings/profile` dengan email baru `qa5-sandi2@qa.test` (sebelumnya terverifikasi) | 302; `email_verified_at` menjadi NULL | BE | 302; DB `email=qa5-sandi2@qa.test email_verified_at=NULL` (sebelumnya `2026-08-19 14:50:41`) | Pass |
| N04 | Ganti kata sandi dengan `current_password` benar | `PUT .../settings/password` `current_password=password`, `password=RahasiaQA5!2026` (+confirmation) | 302; hash berubah | FE+BE | 302; hash DB berubah dari `$2y$12$IWSZ35Tg8CY.Q…` menjadi `$2y$12$B0.3aijZxG5/E…` | Pass |
| N05 | Kata sandi lama tidak lagi berlaku, yang baru berlaku | Login ulang dengan sandi lama, lalu dengan sandi baru | Lama ditolak, baru diterima | FE+BE | Login sandi lama → request berikutnya 302 (tidak terautentikasi); login sandi baru → `GET .../settings/profile` 200 | Pass |
| N06 | **Hapus akun dengan kata sandi benar** | `qa5-hapus` `DELETE /c/qa-lima/settings/profile` `password=password` | 302; user hilang beserta relasinya; sesi mati | FE+BE | 302; sesi mati (`GET .../settings/profile` → 302). DB: `users id=11` **0 baris**, `company_user user_id=11` **0 baris**, `model_has_permissions model_id=11` **0 baris** — cascade bersih | Pass |
| N07 | **`CompanyProfile` tetap singleton** | Admin `POST /c/qa-lima/settings/company` **tiga kali** berturut-turut | Selalu memakai baris yang sama, tidak pernah lahir baris kedua | FE+BE | 3× 302; `SELECT COUNT(*) FROM company_profiles` → **1** | Pass |
| N08 | Field profil perusahaan tersimpan lengkap | Simpan nama, alamat, email, telepon, `is_pkp=1`, NPWP, `ppn_rate=11`, penanggung jawab keuangan | Semua nilai tersimpan; `ppn_rate` sebagai desimal persen | BE | DB `name="PT. Quality Assurance Lima" is_pkp=1 npwp=99.888.777.6-555.000 ppn_rate=11.00` | Pass |
| N09 | **`computed_abbreviation` melewati kata PT/CV/TBK** | Uji akseesor pada 5 nama perusahaan | `PT. Semesta Pertambangan Indonesia`→`SPI`; `CV Kisantra Nusantara`→`KN`; `PT Bank Central Asia Tbk`→`BCA`; `PT CV TBK`→`CO` (fallback); `Quality Assurance Lima`→`QAL` | BE | Persis seperti diharapkan, kelimanya. Titik pada `PT.` tertangani. Ketika kolom `abbreviation` terisi, nilai kolom yang dipakai (`abbreviation='LIM'` → `computed='LIM'`) | Pass |
| N10 | Grup PDF Template Builder digate `manage pdf templates` | Admin/manager/staff `GET /c/qa-lima/settings/pdf-templates` | Hanya admin 200; manager & staff 403 | BE | admin 200; manager **403**; staff **403**; `.../custom-fonts` untuk manager juga **403** (route memang berada di dalam prefix yang tergate) | Pass |
| N11 | Buat template | Admin `POST .../pdf-templates` ×3 | 3 template `layout=[]`, `is_default=false` | FE+BE | 3× 302; DB `1,2,3` semuanya `is_default=0` | Pass |
| N12 | **Hanya satu `is_default`** | `POST .../{id}/set-default` berurutan untuk id 1 → 2 → 3 → 2 | Setiap saat tepat satu template default | FE+BE | Setelah tiap langkah: `1:1,2:0,3:0` → `1:0,2:1,3:0` → `1:0,2:0,3:1` → `1:0,2:1,3:0`; `SUM(is_default)` **selalu 1** | Pass |
| N13 | Jalur kedua penetapan default juga aman | `PUT .../pdf-templates/1` dengan `is_default=1` | Tetap satu default | FE+BE | 302; state `1:1,2:0,3:0`, `SUM(is_default)=1` | Pass |
| N14 | Duplikasi template | `POST .../pdf-templates/3/duplicate` | Salinan bernama `"… (Salinan)"`, `is_default=false` | FE+BE | 302; DB `id=4 name="QA5 Template C (Salinan)" is_default=0` | Pass |
| N15 | Simpan layout banded (bentuk yang benar-benar dikirim editor) | `POST .../pdf-templates/3/save` dengan `{paper:{margins:{…}}, bands:{header:{height,elements:[]}, content:{…}, footerFlow:{…}, footerFixed:{…}}}` | 302; JSON tersimpan | FE+BE | 302; DB `layout={"bands": {"header": {"height": 180, "elements": []}, …}` | Pass |
| N16 | Simpan layout legacy flat-array | `POST .../pdf-templates/2/save` dengan `{"layout":[{…}]}` | 302 (validasi longgar untuk skema lama) | BE | 302; DB `layout=[{"x": 5, "y": 5, "text": "legacy", "type": "text"}]` | Pass |
| N17 | Render PDF template | `GET .../pdf-templates/{1,2,3}/pdf` | 200, `%PDF` | BE | 200 semua; ukuran 1.069 / 1.117 / 1.069 byte; magic `%PDF` | Pass |
| N18 | Render PDF dengan invoice tertentu & parameter `items` | `.../pdf-templates/3/pdf/1`, `?items=200`, `?items=999` | 200 (nilai di luar rentang di-clamp, bukan error) | BE | 200, 200, 200 — `items=999` tidak menimbulkan error | Pass |
| N19 | Halaman editor terbuka | `GET .../pdf-templates/3/edit` | 200 | BE | 200 | Pass |
| N20 | Unggah custom font `.ttf` | `POST .../custom-fonts` `name=QA5 Arial` + `C:/Windows/Fonts/arial.ttf` | 302; nama file deterministik `{slug}_{hash8}.ttf` | FE+BE | 302; DB `id=2 name="QA5 Arial" filename=qa5-arial_0f4bf19d.ttf`; berkas ada di `storage/tenantqa-lima/app/public/fonts/custom/` | Pass |
| N21 | Daftar font (JSON) | `GET .../custom-fonts` dengan `Accept: application/json` | Array `{id,name,url}` ber-prefix perusahaan | BE | `[{"id":2,"name":"QA5 Arial","url":"http://127.0.0.1:8000/c/qa-lima/storage/fonts/custom/qa5-arial_0f4bf19d.ttf"}, …]` | Pass |
| N22 | **Hapus font juga menghapus berkasnya** | Catat path → `DELETE .../custom-fonts/1` → cek disk | Baris & berkas hilang | FE+BE | 302; DB tersisa 1 baris; berkas `qa5-font_d3127558.ttf` **hilang dari disk** | Pass |
| N23 | Invoice produksi dirender lewat template builder | `GET /c/qa-lima/invoice/1/download?template=builder:3` | 200, PDF | BE | 200, 1.069 byte, magic `%PDF` | Pass |
| N24 | Redirect sandbox lama | `GET /c/qa-lima/template-builder-test` | 302 ke daftar template, **dengan prefix perusahaan** | BE | 302 `Location: http://127.0.0.1:8000/c/qa-lima/settings/pdf-templates` — benar | Pass |
| N25 | Hapus template | `DELETE .../pdf-templates/4` lalu `.../pdf-templates/1` | 302; baris hilang | FE+BE | 302 keduanya; DB tersisa id 2 & 3 | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | Email profil bentrok dengan user lain | `PATCH .../settings/profile` `email=admin@gmail.com` | 422 | BE | 422 `{"email":["The email has already been taken."]}` | Pass |
| A02 | Email profil tidak valid | `email=bukan-email` | 422 | BE | 422 `{"email":["The email field must be a valid email address."]}` | Pass |
| A03 | **`current_password` salah** | `PUT .../settings/password` `current_password=salahbanget` | 422; hash tidak berubah | BE | 422 `{"current_password":["The password is incorrect."]}`; hash DB tetap `$2y$12$IWSZ35Tg8CY.Q…` | Pass |
| A04 | Konfirmasi sandi tidak cocok | `password=RahasiaQA5!2026`, `password_confirmation=BedaSekali!2026` | 422 | BE | 422 `{"password":["The password field confirmation does not match."]}` | Pass |
| A05 | Sandi baru terlalu pendek | `password=abc` | 422 (aturan `PasswordRule::defaults()`) | BE | 422 `{"password":["The password field must be at least 8 characters."]}` | Pass |
| A06 | **Hapus akun dengan kata sandi salah** | `DELETE .../settings/profile` `password=bukanini` | 422; user tetap ada | BE | 422 `{"password":["The password is incorrect."]}`; DB `id=11 email=qa5-hapus@qa.test` masih ada | Pass |
| A07 | Hapus akun tanpa kata sandi | `DELETE .../settings/profile` tanpa field | 422 | BE | 422 `{"password":["The password field is required."]}` | Pass |
| A08 | `ppn_rate` di luar 0–100 | `POST .../settings/company` `ppn_rate=150` | 422 | BE | 422 `{"ppn_rate":["The ppn rate field must not be greater than 100."]}` | Pass |
| A09 | Email perusahaan tidak valid | `email=bukan-email` | 422 | BE | 422 `{"email":["The email field must be a valid email address."]}` | Pass |
| A10 | Nama aset di luar whitelist | `DELETE .../settings/company/assets/database` | 404 | BE | 404 (whitelist `logo, letter_head, signature, stamp` ditegakkan) | Pass |
| A11 | Simpan layout banded tanpa `paper.margins` | `POST .../pdf-templates/1/save` dengan `paper:{}` | 422 dengan rincian per-field | BE | 422 `{"layout.paper":[…],"layout.paper.margins":[…],"layout.paper.margins.top":[…], …}` (10 error) | Pass |
| A12 | Margin negatif | `paper.margins.top=-5` | 422 | BE | 422 `{"layout.paper.margins.top":["The layout.paper.margins.top field must be at least 0."]}` | Pass |
| A13 | Band bukan array | `bands.header="bukan-array"` | 422 | BE | 422 `{"layout.bands.header":["The layout.bands.header field must be an array."]}` | Pass |
| A14 | Template tanpa nama | `POST .../pdf-templates` tanpa `name` | 422 | BE | 422 `{"name":["The name field is required."]}` | Pass |
| A15 | Font: berkas PNG diberi ekstensi `.ttf` | Unggah PNG asli bernama `samaran.ttf` | Ditolak | BE | 422 `{"file":["The file field must be a file of type: font/ttf, font/sfnt, application/x-font-ttf, application/x-font-truetype, application/octet-stream."]}` — validasi membaca isi, bukan nama | Pass |
| A16 | Font: nama duplikat | Unggah lagi dengan `name=QA5 Arial` | 422 | BE | 422 `{"name":["The name has already been taken."]}` | Pass |
| A17 | Font: berkas `.ttf` berisi byte acak | Unggah 3.000 byte acak bernama `palsu.ttf` | Diterima (mimetypes sengaja longgar menerima `application/octet-stream`) | BE | 302, tersimpan sebagai `qa5-font_d3127558.ttf`. Sesuai desain yang didokumentasikan ("validasi double-layer: mimetypes longgar, ekstensi wajib `.ttf`"), tetapi berarti berkas rusak bisa masuk pustaka font | Pass (lihat CATATAN-SET-04) |
| A18 | Template `builder:` yang tidak ada | `GET /c/qa-lima/invoice/1/download?template=builder:999` | 404, bukan 500 | BE | 404 | Pass |
| A19 | **Root pengaturan kehilangan prefix perusahaan** | `GET /c/qa-lima/settings` lalu ikuti redirect | 302 ke `/c/qa-lima/settings/profile` (200) | BE | 302 `Location: /settings/profile` (**tanpa** `/c/qa-lima`) → tujuan **404** | **Fail** (BUG-SET-01) |
| A20 | **Profil perusahaan dapat ditimpa user tanpa hak kelola** | `staff@gmail.com` (role staff) `POST /c/qa-lima/settings/company` | Ditolak (403) — identitas, NPWP, dan `ppn_rate` perusahaan bukan data yang boleh diubah staff | BE | **302 — berhasil.** DB berubah menjadi `name="Diambil Staff" is_pkp=0 npwp=NULL ppn_rate=0.00`. Dipulihkan kembali oleh penguji sesudahnya | **Fail** (BUG-SET-02) |
| A21 | **Unduh invoice dengan template PDF bawaan** | `GET /c/qa-lima/invoice/1/download` (tanpa `template=`, memakai `kisantra-invoice`) | 200 PDF | BE | **HTTP 500**. Log: `foreach() argument must be of type array\|object, null given (View: resources/views/pdf/kisantra-invoice.blade.php)` | **Fail** (BUG-SET-03) |
| A22 | Menghapus template yang sedang menjadi default | `DELETE .../pdf-templates/1` saat `is_default=1` | Aplikasi tetap punya template default | FE+BE | 302; setelah itu `SUM(is_default)=0` — tidak ada template default tersisa dan tidak ada promosi otomatis | Pass (invarian "maksimal satu" tetap terjaga; lihat CATATAN-SET-05) |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Siklus penuh ganti kredensial | (1) `qa5-sandi` ubah nama → (2) ubah email (verifikasi hangus) → (3) tolak `current_password` salah → (4) ganti sandi sukses → (5) sandi lama gagal login, sandi baru berhasil | Setiap langkah menegakkan aturannya sendiri | FE+BE | (1) 302; (2) `email_verified_at=NULL`; (3) 422; (4) hash berubah; (5) login lama gagal / baru 200 | Pass |
| C02 | Siklus hidup template PDF | Buat 3 → set-default bergiliran → duplikasi → simpan layout banded → render PDF → pakai untuk invoice produksi → hapus | Setiap tahap konsisten; `SUM(is_default)` tak pernah > 1 | FE+BE | Seluruh tahap 302/200 seperti pada N11–N25; `SUM(is_default)` = 1 di setiap pemeriksaan, kecuali menjadi 0 setelah template default dihapus (A22) | Pass |
| C03 | Siklus pustaka font | Unggah → tampil di daftar JSON → hapus → berkas hilang dari disk | Berkas benar-benar hilang | FE+BE | Unggah 302 → daftar memuat 2 font → `DELETE` 302 → berkas `qa5-font_d3127558.ttf` hilang dari `storage/tenantqa-lima/app/public/fonts/custom/` | Pass |

## Temuan

### BUG-SET-01 — `/c/{company}/settings` melempar ke URL tanpa prefix perusahaan lalu 404

- **SIFAT**: Cacat routing multi-tenancy — jalan pintas yang wajar dari menu/URL berakhir di halaman tidak ditemukan.
- **MENGGAGALKAN**: A19.
- **GEJALA**: `GET /c/qa-lima/settings` menjawab `302` dengan `Location: /settings/profile` — tanpa segmen `/c/qa-lima`. Mengikuti redirect menghasilkan **404** (`GET /settings/profile` = 404, diverifikasi terpisah).
- **SEBAB**: `routes/web.php:567` — `Route::redirect('/', '/settings/profile');` menuliskan **path literal**. Di dalam grup ber-prefix `/c/{company}`, target redirect tidak ikut mendapat prefix. Bandingkan dengan `routes/web.php:145` (`/template-builder-test`) yang memakai `redirect()->route(...)` dan **benar** menghasilkan `/c/qa-lima/settings/pdf-templates` (dibuktikan N24) — jadi polanya sudah ada di file yang sama, hanya baris ini yang tertinggal.
- **CAKUPAN**: Siapa pun yang membuka `/settings` tanpa sub-halaman: tautan lama, bookmark, atau menu yang menunjuk root pengaturan. Bukan kehilangan data, tetapi jalan buntu yang terlihat seperti aplikasi rusak.
- **SARAN PERBAIKAN**: Ganti menjadi redirect berbasis nama route, mis. `Route::get('/', fn () => redirect()->route('settings.profile'))`, agar prefix perusahaan ikut terbentuk. Sisir juga `Route::redirect` lain di dalam grup ber-prefix.

### BUG-SET-02 — Profil perusahaan (identitas, NPWP, tarif PPN) dapat ditimpa oleh user mana pun yang login

- **SIFAT**: Cacat otorisasi. Dokumentasi modul menyebut halaman ini "terbuka untuk semua user login", jadi mungkin disengaja — tetapi konsekuensinya perlu keputusan sadar, bukan diwariskan diam-diam.
- **MENGGAGALKAN**: A20.
- **GEJALA**: `staff@gmail.com` — role `staff`, tanpa `manage companies`, tanpa `manage pdf templates` — mengirim `POST /c/qa-lima/settings/company` dan menerima **302 sukses**. Isi tabel `company_profiles` berubah menjadi `name="Diambil Staff"`, `is_pkp=0`, `npwp=NULL`, `ppn_rate=0.00`, menimpa data yang sah. (Penguji memulihkannya segera setelah pembuktian.)
- **SEBAB**: `routes/web.php` — `Route::get('/company', …)` dan `Route::post('/company', …)` berada di dalam grup `settings` yang **tidak** memasang middleware `can:` apa pun, berbeda dari sub-grup `pdf-templates` yang digate `can:manage pdf templates` (`routes/web.php:581`). `CompanyController::update()` juga tidak memuat otorisasi sendiri, dan `UpdateCompanyRequest::authorize()` mengembalikan `true`.
- **CAKUPAN**: Setiap user yang bisa login ke perusahaan. Dampaknya menjalar keluar modul Settings: `ppn_rate`, `is_pkp`, dan `npwp` dipakai `InvoicePrintService` serta seluruh template PDF invoice, dan `computed_abbreviation` dipakai penomoran Fund Request (`001/KSN/I/2026`). Satu user tanpa niat jahat pun bisa membuat seluruh invoice terbit dengan identitas dan tarif pajak yang salah — dan tidak ada jejak audit siapa yang mengubahnya.
- **SARAN PERBAIKAN**: Pasang gate pada dua route company (mis. `can:manage companies`, permission yang sudah ada dan hanya dimiliki admin), atau perkenalkan permission khusus `manage company profile`. Bila keterbukaan ini memang keputusan produk, catat alasannya secara eksplisit di `docs/module/settings.md` — jangan biarkan tersirat.

### BUG-SET-03 — Unduh invoice dengan template PDF bawaan gagal 500 pada perusahaan yang profilnya diisi lewat Settings

- **SIFAT**: Cacat fungsional — fitur inti (unduh invoice) mati total pada perusahaan yang baru dikonfigurasi.
- **MENGGAGALKAN**: A21.
- **GEJALA**: `GET /c/qa-lima/invoice/1/download` (tanpa parameter `template`, sehingga memakai default `kisantra-invoice`) menjawab **HTTP 500**. `storage/logs/laravel.log` mencatat: `foreach() argument must be of type array|object, null given (View: D:\Laravel\finance-management\resources\views\pdf\kisantra-invoice.blade.php)`. Jalur `template=builder:{id}` **berhasil** (N23), jadi kegagalan spesifik pada template Blade bawaan.
- **SEBAB**: `resources/views/pdf/kisantra-invoice.blade.php:577` — `@foreach ($company['bank_accounts'] as $index => $bank)` tanpa pengaman null. Kolom `company_profiles.bank_accounts` bernilai NULL, dan **tidak ada cara mengisinya dari modul Settings**: `app/Http/Requests/Settings/UpdateCompanyRequest.php` sama sekali tidak memuat aturan untuk `bank_accounts` (diverifikasi: nol kemunculan kata itu di file tersebut), sehingga form profil perusahaan tidak pernah menuliskannya. Pola `foreach` tanpa pengaman yang sama ada di `resources/views/pdf/invoice.blade.php`, `semesta-invoice.blade.php`, dan `single-invoice.blade.php`.
- **CAKUPAN**: Setiap perusahaan yang profilnya dibuat/diisi lewat Settings dan bukan lewat seeder — yaitu semua perusahaan baru hasil provisioning. Bukan kasus buatan: log aplikasi menunjukkan galat identik terjadi pada perusahaan lain (`tenant_qa-dua`) di sesi terpisah pada hari yang sama, jadi ini reproducible lintas tenant.
- **SARAN PERBAIKAN**: (1) Beri pengaman di keempat template Blade: `@foreach (($company['bank_accounts'] ?? []) as …)`. (2) Sediakan pengisian `bank_accounts` di form Profil Perusahaan (tambahkan aturannya di `UpdateCompanyRequest`), karena tanpa itu blok rekening pada invoice memang tidak akan pernah terisi. (3) Beri default `[]` alih-alih NULL pada kolom tersebut.

### CATATAN-SET-04 — Validasi custom font menerima berkas `.ttf` berisi data sembarang

- **SIFAT**: Pengamatan (perilaku terdokumentasi), risiko rendah–sedang.
- **TERKAIT**: A15, A17.
- **GEJALA**: Berkas 3.000 byte acak bernama `palsu.ttf` diterima (302) dan masuk pustaka font. Sebaliknya PNG asli bernama `.ttf` ditolak dengan benar (A15).
- **SEBAB**: Daftar `mimetypes` di `CustomFontController::store` menyertakan `application/octet-stream` — sengaja, agar TTF yang tidak terdeteksi tetap bisa diunggah. Byte acak juga terdeteksi sebagai `application/octet-stream`, sehingga lolos.
- **CAKUPAN**: Font rusak dapat masuk pustaka global dan dipilih di editor; teks yang memakainya akan jatuh ke font default DomPDF (atau menggagalkan render) tanpa pesan yang menjelaskan sebabnya.
- **SARAN PERBAIKAN**: Tambahkan pemeriksaan magic number SFNT (`0x00010000` atau `true`/`ttcf` pada 4 byte pertama) sebagai lapis ketiga — murah, dan menutup celah tanpa mengorbankan kelonggaran mimetypes yang memang diperlukan.

### CATATAN-SET-05 — Menghapus template default menyisakan nol template default

- **SIFAT**: Pengamatan, risiko rendah.
- **TERKAIT**: A22.
- **GEJALA**: Setelah `DELETE .../pdf-templates/1` yang saat itu `is_default=1`, `SUM(is_default)` menjadi **0**. Invarian yang didokumentasikan ("hanya satu `is_default`") tidak dilanggar, tetapi keadaan "tidak ada default sama sekali" juga tidak pernah dibahas.
- **SEBAB**: `PdfTemplateController::destroy()` menghapus baris tanpa mempromosikan template lain.
- **SARAN PERBAIKAN**: Bila ada template lain tersisa, promosikan yang tertua/pertama menjadi default; atau tolak penghapusan template default selama masih ada template lain — pilih satu dan tuliskan sebagai invarian.

## Catatan pelaksanaan

- Seluruh case dieksekusi lewat **request HTTP dengan cookie sesi asli**; verifikasi
  dilakukan ke database (`finance_central` untuk `users`, `tenant_qa-lima` untuk
  `company_profiles`, `pdf_templates`, `custom_fonts`) dan ke **filesystem** untuk
  berkas font.
- Case destruktif (ganti sandi, hapus akun) sengaja **hanya** dijalankan pada akun
  `qa5-*` yang dibuat khusus. Kata sandi akun bersama tidak pernah disentuh dan
  tidak ada akun bersama yang dihapus.
- N09 (`computed_abbreviation`) diuji lewat **instansiasi model di memori** dengan 5
  nama perusahaan, bukan lewat layar, karena kolom `abbreviation` tidak termasuk
  field yang dikirim form profil perusahaan sehingga jalur auto-generate tidak
  dapat dipicu dari UI. Dinyatakan apa adanya.
- A20 bersifat destruktif terhadap data perusahaan: profil segera **dipulihkan**
  ke nilai sah setelah pembuktian, dan keadaan akhir diverifikasi ulang di DB
  (`name="PT. Quality Assurance Lima" is_pkp=1 npwp=99.888.777.6-555.000 ppn_rate=11.00`).
- A21 (BUG-SET-03) menyentuh modul Invoice/PDF yang di luar cakupan tugas ini,
  tetapi ditemukan dari sisi Settings (kolom `bank_accounts` yang tidak pernah
  diisi form) sehingga dilaporkan di sini; verifikasi akar masalah dilakukan lewat
  `storage/logs/laravel.log`, nomor baris Blade, dan isi `UpdateCompanyRequest`.
- Uji awal penyimpanan layout banded sempat menghasilkan 422 karena penguji
  mengirim band sebagai **array elemen langsung**; setelah diperiksa, bentuk yang
  benar-benar dikirim editor React adalah **objek** `{height, elements}`
  (`resources/js/pages/settings/pdf-templates/edit.tsx`, fungsi `save()`), dan
  bentuk itu tersimpan tanpa masalah (N15). Jadi ini kekeliruan penguji, **bukan
  cacat aplikasi** — dicatat agar tidak salah dibaca sebagai bug.
- **Pembersihan**: `qa5-hapus@qa.test` terhapus oleh case N09 itu sendiri;
  `qa5-sandi@qa.test` (yang emailnya sudah berubah menjadi `qa5-sandi2@qa.test`)
  dihapus manual setelah pengujian selesai karena `users` berada di database
  pusat yang dipakai bersama. Verifikasi akhir: `SELECT ... FROM users` menyisakan
  tepat 3 akun bawaan (`admin`, `manager`, `staff`) — tidak ada residu `qa5-`.
  Template PDF (id 2 & 3) dan font `QA5 Arial` ditinggalkan di `tenant_qa-lima`
  sebagai jejak bukti.
- Editor WYSIWYG (drag-and-drop elemen, band resize, picker token & font)
  **tidak** diuji lewat layar browser; yang diuji adalah endpoint penyimpanan,
  render PDF, dan pustaka font di belakangnya. Perilaku kanvas perlu diverifikasi
  manusia.
