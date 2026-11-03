#!/usr/bin/env bash
# Deteksi migration tenant yang DIBERI TANGGAL BARU di branch tenancy padahal
# isinya sudah pernah dijalankan di deployment lama dengan nama lama.
#
# Kalau tidak diperiksa, `tenants:migrate` (dipanggil otomatis oleh
# central:adopt-database) akan MENJALANKAN ULANG migration itu dan mati dengan
# "Duplicate column name ..." — cutover berhenti di tengah jalan.
#
# Pemakaian:
#   bash docs/migrasi/cek-migrasi-redate.sh tenant_kisantra
#
# Keluarannya: daftar migration yang akan dijalankan, plus pernyataan INSERT
# siap-tempel untuk migration yang hanya berubah tanggal (rekonsiliasi buku
# migration, BUKAN mengubah skema).
set -euo pipefail

DB="${1:?Pakai: bash docs/migrasi/cek-migrasi-redate.sh <nama-db-tenant>}"
MYSQL=(mysql -h "${DB_HOST:-127.0.0.1}" -u "${DB_USERNAME:-root}")

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

"${MYSQL[@]}" -N -e "SELECT migration FROM \`$DB\`.migrations" | tr -d '\r' | sort > "$TMP/lama"
ls database/migrations/tenant/*.php | xargs -n1 basename | sed 's/\.php$//' | sort > "$TMP/baru"

comm -13 "$TMP/lama" "$TMP/baru" > "$TMP/akan-jalan"

echo "== Migration tenant yang AKAN dijalankan terhadap $DB =="
cat "$TMP/akan-jalan"
echo

echo "== Dicurigai hanya berubah tanggal (nama setelah timestamp sama) =="
ADA=0
while read -r baru; do
  [ -n "$baru" ] || continue
  ekor="${baru#????_??_??_??????_}"
  lama="$(grep -E "^[0-9_]{17}_${ekor}$" "$TMP/lama" || true)"
  if [ -n "$lama" ]; then
    ADA=1
    echo "  $lama"
    echo "    → sekarang bernama $baru"
    echo "    INSERT INTO \`$DB\`.migrations (migration, batch) SELECT '$baru', MAX(batch) FROM \`$DB\`.migrations;"
  fi
done < "$TMP/akan-jalan"

[ "$ADA" -eq 0 ] && echo "  (tidak ada — aman lanjut)"

echo
echo "Bandingkan isi berkasnya dulu sebelum menjalankan INSERT:"
echo "  diff <(git show main:database/migrations/<nama-lama>.php) database/migrations/tenant/<nama-baru>.php"
echo "Identik = hanya ganti tanggal, aman dicatat. Berbeda = JANGAN, telaah manual."
