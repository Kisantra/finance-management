#!/usr/bin/env bash
# =============================================================================
# LINGKUNGAN QC TERISOLASI — satu set per penguji, aman dijalankan bersamaan
# =============================================================================
#
#   bash docs/qa/siapkan-lingkungan-qc.sh <slug> <port>
#   contoh: bash docs/qa/siapkan-lingkungan-qc.sh a 8011
#
# Menghasilkan, semuanya ber-awalan slug supaya dua penguji tidak bertabrakan:
#
#   database pusat   qc<slug>_central
#   perusahaan 1     tenant_qc<slug>satu   "PT Satu QC<SLUG>"   singkatan S<SLUG>
#   perusahaan 2     tenant_qc<slug>dua    "PT Dua QC<SLUG>"    singkatan D<SLUG>
#   konfigurasi      .env.qc<slug>         (APP_ENV=qc<slug>)
#
# Dua perusahaan dibuat DARI NOL lewat pipeline provisioning, jadi master data
# (kategori transaksi, profil perusahaan) ikut terisi. Data bisnis per modul
# TIDAK dibuat di sini — penguji modul yang membuatnya sendiri, karena hanya ia
# yang tahu status dan kombinasi apa yang perlu diuji.
#
# TIDAK menyentuh .env, finance_main_dev, maupun demo_central.
#
# Hapus lingkungan:  bash docs/qa/siapkan-lingkungan-qc.sh <slug> <port> --hapus
# =============================================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

SLUG="${1:?Pakai: bash docs/qa/siapkan-lingkungan-qc.sh <slug> <port>}"
PORT="${2:?port wajib, mis. 8011}"
AKSI="${3:-}"

# --------------------------------------------------------------- PENJAGA ----
# Slug dibatasi huruf/angka pendek: ia menjadi bagian nama database yang akan
# di-DROP. Slug bebas berarti perintah DROP yang bebas pula.
if ! [[ "$SLUG" =~ ^[a-z0-9]{1,6}$ ]]; then
  echo "TOLAK: slug '$SLUG' harus 1-6 huruf kecil/angka." >&2
  exit 1
fi

CENTRAL="qc${SLUG}_central"
SLUG_A="qc${SLUG}satu"
SLUG_B="qc${SLUG}dua"
ENVFILE=".env.qc${SLUG}"

for db in "$CENTRAL" "tenant_${SLUG_A}" "tenant_${SLUG_B}"; do
  case "$db" in
    qc*_central|tenant_qc*) ;;
    *) echo "TOLAK: '$db' di luar pola QC. Dihentikan." >&2; exit 1 ;;
  esac
done

# ------------------------------------------------------------------ ALAT ----
MYSQL_BIN="${MYSQL_BIN:-/c/Program Files/MySQL/MySQL Server 8.0/bin}"
MY="$MYSQL_BIN/mysql"
[ -x "$MY" ] || { echo "TOLAK: '$MY' tidak ada. Setel MYSQL_BIN." >&2; exit 1; }

ambil_env() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'; }
DB_USER="$(ambil_env DB_USERNAME)"; DB_USER="${DB_USER:-root}"
DB_HOST="$(ambil_env DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
export MYSQL_PWD="$(ambil_env DB_PASSWORD)"
sql() { "$MY" -h "$DB_HOST" -u "$DB_USER" -N -e "$1"; }

if [ "$AKSI" = "--hapus" ]; then
  sql "DROP DATABASE IF EXISTS \`$CENTRAL\`; DROP DATABASE IF EXISTS \`tenant_${SLUG_A}\`; DROP DATABASE IF EXISTS \`tenant_${SLUG_B}\`;"
  rm -rf "storage/tenant${SLUG_A}" "storage/tenant${SLUG_B}" "$ENVFILE"
  echo "Lingkungan QC '$SLUG' dihapus."
  exit 0
fi

# -------------------------------------------------------------- KONFIG ------
# Berkas, bukan environment variable: `artisan serve` membuang hampir semua env
# sebelum meneruskannya ke proses yang melayani request, dan APP_ENV adalah satu
# dari sedikit yang lolos. Laravel memuat `.env.{APP_ENV}` bila ada.
cp .env "$ENVFILE"
php -r '
$f = $argv[1];
$s = file_get_contents($f);
$set = [
  "APP_ENV" => $argv[2], "APP_DEBUG" => "true",
  "APP_URL" => "http://127.0.0.1:".$argv[3],
  "DB_DATABASE" => $argv[4],
  // Cookie MENGABAIKAN nomor port: tanpa nama sendiri, sesi antar penguji di
  // 127.0.0.1 saling menimpa dan login terasa acak tanpa sebab yang kelihatan.
  "SESSION_COOKIE" => "qc".$argv[2]."_session",
  "CACHE_PREFIX" => "qc".$argv[2]."_",
];
foreach ($set as $k => $v) {
  $s = preg_match("/^{$k}=.*$/m", $s)
    ? preg_replace("/^{$k}=.*$/m", "{$k}={$v}", $s, 1)
    : rtrim($s, "\r\n")."\n{$k}={$v}\n";
}
file_put_contents($f, $s);
' "$ENVFILE" "qc${SLUG}" "$PORT" "$CENTRAL"

export APP_ENV="qc${SLUG}"

babak() { printf '\n########## %s ##########\n' "$*"; }

babak "1/4  DATABASE PUSAT"
sql "DROP DATABASE IF EXISTS \`$CENTRAL\`; DROP DATABASE IF EXISTS \`tenant_${SLUG_A}\`; DROP DATABASE IF EXISTS \`tenant_${SLUG_B}\`;"
sql "CREATE DATABASE \`$CENTRAL\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php artisan migrate --force --no-ansi | tail -2
php artisan db:seed --class=MasterPermissionSeeder --force --no-ansi | tail -2
php artisan permission:cache-reset --no-ansi

babak "2/4  ORGANISASI + ADMIN"
php artisan central:bootstrap \
  --organization="Grup QC ${SLUG}" --quota=10 \
  --name="QC Admin" --email="qc${SLUG}-admin@qc.test" --password="QcUji#2026" --no-ansi

babak "3/4  DUA PERUSAHAAN + TIGA PERAN"
php docs/qa/isi-kerangka-qc.php "$SLUG" "$SLUG_A" "$SLUG_B"

babak "4/4  RINGKASAN"
php artisan central:tenants-status --no-ansi || true

cat <<EOF

Jalankan server:
  bash docs/qa/jalankan-qc.sh ${SLUG} ${PORT}

Akun (sandi semuanya QcUji#2026):
  qc${SLUG}-admin@qc.test    admin, anggota KEDUA perusahaan
  qc${SLUG}-fm@qc.test       finance manager, anggota KEDUA perusahaan
  qc${SLUG}-staff@qc.test    staff, HANYA ${SLUG_A}
  qc${SLUG}-luar@qc.test     admin, HANYA ${SLUG_B}  (untuk uji akses silang)

Perusahaan: ${SLUG_A} (S${SLUG}) dan ${SLUG_B} (D${SLUG})
EOF
