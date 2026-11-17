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
 *  - admin@mitragroup.id          → role admin di SEMUA perusahaan
 *  - manager@mitragroup.id        → role finance manager di SEMUA perusahaan
 *  - admin.{abbr}@mitragroup.id   → role admin di satu perusahaan masing-masing
 *  - manager.{abbr}@mitragroup.id → role finance manager di satu perusahaan masing-masing
 *  - staff.{abbr}@mitragroup.id   → role staff di satu perusahaan masing-masing
 *
 * IDEMPOTEN & TANPA DROP: aman dijalankan ulang; perusahaan/user yang sudah
 * ada dilewati, keanggotaan & role hanya dilengkapi. Jalankan dengan:
 *   php artisan db:seed --class=Database\\Seeders\\MitraGroupSeeder --force
 * Isi data keuangan 2025 dari data mentah: DataPerusahaanSeeder (memanggil seeder ini lebih dulu).
 */
class MitraGroupSeeder extends Seeder
{
    /**
     * `holding`: perusahaan induk yang menggaji staf holding dan ditagih bagian biayanya oleh
     * perusahaan lain (dipakai DataPerusahaanSeeder untuk mengelompokkan biaya itu).
     *
     * @var list<array{slug: string, name: string, abbreviation: string, holding?: bool}>
     */
    public const PERUSAHAAN = [
        ['slug' => 'abdi-ocean-energy', 'name' => 'PT Abdi Ocean Energy', 'abbreviation' => 'AOE'],
        ['slug' => 'alzam-ocean-energi', 'name' => 'PT Alzam Ocean Energy', 'abbreviation' => 'ALZ'],
        ['slug' => 'bahtera-cipta-bersama', 'name' => 'PT Bahtera Cipta Bersama', 'abbreviation' => 'BCB'],
        ['slug' => 'berkah-andalan-samboja', 'name' => 'PT Berkah Andalan Samboja', 'abbreviation' => 'BAS'],
        ['slug' => 'lintas-nusa-samudra', 'name' => 'PT Lintas Nusa Samudra', 'abbreviation' => 'LNS'],
        ['slug' => 'mitra-kellian-baruna', 'name' => 'PT Mitra Kellian Baruna', 'abbreviation' => 'MKB'],
        ['slug' => 'mitra-trisula-amanah', 'name' => 'PT Mitra Trisula Amanah', 'abbreviation' => 'MTA', 'holding' => true],
        ['slug' => 'namora-berlian-mahakam', 'name' => 'PT Namora Berlian Mahakam', 'abbreviation' => 'NBM'],
        ['slug' => 'nusantara-armada-indonesia', 'name' => 'PT Nusantara Armada Indonesia', 'abbreviation' => 'NAI'],
        ['slug' => 'samboja-laju-utama', 'name' => 'PT Samboja Laju Utama', 'abbreviation' => 'SLU'],
    ];

    /** Akun khusus satu perusahaan: awalan email → role. */
    private const AKUN_PERUSAHAAN = [
        'admin' => 'admin',
        'manager' => 'finance manager',
        'staff' => 'staff',
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

        foreach (self::PERUSAHAAN as $data) {
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

            foreach (self::AKUN_PERUSAHAAN as $awalan => $role) {
                $user = $this->ensureUser(
                    ucfirst($awalan).' '.$data['abbreviation'],
                    self::emailPerusahaan($awalan, $data['abbreviation']),
                    $organization
                );
                $this->attachWithRole($user, $company, $role);
            }
        }

        setPermissionsTeamId(null);

        $this->command->info('✓ Mitra Group: 10 perusahaan; admin@mitragroup.id (admin semua), manager@mitragroup.id (finance manager semua), admin.{abbr} / manager.{abbr} / staff.{abbr}@mitragroup.id (per perusahaan) — password: password');
    }

    /** Email akun khusus satu perusahaan, mis. staff.aoe@mitragroup.id. */
    public static function emailPerusahaan(string $awalan, string $singkatan): string
    {
        return $awalan.'.'.strtolower($singkatan).'@mitragroup.id';
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
