#!/usr/bin/env bash
# LATIHAN CUTOVER JALUR B — dari nol sampai terverifikasi, di SALINAN.
#
# Skrip ini memainkan ulang seluruh rangkaian cutover produksi terhadap salinan
# database, lalu membandingkan angka sebelum-sesudah. Dijalankan penuh pada
# 2026-11-02; keluaran nyatanya tercatat di
# docs/multi-tenancy-runbook-eksekusi.md bagian "Latihan Cutover".
#
# Yang disentuh HANYA database berawalan `latihan_` plus satu database tenant
# `tenant_$SLUG`. Database sumber hanya DIBACA.
#
# Pemakaian:
#   bash docs/migrasi/latihan-cutover.sh
#   SUMBER=kisantra-finance SLUG=kisantra bash docs/migrasi/latihan-cutover.sh
#
# Jalankan dari akar repo. Perlu mysql + mysqldump di PATH.
set -euo pipefail

SUMBER="${SUMBER:-finance_main_dev}"        # database "produksi lama" (hanya dibaca)
SLUG="${SLUG:-latihanc}"                    # slug perusahaan → database tenant_$SLUG
ORG_NAMA="${ORG_NAMA:-Kisantra Group}"
ORG_SLUG="${ORG_SLUG:-kisantra-group}"
PT_NAMA="${PT_NAMA:-PT. Kinara Sadayatra Nusantara}"
PT_SINGKATAN="${PT_SINGKATAN:-KSN}"
OPS_EMAIL="${OPS_EMAIL:-ops@kisantra.test}"
OPS_SANDI="${OPS_SANDI:-LatihanCutover#2026}"
KERJA="${KERJA:-${TMPDIR:-/tmp}/latihan-cutover}"

SUMBER_SALINAN=latihan_sumber               # pembanding; dibiarkan utuh
CENTRAL=latihan_central                     # database pusat latihan
TENANT="tenant_${SLUG}"

MY=(mysql -h "${DB_HOST:-127.0.0.1}" -u "${DB_USERNAME:-root}")
MYDUMP=(mysqldump -h "${DB_HOST:-127.0.0.1}" -u "${DB_USERNAME:-root}"
        --single-transaction --routines --triggers --default-character-set=utf8mb4)
export MYSQL_PWD="${DB_PASSWORD:?Setel DB_PASSWORD dulu (mis. export DB_PASSWORD=...)}"

# Semua artisan di bawah memakai database latihan, BUKAN .env. Dotenv Laravel
# tidak menimpa variabel yang sudah ada di environment, jadi prefix ini cukup.
export DB_DATABASE="$CENTRAL"
export LEGACY_DB_DATABASE="$SUMBER_SALINAN"

mkdir -p "$KERJA"

# PENJAGA. Baris DROP di bawah menghapus $TENANT, dan $TENANT diturunkan dari
# $SLUG yang BOLEH ditimpa dari environment. `SLUG=kisantra` akan menghapus
# database tenant produksi yang sungguhan. Latihan hanya boleh menyentuh slug
# bertanda latihan; menimpanya butuh IZIN_HAPUS_TENANT=ya yang disengaja.
case "$SLUG" in
  *latihan*|*rehearsal*|*dryrun*) ;;
  *)
    if [ "${IZIN_HAPUS_TENANT:-}" != "ya" ]; then
      echo "BATAL: SLUG='$SLUG' bukan slug latihan, dan skrip ini akan menjalankan" >&2
      echo "       DROP DATABASE \`tenant_$SLUG\`. Pakai slug bernama *latihan*," >&2
      echo "       atau setel IZIN_HAPUS_TENANT=ya kalau database itu memang sekali pakai." >&2
      exit 1
    fi
    echo "PERINGATAN: menghapus tenant_$SLUG atas izin IZIN_HAPUS_TENANT=ya." >&2
    ;;
esac
babak() { printf '\n########## %s ##########\n' "$*"; }

babak "0. SALIN 'PRODUKSI LAMA' (sumber hanya dibaca)"
"${MYDUMP[@]}" "$SUMBER" > "$KERJA/prod.sql"
[ -s "$KERJA/prod.sql" ] || { echo "dump kosong — batal"; exit 1; }
ls -la "$KERJA/prod.sql"
"${MY[@]}" -e "DROP DATABASE IF EXISTS \`$SUMBER_SALINAN\`; DROP DATABASE IF EXISTS \`$CENTRAL\`; DROP DATABASE IF EXISTS \`$TENANT\`;"
"${MY[@]}" -e "CREATE DATABASE \`$SUMBER_SALINAN\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
"${MY[@]}" "$SUMBER_SALINAN" < "$KERJA/prod.sql"

babak "0b. JADIKAN SALINAN SEPERTI PRODUKSI SEBENARNYA"
# Migrasi 2026_10_08_004959 memakai regex ^(\d+)/INV/ yang tidak cocok dengan
# nomor berformat INV/01/KSN/01.26, jadi di produksi kolomnya NULL dan polanya
# masih nilai bawaan. Database dev kadang sudah di-backfill — kembalikan.
"${MY[@]}" "$SUMBER_SALINAN" -e "
  UPDATE invoices SET invoice_sequence = NULL;
  UPDATE company_profiles SET invoice_number_format='{NO}/INV/{PT}-{KLIEN}/{BLN_ROMAWI}/{THN}',
         invoice_number_padding=3, invoice_number_reset='monthly';"

babak "1. BASELINE SEBELUM"
"${MY[@]}" "$SUMBER_SALINAN" < docs/migrasi/verifikasi-baseline.sql > "$KERJA/sebelum.txt"
cat "$KERJA/sebelum.txt"

babak "2. FREEZE: dump yang akan dipulihkan jadi tenant (= titik mundur)"
"${MYDUMP[@]}" "$SUMBER_SALINAN" > "$KERJA/freeze.sql"
"${MY[@]}" -e "CREATE DATABASE \`$TENANT\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
"${MY[@]}" "$TENANT" < "$KERJA/freeze.sql"

babak "3. DATABASE PUSAT"
"${MY[@]}" -e "CREATE DATABASE \`$CENTRAL\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php artisan migrate --force
php artisan db:seed --class=MasterPermissionSeeder --force
php artisan permission:cache-reset

babak "4. ORGANIZATION + AKUN OPERATOR"
php artisan central:bootstrap --organization="$ORG_NAMA" --quota=5 \
  --name="Operator Cutover" --email="$OPS_EMAIL" --password="$OPS_SANDI"

babak "5. REKONSILIASI BUKU MIGRATION (sebelum adopt — kalau tidak, adopt mati)"
bash docs/migrasi/cek-migrasi-redate.sh "$TENANT" | tee "$KERJA/redate.txt"
grep -E '^\s+INSERT INTO' "$KERJA/redate.txt" | sed 's/^ *//' > "$KERJA/rekon.sql" || true
if [ -s "$KERJA/rekon.sql" ]; then
  echo "--- menjalankan rekonsiliasi ---"; cat "$KERJA/rekon.sql"
  "${MY[@]}" < "$KERJA/rekon.sql"
else
  echo "--- tidak ada migration yang hanya berubah tanggal ---"
fi

babak "6. ADOPT DATABASE (titik IREVERSIBEL — skema tenant diubah)"
php artisan central:adopt-database "$SLUG" --organization="$ORG_SLUG" \
  --name="$PT_NAMA" --abbreviation="$PT_SINGKATAN"

babak "7. IMPOR USER"
php artisan central:import-users legacy --organization="$ORG_SLUG" --company="$SLUG" --dry-run
php artisan central:import-users legacy --organization="$ORG_SLUG" --company="$SLUG"

babak "8. ADOPSI STORAGE"
php artisan central:adopt-storage "$SLUG" --dry-run
php artisan central:adopt-storage "$SLUG"
php artisan storage:link || echo "(tautan sudah ada — tidak apa-apa)"

babak "9. URUTAN INVOICE — pola bawaan dulu, buktikan TIDAK cocok"
php artisan tenants:run invoice:backfill-sequence --tenants="$SLUG" --option="dry-run=1"

babak "9b. SETEL POLA SESUAI RIWAYAT, lalu backfill"
# Di produksi lakukan ini lewat Pengaturan › Penomoran invoice. Di latihan,
# langsung ke profil perusahaan tenant supaya skrip bisa jalan tanpa browser.
php artisan tinker --execute="
tenancy()->initialize(App\Models\Company::find('$SLUG'));
App\Models\CompanyProfile::current()->update([
  'invoice_number_format' => 'INV/{NO}/{PT}/{BLN}.{THN2}',
  'invoice_number_padding' => 2,
  'invoice_number_reset' => 'yearly',
]);
echo 'pola disetel', PHP_EOL;"
php artisan tenants:run invoice:backfill-sequence --tenants="$SLUG" --option="dry-run=1"
php artisan tenants:run invoice:backfill-sequence --tenants="$SLUG"

babak "10. VERIFIKASI"
"${MY[@]}" "$TENANT" < docs/migrasi/verifikasi-baseline.sql > "$KERJA/sesudah.txt"
echo "--- diff sebelum vs sesudah (HANYA blok urutan & pola yang boleh beda) ---"
diff "$KERJA/sebelum.txt" "$KERJA/sesudah.txt" || true
php artisan central:tenants-status
php artisan tinker --execute="
use Illuminate\Support\Facades\Storage;
tenancy()->initialize(App\Models\Company::find('$SLUG'));
\$n = app(App\Services\InvoiceNumberService::class);
\$k = App\Models\Client::orderBy('id')->first();
echo 'NOMOR INVOICE BERIKUTNYA : ', \$n->next(today(), \$k->id), PHP_EOL;
foreach (App\Models\BankAccount::withBalance()->orderBy('id')->get() as \$b) {
    echo '  saldo #', \$b->id, ' ', \$b->bank_name, ' = ', \$b->balance, PHP_EOL;
}
\$tx = App\Models\BankTransaction::whereNotNull('attachment_path')->first();
echo \$tx
    ? 'lampiran terbaca di folder tenant: ' . var_export(Storage::disk('public')->exists(\$tx->attachment_path), true) . PHP_EOL
    : 'tidak ada baris berlampiran untuk diuji' . PHP_EOL;"

babak "SELESAI"
cat <<EOF
Berkas kerja : $KERJA
Titik mundur : mysql $TENANT < $KERJA/freeze.sql  (setelah DROP + CREATE)

Bereskan latihan:
  mysql -e "DROP DATABASE \\\`$SUMBER_SALINAN\\\`; DROP DATABASE \\\`$CENTRAL\\\`; DROP DATABASE \\\`$TENANT\\\`;"
  rm -rf storage/tenant${SLUG} "$KERJA"   # hapus folder storage tenant latihan juga
EOF
