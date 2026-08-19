# Test Case — Notifications (AppNotification)

Sumber teknis: [`docs/module/notifications.md`](../../module/notifications.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](../README.md).

**Lingkungan**: perusahaan `qa-lima` (DB `tenant_qa-lima`), tabel
`app_notifications` berada di **database pusat `finance_central`** yang dipakai
bersama. Eksekusi HTTP dengan cookie sesi asli + verifikasi database. Bukan
production.

## Data uji

Tabel `app_notifications` **kosong** saat pengujian dimulai (diverifikasi:
`SELECT user_id, COUNT(*) ... GROUP BY user_id` tidak mengembalikan baris).

| Kelompok | Isi | Untuk case |
|---|---|---|
| 45 notifikasi `qa5_seed` milik **user 8** (`qa5-pelapor@qa.test`) | id 1–45, `created_at` berjenjang menit, semua belum dibaca, `data.url` terisi | Pagination kumulatif, bell cap 10 |
| 1 notifikasi `qa5_old` milik user 8 | id 46, `created_at` **40 hari lalu** | Scope `recent(30)` |
| 1 notifikasi `qa5_other` milik **user 9** (`qa5-nodash@qa.test`) | id 47 | Uji kepemilikan lintas user |
| Notifikasi organik hasil modul Feedback | id 48–57 (`feedback_submitted` ke admin id 1 & manager id 2; `feedback_responded` ke staff id 3) | Integrasi antar modul |

Notifikasi sintetis dibuat lewat `AppNotification::notify()` (factory resmi
model), bukan `INSERT` mentah, dan hanya untuk user milik QA sendiri —
notifikasi user lain tidak disentuh.

## A. Kondisi Normal

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| N01 | Shared prop bell: 10 terbaru dari 30 hari terakhir | User 8 membuka halaman apa pun (`/c/qa-lima/cash-flow/expenses`), baca prop `notifications` | `recent` berisi **tepat 10** item terbaru; notifikasi berusia 40 hari **tidak** ikut | BE | `recent_count=10`, id `45,44,43,42,41,40,39,38,37,36` — id 46 (40 hari) tidak ada. Cap 10 dan scope `recent(30)` keduanya bekerja | Pass |
| N02 | Badge unread count | Baca `notifications.unread_count` pada kondisi yang sama | 46 (seluruh notifikasi user 8 belum dibaca, termasuk yang lama) | BE | `unread_count=46` | Pass |
| N03 | Daftar JSON halaman 1 | `GET /c/qa-lima/notifications` (Accept: application/json) | 200; 20 item (default `per_page`), `total=46`, `has_more=true` | BE | `200 items=20 total=46 unread=46 has_more=true first="QA5 Notifikasi #45" last="QA5 Notifikasi #26"` | Pass |
| N04 | **Pagination kumulatif** — `page=2` mengembalikan 40 item pertama | `GET .../notifications?page=2&per_page=20` | **40** item, tetap mulai dari yang terbaru (#45) — bukan item ke-21..40 | BE | `items=40 total=46 has_more=true first="QA5 Notifikasi #45" last="QA5 Notifikasi #6"` — jelas kumulatif ("load more"), bukan offset | Pass |
| N05 | `page=3` menghabiskan daftar | `GET .../notifications?page=3&per_page=20` | 46 item (bukan 60 — dibatasi total), `has_more=false` | BE | `items=46 total=46 has_more=false first="QA5 Notifikasi #45" last="QA5 Notifikasi Lama"` | Pass |
| N06 | Notifikasi lama terlihat di drawer walau tidak di bell | Bandingkan N01 vs N05 | id 46 (`QA5 Notifikasi Lama`) absen di bell tetapi hadir di endpoint index | BE | Bell: tidak ada. Index page 3: hadir sebagai item terakhir | Pass |
| N07 | Tandai satu notifikasi dibaca (milik sendiri) | User 8 `POST /c/qa-lima/notifications/45/read` | 302; `read_at` terisi di DB | FE+BE | 302; DB `id=45 read_at=2026-08-19 14:43:42` | Pass |
| N08 | `markAsRead` idempoten | Ulangi `POST .../notifications/45/read` | 302, `read_at` **tidak** berubah | BE | 302; DB `read_at` tetap `2026-08-19 14:43:42` | Pass |
| N09 | Tandai semua dibaca | User 8 `POST /c/qa-lima/notifications/mark-all-read` | 302; seluruh 46 notifikasi user 8 terbaca; notifikasi user lain tidak tersentuh | FE+BE | 302; DB `user_id=8 total=46 unread=0`, `user_id=9 total=1 unread=1` (tetap belum dibaca) | Pass |
| N10 | Konvensi `data.url` terisi & ber-prefix perusahaan | Periksa `data` seluruh notifikasi organik | Setiap notifikasi membawa `url` yang dapat dinavigasi | BE | Semua 10 notifikasi feedback membawa `{"url": "http://127.0.0.1:8000/c/qa-lima/feedbacks", "feedback_id": N}` — prefix `/c/qa-lima` benar | Pass |
| N11 | Integrasi: feedback baru menotifikasi admin + finance manager | Staff `POST /feedbacks` | Notifikasi `feedback_submitted` ke user role admin & finance manager | BE | Per feedback lahir 2 baris: `user_id=1` (Admin) & `user_id=2` (Manager), `type=feedback_submitted`, pesan `"Staff Demo mengirim Bug Report: QA5 Bug laporan tidak muncul"` | Pass |
| N12 | Integrasi: tanggapan admin menotifikasi **pemilik** feedback | Admin `POST /feedbacks/1/respond` | Notifikasi `feedback_responded` hanya ke pemilik (staff id 3) | BE | Satu baris: `id=54 user_id=3 type=feedback_responded message='Feedback "QA5 Bug laporan (diedit)" telah ditanggapi oleh Admin'` — admin/manager tidak ikut dinotifikasi | Pass |

## B. Kondisi Tidak Normal / Edge Case

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| A01 | **Membaca notifikasi milik orang lain** | User 8 `POST /c/qa-lima/notifications/47/read` (id 47 milik user 9) | **403**; `read_at` tetap NULL | BE | **403**; DB `id=47 user_id=9 read_at=NULL` — tidak berubah | Pass |
| A02 | Admin pun tidak bisa membaca notifikasi user lain | Admin `POST /c/qa-lima/notifications/44/read` (id 44 milik user 8) | 403 — tidak ada pengecualian untuk admin | BE | **403**; DB `id=44 read_at=NULL` | Pass |
| A03 | Notifikasi tidak ada | User 8 `POST /c/qa-lima/notifications/999999/read` | 404, bukan 500 | BE | 404 | Pass |
| A04 | Guest menandai baca | Tanpa sesi `POST /c/qa-lima/notifications/45/read` | Ditolak | BE | **419** (token CSRF/sesi kedaluwarsa) — ditolak sebelum sampai ke controller. Bukan 302 seperti request GET, tetapi tetap aman | Pass |
| A05 | Daftar hanya berisi notifikasi milik sendiri | Bandingkan `total` pada `GET /notifications` untuk user 8 vs staff | User 8: 46; staff: hanya miliknya | BE | User 8 `total=46`; staff `unread_count=2` dengan `recent` id `[55,54]` saja — tidak ada satu pun dari 46 notifikasi user 8 yang bocor | Pass |
| A06 | Badge unread menghitung notifikasi >30 hari yang tidak dapat dijangkau dari bell | Bandingkan `unread_count` (N02) dengan isi `recent` (N01) | Angka badge boleh lebih besar dari isi bell | BE | `unread_count=46` sementara bell hanya menampilkan 10 dan **tidak pernah** dapat menampilkan id 46. Sesuai dokumentasi (drawer yang menanganinya), dicatat sebagai perilaku yang dipahami — bukan kegagalan | Pass |
| A07 | Notifikasi yatim setelah objek rujukannya dihapus | Feedback id 4 dihapus pemiliknya; notifikasi id 56 & 57 masih menunjuk `feedback_id: 4` | Klik notifikasi tidak boleh membuat error | BE | Baris notifikasi tetap ada dengan `data={"url": ".../c/qa-lima/feedbacks", "feedback_id": 4}`. Karena `url` menunjuk halaman indeks (bukan `?show=4`), navigasi tetap aman. Dicatat sebagai catatan kebersihan data, bukan kegagalan | Pass |
| A08 | `cleanupOld()` belum dijadwalkan | Periksa `routes/console.php` | Tidak ada jadwal cleanup | BE | **Belum diuji lewat eksekusi.** Diverifikasi lewat **pembacaan kode/dokumen**: tidak ada `Schedule::call(AppNotification::cleanupOld ...)`; hanya `invoices:notify-due-dates` yang terjadwal. Tabel akan tumbuh tanpa intervensi | Belum diuji |

## C. Alur Berantai

| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| C01 | Rantai lengkap feedback → notifikasi → baca → badge turun | (1) Admin & manager menanggapi 2 feedback milik staff; (2) staff baca prop `notifications`; (3) staff `POST /notifications/54/read`; (4) baca prop lagi; (5) staff `mark-all-read`; (6) baca prop lagi | Badge 2 → 1 → 0 | FE+BE | (2) `unread=2 recent=2 ids=[55,54]`; (3) 302; (4) `unread=1`; (5) 302; (6) `unread=0`. DB akhir: `user_id=3 total=2 unread=0` | Pass |
| C02 | `mark-all-read` tidak menular ke user lain | Setelah C01 selesai, periksa seluruh tabel | Hanya user yang menekan tombol yang notifikasinya terbaca | BE | `user_id=1 total=4 unread=4` · `user_id=2 total=4 unread=4` · `user_id=3 total=2 unread=0` · `user_id=8 total=46 unread=0` · `user_id=9 total=1 unread=1` — dua operasi `mark-all-read` (user 8 dan user 3) hanya mengenai pemiliknya masing-masing | Pass |

## Temuan

Tidak ditemukan cacat pada modul Notifications.

Aturan yang paling rawan — kepemilikan ketat, pagination kumulatif, cap 10 & scope
30 hari pada bell, idempotensi `markAsRead`, dan isolasi `mark-all-read` — semuanya
terbukti ditegakkan **di sisi server**, bukan hanya di UI (A01/A02 diuji dengan
request langsung, persis skenario UI di-bypass).

Dua hal berikut dicatat sebagai **pengamatan**, bukan bug:

1. **A07 — notifikasi yatim.** Menghapus feedback tidak menghapus notifikasi yang menunjuk padanya. Aman hari ini semata karena `data.url` menunjuk halaman indeks; begitu ada notifikasi yang menunjuk `?show={id}`, klik pada notifikasi yatim akan gagal. Layak diantisipasi saat menambah tipe notifikasi baru.
2. **A08 — `cleanupOld()` tidak terjadwal.** Tabel `app_notifications` tumbuh tanpa batas. Selama pengujian singkat ini saja lahir 57 baris; pada pemakaian nyata pertumbuhannya monoton karena tidak ada mekanisme apa pun yang memangkasnya.

## Catatan pelaksanaan

- Seluruh case dieksekusi lewat **request HTTP dengan cookie sesi asli**. Endpoint
  `GET /notifications` dipanggil dengan `Accept: application/json` persis seperti
  yang dilakukan `NotificationDrawer`; shared prop `notifications` dibaca dari
  atribut `<script data-page="app">` persis seperti yang dibaca `NotificationBell`.
- Verifikasi database dilakukan langsung ke `finance_central` untuk setiap
  perubahan `read_at`.
- Notifikasi sintetis dibuat untuk **user milik QA sendiri** (id 8 & 9) agar tidak
  mencampuri data agent lain. Notifikasi milik akun bersama (admin/manager/staff)
  yang muncul di sini semuanya **hasil organik** dari pengujian modul Feedbacks,
  bukan hasil injeksi.
- Pengujian **tidak** menghapus notifikasi milik siapa pun selain user QA sendiri.
- A08 jujur dinyatakan **Belum diuji lewat eksekusi** — diverifikasi lewat
  pembacaan `routes/console.php`, tidak dijalankan.
- Alur UI React (klik bell → popover → drawer → load more) **tidak** diuji lewat
  layar browser; yang diuji adalah kontrak data yang menopangnya (shared prop,
  endpoint JSON, endpoint read). Interaksi visualnya perlu diverifikasi manusia.
- **Pembersihan**: seluruh 47 notifikasi sintetis (`qa5_seed`, `qa5_old`,
  `qa5_other`) beserta user QA (id 8 & 9) dihapus setelah pengujian selesai —
  database pusat dipakai bersama, dan data itu murni noise. Yang **ditinggalkan**
  hanya notifikasi organik hasil modul Feedback (4 untuk admin, 4 untuk manager,
  2 untuk staff) sebagai jejak bukti N11/N12/C01. Untuk mereproduksi N01–N06,
  buat ulang 45 notifikasi + 1 berusia 40 hari untuk satu user lewat
  `AppNotification::notify()`.
