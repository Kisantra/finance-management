#!/usr/bin/env bash
#
# baseline.sh — potret kondisi server SEBELUM tuning apa pun. HANYA MEMBACA.
#
# Skrip ini tidak mengubah satu pun berkas, konfigurasi, atau baris database.
# Tidak ada restart, tidak ada TRUNCATE, tidak ada penulisan ke DB.
#
# Pemakaian (jalankan di VPS):
#   ./baseline.sh                        dari dalam folder aplikasi
#   /tmp/baseline.sh /path/ke/aplikasi   dari mana saja — dipakai untuk mengukur SEBELUM
#                                        menarik kode baru, supaya deploy tidak mengubah
#                                        kondisi yang sedang diukur
#   ./baseline.sh > hasil.txt            simpan saja
#
#   BASELINE_SAMPLE_SECONDS=10 ./baseline.sh    perpendek jeda sampling laju (default 60)
#
# Hasil juga ditulis ke storage/logs/baseline-<waktu>.txt supaya mudah dikirim balik.
#
# Jalankan ulang skrip yang sama SETELAH tiap jendela tuning (W1, W2, W3, ...) lalu
# bandingkan. Nilai sebelum/sesudah inilah yang membuktikan sebuah perubahan bekerja —
# tanpa itu, klaim perbaikan hanyalah perasaan.
#
# Beberapa bagian butuh akses root (limit proses, konfigurasi PHP-FPM, log MySQL).
# Tanpa root skrip tetap jalan dan menandai bagian yang dilewati.

main() {
    set -uo pipefail   # sengaja TANPA -e: satu perintah yang tidak ada tidak boleh
                       # menghentikan seluruh potret

    # Folder aplikasi: argumen pertama, lalu env, lalu lokasi skrip ini. Argumen membuat
    # skrip bisa dijalankan dari /tmp — sehingga baseline bisa diukur TANPA menarik kode
    # baru ke server, yang justru akan mengubah kondisi yang sedang diukur.
    local APP_DIR
    APP_DIR="${1:-${BASELINE_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}}"

    if [ ! -f "$APP_DIR/artisan" ]; then
        echo "Bukan folder aplikasi Laravel: $APP_DIR" >&2
        echo "Pemakaian: $0 [/path/ke/folder/aplikasi]" >&2
        return 1
    fi
    local STAMP; STAMP="$(date +%Y-%m-%d_%H%M%S)"
    local OUT="$APP_DIR/storage/logs/baseline-$STAMP.txt"
    mkdir -p "$APP_DIR/storage/logs" 2>/dev/null

    # Semua keluaran digandakan ke berkas.
    exec > >(tee "$OUT") 2>&1

    bagian "POTRET BASELINE — $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Folder aplikasi : $APP_DIR"
    echo "Hostname        : $(hostname)"
    echo "Pengguna        : $(id -un)$([ "$(id -u)" = 0 ] && echo ' (root)' || echo ' (bukan root — sebagian bagian dilewati)')"
    echo "Hasil disimpan  : $OUT"

    sistem
    memori_proses
    php_runtime
    php_fpm
    redis_cek
    mysql_koneksi && { mysql_setelan; mysql_status; mysql_ukuran; mysql_query_terberat; mysql_indeks_hilang; }
    laravel_cek
    nginx_cek

    bagian "SELESAI"
    echo "Kirim balik berkas ini: $OUT"
    echo
    echo "Catatan: potret ini diambil pada satu titik waktu. Untuk angka yang bermakna,"
    echo "jalankan saat ada trafik pengguna nyata — bukan tengah malam saat server sepi."
}

# ── Pembantu ──────────────────────────────────────────────────────────────────

bagian() { printf '\n\n%s\n%s\n' "═══ $* " "$(printf '═%.0s' {1..78})"; }
sub()     { printf '\n── %s\n' "$*"; }
lewati()  { printf '   (dilewati: %s)\n' "$*"; }
# `type -P`, BUKAN `command -v`: command -v juga mengenali fungsi shell, sehingga fungsi
# bernama sama dengan program yang dipanggilnya akan memanggil dirinya sendiri tanpa henti.
ada()     { type -P "$1" >/dev/null 2>&1; }

# Baca satu kunci dari .env tanpa memuat seluruh berkas sebagai shell.
env_get() {
    local key="$1" line
    line="$(grep -E "^\s*${key}=" "$APP_DIR/.env" 2>/dev/null | tail -1)" || return 1
    line="${line#*=}"
    line="${line%\"}"; line="${line#\"}"
    line="${line%\'}"; line="${line#\'}"
    printf '%s' "$line"
}

# ── Bagian ────────────────────────────────────────────────────────────────────

sistem() {
    bagian "1. SISTEM — CPU, memori, disk, tekanan I/O"

    sub "CPU"
    nproc 2>/dev/null | sed 's/^/   vCPU: /'
    grep -m1 'model name' /proc/cpuinfo 2>/dev/null | sed 's/^/   /'

    sub "Memori (MB)"
    if ada free; then free -m 2>/dev/null | sed 's/^/   /'
    else lewati "perintah free tidak ada (bukan Linux?)"; fi

    sub "Disk"
    df -h / 2>/dev/null | sed 's/^/   /'

    sub "Load average (bandingkan dengan jumlah vCPU)"
    cat /proc/loadavg 2>/dev/null | sed 's/^/   /'
    echo "   Load > vCPU berarti antre. Selisih antara load dan pemakaian CPU = tunggu I/O."

    sub "Tekanan I/O & CPU — angka paling bersih untuk membuktikan tunggu I/O"
    if [ -r /proc/pressure/io ]; then
        echo "   io : $(tr '\n' ' ' < /proc/pressure/io)"
        echo "   cpu: $(tr '\n' ' ' < /proc/pressure/cpu)"
        echo "   avg60 pada io > 10% = ada yang tertahan disk secara signifikan."
    else
        lewati "/proc/pressure tidak tersedia (kernel < 4.20 atau PSI mati)"
    fi

    sub "vmstat 1 5 — kolom 'wa' = persen waktu CPU menunggu I/O"
    if ada vmstat; then vmstat 1 5 2>/dev/null | sed 's/^/   /'
    else lewati "vmstat tidak ada — pasang dengan: apt install sysstat procps"; fi

    sub "iostat — %util dan await per perangkat"
    if ada iostat; then iostat -x 1 3 2>/dev/null | tail -n +4 | sed 's/^/   /'
    else lewati "iostat tidak ada — pasang dengan: apt install sysstat"; fi
}

memori_proses() {
    bagian "2. SIAPA YANG MEMAKAI MEMORI — menjawab 'RAM 46% terpakai oleh apa'"
    local ringkasan
    ringkasan="$(ps -eo rss,comm --no-headers 2>/dev/null \
        | awk '{a[$2]+=$1} END {for (k in a) printf "   %8.0f MB  %s\n", a[k]/1024, k}' \
        | sort -rn | head -15)"
    if [ -n "$ringkasan" ]; then echo "$ringkasan"
    else lewati "ps tidak memberi kolom rss (bukan Linux?)"; fi

    sub "Jumlah proses PHP-FPM yang hidup sekarang"
    pgrep -c 'php-fpm' 2>/dev/null | sed 's/^/   /' || echo "   0"
    echo "   Bandingkan dengan pm.max_children di bagian 4."

    sub "RSS rata-rata & puncak per worker PHP-FPM (dipakai untuk menghitung anggaran memori)"
    ps -eo rss,args --no-headers 2>/dev/null | grep '[p]hp-fpm: pool' \
        | awk '{s+=$1; n++; if ($1>m) m=$1} END {
            if (n) printf "   jumlah=%d  rata2=%.0f MB  puncak=%.0f MB\n", n, s/n/1024, m/1024;
            else print "   (tidak ada worker aktif saat ini)"}'
}

php_runtime() {
    bagian "3. PHP — versi, opcache, realpath cache"

    sub "Versi (CLI)"
    php -v 2>/dev/null | head -1 | sed 's/^/   /' || lewati "php tidak ada di PATH"
    echo "   Catatan: composer.lock mengunci platform ke 8.3.31. Deploy doc menyuruh 8.4."
    echo "   Keduanya tidak boleh berbeda — ini kontradiksi yang harus diselesaikan."

    sub "Setelan opcache & realpath dari berkas ini (CLI; FPM bisa berbeda)"
    php -i 2>/dev/null | grep -E '^(opcache\.(enable|memory_consumption|interned_strings_buffer|max_accelerated_files|validate_timestamps|revalidate_freq|save_comments|jit)|realpath_cache_size|realpath_cache_ttl)\b' \
        | sed 's/^/   /' || lewati "tidak bisa membaca php -i"

    sub "Berkas ini yang menyetelnya (cek juga folder FPM, bukan hanya CLI)"
    ls -1 /etc/php/*/fpm/conf.d/*.ini 2>/dev/null | sed 's/^/   /' || lewati "folder conf.d FPM tidak terbaca"
    echo
    echo "   NILAI YANG DIHARAPKAN setelah W2:"
    echo "     opcache.validate_timestamps = 0      (sekarang biasanya 1)"
    echo "     opcache.max_accelerated_files ≥ 16229 (default 10000 — terlalu kecil, ~12.000 file)"
    echo "     realpath_cache_size = 4096k          (default 256k — jauh terlalu kecil)"
    echo "     opcache.save_comments = 1            (WAJIB 1; Laravel membaca docblock)"
}

php_fpm() {
    bagian "4. PHP-FPM — pool, jumlah worker, batas memori"

    sub "Konfigurasi pool"
    if ls /etc/php/*/fpm/pool.d/*.conf >/dev/null 2>&1; then
        grep -HE '^\s*(pm|pm\.[a-z_]+|listen|php_admin_value\[memory_limit\]|request_terminate_timeout|request_slowlog_timeout|slowlog|pm\.status_path)\s*=' \
            /etc/php/*/fpm/pool.d/*.conf 2>/dev/null | sed 's/^/   /'
    else
        lewati "tidak bisa membaca /etc/php/*/fpm/pool.d/ (butuh root?)"
    fi
    echo
    echo "   YANG DICARI: pm.max_children. Di 2 vCPU, nilai di atas ~8 justru memperburuk"
    echo "   p95 — 50 request berbagi 2 core berarti tiap request 25x lebih lama."
    echo "   Kalau nilainya 50 (default CloudPanel), itu kandidat penyebab utama."

    sub "Status pool (kalau pm.status_path sudah aktif)"
    if ada curl; then
        curl -s --max-time 3 'http://127.0.0.1/fpm-status' 2>/dev/null | sed 's/^/   /' \
            || lewati "endpoint /fpm-status belum aktif — akan dipasang di W2"
    else lewati "curl tidak ada"; fi
}

redis_cek() {
    bagian "5. REDIS — terpasang atau belum"
    if ada redis-cli; then
        echo "   redis-cli: ADA"
        redis-cli ping 2>&1 | sed 's/^/   ping: /'
        redis-cli info server 2>/dev/null | grep -E '^(redis_version|os|tcp_port)' | sed 's/^/   /'
        redis-cli info memory 2>/dev/null | grep -E '^(used_memory_human|maxmemory_human|maxmemory_policy)' | sed 's/^/   /'
    else
        echo "   redis-cli: TIDAK ADA — Redis belum terpasang."
        echo "   Ini yang membuat cache, session, dan queue semuanya memukul MySQL."
    fi

    sub "Paket ekstensi phpredis tersedia di repo distro?"
    if ada apt-cache; then
        apt-cache policy php8.3-redis 2>/dev/null | head -3 | sed 's/^/   /' \
            || lewati "apt-cache tidak memberi hasil"
    else lewati "bukan sistem berbasis apt"; fi
}

mysql_koneksi() {
    bagian "6. MYSQL — koneksi"
    if ! ada mysql; then lewati "klien mysql tidak ada di PATH"; return 1; fi

    DB_USER="$(env_get DB_USERNAME)"; DB_PASS="$(env_get DB_PASSWORD)"
    DB_NAME="$(env_get DB_DATABASE)"; DB_HOST="$(env_get DB_HOST)"
    : "${DB_HOST:=127.0.0.1}"

    if [ -z "${DB_USER:-}" ]; then lewati "DB_USERNAME tidak terbaca dari .env"; return 1; fi

    # MYSQL_PWD lewat environment, BUKAN argumen — supaya password tidak muncul di `ps`.
    export MYSQL_PWD="$DB_PASS"
    MYSQL=(mysql -h "$DB_HOST" -u "$DB_USER" -N -B)

    if ! "${MYSQL[@]}" -e 'SELECT 1' >/dev/null 2>&1; then
        lewati "tidak bisa menyambung ke MySQL dengan kredensial .env"
        return 1
    fi
    echo "   Tersambung sebagai '$DB_USER' ke $DB_HOST. Database aplikasi: ${DB_NAME:-?}"
    "${MYSQL[@]}" -e 'SELECT VERSION()' 2>/dev/null | sed 's/^/   Versi MySQL: /'
    return 0
}

mysql_setelan() {
    bagian "7. MYSQL — setelan sekarang vs yang disarankan"
    "${MYSQL[@]}" -e "
        SELECT VARIABLE_NAME, VARIABLE_VALUE
        FROM performance_schema.global_variables
        WHERE VARIABLE_NAME IN (
            'innodb_buffer_pool_size','innodb_buffer_pool_instances','innodb_flush_method',
            'innodb_flush_log_at_trx_commit','innodb_log_file_size','innodb_redo_log_capacity',
            'innodb_io_capacity','innodb_file_per_table','sync_binlog',
            'max_connections','table_open_cache','table_definition_cache','open_files_limit',
            'tmp_table_size','max_heap_table_size','slow_query_log','long_query_time'
        ) ORDER BY VARIABLE_NAME;" 2>/dev/null | sed 's/^/   /'

    cat <<'ACUAN'

   ACUAN untuk VPS 2 vCPU / 8 GB (lihat anggaran memori di rencana):
     innodb_buffer_pool_size     3221225472  (3 GB)   ← default 134217728 (128 MB) = masalah utama
     innodb_buffer_pool_instances 4
     innodb_flush_method         O_DIRECT
     innodb_flush_log_at_trx_commit 1        ← JANGAN diubah ke 2. Ini aplikasi keuangan.
     max_connections             80          ← default 151 berlebih untuk 10 worker
     table_open_cache            2000
     table_definition_cache      1500        ← default autosize terlalu kecil di 678 tabel (30 PT)
     open_files_limit            8192        ← butuh LimitNOFILE=16384 di systemd, kalau tidak
                                                MySQL diam-diam memakai nilai yang lebih rendah
     long_query_time             0.2         ← pada 2 detik Anda tidak akan melihat apa pun
ACUAN

    sub "Batas berkas proses MySQL yang SEBENARNYA berlaku"
    local pid; pid="$(pgrep -o mysqld 2>/dev/null)"
    if [ -n "$pid" ] && [ -r "/proc/$pid/limits" ]; then
        grep 'open files' "/proc/$pid/limits" | sed 's/^/   /'
        echo "   Kalau angka ini lebih kecil dari open_files_limit, systemd yang membatasi."
    else
        lewati "tidak bisa membaca limit proses mysqld (butuh root)"
    fi
}

mysql_status() {
    bagian "8. MYSQL — metrik berjalan (INI ANGKA BASELINE-NYA)"

    sub "Hit ratio buffer pool — metrik paling menentukan"
    "${MYSQL[@]}" -e "
        SELECT
          (SELECT VARIABLE_VALUE FROM performance_schema.global_status
            WHERE VARIABLE_NAME='Innodb_buffer_pool_read_requests') AS permintaan,
          (SELECT VARIABLE_VALUE FROM performance_schema.global_status
            WHERE VARIABLE_NAME='Innodb_buffer_pool_reads') AS baca_disk,
          ROUND(1 - (
            (SELECT VARIABLE_VALUE FROM performance_schema.global_status
              WHERE VARIABLE_NAME='Innodb_buffer_pool_reads') /
            (SELECT VARIABLE_VALUE FROM performance_schema.global_status
              WHERE VARIABLE_NAME='Innodb_buffer_pool_read_requests')
          ), 5) AS hit_ratio;" 2>/dev/null | sed 's/^/   /'
    echo "   hit_ratio < 0,99 untuk beban sekecil ini = buffer pool jauh terlalu kecil."

    # SHOW GLOBAL STATUS, bukan performance_schema.global_status: pada server dengan
    # performance_schema=OFF sebagian counter (termasuk Com_commit) tidak muncul di sana,
    # dan kegagalannya tidak terlihat — angkanya hilang begitu saja tanpa pesan.
    sub "Metrik lain"
    "${MYSQL[@]}" -e "
        SHOW GLOBAL STATUS WHERE Variable_name IN (
            'Com_commit','Com_select','Questions','Uptime','Threads_running','Threads_connected',
            'Opened_tables','Open_tables','Table_open_cache_misses','Table_open_cache_overflows',
            'Created_tmp_disk_tables','Created_tmp_tables','Innodb_row_lock_time_avg',
            'Innodb_os_log_written','Slow_queries','Aborted_connects'
        );" 2>/dev/null | sed 's/^/   /'
    echo
    echo "   Com_commit / Uptime ≈ commit per detik. Dengan SESSION_DRIVER=database,"
    echo "   angka itu kira-kira sama dengan request per detik — tiap request satu fsync."
    echo "   Setelah session pindah ke Redis, angka ini harus kolaps."
    echo "   Threads_running > 4 (2x vCPU) berkelanjutan = saturasi."
    echo "   Opened_tables yang terus memanjat = table_open_cache terlalu kecil."

    sub "Sampel kedua, untuk menghitung laju (bukan total sejak boot)"
    local c1 q1 c2 q2
    c1="$(status_of Com_commit)"; q1="$(status_of Questions)"
    local JEDA="${BASELINE_SAMPLE_SECONDS:-60}"
    echo "   menunggu ${JEDA} detik..."
    sleep "$JEDA"
    c2="$(status_of Com_commit)"; q2="$(status_of Questions)"

    if [ -n "${c1:-}" ] && [ -n "${c2:-}" ]; then
        echo "   commit/detik : $(awk -v a="$c1" -v b="$c2" -v d="$JEDA" 'BEGIN{printf "%.2f", (b-a)/d}')"
    else
        lewati "Com_commit tidak terbaca"
    fi
    if [ -n "${q1:-}" ] && [ -n "${q2:-}" ]; then
        echo "   query/detik  : $(awk -v a="$q1" -v b="$q2" -v d="$JEDA" 'BEGIN{printf "%.2f", (b-a)/d}')"
    else
        lewati "Questions tidak terbaca"
    fi
}

# Satu nilai status global. SHOW GLOBAL STATUS, bukan performance_schema — lihat alasan di atas.
status_of() {
    "${MYSQL[@]}" -e "SHOW GLOBAL STATUS WHERE Variable_name='$1'" 2>/dev/null | awk '{print $2}'
}

mysql_ukuran() {
    bagian "9. MYSQL — ukuran data (menentukan buffer pool 2560M atau 3072M)"
    "${MYSQL[@]}" -e "
        SELECT table_schema AS db,
               ROUND(SUM(data_length+index_length)/1048576) AS mb,
               ROUND(SUM(data_length)/1048576) AS data_mb,
               ROUND(SUM(index_length)/1048576) AS index_mb,
               COUNT(*) AS jml_tabel
        FROM information_schema.tables
        WHERE table_schema NOT IN ('mysql','information_schema','performance_schema','sys')
        GROUP BY table_schema WITH ROLLUP
        ORDER BY mb DESC;" 2>/dev/null | sed 's/^/   /'
    echo
    echo "   Total ≤ 2 GB  → buffer pool 2560M (lebih besar dari dataset = RAM terbuang)"
    echo "   Total 2-3 GB  → buffer pool 3072M"
    echo "   Total > 3 GB  → tetap 3072M, terima caching parsial, naikkan saat upgrade VPS"

    sub "Tabel terbesar"
    "${MYSQL[@]}" -e "
        SELECT CONCAT(table_schema,'.',table_name) AS tabel,
               ROUND((data_length+index_length)/1048576,1) AS mb, table_rows
        FROM information_schema.tables
        WHERE table_schema NOT IN ('mysql','information_schema','performance_schema','sys')
        ORDER BY (data_length+index_length) DESC LIMIT 15;" 2>/dev/null | sed 's/^/   /'

    sub "Jumlah baris tabel sessions (harus BERHENTI tumbuh setelah pindah ke Redis)"
    local db; db="$(env_get DB_DATABASE)"
    [ -n "${db:-}" ] && "${MYSQL[@]}" -e "SELECT COUNT(*) FROM \`$db\`.sessions;" 2>/dev/null | sed 's/^/   /'
}

mysql_query_terberat() {
    bagian "10. MYSQL — query paling membebani (sejak statistik terakhir di-reset)"
    "${MYSQL[@]}" -e "
        SELECT LEFT(DIGEST_TEXT,100) AS query,
               COUNT_STAR AS n,
               ROUND(SUM_TIMER_WAIT/1e12,2) AS total_detik,
               ROUND(AVG_TIMER_WAIT/1e9,2) AS rata2_ms,
               SUM_ROWS_EXAMINED AS baris_diperiksa,
               SUM_ROWS_SENT AS baris_dikirim,
               SUM_NO_INDEX_USED AS tanpa_indeks,
               SUM_CREATED_TMP_DISK_TABLES AS tmp_disk
        FROM performance_schema.events_statements_summary_by_digest
        WHERE DIGEST_TEXT IS NOT NULL
        ORDER BY SUM_TIMER_WAIT DESC LIMIT 20;" 2>/dev/null | sed 's/^/   /' \
        || lewati "performance_schema tidak aktif"
    echo
    echo "   tanpa_indeks > 0 menyebutkan indeks yang hilang secara langsung."
    echo "   baris_diperiksa jauh lebih besar dari baris_dikirim = scan."
}

mysql_indeks_hilang() {
    bagian "11. MYSQL — indeks yang disarankan rencana, ada atau belum"
    local db; db="$(env_get DB_DATABASE)"
    [ -z "${db:-}" ] && { lewati "DB_DATABASE tidak terbaca"; return; }

    "${MYSQL[@]}" -e "
        SELECT table_name AS tabel, index_name AS indeks,
               GROUP_CONCAT(column_name ORDER BY seq_in_index) AS kolom
        FROM information_schema.statistics
        WHERE table_schema='$db'
          AND table_name IN ('payments','bank_transactions','invoices','reimbursements','fund_requests')
        GROUP BY table_name, index_name
        ORDER BY table_name, index_name;" 2>/dev/null | sed 's/^/   /'

    cat <<'IDX'

   YANG DICARI (prioritas tertinggi dulu):
     payments(payment_date)                                      ← sering HILANG; full scan + filesort
     invoices(issue_date)                                        ← sering HILANG; halaman invoice
     bank_transactions(bank_account_id, transaction_type, amount) ← covering untuk saldo
     bank_transactions(transaction_date, transaction_type, amount)← tanggal harus MEMIMPIN
     payments(bank_account_id, amount)                           ← covering
     reimbursements(status), fund_requests(status)               ← badge actionCounts
IDX
}

laravel_cek() {
    bagian "12. LARAVEL — cache, driver, dan jebakan deploy"

    sub "Driver dari .env (nilai, bukan password)"
    local k
    for k in APP_ENV APP_DEBUG DB_CONNECTION DB_HOST DB_DATABASE DB_SOCKET \
             CACHE_STORE SESSION_DRIVER SESSION_CONNECTION QUEUE_CONNECTION \
             REDIS_CLIENT REDIS_HOST REDIS_PORT; do
        printf '   %-20s = %s\n' "$k" "$(env_get "$k" || echo '(tidak diset)')"
    done
    echo
    echo "   JEBAKAN: kalau SESSION_DRIVER diubah ke redis sementara SESSION_CONNECTION"
    echo "   masih 'mysql', Laravel mencari koneksi REDIS bernama 'mysql' → situs mati total."
    echo "   Keduanya harus konsisten SEBELUM config:cache."

    sub "Berkas cache framework — ADA atau TIDAK"
    local f
    for f in bootstrap/cache/config.php bootstrap/cache/routes-v7.php \
             bootstrap/cache/events.php bootstrap/cache/packages.php; do
        if [ -f "$APP_DIR/$f" ]; then
            printf '   ADA          %s  (%s)\n' "$f" "$(date -r "$APP_DIR/$f" '+%Y-%m-%d %H:%M' 2>/dev/null)"
        else
            printf '   TIDAK ADA    %s\n' "$f"
        fi
    done
    echo
    echo "   routes-v7.php TIDAK ADA berarti route cache tidak terpasang — dan karena"
    echo "   'php artisan optimize' MENELAN kegagalan (exit 0 walau route:cache gagal),"
    echo "   deploy melaporkan sukses sementara setiap request mengompilasi ulang"
    echo "   seluruh koleksi route. Ini dugaan utama; berkas di atas yang membuktikannya."

    sub "Route closure yang memblokir route:cache"
    grep -cE "Route::(get|post|put|patch|delete|any|match|fallback)\s*\([^)]*function\s*\(|Route::(get|post|put|patch|delete|any)\s*\([^)]*fn\s*\(" \
        "$APP_DIR/routes/web.php" 2>/dev/null | sed 's/^/   perkiraan jumlah: /'
    echo "   (perkiraan kasar — yang menentukan tetap apakah route:cache berhasil)"

    sub "Jumlah berkas PHP (untuk opcache.max_accelerated_files)"
    find "$APP_DIR/app" "$APP_DIR/vendor" -name '*.php' 2>/dev/null | wc -l | sed 's/^/   /'
    echo "   Setel opcache.max_accelerated_files ke bilangan prima di ATAS angka ini."

    sub "Ukuran bundle hasil build (periksa apakah Remotion ikut masuk)"
    if [ -d "$APP_DIR/public/build/assets" ]; then
        ls -lhS "$APP_DIR/public/build/assets"/*.js 2>/dev/null | head -8 | awk '{print "   "$5"  "$9}'
        du -sh "$APP_DIR/public/build" 2>/dev/null | sed 's/^/   total: /'
    else
        lewati "public/build belum ada — jalankan npm run build dulu"
    fi
}

nginx_cek() {
    bagian "13. NGINX — kompresi, HTTP/2, header cache"

    sub "Versi & modul"
    if ada nginx; then nginx -v 2>&1 | sed 's/^/   /'; else lewati "nginx tidak ada di PATH"; fi

    sub "Setelan gzip yang aktif"
    grep -rhE '^\s*(gzip|gzip_types|gzip_comp_level|gzip_min_length)\s' /etc/nginx/ 2>/dev/null \
        | sort -u | sed 's/^/   /' || lewati "tidak bisa membaca /etc/nginx (butuh root?)"
    echo "   gzip_types WAJIB memuat application/json — respons Inertia adalah JSON"
    echo "   dan bisa besar (props). 50-200 KB bisa jadi 15-40 KB."

    sub "Uji dari luar (ganti domainnya bila perlu)"
    cat <<'UJI'
   Jalankan dari laptop Anda, bukan dari VPS:
     curl -sI --http2 https://DOMAIN/                  | head -3
     curl -sI -H 'Accept-Encoding: gzip' https://DOMAIN/build/assets/ | grep -i 'content-encoding\|cache-control'
UJI
}

main "$@"
