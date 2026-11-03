<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seeder database CENTRAL untuk development.
     * Membuat organization + 2 perusahaan demo (masing-masing database tenant
     * sendiri via pipeline provisioning), user demo lintas perusahaan, lalu
     * data bisnis demo di dalam konteks tenant kisantra.
     */
    public function run(): void
    {
        // 0. Organization + 2 perusahaan demo (tenant DB dibuat oleh pipeline)
        [$kisantra, $semesta] = $this->seedOrganizationAndCompanies();

        // 1. User demo + keanggotaan
        $this->seedUsers($kisantra, $semesta);

        // 2. Master data central: roles global + permissions + admin assignment
        $this->call([
            MasterPermissionSeeder::class,
        ]);

        // 3. Role user demo per perusahaan (butuh roles dari MasterPermissionSeeder)
        $this->seedDemoRoles($kisantra, $semesta);

        // 4. Data bisnis demo — DI DALAM konteks tenant kisantra
        $kisantra->run(function () {
            $this->call([
                CompanyProfileSeeder::class,
                ClientSeeder::class,
                BankAccountSeeder::class,
                InvoiceSeeder::class,
                BankTransactionSeeder::class,
            ]);
        });
    }

    /**
     * @return array{0: Company, 1: Company}
     */
    private function seedOrganizationAndCompanies(): array
    {
        $organization = Organization::firstOrCreate(
            ['slug' => 'kisantra'],
            ['name' => 'Kisantra', 'company_quota' => 10]
        );

        // Dev only: migrate:fresh menghapus central, tapi database tenant lama
        // tertinggal — bersihkan supaya pipeline CreateDatabase tidak bentrok.
        DB::statement('DROP DATABASE IF EXISTS `tenant_kisantra`');
        DB::statement('DROP DATABASE IF EXISTS `tenant_semesta`');

        $kisantra = Company::create([
            'id' => 'kisantra',
            'organization_id' => $organization->id,
            'name' => 'Kisantra',
            'abbreviation' => 'KSN',
            'status' => 'active',
        ]);

        $semesta = Company::create([
            'id' => 'semesta',
            'organization_id' => $organization->id,
            'name' => 'Semesta',
            'abbreviation' => 'SPI',
            'status' => 'active',
        ]);

        $this->command->info('✓ Organization kisantra + companies: kisantra, semesta (tenant DB dibuat & di-seed)');

        return [$kisantra, $semesta];
    }

    private function seedUsers(Company $kisantra, Company $semesta): void
    {
        $admin = $this->createUser('Admin', 'admin@gmail.com', $kisantra);
        $admin->companies()->syncWithoutDetaching([$kisantra->getTenantKey()]);

        $manager = $this->createUser('Manager Demo', 'manager@gmail.com', $kisantra);
        $manager->companies()->syncWithoutDetaching([$kisantra->getTenantKey(), $semesta->getTenantKey()]);

        $staff = $this->createUser('Staff Demo', 'staff@gmail.com', $kisantra);
        $staff->companies()->syncWithoutDetaching([$kisantra->getTenantKey()]);

        $this->command->info('✓ Users: admin@gmail.com (kisantra), manager@gmail.com (kisantra+semesta), staff@gmail.com (kisantra) / password');
    }

    /**
     * manager = finance manager di KEDUA perusahaan; staff = staff di kisantra.
     * (admin di-assign oleh MasterPermissionSeeder dalam konteks kisantra.)
     */
    private function seedDemoRoles(Company $kisantra, Company $semesta): void
    {
        $manager = User::where('email', 'manager@gmail.com')->first();
        $staff = User::where('email', 'staff@gmail.com')->first();

        foreach ([$kisantra, $semesta] as $company) {
            setPermissionsTeamId($company->getTenantKey());
            $manager?->unsetRelation('roles');
            $manager?->assignRole('finance manager');
        }

        setPermissionsTeamId($kisantra->getTenantKey());
        $staff?->unsetRelation('roles');
        $staff?->assignRole('staff');

        setPermissionsTeamId(null);
    }

    private function createUser(string $name, string $email, Company $organizationSource): User
    {
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
            ]
        );

        $user->organization()->associate($organizationSource->organization_id)->save();

        return $user;
    }
}
