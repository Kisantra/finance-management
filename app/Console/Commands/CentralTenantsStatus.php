<?php

namespace App\Console\Commands;

use App\Models\Company;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CentralTenantsStatus extends Command
{
    protected $signature = 'central:tenants-status';

    protected $description = 'Monitoring ringkas per perusahaan: status, keberadaan & ukuran database tenant, anggota, migration pending';

    public function handle(): int
    {
        $tenantMigrations = $this->tenantMigrationNames();
        $companies = Company::withCount('members')->orderBy('created_at')->get();

        $missingDatabases = 0;
        $rows = [];

        foreach ($companies as $company) {
            $slug = (string) $company->getTenantKey();
            $database = $this->tenantDatabaseName($slug);
            $databaseExists = $database !== null && $this->databaseExists($database);

            if (! $databaseExists) {
                $missingDatabases++;
            }

            $rows[] = [
                $slug,
                $company->name,
                $company->status,
                $database === null ? 'INVALID SLUG' : ($databaseExists ? 'OK' : 'MISSING'),
                $databaseExists ? number_format($this->databaseSizeMb($database), 2) : '-',
                $company->members_count,
                $databaseExists ? $this->pendingMigrationCount($database, $tenantMigrations) : '-',
            ];
        }

        $this->table(
            ['Slug', 'Nama', 'Status', 'Database', 'Ukuran (MB)', 'Anggota', 'Migration pending'],
            $rows
        );

        $this->info(sprintf(
            'Total: %d perusahaan | aktif: %d | failed: %d | DB hilang: %d',
            $companies->count(),
            $companies->where('status', 'active')->count(),
            $companies->where('status', 'failed')->count(),
            $missingDatabases
        ));

        return self::SUCCESS;
    }

    /**
     * Nama database tenant dari slug. Slug divalidasi ketat sebelum pernah
     * diinterpolasi ke query (identifier tidak bisa memakai binding).
     */
    protected function tenantDatabaseName(string $slug): ?string
    {
        if (! preg_match('/^[a-z0-9-]+$/', $slug)) {
            return null;
        }

        return 'tenant_'.$slug;
    }

    protected function databaseExists(string $database): bool
    {
        return DB::selectOne(
            'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
            [$database]
        ) !== null;
    }

    protected function databaseSizeMb(string $database): float
    {
        $row = DB::selectOne(
            'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
             FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
            [$database]
        );

        return (float) ($row->size_mb ?? 0);
    }

    /**
     * Jumlah migration tenant yang belum tercatat di tabel migrations DB
     * tenant. Bila tabel migrations belum ada, semua migration dihitung
     * pending. $database sudah tervalidasi lewat tenantDatabaseName().
     *
     * @param  list<string>  $tenantMigrations
     */
    protected function pendingMigrationCount(string $database, array $tenantMigrations): int
    {
        if (! $this->migrationsTableExists($database)) {
            return count($tenantMigrations);
        }

        $ran = array_column(
            DB::select("SELECT migration FROM `{$database}`.`migrations`"),
            'migration'
        );

        return count(array_diff($tenantMigrations, $ran));
    }

    protected function migrationsTableExists(string $database): bool
    {
        return DB::selectOne(
            'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
            [$database, 'migrations']
        ) !== null;
    }

    /**
     * Daftar nama migration tenant (basename tanpa .php) dari
     * database/migrations/tenant.
     *
     * @return list<string>
     */
    protected function tenantMigrationNames(): array
    {
        $files = glob(database_path('migrations/tenant/*.php')) ?: [];

        return array_values(array_map(
            fn (string $path): string => basename($path, '.php'),
            $files
        ));
    }
}
