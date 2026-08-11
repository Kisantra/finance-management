# Deploy ke VPS Hostinger — Multi-Database di Satu Aplikasi

Panduan step-by-step hosting branch `multi-tenancy` di VPS Hostinger
(struktur `/home/{site-user}/htdocs` = CloudPanel; ada catatan untuk nginx polos).
Skema: **satu codebase, satu domain, satu database central + satu database per
perusahaan** (`tenant_{slug}`), URL per perusahaan `/c/{slug}/...`.

> Karena identifikasi perusahaan lewat PATH (bukan subdomain), **tidak perlu
> wildcard DNS/SSL** — satu domain + sertifikat Let's Encrypt biasa cukup.

Asumsi di bawah: site user **`kisantra-testing`**, domain **`finance.kisantra.com`**
(ganti sesuai punyamu), OS Ubuntu.

---

## 1. Prasyarat Server (sebagai root, sekali saja)

```bash
# Cek versi yang ada
php -v          # butuh 8.3+, disarankan 8.4
mysql --version # butuh MySQL 8.x
node -v         # butuh 22.x untuk build frontend

# PHP 8.4 + ekstensi yang dipakai aplikasi (Ubuntu; lewati yang sudah ada)
apt update
apt install -y php8.4-cli php8.4-fpm php8.4-mysql php8.4-mbstring php8.4-xml \
  php8.4-curl php8.4-zip php8.4-gd php8.4-intl php8.4-bcmath unzip git

# Composer (jika belum)
command -v composer || (curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer)

# Node 22 (untuk npm run build; jika belum)
command -v node || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs)

# mysqldump untuk central:backup
command -v mysqldump || apt install -y mysql-client
```

CloudPanel: pastikan **PHP version site = 8.4** (Sites → site → PHP Settings).

---

## 2. Buat Site & Clone Kode

**CloudPanel:** buat site PHP baru (Sites → Add Site → PHP) untuk domain
`finance.kisantra.com` dengan site user `kisantra-testing` (atau pakai yang ada).
Arahkan DNS A record domain ke IP VPS, lalu aktifkan SSL Let's Encrypt dari
CloudPanel (Sites → SSL/TLS).

```bash
cd /home/kisantra-testing/htdocs
git clone -b multi-tenancy https://github.com/Kisantra/finance-management.git finance
cd finance

# Semua perintah artisan/composer SELANJUTNYA jalankan sebagai site user, BUKAN root:
chown -R kisantra-testing:kisantra-testing /home/kisantra-testing/htdocs/finance
```

> Repo private? Pakai deploy key: `sudo -u kisantra-testing ssh-keygen -t ed25519`,
> tambahkan public key-nya sebagai Deploy Key (read-only) di GitHub repo, lalu clone
> via SSH (`git@github.com:Kisantra/finance-management.git`).

**Document root** WAJIB menunjuk ke folder `public`:
- CloudPanel: Sites → site → Settings → Root Directory → `htdocs/finance/public`.
- Nginx polos: `root /home/kisantra-testing/htdocs/finance/public;` + blok standar
  Laravel (`try_files $uri $uri/ /index.php?$query_string;`).

---

## 3. MySQL — Central + Pola Tenant (kunci skema multi-database)

Masuk MySQL sebagai root (`mysql -u root -p`), lalu:

```sql
-- 1. Database CENTRAL (users, roles, companies, sessions, jobs — TANPA angka keuangan)
CREATE DATABASE kisantra_core CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. SATU user aplikasi. Trik penting: GRANT dengan pola `tenant\_%` memberi hak
--    penuh (termasuk CREATE/DROP DATABASE) HANYA untuk database berawalan tenant_
--    — provisioning dari UI admin jalan, tanpa GRANT CREATE ON *.* yang longgar
--    (sesuai pengetatan keputusan final slide 11).
CREATE USER 'finance_app'@'localhost' IDENTIFIED BY 'GANTI-PASSWORD-KUAT';
GRANT ALL PRIVILEGES ON `kisantra_core`.* TO 'finance_app'@'localhost';
GRANT ALL PRIVILEGES ON `tenant\_%`.*    TO 'finance_app'@'localhost';
FLUSH PRIVILEGES;
```

Verifikasi pola grant bekerja (harus sukses yang pertama, GAGAL yang kedua):

```bash
mysql -u finance_app -p -e "CREATE DATABASE tenant_cobagrant; DROP DATABASE tenant_cobagrant;"
mysql -u finance_app -p -e "CREATE DATABASE bukan_tenant;"   # harus: Access denied ✓
```

Pastikan MySQL hanya listen lokal: `bind-address = 127.0.0.1` (default CloudPanel ✓).

---

## 4. Konfigurasi `.env` Produksi

```bash
cd /home/kisantra-testing/htdocs/finance
sudo -u kisantra-testing cp .env.example .env
sudo -u kisantra-testing nano .env
```

Isi minimum yang HARUS diubah:

```env
APP_NAME="Finance Management"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://finance.kisantra.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=kisantra_core
DB_USERNAME=finance_app
DB_PASSWORD=GANTI-PASSWORD-KUAT

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
QUEUE_CONNECTION=database
CACHE_STORE=database
```

`SESSION_DOMAIN` biarkan `null` (tidak pakai subdomain). Lalu:

```bash
sudo -u kisantra-testing composer install --no-dev --prefer-dist --optimize-autoloader
sudo -u kisantra-testing php artisan key:generate --force
sudo -u kisantra-testing php artisan storage:link
```

---

## 5. Migrasi Central + Build Frontend

```bash
# Central dulu (users, roles, companies, sessions, jobs, dst.)
sudo -u kisantra-testing php artisan migrate --force

# Build SETELAH migrate (proses build mem-boot aplikasi untuk wayfinder:generate)
sudo -u kisantra-testing npm ci
sudo -u kisantra-testing npm run build

# Cache produksi. PERHATIAN: JANGAN `route:cache` — routes/web.php punya route
# closure (/api/*), route caching akan error. config:cache & view:cache aman.
sudo -u kisantra-testing php artisan config:cache
sudo -u kisantra-testing php artisan view:cache
```

---

## 6. Bootstrap Organization + Perusahaan Pertama + Admin

Pilih SATU dari dua jalur:

### Jalur A — VPS testing (data demo lengkap, paling cepat)

```bash
sudo -u kisantra-testing php artisan migrate:fresh --seed --force
```

Hasil: organization `kisantra` + 2 perusahaan (**kisantra**, **semesta**, database
`tenant_kisantra` & `tenant_semesta` dibuat + di-seed otomatis) + akun demo:
`admin@gmail.com`, `manager@gmail.com` (2 PT), `staff@gmail.com` — password `password`.
⚠ Seeder ini me-reset central dan MEN-DROP `tenant_kisantra`/`tenant_semesta` — hanya
untuk lingkungan testing.

### Jalur B — Produksi bersih (tanpa data demo)

```bash
# Roles + 75 permission global
sudo -u kisantra-testing php artisan db:seed --class=Database\\Seeders\\MasterPermissionSeeder --force

sudo -u kisantra-testing php artisan tinker
```

Di tinker (ganti nilai sesuai kebutuhan):

```php
$org = App\Models\Organization::create(['name' => 'Kisantra', 'slug' => 'kisantra', 'company_quota' => 10]);

// Membuat DATABASE tenant_kisantra + migrate + seed master + status active (beberapa detik)
$company = App\Models\Company::create(['id' => 'kisantra', 'organization_id' => $org->id, 'name' => 'Kisantra', 'abbreviation' => 'KSN']);

$admin = App\Models\User::create(['name' => 'Admin', 'email' => 'admin@perusahaanmu.com', 'password' => Illuminate\Support\Facades\Hash::make('PASSWORD-KUAT'), 'email_verified_at' => now()]);
$admin->organization()->associate($org->id)->save();
$admin->companies()->attach('kisantra');
setPermissionsTeamId('kisantra');
$admin->assignRole('admin');
```

Perusahaan BERIKUTNYA tidak perlu tinker lagi — buat dari UI:
**login → `/c/kisantra/admin/companies` → Perusahaan Baru** (kuota organization dicek,
database dibuat otomatis, gagal = tombol Coba Ulang).

---

## 7. Queue Worker + Scheduler + Backup

```bash
# Supervisor — satu pool worker untuk SEMUA perusahaan (payload job membawa tenant id)
apt install -y supervisor
cat > /etc/supervisor/conf.d/finance-worker.conf <<'EOF'
[program:finance-worker]
command=php /home/kisantra-testing/htdocs/finance/artisan queue:work --sleep=3 --tries=3 --max-time=3600
user=kisantra-testing
numprocs=2
process_name=%(program_name)s_%(process_num)02d
autostart=true
autorestart=true
stdout_logfile=/home/kisantra-testing/htdocs/finance/storage/logs/worker.log
EOF
supervisorctl reread && supervisorctl update && supervisorctl status

# Cron milik site user: scheduler (menjalankan notifikasi jatuh-tempo per tenant)
# + backup malam per database
sudo -u kisantra-testing crontab -e
```

Isi crontab:

```cron
* * * * * cd /home/kisantra-testing/htdocs/finance && php artisan schedule:run >> /dev/null 2>&1
0 2 * * * cd /home/kisantra-testing/htdocs/finance && php artisan central:backup --keep-days=14 >> storage/logs/backup.log 2>&1
```

---

## 8. Checklist Verifikasi (urut)

```bash
sudo -u kisantra-testing php artisan central:tenants-status   # semua company: status active, DB OK
```

Lalu dari browser:
1. `https://finance.kisantra.com/` → redirect ke login → login admin.
2. Setelah login → pemilih perusahaan (atau langsung dashboard bila 1 perusahaan).
3. `/c/kisantra/dashboard` → 200; `/c/slug-ngawur/dashboard` → 404.
4. User tanpa keanggotaan perusahaan lain → 403 saat memaksa URL perusahaan itu.
5. Buat invoice draft → hapus (menguji tulis ke DB tenant).
6. `/c/kisantra/admin/companies` → buat perusahaan uji → muncul `active` → buka →
   hapus dari DB kalau cuma tes (`tinker: App\Models\Company::find('uji')->delete()`
   — ikut men-drop database tenant-nya).

---

## 9. Deploy Rutin (setiap rilis berikutnya)

```bash
cd /home/kisantra-testing/htdocs/finance
sudo -u kisantra-testing git pull
sudo -u kisantra-testing composer install --no-dev --prefer-dist --optimize-autoloader
sudo -u kisantra-testing npm ci && sudo -u kisantra-testing npm run build

# Migrasi aman: central → CANARY satu perusahaan → sisanya, laporan per perusahaan.
# Gagal di canary = berhenti total, tenant lain tidak tersentuh.
sudo -u kisantra-testing php artisan central:deploy-migrate --canary=kisantra --force

sudo -u kisantra-testing php artisan config:cache
sudo -u kisantra-testing php artisan view:cache
sudo -u kisantra-testing php artisan queue:restart
```

Aturan: migration tenant wajib **expand–contract** (kode baru harus jalan di skema
lama & baru) — deploy buruk sekarang mengenai SEMUA perusahaan.

---

## 10. Nanti: Memboyong Deployment Lama (cutover, runbook §G)

Saat siap memindahkan data produksi lama ke server ini, per perusahaan:

```bash
# 1. Di server lama: freeze + dump
mysqldump -u ... -p DATABASE_LAMA > lama.sql

# 2. Di VPS ini: restore sebagai tenant_{slug}
mysql -u root -p -e "CREATE DATABASE tenant_namaco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p tenant_namaco < lama.sql

# 3. Daftarkan + samakan skema + tarik user ke central
sudo -u kisantra-testing php artisan central:adopt-database namaco \
  --organization=kisantra --name="Nama Perusahaan" --abbreviation=NCO
# daftarkan koneksi DB lama di config/database.php sebagai 'legacy', lalu:
sudo -u kisantra-testing php artisan central:import-users legacy \
  --organization=kisantra --company=namaco
```

Prasyarat yang masih manual: **ukur version drift** tiap deployment lama
(`git rev-parse HEAD` + `php artisan migrate:status`) sebelum restore — lihat
runbook §0.3 dan §G.2.

---

## Troubleshooting Cepat

| Gejala | Penyebab umum |
|---|---|
| 500 di semua halaman | `config:cache` belum di-refresh setelah ubah .env → `php artisan config:cache` |
| 403 setelah login | User belum punya keanggotaan (`company_user`) / role di perusahaan itu |
| Provisioning dari UI gagal | Grant MySQL pola `tenant\_%` belum benar — uji §3; lihat `storage/logs/laravel.log`, lalu tombol Coba Ulang |
| Notifikasi jatuh tempo tidak jalan | Cron `schedule:run` belum terpasang (§7) |
| Angka/saldo "hilang" | Pastikan URL berada di perusahaan yang benar — data per perusahaan terpisah database |
| `route:cache` error closure | Memang — jangan pakai route:cache (lihat §5) |
