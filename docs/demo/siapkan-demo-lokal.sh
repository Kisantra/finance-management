#!/usr/bin/env bash
# =============================================================================
# SIAPKAN DEMO MULTI-PERUSAHAAN DI MESIN LOKAL — port 8000
# =============================================================================
#
# Menyiapkan satu instalasi berisi DUA perusahaan supaya fitur multi-perusahaan
# bisa langsung dicoba, tanpa setup manual apa pun.
#
#   PT Utama Demo  (slug: utama)  <- SALINAN database dev Anda, data asli Anda
#   PT Cabang Demo (slug: cabang) <- perusahaan baru dari nol, berisi contoh
#
# `finance_main_dev` HANYA DIBACA (lewat mysqldump) dan TIDAK PERNAH diubah.
# Kalau demo ini dihapus, database dev Anda tetap utuh seperti semula.
#
# Jalankan ulang kapan saja untuk mereset demo ke keadaan awal:
#   bash docs/demo/siapkan-demo-lokal.sh
#
# Hapus demo (database dev Anda tidak ikut terhapus):
#   bash docs/demo/siapkan-demo-lokal.sh --hapus
# =============================================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

SUMBER="${SUMBER:-finance_main_dev}"     # hanya dibaca
CENTRAL="demo_central"
SLUG_A="utama"
SLUG_B="cabang"
TENANT_A="tenant_${SLUG_A}"
TENANT_B="tenant_${SLUG_B}"
ORG_SLUG="grup-demo"
ADMIN_EMAIL="admin@demo.test"
ADMIN_SANDI="Demo#2026"
PORT="${PORT:-8000}"
KERJA="storage/demo"

# ----------------------------------------------------------------- PENJAGA ---
# Skrip ini menjalankan DROP DATABASE. Nama targetnya dipaku di atas, tetapi
# kalau suatu saat ada yang mengubahnya lewat environment, penjaga ini yang
# menahan. Database yang boleh dihapus hanya milik demo.
for db in "$CENTRAL" "$TENANT_A" "$TENANT_B"; do
  case "$db" in
    demo_*|tenant_utama|tenant_cabang) ;;
    *) echo "TOLAK: '$db' bukan database demo. Dihentikan." >&2; exit 1 ;;
  esac
done
if [ "$SUMBER" = "$CENTRAL" ] || [ "$SUMBER" = "$TENANT_A" ]; then
  echo "TOLAK: database sumber sama dengan database demo — itu akan menimpa data Anda." >&2
  exit 1
fi

# ------------------------------------------------------------------- ALAT ---
MYSQL_BIN="${MYSQL_BIN:-/c/Program Files/MySQL/MySQL Server 8.0/bin}"
MY="$MYSQL_BIN/mysql"
MYDUMP="$MYSQL_BIN/mysqldump"
for exe in "$MY" "$MYDUMP"; do
  [ -x "$exe" ] || { echo "TOLAK: '$exe' tidak ada. Setel MYSQL_BIN ke folder bin MySQL Anda." >&2; exit 1; }
done

ambil_env() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'; }
DB_USER="$(ambil_env DB_USERNAME)"; DB_USER="${DB_USER:-root}"
export MYSQL_PWD="$(ambil_env DB_PASSWORD)"   # lewat env, tidak pernah di argv
DB_HOST="$(ambil_env DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
sql() { "$MY" -h "$DB_HOST" -u "$DB_USER" -N -e "$1"; }

# Semua artisan di bawah memakai database DEMO, bukan .env Anda. Dotenv Laravel
# tidak menimpa variabel yang sudah ada di environment, jadi prefix ini cukup
# dan .env Anda tidak perlu disentuh sama sekali.
export DB_DATABASE="$CENTRAL"
export LEGACY_DB_DATABASE="$SUMBER"
export SESSION_COOKIE="demo_session"
export CACHE_PREFIX="demo_"

# ------------------------------------------------------------------ HAPUS ---
if [ "${1:-}" = "--hapus" ]; then
  sql "DROP DATABASE IF EXISTS \`$CENTRAL\`; DROP DATABASE IF EXISTS \`$TENANT_A\`; DROP DATABASE IF EXISTS \`$TENANT_B\`;"
  rm -rf "storage/tenant${SLUG_A}" "storage/tenant${SLUG_B}" "$KERJA"
  echo "Demo dihapus. Database '$SUMBER' tidak disentuh."
  exit 0
fi

mkdir -p "$KERJA"
babak() { printf '\n########## %s ##########\n' "$*"; }

babak "1/9  SALIN DATABASE DEV (sumber hanya dibaca)"
"$MYDUMP" -h "$DB_HOST" -u "$DB_USER" --single-transaction --routines --triggers "$SUMBER" > "$KERJA/sumber.sql"
[ -s "$KERJA/sumber.sql" ] || { echo "dump kosong — batal" >&2; exit 1; }
echo "dump: $(wc -c < "$KERJA/sumber.sql") byte"

babak "2/9  BUAT DATABASE DEMO"
sql "DROP DATABASE IF EXISTS \`$CENTRAL\`; DROP DATABASE IF EXISTS \`$TENANT_A\`; DROP DATABASE IF EXISTS \`$TENANT_B\`;"
sql "CREATE DATABASE \`$TENANT_A\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sql "CREATE DATABASE \`$CENTRAL\`  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
"$MY" -h "$DB_HOST" -u "$DB_USER" "$TENANT_A" < "$KERJA/sumber.sql"
echo "data dev disalin ke $TENANT_A"

babak "3/9  SKEMA PUSAT + IZIN"
php artisan migrate --force --no-ansi | tail -3
php artisan db:seed --class=MasterPermissionSeeder --force --no-ansi | tail -3
php artisan permission:cache-reset --no-ansi

babak "4/9  ORGANISASI + ADMIN DEMO"
php artisan central:bootstrap \
  --organization="Grup Demo" --quota=10 \
  --name="Admin Demo" --email="$ADMIN_EMAIL" --password="$ADMIN_SANDI" --no-ansi

babak "5/9  ADOPSI DATA DEV JADI PERUSAHAAN PERTAMA"
php artisan central:adopt-database "$SLUG_A" \
  --organization="$ORG_SLUG" --name="PT Kisantra (Demo)" --abbreviation=KSN --no-ansi
#   Singkatan SENGAJA KSN, mengikuti nomor invoice yang sudah ada di data dev
#   (INV/01/KSN/01.26 dst). Singkatan lain akan memutus deret: invoice
#   berikutnya jadi INV/05/<lain>/… padahal riwayatnya KSN.

babak "6/9  IMPOR USER LAMA (sandi lama tetap berlaku)"
php artisan central:import-users legacy --organization="$ORG_SLUG" --company="$SLUG_A" --no-ansi

babak "7/9  LAMPIRAN"
php artisan central:adopt-storage "$SLUG_A" --no-ansi || true
[ -L public/storage ] || php artisan storage:link --no-ansi

babak "8/9  PERUSAHAAN KEDUA (dari nol) + AKSES ADMIN"
php docs/demo/isi-demo.php

babak "9/9  URUTAN NOMOR INVOICE"
# WAJIB lewat tenants:run — `invoice:backfill-sequence` sendirian berjalan di
# koneksi central, dan tabel yang dibacanya (invoices, company_profiles) hidup
# di database TENANT. Tanpa pembungkus ini hasilnya "Table demo_central.
# company_profiles doesn't exist", bukan backfill.
php artisan tenants:run invoice:backfill-sequence --tenants="$SLUG_A" --no-ansi || true

babak "SELESAI"
php artisan central:tenants-status --no-ansi || true
cat <<EOF

Jalankan servernya:
  bash docs/demo/jalankan-demo.sh

Lalu buka http://127.0.0.1:$PORT dan masuk dengan:
  $ADMIN_EMAIL / $ADMIN_SANDI     (admin, anggota KEDUA perusahaan)
  admin@gmail.com / <sandi dev Anda>  (user lama, hanya PT Utama Demo)
EOF
