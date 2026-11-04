#!/usr/bin/env bash
#
# deploy.sh — pasang atau perbarui aplikasi di server dengan aman. Satu perintah, tanpa
# nilai apa pun; skrip memilih sendiri dari bentuk database di .env (DB_DATABASE):
#
#   Database kosong          → INSTALASI BARU: struktur database disiapkan, lalu website
#                              memandu pembuatan admin & perusahaan pertama (tautan dicetak).
#   Database versi lama      → KONVERSI: perusahaan yang sudah berjalan dijadikan perusahaan
#   (satu perusahaan)          utama (/c/utama); identitasnya dilengkapi admin di website.
#   Database multi-perusahaan → PEMBARUAN rutin.
#
#   ./deploy.sh            tampilkan rencana, minta konfirmasi, lalu jalankan
#   ./deploy.sh --yes      tanpa konfirmasi
#   ./deploy.sh --force    pembaruan rutin walau tidak ada commit baru (mis. build ulang)
#
# Server yang masih memakai deploy.sh lama: jalankan versi baru ini satu kali dari folder
# aplikasi:  git fetch origin && bash <(git show origin/main:deploy.sh)
# Konversi yang berhenti di tengah dilanjutkan dengan perintah yang sama.
# Detail & jalan mundur: docs/guides/DEPLOY.md. Log tiap perintah: storage/logs/deploy-<waktu>.log
#
# Seluruh isi dibungkus main() dan dipanggil di baris terakhir: bash mem-parse fungsi utuh
# sebelum menjalankannya, jadi `git merge` yang mengubah file ini di tengah jalan aman.

main() {
    set -Eeuo pipefail

    local REMOTE=origin BRANCH=main
    local ASSUME_YES=0 FORCE=0 arg
    for arg in "$@"; do
        case "$arg" in
            -y | --yes) ASSUME_YES=1 ;;
            -f | --force) FORCE=1 ;;
            -h | --help)
                sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
                return 0
                ;;
            *)
                echo "Opsi tidak dikenal: $arg (lihat --help)"
                return 1
                ;;
        esac
    done

    # Folder aplikasi = folder skrip ini bila berisi artisan; selain itu folder kerja
    # (versi baru dijalankan lewat `bash <(git show origin/main:deploy.sh)` dari folder aplikasi).
    local self_dir
    self_dir=$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo .)")
    if [[ -f "$self_dir/artisan" ]]; then cd "$self_dir"; fi
    if [[ ! -f artisan || ! -f .env ]]; then
        echo "Jalankan dari folder aplikasi (berisi artisan dan .env)."
        return 1
    fi

    local TS LOG
    TS=$(date +%Y%m%d-%H%M%S)
    mkdir -p storage/logs
    LOG="storage/logs/deploy-$TS.log"

    local MODE="" TOTAL_STEPS=0 STEP=0 DEPLOY_START=$SECONDS CURRENT_PID=""
    local IN_MAINTENANCE=0 PULLED=0 MIGRATE_STARTED=0
    local PREV_COMMIT="" TARGET_COMMIT="" BACKUP_DIR="" STATE_DIR=""
    # Nilai konversi. Kode URL perusahaan utama selalu "utama"; nama database diturunkan dari
    # database lama supaya unik walau server MySQL dipakai bersama instalasi lain.
    local SLUG="utama" ABBR="" COMPANY_NAME="" CENTRAL_DB="" LEGACY_DB="" TENANT_PREFIX="" TENANT_DB=""
    local -a PARAMS=(SLUG ABBR COMPANY_NAME CENTRAL_DB LEGACY_DB TENANT_PREFIX TENANT_DB PREV_COMMIT TARGET_COMMIT)
    local -a MYSQL_ARGS=()

    # ── Tampilan ────────────────────────────────────────────────────────────────
    local TTY=0 COLS=100 BOLD="" DIM="" RED="" GREEN="" YELLOW="" CYAN="" RESET=""
    local -a SPIN=('-' '\' '|' '/')
    if [[ -t 1 ]]; then
        TTY=1
        COLS=$(tput cols 2>/dev/null || echo 100)
        BOLD=$'\033[1m' DIM=$'\033[2m' RED=$'\033[31m' GREEN=$'\033[32m' YELLOW=$'\033[33m' CYAN=$'\033[36m' RESET=$'\033[0m'
        if [[ "$(locale charmap 2>/dev/null)" == "UTF-8" ]]; then
            SPIN=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
        fi
    fi

    # Cetak ke layar (berwarna) dan ke log (tanpa kode warna).
    say() {
        printf '%s\n' "$1"
        printf '%s\n' "$1" | sed -E 's/\x1b\[[0-9;]*m//g' >>"$LOG"
    }

    clock() { date +%H:%M:%S; }

    fmt_dur() {
        local s=$1
        if ((s >= 60)); then printf '%dm%02ds' $((s / 60)) $((s % 60)); else printf '%ds' "$s"; fi
    }

    # Langkah berjalan di subshell latar; menghentikan subshell saja meninggalkan anaknya (npm, composer,
    # migrate) tetap menulis node_modules/vendor/database, lalu bentrok saat deploy diulang.
    kill_tree() {
        local child
        for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
        kill "$1" 2>/dev/null || true
    }

    # ── Gagal: hentikan, jelaskan, tunjukkan jalan pulang ────────────────────────
    fail() {
        trap - ERR INT TERM
        if [[ -n "$CURRENT_PID" ]]; then kill_tree "$CURRENT_PID"; fi
        if ((TTY)); then printf '\r\033[K'; fi
        local recent
        recent=$(tail -n 20 "$LOG" 2>/dev/null || true)
        say ""
        say "${RED}${BOLD}DEPLOY GAGAL:${RESET} $1"
        if [[ -n "$recent" ]]; then
            say "${DIM}── 20 baris terakhir log ─────────────────────────────${RESET}"
            printf '%s\n' "$recent" | sed 's/^/  /'
            say "${DIM}──────────────────────────────────────────────────────${RESET}"
        fi
        say ""
        if [[ "$MODE" == konversi ]]; then conversion_recovery; else routine_recovery; fi
        say "Log lengkap: ${LOG}"
        exit 1
    }

    routine_recovery() {
        if ((IN_MAINTENANCE)); then
            say "${YELLOW}Situs MASIH dalam mode maintenance${RESET} supaya pengguna tidak melihat aplikasi setengah jadi."
            say "  • Perbaiki masalahnya lalu ulangi: ./deploy.sh --force   (migration yang sudah tercatat tidak diulang)"
            say "  • Atau buka kembali apa adanya:    php artisan up"
        fi
        if ((PULLED)); then
            say "Kembali ke versi sebelumnya (${PREV_COMMIT:0:7}), berurutan:"
            say "  git reset --hard ${PREV_COMMIT}"
            say "  composer install --no-dev --optimize-autoloader && npm ci && npm run build"
            say "  php artisan optimize:clear && php artisan optimize && php artisan up"
            if ((MIGRATE_STARTED)); then
                say "  Database TIDAK perlu dikembalikan: migration wajib expand-contract, kode lama tetap jalan di skema baru."
            fi
        fi
        if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
            say "Backup sebelum deploy (satu .sql.gz per database): ${BACKUP_DIR}"
            say "  Pulihkan hanya bila data rusak: gunzip < ${BACKUP_DIR}/<database>.sql.gz | mysql -u <user> -p <database>"
        fi
    }

    conversion_recovery() {
        local resume="./deploy.sh"
        if ((!PULLED)); then resume="git fetch origin && bash <(git show origin/main:deploy.sh)"; fi
        if ((IN_MAINTENANCE)); then
            say "${YELLOW}Situs MASIH maintenance.${RESET} Data database lama (${LEGACY_DB:-?}) TIDAK diubah oleh konversi."
        else
            say "Situs tetap online; database lama (${LEGACY_DB:-?}) tidak disentuh."
        fi
        say "  1. Perbaiki penyebabnya, lalu lanjutkan dari langkah yang gagal:"
        say "     ${resume}"
        if ((IN_MAINTENANCE)); then
            say "  2. Atau kembali ke versi lama sepenuhnya, berurutan:"
            if done_has env; then say "     cp ${STATE_DIR}/env-lama .env"; fi
            if ((PULLED)); then
                say "     git reset --hard ${PREV_COMMIT}"
                say "     composer install --no-dev --optimize-autoloader && npm ci && npm run build"
            fi
            say "     php artisan optimize:clear && php artisan optimize && php artisan up"
        fi
        if done_has pulih; then
            say "  Database ${CENTRAL_DB} dan ${TENANT_DB} hanya salinan baru. Mengulang dari NOL = hapus keduanya"
            say "  dan folder ${STATE_DIR} secara manual, setelah yakin."
        fi
    }

    trap 'fail "Perintah gagal di baris $LINENO."' ERR
    trap 'fail "Dibatalkan (Ctrl+C)."' INT TERM

    # ── Menjalankan satu langkah dengan status langsung ──────────────────────────
    # Perintah berjalan di latar; layar menampilkan spinner + waktu berjalan + baris
    # terakhir output (mis. paket yang sedang dipasang). Output penuh masuk ke log.
    step() {
        local label=$1
        shift
        STEP=$((STEP + 1))
        say ""
        say "${BOLD}${CYAN}[${STEP}/${TOTAL_STEPS}]${RESET}${BOLD} ${label}${RESET} ${DIM}· mulai $(clock)${RESET}"
        printf '$ %s\n' "$*" >>"$LOG"

        local start=$SECONDS rc=0 i=0 last_beat=$SECONDS line width
        # Subshell melepas trap induk (kegagalan dilaporkan sekali, oleh induk lewat kode keluar)
        # tetapi tetap set -e: langkah berisi beberapa perintah berhenti di perintah pertama yang gagal.
        (
            trap - ERR INT TERM
            "$@"
        ) </dev/null >>"$LOG" 2>&1 &
        CURRENT_PID=$!

        while kill -0 "$CURRENT_PID" 2>/dev/null; do
            if ((TTY)); then
                width=$((COLS - 16))
                if ((width < 20)); then width=20; fi
                line=$(tail -n 1 "$LOG" 2>/dev/null | tr -d '\000' | sed -E 's/.*\r//; s/\x1b\[[0-9;?]*[a-zA-Z]//g' | cut -c1-"$width")
                printf '\r\033[K  %s %-7s %s' "${SPIN[i % ${#SPIN[@]}]}" "$(fmt_dur $((SECONDS - start)))" "${DIM}${line}${RESET}"
                i=$((i + 1))
            elif ((SECONDS - last_beat >= 15)); then
                say "  … masih berjalan ($(fmt_dur $((SECONDS - start))))"
                last_beat=$SECONDS
            fi
            sleep 0.2
        done
        wait "$CURRENT_PID" || rc=$?
        CURRENT_PID=""
        if ((TTY)); then printf '\r\033[K'; fi

        if ((rc == 0)); then
            say "  ${GREEN}✓${RESET} selesai dalam $(fmt_dur $((SECONDS - start)))"
        else
            say "  ${RED}✗ gagal (kode ${rc}) setelah $(fmt_dur $((SECONDS - start)))${RESET}"
            fail "Langkah \"${label}\" gagal."
        fi
    }

    skip_step() {
        STEP=$((STEP + 1))
        say "${DIM}[${STEP}/${TOTAL_STEPS}] $1 · sudah selesai sebelumnya${RESET}"
    }

    # Langkah konversi yang dicatat: dilewati bila sudah selesai pada percobaan sebelumnya.
    done_has() { [[ -n "$STATE_DIR" && -f "$STATE_DIR/langkah" ]] && grep -qx "$1" "$STATE_DIR/langkah"; }
    kstep() {
        local key=$1 label=$2
        shift 2
        if done_has "$key"; then
            skip_step "$label"
        else
            step "$label" "$@"
            echo "$key" >>"$STATE_DIR/langkah"
        fi
    }

    save_params() {
        local k
        for k in "${PARAMS[@]}"; do printf '%s' "${!k}" >"$STATE_DIR/param-$k"; done
    }
    load_params() {
        local k
        for k in "${PARAMS[@]}"; do printf -v "$k" '%s' "$(<"$STATE_DIR/param-$k")"; done
    }

    confirm() {
        if ((ASSUME_YES)); then return 0; fi
        if [[ ! -t 0 ]]; then fail "Tidak ada terminal untuk konfirmasi; jalankan dengan --yes."; fi
        local answer
        say ""
        read -r -p "$1 [y/N] " answer
        if [[ ! "$answer" =~ ^[yY]$ ]]; then
            say "Dibatalkan, tidak ada yang diubah."
            exit 0
        fi
    }

    # ── .env & MySQL ────────────────────────────────────────────────────────────
    # Nilai dari .env (tanpa tanda kutip pembungkus).
    env_get() {
        local value
        value=$(grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true)
        value=${value%$'\r'}
        value=${value#\"} value=${value%\"}
        value=${value#\'} value=${value%\'}
        printf '%s' "$value"
    }

    # Ganti baris KEY= di .env, atau tambahkan bila belum ada. Nilai sudah divalidasi (tanpa | atau &).
    env_set() {
        if grep -qE "^$1=" .env; then
            sed -i "s|^$1=.*|$1=$2|" .env
        else
            printf '\n%s=%s\n' "$1" "$2" >>.env
        fi
    }

    local db_host db_port db_user
    db_host=$(env_get DB_HOST) db_port=$(env_get DB_PORT) db_user=$(env_get DB_USERNAME)
    MYSQL_ARGS=(${db_host:+"--host=$db_host"} ${db_port:+"--port=$db_port"} ${db_user:+"--user=$db_user"})

    my() { MYSQL_PWD="$(env_get DB_PASSWORD)" mysql "${MYSQL_ARGS[@]}" --default-character-set=utf8mb4 "$@"; }
    # sql "<query>" [database]: keluaran tanpa header, dipisah tab. Nama database divalidasi sebelum dipakai.
    sql() { my --batch --skip-column-names -e "$1" ${2:+"$2"} | tr -d '\r'; }
    db_exists() { [[ "$(sql "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '$1'")" == 1 ]]; }
    db_table_count() { sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$1'"; }
    table_exists() { [[ "$(sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$1' AND TABLE_NAME = '$2'")" == 1 ]]; }

    # Nama database disisipkan ke kueri. Panggil di konteks utama, bukan di dalam $(...):
    # fail di subshell hanya menghentikan subshell itu.
    check_db_name() {
        if [[ ! "$1" =~ ^[A-Za-z0-9_-]{1,64}$ ]]; then fail "Nama database \"$1\" hanya boleh huruf, angka, _ dan - (maks. 64)."; fi
    }

    # Bentuk database: lama (satu-database), pusat (multi-perusahaan berjalan), kosong (belum
    # terpasang, termasuk instalasi yang terputus atau walkthrough-nya belum dituntaskan),
    # atau asing (berisi tabel lain: ditolak, jangan sampai migrate menulis ke database lain).
    db_arch() {
        local users=0
        if table_exists "$1" users; then users=$(sql "SELECT COUNT(*) FROM users" "$1"); fi
        if table_exists "$1" invoices; then
            echo lama
        elif ((users > 0)); then
            if table_exists "$1" companies; then echo pusat; else echo asing; fi
        elif [[ "$(db_table_count "$1")" == 0 ]] || table_exists "$1" migrations; then
            echo kosong
        else
            echo asing
        fi
    }

    count_files() {
        if [[ -d "$1" ]]; then find "$1" -type f -not -path '*/.*' | wc -l | tr -d ' '; else echo 0; fi
    }

    same_count() {
        local a b
        a=$(sql "SELECT COUNT(*) FROM \`$1\`" "$2")
        b=$(sql "SELECT COUNT(*) FROM \`$1\`" "$3")
        echo "$1: $2=$a, $3=$b"
        [[ "$a" == "$b" ]]
    }

    # ── Langkah bersama ─────────────────────────────────────────────────────────
    check_prerequisites() {
        local cmd missing=0
        for cmd in git php composer node npm mysql mysqldump gzip tar; do
            if command -v "$cmd" >/dev/null; then
                echo "ok   $cmd"
            else
                echo "TIDAK ADA  $cmd"
                missing=1
            fi
        done
        case "$(env_get DB_CONNECTION)" in
            mysql | mariadb) ;;
            *)
                echo "DB_CONNECTION=$(env_get DB_CONNECTION): deploy.sh hanya mendukung mysql/mariadb."
                missing=1
                ;;
        esac
        return "$missing"
    }

    guard_worktree() {
        # Server tidak boleh punya perubahan yang belum di-commit: merge akan bentrok atau menimpanya.
        if ! git diff --quiet || ! git diff --cached --quiet; then
            say "${RED}Ada file yang diubah langsung di server:${RESET}"
            git status --short --untracked-files=no | sed 's/^/  /'
            fail "Simpan/buang perubahan itu dulu (mis. git stash), lalu jalankan ulang."
        fi
        if [[ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]]; then
            fail "Server sedang di branch $(git rev-parse --abbrev-ref HEAD), bukan ${BRANCH}."
        fi
    }

    resolve_commits() {
        PREV_COMMIT=$(git rev-parse HEAD)
        TARGET_COMMIT=$(git rev-parse "${REMOTE}/${BRANCH}")
        if ! git merge-base --is-ancestor "$PREV_COMMIT" "$TARGET_COMMIT"; then
            fail "Riwayat server berbeda dari ${REMOTE}/${BRANCH} (ada commit lokal di server). Selesaikan manual dulu."
        fi
    }

    show_incoming() {
        local incoming=$1 new_central new_tenant
        new_central=$(git diff --name-only --diff-filter=A "$PREV_COMMIT" "$TARGET_COMMIT" -- database/migrations | grep -vc '/tenant/' || true)
        new_tenant=$(git diff --name-only --diff-filter=A "$PREV_COMMIT" "$TARGET_COMMIT" -- database/migrations/tenant | grep -c . || true)
        say ""
        say "${BOLD}${incoming} commit baru${RESET} (${PREV_COMMIT:0:7} → ${TARGET_COMMIT:0:7}):"
        git log --oneline --no-decorate -n 15 "${PREV_COMMIT}..${TARGET_COMMIT}" | sed 's/^/  /' | tee -a "$LOG"
        if ((incoming > 15)); then say "  … dan $((incoming - 15)) commit lainnya"; fi
        say "  Migrasi baru: ${new_central} pusat, ${new_tenant} per perusahaan"
        git diff --quiet "$PREV_COMMIT" "$TARGET_COMMIT" -- composer.lock || say "  composer.lock berubah (paket PHP diperbarui)"
        git diff --quiet "$PREV_COMMIT" "$TARGET_COMMIT" -- package-lock.json || say "  package-lock.json berubah (paket JS diperbarui)"
    }

    # Cache config/route/event versi lama dibuang TANPA mem-boot aplikasi dan tanpa mengosongkan
    # cache aplikasi: optimize:clear di sini memicu worker antrean restart saat kode belum lengkap.
    pull_code() {
        rm -f bootstrap/cache/config.php bootstrap/cache/routes-*.php bootstrap/cache/events.php
        git merge --ff-only "$TARGET_COMMIT"
    }

    refresh_caches() {
        php artisan optimize:clear
        php artisan optimize
    }

    build_assets() {
        # public/hot (sisa `npm run dev`) membelokkan semua aset ke Vite: tiap halaman putih tanpa error.
        rm -f public/hot
        npm run build
    }

    # ── Pembaruan rutin (server multi-perusahaan) ──────────────────────────────
    run_routine() {
        TOTAL_STEPS=14
        step "Memeriksa prasyarat server" check_prerequisites
        step "Mengambil info perubahan dari GitHub (${REMOTE}/${BRANCH})" git fetch --prune "$REMOTE" "$BRANCH"
        guard_worktree

        resolve_commits
        local incoming database
        database=$(env_get DB_DATABASE)
        incoming=$(git rev-list --count "${PREV_COMMIT}..${TARGET_COMMIT}")
        if ((incoming == 0 && !FORCE)); then
            say ""
            say "${GREEN}Server sudah versi terbaru${RESET} (${PREV_COMMIT:0:7}). Tidak ada yang perlu dideploy."
            say "${DIM}Jalankan ./deploy.sh --force untuk mengulang semua langkah (mis. build ulang).${RESET}"
            return 0
        fi
        show_incoming "$incoming"

        # Canary: perusahaan pertama yang dimigrasi; bila gagal, perusahaan lain tidak disentuh.
        local canary
        canary=$(env_get DEPLOY_CANARY)
        if [[ -z "$canary" ]]; then
            canary=$(sql "SELECT id FROM companies WHERE status = 'active' ORDER BY created_at, id LIMIT 1" "$database")
        fi
        say "  Canary migrasi: ${canary:-(belum ada perusahaan)}"
        confirm "Lanjutkan deploy? Situs akan maintenance selama proses."

        BACKUP_DIR="storage/app/backups/deploy-${TS}"
        step "Backup database pusat + semua perusahaan" php artisan central:backup --dir="$BACKUP_DIR"
        step "Mengaktifkan mode maintenance" php artisan down --retry=60
        IN_MAINTENANCE=1
        step "Menarik kode ${TARGET_COMMIT:0:7}" pull_code
        PULLED=1
        step "Memasang paket PHP sesuai composer.lock" composer install --no-dev --optimize-autoloader --no-interaction
        step "Memasang paket JS sesuai package-lock.json" npm ci --no-audit --no-fund
        MIGRATE_STARTED=1
        step "Migrasi database: pusat → ${canary:+canary ${canary} → }semua perusahaan" \
            php artisan central:deploy-migrate --force ${canary:+"--canary=$canary"}
        step "Memberi role admin semua hak akses (termasuk fitur baru)" php artisan central:sync-admin-permissions
        step "Membangun aset frontend (npm run build)" build_assets
        step "Menyegarkan cache Laravel (optimize:clear + optimize)" refresh_caches
        step "Menyegarkan cache permission" php artisan permission:cache-reset
        step "Me-restart worker antrean" php artisan queue:restart
        step "Membuka kembali situs" php artisan up
        IN_MAINTENANCE=0

        trap - ERR INT TERM
        say ""
        say "${GREEN}${BOLD}DEPLOY SELESAI${RESET} dalam $(fmt_dur $((SECONDS - DEPLOY_START)))"
        say "  Versi  : ${PREV_COMMIT:0:7} → $(git rev-parse --short HEAD)"
        say "  Backup : ${BACKUP_DIR}"
        say "  Log    : ${LOG}"
        php artisan central:tenants-status 2>&1 | tee -a "$LOG" | sed 's/^/  /' || true
    }

    # ── Instalasi baru (database kosong) ───────────────────────────────────────
    prepare_install_env() {
        if [[ -z "$(env_get APP_KEY)" ]]; then php artisan key:generate --force; fi
        # Awalan database perusahaan unik per instalasi (server MySQL bisa dipakai bersama).
        if [[ -z "$(env_get TENANCY_DB_PREFIX)" ]]; then env_set TENANCY_DB_PREFIX "${TENANT_PREFIX}"; fi
        php artisan config:clear
        echo "TENANCY_DB_PREFIX=$(env_get TENANCY_DB_PREFIX)"
    }

    setup_fresh_central() {
        php artisan migrate --force
        php artisan db:seed --class=MasterPermissionSeeder --force
        php artisan central:sync-admin-permissions
        php artisan permission:cache-reset
        php artisan storage:link
    }

    # Tautan sekali pakai untuk walkthrough di website; berkasnya dihapus begitu admin pertama dibuat.
    # Instalasi yang dilanjutkan memakai tautan yang sama.
    arm_setup_wizard() {
        if [[ ! -s storage/app/setup-token ]]; then php -r 'echo bin2hex(random_bytes(16));' >storage/app/setup-token; fi
        chmod 600 storage/app/setup-token
        echo "tautan pemasangan disiapkan"
    }

    # Tiap perusahaan = satu database baru berawalan TENANT_PREFIX. User MySQL buatan panel hosting
    # (mis. CloudPanel) biasanya hanya berhak atas satu database: walkthrough lalu gagal di akhir.
    # Database uji bernama acak; CREATE tanpa IF NOT EXISTS, jadi yang dihapus pasti buatan sendiri.
    check_create_privilege() {
        local probe="${TENANT_PREFIX}cek$$" user
        if sql "CREATE DATABASE \`${probe}\`" >/dev/null 2>&1; then
            sql "DROP DATABASE \`${probe}\`"
            return 0
        fi
        user=$(env_get DB_USERNAME)
        say ""
        say "${RED}User MySQL ${user} tidak boleh membuat database ${TENANT_PREFIX}…${RESET} (satu per perusahaan)."
        say "  Jalankan sekali sebagai root MySQL (host disesuaikan dengan user itu), lalu ulangi ./deploy.sh:"
        say "  GRANT ALL PRIVILEGES ON \`${1}\_%\`.* TO '${user}'@'localhost';"
        fail "Hak membuat database perusahaan belum ada."
    }

    run_install() {
        TOTAL_STEPS=11
        local database
        database=$(env_get DB_DATABASE)
        TENANT_PREFIX="${database}_tenant_"
        step "Memeriksa prasyarat server" check_prerequisites
        step "Mengambil info perubahan dari GitHub (${REMOTE}/${BRANCH})" git fetch --prune "$REMOTE" "$BRANCH"
        guard_worktree
        resolve_commits
        check_create_privilege "$database"

        say ""
        say "${BOLD}Instalasi baru${RESET}: database ${database} belum terpasang."
        say "  Sesudah ini website memandu pembuatan akun admin dan perusahaan pertama."
        confirm "Siapkan instalasi baru?"

        step "Menarik kode ${TARGET_COMMIT:0:7}" pull_code
        PULLED=1
        step "Memasang paket PHP sesuai composer.lock" composer install --no-dev --optimize-autoloader --no-interaction
        step "Memasang paket JS sesuai package-lock.json" npm ci --no-audit --no-fund
        step "Membangun aset frontend (npm run build)" build_assets
        step "Menyiapkan .env (kunci aplikasi, awalan database perusahaan)" prepare_install_env
        step "Menyiapkan database pusat: struktur, peran & izin" setup_fresh_central
        step "Menyiapkan tautan pemasangan di website" arm_setup_wizard
        step "Membuat cache Laravel (optimize)" refresh_caches
        step "Me-restart worker antrean" php artisan queue:restart

        trap - ERR INT TERM
        local url
        url=$(env_get APP_URL)
        say ""
        say "${GREEN}${BOLD}INSTALASI DASAR SELESAI${RESET} dalam $(fmt_dur $((SECONDS - DEPLOY_START)))"
        say ""
        say "${BOLD}Lanjutkan di website:${RESET} ${url}/setup/$(<storage/app/setup-token)"
        say "  Tautan sekali pakai: membuat akun admin dan perusahaan pertama, lalu memandu"
        say "  pengisian profil perusahaan. Jangan bagikan tautan ini."
        say "  Log: ${LOG}"
    }

    # ── Konversi: server lama satu-database → perusahaan utama ─────────────────
    redated_migrations() {
        # Migration tenant yang tertunda tetapi namanya (tanpa tanggal) sudah tercatat di DB lama:
        # akan dijalankan ulang dan adopsi mati di "Duplicate column" (runbook §G.2.7).
        local recorded name
        recorded=$(sql "SELECT migration FROM migrations" "$LEGACY_DB" | LC_ALL=C sort)
        LC_ALL=C comm -13 <(printf '%s\n' "$recorded") \
            <(git ls-tree --name-only "${TARGET_COMMIT}:database/migrations/tenant" | sed -n 's/\.php$//p' | LC_ALL=C sort) |
            while read -r name; do
                if grep -qxE "[0-9_]{17}_${name:18}" <<<"$recorded"; then printf '%s ' "$name"; fi
            done
    }

    preflight_conversion() {
        LEGACY_DB=$(env_get DB_DATABASE)
        check_db_name "$LEGACY_DB"
        resolve_commits
        if ! git cat-file -e "${TARGET_COMMIT}:database/migrations/tenant" 2>/dev/null; then
            fail "${REMOTE}/${BRANCH} belum berisi kode multi-perusahaan; tidak ada yang perlu dikonversi."
        fi

        CENTRAL_DB="${LEGACY_DB}_central"
        TENANT_PREFIX="${LEGACY_DB}_tenant_"
        TENANT_DB="${TENANT_PREFIX}${SLUG}"
        check_db_name "$CENTRAL_DB"
        check_db_name "$TENANT_DB"

        COMPANY_NAME=$(sql "SELECT name FROM company_profiles ORDER BY id LIMIT 1" "$LEGACY_DB" 2>/dev/null || true)
        COMPANY_NAME=${COMPANY_NAME:-Perusahaan Utama}
        # Singkatan diisi admin di website (Profil Perusahaan, wajib sebelum aplikasi bisa dipakai);
        # di sini hanya dipakai bila profil lama sudah menyimpannya.
        ABBR=$(sql "SELECT UPPER(COALESCE(abbreviation, '')) FROM company_profiles ORDER BY id LIMIT 1" "$LEGACY_DB" 2>/dev/null || true)
        if [[ ! "$ABBR" =~ ^[A-Z]{2,10}$ ]]; then ABBR=""; fi

        local name
        for name in "$CENTRAL_DB" "$TENANT_DB"; do
            if db_exists "$name" && (($(db_table_count "$name") > 0)); then
                fail "Database ${name} sudah ada dan berisi tabel. Konversi hanya menulis ke database baru atau kosong."
            fi
        done

        # Cast 'hashed' di model User menolak hash ber-cost di atas BCRYPT_ROUNDS: impor user mati di user pertama.
        local rounds max_cost others
        rounds=$(env_get BCRYPT_ROUNDS)
        rounds=${rounds:-12}
        max_cost=$(sql "SELECT COALESCE(MAX(CAST(SUBSTRING(password, 5, 2) AS UNSIGNED)), 0) FROM users WHERE password REGEXP '^[\$]2[aby][\$]'" "$LEGACY_DB")
        others=$(sql "SELECT COUNT(*) FROM users WHERE password NOT REGEXP '^[\$]2[aby][\$]'" "$LEGACY_DB")
        if ((others > 0)); then fail "${others} user bersandi non-bcrypt; impor user akan menolaknya. Periksa tabel users DB lama."; fi
        if ((max_cost > rounds)); then fail "Hash sandi lama ber-cost ${max_cost}, BCRYPT_ROUNDS=${rounds}. Setel BCRYPT_ROUNDS=${max_cost} di .env lalu ulangi."; fi

        local redated
        redated=$(redated_migrations)
        if [[ -n "$redated" ]]; then
            fail "Migration tenant ini hanya diberi tanggal baru dan akan dijalankan ulang: ${redated}(runbook §G.2.7). Perbaiki di kode dulu."
        fi
        # Uji baseline sekarang juga: skema yang tidak cocok ketahuan sebelum situs dimatikan.
        git show "${TARGET_COMMIT}:docs/migrasi/verifikasi-baseline.sql" | my --batch "$LEGACY_DB" >/dev/null

        local users invoices files jobs direct
        users=$(sql "SELECT COUNT(*) FROM users" "$LEGACY_DB")
        invoices=$(sql "SELECT COUNT(*) FROM invoices" "$LEGACY_DB")
        files=$(count_files storage/app/public)
        jobs=$(sql "SELECT COUNT(*) FROM jobs" "$LEGACY_DB" 2>/dev/null || echo 0)
        direct=$(sql "SELECT COUNT(*) FROM model_has_permissions" "$LEGACY_DB" 2>/dev/null || echo 0)

        say ""
        say "${BOLD}Server ini masih versi lama (satu database). Rencana konversi:${RESET}"
        say "  Perusahaan      : ${COMPANY_NAME} → perusahaan utama, alamat /c/${SLUG}"
        say "  Database lama   : ${LEGACY_DB} (datanya hanya dibaca, tidak diubah)"
        say "  Database pusat  : ${CENTRAL_DB} (baru: user, role, perusahaan)"
        say "  Database usaha  : ${TENANT_DB} (salinan data bisnis DB lama)"
        say "  Isi DB lama     : ${users} user, ${invoices} invoice, ${files} berkas lampiran"
        say "  Kode            : ${PREV_COMMIT:0:7} → ${TARGET_COMMIT:0:7} ($(git rev-list --count "${PREV_COMMIT}..${TARGET_COMMIT}") commit)"
        say "  Sesudahnya di website: admin melengkapi profil (singkatan dll.) dan meninjau nomor invoice lama."
        if ((jobs > 0)); then say "${YELLOW}  • ${jobs} job antrean di DB lama belum diproses dan tidak ikut pindah.${RESET}"; fi
        if ((direct > 0)); then say "${YELLOW}  • ${direct} izin langsung per-user tidak ikut pindah${RESET} (role & izin role ikut)."; fi
        say "  Downtime: dump + restore + composer/npm + build. Siapkan jendela 1 jam."
        confirm "Konversi sekarang? Situs akan maintenance selama proses."
    }

    create_databases() {
        local db
        for db in "$CENTRAL_DB" "$TENANT_DB"; do
            if db_exists "$db"; then
                echo "sudah ada (kosong): $db"
            elif sql "CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"; then
                echo "dibuat: $db"
            else
                echo "User MySQL di .env tidak boleh membuat database ${db}."
                echo "Beri user ini hak penuh atas \`${LEGACY_DB}\\_%\` (lihat docs/guides/DEPLOY.md), lalu ulangi."
                return 1
            fi
        done
    }

    freeze() {
        MYSQL_PWD="$(env_get DB_PASSWORD)" mysqldump "${MYSQL_ARGS[@]}" --single-transaction --quick --routines \
            --triggers --no-tablespaces --default-character-set=utf8mb4 "$LEGACY_DB" | gzip >"$STATE_DIR/freeze.sql.gz"
        gzip -t "$STATE_DIR/freeze.sql.gz"
        # Dump utuh = baris terakhirnya "-- Dump completed". Jangan `gzip -dc | grep -q` langsung:
        # grep berhenti di kecocokan pertama, gzip mati SIGPIPE (141), dan pipefail menggagalkan langkah.
        gzip -dc "$STATE_DIR/freeze.sql.gz" | tail -n 1 | grep -q 'Dump completed'
        echo "dump ${LEGACY_DB}: $(du -h "$STATE_DIR/freeze.sql.gz" | cut -f1)"
        if [[ -d storage/app/public ]]; then tar czf "$STATE_DIR/storage-lama.tgz" -C storage/app public; fi
        if [[ ! -f "$STATE_DIR/env-lama" ]]; then cp .env "$STATE_DIR/env-lama"; fi
        chmod 600 "$STATE_DIR"/*
    }

    baseline() {
        git show "${TARGET_COMMIT}:docs/migrasi/verifikasi-baseline.sql" | my --batch "$1" >"$2"
        echo "baseline $1 → $2 ($(wc -l <"$2") baris)"
    }

    restore_tenant() {
        local tables
        tables=$(db_table_count "$TENANT_DB")
        if ((tables > 0)); then
            echo "${TENANT_DB} sudah berisi ${tables} tabel (restore sebelumnya terputus?); tidak ditimpa."
            echo "DB lama tetap utuh. Hapus ${TENANT_DB} secara manual, lalu lanjutkan."
            return 1
        fi
        gzip -dc "$STATE_DIR/freeze.sql.gz" | my "$TENANT_DB"
        same_count invoices "$LEGACY_DB" "$TENANT_DB"
        same_count bank_transactions "$LEGACY_DB" "$TENANT_DB"
    }

    switch_env() {
        env_set DB_DATABASE "$CENTRAL_DB"
        env_set LEGACY_DB_DATABASE "$LEGACY_DB"
        env_set TENANCY_DB_PREFIX "$TENANT_PREFIX"
        php artisan config:clear
        echo "DB_DATABASE=${CENTRAL_DB}  LEGACY_DB_DATABASE=${LEGACY_DB}  TENANCY_DB_PREFIX=${TENANT_PREFIX}"
    }

    # Role & izin mengikuti DB lama (termasuk yang diubah lewat halaman Izin & Peran);
    # izin yang baru ada di rilis ini mengikuti bawaan MasterPermissionSeeder.
    carry_roles() {
        local L="\`${LEGACY_DB}\`" C="\`${CENTRAL_DB}\`"
        # Database default (argumen terakhir) wajib: DELETE multi-tabel ber-alias gagal
        # "No database selected" tanpanya, walau semua nama tabel sudah lengkap.
        sql "
            INSERT INTO ${C}.roles (name, guard_name, icon, created_at, updated_at)
            SELECT l.name, l.guard_name, l.icon, l.created_at, l.updated_at FROM ${L}.roles l
            WHERE NOT EXISTS (SELECT 1 FROM ${C}.roles c WHERE c.name = l.name AND c.guard_name = l.guard_name);
            SELECT CONCAT('role dari DB lama yang tidak ada di bawaan: ', ROW_COUNT());
            INSERT INTO ${C}.permissions (name, guard_name, created_at, updated_at)
            SELECT l.name, l.guard_name, l.created_at, l.updated_at FROM ${L}.permissions l
            WHERE NOT EXISTS (SELECT 1 FROM ${C}.permissions c WHERE c.name = l.name AND c.guard_name = l.guard_name);
            SELECT CONCAT('permission dari DB lama yang tidak ada di bawaan: ', ROW_COUNT());
            DELETE rhp FROM ${C}.role_has_permissions rhp
            JOIN ${C}.roles r ON r.id = rhp.role_id
            JOIN ${C}.permissions p ON p.id = rhp.permission_id
            JOIN ${L}.roles lr ON lr.name = r.name AND lr.guard_name = r.guard_name
            JOIN ${L}.permissions lp ON lp.name = p.name AND lp.guard_name = p.guard_name
            LEFT JOIN ${L}.role_has_permissions lh ON lh.role_id = lr.id AND lh.permission_id = lp.id
            WHERE lh.role_id IS NULL;
            SELECT CONCAT('izin bawaan yang di DB lama memang dicabut: ', ROW_COUNT());
            INSERT IGNORE INTO ${C}.role_has_permissions (permission_id, role_id)
            SELECT p.id, r.id FROM ${L}.role_has_permissions lh
            JOIN ${L}.roles lr ON lr.id = lh.role_id
            JOIN ${L}.permissions lp ON lp.id = lh.permission_id
            JOIN ${C}.roles r ON r.name = lr.name AND r.guard_name = lr.guard_name AND r.company_id IS NULL
            JOIN ${C}.permissions p ON p.name = lp.name AND p.guard_name = lp.guard_name;
            SELECT CONCAT('izin tambahan dari DB lama: ', ROW_COUNT());" "$CENTRAL_DB"
    }

    setup_central() {
        php artisan migrate --force
        php artisan db:seed --class=MasterPermissionSeeder --force
        carry_roles
        # Izin role lama disalin apa adanya, kecuali admin: admin selalu memegang semua.
        php artisan central:sync-admin-permissions
        php artisan permission:cache-reset
    }

    org_slug() { php -r 'require "vendor/autoload.php"; echo Illuminate\Support\Str::slug($argv[1]);' -- "$COMPANY_NAME"; }

    tenant_pending() {
        LC_ALL=C comm -23 <(ls database/migrations/tenant | sed -n 's/\.php$//p' | LC_ALL=C sort) \
            <(sql "SELECT migration FROM migrations" "$TENANT_DB" | LC_ALL=C sort)
    }

    adopt_database() {
        php artisan central:adopt-database "$SLUG" --organization="$(org_slug)" --name="$COMPANY_NAME" --abbreviation="$ABBR"
        # adopt-database tidak atomik: perusahaan terdaftar dulu, migrate menyusul. Status
        # 'active' tidak membuktikan apa-apa; yang membuktikan: 0 migration tenant tertunda.
        local pending
        pending=$(tenant_pending)
        if [[ -n "$pending" ]]; then
            echo "Migration tenant belum tercatat di ${TENANT_DB}:"
            echo "$pending"
            return 1
        fi
        echo "Migration tenant: 0 tertunda"
    }

    import_users() {
        php artisan central:import-users legacy --organization="$(org_slug)" --company="$SLUG"
        # Data bisnis menyimpan ID user (pemilik reimbursement, penyetuju, pencair dana): ID + email harus sama persis.
        local missing
        missing=$(sql "SELECT COUNT(*) FROM \`${LEGACY_DB}\`.users l LEFT JOIN \`${CENTRAL_DB}\`.users c ON c.id = l.id AND c.email = l.email WHERE c.id IS NULL")
        echo "User DB lama tanpa pasangan ID + email yang sama di pusat: ${missing}"
        ((missing == 0))
    }

    copy_feedbacks() {
        if ! table_exists "$LEGACY_DB" feedbacks; then
            echo "DB lama tanpa tabel feedbacks; dilewati."
            return 0
        fi
        sql "
            INSERT INTO \`${CENTRAL_DB}\`.feedbacks (id, user_id, company_id, title, description, type, priority, status,
                page_url, attachment_path, attachment_name, admin_response, responded_by, responded_at, created_at, updated_at)
            SELECT l.id, l.user_id, '${SLUG}', l.title, l.description, l.type, l.priority, l.status,
                l.page_url, l.attachment_path, l.attachment_name, l.admin_response, l.responded_by, l.responded_at, l.created_at, l.updated_at
            FROM \`${LEGACY_DB}\`.feedbacks l
            WHERE NOT EXISTS (SELECT 1 FROM \`${CENTRAL_DB}\`.feedbacks c WHERE c.id = l.id);
            SELECT CONCAT('feedback disalin: ', ROW_COUNT());"
        same_count feedbacks "$LEGACY_DB" "$CENTRAL_DB"
    }

    adopt_files() {
        php artisan central:adopt-storage "$SLUG"
        php artisan storage:link
        local lama baru
        lama=$(count_files storage/app/public)
        baru=$(count_files "storage/tenant${SLUG}/app/public")
        echo "Berkas: lama ${lama}, folder perusahaan ${baru}"
        ((baru >= lama))
    }

    verify_baseline() {
        baseline "$TENANT_DB" "$STATE_DIR/sesudah.txt"
        # Yang boleh berbeda hanya dua blok terakhir: urutan nomor invoice dan pola penomoran.
        if ! diff <(sed '/== NOMOR & URUTAN INVOICE ==/,$d' "$STATE_DIR/sebelum.txt") \
            <(sed '/== NOMOR & URUTAN INVOICE ==/,$d' "$STATE_DIR/sesudah.txt"); then
            echo "Jumlah baris, total nilai, atau saldo BERBEDA dari sebelum konversi (lihat diff di atas)."
            return 1
        fi
        echo "Jumlah baris, total nilai, dan saldo per rekening identik dengan sebelum konversi."
    }

    finalize_caches() {
        # Worker antrean yang masih hidup memuat config LAMA di memori dan menunggu sinyal restart di
        # cache database LAMA. Tanpa sinyal di sana, worker itu terus membaca antrean database lama.
        # Harus sebelum optimize: variabel lingkungan hanya menimpa .env selama config belum di-cache.
        DB_DATABASE="$LEGACY_DB" php artisan queue:restart
        php artisan optimize
        php artisan queue:restart
        php artisan permission:cache-reset
    }

    run_conversion() {
        TOTAL_STEPS=21
        STATE_DIR="storage/app/cutover/${SLUG}"
        step "Memeriksa prasyarat server" check_prerequisites
        step "Mengambil info perubahan dari GitHub (${REMOTE}/${BRANCH})" git fetch --prune "$REMOTE" "$BRANCH"
        guard_worktree

        local resumed=""
        if [[ -f "$STATE_DIR/langkah" ]]; then
            load_params
            resumed=" (percobaan ini)"
            say ""
            say "${BOLD}Melanjutkan konversi${RESET}. Sudah selesai: $(paste -sd' ' "$STATE_DIR/langkah")"
        else
            preflight_conversion
            mkdir -p "$STATE_DIR"
            chmod 700 "$STATE_DIR"
            save_params
            : >"$STATE_DIR/langkah"
        fi
        if [[ "$(git rev-parse HEAD)" == "$TARGET_COMMIT" ]]; then PULLED=1; fi

        kstep db "Menyiapkan database ${CENTRAL_DB} dan ${TENANT_DB}" create_databases
        step "Mengaktifkan mode maintenance" php artisan down --retry=60
        IN_MAINTENANCE=1
        kstep beku "Membekukan data lama: dump ${LEGACY_DB}, arsip berkas, salinan .env" freeze
        kstep baseline "Mencatat angka sebelum konversi (baris, nilai, saldo)" baseline "$LEGACY_DB" "$STATE_DIR/sebelum.txt"
        kstep pulih "Memulihkan dump sebagai ${TENANT_DB}" restore_tenant
        kstep kode "Menarik kode ${TARGET_COMMIT:0:7}" pull_code
        PULLED=1
        kstep composer "Memasang paket PHP sesuai composer.lock" composer install --no-dev --optimize-autoloader --no-interaction
        kstep npm "Memasang paket JS sesuai package-lock.json" npm ci --no-audit --no-fund
        kstep build "Membangun aset frontend (npm run build)" build_assets
        kstep env "Mengarahkan .env ke database pusat ${CENTRAL_DB}" switch_env
        kstep pusat "Menyiapkan database pusat: migrate, permission, role & izin lama" setup_central
        kstep organisasi "Membuat grup ${COMPANY_NAME}" php artisan central:bootstrap --tanpa-admin --organization="$COMPANY_NAME"
        kstep adopsi "Mendaftarkan ${TENANT_DB} sebagai perusahaan utama" adopt_database
        kstep user "Mengimpor user (ID lama dipertahankan)" import_users
        kstep feedback "Menyalin riwayat feedback" copy_feedbacks
        kstep berkas "Menyalin berkas lampiran ke folder perusahaan" adopt_files
        step "Membandingkan angka sebelum & sesudah" verify_baseline
        step "Membuat cache dan me-restart worker antrean" finalize_caches
        step "Membuka kembali situs" php artisan up
        IN_MAINTENANCE=0
        date '+%d %b %Y %H:%M' >"$STATE_DIR/selesai"

        trap - ERR INT TERM
        local url
        url=$(env_get APP_URL)
        say ""
        say "${GREEN}${BOLD}KONVERSI SELESAI${RESET} dalam $(fmt_dur $((SECONDS - DEPLOY_START)))${resumed}"
        say "  Perusahaan utama : ${COMPANY_NAME} → ${url}/c/${SLUG}"
        say "  Database         : pusat ${CENTRAL_DB}, perusahaan ${TENANT_DB}. Data DB lama ${LEGACY_DB} tidak diubah; simpan dulu."
        say "  Arsip            : ${STATE_DIR} (freeze.sql.gz, storage-lama.tgz, env-lama, sebelum/sesudah.txt)"
        say "                     ${YELLOW}Salin ke luar server${RESET}, lalu simpan. Berisi data & rahasia .env lama."
        say "  Log              : ${LOG}"
        say ""
        if php artisan central:backup >>"$LOG" 2>&1; then
            say "  Backup pertama arsitektur baru: storage/app/backups/ ✓"
        else
            say "  ${YELLOW}Backup pertama gagal${RESET}; jalankan manual: php artisan central:backup (lihat log)"
        fi
        php artisan central:tenants-status 2>&1 | tee -a "$LOG" | sed 's/^/  /' || true
        say ""
        say "${BOLD}Lanjutkan di website (segera, sebelum staff masuk):${RESET}"
        say "  1. Login sebagai admin dengan sandi lama. Aplikasi memandu melengkapi profil perusahaan"
        say "     (singkatan dll.), lalu meninjau nomor invoice lama di Penomoran invoice."
        say "     Sampai itu selesai, user lain melihat \"perusahaan belum disiapkan\"."
        say "  2. Cek: buat draft invoice → terbitkan → nomornya melanjutkan nomor terakhir → hapus draft itu."
        say "  Pembaruan berikutnya cukup: ./deploy.sh"
    }

    # ── Mulai: pilih mode dari bentuk database ─────────────────────────────────
    if ! command -v mysql >/dev/null || ! sql "SELECT 1" >/dev/null; then
        echo "Tidak bisa memeriksa database: perintah mysql tidak ada atau kredensial DB_* di .env salah."
        echo "deploy.sh membaca baris KEY=nilai atau KEY=\"nilai\" apa adanya: tanpa komentar di baris yang sama,"
        echo "tanpa spasi di sekitar '='. Nilai berisi # atau spasi wajib diapit tanda kutip."
        return 1
    fi
    local database d
    database=$(env_get DB_DATABASE)
    check_db_name "$database"
    for d in storage/app/cutover/*/; do
        if [[ -f "${d}langkah" && ! -f "${d}selesai" ]]; then MODE=konversi; fi
    done
    if [[ -z "$MODE" ]]; then
        case "$(db_arch "$database")" in
            pusat) MODE=rutin ;;
            lama) MODE=konversi ;;
            kosong) MODE=instalasi ;;
            *)
                echo "Database ${database} berisi tabel yang bukan milik aplikasi ini. Periksa DB_DATABASE di .env."
                return 1
                ;;
        esac
    fi

    say "${BOLD}Deploy finance-management · ${MODE}${RESET} ${DIM}· $(date '+%d %b %Y %H:%M:%S') · log: ${LOG}${RESET}"
    case "$MODE" in
        rutin) run_routine ;;
        konversi) run_conversion ;;
        instalasi) run_install ;;
    esac
}

main "$@"; exit $?
