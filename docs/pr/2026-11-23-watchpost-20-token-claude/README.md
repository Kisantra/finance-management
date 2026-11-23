# Watchpost #20: token Claude kedaluwarsa tidak lagi tercatat sebagai error

| | |
|---|---|
| Watchpost | [#20](https://watchpost.kisantra.com/errors/20) · tiket [#21](https://watchpost.kisantra.com/tickets/21) |
| Exception | `League\OAuth2\Server\Exception\OAuthServerException`: `The resource owner or authorization server denied the request.` |
| Request | `POST /mcp/keuangan` (koneksi Claude), tanpa user, IP Cloudflare `172.71.…` |
| Jejak | `TokenGuard::getPsrRequestViaBearerToken` → `ResourceServer::validateAuthenticatedRequest` → `BearerTokenValidator.php:121` |
| Rilis produksi | `d542083` |
| Waktu sebenarnya | **2026-11-22 15:31:50 UTC** (23:31 WITA; Watchpost menampilkan `23:31:50+00:00`, lihat "Catatan waktu") |

## Penyebab

`BearerTokenValidator.php:121` (league/oauth2-server 9.4.1, sama di produksi dan `main`) adalah cabang
**"Access token could not be verified"**: token Bearer terbaca sebagai JWT, tetapi gagal salah satu
syarat `LooseValidAt` (masa berlaku) atau `SignedWith` (tanda tangan). Token yang rusak (baris 113)
dan token yang dicabut (baris 132) melempar dari baris lain.

Guard Passport (`TokenGuard`) menangkap exception itu, menjawab **401 + `WWW-Authenticate`**, lalu
tetap memanggil `report($e)`. Karena itu setiap penolakan token masuk ke log dan Watchpost, padahal
pengguna tidak melihat error apa pun: Claude membaca 401, memakai refresh token, lalu mengulang.

Token akses di aplikasi ini berumur **1 jam** (`Passport::tokensExpireIn(CarbonInterval::hour())`).
Claude yang dipakai lagi lebih dari satu jam setelah percakapan terakhir masih mengirim token lama,
dan itulah kejadian yang paling cocok dengan #20. Watchpost hanya menyimpan pesan luar exception,
bukan hint atau exception sebelumnya, jadi dari kejadiannya saja kedaluwarsa dan tanda tangan tidak
cocok tidak bisa dibedakan. Tanda tangan tidak cocok berarti pasangan kunci OAuth di server
berubah. `deploy.sh` dan `KunciOAuth` tidak pernah menimpa pasangan yang lengkap, dan rilis
produksi tetap `d542083` dari #18 (17 Nov) sampai #20 (22 Nov), jadi tidak ada deploy di antaranya.
Kunci hanya berubah bila seseorang menjalankan `passport:keys --force` sendiri di server.

**Ini bukan bug yang dialami pengguna.** Yang salah adalah laporannya: alur normal tercatat sebagai
error, membuka tiket, dan bisa menenggelamkan error sungguhan.

## Sebelum

Direproduksi di `main` (`0843316`) dengan alur OAuth yang sama dengan Claude (halaman persetujuan
→ kode PKCE → `/oauth/token`), lalu `POST /mcp/keuangan` dengan token yang sudah habis:

```text
REPORTED League\OAuth2\Server\Exception\OAuthServerException
  message  = The resource owner or authorization server denied the request.
  hint     = Access token could not be verified        ← BearerTokenValidator.php:121
  previous = Lcobucci\JWT\Validation\RequiredConstraintsViolated (The token is expired)
```

Kelas, pesan, dan baris sama persis dengan #20. Dengan klien Watchpost sungguhan (URL dipalsukan
lewat `Http::fake`), **satu laporan terkirim** ke `/api/ingest/errors`. Token yang dicabut dari
Pengaturan › Koneksi Claude juga mengirim satu laporan (hint `Access token has been revoked`).

## Perubahan

1. **`app/Mcp/TokenDitolak.php`** (baru): `wajar(Throwable)` bernilai true hanya untuk
   `OAuthServerException` `access_denied` yang
   - **kedaluwarsa**: exception sebelumnya `RequiredConstraintsViolated` dan **semua**
     pelanggarannya dari `LooseValidAt`, atau
   - **dicabut**: hint `Access token has been revoked` (Cabut di Pengaturan, atau token lama yang
     dicabut saat refresh).
2. **`bootstrap/app.php`**: `$exceptions->dontReportWhen(TokenDitolak::wajar(...))`. Jawaban ke
   Claude tidak berubah (401 + `WWW-Authenticate`); hanya laporannya yang hilang.
3. **Tetap dilaporkan**: tanda tangan tidak cocok dan token rusak atau palsu. Keduanya tidak
   pernah terjadi dalam operasi normal (kunci OAuth berubah, atau token dari server lain).
   Exception OAuth lain tidak tersentuh.
4. Dokumen modul `docs/module/koneksi-claude.md`: baris komponen "Token ditolak", langkah 5 di Alur,
   dan daftar uji.

## Sesudah

| Skenario | Jawaban | Terkirim ke Watchpost (`main`) | Terkirim ke Watchpost (cabang ini) |
|---|---|---|---|
| Token kedaluwarsa | 401 + `WWW-Authenticate` | 1 | **0** |
| Token dicabut dari Pengaturan | 401 + `WWW-Authenticate` | 1 | **0** |
| Tanda tangan tidak cocok | 401 | 1 | 1 (sengaja) |
| Refresh token setelah 401 | token baru, `initialize` 200 | | 200 |

## Uji

`tests/Feature/Mcp/KoneksiClaudeTest.php`, 3 tes baru dengan alur OAuth lengkap:

| Tes | Tanpa perbaikan | Dengan perbaikan |
|---|---|---|
| token kedaluwarsa → 401 + `WWW-Authenticate`, tidak dilaporkan, lalu refresh token menyambung lagi (`initialize` 200) | ⨯ dilaporkan | ✓ |
| token yang dicabut lewat `DELETE /settings/claude/{client}` → 401, tidak dilaporkan | ⨯ dilaporkan | ✓ |
| token dengan tanda tangan tidak cocok → 401, **tetap** dilaporkan | ✓ | ✓ |

JWT diperiksa dengan jam sistem, bukan Carbon, sehingga `travel()` tidak bisa membuat token
kedaluwarsa. Tes menerbitkan token dengan umur -1 menit, lalu mengembalikan umur 1 jam sebelum
refresh.

Suite penuh seperti CI (`./vendor/bin/phpunit`, env dari `.env.example`, `npm run build`,
`passport:keys`): **1.212 tes lulus**, 1 dilewati. Pint bersih.

## Tangkapan layar

Tidak ada. Error ini terjadi di endpoint API yang dipanggil server Claude, bukan di halaman, dan
pengguna tidak melihat apa pun. Bukti ada di keluaran tes di atas.

## Catatan waktu

Watchpost menampilkan `2026-11-22T23:31:50+00:00`, padahal kejadiannya 15:31:50 UTC. Aplikasi
mengirim waktu WITA (`+08:00`) dengan benar; server Watchpost menyimpan jam dindingnya sebagai UTC.
Perbaikannya di repo Watchpost.
