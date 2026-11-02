#!/usr/bin/env bash
# =============================================================================
# Bangun ulang lingkungan QA dua perusahaan (Gerbang 2 multi-tenancy) dari NOL.
#
# Idempoten: menjatuhkan lalu membuat ulang qa_central, tenant_qaalpha,
# tenant_qabeta. Database lain TIDAK PERNAH disentuh.
#
# PENJAGA: skrip menolak berjalan kalau nama database yang akan dijatuhkan
# bukan qa_* / tenant_qa*. Skrip yang bisa menghapus database produksi tidak
# boleh ada, jadi daftar nama di bawah divalidasi sebelum apa pun dijalankan.
#
# Pakai:  bash docs/qa/bangun-dua-perusahaan.sh
# Lalu :  bash docs/qa/bangun-dua-perusahaan.sh --server   (ikut jalankan dev server 8101)
# =============================================================================
set -euo pipefail

CENTRAL_DB="qa_central"
TENANT_DBS=("tenant_qaalpha" "tenant_qabeta")
PORT="8101"

# Isolasi dari worker/sesi lain: cookie sesi + prefix cache tersendiri.
# .env TIDAK diubah — dotenv Laravel tidak menimpa variabel yang sudah ada
# di environment, jadi prefix seperti ini cukup.
export SESSION_COOKIE="qa_d_session"
export CACHE_PREFIX="qa_d_"
export DB_DATABASE="$CENTRAL_DB"

# ---------------------------------------------------------------- PENJAGA
for db in "$CENTRAL_DB" "${TENANT_DBS[@]}"; do
  case "$db" in
    qa_*|tenant_qa*) ;;
    *) echo "TOLAK: '$db' bukan qa_* / tenant_qa*. Skrip dihentikan." >&2; exit 1 ;;
  esac
done
if [ "$CENTRAL_DB" = "finance_main_dev" ] || [ "$CENTRAL_DB" = "finance_management_test" ]; then
  echo "TOLAK: database central menunjuk database non-QA." >&2; exit 1
fi

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
echo "Repo   : $ROOT"
echo "Central: $CENTRAL_DB"
echo "Tenant : ${TENANT_DBS[*]}"
echo

if [ ! -d storage/qa-d ]; then
  echo "FATAL: storage/qa-d/ tidak ada — skrip pembangun PHP-nya ada di sana." >&2
  exit 1
fi

# -------------------------------------------------- 1. database bersih
echo "[1/6] menjatuhkan & membuat ulang database QA"
php storage/qa-d/_dbinit.php

# -------------------------------------------------- 2. storage tenant bersih
echo "[2/6] membersihkan folder storage tenant"
rm -rf storage/tenantqaalpha storage/tenantqabeta
[ -L public/storage ] || php artisan storage:link

# -------------------------------------------------- 3. migrasi central
echo "[3/6] migrasi database central"
php artisan migrate --force --no-ansi | tail -3

# -------------------------------------------------- 4. role + permission
echo "[4/6] seeding role & permission master"
php artisan db:seed --class=MasterPermissionSeeder --force --no-ansi | tail -5

# -------------------------------------------------- 5. perusahaan + data uji
echo "[5/6] organisasi, 2 perusahaan, pengguna, data uji bertanda ALPHA-/BETA-"
php storage/qa-d/bangun.php
php storage/qa-d/mixed-user.php
php storage/qa-d/central.php | tail -12
php storage/qa-d/ids.php > /dev/null
echo "id per tenant -> storage/qa-d/ids.json"

# -------------------------------------------------- 6. daftar route
echo "[6/6] menyimpan daftar route otoritatif"
php artisan route:list --json > storage/qa-d/routes.json
echo "route -> storage/qa-d/routes.json"

cat <<INFO

Selesai. Pengguna (sandi semuanya QaGerbang#2026):
  alpha-admin@qa.test   admin           HANYA qaalpha
  beta-admin@qa.test    admin           HANYA qabeta
  both-manager@qa.test  finance manager qaalpha + qabeta
  alpha-staff@qa.test   staff           HANYA qaalpha
  nobody@qa.test        (tanpa perusahaan)
  mixed-roles@qa.test   finance manager qaalpha, staff qabeta

Jalankan dev server:
  SESSION_COOKIE=qa_d_session CACHE_PREFIX=qa_d_ DB_DATABASE=qa_central \\
    php artisan serve --host=127.0.0.1 --port=$PORT

Lalu rangkaian uji:
  php storage/qa-d/sweep.php      # D.2 matriks + D.3.1 penanda silang
  php storage/qa-d/paksa.php      # D.3.2 akses paksa lintas perusahaan
  php storage/qa-d/kebocoran.php  # D.3.3-D.3.5
  php storage/qa-d/pilih.php      # D.4 pemilihan perusahaan
  php storage/qa-d/tulis.php      # D.5 alur tulis
INFO

if [ "${1:-}" = "--server" ]; then
  echo "menjalankan dev server di 127.0.0.1:$PORT"
  exec php artisan serve --host=127.0.0.1 --port="$PORT"
fi
