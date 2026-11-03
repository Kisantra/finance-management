#!/usr/bin/env bash
# Jalankan server demo multi-perusahaan di 127.0.0.1:8000.
#
# `.env` Anda TIDAK tersentuh: `php artisan serve` biasa tetap memakai
# finance_main_dev seperti semula. Demo memakai `.env.demo` lewat APP_ENV=demo.
#
# --------------------------------------------------------------------------
# KENAPA TIDAK PAKAI `php artisan serve`
# --------------------------------------------------------------------------
# `artisan serve` menjalankan server PHP bawaan sebagai PROSES ANAK, dan
# ServeCommand menyaring environment yang diteruskan ke anak itu
# (ServeCommand::$passthroughVariables). Di mesin ini PHP memakai
# `variables_order=GPCS` — tanpa huruf `E` — sehingga `$_ENV` KOSONG, penyaring
# itu berperilaku di luar dugaan, dan APP_ENV tidak sampai ke proses yang
# benar-benar melayani request.
#
# Gejalanya menipu: server menyala, `/login` menjawab 200, tetapi setiap halaman
# perusahaan menjawab 500 dengan "Table 'finance_main_dev.companies' doesn't
# exist" — karena request dilayani memakai `.env`, bukan `.env.demo`.
# Dibuktikan dengan probe di dalam proses server: getenv('APP_ENV') = 'local'.
#
# Server PHP bawaan dipanggil langsung di sini, jadi APP_ENV ada di environment
# proses yang SAMA dengan yang melayani request. Tidak ada perantara yang bisa
# membuangnya.
#
# --------------------------------------------------------------------------
# CATATAN: `.env` SEKARANG SUDAH MENUNJUK KE DEMO
# --------------------------------------------------------------------------
# Sejak 2026-11-03, `.env` diarahkan ke `demo_central` supaya `composer run dev`
# dan `php artisan serve` biasa ikut bekerja. Sebelumnya `.env` masih menunjuk
# `finance_main_dev` yang PRA-TENANCY (tidak punya tabel `companies`), sehingga
# setiap login berakhir dengan 500 "Table finance_main_dev.companies doesn't
# exist" — bukan karena fiturnya rusak, tetapi karena database-nya salah.
#
# Jadi skrip ini TIDAK lagi wajib: `composer run dev` sudah cukup. Skrip ini
# tetap berguna kalau Anda mengembalikan `.env` ke finance_main_dev dan hanya
# ingin menjalankan demo sesekali di jendela terpisah.
#
# PENTING saat berpindah branch: `main` belum multi-perusahaan, jadi di sana
# `.env` harus dikembalikan ke `DB_DATABASE=finance_main_dev`. Cadangannya ada
# di `.env.sebelum-demo-*`.
#
# `artisan serve` mengambil snapshot `.env` saat START dan mewariskannya ke
# proses anak — mengubah `.env` TIDAK berpengaruh sampai servernya di-restart.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

PORT="${PORT:-8000}"
# Absolut: servernya dijalankan dengan working directory `public/` (lihat bawah),
# jadi jalur relatif ke akar proyek tidak akan ketemu dari sana.
ROUTER="$(pwd)/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"

[ -f .env.demo ] || {
  echo "TOLAK: .env.demo tidak ada. Jalankan dulu: bash docs/demo/siapkan-demo-lokal.sh" >&2
  exit 1
}
[ -f "$ROUTER" ] || { echo "TOLAK: router '$ROUTER' tidak ada." >&2; exit 1; }

export APP_ENV=demo

cat <<EOF
Demo multi-perusahaan: http://127.0.0.1:${PORT}

  admin@demo.test / Demo#2026          admin, anggota KEDUA perusahaan
  admin@gmail.com / <sandi dev Anda>   user lama, hanya PT Kisantra (Demo)

Tekan Ctrl+C untuk berhenti.

EOF

# Working directory WAJIB `public/`: router bawaan Laravel menentukan lokasi
# index.php lewat `getcwd()`, bukan lewat flag -t. Dijalankan dari akar proyek,
# ia mencari D:/Laravel/finance-management/index.php yang tidak ada, dan setiap
# request mati dengan "Failed opening required index.php". `artisan serve`
# melakukan `cd public` ini diam-diam.
cd public
exec php -S "127.0.0.1:${PORT}" -t . "$ROUTER"
