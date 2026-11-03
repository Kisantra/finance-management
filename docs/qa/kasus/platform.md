# QC Penguji D — Dashboard, Administrasi, Pengaturan, Notifikasi, Feedback

Lingkungan `qcd` (port 8014, database `qcd_central`, tenant `tenant_qcdsatu` /
`tenant_qcddua`). Dijalankan 3 November 2026 pada branch
`feature/multi-tenancy-rekonsiliasi`. Seluruh kasus `FE` dan `FE+BE` digerakkan
lewat UI sungguhan (Playwright + Chromium headless, 1440×950); kasus yang tidak
terjangkau UI dikirim lewat HTTP dari dalam halaman yang sudah login, sehingga
cookie sesi dan token CSRF-nya asli.

Papan skor di bagian akhir **dihitung dengan program** dari tabel di halaman ini
(`D:/tmp/qa-tools/qcd/hitung.py`), bukan dengan tangan.

---

## Fixture yang dibuat sendiri

Kerangka lingkungan hanya menyediakan 2 perusahaan + 4 akun. Yang berikut dibuat
khusus untuk cakupan ini:

| fixture | untuk |
|---|---|
| Organisasi kedua `Grup QC LAIN` + perusahaan `qcdlain` (baris saja, tanpa database) | A02 — batas organisasi. Uji ini tidak pernah menyentuh database tenant-nya |
| Pengguna `qcd-org2@qc.test` (admin di `qcdlain`, organisasi 2) | A11 — apakah hitungan peran bocor lintas organisasi |
| 6 notifikasi untuk admin: 2 `qcdsatu`, 3 `qcddua`, 1 tanpa `company_id` | C02, C03, A05, A15 |
| 2 rekening bank + 6 transaksi tersebar dari H-0 sampai H-400 di `qcdsatu` | N17–N21 — grafik arus kas butuh data di beberapa periode |
| Perusahaan `qcdtiga` (dibuat lewat UI) dan `qcdgagal` (sengaja digagalkan) | C06–C08 |
| Template PDF `Invoice Resmi QCD` berisi kop surat, ditandai default | A12 |

---

## N — jalur normal

*N26 tidak ada: nomornya sempat dipakai untuk kasus yang kemudian dilebur ke N29. Dibiarkan kosong agar ID pada nama berkas bukti tetap cocok dengan tabel ini.*

| ID | Lapisan | Kasus | Hasil nyata | Bukti | Status |
|---|---|---|---|---|---|
| N01 | FE+BE | Admin anggota 2 perusahaan login | Mendarat di `/choose-company`, dua kartu perusahaan tampil | [N01](../bukti/platform/N01-pemilih-perusahaan.png) | **LULUS** |
| N02 | FE+BE | Dashboard `qcdsatu` terbuka | HTTP 200, seluruh blok ter-render | [N02](../bukti/platform/N02-dashboard-satu.png) | **LULUS** |
| N03 | FE+BE | `/admin/users` | 200, judul "Manajemen Pengguna" | [N03](../bukti/platform/N03-admin-users.png) | **LULUS** |
| N04 | FE+BE | `/admin/companies` | 200, judul "Perusahaan", kuota `2 / 10` | [N04](../bukti/platform/N04-admin-companies.png) | **LULUS** |
| N05 | FE+BE | `/admin/permissions` | 200, "Manajemen Peran & Permission" | [N05](../bukti/platform/N05-permissions.png) | **LULUS** |
| N06 | FE | `/settings` (hub) | 200, "Pengaturan" | [N06](../bukti/platform/N06-settings-hub.png) | **LULUS** |
| N07 | FE+BE | `/settings/profile` | 200, "Profil" | [N07](../bukti/platform/N07-settings-profile.png) | **LULUS** |
| N08 | FE+BE | `/settings/password` | 200, "Kata Sandi" | [N08](../bukti/platform/N08-settings-password.png) | **LULUS** |
| N09 | FE+BE | `/settings/company` terbuka | 200, "Profil Perusahaan" — **tetapi tidak bisa disimpan, lihat N29** | [N09](../bukti/platform/N09-settings-company.png) | **LULUS** |
| N10 | FE+BE | `/settings/invoice-numbering` | 200, "Penomoran invoice" | [N10](../bukti/platform/N10-settings-invoice-numbering.png) | **LULUS** |
| N11 | FE+BE | `/settings/pdf-templates` | 200, "Template PDF" | [N11](../bukti/platform/N11-settings-pdf-templates.png) | **LULUS** |
| N12 | BE | `/settings/pdf-templates/custom-fonts` | 200 **JSON**, bukan halaman — `CustomFontController::index()` mengembalikan `JsonResponse`. Unggah font terjadi di dalam editor template, bukan halaman tersendiri. **Koreksi premis spec** ("10 halaman pengaturan"): yang benar-benar halaman ada **7** (hub, profil, sandi, perusahaan, penomoran, daftar template PDF, editor template) | [N12](../bukti/platform/N12-settings-fonts.png) | **CATATAN** |
| N13 | FE+BE | `/feedbacks` | 200, "Feedback & Saran" | [N13](../bukti/platform/N13-feedbacks.png) | **LULUS** |
| N14 | FE | Pengalih perusahaan di menu akun (2 perusahaan) | Bagian "Perusahaan" muncul berisi `PT Dua QCD`, `PT Satu QCD`, perusahaan aktif bertanda centang | [N14](../bukti/platform/N14-menu-akun-pengalih.png) | **LULUS** |
| N15 | FE+BE | Pindah perusahaan lewat pengalih | Muat ulang penuh ke `/c/qcddua/dashboard` | [N15](../bukti/platform/N15-pindah-ke-qcddua.png) | **LULUS** |
| N16 | FE+BE | Staff anggota 1 perusahaan login | Langsung ke `/c/qcdsatu/dashboard`, **tanpa** melewati pemilih; menu akun hanya berisi "Pengaturan" + "Profil perusahaan", tanpa bagian Perusahaan. Membuka `/choose-company` manual pun dialihkan ke dashboard | [N16](../bukti/platform/N16-staff-langsung-dashboard.png), [menu](../bukti/platform/N16b-staff-menu-akun.png) | **LULUS** |
| N17 | FE+BE | Dashboard dengan data nyata | Total saldo `Rp 84.300.000` (= `50jt+20jt` saldo awal + mutasi), pemasukan/pengeluaran bulan berjalan, daftar invoice belum dibayar | [N17](../bukti/platform/N17-dashboard-berisi.png) | **LULUS** |
| N18 | FE+BE | Grafik arus kas **mingguan** | `?chart_period=weekly`, sumbu `17 Agu – 8 Nov`, skala puncak ±5 jt | [N18](../bukti/platform/N18-chart-mingguan.png) | **LULUS** |
| N19 | FE+BE | Grafik arus kas **bulanan** | `?chart_period=monthly`, sumbu `1 Jun – 30 Nov`, skala puncak ±15 jt | [N19](../bukti/platform/N19-chart-bulanan.png) | **LULUS** |
| N20 | FE+BE | Grafik arus kas **tahunan** | `?chart_period=yearly`, sumbu `1 Jan – 31 Des`, skala puncak ±30 jt — bucket benar-benar berubah, bukan hanya labelnya | [N20](../bukti/platform/N20-chart-tahunan.png) | **LULUS** |
| N21 | FE+BE | Filter rekening pada grafik | Pilih `Bank QC A · Operasional A` → `?chart_account=1`, skala puncak turun 30 jt → 6 jt, keterangan jadi "2 rekening · grafik: Bank QC A · Operasional A". KPI saldo total sengaja tetap seluruh rekening | [opsi](../bukti/platform/N21-1-daftar-rekening.png), [hasil](../bukti/platform/N21-2-terfilter.png) | **LULUS** |
| N22 | FE+BE | Halaman Izin & Peran | 3 peran, 77 permission, 23 modul; memilih peran menampilkan centang per permission | [daftar](../bukti/platform/N22-1-permissions-qcdsatu.png), [staff](../bukti/platform/N22-2-peran-staff.png) | **LULUS** |
| N23 | FE+BE | Buat template PDF lewat UI | "Template berhasil dibuat.", diarahkan ke editor `/settings/pdf-templates/1/edit`; baris tersimpan di `tenant_qcdsatu.pdf_templates` | [kosong](../bukti/platform/N23-1-pdf-templates-kosong.png), [dialog](../bukti/platform/N23-2-dialog-template.png), [jadi](../bukti/platform/N23-3-template-dibuat.png) | **LULUS** |
| N24 | FE+BE | Ubah nama di `/settings/profile` | "Profil berhasil diperbarui.", nama berubah di DB | [sebelum](../bukti/platform/N24-1-profil.png), [sesudah](../bukti/platform/N24-2-profil-tersimpan.png) | **LULUS** |
| N25 | FE+BE | Ganti kata sandi | Sandi lama salah → "Kata sandi salah."; sandi lama benar → "Kata sandi berhasil diperbarui."; login ulang dengan sandi baru berhasil | [salah](../bukti/platform/N25-1-sandi-lama-salah.png), [benar](../bukti/platform/N25-2-sandi-diganti.png), [login](../bukti/platform/N25-3-login-sandi-baru.png) | **LULUS** |
| N27 | FE+BE | `/panduan` publik, sebelum & sesudah login | Tamu 200 dengan tombol "Masuk"; sudah login 200 dengan tombol "Buka aplikasi"; memakai kerangkanya sendiri, bukan `AppLayout`. Tidak satu pun dari `PT Satu QCD`, `PT Dua QCD`, `qcdsatu`, `qcddua`, email akun, nomor invoice, judul feedback, atau nama klien muncul — di halaman indeks maupun `/panduan/invoices` | [tamu](../bukti/platform/N27-1-panduan-tamu.png), [modul](../bukti/platform/N27-2-panduan-modul-tamu.png), [login](../bukti/platform/N27-3-panduan-login.png) | **LULUS** |
| N28 | FE+BE | Ubah status feedback | "Ubah Status" → "Selesai" → "Status diperbarui."; `feedbacks.status` jadi `resolved` di DB, feedback perusahaan lain tidak tersentuh | [opsi](../bukti/platform/N28-1-pilihan-status.png), [hasil](../bukti/platform/N28-2-status-resolved.png) | **LULUS** |
| N29 | FE+BE | **Simpan Profil Perusahaan lewat UI** | **GAGAL — 405.** Form mengirim `POST /settings/company` (tanpa prefiks `/c/{slug}`). Tidak ada flash, tidak ada perubahan di DB. Route yang benar hidup: `POST /c/qcdsatu/settings/company` lewat `fetch` menjawab **200** dan baris `company_profiles` benar-benar berubah | [klik tanpa reaksi](../bukti/platform/N29-1-klik-simpan-tanpa-reaksi.png), [405](../bukti/platform/N29-2-gagal-405.png), [pembanding](../bukti/platform/N29-3-satu-konteks-clients-vs-company.png) | **GAGAL** |

---

## A — abnormal / batas

| ID | Lapisan | Kasus | Hasil nyata | Bukti | Status |
|---|---|---|---|---|---|
| A02 | BE | Admin organisasi 1 menugaskan pengguna ke `qcdlain` (organisasi 2) lewat HTTP: `companies=[qcdsatu,qcdlain]`. *UI tidak bisa mencapainya: panel hanya menampilkan perusahaan seorganisasi, jadi slug asing harus dikirim langsung.* | `qcdlain` disaring habis oleh `perusahaanSeorganisasi()`. DB: pengguna tidak pernah menjadi anggota `qcdlain`, tidak ada baris peran di sana | — (BE) | **LULUS** |
| A02b | BE | Payload berisi **hanya** slug luar organisasi: `companies=[qcdlain]` | **GAGAL — pengguna jadi 0 perusahaan.** Irisan menghasilkan daftar kosong, `sync([])` mencabut SELURUH keanggotaan, jawabannya tetap "Pengguna berhasil diperbarui." Aturan `companies => ['sometimes','array','min:1']` di `StoreUserRequest` dilewati karena pengosongan terjadi SETELAH validasi | — (BE); akibatnya terlihat di [A04](../bukti/platform/A04-nol-perusahaan.png) | **GAGAL** |
| A03 | BE | Admin mencabut dirinya dari perusahaan yang sedang dibuka, lewat HTTP (`companies=[qcddua]` saat berada di `qcdsatu`) | Penjaga di `terapkanKeanggotaan()` menambahkan kembali perusahaan aktif. DB: admin tetap anggota `qcdsatu`; `/c/qcdsatu/admin/users` tetap 200 | [A03](../bukti/platform/A03-masih-bisa-masuk-qcdsatu.png) | **LULUS** |
| A03b | FE+BE | Hal yang sama lewat UI: hapus centang perusahaan aktif lalu simpan | "Pengguna berhasil diperbarui.", tetapi DB tetap mencatat keanggotaan `qcdsatu`; dashboard `qcdsatu` tetap 200 | [uncheck](../bukti/platform/A03b-uncheck-perusahaan-aktif.png), [masih masuk](../bukti/platform/A03b-setelah-uncheck-masih-masuk.png) | **LULUS** |
| A04 | FE+BE | Pengguna tanpa perusahaan login (akibat A02b) | 403 dengan pesan yang memang ditulis: *"Akun Anda belum terdaftar di perusahaan mana pun. Hubungi administrator."* — bukan 500, bukan "tidak punya izin" generik. Halaman error menampilkan kode referensi dan tombol lapor | [A04](../bukti/platform/A04-nol-perusahaan.png), [choose-company](../bukti/platform/A04b-choose-company-nol.png), [akses dicabut](../bukti/platform/A04c-akses-setelah-dicabut.png) | **LULUS** |
| A05 | BE | Dari konteks `qcdsatu`, tandai terbaca notifikasi id 3 yang `company_id = qcddua` (milik sendiri). *UI tidak menampilkannya, jadi hanya bisa lewat HTTP* | **GAGAL — 200 dan `read_at` benar-benar terisi.** `NotificationController::markAsRead()` hanya memeriksa `user_id`, tanpa `forCurrentCompany()` — satu-satunya penulis notifikasi yang tidak bercakupan perusahaan | — (BE) | **GAGAL** |
| A06 | BE | Dari `qcdsatu`, sentuh feedback id 2 milik `qcddua`: `respond`, `status`, `destroy`, dan `?show=2` | Keempatnya ditolak: tiga endpoint **404**, dan `?show=2` tidak menampilkan judul maupun isi `RAHASIA-DUA` | [show](../bukti/platform/A06-show-feedback-lain.png) | **LULUS** |
| A07 | FE | Kuota organisasi penuh (3/3) | Kartu kuota menampilkan `3 / 3`, tombol "Perusahaan Baru" `disabled` | [A07](../bukti/platform/A07-1-kuota-penuh.png) | **LULUS** |
| A07b | BE | Paksa `POST /admin/companies` saat kuota penuh — *tombolnya disabled, jadi hanya HTTP yang bisa membuktikan penegakan di server* | Ditolak di server: `hasReachedCompanyQuota()` mengembalikan `withErrors`. DB: baris `qcdempat` tidak pernah dibuat, database `tenant_qcdempat` tidak ada | — (BE) | **LULUS** |
| A08 | BE | Dari `qcdsatu`, sentuh pengguna id 4 yang hanya anggota `qcddua`: `PUT`, `DELETE`, `bulk-delete`, lalu hapus diri sendiri | `PUT` 404, `DELETE` 404, `bulk-delete` tidak menghapus apa pun, hapus-diri ditolak. DB: keempat pengguna utuh, nama "QC Orang Luar" tidak berubah | [daftar](../bukti/platform/A08-1-users-qcdsatu.png) | **LULUS** |
| A09 | FE+BE | Kartu statistik `/admin/users` harus sama cakupan dengan daftarnya | `qcdsatu` 3/3/1 admin/1 FM untuk 3 baris; `qcddua` 3/3/2 admin/1 FM untuk 3 baris; `qcdtiga` 1/1/1/0 untuk 1 baris. Tidak ada angka yang membocorkan perusahaan lain | [satu](../bukti/platform/A09-qcdsatu-stats.png), [dua](../bukti/platform/A09-qcddua-stats.png), [tiga](../bukti/platform/A09-qcdtiga-stats.png) | **LULUS** |
| A10 | FE+BE | Parameter grafik ngawur: `chart_period=HACK`, `chart_account=999999`, tanggal `2099-13-45`, `chart_account=1'+OR+1=1--` | Keempatnya **200** dan jatuh ke nilai bawaan — halaman ringkasan tidak pernah mati karena parameter, sesuai `DashboardChartRequest::failedValidation()` yang sengaja no-op | [A10](../bukti/platform/A10-parameter-ngawur.png) | **LULUS** |
| A11 | FE+BE | Hitungan "N user" per peran di `/permissions` | **GAGAL — hitungan sistem-wide.** `qcdtiga` yang hanya punya 1 anggota tetap menampilkan "Admin · 6 user". Angka 6 persis sama dengan jumlah seluruh baris `model_has_roles` berperan admin — termasuk `qcd-org2@qc.test` yang ada di **organisasi lain**. `Role::withCount('users')` tidak menyaring `company_id` | [qcdsatu](../bukti/platform/A11-permissions-qcdsatu.png), [qcdtiga](../bukti/platform/A11-permissions-qcdtiga.png) | **GAGAL** |
| A12 | FE+BE | Staff (ditolak 403 di `/settings/pdf-templates`) memakai route sandbox `template-builder-test` | **GAGAL — staff menimpa template resmi perusahaan.** `POST /c/qcdsatu/template-builder-test` 200: baris template default berubah nama "Invoice Resmi QCD" → "Sandbox" dan layout kop surat diganti isi penyerang, `is_default` tetap 1. `GET …/template-builder-test/pdf` juga 200. Hanya route GET halamannya yang sudah dialihkan dan ikut 403 | [403 pintu depan](../bukti/platform/A12-1-staff-ditolak-pdf-templates.png), [pengalihan GET](../bukti/platform/A12-2-sandbox-redirect.png) | **GAGAL** |
| A13 | FE+BE | Staff mengklik "Profil perusahaan" di menu akun | **GAGAL — tautan mati.** Item menu selalu tampil tanpa memeriksa izin; staff mendarat di halaman 403 | [A13](../bukti/platform/A13-staff-profil-perusahaan.png) | **GAGAL** |
| A14a | FE+BE | Buat pengguna dengan sandi 3 huruf | Ditolak: "Kata sandi minimal 8 karakter." | [isi](../bukti/platform/A14-1-sandi-pendek.png), [ditolak](../bukti/platform/A14-2-ditolak-sandi.png) | **LULUS** |
| A14b | FE+BE | Buat pengguna dengan email yang sudah dipakai | Ditolak: "Email sudah digunakan." | [A14b](../bukti/platform/A14-3-email-ganda.png) | **LULUS** |
| A15 | FE+BE | Drawer "Lihat semua notifikasi" di `qcddua` | Hanya memuat `D1`–`D3` + `GLOBAL`; `S1`/`S2` milik `qcdsatu` tidak ada | [A15](../bukti/platform/A15-drawer-qcddua.png) | **LULUS** |
| A16 | FE | Penanda perusahaan aktif pada kerangka aplikasi | **GAGAL — tidak ada.** Sidebar selalu "Kisantra Finance / Finance Management" dengan logo Kisantra (hardcode di `resources/js/layouts/sidebar.tsx:272-281`), breadcrumb hanya nama halaman, chip akun hanya nama + peran. Satu-satunya petunjuk perusahaan aktif adalah URL atau membuka menu akun — padahal pengguna multi-perusahaan berpindah database tanpa isyarat visual apa pun | [qcdsatu](../bukti/platform/N02-dashboard-satu.png), [qcddua](../bukti/platform/N15-pindah-ke-qcddua.png) | **GAGAL** |
| A17 | FE+BE | Profil perusahaan perusahaan yang baru di-provision | **GAGAL — tidak bisa disimpan sejak hari pertama.** `TenantDatabaseSeeder` mengisi `email => '-'`, sementara `UpdateCompanyRequest` mewajibkan `email`. Validasi bawaan peramban menolak submit ("Please include an '@' …") dan, kalau kolom itu di luar layar, klik "Simpan Perubahan" tampak tidak melakukan apa-apa. Berlaku untuk **setiap** perusahaan baru | [A17](../bukti/platform/A17-email-seed-tidak-valid.png) | **GAGAL** |
| A18 | BE | Peran tertinggal setelah keanggotaan dicabut | **GAGAL.** `qcd-staff@qc.test` kini anggota `qcdsatu` saja, tetapi `model_has_roles` masih menyimpan `staff @ qcddua`. `terapkanKeanggotaan()` memberi peran ke perusahaan yang dipilih, tidak pernah mencabut peran dari perusahaan yang dilepas. Akibat: ikut menggelembungkan hitungan A11, dan siapa pun yang kelak menambahkan orang itu kembali tanpa menyetel peran langsung mendapatkan peran lamanya | — (BE) | **GAGAL** |

---

## C — berantai (lintas aktor / lintas modul)

| ID | Lapisan | Kasus | Hasil nyata | Bukti | Status |
|---|---|---|---|---|---|
| C01 | FE+BE | **Tugaskan pengguna lama ke DUA perusahaan lewat panel baru.** Admin di `qcdsatu` menyunting `QC Staff` (semula `qcdsatu` saja) dan mencentang `PT Dua QCD` | "Pengguna berhasil diperbarui.", daftar menampilkan dua lencana perusahaan. DB membuktikan keduanya: `company_user` berisi `qcdsatu` + `qcddua`, **dan** `model_has_roles` berisi `staff@qcdsatu` + `staff@qcddua` — anggota **dengan** peran, bukan anggota kosong | [sebelum](../bukti/platform/C01-1-daftar-sebelum.png), [dialog](../bukti/platform/C01-2-dialog-edit-sebelum.png), [dicentang](../bukti/platform/C01-3-dua-perusahaan-dicentang.png), [simpan](../bukti/platform/C01-4-setelah-simpan.png), [daftar](../bukti/platform/C01-5-daftar-sesudah.png) | **LULUS** |
| C02 | FE+BE | **Lonceng vs drawer harus menunjukkan jumlah yang SAMA** | `qcdsatu`: lonceng `3` dan panelnya memuat `S1 S2 GLOBAL`; drawer `unread_count=3`, item `["S1","S2","GLOBAL"]`. `qcddua`: lonceng `4`, panel `D1 D2 D3 GLOBAL`; drawer `4`, item sama. Identik di kedua perusahaan, tanpa satu pun notifikasi perusahaan lain | [qcdsatu](../bukti/platform/C02-qcdsatu-1-lonceng.png), [qcddua](../bukti/platform/C02-qcddua-1-lonceng.png) | **LULUS** |
| C03 | FE+BE | Baca satu, lalu "Tandai semua" di `qcdsatu` | Baca `S1` → lencana 3→2. "Tandai semua" → lencana hilang. Pindah ke `qcddua` → lencana `3`, `D1`–`D3` tetap belum dibaca (yang berkurang hanya `GLOBAL`, yang memang `company_id = NULL` dan sengaja dibagi) | [drawer](../bukti/platform/C03-1-drawer-qcdsatu.png), [baca satu](../bukti/platform/C03-2-setelah-baca-satu.png), [kosong](../bukti/platform/C03-3-qcdsatu-kosong.png), [qcddua utuh](../bukti/platform/C03-4-qcddua-tidak-ikut.png) | **LULUS** |
| C04 | FE+BE | Staff kirim feedback di `qcdsatu`, orang luar kirim di `qcddua`, admin membaca keduanya | Tiap perusahaan hanya menampilkan miliknya, kartu statistik `Total 1` di kedua sisi — daftar maupun angkanya tidak bocor | [form](../bukti/platform/C04-1-form-feedback-staff.png), [terkirim](../bukti/platform/C04-2-feedback-terkirim.png), [qcdsatu](../bukti/platform/C04-3-daftar-qcdsatu.png), [qcddua](../bukti/platform/C04-3-daftar-qcddua.png) | **LULUS** |
| C05 | FE+BE | Admin menanggapi feedback; notifikasi harus sampai ke pengaju saja | "Tanggapan terkirim.", status `open → in_progress`, `responded_by=1`. Notifikasi: feedback `qcdsatu` memberi tahu user 1 & 2 (anggota `qcdsatu`) dan **bukan** user 4; feedback `qcddua` memberi tahu 1, 2, 4 dan **bukan** user 3; tanggapan memberi tahu user 3 dengan `company_id=qcdsatu`. Feedback `qcddua` tidak tersentuh | [detail](../bukti/platform/C05-2-detail.png), [form](../bukti/platform/C05-3-form-tanggapan.png), [hasil](../bukti/platform/C05-4-setelah-tanggap.png) | **LULUS** |
| C06 | FE+BE | **Buat perusahaan baru dari `/admin/companies`** | `PT Tiga QCD` / `qcdtiga` jadi dalam <25 detik. DB: `tenant_qcdtiga` ada, **22 tabel**, **52 migrasi** tercatat, master data terisi (**28 kategori transaksi**, 1 `company_profiles` bersingkatan `TGD`), status `active`, kuota naik 2/10 → 3/10, pembuat otomatis jadi anggota + admin | [sebelum](../bukti/platform/C06-1-daftar-sebelum.png), [form](../bukti/platform/C06-2-form-terisi.png), [jadi](../bukti/platform/C06-3-setelah-buat.png), [daftar](../bukti/platform/C06-4-daftar-sesudah.png), [dashboard](../bukti/platform/C06-5-dashboard-baru.png), [klien](../bukti/platform/C06-6-clients-baru.png) | **LULUS** |
| C07 | FE+BE | Perusahaan baru langsung dipakai bertransaksi | Klien `PT Klien Tiga` dibuat lewat UI → "Klien berhasil ditambahkan.". DB: baris ada di `tenant_qcdtiga.clients`, dan `tenant_qcdsatu.clients` **tetap 0** — tidak ada rembesan | [form](../bukti/platform/C07-1-form-klien.png), [isi](../bukti/platform/C07-2-klien-terisi.png), [tersimpan](../bukti/platform/C07-3-klien-tersimpan.png) | **LULUS** |
| C08 | FE+BE | Provisioning gagal → status `failed` → Coba Ulang. *Digagalkan dengan sengaja: database `tenant_qcdgagal` dibuat lebih dulu* | Pesan yang benar muncul ("Provisioning gagal di tengah jalan — … gunakan tombol Coba Ulang"), baris berstatus `failed`, tombol Coba Ulang tersedia. Setelah retry: DB basi di-DROP, provisioning diulang penuh (22 tabel, 28 kategori), status `active`, `/c/qcdgagal/dashboard` 200 | [gagal](../bukti/platform/C08-1-provisioning-gagal.png), [status failed](../bukti/platform/C08-2-daftar-status-failed.png), [retry](../bukti/platform/C08-3-setelah-retry.png), [daftar](../bukti/platform/C08-4-daftar-setelah-retry.png), [dashboard](../bukti/platform/C08-5-dashboard-setelah-retry.png) | **LULUS** |
| C09 | FE+BE | **Penomoran invoice: berubah, dan per perusahaan** | Pola `qcdsatu` diubah `{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}` → `QCD-{THN}-{BLN}-{NO}`, pratinjau langsung `QCD-2026-11-001`, "Format penomoran disimpan.". `tenant_qcddua.company_profiles` tetap memakai pola bawaan — pengaturan benar-benar per perusahaan karena tersimpan di `company_profiles` masing-masing tenant | [qcddua sebelum](../bukti/platform/C09-0-qcddua-sebelum.png), [qcdsatu sebelum](../bukti/platform/C09-1-sebelum-ubah.png), [pola baru](../bukti/platform/C09-2-pola-baru.png), [tersimpan](../bukti/platform/C09-3-tersimpan.png), [qcddua sesudah](../bukti/platform/C09-4-qcddua-sesudah.png) | **LULUS** |
| C09b | FE+BE | Terbitkan invoice di `qcdsatu` setelah pola diubah | Draft dibuat lewat UI, lalu dikirim → flash **"Invoice diterbitkan: QCD-2026-11-001"**. DB `tenant_qcdsatu.invoices`: `invoice_number = QCD-2026-11-001`, `invoice_sequence = 1`, `status = sent` — nomor yang terbit benar-benar mengikuti pengaturan baru | [form](../bukti/platform/C09b-1-form-invoice.png), [isi](../bukti/platform/C09b-2-invoice-terisi.png), [draft](../bukti/platform/C09b-3-invoice-tersimpan.png), [daftar](../bukti/platform/C09c-1-daftar-draft.png), [detail](../bukti/platform/C09c-2-detail-draft.png), [konfirmasi](../bukti/platform/C09c-3-konfirmasi.png), [kirim](../bukti/platform/C09c-4-setelah-kirim.png), [nomor](../bukti/platform/C09c-5-nomor-terbit.png) | **LULUS** |
| C11 | FE+BE | Matikan `view clients` pada peran Staff dari `qcdsatu`, lalu periksa `qcddua` | Ikut mati di `qcddua`. **Ini SESUAI DESAIN** — `docs/module/admin-users-permissions.md:20` menyatakan "Role bersifat GLOBAL (`roles.company_id = NULL`) — definisi role & permission sama untuk semua perusahaan". Dicatat sebagai risiko radius ledakan, bukan cacat: lihat Temuan 7 | [staff](../bukti/platform/C11-0-peran-staff-terpilih.png), [dimatikan](../bukti/platform/C11-1-setelah-matikan.png), [qcddua ikut](../bukti/platform/C11-2-qcddua-ikut-berubah.png) | **CATATAN** |
| C12 | FE+BE | Buat pengguna **baru** langsung ke dua perusahaan | "Pengguna berhasil ditambahkan.", baris menampilkan dua lencana. DB: anggota `qcdsatu` + `qcddua`, peran `finance manager` di **kedua** team | [form](../bukti/platform/C12-1-form-lengkap.png), [jadi](../bukti/platform/C12-2-pengguna-dibuat.png), [daftar](../bukti/platform/C12-3-daftar.png) | **LULUS** |
| C13 | FE+BE | Pengguna hasil C12 benar-benar **bisa berbuat** di kedua perusahaan | Login → pemilih dengan 2 kartu; di `qcdsatu` dan `qcddua` sama-sama bisa membuka `/clients` (200), melihat tombol tambah, dan **membuat klien** ("Klien berhasil ditambahkan."). Membuktikan perannya nyata, bukan sekadar keanggotaan | [pemilih](../bukti/platform/C13-1-pemilih-dua-perusahaan.png), [qcdsatu](../bukti/platform/C13-2-qcdsatu-berbuat.png), [qcddua](../bukti/platform/C13-2-qcddua-berbuat.png) | **LULUS** |

---

## Temuan

Diurutkan dari yang paling berbahaya.

### 1. Staff bisa merusak template PDF resmi lewat route sandbox — MEMBLOKIR (A12)

`routes/web.php:172-174` menyisakan dua route sandbox **tanpa gate izin apa pun**:

```php
Route::post('/template-builder-test', [TemplateBuilderController::class, 'save']);
Route::get('/template-builder-test/pdf', [TemplateBuilderController::class, 'pdf']);
```

`TemplateBuilderController::save()` melakukan `PdfTemplate::query()->firstOrNew([])` —
mengambil baris template **pertama** di database tenant, menimpa `name` menjadi
"Sandbox", dan mengganti seluruh `layout` dengan isi kiriman.

Terbukti: akun staff yang dijawab **403** di `/settings/pdf-templates` berhasil
mengganti template default `Invoice Resmi QCD` (berisi kop surat) menjadi
`Sandbox` berisi teks "DIRUSAK OLEH STAFF", dengan `is_default` tetap `1`.
Invoice berikutnya akan dicetak dengan template itu.

**Jawaban atas pertanyaan spec:** route GET halamannya sudah betul — sudah
dialihkan ke `settings.pdf-templates.index` dan ikut 403 untuk staff. Yang masih
hidup adalah dua route saudaranya, dipertahankan "for test backward-compat"
menurut komentarnya. Keduanya **tidak layak ada di produksi**; kalau test memang
bergantung padanya, test-nya yang sebaiknya dipindah ke `/settings/pdf-templates/*`.

### 2. Profil Perusahaan tidak bisa disimpan lewat UI — MEMBLOKIR (N29)

Form di `resources/js/pages/settings/company.tsx:119` mengirim
`POST /settings/company`, tanpa prefiks `/c/{slug}` → **405 Method Not Allowed**,
tanpa flash apa pun. Halaman ini satu-satunya tempat mengatur identitas yang
tercetak di setiap PDF invoice (nama, NPWP, PKP, logo, tanda tangan, stempel).

Sisi server tidak bersalah: `POST /c/qcdsatu/settings/company` lewat `fetch`
menjawab **200** dan baris `company_profiles` benar-benar berubah.

Pembeda yang sudah dipersempit — dalam **satu konteks JavaScript yang sama**
(navigasi dalam aplikasi, tanpa muat ulang di antaranya):

| halaman | yang dikirim |
|---|---|
| `/clients` (`post(companyUrl('/clients'))`) | `POST /c/qcdsatu/clients` ✓ |
| `/settings/company` (`post(companyUrl('/settings/company'))`) | `POST /settings/company` ✗ |

Jadi ini bukan sekadar state modul `@/lib/company` yang hilang — kalau begitu,
`/clients` akan ikut gagal. Bug-nya spesifik halaman ini.

**Peringatan kejujuran:** seluruh pengujian ini berjalan dengan `public/hot`
hadir (lihat bagian Catatan lingkungan). Saya tidak diizinkan `npm run build`
maupun menghapus berkas itu, jadi saya **tidak bisa memastikan** apakah temuan
ini bertahan di aset hasil build. Mohon diverifikasi ulang tanpa dev server
sebelum diperlakukan sebagai bug kode.

### 3. Payload slug luar organisasi mengosongkan seluruh keanggotaan — TINGGI (A02b)

Batas organisasinya sendiri **tegak** (A02 lulus): `perusahaanSeorganisasi()`
menyaring habis slug asing, dan pengguna tidak pernah menjadi anggota perusahaan
organisasi lain. Masalahnya ada pada apa yang tersisa setelah penyaringan.

`UserController::terapkanKeanggotaan()` menghitung
`array_intersect($slugDipilih, $diizinkan)`. Kalau semua slug yang dikirim di
luar organisasi, irisannya **kosong**, lalu `sync([])` mencabut seluruh
keanggotaan — dan jawabannya tetap "Pengguna berhasil diperbarui."

`StoreUserRequest` sudah punya aturan `'companies' => ['sometimes','array','min:1']`
dengan komentar yang menyatakan maksudnya persis: *"pengguna tanpa satu pun
perusahaan tidak bisa membuka apa pun dan hanya menimbulkan laporan 'akun saya
rusak'"*. Aturan itu dilewati karena pengosongan terjadi **setelah** validasi.
Pengguna korbannya jatuh ke keadaan A04 — bisa login, tidak bisa membuka apa pun.

### 4. Hitungan "N user" di `/permissions` dihitung lintas organisasi — SEDANG (A11)

`Role::withCount('users')` tidak menyaring `company_id`. Di `qcdtiga` yang hanya
punya satu anggota, kartu peran tetap menampilkan "Admin · 6 user" — angka yang
mencakup seluruh perusahaan di seluruh organisasi, termasuk pengguna organisasi
2 yang tidak ada hubungannya. Bocoran agregat (tanpa nama), tetapi angkanya
tampil di dalam halaman per-perusahaan seolah menggambarkan perusahaan itu.
Bandingkan `/admin/users` yang sudah benar (A09).

### 5. `markAsRead` notifikasi tidak bercakupan perusahaan — RENDAH (A05)

`NotificationController::markAsRead()` hanya memeriksa `user_id`.
`markAllAsRead()` dan kedua pembacanya memakai `forCurrentCompany()`; yang satu
ini tidak. Dampaknya kecil — yang bisa disentuh hanya notifikasi milik sendiri,
tidak ada data orang lain yang terbaca — tetapi ia satu-satunya **penulisan ke
tabel pusat tanpa cakupan perusahaan** yang saya temukan, dan karena itu pantas
ditutup bersama tiga kebocoran sebelumnya.

### 6. Peran tertinggal setelah keanggotaan dicabut — RENDAH (A18)

`terapkanKeanggotaan()` memberi peran ke setiap perusahaan yang dipilih, tetapi
tidak pernah mencabut peran dari perusahaan yang dilepas. `qcd-staff@qc.test`
kini anggota `qcdsatu` saja namun masih memegang `staff @ qcddua` di
`model_has_roles`. Ia ikut menggelembungkan hitungan Temuan 4, dan membuat
penambahan kembali di masa depan diam-diam memulihkan peran lama.

### 7. `/permissions` adalah kendali sistem-wide yang tampak per-perusahaan — RISIKO DESAIN (C11)

Mematikan `view clients` untuk peran Staff dari `qcdsatu` mematikannya juga di
`qcddua` — dan, dengan mekanisme yang sama, di setiap perusahaan setiap
organisasi. Ini **sesuai dokumentasi** (`docs/module/admin-users-permissions.md:20`:
role global, assignment per perusahaan), jadi bukan cacat.

Yang mengkhawatirkan adalah penyajiannya: halaman itu berada di dalam URL
`/c/{company}/admin/permissions`, di antara menu per-perusahaan, tanpa satu
kalimat pun yang memberi tahu bahwa perubahan di sana berlaku untuk semua
penyewa. Pemegang `manage permissions` di satu perusahaan kecil dapat mencabut
izin, menghapus permission, atau menghapus peran bagi seluruh sistem. Minimal
perlu peringatan eksplisit di halaman itu; idealnya izin ini disediakan terpisah
untuk pemilik platform, bukan untuk admin perusahaan.

### 8. Profil perusahaan baru tidak bisa disimpan sejak hari pertama — SEDANG (A17)

`TenantDatabaseSeeder` mengisi `email => '-'`, `phone => '-'`, `address => '-'`,
`finance_manager_name => '-'`. `UpdateCompanyRequest` mewajibkan
`'email' => ['required','email']`. Akibatnya setiap perusahaan yang baru
di-provision membawa nilai yang tidak akan pernah lolos validasi, dan peramban
memblokir submit lebih dulu dengan tooltip native. Kalau kolom email berada di
luar layar, tombol "Simpan Perubahan" tampak tidak melakukan apa-apa. (Dengan
Temuan 2 masih terbuka, halaman ini gagal dua kali berturut-turut.)

### 9. Tidak ada penanda perusahaan aktif di kerangka aplikasi — SEDANG (A16)

Sidebar selalu menampilkan "Kisantra Finance / Finance Management" + logo
Kisantra (hardcode, `resources/js/layouts/sidebar.tsx:272-281`). Breadcrumb hanya
nama halaman; chip akun hanya nama + peran. Satu-satunya cara tahu sedang berada
di perusahaan mana adalah membaca URL atau membuka menu akun. Untuk pengguna
yang bekerja di dua perusahaan — kasus yang panel penugasan ini justru ciptakan —
tidak ada isyarat visual bahwa mereka baru saja berpindah database. Di aplikasi
yang menerbitkan invoice dan mencatat pembayaran, memasukkan data ke perusahaan
yang salah adalah kesalahan mahal dan mudah terjadi.

### 10. Tautan mati "Profil perusahaan" untuk staff — RENDAH (A13)

Item menu akun ditampilkan tanpa memeriksa `manage company profile`; staff yang
mengkliknya mendarat di halaman 403. Bandingkan sidebar, yang sudah menyaring
menu berdasarkan izin.

---

## Yang tidak sempat diuji

| area | alasan |
|---|---|
| Editor template PDF (kanvas WYSIWYG, drag-drop elemen, render PDF) | Hanya pembuatan + pencatatan DB-nya yang diuji; kanvas interaktifnya belum. Worker lain memiliki konteks template builder |
| Unggah font `.ttf` (`custom-fonts.store`), beserta validasi mimetype/ukuran | Perlu berkas font nyata; belum disiapkan |
| Unggah aset profil perusahaan (logo, kop surat, tanda tangan, stempel) + penghapusannya | Terblokir oleh Temuan 2 — form-nya tidak bisa disubmit sama sekali |
| CRUD peran (`roles.store/update/destroy`) dan hapus permission | Sengaja tidak dijalankan: Temuan 7 menunjukkan operasi ini sistem-wide, dan menghapus peran di lingkungan bersama berisiko. Dampaknya sudah terbukti lewat C11 yang reversibel |
| `notifications.index` paginasi ("muat lebih banyak") | Fixture hanya 6 notifikasi, di bawah 1 halaman |
| Pengalihan bahasa (`/language`, id/en/zh) | Di luar daftar cakupan spec |
| Reset kuota organisasi di atas 10, dan provisioning 10+ perusahaan | Setiap provisioning ±25 detik; penegakan kuota sudah terbukti di A07/A07b dengan kuota diturunkan ke 3 |

---

## Catatan lingkungan (dilaporkan terbuka)

1. **`public/hot` ADA selama seluruh pengujian.** Berkas bertanggal 12.54 hari
   ini (sebelum lingkungan QC-D dibuat pukul 15.37), isinya `http://[::1]:5174`,
   dan dev server Vite di port itu memang melayani modul. Sesuai PENGARAHAN §1.6
   saya **tidak menghapusnya** dan tidak menjalankan `npm run build`. Halaman
   ter-render normal dan 40+ kasus lulus, jadi dampaknya terbatas — tetapi
   Temuan 2 perlu diverifikasi ulang terhadap aset hasil build. Saya memeriksa
   bahwa dev server menyajikan **sumber terkini** (`companyUrl("/settings/company")`
   ada di modul yang dikirimnya), jadi ini bukan kasus dev server basi.
2. **Sisa fixture yang perlu dibersihkan manual** — di luar pola `--hapus`:
   database `tenant_qcdtiga`, `tenant_qcdgagal`, dan baris `companies`
   `qcdtiga`/`qcdgagal`/`qcdlain` beserta organisasi `Grup QC LAIN` (id 2) dan
   pengguna `qcd-org2@qc.test`, `qcd-baru@qc.test`.
3. **Kegagalan perkakas saya sendiri, bukan cacat aplikasi** (dicatat terpisah
   sesuai PENGARAHAN §6): regex `waitForURL` yang ikut cocok dengan `/login`
   sehingga tangkapan layar pertama salah halaman; token CSRF diambil dari
   `document.cookie` sehingga tiga permintaan HTTP awal dijawab 419; pengisian
   `input` berdasarkan indeks yang mengenai kotak pencarian di belakang dialog;
   `waitUntil: 'networkidle'` pada `/panduan` yang tidak pernah tercapai karena
   halaman itu memuat MP4. Semuanya diperbaiki dan kasusnya dijalankan ulang.
4. **Akun `qcd-fm@qc.test`** sempat diganti sandi dan namanya oleh N24/N25, lalu
   dikembalikan ke `QcUji#2026` / "QC Finance Manager".

---

## Papan skor

Dihitung dengan program dari tabel di halaman ini (`D:/tmp/qa-tools/qcd/hitung.py`),
yang juga memverifikasi bahwa setiap tautan bukti benar-benar ada.

| | jumlah |
|---|---|
| **Kasus dijalankan** | **62** |
| Lulus | 51 |
| Gagal | 9 |
| Catatan (bukan lulus/gagal) | 2 |
| Tidak dijalankan | 0 |

Gagal: `N29`, `A02b`, `A05`, `A11`, `A12`, `A13`, `A16`, `A17`, `A18`.
Catatan: `N12` (koreksi premis spec), `C11` (sesuai desain, risiko dicatat).

Tangkapan layar: 118 berkas di `docs/qa/bukti/platform/`, seluruhnya tertaut dari
tabel di atas. Cara saya memeriksanya, supaya jelas batasnya: setiap kasus
diverifikasi dari **teks halaman yang terbaca program** (judul `h1`, isi `main`,
teks flash, URL akhir, status HTTP) — itulah yang menjadi kolom "Hasil nyata", dan
itulah yang menangkap "otomasi buta memotret layar yang salah". Yang saya buka dan
**lihat sendiri** adalah tangkapan untuk setiap temuan dan setiap klaim visual
(N01, N02, N15, N18, N20, N21, N27, A04, A12, A16, A17, N29, C04), bukan seluruh
118 berkas.

**Terverifikasi dengan dijalankan:** seluruh baris `FE` dan `FE+BE` (UI sungguhan),
serta seluruh baris `BE` (HTTP nyata dari sesi yang login). Setiap klaim tentang
status, keanggotaan, peran, nomor invoice, dan isi tabel dicocokkan ke database
yang bersangkutan dengan query langsung.

**Terverifikasi dengan membaca kode (tanpa dijalankan):** hanya penjelasan *sebab*
pada bagian Temuan (mis. baris `Role::withCount('users')`, aturan
`companies => min:1`, isi `TenantDatabaseSeeder`). Gejalanya sendiri selalu
dijalankan lebih dulu.

### Delapan hal yang WAJIB dibuktikan — hasilnya

| # | yang diminta | hasil |
|---|---|---|
| 1 | Penugasan satu pengguna ke dua perusahaan, anggota **dan** berperan di keduanya | **TERBUKTI** — C01 (pengguna lama), C12 (pengguna baru), C13 (benar-benar bisa berbuat di keduanya) |
| 2 | Admin tidak bisa menugaskan ke perusahaan organisasi lain, meski lewat HTTP | **TERBUKTI** — A02. Tetapi menemukan efek samping: payload yang seluruhnya di luar organisasi mengosongkan keanggotaan (A02b, Temuan 3) |
| 3 | Admin tidak bisa mengunci dirinya sendiri | **TERBUKTI** — A03 (HTTP) dan A03b (UI) |
| 4 | Tabel pusat hanya menampilkan milik perusahaan aktif; tidak ada kebocoran keempat | **Tidak ada kebocoran BACA keempat.** `/admin/users` (A08, A09), feedback (C04, A06), notifikasi (C02, C03, A15) semuanya bersih, daftar maupun angka statistiknya. Yang ditemukan adalah satu **penulisan** tanpa cakupan (A05) dan satu **hitungan agregat** lintas organisasi di `/permissions` (A11) |
| 5 | Lonceng dan drawer menunjukkan jumlah yang sama | **TERBUKTI** — C02, sama persis di kedua perusahaan, isi daftarnya juga identik |
| 6 | Perusahaan baru dari UI benar-benar ter-provisioning dan langsung dipakai; kuota diuji | **TERBUKTI** — C06 (22 tabel, 52 migrasi, 28 kategori), C07 (bertransaksi, tanpa rembesan), C08 (gagal → retry), A07/A07b (kuota, ditegakkan di server) |
| 7 | Pemilihan perusahaan untuk pengguna 1 / 2 / 0 perusahaan | **TERBUKTI** — N16 (1 perusahaan, langsung), N01+N14 (2 perusahaan, pemilih + pengalih), A04 (0 perusahaan, pesan spesifik, bukan 500 dan bukan "tidak punya izin") |
| 8 | Penomoran invoice benar-benar mengubah nomor berikutnya, dan per perusahaan | **TERBUKTI** — C09 (per perusahaan) dan C09b (invoice terbit sebagai `QCD-2026-11-001`) |

### Dua perhatian khusus — jawabannya

**`template-builder-test`:** ya, ini route sandbox yang tidak seharusnya ada di
produksi. Route GET halamannya sudah dinetralkan (dialihkan ke modul Template
PDF), tetapi `POST /template-builder-test` dan `GET /template-builder-test/pdf`
masih hidup **tanpa gate izin** dan terbukti merusak (Temuan 1). Sesuai instruksi,
tidak saya hapus.

**`/panduan`:** publik sesuai desain, dan **tidak membocorkan data perusahaan
mana pun** (N27). Diperiksa sebagai tamu dan sebagai admin yang sudah login, di
halaman indeks dan di satu halaman modul: nama perusahaan, slug, email akun,
nomor invoice, judul feedback, dan nama klien dari lingkungan QC tidak satu pun
muncul. Ia memakai kerangkanya sendiri (bukan `AppLayout`) dan hanya mengganti
tombol kanan dari "Masuk" menjadi "Buka aplikasi" saat sudah login — persis
seperti yang didokumentasikan.
