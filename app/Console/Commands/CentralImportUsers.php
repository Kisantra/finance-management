<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Organization;
use App\Services\CentralUserImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CentralImportUsers extends Command
{
    protected $signature = 'central:import-users
        {connection : Nama koneksi database deployment lama (daftarkan di config/database.php)}
        {--organization= : Slug organization tujuan (harus sudah ada)}
        {--company= : ID/slug company tujuan (harus sudah ada)}
        {--dry-run : Tampilkan ringkasan tanpa menulis apa pun}';

    protected $description = 'Impor users + role dari database deployment lama ke database pusat (idempoten)';

    public function handle(CentralUserImportService $service): int
    {
        $organization = Organization::where('slug', $this->option('organization'))->first();
        $company = Company::find($this->option('company'));

        if (! $organization || ! $company) {
            $this->error('Organization / company tujuan tidak ditemukan. Buat dulu, lalu ulangi.');

            return self::FAILURE;
        }

        $legacy = DB::connection($this->argument('connection'));

        $rows = $legacy->table('users')
            ->leftJoin('model_has_roles', function ($join) {
                $join->on('users.id', '=', 'model_has_roles.model_id')
                    ->where('model_has_roles.model_type', 'App\\Models\\User');
            })
            ->leftJoin('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->select('users.name', 'users.email', 'users.password',
                'users.phone_number', 'users.status', 'users.locale', 'roles.name as role')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();

        $this->info(sprintf('Ditemukan %d user di koneksi "%s".', count($rows), $this->argument('connection')));

        if ($this->option('dry-run')) {
            foreach ($rows as $row) {
                $this->line(sprintf('  %s <%s> role=%s', $row['name'], $row['email'], $row['role'] ?? '-'));
            }

            return self::SUCCESS;
        }

        $result = $service->import($rows, $organization, $company);

        $this->info(sprintf(
            'Selesai: %d user baru, %d sudah ada, %d keanggotaan baru → company "%s".',
            $result['imported'], $result['existing'], $result['memberships'], $company->getTenantKey()
        ));

        return self::SUCCESS;
    }
}
