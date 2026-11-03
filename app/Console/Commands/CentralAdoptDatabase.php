<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Organization;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class CentralAdoptDatabase extends Command
{
    protected $signature = 'central:adopt-database
        {slug : Slug perusahaan (permanen — menjadi URL, nama DB tenant_{slug}, path storage)}
        {--organization= : Slug organization tujuan (harus sudah ada)}
        {--name= : Nama perusahaan}
        {--abbreviation= : Singkatan dokumen (wajib manual, dipakai nomor invoice)}';

    protected $description = 'Daftarkan database deployment lama (sudah di-restore sebagai tenant_{slug}) sebagai tenant';

    public function handle(): int
    {
        $slug = $this->argument('slug');
        $database = 'tenant_'.$slug;

        $organization = Organization::where('slug', $this->option('organization'))->first();
        if (! $organization) {
            $this->error('Organization tidak ditemukan. Buat dulu, lalu ulangi.');

            return self::FAILURE;
        }

        if (! $this->option('name') || ! $this->option('abbreviation')) {
            $this->error('--name dan --abbreviation wajib diisi (singkatan tidak boleh otomatis).');

            return self::FAILURE;
        }

        $exists = DB::selectOne('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [$database]);
        if (! $exists) {
            $this->error("Database {$database} belum ada. Restore dump deployment lama ke {$database} lebih dulu.");

            return self::FAILURE;
        }

        if (Company::find($slug)) {
            $this->warn("Company {$slug} sudah terdaftar — melewati pembuatan, lanjut migrate.");
        } else {
            // withoutEvents: database sudah ada (hasil restore) — jangan jalankan
            // pipeline CreateDatabase/SeedDatabase
            Company::withoutEvents(fn () => Company::create([
                'id' => $slug,
                'organization_id' => $organization->id,
                'name' => $this->option('name'),
                'abbreviation' => $this->option('abbreviation'),
                'status' => 'active',
            ]));
            $this->info("✓ Company {$slug} terdaftar → {$database}");
        }

        // Samakan skema: hanya migration tenant yang belum tercatat yang berjalan
        // (entri lama di tabel migrations hasil restore tetap dihormati)
        $this->info('Menjalankan tenants:migrate untuk tenant ini...');
        Artisan::call('tenants:migrate', ['--tenants' => [$slug], '--force' => true], $this->output);

        $this->warn('Ingat: tabel sisa central di DB adopsi (users, roles, sessions, jobs, cache, dll.) tidak dipakai lagi — bersihkan manual setelah verifikasi.');
        $this->info('Lanjutkan dengan: php artisan central:import-users {koneksi-legacy} --organization='.$organization->slug." --company={$slug}");

        return self::SUCCESS;
    }
}
