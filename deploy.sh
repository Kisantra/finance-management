#!/usr/bin/env bash
#
# deploy.sh — tarik perubahan terbaru dari GitHub dan terapkan ke server dengan aman.
#
# Pemakaian:
#   ./deploy.sh            tampilkan perubahan yang masuk, minta konfirmasi, lalu deploy
#   ./deploy.sh --yes      tanpa konfirmasi
#   ./deploy.sh --force    jalankan semua langkah walau tidak ada commit baru (mis. build ulang)
#
# Urutan: prasyarat → cek perubahan → backup database → maintenance → git pull →
# composer install → npm ci → migrate → build → cache → cache permission → restart queue → online.
#
# Gagal di langkah mana pun: skrip berhenti, situs TETAP dalam mode maintenance (pengguna
# tidak melihat aplikasi setengah jadi), dan menampilkan cara memulihkan.
# Output lengkap tiap perintah: storage/logs/deploy-<waktu>.log
#
# Permission baru ikut lewat migrasi, bukan MasterPermissionSeeder — seeder itu menyetel
# ulang izin semua role (syncPermissions) sehingga perubahan dari halaman Izin & Peran hilang.
# Lihat docs/guides/DEPLOY.md.
#
# Seluruh isi dibungkus main() dan dipanggil di baris terakhir: bash mem-parse fungsi utuh
# sebelum menjalankannya, jadi `git pull` yang mengubah file ini di tengah jalan aman.

main() {
    set -Eeuo pipefail

    local REMOTE=origin BRANCH=main KEEP_BACKUPS=10
    local ASSUME_YES=0 FORCE=0 arg
    for arg in "$@"; do
        case "$arg" in
            -y | --yes) ASSUME_YES=1 ;;
            -f | --force) FORCE=1 ;;
            -h | --help)
                sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
                return 0
                ;;
            *)
                echo "Opsi tidak dikenal: $arg (lihat ./deploy.sh --help)"
                return 1
                ;;
        esac
    done

    cd "$(dirname "$(readlink -f "$0")")"

    local TS LOG BACKUP_DIR BACKUP_FILE=""
    TS=$(date +%Y%m%d-%H%M%S)
    mkdir -p storage/logs
    LOG="storage/logs/deploy-$TS.log"
    BACKUP_DIR="storage/backups"

    local TOTAL_STEPS=13 STEP=0 DEPLOY_START=$SECONDS CURRENT_PID=""
    local IN_MAINTENANCE=0 PULLED=0 MIGRATE_STARTED=0 NEW_MIGRATIONS=0
    local PREV_COMMIT="" TARGET_COMMIT=""

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

    # ── Gagal: hentikan, jelaskan, tunjukkan jalan pulang ────────────────────────
    fail() {
        trap - ERR INT TERM
        if [[ -n "$CURRENT_PID" ]]; then kill "$CURRENT_PID" 2>/dev/null || true; fi
        ((TTY)) && printf '\r\033[K'
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
        if ((IN_MAINTENANCE)); then
            say "${YELLOW}Situs MASIH dalam mode maintenance${RESET} supaya pengguna tidak melihat aplikasi setengah jadi."
            say "  • Perbaiki masalahnya lalu jalankan ulang: ./deploy.sh --force"
            say "  • Atau buka kembali apa adanya:            php artisan up"
        fi
        if ((PULLED)); then
            say "Kembali ke versi sebelumnya (${PREV_COMMIT:0:7}), berurutan:"
            if ((MIGRATE_STARTED && NEW_MIGRATIONS > 0)); then
                # Harus sebelum reset: setelah reset, file migrasi rilis ini sudah tidak ada.
                say "  php artisan migrate:rollback --step=${NEW_MIGRATIONS}   # batalkan ${NEW_MIGRATIONS} migrasi baru rilis ini"
            fi
            say "  git reset --hard ${PREV_COMMIT}"
            say "  composer install --no-dev --optimize-autoloader && npm ci && npm run build"
            say "  php artisan optimize:clear && php artisan optimize && php artisan up"
        fi
        if [[ -n "$BACKUP_FILE" && -s "$BACKUP_FILE" ]]; then
            say "Backup database sebelum deploy: ${BACKUP_FILE}"
            say "  Pulihkan: gunzip < ${BACKUP_FILE} | mysql -h <host> -u <user> -p <database>"
        fi
        say "Log lengkap: ${LOG}"
        exit 1
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
                ((width < 20)) && width=20
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
        ((TTY)) && printf '\r\033[K'

        if ((rc == 0)); then
            say "  ${GREEN}✓${RESET} selesai dalam $(fmt_dur $((SECONDS - start)))"
        else
            say "  ${RED}✗ gagal (kode ${rc}) setelah $(fmt_dur $((SECONDS - start)))${RESET}"
            fail "Langkah \"${label}\" gagal."
        fi
    }

    # ── Isi langkah ─────────────────────────────────────────────────────────────
    check_prerequisites() {
        local cmd missing=0
        for cmd in git php composer node npm mysqldump gzip; do
            if command -v "$cmd" >/dev/null; then
                echo "ok   $cmd"
            else
                echo "TIDAK ADA  $cmd"
                missing=1
            fi
        done
        [[ -f .env ]] || { echo "File .env tidak ditemukan."; missing=1; }
        [[ -f artisan ]] || { echo "File artisan tidak ditemukan — jalankan dari folder aplikasi."; missing=1; }
        return "$missing"
    }

    # Nilai dari .env (tanpa tanda kutip pembungkus).
    env_get() {
        local value
        value=$(grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true)
        value=${value%$'\r'}
        value=${value#\"} value=${value%\"}
        value=${value#\'} value=${value%\'}
        printf '%s' "$value"
    }

    backup_database() {
        local connection database
        connection=$(env_get DB_CONNECTION)
        database=$(env_get DB_DATABASE)
        case "$connection" in
            mysql | mariadb) ;;
            *)
                echo "DB_CONNECTION=${connection:-kosong}: backup otomatis hanya untuk mysql/mariadb."
                return 1
                ;;
        esac
        mkdir -p "$BACKUP_DIR"
        echo "Membuat dump ${database} → ${BACKUP_FILE}"
        if ! MYSQL_PWD="$(env_get DB_PASSWORD)" mysqldump \
            --host="$(env_get DB_HOST)" --port="$(env_get DB_PORT)" --user="$(env_get DB_USERNAME)" \
            --single-transaction --quick --routines --no-tablespaces "$database" | gzip >"$BACKUP_FILE"; then
            rm -f "$BACKUP_FILE"
            return 1
        fi
        echo "Ukuran backup: $(du -h "$BACKUP_FILE" | cut -f1)"
        # Simpan ${KEEP_BACKUPS} backup terbaru saja supaya disk tidak penuh.
        ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f --
    }

    refresh_caches() {
        php artisan optimize:clear
        php artisan optimize
    }

    # ── Mulai ───────────────────────────────────────────────────────────────────
    say "${BOLD}Deploy finance-management${RESET} ${DIM}· $(date '+%d %b %Y %H:%M:%S') · log: ${LOG}${RESET}"

    step "Memeriksa prasyarat server" check_prerequisites
    step "Mengambil info perubahan dari GitHub (${REMOTE}/${BRANCH})" git fetch --prune "$REMOTE" "$BRANCH"

    # Server tidak boleh punya perubahan yang belum di-commit: pull akan bentrok atau menimpanya.
    if ! git diff --quiet || ! git diff --cached --quiet; then
        say "${RED}Ada file yang diubah langsung di server:${RESET}"
        git status --short --untracked-files=no | sed 's/^/  /'
        fail "Simpan/buang perubahan itu dulu (mis. git stash), lalu jalankan ulang."
    fi
    if [[ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]]; then
        fail "Server sedang di branch $(git rev-parse --abbrev-ref HEAD), bukan ${BRANCH}."
    fi

    PREV_COMMIT=$(git rev-parse HEAD)
    TARGET_COMMIT=$(git rev-parse "${REMOTE}/${BRANCH}")
    if ! git merge-base --is-ancestor "$PREV_COMMIT" "$TARGET_COMMIT"; then
        fail "Riwayat server berbeda dari ${REMOTE}/${BRANCH} (ada commit lokal di server). Selesaikan manual dulu."
    fi

    local incoming
    incoming=$(git rev-list --count "${PREV_COMMIT}..${TARGET_COMMIT}")
    if ((incoming == 0 && !FORCE)); then
        say ""
        say "${GREEN}Server sudah versi terbaru${RESET} (${PREV_COMMIT:0:7}). Tidak ada yang perlu dideploy."
        say "${DIM}Jalankan ./deploy.sh --force untuk mengulang semua langkah (mis. build ulang).${RESET}"
        return 0
    fi

    NEW_MIGRATIONS=$(git diff --name-only --diff-filter=A "$PREV_COMMIT" "$TARGET_COMMIT" -- database/migrations | wc -l | tr -d ' ')
    say ""
    say "${BOLD}${incoming} commit baru${RESET} (${PREV_COMMIT:0:7} → ${TARGET_COMMIT:0:7}):"
    git log --oneline --no-decorate -n 15 "${PREV_COMMIT}..${TARGET_COMMIT}" | sed 's/^/  /' | tee -a "$LOG"
    ((incoming > 15)) && say "  … dan $((incoming - 15)) commit lainnya"
    say "  Migrasi baru: ${NEW_MIGRATIONS}"
    git diff --quiet "$PREV_COMMIT" "$TARGET_COMMIT" -- composer.lock || say "  composer.lock berubah (paket PHP diperbarui)"
    git diff --quiet "$PREV_COMMIT" "$TARGET_COMMIT" -- package-lock.json || say "  package-lock.json berubah (paket JS diperbarui)"

    if ((!ASSUME_YES)); then
        if [[ ! -t 0 ]]; then
            fail "Tidak ada terminal untuk konfirmasi; jalankan dengan --yes."
        fi
        local answer
        say ""
        read -r -p "Lanjutkan deploy? Situs akan maintenance selama proses. [y/N] " answer
        [[ "$answer" =~ ^[yY]$ ]] || { say "Dibatalkan, tidak ada yang diubah."; return 0; }
    fi

    BACKUP_FILE="${BACKUP_DIR}/db-${TS}.sql.gz"
    step "Backup database" backup_database

    step "Mengaktifkan mode maintenance" php artisan down --retry=60
    IN_MAINTENANCE=1

    step "Menarik kode terbaru (git pull)" git pull --ff-only "$REMOTE" "$BRANCH"
    PULLED=1

    step "Memasang paket PHP sesuai composer.lock" composer install --no-dev --optimize-autoloader --no-interaction
    step "Memasang paket JS sesuai package-lock.json" npm ci --no-audit --no-fund

    MIGRATE_STARTED=1
    step "Menjalankan migrasi database" php artisan migrate --force

    step "Membangun aset frontend (npm run build)" npm run build
    step "Menyegarkan cache Laravel (optimize:clear + optimize)" refresh_caches
    step "Menyegarkan cache permission" php artisan permission:cache-reset
    step "Me-restart worker antrean" php artisan queue:restart

    step "Membuka kembali situs" php artisan up
    IN_MAINTENANCE=0

    trap - ERR INT TERM
    say ""
    say "${GREEN}${BOLD}DEPLOY SELESAI${RESET} dalam $(fmt_dur $((SECONDS - DEPLOY_START)))"
    say "  Versi  : ${PREV_COMMIT:0:7} → $(git rev-parse --short HEAD)"
    say "  Backup : ${BACKUP_FILE}"
    say "  Log    : ${LOG}"
}

main "$@"; exit $?
