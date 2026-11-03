#!/usr/bin/env bash
# Jalankan server untuk satu lingkungan QC.
#
#   bash docs/qa/jalankan-qc.sh <slug> <port>
#
# Dua hal yang WAJIB seperti ini, keduanya sudah pernah memakan waktu:
#
# 1. Server PHP bawaan dipanggil LANGSUNG, bukan lewat `artisan serve`.
#    `artisan serve` membuang hampir semua environment variable sebelum
#    meneruskannya ke proses yang melayani request, jadi APP_ENV tidak sampai
#    dan setiap request memakai `.env` — bukan `.env.qc<slug>`. Gejalanya
#    menipu: server menyala, /login menjawab 200, tetapi halaman perusahaan
#    menjawab 500 dengan nama database yang SALAH di pesan errornya.
#
# 2. Working directory HARUS `public/`. Router bawaan Laravel menentukan lokasi
#    index.php lewat `getcwd()`, bukan flag -t. Dari akar proyek ia mati dengan
#    "Failed opening required index.php".
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

SLUG="${1:?Pakai: bash docs/qa/jalankan-qc.sh <slug> <port>}"
PORT="${2:?port wajib}"
ROUTER="$(pwd)/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"

[ -f ".env.qc${SLUG}" ] || {
  echo "TOLAK: .env.qc${SLUG} tidak ada. Jalankan dulu: bash docs/qa/siapkan-lingkungan-qc.sh ${SLUG} ${PORT}" >&2
  exit 1
}

export APP_ENV="qc${SLUG}"

echo "QC '${SLUG}' -> http://127.0.0.1:${PORT}  (database qc${SLUG}_central)"
echo

cd public
exec php -S "127.0.0.1:${PORT}" -t . "$ROUTER"
