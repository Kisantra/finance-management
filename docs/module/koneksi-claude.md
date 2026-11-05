# Koneksi Claude (MCP, hanya baca)

Pemilik/pengelola keuangan bisa mendiskusikan data perusahaan dengan Claude (claude.ai, Claude
Desktop, Claude di ponsel). Claude memanggil **alat** di aplikasi ini lewat Model Context Protocol
(MCP); semua alat **hanya membaca**. Login memakai OAuth (Laravel Passport): Claude mengarahkan
pengguna ke halaman login aplikasi, pengguna menyetujui, Claude menerima token.

**Panduan pengguna** (cara menghubungkan, contoh pertanyaan, referensi tiap alat dalam bahasa
non-teknis): [`docs/guides/KONEKSI-CLAUDE.md`](../guides/KONEKSI-CLAUDE.md). Perubahan alat
(argumen, isi jawaban, aturan) WAJIB ikut memperbarui panduan itu.

## Komponen

| Bagian | Berkas | Isi |
|--------|--------|-----|
| Rute | `routes/ai.php` (dimuat otomatis laravel/mcp) | `POST /mcp/keuangan` (`auth:api`, `throttle:120,1`) + discovery `/.well-known/oauth-*` + `POST /oauth/register` (pendaftaran klien dinamis, `throttle:20,1`). Semua rute PUSAT (di luar `/c/{company}`). |
| Server | `app/Mcp/Servers/KeuanganServer.php` | Daftar alat + `instructions` (konvensi: panggil `daftar-perusahaan` dulu, rupiah integer, tanggal Y-m-d, paginasi). |
| Penentu akses | `app/Mcp/AksesClaude.php` | Satu-satunya jawaban "boleh membaca": anggota aktif perusahaan + izin `use claude` + izin modul, semuanya **di team perusahaan itu** (Spatie teams). Dipakai alat dan halaman persetujuan. |
| Dasar alat | `app/Mcp/Tools/AlatKeuangan.php` | Validasi `perusahaan`, cek akses, log `mcp.alat`, pasang tenancy + team izin, `jalankan()`, lalu **selalu** memulihkan keduanya di `finally`. Menimpa `annotations()` agar setiap alat mengumumkan `readOnlyHint`. |
| Persetujuan OAuth | `app/Mcp/PersetujuanClaude.php` + `resources/js/pages/oauth/authorize.tsx` | Halaman `GET /oauth/authorize` (Passport). Form Izinkan/Tolak = form HTML biasa (Passport menjawab redirect ke domain Claude). Tombol Izinkan disembunyikan bila tidak ada perusahaan yang boleh dibaca. |
| Pengaturan | `/c/{company}/settings/claude` (lihat [settings.md](settings.md)) | Alamat konektor, cara menghubungkan, status kunci OAuth, sambungan aktif + Cabut. |
| Kunci OAuth | `app/Mcp/KunciOAuth.php` | Membuat pasangan kunci Passport saat pemegang `use claude` (di perusahaan mana pun) membuka Pengaturan › Koneksi Claude: `ada()` (berkas lengkap & tidak kosong, atau `PASSPORT_*_KEY` di env) dan `pastikan()` (`passport:keys --force` di dalam `Cache::lock`, hanya bila pasangan belum lengkap). Status ke halaman: `siap` / `baru` / `gagal` (dicatat di log) / `belum` (pengguna tanpa izin; tidak membuat apa pun). |
| Konfigurasi | `config/auth.php` (guard `api` = passport), `AppServiceProvider` | `passport.connection` = koneksi central; `Passport::loadKeysFrom(storage_path())` mematok kunci ke storage pusat; token akses 1 jam, refresh token 30 hari. |
| Izin | migration `2026_11_05_120000_add_use_claude_permission_to_roles` + `MasterPermissionSeeder` | `use claude`: bawaan admin & finance manager; bisa diubah di Izin & Peran. |

## Alur

1. Admin/FM menambah *custom connector* di Claude dengan URL `https://<domain>/mcp/keuangan`.
2. Claude memanggil server tanpa token → `401` + `WWW-Authenticate` (middleware `AddWwwAuthenticateHeader` dari `Mcp::web`) → Claude membaca `/.well-known/oauth-protected-resource` & `/.well-known/oauth-authorization-server`, mendaftar diri di `/oauth/register`, lalu membuka `/oauth/authorize` (PKCE S256, scope `mcp:use`).
3. Belum login → halaman login aplikasi; `redirect()->intended()` mengembalikan ke persetujuan. Pengguna klik **Izinkan** → Passport mengarahkan kembali ke Claude dengan kode → Claude menukar token di `/oauth/token`.
4. Di chat, Claude memanggil `daftar-perusahaan`, lalu alat lain dengan argumen `perusahaan`.

## Alat

Setiap alat (kecuali `daftar-perusahaan`) mewajibkan argumen `perusahaan` dan izin modul di bawah,
di samping `use claude`. Penolakan memakai satu pesan yang sama untuk "tidak ada", "bukan anggota",
dan "tanpa izin" (keberadaan perusahaan lain tidak dibocorkan).

Semua daftar: `halaman`, maks. 50 baris per halaman; ringkasan/total selalu menghitung SELURUH hasil
filter, bukan hanya halaman itu. Nominal integer rupiah, tanggal Y-m-d, status mentah + label.

| Alat | Izin modul | Argumen | Isi & aturan yang disalin |
|------|-----------|---------|---------------------------|
| `daftar-perusahaan` | (hanya `use claude`) | — | Perusahaan yang boleh dibaca + peran pengguna di sana. |
| `ringkasan-keuangan` | `view dashboard` | `dari`, `sampai` (bawaan bulan ini) | Bagian `kas` (`view bank-accounts`), `pemasukan`/`pengeluaran` (`view income`/`view expense`), `invoice`, `piutang`, `pinjaman`, `reimbursement`, `pengajuan_dana`, masing-masing hanya bila izin modulnya ada; yang disembunyikan disebut di `tidak_ditampilkan`. **Dua definisi "pemasukan"**: `kas.uang_masuk/keluar` = kartu dashboard (semua mutasi rekening, termasuk transfer & pinjaman, `DashboardController`); `pemasukan/pengeluaran` = halaman arus kas (kategori bertipe pemasukan/pengeluaran, `CashFlowController`). |
| `laba-rugi` | `view profit-loss` | `dari`, `sampai` (bawaan 1 Jan s.d. hari ini, sama dengan halaman) | `ProfitLossService::generate()` persis seperti `ProfitLossReportController`; kategori per label; `peringatan` bila ada transaksi belum diklasifikasi (tidak masuk total mana pun). |
| `rekening-bank` | `view bank-accounts` | — | Rekening + saldo terhitung (`BankAccount::withBalance()`). |
| `mutasi-rekening` | `view bank-accounts` | `rekening`, `arah` (masuk/keluar), `kategori` (induk mencakup anak), `kata_kunci`, `dari`, `sampai`, `halaman`, `per_halaman` | Gabungan tab Transaksi + Pembayaran (`BankTransactionController`); saldo awal/akhir; pasangan transfer hanya lewat `transfer_group_id` (tidak menebak baris lama); biaya admin transfer = kaki debit − kaki kredit. |
| `kategori-transaksi` | `view categories` | `jenis` | Pohon kategori (aman dari siklus), `grup_lr`, `kode_sistem`, jumlah belum diklasifikasi. |
| `daftar-invoice` | `view invoices` | `status`, `lewat_tempo`, `klien` (nama/id), `dari`/`sampai` (tanggal terbit), `kata_kunci`, `urut`, `halaman` | Dibayar = SUM pembayaran (alias `jumlah_dibayar`: accessor `amount_paid` meng-query per baris), aturan lewat tempo `InvoiceController`. |
| `detail-invoice` | `view invoices` | `nomor` atau `id` | Item, PPN, pembayaran, `laba`. **Laba mengikuti drawer invoice**: pendapatan = total − PPN − titipan pajak, HPP tanpa item titipan (accessor `gross_profit` menghitung titipan sebagai pendapatan). |
| `daftar-klien` | `view clients` | `kata_kunci`, `jenis`, `status`, `ada_sisa`, `urut` | Ditagih/dibayar/sisa dari pembayaran sungguhan, tanpa draf (berbeda dari kolom "outstanding" halaman Klien yang ikut menghitung draf; deskripsi alat menjelaskannya). EFIN/KPP tidak dikirim. |
| `daftar-layanan` | `view services` | `kata_kunci`, `jenis` | Layanan + ringkasan katalog. |
| `invoice-berulang` | `view recurring-invoices` | `tampilan` (template/bulanan), `status_template`, `bulan` (YYYY-MM), `status` | Template + siklus berikutnya (`next_generation_date` sudah tidak ada; diturunkan dari siklus), draf bulanan & invoice terbitnya. |
| `daftar-reimbursement` | `view reimbursements` | `status`, `dari`/`sampai`, `pemohon`, `kata_kunci`, `halaman` | **Visibilitas**: semua hanya dengan `approve`/`pay reimbursements`; selain itu milik sendiri (`ReimbursementController::canSeeAll`). Keluaran memuat `cakupan`. |
| `daftar-pengajuan-dana` | `view fund requests` | `status`, `dari`/`sampai`, `pemohon`, `kata_kunci`, `halaman` | **Visibilitas**: semua hanya dengan `approve fund requests` (`disburse` saja tetap milik sendiri, sama dengan halaman). |
| `daftar-pinjaman` | `view loans` | `status`, `kata_kunci`, `halaman` | Jadwal angsuran via `JadwalAngsuranService::untukPinjaman()` memakai `withSum` (tanpa query per baris). |
| `daftar-piutang` | `view receivables` | `status`, `jenis`, `debitur`, `halaman` | Debitur User (pusat) / Client (perusahaan): nama dicari di database masing-masing lalu `whereIn` — `whereHas('user')` akan menyisipkan tabel `users` ke query database perusahaan dan gagal di produksi. |

## Invarian (jangan dilanggar)

- **Hanya baca.** Alat tidak boleh menulis, memicu event/notifikasi, atau memanggil metode yang mengubah status (mis. `updateStatus()`).
- **Akses selalu lewat `AksesClaude`**, per team perusahaan. Tanpa team, Spatie menganggap user tidak punya peran (gagal-tertutup); jangan pernah memeriksa izin tanpa memasang team.
- **Tenancy & team selalu dipulihkan di `finally`.** Jangan memakai `Tenant::run()` stancl untuk alat: ia tidak memakai `finally`.
- **Aturan visibilitas baris sama dengan halaman web** (mis. staf hanya melihat pengajuannya sendiri). Alat baru wajib menyalin aturan dari controller modulnya.
- **Tidak mengembalikan rahasia, path storage, atau URL berkas.**
- **Jangan `whereHas`/`join` ke tabel PUSAT (`users`, `companies`) dari query database perusahaan.** Cari id-nya di pusat dulu, lalu `whereIn`. Eager load (`with('user')`) aman karena berjalan sebagai query terpisah di koneksi model. Suite tes memakai satu database sehingga kesalahan ini lolos tes dan baru gagal di produksi.
- **Tidak ada query per baris.** `Model::preventLazyLoading()` aktif di luar produksi; beberapa accessor model (mis. `Invoice::amount_paid`) tetap meng-query per baris walau kolomnya sudah dipilih, jadi tes alat daftar memeriksa jumlah query tetap saat jumlah baris bertambah.
- **Tabel `oauth_*` di database pusat** (`passport.connection`); jangan memindahkannya ke migration tenant.
- **Kunci OAuth di storage pusat, satu pasang per server, tidak pernah ditimpa.** Di dalam `/c/{company}` tenancy mengalihkan `storage_path()` ke `storage/tenant{slug}`; tanpa patok `Passport::loadKeysFrom()` kunci yang dibuat dari halaman Pengaturan tertulis di sana, sementara `/oauth/token` dan `/mcp/keuangan` membaca dari pusat (Claude mendapat 500 "Invalid key supplied"). Kunci baru membatalkan semua sambungan Claude, jadi hanya pasangan yang belum lengkap yang boleh dibuat ulang.

## Deploy

Kunci Passport `storage/oauth-{private,public}.key` dibuat **sekali** bila belum lengkap, lewat dua
jalan yang setara: `deploy.sh` (`ensure_passport_keys`, dipanggil di `refresh_caches` dan
`finalize_caches`, lalu `chmod 600` kunci privat) dan halaman Pengaturan › Koneksi Claude
(`KunciOAuth`, berjalan sebagai user PHP-FPM, yang di CloudPanel sama dengan user situs; Passport
sendiri memasang `chmod 600`). Kunci tidak pernah ditimpa: kunci baru membatalkan semua sambungan Claude. Tabel
OAuth dan izin `use claude` datang lewat `migrate` biasa. PHP produksi wajib punya ekstensi
`sodium` (dipakai `lcobucci/jwt`); PC dev Windows memasang paket dengan
`--ignore-platform-req=ext-sodium` bila `extension=sodium` belum aktif di `php.ini`.

## Pengujian

- `tests/Feature/Mcp/KoneksiClaudeTest.php`: 401 + `WWW-Authenticate` tanpa token, discovery publik, `daftar-perusahaan` hanya yang berizin, penolakan alat, koneksi & team pulih setelah alat, `readOnlyHint`, halaman persetujuan.
- `tests/Feature/Mcp/Alat*Test.php`: isi, filter, penolakan izin, dan aturan visibilitas per alat.
- `tests/Feature/Mcp/PengaturanKoneksiClaudeTest.php`: sambungan aktif per klien, cabut hanya token milik sendiri, 404 untuk klien tanpa token; kunci OAuth dibuat saat halaman dibuka dan tidak ditimpa, pasangan setengah jadi dibuat ulang, kunci env dihormati, kegagalan tidak menjatuhkan halaman (status `gagal` + log), pengguna tanpa izin tidak memicu pembuatan. Kunci ditulis ke folder sementara per test.
- `tests/Tenancy/StoragePerTenantTest.php` (`test_kunci_oauth_tetap_di_storage_pusat_saat_tenancy_aktif`): patok path kunci bertahan saat `FilesystemTenancyBootstrapper` aktif; hanya suite `TenancyReal` yang menjalankan bootstrapper itu.
- **Guard izin:** `User::$guard_name = 'web'`. Di `/mcp/keuangan` middleware `auth:api` menjadikan `api` guard bawaan; tanpa properti itu Spatie mencari izin ber-guard `api` dan setiap cek gagal. Alat yang dipanggil langsung (`KeuanganServer::actingAs`) memakai guard `web`, jadi bug ini hanya tertangkap lewat HTTP + `Passport::actingAs` (`test_lewat_http_dengan_token_passport_izin_tetap_terbaca`) atau uji ujung ke ujung. Ditemukan 5 Nov 2026 saat uji ujung ke ujung di server QA.
- Uji manual: `php artisan mcp:inspector mcp/keuangan` (butuh token Bearer) atau hubungkan Claude ke server QA.
