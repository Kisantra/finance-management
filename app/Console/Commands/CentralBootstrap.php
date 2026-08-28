<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Models\Role;
use Throwable;

/**
 * Instalasi baru: database pusat yang baru dimigrasi tidak punya user,
 * organization, maupun perusahaan. Tidak ada yang bisa login, dan halaman
 * /admin/companies — satu-satunya jalan membuat perusahaan — justru menuntut
 * admin yang sudah login. Perintah ini memutus lingkaran itu.
 *
 * Deployment yang memigrasikan data lama TIDAK memakai perintah ini; jalurnya
 * central:adopt-database + central:import-users.
 */
class CentralBootstrap extends Command
{
    protected $signature = 'central:bootstrap
        {--organization= : Nama organization (mis. "Kisantra Group")}
        {--quota=10 : Kuota jumlah perusahaan untuk organization ini}
        {--name= : Nama lengkap admin pertama}
        {--email= : Email admin pertama}
        {--password= : Sandi admin pertama (dikosongkan = ditanyakan tersembunyi)}
        {--company= : Nama perusahaan pertama; kosongkan untuk membuatnya lewat UI nanti}
        {--slug= : Slug perusahaan, dipakai di URL /c/{slug}}
        {--abbreviation= : Singkatan perusahaan untuk nomor invoice, mis. KSN}';

    protected $description = 'Instalasi baru: buat organization, admin pertama, dan (opsional) perusahaan pertama';

    public function handle(): int
    {
        if (User::query()->exists()) {
            $this->error('Database pusat sudah berisi user. Perintah ini hanya untuk instalasi baru.');
            $this->line('Untuk memigrasikan deployment lama, pakai central:adopt-database lalu central:import-users.');

            return self::FAILURE;
        }

        $namaOrganization = $this->option('organization') ?: $this->ask('Nama organization');
        $namaAdmin = $this->option('name') ?: $this->ask('Nama lengkap admin pertama');
        $emailAdmin = $this->option('email') ?: $this->ask('Email admin pertama');
        $sandi = $this->option('password') ?: $this->secret('Sandi admin pertama');

        $pemeriksaan = Validator::make([
            'organization' => $namaOrganization,
            'name' => $namaAdmin,
            'email' => $emailAdmin,
            'password' => $sandi,
            'quota' => $this->option('quota'),
        ], [
            'organization' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', Password::min(8)],
            'quota' => ['required', 'integer', 'min:1'],
        ]);

        if ($pemeriksaan->fails()) {
            foreach ($pemeriksaan->errors()->all() as $pesan) {
                $this->error($pesan);
            }

            return self::FAILURE;
        }

        if (! Role::where('name', 'admin')->where('guard_name', 'web')->exists()) {
            $this->error('Role "admin" belum ada. Jalankan dulu: php artisan db:seed --class=MasterPermissionSeeder --force');

            return self::FAILURE;
        }

        $organization = Organization::create([
            'name' => $namaOrganization,
            'slug' => Str::slug($namaOrganization),
            'company_quota' => (int) $this->option('quota'),
        ]);
        $this->info("Organization dibuat: {$organization->name} (kuota {$organization->company_quota} perusahaan)");

        $admin = new User;
        $admin->fill([
            'name' => $namaAdmin,
            'email' => $emailAdmin,
            'password' => Hash::make($sandi),
        ]);
        // organization_id sengaja tidak fillable supaya tak bisa dititipkan
        // lewat request — mass assignment membuangnya diam-diam, dan admin
        // tanpa organization langsung 403 di halaman Perusahaan.
        $admin->organization_id = $organization->id;
        $admin->email_verified_at = now();
        $admin->save();
        $this->info("Admin pertama dibuat: {$admin->email}");

        $namaPerusahaan = $this->option('company');

        if (! $namaPerusahaan) {
            $this->newLine();
            $this->line('Perusahaan pertama belum dibuat. Login sebagai admin, lalu buat lewat menu Perusahaan.');

            return self::SUCCESS;
        }

        $slug = $this->option('slug') ?: Str::slug($namaPerusahaan);
        $singkatan = $this->option('abbreviation') ?: strtoupper(substr($slug, 0, 3));

        $this->line("Menyiapkan perusahaan {$namaPerusahaan} — database tenant_{$slug} dibuat dan dimigrasikan...");

        try {
            $company = Company::create([
                'id' => $slug,
                'organization_id' => $organization->id,
                'name' => $namaPerusahaan,
                'abbreviation' => $singkatan,
            ]);
        } catch (Throwable $e) {
            Company::where('id', $slug)->update(['status' => 'failed']);
            $this->error("Provisioning perusahaan gagal: {$e->getMessage()}");
            $this->line('Organization dan admin sudah terbentuk — login lalu ulangi pembuatan perusahaan dari menu Perusahaan.');

            return self::FAILURE;
        }

        $admin->companies()->syncWithoutDetaching([$company->getTenantKey()]);

        $timSebelumnya = getPermissionsTeamId();
        setPermissionsTeamId($company->getTenantKey());
        $admin->unsetRelation('roles');
        $admin->assignRole('admin');
        setPermissionsTeamId($timSebelumnya);

        $this->info("Perusahaan siap: /c/{$company->getTenantKey()}");
        $this->newLine();
        $this->line("Login di /login sebagai {$admin->email}, lalu buka /c/{$company->getTenantKey()}/dashboard");

        return self::SUCCESS;
    }
}
