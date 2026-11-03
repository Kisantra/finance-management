<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder produksi/testing untuk organization Mitra Group: 10 perusahaan
 * (masing-masing database tenant sendiri via pipeline provisioning) + user:
 *  - admin@mitragroup.id    → role admin di SEMUA perusahaan
 *  - manager@mitragroup.id  → role finance manager di SEMUA perusahaan
 *  - staff.{abbr}@mitragroup.id → role staff di satu perusahaan masing-masing
 *
 * IDEMPOTEN & TANPA DROP: aman dijalankan ulang; perusahaan/user yang sudah
 * ada dilewati, keanggotaan & role hanya dilengkapi. Jalankan dengan:
 *   php artisan db:seed --class=Database\\Seeders\\MitraGroupSeeder --force
 */
class MitraGroupSeeder extends Seeder
{
    /** @var list<array{slug: string, name: string, abbreviation: string}> */
    private array $companies = [
        ['slug' => 'abdi-ocean-energy', 'name' => 'PT Abdi Ocean Energy', 'abbreviation' => 'AOE'],
        ['slug' => 'alzam-ocean-energi', 'name' => 'PT Alzam Ocean Energi', 'abbreviation' => 'ALZ'],
        ['slug' => 'bahtera-cipta-bersama', 'name' => 'PT Bahtera Cipta Bersama', 'abbreviation' => 'BCB'],
        ['slug' => 'berkah-andalan-samboja', 'name' => 'PT Berkah Andalan Samboja', 'abbreviation' => 'BAS'],
        ['slug' => 'lintas-nusa-samudra', 'name' => 'PT Lintas Nusa Samudra', 'abbreviation' => 'LNS'],
        ['slug' => 'mitra-kellian-baruna', 'name' => 'PT Mitra Kellian Baruna', 'abbreviation' => 'MKB'],
        ['slug' => 'mitra-trisula-amanah', 'name' => 'PT Mitra Trisula Amanah', 'abbreviation' => 'MTA'],
        ['slug' => 'namora-berlian-mahakam', 'name' => 'PT Namora Berlian Mahakam', 'abbreviation' => 'NBM'],
        ['slug' => 'nusantara-armada-indonesia', 'name' => 'PT Nusantara Armada Indonesia', 'abbreviation' => 'NAI'],
        ['slug' => 'samboja-laju-utama', 'name' => 'PT Samboja Laju Utama', 'abbreviation' => 'SLU'],
    ];

    public function run(): void
    {
        // Roles + permissions global (idempoten)
        $this->call(MasterPermissionSeeder::class);

        $organization = Organization::firstOrCreate(
            ['slug' => 'mitra-group'],
            ['name' => 'Mitra Group', 'company_quota' => 10]
        );

        $admin = $this->ensureUser('Admin Mitra Group', 'admin@mitragroup.id', $organization);
        $manager = $this->ensureUser('Manager Mitra Group', 'manager@mitragroup.id', $organization);

        foreach ($this->companies as $data) {
            $company = Company::find($data['slug']);

            if (! $company) {
                // Memicu pipeline provisioning: CREATE DATABASE tenant_{slug}
                // → migrate → seed master → status active (beberapa detik per perusahaan)
                $company = Company::create([
                    'id' => $data['slug'],
                    'organization_id' => $organization->id,
                    'name' => $data['name'],
                    'abbreviation' => $data['abbreviation'],
                ]);
                $this->command->info("  ✓ Provisioned {$data['name']} → tenant_{$data['slug']}");
            } else {
                $this->command->line("  • {$data['name']} sudah ada — lewati provisioning");
            }

            $this->attachWithRole($admin, $company, 'admin');
            $this->attachWithRole($manager, $company, 'finance manager');

            $staff = $this->ensureUser(
                'Staff '.$data['abbreviation'],
                'staff.'.strtolower($data['abbreviation']).'@mitragroup.id',
                $organization
            );
            $this->attachWithRole($staff, $company, 'staff');
        }

        setPermissionsTeamId(null);

        $this->command->info('✓ Mitra Group: 10 perusahaan; admin@mitragroup.id (admin semua), manager@mitragroup.id (finance manager semua), staff.{abbr}@mitragroup.id (staff per perusahaan) — password: password');
    }

    private function ensureUser(string $name, string $email, Organization $organization): User
    {
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
            ]
        );

        if ($user->organization_id === null) {
            $user->organization()->associate($organization->id)->save();
        }

        return $user;
    }

    private function attachWithRole(User $user, Company $company, string $role): void
    {
        $user->companies()->syncWithoutDetaching([$company->getTenantKey()]);

        setPermissionsTeamId($company->getTenantKey());
        $user->unsetRelation('roles');

        if (! $user->hasRole($role)) {
            $user->assignRole($role);
        }
    }
}
